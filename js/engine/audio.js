'use strict';
// Audio: procedural sound effects, ambience, vehicle engines and generative music using WebAudio.
// No audio files needed: every sound is synthesized from physically-inspired layers (transient,
// body, tail), run through a convolution reverb that matches the space you are in.
//
//   play(name, { x, y, vol, rate, surface, delay })   one-shot; x/y make it positional (pan,
//                                                      distance falloff, air absorption, speed of sound)
//   setSpace('street' | 'outdoor' | 'forest' | 'room' | 'hall' | 'none')   reverb character
//   setAmbience({ wind, traffic, birds, crickets, waves, rain, room, crowd, frogs, night, storm, muffle })
//   engine(id, { rpm, load, moto, x, y })  /  engineStop(id)      continuous vehicle engines
//   setMusic(mood)                                                  generative score
// To use real audio files later, add a loader here and keep the same API.

G.audio = {
  ctx: null,
  master: null, musicBus: null, sfxBus: null, ambBus: null,
  mood: null,
  listener: { x: 0, y: 0, on: false, indoor: false },
  _timer: null,
  _nextNote: 0,
  _step: 0,
  _rng: new G.RNG(1234),
  _bufs: {},
  _engines: {},
  _amb: {},
  _ambTarget: {},
  _lastPlay: {},
  PX_PER_M: 16,

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        // master chain: buses -> master -> gentle glue compressor -> limiter -> out
        this.master = c.createGain();
        const glue = c.createDynamicsCompressor();
        glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.25;
        const lim = c.createDynamicsCompressor();
        lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
        this.master.connect(glue); glue.connect(lim); lim.connect(c.destination);
        this.musicBus = c.createGain(); this.musicBus.connect(this.master);
        this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
        this.ambBus = c.createGain(); this.ambBus.connect(this.sfxBus);
        // world reverb: two convolvers so spaces can crossfade without clicks
        this.verbIn = c.createGain();
        this.verbA = c.createConvolver(); this.verbB = c.createConvolver();
        this.verbGA = c.createGain(); this.verbGB = c.createGain();
        this.verbIn.connect(this.verbA); this.verbIn.connect(this.verbB);
        this.verbA.connect(this.verbGA); this.verbB.connect(this.verbGB);
        this.verbGA.connect(this.sfxBus); this.verbGB.connect(this.sfxBus);
        this.verbGB.gain.value = 0;
        this._verbSlot = 'A';
        this.space = null;
        this.setSpace('outdoor');
        // music reverb: a soft hall
        this.musicVerb = c.createConvolver();
        this.musicVerb.buffer = this._impulse(2.6, 0.35, 3200, 0.02);
        this.musicVerbIn = c.createGain();
        this.musicVerbIn.connect(this.musicVerb);
        const mvOut = c.createGain(); mvOut.gain.value = 0.6;
        this.musicVerb.connect(mvOut); mvOut.connect(this.musicBus);
        this.applyVolumes();
        G.events.on('settingsChanged', () => this.applyVolumes());
        this._timer = setInterval(() => this._tick(), 100);
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  applyVolumes() {
    if (!this.ctx) return;
    const s = G.settings;
    this.master.gain.value = s.get('masterVolume');
    this.musicBus.gain.value = s.get('musicVolume') * 0.3;
    this.sfxBus.gain.value = s.get('sfxVolume') * 0.7;
  },

  // ---------------------------------------------------------------- building blocks
  // cached noise: white, pink (1/f, natural), brown (1/f², rumble)
  _noiseBuf(kind) {
    if (this._bufs[kind]) return this._bufs[kind];
    const c = this.ctx, len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'white') for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    }
    return (this._bufs[kind] = buf);
  },

  // a synthetic room response: early reflections + a damped exponential tail (stereo decorrelated)
  _impulse(decay, density = 0.5, damp = 6000, early = 0.012) {
    const c = this.ctx, sr = c.sampleRate, len = Math.max(1, Math.floor(sr * decay));
    const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.pow(1 - i / len, 2.2) * Math.exp(-t * 3 / decay);
        // high frequencies die faster: the one-pole lowpass closes as the tail goes on
        const k = Math.min(1, (damp / sr) * 6.28 / (1 + t * 4));
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * env * (t < early ? 0 : 1);
      }
      // early reflections: a few discrete echoes off nearby surfaces
      const n = Math.round(4 + density * 10);
      for (let r = 0; r < n; r++) {
        const at = Math.floor(sr * (early + Math.random() * 0.07 * (1 + density)));
        if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - r * 0.03) * (0.6 + Math.random() * 0.4);
      }
    }
    return buf;
  },

  SPACES: {
    none:    { decay: 0.3, wet: 0.0, damp: 4000, density: 0.1 },
    outdoor: { decay: 1.0, wet: 0.12, damp: 3500, density: 0.15, early: 0.03 },
    forest:  { decay: 1.6, wet: 0.2, damp: 2400, density: 0.6, early: 0.02 },
    street:  { decay: 1.5, wet: 0.24, damp: 5000, density: 0.9, early: 0.015 },
    room:    { decay: 0.55, wet: 0.2, damp: 5500, density: 1, early: 0.004 },
    hall:    { decay: 2.0, wet: 0.28, damp: 4500, density: 1, early: 0.01 },
    cell:    { decay: 0.9, wet: 0.3, damp: 7000, density: 1, early: 0.003 },
  },
  setSpace(name) {
    if (!this.ctx || this.space === name || !this.SPACES[name]) return;
    this.space = name;
    const sp = this.SPACES[name], c = this.ctx, t = c.currentTime;
    this._irCache = this._irCache || {};
    const ir = this._irCache[name] || (this._irCache[name] = this._impulse(sp.decay, sp.density, sp.damp, sp.early || 0.01));
    const toB = this._verbSlot === 'A';
    const nextConv = toB ? this.verbB : this.verbA, nextG = toB ? this.verbGB : this.verbGA, prevG = toB ? this.verbGA : this.verbGB;
    try { nextConv.buffer = ir; } catch (e) { /* buffer already set on some engines: fine */ }
    nextG.gain.cancelScheduledValues(t); prevG.gain.cancelScheduledValues(t);
    nextG.gain.setTargetAtTime(1, t, 0.25); prevG.gain.setTargetAtTime(0, t, 0.25);
    this._verbSlot = toB ? 'B' : 'A';
    this.spaceWet = sp.wet;
  },

  // Where a one-shot goes: volume, stereo position, distance (falloff + air absorption + delay), reverb send.
  _out(opts = {}, def = {}) {
    const c = this.ctx;
    const range = def.range || 420;
    let vol = (opts.vol != null ? opts.vol : 1) * (def.vol != null ? def.vol : 1);
    let pan = 0, dist = 0, delay = opts.delay || 0;
    const L = this.listener;
    if (opts.x != null && L.on) {
      const dx = opts.x - L.x, dy = opts.y - L.y;
      dist = Math.hypot(dx, dy);
      if (dist > range) return null;
      const ref = def.ref || 48;
      vol *= dist <= ref ? 1 : Math.pow(ref / dist, 1.15);
      vol *= 1 - Math.pow(dist / range, 4);
      pan = Math.max(-0.9, Math.min(0.9, dx / 220));
      delay += dist / this.PX_PER_M / 343;      // sound travels ~343 m/s
      if (opts.indoor != null && opts.indoor !== L.indoor) vol *= 0.35;   // through a wall
    }
    if (vol < 0.003) return null;
    const g = c.createGain();
    g.gain.value = vol;
    let head = g;
    if (dist > 60 || (opts.indoor != null && L.on && opts.indoor !== L.indoor)) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      const occl = opts.indoor != null && opts.indoor !== L.indoor;
      lp.frequency.value = Math.max(occl ? 700 : 900, 18000 * Math.pow(1 - Math.min(1, dist / range), 2.2) * (occl ? 0.15 : 1));
      g.connect(lp); head = lp;
    }
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = pan; head.connect(p); head = p; }
    head.connect(opts.bus || this.sfxBus);
    // farther sources sound more reverberant (direct sound drops faster than the room)
    const wet = (def.wet != null ? def.wet : 1) * (this.spaceWet || 0) * (1 + Math.min(2, dist / 160));
    if (wet > 0.001) { const s = c.createGain(); s.gain.value = wet; head.connect(s); s.connect(this.verbIn); }
    return { node: g, t: c.currentTime + delay + 0.005, dist, vol };
  },

  // oscillator voice: f -> f2 glide, attack, exponential decay
  _osc(out, t, { type = 'sine', f = 440, f2 = 0, glide = 0, dur = 0.2, vol = 0.3, a = 0.004, detune = 0, hold = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(10, f2), t + (glide || dur));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (hold) g.gain.setValueAtTime(vol, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + a + hold + dur + 0.05);
    return o;
  },

  // filtered noise burst with an optional filter sweep
  _burst(out, t, { noise = 'white', dur = 0.1, vol = 0.3, a = 0.002, type = 'lowpass', f = 1200, f2 = 0, q = 0.8, hold = 0, rate = 1 } = {}) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this._noiseBuf(noise);
    src.loop = true;
    src.playbackRate.value = rate;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + hold + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (hold) g.gain.setValueAtTime(vol, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + dur);
    src.connect(fl); fl.connect(g); g.connect(out);
    src.start(t, Math.random() * 2.5); src.stop(t + a + hold + dur + 0.05);
    return fl;
  },

  // struck metal / glass / wood: inharmonic partials, each with its own decay
  _ring(out, t, f, partials, vol = 0.2) {
    for (const [ratio, amp, decay] of partials) this._osc(out, t, { f: f * ratio, dur: decay, vol: vol * amp, a: 0.001 });
  },

  // soft saturation for horns and engines
  _shaper(amount = 3) {
    const k = 256, curve = new Float32Array(k);
    for (let i = 0; i < k; i++) { const x = (i / (k - 1)) * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    const s = this.ctx.createWaveShaper(); s.curve = curve; s.oversample = '2x';
    return s;
  },

  // legacy helpers (kept for older call sites)
  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, bus = null, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    this._osc(bus || this.sfxBus, this.ctx.currentTime + delay, { type, f: freq, f2: slide ? Math.max(20, freq + slide) : 0, dur, vol, a: attack });
  },
  noise(dur, { vol = 0.3, freq = 1200, delay = 0, q = 1, type = 'lowpass' } = {}) {
    if (!this.ctx) return;
    this._burst(this.sfxBus, this.ctx.currentTime + delay, { dur, vol, f: freq, q, type });
  },

  // ---------------------------------------------------------------- one-shots
  // footstep surfaces by tile name
  surfaceOf(tileName) {
    if (!tileName) return 'concrete';
    if (/water|pool/.test(tileName)) return 'water';
    if (/grass|wheat|cabbage|field|hedge/.test(tileName)) return 'grass';
    if (/sand/.test(tileName)) return 'sand';
    if (/dirt|path|ash|burnt|lot/.test(tileName)) return 'dirt';
    if (/wood|bridge|dock|door|ruin/.test(tileName)) return 'wood';
    if (/carpet/.test(tileName)) return 'carpet';
    if (/tile|marble|stonefloor/.test(tileName)) return 'tile';
    if (/rubble/.test(tileName)) return 'gravel';
    return 'concrete';
  },

  play(name, opts = {}) {
    if (!this.ctx) return;
    // de-duplicate identical sounds fired in the same frame (crowds of hits, pellets...)
    const now = this.ctx.currentTime;
    if (opts.x == null && this._lastPlay[name] && now - this._lastPlay[name] < 0.02) return;
    this._lastPlay[name] = now;
    const T = this, R = Math.random;
    const vary = (v, k = 0.08) => v * (1 + (R() * 2 - 1) * k);
    const fn = this.SFX[name] || this.SFX._default;
    try { fn.call(this, opts, T, R, vary); } catch (e) { /* never let a sound break the game */ }
  },

  SFX: {
    // ---------- interface: soft, clean, modern ----------
    select(o, T) { const w = T._out(o, { vol: 0.5, wet: 0 }); if (!w) return; T._osc(w.node, w.t, { f: 1760, dur: 0.035, vol: 0.12 }); T._osc(w.node, w.t, { f: 880, dur: 0.05, vol: 0.06 }); },
    confirm(o, T) { const w = T._out(o, { vol: 0.5, wet: 0.2 }); if (!w) return; T._osc(w.node, w.t, { f: 1046, dur: 0.12, vol: 0.12, a: 0.003 }); T._osc(w.node, w.t + 0.055, { f: 1568, dur: 0.18, vol: 0.1, a: 0.003 }); },
    back(o, T) { const w = T._out(o, { vol: 0.5, wet: 0.1 }); if (!w) return; T._osc(w.node, w.t, { f: 784, f2: 523, dur: 0.12, vol: 0.1 }); },
    error(o, T) { const w = T._out(o, { vol: 0.5, wet: 0 }); if (!w) return; T._osc(w.node, w.t, { type: 'triangle', f: 196, dur: 0.12, vol: 0.18 }); T._osc(w.node, w.t + 0.1, { type: 'triangle', f: 185, dur: 0.16, vol: 0.16 }); },
    click(o, T) { const w = T._out(o, { vol: 0.6, wet: 0.1 }); if (!w) return; T._burst(w.node, w.t, { dur: 0.012, vol: 0.4, type: 'bandpass', f: 3800, q: 3 }); T._osc(w.node, w.t, { f: 2900, dur: 0.02, vol: 0.05 }); },
    quest(o, T) {   // a warm bell chord
      const w = T._out(o, { vol: 0.45, wet: 2 }); if (!w) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => T._ring(w.node, w.t + i * 0.09, f, [[1, 1, 1.4], [2.0, 0.35, 0.7], [3.01, 0.15, 0.35], [4.2, 0.06, 0.2]], 0.1));
    },
    sleep(o, T) { const w = T._out(o, { vol: 0.4, wet: 2 }); if (!w) return; [392, 329.6, 261.6].forEach((f, i) => T._ring(w.node, w.t + i * 0.35, f, [[1, 1, 1.8], [2, 0.2, 0.8]], 0.12)); },
    coin(o, T, R) {   // coins clinking in the hand
      const w = T._out(o, { vol: 0.6, wet: 0.4 }); if (!w) return;
      for (let i = 0; i < 3; i++) T._ring(w.node, w.t + i * 0.045 + R() * 0.02, 2600 + R() * 1400, [[1, 1, 0.18], [2.76, 0.5, 0.09], [5.4, 0.25, 0.05]], 0.07);
    },
    pickup(o, T) {   // cloth rustle + a soft tap
      const w = T._out(o, { vol: 0.6, wet: 0.3 }); if (!w) return;
      T._burst(w.node, w.t, { noise: 'pink', dur: 0.12, vol: 0.25, type: 'bandpass', f: 2500, f2: 1400, q: 0.9, a: 0.02 });
      T._osc(w.node, w.t + 0.07, { f: 300, f2: 150, dur: 0.05, vol: 0.18 });
    },
    alarm(o, T) {   // an electronic alarm: square-ish two-tone through a small speaker
      const w = T._out(o, { vol: 0.5, wet: 0.6, range: 700, ref: 120 }); if (!w) return;
      const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7; bp.connect(w.node);
      for (let i = 0; i < 6; i++) T._osc(bp, w.t + i * 0.22, { type: 'square', f: i % 2 ? 960 : 1280, dur: 0.18, vol: 0.12, a: 0.005, hold: 0.02 });
    },
    // ---------- body ----------
    step(o, T, R, vary) {
      const s = o.surface || 'concrete';
      const w = T._out(o, { vol: (o.run ? 1.3 : 1) * 0.9, wet: 0.4, range: 180, ref: 24 }); if (!w) return;
      const n = w.node, t = w.t;
      switch (s) {
        case 'grass': T._burst(n, t, { noise: 'white', dur: vary(0.07), vol: 0.09, type: 'highpass', f: vary(3000, 0.2), q: 0.5, a: 0.01 }); T._burst(n, t + 0.02, { noise: 'pink', dur: 0.06, vol: 0.06, type: 'bandpass', f: 1800, q: 0.7 }); break;
        case 'sand': T._burst(n, t, { noise: 'pink', dur: vary(0.11), vol: 0.1, type: 'bandpass', f: vary(1500, 0.2), f2: 900, q: 0.6, a: 0.02 }); break;
        case 'dirt': T._burst(n, t, { noise: 'pink', dur: 0.06, vol: 0.12, type: 'bandpass', f: vary(900, 0.2), q: 0.9 }); T._burst(n, t + 0.01, { noise: 'white', dur: 0.03, vol: 0.04, type: 'highpass', f: 4000 }); break;
        case 'gravel': for (let i = 0; i < 4; i++) T._burst(n, t + i * 0.012, { dur: 0.02, vol: 0.08, type: 'bandpass', f: vary(3500, 0.3), q: 2 }); break;
        case 'wood': T._osc(n, t, { f: vary(180, 0.1), f2: 110, dur: 0.07, vol: 0.2 }); T._burst(n, t, { noise: 'pink', dur: 0.05, vol: 0.12, type: 'bandpass', f: vary(420, 0.1), q: 3 }); break;
        case 'carpet': T._burst(n, t, { noise: 'pink', dur: 0.06, vol: 0.06, type: 'lowpass', f: 500 }); break;
        case 'tile': T._burst(n, t, { dur: 0.012, vol: 0.18, type: 'bandpass', f: vary(3200, 0.15), q: 2 }); T._osc(n, t, { f: vary(140), f2: 90, dur: 0.04, vol: 0.12 }); break;
        case 'water': T._burst(n, t, { noise: 'white', dur: vary(0.16), vol: 0.16, type: 'bandpass', f: vary(900, 0.2), f2: 2600, q: 1.5, a: 0.01 }); T._burst(n, t + 0.05, { noise: 'pink', dur: 0.12, vol: 0.06, type: 'bandpass', f: 1800, f2: 600, q: 4 }); break;
        default: T._burst(n, t, { dur: 0.015, vol: 0.14, type: 'bandpass', f: vary(2400, 0.15), q: 1.5 }); T._osc(n, t, { f: vary(110), f2: 70, dur: 0.05, vol: 0.12 }); T._burst(n, t + 0.035, { noise: 'pink', dur: 0.03, vol: 0.04, type: 'highpass', f: 2500 });
      }
    },
    swing(o, T, R, vary) { const w = T._out(o, { vol: 0.8, wet: 0.2, range: 220 }); if (!w) return; T._burst(w.node, w.t, { noise: 'pink', dur: vary(0.14), vol: 0.35, type: 'bandpass', f: 500, f2: 2200, q: 1.8, a: 0.05 }); },
    whoosh(o, T, R, vary) { const w = T._out(o, { vol: 0.9, wet: 0.2, range: 220 }); if (!w) return; T._burst(w.node, w.t, { noise: 'pink', dur: vary(0.18), vol: 0.4, type: 'bandpass', f: 300, f2: 1600, q: 2.2, a: 0.07 }); T._osc(w.node, w.t + 0.12, { f: vary(95), f2: 45, dur: 0.12, vol: 0.45 }); T._burst(w.node, w.t + 0.12, { noise: 'brown', dur: 0.1, vol: 0.5, f: 400 }); },
    punch(o, T, R, vary) {   // a fist on a body: low thump, slap of skin, cloth
      const w = T._out(o, { vol: 1, wet: 0.25, range: 260 }); if (!w) return;
      T._osc(w.node, w.t, { f: vary(130), f2: 45, dur: 0.09, vol: 0.6 });
      T._burst(w.node, w.t, { noise: 'brown', dur: 0.08, vol: 0.6, f: 500 });
      T._burst(w.node, w.t, { dur: 0.015, vol: 0.25, type: 'highpass', f: 2500 });
      T._burst(w.node, w.t + 0.01, { noise: 'pink', dur: 0.06, vol: 0.1, type: 'bandpass', f: 1600, q: 0.8 });
    },
    hit(o, T, R, vary) { T.SFX.punch.call(T, o, T, R, vary); },
    stab(o, T, R, vary) {
      const w = T._out(o, { vol: 1, wet: 0.2, range: 220 }); if (!w) return;
      T._burst(w.node, w.t, { noise: 'pink', dur: 0.06, vol: 0.3, type: 'bandpass', f: 900, f2: 300, q: 2 });
      T._burst(w.node, w.t + 0.02, { noise: 'white', dur: 0.09, vol: 0.12, type: 'bandpass', f: 1400, f2: 500, q: 5 });   // wet squelch
      T._osc(w.node, w.t, { f: vary(90), f2: 50, dur: 0.06, vol: 0.3 });
    },
    slash(o, T, R, vary) { T.SFX.whoosh.call(T, Object.assign({}, o, { vol: (o.vol || 1) * 0.7 }), T, R, vary); const w = T._out(o, { vol: 1, wet: 0.2, range: 220 }); if (!w) return; T._burst(w.node, w.t + 0.12, { noise: 'white', dur: 0.08, vol: 0.18, type: 'bandpass', f: 1800, f2: 700, q: 4 }); },
    chop(o, T, R, vary) { const w = T._out(o, { vol: 1, wet: 0.3, range: 280 }); if (!w) return; T._osc(w.node, w.t, { f: vary(220), f2: 90, dur: 0.1, vol: 0.4 }); T._burst(w.node, w.t, { noise: 'pink', dur: 0.12, vol: 0.4, type: 'bandpass', f: 700, q: 1.5 }); T._burst(w.node, w.t + 0.01, { dur: 0.02, vol: 0.3, type: 'highpass', f: 3000 }); },
    slam(o, T, R, vary) {   // a heavy blow or a door slammed shut
      const w = T._out(o, { vol: 1, wet: 0.8, range: 400 }); if (!w) return;
      T._osc(w.node, w.t, { f: vary(80), f2: 35, dur: 0.25, vol: 0.8 });
      T._burst(w.node, w.t, { noise: 'brown', dur: 0.3, vol: 0.8, f: 380 });
      T._burst(w.node, w.t, { dur: 0.04, vol: 0.3, type: 'bandpass', f: 1800, q: 1 });
    },
    hurt(o, T, R, vary) {   // a pained grunt: glottal buzz through two vowel formants
      const w = T._out(o, { vol: 0.8, wet: 0.25, range: 260 }); if (!w) return;
      const f0 = vary(150, 0.15);
      const mix = T.ctx.createGain(); mix.gain.value = 1;
      for (const [ff, q, a] of [[650, 6, 1], [1150, 8, 0.6], [2600, 10, 0.25]]) { const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vary(ff, 0.1); bp.Q.value = q; const g = T.ctx.createGain(); g.gain.value = a; mix.connect(bp); bp.connect(g); g.connect(w.node); }
      T._osc(mix, w.t, { type: 'sawtooth', f: f0 * 1.15, f2: f0 * 0.8, dur: 0.22, vol: 0.9, a: 0.02 });
      T._burst(mix, w.t, { noise: 'pink', dur: 0.2, vol: 0.15, type: 'bandpass', f: 1500, q: 0.5, a: 0.02 });
    },
    death(o, T, R, vary) {   // a dying groan, then the body hits the ground
      const w = T._out(o, { vol: 0.8, wet: 0.35, range: 300 }); if (!w) return;
      const f0 = vary(130, 0.15);
      const mix = T.ctx.createGain();
      for (const [ff, q, a] of [[600, 5, 1], [1000, 7, 0.5], [2400, 9, 0.2]]) { const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; const g = T.ctx.createGain(); g.gain.value = a; mix.connect(bp); bp.connect(g); g.connect(w.node); }
      T._osc(mix, w.t, { type: 'sawtooth', f: f0, f2: f0 * 0.6, dur: 0.55, vol: 0.7, a: 0.05, hold: 0.1 });
      T._burst(mix, w.t, { noise: 'pink', dur: 0.6, vol: 0.12, type: 'bandpass', f: 1200, q: 0.5, a: 0.05 });
      T._osc(w.node, w.t + 0.55, { f: 90, f2: 40, dur: 0.18, vol: 0.6 });
      T._burst(w.node, w.t + 0.55, { noise: 'brown', dur: 0.25, vol: 0.7, f: 350 });
      T._burst(w.node, w.t + 0.6, { noise: 'pink', dur: 0.15, vol: 0.15, type: 'bandpass', f: 2000, q: 0.7 });
    },
    death_f(o, T, R, vary) {   // a woman dying: a sharp cry breaking into a falling, breathy wail, then the body hits the ground
      const w = T._out(o, { vol: 0.8, wet: 0.35, range: 300 }); if (!w) return;
      const f0 = vary(255, 0.12);
      const mix = T.ctx.createGain();
      for (const [ff, q, a] of [[880, 6, 1], [1300, 8, 0.55], [2900, 10, 0.3], [3800, 12, 0.12]]) { const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vary(ff, 0.06); bp.Q.value = q; const g = T.ctx.createGain(); g.gain.value = a; mix.connect(bp); bp.connect(g); g.connect(w.node); }
      T._osc(mix, w.t, { type: 'sawtooth', f: f0 * 1.35, f2: f0 * 1.15, dur: 0.2, vol: 0.75, a: 0.01, hold: 0.06 });               // the cry
      T._osc(mix, w.t + 0.17, { type: 'sawtooth', f: f0 * 1.2, f2: f0 * 0.62, dur: 0.7, vol: 0.6, a: 0.04, hold: 0.15 });        // the wail falling away
      T._osc(mix, w.t + 0.19, { type: 'triangle', f: f0 * 1.22, f2: f0 * 0.66, dur: 0.66, vol: 0.18, a: 0.05 });                // (a second voice a hair off: a shaky, broken tone)
      T._burst(mix, w.t + 0.1, { noise: 'pink', dur: 0.85, vol: 0.2, type: 'bandpass', f: 2200, q: 0.6, a: 0.06 });           // breath
      T._burst(w.node, w.t + 0.82, { noise: 'pink', dur: 0.3, vol: 0.08, type: 'bandpass', f: 1400, f2: 700, q: 1, a: 0.04 }); // the last exhale
      T._osc(w.node, w.t + 0.9, { f: 95, f2: 42, dur: 0.18, vol: 0.55 });
      T._burst(w.node, w.t + 0.9, { noise: 'brown', dur: 0.25, vol: 0.65, f: 350 });
      T._burst(w.node, w.t + 0.95, { noise: 'pink', dur: 0.15, vol: 0.14, type: 'bandpass', f: 2000, q: 0.7 });
    },
    eat(o, T, R) { const w = T._out(o, { vol: 0.8, wet: 0.1 }); if (!w) return; for (let i = 0; i < 4; i++) { const t = w.t + i * 0.16 + R() * 0.04; for (let k = 0; k < 3; k++) T._burst(w.node, t + k * 0.012, { dur: 0.025, vol: 0.12, type: 'bandpass', f: 1800 + R() * 2400, q: 2 }); T._burst(w.node, t, { noise: 'brown', dur: 0.06, vol: 0.2, f: 300 }); } },
    drink(o, T, R) {   // gulps: a low bubble pop each swallow
      const w = T._out(o, { vol: 0.8, wet: 0.1 }); if (!w) return;
      for (let i = 0; i < 3; i++) { const t = w.t + i * 0.34; T._osc(w.node, t, { f: 260 + R() * 40, f2: 520, dur: 0.06, vol: 0.18, glide: 0.04 }); T._burst(w.node, t + 0.02, { noise: 'brown', dur: 0.12, vol: 0.25, f: 250 }); T._osc(w.node, t + 0.12, { f: 700 + R() * 300, f2: 1400, dur: 0.03, vol: 0.05 }); }
    },
    lighter(o, T) {   // flint wheel, spark, flame catching
      const w = T._out(o, { vol: 0.8, wet: 0.15 }); if (!w) return;
      T._burst(w.node, w.t, { noise: 'white', dur: 0.06, vol: 0.25, type: 'bandpass', f: 5000, q: 2, a: 0.01 });
      T._ring(w.node, w.t + 0.05, 4200, [[1, 1, 0.04], [1.7, 0.5, 0.03]], 0.06);
      T._burst(w.node, w.t + 0.08, { noise: 'pink', dur: 0.3, vol: 0.12, type: 'lowpass', f: 1500, a: 0.03 });
    },
    inhale(o, T) { const w = T._out(o, { vol: 0.7, wet: 0.1 }); if (!w) return; T._burst(w.node, w.t, { noise: 'pink', dur: 0.4, vol: 0.12, type: 'bandpass', f: 900, f2: 1600, q: 1.2, a: 0.25 }); T._burst(w.node, w.t + 0.1, { noise: 'white', dur: 0.3, vol: 0.03, type: 'highpass', f: 6000, a: 0.1 }); },
    exhale(o, T) { const w = T._out(o, { vol: 0.7, wet: 0.15 }); if (!w) return; T._burst(w.node, w.t, { noise: 'pink', dur: 0.9, vol: 0.14, type: 'bandpass', f: 1200, f2: 500, q: 0.8, a: 0.08 }); },
    // ---------- world ----------
    door(o, T, R, vary) {   // latch, a short hinge creak, the door settling
      const w = T._out(o, { vol: 0.9, wet: 0.6, range: 300 }); if (!w) return;
      T._burst(w.node, w.t, { dur: 0.015, vol: 0.3, type: 'bandpass', f: 3000, q: 3 });
      T._ring(w.node, w.t, 1900, [[1, 1, 0.05], [2.3, 0.5, 0.03]], 0.06);
      const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vary(1100, 0.2); bp.Q.value = 9; bp.connect(w.node);
      const creak = T._osc(bp, w.t + 0.04, { type: 'sawtooth', f: vary(55, 0.3), f2: vary(38, 0.3), dur: 0.28, vol: 0.35, a: 0.05 });
      const lfo = T.ctx.createOscillator(), lg = T.ctx.createGain(); lfo.frequency.value = 23; lg.gain.value = 12; lfo.connect(lg); lg.connect(creak.frequency); lfo.start(w.t); lfo.stop(w.t + 0.4);
      T._osc(w.node, w.t + 0.32, { f: 85, f2: 45, dur: 0.12, vol: 0.35 });
      T._burst(w.node, w.t + 0.32, { noise: 'brown', dur: 0.12, vol: 0.35, f: 400 });
    },
    explosion(o, T, R) {   // shock crack, a long rolling body, sub-bass, falling debris, a big tail
      const w = T._out(o, { vol: 1, wet: 2.2, range: 1600, ref: 140 }); if (!w) return;
      const n = w.node, t = w.t, far = w.dist > 300;
      if (!far) T._burst(n, t, { noise: 'white', dur: 0.05, vol: 1, type: 'highpass', f: 1200 });
      T._burst(n, t, { noise: 'brown', dur: 2.6, vol: 1.2, f: far ? 400 : 2400, f2: 90, a: 0.008, hold: 0.15 });
      T._burst(n, t, { noise: 'pink', dur: 1.4, vol: 0.5, f: 3200, f2: 300, a: 0.005 });
      T._osc(n, t, { f: 58, f2: 24, dur: 1.8, vol: 0.9, a: 0.01 });
      T._osc(n, t, { type: 'triangle', f: 90, f2: 30, dur: 0.6, vol: 0.5 });
      for (let i = 0; i < 26; i++) { const dt = 0.25 + Math.pow(R(), 1.6) * 2.4; T._burst(n, t + dt, { dur: 0.02 + R() * 0.03, vol: 0.06 + R() * 0.12, type: 'bandpass', f: 1500 + R() * 4000, q: 1.5 }); }
      for (let i = 0; i < 4; i++) T._ring(n, t + 0.4 + R() * 1.6, 2200 + R() * 3000, [[1, 1, 0.3], [2.7, 0.4, 0.15], [5.1, 0.2, 0.08]], 0.04);   // glass and metal
    },
    _gun(o, T, R, vary, k) {   // the crack (muzzle blast), the body, the mechanism, the echo off the world
      const w = T._out(o, { vol: 1, wet: k.wet, range: k.range, ref: 70 }); if (!w) return;
      const n = w.node, t = w.t, far = Math.min(1, w.dist / k.range * 1.6);
      T._burst(n, t, { noise: 'white', dur: k.crack, vol: 1.1 * (1 - far * 0.8), type: 'highpass', f: k.crackF });
      T._burst(n, t, { noise: 'white', dur: k.body, vol: 0.9, f: vary(k.bodyF * (1 - far * 0.6), 0.1), f2: k.bodyF * 0.25, a: 0.001 });
      T._burst(n, t, { noise: 'brown', dur: k.body * 1.8, vol: 0.9, f: 600, f2: 120, a: 0.002 });
      T._osc(n, t, { f: vary(k.thump), f2: k.thump * 0.35, dur: k.body * 1.3, vol: 0.7 });
      if (k.mech && w.dist < 140) { T._burst(n, t + k.mech, { dur: 0.012, vol: 0.18, type: 'bandpass', f: 3600, q: 4 }); T._ring(n, t + k.mech + 0.02, 2900, [[1, 1, 0.03], [2.4, 0.5, 0.02]], 0.05); }
      // a slap-back echo from buildings / trees
      T._burst(n, t + k.echo + R() * 0.03, { noise: 'pink', dur: k.body * 2, vol: 0.18, f: 1400, f2: 300 });
      T._burst(n, t + k.echo * 2.2 + R() * 0.05, { noise: 'pink', dur: k.body * 3, vol: 0.08, f: 900, f2: 200 });
    },
    gunshot(o, T, R, vary) { T.SFX._gun(o, T, R, vary, { crack: 0.012, crackF: 2500, body: 0.1, bodyF: 3500, thump: 160, mech: 0.05, echo: 0.11, wet: 1.6, range: 1200 }); },
    shotgun(o, T, R, vary) { T.SFX._gun(o, T, R, vary, { crack: 0.02, crackF: 1500, body: 0.22, bodyF: 2200, thump: 95, mech: 0, echo: 0.14, wet: 1.9, range: 1400 }); },
    rifle(o, T, R, vary) { T.SFX._gun(o, T, R, vary, { crack: 0.008, crackF: 4000, body: 0.16, bodyF: 4800, thump: 120, mech: 0.06, echo: 0.16, wet: 2.2, range: 1800 }); },
    reload(o, T) {   // magazine out, magazine seated
      const w = T._out(o, { vol: 0.9, wet: 0.3, range: 160 }); if (!w) return;
      T._burst(w.node, w.t, { dur: 0.01, vol: 0.3, type: 'bandpass', f: 2800, q: 3 }); T._ring(w.node, w.t, 2100, [[1, 1, 0.04], [2.6, 0.4, 0.02]], 0.05);
      T._burst(w.node, w.t + 0.08, { noise: 'pink', dur: 0.08, vol: 0.1, type: 'bandpass', f: 1500, q: 1 });
      T._burst(w.node, w.t + 0.3, { dur: 0.012, vol: 0.45, type: 'bandpass', f: 2200, q: 2.5 }); T._osc(w.node, w.t + 0.3, { f: 300, f2: 160, dur: 0.04, vol: 0.2 });
    },
    cock(o, T) {   // slide back, slide forward
      const w = T._out(o, { vol: 0.9, wet: 0.3, range: 160 }); if (!w) return;
      T._burst(w.node, w.t, { noise: 'white', dur: 0.05, vol: 0.18, type: 'bandpass', f: 3000, f2: 2200, q: 3, a: 0.01 }); T._ring(w.node, w.t + 0.05, 2500, [[1, 1, 0.03]], 0.06);
      T._burst(w.node, w.t + 0.12, { noise: 'white', dur: 0.03, vol: 0.25, type: 'bandpass', f: 2600, q: 3 }); T._ring(w.node, w.t + 0.14, 3100, [[1, 1, 0.05], [2.2, 0.5, 0.03]], 0.08);
    },
    casing(o, T, R) {   // a spent case bouncing on the ground
      const w = T._out(o, { vol: 0.5, wet: 0.3, range: 200 }); if (!w) return;
      const f = o.shell ? 700 + R() * 200 : 3800 + R() * 900;
      for (let i = 0; i < 3; i++) T._ring(w.node, w.t + i * (0.07 - i * 0.015), f * (1 + R() * 0.03), o.shell ? [[1, 1, 0.06], [2.1, 0.4, 0.03]] : [[1, 1, 0.08], [1.52, 0.6, 0.06], [2.9, 0.3, 0.03]], 0.05 * (1 - i * 0.3));
    },
    fire(o, T, R) {   // crackle and hiss
      const w = T._out(o, { vol: 0.8, wet: 0.3, range: 300 }); if (!w) return;
      T._burst(w.node, w.t, { noise: 'pink', dur: 0.4, vol: 0.06, type: 'lowpass', f: 900, a: 0.1 });
      for (let i = 0; i < 6; i++) T._burst(w.node, w.t + R() * 0.4, { dur: 0.004 + R() * 0.01, vol: 0.12 + R() * 0.2, type: 'bandpass', f: 1500 + R() * 3500, q: 1 });
    },
    squeal(o, T, R) {   // tyres losing grip
      const w = T._out(o, { vol: 0.8, wet: 0.5, range: 600 }); if (!w) return;
      const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + R() * 300; bp.Q.value = 6; bp.connect(w.node);
      const s = T._osc(bp, w.t, { type: 'sawtooth', f: 900 + R() * 200, f2: 760, dur: 0.45, vol: 0.12, a: 0.03, hold: 0.1 });
      const lfo = T.ctx.createOscillator(), lg = T.ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 40; lfo.connect(lg); lg.connect(s.frequency); lfo.start(w.t); lfo.stop(w.t + 0.7);
      T._burst(w.node, w.t, { noise: 'white', dur: 0.5, vol: 0.06, type: 'bandpass', f: 2500, q: 2, a: 0.03 });
    },
    honk(o, T, R) {   // a car horn: two detuned buzzing tones a third apart, slightly overdriven
      const w = T._out(o, { vol: 0.7, wet: 0.8, range: 900, ref: 90 }); if (!w) return;
      const sh = T._shaper(2.5), pk = T.ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2400; pk.gain.value = 6; pk.Q.value = 1;
      const lp = T.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
      sh.connect(pk); pk.connect(lp); lp.connect(w.node);
      const len = 0.28 + R() * 0.22;
      for (const f of [415, 494]) T._osc(sh, w.t, { type: 'sawtooth', f: f * (1 + (R() - 0.5) * 0.01), dur: 0.06, vol: 0.25, a: 0.01, hold: len });
    },
    engine(o, T) {   // ignition: starter motor cranking, then the engine catches
      const w = T._out(o, { vol: 0.8, wet: 0.3, range: 400 }); if (!w) return;
      const lp = T.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(w.node);
      const st = T._osc(lp, w.t, { type: 'sawtooth', f: 180, dur: 0.1, vol: 0.12, a: 0.02, hold: 0.55 });
      const am = T.ctx.createOscillator(), ag = T.ctx.createGain(); am.frequency.value = 9; ag.gain.value = 50; am.connect(ag); ag.connect(st.frequency); am.start(w.t); am.stop(w.t + 0.8);
      for (let i = 0; i < 5; i++) T._burst(lp, w.t + i * 0.11, { noise: 'brown', dur: 0.07, vol: 0.4, f: 400 });
      T._osc(w.node, w.t + 0.6, { type: 'sawtooth', f: 45, f2: 70, dur: 0.5, vol: 0.25, a: 0.02, glide: 0.2 });
      T._burst(w.node, w.t + 0.6, { noise: 'brown', dur: 0.6, vol: 0.6, f: 500, f2: 200 });
    },
    crash(o, T, R) {   // sheet metal crumpling, glass, plastic, a low impact
      const w = T._out(o, { vol: 1, wet: 1.2, range: 900, ref: 90 }); if (!w) return;
      const n = w.node, t = w.t;
      T._osc(n, t, { f: 70, f2: 30, dur: 0.4, vol: 0.9 });
      T._burst(n, t, { noise: 'brown', dur: 0.45, vol: 1, f: 900, f2: 200 });
      for (let i = 0; i < 8; i++) T._burst(n, t + R() * 0.25, { dur: 0.04 + R() * 0.08, vol: 0.3, type: 'bandpass', f: 400 + R() * 2500, q: 3 + R() * 6 });
      T._ring(n, t, 310 + R() * 60, [[1, 1, 0.5], [2.37, 0.6, 0.35], [3.93, 0.4, 0.25], [6.1, 0.2, 0.12]], 0.08);
      for (let i = 0; i < 12; i++) T._ring(n, t + 0.08 + R() * 0.6, 3500 + R() * 4500, [[1, 1, 0.12], [1.9, 0.4, 0.06]], 0.025);   // glass shards
    },
    // ---------- animals ----------
    animal(o, T, R) {   // a generic bleat/moo/cluck: a voiced call through formants
      const w = T._out(o, { vol: 0.7, wet: 0.5, range: 500 }); if (!w) return;
      const f0 = 160 + R() * 260, mix = T.ctx.createGain();
      for (const [ff, q] of [[700 + R() * 300, 5], [1500 + R() * 600, 7]]) { const bp = T.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; mix.connect(bp); bp.connect(w.node); }
      const s = T._osc(mix, w.t, { type: 'sawtooth', f: f0, f2: f0 * (0.8 + R() * 0.4), dur: 0.25 + R() * 0.25, vol: 0.6, a: 0.04, hold: 0.05 });
      const v = T.ctx.createOscillator(), vg = T.ctx.createGain(); v.frequency.value = 6 + R() * 18; vg.gain.value = f0 * 0.06; v.connect(vg); vg.connect(s.frequency); v.start(w.t); v.stop(w.t + 0.7);
    },
    growl(o, T, R) {   // a rough, rumbling growl with irregular amplitude
      const w = T._out(o, { vol: 0.9, wet: 0.3, range: 300 }); if (!w) return;
      const lp = T.ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 450; lp.Q.value = 1.5; lp.connect(w.node);
      const am = T.ctx.createGain(); am.connect(lp);
      const s = T._osc(am, w.t, { type: 'sawtooth', f: 75, f2: 60, dur: 0.3, vol: 0.6, a: 0.08, hold: 0.4 });
      T._burst(am, w.t, { noise: 'brown', dur: 0.4, vol: 0.5, f: 700, a: 0.08, hold: 0.3 });
      const lfo = T.ctx.createOscillator(), lg = T.ctx.createGain(); lfo.frequency.value = 28; lg.gain.value = 0.5; am.gain.value = 0.6; lfo.connect(lg); lg.connect(am.gain); lfo.start(w.t); lfo.stop(w.t + 0.9);
      void s;
    },
    _default(o, T) { const w = T._out(o, { vol: 0.5 }); if (!w) return; T._osc(w.node, w.t, { f: 880, dur: 0.05, vol: 0.08 }); },
  },

  // ---------------------------------------------------------------- vehicle engines
  // A four-stroke engine fires cyl/2 times per revolution: the firing frequency is the pitch.
  // Layers: harmonic buzz (sawtooth + sub), combustion noise pulsed at the firing rate, intake
  // roar that opens with load, all through a soft-clipping exhaust.
  engine(id, { rpm = 800, load = 0, moto = false, x, y, vol = 1 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    let e = this._engines[id];
    if (!e) {
      e = this._engines[id] = { moto };
      const out = c.createGain(); out.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 1.2;
      const sh = this._shaper(moto ? 3.5 : 2);
      const mix = c.createGain();
      e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
      e.o2 = c.createOscillator(); e.o2.type = 'square';
      e.o3 = c.createOscillator(); e.o3.type = 'sine';
      const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain();
      g1.gain.value = 0.35; g2.gain.value = moto ? 0.12 : 0.22; g3.gain.value = 0.5;
      e.o1.connect(g1); e.o2.connect(g2); e.o3.connect(g3); g1.connect(mix); g2.connect(mix); g3.connect(mix);
      // combustion noise, amplitude-modulated by the firing pulse
      const nsrc = c.createBufferSource(); nsrc.buffer = this._noiseBuf('brown'); nsrc.loop = true;
      const nbp = c.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 300; nbp.Q.value = 0.8;
      e.am = c.createGain(); e.am.gain.value = 0.3;
      e.pulse = c.createOscillator(); e.pulse.type = 'square';
      const pg = c.createGain(); pg.gain.value = 0.3; e.pulse.connect(pg); pg.connect(e.am.gain);
      nsrc.connect(nbp); nbp.connect(e.am); e.am.connect(mix);
      // intake / wind roar
      const isrc = c.createBufferSource(); isrc.buffer = this._noiseBuf('pink'); isrc.loop = true;
      e.intake = c.createBiquadFilter(); e.intake.type = 'bandpass'; e.intake.Q.value = 0.7;
      e.intakeG = c.createGain(); e.intakeG.gain.value = 0;
      isrc.connect(e.intake); e.intake.connect(e.intakeG); e.intakeG.connect(out);
      mix.connect(sh); sh.connect(tone); tone.connect(out); out.connect(pan); pan.connect(this.sfxBus);
      const send = c.createGain(); send.gain.value = 0.15; pan.connect(send); send.connect(this.verbIn);
      e.out = out; e.pan = pan; e.tone = tone; e.nbp = nbp;
      for (const o of [e.o1, e.o2, e.o3, e.pulse]) o.start();
      nsrc.start(0, Math.random() * 2); isrc.start(0, Math.random() * 2);
      e.srcs = [e.o1, e.o2, e.o3, e.pulse, nsrc, isrc];
    }
    const cyl = moto ? 2 : 4;
    const f = Math.max(8, rpm / 60 * cyl / 2);
    const k = 0.06;
    e.o1.frequency.setTargetAtTime(f, t, k);
    e.o2.frequency.setTargetAtTime(f / 2, t, k);
    e.o3.frequency.setTargetAtTime(f, t, k);
    e.pulse.frequency.setTargetAtTime(f, t, k);
    e.nbp.frequency.setTargetAtTime(200 + f * 3, t, k);
    e.tone.frequency.setTargetAtTime(180 + f * (moto ? 9 : 5) + load * 1400, t, k);
    e.intake.frequency.setTargetAtTime(500 + rpm * 0.25, t, k);
    e.intakeG.gain.setTargetAtTime(0.02 + load * 0.08 + rpm / 60000, t, k);
    // position
    let v = (0.16 + load * 0.08 + rpm / 40000) * vol, pn = 0;
    const L = this.listener;
    if (x != null && L.on) {
      const d = Math.hypot(x - L.x, y - L.y);
      v *= d < 40 ? 1 : Math.pow(40 / d, 1.2) * Math.max(0, 1 - d / 500);
      pn = Math.max(-0.85, Math.min(0.85, (x - L.x) / 220));
    }
    e.out.gain.setTargetAtTime(v, t, 0.08);
    if (e.pan.pan) e.pan.pan.setTargetAtTime(pn, t, 0.08);
    e.seen = t;
  },
  engineStop(id) {
    const e = this._engines[id];
    if (!e || !this.ctx) return;
    delete this._engines[id];
    const t = this.ctx.currentTime;
    e.out.gain.cancelScheduledValues(t);
    e.out.gain.setTargetAtTime(0, t, 0.15);
    for (const s of e.srcs) { try { s.stop(t + 0.8); } catch (err) { /* already stopped */ } }
  },
  engineIds() { return Object.keys(this._engines); },

  // ---------------------------------------------------------------- ambience
  // Continuous beds (noise shaped to sound like wind, traffic, surf, rain, a room) plus scheduled
  // events (birdsong, crickets, frogs, distant cars, sirens, dogs, owls, thunder).
  setAmbience(levels) { this._ambTarget = levels || {}; },

  _bed(name) {
    if (this._amb[name]) return this._amb[name];
    const c = this.ctx, b = { g: c.createGain() };
    b.g.gain.value = 0;
    const src = (kind) => { const s = c.createBufferSource(); s.buffer = this._noiseBuf(kind); s.loop = true; s.start(0, Math.random() * 2.5); return s; };
    const filt = (type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
    const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
    switch (name) {
      case 'wind': { b.f = filt('bandpass', 420, 0.6); b.mod = c.createGain(); chain(src('brown'), b.f, b.mod, b.g); b.hiss = filt('highpass', 3000); const hg = c.createGain(); hg.gain.value = 0.05; chain(src('pink'), b.hiss, hg, b.mod); break; }
      case 'traffic': { const lp = filt('lowpass', 260); chain(src('brown'), lp, b.g); const mid = filt('bandpass', 700, 0.5); const mg = c.createGain(); mg.gain.value = 0.25; chain(src('pink'), mid, mg, b.g); break; }
      case 'waves': { b.f = filt('lowpass', 700); b.mod = c.createGain(); b.mod.gain.value = 0.4; chain(src('pink'), b.f, b.mod, b.g); const hp = filt('highpass', 2500); b.foam = c.createGain(); b.foam.gain.value = 0; chain(src('white'), hp, b.foam, b.g); break; }
      case 'rain': { b.f = filt('lowpass', 7000); const hp = filt('highpass', 500); chain(src('pink'), hp, b.f, b.g); const lo = filt('lowpass', 300); const lg = c.createGain(); lg.gain.value = 0.4; chain(src('brown'), lo, lg, b.g); break; }
      case 'room': { const lp = filt('lowpass', 180); const rg = c.createGain(); rg.gain.value = 0.5; chain(src('brown'), lp, rg, b.g); const hum = c.createOscillator(); hum.frequency.value = 60; const hg = c.createGain(); hg.gain.value = 0.015; chain(hum, hg, b.g); hum.start(); const h2 = c.createOscillator(); h2.frequency.value = 120; const h2g = c.createGain(); h2g.gain.value = 0.008; chain(h2, h2g, b.g); h2.start(); break; }
      case 'crowd': { b.f = filt('bandpass', 900, 0.9); b.mod = c.createGain(); b.mod.gain.value = 0.5; chain(src('pink'), b.f, b.mod, b.g); const f2 = filt('bandpass', 2200, 2); const g2 = c.createGain(); g2.gain.value = 0.2; chain(src('pink'), f2, g2, b.mod); break; }
      case 'leaves': { b.f = filt('highpass', 2200, 0.5); b.mod = c.createGain(); b.mod.gain.value = 0.5; chain(src('white'), b.f, b.mod, b.g); break; }
      default: return null;
    }
    b.g.connect(this.ambBus);
    return (this._amb[name] = b);
  },

  _tickAmbience() {
    const c = this.ctx, t = c.currentTime, A = this._ambTarget, r = this._rng;
    const gains = { wind: 0.22, traffic: 0.35, waves: 0.5, rain: 0.35, room: 0.25, crowd: 0.05, leaves: 0.05 };
    for (const name of Object.keys(gains)) {
      const lv = A[name] || 0;
      if (!lv && !this._amb[name]) continue;
      const b = this._bed(name);
      if (!b) continue;
      b.g.gain.setTargetAtTime(lv * gains[name], t, 0.8);
    }
    // living beds: gusts, swells, murmurs
    const w = this._amb.wind;
    if (w && r.chance(0.1)) { w.mod.gain.setTargetAtTime(0.4 + r.next() * 0.9 + (A.storm ? 0.8 : 0), t, 0.6 + r.next() * 1.5); w.f.frequency.setTargetAtTime(250 + r.next() * 500, t, 1); }
    const wv = this._amb.waves;
    if (wv) { this._swell = (this._swell || 0) - 0.1; if (this._swell <= 0) { this._swell = 5 + r.next() * 4; wv.mod.gain.setTargetAtTime(1, t, 1.2); wv.mod.gain.setTargetAtTime(0.25, t + 2.2, 1.4); wv.f.frequency.setTargetAtTime(1600, t + 1.5, 0.5); wv.f.frequency.setTargetAtTime(600, t + 2.4, 1); wv.foam.gain.setTargetAtTime(0.25, t + 1.8, 0.3); wv.foam.gain.setTargetAtTime(0, t + 2.6, 0.8); } }
    for (const k of ['crowd', 'leaves']) { const b = this._amb[k]; if (b && r.chance(0.2)) b.mod.gain.setTargetAtTime(0.3 + r.next() * 0.7, t, 0.4); }
    if (this._amb.rain) this._amb.rain.f.frequency.setTargetAtTime(A.muffle ? 700 : 7000, t, 0.3);
    if (this._amb.traffic) this._amb.traffic.g.gain.setTargetAtTime((A.traffic || 0) * gains.traffic * (A.muffle ? 0.5 : 1), t, 0.8);
    // events
    const ev = (lv, chance) => lv > 0 && r.chance(chance * lv);
    const out = (vol, pan, f = 0) => {
      const g = c.createGain(); g.gain.value = vol * (A.muffle ? 0.35 : 1);
      let head = g;
      if (A.muffle || f) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f || 1200; g.connect(lp); head = lp; }
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = pan; head.connect(p); head = p; }
      head.connect(this.ambBus);
      const s = c.createGain(); s.gain.value = 0.4; head.connect(s); s.connect(this.verbIn);
      return g;
    };
    const P = () => r.next() * 1.6 - 0.8;
    if (ev(A.birds, 0.09)) this._bird(out(0.5 * A.birds, P()), t + r.next() * 0.1);
    if (ev(A.crickets, 0.5)) this._cricket(out(0.08 * A.crickets, P()), t + r.next() * 0.1);
    if (ev(A.frogs, 0.12)) this._frog(out(0.25 * A.frogs, P()), t);
    if (ev(A.traffic, 0.025)) this._passBy(out(0.35 * A.traffic, 0, 0), t);
    if (ev(A.traffic * (A.night ? 1.6 : 0.6), 0.0018)) this._siren(out(0.07, P(), 2500), t);
    if (ev(A.traffic, 0.004)) this.SFX.honk.call(this, { vol: 0.12, bus: this.ambBus }, this, Math.random);
    if (ev(A.dogs, 0.006)) this._bark(out(0.12 * A.dogs, P(), 1800), t);
    if (ev(A.owl, 0.004)) this._owl(out(0.2 * A.owl, P(), 0), t);
    if (ev(A.storm, 0.008)) { this._thunder(out(0.9, P(), 0), t + 0.3 + r.next() * 2.5); if (G.weather) G.weather.flash = 1; }
    if (A.rain > 0 && !A.muffle) for (let i = 0; i < 3; i++) if (r.chance(0.6 * A.rain)) { const o = out(0.06 * A.rain, P()); this._burst(o, t + r.next() * 0.1, { dur: 0.008, vol: 0.4, type: 'bandpass', f: 2000 + r.next() * 4000, q: 3 }); }
  },
  _bird(o, t) {   // species picked at random: a whistle, a tweet repeated, a trill
    const r = this._rng, kind = r.int(0, 3), base = 2200 + r.next() * 2800;
    if (kind === 0) { for (let i = 0; i < 2 + r.int(0, 3); i++) this._osc(o, t + i * 0.14, { f: base, f2: base * 1.5, glide: 0.05, dur: 0.07, vol: 0.12, a: 0.005 }); }
    else if (kind === 1) { this._osc(o, t, { f: base * 1.3, f2: base * 0.8, dur: 0.35, vol: 0.12, a: 0.02 }); this._osc(o, t + 0.45, { f: base * 1.1, f2: base * 0.7, dur: 0.3, vol: 0.1, a: 0.02 }); }
    else if (kind === 2) { const s = this._osc(o, t, { f: base, dur: 0.5, vol: 0.1, a: 0.01, hold: 0.2 }); const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 22 + r.next() * 10; lg.gain.value = base * 0.12; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + 0.8); }
    else { for (let i = 0; i < 4; i++) this._osc(o, t + i * 0.09, { f: base * (1 + i * 0.08), f2: base * (0.9 + i * 0.08), dur: 0.05, vol: 0.1 }); }
  },
  _cricket(o, t) { const f = 4300 + this._rng.next() * 900; for (let i = 0; i < 3 + this._rng.int(0, 2); i++) this._osc(o, t + i * 0.045, { f, dur: 0.02, vol: 0.5, a: 0.004 }); },
  _frog(o, t) { const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500 + this._rng.next() * 300; bp.Q.value = 4; bp.connect(o); for (let i = 0; i < 2 + this._rng.int(0, 2); i++) this._osc(bp, t + i * 0.12, { type: 'sawtooth', f: 90 + this._rng.next() * 40, dur: 0.06, vol: 0.6, a: 0.01, hold: 0.03 }); },
  _passBy(o, t) {   // a car passing on a nearby street: swell, doppler drop, fade
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const dur = 2.5 + this._rng.next() * 2;
    const dirn = this._rng.chance(0.5) ? 1 : -1;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (pan) { pan.pan.setValueAtTime(-0.8 * dirn, t); pan.pan.linearRampToValueAtTime(0.8 * dirn, t + dur); g.connect(pan); pan.connect(o); } else g.connect(o);
    this._burst(g, t, { noise: 'pink', dur: dur * 0.5, vol: 0.5, type: 'bandpass', f: 900, f2: 450, q: 0.7, a: dur * 0.45 });
    this._osc(g, t, { type: 'sawtooth', f: 70, f2: 55, dur: dur * 0.5, vol: 0.06, a: dur * 0.45 });
  },
  _siren(o, t) { const s = this._osc(o, t, { type: 'triangle', f: 900, dur: 1.5, vol: 0.5, a: 0.8, hold: 3 }); const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 0.35; lg.gain.value = 320; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + 5.5); },
  _bark(o, t) { for (let i = 0; i < 1 + this._rng.int(0, 2); i++) { const tt = t + i * 0.28; this._osc(o, tt, { type: 'sawtooth', f: 420, f2: 260, dur: 0.1, vol: 0.5, a: 0.008 }); this._burst(o, tt, { noise: 'pink', dur: 0.1, vol: 0.4, type: 'bandpass', f: 1000, q: 1 }); } },
  _owl(o, t) { this._osc(o, t, { f: 390, f2: 360, dur: 0.35, vol: 0.4, a: 0.08 }); this._osc(o, t + 0.7, { f: 380, f2: 340, dur: 0.25, vol: 0.3, a: 0.05 }); this._osc(o, t + 1.05, { f: 380, f2: 330, dur: 0.6, vol: 0.4, a: 0.08 }); },
  _thunder(o, t) {
    this._burst(o, t, { noise: 'brown', dur: 4 + this._rng.next() * 3, vol: 1, f: 900, f2: 60, a: 0.05, hold: 0.3 });
    for (let i = 0; i < 6; i++) this._burst(o, t + this._rng.next() * 1.5, { noise: 'brown', dur: 1.2, vol: 0.6, f: 400, f2: 80, a: 0.1 });
    this._osc(o, t, { f: 40, f2: 25, dur: 3, vol: 0.5, a: 0.2 });
  },

  // ---------------------------------------------------------------- generative music
  // Each mood is an arrangement: chord progression, tempo, groove, and which instruments play.
  moods: {
    menu:   { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 68, prog: [0, 5, 3, 4], lead: 'epiano', pad: 0.55, bass: 0.5, drums: null, density: 0.35 },
    rural:  { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 88, prog: [0, 4, 5, 3], lead: 'pluck', pad: 0.3, bass: 0.6, drums: 'brush', density: 0.55, arp: true },
    city:   { root: 53, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 84, prog: [0, 3, 6, 4], lead: 'epiano', pad: 0.3, bass: 0.9, drums: 'lofi', density: 0.4, seventh: true },
    forest: { root: 52, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 72, prog: [0, 6, 5, 3], lead: 'pluck', pad: 0.6, bass: 0.3, drums: null, density: 0.3, arp: true },
    night:  { root: 48, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 62, prog: [0, 5, 2, 6], lead: 'epiano', pad: 0.5, bass: 0.5, drums: null, density: 0.22, seventh: true },
    island: { root: 46, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 70, prog: [0, 1, 0, 6], lead: 'marimba', pad: 0.45, bass: 0.6, drums: 'hand', density: 0.4 },
    combat: { root: 50, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 132, prog: [0, 0, 5, 6], lead: 'pluck', pad: 0.35, bass: 1, drums: 'drive', density: 0.5 },
  },

  setMusic(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this._step = 0;
    this._motif = null;
    if (this.ctx) this._nextNote = this.ctx.currentTime + 0.15;
  },

  _midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  // music voices go to the music bus with a reverb send
  _mOut(vol, wet = 0.3, pan = 0) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol;
    let head = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); head = p; }
    head.connect(this.musicBus);
    if (wet) { const s = c.createGain(); s.gain.value = wet; head.connect(s); s.connect(this.musicVerbIn); }
    return g;
  },
  _pad(t, freqs, dur, vol) {   // detuned saws through a slow, dark filter
    const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(500, t + dur); lp.Q.value = 0.5;
    lp.connect(this._mOut(1, 0.7));
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.3)); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6); g.connect(lp);
    for (const f of freqs) for (const dt of [-8, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(g); o.start(t); o.stop(t + dur + 0.7); }
  },
  _epiano(t, f, dur, vol, pan = 0) {   // two-operator FM (a tine piano): bright attack that mellows
    const c = this.ctx, out = this._mOut(1, 0.35, pan);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.5, dur * 1.6));
    car.connect(g); g.connect(out);
    car.start(t); mod.start(t); car.stop(t + dur * 1.6 + 0.1); mod.stop(t + dur * 1.6 + 0.1);
    this._osc(out, t, { f: f * 7.1, dur: 0.08, vol: vol * 0.08 });   // the tine's metallic tick
  },
  _pluck(t, f, dur, vol, pan = 0) {   // a plucked string: bright transient, filter closing as it rings
    const c = this.ctx, out = this._mOut(1, 0.3, pan), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(Math.min(9000, f * 10), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + 0.35);
    lp.connect(out);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur * 1.8)); g.connect(lp);
    for (const [type, det] of [['sawtooth', -4], ['triangle', 5]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur * 1.8 + 0.1); }
    this._burst(out, t, { dur: 0.01, vol: vol * 0.25, type: 'bandpass', f: f * 4, q: 1 });   // pick noise
  },
  _marimba(t, f, vol, pan = 0) { const out = this._mOut(1, 0.4, pan); this._ring(out, t, f, [[1, 1, 0.6], [3.93, 0.35, 0.12], [9.2, 0.12, 0.04]], vol); this._burst(out, t, { dur: 0.008, vol: vol * 0.3, type: 'bandpass', f: f * 3, q: 2 }); },
  _bassNote(t, f, dur, vol) {   // round electric bass
    const c = this.ctx, out = this._mOut(1, 0.05), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(250, t + 0.25); lp.connect(out);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(lp);
    for (const type of ['sine', 'triangle']) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  },
  _drum(kind, t, vol) {
    const out = this._mOut(vol, kind === 'snare' || kind === 'rim' ? 0.35 : 0.1);
    switch (kind) {
      case 'kick': this._osc(out, t, { f: 140, f2: 42, glide: 0.08, dur: 0.32, vol: 0.9, a: 0.002 }); this._burst(out, t, { dur: 0.01, vol: 0.2, type: 'lowpass', f: 3000 }); break;
      case 'snare': this._osc(out, t, { type: 'triangle', f: 190, f2: 160, dur: 0.1, vol: 0.4 }); this._burst(out, t, { dur: 0.18, vol: 0.45, type: 'bandpass', f: 3500, q: 0.6 }); break;
      case 'brush': this._burst(out, t, { noise: 'pink', dur: 0.18, vol: 0.18, type: 'bandpass', f: 4000, q: 0.5, a: 0.03 }); break;
      case 'hat': this._burst(out, t, { dur: 0.035, vol: 0.18, type: 'highpass', f: 8000 }); break;
      case 'ohat': this._burst(out, t, { dur: 0.22, vol: 0.12, type: 'highpass', f: 7000 }); break;
      case 'rim': this._burst(out, t, { dur: 0.02, vol: 0.4, type: 'bandpass', f: 1800, q: 4 }); this._osc(out, t, { f: 820, dur: 0.03, vol: 0.2 }); break;
      case 'shaker': this._burst(out, t, { dur: 0.06, vol: 0.12, type: 'highpass', f: 6000, a: 0.02 }); break;
      case 'conga': this._osc(out, t, { f: 260, f2: 200, dur: 0.18, vol: 0.5 }); this._burst(out, t, { dur: 0.015, vol: 0.2, type: 'bandpass', f: 1200, q: 2 }); break;
      case 'tom': this._osc(out, t, { f: 110, f2: 70, dur: 0.3, vol: 0.6 }); break;
    }
  },

  _schedule() {
    if (!this.ctx || !this.mood) return;
    const m = this.moods[this.mood];
    if (!m) return;
    const sd = 60 / m.bpm / 4;   // sixteenth notes
    const r = this._rng;
    const noteOf = (d, oct) => { const n = m.scale.length; return m.root + oct * 12 + m.scale[((d % n) + n) % n] + Math.floor(d / n) * 12; };
    while (this._nextNote < this.ctx.currentTime + 0.5) {
      const s = this._step, i16 = s % 16, bar = Math.floor(s / 16);
      let t = this._nextNote;
      if (m.drums === 'lofi' && i16 % 4 === 2) t += sd * 0.22;   // swing
      const deg = m.prog[bar % m.prog.length];
      const chord = m.seventh ? [deg, deg + 2, deg + 4, deg + 6] : [deg, deg + 2, deg + 4];
      if (i16 === 0) {
        // a fresh motif every 4 bars, repeated (and varied) so the melody has shape
        if (bar % 4 === 0 || !this._motif) this._motif = Array.from({ length: 16 }, (_, k) => (r.chance(m.density * (k % 4 === 0 ? 1.6 : k % 2 === 0 ? 0.9 : 0.35)) ? r.pick([0, 1, 2, 2, 4, 4, 5, 7]) : null));
        if (m.pad) this._pad(t, chord.slice(0, 3).map((d) => this._midi(noteOf(d, 0))), sd * 16, 0.035 * m.pad);
        if (m.lead === 'epiano') chord.forEach((d, k) => this._epiano(t + k * 0.012, this._midi(noteOf(d, 0)), sd * 12, 0.05, (k - 1.5) * 0.15));
      }
      // bass
      if (m.bass) {
        const pat = m.drums === 'drive' ? [0, 2, 4, 6, 8, 10, 12, 14] : m.drums === 'lofi' ? [0, 7, 10] : [0, 8];
        if (pat.includes(i16)) this._bassNote(t, this._midi(noteOf(i16 === 10 && m.drums === 'lofi' ? deg + 4 : deg, -2)), sd * (m.drums === 'drive' ? 1.8 : 5), 0.35 * m.bass);
      }
      // arpeggio (plucked chord tones)
      if (m.arp && i16 % 2 === 0) { const a = chord[[0, 1, 2, 1, 3, 2, 1, 2][(i16 / 2) % 8] % chord.length] + (i16 >= 8 ? 7 : 0); if (r.chance(0.85)) this._pluck(t, this._midi(noteOf(a, 0)), sd * 3, 0.05, (r.next() - 0.5) * 0.6); }
      // melody
      const mo = this._motif && this._motif[i16];
      if (mo != null) {
        const f = this._midi(noteOf(deg + mo + (bar % 4 === 3 ? 1 : 0), 1));
        if (m.lead === 'epiano') this._epiano(t, f, sd * 4, 0.06, 0.1);
        else if (m.lead === 'marimba') this._marimba(t, f, 0.1, (r.next() - 0.5) * 0.5);
        else this._pluck(t, f, sd * 4, m.drums === 'drive' ? 0.05 : 0.07, 0.1);
      }
      // drums
      const D = (k, v) => this._drum(k, t, v);
      switch (m.drums) {
        case 'lofi': if (i16 === 0 || i16 === 10 || (i16 === 7 && r.chance(0.3))) D('kick', 0.55); if (i16 === 4 || i16 === 12) D('snare', 0.35); if (i16 % 2 === 0) D('hat', i16 % 4 === 0 ? 0.3 : 0.2); if (i16 === 14 && r.chance(0.3)) D('ohat', 0.25); break;
        case 'brush': if (i16 === 0 || i16 === 8) D('kick', 0.25); if (i16 === 4 || i16 === 12) D('brush', 0.5); if (i16 % 4 === 2) D('shaker', 0.4); break;
        case 'hand': if ([0, 3, 6, 10, 12].includes(i16)) D('conga', i16 === 0 ? 0.4 : 0.25); if (i16 % 2 === 1) D('shaker', 0.25); if (i16 === 8) D('tom', 0.3); break;
        case 'drive': if (i16 % 4 === 0 || i16 === 6) D('kick', 0.7); if (i16 === 4 || i16 === 12) D('snare', 0.5); D('hat', i16 % 2 ? 0.12 : 0.22); if (bar % 4 === 3 && i16 >= 12) D('tom', 0.4); break;
      }
      this._nextNote += sd;
      this._step++;
    }
  },

  _tick() {
    if (!this.ctx) return;
    this._schedule();
    this._tickAmbience();
    // engines nobody updated for a while are switched off
    const t = this.ctx.currentTime;
    for (const id of Object.keys(this._engines)) if (t - this._engines[id].seen > 0.5) this.engineStop(id);
  },
};
