'use strict';
// Guns are deadly, and gunmen think about where they shoot from.
//   Damage: every gun hits about three times harder than before (a pistol round takes a third of a healthy
//   person's life, a rifle round can drop someone outright). It works both ways.
//   Shooters: an NPC checks its line of fire before pulling the trigger. If a wall, a car, a fence or a
//   building is in the way (or its last rounds smacked into one instead of you), it stops wasting bullets
//   and moves: it picks the nearest spot it can actually hit you from (a clear line, in range) and goes
//   there, then opens fire. If you move behind cover again, it repositions again.
(() => {
G.GUN_DAMAGE_MULT = 3;
for (const id in G.ITEMS) { const it = G.ITEMS[id]; if (it.gun && !it._dmgScaled) { it.dmg = Math.round(it.dmg * G.GUN_DAMAGE_MULT); it._dmgScaled = true; } }
const F = G.firearms, NP = G.NPC.prototype;
// Low furniture (counters, tables, beds, couches, fences...) stops people, not rounds: you shoot over it, and so
// does the clerk behind the counter. Walls, trees, cars and anything tall still stop a bullet.
const LOW = /counter|table|desk|bed|couch|sofa|bench|crib|display_case|serving|toolbench|fence|haybale|trough|cooler|washer|stool|chair/;
F.shotBlocked = function (map, tx, ty) {
  if (!map.isSolidTile(tx, ty)) return false;
  const i = ty * map.w + tx;
  if (G.TILES[map.ground[i]].solid || (map.chestAt && map.chestAt.has(i))) return true;
  const ds = map.decorsAt(tx, ty).filter((d) => d.def.solid);
  return !ds.length || !ds.every((d) => LOW.test(d.type || '') && (d.def.fh || 1) <= 1);
};
// is the straight line between two points free of anything solid? (samples every 4 px along it, leaving out the
// last few px at each end: the tiles the shooter and the target stand in, or lean against, never block)
const clearLine = (map, x0, y0, x1, y1) => {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 4);
  for (let i = 1; i < n; i++) {
    const k = i / n; if (k * d < 6 || (1 - k) * d < 6) continue;
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k + 2; if (F.shotBlocked(map, Math.floor(x / 16), Math.floor(y / 16))) return false;
  }
  return true;
};
F.clearLine = clearLine;
// the nearest place to stand with a clear shot at the target, within range
F.firingSpot = function (scene, npc, t, range) {
  const map = scene.map, tx = Math.floor(t.x / 16), ty = Math.floor((t.y - 3) / 16), nx = npc.x, ny = npc.y;
  let best = null, bs = 1e9;
  for (let r = 2; r <= 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = tx + dx, y = ty + dy; if (!map.inBounds(x, y) || map.isSolidTile(x, y)) continue;
    const px = x * 16 + 8, py = y * 16 + 12, dist = Math.hypot(px - t.x, py - t.y);
    if (dist > range * 0.8 || dist < 28) continue;
    if (!clearLine(map, px, py - 6, t.x, t.y - 6)) continue;
    const s = Math.hypot(px - nx, py - ny) + Math.abs(dist - range * 0.45) * 0.3;
    if (s < bs) { bs = s; best = { x, y }; }
  }
  return best;
};
// before firing: is there a clear shot? if not, go find one
const _fire = F.npcFire;
F.npcFire = function (npc, scene, target) {
  const w = npc.weaponItem;
  if (w && w.gun && target && !clearLine(scene.map, npc.x, npc.y - 6, target.x, target.y - 6)) {
    // right next to you with no shot: hit you with it instead
    if (npc.distTo(target) < 22) { npc.faceTowards(target); G.combat.attack(npc, scene); return; }
    npc.attackCd = 0.4;
    if (!npc.flank || npc.flank.forT !== target) {
      // a spot with a clear shot; failing that, go to where you are (the way around, not through the wall)
      const spot = F.firingSpot(scene, npc, target, w.range || 200) || { x: Math.floor(target.x / 16), y: Math.floor((target.y - 3) / 16) };
      npc.flank = { pt: spot, t: 0, forT: target };
    }
    return;
  }
  return _fire.apply(this, arguments);
};
// rounds that hit a wall instead: the shooter notices
const _upd = F.update;
F.update = function (scene, dt) {
  const owners = new Map();
  for (const b of scene.bullets) if (b.owner && b.owner.kind === 'npc') owners.set(b, b.left);
  const before = new Set(scene.bullets);
  _upd.call(this, scene, dt);
  for (const b of before) {
    if (!owners.has(b) || scene.bullets.includes(b)) continue;
    const o = b.owner, t = o.target;
    if (!t || t.dead) continue;
    if (Math.hypot(b.x - t.x, b.y - (t.y - 6)) > 14) {   // it stopped somewhere that is not you: a wall
      o.missWall = (o.missWall || 0) + 1;
      if (o.missWall >= 2 && !o.flank) { const w = o.weaponItem, spot = F.firingSpot(scene, o, t, (w && w.range) || 200); if (spot) o.flank = { pt: spot, t: 0, forT: t }; o.missWall = 0; }
    } else o.missWall = 0;
  }
};
// walking to the new firing spot (then the usual fight takes over)
const _nu = NP.update;
NP.update = function (dt, scene) {
  const f = this.flank;
  if (f && !this.dead && this.state === 'fight' && this.target && !this.target.dead) {
    f.t += dt;
    const px = f.pt.x * 16 + 8, py = f.pt.y * 16 + 12, there = Math.hypot(this.x - px, this.y - py) < 10;
    const clear = clearLine(scene.map, this.x, this.y - 6, this.target.x, this.target.y - 6);
    if (there || clear || f.t > 7) { this.flank = null; return _nu.call(this, dt, scene); }
    this.baseUpdate(dt, scene.map);
    this.walkTo(f.pt, dt, scene, true);
    this.faceTowards(this.target);
    if (this.attackCd > 0) this.attackCd -= dt;
    return;
  }
  if (f && (this.state !== 'fight' || !this.target || this.target.dead)) this.flank = null;
  return _nu.call(this, dt, scene);
};
})();
