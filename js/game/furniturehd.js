'use strict';
// HD furniture: the pieces every home and shop has, redrawn by hand at twice the pixel density (the same
// size in the world): real shapes, handles, seams, cushions, pillows and folded sheets, wood grain,
// chrome, glass and screens, light from the top left. Drawn instead of the base sprites.
// Pieces without a redraw keep the automatic detail pass (js/game/hdart.js).
(() => {
const A = G.assets, sh = A.shade;
const ART = {};
function make(name, w, h, fn) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const R = (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px, py, pw, ph); };
  const P = (px, py, col) => R(px, py, 1, 1, col);
  // a box with a lit top-left edge and a shaded bottom-right edge
  const box = (px, py, pw, ph, col, k = 1) => { R(px, py, pw, ph, col); R(px, py, pw, k, sh(col, 1.18)); R(px, py, k, ph, sh(col, 1.1)); R(px, py + ph - k, pw, k, sh(col, 0.7)); R(px + pw - k, py, k, ph, sh(col, 0.78)); };
  const grain = (px, py, pw, ph, col, seed = 1) => { for (let yy = py; yy < py + ph; yy += 2) for (let xx = px; xx < px + pw; xx++) if (((xx * 7 + yy * 3 + seed) % 11) < 2) P(xx, yy, sh(col, 0.88)); };
  fn({ R, P, box, grain, x, W: w * 2, H: h * 2 });
  A.outline(c, [24, 18, 22, 235]);
  ART[name] = c;
}
const WOOD = '#8a5a30', WOODL = '#a87040', WHITE = '#e8e6e0', STEEL = '#b8bcc4';

function build() {
  // (most furniture is js/game/realfurn.js now; these are the pieces it does not paint)
  make('f_armchair', 14, 15, ({ R, box, W, H }) => {
    const c = '#8a4a3a';
    box(2, 0, W - 4, 12, sh(c, 0.88), 2); box(4, 2, W - 8, 8, c, 1);
    box(0, 10, W, 12, c, 1); R(3, 12, W - 6, 1, sh(c, 1.2));
    box(0, 4, 5, 18, sh(c, 0.78), 1); box(W - 5, 4, 5, 18, sh(c, 0.78), 1);
    R(2, H - 4, 3, 4, '#3a2214'); R(W - 5, H - 4, 3, 4, '#3a2214');
  });
  make('f_desk_pc', 30, 22, ({ R, box, grain, W, H }) => {
    box(0, 20, W, 14, WOOD, 2); grain(2, 22, W - 4, 10, WOOD, 13);
    box(W / 2 - 11, 2, 22, 16, '#1e1e24', 1); R(W / 2 - 9, 4, 18, 12, '#2a5a8a'); R(W / 2 - 8, 5, 8, 4, '#5a9ad8'); R(W / 2 - 1, 18, 2, 4, '#2a2a30');   // monitor
    R(W / 2 - 8, 25, 16, 3, '#3a3a40'); for (let i = 0; i < 7; i++) R(W / 2 - 7 + i * 2, 26, 1, 1, '#6a6a72');   // keyboard
    R(W / 2 + 10, 25, 3, 2, '#3a3a40');   // mouse
    box(W - 8, 8, 6, 14, '#2a2a30', 1); R(W - 6, 10, 1, 1, '#4ae04a');   // the tower
    R(2, 34, 3, H - 34, sh(WOOD, 0.65)); R(W - 5, 34, 3, H - 34, sh(WOOD, 0.65));
  });
  make('mirror', 10, 20, ({ R, P, box, W, H }) => {
    box(0, 0, W, 32, '#c8a050', 2);
    R(2, 2, W - 4, 28, '#9ab8d0'); R(3, 3, W - 6, 26, '#b8d4e8');
    for (let i = 0; i < 8; i++) P(5 + i, 6 + i, '#f4fbff'); for (let i = 0; i < 4; i++) P(5 + i, 12 + i, '#e0f0fa');   // reflections
    R(W / 2 - 3, 32, 6, H - 32, '#8a6a30'); R(W / 2 - 5, H - 2, 10, 2, '#6a4a20');
  });
  make('bench', 30, 12, ({ R, box, grain, W, H }) => {
    box(2, 0, W - 4, 6, WOODL, 1); grain(3, 1, W - 6, 4, WOODL, 2);
    for (let i = 0; i < 3; i++) R(3, 8 + i * 3, W - 6, 2, i % 2 ? WOODL : sh(WOODL, 0.92));   // seat slats
    R(3, 8, W - 6, 1, sh(WOODL, 1.2));
    for (const lx of [4, W - 7]) { R(lx, 6, 3, H - 6, '#2a2a30'); R(lx, 6, 1, H - 6, '#5a5a62'); }   // cast iron legs
  });
  make('trough', 30, 12, ({ R, box, W, H }) => {
    box(1, 4, W - 2, H - 4, '#7b4f2a', 2);
    R(4, 6, W - 8, 6, '#3a6a9a'); R(4, 6, W - 8, 2, '#6aa0d8'); R(7, 7, 6, 1, '#c8e4f8');
    for (const lx of [3, W - 6]) R(lx, H - 2, 3, 2, '#4a2e16');
  });
}

G.furnitureHD = { get(name) { if (!Object.keys(ART).length) build(); return ART[name] || null; }, names: () => Object.keys(ART) };
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  if (s) {
    const img = G.furnitureHD.get(o.def.sprite);
    if (img && img.width === s.w * 2) { ctx.drawImage(img, Math.round(o.x - s.ax), Math.round(o.y - s.ay), s.w, s.h); return; }
  }
  return _dd.call(this, ctx, o, s, scene);
};
})();
