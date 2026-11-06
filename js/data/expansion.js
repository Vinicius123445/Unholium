'use strict';
// The world, expanded: two new areas that make the map hang together.
//   PORT & INDUSTRIAL DISTRICT (south of Southside, on the water): warehouses, a factory, a truck yard,
//     a scrapyard behind chain-link, container stacks, piers on the bay, the dock workers' bar and a
//     night watchman. The road south from Southside runs straight into it.
//   FARMLAND (south of the Rural Zone): farms with barns and fields, pastures with cows, a crossroads
//     village (diner, gas station, chapel, houses), a lake with a beach and a campground.
// Everyone here is a placeholder role (Dock Worker, Farmer...); names and lore stay the player's to give.
(() => {
const T = G.T;
// schedules (same shapes as js/data/npcs.js)
const S2 = {
  worker: (work, home, o = {}) => [
    { from: o.wake ?? 6, to: o.start ?? 8, at: home + '_in', act: 'idle' },
    { from: o.start ?? 8, to: o.end ?? 18, at: work, act: o.workAct || 'work' },
    { from: o.end ?? 18, to: o.sleep ?? 22, at: o.evening || home + '_door', act: 'wander' },
    { from: o.sleep ?? 22, to: o.wake ?? 6, at: o.bed || home + '_bed', act: 'sleep' },
  ],
  idler: (area, home, o = {}) => [
    { from: 7, to: o.end ?? 20, at: area, act: 'wander' },
    { from: o.end ?? 20, to: 22, at: home + '_in', act: 'idle' },
    { from: 22, to: 7, at: o.bed || home + '_bed', act: 'sleep' },
  ],
};
const npc = (id, o) => { G.NPCS[id] = Object.assign({ faction: 'civilians', hp: 28, combat: 'flee', gold: 12, relations: {} }, o, { look: o.look || G.look(id, o.lookO || {}) }); };

// ---------------------------------------------------------------- PORT & INDUSTRIAL DISTRICT
G.MAPGEN.industrial = () => {
  const m = new G.TileMap('industrial', 112, 80, T.concrete);
  m.meta = { name: 'Port District', region: 'city', music: 'city', darkness: 0.06, district: 'industrial' };
  const r = new G.RNG('industrial');
  // the bay on the east side, with piers
  m.fill(92, 0, 20, 80, T.water); m.fill(100, 0, 12, 80, T.deepwater);
  for (const py of [10, 30, 52]) m.fill(86, py, 18, 4, T.dock);
  m.fill(86, 0, 6, 80, T.concrete);
  const roads = [{ h: false, at: 46, from: 0, to: 79 }, { h: true, at: 22, from: 0, to: 85 }, { h: true, at: 58, from: 0, to: 85 }];
  D.roads(m, roads);
  const B = (id, x, y, w, h, opt, kind, fo) => { const b = m.addBuilding(id, x, y, w, h, Object.assign({ wall: 'wall_concrete', floor: 'concrete', roof: r.pick(['flat', 'flat_dark']) }, opt)); MB.furnish(m, b, kind, r, fo || {}); return b; };
  B('i_ware1', 3, 3, 20, 12, { name: 'Warehouse' }, 'garage', { owner: 'i_foreman', car: 'car_gray' });
  B('i_ware2', 25, 3, 18, 12, { name: 'Warehouse' }, 'garage', { owner: 'i_worker2' });
  B('i_factory', 52, 3, 30, 14, { name: 'Factory', wall: 'wall_brick', roof: 'flat_brick' }, 'garage', { owner: 'i_foreman' });
  B('i_bar', 3, 30, 12, 8, { name: 'Bar', wall: 'wall_brick', floor: 'woodfloor' }, 'shop', { owner: 'i_barkeep' });
  B('i_flats', 18, 29, 14, 10, { name: 'Workers\' Flats', wall: 'wall_brick', floor: 'woodfloor' }, 'house', { owner: 'i_worker1', beds: 3 });
  B('i_office', 52, 30, 12, 8, { name: 'Port Office', floor: 'tilefloor' }, 'house', { owner: 'i_watch', beds: 1 });
  B('i_ware3', 66, 29, 16, 11, { name: 'Cold Storage' }, 'garage', { owner: 'i_worker3' });
  B('i_flats2', 3, 64, 14, 10, { name: 'Workers\' Flats', wall: 'wall_brick', floor: 'woodfloor' }, 'house', { owner: 'i_worker2', beds: 3 });
  // the truck yard and the scrapyard
  m.fill(52, 64, 30, 14, T.lot); MB.rectFence(m, 52, 64, 81, 77, T.chainlink, [[66, 64], [67, 64]]); m.markOccupied(65, 62, 4, 2);
  for (let i = 0; i < 6; i++) D.put(m, r.pick(['car_wreck', 'car_wreck', 'car_gray']), 54 + i * 4, 67 + (i % 2) * 5, [T.lot]);
  MB.scatter(m, r, ['trash', 'rubble'], 12, 53, 65, 80, 76, [T.lot]);
  m.fill(20, 64, 24, 14, T.concrete);
  for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) D.put(m, 'crate', 22 + i * 4, 66 + k * 5, [T.concrete]);   // container stacks
  D.lamps(m, roads, 10);
  D.park(m, r, roads, 7, ['car_gray', 'car_black', 'car_white']);
  MB.scatter(m, r, ['trash', 'manhole', 'dumpster', 'hydrant', 'trashcan'], 40, 0, 0, 85, 79, [T.sidewalk, T.concrete]);
  for (const py of [10, 30, 52]) { D.put(m, 'lamp', 90, py - 1, [T.concrete]); D.put(m, 'crate', 95, py + 1, [T.dock]); }
  m.points.i_dock = { x: 96, y: 32 }; m.points.i_dock2 = { x: 92, y: 12 }; m.points.i_yard = { x: 66, y: 70 };
  m.points.i_line = { x: 66, y: 10 }; m.points.i_loading = { x: 33, y: 17 }; m.points.i_patrol = [{ x: 48, y: 20 }, { x: 70, y: 56 }, { x: 88, y: 32 }, { x: 30, y: 56 }];
  m.points.from_southside = { x: 47, y: 1 };
  m.addExit(46, 0, 4, 1, 'southside', 'from_industrial', 'To Southside');
  m.dangerZones = [];
  m.finalize();
  return m;
};
// Southside's road now leads south to the port
const _south = G.MAPGEN.southside;
G.MAPGEN.southside = () => { const m = _south(); m.points.from_industrial = { x: 47, y: 69 }; m.addExit(46, 71, 4, 1, 'industrial', 'from_southside', 'To Port District'); return m; };

npc('i_foreman', { name: 'Foreman', map: 'industrial', hp: 40, combat: 'fight', lookO: { body: 'm', top: 'vest', shirt: '#e8a020', hat: 'helmet', hatColor: '#f0d020' }, home: 'i_flats', schedule: S2.worker('i_line', 'i_flats', { start: 6, end: 17 }), job: 'Shifts start at six. Late is fired.' });
npc('i_worker1', { name: 'Dock Worker', map: 'industrial', hp: 34, combat: 'fight', lookO: { top: 'tshirt', shirt: '#3a4a6a', hat: 'beanie', hatColor: '#3a3a40' }, home: 'i_flats', schedule: S2.worker('i_dock', 'i_flats', { start: 6, end: 16, evening: 'i_bar_door' }) });
npc('i_worker2', { name: 'Dock Worker', map: 'industrial', hp: 34, combat: 'fight', lookO: { top: 'tank', shirt: '#e8e4dc' }, home: 'i_flats2', schedule: S2.worker('i_dock2', 'i_flats2', { start: 7, end: 17, evening: 'i_bar_door' }) });
npc('i_worker3', { name: 'Forklift Driver', map: 'industrial', lookO: { top: 'vest', shirt: '#e8a020' }, home: 'i_flats2', schedule: S2.worker('i_loading', 'i_flats2', { start: 8, end: 18 }) });
npc('i_worker4', { name: 'Factory Hand', map: 'industrial', lookO: { top: 'longsleeve', shirt: '#5a5a62' }, home: 'i_flats', schedule: S2.worker('i_line', 'i_flats', { start: 9, end: 19 }) });
npc('i_scrapper', { name: 'Scrap Dealer', map: 'industrial', hp: 36, combat: 'fight', lookO: { top: 'jacket', shirt: '#4a3a2a', facial: 1 }, home: 'i_flats2', schedule: S2.worker('i_yard', 'i_flats2', { start: 9, end: 20 }), gold: 90 });
npc('i_barkeep', { name: 'Bartender', map: 'industrial', home: 'i_bar', shop: 'i_bar', gold: 140, lookO: { top: 'shirt' }, schedule: S2.worker('i_bar_work', 'i_bar', { start: 15, end: 2, sleep: 2, wake: 11 }) });
npc('i_watch', { name: 'Night Watchman', map: 'industrial', faction: 'government', hp: 60, combat: 'guard', weapon: 'pistol', lookO: { top: 'shirt', shirt: '#2a3a5a', hat: 'cap', hatColor: '#1e2a4a' }, home: 'i_office',
  schedule: [{ from: 20, to: 6, at: 'i_patrol', act: 'patrol' }, { from: 6, to: 14, at: 'i_office_bed', act: 'sleep' }, { from: 14, to: 20, at: 'i_office_in', act: 'idle' }] });
npc('i_res1', { name: 'Resident', map: 'industrial', home: 'i_flats', schedule: S2.idler('i_bar_door', 'i_flats') });
npc('i_res2', { name: 'Resident', map: 'industrial', home: 'i_flats2', schedule: S2.idler('i_dock', 'i_flats2') });
G.SHOPS.i_bar = { name: 'Bar', owner: 'i_barkeep', region: 'city', gold: 160, buyMult: 1.05, sellMult: 0.4, buys: ['consumable'], stock: [['beer', 16], ['whiskey', 5], ['vodka', 4], ['cigarettes', 8], ['chips', 6], ['sandwich', 4]] };

// ---------------------------------------------------------------- FARMLAND
G.MAPGEN.farmland = () => {
  const m = new G.TileMap('farmland', 128, 96, T.grass);
  m.meta = { name: 'Farmland', region: 'rural', music: 'rural', darkness: 0, district: 'farmland' };
  const r = new G.RNG('farmland');
  // country roads: dirt paths crossing at the village
  m.fill(62, 0, 3, 96, T.path); m.fill(0, 46, 128, 3, T.path);
  // the lake, with a beach, a dock and a campground
  for (let y = 60; y < 90; y++) for (let x = 84; x < 124; x++) { const dx = (x - 104) / 19, dy = (y - 75) / 14; const d = dx * dx + dy * dy; if (d < 1) m.set(x, y, d < 0.45 ? T.deepwater : T.water); else if (d < 1.25) m.set(x, y, T.sand); }
  m.fill(84, 72, 6, 2, T.dock);
  // farms: farmhouse, barn, fields, a pasture
  const B = (id, x, y, w, h, opt, kind, fo) => { const b = m.addBuilding(id, x, y, w, h, Object.assign({ wall: 'wall_wood', floor: 'woodfloor', roof: r.pick(['red', 'brown']) }, opt)); MB.furnish(m, b, kind, r, fo || {}); return b; };
  B('f_farm1', 6, 6, 11, 8, { name: 'Farmhouse' }, 'house', { owner: 'f_farmer1', beds: 2 });
  B('f_barn1', 20, 5, 12, 9, { name: 'Barn', roof: 'red' }, 'garage', { owner: 'f_farmer1' });
  m.fill(6, 18, 26, 12, T.field); for (let y = 19; y < 29; y += 2) for (let x = 7; x < 31; x++) m.set(x, y, r.chance(0.5) ? T.wheat : T.cabbage);
  B('f_farm2', 92, 6, 11, 8, { name: 'Farmhouse' }, 'house', { owner: 'f_farmer2', beds: 2 });
  B('f_barn2', 106, 5, 13, 9, { name: 'Barn', roof: 'brown' }, 'garage', { owner: 'f_farmer2' });
  MB.rectFence(m, 90, 18, 122, 38, T.fence, [[106, 18], [107, 18]]); m.markOccupied(105, 16, 4, 2);
  D.put(m, 'trough', 100, 24, [T.grass]); D.put(m, 'haybale', 112, 30, [T.grass]); D.put(m, 'haybale', 96, 34, [T.grass]);
  m.animalZones.push({ kind: 'cow', x: 92, y: 20, w: 28, h: 16, max: 5, owner: 'f_farmer2', region: 'rural' }, { kind: 'chicken', x: 8, y: 14, w: 10, h: 3, max: 6, owner: 'f_farmer1', region: 'rural' });
  // the village at the crossroads
  const V = (id, x, y, w, h, opt, kind, fo) => { const b = m.addBuilding(id, x, y, w, h, Object.assign({ wall: r.pick(['wall_siding', 'wall_plaster']), floor: 'woodfloor', roof: r.pick(['red', 'blue', 'slate']) }, opt)); MB.furnish(m, b, kind, r, fo || {}); return b; };
  V('f_diner', 48, 36, 12, 8, { name: 'Diner', roof: 'flat' }, 'shop', { owner: 'f_cook' });
  V('f_gas', 68, 36, 10, 8, { name: 'Gas Station', wall: 'wall_concrete', floor: 'tilefloor', roof: 'flat' }, 'shop', { owner: 'f_clerk' });
  V('f_chapel', 48, 52, 10, 9, { name: 'Chapel', wall: 'wall_plaster', floor: 'stonefloor', roof: 'slate' }, 'house', { owner: 'f_pastor', beds: 1 });
  V('f_house1', 68, 52, 9, 7, { name: 'House' }, 'house', { owner: 'f_res1', beds: 2 });
  V('f_house2', 36, 52, 9, 7, { name: 'House' }, 'house', { owner: 'f_res2', beds: 2 });
  V('f_house3', 80, 52, 9, 7, { name: 'House' }, 'house', { owner: 'f_res3', beds: 1 });
  D.put(m, 'gas_pump', 70, 45, [T.path, T.grass]); D.put(m, 'gas_pump', 75, 45, [T.path, T.grass]);
  for (const [x, y] of [[60, 44], [66, 44], [60, 50], [66, 50], [46, 44], [80, 44]]) D.put(m, 'lamp', x, y, [T.grass, T.path]);
  // the campground by the lake
  for (const [x, y] of [[88, 64], [94, 62], [86, 84]]) D.put(m, 'campfire', x, y, [T.grass, T.sand]);
  D.put(m, 'bench', 90, 66, [T.grass, T.sand]); D.put(m, 'bench', 96, 64, [T.grass, T.sand]);
  // woods along the edges
  MB.scatter(m, r, ['oak0', 'oak1', 'oak2', 'pine0', 'bush', 'bush'], 140, 0, 0, 127, 95, [T.grass], 2);
  MB.scatter(m, r, ['flowers', 'tuft', 'rock'], 60, 0, 0, 127, 95, [T.grass], 1);
  m.animalZones.push({ kind: 'deer', x: 4, y: 64, w: 30, h: 28, max: 3, region: 'rural' }, { kind: 'rabbit', x: 30, y: 60, w: 40, h: 30, max: 4, region: 'rural' });
  m.points.f_field = { x: 18, y: 22 }; m.points.f_pasture = { x: 104, y: 28 }; m.points.f_village = { x: 63, y: 47 }; m.points.f_lake = { x: 82, y: 75 }; m.points.f_camp = { x: 92, y: 64 };
  m.points.from_rural = { x: 63, y: 1 };
  m.addExit(62, 0, 3, 1, 'rural', 'from_farmland', 'To Rural Zone');
  m.meta.shelter = 'f_chapel_in';
  m.dangerZones = [];
  m.finalize();
  return m;
};
// the Rural Zone gets a country path south to the farmland
const _rural = G.MAPGEN.rural;
G.MAPGEN.rural = () => {
  const m = _rural();
  // the clearest column from the middle of the map down to the bottom edge
  let best = 80, bestBad = 1e9;
  for (let x = 60; x < 120; x++) {
    let bad = 0;
    for (let y = 70; y < m.h; y++) { const d = G.TILES[m.get(x, y)]; if (!d || d.solid || d.water || d.wall) bad += 5; if (m.decorsAt(x, y).length) bad++; if (m.buildingAtTile && m.buildingAtTile(x, y)) bad += 10; }
    if (bad < bestBad) { bestBad = bad; best = x; }
  }
  for (let y = 70; y < m.h; y++) for (let x = best; x < best + 2; x++) {
    const d = G.TILES[m.get(x, y)];
    if (d && !d.wall && !(m.buildingAtTile && m.buildingAtTile(x, y))) { for (const dc of m.decorsAt(x, y).slice()) m.removeDecorRuntime ? m.removeDecorRuntime(dc, false) : null; if (!d.water || y > m.h - 4) m.set(x, y, T.path); }
  }
  m.computeSolids(); m.prerender();
  m.points.from_farmland = { x: best, y: m.h - 2 };
  m.addExit(best, m.h - 1, 2, 1, 'farmland', 'from_rural', 'To Farmland');
  return m;
};

npc('f_farmer1', { name: 'Farmer', map: 'farmland', hp: 34, combat: 'fight', weapon: 'shotgun', lookO: { body: 'm', top: 'longsleeve', shirt: '#6a4a2a', hat: 'straw' }, home: 'f_farm1', schedule: S2.worker('f_field', 'f_farm1', { wake: 5, start: 6, end: 18, sleep: 21 }) });
npc('f_farmwife1', { name: 'Farmer', map: 'farmland', lookO: { body: 'f', top: 'dress', shirt: '#8a6a9a' }, home: 'f_farm1', schedule: S2.worker('f_farm1_in', 'f_farm1', { wake: 5, start: 6, end: 18, sleep: 21, bed: 'f_farm1_bed2' }), relations: { f_farmer1: 'spouse' } });
G.NPCS.f_farmer1.relations = { f_farmwife1: 'spouse' };
npc('f_farmer2', { name: 'Rancher', map: 'farmland', hp: 36, combat: 'fight', weapon: 'hunting_rifle', lookO: { body: 'm', top: 'jacket', shirt: '#4a3a2a', hat: 'cap', facial: 1 }, home: 'f_farm2', schedule: S2.worker('f_pasture', 'f_farm2', { wake: 5, start: 6, end: 19 }) });
npc('f_cook', { name: 'Diner Cook', map: 'farmland', home: 'f_diner', shop: 'f_diner', gold: 120, lookO: { top: 'tshirt', shirt: '#f0f0f0', apron: '#e8e4dc' }, schedule: S2.worker('f_diner_work', 'f_diner', { start: 7, end: 20 }) });
npc('f_clerk', { name: 'Gas Station Clerk', map: 'farmland', home: 'f_gas', shop: 'f_gas', gold: 140, lookO: { top: 'shirt', shirt: '#c83a2a', hat: 'cap', hatColor: '#c83a2a' }, schedule: S2.worker('f_gas_work', 'f_gas', { start: 6, end: 22, sleep: 23 }) });
npc('f_pastor', { name: 'Pastor', map: 'farmland', lookO: { body: 'm', top: 'suit', shirt: '#1a1a1e', hair: '#c8c8c8' }, home: 'f_chapel', schedule: S2.worker('f_chapel_in', 'f_chapel', { start: 8, end: 18, evening: 'f_village' }) });
npc('f_res1', { name: 'Villager', map: 'farmland', home: 'f_house1', schedule: S2.idler('f_village', 'f_house1') });
npc('f_res2', { name: 'Villager', map: 'farmland', home: 'f_house2', schedule: S2.idler('f_lake', 'f_house2') });
npc('f_res3', { name: 'Old Fisherman', map: 'farmland', lookO: { body: 'm', hair: '#c8c8c8', top: 'vest', hat: 'straw' }, home: 'f_house3', schedule: S2.idler('f_lake', 'f_house3', { end: 19 }) });
npc('f_camper', { name: 'Camper', map: 'farmland', lookO: { top: 'hoodie', shirt: '#3a6a4a' }, home: 'f_house3', schedule: [{ from: 0, to: 24, at: 'f_camp', act: 'wander' }] });
G.SHOPS.f_diner = { name: 'Diner', owner: 'f_cook', region: 'rural', gold: 180, buyMult: 1.0, sellMult: 0.4, buys: ['consumable'], stock: [['sandwich', 8], ['cooked_meat', 6], ['coffee', 8], ['soda', 8], ['bread', 4], ['apple', 6], ['milk', 4]] };
G.SHOPS.f_gas = { name: 'Gas Station', owner: 'f_clerk', region: 'rural', gold: 220, buyMult: 1.1, sellMult: 0.4, buys: ['consumable', 'misc'], stock: [['soda', 10], ['chips', 10], ['cigarettes', 10], ['beer', 8], ['energy_drink', 6], ['flashlight', 2], ['bandage', 4], ['canned_beans', 6]] };

// old saves: the new shops and wildlife appear (the new people come through World.migrate)
G.NEW_WILD_MAPS = (G.NEW_WILD_MAPS || []).concat(['farmland']);
const _onLoad = G.onWorldLoaded;
G.onWorldLoaded = function (w) {
  if (_onLoad) _onLoad.apply(this, arguments);
  w.shops = w.shops || {};
  for (const id of ['i_bar', 'f_diner', 'f_gas']) if (!w.shops[id]) w.shops[id] = { stock: G.util.clone(G.SHOPS[id].stock), gold: G.SHOPS[id].gold, owner: G.SHOPS[id].owner };
};
})();
