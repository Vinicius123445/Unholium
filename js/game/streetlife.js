'use strict';
// Street life: people deal with each other, not just with you.
//   Exchanges: now and then someone walks up to a person nearby and does something people do: bums a
//   cigarette, buys a snack off them, pays back a few bucks, shares a drink, or (dealers and gang members)
//   sells them a bag. What they hand over really moves between their pockets.
//   Drugs are illegal for everyone: a cop who sees a deal busts both sides; dealers who fight back get a
//   fight, everyone else spends a few days in the County Jail (in a cell, in orange) and then goes home.
//   Civilians who see it gossip about it.
//   Offering drugs: you can offer your drugs to anyone; most say no, some buy, and some call the police.
(() => {
const pick = (a) => G.rng.pick(a);
const isCop = (a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard';
const adult = (a) => a.kind === 'npc' && !a.dead && !a.def.kid && !a.transient && !a.remote;
const DRUGS = ['joint', 'weed', 'cocaine', 'crack', 'heroin', 'magic_mushroom', 'lsd', 'xanax', 'speed_pills', 'edible'];

// ---------------------------------------------------------------- jail time for NPCs
const INMATE = (cell) => [
  { from: 22, to: 6, at: `j_cell${cell}_bed`, act: 'sleep' },
  { from: 6, to: 8, at: `j_cell${cell}`, act: 'idle' },
  { from: 8, to: 18, at: 'j_yard', act: 'wander' },
  { from: 18, to: 22, at: `j_cell${cell}`, act: 'idle' },
];
G.streetlife = {
  jail(scene, npc, days) {
    const w = scene.world, st = npc.st;
    if (!w.npcs[npc.id] || npc.transient) { scene.actors = scene.actors.filter((a) => a !== npc); return; }
    st.jailedUntil = w.day + days; st.jailHome = st.jailHome || G.NPCS[npc.id].map;
    st.trip = null; st.companion = false; st.comingTo = null;
    const used = new Set(Object.values(w.npcs).filter((s) => s.jailedUntil).map((s) => s.cell));
    st.cell = [0, 1, 2, 4, 5, 6, 7].find((c) => !used.has(c)); if (st.cell == null) st.cell = 0;
    st.map = 'jail';
    scene.actors = scene.actors.filter((a) => a !== npc);
    w.rumor(`Police picked up ${w.displayName(npc.id)} for drugs. Looking at ${days} days.`, scene.region);
  },
  release(w, scene) {
    for (const id in w.npcs) {
      const st = w.npcs[id];
      if (!st.jailedUntil || w.day < st.jailedUntil || w.hour < 8) continue;
      st.map = st.jailHome || G.NPCS[id].map; st.jailedUntil = null; st.jailHome = null; st.cell = null;
      if (scene) { scene.actors = scene.actors.filter((a) => a.id !== id); if (scene.map.id === st.map) scene.syncPresence(); }
    }
  },
};
const NP = G.NPC.prototype, _list = NP.scheduleList;
// standing still for a moment (dodging, cowering, waiting): still breathing, still hungry
NP.holdTick = function (dt, scene) { this.baseUpdate(dt, scene.map); if (!this.transient && G.needs) G.needs.starve(this, this.st.hunger || 0, this.st.thirst || 0, dt, scene); };
NP.scheduleList = function () { return this.st.jailedUntil && this.st.map === 'jail' ? INMATE(this.st.cell || 0) : _list.call(this); };
const _canTravel = G.travel.canTravel;
G.travel.canTravel = function (id, st, w) { return !st.jailedUntil && _canTravel.call(this, id, st, w); };
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (G.world) G.streetlife.release(G.world, scene);
});

// ---------------------------------------------------------------- a deal goes down
// `seller` sold drugs to `buyer` (both NPCs). Cops who see it bust them; people who see it talk.
G.drugDeal = function (scene, seller, buyer) {
  const w = scene.world;
  const cop = scene.actors.find((a) => isCop(a) && a !== seller && a !== buyer && (a.canSee(scene, seller, 130) || a.canSee(scene, buyer, 130)));
  if (cop) {
    cop.say(pick(['Hands where I can see them! Both of you!', 'Drug deal, right in front of me? Really?', 'Freeze! Police!']), 3);
    for (const n of [seller, buyer]) {
      if (n.def.combat === 'fight' && n.def.combat !== 'guard' && Math.random() < 0.5) { n.say(pick(['Not today, pig!', 'You will never take me!']), 2); cop.startFight(n, scene); n.startFight(cop, scene); continue; }
      n.say(pick(['Okay, okay! I am not resisting!', 'Come on, man...', 'This is not mine, I swear!']), 2);
      cop.bustQueue = (cop.bustQueue || []).concat([n]);
    }
    return true;
  }
  const seen = scene.actors.find((a) => adult(a) && a !== seller && a !== buyer && !a.def.dealer && G.lifestyle.of(a.id) !== 'gang' && a.canSee(scene, seller, 90));
  if (seen && Math.random() < 0.5) {
    seen.say(pick(['Right out in the open. Unbelievable.', 'Is that... a drug deal?', 'This neighborhood...']), 3);
    if (Math.random() < 0.3) w.rumor(`People saw ${w.displayName(seller.id)} selling drugs on the street.`, scene.region);
  }
  return false;
};
// the cop walks over and takes them in, one at a time
const _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.bustQueue && this.bustQueue.length && !this.dead && this.state === 'schedule') {
    const n = this.bustQueue[0];
    if (!n || n.dead || !scene.actors.includes(n) || n.state === 'fight') { this.bustQueue.shift(); return _nu.call(this, dt, scene); }
    n.moving = false; n.bustHeld = 1;
    if (this.distTo(n) < 22) { this.bustQueue.shift(); this.say('You are coming with me.', 2); G.streetlife.jail(scene, n, G.rng.int(2, 4)); return; }
    this.walkTo({ x: Math.floor(n.x / 16), y: Math.floor((n.y - 3) / 16) }, dt, scene, true);
    this.holdTick(dt, scene);
    return;
  }
  if (this.reply && (this.reply.t -= dt) <= 0) { this.say(this.reply.line, 3); this.reply = null; }
  if (this.bustHeld > 0) { this.bustHeld -= dt; this.moving = false; this.holdTick(dt, scene); return; }   // waiting for the cuffs
  if (this.meet && G.streetlife.updateMeet(this, dt, scene)) { this.holdTick(dt, scene); return; }
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- everyday exchanges between people
const EXCHANGES = [
  { id: 'smoke', ok: (a, b) => true, ask: ['Hey, got a smoke?', 'Spare a cigarette?'], yes: ['Here.', 'Last one, make it count.'], no: ['Quit last month. Sorry.', 'Nope.'], price: 0, item: 'cigarettes' },
  { id: 'snack', ok: (a, b) => true, ask: ['Is that a sandwich? I will give you five bucks for it.', 'Sell me that snack?'], yes: ['Deal.', 'Fine, take it.'], no: ['Get your own.', 'No way.'], price: 5, item: 'sandwich' },
  { id: 'loan', ok: (a, b) => G.social.opinion(G.world, a.id, b.id) > 20, ask: ['Here, the twenty I owe you.', 'Paying you back. We are square.'], yes: ['Look at you, paying debts.', 'Thanks!'], no: null, price: -20 },
  { id: 'drink', ok: (a, b) => (G.world.hour >= 17 || G.world.hour < 2) && !['retiree'].includes(G.lifestyle.of(a.id)), ask: ['Want a beer?', 'Drink?'], yes: ['Do not mind if I do.', 'Cheers.'], no: ['I am good.', 'Not tonight.'], price: 0, item: 'beer' },
  { id: 'chat', ok: () => true, ask: ['Hey! How have you been?', 'Long time no see!', 'Did you hear the news?'], yes: ['Same old, same old.', 'Oh, do not get me started.', 'Busy. You?'], no: ['Cannot talk, sorry.'], price: 0 },
  { id: 'deal', ok: (a, b) => (a.def.dealer || G.lifestyle.of(a.id) === 'gang') && b.def.combat !== 'guard' && ['worker', 'rich', 'gang', 'homeless'].includes(G.lifestyle.of(b.id)), ask: ['Psst. Need anything?', 'Got the good stuff today.'], yes: ['Yeah, the usual.', 'Okay, quick.'], no: ['Not from you.', 'Get lost.'], price: 25, drug: true },
];
G.streetlife.EXCHANGES = EXCHANGES;
G.streetlife.updateMeet = function (npc, dt, scene) {
  const m = npc.meet, o = m.with;
  m.t += dt;
  if (!o || o.dead || !scene.actors.includes(o) || o.talking || npc.talking || npc.state !== 'schedule' || m.t > 25 || npc.st.trip || npc.loveTask || o.loveTask) { npc.meet = null; return false; }
  if (npc.distTo(o) > 22) { npc.walkTo({ x: Math.floor(o.x / 16), y: Math.floor((o.y - 3) / 16) }, dt, scene); o.moving = false; o.bustHeld = Math.max(o.bustHeld || 0, 0.3); return true; }
  npc.meet = null; npc.moving = false; npc.faceTowards(o); o.faceTowards(npc);
  this.exchange(scene, npc, o, m.x);
  return true;
};
G.streetlife.exchange = function (scene, a, b, x) {
  const sa = a.st, sb = b.st, like = G.social.opinion(scene.world, b.id, a.id);
  const yes = x.no == null || Math.random() < 0.55 + like / 200;
  a.say(pick(x.ask), 3);
  b.reply = { t: 0.9, line: pick(yes ? x.yes : x.no) };
  b.bustHeld = 2; a.bustHeld = 2;
  if (!yes) return false;
  sa.gold = sa.gold || 0; sb.gold = sb.gold || 0;
  if (x.price > 0 && sa.gold < x.price && !x.drug) return false;
  if (x.drug) {   // the customer pays the seller
    if (sb.gold < x.price) return false;
    sb.gold -= x.price; sa.gold += x.price; sb.inv = sb.inv || []; sb.inv.push([pick(['joint', 'weed', 'cocaine']), 1]);
    G.drugDeal(scene, a, b);
  } else if (x.price > 0) { sa.gold -= x.price; sb.gold += x.price; if (x.item) (sa.inv = sa.inv || []).push([x.item, 1]); }
  else if (x.price < 0) { const n = Math.min(-x.price, sa.gold); sa.gold -= n; sb.gold += n; }
  else if (x.item) (sb.inv = sb.inv || []).push([x.item, 1]);
  G.social.adjust(scene.world, a.id, b.id, 2); G.social.adjust(scene.world, b.id, a.id, 2);
  return true;
};
G.streetlife.STREET_T = 14;   // seconds between someone deciding to go up to someone
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if ((this.streetT = (this.streetT || G.streetlife.STREET_T) - dt) > 0 || this.world.jail || G.streetlife.off) return r;
  this.streetT = G.streetlife.STREET_T * G.rng.range(0.6, 1.4);
  const free = (a) => adult(a) && a.state === 'schedule' && !a.talking && !a.sleeping && !a.meet && !a.seek && !a.st.companion && !a.st.trip && a.def.combat !== 'guard' && !(a.bustHeld > 0);
  const people = this.actors.filter(free);
  if (people.length < 2) return r;
  const a = pick(people), near = people.filter((b) => b !== a && a.distTo(b) < 140);
  if (!near.length) return r;
  const b = pick(near), opts = EXCHANGES.filter((x) => x.ok(a, b));
  if (opts.length) a.meet = { with: b, x: pick(opts), t: 0 };
  return r;
};

// ---------------------------------------------------------------- you offer drugs to someone
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, p = runner.scene.player;
  if (npc.remote || npc.def.dealer || npc.st.addict) return [];
  const have = DRUGS.filter((id) => G.ITEMS[id] && p.inventory.has(id));
  if (!have.length) return [];
  return [{ text: npc.def.kid ? `(Offer ${G.item(have[0]).name}) Want to try something fun?` : `Want to buy some ${G.item(have[0]).name.toLowerCase()}?`, next: '_offer_drugs', do: () => { runner.offerDrug = have[0]; return '_offer_drugs'; } }];
});
G.DIALOGUE_NODES._offer_drugs = (r) => {
  const { npc, scene } = r, w = scene.world, id = r.offerDrug, st = npc.st, life = G.lifestyle.of(npc.id), P = G.social.persona(npc.id);
  const BYE = [{ text: 'Forget it.', next: null }];
  // cops: that is an arrest
  if (npc.def.combat === 'guard') { npc.say('You just offered drugs to a police officer.', 3); scene.reportCrime('drugs', npc); return { text: 'Did you seriously just offer drugs to a cop? Hands behind your back.', choices: [{ text: '...', next: null }] }; }
  // kids: horrifying, everyone who hears reports it
  if (npc.def.kid) {
    scene.reportCrime('minors', npc); G.social.addDisp(w, npc.id, -20);
    return { text: pick(['My mom says never take stuff from strangers!', 'I am telling!']), choices: [{ text: '[Leave]', next: null, do: () => { npc.st.fear = 80; npc.startFlee(scene.player); } }] };
  }
  const buyers = { gang: 0.5, homeless: 0.35, rich: 0.3, worker: 0.12, farmer: 0.04, retiree: 0.03, shopkeeper: 0.05 };
  const callers = { worker: 0.3, retiree: 0.55, farmer: 0.4, shopkeeper: 0.45, rich: 0.2, homeless: 0.05, gang: 0 };
  const like = G.rel.value(st) / 100;
  if (Math.random() < (buyers[life] || 0.1) + like * 0.2) {
    const price = Math.round((G.addiction.PRICE[id] || 20) * 0.9);
    if ((st.gold || 0) < price) return { text: `I would, but I only have $${st.gold || 0}.`, choices: BYE };
    return { text: pick([`Yeah, alright. $${price}?`, `Keep your voice down. $${price}, okay?`]), choices: [
      { text: `Deal. ($${price})`, next: null, do: () => { scene.player.inventory.remove(id, 1); scene.player.gold += price; st.gold -= price; (st.inv = st.inv || []).push([id, 1]); G.audio.play('coin');
        const cop = scene.actors.find((a) => isCop(a) && a.canSee(scene, scene.player, 110)); if (cop) { cop.say('Hey! Drug deal! Freeze!', 3); scene.reportCrime('drugs', cop); } } },
      ...BYE] };
  }
  G.social.addDisp(w, npc.id, -4);
  if (Math.random() < (callers[life] != null ? callers[life] : 0.25) * (P.trait === 'suspicious' || P.trait === 'proud' ? 1.5 : 1) * (1 - Math.max(0, like))) {
    w.log(`${w.displayName(npc.id)} is calling the police on you for offering drugs.`, 'bad');
    npc.after = () => { npc.say(pick(['Hello, police? Someone is selling drugs out here.', 'I am calling the cops.']), 4); scene.reportCrime('drugs', npc); };
    return { text: pick(['Drugs? Are you out of your mind? I am calling the police.', 'Get away from me. I am calling 911.']), choices: [{ text: '[Leave]', next: null, do: () => npc.after() }] };
  }
  return { text: pick(['No thanks. I do not touch that stuff.', 'Not interested.', 'Get that away from me.', 'Maybe some other time.']), choices: BYE };
};
})();
