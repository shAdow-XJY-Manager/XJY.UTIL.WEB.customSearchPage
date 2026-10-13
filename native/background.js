import { number } from './i18n.js';
export async function processBackground(file) {
  if (!file) return null;
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => { img.src = ''; reject(new Error('图片解码超时，请稍后重试。')); }, 30000);
      img.onload = () => { clearTimeout(timer); if (img.naturalWidth && img.naturalHeight) resolve(); else reject(new Error('图片损坏或不支持。')); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('图片损坏或不支持。')); };
      img.src = url;
    });
    // Store the selected File itself: retain every byte, format and animation.
    return file;
  } finally { URL.revokeObjectURL(url); }
}
export function fileSize(bytes) {
  if (bytes < 1024) return `${number(bytes)} B`;
  const units = ['KB', 'MB', 'GB']; let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${number(value)} ${units[unit]}`;
}
export function backgroundSaveError(error) {
  return error?.name === 'QuotaExceededError' ? '本机存储空间不足，原背景已保留。' : '背景未保存，已保留原背景。请重试。';
}
