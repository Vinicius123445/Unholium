'use strict';
// The real thing: the game in a native window with no browser, drawing to the screen, the actual frame rate on the clock.
process.env.SKIA = process.env.SKIA || 'gpu';
const fs = require('fs'), path = require('path'), vm = require('vm');
const t0 = performance.now();
const { game, W, H } = require('./shim'), { Window, App } = require('skia-canvas');
const root = path.join(__dirname, '..'), run = (f) => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
run(path.join(__dirname, 'seed.js'));
for (const l of fs.readFileSync(path.join(root, 'js', 'scripts.txt'), 'utf8').split(/\r?\n/)) if (l && !l.startsWith('#')) run(path.join(root, l.trim()));
const start = () => {
  if (!(G.realMat && G.realMat.ready)) { setTimeout(start, 30); return; }
  G.loop.running = false; G.law.off = true; G.happenings.off = true; G.travel.off = true;
  G.scenes.replace(new G.GameScene({})); const g = G.scenes.top(); g.loadMap('city', 'start'); G.loop.tick(1 / 60); G.loop.draw();
  const ready = Math.round(performance.now() - t0);
  const win = new Window(W, H, { title: 'Unholium (native proof of concept)', canvas: game }); App.fps = +(process.env.FPS || 240);
  const work = [], gaps = []; let n = 0, last = 0, m0 = 0;
  win.on('frame', () => {
    const a = performance.now(); if (last) gaps.push(a - last); last = a;
    G.loop.tick(1 / 60); G.loop.draw(); work.push(performance.now() - a);
    if (++n === 120) { m0 = process.memoryUsage().rss; gaps.length = 0; work.length = 0; }
    if (n === 1020) {
      const st = (v) => { const s = v.slice().sort((p, q) => p - q); return { avg: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(1), p50: +s[s.length >> 1].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
      console.log(JSON.stringify({ readyMs: ready, frames: gaps.length, frameInterval: st(gaps), scriptWork: st(work), fps: +(1000 / st(gaps).avg).toFixed(1), rssMB: Math.round(process.memoryUsage().rss / 1048576), growthMB: Math.round((process.memoryUsage().rss - m0) / 1048576), engine: game.engine && game.engine.renderer }));
      if (process.env.SHOT) fs.writeFileSync(process.env.SHOT, game.toBufferSync('png'));
      process.exit(0);
    }
  });
  App.launch();
};
start();
