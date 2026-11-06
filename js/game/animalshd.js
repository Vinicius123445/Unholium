'use strict';
// HD animals: every species drawn at twice the resolution (like the HD people), shaded, with a real body:
// a torso lit from the front-left, the far legs in shadow, jointed legs that walk in a lateral sequence and
// gallop in pairs (a rabbit hops, a chicken struts on two), a neck and head that dip to graze and come up
// when something comes close, ears, eyes with a glint, tails, and what makes each one itself: a stag's
// antlers and white rump, a wolf's ruff and brush, a boar's tusks and bristled back, a bear's hump, a cow's
// patches and udder, a horse's mane and long tail, a donkey's ears and pale muzzle, a dog's floppy ears and
// wagging tail, a cat's whiskers and curling tail, a rabbit's ears and cotton tail, a hen's comb and wattle.
// Frames (per facing): idle 2 (breathing), walk 6, run 4, graze 2, alert 1.
(() => {
const A = G.assets, AN = G.Animal.prototype, sh = (c, f) => A.shade(c, f), TAU = Math.PI * 2;
// the world's coats: nothing shines, nothing is clean (a little grey, a little less light)
const mute = (c) => { if (!/^#[0-9a-f]{6}$/i.test(c || '')) return c; const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), g = (v[0] + v[1] + v[2]) / 3; return '#' + v.map((q) => Math.round((q * 0.74 + g * 0.26) * 0.84).toString(16).padStart(2, '0')).join(''); };
const COLS = { idle: 0, walk: 2, run: 8, graze: 12, alert: 14 }, N = 15, K = 2;   // K: pixels per world pixel
// world size (w, h), body length/height, leg length, neck, head, and the look
const SPEC = {
  rabbit:  { w: 13, h: 11, bl: 8, bh: 5.5, leg: 2.5, neck: 1, hl: 4, hh: 3.5, gait: 'hop', ears: 'long', tail: 'cotton', fur: '#9a8268', belly: '#e8dcc8' },
  chicken: { w: 11, h: 12, bl: 6.5, bh: 5.5, leg: 3.2, neck: 2, hl: 3, hh: 3, gait: 'biped', bird: true, fur: '#efece4', belly: '#f8f6f0' },
  cat:     { w: 15, h: 11, bl: 9, bh: 4.5, leg: 3.4, neck: 1.5, hl: 3.6, hh: 3.4, ears: 'point', tail: 'cat', fur: '#8a7058', belly: '#d8c8b0', stripes: true },
  dog:     { w: 19, h: 15, bl: 11, bh: 6, leg: 5, neck: 2.5, hl: 5, hh: 4, ears: 'floppy', tail: 'dog', fur: '#a07a4a', belly: '#e0c89a' },
  wolf:    { w: 23, h: 16, bl: 13, bh: 6.5, leg: 6, neck: 3, hl: 5.5, hh: 4.2, ears: 'point', tail: 'brush', fur: '#7e7a72', belly: '#d8d4cc', ruff: true },
  boar:    { w: 23, h: 15, bl: 14, bh: 8, leg: 4, neck: 1, hl: 6, hh: 5, ears: 'small', tail: 'thin', fur: '#5a4a3c', belly: '#7a6a58', tusks: true, bristle: true, snout: true },
  deer:    { w: 26, h: 25, bl: 14, bh: 7, leg: 9, neck: 6, hl: 5.5, hh: 3.8, ears: 'deer', tail: 'deer', fur: '#a06a3c', belly: '#f0e4d0', rump: true },
  cow:     { w: 31, h: 23, bl: 19, bh: 10, leg: 7, neck: 3, hl: 6.5, hh: 5, ears: 'side', tail: 'tuft', fur: '#f2efe8', belly: '#f8f6f2', patches: '#34302c', udder: true, horns: true, muzzle: '#e8b0a8' },
  horse:   { w: 33, h: 27, bl: 19, bh: 9, leg: 10, neck: 7, hl: 7, hh: 4.2, ears: 'horse', tail: 'long', fur: '#7a4a2a', belly: '#8a5a38', mane: '#2a1a12', hooves: '#2a2420' },
  donkey:  { w: 27, h: 22, bl: 16, bh: 8, leg: 8, neck: 5, hl: 6.5, hh: 4.2, ears: 'donkey', tail: 'tuft', fur: '#8a8480', belly: '#d8d4cc', mane: '#4a4440', muzzle: '#e8e4dc', hooves: '#2a2420' },
  bear:    { w: 31, h: 22, bl: 19, bh: 10, leg: 6.5, neck: 2, hl: 6.5, hh: 5.5, ears: 'round', tail: 'stub', fur: '#4a3426', belly: '#5a4232', hump: true, snout: true },
};
const cache = {};

// ---------------------------------------------------------------- one frame (facing left), at K x
function frame(kind, s, opt, mode, f) {
  const W = (s.w + 4) * K, H = (s.h + 3) * K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.scale(K, K); x.lineCap = 'round'; x.lineJoin = 'round';
  const ground = s.h + 2, cx = (s.w + 4) / 2;
  const fur = mute(opt.color || s.fur), belly = mute(s.belly), dark = sh(fur, 0.7), light = sh(fur, 1.18);
  // the gait: phase of each leg, body bob, head height
  const ph = mode === 'walk' ? f / 6 : mode === 'run' ? f / 4 : 0;
  let bob = 0, headDrop = 0, headUp = 0, breathe = 0;
  if (mode === 'idle') breathe = f ? 0.25 : 0;
  if (mode === 'walk') bob = Math.abs(Math.sin(ph * TAU)) * 0.35;
  if (mode === 'run') bob = s.gait === 'hop' ? Math.sin(ph * Math.PI) * 3 : Math.sin(ph * TAU) * 0.9;
  if (mode === 'graze') headDrop = 1;
  if (mode === 'alert') headUp = 1;
  const legTop = ground - s.leg - bob;
  const bodyY = legTop - s.bh / 2 + 0.8;
  const bx0 = cx - s.bl / 2, bx1 = cx + s.bl / 2;   // head at bx0 (left)
  // where the legs are on the body: front pair near the chest, hind pair near the rump
  const legs = s.gait === 'biped' ? [{ x: cx + 0.5, off: 0, near: 0 }, { x: cx + 1.5, off: 0.5, near: 1 }]
    : [{ x: bx1 - 2.2, off: 0, near: 0 }, { x: bx0 + 2.4, off: 0.25, near: 0 }, { x: bx1 - 1.2, off: 0.5, near: 1 }, { x: bx0 + 3.4, off: 0.75, near: 1 }];
  const gallop = mode === 'run' && s.gait !== 'hop' && s.gait !== 'biped';
  const legAng = (l, i) => {
    if (mode === 'walk') return Math.sin((ph + l.off) * TAU) * 0.45;
    if (mode === 'run') { if (s.gait === 'hop') return (i < 2 ? -0.6 : 0.7) * Math.sin(ph * Math.PI); const o = gallop ? [0, 0.5, 0.1, 0.6][i] : l.off; return Math.sin((ph + o) * TAU) * 0.8; }
    if (mode === 'graze' && i % 2) return 0.08;
    return 0;
  };
  const leg = (l, i, far) => {
    const a = legAng(l, i), len = s.leg + bob, hipY = legTop;
    const kx = l.x + Math.sin(a) * len * 0.5, ky = hipY + Math.cos(a) * len * 0.5;
    const knee = (i % 2 === 0 ? 1 : -1) * Math.max(0, -Math.sin(a)) * 0.9;   // the joint bends as the leg swings back
    const fx = kx + Math.sin(a * 0.6 + knee * 0.3) * len * 0.5, fy = Math.min(ground, ky + Math.cos(a * 0.6) * len * 0.5);
    const wid = Math.max(0.9, s.bl / 9);
    x.strokeStyle = far ? sh(fur, 0.62) : sh(fur, 0.88); x.lineWidth = wid * (s.bird ? 0.45 : 1);
    if (s.bird) x.strokeStyle = far ? '#7e6430' : '#a88440';
    x.lineWidth = wid * (s.bird ? 0.45 : 1.75); x.beginPath(); x.moveTo(l.x, hipY - 0.8); x.lineTo(kx, ky); x.stroke(); x.lineWidth = wid * (s.bird ? 0.45 : 0.85); x.beginPath(); x.moveTo(kx, ky); x.lineTo(fx, fy); x.stroke();
    // the foot: hooves, paws, a bird's toes
    if (s.bird) { x.lineWidth = 0.4; x.beginPath(); x.moveTo(fx - 1.2, fy); x.lineTo(fx + 1, fy); x.moveTo(fx, fy); x.lineTo(fx - 0.6, fy - 0.2); x.stroke(); }
    else { x.fillStyle = s.hooves || (far ? sh(fur, 0.45) : sh(fur, 0.6)); x.fillRect(fx - wid / 2 - 0.2, fy - 0.8, wid + 0.4, 0.9); }
  };
  // ground shadow is drawn by the game; a contact shade under the feet here
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(cx, ground + 0.2, s.bl / 2 + 1, 0.9, 0, 0, TAU); x.fill();
  // far legs first (darker), then the tail, the body, the near legs, the neck and head
  legs.forEach((l, i) => { if (!l.near) leg(l, i, true); });
  // ---- tail
  const tx = bx1 - 0.4, ty = bodyY - s.bh * 0.15, wag = Math.sin((mode === 'walk' || mode === 'run' ? ph : f * 0.5) * TAU) * 0.6;
  x.strokeStyle = dark; x.fillStyle = dark;
  if (s.tail === 'cotton') { x.fillStyle = '#b8b09e'; x.beginPath(); x.arc(tx + 0.4, ty, 1.4, 0, TAU); x.fill(); }
  else if (s.tail === 'cat') { x.lineWidth = 1; x.beginPath(); x.moveTo(tx, ty); x.bezierCurveTo(tx + 3, ty - 1, tx + 3.5 + wag, ty - 4, tx + 2 + wag, ty - 6); x.stroke(); }
  else if (s.tail === 'dog') { x.lineWidth = 1.1; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + 3, ty - 2, tx + 3.4 + wag, ty - 4.5); x.stroke(); }
  else if (s.tail === 'brush') { x.fillStyle = sh(fur, 0.8); x.beginPath(); x.ellipse(tx + 3, ty + 2, 3.6, 1.6, 0.7 + wag * 0.2, 0, TAU); x.fill(); x.fillStyle = '#2a2622'; x.beginPath(); x.arc(tx + 5.6, ty + 4.2, 0.9, 0, TAU); x.fill(); }
  else if (s.tail === 'deer') { x.fillStyle = '#b8b09e'; x.beginPath(); x.ellipse(tx + 0.6, ty - 0.4, 1, 1.6, 0.3, 0, TAU); x.fill(); x.fillStyle = dark; x.fillRect(tx + 0.3, ty - 2, 0.8, 1); }
  else if (s.tail === 'long') { x.strokeStyle = s.mane || dark; x.lineWidth = 1.6; x.beginPath(); x.moveTo(tx, ty - 0.5); x.quadraticCurveTo(tx + 3.5, ty + 1 + wag, tx + 2.5 + wag, ty + s.leg * 0.85); x.stroke(); x.lineWidth = 0.6; x.beginPath(); x.moveTo(tx + 0.5, ty); x.quadraticCurveTo(tx + 4.5, ty + 2, tx + 3.4 + wag, ty + s.leg * 0.9); x.stroke(); }
  else if (s.tail === 'tuft') { x.lineWidth = 0.6; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + 1.6, ty + 2, tx + 1.2 + wag * 0.5, ty + s.leg * 0.7); x.stroke(); x.fillStyle = s.mane || '#2a2420'; x.beginPath(); x.ellipse(tx + 1.2 + wag * 0.5, ty + s.leg * 0.75, 0.8, 1.4, 0, 0, TAU); x.fill(); }
  else if (s.tail === 'thin') { x.lineWidth = 0.5; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + 1.4, ty + 2 + wag); x.stroke(); }
  else if (s.tail === 'stub') { x.fillStyle = dark; x.beginPath(); x.arc(tx + 0.4, ty, 1, 0, TAU); x.fill(); }
  // ---- body: shaded torso, lit from the front-left
  const by = bodyY - breathe * 0.4;
  const g = x.createLinearGradient(0, by - s.bh / 2, 0, by + s.bh / 2);
  g.addColorStop(0, light); g.addColorStop(0.55, fur); g.addColorStop(1, sh(fur, 0.78));
  x.fillStyle = g;
  if (s.bird) {   // a hen: round body, tail feathers up, a wing
    x.beginPath(); x.ellipse(cx + 0.5, by, s.bl / 2, s.bh / 2 + breathe * 0.2, 0, 0, TAU); x.fill();
    x.fillStyle = sh(fur, 0.82); x.beginPath(); x.moveTo(bx1 - 0.5, by - 0.5); x.lineTo(bx1 + 2, by - 4); x.lineTo(bx1 + 0.5, by + 0.5); x.closePath(); x.fill();
    x.fillStyle = sh(fur, 0.88); x.beginPath(); x.ellipse(cx + 1, by + 0.3, 2.4, 1.6, 0.2, 0, TAU); x.fill();
  } else {
    x.beginPath(); x.ellipse(cx, by - s.bh * 0.04, s.bl / 2, s.bh * 0.44 + breathe * 0.2, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(bx0 + s.bl * 0.2, by + s.bh * 0.05, s.bl * 0.23, s.bh * 0.56, 0, 0, TAU); x.ellipse(bx1 - s.bl * 0.2, by - s.bh * 0.02, s.bl * 0.25, s.bh * 0.58, 0, 0, TAU); x.fill();
    if (s.hump) { x.fillStyle = light; x.beginPath(); x.ellipse(bx0 + s.bl * 0.32, by - s.bh * 0.38, s.bl * 0.2, s.bh * 0.28, 0, 0, TAU); x.fill(); }
    // belly, lighter
    x.fillStyle = belly; x.globalAlpha = 0.4; x.beginPath(); x.ellipse(cx, by + s.bh * 0.28, s.bl * 0.36, s.bh * 0.2, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
    if (s.rump) { x.fillStyle = '#b8b09e'; x.beginPath(); x.ellipse(bx1 - 1, by - 0.3, 1.3, 2, 0, 0, TAU); x.fill(); }
    if (s.patches) { const r = new G.RNG(kind + 'patch'); x.fillStyle = s.patches; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(bx0 + 3 + r.range(0, s.bl - 6), by + r.range(-s.bh * 0.35, s.bh * 0.2), r.range(1.4, 3), r.range(1, 2.2), r.range(0, 3), 0, TAU); x.fill(); } }
    if (s.stripes) { x.strokeStyle = sh(fur, 0.68); x.lineWidth = 0.6; for (let i = 0; i < 4; i++) { const sx2 = bx0 + 2.5 + i * 1.8; x.beginPath(); x.moveTo(sx2, by - s.bh / 2 + 0.3); x.lineTo(sx2 + 0.5, by); x.stroke(); } }
    if (s.bristle) { x.strokeStyle = sh(fur, 0.55); x.lineWidth = 0.5; for (let i = 0; i < 10; i++) { const sx2 = bx0 + 2 + i * (s.bl - 4) / 10; x.beginPath(); x.moveTo(sx2, by - s.bh / 2 + 0.6); x.lineTo(sx2 - 0.4, by - s.bh / 2 - 0.9); x.stroke(); } }
    if (s.udder && mode !== 'run') { x.fillStyle = '#a8847a'; x.beginPath(); x.ellipse(bx1 - 4, by + s.bh / 2 - 0.3, 1.8, 1.1, 0, 0, TAU); x.fill(); }
    // fur texture: a few short strokes
    const r2 = new G.RNG(kind + 'fur'); x.strokeStyle = sh(fur, 0.86); x.lineWidth = 0.35;
    for (let i = 0; i < Math.round(s.bl * 0.8); i++) { const fx = bx0 + 1 + r2.range(0, s.bl - 2), fy = by + r2.range(-s.bh * 0.35, s.bh * 0.3); x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + 0.6, fy + 0.5); x.stroke(); }
    // rim light along the back
    x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 0.5; x.beginPath(); x.ellipse(cx, by, s.bl / 2 - 0.4, s.bh / 2 - 0.4, 0, Math.PI * 1.15, Math.PI * 1.75); x.stroke();
  }
  legs.forEach((l, i) => { if (l.near) leg(l, i, false); });
  // ---- neck and head (graze: down to the grass; alert: up)
  const nx = bx0 + 1, ny = by - s.bh * 0.25;
  const hdAng = headDrop ? 1.05 : headUp ? -0.55 : s.neck > 4 ? -0.35 : 0;
  const hx = nx - Math.cos(hdAng + 0.3) * s.neck - s.hl * 0.25, hy = ny - Math.sin(-hdAng + 0.6) * s.neck * 0.9 + (headDrop ? s.leg * 0.85 : 0) - headUp * 1.2;
  if (s.neck > 1.2) { x.strokeStyle = sh(fur, 0.96); x.lineWidth = Math.max(1.4, s.bh * 0.55); x.beginPath(); x.moveTo(nx + 1.2, ny + 0.4); x.lineTo(hx + s.hl * 0.25, hy + 0.3); x.stroke(); }
  if (s.mane) { x.strokeStyle = s.mane; x.lineWidth = 1.1; x.beginPath(); x.moveTo(nx + 2.2, ny - s.bh * 0.25); x.lineTo(hx + s.hl * 0.35, hy - s.hh * 0.45); x.stroke(); }
  if (s.ruff) { x.fillStyle = sh(fur, 1.08); x.beginPath(); x.ellipse(nx + 0.6, ny + 0.6, 2.2, s.bh * 0.46, 0.3, 0, TAU); x.fill(); x.strokeStyle = sh(fur, 0.8); x.lineWidth = 0.35; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(nx - 0.8 + i * 0.5, ny - 1.6 + i * 0.8); x.lineTo(nx - 1.4 + i * 0.5, ny - 0.4 + i * 0.8); x.stroke(); } }
  // the head: a skull and a snout pointing left (down when grazing)
  x.save(); x.translate(hx, hy); x.rotate(headDrop ? -0.5 : headUp ? 0.12 : 0);
  const hg = x.createLinearGradient(0, -s.hh / 2, 0, s.hh / 2); hg.addColorStop(0, light); hg.addColorStop(1, sh(fur, 0.85));
  x.fillStyle = hg;
  x.beginPath(); x.ellipse(0, 0, s.hl * 0.42, s.hh / 2, 0, 0, TAU); x.fill();   // skull
  const snoutL = s.bird ? 0 : s.hl * 0.55;
  x.fillStyle = s.muzzle ? mute(s.muzzle) : fur; x.beginPath(); x.ellipse(-s.hl * 0.42, s.hh * 0.12, snoutL * 0.6, s.hh * 0.32, 0, 0, TAU); x.fill();
  if (s.snout) { x.fillStyle = s.tusks ? '#c8988a' : '#2a201a'; x.beginPath(); x.ellipse(-s.hl * 0.42 - snoutL * 0.55, s.hh * 0.12, 0.6, s.hh * 0.26, 0, 0, TAU); x.fill(); }
  else if (!s.bird) { x.fillStyle = '#1e1a18'; x.beginPath(); x.arc(-s.hl * 0.42 - snoutL * 0.5, s.hh * 0.02, 0.45, 0, TAU); x.fill(); }   // the nose
  if (s.tusks) { x.strokeStyle = '#c0b8a2'; x.lineWidth = 0.55; x.beginPath(); x.moveTo(-s.hl * 0.55, s.hh * 0.3); x.quadraticCurveTo(-s.hl * 0.75, s.hh * 0.1, -s.hl * 0.68, -s.hh * 0.15); x.stroke(); }
  if (s.bird) {
    x.fillStyle = '#a88440'; x.beginPath(); x.moveTo(-s.hl * 0.42, -0.2); x.lineTo(-s.hl * 0.42 - 1.6, 0.3); x.lineTo(-s.hl * 0.42, 0.8); x.fill();   // beak
    x.fillStyle = '#8e2a26'; x.beginPath(); x.ellipse(0, -s.hh / 2 - 0.3, 1.1, 0.8, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(-0.6, -s.hh / 2 - 0.5, 0.6, 0.6, 0, 0, TAU); x.fill();   // comb
    x.beginPath(); x.ellipse(-s.hl * 0.42 + 0.2, 1.3, 0.45, 0.8, 0, 0, TAU); x.fill();   // wattle
  }
  // the eye, with a glint
  x.fillStyle = '#141210'; x.beginPath(); x.arc(-s.hl * 0.12, -s.hh * 0.12, Math.max(0.45, s.hh * 0.11), 0, TAU); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(-s.hl * 0.12 - 0.2, -s.hh * 0.12 - 0.35, 0.3, 0.3);
  if (s.ears === 'long') { x.fillStyle = fur; for (const d of [0, 0.9]) { x.save(); x.translate(s.hl * 0.15 + d, -s.hh * 0.35); x.rotate(0.25 + d * 0.12 - headUp * 0.2); x.beginPath(); x.ellipse(0.5, -2.6, 0.75, 2.6, 0, 0, TAU); x.fill(); x.fillStyle = '#e8b8b0'; x.beginPath(); x.ellipse(0.5, -2.4, 0.35, 1.8, 0, 0, TAU); x.fill(); x.fillStyle = fur; x.restore(); } }
  else if (s.ears === 'point' || s.ears === 'horse' || s.ears === 'deer' || s.ears === 'donkey') { const eh = s.ears === 'donkey' ? 3.2 : s.ears === 'horse' ? 1.8 : s.ears === 'deer' ? 2 : 1.6; x.fillStyle = dark; x.beginPath(); x.moveTo(s.hl * 0.05, -s.hh * 0.3); x.lineTo(s.hl * 0.22 + (s.ears === 'deer' ? 0.8 : 0.2), -s.hh * 0.4 - eh); x.lineTo(s.hl * 0.36, -s.hh * 0.25); x.fill(); if (s.ears === 'donkey') { x.fillStyle = '#2a2622'; x.fillRect(s.hl * 0.2, -s.hh * 0.4 - eh, 0.6, 0.6); } }
  else if (s.ears === 'floppy') { x.fillStyle = dark; x.beginPath(); x.ellipse(s.hl * 0.25, s.hh * 0.05, 0.9, 1.9, -0.35, 0, TAU); x.fill(); }
  else if (s.ears === 'round') { x.fillStyle = dark; x.beginPath(); x.arc(s.hl * 0.2, -s.hh * 0.45, 1, 0, TAU); x.fill(); }
  else if (s.ears === 'side' || s.ears === 'small') { x.fillStyle = dark; x.beginPath(); x.ellipse(s.hl * 0.32, -s.hh * 0.2, 1.3, 0.6, -0.4, 0, TAU); x.fill(); }
  if (s.horns) { x.strokeStyle = '#b0a68c'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(s.hl * 0.1, -s.hh * 0.45); x.quadraticCurveTo(s.hl * 0.05, -s.hh * 0.9, -0.3, -s.hh); x.stroke(); }
  if (opt.antlers) { x.strokeStyle = '#a2957a'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(s.hl * 0.1, -s.hh * 0.45); x.lineTo(s.hl * 0.3, -s.hh * 0.45 - 5); x.moveTo(s.hl * 0.18, -s.hh * 0.45 - 2); x.lineTo(-0.8, -s.hh * 0.45 - 4); x.moveTo(s.hl * 0.25, -s.hh * 0.45 - 3.6); x.lineTo(s.hl * 0.8, -s.hh * 0.45 - 5.4); x.moveTo(s.hl * 0.3, -s.hh * 0.45 - 5); x.lineTo(s.hl * 0.05, -s.hh * 0.45 - 6.8); x.stroke(); }
  if (kind === 'cat') { x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 0.25; for (const d of [-0.5, 0, 0.5]) { x.beginPath(); x.moveTo(-s.hl * 0.6, s.hh * 0.15); x.lineTo(-s.hl * 0.6 - 2.2, s.hh * 0.15 + d); x.stroke(); } }
  if (mode === 'graze' && f && !s.bird) { x.fillStyle = '#5a8a3a'; x.fillRect(-s.hl * 0.6 - snoutL * 0.6, s.hh * 0.3, 0.8, 1.2); }   // a mouthful of grass
  x.restore();
  return c;
}

function sheet(kind, color, opt = {}) {
  const s = SPEC[kind]; if (!s) return null;
  const key = kind + color + JSON.stringify(opt);
  if (cache[key]) return cache[key];
  const plan = [['idle', 0], ['idle', 1], ...[0, 1, 2, 3, 4, 5].map((f) => ['walk', f]), ...[0, 1, 2, 3].map((f) => ['run', f]), ['graze', 0], ['graze', 1], ['alert', 0]];
  const o = Object.assign({}, opt);
  const f0 = frame(kind, s, o, 'idle', 0), fw = f0.width, fh = f0.height;
  const c = document.createElement('canvas'); c.width = fw * N; c.height = fh * 2;
  const x = c.getContext('2d');
  plan.forEach(([mode, f], col) => {
    const fc = col === 0 ? f0 : frame(kind, s, o, mode, f);
    x.drawImage(fc, col * fw, 0);
    x.save(); x.translate(col * fw + fw, fh); x.scale(-1, 1); x.drawImage(fc, 0, 0); x.restore();   // row 1: facing right
  });
  return (cache[key] = { img: c, fw, fh, dw: fw / K, dh: fh / K, animal: true, animal2: true, hd: true, kind });
}
G.animalsHD = { sheet, SPEC };
// the carcass and anything else that asks for the HD sheet gets this one
if (G.animals2) G.animals2.sheet = (kind, color, opt) => sheet(kind, color, opt || {});

const _draw = AN.draw;
AN.draw = function (ctx) {
  if (this.dead || !SPEC[this.species]) return _draw.call(this, ctx);
  if (!this.antlerOpt && this.sheet && this.sheet.opt) this.antlerOpt = this.sheet.opt;
  const s2 = this._sheetHD || (this._sheetHD = sheet(this.species, null, this.antlerOpt || {}));
  const st = this._a2 || (this._a2 = { phase: 0, lx: this.x, ly: this.y, t: Math.random() * 5, grazeT: 0, face: this.facingRight ? 1 : 0, turnT: 0 });
  const dt = Math.min(0.1, G.loop.time - (st.last || G.loop.time)); st.last = G.loop.time;
  const moved = Math.hypot(this.x - st.lx, this.y - st.ly); st.lx = this.x; st.ly = this.y;
  const fast = this.state === 'flee' || this.state === 'attack' || this.state === 'hunt' || moved / Math.max(dt, 0.001) > 45;
  if (this.moving && moved > 0.01) st.phase = (st.phase + moved / (fast ? 22 : 12)) % 1;
  st.t += dt;
  const s = SPEC[this.species], p = G.player, near = p && Math.hypot(p.x - this.x, p.y - this.y) < 60;
  const grazer = ['rabbit', 'deer', 'cow', 'horse', 'donkey', 'boar', 'chicken'].includes(this.species);
  if (!this.moving && grazer && !near) { if ((st.grazeT -= dt) <= -6) st.grazeT = 4 + Math.random() * 6; } else st.grazeT = 0;
  const face = this.facingRight ? 1 : 0;
  if (face !== st.face) { st.face = face; st.turnT = 0.12; }
  if (st.turnT > 0) st.turnT -= dt;
  let col;
  if (this.moving) col = fast ? COLS.run + Math.floor(st.phase * 4) % 4 : COLS.walk + Math.floor(st.phase * 6) % 6;
  else if (near) col = COLS.alert;
  else if (st.grazeT > 0) col = COLS.graze + (Math.floor(st.t * 2.5) % 2);
  else col = COLS.idle + (Math.floor(st.t * 0.8) % 2);
  if (this.drawShadow) this.drawShadow(ctx);
  const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0;
  const img = flash ? A.white(s2.img) : s2.img;
  ctx.save();
  ctx.translate(Math.round(this.x * 2) / 2, Math.round((this.y + 1) * 2) / 2);
  if (this.young) ctx.scale(0.65, 0.65);
  if (st.turnT > 0) ctx.scale(Math.max(0.3, 1 - st.turnT * 6), 1);
  const smooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, col * s2.fw, face * s2.fh, s2.fw, s2.fh, -s2.dw / 2, -s2.dh, s2.dw, s2.dh);
  ctx.imageSmoothingEnabled = smooth;
  ctx.restore();
  void s;
};
})();
