// do pieces drawn side by side at a fractional zoom show a line?
const { Canvas } = require('D:/Unholium_native/native/node_modules/skia-canvas');
(async () => {
  const mk = (w, h, c) => { const k = new Canvas(w, h); k.gpu = true; const x = k.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = c; x.fillRect(0, 0, w, h); return k; };
  for (const smooth of [false, true]) for (const over of [0, 1]) {
    const s = new Canvas(1360, 768); s.gpu = true; const x = s.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1360, 768); x.save(); x.scale(2.133, 2.133); x.translate(-13.37, -7.61); x.imageSmoothingEnabled = smooth;
    const P = mk(258, 258, '#3c8a3c'); for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) x.drawImage(P, 1, 1, 256 + over, 256 + over, c * 256, r * 256, 256 + over, 256 + over); x.restore();
    const d = await s.toBuffer('raw'); let bad = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] && !(i % 1 )) { const v = d[i + 1]; if (Math.abs(v - 0x8a) > 1) bad++; } console.log('smoothing', smooth, 'overlap', over, 'wrong pixels', bad, 'of', n);
  }
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
