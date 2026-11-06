'use strict';
// Aiming. With a gun in hand:
//   Right click (default): hold right to aim, left click to fire. A left click without aiming is a quick hip shot.
//   Left click (Settings > Controls > Aim Button): press and hold to aim, let go to fire. The longer you hold still, the steadier the
//     shot: the crosshair's ticks close in over about 0.7 s (faster with Steady Hands, slower when moving,
//     drunk or hurt). A quick tap is a hip shot: wide. Automatic weapons fire while held, the aim
//     still tightening as you hold, the recoil kicking it open again.
//   (In either scheme the shot goes where the cursor is.)
//   Space (keyboard) fires straight ahead as before.
// While aiming you walk slowly and cannot run, the gun is raised (the HD aim pose), the camera leans a
// little toward the cursor, and a faint sight line runs from the muzzle to where the bullet would stop.
(() => {
const S = G.settings, U = G.util;
S.defaults.aimButton = 1;   // 0 left (hold, release to fire), 1 right (hold to aim, left to fire: the default since 2026-11-01)
if (S.data.aimButton == null || !S.data.aimSchemeV2) { S.data.aimButton = 1; S.data.aimSchemeV2 = true; }   // (everyone moves to right-aims / left-shoots once; Settings can switch it back)
const TAP = 0.15, HIP = 1.35, BEST = 0.28;

G.aim = {
  // how long a full aim takes for this player right now
  aimTime(p) {
    let t = 0.7;
    if (G.skills.has(p, 'steady_hands')) t *= 0.65;
    if (p.moving) t *= 2;
    const lv = G.effects.intoxLevel && G.effects.intoxLevel(p); if (lv && lv.stumble) t *= 1.8;
    if (p.hp < p.maxHp * 0.3) t *= 1.4;
    return t;
  },
  steady(p) { return U.clamp((p.aimHold || 0) / this.aimTime(p), 0, p.moving ? 0.6 : 1); },
  mult(p) { const s = this.steady(p); return (p.aimHold || 0) < TAP ? HIP : HIP - (HIP - BEST) * s; },
  // called each frame with a gun; returns true when a shot should go out now
  update(p, scene, dt, click) {
    const m = G.input.mouse, w = p.weaponItem, right = S.get('aimButton') === 1;
    const held = right ? !!m.rdown : !!p.mouseHeld;
    let fire = false;
    if (held) {
      p.aimHold = p.aiming ? (p.aimHold || 0) + dt : 0;
      p.aiming = true;
      const mw = p.mouseWorld(); p.aim = Math.atan2(mw.y - (p.y - 6), mw.x - p.x); p.face(Math.cos(p.aim), Math.sin(p.aim));
      if (w.auto) fire = right ? !!m.down : true;
      else if (right) fire = click;
      if (fire) p.aimSpread = this.mult(p);
    } else if (p.aiming) {
      // let go: left-click mode fires the aimed shot now
      if (!right && !w.auto) { fire = true; p.aimSpread = this.mult(p); }
      p.aiming = false; p.aimHold = 0;
    } else if (right && click) { fire = true; p.aimSpread = HIP; }   // right-button mode, no aim held: a hip shot
    return fire;
  },
  // the cone the next shot would go into (radians, half-angle), for the crosshair
  cone(p) { const w = p.weaponItem; if (!w || !w.gun) return 0; return Math.max(0.004, w.spread + (G.effects.spread ? G.effects.spread(p) : 0)) * (p.aiming ? this.mult(p) : HIP); },
};

// recoil opens the aim again a little (automatic weapons especially)
const _pf = G.firearms.playerFire;
G.firearms.playerFire = function (p, scene, angle) {
  const before = p.attackCd;
  _pf.apply(this, arguments);
  if (p.attackCd > before && p.aiming) p.aimHold = Math.max(0, (p.aimHold || 0) - (p.weaponItem.auto ? 0.12 : 0.3));
};

// the raised gun counts as aiming for the arm pose
const _draw = G.firearms.draw;
G.firearms.draw = function (ctx, scene) {
  _draw.apply(this, arguments);
  const p = scene.player, w = p && p.weaponItem;
  if (!p || p.dead || p.vehicle || !w || !w.gun || G.scenes.top() !== scene) return;
  const mw = p.mouseWorld(), ox = p.x, oy = p.y - 6, dist = Math.hypot(mw.x - ox, mw.y - oy);
  if (p.aiming) {
    // the sight line: from the muzzle toward the cursor, stopping at the first wall
    const a = p.aim, map = scene.map; let L = 0;
    for (; L < 260; L += 3) { const d = map.tileDef(Math.floor((ox + Math.cos(a) * L) / 16), Math.floor((oy + 4 + Math.sin(a) * L) / 16)); if (!d || ((d.solid || d.wall) && !d.water && L > 10)) break; }
    const s = G.aim.steady(p);
    ctx.save(); ctx.strokeStyle = `rgba(255,${Math.round(80 + 140 * s)},${Math.round(60 + 60 * s)},${(0.12 + 0.2 * s).toFixed(2)})`; ctx.lineWidth = 0.6; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * 8, oy + Math.sin(a) * 8); ctx.lineTo(ox + Math.cos(a) * L, oy + Math.sin(a) * L); ctx.stroke(); ctx.restore();
    if (L < 260 && L < dist) { ctx.fillStyle = 'rgba(255,90,60,0.6)'; ctx.fillRect(Math.round(ox + Math.cos(a) * L) - 0.5, Math.round(oy + Math.sin(a) * L) - 0.5, 1, 1); }   // where the wall stops it
  }
  // the crosshair: four ticks spread as wide as the cone at that distance
  const gap = Math.max(1.5, Math.min(26, Math.tan(G.aim.cone(p)) * dist)), x = mw.x, y = mw.y;
  const s = p.aiming ? G.aim.steady(p) : 0, col = s >= 0.99 ? 'rgba(120,240,140,0.95)' : p.aiming ? 'rgba(255,240,200,0.9)' : 'rgba(255,240,200,0.45)';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (const [dx, dy, w2, h2] of [[-gap - 3, -0.5, 3, 1], [gap, -0.5, 3, 1], [-0.5, -gap - 3, 1, 3], [-0.5, gap, 1, 3]]) ctx.fillRect(x + dx + 0.5, y + dy + 0.5, w2, h2);
  ctx.fillStyle = col;
  for (const [dx, dy, w2, h2] of [[-gap - 3, -0.5, 3, 1], [gap, -0.5, 3, 1], [-0.5, -gap - 3, 1, 3], [-0.5, gap, 1, 3]]) ctx.fillRect(x + dx, y + dy, w2, h2);
  if (p.aiming) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
};

// the camera leans a little toward the cursor while aiming, so you see further where you point
const _follow = G.renderer.follow;
G.renderer.follow = function (x, y, mapW, mapH, dt, snap) {
  const sc = G.scenes && G.scenes.top(), p = sc && sc.player;
  if (p && p.aiming && !snap) {
    const mw = p.mouseWorld(), k = 0.25 * U.clamp((p.aimHold || 0) / 0.4, 0, 1);
    p._lean = p._lean || { x: 0, y: 0 };
    p._lean.x += (U.clamp((mw.x - p.x) * k, -60, 60) - p._lean.x) * Math.min(1, dt * 6);
    p._lean.y += (U.clamp((mw.y - p.y) * k, -40, 40) - p._lean.y) * Math.min(1, dt * 6);
  } else if (p && p._lean) { p._lean.x *= Math.max(0, 1 - dt * 5); p._lean.y *= Math.max(0, 1 - dt * 5); }
  return _follow.call(this, x + (p && p._lean ? p._lean.x : 0), y + (p && p._lean ? p._lean.y : 0), mapW, mapH, dt, snap);
};
})();
// no gun, swimming, dragging a body or driving: not aiming
(() => {
const PL = G.Player.prototype, _up = PL.update;
PL.update = function (dt, scene) {
  const r = _up.call(this, dt, scene);
  const w = this.weaponItem;
  if (this.aiming && (!w || !w.gun || this.swimming || this.dragging || this.vehicle || this.dead || G.scenes.top() !== scene)) { this.aiming = false; this.aimHold = 0; }
  return r;
};
})();
