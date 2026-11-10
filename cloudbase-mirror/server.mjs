import { createHmac } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ORIGIN = "https://example.com";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const securityHeaders = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

const firstHeaderValue = (value) => Array.isArray(value) ? value[0] : value;

export const clientAddress = (request) => {
  const candidate = firstHeaderValue(request.headers["x-forwarded-for"])?.split(",")[0]?.trim()
    || firstHeaderValue(request.headers["x-real-ip"])?.trim()
    || request.socket.remoteAddress?.replace(/^::ffff:/, "")
    || "";
  return /^[0-9a-f:.]{3,64}$/i.test(candidate) ? candidate : "";
};

export const mirrorSignatureInput = ({ timestamp, address, method, pathname }) => (
  `${timestamp}\n${address}\n${method.toUpperCase()}\n${pathname}`
);

const applyHeaders = (response, headers) => {
  Object.entries(securityHeaders).forEach(([key, value]) => response.setHeader(key, value));
  Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
};

const sendText = (response, status, message) => {
  response.statusCode = status;
  applyHeaders(response, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
};

const proxyRequest = async (request, response, options) => {
  const requestUrl = new URL(request.url || "/", "http://mirror.local");
  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, options.originBase);
  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === "host") return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });
  headers.set("origin", options.originBase.origin);
  headers.set("x-forwarded-host", request.headers.host || "");
  headers.set("x-forwarded-proto", "https");

  const address = clientAddress(request);
  if (address && options.proxySecret) {
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", options.proxySecret)
      .update(mirrorSignatureInput({
        timestamp,
        address,
        method: request.method || "GET",
        pathname: requestUrl.pathname,
      }))
      .digest("hex");
    headers.set("x-liu-mirror-ip", address);
    headers.set("x-liu-mirror-ts", timestamp);
    headers.set("x-liu-mirror-signature", signature);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method || "GET");
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? Readable.toWeb(request) : undefined,
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });
  response.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "location") {
      response.setHeader(key, value.replace(options.originBase.origin, options.publicOrigin(request)));
      return;
    }
    response.setHeader(key, value);
  });
  Object.entries(securityHeaders).forEach(([key, value]) => response.setHeader(key, value));
  if (!upstream.body || request.method === "HEAD") {
    response.end();
    return;
  }
  Readable.fromWeb(upstream.body).pipe(response);
};

const safeStaticPath = (publicRoot, pathname) => {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === "/desktop" || decoded === "/desktop/"
    ? "index.html"
    : decoded.startsWith("/desktop/")
      ? decoded.slice("/desktop/".length)
      : decoded.replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(publicRoot, relative);
  return resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
};

const serveStatic = async (request, response, publicRoot) => {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    sendText(response, 405, "Method Not Allowed");
    return;
  }
  const requestUrl = new URL(request.url || "/", "http://mirror.local");
  let filePath = safeStaticPath(publicRoot, requestUrl.pathname);
  if (!filePath) {
    sendText(response, 400, "Bad Request");
    return;
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
  } catch {
    filePath = path.join(publicRoot, "index.html");
    try {
      fileStat = await stat(filePath);
    } catch {
      sendText(response, 503, "Mirror build is not prepared");
      return;
    }
  }

  const extension = path.extname(filePath).toLowerCase();
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = fileStat.size - 1;
  if (range) {
    start = range[1] ? Number(range[1]) : 0;
    end = range[2] ? Number(range[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= fileStat.size) {
      response.statusCode = 416;
      response.setHeader("Content-Range", `bytes */${fileStat.size}`);
      response.end();
      return;
    }
    response.statusCode = 206;
    response.setHeader("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);
  } else {
    response.statusCode = 200;
  }
  const immutable = requestUrl.pathname.includes("/assets/");
  applyHeaders(response, {
    "Accept-Ranges": "bytes",
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "Content-Length": String(end - start + 1),
    "Content-Type": MIME_TYPES.get(extension) || "application/octet-stream",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath, { start, end }).pipe(response);
};

export const createMirrorServer = ({
  publicRoot = path.join(moduleRoot, "public"),
  originBase = DEFAULT_ORIGIN,
  proxySecret = "",
} = {}) => {
  const resolvedOrigin = new URL(originBase);
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://mirror.local");
      if (requestUrl.pathname === "/healthz") {
        response.statusCode = existsSync(path.join(publicRoot, "index.html")) ? 200 : 503;
        applyHeaders(response, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({ ok: response.statusCode === 200 }));
        return;
      }
      if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/") || requestUrl.pathname.startsWith("/media/")) {
        await proxyRequest(request, response, {
          originBase: resolvedOrigin,
          proxySecret,
          publicOrigin: (incoming) => `${firstHeaderValue(incoming.headers["x-forwarded-proto"]) || "https"}://${incoming.headers.host}`,
        });
        return;
      }
      await serveStatic(request, response, publicRoot);
    } catch (error) {
      console.error("mirror-request-failed", error instanceof Error ? error.message : "unknown-error");
      if (!response.headersSent) sendText(response, 502, "Upstream temporarily unavailable");
      else response.destroy();
    }
  });
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT || 8080);
  const server = createMirrorServer({
    originBase: process.env.ORIGIN_BASE_URL || DEFAULT_ORIGIN,
    proxySecret: process.env.CHINA_MIRROR_PROXY_SECRET || "",
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`liu-os mirror listening on ${port}`);
  });
}
