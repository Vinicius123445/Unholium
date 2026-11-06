'use strict';
// HD art for everything the bespoke passes do not redraw:
//   Tiles (every texture not already redrawn in visuals.js): tileable per-pixel material detail —
//     depth at mortar lines and cracks (the pixel under an edge darkens, the one above catches light),
//     grain and speckle by material (wood, stone, brick, plaster, metal, cloth, plants), and two extra
//     variants per texture so the same tile stops repeating. Animated tiles keep their frames.
//   Sprites (all decor and furniture that is not a person, an animal or a vehicle): light from the top
//     left, rim light on top edges, a contact shade at the foot, material detail (grain, weave, chrome).
//   Icons: an edge light and a soft underside.
// Every quality level uses this art. Low and Medium show each tile's first variants, High and Ultra all of them.
(() => {
const A = G.assets;
const fract = (v) => v - Math.floor(v), h2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
const copy = (c) => { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; o.getContext('2d').drawImage(c, 0, 0); return o; };

// tileable: neighbors wrap around the 16x16 tile
function detailTile(src, seed) {
  const c = copy(src), x = c.getContext('2d'), w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data, s = new Uint8ClampedArray(d);
  const lum = (px, py) => { const i = ((((py % h) + h) % h) * w + (((px % w) + w) % w)) * 4; return s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11; };
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = (py * w + px) * 4;
    if (s[i + 3] < 40) continue;
    const L = lum(px, py), up = lum(px, py - 1), dn = lum(px, py + 1), lf = lum(px - 1, py);
    const [hue, sat, l] = hsl(s[i], s[i + 1], s[i + 2]);
    let f = 1 + (h2(px, py, seed) - 0.5) * (sat < 0.15 ? 0.09 : 0.06);   // speckle
    if (up - L > 14) f *= 0.86;            // just under a darker line: in shadow (depth)
    else if (dn - L > 14 || L - dn > 18) f *= 1.08;   // just above a mortar line / an edge: catches the light
    if (lf - L > 14) f *= 0.92;
    if (hue >= 12 && hue <= 45 && sat > 0.2 && l < 0.65) f *= 1 + 0.06 * Math.sin((py + 2 * Math.sin(px * 0.5 + seed)) * 1.7);   // wood grain
    else if (hue > 60 && hue < 160 && sat > 0.2) f *= ((px * 3 + py * 5 + seed) % 7 === 0) ? 1.12 : 1;   // leaves and moss: a few bright flecks
    if (h2(px, py, seed + 9) < 0.012) f *= 0.8;   // wear: a chip or a stain here and there
    d[i] = s[i] * f; d[i + 1] = s[i + 1] * f; d[i + 2] = s[i + 2] * f;
  }
  x.putImageData(img, 0, 0);
  return c;
}
function detailSprite(src, seed, icon) {
  const c = copy(src), x = c.getContext('2d'), w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h), d = img.data, s = new Uint8ClampedArray(d);
  const a = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : s[(py * w + px) * 4 + 3]);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = (py * w + px) * 4;
    if (s[i + 3] < 40) continue;
    const r = s[i], g = s[i + 1], b = s[i + 2];
    if (r < 42 && g < 36 && b < 46) continue;   // outlines stay
    const [hue, sat, l] = hsl(r, g, b);
    let f = icon ? 1 : 1 + 0.08 * (1 - py / h) - 0.06 * (px / w);
    if (hue >= 12 && hue <= 48 && sat > 0.22 && l > 0.12 && l < 0.62) f *= 1 + 0.06 * Math.sin((py + 2.5 * Math.sin(px * 0.6 + seed)) * 1.9);
    else if (sat < 0.12 && l > 0.55) { f *= 1 - 0.08 * (py / h); if (py < h * 0.3 && px < w * 0.45) f *= 1.05; }
    else if (sat > 0.28 && hue > 60 && hue < 170) f *= 1 + (h2(px, py, seed) - 0.5) * 0.12;   // foliage
    else if (sat > 0.28) f *= ((px + py) & 1) ? 1.03 : 0.975;
    if (!a(px, py - 1)) f *= 1.13; else if (!a(px, py + 1)) f *= 0.85;
    if (!icon && py >= h - 2) f *= 0.9;
    d[i] = r * f; d[i + 1] = g * f; d[i + 2] = b * f;
  }
  x.putImageData(img, 0, 0);
  return c;
}

const FULL = {};   // every variant of each tile (out.base: how many there are without the two extras)
const SKIP_SPRITE = /^veh_|^car_|^moto_|^bike_|^limo|^police_car/;
G.hdArt = {
  applied: false,
  apply() {
    if (this.applied) return;
    const visHI = G.visuals && G.visuals.hiNames ? G.visuals.hiNames() : [];
    for (const name of Object.keys(A.tiles)) {
      if (visHI.includes(name)) continue;
      const arr = A.tiles[name]; if (!arr || !arr.length) continue;
      const anim = G.TILES.some((t) => t.tex === name && t.anim) || /flame|fire/.test(name);
      const out = arr.map((c, v) => detailTile(c, G.util.hashString(name) % 89 + v));
      if (!anim && arr.length <= 3 && !/fence|chainlink|ironfence|road_line|door|window/.test(name)) for (let k = 0; k < 2; k++) out.push(detailTile(arr[k % arr.length], G.util.hashString(name) % 89 + 50 + k));
      out.hd = true; out.base = arr.length;
      FULL[name] = out;
    }
    for (const name of Object.keys(A.sprites)) {
      const s = A.sprites[name];
      if (!s || !s.img || SKIP_SPRITE.test(name) || s.hd || s.detailed) continue;
      s.img = detailSprite(s.img, G.util.hashString(name) % 97, false);
      s.hd = true;
    }
    for (const name of Object.keys(A.icons)) {
      if (A.icons[name].hd) continue;
      A.icons[name] = detailSprite(A.icons[name], G.util.hashString(name) % 31, true);
      A.icons[name].hd = true;
    }
    this.applied = true;
    this.pickTiles();
  },
  pickTiles() {
    const all = G.gfxLevel().allTiles;
    for (const n in FULL) { const o = FULL[n], t = all ? o : o.slice(0, o.base); t.hd = true; A.tiles[n] = t; }
  },
  detailIcon(c, name) { const d = detailSprite(c, G.util.hashString(name) % 31, true); d.hd = true; return d; },
  // for the tests: does every tile, sprite and icon have its HD art?
  report() {
    const visHI = G.visuals && G.visuals.hiNames ? G.visuals.hiNames() : [];
    const tiles = Object.keys(A.tiles).filter((n) => !(A.tiles[n].hd || visHI.includes(n)));
    const sprites = Object.keys(A.sprites).filter((n) => !SKIP_SPRITE.test(n) && !(A.sprites[n].hd || A.sprites[n].detailed));
    const icons = Object.keys(A.icons).filter((n) => !A.icons[n].hd);
    return { tiles, sprites, icons };
  },
};
const _init = A.init;
A.init = function () { _init.call(this); setTimeout(() => G.hdArt.apply(), 0); };
G.events.on('settingsChanged', (k) => {
  if (k !== 'graphics' && k != null) return;
  G.hdArt.pickTiles();
  const g = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (g && g.map && g.map.prerender) try { g.map.prerender(); } catch (e) { /* later */ }
});
})();
// icons made on demand (clothing items) get the same treatment the moment they are made
(() => {
const A = G.assets, _icon = A.icon;
A.icon = function (name) {
  const c = _icon.call(this, name);
  if (G.hdArt.applied && c && !c.hd && name && A.icons[name] === c) { const d = G.hdArt.detailIcon(c, name); A.icons[name] = d; return d; }
  return c;
};
})();
