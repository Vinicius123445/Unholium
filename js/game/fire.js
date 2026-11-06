'use strict';
// Fire & destruction.
//
// Fire is simulated on the tile grid. Every tile's fuel/flammability comes from its material (see
// G.TILES / G.DECOR in js/data/tiles.js), plus the roof above it, plus any oil poured there.
// Wood, siding and shingles burn fast and collapse; plaster burns a little; stone never burns, but a stone
// building with a wooden floor/furniture can still be gutted inside. Fire spreads to neighbours,
// hurts anyone standing in it and leaves burnt terrain behind. Everything is recorded in the world's
// map mods, so it persists; consequence rules rebuild buildings and regrow grass/fields later.
//
// Melee destruction: crates, barrels, fences, bushes, stalls... can be smashed; trees can be chopped
// with an axe (dropping firewood).

// how fast fuel burns (per quarter second), how readily fire jumps to a neighbor, and how much of a building has to
// burn out before it comes down
G.FIRE_BURN = 0.13; G.FIRE_SPREAD = 0.08; G.FIRE_COLLAPSE = 0.5;   // slowed again (TO DO, 2026-10-31)

// asphalt shingles burn well; flat concrete roofs and slate do not (the building is gutted instead of collapsing)
G.ROOF_FUEL = { thatch: 30, shingle: 22, brown: 18, red: 14, green: 14, blue: 4, white: 4, slate: 0, dark: 0, flat: 0, flat_light: 0, flat_dark: 0, flat_brick: 0 };

// Persistent map modifications (recorded in G.world.mapMods)
G.mods = {
  tile(map, tx, ty, newT) {
    const m = G.world.modsFor(map.id);
    const i = ty * map.w + tx;
    const orig = m.tiles[i] ? m.tiles[i][2] : map.ground[i];
    map.setTileRuntime(tx, ty, newT);
    if (newT === orig) delete m.tiles[i];
    else m.tiles[i] = [newT, G.world.day, orig];
  },
  removeDecor(map, d) {
    const m = G.world.modsFor(map.id);
    const k = map.decorKey(d);
    if (m.added[k]) delete m.added[k];
    else m.removed[k] = G.world.day;
    map.removeDecorRuntime(d);
  },
  addDecor(map, type, tx, ty) {
    const m = G.world.modsFor(map.id);
    const d = map.addDecorRuntime(type, tx, ty);
    m.added[map.decorKey(d)] = [type, tx, ty, G.world.day];
    return d;
  },
  removeChest(map, chest) {
    const m = G.world.modsFor(map.id);
    m.removed['chest@' + chest.tx + ',' + chest.ty] = G.world.day;
    const i = chest.ty * map.w + chest.tx;
    map.chestAt.delete(i);
    map.recomputeSolid(chest.tx, chest.ty);
  },
};

class FireSystem {
  constructor(scene) {
    this.scene = scene;
    this.cells = new Map();   // tile index -> { fuel, heat, byPlayer, witnessed }
    this.oil = new Map();     // tile index -> remaining oil fuel
    this.projectiles = [];
    this.smoke = [];
    this.acc = 0;
    this.reset(scene.map);
  }

  reset(map) {
    this.map = map;
    this.cells.clear();
    this.oil.clear();
    this.projectiles = [];
    this.smoke = [];
    for (const b of map.buildings) b._burnt = 0;
  }

  get active() { return this.cells.size > 0 || this.projectiles.length > 0; }

  roofFuel(tx, ty) {
    const b = this.map.buildingAtTile(tx, ty);
    if (!b || b.destroyed) return 0;
    return G.ROOF_FUEL[b.roof] || 0;
  }

  fuelAt(i) {
    const map = this.map, tx = i % map.w, ty = Math.floor(i / map.w);
    let fuel = G.TILES[map.ground[i]].fuel || 0;
    for (const d of map.decorsAt(tx, ty)) if (!d.def.flat) fuel += d.def.fuel || 0;
    fuel += this.roofFuel(tx, ty) * 0.5;
    fuel += this.oil.get(i) || 0;
    return fuel;
  }

  flamAt(i) {
    const map = this.map, tx = i % map.w, ty = Math.floor(i / map.w);
    if (G.TILES[map.ground[i]].water) return 0;
    let f = G.TILES[map.ground[i]].flam || 0;
    for (const d of map.decorsAt(tx, ty)) if (!d.def.flat && d.def.flam) f = Math.max(f, d.def.flam);
    if (this.roofFuel(tx, ty) > 10) f = Math.max(f, 0.45);
    if (this.oil.has(i)) f = 1;
    return f;
  }

  isBurning(tx, ty) { return this.cells.has(ty * this.map.w + tx); }

  canBurn(tx, ty) {
    if (!this.map.inBounds(tx, ty)) return false;
    const i = ty * this.map.w + tx;
    return this.flamAt(i) > 0 && this.fuelAt(i) > 0;
  }

  ignite(tx, ty, byPlayer = false, witnessed = false) {
    if (!this.canBurn(tx, ty)) return false;
    const i = ty * this.map.w + tx;
    if (this.cells.has(i)) return true;
    this.cells.set(i, { fuel: this.fuelAt(i), heat: 0.35, byPlayer, witnessed });
    return true;
  }

  pourOil(tx, ty) {
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (!this.map.inBounds(x, y)) continue;
      const i = y * this.map.w + x;
      if (G.TILES[this.map.ground[i]].water) continue;
      this.oil.set(i, (this.oil.get(i) || 0) + (x === tx && y === ty ? 30 : 18));
    }
  }

  throwBomb(from, dir, byPlayer, witnessed) {
    const [fx, fy] = G.util.DIR_VEC[dir];
    const tx = from.x + fx * 56, ty = from.y - 6 + fy * 56;
    this.projectiles.push({ sx: from.x, sy: from.y - 10, tx, ty, t: 0, dur: 0.45, byPlayer, witnessed });
  }

  update(dt) {
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.t >= p.dur) {
        const cx = Math.floor(p.tx / 16), cy = Math.floor(p.ty / 16);
        this.pourOil(cx, cy);
        for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) this.ignite(x, y, p.byPlayer, p.witnessed);
        this.scene.particles(p.tx, p.ty, '#f08a20', 14);
        G.audio.play('hit');
        G.renderer.shake(3);
        p.done = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
    for (const s of this.smoke) { s.t -= dt; s.y -= dt * 14; s.x += Math.sin(s.t * 3 + s.seed) * dt * 4; }
    this.smoke = this.smoke.filter((s) => s.t > 0);
    if (!this.cells.size) return;
    this.acc += dt;
    while (this.acc >= 0.25) { this.acc -= 0.25; this.tick(); }
  }

  tick() {
    const map = this.map, W = map.w, rng = G.rng;
    const born = [];
    for (const [i, c] of this.cells) {
      c.heat = Math.min(1, c.heat + 0.12);
      c.fuel -= G.FIRE_BURN * (0.6 + c.heat);   // a wooden wall burns for about a minute, a house takes several to go down (js/game/firelife.js)
      if (c.heat > 0.45) {
        const tx = i % W, ty = Math.floor(i / W);
        const b = map.buildingAtTile(tx, ty);
        for (const [dx, dy, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 0.4], [-1, 1, 0.4], [1, -1, 0.4], [-1, -1, 0.4]]) {
          const nx = tx + dx, ny = ty + dy;
          if (!map.inBounds(nx, ny)) continue;
          const j = ny * W + nx;
          if (this.cells.has(j)) continue;
          const f = this.flamAt(j);
          if (f <= 0 || this.fuelAt(j) <= 0) continue;
          const sameBuilding = b && b === map.buildingAtTile(nx, ny);
          const downwind = Math.max(0.25, 1 + (dx * (G.breeze ? G.breeze.dx : 0) + dy * (G.breeze ? G.breeze.dy : 0)) * 0.9);   // fire runs with the wind: ragged, uneven fronts
          if (rng.next() < f * G.FIRE_SPREAD * c.heat * w * downwind * (sameBuilding ? 1.3 : 1) * (0.6 + rng.next() * 0.8)) born.push([j, c]);
        }
      }
      if (rng.next() < 0.35) this.smoke.push({ x: (i % W) * 16 + 4 + rng.next() * 8, y: Math.floor(i / W) * 16 + 2, t: 1.6 + rng.next(), seed: rng.next() * 6 });
      if (c.fuel <= 0) this.burnOut(i, c);
    }
    for (const [j, c] of born) if (!this.cells.has(j)) this.cells.set(j, { fuel: this.fuelAt(j), heat: 0.2, byPlayer: c.byPlayer, witnessed: c.witnessed });
    this.hurtActors();
    if (this.cells.size && rng.chance(0.3)) { const fi = [...this.cells.keys()][rng.int(0, this.cells.size - 1)], W = this.scene.map.w; G.audio.play('fire', { x: (fi % W) * 16 + 8, y: Math.floor(fi / W) * 16 + 8 }); }
  }

  burnOut(i, c) {
    const map = this.map, tx = i % map.w, ty = Math.floor(i / map.w);
    this.cells.delete(i);
    this.oil.delete(i);
    const def = G.TILES[map.ground[i]];
    if (def.burnsTo) G.mods.tile(map, tx, ty, G.T[def.burnsTo]);
    for (const d of map.decorsAt(tx, ty).slice()) {
      if (d.def.flat || !d.def.fuel) continue;
      G.mods.removeDecor(map, d);
      if (d.def.burnsTo) G.mods.addDecor(map, d.def.burnsTo, d.tx, d.ty);
    }
    const b = map.buildingAtTile(tx, ty);
    if (b && !b.destroyed && !b.gutted) {
      b._burnt = (b._burnt || 0) + 1;
      if (b._burnt >= b.w * b.h * G.FIRE_COLLAPSE) this.collapse(b, c);
    }
  }

  // A building has burnt enough to be ruined: burnable roofs collapse, wooden walls fall,
  // furniture and chest contents are lost. Stone walls remain standing.
  collapse(b, c) {
    const map = this.map, w = G.world;
    const state = (G.ROOF_FUEL[b.roof] || 0) > 0 ? 'destroyed' : 'gutted';
    b[state] = true;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const def = G.TILES[map.get(x, y)];
      if (def.burnsTo && (state === 'destroyed' || !def.wall)) G.mods.tile(map, x, y, G.T[def.burnsTo]);
      for (const d of map.decorsAt(x, y).slice()) {
        if (d.def.flat || !d.def.fuel) continue;
        G.mods.removeDecor(map, d);
      }
      this.cells.delete(y * map.w + x);
    }
    for (const ch of map.chests) {
      if (ch.tx < b.x || ch.tx >= b.x + b.w || ch.ty < b.y || ch.ty >= b.y + b.h) continue;
      const cont = w.containers[ch.id];
      const salvage = cont ? cont.items.filter((e) => ['weapon', 'armor', 'trinket'].includes(G.item(e[0]).type) || e[0] === 'gem') : [];
      if (cont) { cont.destroyed = true; cont.items = []; cont.gold = 0; }
      G.mods.removeChest(map, ch);
      if (salvage.length) G.containers.createBag(w, map.id, ch.tx * 16 + 8, ch.ty * 16 + 12, salvage);
    }
    map.renderMinimap();
    w.buildingBurnt(map.id, b, state, c.byPlayer, c.witnessed);
    this.scene.refreshContainers();
    G.renderer.shake(4);
    G.audio.play('death');
  }

  hurtActors() {
    const scene = this.scene, map = this.map;
    for (const a of scene.actors) {
      if (a.dead) continue;
      const tx = Math.floor(a.x / 16), ty = Math.floor((a.y - 3) / 16);
      const c = this.cells.get(ty * map.w + tx);
      if (c && c.heat > 0.3) {
        const src = { kind: 'fire', x: a.x + (G.rng.next() - 0.5) * 4, y: a.y + 4, firePlayer: c.byPlayer, witnessed: c.witnessed, dead: false };
        if (a.sleeping) a.sleeping = false;
        G.combat.damage(a, 3, src, scene);
      }
      // NPCs and animals near flames run from them
      if (a.kind === 'npc' && a.state !== 'flee' && a.state !== 'fight' && this.nearFire(tx, ty, 2)) {
        a.sleeping = false;
        a.startFlee({ x: tx * 16 + 8, y: ty * 16 + 8, dead: false, kind: 'fire' });
        a.say('Fire! FIRE!');
      } else if (a.kind === 'animal' && a.state !== 'flee' && this.nearFire(tx, ty, 2)) {
        a.setState('flee', { x: tx * 16, y: ty * 16, dead: false });
      }
    }
  }

  nearFire(tx, ty, r) {
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (this.map.inBounds(x, y) && this.cells.has(y * this.map.w + x)) return true;
    return false;
  }

  // Light sources for the night lighting pass (sampled to keep it cheap)
  lights() {
    const out = [];
    let n = 0;
    for (const [i, c] of this.cells) {
      if (n++ % 3) continue;
      out.push({ x: (i % this.map.w) * 16 + 8, y: Math.floor(i / this.map.w) * 16 + 4, r: 34 + c.heat * 20, color: '255,140,50', flicker: true });
      if (out.length > 40) break;
    }
    return out;
  }

  drawGround(ctx, view) {
    ctx.fillStyle = 'rgba(30,22,10,0.55)';
    for (const [i] of this.oil) {
      const x = (i % this.map.w) * 16, y = Math.floor(i / this.map.w) * 16;
      if (x < view.x - 16 || y < view.y - 16 || x > view.x + view.w || y > view.y + view.h) continue;
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 9, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx, view, time) {
    G.fireHD.draw(ctx, this, view, time);   // (js/game/firehd.js)
    for (const s of this.smoke) { const a = Math.min(0.4, s.t * 0.22); ctx.fillStyle = `rgba(70,66,62,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0.5, (s.big ? 5 : 2.5) + (2.4 - s.t) * 2.2), 0, Math.PI * 2); ctx.fill(); }
    for (const p of this.projectiles) { const k = p.t / p.dur; const x = G.util.lerp(p.sx, p.tx, k), y = G.util.lerp(p.sy, p.ty, k) - Math.sin(k * Math.PI) * 20; ctx.drawImage(G.assets.icon('firebomb'), x - 5, y - 5, 10, 10); }
  }
}
G.FireSystem = FireSystem;

// ---------------------------------------------------------------- melee destruction
G.destruction = {
  // Called after the player swings a weapon. Damages the breakable thing right in front of them.
  playerHit(scene, p) {
    const map = scene.map;
    const [fx, fy] = G.util.DIR_VEC[p.dir];
    const tx = Math.floor((p.x + fx * 12) / 16), ty = Math.floor((p.y - 4 + fy * 12) / 16);
    const axe = p.weaponItem && p.weaponItem.icon === 'axe';
    const d = map.decorsAt(tx, ty).find((x) => !x.def.flat && x.def.breakHp);
    if (d) {
      if (d.def.chop && !axe) { if (!scene._axeHint) { scene.toast('You need an axe to chop that.'); scene._axeHint = true; } return; }
      d.hp = (d.hp ?? d.def.breakHp) - p.damage();
      scene.particles(d.x, d.y - 8, d.def.chop ? '#8a6a3a' : '#a08060', 5);
      G.audio.play('hit');
      if (d.hp <= 0) this.breakDecor(scene, d);
      return;
    }
    const def = G.TILES[map.get(tx, ty)];
    if (def.breakTo) {
      scene.tileHp = scene.tileHp || {};
      const k = tx + ',' + ty;
      scene.tileHp[k] = (scene.tileHp[k] ?? def.breakHp) - p.damage();
      scene.particles(tx * 16 + 8, ty * 16 + 8, '#8a5a2e', 4);
      G.audio.play('hit');
      if (scene.tileHp[k] <= 0) {
        delete scene.tileHp[k];
        G.mods.tile(map, tx, ty, G.T[def.breakTo]);
        if (scene.region === 'rural' && def.name === 'fence') scene.reportCrime('vandalism', null, 0, 'r_farmer1');
      }
    }
  },

  breakDecor(scene, d) {
    const map = scene.map, w = scene.world;
    G.mods.removeDecor(map, d);
    if (d.def.breakTo) G.mods.addDecor(map, d.def.breakTo, d.tx, d.ty);
    const loot = [];
    for (const [id, min, max, chance] of d.def.drops || []) if (G.rng.chance(chance)) loot.push([id, G.rng.int(min, max)]);
    if (loot.length) G.containers.createBag(w, map.id, d.x, d.y, loot);
    scene.particles(d.x, d.y - 6, '#6a4a2a', 10);
    if (d.def.owned && scene.region !== 'forest') {
      const b = map.buildingAt(d.x, d.y - 4);
      const owner = b && (scene.residents[b.id] || [])[0];
      scene.reportCrime('vandalism', null, 0, owner || null);
    }
    scene.refreshContainers();
  },
};

// ---------------------------------------------------------------- fire tools (inventory "use")
// Returns true when used. Arson near property is a crime if anyone sees it.
G.fireTools = {
  frontTile(p) {
    const [fx, fy] = G.util.DIR_VEC[p.dir];
    return { tx: Math.floor((p.x + fx * 14) / 16), ty: Math.floor((p.y - 4 + fy * 14) / 16) };
  },
  // Owned property near the tile? (buildings, fields, stalls...) -> arson
  victimNear(scene, tx, ty) {
    const map = scene.map;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      const b = map.buildingAtTile(x, y);
      if (b) return (scene.residents[b.id] || [])[0] || 'property';
      const t = G.TILES[map.get(x, y)].name;
      if (t === 'wheat' || t === 'cabbage' || t === 'fence') return 'r_farmer1';
      if (map.decorsAt(x, y).some((d) => d.def.owned)) return 'property';
    }
    return null;
  },
  start(scene, tx, ty, how) {
    const p = scene.player, fire = scene.fire;
    const witnessed = scene.witnessesOf(null).length > 0;
    let ok;
    if (how === 'bomb') { fire.throwBomb(p, p.dir, true, witnessed); ok = true; }
    else ok = fire.ignite(tx, ty, true, witnessed);
    if (!ok) { scene.toast('Nothing there will burn.'); return false; }
    scene.world.stats.fires++;
    const victim = how === 'bomb' ? this.victimNear(scene, Math.floor((p.x + G.util.DIR_VEC[p.dir][0] * 56) / 16), Math.floor((p.y + G.util.DIR_VEC[p.dir][1] * 56) / 16)) : this.victimNear(scene, tx, ty);
    if (victim) scene.reportCrime('arson', null, 0, victim === 'property' ? null : victim);
    return true;
  },
};

Object.assign(G.ITEM_USE, {
  torch(game) {
    const { tx, ty } = G.fireTools.frontTile(game.player);
    if (G.fireTools.start(game, tx, ty, 'torch')) G.audio.play('swing');
    return true;
  },
  oil_flask(game) {
    const { tx, ty } = G.fireTools.frontTile(game.player);
    game.fire.pourOil(tx, ty);
    game.player.inventory.remove('oil_flask', 1);
    game.toast('You pour oil on the ground.');
    G.audio.play('eat');
    return true;
  },
  fire_bomb(game) {
    G.fireTools.start(game, 0, 0, 'bomb');
    game.player.inventory.remove('fire_bomb', 1);
    G.audio.play('swing');
    return true;
  },
});
