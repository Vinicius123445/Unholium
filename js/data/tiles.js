'use strict';
// Tile definitions. Index in this array = tile id stored in maps.
//   tex: texture name in G.assets.tiles     over: base texture drawn beneath (for overlays like fences)
//   solid: blocks movement                  anim: animated (frames cycle)
//   mini: minimap color                     water: counts as water
// Fire & destruction (see js/game/fire.js):
//   fuel: how long it burns (0 = never burns)     flam: 0..1 chance-weight to catch fire from a neighbour
//   burnsTo: tile it becomes once burnt            regrow: days until a burnt tile returns to its original state
//   breakTo + breakHp: can be smashed by melee attacks (e.g. fences)

G.TILES = [
  { name: 'void', tex: null, solid: true, mini: '#000000' },
  { name: 'grass', tex: 'grass', mini: '#4f8f3c', fuel: 5, flam: 0.22, burnsTo: 'burnt_grass' },
  { name: 'darkgrass', tex: 'darkgrass', mini: '#2f5c2b', fuel: 5, flam: 0.18, burnsTo: 'burnt_grass' },
  { name: 'dirt', tex: 'dirt', mini: '#86643f' },
  { name: 'path', tex: 'path', mini: '#b39566' },
  { name: 'cobble', tex: 'cobble', mini: '#8d8880' },
  { name: 'plaza', tex: 'plaza', mini: '#bdb39e' },
  { name: 'sand', tex: 'sand', mini: '#d8c38c' },
  { name: 'water', tex: 'water', solid: true, anim: true, water: true, mini: '#2b67a8' },
  { name: 'deepwater', tex: 'deepwater', solid: true, anim: true, water: true, mini: '#1f4d84' },
  { name: 'woodfloor', tex: 'woodfloor', mini: '#8a5a30', fuel: 22, flam: 0.5, burnsTo: 'burnt_floor' },
  { name: 'stonefloor', tex: 'stonefloor', mini: '#7f7b74' },
  { name: 'carpet', tex: 'carpet', mini: '#7a2533', fuel: 20, flam: 0.65, burnsTo: 'burnt_floor' },
  { name: 'field', tex: 'field', mini: '#6b4a2b' },
  { name: 'wheat', tex: 'wheat', mini: '#c9a33c', fuel: 14, flam: 0.85, burnsTo: 'field_burnt' },
  { name: 'wall_stone', tex: 'wall_stone', solid: true, wall: true, mini: '#5a5650' },
  { name: 'wall_wood', tex: 'wall_wood', solid: true, wall: true, mini: '#5b3a1e', fuel: 40, flam: 0.55, burnsTo: 'ruin_wood' },
  { name: 'wall_plaster', tex: 'wall_plaster', solid: true, wall: true, mini: '#a89c84', fuel: 22, flam: 0.3, burnsTo: 'rubble' },
  { name: 'citywall', tex: 'citywall', solid: true, mini: '#3f3c38' },
  { name: 'bridge', tex: 'bridge', mini: '#9a6a3a', fuel: 26, flam: 0.4, burnsTo: 'water' },
  { name: 'dock', tex: 'dock', mini: '#8a6338', fuel: 26, flam: 0.4, burnsTo: 'water' },
  { name: 'cliff', tex: 'cliff', solid: true, mini: '#5a564e' },
  { name: 'ash', tex: 'ash', mini: '#3d3538' },
  { name: 'darkstone', tex: 'darkstone', mini: '#2e2a2d' },
  { name: 'darksand', tex: 'darksand', mini: '#7d705c' },
  { name: 'fence', tex: 'fence', over: 'grass', solid: true, mini: '#6b4423', fuel: 12, flam: 0.7, burnsTo: 'burnt_grass', breakTo: 'grass', breakHp: 12 },
  { name: 'hedge', tex: 'hedge', over: 'grass', solid: true, mini: '#2f6e2e', fuel: 14, flam: 0.5, burnsTo: 'burnt_grass', breakTo: 'grass', breakHp: 20 },
  { name: 'door', tex: 'door', mini: '#7f5229', fuel: 16, flam: 0.6, burnsTo: 'burnt_floor' },
  { name: 'wall_dark', tex: 'wall_dark', solid: true, wall: true, mini: '#1c191b' },
  { name: 'cabbage', tex: 'cabbage', mini: '#5aa048', fuel: 8, flam: 0.4, burnsTo: 'field_burnt' },
  { name: 'fence_dark', tex: 'fence', over: 'darkgrass', solid: true, mini: '#6b4423', fuel: 12, flam: 0.7, burnsTo: 'burnt_grass', breakTo: 'darkgrass', breakHp: 12 },
  // ---- burnt / ruined states ----
  { name: 'burnt_grass', tex: 'burnt_grass', mini: '#2e2a24', regrow: 3 },
  { name: 'burnt_floor', tex: 'burnt_floor', mini: '#2a201a' },
  { name: 'ruin_wood', tex: 'ruin_wood', mini: '#26201a' },
  { name: 'rubble', tex: 'rubble', mini: '#4a4640' },
  { name: 'field_burnt', tex: 'field_burnt', mini: '#2e241c', regrow: 4 },
  // ---- modern city ----
  { name: 'asphalt', tex: 'asphalt', mini: '#3e3e44' },
  { name: 'road_line', tex: 'road_line', mini: '#3e3e44' },          // horizontal road, dashed center line on the top edge
  { name: 'road_line_v', tex: 'road_line_v', mini: '#3e3e44' },      // vertical road, dashed center line on the left edge
  { name: 'sidewalk', tex: 'sidewalk', mini: '#9a968e' },
  { name: 'concrete', tex: 'concrete', mini: '#8a8780' },
  { name: 'tilefloor', tex: 'tilefloor', mini: '#c8c4b8' },
  { name: 'wall_brick', tex: 'wall_brick', solid: true, wall: true, mini: '#7a3a2a' },
  { name: 'wall_concrete', tex: 'wall_concrete', solid: true, wall: true, mini: '#7a7a80' },
  { name: 'wall_siding', tex: 'wall_siding', solid: true, wall: true, mini: '#c8c0a8', fuel: 30, flam: 0.5, burnsTo: 'ruin_wood' },
  { name: 'wall_marble', tex: 'wall_marble', solid: true, wall: true, mini: '#e8e4dc' },
  { name: 'chainlink', tex: 'chainlink', over: 'concrete', solid: true, mini: '#8a8e96', breakTo: 'concrete', breakHp: 25 },
  { name: 'ironfence', tex: 'ironfence', over: 'grass', solid: true, mini: '#2a2a30' },
  { name: 'pool', tex: 'pool', solid: true, anim: true, water: true, mini: '#4ab0e0' },
  { name: 'lot', tex: 'lot', mini: '#6a665e' },                      // cracked, littered vacant lot
  { name: 'court', tex: 'court', mini: '#a0603a' },                  // basketball court
];

// name -> id lookup:  G.T.grass === 1
G.T = {};
G.TILES.forEach((t, i) => { G.T[t.name] = i; });

// Decoration definitions: sprite + collision footprint (in tiles, anchored at the sprite's base tile)
//   solid: blocks movement      fw/fh: footprint width/height in tiles
//   light: emits light at night { r: radius px, color }      flat: drawn into the ground layer (not y-sorted)
//   fuel/flam: fire (see tiles above)      burnsTo: decor left behind once burnt (null = nothing)
//   breakHp: can be smashed by melee      chop: needs an axe (trees)      drops: [[item, min, max, chance]]
const WOOD = { fuel: 14, flam: 0.6 };
const TREE = { fuel: 30, flam: 0.45, burnsTo: 'burnt_tree', chop: true, breakHp: 30, breakTo: 'stump', drops: [['wood', 2, 3, 1]] };
G.DECOR = {
  oak0: Object.assign({ sprite: 'oak0', solid: true }, TREE), oak1: Object.assign({ sprite: 'oak1', solid: true }, TREE),
  oak2: Object.assign({ sprite: 'oak2', solid: true }, TREE),
  pine0: Object.assign({ sprite: 'pine0', solid: true }, TREE), pine1: Object.assign({ sprite: 'pine1', solid: true }, TREE),
  deadtree: { sprite: 'deadtree', solid: true, fuel: 20, flam: 0.6, burnsTo: 'burnt_tree', chop: true, breakHp: 15, breakTo: 'stump', drops: [['wood', 1, 2, 1]] },
  burnt_tree: { sprite: 'burnt_tree', solid: true, chop: true, breakHp: 10, drops: [['wood', 1, 1, 0.5]] },
  bush: { sprite: 'bush', solid: true, fuel: 8, flam: 0.7, breakHp: 6 },
  berrybush: { sprite: 'berrybush', solid: true, interact: 'forage', forage: 'apple', fuel: 8, flam: 0.7, breakHp: 6 },
  rock: { sprite: 'rock', solid: true },
  boulder: { sprite: 'boulder', solid: true, fw: 2 },
  stump: Object.assign({ sprite: 'stump', solid: true, chop: true, breakHp: 10, drops: [['wood', 1, 1, 1]] }, WOOD),
  log: Object.assign({ sprite: 'log', solid: true, fw: 2, chop: true, breakHp: 12, drops: [['wood', 2, 2, 1]] }, WOOD),
  barrel: Object.assign({ sprite: 'barrel', solid: true, breakHp: 8, drops: [['ale', 1, 1, 0.3], ['apple', 1, 2, 0.3]], owned: true }, WOOD),
  crate: Object.assign({ sprite: 'crate', solid: true, breakHp: 8, drops: [['bread', 1, 1, 0.3], ['wood', 1, 1, 0.5], ['torch', 1, 1, 0.15]], owned: true }, WOOD),
  well: { sprite: 'well', solid: true, interact: 'well' },
  lamp: { sprite: 'lamp', solid: true, light: { r: 56, color: '255,210,130' } },
  darklamp: { sprite: 'darklamp', solid: true, light: { r: 50, color: '255,80,50' } },
  stall_red: Object.assign({ sprite: 'stall_red', solid: true, fw: 2, breakHp: 20, owned: true }, WOOD),
  stall_blue: Object.assign({ sprite: 'stall_blue', solid: true, fw: 2, breakHp: 20, owned: true }, WOOD),
  stall_green: Object.assign({ sprite: 'stall_green', solid: true, fw: 2, breakHp: 20, owned: true }, WOOD),
  sign: Object.assign({ sprite: 'sign', solid: true, interact: 'sign', breakHp: 8 }, WOOD),
  bed: Object.assign({ sprite: 'bed', solid: false, interact: 'bed' }, WOOD),
  bed_red: Object.assign({ sprite: 'bed_red', solid: false, interact: 'bed' }, WOOD),
  bed_green: Object.assign({ sprite: 'bed_green', solid: false, interact: 'bed' }, WOOD),
  table: Object.assign({ sprite: 'table', solid: true, fw: 2, breakHp: 12, owned: true }, WOOD),
  chair: Object.assign({ sprite: 'chair', solid: false, breakHp: 5, owned: true }, WOOD),
  counter: Object.assign({ sprite: 'counter', solid: true, fw: 2 }, WOOD),
  shelf: Object.assign({ sprite: 'shelf', solid: true }, WOOD),
  anvil: { sprite: 'anvil', solid: true },
  forge: { sprite: 'forge', solid: true, fw: 2, light: { r: 40, color: '255,140,60' } },
  haybale: { sprite: 'haybale', solid: true, fuel: 18, flam: 0.95, breakHp: 6 },
  grave: { sprite: 'grave', solid: true },
  campfire: { sprite: 'campfire', solid: true, light: { r: 70, color: '255,150,60' }, flicker: true },
  fountain: { sprite: 'fountain', solid: true, fw: 3, fh: 2, interact: 'well' },
  statue: { sprite: 'statue', solid: true },
  tent: { sprite: 'tent', solid: true, fw: 2, fuel: 14, flam: 0.8 },
  altar: { sprite: 'altar', solid: true, fw: 2, interact: 'altar' },
  pew: Object.assign({ sprite: 'pew', solid: true, fw: 2 }, WOOD),
  cart: Object.assign({ sprite: 'cart', solid: true, fw: 2, breakHp: 20, owned: true }, WOOD),
  boat: { sprite: 'boat', solid: true, fw: 3, interact: 'boat' },
  banner: { sprite: 'banner', solid: true, fuel: 8, flam: 0.8 },
  skulls: { sprite: 'skulls', solid: false, flat: true },
  flowers: { sprite: 'flowers', flat: true },
  tuft: { sprite: 'tuft', flat: true },
  mushroom: { sprite: 'mushroom', flat: true, interact: 'forage', forage: 'mushroom' },
  chanterelle: { sprite: 'chanterelle', flat: true, interact: 'forage', forage: 'chanterelle' },
  death_cap: { sprite: 'death_cap', flat: true, interact: 'forage', forage: 'death_cap' },
  fly_agaric: { sprite: 'fly_agaric', flat: true, interact: 'forage', forage: 'fly_agaric' },
  magic_mushroom: { sprite: 'magic_mushroom', flat: true, interact: 'forage', forage: 'magic_mushroom' },
  pebbles: { sprite: 'pebbles', flat: true },
  // ---- modern props ----
  car_red: { sprite: 'car_red', solid: true, fw: 2, breakHp: 60, drops: [['iron_ore', 1, 2, 1]] },
  car_blue: { sprite: 'car_blue', solid: true, fw: 2, breakHp: 60, drops: [['iron_ore', 1, 2, 1]] },
  car_white: { sprite: 'car_white', solid: true, fw: 2, breakHp: 60, drops: [['iron_ore', 1, 2, 1]] },
  car_black: { sprite: 'car_black', solid: true, fw: 2, breakHp: 60, drops: [['iron_ore', 1, 2, 1]] },
  car_gray: { sprite: 'car_gray', solid: true, fw: 2, breakHp: 60, drops: [['iron_ore', 1, 2, 1]] },
  car_wreck: { sprite: 'car_wreck', solid: true, fw: 2 },
  police_car: { sprite: 'police_car', solid: true, fw: 2 },
  limo: { sprite: 'limo', solid: true, fw: 3 },
  dumpster: { sprite: 'dumpster', solid: true, fw: 2, breakHp: 30, drops: [['canned_beans', 1, 1, 0.3], ['iron_ore', 1, 1, 0.3], ['smartphone', 1, 1, 0.05]] },
  trashcan: { sprite: 'trashcan', solid: true, breakHp: 6, drops: [['chips', 1, 1, 0.2], ['soda', 1, 1, 0.2]] },
  bench: { sprite: 'bench', solid: true, fw: 2, breakHp: 15 },
  hydrant: { sprite: 'hydrant', solid: true },
  mailbox: { sprite: 'mailbox', solid: true, breakHp: 6, drops: [['letter', 1, 1, 0]] },
  vending: { sprite: 'vending', solid: true, breakHp: 25, drops: [['soda', 1, 2, 1], ['chips', 1, 2, 0.5]], owned: true },
  fridge: { sprite: 'fridge', solid: true, breakHp: 20, drops: [['sandwich', 1, 1, 0.5], ['beer', 1, 2, 0.5], ['milk', 1, 1, 0.3]], owned: true },
  couch: { sprite: 'couch', solid: true, fw: 2, fuel: 16, flam: 0.7, breakHp: 15 },
  tv: { sprite: 'tv', solid: true, breakHp: 8, owned: true },
  desk: { sprite: 'desk', solid: true, fw: 2, fuel: 12, flam: 0.5, breakHp: 15, owned: true },
  toolbench: { sprite: 'toolbench', solid: true, fw: 2 },
  plant: { sprite: 'plant', solid: true, breakHp: 4 },
  trash: { sprite: 'trash', flat: true },
  manhole: { sprite: 'manhole', flat: true },
  gas_pump: { sprite: 'gas_pump', solid: true, breakHp: 40 },
  crib: { sprite: 'crib', solid: true, interact: 'crib' },                      // a baby lives here (js/game/love.js)
  trough: { sprite: 'trough', solid: true, fw: 2, interact: 'well' },          // animals (and thirsty people) drink here
  // jail
  loose_tile: { sprite: 'loose_tile', flat: true, interact: 'dig' },
  serving: { sprite: 'counter', solid: true, fw: 2, interact: 'spoon' },
  laundry_cart: { sprite: 'laundry_cart', solid: true, interact: 'laundry' },
  security_door: { sprite: 'security_door', solid: true, fw: 2, interact: 'gate' },
};

// Everyday objects you can use (see js/game/usables.js).
const USES = {
  tv: 'tv', couch: 'sit', bench: 'sit', chair: 'sit', pew: 'sit', vending: 'vending', desk: 'computer', shelf: 'read',
  trashcan: 'trash', dumpster: 'dumpster', mailbox: 'mail', gas_pump: 'gas', campfire: 'campfire', grave: 'grave',
  toolbench: 'workbench', fridge: 'fridge', statue: 'look', plant: 'look', hydrant: 'look', haybale: 'look',
  crate: 'search', barrel: 'search', car_red: 'car', car_blue: 'car', car_white: 'car', car_black: 'car', car_gray: 'car',
  car_wreck: 'car', limo: 'car', police_car: 'car', counter: 'look', table: 'look',
};
for (const k in USES) if (G.DECOR[k] && !G.DECOR[k].interact) G.DECOR[k].interact = USES[k];
