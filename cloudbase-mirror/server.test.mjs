import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createMirrorServer, mirrorSignatureInput } from "./server.mjs";

const listen = (server) => new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});

test("serves the SPA and signs proxied API requests", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "liu-os-mirror-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), "<main>Liu OS China</main>");
  await writeFile(path.join(root, "assets", "app.js"), "console.log('ok')");

  const secret = "test-proxy-secret";
  const upstream = createServer((request, response) => {
    const timestamp = request.headers["x-liu-mirror-ts"];
    const address = request.headers["x-liu-mirror-ip"];
    const actual = request.headers["x-liu-mirror-signature"];
    const expected = createHmac("sha256", secret).update(mirrorSignatureInput({
      timestamp,
      address,
      method: request.method,
      pathname: new URL(request.url, "http://upstream").pathname,
    })).digest("hex");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ valid: actual === expected, address }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => upstream.close());

  const mirror = createMirrorServer({
    publicRoot: root,
    originBase: `http://127.0.0.1:${upstreamPort}`,
    proxySecret: secret,
  });
  const mirrorPort = await listen(mirror);
  context.after(() => mirror.close());

  const page = await fetch(`http://127.0.0.1:${mirrorPort}/project/example`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Liu OS China/);

  const proxied = await fetch(`http://127.0.0.1:${mirrorPort}/api/content`, {
    headers: { "x-forwarded-for": "203.0.113.8" },
  });
  assert.deepEqual(await proxied.json(), { valid: true, address: "203.0.113.8" });
});
