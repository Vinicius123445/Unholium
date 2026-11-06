// the ground from pieces against the same ground as one big image, on screen at the real zoom, with a burnt area
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  for (const id of ['rural', 'city']) {
    g.loadMap(id, 'start'); tick(10); G.loop.draw(); const m = g.map; m.finishGround(); await new Promise((r) => setTimeout(r, 200));
    const W = m.w * 16, H = m.h * 16, big = document.createElement('canvas'); big.width = W; big.height = H; const bx = big.getContext('2d'); bx.imageSmoothingEnabled = false; m.groundCanvas.draw(bx, 0, 0, W, H);
    for (const smooth of [false, true]) for (const [z, ox, oy] of [[2.133, 13.37, 7.61], [2.133, 255.4, 511.2], [1.7, 1023.6, 767.3], [3, 256, 256]]) {
      const shotOf = (f) => { const k = document.createElement('canvas'); k.width = 1360; k.height = 768; const x = k.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 1360, 768); x.imageSmoothingEnabled = smooth; x.scale(z, z); x.translate(-ox, -oy); f(x); return x.getImageData(0, 0, 1360, 768).data; };
      const sx = Math.floor(ox), sy = Math.floor(oy), sw = Math.ceil(1360 / z) + 1, sh = Math.ceil(768 / z) + 1, a = shotOf((x) => x.drawImage(big, sx, sy, sw, sh, sx, sy, sw, sh)), b = shotOf((x) => m.groundCanvas.draw(x, sx, sy, sw, sh));
      let n = 0, far = 0, pink = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d) n++; if (d > 12) far++; if (b[i] === 255 && b[i + 1] === 0 && b[i + 2] === 255 && !(a[i] === 255 && a[i + 1] === 0)) pink++; }
      console.log(id.padEnd(6), 'smooth', String(smooth).padEnd(5), 'zoom', z, 'at', ox, oy, '| differ', n, 'clearly', far, 'gaps', pink, 'of', a.length / 4);
    }
  }
};
