'use strict';
// The scale of the world. Every map is built by its generators as a plan, then laid out here at twice the size in both
// directions: streets, plots, buildings and rooms really are bigger, with more ground between them.
//   Walls are lines, not areas: tiles that form a wall, door, fence or road marking sit on the lattice t -> 2t and stay one
//   tile thick, so a building of w tiles becomes 2w - 1 wide and a door stays door sized. Everything else fills its 2 x 2.
//   Furniture moves as groups: pieces that touch stay together, and a group against a wall stays against it.
//   Named points follow the group they stand beside; a point left on something solid steps to the nearest free tile.
//   Upper floors and the woods are generated at their final size and are not expanded again.
// Ground canvases are huge at this scale, so a map only keeps one while you are on it.
(() => {
const K = G.WORLD_SCALE = 2;
const NATURE = /^(oak|pine|palm|bush|berrybush|rock|boulder|stump|log|deadtree|burnt_tree|tuft|flower|mushroom|fern|reeds|weed|v_bush|v_apple|v_weeds)/;
const lattice = (t) => { const d = G.TILES[t]; return !!d && (d.wall || d.name === 'door' || d.name === 'road_line' || d.name === 'road_line_v' || /fence|chainlink|hedge/.test(d.name)); };

const ROADT = /^(asphalt|road_line|road_line_v)$/, onRoad = (t) => !!G.TILES[t] && ROADT.test(G.TILES[t].name);

// every room can be walked to from the front door: a group that closed a doorway steps aside
function repairRooms(m, sets) {
  for (const b of m.buildings) {
    const inside = (x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1, mine = sets.filter((s) => s.inb === b), floor = (x, y) => !G.TILES[m.get(x, y)].solid;
    const tilesOf = (s, ox = 0, oy = 0) => { const out = []; for (const n of s.list) { if (!(n.it.def ? n.it.def.solid : true)) continue; for (let y = n.y0; y <= n.y1; y++) for (let x = n.x0; x <= n.x1; x++) out.push((x + s.dx + ox) + ',' + (y + s.dy + oy)); } return out; };
    const shut = (occ) => {
      let total = 0; for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) if (floor(x, y) && !occ.has(x + ',' + y)) total++;
      const seen = new Set(), q = [[b.doorX, b.doorY - 1]];
      while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || !inside(x, y) || !floor(x, y) || occ.has(k)) continue; seen.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      return total - seen.size;
    };
    const occOf = () => { const o = new Set(); for (const s of mine) for (const k of tilesOf(s)) o.add(k); return o; };
    for (let tries = 0; tries < 4; tries++) {
      const occ = occOf(), now = shut(occ); if (!now) break;
      let best = null, bestN = now;
      for (const s of mine) {
        const own = new Set(tilesOf(s)); if (!own.size) continue;
        const rest = new Set([...occ].filter((k) => !own.has(k)));
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (!dx && !dy) continue;
          const to = tilesOf(s, dx, dy);
          if (to.some((k) => { const [x, y] = k.split(',').map(Number); return !inside(x, y) || !floor(x, y) || rest.has(k) || (x === b.doorX && y >= b.doorY - 1); })) continue;
          const n = shut(new Set([...rest, ...to]));
          if (n < bestN) { bestN = n; best = { s, dx, dy }; }
        }
      }
      if (!best) break;
      const { s, dx, dy } = best; s.dx += dx; s.dy += dy;
      for (const n of s.list) { const it = n.it; it.tx += dx; it.ty += dy; if (it.x != null) { it.x += dx * 16; it.y += dy * 16; } if (it.light) { it.light.x += dx * 16; it.light.y += dy * 16; } }
    }
  }
}

function expandGround(m) {
  const W0 = m.w, H0 = m.h, g0 = m.ground, W = W0 * K, H = H0 * K, g = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W0 || y >= H0 ? 0 : g0[y * W0 + x]);
  const open = (x, y) => { for (const [dx, dy] of [[1, 1], [1, 0], [0, 1], [-1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1]]) { const t = at(x + dx, y + dy); if (t && !lattice(t)) return t; } return 0; };
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    const t = g0[y * W0 + x], i = y * 2 * W + x * 2;
    g[i] = t;
    if (!lattice(t)) { g[i + 1] = t; g[i + W] = t; g[i + W + 1] = t; continue; }
    const r = at(x + 1, y), d = at(x, y + 1), dr = at(x + 1, y + 1), fb = open(x, y) || t;
    g[i + 1] = r && lattice(r) && lattice(t) && !(G.TILES[r].name === 'door' && G.TILES[t].name === 'door') ? (G.TILES[t].name === 'door' ? r : G.TILES[r].name === 'door' ? t : t) : r || fb;
    g[i + W] = d && lattice(d) ? (G.TILES[t].name === 'door' ? d : t) : d || fb;
    g[i + W + 1] = dr && !lattice(dr) ? dr : (r && !lattice(r) ? r : d && !lattice(d) ? d : t);   // (inside a solid mass it stays solid)
    if (G.TILES[t].name === 'road_line') { g[i + W] = d || fb; }
    if (G.TILES[t].name === 'road_line_v') { g[i + 1] = r || fb; }
  }
  m.ground = g; m.w = W; m.h = H; m.solid = new Uint8Array(W * H); m._occupied = null;
}

// groups of pieces that touch, each with the box it fills in plan tiles
function groups(m) {
  const items = [], cell = new Map();
  const add = (it, x0, y0, x1, y1) => { const n = { it, x0, y0, x1, y1, p: null }; n.p = n; items.push(n); return n; };
  const find = (n) => { while (n.p !== n) { n.p = n.p.p; n = n.p; } return n; }, room = (x, y) => m.buildingAtTile(x, y) || (m.meta.indoor ? m : null);
  for (const d of m.decor) {
    const fw = d.def.pfw || d.def.fw || 1, fh = d.def.pfw ? 1 : d.def.pfh || d.def.fh || 1, n = add(d, d.tx, d.ty - fh + 1, d.tx + fw - 1, d.ty);
    n.inb = room(d.tx, d.ty); n.loose = !n.inb && NATURE.test(d.type); n.road = onRoad(g0Of(m, d.tx, d.ty));
    if (n.loose || d.wallOf || G.TILES[g0Of(m, d.tx, d.ty)].wall) continue;
    for (let y = n.y0; y <= n.y1; y++) for (let x = n.x0; x <= n.x1; x++) {
      for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, -1]]) { const o = cell.get((x + dx) + ',' + (y + dy)); if (o && o.inb === n.inb && !!o.road === !!n.road) find(o).p = find(n); }
      cell.set(x + ',' + y, n);
    }
  }
  for (const f of m.flats) {
    if (NATURE.test(f.type)) continue;
    const fw = f.def.fw || 1, n = add(f, f.tx, f.ty, f.tx + fw - 1, f.ty); n.inb = room(f.tx, f.ty); f._grouped = true;
    for (let x = n.x0; x <= n.x1; x++) { for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, -1]]) { const o = cell.get((x + dx) + ',' + (f.ty + dy)); if (o && o.inb === n.inb) find(o).p = find(n); } cell.set(x + ',' + f.ty, n); }
  }
  for (const c of m.chests) { const n = add(c, c.tx, c.ty, c.tx, c.ty); n.inb = room(c.tx, c.ty); for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) { const o = cell.get((c.tx + dx) + ',' + (c.ty + dy)); if (o && o.inb === n.inb) find(o).p = find(n); } cell.set(c.tx + ',' + c.ty, n); }
  const sets = new Map();
  for (const n of items) { const r = find(n); if (!sets.has(r)) sets.set(r, { list: [], x0: 1e9, y0: 1e9, x1: -1, y1: -1, inb: n.inb }); const s = sets.get(r); s.list.push(n); s.x0 = Math.min(s.x0, n.x0); s.y0 = Math.min(s.y0, n.y0); s.x1 = Math.max(s.x1, n.x1); s.y1 = Math.max(s.y1, n.y1); }
  return [...sets.values()];
}
let plan = null;   // the plan ground, while it is being replaced
const g0Of = (m, x, y) => { const p = plan; return x < 0 || y < 0 || x >= p.w || y >= p.h ? 0 : p.g[y * p.w + x]; };
const wallAt = (m, x, y) => { const d = G.TILES[g0Of(m, x, y)]; return !!d && !!d.wall; };

function placeGroups(m) {
  const sets = groups(m), moved = new Map();
  for (const s of sets) {
    let nx = s.x0 * K, ny = s.y0 * K;
    if (s.inb) {
      const rowWall = (x) => { for (let y = s.y0; y <= s.y1; y++) if (wallAt(m, x, y)) return true; return false; }, colWall = (y) => { for (let x = s.x0; x <= s.x1; x++) if (wallAt(m, x, y)) return true; return false; };
      if (rowWall(s.x0 - 1)) nx = (s.x0 - 1) * K + 1; else if (rowWall(s.x1 + 1)) nx = (s.x1 + 1) * K - (s.x1 - s.x0) - 1;
      if (colWall(s.y0 - 1)) ny = (s.y0 - 1) * K + 1; else if (colWall(s.y1 + 1)) ny = (s.y1 + 1) * K - (s.y1 - s.y0) - 1;
    } else if (s.list[0].road) {   // parked at the curb, on whichever side the curb is
      if (!onRoad(g0Of(m, s.x0, s.y1 + 1))) ny = (s.y1 + 1) * K - (s.y1 - s.y0) - 1;
      else if (!onRoad(g0Of(m, s.x0, s.y0 - 1))) ny += 1;   // (a car is two tiles deep now: its nose stays off the kerb)
      if (!onRoad(g0Of(m, s.x1 + 1, s.y0))) nx = (s.x1 + 1) * K - (s.x1 - s.x0) - 1;
    }
    s.dx = nx - s.x0; s.dy = ny - s.y0;
    for (const n of s.list) {
      const it = n.it, ox = it.tx, oy = it.ty, tx = ox + s.dx, ty = oy + s.dy;
      for (let y = n.y0; y <= n.y1; y++) for (let x = n.x0; x <= n.x1; x++) moved.set(x + ',' + y, [x + s.dx, y + s.dy]);
      it.tx = tx; it.ty = ty;
      if (it.x != null) { it.x += s.dx * 16; it.y += s.dy * 16; if (it.def && it.def.pfw) it.x += it.def.pfw * 8; if (it.def && it.def.pfh) { it.ty += 1; it.y += 16; } }   // (a bed is two tiles long now: its head stays at the wall)
      if (it.light) { it.light.x += s.dx * 16; it.light.y += s.dy * 16; it.light._done = true; }
    }
  }
  for (const f of m.flats) { if (f._grouped) { delete f._grouped; continue; } f.x += f.tx * 16; f.y += f.ty * 16; f.tx *= K; f.ty *= K; if (f.light) { f.light.x *= K; f.light.y *= K; f.light._done = true; } }
  return { sets, moved };
}
const RECT = new Set(['x', 'y', 'w', 'h', 'x0', 'x1', 'y0', 'y1', 'tx', 'ty']);
const scaleObj = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(scaleObj); return; } for (const k in o) { if (RECT.has(k) && typeof o[k] === 'number') o[k] *= K; else if (o[k] && typeof o[k] === 'object') scaleObj(o[k]); } };

function placePoint(p, sets) {
  let best = null, bd = 9;
  for (const s of sets) {   // the nearest piece, measured to the piece: a counter beside you, not a poster near it
    if (!(s.inb || s.list.length >= 2) || p.x < s.x0 - 1 || p.x > s.x1 + 1 || p.y < s.y0 - 1 || p.y > s.y1 + 1) continue;
    for (const n of s.list) { const dx = Math.max(n.x0 - p.x, 0, p.x - n.x1), dy = Math.max(n.y0 - p.y, 0, p.y - n.y1), d = dx + dy + (n.it.def && !n.it.def.solid ? (n.it.def.flat ? 4 : 0.5) : 0); if (d < bd) { bd = d; best = s; } }
  }
  if (best) { p.x += best.dx; p.y += best.dy; } else { p.x *= K; p.y *= K; }
}
function freePoints(m) {
  const free = (x, y) => m.inBounds(x, y) && !m.isSolidTile(x, y);
  const fix = (p) => { const x = Math.floor(p.x), y = Math.floor(p.y); if (free(x, y)) return; for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(x + dx, y + dy) && m.buildingAtTile(x + dx, y + dy) === m.buildingAtTile(x, y)) { p.x = x + dx; p.y = y + dy; return; } };
  for (const k in m.points) { const v = m.points[k]; for (const p of Array.isArray(v) ? v : [v]) if (p && typeof p.x === 'number') fix(p); }
}
// homes are planned again at their real size: the same people and the same request, so rooms are laid out for the floor they
// have instead of being the old rooms pulled apart. Shops, venues and the buildings other systems know by heart keep their plan.
// Pieces the planners make are marked. A building holding anything else was arranged by hand (a shop's stock, a bank's vault)
// and keeps its arrangement: nothing authored is ever thrown away by this pass.
let auto = 0;
const FUR = () => {
  const MB = G.MB, _f = MB.furnish, R = G.roomsPass, _r = R.dress, TM0 = G.TileMap.prototype, _a = TM0.addDecor;
  MB.furnish = function (m, b, kind, rng, o = {}) { b._fur = { kind, o }; auto++; try { return _f.call(this, m, b, kind, rng, o); } finally { auto--; } };
  R.dress = function (m) { auto++; try { return _r.call(this, m); } finally { auto--; } };
  TM0.addDecor = function (type, tx, ty, extra) { const d = _a.call(this, type, tx, ty, extra); if (auto) d.auto = true; return d; };
};
FUR();
function replanHomes(m) {
  // (things on walls and small clutter come from the dressing passes)
  const authored = new Set(); for (const d of m.decor.concat(m.flats)) if (!d.auto && !/^v_w_|^rug$|^v_tag|^v_boards|^v_clothes|^v_book_stack|^v_pizza/.test(d.type)) { const b = m.buildingAtTile(d.tx, d.ty); if (b && d.tx > b.x && d.tx < b.x + b.w - 1 && d.ty > b.y && d.ty < b.y + b.h - 1) authored.add(b); }
  const homes = m.buildings.filter((b) => b._fur && !authored.has(b) && !b.venue && !b.playerBuilt && !b.floorOf && /^(house|mansion|shop|inn|office)$/.test(b._fur.kind) && (b.planned === b._fur.kind || b.planned === 'apartment'));
  if (!homes.length) return;
  for (const b of homes) {
    const inside = (x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1, floor = (() => { const t = m.get(b.doorX, b.doorY - 1), d = G.TILES[t]; return d && !d.solid && d.name !== 'door' ? t : G.T.woodfloor; })();
    for (const d of m.decor.concat(m.flats)) if (inside(d.tx, d.ty)) { if (d.light) m.lights = m.lights.filter((l) => l !== d.light); d.gone2 = true; }
    m.decor = m.decor.filter((d) => !d.gone2); m.flats = m.flats.filter((d) => !d.gone2);
    m.chests = m.chests.filter((c) => !inside(c.tx, c.ty));
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) m.set(x, y, floor);
    for (const k of Object.keys(m.points)) if (k.startsWith(b.id + '_') && /_(bed\d*|bath|kitchen|work)$/.test(k)) delete m.points[k];
    m.computeSolids();
    const o = Object.assign({}, b._fur.o); delete o.pre;
    G.MB.furnish(m, b, b._fur.kind, new G.RNG('replan' + b.id), o);
    b.roomsDone = false; b.replanned = true;
  }
  m.computeSolids();
  G.roomsPass.dress(m);
  footBeds(m, homes);
  m.computeSolids();
}
// a bed is two tiles long: its head stays at the wall, its foot comes into the room
function footBeds(m, homes) {
  const open = (b) => { const s = new Set(), q = [[b.doorX, b.doorY - 1]]; while (q.length) { const [x, y] = q.pop(), k = y * m.w + x; if (s.has(k) || x <= b.x || y <= b.y || x >= b.x + b.w - 1 || y >= b.y + b.h - 1 || m.solid[k]) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return s.size; };
  for (const b of homes) for (const d of m.decor) if (d.def.pfh && m.buildingAtTile(d.tx, d.ty) === b && !m.isSolidTile(d.tx, d.ty + 1) && !m.decorsAt(d.tx, d.ty + 1).length) {
    const fw = d.def.fw || 1, cells = []; for (let i = 0; i < fw; i++) if (!m.isSolidTile(d.tx + i, d.ty + 1)) cells.push((d.ty + 1) * m.w + d.tx + i);
    const before = open(b); for (const c of cells) m.solid[c] = 1;
    if (open(b) < before - cells.length) { for (const c of cells) m.solid[c] = 0; continue; }   // a bed never closes a way through
    const y0 = d.ty; d.ty += 1; d.y += 16;
    for (const k in m.points) { const p = m.points[k]; if (p && !Array.isArray(p) && k.startsWith(b.id + '_') && p.x === d.tx && p.y >= y0 - 1 && p.y <= d.ty) { p.y = d.ty + 1; } }   // (whoever sleeps here gets in from the foot)
  }
  widen(m, homes, open);
}
// a bed is a metre wide: it takes a second tile where the room has one, and a bedside piece moves over to make way
function widen(m, homes, open) {
  const free = (x, y, skip) => !m.isSolidTile(x, y) && !m.decorsAt(x, y).some((q) => q !== skip && !q.def.flat) && G.TILES[m.get(x, y)].name !== 'door';
  for (const b of homes) { m.computeSolids(); for (const d of m.decor.slice()) {
    if (!d.def.pfh || (d.def.fw || 1) !== 1 || m.buildingAtTile(d.tx, d.ty) !== b) continue;
    const hasRoom = (X) => free(X, d.ty) && free(X, d.ty - 1);
    let X = hasRoom(d.tx + 1) ? d.tx + 1 : hasRoom(d.tx - 1) ? d.tx - 1 : null, pushed = null, dirP = 0;
    // no room beside it: the whole row along the wall moves over one tile, if there is a free tile at its end
    if (X == null) for (const dir of [1, -1]) {
      const run = new Set(); let nx = d.tx + dir, ok = true;
      for (let i = 0; i < 6; i++) { const q = m.decorsAt(nx, d.ty).concat(m.decorsAt(nx, d.ty - 1)).filter((p) => !p.def.flat && p !== d); if (!q.length) { if (m.isSolidTile(nx, d.ty) || m.isSolidTile(nx, d.ty - 1)) ok = false; break; } if (q.some((p) => m.buildingAtTile(p.tx, p.ty) !== b || /^v_w_/.test(p.type))) { ok = false; break; } for (const p of q) run.add(p); nx += dir * Math.max(...q.map((p) => p.def.fw || 1)); if (i === 5) ok = false; }
      if (!ok || !run.size) continue;
      for (const q of run) { q.tx += dir; q.x += dir * 16; if (q.def.pfh) for (const k in m.points) { const p = m.points[k]; if (p && !Array.isArray(p) && k.startsWith(b.id + '_') && p.x === q.tx - dir && Math.abs(p.y - q.ty) < 3) p.x += dir; } }
      m.computeSolids(); X = d.tx + dir; pushed = run; dirP = dir; break;
    }
    // a room too narrow for that gives up the bedside table: a real bed matters more
    if (X == null) for (const dir of [1, -1]) { const q = m.decorsAt(d.tx + dir, d.ty).concat(m.decorsAt(d.tx + dir, d.ty - 1)).find((p) => p.type === 'nightstand'); if (q && !m.isSolidTile(d.tx + dir, d.ty - (q.ty === d.ty ? 1 : 0))) { m.removeDecorRuntime(q, false); m.computeSolids(); X = d.tx + dir; break; } }
    if (X == null) continue;
    const before = open(b), cells = [d.ty * m.w + X, (d.ty - 1) * m.w + X]; for (const c of cells) m.solid[c] = 1;
    if (open(b) < before - cells.length) { for (const c of cells) m.solid[c] = 0; if (pushed) { for (const q of pushed) { q.tx -= dirP; q.x -= dirP * 16; } m.computeSolids(); } continue; }
    if (X < d.tx) d.tx = X;
    d.wide = true; d.def = Object.assign({}, d.def, { fw: 2 }); d.x = d.tx * 16 + 16;
  } }
}
G.worldScale = { footBeds };
// more trees, bushes and grass: the same woods, as dense as they were
function growNature(m) {
  const r = new G.RNG('grow' + m.id), base = m.decor.filter((d) => NATURE.test(d.type) && d.type !== 'v_apple_tree' && !/^v_bush_/.test(d.type) && !m.buildingAtTile(d.tx, d.ty));
  const near = new Set(); for (const b of m.buildings) for (let y = b.y - 5; y < b.y + b.h + 3; y++) for (let x = b.x - 6; x < b.x + b.w + 6; x++) near.add(y * m.w + x);   // (a crown does not reach under anyone's roof)
  for (const e of m.exits) for (let y = e.y - 3; y < e.y + e.h + 3; y++) for (let x = e.x - 3; x < e.x + e.w + 3; x++) near.add(y * m.w + x);   // (nor stands in the way out)
  for (const d of base) for (let n = 0; n < 2; n++) {
    const tx = d.tx + r.int(-3, 3), ty = d.ty + r.int(-3, 3), fw = d.def.fw || 1;
    if (near.has(ty * m.w + tx) || !m.inBounds(tx, ty) || !m.inBounds(tx + fw, ty) || m.isSolidTile(tx, ty) || m.isSolidTile(tx + fw - 1, ty) || m.decorsAt(tx, ty).length || m.buildingAtTile(tx, ty)) continue;
    const t = G.TILES[m.get(tx, ty)]; if (t.water || !/grass|dirt|field|sand/.test(t.name)) continue;
    m.addDecor(d.type, tx, ty);
  }
}

function expand(m) {
  if (m.scaled || (m.meta && (m.meta.floorOf || m.meta.wilds || m.meta.final))) { m.scaled = true; return m; }
  plan = { w: m.w, h: m.h, g: m.ground };
  const { sets, moved } = placeGroups(m);
  const movedOf = (x, y) => moved.get(x + ',' + y);
  // buildings on the lattice
  const roofSignLights = new Set();
  for (const b of m.buildings) {
    b.x *= K; b.y *= K; b.w = b.w * K - 1; b.h = b.h * K - 1; b.doorX *= K; b.doorY *= K;
    const row = b.windows.length ? b.windows[0].y : 0, wins = [];
    for (const w of b.windows) { const t = (w.x - 8) / 16 * K; wins.push({ x: t * 16 + 8, y: b.doorY * 16 + 9 }); if (/house|apartment|mansion/.test(b.kind || '') && t + 1 < b.x + b.w - 1 && Math.abs(t + 1 - b.doorX) > 1) wins.push({ x: (t + 1) * 16 + 8, y: b.doorY * 16 + 9 }); }   // (a shop's windows are its displays, one to each)
    b.windows = wins; void row;
    for (const k of ['backroom', 'sanctum']) if (b[k]) scaleObj(b[k]);
  }
  void roofSignLights;
  // the rest of the plan
  for (const l of m.lights) { if (l._done) { delete l._done; continue; } l.x *= K; l.y *= K; }
  for (const e of m.exits) { e.x *= K; e.y *= K; e.w *= K; e.h *= K; }
  for (const k of ['animalZones', 'dangerZones', 'roads']) for (const z of m[k] || []) { if (k === 'roads') { z.at *= K; z.from *= K; z.to *= K; z.W *= K; } else scaleObj(z); }
  const signs = {}; for (const k in m.signs) { const [x, y] = k.split(',').map(Number), q = movedOf(x, y) || [x * K, y * K]; signs[q[0] + ',' + q[1]] = m.signs[k]; } m.signs = signs;
  const donePts = new Set();   // (several names can share one point)
  for (const k in m.points) { const v = m.points[k]; for (const p of Array.isArray(v) ? v : [v]) if (p && typeof p.x === 'number' && !donePts.has(p)) { donePts.add(p); placePoint(p, sets); } }
  for (const id in m.vseats || {}) for (const s of m.vseats[id]) { const q = movedOf(s.x, s.y) || [s.x * K, s.y * K]; s.x = q[0]; s.y = q[1]; }
  for (const k of ['vstage', 'vrooms', 'vdance', 'morgueDoor', 'landmark']) if (m[k]) scaleObj(m[k]);
  expandGround(m);
  repairRooms(m, sets);
  for (const d of (m.roofSigns || []).concat(m.decor.filter((q) => q.wallOf))) {   // a sign stays on its wall
    const b = d.wallOf, s = G.assets.sprites[d.def.sprite]; if (!b || !s) continue;
    const k = d.sc || 1, half = s.w * k / 2, x0 = b.x * 16 + half, x1 = (b.x + b.w) * 16 - half; if (x0 <= x1) d.x = Math.min(x1, Math.max(x0, d.x));
  }
  if (G.fightClub && m.id === 'fightclub') G.fightClub.placed(m);
  m.roadBoxes = m.roadGraph = m.approachCache = m.puddles = m.neons = null;
  for (const d of m.decor) {   // street furniture stands on the pavement
    if (!d.def.solid || /^car_|^moto_|^bike_|police_car|limo/.test(d.type) || !onRoad(m.get(d.tx, d.ty))) continue;
    find: for (let r = 1; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = d.tx + dx, y = d.ty + dy; if (m.inBounds(x, y) && !onRoad(m.get(x, y)) && !G.TILES[m.get(x, y)].solid) { d.tx = x; d.ty = y; d.x += dx * 16; d.y += dy * 16; if (d.light) { d.light.x += dx * 16; d.light.y += dy * 16; } break find; } }
  }
  m.computeSolids();
  m.decor.sort((a, b) => a.y - b.y);
  growNature(m);
  m.computeSolids();
  replanHomes(m);
  freePoints(m);
  if (G.fillRooms) { G.arrangeRooms(m); G.fillRooms(m); m.computeSolids(); G.orientRooms(m); m.decor.sort((a, b) => a.y - b.y); }
  // a schedule can name a bare tile instead of a point: it moves with the map, onto floor someone can stand on
  for (const id in G.NPCS) { const d = G.NPCS[id]; if (d.map !== m.id) continue; for (const e of d.schedule || []) if (e.at && typeof e.at === 'object' && !e.at.real) {
    const x0 = e.at.x * K, y0 = e.at.y * K; let best = null; for (let r = 0; r < 12 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy; if (m.inBounds(x, y) && !m.isSolidTile(x, y) && !G.TILES[m.get(x, y)].water && !onRoad(m.get(x, y))) { best = { x, y }; break; } }
    if (best) { e.at.x = best.x; e.at.y = best.y; e.at.real = true; }
  } }
  m.scaled = true; plan = null;
  return m;
}
G.expandMap = expand;
G.planMap = (gen) => { G.parkedPlan(true); let m; try { m = gen(); } finally { G.parkedPlan(false); } return expand(m); };

for (const t of Object.values(G.TERRITORIES || {})) { t.x *= K; t.y *= K; t.w *= K; t.h *= K; }

// ---------------------------------------------------------------- ground canvases only for the map you are on
const TM = G.TileMap.prototype, GS = G.GameScene.prototype, _pre = TM.prerender, _dg = TM.drawGround, _load = GS.loadMap;
G.lazyGround = !!G.GameScene;
TM.prerender = function () { if (G.lazyGround && !this.live) { this.renderMinimap(); return undefined; } return _pre.call(this); };
const wake = (m) => { if (!m.groundCanvas) { m.live = true; _pre.call(m); } };
TM.drawGround = function (ctx, view, time) { wake(this); return _dg.call(this, ctx, view, time); };
const sleep = (m) => { m.live = false; m._gc = m._tc = null; m.groundCanvas = m.groundCtx = m.scorchCanvas = m.landOverlay = m.shore = null; m._needBlend = false; for (const b of m.buildings) b.roofCanvas = b.frontCanvas = null; for (const r of m._walls || []) r.c = null; };
// the map you just left stays awake: going back is instant
GS.loadMap = function (id, spawn, pos) { const was = this.map; if (was && was.id !== id) { const old = this._prevMap; this._prevMap = was; if (old && old !== was && old.id !== id) sleep(old); } return _load.call(this, id, spawn, pos); };
})();
