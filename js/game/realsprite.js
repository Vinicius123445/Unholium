'use strict';
// Objects without pixels. Every sprite, tree and piece of furniture is drawn from a copy at four times its density: the
// edges are rebuilt twice (Scale2x keeps a diagonal a diagonal instead of a staircase), then a little grain goes back in
// so a surface reads as a material. Copies are made the first time a piece is seen and swapped in where it is drawn, so no
// drawing code has to know: sizes in the world are unchanged, and systems that read a sprite's pixels still get the original.
(() => {
const CP = CanvasRenderingContext2D.prototype, _di = CP.drawImage;
const scale2x = (src, w, h) => {
  const out = new Uint32Array(w * h * 4), at = (x, y) => src[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)], W2 = w * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1), i = y * 2 * W2 + x * 2;
    const eq = A === D || B === C;
    out[i] = !eq && C === A ? C : P; out[i + 1] = !eq && A === B ? B : P; out[i + W2] = !eq && C === D ? C : P; out[i + W2 + 1] = !eq && D === B ? B : P;
  }
  return out;
};
// Old pieces wore a black line round everything. It goes: each dark pixel on an edge, or a thin dark line across a surface, takes the
// colour of what it borders in shadow, so a thing ends in its own shaded edge. A thing that really is black keeps its colour.
function unline(s, w, h) {
  const o = s.slice(), lum = (p) => ((p & 255) * 3 + ((p >> 8) & 255) * 6 + ((p >> 16) & 255)) / 10, dark = (p) => (p >>> 24) > 40 && lum(p) < 50;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = s[i]; if (!dark(p)) continue;
    let gap = 0, nd = 0, R = 0, Gr = 0, B = 0, n = 0;
    for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (x + a < 0 || y + c < 0 || x + a >= w || y + c >= h) ? 0 : s[(y + c) * w + x + a]; if ((q >>> 24) < 40) gap++; else if (dark(q)) nd++; }
    if (!gap && nd > 2) continue;
    for (let c = -2; c <= 2; c++) for (let a = -2; a <= 2; a++) { const X = x + a, Y = y + c; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const q = s[Y * w + X]; if ((q >>> 24) < 40 || dark(q)) continue; R += q & 255; Gr += (q >> 8) & 255; B += (q >> 16) & 255; n++; }
    if (!n) continue;
    const k = (gap ? 0.56 : 0.66) / n; o[i] = ((p >>> 24) << 24 | (B * k) << 16 | (Gr * k) << 8 | (R * k)) >>> 0;
  }
  return o;
}
function grow(img) {
  const w = img.width, h = img.height, c0 = img.getContext ? img : null; if (!c0 || w < 2 || h < 2 || w > 400 || h > 400) return null;
  let d; try { d = c0.getContext('2d').getImageData(0, 0, w, h); } catch (e) { return null; }
  const s0 = new Uint32Array(d.data.buffer), s = img._keepLine ? s0 : unline(s0, w, h), s4 = scale2x(scale2x(s, w, h), w * 2, h * 2), W = w * 4, H = h * 4;
  const o = document.createElement('canvas'); o.width = W; o.height = H; const x = o.getContext('2d'), im = x.createImageData(W, H); im.data.set(new Uint8ClampedArray(s4.buffer));
  // grain that belongs to the surface, stronger on the flat of a thing than at its edge
  const D = im.data; for (let i = 0; i < D.length; i += 4) { if (D[i + 3] < 30) continue; const px = (i / 4) % W, py = Math.floor(i / 4 / W), n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453, g = 1 + ((n - Math.floor(n)) - 0.5) * 0.09; D[i] *= g; D[i + 1] *= g; D[i + 2] *= g; }
  x.putImageData(im, 0, 0);
  return o;
}
const made = new WeakMap();
const hi = (img) => { let h = made.get(img); if (h === undefined) { h = grow(img); made.set(img, h); } return h; };
const mark = (c) => { if (c && c.getContext) c._grow = true; return c; };
G.realSprite = { hi, mark, on: true };
CP.drawImage = function (img, a, b, c, d, e, f, g, h) {
  if (img && img._grow && G.realSprite.on && this.canvas === G.renderer.canvas) {
    const up = hi(img);
    if (up) {
      const was = this.imageSmoothingEnabled; this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'high';
      const n = arguments.length, W = img.width, H = img.height;
      if (n === 3) _di.call(this, up, a, b, W, H); else if (n === 5) _di.call(this, up, a, b, c, d); else _di.call(this, up, a * 4, b * 4, c * 4, d * 4, e, f, g, h);
      this.imageSmoothingEnabled = was;
      return undefined;
    }
  }
  return _di.apply(this, arguments);
};
// everything placed in the world
const A = G.assets, mine = () => { for (const n in A.sprites) { const s = A.sprites[n]; if (s && s.img) mark(s.img); } };
const _init = A.init;
A.init = function () { _init.call(this); setTimeout(mine, 0); };
if (A.sprites && A.sprites.bush) setTimeout(mine, 0);
for (const k of ['furnitureHD', 'floraHD']) { const o = G[k]; if (!o) continue; const _g = o.get; o.get = function (n) { return mark(_g.call(this, n)); }; }
})();
