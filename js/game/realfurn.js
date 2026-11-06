'use strict';
// Furniture painted by hand at four times the density of the world, in the three-quarter view the game is seen from: a lit top,
// a front in shadow, materials that behave like materials (grain in wood, sheen on enamel and chrome, weave in cloth).
// Beds are finally as long as the people who sleep in them. Everything here draws in sprite units.
(() => {
const D = 6, A = G.assets, sh = A.shade, ART = {};
const noise = (() => { let c = null; return () => { if (c) return c; c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), im = x.createImageData(128, 128), d = im.data; for (let i = 0; i < d.length; i += 4) { const k = i / 4, n = Math.sin((k % 128) * 12.9898 + Math.floor(k / 128) * 78.233) * 43758.5453, v = 226 + ((n - Math.floor(n)) - 0.5) * 34; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } x.putImageData(im, 0, 0); return c; }; })();
const grad = (x, x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const rr = (x, X, Y, W, H, r) => { x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + W - r, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + r); x.lineTo(X + W, Y + H - r); x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H); x.lineTo(X + r, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - r); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath(); };
const fill = (x, X, Y, W, H, r, f) => { rr(x, X, Y, W, H, Math.min(r, 0.5));   // (made, not moulded: corners are corners)
 x.fillStyle = f; x.fill(); };
const line = (x, c, w, ...p) => { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.stroke(); };
const wood = (x, X, Y, W, H, col, seed = 1) => {   // planks of real grain along the length of the piece
  x.fillStyle = col; x.fillRect(X, Y, W, H); let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  for (let i = 0; i < H * 2.4; i++) { const y = Y + rnd() * H; x.strokeStyle = rnd() < 0.5 ? `rgba(40,20,8,${0.08 + rnd() * 0.14})` : `rgba(255,220,170,${0.05 + rnd() * 0.08})`; x.lineWidth = 0.18 + rnd() * 0.24; x.beginPath(); x.moveTo(X, y); x.bezierCurveTo(X + W * 0.3, y + rnd() - 0.5, X + W * 0.6, y + rnd() - 0.5, X + W, y + (rnd() - 0.5)); x.stroke(); }
};
const gloss = (x, X, Y, W, H) => { const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(0.32, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.1)'); x.fillStyle = g; x.fillRect(X, Y, W, H); };
const WOOD = '#7e5230', DARK = '#4e3220', LIGHT = '#a87a4a', CHROME = ['#f0f2f4', '#a4a8b0', '#dfe2e6', '#7e828a'];
function make(name, w, h, fn) {
  const c = document.createElement('canvas'); c.width = w * D; c.height = h * D;
  const x = c.getContext('2d'); x.scale(D, D); x.imageSmoothingEnabled = true; fn(x, w, h);
  // the fine unevenness of anything real, only where something was painted
  x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.5; x.scale(1 / D, 1 / D); x.globalCompositeOperation = 'multiply'; x.fillStyle = x.createPattern(noise(), 'repeat'); x.fillRect(0, 0, c.width, c.height); x.restore();
  // form and use: light falling from above, the foot of a thing in shade, the fine scratches of years
  x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 1; x.setTransform(D, 0, 0, D, 0, 0); const vol = x.createLinearGradient(0, 0, 0, h); vol.addColorStop(0, 'rgba(255,248,232,0.13)'); vol.addColorStop(0.5, 'rgba(255,255,255,0)'); vol.addColorStop(1, 'rgba(0,0,0,0.2)'); x.fillStyle = vol; x.fillRect(0, 0, w, h);
  let sd = name.length * 7919; const rn = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  for (let i = 0; i < w * h / 26; i++) { const a = rn() * w, b = rn() * h, l = 0.6 + rn() * 2.4, t = rn() * 6.3; x.strokeStyle = rn() < 0.5 ? 'rgba(255,245,230,0.09)' : 'rgba(20,12,6,0.13)'; x.lineWidth = 0.1; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(t) * l, b + Math.sin(t) * l); x.stroke(); }
  x.restore();
  x.globalCompositeOperation = 'destination-in'; x.setTransform(1, 0, 0, 1, 0, 0); const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; k.getContext('2d').scale(D, D); fn(k.getContext('2d'), w, h); x.drawImage(k, 0, 0);
  ART[name] = c;
}
function bed(name, blanket, w = 16, h = 30) {
  make(name, w, h, (x, W, H) => {
    fill(x, 0, 2, W, H - 2, 1, DARK); wood(x, 0, 0, W, 5, WOOD, 3); x.fillStyle = 'rgba(255,230,190,0.2)'; x.fillRect(0, 0, W, 0.6);   // the headboard
    fill(x, 1, 4, W - 2, H - 7, 1, grad(x, 0, 4, W, H, ['#efe9dc', '#d4cdbd']));   // the mattress and sheet
    for (const [px, pw] of W > 20 ? [[2.2, W / 2 - 3], [W / 2 + 0.8, W / 2 - 3]] : [[2.2, W - 4.4]]) { fill(x, px, 5.4, pw, 6.6, 1.8, grad(x, px, 5, px + pw, 12, ['#ffffff', '#dcd6ca'])); line(x, 'rgba(120,110,100,0.4)', 0.3, px + 1.8, 11.2, px + pw - 1.8, 11.2); line(x, 'rgba(140,130,120,0.32)', 0.3, px + 2.8, 8, px + 4.8, 9.4); }
    fill(x, 1, 13, W - 2, H - 16, 0.8, grad(x, 0, 13, W, 13, [sh(blanket, 0.66), blanket, sh(blanket, 1.18), blanket, sh(blanket, 0.62)]));   // the blanket
    x.fillStyle = '#f2ece0'; x.fillRect(1, 13, W - 2, 2.6); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(1, 15.6, W - 2, 0.5);
    for (const [a, b, c] of [[3, 19, 8], [W - 5, 22, 10], [W / 2, 25, 6]]) { line(x, 'rgba(0,0,0,0.13)', 0.5, a, b, a + c * 0.3, b + c); }
    wood(x, 0, H - 3, W, 3, DARK, 7); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, H - 1, W, 1);
  });
}
function build() {
  bed('bed', '#3e5a8e'); bed('bed_red', '#8e3a3a'); bed('bed_green', '#3e7a50'); bed('bed_double', '#5a6a9a', 30, 30);
  for (const [n, c] of [['grey', '#5a5c62'], ['brown', '#6a5440'], ['quilt', '#7a5a48'], ['navy', '#2e3a54'], ['stained', '#7a7460'], ['white', '#c4c0b2'], ['kid', '#4e7a6a']]) bed('v_bed_' + n, c);
  make('wardrobe', 16, 27, (x, W, H) => { wood(x, 0, 0, W, 5, LIGHT, 2); wood(x, 0, 4, W, H - 5, WOOD, 3); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(W / 2 - 0.25, 5, 0.5, H - 7); for (const p of [1.4, W / 2 + 1]) { x.strokeStyle = 'rgba(0,0,0,0.32)'; x.lineWidth = 0.4; x.strokeRect(p, 7, W / 2 - 2.4, H - 12); x.fillStyle = 'rgba(255,230,190,0.08)'; x.fillRect(p, 7, W / 2 - 2.4, H - 12); } fill(x, W / 2 - 2, H / 2, 0.9, 3, 0.4, '#d8c070'); fill(x, W / 2 + 1.1, H / 2, 0.9, 3, 0.4, '#d8c070'); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, H - 1.4, W, 1.4); });
  make('nightstand', 10, 14, (x, W, H) => { wood(x, 0, 3, W, 3, LIGHT, 4); wood(x, 0, 6, W, H - 7, WOOD, 5); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0.6, 9.6, W - 1.2, 0.4); fill(x, W / 2 - 1, 7.4, 2, 0.8, 0.3, '#d8c070'); fill(x, W / 2 - 1, 11, 2, 0.8, 0.3, '#d8c070'); fill(x, 3.6, 0.6, 3, 2.8, 1, '#efe2bc'); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, H - 1, W, 1); });
  make('fridge', 14, 24, (x, W, H) => { fill(x, 0, 0, W, H, 1.4, grad(x, 0, 0, W, 0, ['#fbfbf8', '#e6e6e2', '#c6c6c2'])); x.fillStyle = grad(x, 0, 0, 0, 4, ['#ffffff', '#d4d4d0']); x.fillRect(0.6, 0.6, W - 1.2, 3.4); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0.6, 11, W - 1.2, 0.5); fill(x, W - 2.8, 5.4, 0.9, 4.4, 0.4, '#8a8e94'); fill(x, W - 2.8, 12.6, 0.9, 6, 0.4, '#8a8e94'); gloss(x, 1, 4, W / 3, H - 6); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0.6, H - 1, W - 1.2, 1); });
  make('stove', 15, 17, (x, W, H) => { fill(x, 0, 0, W, H, 0.8, grad(x, 0, 0, W, 0, ['#e6e6e2', '#d8d8d4', '#b4b4b0'])); fill(x, 0.8, 0.6, W - 1.6, 6, 0.5, '#1c1c1e'); for (const [a, b] of [[4, 2.2], [11, 2.2], [4, 5], [11, 5]]) { x.strokeStyle = '#4a4a4e'; x.lineWidth = 0.5; x.beginPath(); x.ellipse(a, b, 2, 1.1, 0, 0, 6.3); x.stroke(); } fill(x, 2, 8.6, W - 4, 6.4, 0.5, grad(x, 0, 8, 0, 15, ['#20242a', '#54606a', '#16181c'])); fill(x, 3, 7.7, W - 6, 0.6, 0.3, '#9a9ea4'); for (let i = 3; i < W - 2; i += 3) { x.fillStyle = '#3a3a3e'; x.beginPath(); x.arc(i, 7.1, 0.3, 0, 6.3); x.fill(); } x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, H - 1, W, 1); });
  make('toilet', 10, 15, (x, W, H) => { fill(x, 1.4, 0, W - 2.8, 5, 0.8, grad(x, 0, 0, W, 0, ['#fff', '#e8e8e4', '#c8c8c4'])); fill(x, W / 2 - 0.8, 0.6, 1.6, 0.6, 0.2, CHROME[1]); x.fillStyle = grad(x, 0, 4, W, 15, ['#ffffff', '#cfcfca']); x.beginPath(); x.ellipse(W / 2, 9, 4.4, 5.4, 0, 0, 6.3); x.fill(); x.fillStyle = '#b8d0dc'; x.beginPath(); x.ellipse(W / 2, 9, 2.8, 3.6, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 0.3; x.beginPath(); x.ellipse(W / 2, 9, 2.8, 3.6, 0, 0, 6.3); x.stroke(); });
  make('sink', 12, 15, (x, W, H) => { wood(x, 0, 5, W, H - 6, WOOD, 6); fill(x, 0, 2, W, 5, 0.6, grad(x, 0, 2, 0, 7, ['#ffffff', '#c8c8c4'])); fill(x, 2, 3, W - 4, 3, 1.2, grad(x, 0, 3, 0, 6, ['#9aa2a8', '#dfe4e6'])); line(x, CHROME[1], 0.8, W / 2, 3, W / 2, 1.2, W / 2 + 1.6, 1.2); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(W / 2 - 0.2, 7, 0.4, H - 9); });
  make('kcounter_sink', 16, 15, (x, W, H) => { wood(x, 0, 5, W, H - 6, '#6a5a4a', 7); fill(x, 0, 2, W, 4, 0.4, grad(x, 0, 2, W, 6, ['#d8d4cc', '#a8a49c'])); fill(x, 3, 2.6, W - 6, 2.6, 0.8, grad(x, 0, 2, 0, 6, ['#70767c', '#c8ccd0'])); line(x, CHROME[1], 0.7, W / 2, 2.8, W / 2, 0.8, W / 2 + 1.8, 0.8); });
  make('shower', 15, 26, (x, W, H) => { fill(x, 0, 0, W, H, 1, grad(x, 0, 0, W, H, ['#dce6ea', '#b4c4ca'])); for (let j = 2; j < H - 8; j += 3) for (let i = 1; i < W; i += 3) { x.strokeStyle = 'rgba(90,110,120,0.3)'; x.lineWidth = 0.2; x.strokeRect(i, j, 3, 3); } fill(x, 1, H - 9, W - 2, 8, 0.8, grad(x, 0, H - 9, 0, H, ['#c8d0d2', '#f0f2f2'])); x.fillStyle = '#7a8488'; x.beginPath(); x.ellipse(W / 2, H - 5, 1.2, 0.7, 0, 0, 6.3); x.fill(); line(x, CHROME[1], 0.6, W - 3, 5, W - 3, 2, W / 2, 2); fill(x, W / 2 - 1.6, 1.8, 3.2, 1, 0.4, CHROME[0]); x.fillStyle = 'rgba(230,245,250,0.26)'; x.fillRect(0.4, 0.4, 2.4, H - 1); });
  make('bathtub', 31, 15, (x, W, H) => { fill(x, 0, 0, W, H, 3, grad(x, 0, 0, 0, H, ['#ffffff', '#d4d4d0'])); fill(x, 2.4, 2, W - 4.8, H - 5, 3, grad(x, 0, 2, 0, H, ['#a4bcc8', '#dcecf2'])); line(x, CHROME[1], 0.9, 4, 3, 4, 1, 6, 1); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, H - 1, W - 2, 1); });
  make('desk', 30, 16, (x, W, H) => { wood(x, 0, 2, W, 5, LIGHT, 8); gloss(x, 0, 2, W, 5); wood(x, 0, 7, W, 3, WOOD, 9); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, 10, W, 0.4); wood(x, 1, 10, 9, H - 10, WOOD, 3); wood(x, W - 10, 10, 9, H - 10, WOOD, 4); x.fillStyle = 'rgba(0,0,0,0.34)'; x.fillRect(10, 10, W - 20, H - 10); for (const p of [11, 13.6]) { fill(x, 4.4, p, 2.2, 0.6, 0.2, '#d8c070'); fill(x, W - 6.6, p, 2.2, 0.6, 0.2, '#d8c070'); } fill(x, 18, 0, 8, 5, 0.5, '#1c1e24'); fill(x, 18.6, 0.6, 6.8, 3.4, 0.2, grad(x, 18, 0, 26, 4, ['#6a8aa8', '#24344a'])); });
  make('table', 22, 14, (x, W, H) => { wood(x, 0, 1, W, 8, '#5a3620', 10); gloss(x, 0, 1, W, 8); x.strokeStyle = 'rgba(20,10,4,0.6)'; x.lineWidth = 0.4; x.strokeRect(0.2, 1.2, W - 0.4, 7.6); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 9, W, 1.4); for (const p of [1, W - 3]) { wood(x, p, 10, 2, H - 10, WOOD, 2); } });
  make('coffee_table', 22, 10, (x, W, H) => { wood(x, 0, 0, W, 6, WOOD, 11); gloss(x, 0, 0, W, 6); x.fillStyle = 'rgba(0,0,0,0.34)'; x.fillRect(0, 6, W, 1); for (const p of [1, W - 2.4]) { wood(x, p, 7, 1.4, 3, DARK, 2); } });
  make('chair', 8, 11, (x, W, H) => { wood(x, 0.4, 0, W - 0.8, 5, DARK, 12); x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(1, 1, W - 2, 3); fill(x, 0, 4.6, W, 3.2, 0.5, '#7a4e2a'); fill(x, 0.8, 4.8, W - 1.6, 2.4, 0.5, grad(x, 0, 4, 0, 8, ['#a87a4a', '#7a5230'])); for (const p of [0.4, W - 1.4]) { x.fillStyle = DARK; x.fillRect(p, 7.8, 1, 3.2); } });
  make('couch', 30, 16, (x, W, H) => { const c = '#5a6a7e'; fill(x, 0, 0, W, 9, 2, grad(x, 0, 0, 0, 9, [sh(c, 1.14), sh(c, 0.82)])); fill(x, 0, 2, 4, H - 3, 1.6, grad(x, 0, 0, 4, 0, [sh(c, 1.1), sh(c, 0.84)])); fill(x, W - 4, 2, 4, H - 3, 1.6, grad(x, W - 4, 0, W, 0, [sh(c, 1), sh(c, 0.7)])); for (const p of [4, W / 2]) fill(x, p, 7, W / 2 - 4, 7, 1, grad(x, 0, 7, 0, 14, [sh(c, 1.26), sh(c, 0.92)])); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(W / 2 - 0.2, 7, 0.4, 7); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(1, H - 2, W - 2, 2); });
  make('armchair', 14, 15, (x, W, H) => { const c = '#7a4a3a'; fill(x, 0, 0, W, 9, 2, grad(x, 0, 0, 0, 9, [sh(c, 1.14), sh(c, 0.8)])); fill(x, 0, 2, 3.2, H - 3, 1.4, sh(c, 1)); fill(x, W - 3.2, 2, 3.2, H - 3, 1.4, sh(c, 0.82)); fill(x, 3, 7, W - 6, 6.6, 1, grad(x, 0, 7, 0, 14, [sh(c, 1.26), sh(c, 0.92)])); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(1, H - 1.4, W - 2, 1.4); });
  make('tv', 14, 14, (x, W, H) => { fill(x, 0, 0, W, 10, 0.6, '#101014'); fill(x, 0.8, 0.8, W - 1.6, 8.4, 0.2, grad(x, 0, 0, W, 10, ['#3a4e62', '#0e141c', '#1c2a38'])); wood(x, 2, 10.4, W - 4, H - 10.4, DARK, 3); });
  make('floorlamp', 8, 24, (x, W, H) => { fill(x, 1, 0, W - 2, 7, 1, grad(x, 0, 0, 0, 7, ['#fff0c8', '#e4c070'])); x.fillStyle = '#3a3a40'; x.fillRect(W / 2 - 0.3, 7, 0.6, H - 9); x.fillStyle = '#2a2a2e'; x.beginPath(); x.ellipse(W / 2, H - 1.4, 2.8, 1.1, 0, 0, 6.3); x.fill(); });
  make('plant', 10, 16, (x, W, H) => { fill(x, 2, 10, W - 4, 6, 1, grad(x, 0, 0, W, 0, ['#c0704a', '#9e5636', '#7a4028'])); x.fillStyle = '#2a1e16'; x.fillRect(2.6, 10, W - 5.2, 1); let r = 7; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; }; for (let i = 0; i < 24; i++) { const a = -Math.PI * (0.05 + rnd() * 0.9), l = 4 + rnd() * 5, ex = W / 2 + Math.cos(a) * l, ey = 10 + Math.sin(a) * l; x.strokeStyle = ['#2a6a34', '#3a8a44', '#1e5228', '#54a052'][i % 4]; x.lineWidth = 1.1; x.lineCap = 'round'; x.beginPath(); x.moveTo(W / 2, 10); x.quadraticCurveTo(W / 2 + Math.cos(a) * l * 0.5, 10 + Math.sin(a) * l * 0.9, ex, ey); x.stroke(); } x.lineCap = 'butt'; });
  make('shelf', 16, 24, (x, W, H) => { wood(x, 0, 0, W, H, DARK, 13); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(1, 1, W - 2, H - 2); const col = ['#8a2a2a', '#2a4a7a', '#3a6a3a', '#b08a3a', '#5a3a6a', '#c8c0a8', '#2e2e34']; let r = 3; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; }; for (let s = 0; s < 4; s++) { const y = 1 + s * 5.6; for (let p = 1.4; p < W - 2; ) { const w = 0.9 + rnd() * 1.1, h = 3 + rnd() * 1.6; if (rnd() > 0.12) { x.fillStyle = col[Math.floor(rnd() * col.length)]; x.fillRect(p, y + 5 - h, w, h); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(p, y + 5 - h, 0.2, h); } p += w + 0.1; } wood(x, 0.6, y + 5, W - 1.2, 0.7, LIGHT, s); } });
  make('crate', 14, 14, (x, W, H) => { wood(x, 0, 0, W, 4, LIGHT, 2); wood(x, 0, 4, W, H - 4, WOOD, 4); x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 0.4; x.strokeRect(0.3, 4.3, W - 0.6, H - 4.6); line(x, 'rgba(60,36,16,0.8)', 1, 1, 5, W - 1, H - 1); for (const [a, b] of [[1, 5], [W - 1, 5], [1, H - 1], [W - 1, H - 1]]) { x.fillStyle = '#26221e'; x.fillRect(a - 0.3, b - 0.3, 0.6, 0.6); } });
  make('counter', 32, 13, (x, W, H) => { fill(x, 0, 0, W, 5, 0.3, grad(x, 0, 0, W, 5, ['#d8d0c4', '#b0a89c'])); gloss(x, 0, 0, W, 5); wood(x, 0, 5, W, H - 6, WOOD, 14); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 5, W, 0.6); for (let p = 4; p < W; p += 8) { x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(p, 6, 0.3, H - 7); } });
  make('vending', 14, 24, (x, W, H) => { fill(x, 0, 0, W, H, 0.8, grad(x, 0, 0, W, 0, ['#b82828', '#8a1c1c'])); fill(x, 1, 1.6, W - 5, 15, 0.3, '#10141a'); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = ['#e0b040', '#40a0d0', '#e04848', '#60c060'][(i + j) % 4]; x.fillRect(1.8 + i * 1.8, 2.4 + j * 3.4, 1.1, 2.2); } gloss(x, 1, 1.6, W - 5, 15); fill(x, W - 3.2, 3, 2.2, 6, 0.3, '#2a2a30'); fill(x, 1, 18, W - 5, 4, 0.3, '#1a1a1e'); });
  make('v_stool', 10, 14, (x, W, H) => { x.fillStyle = '#3a3a40'; x.fillRect(W / 2 - 0.5, 4, 1, H - 6); x.beginPath(); x.ellipse(W / 2, H - 1.4, 3.4, 1.2, 0, 0, 6.3); x.fill(); x.fillStyle = grad(x, 0, 0, W, 0, ['#a03030', '#6a1a1a']); x.beginPath(); x.ellipse(W / 2, 2.8, 4.4, 2.2, 0, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.2)'; x.beginPath(); x.ellipse(W / 2 - 1, 2.2, 1.8, 0.7, 0, 0, 6.3); x.fill(); });
}
// beds grow one tile toward the foot; everything else keeps the footprint it has
G.realFurn = { ART, D, make, wood, gloss, fill, line, grad, BEDS: ['bed', 'bed_red', 'bed_green', 'bed_double', 'v_bed_grey', 'v_bed_brown', 'v_bed_quilt', 'v_bed_navy', 'v_bed_stained', 'v_bed_white', 'v_bed_kid'] };
const _init = A.init;
A.init = function () {
  for (const n of G.realFurn.BEDS) { const d = G.DECOR[n]; if (d && !d.pfh) { d.pfh = d.fh || 1; d.fh = 2; } }
  _init.call(this); build(); if (G.realFurn.more) G.realFurn.more();
  for (const n in ART) { const s = A.sprites[n]; if (!s) continue; const w = ART[n].width / D, h = ART[n].height / D; s.ax += Math.round((w - s.w) / 2); s.ay += h - s.h; s.w = w; s.h = h; s.real = true; }
};
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const a = s && ((o.ori && (ART[o.def.sprite + '_' + o.ori] || (/^f_/.test(o.def.sprite) ? null : ART['f_' + o.def.sprite + '_' + o.ori]))) || ART[o.def.sprite]);
  if (a) {   // (a turned piece stands on the same foot, whatever its size)
    const was = ctx.imageSmoothingEnabled, w = a.width / D, h = a.height / D, foot = s.h - s.ay; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(a, Math.round(o.x - s.ax + (s.w - w) / 2), Math.round(o.y + foot - h), w, h); ctx.imageSmoothingEnabled = was; return undefined;
  }
  return _dd.call(this, ctx, o, s, scene);
};
})();
