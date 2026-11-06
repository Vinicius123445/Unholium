'use strict';
// Benadryl (diphenhydramine) and Xanax (alprazolam).
//   Benadryl: one dose makes you drowsy. Taken by the handful it becomes a deliriant: not a "trip" you know
//   you are on, but delirium — shadow people at the edge of your vision, spiders crawling, people who are
//   not there talking to you, a phone that buzzes with messages from no one, a cigarette in your hand that
//   vanishes. Your heart races, your mouth is bone dry, your body stops listening. Huge doses mean seizures
//   and a failing heart. It lasts a long time and nothing about it is fun.
//   Xanax: calm, numb, sleepy. With alcohol or opioids it can stop your breathing. Daily use builds a
//   dependence whose withdrawal brings anxiety, tremors and seizures.
(() => {
Object.assign(G.DRUG_CLASSES, {
  deliriant: { name: 'Deliriants', decay: 0.12 },
  benzo: { name: 'Benzodiazepines', decay: 0.16, od: 85, odEffect: 'resp_depression', withdrawal: 'wd_benzo', after: 14, dependent: 30 },
});
Object.assign(G.EFFECTS, {
  drowsy: { name: 'Drowsy', kind: 'drug', color: '#b8a8d8', stats: { staminaRegen: -0.2 }, speed: 0.95, desc: 'Antihistamine. Sleepy and slow.' },
  calm: { name: 'Calm', kind: 'drug', color: '#8aa8e0', stats: { charisma: 1, staminaRegen: -0.1 }, speed: 0.92, dmgTaken: 0.9, visual: 'painkiller', desc: 'Nothing can touch you. Not even worry.' },
  delirium: { name: 'Delirium', kind: 'drug', bad: true, color: '#6a3a5a', stats: { charisma: -4, accuracy: -0.3 }, speed: 0.85, spread: 0.15, desc: 'You cannot tell what is real anymore.' },
  anticholinergic: { name: 'Heart Racing', kind: 'drug', bad: true, color: '#c83a5a', dps: 0.8, desc: 'Way too much Benadryl. Your heart is pounding out of your chest.' },
  wd_benzo: { name: 'Benzo Withdrawal', kind: 'withdrawal', bad: true, color: '#7a8ab8', stats: { charisma: -2, staminaRegen: -0.3 }, spread: 0.08, visual: 'crash', desc: 'Panic, tremors, insomnia. Can cause seizures. Taper, do not quit cold.' },
});
for (const id of ['drowsy', 'calm', 'delirium', 'anticholinergic', 'wd_benzo']) G.EFFECTS[id].id = id;

// benzos stack with alcohol and opioids on the same breathing
const E = G.effects, _risk = E.risk;
E.risk = function (p, cls) {
  const s = this.drugState(p);
  if (cls === 'benzo') {
    const c = G.DRUG_CLASSES.benzo;
    return ((s.load.benzo || 0) + p.alcohol * 0.8 + (s.load.opioid || 0) * 0.6) / (c.od + (s.tol.benzo || 0) * 0.3);
  }
  let r = _risk.call(this, p, cls);
  if (cls === 'opioid' && s.load.benzo) r += (s.load.benzo * 0.6) / (G.DRUG_CLASSES.opioid.od + (s.tol.opioid || 0) * 0.4);
  return r;
};

G.pills = {
  update(p, dt, scene) {
    const s = E.drugState(p), del = s.load.deliriant || 0;
    // overdoses
    if (E.risk(p, 'benzo') >= 1 && !E.has(p, 'resp_depression')) {
      E.add(p, 'resp_depression', 30); s.load.benzo *= 0.7; G.audio.play('hurt');
      scene.toast('Your breathing slows to almost nothing. (Benzos + depressants) You are overdosing!', 'bad');
    }
    if (del >= 55 && !E.has(p, 'delirium')) { E.add(p, 'delirium', 420 + del * 3); scene.toast('Something is wrong. The shadows are moving.', 'bad'); }
    if (del >= 95 && !E.has(p, 'anticholinergic')) { E.add(p, 'anticholinergic', 90); scene.toast('Your heart is racing. You are burning up. You took way too much.', 'bad'); }
    if (del >= 95 && Math.random() < dt / 25) { G.combat.damage(p, 10, null, scene); p.stamina = 0; p.kbx = (Math.random() - 0.5) * 90; scene.toast('You have a seizure.', 'bad'); }
    const wd = E.get(p, 'wd_benzo');
    if (wd && Math.random() < dt / 120 * wd.power) { G.combat.damage(p, 8, null, scene); p.stamina = 0; scene.toast('A seizure. Benzo withdrawal is no joke.', 'bad'); }
    if (E.has(p, 'delirium')) this.delirium(p, dt, scene);
  },
  // the waking nightmare
  delirium(p, dt, scene) {
    const d = (scene.delir = scene.delir || { shadows: [], bugs: [], t: 0 });
    d.t += dt;
    p.thirst = Math.min(100, (p.thirst || 0) + dt * 0.08);   // bone-dry mouth
    if (Math.random() < dt * 0.25 && d.shadows.length < 4) d.shadows.push({ x: p.x + G.rng.range(-160, 160), y: p.y + G.rng.range(-110, 110), a: 0, life: G.rng.range(4, 9) });
    if (Math.random() < dt * 0.8 && d.bugs.length < 14) d.bugs.push({ x: Math.random(), y: Math.random(), vx: G.rng.range(-0.15, 0.15), vy: G.rng.range(-0.15, 0.15), life: G.rng.range(2, 6) });
    for (const sh of d.shadows) { sh.life -= dt; sh.a = Math.min(0.75, sh.a + dt * 0.4); if (Math.hypot(sh.x - p.x, sh.y - p.y) < 40) sh.life = Math.min(sh.life, 0.2); }
    for (const b of d.bugs) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (Math.random() < dt * 2) { b.vx = G.rng.range(-0.15, 0.15); b.vy = G.rng.range(-0.15, 0.15); } }
    d.shadows = d.shadows.filter((q) => q.life > 0); d.bugs = d.bugs.filter((q) => q.life > 0);
    // things that are not there
    if (Math.random() < dt / 22) scene.toast(G.rng.pick([
      'New message from ???: "i can see you"', 'You reach for the cigarette in your hand. There is no cigarette.', 'Someone whispers your name. Right behind you.',
      'Your phone is ringing. ...It is not.', 'There is a man standing in the corner. He was not there a second ago.', 'Your friend is talking to you. You answer. Nobody is there.',
      'The floor is covered in spiders. You blink. It is not.', 'You have been walking for an hour. It has been two minutes.',
    ]), 'bad');
    if (Math.random() < dt / 40) d.flipT = 3;   // your body stops listening
    if (d.flipT > 0) d.flipT -= dt;
  },
  draw(ctx, scene) {
    const d = scene.delir, p = scene.player;
    if (!d || !E.has(p, 'delirium')) { scene.delir = null; return; }
    const R = G.renderer;
    // shadow people, in the world
    R.worldTransform();
    for (const sh of d.shadows) {
      ctx.globalAlpha = sh.a * Math.min(1, sh.life);
      ctx.fillStyle = '#05030a';
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y - 22, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sh.x - 7, sh.y - 16, 14, 18);
      ctx.fillStyle = '#c82a2a'; ctx.fillRect(sh.x - 3, sh.y - 24, 1.5, 1); ctx.fillRect(sh.x + 2, sh.y - 24, 1.5, 1);
    }
    ctx.globalAlpha = 1;
    // bugs crawling on your eyes, heavy vignette, the pulse of a racing heart
    R.screenTransform();
    const W = R.W, H = R.H;
    ctx.fillStyle = '#0a0608';
    for (const b of d.bugs) {
      const x = b.x * W, y = b.y * H, s = 3 * (W / 640);
      ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.2);
      for (let k = -1; k <= 1; k++) { ctx.fillRect(x - s * 2.2, y + k * s * 0.8, s * 1.4, 1); ctx.fillRect(x + s * 0.8, y + k * s * 0.8, s * 1.4, 1); }
    }
    const pulse = 0.55 + Math.sin(G.loop.time * (E.has(p, 'anticholinergic') ? 14 : 8)) * 0.1;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(20,0,10,${pulse})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (Math.random() < 0.015) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H); }
  },
};

// drowsiness tires you; withdrawal checks; reversed controls in delirium
const GS = G.GameScene.prototype, _upd = GS.update, _render = GS.render;
GS.update = function (dt) {
  const p = this.player, d = this.delir, I = G.input;
  let swapped = false;
  if (p && d && d.flipT > 0) {   // left is right, up is down
    const b = I.bindings; [b.left, b.right] = [b.right, b.left]; [b.up, b.down] = [b.down, b.up]; swapped = true;
  }
  try { return _upd.call(this, dt); } finally {
    if (swapped) { const b = I.bindings; [b.left, b.right] = [b.right, b.left]; [b.up, b.down] = [b.down, b.up]; }
    if (p && !p.dead) G.pills.update(p, dt, this);
  }
};
GS.render = function (ctx) {
  _render.call(this, ctx);
  if (this.player && this.delir) G.pills.draw(ctx, this);
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!scene || !G.world || !G.rest) return;
  const p = scene.player;
  if (E.has(p, 'drowsy') || E.has(p, 'calm')) p.rest = Math.max(0, G.rest.get(p) - 3);
});
})();
