import fs from 'node:fs/promises';

const directory = JSON.parse(await fs.readFile('src/data/ai-directory.json', 'utf8'));
const report = JSON.parse(await fs.readFile('reports/ai-directory-sync.json', 'utf8'));
const bookmarks = directory.bookmarks ?? [];
const errors = [];
const targets = new Set();
const sourceHost = 'ai-bot.cn';
const searchHosts = /(^|\.)(?:bing|google)\.(?:com|cn)$/i;
const trackingParams = /^(?:utm(?:_.*)?|ref|referral|referrer_s|from|source|sourceid|channel(?:id|code)?|campaign|invite|invitecode|affiliate|aff|fbclid|gclid|si|pic|cg_click_id|cgv|via|ic|ch|hmsr)$/i;

for (const bookmark of bookmarks) {
  if (!['valid', 'unresolved', 'invalid'].includes(bookmark.linkStatus)) errors.push(`${bookmark.id}: invalid linkStatus`);
  if (bookmark.linkStatus === 'valid' && !bookmark.targetUrl) errors.push(`${bookmark.id}: valid bookmark has no targetUrl`);
  if (bookmark.linkStatus !== 'valid' && bookmark.targetUrl) errors.push(`${bookmark.id}: non-valid bookmark must not be clickable`);
  if (!bookmark.targetUrl) continue;
  let url;
  try {
    url = new URL(bookmark.targetUrl);
  } catch {
    errors.push(`${bookmark.id}: malformed targetUrl`);
    continue;
  }
  if (!['http:', 'https:'].includes(url.protocol)) errors.push(`${bookmark.id}: unsafe protocol`);
  if (url.hostname.toLowerCase() === sourceHost) errors.push(`${bookmark.id}: targetUrl points to source site`);
  if (searchHosts.test(url.hostname)) errors.push(`${bookmark.id}: search page used as target`);
  for (const [key, value] of url.searchParams) {
    if (trackingParams.test(key) || /(?:^|[^a-z])ai-?bot(?:[^a-z]|$)/i.test(value) || /[?&](?:utm(?:_[^=&#]*)?|ref|hmsr)=/i.test(value)) {
      errors.push(`${bookmark.id}: tracking parameter remains in targetUrl`);
      break;
    }
  }
  if (targets.has(url.href)) errors.push(`${bookmark.id}: duplicate targetUrl`);
  targets.add(url.href);
}

const valid = bookmarks.filter((bookmark) => bookmark.linkStatus === 'valid');
const unresolved = bookmarks.filter((bookmark) => bookmark.linkStatus === 'unresolved');
const invalid = bookmarks.filter((bookmark) => bookmark.linkStatus === 'invalid');
if (directory.version !== 2 || report.version !== 2) errors.push('directory/report version mismatch');
if (report.valid !== valid.length) errors.push('valid count mismatch');
if (report.unresolved !== unresolved.length) errors.push('unresolved count mismatch');
if (report.invalid !== invalid.length) errors.push('invalid count mismatch');

const categories = [...new Set(valid.map((bookmark) => bookmark.categoryId))].sort();
const sample = categories.flatMap((category) => valid.filter((bookmark) => bookmark.categoryId === category).slice(0, 2)).slice(0, 30);
const networkResults = [];
if (process.argv.includes('--network')) {
  for (let index = 0; index < sample.length; index += 6) {
    const batch = sample.slice(index, index + 6);
    const results = await Promise.all(batch.map(async (bookmark) => {
      try {
        const response = await fetch(bookmark.targetUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'LiuOS-Link-Check/2.0' } });
        return { id: bookmark.id, title: bookmark.title, targetUrl: bookmark.targetUrl, status: response.status, finalUrl: response.url };
      } catch (error) {
        return { id: bookmark.id, title: bookmark.title, targetUrl: bookmark.targetUrl, status: 0, error: error instanceof Error ? error.message : 'request-failed' };
      }
    }));
    networkResults.push(...results);
  }
}

const validation = {
  checkedAt: new Date().toISOString(),
  version: directory.version,
  total: bookmarks.length,
  valid: valid.length,
  unresolved: unresolved.length,
  invalid: invalid.length,
  categories: categories.length,
  sampleSize: sample.length,
  networkResults,
  errors,
};
await fs.writeFile('reports/ai-directory-validation.json', `${JSON.stringify(validation, null, 2)}\n`);
console.log(JSON.stringify(validation, null, 2));
if (errors.length) process.exitCode = 1;
