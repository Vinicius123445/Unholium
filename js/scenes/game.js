'use strict';
// GameScene: the playable world. Owns the current map, actors, containers, effects, lighting,
// interaction, crimes/witnesses, map transitions, sleeping/waiting, jail and endings.

class GameScene {
  constructor(opts = {}) {
    this.transparent = false;
    this.toasts = [];
    this.floaters = [];
    this.parts = [];
    this.banner = null;
    this.promptTarget = null;
    this.arrestCooldown = 0;
    this.pathBudget = 0;
    this.playerLit = false;
    this.time = 0;
    this.deathT = -1;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    let mapId, spawn = null, pos = null;
    if (opts.save) {
      G.maps.reset();
      G.world = new G.World(opts.save.world);
      if (!G.world.mapMods) G.world.mapMods = {};
      this.player = G.Player.from(opts.save.player);
      mapId = opts.save.mapId;
      pos = { x: this.player.x, y: this.player.y };
      this.restorePositions = true;
    } else {
      G.world = G.World.createNew();
      this.player = new G.Player();
      const p = this.player, inv = p.inventory, cr = opts.create;
      if (cr) {
        p.playerName = cr.name;
        p.look = cr.look;
        inv.add(cr.top); p.equipFromSlot(0);
        inv.add(cr.bottom); p.equipFromSlot(0);
      }
      // nothing in your pockets: your things are in the drawer in your bedroom (js/game/lootables.js)
      G.world.flags.startStashPending = true;
      p.refreshSprite();
      p.hp = p.maxHp;
      mapId = 'rural';
      spawn = 'start';
    }
    this.world = G.world;
    G.player = this.player;
    this.bullets = [];
    this.flashes = [];
    this.phantoms = [];
    this.gunCrimeT = 0;
    this.mouseSeenT = 0;
    this.spawnT = 0;
    this.zoneNotice = {};
    this.unsubs = [
      G.events.on('mapInvalidated', (id) => { if (this.map && this.map.id === id) this.reloadMapInPlace(); }),
      G.events.on('log', (text, type) => this.toast(text, type)),
      G.events.on('toast', (text, type) => this.toast(text, type)),
      G.events.on('giveGold', (n) => { this.player.gold += n; this.toast(`+$${n}`, 'good'); G.audio.play('coin'); }),
      G.events.on('giveItem', (id, n) => { const left = this.player.inventory.add(id, n); if (left) G.containers.createBag(this.world, this.map.id, this.player.x, this.player.y, [[id, left]]); }),
      G.events.on('repChanged', (k, n) => { const name = (G.REGIONS[k] || G.FACTIONS[k] || { name: k }).name; this.toast(`${name} reputation ${n > 0 ? '+' : ''}${n}`, n > 0 ? 'good' : 'bad'); }),
      G.events.on('xp', (n, reason) => G.skills.addXp(this.player, n, reason, this)),
      G.events.on('hour', () => { if (!this.player.dead) G.effects.hourly(this.player, this); }),
    ];
    this.loadMap(mapId, spawn, pos);
    if (!opts.save) G.saves.write('auto', this);
  }

  exit() { this.unsubs.forEach((u) => u()); }

  get region() { return this.map.meta.region; }

  // ------------------------------------------------------------ map loading
  loadMap(id, spawnName, pos) {
    const w = this.world;
    // picked mushrooms grow back after 3 days (the map is rebuilt to bring them back)
    const foraged = w.foraged || {}, mine = Object.keys(foraged).filter((k) => k.startsWith('forage_' + id + '_'));
    if (mine.some((k) => w.day - foraged[k] >= 3)) { for (const k of mine) if (w.day - foraged[k] >= 3) delete foraged[k]; delete G.maps.cache[id]; }
    this.map = G.maps.get(id);
    for (const k of mine) if (foraged[k] != null) { const [tx, ty] = k.split('_').slice(-2).map(Number); for (const d of this.map.decorsAt(tx, ty).slice()) if (d.def.forage && d.def.flat) this.map.removeDecorRuntime(d); }
    const firstVisit = !w.flags['visited_' + id];
    w.flags['visited_' + id] = true;
    if (firstVisit && id !== 'rural') G.events.emit('xp', G.XP.newPlace, 'Discovery');
    this.bullets = [];
    this.flashes = [];
    this.phantoms = [];
    const p = this.player;
    if (pos) { p.x = pos.x; p.y = pos.y; }
    else {
      const sp = this.map.points[spawnName] || this.map.points.start || { x: this.map.w / 2, y: this.map.h / 2 };
      p.x = sp.x * 16 + 8;
      p.y = sp.y * 16 + 12;
    }
    p.kbx = p.kby = 0;
    this.arrivedT = 0;   // (exits wait a moment before they can take you anywhere)
    if (this.fire) this.fire.reset(this.map); else this.fire = new G.FireSystem(this);
    this.tileHp = {};
    this.actors = [p];
    this.spawnNPCs();
    this.spawnAnimals();
    G.containers.ensureChests(w, this.map);
    this.refreshContainers();
    for (const b of this.map.buildings) b.roofAlpha = 1;
    this.residents = {};
    for (const nid in G.NPCS) {
      const h = G.NPCS[nid].home;
      if (h && G.NPCS[nid].map === id) (this.residents[h] = this.residents[h] || []).push(nid);
    }
    this.restorePositions = false;
    G.renderer.follow(p.x, p.y - 8, this.map.pw, this.map.ph, 1, true);
    this.banner = this.map.meta.wilds ? null : { text: this.map.meta.name, sub: `Day ${w.day} · ${w.timeString}`, t: 3.5 };   // the woods announce nothing
    this.updateMusic(true);
  }

  spawnNPCs() {
    const w = this.world;
    for (const id in w.npcs) {
      const st = w.npcs[id];
      if (!st.alive || st.map !== this.map.id) continue;
      const npc = new G.NPC(id, st);
      if (this.restorePositions && st.x != null) { npc.x = st.x; npc.y = st.y; }
      else npc.placeBySchedule(this.map, w);
      st.x = st.y = null;
      this.actors.push(npc);
    }
  }

  spawnAnimals() {
    const w = this.world, map = this.map;
    map.animalZones.forEach((z, i) => {
      const key = map.id + ':' + i;
      const pop = w.wildlife[key];
      if (!pop) return;
      for (let n = 0; n < pop.count; n++) {
        for (let tries = 0; tries < 20; tries++) {
          const tx = z.x + G.rng.int(0, z.w - 1), ty = z.y + G.rng.int(0, z.h - 1);
          if (map.isSolidTile(tx, ty)) continue;
          const x = tx * 16 + 8, y = ty * 16 + 12;
          if (G.util.dist(x, y, this.player.x, this.player.y) < 80) continue;
          this.actors.push(new G.Animal(z.kind, x, y, key, Object.assign({ region: map.meta.region }, z)));
          break;
        }
      }
    });
  }

  refreshContainers() {
    this.containers = G.containers.forMap(this.world, this.map.id);
  }

  // The current map was regenerated (rebuilding, regrowth): swap it in, keep everyone where they are.
  reloadMapInPlace() {
    this.map = G.maps.get(this.map.id);
    this.fire.reset(this.map);
    G.containers.ensureChests(this.world, this.map);
    this.refreshContainers();
  }

  // ------------------------------------------------------------ street spawns
  // Criminals and punks appear in each map's danger zones at night; gang members hang around the
  // territories their gang owns (more at night); gang war attacks spawn their fighters.
  // Spawns whose zone no longer applies (dawn, the block changed hands) leave once out of sight.
  spawnZones() {
    const zones = this.world.isNight() ? (this.map.dangerZones || []).map((z, i) => Object.assign({ key: 'dz' + i }, z)) : [];
    return zones.concat(G.gangWar.zones(this));
  }

  updateNightSpawns(dt) {
    if ((this.spawnT -= dt) > 0) return;
    this.spawnT = 2;
    const zones = this.spawnZones();
    const quota = {};
    for (const z of zones) for (const kind in z.spawns) quota[z.key + '|' + kind] = z.spawns[kind];
    const count = {};
    this.actors = this.actors.filter((a) => {
      if (!a.transient || a.dead || a.raidSide || a.law || a.cleanupSite || a.evSpawn || a.crash || a.downT > 0) return true;   // (only night street spawns are trimmed here)
      const k = a.zoneKey + '|' + a.spawnKind;
      count[k] = (count[k] || 0) + 1;
      const extra = count[k] > (quota[k] || 0);
      return !(extra && a.state === 'schedule' && !this.isOnScreen(a.x, a.y));
    });
    for (const z of zones) {
      for (const kind in z.spawns) {
        const have = this.actors.filter((a) => a.transient && !a.dead && !a.raidSide && a.zoneKey === z.key && a.spawnKind === kind).length;
        if (have < z.spawns[kind]) this.spawnTransient(kind, z);
      }
    }
    G.gangWar.updateScene(this);
    // raid fighters leave after the attack is over
    const raid = this.world.raid;
    this.actors = this.actors.filter((a) => !(a.raidSide && !a.dead && (!raid || a.zoneKey !== 'raid:' + raid.id) && a.state === 'schedule' && !this.isOnScreen(a.x, a.y)));
  }

  spawnTransient(kind, z) {
    const map = this.map, tpl = G.NIGHT_SPAWNS[kind];
    const free = () => {
      for (let i = 0; i < 30; i++) {
        const x = z.x + G.rng.int(0, z.w - 1), y = z.y + G.rng.int(0, z.h - 1);
        if (!map.isSolidTile(x, y) && !map.buildingAtTile(x, y)) return { x, y };
      }
      return null;
    };
    const at = free();
    if (!at || this.isOnScreen(at.x * 16 + 8, at.y * 16 + 12)) return null;
    const route = [at, free() || at, free() || at, free() || at];
    const seed = G.util.uid('n');
    const look = tpl.look(seed);
    const gender = look.body === 'f' ? 'female' : 'male';
    const def = {
      id: 'night_' + seed, name: tpl.name, map: map.id, faction: tpl.faction, hp: tpl.hp, combat: tpl.combat, weapon: tpl.weapon,
      look, gender, mugger: !!tpl.mugger, transient: true, relations: {},
      schedule: [{ from: 0, to: 24, at: route, act: 'patrol' }],
    };
    const st = {
      alive: true, name: tpl.name, map: map.id, hp: tpl.hp, hostile: false, mood: null, fear: 0,
      inv: tpl.weapon ? [[tpl.weapon, 1]].concat(G.ITEMS[tpl.weapon].gun ? [[G.ITEMS[tpl.weapon].ammo, G.rng.int(3, 10)]] : []) : [],
      gold: G.rng.int(tpl.gold[0], tpl.gold[1]),
      realName: G.randomName(G.rng, gender, tpl.streetName), introduced: false, talked: 0,
    };
    const npc = new G.NPC(def.id, st, def);
    npc.x = at.x * 16 + 8;
    npc.y = at.y * 16 + 12;
    npc.zoneKey = z.key;
    npc.spawnKind = kind;
    this.actors.push(npc);
    return npc;
  }

  startMugging(npc) {
    if (G.scenes.top() !== this) return;
    this.openDialogue(npc, '_mugging');
  }

  // Night warnings when entering dangerous zones; discovering the revolutionaries' meeting place.
  checkZones() {
    const p = this.player, w = this.world;
    const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
    if (w.isNight()) {
      (this.map.dangerZones || []).forEach((z, i) => {
        const key = this.map.id + i + ':' + w.day;
        if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h && !this.zoneNotice[key]) {
          this.zoneNotice[key] = true;
          this.toast(`${z.name}: dangerous after dark.`, 'warn');
        }
      });
    }
    // gang territory
    const terr = G.gangWar.at(this.map.id, tx, ty);
    if (terr !== this.lastTerritory) {
      this.lastTerritory = terr;
      if (terr) {
        const owner = w.territories[terr].owner;
        this.toast(`${G.TERRITORIES[terr].name}: ${owner ? G.FACTIONS[owner].name + ' territory' : 'nobody\'s turf'}.`, owner && !w.isMember(owner) ? 'warn' : 'info');
      }
    }
    // the Elite's sanctum: their secret gathering, late at night
    const club = this.map.meta.elite && this.map.building(this.map.meta.elite);
    if (club && club.sanctum) {
      const s = club.sanctum;
      const inside = tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h;
      const gathered = this.actors.filter((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'elite' && a.def.combat === 'flee' &&
        a.x / 16 >= s.x && a.x / 16 < s.x + s.w && a.y / 16 >= s.y && a.y / 16 < s.y + s.h);
      if (inside && gathered.length >= 2) {
        if (!w.flags.knows_elite_cult) {
          w.flags.knows_elite_cult = true;
          w.log('You found the Elite gathered in secret beneath their club. [Placeholder]', 'quest');
          G.events.emit('xp', 50, 'Discovery');
        }
        if (!w.isMember('elite') && w.flags.elite_caught !== w.day && gathered.some((a) => a.canSee(this, p, 80))) {
          w.flags.elite_caught = w.day;
          w.addRep('elite', -15);
          this.toast('They saw you. This was not meant for outsiders.', 'bad');
          if (w.getRep('elite') < -10) for (const a of this.actors) if (a.kind === 'npc' && !a.dead && a.def.faction === 'elite' && a.def.combat !== 'flee') a.startFight(p, this);
        }
      }
    }
    const r = this.map.meta.ruins;
    if (r && !w.flags.knows_rev_hideout && tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h &&
      this.actors.some((a) => a.kind === 'npc' && !a.dead && a.def.faction === 'revolutionaries' && a.distTo(p) < 100)) {
      w.flags.knows_rev_hideout = true;
      w.log('You found the secret meeting place of the revolutionaries.', 'quest');
    }
  }

  // Re-place everyone according to their schedules (after sleeping, waiting, jail).
  resyncNPCs() {
    this.actors = this.actors.filter((a) => !a.transient);
    for (const a of this.actors) {
      if (a.kind === 'npc' && !a.dead && a.state === 'schedule') a.placeBySchedule(this.map, this.world);
    }
    const alive = new Set(this.actors.map((a) => a.id));
    for (const id in this.world.npcs) {
      const st = this.world.npcs[id];
      if (st.alive && st.map === this.map.id && !alive.has(id)) {
        const npc = new G.NPC(id, st);
        npc.placeBySchedule(this.map, this.world);
        this.actors.push(npc);
      }
    }
    // replaced NPCs (e.g. new guard recruits) need a fresh entity bound to the new state object
    this.actors = this.actors.map((a) => (a.kind === 'npc' && a.st !== this.world.npcs[a.id] && this.world.npcs[a.id].alive ? (() => { const n = new G.NPC(a.id, this.world.npcs[a.id]); n.placeBySchedule(this.map, this.world); return n; })() : a));
    this.actors = this.actors.filter((a) => !(a.kind === 'animal') && !a.transient);
    this.spawnAnimals();
  }

  changeMap(id, spawnName) {
    if (this.transitioning) return;
    this.transitioning = true;
    G.audio.play('door');
    G.scenes.push(new G.FadeScene(() => {
      this.loadMap(id, spawnName);
      this.transitioning = false;
      this.autosaveAt = this.time + 1.2;   // (not in the middle of arriving)
    }, G.TRANSITION));
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const I = G.input, w = this.world, p = this.player;
    this.time += dt;
    if (this.autosaveAt && this.time >= this.autosaveAt) { this.autosaveAt = 0; G.saves.write('auto', this); }
    if (!p.dead) w.advance(dt);

    if (I.wasPressed('pause')) { G.scenes.push(new G.PauseScene(this)); return; }
    if (!p.dead) {
      if (I.wasPressed('inventory')) { G.scenes.push(new G.InventoryScene(this)); return; }
      if (I.wasPressed('journal')) { if (G.phone.has(p)) G.phone.openApp(this, 'journal'); else this.toast('Your journal is on your phone. You do not have it.', 'bad'); return; }
      if (I.wasPressed('map')) { G.scenes.push(G.phone.has(p) ? new G.PhoneScene(this, 'maps') : new G.MapScene(this)); return; }
      if (I.wasPressed('skills')) { if (G.phone.has(p)) G.phone.openApp(this, 'skills'); else this.toast('Your skills are on your phone. You do not have it.', 'bad'); return; }
      if (I.wasPressed('drag')) G.bodies.toggle(this);
      if (I.wasPressed('phone')) { if (G.phone.has(p)) { G.scenes.push(new G.PhoneScene(this)); return; } this.toast('You do not have your phone.'); }
      if (I.pressed.has('Enter') && this.promptTarget && this.promptTarget.type === 'npc' && !this.promptTarget.ref.sleeping) { this.talkTo(this.promptTarget.ref); const top = G.scenes.top(); if (top instanceof G.DialogueScene) { top.typing = true; top.input = ''; } return; }
      if (I.wasPressed('minimap')) { G.settings.set('showMinimap', !G.settings.get('showMinimap')); this.toast(G.settings.get('showMinimap') ? 'Minimap on.' : 'Minimap hidden.'); }
      if (this.pendingPassOut) { const r = this.pendingPassOut; this.pendingPassOut = null; this.passOut(r); }
      if (this.pendingBedReaction) { const n = this.pendingBedReaction; this.pendingBedReaction = null; G.beds.react(this, n); return; }
      if (I.wasPressed('wait')) { this.tryWait(); return; }
      if (I.wasPressed('quicksave')) { this.toast(G.saves.write('quick', this) ? 'Quicksaved.' : 'Save failed.'); }
      // (G.GameScene, not the bare class: js/game/worldfile.js swaps in a subclass, and everything that looks for
      // the running game by `instanceof G.GameScene` (melee hits, among others) found nothing after a quickload)
      if (I.wasPressed('quickload')) { const d = G.saves.read('quick'); if (d) { G.startGame({ save: d }); return; } this.toast('No quicksave.'); }
    }
    if (I.wasPressed('debug')) this.debug = !this.debug;

    if (this.arrestCooldown > 0) this.arrestCooldown -= dt;
    this.pathBudget = 12;
    const lt = w.lighting();
    this.playerLit = lt.dark > 0.3 && (p.hasTorch() || this.nearLight(p.x, p.y));

    for (const a of this.actors) a.update(dt, this);
    // remove the dead, and anyone who died elsewhere in the simulation (e.g. a raid)
    this.actors = this.actors.filter((a) => a === p || (!a.dead && !(a.kind === 'npc' && !a.transient && !a.st.alive)));
    this.separate();
    G.firearms.update(this, dt);
    G.bodies.update(this, dt);
    G.jail.update(this, dt);
    if ((this.textT = (this.textT || 0) - dt) <= 0) { this.textT = 1; G.phone.deliver(w, this); }
    if (this.gunCrimeT > 0) this.gunCrimeT -= dt;
    if (I.mouse.moved) this.mouseSeenT = 3; else if (this.mouseSeenT > 0) this.mouseSeenT -= dt;
    this.updatePhantoms(dt);
    this.fire.update(dt);
    this.updateNightSpawns(dt);
    this.checkZones();

    // exits
    if (!p.dead && !this.transitioning) {
      const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
      // a generous zone around every exit: the whole road plus a margin along the edge (never inward: you
      // arrive a tile inside the edge, and must not bounce straight back out)
      if ((this.arrivedT = (this.arrivedT || 0) + dt) > 0.6) for (const e of this.map.exits) {
        const ax = e.w >= e.h ? 2 : 0, ay = e.w >= e.h ? 0 : 2;
        if (tx >= e.x - ax && tx < e.x + e.w + ax && ty >= e.y - ay && ty < e.y + e.h + ay) { this.changeMap(e.to, e.spawn); break; }
      }
    }

    const pb = this.map.buildingAt(p.x, p.y - 3);
    this.map.updateRoofs(dt, pb);
    const h = w.hourF;
    for (const b of this.map.buildings) {
      const res = this.residents[b.id] || [];
      b.lit = (h >= 18 && h < 23.5 || h >= 5 && h < 7) && res.some((id) => w.isAlive(id));
    }

    G.renderer.follow(p.x, p.y - 8, this.map.pw, this.map.ph, dt);
    this.promptTarget = p.dead ? null : this.findInteraction();

    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const f of this.floaters) { f.t -= dt; f.y -= dt * 18; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    for (const q of this.parts) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; }
    this.parts = this.parts.filter((q) => q.t > 0);
    if (this.banner) this.banner.t -= dt;

    if (p.dead && this.deathT >= 0) {
      this.deathT -= dt;
      if (this.deathT < 0) G.scenes.push(new G.DeathScene(this));
    }
    this.musicT = (this.musicT || 0) - dt;
    if (this.musicT <= 0) { this.musicT = 1; this.updateMusic(); }
  }

  // Keep the player from overlapping NPCs/animals (NPCs themselves pass through each other).
  separate() {
    const p = this.player;
    for (const a of this.actors) {
      if (a === p || a.dead || a.sleeping || (a.st && a.st.ko) || a.downT > 0.35 || a.crash) continue;   // (you step over someone lying on the ground)
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
      const min = 7 + a.radius * 0.6;
      if (d < min && d > 0.01) {
        const push = (min - d) * 0.5;
        p.move(this.map, (dx / d) * push, (dy / d) * push);
      }
    }
  }

  updateMusic(force = false) {
    const w = this.world;
    const fighting = this.actors.some((a) => !a.dead && (a.state === 'fight' || a.state === 'attack') && a.target === this.player);
    let mood = fighting ? 'combat' : this.map.meta.music;
    if (!fighting && w.isNight() && this.map.meta.music !== 'island') mood = 'night';
    if (force || mood !== G.audio.mood) G.audio.setMusic(mood);
  }

  nearLight(x, y) {
    for (const l of this.map.lights) if (Math.abs(l.x - x) < l.r * 0.7 && Math.abs(l.y - y) < l.r * 0.7) return true;
    return false;
  }

  isOnScreen(x, y) {
    const c = G.renderer.cam;
    return x > c.x - 16 && y > c.y - 16 && x < c.x + G.renderer.viewW + 16 && y < c.y + G.renderer.viewH + 32;
  }

  isHiddenByRoof(a) {
    const b = this.map.buildingAt(a.x, a.y - 3);
    return b && b.roofAlpha > 0.5;
  }

  // ------------------------------------------------------------ interaction
  findInteraction() {
    const p = this.player;
    const [fx, fy] = G.util.DIR_VEC[p.dir];
    const px = p.x + fx * 10, py = p.y - 4 + fy * 10;
    let best = null, bestD = 1e9;
    // only things on the same side of a wall: no talking, looting or using through it
    const myB = this.map.buildingAt(p.x, p.y - 3) === this.map.buildingAt(p.x, p.y + 1) ? this.map.buildingAt(p.x, p.y - 3) : null;   // feet in the wall row: not inside yet
    const sameSide = (b) => b === myB;
    const consider = (d, t) => { if (d < bestD) { bestD = d; best = t; } };
    const disp = G.bodies.disposal(this);
    if (disp) consider(0, { type: 'dispose', how: disp.how, label: disp.label });
    if (p.dragging) { for (const d of this.map.decor) if (d.def.interact === 'dumpster' && G.util.dist(px, py, d.x, d.y - 6) < 26) consider(1, { type: 'decor', ref: d, label: G.usables.label(d, this) }); return best; }
    for (const a of this.actors) {
      if (a.kind !== 'npc' || a.dead || !sameSide(this.map.buildingAt(a.x, a.y - 3))) continue;
      const d = G.util.dist(px, py, a.x, a.y - 4);
      if (d < 26 || (d < 38 && fy === -1 && Math.abs(a.x - p.x) < 12)) {
        consider(d, { type: 'npc', ref: a, label: a.sleeping ? `Wake ${a.displayName}` : `Talk to ${a.displayName}` });
      }
    }
    for (const c of this.containers) {
      if (!sameSide(this.map.buildingAt(c.x, c.y - 4))) continue;
      const d = G.util.dist(px, py, c.x, c.y - 4);
      if (d < 18) consider(d + 4, { type: 'container', ref: c, label: c.kind === 'chest' ? `Open ${(c.name || "Chest").toLowerCase()}${c.owner && this.world.isAlive(c.owner) ? ' (owned)' : ''}` : c.kind === 'bag' ? G.groundLoot.label(c) : `Search ${c.name || "Container"}` });
    }
    const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
    for (const d of this.map.decor.concat(this.map.flats)) {
      if (!d.def.interact || !sameSide(this.map.buildingAtTile(d.tx, d.ty))) continue;
      const fw = d.def.fw || 1;
      if (tx >= d.tx - 1 && tx <= d.tx + fw && ty >= d.ty - 1 && ty <= d.ty + 1) {
        const dd = G.util.dist(px, py, d.x, d.y - 6);
        if (dd < 24) consider(dd + 8, { type: 'decor', ref: d, label: this.decorLabel(d) });
      }
    }
    return best;
  }

  decorLabel(d) {
    switch (d.def.interact) {
      case 'bed': return 'Sleep';
      case 'well': return 'Drink';
      case 'sign': return 'Read sign';
      case 'forage': return 'Gather';
      case 'boat': return 'Board boat';
      case 'altar': return 'Pray';
      default: return G.usables.label(d, this);
    }
  }

  interact() {
    const t = this.promptTarget;
    if (!t) return;
    if (t.type === 'npc') this.talkTo(t.ref);
    else if (t.type === 'container') { if (!G.groundLoot.grab(this, t.ref)) G.scenes.push(new G.LootScene(this, t.ref)); }
    else if (t.type === 'decor') this.useDecor(t.ref);
    else if (t.type === 'dispose') G.bodies.dispose(this, t.how);
  }

  talkTo(npc) {
    if (npc.sleeping) {
      npc.sleeping = false;
      npc.say(this.map.buildingAt(npc.x, npc.y - 3) ? 'What are you doing in my house?!' : 'Huh?! What?');
      npc.st.fear = Math.max(npc.st.fear, 30);
      npc.waitT = 0;
      return;
    }
    if (npc.state === 'fight' || npc.state === 'flee' || npc.isHostileToPlayer(this)) {
      npc.say(npc.state === 'flee' ? 'Get away from me!' : 'No more words.');
      return;
    }
    this.openDialogue(npc);
  }

  openDialogue(npc, tree) {
    npc.talking = true;
    npc.faceTowards(this.player);
    G.scenes.push(new G.DialogueScene(this, new G.DialogueRunner(npc, this, tree)));
  }

  useDecor(d) {
    const w = this.world, p = this.player;
    switch (d.def.interact) {
      case 'bed': {
        if (G.beds.isMine(this, d)) { G.scenes.push(new G.WaitScene(this, true)); break; }
        const owner = G.beds.ownerOf(this, d);
        if (!owner || w.npcs[owner].partner) { G.scenes.push(new G.WaitScene(this, true)); break; }   // free bed, or your partner's
        const name = w.displayName(owner);
        this.confirm(d.guest ? `This is a ${G.NPCS[owner].name.toLowerCase()}'s guest bed and you have not paid. Sleep in it anyway?` : `This is ${name}'s bed. Sleep in it anyway?`,
          () => G.scenes.push(new G.WaitScene(this, true, { bed: d, owner })));
        break;
      }
      case 'well':
        // (water quenches thirst; it does not heal)
        p.stamina = p.maxStamina;
        G.audio.play('eat');
        p.thirst = 0;
        this.toast('Refreshing. Your thirst is gone.');
        break;
      case 'sign':
        G.scenes.push(new G.MessageScene(this.map.signs[d.tx + ',' + d.ty] || 'The sign is too weathered to read.'));
        break;
      case 'forage': {
        const key = 'forage_' + this.map.id + '_' + d.tx + '_' + d.ty;
        if (w.flags[key] === w.day) { this.toast('Nothing left to gather today.'); break; }
        w.flags[key] = w.day;
        const item = d.def.forage;
        const n = G.skills.has(p, 'forager') && G.rng.chance(0.4) ? 2 : 1;
        if (p.inventory.add(item, n) < n) {
          // the plant is picked: gone from the ground until it grows back (a few days)
          (w.foraged = w.foraged || {})[key] = w.day;
          if (d.def.flat || d.def.pickup) this.map.removeDecorRuntime(d);
          this.toast(`Gathered ${G.item(item).name}${n > 1 ? ' x2' : ''}.`);
          G.audio.play('pickup');
          G.events.emit('xp', G.XP.forage, 'Forage');
        }
        break;
      }
      case 'boat':
        if (this.map.id === 'island') this.confirm('Sail back to the city?', () => this.changeMap('city', 'from_island'));
        else this.confirm('Sail out to the island? It is private. Nobody goes there without an invitation.', () => this.changeMap('island', 'from_city'));
        break;
      case 'altar':
        this.toast('You pause for a moment of silence.');
        break;
      default:
        G.usables.use(d, this);
    }
  }

  confirm(text, onYes, onNo) { G.scenes.push(new G.ConfirmScene(text, onYes, onNo)); }

  // ------------------------------------------------------------ crime & reactions
  // Who saw the player just now? Sleeping NPCs, walls and darkness all help the player.
  witnessesOf(victim) {
    const out = [];
    const range = 150 * Math.max(0.3, 1 - G.skills.stat(this.player, 'stealth'));
    for (const a of this.actors) {
      if (a.kind !== 'npc' || a.dead || a === victim || a.faction.outlaw) continue;
      if (a.sleeping && a.distTo(this.player) > 24) continue;
      if (a.canSee(this, this.player, range)) out.push(a);
    }
    return out;
  }

  // Taking illegal drugs in front of the law (or upstanding citizens) is a crime.
  reportDrugUse() {
    const range = 110 * Math.max(0.3, 1 - G.skills.stat(this.player, 'stealth'));
    // only someone close enough to see what you are doing (a cop, or a citizen standing right there)
    const seen = this.actors.some((a) => a.kind === 'npc' && !a.dead && !a.def.kid && (a.def.combat === 'guard' ? a.canSee(this, this.player, range) : a.def.faction === 'civilians' && !a.st.addict && a.canSee(this, this.player, Math.min(range, 60))));
    if (seen) this.reportCrime('drugs', null);
  }

  // Blacking out (too much alcohol) or overdosing: hours pass, and someone may go through your pockets.
  passOut(reason) {
    if (this.player.dead || this.passingOut) return;
    if (G.scenes.top() !== this) { this.pendingPassOut = reason; return; }
    this.passingOut = true;
    const p = this.player, w = this.world;
    G.scenes.push(new G.FadeScene(() => {
      this.passingOut = false;
      const hours = reason === 'overdose' ? 8 : reason === 'exhaustion' ? 7 : 5;
      if (reason === 'exhaustion') { this.sleepingNow = true; p.rest = 0; }
      w.skipHours(hours);
      p.alcohol = Math.min(p.alcohol, 30);
      for (const c in p.drugs.load) p.drugs.load[c] = Math.min(p.drugs.load[c], 20);
      G.effects.remove(p, 'overdose');
      if (reason === 'exhaustion') { this.sleepingNow = false; p.rest = 70; } else G.effects.add(p, 'nausea', 30);
      p.stamina = 20;
      const outside = !this.map.buildingAt(p.x, p.y - 3);
      let lost = 0;
      if (outside && G.rng.chance(0.5)) { lost = Math.floor(p.gold * G.rng.range(0.2, 0.6)); p.gold -= lost; }
      this.resyncNPCs();
      w.log(`${reason === 'overdose' ? 'You overdosed and woke up' : reason === 'exhaustion' ? 'You collapsed from exhaustion and woke up' : 'You blacked out and woke up'} ${G.util.plural(hours, 'hour')} later.${lost ? ` Someone took $${lost} from your pockets.` : ''}`, 'bad');
    }, 1.5));
  }

  anyoneSaw(victim) { return this.witnessesOf(victim).length > 0; }

  // Report a crime against `victim` (NPC or animal). Returns true if anyone witnessed it.
  reportCrime(type, victim, value = 0, victimId = null) {
    const witnesses = this.witnessesOf(victim);
    // gangsters, dealers and crooks see things too, but they do not call the police
    const snitch = (a) => !G.CRIMINAL_FACTIONS.includes(a.def.faction) && !a.def.dealer && !a.def.mugger;
    const victimSaw = victim && victim.kind === 'npc' && !victim.dead && snitch(victim) && !victim.sleeping;
    const witnessed = witnesses.some(snitch) || victimSaw;
    this.world.commitCrime(type, this.region, witnessed, victimId || (victim && victim.kind === 'npc' ? victim.id : null), value);
    for (const wt of witnesses) {
      // the police arrest you for lesser crimes (they only draw on you for violence that is still going on)
      const arrestable = ['theft', 'extortion', 'vandalism', 'drugs', 'gunfire', 'trespass', 'indecent', 'minors', 'livestock'].includes(type) || (type === 'assault' && !(victim && victim.def && victim.def.combat === 'guard'));
      if (arrestable) {
        if (wt.def.combat === 'guard' && wt.state === 'schedule') { wt.state = 'arrest'; wt.say({ vandalism: 'Hey! Stop that!', drugs: 'Not on my watch!', gunfire: 'Drop the weapon!', assault: 'Police! Stop right there!', trespass: 'Police! Come out of there!' }[type] || 'Thief!'); }
        else if (type === 'assault' && wt.def.combat === 'flee') { wt.st.fear = Math.max(wt.st.fear, 60); wt.say(G.rng.pick(['Somebody call the cops!', 'Leave them alone!'])); }
        continue;
      }
      if (wt.def.combat === 'guard' || (wt.def.combat === 'fight' && type === 'murder' && victim && victim.def && wt.def.faction === victim.def.faction)) wt.startFight(this.player, this);
      else if (wt.def.combat === 'flee') { wt.st.fear = 100; wt.startFlee(this.player); }
      else wt.say(type === 'murder' ? 'Murderer!' : 'Hey!');
    }
    if (!witnessed && (type === 'murder')) this.toast('No one saw that...', 'warn');
    return witnessed;
  }

  // Friends/comrades/same-faction fighters nearby join a fight against the player.
  alertAllies(victim, attacker) {
    for (const a of this.actors) {
      if (a.kind !== 'npc' || a.dead || a === victim || a.state === 'fight') continue;
      const ally = a.def.faction === victim.def.faction || victim.def.relations[a.id];
      if (!ally || a.distTo(victim) > 140 || !a.canSee(this, attacker, 140)) continue;
      if (a.def.combat === 'flee') a.startFlee(attacker);
      else a.startFight(attacker, this);
    }
  }

  startArrest(guard) {
    if (this.arrestCooldown > 0 || G.scenes.top() !== this) return;
    this.arrestCooldown = 3;
    guard.state = 'schedule';
    this.openDialogue(guard, '_arrest');
  }

  resistArrest(guard) {
    this.arrestCooldown = 60;
    this.world.bounty[this.region] += 50;
    for (const a of this.actors) if (a.kind === 'npc' && a.def.combat === 'guard' && !a.dead && a.distTo(this.player) < 200) a.startFight(this.player, this);
    guard.startFight(this.player, this);
  }

  goToJail() {
    // booked into the County Jail (js/game/jail.js)
    G.scenes.push(new G.FadeScene(() => { G.jail.imprison(this); this.arrestCooldown = 5; }, 1.2));
  }

  // ------------------------------------------------------------ time
  tryWait() {
    const danger = this.actors.some((a) => !a.dead && a.target === this.player && (a.state === 'fight' || a.state === 'attack'));
    if (danger) { this.toast('You cannot rest with enemies nearby.', 'bad'); return; }
    G.scenes.push(new G.WaitScene(this, false));
  }

  passTime(hours, sleeping) {
    const w = this.world, p = this.player;
    w.skipHours(hours);
    if (sleeping) p.stamina = p.maxStamina;   // rest restores your strength, not your wounds (only medicine heals)
    this.resyncNPCs();
  }

  // ------------------------------------------------------------ feedback
  toast(text, type = 'info') {
    this.toasts.push({ text, type, t: 4 });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  floatText(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0.9 }); }

  particles(x, y, color, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50, t: 0.4 + Math.random() * 0.3, color });
  }

  // Hallucinations while tripping: colorful strangers wander around you; on a bad trip (drunk or hurt)
  // shadow figures close in and whisper.
  updatePhantoms(dt) {
    const p = this.player, v = G.effects.visuals(p);
    const trip = G.effects.get(p, 'trip');
    const bad = trip && (p.alcohol > 45 || p.hp < p.maxHp * 0.4);
    const want = !trip ? 0 : Math.round(v.trip * (trip.power >= 1 ? 4 : 2));
    if (this.phantoms.length < want && G.rng.chance(dt * 0.8)) {
      const a = G.rng.range(0, Math.PI * 2), r = G.rng.range(50, 110);
      const seed = 'ph' + G.rng.int(0, 1e6);
      const look = bad ? G.look(seed) : G.look(seed, { shirt: G.rng.pick(['#ff40c0', '#40ffd0', '#ffe040', '#a060ff']), pants: G.rng.pick(['#40a0ff', '#ff6040', '#60ff60']), hair: G.rng.pick(['#ff80ff', '#80ffff', '#ffffff']) });
      this.phantoms.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, t: 0, life: G.rng.range(5, 10), bad, sheet: G.assets.character(look), dir: G.rng.int(0, 3), hue: G.rng.int(0, 360) });
    }
    for (const f of this.phantoms) {
      f.t += dt;
      if (f.bad) {
        const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
        f.x += (dx / d) * 26 * dt; f.y += (dy / d) * 26 * dt;
        f.dir = G.util.dirFromVec(dx, dy);
        if (d < 10) {
          f.t = f.life;
          p.stamina = Math.max(0, p.stamina - 15);
          this.toast(G.rng.pick(['"We see you."', '"You should not be here."', '"It is already too late."', '"Look behind you."']), 'bad');
        }
      } else {
        f.x += Math.cos(f.t * 0.7 + f.hue) * 14 * dt; f.y += Math.sin(f.t * 0.5 + f.hue) * 10 * dt;
      }
    }
    this.phantoms = this.phantoms.filter((f) => f.t < f.life && trip);
    if (trip && (this.tripMsgT = (this.tripMsgT || 8) - dt) <= 0) {
      this.tripMsgT = G.rng.range(12, 22);
      this.toast(bad ? G.rng.pick(['Something is following you.', 'The shadows are moving.', 'Your heartbeat is too loud.'])
        : G.rng.pick(['The trees are breathing.', 'You can hear the colors.', 'Your hands look fascinating.', 'Everything is connected.', 'The ground ripples like water.']), bad ? 'bad' : 'info');
    }
  }

  // Gang graffiti on the front walls of each territory, in the owner's color.
  drawTerritoryTags(ctx, view) {
    const map = this.map;
    if (!map.tagSpots) {
      map.tagSpots = [];
      for (const id in G.TERRITORIES) {
        const t = G.TERRITORIES[id];
        if (t.map !== map.id) continue;
        const spots = [];
        for (let y = t.y; y < t.y + t.h - 1; y++) for (let x = t.x; x < t.x + t.w; x++) {
          if (G.TILES[map.get(x, y)].wall && !G.TILES[map.get(x, y + 1)].wall && map.get(x, y + 1) !== G.T.door && map.get(x, y) !== G.T.door) spots.push({ x, y });
        }
        const rr = new G.RNG(id);
        rr.shuffle(spots);
        for (const s of spots.slice(0, 7)) map.tagSpots.push({ id, x: s.x, y: s.y, v: rr.int(0, 3) });
      }
    }
    for (const s of map.tagSpots) {
      const owner = this.world.territories[s.id].owner;
      if (!owner) continue;
      const px = s.x * 16, py = s.y * 16;
      if (px < view.x - 16 || px > view.x + view.w || py < view.y - 16 || py > view.y + view.h) continue;
      const col = G.FACTIONS[owner].color;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      if (s.v === 0) { ctx.moveTo(px + 2, py + 12); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px + 8, py + 11); ctx.lineTo(px + 11, py + 4); ctx.lineTo(px + 14, py + 12); }
      else if (s.v === 1) { ctx.arc(px + 8, py + 8, 4.5, 0, Math.PI * 2); ctx.moveTo(px + 3, py + 13); ctx.lineTo(px + 13, py + 3); }
      else if (s.v === 2) { ctx.moveTo(px + 2, py + 6); ctx.lineTo(px + 14, py + 6); ctx.moveTo(px + 4, py + 11); ctx.quadraticCurveTo(px + 8, py + 2, px + 13, py + 12); }
      else { ctx.moveTo(px + 3, py + 4); ctx.lineTo(px + 3, py + 12); ctx.lineTo(px + 9, py + 8); ctx.lineTo(px + 13, py + 12); ctx.lineTo(px + 13, py + 4); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1;
  }

  drawPhantoms(ctx) {
    for (const f of this.phantoms) {
      const s = f.sheet, a = Math.min(1, f.t, f.life - f.t) * (f.bad ? 0.75 : 0.55);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      if (f.bad) ctx.filter = 'brightness(0)';
      const col = 1 + (Math.floor(f.t * 6) % 2);
      ctx.drawImage(s.img, col * s.fw, f.dir * s.fh, s.fw, s.fh, Math.round(f.x - s.fw / 2), Math.round(f.y - s.fh + 1 + Math.sin(f.t * 3) * 1.5), s.fw, s.fh);
      ctx.filter = 'none';
    }
    ctx.globalAlpha = 1;
  }

  // Full-screen effects for intoxication, drugs and poison (drawn over the world, under the HUD).
  renderScreenFx(ctx) {
    const v = G.effects.visuals(this.player);
    let total = 0;
    for (const k in v) total += v[k];
    if (total < 0.02) return;
    const R = G.renderer, t = this.time, W = R.W, H = R.H;
    const fx = this.fxCanvas || (this.fxCanvas = document.createElement('canvas'));
    if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
    const fc = fx.getContext('2d');
    const copy = () => { fc.clearRect(0, 0, W, H); fc.drawImage(R.canvas, 0, 0); };
    R.screenTransform();
    // ripples (trip, nausea)
    const wave = v.trip + v.nausea * 0.35;
    if (wave > 0.02) {
      copy();
      const strip = Math.max(4, Math.round(H / 60)), amp = wave * W * 0.006;
      for (let y = 0; y < H; y += strip) ctx.drawImage(fx, 0, y, W, strip, Math.sin(y * 0.018 + t * 2.4) * amp, y, W, strip);
    }
    // color grading with blend modes (cheap even without GPU acceleration)
    const blend = (mode, fill, a) => {
      if (a <= 0.01) return;
      ctx.globalCompositeOperation = mode;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };
    if (v.trip > 0.02) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${(t * 50 + i * 90) % 360},100%,50%)`);
      blend('overlay', g, v.trip * 0.5);
      blend('soft-light', `hsl(${(t * 30) % 360},90%,60%)`, v.trip * 0.35);
    }
    blend('soft-light', '#90e070', v.high * 0.35);
    blend('multiply', '#9a9aac', v.crash * 0.55);
    blend('overlay', '#ffffff', v.stim * 0.12);
    blend('soft-light', '#ffd0d8', v.painkiller * 0.4);
    // double vision (alcohol, nausea, painkillers)
    const dbl = Math.max(v.sway, v.painkiller * 0.25);
    if (dbl > 0.02) {
      copy();
      const off = W * 0.012 * dbl;
      ctx.globalAlpha = 0.3 + 0.15 * dbl;
      ctx.drawImage(fx, Math.sin(t * 1.3) * off, Math.cos(t * 0.9) * off * 0.5);
      ctx.globalAlpha = 1;
    }
    // vignettes
    const vignette = (color, a) => {
      if (a <= 0.01) return;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(${color},0)`);
      g.addColorStop(1, `rgba(${color},${a.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const beat = 0.5 + 0.5 * Math.sin(t * 7.5);
    vignette('40,150,40', v.poison * (0.5 + 0.2 * Math.sin(t * 3)));
    vignette('150,160,40', v.nausea * 0.25);
    vignette('255,255,255', v.stim * 0.12 * beat);
    vignette('20,20,30', v.crash * 0.45);
    vignette('60,120,60', v.high * 0.18);
    const heart = G.effects.risk(this.player, 'stimulant');
    if (heart >= 0.6) vignette('200,30,30', Math.min(1, (heart - 0.6) / 0.4) * 0.35 * beat);
    vignette('30,20,10', v.opiate * (0.35 + 0.1 * Math.sin(t * 0.8)));
    if (v.resp > 0.02) { vignette('10,10,40', v.resp * (0.6 + 0.3 * Math.sin(t * 1.5))); blend('multiply', '#6070a0', v.resp * 0.4); }
    if (v.trip > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const cx = W / 2 + Math.cos(t * 0.3 + i * 2.1) * W * 0.35, cy = H / 2 + Math.sin(t * 0.4 + i * 2.1) * H * 0.3;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.35);
        g.addColorStop(0, `hsla(${(t * 40 + i * 120) % 360},90%,60%,${(0.12 * v.trip).toFixed(3)})`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - H * 0.35, cy - H * 0.35, H * 0.7, H * 0.7);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  onPlayerDeath() {
    this.deathT = 1.8;
    this.toast('You have died.', 'bad');
  }

  // ------------------------------------------------------------ rendering
  render(ctx) {
    const R = G.renderer, map = this.map;
    R.clear('#000');
    R.worldTransform();
    const view = R.viewRect(40);
    map.drawGround(ctx, view, this.time);
    if (G.visuals) G.visuals.afterGround(ctx, this, view);   // water glints, sun shadows (js/game/visuals.js)
    map.drawWindowsLit(ctx, view);
    this.drawTerritoryTags(ctx, view);
    G.gore.draw(ctx, this, view);
    this.fire.drawGround(ctx, view);

    for (const c of this.containers) if (c.kind !== 'chest') G.containers.draw(ctx, c);

    // y-sorted world objects
    const list = [];
    for (const d of (map.decorInView ? map.decorInView(view) : map.decor)) {   // (a row index: js/game/perf.js)
      if (d.x < view.x - 24 || d.x > view.x + view.w + 24 || d.y < view.y || d.y > view.y + view.h + 48) continue;
      // furniture and wall pieces belong to the room: under a closed roof nothing of them may stick out above its back edge
      if (d._room === undefined) { const b = map.buildingAtTile(d.tx, d.ty); d._room = b && d.ty < b.y + b.h - 1 ? b : null; }
      if (d._room && d._room.roofAlpha >= 0.99 && !d._room.destroyed && !d._room.gutted) continue;
      list.push(d);
    }
    for (const b of G.realFront.fronts(map, view)) list.push({ front: b, y: G.realFront.rowOf(b) * 16 + 6 });   // (signs on the wall sort just after it, people on the street well after)
    for (const r of G.realWalls.runs(map, view, this.player)) list.push({ wallRun: r, y: r.key });   // (inside walls have height too)
    for (const c of this.containers) if (c.kind === 'chest') list.push({ chest: c, y: c.y });
    // flames take their place in depth order: someone standing in front of a fire is drawn in front of it
    if (this.fire.cells.size) {
      this.fire._sorted = true;
      for (const [i, c] of this.fire.cells) {
        const tx = i % map.w, ty = Math.floor(i / map.w);
        if (tx * 16 < view.x - 32 || tx * 16 > view.x + view.w + 16 || ty * 16 < view.y - 48 || ty * 16 > view.y + view.h + 16) continue;
        const b = map.buildingAtTile(tx, ty);
        if (b && !b.destroyed && b.roofAlpha > 0.35) continue;   // under an intact roof: smoke only (js/game/firelife.js)
        list.push({ fireCell: i, cell: c, y: ty * 16 + 12 });
      }
    }
    for (const a of this.actors) if (!a.dead || a === this.player) { if (a.x > view.x - 16 && a.x < view.x + view.w + 16 && a.y > view.y && a.y < view.y + view.h + 32) list.push({ actor: a, y: a.sortY ? a.sortY() : a.sleeping ? a.y + 6 : a.y }); }
    list.sort((a, b) => a.y - b.y);
    const A = G.assets;
    for (const o of list) {
      if (o.actor) { if (!o.actor.dead || o.actor.deathAnim) o.actor.draw(ctx); }
      else if (o.chest) G.containers.draw(ctx, o.chest);
      else if (o.front) G.realFront.drawFront(ctx, map, o.front);
      else if (o.wallRun) G.realWalls.draw(ctx, map, o.wallRun);
      else if (o.fireCell != null) G.fireHD.drawCell(ctx, this.fire, o.fireCell, o.cell, this.time);
      else {
        const s = A.sprites[o.def.sprite];
        if (G.drawDecor) G.drawDecor(ctx, o, s, this); else ctx.drawImage(s.img, Math.round(o.x - s.ax), Math.round(o.y - s.ay));   // (wind sway: js/game/physics.js)
      }
    }
    for (const q of this.parts) { ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, 1.5, 1.5); }
    this.drawPhantoms(ctx);
    G.firearms.draw(ctx, this);
    map.drawRoofs(ctx, view);
    this.fire.draw(ctx, view, this.time);
    if (this.debug) this.drawDebug(ctx, view);

    if (G.visuals) G.visuals.beforeLighting(ctx, this, view);   // cloud shadows, rain splashes
    this.renderLighting(ctx);
    if (G.visuals) G.visuals.post(ctx, this);   // fog, rain, lightning, vignette
    this.renderScreenFx(ctx);
    if (!this.hideHud) G.hud.draw(ctx, this);
    if (this.debug) this.drawDebugText(ctx);
  }

  renderLighting(ctx) {
    const R = G.renderer, w = this.world;
    const lt = w.lighting();
    const pl = this.player, indoorLit = this.map.buildingAt(pl.x, pl.y - 3);
    // at night, without a flashlight, it is really dark out there
    const dark0 = Math.min(lt.dark > 0.2 && !pl.hasTorch() && !indoorLit ? 0.96 : 0.88, lt.dark * (lt.dark > 0.2 && !pl.hasTorch() && !indoorLit ? 1.35 : 1) + (this.map.meta.darkness || 0));
    const pitch = lt.dark > 0.2 && !pl.hasTorch() && !pl.phoneLight && !indoorLit && !this.map.meta.indoor && !this.map.meta.floorOf ? G.util.clamp((lt.dark - 0.45) / 0.25, 0, 1) : 0;   // deep night, no flashlight: pitch black
    const cap = this.map.meta.maxDark, dark = cap != null ? Math.min(cap, dark0) : dark0 + (1 - dark0) * pitch;   // (a lit street never goes pitch black)
    if (lt.tint) {
      R.screenTransform();
      ctx.fillStyle = `rgba(${lt.tint.color},${lt.tint.a})`;
      ctx.fillRect(0, 0, R.W, R.H);
    }
    if (dark <= 0.01) return;
    const lc = this.lightCanvas, lx = this.lightCtx;
    if (lc.width !== R.W || lc.height !== R.H) { lc.width = R.W; lc.height = R.H; }
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, lc.width, lc.height);
    lx.fillStyle = `rgba(8,10,30,${dark})`;
    lx.fillRect(0, 0, lc.width, lc.height);
    lx.globalCompositeOperation = 'destination-out';
    const z = R.zoom, cam = R.cam;
    const lights = [];
    const night = lt.dark > 0.2;
    if (night) {
      for (const l of this.map.lights) lights.push(l);
      for (const b of this.map.buildings) if (b.lit && !b.destroyed && !b.gutted) for (const wn of b.windows) lights.push({ x: wn.x, y: wn.y + 6, r: 22, color: '255,200,120' });
      for (const b of this.map.buildings) if (b.roofAlpha < 0.5 && !b.destroyed && !b.gutted) lights.push({ x: (b.x + b.w / 2) * 16, y: (b.y + b.h / 2) * 16, r: Math.max(b.w, b.h) * 10, color: '255,200,140' });
    }
    for (const l of this.fire.lights()) lights.push(l);
    for (const f of this.flashes) lights.push({ x: f.x, y: f.y, r: 46, color: '255,220,140' });
    const p = this.player;
    if (p.hasTorch() && night) {   // a flashlight: a beam where you are looking, a little spill around you
      const [fx, fy] = G.util.DIR_VEC[p.dir];
      lights.push({ x: p.x, y: p.y - 8, r: 34, color: '255,240,210', self: true });
      for (const [d, r] of [[30, 34], [62, 44], [96, 50]]) lights.push({ x: p.x + fx * d, y: p.y - 8 + fy * d, r, color: '255,245,220' });
    } else if (pitch < 0.5) lights.push({ x: p.x, y: p.y - 8, r: night ? (p.inventory.has('torch') ? 26 : 12) : 34, color: '255,190,120', self: true });
    if (p.phoneLight && night) { const [fx, fy] = G.util.DIR_VEC[p.dir]; lights.push({ x: p.x + fx * 5, y: p.y - 6 + fy * 4, r: 46, color: '228,236,255' }); }   // the phone's light (js/game/phonehd.js)
    const t = this.time;
    const glows = [];
    for (const l of lights) {
      const sx = (l.x - cam.x) * z, sy = (l.y - cam.y) * z;
      const r = l.r * z * (l.flicker ? 0.92 + Math.sin(t * 13 + l.x) * 0.05 + Math.random() * 0.03 : 1);
      if (sx < -r || sy < -r || sx > R.W + r || sy > R.H + r) continue;
      const g = lx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = g;
      lx.fillRect(sx - r, sy - r, r * 2, r * 2);
      if (!l.self) glows.push({ sx, sy, r, color: l.color });
    }
    R.screenTransform();
    ctx.drawImage(lc, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g0 of glows) {
      const g = ctx.createRadialGradient(g0.sx, g0.sy, 0, g0.sx, g0.sy, g0.r * 0.8);
      g.addColorStop(0, `rgba(${g0.color},${0.22 * dark})`);
      g.addColorStop(1, `rgba(${g0.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(g0.sx - g0.r, g0.sy - g0.r, g0.r * 2, g0.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawDebug(ctx, view) {
    const map = this.map;
    ctx.fillStyle = 'rgba(255,0,0,0.25)';
    const x0 = Math.max(0, Math.floor(view.x / 16)), y0 = Math.max(0, Math.floor(view.y / 16));
    for (let y = y0; y < Math.min(map.h, y0 + view.h / 16 + 2); y++) for (let x = x0; x < Math.min(map.w, x0 + view.w / 16 + 2); x++) if (map.solid[y * map.w + x]) ctx.fillRect(x * 16, y * 16, 16, 16);
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 0.5;
    for (const a of this.actors) {
      ctx.strokeRect(a.x - a.w / 2, a.y - a.h, a.w, a.h);
      if (a.path) { ctx.beginPath(); ctx.moveTo(a.x, a.y); for (const n of a.path) ctx.lineTo(n.x * 16 + 8, n.y * 16 + 12); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(0,128,255,0.3)';
    for (const e of map.exits) ctx.fillRect(e.x * 16, e.y * 16, e.w * 16, e.h * 16);
  }

  drawDebugText(ctx) {
    G.renderer.uiTransform();
    const p = this.player, w = this.world;
    const lines = [
      `FPS ${G.loop.fps}  map ${this.map.id}  tile ${Math.floor(p.x / 16)},${Math.floor(p.y / 16)}`,
      `actors ${this.actors.length}  tension ${JSON.stringify(w.tension)}`,
      `bounty ${JSON.stringify(w.bounty)}`,
      `wildlife ${JSON.stringify(w.wildlifeReport(this.map.id))}`,
    ];
    lines.forEach((l, i) => G.ui.text(ctx, l, 140, 8 + i * 10, { size: 8, color: '#9f9' }));
  }
}

G.GameScene = GameScene;
