// Same measurements in both builds, on the real clock. Every frame ends with a read-back, so a GPU cannot hide work it has only queued.
globalThis.PocTiming = function (t0, report) {
  const out = {}, T = (k, f) => { const a = performance.now(); f(); out[k] = Math.round(performance.now() - a); };
  out.scripts = Math.round(performance.now() - t0);
  G.loop.running = false; G.law.off = true; G.happenings.off = true; G.travel.off = true;
  if (!G.realMat.ready) T('bake', () => { G.realMat.bake(); G.realMat.ready = true; G.hdArt.apply(); G.realMat.use(); });
  T('newGame', () => { G.scenes.replace(new G.GameScene({})); });
  const g = G.scenes.top(), ctx = G.renderer.ctx, flush = () => ctx.getImageData(0, 0, 1, 1);
  T('firstFrameCity', () => { g.loadMap('city', 'start'); G.loop.tick(1 / 60); G.loop.draw(); flush(); });
  T('mapChangeRural', () => { g.loadMap('rural', 'start'); G.loop.tick(1 / 60); G.loop.draw(); flush(); });
  T('backToCity', () => { g.loadMap('city', 'start'); G.loop.tick(1 / 60); G.loop.draw(); flush(); });
  const f = []; let upd = 0;
  for (let i = 0; i < 360; i++) { const a = performance.now(); G.loop.tick(1 / 60); const b = performance.now(); G.loop.draw(); flush(); const c = performance.now(); if (i >= 60) { f.push(c - a); upd += b - a; } }
  f.sort((x, y) => x - y); const avg = f.reduce((s, v) => s + v, 0) / f.length;
  out.frameAvg = +avg.toFixed(1); out.frameP50 = +f[f.length >> 1].toFixed(1); out.frameP95 = +f[Math.floor(f.length * 0.95)].toFixed(1); out.frameMax = +f[f.length - 1].toFixed(1); out.updateAvg = +(upd / f.length).toFixed(1); out.actors = g.actors.length;
  report(out);
};
