'use strict';
// Combat, faster and surer.
//   Aim: a swing goes where you are actually aiming (any angle: the cursor in mouse mode, the way you move
//   or last moved in Legacy), not one of four directions; and it locks onto the nearest foe in front of you
//   (a soft lock-on within reach), turning you toward them.
//   Hits: a blow lands on anyone in a generous cone in front of you while the weapon is out (jabs and stabs
//   included: they used to need a near-perfect line), measured to the body, not the feet. Up close, always.
//   Speed: wind-ups and recoveries are about a third shorter. Press again during a swing to chain a combo:
//   the third blow in a row is a finisher (half again the damage, double the knockback, a bigger hit-stop).
//   Dodge [Ctrl]: a quick dash the way you move (or back from your aim), untouchable for a moment; costs
//   stamina. Fists hit a little harder than before.
//   Feel: hit-stop scaled to the blow, knockback, the target flashes and staggers, an impact burst, a
//   tapered motion trail behind every swing, a brief camera nudge toward the blow.
(() => {
const M = G.melee, S = M.STYLES;
for (const k in S) { const st = S[k]; st.wind *= 0.68; st.rec *= 0.62; st.act *= 0.9; }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const DIR_ANG = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];
const scn = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
// (your companions: never a lock-on target, but a swing that reaches them still lands: friendly fire, js/game/companionmood.js)
const foes = (a, scene, hitting) => scene.actors.filter((t) => t !== a && !t.dead && (t.kind !== 'remote' || (G.coop && G.coop.friendlyFire)) && !(t.rec && a.kind === 'player') && !(t.st && t.st.companion && a.kind === 'player' && !hitting) && (a.canHit ? a.canHit(t) : true));
// where the player means to hit: the aim (any angle), then a soft lock-on to the nearest foe near that line
M.aimFor = function (a, scene, reach) {
  let base = a.kind === 'player' ? (a.aim != null ? a.aim : DIR_ANG[a.dir]) : a.target ? Math.atan2(a.target.y - a.y, a.target.x - a.x) : DIR_ANG[a.dir];
  if (a.kind === 'player' && scene) {
    let best = null, bs = 1e9;
    for (const t of foes(a, scene)) {
      if (t.kind === 'animal' && !(t.state === 'attack' || t.state === 'hunt' || t.def.behavior === 'predator') && t.owner === 'player') continue;
      const dx = t.x - a.x, dy = (t.y - 7) - (a.y - 7), d = Math.hypot(dx, dy);
      if (d > reach + 18) continue;
      const da = Math.abs(angDiff(Math.atan2(dy, dx), base));
      if (da > 1.3) continue;
      const score = d + da * 30;
      if (score < bs) { bs = score; best = t; }
    }
    if (best) { base = Math.atan2(best.y - a.y, best.x - a.x); a.face(Math.cos(base), Math.sin(base)); a.lockT = 0.4; a.lockOn = best; }
  }
  return base;
};
const _start = M.start;
M.start = function (a) {
  if (a.swing) {   // already swinging: chain the next blow (players)
    if (a.kind === 'player' && a.swing.t > a.swing.st.wind) a.comboQueued = true;
    return false;
  }
  const scene = scn(), st = M.styleOf(a);
  // the combo: blows close together count up; the third is a finisher
  const now = G.loop.time;
  a.combo = now - (a.lastSwingT || -9) < 0.75 ? (a.combo || 0) + 1 : 1; a.lastSwingT = now;
  const ok = _start.call(this, a);
  if (!ok) return ok;
  const sw = a.swing;
  sw.base = M.aimFor(a, scene, st.reach);
  if (a.kind === 'player' && a.combo >= 3) { sw.finisher = true; a.combo = 0; }
  if (a.kind === 'player') a.attackCd = M.total(st) * 0.55;   // the next press chains in the recovery
  return ok;
};
// generous, body-centered hit detection while the blow is out
M.hits = function (a, scene, sw, prev, now) {
  const st = sw.st, hx = a.x, hy = a.y - 8, fin = sw.finisher;
  const reach = st.reach * Math.max(now.ext, 0.7) + 4;
  const lo = Math.min(prev.ang, now.ang), hi = Math.max(prev.ang, now.ang);
  let landed = false;
  for (const t of foes(a, scene, true)) {
    if (sw.hit.has(t)) continue;
    const tx = t.x, ty = t.cy != null ? t.cy : t.y - (t.kind === 'animal' ? 4 : 9), d = Math.hypot(tx - hx, ty - hy), r = (t.radius || 5) + 2;
    let inArc = false;
    if (st.kind === 'slam') {
      const ix = hx + Math.cos(sw.base) * st.reach, iy = hy + Math.sin(sw.base) * st.reach;
      inArc = now.p >= 0.8 && Math.hypot(tx - ix, ty - iy) < st.aoe + r + 4;
    } else if (d <= reach + r) {
      const ang = Math.atan2(ty - hy, tx - hx);
      if (d < 11) inArc = true;   // right up against you: you cannot miss
      else if (st.kind === 'punch' || st.kind === 'thrust') inArc = Math.abs(angDiff(ang, sw.base)) < 0.62 + r / Math.max(d, 1) * 0.5;
      else { const m2 = 0.45 + r / Math.max(d, 1) * 0.5; inArc = angDiff(ang, lo) > -m2 && angDiff(ang, hi) < m2 || Math.abs(angDiff(ang, sw.base)) < 0.5; }
    }
    if (!inArc) continue;
    sw.hit.add(t); landed = true;
    const dmg = Math.round(a.damage(t) * (st.mult || 1) * (fin ? 1.5 : 1));
    G.combat.damage(t, dmg, a, scene);
    if (t.kbx != null) { t.kbx *= st.kb * (fin ? 2 : 1); t.kby *= st.kb * (fin ? 2 : 1); }
    else { const k = (st.kb || 1) * (fin ? 90 : 45); t.kbx = Math.cos(sw.base) * k; t.kby = Math.sin(sw.base) * k; }
    t.staggerT = fin ? 0.5 : 0.22;
    scene.particles(tx, ty, st.spark, 5 + st.shake + (fin ? 6 : 0));
    (M.bursts = M.bursts || []).push({ x: tx, y: ty, t: 0, big: fin, col: st.spark });
  }
  if (landed) {
    sw.stop = (st.kind === 'slam' || st.kind === 'chop' ? 0.09 : 0.055) + (fin ? 0.06 : 0);
    G.audio.play(st.sound, { x: a.x, y: a.y });
    if (a.kind === 'player' || [...sw.hit].includes(scene.player)) { G.renderer.shake(st.shake + (fin ? 3 : 0)); if (a.kind === 'player') { M.nudge = { x: Math.cos(sw.base) * 2.5, y: Math.sin(sw.base) * 2.5, t: 0.12 }; } }
    if (st.kind === 'slam') scene.particles(hx + Math.cos(sw.base) * st.reach, hy + Math.sin(sw.base) * st.reach + 8, '#a89880', 10);
  } else if (st.kind === 'slam' && now.p >= 0.8 && !sw.thud) { sw.thud = true; G.audio.play('slam'); G.renderer.shake(a.kind === 'player' ? 3 : 1); scene.particles(hx + Math.cos(sw.base) * st.reach, hy + Math.sin(sw.base) * st.reach + 8, '#a89880', 8); }
};
// chained blows start the moment the last one ends
const _upd = M.update;
M.update = function (a, dt) {
  const had = a.swing;
  _upd.call(this, a, dt);
  if (had && !a.swing && a.comboQueued) { a.comboQueued = false; a.attackCd = 0; if (a.kind !== 'player' || a.stamina >= 4) { if (a.kind === 'player') a.stamina -= 5; M.start(a); } }
};
// fists hit harder
const PL = G.Player.prototype, _dmg = PL.damage;
PL.damage = function (t) { const w = this.weaponItem; return _dmg.call(this, t) + (w ? 0 : 2); };
// staggered people lose their next blow for a moment. The stagger wears off here, every frame: it used to
// only tick down mid-swing, so a struck NPC (not swinging) stayed staggered forever, its attackCd pinned
// above zero, and it chased you without ever hitting or shooting.
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.staggerT > 0) { if (this.attackCd < this.staggerT) this.attackCd = this.staggerT; this.staggerT -= dt; }
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- dodge [Ctrl]
const I = G.input;
if (!I.defaultBindings.dodge) { I.defaultBindings.dodge = ['ControlLeft', 'ControlRight']; if (I.bindings && !I.bindings.dodge) I.bindings.dodge = ['ControlLeft', 'ControlRight']; I.rebindable.push('dodge'); I.actionLabels.dodge = 'Dodge'; }
const _pu = PL.update;
PL.update = function (dt, scene) {
  const d = this.dodge;
  if (d) {   // mid-dash: fly along, untouchable
    d.t += dt; const k = Math.max(0, 1 - d.t / d.len);
    this.move(scene.map, d.vx * k * dt * 2.2, d.vy * k * dt * 2.2, true);
    this.invuln = Math.max(this.invuln || 0, 0.05); this.moving = true;
    if (d.t >= d.len) this.dodge = null;
    return;
  }
  const r = _pu.call(this, dt, scene);
  if (this.dodgeCd > 0) this.dodgeCd -= dt;
  if (!this.dead && !this.vehicle && !this.mount && !this.swimming && !this.dragging && I.wasPressed('dodge') && !(this.dodgeCd > 0) && this.stamina >= 15 && G.scenes.top() === scene) {
    let vx = this._mv ? this._mv.x : 0, vy = this._mv ? this._mv.y : 0;
    if (Math.hypot(vx, vy) < 0.2) { const a = this.aim != null ? this.aim : DIR_ANG[this.dir]; vx = -Math.cos(a); vy = -Math.sin(a); }   // standing: hop back
    const n = Math.hypot(vx, vy) || 1;
    this.dodge = { t: 0, len: 0.22, vx: (vx / n) * 160, vy: (vy / n) * 160 }; this.dodgeCd = 0.55; this.stamina -= 15; this.staminaDelay = 0.6;
    this.invuln = Math.max(this.invuln || 0, 0.3); this.swing = null;
    G.audio.play('whoosh', { x: this.x, y: this.y });
  }
  return r;
};

// ---------------------------------------------------------------- the look: trails, bursts, the dodge blur, the camera nudge
const _mdraw = M.draw;
M.draw = function (ctx, a, behind) {
  const sw = a.swing;
  if (sw && !behind && sw.t > sw.st.wind * 0.6 && sw.t < sw.st.wind + sw.st.act + 0.06) {   // a tapered trail behind the weapon
    const st = sw.st, cx = a.x, cy = a.y - 8, R = st.reach * (st.kind === 'punch' ? 0.75 : 0.9);
    const now = M.pose(sw), p0 = M.pose(Object.assign({}, sw, { t: Math.max(0, sw.t - 0.09) }));
    if (st.kind === 'punch') {   // a short streak behind the fist that is actually flying
      const h0 = G.hd.handOf(a, 0), h1 = G.hd.handOf(a, 1), c = Math.cos(sw.base), s = Math.sin(sw.base), f = h0 && h1 ? ((h0.x - a.x) * c + (h0.y - a.y) * s >= (h1.x - a.x) * c + (h1.y - a.y) * s ? h0 : h1) : h0 || h1;
      if (f) {
        const L = 3 + 5 * now.ext, x1 = f.x + c, y1 = f.y + s, x0 = x1 - c * L, y0 = y1 - s * L, g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, sw.finisher ? 'rgba(255,220,150,0.55)' : 'rgba(255,255,255,0.4)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.lineCap = 'butt';
      }
    } else if (st.kind === 'thrust') {
      const L = R * now.ext, a0 = now.ang;
      const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a0) * L, cy + Math.sin(a0) * L);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, sw.finisher ? 'rgba(255,220,150,0.55)' : 'rgba(255,255,255,0.4)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * L * 0.3, cy + Math.sin(a0) * L * 0.3); ctx.lineTo(cx + Math.cos(a0) * L, cy + Math.sin(a0) * L); ctx.stroke();
    }
    ctx.lineWidth = 1;
  }
  return _mdraw.call(this, ctx, a, behind);
};
const GS = G.GameScene.prototype, _render = GS.render, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if (M.bursts) { for (const b of M.bursts) b.t += dt; M.bursts = M.bursts.filter((b) => b.t < 0.25); }
  if (M.nudge && (M.nudge.t -= dt) <= 0) M.nudge = null;
  return r;
};
GS.render = function (ctx) {
  const n = M.nudge, cam = G.renderer.cam;
  if (n) { cam.x += n.x * (n.t / 0.12); cam.y += n.y * (n.t / 0.12); }
  try { _render.call(this, ctx); } finally { if (n) { cam.x -= n.x * (n.t / 0.12); cam.y -= n.y * (n.t / 0.12); } }
  if (!M.bursts || !M.bursts.length) return;
  G.renderer.worldTransform();
  for (const b of M.bursts) {   // the impact: a quick white ring and spokes
    const k = b.t / 0.25, rr = (b.big ? 9 : 5) * (0.4 + k);
    ctx.strokeStyle = `rgba(255,250,235,${(0.8 * (1 - k)).toFixed(2)})`; ctx.lineWidth = b.big ? 1.4 : 0.9;
    ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) { const aa = i * 1.047 + b.x; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(aa) * rr * 0.6, b.y + Math.sin(aa) * rr * 0.6); ctx.lineTo(b.x + Math.cos(aa) * rr * 1.25, b.y + Math.sin(aa) * rr * 1.25); ctx.stroke(); }
  }
  ctx.lineWidth = 1;
};
// the dodge: a faint after-image
const _pd = PL.draw;
PL.draw = function (ctx) {
  if (this.dodge) { const d = this.dodge, ox = this.x, oy = this.y; ctx.save(); ctx.globalAlpha = 0.25; this.x = ox - d.vx * 0.05; this.y = oy - d.vy * 0.05; try { _pd.call(this, ctx); } finally { this.x = ox; this.y = oy; ctx.restore(); } }
  return _pd.call(this, ctx);
};
})();
