'use strict';
// Eating people. The parts you get from cutting up a body (js/game/gore2.js) are food: raw (it will
// probably make you sick) or cooked on a stove or a campfire. Cutting up a body also gives you the
// brain. The brain is where the prions are.
//
// Kuru: eat enough brain and it takes hold. It waits a couple of days, then it never stops: tremors,
// staggering, fits of laughter you cannot stop, and finally a body that cannot keep itself alive. There is
// no cure (no pill, no doctor, no hospital) and no going back. It ends when it kills you.
//   p.kuru = { brains, onset (game minute it shows), stage 0..5, next (minute of the next stage) }
// Children's bodies are never cut up (gore2), so nothing here ever comes from a child.
(() => {
const A = G.assets;
const KURU_BRAINS = 3;          // this many brains and it takes hold
const INCUBATION = 2 * 1440;    // game minutes before the first tremor
const STAGE_EVERY = 1.5 * 1440; // each stage worse than the last (each extra brain brings the next one sooner)

// ---------------------------------------------------------------- the food
const human = { human: true };
Object.assign(G.ITEMS.body_arm, human, { type: 'consumable', raw: true, heal: 2, food: 22, desc: 'Raw human flesh. Cook it on a stove or a campfire, or do not. It is also evidence.' });
Object.assign(G.ITEMS.body_leg, human, { type: 'consumable', raw: true, heal: 3, food: 32, desc: 'Raw human flesh. Cook it on a stove or a campfire, or do not. It is also evidence.' });
Object.assign(G.ITEMS.body_torso, human, { type: 'consumable', raw: true, heal: 4, food: 45, desc: 'Raw human flesh, a lot of it. Cooks into several meals. Also evidence.' });
Object.assign(G.ITEMS, {
  body_brain: Object.assign({ id: 'body_brain', name: 'Human Brain', type: 'consumable', icon: 'brain', raw: true, brain: true, heal: 3, food: 14, value: 0, stack: 4,
    desc: 'Soft, grey and heavy. People who eat these do not live to regret it for long.' }, human),
  long_pork: Object.assign({ id: 'long_pork', name: 'Roasted Human Meat', type: 'consumable', icon: 'long_pork', heal: 18, food: 38, value: 0, stack: 10,
    desc: 'Cooked. It smells like pork. It is not pork.' }, human),
  cooked_brain: Object.assign({ id: 'cooked_brain', name: 'Cooked Brain', type: 'consumable', icon: 'brain_cooked', brain: true, heal: 8, food: 16, value: 0, stack: 4,
    desc: 'Cooking kills germs. It does not kill what is in a brain.' }, human),
});
G.ITEMS.body_arm.icon = 'flesh'; G.ITEMS.body_leg.icon = 'flesh'; G.ITEMS.body_torso.icon = 'flesh';
const COOK = { body_arm: ['long_pork', 2], body_leg: ['long_pork', 3], body_torso: ['long_pork', 5], body_brain: ['cooked_brain', 1] };

const _init = A.init;
A.init = function () {
  _init.call(this);
  const icon = (name, fn) => { const { c, x } = A.mk(16, 16); fn(x, (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); }); A.outline(c); A.icons[name] = c; };
  icon('flesh', (x, R) => { R(3, 5, 10, 7, '#b84a4a'); R(4, 4, 8, 1, '#c86060'); R(5, 6, 6, 4, '#d87878'); R(11, 6, 3, 3, '#e8d8c8'); R(7, 7, 2, 1, '#f0e0d0'); });
  icon('long_pork', (x, R) => { R(3, 5, 10, 7, '#8a4a22'); R(4, 4, 8, 1, '#a86030'); R(5, 6, 6, 4, '#b87040'); R(6, 7, 1, 3, '#5a2a10'); R(9, 6, 1, 4, '#5a2a10'); R(12, 7, 2, 2, '#e8d8c8'); });
  const brain = (col, dk) => (x, R) => {
    R(3, 5, 10, 7, col); R(4, 4, 8, 1, col); R(4, 12, 8, 1, col);
    for (const [px, py, w] of [[4, 6, 3], [8, 5, 3], [5, 9, 4], [10, 8, 2], [4, 11, 3], [9, 11, 2]]) R(px, py, w, 1, dk);
    R(7, 5, 1, 7, dk); R(8, 12, 3, 2, col);
  };
  icon('brain', brain('#d8a0a0', '#a86868'));
  icon('brain_cooked', brain('#b88060', '#7a4a30'));
};

// cooking: a stove or a campfire turns parts into meals (the brain cooks too; it does not help)
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'campfire') {
    const p = scene.player; let meals = 0, brains = 0;
    for (const id in COOK) {
      const n = p.inventory.count(id); if (!n) continue;
      const [out, k] = COOK[id];
      p.inventory.remove(id, n); p.inventory.add(out, n * k);
      if (out === 'cooked_brain') brains += n; else meals += n * k;
    }
    if (meals || brains) scene.toast(`You cook ${[meals ? G.util.plural(meals, 'portion') + ' of meat' : '', brains ? G.util.plural(brains, 'brain') : ''].filter(Boolean).join(' and ')}. You try not to think about it.`, 'warn');
  }
  return _use.call(this, d, scene);
};

// ---------------------------------------------------------------- eating it
const _consume = G.effects.consume;
G.effects.consume = function (p, it, scene) {
  const r = _consume.call(this, p, it, scene);
  if (!it || !it.human || p.kind !== 'player') return r;
  const w = G.world;
  (w.stats = w.stats || {}).humanEaten = (w.stats.humanEaten || 0) + 1;
  if (it.raw && Math.random() < (it.brain ? 0.4 : 0.6)) { G.effects.add(p, 'nausea', 900, 1.2); if (scene) scene.toast('Your stomach turns.', 'bad'); }
  if (it.brain) G.kuru.ate(p, scene);
  // anyone who sees it will never forget it
  if (scene) {
    const seen = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.sleeping && a.canSee(scene, p, 110));
    for (const a of seen) {
      a.st.fear = 100; G.social.addDisp(w, a.id, -40);
      a.say(G.rng.pick(['Oh my God. Oh my GOD.', 'Is that... are you EATING that?!', '*screams*', 'Get away from me!']), 3);
      if (a.def.combat === 'flee') a.startFlee(p);
    }
    if (seen.length) { w.rumor('Someone in town was seen eating human flesh. People are locking their doors.', scene.region); G.fame && G.fame.add(w, 'bad', 15); }
  }
  return r;
};

// ---------------------------------------------------------------- kuru
const S = (n, extra) => Object.assign({ id: 'kuru_' + n, kind: 'disease', bad: true, color: '#b08ac8', permanent: true }, extra);
Object.assign(G.EFFECTS, {
  kuru_1: S(1, { name: 'Kuru: Tremors', stats: { accuracy: -0.15 }, spread: 0.12, desc: 'Your hands will not stop shaking. It will get worse. There is no cure.' }),
  kuru_2: S(2, { name: 'Kuru: Staggering', stats: { accuracy: -0.25, charisma: -1, meleeDmg: -0.1 }, spread: 0.2, speed: 0.85, desc: 'You cannot walk a straight line. You laugh at nothing. There is no cure.' }),
  kuru_3: S(3, { name: 'Kuru: The Laughing', stats: { accuracy: -0.35, charisma: -4, meleeDmg: -0.2, staminaRegen: -0.3 }, spread: 0.3, speed: 0.7, desc: 'Fits of laughter you cannot stop. Words come out wrong. There is no cure.' }),
  kuru_4: S(4, { name: 'Kuru: Collapse', stats: { accuracy: -0.5, charisma: -6, meleeDmg: -0.35, staminaRegen: -0.6 }, spread: 0.4, speed: 0.5, desc: 'You can barely stand. Swallowing is hard. There is no cure.' }),
  kuru_5: S(5, { name: 'Kuru: Terminal', stats: { accuracy: -0.7, charisma: -8, meleeDmg: -0.5, staminaRegen: -0.9 }, spread: 0.5, speed: 0.35, desc: 'Your body is shutting down. This is how it ends.' }),
});
const NAMES = ['', 'tremors', 'staggering', 'uncontrollable laughter', 'collapse', 'the end'];
G.kuru = {
  BRAINS: KURU_BRAINS,
  now() { return G.effects.now(); },
  ate(p, scene) {
    const k = p.kuru = p.kuru || { brains: 0, stage: 0 };
    k.brains++;
    if (!k.onset && k.brains >= KURU_BRAINS) { k.onset = this.now() + INCUBATION; k.next = k.onset; }   // it has taken hold (you do not know it yet)
    else if (k.onset && k.next) k.next -= 360;   // feeding it brings the next stage sooner
    if (scene && k.brains === KURU_BRAINS - 1) scene.toast('Your hands feel strange for a moment. Probably nothing.', 'warn');
  },
  stage(p) { return (p.kuru && p.kuru.stage) || 0; },
  // the effect always shows the true stage (nothing can wash it off: a cure-all puts it straight back)
  sync(p) {
    const s = this.stage(p);
    for (let n = 1; n <= 5; n++) {
      const id = 'kuru_' + n, has = G.effects.has(p, id);
      if (n === s && !has) p.effects.push({ id, t: 1e12, dur: 1e12, power: 1 });
      if (n !== s && has) G.effects.remove(p, id);
    }
  },
  hourly(p, scene) {
    const k = p.kuru;
    if (!k || !k.onset || p.dead) return;
    const now = this.now();
    while (k.stage < 5 && now >= k.next) {
      k.stage++; k.next += STAGE_EVERY;
      if (scene) {
        scene.toast(k.stage === 1 ? 'Your hands are shaking. They will not stop.' : `It is getting worse: ${NAMES[k.stage]}.`, 'bad');
        G.world.log(k.stage === 1 ? 'You have kuru. There is no cure.' : `Kuru: ${NAMES[k.stage]}.`, 'bad');
      }
    }
    this.sync(p);
    // the last stage: the body gives out (nothing saves you from this, not even a second wind)
    if (k.stage >= 5) {
      const hours = (now - (k.next - STAGE_EVERY)) / 60;
      const maxNow = Math.max(1, Math.round(p.maxHp * Math.max(0, 1 - hours / 30)));
      p.hp = Math.min(p.hp, maxNow) - Math.max(2, Math.round(p.maxHp * 0.04));
      if (p.hp <= 0 && scene) { p.hp = 0; scene.toast('Kuru took you. There was never a cure.', 'bad'); G.world.log('You died of kuru.', 'bad'); p.die(null, scene); }
    }
  },
  // moment to moment: the shakes, the stagger, the laughing
  update(p, dt, scene) {
    const s = this.stage(p);
    if (!s || p.dead || p.vehicle) return;
    if (s >= 2 && p.moving && Math.random() < dt * (s * 0.6)) p.move(scene.map, G.rng.range(-1, 1) * s * 2.5, G.rng.range(-1, 1) * s * 1.5);   // stumbling
    if (s >= 2 && Math.random() < dt * (s - 1) * 0.02) {
      scene.floatText(p.x, p.y - 26, G.rng.pick(['*giggles*', 'hahaHAHA', '*laughs*', 'heh... heh...']), '#d8b0f0');
      G.audio.play('select');
      for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 90 && Math.random() < 0.5) a.say(G.rng.pick(['What is wrong with them?', 'Are you okay?', '...creepy.']), 2.5);
    }
    if (s >= 4 && p.moving && Math.random() < dt * 0.05 * (s - 3)) { p.stamina = 0; scene.toast('Your legs give out.', 'bad'); }
  },
};
// the shakes show in your aim: wobble the camera a hair
const _upd = G.Player.prototype.update;
G.Player.prototype.update = function (dt, scene) {
  const r = _upd.apply(this, arguments);
  if (scene && scene.map) G.kuru.update(this, dt, scene);
  const s = G.kuru.stage(this);
  if (s && Math.random() < dt * s) G.renderer.shake(0.2 * s);
  return r;
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && scene.player) G.kuru.hourly(scene.player, scene);
});
// no cure: nothing that removes effects can take kuru away for longer than a moment
const _rem = G.effects.remove;
G.effects.remove = function (p, id) {
  if (/^kuru_\d$/.test(id) && p && p.kuru && p.kuru.stage === +id.slice(5)) return;
  return _rem.call(this, p, id);
};
// it is in the body, so it is in the save
const PL = G.Player.prototype, _ser = PL.serialize, _from = G.Player.from;
PL.serialize = function () { const o = _ser.call(this); if (this.kuru) o.kuru = this.kuru; return o; };
G.Player.from = function (d) { const p = _from.call(this, d); if (d.kuru) { p.kuru = d.kuru; G.kuru.sync(p); } return p; };
// chatBCT and doctors know what it is, and that nothing can be done
G.kuru.lines = [
  'Kuru. A prion disease. You get it from eating human brain. There is no treatment. I am so sorry. Actually, no, what did you EXPECT.',
  'I looked it up three times hoping I was wrong. Kuru. No cure. Get your affairs in order.',
];
})();
// chatBCT has opinions
(() => {
const _pri = G.bct.priorities;
G.bct.priorities = function (scene) {
  const out = _pri.apply(this, arguments), s = G.kuru.stage(scene.player);
  if (s && Array.isArray(out)) out.unshift(G.kuru.lines[s >= 4 ? 1 : 0]);
  return out;
};
})();
