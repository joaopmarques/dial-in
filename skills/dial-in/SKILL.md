---
name: dial-in
description: Dial in a UI component by hand. Puts a floating panel of live controls (sliders, color pickers, easing curves) next to the component in the running app, then writes the values the user picks back to source. Use when the user wants to hand tweak, fine-tune by feel, or asks for controls, knobs, or sliders for a component's spacing, colors, radius, shadows, motion, or timing.
---

The user has a component that is close, and wants to **dial in** the last details by eye instead of by prompt. You scaffold a live control panel, hand over, and wait. The user tweaks and clicks **Send to agent**, which wakes you to write the values back and remove every trace of the scaffold.

The kit lives next to this file:

- `scripts/tweak-server.mjs`: local server. Serves the panel, auto-saves values to `<project>/.tweaks/`, and exits when the user clicks **Send to agent**.
- `assets/panel.js`: the panel (Tweakpane 4 + Essentials, vendored). Reads every manifest in `.tweaks/`.

Web DOM only: React, Vue, Svelte, Astro, plain HTML, Storybook. For native apps, say so and stop.

## 1. Discover

Pick the **target**: the component the user means, from the conversation and the code. If two candidates fit equally, ask which one.

Pick up to 8 **knobs**, in this order:

1. Values this session already changed or argued about.
2. Values the user named ("the shadow feels heavy").
3. Magic numbers and raw colors in the target's own styles: spacing, radius, shadow offsets and blur, colors, opacity, font size and weight, line height, durations, easing, spring settings.

Skip values that come from a shared token, unless the user asked about that token. Changing a token changes every component that uses it.

Done when each knob has: a `key`, a control type, the original value, and the exact source `file`, `line`, and `raw` text.

## 2. Scaffold

1. Choose an `id`: short kebab-case for the target (`pricing-card`).
2. Write `.tweaks/<id>.manifest.json`. Schema, control types, and range rules: [references/manifest.md](references/manifest.md).
3. Add `.tweaks/` to `.git/info/exclude` if it is not there yet.
4. Rewrite each knob so it reads the live value. Tag every changed line with a `tweak-scaffold` comment.
   - CSS-side knobs (`kind: "css"`) become `var(--dial-<id>-<key>, <original>)`. Per-stack syntax: [references/stacks.md](references/stacks.md).
   - JS-side knobs (`kind: "js"`) read `__tweak(id, key, original)`. Wiring: [references/js-values.md](references/js-values.md).
5. Add `data-tweak="<id>"` to the target's root element.
6. Start the server **in the background**, so its exit wakes you:
   `node <this skill>/scripts/tweak-server.mjs --root <project root>`
   It prints `DIAL_IN_READY <panel url>` and writes the port and pid to `.tweaks/server.json`. It moves to the next port if 7777 is busy.
7. Add the dev-only script tag for the panel URL. Placement per stack: [references/stacks.md](references/stacks.md).
8. Find the running dev server, or start it in the background from `package.json`. Open the page that renders the target: the built-in browser pane if the host has one, else `open <url>`.

Done when the page shows the panel next to the target with every knob, and the browser console has no `[dial-in]` warning. Check this yourself in the browser pane when you have one.

Several targets at once is fine: one manifest and one `data-tweak` per target, one server. One click sends all of them.

## 3. Hand over

Tell the user, in two lines: the panel is up, list the knobs, and "click **Send to agent** when it feels right, or tell me to cancel." End the turn. Do not poll.

## 4. Write back

The trigger is one of:

- The background server exits and prints `DIAL_IN_RESULT {"status":"apply",...}`.
- The user types "keep these", "save", or "lock it in". Stop the server yourself with the pid in `.tweaks/server.json`.
- The user pastes a JSON block copied from the panel.

Then:

1. Read `.tweaks/<id>.json` for each id. Compare every value with the manifest's original.
2. Write each **changed** value back to its source line in the project's own idiom, following [references/stacks.md](references/stacks.md) (and [references/js-values.md](references/js-values.md) for JS knobs). Restore each **unchanged** knob to its exact `raw` text, so it leaves no diff.
3. Run **Teardown** below.
4. Report one line per changed knob: `key: raw → new`. Flag near-misses with ⚠ as [references/stacks.md](references/stacks.md) defines, and offer to snap them.

Done when the source holds the new values in the project's idiom, teardown is clean, and the page renders the same as the last panel state.

## Cancel

When the user types "cancel", "discard", or "revert": stop the server with the pid in `.tweaks/server.json`, restore every knob to its `raw` text, then run **Teardown**. Report "discarded, source is back to how it was."

## Teardown

1. Remove every `tweak-scaffold` line change, the `data-tweak` attribute, the script tag, and any `useTweak` helper you added.
2. Stop the server if it still runs.
3. Delete `.tweaks/<id>.*`, `.tweaks/result.json`, and `.tweaks/server.json`. Delete `.tweaks/` when it is empty.
4. Search the project for `tweak-scaffold`, `--dial-`, `__tweak`, and `data-tweak`. Every hit is a leftover: fix it.

Done when step 4 finds nothing and `git diff` shows only the intended value changes.
