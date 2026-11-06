'use strict';
// No walls at the end of the world: keep walking off the edge of an outdoor map (away from any road out) and
// you are in the woods. The Woods are a grid of stretches ("cells") laid out around where you went
// in. Every cell (x, y) has its own seeded layout, so north, south, east and west lead into different woods,
// and coming back the same way brings you to the same places. Near the town you find litter, old fences
// and power lines; deeper in, old forest, creeks and ponds, rocky hills, clearings with abandoned camps,
// hunter's stands, burnt patches, swamps and ruined cabins; rarely an abandoned car, a lost hiker, a hidden
// stash, animal dens or a cave mouth. Paths carry on across cell borders.
//   The way back: walk back across as many cells as you went in, toward where you came from, and you come
//   out where you went in. Far from the entry you are lost: chatBCT can call Search & Rescue, who bring you
//   to the Rescue Center in the Rural Zone.
//   Real exits always win: the woods never start within a few tiles of a road out, only after you have
//   kept walking off the edge for about half a second, and never while driving, swimming, inside a
//   building, during dialogue or a cutscene, or on maps without woods (island, interiors, floors, jail).
(() => {
const MB = G.MB, SIDES = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }, OPP = { n: 's', s: 'n', w: 'e', e: 'w' };
const CW = 112, CH = 96;   // one cell, in tiles
G.WILDS_MAPS = ['rural', 'forest', 'city', 'suburbs', 'southside', 'eastside', 'heights', 'industrial', 'farmland', 'neon', 'arts'];
G.NEW_WILD_MAPS = G.NEW_WILD_MAPS || [];
const isWilds = (id) => typeof id === 'string' && (id === 'wilds' || id.startsWith('wilds_'));
G.isWildsMap = isWilds;
const num = (n) => (n < 0 ? 'm' + -n : String(n));
const cellId = (s, cx, cy) => `wilds_${s.from}_${s.side}_${num(cx)}_${num(cy)}`;
const parse = (id) => { const m = /^wilds_([a-z0-9_]+?)_([nswe])_(m?\d+)_(m?\d+)$/.exec(id); if (!m) return null; const v = (t) => (t[0] === 'm' ? -Number(t.slice(1)) : Number(t)); return { from: m[1], side: m[2], cx: v(m[3]), cy: v(m[4]) }; };
const hash = (...a) => G.util.hashString(a.join('|'));

// ---------------------------------------------------------------- props for the woods
const A = G.assets;
const PROPS = {
  power_pole: [10, 40, (x) => { x.fillStyle = '#5a3e26'; x.fillRect(4, 2, 2, 38); x.fillStyle = '#3e2a18'; x.fillRect(0, 5, 10, 2); x.fillStyle = '#9aa0a8'; x.fillRect(0, 4, 1, 1); x.fillRect(9, 4, 1, 1); }],
  hunter_stand: [22, 40, (x) => { x.fillStyle = '#6a4a2a'; x.fillRect(3, 14, 2, 26); x.fillRect(17, 14, 2, 26); for (let y = 18; y < 40; y += 5) x.fillRect(4, y, 14, 1); x.fillStyle = '#7a5a34'; x.fillRect(1, 8, 20, 7); x.fillStyle = '#4a3a22'; x.fillRect(1, 2, 20, 6); x.fillStyle = '#2a1e12'; x.fillRect(5, 9, 12, 3); }],
  tent_old: [28, 20, (x) => { x.fillStyle = '#5a6a3a'; x.beginPath(); x.moveTo(0, 19); x.lineTo(14, 2); x.lineTo(28, 19); x.fill(); x.fillStyle = '#3a4426'; x.beginPath(); x.moveTo(10, 19); x.lineTo(14, 9); x.lineTo(18, 19); x.fill(); x.fillStyle = '#7a8a5a'; x.fillRect(13, 2, 2, 3); }],
  cabin_ruin: [44, 30, (x) => { x.fillStyle = '#4a3420'; x.fillRect(2, 12, 40, 18); x.fillStyle = '#2a1e12'; x.fillRect(8, 18, 8, 12); x.fillRect(26, 16, 8, 6); x.fillStyle = '#5a4028'; x.fillRect(0, 8, 24, 5); x.fillRect(22, 10, 22, 4); x.fillStyle = '#3a2a1a'; for (let i = 4; i < 42; i += 6) x.fillRect(i, 12, 1, 18); }],
  wolf_den: [30, 18, (x) => { x.fillStyle = '#5a5452'; x.beginPath(); x.ellipse(15, 12, 15, 7, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#141010'; x.beginPath(); x.ellipse(15, 13, 7, 4, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#d8d0c0'; x.fillRect(5, 15, 2, 1); x.fillRect(24, 14, 3, 1); }],
  cave_mouth: [40, 30, (x) => { x.fillStyle = '#6a6460'; x.beginPath(); x.ellipse(20, 20, 20, 12, 0, Math.PI, 0); x.fill(); x.fillRect(0, 20, 40, 10); x.fillStyle = '#0a0808'; x.beginPath(); x.ellipse(20, 26, 11, 10, 0, Math.PI, 0); x.fill(); x.fillRect(9, 26, 22, 4); x.fillStyle = '#4a4442'; x.fillRect(3, 14, 6, 3); x.fillRect(29, 12, 7, 3); }],
  reeds: [12, 14, (x) => { x.fillStyle = '#5a7a3a'; for (const [px, h] of [[2, 12], [5, 14], [8, 10], [10, 13]]) x.fillRect(px, 14 - h, 1, h); x.fillStyle = '#6a4a2a'; x.fillRect(5, 0, 1, 3); x.fillRect(10, 1, 1, 3); }],
  old_fence: [16, 14, (x) => { x.fillStyle = '#5a4430'; x.fillRect(2, 2, 2, 12); x.fillRect(12, 4, 2, 10); x.fillStyle = '#6a5038'; x.fillRect(0, 6, 9, 2); x.fillRect(9, 8, 7, 2); }],
};
const _init = A.init;
A.init = function () { _init.call(this); for (const id in PROPS) { const [w, h, fn] = PROPS[id]; const { c, x } = A.mk(w, h); fn(x); if (A.outline) A.outline(c); A.sprites['w_' + id] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
Object.assign(G.DECOR, {
  power_pole: { sprite: 'w_power_pole', solid: true },
  hunter_stand: { sprite: 'w_hunter_stand', solid: true, fw: 2, interact: 'look' },
  tent_old: { sprite: 'w_tent_old', solid: true, fw: 2, interact: 'look' },
  cabin_ruin: { sprite: 'w_cabin_ruin', solid: true, fw: 3, interact: 'look' },
  wolf_den: { sprite: 'w_wolf_den', solid: true, fw: 2, interact: 'look' },
  cave_mouth: { sprite: 'w_cave_mouth', solid: true, fw: 3, interact: 'look' },
  reeds: { sprite: 'w_reeds', solid: false },
  old_fence: { sprite: 'w_old_fence', solid: true },
});
const LOOK_TEXT = { hunter_stand: 'An old hunter\'s stand. The ladder is rotten.', tent_old: 'An abandoned tent, half collapsed. Someone left in a hurry.', cabin_ruin: 'What is left of a cabin. The roof fell in years ago.', wolf_den: 'A den. It smells of wet fur. Something lives here.', cave_mouth: '[Placeholder] A cave mouth, cold air breathing out of it. Not today.' };
const _ulabel = G.usables.use;
G.usables.use = function (d, scene) { if (LOOK_TEXT[d.type]) { scene.toast(LOOK_TEXT[d.type]); return; } return _ulabel.call(this, d, scene); };

// ---------------------------------------------------------------- one cell of woods
// where the path crosses the border between two cells (the same number from both sides: no seams)
const crossing = (s, ax, ay, bx, by, len) => 6 + (hash(s.from, s.side, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)) % (len - 12));
const hasPath = (s, ax, ay, bx, by) => hash('p', s.from, s.side, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)) % 100 < 60;
const BIOMES = ['old_forest', 'creek', 'pond', 'rocky', 'camp', 'stand', 'burnt', 'swamp', 'cabin', 'old_forest'];
G.wildsCell = function (id) {
  const s = parse(id); if (!s) return null;
  const { cx, cy } = s, dist = Math.abs(cx) + Math.abs(cy), r = new G.RNG(id);
  const m = new G.TileMap(id, CW, CH, G.T.grass);
  const biome = dist <= 1 ? 'edge' : BIOMES[hash('b', s.from, s.side, cx, cy) % BIOMES.length];
  const names = { edge: 'Woods by the Road', old_forest: 'Old Forest', creek: 'Creek Woods', pond: 'Woodland Pond', rocky: 'Rocky Hills', camp: 'Abandoned Camp', stand: 'Hunting Grounds', burnt: 'Burnt Woods', swamp: 'The Swamp', cabin: 'Ruined Cabin' };
  m.meta = { name: 'The Woods', sub: names[biome], region: 'forest', music: 'forest', darkness: 0.35 + Math.min(0.25, dist * 0.03), wilds: true, biome };
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (MB.noise(x + cx * CW, y + cy * CH, 7, 2) > (biome === 'old_forest' ? 0.45 : 0.6)) m.set(x, y, G.T.darkgrass);
  const mx = Math.floor(CW / 2), my = Math.floor(CH / 2);
  const keep = [];   // tiles that must stay open (paths, clearings, landmarks)
  const clear = (x, y) => keep.push(x + ',' + y);
  // paths: from each border crossing to the middle (so paths line up with the neighbors' paths)
  const ends = [];
  if (hasPath(s, cx, cy, cx, cy - 1)) ends.push([crossing(s, cx, cy, cx, cy - 1, CW), 0]);
  if (hasPath(s, cx, cy, cx, cy + 1)) ends.push([crossing(s, cx, cy, cx, cy + 1, CW), CH - 1]);
  if (hasPath(s, cx, cy, cx - 1, cy)) ends.push([0, crossing(s, cx, cy, cx - 1, cy, CH)]);
  if (hasPath(s, cx, cy, cx + 1, cy)) ends.push([CW - 1, crossing(s, cx, cy, cx + 1, cy, CH)]);
  for (const [ex, ey] of ends) {
    let x = ex, y = ey;
    for (let k = 0; k < 400 && (x !== mx || y !== my); k++) {
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) { if (m.inBounds(x + ox, y + oy)) { m.set(x + ox, y + oy, G.T.dirt); clear(x + ox, y + oy); } }
      if (Math.abs(x - mx) > Math.abs(y - my) ? r.chance(0.8) : r.chance(0.2)) x += Math.sign(mx - x); else y += Math.sign(my - y);
    }
  }
  const place = (type, x, y) => { if (m.inBounds(x, y) && m.isFree(x, y, G.DECOR[type].fw || 1, 1)) { m.addDecor(type, x, y); m.markOccupied(x, y, G.DECOR[type].fw || 1, 1); return true; } return false; };
  // the biome's set piece, around the middle
  const ring = (rx, ry, t) => MB.ellipse(m, mx, my, rx, ry, t);
  switch (biome) {
    case 'edge': {   // litter, old fences, a line of power poles
      for (let i = 0; i < 14; i++) { const x = r.int(2, CW - 3), y = r.int(2, CH - 3); if (m.isFree(x, y)) m.addDecor('trash', x, y); }
      const py = r.int(8, CH - 8); for (let x = 3; x < CW; x += 9) place('power_pole', x, py);
      for (let i = 0; i < 6; i++) place('old_fence', r.int(3, CW - 4), r.int(3, CH - 4));
      if (r.chance(0.5)) place('car_wreck', r.int(6, CW - 8), r.int(6, CH - 8));
      break;
    }
    case 'creek': for (let y = 0; y < CH; y++) { const x = Math.round(mx + Math.sin((y + cy * CH) / 6) * 5); m.set(x, y, G.T.water); m.set(x + 1, y, G.T.water); } break;
    case 'pond': ring(8, 5, G.T.water); MB.ellipse(m, mx, my, 10, 7, G.T.sand, [G.T.grass, G.T.darkgrass]); ring(8, 5, G.T.water); for (let i = 0; i < 10; i++) place('reeds', mx + r.int(-10, 10), my + r.int(-7, 7)); break;
    case 'rocky': for (let i = 0; i < 40; i++) place(r.pick(['boulder', 'rock', 'rock', 'boulder']), r.int(3, CW - 4), r.int(3, CH - 4)); break;
    case 'camp': ring(6, 4, G.T.dirt); place('campfire', mx, my); place('tent_old', mx + 3, my - 2); place('log', mx - 3, my + 1); for (let y = my - 4; y <= my + 4; y++) for (let x = mx - 6; x <= mx + 6; x++) clear(x, y); break;
    case 'stand': ring(7, 5, G.T.grass); place('hunter_stand', mx, my); for (let y = my - 5; y <= my + 5; y++) for (let x = mx - 7; x <= mx + 7; x++) clear(x, y); break;
    case 'burnt': for (let y = my - 12; y <= my + 12; y++) for (let x = mx - 18; x <= mx + 18; x++) if (m.inBounds(x, y) && ((x - mx) / 18) ** 2 + ((y - my) / 12) ** 2 < 1 && m.get(x, y) !== G.T.dirt) m.set(x, y, G.T.burnt_grass); break;
    case 'swamp': for (let i = 0; i < 9; i++) MB.ellipse(m, r.int(6, CW - 7), r.int(6, CH - 7), r.int(2, 4), r.int(1, 3), G.T.water); for (let i = 0; i < 30; i++) place('reeds', r.int(2, CW - 3), r.int(2, CH - 3)); break;
    case 'cabin': ring(7, 5, G.T.dirt); place('cabin_ruin', mx - 1, my); place('rubble', mx + 3, my + 2); for (let y = my - 5; y <= my + 5; y++) for (let x = mx - 7; x <= mx + 7; x++) clear(x, y); break;
  }
  // rare landmarks
  const lm = hash('lm', s.from, s.side, cx, cy) % 100;
  const spot = () => { for (let k = 0; k < 40; k++) { const x = r.int(5, CW - 8), y = r.int(5, CH - 6); if (m.isFree(x, y, 3, 2) && !m.isSolidTile(x, y)) return [x, y]; } return null; };
  m.landmark = null;
  if (dist >= 2 && lm < 8) { const p = spot(); if (p) { place('car_wreck', p[0], p[1]); m.landmark = 'car'; } }
  else if (dist >= 2 && lm < 14) { m.landmark = 'hiker'; m.points.w_hiker = { x: mx + 2, y: my + 2 }; }
  else if (dist >= 2 && lm < 21) { const p = spot(); if (p) { MB.chest(m, 'stash_' + num(cx) + '_' + num(cy), p[0], p[1], null, [[r.pick(['cash_roll', 'pistol', 'weed', 'first_aid_kit', 'hunting_knife', 'ammo_9mm']), r.int(1, 3)], [r.pick(['canned_beans', 'water_bottle', 'bandage']), 2]].filter((e) => G.ITEMS[e[0]]), r.int(10, 120)); m.landmark = 'stash'; } }
  else if (dist >= 2 && lm < 29) { const p = spot(); if (p) { place('wolf_den', p[0], p[1]); m.landmark = 'den'; m.animalZones.push({ kind: 'wolf', x: p[0] - 6, y: p[1] - 5, w: 14, h: 10, max: 3 }); } }
  else if (dist >= 3 && lm < 33) { const p = spot(); if (p) { place('cave_mouth', p[0], p[1]); m.landmark = 'cave'; } }
  // trees (thinner near the edges so you can always cross, and never on paths or set pieces)
  const keepSet = new Set(keep);
  const trees = biome === 'burnt' ? ['deadtree', 'deadtree', 'stump', 'char_pile'] : biome === 'swamp' ? ['deadtree', 'bush', 'oak1', 'reeds'] : ['pine0', 'pine1', 'oak0', 'oak1', 'oak2', 'pine0', 'pine1', 'bush', 'berrybush', 'rock', 'deadtree'];
  const density = biome === 'old_forest' ? 700 : biome === 'edge' ? 300 : 480;
  for (let i = 0; i < density; i++) {
    const x = r.int(1, CW - 2), y = r.int(1, CH - 2);
    const edge = x < 3 || y < 3 || x > CW - 4 || y > CH - 4;
    if (edge && r.chance(0.85)) continue;
    if (keepSet.has(x + ',' + y) || ![G.T.grass, G.T.darkgrass, G.T.burnt_grass].includes(m.get(x, y)) || !m.isFree(x, y)) continue;
    if (G.DECOR[trees[0]] && G.DECOR[trees[i % trees.length]]) place(trees[r.int(0, trees.length - 1)], x, y);
  }
  // forage and animals for this stretch
  const forage = biome === 'swamp' ? ['mushroom', 'death_cap', 'fly_agaric', 'tuft'] : biome === 'burnt' ? ['pebbles', 'tuft'] : ['mushroom', 'chanterelle', 'fly_agaric', 'death_cap', 'magic_mushroom', 'flowers', 'tuft', 'tuft', 'pebbles'];
  MB.scatter(m, r, forage, 50 + (biome === 'old_forest' ? 40 : 0), 2, 2, CW - 3, CH - 3, [G.T.grass, G.T.darkgrass]);
  const wolves = Math.min(4, Math.floor(dist / 2) + (biome === 'old_forest' ? 1 : 0));
  if (['camp', 'stand', 'pond', 'edge', 'creek'].includes(biome)) m.animalZones.push({ kind: 'deer', x: mx - 10, y: my - 8, w: 20, h: 16, max: 3 });
  m.animalZones.push({ kind: 'rabbit', x: 4, y: 4, w: CW - 8, h: CH - 8, max: 2 });
  if (wolves) m.animalZones.push({ kind: 'wolf', x: 4, y: 4, w: CW - 8, h: CH - 8, max: wolves });
  m.points.start = { x: mx, y: my + 3 };
  m.finalize();
  return m;
};
// cells are made on demand; only the last few stay in memory
const _get = G.maps.get;
G.maps.get = function (id) {
  if (isWilds(id) && id !== 'wilds' && !G.MAPGEN[id]) G.MAPGEN[id] = () => G.wildsCell(id);
  const m = _get.call(this, id);
  if (isWilds(id) && id !== 'wilds') {
    const w = G.world;
    if (w) m.animalZones.forEach((z, i) => { const k = id + ':' + i; if (!w.wildlife[k]) w.wildlife[k] = { kind: z.kind, map: id, count: z.max, max: z.max, owner: null }; });
    this.wildsOrder = (this.wildsOrder || []).filter((x) => x !== id).concat(id);
    while (this.wildsOrder.length > 6) { const old = this.wildsOrder.shift(); delete this.cache[old]; }
  }
  return m;
};
// the old single stretch (saves made inside it come back to a cell)
G.MAPGEN.wilds = () => G.wildsCell('wilds_rural_n_0_m1');

// ---------------------------------------------------------------- going in, moving on, coming out
G.wilds = {
  // is there woods beyond this edge, right now?
  allowed(scene) {
    const m = scene.map, p = scene.player;
    if (!G.WILDS_MAPS.includes(m.id) || m.meta.floorOf || m.meta.indoor || scene.world.jail) return false;
    if (p.vehicle || p.swimming || p.dead || p.dragging || m.buildingAt(p.x, p.y - 3) || G.scenes.top() !== scene || scene.transitioning) return false;
    return true;
  },
  nearExit(m, p, tiles = 4) {
    const tx = p.x / 16, ty = (p.y - 3) / 16;
    return m.exits.some((e) => tx > e.x - tiles && tx < e.x + e.w + tiles && ty > e.y - tiles && ty < e.y + e.h + tiles);
  },
  enter(scene, side) {
    const w = scene.world, p = scene.player, m = scene.map;
    const s = w.wilds = { from: m.id, side, pos: { x: G.util.clamp(p.x, 24, m.pw - 24), y: G.util.clamp(p.y, 24, m.ph - 24) }, cx: SIDES[side][0], cy: SIDES[side][1], wraps: 0, frac: side === 'n' || side === 's' ? p.x / m.pw : p.y / m.ph };
    const id = cellId(s, s.cx, s.cy), at = this.arrival(G.maps.get(id), OPP[side], s.frac);
    scene.transitioning = true;
    G.scenes.push(new G.FadeScene(() => { scene.transitioning = false; scene.loadMap(id, null, at); }, G.TRANSITION));
  },
  arrival(wm, side, frac) {
    const [dx, dy] = SIDES[side];
    const x = dx ? (dx < 0 ? 2 : wm.w - 3) : Math.round(frac * (wm.w - 6)) + 3, y = dy ? (dy < 0 ? 2 : wm.h - 3) : Math.round(frac * (wm.h - 6)) + 3;
    const t = wm.randomWalkableNear(x, y, 3, G.rng, false) || { x, y };
    return { x: t.x * 16 + 8, y: t.y * 16 + 12 };
  },
  lost(w) { return !!(w.wilds && Math.abs(w.wilds.cx) + Math.abs(w.wilds.cy) >= 3); },
  cross(scene, side) {
    const w = scene.world, cur = parse(scene.map.id);
    const s = w.wilds || (w.wilds = cur ? { from: cur.from, side: cur.side, cx: cur.cx, cy: cur.cy, pos: null, wraps: 0, frac: 0.5 } : { from: 'rural', side: 'n', pos: { x: 79 * 16, y: 3 * 16 }, cx: 0, cy: -1, wraps: 0, frac: 0.5 });
    const [dx, dy] = SIDES[side], p = scene.player, frac = side === 'n' || side === 's' ? p.x / scene.map.pw : p.y / scene.map.ph;
    const nx = s.cx + dx, ny = s.cy + dy;
    if (nx === 0 && ny === 0) {   // back to where you came in
      const from = s.from, pos = s.pos || G.maps.get(from).points.start || { x: 40 * 16, y: 40 * 16 }; w.wilds = null;
      scene.transitioning = true;
      G.scenes.push(new G.FadeScene(() => { scene.transitioning = false; const fm = G.maps.get(from); scene.loadMap(from, null, this.inward(fm, pos, s.side)); scene.toast('You find your way out of the woods.', 'good'); }, G.TRANSITION));
      return;
    }
    s.cx = nx; s.cy = ny; s.wraps++;
    const id = cellId(s, nx, ny), wm = G.maps.get(id), at = this.arrival(wm, OPP[side], frac);
    scene.transitioning = true;
    G.scenes.push(new G.FadeScene(() => {
      scene.transitioning = false; scene.loadMap(id, null, at);
      if (wm.meta.sub) scene.toast(wm.meta.sub, 'info');
      if (this.lost(w) && !s.toldLost) { s.toldLost = true; scene.toast('Every tree looks the same. You are lost.', 'warn'); w.log('You got lost in the woods. (chatBCT might be able to help.)', 'warn'); }
    }, G.TRANSITION));
  },
  inward(m, pos, side) { const [dx, dy] = SIDES[side], at = { x: G.util.clamp(pos.x - dx * 28, 24, m.pw - 24), y: G.util.clamp(pos.y - dy * 28, 24, m.ph - 24), w: 10, h: 6 }; if (!m.rectCollides(at.x - 5, at.y - 6, 10, 6)) return at; return G.everyday.nearSpot(m, at) || at; },
  rescue(scene) {
    const w = scene.world, m = G.maps.get('rural'), at = m.points.r_rescue_arrive;
    w.wilds = null; w.bctRescue = false;
    G.scenes.push(new G.FadeScene(() => {
      scene.passTime(2, false);
      scene.loadMap('rural', null, { x: at.x * 16 + 8, y: at.y * 16 + 12 });
      scene.toast('Search and Rescue found you and brought you in.', 'good');
      w.log('Search and Rescue brought you to the Rescue Center. ("Stay on the trails next time.")', 'info');
      const ranger = scene.actors.find((a) => a.id === 'r_ranger');
      if (ranger) ranger.say(G.rng.pick(['Stay on the trails next time, okay?', 'You are lucky we found you before the wolves did.', 'Drink some water. You look terrible.']), 5);
    }, 2.2));
  },
};
// walking off an edge: hold the direction for half a second, away from any road out
const GS = G.GameScene.prototype, _gu = GS.update, _load = GS.loadMap;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  const p = this.player, m = this.map;
  if (!p || !m || p.dead) return r;
  const inWoods = isWilds(m.id);
  if (!inWoods && !G.wilds.allowed(this)) { this.edgePush = 0; return r; }
  if (inWoods && (G.scenes.top() !== this || this.transitioning || p.vehicle)) return r;
  // the side you are at; in a corner, the one you are walking at
  const wx = p.wishX || 0, wy = p.wishY || 0, at = { w: p.x < 24, e: p.x > m.pw - 24, n: p.y < 36, s: p.y > m.ph - 20 }, side = at.w && wx < -0.1 ? 'w' : at.e && wx > 0.1 ? 'e' : at.n && wy < -0.1 ? 'n' : at.s && wy > 0.1 ? 's' : null;
  // a hint before you go: the edge darkens and you are told you are leaving the road
  const close = !inWoods && (p.x < 40 || p.x > m.pw - 40 || p.y < 44 || p.y > m.ph - 30) && !G.wilds.nearExit(m, p, 6);
  if (close && !this.edgeHinted) { this.edgeHinted = true; this.toast('Leaving the road... the woods start here.', 'info'); }
  if (!close) this.edgeHinted = false;
  if (!side) { this.edgePush = 0; return r; }
  if (!inWoods && G.wilds.nearExit(m, p, 2)) { this.edgePush = 0; return r; }   // (the road out takes this stretch: it reaches two tiles along the edge)
  if ((this.arrivedT || 0) < 0.6 || (this.edgePush = (this.edgePush || 0) + dt) < 0.22) return r;
  this.edgePush = 0;
  if (inWoods) G.wilds.cross(this, side); else G.wilds.enter(this, side);
  return r;
};
GS.loadMap = function (id, spawnName, pos) {
  const r = _load.call(this, id, spawnName, pos);
  // a lost hiker in some stretches
  const m = this.map;
  if (m && m.landmark === 'hiker' && m.points.w_hiker && !this.actors.some((a) => a.def && a.def.lostHiker)) {
    const seed = m.id, look = G.look('hiker' + seed, { top: 'jacket', shirt: '#c85a2a', shirt2: '#e8d060', pants: '#3a4a3a', hat: 'cap', hatColor: '#3a5a2a' });
    const def = { id: 'hiker_' + G.util.uid('h'), name: 'Lost Hiker', map: m.id, faction: 'civilians', hp: 25, combat: 'flee', look, transient: true, relations: {}, lostHiker: true, dialogue: 'lost_hiker', schedule: [{ from: 0, to: 24, at: 'w_hiker', act: 'wander' }] };
    const st = { alive: true, name: def.name, map: m.id, hp: 25, fear: 0, inv: [['water_bottle', 1]], gold: 12, realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
    const n = new G.NPC(def.id, st, def); n.x = m.points.w_hiker.x * 16 + 8; n.y = m.points.w_hiker.y * 16 + 12; this.actors.push(n);
  }
  return r;
};
G.DIALOGUES.lost_hiker = {
  start: { common: true, text: 'Oh thank God, a person! I have been walking in circles for two days. Do you know the way out?', choices: [{ text: 'Call Search & Rescue. They will come for you.', next: 'calm' }, { text: 'No idea. Good luck.', next: null }] },
  calm: { text: 'You think they will find me? ...Okay. Okay. I will stay put. Thank you.', choices: [{ text: 'Goodbye.', next: null, do: (c) => { c.w.log('You told a lost hiker to wait for Search & Rescue.', 'good'); } }] },
};
// a darker band of trees along edges where the woods begin (drawn under the HUD)
const _fx = GS.renderScreenFx;
GS.renderScreenFx = function (ctx) {
  _fx.call(this, ctx);
  const m = this.map; if (!m || isWilds(m.id) || !G.WILDS_MAPS.includes(m.id) || m.meta.indoor) return;
  const R = G.renderer, v = R.viewRect(0), p = this.player;
  if (!p || G.wilds.nearExit(m, p, 6)) return;
  R.screenTransform ? R.screenTransform() : R.uiTransform();
  const sx = R.W / v.w, sy = R.H / v.h, band = 36;
  const edge = (x, y, w, h, gx0, gy0, gx1, gy1) => { const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(6,14,8,0.55)'); g.addColorStop(1, 'rgba(6,14,8,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); };
  if (v.x < band) { const w = (band - v.x) * sx; edge(0, 0, w, R.H, 0, 0, w, 0); }
  if (v.x + v.w > m.pw - band) { const w = (v.x + v.w - (m.pw - band)) * sx; edge(R.W - w, 0, w, R.H, R.W, 0, R.W - w, 0); }
  if (v.y < band) { const h = (band - v.y) * sy; edge(0, 0, R.W, h, 0, 0, 0, h); }
  if (v.y + v.h > m.ph - band) { const h = (v.y + v.h - (m.ph - band)) * sy; edge(0, R.H - h, R.W, h, 0, R.H, 0, R.H - h); }
};

// ---------------------------------------------------------------- open edges in the countryside
for (const id of ['rural', 'forest']) {
  const gen = G.MAPGEN[id];
  G.MAPGEN[id] = () => {
    const m = gen(), nature = /^(oak|pine|bush|berrybush|rock|boulder|deadtree|stump)/, r = new G.RNG('edge-' + id);
    const near = (d) => Math.min(d.tx, d.ty, m.w - 1 - d.tx, m.h - 1 - d.ty);
    const before = m.decor.length;
    m.decor = m.decor.filter((d) => !(nature.test(d.type) && near(d) <= 2 && r.chance(near(d) === 0 ? 0.95 : 0.7)));
    if (m.decor.length !== before) { m.computeSolids(); m.prerender(); }
    return m;
  };
}

// ---------------------------------------------------------------- the Rescue Center (Rural Zone, north-west)
const _rural = G.MAPGEN.rural;
G.MAPGEN.rural = () => {
  const m = _rural();
  m.decor = m.decor.filter((d) => !(d.tx >= 3 && d.tx <= 20 && d.ty >= 3 && d.ty <= 16));
  const b = m.addBuilding('r_rescue', 4, 4, 14, 9, { name: 'Search & Rescue Center', wall: 'wall_concrete', floor: 'tilefloor', roof: 'red', kind: 'office', chimney: false });
  for (const [t, x, y] of [['bed', 5, 5], ['bed', 7, 5], ['bed', 9, 5], ['desk', 13, 6], ['shelf', 16, 5], ['watercooler', 16, 8], ['plant', 5, 10], ['floorlamp', 11, 5]]) if (G.DECOR[t]) m.addDecor(t, x, y);
  MB.chest(m, 'r_rescue_kit', 15, 5, 'r_ranger', [['first_aid_kit', 2], ['bandage', 4], ['water_bottle', 4], ['flashlight', 1]], 0);
  m.points.r_rescue_work = { x: 13, y: 7 };
  m.points.r_rescue_arrive = { x: b.doorX, y: b.doorY + 2 };
  m.addDecor('sign', b.doorX + 2, b.doorY + 1);
  m.signs[(b.doorX + 2) + ',' + (b.doorY + 1)] = 'SEARCH & RESCUE. Lost? Hurt? We will find you. (Stay on the trails.)';
  m.addDecor('car_red', 20, 8);
  m.finalize();
  return m;
};
G.NPCS.r_ranger = { id: 'r_ranger', name: 'Park Ranger', map: 'rural', faction: 'government', hp: 60, combat: 'fight', weapon: 'hunting_rifle', home: 'r_rescue', gold: 30, relations: {}, gender: 'female',
  look: G.look('ranger', { body: 'f', top: 'jacket', shirt: '#5a6a3a', shirt2: '#c8b070', pants: '#3a3a2a', hat: 'cap', hatColor: '#4a5a2a' }), inv: [['first_aid_kit', 1]],
  schedule: [{ from: 7, to: 20, at: 'r_rescue_work', act: 'work' }, { from: 20, to: 7, at: 'r_rescue_in', act: 'idle' }] };
G.NPCS.r_rescuer = { id: 'r_rescuer', name: 'Rescue Worker', map: 'rural', faction: 'government', hp: 45, combat: 'flee', home: 'r_rescue', gold: 15, relations: { r_ranger: 'comrade' }, gender: 'male',
  look: G.look('rescuer', { body: 'm', top: 'jacket', shirt: '#d84a2a', shirt2: '#f0e040', pants: '#2a2a32' }), inv: [['bandage', 2]],
  schedule: [{ from: 6, to: 18, at: 'r_rescue_in', act: 'wander' }, { from: 18, to: 6, at: 'r_rescue_in', act: 'idle' }] };

// ---------------------------------------------------------------- chatBCT, when you are lost
const LOST_Q = 'I am lost in this forest. Can you help me?';
const B = G.bct, sug = Object.getOwnPropertyDescriptor(B, 'SUGGEST');
Object.defineProperty(B, 'SUGGEST', { configurable: true, get() {
  const base = sug.get.call(this), w = G.world;
  if (w && w.bctRescue) return ['Yes, please.', 'Not now.'].concat(base);
  if (w && G.wilds.lost(w)) return [LOST_Q].concat(base);
  return base;
} });
const _reply = B.reply;
B.reply = function (scene, raw) {
  const w = scene.world, t = raw.toLowerCase();
  if (w.bctRescue && /^(yes|yeah|please|ok|okay|sure|do it|call)/.test(t)) { w.bctRescue = false; G.wilds.rescue(scene); return this.pick(['Calling them. Try not to get eaten in the next ten minutes.', 'Done. Search and Rescue is on the way. I told them to look for the person walking in circles.']); }
  if (w.bctRescue && /^(no|not now|nah|later)/.test(t)) { w.bctRescue = false; return this.pick(['Fine. Enjoy the trees. All of them. Again.', 'Your funeral. Literally, possibly.']); }
  if (/\b(lost|cannot find|can't find|where am i|get out of (the|this) (forest|woods)|help me)\b/.test(t) && isWilds(scene.map.id)) {
    w.bctRescue = true;
    return this.pick([
      'Lost? In a forest? Shocking. Truly. You walked into the trees and kept going. Who could have predicted this. I can call the rescue if you want.',
      'Let me check the map... yep, trees. You are surrounded by trees. Great work. I can call the rescue if you want.',
      'I have GPS. You have... a sense of direction, apparently not. I can call the rescue if you want.',
    ]);
  }
  return _reply.call(this, scene, raw);
};
})();
