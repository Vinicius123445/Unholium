'use strict';
// Soundscape: tells the audio engine where the player is and what the world sounds like there —
// the reverb of the space, the ambient beds (traffic, birds, crickets, surf, wind, rain, a room's
// hum), footsteps of people walking nearby, and the engines of the cars around you.
(() => {
const A = G.audio;

G.soundscape = {
  t: 0,
  water: 0,
  _ids: new WeakMap(),
  _n: 0,

  idOf(v) { let id = this._ids.get(v); if (!id) { id = 'veh' + (++this._n); this._ids.set(v, id); } return id; },

  indoor(scene) {
    const m = scene.map, p = scene.player;
    return !!(m.meta.indoor || m.meta.floorOf || m.buildingAt(p.x, p.y - 3));
  },

  // how much water is around (0..1): sampled every few tiles
  waterNear(map, x, y) {
    const tx = Math.floor(x / 16), ty = Math.floor(y / 16);
    let n = 0, tot = 0;
    for (let dy = -12; dy <= 12; dy += 3) for (let dx = -14; dx <= 14; dx += 3) {
      tot++;
      const d = map.tileDef(tx + dx, ty + dy);
      if (d && d.water && d.name !== 'pool') n++;
    }
    return Math.min(1, n / tot * 3);
  },

  update(scene, dt) {
    if (!A.ctx || !scene.player || !scene.map) return;
    const p = scene.player, map = scene.map, w = scene.world, W = G.weather;
    const indoor = this.indoor(scene);
    const L = A.listener;
    L.x = p.x; L.y = p.y; L.on = true; L.indoor = indoor;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.5;
      this.water = this.waterNear(map, p.x, p.y);
      const meta = map.meta, region = meta.region, district = meta.district;
      const h = w.hourF, day = h >= 5.5 && h < 19.5, dawn = h >= 5 && h < 8.5;
      const night = !day;
      const rain = W ? W.rain : 0, storm = W ? W.storm : 0;
      const city = region === 'city' && district !== 'suburbs' && district !== 'jail';
      const green = region === 'rural' || region === 'forest' || region === 'island' || district === 'suburbs' || meta.wilds;
      const busy = h >= 7 && h < 21 ? 1 : h >= 5 && h < 23 ? 0.6 : 0.35;
      const lv = {
        wind: (region === 'island' ? 0.6 : region === 'forest' || meta.wilds ? 0.45 : 0.3) + rain * 0.3 + storm * 0.5,
        traffic: city ? busy : district === 'suburbs' ? 0.3 * busy : 0,
        crowd: city && district === 'center' && day ? 0.6 : city && day ? 0.25 : 0,
        birds: green && day && rain < 0.3 ? (dawn ? 1 : 0.5) * (region === 'forest' || meta.wilds ? 1.3 : 1) : city && day ? 0.12 : 0,
        crickets: green && night && rain < 0.4 ? 1 : 0,
        frogs: night && this.water > 0.1 && region !== 'city' ? Math.min(1, this.water * 2) : 0,
        owl: night && (region === 'forest' || meta.wilds || region === 'rural') ? 1 : 0,
        dogs: district === 'suburbs' || region === 'rural' ? (night ? 0.8 : 0.4) : city ? 0.2 : 0,
        waves: this.water * (region === 'island' ? 1.2 : 0.7),
        leaves: (region === 'forest' || meta.wilds ? 0.8 : green ? 0.3 : 0) * (0.5 + (G.breeze ? G.breeze.strength : 0.5)),
        rain, storm, night, room: 0, muffle: false,
      };
      if (indoor) {
        for (const k of ['wind', 'traffic', 'crowd', 'birds', 'crickets', 'frogs', 'owl', 'dogs', 'waves', 'leaves']) lv[k] *= 0.3;
        lv.room = 0.7; lv.muffle = true;
        if (meta.floorOf || meta.indoor) lv.rain *= 0.6;
      }
      if (district === 'jail') { lv.room = 0.8; lv.muffle = true; }
      A.setAmbience(lv);
      // the space you are in shapes every echo
      let space = 'outdoor';
      if (district === 'jail') space = 'cell';
      else if (indoor) { const b = map.buildingAt(p.x, p.y - 3); space = b && b.w * b.h > 200 ? 'hall' : 'room'; }
      else if (city) space = 'street';
      else if (region === 'forest' || meta.wilds) space = 'forest';
      A.setSpace(space);
    }
    this.footsteps(scene, dt);
    this.engines(scene);
  },

  // people walking near you: their steps, by surface
  footsteps(scene, dt) {
    const p = scene.player;
    for (const a of scene.actors) {
      if (a === p || a.dead || !a.moving || a.kind !== 'npc' || a.sleeping) continue;
      if (Math.abs(a.x - p.x) > 140 || Math.abs(a.y - p.y) > 110) continue;
      a._stepT = (a._stepT || Math.random() * 0.4) - dt;
      if (a._stepT > 0) continue;
      const run = a.state === 'flee' || a.state === 'attack' || a.state === 'chase';
      a._stepT = run ? 0.24 : 0.38;
      const d = scene.map.tileDef(Math.floor(a.x / 16), Math.floor((a.y - 2) / 16));
      A.play('step', { surface: a.swimming ? 'water' : A.surfaceOf(d && d.name), x: a.x, y: a.y, vol: 0.7, run });
    }
  },

  // engines: the car you drive, and the nearest few running cars around you
  engines(scene) {
    const p = scene.player, list = scene.vehicles || [];
    const near = [];
    for (const v of list) {
      if (v.dead || v.wrecked || (v.m && v.m.bike)) continue;
      const mine = p.vehicle === v;
      if (!mine && !v.ai && !v.driver) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (!mine && d > 380) continue;
      near.push({ v, d: mine ? -1 : d, mine });
    }
    near.sort((a, b) => a.d - b.d);
    for (const { v, mine } of near.slice(0, 5)) {
      const m = v.m || {}, moto = !!m.moto;
      const sp = Math.abs(v.speed || 0), max = m.max || 200;
      // five gears: rpm climbs through each gear and drops on the shift
      const frac = Math.min(0.999, sp / max), gears = 5, gf = frac * gears, gear = Math.floor(gf), inGear = gf - gear;
      const idle = moto ? 1300 : 800, red = moto ? 10500 : 6200;
      let rpm = sp < 3 ? idle : idle + (gear === 0 ? inGear * (red - idle) * 0.6 : (red - idle) * (0.35 + inGear * 0.5));
      let load;
      if (mine) {
        const gas = G.input.isDown('up'), brake = G.input.isDown('down');
        load = gas ? 1 : brake ? 0.05 : 0.15;
        if (gas && sp < 3) rpm = idle * 1.6;
      } else load = (v.speed || 0) > (v._lastSp || 0) + 0.5 ? 0.6 : 0.2;
      v._lastSp = v.speed || 0;
      A.engine(this.idOf(v), { rpm, load, moto, x: mine ? undefined : v.x, y: mine ? undefined : v.y, vol: mine ? 1 : 0.8 });
    }
  },
};

const GS = G.GameScene.prototype, _u = GS.update;
GS.update = function (dt) {
  _u.call(this, dt);
  try { if (G.weather) G.weather.update(this, dt); G.soundscape.update(this, dt); } catch (e) { /* atmosphere must never break the game */ }
};
})();
