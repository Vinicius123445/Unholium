'use strict';
// NPCs shoot real rounds.
//   Every shot comes out of the magazine in their gun (st.mag); an empty magazine is refilled from the
//   rounds they carry (st.inv), which takes them a moment (the reload pose, the sound). Out of rounds
//   altogether, they cannot shoot: they close in and hit you with the gun instead, or run.
//   Where rounds come from: someone who has carried a gun since before this rule gets what they would
//   plausibly have on them once (two to four magazines). After that they only get more by acquiring
//   them: police and guards are resupplied at the station each morning, anyone else with the money buys
//   a box at a gun store (the morning and evening shopping runs). Kill them and their rounds are yours.
(() => {
const NP = G.NPC.prototype;
const count = (st, id) => (st.inv || []).reduce((n, e) => n + (e[0] === id ? e[1] || 1 : 0), 0);
const take = (st, id, n) => {
  for (const e of st.inv) { if (n <= 0) break; if (e[0] !== id) continue; const k = Math.min(n, e[1] || 1); e[1] = (e[1] || 1) - k; n -= k; }
  st.inv = st.inv.filter((e) => e[0] !== id || e[1] > 0);
};
const gunOf = (def, st) => { const w = def && def.weapon && G.ITEMS[def.weapon]; return w && w.gun && w.ammo && (st.inv || []).some((e) => e[0] === def.weapon) ? w : null; };
const isLaw = (def) => def && (def.combat === 'guard' || def.faction === 'government' || def.law || /police|guard|officer|cop/i.test(def.name || ''));

G.npcAmmo = {
  count, take,
  // the rounds someone already armed would have on them (once)
  seed(st, def) {
    const w = gunOf(def, st); if (!w || st.ammoSeeded) return;
    st.ammoSeeded = true;
    st.inv.push([w.ammo, w.mag * G.rng.int(2, 4)]);
    if (st.mag == null) st.mag = w.mag;
  },
  rounds(npc) { const w = npc.weaponItem; if (!w || !w.gun) return 0; this.seed(npc.st, npc.def); return (npc.st.mag || 0) + count(npc.st, w.ammo); },
  // more rounds, only by getting them: resupply for the law, a purchase for everyone else
  restock(w) {
    for (const id in w.npcs) {
      const st = w.npcs[id], def = G.NPCS[id];
      if (!def || !st.alive || st.jailedUntil > w.day) continue;
      const g = gunOf(def, st); if (!g) continue;
      this.seed(st, def);
      const have = count(st, g.ammo), want = g.mag * 3;
      if (have >= want) continue;
      if (isLaw(def)) { if (w.hour === 6) st.inv.push([g.ammo, want - have]); continue; }
      const box = g.mag * 2, cost = (G.ITEMS[g.ammo].value || 1) * box;
      if (have < g.mag && (st.gold || 0) >= cost + 10) { st.gold -= cost; st.inv.push([g.ammo, box]); }
    }
  },
};

// a gun only counts as a gun while there is something to shoot with it
Object.defineProperty(NP, 'hasGun', {
  configurable: true,
  get() { const w = this.weaponItem; return !!(w && w.gun) && (!w.ammo || G.npcAmmo.rounds(this) > 0); },
});
const F = G.firearms, _fire = F.npcFire;
F.npcFire = function (npc, scene, target) {
  const w = npc.weaponItem;
  if (!w || !w.gun || !w.ammo) return _fire.apply(this, arguments);
  const st = npc.st;
  G.npcAmmo.seed(st, npc.def);
  if (npc.reloadT > 0) return;
  if (!(st.mag > 0)) {   // empty: reload from what they carry, or nothing happens
    const have = count(st, w.ammo);
    if (!have) { npc.attackCd = 0.6; return; }
    const n = Math.min(w.mag, have); take(st, w.ammo, n); st.mag = n;
    npc.reloadT = (w.reload || 1.5) * 1.4; npc.attackCd = npc.reloadT;
    G.audio.play('reload', { x: npc.x, y: npc.y });
    if (Math.random() < 0.4 && npc.say) npc.say(G.rng.pick(['Reloading!', 'Cover me!', 'Hold on—']), 1.5);
    return;
  }
  st.mag--;
  return _fire.apply(this, arguments);
};
const _upd = NP.update;
NP.update = function (dt, scene) {
  if (this.reloadT > 0) this.reloadT -= dt;
  return _upd.call(this, dt, scene);
};
G.events.on('hour', () => { if (G.world && (G.world.hour === 6 || G.world.hour === 18)) G.npcAmmo.restock(G.world); });
})();
