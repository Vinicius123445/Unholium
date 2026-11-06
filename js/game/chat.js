'use strict';
// Free-text conversation: type anything to the person you are talking to. The text is matched against
// intents (greetings, questions about them, places, people, factions, drugs, compliments, flirting,
// insults, threats...) and they answer in character: their personality, how they feel about you, their
// faction and what they know. Some answers do things: they tell you their name, put a place on your
// GPS, offer work, open their shop, give you their number, get angry or scared.

G.DIALOGUE_NODES = G.DIALOGUE_NODES || {};

const pickT = (P, byTrait, fallback) => G.rng.pick((byTrait[P.trait] || []).concat(fallback));
const has = (t, re) => re.test(t);

G.chat = {
  // Find a known place or person mentioned in the text.
  findPlace(w, t) {
    let best = null;
    for (const pl of G.phone.places(w)) {
      const name = pl.label.replace(/ \(.*\)$/, '').toLowerCase();
      if (name.length > 2 && t.includes(name) && (!best || name.length > best.n)) best = { pl, n: name.length };
    }
    if (best) return best.pl;
    // generic words: "bar", "store", "gun", "police", "doctor"...
    const words = { bar: 'Bar', pub: 'Bar', drink: 'Bar', gun: 'Gun Store', weapon: 'Gun Store', pharmacy: 'Pharmacy', medicine: 'Pharmacy', doctor: 'Pharmacy', police: 'Police Station', cops: 'Police Station', church: 'Church', motel: 'Motel', diner: 'Diner', food: 'Diner', gas: 'Gas Station', clothes: 'Clothes Store', haircut: 'Barbershop', barber: 'Barbershop', pawn: 'Pawn Shop', jewel: 'Jewelry Boutique', school: 'Elementary School', lake: 'Rural Zone', swim: 'Lake House', hospital: 'Hospital' };
    for (const k in words) if (t.includes(k)) { const pl = G.phone.places(w).find((p) => p.label.startsWith(words[k])); if (pl) return pl; }
    return null;
  },
  findPerson(w, t, self) {
    for (const id in w.npcs) {
      if (id === self || !G.NPCS[id]) continue;
      if (G.identity.refers(w, id, t) && G.identity.knowsOf(w, self, id)) return id;
    }
    return null;
  },
  FACTION_WORDS: [[/\b(red|reds)\b/, 'gang_red'], [/\b(blue|blues)\b/, 'gang_blue'], [/\b(cops?|police|sheriff|government|mayor)\b/, 'government'], [/\bcia\b|\bagents?\b|\bspies\b/, 'cia'], [/\bpunks?\b/, 'punks'], [/\belite\b|\brich (people|folks)\b/, 'elite'], [/\brevolution|\bhooded\b/, 'revolutionaries'], [/\bgangs?\b/, 'gang']],

  reply(runner, raw) {
    const { npc } = runner, w = runner.scene.world, c = runner.c, st = npc.st, p = c.p;
    const t = ' ' + raw.toLowerCase().replace(/[^a-z0-9' ?!]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const P = G.social.persona(npc.id), d = st.disp || 0;
    const me = st.introduced ? st.realName.split(' ')[0] : null;
    const out = (text, extra = {}) => Object.assign({ text }, extra);
    const scared = st.fear >= 60;
    // about someone else ("Jack Dale is an asshole"): that is no threat or insult to this person, whatever they make of it
    const aboutMe = G.identity.refers(w, npc.id, raw), other = !aboutMe && !/\b(you|your|you're|youre)\b/i.test(raw) ? this.findPerson(w, raw, npc.id) : null;
    if (scared && !has(t, /\b(sorry|calm|relax|harm)\b/)) return out(G.rng.pick(['P-please, just leave me alone!', 'I do not want any trouble!', 'Stay away from me!']));

    // --- threats and insults first (tone matters more than content)
    if (!other && has(t, /\b(kill you|hurt you|beat you|shoot you|give me (your|the) (money|cash|wallet)|hand (it )?over|or else|you'?re dead)\b/)) {
      if (npc.def.combat === 'guard') { st.hostile = true; return out('Threatening a police officer? Bad idea.', { end: true, after: () => npc.startFight(p, runner.scene) }); }
      const ok = G.skills.roll(p, G.threatDifficulty(npc), 'intimidate');
      G.social.addDisp(w, npc.id, -20);
      if (ok) { st.fear = 100; const g = st.gold; st.gold = 0; p.gold += g; runner.scene.reportCrime('extortion', npc); return out(g ? `O-okay! Here, $${g}! Just go!` : 'I have nothing! I swear!'); }
      if (npc.def.combat === 'fight') return out('You picked the wrong person.', { end: true, after: () => { st.hostile = true; npc.aggressor = true; } });
      st.fear = 80;
      return out('Help! Somebody call the police!', { end: true, after: () => { npc.startFlee(p); runner.scene.reportCrime('extortion', npc); } });
    }
    if (!other && has(t, /\b(idiot|stupid|ugly|dumb|loser|shut up|fuck|f off|bitch|moron|asshole|hate you|piece of shit|bastard|freak|trash)\b/)) {
      G.social.addDisp(w, npc.id, -10);
      if (npc.def.combat === 'fight' && (st.disp || 0) <= -50) return out(G.rng.pick(['Say that again. I dare you.', 'That is it.']), { end: true, after: () => { st.hostile = true; npc.aggressor = true; } });
      return out(pickT(P, { grumpy: ['Right back at you.', 'Get lost, jerk.'], nervous: ['W-why would you say that?'], proud: ['How dare you.', 'I will not be spoken to like that.'], cheerful: ['Wow. Okay. Rude.'] }, ['Excuse me?', 'Charming. Really.', 'What is your problem?']));
    }
    // --- flirting
    if (has(t, /\b(date|go out with me|kiss|love you|marry me|sexy|gorgeous|hot|beautiful|handsome|cute|crush on you|single)\b/)) {
      const ok = G.skills.roll(p, G.romance.flirtDiff(w, npc), 'charisma');
      G.romance.jealousy(runner.scene, npc);
      if (ok) { st.romance = Math.min(100, (st.romance || 0) + 8); G.social.addDisp(w, npc.id, 3); return out(st.romance >= 50 ? 'You are really something, you know that?' : G.rng.pick(['Ha! Are you flirting with me?', 'Smooth. Very smooth.', 'Well... I do not hate that.'])); }
      G.social.addDisp(w, npc.id, -3);
      return out(G.romance.married(w, npc.id) ? 'I am married, you know.' : G.rng.pick(['Uh... no.', 'Let\'s keep it friendly.', 'Nice try.']));
    }
    // --- compliments, thanks, apologies
    if (has(t, /\b(you('| a)?re|you look) (nice|great|cool|smart|awesome|amazing|kind|funny|the best)\b|\bnice (shirt|hair|outfit|jacket|shoes|place)\b|\bi like you\b/)) {
      G.social.addDisp(w, npc.id, 4);
      return out(pickT(P, { proud: ['I know. But thank you.'], nervous: ['Oh! Um. Thanks...'], grumpy: ['...Thanks, I guess.'] }, ['Aw, thank you!', 'That is nice of you to say.', 'You are not so bad yourself.']));
    }
    if (has(t, /\b(thanks|thank you|thx|cheers)\b/)) return out(G.rng.pick(['You are welcome.', 'No problem.', 'Any time.']));
    if (has(t, /\b(sorry|apologi[sz]e|my bad)\b/)) { if (d < 0) G.social.addDisp(w, npc.id, 3); st.fear = Math.max(0, st.fear - 20); return out(d < -20 ? 'Words are cheap.' : 'It is fine. Forget it.'); }
    // --- leaving
    if (has(t, /\b(bye|goodbye|see you|see ya|later|cya|gotta go)\b/)) return out(G.rng.pick(['See you around.', 'Take care.', 'Bye.']), { end: true });
    // --- about them
    if (has(t, /\b(what('| i)?s your name|who are you|your name)\b/)) {
      if (d <= -40) return out('Why would I tell YOU that?');
      st.introduced = true; G.jobs.onIntroduced(w, npc.id);
      return out(`I'm ${st.realName}.${npc.st.name !== 'Civilian' ? ` ${npc.st.name}.` : ''}`);
    }
    const myName = t.match(/\b(?:my name is|i'?m called|call me) ([a-z]+)/);
    if (myName) { st.playerName = myName[1]; return out(`Nice to meet you, ${G.util.capitalize(myName[1])}.${me ? '' : ` I'm ${st.realName.split(' ')[0]}.`}`, { after: () => { st.introduced = true; } }); }
    if (has(t, /\b(how are you|how'?s it going|how you doing|what'?s up|whats up|sup|how do you feel)\b/)) {
      const mood = d >= 30 ? 'Better now that you are here.' : st.mood === 'grieving' ? 'Not good. Not good at all.' : st.mood === 'homeless' ? 'I lost my home. How do you think?' : null;
      return out(mood || pickT(P, { tired: ['Exhausted. As always.'], cheerful: ['Great! Couldn\'t be better!'], grumpy: ['Same as always. Bad.'], nervous: ['Fine. I think. Why, do I look bad?'] }, [`Honestly? Worried about ${P.worry}.`, 'Can\'t complain. Well, I could.', 'Hanging in there.']));
    }
    if (has(t, /\b(what do you do|your job|for a living|work here|what are you doing)\b/)) return out(npc.def.job || `I'm a ${npc.st.name.toLowerCase()}. It pays the bills. Barely.`);
    // what they tell you, you know from now on (LifeLog > Relationships)
    const learn = (k) => { if (G.rel && d > -40) G.rel.learn(st, k); };
    if (has(t, /\b(hobby|hobbies|free time|for fun|like to do)\b/)) { learn('hobby'); return out(`${G.util.capitalize(P.hobby)}. Any chance I get.`); }
    if (has(t, /\b(where are you from|grow up|grew up|from here)\b/)) { learn('origin'); return out(`I ${P.origin}.`); }
    if (has(t, /\b(dream|want in life|future|goal)\b/)) { learn('dream'); return out(`Someday I want to ${P.dream}.`); }
    if (has(t, /\b(worried|worry|on your mind|bothering you|problem)\b/)) { if (d >= 10) learn('worry'); return out(d >= 10 ? `Honestly? ${G.util.capitalize(P.worry)}.` : 'Nothing I want to talk about with you.'); }
    if (has(t, /\b(food|eat|hungry|favorite meal)\b/)) return out(`${G.util.capitalize(P.food)}. Nothing beats it.`);
    if (has(t, /\b(what do you think (of|about) me|do you like me|are we friends)\b/)) return out(d >= 40 ? 'I like you. A lot, actually.' : d >= 15 ? 'You are alright.' : d <= -30 ? 'Honestly? I do not trust you.' : 'I do not know you well enough yet.');
    // --- requests
    if (has(t, /\b(number|phone|call you|text you|digits)\b/)) { const n = G.DIALOGUE_NODES._number(runner); return out(n.text, n.exchange ? { choices: n.choices } : {}); }   // they ask for yours (js/game/numbers.js)
    if (has(t, /\b(work|job|gig|money to make|hire me|need help|need a hand)\b/)) return out('Work? Let me think...', { choices: [{ text: 'Go on.', next: '_job_offer' }] });
    if (has(t, /\b(buy|sell|shop|wares|trade|selling|price)\b/)) {
      const sid = G.shopSys.shopFor(npc.id, w);
      if (sid && !npc.remote) return out('Sure, take a look.', { choices: [{ text: 'Show me.', do: (cc) => cc.openShop() }] });
      if (has(t, /\b(drugs?|weed|coke|cocaine|crack|heroin|lsd|pills)\b/) && (G.SHOPS.r_dealer.owner === npc.id || npc.def.faction === 'punks')) return out('Keep your voice down. Come look.', { choices: [{ text: 'Show me.', do: (cc) => cc.openShop() }] });
      return out('I am not selling anything. Try the stores.');
    }
    // --- drugs and alcohol
    if (has(t, /\b(drugs?|weed|marijuana|joint|coke|cocaine|crack|heroin|dope|lsd|acid|shrooms?|pills|high)\b/)) {
      if (npc.def.combat === 'guard') { G.social.addDisp(w, npc.id, -5); return out('Are you confessing to something? Careful.'); }
      if (G.GANGS.includes(npc.def.faction) || npc.def.faction === 'punks' || npc.id === 'r_dealer') return out(npc.id === 'r_dealer' || npc.def.faction === 'punks' ? 'Maybe I can help you with that. Ask about my stuff.' : 'Talk to the right people in Southside or the trailer park. Not me.');
      return out(pickT(P, { suspicious: ['Are you a cop?'], nervous: ['I do not know anything about that!'] }, ['That stuff ruins lives. Stay away from it.', 'Not my thing.', 'You should ask someone else.']));
    }
    if (has(t, /\b(drink|beer|booze|alcohol|bar)\b/) && !has(t, /\bwhere\b/)) return out(d >= 30 ? 'A drink? With you? Sure, some time.' : 'The bar downtown is the place for that.');
    // --- time
    if (has(t, /\b(what time|the time|what day|which day)\b/)) return out(`It's ${w.timeString}. Day ${w.day}.`);
    // --- places ("where is...")
    if (has(t, /\b(where|how do i get|directions|find)\b/)) {
      const pl = this.findPlace(w, t);
      if (pl) {
        if (G.phone.has(p)) w.gps = pl;
        return out(`${pl.label.replace(/ \(.*\)$/, '')}? ${pl.map === runner.scene.map.id ? 'It is around here.' : `Over in ${G.maps.get(pl.map).meta.name}.`}${G.phone.has(p) ? ' (Added to Eagle Maps.)' : ''}`);
      }
      const who = this.findPerson(w, raw, npc.id);
      if (who) return out(`${w.displayName(who)}? Try ${G.maps.get(w.npcs[who].map || G.NPCS[who].map).meta.name}.`);
      return out('Where? I am not sure what you mean.');
    }
    // --- other people
    if (aboutMe) return out(pickT(P, { grumpy: ['That is me. What about it?'], nervous: ['M-me? What about me?'], proud: ['Yes. That would be me.'] }, ['That is me. What about me?', 'You are looking at me.']));
    const who = other || this.findPerson(w, raw, npc.id);
    if (who) {
      const op = G.social.opinion(w, npc.id, who), name = w.npcs[who].realName.split(' ')[0];
      if (!w.isAlive(who)) return out(`${name}... is gone. I still cannot believe it.`);
      return out(op >= 60 ? `${name}? I would do anything for ${name}.` : op >= 20 ? `${name} is good people.` : op <= -50 ? `Do not mention ${name} to me.` : op <= -15 ? `${name}? Not a fan.` : `${name}? I do not know them that well.`);
    }
    // --- factions
    for (const [re, f] of this.FACTION_WORDS) {
      if (!has(t, re)) continue;
      const mine = npc.def.faction;
      if (f === 'gang') return out(mine.startsWith('gang') ? `The ${G.FACTIONS[mine].name} runs this. Remember that.` : 'The gangs... they are tearing this city apart.');
      if (f === mine) return npc.faction.covert && !runner.revealsFaction() ? out(npc.faction.cover || 'I do not know what you mean.') : out(`The ${G.FACTIONS[f].name}? That is us. Family.`);
      if (G.factionsAtWar(mine, f)) return out(`The ${G.FACTIONS[f].name}? Scum. Every last one of them.`);
      if (G.FACTIONS[f].covert) return out(G.rng.pick(['People whisper about them. I mind my business.', 'Never heard of them. And I want to keep it that way.']));
      return out(f === 'government' ? (mine === 'government' ? 'We keep this city running.' : 'The cops? They show up when it is too late.') : `The ${G.FACTIONS[f].name}? I stay out of their way.`);
    }
    // --- greetings
    if (has(t, /\b(hi|hello|hey|yo|howdy|good (morning|afternoon|evening))\b/)) return out(runner.greeting());
    if (has(t, /\b(yes|yeah|yep|sure|ok|okay)\b/)) return out(G.rng.pick(['Okay then.', 'Alright.', 'Good.']));
    if (has(t, /\b(no|nope|nah)\b/)) return out(G.rng.pick(['Fine.', 'Suit yourself.', 'Okay...']));
    if (has(t, /\b(help|what can i (say|ask|do))\b/)) return out('You can ask me about myself, the people around here, places, work... or just talk.');
    if (t.includes('?')) return out(pickT(P, { chatty: ['Great question. No idea, though!'], suspicious: ['Why do you want to know?'], tired: ['I do not know. I do not know anything today.'] }, ['Hmm. I do not know about that.', 'No idea, sorry.', 'You are asking the wrong person.']));
    return out(pickT(P, { grumpy: ['What?', 'Make sense or go away.'], friendly: ['Sorry, I did not quite get that.'], nervous: ['I... what?'], chatty: ['Ha! What does that even mean?'] }, ['Huh?', 'I am not sure what you mean.', 'Okay...?']));
  },
};

G.DIALOGUE_NODES._said = (r) => {
  const res = r.chatReply;
  if (res.after) res.after();
  return { text: res.text, choices: (res.choices || []).concat([{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }]) };
};
