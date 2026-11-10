import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "sites-shell", "public", "desktop");

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
});

const capture = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { ...options });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) {
      resolve(stdout.trim());
      return;
    }
    reject(new Error(stderr.trim() || `${command} exited with ${code}`));
  });
});

const buildId = await capture("git", ["rev-parse", "--short=12", "HEAD"], {
  cwd: root,
});

await run("npm", ["run", "build"], {
  cwd: root,
  env: {
    ...process.env,
    VITE_BASE_PATH: "/desktop/",
    VITE_BUILD_ID: buildId,
  },
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "dist"), output, { recursive: true });
