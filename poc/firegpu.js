// the graphics card's share of a burning frame, and what memory does after
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; g.loadMap('rural', 'start'); for (let i = 0; i < 200; i++) { G.loop.tick(1 / 60); G.loop.draw(); } const m = g.map, live = () => { p.hp = p.maxHp = 1e6; while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); };
  const b = m.buildings.find((q) => q.w >= 8 && Math.hypot((q.x + q.w / 2) * 16 - p.x, (q.y + q.h / 2) * 16 - p.y) < 500) || m.buildings[0]; p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h + 3) * 16;
  for (let i = 0; i < 26; i++) g.fire.ignite(b.x + (i % b.w), b.y + b.h - 1 - (i % 4), g); for (let i = 0; i < 40; i++) g.fire.ignite(b.x - 6 + i, b.y + b.h + 2, g);
  const rss = () => (process.memoryUsage().rss / 1048576) | 0;
  for (let r = 0; r < 12; r++) { const L = [], D = []; for (let i = 0; i < 150; i++) { live(); G.loop.tick(1 / 60); const a = performance.now(); G.loop.draw(); const c = performance.now(); G.renderer.canvas.toBufferSync('raw'); const e = performance.now(); D.push(c - a); L.push(e - c); } L.sort((x, y) => x - y); D.sort((x, y) => x - y); console.log(r, 'burn', g.fire.cells.size, 'js median', D[75].toFixed(1), 'p99', D[148].toFixed(0), '| gpu median', L[75].toFixed(1), 'p99', L[148].toFixed(0), '| rss', rss(), 'pieces', (m.scorchCanvas ? m.scorchCanvas.pieces.size : 0) + (m.sootCanvas ? m.sootCanvas.pieces.size : 0)); await new Promise((q) => setTimeout(q, 20)); }
  for (let r = 0; r < 3; r++) { for (let i = 0; i < 200; i++) { live(); G.loop.tick(1 / 60); G.loop.draw(); if (i % 30 === 0) G.renderer.canvas.toBufferSync('raw'); } await new Promise((q) => setTimeout(q, 40)); global.gc && global.gc(); await new Promise((q) => setTimeout(q, 40)); console.log('after', rss(), 'heap', (process.memoryUsage().heapUsed / 1048576) | 0); }
};
