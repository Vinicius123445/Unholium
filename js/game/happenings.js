'use strict';
// Events: things that happen in the world on their own, whether you are there or not.
//   Each event has a map, a time window and a schedule. If you are on that map while it runs you see it
//   play out live; if you are not, it still happens (its outcome is applied, and you may hear about it
//   in the news). Nothing here waits for you or depends on what you do.
//   The island: the midnight ritual in the Grand Temple (with a sacrifice), council meetings at the round
//   table, the masquerade on the plaza, initiations at the stone circle. New captives arrive by boat.
//   Everywhere else: car crashes, store robberies, bar fights, the farmers' market, protests downtown,
//   power cuts, street musicians, weddings at the church, police raids on dealers.
//   The island cells: pick the lock on the bars (lockpick) and the captive inside runs for the boat.
(() => {
const pick = (a) => G.rng.pick(a);
const now = (w) => w.day * 1440 + w.minutes;
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const alive = (scene, id) => scene.actors.find((a) => a.id === id && !a.dead);
const ptOf = (map, name, i = 0) => { const p = map.points[name]; return Array.isArray(p) ? p[i % p.length] : p; };
const CAPTIVES = ['i_captive1', 'i_captive2', 'i_captive3', 'i_captive4', 'i_captive5', 'i_captive6'];
const COUNCIL = ['i_council1', 'i_council2', 'i_council3', 'i_council4', 'i_council5', 'i_council6'];
const CULTISTS = ['i_cultist1', 'i_cultist2', 'i_cultist3', 'i_cultist4', 'i_cultist5', 'i_cultist6'];
const CHANT = ['[Placeholder chant] ...', '*low chanting*', '[Placeholder] As above, so below.', '*the crowd hums in unison*', '[Placeholder] We are the hand that moves.'];

G.happenings = {
  DEFS: {},
  def(id, d) { this.DEFS[id] = Object.assign({ id, hours: 1 }, d); },
  list(w) { return (w.happenings = w.happenings || []); },
  active(w, id) { return this.list(w).find((e) => e.id === id); },
  // send people somewhere and keep them there for the event
  task(npc, tile, barks, o = {}) { if (!npc || npc.dead) return; npc.evTask = Object.assign({ to: tile, barks: barks || null, bt: G.rng.range(2, 8) }, o); npc.sleeping = false; },
  release(scene, ev) { for (const a of scene.actors) if (a.evTask && a.evTask.ev === ev.id) a.evTask = null; scene.actors = scene.actors.filter((a) => !(a.evSpawn && a.evSpawn === ev.id)); },
  spawn(scene, ev, o, tx, ty) {
    const seed = G.util.uid('ev');
    const look = o.look || G.look(seed, o.lookO || {});
    const def = { id: 'ev_' + seed, name: o.name, map: scene.map.id, faction: o.faction || 'civilians', hp: o.hp || 30, combat: o.combat || 'flee', weapon: o.weapon || null, look, transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: tx, y: ty }, act: 'idle' }] };
    const st = { alive: true, name: o.name, map: scene.map.id, hp: def.hp, fear: 0, inv: o.inv || [], gold: o.gold || 5, realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
    const n = new G.NPC(def.id, st, def);
    const spot = scene.map.randomWalkableNear(tx, ty, 2, G.rng, false);
    n.x = spot.x * 16 + 8; n.y = spot.y * 16 + 12; n.evSpawn = ev.id;
    scene.actors.push(n);
    return n;
  },
  // hourly: start what is due, end what is over
  hourly(w, scene) {
    const t = now(w);
    for (const ev of this.list(w).slice()) {
      if (t < ev.end) continue;
      const d = this.DEFS[ev.id], here = scene && scene.map.id === ev.map;
      try { if (d.finish) d.finish(w, here ? scene : null, ev); } catch (e) { G.reportError(e); }
      if (here) this.release(scene, ev);
      w.happenings = this.list(w).filter((x) => x !== ev);
    }
    if (this.off) return;
    for (const id in this.DEFS) {
      const d = this.DEFS[id];
      if (this.active(w, id) || !d.when(w)) continue;
      const ev = { id, map: typeof d.map === 'function' ? d.map(w) : d.map, start: t, end: t + d.hours * 60, data: {} };
      if (!ev.map) continue;
      if (d.setup) d.setup(w, ev);
      this.list(w).push(ev);
    }
  },
  // every frame, for events on the map you are on
  update(scene, dt) {
    const w = scene.world;
    for (const ev of this.list(w)) {
      if (ev.map !== scene.map.id) continue;
      const d = this.DEFS[ev.id];
      if (!ev.live) { ev.live = true; ev.t = (now(w) - ev.start); try { d.begin && d.begin(scene, ev); } catch (e) { G.reportError(e); } }
      ev.t = now(w) - ev.start;   // game minutes since it began
      try { d.tick && d.tick(scene, dt, ev); } catch (e) { G.reportError(e); }
    }
  },
};
const H = G.happenings;
const day = (w) => w.day, hour = (w) => w.hour;
const chance = (w, key, p) => (G.util.hashString(key + w.day + ':' + w.hour) % 1000) / 1000 < p;   // the same every time you look at it

// ================================================================ the island
H.def('ritual', {
  map: 'island', hours: 2,
  when: (w) => day(w) % 3 === 0 && hour(w) === 23,
  setup(w, ev) { ev.data.victim = CAPTIVES.find((id) => w.isAlive(id)) || null; },
  begin(scene, ev) {
    const m = scene.map, v = ev.data.victim && alive(scene, ev.data.victim);
    H.task(alive(scene, 'i_leader'), ptOf(m, 'i_altar'), ['[Placeholder] Brothers. Sisters. The hour has come.', '[Placeholder] Kneel.'], { ev: ev.id, face: 'down' });
    [...COUNCIL, ...CULTISTS].forEach((id, i) => H.task(alive(scene, id), ptOf(m, 'i_congregation', i), CHANT, { ev: ev.id }));
    H.task(alive(scene, 'i_guard4'), { x: 110, y: 48 }, null, { ev: ev.id });
    if (v && !ev.data.done) { const p = ptOf(m, 'i_victim'); v.x = p.x * 16 + 8; v.y = p.y * 16 + 12; H.task(v, p, ['Please... no...', '*sobbing*', 'Somebody help me!'], { ev: ev.id, hold: true }); }
    if (scene.map.buildingAt(scene.player.x, scene.player.y - 3) === m.building('i_temple')) scene.toast('Chanting fills the temple. Something is about to happen.', 'warn');
  },
  tick(scene, dt, ev) {
    if (ev.data.done || ev.t < 45) return;
    ev.data.done = true;
    const v = ev.data.victim && alive(scene, ev.data.victim), lead = alive(scene, 'i_leader');
    if (!v) return;
    if (lead) lead.say('[Placeholder] We give, so that we may keep.', 4);
    v.say('NO! NO!', 2);
    scene.flashRed = 0.8;
    G.combat.damage(v, 9999, lead || null, scene);
    scene.world.flags.lastSacrifice = scene.world.day;
    if (scene.player.distTo(v) < 260) scene.world.log('You witnessed a sacrifice in the Grand Temple.', 'bad');
  },
  finish(w, scene, ev) {
    if (!ev.data.done && ev.data.victim && w.isAlive(ev.data.victim)) {   // it happened while you were away
      w.registerDeath(ev.data.victim, { byPlayer: false, witnessed: false, map: 'island' });
      w.flags.lastSacrifice = w.day;
    }
    if (ev.data.victim) w.rumor('Fishermen say they saw torches on the island again last night. Someone else went missing.', 'city');
  },
});
H.def('council', {
  map: 'island', hours: 2,
  when: (w) => day(w) % 2 === 1 && hour(w) === 20,
  begin(scene, ev) {
    const m = scene.map;
    H.task(alive(scene, 'i_leader'), ptOf(m, 'i_council_head'), ['[Placeholder] Report.', '[Placeholder] The city is ours. Keep it that way.', '[Placeholder] No loose ends.'], { ev: ev.id, sit: true });
    COUNCIL.forEach((id, i) => H.task(alive(scene, id), ptOf(m, 'i_seat' + i), ['[Placeholder] The vote is in.', '[Placeholder] The mayor will do as told.', '[Placeholder] And the journalist?', '[Placeholder] Handled.'], { ev: ev.id, sit: true }));
  },
  finish(w) { w.flags.lastCouncil = w.day; },
});
H.def('masquerade', {
  map: 'island', hours: 3,
  when: (w) => day(w) % 7 === 5 && hour(w) === 21,
  begin(scene, ev) {
    const m = scene.map;
    ['i_leader', ...COUNCIL, ...CULTISTS].forEach((id, i) => H.task(alive(scene, id), ptOf(m, 'i_circle', i), ['*laughter*', '[Placeholder] Champagne?', '*dances*', '[Placeholder] To us.', '*clinks glasses*'], { ev: ev.id, dance: true }));
  },
});
H.def('initiation', {
  map: 'island', hours: 1,
  when: (w) => day(w) % 5 === 2 && hour(w) === 22,
  begin(scene, ev) {
    const m = scene.map;
    H.task(alive(scene, 'i_cultist3'), ptOf(m, 'i_circle_center'), ['[Placeholder] I give myself to the order.', '*kneels*'], { ev: ev.id });
    H.task(alive(scene, 'i_leader'), { x: 110, y: 106 }, ['[Placeholder] Rise. You are one of us now.'], { ev: ev.id });
    [...COUNCIL, ...CULTISTS.filter((c) => c !== 'i_cultist3')].forEach((id, i) => H.task(alive(scene, id), ptOf(m, 'i_circle', i), CHANT, { ev: ev.id }));
  },
});
// new captives come in by boat when the cells are emptying
G.events.on('hour', () => {
  const w = G.world; if (!w || w.hour !== 4) return;
  const live = CAPTIVES.filter((id) => w.isAlive(id) && !w.npcs[id].escaped);
  if (live.length >= 4 || w.day % 4) return;
  const dead = CAPTIVES.find((id) => !w.isAlive(id) || w.npcs[id].escaped);
  if (!dead) return;
  w.reviveAsReplacement(dead, 'Captive');
  w.npcs[dead].map = 'island';
  const scene = sceneNow(); if (scene && scene.map.id === 'island') scene.syncPresence();
});

// ================================================================ everywhere else
const CITYMAPS = ['city', 'southside', 'eastside', 'suburbs'];
H.def('car_crash', {
  map: (w) => pick(CITYMAPS), hours: 1,
  when: (w) => hour(w) >= 7 && hour(w) <= 22 && chance(w, 'crash', 0.04),
  begin(scene, ev) {
    const roads = scene.map.roads || []; if (!roads.length) return;
    const r = pick(roads), along = G.rng.int(r.from + 4, Math.max(r.from + 5, r.to - 4)), lane = r.at + 1;
    const x = r.h ? along : lane, y = r.h ? lane : along;
    for (const k of [0, 1]) { const v = new G.Vehicle({ model: pick(['car_red', 'car_blue', 'car_white', 'car_gray']), x: x * 16 + 8 + k * 26 * (r.h ? 1 : 0), y: y * 16 + 8 + k * 26 * (r.h ? 0 : 1), angle: (r.h ? 0 : Math.PI / 2) + k * 2.6 }); v.wrecked = true; v.hp = 10; v.evSpawn = ev.id; (scene.vehicles = scene.vehicles || []).push(v); }
    const hurt = H.spawn(scene, ev, { name: 'Injured Driver', hp: 30 }, x, y + 2); hurt.hp = 6; hurt.cower = 999; hurt.say('My neck... my neck...', 4);
    const other = H.spawn(scene, ev, { name: 'Angry Driver', combat: 'fight' }, x + 2, y + 2); H.task(other, { x: x + 1, y: y + 2 }, ['You came out of NOWHERE!', 'Look at my car!', 'I am calling my lawyer.'], { ev: ev.id });
    for (const a of scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && a.distTo({ x: x * 16, y: y * 16 }) < 220).slice(0, 4)) H.task(a, scene.map.randomWalkableNear(x, y + 3, 3, G.rng, false), ['Oh my God.', 'Is anyone hurt?', 'Somebody call 911!', '*films it on their phone*'], { ev: ev.id });
    ev.data.at = { x, y };
  },
  tick(scene, dt, ev) {
    if (ev.data.cops || ev.t < 15 || !ev.data.at) return;
    ev.data.cops = true;
    const c = H.spawn(scene, ev, { name: 'Police Officer', faction: 'government', combat: 'guard', hp: 80, weapon: 'pistol', lookO: { top: 'shirt', shirt: '#2a3a6a', pants: '#1e2230', hat: 'cap', hatColor: '#1e2a4a' } }, ev.data.at.x - 3, ev.data.at.y + 3);
    H.task(c, { x: ev.data.at.x - 1, y: ev.data.at.y + 3 }, ['Everybody step back.', 'Ambulance is on the way.', 'License and registration.'], { ev: ev.id });
  },
  finish(w, scene, ev) { if (scene) scene.vehicles = (scene.vehicles || []).filter((v) => v.evSpawn !== ev.id); w.rumor(`A car crash in ${G.maps.get(ev.map).meta.name} today. One driver went to the hospital.`, G.maps.get(ev.map).meta.region); },
});
H.def('robbery', {
  map: (w) => pick(['city', 'southside', 'eastside']), hours: 1,
  when: (w) => (hour(w) >= 20 || hour(w) <= 1) && chance(w, 'rob', 0.05),
  begin(scene, ev) {
    const b = scene.map.buildings.find((x) => /Convenience|Mini-Mart|Bodega|Liquor|Pawn/.test(x.name)) || scene.map.buildings.find((x) => x.kind === 'shop');
    if (!b) return;
    const rob = H.spawn(scene, ev, { name: 'Armed Robber', faction: 'criminals', combat: 'fight', weapon: 'pistol', hp: 40, gold: 0, lookO: { top: 'hoodie', shirt: '#1a1a1e', hat: 'bandana', hatColor: '#1a1a1e' } }, b.doorX, b.doorY - 2);
    H.task(rob, { x: b.doorX, y: b.doorY - 2 }, ['EVERYBODY DOWN!', 'Empty the register! NOW!', 'Nobody move!'], { ev: ev.id });
    for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && scene.map.buildingAt(a.x, a.y - 3) === b && a !== rob) { a.cower = 40; a.st.fear = 100; a.say('Please! Take it, take it!', 3); }
    ev.data.b = b.id; ev.data.rob = rob.id;
  },
  tick(scene, dt, ev) {
    if (ev.data.fled || ev.t < 20 || !ev.data.rob) return;
    ev.data.fled = true;
    const rob = alive(scene, ev.data.rob); if (!rob) return;
    rob.evTask = null; rob.say('Do not follow me!', 2); rob.startFlee(scene.player);
  },
  finish(w, scene, ev) { w.rumor(`Someone robbed a store in ${G.maps.get(ev.map).meta.name} at gunpoint last night.`, G.maps.get(ev.map).meta.region); },
});
H.def('bar_fight', {
  map: (w) => pick(['city', 'southside', 'eastside', 'rural']), hours: 1,
  when: (w) => (hour(w) >= 21 || hour(w) <= 1) && chance(w, 'brawl', 0.06),
  begin(scene, ev) {
    const bar = scene.map.buildings.find((b) => /^Bar$|Tavern|Saloon|Pub|Inn/.test(b.name)); if (!bar) return;
    const inside = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.def.combat !== 'guard' && scene.map.buildingAt(a.x, a.y - 3) === bar);
    let [a, b] = inside;
    if (!a) a = H.spawn(scene, ev, { name: 'Drunk', combat: 'fight', hp: 30 }, bar.doorX - 2, bar.doorY - 2);
    if (!b) b = H.spawn(scene, ev, { name: 'Drunk', combat: 'fight', hp: 30 }, bar.doorX + 2, bar.doorY - 2);
    a.say('What did you say about my mother?!', 3); b.say('You heard me!', 3);
    if (a.def.combat === 'flee') a.startFlee(b); else a.startFight(b, scene);
    if (b.def.combat === 'flee') b.startFlee(a); else b.startFight(a, scene);
  },
  finish(w, scene, ev) { w.rumor(`There was a brawl at the bar in ${G.maps.get(ev.map).meta.name} last night.`, G.maps.get(ev.map).meta.region); },
});
H.def('market', {
  map: 'rural', hours: 5,
  when: (w) => day(w) % 7 === 6 && hour(w) === 8,
  begin(scene, ev) {
    const sq = scene.map.points.r_square; if (!sq) return;
    ev.data.stalls = [];
    for (const [dx, t] of [[-6, 'stall_red'], [-2, 'stall_blue'], [2, 'stall_green'], [6, 'stall_red']]) {
      const x = sq.x + dx, y = sq.y - 2;
      if (scene.map.isSolidTile(x, y) || scene.map.isSolidTile(x + 1, y)) continue;
      ev.data.stalls.push(scene.map.addDecorRuntime(t, x, y));
      H.spawn(scene, ev, { name: 'Market Vendor', hp: 25 }, x, y + 1).say(pick(['Fresh eggs! Fresh milk!', 'Best tomatoes in the county!', 'Homemade jam, two dollars!']), 6);
    }
    for (const a of scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat !== 'guard').slice(0, 8)) H.task(a, scene.map.randomWalkableNear(sq.x, sq.y, 4, G.rng, false), ['How much for the honey?', 'Smells amazing.', 'I will take two.', 'Morning!'], { ev: ev.id });
  },
  finish(w, scene, ev) { if (ev.data.stalls) { const m = scene && scene.map.id === 'rural' ? scene.map : G.maps.get('rural'); for (const d of ev.data.stalls) m.removeDecorRuntime(d); } },   // (also when you were away)
});
H.def('protest', {
  map: 'city', hours: 3,
  when: (w) => day(w) % 6 === 3 && hour(w) === 12,
  begin(scene, ev) {
    const pz = scene.map.points.c_plaza; if (!pz) return;
    for (let k = 0; k < 7; k++) { const n = H.spawn(scene, ev, { name: 'Protester', faction: 'revolutionaries', hp: 25, look: G.REV_LOOK ? G.REV_LOOK('prot' + k + '_' + scene.world.day) : null }, pz.x - 4 + k, pz.y); H.task(n, { x: pz.x - 4 + k, y: pz.y + (k % 2) }, ['EAT THE RICH!', 'NO JUSTICE, NO PEACE!', 'SMASH THE SYSTEM!', 'Silence is violence!', 'Abolish the Mayor! Abolish the Elite! Abolish EVERYTHING!', 'This is what democracy looks like!', 'Wake up, sheeple! ...Wait, that is the other guys.'], { ev: ev.id, march: true }); }
    const cop = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard');
    if (cop) H.task(cop, { x: pz.x, y: pz.y + 4 }, ['Keep it peaceful, folks.', 'Stay on the sidewalk.'], { ev: ev.id });
  },
  finish(w) { w.rumor('A protest downtown today. Signs, chants, a drum circle. Somebody brought a rifle "for solidarity".', 'city'); },
});
H.def('outage', {
  map: (w) => pick(['city', 'southside', 'eastside', 'suburbs']), hours: 2,
  when: (w) => (hour(w) >= 21 || hour(w) <= 2) && chance(w, 'outage', 0.03),
  begin(scene, ev) { ev.data.lights = scene.map.lights; scene.map.lights = []; scene.toast('The power just went out across the district.', 'warn'); },
  finish(w, scene, ev) { if (scene && ev.data.lights) { scene.map.lights = ev.data.lights; scene.toast('The power is back.', 'info'); } w.rumor(`A blackout hit ${G.maps.get(ev.map).meta.name} last night.`, G.maps.get(ev.map).meta.region); },
});
H.def('busker', {
  map: 'city', hours: 3,
  when: (w) => hour(w) === 15 && chance(w, 'busk', 0.35),
  begin(scene, ev) {
    const pz = scene.map.points.c_plaza; if (!pz) return;
    const b = H.spawn(scene, ev, { name: 'Street Musician', hp: 25, gold: 3 }, pz.x + 3, pz.y - 2);
    H.task(b, { x: pz.x + 3, y: pz.y - 2 }, ['*plays guitar*', '♪ ♫ ♪', 'Thank you, thank you!', '*sings off-key*'], { ev: ev.id, music: true });
    for (const a of scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && a.def.combat !== 'guard').slice(0, 3)) H.task(a, scene.map.randomWalkableNear(pz.x + 3, pz.y, 2, G.rng, false), ['*claps*', 'Not bad!', '*drops a coin*'], { ev: ev.id });
  },
});
H.def('wedding', {
  map: 'rural', hours: 2,
  when: (w) => day(w) % 10 === 4 && hour(w) === 11,
  begin(scene, ev) {
    const ch = scene.map.building('r_chapel'); if (!ch) return;
    const cx = ch.doorX, cy = ch.y + 2;
    H.spawn(scene, ev, { name: 'Bride', lookO: { body: 'f', top: 'dress', shirt: '#f4f0ec' } }, cx - 1, cy).say('I do!', 6);
    H.spawn(scene, ev, { name: 'Groom', lookO: { body: 'm', top: 'jacket', shirt: '#1a1a1e', shirt2: '#f0f0f0' } }, cx + 1, cy);
    for (const a of scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && !a.def.kid).slice(0, 6)) H.task(a, scene.map.randomWalkableNear(cx, cy + 3, 2, G.rng, true), ['*sniff* So beautiful.', '*applause*', 'Kiss! Kiss!'], { ev: ev.id });
  },
  finish(w) { w.rumor('Wedding bells at the church this morning. Congratulations to the happy couple!', 'rural'); },
});
H.def('raid', {
  map: (w) => pick(['southside', 'eastside']), hours: 1,
  when: (w) => hour(w) >= 10 && hour(w) <= 18 && chance(w, 'raid', 0.04),
  begin(scene, ev) {
    const dealer = scene.actors.find((a) => a.kind === 'npc' && !a.dead && (a.def.dealer || G.lifestyle.of(a.id) === 'dealer'));
    if (!dealer) return;
    const tx = Math.floor(dealer.x / 16), ty = Math.floor(dealer.y / 16);
    for (let k = 0; k < 3; k++) { const c = H.spawn(scene, ev, { name: 'Police Officer', faction: 'government', combat: 'guard', hp: 80, weapon: 'pistol', lookO: { top: 'shirt', shirt: '#2a3a6a', pants: '#1e2230', hat: 'cap', hatColor: '#1e2a4a' } }, tx - 6 + k * 6, ty + 5); c.say('POLICE! ON THE GROUND!', 3); c.bustQueue = [dealer]; }
    dealer.say(pick(['Oh, come ON.', 'I did not do nothing!', 'Five-oh!']), 3);
  },
  finish(w, scene, ev) { w.rumor(`Police raided a drug spot in ${G.maps.get(ev.map).meta.name}.`, G.maps.get(ev.map).meta.region); },
});

// ================================================================ people doing their part
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  const t = this.evTask;
  if (t && !this.dead && !this.talking && (this.state === 'schedule' || t.hold) && !(this.cower > 0)) {
    if (!t.to) { this.evTask = null; return _nu.call(this, dt, scene); }
    if (!this.arrived(t.to) && !t.hold) { this.walkTo(t.to, dt, scene); this.holdTick(dt, scene); return; }
    this.moving = false;
    if (t.face === 'down') this.dir = 0;
    if (t.dance && Math.random() < dt * 2) this.dir = G.rng.int(0, 3);
    if (t.march && Math.random() < dt * 0.4) { this.walkTo({ x: t.to.x + G.rng.int(-1, 1), y: t.to.y }, dt, scene); }
    if (t.music && Math.random() < dt * 3) scene.particles(this.x + 6, this.y - 22, pick(['#f0e080', '#80d0f0', '#f0a0d0']), 1);
    if (t.barks && (t.bt -= dt) <= 0) { t.bt = G.rng.range(4, 10); this.say(pick(t.barks), 3); }
    this.holdTick(dt, scene);
    return;
  }
  return _nu.call(this, dt, scene);
};
// escaped captives make a life in the city (clothed: they found something to wear)
const _list = NP.scheduleList;
NP.scheduleList = function () { return this.st.escaped ? [{ from: 0, to: 24, at: 'c_plaza', act: 'wander' }] : _list.call(this); };
// a red flash for the sacrifice
const GS = G.GameScene.prototype, _fx = GS.renderScreenFx, _gu = GS.update, _load = GS.loadMap;
GS.renderScreenFx = function (ctx) {
  _fx.call(this, ctx);
  if (this.flashRed > 0) { const R = G.renderer; R.screenTransform ? R.screenTransform() : R.uiTransform(); ctx.fillStyle = `rgba(160,0,10,${Math.min(0.6, this.flashRed)})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
};
GS.update = function (dt) { const r = _gu.call(this, dt); if (this.flashRed > 0) this.flashRed -= dt; if (this.map) H.update(this, dt); return r; };
GS.loadMap = function (id, spawnName, pos) {
  for (const ev of H.list(this.world)) if (ev.live) { ev.live = false; if (this.map && ev.map === this.map.id) { if (ev.data.lights) this.map.lights = ev.data.lights; this.release(ev); } }
  return _load.call(this, id, spawnName, pos);
};
GS.release = function (ev) { H.release(this, ev); };
G.events.on('hour', () => { const w = G.world; if (w) H.hourly(w, sceneNow()); });

// ================================================================ the cells
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact !== 'cell') return _use.call(this, d, scene);
  const p = scene.player;
  if (!p.inventory.has('lockpick')) { scene.toast('Locked bars. You would need a lockpick.', 'bad'); return; }
  G.doors.pick(scene, 3, () => {
    const map = scene.map, cellX = 81 + Math.floor((d.tx - 81) / 4) * 4;
    for (const b of map.decorsAt ? map.decor.filter((x) => x.type === 'cell_bars' && x.ty === d.ty && x.tx >= cellX && x.tx < cellX + 3) : []) G.mods.removeDecor(map, b);
    scene.toast('The bars swing open.', 'good');
    for (const a of scene.actors) {
      if (!a.def.captive || a.dead || Math.abs(Math.floor(a.x / 16) - (cellX + 1)) > 2 || Math.floor(a.y / 16) > d.ty) continue;
      a.say(pick(['Thank you... THANK YOU!', 'I owe you my life!']), 3);
      G.social.addDisp(scene.world, a.id, 60); G.fame.remember(scene.world, a.id, 'rescued');
      H.task(a, map.points.i_ferry, null, { ev: 'escape', run: true });
      a.escaping = true;
    }
    const guard = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'elite' && a.def.combat === 'fight' && a.canSee(scene, p, 140));
    if (guard) { guard.say('INTRUDER! Stop them!', 3); for (const a of scene.actors) if (a.kind === 'npc' && a.def.faction === 'elite' && !a.dead) a.st.hostile = true; }
  });
};
// a freed captive who reaches the boat is gone from the island
const _nu2 = NP.update;
NP.update = function (dt, scene) {
  if (this.escaping && !this.dead && scene.map.points.i_ferry && this.arrived(scene.map.points.i_ferry)) {
    this.escaping = false; this.evTask = null; this.st.escaped = true; this.st.map = 'city'; this.st.lookSeed = 'freed-' + this.id;
    scene.actors = scene.actors.filter((a) => a !== this);
    scene.world.log('A captive you freed got away on the boat.', 'good');
    if (G.fame) G.fame.add(scene.world, 'good', 20);
    return;
  }
  return _nu2.call(this, dt, scene);
};
})();
