'use strict';
// Parked cars are the same cars that drive, with the same art, standing where their solid ground is. And nothing shoves you any more: a car
// that came to stand on you moves you out by the shortest way, slowly; a parked car does nothing at all. (A parked car used to push anyone
// within 4 px of it straight away from its centre at 90 px a second, while you were only stopped at 2 px: leaning on a door slid you along it.)
(() => {
const A = G.assets, _dd = G.drawDecor, PARKED = /^car_|^police_car$|^limo$/, GS = G.GameScene.prototype;
const SP = 42;   // pixels a second, at most: what is under a car walks out from under it
const flipOf = (d) => G.util.hash2(d.tx, d.ty, 13) < 0.5;
G.drawDecor = function (ctx, d, s, view) {
  const m = G.vehicles.MODELS[d.type];
  if (!m || !PARKED.test(d.type) || d.def.flat) return _dd.apply(this, arguments);
  const art = G.vehiclesHD.get(d.type), y = d.ty * 16, k = 0.25;
  ctx.save(); ctx.translate(d.x, y); if (flipOf(d)) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(-m.len / 2 + 1, -m.wid / 2 + 3, m.len, m.wid);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, -art.width * k / 2, -art.height * k / 2, art.width * k, art.height * k);
  ctx.restore(); return undefined;
};
const _from = G.vehicles.fromDecor;
G.vehicles.fromDecor = function (scene, d) { const v = _from.apply(this, arguments); if (flipOf(d)) v.angle = Math.PI; return v; };
// a parked car stands in the middle of the ground that blocks you
const TM = G.TileMap.prototype, _cs = TM.computeSolids;
TM.computeSolids = function () { for (const d of this.decor || []) if (G.vehicles.MODELS[d.type] && PARKED.test(d.type)) d.x = d.tx * 16 + (d.def.fw || 1) * 8; return _cs.apply(this, arguments); };
// the shortest way out of a car's body, for whoever it is standing on
G.vehicles.easeOut = function (v, a, dt) {
  const q = v.covers(a.x, a.y, 2); if (!q) return false;
  const c = Math.cos(v.angle), s = Math.sin(v.angle), byL = v.L + 2 - Math.abs(q.lx), byW = v.Wd + 2 - Math.abs(q.ly), st = Math.min(SP * dt, Math.min(byL, byW) + 0.01);
  const lx = byL < byW ? Math.sign(q.lx || 1) * st : 0, ly = byL < byW ? 0 : Math.sign(q.ly || 1) * st, wx = lx * c - ly * s, wy = lx * s + ly * c, sc = G.doors && G.doors.scene, map = sc && sc.map;
  if (!map || !map.rectCollides(a.x + wx - a.w / 2, a.y + wy - a.h, a.w, a.h, a.canSwim)) { a.x += wx; a.y += wy; }
  return true;
};
// out of a wall or a crate: the nearest free spot, found finely, and walked to; never a jump
const E = G.everyday;
E.nearSpot = function (map, a) {
  const w = a.w, h = a.h;
  for (let r = 3; r <= 96; r += 3) { let best = null, bd = 1e9; for (let i = 0; i < 16; i++) { const t = i / 16 * 6.283, x = a.x + Math.cos(t) * r, y = a.y + Math.sin(t) * r; if (!map.rectCollides(x - w / 2, y - h, w, h, a.canSwim)) { const d = Math.abs(Math.cos(t)) + Math.abs(Math.sin(t)); if (d < bd) { bd = d; best = { x, y }; } } } if (best) return best; }
  return null;
};
void GS; void A;
})();
