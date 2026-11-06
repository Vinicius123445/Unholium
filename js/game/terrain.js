'use strict';
// Organic terrain: grass, dirt, sand and water meet the way they do outside, not along tile edges.
//   How: after a map's ground is prerendered (TileMap.prerender), every natural tile that touches a
//   different natural terrain gets its border pixels re-decided. A smooth noise field in world pixels
//   pushes the border in and out around the tile edge (up to ~6 px either way, so on average the visible
//   edge stays where collision is), and each pixel takes the texture of whichever terrain owns it there.
//   Because textures repeat every 16 px and the noise is continuous, borders flow across tiles with no
//   seams: beaches, riverbanks and meadow edges get irregular, natural contours.
//   Then: wet, darker sand along the waterline; foam that follows the new shoreline; large, slow
//   variations in tone (sun-bleached and lush patches of grass, damp and dry dirt) so no two areas
//   repeat; and small details scattered in clusters (pebbles, tufts, little flowers, shells).
//   Water is animated (redrawn every frame), so land that reaches into a water tile is kept as an
//   overlay drawn on top of the water (map.landOverlay), and the shoreline pixels for the foam are kept
//   per tile (map.shore).
// Pixel art stays pixel art: every pixel is a texture pixel or a shade of one; no blur, no smoothing.
// Roads, floors, walls, crops and man-made edges keep their straight lines. Collision is untouched.
(() => {
// terrain classes: a border forms between different classes; deep and shallow water count as one
const CLASS = { water: 1, deepwater: 1, sand: 2, darksand: 3, dirt: 4, path: 5, grass: 6, darkgrass: 7, asphalt: 8, road_line: 8, road_line_v: 8, sidewalk: 9, concrete: 10, lot: 11, plaza: 12, cobble: 13 };
const PRIO = { 1: 0, 2: 1, 3: 1.5, 4: 2, 5: 2.2, 6: 3, 7: 4, 8: 2.6, 9: 2.8, 10: 2.7, 11: 2.5, 12: 2.9, 13: 2.75 };
const BUILT = (c) => c >= 8;   // made surfaces: where two meet the edge only wears a little; where they meet the ground it is broken and grown over
const AMP = 6;   // how far a border wanders, in pixels

const fract = (v) => v - Math.floor(v);
const h2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
// smooth value noise in [0,1]
// (neighbouring pixels share a noise cell, and the four corners of a cell never change: they are worked out once per cell, not once per pixel)
const CELLS = [];
function vn(x, y, scale, s) {
  const gx = x / scale, gy = y / scale, x0 = Math.floor(gx), y0 = Math.floor(gy);
  let fx = gx - x0, fy = gy - y0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const q = CELLS[s] || (CELLS[s] = { x0: NaN, y0: 0, scale: 0, a: 0, b: 0, c: 0, d: 0 });
  if (q.x0 !== x0 || q.y0 !== y0 || q.scale !== scale) { q.x0 = x0; q.y0 = y0; q.scale = scale; q.a = h2(x0, y0, s); q.b = h2(x0 + 1, y0, s); q.c = h2(x0, y0 + 1, s); q.d = h2(x0 + 1, y0 + 1, s); }
  const { a, b, c, d } = q;
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// how far the border is pushed toward the lower-priority side at this world pixel (negative: the other way)
const offset = (X, Y) => AMP * ((vn(X, Y, 9, 1) - 0.5) * 1.7 + (vn(X, Y, 3.5, 2) - 0.5) * 0.6);

const texCache = new Map();
function texData(canvas) {
  let d = texCache.get(canvas);
  if (!d) { d = canvas.getContext('2d').getImageData(0, 0, 16, 16).data; texCache.set(canvas, d); }
  return d;
}

G.terrain = {
  CLASS,
  classAt(map, tx, ty) {
    if (!map.inBounds(tx, ty)) return 0;
    const def = G.TILES[map.ground[ty * map.w + tx]];
    return (def && !def.over && CLASS[def.name]) || 0;
  },
  // a tile with flat decor or a window drawn into the ground is left alone
  busy(map, tx, ty) {
    if (map.windowAt && map.windowAt.get(ty * map.w + tx)) return true;
    for (const f of map.decorsAt(tx, ty)) if (f.def.flat) return true;
    return false;
  },
  // the whole map, or one square of it with a border of its neighbours (R: js/game/groundchunks.js); the same pixels either way
  blend(map, R) {
    const tx0 = R ? R.x0 : 0, ty0 = R ? R.y0 : 0, tx1 = R ? R.x1 : map.w - 1, ty1 = R ? R.y1 : map.h - 1, ox = tx0 * 16, oy = ty0 * 16, W = (tx1 - tx0 + 1) * 16, H = (ty1 - ty0 + 1) * 16, ctx = R ? R.ctx : map.groundCtx;
    if (!ctx) return;
    const inner = (tx, ty) => !R || (tx >= R.ix0 && tx <= R.ix1 && ty >= R.iy0 && ty <= R.iy1);
    const img = ctx.getImageData(0, 0, W, H), D = img.data;
    const cls = new Uint8Array(W * H);   // final class of every pixel (0: not natural)
    let tileCls = R && map._tc;
    if (!tileCls) { tileCls = new Uint8Array(map.w * map.h); for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) tileCls[ty * map.w + tx] = this.classAt(map, tx, ty); }
    const texOf = (tx, ty) => {
      const def = G.TILES[map.ground[ty * map.w + tx]];
      return texData(G.assets.tile(def.tex, def.anim ? 0 : G.util.hash2(tx, ty, 7)));
    };
    if (!R) { map.landOverlay = new Map(); map.shore = new Map(); }
    // 1) borders
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const a = tileCls[ty * map.w + tx];
      if (!a) continue;
      const busy = this.busy(map, tx, ty);
      const nb = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const b = tileCls[ny * map.w + nx];
        if (b && b !== a) nb.push({ dx, dy, b, up: PRIO[b] > PRIO[a], tex: texOf(nx, ny) });
      }
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const X = tx * 16 + px, Y = ty * 16 + py, i = (Y - oy) * W + X - ox;
        cls[i] = a;
        if (!nb.length || busy) continue;
        const o = offset(X, Y);
        let best = null, bd = 99;
        for (const n of nb) {
          const ex = n.dx < 0 ? px + 0.5 : n.dx > 0 ? 16 - (px + 0.5) : 0, ey = n.dy < 0 ? py + 0.5 : n.dy > 0 ? 16 - (py + 0.5) : 0;
          const d = n.dx && n.dy ? Math.hypot(ex, ey) : ex || ey;
          if (BUILT(a) && BUILT(n.b)) continue;   // a kerb is a straight line: only nature has a ragged edge
          const reach = n.up ? o : -o;   // the higher side reaches in where the offset is positive, the lower side where it is negative
          if (d < reach && d < bd) { bd = d; best = n; }
        }
        if (!best) continue;
        const s = (py * 16 + px) * 4, t = best.tex;
        D[i * 4] = t[s]; D[i * 4 + 1] = t[s + 1]; D[i * 4 + 2] = t[s + 2];
        cls[i] = best.b;
      }
    }
    // 2) tone: large slow patches (lush and dry grass, damp and dry dirt and sand), computed per 4x4 block
    for (let by = oy; by < oy + H; by += 4) for (let bx = ox; bx < ox + W; bx += 4) {
      const c0 = cls[(by - oy) * W + bx - ox];
      if (!c0 || c0 === 1) continue;
      const bright = 1 + (vn(bx, by, 110, 3) - 0.5) * 0.14 + (vn(bx, by, 27, 4) - 0.5) * 0.07;
      const dry = Math.max(0, vn(bx, by, 150, 5) - 0.58) * 2.4;
      for (let yy = by; yy < by + 4 && yy < oy + H; yy++) for (let xx = bx; xx < bx + 4 && xx < ox + W; xx++) {
        const i = (yy - oy) * W + xx - ox, c = cls[i];
        if (!c || c === 1) continue;
        const k = i * 4;
        let r = D[k] * bright, g = D[k + 1] * bright, b = D[k + 2] * bright;
        if (c === 6 || c === 7) { r += dry * 22; g += dry * 6; b -= dry * 4; }   // sun-bleached grass
        else if (BUILT(c)) { const st = dry * 10; r -= st; g -= st; b -= st; }   // old stains on made ground
        else if (c === 4 || c === 5) { r -= dry * 6; g -= dry * 6; b -= dry * 4; }
        D[k] = r; D[k + 1] = g; D[k + 2] = b;
      }
    }
    // 3) the waterline: wet sand (and wet earth) near the water, and the shore pixels for the foam
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      // only tiles where water and land meet (somewhere in the 3x3 around)
      let wet = false, dry = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = map.inBounds(tx + dx, ty + dy) ? tileCls[(ty + dy) * map.w + tx + dx] : 0; if (c === 1) wet = true; else if (c) dry = true; }
      if (!wet || !dry || !tileCls[ty * map.w + tx] || !inner(tx, ty)) continue;
      const shore = [];
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const X = tx * 16 + px, Y = ty * 16 + py, i = (Y - oy) * W + X - ox, c = cls[i];
        if (!c) continue;
        let dist = 9;
        for (let r = 1; r <= 3 && dist === 9; r++) for (let oy = -r; oy <= r && dist === 9; oy++) for (let ox = -r; ox <= r; ox++) {
          const xx = X + ox, yy = Y + oy;
          if (xx < ox || yy < oy || xx >= ox + W || yy >= oy + H) continue;
          if ((cls[(yy - oy) * W + xx - ox] === 1) !== (c === 1)) { dist = r; break; }
        }
        if (dist > 3) continue;
        const k = i * 4;
        if (c === 1) { if (dist === 1) shore.push(px, py); }
        else { const f = dist === 1 ? 0.74 : dist === 2 ? 0.84 : 0.93; D[k] *= f; D[k + 1] *= f; D[k + 2] = D[k + 2] * f + 6; }
      }
      if (shore.length) map.shore.set(ty * map.w + tx, shore);
    }
    // 4) details in clusters: pebbles on dirt and sand, tufts and little flowers in the grass, shells on the beach
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const a = tileCls[ty * map.w + tx];
      if (!a || a === 1 || this.busy(map, tx, ty)) continue;
      for (let n = 0; n < 3; n++) {
        const X = tx * 16 + Math.floor(h2(tx, ty, 11 + n) * 14) + 1, Y = ty * 16 + Math.floor(h2(tx, ty, 21 + n) * 14) + 1, i = (Y - oy) * W + X - ox, c = cls[i];
        if (!c || c === 1) continue;
        const cluster = vn(X, Y, 40, 6 + c);
        if (h2(X, Y, 31) > cluster * 0.55) continue;
        const put = (dx, dy, col) => { const j = ((Y + dy - oy) * W + X + dx - ox) * 4; if (X + dx >= ox && Y + dy >= oy && X + dx < ox + W && Y + dy < oy + H) { D[j] = col[0]; D[j + 1] = col[1]; D[j + 2] = col[2]; } };
        const k = i * 4, base = [D[k], D[k + 1], D[k + 2]];
        if (c === 6 || c === 7) {   // grass: a taller tuft, sometimes a dry seed head; no bright flowers
          const lite = [base[0] * 1.25, base[1] * 1.22, base[2] * 1.1], dark = [base[0] * 0.7, base[1] * 0.72, base[2] * 0.7];
          put(0, 0, lite); put(0, -1, lite); put(1, 0, lite); put(0, 1, dark);
          if (h2(X, Y, 41) < 0.25) put(0, -2, [[150, 142, 112], [128, 116, 80], [112, 100, 72], [96, 92, 70]][Math.floor(h2(X, Y, 42) * 4)]);
        } else if (c === 2 || c === 3) {   // beach: a pebble or a shell
          if (h2(X, Y, 43) < 0.35) { put(0, 0, [238, 230, 214]); put(1, 0, [220, 206, 184]); } else { put(0, 0, [150, 142, 130]); put(1, 0, [176, 168, 154]); put(0, 1, [110, 100, 86]); }
        } else {        // dirt and paths: small stones
          put(0, 0, [base[0] * 1.3, base[1] * 1.28, base[2] * 1.28]); put(1, 0, [base[0] * 1.12, base[1] * 1.1, base[2] * 1.1]); put(0, 1, [base[0] * 0.65, base[1] * 0.62, base[2] * 0.6]);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // 4b) shallow and deep water flow into each other too: those tiles get four pre-mixed animation frames
    if (!R) map.waterMix = new Map();
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!inner(tx, ty)) continue;
      const def = G.TILES[map.ground[ty * map.w + tx]];
      if (!def.anim || def.name === 'pool') continue;
      const nb = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !map.inBounds(tx + dx, ty + dy)) continue;
        const n = G.TILES[map.ground[(ty + dy) * map.w + tx + dx]];
        if (n.anim && n.tex !== def.tex && n.name !== 'pool') nb.push({ dx, dy, tex: n.tex, up: n.name === 'water' });
      }
      if (!nb.length) continue;
      const mask = new Array(256).fill(null);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const o = offset(tx * 16 + px + 500, ty * 16 + py + 500) * 1.3;
        let bd = 99;
        for (const n of nb) {
          const ex = n.dx < 0 ? px + 0.5 : n.dx > 0 ? 16 - (px + 0.5) : 0, ey = n.dy < 0 ? py + 0.5 : n.dy > 0 ? 16 - (py + 0.5) : 0;
          const d = n.dx && n.dy ? Math.hypot(ex, ey) : ex || ey;
          if (d < (n.up ? o : -o) && d < bd) { bd = d; mask[py * 16 + px] = n.tex; }
        }
      }
      if (!mask.some(Boolean)) continue;
      const frames = [0, 1, 2, 3].map((f) => {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        // (the tile's pixels are already at hand: no drawing it and reading it back, four times for every tile along the water)
        const x = c.getContext('2d'), im = x.createImageData(16, 16); im.data.set(texData(G.assets.tiles[def.tex][f]));
        for (let k = 0; k < 256; k++) if (mask[k]) { const src = texData(G.assets.tiles[mask[k]][f]); im.data[k * 4] = src[k * 4]; im.data[k * 4 + 1] = src[k * 4 + 1]; im.data[k * 4 + 2] = src[k * 4 + 2]; }
        x.putImageData(im, 0, 0);
        return c;
      });
      map.waterMix.set(ty * map.w + tx, frames);
    }
    // 5) land reaching into animated water tiles: keep it as an overlay drawn over the water each frame
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tileCls[ty * map.w + tx] !== 1 || !inner(tx, ty)) continue;
      const def = G.TILES[map.ground[ty * map.w + tx]];
      if (!def.anim) continue;
      let any = false;
      const ov = new ImageData(16, 16);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const X = tx * 16 + px, Y = ty * 16 + py, i = (Y - oy) * W + X - ox;
        if (cls[i] === 1) continue;
        const k = i * 4, o = (py * 16 + px) * 4;
        ov.data[o] = D[k]; ov.data[o + 1] = D[k + 1]; ov.data[o + 2] = D[k + 2]; ov.data[o + 3] = 255; any = true;
      }
      if (!any) continue;
      const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').putImageData(ov, 0, 0);
      map.landOverlay.set(ty * map.w + tx, c);
    }
  },
};

const TM = G.TileMap.prototype, _pre = TM.prerender, _dg = TM.drawGround;
TM.prerender = function () {
  _pre.call(this);
  this.landOverlay = null; this.shore = null; this._needBlend = false;
  if (this.meta && (this.meta.indoor || this.meta.floorOf)) return;
  this._needBlend = true;   // done the first time the map is actually drawn (maps are prerendered at startup)
};
// animated water, then the land that reaches into it; the old straight top-edge line only where there is no organic shore
TM.drawGround = function (ctx, view, time) {
  if (this._needBlend) { this._needBlend = false; try { G.terrain.blend(this); } catch (e) { G.reportError && G.reportError(e); } }
  if (!this.landOverlay) return _dg.call(this, ctx, view, time);
  const sx = Math.max(0, Math.floor(view.x)), sy = Math.max(0, Math.floor(view.y));
  const sw = Math.min(this.pw - sx, Math.ceil(view.w)), sh = Math.min(this.ph - sy, Math.ceil(view.h));
  if (sw > 0 && sh > 0) { if (this.groundCanvas.draw) this.groundCanvas.draw(ctx, sx, sy, sw, sh); else ctx.drawImage(this.groundCanvas, sx, sy, sw, sh, sx, sy, sw, sh); }
  const frame = Math.floor(time * 2.5) % 4;
  const tx0 = Math.max(0, Math.floor(view.x / 16)), ty0 = Math.max(0, Math.floor(view.y / 16));
  const tx1 = Math.min(this.w - 1, Math.floor((view.x + view.w) / 16)), ty1 = Math.min(this.h - 1, Math.floor((view.y + view.h) / 16));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const def = G.TILES[this.ground[ty * this.w + tx]];
    if (!def.anim) continue;
    const mix = this.waterMix && this.waterMix.get(ty * this.w + tx);
    ctx.drawImage(mix ? mix[frame] : G.assets.tiles[def.tex][frame], tx * 16, ty * 16);
    const ov = this.landOverlay.get(ty * this.w + tx);
    if (ov) ctx.drawImage(ov, tx * 16, ty * 16);
    else if (!this.shore.has(ty * this.w + tx) && ty > 0 && !G.TILES[this.ground[(ty - 1) * this.w + tx]].water && !CLASS[G.TILES[this.ground[(ty - 1) * this.w + tx]].name]) {
      ctx.fillStyle = 'rgba(220,240,255,0.55)';   // a man-made edge (a quay, a pool): the old straight line
      ctx.fillRect(tx * 16, ty * 16, 16, 1 + ((frame + tx) % 2));
    }
  }
};
})();
