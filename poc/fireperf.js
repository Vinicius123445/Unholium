// frames with fire: a building and grass burning near the player
const pct = (l, p) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)] || 0; };
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; g.loadMap('rural', 'start'); for (let i = 0; i < 300; i++) { G.loop.tick(1 / 60); G.loop.draw(); } const m = g.map;
  const run = (name, n) => { const T = [], D = []; for (let i = 0; i < n; i++) { const a = performance.now(); G.loop.tick(1 / 60); const b = performance.now(); G.loop.draw(); const c = performance.now(); T.push(b - a); D.push(c - b); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); if (i % 30 === 0) G.renderer.canvas.toBufferSync('raw'); }
    const av = (l) => (l.reduce((x, y) => x + y, 0) / l.length).toFixed(1); console.log(name.padEnd(14), 'tick', av(T), 'p99', pct(T, 0.99).toFixed(0), 'max', Math.max(...T).toFixed(0), '| draw', av(D), 'p99', pct(D, 0.99).toFixed(0), 'max', Math.max(...D).toFixed(0), '| burning', g.fire.cells.size, 'parts', (g.parts || []).length, 'smoke', (g.fire.smoke || []).length); };
  run('no fire', 120);
  p.hp = p.maxHp = 1e6; const b = m.buildings.find((q) => q.w >= 8 && Math.hypot((q.x + q.w / 2) * 16 - p.x, (q.y + q.h / 2) * 16 - p.y) < 500) || m.buildings[0];
  p.x = (b.x + b.w / 2) * 16; p.y = (b.y + b.h + 3) * 16; for (const q of m.buildings) q.roofAlpha = 1;
  const ig = (x, y) => (g.fire.ignite ? g.fire.ignite(x, y, g) : g.fire.start && g.fire.start(x, y));
  for (let i = 0; i < 26; i++) ig(b.x + (i % b.w), b.y + b.h - 1 - (i % 4));
  for (let i = 0; i < 40; i++) ig(b.x - 6 + i, b.y + b.h + 2);
  run('fire starts', 120); console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(g.fire)).slice(0, 26).join(' '));
  run('fire 2 s', 180); run('fire 5 s', 300); run('fire 10 s', 300); shot('fire'); run('fire 15 s', 300);
};
