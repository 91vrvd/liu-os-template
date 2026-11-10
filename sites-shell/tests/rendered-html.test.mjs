import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const shellRoot = new URL("../", import.meta.url);

test("redirects the site root to the Liu OS desktop", async () => {
  const page = await readFile(new URL("app/page.tsx", shellRoot), "utf8");
  assert.match(page, /redirect\(["']\/desktop\/["']\)/);
});

test("redirects the admin entry to the desktop content manager", async () => {
  const page = await readFile(new URL("app/admin/page.tsx", shellRoot), "utf8");
  assert.match(page, /redirect\(["']\/desktop\/\?admin=1["']\)/);
});

test("packages the validated desktop build and Liu OS metadata", async () => {
  await access(new URL("public/desktop/index.html", shellRoot));
  const [desktopHtml, layout] = await Promise.all([
    readFile(new URL("public/desktop/index.html", shellRoot), "utf8"),
    readFile(new URL("app/layout.tsx", shellRoot), "utf8"),
  ]);

  assert.match(desktopHtml, /<title>Desktop Portfolio<\/title>/i);
  assert.match(desktopHtml, /\/desktop\/assets\//);
  assert.match(layout, /Liu OS/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/i);
});
