# Promo video

The 27-second promo in `../docs/media/dial-in-promo.mp4` (1920 × 1080, 120 fps).

- **Made with:** the [motion-graphic skill](https://github.com/JakeB-5/motion-graphic-skill) by JakeB-5 (MIT), vendored in `.skill/` at commit 21e875e. `.skill/SOURCE.md` lists the local changes.
- **Story:** the prompt loop (prompt, preview, "not it"…), then dial-in: launch it, tweak a toast entrance and a 3D stack live, send to the agent.

## Files

| Path | What it is |
|---|---|
| `src/` | The editable scene source (config, copy, style, geometry, scenes, plan). |
| `facts.md` | The source for every string on screen. |
| `review_log.md` | The three critique rounds, the fixes, and what is still open. |
| `dial-in-promo.html` | The built film. Open it in a browser to play it with sound. |

## Rebuild

1. Run `npm install`.
2. Run `npm run build`.
3. Run `npm run check`.
4. Run `npm run record`. It writes `../docs/media/dial-in-promo.mp4` at 120 fps, without the player's scrub bar.
