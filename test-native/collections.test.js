import test from 'node:test';
import assert from 'node:assert/strict';
import { engines, customEngine, normalizeEngines, searchUrl } from '../native/engines.js';
import { normalizePrefs } from '../native/model.js';
import { shortcut, siteUrl, normalizeShortcuts, mergeTopSites, moveShortcut } from '../native/shortcuts.js';
import { importTopSites, faviconUrl } from '../native/browser.js';
import { sceneRects } from '../native/layout.js';

test('all 35 built-in routes encode search words once, without tracking parameters', () => {
  assert.equal(engines.length, 35); assert.equal(new Set(engines.map(e => e.id)).size, engines.length);
  const query = '中文🙂 & + # % / ?';
  for (const engine of engines) {
    const url = new URL(searchUrl(engine.id, query));
    assert.equal(url.protocol, 'https:'); assert.equal(url.hash, '');
    assert([...url.searchParams.values()].includes(query), engine.id);
    assert(!/utm_|partner|campid|sourceid/.test(url.href));
  }
});
test('custom engines survive normalization, including query parameters and path templates', () => {
  const engine = customEngine({ name: ' 自定义 ', template: 'https://example.com/find/%s?mode=web' }, 'custom-test');
  assert.equal(engine.name, '自定义'); assert.equal(searchUrl(engine.id, '中 &/#%', [engine]), 'https://example.com/find/%E4%B8%AD%20%26%2F%23%25?mode=web');
  const p = normalizePrefs({ engine: engine.id, customEngines: [engine, engine, {}] });
  assert.equal(p.engine, engine.id); assert.equal(p.customEngines.length, 1);
  assert.equal(normalizePrefs({ engine: engine.id, customEngines: [] }).engine, 'bing');
  assert.equal(normalizePrefs({ engine: 2 }).engine, 'baidu');
});
test('unsafe, ambiguous and malformed custom templates are rejected', () => {
  for (const template of ['javascript:alert({query})', 'data:text/plain,{query}', 'file:///{query}',
    'https://{query}.com/', 'https://user:pass@example.com/?q={query}', 'https://example.com/?q=%s&other=%s', 'https://example.com/', 'https://example.com/?q={unknown}&a={query}']) {
    assert.throws(() => customEngine({ name: 'test', template }, 'custom-safe'), template);
  }
  assert.deepEqual(normalizeEngines([null, {}, { id: 'bing', name: 'x', template: 'https://x.test/?q=%s' }]), []);
});
test('shortcut addresses are safe, normalized and preserve user text', () => {
  assert.equal(siteUrl('example.com/path'), 'https://example.com/path');
  assert.equal(siteUrl('localhost:8080/path'), 'https://localhost:8080/path');
  assert.equal(shortcut({ url: 'example.com', title: '' }, 'test').title, 'example.com');
  assert.equal(shortcut({ url: 'https://example.com', title: '<b>中文</b>' }, 'test').title, '<b>中文</b>');
  for (const url of ['javascript:alert(1)', 'file:///tmp/x', 'data:text/html,x', 'https://u:p@example.com', 'chrome://settings']) assert.throws(() => siteUrl(url));
  assert.deepEqual(normalizeShortcuts([{}, null]), []);
});
test('one-time import merges valid sites, deduplicates addresses and ignores browser-internal URLs', () => {
  const existing = [shortcut({ title: 'Existing', url: 'https://example.com' }, 'old')]; let id = 0;
  const merged = mergeTopSites(existing, [{ title: 'Duplicate', url: 'https://example.com/' }, { title: 'x'.repeat(200), url: 'https://other.test' }, { url: 'chrome://newtab' }], () => `new-${++id}`);
  assert.equal(merged.length, 2); assert.equal(merged[0], existing[0]); assert.equal(merged[1].title.length, 60);
  assert.equal(existing.length, 1);
  assert.deepEqual(moveShortcut(merged, merged[1].id, 0).map(e => e.id), [merged[1].id, 'old']);
});
test('import reads once after user permission, then removes permission even on failure', async () => {
  const calls = [], api = { runtime: { id: 'test' }, permissions: {
    request: async arg => { calls.push(['request', arg]); return true; },
    remove: async arg => { calls.push(['remove', arg]); return true; },
  }, topSites: { get: async () => { calls.push(['get']); return [{ title: 'Test', url: 'https://example.com' }]; } } };
  assert.equal((await importTopSites(api)).length, 1); assert.deepEqual(calls.map(e => e[0]), ['request', 'get', 'remove']);
  api.topSites.get = async () => { throw new Error('read failed'); }; await assert.rejects(importTopSites(api), /read failed/); assert.equal(calls.at(-1)[0], 'remove');
  api.permissions.request = async () => false; await assert.rejects(importTopSites(api), /未获得读取授权/);
  await assert.rejects(importTopSites({}), /网站版/);
});
test('favicon URLs are browser-local and website fallback has no remote request', () => {
  assert.equal(faviconUrl('https://example.com', {}), null);
  const url = new URL(faviconUrl('https://example.com/?a=1&b=2', { runtime: { id: 'test', getURL: path => `chrome-extension://test${path}` } }));
  assert.equal(url.protocol, 'chrome-extension:'); assert.equal(url.searchParams.get('pageUrl'), 'https://example.com/?a=1&b=2');
});
test('shortcut rows fit below search at viewport edges and do not mutate the saved layout', () => {
  const saved = { cx: 1, cy: 1, width: 1000, height: 1000 }, before = { ...saved };
  for (const [width, height, font] of [[1280, 900, 16], [320, 640, 32], [200, 100, 32]]) {
    const { search, links } = sceneRects(saved, { width, height }, font, 25);
    assert(search.x >= 0 && search.y >= 0); assert(search.x + search.width <= width);
    // On a physically tiny viewport, links may have zero visible height.
    if (height >= 600) assert(links.y + links.height <= height);
  }
  assert.deepEqual(saved, before);
});
