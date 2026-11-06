'use strict';
// What each person remembers, and how they feel.
//   G.mem: one short list per person (st.mems, saved with the game), not a transcript: what happened, who did or said
//   it, who it was about, when, how they know (saw it, did it, were told, overheard, heard a rumor, assumed), how
//   reliable that is, how they felt, how much it matters. Important things stay; small talk fades. Nobody knows
//   anything unless it reached them: they were there, somebody told them, or they caught it in passing.
//   Tiers say who it can be passed on to: public, rumor, faction (fellow members), restricted (senior members),
//   personal (close friends only). Passing it on costs reliability; after two mouths it is only a rumor.
//   G.emo: anger, joy, sadness that build up and wear off over a few hours, and shape what they do next.
//   G.social.adjust / addDisp take a reason: why someone likes or dislikes someone is a memory they can quote.
//     A memory: { k kind, t text in their own words, by who did it ('player' | id), ab who it is about, s source,
//                 r reliability 0..1, f feeling -3..3, i importance 1..5, d day, m minutes, n times, ti tier, fc faction }
(() => {
const clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const SRC = { saw: 'you saw it yourself', did: 'it happened to you', told: 'someone told you', overheard: 'you overheard it', rumor: 'a rumor, may not be true', assumed: 'your own guess' };
const REL = { saw: 1, did: 1, told: 0.7, overheard: 0.6, rumor: 0.35, assumed: 0.3 };

const M = G.mem = {
  MAX: 16, SRC,
  list(w, id) { return (w.npcs[id] && w.npcs[id].mems) || []; },
  add(w, id, m) {
    const st = w.npcs[id]; if (!st || !m || !m.t) return null;
    const list = st.mems = st.mems || [], text = String(m.t).replace(/\s+/g, ' ').slice(0, 120), s = m.s || 'saw';
    const old = list.find((x) => x.t === text || (m.k && x.k === m.k && x.by === m.by && x.ab === m.ab && w.day - x.d <= 1 && !m.fresh));
    if (old) { old.n = (old.n || 1) + 1; old.d = w.day; old.m = nowMin(w); old.i = Math.min(5, Math.max(old.i, m.i || 1)); return old; }
    const e = { k: m.k || 'event', t: text, s, r: m.r != null ? m.r : REL[s] || 0.5, f: clamp(m.f || 0, -3, 3), i: clamp(m.i || 1, 1, 5), d: w.day, m: nowMin(w) };
    for (const k of ['by', 'ab', 'ti', 'fc', 'h', 'due']) if (m[k] != null) e[k] = m[k];
    list.push(e);
    if (list.length > this.MAX) { let lo = 0, v = 1e9; list.forEach((x, i) => { const sc = this.worth(w, x); if (sc < v) { v = sc; lo = i; } }); list.splice(lo, 1); }
    return e;
  },
  // what is worth keeping: importance, strong feelings, repetition, recent
  worth(w, x) { return x.i * 3 + Math.abs(x.f) * 1.5 + Math.min(4, (x.n || 1) - 1) + (x.k === 'promise' && !x.done ? 4 : 0) - (w.day - x.d) * (x.i >= 4 ? 0.05 : x.i >= 3 ? 0.2 : 0.8); },
  // the memories that matter right now: about someone named, or just the strongest
  recall(w, id, o = {}) {
    const about = new Set(o.about || []);
    return this.list(w, id).map((x) => ({ x, v: this.worth(w, x) + (about.has(x.ab) || about.has(x.by) ? 8 : 0) + (o.kind === x.k ? 3 : 0) })).sort((a, b) => b.v - a.v).slice(0, o.n || 5).map((e) => e.x);
  },
  when(w, x) { const d = w.day - x.d; return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; },
  say(w, x) { return `${x.t} (${this.when(w, x)}; ${SRC[x.s] || x.s}${x.n > 1 ? `; ${x.n} times` : ''})`; },
  count(w, id, pred) { return this.list(w, id).filter(pred).reduce((n, x) => n + (x.n || 1), 0); },
  // why they feel what they feel about someone: the memories behind it
  why(w, id, other, n = 2) { return this.list(w, id).filter((x) => (x.by === other || x.ab === other) && x.f).sort((a, b) => Math.abs(b.f) * b.i - Math.abs(a.f) * a.i).slice(0, n).map((x) => x.t); },

  // ---- passing things on
  shareable(w, x, from, to) {
    const ti = x.ti || 'personal', a = G.NPCS[from] || {}, b = G.NPCS[to] || {};
    if (ti === 'public' || ti === 'rumor') return true;
    if (ti === 'faction') return !!x.fc && a.faction === x.fc && b.faction === x.fc;
    if (ti === 'restricted') return !!x.fc && a.faction === x.fc && b.faction === x.fc && G.fmind && G.fmind.rankIndex(w, to) >= 3;
    return G.social.opinion(w, from, to) >= 50 && x.i >= 3;
  },
  // one thing `from` tells `to` when they talk: what `to` does not know yet and is allowed to hear
  gossip(w, from, to) {
    const P = G.social.persona(from);
    if (P.sociable < 30 && Math.random() < 0.6) return null;
    const heard = this.list(w, from).filter((x) => x.i >= 2 && (x.h || 0) < 3 && this.shareable(w, x, from, to) && x.ab !== to && !this.list(w, to).some((y) => y.t === x.t));
    if (!heard.length) return null;
    const x = heard.sort((p, q) => this.worth(w, q) - this.worth(w, p))[0], hops = (x.h || 0) + 1, trust = G.npcTalk ? G.npcTalk.bond(w, to, from).trust / 100 : 0.5;
    const copy = this.add(w, to, { k: x.k, t: x.t, by: x.by, ab: x.ab, s: hops >= 2 ? 'rumor' : 'told', r: x.r * (0.5 + trust * 0.4), f: Math.sign(x.f) * Math.max(0, Math.abs(x.f) - 1), i: Math.max(1, x.i - 1), ti: x.ti === 'public' ? 'rumor' : x.ti, fc: x.fc, h: hops, fresh: true });
    if (copy && x.by === 'player') {   // what they hear about you changes what they think of you, as far as they believe it
      const n = Math.round(x.f * copy.r * 1.5);
      if (n) G.social.addDisp(w, to, n);
    }
    // caught spreading rumors about someone they care about: they think less of the one telling it
    if (copy && x.ab && x.ab !== from && x.f < 0 && copy.s === 'rumor' && G.social.opinion(w, to, x.ab) >= 40) { G.social.adjust(w, to, from, -2, 'spreads rumors about people I care about'); if (G.npcTalk) G.npcTalk.trustAdj(w, to, from, -2); }
    return copy;
  },
};

// ---------------------------------------------------------------- feelings that come and go
const HALF = 240;   // game minutes
const E = G.emo = {
  get(w, id) {
    const st = w.npcs[id]; if (!st || !st.emo) return { anger: 0, joy: 0, sad: 0 };
    const k = Math.pow(0.5, Math.max(0, nowMin(w) - st.emo.at) / HALF);
    return { anger: st.emo.anger * k, joy: st.emo.joy * k, sad: st.emo.sad * k };
  },
  add(w, id, kind, n) {
    const st = w.npcs[id]; if (!st) return;
    const v = this.get(w, id);
    v[kind] = clamp((v[kind] || 0) + n, 0, 100);
    st.emo = { anger: Math.round(v.anger), joy: Math.round(v.joy), sad: Math.round(v.sad), at: nowMin(w) };
  },
  label(w, id) {
    const e = this.get(w, id), out = [];
    if (e.anger >= 50) out.push('furious'); else if (e.anger >= 22) out.push('angry');
    if (e.sad >= 45) out.push('heartbroken'); else if (e.sad >= 20) out.push('down');
    if (e.joy >= 40) out.push('in a great mood'); else if (e.joy >= 18) out.push('in a good mood');
    return out.join(' and ');
  },
};

// ---------------------------------------------------------------- reasons behind likes and dislikes
const S = G.social, _adj = S.adjust.bind(S), _disp = S.addDisp.bind(S);
S.adjust = function (w, a, b, n, why) { const r = _adj(w, a, b, n); if (why && n) M.add(w, a, { k: 'opinion', t: why, ab: b, s: 'did', f: clamp(Math.round(n / 3), -3, 3) || Math.sign(n), i: Math.abs(n) >= 8 ? 3 : 2 }); return r; };
S.addDisp = function (w, id, n, why) { const r = _disp(w, id, n); if (why && n) M.add(w, id, { k: 'opinion', t: why, by: 'player', s: 'did', f: clamp(Math.round(n / 3), -3, 3) || Math.sign(n), i: Math.abs(n) >= 8 ? 3 : 2 }); return r; };

// ---------------------------------------------------------------- where memories come from
const T = G.npcTalk, _rem = T.remember;
// every conversation is already noted: the ones that mattered become memories too, and people tell each other things
T.remember = function (w, id, entry) {
  const r = _rem.apply(this, arguments);
  try { if (entry.with && entry.with !== 'player' && G.NPCS[entry.with] && Math.random() < 0.5) M.gossip(w, entry.with, id); } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
const who = (w, a) => (a === 'player' ? 'the player' : w.npcs[a] ? w.npcs[a].realName : 'someone');
if (G.aware) {
  const AW = G.aware, _event = AW.remember;
  // what they perceive and matters goes in for good (st.saw is only the last game hour or so)
  AW.remember = function (npc, entry) {
    const r = _event.apply(this, arguments);
    try {
      if ((entry.sev || 0) >= 1 && G.world) {
        const w = G.world, player = /\bthe player\b/.test(entry.text);
        M.add(w, npc.id, { k: entry.kind, t: `I ${entry.text}`, by: player ? 'player' : undefined, s: entry.heard ? 'overheard' : 'saw', f: entry.kind === 'death' ? -3 : player ? -(entry.sev || 1) : -1, i: Math.min(5, (entry.sev || 1) + 1), ti: 'public' });
      }
    } catch (e) { G.reportError && G.reportError(e); }
    return r;
  };
}
const GS = G.GameScene.prototype, NP = G.NPC.prototype;
// being hurt, by you: remembered as what it was
const _hurt = NP.onHurt;
NP.onHurt = function (source, dmg, scene) {
  const r = _hurt.apply(this, arguments);
  try {
    if (source === scene.player && this.st && G.NPCS[this.id]) {
      const w = scene.world, friend = (this.st.disp || 0) >= 30 || this.st.companion;
      M.add(w, this.id, { k: friend ? 'betrayal' : 'attacked', t: friend ? 'The player attacked me, and I thought we were friends' : 'The player attacked me', by: 'player', ab: this.id, s: 'did', f: -3, i: friend ? 5 : 4 });
      E.add(w, this.id, 'anger', 20);
      if (G.fmind) G.fmind.onAttacked(scene, this, source);
    }
  } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
// kindness: treated, fed, given things
const kind = (scene, npc, text, n = 2) => {
  const w = scene.world;
  M.add(w, npc.id, { k: 'favor', t: text, by: 'player', ab: npc.id, s: 'did', f: n, i: n >= 3 ? 4 : 3 });
  E.add(w, npc.id, 'joy', 12);
  // a pattern of it: seeing the player treat them well for a while slowly turns into trust
  const times = M.count(w, npc.id, (x) => x.k === 'favor' && x.by === 'player');
  if (G.trust && times >= 3) G.trust.adjust(w, npc.id, 1);
  if (G.fmind) G.fmind.onHelped(scene, npc);
};
if (G.aid && G.aid.treat) { const _t = G.aid.treat; G.aid.treat = function (scene, npc) { const r = _t.apply(this, arguments); try { if (npc && npc.st && npc.kind === 'npc') kind(scene, npc, 'The player treated my wounds when I needed it', 3); } catch (e) { /* */ } return r; }; }
if (G.companionLife && G.companionLife.feed) { const _f = G.companionLife.feed; G.companionLife.feed = function (scene, npc) { const r = _f.apply(this, arguments); try { kind(scene, npc, 'The player gave me something to eat or drink'); } catch (e) { /* */ } return r; }; }
M.kind = kind;
M.who = who;

// time passing: old feelings settle into what someone thinks of someone
G.events.on('newDay', () => {
  const w = G.world; if (!w) return;
  try {
    for (const id in w.npcs) {
      if (!G.NPCS[id] || !w.isAlive(id)) continue;
      const st = w.npcs[id], P = G.social.persona(id);
      if (!st.mems) continue;
      // a grudge, for those who keep them: repeated insults harden into resentment
      const hurt = M.count(w, id, (x) => x.by === 'player' && x.f < 0 && w.day - x.d < 7);
      if (hurt >= 3 && P.patience < 45) G.social.addDisp(w, id, -1);
      // someone keeps getting on their nerves: a rivalry grows
      const seen = {};
      for (const x of st.mems) if (x.by && x.by !== 'player' && x.f < 0) seen[x.by] = (seen[x.by] || 0) + (x.n || 1);
      for (const o in seen) if (seen[o] >= 3) { G.social.adjust(w, id, o, -2); G.social.adjust(w, o, id, -1); }
      // promises that came due
      for (const x of st.mems) if (x.k === 'promise' && !x.done && x.due && w.day > x.due) { x.done = 'broken'; x.f = -2; x.i = 4; G.social.addDisp(w, id, -5); if (G.trust) G.trust.adjust(w, id, -4); }
    }
  } catch (e) { G.reportError && G.reportError(e); }
});
})();
