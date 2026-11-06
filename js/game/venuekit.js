'use strict';
// Everything the new places are furnished with: bars, stages, poles, cinema seats, arcade cabinets, lanes, tables,
// gym machines, galleries, shops, building sites. Each piece is painted once at three times its size and drawn from
// that, so the detail survives the game's zoom; the plain sprite is kept for anything that draws sprites directly.
//   G.vk.add(id, w, h, paint, def)    paint(R, x) with R(x, y, w, h, color) in sprite pixels (fractions are fine)
//   def.fw tiles wide, solid, interact, flat (drawn on the ground), light
// Interactions live with their systems (venues.js, minigames.js, shows.js...), keyed on def.interact.
(() => {
const A = G.assets, K = 6, list = [];
// a painted surface, not a flat colour: light from above, the foot in shade, fine wear. Words and marks on walls keep their own look.
const PLAIN = /^(tag|graffiti|hdsign|sign_|stain|shopsign|neon|w_crack|w_mold|butts|crumbs|ring_floor|stage|bowling_lane|hours|rope)/;
const finish = (id, x, w, h) => {
  if (PLAIN.test(id)) return;
  x.save(); x.globalCompositeOperation = 'source-atop'; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,248,232,0.14)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  let s = (id.length * 7919 + id.charCodeAt(0)) % 233280; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < w * h / 7; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,245,230,0.05)' : 'rgba(16,10,6,0.07)'; x.fillRect(r() * w, r() * h, 0.2 + r() * 0.5, 0.2); }
  for (let i = 0; i < w * h / 40; i++) { const a = r() * w, b = r() * h, l = 0.6 + r() * 2, t = r() * 6.3; x.strokeStyle = r() < 0.5 ? 'rgba(255,245,230,0.08)' : 'rgba(20,12,6,0.12)'; x.lineWidth = 0.12; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(t) * l, b + Math.sin(t) * l); x.stroke(); }
  x.restore();
};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d') }; };
const paintAll = () => {
  for (const [id, w, h, paint] of list) {
    if (A.sprites['v_' + id]) continue;
    const big = mk(w * K, h * K), x = big.x; x.scale(K, K);
    paint((a, b, c, d, col) => { x.fillStyle = col; x.fillRect(a, b, c, d); }, x);
    finish(id, x, w, h);
    const small = mk(w, h); small.x.imageSmoothingEnabled = true; small.x.drawImage(big.c, 0, 0, w, h);
    A.sprites['v_' + id] = { img: small.c, vhd: big.c, ax: Math.floor(w / 2), ay: h - 1, w, h };
  }
};
const V = G.vk = {
  add(id, w, h, paint, def = {}) { list.push([id, w, h, paint]); G.DECOR['v_' + id] = Object.assign({ sprite: 'v_' + id, solid: true }, def); },
  widthOf(type) { const e = list.find((q) => 'v_' + q[0] === type); return e ? e[1] : 16; },
  heightOf(type) { const e = list.find((q) => 'v_' + q[0] === type); return e ? e[2] : 16; },
  paintAll,
};
const _init = A.init; A.init = function () { _init.call(this); paintAll(); };
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  if (s.vhd) { const k = o.sc || 1; ctx.drawImage(s.vhd, Math.round(o.x - s.ax * k), Math.round(o.y - s.ay * k), s.w * k, s.h * k); if (o.def.glow) V.glow(ctx, o, scene); return; }
  return _dd.apply(this, arguments);
};
V.glow = (ctx, o) => { const a = 0.5 + 0.3 * Math.sin(G.loop.time * 3 + o.tx); ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(o.x, o.y - 8, 2, o.x, o.y - 8, 34); g.addColorStop(0, o.def.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(o.x - 34, o.y - 42, 68, 68); ctx.restore(); };

const add = V.add, wood = '#6a4428', woodL = '#8a6038', woodD = '#46301c', steel = '#8e949c', steelD = '#50565e', black = '#17171b';
// ---------------------------------------------------------------- bars and clubs
add('bar', 32, 20, (R) => { R(0, 2, 32, 4, woodL); R(0, 5, 32, 1, woodD); R(0, 6, 32, 14, wood); for (let i = 2; i < 32; i += 6) R(i, 8, 4, 10, woodD); R(0, 19, 32, 1, black); R(4, 0, 2, 3, '#7a9a5a'); R(11, 1, 3, 2, '#d8d0b8'); R(22, 0, 2, 3, '#a86a3a'); }, { fw: 2, interact: 'v_bar' });
add('backbar', 32, 28, (R) => { R(0, 0, 32, 28, woodD); R(1, 2, 30, 1, woodL); R(1, 12, 30, 1, woodL); R(1, 22, 30, 2, woodL); const c = ['#7a9a5a', '#a86a3a', '#c8c0a0', '#8a2a2a', '#3a5a8a', '#b8a040']; for (let i = 0; i < 9; i++) { R(2 + i * 3.2, 5, 2, 7, c[i % 6]); R(2.5 + i * 3.2, 3.4, 1, 2, c[i % 6]); R(2 + i * 3.2, 15, 2, 7, c[(i + 2) % 6]); R(2.5 + i * 3.2, 13.4, 1, 2, c[(i + 2) % 6]); } }, { fw: 2 });
add('stool', 10, 14, (R) => { R(1, 0, 8, 3, '#8a2a2a'); R(1, 3, 8, 1, '#5a1a1a'); R(4, 4, 2, 8, steel); R(2, 12, 6, 2, steelD); }, { solid: false, seat: true });
add('booth', 32, 22, (R) => { R(0, 0, 32, 10, '#6a1e2e'); R(0, 9, 32, 2, '#8a2a3e'); for (let i = 3; i < 32; i += 6) R(i, 1, 1, 8, '#4a1420'); R(2, 11, 28, 9, '#4a1420'); R(2, 20, 28, 2, black); }, { fw: 2, solid: false, seat: true });
add('sofa', 32, 18, (R) => { R(0, 0, 32, 9, '#2a2a4a'); R(0, 8, 32, 8, '#3a3a64'); R(0, 2, 3, 14, '#222244'); R(29, 2, 3, 14, '#222244'); R(2, 16, 28, 2, black); }, { fw: 2, solid: false, seat: true });
add('lowtable', 16, 10, (R) => { R(1, 1, 14, 5, '#1e1e24'); R(1, 1, 14, 1, '#4a4a58'); R(3, 6, 2, 4, steelD); R(11, 6, 2, 4, steelD); R(6, 0, 2, 2, '#c8c0a0'); });
add('stage', 16, 16, (R) => { R(0, 0, 16, 16, '#3a2418'); for (let y = 0; y < 16; y += 4) { R(0, y, 16, 3.6, y % 8 ? '#4a2e1e' : '#523422'); } R(0, 0, 16, 0.5, '#6a4a30'); }, { flat: true, solid: false });
add('stage_edge', 16, 8, (R) => { R(0, 0, 16, 2, '#6a4a30'); R(0, 2, 16, 6, '#22160e'); for (let i = 1; i < 16; i += 5) R(i, 4, 2, 1.5, '#f0d060'); }, { flat: true, solid: false });
add('pole', 8, 44, (R, x) => { const g = x.createLinearGradient(2, 0, 6, 0); g.addColorStop(0, '#6a6e76'); g.addColorStop(0.5, '#f0f2f6'); g.addColorStop(1, '#5a5e66'); x.fillStyle = g; x.fillRect(3, 0, 2, 41); R(0, 41, 8, 3, '#8e949c'); R(0, 41, 8, 1, '#c8ccd2'); }, { solid: true });
add('neon_heart', 22, 16, (R, x) => { x.strokeStyle = '#ff4aa8'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(11, 14); x.bezierCurveTo(-2, 5, 5, -2, 11, 4); x.bezierCurveTo(17, -2, 24, 5, 11, 14); x.stroke(); }, { solid: false, glow: 'rgba(255,60,160,0.7)', light: { r: 46, color: '255,60,160' } });
add('neon_bar', 26, 10, (R) => { R(1, 3, 24, 1, '#40e8ff'); R(1, 6, 24, 1, '#ffe040'); R(1, 3, 1, 4, '#40e8ff'); R(24, 3, 1, 4, '#ffe040'); }, { solid: false, glow: 'rgba(60,220,255,0.6)', light: { r: 44, color: '60,200,255' } });
add('stagelight', 12, 12, (R) => { R(0, 0, 12, 2, steelD); R(3, 2, 6, 6, black); R(4, 7, 4, 2, '#f8e8a0'); }, { solid: false, light: { r: 60, color: '255,230,170' } });
add('djbooth', 32, 22, (R) => { R(0, 8, 32, 14, '#1e1e26'); R(0, 8, 32, 1, '#5a5a70'); R(3, 2, 26, 7, '#2a2a34'); R(5, 3, 8, 5, '#0e0e12'); R(19, 3, 8, 5, '#0e0e12'); R(8, 4, 2, 2, '#e0e0e0'); R(22, 4, 2, 2, '#e0e0e0'); R(14, 4, 4, 4, '#3ae080'); for (let i = 2; i < 30; i += 7) R(i, 12, 4, 8, '#14141a'); }, { fw: 2 });
add('speaker', 14, 26, (R, x) => { R(0, 0, 14, 26, '#1a1a20'); R(0, 0, 14, 1, '#44444e'); for (const [cy, r] of [[8, 4.5], [18, 5.5]]) { x.fillStyle = '#34343c'; x.beginPath(); x.arc(7, cy, r, 0, 6.3); x.fill(); x.fillStyle = '#0c0c10'; x.beginPath(); x.arc(7, cy, r / 2, 0, 6.3); x.fill(); } });
add('jukebox', 16, 28, (R, x) => { x.fillStyle = '#a03030'; x.beginPath(); x.arc(8, 10, 8, Math.PI, 0); x.fill(); R(0, 10, 16, 18, '#a03030'); x.fillStyle = '#f8d870'; x.beginPath(); x.arc(8, 10, 6, Math.PI, 0); x.fill(); R(2, 10, 12, 8, '#3a2a18'); for (let i = 0; i < 4; i++) R(3, 11 + i * 1.7, 10, 1, '#e8d8a8'); R(4, 21, 8, 4, '#2a2a30'); }, { interact: 'v_jukebox', light: { r: 34, color: '255,200,90' } });
add('mic', 8, 26, (R) => { R(3.5, 3, 1, 21, steel); R(2, 0, 4, 4, '#2a2a30'); R(1, 24, 6, 2, steelD); }, { interact: 'v_mic' });
add('drums', 30, 22, (R, x) => { const dr = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, r, r * 0.45, 0, 0, 6.3); x.fill(); x.fillStyle = '#e8e4da'; x.beginPath(); x.ellipse(cx, cy - 1.5, r - 0.6, r * 0.38, 0, 0, 6.3); x.fill(); }; R(9, 11, 12, 10, '#8a2030'); dr(15, 11, 6, '#8a2030'); dr(7, 12, 4, '#8a2030'); dr(23, 12, 4, '#8a2030'); R(1.5, 3, 1, 18, steel); x.fillStyle = '#d8b850'; x.beginPath(); x.ellipse(2, 3, 5, 1.5, 0, 0, 6.3); x.fill(); R(28, 5, 1, 16, steel); x.beginPath(); x.ellipse(28, 5, 4.5, 1.3, 0, 0, 6.3); x.fill(); }, { fw: 2, interact: 'v_instrument', inst: 'drums' });
add('piano', 32, 24, (R) => { R(0, 0, 32, 16, '#16141a'); R(1, 1, 30, 1, '#3a3844'); R(0, 14, 32, 3, '#26242c'); for (let i = 1; i < 31; i += 2) R(i, 15, 1.6, 2, '#e8e8e0'); for (let i = 2; i < 30; i += 4) R(i, 15, 1, 1.2, '#101014'); R(2, 17, 28, 7, '#1e1c24'); }, { fw: 2, interact: 'v_instrument', inst: 'piano' });
add('guitaramp', 16, 18, (R) => { R(0, 3, 16, 15, '#22221e'); R(2, 5, 12, 11, '#3c3a30'); for (let y = 6; y < 16; y += 2) R(2, y, 12, 0.6, '#26261e'); R(2, 0, 2, 12, '#a85a20'); R(0.6, 0, 5, 3, '#a85a20'); }, { interact: 'v_instrument', inst: 'guitar' });
// ---------------------------------------------------------------- theaters and cinemas
add('seat', 14, 16, (R) => { R(1, 0, 12, 9, '#8a1e28'); R(1, 8, 12, 5, '#a02632'); R(0, 2, 2, 11, '#4a1016'); R(12, 2, 2, 11, '#4a1016'); R(2, 13, 10, 3, black); }, { solid: false, seat: true });
add('curtain', 16, 40, (R) => { for (let i = 0; i < 16; i += 3) { R(i, 0, 1.5, 40, '#8a1420'); R(i + 1.5, 0, 1.5, 40, '#b02030'); } R(0, 0, 16, 3, '#d8b050'); }, { solid: false });
add('screen', 64, 40, (R) => { R(0, 0, 64, 36, '#101014'); R(2, 2, 60, 32, '#d8d8d4'); R(0, 36, 64, 4, '#1e1e24'); }, { fw: 4, solid: true });
add('projector', 18, 16, (R) => { R(2, 5, 12, 8, '#3a3a44'); R(14, 7, 4, 4, black); R(0, 12, 16, 2, steelD); R(3, 0, 5, 5, '#2a2a30'); R(9, 0, 5, 5, '#2a2a30'); R(6.5, 1.8, 1, 1, steel); });
add('ticket_booth', 32, 30, (R) => { R(0, 10, 32, 20, '#7a1e2a'); R(0, 6, 32, 4, '#d8b050'); R(4, 12, 24, 10, '#a8c8d8'); R(4, 22, 24, 2, wood); R(0, 0, 32, 6, '#5a1420'); }, { fw: 2, interact: 'v_ticket' });
add('ticket_machine', 16, 28, (R) => { R(1, 0, 14, 28, '#2a4a7a'); R(3, 3, 10, 9, '#a8e0f0'); R(4, 4, 8, 1, '#2a4a7a'); R(4, 6, 6, 1, '#2a4a7a'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R(4 + c * 3, 14 + r * 2.4, 2, 1.6, '#d8d8d8'); R(4, 23, 8, 2, black); }, { interact: 'v_ticket' });
add('poster', 16, 24, (R) => { R(0, 0, 16, 24, '#2a2a34'); R(1, 1, 14, 22, '#c84a2a'); R(3, 3, 10, 12, '#f0d080'); R(5, 5, 6, 8, '#3a2a4a'); R(3, 17, 10, 1, '#fff'); R(3, 19, 7, 1, '#fff'); }, { solid: false, interact: 'v_ticket' });
add('popcorn', 26, 30, (R) => { R(0, 14, 26, 16, '#a02030'); R(1, 2, 24, 14, '#d8e8f0'); R(1, 2, 24, 1, '#e8c040'); for (let i = 0; i < 40; i++) R(2 + (i * 7) % 21, 10 + (i * 5) % 6, 1.6, 1.4, '#f8e8a0'); R(0, 0, 26, 2, '#c02838'); }, { fw: 2, interact: 'v_menu' });
add('prop_tree', 18, 34, (R, x) => { R(8, 18, 3, 16, '#6a4a2a'); x.fillStyle = '#4a7a3a'; x.beginPath(); x.moveTo(9, 0); x.lineTo(18, 20); x.lineTo(0, 20); x.fill(); }, { interact: 'v_prop' });
add('prop_throne', 18, 26, (R) => { R(1, 0, 16, 26, '#c8a040'); R(3, 2, 12, 15, '#7a1e2e'); R(3, 17, 12, 4, '#a02838'); R(1, 21, 2, 5, '#8a6a20'); R(15, 21, 2, 5, '#8a6a20'); }, { interact: 'v_prop' });
add('costume_rack', 28, 24, (R) => { R(1, 1, 26, 1.4, steel); R(1, 1, 1.4, 22, steel); R(25.6, 1, 1.4, 22, steel); const c = ['#a02838', '#3a5a8a', '#d8b050', '#3a7a4a']; for (let i = 0; i < 8; i++) R(3 + i * 3, 2, 2.6, 15, c[i % 4]); }, { fw: 2, interact: 'v_prop' });
add('makeup_table', 28, 26, (R) => { R(0, 14, 28, 12, wood); R(0, 14, 28, 2, woodL); R(4, 0, 20, 14, '#c8d8e0'); for (let i = 3; i < 27; i += 4) R(i, 0, 2, 2, '#f8e880'); for (let y = 2; y < 14; y += 4) { R(2, y, 2, 2, '#f8e880'); R(24, y, 2, 2, '#f8e880'); } }, { fw: 2, light: { r: 30, color: '255,240,180' } });
// ---------------------------------------------------------------- games
add('pool_table', 48, 30, (R) => { R(0, 0, 48, 26, woodD); R(3, 3, 42, 20, '#1e7a4a'); R(4, 4, 40, 18, '#268a56'); for (const [a, b] of [[3, 3], [23, 3], [43, 3], [3, 21], [23, 21], [43, 21]]) R(a, b, 2.4, 2.4, black); R(14, 12, 2, 2, '#f8f8f0'); R(30, 11, 2, 2, '#c02020'); R(32, 13, 2, 2, '#e8c020'); R(30, 14, 2, 2, '#2040a0'); R(4, 26, 3, 4, woodD); R(41, 26, 3, 4, woodD); }, { fw: 3, interact: 'v_pool' });
add('bowling_lane', 16, 16, (R) => { R(0, 0, 16, 16, '#c8a060'); for (let i = 0; i < 16; i += 2) R(i, 0, 0.5, 16, '#a8804a'); R(0, 0, 1.5, 16, '#2a2a30'); R(14.5, 0, 1.5, 16, '#2a2a30'); }, { flat: true, solid: false });
add('bowling_pins', 16, 22, (R) => { R(0, 16, 16, 6, '#c8a060'); for (const [a, b] of [[7, 2], [5, 5], [9, 5], [3, 8], [7, 8], [11, 8], [1, 11], [5, 11], [9, 11], [13, 11]]) { R(a, b, 2, 4, '#f4f4ee'); R(a, b + 1, 2, 0.6, '#c02020'); } R(0, 0, 16, 2, '#22222a'); });
add('bowling_rack', 26, 16, (R, x) => { R(0, 6, 26, 2, steel); R(1, 8, 2, 8, steelD); R(23, 8, 2, 8, steelD); const c = ['#2040a0', '#a02020', '#20a060', '#d8a020']; for (let i = 0; i < 4; i++) { x.fillStyle = c[i]; x.beginPath(); x.arc(5 + i * 5.4, 3.4, 2.6, 0, 6.3); x.fill(); } }, { fw: 2, interact: 'v_bowling' });
const cabinet = (a, b) => (R) => { R(0, 2, 16, 26, a); R(0, 0, 16, 5, b); R(2, 1, 12, 3, '#f8f0a0'); R(2, 6, 12, 10, '#101018'); R(3, 7, 10, 8, b); R(5, 9, 3, 2, '#f8f8f0'); R(10, 12, 2, 2, '#ff5050'); R(1, 17, 14, 4, '#2a2a34'); R(4, 18, 2, 2, '#e04040'); R(9, 18, 2, 2, '#40c0e0'); R(12, 18, 2, 2, '#e8e040'); R(1, 22, 14, 6, b); };
add('arcade1', 16, 28, cabinet('#2a3a8a', '#40e0a0'), { interact: 'v_arcade', game: 'runner', light: { r: 28, color: '90,220,255' } });
add('arcade2', 16, 28, cabinet('#8a2a5a', '#f0a030'), { interact: 'v_arcade', game: 'swarm', light: { r: 28, color: '255,120,200' } });
add('arcade3', 16, 28, cabinet('#3a7a3a', '#e8e040'), { interact: 'v_arcade', game: 'stack', light: { r: 28, color: '160,255,120' } });
add('dartboard', 16, 26, (R, x) => { R(0, 0, 16, 26, '#3a2418'); const ring = (r, c) => { x.fillStyle = c; x.beginPath(); x.arc(8, 10, r, 0, 6.3); x.fill(); }; ring(7.5, '#101012'); ring(6.8, '#a82020'); ring(6, '#e8dcb8'); ring(4, '#208040'); ring(3.2, '#101012'); ring(1.2, '#a82020'); }, { interact: 'v_darts' });
add('foosball', 32, 22, (R) => { R(0, 4, 32, 12, '#3a2a1e'); R(2, 6, 28, 8, '#2a8a4a'); for (let i = 5; i < 30; i += 6) { R(i, 2, 1, 16, steel); R(i - 0.5, 7, 2, 2, i % 12 < 6 ? '#c02020' : '#2040c0'); R(i - 0.5, 11, 2, 2, i % 12 < 6 ? '#c02020' : '#2040c0'); } R(3, 16, 3, 6, '#3a2a1e'); R(26, 16, 3, 6, '#3a2a1e'); }, { fw: 2, interact: 'v_foosball' });
add('chess_table', 16, 18, (R) => { R(1, 2, 14, 10, '#c8b890'); for (let y = 0; y < 4; y++) for (let c = 0; c < 4; c++) if ((y + c) % 2) R(2 + c * 3, 3 + y * 2, 3, 2, '#5a3a24'); R(3, 2, 1, 2, black); R(9, 2, 1, 2, '#f8f0e0'); R(6.5, 12, 3, 6, steelD); }, { interact: 'v_chess' });
add('hoop', 28, 44, (R) => { R(13, 12, 2, 32, steelD); R(4, 0, 20, 13, '#e8e8e4'); R(4, 0, 20, 1, '#a02020'); R(11, 5, 6, 5, '#e8e8e4'); R(10, 12, 8, 1.4, '#e06020'); for (let i = 0; i < 4; i++) R(10.5 + i * 2, 13, 0.6, 5, '#f0f0f0'); }, { fw: 2, interact: 'v_hoop' });
add('skate_ramp', 48, 24, (R, x) => { const g = x.createLinearGradient(0, 0, 0, 24); g.addColorStop(0, '#b8986a'); g.addColorStop(1, '#8a6a44'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 24); x.quadraticCurveTo(10, 24, 16, 2); x.lineTo(32, 2); x.quadraticCurveTo(38, 24, 48, 24); x.fill(); R(16, 1, 16, 1.5, steel); }, { fw: 3, solid: true });
add('rail', 40, 12, (R) => { R(0, 3, 40, 1.6, steel); R(3, 3, 1.6, 9, steelD); R(35, 3, 1.6, 9, steelD); }, { fw: 2, solid: false });
// ---------------------------------------------------------------- gym and pool
add('treadmill', 32, 26, (R) => { R(0, 14, 32, 8, '#1e1e24'); R(2, 15, 28, 6, '#34343c'); R(26, 0, 2, 16, steelD); R(22, 0, 8, 6, '#2a2a34'); R(23, 1, 6, 3, '#40e0a0'); }, { fw: 2, interact: 'v_gym', gym: 'stamina' });
add('benchpress', 32, 24, (R) => { R(4, 10, 24, 4, '#8a2020'); R(8, 14, 2, 8, steelD); R(22, 14, 2, 8, steelD); R(0, 5, 32, 1.6, steel); R(0, 2, 3, 8, black); R(29, 2, 3, 8, black); R(5, 6, 1.4, 16, steelD); R(26, 6, 1.4, 16, steelD); }, { fw: 2, interact: 'v_gym', gym: 'strength' });
add('heavybag', 12, 34, (R) => { R(5, 0, 2, 6, steel); R(1, 6, 10, 26, '#8a2a20'); R(1, 6, 10, 2, '#5a1a14'); R(1, 30, 10, 2, '#5a1a14'); }, { interact: 'v_gym', gym: 'brawl' });
add('lockers', 32, 28, (R) => { for (let i = 0; i < 4; i++) { R(i * 8, 0, 7.5, 28, '#4a5a6a'); R(i * 8 + 1, 2, 5.5, 1, '#2a3440'); R(i * 8 + 1, 4, 5.5, 1, '#2a3440'); R(i * 8 + 5, 13, 1, 3, '#c8ccd2'); } }, { fw: 2 });
add('lifeguard', 16, 34, (R) => { R(1, 14, 2, 20, '#e8e4dc'); R(13, 14, 2, 20, '#e8e4dc'); R(0, 12, 16, 3, '#c83030'); R(1, 0, 14, 12, '#e8e4dc'); for (let y = 18; y < 34; y += 5) R(2, y, 12, 1, '#e8e4dc'); });
// ---------------------------------------------------------------- culture and shops
add('painting', 24, 20, (R) => { R(0, 0, 24, 20, '#c8a040'); R(2, 2, 20, 16, '#e8e0cc'); const c = ['#a03030', '#2a5a8a', '#d8a030', '#2a7a5a', '#6a3a8a']; for (let i = 0; i < 7; i++) R(3 + ((i * 7) % 14), 3 + ((i * 5) % 10), 5, 4, c[i % 5]); }, { fw: 2, solid: false, interact: 'v_exhibit' });
add('painting2', 24, 20, (R, x) => { R(0, 0, 24, 20, '#2a2a30'); R(2, 2, 20, 16, '#1e3a5a'); x.fillStyle = '#f0d060'; x.beginPath(); x.arc(16, 7, 3, 0, 6.3); x.fill(); x.fillStyle = '#0e1e2e'; x.beginPath(); x.moveTo(2, 18); x.lineTo(9, 8); x.lineTo(14, 14); x.lineTo(18, 10); x.lineTo(22, 18); x.fill(); }, { fw: 2, solid: false, interact: 'v_exhibit' });
add('sculpture', 16, 32, (R, x) => { R(2, 22, 12, 10, '#d8d4cc'); R(2, 22, 12, 1, '#f0ece4'); x.fillStyle = '#7a7e86'; x.beginPath(); x.moveTo(8, 0); x.bezierCurveTo(16, 8, 0, 12, 8, 22); x.bezierCurveTo(13, 18, 3, 8, 8, 0); x.fill(); }, { interact: 'v_exhibit' });
add('display_case', 32, 22, (R) => { R(0, 10, 32, 12, woodD); R(1, 0, 30, 11, 'rgba(170,210,230,0.42)'); R(1, 0, 30, 1, '#e8f4f8'); R(8, 5, 6, 5, '#b89030'); R(19, 4, 5, 6, '#8a6a4a'); }, { fw: 2, interact: 'v_exhibit' });
add('dino', 48, 34, (R, x) => { x.fillStyle = '#e4dcc8'; for (let i = 0; i < 8; i++) { x.fillRect(12 + i * 3, 12, 1.6, 8); } x.fillRect(4, 10, 36, 2); x.fillRect(38, 6, 9, 5); x.fillRect(14, 20, 2, 12); x.fillRect(30, 20, 2, 12); R(0, 32, 48, 2, '#5a5a62'); }, { fw: 3, interact: 'v_exhibit' });
add('bookcase', 32, 30, (R) => { R(0, 0, 32, 30, woodD); const c = ['#8a2a2a', '#2a5a7a', '#3a7a4a', '#b89040', '#5a3a7a', '#a86a3a']; for (let r = 0; r < 3; r++) { R(1, 9 + r * 9.6, 30, 1, woodL); for (let i = 0; i < 12; i++) R(2 + i * 2.4, 2 + r * 9.6, 2, 7, c[(i * 3 + r) % 6]); } }, { fw: 2, interact: 'v_book' });
add('reading_desk', 32, 18, (R) => { R(0, 3, 32, 9, woodL); R(0, 3, 32, 1, '#a88050'); R(3, 12, 2, 6, woodD); R(27, 12, 2, 6, woodD); R(6, 1, 8, 3, '#e8e4d0'); R(22, 0, 2, 4, steelD); R(19, 0, 8, 1.6, '#3a7a4a'); }, { fw: 2, interact: 'v_book' });
add('record_rack', 32, 20, (R) => { R(0, 6, 32, 14, wood); const c = ['#a03030', '#2a5a8a', '#d8a030', '#2a7a5a', '#6a3a8a', '#222222', '#e8e0d0']; for (let i = 0; i < 14; i++) R(1 + i * 2.2, 1 + (i % 2), 2, 8, c[(i * 5) % 7]); }, { fw: 2, interact: 'v_shelf' });
add('clothes_rack', 32, 26, (R) => { R(2, 1, 28, 1.4, steel); R(2, 1, 1.4, 25, steel); R(28.6, 1, 1.4, 25, steel); const c = ['#a03030', '#c8a040', '#2a5a8a', '#6a8a5a', '#8a5a8a', '#3a3a44']; for (let i = 0; i < 9; i++) R(4 + i * 2.7, 2, 2.4, 15, c[(i * 2) % 6]); }, { fw: 2, interact: 'v_shelf' });
add('stall', 32, 28, (R) => { for (let i = 0; i < 32; i += 8) { R(i, 0, 4, 7, '#c83a30'); R(i + 4, 0, 4, 7, '#f0e8d8'); } R(1, 7, 1.6, 21, wood); R(29.4, 7, 1.6, 21, wood); R(0, 15, 32, 13, woodL); R(0, 15, 32, 1, '#a88050'); R(4, 10, 6, 5, '#a86a3a'); R(13, 12, 5, 3, '#6a8a9a'); R(22, 10, 5, 5, '#c8a040'); }, { fw: 2, interact: 'v_shelf' });
add('tattoo_chair', 32, 20, (R) => { R(0, 8, 28, 5, '#1e1e22'); R(0, 2, 6, 10, '#1e1e22'); R(12, 13, 3, 7, steelD); R(26, 2, 2, 8, steel); R(24, 0, 7, 3, '#f0f0e8'); }, { fw: 2, interact: 'v_tattoo' });
add('barber_chair', 16, 24, (R) => { R(2, 0, 12, 12, '#8a1e28'); R(1, 10, 14, 5, '#a02632'); R(0, 7, 2, 7, steel); R(14, 7, 2, 7, steel); R(6, 15, 4, 6, steel); R(2, 21, 12, 3, steelD); }, { interact: 'v_barber' });
add('mirror', 24, 24, (R) => { R(0, 0, 24, 24, wood); R(2, 2, 20, 20, '#c8dce4'); R(5, 4, 4, 14, '#e8f4f8'); }, { fw: 2, solid: false });
add('barber_pole', 8, 26, (R) => { R(1, 2, 6, 22, '#f4f0e8'); for (let i = 0; i < 6; i++) { R(1, 3 + i * 3.6, 6, 1.4, i % 2 ? '#2040a0' : '#c02020'); } R(0, 0, 8, 2, steel); R(0, 24, 8, 2, steel); }, { solid: false });
add('espresso', 26, 20, (R) => { R(0, 14, 26, 6, '#3a2418'); R(2, 3, 22, 11, steel); R(2, 3, 22, 2, '#c8ccd2'); R(6, 8, 4, 2, black); R(16, 8, 4, 2, black); R(3, 0, 5, 3, '#e8e4dc'); R(10, 0, 5, 3, '#e8e4dc'); }, { fw: 2, interact: 'v_menu' });
add('menu_board', 16, 26, (R) => { R(0, 0, 16, 18, '#20282a'); R(0, 0, 16, 1, wood); for (let y = 3; y < 16; y += 3) R(2, y, 9 + ((y * 3) % 3), 1, '#d8d8d0'); R(2, 18, 2, 8, wood); R(12, 18, 2, 8, wood); }, { interact: 'v_menu' });
add('rtable', 16, 16, (R, x) => { x.fillStyle = '#f0ece0'; x.beginPath(); x.ellipse(8, 6, 8, 5, 0, 0, 6.3); x.fill(); R(0, 6, 16, 3, '#f0ece0'); R(7, 9, 2, 6, wood); R(6, 2, 3, 3, '#c04030'); }, { interact: 'v_menu' });
add('payphone', 14, 28, (R) => { R(0, 0, 14, 22, steelD); R(1, 1, 12, 5, '#2a4a8a'); R(3, 8, 8, 8, '#c8ccd2'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R(4 + c * 2, 9 + r * 2, 1.4, 1.4, black); R(1, 7, 2, 13, black); R(5, 22, 4, 6, steelD); }, { interact: 'v_payphone' });
add('sale_sign', 16, 22, (R) => { R(2, 0, 2, 22, wood); R(2, 2, 14, 2, wood); R(3, 4, 13, 9, '#f4f0e0'); R(3, 4, 13, 2, '#c02828'); R(5, 8, 9, 1, '#222222'); R(5, 10, 6, 1, '#222222'); }, { solid: false, interact: 'v_listing' });
add('counter', 32, 20, (R) => {   // worn laminate on a plywood front: the top edge chipped, the kick plate scuffed by years of boots
  R(0, 3, 32, 17, '#8e897c'); R(0, 3, 32, 3, '#b4ae9e'); R(0, 5.4, 32, 0.6, '#5e5a50'); R(0, 17, 32, 3, '#3e3b35'); R(0, 17, 32, 0.5, '#26241f');
  for (const q of [0, 16]) { R(q, 6, 0.5, 11, '#5e5a50'); R(q + 0.5, 6, 0.4, 11, '#a39d8d'); }
  for (let i = 0; i < 26; i++) R((i * 13.7) % 31, 6.5 + (i * 5.3) % 10, 1 + (i % 3) * 0.8, 0.4, i % 2 ? 'rgba(50,46,40,0.28)' : 'rgba(205,198,180,0.16)');
  for (let i = 0; i < 9; i++) R(2 + (i * 7.1) % 29, 17.4 + (i % 3) * 0.7, 2 + (i % 2) * 1.5, 0.5, 'rgba(120,114,100,0.5)');
  for (const q of [6, 23]) R(q, 3, 1.4, 0.6, '#6e695d');
  R(3, 0.4, 8, 3.6, '#1c1c20'); R(3.6, 0.8, 6.8, 1.4, '#34363c'); R(4.2, 2.6, 2, 0.6, '#5a5c62'); R(7, 2.6, 2.6, 0.6, '#5a5c62');
  R(22, 1.2, 5.4, 2.8, '#a39b80'); R(22.4, 1.5, 4.6, 0.4, '#cfc8ae'); R(22.8, 2.4, 3.6, 0.3, '#7e7760');
}, { fw: 2 });
// ---------------------------------------------------------------- the fight club
add('ring_floor', 16, 16, (R) => { R(0, 0, 16, 16, '#a89878'); R(0, 0, 16, 16, 'rgba(90,70,50,0.18)'); R(3, 5, 4, 2, 'rgba(120,30,20,0.28)'); R(10, 11, 3, 2, 'rgba(70,50,30,0.3)'); R(0, 15.5, 16, 0.5, '#8a7a5e'); R(15.5, 0, 0.5, 16, '#8a7a5e'); }, { flat: true, solid: false });
add('rope_h', 16, 16, (R) => { R(0, 3, 16, 1, '#c02828'); R(0, 6.5, 16, 1, '#e8e4dc'); R(0, 10, 16, 1, '#2848a0'); R(0, 14, 16, 2, '#3a3a40'); }, { solid: true });
add('rope_v', 8, 20, (R) => { R(3, 0, 1, 20, '#c02828'); R(4.5, 0, 1, 20, '#e8e4dc'); R(1.5, 0, 1, 20, '#2848a0'); }, { solid: true });
add('ring_post', 8, 26, (R) => { R(2, 0, 4, 24, '#8a2020'); R(2, 0, 4, 2, '#e8e4dc'); R(1, 24, 6, 2, black); }, { solid: true });
add('bleacher', 32, 22, (R) => { R(0, 0, 32, 6, '#4a4a52'); R(0, 7, 32, 7, '#5a5a62'); R(0, 15, 32, 7, '#6a6a72'); R(0, 5, 32, 1, black); R(0, 13.5, 32, 1, black); }, { fw: 2, solid: false, seat: true });
// spray paint: squeezed to fit its piece of wall (never taller than the wall), a little overspray, runs, and the brick
// showing through where it has worn off
const worn = (x, w, h, col) => {
  x.save(); x.fillStyle = col; for (let i = 0; i < 7; i++) x.fillRect(3 + (i * 11.3) % (w - 5), 7 + (i % 3) * 1.5, 0.6, 2.5 + ((i * 3) % 4)); x.restore();
  x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; for (let i = 0; i < 24; i++) x.fillRect((i * 17.3) % w, (i * 7.9) % h, 0.4, 0.4); x.restore();
};
const spray = (x, text, w, h, col) => {
  x.save(); x.font = 'bold 12px Impact, sans-serif'; x.lineJoin = 'round'; x.translate(1, 0); x.scale(Math.min(1, (w - 2) / x.measureText(text).width), 1);
  x.globalAlpha = 0.2; x.strokeStyle = col; x.lineWidth = 1.5; x.strokeText(text, 0, 11); x.globalAlpha = 0.92; x.fillStyle = col; x.fillText(text, 0, 11); x.restore();
  worn(x, w, h, col);
};
add('graffiti1', 32, 15, (R, x) => spray(x, 'BLOOD', 32, 15, '#e0d8c4'), { fw: 2, solid: false });
add('graffiti2', 40, 15, (R, x) => spray(x, 'NO RULES', 40, 15, '#d0b050'), { fw: 2, solid: false });
add('graffiti3', 32, 15, (R, x) => { x.strokeStyle = '#6e6288'; x.lineWidth = 1.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(2, 12); x.bezierCurveTo(8, -3, 14, 17, 20, 2); x.lineTo(29, 11); x.stroke(); worn(x, 32, 15, '#6e6288'); }, { fw: 2, solid: false });
add('oildrum_fire', 16, 24, (R) => { R(1, 6, 14, 18, '#5a4030'); R(1, 10, 14, 1, '#3a2a20'); R(1, 17, 14, 1, '#3a2a20'); R(3, 2, 10, 5, '#e87020'); R(5, 0, 6, 4, '#f8c040'); }, { light: { r: 54, color: '255,130,50' }, flicker: true });
add('worn_couch', 32, 18, (R) => { R(0, 0, 32, 9, '#5a4a30'); R(0, 8, 32, 8, '#6a5838'); R(0, 2, 3, 14, '#4a3a26'); R(29, 2, 3, 14, '#4a3a26'); R(8, 9, 7, 3, '#3a2e20'); R(20, 11, 5, 2, '#e8dcc0'); R(2, 16, 28, 2, black); }, { fw: 2, solid: false, seat: true });
add('bettingboard', 40, 28, (R) => { R(0, 0, 40, 28, '#1a1a1e'); R(1, 1, 38, 26, '#23262a'); for (let y = 4; y < 26; y += 4) { R(3, y, 16, 1.4, '#e8e4d0'); R(26, y, 9, 1.4, '#f0c040'); } }, { fw: 3, solid: true });
add('cage_lamp', 14, 10, (R) => { R(6, 0, 2, 3, black); R(1, 3, 12, 3, '#34383e'); R(4, 6, 6, 3, '#f8e8a8'); }, { solid: false, light: { r: 78, color: '255,235,180' } });
add('stairs', 32, 18, (R) => { for (let i = 0; i < 6; i++) R(i * 1.6, i * 3, 32 - i * 3.2, 3, `rgb(${110 - i * 14},${106 - i * 14},${100 - i * 14})`); }, { fw: 2, solid: false, flat: true });
// ---------------------------------------------------------------- building sites
add('scaffold', 48, 44, (R) => { for (const a of [1, 23, 45]) R(a, 0, 1.6, 44, steel); for (const b of [2, 15, 28, 41]) R(0, b, 48, 1.4, steelD); for (const b of [12, 25, 38]) R(0, b, 48, 2, '#b88a4a'); }, { fw: 3, solid: true });
add('mixer', 24, 22, (R, x) => { x.fillStyle = '#e07020'; x.beginPath(); x.ellipse(11, 9, 9, 8, 0.4, 0, 6.3); x.fill(); R(3, 16, 18, 3, steelD); x.fillStyle = black; x.beginPath(); x.arc(5, 20, 2, 0, 6.3); x.arc(19, 20, 2, 0, 6.3); x.fill(); }, { fw: 2 });
add('brick_pile', 24, 14, (R) => { for (let y = 0; y < 3; y++) for (let i = 0; i < 4; i++) R(1 + i * 5.6 + (y % 2) * 2, 2 + y * 4, 5, 3.4, y % 2 ? '#a8503a' : '#8a3a2a'); }, { fw: 2 });
add('lumber_pile', 28, 12, (R) => { for (let y = 0; y < 3; y++) R(y, 2 + y * 3.2, 28 - y * 2, 2.8, y % 2 ? '#c8a060' : '#b8904e'); }, { fw: 2 });
add('wall_frame', 16, 30, (R) => { R(0, 0, 16, 2, '#b8904e'); R(0, 26, 16, 2, '#b8904e'); for (const a of [0, 7, 14]) R(a, 0, 2, 28, '#c8a060'); }, { solid: true });
add('wall_half', 16, 24, (R) => { for (let y = 0; y < 24; y += 3) for (let i = -2; i < 16; i += 6) R(Math.max(0, i + (y % 6 ? 3 : 0)), y, 5.4, 2.6, y % 6 ? '#a8503a' : '#8a3a2a'); }, { solid: true });
add('foundation', 16, 16, (R) => { R(0, 0, 16, 16, '#9a968c'); R(0, 0, 16, 0.6, '#bab6aa'); R(5, 9, 5, 0.6, '#6a665e'); }, { flat: true, solid: false });
add('cone', 10, 12, (R, x) => { x.fillStyle = '#e8701c'; x.beginPath(); x.moveTo(5, 0); x.lineTo(9, 10); x.lineTo(1, 10); x.fill(); R(3, 5, 4, 1.4, '#f8f8f0'); R(0, 10, 10, 2, '#3a3a40'); }, { solid: false });
add('seal_tape', 16, 16, (R) => { R(0, 7, 16, 2, '#e8c81e'); for (let i = 0; i < 16; i += 4) R(i, 7, 2, 2, '#1a1a1e'); }, { solid: false });
if (A.sprites && A.sprites.bush) paintAll();
})();
