'use strict';
// Animals in eight directions, built like the people (js/game/realbody.js): a body in three dimensions, turned and projected, painted back
// to front. Every species and breed has its own measurements, so a greyhound and a pit bull are different bodies and not one sprite
// resized. Sizes are real, at 20 pixels to the metre. Each has its gait (four beats walking, diagonal pairs at a trot, gathered pairs at a
// gallop, a rabbit's hop, a hen's strut), and eats, drinks, rests, sleeps and looks up. Frames are painted on demand and cached.
(() => {
const A = G.assets, sh = A.shade, DEG = Math.PI / 180, R3 = 3, PITCH = 0.42, AN = G.Animal.prototype;
const ANG = G.body.ANG, TAU = Math.PI * 2;
// L length, H height at the shoulder, D body depth, W width, nl neck, na neck angle, hl head, hw head width, sn muzzle (0-1), leg thickness
const B = (o) => Object.assign({ L: 18, H: 11, D: 4, W: 3.4, nl: 4.4, na: 30, hl: 5, hw: 2.4, sn: 0.5, lt: 1.1, ears: 'point', tail: 'dog', tl: 7, gait: 'quad', tuck: 0.2 }, o);
const SP = {
  rabbit: B({ L: 8, H: 3.4, D: 2.7, W: 2.4, nl: 1, na: 35, hl: 3, hw: 1.7, sn: 0.26, lt: 0.7, ears: 'long', tail: 'cotton', gait: 'hop', fur: '#9a8268', belly: '#e8dcc8', hind: 1.2 }),
  chicken: B({ L: 7, H: 5, D: 3, W: 2.6, gait: 'bird', fur: '#efece4', belly: '#f8f6f0', hl: 2, hw: 1.3, comb: '#b82a26' }),
  wolf: B({ L: 21, H: 13, D: 4.6, W: 3.5, nl: 5, hl: 6, hw: 2.7, sn: 0.62, ears: 'point', tail: 'brush', tl: 9, fur: '#7e7a72', belly: '#d8d4cc', ruff: 1, long: 1 }),
  boar: B({ L: 24, H: 12, D: 6.4, W: 5, nl: 2, na: 8, hl: 7, hw: 3.4, sn: 0.5, lt: 1.5, ears: 'small', tail: 'thin', tl: 4, fur: '#5a4a3c', belly: '#7a6a58', tusks: 1, bristle: 1, snout: 1, tuck: 0 }),
  deer: B({ L: 26, H: 21, D: 5, W: 3.6, nl: 11, na: 55, hl: 6.4, hw: 2.1, sn: 0.5, lt: 0.95, ears: 'deer', tail: 'deer', tl: 3, fur: '#a06a3c', belly: '#f0e4d0', rump: '#f0e8dc' }),
  cow: B({ L: 36, H: 24, D: 8.6, W: 6.4, nl: 6, na: 12, hl: 9, hw: 3.8, sn: 0.5, lt: 1.9, ears: 'side', tail: 'tuft', tl: 15, fur: '#f2efe8', belly: '#f8f6f2', hoof: '#2a2420', horns: 1, udder: 1, patches: '#34302c', muzzle: '#e8b0a8', tuck: 0 }),
  horse: B({ L: 34, H: 28, D: 6.8, W: 5, nl: 13, na: 50, hl: 10, hw: 2.8, sn: 0.55, lt: 1.5, ears: 'horse', tail: 'long', tl: 16, fur: '#7a4a2a', belly: '#8a5a38', hoof: '#2a2420', mane: '#2a1a12' }),
  donkey: B({ L: 26, H: 22, D: 6, W: 4.6, nl: 9, na: 38, hl: 8.6, hw: 2.8, sn: 0.5, lt: 1.25, ears: 'donkey', tail: 'tuft', tl: 11, fur: '#8a8480', belly: '#d8d4cc', hoof: '#2a2420', mane: '#4a4440', muzzle: '#e8e4dc' }),
  bear: B({ L: 32, H: 19, D: 8.6, W: 7, nl: 3, na: 12, hl: 8, hw: 4, sn: 0.46, lt: 2.6, ears: 'round', tail: 'stub', tl: 2, fur: '#4a3426', belly: '#5a4232', hump: 1, long: 1, tuck: 0 }),
  dog: B({ L: 17, H: 11, D: 3.8, W: 3, nl: 4, hl: 5, hw: 2.3, sn: 0.5, ears: 'floppy', fur: '#a07a4a', belly: '#e0c89a' }),
  cat: B({ L: 11, H: 6.6, D: 2.5, W: 2, nl: 2, na: 32, hl: 3, hw: 2, sn: 0.2, lt: 0.68, ears: 'cat', tail: 'cat', tl: 10, fur: '#8a7058', belly: '#d8c8b0', tuck: 0.25 }),
};
const BREED = {
  dog: { mutt: {}, shepherd: { L: 20, H: 13.6, D: 4.2, hl: 6, sn: 0.62, ears: 'point', tail: 'brush', tl: 9, long: 1, mark: 'saddle' }, pitbull: { L: 15, H: 10, D: 4.4, W: 4.4, nl: 2.6, na: 22, hl: 4.8, hw: 3.3, sn: 0.36, lt: 1.5, ears: 'small', tl: 6, tuck: 0.35 }, rottweiler: { L: 20, H: 14, D: 5, W: 4.6, nl: 3, hl: 5.6, hw: 3.3, sn: 0.4, lt: 1.6, tl: 3, tail: 'stub', mark: 'tan' }, greyhound: { L: 20, H: 15, D: 3.8, W: 2, nl: 7, na: 42, hl: 6.2, hw: 1.5, sn: 0.82, lt: 0.72, ears: 'rose', tl: 11, tail: 'thin', tuck: 0.72 }, labrador: { L: 18, H: 12.4, D: 4.4, W: 3.6, hl: 5.2, hw: 2.6, sn: 0.46, lt: 1.25, tail: 'otter' }, husky: { L: 18, H: 12.4, D: 4.2, W: 3.4, ears: 'point', tail: 'curl', hl: 5, long: 1, ruff: 1, mark: 'mask' }, chihuahua: { L: 7, H: 5, D: 2, W: 1.5, nl: 1.5, hl: 2.8, hw: 1.9, sn: 0.2, lt: 0.46, ears: 'bat', tl: 4, tail: 'thin', tuck: 0.4 }, dalmatian: { L: 19, H: 13.6, D: 4, W: 2.9, sn: 0.56, tl: 9, tail: 'thin', tuck: 0.4 } },
  cat: { alley: { mark: 'tabby' }, siamese: { L: 11, H: 6.8, D: 2.1, W: 1.7, hw: 1.6, sn: 0.34, lt: 0.56, ears: 'bat', mark: 'points' }, mainecoon: { L: 15, H: 8.4, D: 3.3, W: 2.8, hw: 2.4, lt: 0.85, ears: 'tuft', tail: 'brush', tl: 12, long: 1, ruff: 1, mark: 'tabby' }, bengal: { L: 12, H: 7.2, D: 2.6, W: 2, lt: 0.72 }, persian: { L: 11, H: 5.4, D: 3.3, W: 3, nl: 1, hw: 2.7, hl: 2.4, sn: 0.04, lt: 0.74, ears: 'small', tail: 'brush', tl: 8, long: 1, ruff: 1 }, sphynx: { L: 11, H: 6.8, D: 2.2, W: 1.8, hw: 1.7, sn: 0.26, lt: 0.56, ears: 'bat', tail: 'thin', bare: 1 } },
  horse: { quarter: { D: 7.4, W: 5.4, lt: 1.6 }, thoroughbred: { L: 36, H: 31, D: 6.2, W: 4.2, nl: 15, hl: 10.4, lt: 1.3, tuck: 0.4 }, arabian: { L: 31, H: 27, D: 6, W: 4.2, nl: 15, na: 58, hl: 8.6, hw: 2.8, lt: 1.25, sn: 0.4, tail: 'high' }, mustang: { L: 31, H: 26, D: 6.6, W: 4.8, lt: 1.5, shag: 1 }, clydesdale: { L: 40, H: 34, D: 8.8, W: 6.6, nl: 14, hl: 11.4, hw: 3.4, lt: 2.3, feather: 1, tuck: 0 }, appaloosa: { L: 32, H: 27 } },
  donkey: { standard: {}, mammoth: { L: 30, H: 27, D: 6.8, W: 5, lt: 1.55, hl: 9.8 }, miniature: { L: 17, H: 15, D: 5, W: 3.8, nl: 6, hl: 6.2, hw: 2.4, lt: 1 } },
  cow: { holstein: {}, jersey: { L: 31, H: 21, D: 7.4, W: 5.4, fur: '#a8784a', patches: null, hl: 7.6, hw: 3.2, belly: '#e0c8a8', muzzle: '#2a2420' }, angus: { L: 36, H: 23, D: 9.6, W: 7.4, fur: '#1e1c1c', belly: '#2a2626', patches: null, horns: 0, udder: 0, muzzle: '#3a3232', lt: 2.1 } },
  chicken: { rhode: { fur: '#8a3a22', belly: '#a84a2a' }, leghorn: { fur: '#f4f2ec', comb: '#d02a22' } },
};
const specOf = (sp, breed) => Object.assign({}, SP[sp], (BREED[sp] || {})[breed] || {});

function paint(sp, s, coat, dark, dir, mode, f, opt) {
  const th = ANG[dir], Fx = Math.sin(th), Fz = Math.cos(th), Sx = Math.cos(th), Sz = -Math.sin(th), span = s.L + s.hl + (s.tl || 0) + 8, W = Math.ceil(span * 1.5) + 8, Hh = Math.ceil(s.H + s.nl + s.hl + 16 + span * 0.2), cx = W / 2, ground = Hh - Math.ceil(span * 0.22) - 3;
  const c = document.createElement('canvas'); c.width = W * R3; c.height = Hh * R3; const x = c.getContext('2d'); x.scale(R3, R3); x.lineCap = 'round'; x.lineJoin = 'round'; c._ax = cx; c._ay = ground;
  const P = (fd, sd, y) => { const X = sd * Sx + fd * Fx, Z = sd * Sz + fd * Fz; return { x: cx + X, y: ground - y * 0.93 + Z * PITCH, z: Z }; };
  const items = [], add = (z, fn) => items.push({ z, fn });
  const cap = (a, b, r0, r1, col, st = 0.2) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 0.01, nx = -dy / l, ny = dx / l, g = x.createLinearGradient(a.x + nx * r0, a.y + ny * r0, a.x - nx * r0, a.y - ny * r0), left = (nx < 0) === (ny >= 0); g.addColorStop(0, left ? sh(col, 0.74) : sh(col, 1.14)); g.addColorStop(0.5, col); g.addColorStop(1, left ? sh(col, 1.14) : sh(col, 0.74)); x.fillStyle = g; x.beginPath(); x.moveTo(a.x + nx * r0, a.y + ny * r0); x.lineTo(b.x + nx * r1, b.y + ny * r1); x.arc(b.x, b.y, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); x.lineTo(a.x - nx * r0, a.y - ny * r0); x.arc(a.x, a.y, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true); x.closePath(); x.fill(); if (st) { x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = st; x.stroke(); } };
  const rng = (seed) => { let q = seed * 7919 + 17; return () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; };
  const ph = mode === 'walk' ? f / 6 : mode === 'run' ? f / 6 : 0, L = s.L;
  // ------------------------------------------------ a hen
  if (s.gait === 'bird') {
    const stepA = mode === 'walk' || mode === 'run' ? Math.sin(ph * TAU) * 0.6 : 0, peck = mode === 'graze', sit = mode === 'sleep' || mode === 'rest', bY = sit ? 2 : s.H - (mode === 'run' ? 0.6 : 0), bc = P(0, 0, bY + 1), legC = '#c89a3a';
    if (!sit) for (const i of [0, 1]) { const a = i ? stepA : -stepA, sd = i ? 1 : -1, hip = P(0, sd, bY - 1.4), foot = P(Math.sin(a) * 4, sd, Math.max(0, 0.3 + Math.max(0, Math.cos(ph * TAU + i * Math.PI)) * 1.2)); add(hip.z - 0.2, () => { x.strokeStyle = legC; x.lineWidth = 0.56; x.beginPath(); x.moveTo(hip.x, hip.y); x.lineTo(foot.x, foot.y); x.stroke(); const t = P(Math.sin(a) * 4 + 1.5, sd, 0.2); x.beginPath(); x.moveTo(foot.x, foot.y); x.lineTo(t.x, t.y); x.stroke(); }); }
    const tail = P(-5, 0, bY + 3.4), bk = P(-2.6, 0, bY + 0.6), fr = P(2.4, 0, bY + 1.4), hd = P(peck ? 5.6 : 4, 0, peck ? 1.4 + (f ? 1.2 : 0) : bY + 5), nb = P(peck ? 3.4 : 2.8, 0, peck ? bY : bY + 2.6);
    add(bk.z - 0.4, () => { for (const k of [-1, 0, 1]) { const t = P(-5.4, k * 1.3, bY + 3.8 - Math.abs(k) * 0.6); cap(bk, t, 1.1, 0.34, sh(coat, k ? 0.9 : 0.8), 0.1); } });
    add(bc.z, () => { cap(bk, fr, 3, 2.7, coat, 0.16); const r = rng(5); for (let i = 0; i < 22; i++) { const q = P(-3.4 + r() * 6.8, (r() - 0.5) * 4.6, bY + r() * 3); x.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'; x.lineWidth = 0.22; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - Fx * 1, q.y + 0.4); x.stroke(); } for (const sd of [-1, 1]) { const w0 = P(1.4, sd * 2.5, bY + 1.8), w1 = P(-2.8, sd * 2.7, bY + 1.2); if ((sd * Sz) > -0.7) cap(w0, w1, 1.4, 0.5, sh(coat, 0.84), 0.12); } });
    add(hd.z + 1, () => { cap(nb, hd, 1.5, 1.1, coat, 0.12); const g2 = s.hw; x.fillStyle = coat; x.beginPath(); x.arc(hd.x, hd.y, g2, 0, 6.3); x.fill(); const bk2 = P((peck ? 5.6 : 4) + 2, 0, (peck ? 1.2 : bY + 4.8)); x.fillStyle = '#c89a3a'; x.beginPath(); x.moveTo(hd.x - Sx * 0.6, hd.y - 0.4); x.lineTo(bk2.x, bk2.y); x.lineTo(hd.x + Sx * 0.6, hd.y + 0.4); x.closePath(); x.fill(); for (let i = 0; i < 3; i++) { const q = P((peck ? 5.6 : 4) - 0.8 + i * 0.8, 0, (peck ? 2.4 : bY + 6.2) + (i === 1 ? 0.4 : 0)); x.fillStyle = s.comb || '#b82a26'; x.beginPath(); x.arc(q.x, q.y, 0.56, 0, 6.3); x.fill(); } for (const sd of [-1, 1]) { const e = P((peck ? 5.6 : 4) + 0.5, sd * 1, (peck ? 1.6 : bY + 5.3)); if (sd * Sz + Fz > -0.2 || Math.abs(Fz) < 0.9) { x.fillStyle = '#141210'; x.beginPath(); x.arc(e.x, e.y, 0.3, 0, 6.3); x.fill(); } } });
    items.sort((a, b) => a.z - b.z); for (const it of items) it.fn(); return c;
  }
  // ------------------------------------------------ four legs
  const down = mode === 'sleep' || mode === 'rest', run = mode === 'run', walk = mode === 'walk', gal = run && s.gait !== 'hop', hop = s.gait === 'hop';
  const off = gal ? [0, 0.1, 0.5, 0.6] : run ? [0, 0.5, 0.5, 0] : [0, 0.5, 0.25, 0.75], amp = run ? 0.72 : walk ? 0.38 : 0;
  const legH = s.H * 0.98, bob = hop && run ? Math.abs(Math.sin(ph * Math.PI)) * 3 : gal ? Math.sin(ph * TAU * 2) * 0.9 : run ? Math.abs(Math.sin(ph * TAU)) * 0.5 : walk ? Math.sin(ph * TAU * 2) * 0.22 : 0;
  const bodyY = (down ? s.D * 1.05 : legH + s.D * 0.15) + bob, breathe = mode === 'idle' && f ? 0.15 : 0;
  const rumpF = -L * 0.5 + s.D * 0.7, chestF = L * 0.5 - s.D * 0.7, rump = P(rumpF, 0, bodyY + (s.hump ? -0.4 : 0)), chest = P(chestF, 0, bodyY + (s.hump ? 1 : 0) + breathe);
  const legAt = [{ fd: chestF + 0.8, sd: -s.W * 0.72 }, { fd: chestF + 0.8, sd: s.W * 0.72 }, { fd: rumpF - 0.8, sd: -s.W * 0.72 }, { fd: rumpF - 0.8, sd: s.W * 0.72 }];
  legAt.forEach((l, i) => {
    const hip = P(l.fd, l.sd, bodyY - s.D * 0.5), hindK = i > 1 ? 1 : 0, a = hop ? (i > 1 ? -1 : 1) * Math.sin(ph * Math.PI) * (run ? 0.9 : 0.3) : amp ? Math.sin((ph + off[i]) * TAU) * amp : 0, lift = amp ? Math.max(0, Math.cos((ph + off[i]) * TAU)) * (run ? 0.9 : 0.5) : 0, len = bodyY - s.D * 0.5, u = len * 0.52, kf = l.fd + Math.sin(a) * u + (hindK ? -0.5 : 0.3), ky = bodyY - s.D * 0.5 - Math.cos(a) * u + lift * 0.5, af = kf + Math.sin(a - lift * (hindK ? -0.7 : 0.7)) * u, ay = Math.max(0.2, ky - Math.cos(a - lift) * u) + lift * 0.4;
    if (down) { const kn = P(l.fd + (hindK ? -1 : 2), l.sd * 1.3, s.D * 0.7), p2 = P(l.fd + (hindK ? 2.4 : 5), l.sd * 1.1, 0.5); add(hip.z, () => { cap(hip, kn, s.lt * 1.3, s.lt, coat, 0.14); cap(kn, p2, s.lt, s.lt * 0.8, coat, 0.14); }); return; }
    const kn = P(kf, l.sd, ky), an = P(af, l.sd, ay), col = Math.abs(l.sd * Sz + l.fd * Fz) >= 0 && (l.sd * Sz) < 0 ? sh(coat, 0.84) : coat, mark = s.feather ? '#f0ece4' : null, sock = opt.sock;
    add(hip.z + (i > 1 ? 0 : 0.01), () => { cap(hip, kn, s.lt * (hindK ? 1.7 : 1.4), s.lt * 0.96, col, 0.14); cap(kn, an, s.lt * 0.9, s.lt * 0.66, sock || mark || col, 0.12); if (s.feather) cap(an, P(af, l.sd, 0.1), s.lt * 1.1, s.lt * 1.3, '#f0ece4', 0.1); if (s.hoof) { x.fillStyle = s.hoof; x.beginPath(); x.ellipse(an.x, an.y + 0.2, s.lt * 0.84, s.lt * 0.5, 0, 0, 6.3); x.fill(); } else { const t = P(af + s.lt * 1.2, l.sd, Math.max(0.2, ay - 0.1)); cap(an, t, s.lt * 0.7, s.lt * 0.56, sock || sh(col, 0.92), 0.1); } });
  });
  // the tail
  const tailBase = P(-L * 0.5, 0, bodyY + s.D * 0.35), tp = (k, a, sw) => P(-L * 0.5 - Math.cos(a) * k, sw * k * 0.3, bodyY + s.D * 0.35 + Math.sin(a) * k), wag = (walk || run ? Math.sin(ph * TAU * 2) : Math.sin(f * 2)) * 0.5;
  add(tailBase.z - 0.3, () => {
    const t = s.tail, tl = s.tl || 0;
    if (t === 'cotton') { x.fillStyle = '#f4efe6'; x.beginPath(); x.arc(tailBase.x, tailBase.y, 1.3, 0, 6.3); x.fill(); return; }
    if (t === 'stub') { cap(tailBase, tp(tl, 0.4, 0), 1, 0.6, coat, 0.1); return; }
    if (t === 'deer') { cap(tailBase, tp(tl, down ? -0.8 : 0.6, 0), 1.1, 0.8, coat, 0.1); return; }
    if (t === 'curl') { const a = tp(tl * 0.5, 1.2, 0), b = P(-L * 0.5 + 2, wag * 0.8, bodyY + s.D + 2.2); cap(tailBase, a, 1.4, 1.5, coat, 0.1); cap(a, b, 1.5, 0.8, s.belly, 0.1); return; }
    if (t === 'tuft') { const b = tp(tl, -1.25, wag * 0.2); cap(tailBase, b, 0.6, 0.3, coat, 0.1); cap(b, tp(tl + 3.4, -1.3, wag * 0.2), 0.9, 0.3, s.mane || sh(coat, 0.4), 0.1); return; }
    if (t === 'long' || t === 'high') { const a0 = t === 'high' ? 0.7 : -0.4, m = tp(tl * 0.42, a0, wag * 0.2), b = tp(tl, -1.3, wag * 0.3); const mc = s.mane || dark; cap(tailBase, m, 1.3, 1.5, mc, 0.1); cap(m, b, 1.5, 0.5, sh(mc, 1.1), 0.1); return; }
    const a = t === 'cat' ? (down ? -0.1 : 0.7 + wag * 0.3) : t === 'brush' ? -0.5 : t === 'otter' ? -0.1 : 0.35, m = tp(tl * 0.6, a, wag * 0.5), b = t === 'cat' ? tp(tl, a + 0.8, wag) : tp(tl, a - 0.2, wag), r = t === 'brush' ? 1.7 * Math.max(0.7, s.lt) : t === 'otter' ? 1.2 : Math.max(0.42, s.lt * 0.5);
    cap(tailBase, m, r * 0.7, r, coat, 0.1); cap(m, b, r, t === 'brush' ? r * 0.5 : r * 0.5, t === 'brush' ? s.belly : coat, 0.1);
  });
  // the body
  add((rump.z + chest.z) / 2, () => {
    const bellyC = s.belly, mid = P((rumpF + chestF) / 2, 0, bodyY - (s.tuck ? s.D * s.tuck * 0.18 : 0));
    cap(rump, mid, s.D * 0.96, s.D * (1 - s.tuck * 0.4), coat); cap(mid, chest, s.D * (1 - s.tuck * 0.4), s.D, coat);
    const dx = chest.x - rump.x, dy = chest.y - rump.y, along = (t, sd, dy2) => P(rumpF + (chestF - rumpF) * t, sd, bodyY + dy2);
    // the belly catches less light, the back more
    if (Math.abs(Fx) > 0.2) { const a = along(0.1, 0, -s.D * 0.66), b = along(0.9, 0, -s.D * 0.7); x.strokeStyle = bellyC; x.lineWidth = s.D * 0.34; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); x.globalAlpha = 1; }
    if (!s.bare) { const r = rng(s.L * 7 | 0), n = Math.round(s.L * s.D * (s.long ? 2.4 : 1.4)); for (let i = 0; i < n; i++) { const t = r(), a = r() * 6.283, q = along(t, Math.cos(a) * s.W * 0.86, Math.sin(a) * s.D * 0.9), l = s.long ? 1.5 : 0.8; x.strokeStyle = r() < 0.5 ? `rgba(0,0,0,${s.long ? 0.16 : 0.1})` : `rgba(255,245,225,${s.long ? 0.14 : 0.08})`; x.lineWidth = s.long ? 0.26 : 0.16; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x - dx / (Math.hypot(dx, dy) || 1) * l, q.y - dy / (Math.hypot(dx, dy) || 1) * l + 0.3); x.stroke(); } }
    const blot = (t, sd, y2, rx, ry, col) => { const q = along(t, sd, y2); x.fillStyle = col; x.beginPath(); x.ellipse(q.x, q.y, rx, ry, 0, 0, 6.3); x.fill(); };
    if (s.patches) { const r = rng(9); for (let i = 0; i < 6; i++) blot(0.1 + r() * 0.8, (r() - 0.5) * s.W * 1.6, (r() - 0.3) * s.D, 2.4 + r() * 3.4, 1.8 + r() * 2.4, s.patches); }
    const spots = opt.spots; if (spots) { const r = rng(4); for (let i = 0; i < s.L * 1.3; i++) blot(r(), (r() - 0.5) * s.W * 1.7, (r() - 0.4) * s.D * 1.5, 0.5 + r() * 0.5, 0.4 + r() * 0.4, spots); }
    if (s.mark === 'saddle') { const a = along(0.2, 0, s.D * 0.6), b = along(0.8, 0, s.D * 0.6); x.strokeStyle = dark; x.lineWidth = s.D * 0.7; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
    if (s.mark === 'tabby') { x.strokeStyle = 'rgba(30,20,12,0.5)'; x.lineWidth = 0.42; for (let i = 0; i < 6; i++) { const a = along(0.12 + i * 0.15, -s.W * 0.7, s.D * 0.5), b = along(0.12 + i * 0.15, s.W * 0.7, s.D * 0.5); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
    if (s.mark === 'tan') blot(0.86, 0, -s.D * 0.5, 1.8, 1.2, '#a86a2c');
    if (s.rump) blot(0.02, 0, 0.3, s.D * 0.6, s.D * 0.7, s.rump);
    if (s.udder) { const q = along(0.14, 0, -s.D * 1.05); x.fillStyle = s.muzzle || '#e8b0a8'; x.beginPath(); x.ellipse(q.x, q.y, 2.2, 1.5, 0, 0, 6.3); x.fill(); }
    if (s.bristle) { x.strokeStyle = sh(coat, 0.5); x.lineWidth = 0.34; for (let i = 0; i < 12; i++) { const q = along(i / 11, 0, s.D * 0.96); x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x, q.y - 1.4); x.stroke(); } }
    if (s.hump) blot(0.8, 0, s.D * 0.74, s.D * 0.66, s.D * 0.5, sh(coat, 1.1));
    if (opt.saddle) { const a = along(0.56, 0, s.D * 0.94), m2 = along(0.56, s.W * 0.9, 0), n2 = along(0.56, -s.W * 0.9, 0); x.fillStyle = '#4a2e1a'; x.beginPath(); x.ellipse(a.x, a.y, s.D * 0.9, s.D * 0.42, 0, 0, 6.3); x.fill(); x.strokeStyle = '#2a1a10'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(n2.x, n2.y); x.lineTo(a.x, a.y); x.lineTo(m2.x, m2.y); x.stroke(); }
  });
  // the neck and the head
  const pose = mode === 'graze' ? -68 : mode === 'alert' ? s.na + 18 : mode === 'sleep' ? -8 : s.na, na = pose * DEG, nbF = chestF + s.D * 0.5, nbY = bodyY + s.D * 0.3, ntF = nbF + Math.cos(na) * s.nl, ntY = down ? s.D * (mode === 'sleep' ? 0.9 : 1.9) + s.hw * 0.6 : Math.max(s.hw * 0.7, nbY + Math.sin(na) * s.nl), chew = mode === 'graze' && f ? 0.3 : 0, nb = P(nbF, 0, nbY), nt = P(ntF, 0, ntY), hAng = mode === 'graze' ? -74 * DEG : (mode === 'sleep' ? -14 : -12 - (s.nl > 8 ? 26 : 4)) * DEG, snF = ntF + Math.cos(hAng) * s.hl, snY = Math.max(0.5 + chew, ntY + Math.sin(hAng) * s.hl), sn = P(snF, 0, snY), hd0 = P(ntF + Math.cos(hAng) * s.hl * 0.24, 0, ntY + Math.sin(hAng) * s.hl * 0.24);
  add(Math.max(nb.z, nt.z) + 0.6, () => {
    cap(nb, nt, Math.max(s.D * 0.56, s.hw * 0.9), s.hw * 0.8, coat, 0.16);
    if (s.ruff) { x.fillStyle = s.belly; x.globalAlpha = 0.55; x.beginPath(); x.ellipse(nb.x, nb.y, s.D * 0.9, s.D * 0.8, 0, 0, 6.3); x.fill(); x.globalAlpha = 1; }
    if (s.mane) { const mc = s.mane, sg = (s.shag ? 1.5 : 1); for (let k = 0; k <= 7; k++) { const t = k / 7, q = P(nbF + (ntF - nbF) * t - 0.5, 0, nbY + (ntY - nbY) * t + s.hw * 0.7), e = { x: q.x - Sx * 1.4 * sg, y: q.y + 2.6 * sg }; x.strokeStyle = k % 2 ? mc : sh(mc, 1.3); x.lineWidth = 0.95; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(e.x, e.y); x.stroke(); } }
  });
  add(Math.max(sn.z, hd0.z) + 1, () => {
    const hw = s.hw, snR = Math.max(0.4, hw * (0.42 + (1 - s.sn) * 0.4)), muz = s.muzzle || sh(coat, s.mark === 'mask' ? 1.5 : 1.1), eS = hw * 0.74, back = Fz < -0.2;
    // ears sit behind the crown, so seen from behind they are in front of it
    const ear = () => { for (const sd of [-1, 1]) { const b = P(ntF - 0.3, sd * hw * 0.62, ntY + hw * 0.56), e = s.ears; if (e === 'long') { const t = P(ntF - 3, sd * hw * 0.9, ntY + hw + 5.4); cap(b, t, 0.7, 0.72, coat, 0.1); } else if (e === 'floppy' || e === 'rose') { const t = P(ntF + (e === 'rose' ? -1 : 0.2), sd * hw * 1.26, ntY - (e === 'rose' ? -1 : hw * 0.7)); cap(b, t, hw * 0.42, hw * 0.3, sh(dark, 1.1), 0.1); } else if (e === 'round') { x.fillStyle = sh(coat, 0.8); x.beginPath(); x.arc(b.x, b.y - 0.4, 1.3, 0, 6.3); x.fill(); } else if (e === 'side') { const t = P(ntF - 0.5, sd * (hw + 3), ntY + 0.6); cap(b, t, 0.9, 0.7, coat, 0.1); } else if (e === 'small') { const t = P(ntF - 0.8, sd * hw * 1, ntY + hw * 1.1); cap(b, t, 0.7, 0.3, sh(coat, 0.82), 0.1); } else { const h2 = { donkey: 6.6, horse: 2.8, deer: 3.8, bat: hw * 1.7, cat: hw * 1.1, tuft: hw * 1.3, point: hw * 1.1 }[e] || 2, w2 = { bat: hw * 0.72, donkey: 1, deer: 1.1 }[e] || hw * 0.42, t = P(ntF - 0.7, sd * (hw * 0.72 + (e === 'deer' ? 1.2 : 0)), ntY + hw * 0.6 + h2); x.fillStyle = sh(coat, 0.86); x.beginPath(); x.moveTo(b.x - w2, b.y); x.lineTo(t.x, t.y); x.lineTo(b.x + w2, b.y); x.closePath(); x.fill(); x.fillStyle = 'rgba(220,160,150,0.4)'; x.beginPath(); x.moveTo(b.x - w2 * 0.5, b.y); x.lineTo((b.x + t.x) / 2, (b.y + t.y) / 2); x.lineTo(b.x + w2 * 0.5, b.y); x.closePath(); x.fill(); if (e === 'tuft') { x.strokeStyle = sh(dark, 0.8); x.lineWidth = 0.2; x.beginPath(); x.moveTo(t.x, t.y); x.lineTo(t.x, t.y - 1); x.stroke(); } } } };
    if (!back) ear();
    if (opt.antlers) for (const sd of [-1, 1]) { const b = P(ntF - 0.6, sd * hw * 0.5, ntY + hw * 0.7), t = P(ntF - 3, sd * 3.4, ntY + hw + 8); x.strokeStyle = '#a2957a'; x.lineWidth = 0.56; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(t.x, t.y); x.stroke(); for (const k of [0.4, 0.72]) { const m = { x: b.x + (t.x - b.x) * k, y: b.y + (t.y - b.y) * k }, e = P(ntF + 0.6, sd * 3.8 * k, ntY + hw + 8 * k); x.beginPath(); x.moveTo(m.x, m.y); x.lineTo(e.x, e.y); x.stroke(); } }
    if (s.horns) for (const sd of [-1, 1]) { const b = P(ntF - 0.2, sd * hw * 0.74, ntY + hw * 0.6), t = P(ntF + 0.4, sd * (hw + 2.4), ntY + hw + 1.6); x.strokeStyle = '#c0b69c'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(t.x, t.y); x.stroke(); }
    cap(hd0, sn, hw, snR, coat, 0.18);
    if (s.mark === 'mask' || s.mark === 'points') { cap(P(ntF + (snF - ntF) * 0.5, 0, ntY + (snY - ntY) * 0.5), sn, hw * 0.7, snR * 0.92, s.mark === 'mask' ? '#f4f2ec' : dark, 0); }
    if (s.muzzle) { cap(P(ntF + (snF - ntF) * 0.68, 0, ntY + (snY - ntY) * 0.68), sn, snR * 1.04, snR * 1.04, s.muzzle, 0.12); }
    if (s.snout) { x.fillStyle = sh(coat, 1.3); x.beginPath(); x.ellipse(sn.x, sn.y, snR * 0.8, snR * 0.7, 0, 0, 6.3); x.fill(); }
    if (s.tusks) for (const sd of [-1, 1]) { const b = P(snF - 0.7, sd * snR * 0.8, snY - 0.2), t = P(snF - 0.2, sd * snR * 1.1, snY + 2); x.strokeStyle = '#d8d0ba'; x.lineWidth = 0.56; x.beginPath(); x.moveTo(b.x, b.y); x.lineTo(t.x, t.y); x.stroke(); }
    if (Fz > -0.5) { x.fillStyle = s.hoof ? 'rgba(20,14,12,0.6)' : '#141010'; x.beginPath(); x.arc(sn.x + Fx * snR * 0.6, sn.y + Fz * snR * 0.18, Math.max(0.3, snR * 0.34), 0, 6.3); x.fill(); }
    for (const sd of [-1, 1]) { const e = P(ntF + Math.cos(hAng) * s.hl * 0.34, sd * eS, ntY + Math.sin(hAng) * s.hl * 0.34 + hw * 0.34), nz = sd * Sz + Fz * 0.6; if (nz < -0.1) continue; if (mode === 'sleep') { x.strokeStyle = sh(coat, 0.5); x.lineWidth = 0.22; x.beginPath(); x.moveTo(e.x - 0.5, e.y); x.lineTo(e.x + 0.5, e.y); x.stroke(); } else { x.fillStyle = sp === 'cat' ? '#8ac840' : '#141210'; x.beginPath(); x.arc(e.x, e.y, Math.max(0.34, hw * 0.17), 0, 6.3); x.fill(); if (sp === 'cat') { x.fillStyle = '#100c08'; x.fillRect(e.x - 0.1, e.y - 0.3, 0.2, 0.6); } x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(e.x - 0.2, e.y - 0.26, 0.17, 0.17); } }
    if (sp === 'cat' && Fz > -0.2) { x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 0.12; for (const sd of [-1, 1]) for (const d of [-0.4, 0.4]) { const a = P(snF, sd * 0.4, snY), b = P(snF, sd * 3.2, snY + d); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
    if (back) ear();
    if (mode === 'graze' && f) { x.fillStyle = '#5a8a3a'; x.fillRect(sn.x - 0.5, sn.y, 1, 1.4); }
  });
  items.sort((a, b) => a.z - b.z); for (const it of items) it.fn();
  return c;
}
const CAP = 900, frames = new Map();
const frameOf = (key, make) => { let c = frames.get(key); if (c) { frames.delete(key); frames.set(key, c); return c; } c = make(); frames.set(key, c); if (frames.size > CAP) frames.delete(frames.keys().next().value); return c; };
// draws one animal, feet at (x, y)
function draw(ctx, sp, breed, coat, dark, dir, mode, f, o, x, y, k) {
  const key = [sp, breed, coat, dir, mode, f, o.antlers ? 1 : 0, o.saddle ? 1 : 0].join('|');
  const c = frameOf(key, () => paint(sp, specOf(sp, breed), coat, dark, dir, mode, f, o)), was = ctx.imageSmoothingEnabled, w = c.width / R3, h = c.height / R3;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = 'rgba(0,0,0,0.24)'; const s = SP[sp], len = (specOf(sp, breed).L || 10) * 0.5 * k, wd = (specOf(sp, breed).W || 3) * 1.1 * k, vx = Math.abs(G.body.VEC[dir][0]), dg = vx && G.body.VEC[dir][1] ? 0.72 : vx; ctx.beginPath(); ctx.ellipse(x, y - 0.5, Math.max(wd, len * dg + wd * (1 - dg)), Math.max(wd * 0.6, len * (1 - dg) * 0.42 + wd * 0.5), 0, 0, 6.3); ctx.fill(); void s;
  ctx.drawImage(c, x - c._ax * k, y - c._ay * k, w * k, h * k); ctx.imageSmoothingEnabled = was;
}
const heading = (st, a, x, y) => { const mx = x - st.lx, my = y - st.ly; st.lx = x; st.ly = y; st.dx = st.dx * 0.7 + mx * 0.3; st.dy = st.dy * 0.7 + my * 0.3; if (a.moving && Math.hypot(st.dx, st.dy) > 0.04 && Math.abs(mx) + Math.abs(my) < 14) { const want = G.body.nearest(st.dx, st.dy); if (want !== st.h) { st.tt = (st.tt || 0) + 1; if (st.tt > 2) { st.tt = 0; const R = [0, 5, 2, 7, 3, 6, 1, 4], i = R.indexOf(st.h), j = R.indexOf(want), d = (j - i + 8) % 8; st.h = R[(i + (d <= 4 ? 1 : -1) + 8) % 8]; } } } return st.h; };
// the wild and the farmed
const _dn = AN.draw;
AN.draw = function (ctx) {
  if (this.dead || !SP[this.species] || (this.def && this.def.beast)) return _dn.call(this, ctx);
  const st = this._ra || (this._ra = { lx: this.x, ly: this.y, dx: 0, dy: 0, h: this.facingRight ? 2 : 1, phase: 0, t: Math.random() * 5, rest: 0 }), dt = Math.min(0.1, G.loop.time - (st.last || G.loop.time)); st.last = G.loop.time; st.t += dt;
  const wasX = st.lx, wasY = st.ly, dir = heading(st, this, this.x, this.y), moved = Math.hypot(this.x - wasX, this.y - wasY), fast = this.state === 'flee' || this.state === 'attack' || this.state === 'hunt' || moved / Math.max(dt, 0.001) > 45, S = SP[this.species];
  if (this.moving && moved > 0.01) st.phase = (st.phase + moved / ((fast ? 1.1 : 0.7) * (S.L + 10))) % 1;
  const p = G.player, near = p && Math.hypot(p.x - this.x, p.y - this.y) < 60, night = G.world && G.world.isNight && G.world.isNight();
  let mode = 'idle', f = Math.floor(st.t * 0.8) % 2;
  if (this.moving) { mode = fast ? 'run' : 'walk'; f = Math.floor(st.phase * 6) % 6; }
  else if (this.needT > 0) { mode = 'graze'; f = Math.floor(st.t * 2.6) % 2; }
  else if (this.hurtTimer > 0 || near) mode = 'alert', f = 0;   // (a blow: the head comes up at once)
  else if (night) { mode = 'sleep'; f = 0; }
  else if (Math.sin(st.t * 0.13 + this.x) > 0.7) { mode = 'rest'; f = 0; }
  const k = this.young ? 0.62 : 1, flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0, fl = ctx.filter; if (flash) ctx.filter = 'brightness(2.4)';
  const opt = this.antlerOpt || (this.sheet && this.sheet.opt) || {}, coat = (this.rec && this.rec.coat) || null, breed = this.breed || (this.rec && this.rec.breed) || Object.keys(BREED[this.species] || {})[0];
  draw(ctx, this.species, breed, (coat && coat[0]) || specOf(this.species, breed).fur, (coat && coat[1]) || sh(specOf(this.species, breed).fur, 0.6), dir, mode, f, { antlers: opt.antlers }, this.x, this.y + 1, k);
  if (flash) ctx.filter = fl;
};
// pets and working animals, which have breeds and coats of their own
G.beasts.draw = function (ctx, b, x, y, face, phase, speed, t, o = {}) {
  const sp = b.species, breed = b.breed || (b.rec && b.rec.breed) || Object.keys(BREED[sp] || {})[0], [coat, dark] = b.coat || (b.rec && b.rec.coat) || G.beasts.coatOf(sp, b.rid || b.id || sp), base = (G.breeds.of(b) || {}), k = (o.scale || 1), tr = o.track || b, st = tr._ra || (tr._ra = { lx: x, ly: y, dx: 0, dy: 0, h: face ? 2 : 1, t2: 0 }), dir = heading(st, { moving: speed > 3 }, x, y); if (o.track) o.track.dir8 = dir;
  const mode = speed > 75 ? 'run' : speed > 3 ? 'walk' : b.sleeping ? 'sleep' : b.needT > 0 ? 'graze' : (Math.sin(t * 0.17 + (b.x || 0)) > 0.65 ? 'rest' : 'idle'), f = mode === 'walk' || mode === 'run' ? Math.floor(phase * 6) % 6 : mode === 'idle' || mode === 'graze' ? Math.floor(t * 1.4) % 2 : 0;
  draw(ctx, sp, breed, coat, dark, dir, mode, f, { saddle: o.saddle, spots: base.spots, sock: null }, x, y + 1, k);
};
G.realAnimal = { SP, BREED, specOf, paint };
})();
