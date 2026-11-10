import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "cloudbase-mirror", "public");

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  child.on("error", reject);
  child.on("exit", (code) => code === 0
    ? resolve()
    : reject(new Error(`${command} exited with ${code}`)));
});

await run("npm", ["run", "build"], {
  cwd: root,
  env: {
    ...process.env,
    VITE_BASE_PATH: "/",
    VITE_BUILD_ID: process.env.VITE_BUILD_ID ?? `china-${Date.now().toString(36)}`,
  },
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "dist"), output, { recursive: true });
