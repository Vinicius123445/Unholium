'use strict';
// Weather you can see, and things that move like they have weight.
//   Wind: a breeze that shifts direction and strength through the day, with gusts. Trees, bushes, crops
//   and flowers sway with it (taller things more, each one a little out of step), leaves and dust blow
//   across the screen outdoors, smoke drifts downwind, and fire spreads a little faster with it.
//   Knockback: people and animals sent flying slide to a stop, bounce off walls instead of sticking to
//   them, and a hard slam into a wall hurts.
//   Guns spit brass: casings fly out and bounce on the ground. Cars leave skid marks when they brake hard
//   or take a corner fast, and burn rubber.
(() => {
// ---------------------------------------------------------------- wind
G.breeze = {
  angle: 0.3, strength: 0.4, gust: 0, t: 0,
  update(dt, w) {
    this.t += dt;
    const day = w ? w.day * 24 + w.hourF : this.t / 60;
    // the day's wind (the same one that carries embers in a fire: G.wind in firefighting.js), drifting a little
    // through the day, plus gusts
    const dw = w && G.wind ? G.wind(w) : { dx: 1, dy: 0, s: 0.4 };
    this.angle = Math.atan2(dw.dy, dw.dx) + Math.sin(day * 0.13) * 0.35;
    const base = dw.s * 0.8 + 0.1 * Math.sin(day * 0.21 + 1) + (w && w.hour >= 13 && w.hour <= 17 ? 0.12 : 0);
    if (Math.random() < dt * 0.08) this.gust = 0.4 + Math.random() * 0.6;
    this.gust = Math.max(0, this.gust - dt * 0.35);
    this.strength = G.util.clamp(base + this.gust, 0, 1.4);
  },
  get dx() { return Math.cos(this.angle) * this.strength; },
  get dy() { return Math.sin(this.angle) * this.strength * 0.4; },
};
const SWAY = /^(oak|pine|bush|berrybush|deadtree|wheat|corn|haybale|flowers|tuft|plant|palm|hedge)/;
const swayOf = (type) => (/^(oak|pine|palm)/.test(type) ? 1 : /^(bush|berrybush|hedge|plant)/.test(type) ? 0.6 : /^deadtree/.test(type) ? 0.5 : 0.8);
G.drawDecor = function (ctx, o, s, scene) {
  const x = Math.round(o.x - s.ax), y = Math.round(o.y - s.ay);
  const hd = G.floraHD && G.floraHD.get(o.def && o.def.sprite), put = (px, py) => { if (hd) ctx.drawImage(hd, px, py, s.w, s.h); else ctx.drawImage(s.img, px, py); };
  if (!SWAY.test(o.type) || scene.map.meta.indoor || scene.map.meta.floorOf) { put(x, y); return; }
  // lean the top of the sprite with the wind; each tree a little out of step
  const ph = (o.tx * 7.3 + o.ty * 3.1) % 6.28, w = G.breeze;
  const lean = (w.dx * 0.06 + Math.sin(w.t * (1.4 + w.strength) + ph) * 0.025 * (0.4 + w.strength)) * swayOf(o.type);
  if (Math.abs(lean) < 0.004) { put(x, y); return; }
  ctx.save();
  ctx.translate(o.x, o.y);           // pivot at the base
  ctx.transform(1, 0, -lean, 1, 0, 0);
  put(x - o.x, y - o.y);
  ctx.restore();
};
// leaves and dust
const GS = G.GameScene.prototype, _gu = GS.update, _fx = GS.renderScreenFx;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  G.breeze.update(dt, this.world);
  const m = this.map;
  if (m && !m.meta.indoor && !m.meta.floorOf && this.player && G.settings.get('particles') !== false && G.settings.get('particles') !== 0) {
    this.windBits = (this.windBits || []).filter((b) => (b.t -= dt) > 0);
    const want = Math.round(6 + G.breeze.strength * 18);
    if (this.windBits.length < want && Math.random() < dt * 10) {
      const R = G.renderer, v = R.viewRect ? R.viewRect(0) : { x: this.player.x - 300, y: this.player.y - 200, w: 600, h: 400 };
      const fromLeft = G.breeze.dx >= 0, region = m.meta.region;
      const leafy = region === 'rural' || region === 'forest' || m.id === 'wilds';
      this.windBits.push({ x: fromLeft ? v.x - 10 : v.x + v.w + 10, y: v.y + Math.random() * v.h, t: 6 + Math.random() * 4, ph: Math.random() * 6, leaf: leafy || Math.random() < 0.3,
        color: leafy ? G.rng.pick(['#6a8a2a', '#8aa03a', '#a8783a', '#c8a040']) : G.rng.pick(['#8a8478', '#a8a090', '#6a645a']) });
    }
    for (const b of this.windBits) { b.x += (G.breeze.dx * 70 + Math.sin(b.ph + b.t * 3) * 8) * dt; b.y += (G.breeze.dy * 40 + Math.cos(b.ph + b.t * 2) * 10 + (b.leaf ? 6 : 0)) * dt; }
  }
  return r;
};
const _fdraw = G.FireSystem.prototype.draw;
G.FireSystem.prototype.draw = function (ctx, view, time) {
  // (drawn with the world, after the roofs) the wind bits, then the fire itself
  const scene = this.scene;
  for (const b of scene.windBits || []) {
    ctx.fillStyle = b.color;
    if (b.leaf) { const s = Math.sin(b.ph + b.t * 6); ctx.fillRect(Math.round(b.x), Math.round(b.y), s > 0 ? 2 : 1, 1); }
    else ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
  }
  return _fdraw.call(this, ctx, view, time);
};
// smoke drifts downwind; fire leans into the wind
const FS = G.FireSystem.prototype, _fup = FS.update;
FS.update = function (dt) {
  const r = _fup.call(this, dt);
  for (const s of this.smoke) { s.x += G.breeze.dx * 10 * dt; s.y += G.breeze.dy * 4 * dt; }
  return r;
};
const _flam = FS.flamAt;
FS.flamAt = function (i) { const f = _flam.call(this, i); return f > 0 ? Math.min(1, f * (1 + G.breeze.strength * 0.15)) : f; };

// ---------------------------------------------------------------- knockback with weight
const AP = G.Actor.prototype, _base = AP.baseUpdate;
AP.baseUpdate = function (dt, map) {
  if (this.kbx || this.kby) {
    const speed = Math.hypot(this.kbx, this.kby);
    // try each axis on its own: blocked ones bounce back
    const x0 = this.x, y0 = this.y;
    this.move(map, this.kbx * dt, 0);
    if (this.x === x0 && Math.abs(this.kbx) > 20) this.kbx *= -0.35;
    this.move(map, 0, this.kby * dt);
    if (this.y === y0 && Math.abs(this.kby) > 20) this.kby *= -0.35;
    const hitWall = (this.x === x0 && Math.abs(this.kbx) > 7) || (this.y === y0 && Math.abs(this.kby) > 7);
    if (hitWall && speed > 170 && !this.dead && (this.slamT || 0) <= 0) {
      this.slamT = 0.5;
      const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
      if (scene) { G.combat.damage(this, Math.round((speed - 150) / 25) + 1, null, scene); G.audio.play('hit'); if (G.renderer.shake && this.kind === 'player') G.renderer.shake(3); }
    }
    const fr = Math.pow(this.kind === 'animal' && this.def && this.def.hp > 80 ? 0.0002 : 0.0008, dt);   // heavy things stop sooner
    this.kbx *= fr; this.kby *= fr;
    if (Math.abs(this.kbx) < 2) this.kbx = 0;
    if (Math.abs(this.kby) < 2) this.kby = 0;
    const kx = this.kbx, ky = this.kby;
    this.kbx = this.kby = 0;
    _base.call(this, dt, map);   // everything else (timers, animation) as before, without moving again
    this.kbx = kx; this.kby = ky;
  } else _base.call(this, dt, map);
  if (this.slamT > 0) this.slamT -= dt;
};

// ---------------------------------------------------------------- brass and rubber
// A spent casing is thrown out of the gun's ejection port (to the right of where it points, a little back)
// only when a round is actually fired: shoot() is the shot itself, so an empty click, a reload or a gun
// still cycling throws nothing. Revolvers keep their brass in the cylinder. Shotguns throw a red shell.
// Casings fly in an arc (height z over the ground point x,y), spin, bounce twice, settle and fade.
const F = G.firearms, _shoot = F.shoot;
const casing = (scene, who, a, w) => {
  if (!scene || !w || w.id === 'revolver' || w.cat === 'revolver') return;
  const side = a + Math.PI / 2 + 0.35, sp = 45 + Math.random() * 30;
  const gx = who.x + Math.cos(a) * 4, gy = who.y + Math.sin(a) * 2;   // the gun, at hand height above (gx, gy)
  (scene.casings = scene.casings || []).push({
    x: gx, y: gy, z: 8, vx: Math.cos(side) * sp, vy: Math.sin(side) * sp * 0.6, vz: 55 + Math.random() * 25,
    rot: Math.random() * Math.PI, spin: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10), rest: false, bounces: 0, age: 0,
    shell: !!w.pellets, big: w.cat === 'rifle' || w.id === 'assault_rifle',
  });
  const cap = G.gfxLevel().casings; if (scene.casings.length > cap) scene.casings.splice(0, scene.casings.length - cap);
};
F.shoot = function (shooter, scene, angle, w) { const r = _shoot.apply(this, arguments); casing(scene, shooter, angle, w); return r; };
// they move with the game (not with the drawing): paused game, still casings
const GSc = G.GameScene.prototype, _gsu = GSc.update;
GSc.update = function (dt) {
  const r = _gsu.call(this, dt);
  const list = this.casings; if (!list || !list.length) return r;
  for (const c of list) {
    c.age += dt;
    if (c.rest) continue;
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vz -= 420 * dt; c.rot += c.spin * dt;
    if (c.z <= 0) {
      c.z = 0; c.bounces++;
      if (c.bounces === 1 && this.isOnScreen(c.x, c.y) && G.audio.ctx) G.audio.play('casing', { x: c.x, y: c.y, shell: c.shell });   // tink
      c.vz = -c.vz * 0.35; c.vx *= 0.5; c.vy *= 0.5; c.spin *= 0.5;
      if (c.bounces >= 3 || Math.abs(c.vz) < 12) { c.rest = true; c.vz = 0; }
    }
  }
  // old brass fades away after a while
  this.casings = list.filter((c) => c.age < 90);
  return r;
};
const _fd = F.draw;
F.draw = function (ctx, scene) {
  for (const c of scene.casings || []) {
    const fade = c.age > 80 ? Math.max(0, (90 - c.age) / 10) : 1;
    const flat = Math.abs(Math.cos(c.rot)) > 0.5, len = c.shell ? 3 : c.big ? 3 : 2, x = Math.round(c.x), y = Math.round(c.y - c.z);
    ctx.globalAlpha = fade;
    if (c.z > 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(c.x), Math.round(c.y), 2, 1); }   // its shadow on the ground
    ctx.fillStyle = c.shell ? '#c02828' : '#d8b040';
    if (flat) ctx.fillRect(x, y, len, 1); else ctx.fillRect(x, y - len + 1, 1, len);
    ctx.fillStyle = c.shell ? '#d8b040' : '#f0d878';   // the brass head of a shell, the shine on a casing
    ctx.fillRect(flat ? x : x, flat ? y : y, 1, 1);
    ctx.globalAlpha = 1;
  }
  return _fd.call(this, ctx, scene);
};
// skid marks: hard braking or fast cornering
const skids = (scene) => { const w = scene.world; w.skids = w.skids || {}; return (w.skids[scene.map.id] = w.skids[scene.map.id] || []); };
const GS2 = G.GameScene.prototype, _gu2 = GS2.update;
GS2.update = function (dt) {
  const r = _gu2.call(this, dt);
  for (const v of this.vehicles || []) {
    const sp = Math.abs(v.speed), prev = v.prevSpeed == null ? sp : v.prevSpeed;
    const braking = prev - sp > 220 * dt && sp > 50, cornering = Math.abs(v.angle - (v.prevAngle == null ? v.angle : v.prevAngle)) / dt * sp > 260;
    if ((braking || cornering) && !v.m.moto) {
      const c = Math.cos(v.angle), s = Math.sin(v.angle);
      const sk = skids(this);
      for (const side of [-1, 1]) sk.push({ x: v.x - c * v.L * 0.6 - s * side * v.Wd * 0.7, y: v.y - s * v.L * 0.6 + c * side * v.Wd * 0.7, day: this.world.day });
      if (sk.length > 400) sk.splice(0, sk.length - 400);
      if (Math.random() < 0.3) this.particles(v.x - c * v.L, v.y - s * v.L, '#c8c8c8', 1);
      if (!v.squealT || v.squealT < this.time) { v.squealT = this.time + 0.8; G.audio.play('squeal', { x: v.x, y: v.y }); }
    }
    v.prevSpeed = sp; v.prevAngle = v.angle;
  }
  return r;
};
})();
