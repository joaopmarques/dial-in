# 🎛️ dial-in

A Claude Code skill for the last 5% of a component. Some details you can only get right by eye: the radius, the shadow, the spring. Prompting for them one guess at a time is slow. Dial-in gives you sliders instead.

Ask Claude to dial in a component. A panel of live controls opens next to it in your running app. Drag until it feels right, click **Send to agent**, and Claude writes the values back to source.

## What it does

1. **Discover:** Claude picks 3 to 6 knobs from what you talked about: spacing, colors, radius, shadows, easing, durations, springs. Ask for "all controls" to pick from the full list, or ask for more knobs at any time.
2. **Scaffold:** Claude makes those values live, starts a small local server, and opens the page.
3. **Tweak:** a floating [Tweakpane](https://tweakpane.github.io/docs/) window opens next to the component, with one tab per component when there are several. Drag it anywhere by its dotted header and resize it by the corner: it stays where you put it. Or dock it to the left, bottom, or right of the browser window, like DevTools. It follows your system's light or dark theme. Every change shows live and auto-saves, so a hot reload loses nothing.
   - A tick on each slider marks the original value.
   - The **Original / Tweaked** toggle flips between the two, so you can compare.
   - A `•` marks every control you changed.
   - Easing controls come with presets: `ease-out`, `ease-in-out`, `linear`, `out-sine`, `out-quad`, `out-cubic`.
   - **Reset** puts every control back. **JSON** copies the values to paste in chat.
4. **Send to agent:** the click wakes Claude. It writes each value in your code's own idiom (a Tailwind class when one matches, else an exact value) and removes every trace of the scaffold.

Values close to your scale but not on it get a ⚠ flag, for example `26px` next to `p-6`. Claude asks before it snaps them. To throw the tweaks away, tell Claude to cancel: it puts the source back exactly as it was.

Docking pads the page on that side, so normal page content moves out from under the panel. Elements with `position: fixed`, or absolutely positioned against the window, do not move.

## Usage

```
dial in the pricing card
```

```
I need to hand tweak this shadow and the hover easing
```

Then drag, and click **Send to agent**.

Works with React, Next.js, Vue, Nuxt, Svelte, Astro, Storybook, and plain HTML. Controls: number sliders, colors (with alpha), selects, toggles, 2D points, and cubic-bezier curves. JS values (Framer Motion springs, Three.js uniforms) work too.

## Requirements

- Node 18 or later.
- A dev server running on your machine.

Auto-wake on **Send to agent** needs an agent that wakes when a background task ends, like Claude Code. In other agents, click **Send to agent**, then type "keep these".

## Install

**As a Claude Code plugin** (Claude Code 2.1.275 or later). This plugin lives in the [joaopmarques/claude-plugins](https://github.com/joaopmarques/claude-plugins) marketplace:

```bash
claude plugin marketplace add joaopmarques/claude-plugins
claude plugin install dial-in@joaopmarques
```

**With the skills CLI** (works with Claude Code and other agents):

```bash
npx skills add joaopmarques/dial-in
```

**By hand:** copy `skills/dial-in/` into `~/.claude/skills/`.

## Try the demo

```bash
node skills/dial-in/scripts/tweak-server.mjs --root test/demo
```

In a second terminal:

```bash
python3 -m http.server 8765 --directory test/demo
```

Open http://127.0.0.1:8765 and tweak the card. **Send to agent** stops the server and prints the result.

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

- `npm run test:unit`: value formatting, panel placement, and the tweak server (Node's built-in test runner).
- `npm run test:e2e`: the panel in Chromium, through Playwright. It covers live values, easing presets, the toggle, auto-save, reloads, sending, docking, dragging, themes, and fonts.

## Credits

The panel is [Tweakpane](https://github.com/cocopon/tweakpane) by Hiroki Kokubun, with its [Essentials plugin](https://github.com/tweakpane/plugin-essentials). Both are MIT. Icons are from [Lucide](https://lucide.dev) (ISC).

## License

MIT. See [LICENSE](LICENSE).
