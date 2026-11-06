'use strict';
// The second half of an ambulance run, and where the dead go.
//   Roads: ambulances follow the road network tile by tile (G.emsPlus.route), brake for whatever is ahead and turn
//   smoothly. They use the same Vehicle objects as everything else on the road, so other cars collide with them.
//   Loading: at the rear doors: doors swing open, the stretcher rolls in, doors shut, the crew climb in. Then the drive:
//   on the hospital's map it pulls up outside, the crew get out, wheel the patient through the door to a free bed and
//   admit them there. On another map it drives to the road out of the map and leaves through it; the patient arrives
//   through the off-screen hospital simulation. It never vanishes in the middle of the road.
//   The dead: bodies the coroner takes go to the Office of the Medical Examiner, a locked staff room at the back of the
//   hospital (w.morgue). Refrigerated drawer, examination table, then the furnace, on the game clock and visible through
//   the room if you can get in. Cremation is recorded on the person's death record, once. Only staff get in: the door
//   needs the examiner's badge (they carry it; lifting it is a crime like any other).
(() => {
const E = G.ems, L = G.law, V = G.vehicles, GS = G.GameScene.prototype, pick = (a) => G.rng.pick(a);
const nowM = (w) => w.day * 1440 + w.minutes;
const ROAD = () => [G.T.asphalt, G.T.road_line, G.T.road_line_v];
const live = {};   // job id -> the patient while they are in the ambulance (not saved: a reload finishes the run off screen)
const P = G.emsPlus = {
  // the shortest way along road tiles
  route(map, x0, y0, x1, y1) {
    const road = ROAD(), key = (x, y) => x + y * 4096, start = [Math.floor(x0 / 16), Math.floor(y0 / 16)], goal = [Math.floor(x1 / 16), Math.floor(y1 / 16)];
    const near = (t) => { for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (road.includes(map.get(t[0] + dx, t[1] + dy))) return [t[0] + dx, t[1] + dy]; return null; };
    const a = near(start), b = near(goal);
    if (!a || !b) return null;
    const from = new Map([[key(a[0], a[1]), null]]), q = [a];
    for (let i = 0; i < q.length && i < 40000; i++) {
      const [x, y] = q[i];
      if (x === b[0] && y === b[1]) { const out = []; let c = key(x, y), t = [x, y]; while (t) { out.push(t); t = from.get(c); c = t ? key(t[0], t[1]) : null; } return out.reverse().filter((_, k, l) => k % 2 === 0 || k === l.length - 1).map((p) => ({ x: p[0] * 16 + 8, y: p[1] * 16 + 8 })); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (from.has(k) || !road.includes(map.get(nx, ny))) continue; from.set(k, [x, y]); q.push([nx, ny]); }
    }
    return null;
  },
  send(scene, v, tx, ty, onArrive) {
    v.lawDrive = null; v.lawLeave = 0;
    const path = this.route(scene.map, v.x, v.y, tx, ty);
    v.emsRoute = path && path.length ? { path, i: 0, onArrive } : null;
    if (!v.emsRoute && onArrive) onArrive(v);
  },
  // following the road: accelerate, brake for corners and for anyone ahead, turn gradually
  drive(scene, dt) {
    for (const v of scene.vehicles || []) {
      const r = v.emsRoute; if (!r) continue;
      const t = r.path[r.i];
      if (!t) { v.emsRoute = null; v.speed = 0; if (r.onArrive) r.onArrive(v); continue; }
      const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
      if (d < 12) { r.i++; continue; }
      const want = Math.atan2(dy, dx); let da = want - v.angle;
      while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      v.angle += G.util.clamp(da, -3 * dt, 3 * dt);
      const cx = Math.cos(v.angle), cy = Math.sin(v.angle);
      const blocked = scene.actors.concat(scene.vehicles).some((a) => a !== v && !a.dead && !a.emsBoarded && (() => { const ax = a.x - v.x, ay = a.y - v.y, f = ax * cx + ay * cy, s = Math.abs(ax * cy - ay * cx); return f > 8 && f < 42 && s < 12; })());
      const target = blocked ? 0 : Math.abs(da) > 0.5 ? 60 : Math.min(150, (r.path.length - r.i) * 24 + 40), acc = target > v.speed ? 90 : 220;
      v.speed += G.util.clamp(target - v.speed, -acc * dt, acc * dt);
      v.x += cx * v.speed * dt; v.y += cy * v.speed * dt;
      if (v.sirenOn && (v.sirenT = (v.sirenT || 0) - dt) <= 0) { v.sirenT = 3; G.audio.play('siren', { x: v.x, y: v.y }); }
    }
  },
  rear(v) { return { x: v.x - Math.cos(v.angle) * 22, y: v.y - Math.sin(v.angle) * 22 + 6 }; },
  // the stretcher is at the ambulance
  board(scene, j, pat, crew) { j.stage = 'doors'; j.t = 1.1; live[j.id] = pat; if (j.v) j.v.doors = 0; say(crew[0], ['Doors.', 'On my count.', 'Easy, easy.']); },
  exitPoint(map) { const road = ROAD(); let best = null; for (const e of map.exits || []) for (let k = 0; k < (e.w || 1); k++) for (let r = 0; r < 12; r++) for (const [dx, dy] of [[0, -r], [0, r], [r, 0], [-r, 0]]) { if (!best && road.includes(map.get(e.x + k + dx, e.y + dy))) best = { x: (e.x + k + dx) * 16 + 8, y: (e.y + dy) * 16 + 8 }; } return best; },
  freeBed(scene) { const m = scene.map, taken = new Set(scene.actors.filter((o) => o.st && o.st.inHospital && o.st.inHospital.bed != null).map((o) => o.st.inHospital.bed)); for (let i = 0; i < 8; i++) if (m.points['c_hospital_bed' + i] && !taken.has(i)) return i; return null; },
  // the stages after the stretcher reaches the car
  step(scene, j, dt) {
    const w = scene.world, pat = live[j.id], crew = E.crew(scene, j), v = j.v;
    j.t -= dt * 0;   // (E.update already counts j.t down)
    const finish = (leave) => { if (pat) { pat._stretcher = false; scene.actors = scene.actors.filter((a) => a !== pat); E.admit(w, pat); } delete live[j.id]; j.stage = 'done'; for (const m of crew) m.gone = true; scene.actors = scene.actors.filter((a) => !a.gone); if (v) { if (leave) P.leaveMap(scene, v); else v.gone = true; } };
    if (!v || v.gone || !pat) { finish(false); return; }
    switch (j.stage) {
      case 'doors': v.doors = Math.min(1, (v.doors || 0) + dt / 1); if (j.t <= 0) { j.stage = 'load'; j.t = 1.5; } break;
      case 'load': { const r = P.rear(v), k = 1 - Math.max(0, j.t) / 1.5; pat.x += (r.x + Math.cos(v.angle) * 16 - pat.x) * k * 0.2; pat.y += (r.y - pat.y) * k * 0.2; if (j.t <= 0) { scene.actors = scene.actors.filter((a) => a !== pat); pat.emsBoarded = true; j.stage = 'shut'; j.t = 1; } break; }
      case 'shut': v.doors = Math.max(0, (v.doors || 0) - dt); if (j.t <= 0) { j.stage = 'crew'; j.t = 2; for (const m of crew) L.sendTo(m, v.x + 6, v.y + 8); } break;
      case 'crew': if (j.t <= 0 || crew.every((m) => Math.hypot(m.x - v.x, m.y - v.y) < 24)) {
        for (const m of crew) m.gone = true; scene.actors = scene.actors.filter((a) => !a.gone); j.crewIn = true;
        const b = scene.map.building('c_hospital');
        v.sirenOn = true;
        if (b) { j.stage = 'to_hospital'; j.t = 240; P.send(scene, v, b.doorX * 16 + 8, (b.doorY + 2) * 16 + 8, () => { j.stage = 'unload'; j.t = 1.2; v.sirenOn = false; v.doors = 0; }); }
        else { j.stage = 'to_exit'; j.t = 240; const e = P.exitPoint(scene.map); if (e) P.send(scene, v, e.x, e.y, () => finish(false)); else finish(false); }
      } break;
      case 'to_hospital': case 'to_exit': if (j.t <= 0) finish(false); break;     // (a route that never finishes: the hospital still gets them)
      case 'unload': {
        v.doors = Math.min(1, (v.doors || 0) + dt);
        if (j.t <= 0) {
          const r = P.rear(v);
          for (let k = 0; k < 2; k++) { const m = L.spawn(scene, { name: 'Paramedic', look: PARA(), combat: 'flee', role: 'paramedic' }, r.x + (k ? 10 : -10), r.y + 4); m.emsJob = j.id; }
          pat.x = r.x; pat.y = r.y + 4; pat.emsBoarded = false; pat._stretcher = true; scene.actors.push(pat);
          const bed = P.freeBed(scene), pt = bed != null ? scene.map.points['c_hospital_bed' + bed] : scene.map.points.c_hospital_desk;
          j.bed = bed; j.to = pt ? { x: pt.x * 16 + 8, y: pt.y * 16 + 12 } : { x: pat.x, y: pat.y }; j.stage = 'wheel'; j.t = 60;
          for (const m of E.crew(scene, j)) L.sendTo(m, j.to.x + (E.crew(scene, j).indexOf(m) ? 10 : -10), j.to.y + 4);
        }
        break;
      }
      case 'wheel': {
        if (crew.length) { const mx = crew.reduce((n, m) => n + m.x, 0) / crew.length, my = crew.reduce((n, m) => n + m.y, 0) / crew.length; pat.x = mx; pat.y = my + 2; pat.kbx = pat.kby = 0; }
        if (crew.some((m) => Math.hypot(m.x - j.to.x, m.y - j.to.y) < 26) || j.t <= 0) {
          pat._stretcher = false; pat.x = j.to.x; pat.y = j.to.y;
          E.admit(w, pat); if (pat.st.inHospital && j.bed != null) pat.st.inHospital.bed = j.bed;
          delete live[j.id]; say(crew[0], ['One, two, three. There you go.', 'Nurse! Your patient.']);
          j.stage = 'back'; j.t = 20; for (const m of crew) L.sendTo(m, v.x, v.y + 8);
        }
        break;
      }
      case 'back': v.doors = Math.max(0, (v.doors || 0) - dt / 3); if (j.t <= 0 || crew.every((m) => Math.hypot(m.x - v.x, m.y - v.y) < 24)) { for (const m of crew) m.gone = true; scene.actors = scene.actors.filter((a) => !a.gone); j.stage = 'done'; P.leaveMap(scene, v); } break;
    }
  },
  leaveMap(scene, v) { const e = P.exitPoint(scene.map); if (e) P.send(scene, v, e.x, e.y, (c) => { c.gone = true; }); else v.lawLeave = 3; },
};
const say = (a, arr) => a && a.say && a.say(pick(arr), 2.5);
const PARA = () => ({ top: 'shirt', shirt: '#2a6a4a', bottom: 'pants', pants: '#1e3a2e', shoes: '#141416', hat: 'cap', hatColor: '#2a6a4a' });
const STAGES = new Set(['doors', 'load', 'shut', 'crew', 'to_hospital', 'to_exit', 'unload', 'wheel', 'back']);
const _up = E.update;
E.update = function (scene, dt) {
  const s = scene.world.ems, active = s ? s.jobs.filter((j) => STAGES.has(j.stage) && j.map === scene.map.id) : [];
  const r = _up.call(this, scene, dt);
  for (const j of active) if (j.stage !== 'done') try { P.step(scene, j, dt); } catch (e) { G.reportError && G.reportError(e); }
  P.drive(scene, dt);
  return r;
};
// away from the map: a run in the ambulance finishes in the hospital
const _hour = E.hourly;
E.hourly = function (w) {
  const s = w.ems, scene = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene);
  if (s) for (const j of s.jobs) if (STAGES.has(j.stage) && !(scene && j.map === scene.map.id)) { const st = j.npc && w.npcs[j.npc]; if (st && st.alive && !st.inHospital) E.admit(w, { id: j.npc, st, transient: false }); delete live[j.id]; j.stage = 'done'; }
  P.morgueHour(w);
  return _hour.apply(this, arguments);
};

// the ambulance itself: windows, doors, lights that turn
if (G.vehiclesHD) {
  const _get = G.vehiclesHD.get;
  G.vehiclesHD.get = function (model) {
    const c = _get.call(this, model);
    if (model === 'ambulance' && c && !c._amb2) {
      c._amb2 = true;
      const x = c.getContext('2d'), W = c.width, H = c.height, g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = g; x.fillRect(4, 2, W - 8, H - 4);
      x.fillStyle = '#26303c'; x.fillRect(W - 12, 5, 5, H - 10);                                  // windshield
      x.fillStyle = 'rgba(160,200,230,0.4)'; x.fillRect(W - 11, 6, 2, H - 14);
      x.fillStyle = '#c8ccd2'; x.fillRect(8, H / 2 - 7, 8, 14); x.fillStyle = '#8a9098'; x.fillRect(11, H / 2 - 7, 1, 14);   // roof vent and unit
      x.fillStyle = '#7a8088'; for (let i = 12; i < W - 26; i += 7) { x.fillRect(i, 2, 1, H - 4); }   // panel seams
    }
    return c;
  };
}
const VP = G.Vehicle ? G.Vehicle.prototype : null;
if (V && V.Vehicle) void 0;
const drawDoors = (ctx, v) => {
  if (v.model !== 'ambulance') return;
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
  if (v.doors > 0.02) { const a = v.doors * 1.9; for (const s of [-1, 1]) { ctx.save(); ctx.translate(-16, s * 7); ctx.rotate(s * a + Math.PI); ctx.fillStyle = '#e8e8e4'; ctx.fillRect(0, -1, 8, 2); ctx.restore(); } ctx.fillStyle = '#20262c'; ctx.fillRect(-17, -6, 3, 12); }
  if (v.sirenOn) { const on = Math.floor(G.loop.time * 7) % 2; ctx.fillStyle = on ? 'rgba(255,50,50,0.9)' : 'rgba(70,110,255,0.9)'; ctx.fillRect(3, on ? -7 : 4, 3, 3); ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(4, on ? -5 : 5, 12, 0, 6.3); ctx.fill(); }
  ctx.restore();
};
const _r = GS.renderScreenFx;
void _r;
if (VP && VP.draw) { const _d = VP.draw; VP.draw = function (ctx) { const r = _d.apply(this, arguments); drawDoors(ctx, this); return r; }; }

// ---------------------------------------------------------------- the Office of the Medical Examiner
const D = G.DECOR, A = G.assets;
const NEW = { furnace: [38, 34, { fw: 3, light: { r: 40, color: '255,120,40' } }], exam_table: [30, 14, { fw: 2 }], morgue_drawers: [32, 30, { fw: 2 }], steel_bench: [30, 16, { fw: 2 }], waste_bin: [12, 16, {}], vent: [20, 12, {}], warn_sign: [12, 12, {}] };
const paint = {
  furnace(x) { const g = x.createLinearGradient(0, 0, 38, 0); g.addColorStop(0, '#5a5e64'); g.addColorStop(0.5, '#8a8e94'); g.addColorStop(1, '#4a4e54'); x.fillStyle = g; x.fillRect(0, 0, 38, 34); x.fillStyle = '#34383e'; x.fillRect(7, 8, 24, 20); x.fillStyle = '#1a1c20'; x.fillRect(10, 11, 18, 14); x.fillStyle = '#6a6e74'; x.fillRect(16, 2, 6, 6); x.fillStyle = '#c84030'; x.fillRect(3, 11, 2, 2); x.fillStyle = '#40c060'; x.fillRect(3, 15, 2, 2); x.fillStyle = '#2a2c30'; x.fillRect(33, 10, 3, 12); for (let i = 0; i < 38; i += 6) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i, 0, 1, 34); } },
  exam_table(x) { x.fillStyle = '#b8c0c8'; x.fillRect(0, 2, 30, 7); x.fillStyle = '#e0e6ec'; x.fillRect(1, 3, 28, 2); x.fillStyle = '#6a7078'; x.fillRect(4, 9, 3, 5); x.fillRect(23, 9, 3, 5); },
  morgue_drawers(x) { x.fillStyle = '#a8b0b8'; x.fillRect(0, 0, 32, 30); x.fillStyle = '#c8d0d8'; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { x.fillRect(2 + c * 15, 2 + r * 9, 13, 8); x.fillStyle = '#5a6068'; x.fillRect(6 + c * 15, 5 + r * 9, 5, 1.5); x.fillStyle = '#c8d0d8'; } },
  steel_bench(x) { x.fillStyle = '#c0c8d0'; x.fillRect(0, 1, 30, 7); x.fillStyle = '#7a8088'; x.fillRect(0, 8, 30, 8); x.fillStyle = '#e8eef4'; x.fillRect(4, 2, 5, 3); x.fillStyle = '#4a6a8a'; x.fillRect(12, 2, 3, 4); x.fillStyle = '#d8d0c0'; x.fillRect(19, 3, 7, 3); },
  waste_bin(x) { x.fillStyle = '#d8b020'; x.fillRect(1, 3, 10, 13); x.fillStyle = '#b89010'; x.fillRect(0, 2, 12, 2); x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(6, 9, 2.4, 0, 6.3); x.fill(); },
  vent(x) { x.fillStyle = '#8a9098'; x.fillRect(0, 0, 20, 12); x.fillStyle = '#4a4e54'; for (let i = 2; i < 12; i += 2.5) x.fillRect(2, i, 16, 1); },
  warn_sign(x) { x.fillStyle = '#f0d020'; x.fillRect(0, 0, 12, 12); x.fillStyle = '#1a1a1a'; x.fillRect(5, 2, 2, 5); x.fillRect(5, 8, 2, 2); },
};
const art = () => { for (const k in NEW) { const [w, h] = NEW[k], c = document.createElement('canvas'); c.width = w; c.height = h; paint[k](c.getContext('2d')); A.sprites[k] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
for (const k in NEW) D[k] = Object.assign({ sprite: k, solid: true }, NEW[k][2]);
D.morgue_door = { sprite: 'security_door', solid: true, interact: 'morgue_door' };
const _init = A.init; A.init = function () { _init.call(this); art(); };
if (A.sprites && A.sprites.bush) art();
G.ITEMS.hospital_badge = { name: 'Hospital Staff Badge', type: 'misc', icon: 'key', value: 20, stack: 1, desc: 'Opens the Office of the Medical Examiner.' };
G.NPCS.c_examiner = { id: 'c_examiner', name: 'Medical Examiner', map: 'city', faction: 'civilians', hp: 40, combat: 'flee', gold: 80, home: 'c_hospital', relations: {}, job: 'I look after the ones nobody else can help any more.', inv: [['hospital_badge', 1]], look: G.look('c_examiner', { top: 'jacket', shirt: '#f0f0ec', bottom: 'pants', pants: '#3a3a44', glasses: 'round' }), schedule: [{ from: 0, to: 24, at: 'c_morgue_work', act: 'work' }] };
const _city = G.MAPGEN.city;
G.MAPGEN.city = () => {
  const m = _city(), b = m.building('c_hospital');
  if (!b) return m;
  // the staff door down to the Medical Examiner: wherever in the ward it blocks nobody's way
  const start = m.points.c_hospital_in, need = Object.keys(m.points).filter((k) => /^c_hospital/.test(k)).map((k) => m.points[k]).filter((p) => !Array.isArray(p));
  const reach = (bx, by) => { const seen = new Set([start.x + ',' + start.y]), q = [[start.x, start.y]]; while (q.length) { const [x, y] = q.pop(); for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + c, k = nx + ',' + ny; if (seen.has(k) || (nx === bx && ny === by) || m.isSolidTile(nx, ny) || nx < b.x || nx >= b.x + b.w || ny < b.y || ny > b.y + b.h) continue; seen.add(k); q.push([nx, ny]); } } return seen; };
  m.computeSolids();
  let spot = null;
  for (let y = b.y + 1; y < b.y + b.h - 1 && !spot; y++) for (let x = b.x + b.w - 2; x > b.x && !spot; x--) {
    if (m.isSolidTile(x, y) || m.decorsAt(x, y).length || (x === start.x && y === start.y) || need.some((p) => p.x === x && p.y === y)) continue;
    const r = reach(x, y), beside = [[0, 1], [0, -1], [-1, 0], [1, 0]].find(([a, c]) => r.has((x + a) + ',' + (y + c)));
    if (beside && need.every((p) => r.has(p.x + ',' + p.y) || m.isSolidTile(p.x, p.y))) spot = { x, y, ax: x + beside[0], ay: y + beside[1] };
  }
  if (spot) { m.addDecor('morgue_door', spot.x, spot.y); m.morgueDoor = spot; m.points.from_morgue = { x: spot.ax, y: spot.ay }; }
  m.computeSolids(); m.prerender && m.prerender();
  return m;
};
// the room itself, a floor below the ward
G.MAPGEN.morgue = () => {
  const m = new G.TileMap('morgue', 18, 12, G.T.wall_concrete), put = (t, x, y, e) => m.addDecor(t, x, y, e);
  m.meta = { name: 'Office of the Medical Examiner', region: 'city', music: 'city', darkness: 0, ownLight: 0.1, indoor: true, district: 'center' };
  m.fill(1, 1, 16, 10, G.T.tilefloor);
  put('furnace', 3, 3); put('morgue_drawers', 8, 2); put('morgue_drawers', 10, 2); put('morgue_drawers', 12, 2); put('vent', 14, 1); put('exam_table', 6, 6); put('exam_table', 10, 6); put('steel_bench', 14, 5); put('waste_bin', 2, 9); put('waste_bin', 15, 9); put('warn_sign', 7, 9);
  put('morgue_door', 9, 10, { back: true });
  m.points.c_morgue_work = { x: 8, y: 7 }; m.points.from_hospital = { x: 9, y: 9 };
  m.dangerZones = []; m.animalZones = [];
  m.finalize();
  return m;
};
Object.assign(G.NPCS.c_examiner, { map: 'morgue', home: null, schedule: [{ from: 0, to: 24, at: 'c_morgue_work', act: 'work' }] });
// the door
const _use = GS.useDecor, _label = GS.decorLabel;
GS.useDecor = function (d) {
  if (d.def.interact !== 'morgue_door') return _use.apply(this, arguments);
  if (d.back) { this.changeMap('city', 'from_morgue'); return; }
  if (!this.player.inventory.has('hospital_badge')) { this.toast('Staff only. The reader wants a badge.', 'bad'); return; }
  G.audio.play('select'); this.changeMap('morgue', 'from_hospital');
};
GS.decorLabel = function (d) { return d.def.interact === 'morgue_door' ? 'Medical Examiner: staff only' : _label.apply(this, arguments); };

// what happens to the body: on the game clock
const STEPS = { drawer: ['table', 8], table: ['furnace', 3], furnace: ['ash', 3] };
Object.assign(P, {
  list(w) { return (w.morgue = w.morgue || []); },
  admit(w, id) { const l = this.list(w), rec = w.dead[id]; if (!rec || rec.cremated || l.some((b) => b.id === id)) return; l.push({ id, stage: 'drawer', at: nowM(w) }); rec.inMorgue = true; },
  morgueHour(w) {
    for (const id in w.dead) if (w.dead[id].removed && !w.dead[id].inMorgue && !w.dead[id].cremated) this.admit(w, id);
    for (const b of this.list(w)) {
      const s = STEPS[b.stage]; if (!s || nowM(w) - b.at < s[1] * 60) continue;
      b.stage = s[0]; b.at = nowM(w);
      if (b.stage === 'ash') { const rec = w.dead[b.id]; if (rec) { rec.cremated = w.day; rec.inMorgue = false; } }
    }
    w.morgue = this.list(w).filter((b) => b.stage !== 'ash');
    const sc = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene), ex = sc && sc.actors.find((a) => a.id === 'c_examiner');
    if (ex && this.list(w).some((b) => b.stage === 'furnace')) ex.say(pick(['Door sealed. Bringing it up to temperature.', 'Eight hundred degrees. Log it.']), 3);
  },
});
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const r = _dd.call(this, ctx, o, s, scene), w = scene && scene.world, l = w && w.morgue;
  if (l && l.length) {
    if (o.type === 'exam_table' && l.some((b) => b.stage === 'table')) { ctx.fillStyle = '#d8dee6'; ctx.fillRect(o.x - 11, o.y - 13, 22, 5); ctx.fillStyle = '#e8ecf0'; ctx.beginPath(); ctx.ellipse(o.x - 9, o.y - 11, 3, 2.4, 0, 0, 6.3); ctx.fill(); }
    if (o.type === 'furnace' && l.some((b) => b.stage === 'furnace')) { const t = G.loop.time; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const h = 7 + Math.sin(t * 6 + i * 1.3) * 4; ctx.fillStyle = `rgba(255,${120 + i * 14},30,0.65)`; ctx.fillRect(o.x - 8 + i * 2.5, o.y - 10 - h, 2, h); } ctx.restore(); }
  }
  return r;
};
})();
