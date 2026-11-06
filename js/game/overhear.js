'use strict';
// What people make of what they hear.
//   G.overhear.read: what a sentence is doing (insult, praise, accusation, threat, rumor, something private), how hard,
//   and who it is about: someone named, the person spoken to, a whole faction.
//   G.overhear.listen: one person's take on it. Spoken to them or about them, about someone close, about someone they
//   hate, about their people, or nothing to do with them (then they let it go). Who said it counts, and so do their
//   temperament, mood, loyalty and history. Jack hears himself insulted and comes over; his friend sticks up for him;
//   his enemy laughs; the stranger on the bench does not look up. What matters goes into their memory and changes what
//   they think of the speaker. The hot-headed may do more than talk.
//   G.overhear.cop: police and disrespect: a warning, an arrest, then force, by the officer's temperament.
//   Anything that should happen after a conversation waits for it to end (nobody starts trouble mid-sentence).
(() => {
const clamp = G.util.clamp;
const pick = (a) => G.rng.pick(a);
const TONES = [
  ['threat', 3, /\b(i'?ll|gonna|going to|will) (kill|hurt|shoot|stab|beat|end|destroy|get) (you|him|her|them|that)|\byou'?re dead\b|\bis dead\b|\bor else\b|\bwatch your back\b|\bkill(ing)? (him|her|them)\b/i],
  ['insult', 3, /\b(piece of shit|motherfucker|cunt|scumbag|worthless|pathetic|disgrace|fuck (you|him|her|them|off|the))\b/i],
  ['insult', 2, /\b(asshole|bastard|bitch|prick|dickhead|shithead|scum|moron|trash|garbage|pig|pigs|coward|clown|clowns|fucking)\b/i],
  ['insult', 1, /\b(idiot|stupid|dumb|ugly|loser|fool|jerk|creep|freak|lame|useless|shut up|hate (you|him|her|them)|sucks?|joke)\b/i],
  ['accuse', 2, /\b(is|are|was|you'?re|he'?s|she'?s|they'?re) (a |an |the )?(thief|liar|rat|snitch|cheat|cheater|killer|murderer|crook|traitor|fraud|junkie)\b|\b(stole|steals|killed|lied|cheated|snitched|ratted|betrayed)\b/i],
  ['private', 2, /\b(having an affair|sleeping with|cheating on|pregnant|in debt|owes? (me|him|her|them|money)|addict|on drugs|hooked on|going broke)\b/i],
  ['rumor', 1, /\b(i heard|word is|people say|they say|rumor|apparently|supposedly|did you hear)\b/i],
  ['praise', 2, /\b(the best|a hero|a legend|amazing|wonderful|love (you|him|her|them)|good (man|woman|person|people|cop)|great (guy|man|woman|person|cop))\b/i],
  ['praise', 1, /\b(nice|kind|cool|smart|awesome|good people|respect|thank(s| you)|you look great)\b/i],
];
const SECOND = /\b(you|you'?re|your|ya)\b/i;
const GROUPS = [[/\b(red gang|reds)\b/i, 'gang_red'], [/\b(blue gang|blues)\b/i, 'gang_blue'], [/\b(cops?|police|pigs?|officers?|the government|the mayor)\b/i, 'government'], [/\bpunks?\b/i, 'punks'], [/\b(the elite|rich (people|folks|bastards))\b/i, 'elite'], [/\brevolutionar(y|ies)\b/i, 'revolutionaries'], [/\bgangs?\b/i, '*gang']];

const O = G.overhear = {
  queue: [],
  read(text) {
    const t = String(text);
    for (const [tone, sev, re] of TONES) if (re.test(t)) return { tone, sev };
    return { tone: 'neutral', sev: 0 };
  },
  bad(tone) { return tone === 'threat' || tone === 'insult' || tone === 'accuse' || tone === 'private'; },
  groups(text) {
    const out = [];
    for (const [re, f] of GROUPS) if (re.test(text)) { if (f === '*gang') { if (!out.length) out.push('gang_red', 'gang_blue'); } else out.push(f); }
    return out;
  },
  // how much what is said about `target` touches `a`: above 0 they care, below 0 they are glad, 0 not their business
  stake(w, a, target) {
    if (a.id === target) return { kind: 'self', care: 3 };
    const rel = (a.def.relations || {})[target] || (G.NPCS[target] && (G.NPCS[target].relations || {})[a.id]), op = G.social.opinion(w, a.id, target);
    if (rel === 'spouse') return { kind: 'partner', care: 2.5 };
    if (rel === 'family' || rel === 'child') return { kind: 'family', care: 2.2 };
    if (op >= 45 || rel === 'friend') return { kind: 'friend', care: 1.6 };
    if (op <= -30) return { kind: 'enemy', care: -1 };
    if (a.def.faction && a.def.faction !== 'civilians' && G.NPCS[target] && G.NPCS[target].faction === a.def.faction) return { kind: 'ally', care: 0.8 };
    return { kind: 'none', care: 0 };
  },
  // the listener's take: called for everyone in earshot and for the one spoken to (direct)
  listen(scene, a, speaker, to, text, direct) {
    const w = scene.world, read = this.read(text), player = speaker === scene.player, spId = player ? 'player' : speaker.id;
    const named = G.identity.aboutFor(w, a.id, text).filter((id) => id !== spId);
    // what "you" means depends on who is listening
    const atThem = direct && !named.length && SECOND.test(text);
    let target = named[0] || null;
    if (!target && to && to.kind === 'npc' && SECOND.test(text)) target = to.id;   // said to someone's face, heard by a third
    const groups = this.groups(text);
    if (read.tone === 'neutral' && !named.length) return null;
    if (!target && !groups.length) return null;

    const name = (id) => (id === 'player' ? 'the player' : G.identity.names(w, id).full || 'someone');
    const quote = String(text).replace(/\s+/g, ' ').slice(0, 70), byName = name(spId);
    let stake = target ? this.stake(w, a, target) : { kind: 'none', care: 0 }, group = null;
    if (groups.includes(a.def.faction)) {
      group = a.def.faction;
      const loyal = G.social.persona(a.id).loyalty;
      if (stake.care < 0.8 && read.tone !== 'neutral') stake = loyal < 35 ? { kind: 'lukewarm', care: -0.5 } : { kind: 'group', care: 0.6 + loyal / 100 };
    }
    if (!stake.care) {
      // not their business: it may still stick, if it is juicy enough and they like a story
      const P = G.social.persona(a.id);
      if (read.sev >= 2 && named.length && P.sociable >= 60) G.mem.add(w, a.id, { k: 'heard', t: `I overheard ${byName} say of ${name(target)}: "${quote}"`, by: spId, ab: target, s: 'overheard', f: 0, i: 2, ti: 'rumor' });
      return null;
    }
    const P = G.social.persona(a.id), self = stake.kind === 'self', neg = this.bad(read.tone), pos = read.tone === 'praise';
    const opSpeaker = player ? (a.st.disp || 0) : G.social.opinion(w, a.id, spId);
    const about = self ? 'me' : group && !target ? G.FACTIONS[group].name : name(target);
    // a person they trust saying it counts more; someone they cannot stand less
    const weight = clamp(1 + opSpeaker / 100, 0.5, 1.5);
    const r = { kind: stake.kind, tone: read.tone, sev: read.sev, target, group, direct, atThem };
    G.mem.add(w, a.id, { k: `heard_${read.tone}`, t: `${direct ? 'I heard' : 'I overheard'} ${byName} say ${self ? 'about me' : `about ${about}`}: "${quote}"`, by: spId, ab: target, s: direct || self ? 'did' : 'overheard', r: direct ? 1 : 0.8, f: neg ? -clamp(Math.ceil(read.sev * Math.abs(stake.care) / 1.5), 1, 3) * Math.sign(stake.care) : pos ? Math.sign(stake.care) : 0, i: neg ? clamp(1 + read.sev + (self ? 1 : 0), 1, 5) : 2, ti: self ? 'personal' : 'public', fc: group || undefined });
    if (neg && stake.care > 0) {
      const n = -Math.round(read.sev * stake.care * 3 * weight);
      if (player) G.social.addDisp(w, a.id, n); else G.social.adjust(w, a.id, spId, n);
      if (G.trust && player && stake.care >= 1.5) G.trust.adjust(w, a.id, -1);
      if (G.npcTalk && !player) G.npcTalk.trustAdj(w, a.id, spId, -1);
      G.emo.add(w, a.id, 'anger', read.sev * stake.care * (P.temper / 12));
      if (group && player) G.fmind.nudge(w, group, -1, 'insult');
    } else if (neg && stake.care < 0) {
      if (player) G.social.addDisp(w, a.id, 1); else G.social.adjust(w, a.id, spId, 1);
    } else if (pos && stake.care > 0) {
      const n = Math.round(read.sev * stake.care * weight);
      if (player) G.social.addDisp(w, a.id, n); else G.social.adjust(w, a.id, spId, n);
      if (self) G.emo.add(w, a.id, 'joy', 8);
    } else if (pos && stake.care < 0) { if (player) G.social.addDisp(w, a.id, -1); }
    // and what people say about others colors what you think of them, as far as you believe the one saying it
    if (read.tone === 'accuse' && target && !self && stake.care === 0 && opSpeaker > 20) G.social.adjust(w, a.id, target, -2);
    if (direct) { if (player && a.def.combat === 'guard' && neg && (self || atThem || group === 'government' || target === a.id)) this.cop(scene, a, read, text); return r; }
    // the police take it their own way
    if (player && a.def.combat === 'guard' && neg && (self || group === 'government' || stake.kind === 'ally')) { this.cop(scene, a, read, text); return r; }
    if (G.FACTIONS[a.def.faction] && G.FACTIONS[a.def.faction].covert && group === a.def.faction && !self) return r;   // (a secret member keeps a straight face)
    this.respond(scene, a, speaker, r, quote);
    return r;
  },
  // what they do about it, out loud (and sometimes more)
  respond(scene, a, speaker, r, quote) {
    const w = scene.world, P = G.social.persona(a.id), player = speaker === scene.player, neg = this.bad(r.tone), pos = r.tone === 'praise';
    if (a.talking || a.sleeping || a.state === 'fight' || a.def.kid && r.kind !== 'self') return;
    if (G.loop.time - (a._heardAt || -99) < 8) return;
    // the milder it is and the further from them, the likelier they let it slide
    const shrug = r.kind === 'self' ? 0 : r.kind === 'enemy' || r.kind === 'lukewarm' ? 0.45 : r.kind === 'ally' ? 0.5 : 0.15;
    if (Math.random() < shrug * (P.sociable < 35 ? 1.5 : 1)) return;
    a._heardAt = G.loop.time;
    const emo = G.emo.get(w, a.id), opSp = player ? (a.st.disp || 0) : G.social.opinion(w, a.id, speaker.id);
    const line = this.written(w, a, r, player);
    const e = { kind: 'overheard', text: `heard ${player ? 'the player' : w.npcs[speaker.id].realName} say "${quote}"`, sev: r.sev, heard: true,
      hint: r.kind === 'self' ? 'They are talking about YOU. You know it is you: say "me", never your own name.' : `It is about ${r.target ? G.identity.names(w, r.target).full : G.FACTIONS[r.group].name}${r.kind === 'enemy' || r.kind === 'lukewarm' ? ', whom you do not like: you may enjoy it or agree' : ', who matters to you: you stick up for them'}.` };
    this.bubble(scene, a, e, line);
    if (!player || !neg) return;
    a.faceTowards(speaker);
    // past talk: fighters and the short-tempered, when they care enough and are brave enough
    if (r.kind === 'enemy' || r.kind === 'lukewarm') return;
    const fighter = a.def.combat === 'fight', heat = P.temper + emo.anger + r.sev * 12 + (r.kind === 'self' ? 22 : r.kind === 'partner' || r.kind === 'family' ? 16 : 6) - opSp * 0.35 - P.patience * 0.45 + (r.tone === 'threat' ? 15 : 0);
    if (a.def.combat === 'flee' && P.courage < 55) { if (r.tone === 'threat') { a.st.fear = Math.max(a.st.fear || 0, 40); } return; }
    if (heat >= (fighter ? 58 : 82) && P.courage >= 35 && !a.st.companion) this.later((sc) => { if (a.dead || a.talking) return; a.st.hostile = true; a.aggressor = true; a.startFight(sc.player, sc); G.mem.add(sc.world, a.id, { k: 'fight', t: 'I went for the player over what they said', by: 'player', s: 'did', f: -2, i: 4 }); });
  },
  bubble(scene, a, e, line) {
    const A = G.ai;
    if (A && A.active && A.active() && A.bark && G.aware && !G.aware._busy) {
      G.aware._busy = true;
      A.bark(scene, a, e).then((l) => { G.aware._busy = false; if (!a.dead && !a.talking) a.say(l || line, 4); }, () => { G.aware._busy = false; });
    } else a.say(line, 4);
  },
  written(w, a, r, player) {
    const P = G.social.persona(a.id), name = r.target ? G.identity.names(w, r.target).first : '', neg = this.bad(r.tone), kid = player && P.temper >= 50 ? ', kid' : '', group = r.group ? G.FACTIONS[r.group].name.replace(/^The /, 'the ') : 'them';
    if (r.tone === 'praise') {
      if (r.kind === 'self') return pick(['Hey, thanks. I heard that.', 'Aw. I am right here, you know.', 'Good to know somebody noticed me.']);
      if (r.kind === 'enemy') return pick([`${name}? Please.`, `You do not know ${name} like I do.`]);
      return pick([`${name}? You got that right.`, `Damn right about ${name}.`]);
    }
    if (!neg) return r.kind === 'self' ? pick(['Are you talking about me?', 'Hey, I heard my name.', 'Excuse me? I am right here.']) : pick([`Wait, what about ${name || 'them'}?`, `Hey, what did you just say about ${name || 'them'}?`]);
    switch (r.kind) {
      case 'self': {
        const pool = { grumpy: [`Hey. What's your problem with me${kid}?`, 'You got something to say to me? Say it to my face.'], proud: ['Excuse me? I am standing right here.', 'Say that about me again. Go on.'], nervous: ['W-what did I ever do to you?', 'Why would you say that about me?'], cheerful: ['Wow. I can hear you, you know.', 'Ouch. I am right here.'], tired: ['Yeah, I heard that. Thanks a lot.'], suspicious: ['I heard that. I will remember it.', 'So that is what you say about me.'], chatty: ['Oh, I HEARD that. Who told you that about me?'], friendly: ['Hey. That hurt. What did I do to you?'] };
        return pick(pool[P.trait] || [`Hey, what's your problem with me${kid}?`]);
      }
      case 'partner': return pick([`Hey! That is my partner you are talking about.`, `Say that about ${name} again. I dare you.`]);
      case 'family': return pick([`That is my family. Watch your mouth.`, `Leave ${name} out of it.`]);
      case 'friend': return pick([`Hey. ${name} is a friend of mine.`, `Watch what you say about ${name}.`, `What did ${name} ever do to you?`]);
      case 'ally': return pick([`Careful. ${name} is one of ours.`, `You do not talk about ${name} like that around here.`]);
      case 'group': return pick([`You want to say that about ${group} again?`, `Watch your mouth. I am with ${group}.`, `Careful who you say that around.`]);
      case 'lukewarm': return pick(['Heh. Can\'t argue with that.', 'Do not let the others hear you. But yeah.']);
      case 'enemy': return pick([`Ha! You said it.`, `${name}? Could not agree more.`, `Finally, someone said it.`, `*laughs*`]);
      default: return pick(['Hey, easy.', 'Keep it down.']);
    }
  },

  // ---------------------------------------------------------------- the police
  // By the officer's temperament: how many warnings you get, then an arrest, then force.
  cop(scene, cop, read, text) {
    const w = scene.world, st = cop.st, P = G.social.persona(cop.id);
    const rec = st.warned && st.warned.day === w.day ? st.warned : (st.warned = { day: w.day, n: 0 });
    rec.n += read.sev >= 3 ? 2 : 1;
    const patience = clamp(Math.round(P.patience / 25 - (P.temper - 50) / 40), 0, 3);   // warnings they give before an arrest
    G.emo.add(w, cop.id, 'anger', read.sev * 8);
    const threat = read.tone === 'threat';
    const stage = threat || rec.n > patience + 2 ? 'force' : rec.n > patience ? 'arrest' : 'warn';
    rec.stage = stage;
    if (stage === 'warn') {
      const line = pick({ grumpy: ['Watch your mouth.', 'Keep talking and see what happens.'], proud: ['You will show this badge some respect.', 'You want to spend the night in a cell?'], friendly: ['Hey. Let us keep it civil, alright?', 'Bad day? Do not make it worse.'], tired: ['I am not in the mood. Move along.'], cheerful: ['Easy now. Not a smart thing to say to a cop.'], nervous: ['H-hey. Do not make me do this.'], chatty: ['You know I can arrest you for that?'], suspicious: ['I know your face now. Careful.'] }[P.trait] || ['Watch it.']);
      if (cop.talking) cop._warnLine = line; else cop.say(line, 3.5);
      return 'warn';
    }
    this.later((sc) => {
      if (cop.dead) return;
      if (stage === 'force') { cop.say(pick(['That is it!', 'You asked for it!']), 3); sc.resistArrest(cop); return; }
      w.commitCrime('contempt', sc.region, true, cop.id, 0);
      if (!cop.talking) { cop.say(pick(['That is enough. You are under arrest.', 'Hands behind your back. Now.', 'You just earned yourself a night in a cell.']), 3.5); cop.state = 'arrest'; sc.arrestCooldown = 0; }
    }, cop);
    return stage;
  },

  // ---------------------------------------------------------------- what waits for a quiet moment
  later(fn, npc) { this.queue.push({ fn, npc, t: G.loop.time }); },
  flush(scene) { if (!this.queue.length) return; const q = this.queue; this.queue = []; for (const j of q) { try { j.fn(scene); } catch (e) { G.reportError && G.reportError(e); } } },
};
G.CRIMES.contempt = { label: 'Disrespecting an officer', bounty: 25, rep: -1, tension: 0 };

// conversations end -> what was waiting happens
const GS = G.GameScene.prototype, _upd = GS.update;
GS.update = function (dt) {
  const r = _upd.call(this, dt);
  if (O.queue.length && (G.scenes.top() === this || (G.TalkBarScene && G.scenes.top() instanceof G.TalkBarScene))) O.flush(this);
  return r;
};
})();
