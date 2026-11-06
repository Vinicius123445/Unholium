module.exports = (G, g, p, shot, tick) => {
  g.loadMap('fightclub', 'from_port'); tick(30); shot('pit');
  const ids = ['bat', 'crowbar', 'sledgehammer', 'katana', 'fire_axe', 'pistol', 'shotgun', 'kitchen_knife'];
  const ctx = G.renderer.canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#6a6a60'; ctx.fillRect(0, 0, 1280, 720); ctx.scale(6, 6);
  let n = 0; for (const k in G.ITEMS) { const it = G.ITEMS[k]; if (it.type !== 'weapon') continue; const w = Object.assign({ id: k }, it); G.heldGear.draw(ctx, w, 16 + (n % 4) * 52, 8 + Math.floor(n / 4) * 11, 0, '#d8a880'); n++; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  require('fs').writeFileSync('D:/Unholium_native/poc/out/f/weapons.png', G.renderer.canvas.toBufferSync('png'));
  g.loadMap('city', 'start'); tick(10);
  p.x = 1000; const w = g.world;
  const moto = new G.Vehicle({ model: 'moto_red', x: p.x + 50, y: p.y, angle: 0 }), moto2 = new G.Vehicle({ model: 'moto_chopper', x: p.x + 50, y: p.y + 30, angle: 0.5 }), bk = new G.Vehicle({ model: 'bike_red', x: p.x - 40, y: p.y, angle: 0 });
  g.vehicles.push(moto, moto2, bk); moto.ai = { }; moto.driver = null; bk.ai = {}; tick(3);
  p.x = moto.x; moto.update = () => {}; moto2.update = () => {}; bk.update = () => {}; moto.ai = true; bk.ai = true;
  tick(10); shot('moto');
};
