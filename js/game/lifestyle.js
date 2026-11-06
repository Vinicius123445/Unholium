'use strict';
// Lifestyles: everyone has one, and it shapes what they do with their free time and what is in their drawers.
//   Goals: outside work and sleep, people keep picking things to do that fit their life — groceries, lunch,
//   a jog in the park, the bar after work, church, visiting a friend; gangs patrol turf, deal and hang at
//   the court; the homeless look for food and a dry spot; the rich go to the casino, the jeweler and the
//   club; kids play, teenagers loiter. They walk there, do it for a while, mention it, then move on.
//   Loot: containers and drawers hold what their owners would own: drugs, cash and guns in gang hideouts,
//   jewelry and pills in mansions, ammo in police lockers, candy and comics in kids' rooms, cans and
//   cigarettes in a shelter, prescription bottles with retirees...
(() => {
G.lifestyle = {
  of(id) {
    const d = G.NPCS[id] || {};
    if (d.kid) return d.kid;
    if (d.addictKind) return 'homeless';   // addicts live rough
    if (d.dealer) return 'dealer';
    if (['gang_red', 'gang_blue', 'punks', 'criminals'].includes(d.faction)) return 'gang';
    if (d.combat === 'guard') return 'cop';
    if (d.faction === 'elite' || d.map === 'heights') return 'rich';
    if (/beggar|homeless/i.test(id + d.name)) return 'homeless';
    if (/farmer|farmwife|rancher/i.test(id + d.name)) return 'farmer';
    if (d.shop) return 'shopkeeper';
    if (d.look && d.look.hair === '#c8c8c8') return 'retiree';
    return 'worker';
  },
  // places on this map, by kind (cached)
  spots(map) {
    if (map.lifeSpots) return map.lifeSpots;
    const S = { shop: [], food: [], bar: [], church: [], park: [], casino: [], jeweler: [], turf: [], dumpster: [], school: [], home: [] };
    for (const b of map.buildings) {
      const door = map.points[b.id + '_door'];
      if (!door) continue;
      const n = b.name;
      if (/Store|Mart|Bodega|Liquor|Pharmacy|Clothes|Barber|Pawn|Gas/.test(n)) S.shop.push(door);
      if (/Diner|Bar|Motel/.test(n) || b.kind === 'inn') { S.food.push(door); if (b.kind === 'inn' || /Bar/.test(n)) S.bar.push(door); }
      if (b.kind === 'temple') S.church.push(door);
      if (b.id === 'h_casino') S.casino.push(door);
      if (/Jewel/.test(n)) S.jeweler.push(door);
      if (/School/.test(n)) S.school.push(door);
      if (b.kind === 'house') S.home.push(door);
    }
    for (const k in map.points) {
      const v = map.points[k];
      if (/_park$|_court$|_plaza$|_garden$|_lounge$|_harbor$|_docks$/.test(k)) S.park.push(v);
      if (/_turf$/.test(k)) S.turf.push(...(Array.isArray(v) ? v : [v]));
    }
    for (const d of map.decor) if (d.type === 'dumpster' && !map.isSolidTile(d.tx, d.ty + 1)) S.dumpster.push({ x: d.tx, y: d.ty + 1 });
    return (map.lifeSpots = S);
  },
  GOALS: {
    worker: [['shop', 'Gotta pick up groceries.', 1.5], ['food', 'Lunch break. Finally.', 1.5], ['park', 'Time for my jog.', 1.5], ['bar', 'I need a drink after today.', 2], ['church', 'Just going to sit in the church for a while.', 1], ['home', 'Going to see a friend.', 1.5]],
    shopkeeper: [['shop', 'Checking out the competition.', 1], ['food', 'Quick bite before I open.', 1], ['bar', 'One drink. Just one.', 1.5]],
    gang: [['turf', 'Gotta keep an eye on our corner.', 2], ['park', 'Just chilling.', 1.5], ['shop', 'Need smokes.', 1], ['bar', 'Drinks on the house. Our house.', 2]],
    dealer: [['turf', 'Business hours.', 2.5], ['park', 'Meeting a customer.', 1.5], ['food', 'Even I gotta eat.', 1]],
    homeless: [['dumpster', 'Maybe there is something to eat in there...', 1.5], ['church', 'The church gives out soup sometimes.', 2], ['park', 'At least the bench is free.', 2]],
    rich: [['casino', 'Feeling lucky tonight.', 3], ['jeweler', 'I need something sparkly.', 1], ['park', 'A stroll through the gardens.', 1.5], ['food', 'Brunch.', 1.5]],
    retiree: [['park', 'Going to feed the birds.', 2], ['church', 'Church. Every day at my age.', 1.5], ['shop', 'Just need a few things.', 1]],
    farmer: [['shop', 'Need supplies from town.', 1.5], ['food', 'Coffee at the diner.', 1], ['bar', 'A beer after the chores.', 1.5]],
    kid: [['park', 'Wanna play!', 2], ['shop', 'I have a dollar! Candy!', 1]],
    teen: [['park', 'Nothing to do in this town.', 2], ['shop', 'Snacks.', 1], ['school', 'Forgot my bag at school...', 0.5]],
    cop: [],
  },
  pick(npc, scene) {
    const life = this.of(npc.id), list = this.GOALS[life] || [], S = this.spots(scene.map), w = scene.world;
    const opts = list.filter(([k]) => S[k] && S[k].length && !(k === 'bar' && (w.hour < 16 || npc.def.kid)) && !(k === 'casino' && !(w.hour >= 16 || w.hour < 3)) && !(k === 'school' && w.hour > 17));
    if (!opts.length) return null;
    const [kind, line, hours] = G.rng.pick(opts);
    let pt = G.rng.pick(S[kind]);
    if (kind === 'home' && npc.def.home) { const own = scene.map.points[npc.def.home + '_door']; const others = S.home.filter((q) => q !== own); if (others.length) pt = G.rng.pick(others); }
    return { kind, line, pt, until: G.effects.now() + hours * 60, act: kind === 'park' || kind === 'turf' ? 'wander' : 'idle' };
  },
  update(npc, dt, scene) {
    const g = npc.errand, w = scene.world;
    if (!g) return false;
    if (G.effects.now() > g.until || npc.state !== 'schedule' || npc.needTask || npc.loveTask || npc.st.companion) { npc.errand = null; return false; }
    const at = npc.approach(scene.map, g.pt);
    if (!g.there) {
      if (npc.arrived(at)) { g.there = true; if (g.kind === 'dumpster') { npc.st.hunger = Math.max(0, (npc.st.hunger || 0) - 30); } if (g.kind === 'shop') npc.st.gold = Math.max(0, (npc.st.gold || 0) - G.rng.int(2, 15)); }
      else { if ((g.walk = (g.walk || 0) + dt) > 60) { npc.errand = null; return false; } npc.walkTo(at, dt, scene); return true; }
    }
    npc.sleeping = false;
    if (g.act === 'wander') {
      if (!g.sub || npc.arrived(g.sub)) { npc.moving = false; if ((g.wait = (g.wait || 0) - dt) <= 0) { g.wait = G.rng.range(2, 6); g.sub = scene.map.randomWalkableNear(g.pt.x, g.pt.y, 3, G.rng, false); } }
      else npc.walkTo(g.sub, dt, scene);
    } else { npc.moving = false; npc.lookAround(dt); }
    void w;
    return true;
  },
  // every hour, idle people pick something to do
  hourly(scene) {
    const w = scene.world;
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a.transient || a.errand || a.state !== 'schedule' || a.st.companion || a.st.visiting || a.needTask || a.loveTask || a.talking) continue;
      const e = a.currentEntry(w);
      if (!e || e.act === 'sleep' || e.act === 'work' || e.act === 'patrol') continue;
      if (Math.random() > 0.45) continue;
      const g = this.pick(a, scene);
      if (!g) continue;
      a.errand = g;
      if (a.distTo(scene.player) < 200 && Math.random() < 0.6) a.say(g.line, 3);
    }
  },
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.errand && ((this.st.hunger || 0) >= 60 || (this.st.thirst || 0) >= 60)) this.errand = null;   // needs come first
  if (this.errand && !this.dead && !this.talking && this.state === 'schedule' && !this.holdT && !this.chatT) {
    this.baseUpdate(dt, scene.map);
    this.st.hp = this.hp;
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    // still notice danger and needs
    const p = scene.player;
    if (this.def.combat === 'flee' && this.st.fear >= 60 && this.canSee(scene, p, 56)) { this.errand = null; this.startFlee(p); return; }
    if (this.isHostileToPlayer(scene) && this.def.combat !== 'flee' && this.canSee(scene, p, 120)) { this.errand = null; this.aggressor = true; this.startFight(p, scene); return; }
    if (G.lifestyle.update(this, dt, scene)) return;
  }
  return _nu.call(this, dt, scene);
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && G.world) G.lifestyle.hourly(scene);
});

// ---------------------------------------------------------------- loot that fits the owner
const T = {
  gang: [['joint', 0.5], ['weed', 0.35], ['cocaine', 0.25], ['crack', 0.25], ['pistol', 0.15], ['ammo_9mm', 0.45], ['switchblade', 0.25], ['brass_knuckles', 0.15], ['beer', 0.4], ['gold_chain', 0.15], ['xanax', 0.2]],
  dealer: [['weed', 0.7], ['cocaine', 0.5], ['heroin', 0.3], ['crack', 0.4], ['xanax', 0.5], ['lsd', 0.25], ['magic_mushroom', 0.25], ['pistol', 0.2]],
  rich: [['jewelry', 0.5], ['designer_watch', 0.3], ['gem', 0.2], ['wine', 0.5], ['xanax', 0.35], ['cocaine', 0.12], ['smartphone', 0.3], ['letter', 0.3]],
  cop: [['ammo_9mm', 0.6], ['bandage', 0.5], ['police_baton', 0.25], ['sandwich', 0.4], ['coffee', 0.5], ['handcuffs', 0.2]],
  homeless: [['canned_beans', 0.5], ['cigarettes', 0.4], ['beer', 0.3], ['bread', 0.3], ['bandage', 0.2]],
  kid: [['candy', 0.7], ['comic_book', 0.5], ['soda', 0.5], ['apple', 0.3]],
  teen: [['comic_book', 0.3], ['energy_drink', 0.5], ['candy', 0.4], ['cigarettes', 0.2], ['joint', 0.1], ['smartphone', 0.15]],
  worker: [['sandwich', 0.3], ['soda', 0.3], ['painkillers', 0.25], ['benadryl', 0.2], ['wallet', 0.15], ['letter', 0.3], ['beer', 0.25], ['condom', 0.15], ['book', 0.2]],
  retiree: [['painkillers', 0.5], ['letter', 0.5], ['book', 0.4], ['bread', 0.3], ['jewelry', 0.15], ['benadryl', 0.3]],
  farmer: [['egg', 0.5], ['milk', 0.4], ['bread', 0.4], ['ammo_shells', 0.3], ['woodaxe', 0.15], ['moonshine', 0.2]],
  shopkeeper: [['chips', 0.4], ['soda', 0.4], ['cigarettes', 0.3], ['wallet', 0.2]],
};
const CASH = { gang: [20, 150], dealer: [80, 400], rich: [100, 600], cop: [10, 40], homeless: [0, 6], kid: [0, 5], teen: [2, 20], worker: [5, 40], retiree: [10, 80], farmer: [5, 40], shopkeeper: [20, 80] };
G.lifestyle.roll = (life, style) => {
  const table = style === 'cabinet' ? [['canned_beans', 0.6], ['chips', 0.5], ['soda', 0.5], ['bread', 0.3], ['beer', life === 'gang' ? 0.6 : 0.25], ['milk', 0.2]] : (T[life] || T.worker);
  return table.filter(([id, p]) => G.ITEMS[id] && Math.random() < p).map(([id]) => [id, ['ammo_9mm', 'ammo_shells'].includes(id) ? G.rng.int(6, 18) : 1]);
};
const C = G.containers, _ensure = C.ensureChests;
C.ensureChests = function (world, map) {
  const fresh = map.chests.filter((c) => !world.containers[c.id]).map((c) => c.id);
  _ensure.call(this, world, map);
  for (const id of fresh) {
    const c = world.containers[id];
    if (!c || !c.owner || !G.NPCS[c.owner]) continue;
    const life = G.lifestyle.of(c.owner), roll = G.lifestyle.roll(life, c.style);
    for (const [it, n] of roll) { const e = c.items.find((x) => x[0] === it); if (e) e[1] += n; else c.items.push([it, n]); }
    if (c.style !== 'cabinet') { const [lo, hi] = CASH[life] || CASH.worker; c.gold = (c.gold || 0) + G.rng.int(lo, hi); }
  }
};
// searching drawers, nightstands and wardrobes: what is in there depends on who lives there
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'search' && ['nightstand', 'wardrobe', 'kcounter'].includes(d.type)) {
    const owner = G.usables.owner(scene, d), life = owner && owner !== 'player' ? G.lifestyle.of(owner) : 'worker';
    if (!G.usables.once(scene, d, 'search')) { scene.toast('You already went through it.'); return; }
    let found = d.type === 'kcounter' ? G.lifestyle.roll(life, 'cabinet') : G.lifestyle.roll(life, 'personal');
    if (d.type === 'wardrobe' && Math.random() < 0.6 && G.clothId) {   // clothes!
      const L = G.LOOK_PALETTE, top = Math.random() < 0.5;
      found = [[top ? G.clothId('top', G.rng.pick(['shirt', 'jacket', 'hoodie', 'vest']), G.rng.pick(L.SHIRTS), G.rng.pick(L.SHIRTS)) : G.clothId('bottom', G.rng.pick(['pants', 'shorts', 'skirt']), G.rng.pick(L.PANTS)), 1]];
    }
    found = found.slice(0, 2);
    if (!found.length) { scene.toast('Nothing worth taking.'); return; }
    for (const [id, n] of found) scene.player.inventory.add(id, n);
    scene.toast('Found: ' + found.map(([id]) => G.item(id).name).join(', '), 'good');
    G.audio.play('pickup');
    if (owner && owner !== 'player') G.usables.stealing(scene, owner, 15);
    return;
  }
  return _use.call(this, d, scene);
};
// thugs who spawn at night carry their stash
const GS = G.GameScene.prototype, _spawn = GS.spawnTransient;
GS.spawnTransient = function (kind, z) {
  const npc = _spawn.call(this, kind, z);
  if (npc && ['gang_red', 'gang_blue', 'punks', 'criminals'].includes(npc.def.faction) || npc && npc.def.mugger) G.keys.stash(npc.st, 0.45);
  return npc;
};
})();
