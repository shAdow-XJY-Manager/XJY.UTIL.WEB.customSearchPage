import { defaults, migratePrefs, normalizePrefs } from './model.js';
import { normalizeShortcuts } from './shortcuts.js';
export const databaseName = 'frequency_search_v2';
const legacyDatabase = 'shadow._db';
const requestValue = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export function legacyBackground(legacy) {
  if (legacy.is_custom_back_img !== true) return null;
  const text = legacy.custom_back_img_encode;
  if (typeof text !== 'string' || !text) return null;
  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    let type;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) type = 'image/jpeg';
    else if (bytes[0] === 137 && binary.slice(1, 4) === 'PNG') type = 'image/png';
    else if (binary.startsWith('GIF8')) type = 'image/gif';
    else if (binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP') type = 'image/webp';
    return type ? new Blob([bytes], { type }) : null;
  } catch { return null; }
}
export async function readLegacy(idb, name = legacyDatabase) {
  if (idb.databases && !(await idb.databases()).some(db => db.name === name)) return {};
  const request = idb.open(name);
  // An absent legacy database must never be created or upgraded by this reader.
  let absent = false;
  request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
  let db;
  try { db = await requestValue(request); } catch (error) { if (absent) return {}; throw error; }
  try {
    if (!db.objectStoreNames.contains('entry')) return {};
    const rows = await requestValue(db.transaction('entry', 'readonly').objectStore('entry').getAll());
    const values = {};
    for (const row of rows) {
      if (row.store !== 'search_records' || typeof row.key !== 'string') continue;
      if (row.deleted === 1 || row.deleted === true) delete values[row.key];
      else values[row.key] = row.value;
    }
    return values;
  } finally { db.close(); }
}
export class PreferenceStore {
  constructor({ idb = globalThis.indexedDB, name = databaseName, legacyName = legacyDatabase, extension = false } = {}) {
    this.idb = idb; this.name = name; this.legacyName = legacyName; this.extension = extension;
    this.db = null; this.ready = false; this.queue = Promise.resolve();
  }
  async open() {
    if (!this.idb) throw new Error('浏览器存储不可用。');
    // Close v1 readers before upgrading, preventing old tabs from overwriting new fields.
    const request = this.idb.open(this.name, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state');
      if (!request.result.objectStoreNames.contains('upgrade-backup')) request.result.createObjectStore('upgrade-backup');
    };
    this.db = await new Promise((resolve, reject) => {
      let abandoned = false;
      const timer = setTimeout(() => { abandoned = true; reject(new Error('浏览器存储暂时被占用。')); }, 1500);
      request.onsuccess = () => { clearTimeout(timer); if (abandoned) request.result.close(); else resolve(request.result); };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onblocked = () => { abandoned = true; clearTimeout(timer); reject(new Error('请关闭旧页面后重试。')); };
    });
    this.db.onversionchange = () => { this.db.close(); this.ready = false; };
  }
  async load() {
    await this.open();
    const record = await requestValue(this.db.transaction('state').objectStore('state').get('current'));
    let state;
    if (record?.schema > 3) throw new Error('此数据由更新版本保存，请更新扩展后再打开。');
    if ([2, 3].includes(record?.schema) && record.migrated === true) {
      state = { prefs: normalizePrefs(record.prefs, this.extension),
        background: record.background instanceof Blob ? record.background : null,
        shortcuts: normalizeShortcuts(record.shortcuts), topSitesImported: record.topSitesImported === true,
        backgroundRevision: record.background ? record.backgroundRevision || 'legacy' : null };
      if (record.schema === 2) await this.write(state, record);
    } else {
      const legacy = await readLegacy(this.idb, this.legacyName);
      state = { prefs: migratePrefs(legacy, this.extension), background: legacyBackground(legacy), shortcuts: [], topSitesImported: false };
      Object.assign(state, await this.write(state));
      if (legacy.is_custom_back_img === true && !state.background) state.notice = '旧背景无法读取，已使用纯色背景。';
    }
    this.ready = true;
    this.topSitesImported = state.topSitesImported;
    return state;
  }
  write(state, previous = null, fields = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(previous ? ['state', 'upgrade-backup'] : 'state', 'readwrite');
      let saved;
      tx.oncomplete = () => resolve(saved);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('设置未保存。'));
      const records = tx.objectStore('state'), request = records.get('current');
      request.onsuccess = () => {
        const current = request.result;
        if (current?.schema > 3) { tx.abort(); return; }
        let prefs = state.prefs;
        if (fields && !fields.reset) {
          prefs = { ...normalizePrefs(current?.prefs, this.extension) };
          for (const key of fields.prefs || []) if (Object.hasOwn(defaults(this.extension), key)) prefs[key] = state.prefs[key];
        }
        if (fields) prefs = normalizePrefs(prefs, this.extension);
        saved = { prefs,
          background: !fields || fields.reset || fields.background ? state.background : current?.background || null,
          shortcuts: !fields || fields.reset || fields.shortcuts ? state.shortcuts || [] : normalizeShortcuts(current?.shortcuts),
          // A stale tab or reset must never clear a successful one-time import.
          topSitesImported: state.topSitesImported === true || current?.topSitesImported === true };
        saved.backgroundRevision = !saved.background ? null : !fields || fields.background || fields.reset ?
          `${Date.now()}-${Math.random().toString(36).slice(2)}` : current?.backgroundRevision || 'legacy';
        records.put({ schema: 3, migrated: true, ...saved }, 'current');
        if (previous) tx.objectStore('upgrade-backup').put(previous, '1.2.0');
      };
    });
  }
  async save(state, fields = null) {
    if (!this.ready) return Promise.reject(new Error('设置未保存，仅在当前页面生效。重新加载后可重试。'));
    const snapshot = structuredClone(state);
    const changes = fields ? structuredClone(fields) : null;
    this.queue = this.queue.catch(() => {}).then(() => this.write(snapshot, null, changes));
    this.queue.then(saved => { this.topSitesImported = saved.topSitesImported; }, () => {});
    return this.queue;
  }
  reset() { return this.save({ prefs: defaults(this.extension), background: null, shortcuts: [], topSitesImported: this.topSitesImported === true }, { reset: true }); }
  async refresh() {
    await this.queue.catch(() => {});
    if (!this.ready) throw new Error('浏览器存储不可用。');
    const record = await requestValue(this.db.transaction('state').objectStore('state').get('current'));
    if (record?.schema !== 3) throw new Error('请重新加载页面。');
    return { prefs: normalizePrefs(record.prefs, this.extension), background: record.background || null,
      shortcuts: normalizeShortcuts(record.shortcuts), topSitesImported: record.topSitesImported === true,
      backgroundRevision: record.background ? record.backgroundRevision || 'legacy' : null };
  }
  close() { this.db?.close(); this.ready = false; }
}
