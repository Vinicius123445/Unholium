'use strict';
// Roofs, the first thing you see of a city from above. Painted at three times the world's density, and each district has its
// own: slate and terracotta in the Heights, coloured shingle in the suburbs, tar and rust on the Southside, weathered metal
// at the port, dark roofs under the signs of Neon Row, pale gravel in Center. Colour is what tells you where you are.
(() => {
const RD = 3, TM = G.TileMap.prototype, A = G.assets, sh = A.shade;
const hashOf = (s) => G.util.hashString(String(s)), rng = (s) => new G.RNG(s);
const DISTRICT = {
  heights: { pitched: ['#7a4030', '#a8583a', '#3e4654', '#b8735a'], flat: ['#cfc8b8', '#b8b0a0'] },
  suburbs: { pitched: ['#8e3a2e', '#3e5a7a', '#4e6e48', '#6a5a4e', '#7a2e36', '#4a4a56'], flat: ['#8a8680'] },
  southside: { pitched: ['#5a3a2e', '#4a3a34', '#6a4a30'], flat: ['#3e3c3a', '#54463a', '#4a3e36'] },
  eastside: { pitched: ['#4a4038', '#5e4a3a'], flat: ['#40423f', '#4e4a44', '#5a4436'] },
  industrial: { metal: ['#6a4a34', '#4a6a6a', '#7a3e2e', '#6a6e72', '#8a7a4a'] },
  neon: { pitched: ['#2e2a38'], flat: ['#2a2830', '#34303c', '#3a2e3a'] },
  arts: { pitched: ['#a8583a', '#8a4a34', '#4e5e6e'], flat: ['#a89a86', '#8e8474'] },
  center: { pitched: ['#6a4a3e', '#4e5664'], flat: ['#a8a498', '#8e8e8a', '#b4aca0'] },
  farmland: { pitched: ['#8e3a2a', '#6a5a4e', '#7a6a4a'] },
};
const pick = (l, s) => l[s % l.length];
const grain = (() => {   // a tile of fine gravel, multiplied over a flat roof
  let c = null;
  return () => { if (c) return c; c = document.createElement('canvas'); c.width = c.height = 192; const x = c.getContext('2d'), im = x.createImageData(192, 192), d = im.data; for (let i = 0; i < d.length; i += 4) { const k = i / 4, n = Math.sin((k % 192) * 12.9898 + Math.floor(k / 192) * 78.233) * 43758.5453, v = 196 + ((n - Math.floor(n)) - 0.5) * 92; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; } x.putImageData(im, 0, 0); return c; };
})();
function flat(x, W, H, col, b, s) {
  const r = rng(b.id);
  x.fillStyle = col; x.fillRect(0, 0, W, H);
  x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = x.createPattern(grain(), 'repeat'); x.scale(1 / RD, 1 / RD); x.fillRect(0, 0, W * RD, H * RD); x.restore();
  // stains where the water stands, patches of newer membrane
  for (let i = 0; i < 7; i++) { const g = x.createRadialGradient(0, 0, 1, 0, 0, 34); x.save(); x.translate(r.range(10, W - 10), r.range(10, H - 10)); x.scale(1 + r.next(), 1); g.addColorStop(0, 'rgba(20,18,14,0.2)'); g.addColorStop(1, 'rgba(20,18,14,0)'); x.fillStyle = g; x.fillRect(-40, -40, 80, 80); x.restore(); }
  for (let i = 0; i < 3; i++) { x.fillStyle = `rgba(${r.chance(0.5) ? '255,250,240' : '10,10,12'},0.06)`; x.fillRect(r.range(6, W - 30), r.range(6, H - 24), r.range(16, 44), r.range(10, 26)); }
  // parapet
  const p = sh(col, 0.62), q = sh(col, 1.2);
  x.fillStyle = p; x.fillRect(0, 0, W, 4); x.fillRect(0, 0, 4, H); x.fillRect(W - 4, 0, 4, H); x.fillRect(0, H - 6, W, 6);
  x.fillStyle = q; x.fillRect(0, 0, W, 1.2); x.fillRect(0, 0, 1.2, H);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(4, 4, W - 8, 2.4); x.fillRect(4, 4, 2.4, H - 10);
  // plant on the roof
  const n = Math.max(1, Math.floor(b.w * b.h / 90));
  for (let k = 0; k < n; k++) {
    const ax = r.range(12, Math.max(13, W - 34)), ay = r.range(12, Math.max(13, H - 34)), kind = r.int(0, 2);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(ax + 3, ay + 4, 22, 18);
    if (kind === 0) {   // an air handler
      const g = x.createLinearGradient(ax, ay, ax + 22, ay + 18); g.addColorStop(0, '#d0d0d4'); g.addColorStop(1, '#8a8a92'); x.fillStyle = g; x.fillRect(ax, ay, 22, 18); x.fillStyle = '#54545c'; x.beginPath(); x.arc(ax + 11, ay + 9, 6.4, 0, 6.3); x.fill(); x.fillStyle = '#2a2a30'; for (let a = 0; a < 6; a++) { x.save(); x.translate(ax + 11, ay + 9); x.rotate(a * 1.05); x.fillRect(0, -0.5, 5.6, 1); x.restore(); }
    } else if (kind === 1) { x.fillStyle = '#6e6e74'; x.fillRect(ax, ay, 14, 14); x.fillStyle = '#4a4a50'; for (let i = 2; i < 13; i += 3) x.fillRect(ax + 1, ay + i, 12, 1.4); }   // a vent
    else { x.fillStyle = '#7a7a80'; x.beginPath(); x.arc(ax + 6, ay + 6, 6, 0, 6.3); x.fill(); x.fillStyle = '#26262a'; x.beginPath(); x.arc(ax + 6, ay + 6, 4, 0, 6.3); x.fill(); }   // a flue
  }
}
function pitched(x, W, H, col, b) {
  const r = rng(b.id), rows = Math.ceil(H / 3.2), ridge = H * 0.46;
  x.fillStyle = sh(col, 0.5); x.fillRect(0, 0, W, H);
  for (let j = 0; j < rows; j++) {
    const y = j * 3.2, off = j % 2 ? 2.6 : 0, lit = y < ridge ? 1.1 : 0.84;   // the south slope catches the day
    for (let px = -off; px < W; px += 5.2) { const t = r.next(), tone = lit * (0.86 + t * 0.26); x.fillStyle = sh(col, tone); x.fillRect(px + 0.3, y + 0.3, 4.7, 2.6); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px + 0.3, y + 2.5, 4.7, 0.5); if (t > 0.97) { x.fillStyle = 'rgba(60,110,50,0.3)'; x.fillRect(px + 0.3, y + 0.3, 4.7, 2.6); } }
  }
  const g = x.createLinearGradient(0, ridge - 18, 0, ridge + 18); g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.46, 'rgba(255,240,220,0.14)'); g.addColorStop(0.54, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = sh(col, 1.3); x.fillRect(2, ridge - 1.4, W - 4, 1.4); x.fillStyle = sh(col, 0.52); x.fillRect(2, ridge, W - 4, 1.8);
  x.fillStyle = sh(col, 0.46); x.fillRect(0, 0, W, 1.4); x.fillRect(0, 0, 1.4, H); x.fillRect(W - 1.4, 0, 1.4, H);
  x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, H - 4, W, 4);
  if (b.chimney) { const cx = W - 26 + (hashOf(b.id) % 12) - 10, cy = ridge - 18; x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(cx + 3, cy + 5, 13, 20); x.fillStyle = '#7a3e30'; x.fillRect(cx, cy, 12, 18); for (let i = 3; i < 18; i += 3) { x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(cx, cy + i, 12, 0.6); } x.fillStyle = '#a89e90'; x.fillRect(cx - 1, cy - 1, 14, 3); x.fillStyle = '#1a1818'; x.fillRect(cx + 2, cy, 8, 1.6); }
}
function metal(x, W, H, col, b) {
  const r = rng(b.id);
  for (let px = 0; px < W; px += 4) { const g = x.createLinearGradient(px, 0, px + 4, 0); g.addColorStop(0, sh(col, 1.2)); g.addColorStop(0.5, sh(col, 0.86)); g.addColorStop(1, sh(col, 0.62)); x.fillStyle = g; x.fillRect(px, 0, 4, H); }
  for (let i = 0; i < 26; i++) { x.save(); x.translate(r.range(0, W), r.range(0, H)); const g = x.createRadialGradient(0, 0, 0, 0, 0, 16 + r.next() * 18); g.addColorStop(0, 'rgba(110,56,26,0.42)'); g.addColorStop(1, 'rgba(110,56,26,0)'); x.fillStyle = g; x.fillRect(-36, -36, 72, 72); x.restore(); }
  x.fillStyle = 'rgba(0,0,0,0.24)'; for (let y = 32; y < H; y += 48) x.fillRect(0, y, W, 1);
  x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, H - 4, W, 4);
}
TM.renderRoof = function (b) {
  const floors = this.floorsOf(b), extra = floors > 1 ? (floors - 1) * 48 : 0, W = b.w * 16 + 4, H = (b.h - 1) * 16 + 8, c = document.createElement('canvas');   // (the storeys are js/game/realfront2.js)
  c.width = W * RD; c.height = H * RD; c._rd = RD; b.extraH = extra;
  const x = c.getContext('2d'); x.scale(RD, RD);
  const dist = this.meta.district, set = DISTRICT[dist] || {}, s = hashOf(b.id), isFlat = b.roof.startsWith('flat');
  if (set.metal && /factory|warehouse|cannery|shed|depot|garage|supply/i.test(b.name || '') || (dist === 'industrial' && isFlat)) metal(x, W, H, pick(set.metal || ['#6a6e72'], s), b);
  else if (isFlat) flat(x, W, H, pick(set.flat || ['#9a968e'], s), b, s);
  else pitched(x, W, H, pick(set.pitched || (G.ROOF_COLORS[b.roof] || G.ROOF_COLORS.red).slice(0, 1), s), b);
  return c;
};
TM.drawRoofs = function (ctx, view) {
  for (const b of this.buildings) {
    if (b.roofAlpha <= 0.01 || b.destroyed) continue;
    if (!b.roofCanvas) b.roofCanvas = this.renderRoof(b);
    const c = b.roofCanvas, k = c._rd || 1, w = c.width / k, rx = b.x * 16 - 2, ry = b.y * 16 - 8 - (b.extraH || 0), top = G.realFront.topOf(this, b), h = top == null ? c.height / k : Math.min(c.height / k, top - ry);   // (the roof stops where the front wall starts)
    if (h <= 0) continue;
    if (rx > view.x + view.w || ry > view.y + view.h || rx + w < view.x || ry + h < view.y) continue;
    ctx.globalAlpha = b.roofAlpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, c.width, h * k, rx, ry, w, h);
  }
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
};
})();
