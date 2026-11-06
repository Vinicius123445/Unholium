'use strict';
// Talking people down.
//   Someone fighting you (or out for your blood) can be talked to now: [E] opens a standoff. Calm them down
//   (Charisma), scare them off (intimidation), pay them off, or type what you say: with AI dialogue on, the model
//   judges how convincing you are and the game rolls Charisma on it (js/game/aidialogue.js, 'calm'). One try per
//   person per hour. Calmed down, they stop and leave you alone for a couple of hours (a truce), even if their
//   faction usually goes for you on sight.
//   Muggers: saying no is a gamble now. Most of them get violent; some back off, awkwardly (fewer of them when
//   you have a gun out, friends with you, or the nerve to stare them down).
(() => {
const clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const TRUCE = 120;

const P = G.persuade = {
  TRUCE,
  // can this person be talked to while they are against you?
  standoff(scene, npc) {
    if (npc.dead || npc.sleeping || npc.state === 'flee' || npc.def.combat === 'flee' || npc.remote) return false;
    if (npc.def.combat === 'guard') return false;   // (the police: surrender, the arrest talk handles that)
    return npc.state === 'fight' && npc.target === scene.player || npc.isHostileToPlayer(scene);
  },
  canTry(w, npc) { return !(npc.st.calmTry && nowMin(w) - npc.st.calmTry < 60); },
  // a roll to calm them down: strength 0..10 (how good the case is), bonus for paying or a kind word
  calm(scene, npc, strength, o = {}) {
    const w = scene.world, st = npc.st, p = scene.player;
    st.calmTry = nowMin(w);
    const hurt = st.hurtByPlayer && nowMin(w) - st.hurtByPlayer < 10 ? 3 : 0;   // you were just hitting them
    const dc = clamp(13 - strength - Math.round((st.disp || 0) / 25) + hurt - (o.bonus || 0), 1, 20);
    const ok = G.skills.roll(p, dc, o.stat || 'charisma');
    if (ok) this.truce(scene, npc);
    return ok;
  },
  truce(scene, npc) {
    const w = scene.world, st = npc.st;
    npc.endFight && npc.endFight();
    st.hostile = false; npc.aggressor = false; npc.mugDone = true;
    st.truceUntil = nowMin(w) + TRUCE;
    (st.aiMemory = st.aiMemory || []).push({ text: 'the player talked them out of a fight', day: w.day }); st.aiMemory = st.aiMemory.slice(-5);
  },
  inTruce(w, npc) { return (npc.st.truceUntil || 0) > nowMin(w); },
  // a mugger hears "no": most attack, some back off (awkwardly). -> true if they attack
  refuseMugger(scene, npc) {
    const p = scene.player, st = npc.st, w = scene.world;
    let attack = npc.def.mugger ? 0.8 : 0.62;
    if (p.weaponItem && p.weaponItem.gun) attack -= 0.3; else if (p.weaponItem) attack -= 0.12;
    attack -= 0.12 * G.companions.list(scene).filter((a) => a.distTo(p) < 120).length;
    if (npc.hp < npc.maxHp * 0.5) attack -= 0.2;
    if (w.isNight()) attack += 0.05;
    if (st.fear >= 30) attack -= 0.2;
    if (G.rng.chance(clamp(attack, 0.15, 0.92))) {
      st.hostile = true; npc.aggressor = true;
      npc.say(G.rng.pick(['Wrong answer.', 'Then we do this the hard way!', 'You just made a big mistake.', 'Nobody tells me no!']), 3);
      return true;
    }
    npc.mugDone = true;
    npc.say(G.rng.pick(['...Fine. Whatever. Have a good night, I guess.', 'Huh. Okay. Forget I said anything.', 'Wow. Okay. Rude. I am going.', '...Yeah, no, you are right. My bad.']), 4);
    if (!npc.def.mugger) w.addRep(npc.def.faction, -2, true);
    return false;
  },
};

// [E] on someone against you: the standoff (instead of "No more words.")
const GS = G.GameScene.prototype, _talk = GS.talkTo;
GS.talkTo = function (npc) {
  if (!npc.sleeping && npc.state !== 'flee' && (npc.state === 'fight' || npc.isHostileToPlayer(this)) && P.standoff(this, npc)) { this.openDialogue(npc, '_standoff'); return; }
  return _talk.call(this, npc);
};
// a truce holds: no attacking on sight because of who they run with
const NP = G.NPC.prototype, _hostile = NP.isHostileToPlayer;
NP.isHostileToPlayer = function (scene) {
  if (scene && scene.world && P.inTruce(scene.world, this) && !this.st.hostile) return false;
  return _hostile.call(this, scene);
};

const fail = (c) => { c.npc.say(G.rng.pick(['Nice try.', 'Talk is cheap.', 'Shut up and fight!']), 3); return null; };
const ok = (c, line) => { c.npc.say(line || G.rng.pick(['...Fine. Get out of my sight.', 'Okay. Okay. We are done here.', 'Tch. You are not worth it.']), 4); return null; };
G.DIALOGUES._standoff = {
  start: {
    text: (c) => (c.npc.def.mugger || c.npc.mugDone === false ? 'You got something to say? Say it fast.' : G.rng.pick(['What?! Say it quick.', 'You want to talk NOW?', 'Start talking. You have five seconds.'])),
    choices: [
      { text: (c) => `${c.tag(7)} Whoa. I do not want to fight you. Nobody has to get hurt.`, if: (c) => P.canTry(c.w, c.npc), do: (c) => (P.calm(c.scene, c.npc, 5) ? ok(c) : fail(c)) },
      { text: (c) => `${c.tag(8, 'intimidate')} Walk away. Last chance.`, if: (c) => P.canTry(c.w, c.npc), do: (c) => {
        if (P.calm(c.scene, c.npc, 4, { stat: 'intimidate' })) { c.npc.st.fear = Math.max(c.npc.st.fear || 0, 45); return ok(c, G.rng.pick(['Alright, alright! I am going.', 'Okay! Jeez. Not worth it.'])); }
        return fail(c);
      } },
      { text: (c) => `Here. $${Math.min(c.gold(), 40)}. Take it and go.`, if: (c) => c.gold() >= 10 && P.canTry(c.w, c.npc), do: (c) => {
        const n = Math.min(c.gold(), 40); c.pay(n);
        return P.calm(c.scene, c.npc, 6, { bonus: Math.round(n / 8) }) ? ok(c, 'Smart. Now beat it.') : fail(c);
      } },
      { text: '[Fight]', next: null },
    ],
  },
};
// the mugging: saying no is its own choice now
const M = G.DIALOGUES._mugging.start;
if (!M.choices.some((ch) => ch.text === 'No.')) {
  M.choices.splice(M.choices.length - 1, 0, { text: 'No.', if: (c) => c.p.gold >= G.muggingAmount(c.npc, c.p), do: (c) => { P.refuseMugger(c.scene, c.npc); return null; } });
  const broke = M.choices.find((ch) => ch.text === 'I do not have that kind of money.');
  if (broke) broke.do = (c) => { if (c.npc.def.mugger) P.refuseMugger(c.scene, c.npc); else { c.w.addRep(c.npc.def.faction, -2, true); c.npc.say('Then get off our street.'); } };
}
})();
