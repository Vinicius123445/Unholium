'use strict';
// The city: five district maps, all in the 'city' region (shared bounty and reputation).
//   city      — Center: downtown, police, City Hall, shops, the harbor (boat to the island)
//   southside — Red Gang neighborhood        eastside — Blue Gang neighborhood (docks)
//   suburbs   — classic suburban streets     heights  — the Rich District, home of the Elite
// Gang territories (the blocks the gangs fight over) are defined in js/data/territories.js.

const D = {
  // Streets 4 tiles wide with a dashed center line and a sidewalk on each side.
  //   { h: true, at: y, from: x0, to: x1 }  or  { h: false, at: x, from: y0, to: y1 }
  roads(m, list) {
    const rect = (r) => (r.h ? { x: r.from, y: r.at, w: r.to - r.from + 1, h: 4 } : { x: r.at, y: r.from, w: 4, h: r.to - r.from + 1 });
    for (const r of list) {
      const q = rect(r);
      if (r.h) { m.fill(q.x, q.y - 1, q.w, 1, G.T.sidewalk); m.fill(q.x, q.y + 4, q.w, 1, G.T.sidewalk); }
      else { m.fill(q.x - 1, q.y, 1, q.h, G.T.sidewalk); m.fill(q.x + 4, q.y, 1, q.h, G.T.sidewalk); }
    }
    for (const r of list) { const q = rect(r); m.fill(q.x, q.y, q.w, q.h, G.T.asphalt); }
    const crossing = (r, k) => list.some((o) => o !== r && o.h !== r.h && k >= o.at - 1 && k <= o.at + 4 && (r.at >= o.from - 1 && r.at <= o.to + 1));
    for (const r of list) {
      const q = rect(r);
      if (r.h) { for (let x = q.x; x < q.x + q.w; x++) if (!crossing(r, x)) m.set(x, q.y + 2, G.T.road_line); }
      else for (let y = q.y; y < q.y + q.h; y++) if (!crossing(r, y)) m.set(q.x + 2, y, G.T.road_line_v);
    }
  },
  // Street lamps along the sidewalks of a road list.
  lamps(m, list, every = 9) {
    for (const r of list) {
      for (let k = r.from + 3; k <= r.to - 2; k += every) {
        const spots = r.h ? [[k, r.at - 1], [k + 4, r.at + 4]] : [[r.at - 1, k], [r.at + 4, k + 4]];
        for (const [x, y] of spots) if (m.inBounds(x, y) && m.get(x, y) === G.T.sidewalk && m.isFree(x, y, 1, 1, [G.T.sidewalk])) m.addDecor('lamp', x, y);
      }
    }
  },
  // Parked cars: only in the curb lanes of horizontal streets, never mid-road.
  park(m, r, list, n, kinds = D.CARS) {
    const lanes = list.filter((q) => q.h);
    for (let i = 0, placed = 0; i < n * 20 && placed < n && lanes.length; i++) {
      const q = r.pick(lanes), y = r.chance(0.5) ? q.at : q.at + 3, x = r.int(q.from + 2, q.to - 3);
      const side = y === q.at ? y - 1 : y + 1;   // the sidewalk next to the parking lane (not an intersection)
      if (m.get(x, side) !== G.T.sidewalk || m.get(x + 1, side) !== G.T.sidewalk) continue;
      if (D.put(m, r.pick(kinds), x, y, [G.T.asphalt, G.T.road_line])) placed++;
    }
  },
  // Place decor only where the tile is free.
  put(m, type, x, y, allowed) {
    const fw = G.DECOR[type].fw || 1;
    if (!m.isFree(x, y, fw, 1, allowed)) return false;
    m.addDecor(type, x, y);
    if (!G.DECOR[type].flat) m.markOccupied(x, y, fw, 1);
    return true;
  },
  CARS: ['car_red', 'car_blue', 'car_white', 'car_black', 'car_gray'],
};
G.DISTRICTS = D;
const ANY = null;   // any ground tile counts as free for D.put

// ---------------------------------------------------------------- CENTER
G.MAPGEN.city = () => {
  const m = new G.TileMap('city', 112, 92, G.T.sidewalk);
  m.meta = { name: 'Center', region: 'city', music: 'city', darkness: 0, district: 'center' };
  const r = new G.RNG('city-center');
  const all = [G.T.sidewalk, G.T.concrete, G.T.grass, G.T.plaza, G.T.asphalt];

  // harbor
  m.fill(28, 78, 84, 14, G.T.water);
  m.fill(28, 85, 84, 7, G.T.deepwater);
  m.fill(0, 78, 28, 14, G.T.grass);
  m.fill(28, 72, 84, 6, G.T.concrete);
  m.fill(52, 78, 4, 8, G.T.dock);
  m.fill(80, 78, 4, 6, G.T.dock);
  // a little park in the northwest corner of the plaza block
  m.fill(0, 78, 7, 14, G.T.grass);
  const roads = [
    { h: true, at: 18, from: 0, to: 111 }, { h: true, at: 38, from: 0, to: 111 }, { h: true, at: 58, from: 0, to: 111 },
    { h: false, at: 24, from: 0, to: 77 }, { h: false, at: 52, from: 0, to: 77 }, { h: false, at: 82, from: 0, to: 77 },
    { h: false, at: 8, from: 58, to: 91 },
  ];
  D.roads(m, roads);
  m.fill(57, 43, 24, 14, G.T.plaza);

  const B = (id, x, y, w, h, o) => m.addBuilding(id, x, y, w, h, Object.assign({ wall: 'wall_brick', floor: 'tilefloor', roof: 'flat' }, o));
  const apts = [];
  const A = (id, x, y, owner, o = {}) => { const b = B(id, x, y, 9, 8, Object.assign({ name: 'Apartment', roof: r.pick(['flat', 'flat_dark', 'flat_brick']), wall: r.pick(['wall_brick', 'wall_brick', 'wall_concrete']) }, o)); apts.push([b, owner, o]); return b; };

  A('c_house3', 2, 4, 'c_citizen3'); A('c_house4', 12, 4, 'c_citizen4');
  A('c_house1', 30, 4, 'c_citizen1'); A('c_house2', 41, 4, 'c_citizen2');
  const office = B('c_noble1', 58, 3, 11, 9, { name: 'Office Tower', wall: 'wall_concrete', roof: 'flat_light', kind: 'office' });
  const agency = B('c_noble2', 70, 4, 10, 8, { name: 'Apartment', wall: 'wall_concrete', roof: 'flat_dark' });
  const hall = B('c_manor', 88, 2, 20, 13, { name: 'City Hall', wall: 'wall_marble', floor: 'stonefloor', roof: 'white', kind: 'manor', chimney: false });

  const police = B('c_barracks', 2, 24, 18, 10, { name: 'Police Station', wall: 'wall_concrete', roof: 'flat', kind: 'barracks' });
  const bar = B('c_tavern', 30, 24, 13, 9, { name: 'Bar', roof: 'flat_dark', floor: 'woodfloor', kind: 'inn' });
  const store = B('c_store', 44, 25, 7, 7, { name: 'Convenience Store', roof: 'flat_light', kind: 'shop' });
  const guns = B('c_armory', 58, 24, 10, 8, { name: 'Gun Store', wall: 'wall_concrete', roof: 'flat_dark', kind: 'shop' });
  const pharm = B('c_alchemist', 70, 24, 10, 7, { name: 'Pharmacy', wall: 'wall_concrete', roof: 'flat_light', kind: 'shop' });
  const church = B('c_temple', 89, 23, 16, 12, { name: 'Church', wall: 'wall_stone', floor: 'stonefloor', roof: 'slate', kind: 'temple', chimney: false });

  A('c_house5', 2, 44, 'c_citizen5'); A('c_house6', 12, 44, 'c_preacher');
  const clothes = B('c_clothes', 30, 44, 9, 7, { name: 'Clothes Store', roof: 'flat_light', kind: 'shop' });
  const barber = B('c_barber', 41, 44, 9, 7, { name: 'Barbershop', roof: 'flat', kind: 'shop' });
  A('c_house11', 88, 44, 'c_citizen7'); A('c_house12', 99, 44, 'c_citizen8');

  A('c_house7', 13, 63, 'c_beggar', { name: 'Shelter' }); A('c_house8', 13, 72, 'c_market1');
  const warehouse = B('c_warehouse', 30, 63, 16, 9, { name: 'Abandoned Warehouse', wall: 'wall_concrete', floor: 'concrete', roof: 'flat_dark' });
  const dock = B('c_dockhouse', 58, 63, 9, 7, { name: "Harbormaster's Office", wall: 'wall_concrete', roof: 'flat' });
  A('c_house9', 69, 63, 'c_market2'); A('c_house10', 88, 63, 'c_harbormaster');
  const shipping = B('c_shipping', 99, 63, 11, 8, { name: 'Shipping Warehouse', wall: 'wall_concrete', floor: 'concrete', roof: 'flat' });

  MB.furnish(m, police, 'barracks', r, { owner: 'c_captain', loot: [['ammo_9mm', 30], ['police_baton', 1], ['first_aid_kit', 1]] });
  MB.furnish(m, bar, 'inn', r, { owner: 'c_tavernkeep' });
  MB.furnish(m, store, 'shop', r, { owner: 'c_merchant', loot: [['chips', 2], ['soda', 2]] });
  MB.furnish(m, guns, 'shop', r, { owner: 'c_armorer', loot: [['ammo_9mm', 24], ['ammo_shells', 8], ['kevlar_vest', 1]] });
  MB.furnish(m, pharm, 'shop', r, { owner: 'c_alchemist', loot: [['painkillers', 3], ['first_aid_kit', 1], ['antidote', 2]] });
  MB.furnish(m, church, 'temple', r, { owner: 'c_priest' });
  MB.furnish(m, hall, 'manor', r, { owner: 'c_lord', loot: [['gem', 1], ['letter', 1]] });
  MB.furnish(m, office, 'office', r, { owner: 'c_noble1', loot: [['gem', 1], ['smartphone', 1]], gold: 120 });
  MB.furnish(m, agency, 'house', r, { owner: 'c_agent1', beds: 2, loot: [['pistol', 1], ['letter', 1]], gold: 90 });
  MB.furnish(m, dock, 'office', r, { owner: 'c_harbormaster', bedroom: false, loot: [['fish', 3]] });
  MB.furnish(m, warehouse, 'barracks', r, { owner: 'c_punk_boss', loot: [['joint', 2], ['beer', 3]] });
  MB.furnish(m, shipping, 'garage', r, { owner: 'c_harbormaster', car: 'car_white', loot: [['iron_ingot', 3], ['smartphone', 1]] });
  MB.furnish(m, barber, 'shop', r, { owner: 'c_barber', loot: [['bandage', 1]] });
  MB.furnish(m, clothes, 'shop', r, { owner: 'c_tailor', loot: [['cloth_tunic', 1]] });
  for (const [b, owner] of apts) MB.furnish(m, b, 'house', r, { owner });

  // plaza & market
  m.addDecor('fountain', 67, 48);
  m.addDecor('stall_red', 59, 45); m.points.c_stall1 = { x: 60, y: 46 };
  m.addDecor('stall_blue', 76, 45); m.points.c_stall2 = { x: 77, y: 46 };
  m.addDecor('stall_green', 59, 53); m.addDecor('stall_red', 76, 53);
  for (const [x, y] of [[62, 50], [72, 50], [64, 55], [70, 55]]) D.put(m, 'bench', x, y, ANY);
  m.addDecor('statue', 99, 18 - 2);
  m.addDecor('sign', 57, 44);
  m.signs['57,44'] = 'City Plaza\nWest: The Suburbs · East: Eastside\nNorth: The Rich District · Southwest: Southside\nSouth: Harbor';
  D.lamps(m, roads);
  // parked cars, police cruisers, street furniture
  for (const [x, y] of [[4, 35], [14, 35]]) D.put(m, 'police_car', x, y, ANY);
  for (const [x, y] of [[33, 41], [62, 41], [92, 38], [30, 21], [70, 21], [100, 58], [40, 61], [86, 61]]) D.put(m, r.pick(D.CARS), x, y, ANY);
  for (const [x, y] of [[43, 34], [28, 62], [47, 71], [96, 71]]) D.put(m, 'dumpster', x, y, ANY);
  for (const [x, y] of [[23, 30], [51, 30], [81, 30], [23, 50], [86, 50], [51, 66]]) D.put(m, 'hydrant', x, y, ANY);
  for (const [x, y] of [[29, 36], [56, 36], [87, 36], [29, 56], [56, 22], [87, 56]]) D.put(m, 'trashcan', x, y, ANY);
  D.put(m, 'vending', 51, 26, ANY); D.put(m, 'vending', 81, 26, ANY);
  for (const [x, y] of [[60, 75], [64, 75], [90, 74], [94, 74], [104, 75], [72, 76]]) D.put(m, r.pick(['crate', 'barrel', 'crate']), x, y, ANY);
  MB.scatter(m, r, ['oak0', 'oak1'], 8, 0, 79, 26, 90, [G.T.grass], 1);
  MB.scatter(m, r, ['trash', 'manhole'], 30, 0, 0, 111, 77, [G.T.sidewalk, G.T.asphalt, G.T.concrete]);
  m.addDecor('boat', 54, 87);
  m.points.c_ferry = { x: 54, y: 83 };

  m.points.c_gate_w = { x: 3, y: 43 };
  m.points.c_gate_n = { x: 57, y: 2 };
  m.points.c_plaza = { x: 68, y: 53 };
  m.points.c_harbor = { x: 70, y: 75 };
  m.points.c_patrol_a = [{ x: 14, y: 40 }, { x: 45, y: 40 }, { x: 54, y: 50 }, { x: 45, y: 60 }, { x: 14, y: 60 }];
  m.points.c_patrol_b = [{ x: 60, y: 40 }, { x: 100, y: 40 }, { x: 100, y: 20 }, { x: 60, y: 20 }, { x: 54, y: 30 }];
  m.points.c_patrol_c = [{ x: 54, y: 8 }, { x: 54, y: 70 }, { x: 80, y: 75 }, { x: 40, y: 75 }];
  m.points.c_patrol_d = [{ x: 26, y: 8 }, { x: 26, y: 70 }, { x: 84, y: 70 }, { x: 84, y: 8 }];
  m.points.c_punk_turf = [{ x: 32, y: 74 }, { x: 46, y: 74 }, { x: 48, y: 62 }, { x: 30, y: 62 }, { x: 25, y: 74 }];
  m.points.from_suburbs = { x: 2, y: 40 };
  m.points.from_eastside = { x: 109, y: 40 };
  m.points.from_heights = { x: 54, y: 2 };
  m.points.from_southside = { x: 10, y: 89 };
  m.points.from_island = { x: 54, y: 84 };
  m.points.from_jail = { x: 12, y: 36 };
  m.addExit(0, 38, 1, 4, 'suburbs', 'from_city', 'To The Suburbs');
  m.addExit(111, 38, 1, 4, 'eastside', 'from_city', 'To Eastside');
  m.addExit(52, 0, 4, 1, 'heights', 'from_city', 'To The Rich District');
  m.addExit(8, 91, 4, 1, 'southside', 'from_city', 'To Southside');
  m.meta.shelter = 'c_temple_in';
  m.dangerZones = [
    { name: 'Warehouse Row', x: 28, y: 62, w: 28, h: 16, spawns: { punk: 2, mugger: 1 } },
    { name: 'Shelter Alley', x: 0, y: 60, w: 24, h: 18, spawns: { mugger: 1 } },
  ];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- SUBURBS
G.MAPGEN.suburbs = () => {
  const m = new G.TileMap('suburbs', 100, 76, G.T.grass);
  m.meta = { name: 'The Suburbs', region: 'city', music: 'rural', darkness: 0, district: 'suburbs' };
  const r = new G.RNG('suburbs');
  const roads = [
    { h: true, at: 12, from: 0, to: 99 }, { h: true, at: 36, from: 0, to: 99 }, { h: true, at: 60, from: 6, to: 93 },
    { h: false, at: 6, from: 12, to: 63 }, { h: false, at: 50, from: 0, to: 75 }, { h: false, at: 90, from: 12, to: 63 },
  ];
  D.roads(m, roads);

  const roofs = ['red', 'brown', 'blue', 'shingle', 'slate', 'green'];
  const houses = [];
  let n = 0;
  // rows of houses facing the street below them (doors are on the bottom wall)
  const row = (y, slots) => {
    for (const [x, w] of slots) {
      n++;
      const id = 'u_house' + n;
      const b = m.addBuilding(id, x, y, w, 7, { name: 'House', wall: 'wall_siding', floor: 'woodfloor', roof: r.pick(roofs) });
      houses.push(b);
      const dy = b.doorY + 1;
      // driveway + car, mailbox, front lawn
      m.fill(x + w - 3, dy, 2, 1, G.T.concrete);
      if (r.chance(0.8)) D.put(m, r.pick(D.CARS), x + w - 3, dy, ANY);
      D.put(m, 'mailbox', x + 1, dy, ANY);
      // backyard: fence, a tree, sometimes a pool
      const by = y - 9;
      if (by > 0 && m.get(x, by) === G.T.grass) {
        MB.rectFence(m, x, by, x + w - 1, y - 1, G.T.fence, [[x, by + 4]]);
        if (r.chance(0.35)) m.fill(x + 2, by + 2, Math.min(4, w - 4), 3, G.T.pool);
        else D.put(m, r.pick(['oak0', 'oak1', 'oak2']), x + w - 3, by + 4, [G.T.grass]);
      }
    }
  };
  const west = [[12, 8], [21, 8], [30, 8], [39, 8]], east = [[56, 8], [65, 8], [74, 8], [82, 7]];
  row(3, west.concat(east));
  row(27, west.concat(east));
  row(51, west.concat(east));

  // park, mini-mart and the school south of the last street
  const park = { x: 11, y: 65, w: 38, h: 10 };
  MB.scatter(m, r, ['oak0', 'oak1', 'oak2'], 10, park.x, park.y, park.x + 22, park.y + park.h - 1, [G.T.grass], 1);
  m.fill(38, 66, 10, 7, G.T.court);
  for (const [x, y] of [[16, 70], [24, 72], [30, 67]]) D.put(m, 'bench', x, y, [G.T.grass]);
  const mart = m.addBuilding('u_store', 56, 66, 10, 7, { name: 'Mini-Mart', wall: 'wall_brick', floor: 'tilefloor', roof: 'flat' });
  m.fill(67, 66, 6, 8, G.T.concrete);
  D.put(m, 'car_white', 67, 68, ANY); D.put(m, 'car_blue', 67, 71, ANY); D.put(m, 'vending', 66, 72, ANY);
  const school = m.addBuilding('u_school', 74, 65, 15, 10, { name: 'Elementary School', wall: 'wall_brick', floor: 'tilefloor', roof: 'flat_light' });
  MB.furnish(m, mart, 'shop', r, { owner: 'u_clerk', loot: [['chips', 2], ['soda', 2], ['cigarettes', 3]] });
  MB.furnish(m, school, 'office', r, { owner: 'u_res1', bedroom: false, loot: [['book', 2], ['apple', 2]] });

  // residents live in the first houses; the rest belong to neighbors who are out (chests still owned)
  const residents = ['u_res1', 'u_res2', 'u_res3', 'u_res4', 'u_res5', 'u_res6', 'u_res7', 'u_res8', 'u_res9', 'u_res10', 'u_clerk', 'u_cop'];
  houses.forEach((b, i) => MB.furnish(m, b, 'house', r, { owner: residents[i % residents.length], beds: ({ u_house1: 3, u_house9: 3, u_house3: 2, u_house20: 2 })[b.id] || (i < residents.length ? 2 : 1) }));
  // the Fire Station (engines answer fires all over the city)
  const fireSt = m.addBuilding('u_firestation', 90, 65, 9, 8, { name: 'Fire Station', wall: 'wall_brick', floor: 'concrete', roof: 'flat' });
  MB.furnish(m, fireSt, 'barracks', r, { owner: 'u_fire3', loot: [['first_aid_kit', 2], ['bandage', 4], ['woodaxe', 1]] });
  D.lamps(m, roads, 12);
  MB.scatter(m, r, ['flowers', 'tuft', 'flowers'], 160, 0, 0, 99, 75);
  MB.scatter(m, r, ['bush', 'oak1'], 25, 0, 0, 99, 75, [G.T.grass], 1);

  m.points.u_park = { x: 26, y: 70 };
  m.points.u_court = { x: 42, y: 69 };
  m.points.u_patrol = [{ x: 7, y: 14 }, { x: 7, y: 62 }, { x: 52, y: 62 }, { x: 91, y: 62 }, { x: 91, y: 14 }, { x: 52, y: 14 }];
  m.points.from_rural = { x: 2, y: 38 };
  m.points.from_city = { x: 97, y: 38 };
  m.points.from_heights = { x: 52, y: 2 };
  m.addExit(0, 36, 1, 4, 'rural', 'from_suburbs', 'To Rural Zone');
  m.addExit(99, 36, 1, 4, 'city', 'from_suburbs', 'To Center');
  m.addExit(50, 0, 4, 1, 'heights', 'from_suburbs', 'To The Rich District');
  m.meta.shelter = 'u_school_in';
  m.dangerZones = [{ name: 'The Park', x: park.x, y: park.y, w: park.w, h: park.h, spawns: { mugger: 1 } }];
  m.animalZones = [{ kind: 'rabbit', x: 12, y: 66, w: 20, h: 8, max: 2 }];
  m.finalize();
  return m;
};

// Shared layout for the two gang neighborhoods: two crossing streets split the map into four blocks.
function gangHood(m, r, o) {
  D.roads(m, o.roads);
  const B = (id, x, y, w, h, opt) => m.addBuilding(id, x, y, w, h, Object.assign({ wall: r.pick(['wall_brick', 'wall_brick', 'wall_concrete']), floor: 'woodfloor', roof: r.pick(['flat', 'flat_dark', 'flat_brick']) }, opt));
  const built = {};
  for (const [id, x, y, w, h, opt, kind, fo] of o.buildings) {
    built[id] = B(id, x, y, w, h, opt);
    MB.furnish(m, built[id], kind, r, fo);
  }
  // vacant lots behind chain-link fences, with wrecks and trash
  for (const [x, y, w, h] of o.lots) {
    m.fill(x, y, w, h, G.T.lot);
    MB.rectFence(m, x, y, x + w - 1, y + h - 1, G.T.chainlink, [[x + Math.floor(w / 2), y + h - 1], [x + Math.floor(w / 2) + 1, y + h - 1]]);
    m.markOccupied(x + Math.floor(w / 2) - 1, y + h, 4, 2);   // keep the gate clear
    D.put(m, 'car_wreck', x + 2, y + 2, [G.T.lot]);
    D.put(m, 'dumpster', x + w - 4, y + 2, [G.T.lot]);
    MB.scatter(m, r, ['trash'], 6, x + 1, y + 1, x + w - 2, y + h - 2, [G.T.lot]);
  }
  for (const [x, y, w, h] of o.courts || []) { m.fill(x, y, w, h, G.T.court); MB.rectFence(m, x - 1, y - 1, x + w, y + h, G.T.chainlink, [[x + 2, y + h], [x + 3, y + h]]); m.markOccupied(x + 1, y + h + 1, 4, 2); }
  D.lamps(m, o.roads, 11);
  MB.scatter(m, r, ['trash', 'trash', 'manhole'], 50, 0, 0, m.w - 1, m.h - 1, [G.T.sidewalk, G.T.asphalt, G.T.concrete]);
  D.park(m, r, o.roads, 6, ['car_wreck', 'car_gray', 'car_black', 'car_red']);
  MB.scatter(m, r, ['dumpster', 'trashcan', 'trashcan', 'hydrant'], 16, 0, 0, m.w - 1, m.h - 1, [G.T.concrete, G.T.sidewalk]);
  return built;
}

// ---------------------------------------------------------------- SOUTHSIDE (Red Gang)
G.MAPGEN.southside = () => {
  const m = new G.TileMap('southside', 96, 72, G.T.concrete);
  m.meta = { name: 'Southside', region: 'city', music: 'city', darkness: 0.05, district: 'southside' };
  const r = new G.RNG('southside');
  gangHood(m, r, {
    roads: [{ h: true, at: 34, from: 0, to: 95 }, { h: false, at: 46, from: 0, to: 71 }],
    buildings: [
      ['s_apt1', 3, 3, 14, 9, { name: 'Apartment Block' }, 'house', { owner: 's_res1', beds: 3 }],
      ['s_pawn', 20, 4, 10, 7, { name: 'Pawn Shop', roof: 'flat' }, 'shop', { owner: 's_pawnbroker', loot: [['smartphone', 2], ['gold_chain', 1]] }],
      ['s_apt2', 32, 3, 12, 9, { name: 'Apartment Block' }, 'house', { owner: 's_res2', beds: 2 }],
      ['s_house1', 26, 20, 9, 7, { name: 'House' }, 'house', { owner: 's_res3', beds: 2 }],
      ['s_house2', 36, 20, 9, 7, { name: 'House' }, 'house', { owner: 's_res4' }],
      ['s_liquor', 52, 3, 10, 7, { name: 'Liquor Store', roof: 'flat' }, 'shop', { owner: 's_clerk', loot: [['vodka', 2], ['cigarettes', 4]] }],
      ['s_apt3', 64, 3, 14, 9, { name: 'Apartment Block' }, 'house', { owner: 's_res1', beds: 2 }],
      ['s_apt4', 80, 3, 13, 9, { name: 'Apartment Block' }, 'house', { owner: 's_res2', beds: 2 }],
      ['s_house3', 70, 18, 9, 7, { name: 'House' }, 'house', { owner: 's_res3' }],
      ['s_house4', 82, 18, 9, 7, { name: 'House' }, 'house', { owner: 's_res4' }],
      ['s_redhq', 4, 42, 14, 9, { name: 'Red Gang Hideout', wall: 'wall_brick', roof: 'flat_dark' }, 'house', { owner: 'c_red_boss', beds: 3, loot: [['pistol', 1], ['ammo_9mm', 20], ['cocaine', 2]], gold: 150 }],
      ['s_garage', 22, 42, 12, 8, { name: 'Chop Shop', wall: 'wall_concrete', floor: 'concrete' }, 'garage', { owner: 'c_red3', car: 'car_red' }],
      ['s_apt5', 4, 56, 12, 9, { name: 'Apartment Block' }, 'house', { owner: 'c_red3', beds: 3 }],
      ['s_apt6', 52, 42, 13, 9, { name: 'Apartment Block' }, 'house', { owner: 's_res1', beds: 2 }],
      ['s_house5', 68, 42, 9, 7, { name: 'House' }, 'house', { owner: 's_res2' }],
      ['s_house6', 80, 42, 9, 7, { name: 'House' }, 'house', { owner: 's_res3' }],
    ],
    lots: [[4, 16, 18, 14], [20, 56, 22, 13]],
    courts: [[54, 17, 12, 8]],
  });
  m.fill(53, 56, 38, 13, G.T.grass);
  MB.scatter(m, r, ['oak0', 'oak1', 'bush'], 10, 53, 56, 90, 68, [G.T.grass], 1);
  D.put(m, 'bench', 60, 60, [G.T.grass]); D.put(m, 'bench', 76, 64, [G.T.grass]);
  m.points.s_park = { x: 68, y: 62 };
  m.points.s_court = { x: 59, y: 21 };
  m.points.s_red_turf = [{ x: 10, y: 37 }, { x: 40, y: 37 }, { x: 48, y: 20 }, { x: 48, y: 55 }, { x: 20, y: 52 }];
  m.points.from_city = { x: 47, y: 2 };
  m.points.from_eastside = { x: 93, y: 36 };
  m.addExit(46, 0, 4, 1, 'city', 'from_southside', 'To Center');
  m.addExit(95, 34, 1, 4, 'eastside', 'from_southside', 'To Eastside');
  m.meta.shelter = 's_apt6_in';
  m.dangerZones = [];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- EASTSIDE (Blue Gang)
G.MAPGEN.eastside = () => {
  const m = new G.TileMap('eastside', 96, 72, G.T.concrete);
  m.meta = { name: 'Eastside', region: 'city', music: 'city', darkness: 0.05, district: 'eastside' };
  const r = new G.RNG('eastside');
  m.fill(86, 0, 10, 72, G.T.water);
  m.fill(84, 0, 2, 72, G.T.concrete);
  for (const y of [8, 26, 46, 62]) m.fill(86, y, 7, 3, G.T.dock);
  gangHood(m, r, {
    roads: [{ h: true, at: 36, from: 0, to: 83 }, { h: false, at: 48, from: 0, to: 71 }],
    buildings: [
      ['x_apt1', 3, 3, 14, 9, { name: 'Tenement' }, 'house', { owner: 'x_res1', beds: 3 }],
      ['x_bodega', 20, 4, 9, 7, { name: 'Bodega', roof: 'flat' }, 'shop', { owner: 'x_clerk', loot: [['chips', 3], ['beer', 3]] }],
      ['x_apt2', 31, 3, 14, 9, { name: 'Tenement' }, 'house', { owner: 'x_res2', beds: 2 }],
      ['x_laundry', 4, 18, 12, 8, { name: 'Laundromat' }, 'house', { owner: 'x_res3' }],
      ['e_bluehq', 54, 4, 14, 9, { name: 'Blue Gang Hideout', wall: 'wall_concrete', roof: 'flat_dark' }, 'house', { owner: 'c_blue_boss', beds: 3, loot: [['revolver', 1], ['ammo_357', 12], ['speed_pills', 2]], gold: 150 }],
      ['x_ware1', 70, 3, 13, 12, { name: 'Dock Warehouse', wall: 'wall_concrete', floor: 'concrete' }, 'garage', { owner: 'c_blue3', car: 'car_blue' }],
      ['x_apt3', 3, 43, 14, 9, { name: 'Tenement' }, 'house', { owner: 'c_blue3', beds: 3 }],
      ['x_house1', 20, 43, 9, 7, { name: 'House' }, 'house', { owner: 'x_res4' }],
      ['x_house2', 31, 43, 9, 7, { name: 'House' }, 'house', { owner: 'x_res1' }],
      ['x_apt4', 3, 57, 14, 9, { name: 'Tenement' }, 'house', { owner: 'x_res2', beds: 2 }],
      ['x_ware2', 54, 43, 14, 10, { name: 'Cold Storage', wall: 'wall_concrete', floor: 'concrete' }, 'garage', { owner: 'x_res3', car: 'car_white' }],
      ['x_house3', 70, 44, 9, 7, { name: 'House' }, 'house', { owner: 'x_res4' }],
    ],
    lots: [[20, 18, 24, 13], [20, 56, 24, 13]],
    courts: [[56, 58, 12, 7]],
  });
  MB.scatter(m, r, ['crate', 'crate', 'barrel'], 18, 72, 16, 83, 70, [G.T.concrete]);
  m.points.x_docks = { x: 84, y: 28 };
  m.points.x_court = { x: 61, y: 61 };
  m.points.x_blue_turf = [{ x: 10, y: 39 }, { x: 44, y: 39 }, { x: 50, y: 20 }, { x: 50, y: 60 }, { x: 76, y: 39 }];
  m.points.from_city = { x: 2, y: 38 };
  m.points.from_southside = { x: 50, y: 69 };
  m.addExit(0, 36, 1, 4, 'city', 'from_eastside', 'To Center');
  m.addExit(48, 71, 4, 1, 'southside', 'from_eastside', 'To Southside');
  m.meta.shelter = 'x_laundry_in';
  m.dangerZones = [];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- RICH DISTRICT (the Elite)
G.MAPGEN.heights = () => {
  const m = new G.TileMap('heights', 96, 72, G.T.grass);
  m.meta = { name: 'The Rich District', region: 'city', music: 'city', darkness: 0, district: 'heights' };
  const r = new G.RNG('heights');
  const roads = [{ h: true, at: 34, from: 0, to: 95 }, { h: false, at: 46, from: 0, to: 71 }];
  // the whole district is fenced; the roads (laid on top) are the gates
  MB.rectFence(m, 1, 1, 94, 70, G.T.ironfence, []);
  D.roads(m, roads);

  const B = (id, x, y, w, h, o) => m.addBuilding(id, x, y, w, h, Object.assign({ wall: 'wall_marble', floor: 'woodfloor', roof: 'slate', chimney: false }, o));
  const mansion = (id, x, y, owner, roof, pool) => {
    const b = B(id, x, y, 18, 11, { name: 'Mansion', roof });
    // hedge around the grounds, gap at the front path
    MB.rectFence(m, x - 2, y - 2, x + 19, y + 13, G.T.hedge, [[b.doorX, y + 13], [b.doorX + 1, y + 13], [b.doorX - 1, y + 13]]);
    m.fill(b.doorX - 1, y + 11, 3, 2, G.T.plaza);
    if (pool) m.fill(pool[0], pool[1], 6, 4, G.T.pool);
    MB.furnish(m, b, 'mansion', r, { owner });
    return b;
  };
  mansion('h_mansion1', 6, 6, 'h_host', 'blue', [26, 9]);
  mansion('h_mansion2', 62, 6, 'h_elite1', 'slate', null);
  mansion('h_mansion3', 6, 44, 'h_elite2', 'white', [26, 47]);
  mansion('h_mansion4', 66, 44, 'h_elite3', 'blue', [57, 46]);
  const club = B('h_club', 26, 19, 18, 12, { name: 'Private Club', wall: 'wall_marble', floor: 'carpet', roof: 'dark', kind: 'club' });
  MB.furnish(m, club, 'club', r, { owner: 'h_host' });
  const jeweler = B('h_jeweler', 54, 21, 11, 8, { name: 'Jewelry Boutique', roof: 'white', floor: 'tilefloor' });
  MB.furnish(m, jeweler, 'shop', r, { owner: 'h_jeweler', loot: [['jewelry', 2], ['designer_watch', 1]], gold: 300 });
  const post = B('h_gate', 52, 61, 8, 6, { name: 'Security Post', wall: 'wall_concrete', floor: 'concrete', roof: 'flat' });
  MB.furnish(m, post, 'house', r, { owner: 'h_sec1', beds: 3, loot: [['ammo_9mm', 20], ['first_aid_kit', 1]] });
  const staff = B('h_staff', 74, 21, 12, 8, { name: 'Staff Quarters', wall: 'wall_siding', roof: 'shingle' });
  MB.furnish(m, staff, 'house', r, { owner: 'h_butler', beds: 3 });
  // the casino & hotel (open 16:00-04:00; the hotel floors are upstairs)
  const casino = B('h_casino', 3, 21, 20, 11, { name: 'Casino', wall: 'wall_marble', floor: 'carpet', roof: 'dark' });
  m.fill(casino.doorX - 1, casino.doorY + 1, 3, 1, G.T.plaza);
  MB.furnish(m, casino, 'casino', r, { owner: 'h_cashier' });

  // boulevard trees, limousines, fountains
  for (let y = 4; y < 68; y += 6) { D.put(m, 'oak' + (y % 3), 44, y, [G.T.grass]); D.put(m, 'oak' + ((y + 1) % 3), 51, y, [G.T.grass]); }
  D.put(m, 'limo', 40, 32 + 0, ANY); D.put(m, 'car_black', 56, 32, ANY); D.put(m, 'car_white', 14, 32, ANY); D.put(m, 'limo', 56, 39, ANY);
  m.addDecor('fountain', 30, 40);
  for (const [x, y] of [[28, 40], [34, 40], [62, 31], [66, 31]]) D.put(m, 'plant', x, y, ANY);
  D.lamps(m, roads, 8);
  MB.scatter(m, r, ['flowers', 'flowers', 'tuft'], 220, 2, 2, 93, 69);
  MB.scatter(m, r, ['bush'], 20, 2, 2, 93, 69, [G.T.grass], 1);

  m.points.h_gate_post = { x: 48, y: 66 };
  m.points.h_boulevard = [{ x: 47, y: 8 }, { x: 47, y: 60 }, { x: 10, y: 36 }, { x: 88, y: 36 }, { x: 47, y: 36 }];
  m.points.h_lounge = { x: 34, y: 28 };
  m.points.h_garden = { x: 30, y: 43 };
  m.points.from_city = { x: 47, y: 68 };
  m.points.from_forest = { x: 47, y: 3 };
  m.points.from_suburbs = { x: 3, y: 36 };
  m.points.from_eastside = { x: 92, y: 36 };
  m.addExit(46, 71, 4, 1, 'city', 'from_heights', 'To Center');
  m.addExit(46, 0, 4, 1, 'forest', 'from_heights', 'To The Forest');
  m.addExit(0, 34, 1, 4, 'suburbs', 'from_heights', 'To The Suburbs');
  m.meta.shelter = 'h_staff_in';
  m.meta.elite = 'h_club';   // the sanctum inside is the Elite's secret meeting place
  m.dangerZones = [];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- COUNTY JAIL (where arrests end up)
// A walled compound: the cell block, mess hall, laundry, infirmary, the warden's office and the yard.
// The only ways out are serving your time... or one of the escapes in js/game/jail.js.
G.MAPGEN.jail = () => {
  const m = new G.TileMap('jail', 72, 58, G.T.grass);
  m.meta = { name: 'County Jail', region: 'city', music: 'night', darkness: 0.08, district: 'jail' };
  const r = new G.RNG('jail');
  m.fill(7, 7, 58, 42, G.T.concrete);
  MB.rectFence(m, 6, 6, 65, 49, G.T.wall_concrete, []);
  m.fill(34, 49, 4, 9, G.T.asphalt);                       // the road out, past the gate
  m.set(34, 49, G.T.concrete); m.set(35, 49, G.T.concrete); m.set(36, 49, G.T.concrete); m.set(37, 49, G.T.concrete);
  const B = (id, x, y, w, h, o) => m.addBuilding(id, x, y, w, h, Object.assign({ wall: 'wall_concrete', floor: 'concrete', roof: 'flat_dark', chimney: false }, o));

  // cell block: eight cells along the north wall, a corridor below
  const block = B('j_cellblock', 8, 8, 35, 14, { name: 'Cell Block' });
  for (let k = 0; k < 8; k++) {
    const x0 = 9 + k * 4;
    for (let y = 9; y <= 13; y++) m.set(x0 + 3, y, G.T.wall_concrete);
    m.set(x0, 13, G.T.wall_concrete); m.set(x0 + 2, 13, G.T.wall_concrete);
    m.addDecor('bed', x0, 10); m.points[`j_cell${k}_bed`] = { x: x0, y: 10 };
    m.points[`j_cell${k}`] = { x: x0 + 1, y: 11 };
    m.addDecor('loose_tile', x0 + 2, 9);
  }
  m.points.j_corridor = { x: 25, y: 17 };
  m.points.j_block_patrol = [{ x: 10, y: 16 }, { x: 40, y: 16 }, { x: 40, y: 19 }, { x: 10, y: 19 }];
  // mess hall
  const mess = B('j_mess', 46, 8, 18, 12, { name: 'Mess Hall', floor: 'tilefloor' });
  for (let y = 12; y <= 17; y += 3) for (let x = 48; x <= 58; x += 5) m.addDecor('table', x, y);
  m.addDecor('serving', 48, 9); m.points.j_mess_work = { x: 49, y: 10 };
  m.points.j_mess = { x: 55, y: 15 };
  // laundry, infirmary, office
  const laundry = B('j_laundry', 8, 26, 12, 9, { name: 'Laundry' });
  m.addDecor('laundry_cart', 10, 28); m.addDecor('laundry_cart', 15, 28); m.points.j_laundry_work = { x: 13, y: 31 };
  const inf = B('j_infirmary', 23, 26, 10, 8, { name: 'Infirmary', floor: 'tilefloor' });
  m.addDecor('bed', 24, 28); m.addDecor('bed', 26, 28); m.points.j_infirmary_work = { x: 29, y: 30 };
  const office = B('j_office', 47, 25, 13, 9, { name: "Warden's Office" });
  MB.furnish(m, office, 'office', r, { owner: 'j_warden', storage: 'safe', loot: [['keycard', 1], ['pistol', 1], ['ammo_9mm', 12]], gold: 200 });
  const lockerB = B('j_evidence', 47, 37, 9, 7, { name: 'Evidence Room' });
  MB.chest(m, 'evidence', 48, 39, 'j_warden', [], 0); m.chests[m.chests.length - 1].style = 'locker';
  m.points.j_evidence_in = { x: 51, y: 41 };
  // the yard
  m.fill(23, 37, 20, 10, G.T.court);
  MB.rectFence(m, 22, 36, 43, 47, G.T.chainlink, [[32, 36], [33, 36]]);
  m.addDecor('bench', 25, 45); m.addDecor('bench', 38, 45);
  m.points.j_yard = { x: 32, y: 41 };
  // the gate (opens with the warden's keycard, in a riot, or when a guard has been paid off)
  m.addDecor('security_door', 35, 49);
  m.points.j_gate_post = { x: 39, y: 48 };
  m.points.j_patrol = [{ x: 25, y: 23 }, { x: 45, y: 23 }, { x: 45, y: 35 }, { x: 32, y: 34 }, { x: 15, y: 24 }];
  m.points.j_tunnel_exit = { x: 3, y: 12 };            // where a finished tunnel comes up, outside the wall
  m.points.j_truck_drop = { x: 34, y: 55 };            // where the laundry truck leaves you
  m.points.from_city = { x: 35, y: 53 };
  m.addExit(34, 57, 4, 1, 'city', 'from_jail', 'To Center');
  for (const [x, y] of [[2, 2], [69, 2], [2, 54], [69, 54]]) m.addDecor('lamp', x, y);
  MB.scatter(m, r, ['oak0', 'pine0', 'bush'], 20, 0, 0, 71, 57, [G.T.grass], 1);
  m.meta.shelter = 'j_cellblock_in';
  m.dangerZones = [];
  m.finalize();
  return m;
};
