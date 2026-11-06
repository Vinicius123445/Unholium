// what the image memory is: every canvas the game makes, by who made it
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  for (const [m, s] of [['city', 'start'], ['rural', 'start'], ['jail', 'cell'], ['city', 'start']]) { g.loadMap(m, s); tick(30); for (let i = 0; i < 20; i++) G.loop.draw(); }
  const L = globalThis.__canvases || []; let area = 0; const by = new Map();
  for (const e of L) { const c = e.c, a = c.width * c.height * 4; area += a; const k = e.who; const b = by.get(k) || { n: 0, a: 0 }; b.n++; b.a += a; by.set(k, b); }
  console.log('canvases', L.length, 'total if all kept MB', (area / 1048576).toFixed(0));
  for (const [k, v] of [...by].sort((a, b) => b[1].a - a[1].a).slice(0, 24)) console.log(String(v.n).padStart(6), (v.a / 1048576).toFixed(1).padStart(8), 'MB', k.slice(0, 80));
  global.gc && global.gc(); const m = process.memoryUsage(); console.log('rss', (m.rss / 1048576).toFixed(0), 'heap', (m.heapUsed / 1048576).toFixed(0), 'ext', (m.external / 1048576).toFixed(0));
};
