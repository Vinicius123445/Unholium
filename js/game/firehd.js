'use strict';
// Fire, redone:
//   Flames: every burning tile has a handful of flame tongues drawn row by row: a white-yellow core, an
//     orange body and dark red tips, each tongue flickering, swaying, growing and shrinking on its own and
//     leaning with the wind. They spill past the tile edges at random, so a fire has a ragged outline.
//     What burns matters: grass burns low and fast and wide, trees burn high in the crown, fences in a
//     thin line along the rails, buildings and roofs tall with dark smoke, floors and furniture in the middle.
//   Smoke: soft puffs that grow, rise and drift downwind; darker and denser the bigger the fire.
//   Embers and sparks: glowing bits riding the heat, the odd spark shooting up.
//   Burned ground: scorch is painted as a smooth field across tiles with a noisy edge (no squares):
//     charred black at the heart, burnt soil, then scorched and lightly singed grass toward the edge, with
//     ash flecks and charred stalks. It is part of the ground, so it stays after the fire is out.
(() => {
const fract = (v) => v - Math.floor(v), h2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
function vn(x, y, sc, s) { const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy); let fx = gx - x0, fy = gy - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = h2(x0, y0, s), b = h2(x0 + 1, y0, s), c = h2(x0, y0 + 1, s), d = h2(x0 + 1, y0 + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
const MAT = {   // tongues, height (px), spread, smoke darkness
  grass: { n: 5, h: 7, w: 2, spread: 5, smoke: 0.35 },
  tree: { n: 6, h: 16, w: 3, spread: 6, smoke: 0.55, lift: 14 },
  fence: { n: 4, h: 9, w: 2, spread: 2, smoke: 0.45 },
  building: { n: 6, h: 18, w: 3, spread: 4, smoke: 0.8 },
  floor: { n: 5, h: 11, w: 3, spread: 4, smoke: 0.6 },
};
function material(fs, i) {
  if (fs._mat && fs._mat.has(i)) return fs._mat.get(i);
  const map = fs.map, tx = i % map.w, ty = Math.floor(i / map.w), def = G.TILES[map.get(tx, ty)] || {};
  let m = 'floor';
  const d = map.decorsAt(tx, ty).find((x) => /oak|pine|palm|tree|bush/.test(x.type));
  if (d) m = 'tree';
  else if (/fence|hedge/.test(def.name || '')) m = 'fence';
  else if (def.wall || map.buildingAtTile(tx, ty)) m = 'building';
  else if (/grass|wheat|field|cabbage/.test(def.name || '')) m = 'grass';
  (fs._mat = fs._mat || new Map()).set(i, m);
  return m;
}
const CORE = ['#fff6d0', '#ffe066', '#ffc23a', '#ff9a2a', '#f06a1e', '#c83a14', '#7a1e0e'];

// A flame is rows of pixels. Drawn row by row that is one call per row, per tongue, per tile, per frame: thousands, and a big fire stalled the frame.
// Each shape is now painted once into a sheet and stamped from it: same rows, same colours, same flicker, a call per tongue.
const TAU = Math.PI * 2, PAGE_W = 256, PAGE_H = 260, CELL_W = 32, CELL_H = 52, PHASES = 20, ACROSS = 8, PER_PAGE = 40, MOST_PAGES = 96;   // (small pages: a new shape sends one page to the graphics card, not everything)
let pages = [], slots = new Map(), nextSlot = 0;
const tongue = (ctx, rows, w0, phase, wind, odd, bx, by) => {
  const w = Math.round(w0 * 3) / 3, ph = Math.floor(phase / TAU * PHASES) % PHASES, wi = Math.round(wind * 5) / 5, n = Math.min(rows, CELL_H - 2), key = n + Math.round(w * 3) * 64 + ph * 16384 + (odd ? 524288 : 0) + (Math.round(wi * 5) + 512) * 1048576;
  let s = slots.get(key);
  if (s === undefined) {
    if (nextSlot >= PER_PAGE * MOST_PAGES) { pages = []; slots = new Map(); nextSlot = 0; }   // (all the shapes a fire can take rarely fit: start again)
    s = nextSlot++; slots.set(key, s);
    if (s % PER_PAGE === 0) { const c = document.createElement('canvas'); c.width = PAGE_W; c.height = PAGE_H; pages.push(c); }
    const sx = pages[Math.floor(s / PER_PAGE)].getContext('2d'), i = s % PER_PAGE, X = (i % ACROSS) * CELL_W, Y = Math.floor(i / ACROSS) * CELL_H, cx = X + CELL_W / 2, base = Y + CELL_H - 1, a = (ph + 0.5) / PHASES * TAU;
    for (let r = 0; r < n; r++) {
      const t = r / n, ww = Math.max(0.6, w * (1 - t * 0.85) + (t < 0.2 ? 0.6 : 0)), sway = Math.sin(a + r * 0.45) * t * 1.8 + wi * t * 4;
      sx.fillStyle = CORE[Math.min(CORE.length - 1, Math.floor(t * (CORE.length - 0.5) + (odd ? 0.6 : 0)))];
      sx.fillRect(Math.max(X, Math.min(X + CELL_W - 1, Math.round(cx - ww / 2 + sway))), base - r, Math.min(CELL_W - 1, Math.max(1, Math.round(ww))), 1);
    }
  }
  const i = s % PER_PAGE;
  ctx.drawImage(pages[Math.floor(s / PER_PAGE)], (i % ACROSS) * CELL_W, Math.floor(i / ACROSS) * CELL_H, CELL_W, CELL_H, Math.round(bx) - CELL_W / 2, Math.round(by) - CELL_H + 1, CELL_W, CELL_H);
};
const discs = new Map();
G.fireHD = {
  embers: [], puffs: [],
  // a soft puff of smoke: a ready disc of its grey, scaled and faded
  disc(g) { let d = discs.get(g); if (!d) { d = document.createElement('canvas'); d.width = d.height = 64; const x = d.getContext('2d'); x.fillStyle = `rgb(${g},${g - 2},${g - 4})`; x.beginPath(); x.arc(32, 32, 32, 0, TAU); x.fill(); discs.set(g, d); } return d; },
  draw(ctx, fs, view, time) {
    const W = fs.map.w, wind = G.breeze ? G.breeze.dx : 0.3, big = fs.cells.size, dt = Math.max(0, Math.min(0.1, time - (this._t || time))); this._t = time;
    this._dt = dt;
    // flames (unless the renderer already drew them in depth order with everyone else: drawCell)
    if (!fs._sorted) for (const [i, c] of fs.cells) {
      const tx = i % W, ty = Math.floor(i / W), x0 = tx * 16, y0 = ty * 16;
      if (x0 < view.x - 32 || y0 < view.y - 48 || x0 > view.x + view.w + 16 || y0 > view.y + view.h + 16) continue;
      this.drawCell(ctx, fs, i, c, time);
    }
    fs._sorted = false;
    this.drawParticles(ctx, dt, wind);
  },
  // one burning tile: its flame tongues, and the embers and smoke it gives off
  drawCell(ctx, fs, i, c, time) {
    const W = fs.map.w, wind = G.breeze ? G.breeze.dx : 0.3, big = fs.cells.size, dt = this._dt || 0.016;
    const tx = i % W, ty = Math.floor(i / W), x0 = tx * 16, y0 = ty * 16;
    {
      const m = MAT[material(fs, i)], heat = 0.35 + c.heat * 0.65, fuel = Math.min(1, (c.fuel || 1) / 6);
      const n = Math.max(1, Math.round(m.n * heat * Math.min(1, 90 / big)));   // big fires: fewer tongues per tile, same look from afar
      for (let k = 0; k < n; k++) {
        const s = h2(tx, ty, k + 1), s2 = h2(tx, ty, k + 11);
        const bx = x0 + 8 + (s - 0.5) * (16 + m.spread * 2), by = y0 + 13 + (s2 - 0.5) * 6 - (m.lift || 0) * (0.6 + s2 * 0.4);
        const ph = s * 20, f = 6 + s2 * 6;
        const H = m.h * heat * (0.55 + 0.45 * fuel) * (0.75 + 0.25 * Math.sin(time * f + ph) + 0.15 * Math.sin(time * f * 2.3 + ph * 1.7));
        const w0 = m.w * (0.8 + s * 0.6) * (0.85 + 0.15 * Math.sin(time * 9 + ph));
        tongue(ctx, Math.max(2, Math.round(H)), w0, ((time * 4 + ph) % TAU + TAU) % TAU, wind, k % 2, bx, by);
        // the white-hot base
        if (heat > 0.6) { ctx.fillStyle = 'rgba(255,250,220,0.85)'; ctx.fillRect(Math.round(bx - 1), Math.round(by), 2, 1); }
      }
      // embers and sparks ride the heat
      if (Math.random() < dt * (2 + heat * 4) * (big > 15 ? 1.6 : 1)) this.embers.push({ x: x0 + 4 + Math.random() * 8, y: y0 + 8 - (m.lift || 0), vx: (Math.random() - 0.5) * 8, vy: -14 - Math.random() * 18, t: 0, life: 1.2 + Math.random() * 1.5, spark: Math.random() < 0.12 });
      // smoke: more and darker for bigger, hotter fires
      if (Math.random() < dt * (1.2 + heat * 2) * (big > 15 ? 2 : 1)) this.puffs.push({ x: x0 + 8 + (Math.random() - 0.5) * 10, y: y0 + 2 - (m.lift || 0) - m.h * heat * 0.6, r: 2 + Math.random() * 2, t: 0, life: 2.5 + Math.random() * 2, dark: Math.min(0.9, m.smoke + big * 0.01) });
    }
    void wind;
  },
  drawParticles(ctx, dt, wind) {
    // embers
    for (const e of this.embers) {
      e.t += dt; e.x += (e.vx + wind * 14) * dt; e.y += e.vy * dt; e.vy *= 1 - dt * 0.3; e.vx += Math.sin(e.t * 6) * dt * 10;
      const a = 1 - e.t / e.life;
      if (e.spark) { ctx.fillStyle = `rgba(255,240,180,${a.toFixed(2)})`; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 2); }
      else { ctx.fillStyle = `rgba(255,${120 + Math.round(80 * Math.sin(e.t * 20) ** 2)},40,${a.toFixed(2)})`; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); }
    }
    this.embers = this.embers.filter((e) => e.t < e.life).slice(-220);
    // smoke (only what is on screen is drawn; all of it keeps moving)
    const V = G.renderer.viewRect ? G.renderer.viewRect() : { x: G.renderer.cam.x, y: G.renderer.cam.y, w: G.renderer.viewW, h: G.renderer.viewH }, was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    for (const p of this.puffs) {
      p.t += dt; p.y -= (8 + p.t * 3) * dt; p.x += (wind * 10 + Math.sin(p.t + p.r) * 2) * dt; p.r += dt * 2.2;
      const a = Math.min(1, p.t * 1.5) * (1 - p.t / p.life) * 0.3;   // soft, see-through puffs (no dark blobs)
      const g = Math.round(150 - p.dark * 65);
      if (p.x + p.r < V.x || p.x - p.r > V.x + V.w || p.y + p.r < V.y || p.y - p.r > V.y + V.h) continue;
      const d = G.fireHD.disc(g), q = Math.max(0.5, p.r); ctx.globalAlpha = a; ctx.drawImage(d, p.x - q, p.y - q, q * 2, q * 2);
    }
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = was;
    this.puffs = this.puffs.filter((p) => p.t < p.life).slice(-260);
  },

  // ---------------------------------------------------------------- scorched ground
  burnt(def) { return def && /burnt|ash|ruin|rubble|field_burnt/.test(def.name); },
  scorch(map, tx0, ty0, tx1, ty1) {
    if (!map.groundCtx) return;
    tx0 = Math.max(0, tx0); ty0 = Math.max(0, ty0); tx1 = Math.min(map.w - 1, tx1); ty1 = Math.min(map.h - 1, ty1);
    const px0 = tx0 * 16, py0 = ty0 * 16, w = (tx1 - tx0 + 1) * 16, h = (ty1 - ty0 + 1) * 16;
    const val = (tx, ty) => (map.inBounds(tx, ty) && this.burnt(G.TILES[map.get(tx, ty)]) ? 1 : 0);
    const gw = tx1 - tx0 + 7, grid = new Uint8Array(gw * (ty1 - ty0 + 7));
    for (let ty = ty0 - 3; ty <= ty1 + 3; ty++) for (let tx = tx0 - 3; tx <= tx1 + 3; tx++) grid[(ty - ty0 + 3) * gw + (tx - tx0 + 3)] = val(tx, ty);
    const vals = (tx, ty) => grid[(ty - ty0 + 3) * gw + (tx - tx0 + 3)] || 0;
    let any = false;
    for (let ty = ty0 - 1; ty <= ty1 + 1 && !any; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) if (val(tx, ty)) { any = true; break; }
    if (!any) return;
    // written to a scorch overlay (drawn over the ground), never read back from the big ground canvas
    if (!map.scorchCanvas || map.scorchCanvas.width !== map.w * 16) map.scorchCanvas = new G.PatchLayer(map.w * 16, map.h * 16);
    const img = new ImageData(w, h), d = img.data;
    const base = (X, Y, def) => { const c = G.assets.tile(def.tex, def.anim ? 0 : G.util.hash2(Math.floor(X / 16), Math.floor(Y / 16), 7)); if (!c) return null; let t = texC.get(c); if (!t) { t = c.getContext('2d').getImageData(0, 0, 16, 16).data; texC.set(c, t); } return t; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = px0 + x, Y = py0 + y, ttx = Math.floor(X / 16), tty = Math.floor(Y / 16);
      const def = G.TILES[map.get(ttx, tty)];
      if (!def || def.solid || def.water || def.wall || !(this.burnt(def) || /grass|dirt|path|field|wheat|cabbage|sand/.test(def.name))) continue;
      // a soft field over the burnt tiles around (a gaussian over tile centers), pushed in and out by
      // smooth noise: blobby, irregular edges that ignore the grid
      const wt = WT[(Y & 15) * 16 + (X & 15)];
      let f = 0;
      for (let k = 0; k < 25; k++) f += vals(ttx + (k % 5) - 2, tty + Math.floor(k / 5) - 2) * wt[k];
      f += (vn(X, Y, 11, 3) - 0.5) * 0.75 + (vn(X, Y, 4, 4) - 0.5) * 0.25 + (h2(X, Y, 6) - 0.5) * 0.08;
      const i = (y * w + x) * 4, bt = base(X, Y, def), o0 = ((Y % 16) * 16 + (X % 16)) * 4;
      let r = bt ? bt[o0] : 60, g = bt ? bt[o0 + 1] : 60, b = bt ? bt[o0 + 2] : 60;
      // where the field is weak over a burnt tile, the ground was only partly burnt: show what grew there
      if (this.burnt(def) && f < 0.55) { const t = origTex(map, ttx, tty); if (t) { const o = ((Y % 16) * 16 + (X % 16)) * 4; r = t[o]; g = t[o + 1]; b = t[o + 2]; } }
      if (f < 0.12) { if (this.burnt(def)) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } continue; }
      const cut = (vn(X, Y, 7, 9) - 0.5) * 0.4;   // a ragged heart, not a dark square
      if (f > 0.8 + cut) {   // charred: black-grey with ash flecks and the odd ember-red dot
        const k = h2(X, Y, 7); const v = k < 0.06 ? 120 : k < 0.08 ? -1 : 26 + k * 18;
        if (v < 0) { r = 110; g = 34; b = 18; } else { r = v; g = v * 0.95; b = v * 0.9; }
      } else if (f > 0.55 + cut * 0.5) { r = r * 0.32 + 28; g = g * 0.26 + 20; b = b * 0.22 + 14; if (h2(X, Y, 8) < 0.05) { r = 20; g = 18; b = 16; } }   // burnt soil, charred stalks
      else if (f > 0.33) { r = r * 0.62 + 34; g = g * 0.5 + 20; b = b * 0.4 + 8; }    // scorched: brown-yellow
      else { r = r * 0.86 + 22; g = g * 0.82 + 14; b = b * 0.75; }                   // lightly singed
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    map.scorchCanvas.put(img, px0, py0);
  },
  scorchAll(map) {
    const seen = new Set();
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      if (!this.burnt(G.TILES[map.get(tx, ty)])) continue;
      const bx = Math.floor(tx / 8), by = Math.floor(ty / 8), k = bx + ',' + by;
      if (seen.has(k)) continue; seen.add(k);
      this.scorch(map, bx * 8 - 1, by * 8 - 1, bx * 8 + 8, by * 8 + 8);
    }
  },
};

// (the flames are drawn by FireSystem.draw in js/game/fire.js, which calls G.fireHD.draw)
// scorch when the ground is drawn, and again around every tile that changes (fire burns it, it grows back)
const TM = G.TileMap.prototype, _pre = TM.prerender, _set = TM.setTileRuntime;
TM.prerender = function () { _pre.call(this); this.scorchCanvas = null; try { G.fireHD.scorchAll(this); } catch (e) { /* plain ground */ } };
TM.setTileRuntime = function (tx, ty, t) {
  const r = _set.call(this, tx, ty, t);
  (this._scorchQ = this._scorchQ || new Set()).add(ty * this.w + tx);   // re-scorched a few tiles per frame (below)
  return r;
};
const _dg = TM.drawGround;
TM.drawGround = function (ctx, view, time) {
  const q = this._scorchQ;
  if (q && q.size) {
    let n = 0;
    for (const i of q) {
      q.delete(i); const tx = i % this.w, ty = Math.floor(i / this.w);
      try { G.fireHD.scorch(this, tx - 2, ty - 2, tx + 2, ty + 2); } catch (e) { /* plain ground */ }
      if (++n >= 4) break;
    }
  }
  const r = _dg.call(this, ctx, view, time);
  if (this.scorchCanvas) { const sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y)), sw = Math.min(this.pw - sx, Math.ceil(view.w)), sh2 = Math.min(this.ph - sy, Math.ceil(view.h)); if (sw > 0 && sh2 > 0) this.scorchCanvas.draw(ctx, sx, sy, sw, sh2); }
  return r;
};
})();
// what a burnt tile was before (from the world's map changes), as texture pixels
const texC = new Map();
function origTex(map, tx, ty) {
  const m = G.world && G.world.mapMods && G.world.mapMods[map.id], rec = m && m.tiles[ty * map.w + tx];
  const def = G.TILES[rec ? rec[2] : G.T.grass] || G.TILES[G.T.grass];
  if (!def.tex || def.solid) return null;
  const c = G.assets.tile(def.tex, G.util.hash2(tx, ty, 7)); if (!c) return null;
  let d = texC.get(c); if (!d) { d = c.getContext('2d').getImageData(0, 0, 16, 16).data; texC.set(c, d); }
  return d;
}
// the gaussian weights of the 5x5 tiles around, for each pixel position inside a tile (computed once)
const WT = (() => { const out = []; for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) { const w = []; let s = 0; for (let k = 0; k < 25; k++) { const dx = (lx + 0.5) / 16 - 0.5 - ((k % 5) - 2), dy = (ly + 0.5) / 16 - 0.5 - (Math.floor(k / 5) - 2); const v = Math.exp(-(dx * dx + dy * dy) / 0.9); w.push(v); s += v; } out.push(w.map((v) => v / s)); } return out; })();
