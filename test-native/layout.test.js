import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutRect, rectLayout, moveRect, resizeRect, bounds } from '../native/layout.js';
import { defaultLayout } from '../native/model.js';
const view = { width: 1200, height: 900 };
const rect = { x: 300, y: 250, width: 600, height: 56 };

test('default dimensions, normalized center and rectangle round trip', () => {
  const current = layoutRect(defaultLayout, view);
  assert.deepEqual(current, { x: 300, y: 350, width: 600, height: 56 });
  assert.deepEqual(rectLayout(current, view), defaultLayout);
});
test('viewport clamping never mutates saved layout; large screens restore size', () => {
  const saved = { cx: 1, cy: 1, width: 1000, height: 700 };
  const small = layoutRect(saved, { width: 320, height: 500 });
  assert.deepEqual(small, { x: 16, y: 16, width: 288, height: 468 });
  assert.equal(layoutRect(saved, view).width, 1000);
  assert.deepEqual(saved, { cx: 1, cy: 1, width: 1000, height: 700 });
});
test('minimum height follows text size and tiny viewports remain reachable', () => {
  assert.equal(layoutRect({ ...defaultLayout, height: 44 }, view, 32).height, 88);
  assert.equal(layoutRect({ ...defaultLayout, width: 240 }, view, 32).width, 480);
  const tiny = layoutRect(defaultLayout, { width: 200, height: 60 }, 32);
  assert(tiny.width <= 200 && tiny.height <= 60 && tiny.x >= 0 && tiny.y >= 0);
});
test('dragging clamps to all viewport edges', () => {
  const low = moveRect(rect, -10000, -10000, view);
  const high = moveRect(rect, 10000, 10000, view);
  assert.equal(low.x, 16); assert.equal(low.y, 16);
  assert.equal(high.x + high.width, 1184); assert.equal(high.y + high.height, 884);
});
for (const edge of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
  test(`resize ${edge} keeps opposite edges fixed and enforces bounds`, () => {
    const result = resizeRect(rect, edge, edge.includes('w') ? -50 : 50, edge.includes('n') ? -40 : 40, view);
    if (edge.includes('w')) assert.equal(result.x + result.width, rect.x + rect.width);
    if (edge.includes('e')) assert.equal(result.x, rect.x);
    if (edge.includes('n')) assert.equal(result.y + result.height, rect.y + rect.height);
    if (edge.includes('s')) assert.equal(result.y, rect.y);
    for (const delta of [-1e6, 1e6]) {
      const extreme = resizeRect(rect, edge, delta, delta, view);
      const b = bounds(view);
      assert(extreme.width >= b.minWidth && extreme.height >= b.minHeight);
      assert(extreme.x >= b.margin && extreme.y >= b.margin);
      assert(extreme.x + extreme.width <= view.width - b.margin);
      assert(extreme.y + extreme.height <= view.height - b.margin);
    }
  });
}
