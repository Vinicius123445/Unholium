// which canvas operation keeps memory after everything using it is gone
const { Canvas } = require('D:/Unholium_native/native/node_modules/skia-canvas');
const rss = () => { global.gc(); return Math.round(process.memoryUsage().rss / 1048576); }, gpu = process.env.GPU !== '0';
const mk = (w, h) => { const c = new Canvas(w, h); c.gpu = gpu; return c; };
const src = mk(64, 64); const sx = src.getContext('2d'); sx.fillStyle = '#c84'; sx.fillRect(0, 0, 64, 64);
const tests = {
  'scratch: clear, draw, read, 300 times': () => { const c = mk(288, 288), x = c.getContext('2d'); for (let i = 0; i < 300; i++) { x.clearRect(0, 0, 288, 288); for (let k = 0; k < 40; k++) x.drawImage(src, k, k); x.getImageData(0, 0, 288, 288); } },
  'big canvas fed with 300 chunks, dropped': () => { const s = mk(288, 288), y = s.getContext('2d'), c = mk(5120, 3840), x = c.getContext('2d'); for (let i = 0; i < 300; i++) { y.clearRect(0, 0, 288, 288); y.fillStyle = `rgb(${i % 255},90,90)`; y.fillRect(0, 0, 288, 288); x.drawImage(s, (i % 30) * 170, (i >> 5) * 170); } const o = mk(1280, 720).getContext('2d'); o.drawImage(c, 0, 0); o.canvas.toBufferSync('raw'); },
  'many small canvases made and dropped': () => { for (let i = 0; i < 2000; i++) { const c = mk(16, 16); c.getContext('2d').fillRect(0, 0, 8, 8); } },
  'roof-size canvases made, drawn from, dropped': () => { const o = mk(1280, 720), x = o.getContext('2d'); for (let i = 0; i < 80; i++) { const c = mk(1200, 800), y = c.getContext('2d'); y.fillStyle = '#556'; y.fillRect(0, 0, 1200, 800); x.drawImage(c, 0, 0, 200, 200); } o.toBufferSync('raw'); },
  'one screen canvas, 2000 frames of drawImage': () => { const o = mk(1280, 720), x = o.getContext('2d'); for (let f = 0; f < 2000; f++) { for (let k = 0; k < 30; k++) x.drawImage(src, k, f % 200); if (f % 60 === 0) o.toBufferSync('raw'); } },
};
const keys = Object.keys(tests), pick = process.argv[2];
for (const k of keys) { if (pick && !k.startsWith(pick)) continue; const a = rss(), l = [a]; for (let r = 0; r < 4; r++) { tests[k](); l.push(rss()); } console.log(k.padEnd(48), l.join(' -> '), 'MB'); }
process.exit(0);
