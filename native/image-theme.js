const mix = (a, b, amount) => a.map((value, i) => Math.round(value * (1 - amount) + b[i] * amount));
export const rgbCss = rgb => `rgb(${rgb.join(', ')})`;
export function luminance(rgb) {
  const linear = rgb.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
export function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
export function dominantColor(pixels) {
  const buckets = new Map();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = rgb.map(value => value >> 4).join(',');
    const bucket = buckets.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count++; rgb.forEach((value, j) => { bucket.sum[j] += value; }); buckets.set(key, bucket);
  }
  let best = null, score = 0;
  for (const bucket of buckets.values()) {
    const rgb = bucket.sum.map(value => Math.round(value / bucket.count));
    const saturation = (Math.max(...rgb) - Math.min(...rgb)) / 255;
    const weight = bucket.count * (.35 + saturation * .65);
    if (weight > score) { best = rgb; score = weight; }
  }
  return best;
}
export function pageTint(rgb, dark) {
  let tint = mix(rgb, dark ? [32, 33, 36] : [248, 249, 250], dark ? .32 : .72);
  // Bright yellow or white photos must still leave readable text in dark mode.
  if (dark) while (luminance(tint) > .12) tint = mix(tint, [14, 16, 18], .08);
  return tint;
}
export function buttonColors(backdrop, custom = null) {
  const white = [248, 250, 252], black = [32, 33, 36];
  const icon = custom || (contrast(white, backdrop) > contrast(black, backdrop) ? white : black);
  const darkPlate = contrast(icon, [0, 0, 0]) > contrast(icon, [255, 255, 255]);
  const surface = mix(backdrop, darkPlate ? [12, 14, 16] : [255, 255, 255], custom ? .94 : .72);
  return { icon, surface, outline: darkPlate ? '#ffffff26' : '#00000020' };
}
export function imageContentRect(box, size, fit) {
  if (fit === 'fill') return { x: box.x, y: box.y, width: box.width, height: box.height };
  let scale = fit === 'cover' ? Math.max(box.width / size.width, box.height / size.height) :
    Math.min(box.width / size.width, box.height / size.height);
  if (fit === 'none') scale = 1;
  if (fit === 'scale-down') scale = Math.min(1, scale);
  const width = size.width * scale, height = size.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}
