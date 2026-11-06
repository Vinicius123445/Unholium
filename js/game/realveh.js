'use strict';
// Vehicles as they look from above: painted at four times the density of the world, with paint that catches the sky, glass
// you can almost see through, seams, mirrors and lights. Sizes are real: a car is about 3.7 m long next to a 1.7 m person.
// Motorcycles and bicycles keep their own drawing (js/game/vehicleshd.js).
(() => {
const D = 4, A = G.assets, sh = A.shade, _old = G.vehiclesHD.get;
const cache = {};
// real sizes, in the world and as parked pieces. pfw: the footprint in the plan a map is generated from
// (at 20 pixels to the metre: a car is 3.7 m by 1.6 m, and never wider than the two tiles a narrow street gives it)
const LONG = 2.6, WIDE = 2.3;
for (const id in G.vehicles.MODELS) { const m = G.vehicles.MODELS[id]; if (m.moto || m.bike) { m.len = Math.round(m.len * 1.5); m.wid = Math.round(m.wid * 1.5); } else { m.len = Math.round(m.len * LONG); m.wid = Math.min(46, Math.round(m.wid * WIDE)); } }
const PARKED = Object.keys(G.DECOR).filter((k) => /^car_|^police_car$|^limo$/.test(k));
const longOf = (k, d) => (G.vehicles.MODELS[k] ? Math.ceil(G.vehicles.MODELS[k].len / 16) : Math.ceil(d.pfw * LONG));   // (the ground it stands on fits the car)
for (const k of PARKED) { const d = G.DECOR[k]; d.pfw = d.fw || 1; d.fw = longOf(k, d); d.fh = 2; }
G.parkedPlan = (plan) => { for (const k of PARKED) { const d = G.DECOR[k]; d.fw = plan ? d.pfw : longOf(k, d); d.fh = plan ? 1 : 2; } for (const k of G.realFurn.BEDS) { const d = G.DECOR[k]; if (d && d.pfh) { d.fh = plan ? d.pfh : 2; if (d.pfw) d.fw = plan ? d.pfw : 2; } } };
const _init = A.init;
A.init = function () {
  _init.call(this);
  for (const k of PARKED) { const s = A.sprites[G.DECOR[k].sprite]; if (!s || s.big || s.w > 40) continue; const c = document.createElement('canvas'); c.width = s.w * LONG; c.height = s.h * WIDE; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(s.img, 0, 0, c.width, c.height); s.img = c; s.w = c.width; s.h = c.height; s.ax = Math.round(s.ax * LONG); s.ay = Math.round(s.ay * WIDE); s.big = true; }
};

const across = (x, Y, H, stops) => { const g = x.createLinearGradient(0, Y, 0, Y + H); for (const [t, c] of stops) g.addColorStop(t, c); return g; };
const along = (x, X, W, stops) => { const g = x.createLinearGradient(X, 0, X + W, 0); for (const [t, c] of stops) g.addColorStop(t, c); return g; };

const glass = (x, X, Y, W, H, r = 8) => { round(x, X, Y, W, H, r); const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#26343e'); g.addColorStop(0.45, '#56707e'); g.addColorStop(0.55, '#8aa2ae'); g.addColorStop(0.7, '#2e3e4a'); g.addColorStop(1, '#141c24'); x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.65)'; x.lineWidth = 2; x.stroke(); };

// Body plans, nose toward +x. Lengths are fractions of the car: where the bonnet ends, how far the windscreen rakes, the roof, the tail.
const PLAN = {
  sedan: { hood: 0.70, screen: 0.13, roof: 0.30, rear: 0.09, boot: true },
  coupe: { hood: 0.68, screen: 0.15, roof: 0.22, rear: 0.13, boot: true },
  hatch: { hood: 0.72, screen: 0.14, roof: 0.42, rear: 0.07 },
  suv: { hood: 0.74, screen: 0.10, roof: 0.52, rear: 0.05, rails: true },
  pickup: { hood: 0.74, screen: 0.10, roof: 0.14, rear: 0.03, bed: true },
  limo: { hood: 0.80, screen: 0.07, roof: 0.56, rear: 0.05, boot: true },
};
const STYLE = { car_red: 'coupe', car_blue: 'sedan', car_white: 'hatch', car_gray: 'sedan', car_black: 'suv', car_green: 'pickup', police_car: 'sedan', limo: 'limo', taxi: 'sedan' };
const poly = (x, pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); };
const pane = (x, pts) => { poly(x, pts); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), g = x.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); g.addColorStop(0, '#1e2a34'); g.addColorStop(0.42, '#46606e'); g.addColorStop(0.52, '#8ca4b0'); g.addColorStop(0.66, '#28363f'); g.addColorStop(1, '#10161c'); x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 1.6; x.stroke(); };
// The outline of each body, tail to nose: how far along, how wide there. Straight runs and real corners; a car is not a pill.
const SHAPE = {
  sedan: [[0, 0.72], [0.018, 0.86], [0.07, 0.93], [0.2, 0.96], [0.5, 0.985], [0.78, 0.965], [0.9, 0.93], [0.975, 0.84], [1, 0.66]],
  coupe: [[0, 0.68], [0.03, 0.87], [0.1, 0.97], [0.24, 1], [0.44, 0.945], [0.6, 0.955], [0.8, 0.965], [0.93, 0.9], [0.985, 0.74], [1, 0.54]],
  hatch: [[0, 0.8], [0.02, 0.91], [0.12, 0.965], [0.5, 0.98], [0.82, 0.96], [0.95, 0.88], [1, 0.7]],
  suv: [[0, 0.86], [0.014, 0.955], [0.1, 0.99], [0.86, 0.99], [0.965, 0.95], [1, 0.8]],
  pickup: [[0, 0.9], [0.01, 0.96], [0.36, 0.965], [0.4, 0.99], [0.86, 0.99], [0.97, 0.94], [1, 0.78]],
  limo: [[0, 0.74], [0.03, 0.9], [0.09, 0.96], [0.9, 0.96], [0.975, 0.86], [1, 0.64]],
};
function car(id, m) {
  const pad = 14, L = m.len * D, W = m.wid * D, c = document.createElement('canvas'); c.width = L + pad * 2; c.height = W + pad * 2;
  const x = c.getContext('2d'); x.translate(pad, pad); x.lineJoin = 'miter';
  const truck = /fire|ambulance/.test(id), b = m.body, style = STYLE[id] || 'sedan', P = PLAN[style], cab = m.cab || b, cy = W / 2, seam = 'rgba(0,0,0,0.46)';
  const shape = SHAPE[truck ? 'suv' : style], half = (t) => { let i = 0; while (i < shape.length - 2 && shape[i + 1][0] < t) i++; const [a, u] = shape[i], [e, v] = shape[i + 1]; return (u + (v - u) * (t - a) / (e - a)) * (W / 2 - 2); };
  const up = (t, k = 1) => [t * L, cy - half(t) * k], dn = (t, k = 1) => [t * L, cy + half(t) * k];
  const hull = shape.map(([t]) => up(t)).concat(shape.slice().reverse().map(([t]) => dn(t)));
  // tyres just proud of the arches, tread showing
  const ax = truck ? [0.18, 0.76] : style === 'limo' ? [0.12, 0.85] : [0.17, 0.79], tl = L * (truck ? 0.1 : 0.125);
  for (const t of ax) for (const sd of [-1, 1]) { const hw = half(t), ty = sd < 0 ? cy - hw - 2.4 : cy + hw - 3.6; x.fillStyle = '#0e0e10'; x.fillRect(t * L - tl / 2, ty, tl, 6); x.fillStyle = '#26262a'; for (let k = 3; k < tl; k += 5) x.fillRect(t * L - tl / 2 + k, ty, 1.4, 6); }
  poly(x, hull); x.fillStyle = across(x, 0, W, [[0, sh(b, 0.42)], [0.06, sh(b, 0.74)], [0.13, sh(b, 1.18)], [0.2, sh(b, 1.04)], [0.5, sh(b, 0.96)], [0.8, sh(b, 1.02)], [0.88, sh(b, 1.1)], [0.94, sh(b, 0.72)], [1, sh(b, 0.4)]]); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.86)'; x.lineWidth = 1.8; x.stroke();
  x.save(); poly(x, hull); x.clip();
  x.fillStyle = along(x, 0, L, [[0, 'rgba(0,0,0,0.3)'], [0.07, 'rgba(0,0,0,0)'], [0.93, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]); x.fillRect(0, 0, L, W);
  // the arches cut into the shoulders
  for (const t of ax) for (const sd of [-1, 1]) { x.fillStyle = 'rgba(0,0,0,0.34)'; x.beginPath(); x.ellipse(t * L, cy + sd * half(t), L * 0.082, W * 0.055, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1; x.beginPath(); x.ellipse(t * L, cy + sd * half(t), L * 0.09, W * 0.075, 0, 0, 6.3); x.stroke(); }
  x.restore();
  if (truck) {
    const cb = L * 0.74;
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(cb, 4, 2.4, W - 8);
    pane(x, [[cb + L * 0.1, W * 0.14], [cb + L * 0.19, W * 0.2], [cb + L * 0.19, W * 0.8], [cb + L * 0.1, W * 0.86]]);
    x.strokeStyle = seam; x.lineWidth = 1.2; x.strokeRect(5, 6, cb - 10, W - 12);
    if (id === 'ambulance') { x.fillStyle = '#c82828'; x.fillRect(6, W * 0.44, cb - 12, W * 0.12); x.fillRect(cb * 0.5 - 6, W * 0.24, 12, W * 0.52); x.fillStyle = 'rgba(40,60,80,0.5)'; x.fillRect(10, W * 0.1, cb - 20, 3); x.fillRect(10, W * 0.9 - 3, cb - 20, 3); }
    else { x.fillStyle = '#c4c8d0'; x.fillRect(14, W * 0.36, cb - 30, 5); x.fillRect(14, W * 0.6, cb - 30, 5); for (let i = 20; i < cb - 20; i += 13) x.fillRect(i, W * 0.36, 2.4, W * 0.29); x.fillStyle = '#d8b030'; x.fillRect(8, W * 0.1, cb - 16, 3); x.fillRect(8, W * 0.9 - 3, cb - 16, 3); }
    x.fillStyle = '#16161a'; x.fillRect(cb + 3, W * 0.17, 11, W * 0.66); x.fillStyle = '#e02020'; x.fillRect(cb + 4.5, W * 0.2, 8, W * 0.27); x.fillStyle = '#2858e8'; x.fillRect(cb + 4.5, W * 0.53, 8, W * 0.27);
  } else {
    // from the nose back: bonnet, raked screen, roof, rear glass, boot or bed. The pillars lean in; every pane has real corners
    const hood = P.hood, sc = hood - P.screen, ro = sc - P.roof, rr = ro - P.rear, base = 0.8, roofK = style === 'suv' ? 0.72 : style === 'coupe' ? 0.6 : 0.66, ye = (t, k) => [t * L, cy - half(t) * k], ys = (t, k) => [t * L, cy + half(t) * k];
    // the bonnet: its shut line, two creases running to the lamps, a raised middle on the fast ones
    x.strokeStyle = seam; x.lineWidth = 1; x.beginPath(); x.moveTo(...ye(hood, 0.84)); x.lineTo(...ye(0.965, 0.72)); x.lineTo(...ys(0.965, 0.72)); x.lineTo(...ys(hood, 0.84)); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 1; x.beginPath(); x.moveTo(...ye(hood + 0.02, 0.5)); x.lineTo(...ye(0.95, 0.38)); x.moveTo(...ys(hood + 0.02, 0.5)); x.lineTo(...ys(0.95, 0.38)); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.moveTo(...ye(hood + 0.02, 0.54)); x.lineTo(...ye(0.95, 0.42)); x.moveTo(...ys(hood + 0.02, 0.54)); x.lineTo(...ys(0.95, 0.42)); x.stroke();
    if (style === 'coupe') { x.fillStyle = 'rgba(0,0,0,0.5)'; for (const sd of [-1, 1]) { poly(x, [[0.78 * L, cy + sd * W * 0.1], [0.86 * L, cy + sd * W * 0.08], [0.86 * L, cy + sd * W * 0.14], [0.78 * L, cy + sd * W * 0.17]]); x.fill(); } }
    // the windscreen and the rear glass
    pane(x, [ye(hood, base), ye(sc, roofK), ys(sc, roofK), ys(hood, base)]);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(hood * L - 2, cy + W * 0.02); x.lineTo(hood * L - 8, cy - W * 0.2); x.moveTo(hood * L - 2, cy + W * 0.26); x.lineTo(hood * L - 8, cy + W * 0.04); x.stroke();   // wipers
    if (!P.bed) pane(x, [ye(ro, roofK), ye(rr, base - 0.04), ys(rr, base - 0.04), ys(ro, roofK)]);
    // side glass, cut by the pillars
    for (const sd of [-1, 1]) {
      const pts = (t0, t1) => { const a = sd < 0 ? ye : ys; return [a(t0, 0.9), a(t1, 0.9), a(t1, roofK + 0.05), a(t0 + 0.012, roofK + 0.05)]; };
      const n = style === 'limo' ? 4 : style === 'coupe' || P.bed ? 1 : 2, t0 = ro + 0.01, t1 = sc + 0.03;
      for (let i = 0; i < n; i++) pane(x, pts(t0 + (t1 - t0) * i / n + (i ? 0.012 : 0), t0 + (t1 - t0) * (i + 1) / n));
    }
    // the roof: a plain sheet, sharply edged, lit along one side
    poly(x, [ye(sc, roofK), ye(ro, roofK), ys(ro, roofK), ys(sc, roofK)]); x.fillStyle = across(x, cy - half(0.5) * roofK, half(0.5) * roofK * 2, [[0, sh(cab, 0.8)], [0.22, sh(cab, 1.28)], [0.6, sh(cab, 1.04)], [1, sh(cab, 0.74)]]); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.62)'; x.lineWidth = 1.1; x.stroke();
    if (id === 'car_blue' || id === 'car_black') { const r0 = ro + P.roof * 0.32, r1 = sc - P.roof * 0.12; pane(x, [ye(r1, roofK * 0.62), ye(r0, roofK * 0.62), ys(r0, roofK * 0.62), ys(r1, roofK * 0.62)]); }
    if (P.rails) { x.fillStyle = '#26262a'; for (const sd of [-1, 1]) { x.fillRect(ro * L + 4, cy + sd * half(0.5) * roofK * 0.88 - 1.2, (sc - ro) * L - 8, 2.4); } x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 1; for (let t = ro + 0.06; t < sc - 0.02; t += 0.07) { x.beginPath(); x.moveTo(...ye(t, roofK * 0.7)); x.lineTo(...ys(t, roofK * 0.7)); x.stroke(); } }
    if (P.bed) {
      const e = (rr - 0.02) * L, y0 = cy - half(0.2) * 0.8, h = half(0.2) * 1.6;
      x.fillStyle = '#17181b'; x.fillRect(8, y0, e - 8, h); x.strokeStyle = sh(b, 0.66); x.lineWidth = 2.2; x.strokeRect(8, y0, e - 8, h);
      x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 1.2; for (let i = y0 + 6; i < y0 + h - 3; i += 7) { x.beginPath(); x.moveTo(11, i); x.lineTo(e - 3, i); x.stroke(); }
      x.fillStyle = '#2a2b30'; x.fillRect(e + 1, y0 - 1, 3, h + 2);                                                                  // the bar behind the cab
      x.strokeStyle = seam; x.lineWidth = 1; x.strokeRect(1.5, y0, 4, h);                                                            // the tailgate
    }
    if (P.boot) { x.strokeStyle = seam; x.lineWidth = 1; x.beginPath(); x.moveTo(...ye(rr - 0.015, 0.84)); x.lineTo(...ye(0.03, 0.72)); x.lineTo(...ys(0.03, 0.72)); x.lineTo(...ys(rr - 0.015, 0.84)); x.stroke(); }
    if (style === 'coupe') { x.fillStyle = sh(b, 0.56); x.fillRect(0.045 * L, cy - W * 0.36, 3.4, W * 0.72); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0.045 * L + 2.2, cy - W * 0.36, 1, W * 0.72); }
    if (id === 'police_car') {
      x.fillStyle = '#e8e4dc'; for (const sd of [-1, 1]) { poly(x, [[ro * L, cy + sd * half(0.5) * 0.98], [sc * L, cy + sd * half(0.5) * 0.98], [sc * L, cy + sd * half(0.5) * 0.92], [ro * L, cy + sd * half(0.5) * 0.92]]); x.fill(); }
      const lx = (ro + sc) / 2 * L - 5; x.fillStyle = '#121216'; x.fillRect(lx, cy - W * 0.3, 10, W * 0.6); x.fillStyle = '#e02020'; x.fillRect(lx + 1.5, cy - W * 0.28, 7, W * 0.26); x.fillStyle = '#2858e8'; x.fillRect(lx + 1.5, cy + W * 0.02, 7, W * 0.26);
      x.fillStyle = '#1a1a1e'; x.fillRect(L - 2, cy - W * 0.34, 4, W * 0.68);   // the push bar
    }
    if (id === 'taxi') { x.fillStyle = '#16161a'; x.fillRect((ro + sc) / 2 * L - 4, cy - W * 0.13, 8, W * 0.26); x.fillStyle = '#f8e070'; x.fillRect((ro + sc) / 2 * L - 2.6, cy - W * 0.11, 5.2, W * 0.22); }
    // doors: shut lines down the flanks, a handle on each
    const doors = style === 'coupe' || P.bed ? [sc + 0.02, ro + 0.01] : style === 'limo' ? [sc + 0.02, sc - P.roof * 0.4, ro + P.roof * 0.3, ro + 0.01] : [sc + 0.03, (sc + ro) / 2 + 0.01, ro + 0.01];
    x.lineWidth = 1;
    for (const t of doors) for (const sd of [-1, 1]) { const a = sd < 0 ? ye : ys; x.strokeStyle = seam; x.beginPath(); x.moveTo(...a(t, 0.99)); x.lineTo(...a(t, 0.91)); x.stroke(); x.fillStyle = 'rgba(232,232,236,0.6)'; x.fillRect(t * L - 8, cy + sd * half(t) * 0.955 - 0.6, 4.6, 1.2); }
    // mirrors: wedges on short stalks at the foot of the pillar, the glass facing back
    for (const sd of [-1, 1]) { const t = hood - 0.035, y0 = cy + sd * half(t) * 0.96, y1 = y0 + sd * 8; x.fillStyle = sh(b, 0.66); poly(x, [[t * L + 5, y0], [t * L + 1, y1 + sd * 1.4], [t * L - 4, y1 + sd * 1.4], [t * L - 3, y0 + sd * 3]]); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 0.8; x.stroke(); x.fillStyle = '#3a4a56'; x.fillRect(t * L - 4, y1 - sd * 2.6 - 1.4, 1.6, 4); }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(rr * L - 16 > 12 ? rr * L - 16 : 14, cy + half(0.3) * 0.93, 1.8, 0, 6.3); x.fill();   // the filler cap
  }
  // the face and the tail, sharp: bumpers in the paint, a dark intake, lamps cut into the corners, a plate
  const nose = L - 1, tail = 1;
  x.fillStyle = '#121316'; poly(x, [[nose - 3.4, cy - W * 0.3], [nose, cy - W * 0.26], [nose, cy + W * 0.26], [nose - 3.4, cy + W * 0.3]]); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.2)'; for (let k = -2; k <= 2; k++) x.fillRect(nose - 3, cy + k * W * 0.1 - 0.5, 3, 1);
  x.fillStyle = '#e8e4d8'; x.fillRect(nose - 1.2, cy - W * 0.05, 1.4, W * 0.1);
  for (const sd of [-1, 1]) {
    const t = 0.955, y0 = cy + sd * half(t) * 0.92, y1 = cy + sd * half(0.99) * 0.58;
    x.fillStyle = '#26262c'; poly(x, [[L * 0.925, y0], [nose - 1, y0 - sd * W * 0.03], [nose - 0.5, y1], [L * 0.955, y1 + sd * W * 0.04]]); x.fill();
    x.fillStyle = '#f8f4e4'; poly(x, [[L * 0.935, y0 - sd * 1.4], [nose - 2, y0 - sd * W * 0.05], [nose - 1.6, y1 + sd * 2.6], [L * 0.96, y1 + sd * W * 0.05]]); x.fill();
    x.strokeStyle = '#a8d8f0'; x.lineWidth = 1; x.beginPath(); x.moveTo(L * 0.93, y0 - sd * 0.6); x.lineTo(nose - 1.4, y0 - sd * W * 0.035); x.stroke();     // the running light
    const y2 = cy + sd * half(0.03) * 0.96, y3 = cy + sd * W * (style === 'suv' || style === 'coupe' ? 0.04 : 0.17);
    x.fillStyle = '#5a0a0c'; poly(x, [[tail, y2], [tail + 7, y2 + sd * 1], [tail + 4.6, y3], [tail, y3]]); x.fill();
    x.fillStyle = '#e02828'; x.fillRect(tail, Math.min(y2, y3), 2.4, Math.abs(y3 - y2));
  }
  x.fillStyle = '#d8d4c8'; x.fillRect(tail - 0.4, cy - W * 0.07, 1.6, W * 0.14);
  if (style === 'coupe' || style === 'sedan') { x.fillStyle = '#3a3a40'; for (const sd of [-1, 1]) x.fillRect(tail - 2.2, cy + sd * W * 0.24 - 1.6, 2.6, 3.2); }
  return c;
}
G.vehiclesHD.get = (model) => {
  const m = G.vehicles.MODELS[model]; if (!m) return null;
  if (m.moto || m.bike) return _old(model);
  return cache[model] || (cache[model] = car(model, m));
};
})();
