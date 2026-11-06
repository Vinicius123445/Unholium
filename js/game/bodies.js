'use strict';
// Gore and bodies.
//   G.gore: blood splatter on every hit, spreading pools under the dead, gibs from heavy weapons,
//           smears when bodies are dragged. Stains stay on the ground for a couple of days
//           (world.decals). Can be turned off in Settings ("Gore & Blood").
//   G.bodies: drag corpses (G key), dump them in water, hide them in dumpsters or bury them (shovel).
//           Bodies left where people can see them get discovered: people scream, the police investigate,
//           and being seen dragging one counts as being seen committing the murder.

G.gore = {
  on() { return G.settings.get('gore') !== false; },
  list(scene) {
    const w = scene.world;
    w.decals = w.decals || {};
    return (w.decals[scene.map.id] = w.decals[scene.map.id] || []);
  },
  add(scene, d) {
    if (!this.on()) return;
    const list = this.list(scene);
    d.day = scene.world.day;
    d.seed = G.rng.int(0, 1e6);
    list.push(d);
    if (list.length > 260) list.splice(0, list.length - 260);
  },
  // A hit: droplets fly away from the attacker and land as small splats.
  onHit(scene, target, source, dmg, bullet) {
    if (!this.on() || !(target.human || target.kind === 'player' || target.kind === 'animal')) return;
    let ax = 0, ay = 0;
    if (source && source.x != null) { const dx = target.x - source.x, dy = target.y - source.y, d = Math.hypot(dx, dy) || 1; ax = dx / d; ay = dy / d; }
    const n = Math.min(14, 3 + Math.round(dmg / 3) + (bullet ? 6 : 0));
    for (let i = 0; i < n; i++) {
      const sp = 40 + Math.random() * (bullet ? 110 : 60);
      scene.parts.push({ x: target.x, y: target.y - 8, vx: ax * sp + (Math.random() - 0.5) * 50, vy: ay * sp - Math.random() * 40, t: 0.4 + Math.random() * 0.4, color: G.rng.pick(['#a01818', '#7a0e0e', '#c02828']) });
    }
    const splats = bullet ? 3 : 1 + (dmg > 12 ? 1 : 0);
    for (let i = 0; i < splats; i++) this.add(scene, { x: target.x + ax * G.rng.range(4, bullet ? 26 : 12) + G.rng.range(-4, 4), y: target.y + ay * G.rng.range(2, 12) + G.rng.range(-3, 3), r: G.rng.range(1.5, 3.5), type: 'splat' });
  },
  onDeath(scene, actor, source) {
    if (!this.on()) return;
    this.add(scene, { x: actor.x, y: actor.y - 3, r: 3, grow: 11 + G.rng.range(0, 4), born: G.loop.time, type: 'pool' });
    const w = source && source.weaponItem;
    if (w && (w.cat === 'shotgun' || w.id === 'sledgehammer' || w.id === 'steel_sword' || w.cat === 'rifle') || (source && source.kind === 'fire')) {
      for (let i = 0; i < 7; i++) this.add(scene, { x: actor.x + G.rng.range(-18, 18), y: actor.y + G.rng.range(-10, 10), r: G.rng.range(1, 2.5), type: 'gib' });
      scene.particles(actor.x, actor.y - 8, '#6a0a0a', 20);
    }
  },
};

G.bodies = {
  nearest(scene, range = 20) {
    const p = scene.player;
    let best = null, bd = range;
    for (const c of scene.containers) {
      if (c.kind !== 'corpse') continue;
      const d = G.util.dist(c.x, c.y, p.x, p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },
  dragged(scene) { const id = scene.player.dragging; return id && scene.world.containers[id]; },

  toggle(scene) {
    const p = scene.player;
    if (p.dragging) { p.dragging = null; scene.toast('You let go of the body.'); return; }
    if (p.swimming) return;
    const c = this.nearest(scene);
    if (!c) { scene.toast('There is no body here to drag.'); return; }
    p.dragging = c.id;
    p.sitting = null;
    scene.toast('You grab the body. (G to let go)', 'warn');
  },

  update(scene, dt) {
    const p = scene.player, w = scene.world;
    const c = this.dragged(scene);
    if (p.dragging && (!c || c.map !== scene.map.id || p.dead)) p.dragging = null;
    if (c && p.dragging) {
      // the body slides along behind you, smearing blood
      const [fx, fy] = G.util.DIR_VEC[p.dir];
      const tx = p.x - fx * 12, ty = p.y - fy * 8 + 2;
      const moved = Math.hypot(tx - c.x, ty - c.y);
      c.x += (tx - c.x) * Math.min(1, dt * 8); c.y += (ty - c.y) * Math.min(1, dt * 8);
      p.trailAcc = (p.trailAcc || 0) + moved * dt * 8;
      if (p.trailAcc > 10) { p.trailAcc = 0; G.gore.add(scene, { x: c.x + G.rng.range(-2, 2), y: c.y - 2, type: 'trail' }); }
    }
    // discovery: anyone who sees a body (or you dragging one) reacts
    if ((this.scanT = (this.scanT || 0) - dt) > 0) return;
    this.scanT = 1.2;
    for (const body of scene.containers) {
      if (body.kind !== 'corpse' || !body.victim) continue;
      const rec = w.dead[body.victim];
      const draggingThis = p.dragging === body.id;
      if (!rec || (rec.discovered && !draggingThis)) continue;
      for (const a of scene.actors) {
        if (a.kind !== 'npc' || a.dead || a.sleeping || a.transient || a.faction.outlaw) continue;
        const d = G.util.dist(a.x, a.y, body.x, body.y);
        if (d > (w.isNight() ? 60 : 110) || scene.map.buildingAt(a.x, a.y - 3) !== scene.map.buildingAt(body.x, body.y - 3)) continue;
        if (draggingThis && a.canSee(scene, p, 120)) {
          a.say(G.rng.pick(['Oh my God! You killed them!', 'Murderer! Somebody help!']));
          if (!rec.witnessed) { rec.witnessed = true; w.commitCrime('murder', scene.region, true, body.victim); }
          if (a.def.combat === 'guard') a.startFight(p, scene); else if (a.def.combat === 'flee') { a.st.fear = 100; a.startFlee(p); }
        } else if (!rec.discovered) {
          a.say(G.rng.pick(['Oh my God! Someone is dead!', 'Is that... a body?! Call the police!', 'No, no, no... Help! Somebody!']));
          if (a.def.combat === 'flee') { a.st.fear = Math.max(a.st.fear, 70); a.startFlee(p); }
          w.tension[scene.region] = Math.min(100, (w.tension[scene.region] || 0) + 8);
          w.rumor(`Someone found ${w.displayName(body.victim)}'s body. The police are asking questions.`, scene.region);
        }
        rec.discovered = true;
        break;
      }
    }
  },

  // Where can the dragged body go right now? (for the interaction prompt)
  disposal(scene) {
    const p = scene.player;
    if (!p.dragging) return null;
    const [fx, fy] = G.util.DIR_VEC[p.dir];
    for (const k of [10, 18, 26]) if (scene.map.isWaterAt(p.x + fx * k, p.y - 3 + fy * k)) return { how: 'water', label: 'Dump the body in the water' };
    const t = scene.map.get(Math.floor(p.x / 16), Math.floor((p.y - 3) / 16));
    if ([G.T.grass, G.T.darkgrass, G.T.dirt, G.T.sand, G.T.field, G.T.lot].includes(t) && !scene.map.buildingAt(p.x, p.y - 3)) {
      return { how: 'bury', label: p.inventory.has('shovel') ? 'Bury the body (1 hour)' : 'Bury the body (needs a shovel)' };
    }
    return null;
  },

  dispose(scene, how) {
    const p = scene.player, w = scene.world, c = this.dragged(scene);
    if (!c) return;
    if (how === 'bury' && !p.inventory.has('shovel')) { scene.toast('You need a shovel to dig a grave.', 'bad'); return; }
    const seen = scene.actors.some((a) => a.kind === 'npc' && !a.dead && !a.sleeping && !a.faction.outlaw && a.canSee(scene, p, 120));
    if (how === 'bury') { scene.passTime(1, false); p.stamina = 0; G.gore.add(scene, { x: p.x, y: p.y, r: 6, type: 'splat' }); }
    G.audio.play(how === 'water' ? 'door' : 'hit');
    delete w.containers[c.id];
    p.dragging = null;
    scene.refreshContainers();
    if (c.victim && w.dead[c.victim]) {
      const rec = w.dead[c.victim];
      rec.disposed = how;
      if (!seen) rec.discovered = true;   // nobody will ever find it: it becomes a disappearance
      if (seen && !rec.witnessed) { rec.witnessed = true; w.commitCrime('murder', scene.region, true, c.victim); }
    }
    scene.toast({ water: 'The body sinks out of sight.', dumpster: 'You stuff the body in the dumpster and close the lid.', bury: 'You bury the body. Nobody will find it here.' }[how], seen ? 'bad' : 'good');
    if (seen) scene.toast('Someone saw you!', 'bad');
    if (c.victim) w.log(`${w.displayName(c.victim)} has disappeared.`, 'warn');
  },
};
