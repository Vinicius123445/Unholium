'use strict';
// Rooms furnished for their new size. Doubling a floor plan quadruples its floor and leaves the same few pieces standing in it,
// so every room is walked here: a rug where people gather, things along the walls, a corner that belongs to someone.
// A solid piece only stays if everything that could be reached from the door before still can be, and nothing sits on a
// named spot (a bed someone sleeps in, the place a worker stands).
(() => {
const HOME = /house|apartment|manor|inn|cabin|mansion/i, SHOP = /shop|store|market/i;
function rooms(m, b) {
  const seen = new Set(), out = [], inside = (x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1, wall = (x, y) => { const t = G.TILES[m.get(x, y)]; return !t || t.solid || t.name === 'door' || m.decorsAt(x, y).some((d) => d.type === 'doorway'); };   // (an opening with a frame ends a room)
  for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
    if (seen.has(x + ',' + y) || wall(x, y)) continue;
    const tiles = [], q = [[x, y]];
    while (q.length) { const [a, c] = q.pop(), k = a + ',' + c; if (seen.has(k) || !inside(a, c) || wall(a, c)) continue; seen.add(k); tiles.push([a, c]); q.push([a + 1, c], [a - 1, c], [a, c + 1], [a, c - 1]); }
    out.push(tiles);
  }
  return out;
}
const flood = (m, b, extra) => { const s = new Set(), q = [[b.doorX, b.doorY - 1]]; while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (s.has(k) || extra.has(k) || x <= b.x || y <= b.y || x >= b.x + b.w - 1 || y >= b.y + b.h - 1 || m.isSolidTile(x, y)) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return s.size; };
// The middle of a big room, by what the building is for: [piece, across, down] repeated over the floor on a step of sx by sy.
// Stages, dance floors and lanes are floor pieces, so nothing lands on them; a group that would cut off any floor is left out.
const seats = { step: [8, 7], put: [['chair', 0, -1], ['chair', 1, -1], ['table', 0, 0], ['chair', 0, 1], ['chair', 1, 1]] }, rows = (t, n, sy = 5, sx) => ({ step: [sx || n * (G.DECOR[t] && G.DECOR[t].fw || 1) + 3, sy], put: Array.from({ length: n }, (_, i) => [t, i * (G.DECOR[t] && G.DECOR[t].fw || 1), 0]) });
const PAT = (b) => {
  const k = b.venue && G.VENUES[b.venue] ? G.VENUES[b.venue].kind : null, id = b.id || '', fk = b._fur ? b._fur.kind : b.kind || '';
  if (k) {
    if (/^(dive|punk|den|karaoke|cafe|italian|japanese|brazilian|diner)$/.test(k)) return seats;
    if (k === 'casino') return { step: [9, 6], put: [['slot_machine', 0, 0], ['slot_machine', 1, 0], ['slot_machine', 2, 0], ['slot_machine', 3, 0], ['slot_machine', 4, 0]] };
    if (k === 'pool') return { step: [8, 6], put: [['pooltable', 0, 0]] };
    if (k === 'arcade') return { step: [7, 5], put: [['v_arcade1', 0, 0], ['v_arcade2', 1, 0], ['v_arcade3', 2, 0], ['v_arcade1', 3, 0]] };
    if (k === 'internet' || k === 'office') return { step: [7, 5], put: [['desk', 0, 0], ['chair', 0, 1]] };
    if (k === 'gym') return { step: [8, 6], put: [['v_heavybag', 0, 0], ['v_benchpress', 2, 0]] };
    if (k === 'library') return rows('v_bookcase', 3);
    if (k === 'museum' || k === 'gallery') return { step: [9, 7], put: [['v_display_case', 0, 0], ['v_sculpture', 3, 0]] };
    if (k === 'store' || k === 'market') return rows('shelf', 6);
    return null;
  }
  if (/ruin/.test(id)) return null;
  if (/factory/.test(id)) return { step: [11, 7], put: [['v_machine', 0, 0], ['v_machine', 3, 0], ['toolbench', 6, 0]] };
  if (/ware|cannery|supply/.test(id)) return { step: [10, 5], put: [['v_pallet', 0, 0], ['v_box_stack', 2, 0], ['crate', 3, 0], ['barrel', 4, 0], ['v_box_stack', 5, 0], ['v_pallet', 6, 0]] };
  if (/barn|stable/.test(id) || fk === 'barn') return { step: [8, 5], put: [['haybale', 0, 0], ['haybale', 1, 0], ['haybale', 2, 0], ['crate', 3, 0]] };
  if (/garage/.test(id) || fk === 'garage') return { step: [10, 6], put: [['toolbench', 0, 0], ['v_tire_stack', 2, 0], ['v_oil_drum', 3, 0]] };
  if (/casino/.test(id)) return { step: [9, 6], put: [['bj_table', 0, 0], ['slot_machine', 3, 0], ['slot_machine', 4, 0]] };
  if (fk === 'temple' || /chapel|prayer/.test(id)) return { step: [10, 3], put: [['pew', 0, 0], ['pew', 2, 0], ['pew', 5, 0], ['pew', 7, 0]] };
  if (b.planned === 'station') return null;
  if (fk === 'barracks') return { step: [5, 5], put: [['bunk', 0, 0], ['j_locker', 1, 0]] };
  if (/firestation/.test(id)) return { step: [8, 5], put: [['j_locker', 0, 0], ['j_locker', 1, 0], ['v_hose_rack', 2, 0]] };
  if (SHOP.test(fk)) return rows('shelf', 6, 6);
  if (/inn|club/.test(fk)) return seats;
  return null;
};
function hall(m, b, tiles, pat, reserved) {
  const by = new Set(tiles.map(([x, y]) => x + ',' + y)), xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]), x0 = Math.min(...xs) + 3, x1 = Math.max(...xs) - 2, y0 = Math.min(...ys) + 3, y1 = Math.max(...ys) - 2;
  const list = pat.put.filter(([t]) => G.DECOR[t]), cellsOf = (x, y) => { const out = []; for (const [t, dx, dy] of list) for (let k = 0; k < (G.DECOR[t].fw || 1); k++) out.push([x + dx + k, y + dy, G.DECOR[t].solid]); return out; };
  const clear = (cells) => cells.every(([x, y]) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const k = (x + i) + ',' + (y + j); if (!by.has(k) || reserved.has(k) || m.isSolidTile(x + i, y + j) || m.decorsAt(x + i, y + j).length) return false; } return true; });
  if (!list.length) return;
  for (let y = y0; y <= y1; y += pat.step[1]) for (let x = x0; x <= x1; x += pat.step[0]) {
    const cells = cellsOf(x, y); if (cells.some(([a, c]) => a > x1 || c > y1 || (Math.abs(a - b.doorX) < 4 && c > b.doorY - 7)) || !clear(cells)) continue;
    const before = flood(m, b, new Set()), solid = new Set(cells.filter((c) => c[2]).map(([a, c]) => a + ',' + c));
    if (flood(m, b, solid) < before - solid.size) continue;
    for (const [t, dx, dy] of list) { m.addDecor(t, x + dx, y + dy); }
    for (const [a, c, s] of cells) if (s) m.solid[c * m.w + a] = 1;
  }
}
function fill(m, b, reserved) {
  const r = new G.RNG('fill' + b.id), home = HOME.test(b.kind || '') , shop = SHOP.test(b.kind || '') || !!b.venue;
  for (const tiles of rooms(m, b)) {
    if (tiles.length < 24) continue;
    const pieces = new Set(); for (const [x, y] of tiles) for (const d of m.decorsAt(x, y)) if (!d.def.flat) pieces.add(d);
    const want = Math.floor(tiles.length / 22) - pieces.size;
    const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]), cx = (Math.min(...xs) + Math.max(...xs)) >> 1, cy = (Math.min(...ys) + Math.max(...ys)) >> 1;
    const all = new Set(tiles.map(([x, y]) => x + ',' + y));
    if (home && G.DECOR.rug) {   // the open floor nearest the middle of the room, clear of walls on every side
      const fits = tiles.filter(([x, y]) => { for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) if (!all.has((x + i) + ',' + (y + j)) || m.decorsAt(x + i, y + j).length) return false; return true; }).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
      if (fits && !m.flats.some((f) => f.type === 'rug' && Math.abs(f.tx - fits[0]) < 8 && Math.abs(f.ty - fits[1]) < 8)) m.addDecor('rug', fits[0], fits[1]);
    }
    if (tiles.length >= 110) { const pat = PAT(b); if (pat) hall(m, b, tiles, pat, reserved); }
    if (want <= 0) continue;
    const list = home ? ['plant', 'shelf', 'plant', 'shelf'] : shop ? ['shelf', 'plant', 'shelf', 'crate', 'shelf'] : ['plant', 'crate', 'shelf', 'plant'];
    const by = new Set(tiles.map(([x, y]) => x + ',' + y));
    const edge = tiles.filter(([x, y]) => !by.has(x + ',' + (y - 1)) || !by.has((x - 1) + ',' + y) || !by.has((x + 1) + ',' + y));
    for (let i = edge.length - 1; i > 0; i--) { const j = r.int(0, i); [edge[i], edge[j]] = [edge[j], edge[i]]; }
    let placed = 0, n = 0;
    for (const [x, y] of edge) {
      if (placed >= want || n >= list.length * 3) break;
      const type = list[placed % list.length], def = G.DECOR[type]; n++;
      if (!def) continue;
      const fw = def.fw || 1, cells = []; for (let k = 0; k < fw; k++) cells.push((x + k) + ',' + y);
      if (cells.some((k) => !by.has(k) || reserved.has(k))) continue;
      if (Math.abs(x - b.doorX) < 3 && Math.abs(y - b.doorY) < 4) continue;
      if (cells.some((k) => { const [a, c] = k.split(',').map(Number); return m.decorsAt(a, c).length || m.isSolidTile(a, c); })) continue;
      const before = flood(m, b, new Set()), after = flood(m, b, new Set(cells));
      if (after < before - cells.length) continue;
      m.addDecor(type, x, y); for (const k of cells) { const [a, c] = k.split(',').map(Number); if (def.solid) m.solid[c * m.w + a] = 1; }
      placed++;
    }
  }
}
// ---------------------------------------------------------------- what a room is for
const wallAt = (m, x, y) => { const t = G.TILES[m.get(x, y)]; return !t || t.solid || t.name === 'door'; };
const CABS = /^(wardrobe|shelf|fridge|stove|kcounter|nightstand|bookcase|tv)$/;
// every piece turns to what it belongs to: cabinets show their fronts to the room, a chair faces its table
function orient(m) {
  const tables = m.decor.filter((d) => /^(table|table_v|desk|desk_l|desk_r|bj_table|coffee_table|counter)$/.test(d.type));
  const beside = (d) => { for (const t of tables) { const fw = t.def.fw || 1, fh = t.def.fh || 1; if (d.tx >= t.tx && d.tx < t.tx + fw) { if (d.ty === t.ty + 1) return 'up'; if (d.ty === t.ty - fh) return 'down'; } if (d.ty <= t.ty && d.ty > t.ty - fh) { if (d.tx === t.tx - 1) return 'right'; if (d.tx === t.tx + fw) return 'left'; } } return null; };
  for (const d of m.decor.slice()) {
    if (d.tx < 1 || d.ty < 1 || d.tx >= m.w - 1 || d.ty >= m.h - 1 || !m.buildingAtTile(d.tx, d.ty)) continue;
    if (CABS.test(d.type) && !d.ori && !wallAt(m, d.tx, d.ty - 1)) { if (wallAt(m, d.tx - 1, d.ty)) d.ori = 'r'; else if (wallAt(m, d.tx + 1, d.ty)) d.ori = 'l'; continue; }
    if (/^chair/.test(d.type) && !d.ori) { const f = beside(d); if (!f) continue; const t = f === 'up' ? 'chair_up' : f === 'left' ? 'chair_left' : f === 'right' ? 'chair_right' : 'chair'; if (t !== d.type) { d.type = t; d.def = G.DECOR[t]; } }
    if (/^office_chair/.test(d.type)) { const f = beside(d); if (f === 'left') d.ori = 'l'; else if (f === 'right') d.ori = 'r'; else if (f === 'up' && d.type !== 'office_chair_up') { d.type = 'office_chair_up'; d.def = G.DECOR.office_chair_up; } }
  }
}
// Try an arrangement: every cell free, nothing cut off, or everything goes back the way it was.
function trial(m, b, moved, plan, reserved) {
  const was = moved.map((d) => ({ d, type: d.type, tx: d.tx, ty: d.ty, ori: d.ori }));
  for (const d of moved) m.removeDecorRuntime(d, false);
  m.computeSolids();
  const reach0 = flood(m, b, new Set()), cells = new Set(); let ok = true;
  for (const [t, x, y] of plan) { const def = G.DECOR[t]; if (!def) { ok = false; break; } for (let j = 0; j < (def.fh || 1); j++) for (let i = 0; i < (def.fw || 1); i++) { const X = x + i, Y = y - j, k = X + ',' + Y; if (wallAt(m, X, Y) || reserved.has(k) || m.isSolidTile(X, Y) || m.decorsAt(X, Y).length || m.buildingAtTile(X, Y) !== b || (Math.abs(X - b.doorX) < 2 && b.doorY - Y < 3)) ok = false; if (def.solid) cells.add(k); } }
  if (ok && flood(m, b, cells) < reach0 - cells.size) ok = false;
  if (!ok) { moved.length = 0; for (const w of was) moved.push(m.addDecor(w.type, w.tx, w.ty, w.ori ? { ori: w.ori } : {})); m.computeSolids(); return false; }
  for (const [t, x, y, ori] of plan) { const q = m.addDecor(t, x, y, ori ? { ori } : {}); q.auto = true; }
  m.computeSolids();
  return true;
}
// the largest clear rectangle of a floor: a room's outline can have arms that belong to a corridor
function bestRect(tiles) {
  const has = new Set(tiles.map(([x, y]) => x + ',' + y)), ys = tiles.map((t) => t[1]), xs = tiles.map((t) => t[0]), X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys), h = {};
  let best = null, area = 0;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    h[x] = has.has(x + ',' + y) ? (h[x] || 0) + 1 : 0;
    let low = Infinity; for (let a = x; a >= X0 && h[a]; a--) { low = Math.min(low, h[a]); const A = (x - a + 1) * low; if (A > area) { area = A; best = { x0: a, x1: x, y0: y - low + 1, y1: y }; } }
  }
  return best;
}
function livingRoom(m, b, tiles, reserved) {
  const inRoom = new Set(tiles.map(([x, y]) => x + ',' + y)), got = (rx) => { const s = new Set(); for (const [x, y] of tiles) for (const d of m.decorsAt(x, y)) if (rx.test(d.type) && !d.def.flat) s.add(d); return [...s]; };
  const couch = got(/^couch/)[0]; if (!couch || got(/^bed|^v_bed|^stove/).length) return;
  const r = bestRect(tiles); if (!r || r.x1 - r.x0 < 3 || r.y1 - r.y0 < 3) return; const { x0, x1, y0, y1 } = r, cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1; void inRoom;
  const moved = got(/^couch|^tv$|^coffee_table$|^armchair/).concat(tiles.flatMap(([x, y]) => m.decorsAt(x, y).filter((d) => d.type === 'rug'))), hasTv = moved.some((d) => d.type === 'tv'), east = wallAt(m, x1 + 1, cy);
  // across the room, or along it, whichever the shape allows: a seat, a low table in reach, the screen opposite, one chair turned in from the corner
  const seatX = east ? x1 : x0, tvX = east ? x0 : x1, table = east ? x1 - 3 : x0 + 2;
  const wide = [['couch' + (east ? '_l' : '_r'), seatX, cy + 1], ['rug', table, cy], ['coffee_table', table, cy], ...(hasTv ? [['tv', tvX, cy, east ? 'r' : 'l']] : []), ['armchair', table + (east ? -1 : 2), y0 + 1, east ? 'dr' : 'dl']];
  const tall = [['couch', cx - 1, y0], ['rug', cx, y0 + 2], ['coffee_table', cx - 1, y0 + 2], ...(hasTv ? [['tv', cx, y1, 'up']] : []), ['armchair', x1 - 1, y0 + 2, 'l']];
  for (const plan of x1 - x0 >= y1 - y0 ? [wide, tall] : [tall, wide]) { if (trial(m, b, moved, plan.filter((p) => G.DECOR[p[0]]), reserved)) return; }
}
function dining(m, b, tiles, reserved) {
  const got = new Set(), s = new Set(); for (const [x, y] of tiles) { s.add(x + ',' + y); for (const d of m.decorsAt(x, y)) if (/^table$/.test(d.type)) got.add(d); }
  const table = [...got][0]; if (!table) return;
  const moved = m.decor.filter((d) => /^chair/.test(d.type) && s.has(d.tx + ',' + d.ty) && Math.abs(d.tx - table.tx) < 4 && Math.abs(d.ty - table.ty) < 4).concat(table);
  const clear = tiles.filter(([x, y]) => { for (let j = -2; j <= 2; j++) for (let i = -2; i <= 3; i++) if (!s.has((x + i) + ',' + (y + j))) return false; return true; });
  const xs = tiles.map((t) => t[0]), ys = tiles.map((t) => t[1]), cx = (Math.min(...xs) + Math.max(...xs)) >> 1, cy = (Math.min(...ys) + Math.max(...ys)) >> 1;
  clear.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
  for (const [x, y] of clear.slice(0, 16)) if (trial(m, b, moved, [['table', x, y], ['chair', x, y - 1], ['chair', x + 1, y - 1], ['chair_up', x, y + 1], ['chair_up', x + 1, y + 1], ['chair_right', x - 1, y], ['chair_left', x + 2, y]], reserved)) return;
}
G.arrangeRooms = (m) => {
  if (m.meta && m.meta.wilds) return;
  const reserved = new Set(); for (const k in m.points) { const v = m.points[k]; for (const p of Array.isArray(v) ? v : [v]) if (p && typeof p.x === 'number') for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) reserved.add((p.x + dx) + ',' + (p.y + dy)); }
  // one open room can be two: the kitchen floor ends where the living room's begins
  for (const b of m.buildings) { if (!b.replanned) continue; for (const tiles of rooms(m, b)) { const by = new Map(); for (const t of tiles) { const g = m.ground[t[1] * m.w + t[0]]; if (!by.has(g)) by.set(g, []); by.get(g).push(t); } for (const zone of by.values()) { if (zone.length < 20) continue; livingRoom(m, b, zone, reserved); dining(m, b, zone, reserved); } } }
};
G.orientRooms = orient;
G.fillRooms = (m) => {
  if (m.meta && m.meta.wilds) return;
  const reserved = new Set(); for (const k in m.points) { const v = m.points[k]; for (const p of Array.isArray(v) ? v : [v]) if (p && typeof p.x === 'number') for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) reserved.add((Math.floor(p.x) + dx) + ',' + (Math.floor(p.y) + dy)); }
  for (const b of m.buildings) if (b.kind !== 'ruin' && !b.playerBuilt) fill(m, b, reserved);
};
})();
