'use strict';
// What a body and a face give away. Which of the new frames someone uses (js/game/hdchars.js), from what is really
// happening to them, and the expression over the sprite: pain, fear, anger, exhaustion. Children keep their own look.
(() => {
const COND = G.bodyLang = {
  // 0..1 how badly someone is hurt, afraid, spent
  hurt: (a) => (a.maxHp ? 1 - a.hp / a.maxHp : 0),
  fear: (a) => (a.st && a.st.fear ? a.st.fear / 100 : 0) + (a.cower > 0 ? 0.5 : 0),
  spent(a) {
    if (a.kind === 'player') { const r = G.rest ? G.rest.get(a) : 100; return Math.max(r < 25 ? (25 - r) / 25 : 0, a.maxStamina ? 1 - a.stamina / a.maxStamina : 0); }
    return a.st && a.st.tired ? 0.7 : 0;
  },
  angry: (a) => a.state === 'fight' || (a.kind === 'player' && a.combatTimer > 0),
  gun: (a) => !!(a.weaponItem && a.weaponItem.gun),
};
const kid = (a) => !!(a.def && a.def.kid);
G.hd.gait = (a) => {
  if (kid(a)) return 'walk';
  if (COND.hurt(a) > 0.62) return 'limp';
  if (COND.fear(a) > 0.5 || COND.spent(a) > 0.5 || (G.wet && G.wet.worn(a) > 0.7)) return 'hunch';
  return 'walk';
};
G.hd.stance = (a) => {
  if (kid(a) || a.sleeping || a.dead || a.sitting || a.swing) return null;
  if (a.kind === 'player' && a.maxStamina && a.stamina < a.maxStamina * 0.14) return 'winded';
  if (COND.angry(a) && !COND.gun(a)) return 'guard';
  if (COND.hurt(a) > 0.62 || COND.spent(a) > 0.5) return 'slump';
  return null;
};
// drawn live over the head, in sprite pixels scaled to the world
G.hd.expression = (ctx, a, hd, dir, hp, x0, y0, kx, ky) => {
  if (kid(a) || hd.L.mask || a.sleeping || a.dead) return;
  const hurt = COND.hurt(a), fear = COND.fear(a), spent = COND.spent(a), angry = COND.angry(a);
  if (hurt < 0.45 && fear < 0.5 && spent < 0.5 && !angry) return;
  const hs = hp.hs || 1, front = dir === 0, s = dir === 2 ? 1 : -1, ex = (u) => x0 + (hp.hx + u * hs) * kx, ey = (v) => y0 + (hp.hy + v * hs) * ky;
  const P = (u, v, w, c) => { ctx.fillStyle = c; ctx.fillRect(ex(u), ey(v), w * hs * kx, hs * ky); };
  const dark = G.assets.shade(hd.L.skin, 0.5), brow = hd.L.brow, lid = G.assets.shade(hd.L.skin, 0.82);
  if (front) {
    if (angry || hurt > 0.45) { P(2, 2.6, 1.4, brow); P(4.6, 2.6, 1.4, brow); P(3.4, 3.2, 1.2, dark); }           // brows pulled together and down
    if (fear > 0.5) { P(1, 3.8, 2, 'rgba(226,222,212,0.9)'); P(5, 3.8, 2, 'rgba(226,222,212,0.9)'); P(1.6, 4, 0.8, hd.L.eyes); P(5.6, 4, 0.8, hd.L.eyes); P(3, 7, 2, '#2a1214'); }   // whites showing, mouth open
    if (spent > 0.5 && fear < 0.5) { P(1, 4, 2, lid); P(5, 4, 2, lid); }                                          // lids half down
    if (hurt > 0.45 && fear < 0.5) P(2, 7, 4, '#2a1214');                                                         // teeth set
    else if (angry) { P(2, 7, 4, dark); }
  } else {
    const fx = s > 0 ? 7 : 0, b = s > 0 ? -1 : 1;
    if (angry || hurt > 0.45) P(fx, 3.3, 1, brow);
    if (fear > 0.5) { P(fx + b, 3.8, 1.4, 'rgba(226,222,212,0.9)'); P(fx, 7, 1, '#2a1214'); }
    if (spent > 0.5 && fear < 0.5) P(fx + b, 4, 2, lid);
    if (hurt > 0.45 && fear < 0.5) P(fx + b, 7, 2, '#2a1214');
  }
};
})();
