'use strict';
// Smoking takes a while. Lighting up (a cigarette, a joint, a cigar, a pipe of weed, crack or DMT) puts it in
// your mouth, and you smoke it down over a couple of minutes: a drag every few seconds (the ember glows),
// smoke curling off the tip, a cloud when you breathe out. The effects start with the first drag. You can
// walk around, talk and fight while it burns; swimming puts it out. "Stop smoking" in the inventory (or
// lighting something else) puts it out early, and before the first drag you get it back.
// Smoking something illegal where people can see it is still a crime (each check while it burns).
//   p.smoking = { id, t, len, applied, puffT, reported }
(() => {
const LEN = { cigarettes: 120, joint: 120, cigar: 180, weed: 60, crack: 20, dmt: 15 };
const LOOK = {   // what is in your mouth: stick color, tip color, thickness, a pipe?
  cigarettes: { col: '#f0ece4', tip: '#d8a050', w: 1 }, joint: { col: '#ece8d8', tip: '#ece8d8', w: 1, cone: true }, cigar: { col: '#6a4024', tip: '#5a3420', w: 2 },
  weed: { col: '#5a4a3a', w: 1, pipe: true }, crack: { col: '#b8d8e8', w: 1, pipe: true }, dmt: { col: '#b8d8e8', w: 1, pipe: true },
};
const FIRST_DRAG = 2.5;

// sounds: lighter, inhale and exhale are synthesized in js/engine/audio.js

G.smoking = {
  LEN,
  start(p, id, scene) {
    if (p.smoking) this.stop(p, scene, true);
    p.smoking = { id, t: 0, len: LEN[id] || 90, applied: false, puffT: FIRST_DRAG, reported: false, wisps: [] };
    G.audio.play('lighter');
    if (scene) scene.toast(`You light up ${G.item(id).name.toLowerCase()}.`, 'info');
  },
  stop(p, scene, quiet) {
    const s = p.smoking; if (!s) return;
    p.smoking = null;
    if (!s.applied) { p.inventory.add(s.id, 1); if (scene && !quiet) scene.toast('You put it out before you even started. Saved for later.'); return; }
    if (scene && !quiet) scene.toast(s.t >= s.len - 1 ? 'Finished.' : 'You put it out.');
  },
  update(p, dt, scene) {
    const s = p.smoking; if (!s) return;
    if (p.dead || p.swimming) { this.stop(p, scene, p.dead); if (p.swimming && scene) scene.toast('Your smoke is soaked. Gone.'); return; }
    s.t += dt;
    // a drag every few seconds: the ember flares, then you breathe out a cloud
    if ((s.puffT -= dt) <= 0) {
      s.puffT = G.rng.range(7, 11) * (s.len < 30 ? 0.4 : 1);
      s.drag = 1.1; G.audio.play('inhale');
      if (!s.applied) {
        s.applied = true;
        G.effects.consume(p, G.ITEMS[s.id] || G.item(s.id), scene);   // the effects (and any drug-use crime) start with the first drag
        G.audio.play('eat');
      }
    }
    if (s.drag > 0) { s.drag -= dt; if (s.drag <= 0) { s.exhale = 1.6; G.audio.play('exhale'); } }
    if (s.exhale > 0) s.exhale -= dt;
    // smoke: a thin wisp off the tip, a cloud on the breath out
    const tip = this.tip(p), m = this.mouth(p);
    if (Math.random() < dt * (s.drag > 0 ? 2 : 6)) s.wisps.push({ x: tip.x, y: tip.y, vx: G.rng.range(-3, 3), vy: -G.rng.range(6, 10), r: 1, a: 0.45, t: 0 });
    if (s.exhale > 0.8 && Math.random() < dt * 30) {
      const dirx = [0, -1, 1, 0][p.dir], diry = [1, 0, 0, -1][p.dir];
      s.wisps.push({ x: m.x + dirx * 2, y: m.y + 1, vx: dirx * G.rng.range(8, 16) + G.rng.range(-4, 4), vy: diry * G.rng.range(4, 8) - G.rng.range(3, 8), r: 1.5, a: 0.5, t: 0 });
    }
    for (const w of s.wisps) { w.t += dt; w.x += w.vx * dt; w.y += w.vy * dt; w.vx *= 0.98; w.r += dt * 2.2; w.a -= dt * 0.22; }
    s.wisps = s.wisps.filter((w) => w.a > 0).slice(-60);
    // illegal smoke where someone can see it: a crime (checked now and then while it burns, once)
    const it = G.item(s.id);
    if (it.illegal && s.applied && !s.reported && scene && (s.checkT = (s.checkT || 0) - dt) <= 0) {
      s.checkT = 8;
      const before = scene.world.stats.crimes;
      scene.reportDrugUse();
      if (scene.world.stats.crimes !== before || (scene.pendingReports || []).length) s.reported = true;
    }
    if (s.t >= s.len) this.stop(p, scene);
  },
  mouth(p) {
    const s = p.sheet, top = p.y - (s ? s.fh : 20) + 1;
    return { x: p.x + [0, -2, 2, 0][p.dir], y: top + 7 };
  },
  tip(p) {
    const s = p.smoking, m = this.mouth(p), left = s ? 1 - s.t / s.len : 1, L = LOOK[s && s.id] || LOOK.cigarettes;
    const len = L.pipe ? 4 : 2 + Math.round(4 * left);
    const dx = [1, -1, 1, 0][p.dir], dy = [0.4, 0.2, 0.2, 0][p.dir];
    return { x: m.x + dx * (len + (p.dir === 0 ? 1 : 1)), y: m.y + dy * len };
  },
  draw(ctx, p) {
    const s = p.smoking; if (!s || p.vehicle) return;
    const L = LOOK[s.id] || LOOK.cigarettes, m = this.mouth(p), left = 1 - s.t / s.len;
    if (p.dir !== 3) {   // (seen from behind, only the smoke shows)
      const dx = [1, -1, 1][p.dir], len = L.pipe ? 4 : 2 + Math.round(4 * left), x0 = Math.round(m.x + dx), y0 = Math.round(m.y);
      ctx.fillStyle = L.col;
      for (let i = 0; i < len; i++) ctx.fillRect(x0 + dx * i, y0 + (p.dir === 0 && i > 1 ? 1 : 0), 1, L.w + (L.cone && i === len - 1 ? 1 : 0));
      if (L.pipe) { ctx.fillStyle = '#d8eef8'; ctx.fillRect(x0 + dx * len, y0 - 1, 1, 2); }
      else if (L.tip && s.id === 'cigarettes') { ctx.fillStyle = L.tip; ctx.fillRect(x0, y0, 1, 1); }
      const tx = x0 + dx * len, ty = y0 + (p.dir === 0 && len > 2 ? 1 : 0);
      const glow = s.drag > 0 ? 1 : 0.55 + Math.sin(G.loop.time * 5) * 0.15;
      ctx.fillStyle = `rgba(255,${Math.round(110 + 60 * glow)},40,${glow})`; ctx.fillRect(tx, ty, 1, L.w);
      if (s.drag > 0) { ctx.fillStyle = 'rgba(255,140,60,0.25)'; ctx.fillRect(tx - 1, ty - 1, 3, 3); }
    }
    for (const w of s.wisps) {
      ctx.fillStyle = `rgba(210,210,215,${Math.max(0, w.a)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill();
    }
  },
};

// lighting up from the inventory starts it (instead of using it all at once)
const PL = G.Player.prototype, _use = PL.useFromSlot, _upd = PL.update, _draw = PL.draw;
PL.useFromSlot = function (i, scene) {
  const s = this.inventory.slots[i];
  if (!s || !G.SMOKEABLE.includes(s.id) || G.ITEM_USE[s.id]) return _use.call(this, i, scene);
  const it = G.ITEMS[s.id] || G.item(s.id);
  if (!this.inventory.has('torch')) { if (scene) scene.toast(`You need a lighter to smoke ${it.name.toLowerCase()}.`, 'bad'); return false; }
  if (this.swimming) { if (scene) scene.toast('Not in the water.', 'bad'); return false; }
  const id = s.id;
  this.inventory.removeAt(i, 1);
  G.smoking.start(this, id, scene);
  return true;
};
PL.update = function (dt, scene) { const r = _upd.apply(this, arguments); if (scene && scene.map) G.smoking.update(this, dt, scene); return r; };
PL.draw = function (ctx) { _draw.call(this, ctx); G.smoking.draw(ctx, this); };

// the inventory: what you are smoking, and a button to put it out
const IS = G.InventoryScene.prototype, _iu = IS.update, _ir = IS.render;
IS.update = function () {
  const p = this.game.player;
  if (p.smoking && G.input.pressed.has('KeyC')) { G.smoking.stop(p, this.game); G.audio.play('back'); return; }
  return _iu.call(this);
};
IS.render = function (ctx) {
  _ir.call(this, ctx);
  const p = this.game.player, s = p.smoking;
  if (!s) return;
  const U = G.ui, R = G.renderer, W = 440, H = 300, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
  const left = Math.max(0, Math.ceil(s.len - s.t));
  U.icon(ctx, G.item(s.id).icon, x + W - 196, y + 8, 0.9);
  U.text(ctx, `Smoking: ${G.item(s.id).name} (${left}s left)`, x + W - 178, y + 11, { size: 8, color: '#e8c8a0' });
  const b = U.button(ctx, x + W - 112, y + 24, 98, 16, 'Stop smoking [C]');
  if (b.clicked) { G.smoking.stop(p, this.game); G.audio.play('back'); }
};
})();
