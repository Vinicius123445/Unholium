'use strict';
// The title, UNHOLIUM, as a cast object rather than a font: heavy block letters on a strict grid, poured in
// board-marked concrete (formwork seams running across, pores and grit, worn chamfered edges catching the
// light from above, a real shadow cast below and to the right). Under it a thin engineering rule with ticks
// and a small plate code, like a stamped specification. Technological the way infrastructure is: plain,
// heavy, exact. No glow, no neon. Drawn once per UI scale and cached (js/scenes/menu.js uses it).
(() => {
// glyphs on a 6 x 8 unit grid, strokes 2 units thick: rectangles [x, y, w, h] and polygons [[x, y], ...]
const GLYPH = {
  U: { r: [[0, 0, 2, 8], [4, 0, 2, 8], [0, 6, 6, 2]] },
  N: { r: [[0, 0, 2, 8], [4, 0, 2, 8]], p: [[[0, 0], [2.3, 0], [6, 8], [3.7, 8]]] },
  H: { r: [[0, 0, 2, 8], [4, 0, 2, 8], [0, 3, 6, 2]] },
  O: { r: [[0, 0, 6, 2], [0, 6, 6, 2], [0, 0, 2, 8], [4, 0, 2, 8]], cut: true },
  L: { r: [[0, 0, 2, 8], [0, 6, 6, 2]] },
  I: { r: [[0, 0, 6, 2], [0, 6, 6, 2], [2, 0, 2, 8]] },
  M: { r: [[0, 0, 2, 8], [4, 0, 2, 8]], p: [[[0, 0], [2.2, 0], [3, 2.6], [3.8, 0], [6, 0], [6, 1.6], [3.8, 5.6], [2.2, 5.6], [0, 1.6]]] },
};
const cache = {};
function shape(x, ch, ox, u) {
  const g = GLYPH[ch]; if (!g) return;
  for (const [rx, ry, rw, rh] of g.r) x.rect(ox + rx * u, ry * u, rw * u, rh * u);
  for (const poly of g.p || []) { x.moveTo(ox + poly[0][0] * u, poly[0][1] * u); for (const [px, py] of poly.slice(1)) x.lineTo(ox + px * u, py * u); x.closePath(); }
}
const mkc = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
// a solid-color copy of a mask (its alpha kept)
const tint = (mask, color) => { const c = mkc(mask.width, mask.height), x = c.getContext('2d'); x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; };
// the part of a mask that a shifted copy of it does not cover: its edges facing (-dx, -dy)
const edge = (mask, dx, dy, color) => { const c = tint(mask, color), x = c.getContext('2d'); x.globalCompositeOperation = 'destination-out'; x.drawImage(mask, dx, dy); return c; };
function build(text, u) {
  const k = text + '|' + u;
  if (cache[k]) return cache[k];
  const n = text.length, gap = 1.1, pad = Math.ceil(u * 0.8), W = Math.ceil((n * 6 + (n - 1) * gap) * u) + pad * 2, H = Math.ceil(8 * u) + pad * 2;
  // the letters as one solid silhouette (overlapping strokes merge: no seams inside a letter)
  const mask = mkc(W, H), mx = mask.getContext('2d');
  mx.beginPath(); [...text].forEach((ch, i) => shape(mx, ch, pad + i * (6 + gap) * u, u)); mx.translate(0, 0);
  mx.save(); mx.translate(0, pad); mx.beginPath(); [...text].forEach((ch, i) => shape(mx, ch, pad + i * (6 + gap) * u, u)); mx.fillStyle = '#fff'; mx.fill('nonzero'); mx.restore();
  // chips knocked out of a few corners
  const r = new G.RNG('unholium-concrete');
  mx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n * 2; i++) { const cx = pad + r.int(0, n - 1) * (6 + gap) * u + r.pick([0, 2, 4, 6]) * u, cy = pad + r.pick([0, 8]) * u; mx.beginPath(); mx.arc(cx, cy, u * r.range(0.2, 0.45), 0, Math.PI * 2); mx.fill(); }
  mx.globalCompositeOperation = 'source-over';
  const c = mkc(W, H), x = c.getContext('2d');
  // the cast shadow, down and to the right, and a dark outline all round
  x.globalAlpha = 0.6; x.drawImage(tint(mask, '#000'), Math.round(u * 0.45), Math.round(u * 0.55)); x.globalAlpha = 1;
  const ol = tint(mask, '#1e1c1a'), o = Math.max(1, Math.round(u * 0.12));
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) x.drawImage(ol, dx, dy);
  // the concrete surface
  const t = mkc(W, H), tx = t.getContext('2d');
  const g = tx.createLinearGradient(0, pad, 0, pad + 8 * u); g.addColorStop(0, '#cbc7bd'); g.addColorStop(0.55, '#aba79e'); g.addColorStop(1, '#8a8780'); tx.fillStyle = g; tx.fillRect(0, 0, W, H);
  for (let y = pad; y < pad + 8 * u; y += u * 1.32) { tx.fillStyle = 'rgba(40,38,34,0.2)'; tx.fillRect(0, Math.round(y), W, Math.max(1, u * 0.08)); tx.fillStyle = 'rgba(255,255,255,0.07)'; tx.fillRect(0, Math.round(y) + Math.max(1, u * 0.08), W, Math.max(1, u * 0.05)); }
  for (let i = 0; i < W * 1.2; i++) { tx.fillStyle = `rgba(${r.chance(0.5) ? '60,58,52' : '230,226,216'},${(0.07 + r.next() * 0.14).toFixed(2)})`; tx.fillRect(r.range(0, W), r.range(0, H), Math.max(1, u * r.range(0.6, 1.8)), Math.max(1, u * 0.06)); }
  for (let i = 0; i < W * H / (u * 2.2); i++) { const s = Math.max(1, u * r.range(0.07, 0.2)); tx.fillStyle = r.chance(0.75) ? 'rgba(40,38,34,0.5)' : 'rgba(250,248,240,0.35)'; tx.fillRect(r.range(0, W), r.range(0, H), s, s); }
  for (let i = 0; i < n * 2; i++) { const sx = r.range(0, W), sw = u * r.range(0.3, 0.9), sl = u * r.range(2, 6); const sg = tx.createLinearGradient(0, pad, 0, pad + sl); sg.addColorStop(0, 'rgba(50,46,40,0.24)'); sg.addColorStop(1, 'rgba(50,46,40,0)'); tx.fillStyle = sg; tx.fillRect(sx, pad, sw, sl); }
  tx.globalCompositeOperation = 'destination-in'; tx.drawImage(mask, 0, 0);
  x.drawImage(t, 0, 0);
  // worn chamfers: light along the top and left edges, shade along the bottom and right
  const e = Math.max(1, Math.round(u * 0.22));
  x.drawImage(edge(mask, 0, e, 'rgba(255,252,242,0.5)'), 0, 0); x.drawImage(edge(mask, e, 0, 'rgba(255,252,242,0.25)'), 0, 0);
  x.drawImage(edge(mask, 0, -e, 'rgba(20,18,16,0.45)'), 0, 0); x.drawImage(edge(mask, -e, 0, 'rgba(20,18,16,0.3)'), 0, 0);
  return (cache[k] = { c, w: W, h: H, unit: u, pad });
}
G.wordmark = {
  build,
  // draw the title at (x, y) (UI coordinates), `height` UI px tall for the letters; returns its width
  draw(ctx, text, x, y, height) {
    const R = G.renderer, s = R.uiScale || 1, u = Math.max(2, Math.round((height / 8) * s * 4) / 4);
    const wm = build(text.toUpperCase(), u);
    const w = wm.w / s, h = wm.h / s;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(wm.c, x - wm.pad / s, y - wm.pad / s, w, h); ctx.restore();
    return w - (wm.pad * 2) / s;
  },
  // the engineering rule under it: a hairline with unit ticks, one longer every five, a small safety-orange block
  rule(ctx, x, y, w, t) {
    ctx.fillStyle = 'rgba(214,208,194,0.55)'; ctx.fillRect(x, y, w, 0.75);
    for (let i = 0, k = 0; i <= w; i += 4.5, k++) ctx.fillRect(x + i, y - (k % 5 ? 1.5 : 3.5), 0.6, k % 5 ? 1.5 : 3.5);
    ctx.fillStyle = '#d0682a'; ctx.fillRect(x, y + 2, 7, 2);
    ctx.fillStyle = 'rgba(214,208,194,0.35)'; ctx.fillRect(x + w - 1, y - 6, 0.75, 8);
  },
};
})();
