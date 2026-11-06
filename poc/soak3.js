// are the ground and roof images of a map you left really released?
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; let made = 0, gone = 0, rMade = 0, rGone = 0; const reg = new FinalizationRegistry((k) => { if (k === 'g') gone++; else rGone++; }), seen = new WeakSet();
  const note = () => { const m = g.map; if (m.groundCanvas && !seen.has(m.groundCanvas)) { seen.add(m.groundCanvas); made++; reg.register(m.groundCanvas, 'g'); } for (const b of m.buildings) if (b.roofCanvas && !seen.has(b.roofCanvas)) { seen.add(b.roofCanvas); rMade++; reg.register(b.roofCanvas, 'r'); } };
  const frames = (n) => { for (let i = 0; i < n; i++) { G.loop.tick(1 / 60); G.loop.draw(); if (i % 30 === 0) G.renderer.canvas.toBufferSync('raw'); note(); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); } };
  const maps = [['city', 'start'], ['rural', 'start'], ['heights', 'from_city'], ['jail', 'cell']];
  for (let r = 0; r < (+process.env.ROUNDS || 16); r++) { const [m, s] = maps[r % 4]; g.loadMap(m, s); frames(+process.env.FR || 60); await new Promise((q) => setTimeout(q, 30)); global.gc(); await new Promise((q) => setTimeout(q, 30)); global.gc(); console.log(r, m.padEnd(8), 'rss', (process.memoryUsage().rss / 1048576) | 0, 'ground made', made, 'freed', gone, '| roofs made', rMade, 'freed', rGone, 'buildings map', g.map.buildings.length); }
};
