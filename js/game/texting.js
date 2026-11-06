'use strict';
// Texting and calling, more like real people.
//   Replies: whether and when someone answers depends on who they are and what they think of you.
//   Chatty friends answer in a minute (sometimes in two or three messages), grumpy or tired people take
//   hours, people asleep answer in the morning, people at work answer later, people who dislike you or who
//   you are spamming may leave you on read. The words fit their personality (and what you asked).
//   They also text you first: plans, gossip, their hobbies and worries, asking for help.
//   Calls: ask where they are, ask them to meet you (they come to you), invite them over, ask for gossip,
//   say "I love you", ask to visit, break up... Calling someone at 3 AM wakes them up. They notice.
(() => {
const P = G.phone;
P.PRESETS = [
  ['hey', 'Hey, what\'s up?'], ['hang', 'Want to hang out?'], ['where', 'Where are you?'], ['drinks', 'Drinks tonight?'],
  ['come', 'Come over to my place later?'], ['news', 'Heard anything interesting?'], ['help', 'I need help.'], ['job', 'Got any work for me?'],
  ['love', 'Thinking of you <3'], ['sorry', 'Sorry about earlier.'], ['lol', 'lol'],
];
// How each personality writes.
const VOICE = {
  chatty: (t) => t + G.rng.pick(['', ' Anyway!! How are YOU?', ' Omg also I have to tell you something later', ' haha']),
  cheerful: (t) => t + G.rng.pick(['!', ' :)', ' :D', '!!']),
  grumpy: (t) => G.rng.pick([t.split('.')[0] + '.', 'k.', t.toLowerCase().replace(/[!?]/g, '.')]),
  tired: (t) => t.toLowerCase().replace(/[!]/g, '') + G.rng.pick(['', ' ...sorry, long day', ' zzz']),
  nervous: (t) => G.rng.pick(['Oh! ', 'Um, ', 'Sorry for the late reply! ']) + t,
  proud: (t) => t + G.rng.pick(['', ' Obviously.', ' I know a guy, by the way.']),
  suspicious: (t) => t + G.rng.pick(['', ' Why do you ask?', ' Who else is reading this?']),
  friendly: (t) => t,
};
const where = (w, id) => {
  const st = w.npcs[id], e = G.beds.entryNow(id, w), mapName = G.maps.get(st.map || G.NPCS[id].map).meta.name;
  if (!e) return `In ${mapName}.`;
  return { sleep: 'In bed. Where else at this hour?', work: `At work, in ${mapName}.`, wander: `Out and about in ${mapName}.`, patrol: `On patrol, ${mapName}.`, idle: `Home. ${mapName}.` }[e.act] || `In ${mapName}.`;
};

P.reply = function (w, id, text) {
  const st = w.npcs[id];
  if (!st) return null;
  const key = (this.PRESETS.find((p) => p[1] === text) || [])[0] || 'hey';
  const d = st.disp || 0, r = st.romance || 0, per = G.social.persona(id);
  if (key === 'love') { if (r >= 20) st.romance = Math.min(100, r + 3); else G.social.addDisp(w, id, d >= 10 ? 0 : -3); }
  if (key === 'sorry' && d < 0) G.social.addDisp(w, id, 4);
  if (key === 'hey') G.social.addDisp(w, id, 1);
  const pick = (a) => G.rng.pick(a);
  let t;
  switch (key) {
    case 'hey': t = d >= 30 ? pick(['Hey you! Not much, you?', 'Heyyy. Just thinking about ' + per.hobby + '. You?', 'Hi! Was just about to text you actually']) : d <= -30 ? pick(['Why are you texting me?', 'Lose my number.']) : pick(['Hey. What\'s up?', 'Hi. Who is this again?', 'Hey.']); break;
    case 'hang': t = d >= 30 || r >= 30 ? pick(['Sure! Come find me, I am around.', 'Yes! Call me and I will meet you.', 'Always. When?']) : d <= -10 ? 'No thanks.' : pick(['Maybe another time.', 'This week is crazy, sorry.']); break;
    case 'where': t = d >= 10 ? where(w, id) : pick(['Why?', 'Around.', 'Somewhere. Why?']); break;
    case 'drinks': t = d >= 25 ? pick(['YES. The bar at 9?', 'I could use a drink. Or five.', 'Only if you are buying.']) : pick(['Not tonight.', 'I do not really drink. Well. I do. Just not with you.']); break;
    case 'come': if (d >= 35 || r >= 30) { if (!st.visit) st.visit = { day: w.hour < 19 ? w.day : w.day + 1, from: 20, to: 23 }; t = pick([`Sure! ${st.visit.day === w.day ? 'Tonight' : 'Tomorrow night'} at 8?`, 'I would love that. 8 PM?']); } else t = pick(['Your place? Let us not.', 'Maybe when I know you better.']); break;
    case 'news': { const rum = (w.rumors || []).slice(-8); t = d >= 15 && rum.length ? pick(['Did you hear? ', 'Okay so. ', 'Word is... ']) + pick(rum).text : pick(['Nothing new around here.', 'Same old, same old.', 'Nope. Boring week.']); break; }
    case 'help': t = d >= 20 ? pick(['What happened? Are you okay? Call me.', 'Where are you? I can come.', 'Oh no. Call me, now.']) : pick(['Sorry, I cannot help right now.', 'Call the police?']); break;
    case 'love': t = r >= 50 ? pick(['<3 Thinking about you too.', 'You are sweet. Miss you.', 'Come here then <3']) : r >= 20 ? pick(['Haha... that is nice of you :)', 'Stop, you are making me blush']) : d >= 0 ? 'Uh... okay?' : 'Please stop.'; break;
    case 'sorry': t = d < 0 ? pick(['I will think about it.', 'Words are cheap.']) : pick(['Do not worry about it.', 'Already forgot about it.']); break;
    case 'job': t = pick(['Call me and we can talk about it.', 'Maybe. Come see me.', 'Might have something. Not over text.']); break;
    default: t = pick(['haha', 'lmao', '?', 'what']);
  }
  return (VOICE[per.trait] || VOICE.friendly)(t);
};

// Will they answer, and when? (minutes)
P.replyPlan = function (w, id) {
  const st = w.npcs[id], per = G.social.persona(id), d = st.disp || 0, r = st.romance || 0;
  const mine = this.messages(w).filter((m) => m.to === id && w.day * 1440 + w.minutes - (m.day * 1440 + m.min) < 90).length;
  let ignore = d < -30 ? 0.8 : d < 0 ? 0.4 : 0.1;
  if (mine >= 4) ignore += 0.4;                     // you are spamming them
  if (per.trait === 'chatty' || r >= 40) ignore -= 0.08;
  if (per.trait === 'grumpy' || per.trait === 'suspicious') ignore += 0.1;
  if (Math.random() < Math.max(0, ignore)) return null;
  let delay = { chatty: [1, 12], cheerful: [3, 30], friendly: [5, 45], nervous: [10, 60], proud: [20, 120], suspicious: [15, 90], grumpy: [30, 240], tired: [40, 300] }[per.trait] || [5, 60];
  if (r >= 40) delay = [1, 10];
  let min = G.rng.int(delay[0], delay[1]);
  const e = G.beds.entryNow(id, w);
  if (e && e.act === 'sleep') { const h = w.hourF; min += Math.round((((8 - h) + 24) % 24) * 60) + G.rng.int(0, 60); }   // they see it in the morning
  else if (e && e.act === 'work') min += G.rng.int(20, 120);
  return { min, double: per.trait === 'chatty' && Math.random() < 0.5, spam: mine >= 4 };
};
P.send = function (w, to, text) {
  this.messages(w).push({ from: 'player', to, text, day: w.day, min: Math.floor(w.minutes), read: true });
  const plan = this.replyPlan(w, to);
  if (!plan) return;
  if (plan.spam && Math.random() < 0.5) { this.queue(w, to, G.rng.pick(['Okay, okay. I see your messages.', 'Can you stop blowing up my phone?', 'I am BUSY.']), plan.min); return; }
  const reply = this.reply(w, to, text);
  if (reply) this.queue(w, to, reply, plan.min);
  if (plan.double) this.queue(w, to, G.rng.pick(['Wait also', 'Oh and!!', 'Sorry, one more thing', 'Call me later?']), plan.min + G.rng.int(1, 4));
};

// They text you first, now and then.
P.hourly = function (w) {
  if (w.hour < 9 || w.hour > 23 || G.rng.chance(0.8)) return;
  const known = this.contacts(w).filter((id) => w.isAlive(id) && (w.npcs[id].disp || 0) >= 10);
  if (!known.length) return;
  const id = G.rng.pick(known), st = w.npcs[id], r = st.romance || 0, per = G.social.persona(id);
  const lines = [];
  if (r >= 40) lines.push('Miss you. Come see me later?', 'Thinking about you <3', 'Dinner tonight? My treat.', 'What are you wearing? ...I mean, is it cold out there?');
  if ((st.disp || 0) >= 30) lines.push('Hey! Want to grab a drink sometime?', 'You will not believe what just happened...', 'How are you holding up?', `I was ${per.hobby === 'fishing' ? 'out fishing' : 'doing some ' + per.hobby} and thought of you. Weird, right?`);
  lines.push(`Ugh. ${per.worry.replace(/^my /, 'My ')} again. Sorry, just venting.`, `Someday I am going to ${per.dream}. Do not laugh.`, 'Did you see the news?');
  const rum = (w.rumors || []).slice(-5);
  if (rum.length) lines.push('Did you hear? ' + G.rng.pick(rum).text);
  if (G.jobs && st.disp >= 20) lines.push('I might have some work for you. Call me.');
  this.queue(w, id, (VOICE[per.trait] || VOICE.friendly)(G.rng.pick(lines)), 1);
};

// ---------------------------------------------------------------- calls
const late = (c) => { const h = c.w.hourF; return h >= 23 || h < 7; };
G.DIALOGUES._phone.start.choices = [
  { text: 'Just calling to chat.', next: '_chat' },
  { text: 'Where are you right now?', next: '_call_where' },
  { text: 'Want to meet up? Come find me.', if: (c) => (c.st.disp || 0) >= 20 || c.st.partner, next: '_call_meet' },
  { text: 'Come over to my place?', if: (c) => !c.st.visit, next: '_invite' },
  { text: 'Can I come over to yours?', if: (c) => G.NPCS[c.npc.id].home && ((c.st.disp || 0) >= 45 || c.st.partner), next: '_visit_them' },
  { text: 'Heard any news?', next: '_call_news' },
  { text: 'Got any work for me?', next: '_job_offer' },
  { text: 'Want to go on a date?', if: (c) => (c.st.romance || 0) >= 25 && !c.st.partner, next: '_date' },
  { text: 'I love you.', if: (c) => c.st.partner || (c.st.romance || 0) >= 60, next: '_call_love' },
  { text: 'Sorry for calling so late.', if: late, next: '_call_late' },
  { text: 'I think we should break up.', if: (c) => c.st.partner, next: '_breakup' },
  { text: 'Bye.', next: null },
];
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Bye.', next: null }];
G.DIALOGUE_NODES._call_where = (r) => ({ text: (r.npc.st.disp || 0) >= 10 ? where(r.scene.world, r.npc.id) : G.rng.pick(['Why do you want to know?', 'Around.']), choices: BACK });
G.DIALOGUE_NODES._call_news = (r) => {
  const rum = (r.scene.world.rumors || []).slice(-8);
  return { text: rum.length ? G.rng.pick(['Okay, so, you did not hear this from me: ', 'Word around town is... ', 'Did you hear? ']) + G.rng.pick(rum).text : 'Honestly? Nothing. This town is dead. Not literally. Well.', choices: BACK };
};
G.DIALOGUE_NODES._call_love = (r) => {
  const st = r.npc.st;
  st.romance = Math.min(100, (st.romance || 0) + 4);
  return { text: st.partner ? G.rng.pick(['I love you too. Come home soon.', 'Say it again.', 'You big softie. I love you too.']) : G.rng.pick(['...Wow. I... I think I do too.', 'Over the PHONE? Tell me to my face.']), choices: BACK };
};
G.DIALOGUE_NODES._call_late = (r) => {
  const st = r.npc.st;
  if (!st.partner) G.social.addDisp(r.scene.world, r.npc.id, -3);
  return { text: st.partner ? 'It is fine. I was awake anyway. Kind of.' : G.rng.pick(['Do you know what time it is?', 'It is THREE in the MORNING.', 'This better be important.']), choices: BACK };
};
G.DIALOGUE_NODES._call_meet = (r) => {
  const w = r.scene.world, st = r.npc.st, e = G.beds.entryNow(r.npc.id, w);
  if (e && e.act === 'work' && (G.NPCS[r.npc.id].shop || G.NPCS[r.npc.id].combat === 'guard')) return { text: 'I am at work. After my shift, maybe.', choices: BACK };
  if (G.companions.list(r.scene).length >= 3) return { text: 'You already have a whole crew with you.', choices: BACK };
  st.comingTo = { map: r.scene.map.id, at: G.effects.now() + G.rng.int(30, 75) };
  return { text: G.rng.pick(['On my way. Give me a bit.', 'Sure. Where are you? ...Okay, I will find you.', 'Be there soon!']), choices: [{ text: 'See you.', next: null }] };
};
// floors are not places on the map app
const _places = P.places;
P.places = function (w) { return _places.call(this, w).filter((pl) => !G.MAPGEN[pl.map] || !/_f\d+$/.test(pl.map)); };
})();
