import fs from 'node:fs/promises';

const catalogSource = await fs.readFile('src/data/aiBotCatalog.ts', 'utf8');
const report = JSON.parse(await fs.readFile('reports/ai-bookmark-sync.json', 'utf8'));
const start = catalogSource.indexOf(' = [') + 3;
const end = catalogSource.lastIndexOf(']') + 1;
const catalog = JSON.parse(catalogSource.slice(start, end).replace(/,\s*]$/, ']'));
const errors = [];
const resolved = catalog.filter((bookmark) => bookmark.targetUrl);
const unresolved = catalog.filter((bookmark) => !bookmark.targetUrl);
const targetUrls = new Set();

for (const bookmark of catalog) {
  if (typeof bookmark.targetUrl !== 'string') errors.push(`${bookmark.id}: targetUrl is not a string`);
  if (!bookmark.targetUrl && bookmark.status !== 'unresolved') errors.push(`${bookmark.id}: missing unresolved status`);
  if (bookmark.targetUrl) {
    let url;
    try {
      url = new URL(bookmark.targetUrl);
    } catch {
      errors.push(`${bookmark.id}: invalid targetUrl`);
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) errors.push(`${bookmark.id}: unsafe protocol`);
    if (url.hostname.toLowerCase() === 'ai-bot.cn') errors.push(`${bookmark.id}: targetUrl points to ai-bot.cn`);
    if (targetUrls.has(bookmark.targetUrl)) errors.push(`${bookmark.id}: duplicate targetUrl`);
    targetUrls.add(bookmark.targetUrl);
  }
}

if (report.resolved !== resolved.length) errors.push('sync report resolved count does not match catalog');
if (report.unresolved !== unresolved.length) errors.push('sync report unresolved count does not match catalog');

console.log(JSON.stringify({
  total: catalog.length,
  resolved: resolved.length,
  unresolved: unresolved.length,
  sourcePages: catalog.filter((bookmark) => bookmark.sourcePageUrl).length,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
