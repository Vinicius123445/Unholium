'use strict';
// Walls seen from above where they run north-south.
// In this 3/4 view only the southmost tile of a wall shows its face (the side you look at); every wall tile
// with more wall below it shows the TOP of the wall, running on as one continuous strip: wooden walls as
// long vertical planks, brick and stone as courses seen from above, plaster and concrete as a smooth cap.
// (Before, each tile of a sideways wall drew a full wall face, so a north-south wall looked like a stack of
// little walls.) Tops are made from each wall's own face colors, so they match.
(() => {
const A = G.assets, sh = (c, f) => A.shade(c, f);
const cache = {};
// the face's light and dark tones, sampled from its texture
const tones = (img) => {
  const x = img.getContext('2d'), d = x.getImageData(0, 0, 16, 16).data, cols = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) cols.push([d[i], d[i + 1], d[i + 2]]);
  cols.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const pick = (f) => cols[Math.floor(cols.length * f)] || [128, 128, 128];
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  return { base: hex(pick(0.55)), light: hex(pick(0.85)), dark: hex(pick(0.18)) };
};
function top(tex, v, joinUp) {
  const k = tex + '|' + v + '|' + (joinUp ? 1 : 0);
  if (cache[k]) return cache[k];
  const face = A.tile(tex, v) || A.tile(tex, 0); if (!face) return null;
  const { base, light, dark } = tones(face);
  const { c, x } = A.mk(16, 16), R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const r = new G.RNG(tex + v);
  const wood = /wood|siding/.test(tex), brick = /brick/.test(tex), stone = /stone|marble|dark/.test(tex);
  R(0, 0, 16, 16, base);
  if (wood) {   // long planks running the length of the wall, seams and grain
    for (let px = 2; px < 14; px += 4) { R(px, 0, 4, 16, r.chance(0.5) ? base : sh(base, 1.06)); R(px, 0, 1, 16, sh(base, 0.72)); }
    for (let i = 0; i < 10; i++) R(r.int(3, 12), r.int(0, 15), 1, r.int(1, 3), sh(base, 0.86));
    if (!joinUp) R(2, 0, 12, 1, light);
  } else if (brick) {   // brick courses from above
    for (let py = 0; py < 16; py += 4) { R(2, py, 12, 3, r.chance(0.3) ? sh(base, 0.92) : base); R(2, py + 3, 12, 1, sh(base, 0.6)); R(py % 8 ? 8 : 5, py, 1, 3, sh(base, 0.6)); }
  } else if (stone) {
    for (let i = 0; i < 6; i++) { const py = r.int(0, 13); R(r.int(2, 9), py, r.int(3, 6), 1, sh(base, 0.75)); }
    for (let i = 0; i < 8; i++) R(r.int(2, 13), r.int(0, 15), 1, 1, light);
  } else {   // a smooth cap with a faint center line
    for (let i = 0; i < 14; i++) R(r.int(2, 13), r.int(0, 15), 1, 1, r.chance(0.5) ? light : sh(base, 0.9));
    R(8, 0, 1, 16, sh(base, 0.92));
  }
  // the wall's thickness shows as darker edges on both sides, and shadow falling off it onto the ground
  R(0, 0, 2, 16, dark); R(14, 0, 2, 16, dark); R(2, 0, 1, 16, sh(base, 0.82)); R(13, 0, 1, 16, light);
  return (cache[k] = c);
}
G.wallTop = top;   // (the editor draws walls the same way: editor/editor_hd.js)
const TM = G.TileMap.prototype, _draw = TM.drawTileInto, _set = TM.setTileRuntime;
const isWall = (map, tx, ty) => { const d = map.inBounds(tx, ty) && G.TILES[map.get(tx, ty)]; return !!(d && d.wall && d.tex); };
TM.drawTileInto = function (x, tx, ty, withExtras = true) {
  _draw.call(this, x, tx, ty, withExtras);
  if (!isWall(this, tx, ty) || !isWall(this, tx, ty + 1)) return;
  // more wall below: this is the top of a north-south wall
  const def = G.TILES[this.get(tx, ty)], img = top(def.tex, G.util.hash2(tx, ty, 7), isWall(this, tx, ty - 1));
  if (!img) return;
  const lw = isWall(this, tx - 1, ty), rw = isWall(this, tx + 1, ty);
  x.drawImage(img, tx * 16, ty * 16);
  // a wall corner joining an east-west wall: the top continues sideways too
  if (lw || rw) { if (lw) x.drawImage(img, 2, 0, 1, 16, tx * 16, ty * 16, 2, 16); if (rw) x.drawImage(img, 13, 0, 1, 16, tx * 16 + 14, ty * 16, 2, 16); }
};
// a wall placed below or above another changes how its neighbors look: redraw them too
TM.setTileRuntime = function (tx, ty, t) {
  _set.call(this, tx, ty, t);
  if (ty > 0) this.redrawTile(tx, ty - 1);
};
})();
