'use strict';
// Real fronts. The wall a building shows the street stands 64 pixels tall per storey (a person is 26): the ground plan does not change
// and collision stays on the foot of the wall, but what you see is a wall with height, a door about twice a person, windows at the
// height windows are, a plinth, a cornice, reveals with shadow in them. It lies in depth order with people, so whoever is on the
// street stands in front of it and whoever is inside goes behind it, and it lifts with the roof when you walk in.
(() => {
const RD = 3, STOREY = 64, UP = 48, DOOR_H = 43, DOOR_W = 23, A = G.assets, sh = A.shade, TM = G.TileMap.prototype;
const FRAME = { heights: '#e8e4dc', center: '#3a3e44', neon: '#26262c', arts: '#5a3e2e', southside: '#4e4438', eastside: '#4a4a44', suburbs: '#efece4', industrial: '#3a4044' };
const DOOR = { heights: '#2a4a3a', suburbs: '#7a2e2a', center: '#3a3226', southside: '#4a4a44', eastside: '#3e4650', arts: '#2e4a5e', neon: '#1e1e26', industrial: '#4a5058' };
const lin = (x, x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
const sized = (b) => { const low = Math.min(STOREY, Math.max(30, (b.h - 1) * 16 - 8)); return low; };
const heightOf = (m, b) => sized(b) + (m.floorsOf(b) - 1) * UP;
const rowOf = (b) => b.y + b.h - 1;   // (the front wall, even when the door is on a side: you can build a house that way)
const shows = (m, b) => !b.destroyed && !b.gutted && !b.floorOf && !(m.meta && (m.meta.indoor || m.meta.floorOf)) && b.kind !== 'ruin' && b.kind !== 'camp';

// a window in its reveal: shadow from the head and one jamb, sill standing proud, glass with the sky in it, the frame and glazing bars
function windowAt(x, X, Y, W, H, frame) {
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(X - 0.8, Y - 0.8, W + 1.6, H + 1.6);
  x.fillStyle = lin(x, X, Y, X + W, Y + H, ['#b4d4e4', '#6e96b0', '#2c4256', '#44647c', '#94b6ca']); x.fillRect(X, Y, W, H);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(X, Y, W, 2.4); x.fillRect(X, Y, 1.4, H);
  x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.moveTo(X + 2, Y + 2.4); x.lineTo(X + W * 0.56, Y + 2.4); x.lineTo(X + 3, Y + H); x.lineTo(X + 1.4, Y + H); x.closePath(); x.fill();
  x.strokeStyle = frame; x.lineWidth = 1.5; x.strokeRect(X, Y, W, H); x.lineWidth = 0.9; x.beginPath(); x.moveTo(X + W / 2, Y); x.lineTo(X + W / 2, Y + H); x.moveTo(X, Y + H * 0.42); x.lineTo(X + W, Y + H * 0.42); x.stroke();
  x.fillStyle = '#cfc9ba'; x.fillRect(X - 2, Y + H + 0.7, W + 4, 1.6); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(X - 2, Y + H + 2.3, W + 4, 1.5);
  x.fillStyle = 'rgba(240,235,225,0.3)'; x.fillRect(X - 1.6, Y - 3, W + 3.2, 1.6);   // the lintel
}
// a shop window from knee height, three shelves of goods in a lit room behind it
const GOODS = ['#c8402e', '#e0b040', '#4e9a48', '#ece6d8', '#7a54b0', '#d87a2e', '#3a78b8', '#2a2a30'];
function display(x, X, Y, W, H, seed, frame) {
  let r = seed * 7919 + 17; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(X - 0.8, Y - 0.8, W + 1.6, H + 1.6);
  x.fillStyle = lin(x, 0, Y, 0, Y + H, ['#f4e2b4', '#c8ae7c', '#8a7450']); x.fillRect(X, Y, W, H);
  for (let s = 1; s <= 3; s++) { const base = Y + H * s / 3 - 1; x.fillStyle = 'rgba(40,28,16,0.62)'; x.fillRect(X, base, W, 1); for (let a = X + 1.4; a < X + W - 2;) { const w = 1.4 + rnd() * 1.8, h = 3 + rnd() * (H / 3 - 5); x.fillStyle = GOODS[Math.floor(rnd() * GOODS.length)]; x.fillRect(a, base - h, w, h); x.fillStyle = 'rgba(255,255,255,0.26)'; x.fillRect(a, base - h, 0.4, h); a += w + 0.5; } }
  x.fillStyle = lin(x, X, Y, X + W, Y + H, ['rgba(205,228,240,0.42)', 'rgba(120,160,190,0.08)', 'rgba(170,200,220,0.26)']); x.fillRect(X, Y, W, H);
  x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(X, Y, W, 2.2);
  x.strokeStyle = frame; x.lineWidth = 1.5; x.strokeRect(X, Y, W, H);
}

TM.renderFront = function (b) {
  const low = sized(b), floors = this.floorsOf(b), H = low + (floors - 1) * UP, W = b.w * 16, c = document.createElement('canvas'); c.width = W * RD; c.height = H * RD;
  const x = c.getContext('2d'); x.scale(RD, RD); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  if (b.playerBuilt && !b.windows.length) for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 3) if (wx !== b.doorX) b.windows.push({ x: wx * 16 + 8, y: rowOf(b) * 16 + 9 });   // (a house you built has windows in its front)
  const dist = this.meta && this.meta.district, frame = FRAME[dist] || '#d8d4c8', wall = G.TILES[this.get(b.x, rowOf(b))], tex = wall && (wall.tex || wall.name), hash = G.util.hashString(b.id);
  // the wall itself, course on course of its own material
  x.fillStyle = '#6e6a64'; x.fillRect(0, 0, W, H);
  if (tex) for (let yy = H - 16, j = 0; yy > -16; yy -= 16, j++) for (let xx = 0, i = 0; xx < W; xx += 16, i++) { const t = A.tile(tex, G.util.hash2(i, j, hash % 31)); if (t) x.drawImage(t, xx, yy, 16, 16); const d = G.realMat && G.realMat.ready && G.realMat.detail(tex, G.util.hash2(i, j, 7)); if (d) { x.globalCompositeOperation = 'overlay'; x.drawImage(d, xx, yy, 16, 16); x.globalCompositeOperation = 'source-over'; } }
  x.fillStyle = lin(x, 0, 0, 0, H, ['rgba(255,245,230,0.08)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.16)']); x.fillRect(0, 0, W, H);
  // corners that turn away, a drainpipe, the stain under it
  x.fillStyle = lin(x, 0, 0, 5, 0, ['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)']); x.fillRect(0, 0, 5, H); x.fillStyle = lin(x, W - 5, 0, W, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']); x.fillRect(W - 5, 0, 5, H);
  const pipe = hash % 2 ? 4 : W - 7; x.fillStyle = lin(x, pipe, 0, pipe + 3, 0, ['#4a4c50', '#8a8c90', '#3a3c40']); x.fillRect(pipe, 2, 3, H - 8); x.fillStyle = 'rgba(30,30,28,0.14)'; x.fillRect(pipe - 1, H * 0.4, 5, H * 0.6);
  // plinth, cornice, a string course at each floor
  x.fillStyle = lin(x, 0, H - 7, 0, H, ['#7c7a72', '#54524c']); x.fillRect(0, H - 7, W, 7); x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(0, H - 7, W, 0.8); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, H - 1.2, W, 1.2);
  x.fillStyle = lin(x, 0, 0, 0, 6, ['#b4b0a4', '#8c887c']); x.fillRect(0, 0, W, 5); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, 5, W, 2.4);
  for (let f = 1; f < floors; f++) { const y = H - low - (f - 1) * UP; x.fillStyle = 'rgba(232,226,212,0.5)'; x.fillRect(0, y - 1.4, W, 1.4); x.fillStyle = 'rgba(0,0,0,0.36)'; x.fillRect(0, y, W, 1.2); }
  const ground = H, dc = b.doorX * 16 + 8 - b.x * 16, shop = G.isStorefront && G.isStorefront(b), lit = [];
  // the storeys above
  for (let f = 1; f < floors; f++) { const top = H - low - f * UP + 11; for (let wx = 16; wx + 18 < W - 10; wx += 32) { windowAt(x, wx, top, 18, 26, frame); lit.push({ x: wx, y: top, w: 18, h: 26 }); } }
  // the ground floor
  const sign = G.signFor && G.signFor(b);
  if (low >= 56) {
    if (shop && /Bar|Casino|Motel|Diner/.test(b.name)) for (let wx = 12; wx + 22 < W - 8; wx += 32) { if (Math.abs(wx + 11 - dc) < 28) continue; windowAt(x, wx, ground - 47, 22, 30, frame); x.fillStyle = 'rgba(40,14,20,0.5)'; x.fillRect(wx + 0.8, ground - 46, 20.4, 28); lit.push({ x: wx, y: ground - 47, w: 22, h: 30 }); }
    else if (shop) for (let wx = 8; wx + 28 < W - 4; wx += 32) { const cx = wx + 14; if (Math.abs(cx - dc) < 28) continue; display(x, wx, ground - 46, 28, 36, (hash + wx) % 7, frame); x.fillStyle = '#4e4a44'; x.fillRect(wx - 1, ground - 10, 30, 3); lit.push({ x: wx, y: ground - 46, w: 28, h: 36 }); }
    else for (const w of b.windows) { const cx = w.x - b.x * 16; if (Math.abs(cx - dc) < 26 || cx < 13 || cx > W - 13) continue; windowAt(x, cx - 10, ground - 47, 20, 28, frame); lit.push({ x: cx - 10, y: ground - 47, w: 20, h: 28 }); w.fy = rowOf(b) * 16 + 16 - 33; }
  } else for (const w of b.windows) { const cx = w.x - b.x * 16; if (Math.abs(cx - dc) < 22 || cx < 12 || cx > W - 12) continue; windowAt(x, cx - 8, ground - low + 9, 16, 12, frame); lit.push({ x: cx - 8, y: ground - low + 9, w: 16, h: 12 }); }
  // the doorway: stone surround, the dark reveal the door sits back in, a step
  const dx = dc - DOOR_W / 2, dtop = ground - Math.min(DOOR_H, low - 6) - 2, dh = ground - 2 - dtop, hasDoor = b.doorY === rowOf(b);
  if (hasDoor) { x.fillStyle = lin(x, dx - 3, 0, dx + DOOR_W + 3, 0, ['#d6cfbe', '#b4ad9c']); x.fillRect(dx - 3, dtop - 4, DOOR_W + 6, dh + 4);
  x.fillStyle = '#100c0a'; x.fillRect(dx, dtop, DOOR_W, dh); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(dx - 3, dtop - 5, DOOR_W + 6, 1);
  x.fillStyle = '#a8a294'; x.fillRect(dx - 4, ground - 3, DOOR_W + 8, 3); x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(dx - 4, ground - 3, DOOR_W + 8, 0.6); }
  // an awning over the shop door, on real brackets
  if (sign && sign.awning && low >= 56) { const ax = dc - 34, aw = 68, ay = ground - 60; for (let i = 0; i < 12; i++) { x.fillStyle = sign.awning[i % 2]; x.beginPath(); x.moveTo(ax + 4 + i * (aw - 8) / 12, ay); x.lineTo(ax + 4 + (i + 1) * (aw - 8) / 12, ay); x.lineTo(ax + (i + 1) * aw / 12, ay + 9); x.lineTo(ax + i * aw / 12, ay + 9); x.closePath(); x.fill(); } x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(ax, ay + 9, aw, 1.4); x.fillStyle = 'rgba(0,0,0,0.24)'; x.fillRect(ax, ay + 10.4, aw, 4); }
  c._rd = RD; b._front = { H, W, lit, door: hasDoor ? { x: dx, y: dtop, w: DOOR_W, h: dh } : null };
  return c;
};
const doorLeaf = {};
const leafOf = (col, w, h) => { const k = col + w + 'x' + h; if (doorLeaf[k]) return doorLeaf[k]; const c = document.createElement('canvas'); c.width = w * RD; c.height = h * RD; const x = c.getContext('2d'); x.scale(RD, RD);
  x.fillStyle = lin(x, 0, 0, w, 0, [sh(col, 1.22), col, sh(col, 0.7)]); x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.5; for (const [a, b, e, f] of [[3.4, 3.4, w - 6.8, h * 0.28], [3.4, h * 0.36, w - 6.8, h * 0.56]]) { x.fillStyle = 'rgba(255,240,220,0.06)'; x.fillRect(a, b, e, f); x.strokeRect(a, b, e, f); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(a, b, e, 0.8); x.fillRect(a, b, 0.8, f); }
  x.fillStyle = '#d8c070'; x.fillRect(w - 4.4, h * 0.5, 1.2, 3.4); x.beginPath(); x.arc(w - 3.8, h * 0.5, 1.1, 0, 6.3); x.fill(); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(w - 4, h * 0.5 + 4.4, 0.8, 1.2);
  x.fillStyle = '#7a6a48'; for (const y of [5, h / 2, h - 7]) x.fillRect(0, y, 0.8, 2.6);
  return (doorLeaf[k] = c); };

G.realFront.drawFront = function (ctx, m, b) {
  if (!b.frontCanvas) b.frontCanvas = m.renderFront(b);
  const f = b._front, fx = b.x * 16, fy = rowOf(b) * 16 + 16 - f.H, was = ctx.imageSmoothingEnabled, a0 = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = a0 * b.roofAlpha;
  ctx.drawImage(b.frontCanvas, fx, fy, f.W, f.H);
  const o = b.doorOpen || 0, dist = m.meta && m.meta.district, d = f.door;
  if (d) ctx.drawImage(leafOf(DOOR[dist] || '#6a4a2e', d.w, Math.round(d.h)), fx + d.x, fy + d.y, Math.max(3, d.w * (1 - o * 0.86)), d.h);
  if (b.lit) { ctx.fillStyle = 'rgba(255,214,140,0.72)'; for (const r of f.lit) ctx.fillRect(fx + r.x + 0.8, fy + r.y + 0.8, r.w - 1.6, r.h - 1.6); }
  ctx.imageSmoothingEnabled = was; ctx.globalAlpha = a0;
};
G.realFront.fronts = function (m, view) {
  const out = []; if (!m.buildings) return out;
  for (const b of m.buildings) {
    if (!(b.roofAlpha > 0.01) || !shows(m, b)) continue;
    const y = rowOf(b) * 16 + 16, top = y - heightOf(m, b);
    if (b.x * 16 > view.x + view.w || (b.x + b.w) * 16 < view.x || y < view.y || top > view.y + view.h) continue;
    out.push(b);
  }
  return out;
};
G.realFront.topOf = (m, b) => (b.id && shows(m, b) ? rowOf(b) * 16 + 16 - heightOf(m, b) : null);
G.realFront.rowOf = rowOf;
})();
