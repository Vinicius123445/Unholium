'use strict';
// The prison telephone. At 18:00 every game day you earn one call, to someone whose number you have. Dialing uses it up,
// answered or not. Whether they pick up comes from who they are to you: how they feel, how much they trust you, what you
// did, their temperament, whether they are asleep or at work. The talk has its own tree: nothing from a street
// conversation reaches it, because G.DIALOGUES._jailcall is a tree of its own with no common choices.
(() => {
const pick = (a) => G.rng.pick(a);
const clamp = G.util.clamp;
// the day the current window belongs to: from 18:00 on it is today's, before that yesterday's
const windowDay = (w) => (w.hourF >= 18 ? w.day : w.day - 1);
const C = G.prisonCall = {
  available(w) { const j = w.jail; if (!j) return false; const d = windowDay(w); return d >= (j.bookedDay || 0) && j.callUsed !== d; },
  statusText(w) { return w.hourF >= 18 ? 'used' : 'at 18:00'; },
  // would they pick up? (0..1): your bond first, then who they are, then what they are doing
  answerOdds(scene, id) {
    const w = scene.world, st = w.npcs[id], P = G.social.persona(id), trust = G.trust ? G.trust.of(w, id).v : 40, v = G.rel ? G.rel.value(st) : st.disp || 0;
    let o = 0.32 + v / 150 + (trust - 45) / 240 + (P.sociable - 50) / 220 + (P.empathy - 50) / 260 - Math.max(0, P.temper - 60) / 300;
    if (P.trait === 'suspicious') o -= 0.15; if (P.trait === 'grumpy' || P.trait === 'proud') o -= 0.1; if (P.trait === 'friendly' || P.trait === 'chatty') o += 0.12;
    if (st.partner) o += 0.35; else if ((st.romance || 0) >= 40) o += 0.2;
    if (G.mem) o -= Math.min(0.3, G.mem.count(w, id, (x) => x.by === 'player' && x.f < -1) * 0.05);
    const e = G.beds && G.beds.entryNow ? G.beds.entryNow(id, w) : null;
    if (e && e.act === 'sleep') o -= 0.5; else if (e && e.act === 'work') o -= 0.15;
    if (st.ko || st.inHospital) o = 0;
    return clamp(o, 0, 0.97);
  },
  open(scene) {
    const w = scene.world;
    if (!C.available(w)) { scene.toast(w.jail && w.jail.callUsed === windowDay(w) ? 'You already used your call. The next one is at 18:00.' : 'Phone time starts at 18:00.', 'bad'); return; }
    const list = G.phone.contacts(w).filter((id) => G.NPCS[id] && w.npcs[id]);
    if (!list.length) { scene.toast('You do not know anybody\'s number by heart.'); return; }
    const sc = new G.ListScene('Your one call', () => list.map((id) => ({ label: w.displayName(id), sub: G.rel.tier(w.npcs[id]).name, act: () => { G.scenes.remove(sc); C.dial(scene, id); } })));
    G.scenes.push(sc);
  },
  dial(scene, id) {
    const w = scene.world, st = w.npcs[id];
    w.jail.callUsed = windowDay(w);
    G.audio.play('select');
    const noise = (new G.RNG(`jailcall-${id}-${w.day}`).next() - 0.5) * 0.3;
    const res = !st.alive ? 'dead' : C.answerOdds(scene, id) + noise > 0.5 ? 'yes' : 'no';
    if (res === 'dead') { scene.toast('"The number you have dialed is not in service."', 'bad'); return; }
    G.prison.note(w, res === 'yes' ? `Called ${w.displayName(id)}. They picked up.` : `Called ${w.displayName(id)}. Nothing.`);
    if (res === 'no') {
      const e = G.beds && G.beds.entryNow ? G.beds.entryNow(id, w) : null;
      scene.toast(e && e.act === 'sleep' ? `It rings and rings. ${w.displayName(id)} must be asleep.` : (st.disp || 0) <= -20 ? `${w.displayName(id)} hears the recording say it is the County Jail, and hangs up.` : 'It rings out. Nobody picks up.', 'warn');
      return;
    }
    const npc = G.phone.callee(scene, id);
    npc.remote = true;
    (w.jail.calls = w.jail.calls || {})[id] = ((w.jail.calls || {})[id] || 0) + 1;
    G.scenes.push(new G.DialogueScene(scene, new G.DialogueRunner(npc, scene, '_jailcall')));
  },
};
// what they say depends on who they are to you
const warm = (c) => (c.st.partner || (c.st.disp || 0) >= 30 || (c.st.romance || 0) >= 30);
const cold = (c) => (c.st.disp || 0) <= -10;
const P = (c) => G.social.persona(c.npc.id);
const once = (c, k) => { const m = c.w.jail.said = c.w.jail.said || {}, key = `${c.npc.id}:${k}:${c.w.day}`; if (m[key]) return false; m[key] = 1; return true; };
const adj = (c, k, d, t = 0) => { if (!once(c, k)) return; if (d) G.social.addDisp(c.w, c.npc.id, d); if (t && G.trust) G.trust.adjust(c.w, c.npc.id, t); };
const opener = (c) => {
  const n = (c.w.jail.calls || {})[c.npc.id] || 1;
  if (cold(c)) return pick(['You have some nerve. What do you want?', 'From the jail. Of course. Make it quick.']);
  if (c.st.partner) return pick(['Oh my God, it is you. Are you okay? Are they treating you alright?', 'Baby. I have been going crazy. Talk to me.']);
  if (warm(c)) return n > 1 ? pick(['You again! Good. How are you holding up?', 'I was hoping you would call. How is it in there?']) : pick(['You are in JAIL? What happened? Are you okay?', 'Hey. I heard. How are you surviving in there?']);
  return P(c).trait === 'chatty' ? 'Wait, the County Jail? Is that you? Oh, I have to hear this.' : pick(['...The County Jail? Who is this? Oh. You.', 'Huh. Did not expect a call from in there.']);
};
const END = { text: 'I have to go. They are cutting the line.', next: '_jc_end' };
const CHOICES = () => [
  { text: 'It has been hard in here.', next: 'hard' },
  { text: 'I am doing fine. Do not worry about me.', next: 'fine' },
  { text: 'The food, the noise, the cold. You would not believe this place.', next: 'conditions' },
  { text: 'I have made a few friends in here.', next: 'friends', if: (c) => G.prison.inmates(c.w).some((id) => (c.w.npcs[id].disp || 0) >= 20) },
  { text: 'There are people in here who want me hurt.', next: 'enemies', if: (c) => G.prison.inmates(c.w).some((id) => (c.w.npcs[id].disp || 0) <= -20) },
  { text: (c) => `I am running with the ${G.prison.GANGS[G.prison.yours(c.w)]} now.`, next: 'gang', if: (c) => !!G.prison.yours(c.w) },
  { text: 'The groups in here are at each other all the time.', next: 'yard', if: (c) => !G.prison.yours(c.w) },
  { text: 'How have you been out there?', next: 'outside' },
  { text: 'I miss you.', next: 'miss', if: (c) => (c.st.disp || 0) >= 10 },
  { text: 'Have you been thinking about me?', next: 'thinking', if: (c) => (c.st.disp || 0) >= 10 },
  { text: (c) => `I get out on day ${c.w.jail.release}.`, next: 'release' },
  { text: 'I am sorry for everything.', next: 'sorry', if: (c) => (c.st.disp || 0) < 20 },
  END,
];
const reply = (fn, effect) => ({ text: (c) => { if (effect) effect(c); return fn(c); }, choices: CHOICES() });
G.DIALOGUES._jailcall = {
  start: { text: opener, choices: CHOICES() },
  hard: reply((c) => (cold(c) ? 'What did you expect?' : warm(c) ? pick(['I know. I am so sorry. Hang in there, okay? Keep your head down.', 'You are tougher than you think. You will get through it.']) : P(c).empathy >= 60 ? 'That sounds awful. Just stay out of trouble.' : 'Yeah. Well. It is jail.'), (c) => { if (warm(c)) adj(c, 'hard', 2); }),
  fine: reply((c) => (warm(c) ? pick(['Do not lie to me. But okay. Good.', 'Good. I worry, you know.']) : P(c).trait === 'suspicious' ? 'Sure you are.' : 'Good for you, I guess.')),
  conditions: reply((c) => (P(c).trait === 'chatty' ? 'No way. Tell me everything. Is it like the movies?' : P(c).temper >= 65 ? 'You should have thought about that before.' : 'Sounds rough. What do they feed you?')),
  friends: reply((c) => (warm(c) ? 'Good. Stick with the ones who have your back.' : 'Friends. In jail. Great.')),
  enemies: reply((c) => (warm(c) ? 'Please be careful. Tell a guard. Tell someone. I mean it.' : cold(c) ? 'Not my problem.' : 'Then watch yourself.'), (c) => { if (warm(c)) adj(c, 'enemies', 1, 1); }),
  gang: reply((c) => (P(c).empathy >= 60 ? 'Is that safe? Is that what you want? ...Okay. Just come back the same person.' : P(c).trait === 'proud' ? 'Of course you are.' : 'If it keeps you breathing, fine.'), (c) => { if (warm(c) && P(c).honesty >= 60) adj(c, 'gang', -1, -1); }),
  yard: reply((c) => (warm(c) ? 'Stay out of it. Whatever they offer you. Stay out of it.' : 'Pick the winning side, then.')),
  outside: reply((c) => { const e = (G.jobs && c.w.rumors || []).slice(-1)[0]; const P_ = G.social.persona(c.npc.id); return cold(c) ? 'Better without you around.' : e ? `Same old. People are talking, you know. ${e.text}` : `Same as ever. Still worried about ${P_.you ? P_.they.worry : 'everything'}. You know how it is.`; }),
  miss: reply((c) => (c.st.partner ? 'I miss you too. So much. The bed is too big.' : warm(c) ? 'Yeah. I miss you too. It is not the same around here.' : '...Okay. That is nice of you.'), (c) => { if (warm(c)) { adj(c, 'miss', 3, 1); if ((c.st.romance || 0) > 0) c.st.romance = Math.min(100, c.st.romance + 2); } }),
  thinking: reply((c) => (c.st.partner ? 'Every single day.' : warm(c) ? 'More than I expected to, honestly.' : P(c).honesty >= 60 ? 'Not really, no. Sorry.' : 'Sure. Now and then.')),
  release: reply((c) => (warm(c) ? 'I will be counting. What will you do when you get out?' : cold(c) ? 'Good for you. Do not come looking for me.' : 'Alright. Try not to end up back in there.')),
  sorry: reply((c) => (cold(c) && P(c).patience < 45 ? 'Sorry does not fix it.' : 'I know. ...Thanks for saying it.'), (c) => adj(c, 'sorry', cold(c) ? 1 : 2, 1)),
};
G.DIALOGUE_NODES._jc_end = (r) => ({ text: warm(r.c) ? pick(['Okay. Take care of yourself in there. Call me tomorrow, if you can.', 'Stay safe. Please.']) : pick(['Alright. Bye.', 'Yeah. See you.']), choices: [{ text: '[Hang up]', next: null }] });
// the wall phone
const GS = G.GameScene.prototype, _use = GS.useDecor, _label = GS.decorLabel;
GS.useDecor = function (d) { if (d.def.interact === 'prison_phone') { C.open(this); return; } return _use.apply(this, arguments); };
GS.decorLabel = function (d) { if (d.def.interact === 'prison_phone') return C.available(this.world) ? 'Make your call' : 'Prison phone'; return _label.apply(this, arguments); };
// the first evening counts: the right starts at 18:00 on the day you are booked
const J = G.jail, _imp = J.imprison;
J.imprison = function (scene) { const r = _imp.apply(this, arguments); if (scene.world.jail) { scene.world.jail.bookedDay = scene.world.day; scene.world.jail.callUsed = null; } return r; };
})();
