import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, migratePrefs, normalizePrefs, searchUrl, argbCss, replaceRgb } from '../native/model.js';

test('target-specific defaults and saved navigation survive normalization', () => {
  assert.equal(defaults(true).newTab, false); assert.equal(defaults(false).newTab, true);
  assert.equal(normalizePrefs({ newTab: true }, true).newTab, true);
  assert.deepEqual(defaults().layout, { cx: 0.5, cy: 0.42, width: 600, height: 56 });
});
test('each search engine preserves Unicode and reserved query characters', () => {
  const query = '中文🙂 & + # %';
  for (const [index, host] of ['www.bing.com', 'www.google.com', 'www.baidu.com'].entries()) {
    const url = new URL(searchUrl(index, ` ${query} `));
    assert.equal(url.protocol, 'https:'); assert.equal(url.host, host);
    assert.deepEqual([...url.searchParams], [[index === 2 ? 'wd' : 'q', query]]); assert.equal(url.hash, '');
  }
  assert.throws(() => searchUrl(0, '  ')); assert.throws(() => searchUrl(3, 'query'));
});
test('invalid preferences and geometry safely fall back', () => {
  const normalized = normalizePrefs({ engine: 5, theme: 'bad', fit: -1, overlay: Infinity,
    colors: { page: -1 }, layout: { cx: NaN, cy: 9, width: -1, height: 0 } }, true);
  assert.deepEqual(normalized, defaults(true));
  assert.equal(normalizePrefs({ overlay: 1 }).overlay, 1);
});
test('all nine old alignments and width presets become freely editable geometry', () => {
  for (let align = 0; align < 9; align++) {
    const p = migratePrefs({ search_bar_align_option: align, search_bar_length_option: align % 3,
      engine_option: 2, is_jump_to_new_page: false, lock_or_custom_color: true, search_bar_text_color_value: 0xff112233 });
    assert.equal(p.layout.cx, (align % 3) / 2); assert.equal(p.layout.cy, Math.floor(align / 3) / 2);
    assert.equal(p.layout.width, [500, 800, 1000][align % 3]); assert.equal(p.engine, 'baidu');
    assert.equal(p.newTab, false); assert.equal(p.customColor, true); assert.equal(p.colors.text, 0xff112233);
  }
  assert.equal(migratePrefs({ is_custom_back_img: true }).overlay, 0.45);
  assert.equal(migratePrefs({}).overlay, 0);
});
test('color conversion preserves legacy alpha on native picker changes', () => {
  assert.equal(argbCss(0x80112233), '#11223380');
  assert.equal(replaceRgb(0x80112233, '#aabbcc'), 0x80aabbcc);
});
