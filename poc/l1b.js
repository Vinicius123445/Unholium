module.exports = (G, g, p, shot, tick) => {
  g.loadMap('rural', 'start'); tick(10);
  const b3 = g.map.buildings.find((x) => x.id === 'r_trailer3'); p.x = (b3.x + b3.w + 3) * 16; p.y = (b3.y - 2) * 16; tick(40); shot('trailer');
  const d = g.map.decor.filter((q) => q.tx >= b3.x && q.tx < b3.x + b3.w && q.ty >= b3.y && q.ty < b3.y + 3); console.log(d.length, d.slice(0, 5).map((q) => [q.type, q.tx, q.ty, !!q._room, q._room && q._room.id, q._room && q._room.roofAlpha].join(' ')));
  const c = g.world.vehicles.find((v) => v.id === 'v_player'); const h = g.map.building(g.world.flags.player_home); console.log('car', c.x / 16, c.y / 16, 'door', h.doorX, h.doorY); p.x = (h.doorX + 1) * 16; p.y = (h.doorY + 4) * 16; tick(40); shot('door');
};
