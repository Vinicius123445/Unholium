'use strict';
// What people around you notice.
//   Events: what the player does (a gun out, a shot fired, a punch, a theft, blood on them, no clothes on) and
//   what others do (a fight, a death, someone running scared) is an event at a place. People perceive it the way
//   they would: by sight (in range, in the same building or both outside, nothing solid in between, less at
//   night) or by ear (gunshots carry far; voices about six tiles; walls muffle; rain and traffic cover it).
//   What each person perceived goes into a short memory (st.saw, a few lines, the last game hour or so) that the
//   AI dialogue reads (js/game/aidialogue.js "What you saw and heard"). Notable things make them say something:
//   with AI dialogue on, a short line Llama writes from what they perceived; otherwise a written one that fits.
//   Conversations carry: whatever you and the person you talk to say can be overheard by anyone within earshot
//   (st.heard). Hearing their own name, a threat, someone they love being talked about: they react.
(() => {
const clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const game = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const MEMO = 6, KEEP_MIN = 90;
const VOICE = 96, SHOUT = 1.6, WHISPER = 0.4;

const AW = G.aware = {
  VOICE, MEMO,
  BARK_GAP: 3.5, NPC_GAP: 40, _lastBark: -99, _busy: false,
  // -------- perceiving
  sameSpace(map, ax, ay, bx, by) { return map.buildingAt(ax, ay - 3) === map.buildingAt(bx, by - 3); },
  sees(scene, npc, x, y, range) {
    if (npc.sleeping || npc.dead || (npc.st && npc.st.ko)) return false;
    let r = range; if (scene.world.isNight()) r *= scene.playerLit ? 0.85 : 0.55;
    if (Math.hypot(npc.x - x, npc.y - y) > r || !this.sameSpace(scene.map, npc.x, npc.y, x, y)) return false;
    return this.view(scene.map, npc.x, npc.y - 8, x, y - 8);
  },
  // a clear view: walls block it (and the tiles you and the thing you look at stand on never do); furniture,
  // bodies on the ground and the like you see over
  view(map, x0, y0, x1, y1) {
    const t0 = [Math.floor(x0 / 16), Math.floor(y0 / 16)], t1 = [Math.floor(x1 / 16), Math.floor(y1 / 16)];
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < n; i++) {
      const k = i / n, tx = Math.floor((x0 + (x1 - x0) * k) / 16), ty = Math.floor((y0 + (y1 - y0) * k) / 16);
      if ((tx === t0[0] && ty === t0[1]) || (tx === t1[0] && ty === t1[1])) continue;
      const T = G.TILES[map.get(tx, ty)];
      if (T && T.solid && (T.wall || /wall|door/.test(T.name || ''))) return false;
    }
    return true;
  },
  // how far a sound of this loudness carries to this person (walls muffle it, rain and engines cover it)
  hears(scene, npc, x, y, radius) {
    if (npc.dead || (npc.st && npc.st.ko)) return false;
    let r = radius;
    if (npc.sleeping) r *= 0.3;
    if (!this.sameSpace(scene.map, npc.x, npc.y, x, y)) r *= 0.35;
    if (G.weather && /rain|storm/.test(G.weather.kind || '') && !scene.map.buildingAt(x, y - 3)) r *= 0.75;
    if ((scene.vehicles || []).some((v) => Math.abs(v.speed || 0) > 40 && Math.hypot(v.x - x, v.y - y) < 90)) r *= 0.75;
    return Math.hypot(npc.x - x, npc.y - y) <= r;
  },
  remember(npc, entry) {
    const st = npc.st; if (!st) return;
    const w = G.world, list = (st.saw = (st.saw || []).filter((e) => nowMin(w) - e.t < KEEP_MIN && e.text !== entry.text));
    list.push(Object.assign({ t: nowMin(w) }, entry)); if (list.length > MEMO) list.splice(0, list.length - MEMO);
  },
  recent(npc) { const w = G.world; return ((npc.st && npc.st.saw) || []).filter((e) => nowMin(w) - e.t < KEEP_MIN); },

  // -------- events: { kind, x, y, text, sev 0..3, sight, loud, who (actor), about (actor) }
  event(scene, e) {
    if (!scene || !scene.actors) return;
    const sight = e.sight || 140, loud = e.loud || 0;
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a.remote || a === e.who || !a.st) continue;
      const saw = sight && this.sees(scene, a, e.x, e.y, sight), heard = !saw && loud && this.hears(scene, a, e.x, e.y, loud);
      if (!saw && !heard) continue;
      const text = saw ? e.text : (e.heardText || e.text);
      this.remember(a, { kind: e.kind, text, sev: e.sev || 0, heard: !saw });
      if ((e.sev || 0) >= 1 && a !== e.about) this.react(scene, a, { kind: e.kind, text, sev: e.sev || 0, heard: !saw });
    }
  },
  // -------- speech: a line said aloud by `speaker` (the player or an NPC) to `to`
  speech(scene, speaker, to, text) {
    if (!scene || !text || !speaker) return;
    let r = VOICE;
    if (/!{1,}|[A-Z]{4,}/.test(text) && !/^\(/.test(text)) r *= SHOUT;
    if (/\b(whisper|quietly|lean in|under my breath)\b/i.test(text) || /^\(quietly\)/i.test(text)) r *= WHISPER;
    const w = scene.world, who = speaker === scene.player ? 'the player' : w.displayName(speaker.id), toName = to === scene.player ? 'the player' : to ? w.displayName(to.id) : 'someone';
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a.remote || a === speaker || !a.st) continue;
      if (a === to) { if (G.overhear) try { G.overhear.listen(scene, a, speaker, to, text, true); } catch (e) { G.reportError && G.reportError(e); } continue; }   // (the one spoken to takes it to heart too)
      if (a.talking || !this.hears(scene, a, speaker.x, speaker.y, r)) continue;
      const line = String(text).replace(/\s+/g, ' ').slice(0, 110);
      this.remember(a, { kind: 'heard', text: `heard ${who} say to ${toName}: "${line}"`, sev: 0, heard: true });
      // what it means to them: their own name, someone they know, their people, or nothing (js/game/overhear.js)
      const st = a.st, took = G.overhear ? G.overhear.listen(scene, a, speaker, to, text, false) : null;
      const threat = /\b(kill|hurt|beat|shoot|stab|rob|i'?ll get you|you'?re dead|or else)\b/i.test(line);
      if (speaker === scene.player && threat) { G.social.addDisp(w, a.id, -2); if (a.def.combat === 'flee') st.fear = Math.max(st.fear || 0, 20); }
      if (!took && threat && speaker === scene.player) this.react(scene, a, { kind: 'overheard_threat', text: `heard ${who} say to ${toName}: "${line}"`, sev: 1, heard: true });
    }
  },

  // -------- saying something about it
  LINES: {
    gun: { flee: ['Is that a gun?!', 'Whoa, whoa, put that away!', 'Oh no. Oh no no no.'], fight: ['You pointing that at me?', 'Easy with that thing.'], guard: ['Put the weapon down!', 'Hands where I can see them!'] },
    gunshot: { flee: ['Was that a gunshot?!', 'Get down! Everybody get down!', 'Oh God, someone is shooting!'], fight: ['Shots! Where is that coming from?', 'Somebody is shooting!'], guard: ['Shots fired!', 'Everybody stay back!'] },
    assault: { flee: ['Hey! Leave them alone!', 'Somebody stop them!', 'Oh my God, stop!'], fight: ['Hey! Pick on someone your own size!', 'You want some too?'], guard: ['Stop right there!'] },
    death: { flee: ['Oh my God... is he dead?', 'Somebody call an ambulance!', 'No, no, no...'], fight: ['Damn. They are gone.', 'Who did this?!'], guard: ['We have a body here!'] },
    theft: { flee: ['Hey! I saw that!', 'Thief!'], fight: ['Put that back.', 'I saw that, pal.'], guard: ['Drop it. Now.'] },
    naked: { flee: ['Put some clothes on!', 'Oh my... really?', 'There are children around here!'], fight: ['Seriously? Clothes. Now.'], guard: ['Sir, ma\'am, you cannot be out like that!'] },
    blood: { flee: ['Is that... blood?', 'What happened to you?!'], fight: ['Rough night, huh?'], guard: ['Whose blood is that?'] },
    fight: { flee: ['Somebody stop them!', 'They are fighting!'], fight: ['Fight! Fight!', 'Break it up!'], guard: ['Break it up, both of you!'] },
    overheard_me: { any: ['Are you talking about me?', 'Hey, I heard my name.', 'Excuse me? I am right here.'] },
    overheard_close: { any: ['Wait, what about them?', 'Hey, what did you just say about them?'] },
    overheard_threat: { any: ['Did you just threaten them?', 'Whoa. Not cool.', 'I heard that.'] },
    crime: { flee: ['Somebody call the police!', 'Did you see that?!'], fight: ['Not around here, you don\'t.'], guard: ['Stop right there!'] },
  },
  written(npc, kind) {
    const L = this.LINES[kind] || this.LINES.crime, role = npc.def.combat === 'guard' ? 'guard' : npc.def.combat === 'fight' ? 'fight' : 'flee';
    const list = L[role] || L.any || L.flee;
    return list ? G.rng.pick(list) : null;
  },
  react(scene, npc, e) {
    const st = npc.st, t = G.loop.time;
    if (npc.talking || npc.sleeping || npc.bark || npc.state === 'fight' || st.companion && e.kind === 'heard') return;
    if (t - this._lastBark < this.BARK_GAP || t - (npc._barkAt || -99) < this.NPC_GAP) return;
    if (npc.distTo(scene.player) > 320) return;   // (too far away to matter on screen)
    this._lastBark = t; npc._barkAt = t;
    const A = G.ai;
    if (A && A.active && A.active() && A.bark && !this._busy) {
      this._busy = true;
      A.bark(scene, npc, e).then((line) => { this._busy = false; if (line && !npc.dead && !npc.talking) npc.say(line, 4); else if (!line) { const w = this.written(npc, e.kind); if (w && !npc.dead && !npc.talking) npc.say(w, 3.5); } }, () => { this._busy = false; });
      return;
    }
    const line = this.written(npc, e.kind); if (line) npc.say(line, 3.5);
  },
};

// ---------------------------------------------------------------- where events come from
const GS = G.GameScene.prototype;
// crimes (everything the game already calls a crime)
const CRIME_TEXT = { theft: 'stole something', assault: 'attacked someone', vandalism: 'smashed something up', gunfire: 'fired a gun', trespass: 'went where they had no business', drugs: 'used drugs in public', drugs_public: 'used drugs in public', indecent: 'was exposing themselves', extortion: 'threatened someone for money', murder: 'killed someone', arson: 'started a fire', livestock: 'hurt someone\'s animal', minors: 'did something to a child' };
const _crime = GS.reportCrime;
GS.reportCrime = function (type, victim, value, victimId) {
  const r = _crime.apply(this, arguments);
  try {
    const p = this.player, vname = victim && victim.kind === 'npc' ? this.world.displayName(victim.id) : null;
    const kind = type === 'theft' ? 'theft' : type === 'assault' ? 'assault' : type === 'murder' ? 'death' : type === 'indecent' ? 'naked' : type === 'gunfire' ? 'gunshot' : 'crime';
    AW.event(this, { kind, x: p.x, y: p.y, who: p, about: victim, sev: ['murder', 'assault', 'gunfire', 'arson', 'minors'].includes(type) ? 2 : 1, text: `saw the player ${CRIME_TEXT[type] || type}${vname ? ' (' + vname + ')' : ''}`, sight: 150 });
  } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
// gunshots: heard far, seen up close
if (G.firearms && G.firearms.noise) {
  const _noise = G.firearms.noise.bind(G.firearms);
  G.firearms.noise = function (scene, shooter, loud) {
    const r = _noise(scene, shooter, loud);
    try {
      const w = scene.world, who = shooter === scene.player ? 'the player' : shooter && shooter.id && w.npcs[shooter.id] ? w.displayName(shooter.id) : 'someone';
      AW.event(scene, { kind: 'gunshot', x: shooter.x, y: shooter.y, who: shooter, sev: 2, text: `saw ${who} fire a gun`, heardText: 'heard a gunshot nearby', sight: 170, loud: loud === false ? 260 : 650 });
    } catch (e) { /* noise is only flavor */ }
    return r;
  };
}
// deaths
const NP = G.NPC.prototype, _die = NP.die;
NP.die = function (source, scene) {
  const r = _die.apply(this, arguments);
  try {
    const w = scene.world, by = source === scene.player ? ' at the player\'s hands' : source && source.id && w.npcs[source.id] ? ` at the hands of ${w.displayName(source.id)}` : '';
    AW.event(scene, { kind: 'death', x: this.x, y: this.y, who: source, about: this, sev: 3, text: `saw ${w.displayName(this.id)} die${by}`, heardText: `heard someone scream and go quiet nearby`, sight: 170, loud: 90 });
  } catch (e) { /* */ }
  return r;
};
// fights between people (once per pair, every so often)
const _start = NP.startFight;
NP.startFight = function (target, scene) {
  const was = this.state === 'fight' && this.target === target;
  const r = _start.apply(this, arguments);
  if (!was && scene && target && target.kind === 'npc' && this.kind === 'npc') {
    const w = scene.world;
    AW.event(scene, { kind: 'fight', x: this.x, y: this.y, who: this, about: target, sev: 1, text: `saw ${w.displayName(this.id)} start a fight with ${w.displayName(target.id)}`, heardText: 'heard a fight break out nearby', sight: 150, loud: 110 });
  }
  return r;
};
// the player: a gun coming out, blood all over, no clothes on (noticed as it starts, then remembered)
const _upd = GS.update;
GS.update = function (dt) {
  const r = _upd.call(this, dt);
  const p = this.player;
  if (!p || p.dead || !this.actors) return r;
  if ((this._awT = (this._awT || 0) - dt) > 0) return r;
  this._awT = 0.5;
  try {
    const gun = !!(p.weaponItem && p.weaponItem.gun), bloody = (p.bloody || 0) >= 0.35, naked = !p.equip.top && !p.equip.bottom && !p.vehicle && !p.swimming && !this.map.buildingAt(p.x, p.y - 3);
    const was = this._awState || {};
    if (gun && !was.gun) AW.event(this, { kind: 'gun', x: p.x, y: p.y, who: p, sev: 1, text: `saw the player pull out a ${p.weaponItem.name.toLowerCase()}`, sight: 130 });
    if (bloody && !was.bloody) AW.event(this, { kind: 'blood', x: p.x, y: p.y, who: p, sev: 1, text: 'saw the player covered in blood', sight: 110 });
    if (naked && !was.naked) AW.event(this, { kind: 'naked', x: p.x, y: p.y, who: p, sev: 1, text: 'saw the player walking around naked', sight: 120 });
    this._awState = { gun, bloody, naked };
  } catch (e) { /* */ }
  return r;
};

// ---------------------------------------------------------------- conversations carry
const DS = G.DialogueScene.prototype, _dsu = DS.update, _choose = DS.choose, _submit = DS.submit;
DS.update = function (dt) {
  const r = _dsu.call(this, dt);
  const run = this.runner, n = run && run.node, g = this.game;
  if (n && n !== this._awNode && n.id !== '_ai_wait' && !run.ended && g && typeof n.text === 'string') {
    this._awNode = n;
    if (!run.npc.remote) AW.speech(g, run.npc, g.player, n.text);   // (on the phone, only your side is heard)
  }
  return r;
};
DS.choose = function (i) {
  const run = this.runner, ch = run && run.node && run.node.choices[i], g = this.game;
  if (ch && g && !this.aiWait) { const t = String(ch.text || '').replace(/^\[[^\]]*\]\s*|\([^)]*\d+[^)]*\)\s*/g, '').trim(); if (t && !/^\[/.test(ch.text)) AW.speech(g, g.player, run.npc, t); }
  return _choose.apply(this, arguments);
};
DS.submit = function () {
  const t = (this.input || '').trim(), g = this.game;
  if (t && g && !this.aiWait) AW.speech(g, g.player, this.runner.npc, t);
  return _submit.apply(this, arguments);
};
})();
