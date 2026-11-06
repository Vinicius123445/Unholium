'use strict';
// Swapping numbers goes both ways.
//   When someone gives you their number they ask for yours: "Yes, sure!" (they can text and call you
//   from then on) or "I will text you later" (they never get it: no texts from them, nothing, until you
//   text or call them first, which gives it to them).
//   st.hasMyNumber: true = they have it, false = you held it back, unset = they have it (older saves and
//   numbers swapped some other way, like a dealer or a partner).
(() => {
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
const N = G.DIALOGUE_NODES, _number = N._number;

G.numbers = {
  knows(w, id) { const st = w && w.npcs[id]; return !st || st.hasMyNumber !== false; },
  give(w, id) { const st = w && w.npcs[id]; if (st) st.hasMyNumber = true; },
};

N._number = (r) => {
  const w = r.scene.world, id = r.npc.id, had = G.phone.isContact(w, id);
  const res = _number(r);
  if (had || !G.phone.isContact(w, id)) return res;   // they said no
  const ask = G.rng.pick(['And yours?', 'What is yours?', 'Your turn. Number?', 'Give me yours too.']);
  const choices = [{ text: 'Yes, sure!', next: '_number_give' }, { text: 'I will text you later.', next: '_number_later' }];
  return Object.assign({}, res, { text: res.text + ' ' + ask, choices, exchange: true });
};
N._number_give = (r) => {
  G.numbers.give(r.scene.world, r.npc.id);
  return { text: G.rng.pick(['Got it. I will text you.', 'Saved. Expect a message.', 'Cool. Talk soon.']), choices: BACK };
};
N._number_later = (r) => {
  r.scene.world.npcs[r.npc.id].hasMyNumber = false;
  return { text: G.rng.pick(['Oh. Okay. Sure.', 'Right... later. Okay.', 'Fine. Ball is in your court.']), choices: BACK };
};

// they cannot reach you without your number: anything they would text is never sent
const P = G.phone, _queue = P.queue;
P.queue = function (w, from, text, delay) {
  if (!G.numbers.knows(w, from)) return;
  return _queue.call(this, w, from, text, delay);
};
// you reach out first: now they have it (texting, answering a text, calling)
const _send = P.send;
P.send = function (w, to, text) { G.numbers.give(w, to); return _send.call(this, w, to, text); };
if (P.answer) { const _ans = P.answer; P.answer = function (w, id) { G.numbers.give(w, id); return _ans.apply(this, arguments); }; }
if (P.order) { const _ord = P.order; P.order = function (w, id) { G.numbers.give(w, id); return _ord.apply(this, arguments); }; }
const _call = P.call;
P.call = function (scene, id) { G.numbers.give(scene.world, id); return _call.call(this, scene, id); };
})();
