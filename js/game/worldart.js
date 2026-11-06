'use strict';
// The world's surface, all in one hand: wet weather, fruit, ground items, and the finish on people and animals.
//   Rain builds up: the ground darkens, puddles grow in the low spots (roads, paths, sidewalks), rain rings them, and
//   they shrink again after it stops. (What gets wet on a person is their clothes, piece by piece: js/game/wetclothes.js.)
//   Fruit: blueberry, raspberry, blackberry and strawberry bushes each give their own fruit; apple trees stand in the
//   farmland and suburbs with windfalls under them. Mushrooms and other pickings are redrawn in detail.
//   Finish: every character and animal sheet goes through one pass (fine grain, light on upper edges, shade under
//   forms), so people and beasts share a surface. Animal breeds carry their own markings.
//   Lamps cast shadows at night: each person near a light throws a soft shadow away from it.
(() => {
const A = G.assets, GS = G.GameScene.prototype, TM = G.TileMap.prototype, AP = G.Actor.prototype, V = G.vk, clamp = G.util.clamp;
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const hash2 = (a, b, s = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
const vn = (x, y, s) => { const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sm = (t) => t * t * (3 - 2 * t), a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1), u = sm(tx), v = sm(ty); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
// ---------------------------------------------------------------- weather on the ground
const W = () => G.weather;
const OUT = (map) => !map.meta.indoor && !map.meta.floorOf;
const puddlesOf = (map) => {
  if (map.puddles) return map.puddles;
  const out = [], ok = new Set([G.T.asphalt, G.T.road_line, G.T.road_line_v, G.T.sidewalk, G.T.concrete, G.T.lot, G.T.dirt, G.T.path, G.T.plaza, G.T.cobble, G.T.court]);
  for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
    if (!ok.has(map.get(tx, ty)) || map.buildingAtTile(tx, ty)) continue;
    const n = vn(tx * 16, ty * 16, 74); if (n < 0.66 || hash2(tx, ty, 2) < 0.68) continue;
    out.push({ x: tx * 16 + 2 + hash2(tx, ty, 3) * 12, y: ty * 16 + 2 + hash2(tx, ty, 4) * 12, r: 5 + hash2(tx, ty, 5) * 9, th: 0.12 + (1 - (n - 0.66) / 0.34) * 0.55, rot: hash2(tx, ty, 7) * 3, sq: 0.45 + hash2(tx, ty, 6) * 0.25, t: 0 });
  }
  return (map.puddles = out);
};
const _dg = TM.drawGround;
TM.drawGround = function (ctx, view, time) {
  const r = _dg.apply(this, arguments), w = W(); if (!w || !G.gfx('weather') || !OUT(this)) return r;
  const g = w.ground || 0;
  if (g > 0.01) {
    ctx.fillStyle = `rgba(12,20,36,${(g * 0.2).toFixed(3)})`; ctx.fillRect(view.x, view.y, view.w, view.h);       // wet ground is darker
    const list = puddlesOf(this), t = time || G.loop.time;
    for (const p of list) {
      if (p.x < view.x - 24 || p.x > view.x + view.w + 24 || p.y < view.y - 16 || p.y > view.y + view.h + 16) continue;
      const k = clamp((g - p.th) / 0.35, 0, 1); if (k <= 0) continue;
      const rx = p.r * (0.4 + k * 0.9), ry = rx * p.sq;
      ctx.fillStyle = 'rgba(20,30,48,0.26)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, 6.3); ctx.ellipse(p.x + Math.cos(p.rot) * rx * 0.7, p.y + Math.sin(p.rot) * ry * 0.6, rx * 0.55, ry * 0.7, 0, 0, 6.3); ctx.ellipse(p.x - Math.cos(p.rot) * rx * 0.6, p.y + ry * 0.3, rx * 0.4, ry * 0.5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(165,188,215,0.17)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.2, p.y - ry * 0.3, rx * 0.55, ry * 0.28, 0, 0, 6.3); ctx.fill();    // the sky in it
      if (w.rain > 0.1) { const ph = (t * 1.4 + p.x * 0.13) % 1; ctx.strokeStyle = `rgba(210,225,240,${(0.4 * (1 - ph)).toFixed(2)})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(p.x + Math.sin(p.y + Math.floor(t * 1.4 + p.x * 0.13)) * rx * 0.5, p.y, 1 + ph * 3.4, (1 + ph * 3.4) * 0.5, 0, 0, 6.3); ctx.stroke(); }
    }
  }
  // drops crown as they hit
  if (w.rain > 0.05) { ctx.fillStyle = 'rgba(215,228,242,0.6)'; for (let i = 0; i < w.rain * 26; i++) { const x = view.x + Math.random() * view.w, y = view.y + Math.random() * view.h; ctx.fillRect(x - 1.2, y - 0.8, 0.7, 0.7); ctx.fillRect(x + 0.6, y - 1, 0.7, 0.7); ctx.fillRect(x - 0.2, y - 1.6, 0.6, 0.6); } }
  // lamps throw shadows at night: people near a light, a soft shape falling away from it
  const sc = sceneNow(); if (sc && sc.map === this && G.gfx('shadows') && (this.meta.indoor || sc.world.lighting().dark > 0.3)) {
    for (const a of sc.actors) {
      if (a.dead || a.kind === 'vehicle' || a.x < view.x - 40 || a.x > view.x + view.w + 40 || a.y < view.y - 40 || a.y > view.y + view.h + 40) continue;
      let n = 0;
      for (const l of this.lights) {
        const dx = a.x - l.x, dy = a.y - l.y, d = Math.hypot(dx, dy); if (d < 6 || d > l.r * 1.3) continue;
        const k = 1 - d / (l.r * 1.3), len = clamp(d * 0.4, 6, 24), ang = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang); const g2 = ctx.createLinearGradient(0, 0, len * 2, 0); g2.addColorStop(0, `rgba(0,0,0,${(0.3 * k).toFixed(2)})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(len, 0, len, 3.6, 0, 0, 6.3); ctx.fill(); ctx.restore();
        if (++n >= 2) break;
      }
    }
  }
  return r;
};
const _u = GS.update;
GS.update = function (dt) {
  const r = _u.call(this, dt), w = W();
  if (w) w.ground = clamp((w.ground || 0) + (w.rain > 0.05 ? dt * w.rain / 70 : -dt / 260), 0, 1);
  return r;
};
// ---------------------------------------------------------------- the finish on every sheet
const finish = (img, o) => {
  try {
    const w = img.width, h = img.height, x = img.getContext('2d'), d = x.getImageData(0, 0, w, h), D = d.data, sk = o.skin ? [1, 3, 5].map((i) => parseInt(o.skin.slice(i, i + 2), 16)) : null;
    const al = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : D[(py * w + px) * 4 + 3]);
    const src = new Uint8ClampedArray(D);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4; if (src[i + 3] < 40) continue;
      const n = hash2(px, py, 9) * 2 - 1, skin = sk && Math.abs(src[i] - sk[0]) + Math.abs(src[i + 1] - sk[1]) + Math.abs(src[i + 2] - sk[2]) < 70;
      let k = 1 + n * (skin ? 0.025 : o.fur ? 0.075 : 0.05);
      if (!skin && !o.fur) k += (px + py) % 2 ? 0.014 : -0.014;                     // the weave of cloth
      if (o.fur) k += Math.sin(px * 0.9 + hash2(py, 1) * 3) * 0.03;                 // hair lies in one direction
      if (al(px, py - 2) < 40) k += 0.1; else if (al(px, py + 2) < 40) k -= 0.14;   // light from above, shade beneath
      D[i] = src[i] * k; D[i + 1] = src[i + 1] * k; D[i + 2] = src[i + 2] * k;
    }
    x.putImageData(d, 0, 0);
  } catch (e) { /* a tainted or lost canvas keeps its plain look */ }
};
G.sheetFinish = finish;
const _hg = G.hd.get;
G.hd.get = function (sheet, now) { const h = _hg.call(this, sheet, now); if (h && !h.finished) { h.finished = true; finish(h.img, { skin: h.L && h.L.skin }); } return h; };
// breeds you can tell apart at a glance
const MARK = {
  'dog.shepherd': 'saddle', 'dog.rottweiler': 'tan', 'dog.husky': 'mask', 'dog.dalmatian': 'spots', 'dog.greyhound': 'lean', 'dog.chihuahua': 'tan',
  'cat.siamese': 'points', 'cat.alley': 'tabby', 'cat.mainecoon': 'tabby', 'cat.persian': 'fluff', 'cat.bengal': 'tabby',
  'horse.clydesdale': 'feather', 'horse.appaloosa': 'rump', 'horse.thoroughbred': 'blaze', 'horse.mustang': 'dun', 'donkey.miniature': 'cross', 'donkey.standard': 'cross',
};
const _bd = G.beasts.draw;
G.beasts.draw = function (ctx, b, x, y, face, phase, speed, t, o = {}) {
  _bd.apply(this, arguments);
  const mk = MARK[`${b.species}.${b.breed || (b.rec && b.rec.breed)}`]; if (!mk || b.dead) return;
  const big = b.species === 'horse' || b.species === 'donkey', dog = b.species === 'dog', s = (o.scale || 1) * ((G.breeds.of(b) || {}).scale || 1), by = big ? -14 : dog ? -8 : -6, bl = big ? 10 : dog ? 6 : 4.4;
  ctx.save(); ctx.translate(x, y); if (!face) ctx.scale(-1, 1); ctx.scale(s, s); ctx.globalAlpha = 0.72;
  const E = (cx, cy, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.3); ctx.fill(); };
  if (mk === 'saddle') E(0, by - 0.5, bl * 0.8, 1.6, '#1e1a16');
  else if (mk === 'tan') { E(bl + 1, by + 3, 1.6, 1.1, '#a86a2c'); E(-bl + 1, by + 5, 1.2, 1, '#a86a2c'); E(bl - 1, by + 6, 1, 1.2, '#a86a2c'); }
  else if (mk === 'mask') E(bl + 1.4, by + 0.4, 1.8, 1.3, '#f0f0f0');
  else if (mk === 'points') { E(bl + 1.2, by + 0.6, 2, 1.7, '#3a2a20'); E(-bl - 1, by + 1, 1.8, 0.8, '#3a2a20'); }
  else if (mk === 'tabby') { ctx.fillStyle = 'rgba(30,20,12,0.7)'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * bl / 4, by - 1.4, 0.8, 3.4); }
  else if (mk === 'fluff') { E(0, by + 1, bl + 1.4, 3.6, 'rgba(255,255,255,0.22)'); }
  else if (mk === 'feather') { ctx.fillStyle = '#f0ece4'; for (const lx of [-bl * 0.8, bl * 0.7]) ctx.fillRect(lx, -4, 4, 4); }
  else if (mk === 'rump') { E(-bl * 0.6, by, bl * 0.55, 3.6, '#f0ece4'); ctx.fillStyle = '#2a1e14'; for (let i = 0; i < 7; i++) ctx.fillRect(-bl + i * 1.8, by - 2 + (i % 3) * 1.6, 1, 1); }
  else if (mk === 'blaze') { ctx.fillStyle = '#f0ece4'; ctx.fillRect(bl + 2.4, by - 3, 1.2, 5); }
  else if (mk === 'dun' || mk === 'cross') { ctx.fillStyle = '#1e1610'; ctx.fillRect(-bl, by - 3, bl * 2, 0.9); if (mk === 'cross') ctx.fillRect(bl * 0.4, by - 3, 0.9, 5); }
  ctx.restore();
};
if (G.BREEDS_EXTRA) G.BREEDS_EXTRA();
// ---------------------------------------------------------------- fruit
const leaf = (x, cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, r, r * 0.8, 0.4, 0, 6.3); x.fill(); };
const bush = (fruit, dark, tall) => (R, x) => {
  const H = tall ? 20 : 15; x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(10, H + 1, 9, 2, 0, 0, 6.3); x.fill();
  for (const [a, b, r, c] of [[6, H - 5, 5, '#2e5a2a'], [14, H - 5, 5, '#2e5a2a'], [10, H - 9, 6, '#3a6e32'], [5, H - 9, 4, '#44803a'], [15, H - 10, 4, '#44803a'], [10, H - 4, 5, '#3a6e32'], [8, H - 12, 3.4, '#558f44'], [13, H - 7, 2.6, '#558f44']]) leaf(x, a, b, r, c);
  for (let i = 0; i < 26; i++) { const a = 3 + ((i * 37) % 14), b = H - 13 + ((i * 53) % 11); R(a, b, 1.6, 0.8, i % 2 ? '#2a4e26' : '#6aa050'); }
  for (let i = 0; i < 15; i++) { const a = 3 + ((i * 29) % 14), b = H - 13 + ((i * 19) % 11); x.fillStyle = dark; x.beginPath(); x.arc(a, b, 1.2, 0, 6.3); x.fill(); x.fillStyle = fruit; x.beginPath(); x.arc(a - 0.2, b - 0.2, 0.95, 0, 6.3); x.fill(); R(a - 0.6, b - 0.7, 0.4, 0.4, 'rgba(255,255,255,0.7)'); }
};
const FRUIT = [['blueberry', 'Blueberries', '#3a58a8', '#1e2e60', 'Small, dusty blue, sweet.'], ['raspberry', 'Raspberries', '#c8305a', '#7a1a38', 'Soft and tart.'], ['blackberry', 'Blackberries', '#2a1e3a', '#120c1e', 'Dark, a little sour.'], ['strawberry', 'Wild Strawberries', '#d83a2a', '#8a1e14', 'Tiny and very sweet.']];
const FN = [];
for (const [id, name, col, dark, desc] of FRUIT) {
  G.ITEMS[id] = { id, name, type: 'consumable', icon: id, heal: 5, value: 3, stack: 20, desc };
  V.add('bush_' + id, 20, 22, bush(col, dark, true), { interact: 'forage', forage: id, solid: true, fuel: 8, flam: 0.7, breakHp: 6, foliage: true });
  FN.push(id);
}
V.add('apple_tree', 46, 58, (R, x) => {
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(23, 55, 17, 3, 0, 0, 6.3); x.fill();
  R(20, 32, 6, 24, '#5a3e26'); R(20, 32, 2, 24, '#6e4e30'); R(25, 32, 1, 24, '#3e2a1a'); for (let y = 34; y < 54; y += 4) R(21 + (y % 3), y, 3, 0.6, '#3e2a1a');
  x.strokeStyle = '#5a3e26'; x.lineWidth = 2; x.beginPath(); x.moveTo(23, 38); x.lineTo(12, 26); x.moveTo(23, 36); x.lineTo(35, 24); x.stroke();
  for (const [a, b, r, c] of [[12, 24, 11, '#2e5a2a'], [34, 24, 11, '#2e5a2a'], [23, 16, 14, '#37682f'], [12, 15, 9, '#3f7636'], [34, 14, 9, '#3f7636'], [23, 28, 12, '#37682f'], [18, 8, 7, '#4f8a3f'], [29, 9, 7, '#4f8a3f']]) leaf(x, a, b, r, c);
  for (let i = 0; i < 70; i++) R(4 + ((i * 41) % 38), 3 + ((i * 29) % 34), 1.6, 0.8, i % 3 ? '#2a4e26' : '#6aa050');
  for (let i = 0; i < 13; i++) { const a = 6 + ((i * 31) % 34), b = 8 + ((i * 17) % 28); x.fillStyle = '#7a1414'; x.beginPath(); x.arc(a, b, 1.9, 0, 6.3); x.fill(); x.fillStyle = '#c82a22'; x.beginPath(); x.arc(a - 0.2, b - 0.2, 1.55, 0, 6.3); x.fill(); R(a - 0.9, b - 1, 0.6, 0.6, 'rgba(255,255,255,0.7)'); }
}, { interact: 'forage', forage: 'apple', solid: true, fuel: 30, flam: 0.4, breakHp: 40 });
V.add('windfall', 9, 7, (R, x) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(4.5, 6, 3.4, 1, 0, 0, 6.3); x.fill(); x.fillStyle = '#7a1414'; x.beginPath(); x.arc(4.5, 3.6, 2.8, 0, 6.3); x.fill(); x.fillStyle = '#c82a22'; x.beginPath(); x.arc(4.2, 3.2, 2.3, 0, 6.3); x.fill(); R(3, 2, 0.8, 0.8, 'rgba(255,255,255,0.75)'); R(4.4, 0.4, 0.5, 1.2, '#4a3018'); }, { solid: false, interact: 'forage', forage: 'apple', pickup: true });
const _ad2 = TM.addDecor;
TM.addDecor = function (type, tx, ty, extra) { if (type === 'berrybush') type = 'v_bush_' + FN[(tx * 7 + ty * 13) % FN.length]; return _ad2.call(this, type, tx, ty, extra); };
// roofs are drawn over everything, so a tree has to stand far enough from a house for its crown to clear the roof
const underRoof = G.underRoof = (m, cx, foot, w, h) => m.buildings.some((b) => cx - w / 2 < (b.x + b.w) * 16 && cx + w / 2 > b.x * 16 && foot - h < (b.y + b.h) * 16 && foot > b.y * 16 + 8);
const clearTrees = (m, ok) => {
  for (const d of m.decor.slice()) {
    const s = /^(oak|pine)\d/.test(d.type) && A.sprites[d.def.sprite]; if (!s || !underRoof(m, d.x, d.y, s.w, s.h)) continue;
    const type = d.type, tx = d.tx, ty = d.ty; m.removeDecorRuntime(d, false);
    find: for (let k = 1; k < 10; k++) for (let b = ty - k; b <= ty + k; b++) for (let a = tx - k; a <= tx + k; a++) {
      if (Math.max(Math.abs(a - tx), Math.abs(b - ty)) !== k || !m.inBounds(a, b) || !ok.has(m.get(a, b)) || m.isSolidTile(a, b) || m.decorsAt(a, b).length || m.buildingAtTile(a, b) || underRoof(m, a * 16 + 8, (b + 1) * 16, s.w, s.h)) continue;
      m.addDecor(type, a, b); m.treesMoved = (m.treesMoved || 0) + 1; break find;
    }
  }
};
// a save made before the trees moved: one must not come up through something you have built since
const _applyMods = TM.applyMods;
TM.applyMods = function (mods) {
  // ...and one you cut down before it moved stays cut down: the nearest of its kind goes in its place
  const was = new Set(this.decor.map((d) => this.decorKey(d))), felled = Object.keys(mods.removed || {}).filter((k) => /^(v_apple_tree|oak\d|pine\d)@/.test(k) && !was.has(k));
  const r = _applyMods.call(this, mods);
  for (const k of felled) {
    const [type, at] = k.split('@'), [tx, ty] = at.split(',').map(Number); let best = null, bd = 40;
    for (const d of this.decor) { if (d.type !== type) continue; const q = Math.hypot(d.tx - tx, d.ty - ty); if (q < bd) { bd = q; best = d; } }
    if (best) this.removeDecorRuntime(best);
  }
  for (const d of this.decor.slice()) {
    if (!/^(v_apple_tree|oak\d|pine\d)$/.test(d.type) || (mods.removed && mods.removed[this.decorKey(d)])) continue;
    const t = G.TILES[this.get(d.tx, d.ty)], built = !/grass/.test((t && t.name) || '') || this.decorsAt(d.tx, d.ty).some((q) => q !== d && !q.def.flat);
    if (built) this.removeDecorRuntime(d);
  }
  return r;
};
const grove = (id, n) => { const gen = G.MAPGEN[id]; if (!gen) return; G.MAPGEN[id] = () => {
  const m = gen(), r = new G.RNG('apples' + id), ok = new Set([G.T.grass, G.T.darkgrass]);
  clearTrees(m, ok);
  for (let i = 0, tries = 0; i < n && tries < n * 200; tries++) {
    const x = r.int(4, m.w - 6), y = r.int(4, m.h - 5);
    if (!ok.has(m.get(x, y)) || !ok.has(m.get(x + 1, y)) || m.isSolidTile(x, y) || m.decorsAt(x, y).length || m.decorsAt(x + 1, y).length || m.buildingAtTile(x, y) || underRoof(m, x * 16 + 8, (y + 1) * 16, 46, 58) || (m.exits || []).some((e) => Math.abs(e.x - x) < 5 && Math.abs(e.y - y) < 5)) continue;
    m.addDecor('v_apple_tree', x, y); i++;
    for (let k = 0; k < 3; k++) { const a = x + r.int(-2, 2), b = y + r.int(1, 2); if (ok.has(m.get(a, b)) && !m.isSolidTile(a, b) && !m.decorsAt(a, b).length) m.addDecor('v_windfall', a, b); }
  }
  m.computeSolids();
  return m;
}; };
grove('rural', 16); grove('farmland', 22); grove('suburbs', 8);
// ---------------------------------------------------------------- mushrooms and other pickings, in the same hand
// Low, small clusters on the leaf litter, in the dull colours they really have. A sprite is about 12 x 9 world pixels (a
// grown person is 26 tall), drawn at four times that, and shows the true shape of each species: a convex field cap with
// dark gills, a funnel with running ridges, the pale bell of a death cap with ring and sac, a faded fly agaric keeping a
// few warts, and the thin nippled cone of a liberty cap.
const SPECIES = {
  mushroom: { cap: ['#a4927a', '#7c6c58', '#5a4c3e'], gill: '#54403a', stem: ['#b8ae9a', '#8e8470'], shape: 'dome', n: 3, r: [1.5, 2.3], h: [2.2, 3.4] },
  chanterelle: { cap: ['#a88c4c', '#866c36', '#5e4a26'], gill: '#8a7040', stem: ['#a08648', '#7a6434'], shape: 'funnel', n: 4, r: [1.1, 1.8], h: [2.4, 3.4] },
  death_cap: { cap: ['#a8aa8a', '#868a6c', '#62664e'], gill: '#c2c0ae', stem: ['#c2c0b0', '#94927e'], shape: 'bell', n: 2, r: [1.8, 2.4], h: [3.4, 4.4], ring: true, sac: true },
  fly_agaric: { cap: ['#96503a', '#74382a', '#50261e'], gill: '#c0b8a4', stem: ['#beb6a2', '#90887a'], shape: 'flat', n: 2, r: [1.9, 2.5], h: [3, 4.2], warts: '#c4bca8', ring: true, sac: true },
  magic_mushroom: { cap: ['#806c4a', '#5e4e34', '#403422'], gill: '#3e3028', stem: ['#a89e88', '#7e7462'], shape: 'cone', n: 4, r: [0.7, 1.1], h: [3, 4.6] },
};
const oneShroom = (x, r, sp, cx, base) => {
  const cr = r.range(sp.r[0], sp.r[1]), h = r.range(sp.h[0], sp.h[1]), lean = r.range(-0.5, 0.5), top = base - h, tx = cx + lean;
  // the stem: thin, tapered, slightly bent, shaded down one side
  x.strokeStyle = sp.stem[1]; x.lineCap = 'round'; x.lineWidth = sp.shape === 'cone' ? 0.3 : 0.55;
  x.beginPath(); x.moveTo(cx, base); x.quadraticCurveTo(cx + lean * 0.2, base - h * 0.5, tx, top); x.stroke();
  x.strokeStyle = sp.stem[0]; x.lineWidth *= 0.55; x.beginPath(); x.moveTo(cx - 0.1, base); x.quadraticCurveTo(cx + lean * 0.2 - 0.1, base - h * 0.5, tx - 0.1, top); x.stroke();
  if (sp.sac) { x.fillStyle = sp.stem[1]; x.beginPath(); x.ellipse(cx, base - 0.2, 0.7, 0.45, 0, 0, 6.3); x.fill(); x.fillStyle = sp.stem[0]; x.beginPath(); x.ellipse(cx - 0.12, base - 0.3, 0.42, 0.22, 0, 0, 6.3); x.fill(); }
  if (sp.ring) { x.strokeStyle = sp.stem[0]; x.lineWidth = 0.28; x.beginPath(); x.ellipse(cx + lean * 0.7, top + h * 0.25, 0.6, 0.2, 0, 0.1, 3.05); x.stroke(); }
  const shade = (p) => { const g = x.createLinearGradient(tx - cr, top - cr, tx + cr, top + 0.6); g.addColorStop(0, sp.cap[0]); g.addColorStop(0.6, sp.cap[1]); g.addColorStop(1, sp.cap[2]); x.fillStyle = g; p(); x.fill(); };
  if (sp.shape === 'funnel') {   // a shallow wavy funnel: the rim above the stem, ridges running down
    shade(() => { x.beginPath(); x.moveTo(tx - cr, top - 0.5); x.quadraticCurveTo(tx - cr * 0.5, top + 0.2, tx - 0.3, top + 1.1); x.lineTo(tx + 0.3, top + 1.1); x.quadraticCurveTo(tx + cr * 0.5, top + 0.2, tx + cr, top - 0.6); x.quadraticCurveTo(tx, top - 1.1, tx - cr, top - 0.5); x.closePath(); });
    x.fillStyle = sp.cap[2]; x.beginPath(); x.ellipse(tx, top - 0.65, cr * 0.8, 0.32, 0, 0, 6.3); x.fill();
    x.strokeStyle = sp.gill; x.lineWidth = 0.1; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(tx + i * cr * 0.28, top - 0.3); x.lineTo(tx + i * 0.1, top + 1); x.stroke(); }
    return;
  }
  // the underside: a dark band of gills under the rim
  if (sp.shape !== 'cone') { x.fillStyle = sp.gill; x.beginPath(); x.ellipse(tx, top, cr * 0.92, 0.42, 0, 0, 6.3); x.fill(); }
  const rise = sp.shape === 'bell' ? cr * 0.95 : sp.shape === 'flat' ? cr * 0.55 : sp.shape === 'cone' ? cr * 2.4 : cr * 0.8;
  shade(() => { x.beginPath(); x.moveTo(tx - cr, top); if (sp.shape === 'cone') { x.quadraticCurveTo(tx - cr * 0.4, top - rise * 0.5, tx, top - rise); x.quadraticCurveTo(tx + cr * 0.4, top - rise * 0.5, tx + cr, top); } else x.bezierCurveTo(tx - cr, top - rise * 1.25, tx + cr, top - rise * 1.25, tx + cr, top); x.quadraticCurveTo(tx, top + 0.3, tx - cr, top); x.closePath(); });
  if (sp.shape === 'cone') { x.fillStyle = sp.cap[2]; x.fillRect(tx - 0.12, top - rise - 0.25, 0.24, 0.35); }   // the nipple
  if (sp.warts) { x.fillStyle = sp.warts; for (let i = 0; i < 4; i++) x.fillRect(tx + r.range(-cr * 0.7, cr * 0.7), top - r.range(0.1, rise * 0.72), 0.26, 0.2); }
  x.fillStyle = 'rgba(255,250,235,0.1)'; x.beginPath(); x.ellipse(tx - cr * 0.3, top - rise * 0.58, cr * 0.32, rise * 0.14, -0.3, 0, 6.3); x.fill();   // a dull sheen, not a highlight
};
const cluster = (k, sp) => {
  const K = 4, W = 12, H = 9, c = document.createElement('canvas'); c.width = W * K; c.height = H * K;
  const x = c.getContext('2d'), r = new G.RNG('shroom' + k); x.scale(K, K);
  // the dead leaves and needles they push up through
  for (let i = 0; i < 10; i++) { x.fillStyle = r.pick(['rgba(70,54,36,0.5)', 'rgba(58,46,30,0.45)', 'rgba(84,70,46,0.4)', 'rgba(40,34,24,0.4)']); x.beginPath(); x.ellipse(r.range(1.5, 10.5), r.range(7.4, 8.6), r.range(0.5, 1.2), r.range(0.15, 0.34), r.range(-0.6, 0.6), 0, 6.3); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(6, 8, 4.4, 0.7, 0, 0, 6.3); x.fill();
  const spots = []; for (let i = 0; i < sp.n; i++) spots.push([3.2 + i * (5.6 / Math.max(1, sp.n - 1)) + r.range(-0.6, 0.6), 8 - r.range(0, 0.9)]);
  spots.sort((a, b) => a[1] - b[1]);   // the ones further back first
  for (const [cx, base] of spots) oneShroom(x, r, sp, cx, base);
  return c;
};
const hdPick = () => { for (const k in SPECIES) { const s = A.sprites[k]; if (s) { s.vhd = cluster(k, SPECIES[k]); s.w = 12; s.h = 9; s.ax = 6; s.ay = 8; } } };
for (const k in G.DECOR) { const d = G.DECOR[k]; if (d.interact === 'forage' && d.flat) { d.flat = false; d.solid = false; d.pickup = true; } }
// fruit icons
const fruitIcons = () => { for (const [id, , col, dark] of FRUIT) { if (A.icons[id]) continue; const { c, x } = A.mk(16, 16); for (const [a, b] of [[5, 7], [9, 6], [7, 10], [11, 10], [4, 11]]) { x.fillStyle = dark; x.fillRect(a, b, 4, 4); x.fillStyle = col; x.fillRect(a, b, 3, 3); x.fillStyle = '#ffffff'; x.fillRect(a, b, 1, 1); } x.fillStyle = '#4a8a3a'; x.fillRect(8, 3, 3, 2); A.outline(c); A.icons[id] = c; } };
const _ini = A.init; A.init = function () { _ini.call(this); hdPick(); fruitIcons(); };
if (A.sprites && A.sprites.bush) { hdPick(); fruitIcons(); }
// apples at the greengrocers
for (const id in G.SHOPS) { const s = G.SHOPS[id]; if (s.stock && s.stock.some(([k]) => k === 'bread' || k === 'canned_beans' || k === 'milk') && !s.stock.some(([k]) => k === 'apple')) s.stock.push(['apple', 12]); }
const _wl = G.onWorldLoaded; G.onWorldLoaded = function (w) { if (_wl) _wl.apply(this, arguments); for (const id in w.shops) { const s = G.SHOPS[id], st = w.shops[id]; if (s && s.stock.some(([k]) => k === 'apple') && !st.stock.some(([k]) => k === 'apple')) st.stock.push(['apple', 12]); } };
})();
