module.exports = async (G, g, p, shot, tick) => {
  g.loadMap('fightclub', 'from_port'); tick(20);
  for (const id of ['fc_door', 'fc_saint', 'fc_rat', 'fc_ox', 'fc_prof']) { const n = g.actors.find((a) => a.id === id); if (n) console.log(id, 'mask', JSON.stringify(n.look.mask), 'hat', JSON.stringify(n.look.hat), 'pm', JSON.stringify(Object.keys(n.look).filter((k) => /mask|face|cover|bala|paint/i.test(k)).map((k) => [k, n.look[k]])), 'def', JSON.stringify(n.def.look || {}).slice(0, 140)); }
  const all = Object.values(G.NPCS).filter((d) => d.look && d.look.mask).length; console.log('defs with mask', all, 'of', Object.keys(G.NPCS).length);
};
