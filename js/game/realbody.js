'use strict';
// People in eight directions. A person is a small skeleton in three dimensions: joints are posed, turned to one of eight headings and
// projected into the game's camera, then skin and clothes are painted on, back to front. So a diagonal is a real turned body: the far
// shoulder goes behind, both eyes foreshorten on a three-quarter face, a cap's peak points where the head points. Nothing is flipped or
// rotated. Hips are solved from the legs, so a foot on the ground stays on the ground. Frames are painted on demand and kept in a cache
// of fixed size. Layout stays that of the old frame (32 by 44, feet at 43), so what other systems know about a frame is still true.
(() => {
const A = G.assets, sh = A.shade, mix = A.mix, R3 = 3, FW = 32, FH = 44, GROUND = 43, PITCH = 0.3, DEG = Math.PI / 180;
// 0 down, 1 left, 2 right, 3 up (as actor.dir), then 4 down-left, 5 down-right, 6 up-left, 7 up-right
const ANG = [0, -90, 90, 180, -45, 45, -135, 135].map((d) => d * DEG);
const EXPR = { none: 0, happy: 1, angry: 2, fear: 3, sad: 4, pain: 5, tired: 6, suspicious: 7 };
const dims = (L) => { const U = L.kid ? 0.74 : 1, fem = L.fem, wom = fem && !L.kid, bld = L.build === 2 ? 1 : L.build === 0 ? -1 : 0; return { U, fem, bld, thigh: 9.2 * U, shin: 8.8 * U, torso: 13.6 * U, neck: 1.5 * U, headR: (L.kid ? 4.3 : 3.6) * (1 + ((L.hash || 0) % 7 - 3) * 0.008), armU: 7.2 * U, armL: 6.8 * U, hipW: (wom ? 4 : fem ? 3.7 : 3.2) * U + bld * 0.3, shW: (wom ? 4 : fem ? 4.3 : 5.5) * U + bld * 0.5, chestD: (fem ? 2.9 : 3.2) * U + bld * 0.4, waistW: (wom ? 2.65 : fem ? 3.1 : 4.3) * U + bld * 0.7 }; };
const legOf = (pz, D, i) => { const a = pz.legA[i], b = a - pz.knee[i], kf = Math.sin(a) * D.thigh, ky = -Math.cos(a) * D.thigh; return { kf, ky, af: kf + Math.sin(b) * D.shin, ay: ky - Math.cos(b) * D.shin, out: pz.legOut ? pz.legOut[i] : 0 }; };
const armOf = (pz, D, i, hipY, shY, lean) => {
  const sg = i ? 1 : -1, tw = pz.twist || 0, s0 = sg * (D.shW + 0.2) * Math.cos(tw), lean0 = lean, t = pz.ik[i], { armU, armL } = D; lean = lean0 - sg * Math.sin(tw) * D.shW; let eF, eS, eY, hF, hS, hY;
  if (t) { hF = lean0 + t[0]; hS = t[1]; hY = hipY + (shY - hipY + D.headR * 2) * t[2]; const mf = (lean + hF) / 2, ms = (s0 + hS) / 2, my = (shY - 1.6 + hY) / 2, dist = Math.hypot(hF - lean, hS - s0, hY - shY + 0.9), reach = armU + armL, bend = Math.sqrt(Math.max(0, reach * reach - dist * dist)) * 0.42; eF = mf - bend * 0.25; eS = ms + sg * bend * 0.6; eY = my - bend * 0.64; }
  else { const a = pz.armA[i], e = pz.elbow[i]; eF = lean + Math.sin(a) * armU; eS = s0 + sg * 0.45; eY = shY - 1.6 - Math.cos(a) * armU; hF = eF + Math.sin(a + e) * armL; hS = eS - sg * 0.1; hY = eY - Math.cos(a + e) * armL; }
  return { s0, sf: lean, eF, eS, eY, hF, hS, hY };
};
const camera = (dir, fd, s, y) => { const th = ANG[dir], Fx = Math.sin(th), Fz = Math.cos(th), Sx = Math.cos(th), Sz = -Math.sin(th), X = s * Sx + fd * Fx, Z = s * Sz + fd * Fz; return { x: 16 + X, y: GROUND - y * 0.96 + Z * PITCH, z: Z }; };
// where things are in a frame, without painting it: what weapons, cigarettes and phones hang on
const SPACE = new Map();
const geom = (L, dir, col, opt) => {
  const key = (L.id || 0) + '|' + dir + '|' + col + '|' + (opt ? opt.q : 0); let g = SPACE.get(key); if (g) return g;
  const K = G.hd.KINDS[col] || ['idle', 0], pz = poseOf(K[0], K[1], L, opt), D = dims(L), l0 = legOf(pz, D, 0), l1 = legOf(pz, D, 1), low = Math.min(l0.ay, l1.ay), hipY = -low + 1.4 + (pz.swim ? 8 : 0), lean = pz.lean, shY = hipY + D.torso + pz.bob, headY = shY + D.neck + D.headR * 1.24 - (pz.neck || 0);
  const h = [0, 1].map((i) => { const a = armOf(pz, D, i, hipY, shY, lean), q = camera(dir, a.hF, a.hS, a.hY); return { x: q.x, y: q.y, z: q.z }; }), head = camera(dir, lean * 1.1, 0, headY), sh0 = camera(dir, lean, 0, shY);
  g = { hands: h, head, shoulderY: sh0.y, hx: head.x - 3.2, hy: head.y - D.headR * 1.2, hs: 0.86 }; if (SPACE.size > 6000) SPACE.clear(); SPACE.set(key, g); return g;
};

function poseOf(kind, f, L, opt) {
  const q = opt || {}, gentle = q.q === 1 ? 0.55 : 1, p = (f / 8) * Math.PI * 2, o = { legA: [0, 0], knee: [0.04, 0.04], armA: [0, 0], elbow: [0.18, 0.18], lean: 0, drop: 0, ik: [null, null], bob: 0, stance: 1 };
  if (G.body.MOVES && G.body.MOVES[kind]) return G.body.strike(kind, f, o);
  if (kind === 'walk' || kind === 'run' || kind === 'drag' || kind === 'limp' || kind === 'hunch') {
    const run = kind === 'run', amp = (run ? 0.72 : 0.38) * gentle;   // (the first steps from standing are shorter)
    o.legA = [Math.sin(p) * amp, -Math.sin(p) * amp];
    // the knee folds as the leg comes through, and straightens to take the weight
    o.knee = [Math.max(0, Math.cos(p)) * (run ? 1.5 : 0.85) + 0.05, Math.max(0, -Math.cos(p)) * (run ? 1.5 : 0.85) + 0.05];
    o.armA = [-Math.sin(p) * (run ? 0.8 : 0.42), Math.sin(p) * (run ? 0.8 : 0.42)];
    o.elbow = run ? [1.7, 1.7] : [0.25 + Math.max(0, -Math.sin(p)) * 0.3, 0.25 + Math.max(0, Math.sin(p)) * 0.3];
    if (run) o.lean = 2.4; if (q.q === 1) o.lean += 1;   // (setting off, the weight goes forward first)
    if (kind === 'drag') { o.lean = -2.4; o.ik = [[9, -3, 0.72], [9, 3, 0.72]]; }
    if (kind === 'limp') { o.legA = [Math.sin(p) * 0.46, -Math.sin(p) * 0.14]; o.knee[1] = 0.05; o.lean = 1; o.armA = [o.armA[0] * 0.5, 0]; o.ik[1] = [3.5, 3, 0.8]; }
    if (kind === 'hunch') { o.armA = [o.armA[0] * 0.35, o.armA[1] * 0.35]; o.elbow = [0.7, 0.7]; o.lean = 2.4; o.neck = 1.6; }
  } else if (kind === 'idle') { o.bob = f === 2 ? -0.4 : 0; o.armA = [0.03, -0.03]; if (q.q === 2) { o.legA = [0.2, -0.16]; o.knee = [0.22, 0.14]; o.lean = -1; } }   // (stopping: the weight rocks back over the front foot)
  else if (kind === 'slump') { o.lean = 1.6; o.neck = 2; o.bob = -f * 0.4; }
  else if (kind === 'winded') { o.lean = 7 + f; o.knee = [0.5, 0.5]; o.legA = [0.28, 0.28]; o.ik = [[6, -3.4, 0.46], [6, 3.4, 0.46]]; o.neck = 1; }
  else if (kind === 'guard') { o.lean = 1.4; o.knee = [0.5, 0.5]; o.legA = [0.3, 0.12]; o.ik = [[6.4, -3.2, 1.02], [6.4, 3.2, 1.02]]; }
  else if (kind === 'sit' && q.ride) { o.legA = [0.34, 0.34]; o.knee = [0.5, 0.5]; o.astride = true; o.ik = [[6.4, -2, 0.7], [6.4, 2, 0.7]]; }
  else if (kind === 'sit') { o.legA = [1.45, 1.45]; o.knee = [1.45, 1.45]; o.sit = true; o.ik = [[6, -3, 0.62], [6, 3, 0.62]]; }
  else if (kind === 'crouch' || kind === 'cower') { o.legA = [1.15, 0.95]; o.knee = [1.9, 1.9]; o.lean = 3.4; o.ik = kind === 'cower' ? [[3.5, -2.4, 1.2], [3.5, 2.4, 1.2]] : [[6, -2.4, 0.36], [6, 2.4, 0.36]]; }
  else if (kind === 'flinch') { o.lean = -2.2; o.ik = [[-2, -5, 0.56], [-2, 5, 0.56]]; }
  else if (kind === 'getup') { o.legA = [0.8, 0.5]; o.knee = [1.2, 1.2]; o.lean = 3; o.ik = [[6, -3, 0.34], [6, 3, 0.34]]; }
  else if (kind === 'carry') { o.lean = -1; o.ik = [[7, -3.4, 0.74], [7, 3.4, 0.74]]; }
  else if (kind === 'handsup') o.ik = [[1, -5.4, 1.32], [1, 5.4, 1.32]];
  else if (kind === 'mouth') o.ik[1] = [3.2, 0.6, 1.14];
  else if (kind === 'talk') o.ik[1] = [6.4, 3.4, 0.86];
  else if (kind === 'aim') o.ik = [[11, -0.4, 0.98], [11, 0.4, 0.98]];
  else if (kind === 'reload') o.ik = [[7, -0.6, 0.86], [4.6, 1, 0.74]];
  else if (kind === 'phone') o.ik[1] = [5.4, 1, 1.04];
  else if (kind === 'swim') { const k = f % 2 ? 1 : -1; o.ik = [[4 + k * 4, -6, 0.98], [4 - k * 4, 6, 0.98]]; o.swim = true; }
  return o;
}

function paint(L0, dir, col, faceCode, opt) {
  const o0 = opt || {}, L = o0.wet ? Object.assign({}, L0, { top: o0.wet & 1 ? sh(L0.top, 0.66) : L0.top, top2: o0.wet & 1 ? sh(L0.top2, 0.66) : L0.top2, pants: o0.wet & 2 ? sh(L0.pants, 0.62) : L0.pants }) : L0, yawH = (o0.yaw || 0) * 0.56, gz = (o0.gaze || 0) * 0.24;
  const K = G.hd.KINDS[col] || ['idle', 0], kind = K[0], f = K[1], th = ANG[dir], Fx = Math.sin(th), Fz = Math.cos(th), Sx = Math.cos(th), Sz = -Math.sin(th);
  const c = document.createElement('canvas'); c.width = FW * R3; c.height = FH * R3; const x = c.getContext('2d'); x.scale(R3, R3); x.lineCap = 'round'; x.lineJoin = 'round';
  const pz = poseOf(kind, f, L, o0), D0 = dims(L), { U, fem, bld, thigh, shin, torso, neck, headR, armU, armL, hipW, shW, chestD, waistW } = D0; void thigh; void shin; void armU; void armL;
  // proportions

  // legs first: they say how high the hips are
  const l0 = legOf(pz, D0, 0), l1 = legOf(pz, D0, 1), low = Math.min(l0.ay, l1.ay), hipY = -low + 1.4 + (pz.swim ? 8 : 0);
  const lean = pz.lean, shY = hipY + torso + pz.bob, headY = shY + neck + headR * 1.24 - (pz.neck || 0), side = (v) => (v > 0 ? 1 : -1); void side;
  const P = (fd, s, y) => { const X = s * Sx + fd * Fx, Z = s * Sz + fd * Fz; return { x: 16 + X, y: GROUND - y * 0.96 + Z * PITCH, z: Z }; };
  const items = [], add = (z, fn) => items.push({ z, fn });
  const cap = (a, b, r0, r1, col2) => {   // a tapered limb, lit from the upper left
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 0.01, nx = -dy / l, ny = dx / l, g = x.createLinearGradient(a.x + nx * r0, a.y + ny * r0, a.x - nx * r0, a.y - ny * r0), left = (nx < 0) === (ny >= 0);
    g.addColorStop(0, left ? sh(col2, 0.76) : sh(col2, 1.14)); g.addColorStop(0.5, col2); g.addColorStop(1, left ? sh(col2, 1.14) : sh(col2, 0.76));
    x.fillStyle = g; x.beginPath(); x.moveTo(a.x + nx * r0, a.y + ny * r0); x.lineTo(b.x + nx * r1, b.y + ny * r1); x.arc(b.x, b.y, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); x.lineTo(a.x - nx * r0, a.y - ny * r0); x.arc(a.x, a.y, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 0.18; x.stroke();
  };
  const robe = /dress|robe/.test(L.topStyle), skirted = robe || L.bottom === 'skirt', legM = L.bareBottom ? L.skin : L.pants, short = L.bottom === 'shorts' || skirted;
  if (skirted && !pz.hasLeg) pz.legA = pz.legA.map((a) => a * 0.62);
  const drawLeg = (i, g) => {
    const s0 = (i ? 1 : -1) * hipW * (pz.astride ? 1.5 : 0.62), hip = P(0, s0, hipY), kn = P(g.kf, s0 * 1.04 + (g.out || 0) * 0.55, hipY + g.ky), an = P(g.af, s0 * 1.02 + (g.out || 0), hipY + g.ay), toe = P(g.af + 3.2 * U, s0 * 1.02 + (g.out || 0), Math.max(0.4, hipY + g.ay - 1.2));
    const kicked = pz.hasLeg && pz.kickLeg === i, z = skirted && !kicked ? -40 : (hip.z + an.z) / 2, up = robe ? L.top : L.bottom === 'skirt' ? L.pants : L.bottom === 'shorts' && !L.bareBottom ? L.pants : legM, lo = /robe/.test(L.topStyle) ? L.top : short ? L.skin : legM;
    add(z, () => { cap(hip, kn, 2.25 * U + bld * 0.2, 1.65 * U, up); cap(kn, an, 1.6 * U, 1.05 * U, lo); });
    add(z + 0.02, () => { cap(an, toe, 1.2 * U, 0.95 * U, L.shoes); x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.ellipse(toe.x - 0.3, toe.y - 0.5, 0.6, 0.3, 0, 0, 6.3); x.fill(); });
  };
  if (!pz.swim) { drawLeg(0, l0); drawLeg(1, l1); }
  // arms
  const sleeve = L.bareTop || L.bikini ? L.skin : L.topStyle === 'tank' || L.topStyle === 'vest' ? L.skin : L.top, shortA = L.topStyle === 'vest' || L.shortSleeves;
  const arm = (i) => {
    const t = pz.ik[i], { s0, sf, eF, eS, eY, hF, hS, hY } = armOf(pz, D0, i, hipY, shY, lean), sh0 = P(sf, s0, shY - 1.6);
    const el = P(eF, eS, eY), ha = P(hF, hS, hY), z = (sh0.z + ha.z) / 2 + (t ? 0.6 : 0);
    add(z, () => { cap(sh0, el, 1.7 * U + bld * 0.14, 1.32 * U, sleeve); cap(el, ha, 1.28 * U, 0.92 * U, shortA ? L.skin : sleeve); x.fillStyle = L.gloves ? '#16161a' : L.skin; x.beginPath(); x.ellipse(ha.x, ha.y, 1 * U, 1.2 * U, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.16; x.stroke(); if (L.tattoo && i) { x.strokeStyle = '#26344e'; x.lineWidth = 0.34; x.beginPath(); x.moveTo(el.x, el.y); x.lineTo((el.x + ha.x) / 2 + 0.4, (el.y + ha.y) / 2); x.stroke(); } });
  };
  arm(0); arm(1);
  // the trunk: two rings, shoulders and hips, and a surface between them
  const wdt = (t) => { const a = shW * 0.92, b = waistW, d = hipW * 1.25 + (fem ? 0.5 : 0); return t < 0.55 ? a + (b - a) * (t / 0.55) : b + (d - b) * ((t - 0.55) / 0.45); };
  const dep = (t) => (chestD * (1 - t * 0.2)) + (L.belly ? Math.max(0, t - 0.3) * L.belly * 1.5 : 0) + (fem && !L.kid ? Math.max(0, 1 - Math.abs(t - 0.25) / 0.18) * 1 : 0);
  const at = (u, t, back) => { const r = Math.sqrt(Math.max(0, 1 - u * u)), f0 = (back ? -1 : 1) * dep(t) * r, s = u * wdt(t), tw = (pz.twist || 0) * Math.max(0, 1 - t), c = Math.cos(tw), n = Math.sin(tw); return P(lean * (1 - t) + f0 * c - s * n, s * c + f0 * n, shY + (hipY - shY) * t); };
  const face = (u, back) => (back ? -1 : 1) * Math.sqrt(Math.max(0, 1 - u * u)) * Fz + u * Sz > -0.02;
  const curve = (t, col2, w) => { for (const back of [false, true]) { let on = false; x.strokeStyle = col2; x.lineWidth = w; x.beginPath(); for (let u = -1; u <= 1.001; u += 0.1) { if (!face(u, back)) { on = false; continue; } const q = at(u, t, back); if (on) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y); on = true; } x.stroke(); } };
  const onBody = (u, t, back) => (face(u, back) ? at(u, t, back) : null), front = Fz > -0.15, rear = Fz < 0.15;
  const trunk = (t0, t1, col2, flare) => {   // the silhouette of the body between two heights
    const rows = 9, pts = [], pts2 = [];
    for (let k = 0; k <= rows; k++) { const t = t0 + (t1 - t0) * k / rows, w = wdt(Math.min(1, t)) + (flare ? Math.max(0, t - 1) * flare : 0), d = dep(Math.min(1, t)) + (flare ? Math.max(0, t - 1) * flare * 0.6 : 0), tw = (pz.twist || 0) * Math.max(0, 1 - t), half = Math.sqrt((w * Math.cos(th + tw)) ** 2 + (d * Math.sin(th + tw)) ** 2), q = P(lean * Math.max(0, 1 - t), 0, shY + (hipY - shY) * t); pts.push([q.x - half, q.y]); pts2.push([q.x + half, q.y]); }
    x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); pts2.reverse().forEach(([a, b]) => x.lineTo(a, b)); x.closePath();
    const xs = pts.concat(pts2).map((q) => q[0]), a0 = Math.min(...xs), a1 = Math.max(...xs), g = x.createLinearGradient(a0, 0, a1, 0); g.addColorStop(0, sh(col2, 1.14)); g.addColorStop(0.45, col2); g.addColorStop(1, sh(col2, 0.72)); x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.24)'; x.lineWidth = 0.2; x.stroke();
  };
  const bodyZ = P(lean / 2, 0, shY).z;
  add(bodyZ, () => {
    const st = L.topStyle, T = L.top, T2 = L.top2, bare = L.bareTop || L.bikini;
    if (L.cape && rear) trunk(0, 1.4, L.cape, 3);
    trunk(0.97, 1.14, L.bareBottom ? L.skin : (L.bottom === 'skirt' ? L.pants : L.pants));   // hips
    trunk(0, 1, bare ? L.skin : T);
    if (/dress|robe/.test(st)) trunk(0.9, st === 'robe' ? 2.3 : 1.65, T, 3.2);
    if (L.bottom === 'skirt' && !L.bareBottom) trunk(0.95, 1.5, L.pants, 3.6);
    if (st === 'tunic') trunk(0.9, 1.3, T, 1.6);
    if (bare) {
      if (L.bikini) { curve(0.2, T, 1.5); }
      else if (L.bareTop && !L.censored && front) {   // a plain body: no bars, no more detail than a figure study
        const nip = sh(L.skin, 0.66);
        for (const u of [-0.45, 0.45]) { const q = onBody(u, fem ? 0.27 : 0.2, false); if (q) { x.fillStyle = nip; x.beginPath(); x.arc(q.x, q.y, fem ? 0.38 : 0.3, 0, 6.3); x.fill(); } const b = onBody(u, fem ? 0.37 : 0.27, false); if (b) { x.strokeStyle = 'rgba(0,0,0,0.13)'; x.lineWidth = 0.3; x.beginPath(); x.arc(b.x, b.y - 1.1, 1.5, 0.5, 2.64); x.stroke(); } }
        const n = onBody(0, 0.68, false); if (n) { x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(n.x - 0.17, n.y - 0.22, 0.34, 0.5); }
      }
    }
    else {
      for (const [u, t] of [[-0.4, 0.42], [0.45, 0.6]]) { const q = onBody(u, t, false); if (q) { x.strokeStyle = 'rgba(0,0,0,0.14)'; x.lineWidth = 0.3; x.beginPath(); x.moveTo(q.x - 1, q.y); x.lineTo(q.x + 1, q.y + 0.6); x.stroke(); } }
      curve(0.02, sh(T, 1.24), 0.42);   // the collar line catches the light
      const midLine = (col2, w, t0 = 0.04, t1 = 0.94, u0 = 0) => { if (!front) return; const a = at(u0, t0, false), b = at(u0, t1, false); x.strokeStyle = col2; x.lineWidth = w; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); };
      if (st === 'jacket' || st === 'suit') { midLine(T2, 1.5, 0.02, 0.5); for (const u of [-0.22, 0.22]) { const a = onBody(u, 0, false), b = onBody(u * 0.2, 0.5, false); if (a && b) { x.strokeStyle = sh(T, 0.6); x.lineWidth = 0.6; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } } midLine(sh(T, 0.6), 0.28, 0.5, 0.98); if (st === 'suit') midLine('#5a1a22', 0.8, 0.06, 0.46); }
      else if (st === 'hoodie') { curve(0.72, sh(T, 0.74), 0.34); midLine('#e8e0d0', 0.26, 0.02, 0.26, -0.12); midLine('#e8e0d0', 0.26, 0.02, 0.22, 0.12); const n = P(lean - 2.4 * (rear ? 0 : 1), 0, shY + 0.4); x.fillStyle = sh(T, 0.82); x.beginPath(); x.ellipse(n.x, n.y, wdt(0) * 0.62, 1.5, 0, 0, 6.3); x.fill(); }
      else if (st === 'vest') midLine(T2, 1.4);
      else if (st === 'shirt') { midLine(sh(T, 0.72), 0.2); for (let t = 0.14; t < 0.9; t += 0.2) { const q = onBody(0, t, false); if (q) { x.fillStyle = sh(T, 1.3); x.fillRect(q.x - 0.2, q.y - 0.2, 0.4, 0.4); } } }
      else if (st === 'tank') { for (const u of [-0.5, 0.5]) { const q = onBody(u, 0, false) || onBody(u, 0, true); if (q) { x.fillStyle = L.skin; x.fillRect(q.x - 0.9, q.y - 0.4, 1.8, 1.4); } } }
      else if (st === 'tshirt') curve(0.03, sh(T, 0.66), 0.3);
    }
    if (!L.bareBottom && L.bottom !== 'skirt' && !/dress|robe/.test(st)) { curve(0.98, sh(L.pants, 0.5), 0.9); const q = onBody(0, 0.98, false); if (q) { x.fillStyle = '#c8b060'; x.fillRect(q.x - 0.5, q.y - 0.4, 1, 0.8); } }
    if (L.apron) { const a = onBody(-0.5, 0.2, false), b = onBody(0.5, 0.2, false), e = onBody(0.56, 1.2, false), d = onBody(-0.56, 1.2, false); if (a && b && e && d) { x.fillStyle = L.apron; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(e.x, e.y); x.lineTo(d.x, d.y); x.closePath(); x.fill(); } }
    if (L.armor) trunk(0.04, 0.62, L.armor);
    if (L.patch) { if (rear) { const q = onBody(0, 0.32, true); if (q) { x.fillStyle = '#e8e0cc'; x.fillRect(q.x - 2, q.y - 2, 4, 4); x.fillStyle = L.patch; x.fillRect(q.x - 2.6, q.y - 3, 5.2, 0.8); } } else { const q = onBody(0.5, 0.26, false); if (q) { x.fillStyle = L.patch; x.fillRect(q.x - 0.7, q.y - 0.4, 1.4, 0.8); } } }
    if (L.pins) for (const [u, t, cc] of [[-0.46, 0.2, '#e05a8a'], [0.46, 0.26, '#5ac8e0'], [-0.4, 0.4, '#e0d050']]) { const q = onBody(u, t, false); if (q) { x.fillStyle = cc; x.fillRect(q.x - 0.3, q.y - 0.3, 0.6, 0.6); } }
    if (L.tote) { const tc = L.toteColor || '#d8ccb0', q = P(lean * 0.2, shW + 0.8, hipY); x.fillStyle = tc; x.fillRect(q.x - 1.6, q.y - 2, 3.4, 4.6); }
    // plain, never explicit: bars as the game has always drawn them
    if (L.bareBottom && L.censored) curve(0.99, '#26262c', 2.4);
    if (L.bareTop && fem && L.censored) curve(0.24, '#26262c', 2);
    if (L.bareBottom && !L.censored && front) { const q = onBody(0, 1.02, false); if (q) { x.fillStyle = sh(L.hair || L.skin, 0.8); x.globalAlpha = 0.5; x.beginPath(); x.moveTo(q.x - 1, q.y - 0.9); x.lineTo(q.x + 1, q.y - 0.9); x.lineTo(q.x, q.y + 0.8); x.closePath(); x.fill(); x.globalAlpha = 1; } }
    if (L.cape && front) { const q = P(lean, 0, shY); x.strokeStyle = sh(L.cape, 0.7); x.lineWidth = 0.5; x.beginPath(); x.moveTo(q.x - shW * Math.abs(Sx), q.y); x.lineTo(q.x + shW * Math.abs(Sx), q.y); x.stroke(); }
  });
  // the head: a skull with a jaw, not a ball, and features set on its surface by the direction they lie in. It can look aside from where the body points.
  const thH = th + yawH, hFx = Math.sin(thH), hFz = Math.cos(thH), hSx = Math.cos(thH), hSz = -Math.sin(thH);
  const hf = lean * 1.1, rx = headR * 0.9, ry = headR * 1.16, rz = headR * 1.02, H0 = P(hf, 0, headY), ne0 = P(lean, 0, shY - 0.4), ne1 = P(hf, 0, headY - ry * 0.72);
  const hw0 = Math.sqrt((rx * hSx) ** 2 + (rz * hFx) ** 2), chinX = hFx * rz * 0.34, jawW = (L.kid ? 0.74 : fem ? 0.6 : 0.68 + L.jaw * 0.06) * (1 + (L.hash % 5 - 2) * 0.02);
  const headPath = (k = 1) => { const w = hw0 * k, y = H0.y, c = H0.x, r = ry * k, j = jawW * w, cs = chinX; x.beginPath(); x.moveTo(c - w, y - r * 0.12); x.bezierCurveTo(c - w, y - r * 0.82, c - w * 0.58, y - r, c, y - r); x.bezierCurveTo(c + w * 0.58, y - r, c + w, y - r * 0.82, c + w, y - r * 0.12); x.bezierCurveTo(c + w * 0.98, y + r * 0.26, c + j + cs * 0.6, y + r * 0.46, c + j * 0.92 + cs, y + r * 0.72); x.bezierCurveTo(c + j * 0.7 + cs, y + r * 0.98, c + j * 0.28 + cs, y + r * 1.02, c + cs, y + r * 1.02); x.bezierCurveTo(c - j * 0.28 + cs, y + r * 1.02, c - j * 0.7 + cs, y + r * 0.98, c - j * 0.92 + cs, y + r * 0.72); x.bezierCurveTo(c - j + cs * 0.6, y + r * 0.46, c - w * 0.98, y + r * 0.26, c - w, y - r * 0.12); x.closePath(); };
  const surf = (yaw, el, k = 1) => { const ce = Math.cos(el), ns = Math.sin(yaw) * ce, nf = Math.cos(yaw) * ce, nu = Math.sin(el), X = ns * rx * k * hSx + nf * rz * k * hFx, Z = ns * rx * k * hSz + nf * rz * k * hFz; return { x: H0.x + X, y: H0.y - nu * ry * k * 0.96 + Z * PITCH, vis: (ns * hSz + nf * hFz) * 0.95 + nu * PITCH, z: Z }; };
  const headZ = Math.max(bodyZ, H0.z) + 3, hs = L.hairStyle, Hc = L.hair, hatHides = L.hat === 'hood' || L.hat === 'cowl' || L.maskSki;
  const lock = (a, b, w, col2, bend = 0) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, mx = (a.x + b.x) / 2 + nx * bend, my = (a.y + b.y) / 2 + ny * bend; x.fillStyle = col2; x.beginPath(); x.moveTo(a.x + nx * w, a.y + ny * w); x.quadraticCurveTo(mx + nx * w * 0.7, my + ny * w * 0.7, b.x, b.y); x.quadraticCurveTo(mx - nx * w * 0.7, my - ny * w * 0.7, a.x - nx * w, a.y - ny * w); x.closePath(); x.fill(); };
  const hairShade = (i) => (i % 3 === 0 ? sh(Hc, 1.26) : i % 3 === 1 ? Hc : sh(Hc, 0.74));
  // what falls behind the shoulders is drawn behind them when they face you
  const behind = (fn) => add(rear ? headZ + 0.5 : bodyZ - 0.1, fn);
  if (!hatHides) {
    if (hs === 1 || hs === 10) behind(() => { for (let i = 0; i < 11; i++) { const yaw = Math.PI + (i - 5) * 0.26, a = surf(yaw, 0.3 + (i % 2) * 0.2), b = P(hf - 1 - Math.abs(Math.cos(i)), (i - 5) * 0.72, headY - (hs === 10 ? 12 : 11) - (i % 3)); if (hs === 10) { x.strokeStyle = hairShade(i); x.lineWidth = 0.9; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.14; x.setLineDash([0.5, 0.6]); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.setLineDash([]); } else lock(a, b, 1.1, hairShade(i), (i - 5) * 0.14); } });
    if (hs === 6) behind(() => { for (let i = 0; i < 9; i++) { const a = surf(Math.PI + (i - 4) * 0.3, 0.2), b = P(hf - 1, (i - 4) * 0.9, headY - 6.4); lock(a, b, 1.1, hairShade(i), 0); } });
    if (hs === 8) behind(() => { const R = rx * 1.5, c2 = { x: H0.x - hFx * 0.5, y: H0.y - ry * 0.36 }; const g2 = x.createRadialGradient(c2.x - R * 0.3, c2.y - R * 0.4, 0.5, c2.x, c2.y, R * 1.1); g2.addColorStop(0, sh(Hc, 1.5)); g2.addColorStop(0.6, Hc); g2.addColorStop(1, sh(Hc, 0.6)); x.fillStyle = g2; x.beginPath(); for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.283, k = R * (1 + (i % 2) * 0.05); const p2 = [c2.x + Math.cos(a) * k, c2.y + Math.sin(a) * k * 0.92]; i ? x.lineTo(p2[0], p2[1]) : x.moveTo(p2[0], p2[1]); } x.closePath(); x.fill(); });
  }
  add(headZ, () => {
    const M = L.skin, ex = faceCode;
    cap(ne0, ne1, 1.25 * U, 1.1 * U, sh(M, 0.82));
    const g = x.createLinearGradient(H0.x - hw0, H0.y - ry, H0.x + hw0, H0.y + ry); g.addColorStop(0, sh(M, 1.12)); g.addColorStop(0.55, M); g.addColorStop(1, sh(M, 0.74));
    x.fillStyle = g; headPath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.26)'; x.lineWidth = 0.16; x.stroke();
    for (const yaw of [-1.57, 1.57]) { const e = surf(yaw, 0.02, 1.02); if (e.vis > -0.1) { x.fillStyle = sh(M, 0.84); x.beginPath(); x.ellipse(e.x, e.y, 0.34 + Math.abs(e.vis) * 0.3, 0.8, 0, 0, 6.3); x.fill(); x.fillStyle = sh(M, 0.68); x.beginPath(); x.ellipse(e.x, e.y, 0.16, 0.42, 0, 0, 6.3); x.fill(); } }
    if (hFz > -0.4) {   // the face, as far round as it can be seen
      const asian = L.race === 'asian', yawE = 0.42 + (L.hash % 5) * 0.012, elE = 0.1, op = ex === 3 ? 1.25 : ex === 6 || ex === 5 ? 0.62 : ex === 7 ? 0.72 : 1, mouthE = -0.62, brow = { 2: [0.2, 0.36], 3: [0.36, 0.26], 4: [0.34, 0.22], 5: [0.22, 0.34], 7: [0.24, 0.3] }[ex] || [0.3, 0.3];
      const cheek = surf(0.72, -0.28), cheek2 = surf(-0.72, -0.28); x.fillStyle = 'rgba(0,0,0,0.06)'; for (const q of [cheek, cheek2]) if (q.vis > 0.1 && !L.kid) { x.beginPath(); x.ellipse(q.x, q.y + 0.4, 0.8, 1.2, 0, 0, 6.3); x.fill(); }
      for (const sd of [-1, 1]) {
        const e = surf(sd * yawE, elE), vis = e.vis; if (vis < 0.1) continue;
        const w = 0.62 * Math.min(1, vis + 0.2) * (L.kid ? 1.22 : 1) * (asian ? 1.14 : 1), h = (asian ? 0.21 : 0.32) * op * (L.kid ? 1.28 : 1), tilt = asian ? -sd * 0.14 * Math.sign(hFz || 1) : 0;
        if (!asian) { x.fillStyle = 'rgba(70,36,24,0.14)'; x.beginPath(); x.ellipse(e.x, e.y - 0.1, w * 1.25, h * 1.6, 0, 0, 6.3); x.fill(); }
        if (faceCode === 9) { x.strokeStyle = sh(M, 0.56); x.lineWidth = 0.2; x.beginPath(); x.moveTo(e.x - w, e.y); x.lineTo(e.x + w, e.y); x.stroke(); }
        else {
          x.save(); x.translate(e.x, e.y); x.rotate(tilt); x.fillStyle = L.eyeWhite2; x.beginPath(); x.ellipse(0, 0, w, h, 0, 0, 6.3); x.fill(); x.clip(); const px = gz; x.fillStyle = L.eyes; x.beginPath(); x.ellipse(px, 0, Math.min(w, 0.33), 0.33, 0, 0, 6.3); x.fill(); x.fillStyle = '#080808'; x.beginPath(); x.arc(px, 0, 0.14, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillRect(px - 0.18, -0.2, 0.12, 0.12); x.restore();
          x.save(); x.translate(e.x, e.y); x.rotate(tilt); x.strokeStyle = sh(M, 0.42); x.lineWidth = asian ? 0.26 : 0.2; x.beginPath(); x.ellipse(0, 0, w * 1.02, h * 1.04, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); x.restore();   // the upper lid
          if (asian) { x.strokeStyle = sh(M, 0.72); x.lineWidth = 0.13; x.beginPath(); x.moveTo(e.x - sd * w * Math.sign(hFz || 1), e.y); x.lineTo(e.x - sd * (w + 0.22) * Math.sign(hFz || 1), e.y + 0.12); x.stroke(); }   // the soft inner fold
        }
        const lift2 = ex === 7 && sd > 0 ? 0.14 : 0, b0 = surf(sd * (yawE - 0.2), brow[0] + lift2), b1 = surf(sd * (yawE + 0.3), brow[1] + lift2 - (asian ? 0.02 : 0)); x.strokeStyle = L.brow; x.lineWidth = (fem || L.kid ? 0.22 : 0.34) + (L.hash % 3) * 0.03; x.beginPath(); x.moveTo(b0.x, b0.y); x.quadraticCurveTo((b0.x + b1.x) / 2, (b0.y + b1.y) / 2 - 0.2, b1.x, b1.y); x.stroke();
        if (L.lined || L.old) { const q = surf(sd * 0.36, -0.3); x.strokeStyle = sh(M, 0.8); x.lineWidth = 0.12; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x + sd * 0.4 * Math.abs(hSx), q.y + 0.5); x.stroke(); }
      }
      const n0 = surf(0, 0.06), n1 = surf(0, -0.3, 1.1 + (L.hash % 3) * 0.02), mouth = surf(0, mouthE);
      if (Math.abs(hFz) > 0.02 || n1.vis > 0) { x.strokeStyle = sh(M, 0.8); x.lineWidth = 0.18; x.beginPath(); x.moveTo(n0.x, n0.y); x.lineTo(n1.x, n1.y); x.stroke(); x.fillStyle = sh(M, 0.66); for (const sd of [-0.18, 0.18]) { const q = surf(sd, -0.36, 1.06); if (q.vis > 0) x.fillRect(q.x - 0.16, q.y, 0.32, 0.14); } x.fillStyle = sh(M, 1.08); x.beginPath(); x.ellipse(n1.x, n1.y - 0.1, 0.32, 0.26, 0, 0, 6.3); x.fill(); }
      if (mouth.vis > 0.05) {
        const m0 = surf(-0.24, mouthE), m1 = surf(0.24, mouthE), bend = { 1: 0.32, 2: -0.14, 4: -0.28, 5: -0.2, 7: -0.08 }[ex] || 0, open = ex === 3 ? 0.36 : ex === 5 ? 0.24 : 0, lip = L.lip;
        if (open) { x.fillStyle = '#3a1418'; x.beginPath(); x.ellipse(mouth.x, mouth.y + 0.14, 0.52, open, 0, 0, 6.3); x.fill(); }
        if (fem) { x.fillStyle = lip; x.beginPath(); x.moveTo(m0.x, m0.y); x.quadraticCurveTo(mouth.x, mouth.y + bend + 0.42, m1.x, m1.y); x.quadraticCurveTo(mouth.x, mouth.y - 0.2 + bend, m0.x, m0.y); x.closePath(); x.fill(); }
        x.strokeStyle = sh(lip, 0.62); x.lineWidth = 0.2; x.beginPath(); x.moveTo(m0.x, m0.y); x.quadraticCurveTo(mouth.x, mouth.y + bend, m1.x, m1.y); x.stroke();
        if (!fem) { x.strokeStyle = sh(M, 0.82); x.lineWidth = 0.14; x.beginPath(); x.moveTo(mouth.x - 0.34, mouth.y + 0.4); x.lineTo(mouth.x + 0.34, mouth.y + 0.4); x.stroke(); }
      }
      // beard, moustache and stubble follow the jaw, and stop at the mouth
      if (L.facial) {
        const col2 = L.facial === 3 ? sh(M, 0.66) : L.hair; x.save(); headPath(1.02); x.clip();
        if (L.facial === 1 || L.facial === 3) {
          x.globalAlpha = L.facial === 3 ? 0.42 : 1; const pts = []; for (let y0 = -1.5; y0 <= 1.5; y0 += 0.12) { const a = Math.abs(y0), q = surf(y0, a > 0.9 ? -0.02 : -0.5 + a * 0.44); if (q.vis >= -0.05) pts.push(q); }
          if (pts.length) { x.fillStyle = col2; x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (const q of pts) x.lineTo(q.x, q.y); x.lineTo(H0.x + hw0 * 1.2, H0.y + ry * 1.3); x.lineTo(H0.x - hw0 * 1.2, H0.y + ry * 1.3); x.closePath(); x.fill(); }
          x.globalAlpha = 1;
          if (L.facial === 1) { x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 0.14; for (let i = -4; i <= 4; i++) { const q = surf(i * 0.2, -0.86); if (q.vis > 0) { x.beginPath(); x.moveTo(q.x, q.y - 0.6); x.lineTo(q.x, q.y + 0.6); x.stroke(); } } if (mouth.vis > 0.05) { const m0 = surf(-0.2, mouthE - 0.02), m1 = surf(0.2, mouthE - 0.02); x.strokeStyle = L.lip; x.lineWidth = 0.34; x.beginPath(); x.moveTo(m0.x, m0.y); x.lineTo(m1.x, m1.y); x.stroke(); } }
        } else { const a = surf(-0.42, -0.5), m = surf(0, -0.46), b = surf(0.42, -0.5); x.fillStyle = col2; x.beginPath(); x.moveTo(a.x, a.y + 0.2); x.quadraticCurveTo(m.x, m.y - 0.5, b.x, b.y + 0.2); x.quadraticCurveTo(m.x, m.y + 0.16, a.x, a.y + 0.2); x.closePath(); x.fill(); }
        x.restore();
      }
      if (L.glasses) { const gc = L.glasses === 'sun' ? '#141418' : '#3a2e22'; x.strokeStyle = gc; x.lineWidth = 0.22; const a = surf(-0.42, 0.1, 1.05), b = surf(0.42, 0.1, 1.05); for (const q of [a, b]) if (q.vis > 0.1) { x.beginPath(); x.rect(q.x - 0.9 * Math.min(1, q.vis + 0.2), q.y - 0.6, 1.8 * Math.min(1, q.vis + 0.2), 1.2); if (L.glasses === 'sun') { x.fillStyle = '#16181e'; x.fill(); } x.stroke(); } if (a.vis > 0.1 && b.vis > 0.1) { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
      if (L.nosering) { const q = surf(0, -0.36, 1.1); x.fillStyle = '#d8dce4'; x.fillRect(q.x - 0.14, q.y, 0.3, 0.3); }
      if (L.scar) { const q = surf((L.scar === 1 ? -1 : 1) * 0.5, 0.05); if (q.vis > 0.1) { x.strokeStyle = sh(M, 1.2); x.lineWidth = 0.18; x.beginPath(); x.moveTo(q.x, q.y - 1); x.lineTo(q.x + 0.3, q.y + 1); x.stroke(); } }
    }
    if (!hatHides) drawHair();
    drawMask();
    drawHat();
  });
  function hairMass(front, nape) {   // hair over the crown down to a hairline that turns with the head
    const pts = []; for (let i = 0; i <= 48; i++) { const yaw = -Math.PI + i / 48 * 6.283, a = Math.abs(yaw), el = a < 0.85 ? front + (a * 0.18) : a < 1.3 ? front + 0.15 + (-0.3 - front - 0.15) * ((a - 0.85) / 0.45) : -0.3 + (nape + 0.3) * ((a - 1.3) / 1.84), q = surf(yaw, el, 1.03); if (q.vis >= -0.02) pts.push(q); }
    const g = x.createLinearGradient(H0.x - hw0, H0.y - ry, H0.x + hw0, H0.y + ry * 0.4); g.addColorStop(0, sh(Hc, 1.3)); g.addColorStop(0.5, Hc); g.addColorStop(1, sh(Hc, 0.62));
    x.save(); headPath(1.05); x.clip(); x.fillStyle = g; if (hFz < -0.82) x.fillRect(H0.x - hw0 * 1.3, H0.y - ry * 1.3, hw0 * 2.6, ry * 2.4); else if (pts.length) { x.beginPath(); x.moveTo(H0.x - hw0 * 1.4, pts[0].y); for (const q of pts.slice().sort((p, q2) => p.x - q2.x)) x.lineTo(q.x, q.y); x.lineTo(H0.x + hw0 * 1.4, pts[pts.length - 1].y); x.lineTo(H0.x + hw0 * 1.4, H0.y - ry * 1.5); x.lineTo(H0.x - hw0 * 1.4, H0.y - ry * 1.5); x.closePath(); x.fill(); } x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 0.13; for (let i = 0; i < 7; i++) { const q = surf(-1.2 + i * 0.4 + (hFz < 0 ? Math.PI : 0), 0.95, 1.03); x.beginPath(); x.moveTo(q.x, q.y); x.quadraticCurveTo(q.x - 0.4, q.y + 0.7, q.x - 0.7, q.y + 1.4); x.stroke(); }
  }
  function drawHair() {
    if (hs === 2) return;   // shaved
    if (hs === 4) { x.save(); headPath(1.01); x.clip(); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(H0.x - hw0, H0.y - ry, hw0 * 2, ry * 0.9); x.restore(); for (let i = 0; i < 14; i++) { const t = i / 13, el = 0.5 + t * 2.1, ya = el > 1.57 ? Math.PI : 0, e2 = el > 1.57 ? Math.PI - el : el, a = surf(ya, e2, 1), b = surf(ya, e2, 1.5 + (i % 2) * 0.16); if (a.vis > -0.5) lock(a, b, 0.44, hairShade(i)); } return; }
    if (hs === 9) { hairMass(0.14, -0.6); for (let i = -4; i <= 4; i++) { const a = surf(i * 0.22, 0.6, 1.04), b = surf(i * 0.2 + 0.08, 0.06 + (i % 2) * 0.05, 1.04); if (a.vis > 0.02) lock(a, b, 0.42, hairShade(i + 9)); } return; }
    if (hs === 5) { hairMass(0.5, -0.46); for (let i = 0; i < 30; i++) { const yaw = i * 2.4, el = 0.45 + (i % 6) * 0.2, q = surf(yaw, el, 1.08); if (q.vis > -0.1) { x.fillStyle = hairShade(i); x.beginPath(); x.arc(q.x, q.y, 0.52, 0, 6.3); x.fill(); } } return; }
    if (hs === 8) { hairMass(0.56, -0.5); for (let i = 0; i < 20; i++) { const q = surf(i * 2.4, 0.5 + (i % 5) * 0.2, 1.1); if (q.vis > -0.1) { x.fillStyle = hairShade(i); x.beginPath(); x.arc(q.x, q.y, 0.56, 0, 6.3); x.fill(); } } return; }
    hairMass(hs === 3 ? 0.56 : 0.5, hs === 0 ? -0.6 : -0.86);
    if (hs === 0) { for (let i = 0; i < 9; i++) { const yaw = -0.9 + i * 0.22, a = surf(yaw * 0.6 - 0.5, 1.2, 1.03), b = surf(yaw, 0.52, 1.1); if (b.vis > -0.1) lock(a, b, 0.46, hairShade(i), 0.14); } }
    if (hs === 3) { const q = surf(Math.PI, 0.8, 1.26); x.fillStyle = sh(Hc, 1.04); x.beginPath(); x.arc(q.x, q.y, 1.6, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.26)'; x.lineWidth = 0.14; x.beginPath(); x.arc(q.x, q.y, 1, 0.4, 3.6); x.stroke(); }
    if (hs === 1 || hs === 6 || hs === 10) for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const q = surf(sd * (1.05 + i * 0.16), 0.3, 1.04), b = { x: q.x + (q.x - H0.x) * 0.12, y: q.y + (hs === 6 ? 4 : 7.5) - i * 0.4 }; if (q.vis > -0.3) lock(q, b, 0.68, hairShade(i), sd * 0.3); }
    if (hs === 7) { const q = surf(Math.PI, 0.32, 1.04), b = P(hf - 4.6, 0, headY - 7.4); b.x += Math.sin(f / 8 * 6.283) * 0.8; const tie = surf(Math.PI, 0.32, 1.1); if (hFz < 0.6) { lock(q, b, 1, Hc, 0.6); lock(q, b, 0.5, sh(Hc, 1.3), 0.4); x.fillStyle = '#7a3a4a'; x.fillRect(tie.x - 0.5, tie.y - 0.3, 1, 0.6); } }
  }
  function drawMask() {
    const m = L.mask; if (!m) return;
    const low = (top, col2) => { x.save(); headPath(1.04); x.clip(); const pts = []; for (let y0 = -1.5; y0 <= 1.5; y0 += 0.15) { const q = surf(y0, top); if (q.vis >= -0.05) pts.push(q); } if (pts.length) { x.fillStyle = col2; x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (const q of pts) x.lineTo(q.x, q.y); x.lineTo(H0.x + hw0 * 1.3, H0.y + ry * 1.4); x.lineTo(H0.x - hw0 * 1.3, H0.y + ry * 1.4); x.closePath(); x.fill(); } x.restore(); };
    if (L.maskSki || m === 'balaclava') { const c2 = L.maskSki ? '#26272a' : '#1e1e22'; x.fillStyle = c2; headPath(1.05); x.fill(); if (hFz > -0.4) { const e0 = surf(-0.42, 0.1), e1 = surf(0.42, 0.1), hole = surf(0, 0.1); if (hole.vis > 0) { x.fillStyle = L.skin; x.fillRect(Math.min(e0.x, e1.x) - 0.6, hole.y - 0.7, Math.abs(e1.x - e0.x) + 1.2, 1.4); for (const q of [e0, e1]) if (q.vis > 0.1) { x.fillStyle = L.eyes; x.fillRect(q.x - 0.3, q.y - 0.3, 0.6, 0.6); } } } return; }
    if (hFz < -0.5) { const q = surf(Math.PI, 0.1, 1.02); x.strokeStyle = '#26262c'; x.lineWidth = 0.34; x.beginPath(); x.moveTo(H0.x - hw0, q.y); x.lineTo(H0.x + hw0, q.y); x.stroke(); return; }   // the strap
    if (m === 'surgical') { low(-0.24, '#c8dce4'); const q = surf(0, -0.6); x.strokeStyle = 'rgba(40,70,90,0.3)'; x.lineWidth = 0.12; for (const d of [-0.5, 0, 0.5]) { x.beginPath(); x.moveTo(q.x - 2, q.y + d); x.lineTo(q.x + 2, q.y + d); x.stroke(); } return; }
    if (m === 'bandana') { low(-0.22, L.maskColor || '#7a1e22'); const q = surf(0, -1, 1.1); x.fillStyle = sh(L.maskColor || '#7a1e22', 0.8); x.beginPath(); x.moveTo(q.x - 1.4, q.y - 1); x.lineTo(q.x, q.y + 1.2); x.lineTo(q.x + 1.4, q.y - 1); x.closePath(); x.fill(); return; }
    const mc = { white: '#ece6dc', gold: '#d8b040', black: '#1a1618', red: '#8a1a1e', silver: '#b8bcc4', hockey: '#e8e4d8', gas: '#3a4034' }[L.maskColor || m] || '#5a5a60';
    x.save(); headPath(1.0); x.clip(); x.fillStyle = mc; const cc = surf(0, -0.1); x.beginPath(); x.ellipse(cc.x, cc.y, hw0 * 1.02, ry * 1.1, 0, 0, 6.3); x.fill(); x.restore();
    for (const sd of [-1, 1]) { const q = surf(sd * 0.42, 0.1); if (q.vis > 0.1) { x.fillStyle = m === 'gas' ? '#8ab0b8' : '#0a0808'; x.beginPath(); x.ellipse(q.x, q.y, 0.56, 0.42, 0, 0, 6.3); x.fill(); } }
    if (m === 'hockey') { x.fillStyle = '#26262c'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) { const q = surf(i * 0.2, -0.3 - j * 0.3, 1.02); if (q.vis > 0.1) x.fillRect(q.x - 0.14, q.y - 0.14, 0.28, 0.28); } }
    if (m === 'gas') { const q = surf(0, -0.5, 1.26); x.fillStyle = '#26282a'; x.beginPath(); x.arc(q.x, q.y, 1.2, 0, 6.3); x.fill(); }
    if (L.maskBeak) { const b = surf(0, -0.1, 1.5); cap(cc, b, 0.8, 0.26, sh(mc, 0.84)); }
  }
  function drawHat() {
    const hat = L.hat, hc = L.hatColor; if (!hat) return;
    const ring = (k, el, col2, w) => { const pts = []; for (let i = 0; i <= 24; i++) pts.push(surf(i / 24 * 6.283, el, k)); x.fillStyle = col2; x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y))); x.closePath(); x.fill(); if (w) { x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = w; x.stroke(); } };
    // a crown that sits on the skull: its brim line follows the head, so it never floats
    const dome = (el, col2, k = 1.08, rise = 1.14) => { const w = hw0 * k, base = surf(0, el, 1.04), back = surf(Math.PI, el, 1.04), by = (base.y + back.y) / 2, g = x.createLinearGradient(H0.x - w, 0, H0.x + w, 0); g.addColorStop(0, sh(col2, 1.2)); g.addColorStop(1, sh(col2, 0.68)); x.fillStyle = g; x.beginPath(); x.ellipse(H0.x, by, w, Math.max(0.5, by - (H0.y - ry * rise)), 0, Math.PI, 0); x.closePath(); x.fill(); x.beginPath(); x.ellipse(H0.x, by, w, Math.abs(base.y - by) + 0.2, 0, 0, Math.PI); x.fill(); };
    const brim = (yawW, reach, col2) => { const a = surf(-yawW, 0.42, 1.06), b = surf(yawW, 0.42, 1.06), t = surf(0, 0.34, reach); x.fillStyle = sh(col2, 0.74); x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo(t.x, t.y, b.x, b.y); x.closePath(); x.fill(); };
    if (hat === 'cap') { const col2 = hc || '#7a3a3a'; if (hFz < 0) brim(0.7, 1.7, col2); dome(0.3, col2, 1.1); if (hFz >= 0) brim(0.7, 1.7, col2); }
    else if (hat === 'helmet' || hat === 'hardhat') { const col2 = hc || (hat === 'hardhat' ? '#d8b020' : '#9aa0a8'); dome(0.3, col2, 1.14); ring(1.26, 0.3, sh(col2, 0.84), 0.12); dome(0.36, col2, 1.1); }
    else if (hat === 'straw') { ring(1.8, 0.42, '#b8903c', 0.14); dome(0.46, '#d8b45a'); x.strokeStyle = '#8a4a2a'; x.lineWidth = 0.5; const q = surf(0, 0.5); x.beginPath(); x.moveTo(H0.x - hw0, q.y); x.lineTo(H0.x + hw0, q.y); x.stroke(); }
    else if (hat === 'crown') { dome(0.62, '#e0b840'); for (let i = 0; i < 6; i++) { const q = surf(i * 1.05, 0.9, 1.26); x.fillStyle = i % 2 ? '#d03a3a' : '#fff0a0'; x.fillRect(q.x - 0.3, q.y - 0.5, 0.6, 0.9); } }
    else if (hat === 'bandana') { const col2 = hc || '#c03030'; dome(0.5, col2, 1.05); if (rear) { const k = surf(Math.PI, 0.4, 1.06); lock(k, { x: k.x + 1, y: k.y + 3 }, 0.5, col2); lock(k, { x: k.x - 1, y: k.y + 3 }, 0.5, sh(col2, 0.8)); } }
    else if (hat === 'kippah') { const q = surf(Math.PI, 1.2, 1.05); x.fillStyle = hc || '#1a1a22'; x.beginPath(); x.ellipse(q.x, q.y, 1.5, 0.7, 0, 0, 6.3); x.fill(); }
    else if (hat === 'blackhat' || hat === 'fedora') { const col2 = hc || '#121214'; ring(1.62, 0.46, sh(col2, 0.9), 0.12); dome(0.5, col2, 1.04, 1.3); const q = surf(0, 0.52); x.fillStyle = sh(col2, 0.5); x.fillRect(H0.x - hw0, q.y - 0.5, hw0 * 2, 0.8); }
    else if (hat === 'tophat') { const col2 = hc || '#141418', w = hw0 * 0.9; ring(1.46, 0.56, col2, 0.12); x.fillStyle = col2; const q = surf(0, 1.57, 1); x.fillRect(q.x - w, q.y - 5, w * 2, 6); x.fillStyle = '#8a1a2a'; x.fillRect(q.x - w, q.y - 0.6, w * 2, 1); }
    else if (hat === 'beanie') { const col2 = hc || '#c8506a'; dome(0.26, col2, 1.1, 1.2); const q = surf(0, 0.3); x.fillStyle = sh(col2, 0.8); x.fillRect(H0.x - hw0 * 1.08, q.y - 0.4, hw0 * 2.16, 1.3); x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = 0.14; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(H0.x + i * 0.9, q.y); x.lineTo(H0.x + i * 0.6, H0.y - ry); x.stroke(); } }
    else if (hat === 'bucket') { const col2 = hc || '#6a7a5a'; ring(1.4, 0.34, sh(col2, 0.86), 0.12); dome(0.42, col2, 1.04); }
    else if (hat === 'hood' || hat === 'cowl') { const col2 = hc || (hat === 'cowl' ? '#2a1a1e' : '#5a4a3a'), w = hw0 * 1.22; x.fillStyle = col2; x.beginPath(); x.ellipse(H0.x, H0.y - 0.3, w, ry * 1.14, 0, 0, 6.3); x.fill(); if (hFz > -0.3) { const m = surf(0, -0.1); x.save(); x.beginPath(); x.ellipse(m.x, m.y, hw0 * 0.78, ry * 0.84, 0, 0, 6.3); x.clip(); x.fillStyle = hat === 'cowl' ? '#0a0808' : L.skin; x.fillRect(m.x - hw0, m.y - ry, hw0 * 2, ry * 2); x.restore(); x.strokeStyle = sh(col2, 0.6); x.lineWidth = 0.3; x.beginPath(); x.ellipse(m.x, m.y, hw0 * 0.8, ry * 0.86, 0, 0, 6.3); x.stroke(); } }
  }
  items.sort((a, b) => a.z - b.z); for (const it of items) it.fn();
  return c;
}

// ---------------------------------------------------------------- frames on demand
const CAP = 1500, frames = new Map();
const frameOf = (hd, dir, col, face, opt) => {
  const o = opt || {}, key = hd.id + '|' + dir + '|' + col + '|' + face + '|' + (o.q || 0) + (o.ride ? 'r' : '') + (o.yaw || 0) + (o.gaze || 0) + (o.wet || 0); let c = frames.get(key);
  if (c) { frames.delete(key); frames.set(key, c); return c; }
  const L = hd.L; if (L.hash == null) { L.hash = (hd.id * 2654435761) >>> 16; L.eyeWhite2 = mix(L.eyeWhite, '#f4f0e8', 0.7); }
  c = paint(L, dir, col, face, o); frames.set(key, c); if (frames.size > CAP) frames.delete(frames.keys().next().value);
  return c;
};
let ids = 0;
const CP = CanvasRenderingContext2D.prototype, _di = CP.drawImage, _white = A.white;
A.white = function (img) { const r = _white.call(this, img); if (r && img && img._hd) r._whiteOf = img; return r; };
// any draw of a frame of a person's sheet, by anyone, is this art
CP.drawImage = function (img, a, b, c, d, e, f, g, h) {
  // the small sheets menus, the phone and scenes still ask for become this art too
  if (img && img._classic && arguments.length === 9 && !G._hdDrawing) { const s = img._classic, hd = G.hd.get(s); if (hd && s.fw === 16) { const col = Math.floor(a / s.fw), row = Math.floor(b / s.fh), oy = b - row * s.fh, hcol = col === 0 ? G.hd.COL.idle : G.hd.COL.walk + (col === 1 ? 2 : 6), kx = FW / s.fw, ky = FH / s.fh; return this.drawImage(hd.img, hcol * FW + (a - col * s.fw) * kx, row * FH + oy * ky, c * kx, d * ky, e, f, g, h); } }
  const src = img && (img._hd || (img._whiteOf && img._whiteOf._hd));
  if (src && arguments.length === 9 && !G.body.off) {
    const col = Math.floor(a / FW), row = Math.floor(b / FH), cur = G.body.cur, dir = cur ? cur.dir : row, art = frameOf(src, dir, col, cur ? cur.face : 0, cur), was = this.imageSmoothingEnabled;
    this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'high';
    if (img._whiteOf) { const fl = this.filter; this.filter = 'brightness(2.6)'; _di.call(this, art, (a - col * FW) * R3, (b - row * FH) * R3, c * R3, d * R3, e, f, g, h); this.filter = fl; }
    else _di.call(this, art, (a - col * FW) * R3, (b - row * FH) * R3, c * R3, d * R3, e, f, g, h);
    this.imageSmoothingEnabled = was; return undefined;
  }
  return _di.apply(this, arguments);
};
const _get = G.hd.get;
G.hd.get = function (sheet, now) { const h = _get.call(this, sheet, now); if (h && !h.img._hd) { h.id = ++ids; h.img._hd = h; h.img._people = false; } return h; };

// ---------------------------------------------------------------- heading: where the body really points
const VEC = [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]], RING = [0, 5, 2, 7, 3, 6, 1, 4];   // clockwise from down
const nearest = (dx, dy) => { let best = 0, bd = -2; const l = Math.hypot(dx, dy) || 1; VEC.forEach(([a, b], i) => { const d = (a * dx + b * dy) / (Math.hypot(a, b) * l); if (d > bd) { bd = d; best = i; } }); return best; };
const AP = G.Actor.prototype, _draw = AP.draw;
AP.draw = function (ctx) {
  const s = this.sheet; if (!s || s.animal || this.kind === 'animal' || this.kind === 'vehicle') return _draw.call(this, ctx);
  const b = this._b || (this._b = { h: this.dir, lx: this.x, ly: this.y, t: 0, dx: 0, dy: 0 }), mx = this.x - b.lx, my = this.y - b.ly; b.lx = this.x; b.ly = this.y;
  b.dx = b.dx * 0.7 + mx * 0.3; b.dy = b.dy * 0.7 + my * 0.3;
  const moving = this.moving && Math.hypot(b.dx, b.dy) > 0.05, aiming = this.swing || this.shotT > 0 || (this.kind === 'player' && this.mouseHeld);
  let want = moving && !aiming && Math.abs(mx) + Math.abs(my) < 12 ? nearest(b.dx, b.dy) : this.dir;
  // whoever aims or strikes turns the whole body that way, diagonals included
  if (aiming) { const ang = this.kind === 'player' ? this.aim : this.target ? Math.atan2(this.target.y - this.y, this.target.x - this.x) : null, sw = this.swing && this.swing.base; const a2 = sw != null && this.swing ? sw : ang; if (a2 != null) want = nearest(Math.cos(a2), Math.sin(a2)); }
  // standing still keeps the diagonal it arrived on, unless the actor has turned to face something else
  if (!moving && !aiming && G.util.dirFromVec(VEC[b.h][0], VEC[b.h][1]) === this.dir) want = b.h;
  if (this._rideDir != null) { b.h = want = this._rideDir; }
  b.mt = this.moving ? (b.mt || 0) + 1 / 60 : 0; b.st = this.moving ? 0 : (b.st || 9) + 1 / 60;
  // a body turns through the headings between, it does not snap
  if (want !== b.h) { b.t += 1 / 60; if (b.t >= 0.04) { b.t = 0; const i = RING.indexOf(b.h), j = RING.indexOf(want), step = ((j - i + 12) % 8) - 4 < 0 ? -1 : 1; b.h = (j - i + 8) % 8 === 4 || Math.abs(((j - i + 12) % 8) - 4) <= 4 ? RING[(i + (((j - i + 12) % 8) - 4 === 0 ? 1 : step) + 8) % 8] : want; } }
  const st = this._hd, blink = st && st.blinkT < 0, ex = G.body.mood(this), q = this.moving && b.mt < 0.16 ? 1 : !this.moving && b.st < 0.14 && !aiming ? 2 : 0;
  const lookAt = G.body.lookOf(this, b.h, st), W = G.wet, wet = W && W.slotLevel ? (W.slotLevel(this, 'top') > 0.3 ? 1 : 0) | (W.slotLevel(this, 'bottom') > 0.3 ? 2 : 0) : 0;
  G.body.cur = { dir: b.h, face: this.dead ? 9 : blink ? 9 : ex, q, yaw: lookAt.yaw, gaze: lookAt.gaze, wet, ride: this._rideDir != null };
  try { return _draw.call(this, ctx); } finally { G.body.cur = null; }
};
// people look at what is near them: first the eyes, then the head turns, and past that they stay as they are
const lookOf = (a, dir, st) => {
  if (a.dead || a.sleeping) return { yaw: 0, gaze: 0 };
  if (st && st.lookT > 0 && !a.moving) return { yaw: st.lookDir === 2 ? 1 : st.lookDir === 1 ? -1 : 0, gaze: 0 };
  let tx = null, ty = null, p = G.player;
  if (a.kind === 'player') { if (a.mouseWorld && !a.moving) { const m = a.mouseWorld(); tx = m.x; ty = m.y; } } else if (p && !p.dead && Math.hypot(p.x - a.x, p.y - a.y) < 80) { tx = p.x; ty = p.y; }
  if (tx == null) return { yaw: 0, gaze: 0 };
  let d = Math.atan2(tx - a.x, ty - a.y + 16) - ANG[dir]; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  const ad = Math.abs(d), s = d > 0 ? 1 : -1; if (ad < 0.26) return { yaw: 0, gaze: 0 }; if (ad < 0.8) return { yaw: 0, gaze: s }; if (ad < 1.9) return { yaw: s, gaze: s }; return { yaw: 0, gaze: 0 };
};
// what hangs on a hand: the real hand of the frame on screen, on any heading. Things are held in one hand, always the same (hand 1, the arm every weapon move strikes with)
G.hd.handOf = function (a, which) {
  if (!a.sheet || !a._hdFrame) return null; const hd = G.hd.get(a.sheet); if (!hd) return null;
  const dir = a._b ? a._b.h : a.dir, g2 = geom(hd.L, dir, a._hdFrame.col, null), i = which != null ? which : 1, h = g2.hands[i], kx = G.hd.WW / FW, ky = G.hd.WH / FH, x0 = a.x - G.hd.WW / 2, y0 = a.y - G.hd.WH + 1;
  return { x: x0 + h.x * kx, y: y0 + h.y * ky, shoulderY: y0 + g2.shoulderY * ky, dir: a.dir, z: h.z };
};
// wet cloth is darker in the painting itself; the beads running down it stay
const _wetO = G.wetOverlay; void _wetO;
G.wetOverlay = (ctx, a, hd, col, dir, fw, fh, x0, y0, WW, WH) => { const W = G.wet; if (a.kind === 'animal' || !W) return; const k = W.worn(a); if (!(k > 0.3)) return; const t = Math.floor(G.loop.time * 3 + a.x); ctx.fillStyle = `rgba(214,226,240,${(k * 0.42).toFixed(2)})`; for (let i = 0; i < 2 + k * 4; i++) { const up = i % 2 === 0, h1 = ((i * 31 + (t % 3) * 17) % 97) / 97; ctx.fillRect(x0 + WW * (0.34 + 0.32 * h1), y0 + WH * (up ? 0.36 + 0.26 * h1 : 0.66 + 0.24 * h1), 0.5, 1); } };
// the same questions old code asks of a sheet, answered from the skeleton: no sheet needs drawing
const headsOf = (L) => [0, 1, 2, 3].map((dir) => new Proxy({}, { get: (_, k) => { const col = +k; if (!(col >= 0) || !G.hd.KINDS[col]) return undefined; const q = geom(L, dir, col, null); return { hx: q.hx, hy: q.hy, hs: q.hs, hands: q.hands.map((h) => [h.x, h.y]) }; } }));
G.body = { cur: null, off: false, frameOf, ANG, VEC, EXPR, nearest, lookOf, geom, headsOf, heading: (a) => (a._b ? a._b.h : a.dir), mood(a) { if (a.kind !== 'npc' && a.kind !== 'player') return 0; if ((a._moodT = (a._moodT || 0) - 1) > 0) return a._mood || 0; a._moodT = 30; let e = 0; try { const k = G.portrait && a.kind === 'npc' && G.portrait.exprOf(a); e = EXPR[{ fear: 'fear', pain: 'pain', anger: 'angry', angry: 'angry', hurt: 'pain', liking: 'happy', happy: 'happy', grief: 'sad', sad: 'sad', exhausted: 'tired', tired: 'tired', suspicious: 'suspicious' }[typeof k === 'string' ? k : (k && k.name) || '']] || 0; } catch (x) { e = 0; } return (a._mood = e); } };
G.body.headingAng = (h) => [Math.PI / 2, Math.PI, 0, -Math.PI / 2, Math.PI * 0.75, Math.PI * 0.25, -Math.PI * 0.75, -Math.PI * 0.25][h];
})();
