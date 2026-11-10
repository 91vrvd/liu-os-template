import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Test the real TypeScript model without adding a browser or test dependency.
const catalog = JSON.parse(await readFile(new URL('../src/components/apps/maps/places.json', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/components/apps/maps/model.ts', import.meta.url), 'utf8'))
  .replace("import catalog from './places.json';", `const catalog = ${JSON.stringify(catalog)};`);
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { matches, localTime, solarElevation, solarPosition, weatherGroup, readSaved, save } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
let checks = 0;
const qualitySource = await readFile(new URL('../src/components/apps/maps/textureQuality.ts', import.meta.url), 'utf8');
const qualityJs = ts.transpileModule(qualitySource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { textureLimit, desiredResolution } = await import(`data:text/javascript;base64,${Buffer.from(qualityJs).toString('base64')}`);
function test(name, run) { run(); checks++; console.log(`PASS ${name}`); }
test('globe quality respects GPU, mobile memory and data saving', () => {
  const desktop = { maxTextureSize: 16384, compact: false };
  assert.equal(textureLimit(desktop), 8192);
  assert.equal(textureLimit({ ...desktop, compact: true }), 4096);
  assert.equal(textureLimit({ ...desktop, memory: 4 }), 4096);
  assert.equal(textureLimit({ ...desktop, maxTextureSize: 4096 }), 4096);
  assert.equal(textureLimit({ ...desktop, maxTextureSize: 2048 }), 2048);
  assert.equal(textureLimit({ ...desktop, saveData: true }), 2048);
  assert.equal(textureLimit({ ...desktop, connection: '2g' }), 2048);
  assert.equal(desiredResolution(8192, 3.5), 4096);
  assert.equal(desiredResolution(8192, 2.7), 8192);
  assert.equal(desiredResolution(4096, 1.65), 4096);
});
const now = Date.parse('2026-03-20T12:00:00Z');
const equator = { ...catalog[0], lat: 0, lng: 0, offset: 0, timezone: '' };
const weather = { code: 61, temperature: 18, offset: 0, timezone: 'UTC', fetchedAt: now };

test('catalog: unique IDs, bilingual labels, geographic bounds and valid video IDs', () => {
  assert.equal(new Set(catalog.map(p => p.id)).size, catalog.length);
  for (const p of catalog) {
    assert.ok(p.zh && p.en && /^[A-Z]{2}$/.test(p.country));
    assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90);
    assert.ok(Number.isFinite(p.lng) && Math.abs(p.lng) <= 180);
    assert.ok(Number.isFinite(p.offset) && Math.abs(p.offset) <= 50400);
    assert.ok(p.videoId === null || /^[\w-]{11}$/.test(p.videoId));
    assert.ok(['city', 'wildlife', 'transport'].includes(p.group));
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: p.timezone }));
  }
});
test('all three directories are complete', () => {
  assert.deepEqual(['city', 'wildlife', 'transport'].map(g => catalog.filter(p => p.group === g).length), [129, 86, 59]);
});
test('real-time terminator: subsolar point, antipode, seasons and UTC rotation', () => {
  for (const iso of ['2026-03-20T00:00:00Z', '2026-06-21T12:00:00Z', '2026-12-21T06:00:00Z', '2028-02-29T18:00:00Z']) {
    const time = Date.parse(iso), sun = solarPosition(time);
    assert.ok(Math.abs(solarElevation(sun, time) - 90) < 0.0001);
    assert.ok(Math.abs(solarElevation({ lat: -sun.lat, lng: sun.lng + 180 }, time) + 90) < 0.0001);
    assert.ok(Math.abs(sun.lat) <= 23.5 && Math.abs(sun.lng) <= 180);
  }
  assert.ok(solarPosition(Date.parse('2026-06-21T12:00:00Z')).lat > 23);
  assert.ok(solarPosition(Date.parse('2026-12-21T12:00:00Z')).lat < -23);
  assert.ok(Math.abs(solarPosition(now + 6 * 3600000).lng - solarPosition(now).lng + 90) < 0.2);
  assert.equal(matches({ ...equator, lat: 89 }, 'day', Date.parse('2026-06-21T00:00:00Z')), true);
  assert.equal(matches({ ...equator, lat: 89 }, 'night', Date.parse('2026-12-21T12:00:00Z')), true);
});
test('indoor and seasonal cameras are not mislabeled by daylight', () => {
  assert.equal(matches({ ...equator, indoor: true }, 'day', now), false);
  assert.equal(matches({ ...equator, indoor: true }, 'all', now), true);
  assert.equal(matches({ ...equator, peakMonths: [3] }, 'season', now), true);
  assert.equal(matches({ ...equator, peakMonths: [7] }, 'season', now), false);
});
test('weather codes: sunny, cloudy, fog, snow and rain', () => {
  assert.deepEqual([0, 1, 3, 45, 48, 71, 77, 85, 86, 61, 95].map(weatherGroup), ['clear', 'clear', 'cloud', 'cloud', 'cloud', 'snow', 'snow', 'snow', 'snow', 'rain', 'rain']);
});
test('weather filters never invent offline or stale conditions', () => {
  assert.equal(matches(equator, 'rain', now), false);
  assert.equal(matches(equator, 'rain', now, weather), true);
  assert.equal(matches(equator, 'rain', now + 3600001, weather), false);
  assert.equal(matches(equator, 'clear', now, weather), false);
  assert.equal(matches(equator, 'all', now), true);
});
test('solar position: equinox noon, midnight and dawn', () => {
  assert.ok(solarElevation(equator, now) > 85);
  assert.ok(solarElevation(equator, now - 12 * 3600000) < -85);
  assert.equal(matches(equator, 'night', now - 12 * 3600000), true);
  assert.equal(matches(equator, 'golden', now - 6 * 3600000), true);
});
test('local clocks use IANA timezone across daylight saving', () => {
  const w = { ...weather, timezone: 'America/New_York' };
  assert.equal(localTime(equator, Date.parse('2026-01-15T12:00:00Z'), w), '07:00');
  assert.equal(localTime(equator, Date.parse('2026-07-15T12:00:00Z'), w), '08:00');
  assert.equal(localTime({ ...equator, offset: 20700 }, now), '17:45');
});
test('corrupted timezone falls back without crashing', () => {
  assert.equal(localTime(equator, now, { ...weather, timezone: 'not-a-timezone', offset: NaN }), '12:00');
});
test('blocked storage never breaks browsing', () => {
  assert.deepEqual(readSaved('test-key', []), []);
  assert.doesNotThrow(() => save('test-key', ['x']));
});
console.log(`${checks} map checks passed (${catalog.length} places).`);
