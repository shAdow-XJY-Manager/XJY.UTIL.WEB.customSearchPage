import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.equal(state.prefs.engine, 2); assert.equal(state.prefs.newTab, true);
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
  assert.equal((await reopened.load()).prefs.engine, 2); reopened.close();
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
  assert.equal((await retry.load()).prefs.engine, 2); retry.close();
});
test('without databases enumeration, missing legacy creation is aborted', async () => {
  const idb = new IDBFactory();
  assert.deepEqual(await readLegacy({ open: idb.open.bind(idb) }), {});
  assert.equal((await idb.databases()).some(db => db.name === 'shadow._db'), false);
});
