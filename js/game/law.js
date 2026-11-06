'use strict';
// The law, reworked: wanted status, real police units, body discovery, investigations and cases.
//
//   Heat & wanted: the bounty stays as an internal heat value per region (w.bounty, never shown on the HUD).
//     Brutal crimes (multiple murders, killing a cop, child murder, a mass shooting, cannibalism or
//     dismemberment found out, arson that kills) make you WANTED EVERYWHERE (w.law.wanted): every region's
//     heat is pinned high and it never cools by itself. It ends only by doing time (jail), a faction wipe
//     (gov/cia/elite, the Maizonary 77, Ashford's fix) or the case against you collapsing.
//     You learn your status from the world, the phone (LifeLog > Legal status, News) and chatBCT.
//   Bodies: anyone who sees a corpse reacts and calls 911. Hidden bodies are found only by chance (smell,
//     dogs, garbage collectors, water). A call sends a patrol car (siren and lights) that parks; officers
//     walk to the body and tape off the area; a detective and forensics photograph, kneel and set evidence
//     markers; then the coroner's crew takes the body away and cleans the blood. Off screen it all runs on
//     a timer.
//   Investigations: every kill is recorded (killer, weapon, time, place, witnesses, evidence: blood on
//     clothes, mask, gloves, body moved, burnt, disposed). Once investigators reach a body a case opens.
//     Each day it may be solved: evidence, witnesses, the suspect's LUCK (and Stealth skills for you), and
//     always a pure random factor. Cases go cold after 10 days. Solved: an NPC killer is arrested
//     (st.jailedUntil); you become wanted. Weak evidence can convict an innocent. A detective may question
//     you: lie (Charisma), lawyer up, confess, or point at someone else.
//   Police: response depends on the district (fast in Center and the Rich District, slow or absent in
//     Southside and Eastside, a sheriff in the country); patrol, then backup, then SWAT for brutal crimes.
//     They lose you when you stay out of sight; masks and a change of clothes make you hard to recognize;
//     cameras in shops see what people do not; some cops take bribes.
(() => {
const pick = (a) => G.rng.pick(a);
const gameScene = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const WANTED_HEAT = 800;
// district: [seconds until police arrive, chance anyone comes at all]
const RESPONSE = { heights: [14, 1], center: [20, 1], suburbs: [35, 0.95], jail: [5, 1], southside: [80, 0.5], eastside: [70, 0.55], rural: [55, 0.85], forest: [90, 0.6] };
const COP_LOOK = { top: 'shirt', shirt: '#2a3a6a', pants: '#1e2230', hat: 'cap', hatColor: '#1e2a4a' };
const SWAT_LOOK = { top: 'vest', shirt: '#1a1c20', shirt2: '#2a2c30', pants: '#1a1c20', hat: 'helmet', hatColor: '#1a1c20' };
const DET_LOOK = { top: 'suit', shirt: '#4a4438', pants: '#3a362e' };
const LAB_LOOK = { top: 'shirt', shirt: '#e8e8e8', pants: '#e0e0e0', hat: 'cap', hatColor: '#d8d8d8' };
const CREW_LOOK = { top: 'shirt', shirt: '#1e2a3a', pants: '#1e2a3a' };
const SHERIFF_LOOK = { top: 'shirt', shirt: '#8a7a50', pants: '#4a3e2a', hat: 'cap', hatColor: '#5a4a2a' };

const L = G.law = {
  WANTED_HEAT, RESPONSE,
  state(w) {
    const s = w.law = w.law || {};
    s.kills = s.kills || {}; s.cases = s.cases || []; s.jobs = s.jobs || []; s.recent = s.recent || [];
    s.seq = s.seq || 0;
    if (s.wanted === undefined) s.wanted = null;
    return s;
  },
  isWanted(w) { return !!this.state(w).wanted; },
  districtOf(map) { return map.meta.district || map.meta.region || 'center'; },

  // ---------------------------------------------------------------- wanted everywhere
  makeWanted(w, reason) {
    const s = this.state(w);
    if (s.wanted) { if (!s.wanted.reasons.includes(reason)) s.wanted.reasons.push(reason); return; }
    s.wanted = { reasons: [reason], day: w.day };
    this.enforce(w);
    w.log(`You are wanted everywhere: ${reason}.`, 'bad');
    w.rumor(`Police in every county are hunting a suspect for ${reason}.`, null);
    G.events.emit('toast', 'Police everywhere are looking for you.', 'bad');
  },
  endWanted(w, how) {
    const s = this.state(w);
    if (!s.wanted) return;
    s.wanted = null;
    w.log(`You are no longer wanted everywhere (${how}).`, 'good');
  },
  enforce(w) {
    const s = this.state(w);
    if (!s.wanted) return;
    for (const r of Object.keys(G.REGIONS)) w.bounty[r] = Math.max(w.bounty[r] || 0, WANTED_HEAT);
    s.enforcedDay = w.day; s.enforcedMin = w.minutes;
  },
  // what the world knows about you (for the phone and chatBCT; never a number)
  statusLines(w) {
    const out = [], s = this.state(w);
    if (s.wanted) out.push(`WANTED EVERYWHERE: ${s.wanted.reasons.join(', ')}. Every cop, sheriff and ranger knows your face.`);
    for (const r of Object.keys(G.REGIONS)) {
      const b = w.bounty[r] || 0;
      if (!b || s.wanted) continue;
      const word = b >= (G.BOUNTY_KILL_ON_SIGHT || 300) ? 'are hunting you, armed' : b >= 100 ? 'are looking for you' : 'have your description';
      out.push(`${G.REGIONS[r].name}: the police ${word}.`);
    }
    const open = s.cases.filter((c) => c.status === 'open' && (c.killer === 'player' || c.suspects.includes('player')));
    if (open.length) out.push(`${open.length} open murder investigation${open.length > 1 ? 's' : ''} you might be part of.`);
    if (!out.length) out.push('Clean. As far as anyone knows.');
    return out;
  },

  // ---------------------------------------------------------------- kills
  recordKill(scene, victim, source) {
    if (!victim || victim.transient || victim.kind !== 'npc') return;
    const w = scene.world, s = this.state(w), p = scene.player;
    const byPlayer = source === p || !!(source && source.kind === 'fire' && source.firePlayer);
    const killer = byPlayer ? 'player' : source && source.kind === 'npc' ? source.id : source && source.kind === 'fire' ? 'fire' : null;
    const wpn = source && source.weaponItem ? source.weaponItem.id : source && source.def && source.def.weapon ? source.def.weapon : source && source.kind === 'fire' ? 'fire' : 'hands';
    const witnesses = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && a !== victim && a !== source && !a.sleeping && a.distTo(victim) < 160 && (!a.canSee || a.canSee(scene, victim, 160))).map((a) => a.id);
    const masked = byPlayer && !!(p.equip && p.equip.mask);
    s.kills[victim.id] = {
      victim: victim.id, killer, weapon: wpn, day: w.day, min: Math.floor(w.minutes), map: scene.map.id, x: victim.x, y: victim.y,
      region: scene.region, witnesses: witnesses.filter((id) => !id.startsWith('ev_') && !id.startsWith('law_')), masked,
      gloves: byPlayer && !!(p.equip && p.equip.gloves), blood: false, moved: false, burnt: source && source.kind === 'fire', disposed: null,
      cop: victim.def.combat === 'guard', kid: !!victim.def.kid,
    };
    if (byPlayer) {
      const now = w.stats.playSeconds;   // (not scene.time: that starts again at 0 when a save is loaded)
      s.recent.push({ t: now, day: w.day });
      s.recent = s.recent.filter((k) => now - k.t < 600);
      if (s.recent.filter((k) => now - k.t < 90).length >= 3) this.makeWanted(w, 'a mass killing');
      if (source && source.kind === 'fire') this.makeWanted(w, 'arson that killed people');
    }
  },
  evidence(k, w) {
    let e = 0.3 + Math.min(3, k.witnesses.length) * 0.12;
    if (k.weapon && /gun|pistol|rifle|shotgun|smg|revolver/.test(k.weapon)) e += 0.08;   // casings and bullets
    if (k.blood) e += 0.12;
    if (k.moved) e += 0.05;
    if (k.masked) e -= 0.15;
    if (k.gloves) e -= 0.12;
    if (k.burnt) e -= 0.2;
    if (k.disposed) e -= k.disposed === 'bury' ? 0.3 : /^dismember/.test(k.disposed) ? 0.25 : 0.2;
    if (k.tampered) e += k.tampered;
    return G.util.clamp(e, 0.02, 0.95);
  },

  // ---------------------------------------------------------------- 911 and the police at a body
  call911(w, corpse, map, how = 'call') {
    const s = this.state(w), rec = w.dead[corpse.victim];
    if (!rec || rec.policeCalled) return;
    rec.policeCalled = true;
    const m = G.maps.get(map), [delay, chance] = RESPONSE[this.districtOf(m)] || [40, 0.9];
    // even where cops are scarce, a body gets someone eventually
    s.jobs.push({ id: 'job' + (++s.seq), corpse: corpse.id, victim: corpse.victim, map, x: corpse.x, y: corpse.y, stage: 'called', t: chance >= 1 ? delay : delay * (1 + (1 - chance) * 3), how, born: w.day });
  },

  // a law NPC (transient): officers, detectives, forensics, coroner's crew
  spawn(scene, o, x, y) {
    const seed = G.util.uid('law'), look = G.look(seed, o.look || COP_LOOK);
    const def = { id: 'law_' + seed, name: o.name, map: scene.map.id, faction: 'government', hp: o.hp || 80, combat: o.combat || 'guard', weapon: o.weapon || null, look, transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: Math.floor((o.to || { x }).x / 16), y: Math.floor((o.to || { y }).y / 16) }, act: 'idle' }] };
    const st = { alive: true, name: o.name, map: scene.map.id, hp: def.hp, fear: 0, inv: o.weapon ? [[o.weapon, 1]] : [], gold: o.gold || 30, realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
    const n = new G.NPC(def.id, st, def);
    n.x = x; n.y = y; n.law = o.role || 'cop';
    scene.actors.push(n);
    return n;
  },
  // move a law NPC to a point (they walk there by schedule)
  sendTo(n, x, y) { n.def.schedule = [{ from: 0, to: 24, at: { x: Math.floor(x / 16), y: Math.floor(y / 16) }, act: 'idle' }]; n.goal = null; n.path = null; },

  // where a car can drive in from and park: the nearest road near (x, y), and a start point down the road
  roadNear(map, x, y) {
    const tx = Math.floor(x / 16), ty = Math.floor(y / 16), road = (t) => [G.T.asphalt, G.T.road_line, G.T.road_line_v].includes(t);
    let best = null;
    for (let r = 0; r <= 14 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !road(map.get(tx + dx, ty + dy))) continue;
      best = { x: tx + dx, y: ty + dy }; break;
    }
    if (!best) return null;
    // drive in along the road: horizontal if the road runs that way
    const horiz = road(map.get(best.x - 1, best.y)) && road(map.get(best.x + 1, best.y));
    const step = (k) => (horiz ? { x: best.x + k, y: best.y } : { x: best.x, y: best.y + k });
    let from = best;
    for (const dir of [-1, 1]) {
      let k = 0;
      while (k < 22 && road(map.get(step(dir * (k + 1)).x, step(dir * (k + 1)).y))) k++;
      if (k >= 10) { from = step(dir * k); break; }
    }
    return { park: { x: best.x * 16 + 8, y: best.y * 16 + 8 }, from: { x: from.x * 16 + 8, y: from.y * 16 + 8 } };
  },
  car(scene, model, at, onArrive) {
    const v = new G.Vehicle({ model, x: at.from.x, y: at.from.y, angle: Math.atan2(at.park.y - at.from.y, at.park.x - at.from.x), keys: false, lawCar: true });
    v.lawDrive = { x: at.park.x, y: at.park.y, onArrive };
    v.sirenOn = model === 'police_car';
    v.driver = 'law';
    (scene.vehicles = scene.vehicles || []).push(v);
    return v;
  },
  driveCars(scene, dt) {
    for (const v of scene.vehicles || []) {
      if (v.chase) { this.chase(scene, v, dt); continue; }
      const d = v.lawDrive;
      if (!d) {   // done here: it drives off down the road, it does not vanish where it stands
        if (v.lawLeave && !v.emsRoute && (v.lawLeave -= dt) <= 0) { const P = G.emsPlus; if (P && P.exitPoint(scene.map)) P.leaveMap(scene, v); else v.gone = true; }
        continue;
      }
      const dx = d.x - v.x, dy = d.y - v.y, dist = Math.hypot(dx, dy);
      if (dist < 4) { v.speed = 0; v.lawDrive = null; if (d.onArrive) d.onArrive(v); continue; }
      v.speed = Math.min(150, dist * 2 + 20);
      v.angle = Math.atan2(dy, dx);
      v.x += Math.cos(v.angle) * Math.min(dist, v.speed * dt); v.y += Math.sin(v.angle) * Math.min(dist, v.speed * dt);
      if (v.sirenOn && (v.sirenT = (v.sirenT || 0) - dt) <= 0) { v.sirenT = 3; G.audio.play('siren', { x: v.x, y: v.y }); }
    }
    if (scene.vehicles) scene.vehicles = scene.vehicles.filter((v) => !v.gone);
  },
  // a patrol car chasing you while you drive
  chase(scene, v, dt) {
    const p = scene.player, t = p.vehicle;
    if (!t || (scene.world.bounty[scene.region] || 0) <= 0) { v.chase = false; v.lawLeave = 8; v.sirenOn = false; return; }
    const dx = t.x - v.x, dy = t.y - v.y, dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let da = want - v.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    v.angle += G.util.clamp(da, -3 * dt, 3 * dt);
    v.speed = Math.min(v.m.max * 0.95, (v.speed || 0) + 160 * dt) * (dist < 30 ? 0.5 : 1);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt, ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!v.blocked(scene.map, nx, ny, v.angle)) { v.x = nx; v.y = ny; } else { v.speed *= 0.3; v.angle += 0.6 * dt * (Math.random() < 0.5 ? -1 : 1); }
    if ((v.sirenT = (v.sirenT || 0) - dt) <= 0) { v.sirenT = 3; G.audio.play('siren', { x: v.x, y: v.y }); }
    // boxed in and stopped: officers get out
    if (dist < 40 && Math.abs(t.speed) < 15 && !v.unloaded) {
      v.unloaded = true; v.chase = false; v.speed = 0;
      for (let k = 0; k < 2; k++) { const c = this.spawn(scene, { name: 'Police Officer', weapon: 'pistol', role: 'cop' }, v.x + (k ? 10 : -10), v.y + 10); c.state = 'arrest'; c.say('Out of the car! Hands where I can see them!', 3); }
    }
    v.lostT = dist > 420 ? (v.lostT || 0) + dt : 0;
    if (v.lostT > 15) { v.chase = false; v.lawLeave = 6; v.sirenOn = false; scene.toast('You lost the police car.', 'good'); }
  },

  // ---------------------------------------------------------------- dispatch for crimes in progress
  dispatch(scene, x, y, kind) {
    const map = scene.map, w = scene.world;
    if (map.meta.region === 'island' || this.off) return;   // the island has its own guards (tests set G.law.off)
    const s = this.state(w), key = kind + '@' + map.id;
    s.lastDispatch = s.lastDispatch || {};
    if ((s.lastDispatch[key] || -1e9) > w.stats.playSeconds - 45) return;
    s.lastDispatch[key] = w.stats.playSeconds;
    const dist = this.districtOf(map), [delay, chance] = RESPONSE[dist] || [40, 0.9];
    if (kind === 'patrol' && Math.random() > chance) return;   // nobody comes out here for that
    s.pending = s.pending || [];
    s.pending.push({ kind, x, y, map: map.id, t: kind === 'swat' ? delay * 1.5 : kind === 'backup' ? delay * 0.6 : delay });
  },
  arrive(scene, d) {
    const map = scene.map, at = this.roadNear(map, d.x, d.y);
    const rural = map.meta.region === 'rural' || map.meta.region === 'forest';
    const n = d.kind === 'swat' ? 4 : d.kind === 'backup' ? 2 : rural ? 1 : 2;
    const unit = (x, y) => {
      for (let k = 0; k < n; k++) {
        const c = this.spawn(scene, d.kind === 'swat' ? { name: 'SWAT Officer', weapon: 'assault_rifle', hp: 140, look: SWAT_LOOK, role: 'swat' }
          : rural ? { name: 'Sheriff\'s Deputy', weapon: 'shotgun', look: SHERIFF_LOOK, role: 'cop' } : { name: 'Police Officer', weapon: 'pistol', role: 'cop' }, x + (k - n / 2) * 10, y + 8);
        this.sendTo(c, d.x, d.y);
        c.state = (scene.world.bounty[scene.region] || 0) > 0 ? 'arrest' : 'schedule';
        if (k === 0) c.say(d.kind === 'swat' ? 'SWAT! Get on the ground!' : 'Police! Stop! Hands up!', 3);
        c.leaveT = 180;
      }
    };
    if (at) this.car(scene, 'police_car', at, (v) => { unit(v.x, v.y); if (scene.player.vehicle && (scene.world.bounty[scene.region] || 0) > 0) v.chase = true; });
    else { const e = map.randomWalkableNear(Math.floor(d.x / 16), Math.floor(d.y / 16), 10, G.rng, false); unit(e.x * 16 + 8, e.y * 16 + 12); }
  },

  // ---------------------------------------------------------------- the scene at a body (on screen)
  updateJobs(scene, dt) {
    const w = scene.world, s = this.state(w);
    for (const d of (s.pending || []).filter((q) => q.map === scene.map.id)) if ((d.t -= dt) <= 0) { d.done = true; this.arrive(scene, d); }
    if (s.pending) s.pending = s.pending.filter((q) => !q.done && q.map === scene.map.id);
    for (const j of s.jobs) {
      if (j.map !== scene.map.id || j.stage === 'done') continue;
      j.t -= dt;
      const crew = scene.actors.filter((a) => a.lawJob === j.id && !a.dead);
      if (j.stage === 'called' && j.t <= 0) {
        j.stage = 'patrol'; j.t = 45;
        const at = this.roadNear(scene.map, j.x, j.y);
        const out = (x, y) => { for (let k = 0; k < 2; k++) { const c = this.spawn(scene, { name: 'Police Officer', weapon: 'pistol', role: 'cop', to: j }, x + k * 10 - 5, y + 8); c.lawJob = j.id; c.combat = 'guard'; this.sendTo(c, j.x + (k ? 20 : -20), j.y + 14); } };
        if (at) this.car(scene, 'police_car', at, (v) => { v.sirenOn = false; v.lightsOn = true; out(v.x, v.y); });
        else { const e = scene.map.randomWalkableNear(Math.floor(j.x / 16), Math.floor(j.y / 16), 8, G.rng, false); out(e.x * 16 + 8, e.y * 16 + 12); }
      } else if (j.stage === 'patrol' && (crew.some((a) => a.distTo(j) < 40) || (!crew.length && j.t < -20))) {   // (crew gone after a time skip: carry on)
        j.tape = true;
        if (j.t <= 0) {
          j.stage = 'investigate'; j.t = 60;
          const at = this.roadNear(scene.map, j.x, j.y);
          const go = (x, y) => {
            const det = this.spawn(scene, { name: 'Detective', look: DET_LOOK, combat: 'guard', weapon: 'pistol', role: 'detective', to: j }, x, y); det.lawJob = j.id; this.sendTo(det, j.x + 12, j.y - 6);
            const lab = this.spawn(scene, { name: 'Forensics', look: LAB_LOOK, combat: 'flee', role: 'forensics', to: j }, x + 10, y); lab.lawJob = j.id; lab.kneel = true; this.sendTo(lab, j.x - 8, j.y + 4);
          };
          if (at) this.car(scene, 'car_gray', at, (v) => go(v.x, v.y)); else go(j.x + 40, j.y + 40);
          this.openCase(w, j.victim);
          j.markers = [0, 1, 2, 3].map((k) => ({ x: j.x + Math.cos(k * 1.7) * (10 + k * 4), y: j.y + Math.sin(k * 1.7) * (6 + k * 2) }));
        }
      } else if (j.stage === 'investigate') {
        for (const a of crew) if (a.law === 'forensics' && a.distTo(j) < 30 && Math.random() < dt * 0.8) scene.flashes.push({ x: a.x, y: a.y - 10, t: 0.05, a: 0 });   // camera flash
        if (j.t <= 0) {
          j.stage = 'coroner'; j.t = 30;
          const at = this.roadNear(scene.map, j.x, j.y);
          const go = (x, y) => { for (let k = 0; k < 2; k++) { const c = this.spawn(scene, { name: 'Coroner\'s Crew', look: CREW_LOOK, combat: 'flee', role: 'coroner', to: j }, x + k * 10, y); c.lawJob = j.id; this.sendTo(c, j.x + (k ? 10 : -10), j.y + 6); } };
          if (at) this.car(scene, 'car_white', at, (v) => go(v.x, v.y)); else go(j.x + 40, j.y + 40);
        }
      } else if (j.stage === 'coroner' && j.t <= 0 && (crew.some((a) => a.law === 'coroner' && a.distTo(j) < 30) || (!crew.some((a) => a.law === 'coroner') && j.t < -20))) {
        this.removeBody(w, j);
        scene.refreshContainers();
        j.stage = 'done'; j.tape = false; j.markers = null;
        for (const a of crew) { a.leaveT = 8; a.say(a.law === 'detective' ? pick(['We will find who did this.', 'Wrap it up.']) : '', 2); }
        for (const v of scene.vehicles || []) if (v.lawCar && !v.chase) { v.lawLeave = 10; v.lightsOn = false; }
      }
    }
    s.jobs = s.jobs.filter((j) => j.stage !== 'done' || w.day - j.born < 1);
    // law NPCs whose work is done walk off and leave
    for (const a of scene.actors) if (a.law && a.leaveT != null && !a.dead && (a.leaveT -= dt) <= 0 && a.state !== 'fight' && a.state !== 'arrest') a.gone = true;
    scene.actors = scene.actors.filter((a) => !a.gone);
  },
  removeBody(w, j) {
    if (w.containers[j.corpse]) delete w.containers[j.corpse];
    const list = w.decals && w.decals[j.map];
    if (list) w.decals[j.map] = list.filter((d) => Math.hypot(d.x - j.x, d.y - j.y) > 56);
    const rec = w.dead[j.victim]; if (rec) rec.removed = true;
  },
  // off screen: one stage per game hour
  offscreenHour(w, scene) {
    const s = this.state(w);
    for (const j of s.jobs) {
      if (j.stage === 'done' || (scene && j.map === scene.map.id)) continue;
      j.stage = { called: 'patrol', patrol: 'investigate', investigate: 'coroner', coroner: 'done' }[j.stage];
      if (j.stage === 'investigate') this.openCase(w, j.victim);
      if (j.stage === 'done') this.removeBody(w, j);
    }
  },

  // ---------------------------------------------------------------- cases
  openCase(w, victim) {
    const s = this.state(w);
    if (s.cases.some((c) => c.victim === victim)) return null;
    const k = s.kills[victim];
    if (!k) return null;
    const suspects = new Set();
    if (k.killer && k.killer !== 'fire') suspects.add(k.killer);
    // people near the scene, and people with a motive: enemies, rival gangs, debts
    const vdef = G.NPCS[victim] || {};
    for (const id in w.npcs) {
      if (suspects.size >= 5) break;
      const st = w.npcs[id], d = G.NPCS[id];
      if (!st.alive || !d || id === victim || d.kid || st.jailedUntil > w.day) continue;
      const motive = (vdef.faction && d.faction && G.factionRelation && G.factionRelation(vdef.faction, d.faction) < 0) || (st.rel && st.rel[victim] < -20) || (d.map === k.map && G.rng.chance(0.08));
      if (motive && G.rng.chance(0.4)) suspects.add(id);
    }
    if (k.killer !== 'player' && G.rng.chance(0.15)) suspects.add('player');   // you were seen around
    const c = { id: 'case' + (++s.seq), victim, killer: k.killer, day: w.day, region: k.region, map: k.map, evidence: this.evidence(k, w), witnesses: k.witnesses.length, suspects: [...suspects], status: 'open', days: 0 };
    s.cases.push(c);
    w.rumor(`Detectives opened a murder case: ${w.displayName(victim)}.`, k.region);
    return c;
  },
  // the daily push on each open case
  solveChance(w, c) {
    const p = G.player;
    let luck = 1, stealth = 0;
    if (c.killer === 'player' && p) {
      luck = G.attr ? G.attr.get(p, 'luck') : 3;
      stealth = (G.skills.has(p, 'ghost') ? 0.05 : 0) + (G.skills.has(p, 'shadow') ? 0.04 : 0) + G.util.clamp(G.skills.stat(p, 'stealth') || 0, 0, 0.3) * 0.2;
    } else if (c.killer && G.NPCS[c.killer]) luck = G.attr ? G.attr.npc(c.killer, 'luck') : 3;
    return G.util.clamp(0.04 + c.evidence * 0.3 + Math.min(3, c.witnesses) * 0.06 - (luck - 3) * 0.012 - stealth, 0.01, 0.55);
  },
  dailyCases(w, rng = G.rng) {
    const s = this.state(w);
    for (const c of s.cases) {
      if (c.status !== 'open') continue;
      c.days++;
      if (c.days > 10) { c.status = 'cold'; w.rumor(`The ${w.displayName(c.victim)} case has gone cold.`, c.region); if (c.killer === 'player') this.caseCollapsed(w, c); continue; }
      // pure chance always plays a part: even the luckiest can be caught, the unluckiest can walk
      if (rng.next() < this.solveChance(w, c) * (0.5 + rng.next())) this.solve(w, c, rng);
      else if ((c.killer === 'player' || c.suspects.includes('player')) && !c.questioned && rng.chance(0.35)) { s.question = c.id; }
    }
  },
  solve(w, c, rng = G.rng) {
    let who = c.killer;
    const innocents = c.suspects.filter((id) => id !== c.killer);
    if (c.evidence < 0.4 && innocents.length && rng.chance(0.35)) { who = rng.pick(innocents); c.wrong = true; }
    if (!who || who === 'fire') { c.status = 'cold'; return; }
    c.status = 'solved'; c.convicted = who;
    if (who === 'player') this.convictPlayer(w, c);
    else {
      const st = w.npcs[who];
      if (st && st.alive) {
        st.jailedUntil = w.day + rng.int(14, 40);
        w.rumor(`Police arrested ${w.displayName(who)} for the murder of ${w.displayName(c.victim)}.${c.wrong ? ' Some say they have the wrong person.' : ''}`, c.region);
        const sc = gameScene(), a = sc && sc.actors.find((x) => x.id === who && !x.dead);
        if (a) { if (a.def.combat === 'fight' && rng.chance(0.3)) { a.st.hostile = true; a.say('You will never take me!', 3); } else { a.say('I want a lawyer!', 3); a.gone = true; } }
      }
      // whoever really did it walks free when someone else takes the fall
      if (c.wrong && c.killer === 'player') w.log(`Someone else was convicted for ${w.displayName(c.victim)}. You got away with it.`, 'warn');
    }
  },
  convictPlayer(w, c) {
    if (w.jail) return;   // (behind bars already: js/game/jail.js)
    const k = this.state(w).kills[c.victim] || {};
    w.bounty[c.region] = (w.bounty[c.region] || 0) + ((G.CRIMES.murder && G.CRIMES.murder.bounty) || 250);
    w.knownKiller[c.region] = true;
    w.lastCrimeDay[c.region] = w.day;
    (w.crimeRecord[c.region] = w.crimeRecord[c.region] || []).push({ type: 'murder', day: w.day, time: Math.floor(w.minutes), victim: c.victim, bounty: 250 });
    w.rumor(`Detectives have named a suspect in the murder of ${w.displayName(c.victim)}. The police are looking for YOU.`, c.region);
    w.log(`The ${w.displayName(c.victim)} case: detectives identified you.`, 'bad');
    G.events.emit('toast', 'Detectives have identified you.', 'bad');
    const solved = this.state(w).cases.filter((x) => x.convicted === 'player').length;
    if (k.cop) this.makeWanted(w, 'killing a police officer');
    else if (k.kid) this.makeWanted(w, 'child murder');
    else if (solved >= 2) this.makeWanted(w, 'multiple murders');
  },
  caseCollapsed(w, c) {
    const s = this.state(w);
    if (!s.wanted) return;
    const open = s.cases.some((x) => x.status === 'open' && x.killer === 'player');
    if (!open && s.wanted.reasons.every((r) => r === 'multiple murders')) this.endWanted(w, 'the case against you collapsed');
  },

  // ---------------------------------------------------------------- drawing: tape and evidence markers
  draw(ctx, scene) {
    const s = this.state(scene.world);
    for (const j of s.jobs) {
      if (j.map !== scene.map.id) continue;
      if (j.tape) {
        const R = 30, posts = 8;
        const pts = Array.from({ length: posts }, (_, i) => [j.x + Math.cos(i / posts * Math.PI * 2) * R, j.y + Math.sin(i / posts * Math.PI * 2) * R * 0.6]);
        ctx.lineWidth = 1;
        for (let i = 0; i < posts; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % posts];
          ctx.strokeStyle = '#e8c820'; ctx.beginPath(); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x1, y1 - 5); ctx.stroke();
          ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.setLineDash([1, 2]); ctx.beginPath(); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x1, y1 - 5); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#5a5a5a'; ctx.fillRect(Math.round(x0), Math.round(y0 - 6), 1, 6);
        }
      }
      for (const m of j.markers || []) { ctx.fillStyle = '#f0c820'; ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 2, 3, 2); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(Math.round(m.x), Math.round(m.y) - 2, 1, 1); }
    }
  },
};

// ---------------------------------------------------------------- hooks
// kills
const NP = G.NPC.prototype, _die = NP.die;
NP.die = function (source, scene) {
  try { if (!this.dead) L.recordKill(scene, this, source); } catch (e) { G.reportError && G.reportError(e); }
  return _die.call(this, source, scene);
};

// brutal crimes, and what a camera sees
const WP = G.World.prototype, _cc = WP.commitCrime;
WP.commitCrime = function (type, region, witnessed, victimId, value) {
  const r = _cc.apply(this, arguments);
  if (!witnessed) return r;
  const v = victimId && G.NPCS[victimId];
  if (type === 'murder') {
    const s = L.state(this);
    s.witnessedMurders = (s.witnessedMurders || []).filter((d) => this.day - d < 4);
    s.witnessedMurders.push(this.day);
    if (v && v.combat === 'guard') L.makeWanted(this, 'killing a police officer');
    else if (s.witnessedMurders.length >= 2) L.makeWanted(this, 'multiple murders');
  }
  if (type === 'child_murder') L.makeWanted(this, 'child murder');
  if (/cannib/.test(type)) L.makeWanted(this, 'cannibalism');
  if (/dismember|desecrat|mutilat/.test(type)) L.makeWanted(this, 'dismemberment');
  return r;
};
// jail time ends it; paying a fine does not (see the arrest choices below)
const _imprison = G.jail.imprison;
G.jail.imprison = function (scene) {
  const w = scene.world; scene.pendingReports = [];   // (a witness still on the way must not report you after the cell door shuts)
  const r = _imprison.apply(this, arguments); L.endWanted(w, 'you did your time'); L.slate(w, scene); return r;
};
// what you are doing time for is paid: nothing stays on your record, and nothing new lands on it while you sit
L.slate = function (w, scene) {
  for (const k in w.bounty) w.bounty[k] = 0;
  for (const k in w.crimeRecord || {}) w.crimeRecord[k] = [];
  for (const k in w.knownKiller || {}) w.knownKiller[k] = false;
  if (scene) { scene.pendingReports = []; scene.copsHot = 0; }
};
{ const GS = G.GameScene.prototype, _gu = GS.update; GS.update = function (dt) { const r = _gu.call(this, dt); if (this.world.jail) { const s = L.state(this.world); if (s.wanted) s.wanted = null; L.slate(this.world, this); } return r; }; }

// wanted: no fine to pay, no ordinary bribe; a corrupt cop is another story
const arrest = G.DIALOGUES._arrest.start;
arrest.text = (c) => (L.isWanted(c.w) ? 'Police! Down on the ground! You are wanted for ' + L.state(c.w).wanted.reasons.join(' and ') + '. You are coming with me.' : (c.bounty() >= 100 ? 'Police! Stop right there! You match the description of a suspect. You are coming with me, or you settle this now.' : 'Police! Hold it. You have a fine to pay, or you are coming with me.'));
for (const ch of arrest.choices) {
  const t = typeof ch.text === 'function' ? ch.text({ bounty: () => 0, gold: () => 0, tag: () => '' }) : ch.text;
  if (/Pay the bounty|Bribe/.test(t)) { const old = ch.if; ch.if = (c) => !L.isWanted(c.w) && (!old || old(c)); }
}
arrest.choices.splice(arrest.choices.length - 2, 0, {
  text: (c) => `${c.tag ? c.tag(3) : ''} [Charisma] Slide the officer some cash. ($${Math.max(50, Math.ceil(c.bounty() * 0.4))})`,
  if: (c) => new G.RNG('corrupt' + c.npc.id).next() < 0.25 && c.gold() >= Math.max(50, Math.ceil(c.bounty() * 0.4)) && c.canTry('corrupt'),
  do: (c) => {
    const n = Math.max(50, Math.ceil(c.bounty() * 0.4));
    if (c.check('corrupt', L.isWanted(c.w) ? 4 : 2, 'charisma')) {
      c.p.gold -= n; c.npc.st.gold += n; G.audio.play('coin');
      if (!L.isWanted(c.w)) c.w.bounty[c.region] = 0;
      c.scene.arrestCooldown = 300;
      c.npc.say('I did not see anything. Get lost.');
      return null;
    }
    c.npc.say('Are you trying to BRIBE me? That is another charge.');
    c.w.bounty[c.region] = (c.w.bounty[c.region] || 0) + 50;
    return 'start';
  },
});

// recognition: a mask (or new clothes, a while after) and the police on the street do not know you
const outfit = (p) => [G.wet.base(p.equip.top), G.wet.base(p.equip.bottom), p.equip.hat, p.look && p.look.top, p.look && p.look.shirt].join('|');   // (rain is not a change of clothes)
const _ccr = WP.commitCrime;
WP.commitCrime = function (type, region, witnessed) {
  const r = _ccr.apply(this, arguments);
  if (witnessed && G.player) { const s = L.state(this); s.seenOutfit = outfit(G.player); s.seenMasked = !!G.player.equip.mask; s.seenAt = this.day * 1440 + this.minutes; }
  return r;
};
L.recognized = function (scene) {
  const w = scene.world, s = this.state(w), p = scene.player;
  if (s.wanted && (w.bounty[scene.region] || 0) >= WANTED_HEAT && !p.equip.mask) return true;
  if (p.equip.mask && !s.seenMasked) return false;   // they never saw this face hidden... and cannot see it now
  if (s.seenOutfit && outfit(p) !== s.seenOutfit && w.day * 1440 + w.minutes - (s.seenAt || 0) > 60) return (w.bounty[scene.region] || 0) >= 400;
  return true;
};
const _ua = NP.updateArrest;
NP.updateArrest = function (dt, scene) {
  if (!this.law && !(scene.crimeSeenT > scene.time) && !L.recognized(scene)) { this.state = 'schedule'; this.path = null; return; }
  return _ua.call(this, dt, scene);
};

// cameras in shops see what people miss
const GS = G.GameScene.prototype, _rc = GS.reportCrime;
GS.reportCrime = function (type, victim, value, victimId) {
  const r = _rc.apply(this, arguments);
  if (r) { this.crimeSeenT = this.time + 60; return r; }
  const b = this.map.buildingAt(this.player.x, this.player.y - 3);
  if (b && (b.kind === 'shop' || /Store|Shop|Bank|Pharmacy|Jewel|Liquor|Pawn|Casino|Gas/i.test(b.name || '')) && !this.player.equip.mask && ['theft', 'assault', 'murder', 'vandalism', 'extortion'].includes(type)) {
    this.world.commitCrime(type, this.region, true, victimId || (victim && victim.kind === 'npc' ? victim.id : null), value);
    this.toast('A security camera caught that.', 'bad');
    return true;
  }
  return r;
};

// witnessed crimes bring the police (by district), cops getting hurt brings backup, brutal crimes SWAT
G.events.on('crime', (crime) => {
  const scene = gameScene();
  if (!scene || !crime.witnessed) return;
  const p = scene.player, guardNear = scene.actors.some((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.distTo(p) < 300);
  if (L.isWanted(scene.world)) L.dispatch(scene, p.x, p.y, 'swat');
  else if (!guardNear && ['murder', 'assault', 'arson', 'gunfire', 'theft', 'extortion', 'child_abuse', 'child_murder'].includes(crime.type)) L.dispatch(scene, p.x, p.y, 'patrol');
});
const _onHurt = NP.onHurt;
NP.onHurt = function (source, dmg, scene) {
  const r = _onHurt.apply(this, arguments);
  if (this.def.combat === 'guard' && source === scene.player) L.dispatch(scene, this.x, this.y, L.isWanted(scene.world) ? 'swat' : 'backup');
  return r;
};

// officers who lose sight of you give up after a while
const _nu = NP.update;
NP.update = function (dt, scene) {
  const r = _nu.call(this, dt, scene);
  if (this.def.combat === 'guard' && (this.state === 'fight' || this.state === 'arrest') && !this.dead) {
    const p = scene.player, sees = this.canSee(scene, p, 200);
    this.lostT = sees ? 0 : (this.lostT || 0) + dt;
    if (sees) L.state(scene.world).lastKnown = { x: p.x, y: p.y, map: scene.map.id };
    if (this.lostT > 14) {
      this.state = 'schedule'; this.path = null; this.target = null; this.lostT = 0;
      this.say(pick(['Lost them.', 'Where did they go?', 'Dispatch, suspect is gone.']), 2);
      const lk = L.state(scene.world).lastKnown;
      if (this.law && lk && lk.map === scene.map.id) L.sendTo(this, lk.x, lk.y);   // search where you were last seen
    }
  }
  if (this.kneel && this.lawJob && !this.moving) this.doing = this.doing || { kind: 'shoe', t: 0, len: 999, said: true };
  return r;
};

// discovery: a found body gets a 911 call; the scene runs while you are there
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  try {
    const w = this.world;
    if ((this._lawScan = (this._lawScan || 0) - dt) <= 0) {
      this._lawScan = 1;
      for (const c of this.containers) {
        if (c.kind !== 'corpse' || !c.victim) continue;
        const rec = w.dead[c.victim], k = L.state(w).kills[c.victim];
        if (k) { if (this.player.dragging === c.id) k.moved = true; }
        if (rec && rec.discovered && !rec.disposed && !rec.policeCalled && (rec.witnessed || !rec.byPlayer || rec.foundBy !== 'nobody')) L.call911(w, c, this.map.id);
      }
      if (G.effects.has(this.player, 'blood_soaked')) for (const k of Object.values(L.state(w).kills)) if (k.killer === 'player' && w.day - k.day < 1) k.blood = true;
      L.enforce(w);
    }
    L.driveCars(this, dt);
    L.updateJobs(this, dt);
    // a detective comes to ask you questions
    const s = L.state(w);
    if (s.question && !L.off && !this.detective && !this.map.buildingAt(this.player.x, this.player.y - 3) && w.hour >= 9 && w.hour < 19 && !this.player.vehicle && G.scenes.top() === this) {
      const c = s.cases.find((x) => x.id === s.question);
      s.question = null;
      if (c && c.status === 'open') {
        const p = this.player, spot = this.map.randomWalkableNear(Math.floor(p.x / 16) + 6, Math.floor(p.y / 16) + 3, 2, G.rng, false);
        const det = L.spawn(this, { name: 'Detective', look: DET_LOOK, weapon: 'pistol', role: 'detective', to: p }, spot.x * 16 + 8, spot.y * 16 + 12);
        det.questionCase = c.id; this.detective = det;
      }
    }
    const det = this.detective;
    if (det) {
      if (det.dead || !this.actors.includes(det)) this.detective = null;
      else if (det.distTo(this.player) > 22) det.walkTo({ x: Math.floor(this.player.x / 16), y: Math.floor((this.player.y - 3) / 16) }, dt, this, false);
      else if (G.scenes.top() === this) { det.moving = false; det.faceTowards(this.player); G.demand.open(this, det, '_detective'); det.leaveT = 20; this.detective = null; }
    }
  } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
const _dtt = GS.drawTerritoryTags;
GS.drawTerritoryTags = function (ctx, view) { _dtt.call(this, ctx, view); L.draw(ctx, this); };

// hourly and daily
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  const sc = gameScene(), s = L.state(w);
  // a faction or a friend in high places wiped your record: the manhunt is over
  if (s.wanted && Object.keys(G.REGIONS).every((r) => !(w.bounty[r] > 0))) L.endWanted(w, 'someone made your record disappear');
  L.enforce(w);
  L.offscreenHour(w, sc);
});
G.events.on('newDay', () => {
  const w = G.world; if (!w) return;
  const s = L.state(w), sc = gameScene();
  // bodies nobody has found: people pass by, a smell, a dog, the garbage truck, the river
  for (const id in w.dead) {
    const rec = w.dead[id];
    if (rec.policeCalled || rec.removed || !s.kills[id]) continue;
    const age = w.day - rec.day, how = rec.disposed;
    if (how) s.kills[id].disposed = how;
    const chance = how === 'water' ? 0.04 : how === 'dumpster' ? 0.12 : how === 'bury' ? 0.015 : how ? 0.01 : 0.3 + age * 0.15;
    if (!G.rng.chance(chance)) continue;
    rec.discovered = true; rec.policeCalled = true; rec.foundBy = how ? 'chance' : 'smell';
    const body = Object.values(w.containers).find((c) => c.kind === 'corpse' && c.victim === id);
    if (body && !(sc && body.map === sc.map.id)) { s.jobs.push({ id: 'job' + (++s.seq), corpse: body.id, victim: id, map: body.map, x: body.x, y: body.y, stage: 'patrol', t: 0, born: w.day }); }
    else if (!body) { L.openCase(w, id); w.rumor(how === 'water' ? `A body washed up. Police say it is ${w.displayName(id)}.` : `Human remains were found. Police identified ${w.displayName(id)}.`, rec.region); }
    else rec.discovered = true;
  }
  L.dailyCases(w);
});
// the remains of a body that was buried/dumped still count as evidence of who did it
const _dispose = G.bodies.dispose;
G.bodies.dispose = function (scene, how) {
  const c = this.dragged(scene), id = c && c.victim;
  const r = _dispose.apply(this, arguments);
  if (id && L.state(scene.world).kills[id]) L.state(scene.world).kills[id].disposed = how;
  return r;
};

// ---------------------------------------------------------------- the detective's questions
G.DIALOGUES._detective = {
  start: {
    text: (c) => { const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); return `Detective ${c.st.realName.split(' ').pop()}, homicide. I am looking into what happened to ${cs ? c.w.displayName(cs.victim) : 'someone'}. Where were you on day ${cs ? L.state(c.w).kills[cs.victim].day : '?'}?`; },
    choices: [
      { text: (c) => `${c.tag(3)} [Lie] I was home all night. Ask anyone.`, if: (c) => c.canTry('det_lie'), do: (c) => {
        const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); if (!cs) return null; cs.questioned = true;
        if (c.check('det_lie', 3, 'charisma')) { cs.evidence = Math.max(0.02, cs.evidence - 0.15); cs.suspects = cs.suspects.filter((x) => x !== 'player' || cs.killer === 'player'); c.npc.say('Alright. Thanks for your time.'); }
        else { cs.evidence = Math.min(0.95, cs.evidence + 0.2); c.npc.say('Funny. Somebody saw you near there.'); }
        return null;
      } },
      { text: 'I want a lawyer. ($100)', if: (c) => c.gold() >= 100, do: (c) => { c.p.gold -= 100; const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); if (cs) { cs.questioned = true; cs.evidence = Math.min(0.95, cs.evidence + 0.03); } c.npc.say('Your right. We will talk again.'); return null; } },
      { text: (c) => `${c.tag(4)} I saw someone else there. You should look at...`, if: (c) => c.canTry('det_frame'), do: (c) => {
        const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); if (!cs) return null; cs.questioned = true;
        if (c.check('det_frame', 4, 'charisma')) { cs.evidence = Math.max(0.02, cs.evidence - 0.2); if (!cs.suspects.some((x) => x !== 'player' && x !== cs.killer)) { const others = Object.keys(c.w.npcs).filter((id) => c.w.npcs[id].alive && G.NPCS[id] && !G.NPCS[id].kid && id !== cs.victim); if (others.length) cs.suspects.push(G.rng.pick(others)); } c.npc.say('Interesting. We will look into it.'); }
        else { cs.evidence = Math.min(0.95, cs.evidence + 0.15); c.npc.say('Pointing fingers already? Noted.'); }
        return null;
      } },
      { text: 'I did it. [Confess]', do: (c) => { const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); if (cs) { cs.questioned = true; cs.status = 'solved'; cs.convicted = 'player'; L.convictPlayer(c.w, cs); } c.npc.say('...Turn around. Hands behind your back.'); c.scene.goToJail(); return null; } },
      { text: 'I have nothing to say.', do: (c) => { const cs = L.state(c.w).cases.find((x) => x.id === c.npc.questionCase); if (cs) cs.questioned = true; c.npc.say('Do not leave town.'); return null; } },
    ],
  },
};

// the siren
G.audio.SFX.siren = function (o, T) {
  const w = T._out(o, { vol: 0.5, wet: 1, range: 900, ref: 120 }); if (!w) return;
  const s = T._osc(w.node, w.t, { type: 'triangle', f: 700, dur: 0.4, vol: 0.4, a: 0.2, hold: 2.4 });
  const l = T.ctx.createOscillator(), lg = T.ctx.createGain(); l.frequency.value = 0.8; lg.gain.value = 380; l.connect(lg); lg.connect(s.frequency); l.start(w.t); l.stop(w.t + 3.1);
};

// phone: LifeLog > Legal status
G.PHONE_SCREENS.legal = (ps) => L.statusLines(ps.w).map((t) => ({ label: t, info: true, color: /WANTED|armed/.test(t) ? '#ff8a7a' : null }));
})();
