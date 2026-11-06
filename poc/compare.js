'use strict';
const { loadImage, createCanvas } = require('@napi-rs/canvas'), path = require('path'), fs = require('fs');
(async () => {
  const [ta = 'edge', tb = 'native'] = process.argv.slice(2);
  for (const n of ['city', 'bar', 'rural', 'heights']) {
    const a = await loadImage(fs.readFileSync(path.join(__dirname, "out", `${ta}_${n}.png`))), b = await loadImage(fs.readFileSync(path.join(__dirname, "out", `${tb}_${n}.png`)));
    if (a.width !== b.width || a.height !== b.height) { console.log(n, 'SIZE', a.width, a.height, b.width, b.height); continue; }
    const W = a.width, H = a.height, px = (i) => { const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, W, H).data; }, A = px(a), B = px(b);
    const c = createCanvas(W, H), x = c.getContext('2d'), im = x.createImageData(W, H); let same = 0, near = 0, big = 0, sum = 0;
    for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); sum += d; if (d === 0) same++; else if (d <= 8) near++; else big++; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.min(255, d * 6); im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); fs.writeFileSync(path.join(__dirname, 'out', `diff_${n}.png`), c.toBuffer('image/png'));
    const t = W * H; console.log(`${n}: identical ${(same / t * 100).toFixed(2)}%  within 8/255 ${(near / t * 100).toFixed(2)}%  different ${(big / t * 100).toFixed(2)}%  mean ${(sum / t).toFixed(2)}`);
  }
})();
