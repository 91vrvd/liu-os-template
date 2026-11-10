import { access, cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerBuild = path.join(root, 'sites-shell', 'dist');
const packageBuild = path.join(root, 'dist');

const sourceManifest = JSON.parse(await readFile(path.join(root, '.openai', 'hosting.json'), 'utf8'));
const builtManifest = JSON.parse(await readFile(path.join(workerBuild, '.openai', 'hosting.json'), 'utf8'));
if (sourceManifest.project_id !== builtManifest.project_id) {
  throw new Error('Sites build belongs to a different project.');
}

await access(path.join(workerBuild, 'server', 'index.js'));
await access(path.join(workerBuild, 'client', 'desktop', 'index.html'));

// The root dist is generated output only. The Sites packager expects the
// Worker build here, while the browser-only build remains in sites-shell/public.
await rm(packageBuild, { recursive: true, force: true });
await cp(workerBuild, packageBuild, { recursive: true });
