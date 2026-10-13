import { languages, setLanguage, applyLanguage, applyInputDirection, t, setMessage, engineLabel, number, percent } from './i18n.js';
import { defaults, defaultLayout, colorKeys, argbCss, rgbHex, replaceRgb, searchUrl } from './model.js';
import { sceneRects, rectLayout, moveRect, resizeRect } from './layout.js';
import { PreferenceStore } from './storage.js';
import { processBackground, fileSize, backgroundSaveError } from './background.js';
import { setupSettingsTabs } from './settings.js';
import { createAppearance } from './appearance.js';
import { engineById } from './engines.js';
import { createPicker } from './picker.js';
import { setupCollections } from './collections.js';
import { paintIcon } from './engine-icons.js';

const $ = id => document.getElementById(id);
const extension = location.protocol === 'chrome-extension:';
const store = new PreferenceStore({ extension });
let state = { prefs: defaults(extension), background: null, shortcuts: [], topSitesImported: false };
let draft = null, pointer = null, composition = false, backgroundUrl = null, renderedBackground = null;
let frame = 0, busyBackground = false, savingLayout = false;
let preferenceRevision = 0;
const query = $('query'), shell = $('search-shell'), drawer = $('settings');
setupSettingsTabs(drawer);
for (const [code, label] of languages) { const option = new Option(label, code); option.lang = code; $('language').append(option); }
const appearance = createAppearance({ image: $('background'), button: $('settings-button'), getPrefs: () => state.prefs });
const view = () => ({ width: window.innerWidth, height: window.innerHeight });
const fontSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const geometry = () => sceneRects(draft || state.prefs.layout, view(), fontSize(), state.prefs.showShortcuts ? state.shortcuts.length + (state.prefs.showAddShortcut ? 1 : 0) : 0);
const currentRect = () => geometry().search;
const searchView = () => geometry().searchView;
const picker = createPicker({ getPrefs: () => state.prefs, paintIcon, query, canOpen: () => !draft,
  select: id => { state.prefs.engine = id; render(); void persistPreferences(['engine']); } });
const collections = setupCollections({ getState: () => state, extension, closeMenus: () => picker.close(), status: setStatus,
  commit: async (patch, message, params = {}) => {
    const next = { ...state, ...patch };
    const fields = { shortcuts: Object.hasOwn(patch, 'shortcuts'), prefs: patch.prefs ? Object.keys(patch.prefs).filter(key => JSON.stringify(patch.prefs[key]) !== JSON.stringify(state.prefs[key])) : [] };
    try { state = await store.save(next, fields); render(); setStatus(message, false, false, params); return true; }
    catch { render(); setStatus('未保存，已保留原数据。请重试。', true); return false; }
  } });
function setStatus(text, error = false, edit = false, params = {}) {
  const target = $(edit ? 'edit-status' : 'settings-status');
  setMessage(target, text, params); target.dataset.error = String(error);
  if (text && error && !edit && !drawer.hidden) target.scrollIntoView({ block: 'nearest' });
}
function renderLayout() {
  const rect = currentRect();
  shell.style.left = '0'; shell.style.top = '0';
  shell.style.transform = `translate3d(${rect.x}px,${rect.y}px,0)`;
  shell.style.width = `${rect.width}px`; shell.style.height = `${rect.height}px`;
  const links = geometry().links, grid = $('shortcuts');
  grid.hidden = !links;
  if (links) {
    grid.style.transform = `translate3d(${links.x}px,${links.y}px,0)`;
    grid.style.width = `${links.width}px`; grid.style.maxHeight = `${links.height}px`;
    grid.style.setProperty('--columns', links.columns); grid.style.setProperty('--tile-height', `${links.tile}px`);
  }
  if (picker.opened) picker.position();
}
function scheduleLayout() {
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderLayout(); });
}
function render() {
  const p = state.prefs;
  setLanguage(p.language); applyLanguage(); $('language').value = p.language;
  document.documentElement.dataset.theme = p.theme;
  const properties = { page: '--custom-page', settings: '--custom-settings', submit: '--custom-submit',
    text: '--custom-text', border: '--custom-border', field: '--custom-field' };
  for (const key of colorKeys) {
    if (p.customColor) document.documentElement.style.setProperty(properties[key], argbCss(p.colors[key]));
    else document.documentElement.style.removeProperty(properties[key]);
    $(`color-${key}`).value = rgbHex(p.colors[key]);
    $(`color-${key}`).disabled = !p.customColor;
  }
  paintIcon($('engine-icon'), p.engine);
  $('engine-button').setAttribute('aria-label', t('切换搜索引擎，当前 {name}', { name: engineLabel(engineById(p.engine, p.customEngines)) }));
  picker.render(); collections.render();
  $('new-tab').checked = p.newTab; $('theme').value = p.theme;
  $('image-theme').checked = p.imageTheme;
  $('background-fit').value = String(p.fit); $('overlay').value = String(Math.round(p.overlay * 100));
  $('overlay-value').value = percent(p.overlay); $('custom-color').checked = p.customColor;
  const backgroundRevision = state.background ? state.backgroundRevision || state.background : null;
  if (renderedBackground !== backgroundRevision) {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    renderedBackground = backgroundRevision;
    backgroundUrl = state.background ? URL.createObjectURL(state.background) : null;
    if (backgroundUrl) $('background').src = backgroundUrl;
    else $('background').removeAttribute('src');
  }
  const img = $('background');
  img.hidden = !backgroundUrl; $('shade').hidden = !backgroundUrl;
  img.className = p.fit === 5 ? 'fit-width' : p.fit === 6 ? 'fit-height' : '';
  img.style.objectFit = ['none', 'fill', 'scale-down', 'cover', 'contain'][p.fit] || 'contain';
  $('shade').style.opacity = String(p.overlay);
  $('background-fit').disabled = !state.background;
  $('overlay').disabled = !state.background;
  $('clear-background').disabled = !state.background || busyBackground;
  renderBackgroundCard();
  appearance.update();
  renderLayout();
}
function renderBackgroundCard() {
  const file = state.background, image = $('background'), preview = $('background-preview');
  preview.hidden = !file; $('background-placeholder').hidden = Boolean(file);
  if (backgroundUrl && preview.getAttribute('src') !== backgroundUrl) preview.src = backgroundUrl;
  if (!backgroundUrl) preview.removeAttribute('src');
  const name = file?.name || t(file ? '当前背景' : '纯色背景');
  $('background-name').textContent = name; $('background-name').title = name;
  const format = file?.type?.split('/')[1]?.toUpperCase().replace('SVG+XML', 'SVG') || t('图片');
  const dimensions = file && image.complete && image.naturalWidth && image.currentSrc === backgroundUrl ? `${number(image.naturalWidth)} × ${number(image.naturalHeight)}` : '';
  $('background-meta').textContent = file ? [format, dimensions, fileSize(file.size)].filter(Boolean).join(' · ') : t('跟随当前主题');
  $('choose-background').textContent = t(busyBackground ? '读取中…' : file ? '更换图片' : '选择图片');
}
async function persistPreferences(keys) {
  const revision = ++preferenceRevision;
  try { const saved = await store.save(state, { prefs: keys }); if (revision === preferenceRevision) { state = saved; render(); } setStatus('已保存。'); }
  catch { setStatus('设置未保存，仅在当前页面生效。重新加载后可重试。', true); }
}
function openSettings() {
  if (draft) return;
  picker.close(); drawer.hidden = false; $('drawer-backdrop').hidden = false;
  $('settings-button').setAttribute('aria-expanded', 'true'); $('scene').inert = true;
  $('close-settings').focus();
}
function closeSettings(focus = true) {
  drawer.hidden = true; $('drawer-backdrop').hidden = true;
  $('settings-button').setAttribute('aria-expanded', 'false'); $('scene').inert = false;
  if (focus) $('settings-button').focus();
}
function enterEditing() {
  closeSettings(false); picker.close(); draft = { ...state.prefs.layout };
  document.body.classList.add('editing'); $('resize-handles').hidden = false;
  $('edit-toolbar').hidden = false; $('edit-hint').hidden = false; $('settings-button').hidden = true;
  $('shortcuts').inert = true; $('search-form').inert = true; shell.tabIndex = 0; shell.setAttribute('aria-describedby', 'edit-hint');
  setStatus('', false, true); renderLayout(); shell.focus();
}
function leaveEditing() {
  pointer = null; draft = null; document.body.classList.remove('editing');
  $('resize-handles').hidden = true; $('edit-toolbar').hidden = true; $('edit-hint').hidden = true;
  $('settings-button').hidden = false; $('search-form').inert = false; $('shortcuts').inert = false;
  shell.tabIndex = -1; shell.removeAttribute('aria-describedby'); renderLayout(); $('settings-button').focus();
}
async function saveLayout() {
  if (!draft || savingLayout) return;
  savingLayout = true; $('save-layout').disabled = true;
  const next = { ...state, prefs: { ...state.prefs, layout: { ...draft } } };
  try {
    state = store.ready ? await store.save(next, { prefs: ['layout'] }) : next; leaveEditing();
    if (!store.ready) setStatus('布局未保存，仅在当前页面生效。', true);
  } catch { setStatus('布局未保存，请重试或取消。', true, true); }
  finally { savingLayout = false; $('save-layout').disabled = false; }
}
function updateDraft(rect) { draft = rectLayout(rect, view()); scheduleLayout(); }
shell.addEventListener('pointerdown', event => {
  if (!draft || savingLayout || event.button !== 0) return;
  event.preventDefault(); (event.target.closest('[data-edge]') || shell).focus({ preventScroll: true });
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: currentRect(),
    original: { ...draft }, edge: event.target.closest('[data-edge]')?.dataset.edge || '' };
  shell.setPointerCapture(event.pointerId);
});
shell.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  updateDraft(pointer.edge ? resizeRect(pointer.rect, pointer.edge, dx, dy, searchView(), fontSize()) :
    moveRect(pointer.rect, dx, dy, searchView(), fontSize()));
});
shell.addEventListener('pointerup', event => {
  if (pointer?.id !== event.pointerId) return;
  pointer = null; if (shell.hasPointerCapture(event.pointerId)) shell.releasePointerCapture(event.pointerId);
});
shell.addEventListener('pointercancel', () => {
  if (pointer) { draft = pointer.original; pointer = null; renderLayout(); }
});
shell.addEventListener('lostpointercapture', () => { pointer = null; });
shell.addEventListener('keydown', event => {
  if (!draft || savingLayout) return;
  if (event.key === 'Enter') { event.preventDefault(); void saveLayout(); return; }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); const step = event.shiftKey ? 10 : 1;
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
  const edge = event.target.closest('[data-edge]')?.dataset.edge;
  updateDraft(edge ? resizeRect(currentRect(), edge, dx, dy, searchView(), fontSize()) : moveRect(currentRect(), dx, dy, searchView(), fontSize()));
});
const colorLabels = ['页面背景', '设置按钮', '搜索按钮', '搜索文字', '搜索边框', '搜索背景'];
colorKeys.forEach((key, index) => {
  const label = document.createElement('label'); label.className = 'row';
  const span = document.createElement('span'); span.textContent = colorLabels[index]; span.dataset.i18n = colorLabels[index];
  const input = document.createElement('input'); input.type = 'color'; input.id = `color-${key}`;
  input.setAttribute('aria-label', colorLabels[index]); input.setAttribute('data-i18n-aria-label', colorLabels[index]);
  input.addEventListener('change', () => {
    state.prefs.colors[key] = replaceRgb(state.prefs.colors[key], input.value); render(); void persistPreferences(['colors']);
  });
  label.append(span, input); $('color-fields').append(label);
});
query.addEventListener('compositionstart', () => { composition = true; });
query.addEventListener('compositionend', () => { composition = false; });
query.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (composition || event.isComposing || event.keyCode === 229)) event.preventDefault();
});
$('search-form').addEventListener('submit', event => {
  event.preventDefault(); if (composition || draft || !query.value.trim()) { query.focus(); return; }
  const url = searchUrl(state.prefs.engine, query.value, state.prefs.customEngines);
  if (state.prefs.newTab) {
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
  } else location.assign(url);
});
$('settings-button').addEventListener('click', () => drawer.hidden ? openSettings() : closeSettings());
$('close-settings').addEventListener('click', () => closeSettings());
$('drawer-backdrop').addEventListener('click', () => closeSettings());
document.addEventListener('keydown', event => {
  if (collections.modalOpen) return;
  if (event.key === 'Escape') {
    if (picker.opened) { event.preventDefault(); picker.close(true); }
    else if (draft && !savingLayout) { event.preventDefault(); leaveEditing(); }
    else if (!drawer.hidden) { event.preventDefault(); closeSettings(); }
  }
  if (event.key !== 'Tab' || drawer.hidden) return;
  const elements = [...drawer.querySelectorAll('button,input,select,summary,a[href]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
  const first = elements[0], last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$('new-tab').addEventListener('change', event => { state.prefs.newTab = event.target.checked; void persistPreferences(['newTab']); });
$('language').addEventListener('change', event => { state.prefs.language = event.target.value; render(); void persistPreferences(['language']); });
window.addEventListener('languagechange', () => { if (state.prefs.language === 'auto') render(); });
document.addEventListener('input', event => { if (event.target.matches('[data-auto-dir]')) applyInputDirection(event.target); });
$('theme').addEventListener('change', event => { state.prefs.theme = event.target.value; render(); void persistPreferences(['theme']); });
$('image-theme').addEventListener('change', event => { state.prefs.imageTheme = event.target.checked; render(); void persistPreferences(['imageTheme']); });
$('custom-color').addEventListener('change', event => { state.prefs.customColor = event.target.checked; render(); void persistPreferences(['customColor']); });
$('background-fit').addEventListener('change', event => { state.prefs.fit = Number(event.target.value); render(); void persistPreferences(['fit']); });
$('overlay').addEventListener('input', event => {
  state.prefs.overlay = Number(event.target.value) / 100;
  $('overlay-value').value = percent(state.prefs.overlay); $('shade').style.opacity = String(state.prefs.overlay);
  appearance.schedule();
});
$('overlay').addEventListener('change', () => { void persistPreferences(['overlay']); });
$('choose-background').addEventListener('click', () => { $('background-file').value = ''; $('background-file').click(); });
function backgroundBusy(value) {
  busyBackground = value; $('choose-background').disabled = value; $('clear-background').disabled = value || !state.background;
  renderBackgroundCard(); $('reset-all').disabled = value || collections.importing;
}
async function replaceBackground(background) {
  const next = { ...state, background };
  if (store.ready) {
    try { Object.assign(next, await store.save(next, { background: true })); }
    catch (error) { setStatus(backgroundSaveError(error), true); return; }
  }
  state = next; render();
  setStatus(store.ready ? (background ? '本地背景已保存。' : '已恢复纯色背景。') : '背景未保存，仅在当前页面生效。', !store.ready);
}
$('background-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  backgroundBusy(true); setStatus('');
  try { await replaceBackground(await processBackground(file)); }
  catch (error) { setStatus(error.message, true); }
  finally { backgroundBusy(false); }
});
$('clear-background').addEventListener('click', async () => { backgroundBusy(true); try { await replaceBackground(null); } finally { backgroundBusy(false); } });
$('background').addEventListener('error', () => {
  if (state.background) { state.background = null; render(); setStatus('背景无法读取，已使用纯色背景。', true); }
});
$('background').addEventListener('load', renderBackgroundCard);
$('reset-all').addEventListener('click', async () => {
  const next = { ...state, prefs: defaults(extension), background: null, shortcuts: [] };
  try { state = store.ready ? await store.save(next, { reset: true }) : next; render(); setStatus(store.ready ? '已恢复默认设置。' : '已恢复默认设置，仅在当前页面生效。', !store.ready); }
  catch { setStatus('恢复失败，已保留当前设置。请重试。', true); }
});
$('edit-layout').addEventListener('click', enterEditing);
$('save-layout').addEventListener('click', () => { void saveLayout(); });
$('cancel-layout').addEventListener('click', () => { if (!savingLayout) leaveEditing(); });
$('reset-layout').addEventListener('click', () => { if (!savingLayout) { draft = { ...defaultLayout }; renderLayout(); } });
async function refreshState() {
  if (!store.ready || draft || busyBackground || collections.modalOpen || collections.importing || document.hidden) return;
  try { state = await store.refresh(); render(); } catch { /* Keep the current page usable until an explicit save/reload. */ }
}
window.addEventListener('focus', () => { void refreshState(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshState(); });
window.addEventListener('resize', scheduleLayout);
new ResizeObserver(scheduleLayout).observe($('font-probe'));
window.addEventListener('pagehide', () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); backgroundUrl = null; renderedBackground = null; store.close(); });
window.addEventListener('pageshow', async event => {
  if (!event.persisted) return;
  try { state = await store.load(); } catch { setStatus('浏览器存储不可用，设置仅在当前页面生效。', true); }
  render();
});
render(); document.querySelector('.drawer-content').inert = true;
try { state = await store.load(); if (state.notice) setStatus(state.notice, true); }
catch { setStatus('浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。', true); }
render(); document.querySelector('.drawer-content').inert = false; query.disabled = false; $('engine-button').disabled = false; $('submit').disabled = false;
document.documentElement.dataset.ready = 'true';
