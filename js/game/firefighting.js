'use strict';
// More realistic fire, and a fire department.
//   Wind: every day has a wind direction and strength. Fire spreads faster downwind, hot fires throw
//   embers that start spot fires a few tiles away, and the smoke drifts with the wind. Midday heat dries
//   things out (faster spread), the night is a little calmer.
//   Fire department (Fire Station, the Suburbs): when a fire gets going, someone calls 911. A fire engine
//   arrives by road (sooner in the Suburbs), the crew gets out in their gear, runs to the flames and hoses
//   them down, tile by tile, then packs up and leaves.
(() => {
G.vehicles.MODELS.firetruck = { body: '#c82a2a', cab: '#e8e4dc', siren: true, len: 40, wid: 16, max: 160, acc: 80, hp: 300, value: 5000 };

G.wind = (w) => {
  if (!w.wind || w.wind.day !== w.day) {
    const r = new G.RNG('wind' + w.day), a = r.range(0, Math.PI * 2);
    w.wind = { day: w.day, dx: Math.cos(a), dy: Math.sin(a), s: r.range(0.2, 1) };
  }
  return w.wind;
};

// ---------------------------------------------------------------- wind and embers
const FS = G.FireSystem.prototype, _tick = FS.tick, _fupd = FS.update;
FS.tick = function () {
  _tick.call(this);
  const map = this.map, W = map.w, w = G.world, wind = G.wind(w), rng = G.rng;
  const h = w.hourF, dry = h >= 11 && h < 17 ? 1.25 : h >= 22 || h < 6 ? 0.8 : 1;
  const born = [];
  for (const [i, c] of this.cells) {
    if (c.heat < 0.6) continue;
    const tx = i % W, ty = Math.floor(i / W);
    // downwind neighbor catches more easily
    const nx = tx + Math.round(wind.dx), ny = ty + Math.round(wind.dy);
    if (map.inBounds(nx, ny) && !this.cells.has(ny * W + nx) && this.canBurn(nx, ny) && rng.next() < this.flamAt(ny * W + nx) * 0.18 * wind.s * dry) born.push([nx, ny, c]);
    // embers fly
    if (rng.next() < 0.025 * wind.s * dry * c.heat) {
      const d = rng.int(2, 4), ex = tx + Math.round(wind.dx * d + rng.range(-1, 1)), ey = ty + Math.round(wind.dy * d + rng.range(-1, 1));
      if (map.inBounds(ex, ey) && this.canBurn(ex, ey) && rng.next() < this.flamAt(ey * W + ex)) born.push([ex, ey, c]);
    }
  }
  for (const [x, y, c] of born) this.ignite(x, y, c.byPlayer, c.witnessed);
};
FS.update = function (dt) {
  _fupd.call(this, dt);
  const wind = G.wind(G.world);
  for (const s of this.smoke) { s.x += wind.dx * wind.s * dt * 18; s.y += wind.dy * wind.s * dt * 8; }
};
// put out fire around a point (water from a hose)
// water soaks everything in the spray: burning tiles cool and go out, and wet tiles cannot catch for a while
FS.douse = function (x, y, r) {
  const map = this.map, W = map.w, until = G.loop.time + 25;
  this.wet = this.wet || new Map();
  const r2 = Math.ceil(r / 16);
  for (let ty = Math.floor(y / 16) - r2; ty <= Math.floor(y / 16) + r2; ty++) for (let tx = Math.floor(x / 16) - r2; tx <= Math.floor(x / 16) + r2; tx++) {
    if (!map.inBounds(tx, ty) || Math.hypot(tx * 16 + 8 - x, ty * 16 + 8 - y) > r) continue;
    const i = ty * W + tx, c = this.cells.get(i);
    this.wet.set(i, until);
    if (c) { c.heat -= 1.2; if (c.heat <= 0) { this.cells.delete(i); this.oil.delete(i); } }
  }
};
const _canBurn = FS.canBurn, _ignite = FS.ignite;
FS.canBurn = function (tx, ty) { const t = this.wet && this.wet.get(ty * this.map.w + tx); return t && t > G.loop.time ? false : _canBurn.call(this, tx, ty); };
FS.ignite = function (tx, ty, byPlayer, witnessed) { const t = this.wet && this.wet.get(ty * this.map.w + tx); if (t && t > G.loop.time) return false; return _ignite.call(this, tx, ty, byPlayer, witnessed); };
// soaked tiles belong to the map they are on (tile numbers repeat from map to map)
const _reset = FS.reset;
FS.reset = function (map) { _reset.call(this, map); if (this.wet) this.wet.clear(); };
// spread from neighbors also respects soaked tiles (they are checked in tick through flamAt)
const _flam = FS.flamAt;
FS.flamAt = function (i) { const t = this.wet && this.wet.get(i); return t && t > G.loop.time ? 0 : _flam.call(this, i); };

// ---------------------------------------------------------------- the fire department
const FF_LOOK = (seed, o = {}) => G.look(seed, Object.assign({ top: 'jacket', bottom: 'pants', shirt: '#b8862a', shirt2: '#e8e040', pants: '#2e2e34', shoes: '#111', hat: 'helmet', hatColor: '#c82a2a' }, o));
G.fireDept = {
  update(scene, dt) {
    if (this.off) return;   // tests that need a fire to run its course
    const fire = scene.fire, w = scene.world;
    if (!fire || scene.map.meta.region !== 'city' && scene.map.id !== 'rural') return;
    const call = scene.fireCall;
    if (!call) {
      if (fire.cells.size >= 4 && !scene.map.meta.floorOf) {
        scene.fireCall = { t: scene.map.id === 'suburbs' ? 12 : 26, crew: [], truck: null, done: 0 };
        scene.toast('Someone called 911. The fire department is on the way.', 'warn');
        w.log('Fire department dispatched.', 'info');
      }
      return;
    }
    if (call.t > 0) { call.t -= dt; if (call.t <= 0) this.arrive(scene); return; }
    // crew at work
    for (const ff of call.crew) if (!ff.dead) this.work(ff, dt, scene);
    if (!fire.cells.size) {
      call.done += dt;
      if (call.done > 8) {
        scene.actors = scene.actors.filter((a) => !call.crew.includes(a));
        if (scene.vehicles) scene.vehicles = scene.vehicles.filter((v) => v !== call.truck);
        scene.fireCall = null;
        scene.toast('The firefighters pack up and leave.', 'info');
        w.log('The fire department put out the fire.', 'info');
      }
    }
  },
  centroid(fire) {
    let sx = 0, sy = 0, n = 0;
    for (const i of fire.cells.keys()) { sx += (i % fire.map.w) * 16 + 8; sy += Math.floor(i / fire.map.w) * 16 + 8; n++; }
    return n ? { x: sx / n, y: sy / n } : null;
  },
  arrive(scene) {
    const call = scene.fireCall, map = scene.map, c = this.centroid(scene.fire);
    if (!c) { scene.fireCall = null; return; }
    // park on the closest road lane, else the closest open tile toward the map edge
    let at = null, best = 1e9;
    for (const r of map.roads || []) {
      const lane = (r.at + r.W * 0.75) * 16;
      const x = r.h ? G.util.clamp(c.x, r.from * 16 + 30, (r.to + 1) * 16 - 30) : lane, y = r.h ? lane : G.util.clamp(c.y, r.from * 16 + 30, (r.to + 1) * 16 - 30);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < best) { best = d; at = { x, y, h: r.h }; }
    }
    if (!at) { const t = map.randomWalkableNear(Math.floor(c.x / 16), Math.floor(c.y / 16) + 6, 4); at = { x: t.x * 16 + 8, y: t.y * 16 + 8, h: true }; }
    const truck = new G.Vehicle({ model: 'firetruck', x: at.x, y: at.y, angle: at.h ? 0 : Math.PI / 2, keys: false });
    truck.emergency = true;
    if (scene.vehicles) scene.vehicles.push(truck);
    call.truck = truck;
    G.audio.play('alarm');
    for (let k = 0; k < 4; k++) {
      const seed = G.util.uid('ff');
      const def = { id: 'ff_' + seed, name: k === 0 ? 'Fire Captain' : 'Firefighter', map: map.id, faction: 'government', hp: 60, combat: 'flee', look: FF_LOOK(seed, k === 0 ? { hatColor: '#f0f0f0' } : {}), transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: Math.floor(at.x / 16), y: Math.floor(at.y / 16) }, act: 'idle' }] };
      const st = { alive: true, name: def.name, map: map.id, hp: 60, fear: 0, inv: [], gold: 5, realName: G.randomName(G.rng, def.look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
      const ff = new G.NPC(def.id, st, def);
      const spot = G.everyday ? (G.everyday.freeSpot(map, at.x + (k - 1) * 14, at.y + 22, 10, 6) || { x: at.x + (k - 1) * 14, y: at.y + 22 }) : { x: at.x, y: at.y + 22 };
      ff.x = spot.x; ff.y = spot.y;
      ff.fireJob = true;
      scene.actors.push(ff);
      call.crew.push(ff);
    }
    call.crew[0].say('Fire department! Everybody back!', 3);
  },
  work(ff, dt, scene) {
    const fire = scene.fire;
    if (!fire.cells.size) { ff.moving = false; if (scene.fireCall.truck) ff.walkTo({ x: Math.floor(scene.fireCall.truck.x / 16), y: Math.floor(scene.fireCall.truck.y / 16) + 2 }, dt, scene); return; }
    // the nearest burning tile no one else is on: a crew spreads along the fire instead of all hosing one spot
    let best = null, bd = 1e9, score = 1e9;
    const others = scene.fireCall.crew.filter((q) => q !== ff && !q.dead && q.fireAt).map((q) => q.fireAt);
    for (const i of fire.cells.keys()) {
      const x = (i % fire.map.w) * 16 + 8, y = Math.floor(i / fire.map.w) * 16 + 8, d = Math.hypot(x - ff.x, y - ff.y), s = d + (others.some((o) => Math.hypot(o.x - x, o.y - y) < 70) ? 260 : 0);
      if (s < score) { score = s; bd = d; best = { x, y }; }
    }
    ff.fireAt = best;
    if (bd > 48) { ff.walkTo({ x: Math.floor(best.x / 16), y: Math.floor(best.y / 16) + 2 }, dt, scene, true); return; }
    ff.moving = false;
    ff.faceTowards(best);
    if ((ff.sprayT = (ff.sprayT || 0) - dt) <= 0) {
      ff.sprayT = 0.22;
      fire.douse(best.x, best.y, 46 * G.WORLD_SCALE);
      for (let k = 0; k < 4; k++) scene.particles(ff.x + (best.x - ff.x) * Math.random(), ff.y - 8 + (best.y - ff.y) * Math.random(), '#8ac8f0', 2);
    }
    if (Math.random() < dt / 8) ff.say(G.rng.pick(['Hose it down!', 'Watch the roof!', 'I got this side!', 'More water!']), 2);
  },
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.fireJob && !this.dead) {
    this.baseUpdate(dt, scene.map);
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (this.talking) { this.moving = false; return; }
    return;   // driven by G.fireDept.work
  }
  return _nu.call(this, dt, scene);
};
// sirens flash on emergency vehicles
const VP = G.Vehicle.prototype, _vd = VP.draw;
VP.draw = function (ctx) {
  _vd.call(this, ctx);
  if (!this.emergency) return;
  const on = Math.floor(G.loop.time * 6) % 2;
  ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
  ctx.fillStyle = on ? 'rgba(255,60,60,0.9)' : 'rgba(80,120,255,0.9)'; ctx.fillRect(-2, -this.Wd + 1, 4, 3);
  ctx.fillStyle = on ? 'rgba(80,120,255,0.9)' : 'rgba(255,60,60,0.9)'; ctx.fillRect(-2, this.Wd - 4, 4, 3);
  ctx.restore();
};
const GS = G.GameScene.prototype, _gu = GS.update, _gl = GS.loadMap;
GS.update = function (dt) { const r = _gu.call(this, dt); if (this.fire) G.fireDept.update(this, dt); return r; };
GS.loadMap = function (id, spawnName, pos) { this.fireCall = null; return _gl.call(this, id, spawnName, pos); };
})();
