import { t, engineLabel, getLanguage } from './i18n.js';
import { allEngines } from './engines.js';
export function createPicker({ getPrefs, paintIcon, select, canOpen, query }) {
  const menu = document.getElementById('engine-menu'), options = document.getElementById('engine-options');
  const trigger = document.getElementById('engine-button'), filter = document.getElementById('engine-filter');
  let opened = false, selection = [0, 0];
  const buttons = () => [...options.querySelectorAll('button')];
  function render() {
    const p = getPrefs(), term = filter.value.trim().toLocaleLowerCase(getLanguage());
    options.replaceChildren(); let group = '';
    for (const engine of allEngines(p.customEngines).filter(e => `${engineLabel(e)} ${e.name} ${e.id} ${t(e.group)} ${e.group}`.toLocaleLowerCase(getLanguage()).includes(term))) {
      if (group !== engine.group) {
        const label = document.createElement('div'); label.className = 'engine-group'; label.role = 'presentation';
        group = engine.group; label.textContent = t(group); options.append(label);
      }
      const button = document.createElement('button'); button.type = 'button'; button.role = 'menuitemradio';
      button.dataset.engine = engine.id; button.setAttribute('aria-checked', String(engine.id === p.engine));
      const image = document.createElement('img'); paintIcon(image, engine.id, opened); image.width = image.height = 20; image.alt = '';
      const label = document.createElement('span'); label.className = 'engine-name'; label.textContent = engineLabel(engine); label.dir = 'auto';
      const check = document.createElement('span'); check.className = 'icon icon-check'; check.setAttribute('aria-hidden', 'true');
      button.append(image, label, check); button.addEventListener('click', () => { select(engine.id); close(true); }); options.append(button);
    }
    document.getElementById('engine-empty').hidden = buttons().length > 0;
    if (opened) position();
  }
  function close(focus = false) {
    opened = false; menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (focus) { query.focus({ preventScroll: true }); try { query.setSelectionRange(...selection); } catch { /* Native search input. */ } }
  }
  function position() {
    const anchor = trigger.getBoundingClientRect(), below = innerHeight - anchor.bottom - 24, above = anchor.top - 24;
    const height = Math.min(420, Math.max(below, above));
    menu.style.maxHeight = `${Math.max(80, height)}px`;
    menu.style.width = `${Math.min(300, Math.max(1, innerWidth - 32))}px`;
    menu.style.left = `${Math.max(16, Math.min(anchor.left, innerWidth - menu.offsetWidth - 16))}px`;
    menu.style.top = `${below >= height ? anchor.bottom + 8 : Math.max(16, anchor.top - menu.offsetHeight - 8)}px`;
  }
  function open() {
    if (!canOpen()) return;
    selection = [query.selectionStart || 0, query.selectionEnd || 0]; filter.value = ''; filter.dir = document.documentElement.dir; opened = true; render();
    opened = true; menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); position();
    const current = buttons().find(button => button.dataset.engine === getPrefs().engine);
    current?.focus(); current?.scrollIntoView({ block: 'nearest' });
  }
  trigger.addEventListener('click', () => opened ? close(true) : open());
  filter.addEventListener('input', render);
  menu.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) ||
        (event.target === filter && ['Home', 'End'].includes(event.key))) return;
    event.preventDefault(); const items = buttons(); if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0) :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });
  document.addEventListener('pointerdown', event => { if (opened && !menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  menu.addEventListener('focusout', event => { if (opened && event.relatedTarget && !menu.contains(event.relatedTarget)) close(); });
  return { render, close, position, get opened() { return opened; } };
}
