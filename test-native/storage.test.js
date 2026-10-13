import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { PreferenceStore, legacyBackground, readLegacy, databaseName } from '../native/storage.js';
import { defaults } from '../native/model.js';
const requestResult = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const oldValues = {
  engine_option: 2, is_jump_to_new_page: true, search_bar_align_option: 8, search_bar_length_option: 2,
  is_custom_back_img: true, custom_back_img_encode: readFileSync(new URL('../web/favicon.png', import.meta.url)).toString('base64'),
  background_overlay_opacity: 0.32, box_fit_option: 4, unrelated: 'keep',
};
async function seed(idb, values = oldValues) {
  const request = idb.open('shadow._db', 2);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('info');
    const entry = request.result.createObjectStore('entry', { autoIncrement: true });
    entry.createIndex('record', ['store', 'key']); entry.createIndex('deleted', 'deleted', { multiEntry: true });
  };
  const db = await requestResult(request);
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['info', 'entry'], 'readwrite');
    tx.objectStore('info').put({ sembast: 1, version: 1 }, 'meta');
    for (const [key, value] of Object.entries(values)) tx.objectStore('entry').add({ store: 'search_records', key, value });
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function snapshot(idb, name) {
  const db = await requestResult(idb.open(name));
  const result = {};
  for (const key of db.objectStoreNames) result[key] = await requestResult(db.transaction(key).objectStore(key).getAll());
  db.close(); return result;
}
test('fresh initialization does not create a phantom legacy database', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb, extension: true });
  const state = await store.load();
  assert.deepEqual(state.prefs, defaults(true)); assert.equal(state.background, null);
  assert.deepEqual((await idb.databases()).map(db => db.name), [databaseName]); store.close();
});
test('migrates legacy preferences and image once, preserving every old record', async () => {
  const idb = new IDBFactory(); await seed(idb);
  const before = await snapshot(idb, 'shadow._db');
  const store = new PreferenceStore({ idb, extension: true });
  const state = await store.load();
  assert.equal(state.prefs.engine, 'baidu'); assert.equal(state.prefs.newTab, true);
  assert.equal(state.prefs.layout.cx, 1); assert.equal(state.prefs.layout.width, 1000);
  assert.equal(state.prefs.overlay, 0.32); assert.equal(state.background.type, 'image/png');
  assert.deepEqual(await snapshot(idb, 'shadow._db'), before);
  await store.reset(); store.close();
  const reopened = new PreferenceStore({ idb, extension: true });
  const reset = await reopened.load(); assert.deepEqual(reset.prefs, defaults(true)); assert.equal(reset.background, null);
  assert.deepEqual(await snapshot(idb, 'shadow._db'), before); reopened.close();
});
test('malformed legacy images fall back without changing the source', async () => {
  const idb = new IDBFactory(); await seed(idb, { ...oldValues, custom_back_img_encode: 'not base64!' });
  const store = new PreferenceStore({ idb }); const state = await store.load();
  assert.equal(state.background, null); assert.match(state.notice, /旧背景无法读取/);
  assert.equal((await readLegacy(idb)).custom_back_img_encode, 'not base64!'); store.close();
  assert.equal(legacyBackground({ is_custom_back_img: true, custom_back_img_encode: btoa('not an image') }), null);
});
test('failed atomic background transaction leaves both preferences and image intact', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb });
  const state = await store.load(); state.background = new Blob(['previous']); await store.save(state);
  const before = await snapshot(idb, databaseName);
  await assert.rejects(store.save({ prefs: { ...state.prefs, engine: 2 }, background: () => {} }));
  assert.deepEqual(await snapshot(idb, databaseName), before);
  const later = { ...state, prefs: { ...state.prefs, engine: 1 } }; await store.save(later);
  assert.equal((await snapshot(idb, databaseName)).state[0].prefs.engine, 1); store.close();
});
test('aborted writes roll back and a later retry can commit', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb });
  const state = await store.load(); const before = await snapshot(idb, databaseName);
  const transaction = store.db.transaction.bind(store.db);
  store.db.transaction = (...args) => { const tx = transaction(...args); queueMicrotask(() => tx.abort()); return tx; };
  await assert.rejects(store.save({ ...state, prefs: { ...state.prefs, engine: 2 } }));
  store.db.transaction = transaction;
  assert.deepEqual(await snapshot(idb, databaseName), before);
  await store.save({ ...state, prefs: { ...state.prefs, engine: 2 } });
  assert.equal((await snapshot(idb, databaseName)).state[0].prefs.engine, 2); store.close();
});
test('ordered saves keep the final user choice across reload', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb, extension: true }); const state = await store.load();
  await Promise.all([0, 1, 2].map(engine => store.save({ ...state, prefs: { ...state.prefs, engine } })));
  store.close(); const reopened = new PreferenceStore({ idb, extension: true });
  assert.equal((await reopened.load()).prefs.engine, 'baidu'); reopened.close();
});

test('a failed legacy read is observable and never marks migration complete', async () => {
  const idb = new IDBFactory(); await seed(idb);
  const flaky = {
    databases: idb.databases.bind(idb),
    open(name, ...args) {
      if (name !== 'shadow._db') return idb.open(name, ...args);
      const request = {};
      queueMicrotask(() => { request.error = new DOMException('Temporary failure', 'UnknownError'); request.onerror(); });
      return request;
    },
  };
  const failed = new PreferenceStore({ idb: flaky });
  await assert.rejects(failed.load(), /Temporary failure/); failed.close();
  assert.deepEqual((await snapshot(idb, databaseName)).state, []);
  const retry = new PreferenceStore({ idb });
  assert.equal((await retry.load()).prefs.engine, 'baidu'); retry.close();
});
test('without databases enumeration, missing legacy creation is aborted', async () => {
  const idb = new IDBFactory();
  assert.deepEqual(await readLegacy({ open: idb.open.bind(idb) }), {});
  assert.equal((await idb.databases()).some(db => db.name === 'shadow._db'), false);
});
test('v1.2 state upgrades atomically, retains the original snapshot and closes old readers', async () => {
  const idb = new IDBFactory(), request = idb.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('state');
  const old = await requestResult(request), previous = { schema: 2, migrated: true, prefs: { ...defaults(true), engine: 1, theme: 'dark' }, background: new Blob(['old-image']) };
  await new Promise(resolve => { const tx = old.transaction('state', 'readwrite'); tx.objectStore('state').put(previous, 'current'); tx.oncomplete = resolve; });
  let closed = false; old.onversionchange = () => { closed = true; old.close(); };
  const store = new PreferenceStore({ idb, extension: true });
  const upgraded = await store.load(); assert(closed); assert.equal(upgraded.prefs.engine, 'google'); assert.equal(upgraded.prefs.theme, 'dark');
  assert.equal(await upgraded.background.text(), 'old-image'); assert.deepEqual(upgraded.shortcuts, []);
  const backup = await requestResult(store.db.transaction('upgrade-backup').objectStore('upgrade-backup').get('1.2.0'));
  assert.equal(backup.schema, 2); assert.equal(backup.prefs.engine, 1); assert.equal(await backup.background.text(), 'old-image');
  store.close(); await assert.rejects(requestResult(idb.open(databaseName, 1)), error => error.name === 'VersionError');
});
test('links and completed browser import survive reload; reset cannot reimport browser or legacy data', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb }); const state = await store.load();
  const links = [{ id: 'test', title: 'Example', url: 'https://example.com/' }];
  await store.save({ ...state, shortcuts: links, topSitesImported: true }); store.close();
  const reopened = new PreferenceStore({ idb }); assert.deepEqual((await reopened.load()).shortcuts, links);
  await reopened.reset(); reopened.close();
  const reset = new PreferenceStore({ idb }); const value = await reset.load();
  assert(value.topSitesImported); assert.deepEqual(value.shortcuts, []); assert.equal(value.prefs.theme, 'auto'); reset.close();
});
test('failed link import writes neither links nor completion marker', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb }); const state = await store.load();
  const transaction = store.db.transaction.bind(store.db);
  store.db.transaction = (...args) => { const tx = transaction(...args); queueMicrotask(() => tx.abort()); return tx; };
  await assert.rejects(store.save({ ...state, shortcuts: [{ id: 'test', title: 'Test', url: 'https://example.com' }], topSitesImported: true }));
  store.db.transaction = transaction; store.close();
  const reopened = new PreferenceStore({ idb }); const value = await reopened.load();
  assert.equal(value.topSitesImported, false); assert.deepEqual(value.shortcuts, []); reopened.close();
});
test('a stale tab changing appearance cannot overwrite imported links, background or marker', async () => {
  const idb = new IDBFactory(), first = new PreferenceStore({ idb }), second = new PreferenceStore({ idb });
  const a = await first.load(), b = await second.load();
  const links = [{ id: 'shared', title: 'Shared', url: 'https://example.com/' }];
  await first.save({ ...a, shortcuts: links, topSitesImported: true, background: new Blob(['image']) }, { shortcuts: true, background: true });
  const saved = await second.save({ ...b, prefs: { ...b.prefs, theme: 'dark' } }, { prefs: ['theme'] });
  assert.equal(saved.prefs.theme, 'dark'); assert(saved.topSitesImported); assert.deepEqual(saved.shortcuts, links); assert.equal(await saved.background.text(), 'image');
  const current = await first.refresh(); assert.equal(current.prefs.theme, 'dark'); assert(current.topSitesImported);
  await second.reset(); assert((await first.refresh()).topSitesImported); first.close(); second.close();
});
test('selecting an engine deleted by another tab falls back without creating invalid preferences', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb }); const state = await store.load();
  const engine = { id: 'custom-test', name: 'Test', template: 'https://example.test/?q=%s' };
  await store.save({ ...state, prefs: { ...state.prefs, customEngines: [engine] } }, { prefs: ['customEngines'] });
  const stale = await store.refresh();
  await store.save({ ...state, prefs: { ...state.prefs, customEngines: [] } }, { prefs: ['customEngines'] });
  const selected = await store.save({ ...stale, prefs: { ...stale.prefs, engine: engine.id } }, { prefs: ['engine'] });
  assert.equal(selected.prefs.engine, 'bing'); assert.deepEqual(selected.prefs.customEngines, []); store.close();
});
test('original backgrounds beyond previous upload and read limits survive save, refresh and reload byte-for-byte', async () => {
  const idb = new IDBFactory(), store = new PreferenceStore({ idb }); const state = await store.load();
  const bytes = new Uint8Array(33 * 1024 * 1024); bytes.fill(137); bytes[bytes.length - 1] = 42;
  const original = new Blob([bytes], { type: 'image/png' });
  const digest = value => createHash('sha256').update(value).digest('hex');
  const expected = digest(bytes);
  await store.save({ ...state, background: original }, { background: true });
  assert.equal((await store.refresh()).background.size, original.size); store.close();
  const reopened = new PreferenceStore({ idb }); const loaded = await reopened.load();
  assert.equal(loaded.background.type, 'image/png'); assert.equal(loaded.background.size, original.size);
  assert.equal(digest(new Uint8Array(await loaded.background.arrayBuffer())), expected); reopened.close();
});
