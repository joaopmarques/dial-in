# Stacks

How to inject the panel, scaffold CSS-side knobs, and write values back, per stack. JS-side knobs live in [js-values.md](js-values.md).

## Inject the panel

The tag is always a module script pointing at the URL from `DIAL_IN_READY`, and it loads only in development:

```html
<script type="module" src="http://127.0.0.1:7777/panel.js"></script>
```

| Stack | Where | Dev-only guard |
|---|---|---|
| Plain HTML, Vite | `index.html`, before `</body>` | Dev-only by nature. Tag it `<!-- tweak-scaffold -->`. |
| Next.js App Router | `app/layout.tsx`, end of `<body>` | `{process.env.NODE_ENV === 'development' && <script … />}` |
| Next.js Pages Router | `pages/_document.tsx`, end of `<body>` | same as above |
| Remix / React Router | `app/root.tsx`, end of `<body>` | `import.meta.env.DEV` or `process.env.NODE_ENV` |
| Astro | the layout used by the page | `{import.meta.env.DEV && <script is:inline type="module" src="…"></script>}` |
| SvelteKit | `src/app.html`, before `</body>` | Dev-only by nature in a local session. Tag it. |
| Nuxt | `app.vue` | `useHead({ script: [{ type: 'module', src: '…' }] })` inside `if (import.meta.dev)` |
| Storybook | `.storybook/preview-head.html` | Storybook is dev-only. Tag it. |

If the page sends a Content-Security-Policy, the script and its `fetch` calls to `127.0.0.1:<port>` get blocked. The browser console says so. Add the origin to `script-src` and `connect-src` in the dev config as scaffold, or tell the user.

## Scaffold CSS-side knobs

Replace only the knob's part of the value. Keep the rest of the declaration as it is. The fallback is always the original concrete value, so the page looks identical before the panel loads.

**CSS, SCSS, CSS modules, Vue/Svelte `<style>`:**

```css
padding: var(--dial-card-padding, 24px); /* tweak-scaffold */
box-shadow: 0 var(--dial-card-shadowY, 8px) 24px rgb(0 0 0 / 0.12); /* tweak-scaffold */
```

Use the unit the source uses. If the source says `1.5rem`, the manifest unit is `rem` and the step is `0.125`.

**Tailwind** (v3 and v4): swap the utility for an arbitrary value. Write spaces as `_`. Keep variant prefixes (`md:`, `hover:`, `dark:`).

```
p-6           → p-[var(--dial-card-padding,24px)]
bg-indigo-600 → bg-[color:var(--dial-card-accent,#4f46e5)]
text-sm       → text-[length:var(--dial-card-size,14px)]
shadow-lg     → shadow-[0_var(--dial-card-shadowY,10px)_15px_-3px_rgb(0_0_0/0.1)]
```

Add a type hint (`color:`, `length:`) for utilities that take more than one kind of value: `text-`, `bg-`, `border-`, `ring-`, `outline-`, `stroke-`, `fill-`, `decoration-`. When the same property changes per breakpoint, each breakpoint is its own knob. Put the `tweak-scaffold` comment on the line above the JSX element (`{/* tweak-scaffold */}`) or at the end of the line where the syntax allows it.

**Inline styles and CSS-in-JS objects** (React `style`, Emotion/Stitches objects):

```tsx
padding: 'var(--dial-card-padding, 24px)', // tweak-scaffold
```

**Template-literal CSS-in-JS** (styled-components, Emotion `css```): same as plain CSS, inside the template.

## Write back

Write each changed value in the idiom the line already uses. Unchanged knobs go back to their exact `raw` text.

**CSS and CSS-in-JS:** the concrete value, in the unit and format of `raw`. Hex stays hex. `rgb()` stays `rgb()`. A number in a JS style object stays a number when React adds `px` for it.

**Tailwind:**

1. Exact match on the project's scale or theme (custom theme first, then defaults) → that utility: `p-7`, `bg-brand-500`.
2. No exact match → arbitrary value: `p-[26px]`, `bg-[#5b4ff0]`, `ease-[cubic-bezier(0.5,0.8,0.2,1)]`.

Tailwind's easing utilities have their own curves: `ease-in` is `cubic-bezier(0.4, 0, 1, 1)`, `ease-out` is `cubic-bezier(0, 0, 0.2, 1)`, `ease-in-out` is `cubic-bezier(0.4, 0, 0.2, 1)`. Match against these, not the CSS keywords.

**Easing in CSS:** write a keyword only on an exact match: `ease` `[0.25, 0.1, 0.25, 1]`, `ease-in` `[0.42, 0, 1, 1]`, `ease-out` `[0, 0, 0.58, 1]`, `ease-in-out` `[0.42, 0, 0.58, 1]`, `linear` `[0, 0, 1, 1]`. Else `cubic-bezier(…)`.

**Tokens:** when the original was a token (`var(--space-6)`, `theme.spacing[6]`), write a token on an exact match, else the concrete value.

## Near-miss flags

A value the user picked by eye stays as picked. Flag it with ⚠ in the report when it is close to a scale step or token but not on it:

- Numbers: the nearest scale/token value differs by 10% or less. `26px` next to `24px` (`p-6`) is a near-miss. `30px` is not.
- Colors: every RGB channel is within 8 of a palette or token color.

Report line: `padding: p-6 → p-[26px]  ⚠ 2px off p-6 (24px). Snap?` On "snap", rewrite the flagged values to the scale step.
