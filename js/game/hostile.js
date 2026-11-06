'use strict';
// Being hostile on purpose. "(Hostile)..." opens a menu of ways to make an enemy: insults (about them,
// their family, their partner, their job, their faction, their looks), mockery, spitting at their feet,
// a shove, threats against them, their family or their home, a challenge to fight, and spreading a lie
// about them around town. Not for children.
//   - Every option costs you their goodwill; how much, and what they do, depends on who they are: fighters
//     swing, proud people get loud, nervous people cry or run, cops arrest you.
//   - Threats roll Intimidation: win and they are scared of you (and stay scared); lose and they are angry.
//   - A shove is physical (a small push, and an assault if a cop sees it). A challenge is a fair fight:
//     whoever accepts it threw in with you, so it is not a crime to fight them.
//   - Slander: a rumor about them spreads; people who hear it think less of them.
(() => {
const pick = (a) => G.rng.pick(a);
const persona = (id) => G.social.persona(id);
const spouseOf = (w, id) => { const r = (G.NPCS[id] && G.NPCS[id].relations) || {}; return Object.keys(r).find((o) => r[o] === 'spouse' && w.isAlive(o)); };
const kidsOf = (w, id) => { const r = (G.NPCS[id] && G.NPCS[id].relations) || {}; return Object.keys(r).filter((o) => (r[o] === 'child' || (G.NPCS[o] && G.NPCS[o].kid && G.NPCS[o].home === G.NPCS[id].home)) && w.isAlive(o)); };

const OPTIONS = [
  { id: 'mother', text: () => 'Your mother was a lot more fun last night than you are right now.', hurt: 14, kind: 'insult' },
  { id: 'job', if: (n) => n.def.job || n.def.shop, text: (n) => `${n.def.shop ? 'This dump you run' : 'Your little job'}? A trained monkey could do it. Better.`, hurt: 10, kind: 'insult' },
  { id: 'partner', if: (n, w) => spouseOf(w, n.id), text: (n, w) => `How does ${w.displayName(spouseOf(w, n.id))} put up with you? Oh wait, they don't. Ask around.`, hurt: 16, kind: 'insult' },
  { id: 'faction', if: (n) => n.faction && n.faction.listed && n.def.faction !== 'civilians', text: (n) => `The ${n.faction.name.replace(/^The /, '')}? Bunch of clowns. You are the saddest one.`, hurt: 12, kind: 'insult', rep: -4 },
  { id: 'looks', text: () => pick(['Did you get dressed in the dark, or is that on purpose?', 'Your face looks like it was assembled from spare parts.', 'Nice outfit. Did you lose a bet?']), hurt: 9, kind: 'insult' },
  { id: 'coward', text: () => 'You talk big, but we both know you would run if I so much as sneezed. Coward.', hurt: 11, kind: 'provoke' },
  { id: 'laugh', text: () => '[Laugh in their face]', hurt: 8, kind: 'insult' },
  { id: 'spit', text: () => '[Spit at their feet]', hurt: 18, kind: 'provoke' },
  { id: 'shove', text: () => '[Shove them]', hurt: 20, kind: 'shove' },
  { id: 'threat', text: () => 'Keep looking at me like that and they will be pulling you out of the river.', hurt: 18, kind: 'threat', diff: 0 },
  { id: 'threat_family', if: (n, w) => spouseOf(w, n.id) || kidsOf(w, n.id).length, text: () => 'Nice family you have. Be a shame if something happened to them.', hurt: 30, kind: 'threat', diff: -1, crime: true },
  { id: 'threat_home', if: (n) => n.def.home, text: () => 'Your house looks very flammable. Sleep with one eye open.', hurt: 25, kind: 'threat', diff: 0, crime: true },
  { id: 'challenge', if: (n) => n.def.combat !== 'guard', text: () => 'You and me. Right here, right now. Let\'s see what you have got.', hurt: 6, kind: 'challenge' },
  { id: 'slander', text: (n, w) => `I am going to tell everyone what you did. Everyone.`, hurt: 15, kind: 'slander' },
];
const usedToday = (st, w) => { if (!st.hostUsed || st.hostUsed.day !== w.day) st.hostUsed = { day: w.day, ids: [] }; return st.hostUsed.ids; };
const avail = (r) => { const { npc, scene } = r, w = scene.world; return OPTIONS.filter((o) => (!o.if || o.if(npc, w)) && !usedToday(npc.st, w).includes(o.id)); };

G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner;
  if (npc.def.kid || npc.transient && !npc.def.faction || npc.remote || (npc.st.fear || 0) >= 80) return [];
  return avail(runner).length ? [{ text: '(Hostile)...', next: '_hostile' }] : [];
});
G.DIALOGUE_NODES._hostile = (r) => ({
  text: pick(['...What?', 'Something on your mind?', 'Yes?', 'Can I help you?']),
  choices: avail(r).map((o) => ({ text: o.text(r.npc, r.scene.world), do: () => { r.hostile = o; return '_hostile_do'; }, next: '_hostile_do' })).concat([{ text: 'Never mind.', next: 'start' }]),
});
const REACT = {   // what they say back, by personality
  nervous: ['W-why would you say that?!', '*backs away*', 'Please, I do not want any trouble.'],
  proud: ['How DARE you.', 'Say that again. I dare you.', 'You have no idea who you are talking to.'],
  grumpy: ['Go to hell.', 'Back at you, jerk.', 'Get out of my face.'],
  cheerful: ['Wow. Okay. That was really uncalled for.', 'Ouch. Bad day?'],
  chatty: ['Oh, everyone is going to hear about this.', 'Unbelievable. UNBELIEVABLE.'],
  suspicious: ['I knew you were trouble.', 'Mm-hm. Now I know exactly who you are.'],
  tired: ['...Seriously? Today?', 'I do not have the energy for you.'],
  friendly: ['I thought we were... okay. Never mind.', 'That really hurt.'],
};
G.DIALOGUE_NODES._hostile_do = (r) => {
  const { npc, scene } = r, w = scene.world, st = npc.st, p = scene.player, o = r.hostile, P = persona(npc.id);
  usedToday(st, w).push(o.id);
  const care = G.util.clamp(((st.disp || 0) + (st.romance || 0)) / 100, 0, 1.5);
  G.social.addDisp(w, npc.id, -Math.round(o.hurt * (1 + care * 0.5)));
  if ((st.romance || 0) > 0) st.romance = Math.max(0, st.romance - o.hurt);
  if (o.rep && npc.def.faction && G.FACTIONS[npc.def.faction] && G.FACTIONS[npc.def.faction].listed) w.addRep(npc.def.faction, o.rep);
  const end = (text, after) => ({ text, choices: [{ text: '[Leave]', next: null, do: after }] });
  const fighter = npc.def.combat === 'fight', cop = npc.def.combat === 'guard';
  const fight = () => { st.hostile = true; npc.aggressor = true; npc.startFight(p, scene); };
  const flee = () => { st.fear = Math.max(st.fear || 0, 70); npc.startFlee(p); };
  // cops do not take it
  if (cop && (o.kind === 'shove' || o.kind === 'threat' || o.kind === 'spit')) {
    return end(pick(['That is it. You are under arrest.', 'Hands behind your back. Now.']), () => { scene.reportCrime(o.kind === 'shove' ? 'assault' : 'extortion', npc); npc.state = 'arrest'; });
  }
  switch (o.kind) {
    case 'shove': {
      const ang = Math.atan2(npc.y - p.y, npc.x - p.x); npc.kbx = Math.cos(ang) * 140; npc.kby = Math.sin(ang) * 140;
      G.audio.play('hit');
      const seenByCop = scene.actors.some((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.canSee(scene, p, 140));
      if (seenByCop) scene.reportCrime('assault', npc);
      if (fighter || P.trait === 'proud' || P.trait === 'grumpy') return end(pick(['Oh, you want to go? Let\'s GO.', 'Big mistake.']), fight);
      return end(pick(['Hey! Get your hands off me!', 'Somebody help!']), flee);
    }
    case 'threat': {
      const ok = G.skills.roll(p, Math.max(1, G.threatDifficulty(npc) + (o.diff || 0)), 'intimidate');
      if (o.crime) scene.reportCrime('extortion', npc);
      if (ok) { st.fear = 100; st.afraidOfPlayer = w.day; return end(pick(['O-okay. Okay! I will stay out of your way!', 'Please. Please, I did not mean anything.', '*goes pale*']), () => { if (!fighter) flee(); }); }
      if (fighter) return end(pick(['You threaten MY family? You are dead.', 'Try it. See what happens.']), fight);
      return end(pick(['I am calling the police.', 'You are insane. Stay away from us!']), () => { flee(); scene.reportCrime('extortion', npc); });
    }
    case 'challenge': {
      if (fighter || (P.trait === 'proud' && (npc.def.combat !== 'flee'))) return end(pick(['Finally. Somebody with guts.', 'Your funeral.', 'Let\'s dance.']), () => { npc.aggressor = true; npc.startFight(p, scene); });
      return end(pick(['I am not fighting you. Are you crazy?', 'No! Leave me alone!']), flee);
    }
    case 'slander': {
      const nm = w.displayName(npc.id);
      w.rumor(pick([`People are saying ${nm} steals from their neighbors.`, `Word is ${nm} has been cheating on everyone they know.`, `Apparently ${nm} rats people out to the cops.`]), scene.region);
      for (const id in w.npcs) if (id !== npc.id && Math.random() < 0.4) { const s2 = w.npcs[id]; s2.op = s2.op || {}; s2.op[npc.id] = G.util.clamp(G.social.opinion(w, id, npc.id) - 12, -100, 100); }   // the lie gets around
      st.mood = 'upset'; st.moodUntil = w.day + 2;
      return end(pick(['You would not dare.', 'Nobody would believe you!', 'Why are you doing this to me?']), () => {});
    }
    case 'provoke':
      if (fighter && (st.disp || 0) < -20) return end(pick(['You know what? Let\'s settle this.', 'That is it.']), fight);
    // fall through
    default: {
      const line = pick(REACT[P.trait] || REACT.friendly);
      if (fighter && (st.disp || 0) <= -50) return end('That is the last thing you say to me.', fight);
      if (P.trait === 'nervous' && care > 0.3) return end(line, flee);
      if (P.trait === 'chatty') w.rumor(`That stranger was nasty to ${w.displayName(npc.id)} for no reason. Who does that?`, scene.region);
      return { text: line, choices: [{ text: '(Hostile)...', next: '_hostile' }, { text: '[Leave]', next: null }] };
    }
  }
};
})();
