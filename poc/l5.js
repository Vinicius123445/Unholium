module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(20);
  const w = g.world, I = G.npcInv, L = (...a) => console.log(...a);
  const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.sleeping && !a.def.shop);
  L('npc', npc.id, npc.state, 'near', Math.round(npc.x), Math.round(npc.y));
  npc.st.inv = npc.st.inv.filter((e) => G.ITEMS[e[0]] && G.ITEMS[e[0]].type === 'weapon');
  p.x = npc.x + 30; p.y = npc.y; npc.update0 = npc.update;
  // single thing, then a heap
  const c = G.containers.createBag(w, g.map.id, npc.x + 40, npc.y + 10, [['beer', 1]]);
  const h = G.containers.createBag(w, g.map.id, npc.x - 30, npc.y + 18, [['beer', 2], ['sandwich', 1], ['bandage', 1]]);
  const b = G.containers.createBag(w, g.map.id, npc.x + 12, npc.y + 26, [['crowbar', 1]]);
  g.refreshContainers(); npc.update = () => {}; tick(60); shot('ground'); delete npc.update;
  L('reach:', I.reach(npc, g)); L('pockets:', I.pockets(npc));
  // request
  let q = I.request(npc, g, 'pick_up', 'beer', {}); L('req beer', q); const nearest = npc.itemJob && npc.itemJob.c; let n = 0;
  while (npc.itemJob && n++ < 900) { npc.state = 'schedule'; tick(1); }
  L('after', n, 'ticks; job', !!npc.itemJob, 'has beer', I.count(npc.st, 'beer'), 'bag left', !!w.containers[nearest], 'dist', Math.round(Math.hypot(npc.x - p.x, npc.y - p.y)));
  L('no such', I.request(npc, g, 'pick_up', 'diamond ring'));
  L('give missing', I.request(npc, g, 'give', 'sandwich'));
  q = I.request(npc, g, 'give', 'beer', {}); L('give beer', q); n = 0; while (npc.itemJob && n++ < 900) { npc.state = 'schedule'; tick(1); }
  L('player has beer', p.inventory.has('beer'), 'npc', I.count(npc.st, 'beer'));
  // use, equip, drop
  I.add(npc.st, 'sandwich', 1); npc.st.hunger = 90; q = I.request(npc, g, 'use_item', 'sandwich'); n = 0; while (npc.itemJob && n++ < 300) { npc.state = 'schedule'; tick(1); } L('ate', q, 'hunger', npc.st.hunger, 'left', I.count(npc.st, 'sandwich'));
  I.add(npc.st, 'crowbar', 1); q = I.request(npc, g, 'equip', 'crowbar'); n = 0; while (npc.itemJob && n++ < 300) { npc.state = 'schedule'; tick(1); } L('equip', q, npc.st.equip, npc.weaponItem && npc.weaponItem.name);
  q = I.request(npc, g, 'drop', 'crowbar'); n = 0; while (npc.itemJob && n++ < 300) { npc.state = 'schedule'; tick(1); } L('drop', q, 'count', I.count(npc.st, 'crowbar'), 'equip', npc.st.equip, 'wep', npc.weaponItem && npc.weaponItem.name);
  // autonomy: starving, food on the ground, nothing in pockets
  npc.st.hunger = 95; npc.st.inv = []; npc.itemThink = 0; npc.needTask = null; console.log('e', JSON.stringify(npc.currentEntry(w)), npc.state, npc.talking, npc.sleeping, npc.seated, !!npc.seek, !!npc.task, npc.loveTask, npc.followTask, npc.st.ko, npc.def.transient, npc.remote);
  const f = G.containers.createBag(w, g.map.id, npc.x + 20, npc.y + 6, [['sandwich', 1]]); g.refreshContainers(); npc.seek = null; npc.doing = null;
  n = 0; let j = null; while (n++ < 600 && (!j || npc.itemJob)) { npc.state = 'schedule'; tick(1); j = j || npc.itemJob; } L('now', npc.state, npc.seated, !!npc.seek, !!npc.needTask, npc.itemThink); L('autonomy job', j && j.kind, j && j.id, 'has', I.count(npc.st, 'sandwich'), 'hunger', Math.round(npc.st.hunger), 'ticks', n);
  // the model's action
  const r = { npc, scene: g, c: {}, aiLog: [{ who: 'player', text: 'can you give me a cigarette' }] };
  const out = G.ai.apply(r, [{ type: 'give', item: 'cigarettes' }], true, 'friendly'); L('ai give with none:', out.sayInstead);
  L('thin air: smoke weight', G.npcDoes.DOES.smoke.w(npc, { smoker: true, inside: false }));
  shot('after');
};
