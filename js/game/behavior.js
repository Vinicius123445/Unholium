'use strict';
// How people act around danger, around you, and around each other.
//   Cars: people on foot step out of the way of a car coming at them (and drivers already brake for them).
//   Gunshots: anyone who hears shots nearby panics: most run, some hit the ground and cover their heads,
//   fighters get ready. Cops come.
//   Allies: friends (Good Friend and up), companions and people from a faction that likes you jump in
//   when someone attacks you. People who cannot fight shout for help and call the police instead.
//   First aid: hurt people use bandages, first aid kits and painkillers from their pockets.
//   Supplies: people keep a little food and water on them, buying it when they can (scavenging when they
//   cannot), so they are not caught short.
//   Personal space: hang around someone for too long and they get uneasy: how long they put up with you
//   depends on how much they like you and on your fame. Strangers ask what you want, then tell you to
//   leave, then walk off or call the police.
//   Fame: what you do builds a name (good and bad); people who saw you do something remember it and
//   bring it up (js/game/behavior.js: G.fame, st.memory).
//   Concern: people who care about you text you when you get hurt, arrested, or disappear for days.
(() => {
const pick = (a) => G.rng.pick(a);
const NP = G.NPC.prototype, _nu = NP.update;
const scenePlayer = () => { const s = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene); return s; };

// ---------------------------------------------------------------- fame and memory
G.fame = {
  get(w) { return (w.fame = w.fame || { good: 0, bad: 0 }); },
  add(w, kind, n) { const f = this.get(w); f[kind] = G.util.clamp(f[kind] + n, 0, 1000); },
  // -100..100: how the town thinks of you overall
  score(w) { const f = this.get(w); return G.util.clamp(Math.round((f.good - f.bad) / 5), -100, 100); },
  level(w) { const f = this.get(w), t = f.good + f.bad; return t >= 400 ? 3 : t >= 150 ? 2 : t >= 40 ? 1 : 0; },
  title(w) {
    const s = this.score(w), l = this.level(w);
    if (!l) return 'Nobody';
    if (s <= -40) return ['', 'Troublemaker', 'Feared', 'Infamous'][l];
    if (s >= 40) return ['', 'Decent Sort', 'Well Liked', 'Local Hero'][l];
    return ['', 'Known Face', 'Talk of the Town', 'Famous'][l];
  },
  // someone saw it: they remember it
  remember(w, id, what, day) {
    const st = w.npcs[id]; if (!st) return;
    st.memory = (st.memory || []).filter((m) => m.what !== what).concat([{ what, day: day == null ? w.day : day }]).slice(-6);
  },
  LINES: {
    assault: ['I saw what you did to that person. Stay away from me.', 'You are the one who beat someone up.'],
    murder: ['I know what you did. I saw it.', 'You... you killed someone. I saw you.'],
    theft: ['Watch your hands around my stuff. I have seen you steal.', 'Thief.'],
    arson: ['You set that fire. Do not think I forgot.'],
    gunfire: ['You were the one shooting in the street.'],
    drugs: ['You were getting high right out in the open.'],
    trespass: ['You were sneaking around where you should not be.'],
    minors: ['I saw what you did with that kid. Get away from me.'],
    helped: ['You helped me out back then. I will not forget it.'],
    rescued: ['You saved my life.'],
  },
};
const _crime = G.World.prototype.commitCrime;
G.World.prototype.commitCrime = function (type, region, witnessed, victimId, value) {
  const r = _crime.apply(this, arguments);
  const c = G.CRIMES[type];
  if (c && region !== 'island') G.fame.add(this, 'bad', Math.max(1, Math.round((c.bounty || 20) / 10)) * (witnessed ? 1 : 0.3));
  return r;
};
const GS = G.GameScene.prototype, _report = GS.reportCrime;
GS.reportCrime = function (type, victim, value, victimId) {
  for (const a of this.witnessesOf(victim)) G.fame.remember(this.world, a.id, type);
  if (victim && victim.kind === 'npc' && !victim.dead) G.fame.remember(this.world, victim.id, type);
  return _report.apply(this, arguments);
};
// what people say when they remember something about you
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, w = runner.scene.world;
  if (st.memSaid === w.day || !st.memory || !st.memory.length) return [];
  const m = st.memory[st.memory.length - 1];
  if (w.day - m.day > 30 || !G.fame.LINES[m.what]) return [];
  st.memSaid = w.day;
  runner.memLine = pick(G.fame.LINES[m.what]);
  npc.say(runner.memLine, 4);
  return [];
});

// ---------------------------------------------------------------- cars
NP.dodgeCars = function (dt, scene) {
  if ((this.dodgeT = (this.dodgeT || 0) - dt) > 0) {
    const d = this.dodge;
    if (d) return true;   // (the step itself happens in update, after the normal update)
    return false;
  }
  this.dodgeT = 0.25; this.dodge = null;
  const T = scene.map.get(Math.floor(this.x / 16), Math.floor((this.y - 3) / 16)), onRoad = T === G.T.asphalt || T === G.T.road_line || T === G.T.road_line_v;
  for (const v of scene.vehicles || []) {
    if (Math.abs(v.speed) < 25 || (v.ai && !onRoad)) continue;   // traffic stays on the road: the sidewalk is safe
    const fx = Math.cos(v.angle) * Math.sign(v.speed), fy = Math.sin(v.angle) * Math.sign(v.speed);
    const dx = this.x - v.x, dy = this.y - v.y, ahead = dx * fx + dy * fy, side = dx * -fy + dy * fx;
    if (ahead < 0 || ahead > 24 + Math.abs(v.speed) * 0.6 || Math.abs(side) > 13) continue;
    if (v.ai && (Math.abs(v.speed) < 70 || ahead > 34)) continue;   // traffic brakes for people anyway; only a car that will not stop in time is worth jumping away from
    // step off to whichever side is closer, at a run
    const s = side >= 0 ? 1 : -1;
    this.dodge = { x: -fy * s, y: fx * s }; this.dodgeT = 0.6; this.path = null;
    if (Math.random() < 0.3) this.say(pick(['Whoa!', 'Watch it!', 'Hey!']), 1.5);
    return true;
  }
  return false;
};

// ---------------------------------------------------------------- gunshots
G.behavior = {
  // called by firearms when someone shoots
  gunshot(scene, shooter) {
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a === shooter || a.state === 'fight') continue;
      if (a.st.companion && shooter === scene.player) continue;   // your companions trust you with a gun
      const d = a.distTo(shooter);
      if (d > 260) continue;
      a.sleeping = false;
      if (a.def.combat === 'guard') continue;
      const P = G.social.persona(a.id);
      if (a.def.combat === 'fight' && !a.def.kid) { if (d < 160 && a.state === 'schedule') a.say(pick(['Who is shooting?!', 'Get down!']), 2); continue; }
      a.st.fear = 100;
      if ((P.trait === 'nervous' || a.def.kid || Math.random() < 0.3) && d < 140) {   // freeze and cower
        a.startFlee(shooter); a.cower = 4 + Math.random() * 4; a.moving = false;
        a.say(pick(['AAAH!', 'Oh God, oh God...', 'Please, please, please...', '*screams*']), 3);
      } else a.startFlee(shooter);
    }
  },
};
const _fire = G.firearms.playerFire, _nfire = G.firearms.npcFire;
// only a round actually fired scares anyone (an empty click does not): shoot() counts the shots
const _shootB = G.firearms.shoot;
G.firearms.shoot = function (shooter) { shooter._shots = (shooter._shots || 0) + 1; return _shootB.apply(this, arguments); };
G.firearms.playerFire = function (p, scene) { const n = p._shots || 0, r = _fire.apply(this, arguments); if ((p._shots || 0) > n) G.behavior.gunshot(scene, p); return r; };
G.firearms.npcFire = function (npc, scene) { const n = npc._shots || 0, r = _nfire.apply(this, arguments); if ((npc._shots || 0) > n && (scene.shotScareT || 0) < scene.time) { scene.shotScareT = scene.time + 1; G.behavior.gunshot(scene, npc); } return r; };

// ---------------------------------------------------------------- allies help you
const PL = G.Player.prototype, _phurt = PL.onHurt;
PL.onHurt = function (source, dmg, scene) {
  _phurt.call(this, source, dmg, scene);
  scene = scene || scenePlayer();
  if (!scene || !source || source.kind !== 'npc' || source.dead) return;
  const w = scene.world;
  this.lastHurtDay = w.day;
  for (const a of scene.actors) {
    if (a.kind !== 'npc' || a.dead || a === source || a.state === 'fight' || a.def.kid || a.talking) continue;
    if (a.distTo(this) > 180 || !a.canSee(scene, this, 180)) continue;
    const st = a.st, rel = G.rel.value(st), rep = w.rep && w.rep[a.def.faction] || 0;
    const ally = st.companion || rel >= 30 || st.partner || (a.def.faction !== 'civilians' && rep >= 40 && a.def.faction !== source.def.faction);
    if (!ally) continue;
    if (a.def.combat === 'flee') { if (!a.helpedT || a.helpedT < scene.time) { a.helpedT = scene.time + 15; a.say(pick(['Somebody help! They are attacking my friend!', 'Leave them alone! I am calling the cops!']), 3); } continue; }
    if (source.def.combat === 'guard' && !st.partner && !st.companion) continue;   // most will not fight the police for you
    a.say(pick(['Hey! Back off!', 'I got your back!', 'You picked the wrong person to mess with.']), 2);
    a.startFight(source, scene);
  }
};

// ---------------------------------------------------------------- first aid and supplies
const HEALS = ['first_aid_kit', 'bandage', 'painkillers'];
NP.selfCare = function (dt, scene) {
  if ((this.careT = (this.careT || 2) - dt) > 0) return;
  this.careT = 2;
  if (this.hp >= this.maxHp * 0.6 || this.state === 'flee' && this.distTo(this.target || this) < 40) return;
  const inv = this.st.inv || [];
  const e = HEALS.map((id) => inv.find((x) => x[0] === id && x[1] > 0)).find(Boolean);
  if (!e) return;
  e[1]--; const it = G.item(e[0]);
  this.hp = Math.min(this.maxHp, this.hp + (it.heal || 10)); this.st.hp = this.hp;
  this.say(e[0] === 'bandage' ? '*wraps a bandage*' : e[0] === 'painkillers' ? '*swallows some pills*' : '*patches up*', 2);
  if (scene.floatText) scene.floatText(this.x, this.y - 20, '+' + (it.heal || 10), '#7cd070');
};
const STAPLES = { worker: ['sandwich', 'water_bottle'], rich: ['sandwich', 'water_bottle'], shopkeeper: ['sandwich', 'water_bottle'], retiree: ['bread', 'water_bottle'], farmer: ['bread', 'milk'], gang: ['chips', 'soda', 'bandage'], dealer: ['chips', 'soda', 'bandage'], cop: ['sandwich', 'coffee', 'bandage'], homeless: ['bread', 'water_bottle'] };
const PRICE = (id) => Math.max(1, Math.round((G.item(id).value || 3) * 1.2));
G.behavior.stockUp = function (w) {
  for (const id in w.npcs) {
    const st = w.npcs[id], d = G.NPCS[id];
    if (!d || !st.alive || d.transient || st.jailedUntil > w.day) continue;
    const life = G.lifestyle.of(id), want = (STAPLES[life] || (d.kid ? ['candy', 'soda'] : ['sandwich', 'water_bottle'])).filter((x) => G.ITEMS[x]);
    st.inv = st.inv || [];
    for (const item of want) {
      const have = st.inv.filter((x) => x[0] === item).reduce((s, x) => s + x[1], 0);
      if (have >= 2 || Math.random() < 0.6) continue;
      if (life === 'homeless' || d.kid) { if (Math.random() < 0.3) st.inv.push([item, 1]); continue; }   // scavenged, or from mom
      const cost = PRICE(item);
      if ((st.gold || 0) >= cost + 5) { st.gold -= cost; st.inv.push([item, 1]); }
    }
    // hurt and nothing to patch it with: buy a bandage
    if ((st.hp != null && d.hp && st.hp < d.hp * 0.7) && !st.inv.some((x) => HEALS.includes(x[0]) && x[1] > 0) && (st.gold || 0) > 10) { st.gold -= 7; st.inv.push(['bandage', 1]); }
    st.inv = st.inv.filter((x) => x[1] > 0);
    if (st.inv.length > 24) { const keep = (x) => x[0] === d.weapon || (G.ITEMS[x[0]] && G.ITEMS[x[0]].type === 'ammo'); st.inv = st.inv.filter(keep).concat(st.inv.filter((x) => !keep(x)).slice(-(24 - st.inv.filter(keep).length))); }   // never sell off the gun or its rounds
  }
};
G.events.on('hour', () => { if (G.world && G.world.hour % 6 === 0) G.behavior.stockUp(G.world); });

// ---------------------------------------------------------------- personal space
NP.personalSpace = function (dt, scene) {
  if (G.behavior.spaceOff) return;
  const p = scene.player, st = this.st;
  if (this.def.combat === 'guard' || this.talking || this.state !== 'schedule' || p.dead || p.vehicle || st.companion || st.partner || this.def.shop && this.currentEntry(scene.world) && this.currentEntry(scene.world).act === 'work') { this.nearT = Math.max(0, (this.nearT || 0) - dt); return; }
  const near = this.distTo(p) < 40;
  this.nearT = near ? (this.nearT || 0) + dt : Math.max(0, (this.nearT || 0) - dt * 2);
  if (!near) { if (this.nearT <= 0) this.spaceStage = 0; return; }
  const rel = G.rel.value(st), fame = G.fame.score(scene.world), infamous = fame < -30 ? 0.5 : 1;
  const mem = (st.memory || []).some((m) => ['murder', 'assault', 'minors'].includes(m.what));
  const patience = Math.max(8, (25 + Math.max(0, rel) * 3) * infamous * (mem ? 0.3 : 1) * (G.social.persona(this.id).trait === 'chatty' ? 1.5 : 1));
  const stage = this.nearT > patience * 2.2 ? 3 : this.nearT > patience * 1.5 ? 2 : this.nearT > patience ? 1 : 0;
  if (stage <= (this.spaceStage || 0)) return;
  this.spaceStage = stage;
  if (stage === 1) this.say(rel >= 20 ? pick(['You are sticking close today. Everything okay?', 'Need something?']) : pick(['Can I help you?', 'Do you need something?']), 3);
  else if (stage === 2) { this.say(rel >= 20 ? 'I kind of need some space right now.' : pick(['Why are you following me?', 'Back off, please.']), 3); G.social.addDisp(scene.world, this.id, rel >= 20 ? -1 : -3); }
  else {
    G.social.addDisp(scene.world, this.id, -5);
    if (rel < 10 && (mem || fame < -30) && this.def.combat === 'flee') { this.say('That is it. I am calling the police.', 3); st.fear = Math.max(st.fear || 0, 60); this.startFlee(p); scene.reportCrime('trespass', this); }
    else { this.say(pick(['I am leaving. Do not follow me.', 'Seriously. Leave me alone.']), 3); this.goal = scene.map.randomWalkableNear(Math.floor(this.x / 16), Math.floor(this.y / 16), 10); }
  }
};

NP.update = function (dt, scene) {
  if (this.dead) return _nu.call(this, dt, scene);
  if (!this.talking && this.state !== 'fight' && !this.sleeping && this.dodgeCars(dt, scene)) { const r = _nu.call(this, dt, scene); const d = this.dodge; if (d && !this.dead) this.stepToward(this.x + d.x * 30, this.y + d.y * 30, dt, scene, true); return r; }   // the rest of their life goes on while they jump aside
  if (this.cower > 0) { this.cower -= dt; this.moving = false; this.holdTick(dt, scene); return; }
  this.selfCare(dt, scene);
  this.personalSpace(dt, scene);
  return _nu.call(this, dt, scene);
};
// cowering people crouch: draw them lower
const _draw = NP.draw;
NP.draw = function (ctx) {
  if (!(this.cower > 0)) return _draw.call(this, ctx);
  ctx.save(); ctx.translate(this.x, this.y); ctx.scale(1, 0.7); ctx.translate(-this.x, -this.y); _draw.call(this, ctx); ctx.restore();
};

// ---------------------------------------------------------------- concern
G.events.on('hour', () => {
  const w = G.world, scene = scenePlayer();
  if (!w || !scene || w.hour !== 19) return;
  const p = scene.player, reasons = [];
  if (p.lastHurtDay === w.day || p.hp < p.maxHp * 0.5) reasons.push('hurt');
  if (w.jail) reasons.push('jail');
  if ((w.bounty[scene.region] || 0) >= 100) reasons.push('wanted');
  w.lastSeen = w.lastSeen || {};
  for (const id of G.phone.contacts(w)) {
    const st = w.npcs[id];
    if (!st || !st.alive || G.NPCS[id].kid) continue;
    const rel = G.rel.value(st);
    if (rel < 30 || (st.concernDay && w.day - st.concernDay < 2)) continue;
    const gone = w.day - (w.lastSeen[id] == null ? w.day : w.lastSeen[id]);
    let text = null;
    if (reasons.includes('jail')) text = pick(['I heard they locked you up. Do you need anything?', 'Are you okay in there? I am worried.']);
    else if (reasons.includes('hurt')) text = pick(['Someone said you got hurt. Are you okay??', 'Heard you were in a fight. Text me back, please.']);
    else if (reasons.includes('wanted')) text = pick(['The cops are asking about you. What is going on?', 'Please tell me you are not in trouble.']);
    else if (gone >= 4 && rel >= 50) text = pick([`I have not seen you in ${gone} days. Everything okay?`, 'Hey stranger. Alive?', 'Miss you. Where have you been?']);
    if (text && Math.random() < 0.6) { st.concernDay = w.day; G.phone.queue(w, id, text, G.rng.int(1, 30)); }
  }
});
// remember when you last saw everyone you know
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if ((this.seenT = (this.seenT || 0) - dt) <= 0) {
    this.seenT = 5; const w = this.world; w.lastSeen = w.lastSeen || {};
    for (const a of this.actors) if (a.kind === 'npc' && !a.dead && a.distTo(this.player) < 120) w.lastSeen[a.id] = w.day;
  }
  return r;
};
})();

// ---------------------------------------------------------------- slow natural healing
// Wounds close slowly: an injured person gets back about a fiftieth of their health per hour awake and
// twice that asleep (a full recovery takes two days or so), wherever they are, on screen or not.
G.events.on('hour', () => {
  const w = G.world;
  if (!w || !w.npcs) return;
  const scene = G.scenes.stack.find((s) => s instanceof G.GameScene);
  const here = new Map();
  if (scene) for (const a of scene.actors) if (a.kind === 'npc' && !a.dead) here.set(a.id, a);
  for (const id in w.npcs) {
    const st = w.npcs[id], def = G.NPCS[id];
    if (!st || !st.alive || st.hp == null) continue;
    const max = (def && def.hp) || 30;
    if (st.hp >= max) continue;
    const a = here.get(id);
    if (a && (a.state === 'fight' || a.state === 'flee')) continue;   // not mid-fight
    const asleep = a ? a.sleeping : !!def && (G.beds.entryNow(id, w) || {}).act === 'sleep';
    // only medicine heals (js/game/aid.js): something from their pockets, if they have it
    void asleep;
    if (st.hp < max * 0.7) { const e = (st.inv || []).filter((x) => x[1] > 0 && ['first_aid_kit', 'medkit', 'bandage', 'ibuprofen', 'painkillers'].includes(x[0])).sort((p, q) => (G.item(q[0]).heal || 0) - (G.item(p[0]).heal || 0))[0]; if (e) { e[1]--; st.inv = st.inv.filter((x) => x[1] > 0); st.hp = Math.min(max, st.hp + (G.item(e[0]).heal || 10)); if (G.item(e[0]).heal && ['bandage', 'first_aid_kit', 'medkit'].includes(e[0])) st.bleed = null; } }
    if (a) a.hp = Math.min(a.maxHp || max, st.hp);
  }
});
