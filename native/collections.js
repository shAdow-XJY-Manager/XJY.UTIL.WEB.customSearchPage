import { t, setMessage, number, hasTranslation } from './i18n.js';
import { customEngine } from './engines.js';
import { shortcut, mergeTopSites, moveShortcut } from './shortcuts.js';
import { faviconUrl, importTopSites } from './browser.js';
import globe from './icons/globe.svg';
const $ = id => document.getElementById(id);
const makeId = () => crypto.randomUUID();
export function setupCollections({ getState, commit, extension, closeMenus, status }) {
  let editing = null, returnFocus = null, dragged = null, busy = false, importing = false;
  const dialog = $('item-dialog'), grid = $('shortcuts');
  function dialogStatus(text) { setMessage($('item-status'), text); $('item-status').dataset.error = 'true'; }
  function open(kind, item = null, trigger = document.activeElement) {
    if (busy) return;
    closeMenus(); returnFocus = trigger; editing = { kind, id: item?.id || null };
    const engine = kind === 'engine';
    $('item-title').textContent = t(engine ? item ? '编辑搜索引擎' : '添加搜索引擎' : item ? '编辑快捷链接' : '添加快捷链接');
    $('item-name').value = item?.[engine ? 'name' : 'title'] || ''; $('item-name').maxLength = engine ? 40 : 60; $('item-name').required = engine;
    $('item-name').dir = $('item-name').value ? 'auto' : document.documentElement.dir;
    $('item-url').value = item?.[engine ? 'template' : 'url'] || '';
    $('item-url-label').textContent = t(engine ? '搜索网址' : '网址');
    $('item-url').placeholder = engine ? 'https://example.com/search?q=%s' : 'https://example.com';
    $('item-hint').textContent = t(engine ? '用 %s 或 {query} 代替搜索词，例如 https://example.com/search?q=%s。' : '可省略 https://。留空名称时使用网站域名。');
    $('delete-item').hidden = !item; $('item-order').hidden = engine || !item;
    if (!engine && item) {
      const index = getState().shortcuts.findIndex(link => link.id === item.id);
      $('move-earlier').disabled = index <= 0; $('move-later').disabled = index === getState().shortcuts.length - 1;
    }
    dialogStatus(''); dialog.showModal(); $('item-name').focus();
  }
  function close() {
    if (busy) return;
    const current = editing?.kind === 'engine' ? $('custom-engines').querySelector(`[data-engine="${editing.id}"]`) : grid.querySelector(`[data-id="${editing?.id}"] .shortcut-more`);
    const fallback = editing?.kind === 'engine' ? $('add-engine') : $('settings').hidden ? $('add-shortcut') : $('add-shortcut-settings');
    dialog.close(); editing = null;
    (returnFocus?.isConnected ? returnFocus : current || fallback)?.focus({ preventScroll: true });
  }
  async function savePatch(patch, message) {
    busy = true; $('item-form').inert = true;
    try {
      if (await commit(patch, message)) { busy = false; close(); return true; }
      dialogStatus('未保存，已保留原数据。请重试。'); return false;
    } finally { busy = false; $('item-form').inert = false; }
  }
  $('item-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!editing || busy) return;
    const state = getState(), { kind, id } = editing;
    try {
      if (kind === 'engine') {
        const item = customEngine({ name: $('item-name').value, template: $('item-url').value }, id || `custom-${makeId()}`);
        const list = state.prefs.customEngines;
        if (!id && list.length >= 100) throw new Error('最多保存 100 个自定义引擎。');
        await savePatch({ prefs: { ...state.prefs, customEngines: id ? list.map(e => e.id === id ? item : e) : [...list, item] } }, '搜索引擎已保存。');
      } else {
        const item = shortcut({ title: $('item-name').value, url: $('item-url').value }, id || makeId());
        if (!id && state.shortcuts.length >= 100) throw new Error('最多保存 100 个快捷链接。');
        await savePatch({ shortcuts: id ? state.shortcuts.map(e => e.id === id ? item : e) : [...state.shortcuts, item] }, '快捷链接已保存。');
      }
    } catch (error) { dialogStatus(error instanceof TypeError ? '网址格式不正确，请检查。' : error.message); }
  });
  $('delete-item').addEventListener('click', async () => {
    if (!editing?.id || busy) return;
    const state = getState(), { kind, id } = editing;
    const patch = kind === 'engine' ? { prefs: { ...state.prefs, customEngines: state.prefs.customEngines.filter(e => e.id !== id),
      engine: state.prefs.engine === id ? 'bing' : state.prefs.engine } } : { shortcuts: state.shortcuts.filter(e => e.id !== id) };
    await savePatch(patch, '已删除。');
  });
  for (const [id, direction] of [['move-earlier', -1], ['move-later', 1]]) $(id).addEventListener('click', async () => {
    if (!editing?.id || busy) return;
    const state = getState(), index = state.shortcuts.findIndex(e => e.id === editing.id);
    await savePatch({ shortcuts: moveShortcut(state.shortcuts, editing.id, index + direction) }, '链接顺序已保存。');
  });
  $('cancel-item').addEventListener('click', close); $('close-item').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  $('add-engine').addEventListener('click', () => open('engine'));
  $('add-shortcut-settings').addEventListener('click', () => open('shortcut'));
  $('show-add-shortcut').addEventListener('change', event => { void commit({ prefs: { ...getState().prefs, showAddShortcut: event.target.checked } }, '已保存。'); });
  $('show-shortcuts').addEventListener('change', event => { void commit({ prefs: { ...getState().prefs, showShortcuts: event.target.checked } }, '已保存。'); });
  $('import-sites').addEventListener('click', async () => {
    if (importing || getState().topSitesImported) return;
    // Request before awaiting storage or any other work to retain the user gesture.
    const request = importTopSites(); importing = true; render(); status('等待浏览器授权…');
    try {
      const sites = await request, state = getState();
      const shortcuts = mergeTopSites(state.shortcuts, sites, makeId);
      const added = shortcuts.length - state.shortcuts.length;
      if (!added) { status('没有可导入的新网站，可以手动添加。'); return; }
      await commit({ shortcuts, topSitesImported: true, prefs: { ...state.prefs, showShortcuts: true } }, '已导入 {count} 个常用网站，之后可在本页独立编辑。', { count: number(added) });
    } catch (error) { status(hasTranslation(error.message) ? error.message : '导入失败，请稍后重试。', true); }
    finally { importing = false; render(); }
  });
  function render() {
    if (editing) {
      const engine = editing.kind === 'engine';
      $('item-title').textContent = t(engine ? editing.id ? '编辑搜索引擎' : '添加搜索引擎' : editing.id ? '编辑快捷链接' : '添加快捷链接');
      $('item-url-label').textContent = t(engine ? '搜索网址' : '网址');
      $('item-hint').textContent = t(engine ? '用 %s 或 {query} 代替搜索词，例如 https://example.com/search?q=%s。' : '可省略 https://。留空名称时使用网站域名。');
    }
    const state = getState(); $('show-shortcuts').checked = state.prefs.showShortcuts; $('show-add-shortcut').checked = state.prefs.showAddShortcut;
    $('reset-all').disabled = importing || $('choose-background').disabled;
    $('import-sites').disabled = !extension || state.topSitesImported || importing;
    $('import-sites').textContent = t(importing ? '导入中…' : state.topSitesImported ? '已完成一次性导入' : '导入浏览器常用网站');
    $('import-hint').textContent = t(extension ? '读取授权后仅导入一次，不包含手动固定的原生链接。导入后独立编辑，不改变浏览器数据；读取完成即撤回常用网站权限。' : '网站版无法读取浏览器常用网站，可手动添加；一次性导入需在扩展中使用。');
    const custom = $('custom-engines'); custom.replaceChildren();
    for (const engine of state.prefs.customEngines) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'custom-engine';
      button.dataset.engine = engine.id;
      button.textContent = engine.name; button.setAttribute('aria-label', t('编辑搜索引擎 {name}', { name: engine.name }));
      button.addEventListener('click', () => open('engine', engine, button)); custom.append(button);
    }
    grid.replaceChildren(); grid.hidden = !state.prefs.showShortcuts;
    for (const item of state.shortcuts) {
      const tile = document.createElement('div'); tile.className = 'shortcut'; tile.draggable = true; tile.dataset.id = item.id;
      const link = document.createElement('a'); link.href = item.url; link.title = `${item.title}\n${item.url}`; link.draggable = false;
      const circle = document.createElement('span'); circle.className = 'shortcut-icon';
      const icon = document.createElement('img'); icon.alt = ''; icon.width = icon.height = 24; icon.src = faviconUrl(item.url) || globe;
      if (!faviconUrl(item.url)) icon.className = 'system-icon';
      icon.addEventListener('error', () => { if (icon.src !== new URL(globe, location.href).href) { icon.className = 'system-icon'; icon.src = globe; } }, { once: true });
      const title = document.createElement('span'); title.className = 'shortcut-title'; title.textContent = item.title; title.dir = 'auto';
      circle.append(icon); link.append(circle, title);
      const more = document.createElement('button'); more.type = 'button'; more.className = 'icon-button shortcut-more'; more.setAttribute('aria-label', t('编辑快捷链接 {name}', { name: item.title }));
      const glyph = document.createElement('span'); glyph.className = 'icon icon-more'; glyph.setAttribute('aria-hidden', 'true'); more.append(glyph);
      more.addEventListener('click', () => open('shortcut', item, more));
      tile.addEventListener('contextmenu', event => { event.preventDefault(); open('shortcut', item, link); });
      link.addEventListener('keydown', async event => {
        if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const items = getState().shortcuts, index = items.findIndex(e => e.id === item.id);
        const direction = (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) * (document.documentElement.dir === 'rtl' && ['ArrowLeft', 'ArrowRight'].includes(event.key) ? -1 : 1);
        if (await commit({ shortcuts: moveShortcut(items, item.id, index + direction) }, '链接顺序已保存。')) grid.querySelector(`[data-id="${item.id}"] a`)?.focus();
      });
      tile.addEventListener('dragstart', event => { if (document.body.classList.contains('editing')) { event.preventDefault(); return; } dragged = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); tile.classList.add('dragging'); });
      tile.addEventListener('dragend', () => { dragged = null; tile.classList.remove('dragging'); grid.querySelectorAll('.drop-target').forEach(e => e.classList.remove('drop-target')); });
      tile.addEventListener('dragover', event => { if (!dragged || dragged === item.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; tile.classList.add('drop-target'); });
      tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
      tile.addEventListener('drop', event => { if (!dragged) return; event.preventDefault(); const items = getState().shortcuts; void commit({ shortcuts: moveShortcut(items, dragged, items.findIndex(e => e.id === item.id)) }, '链接顺序已保存。'); dragged = null; });
      tile.append(link, more); grid.append(tile);
    }
    const add = document.createElement('button'); add.id = 'add-shortcut'; add.className = 'shortcut-add'; add.type = 'button';
    const circle = document.createElement('span'); circle.className = 'shortcut-icon';
    const plus = document.createElement('span'); plus.className = 'icon icon-add'; plus.setAttribute('aria-hidden', 'true'); circle.append(plus);
    const label = document.createElement('span'); label.className = 'shortcut-title'; label.textContent = t('添加快捷链接');
    add.append(circle, label); add.addEventListener('click', () => open('shortcut', null, add)); if (state.prefs.showAddShortcut) grid.append(add);
  }
  return { render, get modalOpen() { return dialog.open; }, get importing() { return importing; } };
}
