// one ground square, stage by stage
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  const P = Object.getPrototypeOf(document.createElement('canvas').getContext('2d')), S = {}, wrap = (o, n) => { const f = o[n]; o[n] = function () { const a = performance.now(); const r = f.apply(this, arguments); const q = S[n] || (S[n] = { n: 0, ms: 0 }); q.n++; q.ms += performance.now() - a; return r; }; };
  for (const n of ['getImageData', 'putImageData']) wrap(CanvasRenderingContext2D.prototype, n);
  wrap(G.terrain, 'blend'); wrap(G.TileMap.prototype, 'drawTileInto');
  g.loadMap('rural', 'start'); const m = g.map; G.loop.tick(1 / 60); G.loop.draw(); for (const k in S) delete S[k]; const a = performance.now(); let n = 0; const left = () => m._gc && m._gc.left;
  const L0 = left(); m.finishGround && m.finishGround(); const ms = performance.now() - a; console.log('chunks painted', L0, 'total ms', ms.toFixed(0), 'per chunk', (ms / Math.max(1, L0)).toFixed(1));
  for (const k in S) console.log(k.padEnd(14), String(S[k].n).padStart(8), S[k].ms.toFixed(0).padStart(8), 'ms', (S[k].ms / S[k].n).toFixed(2), 'each');
  console.log('scratch gpu?', document.createElement('canvas').gpu, 'ground canvas', m.groundCanvas.width, m.groundCanvas.height, ((m.groundCanvas.width * m.groundCanvas.height * 4) / 1048576).toFixed(0), 'MB raw');
};
