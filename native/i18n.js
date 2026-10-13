import { localeColumns, rows } from './locales/catalog.js';
import { messageRows } from './locales/messages.js';
import { dynamicRows } from './locales/dynamic.js';
export const languages = [
  ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English'], ['ja', '日本語'],
  ['ko', '한국어'], ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español'],
  ['pt', 'Português'], ['it', 'Italiano'], ['ru', 'Русский'], ['ar', 'العربية'],
  ['hi', 'हिन्दी'], ['id', 'Bahasa Indonesia'], ['tr', 'Türkçe'], ['vi', 'Tiếng Việt'],
];
export const languageCodes = languages.map(([code]) => code);
export const catalogRows = [...rows, ...messageRows, ...dynamicRows];
const catalog = new Map(catalogRows.map(([key, ...values]) => [key, values]));
export const aliases = {
  '仅导入一次，不包含手动固定的原生链接；之后在本页独立管理。': '读取授权后仅导入一次，不包含手动固定的原生链接。导入后独立编辑，不改变浏览器数据；读取完成即撤回常用网站权限。',
  '网站版无法读取浏览器常用网站，请在扩展中导入或手动添加。': '网站版无法读取浏览器常用网站，可手动添加；一次性导入需在扩展中使用。',
  '旧背景无法读取，已使用纯色背景。': '背景无法读取，已使用纯色背景。',
  '布局未保存，仅在当前页面生效。': '设置未保存，仅在当前页面生效。重新加载后可重试。',
  '背景未保存，仅在当前页面生效。': '设置未保存，仅在当前页面生效。重新加载后可重试。',
  '设置未保存。': '未保存，已保留原数据。请重试。',
  '浏览器存储不可用。': '浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。',
  '浏览器存储不可用，设置仅在当前页面生效。': '浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。',
  '浏览器存储暂时被占用。': '浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。',
  '请关闭旧页面后重试。': '浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。',
  '请重新加载页面。': '浏览器存储不可用，设置仅在当前页面生效。重新加载后可重试。',
  '请输入有效的网站地址。': '网址格式不正确，请检查。',
  '引擎标识无效。': '数据无效，请检查后重试。',
  '快捷链接标识无效。': '数据无效，请检查后重试。',
  '请选择有效搜索引擎。': '数据无效，请检查后重试。',
  '请输入搜索内容。': '搜索',
};
let current = 'zh-CN';
export function resolveLanguage(preference = 'auto', browserLanguages = []) {
  if (languageCodes.includes(preference)) return preference;
  for (const raw of browserLanguages) {
    const value = String(raw).replaceAll('_', '-').toLowerCase();
    const [base] = value.split('-');
    if (base === 'zh') {
      if (value.includes('hant')) return 'zh-TW';
      if (value.includes('hans')) return 'zh-CN';
      return /-(tw|hk|mo)(-|$)/.test(value) ? 'zh-TW' : 'zh-CN';
    }
    if (languageCodes.includes(base)) return base;
  }
  return 'en';
}
export function setLanguage(preference, browserLanguages = globalThis.navigator?.languages || []) {
  current = resolveLanguage(preference, browserLanguages); return current;
}
export const getLanguage = () => current;
export function hasTranslation(key) { return catalog.has(key) || Object.hasOwn(aliases, key); }
export function translate(key, locale = current, params = {}) {
  const values = catalog.get(aliases[key] || key);
  const message = locale === 'zh-CN' ? key : values?.[localeColumns.indexOf(locale)] || values?.[0] || key;
  return message.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(params, name) ? String(params[name]) : token);
}
export const t = (key, params) => translate(key, current, params);
export const number = value => new Intl.NumberFormat(current, { maximumFractionDigits: 1, useGrouping: false }).format(value);
export const percent = value => new Intl.NumberFormat(current, { style: 'percent', maximumFractionDigits: 0 }).format(value);
const messages = new WeakMap();
export function setMessage(element, key, params = {}) {
  messages.set(element, { key, params }); element.textContent = t(key, params);
}
export function applyInputDirection(element) { element.dir = element.value ? 'auto' : document.documentElement.dir; }
export function applyLanguage(root = document) {
  document.documentElement.lang = current; document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const attr of ['aria-label', 'placeholder', 'title', 'alt', 'content']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attr}]`)) element.setAttribute(attr, t(element.getAttribute(`data-i18n-${attr}`)));
  }
  for (const element of root.querySelectorAll('.status')) {
    const message = messages.get(element); if (message) element.textContent = t(message.key, message.params);
  }
  for (const element of root.querySelectorAll('[data-auto-dir]')) applyInputDirection(element);
}
const brandNames = { baidu: 'Baidu', sogou: 'Sogou', '360': '360 Search', scholar: 'Google Scholar', bilibili: 'Bilibili', zhihu: 'Zhihu', douban: 'Douban Movies' };
const traditionalBrands = { '360': '360 搜尋', scholar: 'Google 學術', bilibili: '嗶哩嗶哩', douban: '豆瓣電影' };
export function engineLabel(engine) {
  if (engine.id.startsWith('custom-')) return engine.name;
  if (current === 'zh-CN') return engine.name;
  if (current === 'zh-TW') return traditionalBrands[engine.id] || t(engine.name);
  return brandNames[engine.id] || t(engine.name);
}
