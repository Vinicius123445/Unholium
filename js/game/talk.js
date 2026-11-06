'use strict';
// Conversation that matters.
//   Radiant options: every day each person offers a few new things to talk about — their hobby, their
//   worries, their dream, food, where they are from, gossip, a compliment, some teasing. Whether it lands
//   depends on their personality and on how they feel about you: teasing delights chatty people and wounds
//   nervous ones; asking about worries touches the anxious and annoys the proud.
//   Rude options: insults hurt more the more someone cares about you. People get stressed or worried (and
//   say so), proud ones get angry, chatty ones tell everyone, partners eventually leave.
//   Texts: reply options that fit what they actually sent you (plus the usual ones).
//   Drugs: street dealers and gang members sell face to face; dealers also take orders by text.
//   Pregnancy: the mother of your child texts you along the way.
(() => {
const pick = (a) => G.rng.pick(a);
const persona = (id) => G.social.persona(id);
const care = (st) => G.util.clamp(((st.disp || 0) + (st.romance || 0)) / 100, 0, 1.5);

// ---------------------------------------------------------------- radiant topics
const TOPICS = [
  { id: 'hobby', know: 'hobby', ask: 'So what do you do for fun?', text: (P) => `So, still into ${P.hobby}?`, like: ['chatty', 'cheerful', 'friendly', 'proud'], dislike: [],
    good: (P) => [`Are you kidding? ${P.hobby} is my whole life. Thanks for asking!`, `Always! You should try ${P.hobby} sometime.`], bad: () => ['Why do you care?', 'Mm.'] },
  { id: 'worry', know: 'worry', ask: 'Is something on your mind lately?', text: (P) => `You mentioned ${P.you.worry}. Everything okay?`, like: ['nervous', 'tired', 'friendly'], dislike: ['proud', 'suspicious'], cheers: true,
    good: (P) => [`Honestly? Not really. But it helps that someone asked.`, `It is ${P.worry}. Always ${P.worry}. Thank you, really.`], bad: () => ['That is none of your business.', 'I do not want to talk about it.'] },
  { id: 'dream', know: 'dream', ask: 'If you could do anything with your life, what would it be?', text: (P) => `Have you thought more about trying to ${P.you.dream}?`, like: ['cheerful', 'nervous', 'chatty', 'friendly'], dislike: ['grumpy'],
    good: (P) => [`Every day! One day I will ${P.dream}. You will see.`, 'You remembered? That means a lot.'], bad: () => ['Dreams do not pay rent.', 'Do not get my hopes up.'] },
  { id: 'tease', text: () => 'You look like you rolled out of bed. Rough night?', like: ['chatty', 'cheerful'], dislike: ['proud', 'nervous', 'suspicious'], stress: true,
    good: () => ['Ha! Look who is talking.', 'Rough NIGHT? Try rough week. Rough life.'], bad: () => ['Wow. Thanks.', 'Was that supposed to be funny?'] },
  { id: 'compliment', text: () => 'You look great today, by the way.', like: ['nervous', 'cheerful', 'friendly', 'proud', 'tired'], dislike: ['suspicious'], romance: true,
    good: () => ['Oh! Stop it. ...No, keep going.', 'You just made my day.'], bad: () => ['What do you want?', 'Uh huh. Sure.'] },
  { id: 'food', text: (P) => { const f = G.rng.pick(G.PERSONA.foods); return `I could really go for ${/^(my|a|an|the|some) /.test(f) ? f : 'some ' + f} right now.`; }, like: [], dislike: [], foodie: true,
    good: (P) => [`Oh, ${P.food}? Do not get me started. Best thing in the world.`, 'Now I am hungry. Thanks a lot.'], bad: () => ['Cool.', 'I already ate.'] },
  { id: 'origin', reveals: 'origin', text: () => 'So where are you from, originally?', like: ['chatty', 'friendly', 'cheerful'], dislike: ['suspicious'],
    good: (P) => [`Me? I ${P.origin}. Long story. Want to hear it?`, `I ${P.origin}. Never thought I would end up here.`], bad: () => ['Why, are you writing a book?', 'Around.'] },
  { id: 'gossip', text: () => 'Did you hear what people are saying around town?', like: ['chatty', 'suspicious'], dislike: ['proud', 'tired'],
    good: () => ['Tell me EVERYTHING.', 'No way. Who? When?'], bad: () => ['I do not listen to gossip.', 'Some of us have work to do.'] },
  { id: 'help', know: 'worry', needKnow: true, text: (P) => `If you ever need a hand with ${P.you.worry}, call me.`, like: ['nervous', 'friendly', 'tired', 'cheerful', 'chatty'], dislike: ['proud'], cheers: true,
    good: () => ['You mean that? ...Thank you.', 'I might take you up on that.'], bad: () => ['I can handle my own problems.', 'Thanks, but no thanks.'] },
  { id: 'cheer', text: () => 'You seem stressed. Want to talk about it?', like: ['nervous', 'tired', 'friendly', 'cheerful', 'chatty'], dislike: [], onlyMood: true, cheers: true,
    good: () => ['...Yeah. It has been a bad day. Thanks for noticing.', 'You are sweet. I feel a little better.'], bad: () => ['I am FINE.', 'Not with you.'] },
];
// answers when you ask (instead of bringing up something you could not know)
const ASK_ANSWERS = {
  hobby: (P) => [`Me? ${G.util.capitalize(P.hobby)}. Every chance I get.`, `${G.util.capitalize(P.hobby)}, mostly. Do not laugh.`],
  worry: (P) => [`Honestly? ${G.util.capitalize(P.worry)}. It keeps me up at night.`, `It is ${P.worry}. It is always ${P.worry}.`],
  dream: (P) => [`I want to ${P.dream}. Someday.`, `Promise you will not laugh? I want to ${P.dream}.`],
};
const RUDE = [
  { id: 'boring', text: () => 'Has anyone told you you are boring?' },
  { id: 'hobby_mock', know: 'hobby', text: (P) => `Nobody cares about ${P.hobby}, you know.` },
  { id: 'dream_mock', know: 'dream', text: (P) => `You? ${P.you.dream.charAt(0).toUpperCase() + P.you.dream.slice(1)}? Never going to happen.` },
  { id: 'looks', text: () => 'You look terrible. Like, actually terrible.' },
  { id: 'get_lost', text: () => 'Get out of my face.' },
  { id: 'pathetic', text: () => 'You are kind of pathetic, you know that?' },
];
const RUDE_REACT = {
  nervous: (c) => ({ line: c > 0.4 ? pick(['I... I am sorry. I will go.', '*tears up* Why would you say that?']) : pick(['Oh. Okay. Sorry.', 'I... okay.']), disp: -10, mood: 'worried', flee: c > 0.5 }),
  proud: () => ({ line: pick(['Excuse me?! Who do you think you are?', 'Say that again. I dare you.']), disp: -12, angry: true }),
  grumpy: () => Math.random() < 0.15 ? ({ line: 'Ha. Finally, someone honest around here.', disp: 2 }) : ({ line: pick(['Back at you, jerk.', 'Go to hell.']), disp: -6 }),
  cheerful: (c) => ({ line: pick(['Oh... okay. Rough day?', 'Ouch. I will pretend you did not say that.']), disp: -5, mood: c > 0.5 ? 'upset' : null }),
  chatty: () => ({ line: pick(['Wow. Wait until everyone hears about this.', 'Seriously? I was being NICE to you.']), disp: -7, gossip: true }),
  suspicious: () => ({ line: pick(['I knew you were bad news.', 'Mm-hm. Now I know who you really are.']), disp: -8 }),
  tired: () => ({ line: pick(['Whatever.', 'I am too tired to care.']), disp: -3 }),
  friendly: (c) => ({ line: pick(['Wow. That really hurt.', 'I thought we were friends.']), disp: -8, mood: c > 0.3 ? 'stressed' : null }),
};
const usedToday = (st, w) => { if (!st.talkUsed || st.talkUsed.day !== w.day) st.talkUsed = { day: w.day, ids: [] }; return st.talkUsed.ids; };

G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, w = runner.scene.world;
  if (npc.transient || npc.remote || st.fear >= 60 || st.hostile || npc.def.combat === 'guard' && npc.currentEntry(w) && npc.currentEntry(w).act === 'patrol') return [];
  const P = persona(npc.id), used = usedToday(st, w), r = new G.RNG(npc.id + w.day);
  const stressed = st.mood === 'stressed' || st.mood === 'worried' || st.mood === 'upset';
  const knows = (k) => G.rel.knows(st, k);
  const pool = TOPICS.filter((t) => !used.includes(t.id) && !(t.needKnow && !knows(t.know)) && (!t.onlyMood || stressed) && !(npc.def.kid && (t.romance || t.id === 'tease' || t.id === 'gossip')));
  const picks = [];
  if (stressed && pool.find((t) => t.id === 'cheer')) picks.push(pool.find((t) => t.id === 'cheer'));
  while (picks.length < 2 && pool.length) { const t = pool.splice(r.int(0, pool.length - 1), 1)[0]; if (!picks.includes(t)) picks.push(t); }
  const out = picks.map((t) => ({ text: t.know && !knows(t.know) && t.ask ? t.ask : t.text(P), next: '_radiant', do: () => { runner.radiant = t; runner.radiantAsk = !!(t.know && !knows(t.know) && t.ask); return '_radiant'; } }));
  if (!npc.def.kid) {
    const rude = RUDE.filter((x) => !used.includes(x.id) && !(x.know && !knows(x.know)));
    if (rude.length) { const x = rude[r.int(0, rude.length - 1)]; out.push({ text: `(Rude) ${x.text(P)}`, next: '_rude', do: () => { runner.rude = x; return '_rude'; } }); }
  } else out.push({ text: '(Rude) Go away, kid.', next: '_rude_kid' });
  return out;
});
G.DIALOGUE_NODES._radiant = (r) => {
  const { npc } = r, st = npc.st, w = r.scene.world, t = r.radiant, P = persona(npc.id);
  usedToday(st, w).push(t.id);
  let score = 1 + (t.like.includes(P.trait) ? 3 : 0) - (t.dislike.includes(P.trait) ? 4 : 0) + (st.disp || 0) / 50 + (Math.random() * 2 - 1);
  if (t.foodie) score += Math.random() < 0.5 ? 3 : -0.5;
  if (t.id === 'compliment' && G.romance.married(w, npc.id) && !st.partner) score -= 2;
  const good = score >= 2;
  G.social.addDisp(w, npc.id, good ? G.rng.int(3, 6) : -G.rng.int(2, 5));
  if (good && t.romance && (st.romance || 0) > 0) st.romance = Math.min(100, st.romance + 3);
  if (good && t.cheers && st.mood && ['stressed', 'worried', 'upset'].includes(st.mood)) { st.mood = null; st.moodUntil = 0; }
  if (!good && t.stress && P.trait === 'nervous') { st.mood = 'stressed'; st.moodUntil = w.day + 1; }
  if (good && t.id === 'gossip') { const rum = (w.rumors || []).slice(-6); if (rum.length) r.jobMsg = null; }
  let line = pick((good ? t.good : t.bad)(P));
  // asking about something you did not know yet: a good answer tells you (the LifeLog remembers it)
  if (r.radiantAsk) line = good ? pick(ASK_ANSWERS[t.id](P)) : pick(['Why do you want to know?', 'That is kind of personal.', 'I would rather not say.']);
  if (good && (r.radiantAsk || t.reveals)) G.rel.learn(st, t.know || t.reveals);
  return { text: good ? line : line, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
};
G.DIALOGUE_NODES._rude = (r) => {
  const { npc } = r, st = npc.st, w = r.scene.world, P = persona(npc.id), c = care(st);
  usedToday(st, w).push(r.rude.id);
  const res = (RUDE_REACT[P.trait] || RUDE_REACT.friendly)(c);
  const hurt = Math.round(res.disp * (1 + c * 0.6));
  G.social.addDisp(w, npc.id, hurt);
  if ((st.romance || 0) > 0 && res.disp < 0) st.romance = Math.max(0, st.romance + hurt);
  if (res.mood) { st.mood = res.mood; st.moodUntil = w.day + 1 + (c > 0.8 ? 1 : 0); }
  if (res.gossip) { w.rumor(`That stranger was really nasty to ${w.displayName(npc.id)}. Who does that?`, r.scene.region); for (const id in w.npcs) if (G.social.opinion(w, id, npc.id) > 40) G.social.addDisp(w, id, -2); }
  if (st.partner && res.disp < 0) {
    st.rudeCount = (st.rudeCount || []).filter((d) => w.day - d < 7).concat([w.day]);
    if (st.rudeCount.length >= 3) { st.partner = false; st.romance = 5; w.log(`${w.displayName(npc.id)} broke up with you. ("I deserve better than this.")`, 'bad'); return { text: 'You know what? I deserve better than this. We are done.', choices: [{ text: '[Leave]', next: null }] }; }
  }
  const after = [{ text: 'Goodbye.', next: null }];
  if (res.angry && npc.def.combat !== 'flee' && (st.disp || 0) < -30) { npc.aggressor = true; r.after = () => npc.startFight(r.scene.player, r.scene); }
  if (res.flee) r.after = () => { st.fear = Math.max(st.fear || 0, 50); npc.startFlee(r.scene.player); };
  if (r.after) after[0].do = () => r.after();
  return { text: res.line, choices: after };
};
G.DIALOGUE_NODES._rude_kid = (r) => {
  const scene = r.scene;
  const adult = scene.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.canSee(scene, scene.player, 110));
  if (adult) { adult.say('Hey! Do not talk to a kid like that!', 3); G.social.addDisp(scene.world, adult.id, -3); }
  G.social.addDisp(scene.world, r.npc.id, -6);
  return { text: pick(['*sniff* ...You\'re mean.', 'I\'m telling my mom!']), choices: [{ text: '[Leave]', next: null }] };
};
// moods show: a stressed person sighs, a worried one mutters
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  const st = this.st;
  if (st.mood && ['stressed', 'worried', 'upset'].includes(st.mood)) {
    if (st.moodUntil && scene.world.day > st.moodUntil) st.mood = null;
    else if (!this.bark && Math.random() < dt / 40 && !this.talking) this.say(pick(st.mood === 'worried' ? ['I cannot stop thinking about it...', 'What if it goes wrong?'] : st.mood === 'upset' ? ['*sigh*', 'Whatever.'] : ['Ugh. Today...', 'I need a break.', '*deep breath*']), 3);
  }
  return _nu.call(this, dt, scene);
};
// life stresses people out too
G.events.on('hour', () => {
  const w = G.world;
  if (!w || Math.random() < 0.6) return;
  const ids = Object.keys(w.npcs).filter((id) => w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].transient && !w.npcs[id].mood);
  if (!ids.length) return;
  const id = pick(ids), st = w.npcs[id];
  st.mood = pick(['stressed', 'worried']); st.moodUntil = w.day + 1;
});

// ---------------------------------------------------------------- drugs: dealers and gang members
G.DRUG_MENU = [['joint', 10], ['weed', 25], ['cocaine', 70], ['crack', 25], ['heroin', 55], ['magic_mushroom', 35], ['lsd', 40], ['xanax', 12], ['speed_pills', 20], ['edible', 15]];
const menuFor = (npc) => {
  const kind = npc.def.dealer;
  let list = G.DRUG_MENU.filter(([id]) => G.ITEMS[id]);
  if (kind === 'rich') list = list.filter(([id]) => ['cocaine', 'xanax', 'lsd', 'magic_mushroom', 'edible'].includes(id)).map(([id, p]) => [id, Math.round(p * 1.6)]);
  else if (!kind) list = list.filter(([id]) => (npc.st.inv || []).some((e) => e[0] === id && e[1] > 0)).map(([id, p]) => [id, Math.round(p * 1.1)]);
  return list;
};
const sells = (npc) => !npc.def.kid && !npc.transient && (npc.def.dealer || (['gang_red', 'gang_blue', 'punks', 'criminals'].includes(npc.def.faction) && menuFor(npc).length));
G.drugs = {
  buy(scene, npc, id, price) {
    const p = scene.player, w = scene.world;
    if (p.gold < price) { scene.toast('Not enough money.', 'bad'); return false; }
    p.gold -= price; npc.st.gold = (npc.st.gold || 0) + price;
    p.inventory.add(id, 1);
    const e = (npc.st.inv || []).find((x) => x[0] === id); if (e && !npc.def.dealer) e[1]--;
    G.audio.play('coin');
    const cop = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.canSee(scene, p, 110));
    if (cop) { cop.say('Hey! Drug deal! Freeze!', 3); scene.reportCrime('drugs', cop); }
    return true;
  },
  menu(scene, npc) {
    const opts = menuFor(npc).map(([id, price]) => ({ label: `${G.item(id).name} — $${price}`, disabled: scene.player.gold < price, fn: () => { if (this.buy(scene, npc, id, price)) { scene.toast(`Bought ${G.item(id).name}.`, 'good'); this.menu(scene, npc); } } }));
    opts.push({ label: 'That is all.', fn: () => {} });
    G.scenes.push(new G.ChoiceScene(npc.def.dealer ? 'What do you need?' : 'Whatever I got on me', `You have $${scene.player.gold}.`, opts));
  },
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, w = runner.scene.world;
  if (!sells(npc) || st.hostile || st.fear >= 60) return [];
  const out = [{ text: npc.def.dealer ? 'What are you selling?' : 'You holding anything? I am buying.', next: '_buy_drugs' }];
  if (st.order && st.order.day >= w.day - 1) out.unshift({ text: `I am here for the ${G.item(st.order.item).name}. ($${st.order.price})`, next: '_order_pickup' });
  return out;
});
G.DIALOGUE_NODES._buy_drugs = (r) => {
  const { npc } = r, w = r.scene.world, st = npc.st, fac = npc.def.faction;
  if (G.FACTIONS[fac] && G.FACTIONS[fac].listed && w.getRep(fac) < -20) return { text: 'I do not sell to people like you. Beat it.', choices: [{ text: '[Leave]', next: null }] };
  if (!npc.def.dealer && (st.disp || 0) < 0 && Math.random() < 0.6) return { text: 'Do I look like a pharmacy? Get lost.', choices: [{ text: 'Something else...', next: 'start' }] };
  return { text: npc.def.dealer ? pick(['Keep it quiet. What do you need?', 'Cash only. What are you looking for?']) : pick(['Maybe I got a little something. For a price.', 'Fine. But you did not get it from me.']), choices: [{ text: '[See what they have]', next: null, do: () => { G.drugs.menu(r.scene, npc); } }, { text: 'Never mind.', next: 'start' }] };
};
G.DIALOGUE_NODES._order_pickup = (r) => {
  const { npc } = r, o = npc.st.order;
  if (!G.drugs.buy(r.scene, npc, o.item, o.price)) return { text: 'You do not have the money? Come back when you do.', choices: [{ text: 'Something else...', next: 'start' }] };
  npc.st.order = null;
  return { text: pick(['Pleasure doing business.', 'There you go. You did not get it from me.']), choices: [{ text: 'Thanks.', next: null }] };
};

// ---------------------------------------------------------------- texts: topics and fitting replies
const TOPIC_RX = [
  [/pregnant|it is yours|your baby/i, 'pregnant'], [/water broke|baby is coming/i, 'labor'], [/kick|ultrasound|craving|nursery|baby/i, 'baby'],
  [/miss you|thinking about you|thinking of you|<3/i, 'miss'], [/drink|bar at|dinner/i, 'drinks'], [/venting|again\. sorry|ugh\./i, 'venting'],
  [/someday i am going/i, 'dream'], [/did you hear|word is|okay so/i, 'gossip'], [/work for you|call me\.$/i, 'work'],
  [/on my way|leaving now|be there|here!/i, 'onmyway'], [/thanks for|great time|had a great/i, 'thanks'],
  [/not even home|waited|we are done|how could you|dead\.|stay away|deserve better/i, 'angry'], [/and thought of you|doing some/i, 'hobby'],
  [/got you\. come see me|come see me at/i, 'dealer'],
];
const REPLIES = {
  pregnant: [['I am here for you. We will do this together.', 10, 10, 'Really? ...Thank you. I was so scared.'], ['Are you sure it is mine?', -20, -15, 'Wow. WOW. Yes, I am sure.'], ['I need some time to think.', -3, -3, 'Okay. Do not take too long.'], ['I will send money for the doctor. ($100)', 8, 5, 'You do not have to... but thank you.', 100]],
  labor: [['I am on my way!', 6, 6, 'Hurry!!'], ['Good luck!', -2, -4, 'Good LUCK? That is it?']],
  baby: [['That is amazing!', 4, 3, 'I know!! It is real now.'], ['Cool.', -2, -2, '...Cool. Okay.']],
  miss: [['Miss you too <3', 2, 3, 'Come here then.'], ['Come over tonight?', 2, 2, 'I will be there at 8.', 0, 'visit'], ['Clingy much?', -6, -6, 'Wow. Okay. Never mind.']],
  drinks: [['I am in! See you there.', 4, 1, 'Yes! Meet you there.', 0, 'meet'], ['Cannot tonight, sorry.', 0, 0, 'Next time then!'], ['Why would I drink with you?', -6, -3, 'Forget I asked.']],
  venting: [['That sucks. Want to talk about it?', 5, 1, 'Maybe later. It helps that you asked.', 0, 'calm'], ['You will be fine. Hang in there.', 2, 0, 'Thanks. I hope so.'], ['Stop whining.', -7, -4, 'Sorry I bothered you.', 0, 'stress']],
  dream: [['Go for it! I believe in you.', 4, 2, 'You think so? That means a lot.'], ['Haha, sure you will.', -4, -2, '...Right.']],
  gossip: [['No way! Tell me more.', 3, 0, 'Call me. It is too juicy for texting.'], ['I do not care.', -2, 0, 'Fine. Boring.']],
  work: [['I am interested. What is it?', 1, 0, 'Not over text. Come see me.'], ['Not now.', 0, 0, 'Your loss.']],
  onmyway: [['See you soon!', 1, 0, null], ['Take your time.', 1, 0, null]],
  thanks: [['Anytime <3', 2, 2, null], ['It was fun. Let us do it again.', 3, 1, 'Definitely.']],
  angry: [['I am sorry. Let me make it up to you.', 5, 3, 'You better.'], ['Whatever.', -5, -3, 'Wow. Unbelievable.']],
  hobby: [['Sounds fun! Can I join next time?', 3, 1, 'Yes! Next time.'], ['That is so boring.', -4, -2, 'Okay then.']],
};
const ORDERS = [['weed', 'Need some weed.'], ['cocaine', 'Need some coke.'], ['heroin', 'Need H.'], ['magic_mushroom', 'Got shrooms?'], ['lsd', 'Got tabs?'], ['xanax', 'Need some bars. (Xanax)'], ['crack', 'Need rock.']];
G.phone.topicOf = (text) => { for (const [rx, t] of TOPIC_RX) if (rx.test(text)) return t; return null; };
G.phone.answer = function (w, id, rep, scene) {
  const [text, disp, rom, response, cost, act] = rep, st = w.npcs[id];
  if (cost && scene && scene.player.gold < cost) { scene.toast('Not enough money.', 'bad'); return; }
  if (cost && scene) { scene.player.gold -= cost; st.gold = (st.gold || 0) + cost; }
  this.messages(w).push({ from: 'player', to: id, text, day: w.day, min: Math.floor(w.minutes), read: true });
  G.social.addDisp(w, id, disp);
  if ((st.romance || 0) > 0 || rom > 0) st.romance = G.util.clamp((st.romance || 0) + rom, 0, 100);
  if (act === 'visit' && !st.visit) st.visit = { day: w.hour < 19 ? w.day : w.day + 1, from: 20, to: 23 };
  if (act === 'meet' && scene) st.comingTo = { map: scene.map.id, at: G.effects.now() + G.rng.int(30, 80) };
  if (act === 'calm' && st.mood) st.mood = null;
  if (act === 'stress') { st.mood = 'stressed'; st.moodUntil = w.day + 1; }
  if (response) this.queue(w, id, response, G.rng.int(1, 12));
};
G.phone.order = function (w, id, item, scene) {
  const st = w.npcs[id], price = (G.DRUG_MENU.find((x) => x[0] === item) || [item, 30])[1] * (G.NPCS[id].dealer === 'rich' ? 1.6 : 1);
  this.messages(w).push({ from: 'player', to: id, text: (ORDERS.find((o) => o[0] === item) || [, 'Need something.'])[1], day: w.day, min: Math.floor(w.minutes), read: true });
  const spot = G.maps.get(st.map || G.NPCS[id].map).meta.name;
  st.order = { item, price: Math.round(price), day: w.day };
  this.queue(w, id, pick([`Got you. Come see me in ${spot}. $${Math.round(price)}, cash.`, `Bet. Come see me at my spot in ${spot}. $${Math.round(price)}.`]), G.rng.int(2, 15));
  if (scene) scene.toast('Order sent.');
};
const PS = G.PhoneScene.prototype, _rows = PS.rows;
PS.rows = function () {
  if (this.screen !== 'compose') return _rows.call(this);
  const w = this.w, id = this.data, g = this.game;
  const last = G.phone.messages(w).filter((m) => m.from === id).pop();
  const topic = last && (last.topic || G.phone.topicOf(last.text));
  const out = [];
  for (const rep of REPLIES[topic] || []) out.push({ label: rep[0], color: '#ffe08a', act: () => { G.phone.answer(w, id, rep, g); g.toast('Message sent.'); this.back(); } });
  if (G.NPCS[id] && G.NPCS[id].dealer) for (const [item, text] of ORDERS) if (G.ITEMS[item]) out.push({ label: text, color: '#c8a0ff', act: () => { G.phone.order(w, id, item, g); this.back(); } });
  return out.concat(_rows.call(this));
};

// ---------------------------------------------------------------- the mother of your child keeps you posted
const PREG_TEXTS = [[6, 'Doctor says everything looks good. I saw the ultrasound. It is real.'], [14, 'The baby KICKED. Like, actually kicked.'], [22, 'I need pickles and ice cream. Right now. This is your fault.'], [30, 'I started setting up the nursery. Come see?'], [37, 'Any day now. Keep your phone on you.']];
G.events.on('hour', () => {
  const w = G.world;
  if (!w || !G.love) return;
  for (const id in w.npcs) {
    const st = w.npcs[id], pr = st.preg;
    if (!pr || pr.father !== 'player' || !pr.known || !st.alive) continue;
    const d = G.love.days(pr, w);
    pr.texted = pr.texted || [];
    for (const [day, text] of PREG_TEXTS) if (d >= day && !pr.texted.includes(day)) { pr.texted.push(day); G.phone.queue(w, id, text, G.rng.int(1, 30)); break; }
  }
});
})();
