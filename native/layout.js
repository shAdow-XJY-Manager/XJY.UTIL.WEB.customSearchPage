const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export function bounds(view, fontSize = 16) {
  const margin = Math.min(16, Math.max(0, (Math.min(view.width, view.height) - 1) / 2));
  const width = Math.max(1, view.width - margin * 2);
  const height = Math.max(1, view.height - margin * 2);
  return { margin, maxWidth: width, maxHeight: height, minWidth: Math.min(Math.max(240, fontSize * 15), width),
    minHeight: Math.min(Math.max(44, fontSize * 2.75), height) };
}
export function layoutRect(layout, view, fontSize = 16) {
  const b = bounds(view, fontSize);
  const width = clamp(layout.width, b.minWidth, b.maxWidth);
  const height = clamp(layout.height, b.minHeight, b.maxHeight);
  return { x: clamp(layout.cx * view.width - width / 2, b.margin, view.width - b.margin - width),
    y: clamp(layout.cy * view.height - height / 2, b.margin, view.height - b.margin - height), width, height };
}
export function sceneRects(layout, view, fontSize = 16, count = 0) {
  const search = layoutRect(layout, view, fontSize);
  if (!count) return { search, links: null, searchView: view };
  const b = bounds(view, fontSize), gap = 24;
  const cellWidth = Math.max(96, fontSize * 6);
  const width = Math.min(600, b.maxWidth, count * cellWidth);
  const columns = Math.max(1, Math.floor(width / cellWidth));
  const tile = Math.max(96, fontSize * 6);
  const height = Math.max(0, Math.min(Math.ceil(count / columns) * tile, tile * 3, view.height * .45, view.height - b.margin * 2 - b.minHeight - gap));
  if (!height) return { search, links: null, searchView: view };
  const searchView = { ...view, height: Math.max(b.margin * 2 + b.minHeight, view.height - height - gap) };
  search.height = Math.min(search.height, bounds(searchView, fontSize).maxHeight);
  search.y = clamp(search.y, b.margin, searchView.height - b.margin - search.height);
  return { search, searchView, links: { x: clamp(search.x + search.width / 2 - width / 2, b.margin, view.width - b.margin - width),
    y: search.y + search.height + gap, width, height, columns, tile } };
}
export function rectLayout(rect, view) {
  return { cx: (rect.x + rect.width / 2) / view.width, cy: (rect.y + rect.height / 2) / view.height,
    width: rect.width, height: rect.height };
}
export function moveRect(rect, dx, dy, view, fontSize = 16) {
  const b = bounds(view, fontSize);
  return { ...rect, x: clamp(rect.x + dx, b.margin, view.width - b.margin - rect.width),
    y: clamp(rect.y + dy, b.margin, view.height - b.margin - rect.height) };
}
export function resizeRect(rect, edge, dx, dy, view, fontSize = 16) {
  const b = bounds(view, fontSize);
  let left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
  if (edge.includes('w')) left = clamp(left + dx, b.margin, right - b.minWidth);
  if (edge.includes('e')) right = clamp(right + dx, left + b.minWidth, view.width - b.margin);
  if (edge.includes('n')) top = clamp(top + dy, b.margin, bottom - b.minHeight);
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + b.minHeight, view.height - b.margin);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
