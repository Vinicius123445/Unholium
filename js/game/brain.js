'use strict';
// Brain damage, in degrees. Never shown as a number: you find out by talking to them and watching them.
//   Level (st.brain): 1 mild (word-finding trouble, loses the thread), 2 moderate (tangents, repeats
//   themselves, mixes up times and places), 3 severe (fragmented, telegraphic, the wrong words), 4 profound
//   (echoes what you say, invented words, little left of a conversation). From the head trauma that caused it:
//   blows to the head, how savage the beating was, the weapon, a crash landing on the head. Mild and moderate
//   fade over days or weeks; severe and profound are usually for good. Repeated injuries make it worse.
//   Memory of you (st.brainMem): they may have forgotten you did it, remember fragments ("your hands"), take
//   you for someone else (a brother, a friend), or, if it is mild, know exactly who you are.
//   Behavior: the more impaired, the less they flee: many stand there, confused, and let you talk to them.
//   Talking: be understanding, admit you do not understand, or be aggressive. How they take it depends on how
//   impaired they are and who they are (personality, courage, a criminal past): a profoundly impaired man may
//   smile at a threat; a mildly impaired gang member will not.
(() => {
const K = G.ko, NP = G.NPC.prototype, GS = G.GameScene.prototype, w0 = () => G.world;
const lvl = (st) => K.brain(st);
const pick = (a, r) => (r ? r.pick(a) : G.rng.pick(a));

// ---------------------------------------------------------------- how bad
const B = G.brain = {
  // score: head blows + severity + weapon; returns 0 (none) .. 4
  levelFrom(score) { return score < 0.8 ? 0 : score < 2 ? 1 : score < 3.4 ? 2 : score < 5 ? 3 : 4; },
  injure(st, score, by) {
    const prev = lvl(st) || 0;
    let L = this.levelFrom(score + prev * 0.8);   // an injured brain takes the next blow worse
    if (!L) return 0;
    L = Math.max(L, prev);
    st.brain = L;
    st.brainUntil = L <= 1 ? (w0().day + G.rng.int(3, 10)) : L === 2 ? (w0().day + G.rng.int(14, 45)) : (Math.random() < 0.85 ? null : w0().day + G.rng.int(60, 200));
    // what they remember of who did it
    const r = Math.random();
    st.brainMem = !by ? 'none' : L === 1 ? (r < 0.8 ? 'knows' : 'fragment') : L === 2 ? (r < 0.35 ? 'knows' : r < 0.7 ? 'fragment' : 'confuse') : L === 3 ? (r < 0.4 ? 'fragment' : r < 0.7 ? 'confuse' : 'forgot') : (r < 0.25 ? 'confuse' : 'forgot');
    st.brainBy = by || null;
    return L;
  },
  // a name they might take you for: someone they know
  mistakeFor(npc) {
    const rel = (npc.def && npc.def.relations) || {}, w = w0();
    const ids = Object.keys(rel).filter((id) => w.npcs[id]);
    if (ids.length) return w.displayName(G.rng.pick(ids)).split(' ')[0];
    return G.rng.pick(['Danny', 'Mom', 'Uncle Ray', 'the doctor', 'Officer...', 'Michael']);
  },
};
// the wake-up assigns the level (knockout.js decides whether there is brain damage; this decides how much)
const _wake = K.wake;
K.wake = function (scene, a) {
  const ko = a.st && a.st.ko ? Object.assign({}, a.st.ko) : null;
  const r = _wake.apply(this, arguments);
  if (ko && a.koReact && a.koReact.kind === 'brain') {
    const score = (ko.head || 0) * 0.55 + Math.max(0, (ko.sev || 0) - 0.4) * 1.3 + (ko.down || 0) * 0.15 + 0.9;
    const L = B.injure(a.st, score, ko.by);
    if (L >= 3) a.dazeT = 30;
  }
  return r;
};
const _away = K.wakeAway;
K.wakeAway = function (w, id, st) {
  const ko = st.ko ? Object.assign({}, st.ko) : null;
  const had = lvl(st);
  const r = _away.apply(this, arguments);
  if (ko && lvl(st) && lvl(st) !== had) B.injure(st, (ko.head || 0) * 0.55 + Math.max(0, (ko.sev || 0) - 0.4) * 1.3 + 0.9, ko.by);
  return r;
};

// ---------------------------------------------------------------- how they talk
// Real impairment patterns, not random words: anomia and circumlocution (mild), tangents and perseveration
// (moderate), telegraphic speech and paraphasias (severe), echolalia and neologisms (profound).
const THINGS = [['the kettle', 'the thing... for water, you make it hot'], ['my keys', 'the... the metal things, for the door'], ['the bus', 'the big... it stops, people get on'], ['a spoon', 'the... you eat soup with it'], ['my sister', 'the girl, my... same mother'], ['the phone', 'the... it rings, in your pocket'], ['work', 'the place I go. Every day. The place'], ['the window', 'the glass... in the wall']];
const PLACES = ['the hospital', 'my mother\'s house', 'school', 'the church', 'the store', 'the bus stop', 'home'];
const TIMES = ['Tuesday', 'last week', 'this morning', 'when I was little', 'before the... before', 'tomorrow, I think'];
const NEO = ['flimber', 'the dorrow', 'snecking', 'plotch', 'the gristen', 'vandoral', 'moffle', 'trenchwise'];
const PARA = [['door', 'spoon'], ['hand', 'hat'], ['car', 'cat'], ['bread', 'bed'], ['water', 'window'], ['help', 'hello'], ['police', 'please'], ['money', 'mommy']];
B.speak = function (npc, about) {
  const L = lvl(npc.st) || 1, P = G.social ? G.social.persona(npc.id) : {}, tr = P.trait || 'cheerful';
  const th = G.rng.pick(THINGS), place = G.rng.pick(PLACES), time = G.rng.pick(TIMES), ph = G.rng.pick(PARA);
  const flavor = { chatty: 'Oh! ', proud: 'Obviously. ', tired: 'Mm. ', cheerful: 'Ha. ', suspicious: 'Why. ' }[tr] || '';
  if (about && L >= 4 && Math.random() < 0.6) { const ws = about.replace(/[^a-z ']/gi, '').split(' ').filter((x) => x.length > 2); const e = ws.slice(-2).join(' ') || 'yes'; return `${e}... ${e}. ${e}?`; }   // echolalia
  if (L === 1) return flavor + pick([
    `I need to get... ${th[1]}. ${th[0]}. ${th[0]}! Why couldn't I say that?`,
    `Sorry. I was going to say something about ${place}. It's... it was right there.`,
    `My head's been... foggy. I keep losing words. Like ${th[1]}.`,
    `I'm fine. I'm fine. What were we... what was I saying?`,
    `I get tired fast now. And names. Names just go.`,
  ]);
  if (L === 2) return flavor + pick([
    `I went to ${place} ${time}. No. That was... was that ${time}? I went to ${place}.`,
    `${th[0].replace(/^./, (c) => c.toUpperCase())}. I need ${th[0]}. Have you seen ${th[0]}? I need ${th[0]}.`,
    `My mother called. She... no, she's... What day is it? It feels like ${time}.`,
    `You know what's funny? The ${G.rng.pick(['birds', 'lights', 'numbers'])}. They keep... anyway, the ${G.rng.pick(['bus', 'rent', 'dog'])}. I forgot. The ${G.rng.pick(['bus', 'rent', 'dog'])}.`,
    `I have to go to work. I think I have work. Do I still have work?`,
  ]);
  if (L === 3) return pick([
    `Head. Hurts. ${place.replace(/^the /, '')}... no.`,
    `Pass me the ${ph[1]}. The ${ph[1]}. No, the... the ${ph[0]}.`,
    `Want... home. Home is... where?`,
    `${time}. ${time}. Something happened ${time}.`,
    `The ${ph[1]} is... broken. Me. Broken.`,
    `Can't. Words. They go... sideways.`,
  ]);
  return pick([
    `The ${G.rng.pick(NEO)} is ${G.rng.pick(NEO)}ing again.`,
    `Hnn. ${G.rng.pick(NEO)}. Yes. Yes yes.`,
    `${ph[1]}, ${ph[1]}, ${ph[1]}...`,
    `*hums tunelessly* ...the ${G.rng.pick(NEO)}...`,
    `Mm? Mmm. ${G.rng.pick(NEO)}.`,
    '...',
  ]);
};
// what they remember of you (said once in a while, early in a conversation)
B.memoryLine = function (npc, scene) {
  const st = npc.st, mem = st.brainMem, L = lvl(st);
  if (st.brainBy !== 'player') return null;
  if (mem === 'knows') return L <= 1 ? G.rng.pick(['I know who you are. I know what you did to me.', 'You. You did this to my head.']) : 'You... you\'re the one. Aren\'t you? The one who...';
  if (mem === 'fragment') return G.rng.pick(['Your hands. I know your hands from... somewhere.', 'Have we... there was a night. Shouting. Was that you?', 'I see your face and my head hurts. Why does my head hurt?']);
  if (mem === 'confuse') return `${B.mistakeFor(npc)}? Is that you? You came back!`;
  return null;
};

// ---------------------------------------------------------------- the conversation
const courage = (npc) => (npc.def.combat === 'fight' || npc.def.combat === 'guard' ? 2 : 0) + (G.CRIMINAL_FACTIONS || []).includes(npc.def.faction) * 1 + (G.social && G.social.persona(npc.id).trait === 'suspicious' ? 1 : 0);
G.DIALOGUE_NODES._brain = (r) => {
  const npc = r.npc, L = lvl(npc.st) || 1, mem = !r.brainMemSaid && B.memoryLine(npc, r.scene);
  if (mem) r.brainMemSaid = true;
  return {
    text: mem || B.speak(npc, r.brainLast),
    choices: [
      { text: 'Take your time. I\'m listening.', next: '_brain_reply', do: () => { r.brainMood = 'kind'; r.brainLast = 'Take your time. I\'m listening.'; } },
      { text: 'I don\'t understand what you\'re saying.', next: '_brain_reply', do: () => { r.brainMood = 'lost'; r.brainLast = 'I don\'t understand what you\'re saying.'; } },
      { text: L >= 3 ? 'Speak properly, you idiot!' : 'Quit wasting my time. Spit it out!', next: '_brain_reply', do: () => { r.brainMood = 'hostile'; r.brainLast = 'Spit it out, idiot'; } },
      { text: 'Goodbye.', next: null },
    ],
  };
};
G.DIALOGUE_NODES._brain_reply = (r) => {
  const npc = r.npc, st = npc.st, L = lvl(st) || 1, w = r.scene.world, mood = r.brainMood, c = courage(npc);
  const more = [{ text: '...', next: '_brain' }, { text: 'Goodbye.', next: null }];
  if (mood === 'kind') {
    G.social.addDisp(w, npc.id, L <= 2 ? 3 : 1);
    if (L <= 2 && Math.random() < 0.6) return { text: G.rng.pick(['Thank you. People get impatient. I know what I want to say, it just... gets stuck.', 'You\'re kind. Most people walk away now.', 'Okay. Okay. Slowly. I... I like talking to you.']), choices: more };
    if (L === 3 && Math.random() < 0.35) return { text: 'Thank... you. Clear. For a second. Then...', choices: more };
    return { text: B.speak(npc, r.brainLast), choices: more };
  }
  if (mood === 'lost') {
    if (L === 1) return { text: G.rng.pick(['I know! I know. I hear it too. It comes out wrong.', 'Sorry. Sorry. Let me... no. Never mind.']), choices: more };
    if (L === 2) return { text: 'I SAID... ' + B.speak(npc, r.brainLast).replace(/\.\s*$/, '') + '. Like I said.', choices: more };
    if (L === 3) { st.fear = Math.max(st.fear || 0, 25); return { text: G.rng.pick(['No. No. Why... why don\'t you...', '*rubs head hard* Don\'t. Don\'t look at me like that.']), choices: more }; }
    return { text: B.speak(npc, r.brainLast), choices: more };   // echoes it back
  }
  // hostility: understood (or not), by how impaired they are; taken by who they are
  const understands = Math.random() < [0, 0.95, 0.65, 0.3, 0.05][L];
  G.social.addDisp(w, npc.id, understands ? -8 : 0);
  if (!understands) return { text: L >= 4 ? G.rng.pick(['Yes. Yes, the blue one. *smiles*', 'Hello. Hello. Nice day.']) : G.rng.pick(['Okay. Okay. What day is it?', 'Mm. You want... soup?']), choices: more };
  if (c >= 2 && L <= 2) {
    return { text: G.rng.pick(['You think I\'m stupid now? I can still break your jaw.', 'Watch it. My head\'s messed up, my fists aren\'t.']), choices: [{ text: '...', next: null, do: () => { st.hostile = true; npc.aggressor = true; npc.startFight(r.scene.player, r.scene); } }] };
  }
  if (c >= 1) return { text: G.rng.pick(['Don\'t. Don\'t talk to me like that.', 'Back off. I mean it.']), choices: [{ text: 'Goodbye.', next: null }] };
  st.fear = Math.max(st.fear || 0, 80);
  return { text: L >= 3 ? G.rng.pick(['*flinches* No... no hurting... no...', '*starts to cry*']) : G.rng.pick(['Please don\'t hurt me. Please.', 'I didn\'t... I\'m sorry, I\'m sorry...']), choices: [{ text: 'Goodbye.', next: null, do: () => { if (Math.random() < 0.6) npc.startFlee(r.scene.player); } }] };
};
// every conversation with them starts here
const Base = G.DialogueRunner;
class Runner extends Base {
  constructor(npc, scene, treeId) {
    super(npc, scene, treeId);
    if (npc && npc.st && lvl(npc.st) && !npc.dead && treeId !== '_arrest' && treeId !== '_mugging') this.go('_brain');
  }
}
G.DialogueRunner = Runner;
// typed chat: the same way they talk
if (G.chat && G.chat.reply) { const _cr = G.chat.reply; G.chat.reply = function (runner, raw) { const n = runner && runner.npc; if (n && lvl(n.st)) return { text: B.speak(n, raw) }; return _cr.apply(this, arguments); }; }
// unprompted, now and then
const _nu = NP.update;
NP.update = function (dt, scene) {
  const L = this.st && lvl(this.st);
  if (L && !this.dead && !this.talking && !(this.st.ko) && Math.random() < dt / (L >= 3 ? 20 : 45)) this.say(B.speak(this), 3.5);
  return _nu.call(this, dt, scene);
};
// they do not always run: confused, they stand there (and can be talked to)
const _flee = NP.startFlee;
NP.startFlee = function (threat) {
  const L = this.st && lvl(this.st);
  if (L >= 2 && !this.dead && Math.random() < [0, 0, 0.45, 0.65, 0.85][L]) { this.state = 'schedule'; this.target = null; this.dazeT = Math.max(this.dazeT || 0, 8); if (Math.random() < 0.5) this.say(L >= 3 ? G.rng.pick(['...?', 'Huh? What?', 'Who... who are you?']) : 'Wait... what\'s happening?', 2.5); return; }
  return _flee.apply(this, arguments);
};
const _talk = GS.talkTo;
GS.talkTo = function (npc) { if (npc && !npc.dead && npc.st && lvl(npc.st) >= 2 && npc.state === 'flee') { npc.state = 'schedule'; npc.target = null; } return _talk.apply(this, arguments); };
// the phone: the moderately impaired still text (badly); the severe no longer use it (knockout.js stops level 2+ there: re-scale)
if (G.phone) {
  const _q = G.phone.queue;
  G.phone.queue = function (w, from, text, delay) {
    const st = w.npcs && w.npcs[from], L = st && lvl(st);
    if (L >= 3) return;
    if (L === 2) text = text.split(' ').map((x, i) => (i % 4 === 3 ? x + ' ' + x : x)).join(' ') + ' sorry. words';
    return _q.call(this, w, from, text, delay);
  };
}
})();
