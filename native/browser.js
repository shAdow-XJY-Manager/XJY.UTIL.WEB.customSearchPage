export function faviconUrl(url, api = globalThis.chrome) {
  if (!api?.runtime?.id) return null;
  const icon = new URL(api.runtime.getURL('/_favicon/'));
  icon.searchParams.set('pageUrl', url); icon.searchParams.set('size', '32');
  return icon.href;
}
export async function importTopSites(api = globalThis.chrome) {
  if (!api?.runtime?.id || !api?.permissions) throw new Error('网站版无法读取浏览器常用网站，请在扩展中导入或手动添加。');
  // Called directly by the settings button, while the user gesture is active.
  const granted = await api.permissions.request({ permissions: ['topSites'] });
  if (!granted) throw new Error('未获得读取授权，可以手动添加或稍后重试。');
  try { return await api.topSites.get(); }
  finally { await api.permissions.remove({ permissions: ['topSites'] }).catch(() => {}); }
}
