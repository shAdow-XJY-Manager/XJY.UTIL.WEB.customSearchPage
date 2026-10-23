import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { PreferenceStore } from '../native/storage.js';
import { defaults } from '../native/model.js';
import { languages, setLanguage, translate } from '../native/i18n.js';
import { resetPrompt, resetWithConfirmation } from '../native/reset.js';

async function personalized() {
  const store = new PreferenceStore({ idb: new IDBFactory(), extension: true });
  const initial = await store.load();
  await store.save({ ...initial, prefs: { ...initial.prefs, theme: 'dark', language: 'fr',
    customEngines: [{ id: 'custom-demo', name: 'Example', template: 'https://example.com/?q=%s' }] },
    background: new Blob(['original picture'], { type: 'image/png' }),
    shortcuts: [{ id: 'demo', title: 'Example', url: 'https://example.com/' }], topSitesImported: true });
  return { state: await store.refresh(), store, extension: true };
}

test('cancel reset performs zero writes and preserves all saved data', async () => {
  const context = await personalized();
  const original = structuredClone(context.state);
  let writes = 0;
  const save = context.store.save.bind(context.store);
  context.store.save = (...args) => { writes++; return save(...args); };
  const result = await resetWithConfirmation({ ...context, confirm: () => false });
  assert.equal(result, null); assert.equal(writes, 0);
  const persisted = await context.store.refresh();
  assert.deepEqual(persisted.prefs, original.prefs);
  assert.deepEqual(persisted.shortcuts, original.shortcuts);
  assert.equal(await persisted.background.text(), 'original picture');
  assert.equal(persisted.topSitesImported, true);
  assert.deepEqual(context.state.prefs, original.prefs);
  context.store.close();
});

test('confirmed reset clears the stated fields and retains import safety marker', async () => {
  const context = await personalized();
  const result = await resetWithConfirmation({ ...context, confirm: () => true });
  assert.deepEqual(result.prefs, defaults(true));
  assert.equal(result.background, null); assert.deepEqual(result.shortcuts, []);
  assert.equal(result.topSitesImported, true);
  assert.deepEqual(await context.store.refresh(), result);
  context.store.close();
});

test('failed reset transaction leaves previous data intact', async () => {
  const context = await personalized();
  const transaction = context.store.db.transaction.bind(context.store.db);
  context.store.db.transaction = (...args) => { const tx = transaction(...args); queueMicrotask(() => tx.abort()); return tx; };
  await assert.rejects(resetWithConfirmation({ ...context, confirm: () => true }));
  context.store.db.transaction = transaction;
  const persisted = await context.store.refresh();
  assert.deepEqual(persisted.prefs, context.state.prefs);
  assert.deepEqual(persisted.shortcuts, context.state.shortcuts);
  assert.equal(await persisted.background.text(), 'original picture');
  context.store.close();
});

test('confirmation uses every supported locale before any state mutation', async () => {
  for (const [language] of languages) {
    setLanguage(language);
    let shown;
    await resetWithConfirmation({ state: {}, store: { ready: false }, extension: false, confirm: text => { shown = text; return false; } });
    assert.equal(shown, translate(resetPrompt, language));
    if (language !== 'zh-CN') assert.notEqual(shown, resetPrompt);
  }
  setLanguage('zh-CN');
});
