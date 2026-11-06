'use strict';
// A look at any moment of the game, headless: node look.js <script.js>. The script gets (G, g, p, shot, tick, done).
process.env.UNHOLIUM_MUTE = '1'; process.env.UNHOLIUM_DATA = 'D:/Unholium_native/tools/tmp/look' + process.pid; process.env.W = process.env.W || '1280'; process.env.H = process.env.H || '720';
const fs = require('fs'), R = require('../native/runtime');
fs.rmSync(process.env.UNHOLIUM_DATA, { recursive: true, force: true }); fs.mkdirSync(process.env.UNHOLIUM_DATA + '/storage', { recursive: true });
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 900)); process.exit(1); });
R.runFile('D:/Unholium_native/poc/seed.js'); R.loadGame({ beforeMain() {} });
const ready = () => {
  if (!(G.realMat && G.realMat.ready)) { setTimeout(ready, 50); return; }
  G.loop.running = false; G.law.off = true; G.happenings.off = true; G.travel.off = true; G.settings.data.notifications = 2; if (G.streetlife) G.streetlife.off = true;
  G.scenes.replace(new G.GameScene({})); const g = G.scenes.top(), p = g.player;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) G.loop.tick(1 / 60); };
  const shot = (name) => { for (let i = 0; i < 4; i++) G.loop.draw(); fs.writeFileSync(`D:/Unholium_native/poc/out/f/${name}.png`, G.renderer.canvas.toBufferSync('png')); };
  const fn = require(require('path').resolve(process.argv[2]));
  Promise.resolve(fn(G, g, p, shot, tick)).then(() => process.exit(0), (e) => { console.log(e.stack); process.exit(1); });
};
ready();
