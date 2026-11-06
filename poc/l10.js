module.exports = (G, g, p, shot, tick) => {
  g.loadMap('rural', 'start'); tick(10);
  const m = g.map, pieces = m.decor.filter((d) => /^v_w_/.test(d.type)).slice(0, 6), H = 0;
  for (const d of pieces) { const b = m.buildingAtTile(d.tx, d.ty); console.log(d.type, 'tile', d.tx, d.ty, 'y', d.y, 'b', b && b.id, b && b.y, b && b.h, 'spr', G.assets.sprites[d.def.sprite].h, G.assets.sprites[d.def.sprite].ay); }
  const d = pieces.find((q) => /extinguisher/.test(q.type)) || pieces[0], b = m.buildingAtTile(d.tx, d.ty);
  const r = G.realWalls && G.realWalls.runs(m, { x: b.x * 16 - 50, y: b.y * 16 - 50, w: b.w * 16 + 100, h: b.h * 16 + 100 }, null).filter((q) => q.b === b).slice(0, 5); console.log(r.map((q) => [q.y, q.x0, q.x1, q.key, q.street].join(' ')));
  console.log('tile rows', [0, 1, 2, 3].map((k) => G.TILES[m.get(d.tx, b.y + k)].name));
  for (const q of g.map.decor.filter((z) => /extinguisher/.test(z.type)).slice(0, 8)) console.log('ext', q.tx, q.ty, q.y, G.TILES[g.map.get(q.tx, q.ty)].name, G.TILES[g.map.get(q.tx, q.ty + 1)].name);
  p.x = d.x; p.y = (b.y + 5) * 16; for (const q of m.buildings) q.roofAlpha = q === b ? 0 : 1; tick(50); shot('wall'); console.log('door pieces', m.decor.filter((q) => q.type === 'doorway').length);
};
