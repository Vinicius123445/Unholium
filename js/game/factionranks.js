'use strict';
// Life inside a faction, once you are in (js/game/initiation.js): faction work and ranks.
//
// Work: ask any member "Got anything for us?" and they hand you a job that fits the faction (gangs want
// rivals hit, drugs moved and protection collected; the Government wants criminals taken down; the CIA
// wants names and quiet deaths; the Revolutionaries want fires; the Elite want favors). One faction job at
// a time per faction. A street-level member without the authority sends you to someone who has it (the
// job is reported back to a named member, so it can be finished).
//
// Ranks: every faction job done earns standing (bigger jobs earn more). Enough standing and you move up a
// rank: a title of your own, a gift, a weekly cut that grows with rank, a small edge that fits the faction,
// and at the higher ranks a privilege (backup from your gang in a fight, a bounty that goes away...).
//   w.franks[fid] = { standing, rank, cutDay, wipeDay }
(() => {
const pick = (a) => G.rng.pick(a);
const RANKS = {
  gang_blue: ['Prospect', 'Runner', 'Soldier', 'Enforcer', 'Captain'],
  gang_red: ['Youngin', 'Soldier', 'Rider', 'OG', 'Shot Caller'],
  punks: ['Poser', 'Punk', 'Crust', 'Ringleader', 'Legend'],
  government: ['Intern', 'Clerk', 'Officer', 'Director', 'Deputy Mayor'],
  cia: ['Asset', 'Field Agent', 'Case Officer', 'Station Chief', 'Deputy Director'],
  revolutionaries: ['Sympathizer', 'Comrade', 'Cell Leader', 'Commissar', 'Vanguard'],
  elite: ['Guest', 'Member', 'Patron', 'Inner Circle', 'Grand Patron'],
};
const NEED = [0, 3, 7, 12, 18];   // standing for each rank
const CUT = { gang_blue: 60, gang_red: 60, punks: 30, government: 90, cia: 110, revolutionaries: 40, elite: 200 };   // weekly, per rank
// gifts on reaching a rank (index = rank)
const GIFTS = {
  gang_blue: [null, [['pistol', 1], ['ammo_9mm', 24]], [['kevlar_vest', 1]], [['smg', 1]], [['gold_chain', 1]]],
  gang_red: [null, [['revolver', 1]], [['kevlar_vest', 1]], [['shotgun', 1]], [['gold_chain', 1]]],
  punks: [null, [['brass_knuckles', 1]], [['fire_bomb', 3]], [['machete', 1]], [['lockpick', 6]]],
  government: [null, [['pistol', 1]], [['kevlar_vest', 1]], [['shotgun', 1]], [['designer_watch', 1]]],
  cia: [null, [['lockpick', 5]], [['pistol', 1]], [['kevlar_vest', 1]], [['assault_rifle', 1]]],
  revolutionaries: [null, [['fire_bomb', 3]], [['pistol', 1]], [['fire_bomb', 5]], [['assault_rifle', 1]]],
  elite: [null, [['designer_watch', 1]], [['gold_chain', 1]], [['revolver', 1]], [['designer_watch', 1]]],
};
// a small edge per rank (read through G.skills.stat)
const EDGE = {
  gang_blue: { intimidate: 1 }, gang_red: { intimidate: 1 }, punks: { meleeDmg: 0.03 }, government: { charisma: 0.5 },
  cia: { stealth: 0.04 }, revolutionaries: { charisma: 0.5 }, elite: { barter: 0.04, charisma: 0.5 },
};
const PERKS = {
  gang_blue: { 2: 'Your crew jumps in when someone attacks you on the street.', 4: 'Double weekly cut from the turf.' },
  gang_red: { 2: 'Your crew jumps in when someone attacks you on the street.', 4: 'Double weekly cut from the turf.' },
  punks: { 2: 'Punks have your back in a fight.', 4: 'Vandalism stops costing you reputation with the Punks\' friends.' },
  government: { 2: 'New bounties against you are halved.', 3: 'Once a week, a word from a colleague makes a bounty go away.' },
  cia: { 2: 'Witnesses take longer to call anything in.', 3: 'Once a week, your record can be quietly erased.' },
  revolutionaries: { 2: 'Comrades join your fights.', 3: 'Safehouse: any comrade will patch you up.' },
  elite: { 2: 'Shops treat you like money. (Discounts grow with rank.)', 3: 'Once a week, the right phone call makes a bounty go away.' },
};

// a Legend among the Punks: vandalism costs you no standing with the people around it
{ const WP = G.World.prototype, _cc = WP.commitCrime; WP.commitCrime = function (type, region, witnessed) { const before = witnessed && type === 'vandalism' && G.factionRanks.rank(this, 'punks') >= 4 ? this.getRep(region) : null; const r = _cc.apply(this, arguments); if (before != null) this.addRep(region, before - this.getRep(region), true); return r; }; }
G.factionRanks = {
  RANKS, NEED, PERKS,
  rec(w, fid) { const all = (w.franks = w.franks || {}); return (all[fid] = all[fid] || { standing: 0, rank: 0 }); },
  rank(w, fid) { return w.isMember(fid) ? this.rec(w, fid).rank : -1; },
  title(w, fid) { const r = this.rank(w, fid); return r < 0 ? '' : (RANKS[fid] || ['Member'])[Math.min(r, (RANKS[fid] || ['Member']).length - 1)]; },
  has(w, fid, n) { return this.rank(w, fid) >= n; },
  gain(scene, fid, pts) {
    const w = scene.world, r = this.rec(w, fid);
    r.standing += pts;
    while (r.rank < NEED.length - 1 && r.standing >= NEED[r.rank + 1]) this.promote(scene, fid);
  },
  promote(scene, fid) {
    const w = scene.world, r = this.rec(w, fid), p = scene.player;
    r.rank++;
    const t = this.title(w, fid), gift = (GIFTS[fid] || [])[r.rank];
    for (const [id, n] of gift || []) if (G.ITEMS[id] || G.item(id)) p.inventory.add(id, n);
    const bonus = CUT[fid] * r.rank;
    p.gold += bonus;
    w.addRep(fid, 5);
    const perk = (PERKS[fid] || {})[r.rank];
    w.log(`Promoted in ${G.FACTIONS[fid].name}: you are now ${t}. +$${bonus}${gift ? ', and a gift' : ''}.${perk ? ' ' + perk : ''}`, 'quest');
    scene.toast(`${G.FACTIONS[fid].name}: promoted to ${t}!`, 'quest');
    G.audio.play('quest');
    G.events.emit('xp', 40 + r.rank * 20, 'Promotion');
    w.rumor(`Word is the newcomer has moved up in the ${G.FACTIONS[fid].name}.`, null);
  },
  // the next step, for the journal
  progress(w, fid) {
    const r = this.rec(w, fid);
    return r.rank >= NEED.length - 1 ? 'top rank' : `${r.standing}/${NEED[r.rank + 1]} to ${RANKS[fid][r.rank + 1]}`;
  },
  greet(w, fid) {
    const t = this.title(w, fid), r = this.rank(w, fid);
    return r >= 3 ? pick([`${t}. What do you need?`, `Anything you need, ${t.toLowerCase()}.`]) : pick([`Hey, ${t.toLowerCase()}.`, `Good to see you, ${t.toLowerCase()}.`, 'One of us. What do you need?']);
  },
};

// ---------------------------------------------------------------- the edge (stats per rank)
const _stat = G.skills.stat;
G.skills.stat = function (p, name) {
  let v = _stat.call(this, p, name);
  const w = G.world;
  if (w && p && p.kind === 'player' && w.franks) for (const fid in EDGE) if (EDGE[fid][name] && w.isMember(fid)) v += EDGE[fid][name] * G.factionRanks.rec(w, fid).rank;
  return v;
};

// ---------------------------------------------------------------- the work
const alive = (w, f) => Object.keys(G.NPCS).filter((id) => w.isAlive(id) && !G.NPCS[id].inactive && !G.NPCS[id].kid && f(G.NPCS[id], id));
const named = (w, fid, prefer) => {
  if (prefer && !prefer.transient && w.isAlive(prefer.id)) return prefer.id;
  const list = alive(w, (d) => d.faction === fid);
  return list.find((id) => G.NPCS[id].leader) || list[0] || null;
};
const kill = (w, giver, fid, filter, title, pitch, pay) => {
  const t = alive(w, (d, id) => id !== giver && filter(d, id) && !w.isMember(d.faction));
  if (!t.length) return null;
  const target = pick(t), nm = w.displayName(target), m = G.maps.get(w.npcs[target].map || G.NPCS[target].map);
  return { type: 'hit', title: title(nm), target, pitch: pitch(nm, pay), desc: `Kill ${nm} (${G.NPCS[target].name}). Usually around ${m.meta.name}.`,
    objectives: [{ type: 'kill', target, count: 1, text: `Kill ${nm}` }], reward: { gold: pay, xp: 60, disp: 10 }, days: 4, standing: 3 };
};
const beat = (w, giver, filter, title, pitch, pay) => {
  const t = alive(w, (d, id) => id !== giver && filter(d, id));
  if (!t.length) return null;
  const target = pick(t), nm = w.displayName(target);
  return { type: 'beat', title: title(nm), target, pitch: pitch(nm, pay), desc: `Beat ${nm} badly, but leave them alive.`,
    objectives: [{ type: 'flag', flag: '%_beaten', text: `Beat up ${nm} (do not kill)` }], reward: { gold: pay, xp: 35, disp: 8 }, days: 3, failIfDead: [target], standing: 2 };
};
const crimes = (crime, n, title, pitch, desc, pay) => ({ type: 'crime_count', crime, n, title, pitch, desc,
  objectives: [{ type: 'flag', flag: '%_done', text: `${desc} (${n})` }], reward: { gold: pay, xp: 30 + n * 5, disp: 6 }, days: 3, standing: 1 + (n > 2 ? 1 : 0) });
const reuse = (type, w, giver, standing = 1) => { const d = G.JOB_TYPES[type] && G.JOB_TYPES[type].make(w, giver); if (d) d.standing = standing; return d; };
const GOV_GUARD = (d) => d.faction === 'government' && d.combat === 'guard';
const WORK = {
  gang_blue: (w, g) => pick([
    () => reuse('faction_hit', w, g, 3), () => reuse('drug_run', w, g, 2), () => reuse('collect', w, g, 1),
    () => kill(w, g, 'gang_blue', (d) => d.faction === 'gang_red', (n) => `Red Problem: ${n}`, (n, p) => `${n} runs with Red and talks too much. Shut them up for good. $${p}.`, 220),
    () => crimes('vandalism', 2, 'Mark the Turf', 'Go hit Red turf. Smash some of their stuff. Twice. Let them know who was there.', 'Vandalize', 90),
  ])(),
  gang_red: (w, g) => pick([
    () => reuse('faction_hit', w, g, 3), () => reuse('drug_run', w, g, 2), () => reuse('collect', w, g, 1),
    () => kill(w, g, 'gang_red', (d) => d.faction === 'gang_blue', (n) => `Blue Problem: ${n}`, (n, p) => `${n}. Blue. Out in the open, so they all see. $${p}.`, 220),
    () => beat(w, g, (d) => d.faction === 'civilians' && d.shop, (n) => `Protection: ${n}`, (n, p) => `${n} forgot to pay us this month. Remind them. Do not kill them, they still owe. $${p}.`, 90),
  ])(),
  punks: (w, g) => pick([
    () => crimes('vandalism', 3, 'Make Some Noise', 'This town is too quiet. Wreck three things. Anything. Go.', 'Vandalize', 80),
    () => beat(w, g, GOV_GUARD, (n) => `Pig Roast: ${n}`, (n, p) => `${n} hassled one of ours. Put them on the ground. Do not kill them, we are not idiots. $${p}.`, 120),
    () => reuse('steal', w, g, 2), () => crimes('theft', 2, 'Five Finger Discount', 'Steal something. Twice. From anyone. Bring nothing back, just do it.', 'Steal', 70),
  ])(),
  government: (w, g) => pick([
    () => kill(w, g, 'government', (d) => G.GANGS.includes(d.faction) && !d.leader, (n) => `Warrant: ${n}`, (n, p) => `There is a warrant for ${n}. They will not come quietly. Neither should you. $${p}.`, 200),
    () => beat(w, g, (d, id) => G.NPCS[id].dealer || d.faction === 'punks', (n) => `Lean On ${n}`, (n, p) => `${n} needs to understand the law is watching. Hard enough that they remember it. $${p}.`, 110),
    () => reuse('scout', w, g, 1), () => reuse('deliver', w, g, 1),
  ])(),
  cia: (w, g) => pick([
    () => reuse('scout', w, g, 2),
    () => kill(w, g, 'cia', (d) => d.faction === 'revolutionaries', (n) => `Sanction: ${n}`, (n, p) => `${n} is a problem for national security. Make it look like an accident, or do not. $${p}.`, 300),
    () => reuse('steal', w, g, 2), () => reuse('deliver', w, g, 1),
  ])(),
  revolutionaries: (w, g) => pick([
    () => crimes('arson', 1, 'Direct Action', 'Words are violence, so we are told. Fire is louder. Burn something that matters and post nothing about it. Seriously, nothing.', 'Commit arson', 140),
    () => beat(w, g, GOV_GUARD, (n) => `Defund ${n}`, (n, p) => `${n} is a cop. That is the whole explanation. Put them on the ground, but alive: martyrs are bad optics. $${p}.`, 120),
    () => kill(w, g, 'revolutionaries', (d) => d.faction === 'elite' || d.faction === 'cia', (n) => `Eat the Rich: ${n}`, (n, p) => `The collective voted. ${n} is part of the problem. Consensus was unanimous, after we asked the others to leave. $${p}.`, 260),
    () => kill(w, g, 'revolutionaries', (d) => d.faction === 'government' && !d.leader, (n) => `Abolish ${n}`, (n, p) => `${n} props up the regime. Remove them. We will put out a statement about it. $${p}.`, 220),
    () => crimes('vandalism', 3, 'Redecorate', 'Three acts of vandalism against the system. A window, a sign, a statue of some dead guy. Your call.', 'Vandalize', 90),
  ])(),
  elite: (w, g) => pick([
    () => reuse('steal', w, g, 2), () => reuse('deliver', w, g, 1), () => reuse('collect', w, g, 1),
    () => kill(w, g, 'elite', (d) => d.faction === 'revolutionaries' || d.leader, (n) => `A Discreet Matter: ${n}`, (n, p) => `${n} has become... inconvenient. We would be grateful. Very grateful. $${p}.`, 500),
  ])(),
};
G.factionRanks.makeJob = function (w, fid, speaker) {
  const giver = named(w, fid, speaker);
  if (!giver) return null;
  for (let k = 0; k < 6; k++) {
    const d = WORK[fid] && WORK[fid](w, giver);
    if (d) { d.giver = giver; d.factionJob = fid; d.reward = Object.assign({}, d.reward, { rep: fid }); return d; }
  }
  return null;
};
const activeFor = (w, fid) => G.jobs.active(w).find((id) => G.jobs.def(w, id).factionJob === fid);

// crimes as work: count them while the job is on
const W = G.World.prototype, _crime = W.commitCrime;
W.commitCrime = function (type, region) {
  const r = _crime.apply(this, arguments);
  for (const id of G.jobs.active(this)) {
    const d = G.jobs.def(this, id);
    if (d.type !== 'crime_count' || d.crime !== type) continue;
    const q = this.quests[id]; q.progress.n = (q.progress.n || 0) + 1;
    if (q.progress.n >= d.n) this.flags[d.objectives[0].flag] = true;
  }
  // Government Officer and up: new bounties against you are halved
  if (G.factionRanks.has(this, 'government', 2) && this.bounty[region] && G.CRIMES[type]) {
    const c = G.CRIMES[type], added = type === 'theft' ? 0 : Math.round((c.bounty || 0) / 2);
    this.bounty[region] = Math.max(0, this.bounty[region] - added);
  }
  return r;
};
// a faction job done: standing (and maybe a promotion)
const _complete = G.jobs.complete;
G.jobs.complete = function (runner, id) {
  const d = this.def(runner.scene.world, id), was = runner.scene.world.quests[id].state;
  const msg = _complete.call(this, runner, id);
  if (d && d.factionJob && was === 'active' && runner.scene.world.quests[id].state === 'done') G.factionRanks.gain(runner.scene, d.factionJob, d.standing || 1);
  return msg;
};

// ---------------------------------------------------------------- privileges
// backup: members of your faction nearby take on whoever attacks you (gangs and Punks rank 2, Revolutionaries rank 2)
const BACKUP = ['gang_blue', 'gang_red', 'punks', 'revolutionaries'];
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  const r = _dmg.apply(this, arguments);
  if (scene && target && target.kind === 'player' && source && source.kind === 'npc' && !source.dead && !scene.jumpIn) {
    const w = scene.world;
    for (const fid of BACKUP) {
      if (!G.factionRanks.has(w, fid, 2) || source.def.faction === fid) continue;
      for (const a of scene.actors) {
        if (a.kind !== 'npc' || a.dead || a.def.faction !== fid || a.def.combat !== 'fight' || a.state === 'fight' || a.distTo(target) > 160) continue;
        a.say(pick(['Hey! Back off them!', 'You touch one of us, you touch all of us.', 'We got you!']), 2.5);
        a.startFight(source, scene);
      }
    }
  }
  return r;
};
// CIA Field Agent and up: witnesses take longer to call it in
const GS = G.GameScene.prototype, _rep = GS.reportCrime;
GS.reportCrime = function () {
  const n0 = (this.pendingReports || []).length, r = _rep.apply(this, arguments);
  if (G.factionRanks.has(this.world, 'cia', 2)) for (const rep of (this.pendingReports || []).slice(n0)) rep.t *= 2;
  return r;
};

// ---------------------------------------------------------------- the weekly cut
G.events.on('newDay', () => {
  const w = G.world; if (!w || !w.franks || !G.player) return;
  for (const fid in w.franks) {
    const r = w.franks[fid];
    if (!w.isMember(fid) || !r.rank) continue;
    if (w.day - (r.cutDay || 0) < 7) continue;
    r.cutDay = w.day;
    const turf = (fid === 'gang_blue' || fid === 'gang_red') && r.rank >= 4 ? 2 : 1;
    const cut = CUT[fid] * r.rank * turf;
    G.player.gold += cut;
    w.log(`Your weekly cut from the ${G.FACTIONS[fid].name}: $${cut}.`, 'good');
  }
});

// ---------------------------------------------------------------- the conversation
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world, fid = npc.def.faction;
  if (npc.def.kid || !G.FACTIONS[fid] || !RANKS[fid] || !w.isMember(fid) || npc.st.companion) return [];
  const out = [];
  if (!activeFor(w, fid)) out.push({ text: `Got anything for the ${G.FACTIONS[fid].name.replace(/^The /, '')}?`, next: '_fr_work' });
  const r = G.factionRanks.rank(w, fid), rec = G.factionRanks.rec(w, fid);
  const wipe = (fid === 'government' || fid === 'cia' || fid === 'elite') && r >= 3 && Object.values(w.bounty || {}).some((b) => b > 0) && w.day - (rec.wipeDay || -99) >= 7;
  if (wipe) out.push({ text: 'I need my record to... go away.', next: '_fr_wipe' });
  if (fid === 'revolutionaries' && r >= 3 && scene.player.hp < scene.player.maxHp) out.push({ text: 'I am hurt. Can you patch me up?', next: '_fr_heal' });
  out.push({ text: 'Where do I stand with you?', next: '_fr_rank' });
  return out;
});
G.DIALOGUE_NODES._fr_work = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction;
  const def = G.factionRanks.makeJob(w, fid, npc);
  if (!def) return { text: 'Nothing right now. Check back later.', choices: BACK };
  const via = def.giver !== npc.id ? ` Report to ${w.displayName(def.giver)} when it is done.` : '';
  return {
    text: `${def.pitch}${via}`,
    choices: [
      { text: 'Consider it done.', do: () => { const save = r.npc; const giverActor = scene.actors.find((a) => a.id === def.giver); r.npc = giverActor || { id: def.giver, st: w.npcs[def.giver] || {} }; G.jobs.accept(r, def); r.npc = save; }, next: null },
      { text: 'Not this one.', next: 'start' },
    ],
  };
};
G.DIALOGUE_NODES._fr_rank = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction, t = G.factionRanks.title(w, fid), k = G.factionRanks.rank(w, fid);
  const perks = Object.keys(PERKS[fid] || {}).filter((n) => k >= +n).map((n) => PERKS[fid][n]);
  return { text: `You are ${/^[AEIOU]/.test(t) ? 'an' : 'a'} ${t}. ${k >= NEED.length - 1 ? 'Nobody is above you but the top.' : `Keep working: ${G.factionRanks.progress(w, fid)}.`}${perks.length ? ' ' + perks.join(' ') : ''}`, choices: BACK };
};
G.DIALOGUE_NODES._fr_wipe = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction;
  G.factionRanks.rec(w, fid).wipeDay = w.day;
  for (const k in w.bounty) w.bounty[k] = 0;
  scene.pendingReports = [];
  w.log(`The ${G.FACTIONS[fid].name} made your bounty disappear.`, 'good');
  return { text: { government: 'Paperwork gets lost all the time. Yours just did.', cia: 'Done. You were never there. Neither was I.', elite: 'One call. That is all it ever takes. Your slate is clean.' }[fid], choices: BACK };
};
G.DIALOGUE_NODES._fr_heal = (r) => {
  const p = r.scene.player; p.hp = p.maxHp;
  return { text: 'Sit. Hold still. ...There. The revolution needs you in one piece.', choices: BACK };
};

// members are greeted by rank
const DR = G.DialogueRunner.prototype, _greet = DR.greeting;
DR.greeting = function () {
  const w = this.scene.world, fid = this.npc.def.faction;
  if (RANKS[fid] && w.isMember(fid) && !this.npc.def.kid && this.revealsFaction() && Math.random() < 0.7) return G.factionRanks.greet(w, fid);
  return _greet.call(this);
};
})();
