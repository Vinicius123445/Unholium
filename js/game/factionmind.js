'use strict';
// What people know about the groups they belong to. Membership is one part of someone, not all of it.
//   Rank and role: the faction titles of js/game/factionranks.js, for everybody in a faction (leaders on top, a
//   stable place for the rest). Allies, enemies and rivals come from G.FACTION_RELATIONS.
//   Faction news travels through people, as memories with a tier (js/game/memory.js): those who were there know, and
//   tell others at meetings and in conversation. Nobody knows everything their faction knows.
//   Reputation stays where it was (w.addRep): remembered insults, attacks and help only feed it, a little at a time.
(() => {
const nowDay = (w) => w.day;
const F = G.fmind = {
  listed(fid) { const f = G.FACTIONS[fid]; return !!(f && fid !== 'civilians' && (f.listed || f.gang)); },
  // 0..4; -1 for people outside any group
  rankIndex(w, id) {
    const d = G.NPCS[id]; if (!d || !this.listed(d.faction)) return -1;
    if (d.rank != null) return d.rank;
    if (d.leader) return 4;
    if (/boss|captain|chief|director|lieutenant|sheriff|mayor|commissar|host/i.test(`${id} ${d.name}`)) return 3;
    return new G.RNG('rank-' + id).int(0, 2);
  },
  rankTitle(w, id) {
    const d = G.NPCS[id], list = G.factionRanks && G.factionRanks.RANKS[d && d.faction], i = this.rankIndex(w, id);
    return list && i >= 0 ? list[Math.min(i, list.length - 1)] : null;
  },
  relationsOf(fid) {
    const allies = [], enemies = [], rivals = [];
    for (const o of G.listedFactions()) {
      if (o === fid) continue;
      const v = G.factionRelation(fid, o), n = G.FACTIONS[o].name;
      if (G.FACTIONS[o].covert) continue;   // (nobody talks about those)
      if (v <= -1) enemies.push(n); else if (v < 0) rivals.push(n); else if (v >= 0.3) allies.push(n);
    }
    return { allies, enemies, rivals };
  },
  // fellow members they actually know
  knownMembers(w, id, n = 4) {
    const d = G.NPCS[id], out = [];
    for (const o in G.NPCS) if (o !== id && G.NPCS[o].faction === d.faction && w.isAlive(o) && w.npcs[o] && (G.NPCS[o].map === d.map || (d.relations || {})[o])) out.push(o);
    return out.sort((a, b) => this.rankIndex(w, b) - this.rankIndex(w, a)).slice(0, n);
  },
  // the player's affiliation, if this person could know it: their own people know, and open members of open groups show
  playerSide(w, id) {
    const d = G.NPCS[id] || {}, out = { same: null, enemy: null };
    for (const f of G.listedFactions()) {
      if (!w.isMember(f)) continue;
      if (f === d.faction) out.same = f;
      else if (!G.FACTIONS[f].covert && G.factionsAtWar(d.faction, f)) out.enemy = f;
    }
    return out;
  },
  // one paragraph for the AI: what this person knows about their group
  sheet(w, id) {
    const d = G.NPCS[id]; if (!d || !this.listed(d.faction)) return null;
    const f = G.FACTIONS[d.faction], R = this.relationsOf(d.faction), title = this.rankTitle(w, id), rep = w.getRep(d.faction);
    const mates = this.knownMembers(w, id).map((o) => `${w.npcs[o].realName}${this.rankIndex(w, o) >= 3 ? ` (${this.rankTitle(w, o)})` : ''}`);
    const P = G.social.persona(id), out = [`You belong to ${f.name}${title ? ` as ${/^[aeiou]/i.test(title) ? 'an' : 'a'} ${title}` : ''}${P.loyalty < 35 ? ', but your heart is not really in it' : P.loyalty >= 70 ? ', and you would bleed for them' : ''}.`];
    if (R.enemies.length) out.push(`Enemies: ${R.enemies.join(', ')}.`);
    if (R.rivals.length) out.push(`Rivals: ${R.rivals.join(', ')}.`);
    if (R.allies.length) out.push(`Friendly with: ${R.allies.join(', ')}.`);
    if (mates.length) out.push(`Members you know: ${mates.join(', ')}.`);
    out.push(`They think of the player as: ${G.repLabel ? G.repLabel(rep) : rep}.`);
    if (f.covert) out.push('It is a secret: you do not admit it to outsiders.');
    return out.join(' ');
  },
  // once a day per faction: a word against them, or a good turn, moves the reputation a little
  nudge(w, fid, n, key) {
    if (!this.listed(fid)) return;
    const seen = (w.fmindDay = w.fmindDay || {}), k = `${fid}|${key}`;
    if (seen[k] === nowDay(w)) return;
    seen[k] = nowDay(w);
    w.addRep(fid, n);
  },
  // the player went for one of theirs: the members who saw it remember, and it becomes faction news
  onAttacked(scene, npc, source) {
    const w = scene.world, fid = npc.def.faction;
    if (!this.listed(fid)) return;
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a === npc || a.dead || a.def.faction !== fid || !a.st) continue;
      if (a.distTo(npc) > 150 || !a.canSee(scene, source, 150)) continue;
      G.mem.add(w, a.id, { k: 'faction_attack', t: `The player attacked ${w.npcs[npc.id] ? w.npcs[npc.id].realName : 'one of ours'}, one of us`, by: 'player', ab: npc.id, s: 'saw', f: -2, i: 4, ti: 'faction', fc: fid });
    }
  },
  onHelped(scene, npc) {
    const w = scene.world, fid = npc.def.faction;
    if (!this.listed(fid)) return;
    this.nudge(w, fid, 1, 'helped');
    G.mem.add(w, npc.id, { k: 'faction_help', t: `The player helped me, one of ${G.FACTIONS[fid].name}`, by: 'player', ab: npc.id, s: 'did', f: 2, i: 3, ti: 'faction', fc: fid });
  },
};

// Meetings: people who live or work together swap news every hour, on the map and off it. A handful per hour.
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  try {
    const ids = Object.keys(w.npcs).filter((id) => G.NPCS[id] && w.npcs[id].mems && w.npcs[id].mems.length && w.isAlive(id));
    for (let i = 0; i < 6 && ids.length; i++) {
      const a = G.rng.pick(ids), d = G.NPCS[a];
      const near = Object.keys(G.NPCS).filter((o) => o !== a && w.npcs[o] && w.isAlive(o) && (G.NPCS[o].home === d.home || (d.relations || {})[o] || (F.listed(d.faction) && G.NPCS[o].faction === d.faction && G.NPCS[o].map === d.map)));
      if (near.length) G.mem.gossip(w, a, G.rng.pick(near));
    }
  } catch (e) { G.reportError && G.reportError(e); }
});
})();
