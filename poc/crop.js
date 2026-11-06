const { Canvas, loadImage } = require('../native/node_modules/skia-canvas'), fs = require('fs');
(async () => { const names = process.argv.slice(2), c = new Canvas(480 * names.length, 360); c.gpu = false; const x = c.getContext('2d');
  for (let i = 0; i < names.length; i++) { const im = await loadImage(`D:/Unholium_native/poc/out/f/${names[i]}.png`); x.drawImage(im, 640 - 160, 340 - 120, 320, 240, i * 480, 0, 480, 360); }
  fs.writeFileSync('D:/Unholium_native/poc/out/f/crop.png', await c.toBuffer('png')); })();
