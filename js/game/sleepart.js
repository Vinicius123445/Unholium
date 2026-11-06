'use strict';
// How people look asleep. A bed: the head on the pillow, turned a little, eyes shut, the body a shape under the
// blanket that rises and falls, an arm out over the covers now and then. A bunk is seen from its end: a head at
// the back of the mattress and a rounded blanket, on the bottom bunk or the top one. No bed: flat on the floor.
(() => {
const A = G.assets, FW = () => G.hd.FW, FH = () => G.hd.FH;
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const CACHE = new Map();
const EYES_SHUT = { dir: 0, face: 9, q: 0, yaw: 0, gaze: 0, wet: 0 };
// the sleeping face: the front frame with its eyes closed, cut at the neck
function head(a) {
  const hd = G.hd.get(a.sheet); if (!hd) return null;
  let c = CACHE.get(hd); if (c) return c;
  const K = 4, cut = Math.ceil(G.body.geom(hd.L, 0, 0, null).shoulderY) - 1;
  c = document.createElement('canvas'); c.width = FW() * K; c.height = cut * K;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  G.body.cur = EYES_SHUT;
  try { x.drawImage(hd.img, 0, 0, FW(), FH(), 0, 0, FW() * K, FH() * K); } finally { G.body.cur = null; }
  c.cut = cut; if (CACHE.size > 300) CACHE.clear(); CACHE.set(hd, c);
  return c;
}
const drawHead = (ctx, a, cx, top, tilt, size) => {
  const c = head(a); if (!c) return;
  const k = (G.hd.WW / FW()) * size, w = FW() * k, h = c.cut * k;
  ctx.save(); ctx.translate(cx, top + h / 2); ctx.rotate(tilt); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore(); ctx.imageSmoothingEnabled = false;
};
const breath = (a) => Math.sin(G.loop.time * 1.5 + (hash(a.id || 'x') % 7)) * 0.5 + 0.5;
const ell = (ctx, x, y, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };

function inBed(ctx, a, bed, spr) {
  const by = bed.y - spr.ay, W = spr.w, H = spr.h, h = hash(a.id || 'x');
  const double = (bed.def.fw || 1) > 1, side = double ? (a.bedSide ? W / 4 : -W / 4) : 0, cx = bed.x + side, b = breath(a), bw = double ? W * 0.21 : W * 0.3;
  drawHead(ctx, a, cx, by + 0.2, ((h % 5) - 2) * 0.07, 1.14);
  // the shape under the blanket: shoulders high, narrowing to the feet, lifting with each breath
  const y0 = by + 15.5, y1 = by + H - 5, g = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.24)'); g.addColorStop(0.42, `rgba(255,255,255,${(0.09 + 0.03 * b).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - bw, y0); ctx.quadraticCurveTo(cx - bw * 1.05, (y0 + y1) / 2, cx - bw * 0.5, y1); ctx.quadraticCurveTo(cx, y1 + 1, cx + bw * 0.5, y1); ctx.quadraticCurveTo(cx + bw * 1.05, (y0 + y1) / 2, cx + bw, y0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${(0.05 + 0.05 * b).toFixed(3)})`; ctx.fillRect(cx - bw * 0.7, y0 + 2.2 - b * 0.4, bw * 1.4, 0.7);
  // the sheet turned down under the chin, moving with the chest
  ctx.fillStyle = '#f4eee2'; ctx.fillRect(cx - bw * 1.08, by + 12.6 - b * 0.25, bw * 2.16, 2.3);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(cx - bw * 1.08, by + 14.9 - b * 0.25, bw * 2.16, 0.4);
  // an arm out over the covers, for some
  if (h % 3 === 0) {
    const L = a.look || {}, s = h % 2 ? 1 : -1, sleeve = L.shirtless || L.naked ? L.skin : L.shirt, ax = cx + s * bw * 0.72;
    ctx.lineCap = 'round'; ctx.strokeStyle = sleeve || '#6a8ab8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, by + 13.6); ctx.lineTo(ax - s * 0.4, by + 19); ctx.stroke();
    ctx.strokeStyle = L.skin || '#e0b088'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax - s * 0.4, by + 19); ctx.lineTo(ax - s * 0.9, by + 21.5); ctx.stroke(); ctx.lineCap = 'butt';
  }
}
function inBunk(ctx, a, bed, spr) {
  const bx = bed.x - spr.ax, by = bed.y - spr.ay, k = spr.h / 26, mat = by + (a.bedSide === 1 ? 9 : 22) * k, W = spr.w, cx = bx + W / 2, h = hash(a.id || 'x'), b = breath(a);
  drawHead(ctx, a, cx + ((h % 3) - 1) * 1.2, mat - 10.4, ((h % 5) - 2) * 0.09, 0.95);
  // the blanket, seen from the foot of the bunk
  const col = ['#5e6a52', '#6a6458', '#4e5a6a'][h % 3], rise = 4.6 + b * 0.5;
  ctx.fillStyle = A.shade(col, 0.72); ctx.beginPath(); ctx.moveTo(bx + 1.2, mat + 0.3); ctx.quadraticCurveTo(cx, mat - rise * 2 + 0.4, bx + W - 1.2, mat + 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx + 1.6, mat + 0.1); ctx.quadraticCurveTo(cx - 0.8, mat - rise * 2, bx + W - 2.6, mat + 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx - 3.4, mat - 1.6 - rise * 0.34); ctx.quadraticCurveTo(cx - 0.8, mat - rise * 0.98, cx + 2.6, mat - 1.4 - rise * 0.34); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(cx + 1, mat - 0.3); ctx.lineTo(cx + 3, mat - 2.6); ctx.stroke();
}
function flat(ctx, a, couch) {
  const hd = G.hd.get(a.sheet); if (!hd) return;
  const s = hash(a.id || 'x') % 2 ? 1 : -1, b = breath(a), x = couch ? couch.x : a.x, y = couch ? couch.y - 9 : a.y - 3, W = G.hd.WW, H = G.hd.WH;
  if (!couch) ell(ctx, x, y + 2.6, H * 0.47, 3, 'rgba(0,0,0,0.26)');
  ctx.save(); ctx.translate(x, y); ctx.rotate(s * Math.PI / 2); ctx.scale(1 + b * 0.015, couch ? 0.82 : 1);
  G.body.cur = EYES_SHUT;
  try { ctx.drawImage(hd.img, 0, 0, FW(), FH(), -W / 2, -H / 2, W, H); } finally { G.body.cur = null; ctx.restore(); }
}
G.sleepArt = {
  draw(ctx, a) {
    const bed = a.sleepBed();
    if (bed && bed.def.interact === 'bed') {
      const spr = bed.def.sprite && A.sprites[bed.def.sprite];
      if (spr && /bunk/.test(bed.def.sprite)) return inBunk(ctx, a, bed, spr);
      if (spr && spr.h >= 24) return inBed(ctx, a, bed, spr);
    }
    return flat(ctx, a, a.bedRef && a.bedRef.def && a.bedRef.def.interact !== 'bed' ? a.bedRef : null);
  },
};
})();
