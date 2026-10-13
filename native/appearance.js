import { dominantColor, buttonColors, rgbCss, imageContentRect } from './image-theme.js';

export function createAppearance({ image, button, getPrefs }) {
  const root = document.documentElement, canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const ambient = document.getElementById('ambient'), glow = ambient.getContext('2d');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let source = null, dominant = null, sourcePixels = null, frame = 0;
  const ready = () => !image.hidden && image.complete && image.naturalWidth > 0 && image.currentSrc;
  function palette() {
    if (!ready()) { source = null; dominant = null; return; }
    if (source === image.currentSrc) return;
    source = image.currentSrc; dominant = null;
    if (!context) return;
    canvas.width = canvas.height = 48;
    context.drawImage(image, 0, 0, 48, 48);
    sourcePixels = context.getImageData(0, 0, 48, 48).data;
    dominant = dominantColor(sourcePixels);
  }
  function sampleBackdrop() {
    const box = button.getBoundingClientRect();
    if (!context || !box.width || !box.height) return null;
    canvas.width = canvas.height = 24;
    context.fillStyle = getComputedStyle(root).getPropertyValue('--page');
    context.fillRect(0, 0, 24, 24);
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 24, 24);
    if (!ambient.hidden) {
      context.globalAlpha = Number(ambient.style.opacity);
      context.drawImage(ambient, (box.x + 24) / (innerWidth + 48) * ambient.width, (box.y + 24) / (innerHeight + 48) * ambient.height, Math.max(1, box.width / (innerWidth + 48) * ambient.width), Math.max(1, box.height / (innerHeight + 48) * ambient.height), 0, 0, 24, 24);
      context.globalAlpha = 1;
    }
    if (ready()) {
      const bounds = image.getBoundingClientRect();
      const rect = imageContentRect(bounds, { width: image.naturalWidth, height: image.naturalHeight }, getComputedStyle(image).objectFit);
      context.save();
      context.setTransform(24 / box.width, 0, 0, 24 / box.height, -box.x * 24 / box.width, -box.y * 24 / box.height);
      context.beginPath(); context.rect(bounds.x, bounds.y, bounds.width, bounds.height); context.clip();
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height); context.restore();
      context.globalAlpha = getPrefs().overlay; context.fillStyle = '#111315'; context.fillRect(0, 0, 24, 24); context.globalAlpha = 1;
    }
    const pixels = context.getImageData(0, 0, 24, 24).data, sums = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) sums.forEach((_, j) => { sums[j] += pixels[i + j]; });
    return sums.map(value => Math.round(value / (pixels.length / 4)));
  }
  function update() {
    const prefs = getPrefs(), dark = prefs.theme === 'dark' || prefs.theme === 'auto' && systemTheme.matches;
    try { palette(); } catch { dominant = null; }
    root.style.removeProperty('--image-page');
    ambient.hidden = !dominant || !prefs.imageTheme || prefs.customColor;
    if (!ambient.hidden && glow) {
      // Small analysis surface only: the saved image and foreground stay original.
      // Preserve spatial colors instead of flattening the picture to one swatch.
      const bounds = image.getBoundingClientRect();
      const rect = imageContentRect(bounds, { width: image.naturalWidth, height: image.naturalHeight }, getComputedStyle(image).objectFit);
      const width = innerWidth + 48, height = innerHeight + 48;
      ambient.width = 160; ambient.height = Math.max(1, Math.round(160 * height / width));
      const output = glow.createImageData(ambient.width, ambient.height);
      const base = dark ? [32, 33, 36] : [248, 249, 250];
      const spread = Math.max(180, Math.min(innerWidth, innerHeight) * .3);
      for (let y = 0; y < ambient.height; y++) for (let x = 0; x < ambient.width; x++) {
        const px = x / ambient.width * width - 24, py = y / ambient.height * height - 24;
        const dx = Math.max(rect.x - px, 0, px - rect.x - rect.width);
        const dy = Math.max(rect.y - py, 0, py - rect.y - rect.height);
        const falloff = Math.exp(-Math.pow(Math.hypot(dx, dy) / spread, 2) * (dark ? 1 : 1.6));
        const sx = Math.max(0, Math.min(47, Math.floor((px - rect.x) / rect.width * 48)));
        const sy = Math.max(0, Math.min(47, Math.floor((py - rect.y) / rect.height * 48)));
        const index = (y * ambient.width + x) * 4, sample = (sy * 48 + sx) * 4;
        const alpha = sourcePixels[sample + 3] / 255 * falloff;
        for (let c = 0; c < 3; c++) output.data[index + c] = sourcePixels[sample + c] * alpha + base[c] * (1 - alpha);
        output.data[index + 3] = 255;
      }
      glow.putImageData(output, 0, 0); ambient.style.opacity = '1';
    }
    // CSS-only fallback retains a readable opaque button if pixel reads are unavailable.
    let backdrop;
    try { backdrop = sampleBackdrop(); } catch { backdrop = null; }
    if (!backdrop) {
      for (const name of ['--settings-ink', '--settings-surface', '--settings-outline']) button.style.removeProperty(name);
      return;
    }
    const value = prefs.colors.settings;
    const custom = prefs.customColor ? [(value >>> 16) & 255, (value >>> 8) & 255, value & 255] : null;
    const colors = buttonColors(backdrop, custom);
    button.style.setProperty('--settings-ink', rgbCss(colors.icon));
    button.style.setProperty('--settings-surface', rgbCss(colors.surface));
    button.style.setProperty('--settings-outline', colors.outline);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); }
  image.addEventListener('load', schedule); image.addEventListener('error', () => { source = null; dominant = null; schedule(); });
  systemTheme.addEventListener('change', schedule); window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(button);
  return { update, schedule };
}
