'use strict';
// Arriving somewhere does not cost seconds any more. The ground of a map used to be painted whole on the first frame (two to three seconds on
// the big maps). Now it is painted in squares: those on screen when they are needed, the rest one by one around you while you play, nearest
// first, and you never see the seam because every square is worked out with a border of its neighbours. The map you just left is kept too.
(() => {
const A = G.assets, TM = G.TileMap.prototype, CH = 16, M = 2;
const scratch = document.createElement('canvas'), sx = scratch.getContext('2d', { willReadFrequently: true });
scratch.width = scratch.height = (CH + M * 2) * 16;
const blendable = (m) => !(m.meta && (m.meta.indoor || m.meta.floorOf));
const start = (m) => {
  if (!m.groundCanvas) { m.groundCanvas = new G.PatchLayer(m.w * 16, m.h * 16); m.groundCtx = m.groundCanvas.context; }
  m.windowAt = new Map();
  const cols = Math.ceil(m.w / CH), rows = Math.ceil(m.h / CH), g = m._gc = { cols, rows, done: new Uint8Array(cols * rows), left: cols * rows, flats: [], wins: [], blds: [], tick: 0 };
  const list = (o, i) => (o[i] || (o[i] = []));
  for (const b of m.buildings) {
    b.roofCanvas = null;
    for (const w of b.windows) { m.windowAt.set(Math.floor(w.y / 16) * m.w + Math.floor(w.x / 16), w); list(g.wins, Math.floor(w.y / 16 / CH) * cols + Math.floor(w.x / 16 / CH)).push(w); }
    for (let cy = Math.max(0, Math.floor((b.y - M) / CH)); cy < rows && cy * CH < b.y + b.h + M; cy++) for (let cx = Math.max(0, Math.floor((b.x - M) / CH)); cx < cols && cx * CH < b.x + b.w + M; cx++) list(g.blds, cy * cols + cx).push(b);
  }
  for (const f of m.flats) {
    const s = A.sprites[f.def.sprite]; if (!s) continue;
    const x0 = (f.x - s.ax) / 16 - M, y0 = (f.y - s.ay) / 16 - M, x1 = (f.x - s.ax + s.img.width) / 16 + M, y1 = (f.y - s.ay + s.img.height) / 16 + M;
    for (let cy = Math.max(0, Math.floor(y0 / CH)); cy < rows && cy * CH < y1; cy++) for (let cx = Math.max(0, Math.floor(x0 / CH)); cx < cols && cx * CH < x1; cx++) list(g.flats, cy * cols + cx).push(f);
  }
  const tc = m._tc = new Uint8Array(m.w * m.h);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) tc[ty * m.w + tx] = G.terrain.classAt(m, tx, ty);
  m._needBlend = false; m.scorchCanvas = null;
  if (blendable(m)) { m.landOverlay = new Map(); m.shore = new Map(); m.waterMix = new Map(); } else { m.landOverlay = null; m.shore = null; }
  try { G.fireHD.scorchAll(m); } catch (e) { /* plain ground */ }
  m.renderMinimap();
};
const paint = (m, cx, cy) => {
  const g = m._gc, id = cy * g.cols + cx; if (g.done[id]) return; g.done[id] = 1; g.left--;
  const ix0 = cx * CH, iy0 = cy * CH, ix1 = Math.min(m.w, ix0 + CH) - 1, iy1 = Math.min(m.h, iy0 + CH) - 1, x0 = Math.max(0, ix0 - M), y0 = Math.max(0, iy0 - M), x1 = Math.min(m.w - 1, ix1 + M), y1 = Math.min(m.h - 1, iy1 + M), x = sx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, scratch.width, scratch.height); x.imageSmoothingEnabled = false; x.setTransform(1, 0, 0, 1, -x0 * 16, -y0 * 16);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) m.drawTileInto(x, tx, ty, false);
  for (const f of g.flats[id] || []) { const s = A.sprites[f.def.sprite]; x.drawImage(s.img, Math.round(f.x - s.ax), Math.round(f.y - s.ay)); }
  // the windows in the wall, from this square and the ones next to it
  for (let cy2 = Math.max(0, cy - 1); cy2 <= Math.min(g.rows - 1, cy + 1); cy2++) for (let cx2 = Math.max(0, cx - 1); cx2 <= Math.min(g.cols - 1, cx + 1); cx2++) for (const w of g.wins[cy2 * g.cols + cx2] || []) {
    if (!G.TILES[m.ground[Math.floor(w.y / 16) * m.w + Math.floor(w.x / 16)]].wall) continue;
    const s = A.sprites.window; x.drawImage(s.img, w.x - s.ax, w.y - s.ay);
  }
  // the paint on the walls (js/game/streetlook.js)
  if (m.paintOf && g.blds[id]) {
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.6;
    for (const b of g.blds[id]) { x.fillStyle = m.paintOf(b); for (let ty = Math.max(y0, b.y); ty < Math.min(y1 + 1, b.y + b.h); ty++) for (let tx = Math.max(x0, b.x); tx < Math.min(x1 + 1, b.x + b.w); tx++) { const t = G.TILES[m.get(tx, ty)]; if (t && t.wall && t.name !== 'wall_inner') x.fillRect(tx * 16, ty * 16, 16, 16); } }
    x.restore();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (blendable(m)) try { G.terrain.blend(m, { x0, y0, x1, y1, ix0, iy0, ix1, iy1, ctx: x }); } catch (e) { G.reportError && G.reportError(e); }
  const w = (ix1 - ix0 + 1) * 16, h = (iy1 - iy0 + 1) * 16;
  m.groundCanvas.each(ix0 * 16, iy0 * 16, w, h, (q) => q.drawImage(scratch, (ix0 - x0) * 16, (iy0 - y0) * 16, w, h, ix0 * 16, iy0 * 16, w, h));
};
// everything on screen now; then one more square, nearest first
const keepUp = (m, view) => {
  const g = m._gc; if (!g || g.left <= 0) return;
  const c0 = Math.max(0, Math.floor(view.x / 16 / CH)), r0 = Math.max(0, Math.floor(view.y / 16 / CH)), c1 = Math.min(g.cols - 1, Math.floor((view.x + view.w) / 16 / CH)), r1 = Math.min(g.rows - 1, Math.floor((view.y + view.h) / 16 / CH));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) paint(m, cx, cy);
  // one square ahead of you when the last one was cheap; the slower it was, the longer until the next: a busy graphics card never gets two heavy frames in a row
  if (g.left <= 0 || (g.wait = (g.wait || 0) - 1) > 0) return;
  const mx = (c0 + c1) >> 1, my = (r0 + r1) >> 1, R = Math.max(g.cols, g.rows);
  for (let r = 1; r <= R; r++) for (let cy = my - r; cy <= my + r; cy++) for (let cx = mx - r; cx <= mx + r; cx++) {
    if (Math.max(Math.abs(cx - mx), Math.abs(cy - my)) !== r || cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows || g.done[cy * g.cols + cx]) continue;
    const a = performance.now(); paint(m, cx, cy); g.wait = Math.min(40, 2 + Math.ceil((performance.now() - a) / 5)); return;
  }
};
const _pre = TM.prerender, _dg = TM.drawGround, _set = TM.setTileRuntime;
TM.prerender = function () { if (!G.lazyGround) return _pre.call(this); if (!this.live) { this.renderMinimap(); return undefined; } start(this); return undefined; };
TM.drawGround = function (ctx, view, time) {
  if (G.lazyGround) { if (!this.groundCanvas || !this._gc) { this.live = true; this.prerender(); } keepUp(this, view); }
  return _dg.call(this, ctx, view, time);
};
TM.setTileRuntime = function (tx, ty) { const r = _set.apply(this, arguments); if (this._tc && this.inBounds(tx, ty)) this._tc[ty * this.w + tx] = G.terrain.classAt(this, tx, ty); return r; };
// all of it, now (a full view for pictures of the map)
TM.finishGround = function () { const g = this._gc; if (!g) return; for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) paint(this, cx, cy); };
})();
