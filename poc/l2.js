module.exports = (G, g, p, shot, tick) => {
  g.loadMap('jail', 'cell'); tick(6);
  const m = g.map, np = g.actors.filter((a) => a.kind === 'npc');
  const beds = m.decor.filter((d) => d.def.interact === 'bed').sort((a, b) => a.x - b.x);
  const bk = beds.find((d) => /bunk/.test(d.def.sprite)), bed = beds.filter((d) => d.def.sprite === 'bed').sort((a, b) => Math.abs(a.x - bk.x) - Math.abs(b.x - bk.x))[0];
  console.log('bunk', bk.x, bk.y, 'bed', bed.x, bed.y);
  const put = (a, d, side) => { a.state = 'schedule'; a.sleeping = true; a.update = () => {}; a.x = d.x; a.y = d.y - 10; a.moving = false; a.bedRef = d; a.onFloor = false; a.bedSide = side; a.sleepSpot = { x: d.tx, y: d.ty }; };
  put(np[0], bed); put(np[1], bk, 0); put(np[2], bk, 1);
  const f = np[3]; f.sleeping = true; f.update = () => {}; f.onFloor = true; f.bedRef = 'floor'; f.sleepSpot = null; f.x = bk.x + 34; f.y = bk.y + 34;
  p.x = (bed.x + bk.x) / 2; p.y = bed.y + 34; for (const b of g.map.buildings) b.roofAlpha = 0;
  tick(60); shot('sleep_jail');
};
