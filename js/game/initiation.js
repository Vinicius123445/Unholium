'use strict';
// Asking to join. Any member of a gang or faction can be asked ("I want in."), not only the boss. Whether
// they will even consider you comes down to your charisma, your luck, what the faction thinks of you and
// what this person thinks of you; one try per faction per day. If they say yes, you get an initiation, and
// every faction has its own. Done, you tell any member, and you are in.
//
//   Blue Gang       Jumped in: three of them beat you for eight seconds and you do not fight back. You
//                   always survive it (how much of you is left depends on the Strength and Resistance trees).
//   Red Gang        Blood in: kill a Blue Gang member in public (outdoors, somebody watching), then cut up
//                   the body.
//   Punks           Wreck the place: three acts of vandalism.
//   Government      A clean record: no bounty anywhere, no witnessed crime for three days, and the $150 fee.
//   CIA             A dead drop: fetch a sealed package from a dumpster in another district and hand it
//                   over unopened. Opening it is the test, and you fail it.
//   Revolutionaries Light it up: commit an arson.
//   Elite           The tithe: $2000 and two pieces of jewelry, handed over in person.
//
// Each initiation is a mission (journal, chatBCT): w.quests['init_<faction>'] with a def of its own.
(() => {
const pick = (a) => G.rng.pick(a);
const QID = (fid) => 'init_' + fid;
const fname = (fid) => { const n = G.FACTIONS[fid].name; return /^the /i.test(n) ? n : 'the ' + n; };

const INITS = {
  gang_blue: {
    title: 'Jumped In', pitch: 'You want blue? You get jumped in. Eight seconds. You take it, you do not swing back, you get up after. That is it.',
    desc: 'Get jumped in by the Blue Gang: take an eight-second beating without fighting back.',
    objectives: [{ type: 'flag', flag: 'init_gang_blue_done', text: 'Take the beating (eight seconds, do not fight back)' }],
    now: true,   // happens right there
  },
  gang_red: {
    title: 'Blood In', pitch: 'Red is earned in blood. Blue blood. Kill one of them out in the open where people can see, then cut the body up. Then come find us.',
    desc: 'Kill a Blue Gang member in public (outdoors, with someone watching) and cut up the body. Then talk to any Red Gang member.',
    objectives: [
      { type: 'flag', flag: 'init_gang_red_kill', text: 'Kill a Blue Gang member in public' },
      { type: 'flag', flag: 'init_gang_red_cut', text: 'Cut up that body' },
    ],
  },
  punks: {
    title: 'Wreck the Place', pitch: 'Punks do not do paperwork. Go smash some stuff. Three times. Make it count.',
    desc: 'Commit three acts of vandalism. Then talk to any Punk.',
    objectives: [{ type: 'flag', flag: 'init_punks_done', text: 'Vandalize three times' }],
  },
  government: {
    title: 'Background Check', pitch: 'There is a process. No bounty anywhere, nothing on your record for three days, and a $150 application fee. Then we talk.',
    desc: 'Have no bounty anywhere and no witnessed crime for three days. Then bring the $150 fee to anyone in the Government.',
    objectives: [{ type: 'flag', flag: 'init_government_clean', text: 'A clean record: no bounty, no crime for three days' }],
    fee: 150,
  },
  cia: {
    title: 'Dead Drop', pitch: 'There is a package waiting in a dumpster. I will put it on your phone. Bring it to any of us. Do not open it.',
    desc: 'Fetch the sealed package from the dead drop and hand it to any CIA contact. Do not open it.',
    objectives: [{ type: 'have', item: 'cia_package', count: 1, text: 'Bring back the sealed package (unopened)' }],
  },
  revolutionaries: {
    title: 'Light It Up', pitch: 'Okay, "ally". Prove it. Set something on fire, something that matters. Do not livestream it. We will know.',
    desc: 'Commit an arson. Then talk to any Revolutionary.',
    objectives: [{ type: 'flag', flag: 'init_revolutionaries_done', text: 'Set a fire on purpose' }],
  },
  elite: {
    title: 'The Tithe', pitch: 'Membership has its dues. Two thousand dollars and two pieces of good jewelry. In person, of course.',
    desc: 'Bring $2000 and two pieces of jewelry to any member of the Elite.',
    objectives: [{ type: 'have', item: 'jewelry', count: 2, text: 'Two pieces of jewelry' }],
    fee: 2000,
  },
};

G.ITEMS.cia_package = { id: 'cia_package', name: 'Sealed Package', type: 'quest', icon: 'package', value: 0, stack: 1, desc: 'Taped up tight. Do not open it. (Use it to open it.)' };
G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.cia_package = (scene) => {
  const p = scene.player;
  scene.confirm('Open the package? (You were told not to.)', () => {
    p.inventory.remove('cia_package', 1); p.inventory.add('newspaper', 1);
    const w = scene.world, q = w.quests[QID('cia')];
    if (q && q.state === 'active') G.initiation.fail(scene, 'cia', 'Inside: a newspaper, and a note. "You opened it." The CIA will not be calling.', 30);
    else scene.toast('Old newspaper. That is all.');
  });
  return true;
};
if (!G.ITEMS.newspaper) G.ITEMS.newspaper = { id: 'newspaper', name: 'Old Newspaper', type: 'misc', icon: 'letter', value: 0, stack: 5, desc: 'Yesterday\'s news.' };

G.initiation = {
  INITS,
  active(w, fid) { const q = w.quests[QID(fid)]; return !!(q && q.state === 'active'); },
  // will they even consider you? 0..1
  odds(scene, npc) {
    const w = scene.world, p = scene.player, fid = npc.def.faction;
    const rep = w.getRep(fid), disp = npc.st.disp || 0, cha = G.skills.charisma(p), luck = G.skills.stat(p, 'luck') || 0;
    if (rep <= -20 || disp <= -30) return 0;
    return G.util.clamp(0.12 + rep * 0.009 + disp * 0.004 + (cha - 5) * 0.05 + luck * 0.06 + (npc.def.leader ? 0.05 : 0), 0.03, 0.95);
  },
  start(scene, npc) {
    const w = scene.world, fid = npc.def.faction, I = INITS[fid];
    w.quests[QID(fid)] = { state: 'active', day: w.day, progress: {}, def: {
      title: `Initiation (${G.FACTIONS[fid].name}): ${I.title}`, desc: I.desc, type: 'initiation', faction: fid, giver: null,
      objectives: I.objectives.map((o) => Object.assign({}, o)), reward: {}, deadline: 1e9, failIfDead: [],
    } };
    w.log(`Initiation: ${I.title} (${G.FACTIONS[fid].name}).`, 'quest');
    G.audio.play('quest');
    if (fid === 'cia') this.plantDrop(scene);
    if (I.now) this.jumpIn(scene, npc);
  },
  fail(scene, fid, msg, days = 1) {
    const w = scene.world, q = w.quests[QID(fid)];
    if (q) q.state = 'failed';
    (w.initCooldown = w.initCooldown || {})[fid] = w.day + days;
    for (const o of INITS[fid].objectives) if (o.flag) delete w.flags[o.flag];
    scene.toast(msg, 'bad'); w.log(`Initiation failed (${G.FACTIONS[fid].name}).`, 'bad');
  },
  // in: the same as the old way in through the boss, plus a welcome
  join(scene, fid, npc) {
    const w = scene.world, f = G.FACTIONS[fid];
    const q = w.quests[QID(fid)]; if (q) q.state = 'done';
    w.flags['member_' + fid] = true;
    w.addRep(fid, Math.max(10, 50 - w.getRep(fid)));
    for (const other of G.listedFactions()) if (G.factionsAtWar(fid, other)) w.addRep(other, -20, false, false);
    w.log(`You joined ${fname(fid)}.`, 'quest');
    w.rumor(`Word is a newcomer has joined ${fname(fid)}.`, null);
    G.audio.play('quest');
    G.events.emit('xp', G.XP.joinFaction, 'Joined');
    if (npc) npc.say(pick(['Welcome to the family.', 'You are one of us now.', 'Welcome in.']), 3);
  },
  // is every objective met (plus the fee in hand)?
  ready(scene, fid) {
    const w = scene.world, q = w.quests[QID(fid)];
    if (!q || q.state !== 'active') return false;
    return G.jobs.done(w, QID(fid));
  },

  // ---------------------------------------------------------------- Blue: jumped in
  jumpIn(scene, npc) {
    const p = scene.player, w = scene.world;
    const crew = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.faction === 'gang_blue' && a.distTo(p) < 220 && !a.st.companion).slice(0, 3);
    if (!crew.includes(npc)) crew.unshift(npc);
    while (crew.length < 3) {   // the boys come over
      const n = G.happenings.spawn(scene, { id: 'jumpin' }, { name: 'Blue Gang Member', faction: 'gang_blue', combat: 'fight', hp: 45, lookO: { top: 'hoodie', shirt: '#4070d8' } }, Math.floor(p.x / 16) + (crew.length % 2 ? 3 : -3), Math.floor(p.y / 16) + 2);
      n.evSpawn = null; crew.push(n);
    }
    crew.forEach((a, i) => { const ang = (i / crew.length) * Math.PI * 2; a.jump = { ox: Math.cos(ang) * 10, oy: Math.sin(ang) * 6 }; a.aggressor = false; a.say(i ? pick(['Let\'s go!', 'Get them!', 'Eight seconds!']) : 'Clock starts NOW.', 2); });
    scene.jumpIn = { t: 8, crew, npc, hp0: p.hp };
    p.nonLethal = true;
    scene.toast('Do not fight back. Survive eight seconds.', 'warn');
    void w;
  },
  endJump(scene, ok) {
    const j = scene.jumpIn; if (!j) return;
    scene.jumpIn = null;
    const p = scene.player;
    p.nonLethal = false;
    for (const a of j.crew) { a.jump = null; a.target = null; a.moving = false; a.swing = null; a.state = 'schedule'; a.aggressor = false; a.st.hostile = false; }
    if (ok) {
      scene.world.flags.init_gang_blue_done = true;
      const left = Math.round(p.hp / p.maxHp * 100);
      j.npc.say(left < 10 ? 'Get up. ...Get UP. There you go. You are blue now.' : left < 40 ? 'You took it. Welcome to blue.' : 'Damn. You barely felt that. Welcome to blue.', 4);
      scene.toast(left < 10 ? 'You can barely stand. But you are in.' : 'You took it. You are in.', 'good');
      this.join(scene, 'gang_blue', null);
    }
  },
};

// the beating itself: they close in and swing (fists only), nobody else gets hurt
const NP = G.NPC.prototype, _nu = NP.update, _canHit = NP.canHit;
NP.canHit = function (t) { if (this.jump) return t && t.kind === 'player'; return _canHit.call(this, t); };
NP.update = function (dt, scene) {
  const j = this.jump;
  if (j && !this.dead && scene.jumpIn) {
    this.baseUpdate(dt, scene.map);
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    const p = scene.player; this.target = p; this.talking = false;
    const d = this.distTo(p);
    if (d > 15) this.stepToward(p.x + j.ox, p.y + j.oy, dt, scene, true);
    else { this.moving = false; this.faceTowards(p); if (this.attackCd <= 0 && !this.swing) G.melee.start(this); }
    return;
  }
  return _nu.call(this, dt, scene);
};
Object.defineProperty(NP, 'weaponItem', (() => {
  const d = Object.getOwnPropertyDescriptor(NP, 'weaponItem');
  return { configurable: true, get() { return this.jump ? null : d.get.call(this); } };   // a beat-in is fists only
})());
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const j = this.jumpIn;
  if (j && G.scenes.top() === this) {
    j.t -= dt;
    const p = this.player;
    if (j.npc.dead || p.dead || Math.min(...j.crew.filter((a) => !a.dead).map((a) => a.distTo(p)), j.npc.distTo(p)) > 260) { G.initiation.endJump(this, false); G.initiation.fail(this, 'gang_blue', 'You ran. Nobody gets jumped in by running.', 1); }   // (knocked back by the punches is not running)
    else if (j.t <= 0) G.initiation.endJump(this, true);
  }
  return _gu.call(this, dt);
};
// swing back during the beat-in and it is over
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  if (scene && scene.jumpIn && target && target.jump && source && source.kind === 'player') {
    G.initiation.endJump(scene, false);
    G.initiation.fail(scene, 'gang_blue', 'You swung back. "Not ready. Come back tomorrow."', 1);
  }
  return _dmg.apply(this, arguments);
};

// ---------------------------------------------------------------- Red: blood in
const _die = NP.die;
NP.die = function (source, scene) {
  const w = scene && scene.world;
  if (w && G.initiation.active(w, 'gang_red') && this.def.faction === 'gang_blue' && !this.def.kid && source === scene.player && !w.flags.init_gang_red_kill) {
    const outdoors = !scene.map.buildingAt(this.x, this.y - 3);
    const watched = scene.actors.some((a) => a !== this && a.kind === 'npc' && !a.dead && !a.sleeping && a.canSee(scene, scene.player, 170));
    if (outdoors && watched) { this.redMark = true; w.flags.init_gang_red_kill = true; scene.toast('People saw that. Now cut up the body.', 'warn'); }
    else scene.toast(outdoors ? 'Nobody saw it. Red wants it done in public.' : 'Indoors does not count. It has to be in the open.', 'warn');
  }
  return _die.call(this, source, scene);
};
const _corpse = G.containers.createCorpse;
G.containers.createCorpse = function (world, npc, mapId) {
  const before = new Set(Object.keys(world.containers));
  const r = _corpse.apply(this, arguments);
  if (npc && npc.redMark) for (const id in world.containers) if (!before.has(id)) world.containers[id].redMark = true;
  return r;
};
const _cut = G.dismember.run;
G.dismember.run = function (scene, c) {
  if (c && c.redMark && G.dismember.can(scene, c) && G.initiation.active(scene.world, 'gang_red')) scene.world.flags.init_gang_red_cut = true;
  return _cut.call(this, scene, c);
};

// ---------------------------------------------------------------- Punks and Revolutionaries: crimes count
const W = G.World.prototype, _crime = W.commitCrime;
W.commitCrime = function (type) {
  const r = _crime.apply(this, arguments);
  if (type === 'vandalism' && G.initiation.active(this, 'punks')) {
    const q = this.quests[QID('punks')]; q.progress.smashed = (q.progress.smashed || 0) + 1;
    if (q.progress.smashed >= 3) this.flags.init_punks_done = true;
  }
  if (type === 'arson' && G.initiation.active(this, 'revolutionaries')) this.flags.init_revolutionaries_done = true;
  return r;
};

// ---------------------------------------------------------------- Government: a clean record (checked hourly)
G.events.on('hour', () => {
  const w = G.world; if (!w || !G.initiation.active(w, 'government')) return;
  const q = w.quests[QID('government')];
  const noBounty = Object.values(w.bounty || {}).every((b) => !b);
  const quiet = Object.values(w.lastCrimeDay || {}).every((d) => w.day - d >= 3) && w.day - q.day >= 3;
  w.flags.init_government_clean = noBounty && quiet;
});

// ---------------------------------------------------------------- CIA: the dead drop
G.initiation.plantDrop = function (scene) {
  const w = scene.world, maps = ['city', 'suburbs', 'southside', 'eastside', 'heights', 'rural'].filter((id) => id !== scene.map.id && G.MAPGEN[id]);
  const mid = pick(maps), m = G.maps.get(mid);
  const dump = m.decor.filter((d) => d.type === 'dumpster' || d.def.interact === 'dumpster' || d.def.interact === 'trash');
  const d = dump.length ? pick(dump) : null;
  const at = d ? m.randomWalkableNear(d.tx, d.ty + 1, 1) : m.points[Object.keys(m.points).find((k) => k.startsWith('from_'))];
  const bag = G.containers.createBag(w, mid, at.x * 16 + 8, at.y * 16 + 12, [['cia_package', 1]]);
  bag.name = 'Dead Drop';
  w.gps = { map: mid, x: at.x, y: at.y, label: 'Dead drop' };
  scene.toast(`The dead drop is in ${m.meta.name}. It is on Eagle Maps.`, 'quest');
  if (scene.map.id === mid) scene.refreshContainers();
};

// ---------------------------------------------------------------- the conversation
const canAsk = (runner) => {
  const { npc, scene } = runner, w = scene.world, fid = npc.def.faction, f = npc.faction;
  return !npc.def.kid && f && f.listed && INITS[fid] && !w.isMember(fid) && runner.revealsFaction() && !npc.st.companion;
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world, fid = npc.def.faction;
  if (!canAsk(runner)) return [];
  const out = [];
  if (G.initiation.active(w, fid)) {
    const I = INITS[fid];
    if (G.initiation.ready(scene, fid)) out.push({ text: I.fee ? `I did it. And I have the $${I.fee}.` : 'It is done. I am ready.', next: '_init_done' });
    else out.push({ text: `About my initiation (${I.title})...`, next: '_init_status' });
  } else if (!npc.def.leader) out.push({ text: 'I want in. Can I join you?', next: '_f_join' });   // (the boss already has this)
  return out;
});
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_NODES._f_join = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction, I = INITS[fid];
  if (!I) return { text: 'That is not how this works.', choices: BACK };
  if (w.isMember(fid)) return { text: 'You are already one of us.', choices: BACK };
  if (G.initiation.active(w, fid)) return { text: `You already know what you have to do. ${I.desc}`, choices: BACK };
  const cd = (w.initCooldown || {})[fid];
  if (cd && w.day < cd) return { text: pick(['After last time? Not yet.', 'You had your shot. Give it some time.']), choices: BACK };
  const asked = (w.initAsked = w.initAsked || {});
  if (asked[fid] && asked[fid].day === w.day && !asked[fid].yes) return { text: pick(['I already told you. Not today.', 'Asking again will not change my answer. Not today.']), choices: BACK };
  const odds = G.initiation.odds(scene, npc), yes = (asked[fid] && asked[fid].day === w.day && asked[fid].yes) || Math.random() < odds;
  asked[fid] = { day: w.day, yes };
  if (!yes) {
    const why = w.getRep(fid) <= -20 ? 'After what you have done to us? Get out of my face.' : (npc.st.disp || 0) <= -30 ? 'You? I do not even like you.'
      : odds < 0.25 ? pick(['We do not know you. Nobody vouches for you. No.', 'Do some work for us first. Then maybe.']) : pick(['Not today. Ask me again some time.', 'Hm. ...No. Not yet.']);
    return { text: why, choices: BACK };
  }
  return {
    text: `${pick(['Alright. Maybe.', 'You might have what it takes.', 'Okay. Let us see.'])} ${I.pitch}`,
    choices: [
      { text: 'I am in. Let\'s do it.', do: () => { G.initiation.start(scene, npc); }, next: null },
      { text: 'Not right now.', next: 'start' },
    ],
  };
};
G.DIALOGUE_NODES._init_status = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction, q = w.quests[QID(fid)];
  const left = q.def.objectives.filter((o) => !(o.type === 'have' ? scene.player.inventory.has(o.item, o.count) : w.flags[o.flag])).map((o) => o.text);
  const extra = fid === 'punks' ? ` (${q.progress.smashed || 0} of 3 so far)` : '';
  return { text: `${INITS[fid].desc} Still to do: ${left.join('; ') || 'nothing'}${extra}.`, choices: BACK };
};
G.DIALOGUE_NODES._init_done = (r) => {
  const { npc, scene } = r, w = scene.world, fid = npc.def.faction, I = INITS[fid], p = scene.player;
  if (I.fee && p.gold < I.fee) return { text: `The fee is $${I.fee}. You do not have it on you.`, choices: BACK };
  if (I.fee) { p.gold -= I.fee; npc.st.gold = (npc.st.gold || 0) + Math.min(I.fee, 500); G.audio.play('coin'); }
  for (const o of I.objectives) if (o.type === 'have') p.inventory.remove(o.item, o.count);
  G.initiation.join(scene, fid, npc);
  const lines = {
    gang_red: 'Blood in. You are Red now. Wear it.', punks: 'Ha! Okay, you are alright. Welcome to the Punks.', government: 'Your application is approved. Welcome to public service.',
    cia: 'Unopened. Good. Welcome. We were never here.', revolutionaries: 'Welcome to the collective, comrade. Here is your tote bag. The rifle is in the tote bag.', elite: 'Splendid. Welcome. We shall see you at the next gathering.',
  };
  return { text: lines[fid] || 'Welcome.', choices: [{ text: 'Goodbye.', next: null }] };
};
})();
