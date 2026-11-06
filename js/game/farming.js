'use strict';
// Farming.
//   Till: with a hoe, face grass or dirt and press [E] ("Till the soil"): it becomes a field.
//   Plant: face an empty field tile with seeds in your pocket, [E] picks what to sow.
//   Water: with a watering can, [E] on a planted tile. Watered plants grow about 60% faster that day.
//   Grow and harvest: tomatoes, potatoes, carrots, corn, wheat and cabbage, each with its own pace (two to
//   four days). They sprout, leaf out, flower and ripen, drawn in the ground (HD, swaying a little in the
//   wind); ripe ones glint. [E] harvests: produce plus, often, seeds to plant again.
//   Fence it in with fences from construction mode; animals from the stable (js/game/beasts.js) make it a
//   farm. Your fields and crops are saved per map (w.crops).
//   Seeds: the Gas Station and Diner country (Farmland), Hardware & Auto, the Builders' Supply.
(() => {
const T = G.T, A = G.assets;
const def = (id, o) => { G.ITEMS[id] = Object.assign({ id, stack: 50 }, o); };
const CROPS = {
  tomato: { name: 'Tomatoes', days: 3, out: 'tomato', yield: [2, 4], fruit: '#d83a2a', leaf: '#3a8a3a', kind: 'vine' },
  potato: { name: 'Potatoes', days: 4, out: 'potato', yield: [3, 5], fruit: '#c8a060', leaf: '#4a9a3a', kind: 'bush' },
  carrot: { name: 'Carrots', days: 3, out: 'carrot', yield: [2, 4], fruit: '#e87a2a', leaf: '#5aaa3a', kind: 'tops' },
  corn: { name: 'Corn', days: 4, out: 'corn', yield: [2, 3], fruit: '#e8c840', leaf: '#5a9a2a', kind: 'stalk' },
  wheat: { name: 'Wheat', days: 3, out: 'wheat', yield: [3, 5], fruit: '#d8b040', leaf: '#8aaa3a', kind: 'grain' },
  cabbage: { name: 'Cabbage', days: 4, out: 'cabbage_head', yield: [1, 2], fruit: '#7ac05a', leaf: '#4a9a3a', kind: 'head' },
};
G.CROPS = CROPS;
for (const k in CROPS) def('seed_' + k, { name: `${CROPS[k].name} Seeds`, type: 'material', icon: 'seeds', value: 2, desc: `Sow on tilled soil. Ready in about ${CROPS[k].days} days.` });
const _init = A.init;
A.init = function () {
  _init.call(this);
  const { c, x } = A.mk(16, 16);
  x.fillStyle = '#d8c8a0'; x.fillRect(3, 3, 10, 11); x.fillStyle = '#b8a880'; x.fillRect(3, 3, 10, 2); x.fillStyle = '#6aa04a'; x.fillRect(6, 7, 4, 4); x.fillStyle = '#8a6a3a'; for (const [a, b] of [[5, 12], [8, 12], [11, 12]]) x.fillRect(a, b, 1, 1);
  A.outline(c); A.icons.seeds = c;
};
for (const [shop, extra] of [['f_gas', 6], ['r_smith', 6], ['i_supply', 10]]) { const s = G.SHOPS[shop]; if (s) for (const k in CROPS) if (!s.stock.some((e) => e[0] === 'seed_' + k)) s.stock.push(['seed_' + k, extra]); }
const TILLABLE = () => new Set([T.grass, T.darkgrass, T.dirt, T.field_burnt, T.burnt_grass].filter((v) => v != null));

const F = G.farming = {
  crops(w, mapId) { w.crops = w.crops || {}; return (w.crops[mapId] = w.crops[mapId] || {}); },
  at(scene, tx, ty) { return this.crops(scene.world, scene.map.id)[tx + ',' + ty] || null; },
  front(scene) { const p = scene.player, [fx, fy] = G.util.DIR_VEC[p.dir]; return { tx: Math.floor(p.x / 16) + fx, ty: Math.floor((p.y - 3) / 16) + fy }; },
  ripe(c) { return c.g >= 1; },
  // what [E] would do on this tile
  action(scene) {
    const p = scene.player, { tx, ty } = this.front(scene), map = scene.map;
    if (!map.inBounds(tx, ty) || map.meta.indoor || map.meta.floorOf) return null;
    const c = this.at(scene, tx, ty), t = map.get(tx, ty);
    if (c && this.ripe(c)) return { kind: 'harvest', tx, ty, label: `Harvest ${CROPS[c.crop].name.toLowerCase()}` };
    if (c && p.inventory.has('watering_can') && c.wateredDay !== scene.world.day) return { kind: 'water', tx, ty, label: 'Water the plants' };
    if (c) return { kind: 'look', tx, ty, label: `${CROPS[c.crop].name} (${Math.floor(c.g * 100)}%)` };
    if (t === T.field && Object.keys(CROPS).some((k) => p.inventory.has('seed_' + k))) return { kind: 'plant', tx, ty, label: 'Plant seeds' };
    if (p.inventory.has('hoe') && TILLABLE().has(t) && !map.decorsAt(tx, ty).some((d) => !d.def.flat) && !map.buildingAtTile(tx, ty)) return { kind: 'till', tx, ty, label: 'Till the soil (hoe)' };
    return null;
  },
  run(scene, a) {
    const p = scene.player, w = scene.world, map = scene.map, crops = this.crops(w, map.id), key = a.tx + ',' + a.ty;
    if (a.kind === 'till') { for (const d of map.decorsAt(a.tx, a.ty).slice()) if (d.def.flat) G.mods.removeDecor(map, d); G.mods.tile(map, a.tx, a.ty, T.field); G.audio.play('dig'); p.stamina = Math.max(0, p.stamina - 6); return; }
    if (a.kind === 'plant') {
      const opts = Object.keys(CROPS).filter((k) => p.inventory.has('seed_' + k)).map((k) => ({ label: `${CROPS[k].name} (${p.inventory.count('seed_' + k)} seeds)`, fn: () => { p.inventory.remove('seed_' + k, 1); crops[key] = { crop: k, g: 0, planted: w.day, wateredDay: -1 }; G.audio.play('dig'); } }));
      if (opts.length === 1) opts[0].fn(); else G.scenes.push(new G.ChoiceScene('Plant', 'What do you sow here?', opts.concat([{ label: 'Nothing', fn: () => {} }])));
      return;
    }
    if (a.kind === 'water') {
      // water the whole little patch around you (3x3), like a can would
      for (let y = a.ty - 1; y <= a.ty + 1; y++) for (let x = a.tx - 1; x <= a.tx + 1; x++) { const c = crops[x + ',' + y]; if (c) c.wateredDay = w.day; }
      G.audio.play('splash'); scene.toast('Watered.', 'good'); return;
    }
    if (a.kind === 'harvest') {
      const c = crops[key], cr = CROPS[c.crop], n = G.rng.int(cr.yield[0], cr.yield[1]);
      p.inventory.add(cr.out, n);
      const seeds = G.rng.chance(0.7) ? G.rng.int(1, 2) : 0; if (seeds) p.inventory.add('seed_' + c.crop, seeds);
      delete crops[key]; G.audio.play('pickup'); G.events.emit('xp', 3, 'Farming');
      scene.toast(`Harvested ${n} ${G.ITEMS[cr.out].name.toLowerCase()}${seeds ? ` and ${seeds} seed${seeds > 1 ? 's' : ''}` : ''}.`, 'good');
      return;
    }
    if (a.kind === 'look') { const c = crops[key]; scene.toast(`${CROPS[c.crop].name}: ${Math.floor(c.g * 100)}% grown${c.wateredDay === w.day ? ', watered today' : ', thirsty'}.`); }
  },
  // every game hour, everything planted grows (on every map, seen or not)
  grow(w) {
    for (const mapId in w.crops || {}) for (const k in w.crops[mapId]) {
      const c = w.crops[mapId][k], cr = CROPS[c.crop]; if (!cr) continue;
      c.g = Math.min(1, c.g + (1 / (cr.days * 24)) * (c.wateredDay === w.day ? 1.6 : 1));
    }
  },
};
G.events.on('hour', () => { if (G.world) F.grow(G.world); });
// [E]
const GS = G.GameScene.prototype, _find = GS.findInteraction, _int = GS.interact;
GS.findInteraction = function () {
  const t = _find.call(this);
  if (t || !this.player || this.player.vehicle) return t;
  const a = F.action(this);
  return a ? { type: 'farm', farm: a, label: a.label } : null;
};
GS.interact = function () { const t = this.promptTarget; if (t && t.type === 'farm') { F.run(this, t.farm); return; } return _int.apply(this, arguments); };

// ---------------------------------------------------------------- drawing the crops
const sh = (c, f) => A.shade(c, f);
function plant(ctx, c, x, y, t, sway) {
  const cr = CROPS[c.crop], g = c.g, st = g < 0.15 ? 0 : g < 0.45 ? 1 : g < 0.8 ? 2 : g < 1 ? 3 : 4;
  const leaf = cr.leaf, lt = sh(leaf, 1.25), dk = sh(leaf, 0.7);
  // a darker, damp patch when watered today
  if (c.wateredDay === G.world.day) { ctx.fillStyle = 'rgba(40,24,10,0.25)'; ctx.fillRect(x - 7, y - 3, 14, 6); }
  ctx.save(); ctx.translate(x, y);
  const lean = (dx) => dx + sway;
  const blade = (h, ang, col, w = 1) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.sin(ang) * h * 0.5, -h * 0.6, lean(Math.sin(ang) * h), -h); ctx.stroke(); };
  const ell = (ex, ey, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  if (st === 0) { blade(3, -0.6, lt); blade(3, 0.6, leaf); }
  else if (cr.kind === 'stalk' || cr.kind === 'grain') {
    const n = cr.kind === 'grain' ? 7 : 3, h = [0, 6, 11, 14, 15][st] * (cr.kind === 'grain' ? 0.75 : 1);
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * (cr.kind === 'grain' ? 1.6 : 3.5), a = (i - (n - 1) / 2) * 0.12;
      ctx.save(); ctx.translate(ox, 0);
      const col = cr.kind === 'grain' && st >= 3 ? (st === 4 ? '#d8b040' : '#b8b050') : i % 2 ? leaf : lt;
      blade(h, a, col, cr.kind === 'grain' ? 0.8 : 1.4);
      if (cr.kind === 'stalk' && st >= 2) { blade(h * 0.6, a - 0.9, dk, 1); blade(h * 0.55, a + 0.9, leaf, 1); }
      if (cr.kind === 'grain' && st >= 2) ell(lean(Math.sin(a) * h), -h, 0.8, 2, st === 4 ? '#e8c860' : '#c8c060');
      if (cr.kind === 'stalk' && st >= 3) { ell(lean(1.2), -h * 0.55, 1.1, 2.6, st === 4 ? cr.fruit : '#b8c860'); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(lean(1.2) - 0.3, -h * 0.55 - 3.6, 0.6, 1.2); }
      ctx.restore();
    }
  } else {
    const size = [0, 2.5, 4, 5, 5.5][st];
    if (cr.kind === 'vine') { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-0.4, -size * 2.4, 0.8, size * 2.4); }   // a stake
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = size * (0.5 + (i % 3) * 0.2); ell(lean(Math.cos(a) * r * 0.9), -size * 0.9 + Math.sin(a) * r * 0.5 - (cr.kind === 'vine' ? size * 0.8 : 0), size * 0.55, size * 0.4, i % 2 ? leaf : lt); }
    ell(lean(0), -size * 0.6, size * 0.5, size * 0.3, dk);
    if (cr.kind === 'head' && st >= 2) { ell(lean(0), -size * 0.7, size * 0.6, size * 0.5, st >= 3 ? cr.fruit : lt); ell(lean(-0.5), -size * 0.85, size * 0.3, size * 0.2, sh(cr.fruit, 1.3)); }
    if (cr.kind === 'tops' && st >= 3) ell(0, -0.5, 1.4, 0.8, cr.fruit);   // the carrot's shoulder showing
    if (cr.kind === 'bush' && st >= 3) for (let i = 0; i < 3; i++) ell(-3 + i * 3, 0, 1.2, 0.7, sh(cr.fruit, 0.85));
    if (cr.kind === 'vine' && st >= 3) for (let i = 0; i < (st === 4 ? 4 : 2); i++) { const fx = lean(Math.cos(i * 1.7) * size * 0.6), fy = -size * 1.3 + Math.sin(i * 1.7) * size * 0.4; ell(fx, fy, 1.3, 1.3, st === 4 ? cr.fruit : '#8ab84a'); ell(fx - 0.4, fy - 0.4, 0.4, 0.4, '#ffffff88'); }
    if (st === 2 && cr.kind !== 'head') for (let i = 0; i < 2; i++) ell(lean(Math.cos(i * 2.6) * size * 0.5), -size * 1.2, 0.7, 0.7, '#f8f0a0');   // flowers
  }
  ctx.restore();
  if (st === 4 && Math.sin(t * 3 + x) > 0.85) { ctx.fillStyle = 'rgba(255,255,220,0.9)'; ctx.fillRect(x + 3, y - 12, 1, 1); ctx.fillRect(x + 2, y - 11, 3, 1); ctx.fillRect(x + 3, y - 10, 1, 1); }   // ripe: a glint
}
const V = G.visuals;
if (V && V.afterGround) {
  const _ag = V.afterGround;
  V.afterGround = function (ctx, scene, view) {
    _ag.call(this, ctx, scene, view);
    const w = scene.world, crops = w && w.crops && w.crops[scene.map.id]; if (!crops) return;
    const t = G.loop.time, bz = G.breeze || { dx: 0, t: 0, strength: 0 };
    for (const k in crops) {
      const [tx, ty] = k.split(',').map(Number), x = tx * 16 + 8, y = ty * 16 + 13;
      if (x < view.x - 20 || x > view.x + view.w + 20 || y < view.y - 10 || y > view.y + view.h + 30) continue;
      const sway = bz.dx * 0.8 + Math.sin(bz.t * 2 + tx * 1.3 + ty) * 0.4 * (0.4 + bz.strength);
      for (const [ox, oy] of [[-4, -4], [4, -4], [0, 2]]) plant(ctx, crops[k], x + ox, y + oy - 2, t, sway);
    }
  };
}
// the dig sound
if (!G.audio.SFX.dig) G.audio.SFX.dig = function (o, T2) { const w = T2._out(o, { vol: 0.5, wet: 0.05 }); if (!w) return; T2._burst(w.node, w.t, { noise: 'brown', dur: 0.18, vol: 0.4, type: 'lowpass', f: 700 }); };
})();
