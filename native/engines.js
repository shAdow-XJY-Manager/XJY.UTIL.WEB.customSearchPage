// URL facts researched from provider documentation and Mozilla's search configuration.
// Sources and service limitations: SEARCH_ENGINES.md. No partner or tracking parameters.
const groups = [
  ['网页', [
    ['bing', 'Bing', 'https://www.bing.com/search?q={query}'],
    ['google', 'Google', 'https://www.google.com/search?q={query}'],
    ['baidu', '百度', 'https://www.baidu.com/s?wd={query}'],
    ['duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q={query}'],
    ['brave', 'Brave Search', 'https://search.brave.com/search?q={query}'],
    ['startpage', 'Startpage', 'https://www.startpage.com/sp/search?query={query}'],
    ['qwant', 'Qwant', 'https://www.qwant.com/?q={query}'],
    ['ecosia', 'Ecosia', 'https://www.ecosia.org/search?q={query}'],
    ['yahoo', 'Yahoo', 'https://search.yahoo.com/search?p={query}'],
    ['yahoo-jp', 'Yahoo! JAPAN', 'https://search.yahoo.co.jp/search?p={query}'],
    ['yandex', 'Yandex', 'https://yandex.com/search/?text={query}'],
    ['sogou', '搜狗', 'https://www.sogou.com/web?query={query}'],
    ['360', '360 搜索', 'https://www.so.com/s?q={query}'],
    ['naver', 'Naver', 'https://search.naver.com/search.naver?query={query}'],
    ['daum', 'Daum', 'https://search.daum.net/search?w=tot&q={query}'],
    ['seznam', 'Seznam', 'https://search.seznam.cz/?q={query}'],
    ['coccoc', 'Cốc Cốc', 'https://coccoc.com/search?query={query}'],
    ['mojeek', 'Mojeek', 'https://www.mojeek.com/search?q={query}'],
    ['swisscows', 'Swisscows', 'https://swisscows.com/web?query={query}'],
    ['kagi', 'Kagi（需账号）', 'https://kagi.com/search?q={query}'],
    ['perplexity', 'Perplexity', 'https://www.perplexity.ai/search?q={query}'],
  ]],
  ['知识与技术', [
    ['wikipedia-zh', '维基百科 · 中文', 'https://zh.wikipedia.org/w/index.php?search={query}'],
    ['wikipedia-en', 'Wikipedia · English', 'https://en.wikipedia.org/w/index.php?search={query}'],
    ['github', 'GitHub', 'https://github.com/search?q={query}'],
    ['stackoverflow', 'Stack Overflow', 'https://stackoverflow.com/search?q={query}'],
    ['mdn', 'MDN', 'https://developer.mozilla.org/zh-CN/search?q={query}'],
    ['scholar', 'Google 学术', 'https://scholar.google.com/scholar?q={query}'],
    ['pubmed', 'PubMed', 'https://pubmed.ncbi.nlm.nih.gov/?term={query}'],
    ['arxiv', 'arXiv', 'https://arxiv.org/search/?query={query}&searchtype=all'],
  ]],
  ['视频与社区', [
    ['youtube', 'YouTube', 'https://www.youtube.com/results?search_query={query}'],
    ['bilibili', '哔哩哔哩', 'https://search.bilibili.com/all?keyword={query}'],
    ['zhihu', '知乎', 'https://www.zhihu.com/search?type=content&q={query}'],
    ['douban', '豆瓣电影', 'https://search.douban.com/movie/subject_search?search_text={query}'],
  ]],
  ['购物', [
    ['amazon', 'Amazon', 'https://www.amazon.com/s?k={query}'],
    ['ebay', 'eBay', 'https://www.ebay.com/sch/i.html?_nkw={query}'],
  ]],
];
export const engines = groups.flatMap(([group, entries]) => entries.map(([id, name, template]) => ({ id, name, template, group })));
export function validateTemplate(value) {
  const template = String(value || '').trim().replaceAll('%s', '{query}');
  if (template.length > 2048 || template.split('{query}').length !== 2) throw new Error('搜索网址需包含一个 %s 或 {query}。');
  const url = new URL(template.replace('{query}', 'search'));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      !/^https?:\/\/[^/?#{}]+[/?#]/i.test(template) || /[{}]/.test(template.replace('{query}', ''))) {
    throw new Error('请输入有效的 HTTP 或 HTTPS 搜索网址，不含用户名或密码。');
  }
  return template;
}
export function customEngine(raw, id = raw?.id) {
  const name = String(raw?.name || '').trim();
  if (!name || name.length > 40) throw new Error('引擎名称需为 1–40 个字符。');
  if (typeof id !== 'string' || !/^custom-[\w-]{1,80}$/.test(id)) throw new Error('引擎标识无效。');
  return { id, name, template: validateTemplate(raw.template), group: '自定义' };
}
export function normalizeEngines(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 100).flatMap(entry => {
    try { const item = customEngine(entry); if (seen.has(item.id)) return []; seen.add(item.id); return [item]; }
    catch { return []; }
  });
}
export const allEngines = (custom = []) => [...engines, ...custom];
export function engineById(id, custom = []) {
  // Numeric values only belonged to the original three providers.
  if (Number.isInteger(id)) id = ['bing', 'google', 'baidu'][id];
  return allEngines(custom).find(engine => engine.id === id);
}
export function searchUrl(id, query, custom = []) {
  if (!query.trim()) throw new Error('请输入搜索内容。');
  const engine = engineById(id, custom);
  if (!engine) throw new Error('请选择有效搜索引擎。');
  return new URL(validateTemplate(engine.template).replace('{query}', encodeURIComponent(query.trim()))).href;
}
