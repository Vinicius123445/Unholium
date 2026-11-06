'use strict';
// Faces. A person in the street is thirteen pixels wide, so the face you read is the one in front of you when you talk:
// a painted portrait built from who they are. Nothing is a stock face: skull, jaw, eyes, nose, mouth and the marks of a life
// come from their look and a hash of their name; children, teenagers, adults and the old have the proportions they really
// have (a child's eyes sit low on a big round head, an old face has lost its fat and gained its lines).
//   G.portrait.exprOf(npc) reads the moment: fear, pain, anger, liking, suspicion, grief, exhaustion, surprise, disgust.
//   Expressions move the brows, lids and mouth; they ease from one to the next rather than snapping.
(() => {
const W = 128, H = 150, A = G.assets, sh = A.shade, mixc = A.mix;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const hashOf = (s) => G.util.hashString(String(s));
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
// brow: inner end up (+) or down (-), raised; eye: how open; mouth: curve, how open, how wide; teeth
const EX = {
  neutral: { brow: 0, lift: 0, eye: 1, curve: 0, open: 0, wide: 1, teeth: 0, squint: 0 },
  happy: { brow: 0.1, lift: 1, eye: 0.82, curve: 1, open: 0.15, wide: 1.2, teeth: 1, squint: 0.5 },
  sad: { brow: 1, lift: 1, eye: 0.74, curve: -0.7, open: 0, wide: 0.92, teeth: 0, squint: 0 },
  angry: { brow: -1.2, lift: -2, eye: 0.84, curve: -0.5, open: 0.1, wide: 1.1, teeth: 1, squint: 0.3 },
  fear: { brow: 1.2, lift: 4, eye: 1.46, curve: -0.3, open: 0.65, wide: 1.06, teeth: 0, squint: 0 },
  surprise: { brow: 0.3, lift: 5, eye: 1.4, curve: 0, open: 0.8, wide: 0.8, teeth: 0, squint: 0 },
  disgust: { brow: -0.7, lift: -1, eye: 0.7, curve: -0.8, open: 0.1, wide: 1, teeth: 0, squint: 0.7 },
  pain: { brow: 0.9, lift: 0, eye: 0.42, curve: -0.6, open: 0.32, wide: 1.2, teeth: 1, squint: 1 },
  tired: { brow: 0.3, lift: -1, eye: 0.6, curve: -0.2, open: 0, wide: 0.96, teeth: 0, squint: 0 },
  suspicious: { brow: -0.5, lift: -1, eye: 0.72, curve: -0.2, open: 0, wide: 0.9, teeth: 0, squint: 0.4 },
};
const ageOf = (l) => (l.kid === 'kid' || l.age === 'kid' ? 'kid' : l.kid === 'teen' ? 'teen' : l.kid ? 'kid' : /^#(c8c8c8|d8d8d8|b8b8b8|e0e0e0|a8a8a8)/i.test(l.hair || '') ? 'old' : 'adult');

function traits(look, seedName) {
  const r = rnd(hashOf(seedName + (look.skin || '') + (look.hair || '') + (look.hairStyle || 0))), age = ageOf(look), fem = look.body === 'f';
  return {
    age, fem, r,
    headW: (fem ? 27 : 30) + r() * 4 + (age === 'kid' ? 2 : 0), headH: age === 'kid' ? 33 : age === 'teen' ? 37 : 39 + r() * 3,
    jaw: age === 'kid' ? 0.7 : (fem ? 0.56 : 0.72) + r() * 0.16, chin: age === 'kid' ? 0.92 : 1 + r() * 0.14, cheek: 0.92 + r() * 0.12,
    eyeY: age === 'kid' ? 0.2 : age === 'teen' ? 0.1 : 0.04 + r() * 0.05, eyeGap: (age === 'kid' ? 14.5 : 12.6) + r() * 2, eyeSize: (age === 'kid' ? 6.4 : 4.8 + r() * 0.9), eyeTilt: (r() - 0.5) * 2.4,
    noseL: age === 'kid' ? 7 : 11 + r() * 5, noseW: (age === 'kid' ? 4 : 5) + r() * 2.4, lipFull: fem ? 1.2 + r() * 0.5 : 0.7 + r() * 0.5, mouthW: (age === 'kid' ? 9 : 11) + r() * 3.4,
    browH: (fem ? 1.6 : 2.6) + r() * 1, browGap: 3 + r() * 2, freckles: r() < 0.14, mole: r() < 0.2 ? [(r() - 0.5) * 34, 2 + r() * 24] : null, scar: age === 'adult' && r() < 0.1, ears: 0.9 + r() * 0.3,
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
function hairBack(x, T, l, cx, cy, col) {
  const s = l.hairStyle || 0; if (l.bald) return;
  const long = T.fem ? s % 3 !== 2 : s % 7 === 3; x.fillStyle = sh(col, 0.72);
  if (long) { x.beginPath(); x.ellipse(cx, cy - 6, T.headW * 1.16, T.headH * 1.02, 0, Math.PI, 0); x.lineTo(cx + T.headW * 1.2, cy + 50); x.quadraticCurveTo(cx, cy + 60, cx - T.headW * 1.2, cy + 50); x.closePath(); x.fill(); }
}
function hairTop(x, T, l, cx, cy, col) {
  const s = l.hairStyle || 0, r = rnd(hashOf(col) + s), top = cy - T.headH * 0.98, hw = T.headW;
  const style = l.bald ? 'bald' : ['short', 'side', 'crop', 'curl', 'long', 'slick', 'buzz', 'afro'][s % 8];
  if (style === 'bald') return;
  const g = x.createLinearGradient(cx - hw, top, cx + hw, top + 40); g.addColorStop(0, sh(col, 1.3)); g.addColorStop(0.5, col); g.addColorStop(1, sh(col, 0.66));
  x.fillStyle = g; x.beginPath();
  if (style === 'buzz') { x.globalAlpha = 0.72; x.ellipse(cx, cy - 8, hw * 1.0, T.headH * 0.9, 0, Math.PI * 1.03, -0.03 * Math.PI); x.closePath(); x.fill(); x.globalAlpha = 1; return; }
  if (style === 'afro') { x.ellipse(cx, cy - 16, hw * 1.34, T.headH * 1.02, 0, Math.PI * 0.98, 0.02 * Math.PI); x.closePath(); x.fill(); for (let i = 0; i < 260; i++) { const a = r() * Math.PI + Math.PI, d = r() * 1.0; x.fillStyle = r() < 0.5 ? sh(col, 1.24) : sh(col, 0.7); x.fillRect(cx + Math.cos(a) * hw * 1.3 * d, cy - 16 + Math.sin(a) * T.headH * d, 1.6, 1.6); } return; }
  const fringe = style === 'side' ? 7 : style === 'slick' ? -2 : style === 'crop' ? 2 : 5, part = style === 'side' ? 0.3 : style === 'slick' ? 0 : 0.08;
  x.moveTo(cx - hw * 1.08, cy - 2); x.bezierCurveTo(cx - hw * 1.3, cy - T.headH * 1.62, cx + hw * 1.3, cy - T.headH * 1.62, cx + hw * 1.08, cy - 2);
  x.quadraticCurveTo(cx + hw * 0.8, cy - T.headH * 0.5 + fringe, cx + hw * part, cy - T.headH * 0.52 + fringe * 0.4); x.quadraticCurveTo(cx - hw * 0.5, cy - T.headH * 0.5 + fringe * 1.4, cx - hw * 1.06, cy - 2);
  x.closePath(); x.fill();
  // strands follow the fall of the hair
  x.save(); x.clip(); x.lineWidth = 0.7;
  for (let i = 0; i < 240; i++) { const px = cx - hw * 1.1 + r() * hw * 2.2, py = top - 8 + r() * 42; x.strokeStyle = r() < 0.5 ? `rgba(255,240,220,${0.05 + r() * 0.1})` : `rgba(0,0,0,${0.06 + r() * 0.16})`; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (px - cx) * 0.2, py + 12, px + (px - cx) * 0.36, py + 22 + r() * 14); x.stroke(); }
  x.restore();
  if (style === 'curl') for (let i = 0; i < 90; i++) { const a = r() * Math.PI + Math.PI, d = 0.7 + r() * 0.36; x.strokeStyle = r() < 0.5 ? sh(col, 1.3) : sh(col, 0.62); x.lineWidth = 1.2; x.beginPath(); x.arc(cx + Math.cos(a) * hw * d, cy - 8 + Math.sin(a) * T.headH * 0.96 * d, 2.4, 0, 5); x.stroke(); }
}

function paint(look, name, ex) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), T = traits(look, name), E = ex, cx = W / 2, cy = 66, skin = look.skin || '#e0b088', hair = look.hair || '#3a2a1a', sd = sh(skin, 0.74), sdd = sh(skin, 0.55), lt = sh(skin, 1.14), r = T.r;
  // the room behind them, lit from the side
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2e3036'); bg.addColorStop(1, '#101114'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.translate(cx, cy); x.scale(1.24, 1.24); x.translate(-cx, -cy);   // close, the way you see someone across a table
  hairBack(x, T, look, cx, cy, hair);
  // shoulders and collar
  const top = look.shirt || '#4a4a52', sw = T.age === 'kid' ? 40 : T.fem ? 46 : 54; x.fillStyle = (() => { const g = x.createLinearGradient(cx - sw, 0, cx + sw, 0); g.addColorStop(0, sh(top, 1.14)); g.addColorStop(1, sh(top, 0.6)); return g; })();
  x.beginPath(); x.moveTo(cx - sw, H); x.quadraticCurveTo(cx - sw + 2, cy + T.headH * 1.14, cx - 15, cy + T.headH * 1.02); x.lineTo(cx + 15, cy + T.headH * 1.02); x.quadraticCurveTo(cx + sw - 2, cy + T.headH * 1.14, cx + sw, H); x.closePath(); x.fill();
  // neck
  x.fillStyle = (() => { const g = x.createLinearGradient(cx - 12, 0, cx + 12, 0); g.addColorStop(0, skin); g.addColorStop(1, sdd); return g; })(); { const nw = T.fem ? 11 : 14, y0 = cy + T.headH * 0.66, y1 = cy + T.headH * 1.16; x.beginPath(); x.moveTo(cx - nw, y0); x.quadraticCurveTo(cx - nw, y1 - 6, cx - nw - 7, y1); x.lineTo(cx + nw + 7, y1); x.quadraticCurveTo(cx + nw, y1 - 6, cx + nw, y0); x.closePath(); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(cx, cy + T.headH * 0.98, 15, 6, 0, 0, 6.3); x.fill();
  // ears
  const eY = cy + 2; x.fillStyle = sd; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * (T.headW + 1), eY, 4 * T.ears, 8 * T.ears, s * 0.15, 0, 6.3); x.fill(); x.strokeStyle = sdd; x.lineWidth = 0.8; x.beginPath(); x.ellipse(cx + s * (T.headW + 1), eY, 2 * T.ears, 5 * T.ears, s * 0.15, 0, 6.3); x.stroke(); }
  // skull and jaw
  const skull = () => { const w = T.headW, h = T.headH; x.beginPath(); x.moveTo(cx - w, cy - 6); x.bezierCurveTo(cx - w, cy - h * 1.26, cx + w, cy - h * 1.26, cx + w, cy - 6); x.bezierCurveTo(cx + w * T.cheek, cy + h * 0.46, cx + w * T.jaw, cy + h * 0.74, cx + w * 0.24, cy + h * T.chin); x.quadraticCurveTo(cx, cy + h * (T.chin + 0.06), cx - w * 0.24, cy + h * T.chin); x.bezierCurveTo(cx - w * T.jaw, cy + h * 0.74, cx - w * T.cheek, cy + h * 0.46, cx - w, cy - 6); x.closePath(); };
  const face = x.createRadialGradient(cx - 11, cy - 16, 6, cx + 4, cy + 4, T.headH * 1.34); face.addColorStop(0, lt); face.addColorStop(0.5, skin); face.addColorStop(0.86, sd); face.addColorStop(1, sdd);
  skull(); x.fillStyle = face; x.fill();
  x.save(); skull(); x.clip();
  // the planes of the face
  x.fillStyle = 'rgba(180,70,60,0.09)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * T.headW * 0.56, cy + 13, 11, 8, 0, 0, 6.3); x.fill(); }
  const g2 = x.createLinearGradient(cx - T.headW, 0, cx + T.headW, 0); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(10,6,4,0.34)'); x.fillStyle = g2; x.fillRect(0, 0, W, H);
  // pores and unevenness of real skin
  for (let i = 0; i < 700; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,225,0.03)' : 'rgba(60,20,10,0.035)'; x.fillRect(cx - 34 + r() * 68, cy - 44 + r() * 94, 1, 1); }
  if (T.freckles) for (let i = 0; i < 46; i++) { x.fillStyle = 'rgba(110,60,30,0.3)'; x.fillRect(cx - 22 + r() * 44, cy + 2 + r() * 14, 1.2, 1.2); }
  if (T.age === 'old') { x.strokeStyle = 'rgba(70,40,30,0.3)'; x.lineWidth = 0.8; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 18, cy - 24 - i * 5); x.quadraticCurveTo(cx, cy - 27 - i * 5, cx + 18, cy - 24 - i * 5); x.stroke(); } for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * 8, cy + 16); x.quadraticCurveTo(cx + s * 17, cy + 24, cx + s * 16, cy + 33); x.stroke(); for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx + s * (T.eyeGap + 10), cy - 2 + i * 3); x.lineTo(cx + s * (T.eyeGap + 16), cy - 4 + i * 5); x.stroke(); } } }
  else if (T.age === 'adult' && !T.fem) { x.strokeStyle = 'rgba(70,40,30,0.14)'; x.lineWidth = 0.8; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * 8, cy + 17); x.quadraticCurveTo(cx + s * 14, cy + 23, cx + s * 14, cy + 28); x.stroke(); } }
  x.restore();
  // eyes
  const ey = cy + T.eyeY * T.headH - 2 + (E.lift > 3 ? -0.5 : 0), iris = look.eyes && look.eyes !== '#1d1a22' ? look.eyes : ['#3a2616', '#4a3420', '#2e4a5e', '#3e5a3a', '#26221e'][Math.floor(T.mole ? 2 : r() * 5)];
  for (const s of [-1, 1]) {
    const ex0 = cx + s * T.eyeGap, ew = T.eyeSize * 1.5, eh = T.eyeSize * 0.62 * E.eye, tilt = s * T.eyeTilt * 0.05;
    x.save(); x.translate(ex0, ey); x.rotate(tilt);
    { const so = x.createRadialGradient(0, -1, 2, 0, -1, ew + 6); so.addColorStop(0, 'rgba(60,30,20,0.2)'); so.addColorStop(1, 'rgba(60,30,20,0)'); x.fillStyle = so; x.beginPath(); x.ellipse(0, -1, ew + 6, eh + 6, 0, 0, 6.3); x.fill(); }   // the socket falls into shadow
    x.beginPath(); x.moveTo(-ew, 1); x.quadraticCurveTo(0, -eh * 1.5, ew, 0.4); x.quadraticCurveTo(0, eh * 1.25, -ew, 1); x.closePath(); x.fillStyle = '#e6e0d6'; x.fill();
    x.save(); x.clip(); x.fillStyle = iris; x.beginPath(); x.arc(s * -0.4, 0, T.eyeSize * 0.68, 0, 6.3); x.fill(); x.fillStyle = sh(iris, 0.5); x.beginPath(); x.arc(s * -0.4, 0, T.eyeSize * 0.68, 0, 6.3); x.lineWidth = 1; x.strokeStyle = sh(iris, 0.45); x.stroke(); x.fillStyle = '#080608'; x.beginPath(); x.arc(s * -0.4, 0, T.eyeSize * (E.eye > 1.2 ? 0.26 : 0.34), 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(s * -0.4 - 2, -2.4, 1.8, 1.8);
    x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(-ew, -eh * 1.6, ew * 2, eh * 0.8); x.restore();
    x.strokeStyle = sh(hair, 0.42); x.lineWidth = T.fem ? 1.9 : 1.4; x.beginPath(); x.moveTo(-ew - 0.6, 1); x.quadraticCurveTo(0, -eh * 1.5, ew + 0.6, 0.4); x.stroke();
    x.strokeStyle = 'rgba(70,40,30,0.22)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-ew + 1, eh * 0.9 + 1); x.quadraticCurveTo(0, eh * 1.4 + 1, ew - 1, eh * 0.8 + 1); x.stroke();
    if (T.age === 'old' || E.eye < 0.65) { x.strokeStyle = 'rgba(70,40,30,0.3)'; x.beginPath(); x.moveTo(-ew, eh + 3.6); x.quadraticCurveTo(0, eh + 6.4, ew, eh + 2.6); x.stroke(); }
    if (E.squint) { x.fillStyle = sh(skin, 0.86); x.globalAlpha = E.squint * 0.6; x.fillRect(-ew, eh * 0.7, ew * 2, 2); x.globalAlpha = 1; }
    x.restore();
    // brow: its inner end tells most of the story
    const bi = ex0 - s * (T.eyeSize - T.browGap), bo = ex0 + s * (T.eyeSize * 1.7), by = ey - T.eyeSize * 1.5 - E.lift;
    x.strokeStyle = sh(hair, 0.62); x.lineWidth = T.browH; x.lineCap = 'round'; x.beginPath(); x.moveTo(bi, by - E.brow * 2.8 + 1); x.quadraticCurveTo((bi + bo) / 2, by - 2.6 - E.brow * 0.6, bo, by + 1.4); x.stroke(); x.lineCap = 'butt';
  }
  if (E.brow < -0.4) { x.strokeStyle = 'rgba(60,30,20,0.3)'; x.lineWidth = 0.9; for (const s of [-1.6, 1.6]) { x.beginPath(); x.moveTo(cx + s, ey - 9); x.lineTo(cx + s * 0.8, ey - 14); x.stroke(); } }
  // nose
  const ny = ey + T.noseL + 3; x.fillStyle = 'rgba(255,240,225,0.16)'; x.fillRect(cx - 1.6, ey - 3, 3.2, T.noseL);
  x.fillStyle = 'rgba(70,35,25,0.17)'; x.beginPath(); x.moveTo(cx + 3, ey - 2); x.quadraticCurveTo(cx + 5, ny - 6, cx + T.noseW, ny); x.quadraticCurveTo(cx, ny + 5, cx + 1, ny + 1); x.closePath(); x.fill();
  x.fillStyle = sd; x.beginPath(); x.ellipse(cx, ny + 0.6, T.noseW, 3.2, 0, 0, 6.3); x.fill(); x.fillStyle = lt; x.beginPath(); x.ellipse(cx - 1, ny - 1, 2.2, 1.6, 0, 0, 6.3); x.fill();
  x.fillStyle = 'rgba(30,12,10,0.66)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * (T.noseW * 0.56), ny + 2, 1.7, 1.1, 0, 0, 6.3); x.fill(); }
  // mouth
  const my = ny + (T.age === 'kid' ? 10 : 13), mw = T.mouthW * E.wide, lip = look.lips || (T.fem ? mixc(sh(skin, 0.7), '#a83844', 0.5) : mixc(sh(skin, 0.74), '#7a3a3c', 0.34)), bend = E.curve * 3.4, op = E.open * 11;
  if (op > 1) { x.fillStyle = '#1a0a0a'; x.beginPath(); x.moveTo(cx - mw * 0.9, my - bend * 0.5); x.quadraticCurveTo(cx, my - 2 + bend, cx + mw * 0.9, my - bend * 0.5); x.quadraticCurveTo(cx, my + op + bend * 0.4, cx - mw * 0.9, my - bend * 0.5); x.closePath(); x.fill(); if (E.teeth) { x.fillStyle = '#d8d2c4'; x.fillRect(cx - mw * 0.64, my - 1 + bend * 0.5, mw * 1.28, Math.min(3.4, op * 0.5)); } }
  x.fillStyle = lip; x.beginPath(); x.moveTo(cx - mw, my - bend * 0.6); x.quadraticCurveTo(cx - mw * 0.4, my - 2.4 * T.lipFull, cx, my - 1.4 * T.lipFull + bend * 0.3); x.quadraticCurveTo(cx + mw * 0.4, my - 2.4 * T.lipFull, cx + mw, my - bend * 0.6); x.quadraticCurveTo(cx, my + bend, cx - mw, my - bend * 0.6); x.closePath(); x.fill();
  const low = op > 1 ? op + 0.6 : 0; x.fillStyle = sh(lip, 1.14); x.beginPath(); x.moveTo(cx - mw * 0.92, my - bend * 0.5 + low * 0.1); x.quadraticCurveTo(cx, my + bend + low, cx + mw * 0.92, my - bend * 0.5 + low * 0.1); x.quadraticCurveTo(cx, my + 3.4 * T.lipFull + bend + low, cx - mw * 0.92, my - bend * 0.5 + low * 0.1); x.closePath(); x.fill();
  x.strokeStyle = sdd; x.lineWidth = 0.9; x.beginPath(); x.moveTo(cx - mw, my - bend * 0.6); x.quadraticCurveTo(cx, my + bend, cx + mw, my - bend * 0.6); x.stroke();
  if (T.mole) { x.fillStyle = 'rgba(50,28,20,0.76)'; x.beginPath(); x.arc(cx + T.mole[0], cy + T.mole[1] - 4, 1.2, 0, 6.3); x.fill(); }
  if (T.scar) { x.strokeStyle = 'rgba(230,190,180,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx + 10, ey - 14); x.lineTo(cx + 15, ey + 8); x.stroke(); }
  // facial hair
  if (look.facial) { const hc = sh(hair, 0.86), r2 = rnd(hashOf(name) + 5), n = look.facial === 1 ? 900 : look.facial === 2 ? 200 : 420; for (let i = 0; i < n; i++) { const a = r2() * Math.PI, d = 0.5 + r2() * 0.52, px = cx + Math.cos(a) * T.headW * 0.86 * d, py = cy + T.headH * (T.chin - 0.04) * (0.34 + Math.sin(a) * 0.66 * d) + 4; if (look.facial === 2 && Math.abs(py - (my - 6)) > 3.4) continue; if (Math.abs(py - my) < 3.4 && Math.abs(px - cx) < mw) continue; x.fillStyle = look.facial === 3 ? `rgba(30,20,16,${0.16 + r2() * 0.2})` : hc; x.fillRect(px, py, 1, look.facial === 3 ? 1 : 2.2); } if (look.facial === 2) { x.fillStyle = hc; x.fillRect(cx - mw * 0.9, my - 6.4, mw * 1.8, 2.8); } }
  hairTop(x, T, look, cx, cy, hair);
  if (look.glasses) { const dark = look.glasses === 'sun'; for (const s of [-1, 1]) { x.strokeStyle = dark ? '#141418' : '#a8884a'; x.lineWidth = 1.4; x.fillStyle = dark ? 'rgba(10,12,18,0.86)' : 'rgba(210,230,240,0.1)'; x.beginPath(); x.ellipse(cx + s * T.eyeGap, ey, 10, 8, 0, 0, 6.3); x.fill(); x.stroke(); } x.beginPath(); x.moveTo(cx - T.eyeGap + 10, ey); x.lineTo(cx + T.eyeGap - 10, ey); x.stroke(); }
  if (look.hat) { const hc = look.hatColor || '#34343c'; x.fillStyle = sh(hc, 1); x.beginPath(); x.ellipse(cx, cy - T.headH * 0.68, T.headW * 1.08, 15, 0, Math.PI, 0); x.fill(); x.fillStyle = sh(hc, 0.72); x.fillRect(cx - T.headW * 1.1, cy - T.headH * 0.7, T.headW * 2.2, 5); }
  if (look.mask) {
    // the mask they really wear, as on the body (js/game/realbody.js): cloth over the nose and mouth leaves the eyes, a balaclava leaves a slit, a hard mask covers the face
    const m = look.mask, knit = look.maskSki || m === 'balaclava' || m === 'ski', cloth = m === 'bandana' || m === 'surgical' || m === 'medical';
    if (knit) { x.fillStyle = '#1e1e22'; skull(); x.fill(); x.fillStyle = look.skin || '#c89068'; x.beginPath(); x.ellipse(cx, ey, T.eyeGap + 12, 6, 0, 0, 6.3); x.fill(); x.fillStyle = '#0a0808'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * T.eyeGap, ey, 4, 2.4, 0, 0, 6.3); x.fill(); } }
    else if (cloth) { x.save(); skull(); x.clip(); x.fillStyle = m === 'bandana' ? look.maskColor || '#7a1e22' : '#c8dce4'; x.fillRect(cx - 200, ey + 14, 400, 400); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(cx - 200, ey + 14, 400, 2); x.restore(); }
    else { x.fillStyle = { white: '#e8e2d6', gold: '#d8b040', black: '#1a1618', red: '#8a1a1e', silver: '#b8bcc4', hockey: '#e8e4d8', gas: '#3a4034' }[look.maskColor || m] || '#5a5a60'; skull(); x.fill(); x.fillStyle = m === 'gas' ? '#8ab0b8' : '#0a0808'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * T.eyeGap, ey, 6, 3.4, 0, 0, 6.3); x.fill(); } }
  }
  return c;
}
// ---------------------------------------------------------------- what they feel, right now
const hurtOf = (n) => (n.maxHp ? n.hp / n.maxHp : 1);
G.portrait = {
  W, H, EX, paint,
  cache: new Map(),
  key: (look, name, ex) => `${name}|${ex}|${look.skin}|${look.hair}|${look.hairStyle}|${look.shirt}|${look.facial}|${look.glasses}|${look.hat}|${look.mask}|${look.maskColor}`,
  get(look, name, ex = 'neutral') {
    const k = this.key(look, name, ex); let c = this.cache.get(k);
    if (!c) { c = paint(look, name, EX[ex] || EX.neutral); this.cache.set(k, c); if (this.cache.size > 90) this.cache.delete(this.cache.keys().next().value); }
    return c;
  },
  exprOf(n) {
    const st = n.st || {};
    if ((st.fear || 0) > 55) return 'fear';
    if (hurtOf(n) < 0.4 || st.bleed) return 'pain';
    if (st.hostile || (st.disp || 0) < -45) return 'angry';
    if ((st.hunger || 0) > 85 || (st.thirst || 0) > 85) return 'tired';
    if (st.mood === 'homeless' || st.mood === 'grieving' || st.mood === 'sad') return 'sad';
    if ((st.disp || 0) < -15) return 'suspicious';
    if ((st.disp || 0) > 35) return 'happy';
    return 'neutral';
  },
  // the face in a conversation: a frame above the strip, easing from one feeling to the next
  draw(ctx, npc, x, y, size) {
    const look = npc.currentLook ? npc.currentLook() : npc.look; if (!look) return;
    const ex = this.exprOf(npc), name = npc.id || 'person', st = this._s && this._s.id === name ? this._s : (this._s = { id: name, ex, last: null, t: 1 });
    if (ex !== st.ex) { st.last = st.ex; st.ex = ex; st.t = 0; }
    st.t = Math.min(1, st.t + 0.06);
    const w = size, h = size * H / W, was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2, y + 3, w, h);
    if (st.last && st.t < 1) ctx.drawImage(this.get(look, name, st.last), x, y, w, h);
    ctx.globalAlpha = st.last ? st.t : 1; ctx.drawImage(this.get(look, name, ex), x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(193,167,114,0.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.imageSmoothingEnabled = was;
  },
};
})();
