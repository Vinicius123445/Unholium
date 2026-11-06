'use strict';
// Nothing materializes in front of you. People and vehicles may walk or drive into view; they may not appear in it.
//   G.spawnRule.visible: is this spot on screen, or close to you? (a margin past the screen edge, and through windows too:
//   only a building's own walls between you and it count as cover.)
//   G.spawnRule.away: the nearest place out of sight to come from: a door or the road when there is one.
//   A last check every frame: anyone generated this frame in view is moved out of sight and walks to where they were
//   meant to be. Getting out of a vehicle, coming out of a doorway and arriving from another map stay as they are.
(() => {
const GS = G.GameScene.prototype;
const R = G.spawnRule = {
  MARGIN: 40, NEAR: 200,
  visible(scene, x, y) {
    const c = G.renderer.cam, Rr = G.renderer, p = scene.player, m = this.MARGIN;
    if (p && Math.hypot(p.x - x, p.y - y) < this.NEAR * 0.6) return true;
    return x > c.x - m && x < c.x + Rr.viewW + m && y > c.y - m && y < c.y + Rr.viewH + m;
  },
  // a door or a road tile out of sight, closest to (x, y) first; open ground if there is neither
  away(scene, x, y) {
    const map = scene.map, tx0 = Math.floor(x / 16), ty0 = Math.floor(y / 16), road = [G.T.asphalt, G.T.road_line, G.T.road_line_v];
    let open = null;
    for (const b of map.buildings || []) { const px = b.doorX * 16 + 8, py = (b.doorY + 1) * 16 + 12; if (!b.destroyed && !b.floorOf && !this.visible(scene, px, py) && Math.hypot(px - x, py - y) < 420) return { x: px, y: py, door: true }; }
    for (let r = 4; r < 90; r += 2) for (let a = 0; a < 16; a++) {
      const tx = Math.round(tx0 + Math.cos(a / 16 * 6.283) * r), ty = Math.round(ty0 + Math.sin(a / 16 * 6.283) * r);
      if (!map.inBounds(tx, ty) || map.isSolidTile(tx, ty) || map.isSwimmable(tx, ty)) continue;
      const px = tx * 16 + 8, py = ty * 16 + 12;
      if (this.visible(scene, px, py)) continue;
      if (road.includes(map.get(tx, ty))) return { x: px, y: py, road: true };
      if (!open) open = { x: px, y: py };
    }
    return open;
  },
  legit(scene, a) {
    if (a._talkLines || a.st && a.st.companion || a.st && a.st.ko || a.dead || a.downT > 0 || a.emsDriver) return true;
    if ((scene.vehicles || []).some((v) => Math.hypot(v.x - a.x, v.y - a.y) < 46)) return true;                 // got out of one
    return (scene.map.buildings || []).some((b) => Math.hypot(b.doorX * 16 + 8 - a.x, (b.doorY + 1) * 16 + 12 - a.y) < 26);   // came out of a door
  },
};
// road cars start out of sight: further down the road, if the place picked is in view
const L = G.law, _road = L.roadNear;
L.roadNear = function (map, x, y) {
  const at = _road.call(this, map, x, y), scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!at || !scene || scene.map !== map || !R.visible(scene, at.from.x, at.from.y)) return at;
  const dx = Math.sign(at.from.x - at.park.x), dy = Math.sign(at.from.y - at.park.y), road = [G.T.asphalt, G.T.road_line, G.T.road_line_v];
  for (const k of [1, -1]) {
    let tx = Math.floor(at.park.x / 16), ty = Math.floor(at.park.y / 16);
    for (let i = 0; i < 90; i++) {
      tx += (dx || (dy ? 0 : 1)) * k; ty += dy * k;
      if (!map.inBounds(tx, ty) || !road.includes(map.get(tx, ty))) break;
      if (!R.visible(scene, tx * 16 + 8, ty * 16 + 8)) { at.from = { x: tx * 16 + 8, y: ty * 16 + 8 }; return at; }
    }
  }
  return at;
};
// the check
const _u = GS.update, seen = new WeakSet();
GS.update = function (dt) {
  const r = _u.call(this, dt);
  if (!this.actors) return r;
  if (!this._spawnReady) { for (const a of this.actors) seen.add(a); if ((this._spawnWarm = (this._spawnWarm || 0) + dt) > 1) this._spawnReady = this.map.id; return r; }
  if (this._spawnReady !== this.map.id) { this._spawnReady = null; this._spawnWarm = 0; return r; }   // (a new map: everyone was already there)
  for (const a of this.actors) {
    if (seen.has(a)) continue;
    seen.add(a);
    if (a.kind !== 'npc' || !a.transient || G.spawnRule.off || !R.visible(this, a.x, a.y) || R.legit(this, a)) continue;
    const to = { x: a.x, y: a.y }, at = R.away(this, a.x, a.y);
    if (!at) continue;
    a.x = at.x; a.y = at.y; a.path = null;
    if (L.sendTo) L.sendTo(a, to.x, to.y);
  }
  return r;
};
})();
