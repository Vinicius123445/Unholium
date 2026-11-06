// The same run every time, from the same dice: where a frame goes, what a map change costs, what memory does.
// node --cpu-prof look.js perf.js   (results to poc/out/perf_<label>.json)
const fs = require('fs');
const pct = (l, p) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)] || 0; };
const sum = (l) => l.reduce((a, b) => a + b, 0);
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; G.law.off = false; G.happenings.off = false; if (G.streetlife) G.streetlife.off = false; G.travel.off = false;
  const out = { label: process.env.LABEL || 'run', rss0: process.memoryUsage().rss };
  const flush = () => { try { G.renderer.canvas.toBufferSync('raw', { }); } catch (e) { /* no raw */ } };
  const run = (name, frames) => {
    const T = [], D = []; let n = 0;
    for (let i = 0; i < frames; i++) { const a = performance.now(); G.loop.tick(1 / 60); const b = performance.now(); G.loop.draw(); const c = performance.now(); T.push(b - a); D.push(c - b); n += G.scenes.top() === g ? 1 : 0; if (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); }
    const t0 = performance.now(); flush(); const gpu = performance.now() - t0;
    out[name] = { tick: +(sum(T) / frames).toFixed(2), tickP99: +pct(T, 0.99).toFixed(1), draw: +(sum(D) / frames).toFixed(2), drawP99: +pct(D, 0.99).toFixed(1), flush: +gpu.toFixed(0), actors: g.actors.length, veh: g.vehicles.length };
    console.log(name, JSON.stringify(out[name]));
  };
  const load = (map, spawn) => { const a = performance.now(); g.loadMap(map, spawn); G.loop.tick(1 / 60); G.loop.draw(); return +(performance.now() - a).toFixed(0); };
  out.firstLoads = {}; for (const [m, s] of [['city', 'start'], ['rural', 'start'], ['jail', 'cell']]) out.firstLoads[m] = load(m, s);
  out.secondLoads = {}; for (const [m, s] of [['city', 'start'], ['rural', 'start'], ['city', 'start']]) out.secondLoads[m + (out.secondLoads[m] ? '2' : '')] = load(m, s);
  g.loadMap('city', 'start'); for (let i = 0; i < 40; i++) G.loop.tick(1 / 60);
  run('warm', 120); run('city', 600);
  // walking through town: the ground chunks and people that come into view
  const v = 110; const walk = (fr) => { for (let i = 0; i < fr; i++) { p.x = Math.min(g.map.pw - 40, p.x + v / 60); const a = 0; G.loop.tick(1 / 60); G.loop.draw(); void a; } };
  const a = performance.now(); walk(300); out.walkFrame = +((performance.now() - a) / 300).toFixed(2); console.log('walk frame', out.walkFrame);
  g.loadMap('rural', 'start'); for (let i = 0; i < 40; i++) G.loop.tick(1 / 60); run('rural', 300);
  global.gc && global.gc(); const m = process.memoryUsage(); out.mem = { heapMB: +(m.heapUsed / 1048576).toFixed(0), extMB: +(m.external / 1048576).toFixed(0), abMB: +(m.arrayBuffers / 1048576).toFixed(0), rssMB: +(m.rss / 1048576).toFixed(0) };
  console.log('mem', JSON.stringify(out.mem));
  fs.writeFileSync(`D:/Unholium_native/poc/out/perf_${out.label}.json`, JSON.stringify(out, null, 1));
};
