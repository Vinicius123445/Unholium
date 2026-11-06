'use strict';
// More gore (all of it follows Settings > Gore & Blood; children are never shown with any of it).
//   Burns: people who die in a fire or an explosion are left charred: blackened skin, raw red burns, a
//   wisp of smoke for a while. Their clothes burn with them.
//   Bleeding: anyone badly hurt drips blood as they walk; heavy hits spray more.
//   Dismemberment: with the right tool (a machete, an axe, a sledgehammer, or slowly with a big knife) you
//   can cut up a body to get rid of it: open the body ([E]) and press [X]. It takes an hour (two with a
//   knife). The parts go into your inventory, the body is gone from the ground (whatever was on it stays
//   there in a bag), and you are covered in blood until you shower: people who see you like that are
//   horrified, and the police will want a word.
(() => {
const pick = (a) => G.rng.pick(a);
const isKid = (a) => !!(a && a.def && a.def.kid);
const TOOLS = [['machete', 1], ['woodaxe', 1], ['iron_sword', 1], ['steel_sword', 1], ['sledgehammer', 1], ['hunting_knife', 2], ['combat_knife', 2], ['kitchen_knife', 2]];
Object.assign(G.ITEMS, {
  body_head: { id: 'body_head', name: 'Severed Head', type: 'misc', icon: 'meat', value: 0, stack: 2, desc: 'You know what this is. Get rid of it.' },
  body_torso: { id: 'body_torso', name: 'Torso', type: 'misc', icon: 'meat', value: 0, stack: 2, desc: 'Heavy. Wet. Evidence.' },
  body_arm: { id: 'body_arm', name: 'Severed Arm', type: 'misc', icon: 'meat', value: 0, stack: 4, desc: 'Evidence. Dump it in the water or a dumpster.' },
  body_leg: { id: 'body_leg', name: 'Severed Leg', type: 'misc', icon: 'meat', value: 0, stack: 4, desc: 'Evidence. Dump it in the water or a dumpster.' },
});
G.EFFECTS.blood_soaked = { id: 'blood_soaked', name: 'Covered in Blood', kind: 'status', bad: true, color: '#b01818', stats: { charisma: -4 }, desc: 'You are drenched in someone else\'s blood. Anyone who sees you will panic or call the police. Take a shower.' };

// ---------------------------------------------------------------- burns
const NP = G.NPC.prototype, _die = NP.die;
NP.die = function (source, scene) { this.diedBy = source && (source.kind === 'fire' ? 'fire' : this.blasted > G.loop.time ? 'blast' : null); return _die.call(this, source, scene); };
const C = G.containers, _corpse = C.createCorpse, _draw = C.draw;
C.createCorpse = function (world, npc, mapId) {
  const before = new Set(Object.keys(world.containers));
  _corpse.call(this, world, npc, mapId);
  const id = Object.keys(world.containers).find((k) => !before.has(k)), c = id && world.containers[id];
  if (!c) return;
  c.kid = isKid(npc);
  if (npc.diedBy === 'fire' || npc.diedBy === 'blast') {
    c.burnt = true; c.burnDay = world.day; c.burnT = G.loop.time;
    if (c.clothes) { for (const k of ['top', 'bottom']) { const cid = c.clothes[k]; const e = cid && c.items.find((x) => x[0] === cid); if (e) e[1] = 0; } c.items = c.items.filter((e) => e[1] > 0); }
  }
};
C.draw = function (ctx, c) {
  if (c.kind !== 'corpse' || !c.burnt) return _draw.call(this, ctx, c);
  ctx.save(); ctx.filter = 'brightness(0.32) sepia(0.5) saturate(1.4)'; _draw.call(this, ctx, c); ctx.restore();
  if (!G.gore.on() || c.kid) return;
  // raw burns and charring across the body (it lies on its side: a long shape)
  const r = new G.RNG(c.id);
  for (let i = 0; i < 9; i++) {
    const x = Math.round(c.x - 8 + r.range(0, 16)), y = Math.round(c.y - 9 + r.range(0, 6));
    ctx.fillStyle = r.pick(['#8a1010', '#b02818', '#5a0606', '#d84a2a', '#1a0e08']);
    ctx.fillRect(x, y, r.int(1, 3), r.int(1, 2));
  }
  ctx.fillStyle = 'rgba(20,10,6,0.6)'; ctx.fillRect(Math.round(c.x - 9), Math.round(c.y - 7), 18, 1);
  if (G.world && G.world.day - (c.burnDay || 0) < 1 && Math.random() < 0.3) { ctx.fillStyle = 'rgba(80,76,72,0.35)'; ctx.beginPath(); ctx.arc(c.x + r.range(-4, 4), c.y - 12 - (G.loop.time * 9 % 14), 2.5, 0, Math.PI * 2); ctx.fill(); }
};
// explosions mark who was caught in them
if (G.explosions) {
  const _blast = G.explosions.blast;
  G.explosions.blast = function (scene, x, y, r) { for (const a of scene.actors) if (!a.dead && Math.hypot(a.x - x, a.y - y) < r) a.blasted = G.loop.time + 1.5; return _blast.apply(this, arguments); };
}

// ---------------------------------------------------------------- bleeding
const drip = (scene, a) => { if (G.gore.on() && !isKid(a)) G.gore.add(scene, { x: a.x + G.rng.range(-3, 3), y: a.y - 1 + G.rng.range(-1, 1), type: 'trail' }); };
// Bleeding comes from wounds (a blade, a bullet, a heavy blow), not from being low on health: poison, hunger
// or an overdose hurt you without opening you up. A wound bleeds for a while (longer the worse it was) and
// stops by itself, sooner with a bandage or a first aid kit.
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  const r = _dmg.apply(this, arguments);
  if (target && !target.dead && amount >= 4 && source && source.kind !== 'fire' && !(o && o.noBleed)) target.bleedT = Math.max(target.bleedT || 0, Math.min(90, amount * 3));
  return r;
};
const bleeding = (a, dt) => { if (a.bleedT > 0) a.bleedT -= dt; return a.bleedT > 0; };
const _nu = NP.update;
NP.update = function (dt, scene) {
  if (!this.dead && bleeding(this, dt) && Math.random() < dt * (this.moving ? 2.5 : 0.6)) drip(scene, this);
  return _nu.call(this, dt, scene);
};
const PL = G.Player.prototype, _pu = PL.update, _pdraw = PL.draw;
PL.update = function (dt, scene) {
  if (!this.dead && bleeding(this, dt) && Math.random() < dt * (this.moving ? 2 : 0.5)) drip(scene, this);
  return _pu.call(this, dt, scene);
};
// soaked in blood: red over your clothes
PL.draw = function (ctx) {
  _pdraw.call(this, ctx);
  if (!(this.bloody > 0) || !G.gore.on() || this.swimming) return;
  if (this._hdFrame) return;   // HD people wear the stains on the body itself (js/game/hdchars.js); these boxes floated off it
  const r = new G.RNG('blood' + Math.floor(this.bloodSeed || 1));
  ctx.fillStyle = 'rgba(140,10,10,0.85)';
  for (let i = 0; i < 10; i++) ctx.fillRect(Math.round(this.x - 5 + r.range(0, 10)), Math.round(this.y - 15 + r.range(0, 14)), r.int(1, 3), r.int(1, 2));
};
const _hit = G.gore.onHit;
G.gore.onHit = function (scene, target, source, dmg, bullet) {
  _hit.apply(this, arguments);
  if (!this.on() || isKid(target) || !(target.human || target.kind === 'player')) return;
  if (dmg >= 14 || (bullet && dmg >= 10)) for (let i = 0; i < 3; i++) this.add(scene, { x: target.x + G.rng.range(-14, 14), y: target.y + G.rng.range(-6, 6), r: G.rng.range(2, 4), type: 'splat' });   // a heavy hit sprays
};

// ---------------------------------------------------------------- dismemberment
G.dismember = {
  tool(p) { for (const [id, hours] of TOOLS) if (p.inventory.has(id) || p.equip.weapon === id) return { id, hours }; return null; },
  can(scene, c) { return c && c.kind === 'corpse' && !c.kid && !!this.tool(scene.player); },
  run(scene, c) {
    const p = scene.player, w = scene.world, t = this.tool(p);
    if (c.kid) { scene.toast('No.', 'bad'); return; }
    if (!t) { scene.toast('You need a machete, an axe or a big knife for that.', 'bad'); return; }
    const seen = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.sleeping && !a.faction.outlaw && a.canSee(scene, p, 120));
    G.scenes.push(new G.FadeScene(() => {
      scene.passTime(t.hours, false);
      p.stamina = 0;
      const parts = [['body_head', 1], ['body_brain', 1], ['body_torso', 1], ['body_arm', 2], ['body_leg', 2]];
      const left = [];
      for (const [id, n] of parts) { const extra = p.inventory.add(id, n); if (extra) left.push([id, extra]); }
      const rest = c.items.filter((e) => e[1] > 0).concat(left);
      if (rest.length || c.gold) { const bag = G.containers.createBag(w, scene.map.id, c.x, c.y, rest); bag.gold = c.gold || 0; bag.name = 'Belongings'; }
      delete w.containers[c.id];
      if (p.dragging === c.id) p.dragging = null;
      if (G.gore.on()) { G.gore.add(scene, { x: c.x, y: c.y - 3, r: 4, grow: 18, born: G.loop.time, type: 'pool' }); for (let i = 0; i < 12; i++) G.gore.add(scene, { x: c.x + G.rng.range(-16, 16), y: c.y + G.rng.range(-8, 8), r: G.rng.range(1, 2.5), type: G.rng.chance(0.5) ? 'gib' : 'splat' }); }
      p.bloody = 1; p.bloodSeed = G.rng.int(1, 1e6); G.effects.add(p, 'blood_soaked', 60 * 60 * 6);
      scene.refreshContainers();
      if (c.victim && w.dead[c.victim]) {
        const rec = w.dead[c.victim];
        rec.disposed = 'dismembered';
        if (!seen.length) rec.discovered = true;
        else { if (!rec.witnessed) { rec.witnessed = true; w.commitCrime('murder', scene.region, true, c.victim); } if (G.law && G.law.makeWanted) G.law.makeWanted(w, 'dismembering a body'); }   // (seen doing it: a brutal crime)
      }
      w.log(`You cut up ${c.victim ? w.displayName(c.victim) + "'s" : 'the'} body with the ${G.item(t.id).name.toLowerCase()}. You are covered in blood.`, 'bad');
      if (seen.length) { scene.toast('Someone saw what you did!', 'bad'); for (const a of seen) { a.st.fear = 100; if (a.def.combat === 'flee') a.startFlee(p); else if (a.def.combat === 'guard') a.startFight(p, scene); } }
      else scene.toast('It is done. Get rid of the parts. And wash.', 'warn');
    }, 2.5));
  },
};
// in the body's loot window: [X] to cut it up
const LS = G.LootScene.prototype, _lu = LS.update, _lr = LS.render;
LS.update = function () {
  if (this.c.kind === 'corpse' && G.input.pressed.has('KeyX') && G.dismember.can(this.game, this.c)) { const c = this.c; this.close(); G.dismember.run(this.game, c); return; }
  return _lu.call(this);
};
LS.render = function (ctx) {
  _lr.call(this, ctx);
  if (this.c.kind !== 'corpse' || this.c.kid) return;
  const R = G.renderer, U = G.ui, t = G.dismember.tool(this.game.player), H = 230, y = (R.uiH - H) / 2;
  U.text(ctx, t ? `[X] Cut up the body (${G.item(t.id).name}, ${t.hours} hour${t.hours > 1 ? 's' : ''})` : 'You could cut up the body with a machete, an axe or a big knife.', R.uiW / 2, y + H + 4, { size: 8, align: 'center', color: t ? '#ff8a7a' : U.colors.dim });
};
// covered in blood: people react
const _nu2 = NP.update;
NP.update = function (dt, scene) {
  const p = scene.player;
  if (p.bloody > 0 && !this.dead && !this.talking && this.state === 'schedule' && (this.bloodT = (this.bloodT || 0) - dt) <= 0) {
    this.bloodT = 1;
    if (!this.def.kid && !this.faction.outlaw && this.canSee(scene, p, 80)) {
      this.bloodT = 30;
      if (this.def.combat === 'guard') { this.say('Freeze! Is that BLOOD?!', 3); scene.reportCrime('assault', this); this.state = 'arrest'; }
      else { this.say(pick(['Oh my God... is that blood?!', 'Stay away from me!', 'What did you DO?!']), 3); this.st.fear = Math.max(this.st.fear || 0, 80); if (this.def.combat === 'flee') this.startFlee(p); }
    }
  }
  return _nu2.call(this, dt, scene);
};
// a shower (or a swim) washes it off
const _use = G.usables.use;
G.usables.use = function (d, scene) { const r = _use.call(this, d, scene); if (d.def.interact === 'shower') G.effects.remove(scene.player, 'blood_soaked'); return r; };
const _pu2 = PL.update;
PL.update = function (dt, scene) { if (this.swimming && this.bloody > 0.08 && !this._swamClean) { this._swamClean = true; if (scene.toast) scene.toast('The water rinses most of the blood off you. The stains in your clothes stay.', 'info'); } else if (!this.swimming) this._swamClean = false; /* (the rinsing itself is gradual: js/game/knockout.js) */ return _pu2.call(this, dt, scene); };
})();
// while dragging a body: [X] cuts it up right there (with the right tool), and it is offered as a way to get
// rid of it when there is no water to dump it in or soft ground to bury it
(() => {
const B = G.bodies, _disp = B.disposal, _dispose = B.dispose;
B.disposal = function (scene) {
  const d = _disp.call(this, scene), c = this.dragged(scene);
  if (d || !c || c.kid) return d;
  const t = G.dismember.tool(scene.player);
  return { how: 'dismember', label: t ? `Cut up the body (${G.item(t.id).name}, ${t.hours}h)  ·  or [X] anywhere` : 'Cut up the body (needs a machete, an axe or a big knife)' };
};
// where a grave (or the water) is offered, cutting the body up is offered right alongside it (forest
// floors, fields, yards: anywhere you could bury someone)
const _disp2 = B.disposal;
B.disposal = function (scene) {
  const d = _disp2.call(this, scene), c = this.dragged(scene);
  if (!d || d.how === 'dismember' || !c || c.kid) return d;
  const t = G.dismember.tool(scene.player);
  return Object.assign({}, d, { label: `${d.label}  ·  or cut it up${t ? ` ([X], ${G.item(t.id).name})` : ' (needs a blade)'}`, orCut: true });
};
B.dispose = function (scene, how) {
  if (how === 'bury' && !scene.disposeChosen) {
    const c = this.dragged(scene);
    if (c && !c.kid) {
      const t = G.dismember.tool(scene.player), shovel = scene.player.inventory.has('shovel');
      G.scenes.push(new G.ChoiceScene('The body', 'What do you do with it?', [
        { label: shovel ? 'Bury it (1 hour)' : 'Bury it (you need a shovel)', disabled: !shovel, fn: () => { scene.disposeChosen = true; try { B.dispose(scene, 'bury'); } finally { scene.disposeChosen = false; } } },
        { label: t ? `Cut it up (${G.item(t.id).name}, ${t.hours}h)` : 'Cut it up (you need a machete, an axe or a big knife)', disabled: !t, fn: () => { G.dismember.run(scene, c); } },
        { label: 'Leave it', fn: () => {} },
      ]));
      return;
    }
  }
  if (how !== 'dismember') return _dispose.call(this, scene, how);
  const c = this.dragged(scene);
  if (c && G.dismember.can(scene, c)) G.dismember.run(scene, c); else scene.toast('You need a machete, an axe or a big knife for that.', 'bad');
};
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  const p = this.player;
  if (p && p.dragging && G.scenes.top() === this && G.input.pressed.has('KeyX')) {
    const c = B.dragged(this);
    if (c && !c.kid) { if (G.dismember.can(this, c)) G.dismember.run(this, c); else this.toast('You need a machete, an axe or a big knife to cut it up.', 'bad'); }
  }
  return r;
};
const _toggle = B.toggle;
B.toggle = function (scene) { const was = scene.player.dragging; _toggle.call(this, scene); if (!was && scene.player.dragging && G.dismember.tool(scene.player)) scene.toast('[X] Cut up the body', 'warn'); };
})();
