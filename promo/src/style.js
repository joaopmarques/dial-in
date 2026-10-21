// clean, light, in the panel's own zinc palette: a faint dot grid, the name small in the corner, a thin blue line at each cut
const dotTile = (() => { const c = document.createElement('canvas'); c.width = c.height = 40; const g = c.getContext('2d');
  g.fillStyle = '#E4E4E7'; g.beginPath(); g.arc(20, 20, 1.5, 0, TAU); g.fill(); return c; })();
const dotPat = ctx.createPattern(dotTile, 'repeat');
function drawBg(t){
  if (window.__NOBAR) BAR.y = 1e5;   // set by record.js --no-bar: the MP4 shows the film without the player's scrub bar
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = dotPat; ctx.fillRect(0, 0, W, H);
}
function overlay(t){}
function hud(t, sc){
  if (sc.i === 0 || sc.i === SC.length - 1) return;
  T(CFG.hudTitle, 110, 84, { f: FM, w: 700, z: 20, c: C.dim });
}
// cuts are hard: every scene opens with its own spring entrances (and LAUNCH → TWEAK_UI is a match move), so no wipe
function transition(sc, lt){}
