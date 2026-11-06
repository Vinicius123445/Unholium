'use strict';
// Firearms: magazines and reloading, bullets (fast projectiles stopped by walls), muzzle flashes,
// and noise — gunshots scare civilians and bring the law, unless you are defending yourself.
// Player: p.mags = { weaponId: rounds loaded }, p.reloadT (seconds left, 0 = not reloading).

G.firearms = {
  SPEED: 560,

  loaded(p, w = p.weaponItem) { return w && w.gun ? p.mags[w.id] || 0 : 0; },

  reloadTime(p, w) {
    let t = w.reload / (1 + G.skills.stat(p, 'reloadSpeed'));
    if (w.cat === 'pistol' && G.skills.has(p, 'gunslinger')) t *= 0.8;
    return t;
  },

  startReload(p, scene) {
    const w = p.weaponItem;
    if (!w || !w.gun || p.reloadT > 0) return false;
    if (this.loaded(p, w) >= w.mag) return false;
    if (!p.inventory.has(w.ammo)) { scene.toast(`No ${G.item(w.ammo).name} left.`, 'bad'); G.audio.play('click'); return false; }
    p.reloadT = this.reloadTime(p, w);
    p.reloadFor = w.id;
    G.audio.play('reload');
    return true;
  },

  updatePlayer(p, dt) {
    if (p.reloadT <= 0) return;
    const w = p.weaponItem;
    if (!w || w.id !== p.reloadFor) { p.reloadT = 0; return; }   // switched weapons
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloadT = 0;
      const n = Math.min(w.mag - this.loaded(p, w), p.inventory.count(w.ammo));
      p.inventory.remove(w.ammo, n);
      p.mags[w.id] = this.loaded(p, w) + n;
      G.audio.play('cock');
    }
  },

  // Player pulls the trigger. angle in radians (world space).
  playerFire(p, scene, angle) {
    const w = p.weaponItem;
    if (p.reloadT > 0 || p.attackCd > 0) return;
    if (this.loaded(p, w) <= 0) { if (!this.startReload(p, scene)) { G.audio.play('click'); p.attackCd = 0.3; } return; }
    const scav = G.skills.has(p, 'scavenger') && G.rng.chance(0.2);
    if (!scav) p.mags[w.id]--;
    let cd = w.cd;
    if (w.cat === 'pistol' && G.skills.has(p, 'gunslinger')) cd *= 0.7;
    p.attackCd = cd;
    const moving = p.moving && !G.skills.has(p, 'steady_hands') ? 0.04 : 0;
    const spread = Math.max(0.004, (w.spread * (1 - G.util.clamp(G.skills.stat(p, 'accuracy'), 0, 0.6)) + G.effects.spread(p) + moving) * (p.aimSpread || 1));   // aimed shots are tighter (js/game/aim.js)
    const dmg = w.dmg * (1 + G.skills.stat(p, 'gunDmg'));
    this.shoot(p, scene, angle, w, { spread, dmg, crit: G.skills.has(p, 'deadeye') ? 0.15 : 0 });
    p.combatTimer = 4;
    G.renderer.shake(w.cat === 'shotgun' || w.cat === 'rifle' ? 3 : 1.5);
    this.noise(scene, p, w.loud || 300);
    if (this.loaded(p, w) === 0 && p.inventory.has(w.ammo)) this.startReload(p, scene);
  },

  // NPCs: no magazines, slower and less accurate than the player.
  npcFire(npc, scene, target) {
    const w = npc.weaponItem;
    const angle = Math.atan2(target.y - 4 - (npc.y - 4), target.x - npc.x);
    npc.attackCd = (w.auto ? w.cd * 5 : w.cd * 2.2) + 0.45 + Math.random() * 0.4;
    npc.faceTowards(target);
    this.shoot(npc, scene, angle, w, { spread: w.spread * 1.6 + 0.05, dmg: w.dmg * (w.pellets ? 0.5 : 0.8) });
    if (scene.isOnScreen(npc.x, npc.y)) G.renderer.shake(0.8);
  },

  shoot(shooter, scene, angle, w, o) {
    const pellets = w.pellets || 1;
    const hx = shooter.x + Math.cos(angle) * 8, hy = shooter.y - 2 + Math.sin(angle) * 5;
    if (G.effectsHD && !w.melee && w.cat !== 'bow') G.effectsHD.casing(shooter.x, shooter.y, shooter.dir, w.cat === 'shotgun');
    for (let i = 0; i < pellets; i++) {
      const a = angle + (Math.random() - 0.5) * 2 * o.spread;
      let dmg = o.dmg;
      const crit = o.crit && G.rng.chance(o.crit);
      if (crit) dmg *= 2.5;
      scene.bullets.push({ x: hx, y: hy, px: hx, py: hy, vx: Math.cos(a) * this.SPEED, vy: Math.sin(a) * this.SPEED, left: w.range * (0.85 + Math.random() * 0.3), dmg, crit, owner: shooter });
    }
    scene.flashes.push({ x: hx + Math.cos(angle) * 4, y: hy - 6 + Math.sin(angle) * 3, t: 0.06, a: angle });
    shooter.attackTimer = 0;
    shooter.shotT = 0.12;
    shooter.aim = angle;
    G.audio.play(w.cat === 'shotgun' ? 'shotgun' : w.cat === 'rifle' ? 'rifle' : 'gunshot', { x: shooter.x, y: shooter.y });
  },

  update(scene, dt) {
    const map = scene.map;
    for (const b of scene.bullets) {
      b.px = b.x; b.py = b.y;
      const steps = Math.ceil((this.SPEED * dt) / 4);
      for (let s = 0; s < steps && b.left > 0; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        b.left -= (this.SPEED * dt) / steps;
        if (b.x < 0 || b.y < 0 || b.x >= map.pw || b.y >= map.ph || (G.firearms.shotBlocked ? G.firearms.shotBlocked(map, Math.floor(b.x / 16), Math.floor((b.y + 2) / 16)) : map.isSolidTile(Math.floor(b.x / 16), Math.floor((b.y + 2) / 16)))) {
          if (G.explosions) G.explosions.bulletHitTile(scene, Math.floor(b.x / 16), Math.floor((b.y + 2) / 16), b);
          scene.particles(b.x, b.y - 6, '#d8c8a0', 3);
          b.left = 0;
          break;
        }
        const hit = this.hitActor(scene, b);
        if (hit) {
          G.combat.damage(hit, b.dmg, b.owner, scene, { bullet: true });
          if (b.crit && !hit.dead) scene.floatText(hit.x, hit.y - 28, 'CRITICAL', '#ffd040');
          b.left = 0;
        }
      }
    }
    scene.bullets = scene.bullets.filter((b) => b.left > 0);
    for (const f of scene.flashes) f.t -= dt;
    scene.flashes = scene.flashes.filter((f) => f.t > 0);
  },

  hitActor(scene, b) {
    const o = b.owner;
    for (const a of scene.actors) {
      if (a === o || a.dead) continue;
      if (o.kind !== 'player' && a !== o.target) continue;   // NPCs only hit who they are shooting at
      if (Math.abs(a.x - b.x) < a.radius + 1.5 && b.y > a.y - (a.sheet ? a.sheet.fh * 0.5 : 10) && b.y < a.y + 2) return a;
    }
    return null;
  },

  // A gunshot is heard far away. Civilians panic, guards come running unless you are clearly under attack.
  noise(scene, shooter, loud) {
    const attacked = scene.actors.some((a) => !a.dead && a.target === shooter && (a.state === 'fight' || a.state === 'attack' || a.state === 'mug'));
    let heardByLaw = false;
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a === shooter) continue;
      const dist = a.distTo(shooter) * (scene.map.buildingAt(a.x, a.y - 3) === scene.map.buildingAt(shooter.x, shooter.y - 3) ? 1 : 1.6);
      if (dist > loud) continue;
      a.sleeping = false;
      if (a.def.combat === 'flee' && a.state === 'schedule') { a.st.fear = 100; a.startFlee(shooter); }
      if (a.def.combat === 'guard' || (a.def.faction === 'civilians' && dist < loud * 0.5)) heardByLaw = true;
    }
    if (heardByLaw && !attacked && scene.region !== 'island' && (scene.gunCrimeT || 0) <= 0) {
      scene.gunCrimeT = 10;
      scene.world.commitCrime('gunfire', scene.region, true);
      for (const a of scene.actors) {
        if (a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.state === 'schedule' && a.distTo(shooter) < loud) { a.state = 'arrest'; a.say('Drop the weapon!'); }
      }
    }
  },

  // Bullets as short tracer streaks, muzzle flashes, and the gun in the shooter's hands.
  draw(ctx, scene) {
    ctx.lineWidth = 1;
    for (const b of scene.bullets) {
      ctx.strokeStyle = b.crit ? 'rgba(255,220,90,0.95)' : 'rgba(255,240,180,0.85)';
      ctx.beginPath();
      ctx.moveTo(b.px, b.py - 6);
      ctx.lineTo(b.x, b.y - 6);
      ctx.stroke();
    }
    for (const f of scene.flashes) {
      ctx.fillStyle = 'rgba(255,230,120,0.95)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,160,60,0.6)';
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(f.a) * 2, f.y + Math.sin(f.a) * 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawHeld(ctx, a) {
    const w = a.weaponItem;
    if (!w || !w.gun) return;
    const aiming = a.shotT > 0 || (a.kind === 'player' ? !!a.aiming || !!a.mouseHeld || G.input.isDown('attack') : a.state === 'fight');
    let ang = a.kind === 'player' ? a.aim : a.target ? Math.atan2(a.target.y - a.y, a.target.x - a.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][a.dir];
    if (!aiming && G.hd && G.hd.handOf && G.hd.handOf(a)) ang = Math.PI / 2 + (a.dir === 2 ? -0.5 : a.dir === 1 ? 0.5 : 0.2);   // lowered, pointing at the ground
    const hand = G.hd && G.hd.handOf ? G.hd.handOf(a) : null;   // HD people hold it in their hand
    const hx = hand ? hand.x : a.x + Math.cos(ang) * 4, hy = hand ? hand.y : a.y - 8 + Math.sin(ang) * 2;
    if (a.dir === 3) return;   // behind the body when facing away
    // a gun the size of the person, grip in the fist (models: js/game/heldgear.js)
    G.heldGear.draw(ctx, w, hx, hy, ang, hand ? (a.look && a.look.skin) || '#e0b088' : null);
  },
};
