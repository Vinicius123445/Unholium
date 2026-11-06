'use strict';
// Gang war: the Red and Blue gangs own territories (js/data/territories.js) and attack each other's.
//
// world.territories = { id: { owner, control 0..100 } }      world.raid = the attack going on (or null)
// Every game hour a gang may attack a neighboring territory it does not own. An attack lasts a couple of
// hours. If you are on that map you see it happen: attackers and defenders spawn and fight, and the
// survivors decide it. If you are elsewhere it is settled by the gangs' strength (members alive,
// territories held, you as a member). A successful attack drains the defender's control; at 0 the
// territory changes hands. Killing a gang's members inside its own territory also weakens its hold.

G.gangWar = {
  abs(w) { return w.day * 1440 + w.minutes; },

  init(w) {
    w.territories = {};
    for (const id in G.TERRITORIES) {
      const t = G.TERRITORIES[id];
      w.territories[id] = { owner: t.owner, control: t.owner ? (t.hq ? 100 : 70) : 0 };
    }
    w.raid = null;
    w.raidCount = 0;
  },
  ensure(w) { if (!w.territories) this.init(w); },

  owner(w, id) { this.ensure(w); return w.territories[id].owner; },
  ownedBy(w, gang) { this.ensure(w); return Object.keys(w.territories).filter((id) => w.territories[id].owner === gang); },
  rival(gang) { return G.GANGS.find((g) => g !== gang); },

  // Which territory contains this tile?
  at(mapId, tx, ty) {
    for (const id in G.TERRITORIES) {
      const t = G.TERRITORIES[id];
      if (t.map === mapId && tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h) return id;
    }
    return null;
  },

  members(w, gang) {
    let n = 0;
    for (const id in G.NPCS) if (G.NPCS[id].faction === gang && w.isAlive(id)) n++;
    return n;
  },

  strength(w, gang) {
    return 20 + this.members(w, gang) * 8 + this.ownedBy(w, gang).length * 4 + (w.isMember(gang) ? 15 : 0);
  },

  // Territories a gang can attack: neighbors of what it owns that it does not own.
  targets(w, gang) {
    const out = new Set();
    for (const id of this.ownedBy(w, gang)) for (const a of G.TERRITORIES[id].adj) if (w.territories[a].owner !== gang) out.add(a);
    return [...out];
  },

  notify(w, text, type = 'warn') {
    w.log(text, type);
    G.events.emit('gangWar', text);
  },

  startRaid(w, attacker, target, o = {}) {
    this.ensure(w);
    if (w.raid) return false;
    const now = this.abs(w);
    w.raidCount = (w.raidCount || 0) + 1;
    w.raid = {
      id: 'r' + w.raidCount, attacker, defender: w.territories[target].owner, territory: target,
      start: now, end: now + G.GANG_WAR.raidHours * 60, playerLed: !!o.playerLed,
      spawnedA: 0, spawnedD: 0, killsA: 0, killsD: 0,
    };
    const t = G.TERRITORIES[target];
    this.notify(w, `${G.FACTIONS[attacker].name} is moving on ${t.name}${w.raid.defender ? ` (${G.FACTIONS[w.raid.defender].name} turf)` : ''}.`);
    w.rumor(`Word on the street: the ${G.FACTIONS[attacker].name} is about to hit ${t.name}.`, 'city');
    return true;
  },

  hourly(w) {
    this.ensure(w);
    const now = this.abs(w);
    if (w.raid) { if (now >= w.raid.end) this.resolve(w); return; }
    if (!G.rng.chance(G.GANG_WAR.raidChancePerHour)) return;
    const gangs = G.GANGS.filter((g) => this.targets(w, g).length && this.members(w, g) > 0);
    if (!gangs.length) return;
    const weights = gangs.map((g) => this.strength(w, g));
    let pick = G.rng.next() * weights.reduce((a, b) => a + b, 0), attacker = gangs[0];
    for (let i = 0; i < gangs.length; i++) { pick -= weights[i]; if (pick <= 0) { attacker = gangs[i]; break; } }
    const options = this.targets(w, attacker);
    // prefer unclaimed ground, then the weakest-held block
    options.sort((a, b) => (w.territories[a].owner ? 1 : 0) - (w.territories[b].owner ? 1 : 0) || w.territories[a].control - w.territories[b].control);
    this.startRaid(w, attacker, G.rng.chance(0.7) ? options[0] : G.rng.pick(options));
  },

  // Settle the current attack.
  resolve(w) {
    const raid = w.raid;
    if (!raid) return;
    w.raid = null;
    const st = w.territories[raid.territory], t = G.TERRITORIES[raid.territory];
    const live = raid.spawnedA > 0;
    let won;
    if (live) {
      const aliveA = raid.spawnedA - raid.killsA, aliveD = raid.spawnedD - raid.killsD;
      won = aliveA > 0 && aliveA >= aliveD;
    } else {
      const sA = this.strength(w, raid.attacker);
      const sD = raid.defender ? this.strength(w, raid.defender) + (t.hq ? 25 : 10) + st.control * 0.2 : 5;
      won = G.rng.chance(sA / (sA + sD));
    }
    const A = G.FACTIONS[raid.attacker].name;
    if (won) {
      st.control -= G.GANG_WAR.winControl + G.rng.int(0, 15);
      if (st.control <= 0 || !st.owner) {
        st.owner = raid.attacker;
        st.control = 40;
        this.notify(w, `${A} took ${t.name}!`, 'quest');
        w.rumor(`${t.name} belongs to the ${A} now.`, 'city');
      } else this.notify(w, `${A} hit ${t.name} hard, but the ${G.FACTIONS[st.owner].name} still holds it.`);
    } else {
      if (st.owner) st.control = Math.min(100, st.control + G.GANG_WAR.holdControl);
      this.notify(w, `The attack on ${t.name} failed. ${A} pulled back.`);
    }
    // members who fought on the winning side get paid
    const winner = won ? raid.attacker : raid.defender;
    if (live && winner && w.isMember(winner)) {
      w.addRep(winner, 8);
      G.events.emit('giveGold', 60);
      G.events.emit('xp', 40, 'Gang war');
    }
  },

  // A gang member died: the gang loses its grip on the block, and it counts for any attack in progress.
  onDeath(w, npc, mapId) {
    this.ensure(w);
    const gang = npc.def.faction;
    if (!G.GANGS.includes(gang)) return;
    const id = this.at(mapId, Math.floor(npc.x / 16), Math.floor((npc.y - 3) / 16));
    if (!id) return;
    const st = w.territories[id];
    if (st.owner === gang) {
      st.control = Math.max(0, st.control - G.GANG_WAR.killControl);
      if (st.control === 0 && !w.raid) {
        const rival = this.rival(gang);
        if (G.TERRITORIES[id].adj.some((a) => w.territories[a].owner === rival)) this.startRaid(w, rival, id);
      }
    }
    const raid = w.raid;
    if (raid && raid.territory === id && npc.raidSide) {
      if (npc.raidSide === 'A') raid.killsA++;
      else raid.killsD++;
    }
  },

  daily(w) {
    this.ensure(w);
    for (const id in w.territories) {
      const st = w.territories[id];
      if (st.owner) st.control = Math.min(100, st.control + G.GANG_WAR.dailyRegen);
    }
  },

  // Street spawns for the current map: the owner's members hang around their blocks (more at night),
  // nobody's land gets muggers after dark.
  zones(scene) {
    const w = scene.world, out = [];
    this.ensure(w);
    const night = w.isNight();
    for (const id in G.TERRITORIES) {
      const t = G.TERRITORIES[id];
      if (t.map !== scene.map.id) continue;
      const owner = w.territories[id].owner;
      const spawns = {};
      if (owner) spawns[owner] = night ? G.GANG_WAR.nightMembers : G.GANG_WAR.dayMembers;
      if (night) spawns.mugger = 1;
      out.push({ key: 'turf:' + id, name: t.name, x: t.x, y: t.y, w: t.w, h: t.h, spawns });
    }
    return out;
  },

  // Bring the attack to life when the player is on that map.
  updateScene(scene) {
    const w = scene.world, raid = w.raid;
    if (!raid) return;
    const t = G.TERRITORIES[raid.territory];
    if (t.map !== scene.map.id) return;
    const C = G.GANG_WAR;
    // both sides converge on the middle of the block, so they actually run into each other
    const cx = t.x + Math.floor(t.w / 2), cy = t.y + Math.floor(t.h / 2);
    const zone = { key: 'raid:' + raid.id, x: cx - 8, y: cy - 6, w: 16, h: 12 };
    if (raid.spawnedA < C.attackers) {
      const npc = scene.spawnTransient(raid.attacker, zone);
      if (npc) { raid.spawnedA++; npc.raidSide = 'A'; }
    }
    if (raid.defender && raid.spawnedD < C.defenders) {
      const npc = scene.spawnTransient(raid.defender, zone);
      if (npc) { raid.spawnedD++; npc.raidSide = 'D'; }
    }
    if (!scene.raidNoticed) { scene.raidNoticed = raid.id; scene.toast(`Gang war! ${G.FACTIONS[raid.attacker].name} is attacking ${t.name}.`, 'bad'); G.audio.play('alarm'); }
  },

  // Territory label for the HUD.
  label(w, mapId, tx, ty) {
    const id = this.at(mapId, tx, ty);
    if (!id) return null;
    const st = w.territories[id];
    return { id, name: G.TERRITORIES[id].name, owner: st.owner, control: st.control, contested: !!(w.raid && w.raid.territory === id) };
  },
};

G.events.on('hour', () => { if (G.world) G.gangWar.hourly(G.world); });
G.CONSEQUENCES.daily.push((w) => G.gangWar.daily(w));
