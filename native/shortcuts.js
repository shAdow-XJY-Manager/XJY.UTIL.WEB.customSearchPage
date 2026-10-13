export function siteUrl(value) {
  let text = String(value || '').trim();
  if (!text || text.length > 2048) throw new Error('请输入有效的网站地址。');
  if (!/^[a-z][a-z\d+.-]*:/i.test(text) || /^[\w.-]+:\d+(?:\/|$)/.test(text)) text = `https://${text}`;
  const url = new URL(text);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('网站地址仅支持 HTTP 或 HTTPS，不含用户名或密码。');
  return url.href;
}
export function shortcut(raw, id = raw?.id) {
  const url = siteUrl(raw?.url);
  const title = String(raw?.title || '').trim() || new URL(url).hostname;
  if (title.length > 60) throw new Error('名称不能超过 60 个字符。');
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) throw new Error('快捷链接标识无效。');
  return { id, title, url };
}
export function normalizeShortcuts(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 100).flatMap(entry => {
    try { const item = shortcut(entry); if (seen.has(item.id)) return []; seen.add(item.id); return [item]; }
    catch { return []; }
  });
}
export function mergeTopSites(existing, sites, makeId) {
  const result = [...existing], seen = new Set(existing.map(item => item.url));
  for (const raw of sites.slice(0, 24)) {
    try {
      const item = shortcut({ ...raw, title: String(raw.title || '').trim().slice(0, 60) }, makeId());
      if (!seen.has(item.url) && result.length < 100) { seen.add(item.url); result.push(item); }
    } catch { /* Ignore internal pages and malformed browser results. */ }
  }
  return result;
}
export function moveShortcut(items, id, target) {
  const next = [...items], index = next.findIndex(item => item.id === id);
  if (index < 0) return next;
  const [item] = next.splice(index, 1);
  next.splice(Math.max(0, Math.min(target, next.length)), 0, item);
  return next;
}
