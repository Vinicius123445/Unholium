'use strict';
// Shop signs stand out front on two posts (like the wooden signs in the country), instead of boards painted
// on the wall: a solid object you walk around and can read ([E]), with the trade's colors and name.
(() => {
G.signposts = true;
const A = G.assets;
const key = (i) => 'shopsign_' + i;
G.SHOP_SIGNS.forEach(([, s], i) => { if (s.text) G.DECOR[key(i)] = { sprite: key(i), solid: true, interact: 'sign' }; });
// lettering: a crisp 3x5 pixel font (the old one was a big font squeezed into the board, and blurred)
const ROWS = {
  A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.', E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..',
  G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#', I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..', Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#',
  S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.', U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###', 0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.',
  4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.', 6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
  '/': '..# ..# .#. #.. #..', '-': '... ... ### ... ...', '&': '.#. #.# .#. #.# .##', '.': '... ... ... ... .#.',
};
const FONT = {};
for (const k in ROWS) FONT[k] = ROWS[k].replace(/ /g, '');
const glyph = (ch) => FONT[ch] || null;
const textWidth = (t) => [...t].reduce((n, ch) => n + (ch === ' ' ? 3 : 4), 0) - 1;
const letter = (x, t, x0, y0, col, shadow) => {
  let cx = x0;
  for (const ch of t) {
    if (ch === ' ') { cx += 3; continue; }
    const g = glyph(ch.toUpperCase());
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '#') { const px = cx + (i % 3), py = y0 + Math.floor(i / 3); if (shadow) { x.fillStyle = shadow; x.fillRect(px, py + 1, 1, 1); } x.fillStyle = col; x.fillRect(px, py, 1, 1); }
    cx += 4;
  }
};
const art = () => {
  G.SHOP_SIGNS.forEach(([, s], i) => {
    if (!s.text) return;
    const text = G.i18n.plain(G.i18n.t(s.text));   // (the pixel font has no accents)
    const tw = textWidth(text), W = Math.max(28, tw + 10), H = 24, { c, x } = A.mk(W, H);
    x.fillStyle = '#4a3020'; x.fillRect(4, 12, 2, 12); x.fillRect(W - 6, 12, 2, 12);         // posts
    x.fillStyle = '#6a4a30'; x.fillRect(4, 12, 1, 12); x.fillRect(W - 6, 12, 1, 12);
    x.fillStyle = '#2e1c12'; x.fillRect(4, 22, 2, 2); x.fillRect(W - 6, 22, 2, 2);
    x.fillStyle = '#1a1214'; x.fillRect(1, 1, W - 2, 13);                                    // board with a frame
    x.fillStyle = s.bg || '#5a3a22'; x.fillRect(2, 2, W - 4, 11);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(2, 2, W - 4, 1);
    x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(2, 11, W - 4, 2);
    if (A.outline) A.outline(c);   // (before the lettering, or the outline eats the letters)
    letter(x, text, Math.floor((W - tw) / 2), 5, s.fg || '#ffffff', 'rgba(0,0,0,0.45)');
    A.sprites[key(i)] = { img: c, ax: Math.floor(W / 2), ay: H - 1, w: W, h: H };
  });
};
const _init = A.init; A.init = function () { _init.call(this); art(); };
G.events.on('languageChanged', () => { if (A.mk) art(); });   // (the boards are drawn once: a new language repaints them)
// out front of every shop or public building: beside the door, never in the doorway
const place = (m, only) => {
  const shop = new Set(); G.SHOP_SIGNS.forEach(([rx], i) => shop.add(i));
  for (const b of only ? [only] : m.buildings) {
    if (b.floorOf || b.destroyed) continue;
    const i = G.SHOP_SIGNS.findIndex(([rx]) => rx.test(b.name));
    if (i < 0 || !G.SHOP_SIGNS[i][1].text) continue;
    if (!G.DECOR[key(i)]) G.DECOR[key(i)] = { sprite: key(i), solid: true, interact: 'sign' };   // (a shop that registered after this file)
    const y = b.doorY + 2;   // a step out from the wall, so the board does not cover the windows
    for (const dx of [2, -2, 3, -3]) {
      const x = b.doorX + dx;
      if (!m.inBounds(x, y) || m.isSolidTile(x, y) || m.decorsAt(x, y).length) continue;
      const t = m.get(x, y);
      if (t === G.T.asphalt || t === G.T.road_line || t === G.T.road_line_v || t === G.T.door || G.TILES[t].water) continue;
      if (Object.values(m.points).some((p) => p && !Array.isArray(p) && p.x === x && p.y === y)) continue;
      m.addDecor(key(i), x, y);
      m.signs[x + ',' + y] = `${b.name}.`;
      break;
    }
  }
};
G.placeSign = place;
for (const id of Object.keys(G.MAPGEN)) { const gen = G.MAPGEN[id]; G.MAPGEN[id] = () => { const m = gen(); if (!m.meta.floorOf && !m.meta.indoor) place(m); return m; }; }
})();
