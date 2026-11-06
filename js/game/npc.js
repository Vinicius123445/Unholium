'use strict';
// NPC: schedule-driven daily life, pathfinding, perception, fleeing, fighting, arresting, sleeping.
// The NPC entity holds a reference to its persistent state object in G.world.npcs[id] (this.st),
// so anything consequences change there is reflected immediately.

class NPC extends G.Actor {
  constructor(id, st, def = G.NPCS[id]) {
    super({ id, name: st.name, hp: def.hp || 30, w: 10, h: 6 });
    this.transient = !!def.transient;
    this.scanT = G.rng.range(0, 0.6);
    this.aggressor = false;   // started a fight with the player (killing them is self-defense)
    this.mugDone = false;
    this.kind = 'npc';
    this.human = true;
    this.def = def;
    this.st = st;
    this.hp = st.hp;
    this.look = st.lookSeed ? G.look(st.lookSeed, { hat: def.look.hat, hatColor: def.look.hatColor, armor: def.look.armor, shirt: def.look.shirt, pants: def.look.pants }) : def.look;
    this.sheet = G.assets.character(this.look);
    this.walkSpeed = def.combat === 'guard' ? 40 : 34;
    this.runSpeed = def.combat === 'flee' ? 66 : 62;
    this.state = 'schedule';
    this.path = null;
    this.pathKey = null;
    this.pathWait = 0;
    this.goal = null;
    this.waitT = 0;
    this.patrolIdx = G.rng.int(0, 5);
    this.sleeping = false;
    this.talking = false;
    this.target = null;
    this.stuckT = 0;
    this.lostT = 0;
    this.fleeT = 0;
    this.bark = null;
    this.barkT = 0;
    this.assaulted = false;
    this.idleLookT = G.rng.range(2, 6);
  }

  get faction() { return G.FACTIONS[this.def.faction] || {}; }
  get weaponItem() {
    const w = this.def.weapon;
    return w && this.st.inv.some((e) => e[0] === w) ? G.item(w) : null;
  }
  get hasGun() { const w = this.weaponItem; return !!(w && w.gun); }
  damage() { const w = this.weaponItem; return 3 + (w ? (w.gun ? 2 : w.dmg) : 2); }
  cooldown() { const w = this.weaponItem; return (w && !w.gun ? w.cd || 0.4 : 0.4) + 0.55 + Math.random() * 0.3; }
  weaponRange() { const w = this.weaponItem; return w && !w.gun ? w.range || 18 : 14; }
  defense() {
    const a = this.def.armor;
    return a && this.st.inv.some((e) => e[0] === a) ? G.item(a).def || 0 : 0;
  }
  bulletDefense() {
    const a = this.def.armor;
    return a && this.st.inv.some((e) => e[0] === a) ? G.item(a).bulletDef || 0 : 0;
  }
  canHit(t) { return t === this.target; }

  get displayName() { return this.st.introduced ? this.st.realName : this.st.name; }

  // Attacking this NPC is a crime unless they are an outlaw, already out for the player's blood, or
  // attacked the player first (self-defense). Attacking the law is always a crime.
  isCrimeToAttack() {
    if (this.def.combat === 'guard') return true;
    return !this.faction.outlaw && !this.st.hostile && !this.aggressor;
  }

  isHostileToPlayer(scene) {
    if (this.st.hostile) return true;
    const f = this.faction, w = scene.world, rep = w.getRep(this.def.faction);
    if (w.isMember(this.def.faction)) return false;
    if (f.hostileBelow != null && rep < f.hostileBelow) return true;
    if (f.nightHostileBelow != null && w.isNight() && rep < f.nightHostileBelow) return true;
    if (this.def.combat === 'guard' && (w.bounty[scene.region] || 0) >= G.BOUNTY_KILL_ON_SIGHT && scene.copsHot > G.loop.time) return true;   // (a bounty alone is no reason to shoot: they have to have fought or run)
    return false;
  }

  // Muggers always; gang members demand a "toll" at night from people they don't trust.
  wantsToMug(scene) {
    if (this.mugDone || this.def.combat === 'flee') return false;
    if (this.def.mugger) return true;
    const f = this.faction, w = scene.world;
    return f.tollBelow != null && w.isNight() && !w.isMember(this.def.faction) && w.getRep(this.def.faction) < f.tollBelow && !this.isHostileToPlayer(scene);
  }

  // Rival factions fight on sight; guards break up street fights. Secret revolutionaries are left
  // alone until exposed.
  findEnemy(scene) {
    if (this.def.combat === 'flee' || this.sleeping) return null;
    const mine = this.def.faction, exposed = scene.world.flags.revs_exposed;
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a === this || a.dead || a.sleeping) continue;
      let enemy = G.factionsAtWar(mine, a.def.faction);
      if (enemy && (mine === 'revolutionaries' || a.def.faction === 'revolutionaries') && !exposed) enemy = false;
      if (!enemy && this.def.combat === 'guard' && a.state === 'fight' && a.target && a.target.kind === 'npc' &&
        ['gang_red', 'gang_blue', 'punks', 'criminals'].includes(a.def.faction)) enemy = true;
      if (enemy && this.canSee(scene, a, 100)) return a;
    }
    return null;
  }

  // Homeless NPCs (house burnt down) use the map's shelter instead of their home.
  adjustForHome(map, w, at, rawAt) {
    if (typeof rawAt === 'string' && this.def.home && rawAt.startsWith(this.def.home) && w.isHomeLost(this.def)) {
      return map.points[map.meta.shelter] || at;
    }
    return at;
  }

  // Perception: range shrinks at night, and walls block sight (approximated by "same building").
  canSee(scene, other, range = 110) {
    if (this.sleeping || other.dead) return false;
    let r = range;
    if (scene.world.isNight()) r *= other.kind === 'player' && scene.playerLit ? 0.85 : 0.55;
    if (this.distTo(other) > r) return false;
    return scene.map.buildingAt(this.x, this.y - 3) === scene.map.buildingAt(other.x, other.y - 3);
  }

  say(text, t = 2.5) { this.bark = text; this.barkT = t; }

  scheduleList() {
    const from = this.st.scheduleFrom ? G.NPCS[this.st.scheduleFrom] : this.def;
    return from.schedule || [];
  }

  currentEntry(w) {
    const h = w.hourF;
    for (const e of this.scheduleList()) if (G.util.hourInRange(h, e.from, e.to)) return e;
    return null;
  }

  // Beds, desks and counters are solid: stand on a free tile next to them instead (cached per map).
  approach(map, pt) {
    if (!pt || Array.isArray(pt) || !map.isSolidTile(pt.x, pt.y)) return pt;
    const cache = map.approachCache || (map.approachCache = {}), key = pt.x + ',' + pt.y;
    if (!cache[key]) {
      const n = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [0, 2]].map(([dx, dy]) => ({ x: pt.x + dx, y: pt.y + dy })).find((q) => !map.isSolidTile(q.x, q.y));
      cache[key] = n || pt;
    }
    return cache[key];
  }

  resolvePoint(map, at) {
    if (!at) return null;
    if (typeof at === 'string') return map.points[at] || null;
    return at;
  }

  // Where this NPC "should" be right now; used for placement when a map is entered/time skipped.
  scheduledSpot(map, w) {
    const e = this.currentEntry(w);
    let p = e ? this.adjustForHome(map, w, this.resolvePoint(map, e.at), e.at) : null;
    if (Array.isArray(p)) p = p[this.patrolIdx % p.length];
    let act = e ? e.act : 'idle';
    // the same overrides updateSchedule applies (grief keeps people home, curfew after 18:00), so where
    // they are placed, and where chatBCT says they are, is where they really go
    const home = this.def.home && map.points[this.def.home + '_in'];
    if (home && act !== 'sleep' && this.st && this.st.mood === 'grieving' && !this.def.shop) { act = 'idle'; p = home; }
    if (home && act === 'wander' && w.tension && (w.tension[map.meta.region] || 0) >= 50 && w.hour >= 18) { act = 'idle'; p = home; }
    if (!p && this.def.home) p = map.points[this.def.home + '_in'];
    return { p, act };
  }

  placeBySchedule(map, w) {
    const { p, act } = this.scheduledSpot(map, w);
    if (!p) return;
    let spot = this.approach(map, p);
    if (act === 'wander') spot = map.randomWalkableNear(p.x, p.y, 3);
    this.x = spot.x * 16 + 8;
    this.y = spot.y * 16 + 12;
    this.path = null;
    this.sleeping = act === 'sleep';
    this.sleepSpot = this.sleeping ? p : null;
    if (this.sleeping) this.dir = 0;
  }

  // ------------------------------------------------------------ update
  update(dt, scene) {
    if (this.dead) return;
    this.baseUpdate(dt, scene.map);
    this.st.hp = this.hp;
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (this.talking) { this.moving = false; this.faceTowards(scene.player); return; }
    G.social.update(this, dt, scene);
    if (this.chatT > 0 && this.state === 'schedule') { this.chatT -= dt; this.moving = false; return; }

    const p = scene.player;
    const combat = this.def.combat;
    if (this.state === 'schedule' && (this.scanT -= dt) <= 0) {
      this.scanT = 0.6;
      const enemy = this.findEnemy(scene);
      if (enemy) this.startFight(enemy, scene);
    }
    if (!p.dead && this.state !== 'fight' && this.state !== 'flee' && this.state !== 'mug') {
      if (this.state === 'schedule' && this.wantsToMug(scene) && this.canSee(scene, p, 90)) {
        this.state = 'mug';
        this.say(this.def.mugger ? 'Hey, you! Hold it right there.' : 'You lost? This is our turf.');
      } else if (combat !== 'flee' && this.isHostileToPlayer(scene) && this.canSee(scene, p, 120)) {
        this.aggressor = true;
        this.startFight(p, scene);
      } else if (combat === 'guard' && this.state === 'schedule' && (scene.world.bounty[scene.region] || 0) > 0 &&
        scene.arrestCooldown <= 0 && this.canSee(scene, p, 100)) {
        this.state = 'arrest';
        this.say('Halt! You there!');
      } else if (combat === 'flee' && this.st.fear >= 60 && this.canSee(scene, p, 56)) {
        this.startFlee(p);
      }
    }

    // hunger, thirst and evening drinks (js/game/needs.js) take priority over the daily schedule
    if (!this.transient) G.needs.starve(this, this.st.hunger || 0, this.st.thirst || 0, dt, scene);
    if (G.love.update(this, dt, scene)) return;   // couples at night (js/game/love.js)
    if (this.state === 'schedule' && G.needs.update(this, dt, scene)) return;
    switch (this.state) {
      case 'fight': this.updateFight(dt, scene); break;
      case 'flee': this.updateFlee(dt, scene); break;
      case 'arrest': this.updateArrest(dt, scene); break;
      case 'mug': this.updateMug(dt, scene); break;
      default: this.updateSchedule(dt, scene);
    }
  }

  updateMug(dt, scene) {
    const p = scene.player;
    const d = this.distTo(p);
    if (d > 220 || p.dead) { this.state = 'schedule'; this.mugDone = true; this.path = null; return; }
    if (d < 24) {
      this.moving = false;
      this.faceTowards(p);
      this.mugDone = true;
      this.state = 'schedule';
      scene.startMugging(this);
      return;
    }
    if (d < 40) this.stepToward(p.x, p.y, dt, scene, true);
    else this.walkTo({ x: Math.floor(p.x / 16), y: Math.floor((p.y - 3) / 16) }, dt, scene, true);
  }

  updateSchedule(dt, scene) {
    const w = scene.world, map = scene.map;
    const e = this.currentEntry(w);
    if (!e) { this.moving = false; return; }
    let act = e.act;
    let at = this.adjustForHome(map, w, this.resolvePoint(map, e.at), e.at);
    // World state overrides: grief keeps people home, high tension imposes a curfew.
    const home = this.def.home && map.points[this.def.home + '_in'];
    if (home && act !== 'sleep' && this.st.mood === 'grieving' && !this.def.shop) { act = 'idle'; at = home; }
    if (home && act === 'wander' && (w.tension[scene.region] || 0) >= 50 && w.hour >= 18) { act = 'idle'; at = home; }
    if (!at) at = home || { x: Math.floor(this.x / 16), y: Math.floor(this.y / 16) };

    if (Array.isArray(at)) {
      const pt = at[this.patrolIdx % at.length];
      if (this.arrived(pt)) {
        this.moving = false;
        this.waitT += dt;
        if (this.waitT > 2.5) { this.waitT = 0; this.patrolIdx++; }
      } else this.walkTo(pt, dt, scene);
      this.sleeping = false;
      return;
    }

    if (act === 'wander') {
      if (!this.goal || this.goalAnchor !== at) { this.goal = null; this.goalAnchor = at; }
      if (!this.goal || this.arrived(this.goal)) {
        this.moving = false;
        this.waitT -= dt;
        if (this.waitT <= 0 || !this.goal) {
          this.goal = map.randomWalkableNear(at.x, at.y, 4, G.rng, false);
          this.waitT = G.rng.range(2, 6);
        }
        if (this.arrived(this.goal)) this.lookAround(dt);
      } else this.walkTo(this.goal, dt, scene);
      this.sleeping = false;
      return;
    }

    this.goal = null;
    const bedAt = at;
    at = this.approach(map, at);
    if (this.arrived(at)) {
      this.moving = false;
      this.sleeping = act === 'sleep' && !(this.wokeT > scene.time);   // just woken up: awake for a while (js/game/sleepers.js)
      this.sleepSpot = this.sleeping ? bedAt : null;
      if (!this.sleeping) this.lookAround(dt);
    } else {
      this.sleeping = false;
      this.walkTo(at, dt, scene);
    }
  }

  lookAround(dt) {
    this.idleLookT -= dt;
    if (this.idleLookT <= 0) {
      this.idleLookT = G.rng.range(2, 7);
      this.dir = G.rng.pick([0, 0, 0, 1, 2, 3]);
    }
  }

  arrived(pt) {
    return Math.abs(this.x - (pt.x * 16 + 8)) < 3 && Math.abs(this.y - (pt.y * 16 + 12)) < 3;
  }
  // Path-follow toward a tile. Uses a per-frame path budget so many NPCs can't stall a frame.
  // Far or unreachable goals get a partial path toward them (re-planned when it runs out); paths are
  // smoothed so people walk in straight lines instead of zig-zagging tile by tile.
  walkTo(pt, dt, scene, run = false) {
    const map = scene.map;
    const key = pt.x + ',' + pt.y;
    const sx = Math.floor(this.x / 16), sy = Math.floor((this.y - 3) / 16);
    // progress watchdog: no headway toward this goal for a while -> plan again harder, then skip ahead
    // (off screen) or give it a rest (on screen) instead of shuffling in place forever
    const dist = Math.hypot(this.x - (pt.x * 16 + 8), this.y - (pt.y * 16 + 12));
    if (this.wdKey !== key) { this.wdKey = key; this.wdBest = dist; this.wdT = 0; this.wdTries = 0; }
    if (G.walkWatchdogOff) {} else if (this.giveUpT > 0 && this.giveUpKey === key) { this.giveUpT -= dt; this.moving = false; return; }
    if (dist < this.wdBest - 8) { this.wdBest = dist; this.wdT = 0; }
    else if ((this.wdT += dt) > 6 && dist > 20) {
      this.wdT = 0; this.wdTries++;
      if (this.wdTries === 1) {
        const raw = G.pathfind.find(map, sx, sy, pt.x, pt.y, 25000, { partial: true });
        this.path = raw && G.pathfind.smooth(map, sx, sy, raw); this.pathKey = key;
      } else if (!scene.isOnScreen(this.x, this.y) && !scene.isOnScreen(pt.x * 16 + 8, pt.y * 16 + 12)) {
        const q = this.approach(map, pt); this.x = q.x * 16 + 8; this.y = q.y * 16 + 12; this.path = null; this.wdKey = null; return;
      } else { this.giveUpKey = key; this.giveUpT = 15; this.path = null; this.wdKey = null; this.moving = false; return; }
    }
    if (this.pathKey !== key || !this.path) {
      if (this.pathWait > 0) { this.pathWait -= dt; this.moving = false; return; }
      if (scene.pathBudget <= 0) { this.moving = false; return; }
      scene.pathBudget--;
      const raw = G.pathfind.find(map, sx, sy, pt.x, pt.y, 7000, { partial: true });
      this.path = raw && G.pathfind.smooth(map, sx, sy, raw);
      this.pathKey = key;
      this.stuckT = 0;
      if (!this.path) { this.pathWait = 1.5 + Math.random(); this.pathKey = null; this.moving = false; return; }
    }
    if (!this.path.length) {
      if (Math.abs(this.x - (pt.x * 16 + 8)) > 24 || Math.abs(this.y - (pt.y * 16 + 12)) > 24) { this.path = null; return; }   // partial path used up: plan the next leg
      this.stepToward(pt.x * 16 + 8, pt.y * 16 + 12, dt, scene, run);
      return;
    }
    const n = this.path[0];
    const tx = n.x * 16 + 8, ty = n.y * 16 + 12;
    if (Math.abs(this.x - tx) < 2 && Math.abs(this.y - ty) < 2) { this.path.shift(); return; }
    this.stepToward(tx, ty, dt, scene, run);
  }

  stepToward(tx, ty, dt, scene, run = false) {
    const sp = (run ? this.runSpeed : this.walkSpeed) * dt;
    let vx = tx - this.x, vy = ty - this.y;
    const d = Math.hypot(vx, vy) || 1;
    vx /= d; vy /= d;
    // local avoidance: step around someone standing right in the way
    if (this.sidestepT > 0) this.sidestepT -= dt;
    for (const a of scene.actors) {
      if (a === this || a.dead || (a.kind !== 'npc' && a.kind !== 'player') || a.sleeping) continue;
      const ox = a.x - this.x, oy = a.y - this.y, od = Math.hypot(ox, oy);
      if (od > 12 || od < 0.1 || (ox * vx + oy * vy) / od < 0.6) continue;
      if (!(this.sidestepT > 0)) { this.sidestepT = 0.5; this.sideDir = G.rng.chance(0.5) ? 1 : -1; }
      break;
    }
    if (this.sidestepT > 0) { const px = -vy * this.sideDir, py = vx * this.sideDir; vx = vx * 0.5 + px * 0.8; vy = vy * 0.5 + py * 0.8; }
    const step = Math.min(sp, d);
    const moved = this.move(scene.map, vx * step, vy * step, true);
    this.face(tx - this.x, ty - this.y);
    this.moving = moved;
    if (!moved) {
      this.stuckT += dt;
      if (this.stuckT > 1) {
        this.stuckT = 0;
        this.stuckCount = (this.stuckCount || 0) + 1;
        // Stuck: re-plan; if it keeps happening and nobody is watching, just get there.
        // (only where nobody can see the jump: well off screen, and landing off screen too)
        const far = (x, y) => { const c = G.renderer.cam; return x < c.x - 80 || y < c.y - 80 || x > c.x + G.renderer.viewW + 80 || y > c.y + G.renderer.viewH + 110; };
        if (this.stuckCount >= 3 && far(this.x, this.y) && far(tx, ty)) { this.x = tx; this.y = ty; this.stuckCount = 0; }
        else { this.path = null; this.sidestepT = 0.6; this.sideDir = -(this.sideDir || 1); }
      }
    } else { this.stuckT = 0; if (this.stuckCount && G.rng.chance(dt)) this.stuckCount--; }
  }

  // ------------------------------------------------------------ combat
  startFight(target, scene) {
    if (this.def.combat === 'flee') { this.startFlee(target); return; }
    if (this.state !== 'fight') {
      this.say(G.rng.pick(this.def.combat === 'guard' ? ['Police! Freeze!', 'Hands where I can see them!'] : ['You will pay for that!', 'Die!', 'Big mistake.']));
      if (this.def.combat === 'guard') G.audio.play('alarm');
    }
    this.state = 'fight';
    this.target = target;
    this.sleeping = false;
    this.lostT = 0;
    this.path = null;
  }

  updateFight(dt, scene) {
    const t = this.target;
    if (!t || t.dead) { this.endFight(); return; }
    if (this.hp < this.maxHp * 0.2 && this.def.combat === 'fight' && !this.st.hostile && this.def.faction !== 'bandits') { this.startFlee(t); return; }
    const d = this.distTo(t);
    if (!this.canSee(scene, t, 200)) {
      this.lostT += dt;
      if (this.lostT > 6) { this.endFight(); return; }
    } else this.lostT = 0;
    if (d > 260) { this.endFight(); return; }
    // Gunmen keep their distance and shoot when they have a clear view.
    if (this.hasGun) {
      const w = this.weaponItem, want = Math.min(w.range * 0.55, 120);
      const shot = this.canSee(scene, t, 200) || (d < 160 && G.firearms.clearLine && G.firearms.clearLine(scene.map, this.x, this.y - 6, t.x, t.y - 6));   // (a clear line of fire counts, through a doorway or a window)
      if (d > want || !shot) {
        if (d < 40) this.stepToward(t.x, t.y, dt, scene, true);
        else this.walkTo({ x: Math.floor(t.x / 16), y: Math.floor((t.y - 3) / 16) }, dt, scene, true);
      } else this.moving = false;
      this.faceTowards(t);
      // point-blank, a round would fly past you (it leaves the muzzle a step ahead): they hit you with the gun
      if (this.attackCd <= 0 && d < 16) { this.moving = false; G.combat.attack(this, scene); return; }
      if (this.attackCd <= 0 && d < w.range * 0.8 && shot) G.firearms.npcFire(this, scene, t);
      return;
    }
    // close enough to strike: what the weapon's swing actually reaches (js/game/melee.js), not less
    const reach = Math.max(this.weaponRange() + 2, G.melee ? G.melee.styleOf(this).reach + (t.radius || 5) - 3 : 0);
    if (d > reach) {
      const ttx = Math.floor(t.x / 16), tty = Math.floor((t.y - 3) / 16);
      // close by, with nothing in between: straight at them. Otherwise (a bed, a counter, a wall) the path around.
      const direct = d < 40 && !(this.detourT > 0) && (!G.firearms.clearLine || G.firearms.clearLine(scene.map, this.x, this.y - 4, t.x, t.y - 4));
      if (direct) this.stepToward(t.x, t.y, dt, scene, true);
      else {
        if (this.pathKey !== ttx + ',' + tty && this.path && this.path.length > 3) this.path = null;
        this.walkTo({ x: ttx, y: tty }, dt, scene, true);
      }
      // not getting any closer (stuck on something): take the path around for a while
      if (this.detourT > 0) this.detourT -= dt;
      if (this.chaseBest == null || d < this.chaseBest - 2) { this.chaseBest = d; this.chaseT = 0; }
      else if ((this.chaseT += dt) > 0.8) { this.detourT = 2.5; this.path = null; this.chaseBest = d; this.chaseT = 0; }
    } else {
      this.chaseBest = null; this.chaseT = 0;
      this.moving = false;
      this.faceTowards(t);
      if (this.attackCd <= 0) G.combat.attack(this, scene);
    }
  }

  endFight() {
    this.state = 'schedule';
    this.target = null;
    this.path = null;
  }

  startFlee(threat) {
    if (this.state !== 'flee') this.say(G.rng.pick(['Help!', 'Police! Somebody call the police!', 'Stay away from me!', 'Murderer!']));
    this.state = 'flee';
    this.target = threat;
    this.fleeT = 0;
    this.path = null;
    this.goal = null;
    this.sleeping = false;
    this.st.fear = Math.max(this.st.fear, 70);
  }

  updateFlee(dt, scene) {
    const t = this.target;
    this.fleeT += dt;
    const map = scene.map;
    if (!t || t.dead || (this.fleeT > 10 && this.distTo(t) > 140)) { this.state = 'schedule'; this.path = null; return; }
    // Run home if possible (and the threat isn't inside it), otherwise away from the threat.
    if (!this.goal) {
      const home = this.def.home && map.points[this.def.home + '_in'];
      const homeB = home && map.buildingAt(home.x * 16 + 8, home.y * 16 + 8);
      if (home && map.buildingAt(t.x, t.y - 3) !== homeB && G.util.dist(home.x * 16, home.y * 16, t.x, t.y) > 60) this.goal = home;
      else {
        const dx = this.x - t.x, dy = this.y - t.y, d = Math.hypot(dx, dy) || 1;
        const gx = Math.floor((this.x + (dx / d) * 120) / 16), gy = Math.floor((this.y + (dy / d) * 120) / 16);
        this.goal = map.randomWalkableNear(G.util.clamp(gx, 1, map.w - 2), G.util.clamp(gy, 1, map.h - 2), 2, G.rng, false);
      }
    }
    if (this.arrived(this.goal)) {
      this.moving = false;
      if (this.distTo(t) < 50) this.goal = null;
    } else this.walkTo(this.goal, dt, scene, true);
  }

  updateArrest(dt, scene) {
    const p = scene.player;
    const d = this.distTo(p);
    if ((scene.world.bounty[scene.region] || 0) <= 0 || d > 220) { this.state = 'schedule'; this.path = null; return; }
    if (d < 24) {
      this.moving = false;
      this.faceTowards(p);
      scene.startArrest(this);
      return;
    }
    if (d < 40) this.stepToward(p.x, p.y, dt, scene, true);
    else this.walkTo({ x: Math.floor(p.x / 16), y: Math.floor((p.y - 3) / 16) }, dt, scene, true);
  }

  onHurt(source, dmg, scene) {
    if (source === scene.player) G.jobs.onHurt(scene.world, this);
    this.sleeping = false;
    if (!source || source.kind === 'fire') return;
    if (source === scene.player) {
      if (!this.assaulted && this.isCrimeToAttack()) {
        this.assaulted = true;
        scene.reportCrime('assault', this);
      }
    } else if (source.kind !== 'npc') return;
    if (this.def.combat === 'flee') this.startFlee(source);
    else if (this.state !== 'fight' || this.target !== source) this.startFight(source, scene);
    scene.alertAllies(this, source);
  }

  die(source, scene) {
    this.dead = true;
    this.sleeping = false;
    G.audio.play((this.look && this.look.body === 'f') || this.def.gender === 'female' ? 'death_f' : 'death', { x: this.x, y: this.y });   // (a woman's voice for women)
    const w = scene.world;
    const fire = source && source.kind === 'fire';
    const byPlayer = source === scene.player || !!(fire && source.firePlayer);
    let witnessed = false;
    if (byPlayer && fire) {
      witnessed = !!source.witnessed;
      if (this.isCrimeToAttack()) w.commitCrime('murder', scene.region, witnessed, this.transient ? null : this.id);
    } else if (byPlayer && this.isCrimeToAttack()) witnessed = scene.reportCrime('murder', this);
    else if (byPlayer) witnessed = scene.anyoneSaw(this);
    if (byPlayer) {
      const fair = !this.isCrimeToAttack() || this.def.combat !== 'flee' || this.st.hostile;
      G.events.emit('xp', fair ? G.XP.killNpc : G.XP.killInnocent, 'Kill');
      if (G.skills.has(scene.player, 'scavenger')) for (const e of this.st.inv) if (G.item(e[0]).type === 'ammo') e[1] = Math.ceil(e[1] * 1.5);
    }
    G.gangWar.onDeath(w, this, scene.map.id);
    if (byPlayer) w.onKill('faction:' + this.def.faction);
    G.containers.createCorpse(w, this, scene.map.id);
    this.st.inv = [];
    this.st.gold = 0;
    if (this.transient) {
      // night-time street NPCs are not persistent; their faction still hears about it
      if (byPlayer) {
        w.stats.kills++;
        if (this.faction.listed) w.addRep(this.def.faction, -6);
      }
    } else {
      w.registerDeath(this.id, { byPlayer, witnessed, map: scene.map.id, killerFaction: source && source.def ? source.def.faction : null });
      if (byPlayer) w.onKill(this.id);
      if (byPlayer) G.social.onPlayerKilled(w, this.id, witnessed);
    }
    scene.refreshContainers();
  }

  // ------------------------------------------------------------ drawing
  // the bed this sleeper is drawn in (null: on the floor or a couch)
  sleepBed() {
    const map = G.maps.cache[this.st.map || this.def.map];
    const tx = Math.floor(this.x / 16), ty = Math.floor((this.y - 3) / 16), sp = this.sleepSpot;
    if (this.bedRef && this.bedRef.def && this.bedRef.def.interact === 'bed') return this.bedRef;
    const near = this.onFloor ? [] : (sp ? [[sp.x, sp.y]] : []).concat([[tx, ty], [tx, ty + 1], [tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty + 2], [tx - 1, ty + 1], [tx + 1, ty + 1]]);   // (onFloor: the bed was full, js/game/sleepers.js)
    return (map && near.map(([x, y]) => map.decorsAt(x, y)).flat().find((d) => d.def.interact === 'bed')) || null;
  }
  // where a sleeper sorts among people and props: in a bed, right on top of that bed (not where they stand,
  // a tile further down, which would draw the blanket over anyone standing in front of the bed)
  sortY() {
    if (!this.sleeping) return this.y;
    const bed = this.sleepBed();
    return bed ? bed.y + 0.01 : this.y + 6;
  }
  draw(ctx) {
    if (this.loveTask && this.loveTask.phase === 'act') { if (this.loveTask.lead) G.love.drawAct(ctx, this); return; }
    if (this.sleeping) { G.sleepArt.draw(ctx, this); return; }   // (js/game/sleepart.js)
    super.draw(ctx);
    if (this.state === 'fight') G.firearms.drawHeld(ctx, this);
  }
}

G.NPC = NPC;
