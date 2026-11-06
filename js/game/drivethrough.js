'use strict';
// Driving across map edges. A car's center never reached the exit zone at the very edge of a map: its nose
// hit the edge first (the world beyond the edge counts as solid), so cars stopped dead at every road out,
// an invisible wall. Now the car's NOSE decides: drive at an exit and you go through, car and all. Drive
// off an edge where the woods begin (or from one patch of woods to the next) and you drive into the woods.
(() => {
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  const p = this.player, v = p && p.vehicle, m = this.map;
  if (!v || !m || this.transitioning || G.scenes.top() !== this || p.dead) return r;
  if ((this.arrivedT || 0) < 0.8) return r;   // just arrived: do not bounce straight back
  const sp = v.speed || 0; if (Math.abs(sp) < 4) return r;
  const dirA = v.angle + (sp < 0 ? Math.PI : 0), c = Math.cos(dirA), s = Math.sin(dirA);
  const nx = v.x + c * (v.L + 6), ny = v.y + s * (v.L + 6), tx = Math.floor(nx / 16), ty = Math.floor(ny / 16);
  // heading for the edge? (which one)
  const side = nx < 18 && c < -0.3 ? 'w' : nx > m.pw - 18 && c > 0.3 ? 'e' : ny < 18 && s < -0.3 ? 'n' : ny > m.ph - 18 && s > 0.3 ? 's' : null;
  if (!side) return r;
  for (const e of m.exits || []) {
    if (tx >= e.x - 3 && tx < e.x + e.w + 3 && ty >= e.y - 3 && ty < e.y + e.h + 3) { this.changeMap(e.to, e.spawn); return r; }
  }
  // no road out here: the woods (where there are woods)
  const W = G.wilds; if (!W) return r;
  const inWoods = typeof m.id === 'string' && (m.id === 'wilds' || m.id.startsWith('wilds_'));
  if (inWoods) W.cross(this, side);
  else if (G.WILDS_MAPS.includes(m.id) && !m.meta.floorOf && !m.meta.indoor && !this.world.jail && !W.nearExit(m, { x: nx, y: ny }, 3)) W.enter(this, side);
  return r;
};
// on arriving with the car: its nose points inward (it crossed, it does not sit across the line)
const _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  const r = _load.apply(this, arguments);
  const v = this.player && this.player.vehicle, m = this.map;
  if (v && m) {
    const margin = v.L + 10;
    v.x = G.util.clamp(v.x, margin, m.pw - margin); v.y = G.util.clamp(v.y, margin, m.ph - margin);
    this.player.x = v.x; this.player.y = v.y;
    if (v.blocked && v.blocked(m, v.x, v.y, v.angle)) { const t = m.randomWalkableNear(Math.floor(v.x / 16), Math.floor(v.y / 16), 4, G.rng, false); if (t) { v.x = t.x * 16 + 8; v.y = t.y * 16 + 8; this.player.x = v.x; this.player.y = v.y; } }
  }
  return r;
};
})();
