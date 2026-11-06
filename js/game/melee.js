'use strict';
// Melee that you can see and feel. Every weapon is drawn in the hand and swung frame by frame, in all four
// directions, by you and by NPCs, and the hit follows what you see: a blow only lands while the weapon is
// actually passing through someone, inside its reach and its arc.
//   fists / brass knuckles: a quick jab, left and right alternately; short reach.
//   knives: a fast stab straight ahead.
//   bats, pipes, batons, crowbars, cues: a heavy horizontal swing with knockback.
//   machete, katana: a wide, fast slash.
//   axes: an overhead chop: slower, narrow, hits hard.
//   sledgehammer: a long wind-up, then a slam that hits everyone around the impact.
//   pitchfork: a long thrust.
// Each style has its own wind-up, swing and recovery times, sound, hit sparks and screen shake.
(() => {
const STYLES = {
  fists:   { kind: 'punch',  wind: 0.05, act: 0.08, rec: 0.12, reach: 13, arc: 0.8, sound: 'punch',  shake: 1, kb: 0.8, spark: '#e8d0b0' },
  knuckle: { kind: 'punch',  wind: 0.05, act: 0.08, rec: 0.12, reach: 14, arc: 0.8, sound: 'punch',  shake: 2, kb: 1.0, spark: '#d8c070' },
  knife:   { kind: 'thrust', wind: 0.07, act: 0.07, rec: 0.12, reach: 17, arc: 0.55, sound: 'stab',  shake: 1, kb: 0.5, spark: '#c02020' },
  blunt:   { kind: 'swing',  wind: 0.15, act: 0.12, rec: 0.2,  reach: 19, arc: 2.1, sound: 'whoosh', shake: 3, kb: 1.4, spark: '#f0f0e0' },
  cue:     { kind: 'swing',  wind: 0.12, act: 0.12, rec: 0.18, reach: 23, arc: 1.8, sound: 'whoosh', shake: 2, kb: 1.0, spark: '#f0f0e0' },
  blade:   { kind: 'swing',  wind: 0.09, act: 0.1,  rec: 0.16, reach: 20, arc: 2.5, sound: 'slash',  shake: 2, kb: 0.9, spark: '#c02020' },
  axe:     { kind: 'chop',   wind: 0.2,  act: 0.1,  rec: 0.22, reach: 19, arc: 1.3, sound: 'chop',   shake: 4, kb: 1.5, spark: '#c02020', mult: 1.15 },
  sledge:  { kind: 'slam',   wind: 0.36, act: 0.08, rec: 0.34, reach: 19, arc: 1.4, sound: 'slam',   shake: 7, kb: 2.2, spark: '#d8c8a0', aoe: 16, mult: 1.1 },
  thrust:  { kind: 'thrust', wind: 0.13, act: 0.1,  rec: 0.18, reach: 27, arc: 0.45, sound: 'stab',  shake: 2, kb: 1.1, spark: '#c02020' },
};
const styleOf = (a) => {
  const w = a.weaponItem;
  if (!w) return STYLES.fists;
  const id = w.id || '';
  if (id === 'brass_knuckles') return STYLES.knuckle;
  if (id === 'sledgehammer') return STYLES.sledge;
  if (id === 'spear') return STYLES.thrust;
  if (id === 'club') return STYLES.cue;
  if (id === 'woodaxe' || id === 'iron_sword') return STYLES.axe;
  if (w.cat === 'knife') return STYLES.knife;
  if (w.cat === 'blade') return STYLES.blade;
  return STYLES.blunt;
};
const DIR_ANG = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];   // down, left, right, up
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);

G.melee = {
  STYLES, styleOf,
  total(st) { return st.wind + st.act + st.rec; },
  // where the weapon points at time t of the swing (radians), and how far out the hand is (0..1)
  pose(sw) {
    const st = sw.st, t = sw.t, base = sw.base, side = sw.side;
    const w = st.wind, a = st.act, rc = st.rec;
    const p = t < w ? 0 : t < w + a ? (t - w) / a : 1;
    // easing: the wind-up slows into the anticipation, the strike accelerates and overshoots a little
    // (follow-through), the recovery eases back to rest
    const eOut = (k) => 1 - (1 - k) * (1 - k), eIn = (k) => k * k * k, eIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const back = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // overshoot then settle
    const wk = t < w ? eOut(t / w) : 1, rk = t > w + a ? eIO(Math.min(1, (t - w - a) / rc)) : 0;
    switch (st.kind) {
      case 'swing': {   // pulled back to one side, swept across to the other, carried through, brought back
        const startA = base + side * (st.arc / 2), endA = base - side * (st.arc / 2), restA = base + side * 0.5;
        let ang;
        if (t < w) ang = base + side * (st.arc / 2) * (0.35 + 0.65 * wk);
        else if (t < w + a) ang = startA + (endA - startA) * Math.min(1.12, back(eIn(p) * 0.5 + p * 0.5));
        else ang = endA + (restA - endA) * rk;
        return { ang, ext: t < w ? 0.8 + 0.2 * wk : t < w + a ? 1 : 1 - 0.25 * rk, p };
      }
      case 'chop': case 'slam': {   // raised overhead (slowing at the top), brought down hard, a small bounce, lifted back
        const top = base - side * 1.8;
        let ang;
        if (t < w) ang = base - side * 1.8 * wk;
        else if (t < w + a) { const k = eIn(p); ang = top + (base + side * 0.12 - top) * k; }
        else ang = base + side * 0.12 - side * 0.25 * Math.sin(Math.min(1, rk * 2) * Math.PI) * (1 - rk) - side * 0.3 * rk;
        return { ang, ext: t < w ? 0.65 + 0.05 * wk : t < w + a ? 0.7 + 0.3 * eIn(p) : 1 - 0.3 * rk, p };
      }
      default: {   // punch / thrust: the fist (or point) cocked back with a dip, snapped out, pulled back to guard
        const hook = st.kind === 'punch' && sw.hook;
        const ext = t < w ? 0.25 - 0.25 * wk : t < w + a ? eOut(p) : 1 - 0.8 * rk;
        const curve = hook ? side * 0.9 * (1 - eOut(p)) * (t < w + a ? 1 : 0) : 0;
        return { ang: base + side * 0.12 + curve + (t < w ? side * 0.25 * wk : 0), ext, p };
      }
    }
  },
  start(a) {
    const st = styleOf(a);
    if (a.swing) return false;
    a.punchSide = -(a.punchSide || 1);
    const base = a.kind === 'player' ? DIR_ANG[a.dir] : a.target ? Math.atan2(a.target.y - a.y, a.target.x - a.x) : DIR_ANG[a.dir];
    a.punchCount = (a.punchCount || 0) + 1;
    a.swing = { st, t: 0, base, side: st.kind === 'punch' ? a.punchSide : 1, hit: new Set(), from: null, hook: st.kind === 'punch' && a.punchCount % 3 === 0 };   // jab, cross, hook
    a.attackTimer = this.total(st);   // (the player moves slower while swinging)
    a.attackCd = Math.max(a.attackCd || 0, this.total(st) + (a.kind === 'npc' ? 0.25 + Math.random() * 0.3 : 0.02));
    G.audio.play(st.kind === 'slam' || st.kind === 'chop' ? 'swing' : 'swing');
    return true;
  },
  update(a, dt) {
    const sw = a.swing; if (!sw) return;
    if (sw.stop > 0) { sw.stop -= dt; return; }   // hit-stop: a few frames frozen on impact
    const prev = this.pose(sw);
    sw.t += dt;
    const st = sw.st, scene = sceneNow();
    const now = this.pose(sw);
    if (scene && sw.t > st.wind && sw.t - dt < st.wind + st.act) this.hits(a, scene, sw, prev, now);
    if (sw.t >= this.total(st)) a.swing = null;
  },
  // anyone the weapon passes through between the last frame and this one
  hits(a, scene, sw, prev, now) {
    const st = sw.st, hx = a.x, hy = a.y - 7;
    const lo = Math.min(prev.ang, now.ang) - st.arc * 0.12 - 0.2, hi = Math.max(prev.ang, now.ang) + st.arc * 0.12 + 0.2;
    const reach = st.reach * Math.max(now.ext, 0.6);
    let landed = false;
    for (const t of scene.actors) {
      if (t === a || t.dead || sw.hit.has(t) || !a.canHit(t)) continue;
      const dx = t.x - hx, dy = (t.cy != null ? t.cy : t.y - 7) - hy, d = Math.hypot(dx, dy);
      const r = t.radius || 5;
      let inArc = false;
      if (st.kind === 'slam') {   // everyone around where the hammer comes down
        const ix = hx + Math.cos(sw.base) * st.reach, iy = hy + Math.sin(sw.base) * st.reach;
        inArc = now.p >= 0.85 && Math.hypot(t.x - ix, (t.cy != null ? t.cy : t.y - 7) - iy) < st.aoe + r;
      } else if (d <= reach + r) {
        let ang = Math.atan2(dy, dx);
        while (ang < lo - Math.PI) ang += Math.PI * 2; while (ang > hi + Math.PI) ang -= Math.PI * 2;
        inArc = d < 6 || (ang >= lo && ang <= hi);
      }
      if (!inArc) continue;
      sw.hit.add(t); landed = true;
      const dmg = Math.round(a.damage(t) * (st.mult || 1));
      G.combat.damage(t, dmg, a, scene);
      if (t.kbx != null) { t.kbx *= st.kb; t.kby *= st.kb; }
      scene.particles(t.x, t.y - 9, st.spark, 4 + st.shake);
    }
    if (landed) {
      sw.stop = st.kind === 'slam' || st.kind === 'chop' ? 0.08 : 0.05;
      G.audio.play(st.sound, { x: a.x, y: a.y });
      if (a.kind === 'player' || sw.hit.has(scene.player)) G.renderer.shake(st.shake);
      if (st.kind === 'slam') scene.particles(hx + Math.cos(sw.base) * st.reach, hy + Math.sin(sw.base) * st.reach + 6, '#a89880', 10);
    } else if (st.kind === 'slam' && now.p >= 0.85 && !sw.thud) { sw.thud = true; G.audio.play('slam'); G.renderer.shake(a.kind === 'player' ? 3 : 1); scene.particles(hx + Math.cos(sw.base) * st.reach, hy + Math.sin(sw.base) * st.reach + 6, '#a89880', 8); }
  },
  // the weapon in the hand: during a swing it follows the pose; otherwise it rests at the side
  draw(ctx, a, behind) {
    const w = a.weaponItem;
    if (w && w.gun) return;
    const sw = a.swing, fighting = a.kind === 'player' || a.state === 'fight';
    if (!sw && (!w || !fighting)) return;
    const st = sw ? sw.st : styleOf(a), base = sw ? sw.base : DIR_ANG[a.dir];
    const pose = sw ? this.pose(sw) : { ang: base + (a.dir === 1 ? -1 : 1) * 1.1, ext: 0.3, p: 0 };
    const facingAway = a.dir === 3, held = !sw && G.hd && G.hd.handOf ? G.hd.handOf(a) : null;
    if (behind !== (facingAway || !!(held && held.z < -0.5))) return;   // drawn behind the body when they face away, or when the hand is on the far side of them
    const shoulder = { x: a.x + (a.dir === 1 ? -3 : a.dir === 2 ? 3 : (sw ? sw.side : 1) * 4), y: a.y - 9 };
    // HD people: the weapon is in the hand (at rest it hangs from the grip; swinging, an arm reaches it)
    const hand = G.hd && G.hd.handOf ? G.hd.handOf(a) : null, skin = (a.look && a.look.skin) || '#e0b088';
    if (hand) {
      shoulder.y = hand.shoulderY + 1;
      if (!sw && w) {
        // ready to hit, the weapon comes up in front; otherwise it hangs from the grip (models: js/game/heldgear.js)
        const ready = a.state === 'fight' || (a.kind === 'player' && (a.mouseHeld || G.input.isDown('attack'))), s = a.dir === 1 ? 1 : -1;
        if (ready) { G.heldGear.draw(ctx, w, hand.x, hand.y, base + s * 1.15, skin, G.heldGear.two(w)); return; }
        const tilt = a.dir === 2 ? -0.45 : a.dir === 1 ? 0.45 : a.dir === 0 ? -0.25 : 0.25;
        G.heldGear.draw(ctx, w, hand.x, hand.y, Math.PI / 2 + tilt * 0.6, skin);
        return;
      }
    }
    if (!w) return;   // fists: the punch is in the body animation itself (no separate fist square)
    let hx, hy;
    if (hand && sw) {   // the arm is the body's own: the move carries the hand and the weapon follows it
      hx = hand.x; hy = hand.y;
    } else { const out = 2 + pose.ext * 3; hx = shoulder.x + Math.cos(pose.ang) * out; hy = shoulder.y + Math.sin(pose.ang) * out * 0.8; }
    // the tip draws a ribbon behind it through the air, tapering away
    if (sw && (st.kind === 'swing' || st.kind === 'chop' || st.kind === 'slam')) {
      const L = G.heldGear.length(w), tips = sw.tips || (sw.tips = []); tips.push([hx + Math.cos(pose.ang) * L, hy + Math.sin(pose.ang) * L, hx + Math.cos(pose.ang) * L * 0.55, hy + Math.sin(pose.ang) * L * 0.55]); if (tips.length > 7) tips.shift();
      if (pose.p > 0 && tips.length > 2) for (let i = 1; i < tips.length; i++) {
        const q = tips[i - 1], r = tips[i], k = i / tips.length; ctx.fillStyle = sw.finisher ? `rgba(255,214,140,${(0.34 * k).toFixed(3)})` : `rgba(255,255,255,${(0.28 * k).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.lineTo(r[2], r[3]); ctx.lineTo(q[2], q[3]); ctx.closePath(); ctx.fill();
      }
    }
    G.heldGear.draw(ctx, w, hx, hy, pose.ang, hand ? skin : null, sw && G.heldGear.two(w));
  },
};
// G.combat.attack now starts a swing; the swing does the damage when it connects
G.combat.attack = function (attacker) { G.melee.start(attacker); return 0; };
const AP = G.Actor.prototype, _base = AP.baseUpdate, _draw = AP.draw;
AP.baseUpdate = function (dt, map) { if (this.swing) G.melee.update(this, dt); return _base.call(this, dt, map); };
AP.drawSwing = function () {};   // (the old white arc; the weapon itself shows the swing now)
AP.draw = function (ctx) {
  if (this.dead) return _draw.call(this, ctx);
  G.melee.draw(ctx, this, true);
  _draw.call(this, ctx);
  G.melee.draw(ctx, this, false);
};
// the sounds (punch, stab, whoosh, slash, chop, slam) are synthesized in js/engine/audio.js
})();
