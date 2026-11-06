'use strict';
// TileMap: tile grid + decorations + buildings (with fading roofs) + lights + exits + named points.
// Maps are built by generator functions in js/data/maps.js through the builder helpers below.

G.ROOF_COLORS = {
  red: ['#a8462f', '#8e3a2a', '#6e2a1e'],
  blue: ['#3e5a8a', '#324a74', '#243656'],
  thatch: ['#6a5a4e', '#5a4c42', '#463a32'],     // (kept for old maps) asphalt shingles
  shingle: ['#5a5a62', '#4a4a52', '#38383e'],
  white: ['#e8e4dc', '#d0ccc4', '#a8a49c'],
  // flat roofs (city): gravel with a parapet and AC units
  flat: ['#7a7a80', '#6a6a70', '#4a4a50'],
  flat_light: ['#a8a49c', '#98948c', '#6a665e'],
  flat_dark: ['#4a4a50', '#3e3e44', '#2a2a30'],
  flat_brick: ['#7a7a80', '#6a6a70', '#5a2a20'],
  slate: ['#5a5e68', '#4a4e58', '#363a42'],
  green: ['#4a7a4a', '#3c663c', '#2c4e2c'],
  dark: ['#3a2a30', '#2a1e24', '#1a1216'],
  brown: ['#7a5a3a', '#664a2e', '#4e3822'],
};

// what every tile id means for walking and paths, as flat tables (rebuilt if tiles are added: a custom world brings its own)
const TileFacts = { n: 0, t: null, of() {
  const ids = Object.values(G.T), max = ids.reduce((a, b) => Math.max(a, b), 0) + 1; if (this.t && this.n === ids.length) return this.t;
  const solid = new Uint8Array(max), water = new Uint8Array(max), cost = new Uint8Array(max).fill(1), T = G.T;
  for (const id of ids) { const d = G.TILES[id]; if (d) { solid[id] = d.solid ? 1 : 0; water[id] = d.water ? 1 : 0; } }
  for (const id of [T.path, T.cobble, T.plaza, T.bridge, T.dock, T.dirt, T.woodfloor, T.stonefloor, T.carpet, T.door, T.darkstone, T.sidewalk, T.concrete, T.tilefloor, T.lot, T.court]) if (id != null) cost[id] = 0;
  for (const id of [T.asphalt, T.road_line, T.road_line_v]) if (id != null) cost[id] = 3;
  this.n = ids.length; return (this.t = { solid, water, cost });
} };
class TileMap {
  constructor(id, w, h, fill = 1) {
    this.id = id;
    this.w = w;
    this.h = h;
    this.ground = new Uint8Array(w * h).fill(fill);
    this.solid = new Uint8Array(w * h);
    this.decor = [];
    this.flats = [];
    this.buildings = [];
    this.points = {};
    this.exits = [];
    this.lights = [];
    this.animalZones = [];
    this.chests = [];       // static chest definitions {id, tx, ty, owner, loot}
    this.signs = {};        // "tx,ty" -> text
    this.dangerZones = [];  // night spawn areas
    this.meta = {};
  }

  get pw() { return this.w * 16; }
  get ph() { return this.h * 16; }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.ground[y * this.w + x] : 0; }
  set(x, y, t) { if (this.inBounds(x, y)) this.ground[y * this.w + x] = t; }
  fill(x, y, w, h, t) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t);
  }
  tileDef(x, y) { return G.TILES[this.get(x, y)]; }

  // ---------- builder helpers ----------
  addDecor(type, tx, ty, extra = {}) {
    const def = G.DECOR[type];
    if (!def) throw new Error('Unknown decor ' + type);
    const fw = def.fw || 1;
    const d = Object.assign({ type, def, tx, ty, x: tx * 16 + fw * 8, y: ty * 16 + 15 }, extra);
    if (def.flat) this.flats.push(d);
    else this.decor.push(d);
    if (def.light) {
      d.light = { x: d.x, y: d.y - (G.assets.sprites[def.sprite].h * 0.7), r: def.light.r, color: def.light.color, flicker: !!def.flicker };
      this.lights.push(d.light);
    }
    // added after the map was built (props, cribs, furniture placed by game systems): make it solid now, or
    // people walk right through it
    if (this.finalized && !def.flat) {
      if (def.solid) { const fh = def.fh || 1; for (let y = ty - fh + 1; y <= ty; y++) for (let x = tx; x < tx + fw; x++) if (this.inBounds(x, y)) { this.solid[y * this.w + x] = 1; if (this.swimmable) this.swimmable[y * this.w + x] = 0; } }
      if (this.decorAt) for (const i of this.footprint(d)) { if (!this.decorAt.has(i)) this.decorAt.set(i, []); this.decorAt.get(i).push(d); }
      this.decor.sort((a, b) => a.y - b.y);
    }
    return d;
  }

  // Is the area free for placing something (no solids, no decor footprint, no building)?
  isFree(tx, ty, w = 1, h = 1, allowedTiles = null) {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) return false;
        const t = this.get(x, y);
        if (G.TILES[t].solid) return false;
        if (allowedTiles && !allowedTiles.includes(t)) return false;
        if (this._occupied && this._occupied[y * this.w + x]) return false;
      }
    }
    return true;
  }

  markOccupied(tx, ty, w = 1, h = 1) {
    if (!this._occupied) this._occupied = new Uint8Array(this.w * this.h);
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.inBounds(x, y)) this._occupied[y * this.w + x] = 1;
  }

  // Building with walls, floor, a door on the bottom wall, and a roof that fades when the player enters.
  addBuilding(id, x, y, w, h, opts = {}) {
    const wall = G.T[opts.wall || 'wall_wood'];
    const floor = G.T[opts.floor || 'woodfloor'];
    this.fill(x, y, w, h, wall);
    this.fill(x + 1, y + 1, w - 2, h - 2, floor);
    const doorX = opts.doorX != null ? x + opts.doorX : x + Math.floor(w / 2);
    const doorY = y + h - 1;
    this.set(doorX, doorY, G.T.door);
    const b = {
      id, name: opts.name || id, x, y, w, h, doorX, doorY,
      roof: opts.roof || 'red', chimney: opts.chimney !== false && w >= 5,
      roofAlpha: 1, lit: false, windows: [], kind: opts.kind || 'house',
    };
    for (let i = x + 1; i < x + w - 1; i++) {
      if (Math.abs(i - doorX) > 1 && (i - x) % 2 === 0) b.windows.push({ x: i * 16 + 8, y: doorY * 16 + 9 });
    }
    this.buildings.push(b);
    this.markOccupied(x - 1, y - 1, w + 2, h + 2);
    this.points[id + '_door'] = { x: doorX, y: doorY + 1 };
    this.points[id + '_in'] = { x: doorX, y: doorY - 1 };
    this.points[id + '_center'] = { x: x + Math.floor(w / 2), y: y + Math.floor((h - 1) / 2) };
    return b;
  }

  addExit(x, y, w, h, to, spawn, label) {
    this.exits.push({ x, y, w, h, to, spawn, label });
  }

  // ---------- finalize ----------
  computeSolids() {
    // (what each kind of tile means, worked out once per kind: these three loops run over every tile of every map, many times while a world is planned)
    const T = TileFacts.of(), g = this.ground, n = g.length, solid = this.solid, swim = this.swimmable = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const k = g[i]; solid[i] = T.solid[k]; swim[i] = T.water[k]; }
    for (const d of this.decor) {
      if (!d.def.solid) continue;
      const fw = d.def.fw || 1, fh = d.def.fh || 1;
      for (let y = d.ty - fh + 1; y <= d.ty; y++) for (let x = d.tx; x < d.tx + fw; x++) if (this.inBounds(x, y)) { this.solid[y * this.w + x] = 1; this.swimmable[y * this.w + x] = 0; }
    }
    for (const c of this.chests) this.solid[c.ty * this.w + c.tx] = 1;
    this.buildDecorIndex();
    // prefer roads for pathing: off-road tiles cost a little extra
    this.pathCost = new Uint8Array(this.w * this.h);
    // people keep to sidewalks and paths: walking along the road itself (where cars drive) costs the most
    const pc = this.pathCost; for (let i = 0; i < n; i++) pc[i] = T.cost[g[i]];
  }

  // Remove vegetation/rocks that ended up on named points (NPC waypoints, spawns, beds).
  clearPoints() {
    const set = new Set();
    for (const k in this.points) {
      const v = this.points[k];
      for (const p of Array.isArray(v) ? v : [v]) set.add(p.x + ',' + p.y);
    }
    // doorways and map exits must stay clear too
    for (const b of this.buildings) set.add(b.doorX + ',' + (b.doorY + 1));
    for (const e of this.exits) for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) set.add(x + ',' + y);
    const nature = /^(oak|pine|bush|berrybush|rock|boulder|stump|log|deadtree|lamp|trashcan|hydrant|bench|dumpster|car_|mailbox|plant|vending|crate|barrel|haybale)/;
    this.decor = this.decor.filter((d) => {
      if (!d.def.solid || !nature.test(d.type)) return true;
      const fw = d.def.fw || 1, fh = d.def.fh || 1;
      for (let y = d.ty - fh + 1; y <= d.ty; y++) for (let x = d.tx; x < d.tx + fw; x++) if (set.has(x + ',' + y)) return false;
      return true;
    });
  }

  finalize() {
    this.clearPoints();
    this.computeSolids();
    this.decor.sort((a, b) => a.y - b.y);
    this.prerender();
    this.finalized = true;
  }

  prerender() {
    const A = G.assets;
    const { c, x } = A.mk(this.w * 16, this.h * 16);
    this.groundCanvas = c;
    this.groundCtx = x;
    this.windowAt = new Map();
    for (const b of this.buildings) {
      for (const w of b.windows) this.windowAt.set(Math.floor(w.y / 16) * this.w + Math.floor(w.x / 16), w);
      b.roofCanvas = this.renderRoof(b);
    }
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) this.drawTileInto(x, tx, ty, false);
    for (const f of this.flats) {
      const s = A.sprites[f.def.sprite];
      x.drawImage(s.img, Math.round(f.x - s.ax), Math.round(f.y - s.ay));
    }
    for (const [i, w] of this.windowAt) {
      if (!G.TILES[this.ground[i]].wall) continue;
      const s = A.sprites.window;
      x.drawImage(s.img, w.x - s.ax, w.y - s.ay);
    }
    this.renderMinimap();
  }

  drawTileInto(x, tx, ty, withExtras = true) {
    const A = G.assets;
    const def = G.TILES[this.ground[ty * this.w + tx]];
    const hsh = G.util.hash2(tx, ty, 7);
    if (def.over) x.drawImage(A.tile(def.over, hsh), tx * 16, ty * 16);
    // fences follow their run: north-south pieces are drawn upright, corners get both
    const fence = def.tex === 'fence' || def.tex === 'chainlink' || def.tex === 'ironfence';
    if (fence) {
      const same = (dx, dy) => { const n = G.TILES[this.get(tx + dx, ty + dy)]; return !!n && n.tex === def.tex && this.inBounds(tx + dx, ty + dy); };
      const v = same(0, -1) || same(0, 1), h = same(-1, 0) || same(1, 0);
      if (v && !h) x.drawImage(A.tile(def.tex + '_v', 0), tx * 16, ty * 16);
      else { x.drawImage(A.tile(def.tex, 0), tx * 16, ty * 16); if (v) x.drawImage(A.tile(def.tex + '_v', 0), tx * 16, ty * 16); }
    } else if (def.tex) x.drawImage(A.tile(def.tex, def.anim ? 0 : hsh), tx * 16, ty * 16);
    else { x.fillStyle = '#000'; x.fillRect(tx * 16, ty * 16, 16, 16); }
    // drop shadow under walls/cliffs
    if (!def.solid && ty > 0) {
      const up = G.TILES[this.ground[(ty - 1) * this.w + tx]];
      if (up.wall || up.name === 'citywall' || up.name === 'cliff') {
        x.fillStyle = 'rgba(0,0,0,0.28)';
        x.fillRect(tx * 16, ty * 16, 16, 4);
      }
    }
    if (!withExtras) return;
    for (const f of this.decorsAt(tx, ty)) {
      if (!f.def.flat) continue;
      const s = A.sprites[f.def.sprite];
      x.drawImage(s.img, Math.round(f.x - s.ax), Math.round(f.y - s.ay));
    }
    const w = this.windowAt.get(ty * this.w + tx);
    if (w && def.wall) { const s = A.sprites.window; x.drawImage(s.img, w.x - s.ax, w.y - s.ay); }
  }

  // ---------- runtime modification (fire, destruction, rebuilding) ----------
  decorKey(d) { return d.type + '@' + d.tx + ',' + d.ty; }

  footprint(d) {
    const out = [];
    const fw = d.def.fw || 1, fh = d.def.flat ? 1 : d.def.fh || 1;
    for (let y = d.ty - fh + 1; y <= d.ty; y++) for (let x = d.tx; x < d.tx + fw; x++) if (this.inBounds(x, y)) out.push(y * this.w + x);
    return out;
  }

  buildDecorIndex() {
    this.decorAt = new Map();
    for (const d of this.decor.concat(this.flats)) for (const i of this.footprint(d)) {
      if (!this.decorAt.has(i)) this.decorAt.set(i, []);
      if (!this.decorAt.get(i).includes(d)) this.decorAt.get(i).push(d);
    }
    this.chestAt = new Set(this.chests.map((c) => c.ty * this.w + c.tx));
  }

  decorsAt(tx, ty) { return (this.decorAt && this.decorAt.get(ty * this.w + tx)) || []; }

  recomputeSolid(tx, ty) {
    const i = ty * this.w + tx;
    let s = !!G.TILES[this.ground[i]].solid || this.chestAt.has(i);
    if (!s) for (const d of this.decorsAt(tx, ty)) if (d.def.solid) { s = true; break; }
    this.solid[i] = s ? 1 : 0;
  }

  redrawTile(tx, ty) {
    if (!this.inBounds(tx, ty) || !this.groundCtx) return;
    if (this.groundCanvas.each) this.groundCanvas.each(tx * 16 - 16, ty * 16 - 16, 48, 48, (q) => this.drawTileInto(q, tx, ty, true)); else this.drawTileInto(this.groundCtx, tx, ty, true);
    if (this.minimap) {
      const mc = this.minimap.getContext('2d');
      mc.fillStyle = G.TILES[this.ground[ty * this.w + tx]].mini;
      mc.fillRect(tx, ty, 1, 1);
    }
  }

  setTileRuntime(tx, ty, t) {
    if (!this.inBounds(tx, ty)) return;
    this.ground[ty * this.w + tx] = t;
    // flat decorations (flowers, grass tufts) do not survive a tile change
    for (const d of this.decorsAt(tx, ty).slice()) if (d.def.flat) this.removeDecorRuntime(d, false);
    this.recomputeSolid(tx, ty);
    this.redrawTile(tx, ty);
    if (ty + 1 < this.h) this.redrawTile(tx, ty + 1);
  }

  removeDecorRuntime(d, redraw = true) {
    if (d.def.flat) this.flats = this.flats.filter((x) => x !== d);
    else this.decor = this.decor.filter((x) => x !== d);
    for (const i of this.footprint(d)) {
      const l = this.decorAt.get(i);
      if (l) this.decorAt.set(i, l.filter((x) => x !== d));
      this.recomputeSolid(i % this.w, Math.floor(i / this.w));
      if (d.def.flat && redraw) this.redrawTile(i % this.w, Math.floor(i / this.w));
    }
    if (d.light) this.lights = this.lights.filter((l) => l !== d.light);
    d.removed = true;
  }

  addDecorRuntime(type, tx, ty) {
    const d = this.addDecor(type, tx, ty);
    if (!d.def.flat) this.decor.sort((a, b) => a.y - b.y);
    for (const i of this.footprint(d)) {
      if (!this.decorAt.has(i)) this.decorAt.set(i, []);
      if (!this.decorAt.get(i).includes(d)) this.decorAt.get(i).push(d);
      this.recomputeSolid(i % this.w, Math.floor(i / this.w));
    }
    return d;
  }

  // Apply the saved modifications of the current world (see World.modsFor).
  applyMods(mods) {
    for (const i in mods.tiles) this.setTileRuntime(i % this.w, Math.floor(i / this.w), mods.tiles[i][0]);
    const byKey = new Map(this.decor.concat(this.flats).map((d) => [this.decorKey(d), d]));
    for (const k in mods.removed) {
      if (k.startsWith('chest@')) {
        const [tx, ty] = k.slice(6).split(',').map(Number);
        this.chestAt.delete(ty * this.w + tx);
        this.recomputeSolid(tx, ty);
        continue;
      }
      const d = byKey.get(k);
      if (d) this.removeDecorRuntime(d);
    }
    for (const k in mods.added) { const [type, tx, ty] = mods.added[k]; this.addDecorRuntime(type, tx, ty); }
    for (const id in mods.buildings) {
      const b = this.building(id);
      if (b) b[mods.buildings[id].state] = true;
    }
    this.renderMinimap();
  }

  buildingAtTile(tx, ty) {
    for (const b of this.buildings) if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b;
    return null;
  }

  renderRoof(b) {
    const cols = G.ROOF_COLORS[b.roof] || G.ROOF_COLORS.red;
    const W = b.w * 16 + 4, H = (b.h - 1) * 16 + 8;
    const { c, x } = G.assets.mk(W, H);
    const rng = new G.RNG(b.id);
    if (b.roof.startsWith('flat')) {
      x.fillStyle = cols[1];
      x.fillRect(0, 0, W, H);
      for (let i = 0; i < W * H / 10; i++) { x.fillStyle = rng.chance(0.5) ? cols[0] : cols[2]; x.fillRect(rng.int(0, W - 1), rng.int(0, H - 1), 1, 1); }
      x.fillStyle = cols[2];
      x.fillRect(0, 0, W, 3); x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H); x.fillRect(0, H - 5, W, 2);
      x.fillStyle = G.assets.shade(cols[0], 1.15);
      x.fillRect(0, 0, W, 1);
      for (let n = 0; n < Math.max(1, Math.floor(b.w * b.h / 40)); n++) {
        const ax = rng.int(6, Math.max(6, W - 18)), ay = rng.int(6, Math.max(6, H - 18));
        x.fillStyle = '#b8b8c0'; x.fillRect(ax, ay, 10, 8);
        x.fillStyle = '#8a8a92'; x.fillRect(ax, ay + 6, 10, 2);
        x.fillStyle = '#4a4a52'; x.beginPath(); x.arc(ax + 5, ay + 3.5, 2.5, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(0, H - 3, W, 3);
      return c;
    }
    x.fillStyle = cols[1];
    x.fillRect(0, 0, W, H);
    for (let row = 0; row * 4 < H; row++) {
      const off = row % 2 ? 3 : 0;
      for (let px = -off; px < W; px += 6) {
        x.fillStyle = rng.chance(0.15) ? cols[2] : cols[0];
        x.fillRect(px + 1, row * 4, 5, 2);
        x.fillStyle = cols[2];
        x.fillRect(px, row * 4 + 3, 6, 1);
      }
    }
    // ridge
    const ry = Math.floor(H / 2) - 2;
    x.fillStyle = G.assets.shade(cols[0], 1.2);
    x.fillRect(2, ry, W - 4, 2);
    x.fillStyle = cols[2];
    x.fillRect(2, ry + 2, W - 4, 1);
    // border + eaves
    x.fillStyle = cols[2];
    x.fillRect(0, 0, W, 1); x.fillRect(0, 0, 1, H); x.fillRect(W - 1, 0, 1, H);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(0, H - 3, W, 3);
    if (b.chimney) {
      const cx = W - 18;
      x.fillStyle = '#6a6660'; x.fillRect(cx, 2, 7, 10);
      x.fillStyle = '#86827a'; x.fillRect(cx, 2, 7, 2);
      x.fillStyle = '#2a2826'; x.fillRect(cx + 1, 2, 5, 1);
    }
    return c;
  }

  renderMinimap() {
    const { c, x } = G.assets.mk(this.w, this.h);
    const img = x.createImageData(this.w, this.h);
    const cache = {};
    const rgb = (hex) => cache[hex] || (cache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
    for (let i = 0; i < this.ground.length; i++) {
      const [r, g, b] = rgb(G.TILES[this.ground[i]].mini);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    for (const d of this.decor) {
      if (!d.def.solid || !this.inBounds(d.tx, d.ty)) continue;
      const i = d.ty * this.w + d.tx;
      const tree = /oak|pine|dead/.test(d.type);
      const [r, g, b] = tree ? [30, 70, 34] : [90, 80, 70];
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    }
    x.putImageData(img, 0, 0);
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      x.fillStyle = (G.ROOF_COLORS[b.roof] || G.ROOF_COLORS.red)[0];
      x.fillRect(b.x, b.y, b.w, b.h);
    }
    this.minimap = c;
  }

  // ---------- queries ----------
  isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.solid[ty * this.w + tx] === 1;
  }

  // swim: the player may enter open water (see Player swimming); everything else treats it as solid
  rectCollides(x, y, w, h, swim = false) {
    const x0 = Math.floor(x / 16), x1 = Math.floor((x + w - 0.01) / 16);
    const y0 = Math.floor(y / 16), y1 = Math.floor((y + h - 0.01) / 16);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!this.isSolidTile(tx, ty)) continue;
      if (swim && this.isSwimmable(tx, ty)) continue;
      return true;
    }
    return false;
  }
  // open water (no boat or pier decor on it)
  isSwimmable(tx, ty) { return this.inBounds(tx, ty) && !!this.swimmable && this.swimmable[ty * this.w + tx] === 1; }
  isWaterAt(px, py) { return this.isSwimmable(Math.floor(px / 16), Math.floor(py / 16)); }

  // Building whose interior contains the world-pixel point
  buildingAt(px, py) {
    const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
    for (const b of this.buildings) {
      if (tx > b.x && tx < b.x + b.w - 1 && ty > b.y && ty < b.y + b.h - 1) return b;
    }
    return null;
  }

  building(id) { return this.buildings.find((b) => b.id === id); }

  // Random walkable tile within radius of (tx,ty)
  randomWalkableNear(tx, ty, radius, rng = G.rng, sameBuilding = true) {
    const home = this.buildingAt(tx * 16 + 8, ty * 16 + 8);
    for (let i = 0; i < 20; i++) {
      const x = tx + rng.int(-radius, radius), y = ty + rng.int(-radius, radius);
      if (this.isSolidTile(x, y)) continue;
      if (sameBuilding && this.buildingAt(x * 16 + 8, y * 16 + 8) !== home) continue;
      return { x, y };
    }
    return { x: tx, y: ty };
  }

  // ---------- drawing ----------
  drawGround(ctx, view, time) {
    const sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y));
    const sw = Math.min(this.pw - sx, Math.ceil(view.w)), sh = Math.min(this.ph - sy, Math.ceil(view.h));
    if (sw > 0 && sh > 0) { if (this.groundCanvas.draw) this.groundCanvas.draw(ctx, sx, sy, sw, sh); else ctx.drawImage(this.groundCanvas, sx, sy, sw, sh, sx, sy, sw, sh); }
    // animated water
    const frame = Math.floor(time * 2.5) % 4;
    const tx0 = Math.max(0, Math.floor(view.x / 16)), ty0 = Math.max(0, Math.floor(view.y / 16));
    const tx1 = Math.min(this.w - 1, Math.floor((view.x + view.w) / 16)), ty1 = Math.min(this.h - 1, Math.floor((view.y + view.h) / 16));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const def = G.TILES[this.ground[ty * this.w + tx]];
        if (!def.anim) continue;
        ctx.drawImage(G.assets.tiles[def.tex][frame], tx * 16, ty * 16);
        if (ty > 0 && !G.TILES[this.ground[(ty - 1) * this.w + tx]].water) {
          ctx.fillStyle = 'rgba(220,240,255,0.55)';
          ctx.fillRect(tx * 16, ty * 16, 16, 1 + ((frame + tx) % 2));
        }
      }
    }
  }

  drawWindowsLit(ctx, view) {
    const s = G.assets.sprites.window_lit;
    for (const b of this.buildings) {
      if (!b.lit || b.destroyed || b.gutted) continue;
      for (const w of b.windows) if (G.TILES[this.ground[Math.floor(w.y / 16) * this.w + Math.floor(w.x / 16)]].wall) ctx.drawImage(s.img, w.x - s.ax, w.y - s.ay);
    }
  }

  updateRoofs(dt, playerBuilding) {
    for (const b of this.buildings) {
      const target = b === playerBuilding ? 0 : 1;
      b.roofAlpha = G.util.approach(b.roofAlpha, target, dt * 4);
    }
  }

  drawRoofs(ctx, view) {
    for (const b of this.buildings) {
      if (b.roofAlpha <= 0.01 || b.destroyed) continue;
      const rx = b.x * 16 - 2, ry = b.y * 16 - 8;
      if (!b.roofCanvas) b.roofCanvas = this.renderRoof(b);
      if (rx > view.x + view.w || ry > view.y + view.h || rx + b.roofCanvas.width < view.x || ry + b.roofCanvas.height < view.y) continue;
      ctx.globalAlpha = b.roofAlpha;
      ctx.drawImage(b.roofCanvas, rx, ry);
    }
    ctx.globalAlpha = 1;
  }
}

G.TileMap = TileMap;
