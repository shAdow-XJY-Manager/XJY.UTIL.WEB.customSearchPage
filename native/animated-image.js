// Canvas drawImage(img) can expose the default frame of an animated image.
// Decode only a small sampling surface; the visible original stays untouched.
export function createAnimatedSampler() {
  let decoder = null, canvas = null, next = 0, due = 0, generation = 0, pending = false;
  function close() { generation++; decoder?.close(); decoder = null; canvas = null; pending = false; }
  async function set(file) {
    close(); const token = generation;
    if (!file || !globalThis.ImageDecoder || !['image/gif','image/png','image/webp'].includes(file.type)) return;
    try {
      if (!await ImageDecoder.isTypeSupported(file.type) || token !== generation) return;
      const current = new ImageDecoder({ data: file.stream(), type: file.type, desiredWidth: 48, desiredHeight: 48 });
      decoder = current; await current.tracks.ready; await current.completed;
      if (token !== generation) return;
      if (!current.tracks.selectedTrack?.animated) { close(); return; }
      canvas = document.createElement('canvas'); canvas.width = canvas.height = 48; next = 0; due = performance.now();
      await tick();
    } catch { if (token === generation) close(); }
  }
  async function tick() {
    if (!decoder || !canvas || pending || performance.now() < due) return;
    pending = true; const token = generation, current = decoder;
    try {
      let steps = 0;
      do {
        const { image } = await current.decode({ frameIndex: next });
        if (token !== generation) { image.close(); return; }
        canvas.getContext('2d').clearRect(0,0,48,48); canvas.getContext('2d').drawImage(image,0,0,48,48);
        due += Math.max(20, (image.duration || 100000) / 1000); image.close();
        next = (next + 1) % current.tracks.selectedTrack.frameCount;
      } while (performance.now() >= due && ++steps < 20);
      if (steps >= 20) due = performance.now() + 100;
    } catch { if (token === generation) close(); }
    finally { if (token === generation) pending = false; }
  }
  return { set, tick, close, get canvas() { return canvas; } };
}
