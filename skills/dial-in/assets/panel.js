// dial-in panel. A dev-only <script type="module"> tag loads this file from the tweak server.
//
// For each manifest in <project>/.tweaks/, it mounts one Tweakpane panel for the element
// that matches `manifest.target`. The panels float as small resizable windows next to their
// target, or dock full-size to the left, bottom, or right of the window. Every change shows live and auto-saves.
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

const DOCK_SIZE = 320; // floating width, docked width (left/right) or height (bottom)

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
  display: flex; flex-direction: column; width: ${DOCK_SIZE}px; overflow: hidden;
  font: 12px/1.4 var(--di-font); font-variant-numeric: tabular-nums; color: var(--di-fg);
  background: var(--di-bg);
  --tp-base-font-family: var(--di-font);
  --tp-blade-value-width: 180px;
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

/* Floating: a small window next to the target. Drag it by the header, resize it by the corner. */
.dial-in-host[data-dock="float"] .dial-in {
  position: fixed; z-index: 2147483000; resize: both;
  min-width: 260px; min-height: 120px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
  border: 1px solid var(--di-border); border-radius: 10px; box-shadow: var(--di-shadow);
}
.dial-in-host[data-dock="float"] .dial-in-foot { padding-bottom: 14px; }
.dial-in-host[data-dock="float"] .dial-in.is-collapsed { height: auto !important; min-height: 0; resize: none; }

/* Docked: one bar on a window edge, panels stacked inside it. */
.dial-in-host:not([data-dock="float"]) {
  position: fixed; z-index: 2147483000; display: flex; overflow: auto;
  background: var(--di-bg); box-shadow: var(--di-shadow);
}
.dial-in-host[data-dock="left"], .dial-in-host[data-dock="right"] {
  top: 0; bottom: 0; width: ${DOCK_SIZE}px; flex-direction: column;
}
.dial-in-host[data-dock="left"] { left: 0; border-right: 1px solid var(--di-border); }
.dial-in-host[data-dock="right"] { right: 0; border-left: 1px solid var(--di-border); }
.dial-in-host[data-dock="bottom"] {
  left: 0; right: 0; bottom: 0; height: ${DOCK_SIZE}px; flex-direction: row;
  border-top: 1px solid var(--di-border);
}
.dial-in-host:not([data-dock="float"]) .dial-in { flex: 1 0 auto; width: auto !important; height: auto !important; }
.dial-in-host[data-dock="left"] .dial-in + .dial-in,
.dial-in-host[data-dock="right"] .dial-in + .dial-in { border-top: 1px solid var(--di-border); }
.dial-in-host[data-dock="bottom"] .dial-in { flex: 1 0 ${DOCK_SIZE}px; height: 100% !important; }
.dial-in-host[data-dock="bottom"] .dial-in + .dial-in { border-left: 1px solid var(--di-border); }

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
.dial-in-title { flex: none; max-width: 120px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dial-in-grip { flex: 1; align-self: stretch; margin: 2px 6px; min-width: 16px; }
.dial-in-host[data-dock="float"] .dial-in-head { cursor: grab; }
.dial-in-host[data-dock="float"] .dial-in-head:active { cursor: grabbing; }
.dial-in-host[data-dock="float"] .dial-in-grip {
  background-image: radial-gradient(circle, var(--di-dots) 1px, transparent 1.5px);
  background-size: 6px 6px; background-position: center;
}
.dial-in-dock { display: flex; }
.dial-in .dial-in-dock button[aria-checked="true"] { color: var(--di-accent); }

.dial-in-bar { display: flex; align-items: center; gap: 4px; padding: 0 6px 8px 6px; border-bottom: 1px solid var(--di-border); }
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
.dial-in.is-collapsed .dial-in-bar, .dial-in.is-collapsed .dial-in-body,
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

const outline = h('div', { className: 'dial-in-outline' });
const host = h('div', { className: 'dial-in-host' });
document.body.append(outline, host);

// ---------------------------------------------------------------------------
// Dock mode. Docking pads the page so the panel never covers it, like DevTools.

const docks = new Set(); // every panel's dock switcher, kept in sync
const pageStyle = document.documentElement.style;
const pagePadding = { left: pageStyle.paddingLeft, right: pageStyle.paddingRight, bottom: pageStyle.paddingBottom };
let dock = DOCK_MODES.includes(readLocal('dock')) ? readLocal('dock') : 'float';

function setDock(next) {
  dock = next;
  host.dataset.dock = dock;
  writeLocal('dock', dock);
  for (const side of ['left', 'right', 'bottom']) {
    const prop = `padding${side[0].toUpperCase()}${side.slice(1)}`;
    pageStyle[prop] = dock === side ? `${DOCK_SIZE}px` : pagePadding[side];
  }
  for (const sync of docks) sync();
}

// ---------------------------------------------------------------------------
// One panel per manifest

async function mount(manifest) {
  const { id, controls } = manifest;
  const originals = originalsOf(controls);
  const signature = JSON.stringify(originals);

  // Restore earlier tweaks, unless the agent scaffolded new original values since.
  // The panel position is kept either way.
  const saved = readLocal(id) || {};
  let stored = saved.signature === signature ? saved.values : null;
  if (!stored) {
    stored = await api(`/values/${id}`)
      .then((r) => (r.signature === signature ? r.values : null))
      .catch(() => null);
  }
  const params = startValues(originals, stored);

  let mode = 'b'; // b = tweaked, a = original
  let pos = saved.pos || null;
  let target = null;

  // Header: title, drag grip, dock switcher, collapse.
  const title = h('span', { className: 'dial-in-title', textContent: id, title: manifest.target });
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
  const syncDock = () => dockButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.dock === dock)));
  docks.add(syncDock);
  syncDock();
  const foldButton = iconButton('dial-in-icon dial-in-fold', 'minus', 'Collapse the panel');
  const head = h('div', { className: 'dial-in-head' }, [title, grip, dockGroup, foldButton]);

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
  const note = h('div', { className: 'dial-in-note' });
  const sendButton = h('button', { className: 'dial-in-send', textContent: 'Send to agent', title: 'Send the values to the agent to write into source' });
  const foot = h('div', { className: 'dial-in-foot' }, [sendButton]);
  const root = h('div', { className: 'dial-in' }, [head, bar, body, note, foot]);
  root.dataset.dialInPanel = id;
  if (saved.size) Object.assign(root.style, { width: `${saved.size.width}px`, height: `${saved.size.height}px` });
  host.append(root);

  // Remember the size after the user resizes a floating panel by its corner.
  let sizeTimer;
  new ResizeObserver(() => {
    if (dock !== 'float' || root.classList.contains('is-collapsed') || !root.style.height) return;
    clearTimeout(sizeTimer);
    // Read the inline size the resize handle sets, not the rendered size, so a small window
    // (max-height clamps the panel) does not overwrite the size the user chose.
    const size = { width: parseFloat(root.style.width), height: parseFloat(root.style.height) };
    sizeTimer = setTimeout(() => patchLocal(id, { size }), 150);
  }).observe(root);

  // Pane
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
      // Preset curves under the editor.
      const presets = h('div', { className: 'dial-in-presets' });
      presets.setAttribute('role', 'group');
      presets.setAttribute('aria-label', `${label} presets`);
      for (const preset of EASING_PRESETS) {
        const button = h('button', { textContent: preset.name, title: `cubic-bezier(${preset.value.join(', ')})` });
        button.dataset.preset = preset.name;
        button.addEventListener('click', () => (view.value = new Essentials.CubicBezier(...preset.value)));
        presets.append(button);
      }
      // Inside the blade's value column, so Tweakpane's own row order stays intact.
      (view.element.querySelector('.tp-lblv_v') ?? view.element).append(presets);
      const sync = () => {
        const active = matchPreset(params[key]);
        for (const b of presets.children) b.setAttribute('aria-pressed', String(b.dataset.preset === active));
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

  // Mark changed controls with a dot so the delta is visible without the toggle.
  function markChanged() {
    for (const { view, label, control } of Object.values(views)) {
      view.label = same(params[control.key], originals[control.key]) ? label : `${label} •`;
    }
    for (const sync of presetSyncs) sync();
  }

  let saveTimer;
  function save() {
    patchLocal(id, { signature, values: params });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (sent) return;
      api(`/values/${id}`, { values: params, signature }).catch(() => {
        if (!sent) note.textContent = 'Tweak server unreachable. Values are kept in this browser.';
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
    pane.disabled = mode === 'a';
    note.textContent = mode === 'a' ? 'Showing the original. Switch to Tweaked to keep editing.' : '';
    applyToPage(id, controls, mode === 'a' ? originals : params);
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
    setMode(ev.key === 'ArrowLeft' ? 'a' : 'b');
    (mode === 'a' ? originalOption : tweakedOption).focus();
  });
  resetButton.addEventListener('click', reset);
  foldButton.addEventListener('click', () => {
    const collapsed = root.classList.toggle('is-collapsed');
    const label = collapsed ? 'Expand the panel' : 'Collapse the panel';
    foldButton.innerHTML = ICONS[collapsed ? 'plus' : 'minus'];
    foldButton.title = label;
    foldButton.setAttribute('aria-label', label);
  });
  copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify({ id, values: params }, null, 2));
    copyButton.innerHTML = `${ICONS.check}<span>Copied</span>`;
    setTimeout(() => (copyButton.innerHTML = `${ICONS.copy}<span>JSON</span>`), 1200);
  });
  sendButton.addEventListener('click', sendAll);

  // Dragging the header moves a floating panel. Double-click the header to snap back.
  head.addEventListener('pointerdown', (ev) => {
    if (dock !== 'float' || ev.target.closest('button')) return;
    const start = { x: ev.clientX, y: ev.clientY, left: root.offsetLeft, top: root.offsetTop };
    head.setPointerCapture(ev.pointerId);
    const move = (e) => {
      pos = { left: start.left + e.clientX - start.x, top: start.top + e.clientY - start.y };
      place();
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      if (pos) patchLocal(id, { pos });
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
  head.addEventListener('dblclick', (ev) => {
    if (dock !== 'float' || ev.target.closest('button')) return;
    pos = null;
    patchLocal(id, { pos: null });
  });

  // Show which element this panel tweaks.
  head.addEventListener('pointerenter', () => (outline.dataset.for = id));
  head.addEventListener('pointerleave', () => delete outline.dataset.for);

  // Follow the target through scroll, resize, and hot reloads.
  function place() {
    if (!target?.isConnected) target = document.querySelector(manifest.target);
    root.style.display = target ? '' : 'none';
    if (dock === 'float' && (pos || target)) {
      const { left, top } = placePanel({
        rect: target?.getBoundingClientRect(),
        panel: { width: root.offsetWidth, height: root.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dragged: pos,
      });
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
    } else {
      root.style.left = '';
      root.style.top = '';
    }
    if (target && outline.dataset.for === id) {
      const r = target.getBoundingClientRect();
      Object.assign(outline.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    } else if (!outline.dataset.for) {
      outline.style.display = 'none';
    }
  }
  (function loop() {
    place();
    requestAnimationFrame(loop);
  })();

  store.panels.push({
    id,
    values: () => clone(params),
    cancelSave: () => clearTimeout(saveTimer),
    lock(message) {
      root.classList.add('is-done');
      pane.disabled = true;
      note.textContent = message;
    },
    unlock(message) {
      root.classList.remove('is-done');
      pane.disabled = mode === 'a';
      note.textContent = message;
    },
  });

  markChanged();
  setMode('b');
}

// "Send to agent" sends every panel on the page at once.
let sent = false;
async function sendAll() {
  if (sent) return;
  sent = true;
  for (const panel of store.panels) panel.cancelSave();
  try {
    await api('/confirm', { values: store.export() });
    for (const panel of store.panels) panel.lock('Sent to agent ✓ The agent is writing your values.');
  } catch (err) {
    sent = false;
    // fetch() throws a TypeError when nothing listens on the port: the server has stopped.
    const message =
      err instanceof TypeError
        ? 'The tweak server is not running, so the agent cannot get your values. Click JSON and paste them in chat.'
        : `The tweak server refused the values (${err.message}). Click JSON and paste them in chat.`;
    for (const panel of store.panels) panel.unlock(message);
  }
}

// ---------------------------------------------------------------------------

setDock(dock);
const manifests = await api('/manifests').catch((err) => {
  console.warn('[dial-in] Could not load manifests:', err);
  return [];
});
if (!manifests.length) console.warn('[dial-in] No manifests in .tweaks/. Nothing to dial in.');
for (const manifest of manifests) await mount(manifest);
store.ready = true;
window.dispatchEvent(new CustomEvent('dial-in:ready'));
