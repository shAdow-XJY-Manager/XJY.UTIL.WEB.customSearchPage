import sources from './engine-icon-sources.json';
import search from './icons/search.svg';
import bing from '../assets/icon/bing.png';
import google from '../assets/icon/google.png';
import baidu from '../assets/icon/baidu.png';
const files = import.meta.glob('./engine-icons/*', { eager: true, query: '?url', import: 'default' });
const local = { bing, google, baidu };
for (const [path, url] of Object.entries(files)) local[path.split('/').pop().replace(/\.[^.]+$/, '')] = url;
const loaded = new Map(), pending = new Map();
export const iconFor = id => loaded.get(id) || local[id] || search;
export const iconClass = id => local[id] ? 'brand-icon' : 'system-icon';
// Fixed provider catalog only. Queries, user sites and custom engine URLs never
// reach a third-party icon service. No remote script, markup injection or fonts.
export async function cachedIcon(id) {
  if (!sources[id]) return iconFor(id);
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    const { url, color } = sources[id];
    try {
      let cache;
      try { cache = await caches.open('frequency-engine-icons-v1'); } catch { /* Memory fallback. */ }
      let response = await cache?.match(url);
      if (!response) {
        if (!navigator.onLine) return iconFor(id);
        response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
        if (!response.ok || !response.headers.get('content-type')?.includes('image/svg+xml')) throw new Error('Icon unavailable');
        const svg = await response.text();
        if (svg.length > 50000 || !svg.includes('<svg') || /<(script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(svg)) throw new Error('Unexpected icon');
        response = new Response(svg.replace('<svg ', `<svg fill="#${color}" `), { headers: { 'Content-Type': 'image/svg+xml' } });
        try { await cache?.put(url, response.clone()); } catch { /* Keep local fallback usable. */ }
      }
      const blob = await response.blob();
      loaded.set(id, URL.createObjectURL(blob));
    } catch { /* Bundled brand mark works on first offline open. */ }
    return iconFor(id);
  })();
  pending.set(id, task);
  return task;
}
export function paintIcon(image, id, hydrate = true) {
  image.dataset.icon = id; image.src = iconFor(id); image.className = iconClass(id);
  if (!hydrate) return;
  void cachedIcon(id).then(url => { if (image.dataset.icon === id) image.src = url; });
}
