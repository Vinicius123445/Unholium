'use strict';
// Map cache: maps are generated deterministically, then the current world's modifications
// (burnt tiles, destroyed buildings, chopped trees...) are applied on top.
G.maps = {
  cache: {},
  get(id) {
    if (!this.cache[id]) {
      const gen = G.MAPGEN[id];
      if (!gen) throw new Error('Unknown map ' + id);
      const m = G.planMap ? G.planMap(gen) : gen();   // (js/game/worldscale.js)
      if (G.world && G.world.mapMods && G.world.mapMods[id]) m.applyMods(G.world.mapMods[id]);
      this.cache[id] = m;
    }
    return this.cache[id];
  },
  reset() { if (!this.keep) this.cache = {}; },   // (keep: the loading screen has just built them, js/game/loadscreen.js)
  // Drop a cached map so it is rebuilt from the generator + current mods (used for rebuilding/regrowth).
  invalidate(id) {
    delete this.cache[id];
    G.events.emit('mapInvalidated', id);
  },
};

// World: the persistent, serializable simulation state — time, reputation, bounties, NPC states,
// deaths, shops, containers, quests, wildlife populations, flags, log and rumors.
// Everything the player does that "matters" ends up here; consequence rules read and change it.

class World {
  constructor(data) {
    Object.assign(this, data);
    if (data && G.onWorldLoaded) G.onWorldLoaded(this);   // systems that add NPCs at runtime (grown-up children) re-register them
    if (data) this.migrate();
  }

  // An older save meets a newer game: people and wildlife added since then get their state.
  migrate() {
    this.npcs = this.npcs || {};
    for (const id in G.NPCS) if (!this.npcs[id] && !(this.dead && this.dead[id])) this.npcs[id] = this.freshNpcState(id, null);
    this.wildlife = this.wildlife || {};
    for (const mapId of G.NEW_WILD_MAPS || []) {   // maps added since (only those: generating every map here would be slow)
      if (!G.MAPGEN[mapId] || Object.keys(this.wildlife).some((k) => k.startsWith(mapId + ':'))) continue;
      let zones = []; try { zones = G.MAPGEN[mapId]().animalZones || []; } catch (e) { continue; }
      zones.forEach((z, i) => { this.wildlife[mapId + ':' + i] = { kind: z.kind, map: mapId, count: z.max, max: z.max, owner: z.owner || null }; });
    }
  }

  static createNew() {
    G.maps.reset();
    G.world = null;
    const w = new World({
      version: G.config.VERSION,
      day: 1,
      minutes: G.config.START_HOUR * 60,
      flags: {},
      rep: {},
      bounty: {},
      tension: {},
      lastCrimeDay: {},
      knownKiller: {},
      npcs: {},
      dead: {},
      shops: {},
      containers: {},
      quests: {},
      wildlife: {},
      timers: [],
      rooms: {},
      journal: [],
      rumors: [],
      mapMods: {},
      crimeRecord: {},
      stats: { kills: 0, murders: 0, animals: 0, crimes: 0, stolen: 0, playSeconds: 0, fires: 0, buildingsBurnt: 0 },
    });
    for (const r in G.REGIONS) { w.rep[r] = 0; w.bounty[r] = 0; w.tension[r] = 0; }
    for (const f in G.FACTIONS) w.rep[f] = G.FACTIONS[f].startRep || 0;
    const nameRng = new G.RNG(Date.now() & 0xffffffff);
    for (const id in G.NPCS) w.npcs[id] = w.freshNpcState(id, null, nameRng);
    for (const id in G.SHOPS) {
      const s = G.SHOPS[id];
      w.shops[id] = { stock: G.util.clone(s.stock), gold: s.gold, owner: s.owner };
    }
    for (const mapId in G.MAPGEN) {
      const zones = G.maps.get(mapId).animalZones;
      zones.forEach((z, i) => { w.wildlife[mapId + ':' + i] = { kind: z.kind, map: mapId, count: z.max, max: z.max, owner: z.owner || null }; });
    }
    G.gangWar.init(w);
    w.flags.player_home = 'r_home';
    w.journal.push({ day: 1, time: w.minutes, text: 'Your story begins.', type: 'info' });
    return w;
  }

  freshNpcState(id, lookSeed, rng = G.rng) {
    const def = G.NPCS[id];
    const inv = G.util.clone(def.inv || []);
    if (def.weapon) inv.push([def.weapon, 1]);
    if (def.weapon && G.ITEMS[def.weapon].gun) inv.push([G.ITEMS[def.weapon].ammo, rng.int(4, 14)]);
    if (def.armor) inv.push([def.armor, 1]);
    const gender = lookSeed ? (G.look(lookSeed).body === 'f' ? 'female' : 'male') : def.gender;
    return {
      alive: !def.inactive, name: def.name, map: def.map, x: null, y: null, hp: def.hp || 30,
      hostile: false, mood: null, moodUntil: 0, fear: 0, inv, gold: def.gold || 0,
      lookSeed: lookSeed || null, scheduleFrom: null, talked: 0,
      realName: G.randomName(rng, gender, def.streetName), introduced: false,
    };
  }

  // Name shown to the player: the real name once they introduced themselves, otherwise the role.
  displayName(id) {
    const st = this.npcs[id];
    if (!st) return 'someone';
    return st.introduced ? st.realName : st.name;
  }

  // ---------------- time ----------------
  get hour() { return Math.floor(this.minutes / 60); }
  get hourF() { return this.minutes / 60; }
  get timeString() { return G.util.formatTime(this.minutes); }
  isNight() { const h = this.hourF; return h >= 21 || h < 5.5; }

  // Real seconds -> game minutes, based on settings.dayLengthMinutes
  advance(dtReal) {
    const rate = 1440 / (G.settings.get('dayLengthMinutes') * 60);
    this.stats.playSeconds += dtReal;
    this.addMinutes(dtReal * rate);
  }

  addMinutes(min) {
    const prevHour = this.hour;
    this.minutes += min;
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day++;
      this.newDay();
    }
    if (this.hour !== prevHour) G.events.emit('hour', this.hour);
  }

  skipHours(h) {
    for (let i = 0; i < h; i++) this.addMinutes(60);
  }

  newDay() {
    G.containers.cleanup(this);
    for (const rule of G.CONSEQUENCES.daily) {
      try { rule(this); } catch (e) { G.reportError(e); }
    }
    G.events.emit('newDay', this.day);
  }

  // 0 (bright day) .. ~0.75 (night), plus a tint color for dusk/dawn
  lighting() {
    const h = this.hourF;
    let dark;
    if (h >= 7 && h < 18) dark = 0;
    else if (h >= 18 && h < 21) dark = ((h - 18) / 3) * 0.72;
    else if (h >= 21 || h < 5) dark = 0.72;
    else dark = (1 - (h - 5) / 2) * 0.72;
    let tint = null;
    if (h >= 17 && h < 20) tint = { color: '255,120,40', a: 0.12 * (1 - Math.abs(h - 18.5) / 1.5) };
    if (h >= 5 && h < 7) tint = { color: '255,170,120', a: 0.08 * (1 - Math.abs(h - 6) / 1) };
    return { dark, tint };
  }

  // ---------------- reputation / crime ----------------
  getRep(k) { return this.rep[k] || 0; }

  // Change reputation. For listed factions the change ripples to related factions
  // (helping one gang angers the other, siding with the government upsets the revolutionaries, ...).
  addRep(k, n, silent = false, ripple = true) {
    if (n > 0 && ripple && G.player) n *= 1 + G.skills.stat(G.player, 'repGain');   // Networker
    n = Math.round(n);
    if (!n) return;
    const before = this.rep[k] || 0;
    this.rep[k] = G.util.clamp(before + n, -100, 100);
    if (!silent && this.rep[k] !== before) G.events.emit('repChanged', k, this.rep[k] - before);
    const f = G.FACTIONS[k];
    if (ripple && f && f.listed) {
      for (const other of Object.keys(G.FACTIONS)) {
        if (other === k || !G.FACTIONS[other].listed) continue;
        const rel = G.factionRelation(k, other);
        const d = Math.trunc(n * rel * 0.5);
        if (d) this.addRep(other, d, silent, false);
      }
    }
  }

  isMember(faction) { return !!this.flags['member_' + faction]; }

  // ---------------- map modifications (fire, destruction, rebuilding) ----------------
  modsFor(mapId) {
    if (!this.mapMods[mapId]) this.mapMods[mapId] = { tiles: {}, removed: {}, added: {}, buildings: {} };
    return this.mapMods[mapId];
  }

  buildingState(mapId, id) {
    const m = this.mapMods[mapId];
    return m && m.buildings[id] ? m.buildings[id] : null;
  }

  isHomeLost(def) {
    if (!def || !def.home) return false;
    const s = this.buildingState(def.map, def.home);
    return !!(s && s.state === 'destroyed');
  }

  // Called by the fire system when a building collapses or is gutted.
  buildingBurnt(mapId, b, state, byPlayer, witnessed) {
    const mods = this.modsFor(mapId);
    if (mods.buildings[b.id]) return;
    mods.buildings[b.id] = { state, day: this.day, byPlayer, witnessed };
    this.stats.buildingsBurnt++;
    const region = G.maps.get(mapId).meta.region;
    this.tension[region] = Math.min(100, (this.tension[region] || 0) + 20);
    this.log(`The ${b.name} ${state === 'destroyed' ? 'burned to the ground' : 'was gutted by fire'}.`, byPlayer ? 'bad' : 'warn');
    if (byPlayer && witnessed) this.rumor(`Someone set the ${b.name} on fire! People saw who did it.`, region);
    else this.rumor(`A fire destroyed the ${b.name}. Nobody knows how it started.`, region);
    for (const id in G.NPCS) {
      const d = G.NPCS[id];
      if (d.map !== mapId || d.home !== b.id || !this.isAlive(id)) continue;
      const st = this.npcs[id];
      st.mood = 'homeless';
      st.moodUntil = this.day + 6;
      if (byPlayer && witnessed && d.combat !== 'flee' && d.combat !== 'guard') st.hostile = true;
      else if (byPlayer && witnessed) st.fear = 100;
    }
    G.events.emit('buildingBurnt', mapId, b.id, state);
  }

  // The player committed a crime. The scene determines witnesses (it knows where everyone is).
  commitCrime(type, region, witnessed, victimId = null, value = 0) {
    const c = G.CRIMES[type];
    if (!c || region === 'island') return;
    this.stats.crimes++;
    const crime = { type, region, witnessed, victim: victimId };
    if (witnessed) {
      let bounty = type === 'theft' ? Math.max(10, value * 2) : c.bounty;
      if (G.player && G.skills.has(G.player, 'ghost')) bounty = Math.round(bounty * 0.75);
      this.bounty[region] = (this.bounty[region] || 0) + bounty;
      this.addRep(region, c.rep, true);
      if (victimId && G.NPCS[victimId]) this.addRep(G.NPCS[victimId].faction, c.rep * (G.FACTIONS[G.NPCS[victimId].faction].listed ? 1.2 : 1));
      this.tension[region] = Math.min(100, (this.tension[region] || 0) + c.tension);
      this.lastCrimeDay[region] = this.day;
      if (!this.crimeRecord) this.crimeRecord = {};
      (this.crimeRecord[region] = this.crimeRecord[region] || []).push({ type, day: this.day, time: Math.floor(this.minutes), victim: victimId, bounty });
      if (type === 'murder') this.knownKiller[region] = true;
      this.log(`Someone saw that: ${c.label}.`, 'bad');   // (no bounty numbers on screen: js/game/law.js)
      const victim = victimId && this.npcs[victimId] ? this.displayName(victimId) : 'someone';
      const rumorText = {
        murder: `A stranger murdered ${victim} in broad view. Everyone is talking about it.`,
        assault: `Someone attacked ${victim} without reason.`,
        theft: 'There is a thief about. Watch your belongings.',
        livestock: 'Someone has been killing the ranch animals.',
        extortion: `A stranger has been threatening ${victim} for coin.`,
        arson: 'Someone is setting fires on purpose. Keep water close.',
        vandalism: 'Somebody has been smashing things up around here.',
        gunfire: 'Gunshots in the street again. Somebody is going to get killed.',
        drugs: 'A stranger was seen getting high in public. Disgraceful.',
        trespass: `Someone was caught creeping around ${victim}'s place, where they had no business being.`,
      }[type];
      if (rumorText) this.rumor(rumorText, region);
    }
    for (const rule of G.CONSEQUENCES.onCrime) rule(this, crime);
    G.events.emit('crime', crime);
  }

  clearBounty(region) { this.bounty[region] = 0; if (this.crimeRecord) this.crimeRecord[region] = []; }

  // What the law has on you in a region, summarized for the arrest dialogue.
  crimeSummary(region) {
    const list = (this.crimeRecord && this.crimeRecord[region]) || [];
    const byType = {};
    for (const c of list) (byType[c.type] = byType[c.type] || []).push(c);
    return Object.keys(byType).map((t) => {
      const cs = byType[t], victims = [...new Set(cs.map((c) => c.victim).filter((v) => v && this.npcs[v]).map((v) => this.displayName(v)))];
      return `${G.CRIMES[t].label}${cs.length > 1 ? ' x' + cs.length : ''}${victims.length ? ' (' + victims.slice(0, 3).join(', ') + ')' : ''}, last on day ${cs[cs.length - 1].day}`;
    });
  }

  // ---------------- NPC life & death ----------------
  isAlive(id) { return !!(this.npcs[id] && this.npcs[id].alive); }

  registerDeath(id, info) {
    const st = this.npcs[id];
    if (!st || !st.alive) return;
    st.alive = false;
    st.hostile = false;
    const region = G.maps.get(info.map).meta.region;
    info.region = region;
    this.dead[id] = { day: this.day, map: info.map, region, byPlayer: info.byPlayer, witnessed: info.witnessed, discovered: !!info.witnessed || !info.byPlayer };
    if (info.byPlayer) { this.stats.kills++; this.stats.murders++; }
    for (const rule of G.CONSEQUENCES.onDeath) {
      try { rule(this, id, info); } catch (e) { G.reportError(e); }
    }
    // quests that depended on this npc
    for (const qid in this.quests) {
      const q = G.questDef(this, qid);
      if (this.quests[qid].state === 'active' && q.failIfDead && q.failIfDead.includes(id)) this.failQuest(qid, `${st.name} is dead.`);
    }
    G.events.emit('npcDied', id, info);
  }

  reviveAsReplacement(id, name) {
    const st = this.freshNpcState(id, String(Math.floor(Math.random() * 1e9)));
    st.name = name;
    this.npcs[id] = st;
    delete this.dead[id];
  }

  deadInRegion(region) { return Object.keys(this.dead).filter((id) => this.dead[id].region === region); }

  // ---------------- shops ----------------
  shopOwner(id) { return this.shops[id] ? this.shops[id].owner : null; }

  restockShop(id) {
    const base = G.SHOPS[id];
    const s = this.shops[id];
    for (const [item, qty] of base.stock) {
      const e = s.stock.find((x) => x[0] === item);
      if (e) e[1] = Math.max(e[1], qty);
      else s.stock.push([item, qty]);
    }
    s.gold = Math.max(s.gold, base.gold);
  }

  // ---------------- quests ----------------
  quest(id) { return this.quests[id] ? this.quests[id].state : null; }

  startQuest(id) {
    if (this.quests[id]) return;
    this.quests[id] = { state: 'active', day: this.day, progress: {} };
    this.log(`New quest: ${G.questDef(this, id).title}`, 'quest');
    G.events.emit('quest', id, 'started');
  }

  questDone(id) {
    const q = G.questDef(this, id), st = this.quests[id];
    if (!st || st.state !== 'active') return false;
    return q.objectives.every((o, i) => o.type === 'kill' ? (st.progress[i] || 0) >= o.count : o.type === 'have' ? !!(G.player && G.player.inventory.has(o.item, o.count)) : !!this.flags[o.flag]);
  }

  completeQuest(id) {
    const q = G.questDef(this, id), st = this.quests[id];
    if (!st || st.state !== 'active') return false;
    st.state = 'done';
    const r = q.reward || {};
    const gold = (q.rewardGoldFlag && this.flags[q.rewardGoldFlag]) || r.gold || 0;
    if (gold) G.events.emit('giveGold', gold);
    if (r.rep) for (const k in r.rep) this.addRep(k, r.rep[k], true);
    if (r.items) for (const [it, n] of r.items) G.events.emit('giveItem', it, n);
    this.log(`Quest complete: ${q.title}`, 'quest');
    G.events.emit('quest', id, 'done');
    G.events.emit('xp', G.XP.questDone + (q.xp || 0), 'Quest');
    return true;
  }

  failQuest(id, reason) {
    const st = this.quests[id];
    if (!st || st.state !== 'active') return;
    st.state = 'failed';
    this.log(`Quest failed: ${G.questDef(this, id).title}${reason ? ' — ' + reason : ''}`, 'bad');
    G.events.emit('quest', id, 'failed');
  }

  onKill(target) {
    for (const qid in this.quests) {
      const st = this.quests[qid];
      if (st.state !== 'active') continue;
      G.questDef(this, qid).objectives.forEach((o, i) => {
        if (o.type === 'kill' && o.target === target) {
          st.progress[i] = (st.progress[i] || 0) + 1;
          if (st.progress[i] <= o.count) G.events.emit('toast', `${o.text}: ${Math.min(st.progress[i], o.count)}/${o.count}`);
        }
      });
    }
  }

  // ---------------- wildlife ----------------
  wildlifeReport(mapId) {
    const out = {};
    for (const k in this.wildlife) {
      const z = this.wildlife[k];
      if (z.map !== mapId) continue;
      out[z.kind] = (out[z.kind] || 0) + z.count;
    }
    for (const k in G.ANIMALS) if (out[k] == null) out[k] = 0;
    return out;
  }

  // ---------------- log, rumors, timers ----------------
  log(text, type = 'info') {
    this.journal.push({ day: this.day, time: this.minutes, text, type });
    if (this.journal.length > 300) this.journal.shift();
    G.events.emit('log', text, type);
  }

  rumor(text, region) {
    this.rumors.push({ text, region, day: this.day });
    if (this.rumors.length > 40) this.rumors.shift();
  }

  schedule(days, event, data = null) {
    this.timers.push({ day: this.day + days, event, data });
  }

  runTimers() {
    const due = this.timers.filter((t) => t.day <= this.day);
    this.timers = this.timers.filter((t) => t.day > this.day);
    for (const t of due) {
      const fn = G.CONSEQUENCES.events[t.event];
      if (fn) fn(this, t.data);
    }
  }

  toJSON() {
    const o = {};
    for (const k of Object.keys(this)) o[k] = this[k];
    return o;
  }
}

G.World = World;
