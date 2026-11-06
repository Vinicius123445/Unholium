'use strict';
// The fronts of buildings, drawn at full resolution over the ground: windows with frames, sills and the sky in the glass, doors
// with a frame, panels, hinges, a handle and a step, and a line of shadow and trim where a wall meets the pavement.
// Lit windows at night are still js/engine/tilemap.js drawWindowsLit, which lands on top of these.
(() => {
const D = 4, sh = G.assets.shade, cache = {};
const canvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w * D; c.height = h * D; const x = c.getContext('2d'); x.scale(D, D); fn(x, w, h); return c; };
const windowArt = (frame) => cache['w' + frame] || (cache['w' + frame] = canvas(14, 12, (x, W, H) => {
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0.4, 0.4, W - 0.8, H - 1);
  x.fillStyle = frame; x.fillRect(0.8, 0.4, W - 1.6, H - 2.2); x.fillStyle = sh(frame, 1.24); x.fillRect(0.8, 0.4, W - 1.6, 0.5);
  const g = x.createLinearGradient(1.6, 1.2, W - 1.6, H - 2.6); g.addColorStop(0, '#a8cee2'); g.addColorStop(0.36, '#6890ac'); g.addColorStop(0.5, '#2c4256'); g.addColorStop(0.72, '#3e5e78'); g.addColorStop(1, '#8cb0c6'); x.fillStyle = g; x.fillRect(1.8, 1.4, W - 3.6, H - 4.2);
  x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.moveTo(2.4, 1.4); x.lineTo(6, 1.4); x.lineTo(3, H - 2.8); x.lineTo(1.8, H - 2.8); x.closePath(); x.fill();
  x.fillStyle = frame; x.fillRect(W / 2 - 0.3, 1.2, 0.6, H - 3.8); x.fillRect(1.6, H / 2 - 1, W - 3.2, 0.5);
  x.fillStyle = '#c8c2b4'; x.fillRect(0.2, H - 1.8, W - 0.4, 1); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0.4, H - 0.8, W - 0.8, 0.7);
}));
const doorArt = (col) => cache['d' + col] || (cache['d' + col] = canvas(16, 16, (x, W, H) => {
  x.fillStyle = '#2a2622'; x.fillRect(0.8, 0, W - 1.6, H);
  x.fillStyle = '#d4cdbd'; x.fillRect(0.8, 0, W - 1.6, 1.2); x.fillRect(0.8, 0, 1.2, H); x.fillRect(W - 2, 0, 1.2, H);
  const g = x.createLinearGradient(2, 0, W - 2, 0); g.addColorStop(0, sh(col, 1.16)); g.addColorStop(0.5, col); g.addColorStop(1, sh(col, 0.72)); x.fillStyle = g; x.fillRect(2, 1.2, W - 4, H - 2.4);
  x.strokeStyle = 'rgba(0,0,0,0.34)'; x.lineWidth = 0.32; for (const [a, b, c, e] of [[3.6, 2.6, W - 7.2, 4.6], [3.6, 8.2, W - 7.2, 5.2]]) { x.strokeRect(a, b, c, e); x.fillStyle = 'rgba(255,240,220,0.07)'; x.fillRect(a, b, c, e); }
  x.fillStyle = '#d8c070'; x.beginPath(); x.arc(W - 3.8, 8, 0.6, 0, 6.3); x.fill(); x.fillStyle = '#6a5a3a'; x.fillRect(2.1, 3, 0.4, 1.4); x.fillRect(2.1, 11.4, 0.4, 1.4);
  x.fillStyle = '#b4aea0'; x.fillRect(0.4, H - 1.4, W - 0.8, 1.4); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0.4, H - 0.4, W - 0.8, 0.4);
}));
// a shop window: a lit room behind glass, a shelf of goods, the street in the reflection
const GOODS = ['#c8402e', '#e0b040', '#4e9a48', '#ece6d8', '#7a54b0', '#d87a2e', '#3a78b8'];
const displayArt = (v) => cache['s' + v] || (cache['s' + v] = canvas(14, 11, (x, W, H) => {
  let r = v * 7919 + 17; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  x.fillStyle = '#20262c'; x.fillRect(0, 0, W, H);
  x.fillStyle = (() => { const g = x.createLinearGradient(0, 0.6, 0, H - 0.8); g.addColorStop(0, '#f2dfae'); g.addColorStop(1, '#a08a60'); return g; })(); x.fillRect(0.7, 0.7, W - 1.4, H - 1.8);
  x.fillStyle = 'rgba(40,30,20,0.5)'; x.fillRect(0.7, 5.4, W - 1.4, 0.4); x.fillRect(0.7, H - 1.6, W - 1.4, 0.5);
  for (const base of [5.4, H - 1.6]) for (let i = 0; i < 6; i++) { const h = 1.6 + rnd() * 1.9, a = 1.1 + i * 2, w = 0.9 + rnd() * 0.6; x.fillStyle = GOODS[Math.floor(rnd() * GOODS.length)]; x.fillRect(a, base - h, w, h); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(a, base - h, 0.25, h); }
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(200,226,240,0.46)'); g.addColorStop(0.4, 'rgba(120,160,190,0.1)'); g.addColorStop(1, 'rgba(160,196,216,0.3)'); x.fillStyle = g; x.fillRect(0.7, 0.7, W - 1.4, H - 1.8);
  x.fillStyle = 'rgba(255,255,255,0.2)'; x.beginPath(); x.moveTo(2, 0.7); x.lineTo(6, 0.7); x.lineTo(2.6, H - 1.1); x.lineTo(0.7, H - 1.1); x.lineTo(0.7, 4); x.closePath(); x.fill();
  x.fillStyle = '#10141a'; x.fillRect(0, H - 1, W, 1);
}));
G.realFront = { display(ctx, x, y, seed) { const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(displayArt(seed % 6), x, y, 14, 11); ctx.imageSmoothingEnabled = was; } };
const FRAME = { heights: '#e8e4dc', center: '#3a3e44', neon: '#26262c', arts: '#5a3e2e', southside: '#4e4438', eastside: '#4a4a44', suburbs: '#efece4', industrial: '#3a4044' };
const DOOR = { heights: '#2a4a3a', suburbs: '#7a2e2a', center: '#3a3226', southside: '#4a4a44', eastside: '#3e4650', arts: '#2e4a5e', neon: '#1e1e26', industrial: '#4a5058' };
const FS = G.FireSystem.prototype, _dg = FS.drawGround;
FS.drawGround = function (ctx, view) { _dg.call(this, ctx, view); if (this.map && this.map.buildings) G.realFront.paint(ctx, this.map, view); };
G.realFront.paint = function (ctx, m, view) {
  const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const dist = m.meta && m.meta.district, frame = windowArt(FRAME[dist] || '#d8d4c8');
  for (const b of m.buildings) {
    if (b.destroyed || b.gutted || (b.roofAlpha != null && b.roofAlpha < 0.6 && G.realFront.topOf(m, b) != null)) continue;   // (inside, the front wall stands at full height: js/game/realwalls.js)
    const bx = b.x * 16, by = b.doorY * 16; if (bx > view.x + view.w || bx + b.w * 16 < view.x || by > view.y + view.h + 16 || by < view.y - 32) continue;
    // where the wall meets the ground
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(bx, by + 15, b.w * 16, 1.4); ctx.fillStyle = 'rgba(255,250,240,0.1)'; ctx.fillRect(bx, by, b.w * 16, 0.7);
    if (!(G.isStorefront && G.isStorefront(b))) for (const w of b.windows) { const i = Math.floor(w.y / 16) * m.w + Math.floor(w.x / 16); if (G.TILES[m.ground[i]] && G.TILES[m.ground[i]].wall) ctx.drawImage(frame, w.x - 7, w.y - 7, 14, 12); }
    if (!(b.doorOpen > 0.04) && G.TILES[m.get(b.doorX, b.doorY)] && G.TILES[m.get(b.doorX, b.doorY)].name === 'door') ctx.drawImage(doorArt(DOOR[dist] || '#6a4a2e'), b.doorX * 16, b.doorY * 16, 16, 16);
  }
  ctx.imageSmoothingEnabled = was;
};
})();
