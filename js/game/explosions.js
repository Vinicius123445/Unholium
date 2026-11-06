'use strict';
// Things that blow up.
//   Cars and motorcycles: bullets damage them. Badly shot up (or caught in a fire) they start burning, and a
//   few seconds later the tank goes: a fireball that hurts everyone close, knocks them back, sets the ground
//   around on fire and can set off the next car. What is left is a burnt-out wreck.
//   Gas pumps: a few bullets or a fire next to one and it explodes, bigger than a car, and it takes the
//   pumps beside it along. Blowing things up in town is arson (if someone saw you).
(() => {
const pick = (a) => G.rng.pick(a);
G.explosions = {
  list: [],
  // a blast at (x, y): r is the radius in pixels
  blast(scene, x, y, r, dmg, byPlayer) {
    G.audio.play('explosion', { x, y });
    G.renderer.shake(Math.min(14, 6 + r / 8));
    this.list.push({ x, y, r, t: 0, map: scene.map.id });
    for (let i = 0; i < 40; i++) scene.particles(x + G.rng.range(-r / 3, r / 3), y - 6 + G.rng.range(-r / 4, r / 4), pick(['#ffb040', '#ff6a20', '#ffe080', '#3a3a3a']), 1);
    for (const a of scene.actors.slice()) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d > r) continue;
      const f = 1 - d / r;
      G.combat.damage(a, Math.round(dmg * (0.35 + f * 0.65)), byPlayer ? scene.player : null, scene);
      const k = 260 * f, dd = d || 1;
      a.kbx = ((a.x - x) / dd) * k; a.kby = ((a.y - y) / dd) * k;
      if (a.kind === 'npc' && !a.dead) { a.st.fear = 100; if (a.def.combat === 'flee') a.startFlee(scene.player); }
    }
    // the ground around catches fire
    const tx = Math.floor(x / 16), ty = Math.floor(y / 16), rt = Math.max(1, Math.round(r / 24));
    for (let yy = -rt; yy <= rt; yy++) for (let xx = -rt; xx <= rt; xx++) if (xx * xx + yy * yy <= rt * rt + 1 && Math.random() < 0.75) scene.fire.ignite(tx + xx, ty + yy, byPlayer, byPlayer && scene.anyoneSaw(null));
    // nearby vehicles and pumps take it too
    for (const v of scene.vehicles || []) {
      const d = Math.hypot(v.x - x, v.y - y);
      if (v.exploded || d > r * 1.3) continue;
      v.damage(Math.round(dmg * (1 - d / (r * 1.3))), scene);
      if (!v.burning && !v.m.bike) { v.burning = 2 + Math.random() * 3; v.burnByPlayer = byPlayer; }   // bicycles have no fuel: they only get wrecked
    }
    for (const d of this.pumps(scene.map)) if (!d.primed && Math.hypot(d.x - x, d.y - 8 - y) < r * 1.2) { d.primed = 0.4 + Math.random() * 0.8; d.byPlayer = byPlayer; }
    if (byPlayer && scene.region !== 'island') { const seen = scene.anyoneSaw(null); scene.world.commitCrime('arson', scene.region, seen); if (seen) scene.toast('People saw you blow that up.', 'bad'); }
  },
  pumps(map) { return map.decor.filter((d) => d.type === 'gas_pump' && !d.removed); },
  bulletHitTile(scene, tx, ty, b) {
    const pump = (scene.map.decorsAt(tx, ty) || []).find((d) => d.type === 'gas_pump' && !d.removed);
    if (!pump) return;
    pump.hits = (pump.hits || 0) + 1;
    scene.particles(pump.x, pump.y - 10, '#c8c0a0', 4);
    if (pump.hits >= 3 && !pump.primed) { pump.primed = 0.6; pump.byPlayer = b.owner === scene.player; }
    else if (pump.hits === 1) { pump.leak = true; }
  },
  explodePump(scene, d) {
    scene.map.removeDecorRuntime(d);
    scene.map.addDecorRuntime('car_wreck', d.tx, d.ty);   // a twisted lump of metal where it stood
    this.blast(scene, d.x, d.y - 8, 80, 90, !!d.byPlayer);
  },
  explodeVehicle(scene, v) {
    v.exploded = true; v.wrecked = true; v.speed = 0; v.burning = 0; v.hp = 0; v.burnt = true;
    if (v.driver === 'player') G.vehicles.exit(scene, true);
    if (v.ai && v.ai.driver) { v.ai.driver = null; }
    v.ai = null;
    if (v.m.moto && !v.fallen) { v.fallen = true; v.fallT = 1; v.fallSide = Math.random() < 0.5 ? -1 : 1; }   // nothing holds a burnt bike up
    // traffic has no record of its own and would be gone with the map: a wreck stays where it burnt
    const w = scene.world; if (!v.rec) { v.rec = { id: 'wreck_' + G.util.uid(), model: v.model }; G.vehicles.records(w).push(v.rec); }
    Object.assign(v.rec, { map: scene.map.id, x: v.x, y: v.y, angle: v.angle, wrecked: true, burnt: true, hp: 0, fallen: !!v.fallen, fallSide: v.fallSide });
    this.blast(scene, v.x, v.y, v.m.moto ? 44 : 60, v.m.moto ? 55 : 75, !!v.burnByPlayer);
  },
  update(scene, dt) {
    this.list = this.list.filter((e) => (e.t += dt) < 0.9 && e.map === scene.map.id);
    for (const v of scene.vehicles || []) {
      if (v.exploded || v.m.bike) { if (v.m.bike) v.burning = 0; continue; }   // bicycles never burn or explode
      // shot to pieces, or standing in a fire: it starts to burn
      if (!v.burning && (v.hp <= v.m.hp * 0.15 || (scene.fire.isBurning(Math.floor(v.x / 16), Math.floor(v.y / 16)) && Math.random() < dt * 0.6))) { v.burning = 4 + Math.random() * 5; }
      if (v.burning) {
        if (Math.random() < dt * 12) scene.particles(v.x + G.rng.range(-v.L, v.L) * 0.6, v.y - 6, pick(['#ff8a2a', '#ffd040', '#5a5a5a']), 1);
        if ((v.burning -= dt) <= 0) this.explodeVehicle(scene, v);
      }
    }
    for (const d of this.pumps(scene.map)) {
      if (!d.primed && (Math.random() < dt * 0.5) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, y]) => scene.fire.isBurning(d.tx + x, d.ty + y))) { d.primed = 1.5 + Math.random() * 2; d.byPlayer = true; }
      if (d.leak && Math.random() < dt * 3) scene.particles(d.x, d.y - 4, '#c8b060', 1);
      if (d.primed && (d.primed -= dt) <= 0) this.explodePump(scene, d);
    }
  },
  draw(ctx, scene) {
    for (const e of this.list) {
      const k = e.t / 0.9, r = e.r * (0.35 + k * 0.75);
      ctx.globalAlpha = Math.max(0, 1 - k);
      const g = ctx.createRadialGradient(e.x, e.y - 8, 2, e.x, e.y - 8, r);
      g.addColorStop(0, '#fff8d0'); g.addColorStop(0.3, '#ffc040'); g.addColorStop(0.65, 'rgba(240,90,20,0.8)'); g.addColorStop(1, 'rgba(60,40,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y - 8, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
};
// bullets hit cars
const F = G.firearms, _hit = F.hitActor, _draw = F.draw;
F.hitActor = function (scene, b) {
  for (const v of scene.vehicles || []) {
    if (v.exploded || v.driver === 'player' && b.owner === scene.player) continue;
    if (v.covers(b.x, b.y + 4, 0)) { v.damage(Math.round(b.dmg * 0.6), scene); if (b.owner === scene.player) v.burnByPlayer = true; scene.particles(b.x, b.y, '#d8d8e0', 3); b.left = 0; return null; }
  }
  return _hit.call(this, scene, b);
};
F.draw = function (ctx, scene) { _draw.call(this, ctx, scene); G.explosions.draw(ctx, scene); };
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) { const r = _gu.call(this, dt); if (this.map && this.fire) G.explosions.update(this, dt); return r; };
})();
