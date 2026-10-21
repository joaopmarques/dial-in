// Shared drawing helpers for the dial-in promo. Every function is a pure function of its arguments.

function rrect(x, y, w, h, r){ ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
const smooth = t => t * t * (3 - 2 * t);
const GREEN = '#16A34A', RED = '#DC2626', DOTS_C = '#D4D4D8';

// cursor arrow; press 0..1 shrinks it a little
function cursor(x, y, a = 1, press = 0){
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); const s = 1.15 - press * .15; ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(9, 26); ctx.lineTo(16, 41); ctx.lineTo(22, 38); ctx.lineTo(15, 23); ctx.lineTo(27, 23); ctx.closePath();
  ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
}

// cubic-bezier(x1, y1, x2, y2) evaluated at progress u (CSS semantics)
function bez(c, u){
  if (u <= 0) return 0; if (u >= 1) return 1;
  const [x1, y1, x2, y2] = c, f = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  let lo = 0, hi = 1, t = u;
  for (let i = 0; i < 24; i++){ t = (lo + hi) / 2; if (f(x1, x2, t) < u) lo = t; else hi = t; }
  return f(y1, y2, t);
}

// ---------------------------------------------------------------------------- icons (Lucide, 24-unit boxes)
function icon(name, x, y, s, col, lw = 2){
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24); ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = d => ctx.stroke(new Path2D(d));
  const box = () => { rrect(3, 3, 18, 18, 2); ctx.stroke(); };
  if (name === 'float'){ rrect(7, 7, 14, 14, 2); ctx.stroke(); p('M7 11h14'); p('M17 3H5a2 2 0 0 0-2 2v12'); }
  if (name === 'left'){ box(); p('M9 3v18'); }
  if (name === 'bottom'){ box(); p('M3 15h18'); }
  if (name === 'right'){ box(); p('M15 3v18'); }
  if (name === 'minus') p('M5 12h14');
  if (name === 'reset'){ p('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'); p('M3 3v5h5'); }
  if (name === 'copy'){ rrect(8, 8, 14, 14, 2); ctx.stroke(); p('M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'); }
  if (name === 'check') p('M20 6 9 17l-5-5');
  ctx.restore();
}

// ---------------------------------------------------------------------------- the dial-in panel
// A redraw of the real panel (screenshot), at a base width of 660 px. Draw it with ctx transforms for other sizes.
// o: { title, tabs, tab, rows: [{ label, min, max, orig, v, fmt }], ease: { label, v, active }, mode: 'a'|'b', send: 0..1 press,
//      sent: 0..1, hot: row index the cursor holds }
// Returns the layout in panel coordinates, so scenes can aim the cursor at knobs and buttons.
const PW = 660;
function panelLayout(o){
  let y = 0; const L = {};
  L.head = y; y += 72;
  if (o.tabs){ L.tabs = y; y += 46; }
  L.bar = y; y += 66;
  L.rows = []; y += 14;
  for (let i = 0; i < o.rows.length; i++){ L.rows.push(y + 26); y += 52; }
  if (o.ease){ L.ease = y + 8; y += 268; }
  y += 14; L.foot = y; y += 96;
  L.h = y; L.trackX0 = 318; L.trackX1 = 528;
  L.knobX = r => L.trackX0 + (L.trackX1 - L.trackX0) * clamp((r.v - r.min) / (r.max - r.min));
  L.send = { x: 18, y: L.foot + 16, w: PW - 36, h: 62 };
  return L;
}
function panel(o){
  const L = panelLayout(o), w = PW, h = L.h;
  // window
  ctx.save();
  ctx.shadowColor = 'rgba(24,24,27,.14)'; ctx.shadowBlur = 48; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#fff'; rrect(0, 0, w, h, 18); ctx.fill(); ctx.restore();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; rrect(0, 0, w, h, 18); ctx.stroke();
  // header: title, dotted grip, dock switcher, collapse
  T(o.title, 26, L.head + 46, { f: FK, w: 700, z: 25 });
  const gx0 = 34 + mw(o.title, FK, 700, 25), gx1 = w - 232;
  ctx.fillStyle = DOTS_C;
  for (let gx = gx0; gx < gx1; gx += 9) for (let gy = L.head + 26; gy <= L.head + 50; gy += 8){ ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, TAU); ctx.fill(); }
  ['float', 'left', 'bottom', 'right'].forEach((n, i) => icon(n, w - 222 + i * 46, L.head + 22, 26, i === 0 ? C.acc : '#52525B'));
  icon('minus', w - 46, L.head + 22, 26, '#52525B');
  // tabs
  if (o.tabs){
    let tx = 22;
    o.tabs.forEach((name, i) => { const on = i === (o.tab || 0), tw = mw(name, FK, 600, 20);
      T(name, tx, L.tabs + 28, { f: FK, w: 600, z: 20, c: on ? C.ink : C.dim });
      if (on){ ctx.fillStyle = C.ink; ctx.fillRect(tx - 2, L.tabs + 42, tw + 4, 3); }
      tx += tw + 34; });
    ctx.fillStyle = C.line; ctx.fillRect(0, L.tabs + 44, w, 1.5);
  }
  // toolbar: Original / Tweaked, Reset, JSON
  const by = L.bar + 12, segW = 380;
  ctx.fillStyle = '#F4F4F5'; rrect(14, by, segW, 50, 12); ctx.fill();
  const thumb = o.modeP ?? (o.mode === 'a' ? 0 : 1);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#fff'; rrect(18 + thumb * (segW / 2 - 4), by + 4, segW / 2 - 4, 42, 9); ctx.fill(); ctx.restore();
  T('Original', 14 + segW / 4, by + 33, { f: FK, w: 500, z: 22, c: thumb < .5 ? C.ink : C.dim, al: 'center' });
  T('Tweaked', 14 + segW * 3 / 4, by + 33, { f: FK, w: 500, z: 22, c: thumb >= .5 ? C.ink : C.dim, al: 'center' });
  icon('reset', 418, by + 12, 26, C.dim); T('Reset', 452, by + 34, { f: FK, w: 500, z: 22, c: C.dim });
  icon('copy', 548, by + 12, 26, C.dim); T('JSON', 582, by + 34, { f: FK, w: 500, z: 22, c: C.dim });
  ctx.fillStyle = C.line; ctx.fillRect(0, L.bar + 64, w, 1.5);
  // rows: label (• when changed), track with ghost tick, knob, value box
  o.rows.forEach((r, i) => { const y = L.rows[i], changed = Math.abs(r.v - r.orig) > (r.max - r.min) * .004;
    T(r.label + (changed ? ' •' : ''), 22, y + 8, { f: FK, w: 500, z: 21, c: '#71717A' });
    ctx.fillStyle = '#E4E4E7'; rrect(L.trackX0, y - 2, L.trackX1 - L.trackX0, 4, 2); ctx.fill();
    const kx = L.knobX(r);
    ctx.fillStyle = C.ink; rrect(L.trackX0, y - 2, kx - L.trackX0, 4, 2); ctx.fill();
    const gx = L.trackX0 + (L.trackX1 - L.trackX0) * clamp((r.orig - r.min) / (r.max - r.min));
    ctx.fillStyle = rgba(C.ink, .45); ctx.fillRect(gx - 1.5, y - 15, 3, 30);
    const hot = o.hot === i;
    ctx.fillStyle = hot ? '#D4D4D8' : '#E4E4E7'; rrect(kx - 12, y - 15, 24, 30, 6); ctx.fill();
    ctx.strokeStyle = '#D4D4D8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#A1A1AA'; ctx.fillRect(kx - 1, y - 9, 2, 18);
    ctx.fillStyle = '#F4F4F5'; rrect(548, y - 21, 96, 42, 8); ctx.fill();
    ctx.fillStyle = '#D4D4D8'; ctx.fillRect(556, y - 12, 2, 24);
    T(r.fmt(r.v), 634, y + 8, { f: FK, w: 500, z: 21, al: 'right' });
  });
  // easing: curve editor + presets
  if (o.ease){ const e = o.ease, gx = L.trackX0 - 10, gy = L.ease, gw = 336, gh = 168;
    T(e.label + (e.changed ? ' •' : ''), 22, gy + gh / 2 + 8, { f: FK, w: 500, z: 21, c: '#71717A' });
    ctx.fillStyle = '#F4F4F5'; rrect(gx, gy, gw, gh, 8); ctx.fill();
    const px = u => gx + 20 + u * (gw - 40), py = v => gy + gh - 22 - v * (gh - 44);
    ctx.strokeStyle = '#D4D4D8'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(e.v[0]), py(e.v[1])); ctx.moveTo(px(1), py(1)); ctx.lineTo(px(e.v[2]), py(e.v[3])); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px(0), py(0));
    ctx.bezierCurveTo(px(e.v[0]), py(e.v[1]), px(e.v[2]), py(e.v[3]), px(1), py(1)); ctx.stroke();
    dot(px(e.v[0]), py(e.v[1]), 6, '#fff'); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(e.v[0]), py(e.v[1]), 6, 0, TAU); ctx.stroke();
    dot(px(e.v[2]), py(e.v[3]), 6, '#fff'); ctx.beginPath(); ctx.arc(px(e.v[2]), py(e.v[3]), 6, 0, TAU); ctx.stroke();
    let cx = gx, cy = gy + gh + 16; L.presets = {};
    for (const name of ['ease-out', 'ease-in-out', 'linear', 'out-sine', 'out-quad', 'out-cubic']){
      const tw = mw(name, FK, 500, 17) + 18; if (cx + tw > gx + gw + 4){ cx = gx; cy += 38; }
      const on = name === e.active;
      ctx.fillStyle = on ? C.ink : '#fff'; rrect(cx, cy, tw, 30, 7); ctx.fill();
      ctx.strokeStyle = on ? C.ink : C.line; ctx.lineWidth = 1.5; ctx.stroke();
      T(name, cx + 9, cy + 21, { f: FK, w: 500, z: 17, c: on ? '#fff' : C.dim });
      L.presets[name] = { x: cx + tw / 2, y: cy + 15 }; cx += tw + 7; }
  }
  // footer: Send to agent, or the sent note
  ctx.fillStyle = C.line; ctx.fillRect(0, L.foot, w, 1.5);
  const s = L.send, sent = o.sent || 0;
  if (sent < 1){ ctx.save(); const k = 1 - (o.send || 0) * .03; ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.scale(k, k);
    ctx.globalAlpha = 1 - sent; ctx.fillStyle = C.ink; rrect(-s.w / 2, -s.h / 2, s.w, s.h, 12); ctx.fill();
    T('Send to agent', 0, 9, { f: FK, w: 600, z: 24, c: '#fff', al: 'center' }); ctx.restore(); }
  if (sent > 0){ T('Sent to agent ✓', s.x + s.w / 2, s.y + 40, { f: FK, w: 600, z: 24, c: GREEN, al: 'center', a: sent }); }
  // resize corner
  ctx.strokeStyle = '#A1A1AA'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w - 8, h - 20); ctx.lineTo(w - 20, h - 8); ctx.moveTo(w - 8, h - 13); ctx.lineTo(w - 13, h - 8); ctx.stroke();
  return L;
}
// draw a panel at (x, y) with scale s; returns a mapper from panel to canvas coordinates plus the layout
function placePanelAt(o, x, y, s = 1, a = 1){
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s); const L = panel(o); ctx.restore();
  return { L, at: (px, py) => [x + px * s, y + py * s] };
}

// ---------------------------------------------------------------------------- 3D glass plates
// n square plates stacked on y; spread in 0..1 separates them; yaw/pitch in degrees. Painter's order: far plates first.
function plates(cx, cy, size, n, spread, yaw, pitch, a = 1){
  const ya = yaw * Math.PI / 180, pa = pitch * Math.PI / 180, f = 1600, zc = 1700, s = size / 2, sd = s * .62;   // card-shaped, so yaw reads
  const proj = ([X, Y, Z]) => { const x1 = X * Math.cos(ya) - Z * Math.sin(ya), z1 = X * Math.sin(ya) + Z * Math.cos(ya);
    const y2 = Y * Math.cos(pa) - z1 * Math.sin(pa), z2 = Y * Math.sin(pa) + z1 * Math.cos(pa), k = f / (zc + z2);
    return [cx + x1 * k, cy - y2 * k, z2]; };
  const HUES = ['#60A5FA', '#818CF8', '#A78BFA', '#F0ABFC', '#FDBA74'];
  const list = [];
  for (let i = 0; i < n; i++){ const Y = (i - (n - 1) / 2) * spread * 120;
    const pts = [[-s, Y, -sd], [s, Y, -sd], [s, Y, sd], [-s, Y, sd]].map(proj); list.push({ i, Y, pts }); }
  list.sort((p, q) => p.Y - q.Y);
  ctx.save(); ctx.globalAlpha *= a;
  for (const p of list){ const col = HUES[p.i % HUES.length], [p0, p1, p2, p3] = p.pts;
    // soft shadow-ish thickness edge
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1] + 10); ctx.lineTo(p1[0], p1[1] + 10); ctx.lineTo(p2[0], p2[1] + 10); ctx.lineTo(p3[0], p3[1] + 10); ctx.closePath();
    ctx.fillStyle = rgba(col, .35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
    const g = ctx.createLinearGradient(p0[0], p0[1], p2[0], p2[1]); g.addColorStop(0, rgba(col, .92)); g.addColorStop(1, rgba('#FFFFFF', .7));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5; ctx.stroke(); }
  ctx.restore();
}
