'use strict';
// People in the traffic.
//   Every car or bike on the road has a driver (sometimes a passenger) and you can see them: a head through
//   the windshield, a rider on a motorcycle, a cyclist pedaling. No driver, no movement — a carjacked car
//   is yours, a wrecked one's driver bails out onto the street.
//   Bicycles (new): slow, quiet, pedaled; wheels spin on bikes and motorcycles, riders lean.
//   Cars are solid: you walk around them. Drivers need a moment to react, so stepping out in front of
//   traffic can get you hit — real damage, knocked flying.
(() => {
const A = G.assets, V = G.vehicles, MODELS = V.MODELS;
for (const [id, col] of [['bike_red', '#c83a3a'], ['bike_blue', '#3a6ad8'], ['bike_green', '#3a9a5a']]) MODELS[id] = { body: col, moto: true, bike: true, len: 18, wid: 6, max: 115, acc: 70, hp: 30, value: 120 };

// bicycles: a thin frame and two thin wheels
const _init = A.init;
A.init = function () {
  _init.call(this);
  for (const id in MODELS) {
    if (!MODELS[id].bike) continue;
    const m = MODELS[id], L = m.len + 2, W = m.wid + 4;
    const { c, x } = A.mk(L, W);
    const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
    R(0, Math.floor(W / 2) - 1, 4, 2, '#1a1a1e'); R(L - 4, Math.floor(W / 2) - 1, 4, 2, '#1a1a1e');   // tires seen from above
    R(3, Math.floor(W / 2), L - 6, 1, m.body); R(L - 5, 1, 1, W - 2, '#9aa0aa');                    // frame, handlebar
    R(5, Math.floor(W / 2) - 1, 3, 2, '#2a2420');                                                    // saddle
    A.sprites['veh_' + id] = { img: c, ax: Math.floor(L / 2), ay: W - 1, w: L, h: W };
  }
};

// ---------------------------------------------------------------- drivers in traffic
const _spawn = V.spawnTraffic;
V.spawnTraffic = function (scene, edge) {
  const v = _spawn.call(this, scene, edge);
  if (!v) return v;
  const d = scene.map.meta.district;
  if ((d === 'suburbs' || d === 'center' || scene.map.id === 'rural') && Math.random() < 0.14) {
    v.model = G.rng.pick(['bike_red', 'bike_blue', 'bike_green']); v.m = MODELS[v.model]; v.hp = v.m.hp; v.ai.cruise = G.rng.range(38, 55);
  }
  const seed = G.util.uid('drv');
  v.ai.driver = { seed, look: G.look('driver' + seed) };
  if (!v.m.moto && Math.random() < 0.35) v.ai.passenger = { look: G.look('pass' + seed) };
  return v;
};
// no driver, no movement
const _ai = V.updateAI;
V.updateAI = function (v, dt, scene) {
  if (!v.ai.driver) { v.speed = Math.max(0, v.speed - 300 * dt); return; }
  return _ai.call(this, v, dt, scene);
};
// put a driver out on the street (carjacking, wrecks)
V.ejectDriver = function (scene, v, angry) {
  const d = v.ai && v.ai.driver;
  if (!d) return null;
  const look = d.look, seed = d.seed;
  const def = { id: 'driver_' + seed, name: 'Driver', map: scene.map.id, faction: 'civilians', hp: 30, combat: angry ? 'fight' : 'flee', look, transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: Math.floor(v.x / 16), y: Math.floor(v.y / 16) }, act: 'idle' }] };
  const st = { alive: true, name: 'Driver', map: scene.map.id, hp: 30, fear: angry ? 0 : 100, inv: [], gold: G.rng.int(5, 60), realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
  const npc = new G.NPC(def.id, st, def);
  const c = Math.cos(v.angle), s = Math.sin(v.angle), side = v.Wd + 10;
  const spot = (G.everyday && G.everyday.freeSpot(scene.map, v.x + s * side, v.y - c * side + 6, 10, 6)) || { x: v.x + s * side, y: v.y - c * side + 6 };
  npc.x = spot.x; npc.y = spot.y;
  scene.actors.push(npc);
  v.ai.driver = null;
  return npc;
};
V.carjack = function (scene, v) {
  const angry = Math.random() < 0.3;
  const npc = this.ejectDriver(scene, v, angry);
  v.ai = null; v.speed = 0; v.hotwired = true; v.stolen = true;
  scene.toast('You yank the driver out of the seat!', 'warn');
  if (npc) {
    scene.reportCrime('assault', npc, v.m.value);
    if (angry) { npc.say('Get out of my car!', 3); npc.aggressor = true; npc.startFight(scene.player, scene); }
    else { npc.say(G.rng.pick(['Take it! Take it! Just do not hurt me!', 'HELP! CARJACKER!']), 3); npc.startFlee(scene.player); }
  }
  this.enter(scene, v);
};
const VP = G.Vehicle.prototype, _dmg = VP.damage;
VP.damage = function (n, scene) {
  _dmg.call(this, n, scene);
  if (this.wrecked && this.ai && this.ai.driver) { const npc = V.ejectDriver(scene, this, false); if (npc) { npc.say('My car! My CAR!', 3); npc.startFlee(scene.player); } this.ai = null; }
};

// ---------------------------------------------------------------- cars are solid; traffic can hit you
const PL = G.Player.prototype, _move = PL.move;
PL.move = function (map, dx, dy, slide) {
  const scene = G.doors && G.doors.scene, ox = this.x, oy = this.y;
  const r = _move.call(this, map, dx, dy, slide);
  if (!this.vehicle && scene && scene.vehicles && !(G.cheats && G.cheats.noclip)) {
    for (const v of scene.vehicles) if (v.covers(this.x, this.y, 2) && !v.covers(ox, oy, 2)) { this.x = ox; this.y = oy; return false; }
  }
  return r;
};
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if (!this.vehicles) return r;
  const p = this.player;
  for (const v of this.vehicles) {
    // a car rolling slowly onto someone moves them aside at walking pace, it does not throw them
    if (!p.dead && !p.vehicle && Math.abs(v.speed) < 25) G.vehicles.easeOut(v, p, dt);
    if (!v.ai || v.speed < 25 || p.dead || p.vehicle || (p.invuln || 0) > 0) continue;
    if (!v.covers(p.x, p.y, 1)) continue;
    const hit = Math.round(v.speed * (v.m.bike ? 0.08 : 0.22));
    G.combat.damage(p, hit, null, this);
    p.kbx = Math.cos(v.angle) * v.speed * 2.2; p.kby = Math.sin(v.angle) * v.speed * 2.2;
    this.toast(v.m.bike ? 'A cyclist slams into you!' : 'You got hit by a car!', 'bad');
    G.audio.play('crash'); G.renderer.shake(6);
    v.speed = 0;
    if (G.rng.chance(0.5)) G.audio.play('honk');
  }
  return r;
};
})();
