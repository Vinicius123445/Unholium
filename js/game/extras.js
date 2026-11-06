'use strict';
// Leftovers from the specs:
//   Planting evidence: slip the weapon you used into someone's pocket ([Plant evidence] in conversation,
//     a stealth check): they become the prime suspect, the case leans away from you. Caught: trouble.
//   Plainclothes police: off-duty and plainclothes officers walk the city like anyone else, and step in
//     when they see a crime.
//   ID checks: with heat on you, a cop on the street may stop you for ID. A mask is a bad answer.
//   On the body: a watch on the wrist, a backpack on the back, a pistol holstered at the hip; bruises
//     after a beating; pale and green when sick, poisoned or in withdrawal.
//   Inertia: bodies lean into starts and stops (a small spring driven by acceleration).
//   Motion smoothing: what is drawn sits between the last two game steps (no stutter at 120+ Hz).
(() => {
const L = G.law, pick = (a) => G.rng.pick(a), A = G.assets;
const gameScene = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);

// ---------------------------------------------------------------- planting evidence
const caseWeapons = (w) => {
  const s = L.state(w), out = [];
  for (const c of s.cases) if (c.status === 'open' && c.killer === 'player') { const k = s.kills[c.victim]; if (k && k.weapon && k.weapon !== 'hands') out.push({ c, weapon: k.weapon }); }
  return out;
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world, p = scene.player;
  if (npc.def.kid || npc.remote || npc.transient || npc.def.combat === 'guard') return [];
  const have = caseWeapons(w).filter((x) => p.inventory.has(x.weapon));
  if (!have.length) return [];
  const it = G.item(have[0].weapon);
  return [{ text: `[Plant evidence] Slip the ${it.name.toLowerCase()} into their pocket.`, do: (c) => {
    const ok = Math.random() < G.util.clamp(0.35 + (G.skills.stat(p, 'stealth') || 0) * 0.1 + G.skills.rank(p, 'pickpocket') * 0.1 + (G.attr ? (G.attr.get(p, 'luck') - 3) * 0.03 : 0), 0.1, 0.85);
    if (ok) {
      p.inventory.remove(have[0].weapon, 1); npc.st.inv.push([have[0].weapon, 1]);
      for (const x of have.filter((h) => h.weapon === have[0].weapon)) { x.c.planted = npc.id; if (!x.c.suspects.includes(npc.id)) x.c.suspects.push(npc.id); x.c.evidence = Math.max(0.05, x.c.evidence - 0.15); }
      scene.toast('Planted. They have no idea.', 'warn');
    } else {
      npc.st.fear = Math.max(npc.st.fear || 0, 60); G.social.addDisp(w, npc.id, -30);
      for (const x of have) x.c.evidence = Math.min(0.95, x.c.evidence + 0.2);
      npc.say('Hey! What did you just put in my pocket?!', 3);
      scene.reportCrime('assault', npc);
    }
    return null;
  } }];
});
// a planted suspect is the one who usually takes the fall when the case is solved
const _solve = L.solve;
L.solve = function (w, c, rng = G.rng) {
  if (c.planted && c.killer === 'player' && w.npcs[c.planted] && w.npcs[c.planted].alive && rng.chance(0.65)) { const k = c.killer; c.killer = c.planted; c.realKiller = k; const r = _solve.call(this, w, c, rng); c.killer = k; c.wrong = true; return r; }
  return _solve.call(this, w, c, rng);
};

// ---------------------------------------------------------------- plainclothes officers, ID checks
const CIV = () => ({ top: pick(['jacket', 'shirt', 'hoodie']), shirt: pick(['#4a4a52', '#5a4a3a', '#2a3a4a', '#6a6a6a']), pants: pick(['#2a2a30', '#3a3a44', '#4a3a2a']) });
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  try {
    const w = this.world, map = this.map, p = this.player;
    if (map.meta.region === 'city' && map.meta.district !== 'jail' && !L.off && (this._pcT = (this._pcT || 20) - dt) <= 0) {
      this._pcT = 60;
      const have = this.actors.filter((a) => a.law === 'plainclothes' && !a.dead).length;
      if (have < 1 && Math.random() < 0.5) {
        const e = map.randomWalkableNear(Math.floor(p.x / 16) + G.rng.int(-25, 25), Math.floor(p.y / 16) + G.rng.int(-18, 18), 6, G.rng, false);
        if (e && !this.isOnScreen(e.x * 16, e.y * 16)) {
          const n = L.spawn(this, { name: G.rng.chance(0.5) ? 'Plainclothes Officer' : 'Off-Duty Cop', look: CIV(), weapon: 'pistol', role: 'plainclothes', to: { x: e.x * 16, y: e.y * 16 } }, e.x * 16 + 8, e.y * 16 + 12);
          n.def.schedule = [{ from: 0, to: 24, at: { x: e.x, y: e.y }, act: 'wander' }];
          n.leaveT = 240;
        }
      }
    }
    // ID checks: heat on you, a cop nearby, now and then
    const heat = w.bounty[this.region] || 0;
    if (heat > 0 && !L.off && !p.vehicle && (this._idT = (this._idT || 30) - dt) <= 0) {
      this._idT = 45;
      const cop = this.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.state === 'schedule' && a.distTo(p) < 70 && a.canSee(this, p, 70));
      if (cop && Math.random() < 0.6) {
        cop.faceTowards(p);
        if (p.equip.mask) { cop.say('Take that mask off. Now. Let me see some ID.', 3); cop.state = 'arrest'; }
        else if (L.recognized(this) && Math.random() < 0.5 + heat / 800) { cop.say('ID, please... Hold on. You match a description.', 3); cop.state = 'arrest'; }
        else cop.say(pick(['ID, please. ...Alright, move along.', 'Evening. Just checking. Go on.']), 3);
      }
    }
    // bruises fade after a day
    for (const a of this.actors) if (a.bruiseT > 0) a.bruiseT -= dt;
  } catch (e) { G.reportError && G.reportError(e); }
  return r;
};

// ---------------------------------------------------------------- bruises
const _dmg = G.combat.damage;
G.combat.damage = function (target, dmg, source, scene, o = {}) {
  const r = _dmg.apply(this, arguments);
  if (target && !target.dead && !o.bullet && source && source.kind !== 'fire' && dmg >= 4 && !(target.def && target.def.kid)) { target.bruiseT = 600; target.bruiseSeed = target.bruiseSeed || G.rng.int(1, 999); }
  return r;
};

// ---------------------------------------------------------------- on the body, inertia, sickness (HD people)
const AP = G.Actor.prototype, _draw = AP.draw;
AP.draw = function (ctx) {
  const hd = this.sheet && !this.sheet.animal && this.kind !== 'animal' && this.kind !== 'vehicle' && G.hd.get(this.sheet);
  if (!hd || this.sleeping || this.seated) return _draw.call(this, ctx);
  // inertia: a spring that leans the body against acceleration
  const sp = this._spr || (this._spr = { vx: 0, lean: 0, v: 0, lx: this.x });
  const dt = Math.min(0.1, Math.max(0.001, G.loop.time - (sp.t || G.loop.time))); sp.t = G.loop.time;
  const vx = (this.x - sp.lx) / dt; sp.lx = this.x;
  const acc = (vx - sp.vx) / dt; sp.vx += (vx - sp.vx) * Math.min(1, dt * 20);
  sp.v += (-acc * 0.00004 - sp.lean * 60 - sp.v * 9) * dt; sp.lean = G.util.clamp(sp.lean + sp.v * dt, -0.09, 0.09);
  ctx.save();
  if (Math.abs(sp.lean) > 0.004) { ctx.translate(this.x, this.y); ctx.transform(1, 0, sp.lean, 1, 0, 0); ctx.translate(-this.x, -this.y); }
  // sick: pale and greenish
  const v = this.kind === 'player' && G.effects.visuals ? G.effects.visuals(this) : null;
  const sick = v ? Math.min(1, v.poison + v.nausea * 0.6 + v.crash * 0.5 + v.resp * 0.6) : (this.hp < (this.maxHp || 30) * 0.25 ? 0.5 : 0);
  if (sick > 0.05) ctx.filter = `saturate(${(1 - sick * 0.5).toFixed(2)}) hue-rotate(${Math.round(sick * 25)}deg) brightness(${(1 + sick * 0.06).toFixed(2)})`;
  _draw.call(this, ctx);
  ctx.filter = 'none';
  const f = this._hdFrame || { col: 0, dir: this.dir }, X = G.hd.WW / 16, x0 = this.x - G.hd.WW / 2, y0 = this.y - 21, back = f.dir === 3, side = f.dir === 1 || f.dir === 2, s = f.dir === 2 ? 1 : -1;
  const hp = hd.heads[f.dir] && hd.heads[f.dir][f.col];
  // a bruise on the face
  if (this.bruiseT > 0 && hp && !back) { ctx.fillStyle = 'rgba(90,40,110,0.85)'; ctx.fillRect(x0 + X * 2 * 0.5 * (hp.hx + (side ? (s > 0 ? 5 : 2) : 5)) * 0.5, y0 + (hp.hy + 5 * (hp.hs || 1)) * 0.5, 1, 0.5); }
  if (this.kind === 'player') {
    const inv = this.inventory;
    // a watch on the left wrist
    const t = this.equip && this.equip.trinket && G.item(this.equip.trinket);
    if ((t && t.watch) || (inv && inv.slots.some((q) => q && G.ITEMS[q.id] && G.ITEMS[q.id].watch))) { ctx.fillStyle = '#c8c8d0'; ctx.fillRect(x0 + X * (side ? 8 : 3), y0 + 13.5, 1, 0.5); }
    // a backpack
    if (inv && inv.slots.some((q) => q && /backpack/.test(q.id))) {
      ctx.fillStyle = '#3a4a3a';
      if (back) ctx.fillRect(x0 + X * 5, y0 + 8, 6, 5); else if (side) ctx.fillRect(x0 + X * (s > 0 ? 4 : 10), y0 + 8, 2, 5); else { ctx.fillRect(x0 + X * 4.5, y0 + 7.5, 0.5, 4); ctx.fillRect(x0 + X * 11, y0 + 7.5, 0.5, 4); }
    }
  }
  // a pistol in its holster when it is not in use
  const wi = this.weaponItem || (this.def && this.def.weapon && G.ITEMS[this.def.weapon]);
  if (wi && wi.gun && wi.cat === 'pistol' && !(this.shotT > 0) && this.state !== 'fight' && !(this.kind === 'player' && this.mouseHeld)) {
    ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x0 + X * (side ? (s > 0 ? 6 : 9) : 11), y0 + 12, 1, 1.5);
  }
  ctx.restore();
};

// ---------------------------------------------------------------- motion smoothing
// The game steps at 60 Hz; on faster displays, people, cars and the camera are drawn between the last two steps.
G.settings.defaults.smoothing = true;
if (G.settings.data.smoothing == null) G.settings.data.smoothing = true;
const _tickU = GS.update, _render = GS.render;
GS.update = function (dt) {
  for (const a of this.actors) { a._ix = a.x; a._iy = a.y; }
  for (const v of this.vehicles || []) { v._ix = v.x; v._iy = v.y; }
  const c = G.renderer.cam; this._icx = c.x; this._icy = c.y; this._stepT = G.loop.time;
  return _tickU.call(this, dt);
};
GS.render = function (ctx) {
  const k = G.loop.alpha;
  if (!G.settings.get('smoothing') || k == null || k <= 0.01 || k >= 0.99 || !G.loop.running || G.loop.time - (this._stepT == null ? -9 : this._stepT) > 0.05) return _render.call(this, ctx);   // (no step, nothing to draw between: under a window the positions are old, and blending them shakes the screen)
  const moved = [], c = G.renderer.cam, cx = c.x, cy = c.y;
  const lerp = (o) => { if (o._ix == null || Math.abs(o.x - o._ix) > 24 || Math.abs(o.y - o._iy) > 24) return; moved.push([o, o.x, o.y]); o.x = o._ix + (o.x - o._ix) * k; o.y = o._iy + (o.y - o._iy) * k; };
  for (const a of this.actors) lerp(a);
  for (const v of this.vehicles || []) lerp(v);
  if (this._icx != null && Math.abs(cx - this._icx) < 40) { c.x = this._icx + (cx - this._icx) * k; c.y = this._icy + (cy - this._icy) * k; }
  try { return _render.call(this, ctx); } finally { for (const [o, x, y] of moved) { o.x = x; o.y = y; } c.x = cx; c.y = cy; }
};
})();

// ---------------------------------------------------------------- using things: the hand goes to the mouth
// HD people: a cigarette sits at the real mouth (and the hand brings it there for each drag); eating,
// drinking and taking pills play a short hand-to-mouth animation with the thing in hand.
(() => {
const A = G.assets;
if (G.smoking) {
  const _mouth = G.smoking.mouth;
  G.smoking.mouth = function (p) {
    const hd = p.sheet && G.hd.get(p.sheet), f = p._hdFrame;
    if (!hd || !f) return _mouth.call(this, p);
    const hp = hd.heads[f.dir] && hd.heads[f.dir][f.col]; if (!hp) return _mouth.call(this, p);
    const kx = G.hd.WW / G.hd.FW, ky = G.hd.WH / G.hd.FH, x0 = p.x - G.hd.WW / 2, y0 = p.y - G.hd.WH + 1;
    const mx = f.dir === 0 ? hp.hx + 4 * (hp.hs || 1) : f.dir === 2 ? hp.hx + 8 * (hp.hs || 1) : f.dir === 1 ? hp.hx - 0.5 : hp.hx + 4 * (hp.hs || 1);
    return { x: x0 + mx * kx, y: y0 + (hp.hy + 7 * (hp.hs || 1)) * ky };
  };
}
const PL = G.Player.prototype, _use = PL.useFromSlot;
PL.useFromSlot = function (i, scene) {
  const s = this.inventory.slots[i], it = s && G.item(s.id);
  const r = _use.apply(this, arguments);
  if (it && (it.food || it.drink || it.type === 'food' || it.alcohol || it.drug || it.heal || /pill|tablet/.test(it.id))) {
    this.useAnim = { t: 1.4, len: 1.4, prop: it.alcohol || it.drink || /water|soda|coffee|beer|juice|bottle|can/.test(it.id) ? 'drink' : /pill|tablet|xanax|benadryl|painkiller/.test(it.id) ? 'pill' : it.heal && !it.food ? 'bandage' : 'food', color: it.color };
  }
  return r;
};
const _pu = PL.update;
PL.update = function (dt, scene) { if (this.useAnim && (this.useAnim.t -= dt) <= 0) this.useAnim = null; return _pu.call(this, dt, scene); };
// the pose: hand to mouth while it lasts (bandages: hands at the arm)
const AP = G.Actor.prototype, _draw = AP.draw;
AP.draw = function (ctx) {
  const u = this.useAnim;
  if (!u) return _draw.call(this, ctx);
  const was = this.doing;
  const k = 1 - u.t / u.len, toMouth = k > 0.15 && k < 0.85;
  this.doing = { kind: '_use', t: toMouth ? 0.5 : 2, len: 99, said: true };   // read by the HD frame picker (js/game/hdchars.js)
  _draw.call(this, ctx);
  this.doing = was;
  // the thing in the hand
  const m = G.smoking ? G.smoking.mouth(this) : { x: this.x, y: this.y - 14 };
  const hx = toMouth ? m.x : this.x + (this.dir === 1 ? -3 : 3), hy = toMouth ? m.y + 0.5 : this.y - 9;
  if (this.dir === 3 || u.prop === '_none') return;   // ('_none': the prop is drawn by js/game/handprops.js)
  if (u.prop === 'drink') { ctx.fillStyle = u.color || '#3a7a4a'; ctx.fillRect(hx - 0.5, hy - 1.5, 1.5, 3); ctx.fillStyle = '#d8d8d8'; ctx.fillRect(hx - 0.5, hy - 2, 1.5, 0.5); }
  else if (u.prop === 'pill') { ctx.fillStyle = '#f0f0f0'; ctx.fillRect(hx, hy, 1, 0.6); }
  else if (u.prop === 'bandage') { ctx.fillStyle = '#ece6dc'; ctx.fillRect(this.x - 2, this.y - 11, 4, 1); }
  else { ctx.fillStyle = u.color || '#d8a860'; ctx.fillRect(hx - 1, hy - 0.5, 2, 1.5); ctx.fillStyle = '#5a9a3a'; ctx.fillRect(hx - 1, hy + 0.5, 2, 0.5); }
  if (toMouth && Math.random() < 0.08 && u.prop === 'food') { ctx.fillStyle = 'rgba(216,168,96,0.8)'; ctx.fillRect(hx + (Math.random() - 0.5) * 3, hy + 2, 0.6, 0.6); }   // crumbs
};
})();

// ---------------------------------------------------------------- hallucinations, in the new look
// The strangers are HD people that walk; on a good trip they glow and cycle through colors and leave a
// trail of themselves; on a bad trip they are shadows with smoking edges. Trees and things breathe, and
// faint geometry crawls over the ground, aligned to the world.
(() => {
const GS = G.GameScene.prototype, _ph = GS.drawPhantoms;
GS.drawPhantoms = function (ctx) {
  if (!this.phantoms || !this.phantoms.length) return _ph.call(this, ctx);
  const C = G.hd.COL, FW = G.hd.FW, FH = G.hd.FH, WW = G.hd.WW, WH = G.hd.WH;
  // keep whatever the base draws after the phantoms (it draws fallers)
  const keep = this.phantoms; this.phantoms = [];
  try { _ph.call(this, ctx); } finally { this.phantoms = keep; }
  for (const f of keep) {
    const hd = G.hd.get(f.sheet); if (!hd) continue;
    const a = Math.min(1, f.t, f.life - f.t) * (f.bad ? 0.8 : 0.6);
    if (a <= 0) continue;
    const col = C.walk + Math.floor(f.t * 7) % 8, x = f.x - WW / 2, y = f.y - WH + 1 + Math.sin(f.t * 3) * 1.5;
    if (f.bad) {
      ctx.globalAlpha = a; ctx.filter = 'brightness(0)';
      ctx.drawImage(hd.img, col * FW, f.dir * FH, FW, FH, x, y, WW, WH);
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(10,8,14,${(a * 0.35).toFixed(2)})`;   // smoke coming off the edges
      for (let i = 0; i < 4; i++) { const t = f.t * 2 + i; ctx.beginPath(); ctx.arc(f.x + Math.sin(t * 1.7) * 5, y + 4 - (t * 6 % 10), 1.5 + (t % 1) * 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = `rgba(255,40,40,${a.toFixed(2)})`; if (f.dir !== 3) { ctx.fillRect(f.x - 2, y + 4.5, 1, 0.6); ctx.fillRect(f.x + 1, y + 4.5, 1, 0.6); }   // eyes
    } else {
      for (let k = 2; k >= 0; k--) {   // a trail of afterimages
        ctx.globalAlpha = a * (k ? 0.18 / k : 1);
        ctx.filter = `hue-rotate(${Math.round((f.hue + G.loop.time * 90 + k * 40) % 360)}deg) saturate(1.8)`;
        ctx.drawImage(hd.img, col * FW, f.dir * FH, FW, FH, x - Math.cos(f.t * 0.7 + f.hue) * k * 2.5, y - Math.sin(f.t * 0.5 + f.hue) * k * 2, WW, WH);
      }
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.5;
      const g = ctx.createRadialGradient(f.x, y + WH / 2, 0, f.x, y + WH / 2, 14);
      g.addColorStop(0, `hsla(${(f.hue + G.loop.time * 90) % 360},90%,65%,0.6)`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 14, y + WH / 2 - 14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;
};
// breathing things and crawling geometry
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const lv = G.psy && scene && scene.player ? G.psy.level(scene.player) : 0;
  if (lv < 0.08) return _dd.call(this, ctx, o, s, scene);
  const k = 1 + lv * 0.05 * Math.sin(G.loop.time * 1.6 + (o.tx || 0) * 0.7 + (o.ty || 0) * 0.5);
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(k, 2 - k); ctx.translate(-o.x, -o.y);
  try { return _dd.call(this, ctx, o, s, scene); } finally { ctx.restore(); }
};
const V = G.visuals, _ag = V.afterGround;
V.afterGround = function (ctx, scene, view) {
  _ag.call(this, ctx, scene, view);
  const lv = G.psy && scene.player ? G.psy.level(scene.player) : 0;
  if (lv < 0.15) return;
  const t = G.loop.time;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 0.6;
  const x0 = Math.floor(view.x / 32) * 32, y0 = Math.floor(view.y / 32) * 32;
  for (let gy = y0; gy < view.y + view.h; gy += 32) for (let gx = x0; gx < view.x + view.w; gx += 32) {
    const ph = Math.sin(t * 0.8 + gx * 0.02 + gy * 0.03);
    ctx.strokeStyle = `hsla(${(t * 40 + gx * 0.5 + gy * 0.3) % 360},90%,60%,${(0.12 * lv * (0.5 + 0.5 * ph)).toFixed(3)})`;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + t * 0.3, r = 10 + ph * 4; ctx.lineTo(gx + 16 + Math.cos(a) * r, gy + 16 + Math.sin(a) * r * 0.6); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
};
})();

// ---------------------------------------------------------------- blood stays on the floor
// A pool spreads only as far as the open ground around it: walls, doors and anything solid stop it.
(() => {
const _add = G.gore.add;
G.gore.add = function (scene, d) {
  if (d && (d.type === 'pool' || d.type === 'splat') && scene && scene.map) {
    const map = scene.map, want = d.type === 'pool' ? (d.grow || d.r || 6) : (d.r || 3);
    let lim = want;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      for (let s = 1; s <= want; s += 1) {
        const x = d.x + Math.cos(a) * s, y = d.y + Math.sin(a) * s * 0.55, def = map.tileDef(Math.floor(x / 16), Math.floor(y / 16));
        if (!def || def.solid || def.wall || def.water || def.name === 'door') { lim = Math.min(lim, Math.max(1.5, s - 1)); break; }
      }
    }
    if (d.type === 'pool') d.grow = lim; else d.r = Math.min(d.r || 3, lim);
  }
  return _add.apply(this, arguments);
};
})();

// ---------------------------------------------------------------- knocked down by a heavy blow (or a car)
(() => {
const _dmg = G.combat.damage;
G.combat.damage = function (target, dmg, source, scene, o = {}) {
  const r = _dmg.apply(this, arguments);
  if (target && !target.dead && (target.kind === 'npc' || target.kind === 'player') && !(target.downT > 0)) {
    const kb = Math.hypot(target.kbx || 0, target.kby || 0);
    if (kb > 140 || dmg >= 25 || (source && source.kind === 'vehicle')) { target.downT = 1.2; target.downDir = (target.kbx || 0) >= 0 ? 1 : -1; }
  }
  return r;
};
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) { for (const a of this.actors) if (a.downT > 0) a.downT -= dt; return _gu.call(this, dt); };
const PL = G.Player.prototype, _pu = PL.update;
PL.update = function (dt, scene) { if (this.downT > 0.35 && this === scene.player) { this.moving = false; this.baseUpdate(dt, scene.map); return; } return _pu.call(this, dt, scene); };
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) { if (this.downT > 0.35) { this.moving = false; this.baseUpdate(dt, scene.map); return; } return _nu.call(this, dt, scene); };
})();
// the phone in the hand, screen lit, while it is out
(() => {
const AP = G.Actor.prototype, _draw = AP.draw;
AP.draw = function (ctx) {
  _draw.call(this, ctx);
  const f = this._hdFrame;
  if (!f || !G.hd || f.col !== G.hd.COL.phone || f.dir === 3 || this.dead) return;
  const h = G.hd.handOf(this, 1); if (!h) return;
  ctx.fillStyle = '#18181e'; ctx.fillRect(h.x - 1, h.y - 2.5, 2, 3);
  ctx.fillStyle = `rgba(140,200,255,${(0.75 + 0.2 * Math.sin(G.loop.time * 3)).toFixed(2)})`; ctx.fillRect(h.x - 0.5, h.y - 2, 1, 2);
};
})();

// ---------------------------------------------------------------- the player looks where the mouse points
// While the mouse is in use (moved in the last few seconds, or held), the player faces the cursor, walking
// or standing, and the keyboard attack goes that way too. Leave the mouse alone and the player faces where
// they walk, as before (keyboard-only play). Off in Settings > Gameplay > Face the Mouse.
(() => {
const S = G.settings;
S.defaults.faceMouse = true;
if (S.data.faceMouse == null) S.data.faceMouse = true;
let lastMove = -99;
const PL = G.Player.prototype, _up = PL.update;
PL.update = function (dt, scene) {
  const r = _up.call(this, dt, scene);
  const m = G.input.mouse;
  if (m.moved || m.down) lastMove = G.loop.time;
  // (Settings > Controls > Movement: Classic never turns you toward the cursor; js/game/movement.js)
  const mm = G.movement ? G.movement.mouseMode() : S.get('faceMouse');
  if (this !== scene.player || this.dead || this.vehicle || this.sitting || this.sleeping || this.downT > 0.35 || !mm) return r;
  if (G.scenes.top() !== scene || (!G.movement && G.loop.time - lastMove > 4)) return r;   // a menu is open, or the mouse is not being used
  const mw = this.mouseWorld(), dx = mw.x - this.x, dy = mw.y - (this.y - 6);
  if (Math.hypot(dx, dy) < 6) return r;   // the cursor on the player: keep the last facing
  this.face(dx, dy);
  if (!(this.mouseHeld) && !(G.input.isDown('attack'))) this.aim = Math.atan2(dy, dx);
  return r;
};
})();
