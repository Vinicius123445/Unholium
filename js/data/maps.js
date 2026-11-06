'use strict';
// World maps. Each generator builds a deterministic TileMap (same seed => same map every time).
// Layout of the open world (the city districts are in js/data/districts.js):
//
//              [ FOREST ] ------------------ [ RICH DISTRICT ]
//                  |                       /        |
//   [ RURAL ] -- [ SUBURBS ] -------------          |
//                       \                           |
//                        ------------------- [ CENTER ] -- [ EASTSIDE ]
//                                                |   ~~~boat~~~> [ ISLAND ] (epilogue only)
//                                           [ SOUTHSIDE ] ------- (Eastside)
//
// Named points (m.points) are used by NPC schedules, spawns and quests. Buildings auto-create
// <id>_door, <id>_in, <id>_center, and furniture creates <id>_bed, <id>_work, etc.

G.MAPGEN = {};

const MB = {
  hline(m, x0, x1, y, t, width = 2) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = 0; k < width; k++) m.set(x, y + k, t); },
  vline(m, x, y0, y1, t, width = 2) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < width; k++) m.set(x + k, y, t); },
  ellipse(m, cx, cy, rx, ry, t, only = null) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 && (!only || only.includes(m.get(x, y)))) m.set(x, y, t);
    }
  },
  rectFence(m, x0, y0, x1, y1, t, gaps = []) {
    for (let x = x0; x <= x1; x++) { m.set(x, y0, t); m.set(x, y1, t); }
    for (let y = y0; y <= y1; y++) { m.set(x0, y, t); m.set(x1, y, t); }
    for (const [gx, gy] of gaps) m.set(gx, gy, m.meta.gapTile || G.T.grass);
  },
  scatter(m, rng, types, count, x0, y0, x1, y1, allowed = [G.T.grass], spacing = 0) {
    let placed = 0;
    for (let i = 0; i < count * 12 && placed < count; i++) {
      const type = rng.pick(types);
      const def = G.DECOR[type];
      const fw = def.fw || 1;
      const tx = rng.int(x0, x1 - fw + 1), ty = rng.int(y0, y1);
      if (!m.isFree(tx, ty, fw, 1, allowed)) continue;
      m.addDecor(type, tx, ty);
      if (!def.flat) m.markOccupied(tx - spacing, ty - spacing, fw + spacing * 2, 1 + spacing * 2);
      placed++;
    }
    return placed;
  },
  // Dense band of trees along the map edges (visual boundary)
  border(m, rng, thick, types, density, allowed) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const d = Math.min(x, y, m.w - 1 - x, m.h - 1 - y);
      if (d >= thick) continue;
      if (rng.next() > density * (1 - d / (thick + 1)) + 0.15) continue;
      if (!m.isFree(x, y, 1, 1, allowed)) continue;
      m.addDecor(rng.pick(types), x, y);
      m.markOccupied(x, y);
    }
  },
  noise(x, y, scale, seed) {
    const fx = x / scale, fy = y / scale;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const h = (a, b) => G.util.hash2(a, b, seed) / 4294967296;
    const s = (t) => t * t * (3 - 2 * t);
    const a = G.util.lerp(h(ix, iy), h(ix + 1, iy), s(tx));
    const b = G.util.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), s(tx));
    return G.util.lerp(a, b, s(ty));
  },
  chest(m, id, tx, ty, owner, loot, gold = 0) {
    m.chests.push({ id: m.id + ':' + id, tx, ty, owner, loot, gold });
    m.markOccupied(tx, ty);
  },

  // Furniture layouts by building kind. Keeps the door column clear.
  furnish(m, b, kind, rng, o = {}) {
    const ix0 = b.x + 1, ix1 = b.x + b.w - 2, iy0 = b.y + 1, iy1 = b.y + b.h - 2;
    const dx = b.doorX;
    const pt = (name, x, y) => { m.points[b.id + '_' + name] = { x, y }; };
    const chests0 = m.chests.length;
    const bedType = o.bed || rng.pick(['bed', 'bed_red', 'bed_green']);
    const owner = o.owner || null;
    switch (kind) {
      case 'house': {
        m.addDecor(bedType, ix0, iy0 + 1); pt('bed', ix0, iy0 + 1);
        if (o.beds > 1) { m.addDecor(bedType, ix0 + 1, iy0 + 1); pt('bed2', ix0 + 1, iy0 + 1); }
        if (o.beds > 2 && ix0 + 2 !== dx) { m.addDecor(bedType, ix0 + 2, iy0 + 1); pt('bed3', ix0 + 2, iy0 + 1); }
        if (ix1 !== dx) m.addDecor('shelf', ix1, iy0);
        if (ix1 - 1 !== dx && ix1 - 1 > ix0 + 1) MB.chest(m, b.id + '_chest', ix1 - 1, iy0, owner, o.loot || [['sandwich', 1], ['canned_beans', 1]], o.gold || rng.int(5, 25));
        if (iy1 - 1 > iy0 + 1 && ix1 - 1 !== dx && ix1 !== dx) m.addDecor('table', ix1 - 1, iy1 - 1);
        if (ix0 !== dx) m.addDecor(o.rustic ? 'barrel' : 'fridge', ix0, iy1);
        if (!o.rustic && b.w >= 8 && ix0 + 3 < ix1 - 1 && ix0 + 2 !== dx && ix0 + 3 !== dx && iy1 - 1 > iy0 + 1) m.addDecor('couch', ix0 + 2, iy1 - 1);
        if (!o.rustic && b.w >= 8 && ix0 + 2 !== dx && ix0 + 3 !== dx) m.addDecor('tv', ix0 + 3, iy0);
        pt('work', ix0 + 1 === dx ? ix0 + 2 : ix0 + 1, iy1);
        break;
      }
      case 'shop': {
        m.addDecor('counter', ix0 + 1, iy0 + 1); pt('work', ix0 + 1, iy0);
        m.addDecor('shelf', ix1, iy0); if (ix1 - 1 !== dx) m.addDecor('shelf', ix1 - 1, iy0);
        m.addDecor(bedType, ix1, iy1); pt('bed', ix1, iy1);
        MB.chest(m, b.id + '_chest', ix0, iy1, owner, o.loot || [['bread', 1]], o.gold || rng.int(20, 60));
        break;
      }
      case 'inn': {
        m.addDecor('counter', ix0 + 1, iy0 + 1); pt('work', ix0 + 1, iy0);
        if (ix1 - 2 !== dx) m.addDecor('shelf', ix1 - 2, iy0);
        m.addDecor('bed', ix1, iy0 + 1, { guest: true }); pt('guestbed', ix1, iy0 + 1);
        m.addDecor('bed_red', ix1 - 1, iy0 + 1, { guest: true });
        m.addDecor(bedType, ix0 + 1, iy1); pt('bed', ix0 + 1, iy1);
        for (let tx = ix0 + 2; tx + 1 < ix1 - 1; tx += 3) {
          if (tx === dx || tx + 1 === dx) continue;
          m.addDecor('table', tx, iy1 - 1); m.addDecor('chair', tx, iy1);
        }
        pt('patron', dx, iy0 + 3);
        MB.chest(m, b.id + '_chest', ix0, iy0 + 3, owner, [['beer', 3], ['whiskey', 1]], rng.int(30, 80));
        break;
      }
      case 'temple': {
        m.addDecor('altar', dx - 1, iy0); pt('work', dx, iy0 + 1);
        for (let row = iy0 + 2; row < iy1; row += 2) {
          if (dx - 3 >= ix0) m.addDecor('pew', dx - 3, row);
          if (dx + 2 <= ix1) m.addDecor('pew', dx + 1, row);
        }
        m.addDecor('bed', ix1, iy1); pt('bed', ix1, iy1);
        if (ix0 + 1 < dx - 3 || ix0 !== dx) m.addDecor('lamp', ix0, iy0);
        break;
      }
      case 'barracks': {
        let n = 0;
        for (let tx = ix0; tx <= ix1 && n < 5; tx += 2, n++) { m.addDecor('bed_red', tx, iy0 + 1); pt(n ? 'bed' + (n + 1) : 'bed', tx, iy0 + 1); }
        m.addDecor('table', ix0 + 1, iy1 - 1); m.addDecor('crate', ix1, iy1); m.addDecor('barrel', ix1 - 1, iy1);
        pt('work', ix0 + 4, iy1);
        MB.chest(m, b.id + '_chest', ix1, iy0 + 2, owner, o.loot || [['ammo_9mm', 24], ['police_baton', 1], ['bandage', 3]], 40);
        break;
      }
      case 'manor': {
        m.fill(ix0, iy0, b.w - 2, b.h - 2, G.T.carpet);
        m.addDecor('bed_red', ix0, iy0 + 1); pt('bed', ix0, iy0 + 1);
        m.addDecor('bed', ix0 + 1, iy0 + 1); pt('bed2', ix0 + 1, iy0 + 1);
        m.addDecor('shelf', ix1, iy0); m.addDecor('shelf', ix1 - 1, iy0); m.addDecor('shelf', ix1 - 2, iy0);
        m.addDecor('table', dx - 3, iy0 + 4); m.addDecor('chair', dx - 3, iy0 + 5);
        m.addDecor('statue', ix1, iy1 - 1);
        pt('work', dx + 2, iy0 + 3);
        MB.chest(m, b.id + '_chest', ix1 - 3, iy0, owner, o.loot || [['jewelry', 1], ['gem', 1]], rng.int(120, 250));
        break;
      }
      case 'office': {
        for (let ty = iy0 + 1; ty < iy1; ty += 3) for (let tx = ix0; tx + 1 <= ix1; tx += 4) if (tx !== dx && tx + 1 !== dx) m.addDecor('desk', tx, ty);
        m.addDecor('plant', ix0, iy1); if (ix1 !== dx) m.addDecor('vending', ix1, iy1);
        pt('work', ix0 + 1, iy0 + 2);
        if (o.bedroom !== false) { m.addDecor(bedType, ix1, iy0); pt('bed', ix1, iy0); }
        MB.chest(m, b.id + '_chest', ix0, iy0, owner, o.loot || [['smartphone', 1], ['wallet', 1]], o.gold || rng.int(30, 90));
        break;
      }
      case 'mansion': {
        m.fill(ix0, iy0, b.w - 2, b.h - 2, G.T.carpet);
        m.addDecor('bed_red', ix0, iy0 + 1); pt('bed', ix0, iy0 + 1);
        m.addDecor('bed', ix0 + 1, iy0 + 1); pt('bed2', ix0 + 1, iy0 + 1);
        m.addDecor('couch', dx - 4, iy1 - 2); m.addDecor('tv', dx - 3, iy1 - 4);
        m.addDecor('table', dx + 2, iy0 + 2); m.addDecor('chair', dx + 2, iy0 + 3);
        m.addDecor('statue', ix1, iy1 - 1); m.addDecor('plant', ix0, iy1); m.addDecor('plant', ix1, iy0 + 3);
        m.addDecor('shelf', ix1, iy0); m.addDecor('shelf', ix1 - 1, iy0);
        pt('work', dx + 1, iy0 + 5);
        MB.chest(m, b.id + '_chest', ix1 - 3, iy0, owner, o.loot || [['jewelry', 2], ['designer_watch', 1], ['gem', 1]], rng.int(300, 600));
        break;
      }
      // The Elite's private club: a lounge in front and, behind it, a sanctum where they gather at night.
      case 'club': {
        m.fill(ix0, iy0, b.w - 2, b.h - 2, G.T.carpet);
        const back = iy0 + Math.floor((b.h - 2) / 2);
        for (let tx = ix0; tx <= ix1; tx++) if (Math.abs(tx - dx) > 1) m.set(tx, back, G.T[o.innerWall || 'wall_marble']);
        m.fill(ix0, iy0, b.w - 2, back - iy0, G.T.darkstone);
        m.addDecor('altar', dx - 1, iy0); pt('altar', dx, iy0 + 1);
        m.addDecor('darklamp', ix0, iy0); m.addDecor('darklamp', ix1, iy0);
        for (let tx = ix0 + 1; tx < ix1 - 1; tx += 3) if (Math.abs(tx - dx) > 1 && Math.abs(tx + 1 - dx) > 1) m.addDecor('pew', tx, back - 1);
        m.points[b.id + '_sanctum'] = [{ x: dx - 2, y: iy0 + 2 }, { x: dx + 2, y: iy0 + 2 }, { x: dx - 3, y: iy0 + 3 }, { x: dx + 3, y: iy0 + 3 }, { x: dx, y: iy0 + 3 }];
        m.addDecor('counter', ix0 + 1, iy1 - 1); pt('work', ix0 + 1, iy1 - 2);
        m.addDecor('couch', dx + 2, iy1 - 1); m.addDecor('plant', ix1, iy1); m.addDecor('table', dx - 5, back + 2);
        MB.chest(m, b.id + '_chest', ix1, back + 1, owner, o.loot || [['jewelry', 2], ['letter', 1]], rng.int(200, 400));
        b.sanctum = { x: ix0, y: iy0, w: b.w - 2, h: back - iy0 };
        break;
      }
      case 'garage': {
        m.fill(ix0, iy0, b.w - 2, b.h - 2, G.T.concrete);
        m.addDecor('toolbench', ix0, iy0); pt('work', ix0 + 1, iy0 + 1);
        if (b.w >= 9) m.addDecor(o.car || 'car_gray', ix1 - 1, iy0 + 2);
        m.addDecor(bedType, ix1, iy1); pt('bed', ix1, iy1);
        MB.chest(m, b.id + '_chest', ix0, iy1, owner, o.loot || [['crowbar', 1], ['iron_ore', 3]], rng.int(20, 60));
        break;
      }
      case 'camp': break;
      default: break;
    }
    // modern storage instead of chests, chosen by the kind of room
    const style = o.storage || { house: 'dresser', shop: 'register', inn: 'register', barracks: 'locker', manor: 'safe', mansion: 'safe', club: 'safe', office: 'filing', garage: 'toolbox', temple: 'cabinet' }[kind] || 'cabinet';
    for (const c of m.chests.slice(chests0)) c.style = c.style || style;
  },
};
G.MB = MB;

// ---------------------------------------------------------------- RURAL
// A small country town on the county road: the square, motel, church and shops in the middle, your
// house just west of town, the lake up north, farms east and south, a trailer park across the river,
// and a diner and gas station out on the road toward the suburbs.
G.MAPGEN.rural = () => {
  const m = new G.TileMap('rural', 160, 120, G.T.grass);
  m.meta = { name: 'Rural Zone', region: 'rural', music: 'rural', darkness: 0, district: 'rural' };
  const r = new G.RNG('rural-map-2');

  // the lake (north-west) with a beach and a fishing dock
  MB.ellipse(m, 50, 18, 17, 10, G.T.sand);
  MB.ellipse(m, 50, 17, 15, 8, G.T.water);
  MB.ellipse(m, 50, 16, 9, 4, G.T.deepwater);
  m.fill(56, 25, 2, 5, G.T.dock);
  // the river (west) running north to south
  for (let y = 0; y < m.h; y++) {
    const cx = 30 + Math.round(Math.sin(y * 0.11) * 2);
    for (let i = -3; i <= 3; i++) {
      const bridge = y >= 59 && y <= 63;
      if (m.get(cx + i, y) === G.T.water || m.get(cx + i, y) === G.T.deepwater) continue;
      m.set(cx + i, y, bridge ? G.T.bridge : Math.abs(i) === 3 ? G.T.sand : Math.abs(i) === 2 ? G.T.water : G.T.deepwater);
    }
  }
  // roads: the county road (east-west) and Main Street (north to the forest, south to the farm)
  m.fill(72, 50, 18, 23, G.T.dirt);                           // town square
  MB.hline(m, 0, 159, 60, G.T.asphalt, 3);
  for (let x = 0; x < 160; x += 3) if (m.get(x, 61) === G.T.asphalt) m.set(x, 61, G.T.road_line);
  for (let y = 59; y <= 63; y++) for (let x = 26; x <= 34; x++) if (G.TILES[m.get(x, y)].water || m.get(x, y) === G.T.sand) m.set(x, y, G.T.bridge);
  MB.vline(m, 80, 0, 59, G.T.path);
  MB.vline(m, 80, 63, 92, G.T.path);
  MB.hline(m, 62, 80, 92, G.T.path);                          // to the south farm
  MB.vline(m, 124, 26, 59, G.T.path);                         // to the east farm
  MB.vline(m, 42, 52, 59, G.T.path, 1);                       // your front path (from the door, column 42, down to the road)
  MB.vline(m, 56, 30, 49, G.T.path, 1);                       // down to the lake
  MB.hline(m, 56, 79, 30, G.T.path, 1);
  MB.vline(m, 14, 52, 59, G.T.dirt, 2);                       // trailer park lane
  m.fill(4, 42, 22, 16, G.T.dirt);

  // fields, pens, the graveyard
  m.fill(128, 8, 22, 15, G.T.wheat); MB.rectFence(m, 127, 7, 150, 23, G.T.fence, [[132, 23], [133, 23]]);
  m.fill(106, 10, 13, 10, G.T.cabbage);
  m.fill(40, 92, 16, 13, G.T.wheat);
  m.fill(8, 20, 13, 14, G.T.wheat);
  MB.rectFence(m, 74, 88, 92, 106, G.T.fence, [[74, 92], [74, 93]]);
  MB.rectFence(m, 47, 65, 57, 75, G.T.fence, [[57, 69], [57, 70]]);
  // gas station lot
  m.fill(130, 51, 20, 9, G.T.concrete);

  const B = (id, x, y, w, h, o) => m.addBuilding(id, x, y, w, h, o);
  const home = B('r_home', 38, 45, 9, 7, { name: 'Your House', wall: 'wall_siding', roof: 'blue' });
  const inn = B('r_inn', 60, 43, 11, 7, { name: 'Motel', wall: 'wall_brick', floor: 'tilefloor', roof: 'flat', kind: 'inn' });
  const store = B('r_store', 92, 45, 8, 6, { name: 'General Store', wall: 'wall_siding', floor: 'tilefloor', roof: 'flat_light', kind: 'shop' });
  const watch = B('r_watch', 103, 45, 8, 6, { name: "Sheriff's Office", wall: 'wall_brick', floor: 'tilefloor', roof: 'flat' });
  const elder = B('r_elder', 50, 50, 8, 6, { name: "Mayor's House", wall: 'wall_siding', roof: 'shingle' });
  const chapel = B('r_chapel', 60, 66, 9, 8, { name: 'Church', wall: 'wall_stone', floor: 'stonefloor', roof: 'slate', kind: 'temple', chimney: false });
  const smithy = B('r_smithy', 92, 66, 9, 6, { name: 'Hardware & Auto', wall: 'wall_concrete', floor: 'concrete', roof: 'flat', kind: 'shop' });
  const h1 = B('r_house1', 84, 38, 7, 6, { name: 'House', wall: 'wall_siding', roof: 'shingle' });
  const h2 = B('r_house2', 70, 32, 7, 6, { name: 'House', wall: 'wall_siding', roof: 'red' });
  const h3 = B('r_house3', 84, 26, 7, 6, { name: 'House', wall: 'wall_siding', roof: 'shingle' });
  const h4 = B('r_house4', 104, 66, 7, 6, { name: 'House', wall: 'wall_siding', roof: 'red' });
  const f1 = B('r_farm1', 116, 18, 8, 6, { name: 'East Farmhouse', wall: 'wall_siding', roof: 'shingle' });
  const barn = B('r_barn', 134, 27, 12, 8, { name: 'Barn', wall: 'wall_wood', floor: 'dirt', roof: 'red' });
  const f2 = B('r_farm2', 60, 95, 8, 6, { name: 'South Farmhouse', wall: 'wall_siding', roof: 'shingle' });
  const diner = B('r_diner', 116, 51, 11, 7, { name: 'Diner', wall: 'wall_siding', floor: 'tilefloor', roof: 'flat_light', kind: 'shop' });
  const gas = B('r_gas', 136, 51, 8, 6, { name: 'Gas Station', wall: 'wall_concrete', floor: 'tilefloor', roof: 'flat', kind: 'shop' });
  const lake = B('r_lakehouse', 66, 22, 8, 6, { name: 'Lake House', wall: 'wall_wood', roof: 'green' });
  const t1 = B('r_trailer1', 5, 44, 8, 6, { name: 'Trailer', wall: 'wall_siding', floor: 'woodfloor', roof: 'flat_light' });
  const t2 = B('r_trailer2', 16, 44, 8, 6, { name: 'Trailer', wall: 'wall_siding', floor: 'woodfloor', roof: 'flat_light' });
  const t3 = B('r_trailer3', 5, 51, 8, 6, { name: 'Trailer', wall: 'wall_siding', floor: 'woodfloor', roof: 'flat_dark' });

  MB.furnish(m, home, 'house', r, { owner: 'player', loot: [['sandwich', 2], ['first_aid_kit', 1], ['flashlight', 1]], gold: 40 });
  MB.furnish(m, inn, 'inn', r, { owner: 'r_innkeeper' });
  MB.furnish(m, store, 'shop', r, { owner: 'r_merchant' });
  MB.furnish(m, elder, 'house', r, { owner: 'r_elder', loot: [['book', 1], ['first_aid_kit', 1]], gold: 40 });
  MB.furnish(m, chapel, 'temple', r, { owner: 'r_priest' });
  MB.furnish(m, smithy, 'shop', r, { owner: 'r_smith', loot: [['iron_ingot', 2], ['iron_ore', 3], ['crowbar', 1]] });
  MB.furnish(m, h1, 'house', r, { owner: 'r_villager1' });
  MB.furnish(m, h2, 'house', r, { owner: 'r_villager2' });
  MB.furnish(m, h3, 'house', r, { owner: 'r_villager3' });
  MB.furnish(m, h4, 'house', r, { owner: 'r_apprentice' });
  MB.furnish(m, f1, 'house', r, { owner: 'r_farmer1', loot: [['wheat', 5], ['bread', 2]] });
  MB.furnish(m, barn, 'garage', r, { owner: 'r_farmer1', car: 'car_wreck', loot: [['wheat', 6], ['spear', 1]] });
  MB.furnish(m, f2, 'house', r, { owner: 'r_farmer2', beds: 2, loot: [['egg', 4], ['milk', 2]] });
  MB.furnish(m, watch, 'house', r, { owner: 'r_guard1', beds: 2, loot: [['bandage', 2], ['ammo_9mm', 12]] });
  MB.furnish(m, diner, 'shop', r, { owner: 'r_cook', loot: [['cooked_meat', 2], ['coffee', 2]] });
  MB.furnish(m, gas, 'shop', r, { owner: 'r_attendant', loot: [['oil_flask', 2], ['cigarettes', 4]] });
  MB.furnish(m, lake, 'house', r, { owner: 'r_swimcoach', loot: [['fish', 2]] });
  MB.furnish(m, t1, 'house', r, { owner: 'r_trailer1', loot: [['beer', 3], ['canned_beans', 2]] });
  MB.furnish(m, t2, 'house', r, { owner: 'r_trailer2', loot: [['cigarettes', 4], ['chips', 2]] });
  MB.furnish(m, t3, 'house', r, { owner: 'r_dealer', loot: [['joint', 2], ['crack', 1]], gold: 60 });

  // outdoor props, placed beside buildings and roads, never on them
  m.addDecor('toolbench', 102, 68); m.addDecor('car_wreck', 102, 70); m.points.r_smith_work = { x: 101, y: 72 };
  m.addDecor('well', 86, 55); m.points.r_well = { x: 87, y: 56 };
  m.addDecor('sign', 78, 58);
  m.signs['78,58'] = 'North: The Lake, The Forest\nEast: Diner, Gas Station, The Suburbs\nWest: Your House, Trailer Park\nSouth: Farms';
  for (const [x, y] of [[71, 58], [90, 58], [71, 64], [90, 64], [100, 58], [112, 58], [60, 58], [48, 58], [128, 58], [114, 64], [36, 58]]) m.addDecor('lamp', x, y);
  m.addDecor('car_blue', 45, 53); m.addDecor('mailbox', 40, 53);
  m.addDecor('car_red', 93, 53); m.addDecor('car_gray', 118, 59 - 1); m.addDecor('police_car', 104, 53);
  m.addDecor('gas_pump', 132, 57); m.addDecor('gas_pump', 146, 57); m.addDecor('car_white', 140, 58);
  m.addDecor('bench', 74, 52); m.addDecor('bench', 84, 52);
  for (const [x, y] of [[96, 98], [100, 98], [84, 108]]) m.addDecor('haybale', x, y);
  m.addDecor('trough', 86, 90); m.addDecor('haybale', 78, 102);   // water and feed for the livestock
  for (const [x, y] of [[10, 36], [16, 36], [146, 30], [148, 33]]) m.addDecor('haybale', x, y);
  for (let gx = 49; gx <= 55; gx += 2) for (const gy of [67, 70, 73]) m.addDecor('grave', gx, gy);
  for (const [x, y] of [[10, 51], [21, 51], [13, 57]]) m.addDecor(r.pick(['car_wreck', 'car_gray']), x, y);
  m.addDecor('trashcan', 24, 50); m.addDecor('campfire', 20, 55);
  m.addDecor('bench', 48, 30); m.addDecor('bench', 60, 31);

  m.points.r_square = { x: 82, y: 66 };
  m.points.r_field_e = { x: 138, y: 15 };
  m.points.r_field_s = { x: 48, y: 98 };
  m.points.r_field_w = { x: 14, y: 26 };
  m.points.r_pen = { x: 82, y: 97 };
  m.points.r_graveyard = { x: 52, y: 69 };
  m.points.r_lake_beach = { x: 58, y: 31 };
  m.points.r_trailer_lot = { x: 14, y: 54 };
  m.points.r_gate_e = { x: 154, y: 61 };
  m.points.r_gate_n = { x: 80, y: 4 };
  m.points.r_patrol = [{ x: 80, y: 10 }, { x: 81, y: 61 }, { x: 122, y: 61 }, { x: 38, y: 61 }, { x: 80, y: 90 }];
  m.points.start = m.points.r_home_in;
  m.meta.shelter = 'r_inn_patron';
  m.meta.swimSpot = 'r_lake_beach';
  m.dangerZones = [
    { name: 'Old River Road', x: 18, y: 56, w: 22, h: 10, spawns: { mugger: 1 } },
    { name: 'Trailer Park', x: 4, y: 42, w: 22, h: 16, spawns: { mugger: 1, thug: 1 } },
  ];
  m.points.from_suburbs = { x: 156, y: 61 };
  m.points.from_forest = { x: 80, y: 2 };
  m.addExit(159, 59, 1, 5, 'suburbs', 'from_rural', 'To The Suburbs');
  m.addExit(79, 0, 3, 1, 'forest', 'from_rural', 'To The Forest');

  // nature
  MB.border(m, r, 5, ['oak0', 'oak1', 'oak2', 'pine0', 'pine1'], 0.85, [G.T.grass]);
  MB.scatter(m, r, ['oak0', 'oak1', 'oak2', 'pine0'], 130, 4, 4, 155, 115, [G.T.grass], 1);
  MB.scatter(m, r, ['pine0', 'pine1', 'oak1'], 80, 6, 76, 40, 115, [G.T.grass], 0);
  MB.scatter(m, r, ['bush', 'berrybush', 'rock', 'stump'], 110, 4, 4, 155, 115);
  MB.scatter(m, r, ['flowers', 'tuft', 'tuft', 'pebbles'], 500, 0, 0, 159, 119);
  MB.scatter(m, r, ['mushroom', 'mushroom', 'mushroom', 'chanterelle', 'fly_agaric', 'magic_mushroom'], 18, 0, 0, 159, 119);

  m.animalZones = [
    { kind: 'chicken', x: 75, y: 89, w: 16, h: 16, max: 6, owner: 'r_farmer2', region: 'rural' },
    { kind: 'cow', x: 75, y: 89, w: 16, h: 16, max: 3, owner: 'r_farmer2', region: 'rural' },
    { kind: 'rabbit', x: 96, y: 24, w: 24, h: 14, max: 4 },
    { kind: 'deer', x: 8, y: 80, w: 32, h: 30, max: 3 },
    { kind: 'boar', x: 120, y: 80, w: 30, h: 30, max: 2 },
  ];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- FOREST
G.MAPGEN.forest = () => {
  const m = new G.TileMap('forest', 120, 96, G.T.darkgrass);
  m.meta = { name: 'The Forest', region: 'forest', music: 'forest', darkness: 0.12, gapTile: G.T.darkgrass };
  const r = new G.RNG('forest-map');
  const DG = G.T.darkgrass;

  // clearings
  const clear = (cx, cy, rx, ry) => MB.ellipse(m, cx, cy, rx, ry, G.T.grass);
  clear(60, 60, 6, 5);     // crossroads
  clear(60, 16, 10, 8);    // hunter's lodge
  clear(17, 27, 7, 6);     // hermit
  clear(103, 32, 10, 9);   // bandit camp
  clear(80, 50, 9, 7);     // deer meadow
  clear(88, 78, 7, 6);     // ruins
  clear(16, 10, 7, 6);     // bear den
  clear(106, 72, 6, 5);    // wolf den
  clear(39, 37, 6, 5);     // woodcutter
  // lake
  MB.ellipse(m, 36, 74, 11, 8, G.T.sand);
  MB.ellipse(m, 36, 74, 9, 6, G.T.water);
  MB.ellipse(m, 36, 74, 5, 3, G.T.deepwater);

  // paths
  MB.vline(m, 20, 41, 95, G.T.dirt);
  MB.hline(m, 20, 61, 60, G.T.dirt);
  MB.vline(m, 89, 60, 95, G.T.dirt);
  MB.hline(m, 60, 90, 60, G.T.dirt);
  MB.vline(m, 60, 19, 61, G.T.dirt);
  MB.hline(m, 17, 61, 40, G.T.dirt);
  MB.vline(m, 16, 29, 41, G.T.dirt);
  MB.hline(m, 61, 100, 35, G.T.dirt);
  MB.vline(m, 39, 38, 40, G.T.dirt);

  const lodge = m.addBuilding('f_lodge', 56, 12, 10, 7, { name: "Hunter's Lodge", roof: 'brown', kind: 'shop', doorX: 4 });
  const hermit = m.addBuilding('f_hermit', 13, 23, 7, 6, { name: "Hermit's Hut", roof: 'thatch', kind: 'shop' });
  const cabin = m.addBuilding('f_cabin', 36, 32, 7, 6, { name: "Woodcutter's Cabin", roof: 'brown' });
  MB.furnish(m, lodge, 'shop', r, { owner: 'f_hunter', loot: [['wolf_pelt', 1], ['raw_meat', 2]] });
  MB.furnish(m, hermit, 'shop', r, { owner: 'f_hermit', loot: [['herb', 5], ['mushroom', 3]] });
  MB.furnish(m, cabin, 'house', r, { owner: 'f_woodcutter', loot: [['wood', 6]] });
  m.addDecor('log', 44, 39); m.addDecor('stump', 34, 39); m.addDecor('stump', 43, 34);
  m.points.f_wood_work = { x: 42, y: 39 };
  for (const [x, y] of [[54, 20], [66, 20]]) m.addDecor('barrel', x, y);
  m.addDecor('campfire', 61, 22);

  // bandit camp
  m.addDecor('tent', 96, 28); m.addDecor('tent', 104, 26); m.addDecor('tent', 108, 32); m.addDecor('tent', 98, 37);
  m.addDecor('campfire', 103, 32); m.addDecor('banner', 100, 30);
  m.addDecor('crate', 106, 36); m.addDecor('barrel', 107, 37); m.addDecor('crate', 95, 33);
  MB.chest(m, 'bandit_stash', 105, 29, 'f_bandit_boss', [['gem', 1], ['health_potion', 2], ['shotgun', 1], ['ammo_shells', 12]], 150);
  m.points.f_camp = { x: 102, y: 34 };
  m.points.f_camp_fire = { x: 101, y: 33 };
  m.points.f_boss_bed = { x: 104, y: 28 };
  m.points.f_bed1 = { x: 97, y: 30 };
  m.points.f_bed2 = { x: 108, y: 34 };
  m.points.f_bed3 = { x: 100, y: 39 };
  m.points.f_tracker_bed = { x: 62, y: 24 };

  // ruins
  for (const [x, y] of [[84, 75], [85, 75], [86, 75], [91, 75], [92, 75], [84, 76], [84, 77], [92, 76], [92, 80], [91, 81], [85, 81]]) m.set(x, y, G.T.wall_stone);
  MB.chest(m, 'ruins_chest', 88, 77, null, [['amulet', 1], ['flashlight', 1]], 60);
  m.addDecor('grave', 87, 80); m.addDecor('grave', 89, 80);
  m.points.f_ruins = { x: 88, y: 78 };
  m.points.f_ruins_altar = { x: 88, y: 76 };
  m.points.f_rev_bed1 = { x: 86, y: 78 };
  m.points.f_rev_bed2 = { x: 90, y: 78 };
  m.points.f_rev_bed3 = { x: 87, y: 79 };
  m.meta.ruins = { x: 83, y: 73, w: 11, h: 10 };
  m.meta.shelter = 'f_lodge_in';

  m.points.f_crossroads = { x: 60, y: 60 };
  m.points.f_lake = { x: 46, y: 74 };
  m.points.f_meadow = { x: 80, y: 50 };
  m.points.f_patrol = [{ x: 60, y: 58 }, { x: 80, y: 50 }, { x: 88, y: 78 }, { x: 47, y: 70 }, { x: 21, y: 55 }, { x: 60, y: 30 }];
  m.points.from_rural = { x: 21, y: 93 };
  m.points.from_heights = { x: 90, y: 93 };

  m.addExit(19, 95, 4, 1, 'rural', 'from_forest', 'To Rural Zone');
  m.addExit(88, 95, 4, 1, 'heights', 'from_forest', 'To The Rich District');

  // dense trees driven by noise
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.get(x, y) !== DG) continue;
    const n = MB.noise(x, y, 7, 99);
    const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y) < 3 ? 0.5 : 0;
    if (r.next() < 0.12 + n * 0.32 + edge && m.isFree(x, y, 1, 1, [DG])) {
      m.addDecor(r.pick(['pine0', 'pine1', 'pine0', 'oak1', 'oak2']), x, y);
      m.markOccupied(x, y);
    }
  }
  MB.scatter(m, r, ['bush', 'berrybush', 'rock', 'stump', 'log', 'boulder'], 120, 2, 2, 117, 93, [DG, G.T.grass]);
  MB.scatter(m, r, ['mushroom', 'mushroom', 'chanterelle', 'death_cap', 'death_cap', 'fly_agaric', 'fly_agaric', 'magic_mushroom', 'magic_mushroom'], 40, 2, 2, 117, 93, [DG]);
  MB.scatter(m, r, ['tuft', 'flowers', 'pebbles'], 300, 0, 0, 119, 95, [DG, G.T.grass]);

  m.animalZones = [
    { kind: 'deer', x: 72, y: 44, w: 16, h: 12, max: 6 },
    { kind: 'rabbit', x: 30, y: 44, w: 50, h: 30, max: 8 },
    { kind: 'wolf', x: 98, y: 62, w: 16, h: 18, max: 4 },
    { kind: 'boar', x: 24, y: 62, w: 26, h: 20, max: 3 },
    { kind: 'bear', x: 10, y: 5, w: 14, h: 11, max: 1 },
  ];
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- ISLAND (epilogue)
G.MAPGEN.island = () => {
  const m = new G.TileMap('island', 80, 70, G.T.deepwater);
  m.meta = { name: 'The Island', region: 'island', music: 'island', darkness: 0.25 };
  const r = new G.RNG('island-map');
  MB.ellipse(m, 40, 32, 35, 29, G.T.water);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const d = ((x - 40) / 32) ** 2 + ((y - 32) / 26) ** 2 + (MB.noise(x, y, 5, 3) - 0.5) * 0.25;
    if (d < 1) m.set(x, y, d < 0.8 ? G.T.ash : G.T.darksand);
  }
  MB.vline(m, 39, 28, 56, G.T.darkstone, 3);
  m.fill(37, 55, 7, 8, G.T.dock);
  const fort = m.addBuilding('i_fortress', 26, 12, 28, 16, { name: 'Fortress', wall: 'wall_dark', floor: 'darkstone', roof: 'dark', kind: 'temple', chimney: false });
  MB.furnish(m, fort, 'temple', r, { owner: 'i_leader' });
  m.addDecor('banner', 37, 29); m.addDecor('banner', 43, 29);
  for (let y = 32; y <= 52; y += 5) { m.addDecor('darklamp', 37, y); m.addDecor('darklamp', 43, y); }
  m.addDecor('campfire', 20, 36); m.addDecor('campfire', 60, 38);
  m.addDecor('boat', 39, 63);
  m.points.i_ferry = { x: 40, y: 61 };
  m.points.i_fort = { x: 40, y: 22 };
  m.points.i_yard = [{ x: 40, y: 32 }, { x: 22, y: 38 }, { x: 58, y: 40 }, { x: 40, y: 45 }];
  m.points.from_city = { x: 40, y: 58 };
  MB.scatter(m, r, ['deadtree', 'deadtree', 'rock', 'boulder'], 80, 6, 4, 74, 62, [G.T.ash, G.T.darksand]);
  MB.scatter(m, r, ['skulls', 'pebbles'], 40, 6, 4, 74, 62, [G.T.ash]);
  m.finalize();
  return m;
};
