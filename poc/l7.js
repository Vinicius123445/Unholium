module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(10);
  p.inventory.add('crowbar', 1); p.equipFromSlot(p.inventory.slots.findIndex((q) => q && q.id === 'crowbar'));
  const { Canvas, loadImage } = require('D:/Unholium_native/native/node_modules/skia-canvas'), r = G.renderer.canvas, out = new Canvas(1200, 400); out.gpu = false; const x = out.getContext('2d');
  const orig = p.update; p.update = () => {};
  [[0, 0], [1, 1], [2, 2], [3, 3], [2, 0]].forEach(([dir, k]) => {});
  let n = 0;
  for (const dir of [0, 1, 2, 3]) for (const walk of [false, true]) {
    p.dir = dir; p.moving = walk; p._b = null; if (walk) p.vx = 1; tick(walk ? 12 : 2); for (let i = 0; i < 4; i++) G.loop.draw();
    x.drawImage(r, 640 - 60, 330 - 75, 120, 150, 10 + (n % 8) * 148, 40, 144, 180); n++;
  }
  require('fs').writeFileSync('D:/Unholium_native/poc/out/f/hands.png', out.toBufferSync('png'));
};
