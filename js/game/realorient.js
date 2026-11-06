'use strict';
// Furniture that can turn. A piece one tile square keeps its type and takes an orientation (d.ori: 'l' faces west, 'r' east, 'up' away
// from you, 'dl' and 'dr' on the diagonal), so collision and every system that knows it by name stay as they are; its art is ART[sprite_ori].
// A long piece swaps its footprint, so turned couches, tables and desks are types of their own. Seats face the way they are drawn.
(() => {
const F = G.realFurn, { ART, make, wood, gloss, fill, line, grad } = F, sh = G.assets.shade;
const WOOD = '#7e5230', DARK = '#4e3220', LIGHT = '#a87a4a', CLOTH = '#4a5a7a', LEATHER = '#8a4a3a';
F.NEW = {};
// turned pieces of two tiles: a new type, built from the piece it turns from
const turned = (name, base, o) => { const d = Object.assign({}, G.DECOR[base], { sprite: name }, o); delete d.pfh; G.DECOR[name] = d; F.NEW[name] = true; };
turned('couch_l', 'couch', { fw: 1, fh: 2, faceDir: 1, interact: 'sit' }); turned('couch_r', 'couch', { fw: 1, fh: 2, faceDir: 2, interact: 'sit' });
turned('table_v', 'table', { fw: 1, fh: 2 }); turned('desk_l', 'desk', { fw: 1, fh: 2 }); turned('desk_r', 'desk', { fw: 1, fh: 2 });
F.faceOf = (d) => (d.ori ? { l: 1, r: 2, up: 3, dl: 0, dr: 0 }[d.ori] : d.def.faceDir);
// A second image of the same painting, mirrored: only the side and its opposite have to be drawn once.
const pair = (name, w, h, fn) => { make(name + '_r', w, h, fn); make(name + '_l', w, h, (x, W, H) => { x.translate(W, 0); x.scale(-1, 1); fn(x, W, H); }); };
// a cabinet standing against the left wall, its front to the right: the top, the long side, the edge of the doors
const cabinet = (x, W, H, top, side, edge, deck, detail) => {
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, H - 2, W - 2, 2);
  wood(x, 1, deck, W - 5, H - deck - 1, side, 3); x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(1, deck, W - 5, 0.7);
  x.fillStyle = grad(x, W - 4, 0, W - 1, 0, [sh(edge, 1.16), sh(edge, 0.84)]); x.fillRect(W - 4, deck, 3, H - deck - 1);
  x.fillStyle = grad(x, 0, 0, W, deck, [sh(top, 1.14), top]); x.fillRect(1, 1, W - 2, deck - 1); x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 0.3; x.strokeRect(1, 1, W - 2, H - 2);
  if (detail) detail(x, W, H, deck);
};
const couchSide = (x, W, H, cloth) => {
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, H - 2, W - 2, 2);
  fill(x, 1, 1, W - 2, H - 3, 0.5, sh(cloth, 0.7));   // base
  fill(x, 1, 1, 4.6, H - 3, 0.5, grad(x, 0, 0, 6, 0, [sh(cloth, 0.72), sh(cloth, 1.1)]));   // the back, along the wall
  fill(x, 5, 1, W - 6, 4, 0.5, sh(cloth, 0.96)); fill(x, 5, H - 6, W - 6, 4, 0.5, sh(cloth, 0.84));   // arms
  for (let i = 0; i < 2; i++) { const y = 5.4 + i * (H - 11.4) / 2; fill(x, 5.2, y, W - 6.6, (H - 11.4) / 2 - 0.5, 0.4, grad(x, 5, y, W, y + 9, [sh(cloth, 1.24), sh(cloth, 0.98)])); }
  x.fillStyle = '#20140c'; x.fillRect(2, H - 2, 1.4, 2); x.fillRect(W - 3, H - 2, 1.4, 2);
};
const armchairOf = (x, cloth) => {   // seen from above, centred, seat toward +y; rotated by the caller
  fill(x, -6, -5, 12, 3.6, 0.4, sh(cloth, 0.76)); fill(x, -6, -1.6, 2.6, 7, 0.4, sh(cloth, 0.86)); fill(x, 3.4, -1.6, 2.6, 7, 0.4, sh(cloth, 0.86));
  fill(x, -3.4, -1.4, 6.8, 6.6, 0.4, grad(x, -3, -1, 3, 5, [sh(cloth, 1.24), sh(cloth, 0.98)]));
};
const chairOf = (x) => { wood(x, -3.6, -4, 7.2, 1.8, DARK, 3); wood(x, -3.6, -2.2, 7.2, 6, '#6a452c', 5); x.fillStyle = 'rgba(255,230,190,0.12)'; x.fillRect(-3.6, -2.2, 7.2, 0.6); };
const _more = F.more;
F.more = () => {
  _more();
  pair('couch', 16, 34, (x, W, H) => couchSide(x, W, H, CLOTH));
  make('table_v', 16, 26, (x, W, H) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(2, H - 2, W - 4, 2); wood(x, 1, 1, W - 2, H - 7, '#5a3620', 10); gloss(x, 1, 1, W - 2, H - 7); wood(x, 1, H - 6, W - 2, 1.4, DARK, 3); for (const a of [2, W - 3.6]) { x.fillStyle = '#2e1c10'; x.fillRect(a, H - 5, 1.6, 5); } });
  pair('desk', 16, 34, (x, W, H) => { cabinet(x, W, H, '#9a6e44', WOOD, DARK, H - 8); x.fillStyle = '#16181c'; x.fillRect(2.4, H * 0.3, 2, 11); x.fillStyle = grad(x, 4, 0, 6, 0, ['#2a5a8a', '#123048']); x.fillRect(4.4, H * 0.3 + 1, 0.9, 9); x.fillStyle = '#26282c'; x.fillRect(7, H * 0.36, 3.4, 8); x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 4; i++) x.fillRect(7.3, H * 0.36 + 1 + i * 1.8, 2.8, 0.5); });
  // pieces one tile wide: each named after its sprite and its orientation
  const cab = (name, w, h, deck, top, side, edge, detail) => pair(name, w, h, (x, W, H) => cabinet(x, W, H, top, side, edge, deck, detail));
  cab('wardrobe', 16, 30, 8, LIGHT, WOOD, DARK, (x, W, H, d) => { x.fillStyle = '#c8a860'; x.fillRect(W - 3.4, H * 0.5, 0.8, 3); line(x, 'rgba(0,0,0,0.5)', 0.3, W - 2.6, d, W - 2.6, H - 1); });
  cab('shelf', 16, 26, 7, LIGHT, WOOD, DARK, (x, W, H, d) => { for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(W - 4, d + 3 + i * 4.4, 3, 0.6); for (let j = 0; j < 3; j++) { x.fillStyle = ['#c8402e', '#3a78b8', '#e0b040', '#4e9a48'][(i + j) % 4]; x.fillRect(W - 3.8, d + 0.6 + i * 4.4 + j * 0.9, 2.6, 0.7); } } });
  cab('fridge', 15, 25, 7, '#f0efe9', '#d6d6d0', '#b0b0ac', (x, W, H) => { x.fillStyle = '#8a8c90'; x.fillRect(W - 3.4, H * 0.3, 0.7, 5); line(x, 'rgba(0,0,0,0.42)', 0.3, 1, H * 0.42, W - 1, H * 0.42); });
  cab('stove', 15, 18, 10, '#26282c', '#c8c8c4', '#8a8c90', (x, W) => { for (const [a, b] of [[4, 3], [9, 3], [4, 7], [9, 7]]) { x.strokeStyle = '#70747a'; x.lineWidth = 0.5; x.beginPath(); x.arc(a, b, 1.8, 0, 6.3); x.stroke(); } x.fillStyle = '#1a1c20'; x.fillRect(W - 3.6, 11, 2.2, 5); });
  cab('kcounter', 16, 15, 8, '#d8d4cc', WOOD, DARK);
  cab('nightstand', 12, 14, 6, LIGHT, WOOD, DARK, (x, W) => { x.fillStyle = '#c8a860'; x.fillRect(W - 3, 8, 0.6, 2); });
  cab('bookcase', 16, 30, 8, LIGHT, WOOD, DARK, (x, W, H, d) => { for (let i = 0; i < 5; i++) { x.fillStyle = ['#c8402e', '#3a78b8', '#e0b040', '#4e9a48', '#7a54b0'][i]; x.fillRect(W - 3.6, d + 0.6 + i * 4, 2.4, 3.2); } });
  pair('tv', 14, 14, (x, W, H) => { wood(x, 1, H - 6, W - 2, 5, DARK, 4); x.fillStyle = '#1a1c20'; x.fillRect(4, 1, 2, H - 7); x.fillStyle = grad(x, 6, 0, 7, 0, ['#2a4a6a', '#10202e']); x.fillRect(6, 1.4, 0.8, H - 8); x.fillStyle = '#26282c'; x.fillRect(3, H - 7, 4, 1.4); });
  make('tv_up', 14, 14, (x, W, H) => { wood(x, 1, H - 6, W - 2, 5, DARK, 4); fill(x, 1, 1, W - 2, H - 7, 0.3, grad(x, 0, 0, 0, H - 6, ['#2e3034', '#1a1c20'])); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 3; i < W - 3; i += 2) x.fillRect(i, 3, 1, 3); });
  // seats
  for (const [n, c, w, h] of [['f_armchair', LEATHER, 16, 16]]) {
    pair(n, w, h, (x, W, H) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(2, H - 2, W - 4, 2); x.save(); x.translate(W / 2, H / 2 - 1); x.rotate(-Math.PI / 2); armchairOf(x, c); x.restore(); x.fillStyle = '#20140c'; x.fillRect(3, H - 2, 1.4, 2); x.fillRect(W - 4.4, H - 2, 1.4, 2); });
    make(n + '_dr', 20, 20, (x, W, H) => { x.save(); x.translate(W / 2, H / 2); x.rotate(-0.72); armchairOf(x, c); x.restore(); });
    make(n + '_dl', 20, 20, (x, W, H) => { x.save(); x.translate(W / 2, H / 2); x.rotate(0.72); armchairOf(x, c); x.restore(); });
  }
  make('chair_dr', 12, 12, (x, W, H) => { x.save(); x.translate(W / 2, H / 2); x.rotate(-0.72); chairOf(x); x.restore(); });
  make('chair_dl', 12, 12, (x, W, H) => { x.save(); x.translate(W / 2, H / 2); x.rotate(0.72); chairOf(x); x.restore(); });
};
})();
