'use strict';
// Trading rules: open hours, prices (reputation + tension), buying and selling.

G.shopSys = {
  // A shop is open when its current owner is alive, present, calm, working, and doesn't hate you.
  isOpen(shopId, scene) {
    const w = scene.world;
    const owner = w.shopOwner(shopId);
    const npc = scene.actors.find((a) => a.id === owner && !a.dead);
    if (!npc) return false;
    if (npc.state !== 'schedule' || npc.st.hostile) return false;
    const s = G.SHOPS[shopId];
    if (w.getRep(s.region) <= -60) return false;
    if (s.faction && w.getRep(s.faction) < (s.minRep || 0)) return false;
    if (w.isHomeLost(npc.def)) return false;
    const e = npc.currentEntry(w);
    return !!e && (e.act === 'work' || e.act === 'wander' && !!npc.def.shop) && !npc.sleeping;
  },

  shopFor(npcId, world) {
    for (const id in world.shops) if (world.shops[id].owner === npcId) return id;
    return null;
  },

  repMult(world, region) {
    return G.util.clamp(1 - world.getRep(region) * 0.003, 0.7, 1.3) * (1 + (world.tension[region] || 0) / 400);
  },

  // Haggler skill + a successful "better prices?" speech check today.
  barter(shopId, world) {
    return (G.player ? G.skills.stat(G.player, 'barter') : 0) + (world.flags['haggle_' + shopId] === world.day ? 0.15 : 0);
  },

  priceBuy(shopId, itemId, world) {
    const s = G.SHOPS[shopId];
    return Math.max(1, Math.round(G.item(itemId).value * s.buyMult * this.repMult(world, s.region) * (1 - this.barter(shopId, world))));
  },

  priceSell(shopId, itemId, world) {
    const s = G.SHOPS[shopId];
    const it = G.item(itemId);
    if (it.type === 'quest') return 0;
    const fence = it.illegal && G.player && G.skills.has(G.player, 'fence') ? 1.25 : 1;
    return Math.max(1, Math.floor(it.value * s.sellMult / this.repMult(world, s.region) * (1 + this.barter(shopId, world)) * fence));
  },

  // Illegal goods only sell to shady faction shops, unless you have the Fence skill.
  accepts(shopId, itemId) {
    const it = G.item(itemId), s = G.SHOPS[shopId];
    if (it.type === 'quest') return false;
    if (it.illegal && !s.faction && !s.fence && !(G.player && G.skills.has(G.player, 'fence'))) return false;
    const b = s.buys;
    return b === 'all' || b.includes(it.type);
  },

  buy(shopId, itemId, player, world) {
    const s = world.shops[shopId];
    const e = s.stock.find((x) => x[0] === itemId);
    if (!e || e[1] <= 0) return 'Out of stock.';
    const price = this.priceBuy(shopId, itemId, world);
    if (player.gold < price) return 'Not enough money.';
    if (!player.inventory.canFit(itemId)) return 'Inventory full.';
    player.gold -= price;
    s.gold += price;
    e[1]--;
    if (e[1] <= 0) s.stock = s.stock.filter((x) => x[1] > 0);
    player.inventory.add(itemId, 1);
    return null;
  },

  sell(shopId, slotIndex, player, world) {
    const slot = player.inventory.slots[slotIndex];
    if (!slot) return 'Nothing to sell.';
    if (!this.accepts(shopId, slot.id)) return 'They are not interested in that.';
    const s = world.shops[shopId];
    const price = this.priceSell(shopId, slot.id, world);
    if (s.gold < price) return 'The merchant cannot afford it.';
    player.inventory.removeAt(slotIndex, 1);
    player.gold += price;
    s.gold -= price;
    const e = s.stock.find((x) => x[0] === slot.id);
    if (e) e[1]++;
    else s.stock.push([slot.id, 1]);
    return null;
  },
};
