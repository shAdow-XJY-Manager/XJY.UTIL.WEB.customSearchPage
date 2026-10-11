import { engines, defaults, defaultLayout, colorKeys, argbCss, rgbHex, replaceRgb, searchUrl } from './model.js';
import { layoutRect, rectLayout, moveRect, resizeRect } from './layout.js';
import { PreferenceStore } from './storage.js';
import { processBackground } from './background.js';
import bing from '../assets/icon/bing.png';
import google from '../assets/icon/google.png';
import baidu from '../assets/icon/baidu.png';

const $ = id => document.getElementById(id);
const icons = [bing, google, baidu];
const extension = location.protocol === 'chrome-extension:';
const store = new PreferenceStore({ extension });
let state = { prefs: defaults(extension), background: null };
let draft = null, pointer = null, menuOpen = false, composition = false, backgroundUrl = null, renderedBackground = null;
let selectedMenuIndex = 0, selection = [0, 0], frame = 0, busyBackground = false, savingLayout = false;
const query = $('query'), shell = $('search-shell'), drawer = $('settings'), menu = $('engine-menu');
const view = () => ({ width: window.innerWidth, height: window.innerHeight });
const fontSize = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const currentRect = () => layoutRect(draft || state.prefs.layout, view(), fontSize());
function setStatus(text, error = false, edit = false) {
  const target = $(edit ? 'edit-status' : 'settings-status');
  target.textContent = text; target.dataset.error = String(error);
  if (text && error && !edit && !drawer.hidden) target.scrollIntoView({ block: 'nearest' });
}
function renderLayout() {
  const rect = currentRect();
  shell.style.left = '0'; shell.style.top = '0';
  shell.style.transform = `translate3d(${rect.x}px,${rect.y}px,0)`;
  shell.style.width = `${rect.width}px`; shell.style.height = `${rect.height}px`;
  if (menuOpen) positionMenu();
}
function scheduleLayout() {
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderLayout(); });
}
function render() {
  const p = state.prefs;
  document.documentElement.dataset.theme = p.theme;
  const properties = { page: '--custom-page', settings: '--custom-settings', submit: '--custom-submit',
    text: '--custom-text', border: '--custom-border', field: '--custom-field' };
  for (const key of colorKeys) {
    if (p.customColor) document.documentElement.style.setProperty(properties[key], argbCss(p.colors[key]));
    else document.documentElement.style.removeProperty(properties[key]);
    $(`color-${key}`).value = rgbHex(p.colors[key]);
    $(`color-${key}`).disabled = !p.customColor;
  }
  $('engine-icon').src = icons[p.engine];
  $('engine-button').setAttribute('aria-label', `切换搜索引擎，当前 ${engines[p.engine].name}`);
  menu.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-checked', String(index === p.engine)));
  $('new-tab').checked = p.newTab; $('theme').value = p.theme;
  $('background-fit').value = String(p.fit); $('overlay').value = String(Math.round(p.overlay * 100));
  $('overlay-value').value = `${Math.round(p.overlay * 100)}%`; $('custom-color').checked = p.customColor;
  if (renderedBackground !== state.background) {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    renderedBackground = state.background;
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
  renderLayout();
}
async function persistPreferences() {
  try { await store.save(state); setStatus('已保存。'); }
  catch { setStatus('设置未保存，仅在当前页面生效。重新加载后可重试。', true); }
}
function focusQuery() {
  query.focus({ preventScroll: true });
  // search inputs do not implement setSelectionRange in every browser.
  try { query.setSelectionRange(...selection); } catch { /* Retain browser-managed selection. */ }
}
function closeMenu(focus = false) {
  menuOpen = false; menu.hidden = true; $('engine-button').setAttribute('aria-expanded', 'false');
  if (focus) focusQuery();
}
function positionMenu() {
  const anchor = $('engine-button').getBoundingClientRect();
  const viewport = view();
  const below = viewport.height - anchor.bottom - 16;
  const above = anchor.top - 16;
  const height = Math.min(180, Math.max(below, above));
  menu.style.maxHeight = `${Math.max(44, height)}px`;
  menu.style.maxWidth = `${Math.max(1, viewport.width - 32)}px`;
  menu.style.left = `${Math.max(16, Math.min(anchor.left, viewport.width - 226))}px`;
  menu.style.top = `${below >= 160 || below >= above ? anchor.bottom + 8 : Math.max(16, anchor.top - Math.min(menu.scrollHeight, height) - 8)}px`;
}
function openMenu() {
  if (draft) return;
  selection = [query.selectionStart || 0, query.selectionEnd || 0];
  menuOpen = true; menu.hidden = false; $('engine-button').setAttribute('aria-expanded', 'true');
  selectedMenuIndex = state.prefs.engine; positionMenu(); menu.children[selectedMenuIndex].focus();
}
function openSettings() {
  if (draft) return;
  closeMenu(); drawer.hidden = false; $('drawer-backdrop').hidden = false;
  $('settings-button').setAttribute('aria-expanded', 'true'); $('scene').inert = true;
  $('close-settings').focus();
}
function closeSettings(focus = true) {
  drawer.hidden = true; $('drawer-backdrop').hidden = true;
  $('settings-button').setAttribute('aria-expanded', 'false'); $('scene').inert = false;
  if (focus) $('settings-button').focus();
}
function enterEditing() {
  closeSettings(false); closeMenu(); draft = { ...state.prefs.layout };
  document.body.classList.add('editing'); $('resize-handles').hidden = false;
  $('edit-toolbar').hidden = false; $('edit-hint').hidden = false; $('settings-button').hidden = true;
  $('search-form').inert = true; shell.tabIndex = 0; shell.setAttribute('aria-describedby', 'edit-hint');
  setStatus('', false, true); renderLayout(); shell.focus();
}
function leaveEditing() {
  pointer = null; draft = null; document.body.classList.remove('editing');
  $('resize-handles').hidden = true; $('edit-toolbar').hidden = true; $('edit-hint').hidden = true;
  $('settings-button').hidden = false; $('search-form').inert = false;
  shell.tabIndex = -1; shell.removeAttribute('aria-describedby'); renderLayout(); $('settings-button').focus();
}
async function saveLayout() {
  if (!draft || savingLayout) return;
  savingLayout = true; $('save-layout').disabled = true;
  const next = { ...state, prefs: { ...state.prefs, layout: { ...draft } } };
  try {
    if (store.ready) await store.save(next);
    state = next; leaveEditing();
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
  updateDraft(pointer.edge ? resizeRect(pointer.rect, pointer.edge, dx, dy, view(), fontSize()) :
    moveRect(pointer.rect, dx, dy, view(), fontSize()));
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
  updateDraft(edge ? resizeRect(currentRect(), edge, dx, dy, view(), fontSize()) : moveRect(currentRect(), dx, dy, view(), fontSize()));
});
const colorLabels = ['页面背景', '设置按钮', '搜索按钮', '搜索文字', '搜索边框', '搜索背景'];
colorKeys.forEach((key, index) => {
  const label = document.createElement('label'); label.className = 'row';
  const span = document.createElement('span'); span.textContent = colorLabels[index];
  const input = document.createElement('input'); input.type = 'color'; input.id = `color-${key}`;
  input.setAttribute('aria-label', colorLabels[index]);
  input.addEventListener('change', () => {
    state.prefs.colors[key] = replaceRgb(state.prefs.colors[key], input.value); render(); void persistPreferences();
  });
  label.append(span, input); $('color-fields').append(label);
});
engines.forEach((engine, index) => {
  const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitemradio');
  const image = document.createElement('img'); image.src = icons[index]; image.width = image.height = 20; image.alt = '';
  const label = document.createElement('span'); label.className = 'engine-name'; label.textContent = engine.name;
  const check = document.createElement('span'); check.className = 'icon icon-check'; check.setAttribute('aria-hidden', 'true');
  button.append(image, label, check); button.addEventListener('click', () => {
    state.prefs.engine = index; render(); closeMenu(true); void persistPreferences();
  }); menu.append(button);
});
$('engine-button').addEventListener('click', () => { if (menuOpen) closeMenu(true); else openMenu(); });
menu.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  selectedMenuIndex = event.key === 'Home' ? 0 : event.key === 'End' ? engines.length - 1 :
    (selectedMenuIndex + (event.key === 'ArrowDown' ? 1 : -1) + engines.length) % engines.length;
  menu.children[selectedMenuIndex].focus();
});
document.addEventListener('pointerdown', event => {
  if (menuOpen && !menu.contains(event.target) && !$('engine-button').contains(event.target)) closeMenu();
});
menu.addEventListener('focusout', event => { if (menuOpen && !menu.contains(event.relatedTarget)) closeMenu(); });
query.addEventListener('compositionstart', () => { composition = true; });
query.addEventListener('compositionend', () => { composition = false; });
query.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (composition || event.isComposing || event.keyCode === 229)) event.preventDefault();
});
$('search-form').addEventListener('submit', event => {
  event.preventDefault(); if (composition || draft || !query.value.trim()) { query.focus(); return; }
  const url = searchUrl(state.prefs.engine, query.value);
  if (state.prefs.newTab) {
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
  } else location.assign(url);
});
$('settings-button').addEventListener('click', () => drawer.hidden ? openSettings() : closeSettings());
$('close-settings').addEventListener('click', () => closeSettings());
$('drawer-backdrop').addEventListener('click', () => closeSettings());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (menuOpen) { event.preventDefault(); closeMenu(true); }
    else if (draft && !savingLayout) { event.preventDefault(); leaveEditing(); }
    else if (!drawer.hidden) { event.preventDefault(); closeSettings(); }
  }
  if (event.key !== 'Tab' || drawer.hidden) return;
  const elements = [...drawer.querySelectorAll('button,input,select,summary')].filter(el => !el.disabled && el.getClientRects().length);
  const first = elements[0], last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$('new-tab').addEventListener('change', event => { state.prefs.newTab = event.target.checked; void persistPreferences(); });
$('theme').addEventListener('change', event => { state.prefs.theme = event.target.value; render(); void persistPreferences(); });
$('custom-color').addEventListener('change', event => { state.prefs.customColor = event.target.checked; render(); void persistPreferences(); });
$('background-fit').addEventListener('change', event => { state.prefs.fit = Number(event.target.value); render(); void persistPreferences(); });
$('overlay').addEventListener('input', event => {
  state.prefs.overlay = Number(event.target.value) / 100;
  $('overlay-value').value = `${event.target.value}%`; $('shade').style.opacity = String(state.prefs.overlay);
});
$('overlay').addEventListener('change', () => { void persistPreferences(); });
$('choose-background').addEventListener('click', () => { $('background-file').value = ''; $('background-file').click(); });
function backgroundBusy(value) {
  busyBackground = value; $('choose-background').disabled = value; $('clear-background').disabled = value || !state.background;
  $('choose-background').textContent = value ? '读取中…' : '选择本地图片'; $('reset-all').disabled = value;
}
async function replaceBackground(background) {
  const next = { ...state, background };
  if (store.ready) {
    try { await store.save(next); }
    catch { setStatus('背景未保存，已保留原背景。请重试。', true); return; }
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
$('reset-all').addEventListener('click', async () => {
  const next = { prefs: defaults(extension), background: null };
  try { if (store.ready) await store.save(next); state = next; render(); setStatus(store.ready ? '已恢复默认设置。' : '已恢复默认设置，仅在当前页面生效。', !store.ready); }
  catch { setStatus('恢复失败，已保留当前设置。请重试。', true); }
});
$('edit-layout').addEventListener('click', enterEditing);
$('save-layout').addEventListener('click', () => { void saveLayout(); });
$('cancel-layout').addEventListener('click', () => { if (!savingLayout) leaveEditing(); });
$('reset-layout').addEventListener('click', () => { if (!savingLayout) { draft = { ...defaultLayout }; renderLayout(); } });
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
