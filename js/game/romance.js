'use strict';
// Your relationships with people: friendship (st.disp) and romance (st.romance, 0..100).
//   Ask for their number → call and text them.      Flirt (speech check) → romance grows.
//   Romance 25+: ask them on a date ($30, 2 hours).  Romance 70+: ask them to be your partner.
//   Partners text you, are happy to see you, let you sleep at their place... and get jealous if
//   they catch you flirting with someone else. Married people are harder to win over.

G.DIALOGUE_NODES = G.DIALOGUE_NODES || {};
G.DIALOGUE_CHOICES = G.DIALOGUE_CHOICES || [];

G.romance = {
  partner(w) { return Object.keys(w.npcs).find((id) => w.npcs[id].partner && w.npcs[id].alive) || null; },
  married(w, id) { const rel = G.NPCS[id].relations; return Object.keys(rel).some((o) => rel[o] === 'spouse' && w.isAlive(o)); },
  flirtDiff(w, npc) {
    const st = npc.st;
    return Math.round(7 - (st.disp || 0) / 20 - (st.romance || 0) / 25 + (this.married(w, npc.id) ? 3 : 0) + (npc.def.leader ? 1 : 0));
  },
  // A partner who sees you flirting with someone else is not happy about it.
  jealousy(scene, target) {
    const w = scene.world, pid = this.partner(w);
    if (!pid || pid === target.id) return;
    const partner = scene.actors.find((a) => a.id === pid && !a.dead);
    if (!partner || !partner.canSee(scene, scene.player, 120)) return;
    w.npcs[pid].romance = Math.max(0, (w.npcs[pid].romance || 0) - 25);
    G.social.addDisp(w, pid, -15);
    partner.say(G.rng.pick(['Excuse me?! I am RIGHT HERE.', 'Are you serious right now?', 'Unbelievable.']));
  },
};

G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, w = runner.scene.world, c = runner.c, st = npc.st, out = [];
  if (npc.transient || st.fear >= 60) return out;
  if (!npc.remote && !G.phone.isContact(w, npc.id)) out.push({ text: (st.disp || 0) >= 20 ? 'Can I get your number?' : `${c.tag(8)} Can I get your number?`, next: '_number' });
  if (st.partner) {
    out.push({ text: 'Spend some time together. (1 hour)', next: '_together' });
    out.push({ text: 'I think we should break up.', next: '_breakup' });
  } else if ((st.disp || 0) > -30) {
    if (c.canTry('flirt')) out.push({ text: `${c.tag(G.romance.flirtDiff(w, npc))} (Flirt) ${G.rng.pick(['You have beautiful eyes.', 'Do you come here often?', 'I could listen to you all day.'])}`, next: '_flirt' });
    if ((st.romance || 0) >= 25 && !npc.remote) out.push({ text: 'Want to go on a date? ($30)', next: '_date' });
    if ((st.romance || 0) >= 70 && !G.romance.partner(w)) out.push({ text: 'I want to be with you. Be my partner?', next: '_partner' });
  }
  return out;
});

const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];

G.DIALOGUE_NODES._number = (r) => {
  const { npc } = r, w = r.scene.world, c = r.c, st = npc.st;
  if ((st.disp || 0) >= 20 || c.check('number', 8)) {
    G.phone.addContact(w, npc.id);
    return { text: G.rng.pick(['Sure. Here. Do not make me regret it.', 'Yeah, of course! Call me sometime.', 'Okay... here you go.']), choices: BACK };
  }
  G.social.addDisp(w, npc.id, -2);
  return { text: G.rng.pick(['I do not give my number to strangers.', 'Maybe when I know you better.', 'Ha. No.']), choices: BACK };
};

G.DIALOGUE_NODES._flirt = (r) => {
  const { npc } = r, w = r.scene.world, c = r.c, st = npc.st;
  const ok = c.check('flirt', G.romance.flirtDiff(w, npc));
  G.romance.jealousy(r.scene, npc);
  if (ok) {
    st.romance = Math.min(100, (st.romance || 0) + 12);
    G.social.addDisp(w, npc.id, 4);
    const r2 = st.romance;
    return { text: r2 >= 50 ? G.rng.pick(['You always know what to say...', 'Stop it, you are making me blush.']) : G.rng.pick(['Ha! Smooth. I like that.', 'Well, aren\'t you charming.', 'Oh? Tell me more.']), choices: BACK };
  }
  st.romance = Math.max(0, (st.romance || 0) - 4);
  G.social.addDisp(w, npc.id, -3);
  return { text: G.romance.married(w, npc.id) ? 'I am married. Back off.' : G.rng.pick(['Did that line ever work on anyone?', 'Uh... no.', 'Let\'s keep this friendly, okay?']), choices: BACK };
};

G.DIALOGUE_NODES._date = (r) => {
  const { npc } = r, w = r.scene.world, c = r.c, st = npc.st;
  if (c.gold() < 30) return { text: 'A date sounds lovely. When you can afford one.', choices: BACK };
  if ((st.romance || 0) < 25) return { text: 'A date? Let us get to know each other first.', choices: BACK };
  return {
    text: G.rng.pick(['I would love to. Where are we going?', 'Finally! I thought you would never ask.']),
    choices: [
      { text: 'Dinner and drinks. ($30)', do: () => {
        c.pay(30); c.wait(2);
        st.romance = Math.min(100, (st.romance || 0) + 18); G.social.addDisp(w, npc.id, 8);
        c.p.hp = c.p.maxHp; c.p.alcohol += 15;
        w.log(`You went on a date with ${w.displayName(npc.id)}.`, 'good');
        G.events.emit('xp', 15, 'Date');
        r.jobMsg = G.rng.pick(['That was wonderful. Let\'s do it again soon.', 'I had a really good time tonight.', 'You are full of surprises.']);
        return '_job_msg';
      } },
      { text: 'Actually, never mind.', next: 'start' },
    ],
  };
};

G.DIALOGUE_NODES._partner = (r) => {
  const { npc } = r, w = r.scene.world, st = npc.st;
  if (G.romance.married(w, npc.id) && (st.romance || 0) < 90) return { text: 'I... I am married. I cannot. Not yet.', choices: BACK };
  st.partner = true;
  G.phone.addContact(w, npc.id);
  w.log(`You and ${w.displayName(npc.id)} are together now.`, 'quest');
  G.audio.play('quest');
  return { text: G.rng.pick(['Yes. Yes! I was hoping you would ask.', 'I thought you would never ask. Of course.']), choices: BACK };
};

G.DIALOGUE_NODES._together = (r) => {
  const { npc } = r, w = r.scene.world, c = r.c, st = npc.st;
  c.wait(1);
  c.p.hp = Math.min(c.p.maxHp, c.p.hp + 30); c.p.stamina = c.p.maxStamina;
  st.romance = Math.min(100, (st.romance || 0) + 3);
  return { text: G.rng.pick(['That was nice. I needed that.', 'I love these quiet moments with you.', 'Stay a little longer next time.']), choices: BACK };
};

G.DIALOGUE_NODES._breakup = (r) => {
  const { npc } = r, w = r.scene.world, st = npc.st;
  st.partner = false; st.romance = 10;
  G.social.addDisp(w, npc.id, -30);
  w.log(`You broke up with ${w.displayName(npc.id)}.`, 'warn');
  return { text: G.rng.pick(['...Fine. Get out of my sight.', 'I should have known.', 'Wow. Okay. Goodbye, then.']), choices: [{ text: '[Leave]', next: null }] };
};
