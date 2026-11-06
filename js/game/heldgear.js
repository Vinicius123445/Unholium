'use strict';
// Weapons in the hand, at the size of the person holding them.
// Each weapon is a small model drawn along its own axis, with the grip at the hand: a knife is a short
// blade past the fist, a bat reaches about to the knee, a rifle runs from the shoulder to past the hands.
// (They used to be the 16 px inventory icons, which made every weapon about as long as an arm and a leg.)
// The model is mirrored when it points left so the top of a gun stays on top. The fist is drawn over the
// grip so it reads as held. Used by js/game/melee.js (at rest and swinging) and js/game/firearms.js.
(() => {
// a part: [from, to, width, color, perpendicular offset (negative = up/top side), width at the far end]
const WOOD = '#a8783e', WOOD_D = '#7a522a', STEEL = '#b8bec8', STEEL_D = '#6a707a', BLACK = '#22232a', GUN = '#2a2c32', GUN_L = '#4a4e58';
const M = {
  bat:          [[-1.5, 0.5, 0.7, WOOD_D], [0.5, 8.5, 0.8, WOOD, 0, 1.6]],
  spiked_bat:   [[-1.5, 0.5, 0.7, WOOD_D], [0.5, 8.5, 0.8, WOOD, 0, 1.6], [5.5, 5.9, 2.8, STEEL_D], [7.3, 7.7, 3, STEEL_D]],
  cue:          [[-2, 2, 0.8, WOOD_D], [2, 10, 0.7, '#d8b878', 0, 0.45], [9.6, 10.2, 0.5, '#e8eef0']],
  pipe:         [[-1, 7, 1.1, '#7a7e86'], [-1, 7, 0.4, '#a8acb4', -0.3], [6.6, 7.2, 1.5, '#5a5e66']],
  crowbar:      [[-1, 6.5, 0.8, '#8a2a24'], [6.5, 7.2, 0.8, '#8a2a24', -0.6], [6.8, 7.2, 0.8, '#8a2a24', -1.4]],
  baton:        [[-1.5, 6, 0.9, BLACK], [-1.5, 6, 0.3, '#4a4a54', -0.3], [0.5, 1, 1.3, BLACK, 0.6]],
  sledge:       [[-1.5, 8, 0.7, WOOD], [7, 9, 3.2, '#5a5e66'], [7, 9, 0.8, '#8a8e96', -1.1]],
  knuckles:     [[-0.6, 0.8, 1.8, '#c8a040'], [-0.2, 0.4, 0.8, '#8a6a20']],
  pocket_knife: [[-1, 0.8, 0.9, '#5a3a22'], [0.8, 3.2, 0.6, STEEL, -0.1, 0.25]],
  switchblade:  [[-1, 0.8, 0.9, BLACK], [0.8, 3.4, 0.6, STEEL, -0.1, 0.2]],
  kitchen_knife:[[-1, 1.2, 0.9, BLACK], [1.2, 4.6, 1.1, '#d8dce4', 0.15, 0.3]],
  combat_knife: [[-1, 1, 0.9, BLACK], [1, 1.3, 1.8, STEEL_D], [1.3, 5, 0.9, STEEL, 0, 0.3]],
  axe:          [[-1, 5.5, 0.7, WOOD], [4.4, 5.6, 2.6, '#6a6e78', -0.9, 3.2], [4.4, 5.6, 0.5, '#d8dce4', -2.2]],
  fire_axe:     [[-1.5, 8, 0.8, '#c82a2a'], [6.8, 8.2, 2.8, '#7a7e86', -1, 3.4], [6.8, 8.2, 0.5, '#e0e4ea', -2.5], [6.9, 8, 1.4, '#7a7e86', 1.1]],
  pitchfork:    [[-3, 9.5, 0.6, WOOD], [9.3, 9.7, 3, STEEL_D], [9.5, 12, 0.35, STEEL, -1.3], [9.5, 12, 0.35, STEEL], [9.5, 12, 0.35, STEEL, 1.3]],
  katana:       [[-2.2, 0.8, 0.8, '#2a2030'], [0.8, 1.1, 1.8, '#c8a040'], [1.1, 10, 0.7, '#e0e6ee', 0, 0.35], [1.1, 10, 0.25, '#ffffff', -0.2]],
  machete:      [[-1, 1.4, 0.9, BLACK], [1.4, 7.5, 1, '#9aa0aa', 0.1, 1.6], [1.4, 7.5, 0.3, '#d8dce4', -0.4]],
  // guns: x along the barrel from the trigger hand
  pistol:       [[-0.8, 3.4, 1.2, GUN, -0.3], [-0.8, 3.4, 0.3, GUN_L, -0.8], [-0.4, 0.6, 1.8, GUN, 0.8]],
  revolver:     [[0, 4.2, 0.7, GUN, -0.5], [-0.2, 1.2, 1.4, GUN_L, -0.2], [-0.8, 0.2, 1.8, '#5a3a22', 0.8]],
  smg:          [[-1.5, 3.2, 1.6, GUN, -0.2], [3.2, 4.8, 0.6, GUN, -0.4], [0.4, 1.2, 2.4, GUN_L, 1.3], [-2.8, -1.5, 0.7, GUN, -0.5]],
  shotgun:      [[-4.2, -0.6, 1.4, WOOD_D, 0.2, 1.1], [-0.6, 1.6, 1.3, GUN, -0.1], [1.6, 8.5, 0.6, GUN, -0.4], [3, 5.6, 0.9, WOOD, 0.4]],
  rifle:        [[-4.4, -0.4, 1.4, WOOD, 0.2, 1], [-0.4, 3, 1.1, WOOD, 0], [-0.4, 3, 0.6, GUN, -0.6], [3, 9.5, 0.5, GUN, -0.5], [0, 2.6, 0.9, BLACK, -1.6]],
  assault_rifle:[[-4, -0.6, 1.3, GUN, 0.1], [-0.6, 3.6, 1.4, GUN, -0.1], [0.8, 1.6, 2.6, GUN_L, 1.4], [3.6, 7.8, 0.6, GUN, -0.3], [0.2, 2.4, 0.6, BLACK, -1.2]],
};
// what straight bars cannot draw: hooks, edges, curves. [points, color]
const SHAPE = {
  crowbar:      [[[[6.5, -0.42], [8.1, -0.55], [8.9, -1.4], [8.7, -2.5], [8.15, -2.3], [8.2, -1.6], [7.6, -1], [6.5, 0.42]], '#8a2a24'], [[[-1, -0.42], [-2.2, -0.12], [-2.2, 0.12], [-1, 0.42]], '#a8acb4']],
  katana:       [[[[1.1, -0.42], [6, -0.62], [10.4, -1.1], [6, -0.02], [1.1, 0.42]], '#dfe5ee']],
  machete:      [[[[1.4, -0.5], [7.2, -0.75], [8.1, -0.1], [7.3, 1.05], [1.4, 0.75]], '#a4aab4']],
  kitchen_knife:[[[[1.2, -0.45], [5.2, -0.3], [5.4, -0.1], [3, 0.72], [1.2, 0.72]], '#dde1e8']],
  combat_knife: [[[[1.3, -0.5], [4.2, -0.5], [5.4, 0], [4.2, 0.5], [1.3, 0.5]], '#b8bec8']],
  axe:          [[[[4.3, -0.3], [4.1, -2.6], [5.9, -3], [5.7, -0.3]], '#6a6e78'], [[[4.05, -2.3], [4.1, -2.75], [5.95, -3.1], [5.95, -2.6]], '#dfe3ea']],
  fire_axe:     [[[[6.8, -0.3], [6.6, -2.6], [8.5, -3], [8.3, -0.3]], '#8a8e96'], [[[6.55, -2.25], [6.6, -2.75], [8.55, -3.1], [8.55, -2.6]], '#e4e8ee'], [[[6.9, 0.3], [8.2, 0.3], [7.7, 2.1]], '#6a6e78']],
};
// a weapon its real length beside a person 1.7 m tall (the world has 20 pixels to the metre)
const SIZE = { bat: 1.75, spiked_bat: 1.75, cue: 2.2, pipe: 1.7, crowbar: 1.45, baton: 1.45, sledge: 1.8, c_hammer: 1.25, hammer: 1.25, knuckles: 1.15, pocket_knife: 1.15, switchblade: 1.2, kitchen_knife: 1.3, combat_knife: 1.4, axe: 1.65, fire_axe: 1.7, pitchfork: 1.7, katana: 1.9, machete: 1.55, pistol: 1.25, revolver: 1.3, smg: 1.4, shotgun: 1.6, rifle: 1.7, assault_rifle: 1.6 };
M.hammer = M.c_hammer = [[-1.5, 5.5, 0.75, WOOD], [-1.5, 1.2, 0.95, '#2a2c32'], [5.2, 6.4, 3, '#5a5e66'], [5.2, 6.4, 0.7, '#8a8e96', -1]];
M.c_screwdriver = [[-1, 1.6, 1.2, '#c8a020'], [1.6, 6, 0.38, STEEL]];
const TWO = /^(bat|spiked_bat|cue|sledge|fire_axe|axe|pitchfork|katana)$/;
const FALLBACK = { pistol: 'pistol', rifle: 'rifle', shotgun: 'shotgun', smg: 'smg', knife: 'kitchen_knife', blade: 'machete', blunt: 'pipe' };
const iconOf = (w) => (M[w.icon] ? w.icon : FALLBACK[w.cat] || 'pipe');
const sh = (c, k) => (/^#/.test(c) ? G.assets.shade(c, k) : c);
const fist = (ctx, x, y, skin) => { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x, y, 1, 1.1, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(x - 0.8, y + 0.45, 1.6, 0.3); ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.6 + i * 0.5, y - 0.8, 0.12, 1); };

G.heldGear = {
  MODELS: M,
  modelOf(w) { return M[iconOf(w)]; },
  sizeOf(w) { return SIZE[iconOf(w)] || 1.4; },
  two(w) { return TWO.test(iconOf(w)); },
  // the farthest point of the weapon from the hand (for muzzle flashes and the like)
  length(w) { let L = 0; for (const p of this.modelOf(w)) L = Math.max(L, p[1]); return L * this.sizeOf(w); },
  // draw w with its grip at (x, y) pointing along ang; skin: the fist over the grip; both: the other hand up the shaft too
  draw(ctx, w, x, y, ang, skin, both) {
    const name = iconOf(w), parts = M[name], extra = SHAPE[name] || [], flip = Math.cos(ang) < 0 ? -1 : 1, k = SIZE[name] || 1.4, smooth = ctx.imageSmoothingEnabled;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k * flip); ctx.imageSmoothingEnabled = true;
    const bar = (p, e) => { const [a, b, wd, , off = 0, wd2 = wd] = p; ctx.beginPath(); ctx.moveTo(a - e, off - wd / 2 - e); ctx.lineTo(b + e, off - wd2 / 2 - e); ctx.lineTo(b + e, off + wd2 / 2 + e); ctx.lineTo(a - e, off + wd / 2 + e); ctx.closePath(); };
    const poly = (s) => { ctx.beginPath(); s[0].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); };
    // a dark rim so the shape reads against any ground
    ctx.fillStyle = ctx.strokeStyle = 'rgba(8,8,12,0.6)'; ctx.lineWidth = 0.42 / k + 0.16; ctx.lineJoin = 'round';
    for (const p of parts) { bar(p, 0.1); ctx.fill(); ctx.stroke(); }
    for (const s of extra) { poly(s); ctx.fill(); ctx.stroke(); }
    // lit from above: bright along the top of each part, dark along the bottom
    for (const p of parts) {
      const [, , wd, col, off = 0, wd2 = wd] = p, hw = Math.max(wd, wd2) / 2, g = ctx.createLinearGradient(0, off - hw, 0, off + hw);
      g.addColorStop(0, sh(col, 1.42)); g.addColorStop(0.42, col); g.addColorStop(1, sh(col, 0.58)); ctx.fillStyle = g; bar(p, 0); ctx.fill();
    }
    for (const s of extra) {
      const ys = s[0].map((q) => q[1]), g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
      g.addColorStop(0, sh(s[1], 1.32)); g.addColorStop(1, sh(s[1], 0.7)); ctx.fillStyle = g; poly(s); ctx.fill();
    }
    ctx.restore(); ctx.imageSmoothingEnabled = smooth;
    if (skin) { fist(ctx, x, y, skin); if (both) fist(ctx, x + Math.cos(ang) * 3.4, y + Math.sin(ang) * 3.4, skin); }
  },
  // a weapon on the ground, for js/game/groundloot.js
  tip(w, x, y, ang) { const L = this.length(w); return { x: x + Math.cos(ang) * L, y: y + Math.sin(ang) * L }; },
};
})();
