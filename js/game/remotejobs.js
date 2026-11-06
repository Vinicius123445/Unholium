'use strict';
// Finishing jobs over the phone: once a job is done, call or text the person who gave it ("The job is
// done.") and they pay you by transfer. Jobs where something has to change hands (an item to hand
// over, money to bring back) still need a visit.
(() => {
const J = G.jobs, P = G.phone;

// jobs from this person that are done and can be settled from a distance
J.remoteDone = function (w, giver) {
  return this.active(w).filter((id) => {
    const d = this.def(w, id), r = d.reward || {};
    return d.giver === giver && this.done(w, id) && !r.takeGold && !(r.take && r.take.length);
  });
};
J.needsVisit = function (w, giver) {
  return this.active(w).some((id) => { const d = this.def(w, id), r = d.reward || {}; return d.giver === giver && this.done(w, id) && (r.takeGold || (r.take && r.take.length)); });
};
J.completeRemote = function (scene, id) {
  const w = scene.world, d = this.def(w, id), r = d.reward || {}, p = scene.player;
  w.quests[id].state = 'done';
  p.gold += r.gold || 0;
  const st = w.npcs[d.giver];
  if (st && r.gold) st.gold = Math.max(0, (st.gold || 0) - r.gold);
  if (r.rep && G.FACTIONS[r.rep] && G.FACTIONS[r.rep].listed) w.addRep(r.rep, 6);
  if (r.regionRep) w.addRep(scene.region, r.regionRep);
  G.social.addDisp(w, d.giver, r.disp || 5);
  G.events.emit('xp', r.xp || 20, 'Job');
  w.log(`Job done: ${d.title} (paid by transfer: $${r.gold || 0})`, 'quest');
  G.audio.play('quest');
  return r.gold || 0;
};

// texting: "The job is done."
P.PRESETS.push(['jobdone', 'The job is done.']);
const _reply = P.reply;
P.reply = function (w, id, text) {
  if (text !== 'The job is done.') return _reply.call(this, w, id, text);
  const scene = G.scenes.stack.find((s) => s instanceof G.GameScene);
  const ids = scene ? J.remoteDone(w, id) : [];
  if (ids.length) {
    let paid = 0;
    for (const j of ids) paid += J.completeRemote(scene, j);
    return G.rng.pick([`Saw it. Nice work. Sent you $${paid}.`, `Good. $${paid} is on its way.`, `Knew I could count on you. Transferred $${paid}.`]);
  }
  if (J.needsVisit(w, id)) return G.rng.pick(['Good. Come by and bring what you owe me, then we settle up.', 'Not over text. Come see me with the stuff.']);
  return G.rng.pick(['What job? Nothing is done that I know of.', 'Is it? Does not look done from here.', '??']);
};

// calling: the same, in the call menu
G.DIALOGUES._phone.start.choices.unshift({
  text: 'About the job: it is done.',
  if: (c) => J.remoteDone(c.w, c.npc.id).length > 0 || J.needsVisit(c.w, c.npc.id),
  do: (c) => {
    const ids = J.remoteDone(c.w, c.npc.id);
    let paid = 0;
    for (const j of ids) paid += J.completeRemote(c.scene, j);
    c.npc.st.phoneJobMsg = ids.length ? G.rng.pick([`I heard. Good work. I am sending you $${paid} now.`, `Already? Nice. $${paid}, transferred.`])
      : 'Good. Come see me in person, though. You have something for me.';
    return '_phone_jobdone';
  },
});
G.DIALOGUES._phone._phone_jobdone = {
  text: (c) => c.npc.st.phoneJobMsg || 'Good work.',
  choices: [{ text: 'Anything else?', next: 'start' }, { text: 'Bye.', next: null }],
};
})();
