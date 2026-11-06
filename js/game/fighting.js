'use strict';
// Hands and feet. A blow is a move of the whole body, not an arm on a still man: the back foot drives, the hips and shoulders turn, the
// weight goes over the front knee, the other hand stays up, and then all of it has to come back. Each move is a short list of key poses
// for the skeleton (js/game/realbody.js) and the frames between them are worked out from those, so it runs the same in all eight headings.
// Which punch comes out depends on where the blow goes, how far the target is and what came before; a miss carries further than a hit.
// Kicks are on Q. NPCs kick according to who they are and where the fight stands, never by the roll of a die alone.
(() => {
const STEPS = 8, GUARD = { legA: [0.3, -0.2], knee: [0.5, 0.3], lean: 1.2, twist: 0, ik: [[6.4, -3.2, 1], [6.4, 3.2, 1]] };
const K = (o) => Object.assign({}, GUARD, o);
// `h`: where on the list of poses the blow lands (0..1)
const MOVES = {
  jab: { h: 0.4, keys: [
    K({ lean: 0.6, twist: -0.22, ik: [[5, -3.4, 0.98], [6, 3.2, 1]] }),
    K({ legA: [0.42, -0.26], knee: [0.42, 0.24], lean: 2.2, twist: 0.3, ik: [[11, -2, 0.94], [5.6, 3.3, 0.99]] }),
    K({ legA: [0.46, -0.3], knee: [0.4, 0.2], lean: 3.4, twist: 0.6, ik: [[16, -0.8, 0.92], [5.2, 3.4, 0.98]] }),
    K({ legA: [0.4, -0.26], knee: [0.44, 0.26], lean: 2.4, twist: 0.3, ik: [[10, -2.2, 0.96], [5.8, 3.3, 0.99]] }),
    K({}), K({}) ] },
  cross: { h: 0.4, keys: [
    K({ lean: 0.2, twist: 0.36, ik: [[6, -3, 1], [3.2, 4.6, 0.95]] }),
    K({ legA: [0.44, -0.34], knee: [0.56, 0.22], lean: 2.4, twist: -0.3, ik: [[5.2, -3.4, 0.99], [10, 2.2, 0.93]] }),
    K({ legA: [0.5, -0.44], knee: [0.6, 0.14], lean: 4.6, twist: -0.86, ik: [[4.6, -3.6, 0.98], [17, 0.3, 0.92]] }),
    K({ legA: [0.44, -0.34], knee: [0.54, 0.24], lean: 2.8, twist: -0.4, ik: [[5.4, -3.4, 0.99], [10, 2, 0.95]] }),
    K({}), K({}) ] },
  hook: { h: 0.5, keys: [
    K({ lean: 0.8, twist: -0.5, knee: [0.62, 0.4], ik: [[3.6, -6, 0.96], [6, 3.2, 1]] }),
    K({ lean: 1.4, twist: -0.1, ik: [[9, -8, 0.93], [5.8, 3.2, 1]] }),
    K({ legA: [0.36, -0.28], lean: 2.4, twist: 0.5, ik: [[13, -3.4, 0.93], [5.4, 3.3, 0.99]] }),
    K({ legA: [0.34, -0.3], lean: 2.8, twist: 0.86, ik: [[11, 3, 0.93], [5.2, 3.4, 0.98]] }),
    K({ lean: 2, twist: 0.5, ik: [[8, -1, 0.97], [5.6, 3.3, 0.99]] }),
    K({}) ] },
  sweep: { h: 0.5, keys: [
    K({ lean: 0.4, twist: 0.6, ik: [[6, -3, 1], [2, 8, 0.98]] }),
    K({ lean: 1, twist: 0.3, ik: [[5.8, -3.2, 1], [9, 8, 0.92]] }),
    K({ legA: [0.44, -0.34], lean: 2.8, twist: -0.4, ik: [[5.4, -3.4, 1], [14, 2, 0.88]] }),
    K({ legA: [0.46, -0.4], lean: 3.2, twist: -1, ik: [[5, -3.6, 1], [10, -6, 0.86]] }),
    K({ lean: 2, twist: -0.5, ik: [[5.8, -3.4, 1], [8, 1, 0.94]] }),
    K({}) ] },
  upper: { h: 0.5, keys: [
    K({ legA: [0.46, -0.34], knee: [0.95, 0.76], lean: 2.4, twist: 0.3, ik: [[5.6, -3.2, 0.96], [4, 3.6, 0.6]] }),
    K({ legA: [0.42, -0.3], knee: [0.8, 0.6], lean: 2.2, twist: 0.16, ik: [[5.6, -3.2, 0.96], [7, 2.6, 0.68]] }),
    K({ legA: [0.34, -0.22], knee: [0.3, 0.14], lean: 0.8, twist: -0.5, ik: [[5.2, -3.4, 0.98], [10, 0.6, 0.94]] }),
    K({ legA: [0.3, -0.2], knee: [0.18, 0.1], lean: -0.6, twist: -0.66, ik: [[5, -3.4, 1], [9.4, 0.2, 1.08]] }),
    K({ lean: 0.6, twist: -0.2, ik: [[5.8, -3.2, 1], [7, 2, 0.98]] }),
    K({}) ] },
  body: { h: 0.4, keys: [
    K({ legA: [0.5, -0.36], knee: [0.86, 0.7], lean: 3, twist: -0.3, ik: [[4.6, -4, 0.76], [6, 3.2, 0.98]] }),
    K({ legA: [0.56, -0.4], knee: [0.86, 0.6], lean: 3.6, twist: 0.1, ik: [[9.6, -3, 0.66], [5.6, 3.3, 0.98]] }),
    K({ legA: [0.62, -0.44], knee: [0.84, 0.5], lean: 4.4, twist: 0.6, ik: [[14, -1, 0.6], [5.2, 3.4, 0.97]] }),
    K({ legA: [0.5, -0.36], knee: [0.8, 0.6], lean: 3, twist: 0.3, ik: [[9, -2, 0.7], [5.6, 3.3, 0.98]] }),
    K({}), K({}) ] },
  over: { h: 0.5, keys: [
    K({ lean: -0.8, twist: 0.5, ik: [[6, -3, 1], [0, 5, 1.32]] }),
    K({ lean: -0.4, twist: 0.4, ik: [[5.8, -3.1, 1], [3, 3.4, 1.36]] }),
    K({ legA: [0.46, -0.36], knee: [0.66, 0.24], lean: 3.2, twist: -0.4, ik: [[5.2, -3.3, 0.96], [12, 1.2, 1.06]] }),
    K({ legA: [0.52, -0.42], knee: [0.76, 0.2], lean: 5, twist: -0.8, ik: [[4.6, -3.5, 0.9], [14, 0.2, 0.7]] }),
    K({ lean: 2.4, twist: -0.3, ik: [[5.6, -3.2, 0.98], [8, 2, 0.9]] }),
    K({}) ] },
  // ---- feet. `leg` is the one that kicks: it may show from under a dress
  fkick: { h: 0.5, leg: 0, keys: [
    K({ legA: [0.1, -0.14], knee: [0.4, 0.3], lean: 0.4 }),
    K({ legA: [1.2, -0.08], knee: [1.9, 0.14], lean: -0.6, ik: [[5.6, -3.4, 1.02], [5.8, 3.4, 1.02]] }),
    K({ legA: [1.5, -0.1], knee: [0.5, 0.12], lean: -2, ik: [[5, -4, 1], [5, 4, 1]] }),
    K({ legA: [1.56, -0.12], knee: [0.08, 0.1], lean: -3, ik: [[3.6, -4.8, 0.94], [3.6, 4.8, 0.94]] }),
    K({ legA: [1.2, -0.1], knee: [1.7, 0.14], lean: -1, ik: [[5.4, -3.6, 1], [5.4, 3.6, 1]] }),
    K({ legA: [0.56, -0.2], knee: [0.8, 0.3], lean: 1.8 }),
    K({}) ] },
  rkick: { h: 0.55, leg: 1, keys: [
    K({ legA: [0.34, -0.5], knee: [0.46, 0.56], lean: 0.4, twist: 0.46 }),
    K({ legA: [0.22, 0.4], knee: [0.24, 1.2], lean: -0.6, twist: -0.3, legOut: [0, 5], ik: [[6.4, -3.4, 1], [3.6, 5, 0.96]] }),
    K({ legA: [0.16, 1], knee: [0.16, 1.9], lean: -2.2, twist: -0.9, legOut: [0, 8], ik: [[6, -3.6, 1.02], [1, 6, 0.9]] }),
    K({ legA: [0.12, 1.34], knee: [0.12, 0.3], lean: -4, twist: -1.3, legOut: [0, 3], ik: [[6, -3.8, 1], [-2, 6.6, 0.82]] }),
    K({ legA: [0.12, 1.26], knee: [0.14, 0.2], lean: -4.2, twist: -1.56, legOut: [0, -7], ik: [[6, -3.6, 1], [-3, 6, 0.8]] }),
    K({ legA: [0.2, 0.6], knee: [0.3, 1.1], lean: -1.6, twist: -0.7, legOut: [0, -2], ik: [[6, -3.4, 1], [3, 4.4, 0.92]] }),
    K({ legA: [0.3, -0.12], knee: [0.46, 0.42], lean: 0.6, twist: -0.1 }),
    K({}) ] },
  lkick: { h: 0.5, leg: 1, keys: [
    K({ legA: [0.34, -0.44], knee: [0.56, 0.44], lean: 0.8, twist: 0.3 }),
    K({ legA: [0.26, 0.1], knee: [0.46, 0.7], lean: 0, twist: -0.2, legOut: [0, 4] }),
    K({ legA: [0.22, 0.56], knee: [0.42, 0.3], lean: -1, twist: -0.76, legOut: [0, 2], ik: [[6.2, -3.4, 1], [3.6, 5, 0.9]] }),
    K({ legA: [0.22, 0.62], knee: [0.42, 0.14], lean: -1.4, twist: -1, legOut: [0, -5], ik: [[6.2, -3.4, 1], [2.4, 5.4, 0.88]] }),
    K({ legA: [0.26, 0.1], knee: [0.46, 0.5], lean: 0.2, twist: -0.3 }),
    K({}) ] },
  skick: { h: 0.5, leg: 0, keys: [
    K({ legA: [0.16, -0.26], knee: [0.5, 0.4], lean: 0.2, twist: 0.6 }),
    K({ legA: [0.9, -0.06], knee: [2, 0.2], lean: -1, twist: 1.1, ik: [[5, -2, 1.02], [6, 3, 1]] }),
    K({ legA: [1.3, -0.08], knee: [0.8, 0.16], lean: -3.4, twist: 1.3, ik: [[4, -1, 0.98], [3, 5, 0.96]] }),
    K({ legA: [1.5, -0.1], knee: [0.06, 0.12], lean: -5.4, twist: 1.46, ik: [[3, -1, 0.92], [0, 6, 0.86]] }),
    K({ legA: [0.9, -0.08], knee: [1.8, 0.2], lean: -1.6, twist: 1, ik: [[5, -2, 1], [5, 3.4, 0.98]] }),
    K({ legA: [0.46, -0.2], knee: [0.8, 0.3], lean: 1, twist: 0.3 }),
    K({}) ] },
  stomp: { h: 0.5, leg: 0, keys: [
    K({ legA: [0.34, -0.2], knee: [0.6, 0.4], lean: 1.6 }),
    K({ legA: [1.16, -0.14], knee: [1.9, 0.3], lean: 0.8, ik: [[6, -3.6, 0.96], [6, 3.6, 0.96]] }),
    K({ legA: [1.26, -0.14], knee: [1.5, 0.3], lean: 1.4, ik: [[6, -3.8, 0.94], [6, 3.8, 0.94]] }),
    K({ legA: [0.7, -0.2], knee: [0.16, 0.5], lean: 3.6, ik: [[5, -4.6, 0.82], [5, 4.6, 0.82]] }),
    K({ legA: [0.72, -0.22], knee: [0.3, 0.5], lean: 3, ik: [[5.4, -4, 0.86], [5.4, 4, 0.86]] }),
    K({ legA: [0.5, -0.2], knee: [0.6, 0.4], lean: 1.8 }),
    K({}) ] },
  knee: { h: 0.5, leg: 1, keys: [
    K({ legA: [0.4, -0.42], knee: [0.5, 0.4], lean: 0.6, ik: [[9, -3, 1], [9, 3, 1]] }),
    K({ legA: [0.34, 0.5], knee: [0.3, 1.6], lean: 1, ik: [[11, -2.6, 0.94], [11, 2.6, 0.94]] }),
    K({ legA: [0.3, 1.4], knee: [0.2, 2.3], lean: 2.6, twist: -0.3, ik: [[10, -2.2, 0.82], [10, 2.2, 0.82]] }),
    K({ legA: [0.3, 1.5], knee: [0.2, 2.3], lean: 3.2, twist: -0.4, ik: [[9, -2.2, 0.76], [9, 2.2, 0.76]] }),
    K({ legA: [0.34, 0.5], knee: [0.3, 1.2], lean: 1.6, ik: [[7, -3, 0.94], [7, 3, 0.94]] }),
    K({}) ] },
};
const lerp = (a, b, k) => a + (b - a) * k;
const pair = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const strike = (kind, f, base) => {
  const m = MOVES[kind], s = Math.min(1, f / (STEPS - 1)) * (m.keys.length - 1), i = Math.min(m.keys.length - 2, Math.floor(s)), k = s - i, a = m.keys[i], b = m.keys[i + 1], e = k * k * (3 - 2 * k), zero = [0, 0];
  return Object.assign(base, { legA: pair(a.legA, b.legA, e), knee: pair(a.knee, b.knee, e), lean: lerp(a.lean, b.lean, e), twist: lerp(a.twist, b.twist, e), legOut: pair(a.legOut || zero, b.legOut || zero, e), ik: [0, 1].map((n) => [0, 1, 2].map((c) => lerp(a.ik[n][c], b.ik[n][c], e) * (c === 2 ? 0.84 : 1))), kickLeg: m.leg, hasLeg: m.leg != null });
};
G.body.MOVES = MOVES; G.body.strike = strike;
// frames of every move take their place after the old ones
const COL = G.hd.COL, KINDS = G.hd.KINDS; let col = 58;
for (const name of Object.keys(MOVES)) { COL[name] = col; for (let f = 0; f < STEPS; f++) KINDS[col + f] = [name, f]; col += STEPS; }

// ---------------------------------------------------------------- the styles of the feet
const S = G.melee.STYLES;
Object.assign(S, {
  k_front: { kind: 'kick', move: 'fkick', wind: 0.13, act: 0.1, rec: 0.25, reach: 21, arc: 0.7, sound: 'punch', shake: 3, kb: 2.1, spark: '#e8d0b0', mult: 1.05, stamina: 10 },
  k_round: { kind: 'kick', move: 'rkick', wind: 0.18, act: 0.13, rec: 0.3, reach: 20, arc: 1.7, sound: 'punch', shake: 4, kb: 1.4, spark: '#e8d0b0', mult: 1.5, stamina: 14, stagger: 0.45 },
  k_low: { kind: 'kick', move: 'lkick', wind: 0.1, act: 0.09, rec: 0.2, reach: 17, arc: 1, sound: 'punch', shake: 2, kb: 0.5, spark: '#e8d0b0', mult: 0.9, stamina: 7, stagger: 0.3 },
  k_side: { kind: 'kick', move: 'skick', wind: 0.15, act: 0.1, rec: 0.27, reach: 23, arc: 0.55, sound: 'punch', shake: 4, kb: 2.5, spark: '#e8d0b0', mult: 1.25, stamina: 12 },
  k_stomp: { kind: 'kick', move: 'stomp', wind: 0.14, act: 0.08, rec: 0.23, reach: 15, arc: 1.3, sound: 'punch', shake: 3, kb: 0.2, spark: '#c02020', mult: 1.7, stamina: 9 },
  k_knee: { kind: 'kick', move: 'knee', wind: 0.08, act: 0.08, rec: 0.2, reach: 12, arc: 1.2, sound: 'punch', shake: 3, kb: 1, spark: '#e8d0b0', mult: 1.35, stamina: 8, stagger: 0.25 },
});
S.fists.wind = S.knuckle.wind = 0.07; S.fists.act = S.knuckle.act = 0.09; S.fists.rec = S.knuckle.rec = 0.16; S.fists.reach = 15; S.knuckle.reach = 16;
const WEAPON_MOVE = { thrust: 'cross', swing: 'sweep', chop: 'over', slam: 'over' };
const norm = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const headingOf = (a) => { const b = a._b; return b ? G.body.headingAng(b.h) : Math.atan2(G.util.DIR_VEC[a.dir][1], G.util.DIR_VEC[a.dir][0]); };
const lyingDown = (t) => t.downT > 0 || (t.st && t.st.ko) || t.lying;
const F = G.fight = {
  STEPS,
  // whoever is nearest in the way of the blow
  front(a, scene, base, range = 34) { let best = null, bd = 1e9; for (const t of scene.actors) { if (t === a || t.dead || !a.canHit(t)) continue; const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy); if (d > range || d >= bd) continue; if (d > 8 && Math.abs(norm(Math.atan2(dy, dx) - base)) > 1.1) continue; best = t; bd = d; } return best ? { t: best, d: bd } : null; },
  // the punch that fits: how far they are, how far the body has to turn, what side of the screen it goes to, what came before it
  punch(a, sw, scene) {
    const f = scene ? this.front(a, scene, sw.base) : null, turn = Math.abs(norm(sw.base - headingOf(a))), c = Math.cos(sw.base), s = Math.sin(sw.base), n = a.punchCount || 0;
    if (f && lyingDown(f.t)) return 'over';
    if (f && f.d < 9) return n % 2 ? 'upper' : 'body';
    if (turn > 0.9) return 'hook';
    if (Math.abs(c) > 0.85) return ['jab', 'cross', 'hook'][n % 3];       // across the screen
    if (s > 0.85) return ['jab', 'hook', 'upper'][n % 3];                 // towards the camera
    if (s < -0.85) return ['cross', 'over', 'body'][n % 3];               // away from it
    return ['jab', 'body', 'cross'][n % 3];                               // the diagonals
  },
  // which frame of the move this moment of the swing is: the blow lands on `h`, the rest is coming back
  col(sw) {
    const st = sw.st, m = MOVES[sw.move]; if (!m) return COL.idle;
    const w = st.wind + st.act, s = sw.t < w ? (sw.t / w) * m.h : m.h + (Math.min(1, (sw.t - w) / st.rec)) * (1 - m.h);
    return COL[sw.move] + Math.min(STEPS - 1, Math.round(s * (STEPS - 1)));
  },
  // ---- the player's feet: where the blow goes, how you are moving, who is in front of you
  choose(a, scene, base) {
    const f = this.front(a, scene, base, 38), c = Math.abs(Math.cos(base)), n = a.kickCount || 0, run = a.moving && (a.running || G.input.isDown('run'));
    if (f && lyingDown(f.t) && f.d < 20) return 'k_stomp';
    if (f && f.d < 10) return 'k_knee';
    if (run) return c > 0.6 ? 'k_side' : 'k_front';
    if (a.moving && Math.abs(norm(Math.atan2(a.vy || 0, a.vx || 0) - base)) > 1.2) return 'k_round';
    if (c > 0.85) return ['k_side', 'k_low', 'k_round'][n % 3];   // across the screen
    if (Math.sin(base) > 0) return ['k_round', 'k_front', 'k_low'][n % 3];   // towards the camera
    return ['k_front', 'k_round', 'k_low'][n % 3];
  },
  kick(a, styleId, scene) {
    const st = S[styleId]; if (a.swing || !st || !(a.attackCd <= 0)) return false;
    const base = a.kind === 'player' ? a.aim : a.target ? Math.atan2(a.target.y - a.y, a.target.x - a.x) : Math.atan2(G.util.DIR_VEC[a.dir][1], G.util.DIR_VEC[a.dir][0]);
    a.kickCount = (a.kickCount || 0) + 1;
    a.swing = { st, t: 0, base, side: 1, hit: new Set(), from: null, hook: false, move: st.move };
    const t = G.melee.total(st);
    a.attackTimer = t; a.attackCd = Math.max(a.attackCd || 0, t + (a.kind === 'npc' ? 0.3 : 0.04));
    G.audio.play('swing', { x: a.x, y: a.y });
    if (scene) scene.lastKick = st.move;
    return true;
  },
  playerKick(p, scene) {
    if (p.swing || p.attackCd > 0 || p.handsUp || p.dragging || p.swimming || p.seated) return false;
    const id = this.choose(p, scene, p.aim), st = S[id];
    if (p.stamina < st.stamina * 0.6) return false;
    if (!this.kick(p, id, scene)) return false;
    p.stamina -= st.stamina * Math.max(0.2, 1 + G.skills.stat(p, 'meleeStamina')); p.staminaDelay = 0.6; p.combatTimer = 4;
    return true;
  },
  // ---- who kicks, and when: a fighter's style, a person's body and temper, how the fight is going
  temper(a) {
    if (a._kickT != null) return a._kickT;
    const d = a.def || {}, L = a.look || {}, fc = G.fightClub && G.fightClub.statOf && G.fightClub.statOf(a), id = a.id || a.def && a.def.name || '', hash = [...String(id)].reduce((n, c) => n * 31 + c.charCodeAt(0) >>> 0, 7);
    let k = d.combat === 'fight' ? 0.45 : d.combat === 'guard' ? 0.3 : 0.08;
    if (/gang|punks|criminals|bandit/.test(d.faction || '')) k += 0.2;
    if (d.kid || L.old || L.kid) k = 0;
    if (L.build === 2) k -= 0.1;                   // heavy: the feet stay low
    if (fc) k = { boxer: 0.05, brawler: 0.4, heavy: 0.2, technician: 0.7 }[fc.style] != null ? { boxer: 0.05, brawler: 0.4, heavy: 0.2, technician: 0.7 }[fc.style] : 0.45;
    k += ((hash % 21) - 10) * 0.02;                // and everyone is their own person
    return (a._kickT = Math.max(0, k));
  },
  npcKick(a, scene) {
    const t = a.target; if (!t || t.dead || a.def.kid) return null;
    const temper = this.temper(a), d = a.distTo(t), hurt = a.hp < (a.maxHp || 30) * 0.4, w = a.weaponItem, gun = w && w.gun;
    if (temper <= 0 || (a.kickCd || 0) > G.loop.time || a.drunk > 0.5) return null;
    let id = null;
    if (lyingDown(t)) id = temper > 0.25 && d < 20 && a.def.combat !== 'guard' ? 'k_stomp' : null;        // a cop does not stomp a man who is down
    else if (d < 10) id = gun ? 'k_front' : temper > 0.2 ? 'k_knee' : hurt ? 'k_front' : null;            // too close: get them off
    else if (gun) id = null;
    else if (t.fcBlock > 0 || t.guarding) id = 'k_low';                                                    // the hands are up: go under them
    else if (w) id = d > 12 && temper > 0.4 ? 'k_front' : null;                                            // a weapon does the rest
    else if ((a.punchCount || 0) >= 2 && temper > 0.55 && d > 11) id = 'k_round';                          // after a combination
    else if (d > 13 && temper > 0.3) id = a.def.combat === 'guard' ? 'k_front' : 'k_side';                 // at the end of their reach
    else if (temper > 0.2 && (a.punchCount || 0) % 3 === 2) id = 'k_low';
    if (!id) return null;
    a.kickCd = G.loop.time + 2.4 + (1 - Math.min(1, temper)) * 3;
    a.punchCount = 0;
    return id;
  },
};

// ---------------------------------------------------------------- into the swing
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const M = G.melee, _start = M.start, _update = M.update, _hits = M.hits;
M.start = function (a) {
  const r = _start.apply(this, arguments), sw = a.swing;
  if (r && sw) {
    sw.move = WEAPON_MOVE[sw.st.kind] || F.punch(a, sw, sceneNow());
    sw.hook = sw.move === 'hook';
  }
  return r;
};
M.update = function (a, dt) {
  const sw = a.swing;
  // a blow that met nothing carries on: the body has further to come back
  if (sw && sw.st && sw.t > sw.st.wind + sw.st.act && !sw.hit.size && sw.st.kind === 'kick') dt *= 0.72;
  return _update.call(this, a, dt);
};
M.hits = function (a, scene, sw) {
  const before = sw.hit.size, r = _hits.apply(this, arguments), st = sw.st;
  if (st.kind === 'kick' && sw.hit.size > before) for (const t of sw.hit) {
    if (st.stagger) t.staggerT = Math.max(t.staggerT || 0, st.stagger);
  }
  return r;
};
const _attack = G.combat.attack;
G.combat.attack = function (a, scene) {
  if (a.kind === 'npc' && !a.swing && scene) { const id = F.npcKick(a, scene); if (id && F.kick(a, id, scene)) return 0; }
  return _attack.apply(this, arguments);
};
// the key (Q): the menus keep it for their tabs
const I = G.input;
if (!I.defaultBindings.kick) { I.defaultBindings.kick = ['KeyQ']; if (I.bindings && !I.bindings.kick) I.bindings.kick = ['KeyQ']; I.rebindable.push('kick'); I.actionLabels.kick = 'Kick'; }
Object.assign(G.LANG_PT.s, { Kick: 'Chutar' });
})();
