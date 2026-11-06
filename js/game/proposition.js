'use strict';
// Asking anyone for sex, any time ("(Proposition) Want to sleep with me?"). Partners and lovers already have
// "(Make love)" (js/game/love.js); this is for everybody else. Adults only, always.
//   Whether they say yes: how much they like you and how much romance there is, your charisma and luck,
//   their personality (cheerful and chatty people are more up for it, nervous and suspicious ones far less),
//   and whether they are married. A yes is a one-night stand: the same love scene (and its consequences:
//   pregnancy, a jealous spouse finding out).
//   A no from someone who barely knows you is an insult: strangers and new acquaintances get angry (proud
//   and grumpy ones slap you, fighters who already dislike you swing, nervous ones run, chatty ones tell the
//   whole town you are a creep, cops tell you to move along). People who know and like you just turn you
//   down. Ask again the same day and it gets worse.
(() => {
const pick = (a) => G.rng.pick(a);
const TRAIT = { cheerful: 0.1, chatty: 0.08, friendly: 0.03, nervous: -0.15, proud: -0.1, suspicious: -0.15, grumpy: -0.1, tired: -0.05 };
G.proposition = {
  odds(scene, npc) {
    const w = scene.world, st = npc.st, p = scene.player, P = G.social.persona(npc.id);
    const rom = st.romance || 0, disp = st.disp || 0, cha = G.skills.charisma(p), luck = G.skills.stat(p, 'luck') || 0;
    let o = -0.05 + rom / 100 * 0.8 + disp / 100 * 0.4 + (cha - 5) * 0.04 + (TRAIT[P.trait] || 0) + (st.introduced ? 0.05 : 0) + luck * 0.03;
    if (G.love.married(w, npc.id)) o -= 0.3;
    if (st.mood === 'grieving') o -= 0.5;
    if (disp < 0) o -= 0.3;
    return G.util.clamp(o, 0, 0.95);
  },
  // barely knows you: a stranger, someone you have talked to once or twice, or someone who does not like you
  stranger(npc) { const st = npc.st; return !st.introduced || (st.talked || 0) < 3 || (st.disp || 0) < 20; },
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st;
  if (npc.def.kid || npc.transient || npc.remote || (st.fear || 0) >= 60 || st.hostile) return [];
  if (st.partner || (st.romance || 0) >= 60) return [];   // they get "(Make love)" instead
  return [{ text: '(Proposition) Want to sleep with me?', next: '_proposition' }];
});
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_NODES._proposition = (r) => {
  const { npc, scene } = r, w = scene.world, st = npc.st, p = scene.player, P = G.social.persona(npc.id);
  const again = st.propDay === w.day; st.propDay = w.day;
  const yes = !again && Math.random() < G.proposition.odds(scene, npc);
  if (yes) {
    // the things that still stop it: work, a late pregnancy, an audience
    const e = npc.currentEntry(w);
    if (e && e.act === 'work' && npc.def.shop) return { text: '...Maybe. Not while I am working. Come find me later.', choices: BACK, after: () => { st.romance = Math.max(st.romance || 0, 35); } };
    const watched = scene.actors.some((a) => a.kind === 'npc' && a !== npc && !a.dead && !a.sleeping && a.canSee(scene, npc, 110));
    if (watched) { st.romance = Math.max(st.romance || 0, 30); return { text: pick(['Not here. People can see us. ...Somewhere private, though? Yes.', '*glances around* Not with everyone watching. Ask me somewhere quieter.']), choices: BACK }; }
    return {
      text: pick(['...You know what? Yes. Let\'s go.', 'Bold. I like bold. Lead the way.', 'I was hoping you would ask.', 'Just tonight. No promises.']),
      choices: [
        { text: `[Spend the night together]${p.inventory.has('condom') ? ' (use a condom)' : ''}`, next: null, do: () => { st.romance = Math.max(st.romance || 0, 40); G.love.withPlayer(scene, npc); } },
        { text: 'Actually... never mind.', next: 'start' },
      ],
    };
  }
  // no
  if (!G.proposition.stranger(npc) && !again) {
    G.social.addDisp(w, npc.id, -3);
    return { text: pick(['That is sweet. But no. I do not see us like that.', 'Ha. ...No. But I am flattered.', 'Not happening. Let\'s stay friends, okay?']), choices: BACK };
  }
  // a stranger asking: insulted
  const hurt = again ? 25 : 15;
  G.social.addDisp(w, npc.id, -hurt); st.romance = Math.max(0, (st.romance || 0) - 10);
  const end = (text, after) => ({ text, choices: [{ text: '[Leave]', next: null, do: after }] });
  if (npc.def.combat === 'guard') return end(pick(['Excuse me? Move along before I find something to charge you with.', 'I am on duty. Walk away. Now.']), () => {});
  if (npc.def.combat === 'fight' && (st.disp || 0) < -20) return end(pick(['You think you can talk to me like that?', 'Wrong person, creep.']), () => { st.hostile = true; npc.aggressor = true; npc.startFight(p, scene); });
  if (P.trait === 'proud' || P.trait === 'grumpy' || again) return end(pick(['*SLAP* Who do you think you are?!', '*slaps you* Pig.', '*slaps you across the face* Do not ever talk to me again.']), () => {
    G.audio.play('hit'); p.hp = Math.max(1, p.hp - 2); scene.floatText(p.x, p.y - 22, '*slap*', '#ff9a9a'); G.renderer.shake(2);
  });
  if (P.trait === 'nervous') return end(pick(['W-what?! No! Stay away from me!', '*backs away, horrified*']), () => { st.fear = Math.max(st.fear || 0, 60); npc.startFlee(p); });
  if (P.trait === 'chatty') w.rumor(`That stranger asked ${w.displayName(npc.id)} for sex out of nowhere. Total creep.`, scene.region);
  const spouse = G.love.spouseOf ? G.love.spouseOf(w, npc.id) : null;
  if (spouse) { const sp = scene.actors.find((a) => a.id === spouse && !a.dead); if (sp && sp.distTo(npc) < 140) { G.social.addDisp(w, spouse, -30); sp.say('Did you just proposition my spouse?!', 3); } }
  return end(pick(['Excuse me?! We just met!', 'Wow. No. Absolutely not. What is wrong with you?', 'Ew. No. Get away from me.', 'Do I look like that kind of person to you?']), () => {});
};
})();
