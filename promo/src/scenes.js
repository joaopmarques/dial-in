
// headline entrance: visible from frame 0 (45 %), springs up, full opacity by +0.1 s. Never cut to an empty frame.
const enterA = (lt, t0 = 0) => lt < t0 ? 0 : clamp(.45 + (lt - t0) / .1 * .55);
const enterY = (lt, t0 = 0, dy = 48) => (1 - spring(lt - t0 + .03, ...SPRING.snappy)) * dy;
function enter(s, x, y, lt, t0, o = {}, dy = 48){ const a = enterA(lt, t0); if (a <= 0) return; T(s, x, y + enterY(lt, t0, dy), { ...o, a: (o.a ?? 1) * a }); }
function heading(k, h, lt, ink = C.ink, kc = C.acc){ kicker(k, 110, 176, lt, 0, kc); enter(h, 110, 262, lt, 0, { f: FD, w: 800, z: 84, fit: 980, c: ink }); }

// object entrance: travel from an offset plus a small scale-up on a spring, around the pivot (ox, oy)
function pop(lt, t0, from, ox, oy, fn, s0 = .92, a0 = .5){
  if (lt < t0) return;
  const k = spring(lt - t0, ...SPRING.default), a = clamp(a0 + (lt - t0) / .1 * (1 - a0));   // half visible on its first frame: no blank frames, no part showing before its body
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(ox + from[0] * (1 - k), oy + from[1] * (1 - k));
  const s = lerp(s0, 1, k); ctx.scale(s, s); ctx.translate(-ox, -oy); fn(); ctx.restore();
}

// scene exit: the last 0.22 s drifts up and softens, so no cut is a hard stop
function leave(lt, d){ const u = eIO(inv(d - .22, d, lt)); if (u <= 0) return; ctx.translate(960, 540); ctx.scale(1 - .03 * u, 1 - .03 * u); ctx.translate(-960, -540 - 30 * u); ctx.globalAlpha *= 1 - .45 * u; }

// a hand drag: eased move between two values over [t0, t1]
const drag = (lt, t0, t1, a, b) => lerp(a, b, eIO(inv(t0, t1, lt)));
const ticks = (t0, t1, n = 8, a = .02) => Array.from({ length: n }, (_, i) => [t0 + (t1 - t0) * i / n, 'tick', a]);
const f2 = v => v.toFixed(2), f0 = v => String(Math.round(v));

// cursor that visits points: keys = [[t, [x, y]], ...]; eased moves between them
function cursorAt(lt, keys){
  let p = keys[0][1];
  for (let i = 1; i < keys.length; i++){ const [t, q] = keys[i], t0 = keys[i - 1][0], u = eIO(inv(t0 + Math.min(.05, (t - t0) * .2), t, lt)); p = [lerp(p[0], q[0], u), lerp(p[1], q[1], u)]; }
  return p;
}
const pressAt = (lt, times) => Math.max(0, ...times.map(t => 1 - Math.abs(lt - t) / .12));

// ---------------------------------------------------------------------------- the generic UI example: a toast entrance
// A small app window; a "Changes saved" toast springs in at the bottom right, again every TOAST_P seconds,
// so every slider change shows on the next entrance. v: { k, d, off, s0, r } (stiffness, damping, offset px, start scale, radius px)
const TOAST_P = 1.6;
const STAGE = { w: 900, h: 560 };
function appWindow(x, y, w, lt, v, frame = 1){
  const S = w / STAGE.w, h = STAGE.h * S;
  ctx.save(); ctx.shadowColor = 'rgba(24,24,27,.10)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 12 * S;
  ctx.fillStyle = '#fff'; rrect(x, y, w, h, 22 * S); ctx.fill(); ctx.restore();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; rrect(x, y, w, h, 22 * S); ctx.stroke();
  // window chrome and a few placeholder blocks
  [0, 1, 2].forEach(i => dot(x + (30 + i * 24) * S, y + 30 * S, 7 * S, '#E4E4E7'));
  ctx.fillStyle = '#E4E4E7'; ctx.fillRect(x, y + 60 * S, w, 1.5);
  ctx.fillStyle = '#F4F4F5'; rrect(x + 36 * S, y + 96 * S, 380 * S, 30 * S, 8 * S); ctx.fill();
  rrect(x + 36 * S, y + 146 * S, 260 * S, 22 * S, 8 * S); ctx.fill();
  rrect(x + 36 * S, y + 200 * S, 828 * S, 150 * S, 14 * S); ctx.fill();
  // the toast, replaying
  const u = lt % TOAST_P, sp = spring(u, v.k, v.d), out = inv(TOAST_P - .22, TOAST_P, u);
  const tw = 430 * S, th = 108 * S, tx = x + w - tw - 34 * S, ty = y + h - th - 34 * S + v.off * S * (1 - sp) + 20 * S * out;
  const sc = lerp(v.s0, 1, sp), a = clamp(u / .08) * (1 - out);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(tx + tw / 2, ty + th / 2); ctx.scale(sc, sc); ctx.translate(-tw / 2, -th / 2);
  ctx.save(); ctx.shadowColor = 'rgba(24,24,27,.18)'; ctx.shadowBlur = 28 * S; ctx.shadowOffsetY = 10 * S;
  ctx.fillStyle = C.ink; rrect(0, 0, tw, th, v.r * S); ctx.fill(); ctx.restore();
  dot(48 * S, th / 2, 20 * S, GREEN);
  ctx.save(); ctx.translate(36 * S, th / 2 - 12 * S); icon('check', 0, 0, 24 * S, '#fff', 3); ctx.restore();
  T('Changes saved', 86 * S, th / 2 - 4 * S, { f: FK, w: 700, z: 26 * S, c: '#fff' });
  T('Your settings are live.', 86 * S, th / 2 + 26 * S, { f: FK, w: 500, z: 21 * S, c: '#A1A1AA' });
  ctx.restore();
}

const TOAST_ROWS = [
  { label: 'Stiffness', min: 0, max: 600, orig: 170, fmt: f0 },
  { label: 'Damping', min: 0, max: 40, orig: 26, fmt: f0 },
  { label: 'Offset Y (px)', min: 0, max: 200, orig: 60, fmt: f0 },
  { label: 'Start scale', min: .5, max: 1, orig: .9, fmt: f2 },
  { label: 'Radius (px)', min: 0, max: 32, orig: 12, fmt: f0 },
];
const rows = (base, vals) => base.map((r, i) => ({ ...r, v: vals[i] ?? r.orig }));
const TOAST0 = { k: 170, d: 26, off: 60, s0: .9, r: 12 };

// 1 · THE LOOP — prompt, preview, "not it", preview, "do X", preview… then the loop gets struck through
const LOOP = [   // [prompt time, preview time, toast values of the preview that answers it]
  [.2, 1.0, { k: 40, d: 18, off: 180, s0: .6, r: 2 }],      // sluggish, huge travel
  [2.2, 3.0, { k: 520, d: 5, off: 140, s0: .7, r: 30 }],    // wild bounce
  [4.2, 5.0, TOAST0],                                       // fine, but flat
];
S.problem = {
  draw(lt, d){
    leave(lt, d);
    TXT.pB.forEach((s, i) => { const t0 = LOOP[i][0], z = 40, tw = mw(s, FK, 600, z), bw = Math.min(tw + 68, 820), bh = 84, x = 820 - bw, y = 200 + i * 150;
      pop(lt, t0, [0, 30], x + bw, y + bh, () => {
        ctx.fillStyle = C.ink; rrect(x, y, bw, bh, 26); ctx.fill();
        T(s, x + 34, y + 55, { f: FK, w: 600, z, c: '#fff', fit: bw - 68 });
        const sp = eO(inv(5.7 + i * .1, 5.9 + i * .1, lt));
        if (sp > 0){ ctx.fillStyle = RED; ctx.fillRect(x + 20, y + bh / 2 - 3, (bw - 40) * sp, 6); } }, .85);
      const th = inv(t0 + .3, t0 + .4, lt) * (1 - inv(LOOP[i][1] - .1, LOOP[i][1], lt));
      if (th > 0) [0, 1, 2].forEach(j => dot(110 + 14 + j * 22, y + bh + 34, 6, C.dim, th * (.35 + .65 * (.5 + .5 * Math.sin(lt * 9 - j)))));
    });
    const cur = LOOP.reduce((v, l) => lt >= l[1] ? l : v, null), x = 1000, y = 230, w = 810;
    kicker('PREVIEW', x, y - 28, lt, .1, C.dim);
    if (!cur){ ctx.save(); ctx.strokeStyle = C.line; ctx.setLineDash([10, 10]); ctx.lineWidth = 2; rrect(x, y, w, STAGE.h * w / STAGE.w, 22); ctx.stroke(); ctx.restore(); }
    else { const flash = 1 - inv(cur[1], cur[1] + .25, lt);
      pop(lt, cur[1], [0, 0], x + w / 2, y + 250, () => appWindow(x, y, w, lt - cur[1], cur[2]), .97, .3);
      if (flash > 0){ ctx.fillStyle = rgba('#FFFFFF', flash * .6); rrect(x, y, w, STAGE.h * w / STAGE.w, 22); ctx.fill(); } }
    T(typeOn('Prompt. Wait. Repeat.', inv(5.9, 6.2, lt)), 110, 860, { f: FK, w: 800, z: 56, c: RED });
  },
  cues: d => [[0, 'pad', [220, 261.63, 329.63, 392], 7, .05], ...[0, 1, 2, 3, 4, 5].map(i => [i, 'kick', .5]), ...LOOP.map(([p], i) => [p, 'blip', 560 * Math.pow(1.12, i), .06]),
    ...LOOP.map(([, v]) => [v, 'whoosh', .25, .07]), ...[0, 1, 2].map(i => [5.7 + i * .1, 'hit', .35]), [5.9, 'error', .06]]
};

// 2 · DIAL-IN — the skill by name; type the request; the panel opens next to the app window
const LAUNCH_STAGE = [880, 430, 480], LAUNCH_PANEL = [1335, 190, .72];
S.launch = {
  draw(lt, d){
    // no leave(): its last frame starts the TWEAK UI match move
    kicker(TXT.lK, 110, 200, lt, 0, C.acc);
    enter(TXT.lT, 104, 360, lt, 0, { f: FD, w: 800, z: 160, fit: 760 }, 50);
    const bx = 110, by = 520, bw = 760, bh = 104, flash = 1 - inv(1.9, 2.4, lt);
    pop(lt, .1, [0, 50], bx, by + bh, () => {
      ctx.fillStyle = '#fff'; rrect(bx, by, bw, bh, 18); ctx.fill();
      ctx.strokeStyle = lt > 1.9 ? rgba(C.acc, .3 + .7 * flash) : C.line; ctx.lineWidth = lt > 1.9 ? 3 : 1.5; ctx.stroke();
      const typed = typeOn(TXT.lCmd, inv(.35, 1.6, lt)), yy = by + 66;
      T('›', bx + 34, yy, { f: FM, w: 700, z: 40, c: C.acc });
      T(typed, bx + 76, yy, { f: FM, w: 500, z: 38, fit: bw - 120 });
      if (lt < 1.9 && Math.floor(lt * 4) % 2 === 0){ ctx.fillStyle = C.ink; ctx.fillRect(bx + 80 + mw(typed, FM, 500, 38), yy - 32, 3, 40); }
      T('↵ enter', bx + bw - 30, yy, { f: FM, w: 500, z: 22, c: C.dim, al: 'right', a: inv(1.5, 1.7, lt) * (1 - inv(1.9, 2.1, lt)) });
    }, .96);
    const [sx, sy, sw] = LAUNCH_STAGE;
    pop(lt, .2, [80, 0], sx + sw / 2, sy + 160, () => appWindow(sx, sy, sw, lt, TOAST0));
    const [px, py, ps] = LAUNCH_PANEL;
    pop(lt, 2.4, [-40, 0], px, py + 160, () => placePanelAt({ title: 'toast-enter', mode: 'b', rows: rows(TOAST_ROWS, []) }, px, py, ps), .7);
  },
  cues: d => [...Array.from({ length: 11 }, (_, i) => [.35 + i * .115, 'tick', .03]), [1.9, 'stamp', .45], [2.4, 'stamp', .5], [2.4, 'whoosh', .3, .08]]
};

// 3 · TWEAK · UI — match move from DIAL-IN: the window and the panel grow into place; the toast replays as the sliders move
S.ui = {
  draw(lt, d){
    heading(TXT.uK, TXT.uT, lt);   // no leave(): keep the last frame clean
    const m = spring(lt, ...SPRING.default), [ax, ay, aw] = LAUNCH_STAGE;
    const k = drag(lt, .9, 2, 170, 360), dmp = drag(lt, 2.7, 3.6, 26, 11), off = drag(lt, 4.3, 5.1, 60, 28);
    appWindow(lerp(ax, 110, m), lerp(ay, 340, m), lerp(aw, 940, m), lt, { k, d: dmp, off, s0: .9, r: 12 });
    const [lx, ly, ls] = LAUNCH_PANEL, px = lerp(lx, 1150, m), py = lerp(ly, 330, m), ps = lerp(ls, 1, m);
    const o = { title: 'toast-enter', mode: 'b', rows: rows(TOAST_ROWS, [k, dmp, off, .9, 12]),
      hot: lt > .8 && lt < 2.05 ? 0 : lt > 2.6 && lt < 3.65 ? 1 : lt > 4.2 && lt < 5.15 ? 2 : -1 };
    const { L, at } = placePanelAt(o, px, py, ps);
    const knob = i => at(L.knobX(o.rows[i]), L.rows[i]);
    const c = cursorAt(lt, [[0, [1640, 980]], [.8, knob(0)], [2, knob(0)], [2.6, knob(1)], [3.6, knob(1)], [4.2, knob(2)], [5.1, knob(2)], [5.8, [1560, 980]]]);
    const held = lt > .8 && lt < 2.05 || lt > 2.6 && lt < 3.65 || lt > 4.2 && lt < 5.15;
    cursor(c[0], c[1], inv(.3, .5, lt), held ? 1 : 0);
  },
  cues: d => [[0, 'whoosh', .4, .08], [.8, 'tick', .05], ...ticks(.9, 2, 9), [2.6, 'tick', .05], ...ticks(2.7, 3.6, 7), [4.2, 'tick', .05], ...ticks(4.3, 5.1, 6)]
};

// 4 · TWEAK · 3D — a dark full-bleed stage: glass plates fan out, swing round, and replay their entrance with a new curve
const STACK_ROWS = [
  { label: 'Spread', min: 0, max: 1, orig: .1, fmt: f2 },
  { label: 'Yaw (°)', min: -45, max: 45, orig: 42, fmt: f0 },
  { label: 'Pitch (°)', min: 0, max: 60, orig: 28, fmt: f0 },
];
const EASE0 = [.2, .8, .2, 1], EASE1 = [.33, 1, .68, 1];
S.threed = {
  draw(lt, d){
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B0D12'); g.addColorStop(1, '#1C1F26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    glow(640, 690, 520, 'rgba(96,165,250,.20)', 1);
    heading(TXT.tK, TXT.tT, lt, '#FAFAFA', C.accHi);
    enter(TXT.tT2, 110, 334, lt, .12, { f: FK, w: 500, z: 52, c: '#A1A1AA', fit: 900 }, 36);
    leave(lt, d);
    const spread = drag(lt, .9, 2, .1, 1), yaw = drag(lt, 2.6, 3.6, 42, -4);
    const ek = clamp(spring(lt - 4.4, ...SPRING.snappy)), ease = EASE0.map((v, i) => lerp(v, EASE1[i], ek));
    const disp = lt < 4.4 ? 1 : lt < 4.6 ? 1 - eIO(inv(4.4, 4.6, lt)) : bez(EASE1, inv(4.6, 5.7, lt));
    pop(lt, 0, [0, 260], 640, 700, () => plates(640, 700 + Math.sin(lt * 2.2) * 6, 410, 5, spread * lerp(.05, 1, disp), yaw, 28), .6, .8);
    const o = { title: 'framework-stack', tabs: ['stack-entrance', 'stack-hover'], tab: 0, mode: 'b', rows: rows(STACK_ROWS, [spread, yaw, 28]),
      ease: { label: 'Entrance ease', v: ease, active: lt > 4.4 ? 'out-cubic' : null, changed: lt > 4.4 },
      hot: lt > .8 && lt < 2.05 ? 0 : lt > 2.5 && lt < 3.65 ? 1 : -1 };
    let L, at; pop(lt, 0, [760, 0], 1480, 520, () => ({ L, at } = placePanelAt(o, 1190, 190, .9)), 1, 1);
    if (L){ const knob = i => at(L.knobX(o.rows[i]), L.rows[i]), chip = at(L.presets['out-cubic'].x, L.presets['out-cubic'].y);
      const c = cursorAt(lt, [[0, [1640, 1000]], [.8, knob(0)], [2, knob(0)], [2.5, knob(1)], [3.6, knob(1)], [4.3, chip], [5.2, chip], [5.8, [1600, 1000]]]);
      const held = lt > .8 && lt < 2.05 || lt > 2.5 && lt < 3.65;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; cursor(c[0], c[1], inv(.3, .5, lt), held ? 1 : pressAt(lt, [4.4])); ctx.restore(); }
  },
  cues: d => [[0, 'whoosh', .4, .1], [0, 'whoosh', .3, .08], [.8, 'tick', .05], ...ticks(.9, 2, 9), [2.5, 'tick', .05], ...ticks(2.6, 3.6, 7),
    [4.4, 'blip', 990, .07], [4.6, 'whoosh', .6, .1]]
};

// 5 · SEND — one click; the values land in source as a diff
const DIFF = [
  ['-', 'stiffness: 170'], ['+', 'stiffness: 360'],
  ['-', 'damping: 26'], ['+', 'damping: 11'],
  ['-', 'offsetY: 60'], ['+', 'offsetY: 28'],
];
S.send = {
  draw(lt, d){
    leave(lt, d);
    heading(TXT.sK, TXT.sT, lt);
    const o = { title: 'toast-enter', mode: 'b', rows: rows(TOAST_ROWS, [360, 11, 28, .9, 12]), send: pressAt(lt, [1]), sent: inv(1.15, 1.45, lt) };
    const m = spring(lt, ...SPRING.default);
    const { L, at } = placePanelAt(o, lerp(1150, 110, m), lerp(300, 380, m), lerp(1, .7, m));
    const btn = at(L.send.x + L.send.w * .62, L.send.y + L.send.h * .6);
    const c = cursorAt(lt, [[0, [700, 1000]], [.85, btn], [1.6, btn], [2.2, [640, 1010]]]);
    cursor(c[0], c[1], inv(.2, .4, lt) * (1 - inv(2.2, 2.4, lt)), pressAt(lt, [1]));
    const ex = 650, ey = 330, ew = 1160, eh = 470;
    pop(lt, 1.3, [0, 50], ex + ew / 2, ey + eh, () => {
      ctx.fillStyle = '#18181B'; rrect(ex, ey, ew, eh, 20); ctx.fill();
      T('toast.tsx', ex + 40, ey + 58, { f: FM, w: 500, z: 28, c: '#A1A1AA' });
      ctx.fillStyle = '#27272A'; ctx.fillRect(ex, ey + 86, ew, 2);
      DIFF.forEach(([mk, line], i) => { const t0 = 1.5 + i * .16, la = inv(t0, t0 + .1, lt); if (la <= 0) return;
        const y = ey + 150 + i * 54;
        ctx.save(); ctx.globalAlpha *= la; ctx.fillStyle = mk === '+' ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)'; ctx.fillRect(ex + 2, y - 38, ew - 4, 50); ctx.restore();
        T(mk, ex + 40, y, { f: FM, w: 700, z: 40, c: mk === '+' ? '#4ADE80' : '#F87171', a: la });
        T(line, ex + 90, y, { f: FM, w: 700, z: 40, c: mk === '-' ? '#FCA5A5' : '#BBF7D0', a: la }); });
    });
    pop(lt, 2.9, [0, 30], 1810 - 280, 880, () => {
      const label = TXT.sDone, tw = mw(label, FK, 800, 56) + 80, x = 1810 - tw, y = 836;
      ctx.fillStyle = '#DCFCE7'; rrect(x, y, tw, 92, 46); ctx.fill();
      T(label, x + tw / 2, y + 66, { f: FK, w: 800, z: 56, c: '#166534', al: 'center' }); }, .7);
  },
  cues: d => [[1, 'stamp', .5], [1.2, 'correct'], [1.3, 'whoosh', .3, .08], ...[0, 1, 2, 3, 4, 5].map(i => [1.5 + i * .16, 'blip', 700 + i * 60, .04]), [2.9, 'stamp', .55]]
};

// 6 · CLOSE — name and install command; the last frame holds
S.close = {
  draw(lt, d){
    pop(lt, 0, [0, 40], 960, 250, () => {
      ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(24,24,27,.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      rrect(960 - 90, 190, 180, 120, 22); ctx.fill(); ctx.restore();
      [0, 1, 2].forEach(i => { const y = 222 + i * 28, k = .25 + .5 * (.5 + .5 * Math.sin(lt * 2.4 + i * 1.7));
        ctx.fillStyle = '#E4E4E7'; rrect(900, y - 2, 120, 4, 2); ctx.fill();
        ctx.fillStyle = C.ink; rrect(900, y - 2, 120 * k, 4, 2); ctx.fill();
        ctx.fillStyle = i === 1 ? C.acc : '#A1A1AA'; ctx.beginPath(); ctx.arc(900 + 120 * k, y, 8, 0, TAU); ctx.fill(); }); }, .6);
    enter(TXT.cT, 960, 500, lt, .1, { f: FD, w: 800, z: 176, al: 'center', fit: 1400 }, 50);
    enter(TXT.cS, 960, 590, lt, .3, { f: FK, w: 500, z: 56, c: C.dim, al: 'center', fit: 1400 }, 36);
    const z = 38, tw = mw(TXT.cCmd, FM, 500, z) + 130, x = 960 - tw / 2, y = 660;
    pop(lt, .7, [0, 30], 960, 706, () => {
      ctx.fillStyle = '#fff'; rrect(x, y, tw, 92, 18); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      T(typeOn(TXT.cCmd, inv(.8, 1.9, lt)), x + 40, y + 59, { f: FM, w: 500, z }); icon('copy', x + tw - 70, y + 30, 32, C.dim); }, .96);
  },
  cues: d => [[0, 'chord', 3.2], [.1, 'stamp', .55], [.7, 'whoosh', .25, .06], ...Array.from({ length: 12 }, (_, i) => [.8 + i * .092, 'tick', .025]), [1.9, 'bell']]
};

// Speed-up: each scene's timing code was written for the length in ORIG (seconds). Play it faster to fit the
// scene's length in PLAN: draw sees scaled time, and every cue moves to the matching earlier moment.
const ORIG = { problem: 7, launch: 4, ui: 6, threed: 6, send: 4.5, close: 4.5 };
for (const id of Object.keys(ORIG)){
  const sc = S[id], draw = sc.draw, cues = sc.cues, k = d => ORIG[id] / d;   // d = the scene's length from PLAN (loaded later)
  sc.draw = (lt, d, t) => draw(lt * k(d), ORIG[id], t);
  sc.cues = d => cues(ORIG[id]).map(([at, ...rest]) => [at / k(d), ...rest]);
}
