'use strict';
// Houses you build. Put up walls all the way round (with at least one door in them), then place a ROOF
// piece anywhere inside: it covers the whole enclosure and it becomes a real house, like every other one.
// The roof hides the inside from the street and fades away when you walk in; the door swings open as
// people come and go; inside it is lit at night; it is yours (no trespassing, your key). Roof styles:
// asphalt shingles, red tiles, slate, green and brown tin, blue, white, a flat gravel roof, and thatch.
// Taking out a wall or the door of a finished house brings its roof down (you get the roof piece back);
// [X] or right click on a bare floor tile inside takes the roof off too.
(() => {
const A = G.assets, T = G.T, H = G.home;
const ROOFS = [['shingle', 'Shingle Roof'], ['red', 'Red Tile Roof'], ['slate', 'Slate Roof'], ['green', 'Green Tin Roof'], ['brown', 'Brown Roof'], ['blue', 'Blue Roof'], ['white', 'White Roof'], ['flat', 'Flat Gravel Roof'], ['thatch', 'Thatched Roof']];
for (const [key, name] of ROOFS) {
  if (!G.ROOF_COLORS[key]) continue;
  const id = 'kit_roof_' + key;
  G.ITEMS[id] = { id, name, type: 'build', piece: true, place: { roof: key }, icon: 'pc_' + id, value: 60, stack: 50, desc: 'A roof. Place it inside a closed ring of walls (with a door) to make it a house.' };
  G.BUILD_PIECES[id] = { place: { roof: key }, recipe: key === 'thatch' ? [['wheat', 12], ['rope', 2], ['planks', 4]] : key.startsWith('flat') ? [['cement', 4], ['planks', 6], ['stone', 6]] : [['planks', 8], ['nails', 4], ['metal_sheet', 2]] };
  if (G.CRAFT_RECIPES) G.CRAFT_RECIPES.push({ out: [id, 1], in: G.BUILD_PIECES[id].recipe });
  if (G.SHOPS.i_supply) G.SHOPS.i_supply.stock.push([id, 3]);
}
const _init = A.init;
A.init = function () {
  _init.call(this);
  for (const [key] of ROOFS) {
    const cols = G.ROOF_COLORS[key]; if (!cols) continue;
    const { c, x } = A.mk(16, 16);
    x.fillStyle = cols[1]; x.beginPath(); x.moveTo(1, 9); x.lineTo(8, 2); x.lineTo(15, 9); x.lineTo(15, 13); x.lineTo(1, 13); x.closePath(); x.fill();
    for (let y = 5; y < 13; y += 2) { x.fillStyle = cols[2]; x.fillRect(2, y + 1, 12, 1); }
    x.fillStyle = cols[0]; x.fillRect(7, 2, 2, 2); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, 12, 14, 1);
    A.outline(c); A.icons['pc_kit_roof_' + key] = c;
  }
};
const recs = (w, mapId) => ((w.playerHouses = w.playerHouses || {})[mapId] = (w.playerHouses || {})[mapId] || []);
const isWall = (map, x, y) => { const d = map.tileDef(x, y); return !!(d && d.wall); };
// the ring of walls around (tx, ty): the room's tiles, its box, and its door; or why not
H.enclosure = (scene, tx, ty) => {
  const map = scene.map, seen = new Set(), q = [[tx, ty]], room = [];
  if (isWall(map, tx, ty) || map.get(tx, ty) === T.door) return { why: 'Place the roof inside the walls.' };
  while (q.length) {
    const [x, y] = q.pop(), k = x + ',' + y;
    if (seen.has(k)) continue; seen.add(k);
    if (!map.inBounds(x, y) || x <= 0 || y <= 0 || x >= map.w - 1 || y >= map.h - 1) return { why: 'The walls do not close all the way round.' };
    if (isWall(map, x, y) || map.get(x, y) === T.door) continue;
    if (map.tileDef(x, y).water) return { why: 'The walls do not close all the way round.' };
    const b = map.buildingAtTile(x, y);
    if (b && !b.playerBuilt) return { why: 'That is part of somebody else\'s building.' };
    if (b && b.playerBuilt) return { why: 'There is already a roof on this.' };
    room.push([x, y]);
    if (room.length > 500 || Math.abs(x - tx) > 26 || Math.abs(y - ty) > 26) return { why: 'Too big to roof (or the walls are not closed).' };
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const xs = room.map((r) => r[0]), ys = room.map((r) => r[1]);
  const x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(...ys) + 1;
  // a door somewhere in the walls: the bottom wall first (that is the front)
  let door = null;
  for (let x = x0; x <= x1 && !door; x++) if (map.get(x, y1) === T.door) door = { x, y: y1 };
  for (let y = y0; y <= y1 && !door; y++) for (const x of [x0, x1]) if (!door && map.get(x, y) === T.door) door = { x, y };
  for (let x = x0; x <= x1 && !door; x++) if (map.get(x, y0) === T.door) door = { x, y: y0 };
  if (!door) return { why: 'A house needs a door in its walls.' };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, door, room };
};
// a house record becomes a building on the map
H.raise = (map, rec) => {
  if (map.building(rec.id)) return map.building(rec.id);
  const b = { id: rec.id, name: rec.name || 'Your House', x: rec.x, y: rec.y, w: rec.w, h: rec.h, doorX: rec.doorX, doorY: rec.doorY, roof: rec.roof, chimney: rec.w >= 5 && rec.roof !== 'thatch' && !rec.roof.startsWith('flat'), roofAlpha: 1, lit: false, windows: [], kind: 'house', playerBuilt: true };
  map.buildings.push(b);
  b.roofCanvas = map.renderRoof(b);
  map.points[b.id + '_door'] = { x: b.doorX, y: Math.min(map.h - 1, b.doorY + 1) };
  map.points[b.id + '_in'] = { x: b.doorX, y: Math.max(0, b.doorY - 1) };
  map.points[b.id + '_center'] = { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor((b.h - 1) / 2) };
  map.renderMinimap && map.renderMinimap();
  return b;
};
H.lower = (scene, b) => {
  const map = scene.map, w = scene.world, list = recs(w, map.id), rec = list.find((r) => r.id === b.id);
  map.buildings = map.buildings.filter((x) => x !== b);
  if (rec) { list.splice(list.indexOf(rec), 1); H.give(scene.player, 'kit_roof_' + rec.roof, 1); }
  map.renderMinimap && map.renderMinimap();
  scene.toast('The roof comes down. (Roof piece back in your construction inventory.)', 'info');
};
const _why = H.why, _place = H.place, _remove = H.remove;
H.why = function (scene, id, tx, ty) {
  const pc = G.BUILD_PIECES[id];
  if (pc && pc.place.roof) { const e = H.enclosure(scene, tx, ty); return e.why || ''; }
  // building inside your own house is fine
  const b = scene.map.buildingAtTile(tx, ty);
  if (b && b.playerBuilt) { const k = H.built(scene.world, scene.map.id); const had = k[tx + ',' + ty]; k[tx + ',' + ty] = k[tx + ',' + ty] || { tmp: true }; try { return _why.apply(this, arguments); } finally { if (!had) delete k[tx + ',' + ty]; } }
  return _why.apply(this, arguments);
};
H.place = function (scene, id, tx, ty) {
  const pc = G.BUILD_PIECES[id];
  if (!pc || !pc.place.roof) return _place.apply(this, arguments);
  const e = H.enclosure(scene, tx, ty); if (e.why) return e.why;
  const p = scene.player; if (!p.inventory.has('hammer') && p.equip.weapon !== 'hammer') return 'You need a hammer to build.';
  H.take(p, id, 1);
  const w = scene.world, rec = { id: G.util.uid('ph'), name: 'Your House', x: e.x, y: e.y, w: e.w, h: e.h, doorX: e.door.x, doorY: e.door.y, roof: pc.place.roof };
  recs(w, scene.map.id).push(rec);
  (w.keys = w.keys || {})[rec.id] = true;   // your house, your key
  H.raise(scene.map, rec);
  G.audio.play('craft'); G.events.emit('xp', 10, 'Building');
  scene.toast('The roof is on. It is a house now.', 'good');
  return '';
};
H.remove = function (scene, tx, ty) {
  const map = scene.map, house = map.buildings.find((b) => b.playerBuilt && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
  const key = tx + ',' + ty, built = H.built(scene.world, map.id)[key];
  if (house) {
    const border = tx === house.x || ty === house.y || tx === house.x + house.w - 1 || ty === house.y + house.h - 1;
    if (border && built && built.tile) { H.lower(scene, house); return _remove.apply(this, arguments); }
    if (!border && !(built && built.decor)) { H.lower(scene, house); return ''; }   // a bare floor inside: the roof
  }
  return _remove.apply(this, arguments);
};
// your houses come back when the map loads
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  const r = _load.apply(this, arguments);
  const w = this.world;
  if (w && this.map) for (const rec of recs(w, this.map.id)) H.raise(this.map, rec);
  return r;
};
// nobody trespasses on you in your own house, and it never locks you out
const D = G.doors;
if (D) {
  const _allowed = D.allowed; D.allowed = function (scene, b) { if (b && b.playerBuilt) return true; return _allowed.apply(this, arguments); };
  const _locked = D.locked; D.locked = function (scene, b) { if (b && b.playerBuilt) return false; return _locked.apply(this, arguments); };
}
})();
