import { normalizedNetworkAddress } from "./network-identity";
import { runtimeEnv } from "./runtime";

const encoder = new TextEncoder();
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
};

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const providerAddress = (request: Request) => (
  request.headers.get("cf-connecting-ip")
  ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? null
);

const mirrorSignatureInput = (request: Request, address: string, timestamp: string) => (
  `${timestamp}\n${address}\n${request.method.toUpperCase()}\n${new URL(request.url).pathname}`
);

const signedMirrorAddress = async (request: Request) => {
  const secret = runtimeEnv.CHINA_MIRROR_PROXY_SECRET;
  const address = request.headers.get("x-liu-mirror-ip")?.trim();
  const timestamp = request.headers.get("x-liu-mirror-ts")?.trim();
  const signature = request.headers.get("x-liu-mirror-signature")?.trim().toLowerCase();
  if (!secret || !address || !timestamp || !signature) return null;
  if (!normalizedNetworkAddress(address)) return null;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS) {
    return null;
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(mirrorSignatureInput(request, address, timestamp)),
  ));
  return safeEqual(signature, expected) ? address : null;
};

export const trustedClientAddress = async (request: Request) => (
  await signedMirrorAddress(request) ?? providerAddress(request)
);

export const trustedClientNetwork = async (request: Request) => (
  normalizedNetworkAddress(await trustedClientAddress(request))
);
