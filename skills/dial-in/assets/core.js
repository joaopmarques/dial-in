// dial-in core. Pure functions with no DOM access, shared by panel.js and the tests.

export const varName = (id, key) => `--dial-${id}-${key}`;
export const clone = (v) => structuredClone(v);
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

// Round to the number of decimals in `step`, so 0.1 + 0.2 shows as 0.3.
export function round(value, step = 0.01) {
  const decimals = Math.max(0, (String(step).split('.')[1] || '').length);
  return Number(value.toFixed(decimals));
}

// The CSS text for a control value. See references/manifest.md for the value shapes.
export function cssValue(control, value) {
  const unit = control.unit ?? '';
  switch (control.type) {
    case 'number':
      return `${round(value, control.step)}${unit}`;
    case 'point':
      return `${round(value.x, control.step)}${unit} ${round(value.y, control.step)}${unit}`;
    case 'boolean':
      return value ? (control.on ?? '1') : (control.off ?? '0');
    case 'cubic-bezier':
      return `cubic-bezier(${value.map((n) => round(n, 0.001)).join(', ')})`;
    default:
      return String(value);
  }
}

export const originalsOf = (controls) => Object.fromEntries(controls.map((c) => [c.key, clone(c.value)]));

// Start values for a panel: the originals, overlaid with earlier tweaks for known keys.
// Keys that are no longer in the manifest are dropped.
export function startValues(originals, stored) {
  const values = clone(originals);
  for (const key of Object.keys(values)) {
    if (stored && stored[key] !== undefined) values[key] = clone(stored[key]);
  }
  return values;
}

// Where the ghost marker sits on a slider track, in percent.
export function ghostPercent(control, original) {
  return clamp(((original - control.min) / (control.max - control.min)) * 100, 0, 100);
}

// Easing presets shown under a cubic-bezier control.
// The "out-*" curves are the standard easeOut curves from easings.net.
export const EASING_PRESETS = [
  { name: 'ease-out', value: [0, 0, 0.58, 1] },
  { name: 'ease-in-out', value: [0.42, 0, 0.58, 1] },
  { name: 'linear', value: [0, 0, 1, 1] },
  { name: 'out-sine', value: [0.61, 1, 0.88, 1] },
  { name: 'out-quad', value: [0.5, 1, 0.89, 1] },
  { name: 'out-cubic', value: [0.33, 1, 0.68, 1] },
];

// The preset that matches a bezier value, or null.
export function matchPreset(value) {
  const near = (a, b) => a.every((n, i) => Math.abs(n - b[i]) < 0.005);
  return EASING_PRESETS.find((p) => near(p.value, value))?.name ?? null;
}

// Where the dock mode is valid. "float" is the full-height panel next to its target.
export const DOCK_MODES = ['float', 'left', 'bottom', 'right'];

// Floating panel position next to a target rect: right, then left, then below, then above.
// When none fits, hug the roomier viewport edge. A dragged position wins.
// The result stays `margin` px inside the viewport.
export function placePanel({ rect, panel, viewport, dragged = null, gap = 12, margin = 8 }) {
  const { width: w, height: h } = panel;
  const { width: vw, height: vh } = viewport;
  let left;
  let top;
  if (dragged) {
    ({ left, top } = dragged);
  } else if (rect.right + gap + w <= vw - margin) {
    [left, top] = [rect.right + gap, rect.top];
  } else if (rect.left - gap - w >= margin) {
    [left, top] = [rect.left - gap - w, rect.top];
  } else if (rect.bottom + gap + h <= vh - margin) {
    [left, top] = [rect.left, rect.bottom + gap];
  } else if (rect.top - gap - h >= margin) {
    [left, top] = [rect.left, rect.top - gap - h];
  } else {
    [left, top] = [vw - rect.right >= rect.left ? vw - w - margin : margin, rect.top];
  }
  return {
    left: clamp(left, margin, vw - w - margin),
    top: clamp(top, margin, vh - h - margin),
  };
}
