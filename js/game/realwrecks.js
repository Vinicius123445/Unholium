'use strict';
// Motorcycles as real machines, and what is left of a vehicle after it burns.
//   top(m): a motorcycle from above. Sport, naked, touring and chopper are built differently, not just painted differently.
//   side(m, burnt): the same machine in profile, which is what a bike lying on its side shows: wheels flat on the ground, the bars
//     turned, the mirror snapped, the kickstand out. Burnt: rims without tyres, bent fork and bars, broken fairing, bare frame.
//   carWreck(model, seed): the car itself, crumpled panel by panel, charred, glass gone, bonnet off, engine showing.
// A bicycle has no engine to burn and keeps its own drawing (js/game/realparts.js, js/game/crashes.js).
(() => {
const A = G.assets, sh = A.shade, TAU = Math.PI * 2, D = 6, TYPE = { moto_red: 'sport', moto_black: 'naked', moto_blue: 'touring', moto_chopper: 'chopper' };
const typeOf = (m) => (m.chopper ? 'chopper' : TYPE[m.id] || m.style || 'naked');
const rr = (x, X, Y, W, H, r, f) => { const q = Math.min(r, W / 2, H / 2); x.fillStyle = f; x.beginPath(); x.moveTo(X + q, Y); x.arcTo(X + W, Y, X + W, Y + H, q); x.arcTo(X + W, Y + H, X, Y + H, q); x.arcTo(X, Y + H, X, Y, q); x.arcTo(X, Y, X + W, Y, q); x.closePath(); x.fill(); };
const ell = (x, X, Y, a, b, f, r = 0) => { x.fillStyle = f; x.beginPath(); x.ellipse(X, Y, a, b, r, 0, TAU); x.fill(); };
const seg = (x, c, w, ...p) => { x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.stroke(); };
const poly = (x, f, ...p) => { x.fillStyle = f; x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.fill(); };
const gloss = (x, Y, H, c) => { const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, sh(c, 0.5)); g.addColorStop(0.3, sh(c, 1.25)); g.addColorStop(0.46, sh(c, 1.7)); g.addColorStop(0.62, c); g.addColorStop(1, sh(c, 0.4)); return g; };
const metal = (x, a, b, c0 = '#e4e8ee', c1 = '#6a6e76') => { const g = x.createLinearGradient(0, a, 0, b); g.addColorStop(0, c1); g.addColorStop(0.45, c0); g.addColorStop(1, c1); return g; };
const dice = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
const canvas = (W, H, k = D) => { const c = document.createElement('canvas'); c.width = Math.ceil(W * k); c.height = Math.ceil(H * k); const x = c.getContext('2d'); x.scale(k, k); x.imageSmoothingEnabled = true; return { c, x }; };

// ---------------------------------------------------------------- from above, nose toward +x
function top(m) {
  const L = m.len, W = m.wid, { c, x } = canvas(L, W), my = W / 2, b = m.body, t = typeOf(m), chop = t === 'chopper', rear = chop ? 4.8 : t === 'sport' ? 4.2 : 3.8, front = chop ? 2.4 : t === 'touring' ? 3.4 : 3;
  const tyre = (X, l, w) => {
    rr(x, X, my - w / 2, l, w, w / 2, gloss(x, my - w / 2, w, '#2a2a2e'));
    x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = X + 0.8; i < X + l - 0.6; i += 0.9) { x.fillRect(i, my - w / 2 + 0.3, 0.28, w * 0.28); x.fillRect(i + 0.4, my + w * 0.22, 0.28, w * 0.26); }
    x.fillStyle = 'rgba(255,255,255,0.09)'; x.fillRect(X + 0.8, my - 0.14, l - 1.6, 0.28);
  };
  const rX = 0.4, rL = L * 0.27, fL = L * 0.25, fX = L - fL - 0.3;
  tyre(rX, rL, rear); tyre(fX, fL, front);
  // the rear: swingarm, chain down the left, the sprocket and disc
  const arm = L * 0.17; rr(x, arm, my - 2.8, L * 0.21, 0.8, 0.2, metal(x, my - 2.8, my - 2, '#b8bcc4')); rr(x, arm, my + 2, L * 0.21, 0.8, 0.2, metal(x, my + 2, my + 2.8, '#b8bcc4'));
  seg(x, '#30302e', 0.42, L * 0.12, my - 2.9, L * 0.38, my - 2.9); x.strokeStyle = '#8a8e96'; x.lineWidth = 0.18; x.setLineDash([0.3, 0.3]); seg(x, '#8a8e96', 0.18, L * 0.12, my - 2.9, L * 0.38, my - 2.9); x.setLineDash([]);
  rr(x, L * 0.1, my + 2.2, L * 0.07, 0.6, 0.2, metal(x, my + 2.2, my + 2.8));   // rear disc, edge on
  rr(x, L * 0.8, my + 1.5, L * 0.06, 0.5, 0.2, metal(x, my + 1.5, my + 2));     // front disc
  // the engine under everything: crankcases out past the frame, fins, covers
  const eW = chop ? 8.6 : t === 'naked' ? 8 : 7.4, eX = L * (chop ? 0.32 : 0.36), eL = L * 0.26;
  rr(x, eX, my - eW / 2, eL, eW, 1.1, gloss(x, my - eW / 2, eW, '#46464e'));
  x.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = eX + 1; i < eX + eL - 0.8; i += 1) x.fillRect(i, my - eW / 2 + 0.4, 0.3, eW - 0.8);
  for (const s of [-1, 1]) { ell(x, eX + eL * 0.45, my + s * (eW / 2 - 0.1), 2.3, 1, metal(x, my + s * eW / 2 - 1, my + s * eW / 2 + 1, '#d8dce4', '#6a6e76')); ell(x, eX + eL * 0.45, my + s * (eW / 2 - 0.1), 0.8, 0.4, '#3a3a42'); }
  if (t !== 'chopper' && t !== 'touring') { rr(x, L * 0.62, my - 3.2, 1.4, 6.4, 0.3, '#16161a'); x.fillStyle = '#3a3a42'; for (let i = my - 3; i < my + 3; i += 0.7) x.fillRect(L * 0.62 + 0.2, i, 1, 0.3); }   // radiator
  // exhausts
  const pipe = (Y, X0, Xl, h, col = '#d0d4dc') => { rr(x, X0, Y, Xl, h, h / 2, metal(x, Y, Y + h, col, '#6a6e76')); ell(x, X0 + 0.3, Y + h / 2, 0.4, h * 0.34, '#101012'); };
  if (chop) { pipe(my + 3.6, L * 0.03, L * 0.42, 1.5); pipe(my - 5.1, L * 0.03, L * 0.42, 1.5); }
  else if (t === 'sport') { pipe(my + 2.6, L * 0.05, L * 0.28, 2.4, '#b8c0c8'); rr(x, L * 0.08, my + 2.8, L * 0.1, 2, 0.5, '#2a2a30'); }
  else if (t === 'touring') { pipe(my + 3.4, L * 0.04, L * 0.34, 1.8); pipe(my - 5.2, L * 0.04, L * 0.34, 1.8); }
  else pipe(my + 2.9, L * 0.03, L * 0.36, 2);
  // seat, tail, tank
  if (t === 'sport') {
    poly(x, gloss(x, my - 2.6, 5.2, b), L * 0.07, my - 1.1, L * 0.26, my - 2.6, L * 0.34, my - 2.2, L * 0.34, my + 2.2, L * 0.26, my + 2.6, L * 0.07, my + 1.1);
    rr(x, L * 0.17, my - 2, L * 0.25, 4, 1, gloss(x, my - 2, 4, '#26242a'));
    rr(x, L * 0.05, my - 1.1, 0.9, 2.2, 0.3, '#e0282a'); x.fillStyle = 'rgba(255,190,190,0.6)'; x.fillRect(L * 0.05 + 0.1, my - 0.8, 0.3, 1.6);
  } else if (t === 'touring') {
    rr(x, L * 0.02, my - 3, L * 0.16, 6, 1, gloss(x, my - 3, 6, sh(b, 0.72)));                    // top box
    for (const s of [-1, 1]) rr(x, L * 0.08, my + (s > 0 ? 4 : -W / 2 + 0.4), L * 0.24, W / 2 - 4.4, 0.8, gloss(x, my + (s > 0 ? 4 : -W / 2 + 0.4), W / 2 - 4.4, sh(b, 0.85)));   // panniers
    rr(x, L * 0.2, my - 3, L * 0.27, 6, 1.4, gloss(x, my - 3, 6, '#2a2628')); seg(x, 'rgba(0,0,0,0.5)', 0.24, L * 0.32, my - 2.8, L * 0.32, my + 2.8);
    rr(x, L * 0.03, my - 0.9, 0.7, 1.8, 0.2, '#e0282a');
  } else if (chop) {
    rr(x, L * 0.23, my - 2.8, L * 0.2, 5.6, 1.4, gloss(x, my - 2.8, 5.6, '#2c2420')); rr(x, L * 0.14, my - 3.2, L * 0.07, 6.4, 1.2, metal(x, my - 3.2, my + 3.2, '#c8ccd2', '#5a5e66'));   // the seat, the sissy bar
    rr(x, L * 0.02, my - 2.6, L * 0.2, 5.2, 1.2, gloss(x, my - 2.6, 5.2, b));   // the wide rear fender
  } else {
    rr(x, L * 0.08, my - 1.8, L * 0.14, 3.6, 0.8, gloss(x, my - 1.8, 3.6, sh(b, 0.86))); rr(x, L * 0.18, my - 2.4, L * 0.25, 4.8, 1, gloss(x, my - 2.4, 4.8, '#242226'));
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = L * 0.2; i < L * 0.41; i += 1.6) x.fillRect(i, my - 2, 0.25, 4); rr(x, L * 0.06, my - 0.9, 0.8, 1.8, 0.2, '#e0282a');
  }
  const tX = L * (chop ? 0.44 : 0.42), tL = L * (chop ? 0.2 : 0.26), tW = chop ? 2.6 : t === 'touring' ? 4.4 : 3.8;
  x.fillStyle = gloss(x, my - tW, tW * 2, b); x.beginPath(); x.moveTo(tX, my - tW * 0.62); x.quadraticCurveTo(tX + tL * 0.45, my - tW * 1.1, tX + tL, my - tW * 0.8); x.quadraticCurveTo(tX + tL * 1.14, my, tX + tL, my + tW * 0.8); x.quadraticCurveTo(tX + tL * 0.45, my + tW * 1.1, tX, my + tW * 0.62); x.closePath(); x.fill();
  if (t !== 'chopper') { x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(tX + 0.8, my - 0.5, tL - 1.6, 0.34); x.fillRect(tX + 0.8, my + 0.16, tL - 1.6, 0.34); }
  ell(x, tX + tL * 0.4, my - tW * 0.5, tL * 0.3, 0.5, 'rgba(255,255,255,0.46)'); ell(x, tX + tL * 0.72, my, 0.5, 0.5, metal(x, my - 0.5, my + 0.5));
  // fork, bars, levers, mirrors, instruments
  const barX = L * (chop ? 0.66 : t === 'sport' ? 0.74 : 0.72), bw = W / 2 - (chop ? 0.3 : 0.8), rake = chop ? L * 0.28 : L * 0.17;
  for (const s of [-1, 1]) rr(x, barX, my + s * 1.6 - 0.34, rake, 0.68, 0.2, metal(x, my + s * 1.6 - 0.34, my + s * 1.6 + 0.34));
  if (t === 'sport') { for (const s of [-1, 1]) { seg(x, '#9aa0aa', 0.6, barX + 0.6, my + s * 1.8, barX - 0.2, my + s * (bw - 0.8)); } }
  else if (chop) { for (const s of [-1, 1]) seg(x, '#d0d4dc', 0.62, barX + 1, my + s * 0.6, barX + 2.4, my + s * 2.6, barX - 1.6, my + s * bw); }
  else { for (const s of [-1, 1]) seg(x, '#b8bcc4', 0.66, barX + 0.8, my, barX, my + s * bw); }
  for (const s of [-1, 1]) {
    const Y = my + s * bw, gx = chop ? barX - 1.6 : t === 'sport' ? barX - 0.2 : barX;
    rr(x, gx - 0.7, Y - (s > 0 ? 1.8 : 0.2), 1.4, 2, 0.4, '#141416'); seg(x, '#8a8e96', 0.26, gx + 0.6, Y - s * 0.3, gx + 1.3, Y - s * 2);
    if (!chop) { seg(x, '#2a2a30', 0.28, gx + 0.3, my + s * (bw - 3), gx - 1.6, my + s * (bw - 1.2)); ell(x, gx - 1.9, my + s * (bw - 1), 1, 0.7, '#1a1a20'); ell(x, gx - 2, my + s * (bw - 1), 0.56, 0.4, '#b8d4e4'); }
  }
  if (t === 'sport') {
    poly(x, gloss(x, my - 3.6, 7.2, b), L * 0.7, my - 3.6, L * 0.84, my - 2.4, L * 0.93, my - 0.8, L * 0.93, my + 0.8, L * 0.84, my + 2.4, L * 0.7, my + 3.6);
    poly(x, 'rgba(150,200,225,0.72)', L * 0.71, my - 2.2, L * 0.8, my - 1.5, L * 0.8, my + 1.5, L * 0.71, my + 2.2); for (const s of [-1, 1]) ell(x, L * 0.91, my + s * 1, 1, 0.7, '#fff6d0');
  } else if (t === 'touring') {
    poly(x, gloss(x, my - 4.4, 8.8, b), L * 0.66, my - 4.4, L * 0.8, my - 3.2, L * 0.88, my - 1.4, L * 0.88, my + 1.4, L * 0.8, my + 3.2, L * 0.66, my + 4.4);
    poly(x, 'rgba(170,215,235,0.64)', L * 0.66, my - 3, L * 0.73, my - 2.6, L * 0.73, my + 2.6, L * 0.66, my + 3); ell(x, L * 0.85, my, 1.2, 1.6, '#fff6d0');
  } else { ell(x, barX + 1.7, my, 1.1, 1.3, '#16161a'); ell(x, barX + 1.7, my, 0.7, 0.9, '#c8d8e0'); ell(x, L - (chop ? 0.9 : 3.2), my, 1.2, 1.7, metal(x, my - 1.7, my + 1.7)); ell(x, L - (chop ? 0.8 : 3), my, 0.85, 1.3, '#fff6d0'); }
  // fender and footpegs
  rr(x, L * 0.78, my - front / 2 - 0.1, L * 0.17, front + 0.2, 0.8, gloss(x, my - front / 2, front, b));
  for (const s of [-1, 1]) { rr(x, L * 0.37, my + s * (eW / 2 + 0.3) - 0.3, 1.3, 0.6, 0.2, '#2a2a2e'); seg(x, '#141416', 0.5, L * 0.38, my + s * (eW / 2 + 0.3), L * 0.38, my + s * (eW / 2 + 1)); }
  return c;
}

// ---------------------------------------------------------------- in profile: ground at the bottom, nose toward +x. x along the bike, y up the page
function side(m, burnt) {
  const L = m.len + 6, H = 28, { c, x } = canvas(L, H), t = typeOf(m), chop = t === 'chopper', rw = chop ? 6.4 : 6.1, fw = chop ? 6.8 : 6.1, gy = H - 1.4, rx = 3 + rw, fx = L - 3 - fw - (chop ? 2 : 0), axl = gy - rw, fax = gy - fw;
  const b = burnt ? '#2a2624' : m.body, dark = (q) => (burnt ? sh(q, 0.32) : q), r = dice(m.len * 7 + (burnt ? 13 : 3));
  const wheel = (cx, cy, R) => {
    if (burnt) { x.strokeStyle = '#3a3532'; x.lineWidth = 0.9; x.beginPath(); x.arc(cx, cy, R - 1, 0, TAU); x.stroke(); seg(x, 'rgba(10,8,8,0.9)', 1.1, cx - R + 0.6, cy + 2, cx - 2, cy + R - 0.6); for (let i = 0; i < 7; i++) { const a = i * 0.9; seg(x, '#4a4542', 0.26, cx, cy, cx + Math.cos(a) * (R - 1.4), cy + Math.sin(a) * (R - 1.4)); } ell(x, cx, cy, 1.1, 1.1, '#2a2826'); return; }
    ell(x, cx, cy, R, R, '#17171a'); x.strokeStyle = '#2e2e32'; x.lineWidth = 0.45; x.setLineDash([0.5, 0.4]); x.beginPath(); x.arc(cx, cy, R - 0.2, 0, TAU); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#3a3a40'; x.lineWidth = 0.3; x.beginPath(); x.arc(cx, cy, R - 1, 0, TAU); x.stroke();
    x.strokeStyle = metal(x, cy - R, cy + R, '#d8dce4', '#7a7e86'); x.lineWidth = 0.7; x.beginPath(); x.arc(cx, cy, R - 1.8, 0, TAU); x.stroke();
    for (let i = 0; i < (chop ? 18 : 5); i++) { const a = i * TAU / (chop ? 18 : 5); seg(x, chop ? '#c8ccd2' : '#2a2a30', chop ? 0.14 : 0.6, cx, cy, cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); }
    ell(x, cx, cy, 2.7, 2.7, metal(x, cy - 2.7, cy + 2.7, '#b8bcc4', '#6a6e76')); ell(x, cx, cy, 2.1, 2.1, 'rgba(30,30,34,0.34)'); for (let i = 0; i < 8; i++) { const a = i * 0.785; ell(x, cx + Math.cos(a) * 2.4, cy + Math.sin(a) * 2.4, 0.16, 0.16, '#2a2a30'); } ell(x, cx, cy, 0.9, 0.9, '#36363c');
  };
  x.fillStyle = 'rgba(0,0,0,0)';
  // swingarm, chain, sprocket
  const px = rx + (fx - rx) * 0.43, py = gy - 8.6;
  seg(x, dark('#8a8e96'), 1.1, rx, axl, px, py); if (!burnt) { seg(x, '#2e2e2c', 0.5, rx, axl - 2, px - 1, py - 1); seg(x, '#2e2e2c', 0.5, rx + 0.2, axl + 2, px - 1, py + 1.4); } ell(x, rx, axl, 2.1, 2.1, dark('#6a6e76'));
  wheel(rx, axl, rw);
  // rear suspension
  if (!chop) { seg(x, dark('#c8a040'), 1, rx + 4, axl - 2, px - 3.6, py - 6); x.strokeStyle = dark('#6a6e76'); seg(x, dark('#4a4e56'), 0.32, rx + 4.3, axl - 2.4, px - 3.8, py - 5.6); }
  // the engine: cases, cylinders, fins, a cover
  const ex = px + (chop ? 0.4 : 1), ey = py + 1;
  if (chop) { for (const a of [-0.45, 0.45]) { x.save(); x.translate(ex + 3, ey - 2); x.rotate(a); rr(x, -1.7, -8, 3.4, 8, 0.5, dark('#5a5e66')); x.fillStyle = dark('#2a2c30'); for (let i = -7.6; i < -1; i += 0.9) x.fillRect(-1.9, i, 3.8, 0.34); rr(x, -1.8, -9, 3.6, 1.4, 0.5, dark('#c8ccd2')); x.restore(); } }
  else { rr(x, ex + (t === 'sport' ? 2.4 : 0.4), ey - 8.4, 6.4, 7.6, 0.6, dark('#4e5058')); x.fillStyle = dark('#23252a'); for (let i = ey - 8; i < ey - 1.4; i += 0.86) x.fillRect(ex + (t === 'sport' ? 2.2 : 0.2), i, 6.8, 0.32); }
  rr(x, ex - 2, ey - 2.2, 11, 5.8, 1.6, gloss(x, ey - 2.2, 5.8, dark('#5e6068'))); ell(x, ex + 1.2, ey + 0.8, 2.4, 2.4, metal(x, ey - 1.6, ey + 3.2, dark('#d0d4dc'), dark('#6a6e76'))); ell(x, ex + 6.2, ey + 0.6, 1.5, 1.5, dark('#8a8e96'));
  if (!chop && t !== 'touring' && !burnt) { rr(x, ex + 8.4, ey - 8, 1.4, 6, 0.3, '#17171a'); x.fillStyle = '#3e3e46'; for (let i = ey - 7.6; i < ey - 2.4; i += 0.6) x.fillRect(ex + 8.5, i, 1.2, 0.24); }
  // the frame
  const headX = fx - (chop ? 13 : 8.4), headY = gy - (chop ? 17.6 : 18.6), seatX = rx + (chop ? 8 : 6.8), seatY = gy - (chop ? 13.6 : 16.4);
  seg(x, dark('#34343a'), 1, seatX, seatY, headX, headY); seg(x, dark('#34343a'), 1, seatX + 1, seatY + 2, ex, ey - 1); seg(x, dark('#34343a'), 1, headX, headY, ex + 7, ey + 2);
  // exhaust
  const pc = burnt ? '#3e3a36' : '#d0d4dc'; if (chop) { seg(x, pc, 1.3, ex + 4, ey - 7, ex + 1, ey + 3, rx - 4, axl + 1.2); seg(x, pc, 1.3, ex + 2, ey - 4, ex - 2, ey + 4.4, rx - 3, axl + 3); }
  else { seg(x, pc, 0.9, ex + 8, ey - 3, ex + 9, ey + 3.4, ex + 1, ey + 4.6, px - 5, axl + 0.4); x.save(); x.translate(rx + 1.4, axl - 1.6); x.rotate(t === 'sport' ? -0.36 : -0.12); rr(x, -1, -1.2, t === 'sport' ? 8 : 10, 2.4, 1, metal(x, -1.2, 1.2, burnt ? '#5a544e' : '#d8dce4', burnt ? '#26221f' : '#6a6e76')); ell(x, -0.8, 0, 0.5, 1, '#0a0a0c'); x.restore(); }
  // seat and tail
  if (burnt) { for (let i = 0; i < 5; i++) seg(x, '#141210', 0.26, seatX - 3 + i * 1.8, seatY - 0.4, seatX - 2.4 + i * 1.8, seatY - 1.6); seg(x, '#3a3532', 0.44, seatX - 5, seatY - 1, seatX + 7, seatY - 1.4); }
  else if (t === 'sport') { poly(x, gloss(x, seatY - 4, 5, b), rx - 2.2, seatY - 3.8, seatX + 2, seatY - 1.8, seatX + 3, seatY + 1, rx + 2, seatY); rr(x, seatX - 2.6, seatY - 2.4, 9.4, 1.8, 0.8, gloss(x, seatY - 2.4, 1.8, '#242226')); ell(x, rx - 2.2, seatY - 3.2, 0.5, 0.7, '#e0282a'); }
  else if (t === 'touring') { rr(x, rx - 5.6, seatY - 5, 8, 5.6, 1, gloss(x, seatY - 5, 5.6, sh(b, 0.72))); rr(x, rx - 2.6, seatY + 1, 8.4, 5.4, 0.9, gloss(x, seatY + 1, 5.4, sh(b, 0.85))); rr(x, seatX - 2.4, seatY - 2.6, 10.4, 2.2, 1, gloss(x, seatY - 2.6, 2.2, '#2a2628')); }
  else if (chop) { rr(x, seatX - 3.2, seatY - 1.6, 8.8, 1.9, 0.9, gloss(x, seatY - 1.6, 1.9, '#2c2420')); seg(x, '#c8ccd2', 0.6, seatX - 3, seatY - 1, seatX - 5.4, seatY - 8); x.strokeStyle = gloss(x, axl - 8, 8, b); x.lineWidth = 1.4; x.beginPath(); x.arc(rx, axl, rw + 0.9, Math.PI * 1.04, Math.PI * 1.7); x.stroke(); }
  else { rr(x, seatX - 2.4, seatY - 2, 8.8, 1.9, 0.9, gloss(x, seatY - 2, 1.9, '#242226')); poly(x, gloss(x, seatY - 3, 3, sh(b, 0.86)), seatX - 2.6, seatY - 2, rx - 1, seatY - 3, rx - 1, seatY - 2, seatX - 1.6, seatY); ell(x, rx - 1, seatY - 2.5, 0.4, 0.5, '#e0282a'); }
  // the tank
  const tx = seatX + 5.6, tl = headX - tx + 1.6, ty = headY + 0.4;
  x.fillStyle = gloss(x, ty - 2.4, 5.8, b); x.beginPath(); x.moveTo(tx, ty + 2.8); x.quadraticCurveTo(tx + 1, ty - 2.6, tx + tl * 0.7, ty - 2.3); x.quadraticCurveTo(tx + tl, ty - 2, tx + tl, ty + 0.8); x.quadraticCurveTo(tx + tl * 0.5, ty + 3.4, tx, ty + 2.8); x.fill();
  if (burnt) { for (let i = 0; i < 6; i++) ell(x, tx + r() * tl, ty - 1 + r() * 3, 0.5 + r(), 0.35, 'rgba(120,70,38,0.7)'); ell(x, tx + tl * 0.6, ty, 1.5, 0.8, '#121010'); } else ell(x, tx + tl * 0.5, ty - 1, tl * 0.3, 0.45, 'rgba(255,255,255,0.46)');
  // the fork: raked from the head to the axle; burnt, bent in the middle
  const midX = (headX + 1.6 + fx) / 2 + (burnt ? 1.6 : 0), midY = (headY - 1 + fax) / 2 - (burnt ? 1.2 : 0);
  seg(x, burnt ? '#4a4542' : '#d8dce4', 1, headX + 1.6, headY - 1, midX, midY, fx, fax); if (!burnt) seg(x, '#1e1e22', 1.3, (headX + fx) / 2 + 1, (headY + fax) / 2, fx, fax);
  wheel(fx, fax, fw);
  if (!burnt) { ell(x, fx, fax, 3.2, 3.2, metal(x, fax - 3.2, fax + 3.2, '#c8ccd2', '#7a7e86')); ell(x, fx, fax, 2.4, 2.4, 'rgba(30,30,34,0.4)'); ell(x, fx, fax, 0.9, 0.9, '#36363c'); x.strokeStyle = gloss(x, fax - 8, 8, b); x.lineWidth = 1; x.beginPath(); x.arc(fx, fax, fw + 0.6, Math.PI * 1.15, Math.PI * 1.75); x.stroke(); }
  // the front: fairing, screen, light; the bars turned as they fall; a mirror snapped off
  const gripX = headX + (chop ? 1 : 2.4), gripY = headY - (chop ? 7.4 : 3.2);
  if (burnt) {   // what the fire left: a shard of the fairing, the bar bent back, no glass
    if (t === 'sport' || t === 'touring') { poly(x, '#1c1a18', headX + 3, headY + 1, headX + 6, headY + 2, headX + 7.6, headY + 6.4, headX + 4.4, headY + 8, headX + 5, headY + 4.4); poly(x, '#2a2624', headX - 0.8, headY + 5, headX + 2.8, headY + 6.4, headX + 1.4, headY + 9.6); }
    seg(x, '#5a544e', 0.8, headX + 1, headY - 1, gripX + 0.8, gripY + 0.6, gripX - 3.4, gripY + 3); ell(x, headX + 3.6, headY - 0.2, 0.9, 1.1, '#141210');
  } else {
    if (t === 'sport') { poly(x, gloss(x, headY - 3, 14, b), headX - 1, headY - 2, headX + 5.6, headY - 3.6, headX + 7.4, headY + 1, headX + 6, headY + 6, headX + 1, headY + 10, headX - 4.4, headY + 9.6, headX - 1, headY + 4); poly(x, 'rgba(150,200,225,0.8)', headX + 0.4, headY - 3, headX + 2, headY - 6.4, headX + 5.8, headY - 3.8); ell(x, headX + 6.4, headY + 0.6, 0.9, 1.2, '#fff6d0'); }
    else if (t === 'touring') { poly(x, gloss(x, headY - 3, 12, b), headX - 1, headY - 2, headX + 5, headY - 3, headX + 6.6, headY + 2, headX + 3, headY + 8, headX - 3.4, headY + 6); poly(x, 'rgba(170,215,235,0.72)', headX, headY - 2.6, headX + 0.6, headY - 9.6, headX + 4.6, headY - 3); ell(x, headX + 5.6, headY + 0.8, 1, 1.4, '#fff6d0'); }
    else { ell(x, headX + 4.2, headY + 0.2, 1.8, 1.9, metal(x, headY - 2, headY + 2.2)); ell(x, headX + 4.9, headY + 0.2, 0.8, 1.4, '#fff6d0'); }
    seg(x, '#b8bcc4', 0.72, headX + 1.2, headY - 1, gripX, gripY); rr(x, gripX - 2.6, gripY - 0.7, 3, 1.3, 0.4, '#141416'); seg(x, '#8a8e96', 0.26, gripX - 0.2, gripY + 0.5, gripX - 2.8, gripY + 1.6);
    if (!chop) { seg(x, '#2a2a30', 0.3, gripX + 0.4, gripY, gripX + 1.8, gripY - 2); seg(x, '#2a2a30', 0.3, gripX + 2.6, gripY - 1, gripX + 3.4, gripY - 0.2); ell(x, gripX + 3.6, gripY + 0.1, 0.8, 0.6, '#1e1e24'); }   // the mirror, snapped at the stalk
  }
  // pegs and a kickstand left out
  seg(x, burnt ? '#2a2826' : '#242428', 0.7, ex - 1, ey + 3.6, ex - 3.4, ey + 3.8); if (!burnt) seg(x, '#3a3a40', 0.5, ex + 1.4, ey + 4, ex - 0.8, gy - 0.3);
  if (burnt) {   // soot over all of it, and the first rust
    x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(10,8,7,0.42)'; x.fillRect(0, 0, L, H);
    for (let i = 0; i < 26; i++) { x.fillStyle = i % 3 ? 'rgba(14,10,8,0.5)' : 'rgba(110,62,32,0.34)'; x.beginPath(); x.ellipse(r() * L, r() * H, 0.6 + r() * 2.4, 0.4 + r() * 1.2, r() * 3, 0, TAU); x.fill(); }
    x.restore();
  }
  return { c, W: L, H, ground: gy };
}

// ---------------------------------------------------------------- what is left of a car, from above, nose toward +x
function carWreck(model, seed) {
  const base = G.vehiclesHD.get(model); if (!base) return null;
  const W = base.width, H = base.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = dice(seed * 311 + model.length * 53 + 17);
  x.imageSmoothingEnabled = true;
  // crumpled: the body is redrawn strip by strip, pushed in here and there, the nose and tail crushed
  const step = 5, a = r() * 6, b = r() * 6;
  for (let i = 0; i < W; i += step) { const k = i / W, dy = (Math.sin(k * 9 + a) * 0.012 + Math.sin(k * 23 + b) * 0.008) * H + (r() - 0.5) * H * 0.006, end = Math.max(0, Math.abs(k - 0.5) - 0.36) * 2.4, sq = 1 - end * 0.5; x.drawImage(base, i, 0, step + 0.6, H, i, dy + H * (1 - sq) / 2, step + 0.6, H * sq); }
  const bite = (k0, dk, top2) => { x.globalCompositeOperation = 'destination-out'; x.beginPath(); const y0 = top2 ? 0 : H; x.moveTo(W * k0, y0); for (let i = 0; i <= 6; i++) x.lineTo(W * (k0 + dk * i / 6), top2 ? H * (0.03 + r() * 0.11) : H * (1 - 0.03 - r() * 0.11)); x.lineTo(W * (k0 + dk), y0); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-over'; };
  bite(0.1 + r() * 0.1, 0.16, true); bite(0.56 + r() * 0.12, 0.2, false);   // torn away along the sides
  x.globalCompositeOperation = 'source-atop';
  // burnt paint: nearly black, the shape of the panels still there, grey ash where it blistered, rust just starting at the edges
  x.fillStyle = 'rgba(14,12,11,0.72)'; x.fillRect(0, 0, W, H);
  const soft = (X, Y, q, col, al) => { const g = x.createRadialGradient(X, Y, 0, X, Y, q); g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.save(); x.translate(X, Y); x.scale(1, 0.4 + r() * 0.7); x.translate(-X, -Y); x.beginPath(); x.arc(X, Y, q, 0, TAU); x.fill(); x.restore(); };
  for (let i = 0; i < 16; i++) soft(r() * W, r() * H, W * (0.05 + r() * 0.1), '124,120,114', 0.2);
  for (let i = 0; i < 12; i++) soft(r() * W, r() * H, W * (0.04 + r() * 0.08), '4,3,3', 0.7);
  for (let i = 0; i < 9; i++) soft(r() * W, r() < 0.5 ? H * (0.08 + r() * 0.1) : H * (0.82 + r() * 0.1), W * (0.02 + r() * 0.04), '92,50,26', 0.42);
  for (let i = 0; i < 420; i++) { const X = r() * W, Y = r() * H, q = W * 0.0016 * (1 + r() * 2); x.fillStyle = i % 4 ? 'rgba(6,5,5,0.6)' : i % 8 ? 'rgba(150,146,140,0.3)' : 'rgba(120,66,34,0.5)'; x.fillRect(X, Y, q, q); }
  for (let i = 0; i < 22; i++) { const X = r() * W, Y = r() * H; x.strokeStyle = i % 2 ? 'rgba(170,166,160,0.26)' : 'rgba(0,0,0,0.5)'; x.lineWidth = W * 0.0022; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + (r() - 0.5) * W * 0.06, Y + (r() - 0.5) * H * 0.1, X + (r() - 0.5) * W * 0.11, Y + (r() - 0.5) * H * 0.2); x.stroke(); }
  // no glass: black holes with a jagged edge where the screens were, seat frames just visible through them
  const hole = (X0, X1, Y0, Y1, bow) => { x.fillStyle = '#070606'; x.beginPath(); x.moveTo(W * X0, H * Y0); for (let i = 1; i <= 7; i++) x.lineTo(W * (X0 + (X1 - X0) * (i % 2 ? 0.1 + r() * 0.1 : 0)), H * (Y0 + (Y1 - Y0) * i / 7)); x.lineTo(W * X1, H * (Y1 - bow)); for (let i = 7; i >= 0; i--) x.lineTo(W * (X1 - (X1 - X0) * (i % 2 ? 0.1 + r() * 0.12 : 0)), H * (Y0 + bow + (Y1 - Y0 - bow * 2) * i / 7)); x.closePath(); x.fill(); };
  hole(0.585, 0.695, 0.2, 0.8, 0.05); hole(0.2, 0.285, 0.24, 0.76, 0.04);
  x.strokeStyle = '#3e3834'; x.lineWidth = W * 0.0034; for (const Y of [0.34, 0.66]) { x.beginPath(); x.moveTo(W * 0.6, H * (Y - 0.09)); x.lineTo(W * 0.655, H * (Y - 0.1)); x.lineTo(W * 0.655, H * (Y + 0.1)); x.lineTo(W * 0.6, H * (Y + 0.09)); x.stroke(); }
  x.beginPath(); x.ellipse(W * 0.668, H * 0.34, W * 0.012, H * 0.075, 0, 0, TAU); x.stroke();   // what is left of the steering wheel
  for (const Y of [0.135, 0.865]) { x.fillStyle = 'rgba(5,5,5,0.86)'; for (const [p, q] of [[0.32, 0.43], [0.46, 0.57]]) x.fillRect(W * p, H * (Y - 0.018), W * (q - p), H * 0.036); }   // side windows
  // the bonnet gone: a dark bay, the block in it, pipes hanging, the radiator at the front
  const bay = (X0, X1, Y0, Y1) => { x.fillStyle = '#0a0908'; x.beginPath(); x.moveTo(W * X0, H * Y0); for (let i = 1; i <= 6; i++) x.lineTo(W * (X0 + (X1 - X0) * i / 6), H * (Y0 + r() * 0.035)); for (let i = 6; i >= 0; i--) x.lineTo(W * (X0 + (X1 - X0) * i / 6), H * (Y1 - r() * 0.035)); x.closePath(); x.fill(); };
  bay(0.735, 0.925, 0.17, 0.83);
  const block = x.createLinearGradient(0, H * 0.34, 0, H * 0.66); block.addColorStop(0, '#34302c'); block.addColorStop(0.5, '#5a544e'); block.addColorStop(1, '#221f1c'); x.fillStyle = block; x.fillRect(W * 0.77, H * 0.34, W * 0.1, H * 0.32);
  x.fillStyle = 'rgba(10,9,8,0.8)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(W * (0.785 + i * 0.024), H * 0.5, W * 0.0085, 0, TAU); x.fill(); }
  x.strokeStyle = '#4a4440'; x.lineWidth = W * 0.0042; x.beginPath(); x.moveTo(W * 0.77, H * 0.36); x.quadraticCurveTo(W * 0.75, H * 0.24, W * 0.89, H * 0.25); x.moveTo(W * 0.8, H * 0.66); x.quadraticCurveTo(W * 0.85, H * 0.78, W * 0.9, H * 0.72); x.stroke();
  x.fillStyle = '#2c2520'; x.fillRect(W * 0.895, H * 0.25, W * 0.018, H * 0.5); x.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 12; i++) x.fillRect(W * 0.895, H * (0.26 + i * 0.04), W * 0.018, H * 0.012);
  x.globalCompositeOperation = 'destination-over';
  // burnt wheels on bare rims, under what is left
  for (const X of [0.2, 0.78]) for (const Y of [0.1, 0.9]) { x.fillStyle = '#100e0d'; x.fillRect(W * (X - 0.055), H * (Y - 0.035), W * 0.11, H * 0.07); x.fillStyle = '#4a4542'; x.fillRect(W * (X - 0.055), H * (Y - 0.006), W * 0.11, H * 0.012); }
  x.globalCompositeOperation = 'source-over';
  return c;
}
const cache = {};
const scorch = (ctx, a, b) => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a); g.addColorStop(0, 'rgba(6,5,5,0.62)'); g.addColorStop(0.68, 'rgba(10,8,7,0.34)'); g.addColorStop(1, 'rgba(10,8,7,0)'); ctx.save(); ctx.scale(1, b / a); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, a, 0, TAU); ctx.fill(); ctx.restore(); };
const hash = (v) => Math.abs(Math.round((v.x || 0) * 3 + (v.angle || 0) * 11)) % 3;
const R = G.vehicleArt = {
  top, side, carWreck, typeOf,
  wreckOf(model, seed = 0) { const k = model + '|' + seed; return k in cache ? cache[k] : (cache[k] = carWreck(model, seed)); },
  sideOf(m, burnt) { const k = 's' + (m.id || m.body + m.len) + (burnt ? 'b' : ''); return cache[k] || (cache[k] = side(m, burnt)); },
  // a motorcycle lying on its side; k is how far down it has come. The side that faces up is seen, flat on the ground.
  drawLying(ctx, v, k, burnt) {
    const s = this.sideOf(v.m, burnt), f = v.fallSide || 1;
    ctx.save(); ctx.translate(Math.round(v.x), Math.round(v.y)); ctx.rotate(v.angle);
    if (burnt) scorch(ctx, s.W * 0.66, s.H * 0.62);
    ctx.scale(1, f * k); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const y0 = -s.ground * 0.5 - 1;   // the wheels' centreline sits on the point where the bike came to rest
    ctx.save(); ctx.globalAlpha = 0.34; ctx.filter = 'brightness(0)'; ctx.drawImage(s.c, -s.W / 2 + 0.7, y0 + 0.9, s.W, s.H); ctx.restore();   // its shadow, tight under it: it lies on the ground, it does not float
    ctx.drawImage(s.c, -s.W / 2, y0, s.W, s.H);
    ctx.restore(); ctx.imageSmoothingEnabled = false;
  },
  drawWreck(ctx, v) {
    if (v.m.moto) { v.fallSide = v.fallSide || (hash(v) % 2 ? 1 : -1); this.drawLying(ctx, v, 1, true); return this.smoke(ctx, v); }
    const img = this.wreckOf(v.model, hash(v)), spr = A.sprites['veh_' + v.model]; if (!img || !spr) return undefined;
    ctx.save(); ctx.translate(Math.round(v.x * 2) / 2, Math.round(v.y * 2) / 2); ctx.rotate(v.angle); scorch(ctx, spr.w * 0.68, spr.h * 0.95);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, -spr.w / 2, -spr.h / 2, spr.w, spr.h); ctx.imageSmoothingEnabled = false; ctx.restore();
    return this.smoke(ctx, v);
  },
  smoke(ctx, v) { if (Math.random() < 0.02) { ctx.fillStyle = 'rgba(70,70,70,0.4)'; ctx.beginPath(); ctx.arc(v.x, v.y - 6 - (G.loop.time * 20) % 20, 3, 0, TAU); ctx.fill(); } },
};
// a bike on the ground is the real thing; a bicycle keeps its own
const C = G.crashes || null, DF = C && C.drawFallen;
if (C) C.drawFallen = function (ctx, v, k) { if (v.m.bike) return DF.call(this, ctx, v, k); return R.drawLying(ctx, v, k, !!v.burnt); };
// a burnt vehicle is the wreck, whatever else would draw it (the last word on drawing a vehicle, so this loads after all of them)
const VP = G.Vehicle.prototype, _vd = VP.draw;
VP.draw = function (ctx) { if (this.burnt && !this.m.bike) return R.drawWreck(ctx, this); return _vd.call(this, ctx); };
// the old wrecks that stand around the world are burnt-out cars like any other
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  if (o.type !== 'car_wreck') return _dd.call(this, ctx, o, s, scene);
  const img = R.wreckOf(['car_gray', 'car_blue', 'car_black'][o.tx % 3], o.ty % 3); if (!img) return _dd.call(this, ctx, o, s, scene);
  const smooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(img, Math.round(o.x - s.ax), Math.round(o.y - s.ay), s.w, s.h); ctx.imageSmoothingEnabled = smooth;
  return undefined;
};
})();
