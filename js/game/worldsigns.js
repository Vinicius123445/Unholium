'use strict';
// Every door in the city says what is behind it. Existing shop boards are repainted as real objects on real posts, every
// venue gets a sign of its own material, an hours plate beside the door, and a board or posters where a business would
// put one. Inside, every building gets the small things that show someone uses it. Bikers look like bikers.
(() => {
const A = G.assets, S = G.signArt, V = G.vk, I = () => G.i18n, hash = S.hash;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
// what each kind of place hangs over its door
const LOOK = {
  strip: { mat: 'neon', icon: 'heart', sub: 'LIVE SHOWS  BAR' }, club: { mat: 'neon', icon: 'note', sub: 'DANCE  LATE' }, punk: { mat: 'steel', icon: 'mask', age: 1, sub: 'LOUD BANDS  CHEAP BEER' }, live: { mat: 'neon', icon: 'note', sub: 'LIVE MUSIC' }, dive: { mat: 'wood', icon: 'glass', age: 0.9, sub: 'BEER  WHISKEY' }, karaoke: { mat: 'neon', icon: 'note', sub: 'SING' }, rooftop: { mat: 'acrylic', icon: 'star', sub: 'ROOF BAR' },
  pool: { mat: 'steel', icon: 'coin', sub: 'BILLIARDS  BAR' }, den: { mat: 'steel', age: 1, sub: 'MEMBERS' }, casino: { mat: 'neon', icon: 'coin', sub: 'SLOTS  TABLES' }, bowling: { mat: 'neon', icon: 'star', sub: 'BOWLING  12 LANES' }, arcade: { mat: 'led', icon: 'star', sub: 'INSERT COIN' }, internet: { mat: 'acrylic', sub: 'INTERNET  COFFEE' },
  cinema: { mat: 'led', icon: 'film', sub: 'NOW SHOWING' }, theater: { mat: 'neon', icon: 'mask', sub: 'TONIGHT AT 19:30' }, blackbox: { mat: 'poster', icon: 'mask', age: 0.7, sub: 'THEATER' }, cafe: { mat: 'wood', icon: 'glass', age: 0.2, sub: 'COFFEE  PASTRY' }, italian: { mat: 'wood', icon: 'fork', age: 0.3, sub: 'CUCINA' }, japanese: { mat: 'wood', icon: 'fork', age: 0.2, sub: 'SUSHI' }, brazilian: { mat: 'acrylic', icon: 'fork', sub: 'COMIDA CASEIRA' }, diner: { mat: 'neon', icon: 'fork', sub: 'OPEN LATE' },
  gym: { mat: 'steel', icon: 'fist', sub: 'WEIGHTS  BAGS' }, museum: { mat: 'concrete', sub: 'OPEN DAILY' }, gallery: { mat: 'acrylic', sub: 'CONTEMPORARY ART' }, library: { mat: 'concrete', icon: 'book', sub: 'OPEN TO ALL' }, barber: { mat: 'wood', icon: 'scissors', sub: 'CUTS  SHAVES' }, tattoo: { mat: 'neon', icon: 'pin', sub: 'INK  PIERCING' }, store: { mat: 'wood', icon: 'book', age: 0.4 }, office: { mat: 'acrylic', icon: 'bank' },
};
const STORE = { records: 'note', music: 'note', vintage: 'scissors', books: 'book' };
const bright = (m) => m === 'neon' || m === 'led';
V.wallSign = (v) => {
  const k = LOOK[v.kind] || { mat: 'steel' }, id = 'hdsign_' + v.id, [fg, bg] = v.sign || ['#f0f0f0', '#202024'], w = Math.max(46, Math.min(88, Math.round(v.name.length * 6.4 + 26))), h = 20;
  V.add(id, w, h, (R, x) => { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, 2, w, h - 1); S.board(x, w - 1, h - 1, { text: v.name.toUpperCase(), sub: k.sub, mat: k.mat, fg, bg, icon: v.stock ? STORE[v.stock] || k.icon : k.icon, age: k.age != null ? k.age : 0.4 }); }, { solid: false, glow: bright(k.mat) ? `rgba(${rgb(fg)},0.45)` : null, light: bright(k.mat) ? { r: 76, color: rgb(fg) } : undefined });
  const [a, b] = v.hours, pad = (n) => String(n % 24).padStart(2, '0'), hid = 'hours_' + v.id;
  V.add(hid, 36, 9, (R, x) => S.hours(x, 36, 9, `${pad(a)}:00-${pad(b)}:00`), { solid: false });
  return 'v_' + id;
};
for (const v of Object.values(G.VENUES)) v.signDecor = V.wallSign(v);
const BOARDS = { strip: ['LIVE SHOWS', '#2a0a18', '#ff5aa8', 'heart'], club: ['GUEST DJ TONIGHT', '#0a1420', '#40e8ff', 'note'], dive: ['HAPPY HOUR', '#20282a', '#e8e4d0', 'glass'], punk: ['BANDS TONIGHT', '#141418', '#e83030', 'mask'], live: ['ON STAGE TONIGHT', '#201408', '#ffd040', 'note'], cafe: ['FRESH COFFEE', '#20282a', '#e8e4d0', 'glass'], italian: ['TODAY: RAGU', '#20282a', '#e8e4d0', 'fork'], brazilian: ['HOJE: FEIJOADA', '#20282a', '#e8e4d0', 'fork'], diner: ['BURGERS', '#20282a', '#e8e4d0', 'fork'], karaoke: ['SING TONIGHT', '#102010', '#80ff80', 'note'], pool: ['TABLES FREE', '#0a1a10', '#40d080', 'coin'], gym: ['DAY PASS', '#1a1a1e', '#f0c040', 'fist'] };
for (const k in BOARDS) { const [t, bg, fg, ic] = BOARDS[k]; V.add('aframe_' + k, 18, 22, (R, x) => { R(1, 20, 2, 2, '#3a2a1a'); R(15, 20, 2, 2, '#3a2a1a'); R(1, 1, 16, 19, '#6a4a2c'); x.save(); x.translate(2, 2); x.scale(14 / 40, 17 / 48); S.board(x, 40, 48, { text: t, mat: 'poster', fg, bg, icon: undefined, age: 0.3 }); x.restore(); }, { solid: true }); }
V.add('poster_wall', 28, 16, (R, x) => S.board(x, 28, 16, { text: 'TONIGHT', mat: 'poster', fg: '#f8e8a0', bg: '#3a2a6a', age: 0.7 }), { solid: false });
V.add('sign_bank', 70, 18, (R, x) => S.board(x, 70, 18, { text: 'CITY SAVINGS BANK', sub: 'TRUST SINCE 1921', mat: 'acrylic', fg: '#f0e8c0', bg: '#1e3a6a', icon: 'bank', age: 0.15 }), { solid: false, light: { r: 56, color: '200,220,255' } });
V.add('hours_bank', 28, 9, (R, x) => S.hours(x, 28, 9, '09:00-17:00'), { solid: false });
V.add('sign_atm', 22, 10, (R, x) => S.board(x, 22, 10, { text: 'ATM', mat: 'acrylic', fg: '#ffffff', bg: '#1e6a3a', age: 0 }), { solid: false });
V.add('sign_hospital', 70, 18, (R, x) => S.board(x, 70, 18, { text: 'HOSPITAL', sub: 'EMERGENCY', mat: 'acrylic', fg: '#c82a2a', bg: '#f0f0ec', icon: 'cross', age: 0.2 }), { solid: false, light: { r: 56, color: '240,240,255' } });
V.add('sign_cannery', 60, 16, (R, x) => S.board(x, 60, 16, { text: 'HARBOR CANNERY', sub: 'CLOSED', mat: 'steel', fg: '#d8c8a0', bg: '#4a5a4a', age: 1 }), { solid: false });
V.add('sign_pit_down', 34, 14, (R, x) => S.board(x, 34, 14, { text: 'THE PIT', sub: 'DOWNSTAIRS', mat: 'neon', fg: '#ff5a3a', bg: '#140808', icon: 'fist' }), { solid: false, glow: 'rgba(255,90,50,0.4)', light: { r: 60, color: '255,110,70' } });
// Signs hang on the front wall. The wall row sorts with everyone on the street (people walk in front of it); only the
// slice that rises above the wall top is drawn after the roofs, and it fades with the roof when you go inside.
const hang = (m, d, b) => { d.wallOf = b; (m.roofSigns = m.roofSigns || []).push(d); return d; };
const onWall = (m, type, b, offset) => { const d = m.addDecor(type, Math.min(m.w - 1, Math.max(0, b.doorX + offset)), b.doorY); d.y = b.doorY * 16 + 13; if (d.light) { d.light.x = d.x; d.light.y = d.y; } return hang(m, d, b); };
// a big sign reaches up over the eaves: with the roof lifted, there is only the wall to hang it on, so it comes down to fit
const wallFit = G.wallFit = (b, s) => { const f = Math.min(1, 14 / s.h); return f + (1 - f) * Math.min(1, b.roofAlpha || 0); };
const fitted = (d, b, s, fn) => { const sc = d.sc; d.sc = (sc || 1) * wallFit(b, s); try { return fn(); } finally { d.sc = sc; } };
const TM0 = G.TileMap.prototype, _dr = TM0.drawRoofs;
TM0.drawRoofs = function (ctx, view) {
  const r = _dr.apply(this, arguments), sc = G.scenes && G.scenes.stack.find((q) => q instanceof G.GameScene);
  for (const d of this.roofSigns || []) {
    const b = d.wallOf;
    if (G.realFront.topOf(this, b || {}) != null) continue;   // (a wall with height holds the whole sign, in depth order)
    if (d.removed || !b || b.destroyed || !(b.roofAlpha > 0.01) || d.x < view.x - 60 || d.x > view.x + view.w + 60 || d.y < view.y - 30 || d.y > view.y + view.h + 30) continue;
    const s = A.sprites[d.def.sprite]; if (!s) continue;
    ctx.save(); ctx.globalAlpha = b.roofAlpha; ctx.beginPath(); ctx.rect(d.x - 80, b.doorY * 16 - 40, 160, 40); ctx.clip();
    d._slice = true; try { fitted(d, b, s, () => G.drawDecor(ctx, d, s, sc)); } finally { d._slice = false; ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  return r;
};
const _ddW = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const b = o.wallOf;
  if (!b || o._slice) return _ddW.apply(this, arguments);
  if (b.destroyed) return undefined;   // (it burned with the wall)
  const args = arguments, map = scene && scene.map;
  if (map && map.floorsOf && (b.roofAlpha || 0) > 0.5 && G.realFront.topOf(map, b) != null) { ctx.save(); ctx.translate(0, -34); try { return _ddW.apply(this, args); } finally { ctx.restore(); } }
  ctx.save(); ctx.beginPath(); ctx.rect(o.x - 80, b.doorY * 16, 160, 40); ctx.clip();
  try { return fitted(o, b, s, () => _ddW.apply(this, args)); } finally { ctx.restore(); }
};
// Laying out a front: everything a building hangs goes left or right of the door, never over it, never over each other.
// The big sign takes the wider side, small plates sit next to the door, and what is too wide is scaled down (never below
// 70%) or, if it is only a poster, left off.
const SHOPISH = /Store|Mart|Bodega|Liquor|Pharmacy|Clothes|Barber|Pawn|Gas|Diner|Jewel|Gun|Hardware|Casino|Bar|Motel/;
const GAP = 2;
G.signLayout = (m) => {
  const byB = new Map();
  for (const d of m.roofSigns || []) { if (!d.wallOf) continue; if (!byB.has(d.wallOf)) byB.set(d.wallOf, []); byB.get(d.wallOf).push(d); }
  for (const [b, list] of byB) {
    const open = SHOPISH.test(b.name || '') ? 14 : 0;   // (the OPEN plate in the first window: js/game/streetlook.js)
    const sides = [{ lo: b.x * 16 + 3, hi: b.doorX * 16 - 2, items: [] }, { lo: (b.doorX + 1) * 16 + 2 + open, hi: (b.x + b.w) * 16 - 3, items: [] }];
    const wide = (d) => { const s = A.sprites[d.def.sprite]; return s ? s.w : G.vk.widthOf(d.type); };
    list.sort((p, q) => wide(q) - wide(p));
    for (const d of list) {
      const w = wide(d), used = (sd) => sd.items.reduce((n, e) => n + e.w + GAP, 0), room = (sd) => sd.hi - sd.lo - used(sd);
      const sd = room(sides[0]) >= room(sides[1]) ? sides[0] : sides[1], k = Math.min(1, room(sd) / w);
      if (k < 0.7 && w <= 16) { d.removed = true; continue; }
      d.sc = k < 1 ? Math.max(0.7, k) : undefined;
      sd.items.push({ d, w: w * (d.sc || 1), big: w >= 30 });
    }
    sides.forEach((sd, i) => {
      sd.items.sort((p, q) => (i ? p.big - q.big : q.big - p.big));   // the small ones next to the door
      const tot = sd.items.reduce((n, e) => n + e.w, 0) + GAP * Math.max(0, sd.items.length - 1);
      let at = i ? sd.lo + (sd.items.some((e) => e.big) ? Math.max(0, (sd.hi - sd.lo - tot) / 2) : 0) : sd.hi - tot - (sd.items.some((e) => e.big) ? Math.max(0, (sd.hi - sd.lo - tot) / 2) : 0);
      for (const e of sd.items) { const d = e.d; d.x = Math.round(at + e.w / 2); d.y = b.doorY * 16 + 13; if (d.light) { d.light.x = d.x; d.light.y = d.y; } at += e.w + GAP; }
    });
  }
  m.roofSigns = (m.roofSigns || []).filter((d) => !d.removed);
  m.decor = m.decor.filter((d) => !d.removed);
};
// the hours beside the door, a board on the sidewalk, posters
const dressVenue = (m, b, v) => {
  const dr = m.addDecor('v_hours_' + v.id, Math.min(b.x + b.w - 1, b.doorX + 2), b.doorY); dr.y = b.doorY * 16 + 13; hang(m, dr, b);
  const sign = m.decor.find((d) => d.type === v.signDecor && d.ty === b.doorY); if (sign) hang(m, sign, b);
  const k = BOARDS[v.kind] ? 'v_aframe_' + v.kind : null, y = b.doorY + 1;
  if (k) for (const dx of [-2, 2, -3, 3]) { const x = b.doorX + dx; if (m.inBounds(x, y) && !m.isSolidTile(x, y) && !m.decorsAt(x, y).length && m.get(x, y) !== G.T.door && !Object.values(m.points).some((p) => p && p.x === x && p.y === y)) { m.addDecor(k, x, y); break; } }
};
const _build = G.venueSys.build;
G.venueSys.build = function (m, v, r) { const b = _build.call(this, m, v, r); if (!v.outdoor) dressVenue(m, b, v); return b; };
const _city = G.MAPGEN.city;
G.MAPGEN.city = () => { const m = _city(), b = m.building('c_bank'), h = m.building('c_hospital'); if (b) { onWall(m, 'v_sign_bank', b, -5); onWall(m, 'v_sign_atm', b, 4); onWall(m, 'v_hours_bank', b, 2); } if (h) onWall(m, 'v_sign_hospital', h, -3); return m; };
const _ind = G.MAPGEN.industrial;
G.MAPGEN.industrial = () => { const m = _ind(), b = m.building('i_cannery'); if (b) { onWall(m, 'v_sign_cannery', b, -5); onWall(m, 'v_sign_pit_down', b, 4); onWall(m, 'v_poster_wall', b, 2); onWall(m, 'v_poster_wall', b, -2); } return m; };
// ---------------------------------------------------------------- the old shop boards, repainted
const repaint = () => {
  G.SHOP_SIGNS.forEach(([, s], i) => {
    if (!s.text) return; const sp = A.sprites['shopsign_' + i]; if (!sp) return;
    const w = sp.w || sp.img.width, h = sp.h || sp.img.height, K = 3, c = document.createElement('canvas'); c.width = w * K; c.height = h * K; const x = c.getContext('2d'); x.scale(K, K);
    const mat = s.neon ? 'neon' : /CHURCH|SCHOOL|CITY HALL/.test(s.text) ? 'concrete' : hash(s.text) % 3 === 0 ? 'wood' : 'steel', bh = Math.round(h * 0.68);
    x.fillStyle = mat === 'wood' ? '#5a3e26' : '#50565e'; x.fillRect(3, bh - 3, 2.4, h - bh + 3); x.fillRect(w - 5.4, bh - 3, 2.4, h - bh + 3); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(3, bh - 3, 0.7, h - bh + 3); x.fillRect(w - 5.4, bh - 3, 0.7, h - bh + 3);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, h - 1.4, w - 2, 1.4);
    S.board(x, w, bh, { text: I().t(s.text), mat, fg: s.fg || '#f0f0f0', bg: s.bg || '#202024', age: 0.6 });
    sp.vhd = c; sp.w = w; sp.h = h;
  });
};
const _ini = A.init; A.init = function () { _ini.call(this); repaint(); };
if (A.sprites && A.sprites.bush) repaint();
G.events.on('languageChanged', () => { repaint(); for (const k of Object.keys(A.sprites)) if (/^v_(hdsign_|aframe_|sign_|poster_)/.test(k)) delete A.sprites[k]; V.paintAll(); });
// ---------------------------------------------------------------- the small things that show a room is used
const wall = { clock: [12, 12, (R, x) => { x.fillStyle = '#2a2a30'; x.beginPath(); x.arc(6, 6, 5.6, 0, 6.3); x.fill(); x.fillStyle = '#f0ece0'; x.beginPath(); x.arc(6, 6, 4.6, 0, 6.3); x.fill(); R(5.7, 2.6, 0.6, 3.6, '#222222'); R(5.7, 5.8, 2.8, 0.6, '#222222'); }], lamp: [10, 12, (R, x) => { R(4, 0, 2, 3, '#50565e'); x.fillStyle = '#d8c8a0'; x.beginPath(); x.moveTo(2, 9); x.lineTo(8, 9); x.lineTo(6.5, 3); x.lineTo(3.5, 3); x.fill(); R(2, 9, 6, 1, '#f8e8a0'); }], frame: [14, 12, (R) => { R(0, 0, 14, 12, '#6a4428'); R(1.4, 1.4, 11.2, 9.2, '#b8c8a8'); R(1.4, 6, 11.2, 4.6, '#6a8a5a'); R(9, 2.4, 2, 2, '#f0d060'); }], notice: [14, 16, (R) => { R(0, 0, 14, 16, '#a88858'); R(1.5, 2, 5, 6, '#f0ece0'); R(7.4, 1.5, 5, 7, '#e8e0a8'); R(2.5, 9.4, 8, 5, '#f0ece0'); R(3.6, 1.5, 0.8, 0.8, '#c02020'); R(9.6, 1, 0.8, 0.8, '#2040c0'); }], extinguisher: [8, 16, (R) => { R(2, 3, 4, 12, '#c02020'); R(2, 3, 1.2, 12, '#e04040'); R(3, 0.8, 2, 2.4, '#2a2a30'); R(5, 1, 3, 1, '#2a2a30'); }] };
for (const k in wall) { const [w, h, fn] = wall[k]; V.add('w_' + k, w, h, fn, { solid: false, light: k === 'lamp' ? { r: 42, color: '255,225,170' } : undefined }); }
const KIT = { house: ['frame', 'clock', 'lamp'], shop: ['notice', 'clock', 'extinguisher'], office: ['notice', 'clock', 'extinguisher', 'frame'], inn: ['frame', 'lamp', 'clock'], venue: ['lamp', 'frame', 'notice', 'extinguisher'], hospital: ['notice', 'clock', 'extinguisher'], bank: ['clock', 'frame', 'extinguisher'], mansion: ['frame', 'lamp'], barracks: ['notice', 'clock', 'extinguisher'], temple: ['lamp'] };
const dress = (m) => {
  if (m.id === 'jail') return;
  for (const b of m.buildings) {
    const kit = KIT[b.kind]; if (!kit || b.w < 5 || b.dressed) continue; b.dressed = true;
    const y = b.y, seed = hash(b.id); let n = 0, step = 3 + (seed % 2);
    for (let x = b.x + 1 + (seed % 3); x < b.x + b.w - 1 && n < Math.min(4, kit.length + 1); x += step) {
      if (m.decorsAt(x, y + 1).some((d) => d.def.solid) || !G.TILES[m.get(x, y)].wall) continue;   // (nothing hangs behind a shelf)
      const d = m.addDecor('v_w_' + kit[(seed + n) % kit.length], x, y); d.y = (y + 1) * 16 + 1; if (d.light) { d.light.y = d.y - 6; } n++;
    }
  }
};
for (const id of Object.keys(G.MAPGEN)) { const gen = G.MAPGEN[id]; G.MAPGEN[id] = () => { const m = gen(); if (!/^wilds|^hf_/.test(id)) dress(m); G.signLayout(m); return m; }; }
// ---------------------------------------------------------------- bikers
const BIKERS = [['fc_c5', 'jacket'], ['fc_c11', 'vest'], ['fc_b0', 'vest'], ['fc_b1', 'jacket'], ['fc_b2', 'vest'], ['fc_b3', 'jacket'], ['fc_b4', 'vest'], ['fc_b5', 'jacket']];
const hairs = ['#2a1e16', '#6a6a70', '#14100e', '#8a5a2a', '#c8c8c8', '#3a2a1e'];
const bikerLook = (id, top, i) => ({ body: i === 3 ? 'f' : 'm', top, shirt: top === 'vest' ? '#3a4a5e' : '#1a1a1e', shirt2: top === 'vest' ? '#23232a' : '#2a2a30', bottom: 'pants', pants: ['#2e3a4e', '#23232a', '#3a4658'][i % 3], shoes: '#1a1612', hair: hairs[i % hairs.length], hairStyle: [2, 0, 5, 9, 8, 2, 0, 5][i], facial: i === 3 ? 0 : [3, 1, 2, 3, 1, 3, 2, 1][i], hat: i % 3 === 0 ? 'bandana' : undefined, hatColor: ['#1a1a1e', '#a02020'][i % 2], glasses: i % 2 === 0 ? 'sun' : undefined, build: i % 4 === 0 ? 2 : 1, patch: '#c8b070', gloves: i % 2 === 1, chain: i % 3 !== 1, tattoo: i % 3 !== 2 });
BIKERS.forEach(([id, top], i) => {
  if (!G.NPCS[id]) G.NPCS[id] = { id, name: 'Biker', map: 'fightclub', faction: 'criminals', hp: 50, combat: 'fight', gold: 60, home: null, relations: {}, ageGroup: 'adult', job: 'I ride. The rest is nobody\'s business.', schedule: [{ from: 0, to: 24, at: 'fc_s' + (i % 14), act: i % 2 ? 'idle' : 'wander' }] };
  G.NPCS[id].look = G.look(id, bikerLook(id, top, i)); G.NPCS[id].name = 'Biker';
});
// their machines stand outside the cannery, long forks and high bars
const VM = G.vehicles && G.vehicles.MODELS;
if (VM) { VM.moto_chopper = { body: '#141418', moto: true, len: 34, wid: 11, max: 230, acc: 150, hp: 60, value: 500, chopper: true }; if (G.DECOR.moto_black) G.DECOR.moto_chopper = Object.assign({}, G.DECOR.moto_black, { sprite: 'moto_black' }); }
const _ind2 = G.MAPGEN.industrial;
G.MAPGEN.industrial = () => { const m = _ind2(), b = m.building('i_cannery'); if (b && G.DECOR.moto_chopper) for (const dx of [-4, -6, 5, 7]) { const x = b.doorX + dx, y = b.doorY + 2; if (m.inBounds(x, y) && !m.isSolidTile(x, y) && !m.decorsAt(x, y).length) m.addDecor('moto_chopper', x, y); } return m; };
const VD = G.Vehicle && G.Vehicle.prototype;
if (VD) { const _vd = VD.draw; VD.draw = function (ctx) { const r = _vd.apply(this, arguments); if (this.model === 'moto_chopper') { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle || 0); ctx.fillStyle = '#c8ccd2'; ctx.fillRect(10, -7, 1, 14); ctx.fillRect(8, -7, 3, 1); ctx.fillRect(8, 6, 3, 1); ctx.fillStyle = '#a02020'; ctx.fillRect(-2, -2.4, 7, 4.8); ctx.fillStyle = '#e8e4d0'; ctx.fillRect(0.4, -0.8, 2, 1.6); ctx.restore(); } return r; }; }
})();
