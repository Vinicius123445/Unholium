'use strict';
// The Maizonary: a secret society (inspired by the Freemasons). Not a faction you can see: no meter, no
// journal page, nobody admits it, until you are one of them.
//
// Finding them (on your own):
//   - Respected people are quietly members (the Mayor, the harbormaster, the smith, the jeweler, the barber,
//     the pharmacist, the police captain). They carry a signet ring; when they like you, they let odd things
//     slip ("The square keeps us honest.").
//   - A small carving by the door of the Office Tower downtown: a square, a compass, an eye. Under it,
//     scratched smaller: "Traveling men are welcome."
//   - Once you have seen the mark or the ring, you can ask anyone "Are you a traveling man?". Most people
//     have no idea what you mean. A member knows, and sends you to the doorman of the Office Tower, after ten.
// The trials (the doorman sets them, at night): carry a sealed letter to a brother unopened, leave $200 for
// the poor with the priest, and bring back the Worn Ledger from the dead drop in the rural graveyard,
// unopened. Then the ceremony, at the Office Tower after ten: whether they take you is charisma and luck,
// but never less than a 75% chance. Refused, you may petition again in seven days.
// Inside: degrees 11, 22, 33, 44, 55, 66, 77, earned by lodge work (merit). Each degree is a perk (a
// permanent effect, shown with your others): 11 Brotherhood (+1 charisma, the brothers like you), 22
// Charity (better prices), 33 Influence (more charisma, better prices), 44 Friends in High Places (bounties
// grow at half the rate), 55 The Lodge Provides (a weekly stipend), 66 Silence (stealth; a brother who sees
// you never reports you), 77 The Hidden Hand (once a week, your record disappears).
(() => {
const pick = (a) => G.rng.pick(a);
const MEMBERS = ['c_lord', 'c_harbormaster', 'r_smith', 'h_jeweler', 'c_barber', 'c_alchemist', 'c_captain', 'mz_master'];
const DEG = [11, 22, 33, 44, 55, 66, 77], MERIT = [0, 2, 5, 9, 14, 20, 27];
const LODGE = 'c_noble1';   // the Office Tower, downtown
const night = (w) => w.hour >= 22 || w.hour < 4;

// ---------------------------------------------------------------- the people
G.NPCS.mz_master = {
  name: 'Doorman', map: 'city', faction: 'civilians', hp: 40, combat: 'flee', home: LODGE, gold: 80,
  look: G.look('mzmaster', { body: 'm', top: 'jacket', shirt: '#1e1e26', shirt2: '#d8d0c0', pants: '#1a1a20', hair: '#9a9a9a', facial: 2, glasses: 'round' }),
  schedule: [{ from: 6, to: 22, at: LODGE + '_in', act: 'idle' }, { from: 22, to: 6, at: LODGE + '_in', act: 'work' }],
  job: 'I keep the door. That is all.', maizonMaster: true, relations: {},
};
G.FACTIONS.maizonary = { name: 'The Maizonary', listed: false, startRep: 0, color: '#c8b070', covert: true, hidden: true, desc: 'Brothers. Charity, discretion, and a helping hand where it is needed. Nothing more. (Everything more.)' };
const _listed = G.listedFactions;
G.listedFactions = function () { const l = _listed.apply(this, arguments); return G.world && G.world.isMember('maizonary') && !l.includes('maizonary') ? l.concat(['maizonary']) : l; };

Object.assign(G.ITEMS, {
  signet_ring: { id: 'signet_ring', name: 'Signet Ring', type: 'misc', icon: 'ring', value: 60, stack: 3, desc: 'Gold, heavy. Engraved on the face: a square, a compass and an eye. (Use it to look closer.)' },
  mz_letter: { id: 'mz_letter', name: 'Sealed Letter', type: 'quest', icon: 'letter', value: 0, stack: 1, desc: 'Wax seal: a square and a compass. For a brother. Do not open it.' },
  mz_ledger: { id: 'mz_ledger', name: 'Worn Ledger', type: 'quest', icon: 'book', value: 0, stack: 1, desc: 'Leather, old, tied shut with cord. Bring it back unopened.' },
});
G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.signet_ring = (scene) => {
  const w = scene.world, m = mz(w);
  if (!m.ring) { m.ring = true; w.log('The ring: a square, a compass, an eye. Inside the band, tiny letters: "TRAVELING MEN".', 'quest'); }
  scene.toast('A square, a compass, an eye. Inside the band: "TRAVELING MEN".');
  return false;
};
for (const id of ['mz_letter', 'mz_ledger']) G.ITEM_USE[id] = (scene) => {
  scene.confirm('Open it? (You were told not to.)', () => {
    const w = scene.world, m = mz(w);
    scene.player.inventory.remove(id, 1);
    m.trialFailed = w.day; m.stage = 1; delete m.trials;
    if (w.quests.maiz_trials) w.quests.maiz_trials.state = 'failed';
    scene.toast('Blank pages. All of it. It was a test, and you failed it. (You may try again in a week.)', 'bad');
    w.log('You opened what you were trusted not to. The trials are over, for now.', 'bad');
  });
  return true;
};

const mz = (w) => (w.maiz = w.maiz || { stage: 0, degree: 0, merit: 0 });
const isMember = (id) => MEMBERS.includes(id) || (G.NPCS[id] && G.NPCS[id].maizonMaster);
G.maizonary = {
  MEMBERS, DEG, MERIT, LODGE, isMember, state: mz,
  degree(w) { return mz(w).degree || 0; },
  title(w) { const d = this.degree(w); return d ? `${d}th Degree` : ''; },
  progress(w) { const m = mz(w), i = DEG.indexOf(m.degree); return i >= DEG.length - 1 ? 'the highest degree' : `merit ${m.merit}/${MERIT[i + 1]} to ${DEG[i + 1]}th`; },
  odds(scene) { const p = scene.player; return G.util.clamp(0.75 + (G.skills.charisma(p) - 5) * 0.03 + (G.skills.stat(p, 'luck') || 0) * 0.03, 0.75, 0.98); },
  join(scene) {
    const w = scene.world, m = mz(w);
    w.flags.member_maizonary = true; m.degree = 11; m.merit = 0; m.stage = 4;
    if (w.quests.maiz_trials) w.quests.maiz_trials.state = 'done';
    for (const id of MEMBERS) if (w.npcs[id]) G.social.addDisp(w, id, 15);
    this.sync(scene.player, w);
    w.log('You have been raised to the 11th Degree of the Maizonary. Speak of it to no one.', 'quest');
    G.audio.play('quest'); G.events.emit('xp', 80, 'Initiated');
  },
  gain(scene, pts) {
    const w = scene.world, m = mz(w);
    m.merit += pts;
    let i = DEG.indexOf(m.degree);
    while (i < DEG.length - 1 && m.merit >= MERIT[i + 1]) {
      i++; m.degree = DEG[i];
      scene.toast(`The Maizonary: raised to the ${m.degree}th Degree.`, 'quest');
      w.log(`Raised to the ${m.degree}th Degree. ${PERK[m.degree].name}: ${PERK[m.degree].desc}`, 'quest');
      G.audio.play('quest'); G.events.emit('xp', 40 + i * 20, 'Raised');
      this.sync(scene.player, w);
    }
  },
  // the perk: one permanent effect showing the degree and everything it gives
  sync(p, w) {
    const d = this.degree(w);
    for (const n of DEG) { const id = 'maizon_' + n; const has = G.effects.has(p, id); if (n === d && !has) p.effects.push({ id, t: 1e12, dur: 1e12, power: 1 }); if (n !== d && has) p.effects = p.effects.filter((e) => e.id !== id); }
  },
};
const PERK = {
  11: { name: 'Brotherhood', desc: '+1 charisma; the brothers look after their own.', stats: { charisma: 1 } },
  22: { name: 'Charity', desc: 'Shops treat you well (better prices).', stats: { charisma: 1, barter: 0.05 } },
  33: { name: 'Influence', desc: 'More charisma, better prices.', stats: { charisma: 2, barter: 0.08 } },
  44: { name: 'Friends in High Places', desc: 'New bounties against you grow at half the rate.', stats: { charisma: 2, barter: 0.08 } },
  55: { name: 'The Lodge Provides', desc: 'A weekly stipend of $250.', stats: { charisma: 2, barter: 0.1 } },
  66: { name: 'Silence', desc: 'Quieter; a brother who sees you do wrong never reports it.', stats: { charisma: 2, barter: 0.1, stealth: 0.1 } },
  77: { name: 'The Hidden Hand', desc: 'Once a week, ask the doorman and your record disappears.', stats: { charisma: 3, barter: 0.12, stealth: 0.12 } },
};
G.maizonary.PERK = PERK;
for (const n of DEG) G.EFFECTS['maizon_' + n] = { id: 'maizon_' + n, name: `Maizonary ${n}th Degree: ${PERK[n].name}`, kind: 'perk', bad: false, color: '#c8b070', stats: PERK[n].stats, permanent: true,
  desc: DEG.filter((k) => k <= n).map((k) => `${k}: ${PERK[k].desc}`).join(' ') };
// a perk is not washed off by anything
const _rem = G.effects.remove;
G.effects.remove = function (p, id) { if (/^maizon_\d+$/.test(id) && G.world && G.maizonary.degree(G.world) === +id.slice(7)) return; return _rem.call(this, p, id); };

// ---------------------------------------------------------------- the mark by the door
const A = G.assets, _init = A.init;
A.init = function () {
  _init.call(this);
  const { c, x } = A.mk(10, 10), R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  R(0, 0, 10, 10, '#8a8478'); R(0, 0, 10, 1, '#a8a294'); R(1, 1, 8, 8, '#7a7468');
  // compass (an inverted V), square (a V), and the eye in the middle
  R(4, 2, 2, 1, '#2a2620'); R(3, 3, 1, 2, '#2a2620'); R(6, 3, 1, 2, '#2a2620'); R(2, 5, 1, 2, '#2a2620'); R(7, 5, 1, 2, '#2a2620');
  R(2, 7, 6, 1, '#2a2620'); R(4, 4, 2, 1, '#d8c890'); R(4, 5, 2, 1, '#2a2620');
  A.outline && A.outline(c);
  A.sprites.maizon_mark = { img: c, ax: 5, ay: 9, w: 10, h: 10 };
};
G.DECOR.maizon_mark = { sprite: 'maizon_mark', solid: false, interact: 'maizon_mark' };
const _city = G.MAPGEN.city;
G.MAPGEN.city = function () {
  const m = _city.apply(this, arguments), b = m.building(LODGE);
  if (b) { const sp = m.decor.find((d) => /^shopsign_/.test(d.type) && Math.abs(d.ty - b.doorY) <= 3 && Math.abs(d.tx - b.doorX) <= 4), side = sp && sp.tx > b.doorX ? -1 : 1, tx = b.doorX + side, ty = b.doorY + 1; if (!m.decor.some((d) => d.tx === tx && d.ty === ty)) m.addDecor('maizon_mark', tx, ty); }   // (not behind the signpost)
  return m;
};
const U = G.usables, _use = U.use, _label = U.label;
U.label = function (d, scene) { return d.def.interact === 'maizon_mark' ? 'Look at the carving' : _label.call(this, d, scene); };
U.use = function (d, scene) {
  if (d.def.interact !== 'maizon_mark') return _use.call(this, d, scene);
  const w = scene.world, m = mz(w);
  scene.toast('A small carving by the door: a square, a compass, an eye. Under it, scratched smaller: "Traveling men are welcome."');
  if (!m.mark) { m.mark = true; w.log('You found a strange mark by the Office Tower door: a square, a compass, an eye. "Traveling men are welcome."', 'quest'); }
};

// ---------------------------------------------------------------- hints: rings, and things people let slip
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  for (const id of MEMBERS) {
    const st = w.npcs[id];
    if (st && st.alive && !st.mzRing) { st.mzRing = true; (st.inv = st.inv || []).push(['signet_ring', 1]); }
  }
  if (w.day === 3 && !w.flags.mzRumor) { w.flags.mzRumor = true; w.rumor('People say some very important folks meet in the Office Tower late at night. Lights on the top floor, nobody going in.', 'city'); }
  // the stipend (55th degree and up)
  const m = mz(w);
  if (m.degree >= 55 && G.player && w.day - (m.payDay || 0) >= 7) { m.payDay = w.day; G.player.gold += 250; w.log('An envelope from the Lodge: $250. "For your good works."', 'good'); }
  if (m.degree && G.player) G.maizonary.sync(G.player, w);
});
const SLIPS = ['The square keeps us honest.', 'Some of us meet late. Very late.', 'Have you ever traveled east?', 'A good man is a good man, whatever his trade.', '*taps the ring on their finger, absently*'];
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (isMember(this.id) && !this.dead && !this.bark && !this.talking && scene.player && this.distTo(scene.player) < 80 && (this.st.disp || 0) >= 25 && Math.random() < dt / 60) this.say(pick(SLIPS), 3);
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- the conversations
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world, m = mz(w), out = [];
  if (npc.def.kid || npc.transient || npc.remote) return out;
  const memb = isMember(npc.id);
  // the password, once you have a reason to know it
  if ((m.mark || m.ring) && m.stage === 0) out.push({ text: '(Quietly) Are you a traveling man?', next: '_mz_ask' });
  if (npc.def.maizonMaster) {
    if (m.stage >= 1 && m.stage < 4 && night(w)) {
      if (!m.trials) { if (!m.trialFailed || w.day - m.trialFailed >= 7) out.push({ text: 'I was sent. I am a traveling man.', next: '_mz_trials' }); }
      else if (G.maizonary.trialsDone(w)) out.push({ text: 'The trials are done. I am ready for the light.', next: '_mz_ceremony' });
      else out.push({ text: 'About the trials...', next: '_mz_status' });
    }
    if (w.isMember('maizonary') && m.degree >= 77 && Object.values(w.bounty || {}).some((b) => b > 0) && w.day - (m.handDay || -99) >= 7) out.push({ text: '(The Hidden Hand) I have a problem with the law.', next: '_mz_hand' });
  }
  if (memb && m.trials && m.trials.letterTo === npc.id && scene.player.inventory.has('mz_letter')) out.push({ text: '[Hand over the sealed letter]', next: '_mz_letter' });
  if (npc.id === 'c_priest' && m.trials && !m.trials.charity) out.push({ text: `[Leave $200 for the poor]${scene.player.gold < 200 ? ' (you do not have it)' : ''}`, next: '_mz_charity' });
  if (memb && w.isMember('maizonary')) {
    if (!G.jobs.active(w).some((id) => G.jobs.def(w, id).lodgeWork)) out.push({ text: '(Lodge business) Is there work for a brother?', next: '_mz_work' });
    out.push({ text: '(Lodge business) [Make a donation to the Lodge] ($100)', next: '_mz_donate' });
  }
  return out;
});
G.maizonary.trialsDone = (w) => { const t = mz(w).trials; return !!(t && t.letter && t.charity && G.player && G.player.inventory.has('mz_ledger')); };
G.DIALOGUE_NODES._mz_ask = (r) => {
  const { npc, scene } = r, w = scene.world, m = mz(w);
  if (!isMember(npc.id)) return { text: pick(['A what? I take the bus, mostly.', 'Is that a pickup line? It is a bad one.', 'I have no idea what you are talking about.', '...Are you feeling okay?']), choices: BACK };
  if ((npc.st.disp || 0) < 10) return { text: '*a long look* I would not know. Ask me again when I know you better.', choices: BACK };
  m.stage = 1;
  w.log('A brother answered: "Speak to the doorman of the Office Tower. After ten."', 'quest');
  return { text: '*glances around, then lowers their voice* ...From the east, toward the light. Speak to the doorman of the Office Tower. After ten at night. Not before.', choices: BACK };
};
G.DIALOGUE_NODES._mz_trials = (r) => {
  const { scene } = r, w = scene.world, m = mz(w), p = scene.player;
  const brothers = MEMBERS.filter((id) => id !== 'mz_master' && w.isAlive(id));
  const to = pick(brothers.length ? brothers : ['c_barber']);
  m.trials = { letterTo: to, letter: false, charity: false };
  p.inventory.add('mz_letter', 1);
  // the ledger waits in a bag at the rural graveyard
  const rm = G.maps.get('rural'), gp = rm.points.r_graveyard || rm.points.start;
  const bag = G.containers.createBag(w, 'rural', gp.x * 16 + 8, gp.y * 16 + 12, [['mz_ledger', 1]]); bag.name = 'Weathered Satchel';
  w.quests.maiz_trials = { state: 'active', day: w.day, progress: {}, def: {
    title: 'The Trials', desc: 'Prove yourself to the people who meet in the Office Tower at night.', type: 'secret', giver: null, reward: {}, deadline: 1e9, failIfDead: [],
    objectives: [
      { type: 'flag', flag: 'mz_t_letter', text: `Carry the sealed letter to ${w.displayName(to)}, unopened` },
      { type: 'flag', flag: 'mz_t_charity', text: 'Leave $200 for the poor with the priest' },
      { type: 'have', item: 'mz_ledger', count: 1, text: 'Bring back the Worn Ledger from the rural graveyard, unopened' },
    ] } };
  G.audio.play('quest');
  return { text: `Then hear me. Three trials. Carry this letter to ${w.displayName(to)}; do not open it. Leave two hundred dollars for the poor with the priest. And at the old graveyard in the rural zone, a satchel: bring me the ledger inside. Unopened. Then come back to me, after ten.`, choices: [{ text: 'It will be done.', next: null }] };
};
G.DIALOGUE_NODES._mz_status = (r) => {
  const w = r.scene.world, t = mz(w).trials, p = r.scene.player;
  const left = [!t.letter && `the letter for ${w.displayName(t.letterTo)}`, !t.charity && 'the gift for the poor', !p.inventory.has('mz_ledger') && 'the ledger from the graveyard'].filter(Boolean);
  return { text: `Still waiting on: ${left.join(', ')}.`, choices: BACK };
};
G.DIALOGUE_NODES._mz_letter = (r) => {
  const w = r.scene.world, m = mz(w);
  r.scene.player.inventory.remove('mz_letter', 1); m.trials.letter = true; w.flags.mz_t_letter = true;
  return { text: '*breaks the seal, reads, nods slowly* ...Good. Very good. Go on, then.', choices: BACK };
};
G.DIALOGUE_NODES._mz_charity = (r) => {
  const w = r.scene.world, m = mz(w), p = r.scene.player;
  if (p.gold < 200) return { text: 'Bless you for the thought. Come back when you can spare it.', choices: BACK };
  p.gold -= 200; r.npc.st.gold = (r.npc.st.gold || 0) + 200; m.trials.charity = true; w.flags.mz_t_charity = true; G.audio.play('coin');
  return { text: 'Two hundred? For the poor box? ...That is a great kindness. Someone will eat tonight because of you.', choices: BACK };
};
G.DIALOGUE_NODES._mz_ceremony = (r) => {
  const { scene } = r, w = scene.world, m = mz(w), p = scene.player;
  p.inventory.remove('mz_ledger', 1);
  if (Math.random() < G.maizonary.odds(scene)) {
    G.maizonary.join(scene);
    return { text: 'Then come up. *the elevator, the top floor, a dark room, candles, many hands* ...Rise, brother. You are of the 11th Degree. What happens in the Lodge stays in the Lodge.', choices: [{ text: '[Rise]', next: null }] };
  }
  m.trialFailed = w.day; delete m.trials; w.quests.maiz_trials.state = 'failed'; w.flags.mz_t_letter = w.flags.mz_t_charity = false;
  return { text: 'The brothers have voted. ...Not yet. It is no judgment on you. Come back in seven days and petition again.', choices: [{ text: '[Leave]', next: null }] };
};
G.DIALOGUE_NODES._mz_hand = (r) => {
  const w = r.scene.world, m = mz(w);
  m.handDay = w.day; for (const k in w.bounty) w.bounty[k] = 0; r.scene.pendingReports = [];
  w.log('The Hidden Hand: your record is clean.', 'good');
  return { text: 'Consider it handled. You were never there. Neither was anyone.', choices: BACK };
};
G.DIALOGUE_NODES._mz_donate = (r) => {
  const p = r.scene.player;
  if (p.gold < 100) return { text: 'The thought counts. The money counts more. Come back.', choices: BACK };
  p.gold -= 100; G.audio.play('coin'); G.maizonary.gain(r.scene, 1);
  return { text: 'For the good works. The Lodge remembers.', choices: BACK };
};
G.DIALOGUE_NODES._mz_work = (r) => {
  const { npc, scene } = r, w = scene.world;
  let def = null;
  for (let k = 0; k < 6 && !def; k++) { const t = pick(['deliver', 'scout', 'steal', 'collect']); def = G.JOB_TYPES[t] && G.JOB_TYPES[t].make(w, npc.id); }
  if (!def) return { text: 'Nothing tonight, brother.', choices: BACK };
  def.giver = npc.id; def.lodgeWork = true; def.title = 'Lodge: ' + def.title;
  return { text: `Discreetly, then. ${def.pitch}`, choices: [{ text: 'For the Lodge.', do: () => { G.jobs.accept(r, def); }, next: null }, { text: 'Not now.', next: 'start' }] };
};
const _complete = G.jobs.complete;
G.jobs.complete = function (runner, id) {
  const d = this.def(runner.scene.world, id), was = runner.scene.world.quests[id] && runner.scene.world.quests[id].state;
  const msg = _complete.call(this, runner, id);
  if (d && d.lodgeWork && was === 'active' && runner.scene.world.quests[id].state === 'done') G.maizonary.gain(runner.scene, 2);
  return msg;
};

// ---------------------------------------------------------------- what the degrees do in the world
const W = G.World.prototype, _crime = W.commitCrime;
W.commitCrime = function (type, region) {
  const before = (this.bounty || {})[region] || 0, r = _crime.apply(this, arguments);
  if (G.maizonary.degree(this) >= 44 && this.bounty[region] > before) this.bounty[region] = before + Math.round((this.bounty[region] - before) / 2);
  return r;
};
const GS = G.GameScene.prototype, _wit = GS.witnessesOf;
GS.witnessesOf = function (victim) {
  const out = _wit.call(this, victim);
  return G.maizonary.degree(this.world) >= 66 ? out.filter((a) => !isMember(a.id)) : out;
};
// the journal: the degree, once you are in
if (G.factionRanks) {
  const FR = G.factionRanks, _t = FR.title, _p = FR.progress;
  FR.title = function (w, fid) { return fid === 'maizonary' ? G.maizonary.title(w) : _t.call(this, w, fid); };
  FR.progress = function (w, fid) { return fid === 'maizonary' ? G.maizonary.progress(w) : _p.call(this, w, fid); };
}
// the brothers keep the Lodge's secrets: no "Who do you run with?" admissions, no membership offers
})();
