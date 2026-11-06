'use strict';
// CONSEQUENCES — how the world reacts, both to the player and on its own.
// This file is meant to grow with your lore. Every rule is a plain function receiving the World.
//
//   onDeath(w, npcId, info)   any NPC died. info = { byPlayer, witnessed, map, region, killerFaction }
//   onCrime(w, crime)         the player committed a crime. crime = { type, region, witnessed, victim }
//   daily(w)                  every morning at 00:00 (also during sleeping/jail time skips)
//   events[name](w, data)     delayed events scheduled with w.schedule(days, name, data)

G.CRIMES = {
  assault:   { label: 'Assault',      bounty: 40,  rep: -8,  tension: 5 },
  murder:    { label: 'Murder',       bounty: 250, rep: -25, tension: 25 },
  cannibalism: { label: 'Cannibalism', bounty: 500, rep: -40, tension: 30 },
  theft:     { label: 'Theft',        bounty: 0,   rep: -5,  tension: 3 },   // bounty = 2x item value
  livestock: { label: 'Animal Theft', bounty: 50,  rep: -6,  tension: 4 },
  extortion: { label: 'Extortion',    bounty: 60,  rep: -10, tension: 6 },
  arson:     { label: 'Arson',        bounty: 150, rep: -20, tension: 20 },
  vandalism: { label: 'Vandalism',    bounty: 15,  rep: -3,  tension: 2 },
  gunfire:   { label: 'Discharging a Firearm', bounty: 40, rep: -5, tension: 8 },
  drugs:     { label: 'Drug Use',     bounty: 20,  rep: -3,  tension: 1 },
  trespass:  { label: 'Trespassing',  bounty: 25,  rep: -4,  tension: 2 },
};
G.BOUNTY_KILL_ON_SIGHT = 400;   // guards stop arresting and attack at this bounty

G.CONSEQUENCES = {
  onDeath: [
    // Relatives grieve. If they saw who did it and they can fight, they seek revenge.
    (w, id, info) => {
      for (const otherId in G.NPCS) {
        const rel = G.NPCS[otherId].relations[id];
        const st = w.npcs[otherId];
        if (!rel || !st || !st.alive) continue;
        st.mood = 'grieving';
        st.moodUntil = w.day + 4;
        st.grievingFor = id;
        if (info.byPlayer && info.witnessed && ['spouse', 'family', 'parent', 'child', 'comrade', 'friend', 'master', 'apprentice'].includes(rel)) {
          if (G.NPCS[otherId].combat !== 'flee') {
            st.hostile = true;
            w.log(`${w.displayName(otherId)} swears revenge for the death of ${w.displayName(id)}.`, 'bad');
          } else {
            st.fear = 100;
          }
        }
      }
    },
    // The smithy is inherited by the apprentice a couple of days later.
    (w, id) => {
      if (id === 'r_smith' && w.isAlive('r_apprentice')) w.schedule(2, 'smith_succession');
      if (id === 'r_smith' && !w.isAlive('r_apprentice')) w.rumor('The hardware store is closed for good. No one is left to run it.', 'rural');
      if (id === 'r_apprentice' && !w.isAlive('r_smith')) w.rumor('The hardware store is closed for good. No one is left to run it.', 'rural');
    },
    // Bandit camp destroyed when every bandit is dead.
    (w, id) => {
      if (G.NPCS[id].faction !== 'bandits') return;
      const left = Object.keys(G.NPCS).filter((k) => G.NPCS[k].faction === 'bandits' && w.isAlive(k));
      if (left.length === 0 && !w.flags.bandits_destroyed) {
        w.flags.bandits_destroyed = true;
        w.log('The bandit camp has been wiped out.', 'good');
        w.rumor('The bandits in the forest are dead. The farms can breathe again.', null);
        w.addRep('rural', 10, true);
        w.addRep('hunters', 10, true);
      }
    },
    // Island leader killed after choosing to fight = "destroy" ending.
    (w, id) => {
      // (no ending trigger: the game is endless for now)
    },
    // Faction fallout: killing a member angers the faction even without witnesses if they had a grudge;
    // gang violence between NPCs becomes street talk; a fallen leader leaves the faction in disarray.
    (w, id, info) => {
      const def = G.NPCS[id];
      const f = G.FACTIONS[def.faction];
      if (!f || !f.listed) return;
      if (info.killerFaction && info.killerFaction !== def.faction) {
        w.rumor(`A ${f.name} member was killed in a fight with the ${G.FACTIONS[info.killerFaction].name}.`, info.region);
      }
      if (def.leader) {
        w.flags['leaderless_' + def.faction] = w.day;
        w.rumor(`The leader of the ${f.name} is dead. Their people are in chaos.`, null);
        w.log(`The leader of the ${f.name} is dead.`, 'warn');
        for (const other of G.listedFactions()) if (G.factionsAtWar(other, def.faction)) w.addRep(other, info.byPlayer ? 15 : 0, false, false);
      }
    },
  ],

  onCrime: [
    // Witnessed violent crimes make the government (the law) think less of you.
    (w, crime) => {
      if (!crime.witnessed) return;
      if (crime.type === 'murder') w.addRep('government', -10);
      if (crime.type === 'arson') w.addRep('government', -8);
    },
  ],

  daily: [
    // Shops restock (only if their owner is alive).
    (w) => {
      for (const id in G.SHOPS) if (w.isAlive(w.shopOwner(id))) w.restockShop(id);
    },
    // Bounties fade slowly if the player keeps out of trouble for 3+ days. Grudges fade too.
    (w) => {
      for (const r in w.bounty) {
        if (w.bounty[r] > 0 && w.day - (w.lastCrimeDay[r] || 0) >= 3) w.bounty[r] = Math.floor(w.bounty[r] * 0.9);
        w.tension[r] = Math.max(0, w.tension[r] - 4);
      }
      for (const k in w.rep) if (Math.abs(w.rep[k]) <= 30 && w.rep[k] !== 0) w.rep[k] -= Math.sign(w.rep[k]);
      for (const id in w.npcs) {
        const st = w.npcs[id];
        if (st.mood && st.moodUntil <= w.day) { st.mood = null; st.grievingFor = null; }
        if (st.fear > 0) st.fear = Math.max(0, st.fear - 25);
      }
    },
    // Unwitnessed murders: the bodies are found the next day.
    (w) => {
      for (const id in w.dead) {
        const d = w.dead[id];
        if (d.discovered) continue;
        d.discovered = true;
        const name = w.npcs[id].name;
        w.rumor(`${name} was found dead. No one knows who did it.`, d.region);
        w.log(`The body of ${name} was discovered.`, 'warn');
        w.tension[d.region] = Math.min(100, (w.tension[d.region] || 0) + 15);
      }
    },
    // Wildlife: regrowth and a simple ecology (wolves need deer; no wolves = deer boom; wolves raid farms).
    (w) => {
      const forest = w.wildlifeReport('forest');
      for (const key in w.wildlife) {
        const z = w.wildlife[key];
        if (z.count >= z.max) continue;
        if (z.owner && !w.isAlive(z.owner)) continue;           // dead rancher = no new livestock
        let grow = 1;
        if (z.kind === 'deer' && forest.wolf === 0) grow = 2;
        if (z.kind === 'wolf' && forest.deer < 2) grow = 0;
        if (z.kind === 'bear' && G.rng.next() < 0.8) grow = 0;
        z.count = Math.min(z.max, z.count + grow);
      }
      if (forest.wolf >= 3 && forest.deer <= 2 && G.rng.chance(0.5)) {
        const pen = w.wildlife['rural:0'];
        if (pen && pen.count > 0) {
          pen.count--;
          w.rumor('Wolves came out of the forest and took a chicken from the ranch.', 'rural');
          w.tension.rural = Math.min(100, w.tension.rural + 5);
        }
      }
    },
    // Bandits raid the farms every 3 days while they exist.
    (w) => {
      if (w.flags.bandits_destroyed || w.day % 3 !== 0) return;
      const s = w.shops.r_store;
      if (s) s.gold = Math.max(0, s.gold - 60);
      w.tension.rural = Math.min(100, w.tension.rural + 10);
      w.rumor('Bandits raided the farms again last night.', 'rural');
    },
    // Opening the noble's package does not go unnoticed.
    (w) => {
      if (w.flags.package_opened && !w.flags.package_consequence && w.day > w.flags.package_opened_day) {
        w.flags.package_consequence = true;
        if (w.isAlive('c_noble1')) {
          w.addRep('city', -10, true);
          w.addRep('civilians', -10, true);
          w.log('The businessman found out you opened the package.', 'bad');
          w.rumor('A businessman is telling everyone that a certain courier cannot be trusted.', 'city');
        }
      }
    },
    // The government replaces fallen guards after 3 days. Gangs recruit new members after 4 days,
    // but only while their boss is alive. Leaders are never replaced.
    (w) => {
      for (const id in w.dead) {
        const def = G.NPCS[id];
        const age = w.day - w.dead[id].day;
        if (def.combat === 'guard' && def.faction === 'government' && age >= 3) {
          w.reviveAsReplacement(id, def.name.replace(' (Recruit)', '') + ' (Recruit)');
          w.rumor('New recruits have joined the police.', G.maps.get(def.map).meta.region);
        } else if (G.FACTIONS[def.faction] && G.FACTIONS[def.faction].gang && !def.leader && age >= 4) {
          const boss = Object.keys(G.NPCS).find((k) => G.NPCS[k].faction === def.faction && G.NPCS[k].leader);
          if (boss && w.isAlive(boss)) {
            w.reviveAsReplacement(id, def.name);
            w.rumor(`The ${G.FACTIONS[def.faction].name} has new faces on the street.`, 'city');
          }
        }
      }
    },
    // Rebuilding & regrowth: destroyed homes are rebuilt (city after 4 days, elsewhere after 6, only if
    // someone is left to rebuild them), burnt grass and fields grow back.
    (w) => {
      const changed = new Set();
      for (const mapId in w.mapMods) {
        const mods = w.mapMods[mapId];
        const map = G.maps.get(mapId);
        for (const id in mods.buildings) {
          const st = mods.buildings[id];
          const b = map.building(id);
          if (!b) continue;
          const residents = Object.keys(G.NPCS).filter((n) => G.NPCS[n].home === id && G.NPCS[n].map === mapId);
          const someone = residents.some((n) => w.isAlive(n)) || (mapId === 'city' && residents.length === 0);
          if (!someone || (st.debris || 0) > 0 || w.day - st.day < (G.cleanup ? G.cleanup.REBUILD_DAYS : 6)) continue;   // the cleanup crew clears the rubble first (js/game/firelife.js)
          delete mods.buildings[id];
          const inRect = (tx, ty) => tx >= b.x - 1 && tx <= b.x + b.w && ty >= b.y - 1 && ty <= b.y + b.h;
          for (const i in mods.tiles) if (inRect(i % map.w, Math.floor(i / map.w))) delete mods.tiles[i];
          for (const key of ['removed', 'added']) {
            for (const k in mods[key]) {
              const [tx, ty] = k.split('@')[1].split(',').map(Number);
              if (inRect(tx, ty)) delete mods[key][k];
            }
          }
          for (const ch of map.chests) {
            const c = w.containers[ch.id];
            if (c && c.destroyed && inRect(ch.tx, ch.ty)) { c.destroyed = false; c.items = []; c.gold = 0; }
          }
          for (const n of residents) if (w.npcs[n] && w.npcs[n].mood === 'homeless') w.npcs[n].mood = null;
          w.rumor(`The ${b.name} has been rebuilt.`, map.meta.region);
          w.log(`The ${b.name} has been rebuilt.`);
          changed.add(mapId);
        }
        for (const i in mods.tiles) {
          const [t, day] = mods.tiles[i];
          const rg = G.TILES[t].regrow;
          if (rg && w.day - day >= rg) { delete mods.tiles[i]; changed.add(mapId); }
        }
      }
      for (const id of changed) G.maps.invalidate(id);
    },
    // Process scheduled events
    (w) => w.runTimers(),
  ],

  events: {
    // The player told the CIA/Government where the revolutionaries meet: a raid wipes out the cell.
    rev_raid(w) {
      let n = 0;
      for (const id in G.NPCS) {
        const d = G.NPCS[id];
        if (d.faction !== 'revolutionaries' || !w.isAlive(id)) continue;
        if (d.map === 'forest' || id === 'c_preacher') {
          w.registerDeath(id, { byPlayer: false, witnessed: true, map: d.map, killerFaction: 'government' });
          n++;
        }
      }
      w.flags.revs_exposed = true;
      w.rumor(`Government agents raided a secret meeting in the forest ruins. ${n} dead.`, null);
      w.log('The revolutionaries were raided because of your information.', 'warn');
    },
    smith_succession(w) {
      if (!w.isAlive('r_apprentice')) return;
      w.shops.r_smith.owner = 'r_apprentice';
      w.npcs.r_apprentice.name = 'Mechanic';
      w.npcs.r_apprentice.scheduleFrom = 'r_smith';
      w.rumor('The apprentice has taken over the hardware store.', 'rural');
      w.log('The apprentice now runs the hardware store.', 'info');
    },
  },
};
