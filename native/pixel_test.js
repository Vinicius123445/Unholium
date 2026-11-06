'use strict';
// The picture, held still: four scenes from the same dice, compared pixel by pixel with the approved baseline (native\baseline).
// node pixel_test.js          compare
// node pixel_test.js --accept make the current picture the baseline (only after a person has looked at it)
process.env.UNHOLIUM_MUTE = '1'; process.env.UNHOLIUM_DATA = 'D:/Unholium_native/tools/tmp/px'; process.env.W = '1256'; process.env.H = '628';
const fs = require('fs'), path = require('path'), R = require('./runtime'), { Canvas, loadImage } = require('skia-canvas');
fs.rmSync(process.env.UNHOLIUM_DATA, { recursive: true, force: true }); fs.mkdirSync(process.env.UNHOLIUM_DATA + '/storage', { recursive: true });
const dir = path.join(__dirname, 'baseline'), accept = process.argv.includes('--accept'); fs.mkdirSync(dir, { recursive: true });
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 600)); process.exit(1); });
R.runFile('D:/Unholium_native/poc/seed.js'); R.loadGame({ beforeMain() {} }); R.runFile('D:/Unholium_native/poc/scene.js');
const shots = [];
PocScene((name) => { shots.push([name, G.renderer.canvas.toBufferSync('png')]); }, async (e) => {
  if (e) { console.log(e.stack); process.exit(1); }
  let bad = 0;
  for (const [name, png] of shots) {
    const f = path.join(dir, name + '.png'); if (accept) { fs.writeFileSync(f, png); console.log(name, 'accepted'); continue; }
    if (!fs.existsSync(f)) { console.log(name, 'no baseline'); bad++; continue; }
    const px = async (src) => { const i = await loadImage(src), c = new Canvas(i.width, i.height); c.gpu = false; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; }, A = await px(f), B = await px(png); if (A.length !== B.length) { console.log(name, 'size changed'); bad++; continue; }
    let diff = 0, sum = 0; const n = A.length / 4; for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); sum += d; if (d > 12) diff++; }
    const share = diff / n * 100, ok = share < 0.5; console.log(`${name}: ${share.toFixed(3)}% of pixels changed, mean ${(sum / n).toFixed(3)} ${ok ? 'ok' : 'FAIL'}`); if (!ok) { bad++; fs.writeFileSync(path.join(dir, name + '_now.png'), png); }
  }
  process.exit(bad ? 1 : 0);
});
