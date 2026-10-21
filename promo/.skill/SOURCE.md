Vendored from https://github.com/JakeB-5/motion-graphic-skill at 21e875e (MIT).

Local changes for the dial-in promo:

- `scripts/record.js`: a `--no-bar` flag sets `window.__NOBAR` before the page loads. The film's `src/style.js` reads it and moves the player's scrub bar off-canvas, so the video shows the film only.
- `agents/` removed (Codex metadata, not used here).
