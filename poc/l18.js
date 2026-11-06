module.exports = async (G, g, p, shot, tick) => {
  const fs = require('fs'), V = G.vehicleArt, M = G.vehicles.MODELS, c = G.renderer.canvas, x = c.getContext('2d');
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  const sheet = (name, fn) => { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#6e6a62'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; fn(); x.setTransform(1, 0, 0, 1, 0, 0); fs.writeFileSync(`D:/Unholium_native/poc/out/f/${name}.png`, c.toBufferSync('png')); };
  const motos = ['moto_red', 'moto_black', 'moto_blue', 'moto_chopper'].filter((m) => M[m]);
  sheet('motos_top', () => motos.forEach((id, i) => { const im = G.vehiclesHD.get(id); x.drawImage(im, 20 + (i % 2) * 660, 30 + Math.floor(i / 2) * 330, im.width * 2.1, im.height * 2.1); }));
  sheet('motos_side', () => motos.forEach((id, i) => { const m = Object.assign({ id }, M[id]); for (const [j, b] of [[0, false], [1, true]]) { const s = V.sideOf(m, b); x.drawImage(s.c, 20 + j * 660, 10 + i * 185, s.c.width * 2, s.c.height * 2 - 0); } }));
  sheet('car_wrecks', () => ['car_gray', 'car_blue', 'police_car', 'car_red'].filter((m) => M[m]).forEach((id, i) => { const im = V.wreckOf(id, i); const b = G.vehiclesHD.get(id), k = 620 / b.width; x.drawImage(i % 2 ? im : im, 20 + (i % 2) * 660, 30 + Math.floor(i / 2) * 330, 620, b.height * k); }));
  g.loadMap('city', 'start'); tick(10); const road = g.map.roads[0];
  tick(10);
  const add = (model, dx, dy, a, fn) => { const v = new G.Vehicle({ model, x: p.x + dx, y: p.y + dy, angle: a }); v.update = () => {}; g.vehicles.push(v); if (fn) fn(v); return v; };
  add('moto_red', -130, -40, 0.1); add('moto_black', -130, 10, 0, (v) => { v.fallen = true; v.fallT = 1; v.fallSide = 1; }); add('moto_blue', -60, 10, 0.7, (v) => { v.fallen = true; v.fallT = 1; v.fallSide = -1; });
  const a = add('car_gray', 70, -30, 0.2), b = add('moto_chopper', 50, 30, 0); G.explosions.explodeVehicle(g, a); G.explosions.explodeVehicle(g, b); tick(40); shot('wrecks_world');
  console.log('records', G.vehicles.records(g.world).filter((r) => r.burnt).length, 'car', JSON.stringify(a.rec).slice(0, 120));
};
