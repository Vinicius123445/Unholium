'use strict';
// Upper floors, stairs, elevators, hotel floors and the casino (see js/data/interiors.js for the planner).
// Each upper floor is its own small map (`<building>_f2`, `_f3`...), reached by stairs or the elevator.
(() => {
const { RoomPlan } = G;
const P_ = G.INTERIOR;
const PT = (m, b, name, x, y) => { m.points[b.id + '_' + name] = { x, y }; };

// ---------------------------------------------------------------- hotel / motel floors
function planGuestFloor(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  const depth = ih >= 7 ? 3 : 2;
  const plan = [];
  let rem = iw;
  while (rem >= 3) { if (rem <= 6) { plan.push(rem); rem = 0; } else { plan.push(3); rem -= 4; } }
  const { rooms, wy } = P_.backRooms(P, depth, plan, (r) => r.x0);
  rooms.forEach((r, i) => {
    if (P.put(rng.pick(['bed', 'bed_red', 'bed_green']), r.x1, P.iy0, { guest: true })) PT(m, b, 'guestbed' + (i ? i + 1 : ''), r.x1, P.iy0);
    P.putAny('nightstand', [[r.x1 - 1, P.iy0]]);
    if (depth >= 3) P.putAny('tv', [[r.x1, P.iy0 + 2]]);
  });
  const fy1 = P.iy1;
  for (const t of ['vending', 'plant', 'couch', 'plant', 'watercooler']) P.putAny(t, P.row(fy1, P.ix0, P.ix1).filter(([x]) => Math.abs(x - dx) > 1).map(([x, y]) => [Math.min(x, P.ix1 - (G.DECOR[t].fw || 1) + 1), y]));
  PT(m, b, 'work', dx === P.ix0 ? dx + 1 : dx - 1, wy + 1);
  return true;
}

// ---------------------------------------------------------------- casino
function planCasino(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);
  const iw = P.ix1 - P.ix0 + 1, dx = P.dx;
  P.floor(P.ix0, P.iy0, P.ix1, P.iy1, G.T.carpet);
  // back: staff room (beds), restrooms, the vault
  const { rooms, wy } = P_.backRooms(P, 2, [8, 3, iw - 13], (r) => r.x0 + 1);
  const [staff, wc, vault] = rooms;
  ['bed', 'bed2', 'bed3', 'bed4'].forEach((n, i) => { if (P.put('bed', staff.x0 + 2 + i, P.iy0)) PT(m, b, n, staff.x0 + 2 + i, P.iy0); });
  P.floor(wc.x0, P.iy0, wc.x1, P.iy0 + 1, G.T.tilefloor); P.put('toilet', wc.x0, P.iy0); P.put('toilet', wc.x1, P.iy0); P.put('sink', wc.x1, P.iy0 + 1);
  const vaultSpots = P.row(P.iy0, vault.x0, vault.x1).filter(([x]) => x !== vault.x0 + 1);
  P.putAny('safe', vaultSpots, {}, { id: b.id + '_vault', owner: o.owner, loot: [['jewelry', 2], ['gem', 1]], gold: 2500 });
  P.putAny('safe', vaultSpots, {}, { id: b.id + '_vault2', owner: o.owner, loot: [['designer_watch', 1]], gold: 1500 });
  b.backroom = { x: P.ix0, y: P.iy0, w: iw, h: 2 };
  // floor: cashier cage, blackjack, roulette, slots along the walls
  const fy0 = wy + 1, fy1 = P.iy1;
  const spot = (name, x, y) => { P.reserve(x, y); P.mustReach(x, y); PT(m, b, name, x, y); };
  spot('work', P.ix1 - 1, fy0); P.reserve(P.ix1 - 1, fy0 + 2); P.put('counter', P.ix1 - 1, fy0 + 1);
  spot('bj', P.ix0 + 5, fy0 + 1); spot('bj_seat', P.ix0 + 5, fy0 + 3); P.reserve(P.ix0 + 6, fy0 + 3); P.put('bj_table', P.ix0 + 5, fy0 + 2);
  spot('roulette', dx + 3, fy0 + 1); spot('roulette_seat', dx + 3, fy0 + 3); P.reserve(dx + 4, fy0 + 3); P.put('roulette', dx + 3, fy0 + 2);
  spot('guard', dx - 1, fy1 - 1);
  for (let y = fy0 + 1; y <= fy1; y++) P.put('slot_machine', P.ix0, y);
  for (let x = P.ix0 + 1; x <= P.ix0 + 4; x++) P.put('slot_machine', x, fy1);
  for (let x = dx + 2; x <= P.ix1 - 3; x++) P.put('slot_machine', x, fy1);
  P.put('barstool', P.ix1 - 1, fy0 + 2);
  P.putAny('plant', [[P.ix1, fy1], [dx + 1, fy1], [dx - 2, fy1]]);
  P.putAny('floorlamp', [[P.ix1, fy0 + 3], [P.ix0 + 8, fy1]]);
  return true;
}

// ---------------------------------------------------------------- floors, stairs & elevators
//   levels: what each floor above the ground floor is      elevator: also has an elevator
G.FLOORS = {
  c_noble1: { base: 'city', elevator: true, levels: [{ kind: 'office' }, { kind: 'office' }, { kind: 'penthouse', loot: [['gem', 1], ['designer_watch', 1], ['pistol', 1]], gold: 400 }] },
  c_tavern: { base: 'city', levels: [{ kind: 'motel' }] },
  c_house1: { base: 'city', levels: [{ kind: 'apartment' }, { kind: 'apartment' }] },
  c_house2: { base: 'city', levels: [{ kind: 'apartment' }, { kind: 'apartment' }] },
  c_house11: { base: 'city', elevator: true, levels: [{ kind: 'apartment' }, { kind: 'apartment' }, { kind: 'apartment' }] },
  c_house12: { base: 'city', levels: [{ kind: 'apartment' }] },
  h_mansion1: { base: 'heights', levels: [{ kind: 'mansion_up' }] },
  h_mansion2: { base: 'heights', levels: [{ kind: 'mansion_up' }] },
  h_mansion3: { base: 'heights', levels: [{ kind: 'mansion_up' }] },
  h_mansion4: { base: 'heights', levels: [{ kind: 'mansion_up' }] },
  h_casino: { base: 'heights', elevator: true, levels: [{ kind: 'hotel' }, { kind: 'hotel' }] },
};
for (const n of [1, 3, 5, 9, 11, 13, 17, 19, 21]) G.FLOORS['u_house' + n] = { base: 'suburbs', levels: [{ kind: 'upstairs' }] };
G.floorId = (bid, n) => bid + '_f' + n;

// Stairs (and the elevator) near the entrance. level 1 = ground floor.
function placeLift(P, m, b, spec, level, bid) {
  const top = spec.levels.length + 1, dx = P.dx, iy1 = P.iy1;
  const near = [];
  for (let k = 1; k <= 4; k++) near.push([dx + k, iy1], [dx - k, iy1]);
  for (let y = iy1 - 1; y > P.iy1 - 3; y--) near.push([P.ix1, y], [P.ix0, y]);
  const pointBeside = (x, y, name) => {
    const q = [[x, y - 1], [x + 1, y], [x - 1, y]].find(([a, c]) => P.open(a, c));
    if (q) { P.reserve(q[0], q[1]); P.mustReach(q[0], q[1]); m.points[name] = { x: q[0], y: q[1] }; }
  };
  if (level > 1) {   // up here the stairs come out where the front door is downstairs
    const down = level === 2 ? { to: spec.base, spawn: bid + '_stairs' } : { to: G.floorId(bid, level - 1), spawn: 'from_up' };
    m.addDecor('stairs_down', dx, iy1, down);
    m.points.from_down = { x: dx, y: iy1 };
  }
  if (level < top) {
    const at = P.putAny('stairs_up', near, { to: G.floorId(bid, level + 1), spawn: 'from_down' });
    if (at) pointBeside(at[0], at[1], level === 1 ? bid + '_stairs' : 'from_up');
  }
  if (spec.elevator) {
    const at = P.putAny('elevator', near, { building: bid, level });
    if (at) pointBeside(at[0], at[1], level === 1 ? bid + '_elev' : 'from_elev');
  }
}

// A small upper floor: the stairs and the elevator on a landing at the front, a wall with a doorway, and one
// flat behind it (bed and wardrobe on one side, kitchenette on the other, a toilet and shower in the corner,
// a couch and TV), instead of stairs standing in the middle of somebody's kitchen.
function planSmallFlat(m, b, rng, o) {
  if (b.w - 2 < 6 || b.h - 2 < 5) return false;
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);
  const dx = P.dx, wy = P.iy1 - 2;   // a two-row landing: the spots beside the stairs and the elevator stay free
  P.floor(P.ix0, P.iy1 - 1, P.ix1, P.iy1, G.T.tilefloor);
  const lift = new Set(); for (let x = P.ix0; x <= P.ix1; x++) if (P.blocked.has(P.k(x, P.iy1)) || x === dx) lift.add(x);
  const gaps = [dx + 2, dx - 2, dx + 3, dx - 3, P.ix0 + 1, P.ix1 - 1].filter((x) => x > P.ix0 && x < P.ix1 && !lift.has(x));
  if (!gaps.length) return false;
  const g = gaps[0];
  P.hwall(wy, P.ix0, P.ix1, [g]);
  P.floor(P.ix0, P.iy0, P.ix1, wy - 1, G.T.carpet);
  const y0 = P.iy0, y1 = wy - 1;
  if (P.put(rng.pick(['bed', 'bed_red', 'bed_green']), P.ix0, y0)) PT(m, b, 'bed', P.ix0, y0); else { m.addDecor('bed', P.ix0, y0); PT(m, b, 'bed', P.ix0, y0); P.blocked.add(P.k(P.ix0, y0)); }
  P.putAny('nightstand', [[P.ix0 + 1, y0]]);
  P.putAny('wardrobe', [[P.ix0 + 2, y0], [P.ix0, y0 + 2]], {}, { id: b.id + '_chest', owner: o.owner || null, loot: o.loot || [['cigarettes', 1]], gold: rng.int(5, 40) });
  for (const [t, x] of [['fridge', P.ix1], ['stove', P.ix1 - 1], ['kcounter_sink', P.ix1 - 2]]) P.putAny(t, [[x, y0]]);
  PT(m, b, 'kitchen', P.ix1 - 1, y0 + 1);
  if (y1 - y0 >= 2) { P.putAny('toilet', [[P.ix1, y1]]); P.putAny('shower', [[P.ix1 - 1, y1], [P.ix1, y1 - 1]]); }
  P.putAny('couch', [[P.ix0, y1], [P.ix0 + 1, y1]]);
  P.putAny('tv', [[P.ix0 + 3, y1], [P.ix0 + 2, y1]]);
  P.putAny('plant', P.row(P.iy1, P.ix0, P.ix1).filter(([x]) => !lift.has(x) && Math.abs(x - g) > 0).slice(0, 2));
  PT(m, b, 'work', g, y1 >= y0 + 1 ? y1 : y0 + 1);
  return true;
}

function buildFloor(bid, n) {
  const spec = G.FLOORS[bid], base = G.maps.get(spec.base), b0 = base.building(bid);
  const m = new G.TileMap(G.floorId(bid, n), b0.w + 2, b0.h + 2, G.T.wall_dark);
  m.meta = Object.assign({}, base.meta, { name: `${b0.name}, floor ${n}`, floorOf: { map: spec.base, b: bid, level: n }, shelter: undefined, elite: undefined, indoor: true });
  const wall = G.TILES[base.get(b0.x, b0.y)].name;
  let floor = G.TILES[base.get(b0.doorX, b0.doorY - 1)].name;
  if (G.TILES[G.T[floor]].solid || floor === 'door') floor = 'woodfloor';
  const b = m.addBuilding(G.floorId(bid, n), 1, 1, b0.w, b0.h, { name: m.meta.name, wall, floor, roof: 'flat', chimney: false, doorX: b0.doorX - b0.x, kind: 'house' });
  m.set(b.doorX, b.doorY, G.T[wall]);   // no front door up here
  b.floorOf = bid;
  b.ownerId = b0.ownerId;
  const lv = spec.levels[n - 2], rng = new G.RNG(m.id);
  const o = { owner: lv.owner || b0.ownerId || null, pre: (P) => placeLift(P, m, b, spec, n, bid), loot: lv.loot, gold: lv.gold };
  switch (lv.kind) {
    case 'apartment': {   // a corridor with units if it is big enough; a landing and one flat if not; a house plan as the last resort
      const ao = Object.assign({}, o, { loot: o.loot || [['cigarettes', 1], ['wallet', 1], ['beer', 2]] });
      if (!P_.planApartment(m, b, rng, ao) && !planSmallFlat(m, b, rng, ao)) P_.planHouse(m, b, rng, Object.assign(ao, { beds: rng.int(1, 2) }));
      break;
    }
    case 'upstairs': P_.planHouse(m, b, rng, Object.assign(o, { beds: 1, upstairs: true, loot: o.loot || [['book', 1], ['soda', 1]] })); break;
    case 'mansion_up': P_.planHouse(m, b, rng, Object.assign(o, { beds: 1, upstairs: true, carpet: true, loot: o.loot || [['jewelry', 1], ['designer_watch', 1]], gold: 200 })); break;
    case 'penthouse': P_.planHouse(m, b, rng, Object.assign(o, { beds: 1, carpet: true })); break;
    case 'office': P_.planOffice(m, b, rng, Object.assign(o, { bedroom: false, loot: o.loot || [['smartphone', 1], ['letter', 1]] })); break;
    default: planGuestFloor(m, b, rng, o);
  }
  for (const c of m.chests) c.style = c.style || 'dresser';
  m.dangerZones = []; m.animalZones = [];
  m.finalize();
  return m;
}
for (const bid in G.FLOORS) for (let n = 2; n <= G.FLOORS[bid].levels.length + 1; n++) G.MAPGEN[G.floorId(bid, n)] = () => buildFloor(bid, n);
G.buildFloor = buildFloor;

// ground floors get their stairs from the same planner pass; 'casino' is a building kind of its own
const _furnish = MB.furnish;
MB.furnish = function (m, b, kind, rng, o = {}) {
  b.ownerId = o.owner || null;
  const spec = G.FLOORS[b.id];
  if (spec && !o.pre) o = Object.assign({}, o, { pre: (P) => placeLift(P, m, b, spec, 1, b.id) });
  if (kind === 'casino') { const n = m.chests.length; planCasino(m, b, rng, o); for (const c of m.chests.slice(n)) c.style = c.style || 'safe'; return undefined; }
  return _furnish.call(this, m, b, kind, rng, o);
};
})();
