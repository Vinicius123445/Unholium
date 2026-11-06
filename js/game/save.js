'use strict';
// Save system: localStorage slots. "auto" is written on map transitions and sleeping, "quick" with F5.

G.saves = {
  manualSlots: ['1', '2', '3'],
  allSlots: ['auto', 'quick', '1', '2', '3'],
  label(slot) { return slot === 'auto' ? 'Autosave' : slot === 'quick' ? 'Quicksave' : 'Slot ' + slot; },
  key(slot) { return G.config.SAVE_PREFIX + slot; },

  write(slot, scene) {
    const w = G.world;
    // persist live NPC positions so loading restores them exactly
    for (const a of scene.actors) if (a.kind === 'npc' && !a.dead) { a.st.x = a.x; a.st.y = a.y; a.st.map = scene.map.id; }
    const data = {
      meta: {
        version: G.config.VERSION, date: Date.now(), day: w.day, time: w.timeString,
        mapId: scene.map.id, mapName: scene.map.meta.name, playSeconds: Math.floor(w.stats.playSeconds),
        gold: scene.player.gold, hp: Math.round(scene.player.hp),
      },
      world: w.toJSON(),
      player: scene.player.serialize(),
      mapId: scene.map.id,
    };
    const ok = G.store.set(this.key(slot), data);
    for (const a of scene.actors) if (a.kind === 'npc') { a.st.x = null; a.st.y = null; }
    return ok;
  },

  read(slot) { return G.store.get(this.key(slot)); },
  meta(slot) { const d = this.read(slot); return d ? d.meta : null; },
  remove(slot) { G.store.remove(this.key(slot)); },

  latest() {
    let best = null;
    for (const s of this.allSlots) {
      const m = this.meta(s);
      if (m && (!best || m.date > best.meta.date)) best = { slot: s, meta: m };
    }
    return best;
  },

  any() { return !!this.latest(); },
};
