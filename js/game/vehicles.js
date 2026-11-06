'use strict';
// Cars, motorcycles and traffic.
//   Traffic:  cars and bikes drive the streets in their lane (on the right), turn at intersections, U-turn at
//             dead ends, leave the map at its edges, and brake (and honk) for people and other cars.
//             Fewer at night.
//   Driving:  any parked car or bike — with its key, or hotwired (a little wiring puzzle; skill and luck
//             help, wrong wires can set off the alarm). W/S gas and brake/reverse, A/D steer, [E] get out.
//             Crashes damage the car; hitting people hurts them (and is a crime); drunk driving wobbles.
//             You can drive to other maps. Your own car is parked at your house (you have the key).
//   Carjacking: walk up to a car stuck in traffic and pull the driver out.
(() => {
const A = G.assets, U = G.ui;
const DIRS = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
const MODELS = {
  car_red: { body: '#b83030', len: 28, wid: 14, max: 200, acc: 120, hp: 100, value: 400 }, car_blue: { body: '#3058a8', len: 28, wid: 14, max: 200, acc: 120, hp: 100, value: 400 },
  car_white: { body: '#e0dcd4', len: 28, wid: 14, max: 190, acc: 115, hp: 100, value: 350 }, car_black: { body: '#2a2a30', len: 28, wid: 14, max: 210, acc: 125, hp: 110, value: 500 },
  car_gray: { body: '#7a7e86', len: 28, wid: 14, max: 185, acc: 110, hp: 100, value: 300 },
  police_car: { body: '#22242a', cab: '#e8e4dc', siren: true, len: 28, wid: 14, max: 240, acc: 150, hp: 140, value: 900 },
  limo: { body: '#141418', len: 44, wid: 15, max: 170, acc: 90, hp: 160, value: 2000 },
  moto_red: { body: '#c02828', moto: true, len: 30, wid: 11, max: 240, acc: 170, hp: 50, value: 250 },
  moto_black: { body: '#1e1e22', moto: true, len: 30, wid: 11, max: 250, acc: 175, hp: 50, value: 300 },
  moto_blue: { body: '#2a4aa8', moto: true, len: 30, wid: 11, max: 235, acc: 165, hp: 50, value: 250 },
};

// ---------------------------------------------------------------- top-down art (parked cars use it too)
function art() {
  const shade = A.shade;
  for (const id in MODELS) {
    const m = MODELS[id], L = m.len + 2, W = m.wid + 2;
    const { c, x } = A.mk(L, W);
    const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
    if (m.moto) {
      const mid = Math.floor(W / 2), th = Math.max(4, W - 4);
      R(0, mid - 2, 5, 4, '#1a1a1e'); R(L - 5, mid - 2, 5, 4, '#1a1a1e');           // wheels
      R(4, mid - Math.floor(th / 2), L - 9, th, m.body); R(6, mid - Math.floor(th / 2) - 1, 7, th + 2, shade(m.body, 0.8));   // tank, seat
      R(L - 6, 0, 1, W, '#9aa0aa');                                                    // handlebar
      R(L - 2, mid - 1, 2, 2, '#f8f0c0');
    } else {
      R(1, 1, L - 2, W - 2, m.body);
      R(0, 2, 1, W - 4, shade(m.body, 0.7)); R(L - 1, 2, 1, W - 4, shade(m.body, 0.7));
      R(1, 0, L - 2, 1, shade(m.body, 0.75)); R(1, W - 1, L - 2, 1, shade(m.body, 0.75));
      const wsx = Math.round(L * 0.62);
      R(wsx, 2, 4, W - 4, '#5a7a98'); R(wsx, 3, 1, W - 6, '#a8c8e0');      // windshield
      R(Math.round(L * 0.18), 2, 3, W - 4, '#4a6a88');                       // rear window
      R(Math.round(L * 0.18) + 3, 2, wsx - Math.round(L * 0.18) - 3, W - 4, m.cab || shade(m.body, 1.12));   // roof
      if (id === 'limo') R(Math.round(L * 0.3), 2, 10, W - 4, '#2a2a30');
      R(L - 2, 1, 2, 2, '#f8f0c0'); R(L - 2, W - 3, 2, 2, '#f8f0c0');       // headlights
      R(0, 1, 1, 2, '#d03030'); R(0, W - 3, 1, 2, '#d03030');               // tail lights
      if (m.siren) { R(Math.round(L * 0.45), 2, 2, Math.floor((W - 4) / 2), '#d02828'); R(Math.round(L * 0.45), 2 + Math.floor((W - 4) / 2), 2, Math.ceil((W - 4) / 2), '#2850d0'); }
    }
    A.outline(c);
    A.sprites['veh_' + id] = { img: c, ax: Math.floor(L / 2), ay: W - 1, w: L, h: W };
    // the parked decor version (anchored at the bottom of its tile)
    if (A.sprites[id] || m.moto) A.sprites[id] = { img: c, ax: Math.floor(L / 2), ay: W - 1, w: L, h: W };
  }
  // a wreck stays a wreck
  const w = A.sprites.veh_car_gray;
  if (w && A.sprites.car_wreck) {
    const { c, x } = A.mk(w.w, w.h); x.drawImage(w.img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(70,50,30,0.55)'; x.fillRect(0, 0, w.w, w.h); x.fillStyle = '#2a2a30'; x.fillRect(8, 3, 10, 8);
    A.sprites.car_wreck = { img: c, ax: w.ax, ay: w.ay, w: w.w, h: w.h };
  }
}
const _init = A.init;
A.init = function () { _init.call(this); art(); };
for (const id of ['moto_red', 'moto_black', 'moto_blue']) G.DECOR[id] = { sprite: id, solid: true, interact: 'car', breakHp: 40 };

// ---------------------------------------------------------------- roads (lanes for traffic)
const D = G.DISTRICTS, _roads = D.roads;
D.roads = function (m, list) { m.roads = (m.roads || []).concat(list.map((r) => Object.assign({ W: 4 }, r))); return _roads.call(this, m, list); };
const _rural = G.MAPGEN.rural;
G.MAPGEN.rural = () => { const m = _rural(); m.roads = [{ h: true, at: 60, from: 0, to: 159, W: 3 }]; return m; };
const laneOf = (r, dir) => (r.h ? (r.at + r.W * (dir === 'E' ? 0.75 : 0.25)) * 16 : (r.at + r.W * (dir === 'S' ? 0.25 : 0.75)) * 16);
function boxes(map) {
  if (map.roadBoxes) return map.roadBoxes;
  const out = [], rs = map.roads || [];
  for (const h of rs.filter((r) => r.h)) for (const v of rs.filter((r) => !r.h)) {
    if (v.at + v.W <= h.from || v.at > h.to || h.at + h.W <= v.from || h.at > v.to) continue;
    out.push({ x0: v.at * 16, x1: (v.at + v.W) * 16, y0: h.at * 16, y1: (h.at + h.W) * 16, h, v });
  }
  return (map.roadBoxes = out);
}

// ---------------------------------------------------------------- the vehicle
class Vehicle {
  constructor(o) {
    Object.assign(this, { kind: 'vehicle', dead: false, angle: 0, speed: 0, steer: 0, ai: null, rec: null, hurtT: 0 }, o);
    this.m = MODELS[this.model] || MODELS.car_gray;
    this.hp = this.hp != null ? this.hp : this.m.hp;
    if (this.burnt) { this.exploded = true; this.wrecked = true; this.hp = 0; this.speed = 0; }   // (what burnt stays burnt, across maps and saves: js/game/explosions.js)
    if (this.fallen && this.fallT == null) this.fallT = 1;
  }
  distTo(o) { return Math.hypot(o.x - this.x, o.y - this.y); }
  get L() { return this.m.len / 2; }
  get Wd() { return this.m.wid / 2; }
  // body points (front corners, rear corners, nose) at a position/angle
  points(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a), L = this.L, W = this.Wd;
    return [[L, W], [L, -W], [-L, W], [-L, -W], [L + 1, 0], [0, W], [0, -W]].map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  blocked(map, x, y, a) {
    for (const [px, py] of this.points(x, y, a)) {
      const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
      if (map.isSolidTile(tx, ty) || map.get(tx, ty) === G.T.door) return true;
    }
    return false;
  }
  // is a point (an actor's feet) inside the body, with some margin?
  covers(px, py, margin = 3) {
    const c = Math.cos(-this.angle), s = Math.sin(-this.angle), dx = px - this.x, dy = py - this.y;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) < this.L + margin && Math.abs(ly) < this.Wd + margin ? { lx, ly } : null;
  }
  damage(n, scene) {
    this.hp -= n; this.hurtT = 0.2;
    if (this.hp <= 0 && !this.wrecked) {
      this.wrecked = true; this.speed = 0;
      scene.toast(this.driver === 'player' ? 'The engine dies. This car is done.' : 'A car is wrecked.', 'bad');
      if (this.driver === 'player') G.vehicles.exit(scene, true);
    }
  }
}
G.Vehicle = Vehicle;
G.roadTools = { boxes, laneOf, DIRS };

// ---------------------------------------------------------------- manager
G.vehicles = {
  MODELS,
  records(w) { return (w.vehicles = w.vehicles || []); },
  // the player's own car, at home
  ensureStarter(scene) {
    const w = scene.world;
    const map = G.maps.get('rural'), b = map.building(w.flags.player_home);
    // (saves from before: the car was left across the front door)
    if (w.vehicles && !w.flags.carOffDoor) { w.flags.carOffDoor = true; const c = w.vehicles.find((v) => v.id === 'v_player'); if (c && b && c.map === 'rural' && this.blocksDoor(c, b)) { const s = this.driveway(map, b); if (s) { c.x = s.x; c.y = s.y; c.angle = 0; } } }
    if (w.vehicles) return;
    w.vehicles = []; w.flags.carOffDoor = true;
    if (!b) return;
    const s = this.driveway(map, b);
    if (s) w.vehicles.push({ id: 'v_player', model: 'car_gray', map: 'rural', x: s.x, y: s.y, angle: 0, hp: 100, keys: true, owner: 'player' });
  },
  blocksDoor(c, b) { const dx = c.x - (b.doorX + 1) * 16, dy = c.y - (b.doorY + 1) * 16; return Math.abs(dx) < 70 && dy > -8 && dy < 72; },
  // beside the front path, never across it: the way out of the door stays open
  driveway(map, b) {
    for (let r = 3; r < 12; r++) for (const dx of [-7, 8, -8, 9, -9, 10, -10, 11, -11, 12, -12, 14, -14]) {
      const tx = b.doorX + dx, ty = b.doorY + r, x = tx * 16 + 8, y = ty * 16 + 8, cols = [-3, -2, -1, 0, 1, 2, 3];
      if (this.blocksDoor({ x, y }, b) || cols.some((k) => [-2, -1, 0, 1, 2].some((j) => map.isSolidTile(tx + k, ty + j) || map.get(tx + k, ty + j) === G.T.water || map.get(tx + k, ty + j) === G.T.dirt))) continue;
      return { x, y };
    }
    return null;
  },
  spawnFor(scene) {
    const w = scene.world, map = scene.map;
    scene.vehicles = [];
    for (const rec of this.records(w)) if (rec.map === map.id) scene.vehicles.push(new Vehicle(Object.assign({}, rec, { rec })));
    // traffic
    if (map.roads && map.roads.length && !map.meta.floorOf) {
      const h = w.hourF, night = h >= 23 || h < 6;
      const n = Math.min(G.gfxLevel().traffic, Math.round(map.roads.length * (night ? 0.5 : 1.6)));
      for (let i = 0; i < n; i++) this.spawnTraffic(scene, false);
    }
  },
  spawnTraffic(scene, edge) {
    if (!scene.map || !scene.map.roads || !scene.map.roads.length) return null;   // (no roads here: nothing drives)
    const map = scene.map, p = scene.player, rs = map.roads;
    for (let tries = 0; tries < 30; tries++) {
      const r = G.rng.pick(rs), dir = r.h ? G.rng.pick(['E', 'W']) : G.rng.pick(['N', 'S']);
      let along;
      if (edge) along = (dir === 'E' || dir === 'S') ? r.from * 16 + 12 : (r.to + 1) * 16 - 12;
      else along = G.rng.range(r.from * 16 + 24, (r.to + 1) * 16 - 24);
      const x = r.h ? along : laneOf(r, dir), y = r.h ? laneOf(r, dir) : along;
      if (Math.hypot(x - p.x, y - p.y) < 140) continue;
      if (scene.actors.some((a) => !a.dead && a.kind !== 'player' && Math.hypot(a.x - x, a.y - y) < 40)) continue;   // never on top of somebody
      if (scene.vehicles.some((v) => Math.hypot(v.x - x, v.y - y) < 44)) continue;
      if (boxes(map).some((b) => x > b.x0 - 8 && x < b.x1 + 8 && y > b.y0 - 8 && y < b.y1 + 8)) continue;
      const model = G.rng.chance(0.15) ? G.rng.pick(/industrial|neon/.test(map.meta.district || '') && MODELS.moto_chopper ? ['moto_chopper', 'moto_chopper', 'moto_black'] : ['moto_red', 'moto_black', 'moto_blue']) : G.rng.chance(0.06) && map.meta.district === 'center' ? 'police_car' : G.rng.pick(['car_red', 'car_blue', 'car_white', 'car_black', 'car_gray']);
      const v = new Vehicle({ model, x, y, angle: Math.atan2(DIRS[dir][1], DIRS[dir][0]) });
      v.ai = { road: r, dir, lane: r.h ? y : x, turn: null, box: null, cruise: G.rng.range(60, 95), waitT: 0, dest: G.vehicles.pickDest(map) };
      scene.vehicles.push(v);
      return v;
    }
    return null;
  },

  // ---- AI driving ----
  updateAI(v, dt, scene) {
    const ai = v.ai, map = scene.map, [dx, dy] = DIRS[ai.dir];
    // anything in front of us?
    const ax = v.x + dx * (v.L + 10), ay = v.y + dy * (v.L + 10);
    let blocked = null;
    for (const o of scene.vehicles) {
      if (o === v || o.wrecked && false) continue;
      const ox = o.x - v.x, oy = o.y - v.y, d = Math.hypot(ox, oy);
      if (d < v.L + o.L + 14 && (ox * dx + oy * dy) / (d || 1) > 0.7) { blocked = o; break; }
    }
    if (!blocked) for (const a of scene.actors) {
      if (a.dead || (a.kind !== 'npc' && a.kind !== 'player' && a.kind !== 'animal')) continue;
      if (a.kind === 'player' && a.vehicle) continue;
      // look further ahead the faster you go, across the width of the lane
      const rx = a.x - v.x, ry = a.y - v.y, ahead = rx * dx + ry * dy, side = Math.abs(rx * -dy + ry * dx);
      if (Math.hypot(a.x - ax, a.y - ay) < 14 || v.covers(a.x, a.y, 6) || (ahead > 0 && ahead < v.L + 12 + v.speed * 0.45 && side < v.Wd + 7)) {
        // a person in front: the driver needs a moment to react (longer if distracted; people already in the road are seen sooner)
        if (ai.react == null) ai.react = a.kind === 'player' ? (Math.random() < 0.12 ? 0.9 : 0.28) : Math.random() < 0.04 ? 0.5 : 0.08;
        ai.react -= dt;
        if (ai.react <= 0 || v.speed < 20) { blocked = a; break; }
        ai.sawPerson = true;
      }
    }
    if (!blocked && !ai.sawPerson) ai.react = null;
    ai.sawPerson = false;
    // a person or an animal in the road is never driven through: the car waits, honks, and they step aside
    const living = blocked && (blocked.kind === 'npc' || blocked.kind === 'animal');
    if (living && blocked.kind === 'npc' && ai.waitT > 1.5 && !blocked.dodge) { const s = (blocked.x - v.x) * -dy + (blocked.y - v.y) * dx >= 0 ? 1 : -1; blocked.dodge = { x: -dy * s, y: dx * s }; blocked.dodgeT = 0.9; if (!ai.honked) { ai.honked = true; G.audio.play('honk', { x: v.x, y: v.y }); } }
    if (blocked && (ai.waitT < 5 || living)) {
      v.speed = Math.max(0, v.speed - 300 * dt);
      ai.waitT += dt;
      if (blocked.kind === 'player' && ai.waitT > 1.5 && !ai.honked) { ai.honked = true; G.audio.play('honk', { x: v.x, y: v.y }); }
    } else { ai.waitT = Math.max(0, ai.waitT - dt); ai.honked = false; v.speed = Math.min(ai.cruise, v.speed + 90 * dt); }
    v.x += dx * v.speed * dt; v.y += dy * v.speed * dt;
    if (ai.road.h) v.y = ai.lane; else v.x = ai.lane;
    // a pending turn: once we reach the new lane, take it
    if (ai.turn) {
      const t = ai.turn, along = ai.road.h ? v.x : v.y;
      if ((ai.dir === 'E' || ai.dir === 'S') ? along >= t.at : along <= t.at) {
        if (ai.road.h) v.x = t.at; else v.y = t.at;
        ai.dir = t.dir; ai.road = t.road; ai.lane = t.lane; ai.turn = null;
        v.angle = Math.atan2(DIRS[ai.dir][1], DIRS[ai.dir][0]);
      }
      return;
    }
    // intersections: go straight, turn left or right
    const box = boxes(map).find((b) => v.x > b.x0 && v.x < b.x1 && v.y > b.y0 && v.y < b.y1);
    if (box && box !== ai.box) {
      ai.box = box;
      const opts = [];
      const along = ai.road.h ? 'x' : 'y';
      const cur = ai.road;
      if (cur.h) {
        if (ai.dir === 'E' ? (cur.to + 1) * 16 > box.x1 + 24 : cur.from * 16 < box.x0 - 24) opts.push(null, null);
        const v2 = box.v;
        if ((v2.to + 1) * 16 > box.y1 + 24) opts.push({ dir: 'S', road: v2 });
        if (v2.from * 16 < box.y0 - 24) opts.push({ dir: 'N', road: v2 });
      } else {
        if (ai.dir === 'S' ? (cur.to + 1) * 16 > box.y1 + 24 : cur.from * 16 < box.y0 - 24) opts.push(null, null);
        const h2 = box.h;
        if ((h2.to + 1) * 16 > box.x1 + 24) opts.push({ dir: 'E', road: h2 });
        if (h2.from * 16 < box.x0 - 24) opts.push({ dir: 'W', road: h2 });
      }
      void along;
      // avoid streets that dead-end (at the harbor, a wall) when there is anywhere else to go
      const dead = (o) => { const r = o ? o.road : cur, d = o ? o.dir : ai.dir, fwd = d === 'E' || d === 'S'; return !G.vehicles.roadExit(map, r, fwd); };
      if (opts.some((o) => !dead(o))) for (let i = opts.length - 1; i >= 0; i--) if (dead(opts[i])) opts.splice(i, 1);
      const pick = opts.length ? G.vehicles.route(map, v, box, opts) : null;
      if (pick) { const lane = laneOf(pick.road, pick.dir); ai.turn = { dir: pick.dir, road: pick.road, lane, at: lane }; }
    }
    // end of the road: leave the map at its edge, or turn around
    // (a dead end turns around a car length early, so nobody noses into the harbor)
    const along = ai.road.h ? v.x : v.y, endPad = v.L + 10;
    const lo = ai.road.from * 16 + (G.vehicles.roadExit(map, ai.road, false) ? 6 : endPad), hi = (ai.road.to + 1) * 16 - (G.vehicles.roadExit(map, ai.road, true) ? 6 : endPad);
    if (along > hi || along < lo) {
      const edge = G.vehicles.roadExit(map, ai.road, along > hi);   // a real way out of the map (not the harbor, not a wall)
      if (edge) { v.gone = true; return; }
      ai.dir = { E: 'W', W: 'E', N: 'S', S: 'N' }[ai.dir]; ai.lane = laneOf(ai.road, ai.dir);
      if (ai.road.h) { v.y = ai.lane; v.x = G.util.clamp(v.x, lo, hi); } else { v.x = ai.lane; v.y = G.util.clamp(v.y, lo, hi); }
      v.angle = Math.atan2(DIRS[ai.dir][1], DIRS[ai.dir][0]);
    }
  },

  // ---- the player driving ----
  drive(p, v, dt, scene) {
    const I = G.input, m = v.m, map = scene.map;
    const pd = G.pad && G.pad.drive(), gas = pd && pd.gas > 0.05 ? pd.gas : I.isDown('up') ? 1 : 0, brake = pd && pd.brake > 0.05 ? pd.brake : I.isDown('down') ? 1 : 0;
    let steer = pd && pd.steer ? pd.steer : (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
    const lv = G.effects.intoxLevel(p);
    if (lv && lv.stumble) steer += Math.sin(scene.time * 2.1) * 0.6;   // drunk driving
    if (v.wrecked) { v.speed *= 0.9; }
    else if (gas) v.speed = Math.min(m.max, v.speed + m.acc * dt);
    else if (brake) v.speed = v.speed > 0 ? Math.max(0, v.speed - 260 * dt) : Math.max(-60, v.speed - 70 * dt);
    else v.speed *= Math.pow(0.45, dt);
    if (Math.abs(v.speed) < 2 && !gas && !brake) v.speed = 0;
    const grip = G.util.clamp(Math.abs(v.speed) / 70, 0, 1);
    v.angle += steer * (m.moto ? 3.4 : 2.6) * dt * grip * Math.sign(v.speed || 1);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt, ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!v.blocked(map, nx, ny, v.angle)) { v.x = nx; v.y = ny; }
    else {
      if (Math.abs(v.speed) > 60) { G.audio.play('crash'); G.renderer.shake(Math.min(8, Math.abs(v.speed) / 25)); v.damage(Math.round(Math.abs(v.speed) / 12), scene); if (Math.abs(v.speed) > 140) G.combat.damage(p, Math.round(Math.abs(v.speed) / 30), null, scene); }
      v.speed *= -0.25;
      if (v.blocked(map, v.x, v.y, v.angle)) v.angle -= steer * 0.05;
    }
    // running people over
    for (const a of scene.actors) {
      if (a === p || a.dead || a.crash || (a.kind !== 'npc' && a.kind !== 'animal')) continue;   // (someone thrown off a bike is in the air, not under the wheels)
      if (!v.covers(a.x, a.y, 2)) continue;
      const sp = Math.abs(v.speed);
      if (sp > 35 && !(a.invuln > 0)) {
        G.audio.play('hit');
        G.combat.damage(a, Math.round(sp * (m.moto ? 0.1 : 0.16)), p, scene);
        if (a.kind === 'npc' && !a.dead) { scene.reportCrime('assault', a); a.st.fear = 100; if (a.def.combat === 'flee') a.startFlee(p); }
        v.speed *= 0.6;
      }
      const away = Math.atan2(a.y - v.y, a.x - v.x);
      a.x += Math.cos(away) * 3; a.y += Math.sin(away) * 3;
    }
    // other cars
    for (const o of scene.vehicles) {
      if (o === v || o.fallen || Math.hypot(o.x - v.x, o.y - v.y) > v.L + o.L) continue;   // (a bike lying in the road is driven over: js/game/crashes.js)
      if (!o.covers(v.x + Math.cos(v.angle) * v.L, v.y + Math.sin(v.angle) * v.L, 2)) continue;
      if (Math.abs(v.speed) > 40) { G.audio.play('crash'); v.damage(Math.round(Math.abs(v.speed) / 14), scene); o.damage(Math.round(Math.abs(v.speed) / 14), scene); G.renderer.shake(4); }
      v.speed *= -0.3; if (o.ai) { o.speed = 0; o.ai.waitT = 0; if (G.rng.chance(0.5)) G.audio.play('honk'); }
      v.x -= Math.cos(v.angle) * 3; v.y -= Math.sin(v.angle) * 3;
    }
    p.x = v.x; p.y = v.y; p.moving = Math.abs(v.speed) > 1;
    p.dir = Math.abs(Math.cos(v.angle)) > Math.abs(Math.sin(v.angle)) ? (Math.cos(v.angle) > 0 ? 2 : 1) : (Math.sin(v.angle) > 0 ? 0 : 3);
    if (I.wasPressed('interact') && Math.abs(v.speed) < 40) this.exit(scene);
    if (I.wasPressed('attack') && !m.moto) G.audio.play('honk');
  },
  enter(scene, v) {
    const p = scene.player;
    v.driver = 'player'; v.ai = null; v.speed = 0;
    p.vehicle = v; p.sitting = null;
    if (p.dragging) G.bodies.toggle(scene);
    G.audio.play('engine');
    if (!v.rec) {   // a car from traffic or a decor car becomes a parked record
      v.id = v.id || 'v' + Date.now().toString(36) + G.rng.int(0, 999);
      v.rec = { id: v.id, model: v.model, map: scene.map.id, x: v.x, y: v.y, angle: v.angle, hp: v.hp, keys: !!v.keys, hotwired: !!v.hotwired, owner: v.owner || null, stolen: !!v.stolen };
      this.records(scene.world).push(v.rec);
    }
  },
  exit(scene, forced) {
    const p = scene.player, v = p.vehicle;
    if (!v) return;
    p.vehicle = null; v.driver = null; v.speed = 0;
    Object.assign(v.rec, { map: scene.map.id, x: v.x, y: v.y, angle: v.angle, hp: v.hp, hotwired: v.hotwired, wrecked: v.wrecked });
    // step out on the driver's side (or anywhere free)
    const c = Math.cos(v.angle), s = Math.sin(v.angle);
    for (const [lx, ly] of [[0, -(v.Wd + 9)], [0, v.Wd + 9], [-(v.L + 9), 0], [v.L + 9, 0]]) {
      const x = v.x + lx * c - ly * s, y = v.y + lx * s + ly * c;
      if (!scene.map.rectCollides(x - p.w / 2, y - p.h, p.w, p.h)) { p.x = x; p.y = y; break; }
    }
    if (!forced) G.audio.play('door');
  },
  nearest(scene, range = 26) {
    const p = scene.player;
    let best = null, bd = range;
    for (const v of scene.vehicles || []) { const d = Math.hypot(v.x - p.x, v.y - p.y) - v.L * 0.6; if (d < bd) { bd = d; best = v; } }
    return best;
  },
  // [E] at a vehicle: drive it, hotwire it, carjack it, or search it
  menu(scene, v, decor) {
    const p = scene.player, w = scene.world, opts = [];
    const canDrive = v.keys || v.hotwired || v.owner === 'player';
    if (v.wrecked) { scene.toast('It is totaled.'); return; }
    if (v.ai) {
      opts.push({ label: 'Pull the driver out (carjack)', fn: () => this.carjack(scene, v) });
    } else if (canDrive) opts.push({ label: v.m.moto ? 'Ride' : 'Drive', fn: () => this.take(scene, v, decor) });
    else opts.push({ label: 'Hotwire it', fn: () => G.scenes.push(new G.HotwireScene(scene, v, () => { v.hotwired = true; v.stolen = v.owner !== 'player'; if (v.stolen) scene.reportCrime('theft', null, v.m.value, v.owner && w.isAlive(v.owner) ? v.owner : null); this.take(scene, v, decor); })) });
    if (decor && !v.ai) opts.push({ label: 'Break in and search the glovebox', fn: () => { scene._gloveOnly = true; G.usables.use(decor, scene); } });
    opts.push({ label: 'Leave it', fn: () => {} });
    G.scenes.push(new G.ChoiceScene(v.owner === 'player' ? 'Your car' : MODELS[v.model].moto ? 'Motorcycle' : 'Car', canDrive ? 'You have the keys.' : v.ai ? 'Someone is behind the wheel.' : 'Locked, no keys.', opts));
  },
  // a parked decor car becomes a real vehicle when you take it
  take(scene, v, decor) {
    if (decor) {
      G.mods.removeDecor(scene.map, decor);
      v.x = decor.x; v.y = decor.ty * 16 + 8; v.angle = 0;
      scene.vehicles.push(v);
    }
    this.enter(scene, v);
  },
  carjack(scene, v) {
    const w = scene.world;
    v.ai = null; v.speed = 0; v.hotwired = true; v.stolen = true;
    // the driver ends up on the street next to the car: furious or terrified
    const seed = G.util.uid('drv'), look = G.look('driver' + seed), angry = Math.random() < 0.3;
    const def = { id: 'driver_' + seed, name: 'Driver', map: scene.map.id, faction: 'civilians', hp: 30, combat: angry ? 'fight' : 'flee', look, transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: Math.floor(v.x / 16), y: Math.floor(v.y / 16) }, act: 'idle' }] };
    const st = { alive: true, name: 'Driver', map: scene.map.id, hp: 30, fear: angry ? 0 : 100, inv: [], gold: G.rng.int(5, 60), realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
    const driver = new G.NPC(def.id, st, def);
    const c = Math.cos(v.angle), s = Math.sin(v.angle), side = v.Wd + 10;
    const spot = (G.everyday && G.everyday.freeSpot(scene.map, v.x + s * side, v.y - c * side + 6, 10, 6)) || { x: v.x + s * side, y: v.y - c * side + 6 };
    driver.x = spot.x; driver.y = spot.y;
    scene.actors.push(driver);
    scene.toast('You yank the driver out of the seat!', 'warn');
    scene.reportCrime('assault', driver, v.m.value);
    if (angry) { driver.say('Get out of my car!', 3); driver.aggressor = true; driver.startFight(scene.player, scene); }
    else { driver.say(G.rng.pick(['Take it! Take it! Just do not hurt me!', 'HELP! CARJACKER!']), 3); driver.startFlee(scene.player); }
    void w;
    this.enter(scene, v);
  },
  fromDecor(scene, d) {
    const model = MODELS[d.type] ? d.type : 'car_gray';
    const owner = G.usables.owner(scene, d);
    return new Vehicle({ model, x: d.x, y: d.ty * 16, angle: 0, owner: owner && owner !== 'player' ? owner : null, keys: owner === 'player', decor: d });
  },
};

// ---------------------------------------------------------------- hotwiring
// Pull the panel off and touch the right two wires together. Wrong pairs spark (and may set off the alarm).
// Each rank of Hotwiring shows you one wire that is definitely not it; luck sometimes shows another.
class HotwireScene {
  constructor(game, v, onStart) {
    this.transparent = true; this.game = game; this.v = v; this.onStart = onStart;
    const cols = ['#d83a3a', '#3a6ad8', '#e8c040', '#3aa84a', '#f0f0f0', '#1a1a1e'];
    const n = v.model === 'police_car' ? 6 : 5;
    this.wires = cols.slice(0, n).map((c, i) => ({ c, i, dud: false }));
    const a = G.rng.int(0, n - 1); let b = G.rng.int(0, n - 2); if (b >= a) b++;
    this.pair = [a, b].sort();
    const p = game.player, hint = G.skills.rank(p, 'hotwire') + (Math.random() < (G.skills.stat(p, 'luck') || 0) * 0.15 ? 1 : 0);
    const others = this.wires.filter((w) => !this.pair.includes(w.i));
    for (let k = 0; k < hint && others.length; k++) others.splice(G.rng.int(0, others.length - 1), 1)[0].dud = true;
    this.tries = 3 + G.skills.rank(p, 'hotwire');
    this.sel = 0; this.first = null; this.msg = 'Touch two wires together.';
  }
  choose(i) {
    const w = this.wires[i];
    if (w.dud) { this.msg = 'That one goes to the radio. Useless.'; return; }
    if (this.first == null) { this.first = i; this.msg = 'And which one with it?'; return; }
    if (this.first === i) { this.first = null; return; }
    const pair = [this.first, i].sort();
    this.first = null;
    if (pair[0] === this.pair[0] && pair[1] === this.pair[1]) { G.scenes.remove(this); G.events.emit('xp', 15, 'Hotwiring'); this.onStart(); return; }
    this.tries--; G.audio.play('click');
    const p = this.game.player;
    if (Math.random() < Math.max(0.08, 0.3 - G.skills.rank(p, 'hotwire') * 0.1)) {
      G.audio.play('alarm');
      this.msg = 'BZZT. The alarm goes off!';
      for (const a of this.game.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 170) { a.sleeping = false; if (a.def.combat === 'flee') a.startFlee(p); }
      this.game.reportCrime('theft', null, 50, this.v.owner && this.game.world.isAlive(this.v.owner) ? this.v.owner : null);
    } else this.msg = 'Sparks. Nothing. ' + this.tries + ' tries before someone notices.';
    if (this.tries <= 0) { G.scenes.remove(this); this.game.toast('You give up on the wiring.', 'bad'); }
  }
  update() {
    const I = G.input;
    if (I.wasPressed('left')) this.sel = (this.sel + this.wires.length - 1) % this.wires.length;
    if (I.wasPressed('right')) this.sel = (this.sel + 1) % this.wires.length;
    if (I.wasPressed('interact') || I.wasPressed('confirm')) this.choose(this.sel);
    if (I.wasPressed('cancel')) G.scenes.remove(this);
  }
  render(ctx) {
    const R = G.renderer;
    U.dim(ctx, 0.5);
    const W = 280, H = 140, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Hotwiring', titleSize: 12 });
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(x + 20, y + 28, W - 40, 60);
    const step = (W - 60) / (this.wires.length - 1);
    this.wires.forEach((wr, i) => {
      const wx = x + 30 + i * step;
      ctx.fillStyle = wr.dud ? '#5a5a62' : wr.c; ctx.fillRect(wx - 2, y + 30, 4, 50);
      ctx.fillStyle = '#c8a050'; ctx.fillRect(wx - 2, y + 78, 4, 4);
      if (i === this.first) { ctx.strokeStyle = '#ffe080'; ctx.strokeRect(wx - 5, y + 28, 10, 56); }
      if (i === this.sel) { ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 3, y + 90, 6, 3); }
      const hov = U.inRect(G.input.mouse.ux, G.input.mouse.uy, wx - 8, y + 28, 16, 60);
      if (hov && G.input.mouse.moved) this.sel = i;
      if (hov && G.input.mouse.pressed) this.choose(i);
    });
    U.text(ctx, this.msg, R.uiW / 2, y + 100, { align: 'center', size: 9 });
  }
}
G.HotwireScene = HotwireScene;

// ---------------------------------------------------------------- hooks
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'car' && MODELS[d.type]) { G.vehicles.menu(scene, G.vehicles.fromDecor(scene, d), d); return; }
  return _use.call(this, d, scene);
};
const _label = G.usables.label;
G.usables.label = function (d, scene) { return d.def.interact === 'car' && MODELS[d.type] ? (MODELS[d.type].moto ? 'Motorcycle' : 'Car') : _label.call(this, d, scene); };

const PL = G.Player.prototype, _pu = PL.update, _pd = PL.draw;
PL.update = function (dt, scene) {
  if (!this.vehicle) return _pu.call(this, dt, scene);
  if (this.dead) { G.vehicles.exit(scene, true); return; }
  this.invuln = Math.max(0, (this.invuln || 0) - dt);
  G.effects.update(this, dt, scene);
  G.needs.updatePlayer(this, dt, scene);
  G.vehicles.drive(this, this.vehicle, dt, scene);
};
PL.draw = function (ctx) { if (this.vehicle) return; return _pd.call(this, ctx); };

const GS = G.GameScene.prototype, _load = GS.loadMap, _upd = GS.update, _render = GS.render, _find = GS.findInteraction, _interact = GS.interact;
GS.loadMap = function (id, spawnName, pos) {
  const p = this.player, v = p && p.vehicle;
  if (v && id === 'jail') G.vehicles.exit(this, true);
  _load.call(this, id, spawnName, pos);
  G.vehicles.ensureStarter(this);
  if (p.vehicle && G.MAPGEN[id] && !/_f\d+$/.test(id)) {   // drove across: the car comes too
    const car = p.vehicle;
    car.rec.map = id; car.x = p.x; car.y = p.y;
    G.vehicles.spawnFor(this);
    this.vehicles = this.vehicles.filter((o) => o.rec !== car.rec);
    this.vehicles.push(car);
  } else {
    if (p.vehicle) G.vehicles.exit(this, true);
    G.vehicles.spawnFor(this);
  }
};
GS.update = function (dt) {
  const r = _upd.call(this, dt);
  if (!this.vehicles) return r;
  for (const v of this.vehicles) {
    if (v.hurtT > 0) v.hurtT -= dt;
    if (v.ai) G.vehicles.updateAI(v, dt, this);
    else if (v.driver !== 'player') {   // parked: people walk around it, not through it
      for (const a of this.actors) {
        if (a.dead || a === this.player || !a.w) continue;   // (the player: js/game/drivers.js)
        G.vehicles.easeOut(v, a, dt);
      }
    }
    // traffic hits pedestrians who step out in front of it
    if (v.ai && v.speed > 40) for (const a of this.actors) {
      if (a.dead || a.invuln > 0 || (a === this.player && this.player.vehicle)) continue;
      if (v.covers(a.x, a.y, 0)) { G.combat.damage(a, Math.round(v.speed * (v.m.bike ? 0.08 : 0.25)), null, this); if (a.kind !== 'player') { a.kbx = Math.cos(v.angle) * v.speed * 2; a.kby = Math.sin(v.angle) * v.speed * 2; } v.speed = 0; G.audio.play('honk', { x: v.x, y: v.y }); }
    }
  }
  const before = this.vehicles.length;
  this.vehicles = this.vehicles.filter((v) => !v.gone);
  for (let i = this.vehicles.length; i < before; i++) G.vehicles.spawnTraffic(this, true);
  return r;
};
GS.render = function (ctx) {
  // vehicles are y-sorted with everything else: slip them into the actor list just for drawing
  const n = this.actors.length;
  if (this.vehicles) this.actors.push(...this.vehicles);
  try { _render.call(this, ctx); } finally { this.actors.length = n; }
  const v = this.player && this.player.vehicle;
  if (v && G.scenes.top() === this) {
    G.renderer.uiTransform();
    G.vehicles.drawGauge(ctx, v);
  }
};
GS.findInteraction = function () {
  if (this.player.vehicle) return null;
  const best = _find.call(this), v = G.vehicles.nearest(this);
  if (v && (!best || best.type === 'decor')) return { type: 'vehicle', ref: v, label: v.ai ? 'Carjack' : v.owner === 'player' || v.keys || v.hotwired ? (v.m.moto ? 'Ride' : 'Drive') : (v.m.moto ? 'Motorcycle' : 'Car') };
  return best;
};
GS.interact = function () {
  const t = this.promptTarget;
  if (t && t.type === 'vehicle') { const v = t.ref; if (!v.ai && (v.owner === 'player' || v.keys || v.hotwired) && !v.wrecked) G.vehicles.enter(this, v); else G.vehicles.menu(this, v, null); return; }
  return _interact.call(this);
};
})();

// ---------------------------------------------------------------- hotwiring, made easy
// A spark sweeps across the ignition: press [E] (or click) while it is in the green zone. Three hits start
// the engine. The zone is wide (wider with Hotwiring and Knowledge); a miss sparks and may set off the alarm.
(() => {
class EasyHotwire {
  constructor(game, v, onStart) {
    this.transparent = true; this.game = game; this.v = v; this.onStart = onStart;
    const p = game.player, rank = G.skills.rank(p, 'hotwire'), know = G.attr ? G.attr.get(p, 'knowledge') - 3 : 0;
    this.zone = G.util.clamp(0.26 + rank * 0.07 + know * 0.015 - (v.model === 'police_car' ? 0.06 : 0), 0.16, 0.5);
    this.need = 3; this.hits = 0; this.misses = 0; this.maxMiss = 3 + rank;
    this.t = 0; this.speed = 0.7 + (v.model === 'police_car' ? 0.2 : 0); this.newZone();
    this.msg = 'Strike when the spark is in the green.';
  }
  newZone() { this.z0 = 0.1 + Math.random() * (0.8 - this.zone); }
  pos() { const k = (this.t * this.speed) % 2; return k < 1 ? k : 2 - k; }
  hit() {
    const x = this.pos();
    if (x >= this.z0 && x <= this.z0 + this.zone) {
      this.hits++; G.audio.play('click'); this.flash = 0.25;
      if (this.hits >= this.need) { G.scenes.remove(this); G.audio.play('engine'); G.events.emit('xp', 15, 'Hotwiring'); this.onStart(); return; }
      this.msg = ['The dash lights flicker.', 'The starter coughs!'][this.hits - 1] || 'Almost...'; this.newZone(); this.speed *= 1.12;
    } else {
      this.misses++; G.audio.play('error');
      const p = this.game.player;
      if (Math.random() < Math.max(0.06, 0.22 - G.skills.rank(p, 'hotwire') * 0.06)) {
        G.audio.play('alarm'); this.msg = 'BZZT. The alarm goes off!';
        for (const a of this.game.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 170) { a.sleeping = false; if (a.def.combat === 'flee') a.startFlee(p); }
        this.game.reportCrime('theft', null, 50, this.v.owner && this.game.world.isAlive(this.v.owner) ? this.v.owner : null);
      } else this.msg = `Sparks. ${this.maxMiss - this.misses} more tries.`;
      if (this.misses >= this.maxMiss) { G.scenes.remove(this); this.game.toast('You give up on the wiring.', 'bad'); }
    }
  }
  update(dt) {
    this.t += dt || 1 / 60; if (this.flash) this.flash = Math.max(0, this.flash - (dt || 1 / 60));
    const I = G.input;
    if (I.wasPressed('interact') || I.wasPressed('confirm') || I.pressed.has('Space')) this.hit();
    if (I.wasPressed('cancel')) G.scenes.remove(this);
  }
  render(ctx) {
    const R = G.renderer, U = G.ui;
    const W = 260, H = 110, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Hotwiring', titleSize: 12 });
    const bx = x + 20, by = y + 40, bw = W - 40;
    ctx.fillStyle = '#1e1e24'; ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = this.flash ? '#a8ffa0' : '#3aa84a'; ctx.fillRect(bx + this.z0 * bw, by, this.zone * bw, 14);
    const sx = bx + this.pos() * bw;
    ctx.fillStyle = '#ffe080'; ctx.fillRect(sx - 1.5, by - 3, 3, 20);
    ctx.fillStyle = 'rgba(255,240,160,0.4)'; ctx.fillRect(sx - 4, by - 1, 8, 16);
    for (let i = 0; i < this.need; i++) { ctx.fillStyle = i < this.hits ? '#8aea7a' : '#3a3444'; ctx.fillRect(x + W / 2 - 22 + i * 16, y + 62, 12, 6); }
    U.text(ctx, this.msg, R.uiW / 2, y + 74, { align: 'center', size: 9 });
    if (G.input.mouse.pressed && U.inRect(G.input.mouse.ux, G.input.mouse.uy, x, y, W, H)) this.hit();
  }
}
G.HotwireScene = EasyHotwire;
})();
// ---------------------------------------------------------------- the speedometer: a round gauge left of the minimap
(() => {
const U = G.ui, TAU = Math.PI * 2, A0 = Math.PI * 0.75, SWEEP = Math.PI * 1.5, MAX = 80;
G.vehicles.drawGauge = function (ctx, v) {
  const R = G.renderer, cx = R.uiW - 82 - 34, cy = R.uiH - 40, r = 25;
  const mph = Math.abs(v.speed) * 0.25;
  v._needle = v._needle == null ? mph : v._needle + (mph - v._needle) * 0.25;   // the needle has weight
  const ang = (m) => A0 + G.util.clamp(m / MAX, 0, 1.04) * SWEEP;
  ctx.save();
  // bezel: brushed metal, then the black face
  const bz = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); bz.addColorStop(0, '#d8dce2'); bz.addColorStop(0.5, '#6a6e76'); bz.addColorStop(1, '#2a2c32');
  ctx.fillStyle = bz; ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, TAU); ctx.fill();
  const face = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, r); face.addColorStop(0, '#24262c'); face.addColorStop(1, '#0a0b0e');
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  // red zone
  ctx.strokeStyle = 'rgba(220,50,40,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r - 3, ang(65), ang(MAX)); ctx.stroke();
  // ticks and numbers
  for (let m = 0; m <= MAX; m += 5) {
    const a = ang(m), major = m % 10 === 0, r1 = r - (major ? 6 : 4), r2 = r - 1.5;
    ctx.strokeStyle = m >= 65 ? '#ff6a5a' : '#e8e8ea'; ctx.lineWidth = major ? 1.1 : 0.6;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    if (m % 20 === 0) U.text(ctx, String(m), cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11) - 2.5, { size: 5, align: 'center', color: '#c8ccd2', shadow: false });
  }
  // engine condition: a short arc at the bottom
  const hp = G.util.clamp(Math.max(0, v.hp) / v.m.hp, 0, 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, r - 9, Math.PI * 0.32, Math.PI * 0.68); ctx.stroke();
  ctx.strokeStyle = hp < 0.35 ? '#e05a4a' : '#8ac0e8'; ctx.beginPath(); ctx.arc(cx, cy, r - 9, Math.PI * 0.68 - hp * Math.PI * 0.36, Math.PI * 0.68); ctx.stroke();
  // the digital readout
  U.text(ctx, String(Math.round(mph)), cx, cy + 7, { size: 8, align: 'center', weight: 'bold', color: '#f4f4f6', shadow: false });
  U.text(ctx, 'mph', cx, cy + 15, { size: 4, align: 'center', color: '#9aa0a8', shadow: false });
  // the needle and its cap
  const na = ang(v._needle);
  ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(na) * 4, cy - Math.sin(na) * 4); ctx.lineTo(cx + Math.cos(na) * (r - 4), cy + Math.sin(na) * (r - 4)); ctx.stroke();
  ctx.fillStyle = '#2a2c32'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a8e96'; ctx.beginPath(); ctx.arc(cx - 0.6, cy - 0.6, 1.1, 0, TAU); ctx.fill();
  // glass glare
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(cx - 6, cy - 10, r * 0.6, r * 0.3, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
};
})();
