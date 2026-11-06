'use strict';
// Hunger and thirst (0 = satisfied, 100 = starving / parched) for the player, NPCs and animals.
//   Player: grows every hour; food and drinks bring it down; above 60 you tire faster, above 85 you are
//           weak and irritable, at 100 you start losing health. Wells and fountains are free water.
//   NPCs:   when hungry they eat at their own table, or buy food from a vendor and sit down somewhere to
//           eat; when thirsty they drink at a well, fountain, vending machine or their fridge; in the
//           evening some of them go to the bar for a drink. People elsewhere on the map take care of
//           themselves off-screen.
//   Animals: see js/game/animal.js (grazing, drinking, predators hunting prey).

// What food and drink do for hunger/thirst (items can override with food/drink fields).
G.NUTRITION = {
  soda: [5, 35], coffee: [0, 25], energy_drink: [0, 30], milk: [15, 35], beer: [5, 25], ale: [5, 25], wine: [5, 20],
  water_bottle: [0, 60], apple: [15, 10], cheese: [25, 0], chips: [15, -5], sandwich: [45, 0], cooked_meat: [55, 0],
  canned_beans: [40, 0], bread: [35, 0], fish: [30, 0], egg: [15, 0], raw_meat: [15, 0], edible: [10, 0],
};
G.nutrition = (it) => {
  if (it.food != null || it.drink != null) return [it.food || 0, it.drink || 0];
  if (G.NUTRITION[it.id]) return G.NUTRITION[it.id];
  if (it.type !== 'consumable' || it.drug || it.cures) return [0, 0];
  return [Math.min(50, (it.heal || 0) * 3), it.alcohol ? 20 : 0];
};

G.needs = {
  RATE: { hunger: 4, thirst: 6 },    // per game hour

  // ---------------- player ----------------
  hourlyPlayer(p, scene) {
    if (scene.world.jail && scene.world.hour % 6 === 0) { p.hunger = Math.max(0, (p.hunger || 0) - 40); p.thirst = Math.max(0, (p.thirst || 0) - 50); }   // jail meals
    p.hunger = Math.min(100, (p.hunger || 0) + this.RATE.hunger);
    p.thirst = Math.min(100, (p.thirst || 0) + this.RATE.thirst);
    { const bad = p.hunger >= 85 || p.thirst >= 85; if (bad && !p.needWarned) scene.toast(p.thirst >= 85 ? 'You are badly dehydrated.' : 'You are starving.', 'bad'); p.needWarned = bad; }   // (once, on the way in: the values are not whole numbers)
  },
  updatePlayer(p, dt, scene) {
    // an empty food or water bar drains your life (thirst kills faster than hunger, as it does)
    const starving = (p.hunger || 0) >= 100, parched = (p.thirst || 0) >= 100;
    if (starving || parched) {
      p.needDmg = (p.needDmg || 0) + dt * ((starving ? 0.5 : 0) + (parched ? 0.8 : 0));
      if ((p.needWarnT = (p.needWarnT || 0) - dt) <= 0) { p.needWarnT = 12; scene.toast(parched ? 'You are dying of thirst. Drink something!' : 'You are starving to death. Eat something!', 'bad'); }
      if (p.needDmg >= 1) { const n = Math.floor(p.needDmg); p.needDmg -= n; p.hp -= n; scene.floatText(p.x, p.y - 20, '-' + n, '#ff6050'); if (p.hp <= 0 && !p.cheatDeath(scene)) { p.hp = 0; p.die({ kind: 'starvation' }, scene); } }
    }
  },
  // NPCs and animals waste away the same way (on screen; people elsewhere look after themselves)
  starve(actor, hunger, thirst, dt, scene) {
    if (hunger < 100 && thirst < 100 || actor.dead) return;
    actor.needDmg = (actor.needDmg || 0) + dt * ((hunger >= 100 ? 0.4 : 0) + (thirst >= 100 ? 0.6 : 0));
    if (actor.needDmg < 1) return;
    const n = Math.floor(actor.needDmg); actor.needDmg -= n; actor.hp -= n;
    if (actor.kind === 'npc' && Math.random() < 0.1) actor.say(thirst >= 100 ? 'Water... please...' : 'So... hungry...', 2);
    if (actor.hp <= 0) { actor.hp = 0; actor.die(null, scene); }
  },
  // stat penalties (read by G.effects.statBonus)
  statBonus(p, name) {
    let v = 0;
    const h = p.hunger || 0, t = p.thirst || 0;
    if (name === 'staminaRegen') v -= (h >= 60 ? 0.3 : 0) + (t >= 60 ? 0.3 : 0);
    if (name === 'charisma') v -= (h >= 85 ? 1 : 0) + (t >= 85 ? 1 : 0);
    if (name === 'meleeDmg') v -= h >= 85 ? 0.1 : 0;
    return v;
  },
  eat(p, it) {
    const [f, d] = G.nutrition(it);
    p.hunger = G.util.clamp((p.hunger || 0) - f, 0, 100);
    p.thirst = G.util.clamp((p.thirst || 0) - d, 0, 100);
  },

  // ---------------- NPCs ----------------
  hourlyNPCs(w, scene) {
    for (const id in w.npcs) {
      const st = w.npcs[id];
      if (!st.alive) continue;
      const k = 0.7 + (G.util.hashString(id) % 7) / 10;
      st.hunger = Math.min(100, (st.hunger || G.rng.int(0, 40)) + this.RATE.hunger * k);
      st.thirst = Math.min(100, (st.thirst || G.rng.int(0, 40)) + this.RATE.thirst * k);
      // people on other maps (or asleep) look after themselves
      const here = scene && scene.map.id === st.map;
      if (!here) { if (st.hunger > 70) st.hunger = G.rng.int(0, 20); if (st.thirst > 65) st.thirst = G.rng.int(0, 20); }
      // here, but the hours are being skipped (you slept or waited): they ate and drank in that time too
      else if (scene.sleepingNow || G.timeSkip > 0) { if (st.hunger > 85) st.hunger = G.rng.int(5, 25); if (st.thirst > 85) st.thirst = G.rng.int(5, 25); }
    }
  },

  // Places on a map, cached: seats (by tables, chairs, benches), water, vending machines, fridges.
  spots(map) {
    if (map.needSpots) return map.needSpots;
    const free = (x, y) => !map.isSolidTile(x, y);
    const seats = [], water = [], vending = [], fridges = [];
    for (const d of map.decor) {
      const b = map.buildingAtTile(d.tx, d.ty);
      const bid = b ? b.id : null;
      if (d.type === 'table') for (const [x, y] of [[d.tx, d.ty + 1], [d.tx + 1, d.ty + 1]]) if (free(x, y) && map.decorsAt(x, y).some((q) => q.def.interact === 'sit')) seats.push({ x, y, b: bid, dir: 3 });   // (a table with no chair at it is not a seat)
      // a bench is solid: they walk up to the tile in front and sit on it. On a pew, facing the altar, its back hides them
      if (d.type === 'bench' || d.type === 'pew') for (const [x, y] of [[d.tx, d.ty + 1], [d.tx + 1, d.ty + 1]]) if (free(x, y)) { const pew = d.type === 'pew'; seats.push({ x, y, b: bid, dir: 3, bench: true, perch: { x: d.x + (x === d.tx ? -6 : 6), y: d.y - (pew ? 4 : 2), z: d.y + (pew ? -1 : 1), dir: pew ? 3 : 0 } }); }
      if (d.def.interact === 'well') for (const [x, y] of [[d.tx, d.ty + 1], [d.tx - 1, d.ty], [d.tx + (d.def.fw || 1), d.ty]]) if (free(x, y)) { water.push({ x, y, b: bid }); break; }
      if (d.type === 'vending') if (free(d.tx, d.ty + 1)) vending.push({ x: d.tx, y: d.ty + 1, b: bid });
      if (d.type === 'fridge') for (const [x, y] of [[d.tx + 1, d.ty], [d.tx, d.ty - 1]]) if (free(x, y)) { fridges.push({ x, y, b: bid }); break; }
    }
    for (const d of map.decor) if (d.type === 'chair') seats.push({ x: d.tx, y: d.ty, b: (map.buildingAtTile(d.tx, d.ty) || {}).id || null, dir: 3 });
    return (map.needSpots = { seats, water, vending, fridges });
  },
  nearest(list, npc, filter = () => true) {
    let best = null, bd = 1e9;
    for (const s of list) {
      if (!filter(s)) continue;
      const d = Math.abs(s.x * 16 - npc.x) + Math.abs(s.y * 16 - npc.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },
  // A free tile in front of somebody (to stand at a counter).
  besides(map, a) {
    const tx = Math.floor(a.x / 16), ty = Math.floor((a.y - 3) / 16);
    for (const [dx, dy] of [[0, 2], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]]) if (!map.isSolidTile(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
    return null;
  },
  publicSeat(scene, npc, near) {
    const sp = this.spots(scene.map), mine = npc.def.home;
    const ok = (s) => { if (!s.b || s.b === mine) return true; const b = scene.map.building(s.b); return !!b && (b.kind === 'inn' || /Diner|Bar|Motel|Mess Hall/.test(b.name)); };
    const taken = new Set(scene.actors.filter((a) => a.needTask).map((a) => { const st = a.needTask.steps[a.needTask.i]; return st ? st.x + ',' + st.y : ''; }));
    return this.nearest(sp.seats, near || npc, (s) => ok(s) && !taken.has(s.x + ',' + s.y));
  },
  // A vendor here who sells food (or drink) and is at work.
  vendor(scene, npc, drink) {
    let best = null, bd = 1e9;
    for (const sid in G.SHOPS) {
      const s = G.SHOPS[sid], owner = scene.world.shops[sid] && scene.world.shops[sid].owner;
      if (!owner || owner === npc.id || !s.stock.some(([id]) => G.ITEMS[id] && G.nutrition(G.ITEMS[id])[drink ? 1 : 0] >= 20 && !G.ITEMS[id].drug && !G.ITEMS[id].illegal)) continue;
      const o = scene.actors.find((a) => a.id === owner && !a.dead);
      if (!o || !G.shopSys.isOpen(sid, scene)) continue;
      const d = o.distTo(npc);
      if (d < bd) { bd = d; best = { sid, owner: o }; }
    }
    return best;
  },

  // Decide what to do about being hungry / thirsty / it being bar o'clock. Returns a task or null.
  plan(npc, scene) {
    const st = npc.st, w = scene.world, map = scene.map, sp = this.spots(map);
    const e = npc.currentEntry(w);
    const busy = e && (e.act === 'work' || e.act === 'sleep');
    const thirsty = st.thirst >= (busy ? 90 : 60), hungry = st.hunger >= (busy ? 90 : 60);
    const homeB = npc.def.home && map.building(npc.def.home);
    const step = (pt, act, dur, extra = {}) => pt && Object.assign({ x: pt.x, y: pt.y, act, dur }, extra);
    // shopkeepers on shift do not leave the counter unattended: they snack and drink right there
    if (e && e.act === "work" && npc.def.shop && (thirsty || hungry) && typeof e.at === "string" && map.points[e.at]) {
      const spot = npc.approach(map, map.points[e.at]);
      return [step(spot, thirsty ? "drink" : "snack", 5)];
    }
    if (thirsty) {
      const fridge = homeB && this.nearest(sp.fridges, npc, (s) => s.b === homeB.id);
      const wat = this.nearest(sp.water, npc, (s) => !s.b || (homeB && s.b === homeB.id));   // public water, or their own sink
      const vend = st.gold >= 2 && this.nearest(sp.vending, npc, (s) => !s.b || (homeB && s.b === homeB.id));
      const pick = [fridge, wat, vend].filter(Boolean).sort((a, b) => Math.hypot(a.x * 16 - npc.x, a.y * 16 - npc.y) - Math.hypot(b.x * 16 - npc.x, b.y * 16 - npc.y))[0];
      if (pick) return [step(pick, 'drink', 3, { pay: pick === vend ? 2 : 0 })];
      const v = st.gold >= 3 && this.vendor(scene, npc, true);
      if (v) return [step(this.besides(map, v.owner), 'buy', 1.2, { from: v.owner.id, cost: 3, drink: true }), step(this.publicSeat(scene, npc, v.owner) || this.besides(map, v.owner), 'drink', 4)];
      st.thirst = 30;   // nothing around: makes do
    }
    if (hungry) {
      if (homeB) {
        const seat = this.nearest(sp.seats, npc, (s) => s.b === homeB.id);
        if (seat) return [step(seat, 'eat', 9)];
      }
      const v = st.gold >= 5 && this.vendor(scene, npc, false);
      if (v) return [step(this.besides(map, v.owner), 'buy', 1.2, { from: v.owner.id, cost: 6 }), step(this.publicSeat(scene, npc, v.owner) || this.besides(map, v.owner), 'eat', 9)];
      st.hunger = 40;
    }
    // evening drinks at the bar for the sociable
    const P = G.social.persona(npc.id);
    if (!busy && w.hour >= 19 && w.hour < 23 && ['chatty', 'friendly', 'tired', 'grumpy'].includes(P.trait) && st.barDay !== w.day && npc.def.faction !== 'government' && st.gold >= 5) {
      const bar = map.buildings.find((b) => b.kind === 'inn');
      const seat = bar && this.nearest(sp.seats, npc, (s) => s.b === bar.id);
      if (seat && G.rng.chance(0.4)) { st.barDay = w.day; return [step(seat, 'bar', 25, { cost: 5 })]; }
      st.barDay = w.day;
    }
    return null;
  },

  // Run a task step by step. Returns true while the NPC is busy with it.
  update(npc, dt, scene) {
    const st = npc.st;
    // (a seat only lasts while they are at it: other modules drop the task without standing them up, and they
    // went on walking around in the sitting pose, like the Swim Instructor at the lake)
    if (npc.seated && (npc.moving || !npc.needTask || npc.sleeping)) { npc.seated = false; if (/beer|sandwich|soda/.test(npc.emote || '')) npc.emote = null; }
    if (npc.state !== 'schedule' || npc.talking || npc.sleeping) { if (npc.needTask && npc.state !== 'schedule') { npc.needTask = null; npc.seated = false; npc.emote = null; } return false; }
    if (!npc.needTask) {
      if ((npc.needScanT = (npc.needScanT == null ? G.rng.range(1, 6) : npc.needScanT) - dt) > 0) return false;
      npc.needScanT = G.rng.range(4, 8);
      const steps = npc.transient ? null : this.plan(npc, scene);
      if (!steps || steps.some((s) => !s)) return false;
      npc.needTask = { steps, i: 0, t: 0, walk: 0 };
    }
    const task = npc.needTask, s = task.steps[task.i];
    if (!npc.arrived(s)) {
      task.walk += dt;
      if (task.walk > 45) { npc.needTask = null; return false; }   // could not get there
      npc.walkTo(s, dt, scene);
      return true;
    }
    npc.moving = false;
    if (task.t === 0) {
      if (s.act === 'buy') { const o = scene.actors.find((a) => a.id === s.from); if (o) { npc.faceTowards(o); o.faceTowards(npc); } npc.say(G.rng.pick(s.drink ? ['Something to drink, please.', 'A soda, thanks.'] : ['One sandwich, please.', 'The usual.', 'Something to eat, please.'])); st.gold -= s.cost; const sid = G.shopSys.shopFor(s.from, scene.world); if (sid) scene.world.shops[sid].gold += s.cost; }
      if (s.act === 'eat' || s.act === 'bar') { const at = this.spots(scene.map).seats.find((q) => q.x === s.x && q.y === s.y); npc.perch = (at && at.perch) || null; npc.seated = true; npc.dir = npc.perch ? npc.perch.dir : 3; npc.emote = s.act === 'bar' ? 'beer' : 'sandwich'; if (s.act === 'bar') { st.gold -= s.cost; npc.say(G.rng.pick(['Cheers!', 'Another round!', 'Long day...', 'Ahh, that hits the spot.'])); } }
      if (s.act === 'drink') { npc.emote = 'soda'; st.gold -= s.pay || 0; }
      if (s.act === "snack") { npc.emote = "sandwich"; npc.dir = 0; }
    }
    task.t += dt;
    if (task.t >= s.dur) {
      if (s.act === "eat" || s.act === "snack") st.hunger = 0;
      if (s.act === 'drink') st.thirst = 0;
      if (s.act === 'bar') { st.thirst = 0; st.hunger = Math.max(0, st.hunger - 20); }
      npc.seated = false; npc.emote = null;
      task.i++; task.t = 0; task.walk = 0;
      if (task.i >= task.steps.length) npc.needTask = null;
    }
    return true;
  },
};

G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!G.world || !scene) return;
  G.needs.hourlyNPCs(G.world, scene);
  if (!scene.player.dead) G.needs.hourlyPlayer(scene.player, scene);
});

// time skipped in one go (sleeping, waiting, passing out): needs.js lets people look after themselves meanwhile
{ const _skip = G.World.prototype.skipHours; G.World.prototype.skipHours = function (h) { G.timeSkip = (G.timeSkip || 0) + 1; try { return _skip.call(this, h); } finally { G.timeSkip--; } }; }
