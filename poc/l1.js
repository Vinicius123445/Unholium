module.exports = (G, g, p, shot, tick) => {
  const at = (map, spawn, x, y) => { g.loadMap(map, spawn); tick(6); if (x != null) { p.x = x; p.y = y; } tick(30); g.map.fog && 0; };
  console.log('start', g.map.id, p.x, p.y, Object.keys(g.map.points).filter((k) => /start|home|from/.test(k)).slice(0, 12));
  at('rural', 'start'); console.log('rural start', p.x / 16, p.y / 16);
  const near = g.map.decors ? g.map.decors.filter((d) => Math.hypot(d.tx * 16 - p.x, d.ty * 16 - p.y) < 300 && /^car|moto/.test(d.def.sprite || '')) : [];
  console.log('cars', near.map((d) => d.def.sprite + '@' + d.tx + ',' + d.ty));
  console.log('veh', g.vehicles && g.vehicles.slice(0, 8).map((v) => v.model + '@' + Math.round(v.x / 16) + ',' + Math.round(v.y / 16)));
  shot('rural_start');
  const b = g.map.buildings.find((x) => x.id === 'r_trailer1'); console.log(JSON.stringify({ x: b.x, y: b.y, w: b.w, h: b.h, kind: b.kind, roof: b.roof }));
  const b3 = g.map.buildings.find((x) => x.id === 'r_trailer3'); console.log(JSON.stringify({ x: b3.x, y: b3.y, w: b3.w, h: b3.h }));
  at('rural', 'start', (b3.x + b3.w + 3) * 16, (b3.y - 2) * 16); shot('trailer');
  console.log(g.map.decors.filter((d) => d.ty >= b3.y - 3 && d.ty <= b3.y + 1 && d.tx >= b3.x - 1 && d.tx <= b3.x + b3.w).map((d) => (d.key || d.def.sprite) + '@' + d.tx + ',' + d.ty + ' y' + d.y));
};
