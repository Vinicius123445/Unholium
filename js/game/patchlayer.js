// G.PatchLayer: a picture as big as a map (soot, scorch), kept as small pieces that exist only where something was painted.
// Two whole-map images do not fit in the graphics card's cache beside the ground: they were sent to the card again every frame, and a burnt map ran at 2 fps for good.
// Same pixels, drawn only where they are on screen. Each piece keeps one extra pixel around it, so smoothing at a zoom shows no line where two pieces meet.
(() => {
const SIZE = 256, EDGE = 1;
class PatchLayer {
  constructor(width, height) { this.width = width; this.height = height; this.cols = Math.ceil(width / SIZE); this.rows = Math.ceil(height / SIZE); this.pieces = new Map(); }
  // like putImageData: the rectangle replaces what was there, clear pixels too
  put(img, x0, y0) {
    const W = img.width, H = img.height, d = img.data, c0 = Math.max(0, Math.floor((x0 - EDGE) / SIZE)), r0 = Math.max(0, Math.floor((y0 - EDGE) / SIZE)), c1 = Math.min(this.cols - 1, Math.floor((x0 + W - 1 + EDGE) / SIZE)), r1 = Math.min(this.rows - 1, Math.floor((y0 + H - 1 + EDGE) / SIZE));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const k = r * this.cols + c, ox = c * SIZE - EDGE, oy = r * SIZE - EDGE; let p = this.pieces.get(k);
      if (!p) {
        const ax = Math.max(0, ox - x0), ay = Math.max(0, oy - y0), bx = Math.min(W, ox + SIZE + EDGE * 2 - x0), by = Math.min(H, oy + SIZE + EDGE * 2 - y0); let any = false;
        for (let y = ay; y < by && !any; y++) for (let x = ax; x < bx; x++) if (d[(y * W + x) * 4 + 3]) { any = true; break; }
        if (!any) continue;
        p = document.createElement('canvas'); p.width = p.height = SIZE + EDGE * 2; this.pieces.set(k, p);
      }
      p.getContext('2d').putImageData(img, x0 - ox, y0 - oy);
    }
  }
  // paint with any canvas calls: fn runs once for each piece under the rectangle, in map coordinates
  each(x, y, w, h, fn) {
    const c0 = Math.max(0, Math.floor((x - EDGE) / SIZE)), r0 = Math.max(0, Math.floor((y - EDGE) / SIZE)), c1 = Math.min(this.cols - 1, Math.floor((x + w - 1 + EDGE) / SIZE)), r1 = Math.min(this.rows - 1, Math.floor((y + h - 1 + EDGE) / SIZE));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const k = r * this.cols + c; let p = this.pieces.get(k);
      if (!p) { p = G.assets.mk(SIZE + EDGE * 2, SIZE + EDGE * 2).c; this.pieces.set(k, p); }
      const q = p.getContext('2d'); q.save(); q.translate(EDGE - c * SIZE, EDGE - r * SIZE); try { fn(q); } finally { q.restore(); }
    }
  }
  // the calls a canvas answers to, for code that reads or writes the whole picture
  get context() { const L = this; return this._cx || (this._cx = { canvas: L, getImageData(x, y, w, h) { const t = G.assets.mk(w, h).x; t.translate(-x, -y); L.draw(t, x, y, w, h); return t.getImageData(0, 0, w, h); }, putImageData(img, x, y) { L.put(img, x, y); }, fillStyle: '#000', fillRect(x, y, w, h) { const s = this.fillStyle; L.each(x, y, w, h, (q) => { q.fillStyle = s; q.fillRect(x, y, w, h); }); }, drawImage(img, ...a) { const [x, y, w, h] = a.length === 2 ? [a[0], a[1], img.width, img.height] : a.length === 4 ? a : a.slice(4); L.each(x, y, w, h, (q) => q.drawImage(img, ...a)); } }); }
  getContext() { return this.context; }
  // the pieces that touch the rectangle
  draw(ctx, sx, sy, sw, sh) {
    const c0 = Math.max(0, Math.floor(sx / SIZE)), r0 = Math.max(0, Math.floor(sy / SIZE)), c1 = Math.min(this.cols - 1, Math.floor((sx + sw - 1) / SIZE)), r1 = Math.min(this.rows - 1, Math.floor((sy + sh - 1) / SIZE));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const p = this.pieces.get(r * this.cols + c); if (p) ctx.drawImage(p, EDGE, EDGE, SIZE, SIZE, c * SIZE, r * SIZE, SIZE, SIZE); }
  }
}
G.PatchLayer = PatchLayer;
})();
