'use strict';
// People move around the city.
//   Trips: in their free time people sometimes head to a neighboring district — shopping downtown, a drink
//   at the bar, the casino, the park. They walk to the edge of the map and leave; on the other map they come
//   in where the road enters, do their thing there for a few hours (errands from js/game/lifestyle.js),
//   then walk back out and go home. While you are elsewhere the same trips happen off screen.
//   Called over: when someone agrees to come to you (phone or text), they set off from wherever they are
//   and walk in from the edge of your map (or from where they are, if they are already here).
(() => {
G.travel = {
  // the exit on `map` leading to `to`
  exitTo(map, to) { return map.exits.find((e) => e.to === to) || null; },
  neighbors(mapId) { return [...new Set(G.maps.get(mapId).exits.map((e) => e.to))].filter((id) => G.MAPGEN[id] && id !== 'island' && id !== 'jail'); },
  WANTS: { worker: ['city', 'suburbs'], shopkeeper: ['city'], gang: ['southside', 'eastside', 'city'], dealer: ['city', 'southside', 'eastside'], rich: ['heights', 'city'], homeless: ['city'], retiree: ['suburbs', 'city'], farmer: ['rural', 'suburbs', 'city'], teen: ['suburbs', 'city'], kid: [] },
  canTravel(id, st, w) {
    const d = G.NPCS[id];
    if (!d || d.transient || d.kid === 'kid' || d.combat === 'guard' || d.shop || d.leader || st.companion || st.visiting || st.trip || !st.alive || w.jail) return false;
    if (w.hour < 8 || w.hour >= 18) return false;   // trips are daytime things; evenings are for home
    const e = G.beds.entryNow(id, w);
    return !e || (e.act !== 'sleep' && e.act !== 'work' && e.act !== 'patrol');
  },
  pickDestination(id) {
    const life = G.lifestyle.of(id), home = G.NPCS[id].map, near = this.neighbors(home);
    const wants = (this.WANTS[life] || []).filter((m) => near.includes(m));
    return wants.length ? G.rng.pick(wants) : null;
  },
  // NPC on screen decides to go
  start(npc, scene, to) {
    if (to === scene.map.id || npc.def.map !== scene.map.id) return false;   // only from home, and never "to" where they already are
    const ex = this.exitTo(scene.map, to);
    if (!ex) return false;
    npc.st.trip = { to, back: npc.def.map, until: G.effects.now() + G.rng.int(120, 300), stage: 'leaving' };
    npc.errand = null; npc.goal = null;
    if (npc.distTo(scene.player) < 200) npc.say(G.rng.pick([`Heading over to ${G.maps.get(to).meta.name}.`, 'I need to get out of the neighborhood for a bit.', 'Off to town.']), 3);
    return true;
  },
  // walk to the map edge; leave; (and later) come back the same way
  update(npc, dt, scene) {
    const st = npc.st, t = st.trip;
    if (!t || npc.state !== 'schedule' || npc.talking || st.companion) return false;
    const map = scene.map;
    if (t.stage === 'leaving' || t.stage === 'returning') {
      const target = t.stage === 'leaving' ? t.to : t.back;
      // no road straight there: they still leave by a real way out (the nearest), never vanish on the spot
      const ex = this.exitTo(map, target) || (map.exits || []).slice().sort((a, b) => Math.hypot(a.x * 16 - npc.x, a.y * 16 - npc.y) - Math.hypot(b.x * 16 - npc.x, b.y * 16 - npc.y))[0];
      if (!ex) { if (!scene.isOnScreen(npc.x, npc.y)) this.arriveElsewhere(npc, scene, target); return true; }
      const pt = { x: Math.min(map.w - 1, Math.max(0, ex.x + Math.floor(ex.w / 2))), y: Math.min(map.h - 1, Math.max(0, ex.y + Math.floor(ex.h / 2))) };
      if (Math.hypot(npc.x - (pt.x * 16 + 8), npc.y - (pt.y * 16 + 12)) < 22 || ((t.walk = (t.walk || 0) + dt) > 90 && !scene.isOnScreen(npc.x, npc.y))) {   // never vanish in plain sight
 this.arriveElsewhere(npc, scene, target); return true; }
      npc.walkTo(pt, dt, scene);
      return true;
    }
    // visiting: do things here until it is time to head home
    if (G.effects.now() > t.until && map.id !== npc.def.map) { t.stage = 'returning'; t.walk = 0; npc.errand = null; return true; }
    if (map.id === npc.def.map) { st.trip = null; return false; }
    if (!npc.errand) npc.errand = G.lifestyle.pick(npc, scene);
    return npc.errand ? G.lifestyle.update(npc, dt, scene) : false;
  },
  arriveElsewhere(npc, scene, target) {
    const st = npc.st, t = st.trip;
    scene.actors = scene.actors.filter((a) => a !== npc);
    st.map = target;
    st.arriveFrom = scene.map.id;
    if (target === npc.def.map) { st.trip = null; } else t.stage = 'visiting';
  },
  // when a map loads: travelers come in where the road from their home enters
  placeArrivals(scene, before = new Set()) {
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.transient || a.st.companion || a.st.visiting || before.has(a)) continue;
      const st = a.st;
      if (st.map === a.def.map && !st.arriveFrom) continue;
      if (st.map !== a.def.map || st.arriveFrom) {
        const from = st.arriveFrom || (st.trip && st.trip.back) || a.def.map;
        const ex = this.exitTo(scene.map, from);
        const sp = ex && scene.map.points[Object.keys(scene.map.points).find((k) => k === 'from_' + from)];
        const pt = sp || (ex ? { x: ex.x, y: ex.y } : null);
        if (pt) { const t = scene.map.randomWalkableNear(Math.min(scene.map.w - 2, Math.max(1, pt.x)), Math.min(scene.map.h - 2, Math.max(1, pt.y)), 3); a.x = t.x * 16 + 8; a.y = t.y * 16 + 12; }
        st.arriveFrom = null;
      }
    }
  },
  // every hour: people decide to go places (on screen they walk; elsewhere they just go)
  hourly(scene) {
    if (this.off) return;   // tests that need everyone where they live
    const w = scene.world, now = G.effects.now();
    for (const id in w.npcs) {
      const st = w.npcs[id];
      // trips that ran their course off screen end at home
      if (st.trip && st.map !== scene.map.id && now > st.trip.until) { const from = st.map; st.map = G.NPCS[id].map; st.trip = null; st.arriveFrom = from; if (st.map === scene.map.id) scene.syncPresence(); else st.arriveFrom = null; continue; }
      if (!this.canTravel(id, st, w) || Math.random() > 0.05) continue;
      const to = this.pickDestination(id);
      if (!to) continue;
      const here = scene.actors.find((a) => a.id === id);
      if (here) this.start(here, scene, to);
      else if (st.map === G.NPCS[id].map) { st.trip = { to, back: G.NPCS[id].map, until: now + G.rng.int(120, 300), stage: 'visiting' }; st.map = to; st.arriveFrom = G.NPCS[id].map; if (scene.map.id === to) scene.syncPresence(); }
    }
  },
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.st.trip && !this.dead && !this.talking && this.state === 'schedule') {
    this.baseUpdate(dt, scene.map);
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (G.travel.update(this, dt, scene)) return;
  }
  return _nu.call(this, dt, scene);
};
const GS = G.GameScene.prototype, _load = GS.loadMap, _resync = GS.resyncNPCs, _gu = GS.update;
GS.loadMap = function (id, spawnName, pos) { _load.call(this, id, spawnName, pos); G.travel.placeArrivals(this); };
// Someone new arrives on this map: add just them. (A full resync re-placed everybody on the map by their
// schedule, so people visibly jumped across the street or vanished every time anyone came or went.)
GS.syncPresence = function () {
  const before = new Set(this.actors), have = new Set(this.actors.map((a) => a.id)), w = this.world;
  for (const id in w.npcs) {
    const st = w.npcs[id];
    if (!st.alive || st.map !== this.map.id || have.has(id) || !G.NPCS[id]) continue;
    const npc = new G.NPC(id, st);
    npc.placeBySchedule(this.map, w);
    this.actors.push(npc);
  }
  G.travel.placeArrivals(this, before);
  // nobody materializes in front of you: if their spot is in view, they start just out of sight and walk over
  for (const a of this.actors) {
    if (before.has(a) || a.kind !== 'npc' || a.st.companion || !this.isOnScreen(a.x, a.y)) continue;
    const m = this.map, cx = Math.floor(a.x / 16), cy = Math.floor(a.y / 16);
    let spot = null;
    for (let r = 8; r <= 40 && !spot; r += 4) for (let k = 0; k < 16 && !spot; k++) {
      const ang = (k / 16) * Math.PI * 2, x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
      if (m.inBounds(x, y) && !m.isSolidTile(x, y) && !this.isOnScreen(x * 16 + 8, y * 16 + 12) && m.buildingAtTile(x, y) === m.buildingAtTile(cx, cy)) spot = { x, y };
    }
    if (spot) { a.x = spot.x * 16 + 8; a.y = spot.y * 16 + 12; a.sleeping = false; a.path = null; }
  }
};
GS.resyncNPCs = function () { const before = new Set(this.actors); _resync.call(this); G.travel.placeArrivals(this, before); };
// people you called come to you, from wherever they are (checked every couple of seconds, not hourly)
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if ((this.callT = (this.callT || 0) - dt) > 0) return r;
  this.callT = 2;
  const w = this.world, now = G.effects.now();
  for (const id in w.npcs) {
    const st = w.npcs[id];
    if (!st.comingTo || !st.alive || st.comingTo.at > now) continue;
    st.comingTo = null; st.trip = null;
    const already = this.actors.find((a) => a.id === id);
    st.companion = true; st.compWait = false;
    if (!already) { st.arriveFrom = st.map !== this.map.id ? st.map : null; st.map = this.map.id; this.syncPresence(); }
    const a = this.actors.find((x) => x.id === id);
    if (a) a.say(G.rng.pick(['There you are!', 'Found you.', 'Okay, I am here. What is the plan?']), 3);
    if (G.phone.isContact(w, id)) G.phone.queue(w, id, 'Here!', 0);
  }
  return r;
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && G.world) G.travel.hourly(scene);
});
// travel time when someone is called over depends on how far they are
const _meet = G.DIALOGUE_NODES._call_meet;
G.DIALOGUE_NODES._call_meet = (r) => {
  const res = _meet(r), st = r.npc.st, scene = r.scene;
  if (st.comingTo) {
    const from = st.map || G.NPCS[r.npc.id].map, far = from === scene.map.id ? 0 : G.travel.neighbors(from).includes(scene.map.id) ? 1 : 2;
    st.comingTo.at = G.effects.now() + [G.rng.int(8, 20), G.rng.int(25, 50), G.rng.int(45, 90)][far];
  }
  return res;
};
})();
