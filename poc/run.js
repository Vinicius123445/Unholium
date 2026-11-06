'use strict';
// Loads the game exactly as index.html does (same files, same order) with no browser, and takes the pictures.
const fs = require('fs'), path = require('path'), vm = require('vm');
const t0 = performance.now();
const { game } = require('./shim');
const root = path.join(__dirname, '..');
const run = (f) => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
run(path.join(__dirname, 'seed.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const list = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
let bad = 0; for (const s of list) { try { run(path.join(root, s)); } catch (e) { bad++; console.log('SCRIPT FAILED', s, e.message.split('\n')[0]); if (bad > 8) break; } }
const t1 = performance.now(); console.log(`scripts ${list.length} failed ${bad} in ${Math.round(t1 - t0)} ms`);
run(path.join(__dirname, 'scene.js'));
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
PocScene((name) => { fs.writeFileSync(path.join(__dirname, 'out', `native_${name}.png`), (game.toBufferSync ? game.toBufferSync('png') : game.toBuffer('image/png'))); console.log('shot', name); }, (e) => { console.log(e ? e.stack : `done in ${Math.round(performance.now() - t0)} ms`); process.exit(e ? 1 : 0); });
