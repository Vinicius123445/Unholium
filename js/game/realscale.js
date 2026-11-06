'use strict';
// Everything at the size of the buildings. A storey is 64 pixels, about 3.2 m, so the world stands at 20 pixels to the metre, and this
// file holds the one table that says how each kind of object sits in that world. A piece is drawn larger from its foot, by any path
// (furniture, venue pieces, plants, signs): height is free, and width stays inside the tiles it stands on unless it is an overhanging
// crown, so what you see is what you bump into. Also here: trees and bushes painted leaf by leaf, and the Pit's own pieces.
(() => {
const F = G.realFurn, A = G.assets, sh = A.shade, { make, wood, gloss, fill, line, grad, D } = F;
const FIXED = /^(doorway|stairs|elevator|cell_bars|shopsign|sign$|sign_|v_hdsign|v_sign|v_aframe|v_hours|v_tag|v_graffiti|v_ring|v_rope|v_stage|v_bowling|v_hstairs|car_|moto_|bike_|police_car|limo|morgue|security_door|vault_door|v_foundation|v_wall_|v_curtain)/;
const ROW = /^(counter|kcounter|kcounter_sink|v_bar|v_counter|v_bleacher|v_backbar|pew|cell_|fence|old_fence|v_stool_row)/;   // pieces laid edge to edge
const TABLE = [
  [/^v_apple_tree/, 1.35, 1.5], [/^oak/, 2.5, 2.8], [/^pine/, 2.3, 3.0],
  [/^v_windfall/, 0.5, 0.5], [/mushroom|^death_cap|^fly_agaric|^chanterelle|^v_(magic_mushroom|mushroom|death_cap|fly_agaric|chanterelle)/, 1.15, 1.15],
  [/^v_(shoes|bottles|butts|crumbs|newspapers|pizza_boxes|rubbish\d?|clothes_pile|book_stack|toys|radio|wet_bucket|laundry|boards|keg|box)$|^book_stack|^pillow_pile|^tray|^trash_bag|^pebbles/, 1.2, 1.2], [/^deadtree|^burnt_tree/, 2.2, 2.5], [/^bush|^berrybush|^v_bush_/, 1.7, 1.7], [/^rock$/, 1.5, 1.5], [/^boulder|^standing_stone/, 1.4, 1.4],
  [/^lamp$|^darklamp/, 1.5, 2.3], [/^power_pole/, 1.5, 2.6], [/^statue|^gold_statue|^hooded_statue|^obelisk/, 1.6, 1.7], [/^fountain/, 1.4, 1.4], [/^stump|^log$/, 1.4, 1.4], [/^tuft|^flowers|^v_weeds|^reeds/, 1.4, 1.5],
  [/^bed$|^bed_red|^bed_green|^v_bed_/, 1.4, 1.3], [/^bed_double/, 1.1, 1.35], [/^rug$|^v_rug/, 1.4, 1.4], [/^v_w_(clock|lamp|frame|notice)$/, 1, 1], [/^v_w_extinguisher$/, 0.72, 0.72], [/^v_w_|^mirror|^v_mirror|^v_painting|^v_poster/, 1.4, 1.4],
  [/^v_bleacher/, 1, 1.3], [/^v_bettingboard/, 1.18, 1.5], [/^v_heavybag/, 1.15, 1.3], [/^v_oildrum_fire/, 1.1, 1.25], [/^v_worn_couch/, 1, 1.3], [/^hydrant|^mailbox|^trashcan|^v_trash_can/, 1.3, 1.3],
];
const scales = new Map();
const of = (type) => {
  let k = scales.get(type); if (k) return k;
  const def = G.DECOR[type], s = def && A.sprites[def.sprite]; k = [1, 1];
  if (s && !FIXED.test(type)) {
    const row = TABLE.find((r) => r[0].test(type)), room = (def.fw || 1) * 16 / s.w;
    if (row) k = [row[1], row[2]];
    else if (def.flat) k = [1, 1];
    else if (ROW.test(type)) k = [1, 1.5];
    else { const roomy = ((def.fw || 1) * 16 + 4) / s.w; void room; k = [Math.max(1, Math.min(1.7, roomy)), Math.max(1.25, Math.min(1.7, 42 / s.h))]; }   // (a tall piece stops short of the room behind the wall)
  }
  scales.set(type, k); return k;
};
G.decorScale = of;
// how high above the skirting a thing hangs (the wall is 48 tall, 2.4 m): the extinguisher at hand height, the rest at eye level, the lamp above it
G.hungLift = (o) => (o.type === 'v_w_extinguisher' ? 12 : o.type === 'v_w_lamp' ? 30 : o.type === 'v_w_clock' ? 27 : 22);
// a wide bed: this one piece stands on two tiles (js/game/worldscale.js footBeds), and remembers it in a saved world
const TM = G.TileMap.prototype, _add = TM.addDecor;
TM.addDecor = function (type, tx, ty, extra) { const d = _add.call(this, type, tx, ty, extra); if (extra && extra.wide) { d.def = Object.assign({}, d.def, { fw: 2 }); d.x = tx * 16 + 16; } return d; };
const _dd = G.drawDecor, FRAME = 1 / 60;
G.drawDecor = function (ctx, o, s, scene) {
  let k = of(o.type), r; if (o.wide) k = [1.75, k[1]];
  // pictures, clocks and notices hang at eye level on the wall, not at the skirting
  if (o.hung === undefined) { const mp = scene && scene.map; o.hung = !!(mp && mp.get && /^v_w_|^v_painting|^v_poster|^mirror|^v_mirror/.test(o.type) && !o.wallOf && !/crack|mold/.test(o.type) && (G.TILES[mp.get(o.tx, o.ty)] || {}).wall); }
  if (o.hung) { ctx.save(); ctx.translate(0, -G.hungLift(o)); const q = drawn(this, ctx, o, s, scene, k, arguments); ctx.restore(); return q; }
  return drawn(this, ctx, o, s, scene, k, arguments);
};
function drawn(me, ctx, o, s, scene, k, args) {
  let r;
  if (s && (k[0] !== 1 || k[1] !== 1)) { ctx.save(); ctx.translate(o.x, o.y); ctx.scale(k[0], k[1]); ctx.translate(-o.x, -o.y); r = pit(ctx, o, s, scene, _dd, me, args); ctx.restore(); return r; }
  return pit(ctx, o, s, scene, _dd, me, args);
}
function pit(ctx, o, s, scene, dd, me, args) {
  if (o.type === 'v_heavybag' && s) {   // hangs from its chain: a damped pendulum, pushed by whoever punches it
    o.sw = o.sw || 0; o.swv = o.swv || 0; o.swv += (-o.sw * 34 - o.swv * 1.6) * FRAME; o.sw += o.swv * FRAME;
    const py = o.y - s.ay; ctx.save(); ctx.translate(o.x, py); ctx.rotate(o.sw); ctx.translate(-o.x, -py); const r = dd.apply(me, args); ctx.restore(); return r;
  }
  const r = dd.apply(me, args);
  if (o.type === 'v_oildrum_fire' && s) drumFire(ctx, o, s);
  if (o.type === 'v_bettingboard' && s) boardText(ctx, o, s, scene);
  return r;
}
// the fire in a drum: tongues that climb, thin and break, a hot core, sparks going up
function drumFire(ctx, o, s) {
  const t = G.loop.time + (o.tx || 0) * 0.71, cx = o.x, by = o.y - s.ay + 7;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const ph = t * (2.6 + (i % 4) * 0.5) + i * 1.9, life = (ph % 1 + 1) % 1, x0 = cx - 5.4 + i * 1.35 + Math.sin(ph * 1.7) * 0.8, h = (7 + (4 - Math.abs(i - 4)) * 1.5 + Math.sin(ph * 2.1 + i) * 2.2) * (1 - life * 0.3), sway = Math.sin(t * 3.1 + i) * 1.8;
    const g = ctx.createLinearGradient(0, by, 0, by - h); g.addColorStop(0, 'rgba(255,190,70,0.8)'); g.addColorStop(0.45, 'rgba(255,104,24,0.62)'); g.addColorStop(1, 'rgba(180,30,8,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - 1.7, by); ctx.quadraticCurveTo(x0 + sway - 1, by - h * 0.55, x0 + sway * 1.5, by - h); ctx.quadraticCurveTo(x0 + sway + 1.2, by - h * 0.5, x0 + 1.7, by); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,236,170,0.74)'; ctx.beginPath(); ctx.ellipse(cx, by - 1, 4.6, 1.8, 0, 0, 6.3); ctx.fill();
  for (let i = 0; i < 5; i++) { const q = ((t * (0.8 + i * 0.13) + i * 0.37) % 1), ex = cx + Math.sin(i * 2.4 + q * 5) * (2 + q * 3), ey = by - 4 - q * 19; ctx.fillStyle = `rgba(255,${150 + i * 14},60,${0.9 * (1 - q)})`; ctx.fillRect(ex, ey, 0.6, 0.6); }
  ctx.restore();
}
// tonight's card on the betting board, in letters you can read
const board = { t: -99, c: null };
function boardText(ctx, o, s, scene) {
  const w = scene && scene.world, FC = G.fightClub; if (!w || !FC) return;
  if (!board.c || G.loop.time - board.t > 12) {
    board.t = G.loop.time; const c = board.c || (board.c = document.createElement('canvas')); c.width = 320; c.height = 224; const x = c.getContext('2d'); x.clearRect(0, 0, 320, 224);
    x.font = 'bold 26px sans-serif'; x.fillStyle = '#f0c040'; x.textAlign = 'center'; x.fillText(G.i18n.t('TONIGHT').toUpperCase(), 160, 36);
    x.font = 'bold 21px monospace'; x.textAlign = 'left'; let y = 74;
    try { for (const id of Object.keys(G.FIGHTERS).slice(0, 6)) { const f = G.FIGHTERS[id], n = (f.name || G.NPCS[id] && G.NPCS[id].name || id).toUpperCase().slice(0, 13), r = FC.rival(w, id), ov = r ? FC.odds(w, id, r) : 2; x.fillStyle = '#f2eee0'; x.fillText(n, 14, y); x.fillStyle = '#f0c040'; x.textAlign = 'right'; x.fillText(`${ov.toFixed(1)}x`, 308, y); x.textAlign = 'left'; y += 28; } } catch (e) { /* the card is empty before the first fight */ }
  }
  const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(board.c, o.x - s.ax + 1, o.y - s.ay + 1, 38, 26.6); ctx.imageSmoothingEnabled = was;
}
// a punch moves the bag
const M = G.melee, _hits = M.hits;
M.hits = function (a, scene, sw, prev, now) {
  const r = _hits.call(this, a, scene, sw, prev, now);
  if (a.kind === 'player' && !sw.bagged && scene.map) {
    const fx = Math.cos(sw.base), fy = Math.sin(sw.base);
    for (const d of scene.map.decor) { if (d.type !== 'v_heavybag') continue; const dx = d.x - a.x, dy = (d.y - 6) - a.y; if (Math.hypot(dx, dy) < 30 && dx * fx + dy * fy > -4) { sw.bagged = true; d.swv = (d.swv || 0) + (dx >= 0 ? 2.6 : -2.6) * (sw.hook ? 1.4 : 1); G.audio.play('punch', { x: d.x, y: d.y, vol: 0.8 }); break; } }
  }
  return r;
};

// ---------------------------------------------------------------- leaf by leaf
const P = 8, paints = {};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w * P; c.height = h * P; const x = c.getContext('2d'); x.scale(P, P); return { c, x }; };
const leaves = (x, r, cx, cy, rx, ry, n, cols, size) => {   // a clump: dark inside, sunlit up and to the left
  for (let i = 0; i < n; i++) {
    const a = r.next() * 6.283, q = Math.sqrt(r.next()), px = cx + Math.cos(a) * q * rx, py = cy + Math.sin(a) * q * ry, lit = ((cx - px) / rx * 0.5 + (cy - py) / ry * 0.7 + 1) / 2, k = Math.min(cols.length - 1, Math.max(0, Math.floor((lit + (r.next() - 0.5) * 0.5) * cols.length)));
    x.fillStyle = cols[k]; x.save(); x.translate(px, py); x.rotate(r.next() * 3.14); x.beginPath(); x.ellipse(0, 0, size * (0.8 + r.next() * 0.6), size * 0.42, 0, 0, 6.3); x.fill(); x.restore();
  }
};
const bark = (x, r, cx, base, top, w0, w1, col) => {
  x.beginPath(); x.moveTo(cx - w0 / 2 - 1.2, base); x.quadraticCurveTo(cx - w0 / 2, base - 2, cx - w1 / 2, top); x.lineTo(cx + w1 / 2, top); x.quadraticCurveTo(cx + w0 / 2, base - 2, cx + w0 / 2 + 1.2, base); x.closePath();
  x.fillStyle = (() => { const g = x.createLinearGradient(cx - w0 / 2, 0, cx + w0 / 2, 0); g.addColorStop(0, sh(col, 1.2)); g.addColorStop(0.5, col); g.addColorStop(1, sh(col, 0.5)); return g; })(); x.fill();
  for (let i = 0; i < 30; i++) { const px = cx + (r.next() - 0.5) * w0, py = top + r.next() * (base - top); x.strokeStyle = r.next() < 0.5 ? 'rgba(20,10,4,0.5)' : 'rgba(200,170,130,0.16)'; x.lineWidth = 0.14; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r.next() - 0.5) * 0.5, py + 1 + r.next() * 2.4); x.stroke(); }
};
const OAK = [['#10301a', '#1c4a24', '#2e6a30', '#4a8a3c', '#74ae50'], ['#14351a', '#245226', '#3a7430', '#5e963e', '#8cba58'], ['#1e3a14', '#34541c', '#527026', '#7c9234', '#a8b652']];
const oak = (v) => () => {
  const { c, x } = canvas(32, 38), r = new G.RNG('oak' + v), cols = OAK[v];
  x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(16, 36, 9, 1.7, 0, 0, 6.3); x.fill();
  bark(x, r, 16, 37, 18, 4.4, 2.2, '#5a4230');
  for (const [a, b, e, f] of [[16, 24, 9, 17], [16, 22, 23, 16], [16, 19, 13, 12]]) { x.strokeStyle = '#4a3424'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(a, b); x.lineTo(e, f); x.stroke(); }
  const clumps = 15; for (let i = 0; i < clumps; i++) { const a = r.next() * 6.283, q = Math.sqrt(r.next()), cx = 16 + Math.cos(a) * q * 10.5, cy = 13 + Math.sin(a) * q * 8.5 + (i / clumps) * 1.6; leaves(x, r, cx, cy, 5.2 + r.next() * 1.4, 4.2 + r.next(), 420, cols.slice(0, 3), 0.42); }
  for (let i = 0; i < 18; i++) { const cx = 7 + r.next() * 18, cy = 3 + r.next() * 15; leaves(x, r, cx, cy, 3.2, 2.5, 150, cols, 0.34); }
  return c;
};
const pine = (v) => () => {
  const { c, x } = canvas(22, 40), r = new G.RNG('pine' + v), cols = v ? ['#0c2a22', '#143a2c', '#1e4e38', '#2e6a4a'] : ['#0e2c1c', '#163e26', '#225432', '#387044'];
  x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(11, 38, 6.4, 1.3, 0, 0, 6.3); x.fill();
  bark(x, r, 11, 39, 6, 2.6, 0.8, '#4e3a2a');
  const tiers = 13; for (let t = tiers; t >= 0; t--) { const k = t / tiers, y = 4 + k * 28, w = 1.2 + k * 7.6; for (let i = 0; i < 240; i++) { const s = (r.next() * 2 - 1), px = 11 + s * w, py = y + Math.abs(s) * (2.6 + k * 1.8) + (r.next() - 0.5) * 1.6, lit = ((-s + 1) / 2) * 0.8 + r.next() * 0.3; x.strokeStyle = cols[Math.min(cols.length - 1, Math.floor(lit * cols.length))]; x.lineWidth = 0.17; x.beginPath(); x.moveTo(px, py); x.lineTo(px + s * 1.1 + (r.next() - 0.5) * 0.4, py + 1 + r.next() * 0.9); x.stroke(); } }
  return c;
};
const bushArt = (seed, cols, dots) => () => {
  const { c, x } = canvas(16, 13), r = new G.RNG(seed);
  x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(8, 12, 7, 1.1, 0, 0, 6.3); x.fill();
  for (const [a, b, e, f] of [[4.6, 8.4, 4.2, 3.6], [11.4, 8.4, 4.2, 3.6], [8, 5.6, 5.4, 4.4], [8, 9, 6.4, 3]]) { leaves(x, r, a, b, e, f, 560, cols.slice(0, 3), 0.3); leaves(x, r, a - 0.6, b - 0.8, e * 0.7, f * 0.7, 240, cols, 0.26); }
  if (dots) for (let i = 0; i < 16; i++) { x.fillStyle = dots; x.beginPath(); x.arc(2.4 + r.next() * 11.4, 2.4 + r.next() * 8, 0.34, 0, 6.3); x.fill(); }
  return c;
};
const tuftArt = (flowers) => () => { const { c, x } = canvas(16, 16), r = new G.RNG(flowers ? 'fl' : 'tu'); for (let i = 0; i < 90; i++) { const a = 3 + r.next() * 10, l = 2.4 + r.next() * 4; x.strokeStyle = ['#2e6a30', '#4a8a3c', '#6aa04a', '#86b85a'][i % 4]; x.lineWidth = 0.18; x.beginPath(); x.moveTo(a, 11); x.quadraticCurveTo(a + (r.next() - 0.5) * 1.5, 11 - l * 0.6, a + (r.next() - 0.5) * 3, 11 - l); x.stroke(); } if (flowers) for (let i = 0; i < 9; i++) { const a = 3 + r.next() * 10, b = 5 + r.next() * 4, col = ['#e8e0f0', '#e8b040', '#c8508a', '#f4f0e8'][i % 4]; for (let p = 0; p < 5; p++) { x.fillStyle = col; x.beginPath(); x.ellipse(a + Math.cos(p * 1.26) * 0.42, b + Math.sin(p * 1.26) * 0.42, 0.34, 0.24, p * 1.26, 0, 6.3); x.fill(); } x.fillStyle = '#e8c030'; x.beginPath(); x.arc(a, b, 0.22, 0, 6.3); x.fill(); } return c; };
const deadArt = (w, h, col) => () => { const { c, x } = canvas(w, h), r = new G.RNG('dead' + w); x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(w / 2, h - 1.4, w / 3, 1.2, 0, 0, 6.3); x.fill(); bark(x, r, w / 2, h - 1, h * 0.42, 3.6, 1.6, col); const limb = (a, b, ang, l, t) => { if (l < 1.6) return; const e = a + Math.cos(ang) * l, f = b + Math.sin(ang) * l; x.strokeStyle = sh(col, 0.9 + r.next() * 0.3); x.lineWidth = t; x.lineCap = 'round'; x.beginPath(); x.moveTo(a, b); x.lineTo(e, f); x.stroke(); limb(e, f, ang - 0.5 + r.next() * 0.3, l * 0.72, t * 0.7); limb(e, f, ang + 0.5 - r.next() * 0.3, l * 0.68, t * 0.7); }; limb(w / 2, h * 0.5, -1.57, h * 0.2, 1.5); limb(w / 2, h * 0.6, -2.3, h * 0.2, 1); limb(w / 2, h * 0.56, -0.8, h * 0.2, 1); return c; };
const PAINT = { tuft: tuftArt(false), flowers: tuftArt(true), deadtree: deadArt(24, 32, '#4a3a2c'), burnt_tree: deadArt(18, 26, '#1e1a18'), oak0: oak(0), oak1: oak(1), oak2: oak(2), pine0: pine(0), pine1: pine(1), bush: bushArt('bush', ['#10301a', '#1e4c26', '#336e34', '#5a9a4a', '#88bc66']), berrybush: bushArt('berry', ['#12321c', '#22502a', '#3a7238', '#60a04c', '#8cc06a'], '#b02840') };
const _flora = G.floraHD.get;
G.floraHD.get = (n) => { if (!PAINT[n]) return _flora(n); return paints[n] || (paints[n] = PAINT[n]()); };

// ---------------------------------------------------------------- the Pit
const _more = F.more;
F.more = () => {
  _more();
  // fruit the size fruit is, on plants the size plants are
  make('v_apple_tree', 46, 58, (x, W, H) => {
    const r = new G.RNG('apple'), cols = ['#14351a', '#245226', '#3a7430', '#5e963e', '#8cba58'];
    x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(W / 2, H - 2, 15, 2.4, 0, 0, 6.3); x.fill(); bark(x, r, W / 2, H - 1, H * 0.5, 6, 3.2, '#5a4230');
    for (const [e, f] of [[W / 2 - 11, 24], [W / 2 + 11, 24], [W / 2, 18]]) { x.strokeStyle = '#4a3424'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(W / 2, H * 0.58); x.lineTo(e, f); x.stroke(); }
    for (let i = 0; i < 18; i++) { const a = r.next() * 6.283, q = Math.sqrt(r.next()); leaves(x, r, W / 2 + Math.cos(a) * q * 15, 21 + Math.sin(a) * q * 12, 7, 5.6, 300, cols.slice(0, 3), 0.5); }
    for (let i = 0; i < 20; i++) leaves(x, r, 8 + r.next() * 30, 7 + r.next() * 22, 4, 3.2, 110, cols, 0.42);
    for (let i = 0; i < 26; i++) { const a = r.next() * 6.283, q = Math.sqrt(r.next()), px = W / 2 + Math.cos(a) * q * 18, py = 21 + Math.sin(a) * q * 15; x.fillStyle = i % 5 ? '#b82420' : '#d8a030'; x.beginPath(); x.arc(px, py, 0.8, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.arc(px - 0.25, py - 0.25, 0.2, 0, 6.3); x.fill(); }
  });
  for (const [n, col] of [['blueberry', '#3a58a8'], ['raspberry', '#c8305a'], ['blackberry', '#241a34'], ['strawberry', '#c8302a']]) make('v_bush_' + n, 20, 22, (x, W, H) => {
    const r = new G.RNG('b' + n), cols = ['#10301a', '#1e4c26', '#336e34', '#5a9a4a', '#88bc66'];
    x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(W / 2, H - 2, 9, 1.6, 0, 0, 6.3); x.fill();
    for (const [a, b, e, f] of [[6, H - 7, 5, 5], [14, H - 7, 5, 5], [10, H - 11, 6.4, 6], [10, H - 5, 8, 3.6]]) { leaves(x, r, a, b, e, f, 340, cols.slice(0, 3), 0.34); leaves(x, r, a - 0.6, b - 0.8, e * 0.7, f * 0.7, 150, cols, 0.28); }
    for (let i = 0; i < 26; i++) { const a = 2.6 + r.next() * 14.8, b = H - 17 + r.next() * 13; x.fillStyle = col; x.beginPath(); x.arc(a, b, 0.42, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(a - 0.2, b - 0.24, 0.16, 0.16); }
  });
  const rust = (x, W, H, r) => { for (let i = 0; i < 26; i++) { const px = r.next() * W, py = r.next() * H, q = 0.5 + r.next() * 2.2; x.fillStyle = `rgba(${90 + r.next() * 60 | 0},${40 + r.next() * 30 | 0},16,${0.2 + r.next() * 0.4})`; x.beginPath(); x.ellipse(px, py, q, q * 0.7, 0, 0, 6.3); x.fill(); } };
  const drum = (x, W, H, col) => {
    const r = new G.RNG('drum' + col); x.fillStyle = grad(x, 1, 0, W - 1, 0, [sh(col, 0.46), sh(col, 1.05), sh(col, 1.2), col, sh(col, 0.4)]); x.fillRect(1.4, 4, W - 2.8, H - 5.2); x.beginPath(); x.ellipse(W / 2, H - 1.4, W / 2 - 1.4, 1.3, 0, 0, 6.3); x.fill();
    x.save(); x.beginPath(); x.rect(1.4, 4, W - 2.8, H - 4); x.clip(); rust(x, W, H, r); x.restore();
    for (const y of [H * 0.38, H * 0.66]) { x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(1.4, y, W - 2.8, 0.7); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(1.4, y - 0.5, W - 2.8, 0.5); }
    x.fillStyle = '#17120e'; x.beginPath(); x.ellipse(W / 2, 4, W / 2 - 1.4, 2.3, 0, 0, 6.3); x.fill(); x.strokeStyle = sh(col, 0.8); x.lineWidth = 0.7; x.stroke();
  };
  make('v_oil_drum', 14, 20, (x, W, H) => drum(x, W, H, '#3e5a4a'));
  make('v_oildrum_fire', 16, 24, (x, W, H) => { drum(x, W, H, '#6a4a30'); x.fillStyle = '#170a06'; for (const [a, b] of [[4, 11], [8, 12], [12, 11], [5.6, 16], [10.4, 16]]) { x.beginPath(); x.ellipse(a, b, 0.9, 1.1, 0, 0, 6.3); x.fill(); } x.fillStyle = 'rgba(255,110,30,0.75)'; for (const [a, b] of [[4, 11], [8, 12], [12, 11], [5.6, 16], [10.4, 16]]) { x.beginPath(); x.ellipse(a, b, 0.55, 0.7, 0, 0, 6.3); x.fill(); } x.fillStyle = '#ff7a24'; x.beginPath(); x.ellipse(W / 2, 4, W / 2 - 2.4, 1.5, 0, 0, 6.3); x.fill(); });
  make('v_heavybag', 12, 34, (x, W, H) => {
    steelChain(x, W); const r = new G.RNG('bag');
    x.fillStyle = grad(x, 1, 0, W - 1, 0, ['#3e1a14', '#8a2c20', '#a83a2a', '#6e2218', '#2e120c']); x.fillRect(1.2, 8, W - 2.4, H - 10); x.beginPath(); x.ellipse(W / 2, 8, W / 2 - 1.2, 1.4, 0, 0, 6.3); x.fillStyle = '#7a281e'; x.fill(); x.beginPath(); x.ellipse(W / 2, H - 2, W / 2 - 1.2, 1.5, 0, 0, 6.3); x.fillStyle = '#3e1a14'; x.fill();
    for (const y of [11, 19, 27]) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1.2, y, W - 2.4, 0.5); x.fillStyle = 'rgba(255,220,190,0.12)'; x.fillRect(1.2, y + 0.5, W - 2.4, 0.3); }
    x.fillStyle = 'rgba(220,210,190,0.32)'; x.fillRect(3, 15, 6, 8); x.fillStyle = 'rgba(30,14,10,0.3)'; for (let i = 0; i < 18; i++) x.fillRect(1.5 + r.next() * 9, 9 + r.next() * 22, 0.7, 0.4);
  });
  make('v_worn_couch', 32, 18, (x, W, H) => {
    const r = new G.RNG('wc'), c = '#6a5838'; x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, H - 2, W - 2, 2);
    fill(x, 2.6, 0.6, W - 5.2, 8.6, 0.4, grad(x, 0, 0, 0, 9, [sh(c, 1.08), sh(c, 0.82)])); fill(x, 0.4, 2.6, 3.6, H - 4.4, 0.4, sh(c, 0.76)); fill(x, W - 4, 2.6, 3.6, H - 4.4, 0.4, sh(c, 0.72));
    for (let i = 0; i < 3; i++) { const a = 4.2 + i * 7.9; fill(x, a, 8, 7.6, 6.6, 0.4, grad(x, a, 8, a + 7, 15, [sh(c, 1.26), sh(c, 0.96)])); }
    fill(x, 4.2, 14.4, W - 8.4, 2, 0.2, sh(c, 0.6)); x.fillStyle = '#e4d8bc'; x.fillRect(19, 10, 3.6, 2.2); x.fillStyle = '#3a2c1c'; x.fillRect(8, 11, 4, 1.4); line(x, 'rgba(30,22,12,0.7)', 0.2, 13, 9, 15, 12, 14, 13.4);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(40,28,14,0.14)'; x.fillRect(r.next() * W, r.next() * H, 0.8, 0.5); } x.fillStyle = '#20140c'; x.fillRect(2.6, H - 2, 1.6, 2); x.fillRect(W - 4.2, H - 2, 1.6, 2);
  });
  make('v_bettingboard', 40, 28, (x, W, H) => { wood(x, 0, 0, W, H, '#3a281a', 6); fill(x, 1.2, 1.2, W - 2.4, H - 2.4, 0.2, grad(x, 0, 0, 0, H, ['#1c2a22', '#141e1a'])); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(1.2, 1.2, W - 2.4, 1); x.fillStyle = 'rgba(232,228,208,0.18)'; for (let i = 0; i < 5; i++) x.fillRect(3 + i * 7, 22 + (i % 2), 4, 0.3); });
  make('v_bleacher', 32, 22, (x, W, H) => { for (const [y, h, c] of [[0, 7, '#6a4a30'], [7, 7, '#7c5838'], [14, 8, '#8c6640']]) { wood(x, 0, y, W, h - 1.6, c, y + 2); gloss(x, 0, y, W, h - 1.6); x.fillStyle = '#26282c'; x.fillRect(0, y + h - 1.6, W, 1.6); } steelPost(x, W, H); });
  function steelChain(x, W) { for (let y = 0; y < 8; y += 1.5) { x.strokeStyle = y % 3 ? '#8e949c' : '#50565e'; x.lineWidth = 0.4; x.beginPath(); x.ellipse(W / 2, y + 0.7, 0.5, 0.8, 0, 0, 6.3); x.stroke(); } }
  function steelPost(x, W, H) { x.fillStyle = grad(x, 0, 0, 2, 0, ['#70747a', '#2e3034']); x.fillRect(1, 0, 1.4, H); x.fillRect(W - 2.4, 0, 1.4, H); }
};
G.DECOR.v_bleacher.solid = true; G.DECOR.v_worn_couch.solid = true; G.DECOR.v_heavybag.solid = true;
})();
