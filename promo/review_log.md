# Review log

Critique loop from the motion-graphic skill (`.skill/references/critique.md`). The builder appends each reviewer's answer unchanged and logs the fixes under it.

## Round 1
Reviewer: separate agent, fresh context

| Axis | Score |
|---|---|
| Hook | 7 |
| Phone readability | 6 (D2) |
| Motion quality | 6 (D5, D6) |
| Variety | 6 |
| Composition | 6 (D7, D8) |
| Brand accuracy | 6 (D10) |
| Sound sync | 8 |

FAILs: D2 (SEND diff and "Written to source ✓" unreadable at 360 px), D5 (card and panel jump from LAUNCH to TWEAK_UI), D6 (objects appear fully formed at 50 % and only fade), D7 (same fade-and-wipe entrance at most cuts), D8 (play button over the wordmark, low weight for MP4), D10 ("0.80" in the panel vs "0.8" in the diff; "PROMPT · WAIT · REPEAT" not in facts.md).

Worst three: the fade-in cuts with the card and panel jumping at 12.7 s; the SEND payoff unreadable on a phone; 0.80 vs 0.8.

### Fixes after round 1
- OPEN recreates the screenshot: the product card with the panel over its top-right corner, the name below. The hook is the product.
- Every object enters with a spring: travel plus a small scale, staggered. The full-frame wipe is gone.
- LAUNCH → TWEAK_UI is one move: the card's image and the panel grow from their LAUNCH spots into the TWEAK_UI layout.
- TWEAK_3D breaks the layout: a dark full-bleed stage with large plates. Bigger changes: spread 0.2 → 1, yaw 35° → −40°, and a visible collapse-and-replay with the out-cubic curve.
- SEND shows three big diff lines (40 px mono) and a 56 px "Written to source ✓".
- The diff writes 0.80 → 0.25, the same string as the panel. "PROMPT · WAIT · REPEAT" is in facts.md.

## Round 2
Reviewer: separate agent, fresh context

| Axis | Score |
|---|---|
| Hook | 8 |
| Phone readability | 6 (D2) |
| Motion quality | 5 (D5, D6) |
| Variety | 5 (D4) |
| Composition | 7 |
| Brand accuracy | 7 |
| Sound sync | 8 |

FAILs: D2 ("PROMPT · WAIT · REPEAT" unreadable at 360 px), D4 (OPEN stills near-identical; 3D yaw change hard to see), D5 (blank frames into END; hard stops at cuts), D6 (the black "Send to agent" bar visible before its white panel at the SEND and 3D cuts). D10 now PASS.

### Fixes after round 2
- Object entrances start at 50 % opacity on their first frame, so no part shows before its body and no cut has a blank frame.
- Every scene except LAUNCH (whose last frame starts the match move) leaves with a short drift up and soften.
- OPEN: a slow push-in, and a bigger visible change (halo 300 → 111 px, dimmed scale 0.12 → 0.37) ending on the screenshot's values.
- PROBLEM: "Prompt. Wait. Repeat." at 48 px bold.
- LAUNCH: a larger card, with the panel over its corner like the screenshot.
- 3D: yaw 42° → −4° (the stack turns from a diamond to face-on) and spread 0.1 → 1.
- End line: "Live controls. Any UI, any 3D." (the 3D claim no longer gets undercut). facts.md covers the 3D lines.

## Round 3 (last round)
Reviewer: separate agent, fresh context

| Axis | Score |
|---|---|
| Hook | 8 |
| Phone readability | 7 |
| Motion quality | 6 (D6) |
| Variety | 7 |
| Composition | 7 |
| Brand accuracy | 8 |
| Sound sync | 7 |

FAILs: D6 only (the 3D panel faded in nearly in place, as a grey slab on the dark stage; the plates did not move in; the SEND panel had no move). D2, D4, D5 and D10 now PASS.

### Fixes after round 3 (not re-reviewed: the skill stops after three rounds)
- 3D: the panel slides in from off-screen right at full opacity; the plates rise 260 px and scale up; the stack sits 40 px higher, clear of the bottom safe area.
- SEND: the panel travels from the right (where TWEAK UI had it) to the left while it shrinks.
- TWEAK UI has no exit drift, so its last frame is clean.

### Still short (open)
- Variety (7): LAUNCH, TWEAK UI, TWEAK 3D and SEND share one template (kicker and headline top-left, visual right). The 3D scene's dark stage is the one break.
- Phone readability (7): the panel's own labels, "Sent to agent ✓" inside the panel, the typed prompt and the install command are small at 360 px. "Written to source ✓" and every headline read.
- Sound sync (7): judged from cue timings only; nobody listened.

## After the review rounds: the user's cut
The user asked for a faster, shorter film, previewed in the browser before rendering. Changes, all by request:
- 27 s, 6 scenes: the prompt loop → dial-in (the skill by name) → tweak UI → tweak 3D → send → end. Each scene plays at the speed that fits its length (`ORIG` in scenes.js).
- The UI example is a generic toast entrance (spring stiffness, damping, offset), not the Pixelmatters card.
- These changes were checked with check.js (no failures) and by the user in the browser, not by another critique round.
