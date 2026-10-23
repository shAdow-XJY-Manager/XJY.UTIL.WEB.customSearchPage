import { defaults } from './model.js';
import { t } from './i18n.js';

export const resetPrompt = "重置会清除本页保存的背景、偏好设置、自定义搜索引擎和快捷链接。此操作无法撤销。确认重置？";

// Cancellation returns before constructing a new state or invoking storage.
export async function resetWithConfirmation({ state, store, extension, confirm }) {
  if (!confirm(t(resetPrompt))) return null;
  const next = { ...state, prefs: defaults(extension), background: null, shortcuts: [] };
  return store.ready ? await store.save(next, { reset: true }) : next;
}
