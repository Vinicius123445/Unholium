'use strict';
// Procedural pixel-art generator. Every texture, sprite, character and icon is drawn here,
// so the game ships with zero image files. To use hand-made art later, load an Image into the
// same caches (tiles[name], sprites[name], icons[name]) with the same sizes/anchors.

G.assets = (() => {
  const TS = 16;
  const tiles = {};    // name -> array of canvases (variants or animation frames)
  const sprites = {};  // name -> { img, ax, ay, frames? }
  const icons = {};    // name -> canvas 16x16
  const charCache = {};
  const animalCache = {};
  const whiteCache = new WeakMap();

  // ---------- helpers ----------
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c, x };
  }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, f) {
    const [r, g, b] = hexToRgb(hex);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
    return '#' + c(0) + c(1) + c(2);
  }
  const P = (x, px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
  const R = (x, px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  function speckle(x, rng, w, h, cols, n) {
    for (let i = 0; i < n; i++) P(x, rng.int(0, w - 1), rng.int(0, h - 1), rng.pick(cols));
  }
  function ell(x, cx, cy, rx, ry, col) {
    x.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
      x.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
    }
  }
  function line(x, x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      P(x, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), col);
    }
  }
  // Adds a 1px dark outline around opaque pixels (improves readability of sprites).
  function outline(c, col = [22, 16, 26, 230]) {
    const x = c.getContext('2d');
    const img = x.getImageData(0, 0, c.width, c.height);
    const d = img.data, w = c.width, h = c.height;
    const src = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let xx = 0; xx < w; xx++) {
        const i = y * w + xx;
        if (src[i]) continue;
        if ((xx > 0 && src[i - 1]) || (xx < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) {
          d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = col[3];
        }
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function tileSet(name, count, fn, seed) {
    const arr = [];
    for (let v = 0; v < count; v++) {
      const { c, x } = mk(TS, TS);
      fn(x, new G.RNG((seed || G.util.hashString(name)) + v * 7919), v);
      arr.push(c);
    }
    tiles[name] = arr;
  }
  function sprite(name, w, h, ax, ay, fn, opts = {}) {
    const { c, x } = mk(w, h);
    fn(x, new G.RNG(G.util.hashString(name)));
    if (opts.outline !== false) outline(c);
    sprites[name] = { img: c, ax, ay, w, h };
  }

  // ---------- terrain tiles ----------
  function genTiles() {
    tileSet('grass', 4, (x, r, v) => {
      R(x, 0, 0, 16, 16, '#4f8f3c');
      speckle(x, r, 16, 16, ['#5ea548', '#457f34', '#4a8838'], 40);
      for (let i = 0; i < 4; i++) { const px = r.int(0, 15), py = r.int(1, 15); P(x, px, py, '#6bb552'); P(x, px, py - 1, '#5ea548'); }
      if (v === 3) for (let i = 0; i < 3; i++) P(x, r.int(1, 14), r.int(1, 14), r.pick(['#f4f0d8', '#f2d45c', '#d8708a']));
    });
    tileSet('darkgrass', 4, (x, r, v) => {
      R(x, 0, 0, 16, 16, '#2f5c2b');
      speckle(x, r, 16, 16, ['#386b32', '#284f25', '#2b5527'], 45);
      for (let i = 0; i < 3; i++) { const px = r.int(0, 15), py = r.int(1, 15); P(x, px, py, '#457c3b'); }
      if (v === 3) { P(x, r.int(2, 13), r.int(2, 13), '#b0473a'); }
    });
    tileSet('dirt', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#86643f');
      speckle(x, r, 16, 16, ['#957149', '#765636', '#6d4f31'], 40);
      speckle(x, r, 16, 16, ['#a08a6a'], 3);
    });
    tileSet('path', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#b39566');
      speckle(x, r, 16, 16, ['#c4a674', '#a3865a', '#ab8d5f'], 40);
      speckle(x, r, 16, 16, ['#8f7a5a'], 4);
    });
    tileSet('cobble', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#5a5650');
      for (let row = 0; row < 4; row++) {
        let px = row % 2 ? -3 : 0;
        while (px < 16) {
          const w = r.int(4, 6);
          const base = r.pick(['#8d8880', '#98928a', '#a29d94', '#878279']);
          R(x, px + 1, row * 4 + 1, w - 1, 3, base);
          R(x, px + 1, row * 4 + 1, w - 1, 1, shade(base, 1.12));
          R(x, px + 1, row * 4 + 3, w - 1, 1, shade(base, 0.85));
          px += w;
        }
      }
    });
    tileSet('plaza', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#bdb39e');
      speckle(x, r, 16, 16, ['#c8bea9', '#b1a791'], 25);
      R(x, 0, 0, 16, 1, '#a39983'); R(x, 0, 0, 1, 16, '#a39983');
      R(x, 0, 8, 16, 1, '#ada38d'); R(x, 8, 0, 1, 16, '#ada38d');
    });
    tileSet('sand', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#d8c38c');
      speckle(x, r, 16, 16, ['#e3d09c', '#c9b27a', '#d0ba82'], 40);
    });
    tileSet('darksand', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#7d705c');
      speckle(x, r, 16, 16, ['#8a7c66', '#6e6250', '#756852'], 45);
    });
    tileSet('ash', 4, (x, r, v) => {
      R(x, 0, 0, 16, 16, '#3d3538');
      speckle(x, r, 16, 16, ['#4a4044', '#2f292b', '#433a3e'], 50);
      if (v === 2) P(x, r.int(1, 14), r.int(1, 14), '#9a3a22');
    });
    tileSet('darkstone', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#2e2a2d');
      speckle(x, r, 16, 16, ['#363135', '#262325'], 30);
      R(x, 0, 0, 16, 1, '#1e1b1d'); R(x, 0, 0, 1, 16, '#1e1b1d');
      R(x, 0, 8, 16, 1, '#232023'); R(x, 8, 0, 1, 8, '#232023');
    });
    // water: 4 animation frames
    for (const [name, base, hi, lo] of [['water', '#2b67a8', '#4a89c8', '#245a95'], ['deepwater', '#1f4d84', '#336aa5', '#1a426f']]) {
      const frames = [];
      const r0 = new G.RNG(name);
      const ripples = [];
      for (let i = 0; i < 6; i++) ripples.push([r0.int(0, 15), r0.int(0, 15), r0.int(2, 4)]);
      for (let f = 0; f < 4; f++) {
        const { c, x } = mk(16, 16);
        R(x, 0, 0, 16, 16, base);
        const r = new G.RNG(name + 'n');
        speckle(x, r, 16, 16, [lo], 20);
        for (const [rx, ry, len] of ripples) {
          for (let i = 0; i < len; i++) P(x, (rx + i + f * 2) % 16, (ry + (f > 1 ? 1 : 0)) % 16, hi);
        }
        frames.push(c);
      }
      tiles[name] = frames;
    }
    tileSet('woodfloor', 2, (x, r) => {
      for (let row = 0; row < 4; row++) {
        const col = r.pick(['#8a5a30', '#93633a', '#7f5229', '#875830']);
        R(x, 0, row * 4, 16, 4, col);
        R(x, 0, row * 4 + 3, 16, 1, '#5e3b1d');
        P(x, r.int(1, 14), row * 4 + 1, shade(col, 0.8));
        R(x, (r.int(0, 15) + row * 5) % 16, row * 4, 1, 3, '#5e3b1d');
      }
    });
    tileSet('stonefloor', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#7f7b74');
      speckle(x, r, 16, 16, ['#88847c', '#77736c'], 30);
      R(x, 0, 0, 16, 1, '#6a665f'); R(x, 0, 0, 1, 16, '#6a665f'); R(x, 0, 8, 16, 1, '#6a665f'); R(x, 8, 0, 1, 16, '#6a665f');
    });
    tileSet('carpet', 1, (x) => {
      R(x, 0, 0, 16, 16, '#7a2533');
      for (let i = 0; i < 16; i += 4) { P(x, i, 0, '#9a3a45'); P(x, i + 2, 8, '#9a3a45'); }
      P(x, 8, 4, '#c9a14a'); P(x, 0, 12, '#c9a14a');
    });
    tileSet('field', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#6b4a2b');
      for (let y = 0; y < 16; y += 4) { R(x, 0, y, 16, 1, '#5a3d22'); R(x, 0, y + 1, 16, 1, '#7c5833'); }
      speckle(x, r, 16, 16, ['#61432a'], 10);
    });
    tileSet('wheat', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#6b4a2b');
      for (let px = 0; px < 16; px += 2) {
        const h = r.int(7, 12), top = 15 - h;
        R(x, px, top, 1, h + 1, r.pick(['#c9a33c', '#b8952e', '#d4ad44']));
        P(x, px, top, '#f0d470'); P(x, px, top + 1, '#e3c25a');
      }
    });
    tileSet('cabbage', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#6b4a2b');
      for (let y = 0; y < 16; y += 4) R(x, 0, y, 16, 1, '#5a3d22');
      for (const [cx, cy] of [[4, 4], [12, 4], [4, 12], [12, 12]]) {
        ell(x, cx, cy, 2, 2, '#5aa048'); P(x, cx, cy - 1, '#7cc060');
      }
    });
    tileSet('wall_stone', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#4d4a46');
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let px = -off; px < 16; px += 8) {
          const col = r.pick(['#8a857c', '#948f85', '#7f7a72']);
          R(x, px + 1, row * 4 + 1, 7, 3, col);
          R(x, px + 1, row * 4 + 1, 7, 1, shade(col, 1.1));
        }
      }
    });
    tileSet('wall_wood', 2, (x, r) => {
      for (let px = 0; px < 16; px += 4) {
        const col = r.pick(['#6e4724', '#7a5029', '#734a26']);
        R(x, px, 0, 4, 16, col);
        R(x, px, 0, 1, 16, '#4a2f16');
        P(x, px + 2, r.int(2, 13), shade(col, 0.8));
      }
      R(x, 0, 0, 16, 2, '#4a2f16'); R(x, 0, 14, 16, 2, '#4a2f16');
    });
    tileSet('wall_plaster', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#ddd3bb');
      speckle(x, r, 16, 16, ['#d2c8b0', '#e6dcc4'], 20);
      R(x, 0, 0, 16, 2, '#5a3a1f'); R(x, 0, 14, 16, 2, '#5a3a1f'); R(x, 0, 0, 2, 16, '#5a3a1f');
    });
    tileSet('wall_dark', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#1c191b');
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 4 : 0;
        for (let px = -off; px < 16; px += 8) {
          const col = r.pick(['#3a3438', '#332e31', '#403a3e']);
          R(x, px + 1, row * 4 + 1, 7, 3, col);
        }
      }
      if (r.chance(0.5)) P(x, r.int(2, 13), r.int(2, 13), '#6a1e1e');
    });
    tileSet('citywall', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#3f3c38');
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? 5 : 0;
        for (let px = -off; px < 16; px += 10) {
          const col = r.pick(['#77726a', '#6e6961', '#807a71']);
          R(x, px + 1, row * 5 + 1, 9, 4, col);
          R(x, px + 1, row * 5 + 1, 9, 1, shade(col, 1.12));
        }
      }
      R(x, 0, 15, 16, 1, '#2c2a27');
    });
    tileSet('cliff', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#6f6a60');
      speckle(x, r, 16, 16, ['#7c776c', '#625d54', '#58534b'], 50);
      line(x, r.int(0, 15), 0, r.int(0, 15), 15, '#4f4b44');
    });
    tileSet('bridge', 1, (x) => {
      for (let px = 0; px < 16; px += 4) { R(x, px, 0, 4, 16, px % 8 ? '#9a6a3a' : '#a5744a'); R(x, px, 0, 1, 16, '#4a3420'); }
      R(x, 0, 0, 16, 2, '#5e4022'); R(x, 0, 14, 16, 2, '#5e4022');
    });
    tileSet('dock', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#24518a');
      for (let y = 0; y < 16; y += 4) { R(x, 0, y, 16, 3, r.pick(['#8a6338', '#94693c', '#7f5a32'])); P(x, r.int(1, 14), y + 1, '#5e4022'); }
    });
    // overlays drawn on top of a base tile (see TILE defs "over")
    tileSet('fence', 1, (x) => {
      R(x, 2, 4, 2, 10, '#6b4423'); R(x, 12, 4, 2, 10, '#6b4423');
      R(x, 0, 6, 16, 2, '#8a5a2e'); R(x, 0, 10, 16, 2, '#8a5a2e');
      R(x, 0, 6, 16, 1, '#a06c3a');
    });
    tileSet('hedge', 2, (x, r) => {
      ell(x, 8, 8, 8, 7, '#2f6e2e');
      speckle(x, r, 16, 14, ['#3b8238', '#285f27', '#45903f'], 40);
    });
    // burnt / ruined terrain (fire & destruction)
    tileSet('burnt_grass', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#2e2a24');
      speckle(x, r, 16, 16, ['#3a342c', '#24201c', '#3e3a2a', '#2a3020'], 50);
      if (r.chance(0.5)) P(x, r.int(1, 14), r.int(1, 14), '#8a3a1a');
    });
    tileSet('burnt_floor', 2, (x, r) => {
      for (let row = 0; row < 4; row++) {
        R(x, 0, row * 4, 16, 4, r.pick(['#2a201a', '#32261e', '#241c16']));
        R(x, 0, row * 4 + 3, 16, 1, '#16100c');
      }
      speckle(x, r, 16, 16, ['#4a3a2a', '#5a2a1a'], 8);
    });
    tileSet('ruin_wood', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#26201a');
      for (let i = 0; i < 3; i++) { const y = r.int(1, 13); line(x, r.int(0, 4), y, r.int(10, 15), y + r.int(-2, 2), '#140e0a'); }
      speckle(x, r, 16, 16, ['#3a2e24', '#4a3a2a', '#7a3a1a'], 14);
    });
    tileSet('rubble', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#4a4640');
      for (let i = 0; i < 7; i++) ell(x, r.int(1, 14), r.int(1, 14), r.int(1, 2), 1, r.pick(['#6e6a62', '#5a5650', '#8a857c', '#3a2a20']));
    });
    tileSet('field_burnt', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#2e241c');
      for (let y = 0; y < 16; y += 4) R(x, 0, y, 16, 1, '#1e1812');
      speckle(x, r, 16, 16, ['#3a2e22', '#6a2a1a'], 10);
    });
    // ---- modern city ----
    const asphalt = (x, r) => { R(x, 0, 0, 16, 16, '#3e3e44'); speckle(x, r, 16, 16, ['#46464c', '#36363c', '#4a4a50'], 40); };
    tileSet('asphalt', 4, (x, r, v) => { asphalt(x, r); if (v === 3) line(x, r.int(0, 8), r.int(2, 13), r.int(8, 15), r.int(2, 13), '#2e2e34'); });
    tileSet('road_line', 2, (x, r) => { asphalt(x, r); R(x, 2, 0, 7, 1, '#e0c040'); R(x, 2, 1, 7, 1, '#b89a30'); });
    tileSet('road_line_v', 2, (x, r) => { asphalt(x, r); R(x, 0, 2, 1, 7, '#e0c040'); R(x, 1, 2, 1, 7, '#b89a30'); });
    tileSet('sidewalk', 3, (x, r) => {
      R(x, 0, 0, 16, 16, '#a8a49c');
      speckle(x, r, 16, 16, ['#b0aca4', '#9e9a92'], 25);
      R(x, 0, 0, 16, 1, '#8a867e'); R(x, 0, 0, 1, 16, '#8a867e'); R(x, 0, 8, 16, 1, '#96928a'); R(x, 8, 0, 1, 16, '#96928a');
    });
    tileSet('concrete', 3, (x, r) => { R(x, 0, 0, 16, 16, '#8a8780'); speckle(x, r, 16, 16, ['#94918a', '#807d76', '#7a7770'], 35); R(x, 0, 0, 16, 1, '#76736c'); });
    tileSet('tilefloor', 1, (x) => {
      R(x, 0, 0, 16, 16, '#d8d4c8');
      R(x, 0, 0, 8, 8, '#c8c4b8'); R(x, 8, 8, 8, 8, '#c8c4b8');
      R(x, 0, 0, 16, 1, '#b0aca0'); R(x, 0, 0, 1, 16, '#b0aca0');
    });
    tileSet('wall_brick', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#5a2a20');
      for (let row = 0; row < 5; row++) {
        const off = row % 2 ? 4 : 0;
        for (let px = -off; px < 16; px += 8) { const col = r.pick(['#8a4232', '#7a3a2a', '#944a38']); R(x, px + 1, row * 3 + 1, 7, 2, col); }
      }
    });
    tileSet('wall_concrete', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#7a7a80'); speckle(x, r, 16, 16, ['#84848a', '#707076'], 30);
      R(x, 0, 7, 16, 1, '#5a5a60'); R(x, 0, 15, 16, 1, '#5a5a60');
    });
    tileSet('wall_siding', 3, (x, r, v) => {
      const base = ['#d8d0b8', '#b8c8d8', '#d8c0b0'][v];
      for (let y = 0; y < 16; y += 3) { R(x, 0, y, 16, 2, base); R(x, 0, y + 2, 16, 1, shade(base, 0.8)); }
    });
    tileSet('wall_marble', 2, (x, r) => {
      R(x, 0, 0, 16, 16, '#ece8e0'); speckle(x, r, 16, 16, ['#e0dcd2', '#f4f2ec', '#d8d4ca'], 25);
      line(x, r.int(0, 15), 0, r.int(0, 15), 15, '#d0ccc2');
      R(x, 0, 0, 16, 1, '#c8c4ba'); R(x, 0, 15, 16, 1, '#c8c4ba');
    });
    tileSet('chainlink', 1, (x) => {
      R(x, 1, 2, 1, 13, '#6a6e76'); R(x, 14, 2, 1, 13, '#6a6e76'); R(x, 0, 2, 16, 1, '#8a8e96');
      for (let i = 0; i < 16; i += 3) { line(x, i, 3, i + 6, 14, 'rgba(160,165,175,0.7)'); line(x, i + 6, 3, i, 14, 'rgba(160,165,175,0.7)'); }
    });
    tileSet('ironfence', 1, (x) => {
      R(x, 0, 4, 16, 1, '#2a2a30'); R(x, 0, 12, 16, 1, '#2a2a30');
      for (let px = 1; px < 16; px += 3) { R(x, px, 2, 1, 12, '#2a2a30'); P(x, px, 1, '#c8a050'); }
    });
    // the same fences running north-south (picked by TileMap.drawTileInto from the neighbors)
    tileSet('fence_v', 1, (x) => {
      R(x, 6, 0, 2, 16, '#8a5a2e'); R(x, 9, 0, 2, 16, '#8a5a2e'); R(x, 6, 0, 1, 16, '#a06c3a');
      R(x, 5, 1, 7, 3, '#6b4423'); R(x, 5, 9, 7, 3, '#6b4423'); R(x, 5, 1, 7, 1, '#7d5230'); R(x, 5, 9, 7, 1, '#7d5230');
    });
    tileSet('chainlink_v', 1, (x) => {
      R(x, 7, 0, 2, 16, 'rgba(160,165,175,0.55)'); R(x, 7, 0, 1, 16, '#6a6e76');
      for (let i = 0; i < 16; i += 3) { P(x, 6, i, 'rgba(160,165,175,0.7)'); P(x, 9, i + 1, 'rgba(160,165,175,0.7)'); }
      R(x, 6, 0, 3, 2, '#8a8e96'); R(x, 6, 8, 3, 2, '#8a8e96');
    });
    tileSet('ironfence_v', 1, (x) => {
      R(x, 7, 0, 2, 16, '#2a2a30');
      for (let py = 1; py < 16; py += 3) { R(x, 6, py, 4, 1, '#2a2a30'); P(x, 9, py, '#c8a050'); }
    });
    for (const [name, base, hi] of [['pool', '#4ab0e0', '#9ae0f8']]) {
      const frames = [];
      for (let f = 0; f < 4; f++) {
        const { c, x } = mk(16, 16);
        R(x, 0, 0, 16, 16, base);
        for (let i = 0; i < 4; i++) { const yy = (i * 4 + f) % 16; R(x, (i * 5 + f * 2) % 12, yy, 4, 1, hi); }
        frames.push(c);
      }
      tiles[name] = frames;
    }
    tileSet('lot', 4, (x, r, v) => {
      R(x, 0, 0, 16, 16, '#6a665e'); speckle(x, r, 16, 16, ['#76726a', '#5e5a52', '#4a5a3a'], 45);
      if (v === 1) line(x, r.int(0, 15), r.int(0, 15), r.int(0, 15), r.int(0, 15), '#4a4640');
      if (v === 2) { P(x, r.int(2, 13), r.int(2, 13), '#c83030'); P(x, r.int(2, 13), r.int(2, 13), '#e8e4dc'); }
      if (v === 3) { P(x, r.int(2, 13), r.int(2, 13), '#5a8a3a'); P(x, r.int(2, 13), r.int(2, 13), '#5a8a3a'); }
    });
    tileSet('court', 1, (x) => { R(x, 0, 0, 16, 16, '#a0603a'); R(x, 0, 0, 16, 1, '#e8e4dc'); R(x, 0, 0, 1, 16, '#e8e4dc'); });
    tileSet('door', 1, (x) => {
      R(x, 0, 0, 16, 16, '#7f5229');
      R(x, 0, 0, 16, 3, '#3a2412');
      R(x, 3, 6, 10, 8, '#8a4a2a'); R(x, 4, 7, 8, 6, '#9a5a32');
    });
  }

  // ---------- decorations / furniture ----------
  function genSprites() {
    for (let v = 0; v < 3; v++) {
      sprite('oak' + v, 32, 38, 16, 37, (x, r) => {
        r = new G.RNG(100 + v);
        R(x, 14, 24, 5, 13, '#5b3a1e'); R(x, 14, 24, 2, 13, '#6e4826');
        P(x, 13, 36, '#5b3a1e'); P(x, 19, 36, '#5b3a1e');
        const greens = ['#2f6b2a', '#3c8233', '#4c9a3d'];
        ell(x, 16, 15, 14, 11, greens[0]);
        for (let i = 0; i < 6; i++) ell(x, r.int(8, 24), r.int(7, 20), r.int(4, 7), r.int(3, 5), greens[1]);
        for (let i = 0; i < 5; i++) ell(x, r.int(9, 22), r.int(5, 14), r.int(2, 4), r.int(2, 3), greens[2]);
        speckle(x, r, 32, 22, ['#62b14d'], 0);
        for (let i = 0; i < 14; i++) { const px = r.int(6, 26), py = r.int(4, 18); if (x.getImageData(px, py, 1, 1).data[3]) P(x, px, py, '#62b14d'); }
      });
    }
    for (let v = 0; v < 2; v++) {
      sprite('pine' + v, 22, 40, 11, 39, (x) => {
        R(x, 10, 32, 3, 8, '#4e331c');
        const cols = v ? ['#1d4a2a', '#265c35', '#30703f'] : ['#214f2c', '#2a6338', '#377a45'];
        for (let t = 0; t < 4; t++) {
          const top = 2 + t * 7, h = 12;
          for (let y = 0; y < h; y++) {
            const hw = Math.round((y / h) * (4 + t * 2));
            R(x, 11 - hw, top + y, hw * 2 + 1, 1, cols[0]);
            R(x, 11 - hw, top + y, Math.max(1, hw), 1, cols[1]);
            if (y % 3 === 0) P(x, 11 - hw + 1, top + y, cols[2]);
          }
        }
      });
    }
    // ---- modern props ----
    const car = (name, body, o = {}) => sprite(name, 30, 18, 15, 17, (x) => {
      const dk = shade(body, 0.7);
      R(x, 1, 6, 28, 8, body); R(x, 1, 13, 28, 2, dk);
      R(x, 7, 1, 15, 6, o.cab || body); R(x, 8, 2, 6, 4, '#8ab0d0'); R(x, 15, 2, 6, 4, '#8ab0d0'); P(x, 9, 2, '#d8eaf8');
      R(x, 1, 7, 2, 2, '#f8f0c0'); R(x, 27, 7, 2, 2, '#d03030');
      ell(x, 7, 15, 3, 2, '#1e1e22'); ell(x, 23, 15, 3, 2, '#1e1e22'); P(x, 7, 15, '#8a8a90'); P(x, 23, 15, '#8a8a90');
      if (o.siren) { R(x, 12, 0, 3, 1, '#d02828'); R(x, 15, 0, 3, 1, '#2850d0'); R(x, 2, 9, 26, 2, '#e8e4dc'); }
      if (o.wreck) { R(x, 8, 2, 13, 4, '#2a2a30'); R(x, 4, 7, 6, 4, '#5a3a20'); R(x, 18, 8, 7, 3, '#4a3020'); }
    });
    car('car_red', '#b83030'); car('car_blue', '#3058a8'); car('car_white', '#e0dcd4'); car('car_black', '#2a2a30'); car('car_gray', '#7a7e86');
    car('car_wreck', '#6a5a4a', { wreck: true }); car('police_car', '#22242a', { cab: '#e8e4dc', siren: true });
    sprite('limo', 46, 18, 23, 17, (x) => {
      R(x, 1, 6, 44, 8, '#1a1a1e'); R(x, 1, 13, 44, 2, '#0e0e10'); R(x, 7, 1, 32, 6, '#1a1a1e');
      for (let i = 0; i < 4; i++) R(x, 8 + i * 8, 2, 6, 4, '#3a4050');
      ell(x, 8, 15, 3, 2, '#0e0e10'); ell(x, 38, 15, 3, 2, '#0e0e10'); R(x, 1, 7, 2, 2, '#f8f0c0');
    });
    sprite('dumpster', 30, 18, 15, 17, (x) => {
      R(x, 1, 4, 28, 13, '#3a6a3a'); R(x, 0, 2, 30, 3, '#2a5a2a'); R(x, 3, 8, 24, 1, '#2a4a2a'); R(x, 3, 12, 24, 1, '#2a4a2a');
      P(x, 6, 1, '#8a8a70'); P(x, 20, 1, '#a0a080');
    });
    sprite('gas_pump', 12, 22, 6, 21, (x) => { R(x, 1, 2, 10, 20, '#c83030'); R(x, 2, 4, 8, 5, '#2a2a30'); R(x, 3, 5, 6, 3, '#60c0a0'); R(x, 0, 0, 12, 3, '#e8e4dc'); R(x, 10, 10, 2, 8, '#2a2a30'); R(x, 3, 12, 6, 2, '#e8e4dc'); });
    sprite('loose_tile', 16, 16, 8, 8, (x) => { R(x, 3, 3, 10, 10, '#7a7770'); line(x, 3, 3, 12, 12, '#4a4840'); line(x, 12, 3, 6, 9, '#4a4840'); P(x, 8, 8, '#2a2820'); }, { outline: false });
    sprite('laundry_cart', 16, 14, 8, 13, (x) => { R(x, 1, 3, 14, 9, '#8a8e96'); R(x, 2, 1, 12, 4, '#e8e4dc'); R(x, 4, 0, 4, 2, '#d8782a'); R(x, 9, 1, 4, 2, '#c8c8d0'); P(x, 3, 13, '#2a2a30'); P(x, 12, 13, '#2a2a30'); });
    sprite('security_door', 32, 24, 16, 23, (x) => { R(x, 0, 0, 32, 24, '#4a4e56'); for (let i = 2; i < 32; i += 4) R(x, i, 2, 2, 20, '#2a2e36'); R(x, 0, 10, 32, 3, '#6a6e76'); R(x, 26, 9, 4, 5, '#d02828'); P(x, 27, 10, '#40e040'); });
    sprite('crib', 16, 15, 8, 14, (x) => { R(x, 1, 2, 14, 11, '#c8a070'); R(x, 2, 3, 12, 8, '#f0e8d8'); R(x, 4, 4, 4, 3, '#e8c0a0'); R(x, 4, 7, 9, 4, '#a8c8e8'); R(x, 4, 7, 9, 1, '#c8e0f0'); for (let i = 2; i < 14; i += 2) R(x, i, 9, 1, 4, '#a07848'); R(x, 1, 2, 14, 1, '#e0c090'); R(x, 1, 12, 14, 1, '#8a6038'); R(x, 2, 13, 1, 2, '#7a5030'); R(x, 13, 13, 1, 2, '#7a5030'); });
    sprite('trough', 30, 12, 15, 11, (x) => { R(x, 1, 3, 28, 8, '#7b4f2a'); R(x, 3, 4, 24, 4, '#4a8ad8'); R(x, 3, 4, 24, 1, '#8ac0f0'); R(x, 2, 10, 3, 2, '#5b3a1e'); R(x, 25, 10, 3, 2, '#5b3a1e'); });
    sprite('trashcan', 10, 14, 5, 13, (x) => { R(x, 1, 3, 8, 11, '#6a6e76'); R(x, 0, 1, 10, 3, '#8a8e96'); R(x, 3, 5, 1, 7, '#4a4e56'); R(x, 6, 5, 1, 7, '#4a4e56'); });
    sprite('bench', 30, 12, 15, 11, (x) => { R(x, 1, 2, 28, 3, '#8a5a2e'); R(x, 1, 6, 28, 3, '#9a6a3a'); R(x, 3, 9, 2, 3, '#2a2a30'); R(x, 25, 9, 2, 3, '#2a2a30'); });
    sprite('hydrant', 8, 12, 4, 11, (x) => { R(x, 2, 3, 4, 9, '#d02828'); R(x, 1, 1, 6, 2, '#e04040'); R(x, 0, 6, 8, 2, '#b02020'); P(x, 3, 4, '#f08080'); });
    sprite('mailbox', 8, 16, 4, 15, (x) => { R(x, 3, 8, 2, 8, '#4a3a2a'); R(x, 0, 2, 8, 6, '#3058a8'); R(x, 0, 2, 8, 1, '#4a70c8'); R(x, 7, 1, 1, 3, '#d02828'); });
    sprite('vending', 14, 24, 7, 23, (x) => { R(x, 0, 0, 14, 24, '#c82828'); R(x, 2, 2, 8, 16, '#2a3040'); for (let i = 0; i < 4; i++) R(x, 3, 3 + i * 4, 6, 2, ['#e0c040', '#40a0e0', '#e06040', '#60c060'][i]); R(x, 11, 6, 2, 4, '#c8c8c8'); R(x, 2, 20, 8, 2, '#1e1e22'); });
    sprite('fridge', 14, 24, 7, 23, (x) => { R(x, 0, 0, 14, 24, '#e8e8ec'); R(x, 0, 9, 14, 1, '#a8a8b0'); R(x, 11, 3, 1, 4, '#8a8a90'); R(x, 11, 12, 1, 6, '#8a8a90'); R(x, 0, 23, 14, 1, '#a8a8b0'); });
    sprite('couch', 30, 16, 15, 15, (x) => { R(x, 0, 2, 30, 6, '#5a6a8a'); R(x, 0, 7, 30, 7, '#6a7a9a'); R(x, 0, 2, 4, 12, '#4a5a7a'); R(x, 26, 2, 4, 12, '#4a5a7a'); R(x, 15, 8, 1, 6, '#4a5a7a'); });
    sprite('tv', 14, 14, 7, 13, (x) => { R(x, 0, 0, 14, 9, '#1e1e22'); R(x, 1, 1, 12, 7, '#3a5a8a'); P(x, 3, 2, '#8ab0e0'); R(x, 6, 9, 2, 3, '#2a2a30'); R(x, 3, 12, 8, 2, '#2a2a30'); });
    sprite('desk', 30, 16, 15, 15, (x) => { R(x, 0, 4, 30, 4, '#7a5a3a'); R(x, 1, 8, 4, 8, '#5a3a20'); R(x, 25, 8, 4, 8, '#5a3a20'); R(x, 10, 0, 9, 5, '#1e1e22'); R(x, 11, 1, 7, 3, '#4a8ad8'); });
    sprite('toolbench', 30, 18, 15, 17, (x) => { R(x, 0, 8, 30, 4, '#8a3a2a'); R(x, 1, 12, 3, 6, '#4a4a52'); R(x, 26, 12, 3, 6, '#4a4a52'); R(x, 2, 0, 26, 8, '#6a6e76'); for (let i = 0; i < 5; i++) R(x, 4 + i * 5, 2, 1, 4, '#c8c8d0'); });
    sprite('plant', 10, 16, 5, 15, (x) => { R(x, 2, 10, 6, 6, '#a0603a'); ell(x, 5, 6, 4, 5, '#3a8a3a'); P(x, 3, 4, '#5aaa48'); P(x, 7, 6, '#5aaa48'); });
    sprite('trash', 16, 16, 8, 8, (x, r) => { for (let i = 0; i < 5; i++) { const px = r.int(1, 13), py = r.int(1, 13); R(x, px, py, 2, 1, r.pick(['#e8e4dc', '#c83030', '#4a8ad8', '#8a8e96', '#5a3a20'])); } }, { outline: false });
    sprite('manhole', 16, 16, 8, 8, (x) => { ell(x, 8, 8, 6, 5, '#2a2a30'); ell(x, 8, 8, 5, 4, '#4a4a52'); line(x, 4, 8, 12, 8, '#2a2a30'); line(x, 8, 5, 8, 11, '#2a2a30'); }, { outline: false });
    sprite('deadtree', 24, 32, 12, 31, (x) => {
      R(x, 11, 12, 3, 20, '#4a3f38');
      line(x, 12, 14, 4, 6, '#4a3f38'); line(x, 12, 12, 20, 3, '#4a3f38');
      line(x, 6, 8, 3, 2, '#4a3f38'); line(x, 18, 5, 22, 6, '#4a3f38'); line(x, 12, 12, 13, 1, '#4a3f38');
      P(x, 12, 20, '#2a2420');
    });
    sprite('bush', 16, 13, 8, 12, (x, r) => {
      ell(x, 8, 7, 7, 5, '#2f6e2a'); ell(x, 6, 6, 4, 3, '#3c8233'); ell(x, 10, 5, 3, 2, '#4c9a3d');
      speckle(x, r, 0, 0, [], 0);
    });
    sprite('berrybush', 16, 13, 8, 12, (x, r) => {
      ell(x, 8, 7, 7, 5, '#2f6e2a'); ell(x, 6, 6, 4, 3, '#3c8233');
      for (let i = 0; i < 6; i++) P(x, r.int(3, 12), r.int(3, 10), '#c0303a');
    });
    sprite('rock', 14, 10, 7, 9, (x) => {
      ell(x, 7, 5, 6, 4, '#86827a'); ell(x, 6, 4, 4, 2, '#a19d94'); R(x, 2, 8, 10, 1, '#5f5c56');
    });
    sprite('boulder', 28, 20, 14, 19, (x) => {
      ell(x, 14, 11, 13, 8, '#7a766e'); ell(x, 11, 8, 8, 5, '#938f86'); ell(x, 9, 6, 4, 2, '#a8a39a'); R(x, 4, 18, 20, 1, '#55524c');
    });
    sprite('stump', 12, 9, 6, 8, (x) => {
      R(x, 1, 3, 10, 6, '#5b3a1e'); ell(x, 6, 3, 5, 2, '#b08a5a'); P(x, 6, 3, '#8a6a42');
    });
    sprite('log', 26, 9, 13, 8, (x) => {
      R(x, 2, 1, 22, 7, '#5b3a1e'); R(x, 2, 1, 22, 2, '#6e4826'); ell(x, 2, 4, 2, 3, '#b08a5a');
    });
    sprite('barrel', 12, 14, 6, 13, (x) => {
      R(x, 1, 2, 10, 11, '#7b4f2a'); R(x, 2, 2, 2, 11, '#8e5f34');
      R(x, 1, 4, 10, 1, '#3e3e44'); R(x, 1, 10, 10, 1, '#3e3e44');
      ell(x, 6, 2, 5, 1, '#5e3c20');
    });
    sprite('crate', 14, 14, 7, 13, (x) => {
      R(x, 0, 0, 14, 14, '#a0733f'); R(x, 0, 0, 14, 2, '#b8874c');
      R(x, 0, 0, 14, 1, '#6b4a26'); R(x, 0, 13, 14, 1, '#6b4a26'); R(x, 0, 0, 1, 14, '#6b4a26'); R(x, 13, 0, 1, 14, '#6b4a26');
      line(x, 1, 1, 12, 12, '#7a5530');
    });
    sprite('well', 22, 28, 11, 27, (x) => {
      ell(x, 11, 22, 10, 5, '#7d7a74'); ell(x, 11, 21, 7, 3, '#1f2a3a');
      R(x, 2, 6, 2, 16, '#5b3a1e'); R(x, 18, 6, 2, 16, '#5b3a1e');
      for (let y = 0; y < 6; y++) R(x, 10 - y * 2, y + 1, 2 + y * 4, 1, y % 2 ? '#8e3a2a' : '#a8462f');
      R(x, 6, 10, 10, 1, '#3e2a18');
    });
    sprite('lamp', 8, 28, 4, 27, (x) => {
      R(x, 3, 8, 2, 20, '#2e2e33'); R(x, 1, 26, 6, 2, '#2e2e33');
      R(x, 1, 1, 6, 7, '#2e2e33'); R(x, 2, 2, 4, 5, '#f2d27a'); P(x, 3, 3, '#fff6c8');
    });
    sprite('darklamp', 8, 28, 4, 27, (x) => {
      R(x, 3, 8, 2, 20, '#1a1416'); R(x, 1, 26, 6, 2, '#1a1416');
      R(x, 1, 1, 6, 7, '#1a1416'); R(x, 2, 2, 4, 5, '#d0402a'); P(x, 3, 3, '#ff8a5a');
    });
    for (const [name, col] of [['stall_red', '#b83a3a'], ['stall_blue', '#3a5ab8'], ['stall_green', '#3a8a4a']]) {
      sprite(name, 32, 28, 16, 27, (x, r) => {
        R(x, 2, 8, 2, 20, '#5b3a1e'); R(x, 28, 8, 2, 20, '#5b3a1e');
        R(x, 1, 16, 30, 8, '#8a5a2e'); R(x, 1, 16, 30, 2, '#a0703c');
        for (let i = 0; i < 9; i++) ell(x, 4 + i * 3, 15, 1, 1, r.pick(['#d84a3a', '#e8c040', '#7cc060', '#e08a3a', '#c06ad0']));
        for (let i = 0; i < 8; i++) R(x, i * 4, 0, 4, 8, i % 2 ? col : '#ece4d0');
        R(x, 0, 7, 32, 1, shade(col, 0.6));
      });
    }
    sprite('sign', 12, 16, 6, 15, (x) => {
      R(x, 5, 6, 2, 10, '#5b3a1e'); R(x, 0, 1, 12, 7, '#9b6b3a'); R(x, 0, 1, 12, 1, '#b8874c');
      R(x, 2, 3, 8, 1, '#5b3a1e'); R(x, 2, 5, 6, 1, '#5b3a1e');
    });
    for (const [name, col] of [['bed', '#4a6aa8'], ['bed_red', '#a84a4a'], ['bed_green', '#4a8a5a']]) {
      sprite(name, 14, 22, 7, 21, (x) => {
        R(x, 0, 0, 14, 22, '#6b4423'); R(x, 1, 1, 12, 20, '#d8d2c4');
        R(x, 2, 2, 10, 4, '#f4f0e8'); R(x, 1, 8, 12, 13, col); R(x, 1, 8, 12, 1, shade(col, 1.2));
      });
    }
    sprite('table', 22, 14, 11, 13, (x) => {
      R(x, 0, 0, 22, 9, '#8a5a2e'); R(x, 0, 0, 22, 2, '#a0703c');
      R(x, 1, 9, 2, 5, '#5b3a1e'); R(x, 19, 9, 2, 5, '#5b3a1e');
      P(x, 6, 3, '#d8d2c4'); P(x, 7, 3, '#d8d2c4'); R(x, 13, 2, 2, 3, '#c8a050');
    });
    sprite('chair', 8, 11, 4, 10, (x) => {
      R(x, 1, 0, 6, 5, '#7a4f28'); R(x, 0, 5, 8, 2, '#8a5a2e'); R(x, 0, 7, 1, 4, '#5b3a1e'); R(x, 7, 7, 1, 4, '#5b3a1e');
    });
    sprite('counter', 32, 13, 16, 12, (x, r) => {
      R(x, 0, 2, 32, 11, '#6b4423'); R(x, 0, 0, 32, 3, '#8a5a2e');
      for (let i = 0; i < 4; i++) R(x, 3 + i * 7, 5, 5, 6, '#5b3a1e');
      P(x, r.int(2, 28), 0, '#e8c040');
    });
    sprite('shelf', 16, 24, 8, 23, (x, r) => {
      R(x, 0, 0, 16, 24, '#5b3a1e'); R(x, 1, 1, 14, 22, '#3e2614');
      for (let s = 0; s < 3; s++) {
        R(x, 1, 7 + s * 7, 14, 1, '#6b4423');
        for (let i = 0; i < 5; i++) R(x, 2 + i * 3, 2 + s * 7, 2, 5, r.pick(['#a84a4a', '#4a6aa8', '#c8a050', '#5a8a4a', '#8a5aa8', '#d8d2c4']));
      }
    });
    sprite('anvil', 14, 10, 7, 9, (x) => {
      R(x, 0, 0, 14, 3, '#55575e'); R(x, 0, 0, 14, 1, '#7a7d86'); R(x, 4, 3, 6, 4, '#45474d'); R(x, 2, 7, 10, 3, '#3a3c42');
    });
    sprite('forge', 22, 20, 11, 19, (x) => {
      R(x, 0, 4, 22, 16, '#5c5852'); R(x, 0, 4, 22, 2, '#77736b');
      R(x, 4, 8, 14, 8, '#2a1a12'); R(x, 5, 11, 12, 5, '#e0602a'); R(x, 7, 12, 8, 3, '#f8c040');
      R(x, 8, 0, 6, 4, '#4a4640');
    });
    sprite('haybale', 16, 12, 8, 11, (x, r) => {
      R(x, 0, 1, 16, 11, '#d8b45a'); R(x, 0, 1, 16, 2, '#e8c870');
      speckle(x, r, 16, 12, ['#c09a40'], 14); R(x, 0, 5, 16, 1, '#8a6a2a');
    });
    sprite('grave', 10, 14, 5, 13, (x) => {
      R(x, 1, 3, 8, 11, '#8a8780'); ell(x, 5, 3, 4, 3, '#8a8780'); R(x, 1, 3, 8, 1, '#a19d94');
      R(x, 4, 4, 2, 6, '#6a6760'); R(x, 2, 6, 6, 1, '#6a6760');
    });
    sprite('campfire', 14, 12, 7, 11, (x) => {
      line(x, 1, 10, 12, 7, '#5b3a1e'); line(x, 1, 7, 12, 10, '#6e4826');
      ell(x, 7, 6, 4, 4, '#e0602a'); ell(x, 7, 6, 2, 3, '#f8c040'); P(x, 7, 2, '#f8c040'); P(x, 7, 4, '#fff0a0');
    });
    sprite('fountain', 44, 32, 22, 31, (x) => {
      ell(x, 22, 20, 21, 10, '#8a857c'); ell(x, 22, 19, 18, 8, '#2f6fb0'); ell(x, 18, 17, 8, 3, '#4a89c8');
      R(x, 20, 4, 4, 15, '#a19d94'); ell(x, 22, 5, 5, 2, '#a19d94'); ell(x, 22, 4, 3, 1, '#4a89c8');
      R(x, 21, 0, 2, 4, '#8ab8e0');
    });
    sprite('statue', 16, 34, 8, 33, (x) => {
      R(x, 1, 24, 14, 10, '#7d7a74'); R(x, 1, 24, 14, 2, '#98948c');
      R(x, 5, 10, 6, 14, '#a8a49c'); ell(x, 8, 6, 3, 3, '#a8a49c'); R(x, 2, 11, 3, 2, '#a8a49c'); R(x, 11, 8, 2, 6, '#a8a49c');
      R(x, 12, 0, 1, 9, '#8a8780');
    });
    sprite('tent', 30, 24, 15, 23, (x) => {
      for (let y = 0; y < 20; y++) { const hw = Math.round(y * 0.7) + 1; R(x, 15 - hw, 3 + y, hw * 2, 1, y % 4 ? '#a08a64' : '#8e7a56'); }
      for (let y = 6; y < 23; y++) { const hw = Math.round((y - 6) * 0.25); R(x, 15 - hw, y, hw * 2 + 1, 1, '#2a1e14'); }
      R(x, 14, 0, 2, 4, '#5b3a1e');
    });
    sprite('altar', 26, 14, 13, 13, (x) => {
      R(x, 0, 3, 26, 11, '#8a857c'); R(x, 0, 2, 26, 3, '#d8d2c4'); R(x, 10, 2, 6, 12, '#a84a4a');
      R(x, 3, 0, 2, 3, '#f2e2a0'); R(x, 21, 0, 2, 3, '#f2e2a0');
    });
    sprite('pew', 26, 9, 13, 8, (x) => {
      R(x, 0, 0, 26, 3, '#6b4423'); R(x, 0, 3, 26, 3, '#8a5a2e'); R(x, 1, 6, 2, 3, '#5b3a1e'); R(x, 23, 6, 2, 3, '#5b3a1e');
    });
    // storage furniture (containers): dresser, register, locker, safe, filing cabinet, toolbox, cabinet, bag
    sprite('st_dresser', 14, 16, 7, 15, (x) => { R(x, 0, 0, 14, 16, '#7a5030'); for (let i = 0; i < 3; i++) { R(x, 1, 1 + i * 5, 12, 4, '#9a6a3a'); R(x, 6, 2 + i * 5, 2, 1, '#d8b060'); } R(x, 1, 15, 2, 1, '#4a2f16'); R(x, 11, 15, 2, 1, '#4a2f16'); });
    sprite('st_register', 14, 12, 7, 11, (x) => { R(x, 0, 6, 14, 6, '#3a3a40'); R(x, 2, 1, 10, 6, '#4a4a52'); R(x, 3, 2, 8, 2, '#60c080'); for (let i = 0; i < 3; i++) R(x, 3 + i * 3, 5, 2, 1, '#c8c8d0'); R(x, 1, 9, 12, 2, '#2a2a30'); });
    sprite('st_locker', 12, 20, 6, 19, (x) => { R(x, 0, 0, 12, 20, '#4a6a8a'); R(x, 6, 0, 1, 20, '#2a3a5a'); for (let i = 0; i < 3; i++) { R(x, 2, 2 + i * 2, 3, 1, '#2a3a5a'); R(x, 8, 2 + i * 2, 3, 1, '#2a3a5a'); } P(x, 4, 10, '#c8c8d0'); P(x, 8, 10, '#c8c8d0'); });
    sprite('st_safe', 14, 14, 7, 13, (x) => { R(x, 0, 0, 14, 14, '#3a3a40'); R(x, 1, 1, 12, 12, '#5a5a62'); ell(x, 7, 7, 3, 3, '#2a2a30'); ell(x, 7, 7, 1, 1, '#c8a050'); R(x, 11, 5, 1, 4, '#c8c8d0'); });
    sprite('st_filing', 12, 18, 6, 17, (x) => { R(x, 0, 0, 12, 18, '#8a8e96'); for (let i = 0; i < 4; i++) { R(x, 1, 1 + i * 4, 10, 3, '#a8acb4'); R(x, 4, 2 + i * 4, 4, 1, '#4a4a52'); } });
    sprite('st_toolbox', 14, 10, 7, 9, (x) => { R(x, 0, 3, 14, 7, '#c83030'); R(x, 0, 3, 14, 1, '#e05050'); R(x, 4, 0, 6, 1, '#2a2a30'); R(x, 4, 0, 1, 3, '#2a2a30'); R(x, 9, 0, 1, 3, '#2a2a30'); R(x, 6, 6, 2, 1, '#c8c8d0'); });
    sprite('st_cabinet', 14, 18, 7, 17, (x) => { R(x, 0, 0, 14, 18, '#8a6a4a'); R(x, 1, 1, 6, 16, '#a07a50'); R(x, 7, 1, 6, 16, '#a07a50'); P(x, 6, 9, '#d8b060'); P(x, 8, 9, '#d8b060'); });
    sprite('st_stash', 16, 9, 8, 8, (x) => { ell(x, 8, 5, 7, 4, '#3a4a3a'); R(x, 3, 2, 10, 1, '#2a3a2a'); R(x, 6, 0, 4, 2, '#1e1e22'); });
    sprite('chest', 14, 11, 7, 10, (x) => {
      R(x, 0, 2, 14, 9, '#7b4f2a'); ell(x, 7, 3, 6, 2, '#8e5f34'); R(x, 0, 5, 14, 1, '#c8a050');
      R(x, 2, 2, 1, 9, '#c8a050'); R(x, 11, 2, 1, 9, '#c8a050'); R(x, 6, 5, 2, 3, '#e8d070');
    });
    sprite('sack', 10, 10, 5, 9, (x) => {
      ell(x, 5, 6, 4, 3, '#a08a64'); R(x, 4, 1, 2, 3, '#8e7a56'); R(x, 3, 3, 4, 1, '#5b3a1e');
    });
    sprite('cart', 30, 20, 15, 19, (x) => {
      R(x, 2, 4, 24, 9, '#8a5a2e'); R(x, 2, 4, 24, 2, '#a0703c'); line(x, 26, 9, 30, 9, '#5b3a1e');
      ell(x, 8, 15, 4, 4, '#4a3020'); ell(x, 8, 15, 2, 2, '#8a5a2e'); ell(x, 20, 15, 4, 4, '#4a3020'); ell(x, 20, 15, 2, 2, '#8a5a2e');
    });
    sprite('boat', 44, 20, 22, 19, (x) => {
      for (let y = 0; y < 8; y++) R(x, 2 + y, 10 + y, 40 - y * 2, 1, y < 2 ? '#a0703c' : '#7b4f2a');
      R(x, 21, 0, 2, 12, '#5b3a1e'); for (let y = 1; y < 10; y++) R(x, 23, y, Math.round(y * 1.2), 1, '#e8e0cc');
    });
    sprite('skulls', 12, 8, 6, 7, (x) => {
      ell(x, 3, 4, 2, 2, '#d8d2c4'); ell(x, 8, 5, 2, 2, '#c8c2b4'); P(x, 2, 4, '#222'); P(x, 4, 4, '#222'); P(x, 7, 5, '#222'); P(x, 9, 5, '#222');
    });
    sprite('banner', 10, 30, 5, 29, (x) => {
      R(x, 4, 0, 2, 30, '#2a2226'); R(x, 0, 2, 10, 14, '#6a1e24'); R(x, 0, 16, 5, 3, '#6a1e24'); R(x, 5, 16, 5, 2, '#6a1e24');
      ell(x, 5, 8, 2, 2, '#c8a050');
    });
    // flat decorations (no outline, drawn into ground layer)
    sprite('flowers', 16, 16, 8, 8, (x, r) => {
      for (let i = 0; i < 5; i++) { const px = r.int(2, 13), py = r.int(2, 13); const c = r.pick(['#c4c0a8', '#b0a25e', '#94626c', '#84748e']); P(x, px, py, c); P(x, px + 1, py, c); P(x, px, py + 1, '#3f6438'); }
    }, { outline: false });
    sprite('tuft', 16, 16, 8, 8, (x, r) => {
      for (let i = 0; i < 3; i++) { const px = r.int(3, 12), py = r.int(5, 12); line(x, px, py, px - 1, py - 3, '#6bb552'); line(x, px + 1, py, px + 2, py - 3, '#5ea548'); }
    }, { outline: false });
    sprite('mushroom', 8, 8, 4, 7, (x) => {
      R(x, 3, 4, 2, 4, '#e8e0cc'); ell(x, 4, 3, 3, 2, '#9a7454'); P(x, 3, 2, '#b8957a'); R(x, 2, 4, 4, 1, '#d8a8a0');
    });
    sprite('chanterelle', 8, 8, 4, 7, (x) => {
      R(x, 3, 4, 2, 4, '#e8b040'); R(x, 1, 2, 6, 2, '#f0b830'); P(x, 1, 1, '#f8d060'); P(x, 6, 1, '#f8d060'); P(x, 2, 2, '#f8d878');
    });
    sprite('death_cap', 8, 8, 4, 7, (x) => {
      R(x, 3, 4, 2, 4, '#f0f0e8'); R(x, 2, 5, 4, 1, '#ffffff'); ell(x, 4, 3, 3, 2, '#c8d0a0'); P(x, 3, 2, '#e0e8c0'); R(x, 2, 7, 4, 1, '#e8e8d8');
    });
    sprite('fly_agaric', 8, 8, 4, 7, (x) => {
      R(x, 3, 4, 2, 4, '#f4f0e0'); ell(x, 4, 3, 3, 2, '#d82828'); P(x, 2, 2, '#fff'); P(x, 5, 2, '#fff'); P(x, 4, 4, '#fff'); P(x, 6, 3, '#fff');
    });
    sprite('magic_mushroom', 8, 8, 4, 7, (x) => {
      R(x, 2, 4, 1, 4, '#e0d4b8'); R(x, 5, 3, 1, 5, '#e0d4b8'); R(x, 1, 3, 3, 1, '#b08848'); P(x, 2, 2, '#c8a060'); R(x, 4, 2, 3, 1, '#b08848'); P(x, 5, 1, '#c8a060'); P(x, 5, 7, '#6a7ac8');
    });
    sprite('pebbles', 16, 16, 8, 8, (x, r) => {
      for (let i = 0; i < 4; i++) { const px = r.int(2, 13), py = r.int(2, 13); P(x, px, py, '#8a857c'); P(x, px + 1, py, '#a19d94'); }
    }, { outline: false });
    sprite('window', 10, 7, 5, 6, (x) => {
      R(x, 0, 0, 10, 7, '#3b2a1a'); R(x, 1, 1, 8, 5, '#89b4d6'); R(x, 5, 1, 1, 5, '#3b2a1a'); R(x, 1, 3, 8, 1, '#3b2a1a'); P(x, 2, 2, '#c8e0f0');
    }, { outline: false });
    sprite('window_lit', 10, 7, 5, 6, (x) => {
      R(x, 0, 0, 10, 7, '#3b2a1a'); R(x, 1, 1, 8, 5, '#f2c862'); R(x, 5, 1, 1, 5, '#3b2a1a'); R(x, 1, 3, 8, 1, '#3b2a1a'); P(x, 2, 2, '#fff0c0');
    }, { outline: false });
  }

  // ---------- characters ----------
  // look: {
  //   body: 'm' | 'f', skin, eyes, hair, hairStyle (index in HAIR_STYLES), facial: 0 none | 1 beard | 2 mustache | 3 stubble
  //   top: shirt | tunic | jacket | hoodie | vest | dress | robe, shirt (top color), shirt2 (secondary color)
  //   bottom: pants | shorts | skirt, pants (color), shoes, glasses: 'sun' | 'round'
  //   hat: hood | cowl | helmet | straw | cap | crown | bandana, hatColor, apron, armor, cape
  // }
  const HAIR_STYLES = ['Short', 'Long', 'Bald', 'Bun', 'Mohawk', 'Spiky', 'Bob', 'Ponytail', 'Afro', 'Undercut', 'Braids'];
  const TOP_STYLES = ['shirt', 'tshirt', 'longsleeve', 'tank', 'tunic', 'jacket', 'hoodie', 'vest', 'dress', 'robe'];
  const BOTTOM_STYLES = ['pants', 'shorts', 'skirt'];

  function drawHair(x, d, hs, H, Hd) {
    const back = d === 3, side = d === 1 || d === 2;
    const bx = d === 1 ? 9 : 4;
    const cap = () => R(x, 4, 1, 8, 3, H);
    switch (hs) {
      case 0:
        if (back) R(x, 4, 1, 8, 7, H);
        else { cap(); if (d === 0) { R(x, 4, 4, 1, 2, H); R(x, 11, 4, 1, 2, H); } else R(x, bx, 2, 3, 5, H); }
        break;
      case 1:
        if (back) R(x, 3, 1, 10, 10, H);
        else { cap(); if (d === 0) { R(x, 3, 3, 1, 8, H); R(x, 12, 3, 1, 8, H); R(x, 4, 4, 1, 2, H); R(x, 11, 4, 1, 2, H); } else R(x, d === 1 ? 9 : 3, 2, 4, 9, H); }
        break;
      case 2: break;
      case 3:
        drawHair(x, d, 0, H, Hd);
        if (back || d === 0) R(x, 6, 0, 4, 2, H); else R(x, d === 1 ? 10 : 3, 0, 3, 3, H);
        break;
      case 4:
        if (back) R(x, 7, 0, 2, 8, H);
        else if (d === 0) { R(x, 7, 0, 2, 3, H); P(x, 4, 3, Hd); P(x, 11, 3, Hd); }
        else { R(x, 5, 0, 6, 2, H); R(x, bx, 2, 3, 1, Hd); }
        break;
      case 5:
        drawHair(x, d, 0, H, Hd);
        for (const i of [4, 6, 8, 10]) P(x, i, 0, H);
        if (side) P(x, d === 1 ? 12 : 3, 2, H);
        break;
      case 6:
        if (back) R(x, 3, 1, 10, 8, H);
        else if (d === 0) { cap(); R(x, 3, 2, 2, 6, H); R(x, 11, 2, 2, 6, H); }
        else { cap(); R(x, d === 1 ? 9 : 3, 2, 4, 6, H); }
        break;
      case 7:
        drawHair(x, d, 0, H, Hd);
        if (back) R(x, 7, 8, 2, 5, H); else if (side) R(x, d === 1 ? 12 : 2, 3, 2, 6, H);
        break;
      case 8:
        if (back) R(x, 2, 0, 12, 9, H);
        else { R(x, 3, 0, 10, 2, H); R(x, 2, 1, 12, 3, H); if (d === 0) { R(x, 2, 4, 2, 3, H); R(x, 12, 4, 2, 3, H); } else R(x, d === 1 ? 9 : 2, 3, 5, 4, H); }
        break;
      case 9:
        if (back) { R(x, 4, 1, 8, 3, H); R(x, 4, 4, 8, 2, Hd); }
        else {
          R(x, 4, 1, 8, 2, H);
          if (d === 0) R(x, 4, 3, 5, 1, H); else if (d === 1) R(x, 4, 3, 3, 1, H); else R(x, 9, 3, 3, 1, H);
          if (side) R(x, bx, 3, 3, 2, Hd);
        }
        break;
      case 10:
        drawHair(x, d, 1, H, Hd);
        for (let y = 4; y < 11; y += 2) {
          if (d === 0) { P(x, 3, y, Hd); P(x, 12, y, Hd); }
          else if (back) { P(x, 5, y, Hd); P(x, 10, y, Hd); }
          else P(x, d === 1 ? 10 : 4, y, Hd);
        }
        break;
      default: drawHair(x, d, 0, H, Hd);
    }
  }

  function character(look) {
    // Settings > Censor Nudity: bars (on, the default) or the body as it is (off)
    const nude = look.naked || look.shirtless || look.pantsless;
    const censored = !nude || !G.settings || G.settings.get('censor') !== false;
    const key = JSON.stringify(look) + (nude ? (censored ? '|c' : '|u') : '');
    if (charCache[key]) return charCache[key];
    const FW = 16, FH = 20;
    const { c, x } = mk(FW * 3, FH * 4);
    // caught in the act: no clothes, barefoot (a censor bar is drawn below)
    if (look.naked) {
      const sk = look.skin || '#e0b088';
      look = Object.assign({}, look, { shirt: sk, shirt2: sk, pants: sk, shoes: shade(sk, 0.85), top: 'shirt', bottom: 'pants', armor: null, apron: null, cape: null, hat: null, glasses: null });
    } else if (look.shirtless || look.pantsless) {   // the player took some clothes off
      const sk = look.skin || '#e0b088';
      look = Object.assign({}, look, look.shirtless ? { shirt: sk, shirt2: sk, top: 'shirt', apron: null } : {}, look.pantsless ? { pants: sk, bottom: 'pants' } : {});
    }
    const female = look.body === 'f';
    const skin = look.skin || '#e0b088', hair = look.hair || '#4a3020';
    const T = look.shirt || '#6a8ab8', T2 = look.shirt2 || shade(T, 0.6);
    const pants = look.pants || '#4a3a2a', shoes = look.shoes || '#2e2018';
    const top = look.top || 'shirt', bottom = look.bottom || 'pants';
    const facial = look.facial != null ? look.facial : look.beard ? 1 : 0;
    const eyes = look.eyes || '#1d1a22';
    const bareTop = !!(look.naked || look.shirtless), bareBottom = !!(look.naked || look.pantsless);   // skin, not cloth: softer shading, no seams
    const so = bareTop ? shade(skin, 0.88) : shade(T, 0.72), po = shade(pants, 0.75), sk2 = shade(skin, 0.86), Hd = shade(hair, 0.7);
    const sleeve = top === 'vest' ? T2 : top === 'tank' ? skin : T, sleeveD = bareTop || top === 'tank' ? shade(skin, 0.92) : shade(sleeve, 0.72);   // (a tank top: bare arms)
    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < 3; f++) {
        x.save();
        x.translate(f * FW, d * FH);
        const side = d === 1 || d === 2;
        const legTop = bottom === 'shorts' ? pants : bottom === 'skirt' ? skin : pants;
        const legLow = bottom === 'pants' ? pants : skin;
        const legShade = bottom === 'pants' ? po : sk2;
        // legs
        const leg = (lx, h, shadeIt) => {
          R(x, lx, 14, 2, Math.min(2, h), shadeIt ? shade(legTop, 0.8) : legTop);
          if (h > 2) R(x, lx, 16, 2, h - 2, shadeIt ? legShade : legLow);
          R(x, lx, 14 + h, 2, 1, shoes);
        };
        if (!side) { leg(5, f === 1 ? 3 : 4, false); leg(9, f === 2 ? 3 : 4, false); P(x, 6, 14, shade(legTop, 0.8)); }
        else {
          const a = f === 0 ? [7, 8] : f === 1 ? [6, 9] : [9, 6];
          leg(a[1], 4, true); leg(a[0], 4, false);
        }
        if (bottom === 'skirt') { R(x, 4, 13, 8, 3, pants); R(x, 4, 15, 8, 1, shade(pants, 0.75)); }
        // cape behind body
        if (look.cape && d === 3) R(x, 4, 9, 8, 8, look.cape);
        if (look.cape && side) R(x, d === 1 ? 10 : 3, 9, 3, 7, look.cape);
        // torso
        if (female) { R(x, 4, 9, 8, 2, T); R(x, 5, 11, 6, 2, T); R(x, 4, 13, 8, 1, T); R(x, 10, 9, 1, 4, so); }
        else { R(x, 4, 9, 8, 5, T); R(x, 11, 9, 1, 5, so); }
        if (look.bikini) R(x, 4, 10, 8, 3, skin);
        if (top === 'tunic') { R(x, 4, 12, 8, 4, T); R(x, 4, 12, 8, 1, shade(T, 0.55)); }
        else if (top === 'dress') { R(x, 3, 13, 10, 4, T); R(x, 3, 16, 10, 1, shade(T, 0.7)); }
        else if (top === 'robe') { R(x, 4, 13, 8, 5, T); R(x, 7, 13, 1, 5, so); }
        else if (bottom !== 'skirt' && !bareBottom) R(x, 4, 13, 8, 1, shade(pants, 0.6));
        if (top === 'jacket') {
          if (d === 0) { R(x, 7, 9, 2, 4, T2); P(x, 6, 9, shade(T, 1.2)); P(x, 9, 9, shade(T, 1.2)); }
          else if (side) R(x, d === 1 ? 5 : 9, 10, 1, 3, shade(T, 0.6));
        }
        if (top === 'hoodie') {
          if (d === 0) { P(x, 6, 10, '#e8e0d0'); P(x, 9, 10, '#e8e0d0'); R(x, 4, 12, 8, 1, shade(T, 0.85)); }
          if (d === 3) R(x, 4, 8, 8, 2, shade(T, 0.85));
        }
        if (top === 'vest' && d === 0) R(x, 7, 9, 2, 4, T2);
        else if (top === 'vest' && side) R(x, d === 1 ? 4 : 11, 9, 1, 4, T2);   // (in profile the shirt shows along the front edge)
        if (look.armor) {
          R(x, 4, 9, 8, 4, look.armor); R(x, 4, 9, 8, 1, shade(look.armor, 1.25));
          if (!side) { R(x, 3, 9, 2, 2, shade(look.armor, 0.85)); R(x, 11, 9, 2, 2, shade(look.armor, 0.85)); }
        }
        if (look.apron && d !== 3) R(x, side ? (d === 1 ? 4 : 7) : 5, 10, side ? 5 : 6, 5, look.apron);
        // arms
        const swing = f === 0 ? 0 : f === 1 ? 1 : -1;
        if (!side) {
          R(x, 3, 9 + Math.max(0, swing), 1, 4, sleeveD); P(x, 3, 13 + Math.max(0, swing), skin);
          R(x, 12, 9 + Math.max(0, -swing), 1, 4, sleeveD); P(x, 12, 13 + Math.max(0, -swing), skin);
        } else {
          const ax = 7 + swing;
          R(x, ax, 10, 2, 3, sleeveD); R(x, ax, 13, 2, 1, skin);
        }
        // pregnant belly (1..3), under the clothes' color
        if (look.belly) {
          const b = look.belly, bc = top === 'dress' || top === 'robe' ? T : look.naked ? skin : T;
          if (d === 0) {   // a round bump that pushes the outline out
            R(x, 4, 11, 8, 2 + b, bc);
            if (b > 1) R(x, 3, 12, 10, b, bc);
            if (b > 2) R(x, 2, 13, 12, 1, bc);
            R(x, 5, 12, 2, 1, shade(bc, 1.25)); R(x, 4, 12 + b, 8, 1, shade(bc, 0.68));
          }
          else if (d === 1) { R(x, 4 - b, 10, b, b > 2 ? 4 : 3, bc); P(x, 4 - b, 10, shade(bc, 1.15)); }
          else if (d === 2) { R(x, 12, 10, b, b > 2 ? 4 : 3, bc); P(x, 11 + b, 10, shade(bc, 0.8)); }
        }
        // naked: pixel censor bars
        // naked, uncensored: a plain, naturalistic body (adults only: children are never drawn without clothes)
        if ((look.naked || look.shirtless || look.pantsless) && !censored) {
          const skD = shade(skin, 0.86), skL = shade(skin, 1.07), nip = mix(skin, '#8a4a3a', 0.4), pub = mix(skin, shade(hair, 0.75), 0.5), bh = mix(skin, shade(hair, 0.8), 0.45);
          const chest = look.naked || look.shirtless, hips = look.naked || look.pantsless, b = look.belly || 0;
          if (chest) {
            if (d === 0) {
              P(x, 6, 9, skL); P(x, 9, 9, skL);                                                          // collarbones
              if (female) {
                P(x, 5, 10, skL); P(x, 10, 10, skL);                                                     // breasts: light on top,
                if (!b) { P(x, 5, 12, skD); P(x, 6, 12, skD); P(x, 9, 12, skD); P(x, 10, 12, skD); }    // a soft shadow under
                P(x, 6, 11, nip); P(x, 9, 11, nip);
              } else {
                P(x, 5, 11, skD); P(x, 6, 11, skD); P(x, 9, 11, skD); P(x, 10, 11, skD);               // the line under the chest
                P(x, 6, 10, nip); P(x, 9, 10, nip);
                if (facial) { P(x, 7, 10, bh); P(x, 8, 11, bh); }                                       // a little body hair
              }
              P(x, 7, b ? 12 + Math.ceil(b / 2) : 12, skD);                                             // navel (on the bump, if pregnant)
            } else if (d === 3) {
              P(x, 5, 10, skD); P(x, 10, 10, skD); P(x, 7, 11, skD);                                    // shoulder blades, spine
            } else if (female && !b) {
              const out = d === 1 ? 3 : 12; P(x, out, 11, skin); P(x, d === 1 ? 4 : 11, 11, nip);      // the chest in profile
            } else if (!female) P(x, d === 1 ? 4 : 11, 10, nip);
          }
          if (hips) {
            if (d === 0) { P(x, 7, 13, pub); P(x, 8, 13, pub); }                                        // just a hint
            else if (d === 3) { P(x, 7, 13, skD); P(x, 5, 13, skL); P(x, 10, 13, skL); }
            else P(x, d === 1 ? 4 : 11, 13, pub);
          }
        }
        if ((look.naked || look.shirtless || look.pantsless) && censored) {
          const bar = (bx, by, bw) => { for (let i = 0; i < bw; i++) for (let j = 0; j < 2; j++) P(x, bx + i, by + j, (i + j) % 2 ? '#141418' : '#3a3a44'); };
          if (look.naked || look.pantsless) { if (d === 0 || d === 3) bar(5, 13, 6); else bar(d === 1 ? 5 : 7, 13, 4); }
          if ((look.naked || look.shirtless) && female && d === 0) bar(5, 10, 6);
          if ((look.naked || look.shirtless) && female && side) bar(d === 1 ? 4 : 9, 10, 3);
        }
        // head
        R(x, 4, 2, 8, 7, skin);
        R(x, 4, 8, 8, 1, sk2);
        const hs = look.hairStyle || 0;
        if (hs === 2 && d !== 3) R(x, 4, 1, 8, 1, shade(skin, 0.9));
        if (hs === 2 && d === 3) R(x, 4, 1, 8, 2, shade(skin, 0.9));
        if (d !== 3) {
          if (d === 0) { P(x, 6, 5, eyes); P(x, 9, 5, eyes); }
          if (d === 1) P(x, 5, 5, eyes);
          if (d === 2) P(x, 10, 5, eyes);
          if (female) {
            const lip = mix(skin, '#b03848', 0.55);
            if (d === 0) { P(x, 7, 7, lip); P(x, 8, 7, lip); P(x, 5, 4, shade(hair, 0.8)); P(x, 10, 4, shade(hair, 0.8)); }
            if (d === 1) P(x, 4, 7, lip);
            if (d === 2) P(x, 11, 7, lip);
          }
          if (facial === 1) {
            if (d === 0) R(x, 5, 7, 6, 2, hair);
            if (d === 1) R(x, 4, 7, 4, 2, hair);
            if (d === 2) R(x, 8, 7, 4, 2, hair);
          } else if (facial === 2) {
            if (d === 0) R(x, 6, 7, 4, 1, hair);
            if (d === 1) R(x, 4, 7, 2, 1, hair);
            if (d === 2) R(x, 10, 7, 2, 1, hair);
          } else if (facial === 3) {
            const st = shade(skin, 0.72);
            if (d === 0) { P(x, 5, 7, st); P(x, 7, 8, st); P(x, 9, 8, st); P(x, 10, 7, st); }
            if (d === 1) { P(x, 4, 7, st); P(x, 6, 8, st); }
            if (d === 2) { P(x, 11, 7, st); P(x, 9, 8, st); }
          }
          if (look.glasses === 'sun') {
            if (d === 0) { R(x, 5, 5, 6, 1, '#141418'); P(x, 6, 5, '#2a3040'); P(x, 9, 5, '#2a3040'); }
            else R(x, d === 1 ? 4 : 8, 5, 4, 1, '#141418');
          } else if (look.glasses === 'round') {
            const g = '#c8a050';
            if (d === 0) { P(x, 5, 5, g); P(x, 7, 5, g); P(x, 8, 5, g); P(x, 10, 5, g); }
            else P(x, d === 1 ? 4 : 11, 5, g);
          }
          // masks: the Elite's masquerade (white, gold or black; 'beak' is a long plague-doctor nose)
          if (look.mask) {
            const mc = { white: '#ece6dc', gold: '#d8b040', black: '#1a1618', red: '#8a1a1e', silver: '#b8bcc4' }[look.maskColor || look.mask] || '#ece6dc', md = shade(mc, 0.75);
            if (d === 0) { R(x, 4, 3, 8, 5, mc); R(x, 4, 7, 8, 1, md); P(x, 6, 5, '#0a0808'); P(x, 9, 5, '#0a0808'); if (look.mask === 'gold' || look.maskColor === 'gold') { P(x, 4, 3, '#fff0a0'); P(x, 11, 3, '#fff0a0'); } if (look.maskBeak) R(x, 7, 6, 2, 3, md); }
            else if (d === 1) { R(x, 3, 3, 5, 5, mc); P(x, 4, 5, '#0a0808'); if (look.maskBeak) R(x, 1, 5, 2, 2, md); }
            else if (d === 2) { R(x, 8, 3, 5, 5, mc); P(x, 11, 5, '#0a0808'); if (look.maskBeak) R(x, 13, 5, 2, 2, md); }
          }
        }
        drawHair(x, d, hs, hair, Hd);
        // hats
        const hat = look.hat;
        if (hat === 'hood' || hat === 'cowl') {
          const hc = look.hatColor || (hat === 'cowl' ? '#2a1a1e' : '#5a4a3a');
          if (d === 3) R(x, 3, 0, 10, 9, hc);
          else {
            R(x, 3, 0, 10, 3, hc);
            if (d !== 2) R(x, d === 1 ? 10 : 3, 0, d === 1 ? 3 : 1, 9, hc);
            if (d !== 1) R(x, d === 2 ? 3 : 12, 0, d === 2 ? 3 : 1, 9, hc);
            if (hat === 'cowl' && d === 0) { R(x, 4, 3, 8, 3, '#120a0c'); P(x, 6, 4, '#d0402a'); P(x, 9, 4, '#d0402a'); }
          }
        } else if (hat === 'helmet') {
          const hc = look.hatColor || '#9aa0a8';
          R(x, 4, 0, 8, 4, hc); R(x, 4, 0, 8, 1, shade(hc, 1.2)); R(x, 3, 3, 10, 1, shade(hc, 0.8));
          if (d === 0) R(x, 7, 4, 2, 2, hc);
        } else if (hat === 'straw') {
          R(x, 2, 3, 12, 1, '#c8a048'); R(x, 4, 0, 8, 3, '#d8b45a'); R(x, 4, 2, 8, 1, '#8a4a2a');
        } else if (hat === 'cap') {
          const hc = look.hatColor || '#7a3a3a';
          R(x, 4, 0, 8, 3, hc); if (d === 0) R(x, 4, 3, 8, 1, shade(hc, 0.7));
          if (d === 1) R(x, 2, 2, 3, 1, shade(hc, 0.7)); if (d === 2) R(x, 11, 2, 3, 1, shade(hc, 0.7));
        } else if (hat === 'crown') {
          R(x, 4, 0, 8, 2, '#e0b840'); P(x, 4, 0, '#fff0a0'); P(x, 7, 0, '#d03a3a'); P(x, 11, 0, '#fff0a0');
        } else if (hat === 'bandana') {
          const hc = look.hatColor || '#c03030';
          R(x, 4, 1, 8, 2, hc); R(x, 4, 2, 8, 1, shade(hc, 0.75));
          if (d === 1) R(x, 12, 2, 2, 2, hc); if (d === 2) R(x, 2, 2, 2, 2, hc); if (d === 3) R(x, 7, 3, 2, 2, hc);
        } else if (hat === 'kippah') {   // a small round cap on the crown of the head
          const hc = look.hatColor || '#1a1a22';
          if (d === 3) R(x, 5, 0, 6, 2, hc); else R(x, d === 1 ? 6 : d === 2 ? 5 : 5, 0, 5, 1, hc);
        } else if (hat === 'blackhat') {   // a tall black hat with a wide brim
          const hc = look.hatColor || '#121214';
          R(x, 2, 2, 12, 1, hc); R(x, 4, 0, 8, 2, hc); R(x, 4, 1, 8, 1, shade(hc, 1.4));
        } else if (hat === 'tophat') {
          const hc = look.hatColor || '#141418';
          R(x, 3, 2, 10, 1, hc); R(x, 5, 0, 6, 2, hc); R(x, 5, 1, 6, 1, '#8a1a2a');
        } else if (hat === 'beanie') {   // a slouchy knit beanie, folded cuff
          const hc = look.hatColor || '#c8506a';
          R(x, 4, 0, 8, 3, hc); R(x, 4, 2, 8, 1, shade(hc, 0.75)); R(x, d === 1 ? 11 : 3, 0, 2, 2, hc);
          for (let i = 0; i < 4; i++) P(x, 5 + i * 2, 1, shade(hc, 1.18));
        }
        // small things people wear: a nose ring, a canvas tote on the shoulder, enamel pins on the chest
        if (look.nosering && d === 0) P(x, 8, 7, '#d8dce4');
        if (look.nosering && (d === 1 || d === 2)) P(x, d === 1 ? 4 : 11, 6, '#d8dce4');
        if (look.tote) {
          const tc = look.toteColor || '#d8ccb0';
          if (d === 0) { R(x, 11, 9, 1, 3, shade(tc, 0.7)); R(x, 11, 12, 3, 4, tc); P(x, 12, 13, '#c84a6a'); }
          else if (d === 3) { R(x, 4, 9, 1, 3, shade(tc, 0.7)); R(x, 2, 12, 3, 4, tc); }
          else { R(x, d === 1 ? 9 : 4, 11, 3, 4, tc); }
        }
        if (look.pins && d === 0) { P(x, 6, 10, '#e05a8a'); P(x, 9, 11, '#5ac8e0'); P(x, 6, 12, '#e0d050'); }
        x.restore();
      }
    }
    outline(c);
    const sheet = { img: c, fw: FW, fh: FH, frames: 3 };
    charCache[key] = sheet;
    return sheet;
  }

  // Clothing item icon, generated per style/color: key "cloth|top|jacket|#aa3333|#222222"
  function clothIcon(key) {
    if (icons[key]) return icons[key];
    const [, slot, style, col, col2] = key.split('|');
    const C = col || '#888888', C2 = col2 || shade(C, 0.6), dk = shade(C, 0.7);
    const { c, x } = mk(16, 16);
    if (slot === 'top') {
      const long = style === 'tunic' || style === 'robe' || style === 'dress';
      if (style === 'dress') { R(x, 5, 2, 6, 6, C); for (let y = 0; y < 7; y++) R(x, 4 - Math.floor(y / 3), 8 + y, 8 + Math.floor(y / 3) * 2, 1, C); }
      else {
        R(x, 4, 3, 8, long ? 12 : 9, C);
        if (style === 'tank') { R(x, 5, 1, 1, 3, C); R(x, 10, 1, 1, 3, C); x.clearRect(6, 3, 4, 2); }   // straps, no sleeves
        else if (style === 'tshirt') { R(x, 1, 3, 3, 3, C); R(x, 12, 3, 3, 3, C); R(x, 1, 5, 3, 1, dk); R(x, 12, 5, 3, 1, dk); }   // short sleeves
        else if (style !== 'vest') { R(x, 1, 3, 3, style === 'longsleeve' ? 9 : 6, C); R(x, 12, 3, 3, style === 'longsleeve' ? 9 : 6, C); R(x, 1, style === 'longsleeve' ? 11 : 8, 3, 1, dk); R(x, 12, style === 'longsleeve' ? 11 : 8, 3, 1, dk); }
        R(x, 6, 3, 4, 1, shade(C, 0.55));
        if (style === 'jacket' || style === 'vest') R(x, 7, 3, 2, long ? 12 : 9, C2);
        if (style === 'hoodie') { R(x, 5, 1, 6, 3, dk); P(x, 6, 5, '#e8e0d0'); P(x, 9, 5, '#e8e0d0'); }
        if (style === 'tunic' || style === 'robe') R(x, 4, 9, 8, 1, shade(C, 0.5));
      }
    } else if (slot === 'shoes') {
      const boot = style === 'boots', open = style === 'sandals';
      for (const ox of [1, 8]) {
        R(x, ox + 1, boot ? 4 : 8, 4, boot ? 6 : 2, open ? shade(C, 1.1) : C);
        R(x, ox, 10, 7, 3, C); R(x, ox, 12, 7, 1, shade(C, 0.6));
        if (open) { R(x, ox + 1, 10, 5, 1, '#e0b088'); }
        if (style === 'sneakers') R(x, ox, 12, 7, 1, '#f0f0f0');
      }
    } else if (slot === 'mask') {
      const mc = { white: '#ece6dc', gold: '#d8b040', black: '#1a1618', red: '#8a1a1e', silver: '#b8bcc4', ski: '#2a2a30' }[style] || C;
      if (style === 'ski') { R(x, 3, 1, 10, 14, mc); R(x, 4, 5, 8, 2, '#e0b088'); R(x, 6, 10, 4, 2, '#e0b088'); P(x, 5, 6, '#111'); P(x, 10, 6, '#111'); }
      else { R(x, 2, 4, 12, 8, mc); R(x, 3, 3, 10, 1, shade(mc, 1.15)); R(x, 4, 6, 3, 2, '#0a0808'); R(x, 9, 6, 3, 2, '#0a0808'); R(x, 7, 9, 2, 2, shade(mc, 0.75)); R(x, 2, 11, 12, 1, shade(mc, 0.7)); }
    } else {
      if (style === 'skirt') { for (let y = 0; y < 9; y++) R(x, 5 - Math.floor(y / 3), 4 + y, 6 + Math.floor(y / 3) * 2, 1, C); R(x, 5, 4, 6, 1, dk); }
      else {
        const len = style === 'shorts' ? 6 : 11;
        R(x, 4, 3, 8, 3, C); R(x, 4, 3, 8, 1, dk);
        R(x, 4, 6, 3, len - 3, C); R(x, 9, 6, 3, len - 3, C); R(x, 7, 6, 2, 1, dk);
      }
    }
    outline(c);
    icons[key] = c;
    return c;
  }

  // ---------- fire & ruins ----------
  function genFire() {
    sprite('burnt_tree', 18, 26, 9, 25, (x) => {
      R(x, 7, 8, 4, 18, '#2a2420'); R(x, 7, 8, 1, 18, '#3a302a');
      line(x, 8, 12, 2, 5, '#2a2420'); line(x, 9, 10, 15, 3, '#2a2420'); line(x, 8, 16, 14, 12, '#2a2420');
      P(x, 9, 20, '#6a2a1a');
    });
    sprite('rubble', 16, 10, 8, 9, (x, r) => {
      for (let i = 0; i < 6; i++) ell(x, r.int(3, 12), r.int(4, 7), r.int(1, 3), r.int(1, 2), r.pick(['#5a5650', '#6e6a62', '#3a2a20', '#2a2420']));
    });
  }

  // ---------- animals ----------
  const animalDraw = {
    rabbit: { w: 12, h: 10, fn(x, f, col) {
      ell(x, 7, 6, 4, 2, col); ell(x, 3, 4, 2, 2, col); R(x, 2, 0, 1, 3, col); R(x, 4, 0, 1, 3, col);
      P(x, 11, 5, '#f4f0e8'); P(x, 2, 4, '#1d1a22');
      R(x, f ? 4 : 5, 8, 1, 2, shade(col, 0.8)); R(x, f ? 9 : 8, 8, 2, 2, shade(col, 0.8));
    } },
    chicken: { w: 10, h: 11, fn(x, f, col) {
      ell(x, 5, 6, 3, 3, col); ell(x, 3, 3, 2, 2, col); P(x, 3, 0, '#d03a3a'); P(x, 2, 1, '#d03a3a');
      P(x, 0, 3, '#e8a030'); P(x, 2, 3, '#1d1a22'); R(x, 7, 4, 2, 2, shade(col, 0.85));
      R(x, f ? 3 : 4, 9, 1, 2, '#e8a030'); R(x, f ? 6 : 5, 9, 1, 2, '#e8a030');
    } },
    deer: { w: 22, h: 21, fn(x, f, col, opt) {
      const dk = shade(col, 0.7);
      ell(x, 12, 11, 7, 4, col); ell(x, 12, 13, 5, 2, shade(col, 1.25));
      R(x, 5, 5, 3, 7, col); ell(x, 4, 5, 3, 2, col); P(x, 1, 6, '#1d1a22'); P(x, 3, 4, '#1d1a22');
      R(x, 5, 2, 1, 2, dk);
      if (opt.antlers) { line(x, 4, 3, 2, 0, '#d8c8a0'); line(x, 6, 3, 8, 0, '#d8c8a0'); P(x, 1, 1, '#d8c8a0'); P(x, 9, 1, '#d8c8a0'); }
      P(x, 19, 9, '#f4f0e8'); P(x, 20, 9, '#f4f0e8');
      const o = f ? 1 : 0;
      R(x, 7 + o, 14, 1, 6, dk); R(x, 9 - o, 14, 1, 6, dk); R(x, 15 + o, 14, 1, 6, dk); R(x, 17 - o, 14, 1, 6, dk);
    } },
    wolf: { w: 20, h: 14, fn(x, f, col) {
      const dk = shade(col, 0.7);
      ell(x, 11, 7, 6, 3, col); ell(x, 11, 8, 4, 1, shade(col, 1.25));
      ell(x, 4, 6, 3, 2, col); R(x, 0, 7, 2, 2, col); P(x, 0, 7, '#1d1a22'); P(x, 3, 5, '#e8d040');
      P(x, 3, 2, col); P(x, 3, 3, col); P(x, 5, 2, col); P(x, 5, 3, col);
      line(x, 17, 6, 19, 4, col); P(x, 19, 3, shade(col, 1.2));
      const o = f ? 1 : 0;
      R(x, 6 + o, 10, 1, 4, dk); R(x, 8 - o, 10, 1, 4, dk); R(x, 13 + o, 10, 1, 4, dk); R(x, 15 - o, 10, 1, 4, dk);
    } },
    boar: { w: 18, h: 13, fn(x, f, col) {
      const dk = shade(col, 0.7);
      ell(x, 10, 6, 7, 4, col); R(x, 6, 2, 8, 1, dk);
      ell(x, 3, 7, 3, 3, col); R(x, 0, 7, 2, 2, shade(col, 1.3)); P(x, 1, 10, '#f4f0e8'); P(x, 2, 9, '#f4f0e8'); P(x, 3, 5, '#1d1a22');
      const o = f ? 1 : 0;
      R(x, 5 + o, 10, 2, 3, dk); R(x, 13 - o, 10, 2, 3, dk);
    } },
    bear: { w: 24, h: 20, fn(x, f, col) {
      const dk = shade(col, 0.7);
      ell(x, 13, 10, 9, 6, col); ell(x, 15, 7, 6, 3, shade(col, 1.1));
      ell(x, 5, 9, 4, 4, col); R(x, 0, 10, 3, 3, shade(col, 1.3)); P(x, 0, 10, '#1d1a22'); P(x, 4, 7, '#1d1a22');
      ell(x, 4, 5, 1, 1, col); ell(x, 7, 5, 1, 1, col);
      const o = f ? 1 : 0;
      R(x, 6 + o, 14, 3, 6, dk); R(x, 17 - o, 14, 3, 6, dk);
    } },
    cow: { w: 24, h: 18, fn(x, f, col) {
      ell(x, 13, 8, 8, 5, col); ell(x, 15, 6, 3, 2, '#2a2626'); ell(x, 10, 10, 2, 2, '#2a2626');
      ell(x, 4, 7, 3, 3, col); R(x, 0, 8, 3, 3, '#e0a0a0'); P(x, 3, 6, '#1d1a22');
      P(x, 2, 3, '#e8e0cc'); P(x, 6, 3, '#e8e0cc');
      const o = f ? 1 : 0;
      R(x, 7 + o, 12, 2, 6, '#8a8780'); R(x, 18 - o, 12, 2, 6, '#8a8780');
    } },
  };

  function animal(kind, color, opt = {}) {
    const key = kind + color + JSON.stringify(opt);
    if (animalCache[key]) return animalCache[key];
    const d = animalDraw[kind];
    const { c, x } = mk(d.w * 2, d.h * 2);
    for (let f = 0; f < 2; f++) {
      // row 0: facing left
      const t = mk(d.w, d.h);
      d.fn(t.x, f, color, opt);
      x.drawImage(t.c, f * d.w, 0);
      // row 1: facing right (mirror)
      x.save();
      x.translate(f * d.w + d.w, d.h);
      x.scale(-1, 1);
      x.drawImage(t.c, 0, 0);
      x.restore();
    }
    outline(c);
    const sheet = { img: c, fw: d.w, fh: d.h, frames: 2, animal: true };
    animalCache[key] = sheet;
    return sheet;
  }

  // ---------- item icons ----------
  function genIcons() {
    const icon = (name, fn) => {
      const { c, x } = mk(16, 16);
      fn(x);
      outline(c);
      icons[name] = c;
    };
    const blade = (x, len, col, guard) => {
      for (let i = 0; i < len; i++) { P(x, 4 + i, 11 - i, col); P(x, 5 + i, 11 - i, shade(col, 0.75)); P(x, 4 + i, 10 - i, shade(col, 1.2)); }
      line(x, 2, 9, 6, 13, guard); P(x, 3, 12, '#5b3a1e'); P(x, 2, 13, '#5b3a1e'); P(x, 1, 14, '#c8a050');
    };
    icon('sword', (x) => blade(x, 10, '#c8ccd4', '#8a6a2a'));
    icon('sword_steel', (x) => blade(x, 11, '#e0e6f0', '#c8a050'));
    icon('dagger', (x) => blade(x, 6, '#c8ccd4', '#6b4423'));
    icon('axe', (x) => {
      line(x, 3, 14, 11, 4, '#7b4f2a'); line(x, 4, 14, 12, 4, '#5b3a1e');
      ell(x, 11, 5, 3, 3, '#a8acb4'); R(x, 8, 2, 3, 3, '#8a8e96'); P(x, 13, 4, '#d8dce4');
    });
    icon('spear', (x) => {
      line(x, 2, 14, 11, 5, '#7b4f2a'); for (let i = 0; i < 3; i++) { P(x, 11 + i, 4 - i, '#d0d4dc'); P(x, 12 + i, 4 - i, '#a8acb4'); P(x, 11 + i, 3 - i, '#d0d4dc'); }
    });
    icon('mace', (x) => {
      line(x, 3, 14, 9, 8, '#5b3a1e'); ell(x, 11, 5, 3, 3, '#7d7a74'); P(x, 11, 1, '#a19d94'); P(x, 15, 5, '#a19d94'); P(x, 7, 5, '#a19d94'); P(x, 10, 4, '#c8c4bc');
    });
    icon('club', (x) => { line(x, 3, 14, 11, 6, '#6b4423'); ell(x, 11, 5, 3, 3, '#7b4f2a'); P(x, 10, 4, '#9a6a3a'); });
    const armor = (name, col) => icon(name, (x) => {
      R(x, 4, 3, 8, 10, col); R(x, 2, 3, 3, 5, col); R(x, 11, 3, 3, 5, col);
      R(x, 6, 3, 4, 2, shade(col, 0.6)); R(x, 4, 12, 8, 1, shade(col, 0.7)); R(x, 5, 6, 1, 5, shade(col, 1.2));
    });
    armor('armor_cloth', '#8a7a5a'); armor('armor_leather', '#8a5a2e'); armor('armor_chain', '#9aa0a8'); armor('armor_plate', '#c8ccd4');
    const potion = (name, col) => icon(name, (x) => {
      R(x, 7, 1, 2, 2, '#8a5a2e'); R(x, 7, 3, 2, 3, '#c8d8e0'); ell(x, 8, 10, 4, 4, '#c8d8e0'); ell(x, 8, 11, 3, 3, col); P(x, 6, 9, '#ffffff');
    });
    potion('potion_red', '#d0303a'); potion('potion_blue', '#3a6ad0'); potion('potion_green', '#3ab04a');
    icon('bread', (x) => { ell(x, 8, 9, 6, 4, '#c88a43'); ell(x, 8, 8, 5, 3, '#d89a53'); line(x, 5, 7, 6, 9, '#a06a2a'); line(x, 8, 6, 9, 9, '#a06a2a'); line(x, 11, 7, 12, 9, '#a06a2a'); });
    icon('apple', (x) => { ell(x, 8, 9, 5, 5, '#c8303a'); P(x, 6, 7, '#f08080'); R(x, 8, 2, 1, 3, '#5b3a1e'); R(x, 9, 2, 3, 2, '#4a9a3a'); });
    icon('meat', (x) => { ell(x, 9, 8, 5, 4, '#c0505a'); ell(x, 9, 8, 3, 2, '#d87078'); R(x, 2, 11, 4, 2, '#f4f0e8'); P(x, 1, 10, '#f4f0e8'); P(x, 1, 13, '#f4f0e8'); });
    icon('cooked_meat', (x) => { ell(x, 9, 8, 5, 4, '#8a4a2a'); ell(x, 9, 7, 3, 2, '#a86a3a'); R(x, 2, 11, 4, 2, '#f4f0e8'); P(x, 1, 10, '#f4f0e8'); P(x, 1, 13, '#f4f0e8'); });
    icon('pelt', (x) => { ell(x, 8, 8, 6, 5, '#8a6a4a'); R(x, 1, 4, 3, 2, '#8a6a4a'); R(x, 12, 4, 3, 2, '#8a6a4a'); R(x, 1, 11, 3, 2, '#8a6a4a'); R(x, 12, 11, 3, 2, '#8a6a4a'); ell(x, 8, 8, 3, 2, '#a08060'); });
    icon('wolf_pelt', (x) => { ell(x, 8, 8, 6, 5, '#6e6e74'); R(x, 1, 4, 3, 2, '#6e6e74'); R(x, 12, 4, 3, 2, '#6e6e74'); R(x, 1, 11, 3, 2, '#6e6e74'); R(x, 12, 11, 3, 2, '#6e6e74'); ell(x, 8, 8, 3, 2, '#8e8e94'); });
    icon('bear_pelt', (x) => { ell(x, 8, 8, 7, 6, '#4a3426'); R(x, 0, 3, 3, 3, '#4a3426'); R(x, 13, 3, 3, 3, '#4a3426'); ell(x, 8, 8, 4, 3, '#5e4434'); });
    icon('antler', (x) => { line(x, 4, 14, 8, 6, '#d8c8a0'); line(x, 8, 6, 12, 1, '#d8c8a0'); line(x, 8, 6, 4, 2, '#d8c8a0'); line(x, 10, 4, 13, 5, '#d8c8a0'); line(x, 6, 10, 3, 8, '#d8c8a0'); });
    icon('tusk', (x) => { line(x, 3, 13, 6, 6, '#f0e8d8'); line(x, 6, 6, 11, 3, '#f0e8d8'); line(x, 4, 13, 7, 7, '#c8c0b0'); });
    icon('feather', (x) => { line(x, 3, 14, 12, 2, '#d8d2c4'); ell(x, 9, 6, 2, 4, '#f4f0e8'); });
    icon('egg', (x) => { ell(x, 8, 9, 4, 5, '#f0e8d8'); P(x, 6, 7, '#ffffff'); });
    icon('milk', (x) => { R(x, 5, 4, 6, 10, '#d8d2c4'); R(x, 6, 2, 4, 2, '#a08a64'); R(x, 6, 6, 4, 6, '#ffffff'); });
    icon('herb', (x) => { line(x, 8, 14, 8, 4, '#3a7a2a'); ell(x, 5, 6, 2, 1, '#5ab048'); ell(x, 11, 8, 2, 1, '#5ab048'); ell(x, 5, 10, 2, 1, '#5ab048'); ell(x, 8, 3, 1, 2, '#7cc060'); });
    icon('mushroom', (x) => { R(x, 7, 8, 3, 6, '#e8e0cc'); ell(x, 8, 7, 6, 3, '#9a7454'); R(x, 3, 9, 11, 1, '#d8a8a0'); P(x, 6, 5, '#b8957a'); P(x, 7, 5, '#b8957a'); });
    icon('chanterelle', (x) => { R(x, 7, 9, 3, 5, '#e8a830'); for (let y = 0; y < 4; y++) R(x, 3 + y, 4 + y, 11 - y * 2, 1, y ? '#e8a830' : '#f8d060'); P(x, 3, 3, '#f8d060'); P(x, 13, 3, '#f8d060'); });
    icon('death_cap', (x) => { R(x, 7, 8, 3, 6, '#f4f4ec'); R(x, 6, 10, 5, 1, '#ffffff'); ell(x, 8, 7, 6, 3, '#c0cc98'); P(x, 6, 5, '#e0e8c0'); P(x, 7, 5, '#e0e8c0'); ell(x, 8, 14, 3, 1, '#e8e8d8'); });
    icon('fly_agaric', (x) => { R(x, 7, 8, 3, 6, '#f4f0e0'); ell(x, 8, 7, 6, 3, '#d82828'); P(x, 5, 6, '#fff'); P(x, 9, 5, '#fff'); P(x, 11, 7, '#fff'); P(x, 7, 8, '#fff'); P(x, 4, 8, '#fff'); });
    icon('magic_mushroom', (x) => {
      line(x, 5, 14, 6, 8, '#e0d4b8'); line(x, 10, 14, 10, 6, '#e0d4b8');
      ell(x, 6, 7, 2, 2, '#b08848'); P(x, 6, 4, '#c8a060'); ell(x, 10, 5, 2, 2, '#a07838'); P(x, 10, 2, '#c8a060'); P(x, 10, 12, '#6a7ac8'); P(x, 5, 12, '#6a7ac8');
    });
    // ---- modern melee
    icon('kitchen_knife', (x) => { for (let i = 0; i < 6; i++) { R(x, 6 + i, 9 - i, 1, 2, '#d8dce4'); } P(x, 11, 3, '#ffffff'); line(x, 2, 13, 5, 10, '#2a2a30'); line(x, 3, 13, 6, 10, '#3a3a40'); });
    icon('switchblade', (x) => { line(x, 3, 12, 8, 9, '#2a2a30'); line(x, 3, 13, 8, 10, '#4a4a52'); line(x, 8, 9, 13, 4, '#d8dce4'); P(x, 9, 9, '#c0c4cc'); P(x, 5, 11, '#c8a050'); });
    icon('combat_knife', (x) => { blade(x, 8, '#9aa0a8', '#2a2a30'); P(x, 9, 6, '#5a5e66'); P(x, 10, 5, '#5a5e66'); });
    icon('machete', (x) => { for (let i = 0; i < 9; i++) { R(x, 5 + i, 10 - i, 1, 3, i > 6 ? '#c0c4cc' : '#a8acb4'); } line(x, 2, 14, 5, 11, '#2a2a30'); line(x, 3, 14, 5, 12, '#2a2a30'); });
    icon('knuckles', (x) => { R(x, 3, 6, 10, 3, '#c8a050'); for (let i = 0; i < 4; i++) { R(x, 3 + i * 2.5, 5, 2, 2, '#e0c070'); } R(x, 5, 9, 6, 4, '#b08838'); x.clearRect(6, 10, 4, 2); P(x, 4, 6, '#f8e8a0'); });
    icon('bat', (x) => { line(x, 2, 14, 12, 4, '#b08a5a'); line(x, 3, 14, 13, 4, '#c8a070'); line(x, 9, 6, 13, 2, '#c8a070'); line(x, 10, 7, 14, 3, '#a07a4a'); R(x, 1, 13, 3, 2, '#2a2a30'); });
    icon('crowbar', (x) => { line(x, 3, 14, 12, 3, '#c03030'); line(x, 4, 14, 13, 3, '#a02828'); P(x, 12, 2, '#c03030'); P(x, 11, 2, '#c03030'); line(x, 3, 14, 1, 13, '#a02828'); });
    icon('baton', (x) => { line(x, 3, 13, 13, 3, '#1e1e22'); line(x, 4, 13, 13, 4, '#2a2a30'); line(x, 4, 10, 6, 12, '#3a3a40'); P(x, 12, 3, '#5a5a62'); });
    icon('sledge', (x) => { line(x, 3, 14, 10, 6, '#8a6a3a'); line(x, 4, 14, 10, 7, '#6b4f2a'); R(x, 8, 2, 6, 5, '#6a6e76'); R(x, 8, 2, 6, 1, '#9aa0a8'); });
    // ---- firearms (pointing right)
    const gunBody = '#2a2a30', gunHi = '#4a4a54', grip = '#5b3a1e';
    icon('pistol', (x) => { R(x, 3, 5, 10, 3, gunBody); R(x, 3, 5, 10, 1, gunHi); R(x, 4, 8, 3, 5, gunBody); R(x, 7, 8, 2, 2, gunBody); x.clearRect(7, 8, 1, 1); P(x, 12, 4, gunHi); });
    icon('revolver', (x) => { R(x, 6, 5, 8, 2, '#8a8e96'); R(x, 4, 4, 4, 5, '#9aa0a8'); R(x, 5, 5, 2, 3, '#6a6e76'); R(x, 2, 8, 3, 5, grip); R(x, 3, 9, 1, 3, '#7b4f2a'); P(x, 13, 4, '#9aa0a8'); });
    icon('smg', (x) => { R(x, 2, 5, 12, 3, gunBody); R(x, 2, 5, 12, 1, gunHi); R(x, 6, 8, 2, 6, '#3a3a40'); R(x, 3, 8, 2, 3, gunBody); R(x, 14, 6, 2, 1, gunBody); });
    icon('shotgun', (x) => { R(x, 4, 6, 12, 2, '#3a3a40'); R(x, 4, 8, 7, 1, '#6a4a2a'); R(x, 0, 7, 5, 3, '#7b4f2a'); R(x, 0, 9, 3, 2, '#7b4f2a'); R(x, 7, 8, 4, 2, '#8a5a2e'); P(x, 15, 6, '#6a6e76'); });
    icon('rifle', (x) => { R(x, 4, 6, 12, 1, '#3a3a40'); R(x, 1, 7, 9, 2, '#7b4f2a'); R(x, 0, 8, 3, 3, '#7b4f2a'); R(x, 6, 4, 5, 2, '#2a2a30'); P(x, 6, 3, '#6a6e76'); P(x, 10, 3, '#6a6e76'); R(x, 8, 7, 1, 2, '#2a2a30'); });
    icon('assault_rifle', (x) => { R(x, 3, 6, 13, 2, gunBody); R(x, 0, 6, 4, 4, '#3a3a40'); R(x, 7, 8, 2, 5, '#3a3a40'); R(x, 5, 8, 2, 3, gunBody); R(x, 6, 4, 4, 2, gunBody); R(x, 11, 5, 1, 1, gunHi); R(x, 3, 6, 13, 1, gunHi); });
    // ---- ammo
    const rounds = (name, col, tip, n, h) => icon(name, (x) => { for (let i = 0; i < n; i++) { const bx = 3 + i * (10 / n) | 0; R(x, bx, 14 - h, 2, h, col); R(x, bx, 13 - h, 2, 1, tip); P(x, bx, 14 - h, shade(col, 1.3)); } R(x, 2, 14, 12, 1, '#5a4a2a'); });
    rounds('ammo_9mm', '#d0a040', '#b87a3a', 4, 5);
    rounds('ammo_357', '#d8b050', '#a8a8b0', 3, 6);
    rounds('ammo_rifle', '#c89a3a', '#b87a3a', 3, 9);
    icon('ammo_shells', (x) => { for (let i = 0; i < 3; i++) { R(x, 3 + i * 4, 6, 3, 8, '#c83030'); R(x, 3 + i * 4, 12, 3, 2, '#d0a040'); P(x, 3 + i * 4, 6, '#e05050'); } });
    // ---- armor
    icon('armor_kevlar', (x) => { R(x, 4, 3, 8, 11, '#3a3e44'); R(x, 3, 3, 2, 3, '#3a3e44'); R(x, 11, 3, 2, 3, '#3a3e44'); R(x, 6, 3, 4, 2, '#1e2024'); R(x, 5, 7, 6, 4, '#4a4e56'); R(x, 6, 8, 4, 1, '#d8d8d8'); });
    // ---- food & medicine
    icon('sandwich', (x) => { for (let y = 0; y < 6; y++) R(x, 2 + y, 5 + y, 12 - y, 1, '#e8c88a'); R(x, 2, 8, 9, 1, '#6ab048'); R(x, 4, 9, 7, 1, '#e8a0a0'); R(x, 2, 4, 12, 1, '#c89050'); });
    icon('can', (x) => { R(x, 4, 3, 8, 11, '#a8acb4'); R(x, 4, 5, 8, 6, '#c84030'); R(x, 5, 7, 6, 2, '#f0d060'); R(x, 4, 3, 8, 1, '#d8dce4'); });
    icon('chips', (x) => { R(x, 4, 3, 8, 11, '#e8c030'); R(x, 4, 3, 8, 2, '#c83030'); R(x, 4, 12, 8, 2, '#c83030'); ell(x, 8, 8, 2, 2, '#f8e8a0'); });
    icon('soda', (x) => { R(x, 5, 3, 6, 11, '#c82828'); R(x, 5, 3, 6, 1, '#d8dce4'); R(x, 5, 13, 6, 1, '#a8acb4'); R(x, 6, 6, 4, 4, '#f4f0e8'); P(x, 6, 4, '#e86060'); });
    icon('coffee', (x) => { R(x, 4, 5, 7, 8, '#f4f0e8'); R(x, 5, 6, 5, 2, '#5a3a1e'); R(x, 11, 7, 2, 3, '#f4f0e8'); x.clearRect(11, 8, 1, 1); P(x, 6, 3, '#c8c0b0'); P(x, 8, 2, '#c8c0b0'); });
    icon('energy', (x) => { R(x, 5, 2, 6, 12, '#2a2a30'); R(x, 5, 2, 6, 1, '#a8acb4'); line(x, 9, 4, 6, 9, '#60e040'); line(x, 6, 9, 10, 8, '#60e040'); line(x, 10, 8, 7, 13, '#60e040'); });
    icon('medkit', (x) => { R(x, 2, 5, 12, 9, '#e8e4dc'); R(x, 6, 3, 4, 2, '#8a8a90'); R(x, 7, 7, 2, 5, '#d02828'); R(x, 5, 9, 6, 1, '#d02828'); R(x, 5, 8, 6, 3, '#d02828'); x.clearRect(5, 8, 2, 1); x.clearRect(9, 8, 2, 1); x.clearRect(5, 10, 2, 1); x.clearRect(9, 10, 2, 1); });
    icon('charcoal', (x) => { R(x, 4, 4, 8, 10, '#e8e4dc'); R(x, 4, 7, 8, 4, '#2a2a30'); R(x, 6, 2, 4, 2, '#8a8a90'); P(x, 5, 8, '#5a5a62'); });
    // ---- alcohol
    icon('beer', (x) => { R(x, 6, 1, 4, 2, '#d8a020'); R(x, 6, 3, 4, 3, '#6a4a10'); R(x, 5, 6, 6, 9, '#7a5010'); R(x, 5, 8, 6, 4, '#e8d8a0'); P(x, 6, 7, '#a8781a'); });
    icon('wine', (x) => { R(x, 7, 1, 2, 5, '#2a4a2a'); R(x, 7, 1, 2, 1, '#802030'); R(x, 5, 6, 6, 9, '#2a4a2a'); R(x, 6, 9, 4, 3, '#f0e8d8'); P(x, 6, 7, '#4a7a4a'); });
    icon('whiskey', (x) => { R(x, 7, 1, 2, 3, '#1e1e22'); R(x, 5, 4, 6, 11, '#b8701a'); R(x, 5, 4, 6, 2, '#d8902a'); R(x, 6, 8, 4, 4, '#1e1e22'); P(x, 7, 9, '#c8a050'); });
    icon('vodka', (x) => { R(x, 7, 1, 2, 3, '#c8c8d0'); R(x, 6, 4, 4, 2, '#e8f0f8'); R(x, 5, 6, 6, 9, '#e8f0f8'); R(x, 6, 9, 4, 3, '#c83030'); P(x, 6, 7, '#ffffff'); });
    icon('moonshine', (x) => { R(x, 6, 2, 4, 2, '#8a6a3a'); R(x, 4, 4, 8, 10, '#c8b890'); R(x, 5, 5, 6, 8, '#e8e0c0'); R(x, 5, 9, 6, 1, '#2a2a30'); R(x, 6, 7, 1, 1, '#2a2a30'); R(x, 9, 7, 1, 1, '#2a2a30'); });
    // ---- drugs
    icon('cigarette', (x) => { line(x, 2, 11, 12, 6, '#f4f0e8'); line(x, 2, 12, 12, 7, '#e8e4dc'); line(x, 2, 11, 4, 10, '#d88a3a'); line(x, 2, 12, 4, 11, '#d88a3a'); P(x, 13, 6, '#e05020'); P(x, 13, 4, '#a8a8b0'); P(x, 14, 2, '#c8c8d0'); });
    icon('joint', (x) => { line(x, 2, 12, 12, 5, '#f0ead8'); line(x, 3, 12, 13, 5, '#e0d8c0'); P(x, 13, 4, '#e05020'); P(x, 12, 4, '#60a040'); P(x, 14, 2, '#c8d8c8'); P(x, 13, 1, '#a8c0a8'); });
    icon('cocaine', (x) => { R(x, 3, 5, 10, 8, '#e8e8f0'); R(x, 3, 5, 10, 1, '#ffffff'); R(x, 3, 5, 1, 8, '#c8c8d8'); R(x, 6, 3, 4, 2, '#e8e8f0'); P(x, 7, 8, '#ffffff'); P(x, 9, 10, '#ffffff'); });
    const pills = (name, col) => icon(name, (x) => { R(x, 4, 4, 8, 10, '#e88a2a'); R(x, 4, 4, 8, 1, '#f0a040'); R(x, 3, 2, 10, 2, '#f4f0e8'); R(x, 6, 8, 4, 3, '#f4f0e8'); ell(x, 12, 13, 2, 1, col); });
    pills('pills_white', '#f4f4f8'); pills('pills_red', '#e04040');
    icon('lsd', (x) => { R(x, 3, 3, 10, 10, '#f4f0e8'); for (let i = 0; i < 4; i++) R(x, 4 + i * 2, 4 + i * 2, 2, 2, ['#e040e0', '#40c0e0', '#e0e040', '#40e080'][i]); line(x, 3, 8, 13, 8, '#c8c0b0'); line(x, 8, 3, 8, 13, '#c8c0b0'); });
    icon('weed', (x) => { R(x, 3, 4, 10, 10, 'rgba(220,230,220,0.9)'); R(x, 3, 4, 10, 2, '#e8ece8'); ell(x, 8, 10, 3, 2, '#5a9a3a'); P(x, 6, 9, '#7ac850'); P(x, 10, 11, '#3a7a2a'); P(x, 8, 8, '#7ac850'); });
    icon('edible', (x) => { R(x, 3, 6, 10, 7, '#5a3a20'); R(x, 3, 6, 10, 2, '#7a5030'); P(x, 5, 9, '#3a2010'); P(x, 9, 10, '#3a2010'); P(x, 11, 7, '#5a9a3a'); });
    icon('crack', (x) => { ell(x, 6, 10, 2, 2, '#e8e0c8'); ell(x, 10, 9, 2, 1, '#d8d0b8'); ell(x, 9, 12, 1, 1, '#f0e8d0'); R(x, 2, 3, 12, 2, '#a8c8d8'); line(x, 3, 4, 13, 4, '#d8e8f0'); });
    icon('heroin', (x) => { R(x, 4, 5, 8, 8, '#c8a878'); R(x, 4, 5, 8, 1, '#d8b888'); line(x, 9, 12, 14, 2, '#e8f0f8'); P(x, 14, 1, '#a8acb4'); P(x, 6, 8, '#a08050'); });
    icon('naloxone', (x) => { R(x, 6, 4, 4, 10, '#e8e4dc'); R(x, 7, 1, 2, 3, '#e8e4dc'); R(x, 6, 7, 4, 3, '#d03030'); R(x, 5, 13, 6, 2, '#d03030'); });
    // ---- skill icons
    icon('speech', (x) => { ell(x, 8, 7, 6, 4, '#f0e8d8'); R(x, 4, 10, 3, 3, '#f0e8d8'); P(x, 3, 13, '#f0e8d8'); P(x, 5, 7, '#8a7a5a'); P(x, 8, 7, '#8a7a5a'); P(x, 11, 7, '#8a7a5a'); });
    icon('eye', (x) => { ell(x, 8, 8, 6, 3, '#f0e8d8'); ell(x, 8, 8, 2, 2, '#4a7ac8'); P(x, 8, 8, '#1e1e22'); P(x, 7, 7, '#ffffff'); });
    icon('crown', (x) => { R(x, 3, 8, 10, 4, '#e0b840'); P(x, 3, 6, '#e0b840'); P(x, 3, 7, '#e0b840'); R(x, 7, 5, 2, 3, '#e0b840'); P(x, 12, 6, '#e0b840'); P(x, 12, 7, '#e0b840'); P(x, 8, 9, '#d03040'); P(x, 5, 10, '#40a0e0'); P(x, 11, 10, '#40a0e0'); });
    icon('mask', (x) => { ell(x, 8, 7, 6, 4, '#2a2a30'); ell(x, 5, 7, 1, 1, '#e8e4dc'); ell(x, 11, 7, 1, 1, '#e8e4dc'); R(x, 2, 6, 1, 2, '#2a2a30'); R(x, 13, 6, 1, 2, '#2a2a30'); });
    icon('keycard', (x) => { R(x, 2, 4, 12, 8, '#e8e4dc'); R(x, 2, 4, 12, 2, '#2a6ad8'); R(x, 4, 8, 4, 3, '#c8a050'); R(x, 9, 8, 4, 1, '#8a8e96'); });
    icon('spoon', (x) => { line(x, 3, 13, 10, 6, '#c8ccd4'); ell(x, 11, 4, 2, 3, '#d8dce4'); P(x, 11, 3, '#ffffff'); });
    icon('condom', (x) => { R(x, 3, 3, 10, 10, '#c0c8d8'); R(x, 4, 4, 8, 8, '#8a9ab8'); R(x, 5, 5, 6, 6, '#c0c8d8'); R(x, 6, 6, 4, 4, '#e8eef8'); for (let i = 3; i < 13; i += 2) { P(x, i, 2, '#c0c8d8'); P(x, i, 13, '#c0c8d8'); } });
    icon('water', (x) => { R(x, 6, 2, 4, 2, '#3a7ac8'); R(x, 5, 4, 6, 10, 'rgba(180,220,255,0.9)'); R(x, 5, 7, 6, 7, '#6ab0f0'); P(x, 6, 5, '#ffffff'); });
    icon('shovel', (x) => { line(x, 4, 12, 12, 2, '#8a6a3a'); R(x, 1, 11, 5, 4, '#8a8e96'); R(x, 1, 11, 5, 1, '#c8ccd4'); R(x, 11, 1, 3, 2, '#2a2a30'); });
    icon('swim', (x) => { for (let i = 0; i < 3; i++) line(x, 1, 11 + i * 2, 15, 11 + i * 2, i % 2 ? '#4a8ad8' : '#8ac0f0'); ell(x, 7, 7, 2, 2, '#e0b088'); line(x, 9, 9, 14, 7, '#e0b088'); line(x, 5, 9, 2, 8, '#e0b088'); });
    icon('heart', (x) => { ell(x, 5, 6, 3, 3, '#d02838'); ell(x, 11, 6, 3, 3, '#d02838'); for (let y = 0; y < 6; y++) R(x, 2 + y, 7 + y, 12 - y * 2, 1, '#d02838'); P(x, 4, 5, '#f08080'); });
    icon('key', (x) => { ell(x, 5, 5, 3, 3, '#e0b840'); ell(x, 5, 5, 1, 1, 'rgba(0,0,0,0)'); x.clearRect(5, 5, 1, 1); line(x, 7, 7, 13, 13, '#e0b840'); P(x, 11, 13, '#e0b840'); P(x, 13, 11, '#e0b840'); });
    icon('ring', (x) => { ell(x, 8, 9, 5, 5, '#e0b840'); ell(x, 8, 9, 3, 3, '#000'); x.clearRect(5, 7, 7, 5); ell(x, 8, 4, 2, 2, '#40c0e0'); });
    icon('coin', (x) => { ell(x, 8, 8, 5, 5, '#e0b840'); ell(x, 8, 8, 3, 3, '#f0d060'); P(x, 7, 6, '#fff6c0'); });
    icon('letter', (x) => { R(x, 2, 4, 12, 9, '#f0e8d8'); line(x, 2, 4, 8, 9, '#a09888'); line(x, 13, 4, 8, 9, '#a09888'); P(x, 8, 10, '#c03030'); });
    icon('package', (x) => { R(x, 3, 4, 10, 9, '#a07a4a'); R(x, 7, 4, 2, 9, '#d8d2c4'); R(x, 3, 8, 10, 1, '#d8d2c4'); });
    icon('fish', (x) => { ell(x, 7, 8, 5, 3, '#6a8aa8'); line(x, 12, 8, 15, 5, '#6a8aa8'); line(x, 12, 8, 15, 11, '#6a8aa8'); P(x, 4, 7, '#1d1a22'); ell(x, 7, 9, 3, 1, '#a8c0d8'); });
    icon('wheat', (x) => { for (let i = 0; i < 3; i++) { line(x, 5 + i * 3, 14, 5 + i * 3, 3, '#c9a33c'); ell(x, 5 + i * 3, 4, 1, 2, '#f0d470'); } });
    icon('cheese', (x) => { for (let y = 0; y < 8; y++) R(x, 3, 5 + y, 3 + y, 1, '#f0c840'); P(x, 5, 9, '#c8a020'); P(x, 7, 11, '#c8a020'); });
    icon('ale', (x) => { R(x, 4, 4, 7, 10, '#8a5a2e'); R(x, 4, 3, 7, 2, '#f4f0e8'); R(x, 11, 6, 2, 5, '#6b4423'); R(x, 5, 7, 5, 6, '#c8902a'); });
    icon('torch', (x) => { line(x, 5, 14, 9, 6, '#6b4423'); ell(x, 10, 4, 2, 3, '#e0602a'); P(x, 10, 4, '#f8c040'); });
    icon('gem', (x) => { R(x, 5, 4, 6, 2, '#60d0f0'); for (let y = 0; y < 6; y++) R(x, 5 + y / 2, 6 + y, 6 - y, 1, '#40a8d0'); P(x, 6, 4, '#ffffff'); });
    icon('book', (x) => { R(x, 3, 2, 10, 12, '#6a2a2a'); R(x, 4, 3, 8, 10, '#8a3a3a'); R(x, 12, 3, 1, 10, '#f0e8d8'); R(x, 6, 5, 4, 1, '#c8a050'); });
    icon('bandage', (x) => { ell(x, 8, 8, 5, 5, '#f0e8d8'); ell(x, 8, 8, 2, 2, '#c8c0b0'); R(x, 10, 11, 4, 2, '#f0e8d8'); });
    icon('ore', (x) => { ell(x, 8, 9, 6, 4, '#6a6660'); P(x, 6, 8, '#c87a40'); P(x, 9, 10, '#c87a40'); P(x, 10, 7, '#e09a5a'); });
    icon('ingot', (x) => { for (let y = 0; y < 5; y++) R(x, 3 + y, 6 + y, 10 - y, 1, y === 0 ? '#d8dce4' : '#a8acb4'); });
    icon('wood', (x) => { R(x, 2, 6, 12, 4, '#7b4f2a'); ell(x, 13, 8, 1, 2, '#b08a5a'); R(x, 2, 10, 12, 3, '#6b4423'); ell(x, 13, 11, 1, 1, '#b08a5a'); });
    icon('amulet', (x) => { line(x, 3, 2, 8, 9, '#c8a050'); line(x, 13, 2, 8, 9, '#c8a050'); ell(x, 8, 11, 3, 3, '#a02a3a'); P(x, 7, 10, '#f08080'); });
    icon('oil', (x) => { R(x, 6, 1, 4, 2, '#5b3a1e'); R(x, 7, 3, 2, 2, '#a8b0b8'); R(x, 4, 5, 8, 9, '#a8b0b8'); R(x, 5, 7, 6, 6, '#3a2a10'); P(x, 5, 6, '#ffffff'); });
    icon('firebomb', (x) => { ell(x, 8, 10, 4, 4, '#6a8a50'); R(x, 7, 3, 2, 4, '#6a8a50'); R(x, 6, 1, 4, 2, '#d8d0b0'); P(x, 9, 0, '#f08a20'); P(x, 10, 0, '#f8d040'); P(x, 6, 9, '#ffffff'); });
    icon('scissors', (x) => { ell(x, 4, 12, 2, 2, '#c03030'); ell(x, 9, 12, 2, 2, '#c03030'); line(x, 5, 10, 12, 2, '#c8ccd4'); line(x, 8, 10, 3, 2, '#c8ccd4'); });
    // ---- modern replacements (same names overwrite the older drawings)
    icon('cue', (x) => { line(x, 1, 15, 14, 2, '#d8b880'); line(x, 1, 14, 5, 10, '#3a2a1a'); P(x, 14, 1, '#4a8ad8'); });
    icon('pipe', (x) => { line(x, 2, 14, 12, 4, '#6a6e76'); line(x, 3, 14, 13, 4, '#8a8e96'); R(x, 11, 2, 4, 3, '#6a6e76'); R(x, 1, 12, 3, 3, '#6a6e76'); });
    icon('pocket_knife', (x) => { R(x, 3, 9, 6, 3, '#a03030'); P(x, 4, 10, '#f0f0f0'); line(x, 9, 9, 13, 5, '#d8dce4'); line(x, 9, 10, 13, 6, '#a8acb4'); });
    icon('fire_axe', (x) => { line(x, 3, 14, 11, 4, '#c8a050'); line(x, 4, 14, 12, 4, '#a07a30'); R(x, 9, 1, 5, 4, '#c82828'); R(x, 13, 2, 2, 2, '#d8dce4'); R(x, 7, 3, 2, 2, '#c82828'); });
    icon('pitchfork', (x) => { line(x, 2, 14, 10, 6, '#8a6a3a'); line(x, 9, 7, 13, 3, '#a8acb4'); line(x, 8, 5, 11, 2, '#a8acb4'); line(x, 11, 8, 14, 5, '#a8acb4'); line(x, 8, 5, 11, 8, '#a8acb4'); });
    icon('spiked_bat', (x) => { line(x, 2, 14, 12, 4, '#b08a5a'); line(x, 3, 14, 13, 4, '#c8a070'); for (const [a, b] of [[9, 4], [12, 7], [10, 2], [14, 5], [8, 7]]) P(x, a, b, '#d8dce4'); });
    icon('katana', (x) => { line(x, 4, 12, 14, 2, '#e0e6f0'); line(x, 5, 12, 14, 3, '#a8b0c0'); line(x, 3, 11, 5, 13, '#c8a050'); line(x, 1, 15, 3, 13, '#2a2a30'); P(x, 2, 14, '#c83030'); });
    icon('spray', (x) => { R(x, 5, 5, 6, 10, '#e8e4dc'); R(x, 5, 8, 6, 3, '#d02828'); R(x, 6, 2, 4, 3, '#4a4a52'); R(x, 10, 3, 3, 1, '#4a4a52'); });
    icon('trauma_kit', (x) => { R(x, 1, 5, 14, 9, '#c83030'); R(x, 6, 3, 4, 2, '#5a5a62'); R(x, 7, 7, 2, 5, '#ffffff'); R(x, 5, 8, 6, 3, '#ffffff'); R(x, 1, 5, 14, 1, '#e05050'); });
    icon('syringe', (x) => { line(x, 3, 13, 11, 5, '#e8f0f8'); line(x, 4, 13, 12, 5, '#c8d8e8'); line(x, 5, 10, 9, 6, '#e04040'); line(x, 11, 5, 14, 2, '#a8acb4'); line(x, 1, 13, 4, 15, '#5a5a62'); });
    icon('gold_chain', (x) => { for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1); P(x, Math.round(8 + Math.cos(a) * 6), Math.round(5 + Math.sin(a) * 7), i % 2 ? '#f0d060' : '#c8a030'); } ell(x, 8, 12, 2, 2, '#e0b840'); P(x, 8, 12, '#fff6c0'); });
    icon('watch', (x) => { R(x, 6, 1, 4, 14, '#2a2a30'); ell(x, 8, 8, 4, 4, '#c8a050'); ell(x, 8, 8, 3, 3, '#f4f0e8'); line(x, 8, 8, 8, 6, '#1e1e22'); line(x, 8, 8, 10, 8, '#1e1e22'); });
    icon('flashlight', (x) => { R(x, 2, 6, 9, 4, '#2a2a30'); R(x, 10, 5, 3, 6, '#4a4a52'); R(x, 13, 6, 1, 4, '#fff6a0'); R(x, 4, 7, 2, 1, '#5a5a62'); });
    icon('phone', (x) => { R(x, 5, 2, 7, 12, '#1e1e22'); R(x, 6, 3, 5, 9, '#4a7ac8'); P(x, 8, 13, '#5a5a62'); P(x, 7, 5, '#8ab0e8'); });
    icon('wallet', (x) => { R(x, 2, 5, 12, 8, '#5a3a1e'); R(x, 2, 5, 12, 2, '#7b4f2a'); R(x, 10, 8, 4, 3, '#4a2f16'); P(x, 12, 9, '#c8a050'); });
    icon('jewelry', (x) => { ell(x, 6, 9, 4, 4, '#e0b840'); x.clearRect(5, 8, 3, 3); ell(x, 11, 6, 2, 2, '#f4f0f8'); ell(x, 12, 11, 2, 2, '#f4f0f8'); P(x, 6, 5, '#40c0e0'); });
    icon('coin', (x) => { R(x, 1, 4, 14, 8, '#5aa048'); R(x, 2, 5, 12, 6, '#7cc060'); ell(x, 8, 8, 2, 2, '#3a7a2a'); R(x, 3, 6, 1, 1, '#3a7a2a'); R(x, 12, 9, 1, 1, '#3a7a2a'); });
    icon('torch', (x) => { R(x, 5, 6, 6, 9, '#c83030'); R(x, 5, 6, 6, 1, '#e05050'); R(x, 6, 3, 4, 3, '#a8acb4'); P(x, 7, 4, '#5a5a62'); P(x, 8, 1, '#f8c040'); P(x, 8, 2, '#e0602a'); });
    icon('oil', (x) => { R(x, 3, 4, 10, 10, '#c82828'); R(x, 3, 4, 10, 1, '#e05050'); R(x, 9, 1, 3, 3, '#e0c040'); R(x, 4, 2, 4, 2, '#2a2a30'); R(x, 5, 8, 6, 3, '#e0c040'); });
    icon('cooked_meat', (x) => { ell(x, 8, 6, 6, 3, '#d8a050'); R(x, 2, 8, 12, 2, '#6a3a1e'); R(x, 2, 7, 12, 1, '#6ab048'); R(x, 2, 10, 12, 1, '#f0c040'); ell(x, 8, 12, 6, 2, '#d8a050'); P(x, 6, 4, '#f4e8c0'); P(x, 10, 5, '#f4e8c0'); });
    icon('ore', (x) => { R(x, 2, 9, 6, 4, '#7a7e86'); R(x, 7, 6, 6, 6, '#8a6a4a'); line(x, 3, 6, 9, 12, '#a8acb4'); P(x, 10, 8, '#5a5e66'); });
    icon('ingot', (x) => { ell(x, 8, 8, 6, 5, '#c87a3a'); ell(x, 8, 8, 4, 3, '#e09a5a'); ell(x, 8, 8, 2, 1, '#a0602a'); line(x, 13, 9, 15, 13, '#c87a3a'); });
    icon('ring', (x) => { ell(x, 8, 9, 5, 5, '#c8ccd4'); x.clearRect(5, 7, 7, 5); ell(x, 8, 4, 2, 2, '#e8ecf4'); });
    armor('armor_cloth', '#4a6a9a'); armor('armor_leather', '#5a3a26'); armor('armor_chain', '#4a4e56'); armor('armor_plate', '#1e2228');
    icon('unknown', (x) => { R(x, 4, 4, 8, 8, '#8a8780'); R(x, 7, 6, 2, 3, '#f4f0e8'); P(x, 7, 10, '#f4f0e8'); });
  }

  // Cached white silhouette of an image (hurt flash).
  function white(img) {
    let w = whiteCache.get(img);
    if (!w) {
      const { c, x } = mk(img.width, img.height);
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, c.width, c.height);
      w = c;
      whiteCache.set(img, w);
    }
    return w;
  }

  return {
    TS, tiles, sprites, icons, shade, mix, mk, outline,
    init() { genTiles(); genSprites(); genFire(); genIcons(); },
    tile(name, v = 0) { const t = tiles[name]; return t ? t[v % t.length] : null; },
    character, animal, white, clothIcon, HAIR_STYLES, TOP_STYLES, BOTTOM_STYLES,
    icon(name) { return name && name.startsWith('cloth|') ? clothIcon(name) : icons[name] || icons.unknown; },
  };
})();
