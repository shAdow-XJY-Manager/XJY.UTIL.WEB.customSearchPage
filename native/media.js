export const videoLimit = 100 * 1024 * 1024;
export function isVideo(file) { return file?.type?.startsWith('video/') || /\.(mp4|webm)$/i.test(file?.name || ''); }
export async function validateVideo(file) {
  if (file.size > videoLimit) throw new Error('视频最大为 100 MiB。');
  if (!/\.(mp4|webm)$/i.test(file.name || '') && !['video/mp4', 'video/webm'].includes(file.type)) throw new Error('请选择 MP4 或 WebM 视频。');
  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const signature = new TextDecoder('latin1').decode(header);
  const mp4 = signature.slice(4, 8) === 'ftyp' && signature.slice(8, 12) !== 'qt  ';
  const webm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3 && signature.includes('webm');
  if (!mp4 && !webm) throw new Error('媒体无法解码，请选择其他文件。');
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  video.muted = true; video.preload = 'auto';
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('媒体无法解码，请选择其他文件。')), 30000);
      video.onloadeddata = () => { clearTimeout(timer); video.videoWidth ? resolve() : reject(new Error('媒体无法解码，请选择其他文件。')); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('媒体无法解码，请选择其他文件。')); };
      video.src = url;
    });
    const type = webm ? 'video/webm' : 'video/mp4';
    return file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
  } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
export function createMedia(video, onState) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let wanted = !reduced.matches, source = null, preference = 'auto';
  async function sync() {
    if (!source || document.hidden || !wanted) { video.pause(); onState(); return; }
    try { await video.play(); } catch { wanted = false; }
    onState();
  }
  video.preload = 'auto'; video.muted = true; video.loop = true; video.playsInline = true;
  video.addEventListener('loadeddata', sync);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { if (preference === 'auto') { wanted = !reduced.matches; void sync(); } });
  return {
    set(url) { if (url === source) return; video.pause(); source = url; wanted = preference === 'auto' ? !reduced.matches : preference === 'play'; if (url) video.src = url; else { video.removeAttribute('src'); video.load(); } },
    preference(value) { if (preference === value) return; preference = value; wanted = value === 'auto' ? !reduced.matches : value === 'play'; void sync(); },
    toggle() { wanted = !wanted; void sync(); return wanted; },
    get playing() { return !video.paused; },
    dispose() { video.pause(); source = null; video.removeAttribute('src'); video.load(); },
  };
}
