'use strict';
// Starting fires for real, and what fire leaves behind.
//   Liquids: gasoline (the Gas Can) and rubbing alcohol are poured, not dropped: hold the stream while it
//     runs and it lands a step ahead of you, wherever you walk, as organic puddles that spread out, merge
//     and follow the ground (never onto walls or water). Gasoline is dark and oily with a rainbow sheen and
//     lasts for hours; alcohol is clear and wet-looking and evaporates within the hour. Spills are kept per
//     map in the world (w.spills) and evaporate off screen too.
//   Ignition: a lighter [F] only lights a fire where enough fuel has been spilled; flames race across the
//     puddles and then catch whatever burns next to them (the usual fire, js/game/fire.js). The Pyromaniac
//     skill lets you light anything that burns with the lighter alone (fuel still works as well).
//   Burned furniture keeps its shape: it chars progressively while it burns (soot, blackened wood, holes in
//     fabric, heat-tinted metal, ash), each piece with its own pattern, and stays that way. Past a point it
//     is ruined: no prompt, no use. Walls and floors take soot wherever the flames were (a persistent,
//     smooth overlay with streaks running up the walls).
//   Persistent: w.mapMods[map].burnt (decor key -> char level) and .soot (tile -> level).
(() => {
const FS = G.FireSystem.prototype, TM = G.TileMap.prototype, GS = G.GameScene.prototype;
const fract = (v) => v - Math.floor(v), h2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
function vn(x, y, sc, s) { const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy); let fx = gx - x0, fy = gy - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = h2(x0, y0, s), b = h2(x0 + 1, y0, s), c = h2(x0, y0 + 1, s), d = h2(x0 + 1, y0 + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DIR_ANG = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];
const minutes = () => (G.world ? G.world.day * 1440 + G.world.minutes : 0);

// where the player is facing, precisely: the aim when it agrees with the way they face, else the facing
G.facingAngle = function (p) {
  const base = DIR_ANG[p.dir] != null ? DIR_ANG[p.dir] : Math.PI / 2;
  if (p.aim == null) return base;
  let d = p.aim - base; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) < 0.9 ? p.aim : base;
};

// ---------------------------------------------------------------- the liquids
const LIQ = {
  gas: { name: 'gasoline', fuel: 0.55, halfLife: 420, lin: 0.02, mul: [110, 102, 92], sheen: true },
  alcohol: { name: 'alcohol', fuel: 0.4, halfLife: 30, lin: 0.45, mul: [168, 178, 192], sheen: false },
};
G.LIQUIDS = LIQ;
const MIN_FUEL = 6;   // spilled fuel (around the spot) a lighter needs

G.spills = {
  list(w, mapId) { w.spills = w.spills || {}; return (w.spills[mapId] = w.spills[mapId] || { t: minutes(), blobs: [] }); },
  okAt(map, x, y) { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (!map.inBounds(tx, ty)) return false; const def = G.TILES[map.get(tx, ty)]; return !(def.water || def.wall || def.solid); },
  // pour some liquid at a spot: it joins the puddle there, or starts a new one; a few drops splash around
  add(fs, kind, x, y, amt, splash = true) {
    const map = fs.map, S = this.list(G.world, map.id);
    if (!S.blobs.length) S.t = minutes(); else this.evaporate(S, minutes());   // (a fresh spill does not age by the time since the last one)
    if (!this.okAt(map, x, y)) return false;
    let b = S.blobs.find((o) => o.k === kind && Math.hypot(o.x - x, o.y - y) < 4.5 && o.a < 40);
    const sp = splash && Math.random() < 0.35 ? Math.min(amt * 0.4, 0.4 + Math.random() * 0.8) : 0; amt -= sp;   // (a few drops of it splash aside)
    if (b) { b.a += amt; b.x += (x - b.x) * 0.15; b.y += (y - b.y) * 0.15; }
    else S.blobs.push(b = { x, y, a: amt, r: 0.5, k: kind, s: Math.floor(Math.random() * 1e6) });
    if (sp > 0) {
      const ang = Math.random() * Math.PI * 2, d = 4 + Math.random() * 6, sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d * 0.7;
      if (this.okAt(map, sx, sy)) S.blobs.push({ x: sx, y: sy, a: sp, r: 0.3, k: kind, s: Math.floor(Math.random() * 1e6) });
    }
    fs._liqDirty = true;
    return true;
  },
  radius(b) { return Math.sqrt(b.a) * 2.3 + 0.8; },
  // fuel per tile, from the puddles over it
  rebuild(fs) {
    fs._liqDirty = false;
    fs.oil.clear(); fs.liq = fs.liq || new Map(); fs.liq.clear();
    const map = fs.map, S = this.list(G.world, map.id);
    for (const b of S.blobs) {
      const R = this.radius(b), x0 = Math.floor((b.x - R) / 16), x1 = Math.floor((b.x + R) / 16), y0 = Math.floor((b.y - R) / 16), y1 = Math.floor((b.y + R) / 16);
      const cells = [];
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!map.inBounds(tx, ty)) continue;
        const cx = clamp(b.x, tx * 16, tx * 16 + 16), cy = clamp(b.y, ty * 16, ty * 16 + 16);
        if (Math.hypot(cx - b.x, cy - b.y) <= R) cells.push(ty * map.w + tx);
      }
      for (const i of cells) {
        const f = b.a * LIQ[b.k].fuel / cells.length;
        fs.oil.set(i, (fs.oil.get(i) || 0) + f);
        fs.liq.set(i, (fs.liq.get(i) || 0) + b.a / cells.length);
      }
    }
  },
  // evaporation, in game minutes (also for the time you were away)
  evaporate(S, now) {
    const dm = now - (S.t || now); S.t = now;
    if (dm <= 0) return false;
    for (const b of S.blobs) b.a = b.a * Math.pow(0.5, dm / LIQ[b.k].halfLife) - LIQ[b.k].lin * dm;   // (a steady loss too: a puddle dries up, it does not linger forever as a film)
    const n = S.blobs.length;
    S.blobs = S.blobs.filter((b) => b.a > 0.25);
    return true;
  },
  near(fs, tx, ty, r = 1) { let n = 0; for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (fs.map.inBounds(x, y)) n += fs.liq ? fs.liq.get(y * fs.map.w + x) || 0 : 0; return n; },
};

const _reset = FS.reset;
FS.reset = function (map) {
  _reset.call(this, map);
  if (!G.world || !map) return;
  const S = G.spills.list(G.world, map.id);
  G.spills.evaporate(S, minutes());
  for (const b of S.blobs) b.r = G.spills.radius(b);   // (already spread)
  this.liq = new Map();
  G.spills.rebuild(this);
};
// the old 3x3 pour (fire bombs, NPC arsonists): now a splash of gasoline puddles
FS.pourOil = function (tx, ty, kind = 'gas', amt = 26) {
  const cx = tx * 16 + 8, cy = ty * 16 + 10;
  for (let k = 0; k < 7; k++) { const a = Math.random() * Math.PI * 2, d = k ? 4 + Math.random() * 13 : 0; G.spills.add(this, kind, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, k ? amt * 0.12 : amt * 0.3, false); }
  G.spills.rebuild(this);
};
const _upd = FS.update;
FS.update = function (dt) {
  const r = _upd.call(this, dt);
  if (!G.world || !this.map) return r;
  const S = G.spills.list(G.world, this.map.id);
  // puddles spread out to their size, then evaporate
  for (const b of S.blobs) { const R = G.spills.radius(b); if (b.r < R) b.r = Math.min(R, b.r + dt * (6 + R)); else if (b.r > R) b.r = R; }
  if ((this._evapT = (this._evapT || 0) - dt) <= 0) { this._evapT = 2; if (G.spills.evaporate(S, minutes())) this._liqDirty = true; }
  // burning puddles are used up fast
  if (this.cells.size && S.blobs.length) {
    const W = this.map.w;
    for (const b of S.blobs) { const i = Math.floor(b.y / 16) * W + Math.floor(b.x / 16); if (this.cells.has(i)) { b.a -= dt * (b.k === 'alcohol' ? 2.6 : 1.6); this._liqDirty = true; } }
    S.blobs = S.blobs.filter((b) => b.a > 0.25);
  }
  if (this._liqDirty) G.spills.rebuild(this);
  return r;
};
// flames run across spilled fuel much faster than across anything else
const _tick = FS.tick;
FS.tick = function () {
  _tick.call(this);
  const map = this.map, W = map.w, born = [];
  if (this.liq && this.liq.size) for (const [i, c] of this.cells) {
    if (!this.liq.has(i)) continue;
    const tx = i % W, ty = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const j = (ty + dy) * W + tx + dx;
      if (map.inBounds(tx + dx, ty + dy) && !this.cells.has(j) && this.liq.has(j) && Math.random() < 0.6) born.push([j, c]);
    }
  }
  for (const [j, c] of born) if (!this.cells.has(j)) this.cells.set(j, { fuel: this.fuelAt(j), heat: 0.7, byPlayer: c.byPlayer, witnessed: c.witnessed });
  charTick(this);
};

// ---------------------------------------------------------------- drawing the puddles
let L1 = null, L2 = null;
const layer = (c, w, h) => { if (!c) c = document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); return c; };
function blobPath(x, b, ox, oy, K, r) {
  const n = 20, s = b.s, p1 = (s % 97) / 15, p2 = (s % 61) / 9, p3 = (s % 37) / 6, sq = 0.78 + ((s % 13) / 13) * 0.2;
  const pt = (k) => { const a = (k / n) * Math.PI * 2, f = 1 + 0.17 * Math.sin(3 * a + p1) + 0.11 * Math.sin(5 * a + p2) + 0.06 * Math.sin(9 * a + p3); return [(b.x - ox + Math.cos(a) * r * f) * K, (b.y - oy + Math.sin(a) * r * f * sq) * K]; };
  x.beginPath();
  const P = []; for (let k = 0; k < n; k++) P.push(pt(k));
  x.moveTo((P[0][0] + P[n - 1][0]) / 2, (P[0][1] + P[n - 1][1]) / 2);
  for (let k = 0; k < n; k++) { const a = P[k], c = P[(k + 1) % n]; x.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); }
  x.closePath();
}
function drawLiquids(ctx, fs, view, time) {
  if (!G.world || !fs.map) return;
  const S = G.spills.list(G.world, fs.map.id), vis = S.blobs.filter((b) => b.x > view.x - 30 && b.y > view.y - 30 && b.x < view.x + view.w + 30 && b.y < view.y + view.h + 30);
  if (!vis.length) return;
  const K = 2, ox = Math.floor(view.x) - 2, oy = Math.floor(view.y) - 2, W = Math.ceil(view.w + 4) * K, H = Math.ceil(view.h + 4) * K;
  // liquid stays on the ground it was poured on: never up a wall, onto furniture-solid tiles or the water
  const map = fs.map, open = new Set();
  for (const b of vis) { const R = b.r + 6; for (let ty = Math.floor((b.y - R) / 16); ty <= Math.floor((b.y + R) / 16); ty++) for (let tx = Math.floor((b.x - R) / 16); tx <= Math.floor((b.x + R) / 16); tx++) if (G.spills.okAt(map, tx * 16 + 8, ty * 16 + 8)) open.add(ty * map.w + tx); }
  ctx.save(); ctx.beginPath();
  for (const i of open) ctx.rect((i % map.w) * 16, Math.floor(i / map.w) * 16, 16, 16);
  ctx.clip();
  try { drawKinds(ctx, vis, view, time, K, ox, oy, W, H); } finally { ctx.restore(); }
}
function drawKinds(ctx, vis, view, time, K, ox, oy, W, H) {
  for (const kind of ['gas', 'alcohol']) {
    const bs = vis.filter((b) => b.k === kind && b.r > 0.4);
    if (!bs.length) continue;
    const D = LIQ[kind];
    // 1. the wet patch: one union of every puddle, multiplied into the ground (darker, richer: wet)
    L1 = layer(L1, W, H); const a = L1.getContext('2d');
    a.fillStyle = `rgb(${D.mul.join(',')})`;
    for (const b of bs) { blobPath(a, b, ox, oy, K, b.r); a.fill(); }
    // the meniscus: a darker rim just inside the edge
    L2 = layer(L2, W, H); const e = L2.getContext('2d');
    e.drawImage(L1, 0, 0);
    e.globalCompositeOperation = 'destination-out'; for (const b of bs) { blobPath(e, b, ox, oy, K, Math.max(0.2, b.r - 0.9)); e.fill(); }
    e.globalCompositeOperation = 'source-in'; e.fillStyle = kind === 'gas' ? 'rgb(70,62,56)' : 'rgb(150,158,170)'; e.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = kind === 'gas' ? 0.82 : 0.7;
    ctx.drawImage(L1, ox, oy, W / K, H / K);
    ctx.globalAlpha = kind === 'gas' ? 0.32 : 0.3;
    ctx.drawImage(L2, ox, oy, W / K, H / K);
    ctx.restore();
    // 2. the surface: reflections clipped to the puddles (a rainbow film on gasoline, a cold glint on alcohol)
    const c = L2.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
    for (const b of bs) { blobPath(c, b, ox, oy, K, b.r); c.fillStyle = '#fff'; c.fill(); }
    c.globalCompositeOperation = 'source-in';
    for (const b of bs) {
      const cx = (b.x - ox) * K, cy = (b.y - oy) * K, R = b.r * K;
      if (D.sheen) {   // thin-film interference: soft bands of violet, teal, gold drifting slowly
        for (let k = 0; k < 3; k++) {
          const hue = (b.s * 0.37 + k * 110 + time * 6 + b.x * 0.8) % 360, ang = (b.s % 7) + k * 2.1 + time * 0.05;
          const gx = cx + Math.cos(ang) * R * 0.35, gy = cy + Math.sin(ang) * R * 0.25;
          const g = c.createRadialGradient(gx, gy, R * 0.1, gx, gy, R * 0.75);
          g.addColorStop(0, `hsla(${hue},90%,64%,0.62)`); g.addColorStop(1, `hsla(${(hue + 60) % 360},80%,55%,0)`);
          c.fillStyle = g; c.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
        }
      }
      // the sky in it: a highlight toward the top-left of each puddle
      const g2 = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx - R * 0.35, cy - R * 0.4, R * 0.7);
      g2.addColorStop(0, kind === 'gas' ? 'rgba(255,255,255,0.3)' : 'rgba(230,242,255,0.38)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g2; c.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
    }
    ctx.drawImage(L2, ox, oy, W / K, H / K);
    // the bright rim on the far edge (the meniscus catching the light)
    const r = L2.getContext('2d'); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, W, H);
    for (const b of bs) { blobPath(r, b, ox, oy, K, b.r); r.fillStyle = '#fff'; r.fill(); }
    r.globalCompositeOperation = 'destination-out'; r.save(); r.translate(K * 0.8, K * 0.9); for (const b of bs) { blobPath(r, b, ox, oy, K, b.r); r.fill(); } r.restore();
    ctx.globalAlpha = kind === 'gas' ? 0.25 : 0.4; ctx.drawImage(L2, ox, oy, W / K, H / K); ctx.globalAlpha = 1;
  }
}
const _dg = FS.drawGround;
FS.drawGround = function (ctx, view) {
  const oil = this.oil; this.oil = new Map();   // (the old round oil stains are not drawn any more)
  try { _dg.call(this, ctx, view); } finally { this.oil = oil; }
  try { drawLiquids(ctx, this, view, G.loop ? G.loop.time : 0); } catch (e) { if (G.reportError) G.reportError(e); }
};

// ---------------------------------------------------------------- pouring
const POUR = { oil_flask: { kind: 'gas', amount: 60, rate: 34 }, rubbing_alcohol: { kind: 'alcohol', amount: 40, rate: 30 } };
G.pour = {
  start(scene, item) {
    const p = scene.player, P = POUR[item];
    if (!P || p.vehicle || p.swimming || p.pouring) return false;
    p.inventory.remove(item, 1);
    p.pouring = { kind: P.kind, left: P.amount, rate: P.rate, t: 0 };
    G.audio.play('eat', { x: p.x, y: p.y });
    scene.toast(P.kind === 'gas' ? 'You splash gasoline on the ground.' : 'You pour out the alcohol.');
    return true;
  },
  update(scene, p, dt) {
    const q = p.pouring;
    if (!q) return;
    if (p.dead || p.vehicle || p.swimming) { p.pouring = null; return; }
    q.t += dt;
    const ang = G.facingAngle(p), wob = Math.sin(q.t * 9) * 2, d = 13 + Math.sin(q.t * 3.1) * 2;
    const x = p.x + Math.cos(ang) * d - Math.sin(ang) * wob, y = p.y - 2 + Math.sin(ang) * d * 0.85 + Math.cos(ang) * wob * 0.5;
    const n = Math.min(q.left, q.rate * dt);
    q.left -= n;
    G.spills.add(scene.fire, q.kind, x, y, n);
    q.sx = x; q.sy = y;
    if (q.left <= 0.01) p.pouring = null;
  },
  // the stream from the container to the ground
  draw(ctx, p) {
    const q = p.pouring; if (!q || q.sx == null) return;
    const hx = p.x + Math.cos(G.facingAngle(p)) * 6, hy = p.y - 10;
    ctx.strokeStyle = q.kind === 'gas' ? 'rgba(150,120,60,0.75)' : 'rgba(210,225,240,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + q.sx) / 2, hy - 1, q.sx, q.sy); ctx.stroke();
    if (Math.random() < 0.5) { ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(q.sx + (Math.random() - 0.5) * 4, q.sy - Math.random() * 2, 1, 1); }
  },
};
const PL = G.Player.prototype, _pu = PL.update, _pd = PL.draw;
PL.update = function (dt, scene) { const r = _pu.apply(this, arguments); if (this.pouring && scene && scene.fire) G.pour.update(scene, this, dt); return r; };
PL.draw = function (ctx) { const r = _pd.apply(this, arguments); if (this.pouring) G.pour.draw(ctx, this); return r; };

// ---------------------------------------------------------------- lighting it
Object.assign(G.ITEM_USE, {
  oil_flask(game) { return G.pour.start(game, 'oil_flask'); },
  rubbing_alcohol(game) { return G.pour.start(game, 'rubbing_alcohol'); },
  torch(game) {
    const p = game.player, fs = game.fire, ang = G.facingAngle(p);
    const fx = p.x + Math.cos(ang) * 14, fy = p.y - 4 + Math.sin(ang) * 14, tx = Math.floor(fx / 16), ty = Math.floor(fy / 16);
    if (fs._liqDirty) G.spills.rebuild(fs);
    // the wettest tile within reach (the one in front, the one you stand on, the ones around)
    let best = null, bv = 0;
    for (const [x, y] of [[tx, ty], [Math.floor(p.x / 16), Math.floor((p.y - 3) / 16)], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) {
      const v = fs.map.inBounds(x, y) && fs.liq ? fs.liq.get(y * fs.map.w + x) || 0 : 0;
      if (v > bv) { bv = v; best = [x, y]; }
    }
    const around = G.spills.near(fs, tx, ty, 1);
    if (best && around >= MIN_FUEL) { if (G.fireTools.start(game, best[0], best[1], 'torch')) { G.audio.play('swing'); fs.cells.get(best[1] * fs.map.w + best[0]).heat = 0.8; } return true; }
    if (G.skills.has(p, 'pyromaniac')) { if (G.fireTools.start(game, tx, ty, 'torch')) G.audio.play('swing'); return true; }
    G.audio.play('click');
    game.toast(around > 0 ? 'The flame licks at it, but there is not enough fuel there to catch.' : 'The lighter flame alone will not catch. Pour something flammable first, like gasoline or alcohol.');
    return true;
  },
});
G.ITEMS.torch.desc = 'Lights spilled gasoline or alcohol (press F near it). Pyromaniacs can set fire to anything that burns.';
G.ITEMS.oil_flask.desc = 'Gasoline. Pour it on the ground in front of you (walk while pouring to lay a trail). It burns hot and lasts for hours before evaporating.';
G.ITEMS.rubbing_alcohol = { id: 'rubbing_alcohol', name: 'Rubbing Alcohol', type: 'tool', icon: 'rubbing_alcohol', value: 4, stack: 10, desc: 'Isopropyl alcohol. Disinfects, and pours out into a puddle that lights with a lighter. Burns fast and evaporates within the hour.' };
for (const sh of Object.values(G.SHOPS || {})) if (sh.stock && sh.stock.some((e) => e[0] === 'bandage') && !sh.stock.some((e) => e[0] === 'rubbing_alcohol')) sh.stock.push(['rubbing_alcohol', 5]);
const _ainit = G.assets.init;
G.assets.init = function () {
  const r = _ainit.apply(this, arguments);
  const A = G.assets, { c, x } = A.mk(16, 16);
  x.fillStyle = '#f0f4f8'; x.fillRect(5, 1, 6, 2); x.fillStyle = 'rgba(200,225,245,0.95)'; x.fillRect(4, 4, 8, 11);
  x.fillStyle = '#2a5ab0'; x.fillRect(4, 7, 8, 5); x.fillStyle = '#ffffff'; x.fillRect(5, 9, 6, 1); x.fillRect(5, 5, 1, 1);
  A.outline(c); A.icons.rubbing_alcohol = c;
  return r;
};

// ---------------------------------------------------------------- Pyromaniac
G.SKILLS.pyromaniac = { branch: 'street', pos: [1, 3], ranks: 1, icon: 'torch', name: 'Pyromaniac', req: [['street_smarts', 1]],
  desc: 'You know how to make anything burn. A lighter alone sets fire to whatever burns, no fuel needed.' };

// ---------------------------------------------------------------- charred furniture, sooty walls and floors
const VEG = /oak|pine|palm|tree|bush|hedge|crop|wheat|flower|grass|stump|log/;
const furnitureLike = (d) => !d.def.flat && (!d.def.burnsTo || d.def.burnsTo === 'char_pile') && !VEG.test(d.type);   // (it used to burn down to a char pile: now it keeps its shape, charred)
const modsOf = (map) => { const m = G.world.modsFor(map.id); m.burnt = m.burnt || {}; m.soot = m.soot || {}; return m; };
const RUINED = 0.6;   // beyond this, the piece is unusable
const KEEP = /gate|boat|car|well|stair|door|elevator|ladder|exit/;   // (never locked out of a way through)
function setChar(map, d, v, save = true) {
  d.burnt = v;
  if (v >= RUINED && !d.def.burntOf && !KEEP.test(d.def.interact || '')) d.def = Object.assign({}, d.def, { fuel: 0, flam: 0, interact: null, breakHp: null, burntOf: d.def });
  if (save) modsOf(map).burnt[map.decorKey(d)] = Math.round(v * 100) / 100;
}
G.burns = { RUINED, setChar, usable: (d) => !(d && d.burnt >= RUINED), soot(map, i, v) { modsOf(map).soot[i] = v; sootQ(map, i); } };
function charTick(fs) {
  if (!fs.cells.size || !G.world) return;
  const map = fs.map, W = map.w, m = modsOf(map);
  for (const [i, c] of fs.cells) {
    const tx = i % W, ty = Math.floor(i / W), heat = c.heat || 0;
    for (const d of map.decorsAt(tx, ty)) if (furnitureLike(d) && (d.burnt || 0) < 1) setChar(map, d, Math.min(1, (d.burnt || 0) + 0.014 * (0.4 + heat)));
    const s0 = m.soot[i] || 0, s1 = Math.min(1, s0 + 0.03 * (0.3 + heat));
    if (Math.floor(s1 * 8) !== Math.floor(s0 * 8)) sootQ(map, i);
    m.soot[i] = Math.round(s1 * 100) / 100;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) {   // the heat blackens the walls next to it too
      const nx = tx + dx, ny = ty + dy; if (!map.inBounds(nx, ny)) continue;
      const def = G.TILES[map.get(nx, ny)]; if (!def || !def.wall) continue;
      const j = ny * W + nx, a0 = m.soot[j] || 0, a1 = Math.min(1, a0 + 0.012 * heat);
      if (Math.floor(a1 * 8) !== Math.floor(a0 * 8)) sootQ(map, j);
      m.soot[j] = Math.round(a1 * 100) / 100;
    }
  }
}
// burning out no longer deletes furniture: it is left charred (trees, crops and things that turn into something else still do)
const _bo = FS.burnOut;
FS.burnOut = function (i, c) {
  const map = this.map, tx = i % map.w, ty = Math.floor(i / map.w);
  for (const d of map.decorsAt(tx, ty)) if (furnitureLike(d) && d.def.fuel) setChar(map, d, 1);
  if (G.world) { const S = G.spills.list(G.world, map.id); S.blobs = S.blobs.filter((b) => Math.floor(b.y / 16) * map.w + Math.floor(b.x / 16) !== i); this._liqDirty = true; }
  return _bo.call(this, i, c);
};
const _apply = TM.applyMods;
TM.applyMods = function (mods) {
  const r = _apply.apply(this, arguments);
  if (mods && mods.burnt) { const by = new Map(this.decor.map((d) => [this.decorKey(d), d])); for (const k in mods.burnt) { const d = by.get(k); if (d) setChar(this, d, mods.burnt[k], false); } }
  if (mods && mods.soot) { this.sootCanvas = null; for (const i in mods.soot) sootQ(this, +i); }
  return r;
};

// the charred look, made once per piece and level: its own sprite, darkened by material with noise
const METAL = /fridge|stove|oven|washer|sink|toilet|vending|tv|computer|cooler|locker|safe|watercooler|radiator|grill|bbq|dumpster|trash|mailbox|car|atm|machine|lamp|bath|shower/;
const FABRIC = /bed|couch|sofa|armchair|rug|curtain|clothes|mattress|cushion|pillow|towel|tent/;
const PLANT = /plant|flower|pot/;
function charCanvas(o, s, draw) {
  const lvl = Math.round(o.burnt * 10) / 10;
  if (o._char && o._char.lvl === lvl) return o._char;
  const K = 2, pad = 6, W = (s.w + pad * 2) * K, H = (s.h + pad * 2) * K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), x0 = o.x - s.ax, y0 = o.y - s.ay;
  x.setTransform(K, 0, 0, K, (-x0 + pad) * K, (-y0 + pad) * K);
  draw(x);
  const img = x.getImageData(0, 0, W, H), d = img.data, type = o.type || o.def.sprite || '';
  const mat = METAL.test(type) ? 'metal' : FABRIC.test(type) ? 'fabric' : PLANT.test(type) ? 'plant' : 'wood';
  const seed = G.util.hashString ? G.util.hashString((o.type || '') + o.tx + ',' + o.ty) % 997 : (o.tx * 31 + o.ty * 17) % 997;
  const solid = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H && d[(Y * W + X) * 4 + 3] > 40;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const p = (Y * W + X) * 4; if (d[p + 3] < 8) continue;
    let r = d[p], g = d[p + 1], b = d[p + 2];
    const n = vn(X, Y, 14, seed) * 0.6 + vn(X, Y, 6, seed + 1) * 0.3 + vn(X, Y, 2.5, seed + 2) * 0.1;   // smooth, at the scale of the piece (no pixel noise)
    const up = 1 - Y / H;   // fire climbs: tops and edges go first
    const edge = !solid(X - 2, Y) || !solid(X + 2, Y) || !solid(X, Y - 2) || !solid(X, Y + 2);
    const m = clamp((lvl * 1.5 - n * 0.9 + up * 0.2 + (edge ? 0.1 : 0) - 0.25) * 2.6, 0, 1);
    const lum = (r * 0.3 + g * 0.59 + b * 0.11);
    if (mat === 'metal') {   // heat tint and soot: browned, blued in soft bands, sooty streaks rising
      const band = Math.sin(Y * 0.12 + n * 5 + seed) * 0.5 + 0.5, streak = vn(X, Y * 0.2, 5, seed + 3);
      const t = clamp(lvl * 1.2 - 0.1, 0, 1) * 0.55;
      r = r * (1 - t) + t * (96 - band * 26); g = g * (1 - t) + t * (74 - band * 8); b = b * (1 - t) + t * (58 + band * 34);
      const soot = clamp(m * (0.45 + streak * 0.6) * (0.5 + up * 0.7), 0, 0.9);
      r = r * (1 - soot) + 22 * soot; g = g * (1 - soot) + 20 * soot; b = b * (1 - soot) + 19 * soot;
    } else {
      // charred: black, but the shading of the piece stays readable; a brown scorch fringe where it gives way
      const fringe = clamp((m - 0.1) * 3.5, 0, 1) - clamp((m - 0.5) * 3.5, 0, 1);
      const charV = 12 + lum * 0.2 + (vn(X, Y, 4, seed + 4) - 0.5) * 12;
      r = r * (1 - m) + charV * m; g = g * (1 - m) + charV * 0.86 * m; b = b * (1 - m) + charV * 0.76 * m;
      r = r * (1 - fringe * 0.5) + 92 * fringe * 0.5; g = g * (1 - fringe * 0.5) + 52 * fringe * 0.5; b = b * (1 - fringe * 0.5) + 24 * fringe * 0.5;
      if (mat === 'wood' && m > 0.75) {   // alligator charring: an organic web of grey cracks
        const ridge = Math.abs(vn(X, Y, 16, seed + 5) - 0.5);
        if (ridge < 0.016) { const v = 44 + (0.016 - ridge) * 900; r = v; g = v * 0.95; b = v * 0.9; }
      }
      if (mat === 'fabric' && m > 0.9 && !edge && lvl >= 0.8 && vn(X, Y, 9, seed + 7) > 0.64) { const spring = (Y % 7 < 1) && (X % 5 < 3); r = spring ? 84 : 7; g = spring ? 80 : 6; b = spring ? 76 : 5; }   // burnt through to the springs (the frame keeps its shape)
      if (mat === 'plant' && m > 0.85 && up > 0.45 && vn(X, Y, 5, seed + 8) > 0.55) { d[p + 3] = 0; continue; }           // the leaves are gone
    }
    const ash = vn(X, Y, 10, seed + 9);
    if (lvl >= 0.7 && m > 0.6 && ash > 0.8 && up > 0.3) { const k2 = clamp((ash - 0.8) * 8, 0, 1) * 0.7, v = 108; r = r * (1 - k2) + v * k2; g = g * (1 - k2) + v * 0.97 * k2; b = b * (1 - k2) + v * 0.93 * k2; }   // grey ash settled in patches
    if (lum > 200 && mat !== 'metal') { b *= 1 - lvl * 0.25; }   // (whites yellow before they blacken)
    d[p] = clamp(r, 0, 255); d[p + 1] = clamp(g, 0, 255); d[p + 2] = clamp(b, 0, 255);
  }
  x.putImageData(img, 0, 0);
  return (o._char = { lvl, c, ox: x0 - pad, oy: y0 - pad, w: W / K, h: H / K });
}
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  if (!(o.burnt > 0.04) || !s) return _dd.call(this, ctx, o, s, scene);
  let ch;
  try { ch = charCanvas(o, s, (x) => _dd.call(this, x, o, s, scene)); } catch (e) { return _dd.call(this, ctx, o, s, scene); }
  ctx.drawImage(ch.c, ch.ox, ch.oy, ch.w, ch.h);
  // still smouldering: embers glow in the char while the fire is on it
  const fs = scene && scene.fire;
  if (fs && fs.isBurning && fs.isBurning(o.tx, o.ty) && o.burnt < 1) {
    for (let k = 0; k < 4; k++) { const a = h2(o.tx, o.ty, k + Math.floor(G.loop.time * 3)); if (a > 0.6) { ctx.fillStyle = a > 0.85 ? '#ffb040' : '#c8401a'; ctx.fillRect(Math.round(ch.ox + 6 + a * (ch.w - 12)), Math.round(ch.oy + 6 + h2(k, o.tx, o.ty) * (ch.h - 12)), 1, 1); } }
  }
};

// soot: a smooth overlay over floors and walls, repainted a few tiles at a time
function sootQ(map, i) { (map._sootQ = map._sootQ || new Set()).add(i); }
function paintSoot(map, tx, ty) {
  const m = G.world && G.world.mapMods && G.world.mapMods[map.id], S = m && m.soot; if (!S) return;
  if (!map.sootCanvas || map.sootCanvas.width !== map.w * 16) { map.sootCanvas = document.createElement('canvas'); map.sootCanvas.width = map.w * 16; map.sootCanvas.height = map.h * 16; }
  const x0 = Math.max(0, tx - 1), y0 = Math.max(0, ty - 1), x1 = Math.min(map.w - 1, tx + 1), y1 = Math.min(map.h - 1, ty + 1);
  const w = (x1 - x0 + 1) * 16, h = (y1 - y0 + 1) * 16, img = new ImageData(w, h), d = img.data;
  const lv = (x, y) => (map.inBounds(x, y) ? S[y * map.w + x] || 0 : 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x0 * 16 + x, Y = y0 * 16 + y, gx = X / 16 - 0.5, gy = Y / 16 - 0.5, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const f = lv(ix, iy) * (1 - fx) * (1 - fy) + lv(ix + 1, iy) * fx * (1 - fy) + lv(ix, iy + 1) * (1 - fx) * fy + lv(ix + 1, iy + 1) * fx * fy;
    if (f <= 0.01) continue;
    const def = G.TILES[map.get(Math.floor(X / 16), Math.floor(Y / 16))] || {};
    let a;
    if (def.wall) a = clamp(f * 1.5 - 0.15 + (vn(X, Y * 0.2, 3, 21) - 0.5) * 0.9 + (1 - (Y % 16) / 16) * 0.25, 0, 0.88);   // streaks running up the wall
    else a = clamp(f * 1.3 - 0.2 + (vn(X, Y, 10, 22) - 0.5) * 0.7 + (vn(X, Y, 3, 23) - 0.5) * 0.25, 0, 0.8);
    if (a <= 0) continue;
    const p = (y * w + x) * 4, k = h2(X, Y, 24);
    d[p] = 16 + k * 10; d[p + 1] = 13 + k * 8; d[p + 2] = 11 + k * 7; d[p + 3] = a * 255;
  }
  map.sootCanvas.getContext('2d').putImageData(img, x0 * 16, y0 * 16);
}
const _tdg = TM.drawGround;
TM.drawGround = function (ctx, view, time) {
  const r = _tdg.apply(this, arguments);
  const q = this._sootQ;
  if (q && q.size && G.world) { let n = 0; for (const i of q) { q.delete(i); try { paintSoot(this, i % this.w, Math.floor(i / this.w)); } catch (e) { /* plain */ } if (++n >= 6) break; } }
  if (this.sootCanvas) { const sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y)), sw = Math.min(this.pw - sx, Math.ceil(view.w)), sh = Math.min(this.ph - sy, Math.ceil(view.h)); if (sw > 0 && sh > 0) ctx.drawImage(this.sootCanvas, sx, sy, sw, sh, sx, sy, sw, sh); }
  return r;
};

// ruined furniture: no prompt, no use (the decor finder skips it; anything else that points at it is dropped)
const _find = GS.findInteraction;
GS.findInteraction = function () {
  const t = _find.call(this);
  if (t && t.type === 'decor' && t.ref && t.ref.burnt >= RUINED) return null;
  return t;
};
})();
