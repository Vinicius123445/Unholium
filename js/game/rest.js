'use strict';
(() => {
// Sleep need. p.rest: 100 = fully rested, 0 = you collapse wherever you are.
//   Awake you lose ~4.5 per hour (a long day is fine, an all-nighter is not); pregnancy and heavy
//   drinking tire you faster; coffee, energy drinks and stimulants buy you a little time (and you pay
//   for it later). Sleeping restores ~12.5 per hour. Below 25 you are Tired, below 10 Exhausted (slow,
//   clumsy, sometimes your eyes just... close). At 0 you pass out on the spot for hours — on the street
//   that means someone may go through your pockets.

G.EFFECTS.tired_fx = { name: 'Tired', kind: 'buff', bad: true, color: '#9a9ab8', desc: 'You need sleep.' };

G.rest = {
  DRAIN: 4.5, GAIN: 12.5,
  CAFFEINE: { coffee: 12, energy_drink: 18, speed_pills: 30, cocaine: 25, crack: 25 },
  get(p) { return p.rest == null ? (p.rest = 85) : p.rest; },
  hourly(scene) {
    const p = scene.player;
    if (p.dead || scene.sleepingNow) return;
    let d = this.DRAIN;
    if (p.preg) d += 1;
    if (p.alcohol > 40) d += 1.5;
    if (G.effects.has(p, 'crash')) d += 3;
    const before = this.get(p);
    p.rest = Math.max(0, before - d);
    if (before >= 25 && p.rest < 25) scene.toast('You are getting tired. Find a bed soon.', 'warn');
    if (before >= 10 && p.rest < 10) scene.toast('You can barely keep your eyes open.', 'bad');
    if (p.rest <= 0 && !scene.passingOut) { scene.toast('Your legs give out. Everything goes dark...', 'bad'); scene.passOut('exhaustion'); }
  },
  // Micro-sleeps when exhausted: the screen blinks shut and you stop for a moment.
  update(scene, dt) {
    const p = scene.player, r = this.get(p);
    if (r >= 10 || p.dead || p.vehicle) { scene.blinkT = 0; return; }
    if ((scene.blinkT || 0) > 0) { scene.blinkT -= dt; return; }
    if (Math.random() < dt * (10 - r) * 0.012) scene.blinkT = 0.6;
  },
  statBonus(p, name) {
    const r = this.get(p);
    if (r >= 25) return 0;
    const ex = r < 10;
    if (name === 'staminaRegen') return ex ? -0.5 : -0.25;
    if (name === 'charisma') return ex ? -2 : -1;
    if (name === 'accuracy') return ex ? -0.15 : -0.05;
    return 0;
  },
};

// sleeping restores it (and the hours you sleep do not drain it)
const GS = G.GameScene.prototype, _pass = GS.passTime, _passOut = GS.passOut, _draw = GS.render;
GS.passTime = function (hours, sleeping) {
  if (sleeping) this.sleepingNow = true;
  try { _pass.call(this, hours, sleeping); } finally { this.sleepingNow = false; }
  if (sleeping) this.player.rest = Math.min(100, G.rest.get(this.player) + hours * G.rest.GAIN * (this.sleepQuality || 1));
  this.sleepQuality = 1;
};
GS.passOut = function (reason) {
  if (reason === 'exhaustion') this.sleepingNow = true;
  _passOut.call(this, reason);
  if (reason === 'exhaustion' && !this.passingOut) this.sleepingNow = false;
};
const _sleepForeign = G.beds.sleepForeign;
G.beds.sleepForeign = function (scene, hours, d, owner) {
  scene.sleepingNow = true;
  const h0 = scene.world.day * 24 + scene.world.hour;
  _sleepForeign.call(this, scene, hours, d, owner);
  scene.sleepingNow = false;
  const slept = scene.world.day * 24 + scene.world.hour - h0;
  scene.player.rest = Math.min(100, G.rest.get(scene.player) + slept * G.rest.GAIN * 0.85);   // a strange bed
};
// the black-out from exhaustion: you sleep where you fall
GS.render = function (ctx) {
  _draw.call(this, ctx);
  if (this.blinkT > 0 && G.scenes.top() === this) {
    G.renderer.screenTransform();
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.sin((this.blinkT / 0.6) * Math.PI) * 1.2)})`;
    ctx.fillRect(0, 0, G.renderer.W, G.renderer.H);
  }
};

// stimulants buy time
const _consume = G.effects.consume;
G.effects.consume = function (p, it, scene) {
  const r = _consume.call(this, p, it, scene);
  const k = G.rest.CAFFEINE[it.id];
  if (k) p.rest = Math.min(100, G.rest.get(p) + k);
  return r;
};
const _sb = G.needs.statBonus;
G.needs.statBonus = function (p, name) { return _sb.call(this, p, name) + (p.kind === 'player' ? G.rest.statBonus(p, name) : 0); };
const _mult = G.effects.mult;
G.effects.mult = function (p, key) {
  let m = _mult.call(this, p, key);
  if (key === 'speed' && p.kind === 'player' && G.rest.get(p) < 10) m *= 0.85;
  return m;
};
const _hud = G.effects.hudList;
G.effects.hudList = function (p) {
  const out = _hud.call(this, p), r = G.rest.get(p);
  if (r < 25) out.unshift({ name: r < 10 ? 'Exhausted' : 'Tired', color: '#9a9ab8', t: null, bad: r < 10 });
  return out;
};
const _upd = GS.update;
GS.update = function (dt) { const r = _upd.call(this, dt); if (this.player) G.rest.update(this, dt); return r; };

G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && G.world) G.rest.hourly(scene);
});
})();
