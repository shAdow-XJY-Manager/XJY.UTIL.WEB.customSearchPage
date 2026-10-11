export async function processBackground(file) {
  if (!file) return null;
  if (file.size > 32 * 1024 * 1024) throw new Error('背景图片不能超过 32 MB。');
  const url = URL.createObjectURL(file);
  let canvas;
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error('图片解码超时。')), 15000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('图片损坏或不支持。')); };
      img.src = url;
    });
    if (image.naturalWidth * image.naturalHeight > 16000000) throw new Error('背景图片不能超过 1600 万像素。');
    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#111315'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.82);
    if (data.length > 2 * 1024 * 1024) throw new Error('压缩后背景仍超过 2 MB，请选择更小图片。');
    return new Blob([Uint8Array.from(atob(data.split(',')[1]), char => char.charCodeAt(0))], { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
