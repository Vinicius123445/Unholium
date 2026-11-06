'use strict';
// How close the sound comes to dropping out, with the real game running on the real device at zero volume.
process.env.UNHOLIUM_DATA = 'D:/Unholium_native/tools/tmp/aud'; process.env.W = '1280'; process.env.H = '720';
const fs = require('fs'), R = require('../native/runtime');
fs.rmSync(process.env.UNHOLIUM_DATA, { recursive: true, force: true }); fs.mkdirSync(process.env.UNHOLIUM_DATA + '/storage', { recursive: true });
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 600)); process.exit(1); });
const _AC = globalThis.AudioContext; const hint = process.env.HINT;
if (hint) globalThis.AudioContext = class extends _AC { constructor(o) { super(Object.assign({}, o, { latencyHint: isNaN(+hint) ? hint : +hint })); } };
R.runFile('D:/Unholium_native/poc/seed.js'); R.loadGame({ beforeMain() {} });
const ready = () => {
  if (!(G.realMat && G.realMat.ready)) { setTimeout(ready, 50); return; }
  G.settings.data.masterVolume = 0; G.settings.data.volume = 0; G.settings.data.sfx = 0; G.settings.data.music = 0;
  G.loop.running = false; G.scenes.replace(new G.GameScene({})); G.audio.unlock(); G.audio.applyVolumes(); if (G.audio.master) G.audio.master.gain.value = 0.0001;
  const c = G.audio.ctx; console.log('hint', hint || 'default', 'base', c.baseLatency, 'sr', c.sampleRate, 'graph ok');
  const T = Date.now(), rc = c.renderCapacity; let over = 0, n = 0, peak = 0, avg = 0;
  if (rc) { rc.addEventListener('update', (e) => { n++; peak = Math.max(peak, e.peakLoad); avg += e.averageLoad; over += e.underrunRatio; if (e.underrunRatio > 0 || e.peakLoad > 0.9) console.log('  t', ((Date.now() - T) / 1000).toFixed(1), 'peak', e.peakLoad.toFixed(2), 'under', e.underrunRatio.toFixed(4)); }); rc.start({ updateInterval: 1 }); }
  let t = 0; const lag = []; let last = Date.now();
  const iv = setInterval(() => {
    const now = Date.now(); lag.push(now - last); last = now;
    for (let i = 0; i < 2; i++) G.loop.tick(1 / 60); G.loop.draw(); if (t++ % 20 === 0) G.audio.play(G.rng.pick(['punch', 'door', 'select', 'whoosh']), {});
    if (now - T > 25000) { clearInterval(iv); lag.sort((a, b) => a - b); console.log(`reports ${n} avg ${(avg / Math.max(1, n)).toFixed(3)} peak ${peak.toFixed(3)} underrun sum ${over.toFixed(4)}; frame gap p50 ${lag[lag.length >> 1]} p99 ${lag[Math.floor(lag.length * 0.99)]} max ${lag[lag.length - 1]}`); process.exit(0); }
  }, 33);
};
ready();
