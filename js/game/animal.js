'use strict';
// Animals: wildlife and livestock. Populations are tracked per zone in G.world.wildlife,
// so overhunting has lasting effects (see the ecology rule in consequences.js).

class Animal extends G.Actor {
  constructor(species, x, y, zoneKey, zone) {
    const def = G.ANIMALS[species];
    super({ hp: def.hp, w: def.w, h: def.h, x, y });
    this.kind = 'animal';
    this.species = species;
    this.def = def;
    this.name = def.name;
    this.zoneKey = zoneKey;
    this.zone = zone;
    this.owner = zone.owner || null;
    this.region = zone.region || null;
    this.sheet = G.assets.animal(species, def.color, { antlers: species === 'deer' && G.rng.chance(def.antlerChance || 0) });
    this.walkSpeed = def.speed * 0.4;
    this.runSpeed = def.speed;
    this.radius = Math.max(5, def.w / 2);
    this.state = 'wander';
    this.goal = null;
    this.waitT = G.rng.range(0, 3);
    this.stateT = 0;
    this.target = null;
    this.facingRight = G.rng.chance(0.5);
    this.sex = G.rng.chance(0.5) ? 'f' : 'm';
  }

  damage() { return this.def.dmg || 2; }
  cooldown() { return 1.1 + Math.random() * 0.4; }
  weaponRange() { return 12 + this.def.w / 2; }
  canHit(t) { return t === this.target; }
  draw(ctx) {
    if (this.young) { ctx.save(); ctx.translate(this.x, this.y); ctx.scale(0.65, 0.65); ctx.translate(-this.x, -this.y); super.draw(ctx); ctx.restore(); }
    else super.draw(ctx);
    if (this.mateT > 0 && this.sex === 'f') G.love.hearts(ctx, this.x, this.y - this.def.h - 10);
  }

  update(dt, scene) {
    if (this.dead) return;
    this.baseUpdate(dt, scene.map);
    const p = scene.player;
    const d = this.distTo(p);
    const sight = scene.world.isNight() && this.def.nightSight ? this.def.nightSight : this.def.sight;
    const visible = !p.dead && d < sight && !scene.map.buildingAt(p.x, p.y - 3);
    const b = this.def.behavior;
    this.stateT += dt;

    if (this.state !== 'flee' && this.state !== 'attack') {
      if (b === 'skittish' && visible && (d < sight * 0.6 || p.moving && G.input.isDown('run'))) this.setState('flee', p);
      if (b === 'predator' && visible) this.setState('attack', p);
      if (b === 'territorial' && visible && d < 56) { this.setState('attack', p); G.audio.play('growl', { x: this.x, y: this.y }); }
    }

    if (this.state === 'hunt') { this.updateHunt(dt, scene); return; }
    if (this.state === 'flee') {
      const th = this.target && !this.target.dead ? this.target : p;   // flee from whoever attacked (a wolf, or you)
      if (this.stateT > 4 && this.distTo(th) > 90) this.setState('wander');
      else {
        this.fleeFrom(th, dt, scene);
      }
    } else if (this.state === 'attack') {
      const foe = this.target && this.target.kind === 'animal' ? this.target : p, fd = this.distTo(foe);   // a wolf that bit it, or you
      if (foe.dead || fd > (b === 'territorial' ? 130 : 220)) { this.setState('wander'); return; }
      if (fd > this.weaponRange()) {
        this.seek(foe.x, foe.y, this.runSpeed * 0.9, dt, scene);
      } else {
        this.moving = false;
        this.faceTowards(foe);
        if (this.attackCd <= 0) {
          this.attackCd = this.cooldown();
          G.combat.damage(foe, this.damage(), this, scene);
        }
      }
    } else {
      if (!this.updateNeeds(dt, scene)) this.wander(dt, scene);
    }
  }

  // ---------------- hunger & thirst ----------------
  // Grazers eat grass, flowers, bushes and hay; predators hunt other animals; everyone drinks at water
  // or a trough. Returns true while busy with it (instead of wandering).
  updateNeeds(dt, scene) {
    if (this.hunger == null) { this.hunger = G.rng.range(0, 60); this.thirst = G.rng.range(0, 60); }
    this.hunger = Math.min(100, this.hunger + dt * 0.45);
    this.thirst = Math.min(100, this.thirst + dt * 0.6);
    G.needs.starve(this, this.hunger, this.thirst, dt, scene);
    if (this.needT > 0) {   // eating or drinking
      this.needT -= dt;
      this.moving = false;
      if (Math.floor(this.needT * 3) % 2) this.facingRight = !this.facingRight;   // head bobbing
      if (this.needT <= 0) { if (this.needGoal.type === 'drink') this.thirst = 0; else this.hunger = 0; this.needGoal = null; }
      return true;
    }
    // fed and watered: time to find a mate (js/game/love.js)
    if ((this.mate || this.mateT > 0 || (this.hunger < 50 && this.thirst < 50 && !this.needGoal)) && G.love.animal(this, dt, scene)) return true;
    const map = scene.map;
    if (!this.needGoal) {
      if (this.thirst >= 70) this.needGoal = this.findWater(map);
      else if (this.hunger >= 70) {
        if (this.def.behavior === 'predator' || this.species === 'bear') {
          const prey = scene.actors.filter((a) => a.kind === 'animal' && !a.dead && a !== this && ['rabbit', 'deer', 'chicken', 'boar'].includes(a.species) && a.distTo(this) < 170).sort((a, b) => a.distTo(this) - b.distTo(this))[0];   // the closest
          if (prey) { this.setState('hunt', prey); return true; }
          this.hunger = 50;
        } else this.needGoal = this.findFood(map);
      }
      if (!this.needGoal && (this.thirst >= 70 || this.hunger >= 70)) { this.thirst = Math.min(this.thirst, 50); this.hunger = Math.min(this.hunger, 50); }   // nothing nearby: makes do
      if (!this.needGoal) return false;
      this.needGoal.t = 0;
    }
    const g = this.needGoal, dx = g.x - this.x, dy = g.y - this.y, d = Math.hypot(dx, dy);
    g.t += dt;
    if (d < 8 || g.t > 12) { this.needT = g.type === 'drink' ? 3 : 4; this.face(dx, dy); return true; }
    this.seek(g.x, g.y, this.walkSpeed * 1.3, dt, scene);
    return true;
  }
  findWater(map) {
    const tx0 = Math.floor(this.x / 16), ty0 = Math.floor(this.y / 16);
    for (let r = 1; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = tx0 + dx, ty = ty0 + dy;
      const wet = map.isSwimmable(tx, ty) || map.decorsAt(tx, ty).some((d) => d.type === 'trough');
      if (!wet) continue;
      // stand on the closest dry tile next to it
      for (const [ax, ay] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!map.isSolidTile(tx + ax, ty + ay)) return { x: (tx + ax) * 16 + 8, y: (ty + ay) * 16 + 12, type: 'drink' };
    }
    return null;
  }
  findFood(map) {
    const tx0 = Math.floor(this.x / 16), ty0 = Math.floor(this.y / 16);
    const food = this.species === 'cow' ? ['haybale', 'tuft', 'flowers'] : ['berrybush', 'flowers', 'tuft', 'mushroom', 'haybale'];
    for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = tx0 + dx, ty = ty0 + dy;
      if (map.decorsAt(tx, ty).some((d) => food.includes(d.type))) {
        for (const [ax, ay] of [[0, 0], [0, 1], [1, 0], [-1, 0]]) if (!map.isSolidTile(tx + ax, ty + ay)) return { x: (tx + ax) * 16 + 8, y: (ty + ay) * 16 + 12, type: 'eat' };
      }
    }
    // just graze where you stand, if it is grass
    const t = map.get(tx0, ty0);
    return t === G.T.grass || t === G.T.darkgrass || t === G.T.wheat ? { x: this.x, y: this.y, type: 'eat' } : null;
  }
  // Predators chase prey, bite it, and eat when it drops.
  updateHunt(dt, scene) {
    const prey = this.target;
    if (!prey || prey.dead) { if (prey && prey.dead) { this.hunger = 0; this.needT = 4; this.needGoal = { type: 'eat' }; } this.setState('wander'); return; }
    if (this.stateT > 25 || this.distTo(prey) > 260) { this.hunger = 55; this.setState('wander'); return; }
    if (this.distTo(prey) > this.weaponRange()) {
      this.seek(prey.x, prey.y, this.runSpeed, dt, scene);
    } else {
      this.moving = false;
      this.faceTowards(prey);
      if (this.attackCd <= 0) { this.attackCd = this.cooldown(); G.combat.damage(prey, this.damage(), this, scene); }
    }
  }

  setState(s, target = null) {
    this.state = s;
    this.target = target;
    this.stateT = 0;
    this.goal = null;
    this.path = null;
    this.fleeGoal = null;
  }

  go(nx, ny, speed, dt, scene) {
    const moved = this.move(scene.map, nx * speed * dt, ny * speed * dt);
    if (!moved) {
      // try sliding along walls
      this.move(scene.map, nx * speed * dt, 0) || this.move(scene.map, 0, ny * speed * dt) || this.move(scene.map, -ny * speed * dt, nx * speed * dt);
    }
    this.face(nx, ny);
    this.moving = true;
  }

  // ---------------- getting around ----------------
  // Animals walk straight at things when the way is clear, and path around fences, houses and water
  // when it is not (the same A* the people use, on a small budget shared per frame).
  walkable(map, tx, ty) { return map.inBounds(tx, ty) && !map.isSolidTile(tx, ty) && !map.isSwimmable(tx, ty); }
  clearLine(map, x1, y1) {
    const dx = x1 - this.x, dy = y1 - this.y, n = Math.ceil(Math.hypot(dx, dy) / 6);
    for (let i = 1; i <= n; i++) {
      const px = this.x + (dx * i) / n, py = this.y - 3 + (dy * i) / n;
      if (!this.walkable(map, Math.floor(px / 16), Math.floor(py / 16))) return false;
    }
    return true;
  }
  seek(tx, ty, speed, dt, scene) {
    const map = scene.map, d = Math.hypot(tx - this.x, ty - this.y) || 1;
    if (d < 20 || this.clearLine(map, tx, ty)) { this.path = null; this.go((tx - this.x) / d, (ty - this.y) / d, speed, dt, scene); return; }
    const gx = Math.floor(tx / 16), gy = Math.floor((ty - 3) / 16), key = gx + ',' + gy;
    if (!this.path || (this.pathKey !== key && (this.repathT -= dt) <= 0)) {
      // no route planned yet and something in the way: wait a beat for a plan instead of grinding into it
      if ((this.pathWait -= dt) > 0 || scene.pathBudget <= 0) { this.moving = false; return; }
      scene.pathBudget--;
      const raw = G.pathfind.find(map, Math.floor(this.x / 16), Math.floor((this.y - 3) / 16), gx, gy, 3000, { partial: true });
      this.path = raw && G.pathfind.smooth(map, Math.floor(this.x / 16), Math.floor((this.y - 3) / 16), raw);
      this.pathKey = key; this.repathT = 0.8;
      if (!this.path || !this.path.length) { this.path = null; this.pathWait = 1.5; this.moving = false; this.noWayT = 2.4; return; }   // no way there: give the goal up (below)
    }
    const n = this.path[0], nx = n.x * 16 + 8, ny = n.y * 16 + 12, nd = Math.hypot(nx - this.x, ny - this.y);
    if (nd < 4) { this.path.shift(); if (!this.path.length) this.path = null; return; }
    const bx = this.x, by = this.y;
    this.go((nx - this.x) / nd, (ny - this.y) / nd, speed, dt, scene);
    if (bx === this.x && by === this.y && (this.blockT = (this.blockT || 0) + dt) > 0.6) { this.blockT = 0; this.path = null; this.pathWait = 0.3; }
  }
  // run away: pick an open spot away from the threat and get there (around obstacles, not into a wall)
  fleeFrom(th, dt, scene) {
    const map = scene.map;
    if (!this.fleeGoal || Math.hypot(this.fleeGoal.x - this.x, this.fleeGoal.y - this.y) < 10 || Math.hypot(this.fleeGoal.x - th.x, this.fleeGoal.y - th.y) < 60) {
      const dx = this.x - th.x, dy = this.y - th.y, n = Math.hypot(dx, dy) || 1;
      this.fleeGoal = null;
      for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
        const c = Math.cos(a), s = Math.sin(a), vx = (dx / n) * c - (dy / n) * s, vy = (dx / n) * s + (dy / n) * c;
        const gx = Math.floor((this.x + vx * 110) / 16), gy = Math.floor((this.y + vy * 110) / 16);
        if (this.walkable(map, gx, gy)) { this.fleeGoal = { x: gx * 16 + 8, y: gy * 16 + 12 }; break; }
      }
      if (!this.fleeGoal) { const t = map.randomWalkableNear(Math.floor(this.x / 16), Math.floor(this.y / 16), 6); this.fleeGoal = { x: t.x * 16 + 8, y: t.y * 16 + 12 }; }
    }
    this.seek(this.fleeGoal.x, this.fleeGoal.y, this.runSpeed, dt, scene);
  }

  wander(dt, scene) {
    const z = this.zone, map = scene.map;
    if (!this.goal) {
      this.moving = false;
      this.waitT -= dt;
      if (this.waitT <= 0) {
        // somewhere in its range it can actually stand
        for (let i = 0; i < 8 && !this.goal; i++) {
          const tx = Math.floor(z.x + G.rng.range(0, z.w)), ty = Math.floor(z.y + G.rng.range(0, z.h));
          if (this.walkable(map, tx, ty) && !map.buildingAtTile(tx, ty)) this.goal = { x: tx * 16 + 8, y: ty * 16 + 12 };
        }
        this.waitT = G.rng.range(1.5, 5);
        this.stateT = 0;
      }
      return;
    }
    const d = Math.hypot(this.goal.x - this.x, this.goal.y - this.y);
    if (d < 4 || this.stateT > 20) { this.goal = null; this.path = null; this.stateT = 0; return; }
    this.seek(this.goal.x, this.goal.y, this.walkSpeed, dt, scene);
  }


  onHurt(source, dmg, scene) {
    const b = this.def.behavior;
    if (b === 'skittish' || b === 'docile' || (source && source.kind === 'fire')) this.setState('flee', source);
    else this.setState('attack', source);
    if (G.rng.chance(0.5)) G.audio.play('animal', { x: this.x, y: this.y });
  }

  die(source, scene) {
    this.dead = true;
    const w = scene.world;
    if (w.wildlife[this.zoneKey]) w.wildlife[this.zoneKey].count = Math.max(0, w.wildlife[this.zoneKey].count - 1);
    if (source === scene.player || (source && source.firePlayer)) {
      w.stats.animals++;
      w.onKill(this.species);
      G.events.emit('xp', G.XP.animal(this.def), 'Hunt');
      if (this.owner && w.isAlive(this.owner) && source === scene.player) scene.reportCrime('livestock', this, 0, this.owner);
    }
    const loot = [];
    for (const [id, min, max, chance] of this.def.drops) if (G.rng.chance(chance)) loot.push([id, G.rng.int(min, max)]);
    G.containers.createCarcass(w, this, scene.map.id, loot);
    scene.refreshContainers();
  }
}

G.Animal = Animal;

// ---------------------------------------------------------------- smarter getting around
// The straight-line check now covers the animal's body width (it used to clip fence posts and house corners
// and grind there); routes keep out of water; with no route at all it picks a different goal instead of
// pushing into the wall; and a goal on the far side of water or a fence is not picked to begin with.
(() => {
const AP = G.Animal.prototype, _seek = AP.seek;
AP.clearLine = function (map, x1, y1) {
  const dx = x1 - this.x, dy = y1 - this.y, L = Math.hypot(dx, dy), n = Math.ceil(L / 5);
  if (!n) return true;
  const hw = Math.max(3, (this.w || 10) / 2 - 1), px = (-dy / L) * hw, py = (dx / L) * hw;
  for (let i = 1; i <= n; i++) {
    const cx = this.x + (dx * i) / n, cy = this.y - 3 + (dy * i) / n;
    for (const s of [-1, 0, 1]) if (!this.walkable(map, Math.floor((cx + px * s) / 16), Math.floor((cy + py * s) / 16))) return false;
  }
  return true;
};
const _find = G.pathfind.find;
AP.seek = function (tx, ty, speed, dt, scene) {
  // the shared planner, but keeping its feet dry
  G.pathfind.find = (m, sx, sy, gx, gy, budget, opts) => _find(m, sx, sy, gx, gy, budget, Object.assign({}, opts, { avoid: (x, y) => m.isSwimmable(x, y) }));
  const bx = this.x, by = this.y;
  try { _seek.call(this, tx, ty, speed, dt, scene); } finally { G.pathfind.find = _find; }
  // no headway for a while (no route, or wedged): give this goal up
  if (Math.hypot(this.x - bx, this.y - by) < speed * dt * 0.2) this.noWayT = (this.noWayT || 0) + dt; else this.noWayT = 0;
  if (this.noWayT > 2.5) {
    this.noWayT = 0; this.path = null;
    if (this.state === 'wander' || !this.state) { this.goal = null; this.waitT = 0.5; }
    else if (this.needGoal) { this.needGoal = null; this.hunger = Math.min(this.hunger, 50); this.thirst = Math.min(this.thirst, 50); }
    else if (this.state === 'flee') this.fleeGoal = null;
    else if (this.state === 'hunt' || this.state === 'attack') { if ((this.giveUpT = (this.giveUpT || 0) + 2.5) > 8) { this.giveUpT = 0; this.setState('wander'); } }
  }
};
// wander goals: somewhere it can reach (same side of water and fences: a quick budgeted check)
const _wander = AP.wander;
AP.wander = function (dt, scene) {
  const had = this.goal;
  _wander.call(this, dt, scene);
  if (!had && this.goal) {
    const m = scene.map, sx = Math.floor(this.x / 16), sy = Math.floor((this.y - 3) / 16), gx = Math.floor(this.goal.x / 16), gy = Math.floor((this.goal.y - 3) / 16);
    if (!this.clearLine(m, this.goal.x, this.goal.y) && scene.pathBudget > 0) {
      scene.pathBudget--;
      const r = _find(m, sx, sy, gx, gy, 1500, { avoid: (x, y) => m.isSwimmable(x, y) });
      if (!r) { this.goal = null; this.waitT = 0.3; }
    }
  }
};
})();
