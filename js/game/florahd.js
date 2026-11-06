'use strict';
// Trees, bushes, rocks and the campfire, redrawn at twice the detail: leaf clusters lit from one side with dark gaps and
// sky holes, bark with grain, moss on the stones. The campfire is stacked logs in a ring of stones with live flames.
// Each sprite keeps its old size and anchor in the world (K=2 canvases drawn at their old size), so collision and
// placement do not change.
(() => {
const A = G.assets, K = 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w * K; c.height = h * K; const x = c.getContext('2d'); x.scale(K, K); return { c, x }; };
const ell = (x, cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 6.3); x.fill(); };
const puff = (x, r, cx, cy, rx, ry, n, ramp) => {   // a mass of leaves: dark under, lit top-left, single leaves on the rim
  ell(x, cx, cy + ry * 0.12, rx, ry, ramp[0]);
  for (let i = 0; i < n; i++) { const a = r.next() * 6.28, d = Math.sqrt(r.next()), px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d, s = 1 + r.next() * 2.4; ell(x, px, py, s, s * 0.8, ramp[(py - cy < -ry * 0.1 || px - cx < -rx * 0.2) ? 2 + (r.next() < 0.35 ? 1 : 0) : 1]); }
  for (let i = 0; i < n * 2; i++) { const a = r.next() * 6.28, d = 0.72 + r.next() * 0.32, px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d; x.fillStyle = ramp[1 + Math.floor(r.next() * 3)]; x.fillRect(px, py, 0.6, 0.6); }
};
const bark = (x, r, X, Y, w, h, cols) => {
  const g = x.createLinearGradient(X, 0, X + w, 0); g.addColorStop(0, cols[2]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, cols[0]);
  x.fillStyle = g; x.beginPath(); x.moveTo(X - 1.2, Y + h); x.lineTo(X + 0.4, Y); x.lineTo(X + w - 0.4, Y); x.lineTo(X + w + 1.2, Y + h); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.35;
  for (let i = 0; i < 9; i++) { const px = X + r.next() * w, py = Y + r.next() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r.next() - 0.5), py + 1.5 + r.next() * 3); x.stroke(); }
};
const ART = {
  oak(v) {
    const { c, x } = mk(32, 38), r = new G.RNG('oakhd' + v), ramp = [['#173a1c', '#25592a', '#3b7f3c', '#5ea552'], ['#1e3f1a', '#30612a', '#4b8a38', '#74ae4e'], ['#2a3f16', '#42611f', '#648a2e', '#8fb044']][v % 3];
    ell(x, 16, 36, 11, 2.2, 'rgba(0,0,0,0.22)');
    bark(x, r, 13.5, 20, 5, 17, ['#2f2013', '#4e3520', '#6c4c2e']);
    x.strokeStyle = '#4e3520'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(15, 24); x.lineTo(9, 17); x.moveTo(17, 23); x.lineTo(24, 16); x.stroke();
    puff(x, r, 9, 16, 8, 7, 34, ramp); puff(x, r, 23, 16, 8, 7, 34, ramp); puff(x, r, 16, 9, 11, 8, 60, ramp); puff(x, r, 16, 18, 9, 5, 26, ramp);
    return c;
  },
  pine(v) {
    const { c, x } = mk(22, 40), r = new G.RNG('pinehd' + v), ramp = v ? ['#0f2d1a', '#1b4428', '#2a5f38', '#3f7c4a'] : ['#12321c', '#20502c', '#32693c', '#4a8a50'];
    ell(x, 11, 38.5, 8, 1.6, 'rgba(0,0,0,0.22)');
    bark(x, r, 9.5, 28, 3, 11, ['#2a1b10', '#47301c', '#5e4228']);
    for (let t = 0; t < 5; t++) {
      const top = 1 + t * 6.2, h = 12 + t * 0.6, w = 3.6 + t * 1.75;
      x.fillStyle = ramp[0]; x.beginPath(); x.moveTo(11, top); x.lineTo(11 - w - 1, top + h); x.lineTo(11 + w + 1, top + h); x.fill();
      for (let i = 0; i < 40 + t * 14; i++) { const k = r.next(), py = top + k * h, half = w * k, px = 11 + (r.next() * 2 - 1) * half; x.strokeStyle = ramp[px < 11 ? 2 + (r.next() < 0.4 ? 1 : 0) : 1]; x.lineWidth = 0.45; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (px < 11 ? -1 : 1) * (0.7 + r.next()), py + 1.1); x.stroke(); }
    }
    return c;
  },
  bush() {
    const { c, x } = mk(16, 13), r = new G.RNG('bushhd'), ramp = ['#173c1b', '#28602c', '#3f8540', '#68ab56'];
    ell(x, 8, 12, 7, 1.2, 'rgba(0,0,0,0.2)');
    puff(x, r, 5, 8, 4.4, 3.8, 22, ramp); puff(x, r, 11, 8, 4.4, 3.8, 22, ramp); puff(x, r, 8, 5, 5.4, 4.2, 32, ramp);
    for (let i = 0; i < 4; i++) ell(x, 3 + r.next() * 10, 3 + r.next() * 7, 0.5, 0.5, '#c8506a');
    return c;
  },
  rock() {
    const { c, x } = mk(14, 10), r = new G.RNG('rockhd');
    ell(x, 7, 9, 6.5, 1.1, 'rgba(0,0,0,0.25)');
    const g = x.createLinearGradient(2, 1, 11, 9); g.addColorStop(0, '#b4b4ae'); g.addColorStop(0.5, '#858681'); g.addColorStop(1, '#55565a');
    x.fillStyle = g; x.beginPath(); x.moveTo(1, 8.6); x.lineTo(2.2, 4); x.lineTo(5.2, 1.3); x.lineTo(9.4, 1.8); x.lineTo(12.6, 5); x.lineTo(13, 8.8); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(30,30,34,0.5)'; x.lineWidth = 0.35; x.beginPath(); x.moveTo(5.2, 1.3); x.lineTo(6.2, 5); x.lineTo(4, 8.4); x.moveTo(6.2, 5); x.lineTo(10, 7); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.moveTo(2.4, 4); x.lineTo(5.2, 1.6); x.lineTo(5.8, 3.4); x.fill();
    for (let i = 0; i < 26; i++) { x.fillStyle = r.next() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'; x.fillRect(2 + r.next() * 10, 2.4 + r.next() * 6, 0.5, 0.5); }
    for (let i = 0; i < 14; i++) { x.fillStyle = r.next() < 0.5 ? '#5a7a3a' : '#7a9a48'; x.fillRect(2 + r.next() * 4, 6.5 + r.next() * 2, 0.7, 0.5); }
    return c;
  },
  campfire() {
    const { c, x } = mk(16, 14), r = new G.RNG('firehd');
    ell(x, 8, 11.5, 7.4, 2.6, '#2a241f');
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, px = 8 + Math.cos(a) * 6.6, py = 11 + Math.sin(a) * 2.5; ell(x, px, py, 1.5, 1.1, i % 2 ? '#7c7a74' : '#96948c'); ell(x, px - 0.3, py - 0.35, 0.7, 0.4, '#b4b2aa'); }
    const log = (x0, y0, x1, y1, col) => { x.strokeStyle = col; x.lineWidth = 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.4; x.beginPath(); x.moveTo(x0, y0 + 0.5); x.lineTo(x1, y1 + 0.5); x.stroke(); };
    log(3.5, 11.5, 12, 9.5, '#4a2f1a'); log(12.5, 11.5, 4, 9.5, '#5a3a20'); log(8, 12, 8, 8.5, '#3e2614');
    x.fillStyle = '#e8701c'; for (let i = 0; i < 8; i++) x.fillRect(5 + r.next() * 6, 9.6 + r.next() * 2, 0.8, 0.5);
    return c;
  },
};
const cache = {};
G.floraHD = {
  get(name) {
    if (!name) return null;
    if (cache[name] !== undefined) return cache[name];
    const m = String(name).match(/^(oak|pine)(\d)$/), s = A.sprites[name];
    const img = m ? ART[m[1]](+m[2]) : ART[name] ? ART[name]() : null;
    return (cache[name] = img && s ? img : null);
  },
};
const _dd = G.drawDecor;
// the living fire: tongues of flame, glow on the ground, sparks. Drawn over the logs, a little different every frame.
const fire = (ctx, o) => {
  const t = G.loop.time + (o.tx || 0) * 0.37, cx = o.x, by = o.y - 4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, by, 1, cx, by, 13); g.addColorStop(0, 'rgba(255,150,50,0.35)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 14, by - 13, 28, 24);
  for (let i = 0; i < 6; i++) {
    const ph = t * (3.2 + i * 0.5) + i * 1.7, sway = Math.sin(ph) * 1.6, h = 7 + Math.sin(ph * 1.7 + i) * 2.6 - Math.abs(i - 2.5) * 0.8, x0 = cx - 3.4 + i * 1.35;
    const f = ctx.createLinearGradient(0, by + 1, 0, by - h);
    f.addColorStop(0, 'rgba(255,230,120,0.95)'); f.addColorStop(0.45, 'rgba(255,140,30,0.85)'); f.addColorStop(1, 'rgba(210,40,10,0)');
    ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(x0 - 1.5, by + 1); ctx.quadraticCurveTo(x0 + sway - 1, by - h * 0.5, x0 + sway * 1.5, by - h); ctx.quadraticCurveTo(x0 + sway + 1.2, by - h * 0.45, x0 + 1.5, by + 1); ctx.fill();
  }
  for (let i = 0; i < 4; i++) { const k = (t * 0.6 + i * 0.27) % 1; ctx.fillStyle = `rgba(255,${170 - k * 100},60,${1 - k})`; ctx.fillRect(cx + Math.sin(t * 2 + i * 2) * (2 + k * 4), by - 6 - k * 15, 0.7, 0.7); }
  ctx.restore();
};
G.drawDecor = function (ctx, o, s, scene) {
  const r = _dd.call(this, ctx, o, s, scene);
  if (o.type === 'campfire' && !(scene && scene.map.meta.dream)) fire(ctx, o);
  return r;
};
})();
