module.exports = (G, g, p, shot, tick) => {
  g.loadMap('rural', 'start'); tick(10); const m = g.map;
  const d = m.decor.find((q) => /extinguisher/.test(q.type) && q.ty <= 90 && q.ty >= 86), b = m.buildingAtTile(d.tx, d.ty); console.log(b.id, b.name, b.y, b.h, 'foot', d.y);
  for (const q of m.buildings) q.roofAlpha = 0; p.x = d.x; p.y = (b.y + 4) * 16;
  let r = []; for (let i = 0; i < 60; i++) r = G.realWalls.runs(m, { x: b.x * 16 - 50, y: b.y * 16 - 50, w: b.w * 16 + 100, h: b.h * 16 + 100 }, null);
  console.log(r.filter((q) => q.b === b).map((q) => `y${q.y} x${q.x0}-${q.x1} key${q.key} bot${(q.y + 1) * 16}`).join(' | '));
  console.log('shelves', m.decor.filter((q) => q.ty >= d.ty - 1 && q.ty <= d.ty + 3 && Math.abs(q.tx - d.tx) < 4).map((q) => `${q.type}@${q.tx},${q.ty} y${q.y}`).join(' | '));
  for (const q of m.buildings) q.roofAlpha = q === b ? 0 : 1; tick(60); shot('wall');
};
