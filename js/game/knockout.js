'use strict';
// Knockouts, beating bodies, waking up, head trauma, blood on you.
//   Knockout: fists, knuckles, bats, pipes, batons, cues (any blunt blow) can put a person down unconscious
//   instead of dead. A blow that would kill rolls first: likelier with fists than a bat, and far less with a
//   sledgehammer; a blow far past what it takes to kill is a kill. A hard blow before that can knock someone
//   out too: the harder it lands (against their health), the more hits in a row, the more hurt they already
//   are. Blades, guns, cars, fire and falls kill as before. Children are never knocked out.
//   Unconscious (st.ko, saved): lying where they fell, seeing nothing, telling no one. Still alive: more hits
//   keep hurting them (and their head: each blow to someone on the ground is likely a blow to the head), and
//   they die only when the injuries are fatal. Nothing kills them by itself.
//   Waking up: after a while (longer the worse it was), one of: confused (slow, lost), frightened (runs),
//   going to the police, struggling to stand (limping for a while), or, after enough head trauma, brain
//   damage (st.brain 1 = for days, 2 = for good): broken, incoherent speech in every conversation, almost no
//   options left, no texts or calls (js/game/phone.js).
//   Bodies (the unconscious and the dead): every melee hit lands where the weapon struck, with blood thrown by
//   the weapon (a fist spatters, a bat bursts, a blade sprays in a line, an axe or sledgehammer opens it up)
//   and a wound at that spot; the body gets bloodier and more broken up to a limit (MAX), then only bleeds.
//   Blood on you: hitting a body at close range, harder and bloodier, splashes you more (a.bloody 0..1,
//   drawn progressively: hands first, then the front, the face, the legs). It stays until you wash it off: a
//   shower or a bath takes it all off, a sink your hands and face, a swim most of it.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, PL = G.Player.prototype, AP = G.Actor.prototype;
const TAU = Math.PI * 2;
const now = (w = G.world) => (w ? w.day * 1440 + w.minutes : 0);
const kidOf = (a) => !!(a && a.def && a.def.kid) || !!(a && a.kid);
const gore = () => G.gore && G.gore.on();

const K = G.ko = {
  MAX: 12,                                               // how broken a body can look
  KO_LETHAL: { fist: 0.9, blunt: 0.6, heavy: 0.3 },      // a killing blow knocks out instead (before overkill)
  KO_HIT: { fist: 0.55, blunt: 0.45, heavy: 0.3 },       // a hard blow knocks out before that
  // what kind of blow this is (melee style while swinging; anything else is lethal)
  kindOf(source, o) {
    if (o && o.bullet) return 'shot';
    const sw = source && source.swing && source.swing.st;
    if (!sw) return null;
    const S = G.melee.STYLES;
    if (sw === S.fists || sw === S.knuckle || sw.kind === 'kick') return 'fist';
    if (sw === S.blunt || sw === S.cue) return 'blunt';
    if (sw === S.sledge) return 'heavy';
    if (sw === S.axe) return 'chop';
    return 'blade';
  },
  nonLethal: (k) => k === 'fist' || k === 'blunt' || k === 'heavy',
  // How long someone stays out (game minutes). A clean knockout from a punch is minutes; a real beating with
  // blows to the head is hours; a savage one, most of a day. Older people, drunk people, people bleeding stay down
  // longer; the strong and the hardened come round sooner. A little randomness: no two bodies are the same.
  koMinutes(a, sev, kind) {
    const st = a.st || {}, life = G.lifestyle && a.id ? G.lifestyle.of(a.id) : null;
    const head = (a.koTr && a.koTr.head) || 0, maxHp = a.maxHp || 30, left = a.hp / maxHp;
    let m = 4 + sev * 55 + head * 9 + (kind === 'heavy' ? 35 : kind === 'blunt' ? 12 : 0) + (1 - left) * 30;
    if (life === 'retiree') m *= 1.5; else if (a.def && a.def.kid) m *= 1.3;
    const str = G.attr ? G.attr.get(a, 'strength') : 3;
    m *= G.util.clamp(1.25 - (str - 3) * 0.06, 0.8, 1.5);
    if (G.skills && (G.skills.rank(a, 'hard_head') || G.skills.rank(a, 'pain_tolerance'))) m *= 0.8;
    if ((st.alcohol || 0) > 40) m *= 1.5;
    if (st.bleed && st.bleed.rate > 0) m *= 1.3;
    m *= 0.8 + Math.random() * 0.45;
    return G.util.clamp(Math.round(m), 3, 900);
  },
  // how good the attacker is at putting someone down: strength (and the strength tree) behind the blow,
  // luck in where it lands. Player and NPCs alike (NPC attributes and skills: js/game/attributes.js, combatreal.js)
  punch(source) {
    if (!source || !G.attr) return 1;
    const str = G.attr.get(source, 'strength'), luck = G.attr.get(source, 'luck');
    const person = source.kind === 'player' || source.kind === 'npc', sk = person ? (G.skills.stat(source, 'meleeDmg') || 0) : 0, lk = person ? (G.skills.stat(source, 'luck') || 0) : 0;
    return G.util.clamp(1 + (str - 3) * 0.09 + (luck - 3) * 0.06 + sk * 0.8 + lk * 0.04, 0.55, 2.2);
  },
  isKO: (a) => !!(a && a.st && a.st.ko && !a.dead),
  brain: (st) => (st && st.brain ? (st.brainUntil != null && G.world && G.world.day >= st.brainUntil ? 0 : st.brain) : 0),

  // ---------------------------------------------------------------- going down
  knockOut(scene, a, source, kind, sev) {
    const w = scene.world, st = a.st, maxHp = a.maxHp || 30;
    a.hp = Math.max(1, Math.min(a.hp, Math.round(maxHp * 0.06)));
    const mins = K.koMinutes(a, sev, kind);
    st.ko = { until: now(w) + mins, sev, head: (a.koTr && a.koTr.head) || 0, down: 0, by: source === scene.player ? 'player' : source && source.id || null, map: scene.map.id, x: a.x, y: a.y, at: now(w) };
    a.downT = 1e9; a.downDir = source && source.x != null ? (a.x >= source.x ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
    if (a.endFight) a.endFight();
    a.state = 'schedule'; a.target = null; a.path = null; a.sleeping = false; a.moving = false; a.talking = false; a.swing = null; a.dodge = null;
    a.bark = null;
    G.audio.play('punch', { x: a.x, y: a.y });
    if (scene.isOnScreen && scene.isOnScreen(a.x, a.y)) G.renderer.shake(2);
    if (source === scene.player) scene.toast(`${a.displayName} is out cold.`, 'warn');
  },
  // severity of what happened in this fight, 0 (a tap) .. 3 (beaten half to death)
  severity(a) { const t = a.koTr || {}; return G.util.clamp((t.dmg || 0) / (a.maxHp || 30) + (t.hits || 0) * 0.06 + (t.heavy || 0) * 0.25, 0.1, 3); },

  // ---------------------------------------------------------------- waking up
  wake(scene, a) {
    const w = scene.world, st = a.st, ko = st.ko, p = scene.player;
    st.ko = null;
    a.downT = 0.35;   // getting up (js/game/extras.js, hdchars.js)
    a.state = 'schedule'; a.target = null; st.hostile = false;
    const sev = ko.sev + (ko.down || 0) * 0.08, head = (ko.head || 0) + (st.headHits || 0) * 0.3;
    st.headHits = (st.headHits || 0) + (ko.head || 0);
    const byPlayer = ko.by === 'player';
    // head trauma first: the more blows to the head (and the worse the beating), the likelier
    const brainP = G.util.clamp(head * 0.07 + Math.max(0, sev - 0.6) * 0.22 - 0.12, 0, 0.9);
    let out;
    if (Math.random() < brainP) {
      out = 'brain';
      const permanent = Math.random() < 0.3 + head * 0.05 || (st.brain === 2);
      st.brain = permanent ? 2 : Math.max(st.brain || 0, 1);
      st.brainUntil = permanent ? null : w.day + G.rng.int(3, 12);
      st.fear = 0;
    } else {
      const snitch = byPlayer && a.def.combat !== 'guard' && !a.faction.outlaw && !(G.CRIMINAL_FACTIONS || []).includes(a.def.faction);
      const opts = [['confused', 3 + sev * 2], ['frightened', byPlayer ? 3.5 : 1.5], ['police', snitch ? 2.5 + sev : 0], ['struggling', 1 + sev * 3]];
      let r = Math.random() * opts.reduce((n, o) => n + o[1], 0);
      out = opts.find((o) => (r -= o[1]) < 0)[0];
    }
    a.koReact = { kind: out, t: 0, by: ko.by };
    st.lastWake = { kind: out, day: w.day };
    const say = (arr) => a.say(G.rng.pick(arr), 3.5);
    if (out === 'confused') { a.dazeT = 25 + sev * 30; say(['Wh... where am I?', 'What... what happened?', 'My head... who turned off the...', 'Huh? Why am I on the ground?']); }
    else if (out === 'frightened') { st.fear = 100; say(['No no no, stay away!', 'Help! Somebody help me!', 'Please! Don\'t hurt me again!']); if (byPlayer && p && !p.dead && a.distTo(p) < 260) a.startFlee(p); else a.startFlee({ x: ko.x, y: ko.y - 1, dead: false, kind: 'place' }); }
    else if (out === 'police') { say(['I need... I need to call the police.', 'Police... somebody call the police...', 'You won\'t get away with this.']); a.reportT = 12; if (p && a.distTo(p) < 120) a.startFlee(p); }
    else if (out === 'struggling') { st.limpUntil = now(w) + 60 * (2 + sev * 4); say(['Ugh... I can\'t... stand up...', 'My leg... I can barely walk.', 'Ow... ow...']); }
    else a.say(this.salad(st.brain, a.id + 'wake'), 4);
  },
  // the same, for someone who wakes up while you are on another map
  wakeAway(w, id, st) {
    const ko = st.ko; st.ko = null;
    const head = (ko.head || 0);
    st.headHits = (st.headHits || 0) + head;
    if (Math.random() < G.util.clamp(head * 0.07 + Math.max(0, ko.sev - 0.6) * 0.22 - 0.12, 0, 0.9)) {
      const permanent = Math.random() < 0.3 + head * 0.05;
      st.brain = permanent ? 2 : Math.max(st.brain || 0, 1); st.brainUntil = permanent ? null : w.day + G.rng.int(3, 12);
      st.lastWake = { kind: 'brain', day: w.day };
    } else if (ko.by === 'player' && !G.FACTIONS[(G.NPCS[id] || {}).faction || 'civilians']?.outlaw && Math.random() < 0.4) { w.commitCrime('assault', G.maps.cache[ko.map] ? G.maps.cache[ko.map].meta.region || 'rural' : 'rural', true, id); st.lastWake = { kind: 'police', day: w.day }; }
  },

  // ---------------------------------------------------------------- incoherent speech
  WORDS: ['door', 'mother', 'blue', 'Tuesday', 'shoes', 'the bus', 'teeth', 'window', 'spoon', 'ceiling', 'my hands', 'the dog', 'church', 'paper', 'water', 'light', 'number', 'the man', 'cold', 'home', 'keys', 'radio', 'birthday', 'milk'],
  VERBS: ['is eating', 'went into', 'keeps ringing', 'forgot', 'is too loud', 'was folded', 'fell up', 'remembers', 'is behind', 'tastes like', 'won\'t stop', 'said'],
  salad(level, seed) {
    const r = new G.RNG(String(seed || '') + Math.floor(G.loop.time * 3) + Math.random());
    const W = this.WORDS, V = this.VERBS;
    const stutter = (s) => { const c = s.split(' ')[0]; return r.chance(0.5) ? `${c.slice(0, 2)}-${c.slice(0, 2)}-${s}` : s; };
    const parts = [];
    const n = level >= 2 ? r.int(2, 4) : r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const k = r.int(0, level >= 2 ? 6 : 4);
      if (k === 0) parts.push(`the ${r.pick(W)} ${r.pick(V)} the ${r.pick(W)}`);
      else if (k === 1) parts.push(stutter(r.pick(W)) + '...');
      else if (k === 2) parts.push(`I was... I was ${r.pick(['going', 'looking', 'waiting', 'counting'])}... ${r.pick(W)}?`);
      else if (k === 3) parts.push(r.pick(['Where is... where...', 'Who... are you the...', 'It hurts, it\'s, it hurts in the...', 'Mama?', 'What day... what...']));
      else if (k === 4) { const w2 = r.pick(W); parts.push(`${w2}, ${w2}. ${w2}.`); }
      else parts.push(r.pick(['Hnnh.', 'Mmh... mm.', '...', 'Ha. Ha ha.', 'Gnn... the... no.']));
    }
    return parts.join(' ');
  },

  // ---------------------------------------------------------------- hits to a body on the ground
  // frame: where the body lies (fx, fy, rot), wounds/mangle kept on `holder` (a corpse, or an unconscious NPC's st)
  frameOfActor(a) { return { fx: a.x, fy: a.y - 4, rot: (a.downDir || 1) * Math.PI / 2 }; },
  frameOfCorpse(c) {
    const pose = c.pose || { kind: 'back', flip: 1 };
    let rot = Math.PI / 2 * (pose.flip || 1), oy = -5;
    if (pose.kind === 'slumped') { rot = 0; oy = 0; }
    if (G.player && G.player.dragging === c.id) rot = Math.atan2(G.player.y - c.y, G.player.x - c.x) - Math.PI / 2;
    return { fx: c.x, fy: c.y + oy, rot };
  },
  // a blow lands on a body: wound where it struck, blood thrown by the weapon, blood on whoever struck it
  bodyHit(scene, holder, frame, attacker, kind, ix, iy, power = 1) {
    if (holder.kid) return;
    const add = { fist: 0.45, blunt: 1, heavy: 2.2, blade: 1.1, chop: 2, shot: 0.8 }[kind] || 1;
    holder.mangle = Math.min(this.MAX, (holder.mangle || 0) + add * power);
    holder.jolt = G.loop.time;
    // where on the body (its own frame: x across, y from head -10 to feet +10)
    const c = Math.cos(-frame.rot), s = Math.sin(-frame.rot), dx = ix - frame.fx, dy = iy - frame.fy;
    const lx = G.util.clamp(dx * c - dy * s, -4.5, 4.5), ly = G.util.clamp(dx * s + dy * c, -10, 10);
    const ws = (holder.wounds = holder.wounds || []);
    if (ws.length < 26 && holder.mangle < this.MAX) ws.push({ x: Math.round(lx * 2) / 2, y: Math.round(ly * 2) / 2, k: kind, s: Math.floor(Math.random() * 1e6) });
    else if (ws.length && Math.random() < 0.5) { const w0 = ws[Math.floor(Math.random() * ws.length)]; w0.big = Math.min(3, (w0.big || 0) + 1); }   // at the limit: the old wounds only get worse
    // blood, thrown by the weapon, away from the attacker
    if (gore()) {
      const ang = attacker ? Math.atan2(iy - attacker.y + 7, ix - attacker.x) : Math.random() * TAU;
      const m = holder.mangle / this.MAX;
      const n = { fist: 2, blunt: 4, heavy: 7, blade: 4, chop: 6, shot: 3 }[kind] || 3;
      for (let i = 0; i < n + Math.round(m * 3); i++) {
        const spread = kind === 'blade' ? 0.25 : kind === 'fist' ? 0.9 : 0.6, a2 = ang + (Math.random() - 0.5) * 2 * spread;
        const dist = (kind === 'heavy' || kind === 'chop' ? 6 : 3) + Math.random() * (kind === 'blade' ? 22 : 14);
        G.gore.add(scene, { x: ix + Math.cos(a2) * dist, y: iy + 4 + Math.sin(a2) * dist * 0.6, r: G.rng.range(kind === 'fist' ? 0.6 : 1, kind === 'heavy' ? 3.2 : 2.2), type: 'splat', ang: a2 });
      }
      if (kind === 'blunt' || kind === 'heavy' || kind === 'fist') for (let i = 0; i < 2; i++) { const a3 = ang + Math.PI + (Math.random() - 0.5) * 1.2; G.gore.add(scene, { x: ix + Math.cos(a3) * 6, y: iy + 4 + Math.sin(a3) * 4, r: 0.8, type: 'splat', ang: a3 }); }   // back-spatter toward you
      if (holder.mangle >= 3 && (!holder.pooled || holder.mangle - holder.pooled >= 3)) { holder.pooled = holder.mangle; G.gore.add(scene, { x: frame.fx, y: frame.fy + 5, r: 3 + m * 3, grow: 10 + m * 14, born: G.loop.time, type: 'pool' }); }
      scene.particles(ix, iy, '#a01010', 3 + Math.round(add * 2));
    }
    G.audio.play(kind === 'blade' || kind === 'chop' ? 'stab' : 'punch', { x: ix, y: iy });
    // blood on whoever did it: closer, harder and bloodier body = more
    if (attacker) {
      const d = Math.hypot(attacker.x - frame.fx, attacker.y - 4 - frame.fy);
      const amt = ({ fist: 0.035, blunt: 0.03, heavy: 0.05, blade: 0.035, chop: 0.05, shot: 0 }[kind] || 0.03) * (0.4 + holder.mangle / this.MAX * 1.4) * (d < 14 ? 1.5 : d < 22 ? 1 : 0.5);
      this.splash(attacker, amt);
    }
  },
  splash(a, amt) {
    if (!(amt > 0) || kidOf(a)) return;
    a.bloody = Math.min(1, (a.bloody || 0) + amt);
    if (!a.bloodSeed) a.bloodSeed = G.rng.int(1, 1e6);
    if (a.kind === 'player' && a.bloody >= 0.35 && !G.effects.has(a, 'blood_soaked')) G.effects.add(a, 'blood_soaked', 60 * 60 * 6);
  },
  wash(p, how) {
    if (how === 'all') { p.bloody = 0; G.effects.remove(p, 'blood_soaked'); return; }
    if (how === 'hands') { p.bloody = Math.max(0, (p.bloody || 0) - 0.3); p.handsClean = true; }
    if (p.bloody < 0.35) G.effects.remove(p, 'blood_soaked');
  },

  // ---------------------------------------------------------------- drawing a beaten body
  drawWounds(ctx, holder, frame) {
    const m = holder.mangle || 0;
    if (!m || !gore() || holder.kid) return;
    const k = m / this.MAX;
    ctx.save();
    ctx.translate(frame.fx, frame.fy);
    ctx.rotate(frame.rot);
    if (holder.jolt && G.loop.time - holder.jolt < 0.12) ctx.translate((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2);   // the body jolts with the blow
    // soaked through: blotches all over, more and darker the worse it is
    const r = new G.RNG((holder.id || holder.realName || 'b') + 'blot');
    const nb = Math.round(k * 28);
    for (let i = 0; i < 28; i++) {
      const x = r.range(-4.5, 4), y = r.range(-10, 9), w2 = r.range(0.8, 2.6), h2 = r.range(0.6, 1.8);
      if (i >= nb) continue;
      ctx.fillStyle = i % 3 ? `rgba(122,8,8,${(0.45 + k * 0.4).toFixed(2)})` : `rgba(80,4,4,${(0.5 + k * 0.4).toFixed(2)})`;
      ctx.fillRect(x, y, w2, h2);
    }
    // the wounds themselves, where each blow landed
    for (const wd of holder.wounds || []) {
      const rr = new G.RNG(wd.s), big = 1 + (wd.big || 0) * 0.35;
      if (wd.k === 'fist') { ctx.fillStyle = 'rgba(92,24,40,0.85)'; ctx.fillRect(wd.x - 1, wd.y - 0.8, 2 * big, 1.6 * big); ctx.fillStyle = 'rgba(160,20,20,0.8)'; ctx.fillRect(wd.x, wd.y, 0.8, 0.8); }
      else if (wd.k === 'blade') { ctx.save(); ctx.translate(wd.x, wd.y); ctx.rotate(rr.range(-0.8, 0.8)); ctx.fillStyle = '#5a0404'; ctx.fillRect(-1.6 * big, -0.4, 3.2 * big, 0.8); ctx.fillStyle = '#c82a2a'; ctx.fillRect(-1.2 * big, -0.1, 2.4 * big, 0.3); ctx.restore(); }
      else if (wd.k === 'shot') { ctx.fillStyle = '#2a0202'; ctx.beginPath(); ctx.arc(wd.x, wd.y, 0.7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(150,10,10,0.8)'; ctx.fillRect(wd.x - 0.5, wd.y + 0.5, 1, 1.4); }
      else {   // blunt, heavy, chop: crushed and torn open; deep enough, flesh and bone show
        const sz = (wd.k === 'heavy' || wd.k === 'chop' ? 2.6 : 1.8) * big;
        ctx.fillStyle = '#4a0404'; ctx.beginPath(); ctx.ellipse(wd.x, wd.y, sz, sz * 0.75, rr.range(0, 3), 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a1010'; ctx.beginPath(); ctx.ellipse(wd.x + 0.2, wd.y - 0.2, sz * 0.6, sz * 0.45, 0, 0, TAU); ctx.fill();
        if (k >= 0.45 || wd.big) { ctx.fillStyle = '#b84a4a'; ctx.fillRect(wd.x - 0.6, wd.y - 0.4, 1.2, 0.8); }
        if (k >= 0.7 && rr.chance(0.6)) { ctx.fillStyle = '#ece2d2'; ctx.fillRect(wd.x + rr.range(-1, 0.5), wd.y + rr.range(-0.6, 0.2), 0.8, 0.6); }
      }
    }
    // the head took the worst of it
    const headHits = (holder.wounds || []).filter((wd) => wd.y < -5).length;
    if (headHits >= 3) { ctx.fillStyle = `rgba(110,6,6,${Math.min(0.75, headHits * 0.1).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(0, -7.5, 3.6, 3, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  // blood on a standing person, progressive (called by js/game/hdchars.js in place of its fixed stains)
  stains(ctx, a, x0, y0, col, dir, hd) {
    let lv = a.bloody > 0 ? a.bloody : (a.effects && G.effects.has(a, 'blood_soaked') ? 0.6 : 0);
    if (!(lv > 0) || !gore()) return;
    const kx = G.hd.WW / G.hd.FW, ky = G.hd.WH / G.hd.FH, info = hd && hd.heads[dir] && hd.heads[dir][col];
    const hands = info && info.hands ? info.hands.filter(Boolean).map((h) => [x0 + h[0] * kx, y0 + h[1] * ky]) : [[x0 + 4, y0 + 13], [x0 + 16, y0 + 13]];
    const face = info && dir !== 3 && !(a._b && G.body && G.body.ANG && Math.cos(G.body.ANG[a._b.h]) < -0.3) ? [x0 + (info.hx + 4) * kx, y0 + (info.hy + 5) * ky] : null;
    // the body as it stands now: narrower seen from the side, its back has no face to spatter
    const hd8 = a._b ? a._b.h : dir, Fz = G.body && G.body.ANG ? Math.cos(G.body.ANG[hd8]) : 1, wk = 0.5 + 0.5 * Math.abs(Fz), cx = x0 + G.hd.WW / 2, onBody = (px) => cx + (px - (x0 + 10)) * wk;
    const r = new G.RNG(a.bloodSeed || 7), N = 40, n = Math.ceil(lv * N);
    const alpha = (0.5 + lv * 0.42).toFixed(2);
    for (let i = 0; i < N; i++) {
      let x, y, w2 = r.range(0.5, 1.4), h2 = r.range(0.5, 1.1);
      const pick = r.next();
      if (i < 8) { const h = hands[i % hands.length]; x = h[0] + r.range(-1.2, 1.2); y = h[1] + r.range(-1.5, 1); }        // hands and forearms first
      else if (i < 22) { x = onBody(x0 + 5 + r.range(0, 10)); y = y0 + 8 + r.range(0, 7); if (lv > 0.7 && pick < 0.3) { w2 *= 2; h2 *= 1.6; } }   // the front
      else if (i < 29) { if (face) { x = face[0] + r.range(-2.5, 2.5); y = face[1] + r.range(-2.5, 1.5); } else { x = onBody(x0 + 6 + r.range(0, 8)); y = y0 + 9 + r.range(0, 5); } }   // spatter on the face
      else { x = onBody(x0 + 6 + r.range(0, 8)); y = y0 + 15 + r.range(0, 6); }                                                        // the legs
      if (i >= n || (a.handsClean && (i < 8 || (i >= 22 && i < 29)))) continue;
      ctx.fillStyle = i % 4 ? `rgba(128,10,10,${alpha})` : `rgba(86,4,4,${alpha})`;
      ctx.fillRect(x, y, w2, h2);
    }
  },
};
G.bloodStains = (ctx, a, x0, y0, col, dir, hd) => K.stains(ctx, a, x0, y0, col, dir, hd);

// ---------------------------------------------------------------- the blow: knocked out, or killed
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  if (!target || target.kind !== 'npc' || target.dead || kidOf(target) || target.nonLethal || target.remote || !scene) return _dmg.apply(this, arguments);
  const kind = K.kindOf(source, o), st = target.st;
  // hitting someone who is already down: it hurts them (and their head), it marks the body, it can kill them
  if (st.ko) {
    if (kind && source) {
      const hand = { x: source.x + Math.cos(source.swing ? source.swing.base : 0) * 10, y: source.y - 7 + Math.sin(source.swing ? source.swing.base : 0) * 8 };
      K.bodyHit(scene, st, K.frameOfActor(target), source, kind, (hand.x + target.x) / 2, (hand.y + target.y - 4) / 2, 1);
      st.ko.down = (st.ko.down || 0) + 1;
      if (kind !== 'shot' && Math.random() < 0.6) st.ko.head = (st.ko.head || 0) + 1;
      st.ko.sev += amount / (target.maxHp || 30);
      st.ko.until += Math.round(amount / (target.maxHp || 30) * 120 + (kind !== 'shot' ? 4 : 0));   // every blow while down keeps them under longer
    }
    target.invuln = 0;   // someone lying there cannot dodge
    const r = _dmg.apply(this, arguments);
    target.kbx = (target.kbx || 0) * 0.25; target.kby = (target.kby || 0) * 0.25;   // a body on the ground barely moves
    return r;
  }
  if (!K.nonLethal(kind)) return _dmg.apply(this, arguments);
  // remember this beating (it fades after half a minute without a blow)
  const t = (target.koTr = target.koTr && G.loop.time - target.koTr.t < 30 ? target.koTr : { hits: 0, dmg: 0, head: 0, heavy: 0 });
  t.t = G.loop.time; t.hits++; t.dmg += amount; if (kind === 'heavy') t.heavy++;
  if (Math.random() < (kind === 'fist' ? 0.5 : 0.35)) t.head++;
  const prev = target.cheatDeath;
  let knocked = false;
  // a blow that would kill: they go down unconscious first, always (only further blows to someone already
  // on the ground can kill them)
  target.cheatDeath = function (sc) {
    if (prev && prev.call(this, sc)) return true;
    knocked = true; K.knockOut(sc, this, source, kind, K.severity(this));
    return true;
  };
  let r;
  try { r = _dmg.apply(this, arguments); }
  finally { if (prev) target.cheatDeath = prev; else delete target.cheatDeath; }
  // a hard blow can knock them out before that
  if (!knocked && !target.dead && !st.ko && r > 0) {
    const hpR = target.hp / (target.maxHp || 30);
    if (hpR < 0.6) {
      const p = Math.min(0.7, K.KO_HIT[kind] * (r / (target.maxHp || 30)) * 2.4 * (1 + t.hits * 0.12) * (1.25 - hpR) * K.punch(source));
      if (Math.random() < p) K.knockOut(scene, target, source, kind, K.severity(target));
    }
  }
  return r;
};

// ---------------------------------------------------------------- while unconscious
const _nu = NP.update;
NP.update = function (dt, scene) {
  const st = this.st;
  if (st && st.ko && !this.dead) {
    if (!this._koPlaced) { this._koPlaced = true; if (st.ko.map === scene.map.id && st.ko.x != null && Math.hypot(this.x - st.ko.x, this.y - st.ko.y) > 24) { this.x = st.ko.x; this.y = st.ko.y; } }
    this.downT = 1e9; this.sleeping = false; this.moving = false; this.state = 'schedule'; this.target = null; this.talking = false;
    st.ko.x = this.x; st.ko.y = this.y;
    if (now(scene.world) >= st.ko.until) K.wake(scene, this);
    return _nu.call(this, dt, scene);
  }
  if (this.downT > 1e5) this.downT = 0.35;   // (woke up some other way)
  // after waking
  const R = this.koReact;
  if (R && !this.dead) {
    R.t += dt;
    if (R.kind === 'police' && this.reportT > 0 && (this.reportT -= dt) <= 0) {
      const w = scene.world;
      if (R.by === 'player') { w.commitCrime('assault', scene.region, true, this.transient ? null : this.id); this.say('Police? I\'ve been attacked... yes... I saw who did it.', 4); w.log(`${this.displayName} called the police about the attack.`, 'bad'); }
      this.koReact = null;
    } else if (R.t > 90) this.koReact = null;
  }
  // slowed: dazed, limping, or damaged for good
  if (this._baseWalk == null) { this._baseWalk = this.walkSpeed; this._baseRun = this.runSpeed; }
  const limp = st && st.limpUntil && now(scene.world) < st.limpUntil, br = K.brain(st);
  if (this.dazeT > 0) this.dazeT -= dt;
  const mult = this.dazeT > 0 ? 0.45 : limp ? 0.5 : br >= 2 ? 0.7 : br ? 0.85 : 1;
  this.walkSpeed = this._baseWalk * mult; this.runSpeed = this._baseRun * (mult < 1 ? Math.max(0.4, mult) : 1);
  if (this.dazeT > 0 && Math.random() < dt / 6) this.say(G.rng.pick(['Where...', 'Which way is...', 'Huh?', 'I don\'t... remember...']), 2.5);
  if (br && !this.talking && Math.random() < dt / (br >= 2 ? 18 : 40)) this.say(K.salad(br, this.id), 3.5);
  return _nu.call(this, dt, scene);
};
// lying there: blind and silent
const _see = NP.canSee;
NP.canSee = function (scene, other, range) { if (this.st && this.st.ko) return false; return _see.call(this, scene, other, range); };
const _say = NP.say;
NP.say = function (text, t) { if (this.st && this.st.ko && !this.dead) return; return _say.call(this, text, t); };
// someone fighting a person who went down stops (you can keep going)
const _uf = NP.updateFight;
NP.updateFight = function (dt, scene) { if (this.target && this.target.st && this.target.st.ko) { this.endFight(); return; } return _uf.call(this, dt, scene); };
// an unconscious person can be looked at (and robbed), not talked to
const _talk = GS.talkTo;
GS.talkTo = function (npc) { if (npc && npc.st && npc.st.ko) { this.toast(`${npc.displayName} is out cold. ${npc.hp < (npc.maxHp || 30) * 0.3 ? 'Breathing, barely.' : 'Still breathing.'}`); return; } return _talk.apply(this, arguments); };
const _find = GS.findInteraction;
GS.findInteraction = function () {
  const t = _find.apply(this, arguments);
  if (t && t.type === 'npc' && t.ref && t.ref.st && t.ref.st.ko) t.label = `${t.ref.displayName} (unconscious)`;
  return t;
};
// the body you see
const _ad = AP.draw;
AP.draw = function (ctx) {
  const r = _ad.call(this, ctx);
  if (this.kind === 'npc' && this.st && this.st.ko && !this.dead && this.downT > 0.35) K.drawWounds(ctx, this.st, K.frameOfActor(this));
  return r;
};
// dying while unconscious: no fall (already down), the body keeps its wounds and how it lay
const _die = NP.die;
NP.die = function (source, scene) {
  const st = this.st, ko = st && st.ko && !this.dead;
  let r;
  if (ko) {
    const g0 = G.gfx; G.gfx = (n) => (n === 'hdchars' ? false : g0(n));   // (js/game/hdchars.js: no falling animation)
    try { r = _die.call(this, source, scene); } finally { G.gfx = g0; }
  } else r = _die.call(this, source, scene);
  const c = Object.values(scene.world.containers).filter((k) => k.kind === 'corpse' && Math.abs(k.x - this.x) < 0.01 && Math.abs(k.y - this.y) < 0.01).pop();
  if (c && st) {
    if (st.wounds) { c.wounds = st.wounds; c.mangle = st.mangle; c.pooled = st.pooled; }
    if (ko) c.pose = { kind: 'back', flip: this.downDir || 1, eyes: Math.random() < 0.5 };
    if (this.bloody) c.bloody = this.bloody;
  }
  if (st) { st.ko = null; st.wounds = null; st.mangle = 0; }
  return r;
};
// waking up while you are elsewhere
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  const here = new Set(scene ? scene.actors.filter((a) => a.kind === 'npc').map((a) => a.id) : []);
  for (const id in w.npcs) { const st = w.npcs[id]; if (st && st.ko && st.alive && !here.has(id) && now(w) >= st.ko.until) K.wakeAway(w, id, st); }
});
// an unconscious victim did not see who did it
const _rc = GS.reportCrime;
GS.reportCrime = function (type, victim) {
  if (victim && victim.st && victim.st.ko) { const s = victim.sleeping; victim.sleeping = true; try { return _rc.apply(this, arguments); } finally { victim.sleeping = s; } }
  return _rc.apply(this, arguments);
};

// ---------------------------------------------------------------- beating the dead
const MH = G.melee, _hits = MH.hits;
MH.hits = function (a, scene, sw, prev, nowP) {
  const r = _hits.apply(this, arguments);
  if (a.kind !== 'player' || sw.bodyHit) return r;
  const hx = a.x, hy = a.y - 7, st = sw.st, reach = st.reach * Math.max(nowP.ext, 0.6) + 8;
  for (const c of scene.containers || []) {
    if (c.kind !== 'corpse' || c.kid) continue;
    const f = K.frameOfCorpse(c), dx = f.fx - hx, dy = f.fy - hy, d = Math.hypot(dx, dy);
    if (d > reach + 6) continue;
    let da = Math.atan2(dy, dx) - nowP.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    if (d > 9 && Math.abs(da) > st.arc / 2 + 0.7) continue;
    sw.bodyHit = true; sw.stop = 0.05;
    const kind = K.kindOf(a, null) || 'fist';
    const tip = Math.min(d, st.reach), ix = hx + Math.cos(nowP.ang) * tip, iy = hy + Math.sin(nowP.ang) * tip;
    K.bodyHit(scene, c, f, a, kind, (ix + f.fx) / 2, (iy + f.fy) / 2, 1);
    if (G.fate && G.fate.sin && c.victim) G.fate.sin('dismember', { weight: 2, key: 'beatbody:' + c.id + ':' + Math.floor(G.fate.now() / 30) });
    break;
  }
  return r;
};
const C = G.containers, _cd = C.draw;
C.draw = function (ctx, c) {
  const r = _cd.call(this, ctx, c);
  if (c.kind === 'corpse' && c.mangle) K.drawWounds(ctx, c, K.frameOfCorpse(c));
  return r;
};

// ---------------------------------------------------------------- blood on you, and washing it off
const _pu = PL.update;
PL.update = function (dt, scene) {
  const r = _pu.call(this, dt, scene);
  if (this.bloody > 0) {
    if (this.bloody >= 0.35 && !G.effects.has(this, 'blood_soaked')) G.effects.add(this, 'blood_soaked', 60 * 60 * 6);   // it does not wear off by itself
    if (this.swimming) { this.bloody = Math.max(0.08, this.bloody - dt * 0.06); if (this.bloody < 0.35) G.effects.remove(this, 'blood_soaked'); }
  }
  return r;
};
const _splash = K.splash;
K.splash = function (a, amt) { _splash.call(this, a, amt); if (amt > 0) a.handsClean = false; };   // fresh blood on hands you just washed
const U = G.usables, _use = U.use, _label = U.label;
U.use = function (d, scene) {
  const p = scene.player;
  if (d.def.interact === 'shower' && p.bloody > 0) { const r = _use.apply(this, arguments); K.wash(p, 'all'); p.handsClean = false; scene.toast('The water runs red, then pink, then clear.', 'good'); return r; }
  if (d.def.interact === 'shower') { const r = _use.apply(this, arguments); K.wash(p, 'all'); return r; }
  return _use.apply(this, arguments);
};
void _label;
const _ud = GS.useDecor, _dl = GS.decorLabel;
const isSink = (d) => d && d.def && d.def.interact === 'well' && /sink/.test(d.type || '');
GS.useDecor = function (d) {
  const p = this.player;
  if (isSink(d) && p.bloody > 0 && !p.handsClean) {
    this.world.addMinutes(10);
    K.wash(p, 'hands');
    G.audio.play('eat');
    this.toast(p.bloody > 0.05 ? 'You scrub your hands and face. The rest of you still needs a shower.' : 'You wash the last of it off.', 'good');
    return;
  }
  return _ud.apply(this, arguments);
};
GS.decorLabel = function (d) { if (isSink(d) && this.player && this.player.bloody > 0 && !this.player.handsClean) return 'Wash up'; return _dl.apply(this, arguments); };

// ---------------------------------------------------------------- what is left of them, in conversation
const BRAIN_TREE = {
  start: {
    text: (c) => K.salad(K.brain(c.st), c.npc.id),
    choices: [
      { text: 'Are you okay?', next: 'ok' },
      { text: 'Do you know who I am?', next: 'who' },
      { text: 'Goodbye.', next: null },
    ],
  },
  ok: { text: (c) => (K.brain(c.st) >= 2 ? K.salad(2, c.npc.id + 'ok') : G.rng.pick(['I... think? The words keep... the words keep falling out.', 'My head is... full of... ' + G.rng.pick(K.WORDS) + '.']) + ' ' + K.salad(1, c.npc.id)), choices: [{ text: 'Take care of yourself.', next: null }] },
  who: {
    text: (c) => {
      const ko = c.st.lastWake;
      if ((c.st.headHits || 0) >= 3 && Math.random() < 0.35) return 'You... your hands. YOUR hands. ' + K.salad(K.brain(c.st), c.npc.id + 'who');
      return K.salad(K.brain(c.st), c.npc.id + 'who') + (ko ? '' : '');
    },
    choices: [{ text: 'Goodbye.', next: null }],
  },
};
G.DIALOGUES.brain_damaged = BRAIN_TREE;
const Base = G.DialogueRunner;
class Runner extends Base {
  constructor(npc, scene, treeId) {
    const br = npc && npc.st && K.brain(npc.st) && !npc.dead && treeId !== '_arrest' && treeId !== '_mugging';
    if (br) G.DIALOGUES.brain_damaged = BRAIN_TREE;   // (the dialogue table can be rebuilt when a world loads: js/game/worldfile.js)
    super(npc, scene, br ? 'brain_damaged' : treeId);
    if (br) this.go('start');
  }
}
G.DialogueRunner = Runner;
if (G.chat && G.chat.reply) { const _cr = G.chat.reply; G.chat.reply = function (runner, raw) { const br = runner && runner.npc && K.brain(runner.npc.st); if (br) return { text: K.salad(br, runner.npc.id + raw) }; return _cr.apply(this, arguments); }; }

// ---------------------------------------------------------------- no more texts from someone who can no longer use a phone
const PH = G.phone, _q = PH.queue, _dl2 = PH.deliver;
const silenced = (w, id) => { const st = w && w.npcs && w.npcs[id]; return !!(st && K.brain(st) >= 3); };   // (levels: js/game/brain.js)
PH.queue = function (w, from, text, delay) { if (silenced(w, from)) return; return _q.apply(this, arguments); };
PH.deliver = function (w, scene) { if (w.pendingTexts) w.pendingTexts = w.pendingTexts.filter((t) => !silenced(w, t.from)); return _dl2.apply(this, arguments); };
const _call = PH.call;
PH.call = function (scene, id) {
  if (silenced(scene.world, id)) { G.audio.play('select'); scene.toast(G.rng.pick([`${scene.world.displayName(id)} picks up. Breathing. A few words that are not words. The line goes dead.`, `The phone rings out. ${scene.world.displayName(id)} does not answer phones anymore.`]), 'warn'); return; }
  return _call.apply(this, arguments);
};
})();
// Waiting and sleeping: time passes for the unconscious too (they wake when their time is up, right where they
// lie), but nobody is "put back on their schedule" while out cold: the body stays where it fell.
(() => {
const NP = G.NPC.prototype, GS = G.GameScene.prototype;
const _place = NP.placeBySchedule;
NP.placeBySchedule = function () { if (this.st && this.st.ko && !this.dead) { if (this.st.ko.x != null) { this.x = this.st.ko.x; this.y = this.st.ko.y; } return; } return _place.apply(this, arguments); };
const _resync = GS.resyncNPCs;
GS.resyncNPCs = function () {
  const keep = this.actors.filter((a) => a.kind === 'npc' && a.transient && !a.dead && ((a.st && a.st.ko) || a.downT > 0.35 || a.crash));
  const r = _resync.apply(this, arguments);
  for (const a of keep) if (!this.actors.includes(a)) this.actors.push(a);
  // whoever's time is up wakes now (they were lying here all that time)
  for (const a of this.actors) if (a.kind === 'npc' && !a.dead && a.st && a.st.ko && G.world && G.world.day * 1440 + G.world.minutes >= a.st.ko.until) { a.x = a.st.ko.x != null ? a.st.ko.x : a.x; a.y = a.st.ko.y != null ? a.st.ko.y : a.y; G.ko.wake(this, a); }
  return r;
};
})();
