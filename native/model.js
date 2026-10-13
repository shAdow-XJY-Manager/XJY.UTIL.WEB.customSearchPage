import { languageCodes } from './i18n.js';
import { engineById, normalizeEngines } from './engines.js';
export { engines, searchUrl } from './engines.js';
export const defaultLayout = Object.freeze({ cx: 0.5, cy: 0.42, width: 600, height: 56 });
export const colorKeys = ['page', 'settings', 'submit', 'text', 'border', 'field'];
const oldColors = ['page_back_color_value', 'setting_btn_color_value', 'search_btn_color_value',
  'search_bar_text_color_value', 'search_bar_border_color_value', 'search_bar_back_color_value'];
export const defaultColors = Object.freeze({ page: 0xfff8f9fa, settings: 0xff5f6368,
  submit: 0xff5f6368, text: 0xff202124, border: 0xffdadce0, field: 0xffffffff });
export function defaults(extension = false) {
  return { engine: 'bing', customEngines: [], showShortcuts: true, showAddShortcut: true, newTab: !extension, theme: 'auto', language: 'auto', imageTheme: true, fit: 3, overlay: 0,
    customColor: false, colors: { ...defaultColors }, layout: { ...defaultLayout } };
}
const finite = value => typeof value === 'number' && Number.isFinite(value);
const option = (value, count, fallback) => Number.isInteger(value) && value >= 0 && value < count ? value : fallback;
export function normalizePrefs(raw, extension = false) {
  const p = defaults(extension);
  if (!raw || typeof raw !== 'object') return p;
  p.customEngines = normalizeEngines(raw.customEngines);
  p.engine = engineById(raw.engine, p.customEngines)?.id || p.engine;
  if (typeof raw.showAddShortcut === 'boolean') p.showAddShortcut = raw.showAddShortcut;
  if (typeof raw.showShortcuts === 'boolean') p.showShortcuts = raw.showShortcuts;
  if (typeof raw.newTab === 'boolean') p.newTab = raw.newTab;
  if (['auto', 'light', 'dark'].includes(raw.theme)) p.theme = raw.theme;
  if (raw.language === 'auto' || languageCodes.includes(raw.language)) p.language = raw.language;
  if (typeof raw.imageTheme === 'boolean') p.imageTheme = raw.imageTheme;
  p.fit = option(raw.fit, 7, p.fit);
  if (finite(raw.overlay) && raw.overlay >= 0 && raw.overlay <= 1) p.overlay = raw.overlay;
  p.customColor = raw.customColor === true;
  for (const key of colorKeys) {
    const value = raw.colors?.[key];
    if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff) p.colors[key] = value;
  }
  const l = raw.layout;
  if (l && finite(l.cx) && finite(l.cy) && l.cx >= 0 && l.cx <= 1 && l.cy >= 0 && l.cy <= 1 &&
      finite(l.width) && l.width > 0 && l.width <= 100000 && finite(l.height) && l.height > 0 && l.height <= 100000) {
    p.layout = { cx: l.cx, cy: l.cy, width: l.width, height: l.height };
  }
  return p;
}
export function migratePrefs(legacy, extension = false) {
  const raw = { engine: legacy.engine_option, newTab: legacy.is_jump_to_new_page,
    fit: legacy.box_fit_option, customColor: legacy.lock_or_custom_color, colors: {},
    overlay: legacy.background_overlay_opacity ?? (legacy.is_custom_back_img === true ? 0.45 : 0) };
  oldColors.forEach((key, i) => { raw.colors[colorKeys[i]] = legacy[key]; });
  const layout = { ...defaultLayout };
  const align = legacy.search_bar_align_option;
  if (Number.isInteger(align) && align >= 0 && align < 9) {
    layout.cx = (align % 3) / 2;
    layout.cy = Math.floor(align / 3) / 2;
  }
  const width = legacy.search_bar_length_option;
  if (Number.isInteger(width) && width >= 0 && width < 3) layout.width = [500, 800, 1000][width];
  raw.layout = layout;
  return normalizePrefs(raw, extension);
}
export function argbCss(value) {
  const hex = value.toString(16).padStart(8, '0');
  return `#${hex.slice(2)}${hex.slice(0, 2)}`;
}
export function rgbHex(value) { return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`; }
export function replaceRgb(value, rgb) { return ((value & 0xff000000) | parseInt(rgb.slice(1), 16)) >>> 0; }
