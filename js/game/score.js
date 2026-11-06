'use strict';
// The score. Everything here is synthesized live, nothing is a recording.
//   Moods: one arrangement per kind of place (dark ambient, dystopian synth, industrial, techno, cold piano...), most with a
//     day and a night reading. Every eight bars a section picks which layers play and which progression, so nothing loops.
//   Crossfades: each mood plays through its own gate; a change fades the old one out while its notes ring on.
//   G.score.pick(scene) decides what plays: dream, pursuit, combat, danger, the building you are in, the district, the hour.
//   Beds: room tones the soundscape does not cover (vents, machinery, electrical hum, a crowd behind a wall, rain on a roof).
(() => {
const A = G.audio;
const AEOL = [0, 2, 3, 5, 7, 8, 10], PHRY = [0, 1, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], LOCR = [0, 1, 3, 5, 6, 8, 10], LYD = [0, 2, 4, 6, 7, 9, 11], MIXO = [0, 2, 4, 5, 7, 9, 10], HIJ = [0, 1, 4, 5, 7, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11];
// 16 steps. kick, snare (or clap), hat. In a hat line: x normal, o open, r a roll
const KITS = {
  tick: { hat: '..x...x...x...x.', vol: 0.5 },
  pulse: { kick: 'x.......x.......', hat: '..x...x...x...x.', vol: 0.7 },
  four: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..o...o...o...o.', vol: 0.9 },
  soft4: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', rim: '.......x.......x', vol: 0.55 },
  trap: { kick: 'x.....x...x.....', clap: '....x.......x...', hat: 'x.x.x.x.x.rrx.x.', vol: 0.7 },
  slow: { kick: 'x.........x.....', rim: '....x.......x...', hat: '..x...x...x...x.', vol: 0.6 },
  brush: { kick: 'x.......x.......', brush: '....x.......x...', shaker: '..x...x...x...x.', vol: 0.5 },
  hand: { conga: 'x..x..x...x.x...', shaker: '.x.x.x.x.x.x.x.x', tom: '........x.......', vol: 0.5 },
  march: { kick: 'x..x....x..x....', clang: '....x.......x...', vol: 0.8 },
  machine: { kick: 'x..x..x.x..x..x.', clang: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', vol: 0.85 },
  drive: { kick: 'x...x.x.x...x.x.', clap: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', vol: 1 },
  chase: { kick: 'x.x.x.x.x.x.x.x.', clap: '....x.......x.xx', hat: 'x.x.x.x.x.x.x.x.', vol: 1 },
};
const m = (o) => Object.assign({ prog: [[0, 5, 3, 4]], vary: {}, density: 0.2 }, o);
const MOODS = {
  menu: m({ root: 50, scale: AEOL, bpm: 56, prog: [[0, 5, 0, 3], [5, 3, 6, 0]], drone: 0.7, pad: 0.6, lead: 'glass', density: 0.1 }),
  // the city by day: a dystopian synth line under ordinary life
  city: m({ root: 53, scale: AEOL, bpm: 92, prog: [[0, 5, 2, 6], [3, 5, 0, 6]], pad: 0.3, bass: 0.7, bassLine: 'x...x.x.x...x.o.', stab: 0.6, stabLine: '...x...x...x..x.', drums: 'soft4', lead: 'keys', density: 0.12, vary: { stab: 0.3, drums: 0.25, lead: 0.4 } }),
  night: m({ root: 48, scale: AEOL, bpm: 76, prog: [[0, 5, 6, 3], [0, 6, 5, 4]], drone: 0.5, pad: 0.45, bass: 0.6, bassLine: 'x.......x..x....', drums: 'tick', arp: 'glass', lead: 'keys', density: 0.08, vary: { arp: 0.4, drums: 0.4 } }),
  // the poor blocks: heavy, slow, nothing to spare
  slums: m({ root: 45, scale: PHRY, bpm: 72, prog: [[0, 1, 0, 6], [0, 5, 1, 0]], bass: 1, bassLine: 'x.....x...x.....', sub: true, drums: 'trap', lead: 'keys', density: 0.1, clang: 0.3, pad: 0.2, vary: { drums: 0.25, lead: 0.5 } }),
  slums_night: m({ root: 43, scale: PHRY, bpm: 66, prog: [[0, 1, 0, 5], [0, 6, 1, 0]], drone: 0.6, bass: 0.9, bassLine: 'x.........x.....', sub: true, drums: 'slow', clang: 0.4, pad: 0.3, lead: 'glass', density: 0.06, vary: { drums: 0.4 } }),
  // the rich: clean, spare, expensive, cold
  heights: m({ root: 57, scale: LYD, bpm: 60, prog: [[0, 4, 5, 1], [3, 0, 4, 1]], pad: 0.4, arp: 'piano', lead: 'keys', density: 0.09, seventh: true, vary: { arp: 0.3 } }),
  heights_night: m({ root: 52, scale: LYD, bpm: 54, prog: [[0, 3, 4, 1]], drone: 0.3, pad: 0.5, lead: 'glass', density: 0.1, seventh: true }),
  // shops and signs: atmospheric techno, more movement than warmth
  commercial: m({ root: 55, scale: DOR, bpm: 112, prog: [[0, 3, 5, 3], [0, 6, 3, 4]], pad: 0.3, bass: 0.7, bassLine: 'x.x.x.x.x.x.x.o.', arp: 'pluck', drums: 'soft4', density: 0.06, vary: { arp: 0.25, drums: 0.2 } }),
  commercial_night: m({ root: 52, scale: DOR, bpm: 118, prog: [[0, 6, 3, 5]], pad: 0.35, bass: 0.8, bassLine: '..x...x...x...x.', arp: 'glass', stab: 0.5, stabLine: 'x..x..x.....x...', drums: 'four', density: 0.05, vary: { stab: 0.3, drums: 0.3 } }),
  industrial: m({ root: 41, scale: LOCR, bpm: 88, prog: [[0, 1, 0, 4], [0, 4, 1, 0]], drone: 0.7, bass: 0.8, bassLine: 'x..x..x.x..x..x.', drums: 'march', clang: 0.5, vary: { drums: 0.35 } }),
  suburbs: m({ root: 55, scale: MIXO, bpm: 78, prog: [[0, 3, 6, 3], [5, 6, 0, 3]], pad: 0.3, arp: 'pluck', bass: 0.4, bassLine: 'x.......x.......', drums: 'brush', density: 0.08, vary: { drums: 0.5, arp: 0.3 } }),
  rural: m({ root: 50, scale: DOR, bpm: 66, prog: [[0, 3, 0, 5], [6, 3, 0, 4]], pad: 0.35, arp: 'pluck', density: 0.08, lead: 'pluck', vary: { arp: 0.3 } }),
  forest: m({ root: 45, scale: AEOL, bpm: 60, prog: [[0, 6, 5, 6]], drone: 0.6, pad: 0.4, lead: 'glass', density: 0.07 }),
  island: m({ root: 46, scale: HIJ, bpm: 70, prog: [[0, 1, 0, 6], [0, 3, 1, 0]], drone: 0.6, bass: 0.6, bassLine: 'x.......x.......', lead: 'marimba', drums: 'hand', density: 0.2 }),
  // establishments
  fightclub: m({ root: 40, scale: LOCR, bpm: 126, prog: [[0, 0, 1, 0], [0, 4, 1, 0]], drone: 0.5, bass: 1, bassLine: 'x.xx..x.x.xx..x.', sub: true, stab: 0.7, stabLine: 'x.......x..x....', drums: 'machine', clang: 0.3, vary: { stab: 0.3 } }),
  club: m({ root: 45, scale: AEOL, bpm: 130, prog: [[0, 0, 5, 3], [0, 6, 0, 5]], bass: 1, bassLine: '..x...x...x...x.', sub: true, stab: 0.8, stabLine: '...x..x...x..x..', arp: 'glass', drums: 'four', density: 0.03, vary: { arp: 0.35, stab: 0.2 } }),
  bar: m({ root: 48, scale: DOR, bpm: 84, prog: [[0, 3, 0, 4], [5, 3, 0, 4]], pad: 0.2, bass: 0.8, bassLine: 'x..x..x.x..x..x.', lead: 'keys', drums: 'slow', density: 0.14, seventh: true, swing: 0.2, vary: { lead: 0.3 } }),
  strip: m({ root: 46, scale: HARM, bpm: 70, prog: [[0, 5, 3, 4], [0, 3, 5, 4]], pad: 0.5, bass: 1, bassLine: 'x.....x...x.....', sub: true, stab: 0.3, stabLine: '....x.......x...', drums: 'slow', lead: 'keys', density: 0.08, seventh: true, swing: 0.18, vary: { stab: 0.4 } }),
  prison: m({ root: 38, scale: LOCR, bpm: 54, prog: [[0, 0, 1, 0]], drone: 0.9, clang: 0.7, drums: 'tick', density: 0.03, lead: 'glass', vary: { drums: 0.5 } }),
  hospital: m({ root: 62, scale: LYD, bpm: 60, prog: [[0, 4, 0, 1]], pad: 0.35, lead: 'glass', density: 0.05, monitor: true }),
  dream: m({ root: 49, scale: HIJ, bpm: 46, prog: [[0, 2, 5, 1], [4, 1, 6, 0]], drone: 0.5, pad: 0.8, arp: 'glass', lead: 'glass', density: 0.14, wide: true, seventh: true }),
  // when it goes wrong
  danger: m({ root: 45, scale: LOCR, bpm: 100, prog: [[0, 1, 0, 1]], drone: 0.6, bass: 0.9, bassLine: 'x...x...x...x...', sub: true, drums: 'tick', stab: 0.3, stabLine: '......x.......x.' }),
  combat: m({ root: 50, scale: PHRY, bpm: 138, prog: [[0, 0, 1, 6], [0, 5, 1, 0]], bass: 1, bassLine: 'x.x.xx.xx.x.xx.x', sub: true, stab: 0.8, stabLine: 'x..x..x...x..x..', drums: 'drive', clang: 0.3, vary: { stab: 0.2 } }),
  pursuit: m({ root: 49, scale: HARM, bpm: 154, prog: [[0, 5, 1, 0], [0, 6, 5, 1]], bass: 1, bassLine: 'x.xxx.xxx.xxx.xx', sub: true, stab: 0.8, stabLine: 'x...x..x..x...x.', arp: 'pluck', drums: 'chase', vary: { arp: 0.3 } }),
};
Object.assign(A.moods, MOODS);

// ---------------------------------------------------------------- crossfades: each mood plays through its own gate
const FAST = new Set(['combat', 'pursuit', 'danger']);
const gate = () => {
  const c = A.ctx, dry = c.createGain(), wet = c.createGain();
  dry.gain.value = 0; wet.gain.value = 0; dry.connect(A.musicBus); wet.connect(A.musicVerbIn);
  return { dry, wet };
};
const _mOutOld = A._mOut;
A._mOut = function (vol, wet = 0.3, pan = 0) {
  if (!this._gate) return _mOutOld.call(this, vol, wet, pan);
  const c = this.ctx, g = c.createGain(); g.gain.value = vol;
  let head = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); head = p; }
  head.connect(this._gate.dry);
  if (wet) { const s = c.createGain(); s.gain.value = wet; head.connect(s); s.connect(this._gate.wet); }
  return g;
};
A.setMusic = function (mood) {
  if (this.mood === mood) return;
  this.mood = mood; this._step = 0; this._motif = null; this._sec = null;
  if (!this.ctx) return;
  const c = this.ctx, t = c.currentTime, fade = FAST.has(mood) ? 0.5 : 2.2, old = this._gate;
  if (old) { for (const n of [old.dry, old.wet]) { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0, t + fade); } setTimeout(() => { try { old.dry.disconnect(); old.wet.disconnect(); } catch (e) { /* already gone */ } }, (fade + 8) * 1000); }
  const g = this._gate = gate();
  g.dry.gain.setValueAtTime(0, t); g.dry.gain.linearRampToValueAtTime(1, t + fade); g.wet.gain.setValueAtTime(0, t); g.wet.gain.linearRampToValueAtTime(1, t + fade);
  this._nextNote = t + 0.15;
};

// ---------------------------------------------------------------- voices
A._drone = function (t, f, dur, vol) {   // two low saws beating slowly, behind a closed filter
  const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(180, t); lp.frequency.linearRampToValueAtTime(320, t + dur / 2); lp.frequency.linearRampToValueAtTime(170, t + dur); lp.connect(this._mOut(1, 0.6));
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1); g.connect(lp);
  for (const [r, d] of [[1, -6], [1, 6], [0.5, 0]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * r; o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dur + 1.1); }
};
A._sub = function (t, f, dur, vol) {   // an 808: a sine that falls into its note
  const out = this._mOut(1, 0.04); this._osc(out, t, { f: f * 1.9, f2: f, glide: 0.05, dur, vol, a: 0.003 });
};
A._stab = function (t, freqs, dur, vol, pan = 0) {   // a filtered chord stab
  const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(320, t + Math.max(0.1, dur)); lp.connect(this._mOut(1, 0.45, pan));
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1); g.connect(lp);
  for (const f of freqs) for (const d of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dur + 0.15); }
};
A._glass = function (t, f, vol, pan = 0) { this._ring(this._mOut(1, 0.85, pan), t, f, [[1, 1, 1.5], [2.01, 0.3, 0.8], [3.98, 0.12, 0.35]], vol); };
A._clang = function (t, vol) {   // a struck beam somewhere far off
  const out = this._mOut(1, 0.9, (this._rng.next() - 0.5) * 0.8), f = 90 + this._rng.next() * 90;
  this._ring(out, t, f, [[1, 1, 0.9], [2.76, 0.6, 0.6], [5.4, 0.35, 0.35], [8.93, 0.2, 0.2]], vol);
  this._burst(out, t, { dur: 0.04, vol: vol * 0.7, type: 'bandpass', f: 1900, q: 1.5 });
};
A._beep = function (t, vol) { this._osc(this._mOut(1, 0.3), t, { type: 'sine', f: 988, dur: 0.1, vol, a: 0.004 }); };
const ACCENT = { x: 1, o: 0.7, r: 0.6 };

// ---------------------------------------------------------------- the sequencer
A._schedule = function () {
  if (!this.ctx || !this.mood) return;
  const M = this.moods[this.mood]; if (!M) return;
  const sd = 60 / M.bpm / 4, r = this._rng;
  const noteOf = (d, oct) => { const n = M.scale.length; return M.root + oct * 12 + M.scale[((d % n) + n) % n] + Math.floor(d / n) * 12; };
  while (this._nextNote < this.ctx.currentTime + 0.5) {
    const s = this._step, i16 = s % 16, bar = Math.floor(s / 16);
    let t = this._nextNote;
    if (M.swing && i16 % 2) t += sd * M.swing;
    if (i16 === 0 && (bar % 8 === 0 || !this._sec)) {   // a new section: which progression, who sits out
      const off = {}; for (const k in M.vary) off[k] = r.next() < M.vary[k];
      this._sec = { off, prog: M.prog[Math.floor(bar / 8) % M.prog.length] };
    }
    const sec = this._sec, deg = sec.prog[bar % sec.prog.length], on = (k) => M[k] && !sec.off[k];
    const chord = M.seventh ? [deg, deg + 2, deg + 4, deg + 6] : [deg, deg + 2, deg + 4];
    if (i16 === 0) {
      if (bar % 4 === 0 || !this._motif) this._motif = Array.from({ length: 16 }, (_, k) => (r.chance(M.density * (k % 4 === 0 ? 1.6 : k % 2 === 0 ? 0.9 : 0.35)) ? r.pick([0, 1, 2, 2, 4, 4, 5, 7]) : null));
      if (M.pad) this._pad(t, chord.slice(0, 3).map((d) => this._midi(noteOf(d, 0))), sd * 16, 0.035 * M.pad);
      if (M.drone) this._drone(t, this._midi(noteOf(deg, -2)), sd * 16, 0.05 * M.drone);
    }
    if (M.monitor && i16 === 0) this._beep(t, 0.03);
    if (on('bass') && M.bassLine) {
      const c = M.bassLine[i16];
      if (c !== '.') { const f = this._midi(noteOf(c === 'o' ? deg + 4 : deg, -2)); if (M.sub) this._sub(t, f, sd * 4, 0.34 * M.bass); else this._bassNote(t, f, sd * 3, 0.3 * M.bass); }
    }
    if (on('stab') && M.stabLine[i16] === 'x') this._stab(t, chord.slice(0, 3).map((d) => this._midi(noteOf(d, 0))), sd * 2.4, 0.03 * M.stab, (r.next() - 0.5) * 0.4);
    if (on('arp') && i16 % 2 === 0 && r.chance(0.82)) {
      const a = chord[[0, 1, 2, 1, 3, 2, 1, 2][(i16 / 2) % 8] % chord.length] + (i16 >= 8 ? 7 : 0), f = this._midi(noteOf(a, 0)), pan = (r.next() - 0.5) * (M.wide ? 1.4 : 0.6);
      if (M.arp === 'glass') this._glass(t, f * 2, 0.035, pan); else if (M.arp === 'piano') this._epiano(t, f, sd * 3, 0.04, pan); else this._pluck(t, f, sd * 3, 0.05, pan);
    }
    const mo = on('lead') && this._motif && this._motif[i16];
    if (mo != null && mo !== false) {
      const f = this._midi(noteOf(deg + mo + (bar % 4 === 3 ? 1 : 0), 1)), pan = (r.next() - 0.5) * (M.wide ? 1.2 : 0.4);
      if (M.lead === 'keys') this._epiano(t, f, sd * 5, 0.05, pan); else if (M.lead === 'glass') this._glass(t, f, 0.05, pan); else if (M.lead === 'marimba') this._marimba(t, f, 0.1, pan); else this._pluck(t, f, sd * 4, 0.06, pan);
    }
    if (M.clang && i16 === 0 && r.chance(M.clang * 0.5)) this._clang(t + sd * r.int(0, 15), 0.05);
    const kit = on('drums') && KITS[M.drums];
    if (kit) {
      const v = kit.vol, hit = (name, line, level) => { const c = line && line[i16]; if (c && c !== '.') { if (name === 'clang') this._clang(t, 0.06 * v); else if (name === 'clap') { this._drum('snare', t, level * v); this._drum('rim', t + 0.012, 0.2 * v); } else if (c === 'r') { this._drum(name, t, level * 0.8 * v); this._drum(name, t + sd / 2, level * 0.6 * v); } else this._drum(c === 'o' && name === 'hat' ? 'ohat' : name, t, level * ACCENT[c] * v); } };
      hit('kick', kit.kick, 0.7); hit('clap', kit.clap, 0.5); hit('snare', kit.snare, 0.5); hit('rim', kit.rim, 0.4); hit('hat', kit.hat, 0.2); hit('brush', kit.brush, 0.5); hit('shaker', kit.shaker, 0.35); hit('conga', kit.conga, 0.3); hit('tom', kit.tom, 0.3); hit('clang', kit.clang, 1);
    }
    this._nextNote += sd;
    this._step++;
  }
};

// ---------------------------------------------------------------- what plays, where
const VENUE_MUSIC = { club: 'club', strip: 'strip', dive: 'bar', punk: 'bar', live: 'bar', karaoke: 'bar', pool: 'bar', rooftop: 'bar', den: 'slums_night', casino: 'commercial_night', arcade: 'commercial' };
const DISTRICT = { southside: ['slums', 'slums_night'], eastside: ['slums', 'slums_night'], heights: ['heights', 'heights_night'], neon: ['commercial', 'commercial_night'], arts: ['commercial', 'night'], industrial: ['industrial', 'industrial'], center: ['city', 'night'], suburbs: ['suburbs', 'night'] };
G.score = {
  MOODS,
  place(scene) {
    const map = scene.map, meta = map.meta, p = scene.player, b = map.buildingAt(p.x, p.y - 3), night = scene.world.isNight();
    if (map.id === 'fightclub') return 'fightclub';
    if (meta.district === 'jail') return 'prison';
    if (map.id === 'morgue' || (b && b.id === 'c_hospital')) return 'hospital';
    const v = b && b.venue && G.VENUES[b.venue];
    if (v && VENUE_MUSIC[v.kind]) return VENUE_MUSIC[v.kind];
    if (meta.music === 'island') return 'island';
    const d = DISTRICT[meta.district]; if (d) return d[night ? 1 : 0];
    return night ? 'night' : meta.music || 'city';
  },
  threat(scene) {
    const p = scene.player;
    if ((scene.vehicles || []).some((v) => v.chase) || scene.actors.some((a) => a.kind === 'npc' && a.law && a.state === 'fight' && a.target === p)) return 'pursuit';
    if (scene.actors.some((a) => !a.dead && (a.state === 'fight' || a.state === 'attack') && a.target === p)) return 'combat';
    if (scene.actors.some((a) => a.kind === 'npc' && !a.dead && (a.state === 'mug' || (a.aggressor && a.state !== 'fight')) && Math.hypot(a.x - p.x, a.y - p.y) < 180) || (scene.world.raid && G.TERRITORIES[scene.world.raid.territory] && G.TERRITORIES[scene.world.raid.territory].map === scene.map.id) || p.hp < p.maxHp * 0.2) return 'danger';
    return null;
  },
  pick(scene) { return this.threat(scene) || this.place(scene); },
};
// a fight that just ended does not drop straight back to the street
const GS = G.GameScene.prototype;
GS.updateMusic = function (force = false) {
  const hot = G.score.threat(this);
  if (hot) { this._hotMood = hot; this._hotT = 6; } else if (this._hotT > 0) this._hotT -= 1;
  const mood = hot || (this._hotT > 0 ? this._hotMood : G.score.place(this));
  if (force || mood !== G.audio.mood) G.audio.setMusic(mood);
};
for (const n of ['DreamScene', 'DreamWorldScene']) { const P = G[n] && G[n].prototype; if (!P) continue; const _u = P.update; P.update = function (dt) { G.audio.setMusic('dream'); return _u.call(this, dt); }; }

// ---------------------------------------------------------------- beds: long filtered noise and hum, faded by place
const BEDS = {
  vent: { noise: 'pink', type: 'bandpass', f: 420, q: 0.7, vol: 0.05 },
  machinery: { noise: 'brown', type: 'lowpass', f: 140, q: 2, vol: 0.2, hum: 50 },
  hum: { noise: 'white', type: 'bandpass', f: 120, q: 12, vol: 0.05, hum: 60 },
  crowd: { noise: 'pink', type: 'bandpass', f: 720, q: 1.1, vol: 0.05 },
  rainRoof: { noise: 'white', type: 'bandpass', f: 3400, q: 0.6, vol: 0.05 },
  rainMetal: { noise: 'white', type: 'highpass', f: 5200, q: 0.5, vol: 0.05 },
};
const beds = {};
const bed = (name) => {
  if (beds[name]) return beds[name];
  const c = A.ctx, d = BEDS[name], src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = A._noiseBuf(d.noise); src.loop = true; fl.type = d.type; fl.frequency.value = d.f; fl.Q.value = d.q; g.gain.value = 0;
  src.connect(fl); fl.connect(g); g.connect(A.ambBus); src.start();
  if (d.hum) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = d.hum; og.gain.value = 0.35; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; o.connect(lp); lp.connect(og); og.connect(g); o.start(); }
  return (beds[name] = g);
};
const setBed = (name, level) => { if (!level && !beds[name]) return; const n = bed(name), t = A.ctx.currentTime; n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(BEDS[name].vol * level, t + 1.4); };
const METAL = /wall_metal|shack|chop|garage|warehouse|factory|hangar|container/i;
G.score.beds = (scene) => {
  const map = scene.map, meta = map.meta, p = scene.player, b = map.buildingAt(p.x, p.y - 3), inside = !!(meta.indoor || meta.floorOf || b), W = G.weather, rain = W ? W.rain : 0;
  const v = b && b.venue && G.VENUES[b.venue], loud = v && /club|strip|dive|punk|live|karaoke|casino|arcade/.test(v.kind);
  const works = meta.district === 'industrial', neon = meta.district === 'neon' && scene.world.isNight();
  const out = {
    vent: inside && meta.district !== 'jail' ? 1 : 0,
    machinery: works ? (inside ? 1 : 0.55) : meta.district === 'jail' ? 0.3 : 0,
    hum: neon ? 0.7 : inside ? 0.45 : 0,
    crowd: loud ? 1 : 0,
    rainRoof: inside && !METAL.test(b ? b.name || '' : '') ? rain : 0,
    rainMetal: inside && METAL.test(b ? b.name || '' : '') ? rain * 1.2 : 0,
  };
  for (const k in out) setBed(k, out[k]);
};
A.SFX.splash = function (o, T, R) {   // water poured or thrown: a slap, then it runs off
  const w = T._out(o, { vol: 0.7, wet: 0.3, range: 240 }); if (!w) return;
  T._burst(w.node, w.t, { dur: 0.09, vol: 0.5, type: 'lowpass', f: 1400, f2: 500 });
  T._burst(w.node, w.t + 0.05, { dur: 0.42, vol: 0.26, type: 'bandpass', f: 2200, f2: 900, q: 0.7 });
  for (let i = 0; i < 5; i++) T._osc(w.node, w.t + 0.08 + R() * 0.3, { f: 500 + R() * 700, f2: 900 + R() * 500, dur: 0.05, vol: 0.05 });
};
A.SFX.register = function (o, T) {   // the till: keys, the bell, the drawer
  const w = T._out(o, { vol: 0.6, wet: 0.2 }); if (!w) return;
  for (let i = 0; i < 3; i++) T._burst(w.node, w.t + i * 0.06, { dur: 0.012, vol: 0.28, type: 'bandpass', f: 2600, q: 3 });
  T._ring(w.node, w.t + 0.2, 2640, [[1, 1, 0.5], [2.76, 0.4, 0.22]], 0.16);
  T._burst(w.node, w.t + 0.24, { noise: 'brown', dur: 0.16, vol: 0.34, f: 600 });
};
A.SFX.page = function (o, T) {   // paper turned
  const w = T._out(o, { vol: 0.5, wet: 0.08 }); if (!w) return;
  T._burst(w.node, w.t, { dur: 0.17, vol: 0.2, a: 0.05, type: 'bandpass', f: 3400, f2: 1800, q: 0.6 });
};
// police radios: bursts of squelch and a voice you cannot quite make out
A.SFX.radio = function (o, T, R) {
  const w = T._out(o, { vol: 0.5, wet: 0.2, range: 240, ref: 60 }); if (!w) return;
  T._burst(w.node, w.t, { dur: 0.09, vol: 0.3, type: 'bandpass', f: 2400, q: 1.2 });
  const n = 3 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) T._osc(w.node, w.t + 0.1 + i * 0.13, { type: 'square', f: 420 + R() * 340, f2: 300 + R() * 260, dur: 0.1, vol: 0.09, a: 0.01 });
  T._burst(w.node, w.t + 0.16 + n * 0.13, { dur: 0.13, vol: 0.28, type: 'bandpass', f: 2800, q: 1.2 });
};
const _ss = G.soundscape.update;
let bedT = 0, radioT = 6;
G.soundscape.update = function (scene, dt) {
  _ss.call(this, scene, dt);
  if (!A.ctx || !scene.map || !scene.player) return;
  if ((bedT -= dt) <= 0) { bedT = 0.8; G.score.beds(scene); }
  if ((radioT -= dt) <= 0) { radioT = 9 + Math.random() * 16; const c = scene.actors.find((a) => a.kind === 'npc' && !a.dead && (a.law || a.def.combat === 'guard') && Math.hypot(a.x - scene.player.x, a.y - scene.player.y) < 220); if (c) A.play('radio', { x: c.x, y: c.y }); }
};
})();
