'use strict';
// Kids and teenagers (def.kid: 'kid' | 'teen').
//   They go to school, play in the park, hang around the court or the store, and go home to bed.
//   They cannot be hurt (attacks, bullets and cars just scare them off), and none of the adult systems
//   apply to them: no romance, no threats, no drugs, no pickpocketing, no companions, no rude insults.
//   They give kid-sized jobs: get them a soda, candy or a comic. Teenagers may ask you to buy them beer and
//   cigarettes — you can, but supplying minors is a crime if an adult sees it.
(() => {
G.CRIMES.minors = { label: 'Supplying a minor', bounty: 60, rep: -6, tension: 2 };
const ADULT = /^_(flirt|date|partner|together|breakup|love|comp_|invite|visit_them|job_offer|spare_key|buy_drugs|rude|number|threaten|order)/;
const ADULT_TEXT = /Flirt|date|partner|private|break up|Hand over|selling|work for me|spare key|come over|come with me|number|love you/i;

// ---- dialogue: kids get kid choices only ----
const DR = G.DialogueRunner.prototype, _common = DR.commonChoices, _go = DR.go;
// every node, not just the common choices: nothing adult or threatening is ever offered to a kid
DR.go = function (nodeId) {
  _go.call(this, nodeId);
  if (this.node && this.npc.def.kid) {
    this.node.choices = this.node.choices.filter((ch) => !(ch.raw.next && ADULT.test(ch.raw.next)) && !ADULT_TEXT.test(ch.text || '') && !/Threaten|Intimidate/.test(ch.text || ''));
    if (!this.node.choices.length) this.node.choices = [{ raw: { text: 'Goodbye.', next: null }, text: 'Goodbye.' }];
  }
};
DR.commonChoices = function () {
  const out = _common.call(this);
  if (!this.npc.def.kid) return out;
  const kid = this.npc.def.kid, st = this.npc.st, p = this.scene.player;
  const keep = out.filter((ch) => !(ch.next && ADULT.test(ch.next)) && !ADULT_TEXT.test(typeof ch.text === 'function' ? '' : ch.text || ''));
  const extra = [];
  // their errands are real jobs (journal, chatBCT, map marker); handing the stuff over goes through "About the job"
  if (!G.jobs.active(this.scene.world).some((id) => G.jobs.def(this.scene.world, id).giver === this.npc.id)) extra.push({ text: kid === 'teen' ? 'You look like you need something.' : 'Hey kid, need help with anything?', next: '_kid_job' });
  extra.push({ text: G.rng.pick(['Shouldn\'t you be in school?', 'Where are your parents?']), next: '_kid_chat' });
  const bye = keep.pop();
  return keep.concat(extra, [bye]);
};
G.kids = {
  accept(r, j) {
    const { npc } = r, w = r.scene.world, who = w.displayName(npc.id), list = j.items.map(([id, n]) => n + 'x ' + G.item(id).name).join(', ');
    const def = {
      type: 'kid_errand', giver: npc.id, minors: !!j.minors, title: `${npc.def.kid === 'teen' ? 'Teen' : 'Kid'} errand: ${list}`,
      desc: `${who} asked you to get them ${list}. Bring it to them. (${j.pay} dollars in it for you.)`,
      objectives: j.items.map(([id, n]) => ({ type: 'have', item: id, count: n, text: `Get ${n}x ${G.item(id).name}` })),
      reward: { gold: j.pay, xp: 10, disp: 10, take: j.items }, days: 3,
    };
    G.jobs.accept({ scene: r.scene, npc, c: r.c }, def);
    r.scene.toast(`${npc.def.kid === 'teen' ? 'Teenager' : 'Kid'} wants: ${list}`, 'quest');
  },
};
// handing beer and smokes to a minor in front of an adult is a crime
const _complete = G.jobs.complete;
G.jobs.complete = function (runner, id) {
  const d = this.def(runner.scene.world, id), res = _complete.call(this, runner, id);
  const scene = runner.scene;
  if (d && d.minors && scene.world.quests[id].state === 'done') {
    const adult = scene.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.sleeping && a.canSee(scene, scene.player, 110));
    if (adult) { adult.say(adult.def.combat === 'guard' ? 'Did you just give BEER to a kid?! You are under arrest!' : 'Are you giving alcohol to a CHILD?!', 3); scene.reportCrime('minors', adult); }
  }
  return res;
};
const JOBS = {
  kid: [
    { items: [['soda', 1]], ask: 'Can you get me a soda? Mom says I can\'t have any. ...She doesn\'t have to know.', pay: 3 },
    { items: [['candy', 2]], ask: 'Can you buy me candy? Two! I have... three dollars.', pay: 3 },
    { items: [['comic_book', 1]], ask: 'The new comic came out and the store won\'t sell to me because I\'m "loitering". Please?', pay: 6 },
  ],
  teen: [
    { items: [['beer', 2], ['cigarettes', 1]], ask: 'Okay, real talk. Buy us a couple beers and a pack of smokes? We\'ll pay double. Nobody has to know.', pay: 30, minors: true },
    { items: [['energy_drink', 2]], ask: 'Get me two energy drinks? I have a test tomorrow and I haven\'t studied. At all.', pay: 10 },
    { items: [['comic_book', 1]], ask: 'Can you grab me a comic book? It\'s not for me. It\'s ironic.', pay: 8 },
  ],
};
G.DIALOGUE_NODES._kid_job = (r) => {
  const { npc } = r, st = npc.st, j = G.rng.pick(JOBS[npc.def.kid] || JOBS.kid);
  return { text: j.ask, choices: [
    { text: 'Sure. Be right back.', next: null, do: () => G.kids.accept(r, j) },
    { text: j.minors ? 'Absolutely not. You are a kid.' : 'Not right now.', next: null, do: () => { if (j.minors) G.social.addDisp(r.scene.world, npc.id, -3); } },
  ] };
};
G.DIALOGUE_NODES._kid_chat = (r) => {
  const w = r.scene.world, kid = r.npc.def.kid;
  const school = w.hour >= 8 && w.hour < 15;
  return { text: kid === 'teen' ? (school ? 'It\'s a free period. ...Kind of. Don\'t tell anyone.' : G.rng.pick(['Ugh, you sound like my dad.', 'Around. Why do adults always ask that?'])) : (school ? 'Recess! Duh.' : G.rng.pick(['At home. They said be back before dark.', 'Mom is at work. I\'m allowed to be at the park!'])), choices: [{ text: 'Alright. Be safe.', next: null }] };
};

// ---- they are living beings: they can be hurt and killed, and that is the worst thing anyone can do ----
//   Hurting a child is its own crime (Child Abuse); killing one is the worst crime there is (Child Murder).
//   Kill a child and get found out (seen, or the police work it out within a few days) and you are marked
//   for good: the "Child Killer" mark never comes off. The police shoot on sight in every district and the
//   bounty can never be paid off; nobody will talk to you, sell to you or love you again; partners leave,
//   companions walk away, fighters attack you on sight and everyone else runs.
//   (No gore extras, no stripping or dismembering: their bodies are left alone.)
G.CRIMES.child_abuse = { label: 'Child Abuse', bounty: 300, rep: -40, tension: 20 };
G.CRIMES.child_murder = { label: 'Child Murder', bounty: 2000, rep: -100, tension: 60 };
G.EFFECTS.child_killer = { id: 'child_killer', name: 'Child Killer', kind: 'mark', bad: true, color: '#8a0a0a', stats: { charisma: -10 }, desc: 'You killed a child. Everyone knows. Nobody will ever forgive you.' };
const isKid = (a) => !!(a && a.def && a.def.kid);
const _damage = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  if (isKid(target) && !target.dead) {
    if (target.st) target.st.fear = 100;
    if (source && target.startFlee) target.startFlee(source);
    if (!target.barkT || target.barkT <= 0) target.say(G.rng.pick(['AAH! Leave me alone!', 'MOM!', 'Help!']), 2);
  }
  return _damage.call(this, target, amount, source, scene, o);
};
const GS = G.GameScene.prototype, _report = GS.reportCrime;
GS.reportCrime = function (type, victim, value, victimId) {
  if (isKid(victim)) { if (type === 'assault') type = 'child_abuse'; else if (type === 'murder') type = 'child_murder'; }
  return _report.call(this, type, victim, value, victimId);
};
const WP = G.World.prototype, _commit = WP.commitCrime;
WP.commitCrime = function (type, region, witnessed, victimId, value) {
  if (victimId && G.NPCS[victimId] && G.NPCS[victimId].kid && type === 'murder') type = 'child_murder';
  const r = _commit.call(this, type, region, witnessed, victimId, value);
  if (type === 'child_murder' && witnessed) G.kids.markKiller(this);
  return r;
};
G.kids = Object.assign(G.kids || {}, {
  markKiller(w) {
    if (w.flags.childKiller) return;
    w.flags.childKiller = w.day;
    if (G.player) G.effects.add(G.player, 'child_killer', 1e12);
    for (const id in w.npcs) { const st = w.npcs[id]; if (!G.NPCS[id] || G.NPCS[id].kid) continue; st.disp = Math.min(st.disp || 0, -80); st.romance = 0; st.partner = false; st.companion = false; st.lover = null; }
    if (G.fame) G.fame.add(w, 'bad', 1000);
    w.log('You killed a child. Everyone knows what you are now. There is no coming back from this.', 'bad');
    w.rumor('A child was murdered. The whole city is looking for the monster who did it.', 'city');
    w.rumor('A child was murdered. Nobody lets their kids out anymore.', 'rural');
  },
  // the bounty never goes away, everywhere
  enforce(w) {
    if (!w.flags.childKiller) return;
    for (const r of ['rural', 'city', 'forest']) w.bounty[r] = Math.max(w.bounty[r] || 0, G.BOUNTY_KILL_ON_SIGHT + 1000);
    if (G.player && !G.effects.has(G.player, 'child_killer')) G.effects.add(G.player, 'child_killer', 1e12);
  },
});
// unseen: the police work it out (most of the time) within a few days of the body being found
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  if (w.hour === 9) for (const id in w.dead || {}) {
    const dd = w.dead[id], d = G.NPCS[id];
    if (!d || !d.kid || !dd.byPlayer || dd.witnessed || dd.solved != null || w.day - dd.day < 3) continue;
    if (!dd.discovered) continue;   // nobody found the body (or it was never found): nobody finds out
    dd.solved = Math.random() < 0.6;
    if (dd.solved) { w.commitCrime('child_murder', G.maps.get(d.map).meta.region, true, null); w.log('Detectives tied you to the murder of a child.', 'bad'); }
  }
  G.kids.enforce(w);
});
// Once it is known: everyone despises you. The police and a good share of the fighters (some even of the
// timid) come at you on sight; everyone else still answers, but only with hatred, whatever you say, and
// may lash out at you mid-sentence.
const vengeful = (npc) => {
  if (npc.def.kid) return false;
  if (npc.def.combat === 'guard') return true;
  const r = new G.RNG('ck-' + npc.id).next();
  return npc.def.combat === 'fight' ? r < 0.45 : r < 0.08;
};
G.kids.vengeful = vengeful;
const NPK = G.NPC.prototype, _hostile = NPK.isHostileToPlayer;
NPK.isHostileToPlayer = function (scene) {
  if (scene.world.flags.childKiller && !(G.ko && G.ko.brain(this.st)) && vengeful(this)) return true;
  return _hostile.call(this, scene);
};
const _upd = NPK.update;
NPK.update = function (dt, scene) {
  const p = scene.player;
  if (scene.world.flags.childKiller && !this.dead && !this.def.kid && !(this.st && this.st.ko) && this.state === 'schedule' && !this.talking && (this.ckT = (this.ckT || 0) - dt) <= 0) {
    this.ckT = 0.8;
    if (this.canSee(scene, p, 110)) {
      if (vengeful(this) && this.def.combat !== 'guard') { this.say(G.rng.pick(['You. YOU! I\'ll kill you myself!', 'That\'s the child killer! Get him!', 'You don\'t get to walk around here!']), 3); this.st.hostile = true; this.aggressor = true; this.startFight(p, scene); }
      else if (this.def.combat === 'flee' && this.distTo(p) < 70 && (this.ckSeen || 0) < 2) { this.ckSeen = (this.ckSeen || 0) + 1; this.say(G.rng.pick(['There he is. The monster.', 'Get away from here! Nobody wants you here!', 'How are you still walking around?!', 'Murderer.']), 3); if (Math.random() < 0.5) this.startFlee(p); }
    }
  }
  return _upd.call(this, dt, scene);
};
const ANGRY = ['Don\'t you DARE talk to me.', 'You killed a child. You don\'t get to talk to anyone.', 'I hope they find you. I hope it hurts.', 'Every word out of your mouth makes me sick.', 'You should be in the ground, not standing here.', 'Monster.', 'Get away from me before I do something.', 'Rot in hell.'];
const RETORT = {
  hi: ['"Hello"? HELLO?! After what you did?', 'Don\'t you smile at me.', 'No. No pleasantries. Not for you.'],
  help: ['Help? Did that child get help?!', 'Help yourself. To a cell. Or a grave.', 'Ask the devil, he\'s your friend.'],
  explain: ['There\'s nothing to explain. Nothing!', 'I don\'t want to hear it. Nobody does.', 'Save it for the judge. Or God.'],
  threat: ['Go ahead. Do it. Prove it again.', 'You think I\'m scared of a child killer? Try me.', 'Touch me and this whole street comes down on you.'],
  buy: ['I wouldn\'t sell you water if you were on fire.', 'Get out of my shop.', 'Your money is dirty. Get out.'],
};
G.DIALOGUE_NODES._ck_angry = (r) => {
  const npc = r.npc, shop = G.shopSys.shopFor(npc.id, r.scene.world);
  const answer = (k) => ({ next: '_ck_retort', do: () => { r.ckLast = k; } });
  return {
    text: G.rng.pick(ANGRY),
    choices: [
      Object.assign({ text: 'Hey, can we talk?' }, answer('hi')),
      Object.assign({ text: 'Please. I need help.' }, answer('help')),
      Object.assign({ text: 'Let me explain.' }, answer('explain')),
      shop ? Object.assign({ text: 'I just want to buy something.' }, answer('buy')) : null,
      Object.assign({ text: 'Watch your mouth.' }, answer('threat')),
      { text: '(Walk away.)', next: null },
    ].filter(Boolean),
  };
};
G.DIALOGUE_NODES._ck_retort = (r) => {
  const npc = r.npc, k = r.ckLast || 'hi', scene = r.scene;
  // every word makes it worse: some lash out
  const lash = (k === 'threat' ? 0.55 : 0.18) + (npc.def.combat === 'fight' ? 0.2 : npc.def.combat === 'guard' ? 0.5 : 0);
  if (Math.random() < lash) {
    return { text: G.rng.pick(RETORT[k]) + ' ' + G.rng.pick(['That\'s IT!', '*grabs you*', 'You want it? HERE!']), choices: [{ text: '...', next: null, do: () => {
      if (npc.def.combat === 'flee') { npc.say('*spits at you*', 2.5); G.social.addDisp(scene.world, npc.id, -10); if (Math.random() < 0.5) { G.combat.damage(scene.player, 2, npc, scene); } npc.startFlee(scene.player); }
      else { npc.st.hostile = true; npc.aggressor = true; npc.startFight(scene.player, scene); }
    } }] };
  }
  return { text: G.rng.pick(RETORT[k]), choices: [{ text: 'Fine.', next: null }, { text: 'Hear me out...', next: '_ck_angry' }] };
};
const _open = GS.openDialogue;
GS.openDialogue = function (npc, tree) {
  if (this.world.flags.childKiller && !npc.remote && tree !== '_arrest' && !(G.ko && G.ko.brain(npc.st))) {
    if (npc.def.kid) { npc.say('*runs away screaming*', 3); npc.startFlee(this.player); return; }
    const r = _open.call(this, npc, tree);
    const top = G.scenes.top();
    if (top && top.runner && top.runner.npc === npc) top.runner.go('_ck_angry');
    return r;
  }
  return _open.call(this, npc, tree);
};
if (G.chat && G.chat.reply) { const _cr = G.chat.reply; G.chat.reply = function (runner, raw) { if (runner.scene.world.flags.childKiller && !runner.npc.def.kid && !(G.ko && G.ko.brain(runner.npc.st))) return { text: G.rng.pick(ANGRY) }; return _cr.apply(this, arguments); }; }
// they will not text you anymore either
if (G.phone) { const _q = G.phone.queue; G.phone.queue = function (w, from) { if (w.flags.childKiller) return; return _q.apply(this, arguments); }; }
const _gOnHit = G.gore.onHit, _gOnDeath = G.gore.onDeath;
G.gore.onHit = function (scene, target) { if (isKid(target)) return; return _gOnHit.apply(this, arguments); };
G.gore.onDeath = function (scene, actor) { if (isKid(actor)) return; return _gOnDeath.apply(this, arguments); };

// ---- drawn smaller ----
const NP = G.NPC.prototype, _draw = NP.draw;
NP.draw = function (ctx) {
  if (!this.def.kid) return _draw.call(this, ctx);
  const s = this.def.kid === 'teen' ? 0.88 : 0.72;
  ctx.save(); ctx.translate(this.x, this.y); ctx.scale(s, s); ctx.translate(-this.x, -this.y);
  _draw.call(this, ctx);
  ctx.restore();
};

// ---- keep them out of adult systems ----
if (G.love) {
  const _conceive = G.love.conceive;
  G.love.conceive = function (w, a, b, chance) { if ((G.NPCS[a] && G.NPCS[a].kid) || (G.NPCS[b] && G.NPCS[b].kid)) return false; return _conceive.call(this, w, a, b, chance); };
  const _tryStart = G.love.tryStart;
  G.love.tryStart = function (npc, scene) { if (npc.def.kid) return; return _tryStart.call(this, npc, scene); };
}
})();
