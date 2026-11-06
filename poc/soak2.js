// A: stay on one map. B: only change maps. Which of them grows, and who keeps making images.
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; const rss = () => { global.gc(); return (process.memoryUsage().rss / 1048576) | 0; };
  const frames = (n) => { for (let i = 0; i < n; i++) { G.loop.tick(1 / 60); G.loop.draw(); if (i % 30 === 0) G.renderer.canvas.toBufferSync('raw'); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); } };
  g.loadMap('city', 'start'); frames(400); const a = [rss()]; for (let r = 0; r < 6; r++) { frames(400); a.push(rss()); } console.log('A same map, 400 frames each:', a.join(' -> '));
  const tally = () => { const by = new Map(); for (const e of globalThis.__canvases || []) { const b = by.get(e.who) || { n: 0, a: 0 }; b.n++; b.a += e.c.width * e.c.height * 4; by.set(e.who, b); } return by; }, t0 = tally();
  const b = [rss()]; for (let r = 0; r < 6; r++) { g.loadMap(r % 2 ? 'city' : 'rural', 'start'); frames(40); b.push(rss()); } console.log('B map changes, 40 frames each:', b.join(' -> '));
  const t1 = tally(), rows = []; for (const [k, v] of t1) { const o = t0.get(k) || { n: 0, a: 0 }; if (v.n > o.n) rows.push([k, v.n - o.n, (v.a - o.a) / 1048576]); }
  rows.sort((x, y) => y[2] - x[2]); for (const r of rows.slice(0, 12)) console.log(String(r[1]).padStart(6), r[2].toFixed(1).padStart(8), 'MB', r[0].slice(0, 76));
};
