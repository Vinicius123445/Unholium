'use strict';
// People remember what was said, and talk to each other.
//   Memory: every conversation leaves a note in each person's memory (st.convos, the last few): with you (what it
//   was about, written by the AI dialogue in one sentence from their side when it is on, otherwise what you said
//   and what they said) and with other people. The AI dialogue reads them ("Your past conversations").
//   Bonds: what one person thinks of another uses the same scale as what they think of you (-100..100, the same
//   tiers: Acquaintance, Friend, Good Friend, Best Friend, Rival, Enemy...), plus trust between them (0..100).
//   Talking to each other: people who run into each other stop and talk. Near you, with AI dialogue on, it is a
//   real little conversation (two to four lines, in their voices, about their lives, what they saw, the people
//   they know, you); otherwise a few words as before. How it goes changes what they think of and how much they
//   trust each other, and anyone close enough overhears it (js/game/awareness.js).
(() => {
const clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const MEMO = 5, GAP = 22, PAIR_GAP = 45;   // conversations kept; seconds between generated talks; game minutes per pair

const T = G.npcTalk = {
  MEMO, GAP, _last: -99, _busy: false,
  // ---- bonds between two people (a's side)
  bond(w, a, b) {
    const v = Math.round(G.social.opinion(w, a, b));
    const t = (G.rel.TIERS || []).find(([min]) => v >= min) || [0, 'Stranger', '#c8c0b0'];
    const st = w.npcs[a], trust = clamp(Math.round(30 + v * 0.45 + ((st && st.trustOp && st.trustOp[b]) || 0)), 0, 100);
    const rel = (G.NPCS[a] && G.NPCS[a].relations || {})[b] || (G.NPCS[b] && G.NPCS[b].relations || {})[a];
    return { v, name: v >= 70 ? (rel === 'spouse' ? 'Partner' : 'Best Friend') : t[1] === 'Lovers' || t[1] === 'Friends with Benefits' ? 'Best Friend' : t[1], trust, rel };
  },
  trustAdj(w, a, b, n) { const st = w.npcs[a]; if (!st || !n) return; st.trustOp = st.trustOp || {}; st.trustOp[b] = clamp((st.trustOp[b] || 0) + n, -50, 50); },
  // the people this person knows best (strongest feelings first), for the AI context
  knownPeople(w, id, n = 6) {
    const d = G.NPCS[id]; if (!d) return [];
    const out = [];
    for (const o in G.NPCS) {
      if (o === id || !w.isAlive(o) || !w.npcs[o]) continue;
      const rel = (d.relations || {})[o] || (G.NPCS[o].relations || {})[id], had = (w.npcs[id].convos || []).some((c) => c.with === o);
      const op = G.social.opinion(w, id, o);
      if (!rel && !had && Math.abs(op) < 20) continue;
      out.push({ id: o, score: Math.abs(op) + (rel ? 40 : 0) + (had ? 20 : 0) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.id);
  },
  // ---- memory of conversations
  remember(w, id, entry) {
    const st = w.npcs[id]; if (!st) return;
    const kept = Object.assign({ day: w.day, at: nowMin(w) }, entry);
    st.convos = (st.convos || []).concat([kept]).slice(-MEMO);
    return kept;
  },
  past(w, id, withId) { return ((w.npcs[id] && w.npcs[id].convos) || []).filter((c) => !withId || c.with === withId); },
  when(w, c) { const d = w.day - c.day; return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; },
};

// ---------------------------------------------------------------- remembering talks with the player
const DR = G.DialogueRunner.prototype, _go = DR.go, _choose = DR.choose, _say = DR.say, _end = DR.end;
const log = (r, who, text) => { if (!text || typeof text !== 'string') return; (r._talk = r._talk || []).push({ who, text: text.replace(/\s+/g, ' ').slice(0, 160) }); if (r._talk.length > 14) r._talk.shift(); };
DR.go = function (nodeId) { const r = _go.apply(this, arguments); if (this.node && this.node.id !== '_ai_wait') log(this, 'npc', this.node.text); return r; };
DR.choose = function (i) { const ch = this.node && this.node.choices[i]; if (ch && typeof ch.text === 'string' && !/^\[/.test(ch.text)) log(this, 'player', ch.text.replace(/^\([^)]*\)\s*/, '')); return _choose.apply(this, arguments); };
DR.say = function (text) { log(this, 'player', text); return _say.apply(this, arguments); };
DR.end = function () {
  const was = this.ended, r = _end.apply(this, arguments);
  if (!was) try { T.closeTalk(this); } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
T.closeTalk = function (r) {
  const npc = r.npc, w = r.scene.world;
  if (!npc || !npc.st || !G.NPCS[npc.id] || (npc.st.brain)) return;
  // what was said: the AI conversation log when there is one, otherwise what the runner saw
  // (whichever has more of what the player said: typed lines live in the AI log, choices in the runner's own)
  const mine = (l) => (l || []).filter((m) => m.who === 'player').length;
  const src = mine(r.aiLog) >= mine(r._talk) && mine(r.aiLog) ? r.aiLog : r._talk || [];
  const lines = src.filter((m) => m.text && m.text !== '...' && !/^Typing/.test(m.text));
  const said = lines.filter((m) => m.who === 'player');
  if (!said.length) return;   // (nothing but a greeting)
  const plain = `The player said "${said.slice(-2).map((m) => m.text.slice(0, 70)).join('" and "')}"${lines.some((m) => m.who === 'npc') ? `; you answered "${lines.filter((m) => m.who === 'npc').slice(-1)[0].text.slice(0, 70)}"` : ''}`;
  const entry = T.remember(w, npc.id, { with: 'player', gist: plain, phone: !!npc.remote });
  // with AI dialogue: one sentence, from their side, replaces the raw note when it comes back
  const A = G.ai;
  if (A && A.active && A.active() && lines.length >= 2) {
    const convo = lines.slice(-8).map((m) => `${m.who === 'npc' ? 'You' : 'Player'}: ${m.text}`).join('\n');
    A.ask('You summarize a conversation for the memory of the person who had it. One sentence, from their point of view ("I..."), plain, under 25 words: what it was about and how it went. No new facts. JSON only: {"gist": "..."}',
      `Conversation${npc.remote ? ' (on the phone)' : ''}:\n${convo}`, { noStrike: true, raw: true, schema: { type: 'object', properties: { gist: { type: 'string' } }, required: ['gist'], additionalProperties: false } })
      .then((d) => { if (d && typeof d.gist === 'string' && d.gist.length > 4) entry.gist = d.gist.replace(/\s+/g, ' ').slice(0, 180); }, () => {});
  }
};

// ---------------------------------------------------------------- talking to each other
const TALK_SCHEMA = {
  type: 'object',
  properties: {
    lines: { type: 'array', items: { type: 'object', properties: { speaker: { type: 'string', enum: ['A', 'B'] }, text: { type: 'string' } }, required: ['speaker', 'text'], additionalProperties: false } },
    topic: { type: 'string' },
    a_likes_b: { type: 'integer' }, b_likes_a: { type: 'integer' }, a_trusts_b: { type: 'integer' }, b_trusts_a: { type: 'integer' },
  },
  required: ['lines', 'topic', 'a_likes_b', 'b_likes_a', 'a_trusts_b', 'b_trusts_a'], additionalProperties: false,
};
T.SCHEMA = TALK_SCHEMA;
const BLOCK = /\b(fuck(ing)? (you|me|her|him)|blowjob|orgasm|genital|penis|vagina|nipple|naked (child|kid)|child porn)/i;
T.describe = function (scene, npc) {
  const w = scene.world, st = npc.st, P = G.social.persona(npc.id), seen = G.aware ? G.aware.recent(npc).slice(-2).map((e) => e.text) : [];
  const past = T.past(w, npc.id).slice(-2).map((c) => `${T.when(w, c)} with ${c.with === 'player' ? 'the player' : w.npcs[c.with] ? w.npcs[c.with].realName : 'someone'}: ${c.gist}`);
  return [`${st.realName}, ${npc.def.name}${npc.def.kid ? ' (a child)' : ''}. Personality: ${P.trait}; ${G.identity.temperament(P)}. Talks: ${P.voice}. Into ${P.hobby}; worried about ${P.they.worry}.${G.fmind && G.fmind.rankTitle(w, npc.id) ? ` ${G.fmind.rankTitle(w, npc.id)} of ${G.FACTIONS[npc.def.faction].name}.` : ''}`,
    `Thinks of the player: ${G.rel.tier(st, npc.id).name}.`, seen.length ? `Recently ${seen.join('; ')}.` : null, past.length ? `Recent talks: ${past.join(' | ')}.` : null, G.mem && G.mem.recall(w, npc.id, { n: 2 }).length ? `Remembers: ${G.mem.recall(w, npc.id, { n: 2 }).map((m) => G.mem.say(w, m)).join(' | ')}.` : null].filter(Boolean).join(' ');
};
// a real conversation between two people (near the player): generated, shown line by line, and it changes them
T.converse = async function (scene, a, b) {
  const w = scene.world, A = G.ai, ba = T.bond(w, a.id, b.id), bb = T.bond(w, b.id, a.id);
  const system = `You write a short conversation between two people in "Unholium", a modern-day crime RPG, as they run into each other. 2 to 4 short lines, alternating, plain modern English, in character, no stage directions. They can talk about their lives, people they know, what they saw lately, the player. Each speaker is "I" in their own line and never says their own name; the other is "you"; "the player" is somebody else, a third person. Keep what each one owns and did straight. They only know what is listed for them: what A knows, B does not, unless A says it. Never invent names, places, factions or lore beyond what you are given. Non-explicit. Then how it changed them: likes -5..5, trusts -3..3 (0 if nothing changed). JSON only.`;
  const user = [`A: ${T.describe(scene, a)} A thinks of B: ${ba.name}${ba.rel ? ' (' + ba.rel + ')' : ''}, trust ${ba.trust}/100.`,
    `B: ${T.describe(scene, b)} B thinks of A: ${bb.name}${bb.rel ? ' (' + bb.rel + ')' : ''}, trust ${bb.trust}/100.`,
    `Place: ${scene.map.meta.name}, ${w.timeString}${w.isNight() ? ', night' : ''}${G.weather && G.weather.kind !== 'clear' ? ', ' + G.weather.kind : ''}. A speaks first.`].join('\n');
  const d = await A.ask(system, user, { noStrike: true, raw: true, schema: TALK_SCHEMA });
  if (!d || !Array.isArray(d.lines)) return false;
  const lines = d.lines.filter((l) => l && (l.speaker === 'A' || l.speaker === 'B') && typeof l.text === 'string' && l.text.trim() && !BLOCK.test(l.text)).slice(0, 4).map((l) => { const who = l.speaker === 'A' ? a : b, g = G.identity; return { who, text: g.cleanPlaces(w, g.fixLine(w, who, l.text.replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, ''))).slice(0, 90) }; });
  if (lines.length < 2 || a.dead || b.dead || a.talking || b.talking) return false;
  T.play(scene, a, b, lines, String(d.topic || '').slice(0, 120), { ab: clamp(+d.a_likes_b || 0, -5, 5), ba: clamp(+d.b_likes_a || 0, -5, 5), ta: clamp(+d.a_trusts_b || 0, -3, 3), tb: clamp(+d.b_trusts_a || 0, -3, 3) });
  return true;
};
// show it: each line as a speech bubble in turn (both stop to talk), overheard, remembered
T.play = function (scene, a, b, lines, topic, fx) {
  const w = scene.world, step = 2.4;
  a.chatT = b.chatT = lines.length * step + 0.8;
  a.faceTowards(b); b.faceTowards(a);
  // the first line now; the rest one after another (NPC.update below), each by whoever says it
  lines[0].who.say(lines[0].text, step + 0.4);
  if (G.aware) G.aware.speech(scene, lines[0].who, lines[0].who === a ? b : a, lines[0].text);
  a._talkAt = b._talkAt = G.loop.time; a._talkLines = b._talkLines = lines; a._talkStep = b._talkStep = step; a._said = b._said = 0;
  if (fx) {
    G.social.adjust(w, a.id, b.id, fx.ab); G.social.adjust(w, b.id, a.id, fx.ba);
    T.trustAdj(w, a.id, b.id, fx.ta); T.trustAdj(w, b.id, a.id, fx.tb);
  }
  const gist = topic || lines.map((l) => l.text).join(' / ').slice(0, 120);
  T.remember(w, a.id, { with: b.id, gist }); T.remember(w, b.id, { with: a.id, gist });
};
// the lines after the first, said on time (and overheard)
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  const r = _nu.call(this, dt, scene);
  const lines = this._talkLines;
  if (lines && !this.dead) {
    const k = Math.floor((G.loop.time - this._talkAt - 0.2) / this._talkStep);
    if (k >= lines.length + 1) this._talkLines = null;
    else if (k >= 1 && k < lines.length && lines[k].who === this && this._said !== k) {
      this._said = k;
      const other = lines.find((l) => l.who !== this);
      this.say(lines[k].text, this._talkStep + 0.4);
      if (G.aware && other) G.aware.speech(scene, this, other.who, lines[k].text);
    }
  }
  return r;
};
// who talks to whom: the existing street life (js/game/social.js), now with neutral neighbors too, and generated
// conversations near the player
const S = G.social, _su = S.update;
S.update = function (npc, dt, scene) {
  if (npc.transient || npc.state !== 'schedule' || npc.sleeping || npc.talking || npc._talkLines || npc.st.companion) return _su.call(this, npc, dt, scene);
  const A = G.ai, w = scene.world, p = scene.player;
  const near = p && npc.distTo(p) < 300;
  if (near && A && A.active && A.active() && !T._busy && G.loop.time - T._last > GAP && (npc._convoT = (npc._convoT == null ? G.rng.range(3, 10) : npc._convoT) - dt) <= 0) {
    npc._convoT = G.rng.range(15, 30);
    const other = scene.actors.find((o) => o !== npc && o.kind === 'npc' && !o.dead && !o.transient && !o.sleeping && !o.talking && !o._talkLines && o.state === 'schedule' && !o.st.companion && o.distTo(npc) < 48
      && nowMin(w) - (((npc.st.pairT || {})[o.id]) || -1e9) > PAIR_GAP && (Math.abs(G.social.opinion(w, npc.id, o.id)) >= 10 || G.NPCS[o.id].map === npc.def.map));
    if (other) {
      T._busy = true; T._last = G.loop.time;
      (npc.st.pairT = npc.st.pairT || {})[other.id] = nowMin(w); (other.st.pairT = other.st.pairT || {})[npc.id] = nowMin(w);
      npc.chatT = other.chatT = 3; npc.faceTowards(other); other.faceTowards(npc);   // (they stop while the words come)
      T.converse(scene, npc, other).then((ok) => { T._busy = false; if (!ok) { npc.chatT = other.chatT = 0; } }, () => { T._busy = false; });
      return;
    }
  }
  // the written way: as before, and they remember it
  const before = npc.bark;
  const r = _su.call(this, npc, dt, scene);
  if (npc.bark && npc.bark !== before) {
    const other = scene.actors.find((o) => o !== npc && o.kind === 'npc' && o.chatT > 2.5 && o.distTo(npc) < 48);
    if (other) {
      T.remember(w, npc.id, { with: other.id, gist: `I said "${npc.bark}" to them` });
      T.remember(w, other.id, { with: npc.id, gist: `they said "${npc.bark}" to me` });
      T.trustAdj(w, npc.id, other.id, G.social.opinion(w, npc.id, other.id) > 0 ? 1 : -1);
      if (G.aware) G.aware.speech(scene, npc, other, npc.bark);
    }
  }
  return r;
};
})();
