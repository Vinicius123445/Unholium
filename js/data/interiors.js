'use strict';
// Interiors laid out like real places.
//   Homes:  bedroom(s) and a bathroom at the back behind a partition wall with doorways; the front is the
//           living room and the kitchen/dining corner (fridge, stove, counters, table and chairs).
//   Shops:  a sales floor fitted for the trade (shelves and coolers, gun racks, clothes racks, display
//           cases, barber chairs...), a counter with the clerk behind it, and a staff-only back room.
//   Bars, offices, mansions get restrooms, kitchens, lounges.
// The planner only places a piece of furniture if the doorways, beds and every other piece stay reachable,
// so nobody gets boxed in. Upper floors (separate small maps, reached by stairs or elevator) are built by
// G.FLOORS at the bottom of this file. Points used by NPC schedules keep their names (bed, bed2, work...).

// inner partition walls (appended so saved tile ids never shift)
if (G.T.wall_inner == null) { G.TILES.push({ name: 'wall_inner', tex: 'wall_inner', solid: true, wall: true, mini: '#9a8e7a' }); G.T.wall_inner = G.TILES.length - 1; }

const WOODD = { fuel: 12, flam: 0.5 };
Object.assign(G.DECOR, {
  toilet: { sprite: 'toilet', solid: true, interact: 'toilet' },
  sink: { sprite: 'sink', solid: true, interact: 'well' },
  shower: { sprite: 'shower', solid: true, interact: 'shower' },
  bathtub: { sprite: 'bathtub', solid: true, fw: 2, interact: 'shower' },
  washer: { sprite: 'washer', solid: true, interact: 'look' },
  stove: { sprite: 'stove', solid: true, interact: 'campfire' },
  kcounter: Object.assign({ sprite: 'kcounter', solid: true, interact: 'search', owned: true }, WOODD),
  kcounter_sink: { sprite: 'kcounter_sink', solid: true, interact: 'well' },
  nightstand: Object.assign({ sprite: 'nightstand', solid: true, interact: 'search', owned: true, light: { r: 20, color: '255,220,150' } }, WOODD),
  wardrobe: Object.assign({ sprite: 'wardrobe', solid: true, interact: 'search', owned: true }, WOODD),
  bed_double: Object.assign({ sprite: 'bed_double', solid: true, fw: 2, interact: 'bed' }, WOODD),
  floorlamp: { sprite: 'floorlamp', solid: true, light: { r: 46, color: '255,220,160' } },
  mirror: { sprite: 'mirror', solid: true, interact: 'mirror' },
  piano: Object.assign({ sprite: 'piano', solid: true, fw: 2, interact: 'piano' }, WOODD),
  rug: { sprite: 'rug', flat: true },
  doorway: { sprite: 'doorway', flat: true },
  watercooler: { sprite: 'watercooler', solid: true, interact: 'well' },
  cooler: { sprite: 'cooler', solid: true, interact: 'fridge', owned: true },
  clothes_rack: { sprite: 'clothes_rack', solid: true, interact: 'look' },
  gun_rack: { sprite: 'gun_rack', solid: true, interact: 'look' },
  display_case: { sprite: 'display_case', solid: true, fw: 2, interact: 'look' },
  barstool: { sprite: 'barstool', solid: false, interact: 'sit' },
  barber_chair: { sprite: 'barber_chair', solid: false, interact: 'sit' },
  pooltable: Object.assign({ sprite: 'pooltable', solid: true, fw: 2, interact: 'pool' }, WOODD),
  slot_machine: { sprite: 'slot_machine', solid: true, interact: 'slots' },
  bj_table: { sprite: 'bj_table', solid: true, fw: 2, interact: 'blackjack' },
  roulette: { sprite: 'roulette', solid: true, fw: 2, interact: 'roulette' },
  stairs_up: { sprite: 'stairs_up', solid: true, interact: 'stairs' },
  stairs_down: { sprite: 'stairs_down', flat: true, interact: 'stairs' },
  elevator: { sprite: 'elevator', solid: true, interact: 'elevator' },
  fishing_sign: { sprite: 'fishing_sign', solid: true, interact: 'sign' },
});
// beds are furniture: you walk around them, not through them (people lie down from the side)
for (const k of ['bed', 'bed_red', 'bed_green']) G.DECOR[k].solid = true;

// ---------------------------------------------------------------- the planner
class RoomPlan {
  constructor(m, b) {
    this.m = m; this.b = b;
    this.ix0 = b.x + 1; this.ix1 = b.x + b.w - 2; this.iy0 = b.y + 1; this.iy1 = b.y + b.h - 2;
    this.dx = b.doorX;
    this.blocked = new Set();     // tiles taken by solid furniture
    this.reserved = new Set();    // tiles that must stay empty (door path, seats, hallway)
    this.need = [];               // tiles that must stay reachable
    this.things = [];             // placed pieces: each needs one reachable neighbor
    this.start = [this.dx, this.iy1];
    this.reserve(this.dx, this.iy1);
  }
  k(x, y) { return x + ',' + y; }
  inside(x, y) { return x >= this.ix0 && x <= this.ix1 && y >= this.iy0 && y <= this.iy1; }
  wall(x, y) { return !!G.TILES[this.m.get(x, y)].solid; }
  open(x, y) { return this.inside(x, y) && !this.wall(x, y) && !this.blocked.has(this.k(x, y)); }
  reserve(x, y) { this.reserved.add(this.k(x, y)); }
  mustReach(x, y) { this.need.push([x, y]); }
  reach() {
    const seen = new Set([this.k(...this.start)]), q = [this.start];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ax, ny = y + ay, key = this.k(nx, ny);
        if (seen.has(key) || !this.open(nx, ny)) continue;
        seen.add(key); q.push([nx, ny]);
      }
    }
    return seen;
  }
  ok() {
    const r = this.reach();
    if (this.need.some(([x, y]) => !r.has(this.k(x, y)))) return false;
    return this.things.every((t) => t.tiles.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => r.has(this.k(x + ax, y + ay)))));
  }
  // Try to put a piece of furniture (or, with chest, a container). Returns true if it fits.
  put(type, x, y, extra = {}, chest = null) {
    const def = G.DECOR[type], fw = def ? def.fw || 1 : 1, solid = chest ? true : def.solid;
    const tiles = [];
    for (let i = 0; i < fw; i++) tiles.push([x + i, y]);
    for (const [tx, ty] of tiles) if (!this.inside(tx, ty) || this.wall(tx, ty) || this.blocked.has(this.k(tx, ty)) || this.reserved.has(this.k(tx, ty))) return false;
    if (solid) {
      for (const [tx, ty] of tiles) this.blocked.add(this.k(tx, ty));
      const t = { tiles };
      this.things.push(t);
      if (!this.ok()) { for (const [tx, ty] of tiles) this.blocked.delete(this.k(tx, ty)); this.things.pop(); return false; }
    } else for (const [tx, ty] of tiles) this.reserve(tx, ty);
    if (chest) MB.chest(this.m, chest.id, x, y, chest.owner, chest.loot, chest.gold || 0);
    else this.m.addDecor(type, x, y, extra);
    return true;
  }
  // First spot in the list that works.
  putAny(type, spots, extra, chest) { for (const [x, y] of spots) if (this.put(type, x, y, extra, chest)) return [x, y]; return null; }
  // A partition wall across row y (x0..x1) with doorways at the given columns.
  hwall(y, x0, x1, gaps) {
    for (let x = x0; x <= x1; x++) {
      if (gaps.includes(x)) { this.m.set(x, y, this.m.get(x, y + 1)); this.m.addDecor('doorway', x, y); this.reserve(x, y); this.reserve(x, y + 1); this.reserve(x, y - 1); this.mustReach(x, y - 1); }
      else this.m.set(x, y, G.T.wall_inner);
    }
  }
  vwall(x, y0, y1) { for (let y = y0; y <= y1; y++) this.m.set(x, y, G.T.wall_inner); }
  floor(x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.wall(x, y)) this.m.set(x, y, t); }
  row(y, x0, x1) { const out = []; for (let x = x0; x <= x1; x++) out.push([x, y]); return out; }
}
G.RoomPlan = RoomPlan;

// The back strip of a building split into rooms: returns [{x0,x1}] and builds the walls.
function backRooms(P, depth, plan, doorPick) {
  const wy = P.iy0 + depth;
  const rooms = [];
  let x = P.ix0;
  plan.forEach((w, i) => { rooms.push({ x0: x, x1: x + w - 1, kind: null }); x += w; if (i < plan.length - 1) { P.vwall(x, P.iy0, wy - 1); x++; } });
  const gaps = rooms.map((r) => doorPick(r));
  P.hwall(wy, P.ix0, P.ix1, gaps);
  for (let xx = P.ix0; xx <= P.ix1; xx++) P.reserve(xx, wy + 1);   // hallway along the partition
  return { rooms, wy };
}

const PT = (m, b, name, x, y) => { m.points[b.id + '_' + name] = { x, y }; };

function bedroom(P, m, b, r, depth, o, rng, i) {
  const y0 = P.iy0, owner = o.owner || null;
  const beds = i === 0 ? o.beds || 1 : 1, bedType = o.bed || rng.pick(['bed', 'bed_red', 'bed_green']);
  if (o.carpet) P.floor(r.x0, y0, r.x1, y0 + depth - 1, G.T.carpet);
  const names = i === 0 ? ['bed', 'bed2', 'bed3'] : ['bed' + (i + 3)];
  let placed = 0;
  // a married couple shares a double bed (points bed and bed2 are its two sides)
  const couple = i === 0 && beds >= 2 && Object.keys(G.NPCS || {}).some((id) => {
    const d = G.NPCS[id];
    return d.map === m.id && d.home === b.id && d.relations && Object.keys(d.relations).some((o2) => d.relations[o2] === 'spouse' && G.NPCS[o2] && G.NPCS[o2].home === b.id);
  });
  if (couple && r.x1 > r.x0 && P.put('bed_double', r.x0, y0)) { PT(m, b, 'bed', r.x0, y0); PT(m, b, 'bed2', r.x0 + 1, y0); placed = 2; }
  for (let k = placed; k < beds && k < 3; k++) {
    const x = r.x0 + k;
    if (x > r.x1) break;
    if (P.put(bedType, x, y0)) { PT(m, b, names[k] || 'bed' + (k + 1), x, y0); placed++; }
  }
  if (!placed && i === 0) { m.addDecor(bedType, r.x0, y0); PT(m, b, 'bed', r.x0, y0); P.blocked.add(P.k(r.x0, y0)); }
  P.put('nightstand', r.x0 + placed, y0);
  const loot = i === 0 ? (o.loot || [['sandwich', 1], ['canned_beans', 1]]) : [['cigarettes', 1]];
  P.putAny('dresser', [[r.x1, y0], [r.x1, y0 + 1], [r.x1 - 1, y0]], {}, { id: b.id + (i ? '_chest' + i : '_chest'), owner, loot, gold: i ? 5 : o.gold || rng.int(5, 25) });
  if (r.x1 - r.x0 >= 3 && depth >= 2) P.putAny('wardrobe', [[r.x1 - 1, y0], [r.x1, y0 + depth - 1]]);
  if (depth >= 3) P.putAny('floorlamp', [[r.x0, y0 + depth - 1]]);
  // a computer desk (with its chair in front) when there is room (js/game/furniture.js)
  if (G.DECOR.desk_pc && r.x1 - r.x0 >= 3 && depth >= 3) {
    const at = P.putAny('desk_pc', [[r.x1 - 1, y0 + depth - 2], [r.x0 + 1, y0 + depth - 2]].filter(([x]) => x + 1 <= r.x1));
    if (at) P.put('office_chair', at[0], at[1] + 1);
  }
}
function bathroom(P, m, b, r, depth) {
  P.floor(r.x0, P.iy0, r.x1, P.iy0 + depth - 1, G.T.tilefloor);
  const y0 = P.iy0, w = r.x1 - r.x0 + 1;
  P.put('toilet', r.x0, y0);
  if (w >= 3) P.put('bathtub', r.x0 + 1, y0); else P.put('shower', r.x1, y0);
  P.putAny('sink', [[r.x1, y0 + 1], [r.x0, y0 + 1], [r.x1, y0 + depth - 1]]);
  PT(m, b, 'bath', r.x0, y0 + depth - 1);
}

// ---------------------------------------------------------------- homes
function planHouse(m, b, rng, o) {
  if (b.w - 2 < 6 || b.h - 2 < 5) return planStudio(m, b, rng, o);   // too small for rooms: a studio
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  const depth = ih >= 7 ? 3 : 2;
  const bathW = iw >= 10 ? 3 : 2;
  const two = iw - bathW - 2 >= 8;
  const plan = two ? [Math.floor((iw - bathW - 2) / 2), bathW, iw - bathW - 2 - Math.floor((iw - bathW - 2) / 2)] : (dx - P.ix0 > P.ix1 - dx ? [bathW, iw - bathW - 1] : [iw - bathW - 1, bathW]);
  const { rooms, wy } = backRooms(P, depth, plan, (r) => (r.x1 - r.x0 >= 2 ? r.x1 - 1 : r.x0));
  const bathIdx = two ? 1 : plan[0] === bathW && plan.length === 2 && plan[1] !== bathW ? 0 : 1;
  let bi = 0;
  rooms.forEach((r, i) => { if (i === bathIdx) bathroom(P, m, b, r, depth); else bedroom(P, m, b, r, depth, o, rng, bi++); });
  // front: kitchen on the side away from the bathroom, living room on the other
  const fy0 = wy + 1, fy1 = P.iy1;
  const kitchenLeft = bathIdx !== 0;
  const L = []; for (let x = P.ix0; x < dx; x++) L.push(x);
  const Rr = []; for (let x = P.ix1; x > dx; x--) Rr.push(x);
  const kx = kitchenLeft ? L : Rr, lx = kitchenLeft ? Rr : L;
  if (!o.rustic) P.floor(kitchenLeft ? P.ix0 : dx + 1, fy0 + 1, kitchenLeft ? dx - 1 : P.ix1, fy1, G.T.tilefloor);
  const bottom = (xs) => xs.map((x) => [x, fy1]);
  if (o.upstairs) {   // an upper floor: a den or playroom instead of a kitchen
    for (const t of ['couch', 'tv', 'shelf', 'desk', 'washer', 'plant']) P.putAny(t, bottom(kx).concat(bottom(lx)).map(([x, y]) => [Math.min(x, P.ix1 - (G.DECOR[t].fw || 1) + 1), y]));
    if (fy1 - fy0 >= 2) P.putAny('pooltable', kx.concat(lx).map((x) => [Math.min(x, P.ix1 - 1), fy0 + 1]).filter(([x]) => x !== dx && x + 1 !== dx));
    PT(m, b, 'work', dx === P.ix0 ? dx + 1 : dx - 1, fy0);
    return true;
  }
  const kit = o.rustic ? ['barrel', 'stove', 'kcounter_sink'] : ['fridge', 'stove', 'kcounter_sink', 'kcounter'];
  for (const t of kit) P.putAny(t, bottom(kx));
  P.putAny('cabinet', bottom(kx).concat(bottom(lx)), {}, { id: b.id + '_kitchen', owner: o.owner || null, loot: [['canned_beans', 1], ['chips', 1], ['soda', 1]], gold: 0 });
  PT(m, b, 'kitchen', kx[0] != null ? kx[Math.min(1, kx.length - 1)] : dx, fy1 - 1 >= fy0 ? fy1 - 1 : fy0);
  // dining table with chairs (needs a free row under it for the seats)
  const seatFree = (x, y) => P.open(x, y) && !P.reserved.has(P.k(x, y));
  if (fy1 - fy0 >= 2) {
    for (const x of kx.concat(lx)) {
      const tx = Math.min(x, P.ix1 - 1);
      if (tx === dx || tx + 1 === dx || !seatFree(tx, fy0 + 2) || !seatFree(tx + 1, fy0 + 2)) continue;
      if (P.put('table', tx, fy0 + 1)) { P.put('chair', tx, fy0 + 2); P.put('chair', tx + 1, fy0 + 2); break; }
    }
  } else {
    const spot = P.putAny('table', bottom(lx).filter(([x]) => x - 1 !== dx && x + 1 <= P.ix1).map(([x, y]) => [Math.min(x, P.ix1 - 1), y]));
    if (spot) P.putAny('chair', [[spot[0] - 1, spot[1]], [spot[0] + 2, spot[1]]]);
  }
  if (!o.rustic) { P.putAny('couch', bottom(lx).map(([x, y]) => [Math.min(x, P.ix1 - 1), y]).concat(lx.map((x) => [Math.min(x, P.ix1 - 1), fy0 + 1]))); P.putAny('tv', bottom(lx).concat(lx.map((x) => [x, fy0 + 1]))); }
  if (!o.rustic && G.DECOR.armchair) { P.putAny('armchair', lx.map((x) => [x, fy0 + 1]).concat(bottom(lx))); P.putAny('coffee_table', lx.map((x) => [x, fy1 - 1]).filter(([x]) => x !== dx)); P.putAny('bookcase', [[P.ix1, fy0 + 1], [P.ix0, fy0 + 1]]); }   // the living room, furnished
  if (o.rustic) P.putAny('shelf', bottom(lx));
  P.putAny('plant', [[dx - 1, fy1], [dx + 1, fy1]]);
  if (iw >= 8 && fy1 - fy0 >= 2 && !o.rustic) { const rx = lx.find((x) => x - 1 > dx || x + 2 < dx); if (rx != null && !P.reserved.has(P.k(rx, fy0 + 1))) m.addDecor('rug', Math.min(rx, P.ix1 - 1), fy0 + 1); }
  PT(m, b, 'work', dx === P.ix0 ? dx + 1 : dx - 1, fy0);
  return true;
}

// A one-room cottage or trailer: bed in a corner, toilet and shower in the other, a kitchenette by the door.
function planStudio(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  if (iw < 4 || ih < 4) return false;
  const bedType = o.bed || rng.pick(['bed', 'bed_red', 'bed_green']);
  const bedX = dx - P.ix0 >= P.ix1 - dx ? P.ix0 : P.ix1, other = bedX === P.ix0 ? P.ix1 : P.ix0, step = bedX === P.ix0 ? 1 : -1;
  const names = ['bed', 'bed2', 'bed3'];
  for (let k = 0; k < (o.beds || 1); k++) if (P.put(bedType, bedX + k * step, P.iy0)) PT(m, b, names[k], bedX + k * step, P.iy0);
  if (!m.points[b.id + '_bed']) { m.addDecor(bedType, bedX, P.iy0); PT(m, b, 'bed', bedX, P.iy0); P.blocked.add(P.k(bedX, P.iy0)); }
  P.put('nightstand', bedX + (o.beds || 1) * step, P.iy0);
  // bathroom corner
  P.floor(other, P.iy0, other, P.iy0 + 1, G.T.tilefloor);
  P.put('toilet', other, P.iy0);
  if (!o.rustic) P.put('shower', other - step, P.iy0); else P.put('sink', other - step, P.iy0);
  PT(m, b, 'bath', other, P.iy0 + 1);
  P.putAny('dresser', [[other, P.iy0 + 2], [bedX, P.iy0 + 2]], {}, { id: b.id + '_chest', owner: o.owner || null, loot: o.loot || [['sandwich', 1], ['canned_beans', 1]], gold: o.gold || rng.int(5, 25) });
  const bottom = []; for (let x = P.ix0; x <= P.ix1; x++) if (x !== dx) bottom.push([x, P.iy1]);
  bottom.sort((a, c) => Math.abs(c[0] - dx) - Math.abs(a[0] - dx));
  for (const t of o.rustic ? ['barrel', 'stove'] : ['fridge', 'stove', 'kcounter_sink']) P.putAny(t, bottom);
  P.putAny('table', bottom.filter(([x]) => x + 1 <= P.ix1 && x + 1 !== dx));
  if (!o.rustic) P.putAny('tv', bottom);
  PT(m, b, 'work', dx === P.ix0 ? dx + 1 : dx - 1, P.iy1 - 1);
  return true;
}

// ---------------------------------------------------------------- shops
const SHOP_STYLE = {
  c_store: 'grocery', u_store: 'grocery', x_bodega: 'grocery', s_liquor: 'liquor', r_store: 'grocery', r_gas: 'grocery', c_armory: 'guns',
  c_alchemist: 'pharmacy', c_clothes: 'clothes', c_barber: 'barber', s_pawn: 'pawn', h_jeweler: 'jeweler', r_diner: 'diner', r_general: 'grocery',
};
function planShop(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  if (iw < 5 || ih < 5) return false;
  const style = o.style || SHOP_STYLE[b.id] || 'grocery', owner = o.owner || null;
  // staff-only back room: 1 row deep in small shops, 2 in bigger ones
  const depth = ih >= 7 ? 2 : 1;
  const plan = iw >= 8 ? [iw - 3, 2] : [iw];
  const { rooms, wy } = backRooms(P, depth, plan, (r) => (r.x1 - r.x0 >= 2 ? r.x0 + 1 : r.x0));
  const back = rooms[0];
  b.backroom = { x: back.x0, y: P.iy0, w: (rooms[rooms.length - 1].x1 - back.x0) + 1, h: depth };
  const bedType = o.bed || rng.pick(['bed', 'bed_red', 'bed_green']);
  if (P.put(bedType, back.x1, P.iy0)) PT(m, b, 'bed', back.x1, P.iy0); else { m.addDecor(bedType, back.x1, P.iy0); PT(m, b, 'bed', back.x1, P.iy0); }
  P.putAny('safe', P.row(P.iy0, back.x0, back.x1 - 1), {}, { id: b.id + '_chest', owner, loot: o.loot || [['bread', 1]], gold: o.gold || rng.int(20, 60) });
  P.putAny('crate', P.row(P.iy0, back.x0, back.x1 - 1));
  if (rooms[1]) { const t = rooms[1]; P.floor(t.x0, P.iy0, t.x1, P.iy0 + depth - 1, G.T.tilefloor); P.put('toilet', t.x0, P.iy0); if (depth > 1) P.put('sink', t.x1, P.iy0); }
  // counter with the clerk behind it, near the door
  const fy0 = wy + 1, fy1 = P.iy1;
  const cx = dx - P.ix0 >= 3 ? P.ix0 : dx + 1 <= P.ix1 - 1 ? P.ix1 - 1 : P.ix0;
  P.reserve(cx, fy0); P.reserve(cx, fy0 + 2); P.mustReach(cx, fy0); P.mustReach(cx, fy0 + 2);
  P.put('counter', cx, fy0 + 1);
  if (style === 'diner') {   // the kitchen is in the back; stools at the counter
    P.putAny('stove', P.row(P.iy0, back.x0, back.x1 - 1));
    P.putAny('fridge', P.row(P.iy0, back.x0, back.x1 - 1));
    P.put('barstool', cx + 1, fy0 + 2);
  }
  PT(m, b, 'work', cx, fy0);
  // fixtures for the trade, along the walls first, then in the middle
  const wallSpots = [];
  for (let y = fy0 + 1; y <= fy1; y++) { wallSpots.push([P.ix1, y]); wallSpots.push([P.ix0, y]); }
  for (let x = P.ix0; x <= P.ix1; x++) wallSpots.push([x, fy1]);
  const mid = [];
  for (let y = fy0 + 1; y < fy1; y++) for (let x = P.ix0 + 1; x < P.ix1; x++) mid.push([x, y]);
  const spots = wallSpots.concat(mid).filter(([x]) => x !== dx);
  const fixtures = {
    grocery: ['cooler', 'cooler', 'shelf', 'shelf', 'shelf', 'shelf', 'plant'],
    liquor: ['cooler', 'shelf', 'shelf', 'shelf', 'cooler'],
    guns: ['gun_rack', 'gun_rack', 'gun_rack', 'display_case', 'shelf'],
    pharmacy: ['shelf', 'shelf', 'shelf', 'display_case', 'cooler', 'plant'],
    clothes: ['clothes_rack', 'clothes_rack', 'clothes_rack', 'clothes_rack', 'mirror', 'plant'],
    barber: ['barber_chair', 'mirror', 'barber_chair', 'mirror', 'sink', 'plant'],
    pawn: ['display_case', 'shelf', 'gun_rack', 'shelf', 'tv'],
    jeweler: ['display_case', 'display_case', 'mirror', 'plant', 'plant'],
    diner: [],
  }[style] || ['shelf', 'shelf'];
  for (const f of fixtures) P.putAny(f, spots);
  if (style === 'diner') {
    let n = 0;
    for (const [x, y] of mid.concat(wallSpots)) {
      if (n >= 3 || x === dx || x + 1 === dx || !P.open(x, y + 1) || !P.open(x + 1, y + 1) || P.reserved.has(P.k(x, y + 1)) || P.reserved.has(P.k(x + 1, y + 1))) continue;
      if (P.put('table', x, y)) { P.put('chair', x, y + 1); P.put('chair', x + 1, y + 1); n++; }
    }
  }
  return true;
}

// ---------------------------------------------------------------- bar / motel
function planInn(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  if (iw < 9 || ih < 6) return false;
  const owner = o.owner || null, bedType = o.bed || rng.pick(['bed', 'bed_red', 'bed_green']);
  // back: owner's room, two guest rooms, restrooms
  const plan = iw >= 12 ? [3, 2, 3, iw - 11] : [3, 2, iw - 7];
  const { rooms, wy } = backRooms(P, 2, plan, (r) => r.x0);
  const [own, rest, g1, g2] = rooms;
  if (P.put(bedType, own.x1, P.iy0)) PT(m, b, 'bed', own.x1, P.iy0);
  P.putAny('safe', [[own.x0 + 1, P.iy0], [own.x0, P.iy0]], {}, { id: b.id + '_chest', owner, loot: [['beer', 3], ['whiskey', 1]], gold: rng.int(30, 80) });
  P.floor(rest.x0, P.iy0, rest.x1, P.iy0 + 1, G.T.tilefloor);
  P.put('toilet', rest.x1, P.iy0); P.put('sink', rest.x1, P.iy0 + 1);
  if (P.put('bed', g1.x1, P.iy0, { guest: true })) PT(m, b, 'guestbed', g1.x1, P.iy0);
  P.putAny('nightstand', [[g1.x1 - 1, P.iy0]]);
  if (g2 && g2.x1 - g2.x0 >= 1) { P.put('bed_red', g2.x1, P.iy0, { guest: true }); P.putAny('nightstand', [[g2.x1 - 1, P.iy0]]); }
  else if (g1.x1 - g1.x0 >= 2) P.put('bed_red', g1.x0 + 1, P.iy0, { guest: true });
  // front: the bar counter with stools, tables, a pool table, a jukebox corner
  const fy0 = wy + 1, fy1 = P.iy1;
  P.reserve(P.ix0 + 1, fy0); P.mustReach(P.ix0 + 1, fy0);
  // a real bar: a run of counter with the bottles on the wall behind it and stools along the customers' side
  const barEnd = Math.min(P.ix0 + 5, dx - 3);
  for (let x = P.ix0; x + 1 <= barEnd + 1; x += 2) if (G.DECOR.v_bar) { if (P.put('v_bar', x, fy0 + 1)) { P.put('barstool', x, fy0 + 2); P.put('barstool', x + 1, fy0 + 2); } if (G.TILES[m.get(x, wy)].wall && G.DECOR.v_backbar) m.addDecor('v_backbar', x, wy).y = (wy + 1) * 16 - 1; }
  if (!G.DECOR.v_bar) P.put('counter', P.ix0 + 1, fy0 + 1);
  PT(m, b, 'work', P.ix0 + 1, fy0);
  PT(m, b, 'patron', P.ix0 + 1, fy0 + 2);
  if (fy1 - fy0 >= 3) P.putAny('pooltable', [[P.ix1 - 2, fy0 + 1], [P.ix1 - 1, fy0 + 1]]);
  for (let x = P.ix1 - 1; x > P.ix0 + 3; x -= 3) {
    if (x === dx || x + 1 === dx || x - 1 === dx) continue;
    if (P.put('table', x - 1, fy1 - 1)) { P.put('chair', x - 1, fy1); P.put('chair', x, fy1); }
  }
  P.putAny('plant', [[P.ix1, fy1], [P.ix0, fy1]]);
  return true;
}

// ---------------------------------------------------------------- office
function planOffice(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1, dx = P.dx;
  if (iw < 8 || ih < 6) return false;
  const owner = o.owner || null;
  const { rooms, wy } = backRooms(P, 2, [iw - 3, 2], (r) => r.x0 + 1);
  const [boss, wc] = rooms;
  if (o.carpet !== false) P.floor(boss.x0, P.iy0, boss.x1, P.iy0 + 1, G.T.carpet);
  P.put('desk', boss.x0 + 1, P.iy0);
  if (o.bedroom !== false) { const bt = o.bed || 'bed'; if (P.put(bt, boss.x1, P.iy0)) PT(m, b, 'bed', boss.x1, P.iy0); }
  P.putAny('filing', [[boss.x0, P.iy0], [boss.x1 - 1, P.iy0]], {}, { id: b.id + '_chest', owner, loot: o.loot || [['smartphone', 1], ['wallet', 1]], gold: o.gold || rng.int(30, 90) });
  P.putAny('plant', [[boss.x1, P.iy0 + 1]]);
  P.floor(wc.x0, P.iy0, wc.x1, P.iy0 + 1, G.T.tilefloor); P.put('toilet', wc.x1, P.iy0); P.put('sink', wc.x1, P.iy0 + 1);
  const fy0 = wy + 1, fy1 = P.iy1;
  PT(m, b, 'work', P.ix0 + 1, fy0 + 2 <= fy1 ? fy0 + 2 : fy0);
  for (let y = fy0 + 1; y < fy1; y += 2) for (let x = P.ix0; x + 1 <= P.ix1; x += 3) { if (x === dx || x + 1 === dx) continue; if (P.put('desk', x, y)) P.put('chair', x, y + 1); }
  P.putAny('watercooler', [[P.ix1, fy1], [P.ix0, fy1]]);
  P.putAny('vending', [[P.ix1, fy0 + 1], [P.ix0, fy1]]);
  P.putAny('plant', [[dx - 1, fy1], [dx + 1, fy1]]);
  return true;
}

// ---------------------------------------------------------------- mansion (ground floor; bedrooms upstairs too)
function planMansion(m, b, rng, o) {
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);   // stairs / elevator first
  const iw = P.ix1 - P.ix0 + 1, dx = P.dx, owner = o.owner || null;
  if (iw < 14) return false;
  P.floor(P.ix0, P.iy0, P.ix1, P.iy1, G.T.carpet);
  const { rooms, wy } = backRooms(P, 3, [5, 3, iw - 10], (r) => r.x0 + 1);
  const [master, bath, study] = rooms;
  P.put('bed_red', master.x0, P.iy0); PT(m, b, 'bed', master.x0, P.iy0);
  P.put('bed', master.x0 + 1, P.iy0); PT(m, b, 'bed2', master.x0 + 1, P.iy0);
  P.put('nightstand', master.x0 + 2, P.iy0); P.putAny('wardrobe', [[master.x1, P.iy0]]);
  P.putAny('safe', [[master.x1, P.iy0 + 2], [master.x1 - 1, P.iy0]], {}, { id: b.id + '_chest', owner, loot: o.loot || [['jewelry', 2], ['designer_watch', 1], ['gem', 1]], gold: rng.int(300, 600) });
  P.putAny('mirror', [[master.x0, P.iy0 + 2]]);
  bathroom(P, m, b, bath, 3);
  P.putAny('desk', [[study.x0 + 1, P.iy0]]); P.putAny('shelf', P.row(P.iy0, study.x0, study.x1)); P.putAny('shelf', P.row(P.iy0, study.x0, study.x1)); P.putAny('floorlamp', [[study.x1, P.iy0 + 2]]);
  const fy0 = wy + 1, fy1 = P.iy1;
  // dining room on one side, lounge with piano on the other, kitchen in the corner
  P.floor(P.ix0, fy1 - 1, P.ix0 + 3, fy1, G.T.tilefloor);
  for (const t of ['fridge', 'stove', 'kcounter_sink', 'kcounter']) P.putAny(t, P.row(fy1, P.ix0, dx - 2));
  for (let x = P.ix0; x < dx - 2; x++) if (P.put('table', x, fy0 + 1)) { P.put('chair', x, fy0 + 2); P.put('chair', x + 1, fy0 + 2); break; }
  P.putAny('piano', [[dx + 3, fy0 + 1], [dx + 2, fy0 + 1]]);
  P.putAny('couch', [[P.ix1 - 2, fy1], [P.ix1 - 1, fy1]]); P.putAny('tv', [[P.ix1, fy1 - 1], [P.ix1, fy0 + 1]]);
  P.putAny('statue', [[P.ix1, fy0 + 1]]); P.putAny('plant', [[dx - 1, fy1], [dx + 1, fy1]]);
  m.addDecor('rug', dx + 2, fy1 - 1);
  PT(m, b, 'work', dx + 1, fy0);
  return true;
}

const _furnish = MB.furnish;
MB.furnish = function (m, b, kind, rng, o = {}) {
  const chests0 = m.chests.length;
  const plan = { house: planHouse, shop: planShop, inn: planInn, office: planOffice, mansion: planMansion }[kind];
  if (!plan || !plan(m, b, rng, o)) return _furnish.call(this, m, b, kind, rng, o);
  const style = o.storage || { house: 'dresser', shop: 'register', inn: 'register', office: 'filing', mansion: 'safe' }[kind];
  for (const c of m.chests.slice(chests0)) c.style = c.style || style;
  b.planned = kind;
  return undefined;
};
// containers placed by the planner say what they are (the "type" passed to put() for chests)
const _put = RoomPlan.prototype.put;
RoomPlan.prototype.put = function (type, x, y, extra, chest) {
  const n = this.m.chests.length, ok = _put.call(this, type, x, y, extra, chest);
  if (ok && chest && this.m.chests.length > n) this.m.chests[this.m.chests.length - 1].style = type;
  return ok;
};

G.INTERIOR = { backRooms, planHouse, planStudio, planShop, planInn, planOffice, planMansion, RoomPlan };

// ---------------------------------------------------------------- apartment blocks
// A corridor runs along the front (you come in from the street into it); the units are behind it, each
// behind its own doorway: a bed and nightstand at the back, a kitchenette (fridge, stove), a small table
// or couch, and a toilet and shower when the unit is deep and wide enough. Residents keep their beds
// (bed, bed2, bed3... one per unit).
function planApartment(m, b, rng, o) {
  if (b.w - 2 < 8 || b.h - 2 < 6) return false;   // too small for a corridor and units
  const P = new RoomPlan(m, b);
  if (o.pre) o.pre(P);
  const iw = P.ix1 - P.ix0 + 1, ih = P.iy1 - P.iy0 + 1;
  const depth = Math.min(5, ih - 3);
  const plan = []; let rem = iw;
  while (rem > 0) { const w = rem <= 6 ? rem : rem - 5 >= 4 ? 4 : rem - 4; plan.push(w); rem -= w + 1; if (rem > 0 && rem < 3) { plan[plan.length - 1] += rem + 1; rem = 0; } }
  const { rooms, wy } = backRooms(P, depth, plan, (r) => r.x0 + Math.floor((r.x1 - r.x0) / 2));
  P.floor(P.ix0, wy + 1, P.ix1, P.iy1, G.T.tilefloor);
  rooms.forEach((r, i) => {
    const y0 = P.iy0, w = r.x1 - r.x0 + 1;
    const bedName = i === 0 ? 'bed' : 'bed' + (i + 1);
    if (P.put(rng.pick(['bed', 'bed_red', 'bed_green']), r.x1, y0)) PT(m, b, bedName, r.x1, y0);
    else { m.addDecor('bed', r.x1, y0); PT(m, b, bedName, r.x1, y0); P.blocked.add(P.k(r.x1, y0)); }
    P.putAny('nightstand', [[r.x1 - 1, y0]]);
    P.putAny('fridge', [[r.x0, y0]]);
    if (depth >= 3) P.putAny('stove', [[r.x0, y0 + 1]]);
    if (depth >= 4 && w >= 4) { P.putAny('toilet', [[r.x1, y0 + depth - 1], [r.x1, y0 + depth - 2]]); P.putAny('shower', [[r.x1, y0 + 2]]); }
    P.putAny(w >= 4 ? 'couch' : 'chair', [[r.x0 + 1, y0], [r.x0 + 1, y0 + 2]]);
    P.putAny('wardrobe', [[r.x0 + 1, y0], [r.x1 - 1, y0 + 2]], {}, { id: b.id + '_unit' + (i + 1), owner: o.owner || null, loot: o.loot || [['cigarettes', 1], ['beer', 1]], gold: rng.int(5, 40) });
    if (i === 0) PT(m, b, 'kitchen', r.x0 + 1, y0 + 1);
  });
  // the corridor: lights and a plant at each end, a mailbox wall by the entrance
  const cy = P.iy1;
  P.putAny('plant', [[P.ix0, cy], [P.ix0, cy - 1]]); P.putAny('plant', [[P.ix1, cy], [P.ix1, cy - 1]]);
  P.putAny('floorlamp', [[P.ix0 + 1, cy], [P.ix1 - 1, cy]]);
  if (iw >= 12) P.putAny('vending', P.row(cy, P.ix0 + 2, P.ix1 - 2).filter(([x]) => Math.abs(x - P.dx) > 2));
  PT(m, b, 'work', P.dx === P.ix0 ? P.dx + 1 : P.dx - 1, wy + 1);
  b.apartment = true;
  return true;
}
const _furnishA = MB.furnish;
MB.furnish = function (m, b, kind, rng, o = {}) {
  if (kind === 'house' && /Apartment|Tenement|Flats/.test(b.name || '') && b.w - 2 >= 8 && b.h - 2 >= 6) {
    const chests0 = m.chests.length;
    if (planApartment(m, b, rng, o)) { for (const c of m.chests.slice(chests0)) c.style = c.style || 'dresser'; b.planned = 'apartment'; return undefined; }
  }
  return _furnishA.call(this, m, b, kind, rng, o);
};
G.INTERIOR.planApartment = planApartment;

// ---------------------------------------------------------------- the register sits on the counter
// (it used to stand on its own somewhere near the door)
const _furnishR = MB.furnish;
MB.furnish = function (m, b, kind, rng, o = {}) {
  const r = _furnishR.call(this, m, b, kind, rng, o);
  const inB = (x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1;
  const counter = m.decor.find((d) => (d.type === 'counter' || d.type === 'kcounter') && inB(d.tx, d.ty) && d.type === 'counter');
  if (counter) for (const c of m.chests) {
    if (c.style !== 'register' || !inB(c.tx, c.ty)) continue;
    c.tx = counter.tx + 1; c.ty = counter.ty; c.onCounter = true;
  }
  return r;
};
