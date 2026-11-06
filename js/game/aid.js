'use strict';
// Wounds, first aid, and what people take.
//   Bleeding (a real status, for you, people and animals): blades, axes, gunshots and animal bites and claws
//   open wounds that bleed (harder the worse the hit, and wounds add up). It does not stop by itself: it
//   drains health until it kills, unless a bandage, a first aid kit, a medkit or stitches close it.
//   People who bleed look for help, desperately: their own pockets first, then the nearest shop that sells
//   bandages (they pay if they can; the shopkeeper may help anyway), then anyone nearby who has one; and
//   if there is nothing, they wander and beg for help until it is too late.
//   You can help: talk to someone who is bleeding (even in a panic, unless you are the one who hurt them)
//   and bandage them; patch up anyone hurt; treat a bleeding animal ([E] on it); treat someone unconscious.
//   They thank you and like you more. Helping someone you did not hurt (and not your own companion) is a
//   good deed for the hidden ledger (js/game/fate.js), as is stepping in when someone attacks an innocent.
//   Unconscious people (js/game/knockout.js): [E] to search their pockets or treat them, [G] to drag them.
//   What NPCs take (G.npcFx): food and water fill them, medicine heals them (painkillers are opioids:
//   enough of them stop your breathing; ibuprofen stops helping after a few and turns the stomach), alcohol
//   gets them drunk (and passed out), drugs get them high, with the same loads, tolerance and overdoses
//   as yours (G.DRUG_CLASSES). Your companion takes what you hand them in their item screen.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, PL = G.Player.prototype, AP = G.Actor.prototype, AN = G.Animal.prototype;
const U = G.ui, TAU = Math.PI * 2;
const now = () => (G.world ? G.world.day * 1440 + G.world.minutes : 0);
const kidOf = (a) => !!(a && a.def && a.def.kid);
const STOPS = G.medicine.STOPS_BLEEDING;
const HEALS = ['first_aid_kit', 'medkit', 'bandage', 'stitches', 'ibuprofen', 'painkillers', 'herb'];
const scenePlayer = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);

G.EFFECTS.bleeding = { id: 'bleeding', name: 'Bleeding', kind: 'status', bad: true, color: '#c01818', desc: 'An open wound. It will not stop by itself: a bandage or a first aid kit closes it. Until then it keeps draining your health.' };
if (G.fate) Object.assign(G.fate.GOOD, { heal_other: 5, heal_animal: 3, defend_other: 4 });

// ---------------------------------------------------------------- bleeding
const B = G.bleed = {
  rec(a) {
    if (a.kind === 'player') { const e = G.effects.get(a, 'bleeding'); return e ? { rate: e.power, by: e.by } : null; }
    if (a.kind === 'npc') return a.st && a.st.bleed;
    return a.bleed || null;
  },
  is(a) { const r = this.rec(a); return !!(r && r.rate > 0) && !a.dead; },
  start(scene, a, dmg, source) {
    if (!a || a.dead || kidOf(a) || a.remote || a.kind === 'vehicle' || !(dmg >= 2) || a.nonLethal || (a.kind === 'player' && this.playerOff)) return;
    const add = G.util.clamp(0.05 + dmg * 0.012, 0.05, 0.6), by = source === scene.player ? 'player' : null;
    if (a.kind === 'player') {
      const e = G.effects.get(a, 'bleeding');
      if (e) { e.power = Math.min(1.5, e.power + add); e.t = 1e9; }
      else { G.effects.add(a, 'bleeding', 1e9, add); if (scene.toast) scene.toast('You are bleeding. You need a bandage.', 'bad'); }
      return;
    }
    const holder = a.kind === 'npc' ? a.st : a;
    const r = holder.bleed || (holder.bleed = { rate: 0, by: null, acc: 0 });
    r.rate = Math.min(1.5, r.rate + add);
    if (by) r.by = by;
  },
  stop(a) {
    if (a.kind === 'player') G.effects.remove(a, 'bleeding');
    else if (a.kind === 'npc') { if (a.st) a.st.bleed = null; }
    else a.bleed = null;
    a.bleedT = 0;   // (the drips: js/game/gore2.js)
  },
  tick(scene, a, dt) {
    const r = this.rec(a);
    if (!r || !(r.rate > 0) || a.dead) return;
    const holder = a.kind === 'player' ? a : a.kind === 'npc' ? a.st.bleed : a.bleed;
    holder.bAcc = (holder.bAcc || 0) + r.rate * dt;
    if (G.gore.on() && !kidOf(a) && Math.random() < dt * (1.2 + r.rate * 4) * (a.moving ? 1.6 : 0.7)) G.gore.add(scene, { x: a.x + G.rng.range(-3, 3), y: a.y - 1 + G.rng.range(-1, 1), type: 'trail' });
    if (holder.bAcc < 1) return;
    const n = Math.floor(holder.bAcc); holder.bAcc -= n;
    a.hp -= n;
    if (a.kind === 'npc' && a.st) a.st.hp = a.hp;
    if (a.hp > 0) return;
    if (a.kind === 'player') { if (a.cheatDeath && a.cheatDeath(scene)) return; a.hp = 0; a.die({ kind: 'bleeding' }, scene); return; }
    a.hp = 0;
    const src = r.by === 'player' ? scene.player : { kind: 'bleeding', x: a.x, y: a.y };
    if (G.gore.onDeath) G.gore.onDeath(scene, a, src);
    a.die(src, scene);
  },
};
// what opens a wound: a blade, a gunshot, teeth and claws
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  const w = scene && scene.world, p = scene && scene.player;
  // stepping in when someone attacks an innocent (not you, not someone who is after you)
  if (p && source === p && target && target.kind === 'npc' && !target.dead && target.state === 'fight' && target.target && target.target !== p && target.target.kind === 'npc' && !target.target.dead && !target.target.st.hostile && !(target.target.st.hurtByPlayer > now() - 1440) && G.fate) G.fate.good('defend_other', { key: 'defend:' + target.id + ':' + Math.floor(now() / 30) });
  if (target && source === p && w) { if (target.kind === 'npc' && target.st) target.st.hurtByPlayer = now(); else if (target.kind === 'animal') target.hurtByPlayer = true; }
  const hp0 = target && target.hp;
  const r = _dmg.apply(this, arguments);
  if (target && !target.dead && scene && r > 0) {
    const kind = G.ko.kindOf(source, o);
    const sharp = kind === 'blade' || kind === 'chop' || kind === 'shot' || (source && source.kind === 'animal' && (source.def.dmg || 2) >= 4);
    if (sharp && !(o && o.noBleed)) B.start(scene, target, hp0 - target.hp, source);
  }
  return r;
};
// the wound keeps draining
const _pu = PL.update;
PL.update = function (dt, scene) { if (!this.dead) B.tick(scene, this, dt); return _pu.call(this, dt, scene); };
const _au = AN.update;
AN.update = function (dt, scene) { if (!this.dead && this.bleed) B.tick(scene, this, dt); return _au.apply(this, arguments); };
// a bandage on yourself
const E = G.effects, _consume = E.consume;
E.consume = function (p, it, scene) {
  const r = _consume.apply(this, arguments);
  const id = it && (it.id || Object.keys(G.ITEMS).find((k) => G.ITEMS[k] === it));
  if (p && p.kind === 'player' && STOPS.has(id) && G.effects.has(p, 'bleeding')) B.stop(p);
  return r;
};

// ---------------------------------------------------------------- people who bleed (or are badly hurt) look for help
// need: 'bleed' (urgent: something that closes the wound) or 'hurt' (calmer: anything that heals)
const HEAL_SET = new Set(['first_aid_kit', 'medkit', 'bandage', 'stitches', 'ibuprofen', 'painkillers']);
const fits = (id, need) => (need === 'bleed' ? STOPS.has(id) : HEAL_SET.has(id));
const shopsWithMeds = (scene, need = 'bleed') => {
  const w = scene.world, out = [];
  for (const sid in w.shops || {}) {
    const s = w.shops[sid], owner = scene.actors.find((a) => a.id === s.owner && !a.dead && !(a.st && a.st.ko));
    if (!owner || !G.shopSys.isOpen(sid, scene)) continue;
    const e = (s.stock || []).find((x) => fits(x[0], need) && x[1] > 0);
    if (e) out.push({ who: owner, shop: sid, item: e[0] });
  }
  return out;
};
const pocketMed = (st, need = 'bleed') => (st.inv || []).filter((x) => fits(x[0], need) && x[1] > 0).sort((a, b) => (G.item(b[0]).heal || 0) - (G.item(a[0]).heal || 0))[0];
// using a healing item on themselves: it closes a wound (if it can) and heals what it heals
const applyMed = (npc, id) => {
  const it = G.item(id);
  if (STOPS.has(id)) B.stop(npc);
  if (it.heal) { npc.hp = Math.min(npc.maxHp, npc.hp + it.heal); npc.st.hp = npc.hp; }
  if (it.drug && G.npcFx) { const D = G.npcFx.st(npc).drugs; D.load[it.drug.cls] = (D.load[it.drug.cls] || 0) + (it.drug.load || 0); }
  npc.say(STOPS.has(id) ? '*presses a bandage on the wound*' : /pill|ibuprofen|painkiller/.test(id) ? '*swallows a couple of pills*' : '*patches up*', 2.5);
};
const needOf = (npc) => (npc.st.bleed && npc.st.bleed.rate > 0 ? 'bleed' : npc.hp < (npc.maxHp || 30) * 0.5 ? 'hurt' : null);
const SEEK = {
  update(npc, dt, scene) {
    const st = npc.st, need = needOf(npc);
    if (!need) { npc.seek = null; return false; }
    // something in their own pockets: right away
    const own = pocketMed(st, need);
    if (own) { const id = own[0]; own[1]--; st.inv = st.inv.filter((x) => x[1] > 0); applyMed(npc, id); npc.seek = null; npc.seekT = 0; return false; }
    if (need === 'bleed' && npc.seekT > 0.6) npc.seekT = 0.6;   // (bleeding does not wait out a "hurt" pause)
    if ((npc.seekT = (npc.seekT || 0) - dt) > 0 && !npc.seek) return false;
    npc.seekT = need === 'bleed' ? 0.6 : 3;
    if (need === 'hurt' && (st.companion || npc.def.shop && npc.currentEntry(scene.world) && npc.currentEntry(scene.world).act === 'work' || scene.world.isNight() && (npc.currentEntry(scene.world) || {}).act === 'sleep')) return false;   // (calm: not mid-shift, not at night in bed, not your companion)
    if (npc.state !== 'schedule' || npc.talking || st.companion && scene.player.inventory && STOPS.size && [...STOPS].some((id) => scene.player.inventory.has(id))) return false;   // fighting, fleeing, talking (a companion asks you)
    if (!npc.seek) {
      const tried = npc.seekTried || (npc.seekTried = new Set());
      const opts = shopsWithMeds(scene, need).filter((o) => !tried.has(o.who.id)).map((o) => ({ who: o.who, shop: o.shop, item: o.item }));
      for (const a of scene.actors) if (a.kind === 'npc' && a !== npc && !a.dead && !(a.st && a.st.ko) && !tried.has(a.id) && a.state === 'schedule' && !a.def.kid && pocketMed(a.st, need) && a.distTo(npc) < 260) opts.push({ who: a, shop: null });
      opts.sort((x, y) => x.who.distTo(npc) - y.who.distTo(npc));
      npc.seek = opts[0] ? { who: opts[0].who, shop: opts[0].shop, item: opts[0].item, t: 0, need } : need === 'hurt' ? null : { who: null, t: 0, need };
      if (!npc.seek) { npc.seekT = 120; return false; }   // (hurt, nowhere to get anything: try again later)
      if (npc.seek.who && need === 'hurt') npc.say(G.rng.pick(['I need something for this...', 'Ugh. I should get this looked at.', 'I need a first aid kit.']), 3);
      else if (npc.seek.who) npc.say(G.rng.pick(['I\'m bleeding! I need a bandage!', 'Help! I need something for this... please!', 'Oh God, there\'s so much blood...']), 3);
    }
    return true;
  },
  move(npc, dt, scene) {
    const s = npc.seek, st = npc.st;
    s.t += dt;
    if (s.need !== 'hurt' && Math.random() < dt / (npc.hp < npc.maxHp * 0.3 ? 4 : 7)) npc.say(npc.hp < npc.maxHp * 0.3 ? G.rng.pick(['Help... me...', 'I can\'t... feel my...', 'Somebody...']) : G.rng.pick(['Help! I\'m bleeding!', 'Please, somebody, a bandage!', 'I need a doctor!']), 2.5);
    npc.baseUpdate(dt, scene.map);
    if (!s.who) {   // nobody to go to: wander, begging
      if (!s.goal || s.t > 6) { s.goal = scene.map.randomWalkableNear(Math.floor(npc.x / 16), Math.floor(npc.y / 16), 6); s.t = 0; }
      if (s.goal) npc.walkTo(s.goal, dt, scene, false);
      if (s.t > 5 && Math.random() < 0.05) npc.seek = null;   // look again
      return;
    }
    const who = s.who;
    if (who.dead || (who.st && who.st.ko) || s.t > 40) { (npc.seekTried || (npc.seekTried = new Set())).add(who.id); npc.seek = null; return; }
    if (npc.distTo(who) > 22) { npc.walkTo({ x: Math.floor(who.x / 16), y: Math.floor((who.y - 3) / 16) }, dt, scene, s.need !== 'hurt'); return; }
    npc.moving = false; npc.faceTowards(who);
    const tried = npc.seekTried || (npc.seekTried = new Set());
    tried.add(who.id);
    let ok = false;
    if (s.shop) {
      const price = Math.max(3, Math.round((G.item(s.item).value || 6) * 1.2)), sh = scene.world.shops[s.shop], e = sh && sh.stock.find((x) => x[0] === s.item && x[1] > 0);
      if (e && (st.gold || 0) >= price) { st.gold -= price; sh.gold = (sh.gold || 0) + price; e[1]--; ok = s.item; who.say(s.need === 'hurt' ? 'That will be $' + price + '. Feel better.' : 'Here. Press it down hard.', 3); }
      else if (e && s.need !== 'hurt' && Math.random() < 0.5) { e[1]--; ok = s.item; who.say('Forget the money. Take it!', 3); }
      else who.say('I\'m sorry... I can\'t just give it away.', 3);
    } else {
      const m = pocketMed(who.st, s.need);
      if (m && ((who.st.disp || 0) >= -20 || Math.random() < 0.6)) { m[1]--; who.st.inv = who.st.inv.filter((x) => x[1] > 0); ok = m[0]; who.say(G.rng.pick(['Here, use this!', 'Hold still, hold still...']), 3); }
      else who.say('I... I don\'t have anything!', 3);
    }
    npc.seek = null;
    if (ok) { applyMed(npc, ok); if (s.need !== 'hurt') npc.say(G.rng.pick(['Thank you... thank you.', 'Oh, thank God.']), 3); npc.seekTried = null; }
  },
};
const _nu = NP.update;
NP.update = function (dt, scene) {
  if (!this.dead) B.tick(scene, this, dt);
  if (this.dead) return _nu.call(this, dt, scene);
  if (this.st) G.npcFx.update(this, dt, scene);
  if (this.st && !this.st.ko && !this.remote && !kidOf(this) && (this.seek || needOf(this))) {
    if (SEEK.update(this, dt, scene) && this.seek && this.state === 'schedule' && !this.talking) { SEEK.move(this, dt, scene); return; }
  } else if (this.seek) this.seek = null;
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- treating someone
const myMeds = (p, bleeding) => (bleeding ? [...STOPS] : HEALS).filter((id) => G.ITEMS[id] && p.inventory.has(id));
const wronged = (npc) => !!(npc.st && npc.st.hurtByPlayer && npc.st.hurtByPlayer > now() - 1440 * 3);
G.aid = {
  bestMed(p, bleeding) { const m = myMeds(p, bleeding); return m.sort((a, b) => (G.item(b).heal || 0) - (G.item(a).heal || 0))[0] || null; },
  canHelp(scene, a) { return (B.is(a) || a.hp < (a.maxHp || 30) * 0.65) && !!this.bestMed(scene.player, B.is(a)); },
  treat(scene, a, id) {
    const p = scene.player, w = scene.world, it = G.item(id);
    if (!id || !p.inventory.has(id)) return false;
    p.inventory.remove(id, 1);
    const wasBleeding = B.is(a);
    if (STOPS.has(id)) B.stop(a);
    const heal = Math.round((it.heal || 10) * (a.kind === 'animal' ? 1.5 : 1));
    a.hp = Math.min(a.maxHp || a.hp + heal, a.hp + heal);
    if (a.kind === 'npc' && a.st) a.st.hp = a.hp;
    G.audio.play('pickup');
    if (scene.floatText) scene.floatText(a.x, a.y - 20, '+' + heal, '#7cd070');
    const good = a.kind === 'npc' ? !wronged(a) && !a.st.companion && !a.st.partner : !a.hurtByPlayer && !a.tame;
    if (a.kind === 'npc') {
      const st = a.st;
      if (!wronged(a)) { G.social.addDisp(w, a.id, wasBleeding ? 25 : 12); st.fear = 0; if (a.state === 'flee') a.state = 'schedule'; }
      a.seek = null; a.seekTried = null;
      a.say(wronged(a) ? '...Why? After what you did?' : G.rng.pick(wasBleeding ? ['You saved my life. I won\'t forget this.', 'Thank you... I thought I was going to die.', 'God bless you. Thank you.'] : ['Thanks. That feels better.', 'That is kind of you. Thank you.']), 4);
      scene.toast(`You ${STOPS.has(id) ? 'bandage' : 'treat'} ${a.displayName}.${wasBleeding && STOPS.has(id) ? ' The bleeding stops.' : ''}`, 'good');
    } else {
      a.hostile = false; if (a.state === 'attack' || a.state === 'hunt') { a.state = 'wander'; a.target = null; }
      a.calmT = 120;
      scene.toast(`You treat the ${a.def.name.toLowerCase()}'s wound.${wasBleeding && STOPS.has(id) ? ' The bleeding stops.' : ''}`, 'good');
    }
    if (good && G.fate) G.fate.good(a.kind === 'animal' ? 'heal_animal' : 'heal_other', { key: 'heal:' + (a.id || a.uid || (a.uid = G.util.uid('an'))) + ':' + w.day });
    G.events.emit('xp', 8, 'First aid');
    return true;
  },
};
// talking to someone who is bleeding: even in a panic (unless you did it)
const _talk = GS.talkTo;
GS.talkTo = function (npc) {
  if (npc && npc.st && npc.st.ko && !npc.dead) { G.aid.koMenu(this, npc); return; }
  if (npc && !npc.dead && B.is(npc) && !wronged(npc) && !(npc.st.bleed && npc.st.bleed.by === 'player') && !npc.isHostileToPlayer(this)) {
    if (npc.state === 'flee') { npc.state = 'schedule'; npc.target = null; }
    npc.st.fear = Math.min(npc.st.fear || 0, 40);   // someone offering help: they hold still for it
    npc.seek = null;
    this.openDialogue(npc);
    const top = G.scenes.top();
    if (top && top.runner) top.runner.go('_aid_bleed');
    return;
  }
  return _talk.apply(this, arguments);
};
G.DIALOGUE_NODES._aid_bleed = (r) => {
  const p = r.scene.player, med = G.aid.bestMed(p, true), npc = r.npc;
  return {
    text: npc.hp < npc.maxHp * 0.35 ? 'P-please... I\'m losing... so much blood... help me...' : G.rng.pick(['I\'m bleeding! Please, do you have a bandage? Anything!', 'Help me, please! It won\'t stop bleeding!']),
    choices: (med ? [{ text: `Hold still. Let me take care of that. (${G.item(med).name})`, next: null, do: () => { G.aid.treat(r.scene, npc, med); } }] : [{ text: '(You have nothing to stop the bleeding.) Hang on. Find a bandage, fast.', next: null }])
      .concat([{ text: 'I can\'t help you.', next: null }]),
  };
};
// someone hurt (not bleeding): offer to patch them up
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner;
  if (npc.remote || kidOf(npc) || B.is(npc) || !(npc.hp < (npc.maxHp || 30) * 0.65) || wronged(npc)) return [];
  const med = G.aid.bestMed(scene.player, false);
  return med ? [{ text: `You look hurt. Let me patch you up. (${G.item(med).name})`, next: null, do: () => { G.aid.treat(scene, npc, med); } }] : [];
});

// ---------------------------------------------------------------- unconscious people: search, treat, drag
const person = (npc) => {
  const st = npc.st;
  return { id: 'person_' + npc.id, kind: 'person', name: `${npc.displayName}'s pockets`, owner: null, items: st.inv || (st.inv = []), get gold() { return st.gold || 0; }, set gold(v) { st.gold = v; } };
};
G.aid.koMenu = function (scene, npc) {
  const p = scene.player, med = G.aid.bestMed(p, B.is(npc));
  const opts = [
    { label: 'Search their pockets', fn: () => {
      const seen = scene.witnessesOf(npc).filter((a) => !a.faction.outlaw);
      if (seen.length) { scene.reportCrime('theft', npc, 10); scene.toast('Someone saw you going through their pockets!', 'bad'); }
      const c = person(npc);
      G.scenes.push(new G.LootScene(scene, c));
    } },
  ];
  if ((B.is(npc) || npc.hp < (npc.maxHp || 30) * 0.65)) opts.push({ label: med ? `${B.is(npc) ? 'Stop the bleeding' : 'Treat their wounds'} (${G.item(med).name})` : 'Treat their wounds (you have nothing)', disabled: !med, fn: () => G.aid.treat(scene, npc, med) });
  if (p.inventory.has('naloxone') && G.aid.narcan) opts.push({ label: 'Give them naloxone (nasal spray)', fn: () => G.aid.narcan(scene, npc) });   // (js/game/benzo.js)
  opts.push({ label: p.draggingNpc === npc.id ? 'Let go of them' : 'Drag them  [G]', fn: () => G.aid.toggleDrag(scene, npc) });
  opts.push({ label: 'Leave them', fn: () => {} });
  G.scenes.push(new G.ChoiceScene(npc.displayName, `${npc.hp < (npc.maxHp || 30) * 0.3 ? 'Barely breathing.' : 'Out cold, but breathing.'}${B.is(npc) ? ' Bleeding.' : ''}`, opts));
};
G.aid.toggleDrag = function (scene, npc) {
  const p = scene.player;
  if (p.draggingNpc) { const a = scene.actors.find((x) => x.id === p.draggingNpc); if (a) { a._dragged = false; a.dragRot = null; } p.draggingNpc = null; scene.toast('You let go of them.'); return; }
  if (!npc || p.vehicle || p.swimming || p.dragging) return;
  p.draggingNpc = npc.id; npc._dragged = true; p.sitting = null;
  scene.toast(`You drag ${npc.displayName} by the arms.`, 'warn');
};
const _find = GS.findInteraction;
GS.findInteraction = function () {
  const t = _find.apply(this, arguments);
  if (t && t.type === 'npc' && t.ref && t.ref.st && t.ref.st.ko) t.label = `${t.ref.displayName} (unconscious)  ·  [G] Drag`;
  // a hurt animal you could treat
  const p = this.player;
  if ((!t || (t.type !== 'container' && t.type !== 'dispose')) && !p.vehicle) {
    const [fx, fy] = G.util.DIR_VEC[p.dir], px = p.x + fx * 10, py = p.y - 4 + fy * 10;
    const tD = t && t.type === 'npc' ? G.util.dist(px, py, t.ref.x, t.ref.y - 4) : 1e9;   // (a person right there comes first; the animal if it is closer)
    for (const a of this.actors) {
      if (a.kind !== 'animal' || a.dead || !(a.bleed && a.bleed.rate > 0 || a.hp < (a.maxHp || 10) * 0.5) || !G.aid.bestMed(p, !!a.bleed)) continue;
      const dA = G.util.dist(px, py, a.x, a.y - 4);
      if (dA < 26 && dA < tD) return { type: 'aid_animal', ref: a, label: `Treat the ${a.def.name.toLowerCase()}'s wound` };
    }
  }
  return t;
};
const _interact = GS.interact;
GS.interact = function () {
  const t = this.promptTarget;
  if (t && t.type === 'aid_animal') { G.aid.treat(this, t.ref, G.aid.bestMed(this.player, !!(t.ref.bleed && t.ref.bleed.rate > 0))); return; }
  return _interact.apply(this, arguments);
};
const _gu = GS.update;
GS.update = function (dt) {
  const I = G.input, t = this.promptTarget, p = this.player;
  if (p && I.wasPressed('drag')) {
    if (p.draggingNpc) { for (const k of G.input.bindings.drag || []) I.pressed.delete(k); G.aid.toggleDrag(this, null); }
    else if (t && t.type === 'npc' && t.ref.st && t.ref.st.ko && !p.dragging) { for (const k of G.input.bindings.drag || []) I.pressed.delete(k); G.aid.toggleDrag(this, t.ref); }
  }
  const r = _gu.call(this, dt);
  if (p && p.draggingNpc) {
    const a = this.actors.find((x) => x.id === p.draggingNpc);
    if (!a || a.dead) {   // they died while you dragged them: now it is a body
      if (a) a._dragged = false;
      const at = a || p.dragLast || p; p.draggingNpc = null;
      const c = !p.dead && !p.vehicle && Object.values(this.world.containers).filter((k) => k.kind === 'corpse' && k.map === this.map.id && Math.hypot(k.x - at.x, k.y - at.y) < 6).pop();
      if (c) p.dragging = c.id;
    } else if (p.dead || p.vehicle) { a._dragged = false; a.dragRot = null; p.draggingNpc = null; }
    else if (!a.st.ko) { a._dragged = false; a.dragRot = null; p.draggingNpc = null; this.toast(`${a.displayName} comes to and pulls free.`, 'warn'); }
    else {
      const [fx, fy] = G.util.DIR_VEC[p.dir], tx = p.x - fx * 12, ty = p.y - fy * 8 + 2, k = Math.min(1, dt * 8);
      const moved = Math.hypot(tx - a.x, ty - a.y);
      a.x += (tx - a.x) * k; a.y += (ty - a.y) * k; a.kbx = a.kby = 0;
      a.dragRot = Math.atan2(p.y - a.y, p.x - a.x) - Math.PI / 2; p.dragLast = { x: a.x, y: a.y };
      if (B.is(a) && moved > 0.5 && Math.random() < dt * 6) G.gore.add(this, { x: a.x, y: a.y - 2, type: 'trail' });
      // seen dragging someone unconscious
      if ((this.dragSeenT = (this.dragSeenT || 0) - dt) <= 0) {
        this.dragSeenT = 1.5;
        const seen = this.actors.filter((n) => n.kind === 'npc' && n !== a && !n.dead && !n.sleeping && !(n.st && n.st.ko) && !n.faction.outlaw && n.canSee(this, p, 120));
        if (seen.length && a.dragSeen !== true) { a.dragSeen = true; seen[0].say(G.rng.pick(['Hey! What are you doing with them?!', 'Somebody call the police! He\'s dragging someone!']), 3); this.reportCrime('assault', a); for (const n of seen) if (n.def.combat === 'flee') { n.st.fear = 100; n.startFlee(p); } }
      }
    }
  }
  return r;
};
// the body you drag: arms up over the head, pulled along by the wrists
const _ad = AP.draw;
AP.draw = function (ctx) {
  if (this.kind === 'npc' && this._dragged && this.st && this.st.ko && !this.dead && this.dragRot != null) {
    const hd = this.sheet && G.hd.get(this.sheet);
    ctx.save(); ctx.translate(this.x, this.y - 4); ctx.rotate(this.dragRot);
    if (hd) { const H = G.hd; ctx.drawImage(hd.img, H.COL.handsup * H.FW, 3 * H.FH, H.FW, H.FH, -H.WW / 2, -H.WH / 2, H.WW, H.WH); }
    ctx.restore();
    G.ko.drawWounds(ctx, this.st, { fx: this.x, fy: this.y - 4, rot: this.dragRot });
    return;
  }
  return _ad.call(this, ctx);
};

// ---------------------------------------------------------------- what NPCs take
const FX = G.npcFx = {
  st(npc) { const s = npc.st; s.fx = s.fx || []; s.drugs = s.drugs || { load: {}, tol: {}, addiction: {}, lastUse: {} }; s.alcohol = s.alcohol || 0; return s; },
  has(npc, id) { return !!(npc.st.fx && npc.st.fx.some((e) => e.id === id)); },
  add(npc, id, secs, power = 1) {
    if (!G.EFFECTS[id]) return;
    const s = this.st(npc), e = s.fx.find((x) => x.id === id);
    if (e) { e.t = Math.max(e.t, secs); e.power = Math.max(e.power, power); } else s.fx.push({ id, t: secs, power });
  },
  remove(npc, id) { if (npc.st.fx) npc.st.fx = npc.st.fx.filter((e) => e.id !== id); },
  risk(npc, cls) {
    const s = this.st(npc), c = G.DRUG_CLASSES[cls]; if (!c || !c.od) return 0;
    let v = s.drugs.load[cls] || 0;
    if (cls === 'opioid') v += s.alcohol * 0.7;
    if (cls === 'stimulant' && s.alcohol > 20) v *= 1.45;
    return v / (c.od + (cls === 'opioid' ? (s.drugs.tol.opioid || 0) * 0.4 : cls === 'stimulant' ? (s.drugs.tol.stimulant || 0) * 0.3 : 0));
  },
  intox(npc) { let lv = null; for (const l of G.INTOX_LEVELS) if ((npc.st.alcohol || 0) >= l.min) lv = l; return lv; },
  // they take it: returns what they say
  use(scene, npc, id) {
    const it = G.item(id), s = this.st(npc), w = scene.world;
    const e = (s.inv || []).find((x) => x[0] === id && x[1] > 0);
    if (!e || it.type !== 'consumable') return null;
    e[1]--; s.inv = s.inv.filter((x) => x[1] > 0);
    let say = null;
    // medicine: heals, within reason
    if (it.heal) {
      let heal = it.heal;
      if (id === 'ibuprofen') {
        const doses = (s.ibu = (s.ibu || []).filter((t) => t > now() - 360)); doses.push(now());
        if (doses.length > 4) { heal = 0; this.add(npc, 'nausea', 60); say = 'Ugh. My stomach... that was too many.'; }
      }
      if (heal) { npc.hp = Math.min(npc.maxHp, npc.hp + heal); s.hp = npc.hp; if (scene.floatText) scene.floatText(npc.x, npc.y - 20, '+' + heal, '#7cd070'); }
    }
    if (STOPS.has(id) && B.is(npc)) { B.stop(npc); say = say || 'The bleeding stopped. Thank you.'; }
    // food and drink
    const [f, d] = G.nutrition ? G.nutrition(it) : [0, 0];
    if (f) s.hunger = G.util.clamp((s.hunger || 0) - f, 0, 100);
    if (d) s.thirst = G.util.clamp((s.thirst || 0) - d, 0, 100);
    // alcohol
    if (it.alcohol) { s.alcohol += it.alcohol; s.drugs.lastUse.alcohol = now(); }
    if (it.antidote) {
      s.drugs.load[it.antidote] = 0;
      for (const od of ['resp_depression', 'overdose']) this.remove(npc, od);
      if (s.ko && s.ko.reason === 'overdose') { s.ko.until = now(); say = '*GASP* ...what... what happened?'; }
    }
    for (const c of it.cures || []) this.remove(npc, c);
    const tol = it.drug ? Math.max(0.25, 1 - (s.drugs.tol[it.drug.cls] || 0) / 120) : 1;
    for (const fid in it.effects || {}) {
      const v = it.effects[fid], secs = Array.isArray(v) ? v[0] : v, power = Array.isArray(v) ? v[1] : 1;
      const good = G.EFFECTS[fid] && G.EFFECTS[fid].kind === 'drug' && !G.EFFECTS[fid].bad;
      this.add(npc, fid, good ? secs * tol : secs, power);
    }
    if (it.drug) {
      const dd = it.drug, D = s.drugs;
      D.load[dd.cls] = (D.load[dd.cls] || 0) + (dd.load || 0);
      if (dd.addict) D.addiction[dd.cls] = Math.min(100, (D.addiction[dd.cls] || 0) + dd.addict);
      if (dd.tol) D.tol[dd.cls] = Math.min(90, (D.tol[dd.cls] || 0) + dd.tol);
      D.lastUse[dd.cls] = now();
    }
    if (!say) say = it.alcohol ? G.rng.pick(['*drinks* Ahh.', 'Cheers.', '*takes a long pull*']) : it.drug ? G.rng.pick(['Okay... here goes.', '*takes it*', 'Mmh.']) : it.heal ? G.rng.pick(['That helps. Thanks.', '*swallows it*']) : (f || d) ? G.rng.pick([`*${d && !f ? 'drinks' : 'eats'} the ${it.name.toLowerCase()}*`, 'Thanks, I needed that.']) : '*takes it*';
    npc.say(say, 3);
    if (it.illegal && w) { const seen = scene.witnessesOf(npc).filter((a) => !a.faction.outlaw && a !== npc); if (seen.length) { npc.say(say, 3); } }
    return say;
  },
  // every frame: decay, effects, overdoses, passing out
  update(npc, dt0, scene) {
    const s = npc.st, dt = G.clock ? G.clock.of(dt0) : dt0;
    if (!s.fx && !s.alcohol && !(s.drugs && Object.values(s.drugs.load).some((v) => v > 0))) return;
    this.st(npc);
    if (s.alcohol > 0) s.alcohol = Math.max(0, s.alcohol - G.ALCOHOL_DECAY * dt);
    for (const cls in s.drugs.load) if (s.drugs.load[cls] > 0) s.drugs.load[cls] = Math.max(0, s.drugs.load[cls] - ((G.DRUG_CLASSES[cls] || {}).decay || 0.3) * dt);
    if (!s.ko && !npc.dead) {
      for (const cls of ['opioid', 'stimulant', 'cannabis']) {
        const c = G.DRUG_CLASSES[cls];
        if (this.risk(npc, cls) >= 1 && !this.has(npc, c.odEffect)) {
          this.add(npc, c.odEffect, cls === 'cannabis' ? 60 : cls === 'opioid' ? 30 : 12);
          if (cls === 'cannabis') npc.say('Oh no. Oh no no. The room is spinning.', 3);
          else { s.drugs.load[cls] *= 0.7; npc.say(cls === 'opioid' ? '...can\'t... breathe...' : 'My chest... my heart...!', 3); G.ko.passOut(scene, npc, 120 + Math.random() * 240, 'overdose'); if (scene.toast && npc.st.companion) scene.toast(`${npc.displayName} is overdosing!${cls === 'opioid' ? ' Naloxone, now!' : ''}`, 'bad'); }
        }
      }
      if (s.alcohol >= 100) { npc.say('*collapses*', 2); G.ko.passOut(scene, npc, 180 + Math.random() * 180, 'alcohol'); s.alcohol = 70; }
    }
    let dmg = 0;
    for (const e of s.fx) { const d = G.EFFECTS[e.id]; e.t -= dt; if (d && d.dps) dmg += d.dps * e.power * dt; if (d && d.regen && !npc.dead) npc.hp = Math.min(npc.maxHp, npc.hp + d.regen * dt * 0.5); if (d && d.vomit && Math.random() < dt / 9 && !s.ko) { npc.say('*throws up*', 2); if (G.gore.on()) G.gore.add(scene, { x: npc.x + 4, y: npc.y, r: 3, type: 'splat' }); } }
    s.fx = s.fx.filter((e) => e.t > 0);
    if (dmg > 0 && !npc.dead) {
      npc.fxAcc = (npc.fxAcc || 0) + dmg;
      if (npc.fxAcc >= 1) { const n = Math.floor(npc.fxAcc); npc.fxAcc -= n; npc.hp -= n; s.hp = npc.hp; if (npc.hp <= 0) { npc.hp = 0; npc.die({ kind: 'poison', x: npc.x, y: npc.y }, scene); return; } }
    }
    // how it shows: slower or faster, slurring, giggling, swaying
    if (!s.ko && !npc.dead && !npc.talking) {
      const lv = this.intox(npc), high = s.fx.some((e) => G.EFFECTS[e.id] && G.EFFECTS[e.id].kind === 'drug' && !G.EFFECTS[e.id].bad);
      if (lv && Math.random() < dt / 14) npc.say(G.rng.pick(lv.name === 'Tipsy' ? ['Heh. I feel good.', 'One more?'] : ['Whooo... the ground is... moving.', 'You\'re my... my best friend, y\'know that?', '*hic*', 'I\'m not drunk. You\'re drunk.']), 2.5);
      else if (high && Math.random() < dt / 16) npc.say(G.rng.pick(['Whoa... look at your face, man.', 'Hehehe...', 'Everything is so... loud.', 'I can hear colors.', 'Do you have any snacks?']), 2.5);
      let m = 1;
      for (const e of s.fx) { const d = G.EFFECTS[e.id]; if (d && d.speed) m *= d.speed; }
      if (lv && lv.speed) m *= lv.speed;
      if (npc._fxBase == null) npc._fxBase = npc.walkSpeed;
      npc.walkSpeed = npc._fxBase * m;
      npc.fxSway = lv ? Math.min(1, (s.alcohol - 20) / 60) : high ? 0.3 : 0;
    } else npc.fxSway = 0;
  },
};
// drunk or high: a little sway as they stand and walk
const _nd = NP.draw;
NP.draw = function (ctx) {
  if (!(this.fxSway > 0) || this.dead || this.downT > 0.35 || (this.st && this.st.ko)) return _nd.call(this, ctx);
  const a = Math.sin(G.loop.time * 2.2 + (this.id || '').length) * 0.09 * this.fxSway;
  ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a); ctx.translate(-this.x, -this.y); const r = _nd.call(this, ctx); ctx.restore(); return r;
};
// passing out (overdose, drink): the unconscious state, without anyone having done it
G.ko.passOut = function (scene, npc, minutes, reason) {
  const st = npc.st;
  st.ko = { until: now() + minutes, sev: 0.2, head: 0, down: 0, by: null, reason, map: scene.map.id, x: npc.x, y: npc.y, at: now() };
  npc.downT = 1e9; npc.downDir = Math.random() < 0.5 ? 1 : -1;
  if (npc.endFight) npc.endFight();
  npc.state = 'schedule'; npc.target = null; npc.path = null; npc.moving = false; npc.talking = false; npc.seek = null;
};
const _wake = G.ko.wake;
G.ko.wake = function (scene, a) {
  const ko = a.st.ko;
  if (ko && ko.reason) { a.st.ko = null; a.downT = 0.35; a.state = 'schedule'; a.koReact = { kind: 'confused', t: 0 }; a.dazeT = 20; a.say(ko.reason === 'alcohol' ? 'Ugh... my head. What... what time is it?' : 'Wh... what happened? Why is everyone...', 4); return; }
  return _wake.apply(this, arguments);
};

// ---------------------------------------------------------------- your companion takes what you give them
if (G.CompanionTradeScene) {
  const CT = G.CompanionTradeScene.prototype, _cu = CT.update, _cr = CT.render;
  CT.useSel = function () {
    const e = this.side === 0 && this.entries()[this.sel];
    if (!e || !e.id) return;
    const it = G.item(e.id);
    if (it.type !== 'consumable') { this.game.toast(`${it.name} is not something to take.`); return; }
    this.st.inv = this.c.items.filter((x) => x[1] > 0); this.c.items = this.st.inv;
    const said = G.npcFx.use(this.game, this.npc, e.id);
    this.c.items = this.st.inv;
    if (said) { G.audio.play('eat'); this.game.toast(`${this.game.world.displayName(this.npc.id)}: "${said}"`, 'good'); }
  };
  CT.update = function () { if (G.input.pressed.has('KeyU') && this.side === 0) { this.useSel(); return; } return _cu.call(this); };
  CT.render = function (ctx) {
    _cr.call(this, ctx);
    const R = G.renderer, W = 420, H = 230, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    const sel = this.side === 0 && this.entries()[this.sel], it = sel && sel.id && G.item(sel.id);
    const b = U.button(ctx, x + W / 2 + 50, y + H - 24, 70, 18, 'Use', { disabled: !(it && it.type === 'consumable') });
    if (b.clicked && it && it.type === 'consumable') this.useSel();
  };
}
})();
