'use strict';
// How you die is how you fall. The killing blow (or whatever wore you down) picks the death:
//   shot:     each round jerks the body; you stagger back, the knees go, you fall backward away from the
//             shooter, with blood thrown out behind you from the exit wounds and a pool spreading under you.
//   stabbed:  you double over clutching the wound, drop to your knees and pitch forward onto your face;
//             the blood comes in pulses, spurting, then pools.
//   beaten:   the head snaps with the last blow and you go down sideways, limp, blood from the head.
//   mauled:   an animal drags you down: torn, thrashing, a lot of blood.
//   burned:   you flail and stagger in flames, collapse, and the body chars black and smokes.
//   choked:   (smoke) you sink to your knees coughing and slump over.
//   bled out / poisoned / overdosed: a slow sway, the legs give out, you slump; an overdose convulses.
// Blood follows Settings > Gore & Blood. The body stays where it fell until you load or leave.
(() => {
const GS = G.GameScene.prototype, PL = G.Player.prototype, TAU = Math.PI * 2;
const gore = () => G.gore && G.gore.on();
const ease = (k) => k * k;   // a body falls: slow, then all at once
// the last thing that hurt you, and from where
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  if (target && target.kind === 'player' && !target.dead) {
    const kind = source && source.kind === 'fire' ? (source.smoke ? 'smoke' : 'fire') : source && source.kind === 'animal' ? 'animal' : G.ko ? G.ko.kindOf(source, o) : null;
    target.lastHit = { kind: kind || (source ? 'other' : 'vehicle'), ang: source && source.x != null ? Math.atan2(target.y - source.y, target.x - source.x) : Math.random() * TAU, t: G.loop.time, bullet: !!(o && o.bullet) };
    if (o && o.bullet) target.shotTimes = (target.shotTimes || []).filter((t) => G.loop.time - t < 1.5).concat(G.loop.time);
  }
  return _dmg.apply(this, arguments);
};
const causeOf = (p, source) => {
  if (source && source.kind === 'bleeding') return 'bleed';
  if (source && source.kind === 'poison') return G.effects.has(p, 'overdose') || G.effects.has(p, 'resp_depression') ? 'overdose' : 'poison';
  const h = p.lastHit, recent = h && G.loop.time - h.t < 2;
  if (source && source.kind === 'fire') return source.smoke ? 'smoke' : 'fire';
  if (!recent) return 'collapse';
  return { shot: 'shot', blade: 'stab', chop: 'stab', fist: 'beaten', blunt: 'beaten', heavy: 'beaten', animal: 'mauled', fire: 'fire', smoke: 'smoke', vehicle: 'beaten' }[h.kind] || 'collapse';
};
const LEN = { shot: 2.6, stab: 3.2, beaten: 2.2, mauled: 3.2, fire: 4.2, smoke: 3.4, bleed: 3.4, poison: 3.4, overdose: 3.6, collapse: 2.4 };
const _die = PL.die;
PL.die = function (source, scene) {
  const cause = causeOf(this, source), h = this.lastHit;
  // which way the body goes: away from the blow (or the shooter), forward onto the face for a stab
  const away = h ? h.ang : Math.random() * TAU;
  this.deathAnim = { cause, t: 0, ang: away, side: Math.cos(away) >= 0 ? 1 : -1, x: this.x, y: this.y, dir: this.dir, shots: (this.shotTimes || []).length, fx: [] };
  return _die.apply(this, arguments);
};
// the scene waits for the body to hit the ground before the death screen
const _opd = GS.onPlayerDeath;
GS.onPlayerDeath = function () {
  const r = _opd.apply(this, arguments);
  const a = this.player && this.player.deathAnim;
  if (a) this.deathT = Math.max(this.deathT, (LEN[a.cause] || 2.4) + 0.8);
  return r;
};

// ---------------------------------------------------------------- the animation, frame by frame
const D = G.playerDeath = {
  // the pose at time t: lean (rotation about the feet), drop (knees), slide, and the frame to use
  pose(a) {
    const t = a.t, L = LEN[a.cause] || 2.4, s = a.side;
    let rot = 0, drop = 0, ox = 0, oy = 0, frame = 'flinch', jitter = 0, char = 0, flames = 0;
    const fall = (t0, t1, to) => { const k = G.util.clamp((t - t0) / (t1 - t0), 0, 1); return ease(k) * to; };
    switch (a.cause) {
      case 'shot': {
        // each hit jerks the body; stagger back; knees go; backward fall
        const hits = Math.max(1, Math.min(4, a.shots));
        for (let i = 0; i < hits; i++) { const ti = i * 0.14; if (t > ti && t < ti + 0.12) jitter = (1 - (t - ti) / 0.12) * 1.6; }
        ox = Math.cos(a.ang) * Math.min(6, t * 10); oy = Math.sin(a.ang) * Math.min(3, t * 5);
        drop = fall(0.45, 0.8, 4);
        rot = fall(0.6, 1.15, s * Math.PI / 2);
        frame = t < 0.6 ? 'flinch' : 'down';
        break;
      }
      case 'stab': {
        frame = t < 1.6 ? 'cower' : 'down';               // doubled over, clutching
        drop = fall(0.5, 1.4, 6);                          // to the knees
        rot = fall(1.5, 2.1, -s * Math.PI / 2);            // face down, forward
        break;
      }
      case 'beaten': {
        jitter = t < 0.15 ? 2 : 0;                          // the head snaps
        drop = fall(0.1, 0.55, 3);
        rot = fall(0.2, 0.75, s * Math.PI / 2);
        frame = t < 0.25 ? 'flinch' : 'down';
        break;
      }
      case 'mauled': {
        jitter = t < 2.2 ? Math.sin(t * 40) * 1.4 : 0;     // thrashing
        drop = fall(0, 0.5, 5);
        rot = fall(0.2, 0.7, s * Math.PI / 2) + (t < 2.2 ? Math.sin(t * 9) * 0.25 : 0);
        frame = 'down';
        break;
      }
      case 'fire': {
        flames = t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 1);
        frame = t < 2 ? 'flail' : t < 2.6 ? 'cower' : 'down';
        ox = t < 2 ? Math.sin(t * 5) * 5 : Math.sin(10) * 5;   // staggering about
        drop = fall(2, 2.6, 5);
        rot = fall(2.4, 3, s * Math.PI / 2);
        char = G.util.clamp((t - 0.8) / 3, 0, 1);
        break;
      }
      case 'smoke': {
        frame = t < 2 ? 'cower' : 'down'; jitter = t < 2 ? Math.sin(t * 22) * 0.5 : 0;
        drop = fall(0.6, 2, 6); rot = fall(2, 2.8, s * Math.PI / 2);
        break;
      }
      case 'overdose': {
        drop = fall(0, 1.2, 6); rot = fall(1, 1.6, s * Math.PI / 2);
        jitter = t > 1.6 && t < 3.4 ? Math.sin(t * 50) * 1.2 * (1 - (t - 1.6) / 1.8) : 0;   // convulsing
        frame = 'down';
        break;
      }
      default: {   // bled out, poisoned, collapsed: sway, legs give out, slump
        ox = Math.sin(t * 2.5) * Math.max(0, 1 - t / 1.6) * 1.5;
        drop = fall(0.4, 1.6, 6);
        rot = fall(1.4, 2.2, s * Math.PI / 2);
        frame = t < 1.4 ? 'cower' : 'down';
      }
    }
    return { rot, drop, ox, oy, frame, jitter, char, flames, done: t >= L };
  },
  // blood and smoke over the course of it (once per moment)
  effects(scene, p, a) {
    const t = a.t, once = (k, at) => { if (t >= at && !a.fx.includes(k)) { a.fx.push(k); return true; } return false; };
    const at = (dx, dy) => ({ x: a.x + dx, y: a.y + dy });
    const pool = (r, grow) => G.gore.add(scene, { x: a.x + Math.cos(a.ang) * 6 * a.side, y: a.y + 1, r, grow, born: G.loop.time, type: 'pool' });
    const spray = (n, ang, dist, size) => { for (let i = 0; i < n; i++) { const g = ang + (Math.random() - 0.5) * 0.8, d = 4 + Math.random() * dist, q = at(Math.cos(g) * d, Math.sin(g) * d * 0.6); G.gore.add(scene, { x: q.x, y: q.y, r: size * (0.5 + Math.random()), type: 'splat', ang: g }); } };
    if (!gore()) { if (a.cause === 'fire' && Math.random() < 0.4) scene.particles(a.x, a.y - 10, '#5a5450', 1); return; }
    switch (a.cause) {
      case 'shot':
        for (let i = 0; i < Math.max(1, Math.min(4, a.shots)); i++) if (once('hit' + i, i * 0.14)) { spray(5, a.ang, 26, 1.6); scene.particles(a.x, a.y - 12, '#a01010', 6); }
        if (once('pool', 1.2)) pool(4, 22);
        break;
      case 'stab':
        for (let i = 0; i < 6; i++) if (once('pulse' + i, 0.3 + i * 0.4)) { spray(2 + (i < 3 ? 2 : 0), a.ang + Math.PI * 0.5 * a.side, 16 - i * 2, 1.4); scene.particles(a.x - a.side * 3, a.y - 10 + i, '#b01010', 4); }
        if (once('pool', 2.1)) pool(5, 26);
        break;
      case 'beaten':
        if (once('snap', 0)) { spray(4, a.ang, 14, 1.2); scene.particles(a.x, a.y - 16, '#a01010', 5); }
        if (once('pool', 0.9)) pool(3, 14);
        break;
      case 'mauled':
        for (let i = 0; i < 8; i++) if (once('tear' + i, i * 0.27)) { spray(3, Math.random() * TAU, 18, 1.8); scene.particles(a.x + (Math.random() - 0.5) * 10, a.y - 6, '#8a0a0a', 5); }
        if (once('gib', 1.4)) for (let i = 0; i < 4; i++) G.gore.add(scene, { x: a.x + (Math.random() - 0.5) * 22, y: a.y + (Math.random() - 0.5) * 10, r: 1.4, type: 'splat' });
        if (once('pool', 1.6)) pool(6, 30);
        break;
      case 'bleed':
        if (once('pool', 1.8)) pool(5, 28);
        break;
      case 'fire':
        if (Math.random() < 0.5) scene.particles(a.x + (Math.random() - 0.5) * 8, a.y - 14 - Math.random() * 6, Math.random() < 0.5 ? '#ffb040' : '#5a5450', 1);
        break;
      case 'overdose':
        if (once('foam', 2)) G.gore.add(scene, { x: a.x - a.side * 8, y: a.y, r: 1.4, type: 'splat' });
        break;
    }
  },
  draw(ctx, p) {
    const a = p.deathAnim, ps = this.pose(a), H = G.hd, hd = p.sheet && H.get(p.sheet);
    const x = a.x + ps.ox + (ps.jitter ? (Math.random() - 0.5) * ps.jitter : 0), y = a.y + ps.oy;
    // the shadow lengthens as the body goes down
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y - 0.5, 4.5 + Math.abs(Math.sin(ps.rot)) * 6, 2, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ps.rot);
    if (ps.char > 0) ctx.filter = `brightness(${(1 - ps.char * 0.8).toFixed(2)}) sepia(${(ps.char * 0.6).toFixed(2)}) saturate(${(1 - ps.char * 0.5).toFixed(2)})`;
    const squash = 1 - ps.drop / 22;
    ctx.scale(1, squash);
    if (hd) {
      const C = H.COL, col = ps.frame === 'flail' ? C.run + Math.floor(a.t * 16) % 8 : ps.frame === 'cower' ? C.cower : C.flinch;
      ctx.drawImage(hd.img, col * H.FW, (a.dir || 0) * H.FH, H.FW, H.FH, -H.WW / 2, -H.WH + 1, H.WW, H.WH);
      if (G.bloodStains && (p.bloody > 0 || gore())) { const extra = { shot: 0.5, stab: 0.7, mauled: 1, beaten: 0.4, bleed: 0.8 }[a.cause] || 0; const lv = p.bloody; p.bloody = Math.min(1, (lv || 0) + extra * Math.min(1, a.t / 1.5)); G.bloodStains(ctx, p, -H.WW / 2, -H.WH + 1, col, a.dir || 0, hd); p.bloody = lv; }
    }
    ctx.filter = 'none';
    ctx.restore();
    // flames on the body
    if (ps.flames > 0) for (let i = 0; i < 7; i++) {
      const fx = x + Math.sin(a.t * 9 + i * 2.1) * 5 + (Math.abs(Math.sin(ps.rot)) * (i - 3) * 2), fy = y - 4 - (1 - Math.abs(Math.sin(ps.rot))) * (4 + i * 2) - Math.random() * 3;
      const r = (2 + Math.random() * 2.5) * ps.flames;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, 'rgba(255,240,160,0.95)'); g.addColorStop(0.5, 'rgba(255,140,30,0.8)'); g.addColorStop(1, 'rgba(200,40,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
    }
    if (ps.char > 0.5 && Math.random() < 0.08) { ctx.fillStyle = 'rgba(70,66,62,0.4)'; ctx.beginPath(); ctx.arc(x + (Math.random() - 0.5) * 6, y - 8 - Math.random() * 10, 2, 0, TAU); ctx.fill(); }
  },
};
const _pd = PL.draw;
PL.draw = function (ctx) { if (this.dead && this.deathAnim) return D.draw(ctx, this); return _pd.apply(this, arguments); };
// time moves on for the body (the scene keeps updating while the death screen waits)
const _gu = GS.update;
GS.update = function (dt) {
  const p = this.player, a = p && p.dead && p.deathAnim;
  if (a) { a.t += dt; D.effects(this, p, a); }
  return _gu.apply(this, arguments);
};
})();
