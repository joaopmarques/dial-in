# Manifest

One file per target: `.tweaks/<id>.manifest.json`. The panel builds its controls from it. The agent uses it again to write values back.

```json
{
  "id": "pricing-card",
  "target": "[data-tweak='pricing-card']",
  "controls": [
    { "key": "padding", "kind": "css", "type": "number", "min": 0, "max": 48, "step": 1, "unit": "px",
      "value": 24, "source": { "file": "src/PricingCard.tsx", "line": 14, "raw": "p-6" } },
    { "key": "accent", "kind": "css", "type": "color", "value": "#4f46e5",
      "source": { "file": "src/PricingCard.tsx", "line": 18, "raw": "bg-indigo-600" } },
    { "key": "ease", "kind": "css", "type": "cubic-bezier", "value": [0.2, 0.8, 0.2, 1],
      "source": { "file": "src/pricing.css", "line": 7, "raw": "ease-out" } },
    { "key": "stiffness", "kind": "js", "type": "number", "min": 50, "max": 800, "step": 10,
      "value": 300, "source": { "file": "src/PricingCard.tsx", "line": 31, "raw": "stiffness: 300" } }
  ]
}
```

## Fields

- `id`: kebab-case, max 64 characters. Also the `data-tweak` value and the CSS variable prefix.
- `target`: CSS selector for the target root. Use `[data-tweak='<id>']`.
- `key`: camelCase, unique in the manifest. The CSS variable is `--dial-<id>-<key>`.
- `label`: optional display name. Defaults to `key`.
- `kind`: `css` sets a CSS variable on `:root`. `js` updates the `__tweak` store and fires a `tweak` event.
- `value`: the original value, in the control's value shape (table below). Convert keywords and tokens to a concrete value: `p-6` → `24`, `ease-out` → `[0, 0, 0.58, 1]`, `bg-indigo-600` → `"#4f46e5"`.
- `source.raw`: the exact original text on that line. Teardown restores it verbatim.

## Control types

| `type` | Value shape | Extra fields | CSS output |
|---|---|---|---|
| `number` | `24` | `min`, `max`, `step`, `unit` | `24px` |
| `color` | `"#4f46e5"`, `"#4f46e580"`, `"rgba(…)"` | `alpha: true` for an alpha slider | as given |
| `select` | any primitive | `options: [{ "label": "Tight", "value": "1.1" }]` | `String(value)` |
| `boolean` | `true` | `on`, `off`: CSS strings for each state (default `"1"` / `"0"`) | `on` or `off` |
| `point` | `{ "x": 0, "y": 8 }` | `min`, `max`, `step`, `unit` (shared by both axes) | `0px 8px` |
| `cubic-bezier` | `[0.2, 0.8, 0.2, 1]` | — | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

For a `kind: "js"` control, the page receives the raw value shape, not the CSS output.

## Ranges

The range decides how far the user can explore. Make it generous around the original:

- Spacing, radius, size: `0` to about `2 × original` (at least `original + 16`). Step `1`.
- Opacity, alpha, ratios: `0` to `1`. Step `0.01`.
- Durations (ms): `0` to about `3 × original`. Step `10`.
- Font weight: `100` to `900`. Step `100`.
- Line height (unitless): `0.8` to `2`. Step `0.05`.
- Spring stiffness / damping: `0` to about `3 × original`.

When the project has a scale (Tailwind spacing, design tokens) and the user wants to stay on it, use a `select` with the scale steps as options instead of a `number`.
