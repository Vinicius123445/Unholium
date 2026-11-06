'use strict';
// Real materials. Every surface in the world is painted again here at 64 x 64, pixel by pixel, from tileable noise:
// brick with mortar, planks with grain, asphalt with aggregate, cobbles, slabs, fibres, water.
//   The 16 x 16 tile every system already knows (terrain blending, soot, wall paint, the minimap) becomes a reduction of
//   this painting, so all of it keeps working. What the reduction loses is kept as a detail map, drawn over the ground in
//   'overlay'; the picture on screen carries the full resolution without a ground canvas nobody could afford.
//   Variants: five of each, three on Low and Medium. The two arrays stay in step with G.assets.tile()'s hash.
(() => {
const A = G.assets, S = 64, TAU = Math.PI * 2;
const fract = (v) => v - Math.floor(v), clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t;
const h2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
// value noise that wraps every `per` cells
const vn = (x, y, per, s) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), w = (q) => ((q % per) + per) % per, n = (p, q) => h2(w(p), w(q), s); return mix(mix(n(i, j), n(i + 1, j), a), mix(n(i, j + 1), n(i + 1, j + 1), a), b); };
const fbm = (u, v, base, oct, s) => { let t = 0, amp = 0.5, n = 0, per = base; for (let k = 0; k < oct; k++) { t += amp * vn(u * per, v * per, per, s + k * 13); n += amp; amp *= 0.5; per *= 2; } return t / n; };
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const ramp = (cols, t) => { const n = cols.length - 1, k = clamp(t) * n, i = Math.min(n - 1, Math.floor(k)); return lerp3(cols[i], cols[i + 1], k - i); };
const pal = (...c) => c.map(hex);
const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// nearest feature point in a wrapping grid: cobbles, gravel, cracked mud. d1, d2: distance to the nearest two; id: which stone
const cells = (u, v, per, s) => { const x = u * per, y = v * per, i = Math.floor(x), j = Math.floor(y); let d1 = 9, d2 = 9, id = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const p = ((i + a) % per + per) % per, q = ((j + b) % per + per) % per, fx = i + a + h2(p, q, s), fy = j + b + h2(q, p, s + 1), d = Math.hypot(fx - x, fy - y); if (d < d1) { d2 = d1; d1 = d; id = h2(p, q, s + 2); } else if (d < d2) d2 = d; } return { d1, d2, id }; };
// a running bond: rows of courses, each unit shifted half a length on alternate rows
const bond = (u, v, rows, cols) => { const ry = v * rows, row = Math.floor(ry), fx = fract(u * cols + (row % 2 ? 0.5 : 0)), col = Math.floor(u * cols + (row % 2 ? 0.5 : 0)) % cols; return { row, col, fx, fy: fract(ry), edge: Math.min(fx, 1 - fx) / rows * cols, ey: Math.min(fract(ry), 1 - fract(ry)) }; };

const M = {
  grass: (u, v, s) => { const n = fbm(u, v, 3, 5, s), b = fbm(u * 1, v * 3, 8, 3, s + 5), c = ramp(pal('#2e5a22', '#3f7a2c', '#548f36', '#7aa546'), n * 0.7 + b * 0.5 - 0.1), blade = vn(u * 40, v * 14, 40, s + 9); return dim(c, 0.82 + blade * 0.42); },
  darkgrass: (u, v, s) => { const n = fbm(u, v, 3, 5, s + 2), b = vn(u * 36, v * 12, 36, s + 8), c = ramp(pal('#1b3a1a', '#27522a', '#3a6a30'), n); return dim(c, 0.78 + b * 0.5); },
  dirt: (u, v, s) => { const n = fbm(u, v, 4, 6, s), g = cells(u, v, 16, s), c = ramp(pal('#5a3e26', '#7a5636', '#94704a'), n); return dim(c, 0.86 + smooth(0.1, 0.5, g.d1) * 0.2 - (g.id > 0.92 ? 0.2 : 0)); },
  path: (u, v, s) => { const n = fbm(u, v, 4, 6, s), g = cells(u, v, 20, s), c = ramp(pal('#8a6e4a', '#ab8e64', '#c4aa80'), n); return dim(c, 0.84 + smooth(0, 0.45, g.d1) * 0.26); },
  sand: (u, v, s) => { const n = fbm(u, v, 3, 5, s), r = Math.sin((v + fbm(u, v, 3, 3, s + 1) * 0.3) * TAU * 4) * 0.03, c = ramp(pal('#c8ae78', '#dcc492', '#ecdaae'), n); return dim(c, 0.96 + r + (h2(Math.floor(u * 64), Math.floor(v * 64), s) - 0.5) * 0.09); },
  darksand: (u, v, s) => dim(ramp(pal('#5a4c3a', '#7a6a52', '#94826a'), fbm(u, v, 4, 5, s)), 0.92 + h2(Math.floor(u * 64), Math.floor(v * 64), s) * 0.14),
  ash: (u, v, s) => dim(ramp(pal('#1e1a1a', '#3a3232', '#585050'), fbm(u, v, 5, 6, s)), 0.9 + h2(Math.floor(u * 64), Math.floor(v * 64), s) * 0.2),
  asphalt: (u, v, s) => { const n = fbm(u, v, 3, 5, s), g = cells(u, v, 26, s), st = g.id, c = ramp(pal('#333337', '#3f3f43', '#4c4c4e'), n * 0.7 + st * 0.3); return dim(c, 0.9 + smooth(0.02, 0.28, g.d2 - g.d1) * 0.2); },
  concrete: (u, v, s) => { const n = fbm(u, v, 4, 6, s), c = ramp(pal('#8a8680', '#a09a92', '#b4aea4'), n), pit = h2(Math.floor(u * 64), Math.floor(v * 64), s) > 0.965 ? 0.76 : 1; return dim(c, pit * (0.94 + fbm(u, v, 12, 2, s + 2) * 0.12)); },
  sidewalk: (u, v, s) => { const n = fbm(u, v, 4, 6, s), c = ramp(pal('#9a9488', '#b0a99c', '#c4bcae'), n), j = Math.min(Math.abs(fract(u * 2) - 0.5), Math.abs(fract(v * 2) - 0.5)) ; const g = fract(u * 2 + 0.5) < 0.04 || fract(v * 2 + 0.5) < 0.04; void j; return dim(c, g ? 0.56 : 0.92 + h2(Math.floor(u * 64), Math.floor(v * 64), s) * 0.14); },
  lot: (u, v, s) => { const n = fbm(u, v, 3, 6, s), g = cells(u, v, 18, s), crack = smooth(0.012, 0, Math.abs(fbm(u, v, 2, 5, s + 3) - 0.5)), c = ramp(pal('#544e42', '#6e675a', '#857c6c', '#6a6a4a'), n * 0.8 + g.id * 0.2); return dim(c, (0.84 + smooth(0, 0.3, g.d2 - g.d1) * 0.24) * (1 - crack * 0.55)); },
  court: (u, v, s) => dim(ramp(pal('#8a4a2e', '#a65e3a', '#bc7048'), fbm(u, v, 4, 5, s)), 0.92 + h2(Math.floor(u * 64), Math.floor(v * 64), s) * 0.12),
  plaza: (u, v, s) => { const b = bond(u, v, 4, 2), c = ramp(pal('#a89a82', '#c2b49a', '#d8caae'), fbm(u, v, 4, 5, s) * 0.6 + h2(b.row, b.col, s) * 0.5), e = Math.min(b.ey, b.edge); return dim(c, e < 0.05 ? 0.58 : 0.92 + smooth(0.05, 0.18, e) * 0.1); },
  cobble: (u, v, s) => { const g = cells(u, v, 7, s), e = g.d2 - g.d1, c = ramp(pal('#5e5a56', '#807a72', '#a09888', '#7a6a5a'), g.id), k = smooth(0.04, 0.2, e); return e < 0.05 ? [46, 40, 36] : dim(c, (0.66 + k * 0.42) * (0.9 + fbm(u, v, 12, 2, s) * 0.2)); },
  darkstone: (u, v, s) => { const g = cells(u, v, 5, s), e = g.d2 - g.d1; return e < 0.04 ? [18, 16, 18] : dim(ramp(pal('#2a262a', '#3a3438', '#4a4246'), g.id), 0.8 + smooth(0.04, 0.2, e) * 0.3); },
  stonefloor: (u, v, s) => { const b = bond(u, v, 3, 2), c = ramp(pal('#6a6660', '#868078', '#9e9a90'), h2(b.row, b.col, s) * 0.6 + fbm(u, v, 5, 4, s) * 0.4), e = Math.min(b.ey, b.edge); return e < 0.04 ? [50, 46, 44] : dim(c, 0.92 + smooth(0.04, 0.14, e) * 0.1); },
  tilefloor: (u, v, s) => { const cx = Math.floor(u * 4), cy = Math.floor(v * 4), e = Math.min(fract(u * 4), 1 - fract(u * 4), fract(v * 4), 1 - fract(v * 4)), c = (cx + cy) % 2 ? hex('#d8d2c4') : hex('#bcb4a4'); return e < 0.05 ? [120, 114, 104] : dim(c, 0.96 + fbm(u, v, 5, 3, s) * 0.08 + smooth(0.05, 0.16, e) * 0.04 - (1 - v) * 0.02); },
  woodfloor: (u, v, s) => { const r = Math.floor(v * 4), f = fract(v * 4), off = h2(r, 9, s), uu = fract(u + off), col = Math.floor(uu * 2), tone = h2(r, col, s), wave = fbm(uu, v, 3, 4, s + r * 3), ring = Math.sin((f * 9 + wave * 7 + tone * 20)) * 0.5 + 0.5, c = ramp(pal('#6e4524', '#845630', '#96683c', '#a87a48'), tone * 0.6 + wave * 0.25 + ring * 0.15); return f < 0.035 || fract(uu * 2) < 0.012 ? [58, 38, 24] : dim(c, 0.94 + ring * 0.08); },
  carpet: (u, v, s) => { const n = fbm(u, v, 4, 4, s), f = h2(Math.floor(u * 64), Math.floor(v * 64), s), c = ramp(pal('#4e141e', '#7a2030', '#962c3c'), n); return dim(c, 0.74 + f * 0.48); },
  field: (u, v, s) => { const fur = Math.sin((u + fbm(u, v, 3, 3, s) * 0.03) * TAU * 6) * 0.5 + 0.5, c = ramp(pal('#3e2a1a', '#5a3e26', '#6e4e30'), fur * 0.7 + fbm(u, v, 6, 4, s) * 0.3); return dim(c, 0.8 + fur * 0.34); },
  wheat: (u, v, s) => { const wx = fbm(u, v, 2, 3, s + 5) * 0.14, st = vn((u + wx) * 44, (v + wx * 0.6) * 6 + fbm(u, v, 3, 2, s + 9) * 3, 44, s) * (0.7 + 0.3 * vn(u * 20, v * 20, 20, s + 3)), n = fbm(u, v, 3, 4, s), c = ramp(pal('#8a6a24', '#c49a34', '#e2c45a'), st * 0.7 + n * 0.3); return dim(c, 0.7 + st * 0.5); },
  cabbage: (u, v, s) => { const g = cells(u, v, 4, s), k = smooth(0.5, 0, g.d1), c = ramp(pal('#3e2a1a', '#2f6a2a', '#5aa048', '#8ccc66'), k * (0.7 + fbm(u, v, 12, 3, s) * 0.5)); return c; },
  wall_brick: (u, v, s) => { const b = bond(u, v, 9, 3), tone = h2(b.row, b.col, s), c = ramp(pal('#6a2c1e', '#8e3e28', '#a84e30', '#b8624a'), tone * 0.8 + fbm(u, v, 8, 4, s) * 0.3), e = Math.min(b.ey, b.edge * 0.4); return e < 0.09 ? ramp(pal('#7a746a', '#9a9486'), fbm(u, v, 10, 2, s + 4)) : dim(c, 0.82 + smooth(0.09, 0.2, e) * 0.2 + (h2(Math.floor(u * 64), Math.floor(v * 64), s) - 0.5) * 0.14); },
  wall_stone: (u, v, s) => { const b = bond(u, v, 5, 2), c = ramp(pal('#5a5448', '#7a7264', '#9a9282'), h2(b.row, b.col, s) * 0.7 + fbm(u, v, 7, 4, s) * 0.3), e = Math.min(b.ey, b.edge); return e < 0.07 ? [42, 38, 34] : dim(c, 0.84 + smooth(0.07, 0.2, e) * 0.22); },
  wall_wood: (u, v, s) => { const r = Math.floor(v * 5), f = fract(v * 5), g = fbm(u * 0.4 + r * 0.31, v, 6, 4, s + r), ring = Math.sin(u * 30 + g * 22) * 0.5 + 0.5, c = ramp(pal('#3e2614', '#6a4422', '#8e6232'), h2(r, 0, s) * 0.5 + ring * 0.35 + g * 0.15); return f < 0.1 ? [22, 14, 10] : dim(c, 0.84 + (f > 0.86 ? -0.14 : 0.1)); },
  wall_plaster: (u, v, s) => dim(ramp(pal('#a89c84', '#c4b89e', '#d8ccb2'), fbm(u, v, 4, 6, s)), 0.96 + (fbm(u, v, 14, 3, s + 1) - 0.5) * 0.14),
  wall_concrete: (u, v, s) => { const n = fbm(u, v, 3, 6, s), c = ramp(pal('#66686c', '#84868a', '#9c9ea0'), n), pour = fract(v * 3) < 0.025 ? 0.74 : 1, stain = smooth(0.6, 0.72, fbm(u * 2, v * 0.5, 4, 3, s + 2)) * 0.14; return dim(c, pour * (0.96 - stain)); },
  wall_siding: (u, v, s) => { const f = fract(v * 8), c = ramp(pal('#a89e84', '#c8c0a8', '#dcd4bc'), fbm(u, v, 4, 4, s)); return dim(c, f < 0.14 ? 0.62 : 1.02 - f * 0.1); },
  wall_marble: (u, v, s) => { const w = Math.abs(Math.sin((u * 3 + v * 2 + fbm(u, v, 3, 6, s) * 3.4) * Math.PI)), c = lerp3(hex('#efeae2'), hex('#b4a896'), Math.pow(1 - w, 8)); return dim(c, 0.96 + fbm(u, v, 5, 3, s) * 0.06); },
  wall_dark: (u, v, s) => dim(ramp(pal('#1c191c', '#2a262a', '#3a3438'), fbm(u, v, 4, 5, s)), 0.92 + h2(Math.floor(u * 64), Math.floor(v * 64), s) * 0.12),
  citywall: (u, v, s) => { const b = bond(u, v, 4, 2), e = Math.min(b.ey, b.edge); return e < 0.05 ? [24, 22, 22] : dim(ramp(pal('#3a3634', '#54504c'), h2(b.row, b.col, s)), 0.84 + fbm(u, v, 6, 4, s) * 0.3); },
  cliff: (u, v, s) => { const g = cells(u, v * 0.6 + 0.2, 5, s), n = fbm(u, v, 5, 6, s), c = ramp(pal('#3e3830', '#5e564a', '#7e7464'), n * 0.7 + g.id * 0.3); return dim(c, 0.72 + smooth(0, 0.3, g.d2 - g.d1) * 0.44); },
  bridge: (u, v, s) => { const r = Math.floor(u * 6), f = fract(u * 6), g = fbm(u, v * 0.3 + r * 0.2, 5, 4, s + r), c = ramp(pal('#5e3e22', '#8a6036', '#a87a48'), h2(r, 0, s) * 0.5 + g * 0.5); return f < 0.08 ? [24, 16, 10] : dim(c, 0.86 + g * 0.26); },
  dock: (u, v, s) => { const r = Math.floor(v * 5), f = fract(v * 5), g = fbm(u * 0.3 + r * 0.2, v, 5, 4, s + r), c = ramp(pal('#54402e', '#786048', '#92806a'), h2(r, 1, s) * 0.4 + g * 0.6); return f < 0.08 ? [16, 14, 12] : dim(c, 0.86 + g * 0.26); },
  hedge: (u, v, s) => { const g = cells(u, v, 9, s), n = fbm(u, v, 6, 4, s), c = ramp(pal('#16361a', '#245a26', '#3e7c34', '#62a048'), n * 0.5 + smooth(0.55, 0.05, g.d1) * 0.6); return c; },
  burnt_grass: (u, v, s) => dim(ramp(pal('#141210', '#2e2a22', '#46402e'), fbm(u, v, 4, 6, s)), 0.8 + vn(u * 36, v * 12, 36, s) * 0.4),
  burnt_floor: (u, v, s) => { const r = Math.floor(v * 6), c = ramp(pal('#100c0a', '#2a1e16', '#3e2e22'), fbm(u, v, 5, 5, s)); return fract(v * 6) < 0.06 ? [6, 4, 4] : dim(c, 0.84 + h2(r, 2, s) * 0.3); },
  ruin_wood: (u, v, s) => { const g = cells(u, v, 5, s); return g.d2 - g.d1 < 0.05 ? [10, 8, 6] : dim(ramp(pal('#1a120c', '#3a2a1c'), g.id), 0.8 + fbm(u, v, 7, 3, s) * 0.5); },
  rubble: (u, v, s) => { const g = cells(u, v, 8, s), e = g.d2 - g.d1, c = ramp(pal('#3a3632', '#6a645a', '#8e7a68', '#7e4a3a'), g.id); return e < 0.05 ? [20, 18, 16] : dim(c, 0.68 + smooth(0.05, 0.22, e) * 0.5); },
  field_burnt: (u, v, s) => dim(ramp(pal('#100c0a', '#2a2018', '#40301e'), fbm(u, v, 5, 5, s)), 0.78 + (Math.sin(u * TAU * 6) * 0.5 + 0.5) * 0.3),
  road_line: (u, v, s) => { const c = M.asphalt(u, v, s); if (Math.abs(v - 0.5) < 0.05 && fract(u) < 0.62) return lerp3(c, hex('#e4c23e'), 0.92 - fbm(u, v, 12, 3, s) * 0.34); return c; },
  road_line_v: (u, v, s) => { const c = M.asphalt(u, v, s); if (Math.abs(u - 0.5) < 0.05 && fract(v) < 0.62) return lerp3(c, hex('#e4c23e'), 0.92 - fbm(u, v, 12, 3, s) * 0.34); return c; },
};
const WATER = {
  water: ['#14465e', '#1e6078', '#2c7c8c'], deepwater: ['#0a2c4a', '#123e60', '#1c5274'], pool: ['#2a9cc8', '#46bcdc', '#7ad8ec'],
};
// five variants of each material; the reduction replaces the 16 x 16 tile, the rest is the detail map
const paint = (fn, s) => { const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const q = fn((i + 0.5) / S, (j + 0.5) / S, s), k = (j * S + i) * 4; d[k] = q[0]; d[k + 1] = q[1]; d[k + 2] = q[2]; d[k + 3] = 255; } x.putImageData(img, 0, 0); return c; };
function reduce(c) {
  const o = document.createElement('canvas'); o.width = o.height = 16; const x = o.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, 16, 16); return o;
}
function detail(c, small) {
  // what the reduction lost: this picture minus the reduction blown back up, around mid gray
  const u = document.createElement('canvas'); u.width = u.height = S; const ux = u.getContext('2d'); ux.imageSmoothingEnabled = true; ux.imageSmoothingQuality = 'high'; ux.drawImage(small, 0, 0, S, S);
  const a = c.getContext('2d').getImageData(0, 0, S, S), b = ux.getImageData(0, 0, S, S), o = document.createElement('canvas'); o.width = o.height = S;
  const ox = o.getContext('2d'), im = ox.createImageData(S, S), A0 = a.data, B0 = b.data, D = im.data;
  for (let i = 0; i < D.length; i += 4) { const g = (k) => clamp(128 + (A0[i + k] - B0[i + k]) * 0.62 * Math.min(1.5, 160 / Math.max(50, B0[i + k])), 0, 255); D[i] = g(0); D[i + 1] = g(1); D[i + 2] = g(2); D[i + 3] = 255; }
  ox.putImageData(im, 0, 0); return o;
}
const SMALL = {}, DETAIL = {}, FRAMES = {};
function bake() {
  for (const name in M) {
    SMALL[name] = []; DETAIL[name] = [];
    const base = [];
    for (let v = 0; v < 3; v++) base.push(paint(M[name], G.util.hashString(name) % 91 + v * 7));
    for (let v = 0; v < 2; v++) { const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.translate(S, 0); x.scale(-1, 1); x.drawImage(base[v], 0, 0); base.push(c); }   // (two more, mirrored: cheap at startup)
    for (const c of base) { const s = reduce(c); SMALL[name].push(s); DETAIL[name].push(detail(c, s)); }
  }
  for (const name in WATER) {   // moving water: the surface pattern drifts through four frames
    const cols = pal(...WATER[name]), arr = [], det = [];
    for (let f = 0; f < 4; f++) {
      const c = paint((u, v, s) => { const a = f / 4, n = fbm(u + a * 0.25, v + a * 0.5, 3, 4, s), r = 1 - Math.abs(fbm(u - a * 0.25, v + a * 0.25, 5, 3, s + 3) * 2 - 1), q = ramp(cols, n); return lerp3(q, hex('#cfe8ee'), Math.pow(r, 14) * 0.5); }, 31);
      const s = reduce(c); arr.push(s); det.push(detail(c, s));
    }
    arr.hd = true; A.tiles[name] = arr; FRAMES[name] = det;
  }
}
const use = () => { const all = G.gfxLevel().allTiles; for (const n in SMALL) { const t = all ? SMALL[n] : SMALL[n].slice(0, 3); t.hd = true; A.tiles[n] = t; } };
G.realMat = { M, S, bake, use, ready: false, detail: (name, v) => { const t = DETAIL[name]; if (!t) return null; const n = G.gfxLevel().allTiles ? t.length : 3; return t[v % n]; } };
const _init = A.init;
A.init = function () { _init.call(this); setTimeout(() => { bake(); G.realMat.ready = true; G.hdArt.apply(); use(); }, 0); };
if (A.tiles && A.tiles.grass) setTimeout(() => { if (!G.realMat.ready) { bake(); G.realMat.ready = true; G.hdArt.apply(); use(); } }, 0);
const _pick = G.hdArt.pickTiles; G.hdArt.pickTiles = function () { _pick.call(this); if (G.realMat.ready) use(); };

// ---------------------------------------------------------------- the detail over the ground
const TM = G.TileMap.prototype, _dg = TM.drawGround;
const layer = { c: document.createElement('canvas'), map: null, x0: 0, y0: 0, cols: 0, rows: 0, tp: 0, n: 0 };
function refresh(m, x0, y0, cols, rows, tp) {
  const c = layer.c, W = cols * tp, H = rows * tp; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'medium'; x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const tx = x0 + i, ty = y0 + j; if (!m.inBounds(tx, ty)) continue;
    const def = G.TILES[m.ground[ty * m.w + tx]]; if (!def || !def.tex || def.anim) continue;
    const d = G.realMat.detail(def.tex, G.util.hash2(tx, ty, 7)); if (d) x.drawImage(d, i * tp, j * tp, tp, tp);
  }
  Object.assign(layer, { map: m, x0, y0, cols, rows, tp, n: m.modN || 0 });
}
const _set = TM.setTileRuntime; TM.setTileRuntime = function (tx, ty, t) { this.modN = (this.modN || 0) + 1; return _set.call(this, tx, ty, t); };
TM.drawGround = function (ctx, view, time) {
  const was = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;   // the ground is a photograph now, not pixels
  const r = _dg.call(this, ctx, view, time);
  ctx.imageSmoothingEnabled = was;
  if (!G.realMat.ready || ctx.canvas !== G.renderer.canvas) return r;
  const tp = Math.min(S, Math.max(16, Math.ceil(G.renderer.zoom) * 16)), x0 = Math.max(0, Math.floor(view.x / 16)), y0 = Math.max(0, Math.floor(view.y / 16)), cols = Math.ceil(view.w / 16) + 2, rows = Math.ceil(view.h / 16) + 2;
  if (layer.map !== this || layer.x0 !== x0 || layer.y0 !== y0 || layer.cols !== cols || layer.rows !== rows || layer.tp !== tp || layer.n !== (this.modN || 0)) refresh(this, x0, y0, cols, rows, tp);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layer.c, x0 * 16, y0 * 16, cols * 16, rows * 16);
  const frame = Math.floor(time * 2.5) % 4;
  for (let ty = y0; ty < y0 + rows && ty < this.h; ty++) for (let tx = x0; tx < x0 + cols && tx < this.w; tx++) { const def = G.TILES[this.ground[ty * this.w + tx]]; if (def.anim && FRAMES[def.tex]) ctx.drawImage(FRAMES[def.tex][frame], tx * 16, ty * 16, 16, 16); }
  ctx.restore();
  return r;
};
})();
