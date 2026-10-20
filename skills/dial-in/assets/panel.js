// dial-in panel. A dev-only <script type="module"> tag loads this file from the tweak server.
//
// One window holds every manifest in <project>/.tweaks/, one tab per target. The window
// floats (resizable, placed anywhere) or docks to the left, bottom, or right of the
// browser window. Every change shows live and auto-saves.
// "Send to agent" tells the server to exit, which wakes the agent.

const BASE = new URL('.', import.meta.url);
const SERVER = BASE.origin;
const { Pane } = await import(new URL('vendor/tweakpane.min.js', BASE).href);
const Essentials = await import(new URL('vendor/tweakpane-plugin-essentials.min.js', BASE).href);
const { varName, clone, same, cssValue, originalsOf, startValues, ghostPercent, placePanel, EASING_PRESETS, matchPreset, DOCK_MODES } =
  await import(new URL('core.js', BASE).href);

// ---------------------------------------------------------------------------
// Live store. App code reads JS values with:
//   globalThis.__tweak?.(id, key, original) ?? original
// and re-reads them on the `tweak` window event.

const store = (window.__dialIn ??= { live: {}, panels: [] });
window.__tweak = (id, key, fallback) => {
  const value = store.live[id]?.[key];
  return value === undefined ? fallback : value;
};
store.export = () => Object.fromEntries(store.panels.map((p) => [p.id, p.values()]));

// Push values to the page: CSS custom properties on :root, JS values to the store.
function applyToPage(id, controls, values) {
  store.live[id] ??= {};
  for (const control of controls) {
    const value = values[control.key];
    if (control.kind === 'js') {
      store.live[id][control.key] = clone(value);
      window.dispatchEvent(new CustomEvent('tweak', { detail: { id, key: control.key, value } }));
    } else {
      document.documentElement.style.setProperty(varName(id, control.key), cssValue(control, value));
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence: localStorage for this browser, the server file for the agent.

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(`dial-in:${key}`) || 'null');
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(`dial-in:${key}`, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage. The server file still has the values.
  }
}

const patchLocal = (key, patch) => writeLocal(key, { ...readLocal(key), ...patch });

async function api(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Icons (Lucide, ISC license). 16px, stroke follows the text color.

const svg = (paths) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  float: svg('<rect width="14" height="14" x="7" y="7" rx="2"/><path d="M7 11h14"/><path d="M17 3H5a2 2 0 0 0-2 2v12"/>'),
  left: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'),
  bottom: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/>'),
  right: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>'),
};
const DOCK_LABELS = { float: 'Undock into a floating panel', left: 'Dock to left', bottom: 'Dock to bottom', right: 'Dock to right' };

// ---------------------------------------------------------------------------
// Styles

const FLOAT_WIDTH = 360; // default floating width
const DOCK_SIDE = 360; // docked width, left or right
const DOCK_BOTTOM = 320; // docked height, bottom

const style = document.createElement('style');
style.dataset.dialIn = '';
style.textContent = `
.dial-in-host {
  --di-bg: #ffffff; --di-fg: #18181b; --di-muted: #71717a; --di-border: #e4e4e7;
  --di-subtle: #f4f4f5; --di-hover: #e4e4e7; --di-primary: #18181b; --di-primary-fg: #fafafa;
  --di-accent: #2563eb; --di-dots: #d4d4d8;
  --di-shadow: 0 8px 24px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06);
  --di-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .dial-in-host {
    --di-bg: #18181b; --di-fg: #fafafa; --di-muted: #a1a1aa; --di-border: #3f3f46;
    --di-subtle: #27272a; --di-hover: #3f3f46; --di-primary: #fafafa; --di-primary-fg: #18181b;
    --di-accent: #60a5fa; --di-dots: #52525b;
    --di-shadow: 0 8px 24px rgba(0,0,0,.45);
  }
}
.dial-in {
  position: fixed; z-index: 2147483000; display: flex; flex-direction: column; overflow: hidden;
  font: 12px/1.4 var(--di-font); font-variant-numeric: tabular-nums; color: var(--di-fg);
  background: var(--di-bg); box-shadow: var(--di-shadow);
  --tp-base-font-family: var(--di-font);
  --tp-blade-value-width: 200px;
  --tp-base-background-color: var(--di-bg);
  --tp-base-shadow-color: transparent;
  --tp-button-background-color: var(--di-hover);
  --tp-button-background-color-hover: var(--di-border);
  --tp-button-background-color-focus: var(--di-border);
  --tp-button-background-color-active: var(--di-muted);
  --tp-button-foreground-color: var(--di-fg);
  --tp-container-background-color: var(--di-subtle);
  --tp-container-background-color-hover: var(--di-hover);
  --tp-container-background-color-focus: var(--di-hover);
  --tp-container-background-color-active: var(--di-border);
  --tp-container-foreground-color: var(--di-fg);
  --tp-input-background-color: var(--di-subtle);
  --tp-input-background-color-hover: var(--di-hover);
  --tp-input-background-color-focus: var(--di-hover);
  --tp-input-background-color-active: var(--di-border);
  --tp-input-foreground-color: var(--di-fg);
  --tp-label-foreground-color: var(--di-muted);
  --tp-monitor-background-color: var(--di-subtle);
  --tp-monitor-foreground-color: var(--di-muted);
  --tp-groove-foreground-color: var(--di-border);
}

/* Floating: a resizable window, placed anywhere. Drag it by the header, resize it by the corner. */
.dial-in-host[data-dock="float"] .dial-in {
  width: ${FLOAT_WIDTH}px; resize: both;
  min-width: 280px; min-height: 120px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
  border: 1px solid var(--di-border); border-radius: 10px;
}
.dial-in-host[data-dock="float"] .dial-in-foot { padding-bottom: 14px; }
.dial-in-host[data-dock="float"] .dial-in.is-collapsed { height: auto !important; min-height: 0; resize: none; }

/* Docked: pinned to a browser-window edge, full length. */
.dial-in-host:not([data-dock="float"]) .dial-in { left: auto; top: auto; right: auto; bottom: auto; }
.dial-in-host[data-dock="left"] .dial-in, .dial-in-host[data-dock="right"] .dial-in {
  top: 0; bottom: 0; width: ${DOCK_SIDE}px !important; height: auto !important;
}
.dial-in-host[data-dock="left"] .dial-in { left: 0; border-right: 1px solid var(--di-border); }
.dial-in-host[data-dock="right"] .dial-in { right: 0; border-left: 1px solid var(--di-border); }
.dial-in-host[data-dock="bottom"] .dial-in {
  left: 0; right: 0; bottom: 0; width: auto !important; height: ${DOCK_BOTTOM}px !important;
  border-top: 1px solid var(--di-border);
}

.dial-in, .dial-in * { box-sizing: border-box; }
.dial-in button {
  all: unset; box-sizing: border-box; cursor: pointer; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  padding: 4px 8px; font: inherit; font-weight: 500; color: var(--di-muted); white-space: nowrap;
}
.dial-in button svg { flex: none; }
.dial-in button:hover { background: var(--di-subtle); color: var(--di-fg); }
.dial-in button:focus-visible { outline: 2px solid var(--di-muted); outline-offset: 1px; }
.dial-in .dial-in-icon { padding: 4px; }

.dial-in-head { display: flex; align-items: center; gap: 2px; padding: 6px 6px 6px 12px; user-select: none; }
.dial-in-title { flex: none; max-width: 160px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dial-in-grip { flex: 1; align-self: stretch; margin: 2px 6px; min-width: 16px; }
.dial-in-host[data-dock="float"] .dial-in-head { cursor: grab; }
.dial-in-host[data-dock="float"] .dial-in-head:active { cursor: grabbing; }
.dial-in-host[data-dock="float"] .dial-in-grip {
  background-image: radial-gradient(circle, var(--di-dots) 1px, transparent 1.5px);
  background-size: 6px 6px; background-position: center;
}
.dial-in-dock { display: flex; }
.dial-in .dial-in-dock button[aria-checked="true"] { color: var(--di-accent); }

.dial-in-tabs {
  display: flex; gap: 2px; padding: 0 8px; overflow-x: auto; scrollbar-width: none;
  border-bottom: 1px solid var(--di-border);
}
.dial-in-tabs[hidden] { display: none; }
.dial-in .dial-in-tabs button { flex: none; border-radius: 0; padding: 6px 8px; margin-bottom: -1px; border-bottom: 2px solid transparent; }
.dial-in .dial-in-tabs button:hover { background: transparent; }
.dial-in .dial-in-tabs button[aria-selected="true"] { color: var(--di-fg); border-bottom-color: var(--di-fg); }
.dial-in .dial-in-tabs button[data-changed]::after { content: "•"; margin-left: 2px; }

.dial-in-sections { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dial-in-section { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dial-in-section[hidden] { display: none; }
.dial-in-bar { display: flex; align-items: center; gap: 4px; padding: 8px 6px; border-bottom: 1px solid var(--di-border); }
.dial-in-ab {
  position: relative; flex: 1; display: grid; grid-template-columns: 1fr 1fr;
  padding: 2px; border-radius: 8px; background: var(--di-subtle);
}
.dial-in-ab::before {
  content: ""; position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc(50% - 2px);
  border-radius: 6px; background: var(--di-bg); box-shadow: 0 1px 2px rgba(0,0,0,.12);
  transition: transform 160ms cubic-bezier(.2,.8,.2,1);
}
.dial-in-ab[data-mode="b"]::before { transform: translateX(100%); }
@media (prefers-reduced-motion: reduce) { .dial-in-ab::before { transition: none; } }
.dial-in .dial-in-ab button { position: relative; padding: 3px 6px; }
.dial-in .dial-in-ab button:hover { background: transparent; }
.dial-in .dial-in-ab button[aria-checked="true"] { color: var(--di-fg); }

.dial-in-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 0; }
.dial-in.is-collapsed .dial-in-tabs, .dial-in.is-collapsed .dial-in-sections,
.dial-in.is-collapsed .dial-in-foot, .dial-in.is-collapsed .dial-in-note { display: none; }
.dial-in-note { padding: 6px 12px; color: var(--di-muted); border-top: 1px solid var(--di-border); }
.dial-in-note:empty { display: none; }
.dial-in-foot { padding: 8px; border-top: 1px solid var(--di-border); }
.dial-in .dial-in-send {
  width: 100%; padding: 8px; background: var(--di-primary); color: var(--di-primary-fg); font-weight: 600;
}
.dial-in .dial-in-send:hover { background: var(--di-primary); color: var(--di-primary-fg); opacity: .9; }
.dial-in.is-done .dial-in-foot { display: none; }

.dial-in-presets { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 6px; }
.dial-in .dial-in-presets button { padding: 2px 6px; font-size: 11px; border: 1px solid var(--di-border); }
.dial-in .dial-in-presets button[aria-pressed="true"] { background: var(--di-fg); color: var(--di-bg); border-color: var(--di-fg); }

.dial-in-ghost {
  position: absolute; top: 2px; bottom: 2px; width: 2px; margin-left: -1px;
  background: var(--di-fg); opacity: .35; border-radius: 1px; pointer-events: none;
}
.dial-in-outline {
  position: fixed; z-index: 2147482999; pointer-events: none; display: none;
  outline: 1px dashed #71717a; outline-offset: 2px; border-radius: 2px;
}
`;
document.head.appendChild(style);

function h(tag, props = {}, children = []) {
  const el = Object.assign(document.createElement(tag), props);
  for (const child of children) el.append(child);
  return el;
}

// Icon-only buttons get an aria-label. Buttons with text keep the text as their accessible name.
function iconButton(className, icon, label, text = '') {
  const button = h('button', { className, title: label, innerHTML: `${ICONS[icon]}${text ? `<span>${text}</span>` : ''}` });
  if (!text) button.setAttribute('aria-label', label);
  return button;
}

const clampToViewport = (pos, el) => ({
  left: Math.min(Math.max(pos.left, 8), Math.max(8, window.innerWidth - el.offsetWidth - 8)),
  top: Math.min(Math.max(pos.top, 8), Math.max(8, window.innerHeight - el.offsetHeight - 8)),
});

// ---------------------------------------------------------------------------
// The window: header (title or tabs, grip, dock, collapse), one section per target, footer.

const saved = readLocal('window') || {};
let dock = DOCK_MODES.includes(saved.dock) ? saved.dock : 'float';
let pos = saved.pos || null; // null = not placed yet: anchor next to the active target
const sections = []; // one per manifest
let active = null;
let status = ''; // window-level message (sending, server down); wins over section notes

const outline = h('div', { className: 'dial-in-outline' });
const host = h('div', { className: 'dial-in-host' });

const title = h('span', { className: 'dial-in-title' });
const grip = h('span', { className: 'dial-in-grip', title: 'Drag to move' });
const dockGroup = h('div', { className: 'dial-in-dock' });
dockGroup.setAttribute('role', 'radiogroup');
dockGroup.setAttribute('aria-label', 'Dock side');
const dockButtons = DOCK_MODES.map((m) => {
  const button = iconButton('dial-in-icon', m, DOCK_LABELS[m]);
  button.setAttribute('role', 'radio');
  button.dataset.dock = m;
  button.addEventListener('click', () => setDock(m));
  dockGroup.append(button);
  return button;
});
const foldButton = iconButton('dial-in-icon dial-in-fold', 'minus', 'Collapse the panel');
const head = h('div', { className: 'dial-in-head' }, [title, grip, dockGroup, foldButton]);
const tabs = h('div', { className: 'dial-in-tabs', hidden: true });
tabs.setAttribute('role', 'tablist');
tabs.setAttribute('aria-label', 'Targets');
const sectionsEl = h('div', { className: 'dial-in-sections' });
const note = h('div', { className: 'dial-in-note' });
note.setAttribute('role', 'status');
const sendButton = h('button', { className: 'dial-in-send', textContent: 'Send to agent', title: 'Send the values to the agent to write into source' });
const foot = h('div', { className: 'dial-in-foot' }, [sendButton]);
const root = h('div', { className: 'dial-in' }, [head, tabs, sectionsEl, note, foot]);
if (saved.size) Object.assign(root.style, { width: `${saved.size.width}px`, height: `${saved.size.height}px` });
host.append(root);
document.body.append(outline, host);

const saveWindow = (patch) => patchLocal('window', patch);

function renderNote() {
  note.textContent = status || (active?.mode() === 'a' ? 'Showing the original. Switch to Tweaked to keep editing.' : '');
}

function setStatus(message) {
  status = message;
  renderNote();
}

// Dock mode. Docking pads the page so the window never covers it, like DevTools.
const pageStyle = document.documentElement.style;
const pagePadding = { left: pageStyle.paddingLeft, right: pageStyle.paddingRight, bottom: pageStyle.paddingBottom };
const DOCK_PADDING = { left: DOCK_SIDE, right: DOCK_SIDE, bottom: DOCK_BOTTOM };

function setDock(next) {
  dock = next;
  host.dataset.dock = dock;
  saveWindow({ dock });
  for (const side of ['left', 'right', 'bottom']) {
    const prop = `padding${side[0].toUpperCase()}${side.slice(1)}`;
    pageStyle[prop] = dock === side ? `${DOCK_PADDING[side]}px` : pagePadding[side];
  }
  for (const b of dockButtons) b.setAttribute('aria-checked', String(b.dataset.dock === dock));
  place();
}

// Floating position. The window opens next to the active target, then stays where the user puts it.
function anchorPosition() {
  const target = active && document.querySelector(active.target);
  if (!target) return null;
  return placePanel({
    rect: target.getBoundingClientRect(),
    panel: { width: root.offsetWidth, height: root.offsetHeight },
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });
}

function place() {
  if (dock !== 'float') {
    root.style.left = root.style.top = '';
    return;
  }
  const at = pos ?? anchorPosition() ?? { left: window.innerWidth - root.offsetWidth - 8, top: 8 };
  const { left, top } = clampToViewport(at, root);
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
}

// Anchor once, as soon as the target renders (it may render after the panel loads).
// After that the window stays put: it never follows the target on scroll.
(function settle() {
  if (pos) return;
  const at = dock === 'float' ? anchorPosition() : null;
  if (at) pos = at;
  place();
  if (!pos) requestAnimationFrame(settle);
})();
window.addEventListener('resize', place);

// Drag the header to move the floating window anywhere. Double-click it to snap back next to the target.
head.addEventListener('pointerdown', (ev) => {
  if (dock !== 'float' || ev.target.closest('button')) return;
  const start = { x: ev.clientX, y: ev.clientY, left: root.offsetLeft, top: root.offsetTop };
  head.setPointerCapture(ev.pointerId);
  const move = (e) => {
    pos = clampToViewport({ left: start.left + e.clientX - start.x, top: start.top + e.clientY - start.y }, root);
    place();
  };
  const up = () => {
    head.removeEventListener('pointermove', move);
    head.removeEventListener('pointerup', up);
    if (pos) saveWindow({ pos });
  };
  head.addEventListener('pointermove', move);
  head.addEventListener('pointerup', up);
});
head.addEventListener('dblclick', (ev) => {
  if (dock !== 'float' || ev.target.closest('button')) return;
  pos = anchorPosition();
  saveWindow({ pos });
  place();
});

// Remember the size after the user resizes the floating window by its corner.
let sizeTimer;
new ResizeObserver(() => {
  if (dock !== 'float' || root.classList.contains('is-collapsed') || !root.style.height) return;
  // Read the inline size the resize handle sets, not the rendered size, so a small browser
  // window (max-height clamps the panel) does not overwrite the size the user chose.
  const size = { width: parseFloat(root.style.width), height: parseFloat(root.style.height) };
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(() => saveWindow({ size }), 150);
}).observe(root);

foldButton.addEventListener('click', () => {
  const collapsed = root.classList.toggle('is-collapsed');
  const label = collapsed ? 'Expand the panel' : 'Collapse the panel';
  foldButton.innerHTML = ICONS[collapsed ? 'plus' : 'minus'];
  foldButton.title = label;
  foldButton.setAttribute('aria-label', label);
});

// Outline the target while the pointer is on its tab, or on the header for the active target.
let outlined = null;
function showOutline(section) {
  outlined = section;
  (function follow() {
    if (outlined !== section) return;
    const target = document.querySelector(section.target);
    if (target) {
      const r = target.getBoundingClientRect();
      Object.assign(outline.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    } else {
      outline.style.display = 'none';
    }
    requestAnimationFrame(follow);
  })();
}
function hideOutline() {
  outlined = null;
  outline.style.display = 'none';
}
head.addEventListener('pointerenter', () => active && showOutline(active));
head.addEventListener('pointerleave', hideOutline);

function activate(section) {
  active = section;
  for (const s of sections) {
    s.el.hidden = s !== section;
    s.tab.setAttribute('aria-selected', String(s === section));
    s.tab.tabIndex = s === section ? 0 : -1;
  }
  title.textContent = sections.length > 1 ? 'dial-in' : section.id;
  title.title = sections.length > 1 ? '' : section.target;
  saveWindow({ active: section.id });
  renderNote();
}

tabs.addEventListener('keydown', (ev) => {
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  ev.preventDefault();
  const i = sections.indexOf(active) + (ev.key === 'ArrowRight' ? 1 : -1);
  const next = sections[(i + sections.length) % sections.length];
  activate(next);
  next.tab.focus();
});

// ---------------------------------------------------------------------------
// One section (and tab) per manifest

async function addSection(manifest) {
  const { id, controls } = manifest;
  const originals = originalsOf(controls);
  const signature = JSON.stringify(originals);

  // Restore earlier tweaks, unless the agent scaffolded new original values since.
  const local = readLocal(id) || {};
  let stored = local.signature === signature ? local.values : null;
  if (!stored) {
    stored = await api(`/values/${id}`)
      .then((r) => (r.signature === signature ? r.values : null))
      .catch(() => null);
  }
  const params = startValues(originals, stored);
  let mode = 'b'; // b = tweaked, a = original

  const tab = h('button', { textContent: id, title: manifest.target });
  tab.setAttribute('role', 'tab');
  tab.id = `dial-in-tab-${id}`;
  tab.setAttribute('aria-controls', `dial-in-section-${id}`);
  tabs.append(tab);

  // Toolbar: Original / Tweaked toggle, Reset, JSON.
  const originalOption = h('button', { textContent: 'Original', title: 'Show the original values' });
  const tweakedOption = h('button', { textContent: 'Tweaked', title: 'Show your values' });
  for (const [option, value] of [[originalOption, 'a'], [tweakedOption, 'b']]) {
    option.setAttribute('role', 'radio');
    option.dataset.value = value;
  }
  const abToggle = h('div', { className: 'dial-in-ab' }, [originalOption, tweakedOption]);
  abToggle.setAttribute('role', 'radiogroup');
  abToggle.setAttribute('aria-label', 'Compare with the original');
  const resetButton = iconButton('dial-in-reset', 'reset', 'Reset every control to its original value', 'Reset');
  const copyButton = iconButton('dial-in-copy', 'copy', 'Copy the values as JSON, to paste in chat', 'JSON');
  const bar = h('div', { className: 'dial-in-bar' }, [abToggle, resetButton, copyButton]);
  const body = h('div', { className: 'dial-in-body' });
  const el = h('div', { className: 'dial-in-section', id: `dial-in-section-${id}` }, [bar, body]);
  el.dataset.dialInPanel = id;
  el.setAttribute('role', 'tabpanel');
  el.setAttribute('aria-labelledby', tab.id);
  sectionsEl.append(el);

  const pane = new Pane({ container: body });
  pane.registerPlugin(Essentials);
  const views = {};
  const presetSyncs = [];

  for (const control of controls) {
    const { key, type } = control;
    const label = control.label ?? key;
    let view;
    if (type === 'cubic-bezier') {
      view = pane.addBlade({ view: 'cubicbezier', value: params[key], label, expanded: true, picker: 'inline' });
      view.on('change', (ev) => {
        params[key] = ev.value.toObject();
        changed();
      });
      // Preset curves, inside the blade's value column so Tweakpane's own row order stays intact.
      const presets = h('div', { className: 'dial-in-presets' });
      presets.setAttribute('role', 'group');
      presets.setAttribute('aria-label', `${label} presets`);
      for (const preset of EASING_PRESETS) {
        const button = h('button', { textContent: preset.name, title: `cubic-bezier(${preset.value.join(', ')})` });
        button.dataset.preset = preset.name;
        button.addEventListener('click', () => (view.value = new Essentials.CubicBezier(...preset.value)));
        presets.append(button);
      }
      (view.element.querySelector('.tp-lblv_v') ?? view.element).append(presets);
      const sync = () => {
        const current = matchPreset(params[key]);
        for (const b of presets.children) b.setAttribute('aria-pressed', String(b.dataset.preset === current));
      };
      presetSyncs.push(sync);
      sync();
    } else {
      const options = { label };
      if (type === 'number') Object.assign(options, { min: control.min, max: control.max, step: control.step });
      if (type === 'color') Object.assign(options, { view: 'color', color: { alpha: !!control.alpha } });
      if (type === 'select') options.options = Object.fromEntries(control.options.map((o) => [o.label ?? String(o.value), o.value]));
      if (type === 'point') {
        const axis = { min: control.min, max: control.max, step: control.step };
        Object.assign(options, { x: axis, y: axis, picker: 'inline', expanded: false });
      }
      view = pane.addBinding(params, key, options);
      view.on('change', () => changed());
    }
    views[key] = { control, view, label };

    // Ghost marker: a tick on the slider track at the original value.
    if (type === 'number' && control.min !== undefined && control.max !== undefined) {
      const track = view.element.querySelector('.tp-sldv_t');
      if (track) {
        track.appendChild(
          h('div', {
            className: 'dial-in-ghost',
            title: `original: ${cssValue(control, originals[key])}`,
            style: `left: ${ghostPercent(control, originals[key])}%`,
          }),
        );
      }
    }
  }

  // Mark changed controls (and the tab) with a dot so the delta is visible without the toggle.
  function markChanged() {
    let any = false;
    for (const { view, label, control } of Object.values(views)) {
      const isSame = same(params[control.key], originals[control.key]);
      any ||= !isSame;
      view.label = isSame ? label : `${label} •`;
    }
    tab.toggleAttribute('data-changed', any);
    for (const sync of presetSyncs) sync();
  }

  let saveTimer;
  function save() {
    patchLocal(id, { signature, values: params });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (sent) return;
      api(`/values/${id}`, { values: params, signature }).catch(() => {
        if (!sent) setStatus('Tweak server unreachable. Values are kept in this browser.');
      });
    }, 300);
  }

  function changed() {
    if (mode === 'b') applyToPage(id, controls, params);
    markChanged();
    save();
  }

  function setMode(next) {
    mode = next;
    abToggle.dataset.mode = mode;
    originalOption.setAttribute('aria-checked', String(mode === 'a'));
    tweakedOption.setAttribute('aria-checked', String(mode === 'b'));
    originalOption.tabIndex = mode === 'a' ? 0 : -1;
    tweakedOption.tabIndex = mode === 'b' ? 0 : -1;
    pane.disabled = mode === 'a' || sent;
    applyToPage(id, controls, mode === 'a' ? originals : params);
    renderNote();
  }

  function reset() {
    for (const { control, view } of Object.values(views)) {
      params[control.key] = clone(originals[control.key]);
      if (control.type === 'cubic-bezier') view.value = new Essentials.CubicBezier(...originals[control.key]);
    }
    pane.refresh();
    changed();
  }

  originalOption.addEventListener('click', () => setMode('a'));
  tweakedOption.addEventListener('click', () => setMode('b'));
  abToggle.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    ev.stopPropagation();
    setMode(ev.key === 'ArrowLeft' ? 'a' : 'b');
    (mode === 'a' ? originalOption : tweakedOption).focus();
  });
  resetButton.addEventListener('click', reset);
  copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify({ id, values: params }, null, 2));
    copyButton.innerHTML = `${ICONS.check}<span>Copied</span>`;
    setTimeout(() => (copyButton.innerHTML = `${ICONS.copy}<span>JSON</span>`), 1200);
  });

  const section = {
    id,
    target: manifest.target,
    el,
    tab,
    mode: () => mode,
    values: () => clone(params),
    cancelSave: () => clearTimeout(saveTimer),
    setDisabled: (disabled) => (pane.disabled = disabled || mode === 'a'),
  };
  tab.addEventListener('click', () => activate(section));
  tab.addEventListener('pointerenter', () => showOutline(section));
  tab.addEventListener('pointerleave', hideOutline);
  sections.push(section);
  store.panels.push(section);

  markChanged();
  setMode('b');
}

// "Send to agent" sends every target at once.
let sent = false;
async function sendAll() {
  if (sent) return;
  sent = true;
  for (const s of sections) s.cancelSave();
  try {
    await api('/confirm', { values: store.export() });
    root.classList.add('is-done');
    for (const s of sections) s.setDisabled(true);
    setStatus('Sent to agent ✓ The agent is writing your values.');
  } catch (err) {
    sent = false;
    // fetch() throws a TypeError when nothing listens on the port: the server has stopped.
    setStatus(
      err instanceof TypeError
        ? 'The tweak server is not running, so the agent cannot get your values. Click JSON and paste them in chat.'
        : `The tweak server refused the values (${err.message}). Click JSON and paste them in chat.`,
    );
  }
}
sendButton.addEventListener('click', sendAll);

// ---------------------------------------------------------------------------

setDock(dock);
const manifests = await api('/manifests').catch((err) => {
  console.warn('[dial-in] Could not load manifests:', err);
  return [];
});
if (!manifests.length) {
  console.warn('[dial-in] No manifests in .tweaks/. Nothing to dial in.');
  host.remove();
} else {
  for (const manifest of manifests) await addSection(manifest);
  tabs.hidden = sections.length < 2;
  activate(sections.find((s) => s.id === saved.active) ?? sections[0]);
  place();
}
store.ready = true;
window.dispatchEvent(new CustomEvent('dial-in:ready'));
