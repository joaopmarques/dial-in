---
name: dial-in
description: Dial in a UI component by hand. Puts a floating panel of live controls (sliders, color pickers, easing curves) next to the component in the running app, then writes the values the user picks back to source. Use when the user wants to hand tweak, fine-tune by feel, or asks for controls, knobs, or sliders for a component's spacing, colors, radius, shadows, motion, or timing.
---

The user has a component that is close, and wants to **dial in** the last details by eye instead of by prompt. You scaffold a live control panel, hand over, and wait. The user tweaks and clicks **Send to agent**, which wakes you to write the values back and remove every trace of the scaffold.

The kit lives next to this file:

- `scripts/tweak-server.mjs`: local server. Serves the panel, auto-saves values to `<project>/.tweaks/`, and exits when the user clicks **Send to agent**.
- `assets/panel.js`: the panel (Tweakpane 4 + Essentials, vendored). Reads every manifest in `.tweaks/`, one tab per target.
- `scripts/dial.mjs`: `diff` lists what to write back, `teardown` cleans up and finds leftovers.

Keep every run **lean**: the user is waiting, and tokens cost money. Read only the files that hold the knobs. Make the edits in as few tool calls as you can. Verify once.

Web DOM only: React, Vue, Svelte, Astro, plain HTML, Storybook. For native apps, say so and stop.

## 1. Discover

Pick the **target**: the component the user means, from the conversation and the code. If two candidates fit equally, ask which one.

Pick the **knobs** yourself, from what the user said and what this session worked on. Aim for 3 to 6 in total, across all targets. Go straight to the scaffold: the user can ask for more knobs later (see **Add knobs**). In order:

1. Values the user named ("the shadow feels heavy", "the entrance feels slow").
2. Values this session already changed or argued about.
3. The few raw values in the target's own code that most shape that feel: spacing, radius, shadow, color, opacity, duration, easing, spring.

Offer a full list only when the user asks for it: "all controls", "everything", "let me pick". Then list the candidates, one short line each, and let the user choose.

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
8. Reuse the user's running dev server when there is one. Start one in the background from `package.json` only when nothing runs. Open the page that renders the target: the built-in browser pane if the host has one, else `open <url>`.

Done when one check passes: `window.__dialIn.ready` is `true` and the console has no `[dial-in]` warning. Run it once in the browser pane when you have one. A screenshot is not needed.

Several targets at once is fine: one manifest and one `data-tweak` per target, one server. The panel shows one tab per target, and one click sends all of them.

## 3. Hand over

Tell the user, in two lines: the panel is up, list the knobs, and "click **Send to agent** when it feels right, or tell me to cancel." End the turn. Do not poll.

## 4. Write back

The trigger is one of:

- The background server exits and prints `DIAL_IN_RESULT {"status":"apply",...}`.
- The user types "keep these", "save", or "lock it in". Stop the server yourself with the pid in `.tweaks/server.json`.
- The user pastes a JSON block copied from the panel.

Then:

1. Run `node <this skill>/scripts/dial.mjs diff --root <project root>`. It lists every knob with `changed`, `file`, `line`, `raw`, the new `value`, and the CSS text in `css`.
2. Write each **changed** value back to its source line in the project's own idiom, following [references/stacks.md](references/stacks.md) (and [references/js-values.md](references/js-values.md) for JS knobs). Restore each **unchanged** knob to its exact `raw` text, so it leaves no diff.
3. Run **Teardown** below.
4. Report one line per changed knob: `key: raw → new`. Flag near-misses with ⚠ as [references/stacks.md](references/stacks.md) defines, and offer to snap them.

Done when the source holds the new values in the project's idiom, teardown is clean, and the page renders the same as the last panel state.

## Add knobs

When the user asks for more controls mid-session: add the knobs to the target's manifest (or a new manifest for a new target), scaffold them as in step 2.4, and tell the user to reload the page. The server keeps running, and values already tweaked stay.

## Cancel

When the user types "cancel", "discard", or "revert": stop the server with the pid in `.tweaks/server.json`, restore every knob to its `raw` text, then run **Teardown**. Report "discarded, source is back to how it was."

## Teardown

1. Remove every `tweak-scaffold` line change, the `data-tweak` attribute, the script tag, and any `useTweak` helper you added.
2. Run `node <this skill>/scripts/dial.mjs teardown --root <project root>`. It stops the server, deletes `.tweaks/`, and lists every leftover `tweak-scaffold`, `--dial-`, `__tweak`, or `data-tweak`.
3. Fix each leftover it lists, then run it again.

Done when teardown prints `clean` and `git diff` shows only the intended value changes.
