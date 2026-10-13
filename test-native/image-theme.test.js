import test from 'node:test';
import assert from 'node:assert/strict';
import { dominantColor, pageTint, buttonColors, luminance, contrast, imageContentRect } from '../native/image-theme.js';
import { defaults, normalizePrefs } from '../native/model.js';

test('image themes default on, preserve an explicit off choice and keep system theme independent', () => {
  assert(defaults().imageTheme); assert(normalizePrefs({ theme: 'auto' }).imageTheme);
  assert.equal(normalizePrefs({ imageTheme: false }).imageTheme, false);
  assert.equal(normalizePrefs({ imageTheme: false }).theme, 'auto');
});
test('dominant colors favor a sizeable colored region over neutral shadows and ignore transparent pixels', () => {
  const pixels = [...Array(55).fill([0, 0, 0, 255]), ...Array(45).fill([160, 24, 16, 255]), ...Array(100).fill([0, 255, 0, 0])].flat();
  assert.deepEqual(dominantColor(pixels), [160, 24, 16]);
  assert.equal(dominantColor([0, 0, 0, 0]), null); assert.equal(dominantColor([]), null);
});
test('photo tints preserve color character and readable text in both theme modes', () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [255, 255, 0], [255, 0, 0], [20, 60, 180], [40, 180, 50]]) {
    const dark = pageTint(rgb, true), light = pageTint(rgb, false);
    assert(luminance(dark) <= .12); assert(contrast(dark, [232, 234, 237]) >= 4.5);
    assert(contrast(light, [32, 33, 36]) >= 4.5);
  }
  assert(pageTint([160, 20, 10], true)[0] > pageTint([160, 20, 10], true)[2]);
});
test('automatic and custom setting glyphs contrast against their adaptive backplate', () => {
  for (const backdrop of [[255, 255, 255], [0, 0, 0], [120, 120, 120], [20, 70, 150], [200, 40, 20]]) {
    for (const custom of [null, [255, 255, 0], [118, 118, 118], [0, 0, 0], [255, 255, 255], [255, 0, 0]]) {
      const result = buttonColors(backdrop, custom); assert(contrast(result.icon, result.surface) >= 3);
      if (custom) assert.deepEqual(result.icon, custom);
    }
  }
});
test('sampling honors centered cover, contain, original, scale-down and stretch geometry', () => {
  const box = { x: 0, y: 0, width: 1200, height: 900 }, size = { width: 600, height: 300 };
  assert.deepEqual(imageContentRect(box, size, 'cover'), { x: -300, y: 0, width: 1800, height: 900 });
  assert.deepEqual(imageContentRect(box, size, 'contain'), { x: 0, y: 150, width: 1200, height: 600 });
  for (const fit of ['none', 'scale-down']) assert.deepEqual(imageContentRect(box, size, fit), { x: 300, y: 300, width: 600, height: 300 });
  const domRect = Object.create({}, Object.fromEntries(Object.entries(box).map(([key, value]) => [key, { get: () => value }])));
  assert.deepEqual(imageContentRect(domRect, size, 'fill'), box);
});
