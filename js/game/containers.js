'use strict';
// Containers: chests (owned — taking from them can be theft), corpses, animal carcasses, dropped bags.
// Their contents persist in G.world.containers.

// Storage furniture (the map's "chests"): name shown in the world and the sprite drawn.
G.STORAGE = {
  dresser: 'Dresser', register: 'Cash Register', locker: 'Locker', safe: 'Safe', filing: 'Filing Cabinet',
  toolbox: 'Toolbox', cabinet: 'Cabinet', stash: 'Duffel Bag',
};

G.containers = {
  ensureChests(world, map) {
    for (const c of map.chests) {
      const have = world.containers[c.id];
      if (have) { have.x = c.tx * 16 + 8; have.y = c.ty * 16 + (c.onCounter ? 16 : 14); have.onCounter = !!c.onCounter; continue; }   // furniture moved (the register onto the counter)
      world.containers[c.id] = {
        id: c.id, map: map.id, kind: 'chest', style: c.style || 'stash', name: G.STORAGE[c.style || 'stash'], owner: c.owner,
        x: c.tx * 16 + 8, y: c.ty * 16 + (c.onCounter ? 16 : 14), onCounter: !!c.onCounter, items: G.util.clone(c.loot || []), gold: c.gold || 0, day: 0,
      };
    }
  },

  createCorpse(world, npc, mapId) {
    const id = 'corpse_' + npc.id + '_' + world.day + '_' + Math.floor(Math.random() * 1e5);
    world.containers[id] = {
      id, map: mapId, kind: 'corpse', name: npc.displayName, owner: null, look: npc.look, victim: npc.transient ? null : npc.id,
      x: npc.x, y: npc.y, items: G.util.clone(npc.st.inv), gold: npc.st.gold, day: world.day,
    };
  },

  createCarcass(world, animal, mapId, loot) {
    const id = 'carcass_' + G.util.uid();
    world.containers[id] = {
      id, map: mapId, kind: 'carcass', name: animal.def.name, species: animal.species, owner: null,
      x: animal.x, y: animal.y, items: loot, gold: 0, day: world.day, dir: animal.dir,
      fallT: G.loop.time,   // (not worth saving: a reloaded carcass is simply lying there)
    };
  },

  createBag(world, mapId, x, y, items) {
    const id = 'bag_' + G.util.uid();
    world.containers[id] = { id, map: mapId, kind: 'bag', name: 'Dropped Items', owner: null, x, y, items, gold: 0, day: world.day };
    return world.containers[id];
  },

  forMap(world, mapId) {
    return Object.values(world.containers).filter((c) => c.map === mapId && !c.destroyed);
  },

  isEmpty(c) { return !c.gold && !c.items.some((e) => e[1] > 0); },

  // Housekeeping: empty bags/carcasses vanish, old remains decay.
  cleanup(world) {
    for (const id in world.containers) {
      const c = world.containers[id];
      if (c.kind === 'chest') continue;
      const age = world.day - c.day;
      if ((this.isEmpty(c) && age >= 1) || (c.kind === 'carcass' && age >= 3) || (c.kind === 'bag' && age >= 5 && !c.items.some((e) => G.item(e[0]).type === 'quest')) || (c.kind === 'corpse' && age >= 10)) {
        delete world.containers[id];
      }
    }
  },

  draw(ctx, c) {
    if (c.kind === 'chest') {
      const s = G.assets.sprites['st_' + (c.style || 'stash')] || G.assets.sprites.chest;
      ctx.drawImage(s.img, Math.round(c.x - s.ax), Math.round(c.y - s.ay - (c.onCounter ? 7 : 0)));   // up on the counter top
    } else if (c.kind === 'bag') {
      const s = G.assets.sprites.sack;
      ctx.drawImage(s.img, Math.round(c.x - s.ax), Math.round(c.y - s.ay));
    } else if (c.kind === 'corpse') {
      ctx.fillStyle = 'rgba(110,10,10,0.55)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 4, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      G.hd.drawCorpse(ctx, c);   // posed HD corpse (js/game/hdchars.js)
    } else if (c.kind === 'carcass') {
      const def = G.ANIMALS[c.species];
      const s2 = G.animals2.sheet(c.species, def.color, {});
      if (s2) {   // HD carcass: it buckles and topples over, legs kick a moment, then lies on its side with a pool spreading under it
        const ft = c.fallT != null && G.loop.time >= c.fallT ? G.loop.time - c.fallT : 99, k = Math.min(1, ft / 0.55), e = k * k * (3 - 2 * k), kick = ft > 0.55 && ft < 2.2 ? Math.sin(ft * 30) * (2.2 - ft) * 0.04 : 0, pr = Math.min(1, 0.25 + ft / 4);
        ctx.fillStyle = 'rgba(110,10,10,0.5)'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 1, (s2.dw || s2.fw) * 0.45 * pr, 3 * pr, 0, 0, Math.PI * 2); ctx.fill();
        if (k < 1 || kick) { ctx.save(); ctx.translate(Math.round(c.x), Math.round(c.y - (s2.dh || s2.fh) / 2 * e)); ctx.rotate(((c.dir === 1) ? -1 : 1) * (0.5 * Math.sin(e * Math.PI)) + kick); ctx.scale(1, Math.max(0.08, Math.abs(1 - 2 * e)) * (e > 0.5 ? -1 : 1)); ctx.drawImage(s2.img, 0, 0, s2.fw, s2.fh, -(s2.dw || s2.fw) / 2, e > 0.5 ? -(s2.dh || s2.fh) / 2 : -(s2.dh || s2.fh), (s2.dw || s2.fw), (s2.dh || s2.fh)); ctx.restore(); if (k < 1) return; }
        if (kick) return;
        ctx.fillStyle = 'rgba(110,10,10,0.5)'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 1, (s2.dw || s2.fw) * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(Math.round(c.x), Math.round(c.y - (s2.dh || s2.fh) / 2)); ctx.scale(1, -1); ctx.filter = 'saturate(0.7) brightness(0.9)';
        ctx.drawImage(s2.img, 0, 0, s2.fw, s2.fh, -(s2.dw || s2.fw) / 2, -(s2.dh || s2.fh) / 2, (s2.dw || s2.fw), (s2.dh || s2.fh)); ctx.restore();
      }
    }
  },
};
