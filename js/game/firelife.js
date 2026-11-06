'use strict';
// Fire, slower and closer to real.
//   Fires burn much longer and buildings take minutes, not seconds, to come down (G.FIRE_* in fire.js).
//   Furniture burns: beds, sofas, wardrobes, rugs, shelves, tables... feed the fire and leave charred
//   remains.
//   Inside a building you cannot see the flames from the street (the roof is in the way): you see smoke
//   pouring out of it. Once the roof is gone, you see everything.
//   Smoke: a fire inside fills the building with smoke. Anyone inside breathes it: they cough, lose health
//   and, if they stay, suffocate. People run outside; the room goes gray for you.
//   Cleanup: a burnt building leaves rubble. A city cleanup crew comes by during work hours, a few days
//   later, and clears it a bit at a time; only once the lot is clean does rebuilding start.
(() => {
const A = G.assets;
// ---------------------------------------------------------------- art
const mkSprite = (id, w, h, draw) => { const { c, x } = A.mk(w, h); draw(x); A.outline && A.outline(c); A.sprites[id] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; };
mkSprite('char_pile', 14, 8, (x) => { x.fillStyle = '#1a1614'; x.fillRect(1, 3, 12, 4); x.fillStyle = '#2e2620'; x.fillRect(3, 1, 7, 3); x.fillStyle = '#5a3a20'; x.fillRect(4, 4, 2, 1); x.fillRect(9, 5, 2, 1); x.fillStyle = '#6a6460'; x.fillRect(2, 6, 3, 1); });
mkSprite('rubble', 16, 10, (x) => {
  x.fillStyle = '#3a3430'; x.fillRect(1, 4, 14, 5); x.fillStyle = '#5a5450'; x.fillRect(3, 2, 6, 4); x.fillRect(9, 3, 4, 3);
  x.fillStyle = '#2a1e16'; x.fillRect(2, 7, 5, 2); x.fillRect(10, 6, 4, 2); x.fillStyle = '#7a7068'; x.fillRect(5, 2, 2, 1); x.fillRect(11, 3, 1, 1);
  x.fillStyle = '#4a2a1a'; x.fillRect(6, 5, 6, 1);   // a charred beam
});
G.DECOR.char_pile = { sprite: 'char_pile', solid: false };
G.DECOR.rubble = { sprite: 'rubble', solid: false, rubble: true };

// ---------------------------------------------------------------- furniture is fuel
const FURN = { bed: [14, 0.6], bed_red: [14, 0.6], bed_green: [14, 0.6], bed_double: [18, 0.6], wardrobe: [16, 0.6], nightstand: [8, 0.5], kcounter: [10, 0.4],
  piano: [16, 0.5], shelf: [12, 0.6], table: [10, 0.5], chair: [5, 0.5], bench: [8, 0.4], pew: [10, 0.5], tv: [4, 0.3], clothes_rack: [8, 0.7], barstool: [4, 0.4],
  pooltable: [12, 0.4], bj_table: [10, 0.4], roulette: [10, 0.4], display_case: [6, 0.3], crate: [8, 0.6], barrel: [8, 0.5], desk: [12, 0.5], couch: [16, 0.7], crib: [8, 0.6],
  barber_chair: [6, 0.4], counter: [10, 0.4], plant: [3, 0.4] };
for (const id in FURN) if (G.DECOR[id]) { const d = G.DECOR[id]; d.fuel = Math.max(d.fuel || 0, FURN[id][0]); d.flam = Math.max(d.flam || 0, FURN[id][1]); if (!d.burnsTo) d.burnsTo = 'char_pile'; }
G.DECOR.rug.fuel = 4; G.DECOR.rug.flam = 0.7;   // flat: burns where it lies (fuel of the tile under it)

// ---------------------------------------------------------------- what you see from outside
const FS = G.FireSystem.prototype, _draw = FS.draw, _tick = FS.tick;
const coveredBy = (map, i) => { const b = map.buildingAtTile(i % map.w, Math.floor(i / map.w)); return b && !b.destroyed && b.roofAlpha > 0.35 ? b : null; };
FS.draw = function (ctx, view, time) {
  // hide flames under an intact roof (the smoke is still drawn)
  const hidden = [];
  for (const [i, c] of this.cells) if (coveredBy(this.map, i)) { hidden.push([i, c]); this.cells.delete(i); }
  try { _draw.call(this, ctx, view, time); } finally { for (const [i, c] of hidden) this.cells.set(i, c); }
  // a glow in the windows and smoke pouring off the roof
  for (const [i] of hidden) {
    if (Math.random() < 0.04) { const b = coveredBy(this.map, i); if (b) this.smoke.push({ x: (b.x + 1 + Math.random() * (b.w - 2)) * 16, y: (b.y) * 16 - (b.extraH || 0), t: 2.4 + Math.random(), seed: Math.random() * 6, big: true }); }
  }
};
FS.tick = function () {
  _tick.call(this);
  // smoke builds up inside buildings that are burning
  const per = new Map();
  for (const i of this.cells.keys()) { const b = this.map.buildingAtTile(i % this.map.w, Math.floor(i / this.map.w)); if (b && !b.destroyed) per.set(b, (per.get(b) || 0) + 1); }
  for (const b of this.map.buildings) {
    const n = per.get(b) || 0, area = Math.max(4, (b.w - 2) * (b.h - 2));
    b.smoke = G.util.clamp((b.smoke || 0) + (n ? Math.min(0.08, n / area * 0.35) : -0.02), 0, 1);
    if (b.destroyed) b.smoke = 0;
  }
  this.suffocate();
};
FS.suffocate = function () {
  const scene = this.scene, map = this.map;
  for (const a of scene.actors) {
    if (a.dead || a.kind === 'animal' && !a.def) continue;
    const b = map.buildingAt(a.x, a.y - 3);
    if (!b || !(b.smoke > 0.2)) { a.smokeT = Math.max(0, (a.smokeT || 0) - 0.25); continue; }
    a.smokeT = (a.smokeT || 0) + 0.25 * b.smoke * 2;   // seconds of breathing it in, weighted by how thick it is
    if (a.kind === 'player') {
      if (G.effects && !G.effects.has(a, 'smoke_inhalation')) G.effects.add(a, 'smoke_inhalation', 30);
      if (a.smokeT > 3 && Math.random() < 0.15) scene.floatText(a.x, a.y - 26, '*cough*', '#c8c8c8');
    } else if (a.kind === 'npc') {
      if (Math.random() < 0.05) a.say(G.rng.pick(['*cough cough*', 'I can not breathe!', 'Get out, get OUT!']), 2);
      if (a.state !== 'flee' && a.def.combat !== 'guard' && !a.fireJob) { a.sleeping = false; a.startFlee({ x: a.x, y: a.y - 40, dead: false, kind: 'fire' }); a.goal = { x: b.doorX, y: b.doorY + 2 }; }
    }
    // a few seconds of thick smoke hurts; a minute of it kills
    if (a.smokeT > 4) G.combat.damage(a, Math.max(1, Math.round(b.smoke * 4)), { kind: 'fire', x: a.x, y: a.y + 4, dead: false, smoke: true }, scene);
  }
};
G.EFFECTS.smoke_inhalation = { id: 'smoke_inhalation', name: 'Smoke Inhalation', kind: 'status', bad: true, color: '#8a8a8a', stats: { stamina: -2 }, desc: 'Your lungs burn. Get to fresh air.' };
// gray haze when you are inside a smoky building
const GS = G.GameScene.prototype, _fx = GS.renderScreenFx;
GS.renderScreenFx = function (ctx) {
  _fx.call(this, ctx);
  const b = this.map && this.map.buildingAt(this.player.x, this.player.y - 3);
  if (b && b.smoke > 0.05) {
    const R = G.renderer; R.screenTransform ? R.screenTransform() : R.uiTransform();
    ctx.fillStyle = `rgba(70,66,62,${Math.min(0.75, b.smoke * 0.8)})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
};

// ---------------------------------------------------------------- rubble and the cleanup crew
G.cleanup = {
  START_DAYS: 2, REBUILD_DAYS: 9,
  // a building just burnt: leave rubble on its floor
  leaveRubble(map, b) {
    const st = G.world.buildingState(map.id, b.id); if (!st) return;
    let n = 0;
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      if ((x + y * 3) % 4 || map.decorsAt(x, y).some((d) => !d.def.flat)) continue;
      G.mods.addDecor(map, 'rubble', x, y); n++;
    }
    st.debris = n;
  },
  // one work hour: the crew clears some rubble at each site (in town and in the country)
  workHour(w, scene) {
    if (w.hour < 8 || w.hour >= 17) return;
    for (const mapId in w.mapMods) {
      const mods = w.mapMods[mapId];
      for (const id in mods.buildings) {
        const st = mods.buildings[id];
        if (!st.debris || w.day - st.day < this.START_DAYS) continue;
        let k = 2;   // pieces cleared per hour
        for (const key of Object.keys(mods.added)) {
          if (!k) break;
          if (mods.added[key][0] !== 'rubble') continue;
          const [, tx, ty] = mods.added[key], b = G.maps.get(mapId).building(id);
          if (!b || tx < b.x || tx >= b.x + b.w || ty < b.y || ty >= b.y + b.h) continue;
          if (scene && scene.map.id === mapId) { const d = scene.map.decorsAt(tx, ty).find((x) => x.type === 'rubble'); if (d) G.mods.removeDecor(scene.map, d); else delete mods.added[key]; }
          else delete mods.added[key];
          st.debris--; k--;
        }
        if (st.debris <= 0) { st.debris = 0; st.cleanDay = w.day; w.rumor(`The cleanup crew finished clearing the ${(G.maps.get(mapId).building(id) || {}).name || 'burnt lot'}.`, G.maps.get(mapId).meta.region); }
      }
    }
  },
  // the crew you can see: a few people in hi-vis at the site during work hours
  crew(scene) {
    const w = scene.world, mods = w.mapMods[scene.map.id];
    const want = new Set();
    if (mods && w.hour >= 8 && w.hour < 17) for (const id in mods.buildings) { const st = mods.buildings[id]; if (st.debris > 0 && w.day - st.day >= this.START_DAYS) want.add(id); }
    scene.actors = scene.actors.filter((a) => !a.cleanupSite || want.has(a.cleanupSite) || a.dead);
    for (const id of want) {
      if (scene.actors.some((a) => a.cleanupSite === id)) continue;
      const b = scene.map.building(id); if (!b) continue;
      for (let k = 0; k < 3; k++) {
        const seed = G.util.uid('crew'), look = G.look(seed, { top: 'vest', bottom: 'pants', shirt: '#e8a020', shirt2: '#e8e040', pants: '#3a4a6a', hat: 'helmet', hatColor: '#f0d020' });
        const def = { id: 'crew_' + seed, name: 'Cleanup Crew', map: scene.map.id, faction: 'government', hp: 40, combat: 'flee', look, transient: true, relations: {}, schedule: [{ from: 0, to: 24, at: { x: b.x + 1 + k * 2, y: b.y + Math.floor(b.h / 2) }, act: 'wander' }] };
        const st = { alive: true, name: def.name, map: scene.map.id, hp: 40, fear: 0, inv: [], gold: 10, realName: G.randomName(G.rng, look.body === 'f' ? 'female' : 'male'), introduced: false, talked: 0 };
        const n = new G.NPC(def.id, st, def);
        const spot = scene.map.randomWalkableNear(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2), 3, G.rng, false);
        n.x = spot.x * 16 + 8; n.y = spot.y * 16 + 12; n.cleanupSite = id;
        scene.actors.push(n);
      }
    }
  },
};
const W = G.World.prototype, _burnt = W.buildingBurnt;
W.buildingBurnt = function (mapId, b, state, byPlayer, witnessed) {
  const had = !!this.buildingState(mapId, b.id);
  _burnt.call(this, mapId, b, state, byPlayer, witnessed);
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!had && scene && scene.map.id === mapId) G.cleanup.leaveRubble(scene.map, b);
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!G.world) return;
  G.cleanup.workHour(G.world, scene);
  if (scene) G.cleanup.crew(scene);
});
const _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) { const r = _load.call(this, id, spawnName, pos); G.cleanup.crew(this); return r; };
})();
