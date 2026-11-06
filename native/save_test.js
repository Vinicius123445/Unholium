'use strict';
// A real save from the old build, imported, loaded, played, saved and loaded again. Never the original: a copy in tools\tmp.
process.env.UNHOLIUM_DATA = 'D:/Unholium_native/tools/tmp/mig'; process.env.UNHOLIUM_MUTE = '1';
const R = require('./runtime'), fs = require('fs');
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack); process.exit(1); });
R.loadGame();
const wait = () => { if (!G.realMat.ready) { setTimeout(wait, 50); return; } run(); };
function run() {
  G.loop.running = false; const pump = (n) => { for (let i = 0; i < n; i++) G.loop.tick(1 / 60); G.loop.draw(); };
  const latest = G.saves.latest(); console.log('latest', JSON.stringify(latest && { slot: latest.slot, v: G.config.SAVE_PREFIX }));
  const d = G.saves.read(latest.slot); console.log('save', Object.keys(d).join(' ').slice(0, 120));
  G.startGame({ save: d }); let n = 0; const go = () => {
    const g = G.scenes.stack.find((s) => s instanceof G.GameScene && s.player);
    if (!g || G.scenes.top() !== g) { if (n++ < 2000) { pump(2); setTimeout(go, 0); return; } console.log('never reached the game, top:', G.scenes.top().constructor.name); process.exit(1); }
    const p = g.player, a = { map: g.map.id, x: Math.round(p.x), gold: p.gold, name: p.playerName, day: g.world.day }; console.log('loaded', JSON.stringify(a), 'errors', (G.errors || []).length);
    pump(120); p.gold += 123; G.saves.write('1', g); const b = G.saves.read('1');
    console.log('saved to slot 1, gold', b.player.gold, 'file', fs.existsSync(process.env.UNHOLIUM_DATA + '/storage/' + encodeURIComponent(G.config.SAVE_PREFIX + '1') + '.json'));
    G.startGame({ save: b }); let m = 0; const back = () => { const q = G.scenes.stack.find((s) => s instanceof G.GameScene && s.player); if (!q || q === g || G.scenes.top() !== q) { if (m++ < 2000) { pump(2); setTimeout(back, 0); return; } console.log('reload failed'); process.exit(1); } console.log('reloaded gold', q.player.gold, 'same map', q.map.id === a.map, 'errors', (G.errors || []).length); fs.writeFileSync('D:/Unholium_native/native/shot.png', G.renderer.canvas.toBufferSync('png')); process.exit(0); }; back();
  }; go();
}
wait();
