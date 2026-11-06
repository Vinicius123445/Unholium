'use strict';
// Parts of the world painted at last at the size the world is now: motorcycles and bicycles from above, the things that hang
// on walls (a clock that keeps the real time of the game), and stairs: concrete in the Pit, wood and steel in buildings.
(() => {
const F = G.realFurn, { make, wood, fill, line, grad } = F, A = G.assets, sh = A.shade, _more = F.more;
const ell = (x, X, Y, a, b, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(X, Y, a, b, 0, 0, 6.3); x.fill(); };
const poly = (x, c, ...p) => { x.fillStyle = c; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.fill(); };
// a flight of steps seen from the end that leads down into the room: each tread lit, each riser dark, worn in the middle
const flight = (x, X, Y, W, H, n, tread, riser) => {
  const h = H / n;
  for (let i = 0; i < n; i++) {
    const y = Y + i * h, k = 0.62 + 0.38 * ((i + 1) / n), g = x.createLinearGradient(X, 0, X + W, 0);
    g.addColorStop(0, sh(tread, k * 0.84)); g.addColorStop(0.5, sh(tread, k * 1.14)); g.addColorStop(1, sh(tread, k * 0.8));
    x.fillStyle = sh(riser, k); x.fillRect(X, y, W, h);
    x.fillStyle = g; x.fillRect(X, y + h * 0.42, W, h * 0.58);
    x.fillStyle = 'rgba(255,250,235,0.2)'; x.fillRect(X, y + h * 0.42, W, 0.28);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(X, y + h - 0.2, W, 0.2);
  }
};
const hands = (ctx, cx, cy, r, w) => {   // the time now, on any clock face
  const m = w.minutes % 60, h = (w.minutes / 60) % 12, a = (h / 12) * Math.PI * 2 - Math.PI / 2, b = (m / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1e';
  ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55); ctx.stroke();
  ctx.lineWidth = 0.48; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(b) * r * 0.86, cy + Math.sin(b) * r * 0.86); ctx.stroke();
  const t = (G.loop.time * 1) % 60, c = (t / 60) * Math.PI * 2 - Math.PI / 2; ctx.strokeStyle = '#b02020'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(c) * r * 0.9, cy + Math.sin(c) * r * 0.9); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(cx, cy, 0.42, 0, 6.3); ctx.fill();
};
F.more = () => {
  if (_more) _more();
  make('v_w_clock', 14, 14, (x, W) => {
    const c = W / 2; ell(x, c, c + 0.5, 6.9, 6.9, 'rgba(0,0,0,0.3)');
    x.fillStyle = grad(x, 0, 0, W, W, ['#8a6a44', '#5a3e24', '#3a2616']); x.beginPath(); x.arc(c, c, 6.8, 0, 6.3); x.fill();
    x.fillStyle = grad(x, 0, 0, W, W, ['#fbf7ec', '#e8e0cc']); x.beginPath(); x.arc(c, c, 5.6, 0, 6.3); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.2; x.beginPath(); x.arc(c, c, 5.6, 0, 6.3); x.stroke();
    x.strokeStyle = '#2a2a2e'; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283, l = i % 3 ? 0.6 : 1; x.lineWidth = i % 3 ? 0.18 : 0.34; x.beginPath(); x.moveTo(c + Math.sin(a) * 5, c - Math.cos(a) * 5); x.lineTo(c + Math.sin(a) * (5 - l), c - Math.cos(a) * (5 - l)); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.beginPath(); x.ellipse(c - 1.8, c - 2.6, 2.4, 1.3, -0.6, 0, 6.3); x.fill();
  });
  make('v_w_lamp', 12, 15, (x, W) => {
    fill(x, W / 2 - 1.8, 0, 3.6, 2.2, 0.4, grad(x, 0, 0, W, 0, ['#8a8e94', '#3e4248'])); x.fillStyle = '#50565e'; x.fillRect(W / 2 - 0.4, 2, 0.8, 2.4);
    x.fillStyle = grad(x, 2, 0, W - 2, 0, ['#c8a868', '#fff0c0', '#d4b070']); x.beginPath(); x.moveTo(3.8, 4); x.lineTo(W - 3.8, 4); x.lineTo(W - 1, 12); x.lineTo(1, 12); x.closePath(); x.fill();
    fill(x, 1, 11.6, W - 2, 1, 0.2, '#fff8d8'); x.fillStyle = 'rgba(255,240,190,0.5)'; x.fillRect(3.6, 12.6, W - 7.2, 1);
  });
  make('v_w_frame', 16, 14, (x, W, H) => {
    wood(x, 0, 0, W, H, '#6a4426', 5); fill(x, 1.4, 1.4, W - 2.8, H - 2.8, 0.1, '#ece6d6');
    x.save(); x.beginPath(); x.rect(2.4, 2.4, W - 4.8, H - 4.8); x.clip();
    x.fillStyle = grad(x, 0, 2, 0, 8, ['#a8c4dc', '#e8dcc0']); x.fillRect(2, 2, W, 7);
    ell(x, 11.4, 4.2, 1.2, 1.2, '#f4dc90'); poly(x, '#7a8a70', 2, 8, 6, 4.6, 10, 8); poly(x, '#6a7c64', 6, 8.4, 11, 5.4, 15, 8.4);
    x.fillStyle = grad(x, 0, 8, 0, 12, ['#6e8a4a', '#3e5a30']); x.fillRect(2, 8, W, 5); x.restore();
    x.fillStyle = 'rgba(255,255,255,0.12)'; poly(x, 'rgba(255,255,255,0.12)', 2.4, 2.4, 8, 2.4, 2.4, 9);
  });
  make('v_w_notice', 18, 18, (x, W, H) => {
    wood(x, 0, 0, W, H, '#6a4a2a', 9); fill(x, 1.1, 1.1, W - 2.2, H - 2.2, 0.1, grad(x, 0, 0, W, H, ['#c49a64', '#a47c48']));
    for (let i = 0; i < 70; i++) { const a = (i * 37) % 160 / 10 + 1, b = (i * 53) % 160 / 10 + 1; x.fillStyle = i % 2 ? 'rgba(60,36,16,0.24)' : 'rgba(255,230,190,0.14)'; x.fillRect(a, b, 0.3, 0.3); }
    const paper = (X, Y, w, h, c, r, pin) => { x.save(); x.translate(X, Y); x.rotate(r); x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(0.3, 0.3, w, h); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(40,40,50,0.45)'; for (let l = 1.4; l < h - 0.8; l += 1.2) x.fillRect(0.8, l, w - 1.6 - (l * 7 % 2), 0.28); ell(x, w / 2, 0.6, 0.5, 0.5, pin); ell(x, w / 2 - 0.1, 0.5, 0.18, 0.18, 'rgba(255,255,255,0.7)'); x.restore(); };
    paper(2.2, 2.4, 6.4, 7, '#f4f0e4', -0.04, '#c02020'); paper(9.4, 2, 6.2, 8, '#efe6a8', 0.05, '#2040c0'); paper(3.6, 10.2, 9.6, 5.8, '#f0ece0', 0.02, '#20a040');
  });
  make('v_w_extinguisher', 10, 20, (x, W, H) => {
    fill(x, 0.8, 7, W - 1.6, 2, 0.1, '#3a3a40');   // the bracket
    fill(x, 2, 5, 6, H - 6, 1.1, grad(x, 2, 0, 8, 0, ['#e8504a', '#c82420', '#86120e']));
    x.fillStyle = 'rgba(255,255,255,0.32)'; x.fillRect(3, 6.4, 0.8, H - 9);
    fill(x, 2.4, 9.6, 5.2, 4.4, 0.1, '#f2ece0'); x.fillStyle = '#c82420'; x.fillRect(3.2, 10.4, 3.6, 0.5); x.fillStyle = '#2a2a2e'; x.fillRect(3.2, 11.5, 3.6, 0.3); x.fillRect(3.2, 12.3, 2.6, 0.3);
    fill(x, 3.4, 2.6, 3.2, 2.8, 0.3, grad(x, 3, 0, 7, 0, ['#c8ccd2', '#5a5e64'])); fill(x, 4, 0.5, 2, 2.4, 0.3, '#1e1e22'); fill(x, 5.4, 0.8, 4, 0.9, 0.2, '#1e1e22');
    line(x, '#1e1e22', 0.7, 6.6, 3.2, 8.8, 4.4, 8.8, 13);
  });
  // the Pit: a wide concrete flight up to the street, steel rails, a bare bulb's light on the steps
  make('v_stairs', 64, 42, (x, W, H) => {
    fill(x, 0, 0, W, H, 0.3, '#08080a');
    x.fillStyle = grad(x, 0, 0, 0, 12, ['#000000', '#16161a']); x.fillRect(4, 0, W - 8, 4);
    flight(x, 4, 3, W - 8, H - 3, 9, '#c4c0b6', '#7a7870');
    for (const X of [0, W - 4]) { fill(x, X, 0, 4, H, 0.2, grad(x, X, 0, X + 4, 0, ['#5e5c58', '#3a3936'])); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(X, 0, 0.4, H); }
    for (const X of [1.5, W - 2.5]) { line(x, '#c8ccd2', 0.7, X, 2, X, H - 1); line(x, 'rgba(0,0,0,0.4)', 0.2, X + 0.4, 2, X + 0.4, H - 1); for (let y = 8; y < H; y += 11) ell(x, X, y, 0.9, 0.9, '#8a8e94'); }
    x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 16; i++) { const a = 6 + (i * 37) % 50, b = 12 + (i * 23) % 28; x.fillRect(a, b, 0.5 + (i % 3) * 0.3, 0.3); }
  });
  make('stairs_up', 24, 36, (x, W, H) => {
    fill(x, 0, 0, W, H, 0.3, '#1e1610');
    flight(x, 2.2, 1, W - 4.4, H - 2, 11, '#a07a4e', '#54381f');
    for (const X of [0, W - 2.2]) { wood(x, X, 0, 2.2, H, '#5a3a22', X + 2); }
    line(x, '#7a5a3a', 0.5, 1.1, 0, 1.1, H);
  });
  make('stairs_down', 24, 24, (x, W, H) => {
    fill(x, 0, 0, W, H, 0.3, '#3e3026'); fill(x, 1.6, 1.6, W - 3.2, H - 3.2, 0.2, '#040405');
    for (let i = 0; i < 7; i++) { const k = 1 - i / 8, y = H - 3 - i * 2.7, m = 1.6 + i * 0.5; x.fillStyle = sh('#a07a4e', k); x.fillRect(m, y - 1.3, W - m * 2, 1.6); x.fillStyle = sh('#54381f', k); x.fillRect(m, y + 0.3, W - m * 2, 1); }
    x.strokeStyle = '#6a5038'; x.lineWidth = 0.8; x.strokeRect(0.6, 0.6, W - 1.2, H - 1.2);
  });
};
// the clock on the wall tells the time of the world
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const r = _dd.call(this, ctx, o, s, scene);
  if (o.def.sprite === 'v_w_clock' && G.world) hands(ctx, o.x - s.ax + s.w / 2, o.y - s.ay + s.h / 2 - (o.hung ? G.hungLift(o) : 0), 5, G.world);
  return r;
};
const GS = G.GameScene.prototype, _use = GS.useDecor, _lab = GS.decorLabel;
if (G.DECOR.v_w_clock) G.DECOR.v_w_clock.interact = 'wallclock';
GS.useDecor = function (d) { if (d.def.interact !== 'wallclock') return _use.apply(this, arguments); this.toast(`It is ${this.world.timeString}.`, 'info'); return undefined; };
GS.decorLabel = function (d) { return d.def.interact === 'wallclock' ? 'Check the time' : _lab.apply(this, arguments); };
Object.assign(G.LANG_PT.s, { 'Check the time': 'Ver as horas' }); G.LANG_PT.t.push(['It is {0}.', 'São {0}.']); if (G.i18n.tpl) G.i18n.tpl = null;

// furniture comes after the wall pieces are placed: anything that ended up behind a shelf moves along the wall to where it can be seen
const _lm = GS.loadMap;
GS.loadMap = function () {
  const r = _lm.apply(this, arguments), m = this.map;
  if (m && !m._hungFree) {
    m._hungFree = true;
    const blocked = (x, y) => m.decorsAt(x, y + 1).some((q) => q.def.solid) || m.decorsAt(x, y + 2).some((q) => q.def.solid && !q.def.flat);
    for (const d of m.decor) {
      if (!/^v_w_(clock|frame|notice|extinguisher|lamp)$/.test(d.type) || !G.TILES[m.get(d.tx, d.ty)].wall || !blocked(d.tx, d.ty)) continue;
      for (let k = 1; k < 14; k++) { const nx = [d.tx + k, d.tx - k].find((x) => G.TILES[m.get(x, d.ty)] && G.TILES[m.get(x, d.ty)].wall && !G.TILES[m.get(x, d.ty + 1)].wall && !blocked(x, d.ty) && !m.decor.some((q) => q !== d && q.ty === d.ty && q.tx === x)); if (nx != null) { d.x += (nx - d.tx) * 16; d.tx = nx; break; } }
    }
  }
  return r;
};
// ---------------------------------------------------------------- motorcycles and bicycles, from above
const D = 4, _get = G.vehiclesHD.get, cache = {};
function moto(m) {
  const L = m.len, W = m.wid, c = document.createElement('canvas'); c.width = L * D; c.height = W * D;
  const x = c.getContext('2d'); x.scale(D, D); const my = W / 2, b = m.body, chop = !!m.chopper, RR = (X, Y, w, h, r, f) => fill(x, X, Y, w, h, r, f);
  const across = (Y, H, col) => { const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, sh(col, 0.55)); g.addColorStop(0.34, sh(col, 1.3)); g.addColorStop(0.5, sh(col, 1.55)); g.addColorStop(0.68, col); g.addColorStop(1, sh(col, 0.42)); return g; };
  const tyre = (X, l, w) => { RR(X, my - w / 2, l, w, 0.5, across(my - w / 2, w, '#26262a')); x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = X + 0.6; i < X + l - 0.4; i += 1) x.fillRect(i, my - w / 2 + 0.25, 0.3, w - 0.5); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(X + 0.6, my - 0.15, l - 1.2, 0.3); };
  const fx = L - (chop ? 2 : 3);   // the nose
  tyre(0.4, L * 0.26, chop ? 4.4 : 3.8); tyre(L - L * 0.25 - 0.4, L * 0.25, chop ? 2.6 : 3.2);
  RR(L * 0.04, my - 1.9, L * 0.2, 3.8, 0.8, across(my - 1.9, 3.8, b));   // rear hugger
  RR(L * 0.76, my - 1.7, L * 0.2, 3.4, 0.8, across(my - 1.7, 3.4, b));   // front fender
  // the swingarm and the engine under it all
  RR(L * 0.2, my - 2.5, L * 0.2, 0.7, 0.2, '#52545c'); RR(L * 0.2, my + 1.8, L * 0.2, 0.7, 0.2, '#52545c');
  RR(L * 0.34, my - 4.2, L * 0.26, 8.4, 1, across(my - 4.2, 8.4, '#3a3a42'));
  x.fillStyle = 'rgba(0,0,0,0.42)'; for (let i = L * 0.36; i < L * 0.58; i += 1.1) x.fillRect(i, my - 4, 0.3, 8);
  ell(x, L * 0.46, my - 4, 1.8, 1, '#8a8e96'); ell(x, L * 0.46, my + 4, 1.8, 1, '#8a8e96');   // side covers
  // the exhaust down the right
  const ex = my + (chop ? 4.2 : 3.6); RR(L * 0.04, ex, L * 0.4, 1.7, 0.7, across(ex, 1.7, '#c8ccd2')); ell(x, L * 0.05, ex + 0.85, 0.5, 0.75, '#141416'); if (chop) RR(L * 0.04, my - 5.9, L * 0.4, 1.7, 0.7, across(my - 5.9, 1.7, '#c8ccd2'));
  // the seat and its tail
  RR(L * 0.16, my - 2.5, L * 0.32, 5, 1.1, across(my - 2.5, 5, '#242226')); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = L * 0.18; i < L * 0.46; i += 2) x.fillRect(i, my - 2, 0.3, 4);
  if (!chop) { RR(L * 0.08, my - 2.2, L * 0.13, 4.4, 1, across(my - 2.2, 4.4, b)); fill(x, L * 0.06, my - 1.2, 1, 2.4, 0.3, '#e02a2a'); }
  else { RR(L * 0.1, my - 3, L * 0.09, 6, 1, across(my - 3, 6, '#242226')); }   // a sissy pad
  // the tank: glossy, the widest thing on the bike, a stripe down it
  x.fillStyle = across(my - 3.6, 7.2, b); x.beginPath(); x.moveTo(L * 0.46, my - 2.4); x.quadraticCurveTo(L * 0.54, my - 4, L * 0.66, my - 3.2); x.quadraticCurveTo(L * 0.71, my, L * 0.66, my + 3.2); x.quadraticCurveTo(L * 0.54, my + 4, L * 0.46, my + 2.4); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.68)'; x.fillRect(L * 0.47, my - 0.42, L * 0.2, 0.84); x.fillStyle = sh(b, 0.6); x.fillRect(L * 0.47, my - 0.1, L * 0.2, 0.2);
  ell(x, L * 0.53, my - 2, 2.4, 0.6, 'rgba(255,255,255,0.42)'); ell(x, L * 0.62, my, 0.6, 0.6, '#c8ccd4');
  // fork, bars, levers, mirrors, clocks
  const barX = L * (chop ? 0.67 : 0.72), bw = W / 2 - 0.5;
  for (const s of [-1, 1]) { RR(L * 0.7, my + s * 1.5 - 0.35, L * 0.2, 0.7, 0.15, '#d0d4dc'); }
  line(x, '#b8bcc4', 0.75, barX + 0.8, my, barX, my - bw); line(x, '#b8bcc4', 0.75, barX + 0.8, my, barX, my + bw);
  for (const s of [-1, 1]) { const Y = my + s * bw; fill(x, barX - 0.7, Y - 1.1, 1.4, 2.2, 0.4, '#141416'); line(x, '#7a7e86', 0.3, barX + 0.8, Y - s * 0.2, barX + 1.5, Y - s * 2); line(x, '#2a2a30', 0.3, barX + 0.2, my + s * (bw - 3), barX - 1.6, my + s * (bw - 1.5)); ell(x, barX - 1.8, my + s * (bw - 1.2), 0.9, 0.7, '#1e1e24'); ell(x, barX - 1.85, my + s * (bw - 1.2), 0.5, 0.4, '#b8d4e4'); }
  if (!chop) { RR(L * 0.78, my - 2.2, L * 0.11, 4.4, 0.7, across(my - 2.2, 4.4, b)); RR(L * 0.77, my - 1.9, 1.2, 3.8, 0.4, 'rgba(160,200,220,0.7)'); }
  ell(x, fx - 0.4, my, 1.4, 1.9, '#d8dce4'); ell(x, fx - 0.2, my, 1, 1.5, '#fff6d0');
  return c;
}
function bicycle(m) {
  const L = m.len, W = m.wid, c = document.createElement('canvas'); c.width = L * D; c.height = W * D;
  const x = c.getContext('2d'); x.scale(D, D); const my = W / 2, b = m.body, wheel = L * 0.34;
  for (const X of [0.3, L - wheel - 0.3]) { fill(x, X, my - 0.7, wheel, 1.4, 0.4, '#141416'); x.fillStyle = '#3a3a40'; x.fillRect(X + 0.5, my - 0.12, wheel - 1, 0.24); ell(x, X + wheel / 2, my, 0.7, 0.6, '#8a8e96'); }
  line(x, b, 0.9, L * 0.3, my, L * 0.72, my); line(x, sh(b, 1.3), 0.3, L * 0.3, my - 0.15, L * 0.72, my - 0.15);
  line(x, sh(b, 0.75), 0.5, L * 0.14, my - 0.7, L * 0.34, my - 0.2); line(x, sh(b, 0.75), 0.5, L * 0.14, my + 0.7, L * 0.34, my + 0.2);
  ell(x, L * 0.42, my + 1.1, 1.5, 0.45, '#7a7e86'); line(x, '#5a5a62', 0.5, L * 0.42, my - 3, L * 0.42, my + 3); fill(x, L * 0.38, my - 3.9, L * 0.09, 1.3, 0.2, '#22222a'); fill(x, L * 0.38, my + 2.6, L * 0.09, 1.3, 0.2, '#22222a');
  fill(x, L * 0.26, my - 1.2, L * 0.15, 2.4, 0.6, '#2a2420'); x.fillStyle = '#4a3a30'; x.fillRect(L * 0.28, my - 0.8, L * 0.1, 0.4);
  const bx = L * 0.74, bw = W / 2 - 0.4; line(x, '#a8acb4', 0.6, bx, my - bw, bx, my + bw); line(x, sh(b, 0.8), 0.7, L * 0.7, my, bx, my);
  for (const s of [-1, 1]) fill(x, bx - 0.5, my + s * bw - (s > 0 ? 1.5 : 0), 1, 1.5, 0.3, '#141416');
  ell(x, bx + 0.9, my - 1.6, 0.5, 0.5, '#d8c848');
  return c;
}
G.vehiclesHD.get = function (model) {
  const m = G.vehicles.MODELS[model]; if (!m || !(m.moto || m.bike)) return _get.call(this, model);
  return cache[model] || (cache[model] = m.bike ? bicycle(m) : moto(m));
};
})();
