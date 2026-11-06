'use strict';
// Your companions have limits.
//   Friendly fire: your blows and bullets hit them like anyone else (lock-on never picks them: js/game/combat2.js).
//   A hit does not make them a stranger: they shout, they get angry, and they do not report you or fight back
//   (yet). How angry depends on how it happened: in the middle of a fight with somebody else it is an accident;
//   out of nowhere, or again and again, it is not. Hurtful words do it too (insults, threats, a conversation that
//   goes badly: anything that lowers how much they like you while they are with you).
//   st.compAnger 0..100 cools down by itself every hour (faster for people who like you).
//     LEAVE  : they quit the party, and will not come with you again for a few days.
//     ATTACK : they quit and turn on you (fighters), or run (the timid). Your partner too, if you push that far.
//   The AI dialogue knows how angry they are and may make them quit ("leave_party", js/game/aidialogue.js).
(() => {
const clamp = G.util.clamp;
const LEAVE = 55, ATTACK = 85, BAN_DAYS = 3;
const game = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const nowMin = (w) => w.day * 1440 + w.minutes;

const CM = G.companionMood = {
  LEAVE, ATTACK, BAN_DAYS,
  anger(st) { return (st && st.compAnger) || 0; },
  // more anger, for a reason; then they may decide they have had enough
  provoke(scene, npc, n, why) {
    const st = npc.st;
    if (!st || npc.dead || !n) return;
    st.compAnger = clamp((st.compAnger || 0) + n, 0, 100);
    st.compAngerWhy = why;
    this.check(scene, npc);
  },
  check(scene, npc) {
    const st = npc.st, a = this.anger(st);
    if (!st.companion || npc.dead) return;
    const hates = (st.disp || 0) <= -20;
    if (a >= ATTACK || (a >= LEAVE + 15 && (st.disp || 0) <= -50)) this.leave(scene, npc, true);
    else if (a >= LEAVE || (hates && a >= 25)) this.leave(scene, npc, false);
  },
  // they quit (and maybe turn on you)
  leave(scene, npc, attack, line) {
    const st = npc.st, w = scene.world, p = scene.player, name = w.displayName(npc.id);
    // mid-conversation: it ends there
    const talk = G.scenes.stack.find((s) => s.runner && s.runner.npc === npc && !s.runner.ended);
    if (talk) { talk.runner.end(); if (G.scenes.stack.includes(talk)) G.scenes.remove(talk); npc.talking = false; }
    G.companions.dismiss(scene, npc);
    st.goingHome = false;   // (they storm off on their own schedule, or stay to fight)
    st.compBanUntil = w.day + BAN_DAYS;
    G.social.addDisp(w, npc.id, -10);
    if (G.trust) G.trust.adjust(w, npc.id, -10);
    (st.aiMemory = st.aiMemory || []).push({ text: attack ? 'turned on the player after being pushed too far' : `left the player's party (${st.compAngerWhy || 'fed up'})`, day: w.day });
    st.aiMemory = st.aiMemory.slice(-5);
    if (attack && npc.def.combat !== 'flee') {
      npc.say(line || G.rng.pick(['That is IT. You want a fight? You got one!', 'I trusted you. Big mistake. YOURS.', 'Enough! I am done taking this from you!']), 4);
      st.hostile = true; npc.aggressor = true;
      npc.startFight(p, scene);
      w.log(`${name} turned on you.`, 'bad');
      scene.toast(`${name} turned on you!`, 'bad');
    } else if (attack) {
      npc.say(line || G.rng.pick(['Get away from me! You are insane!', 'Do not come near me ever again!']), 4);
      st.fear = Math.max(st.fear || 0, 70);
      npc.startFlee(p);
      w.log(`${name} ran away from you.`, 'bad');
      scene.toast(`${name} ran from you.`, 'bad');
    } else {
      npc.say(line || G.rng.pick(['I am done. Find someone else to follow you around.', 'You know what? I am out. Do not call me.', 'I do not need this. I am going home.']), 4);
      st.goingHome = scene.map.id !== npc.def.map; npc.goHomeT = 6;
      w.log(`${name} left your party.`, 'warn');
      scene.toast(`${name} left your party.`, 'warn');
    }
  },
  // the hit itself: what they shout, how angry it makes them
  hit(scene, npc, dmg) {
    const st = npc.st, p = scene.player, now = G.loop.time;
    const busy = scene.actors.some((a) => !a.dead && a !== npc && a.kind !== 'player' && a.state === 'fight' && (a.target === p || a.target === npc));   // a fight going on: likely an accident
    const again = st._lastFF && now - st._lastFF < 6;
    st._lastFF = now;
    let n = 8 + dmg * 1.2;
    if (busy) n *= 0.5;
    if (again) n += 14;
    if (!busy && !again) n *= 1.4;
    if (st.partner) n *= 0.85;
    G.social.addDisp(scene.world, npc.id, -Math.round(busy ? 2 : 5));
    this.provoke(scene, npc, Math.round(n), busy ? 'hit them in a fight' : 'hit them for no reason');
    if (st.companion && !npc.dead) npc.say(this.anger(st) >= 40 ? G.rng.pick(['Hit me ONE more time...', 'Do that again and see what happens.', 'Are you out of your mind?!']) : busy ? G.rng.pick(['Watch it! I am on your side!', 'Hey! Aim at THEM!', 'Ow! Careful!']) : G.rng.pick(['Hey! What was that for?!', 'Ow! What is wrong with you?', 'Did you just hit me?!']), 3);
  },
  // words: a while with them, a drop in how much they like you makes them angry too
  words(npc, n) {
    const sc = game(); if (!sc || !npc || !npc.st.companion || n >= 0) return;
    this.provoke(sc, npc, Math.round(-n * 2.2), 'what the player said');
  },
};

// ---------------------------------------------------------------- coming along (asked in your own words, js/game/aidialogue.js)
// -> null if they could come with you now, or why not. persuaded: you gave them a good reason (the AI judged it),
// which is enough for someone who does not dislike you and trusts you a little; otherwise they have to like you.
CM.joinRefusal = function (scene, npc, persuaded) {
  const st = npc.st, w = scene.world, d = npc.def, e = npc.currentEntry && npc.currentEntry(w);
  if (st.companion) return 'already with you';
  if (npc.dead || npc.remote || npc.transient || d.kid) return 'cannot come';
  if (st.hostile || (st.fear || 0) >= 40) return 'afraid of or hostile to the player';
  if (st.compBanUntil && w.day < st.compBanUntil) return 'quit the player\'s party recently and is still upset';
  if (G.companions.list(scene).length >= 3) return 'the player already has a full crew';
  if (e && e.act === 'work' && (d.shop || d.combat === 'guard')) return 'working right now';
  if (w.isNight() && (w.hour >= 23 || w.hour < 6) && !st.partner && (st.disp || 0) < 50) return 'it is the middle of the night';
  if (st.partner || (st.disp || 0) >= 25) return null;
  if (persuaded && (st.disp || 0) >= 0 && (!G.trust || G.trust.of(w, npc.id).v >= 30)) return null;
  return persuaded ? 'does not know or trust the player enough yet' : 'does not like the player enough to just tag along';
};

// ---------------------------------------------------------------- hits
const NP = G.NPC.prototype, _hurt = NP.onHurt;
NP.onHurt = function (source, dmg, scene) {
  if (source && scene && source === scene.player && this.st && this.st.companion && !this.st.hostile) {
    this.sleeping = false;
    CM.hit(scene, this, dmg);
    return;   // (no crime report, no fight, no allies jumping in: they are your friend, for now)
  }
  return _hurt.call(this, source, dmg, scene);
};
// the people with you do not side against you when you hit somebody else
const GS = G.GameScene.prototype, _alert = GS.alertAllies;
GS.alertAllies = function (victim, attacker) {
  if (attacker !== this.player) return _alert.call(this, victim, attacker);
  const keep = this.actors.filter((a) => a.kind === 'npc' && a.st && a.st.companion && !a.st.hostile);
  const saved = keep.map((a) => a.state);
  keep.forEach((a) => { a.state = 'fight'; });   // (alertAllies skips anyone already fighting)
  try { return _alert.call(this, victim, attacker); } finally { keep.forEach((a, i) => { a.state = saved[i]; }); }
};

// ---------------------------------------------------------------- words
const _add = G.social.addDisp;
G.social.addDisp = function (w, id, n) {
  const r = _add.apply(this, arguments);
  if (n < 0 && !CM._inHit) { const sc = game(), npc = sc && sc.actors.find((a) => a.id === id && a.kind === 'npc'); if (npc && npc.st.companion) CM.words(npc, n); }
  return r;
};
// (the drop that comes with a hit is part of the hit, not extra words)
const _hit = CM.hit;
CM.hit = function () { CM._inHit = true; try { return _hit.apply(this, arguments); } finally { CM._inHit = false; } };
const _leave = CM.leave;
CM.leave = function () { CM._inHit = true; try { return _leave.apply(this, arguments); } finally { CM._inHit = false; } };

// ---------------------------------------------------------------- cooling down, and not coming back right away
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  for (const id in w.npcs) { const st = w.npcs[id]; if (st.compAnger) st.compAnger = Math.max(0, st.compAnger - ((st.disp || 0) >= 40 ? 12 : 8)); }
});
const _ask = G.DIALOGUE_NODES._comp_ask;
G.DIALOGUE_NODES._comp_ask = (r) => {
  const st = r.npc.st, w = r.scene.world;
  if (st.compBanUntil && w.day < st.compBanUntil) return { text: G.rng.pick(['After what you did? No. Give it some time.', 'You have got to be kidding me.', 'Not a chance. Not after last time.']), choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
  return _ask(r);
};
// the written way to make up: an apology while they are still with you calms them down a little
G.DIALOGUE_NODES._comp_sorry = (r) => {
  const st = r.npc.st, a = CM.anger(st);
  st.compAnger = Math.max(0, a - (st.partner || (st.disp || 0) >= 40 ? 30 : 18));
  return { text: a >= 40 ? G.rng.pick(['...Fine. But I am not forgetting it.', 'You better mean that.']) : G.rng.pick(['Okay. Just watch it next time.', 'Apology accepted. Mostly.']), choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
};
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.st.companion && CM.anger(runner.npc.st) >= 15 && !runner.npc.remote ? [{ text: 'I am sorry. That was not okay.', next: '_comp_sorry' }] : []));
})();
