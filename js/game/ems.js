'use strict';
// Emergency services, a hospital, and the people who clean up.
//   Finding someone: an NPC who sees an unconscious or dead person decides what to do from who they are:
//   ignore it and walk on (criminals, the homeless, the jaded), run (the timid), call the police, call the
//   police and an ambulance (the decent, the cheerful, any cop), or hesitate: walk over carefully, look, and
//   then decide. Only some of them ever call.
//   The ambulance: dispatched to the call, it drives in on the nearest road with its siren on and parks.
//   Two paramedics walk to the patient, kneel, examine them (and stop any bleeding), lift them onto a
//   stretcher, carry them to the ambulance and drive off. Someone dead: they check, call it, and have the
//   coroner come for the body (js/game/law.js).
//   The hospital (city center): nurses, a doctor, paramedics. Patients lie in the ward until they are well
//   (longer the worse it was; brain damage keeps them longer); nurses make the rounds. Then they go home,
//   with whatever the injury left them (js/game/brain.js).
//   The cleanup crew: after a body is taken away the blood stays (it does not just vanish any more) until a
//   crew in hazmat suits comes, finds every stain and scrubs it, the stains fading as they work.
//   Off screen, all of it moves on hour by hour.
(() => {
const L = G.law, V = G.vehicles, NP = G.NPC.prototype, GS = G.GameScene.prototype, AP = G.Actor.prototype, K = G.ko;
const now = () => (G.world ? G.world.day * 1440 + G.world.minutes : 0);
const say = (a, arr, t = 3) => a && a.say && a.say(G.rng.pick(arr), t);
const st0 = (w) => (w.ems = w.ems || { jobs: [], seq: 0 });
const PARAMEDIC = { top: 'shirt', shirt: '#2a6a4a', bottom: 'pants', pants: '#1e3a2e', shoes: '#141416', hat: 'cap', hatColor: '#2a6a4a' };
const CLEANER = { top: 'hoodie', shirt: '#e8e8e0', bottom: 'pants', pants: '#e0e0d8', shoes: '#c8c8c0', mask: 'medical' };
const NURSE = { top: 'shirt', shirt: '#4a9aa8', bottom: 'pants', pants: '#4a9aa8', shoes: '#e8e8e8' };
const DOCTOR = { top: 'jacket', shirt: '#f0f0ec', shirt2: '#5a7aa8', bottom: 'pants', pants: '#3a3a44', shoes: '#141416' };

// ---------------------------------------------------------------- the ambulance
V.MODELS.ambulance = { body: '#f2f2ee', cab: '#f2f2ee', siren: true, len: 34, wid: 15, max: 210, acc: 120, hp: 160, value: 1800 };
if (G.vehiclesHD) {
  const _get = G.vehiclesHD.get;
  G.vehiclesHD.get = function (model) {
    const c = _get.call(this, model);
    if (model === 'ambulance' && c && !c._amb) {
      c._amb = true;
      const x = c.getContext('2d'), Lw = c.width, H = c.height;
      x.fillStyle = '#d02828'; x.fillRect(6, 3, Lw - 14, 2); x.fillRect(6, H - 5, Lw - 14, 2);     // the stripes down both sides
      x.fillStyle = '#d02828'; const cx = Lw * 0.42, cy = H / 2; x.fillRect(cx - 5, cy - 1.5, 10, 3); x.fillRect(cx - 1.5, cy - 5, 3, 10);   // the cross on the roof
      x.fillStyle = '#ff3a3a'; x.fillRect(Lw - 22, 3, 3, 3); x.fillStyle = '#3a6aff'; x.fillRect(Lw - 22, H - 6, 3, 3);   // light bar
    }
    return c;
  };
}

// ---------------------------------------------------------------- who calls
const lifeOf = (a) => (G.lifestyle && !a.transient ? G.lifestyle.of(a.id) : a.def && (a.def.mugger || a.def.dealer) ? 'gang' : 'worker');
const decide = (scene, a, inc, noHesitate) => {
  const life = lifeOf(a), trait = G.social ? G.social.persona(a.id).trait : null;
  const crim = (G.CRIMINAL_FACTIONS || []).includes(a.def.faction) || a.def.dealer || a.def.mugger || a.faction.outlaw;
  const cop = a.def.combat === 'guard' || a.def.faction === 'government';
  if (a.def.kid) return 'flee';
  const dead = inc.kind === 'dead', w = {
    ignore: crim ? 4 : life === 'homeless' ? 3 : 0.5 + (trait === 'suspicious' || trait === 'proud' ? 0.7 : 0),
    flee: a.def.combat === 'flee' ? (trait === 'tired' ? 0.6 : 1.2) + (dead ? 0.8 : 0) : 0.3,
    police: crim ? 0 : cop ? 1 : 1.1 + (dead ? 1.4 : 0),
    both: crim ? 0.15 : cop ? 6 : 1.4 + (trait === 'cheerful' || trait === 'chatty' ? 1 : 0) + (life === 'retiree' || life === 'rich' ? 0.5 : 0),
    hesitate: noHesitate ? 0 : crim ? 0.4 : 1.4,
  };
  // the person standing over the body is the one who did it, as far as they can tell
  const p = scene.player;
  if (p && Math.hypot(p.x - inc.x, p.y - inc.y) < 30 && !crim) { w.flee += 1.2; w.police += 1; w.hesitate *= 0.3; }
  let r = Math.random() * Object.values(w).reduce((s, x) => s + x, 0);
  return Object.keys(w).find((k) => (r -= w[k]) < 0) || 'ignore';
};
const act = (scene, a, inc, choice) => {
  const ws = scene.world, phone = '*dials*';
  a.emsDone = a.emsDone || new Set(); a.emsDone.add(inc.key);
  if (choice === 'ignore') { if (Math.random() < 0.4) say(a, ['Not my problem.', 'Huh. Whatever.', '...', 'Somebody else will deal with it.'], 2.5); return; }
  if (choice === 'flee') { say(a, inc.kind === 'dead' ? ['Oh my God! Oh my God!', 'Is that a... no, no, no!'] : ['What happened to him?! I\'m not getting involved!', 'Oh God... I\'m getting out of here.']); a.st.fear = Math.max(a.st.fear || 0, 70); a.startFlee({ x: inc.x, y: inc.y, dead: false, kind: 'place' }); return; }
  if (choice === 'hesitate') { a.emsTask = { key: inc.key, x: inc.x, y: inc.y + 12, t: 0, wait: 2.5 + Math.random() * 2, then: () => act(scene, a, inc, decide(scene, a, inc, true)) }; say(a, ['Hey... are you okay?', 'Hello? Can you hear me?', 'Is... is he breathing?'], 3); return; }
  // calling
  if (inc.kind === 'dead') {
    const c = ws.containers[inc.corpse], rec = c && c.victim && ws.dead[c.victim];
    say(a, [`${phone} Police? There's a body. Someone's dead.`, `${phone} I need the police. There's a dead person here.`], 4);
    if (rec) { rec.discovered = true; rec.foundBy = a.id; if (L && L.call911) L.call911(ws, c, scene.map.id); }
    if (choice === 'both') G.ems.dispatch(scene, inc);
    return;
  }
  say(a, choice === 'both' ? [`${phone} Yes, an ambulance! Someone's unconscious, they're not moving!`, `${phone} 911? There's a man down. He's breathing, I think. Please hurry.`] : [`${phone} Police? Someone's been beaten, they're lying on the street.`], 4);
  ws.log(`Someone called ${choice === 'both' ? 'an ambulance' : 'the police'} for ${inc.name}.`, 'info');
  if (choice === 'both') G.ems.dispatch(scene, inc);
};

// ---------------------------------------------------------------- jobs
const E = G.ems = {
  dispatch(scene, inc) {
    const s = st0(scene.world);
    if (s.jobs.some((j) => j.key === inc.key && j.stage !== 'done')) return;
    const j = { id: 'ems' + (++s.seq), key: inc.key, kind: inc.kind, npc: inc.npc || null, corpse: inc.corpse || null, map: scene.map.id, x: inc.x, y: inc.y, stage: 'called', t: 25 + Math.random() * 25, born: scene.world.day };
    if (inc.ref && inc.ref.transient) j.ref = inc.ref;
    s.jobs.push(j);
  },
  clean(w, map, x, y) {
    const s = st0(w);
    if (s.jobs.some((j) => j.kind === 'clean' && j.map === map && Math.hypot(j.x - x, j.y - y) < 40 && j.stage !== 'done')) return;
    s.jobs.push({ id: 'ems' + (++s.seq), kind: 'clean', map, x, y, stage: 'called', t: 40 + Math.random() * 40, born: w.day });
  },
  patientOf(scene, j) { return j.ref || (j.npc && scene.actors.find((a) => a.id === j.npc && a.kind === 'npc')); },
  crew(scene, j) { return scene.actors.filter((a) => a.emsJob === j.id && !a.dead); },
  // into the hospital: off the street, onto the ward
  admit(w, a) {
    const st = a.st, ko = st.ko, sev = (ko && ko.sev) || 0.5, L2 = K.brain(st) || 0;
    if (a.transient) return;
    st.inHospital = { until: now() + G.util.clamp(Math.round(360 + sev * 1440 + L2 * 1440 + (st.bleed ? 360 : 0)), 240, 14400), bed: null, since: now() };
    st.bleed = null; st.map = 'city'; st.x = null; st.y = null;
    if (ko) { ko.map = 'city'; ko.x = null; ko.y = null; }
    w.log(`${w.displayName(a.id)} was taken to the hospital.`, 'info');
  },
  update(scene, dt) {
    const w = scene.world, s = st0(w);
    for (const j of s.jobs) {
      if (j.stage === 'done' || j.map !== scene.map.id) continue;
      j.t -= dt;
      if (j.kind === 'clean') { this.cleanStep(scene, j, dt); continue; }
      const pat = this.patientOf(scene, j), crew = this.crew(scene, j);
      if (j.stage === 'called' && j.t <= 0) {
        const at = L.roadNear(scene.map, j.x, j.y);
        const go = (x, y) => { for (let k = 0; k < 2; k++) { const m = L.spawn(scene, { name: 'Paramedic', look: PARAMEDIC, combat: 'flee', role: 'paramedic' }, x + k * 10, y); m.emsJob = j.id; L.sendTo(m, j.x + (k ? 9 : -9), j.y + 4); } j.stage = 'walk'; j.t = 60; };
        if (at) { j.v = L.car(scene, 'ambulance', at, (v) => go(v.x, v.y)); j.v.sirenOn = true; j.stage = 'driving'; j.t = 90; } else go(j.x + 60, j.y + 60);
        continue;
      }
      if (j.stage === 'driving' && j.t <= 0 && !crew.length) { j.stage = 'called'; j.t = 0; continue; }   // (the car never made it: on foot)
      if (j.stage === 'walk') {
        const pos = j.kind === 'dead' ? { x: j.x, y: j.y } : pat || { x: j.x, y: j.y };
        for (const m of crew) L.sendTo(m, pos.x + (crew.indexOf(m) ? 9 : -9), pos.y + 4);
        if (crew.some((m) => Math.hypot(m.x - pos.x, m.y - pos.y) < 22) || j.t <= 0) { j.stage = 'treat'; j.t = 6; for (const m of crew) { m.moving = false; m.faceTowards(pos); } }
        continue;
      }
      if (j.stage === 'treat') {
        if (Math.random() < dt * 0.5) say(G.rng.pick(crew), j.kind === 'dead' ? ['No pulse.', 'Pupils fixed. He\'s gone.', 'Time of death... note it.'] : ['Sir? Can you hear me?', 'Pulse is weak but steady.', 'Pupils are uneven. Head trauma.', 'Pressure on that wound.', 'Get the board. On three.'], 2.5);
        if (pat && G.bleed && G.bleed.is(pat)) G.bleed.stop(pat);
        if (j.t > 0) continue;
        if (j.kind === 'dead' || !pat || pat.dead) {   // gone: they call the coroner
          const c = w.containers[j.corpse] || Object.values(w.containers).find((k) => k.kind === 'corpse' && Math.hypot(k.x - j.x, k.y - j.y) < 30);
          if (c && c.victim && w.dead[c.victim] && L.call911) { w.dead[c.victim].discovered = true; L.call911(w, c, scene.map.id); }
          say(crew[0], ['Call the coroner. Nothing more we can do.', 'He\'s gone. Let the police have the scene.'], 3);
          this.leave(scene, j, crew); continue;
        }
        if (!pat.st.ko) { say(crew[0], ['Take it easy. You took a hard knock.', 'Don\'t try to stand yet.'], 3); this.leave(scene, j, crew); continue; }
        j.stage = 'carry'; j.t = 90;
        const dest = j.v && !j.v.gone ? j.v : { x: j.x + 80, y: j.y + 80 };
        for (const m of crew) L.sendTo(m, dest.x + (crew.indexOf(m) ? 10 : -10), dest.y + 6);
        continue;
      }
      if (j.stage === 'carry') {
        if (!pat || pat.dead) { j.stage = 'treat'; j.t = 0; continue; }
        if (crew.length) { const mx = crew.reduce((n, m) => n + m.x, 0) / crew.length, my = crew.reduce((n, m) => n + m.y, 0) / crew.length; pat.x = mx; pat.y = my + 2; pat._stretcher = true; pat.kbx = pat.kby = 0; }
        const dest = j.v && !j.v.gone ? j.v : null;
        if ((dest && crew.some((m) => Math.hypot(m.x - dest.x, m.y - dest.y) < 26)) || j.t <= 0) {
          if (G.emsPlus && j.v && !j.v.gone) { G.emsPlus.board(scene, j, pat, crew); continue; }   // (the rear doors, the drive, the ward: js/game/emsplus.js)
          scene.actors = scene.actors.filter((a) => a !== pat);
          pat._stretcher = false;
          this.admit(w, pat);
          this.leave(scene, j, crew, true);
        }
      }
    }
    s.jobs = s.jobs.filter((j) => j.stage !== 'done' || w.day - j.born < 1);
  },
  leave(scene, j, crew, inCar) {
    j.stage = 'done';
    for (const m of crew) { if (inCar) m.gone = true; else m.leaveT = 6; }
    if (j.v) { j.v.lawLeave = inCar ? 2 : 8; }
    scene.actors = scene.actors.filter((a) => !a.gone);
  },
  // the cleanup crew: find every stain near the scene, scrub it away
  cleanStep(scene, j, dt) {
    const w = scene.world, crew = this.crew(scene, j);
    const stains = (G.gore.list(scene) || []).filter((d) => Math.hypot(d.x - j.x, d.y - j.y) < 70 && (d.clean || 0) < 1);
    if (j.stage === 'called' && j.t <= 0) {
      const at = L.roadNear(scene.map, j.x, j.y);
      const go = (x, y) => { for (let k = 0; k < 2; k++) { const c = L.spawn(scene, { name: 'Cleanup Crew', look: CLEANER, combat: 'flee', role: 'cleaner' }, x + k * 10, y); c.emsJob = j.id; } j.stage = 'scrub'; j.t = 240; };
      if (at) { j.v = L.car(scene, 'car_white', at, (v) => go(v.x, v.y)); j.stage = 'driving'; j.t = 90; } else go(j.x + 60, j.y + 60);
      return;
    }
    if (j.stage === 'driving' && j.t <= 0 && !crew.length) { j.stage = 'called'; j.t = 0; return; }
    if (j.stage !== 'scrub') return;
    if (!stains.length || j.t <= 0) { say(crew[0], ['That\'s the last of it.', 'Clean. Pack it up.'], 2.5); this.leave(scene, j, crew); return; }
    for (const c of crew) {
      let d = c.scrubTarget;
      if (!d || !stains.includes(d)) { d = c.scrubTarget = stains.filter((x) => !crew.some((o) => o !== c && o.scrubTarget === x)).sort((a, b) => ((a.unreach || 0) - (b.unreach || 0)) * 1000 + Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))   /* (the ones they could not reach go last) */[0] || stains[0]; }
      // a stain under furniture or against a wall cannot be stood on: from close by they reach it with the mop;
      // one they cannot get near at all is left for last (they never stand around until the shift ends)
      if (c._scrubFor !== d) { c._scrubFor = d; c.scrubWalk = 0; }
      c.scrubWalk += dt;
      const far = Math.hypot(d.x - c.x, d.y + 6 - c.y);
      if (far > 10 && !(far < 34 && c.scrubWalk > 4)) {
        if (c.scrubWalk > 14) { d.unreach = (d.unreach || 0) + 1; c.scrubTarget = null; c._scrubFor = null; continue; }
        L.sendTo(c, d.x, d.y + 6); c.scrubbing = false; continue;
      }
      c.moving = false; c.scrubbing = true; c.faceTowards(d);
      d.clean = Math.min(1, (d.clean || 0) + dt / (d.type === 'pool' ? 6 : 2.2));   // the stain fades as they scrub
      if (Math.random() < dt * 8) scene.particles(d.x + (Math.random() - 0.5) * 6, d.y - 1, Math.random() < 0.6 ? '#f0f4f8' : '#e8b8c0', 1);   // suds, pink with blood
      if (d.clean >= 1) { const list = G.gore.list(scene), i = list.indexOf(d); if (i >= 0) list.splice(i, 1); c.scrubTarget = null; }
    }
  },
  // off screen: one step per hour
  hourly(w) {
    const s = st0(w), scene = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene);
    for (const j of s.jobs) {
      if (j.stage === 'done' || (scene && j.map === scene.map.id)) continue;
      if (j.kind === 'clean') { const list = w.decals && w.decals[j.map]; if (list) w.decals[j.map] = list.filter((d) => Math.hypot(d.x - j.x, d.y - j.y) > 70); j.stage = 'done'; continue; }
      if (j.kind === 'dead') { j.stage = 'done'; continue; }
      const st = j.npc && w.npcs[j.npc];
      if (st && st.alive && st.ko) E.admit(w, { id: j.npc, st, transient: false });
      j.stage = 'done';
    }
    // the hospital lets people go home
    for (const id in w.npcs) {
      const st = w.npcs[id], h = st && st.inHospital;
      if (!h || !st.alive) continue;
      if (st.ko && now() >= st.ko.until) st.ko = null;
      if (now() >= h.until) { st.inHospital = null; st.hp = (G.NPCS[id] && G.NPCS[id].hp) || 30; st.map = (G.NPCS[id] && G.NPCS[id].map) || st.map; w.log(`${w.displayName(id)} was released from the hospital.`, 'info'); }
    }
  },
};
E.decideFor = (scene, a, inc) => decide(scene, a, inc);
G.events.on('hour', () => { if (G.world) E.hourly(G.world); });

// ---------------------------------------------------------------- the coroner leaves the blood for the crew
const _remove = L.removeBody;
L.removeBody = function (w, j) {
  const list = w.decals && w.decals[j.map], keep = list ? list.slice() : null;
  const r = _remove.apply(this, arguments);
  if (keep) w.decals[j.map] = keep;   // (the stains stay until someone scrubs them)
  E.clean(w, j.map, j.x, j.y);
  return r;
};

// ---------------------------------------------------------------- noticing
const incidents = (scene) => {
  const out = [], w = scene.world;
  for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.st && a.st.ko && !a.st.inHospital && !a._stretcher) out.push({ key: 'ko:' + (a.id || a.uid), kind: 'ko', npc: a.transient ? null : a.id, ref: a, x: a.x, y: a.y, name: a.displayName });
  for (const c of scene.containers || []) if (c.kind === 'corpse') { const rec = c.victim && w.dead[c.victim]; if (!rec || !rec.removed) out.push({ key: 'c:' + c.id, kind: 'dead', corpse: c.id, x: c.x, y: c.y, name: c.name || 'someone' }); }
  return out;
};
const sees = (scene, a, inc) => {
  const d = Math.hypot(a.x - inc.x, a.y - inc.y), r = scene.world.isNight() ? 70 : 120;
  if (d > r || scene.map.buildingAt(a.x, a.y - 3) !== scene.map.buildingAt(inc.x, inc.y - 3)) return false;
  return !G.firearms.clearLine || G.firearms.clearLine(scene.map, a.x, a.y - 6, inc.x, inc.y - 4);
};
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.apply(this, arguments);
  if (!this.world || !this.map) return r;
  if ((this.emsScanT = (this.emsScanT || 0) - dt) <= 0) {
    this.emsScanT = 1.2;
    const incs = incidents(this), s = st0(this.world);
    for (const inc of incs) {
      if (s.jobs.some((j) => j.key === inc.key && j.stage !== 'done')) continue;   // already on its way
      for (const a of this.actors) {
        if (a.kind !== 'npc' || a.dead || a.sleeping || a.talking || (a.st && a.st.ko) || a.law || a.emsJob || a === inc.ref || a.state === 'fight' || a.emsTask) continue;
        if (a.emsDone && a.emsDone.has(inc.key)) continue;
        if (!sees(this, a, inc)) continue;
        act(this, a, inc, decide(this, a, inc));
        break;   // one witness decides per incident per scan
      }
    }
  }
  E.update(this, dt);
  if (this.actors.some((a) => a.gone)) this.actors = this.actors.filter((a) => !a.gone);
  if (this.map.id === 'city') E.ward(this, dt);
  return r;
};
// a hesitant witness walks over, looks, then decides
const _nu = NP.update;
NP.update = function (dt, scene) {
  const t = this.emsTask;
  if (t && !this.dead && !(this.st && this.st.ko) && this.state === 'schedule' && !this.talking) {
    this.baseUpdate(dt, scene.map);
    if (Math.hypot(this.x - t.x, this.y - t.y) > 14 && t.t < 12) { t.t += dt; this.walkTo({ x: Math.floor(t.x / 16), y: Math.floor((t.y - 3) / 16) }, dt, scene, false); return; }
    this.moving = false;
    if ((t.wait -= dt) <= 0) { this.emsTask = null; if (t.then) t.then(); }
    return;
  }
  // a patient in the hospital: in a bed on the ward until they are well
  const h = this.st && this.st.inHospital;
  if (h && !this.dead) {
    if (scene.map.id !== 'city') { this.gone = true; return; }
    const bed = E.bedFor(scene, this);
    if (bed) { this.x = bed.x * 16 + 8; this.y = bed.y * 16 + 12; this.sleepSpot = { x: bed.x, y: bed.y }; }
    this.sleeping = true; this.downT = 0; this.moving = false; this.state = 'schedule'; this.target = null;
    if (this.st.ko && now() >= this.st.ko.until) { this.st.ko = null; this.say(G.rng.pick(['Where... is this the hospital?', 'Nurse? Nurse...', 'What happened to me?']), 4); }
    if (!this.st.ko) this.sleeping = Math.floor(now() / 30) % 3 !== 0;   // awake now and then
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt / 900); this.st.hp = this.hp;
    if (now() >= h.until) { this.st.inHospital = null; this.sleeping = false; this.hp = this.maxHp; this.st.hp = this.hp; this.say('Finally. Home.', 3); this.st.map = (G.NPCS[this.id] && G.NPCS[this.id].map) || 'city'; if (this.st.map !== 'city') this.gone = true; }
    this.baseUpdate(dt, scene.map);
    return;
  }
  return _nu.call(this, dt, scene);
};
const _place = NP.placeBySchedule;
NP.placeBySchedule = function (map) { if (this.st && this.st.inHospital) { const b = map && map.points && map.points['c_hospital_bed' + ((this.st.inHospital.bed != null ? this.st.inHospital.bed : 0) % 8)]; if (b) { this.x = b.x * 16 + 8; this.y = b.y * 16 + 12; } return; } return _place.apply(this, arguments); };
// talking to a patient: they are in bed, they can still talk (unless out cold)
const _talk = GS.talkTo;
GS.talkTo = function (npc) { if (npc && npc.st && npc.st.inHospital && !npc.st.ko) { npc.sleeping = false; return this.openDialogue(npc); } return _talk.apply(this, arguments); };
// a body on a stretcher
const _ad = AP.draw;
AP.draw = function (ctx) {
  if (this._stretcher) { ctx.fillStyle = '#d8dce2'; ctx.fillRect(this.x - 9, this.y - 6, 18, 6); ctx.fillStyle = '#8a9098'; ctx.fillRect(this.x - 10, this.y - 1, 20, 1); ctx.fillStyle = '#e8ecf0'; ctx.fillRect(this.x - 9, this.y - 6, 18, 2); }
  return _ad.call(this, ctx);
};
// scrubbing: down on one knee (a lower stance), arm moving
const _nd = NP.draw;
NP.draw = function (ctx) {
  if (!this.scrubbing || this.moving) return _nd.call(this, ctx);
  ctx.save(); ctx.translate(this.x, this.y); ctx.scale(1, 0.82); ctx.translate(-this.x, -this.y); const r = _nd.call(this, ctx); ctx.restore();
  ctx.fillStyle = '#f0e040'; ctx.fillRect(this.x + 4 + Math.sin(G.loop.time * 14) * 2, this.y - 2, 3, 2);   // the sponge
  return r;
};
// the stains fade as they are scrubbed (js/game/effectshd.js reads d.clean)

// ---------------------------------------------------------------- the hospital
E.bedFor = function (scene, a) {
  const h = a.st.inHospital, pts = [];
  for (let i = 0; i < 8; i++) { const p = scene.map.points['c_hospital_bed' + i]; if (p) pts.push(p); }
  if (!pts.length) return null;
  if (h.bed == null || h.bed >= pts.length) {
    const taken = new Set(scene.actors.filter((o) => o !== a && o.st && o.st.inHospital).map((o) => o.st.inHospital.bed));
    h.bed = pts.findIndex((_, i) => !taken.has(i)); if (h.bed < 0) h.bed = 0;
  }
  return pts[h.bed];
};
// nurses make the rounds
E.ward = function (scene, dt) {
  if ((scene.wardT = (scene.wardT || 0) - dt) > 0) return;
  scene.wardT = 18 + Math.random() * 15;
  const pats = scene.actors.filter((a) => a.st && a.st.inHospital && !a.dead);
  const nurse = scene.actors.find((a) => /^c_nurse/.test(a.id) && !a.dead && a.state === 'schedule' && !a.talking && !a.emsTask && (a.currentEntry(scene.world) || {}).act === 'work');
  if (!pats.length || !nurse) return;
  const p = G.rng.pick(pats);
  nurse.emsTask = { x: p.x, y: p.y + 14, t: 0, wait: 4, then: () => say(nurse, p.st.ko ? ['Still unconscious. Vitals are stable.', 'No change. Keep monitoring.'] : ['How are we feeling today?', 'Time for your medication.', 'Try to get some rest.'], 3) };
};
G.NPCS.c_nurse1 = { name: 'Nurse', map: 'city', faction: 'civilians', hp: 28, combat: 'flee', look: G.look('c_nurse1', Object.assign({ body: 'f' }, NURSE)), home: 'c_hospital', relations: { c_nurse2: 'colleague', c_doctor: 'colleague' },
  schedule: [{ from: 7, to: 19, at: 'c_hospital_station', act: 'work' }, { from: 19, to: 7, at: 'c_hospital_in', act: 'idle' }], job: 'Twelve-hour shifts. Coffee is a medical necessity.' };
G.NPCS.c_nurse2 = { name: 'Night Nurse', map: 'city', faction: 'civilians', hp: 28, combat: 'flee', look: G.look('c_nurse2', Object.assign({ body: 'm' }, NURSE)), home: 'c_hospital', relations: { c_nurse1: 'colleague' },
  schedule: [{ from: 19, to: 7, at: 'c_hospital_station', act: 'work' }, { from: 7, to: 19, at: 'c_hospital_in', act: 'idle' }], job: 'Nights on the ward. Quiet, mostly. Mostly.' };
G.NPCS.c_doctor = { name: 'Doctor', map: 'city', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('c_doctor', DOCTOR), home: 'c_hospital', relations: { c_nurse1: 'colleague' },
  schedule: [{ from: 8, to: 20, at: 'c_hospital_desk', act: 'work' }, { from: 20, to: 8, at: 'c_hospital_in', act: 'idle' }], job: 'Emergency medicine. I see the worst of this city.' };
G.NPCS.c_paramedic = { name: 'Paramedic', map: 'city', faction: 'civilians', hp: 40, combat: 'flee', look: G.look('c_paramedic', PARAMEDIC), home: 'c_hospital', relations: { c_doctor: 'colleague' },
  schedule: [{ from: 0, to: 24, at: 'c_hospital_in', act: 'idle' }], job: 'We bring them in. Whatever shape they\'re in.' };
if (G.SHOP_SIGNS) G.SHOP_SIGNS.push([/Hospital/, { text: 'HOSPITAL', bg: '#f4f4f0', fg: '#d02828', awning: null, icon: null }]);
if (G.MAPGEN.city) {
  const _city = G.MAPGEN.city;
  G.MAPGEN.city = () => {
    const m = _city(), r = new G.RNG('hospital');
    // the biggest lot the city center has free (the city is dense: try smaller footprints)
    let at = null, BW = 16, BH = 10;
    for (const [bw, bh] of [[16, 10], [14, 9], [13, 8], [12, 8], [11, 7], [10, 7]]) { at = G.home && G.home.findSpot(m, bw, bh, Math.floor(m.w / 2), Math.floor(m.h / 2), Math.max(m.w, m.h)); if (at) { BW = bw; BH = bh; break; } }
    if (!at) {   // no free lot: the hospital takes over the biggest building nobody lives in, works in or visits
      const used = JSON.stringify(Object.values(G.NPCS).filter((d) => d.map === 'city').map((d) => [d.home, d.schedule]));
      const cands = m.buildings.filter((b) => (!b.kind || b.kind === 'house') && b.w >= 9 && b.h >= 7 && !used.includes('"' + b.id) && !used.includes(b.id + '_')).sort((a, b) => b.w * b.h - a.w * a.h || Math.hypot(a.x - m.w / 2, a.y - m.h / 2) - Math.hypot(b.x - m.w / 2, b.y - m.h / 2));
      const old = cands[0];
      if (!old) { G.ems.noHospital = true; return m; }
      at = { x: old.x, y: old.y }; BW = Math.min(16, old.w); BH = Math.min(10, old.h);
      m.buildings.splice(m.buildings.indexOf(old), 1);
      m.decor = m.decor.filter((d) => !(d.tx >= old.x && d.tx < old.x + old.w && d.ty >= old.y && d.ty < old.y + old.h));
      m.chests = (m.chests || []).filter((c) => !(c.tx >= old.x && c.tx < old.x + old.w && c.ty >= old.y && c.ty < old.y + old.h));
    } else G.home.clearArea(m, at.x, at.y, BW, BH);
    const b = m.addBuilding('c_hospital', at.x, at.y, BW, BH, { name: 'Hospital', wall: 'wall_concrete', floor: 'tilefloor', roof: 'flat_light', kind: 'hospital' });
    const P = new G.RoomPlan(m, b);
    // the ward along the back wall: beds with a nightstand between each pair
    const beds = [];
    for (let x = P.ix0; x <= P.ix1 && beds.length < 8; x += 2) if (P.put('bed', x, P.iy0)) { beds.push({ x, y: P.iy0 }); P.put('nightstand', x + 1, P.iy0); }
    beds.forEach((bd, i) => { m.points['c_hospital_bed' + i] = { x: bd.x, y: bd.y + 1 }; });
    // reception, the nurse station, the waiting area
    P.putAny('desk', P.row(P.iy1 - 1, P.ix0 + 1, P.ix0 + 4));
    P.putAny('office_chair_up', P.row(P.iy1 - 2, P.ix0 + 1, P.ix0 + 4));
    P.putAny('counter', P.row(P.iy0 + 2, P.ix1 - 4, P.ix1 - 1));
    for (let i = 0; i < 4; i++) P.putAny('chair', P.row(P.iy1, P.ix1 - 5, P.ix1));
    for (const t of ['plant', 'watercooler', 'vending', 'plant', 'sink']) if (G.DECOR[t]) P.putAny(t, P.row(P.iy1, P.ix0, P.ix1).concat(P.row(P.iy0 + 2, P.ix0, P.ix0 + 2)));
    m.points.c_hospital_station = { x: P.ix1 - 3, y: P.iy0 + 3 };
    m.points.c_hospital_desk = { x: P.ix0 + 2, y: P.iy1 - 2 };
    m.computeSolids(); m.prerender && m.prerender();
    void r;
    return m;
  };
}
})();
