'use strict';
// Building, crafting and cooking.
//   Construction inventory: building materials (planks, nails, bricks, cement, metal sheets, glass, rope,
//   cloth, stones) and building pieces (walls, floors, doors, fences, furniture, a workbench, a campfire)
//   do not take pockets: they go to your construction inventory (w.buildInv), shown in construction mode.
//   Construction mode [B]: walk around with a hammer in your pocket and place what you have, anywhere you
//   are allowed (not on roads, not inside other people's buildings). Pick with the mouse wheel or [Z]/[C],
//   place with left click or [F], take back something you built with right click or [X]. The tile under
//   the cursor is the target while the mouse is in use, otherwise the tile in front of you. Walls, floors,
//   doors and fences change the ground itself; furniture is a real object (beds you can sleep in, crates,
//   fridges, stoves, a workbench, a campfire...). Everything stays (saved with the map).
//   Workbench: [E] opens crafting. Only at a workbench: pieces from materials, planks from wood, tools
//   (hammer, saw, hoe, watering can), lockpicks, bandages, weapons and more. Workbenches are sold at the
//   Builders' Supply, crafted at another workbench, and placed like any other piece.
//   Cooking: [E] at a campfire or a stove opens the cooking menu: grill meat and fish, fry eggs, bake
//   potatoes, roast corn, make stews, mill flour and bake bread (bread needs a stove).
//   Builders' Supply (Port District): buy in person, or once you have the owner's number, call and order a
//   delivery (it arrives in about an hour, straight to your construction inventory).
(() => {
const A = G.assets, T = G.T;
// ---------------------------------------------------------------- items
const def = (id, o) => { G.ITEMS[id] = Object.assign({ id, value: 1 }, o); if (G.ITEMS[id].stack == null) G.ITEMS[id].stack = o.type === 'weapon' ? 1 : 50; };
const MAT = [
  ['planks', 'Wood Planks', 3, 'Cut lumber, for building and crafting.'], ['nails', 'Box of Nails', 2, 'A few dozen nails.'],
  ['bricks', 'Bricks', 3, 'A stack of red bricks.'], ['cement', 'Bag of Cement', 6, 'Mix with water. Becomes walls.'],
  ['metal_sheet', 'Metal Sheet', 6, 'Galvanized steel.'], ['glass_pane', 'Glass Pane', 5, 'Careful.'],
  ['rope', 'Rope', 3, 'Ten feet of sturdy rope.'], ['cloth', 'Cloth', 2, 'A roll of fabric.'], ['stone', 'Stones', 1, 'Fieldstones.'],
];
for (const [id, name, value, desc] of MAT) def(id, { name, type: 'build', mat: true, icon: id, value, desc });
def('hammer', { name: 'Hammer', type: 'weapon', cat: 'blunt', icon: 'hammer', dmg: 6, cd: 0.38, value: 12, tool: true, desc: 'Builds things ([B] construction mode). Breaks things too.' });
def('saw', { name: 'Hand Saw', type: 'material', icon: 'saw', value: 10, tool: true, desc: 'Cuts wood into planks twice as well at the workbench.' });
def('hoe', { name: 'Hoe', type: 'material', icon: 'hoe', value: 14, tool: true, desc: 'Turns grass or dirt into a field: face the ground and use it.' });
def('watering_can', { name: 'Watering Can', type: 'material', icon: 'watering_can', value: 12, tool: true, desc: 'Water your crops: watered plants grow faster.' });
// building pieces: what they put down. tile: the ground becomes this; decor: an object
const PIECES = [
  ['kit_wall_wood', 'Wooden Wall', { tile: 'wall_wood' }, 14, [['planks', 4], ['nails', 2]]],
  ['kit_wall_brick', 'Brick Wall', { tile: 'wall_brick' }, 26, [['bricks', 6], ['cement', 1]]],
  ['kit_wall_concrete', 'Concrete Wall', { tile: 'wall_concrete' }, 24, [['cement', 3], ['stone', 2]]],
  ['kit_wall_plaster', 'Plaster Wall', { tile: 'wall_plaster' }, 20, [['planks', 2], ['cement', 2]]],
  ['kit_door', 'Door', { tile: 'door' }, 18, [['planks', 3], ['nails', 2], ['metal_sheet', 1]]],
  ['kit_floor_wood', 'Wood Floor', { tile: 'woodfloor' }, 8, [['planks', 2], ['nails', 1]]],
  ['kit_floor_tile', 'Tile Floor', { tile: 'tilefloor' }, 9, [['cement', 1], ['stone', 2]]],
  ['kit_floor_carpet', 'Carpet', { tile: 'carpet' }, 10, [['cloth', 3]]],
  ['kit_floor_stone', 'Stone Floor', { tile: 'stonefloor' }, 7, [['stone', 4]]],
  ['kit_fence', 'Wooden Fence', { tile: 'fence' }, 6, [['planks', 2], ['nails', 1]]],
  ['kit_chainlink', 'Chain-Link Fence', { tile: 'chainlink' }, 9, [['metal_sheet', 1], ['rope', 1]]],
  ['kit_hedge', 'Hedge', { tile: 'hedge' }, 8, [['herb', 2], ['stone', 1]]],
  ['kit_workbench', 'Workbench', { decor: 'toolbench' }, 60, [['planks', 6], ['nails', 4], ['metal_sheet', 1]]],
  ['kit_campfire', 'Campfire', { decor: 'campfire' }, 8, [['wood', 3], ['stone', 4]]],
  ['kit_bed', 'Bed', { decor: 'bed' }, 45, [['planks', 4], ['nails', 2], ['cloth', 3]]],
  ['kit_bed_double', 'Double Bed', { decor: 'bed_double' }, 80, [['planks', 6], ['nails', 3], ['cloth', 5]]],
  ['kit_table', 'Table', { decor: 'table' }, 30, [['planks', 3], ['nails', 2]]],
  ['kit_chair', 'Chair', { decor: 'chair' }, 12, [['planks', 2], ['nails', 1]]],
  ['kit_couch', 'Couch', { decor: 'couch' }, 55, [['planks', 3], ['nails', 2], ['cloth', 4]]],
  ['kit_desk', 'Desk', { decor: 'desk' }, 35, [['planks', 4], ['nails', 2]]],
  ['kit_shelf', 'Shelf', { decor: 'shelf' }, 20, [['planks', 3], ['nails', 2]]],
  ['kit_wardrobe', 'Wardrobe', { decor: 'wardrobe' }, 40, [['planks', 5], ['nails', 3]]],
  ['kit_nightstand', 'Nightstand', { decor: 'nightstand' }, 15, [['planks', 2], ['nails', 1]]],
  ['kit_crate', 'Storage Crate', { decor: 'crate' }, 10, [['planks', 2], ['nails', 1]]],
  ['kit_barrel', 'Barrel', { decor: 'barrel' }, 12, [['planks', 3], ['metal_sheet', 1]]],
  ['kit_bench', 'Bench', { decor: 'bench' }, 18, [['planks', 3], ['nails', 2]]],
  ['kit_floorlamp', 'Floor Lamp', { decor: 'floorlamp' }, 25, [['metal_sheet', 1], ['glass_pane', 1]]],
  ['kit_lamp', 'Street Lamp', { decor: 'lamp' }, 40, [['metal_sheet', 2], ['glass_pane', 1]]],
  ['kit_stove', 'Stove', { decor: 'stove' }, 90, [['metal_sheet', 4], ['glass_pane', 1]]],
  ['kit_fridge', 'Fridge', { decor: 'fridge' }, 120, [['metal_sheet', 4], ['glass_pane', 1]]],
  ['kit_counter', 'Kitchen Counter', { decor: 'kcounter' }, 35, [['planks', 3], ['stone', 2]]],
  ['kit_sink', 'Sink', { decor: 'sink' }, 40, [['metal_sheet', 2], ['cement', 1]]],
  ['kit_toilet', 'Toilet', { decor: 'toilet' }, 45, [['cement', 2], ['metal_sheet', 1]]],
  ['kit_shower', 'Shower', { decor: 'shower' }, 70, [['metal_sheet', 2], ['glass_pane', 2]]],
  ['kit_tv', 'TV', { decor: 'tv' }, 150, null],
  ['kit_plant', 'Potted Plant', { decor: 'plant' }, 12, [['stone', 1], ['herb', 1]]],
  ['kit_trough', 'Water Trough', { decor: 'trough' }, 25, [['planks', 3], ['metal_sheet', 1]]],
  ['kit_haybale', 'Hay Bale', { decor: 'haybale' }, 6, [['wheat', 4], ['rope', 1]]],
];
G.BUILD_PIECES = {};
for (const [id, name, place, value, recipe] of PIECES) {
  if (place.decor && !G.DECOR[place.decor]) continue;
  def(id, { name, type: 'build', piece: true, place, icon: 'kit_' + (place.tile ? 'tile' : 'decor'), value, desc: place.tile ? `A building piece: ${name.toLowerCase()}. Place it in construction mode [B].` : `Furniture: a ${name.toLowerCase()}. Place it in construction mode [B].` });
  G.BUILD_PIECES[id] = { place, recipe };
}
// farm produce and cooking (see js/game/farming.js for the crops themselves)
const FOOD = [
  ['tomato', 'Tomato', 3, 18, 8], ['potato', 'Potato', 2, 14, 0], ['carrot', 'Carrot', 2, 16, 4], ['corn', 'Ear of Corn', 3, 18, 0], ['cabbage_head', 'Cabbage', 3, 18, 6],
  ['fried_egg', 'Fried Egg', 4, 24, 0], ['baked_potato', 'Baked Potato', 6, 40, 0], ['roasted_corn', 'Roasted Corn', 6, 38, 0], ['veggie_stew', 'Vegetable Stew', 12, 60, 25],
  ['meat_stew', 'Meat Stew', 16, 75, 25], ['salad', 'Garden Salad', 9, 35, 15], ['fried_mushrooms', 'Fried Mushrooms', 6, 30, 0], ['challah', 'Challah Bread', 6, 40, 0], ['matzah', 'Matzah', 3, 25, 0],
];
for (const [id, name, value, food, drink] of FOOD) def(id, { name, type: 'consumable', icon: id, value, food, drink: drink || undefined, stack: 20, desc: 'Food.' });
def('flour', { name: 'Flour', type: 'material', icon: 'flour', value: 3, desc: 'Milled wheat. Bake it into bread at a stove.' });

// ---------------------------------------------------------------- icons
const P = (x, px, py, c) => { x.fillStyle = c; x.fillRect(px, py, 1, 1); };
const R = (x, px, py, w, h, c) => { x.fillStyle = c; x.fillRect(px, py, w, h); };
const O = (x, cx, cy, rx, ry, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
const ICONS = {
  planks: (x) => { for (let i = 0; i < 3; i++) { R(x, 1, 3 + i * 4, 14, 3, ['#c89a5a', '#b8874a', '#d8aa6a'][i]); R(x, 1, 5 + i * 4, 14, 1, '#7a5228'); P(x, 4 + i * 3, 4 + i * 4, '#8a6230'); } },
  nails: (x) => { R(x, 2, 6, 12, 8, '#c84a3a'); R(x, 2, 6, 12, 2, '#e86a5a'); for (let i = 0; i < 4; i++) { R(x, 4 + i * 2, 2, 1, 5, '#b8bcc4'); P(x, 4 + i * 2, 2, '#e8ecf4'); } },
  bricks: (x) => { for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { R(x, 1 + c * 7 + (r % 2 ? 3 : 0) - (r % 2 && c ? 7 : 0), 3 + r * 4, 6, 3, '#a8462f'); R(x, 1 + c * 7 + (r % 2 ? 3 : 0) - (r % 2 && c ? 7 : 0), 3 + r * 4, 6, 1, '#c8664a'); } },
  cement: (x) => { R(x, 3, 3, 10, 12, '#c8c0a8'); R(x, 3, 3, 10, 2, '#a8a088'); R(x, 4, 7, 8, 3, '#5a6a8a'); R(x, 5, 8, 6, 1, '#d8d8e0'); },
  metal_sheet: (x) => { R(x, 2, 3, 12, 10, '#9aa0aa'); for (let i = 3; i < 14; i += 3) R(x, i, 3, 1, 10, '#c8ccd4'); R(x, 2, 12, 12, 1, '#6a707a'); },
  glass_pane: (x) => { R(x, 3, 2, 10, 12, '#8ac8e8'); R(x, 3, 2, 10, 1, '#d8f0ff'); R(x, 5, 4, 1, 5, '#e8f8ff'); R(x, 7, 4, 1, 2, '#e8f8ff'); },
  rope: (x) => { O(x, 8, 9, 6, 5, '#b8945a'); O(x, 8, 9, 3, 2, 'rgba(0,0,0,0)'); x.clearRect(6, 8, 4, 2); for (let i = 0; i < 5; i++) P(x, 3 + i * 2, 6 + (i % 2), '#8a6a3a'); },
  cloth: (x) => { R(x, 2, 5, 12, 8, '#8a4ab8'); R(x, 2, 5, 12, 2, '#aa6ad8'); O(x, 3, 9, 2, 4, '#6a2a98'); },
  stone: (x) => { O(x, 6, 10, 4, 3, '#8a8680'); O(x, 11, 9, 3, 3, '#7a7670'); O(x, 8, 6, 3, 2, '#9a968e'); P(x, 5, 9, '#b8b4ac'); },
  hammer: (x) => { R(x, 7, 6, 2, 9, '#8a5a2a'); R(x, 3, 2, 10, 4, '#7a7e86'); R(x, 3, 2, 10, 1, '#b8bcc4'); R(x, 11, 3, 3, 2, '#5a5e66'); },
  saw: (x) => { R(x, 2, 8, 11, 4, '#c8ccd4'); for (let i = 2; i < 13; i += 2) P(x, i, 12, '#7a7e86'); R(x, 12, 6, 3, 7, '#8a3a2a'); },
  hoe: (x) => { for (let i = 0; i < 11; i++) P(x, 3 + i, 14 - i, '#8a5a2a'); R(x, 11, 2, 4, 2, '#7a7e86'); R(x, 13, 2, 2, 4, '#7a7e86'); },
  watering_can: (x) => { R(x, 3, 6, 8, 7, '#4a8a5a'); R(x, 3, 6, 8, 2, '#6aaa7a'); for (let i = 0; i < 4; i++) P(x, 11 + i, 8 - i, '#4a8a5a'); R(x, 13, 3, 2, 2, '#4a8a5a'); R(x, 5, 3, 4, 1, '#3a6a4a'); },
  kit_tile: (x) => { R(x, 2, 3, 12, 11, '#b8874a'); R(x, 2, 3, 12, 2, '#d8aa6a'); R(x, 2, 8, 12, 1, '#7a5228'); R(x, 7, 3, 1, 11, '#7a5228'); },
  kit_decor: (x) => { R(x, 2, 4, 12, 10, '#c8a070'); R(x, 2, 4, 12, 2, '#e0c090'); R(x, 7, 4, 2, 10, '#8a6a40'); R(x, 4, 8, 8, 1, '#5a4228'); },
  tomato: (x) => { O(x, 8, 9, 5, 5, '#d83a2a'); P(x, 6, 7, '#ff8a7a'); R(x, 7, 3, 2, 2, '#3a8a3a'); R(x, 5, 4, 6, 1, '#3a8a3a'); },
  potato: (x) => { O(x, 8, 9, 6, 4, '#b8925a'); P(x, 5, 8, '#7a5a30'); P(x, 10, 10, '#7a5a30'); P(x, 8, 7, '#d8b27a'); },
  carrot: (x) => { for (let i = 0; i < 9; i++) R(x, 4 + i, 5 + i, Math.max(1, 3 - (i >> 2)), 2, '#e87a2a'); R(x, 2, 2, 3, 3, '#4a9a3a'); R(x, 4, 1, 2, 3, '#3a8a2a'); },
  corn: (x) => { O(x, 8, 8, 3, 6, '#e8c840'); for (let i = 4; i < 13; i += 2) P(x, 7, i, '#c8a020'); R(x, 4, 8, 2, 6, '#6aaa3a'); R(x, 11, 9, 2, 5, '#5a9a2a'); },
  cabbage_head: (x) => { O(x, 8, 9, 6, 5, '#6ab04a'); O(x, 8, 8, 4, 3, '#8ad06a'); R(x, 8, 5, 1, 7, '#4a8a3a'); },
  fried_egg: (x) => { O(x, 8, 9, 6, 4, '#f8f4ec'); O(x, 8, 9, 2.5, 2, '#f0b020'); P(x, 7, 8, '#ffe080'); },
  baked_potato: (x) => { O(x, 8, 9, 6, 4, '#9a6a3a'); R(x, 5, 8, 6, 2, '#f8e8b0'); R(x, 7, 7, 2, 1, '#ffe080'); },
  roasted_corn: (x) => { O(x, 8, 8, 3, 6, '#d8a830'); for (let i = 4; i < 13; i += 2) P(x, 8, i, '#8a5a1a'); },
  veggie_stew: (x) => { O(x, 8, 10, 6, 3, '#6a4a3a'); O(x, 8, 9, 5, 2, '#c87a3a'); P(x, 6, 9, '#e8a040'); P(x, 10, 9, '#6aa040'); },
  meat_stew: (x) => { O(x, 8, 10, 6, 3, '#6a4a3a'); O(x, 8, 9, 5, 2, '#8a3a2a'); P(x, 6, 9, '#c8705a'); P(x, 9, 9, '#e8a040'); },
  salad: (x) => { O(x, 8, 10, 6, 3, '#e8e4dc'); O(x, 8, 9, 5, 2, '#6ab04a'); P(x, 6, 8, '#d83a2a'); P(x, 10, 9, '#e87a2a'); },
  fried_mushrooms: (x) => { O(x, 8, 10, 6, 3, '#3a3a40'); O(x, 6, 9, 2, 1.5, '#a8784a'); O(x, 10, 9, 2, 1.5, '#a8784a'); O(x, 8, 8, 2, 1.5, '#8a5a3a'); },
  challah: (x) => { for (let i = 0; i < 4; i++) O(x, 4 + i * 2.7, 9 + (i % 2), 2.5, 3, i % 2 ? '#c88a3a' : '#d89a4a'); P(x, 6, 7, '#f0c070'); },
  matzah: (x) => { R(x, 2, 4, 12, 9, '#e8d8a8'); for (let i = 3; i < 14; i += 2) for (let j = 5; j < 12; j += 2) P(x, i, j, '#b89858'); },
  flour: (x) => { R(x, 4, 3, 8, 11, '#f0ece0'); R(x, 4, 3, 8, 2, '#d8d0c0'); R(x, 6, 7, 4, 3, '#c8a040'); },
};
const _init = A.init;
A.init = function () {
  _init.call(this);
  for (const k in ICONS) { const { c, x } = A.mk(16, 16); ICONS[k](x); A.outline(c); A.icons[k] = c; }
  // each building piece's icon is the thing itself: the furniture's sprite, or the wall/floor texture
  for (const id in G.BUILD_PIECES) {
    const pl = G.BUILD_PIECES[id].place, { c, x } = A.mk(16, 16);
    const d = pl.decor && G.DECOR[pl.decor], s = d && A.sprites[d.sprite];
    if (s) { const k = Math.min(1, 15 / Math.max(s.w, s.h)); x.imageSmoothingEnabled = k < 1; x.drawImage(s.img, (16 - s.w * k) / 2, (16 - s.h * k) / 2, s.w * k, s.h * k); }
    else if (pl.tile) { const t = G.TILES[T[pl.tile]], img = t && t.tex && A.tile(t.tex, 0); if (img) { x.drawImage(img, 1, 1, 14, 14); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeRect(1.5, 1.5, 13, 13); } }
    else continue;
    A.icons['pc_' + id] = c; G.ITEMS[id].icon = 'pc_' + id;
  }
};

// ---------------------------------------------------------------- construction inventory
const H = G.home = {
  inv(w) { return (w.buildInv = w.buildInv || {}); },
  isBuild(id) { const it = G.ITEMS[id]; return !!(it && it.type === 'build'); },
  count(p, id) { const w = G.world; return (p.inventory.count(id) || 0) + ((w && this.inv(w)[id]) || 0); },
  has(p, id, n = 1) { return this.count(p, id) >= n; },
  take(p, id, n = 1) {
    const w = G.world, b = this.inv(w), k = Math.min(n, b[id] || 0);
    if (k) { b[id] -= k; if (!b[id]) delete b[id]; n -= k; }
    if (n > 0) p.inventory.remove(id, n);
  },
  give(p, id, n = 1) { if (this.isBuild(id)) { const b = this.inv(G.world); b[id] = (b[id] || 0) + n; return 0; } return p.inventory.add(id, n); },
  list(w) { return Object.keys(this.inv(w)).filter((id) => this.inv(w)[id] > 0 && G.ITEMS[id]); },
  pieces(w) { return this.list(w).filter((id) => G.ITEMS[id].piece); },
};
// building things never take pocket space: they go straight to the construction inventory
const IP = G.Inventory ? G.Inventory.prototype : null;
const patchInv = (P0) => {
  const _add = P0.add, _fit = P0.canFit;
  P0.add = function (id, qty = 1) { if (this === (G.player && G.player.inventory) || this.isPlayer) { if (H.isBuild(id) && G.world) { H.give(null, id, qty); return 0; } } return _add.call(this, id, qty); };
  P0.canFit = function (id, qty = 1) { if ((this === (G.player && G.player.inventory) || this.isPlayer) && H.isBuild(id)) return true; return _fit.call(this, id, qty); };
};
if (IP) patchInv(IP);
const PL = G.Player.prototype, _pu = PL.update;
PL.update = function (dt, scene) {
  if (!this.inventory.isPlayer) this.inventory.isPlayer = true;
  // anything building-related already in your pockets (old saves, loot) moves to the construction inventory
  if ((this._bi = (this._bi || 0) - dt) <= 0) {
    this._bi = 2;
    for (const s of this.inventory.slots) if (s && H.isBuild(s.id)) { const n = s.qty || s.count || 1; this.inventory.remove(s.id, n); H.give(this, s.id, n); }
  }
  return _pu.call(this, dt, scene);
};

// ---------------------------------------------------------------- a scrollable list menu (crafting, cooking, orders)
class ListScene {
  constructor(title, rowsFn, o = {}) { this.transparent = true; this.title = title; this.rowsFn = rowsFn; this.sel = 0; this.scroll = 0; this.o = o; this.msg = ''; this.msgT = 0; }
  rows() { return this.rowsFn(this); }
  update(dt) {
    const I = G.input, rows = this.rows();
    if (this.msgT > 0) this.msgT -= dt;
    if (I.wasPressed('cancel') || I.wasPressed('interact') && this.o.closeOnE) { G.audio.play('back'); G.scenes.remove(this); return; }
    if (I.wasPressed('up')) this.sel = Math.max(0, this.sel - 1);
    if (I.wasPressed('down')) this.sel = Math.min(rows.length - 1, this.sel + 1);
    if (I.mouse.wheel) this.scroll = G.util.clamp(this.scroll + Math.sign(I.mouse.wheel), 0, Math.max(0, rows.length - this.vis));
    if ((I.pressed.has('Enter') || I.pressed.has('Space')) && rows[this.sel]) this.pick(rows[this.sel]);
  }
  pick(r) {
    if (!r || r.disabled) { G.audio.play('error'); return; }
    const res = r.act(this);
    if (typeof res === 'string') { this.msg = res; this.msgT = 2.5; }
  }
  render(ctx) {
    const U = G.ui, R0 = G.renderer, rows = this.rows(), m = G.input.mouse;
    U.dim(ctx, 0.5);
    const w = Math.min(this.o.w || 340, R0.uiW - 20), rh = 22, vis = this.vis = Math.max(3, Math.min(rows.length, Math.floor((R0.uiH - 110) / rh))), h = 44 + vis * rh + 14;
    const x = (R0.uiW - w) / 2, y = (R0.uiH - h) / 2;
    this.sel = G.util.clamp(this.sel, 0, Math.max(0, rows.length - 1));
    if (this.sel < this.scroll) this.scroll = this.sel; if (this.sel >= this.scroll + vis) this.scroll = this.sel - vis + 1;
    U.panel(ctx, x, y, w, h, { title: this.title, titleSize: 12 });
    if (this.o.sub) U.text(ctx, this.o.sub(), x + w / 2, y + 22, { align: 'center', size: 7, color: U.colors.dim });
    if (!rows.length) U.text(ctx, this.o.empty || 'Nothing here.', x + w / 2, y + 50, { align: 'center', size: 9, color: U.colors.dim });
    rows.slice(this.scroll, this.scroll + vis).forEach((r, j) => {
      const i = this.scroll + j, ry = y + 34 + j * rh, hover = U.inRect(m.ux, m.uy, x + 8, ry, w - 20, rh - 2);
      if (hover && m.moved) this.sel = i;
      ctx.fillStyle = this.sel === i ? 'rgba(232,192,64,0.22)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 8, ry, w - 20, rh - 2);
      if (r.icon) U.icon(ctx, r.icon, x + 11, ry + 2, 1);
      U.text(ctx, r.label, x + 30, ry + 2, { size: 9, color: r.disabled ? '#8a8a8a' : '#f0ead8' });
      if (r.sub) U.text(ctx, r.sub, x + 30, ry + 12, { size: 6, color: r.disabled ? '#7a6a6a' : '#b8c8a8' });
      if (r.right) U.text(ctx, r.right, x + w - 16, ry + 6, { size: 8, align: 'right', color: '#e8c040' });
      if (hover && m.pressed) { this.sel = i; this.pick(r); }
    });
    if (rows.length > vis) { const th = Math.max(10, vis / rows.length * vis * rh), ty = y + 34 + (this.scroll / (rows.length - vis)) * (vis * rh - th); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + w - 9, y + 34, 3, vis * rh); ctx.fillStyle = '#c8a040'; ctx.fillRect(x + w - 9, ty, 3, th); }
    U.text(ctx, this.msgT > 0 ? this.msg : (this.o.hint || ''), x + w / 2, y + h - 12, { align: 'center', size: 7, color: this.msgT > 0 ? '#e8d890' : U.colors.dim });
  }
}
G.ListScene = ListScene;
const need = (p, list) => list.every(([id, n]) => H.count(p, id) >= n);
const listText = (p, list) => list.map(([id, n]) => `${n} ${(G.ITEMS[id] || { name: id }).name} (${H.count(p, id)})`).join(', ');

// ---------------------------------------------------------------- crafting (workbench only)
const CRAFT = [
  { out: ['planks', 2], in: [['wood', 1]], bonus: 'saw' },
  { out: ['hammer', 1], in: [['wood', 1], ['iron_ingot', 1]] },
  { out: ['saw', 1], in: [['wood', 1], ['iron_ingot', 1]] },
  { out: ['hoe', 1], in: [['wood', 2], ['iron_ingot', 1]] },
  { out: ['watering_can', 1], in: [['metal_sheet', 2]] },
  { out: ['iron_ingot', 1], in: [['iron_ore', 2]] },
  { out: ['nails', 4], in: [['iron_ingot', 1]] },
  { out: ['metal_sheet', 1], in: [['iron_ingot', 2]] },
  { out: ['rope', 1], in: [['cloth', 2]] },
  { out: ['cloth', 3], in: [['cloth_tunic', 1]] },
  { out: ['lockpick', 3], in: [['iron_ingot', 1]] },
  { out: ['bandage', 2], in: [['cloth', 2]] },
  { out: ['fishing_rod', 1], in: [['wood', 2], ['rope', 1]] },
  { out: ['club', 1], in: [['wood', 2]] },
  { out: ['baseball_bat', 1], in: [['planks', 3]] },
  { out: ['mace', 1], in: [['baseball_bat', 1], ['nails', 4]] },
  { out: ['spear', 1], in: [['wood', 2], ['iron_ingot', 1]] },
  { out: ['woodaxe', 1], in: [['wood', 1], ['iron_ingot', 2]] },
  { out: ['crowbar', 1], in: [['iron_ingot', 2]] },
  { out: ['shovel', 1], in: [['wood', 1], ['iron_ingot', 1]] },
  { out: ['torch', 1], in: [['wood', 1], ['cloth', 1], ['oil_flask', 1]] },
  { out: ['fire_bomb', 1], in: [['oil_flask', 1], ['cloth', 1], ['beer', 1]] },
  { out: ['leather_armor', 1], in: [['pelt', 3], ['rope', 1]] },
];
for (const id in G.BUILD_PIECES) { const r = G.BUILD_PIECES[id].recipe; if (r) CRAFT.push({ out: [id, 1], in: r }); }
G.CRAFT_RECIPES = CRAFT;
H.crafting = (scene) => {
  const p = scene.player;
  G.scenes.push(new ListScene('Workbench', () => CRAFT.filter((r) => G.ITEMS[r.out[0]] && r.in.every(([id]) => G.ITEMS[id])).map((r) => {
    const [id, n] = r.out, it = G.ITEMS[id], ok = need(p, r.in), more = r.bonus && p.inventory.has(r.bonus) ? 2 : 1;
    return { icon: it.icon, label: `${it.name}${n * more > 1 ? ' x' + n * more : ''}`, sub: listText(p, r.in), disabled: !ok, act: () => {
      if (!need(p, r.in)) return 'You are missing something.';
      for (const [iid, k] of r.in) H.take(p, iid, k);
      const left = H.give(p, id, n * more);
      G.audio.play('craft'); G.events.emit('xp', 2, 'Crafting');
      return left ? `Made ${it.name}, but your pockets are full.` : `Made ${it.name}${n * more > 1 ? ' x' + n * more : ''}.`;
    } };
  }), { sub: () => 'Materials come from your pockets and your construction inventory.' }));
};
// ---------------------------------------------------------------- cooking (campfire or stove)
const RAW_FISH = Object.keys(G.ITEMS).filter((k) => /^fish_/.test(k) && k !== 'fish_golden').concat(['fish']);
const COOK = [
  { out: ['cooked_meat', 1], in: [['raw_meat', 1]] },
  { out: ['cooked_fish', 1], in: [['*fish', 1]] },
  { out: ['fried_egg', 1], in: [['egg', 1]] },
  { out: ['baked_potato', 1], in: [['potato', 1]] },
  { out: ['roasted_corn', 1], in: [['corn', 1]] },
  { out: ['fried_mushrooms', 1], in: [['*mushroom', 2]] },
  { out: ['veggie_stew', 1], in: [['potato', 1], ['carrot', 1], ['tomato', 1], ['water_bottle', 1]] },
  { out: ['meat_stew', 1], in: [['raw_meat', 1], ['potato', 1], ['carrot', 1], ['water_bottle', 1]] },
  { out: ['salad', 1], in: [['tomato', 1], ['carrot', 1], ['cabbage_head', 1]] },
  { out: ['flour', 1], in: [['wheat', 2]] },
  { out: ['bread', 2], in: [['flour', 2], ['water_bottle', 1]], stove: true },
  { out: ['challah', 1], in: [['flour', 2], ['egg', 1]], stove: true },
  { out: ['long_pork', 2], in: [['body_arm', 1]] }, { out: ['long_pork', 3], in: [['body_leg', 1]] }, { out: ['long_pork', 5], in: [['body_torso', 1]] }, { out: ['cooked_brain', 1], in: [['body_brain', 1]] },
];
const pickAny = (p, key) => { const pool = key === '*fish' ? RAW_FISH : ['mushroom', 'chanterelle']; return pool.find((k) => H.count(p, k) > 0) || pool[0]; };
const countAny = (p, key) => (key === '*fish' ? RAW_FISH : ['mushroom', 'chanterelle']).reduce((s, k) => s + H.count(p, k), 0);
const cookNeed = (p, r) => r.in.every(([id, n]) => (id[0] === '*' ? countAny(p, id) : H.count(p, id)) >= n);
const cookText = (p, r) => r.in.map(([id, n]) => `${n} ${id === '*fish' ? 'raw fish' : id === '*mushroom' ? 'mushrooms' : (G.ITEMS[id] || { name: id }).name} (${id[0] === '*' ? countAny(p, id) : H.count(p, id)})`).join(', ');
H.cooking = (scene, stove) => {
  const p = scene.player;
  G.scenes.push(new ListScene(stove ? 'Stove' : 'Campfire', () => COOK.filter((r) => G.ITEMS[r.out[0]]).map((r) => {
    const [id, n] = r.out, it = G.ITEMS[id], ok = cookNeed(p, r) && (!r.stove || stove);
    return { icon: it.icon, label: `${it.name}${n > 1 ? ' x' + n : ''}`, sub: cookText(p, r) + (r.stove && !stove ? '  (needs an oven: a stove)' : ''), disabled: !ok, act: () => {
      if (!ok) return r.stove && !stove ? 'You need a stove for that.' : 'You do not have the ingredients.';
      for (const [iid, k] of r.in) { if (iid[0] === '*') { let left = k; while (left > 0) { const pk = pickAny(p, iid); const c = Math.min(left, H.count(p, pk)); if (!c) break; H.take(p, pk, c); left -= c; } } else H.take(p, iid, k); }
      p.inventory.add(id, n); G.audio.play('cook'); scene.world.addMinutes && scene.world.addMinutes(5);
      return `Cooked: ${it.name}.`;
    } };
  }), { sub: () => 'Pick something to cook. Each takes a few minutes.', empty: 'Nothing to cook.' }));
};
G.audio.SFX.craft = function (o, T) { const w = T._out(o, { vol: 0.5, wet: 0.1 }); if (!w) return; for (let i = 0; i < 3; i++) T._burst(w.node, w.t + i * 0.12, { noise: 'white', dur: 0.05, vol: 0.25, type: 'bandpass', f: 1800 + i * 300, q: 2 }); };
G.audio.SFX.cook = function (o, T) { const w = T._out(o, { vol: 0.5, wet: 0.1 }); if (!w) return; T._burst(w.node, w.t, { noise: 'pink', dur: 0.6, vol: 0.18, type: 'highpass', f: 3000, hold: 0.4 }); };

// workbench, campfire and stove open their menus
if (G.DECOR.toolbench) G.DECOR.toolbench.interact = 'workbench';
if (G.DECOR.campfire && !G.DECOR.campfire.interact) G.DECOR.campfire.interact = 'campfire';
if (G.DECOR.stove) G.DECOR.stove.interact = G.DECOR.stove.interact || 'stove';
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  const k = d.def.interact;
  if (k === 'workbench') { H.crafting(scene); return; }
  if (d.type === 'stove' || k === 'stove') { H.cooking(scene, true); return; }
  if (k === 'campfire' || d.type === 'campfire') { H.cooking(scene, false); return; }
  return _use.call(this, d, scene);
};
const GS = G.GameScene.prototype, _ud = GS.useDecor, _dl = GS.decorLabel;
GS.useDecor = function (d) { const k = d.def.interact; if (k === 'workbench' || k === 'campfire' || k === 'stove') return G.usables.use(d, this); return _ud.call(this, d); };
GS.decorLabel = function (d) { const k = d.def.interact; if (k === 'workbench') return 'Craft (workbench)'; if (d.type === 'stove') return 'Cook (stove)'; if (k === 'campfire') return 'Cook (campfire)'; if (k === 'stove') return 'Cook (stove)'; return _dl.call(this, d); };
if (G.usables.label) { const _lb = G.usables.label; G.usables.label = function (d, scene) { const k = d.def.interact; if (k === 'workbench') return 'Craft (workbench)'; if (d.type === 'stove') return 'Cook (stove)'; if (k === 'campfire') return 'Cook (campfire)'; if (k === 'stove') return 'Cook (stove)'; return _lb.call(this, d, scene); }; }

// ---------------------------------------------------------------- construction mode
const I = G.input;
if (!I.defaultBindings.build) { I.defaultBindings.build = ['KeyB']; if (I.bindings && !I.bindings.build) I.bindings.build = ['KeyB']; I.rebindable.push('build'); I.actionLabels.build = 'Construction Mode'; }
const ROADS = () => new Set([T.asphalt, T.road_line, T.road_line_v, T.door].filter((x) => x != null));
H.built = (w, mapId) => ((w.built = w.built || {})[mapId] = (w.built || {})[mapId] || {});
// where a piece goes: the tile under the mouse, anywhere on screen (once the mouse has been used), or else
// the tile in front of you
H.target = (scene) => {
  const p = scene.player;
  if (H.mouseUsed) { const mw = p.mouseWorld(); return { tx: Math.floor(mw.x / 16), ty: Math.floor(mw.y / 16) }; }
  const [fx, fy] = G.util.DIR_VEC[p.dir];
  return { tx: Math.floor(p.x / 16) + fx, ty: Math.floor((p.y - 3) / 16) + fy };
};
// the full construction inventory: every piece (pick one to place it) and every material, with counts
H.inventoryMenu = (scene) => {
  const w = scene.world;
  G.scenes.push(new ListScene('Construction Inventory', () => {
    const pieces = H.pieces(w), mats = H.list(w).filter((id) => !G.ITEMS[id].piece).sort((a, b) => G.ITEMS[a].name.localeCompare(G.ITEMS[b].name));
    const pc = pieces.map((id, i) => ({ icon: G.ITEMS[id].icon, label: G.ITEMS[id].name, right: 'x' + H.inv(w)[id], sub: G.BUILD_PIECES[id].place.tile ? 'Building piece: click to build with it' : 'Furniture: click to place it',
      act: (ls) => { scene.buildSel = i; scene.buildMode = true; G.scenes.remove(ls); } }));
    const mt = mats.map((id) => ({ icon: G.ITEMS[id].icon, label: G.ITEMS[id].name, right: 'x' + H.inv(w)[id], sub: 'Material: crafted into pieces at a workbench', act: () => 'Materials are used at a workbench (crafting).' }));
    return pc.concat(mt);
  }, { sub: () => `${H.pieces(w).length} kinds of pieces, ${H.list(w).length - H.pieces(w).length} kinds of materials`, empty: 'Empty. The Builders\' Supply in the Port District sells everything.' }));
};
H.overBar = (scene) => { const b = scene._buildBar, m = I.mouse; return !!(b && m.ux >= b.x && m.ux < b.x + b.w && m.uy >= b.y && m.uy < b.y + b.h); };
// can this piece go here? returns '' when it can, or why not
H.why = (scene, id, tx, ty) => {
  const map = scene.map, w = scene.world, pc = G.BUILD_PIECES[id];
  if (!pc) return 'Not a building piece.';
  if (map.meta.floorOf && pc.place.tile && /wall|door/.test(pc.place.tile)) return 'Not up here.';
  const d = pc.place.decor ? G.DECOR[pc.place.decor] : null, fw = (d && d.fw) || 1, fh = (d && d.fh) || 1;
  for (let y = ty - fh + 1; y <= ty; y++) for (let x = tx; x < tx + fw; x++) {
    if (!map.inBounds(x, y) || x < 1 || y < 1 || x >= map.w - 1 || y >= map.h - 1) return 'Off the map.';
    const t = map.tileDef(x, y);
    if (t.solid || t.water) return 'Something is in the way.';
    if (ROADS().has(map.get(x, y))) return 'Not on the road or in a doorway.';
    if (map.decorsAt(x, y).some((q) => !q.def.flat)) return 'Something is in the way.';
    const b = map.buildingAtTile(x, y);
    if (b && w.flags.player_home !== b.id && !(b.floorOf && w.flags.player_home === b.floorOf) && !H.built(w, map.id)[x + ',' + y]) return 'This is somebody else\'s place.';
    if ((map.exits || []).some((e) => x >= e.x - 1 && x < e.x + e.w + 1 && y >= e.y - 1 && y < e.y + e.h + 1)) return 'Too close to the way out.';
    if (pc.place.tile && (T[pc.place.tile] && G.TILES[T[pc.place.tile]].solid) && scene.actors.some((a) => !a.dead && Math.abs(a.x - (x * 16 + 8)) < 12 && Math.abs(a.y - 4 - (y * 16 + 8)) < 12)) return 'Someone is standing there.';
  }
  return '';
};
H.place = (scene, id, tx, ty) => {
  const why = H.why(scene, id, tx, ty); if (why) return why;
  const map = scene.map, w = scene.world, pc = G.BUILD_PIECES[id], built = H.built(w, map.id), key = tx + ',' + ty, p = scene.player;
  if (id !== 'kit_campfire' && !p.inventory.has('hammer') && p.equip.weapon !== 'hammer') return 'You need a hammer to build.';
  H.take(p, id, 1);
  if (pc.place.tile) {
    const prev = built[key];
    built[key] = { id, tile: true, under: prev ? prev.under : map.get(tx, ty) };
    G.mods.tile(map, tx, ty, T[pc.place.tile]);
  } else {
    G.mods.addDecor(map, pc.place.decor, tx, ty);
    built[key] = Object.assign(built[key] || {}, { decorId: id, decor: pc.place.decor });
  }
  G.audio.play('craft'); G.events.emit('xp', 1, 'Building');
  return '';
};
H.remove = (scene, tx, ty) => {
  const map = scene.map, w = scene.world, built = H.built(w, map.id), key = tx + ',' + ty, b = built[key];
  if (!b) return 'You did not build that.';
  if (b.decor) {
    const d = map.decorsAt(tx, ty).find((q) => q.type === b.decor && q.tx === tx && q.ty === ty);
    if (d) G.mods.removeDecor(map, d);
    H.give(scene.player, b.decorId, 1); delete b.decor; delete b.decorId;
  } else if (b.tile) {
    if (scene.actors.some((a) => !a.dead && Math.abs(a.x - (tx * 16 + 8)) < 10 && Math.abs(a.y - 4 - (ty * 16 + 8)) < 10) && G.TILES[map.get(tx, ty)].solid === false) { /* fine */ }
    G.mods.tile(map, tx, ty, b.under); H.give(scene.player, b.id, 1); delete b.tile; delete b.id;
  }
  if (!b.tile && !b.decor) delete built[key];
  G.audio.play('door');
  return '';
};
const _gu = GS.update;
GS.update = function (dt) {
  const p = this.player, top = G.scenes.top() === this;
  if (top && p && !p.dead && I.wasPressed('build') && !p.vehicle) {
    this.buildMode = !this.buildMode;
    if (this.buildMode && !H.pieces(this.world).length) { this.buildMode = false; this.toast('You have nothing to build with. The Builders\' Supply (Port District) sells pieces; a workbench makes them.', 'info'); }
    else this.toast(this.buildMode ? 'Construction mode.' : 'Construction mode off.', 'info');
  }
  if (!this.buildMode || !top || !p || p.dead || p.vehicle) { if (this.buildMode && p && p.vehicle) this.buildMode = false; return _gu.call(this, dt); }
  // while building, the mouse buttons and [F] belong to building (not to fighting or setting fires)
  const m = I.mouse, list = H.pieces(this.world);
  if (!list.length) { this.buildMode = false; return _gu.call(this, dt); }
  this.buildSel = G.util.clamp(this.buildSel || 0, 0, list.length - 1);
  if (m.wheel) this.buildSel = (this.buildSel + Math.sign(m.wheel) + list.length) % list.length;
  if (I.pressed.has('KeyZ')) this.buildSel = (this.buildSel + list.length - 1) % list.length;
  if (I.pressed.has('KeyC')) this.buildSel = (this.buildSel + 1) % list.length;
  if (m.moved) H.mouseUsed = true;
  if (I.pressed.has('KeyV')) { H.inventoryMenu(this); return _gu.call(this, dt); }
  // clicks on the bar pick a piece or open the full inventory; they never build under the bar
  const onBar = H.overBar(this), bar = this._buildBar;
  if (onBar && m.pressed && bar) {
    if (m.ux >= bar.btn.x && m.ux < bar.btn.x + bar.btn.w && m.uy >= bar.btn.y && m.uy < bar.btn.y + bar.btn.h) H.inventoryMenu(this);
    else { const k = Math.floor((m.ux - bar.x - 4) / bar.cw); if (k >= 0 && k < bar.show) this.buildSel = bar.start + k; }
    G.audio.play('select');
  }
  const t = H.target(this), place = (m.pressed && !onBar) || I.pressed.has('KeyF'), take = (m.rpressed && !onBar) || I.pressed.has('KeyX');
  const saved = [m.down, m.pressed, m.rdown, m.rpressed], fKey = I.pressed.has('KeyF');
  m.down = m.pressed = m.rdown = m.rpressed = false; I.pressed.delete('KeyF');
  let r;
  try { r = _gu.call(this, dt); } finally { [m.down, m.pressed, m.rdown, m.rpressed] = saved; if (fKey) I.pressed.add('KeyF'); }
  if (place) { const why = H.place(this, list[this.buildSel], t.tx, t.ty); if (why) { this.toast(why, 'bad'); G.audio.play('error'); } }
  else if (take) { const why = H.remove(this, t.tx, t.ty); if (why) this.toast(why, 'bad'); }
  return r;
};
// the ghost of the piece where it would go, and the bar of what you have
const _render = GS.render;
GS.render = function (ctx) {
  _render.call(this, ctx);
  if (!this.buildMode || !this.player) return;
  const list = H.pieces(this.world); if (!list.length) return;
  const id = list[G.util.clamp(this.buildSel || 0, 0, list.length - 1)], pc = G.BUILD_PIECES[id], t = H.target(this), ok = !H.why(this, id, t.tx, t.ty);
  const R0 = G.renderer; R0.worldTransform();
  const vr = pc.place.decor ? G.buildKit.variant(this, pc) : {}, d = vr.type && G.DECOR[vr.type], s = d && A.sprites[d.sprite];
  if (!H.overBar(this)) {
  ctx.globalAlpha = 0.55;
  if (s) G.drawDecor(ctx, { def: d, type: vr.type, ori: vr.ori, tx: t.tx, ty: t.ty, x: t.tx * 16 + ((d.fw || 1) * 8), y: t.ty * 16 + 15 }, s, this);   // (the piece as it will stand)
  ctx.globalAlpha = 1;
  if (s) { ctx.strokeStyle = ok ? 'rgba(120,255,140,0.9)' : 'rgba(255,90,90,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(t.tx * 16 + 0.5, (t.ty - ((d && d.fh) || 1) + 1) * 16 + 0.5, ((d && d.fw) || 1) * 16 - 1, ((d && d.fh) || 1) * 16 - 1); }
  }
  // the bar
  R0.uiTransform();
  const U = G.ui, n = list.length, cw = 30, show = Math.min(n, Math.floor((R0.uiW - 40) / cw)), start = G.util.clamp((this.buildSel || 0) - Math.floor(show / 2), 0, Math.max(0, n - show));
  const btnW = 34, bw = show * cw + 8 + btnW + 4, bx = (R0.uiW - bw) / 2, by = R0.uiH - 50;
  U.panel(ctx, bx, by, bw, 40);
  // the button for the whole construction inventory
  const btn = { x: bx + bw - btnW - 4, y: by + 4, w: btnW, h: 22 }, mm = I.mouse, hov = mm.ux >= btn.x && mm.ux < btn.x + btn.w && mm.uy >= btn.y && mm.uy < btn.y + btn.h;
  ctx.fillStyle = hov ? 'rgba(232,192,64,0.45)' : 'rgba(232,192,64,0.18)'; ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = '#c8a040'; ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
  U.text(ctx, 'ALL', btn.x + btn.w / 2, btn.y + 4, { align: 'center', size: 8, color: '#ffe8a0' });

  this._buildBar = { x: bx, y: by, w: bw, h: 40, cw, show, start, btn };
  for (let k = 0; k < show; k++) {
    const i = start + k, it = G.ITEMS[list[i]], x = bx + 4 + k * cw;
    ctx.fillStyle = i === this.buildSel ? 'rgba(232,192,64,0.35)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(x, by + 4, cw - 2, 22);
    U.icon(ctx, it.icon, x + 4, by + 5, 1.25);
    U.text(ctx, String(H.inv(this.world)[list[i]] || 0), x + cw - 4, by + 18, { size: 6, align: 'right', color: '#fff' });
  }
  U.text(ctx, `${G.ITEMS[id].name}${ok ? '' : ' — ' + H.why(this, id, t.tx, t.ty)}`, R0.uiW / 2, by + 28, { align: 'center', size: 7, color: ok ? '#e8f0d8' : '#ffb0a0' });
};

// ---------------------------------------------------------------- the Builders' Supply (Port District)
const findSpot = (m, w, h, cx, cy, rad) => {
  let best = null, bd = 1e9;
  for (let y = Math.max(2, cy - rad); y < Math.min(m.h - h - 3, cy + rad); y++) for (let x = Math.max(2, cx - rad); x < Math.min(m.w - w - 2, cx + rad); x++) {
    let ok = true;
    for (let j = -1; j <= h + 1 && ok; j++) for (let i = -1; i <= w && ok; i++) {
      const t = m.tileDef(x + i, y + j);
      if (!t || t.solid || t.water || m.buildingAtTile(x + i, y + j) || (j < h && m.decorsAt(x + i, y + j).some((d) => !d.def.flat)) || ROADS().has(m.get(x + i, y + j))) ok = false;
    }
    if (ok) { const dd = Math.hypot(x - cx, y - cy); if (dd < bd) { bd = dd; best = { x, y }; } }
  }
  return best;
};
G.home.findSpot = findSpot;
const clearArea = (m, x0, y0, w, h) => { m.decor = m.decor.filter((d) => !(d.tx >= x0 - 1 && d.tx <= x0 + w && d.ty >= y0 - 1 && d.ty <= y0 + h + 1)); m.flats = m.flats.filter((d) => !(d.tx >= x0 - 1 && d.tx <= x0 + w && d.ty >= y0 - 1 && d.ty <= y0 + h + 1)); };
G.home.clearArea = clearArea;
const look = (seed, o) => G.look(seed, o);
G.NPCS.i_builder = { name: 'Builders\' Supply Owner', map: 'industrial', faction: 'civilians', hp: 34, combat: 'fight', gold: 300, relations: {},
  look: look('i_builder', { body: 'm', top: 'vest', shirt: '#e8a020', hat: 'cap', hatColor: '#3a5a8a', facial: 1 }), home: 'i_supply', shop: 'i_supply',
  job: 'Lumber, bricks, cement, nails, fixtures, furniture. Call me and I deliver.',
  schedule: [{ from: 6, to: 7, at: 'i_supply_in', act: 'idle' }, { from: 7, to: 19, at: 'i_supply_work', act: 'work' }, { from: 19, to: 22, at: 'i_supply_in', act: 'idle' }, { from: 22, to: 6, at: 'i_supply_bed', act: 'sleep' }] };
const STOCK = [['planks', 60], ['nails', 60], ['bricks', 60], ['cement', 20], ['metal_sheet', 20], ['glass_pane', 15], ['rope', 10], ['cloth', 20], ['stone', 40],
  ['hammer', 3], ['saw', 3], ['hoe', 3], ['watering_can', 3], ['kit_workbench', 2], ['kit_campfire', 5], ['kit_door', 4], ['kit_wall_wood', 20], ['kit_wall_brick', 10], ['kit_floor_wood', 20],
  ['kit_fence', 30], ['kit_bed', 2], ['kit_table', 2], ['kit_chair', 6], ['kit_couch', 2], ['kit_shelf', 3], ['kit_wardrobe', 2], ['kit_crate', 4], ['kit_stove', 1], ['kit_fridge', 1], ['kit_toilet', 1], ['kit_sink', 1],
  ['kit_tv', 1], ['kit_floorlamp', 3], ['kit_lamp', 2], ['kit_trough', 2], ['kit_haybale', 4]];
G.SHOPS.i_supply = { name: 'Builders\' Supply', owner: 'i_builder', region: 'city', gold: 900, buyMult: 1.0, sellMult: 0.5, buys: ['build', 'material'], stock: STOCK.filter(([id]) => G.ITEMS[id]) };
if (G.SHOP_SIGNS) G.SHOP_SIGNS.push([/Builders/, { text: 'BUILDERS', bg: '#e8a020', fg: '#1a1a1e', awning: null, icon: null }]);
if (G.MAPGEN.industrial) {
  const _ind = G.MAPGEN.industrial;
  G.MAPGEN.industrial = () => {
    const m = _ind(), r = new G.RNG('supply');
    const at = findSpot(m, 14, 10, Math.floor(m.w / 2), Math.floor(m.h / 2), Math.max(m.w, m.h));
    if (!at) return m;
    clearArea(m, at.x, at.y, 14, 10);
    const b = m.addBuilding('i_supply', at.x, at.y, 14, 10, { name: 'Builders\' Supply', wall: 'wall_concrete', floor: 'concrete', roof: 'flat', kind: 'shop' });
    G.MB.furnish(m, b, 'shop', r, { owner: 'i_builder', loot: [['nails', 4], ['planks', 4]] });
    G.home.supplyInterior(m, b, r);
    // lumber stacked out front
    for (const [dx, type] of [[-2, 'crate'], [b.w + 1, 'crate']]) { const x = at.x + dx, y = at.y + b.h - 1; if (m.inBounds(x, y) && !m.isSolidTile(x, y) && !m.decorsAt(x, y).length) m.addDecor(type, x, y); }
    m.computeSolids(); m.prerender();
    return m;
  };
}
// Inside the store: hardware shelving along the back wall, a furniture showroom (a living room, a bedroom, a
// dining set) on one side, the lumber yard and fixtures (sinks, stoves, toilets) on the other, an aisle
// down the middle. Placed with a RoomPlan seeded with what the shop layout already put down, so the counter,
// the owner's spots and every piece stay reachable.
G.home.supplyInterior = function (m, b, r) {
  const P = new G.RoomPlan(m, b), inB = (x, y) => P.inside(x, y);
  for (const d of m.decor) {
    if (!inB(d.tx, d.ty)) continue;
    const tiles = []; for (let i = 0; i < (d.def.fw || 1); i++) tiles.push([d.tx + i, d.ty]);
    if (d.def.solid) { for (const [x, y] of tiles) P.blocked.add(P.k(x, y)); P.things.push({ tiles }); } else for (const [x, y] of tiles) P.reserve(x, y);
  }
  for (const c of m.chests || []) if (inB(c.tx, c.ty)) { P.blocked.add(P.k(c.tx, c.ty)); P.things.push({ tiles: [[c.tx, c.ty]] }); }
  for (const k in m.points) { const pt = m.points[k]; if (pt && inB(pt.x, pt.y) && !P.blocked.has(P.k(pt.x, pt.y))) { P.reserve(pt.x, pt.y); P.mustReach(pt.x, pt.y); } }
  for (let y = P.iy0; y <= P.iy1; y++) P.reserve(P.dx, y);   // the aisle from the door
  const area = (x0, x1, y0, y1) => { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); return r.shuffle ? r.shuffle(out) : out.sort(() => r.next() - 0.5); };
  const has = (t) => !!G.DECOR[t];
  const back = P.row(P.iy0, P.ix0, P.ix1);
  for (const t of ['shelf', 'toolbench', 'bookcase', 'display_case', 'shelf', 'toolbench', 'shelf', 'display_case']) if (has(t)) P.putAny(t, back);
  const mid = Math.floor((P.ix0 + P.ix1) / 2);
  const show = area(P.ix0, mid - 1, P.iy0 + 1, P.iy1 - 1), yard = area(mid + 1, P.ix1, P.iy0 + 1, P.iy1 - 1);
  P.putAny('rug', show);
  for (const t of ['couch', 'coffee_table', 'armchair', 'floorlamp', 'bed', 'nightstand', 'lamp_table', 'wardrobe', 'table', 'chair', 'chair', 'plant', 'tv', 'clothes_rack']) if (has(t)) P.putAny(t, show);
  for (const t of ['log', 'log', 'crate', 'crate', 'barrel', 'barrel', 'cart', 'crate', 'kcounter_sink', 'toilet', 'stove', 'fridge', 'sink', 'washer', 'barrel']) if (has(t)) P.putAny(t, yard);
};
// phone orders (once you have their number): a delivery in about an hour, to your construction inventory
const ORDERS = [
  ['Lumber: 20 planks, 20 nails', [['planks', 20], ['nails', 20]]],
  ['Masonry: 30 bricks, 5 cement, 10 stones', [['bricks', 30], ['cement', 5], ['stone', 10]]],
  ['Fixtures: 4 metal sheets, 4 glass panes', [['metal_sheet', 4], ['glass_pane', 4]]],
  ['Starter shack: 32 wooden walls, 36 wood floors, a door', [['kit_wall_wood', 32], ['kit_floor_wood', 36], ['kit_door', 1]]],   // (a room you can live in, at this scale)
  ['Fencing: 20 fence pieces', [['kit_fence', 20]]],
  ['Bedroom: bed, nightstand, wardrobe', [['kit_bed', 1], ['kit_nightstand', 1], ['kit_wardrobe', 1]]],
  ['Kitchen: stove, fridge, counter, sink', [['kit_stove', 1], ['kit_fridge', 1], ['kit_counter', 1], ['kit_sink', 1]]],
  ['Workshop: workbench, hammer, saw', [['kit_workbench', 1], ['hammer', 1], ['saw', 1]]],
  ['Farming: hoe, watering can, seeds', [['hoe', 1], ['watering_can', 1], ['seed_tomato', 5], ['seed_potato', 5], ['seed_carrot', 5]]],
];
const orderCost = (items) => Math.round(items.reduce((s, [id, n]) => s + ((G.ITEMS[id] || { value: 0 }).value * n), 0) * 1.1 + 15);
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.id === 'i_builder' && runner.npc.remote ? [{ text: 'I would like to order a delivery.', next: '_build_order' }] : []));
// in person: ask to buy (materials and furniture), even when the regular "wares" line is not offered
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner;
  if (npc.id !== 'i_builder' || npc.remote) return [];
  return [{ text: 'I want to buy building materials and furniture.', next: '_build_buy' }];
});
G.DIALOGUE_NODES._build_buy = (r) => {
  const scene = r.scene, w = scene.world;
  if (G.shopSys.isOpen('i_supply', scene)) return { text: 'Lumber, bricks, cement, fixtures, and everything in the showroom comes flat-packed. Take a look.', choices: [{ text: 'Show me.', next: null, do: (c) => c.openShop() }, { text: 'Maybe later.', next: null }] };
  const e = r.npc.currentEntry(w);
  const why = w.getRep('city') <= -60 ? 'I don\'t do business with people like you. Not after what I\'ve heard.' : !e || e.act !== 'work' ? 'We\'re closed. Come back between seven and seven. Or call me, I deliver.' : 'Not right now.';
  return { text: why, choices: [{ text: 'Alright.', next: null }] };
};
G.DIALOGUE_NODES._build_order = (r) => {
  const p = r.scene.player, w = r.scene.world;
  return { text: 'Sure thing. What do you need? Delivery is included, about an hour.', choices: ORDERS.filter(([, items]) => items.every(([id]) => G.ITEMS[id])).map(([label, items]) => {
    const cost = orderCost(items);
    return { text: `${label} — $${cost}`, next: null, do: () => {
      if (p.gold < cost) { r.scene.toast('You do not have the money.', 'bad'); return; }
      p.gold -= cost; (w.deliveries = w.deliveries || []).push({ at: G.effects.now() + 60, items, from: 'Builders\' Supply' });
      r.scene.toast(`Ordered. $${cost}. It will be delivered in about an hour.`, 'good');
    } };
  }).concat([{ text: 'Never mind.', next: null }]) };
};
G.events.on('hour', () => {
  const w = G.world, scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!w || !w.deliveries || !scene) return;
  const now = G.effects.now();
  for (const d of w.deliveries.filter((x) => x.at <= now + 1)) {
    for (const [id, n] of d.items) { const left = H.give(scene.player, id, n); if (left) H.inv(w)[id] = (H.inv(w)[id] || 0); if (left) scene.player.inventory.add(id, left); }
    scene.toast(`Your delivery from ${d.from} arrived. (Construction inventory: [B])`, 'good');
  }
  w.deliveries = w.deliveries.filter((x) => x.at > now + 1);
});
const _onLoad = G.onWorldLoaded;
G.onWorldLoaded = function (w) {
  if (_onLoad) _onLoad.apply(this, arguments);
  w.shops = w.shops || {};
  if (!w.shops.i_supply) w.shops.i_supply = { stock: G.util.clone(G.SHOPS.i_supply.stock), gold: G.SHOPS.i_supply.gold, owner: 'i_builder' };
};
})();
