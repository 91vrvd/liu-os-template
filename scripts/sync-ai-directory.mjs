import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'src/data/aiBotCatalog.ts');
const jsonPath = path.join(root, 'src/data/ai-directory.json');
const reportPath = path.join(root, 'reports/ai-directory-sync.json');
const aiBotHost = 'ai-bot.cn';
const trackingParams = /^(?:utm(?:_.*)?|ref|referral|referrer_s|from|source|sourceid|channel(?:id|code)?|campaign|invite|invitecode|affiliate|aff|fbclid|gclid|si|pic|cg_click_id|cgv|via|ic|ch|hmsr)$/i;
const searchHosts = /(^|\.)(?:bing|google)\.(?:com|cn)$/i;
const redirectHosts = /(^|\.)(?:cgref\.cn|spotify\.link)$/i;
const unsafeWords = /(?:porn|casino|gambling|博彩|色情)/i;
const knownInvalidIds = new Set([
  'ai-bot-31', 'ai-bot-32', 'ai-bot-2304', 'ai-bot-1325', 'ai-bot-2195', 'ai-bot-59',
  'ai-bot-575', 'ai-bot-577', 'ai-bot-580', 'ai-bot-58', 'ai-bot-912', 'ai-bot-726',
  'ai-bot-6492', 'ai-bot-151', 'ai-bot-1381', 'ai-bot-1387', 'ai-bot-68239', 'ai-bot-137',
  'ai-bot-457', 'ai-bot-2034', 'ai-bot-1978', 'ai-bot-1220', 'ai-bot-141', 'ai-bot-140',
  'ai-bot-139', 'ai-bot-138', 'ai-bot-163', 'ai-bot-1656', 'ai-bot-2122', 'ai-bot-1710',
  'ai-bot-1890', 'ai-bot-14609', 'ai-bot-61081', 'ai-bot-49', 'ai-bot-50', 'ai-bot-61488',
]);

const parseCatalog = async () => {
  const source = await fs.readFile(catalogPath, 'utf8');
  const start = source.indexOf(' = [') + 3;
  const end = source.lastIndexOf(']') + 1;
  if (start < 3 || end <= start) throw new Error('catalog-array-not-found');
  return JSON.parse(source.slice(start, end).replace(/,\s*]$/, ']'));
};

const normalizeUrl = (value, baseUrl) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    for (const key of [...url.searchParams.keys()]) {
      const parameterValue = url.searchParams.get(key) ?? '';
      if (trackingParams.test(key) || /(?:^|[^a-z])ai-?bot(?:[^a-z]|$)/i.test(parameterValue)) {
        url.searchParams.delete(key);
        continue;
      }
      const nestedTrackingIndex = parameterValue.search(/[?&](?:utm(?:_[^=&#]*)?|ref|hmsr)=/i);
      if (nestedTrackingIndex >= 0) url.searchParams.set(key, parameterValue.slice(0, nestedTrackingIndex));
    }
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
};

const hostnameOf = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isAiBotUrl = (value) => hostnameOf(value) === aiBotHost;
const isInvalidTarget = (value, title = '') => {
  const host = hostnameOf(value);
  return !host || searchHosts.test(host) || unsafeWords.test(`${host} ${title}`);
};

const stripMarkup = (value) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const repairMojibake = (value) => {
  if (typeof value !== 'string' || !/[ÃÂÐÑäåæçèéïð]/.test(value)) return value;
  const repaired = Buffer.from(value, 'latin1').toString('utf8');
  return repaired.includes('\uFFFD') ? value : repaired;
};

const extractCandidateLinks = (html, sourceUrl) => {
  const candidates = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const attrs = match[1];
    const href = attrs.match(/\bhref\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    const targetUrl = normalizeUrl(href, sourceUrl);
    if (!targetUrl || isAiBotUrl(targetUrl) || isInvalidTarget(targetUrl)) continue;
    if (/(?:wp-content|googleads|doubleclick|beian)/i.test(targetUrl)) continue;
    const text = stripMarkup(match[2]);
    const context = `${attrs} ${text} ${html.slice(Math.max(0, match.index - 240), match.index + match[0].length + 240)}`;
    let score = 0;
    if (/官网|官方网站|产品官网|访问|立即使用|official|website|visit|get started/i.test(context)) score += 8;
    if (/target\s*=\s*['"]_blank['"]/i.test(attrs)) score += 2;
    if (/external|site-go|site-go-url/i.test(attrs)) score += 3;
    if (/广告|赞助|sponsored|banner/i.test(context)) score -= 8;
    candidates.push({ targetUrl, score });
  }
  return candidates.sort((a, b) => b.score - a.score);
};

const fetchWithTimeout = (url, method = 'GET') => fetch(url, {
  method,
  redirect: 'follow',
  headers: { 'user-agent': 'LiuOS-AI-Directory-Sync/2.0' },
  signal: AbortSignal.timeout(15000),
});

const resolveSourcePage = async (sourcePageUrl) => {
  try {
    const response = await fetchWithTimeout(sourcePageUrl);
    if (!response.ok) return null;
    const candidates = extractCandidateLinks(await response.text(), sourcePageUrl);
    return candidates.find((candidate) => candidate.score >= 8)?.targetUrl ?? null;
  } catch {
    return null;
  }
};

const resolveRedirect = async (targetUrl) => {
  try {
    let response = await fetchWithTimeout(targetUrl, 'HEAD');
    if (!response.ok || !response.url) response = await fetchWithTimeout(targetUrl);
    return normalizeUrl(response.url || targetUrl) ?? targetUrl;
  } catch {
    return targetUrl;
  }
};

const shouldResolveRedirect = (targetUrl) => {
  const url = new URL(targetUrl);
  return redirectHosts.test(url.hostname) || [...url.searchParams.keys()].some((key) => trackingParams.test(key));
};

const canonicalTarget = (value) => {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
};

const runBatches = async (entries, worker, batchSize = 8) => {
  const results = new Map();
  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const resolved = await Promise.all(batch.map(async (entry) => [entry.id, await worker(entry)]));
    resolved.forEach(([id, value]) => results.set(id, value));
  }
  return results;
};

const writeOutputs = async (bookmarks, report) => {
  const output = `import type { SafariBookmark } from './aiBookmarks';\n\n// Generated by scripts/sync-ai-directory.mjs. Do not edit by hand.\nexport const aiBotCatalog: SafariBookmark[] = ${JSON.stringify(bookmarks, null, 2)};\n`;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(catalogPath, output);
  await fs.writeFile(jsonPath, `${JSON.stringify({ version: 2, generatedAt: report.generatedAt, bookmarks }, null, 2)}\n`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
};

const main = async () => {
  const original = await parseCatalog();
  const useNetwork = process.argv.includes('--resolve');
  const sourceEntries = original.filter((entry) => entry.sourcePageUrl && (!entry.targetUrl || isAiBotUrl(entry.targetUrl)));
  const sourceResults = useNetwork ? await runBatches(sourceEntries, (entry) => resolveSourcePage(entry.sourcePageUrl)) : new Map();
  const redirectEntries = original.filter((entry) => entry.targetUrl && shouldResolveRedirect(entry.targetUrl));
  const redirectResults = useNetwork ? await runBatches(redirectEntries, (entry) => resolveRedirect(entry.targetUrl), 6) : new Map();
  const seenTargets = new Set();
  const output = [];
  const report = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'https://ai-bot.cn/',
    totalInput: original.length,
    valid: 0,
    unresolved: 0,
    invalid: 0,
    redirectsResolved: 0,
    duplicateTargetsRemoved: 0,
    unresolvedEntries: [],
    invalidEntries: [],
  };

  for (const entry of original) {
    const sourcePageUrl = normalizeUrl(entry.sourcePageUrl) ?? (isAiBotUrl(entry.url) ? normalizeUrl(entry.url) : undefined);
    const rawTarget = sourceResults.get(entry.id) || redirectResults.get(entry.id) || entry.targetUrl || (!sourcePageUrl ? entry.url : '');
    let targetUrl = normalizeUrl(rawTarget);
    if (targetUrl && redirectResults.get(entry.id) && targetUrl !== normalizeUrl(entry.targetUrl)) report.redirectsResolved += 1;
    let linkStatus = 'valid';
    if (knownInvalidIds.has(entry.id) || entry.linkStatus === 'invalid') {
      report.invalid += 1;
      report.invalidEntries.push({ id: entry.id, title: entry.title, rejectedUrl: targetUrl || undefined, sourcePageUrl });
      targetUrl = '';
      linkStatus = 'invalid';
    } else if (!targetUrl || isAiBotUrl(targetUrl)) {
      targetUrl = '';
      linkStatus = 'unresolved';
      report.unresolved += 1;
      report.unresolvedEntries.push({ id: entry.id, title: entry.title, sourcePageUrl });
    } else if (isInvalidTarget(targetUrl, entry.title)) {
      report.invalid += 1;
      report.invalidEntries.push({ id: entry.id, title: entry.title, rejectedUrl: targetUrl, sourcePageUrl });
      targetUrl = '';
      linkStatus = 'invalid';
    } else {
      const canonical = canonicalTarget(targetUrl);
      if (seenTargets.has(canonical)) {
        report.duplicateTargetsRemoved += 1;
        continue;
      }
      seenTargets.add(canonical);
      report.valid += 1;
    }

    output.push({
      id: entry.id,
      title: repairMojibake(entry.title),
      targetUrl,
      ...(sourcePageUrl ? { sourcePageUrl } : {}),
      descriptionZh: repairMojibake(entry.descriptionZh),
      descriptionEn: repairMojibake(entry.descriptionEn),
      categoryId: entry.categoryId,
      ...(entry.subcategoryId ? { subcategoryId: entry.subcategoryId } : {}),
      ...(targetUrl ? { icon: `https://www.google.com/s2/favicons?domain=${hostnameOf(targetUrl)}&sz=64` } : {}),
      tags: Array.from(new Set([entry.categoryId, entry.subcategoryId].filter(Boolean))),
      linkStatus,
      embedStatus: entry.embedStatus ?? 'unknown',
    });
  }

  await writeOutputs(output, report);
  console.log(JSON.stringify({ ...report, unresolvedEntries: report.unresolvedEntries.length, invalidEntries: report.invalidEntries.length }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
