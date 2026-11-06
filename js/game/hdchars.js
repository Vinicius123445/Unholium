'use strict';
// HD characters: people drawn at twice the pixel density (32x44 sprite pixels in the same 16x22 world
// space), with real animation instead of three frames.
//   Proportions: about 5.5 heads tall (adults), not chibi; female and male silhouettes, builds (thin,
//   average, heavy), the elderly a little stooped. Shading: 3-4 tone ramps per material, light from
//   above and in front, colored outlines (darker shades of each material, not black).
//   Faces: eye whites and pupils, brows, nose shade, mouths (lips, makeup), beards, stubble, wrinkles,
//   glasses, masks; eyes blink and mouths move when someone talks (drawn live over the sprite).
//   Animation (per direction): idle breathing (4), walk (8) and run (8) with contact, down, passing and up
//   poses, arms swinging against the legs, a bobbing torso and a head that lags; plus sit, crouch,
//   cower, hands up, hand to mouth (eating, drinking, smoking), hurt flinch, dragging (2), swimming (2),
//   talking gesture, aiming. The stride follows how far the feet really move (no sliding).
//   Turning: a quick in-between facing when someone turns around. Idle people fidget and look around,
//   each on their own clock. Hair, ponytails, braids, dresses and coats swing as they move.
//   Corpses: lie in a pose from how they fell (face down, on the back, curled, on the side, slumped), keep
//   it, and decay over days (pallor, discoloration, flies and their buzz). Falling takes a moment.
// The 16x20 sheets stay as the handle for a look (every draw of one lands on the HD sheet, below). HD sheets
// are built the first time they are needed and cached per look (and censor setting).
(() => {
const A = G.assets;
const FW = 32, FH = 44, WW = 25, WH = 34;   // (at 20 pixels to the metre a grown person stands 34 tall, about 1.7 m: the world was scaled to this)
const COL = { idle: 0, walk: 4, run: 12, sit: 20, crouch: 21, cower: 22, handsup: 23, mouth: 24, flinch: 25, drag: 26, swim: 28, talk: 30, aim: 31, reload: 32, phone: 33, carry: 34, getup: 35, limp: 36, hunch: 44, slump: 52, winded: 54, guard: 56 };
const NCOL = 58;

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const sh = (c, f) => A.shade(c, f);
const mix = (a, b, t) => A.mix(a, b, t);
// a material: base, light, shadow, deep shadow (and a darker outline tone)
const ramp = (c) => ({ b: c, l: sh(c, 1.16), s: sh(c, 0.78), d: sh(c, 0.6), o: sh(c, 0.42) });

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- drawing primitives (pixel exact)
function P(x, px, py, c) { x.fillStyle = c; x.fillRect(Math.round(px), Math.round(py), 1, 1); }
function Rr(x, px, py, w, h, c) { if (w <= 0 || h <= 0) return; x.fillStyle = c; x.fillRect(Math.round(px), Math.round(py), Math.round(w), Math.round(h)); }
// a limb: a thick line from (x0,y0) to (x1,y1), w px wide, lit on one side and shaded on the other
function limb(x, x0, y0, x1, y1, w, m, shadeSide = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    Rr(x, cx - w / 2, cy, w, 1, m.b);
    P(x, shadeSide > 0 ? cx + w / 2 - 1 : cx - w / 2, cy, m.s);
  }
}

// ---------------------------------------------------------------- the body for one frame
// pose: { dir, bob, legs: [[hip,knee,ankle] x2] ..., computed below }
function drawFrame(x, L, d, kind, f) {
  const side = d === 1 || d === 2, s = d === 2 ? 1 : -1, back = d === 3;
  const fem = L.fem, cx = 16;
  // vertical layout (sprite px, feet on y = 43)
  const ground = 43, legLen = L.kid ? 12 : 20, thigh = Math.round(legLen * 0.5), shin = legLen - thigh, HK = L.kid ? 1 : 0.74, bend = legLen / 15;
  let hipY = ground - legLen - 1, shoulderY = hipY - (L.kid ? (fem ? 10 : 11) : (fem ? 13 : 14)), headTop = shoulderY - 9;
  let bob = 0, lean = 0, headLag = 0, armA = [0, 0], elbow = [0.25, 0.25], legA = [0, 0], knee = [0, 0], lift = [0, 0];
  const p = (f / 8) * Math.PI * 2;
  if (kind === 'walk' || kind === 'run' || kind === 'drag' || kind === 'limp' || kind === 'hunch') {
    const run = kind === 'run', amp = run ? 0.75 : 0.42;
    legA = [Math.sin(p) * amp, -Math.sin(p) * amp];
    knee = [Math.max(0, Math.cos(p)) * (run ? 1.3 : 0.7), Math.max(0, -Math.cos(p)) * (run ? 1.3 : 0.7)];
    lift = [Math.max(0, Math.cos(p)) * (run ? 3 : 1.6), Math.max(0, -Math.cos(p)) * (run ? 3 : 1.6)];
    armA = [-Math.sin(p) * (run ? 0.7 : 0.45), Math.sin(p) * (run ? 0.7 : 0.45)];   // (running: forearms bent up, hands at chest height)
    elbow = run ? [2.1, 2.1] : [0.3 + Math.max(0, -Math.sin(p)) * 0.3, 0.3 + Math.max(0, Math.sin(p)) * 0.3];
    bob = (f % 4 === 0) ? 1 : (f % 4 === 2) ? (run ? -2 : -1) : 0;   // contact low, passing high
    headLag = (f % 4 === 1) ? 1 : 0;
    if (run) lean = 2;
    if (kind === 'drag') { lean = -2; armA = [0.9, 0.9]; elbow = [0.1, 0.1]; }
    if (kind === 'limp') {   // the bad leg barely bends and takes no weight: the body drops onto the good one
      legA = [Math.sin(p) * 0.46, -Math.sin(p) * 0.14]; knee = [knee[0], 0.05]; lift = [lift[0], 0.3];
      bob = f < 4 ? ((f % 4 === 2) ? 0 : 1) : ((f % 4 === 2) ? 2 : 1); lean = 1; armA = [armA[0] * 0.5, 0]; headLag = 1; hipY += 1; shoulderY += 1; headTop += 2;
    }
    if (kind === 'hunch') { armA = [armA[0] * 0.35, armA[1] * 0.35]; elbow = [0.7, 0.7]; bob = (f % 4 === 0) ? 1 : 0; lean = 1; shoulderY += 2; headTop += 3; }
  } else if (kind === 'idle') {
    bob = f === 2 ? 1 : 0;   // breathing: the shoulders sink a pixel and rise
  } else if (kind === 'slump') { bob = f; lean = 1; shoulderY += 2; headTop += 4; armA = [0.05, -0.05]; }
  else if (kind === 'winded') { hipY += 3; shoulderY += 8 + f; headTop += 10 + f; lean = 3; }   // bent over, hands on the knees, heaving
  else if (kind === 'guard') { hipY += 2; shoulderY += 3; headTop += 4; lean = 1; bob = f; }    // knees bent, chin down
  else if (kind === 'sit') { const k = Math.round(10 * bend); hipY += k; shoulderY += k; headTop += k; }
  else if (kind === 'crouch' || kind === 'cower') { const k = Math.round(8 * bend); hipY += k; shoulderY += k + 1; headTop += k + 1; lean = 2; }
  else if (kind === 'flinch') { lean = -2; headLag = 1; }
  else if (kind === 'getup') { const k = Math.round(5 * bend); hipY += k; shoulderY += k + 1; headTop += k + 1; lean = 1; }
  else if (kind === 'carry') { lean = -1; }
  else if (kind === 'swim') { bob = f % 2; }
  if (L.old) { headTop += 1; shoulderY += 1; if (side) lean += 1; }
  shoulderY += bob; headTop += bob + headLag; const hip = hipY + Math.max(0, bob);
  const sx = side ? cx + s * lean : cx;   // shoulders (side view: forward when running, back when dragging)
  const halfS = (fem ? 5 : 6) + (L.build === 2 ? 1 : 0) - (L.build === 0 ? 1 : 0), halfH = 5 + (L.build === 2 ? 1 : 0) - (L.build === 0 && !fem ? 1 : 0);   // a body, not a stick
  const skin = L.skin, cloth = L.top, pants = L.pants;
  const legM = L.bareBottom ? skin : pants, shoeM = L.shoes;

  // ------------------------------------------------ legs (and feet)
  const legPts = (i) => {
    const hx = side ? cx + (i ? 1 : -1) * 0.5 : cx + (i ? 2.6 : -2.6);
    if (kind === 'sit') {
      if (side) return [hx, hip, hx + s * thigh, hip + 1, hx + s * thigh, ground - 1];
      return [hx, hip, hx + (i ? 1 : -1), hip + 3, hx + (i ? 1 : -1), ground - 1];
    }
    if (kind === 'crouch' || kind === 'cower') {
      if (side) return [hx, hip, hx + s * 5, hip + 3, hx + s * 1, ground - 1];
      return [hx, hip, hx + (i ? 3 : -3), hip + 4, hx + (i ? 2 : -2), ground - 1];
    }
    if (side) {
      const a = legA[i], b = a - knee[i];
      const kx = hx + s * Math.sin(a) * thigh, ky = hip + Math.cos(a) * thigh;
      return [hx, hip, kx, ky, kx + s * Math.sin(b) * shin, Math.min(ground - 1, ky + Math.cos(b) * shin)];
    }
    // front/back: the moving leg lifts; knees come in a little
    const lf = lift[i];
    return [hx, hip, hx + (i ? -0.3 : 0.3), hip + thigh - lf * 0.5, hx, ground - 1 - lf];
  };
  const drawLeg = (i, far) => {
    if (kind === 'swim') return;
    const [hx, hy, kx, ky, ax, ay] = legPts(i);
    const m = ramp(far ? sh(legM, 0.85) : legM);
    const shortLeg = L.bottom === 'shorts' || L.bottom === 'skirt';
    if (shortLeg && !L.bareBottom) {
      limb(x, hx, hy, kx, ky, 4, ramp(far ? sh(pants, 0.85) : pants));
      limb(x, kx, ky, ax, ay, 3, ramp(far ? sh(skin, 0.88) : skin));
    } else { limb(x, hx, hy, kx, ky, 4, m); limb(x, kx, ky, ax, ay, 3, m); }
    // shoe: points where the person faces
    const sm = ramp(shoeM);
    if (side) { Rr(x, ax - (s > 0 ? 1 : 3), ay, 4, 2, sm.b); Rr(x, ax - (s > 0 ? 1 : 3), ay + 1, 4, 1, sm.d); P(x, ax + s * 2, ay, sm.l); }
    else { Rr(x, ax - 1.5, ay, 3, 2, sm.b); Rr(x, ax - 1.5, ay + 1, 3, 1, sm.d); if (!back) P(x, ax - 0.5, ay, sm.l); }
  };

  // ------------------------------------------------ arms
  const shoulderPt = (i) => (side ? [sx + (i ? 1 : -1) * 0.5, shoulderY + 1] : [cx + (i ? halfS : -halfS) + (i ? 0.5 : -0.5), shoulderY + 1]);
  const armLen = L.kid ? 9 : 15, up = Math.round(armLen * 0.5), lo = armLen - up;
  const handAt = (i) => {
    const [ax, ay] = shoulderPt(i);
    if (kind === 'winded') return side ? [ax + s * 2, ay + 6, ax + s * 4, ay + 11] : [ax + (i ? -1 : 1), ay + 6, ax + (i ? -2 : 2), ay + 12];
    if (kind === 'guard') return side ? [ax + s * (i ? 4 : 3), ay + 5, ax + s * (i ? 7 : 5), ay - 1] : [ax + (i ? 1 : -1), ay + 5, ax + (i ? -2 : 2), ay - 2];
    if (kind === 'limp' && (side ? i === (s > 0 ? 1 : 0) : i === 1)) return side ? [ax + s * 2, ay + 5, ax + s * 3, ay + 8] : [ax + 1, ay + 6, cx + 3, ay + 8];   // a hand held against the ribs
    if (kind === 'handsup') return side ? [ax + s, ay - 4, ax + s * 2, ay - 10] : [ax + (i ? 2 : -2), ay - 4, ax + (i ? 2 : -2), ay - 10];
    if (kind === 'cower') return side ? [ax + s * 3, ay - 2, ax + s * 2, ay - 6] : [ax + (i ? -1 : 1), ay - 3, ax + (i ? -3 : 3), ay - 6];
    if (kind === 'mouth' && i === 1) return side ? [ax + s * 2, ay + 4, ax + s * 4, ay - 3] : [ax - 1, ay + 4, ax - 4, ay - 3];
    if (kind === 'talk' && i === 1) return side ? [ax + s * 2, ay + 4, ax + s * 6, ay + 2] : [ax + 1, ay + 4, ax + 3, ay + 1];
    if (kind === 'aim') return side ? [ax + s * 5, ay, ax + s * 10, ay] : [ax + (i ? -1 : 1), ay + 3, cx + (i ? 1 : -1), ay + 6];
    if (kind === 'reload') return side ? [ax + s * (i ? 3 : 4), ay + 4, ax + s * (i ? 5 : 7), ay + (i ? 6 : 4)] : [ax + (i ? -1 : 1), ay + 4, cx + (i ? 1 : -2), ay + (i ? 7 : 5)];   // one hand on the gun, the other seating the magazine
    if (kind === 'phone') return i === 1 ? (side ? [ax + s * 2, ay + 4, ax + s * 4, ay + 2] : [ax - 1, ay + 4, cx + 1, ay + 3]) : (side ? [ax, ay + 5, ax + s * 1, ay + 10] : [ax + 1, ay + 5, ax + 1, ay + 10]);   // the phone held up in front of the face
    if (kind === 'carry') return side ? [ax + s * 3, ay + 3, ax + s * 6, ay + 5] : [ax + (i ? -1 : 1), ay + 3, ax + (i ? -2 : 2), ay + 6];   // arms out holding something
    if (kind === 'getup') return side ? [ax + s * 3, ay + 5, ax + s * 4, ay + 11] : [ax, ay + 5, ax + (i ? 2 : -2), ay + 11];   // pushing up off the ground
    if (kind === 'crouch') return side ? [ax + s * 3, ay + 4, ax + s * 5, ay + 9] : [ax, ay + 4, ax + (i ? 1 : -1), ay + 9];
    if (kind === 'sit') return side ? [ax + s * 1, ay + 5, ax + s * 5, ay + 7] : [ax, ay + 5, ax + (i ? -2 : 2), ay + 8];
    if (kind === 'flinch') return side ? [ax - s * 2, ay + 4, ax - s * 4, ay + 7] : [ax + (i ? 2 : -2), ay + 4, ax + (i ? 4 : -4), ay + 7];
    if (kind === 'swim') { const k = (f % 2) ? 1 : -1, w = i ? k : -k; return side ? [ax + s * 4 * w, ay + 1, ax + s * 8 * w, ay + 2] : [ax + (i ? 3 : -3), ay - 1 - w * 2, ax + (i ? 6 : -6), ay - 2 - w * 3]; }
    const a = armA[i], e = elbow[i];
    if (side) { const exx = ax + s * Math.sin(a) * up, eyy = ay + Math.cos(a) * up; return [exx, eyy, exx + s * Math.sin(a + e) * lo, eyy + Math.cos(a + e) * lo]; }
    const sw = Math.sin(a) * 2;   // front/back: the hand moves up and a little in
    return [ax + (i ? 0.5 : -0.5), ay + up, ax + (i ? -0.5 : 0.5) * (1 + Math.abs(sw) * 0.3), ay + armLen - Math.abs(sw) * 0.8 + (sw > 0 ? -0.5 : 0)];
  };
  const hands = [];
  const sleeveM = L.bareTop || L.bikini ? skin : (L.topStyle === 'vest' || L.topStyle === 'tank' ? skin : cloth);
  const drawArm = (i, far) => {
    const [ax, ay] = shoulderPt(i), [ex, ey, hx, hy] = handAt(i);
    hands[i] = [hx, hy + 1];   // where a weapon is held (js/game/melee.js, firearms)
    const m = ramp(far ? sh(sleeveM, 0.82) : sleeveM), short = L.topStyle === 'vest' || L.shortSleeves;
    limb(x, ax, ay, ex, ey, 3, m);
    limb(x, ex, ey, hx, hy, 3, short ? ramp(far ? sh(skin, 0.86) : skin) : m);
    Rr(x, hx - 1.5, hy, 3, 2, L.gloves ? '#16161a' : far ? sh(skin, 0.86) : skin);   // the hand
    if (L.tattoo && !far) { P(x, hx - 1, hy - 3, '#26344e'); P(x, hx, hy - 5, '#26344e'); P(x, hx - 1, hy - 7, '#3a2a4e'); }
  };

  // ------------------------------------------------ torso and clothes
  const drawTorso = () => {
    const cm = ramp(L.bareTop || L.bikini ? skin : cloth), top = shoulderY, bottom = hip;
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / Math.max(1, bottom - top);
      let hw = side ? (fem && t > 0.15 && t < 0.4 ? 4.5 : 4) + (L.build === 2 ? 0.5 : 0) : halfS + (halfH - halfS) * t - (fem && t > 0.4 && t < 0.7 ? 1 : 0);
      if (L.belly && t > 0.45 && !back) hw += side ? 0 : Math.min(L.belly, 2) * 0.5;
      const lx = (side ? sx - (t * lean) : cx) - hw, w = hw * 2;
      Rr(x, lx, y, w, 1, cm.b);
      P(x, lx, y, cm.l);                     // the lit edge
      Rr(x, lx + w - 2, y, 2, 1, cm.s);      // the shaded edge
      if (side && fem && t > 0.15 && t < 0.4 && !back) P(x, lx + (s > 0 ? w : -1), y, cm.b);   // bust in profile
      if (side && L.belly && t > 0.45) Rr(x, s > 0 ? lx + w : lx - Math.min(L.belly, 3), y, Math.min(L.belly, 3), 1, cm.b);
    }
    // folds, seams and the waistband
    if (L.bikini) { const bm = ramp(cloth); if (back) Rr(x, cx - halfS + 1, top + 3, halfS * 2 - 2, 1, bm.b); else { Rr(x, (side ? sx - 3 : cx - halfS + 1), top + 2, side ? 6 : halfS * 2 - 2, 3, bm.b); if (!side) P(x, cx, top + 3, bm.d); } }
    if (!L.bareTop && !L.bikini) {
      if (!side) { P(x, cx - 2, top + 5, cm.s); P(x, cx + 2, top + 7, cm.s); P(x, cx - 1, bottom - 2, cm.s); }
      else P(x, sx - s, top + 6, cm.s);
    }
    if (!L.bareBottom && L.bottom !== 'skirt' && !/dress|robe/.test(L.topStyle)) {
      const pm = ramp(pants);
      Rr(x, (side ? sx - 2 : cx - halfH), bottom - 1, side ? 5 : halfH * 2, 2, pm.b);
      Rr(x, (side ? sx - 2 : cx - halfH), bottom - 2, side ? 5 : halfH * 2, 1, sh(pants, 0.5));   // belt
      if (d === 0 && !L.bikini) P(x, cx, bottom - 2, '#c8b060');   // buckle
    }
    // style details
    const st = L.topStyle, T2 = L.top2;
    if (!L.bareTop && !L.bikini) {
      if (st === 'jacket' || st === 'suit') {
        if (d === 0) { Rr(x, cx - 1, top, 2, bottom - top - 2, ramp(T2).b); P(x, cx - 2, top + 1, cm.l); P(x, cx + 1, top + 1, cm.l); P(x, cx - 2, top + 2, cm.d); P(x, cx + 1, top + 2, cm.d); if (st === 'suit') Rr(x, cx, top + 1, 1, 6, '#5a1a22'); P(x, cx + 2, top + 6, cm.d); }
        else if (side) Rr(x, sx + s * 1, top + 2, 1, bottom - top - 3, cm.d);
      } else if (st === 'hoodie') {
        if (d === 0) { P(x, cx - 1, top + 2, '#e8e0d0'); P(x, cx + 1, top + 2, '#e8e0d0'); P(x, cx - 1, top + 3, '#d8d0c0'); P(x, cx + 1, top + 4, '#d8d0c0'); Rr(x, cx - 3, top + 7, 6, 2, cm.s); }
        if (back) Rr(x, cx - 3, top - 1, 6, 3, cm.s);
      } else if (st === 'vest') { if (d === 0) Rr(x, cx - 1, top, 2, bottom - top - 1, ramp(T2).b); else if (side) Rr(x, sx + s * 3 - (s < 0 ? 1 : 0), top + 1, 1, bottom - top - 2, ramp(T2).b); }   // (the shirt shows down the front: in profile, along the front edge)
      else if (st === 'shirt') { if (d === 0) { P(x, cx - 1, top, sh(cloth, 1.3)); P(x, cx, top + 1, cm.s); P(x, cx + 1, top, sh(cloth, 1.3)); for (let y = top + 3; y < bottom - 2; y += 3) P(x, cx, y, cm.d); } }
      else if (st === 'tank') { const km = ramp(skin); for (const sx2 of [-1, 1]) Rr(x, (side ? sx : cx) + sx2 * (side ? 1 : halfS - 2) - (sx2 < 0 ? 2 : 0), top, 2, 2, km.b); Rr(x, (side ? sx : cx) - 1.5, top, 3, 2, km.b); if (d === 0) { P(x, cx - 2, top + 2, cm.d); P(x, cx + 1, top + 2, cm.d); } }   // a tank top: bare shoulders, straps, a low neck
      else if (st === 'longsleeve' && d === 0) { P(x, cx - 1, top, sh(cloth, 1.25)); P(x, cx, top, sh(cloth, 1.25)); }
      else if (st === 'tshirt' && d === 0) { P(x, cx - 1, top, cm.d); P(x, cx, top + 1, cm.d); P(x, cx + 1, top, cm.d); }
      else if (st === 'tunic') { Rr(x, cx - halfH - 1, bottom - 1, halfH * 2 + 2, 3, cm.b); Rr(x, cx - halfH - 1, bottom + 1, halfH * 2 + 2, 1, cm.d); }
    }
    if (st === 'dress' || st === 'robe') {   // the hem flares and swings
      const len = st === 'robe' ? 14 : 8, sway = (kind === 'walk' || kind === 'run') ? (f % 4 < 2 ? 1 : -1) : 0;
      for (let k = 0; k < len; k++) { const hw = halfH + k * 0.35; Rr(x, (side ? sx : cx) - hw + (k > len / 2 ? sway : 0), hip + k - 1, hw * 2, 1, k === len - 1 ? cm.d : cm.b); P(x, (side ? sx : cx) + hw - 1, hip + k - 1, cm.s); }
    }
    if (L.bottom === 'skirt' && !L.bareBottom) { const pm = ramp(pants); for (let k = 0; k < 6; k++) { const hw = halfH + k * 0.3; Rr(x, (side ? sx : cx) - hw, hip + k - 1, hw * 2, 1, k === 5 ? pm.d : pm.b); } }
    if (L.apron && !back) Rr(x, (side ? sx - 1 : cx - 3), shoulderY + 3, side ? 3 : 6, hip - shoulderY + 3, L.apron);
    if (L.armor) { const am = ramp(L.armor); Rr(x, (side ? sx - 3 : cx - halfS + 1), shoulderY + 1, side ? 6 : halfS * 2 - 2, 8, am.b); Rr(x, (side ? sx - 3 : cx - halfS + 1), shoulderY + 1, side ? 6 : halfS * 2 - 2, 1, am.l); }
    if (L.patch) {   // a biker's colors: club patch across the back, a small one on the chest, a chain at the belt
      if (back) { const pm = ramp(L.patch); Rr(x, cx - 3, top + 1, 6, 1, pm.b); Rr(x, cx - 2, top + 3, 4, 4, '#e8e0cc'); P(x, cx - 1, top + 4, '#141418'); P(x, cx + 1, top + 4, '#141418'); Rr(x, cx - 1, top + 6, 2, 1, '#141418'); Rr(x, cx - 3, top + 8, 6, 1, pm.b); }
      else if (d === 0) { P(x, cx - 3, top + 3, L.patch); P(x, cx - 2, top + 3, L.patch); }
      if (L.chain && !back) for (let k = 0; k < 4; k++) P(x, (side ? sx : cx + 2) + (k % 2), bottom + k - 1, '#c8ccd2');
    }
    if (L.pins && d === 0) { P(x, cx - 2, shoulderY + 3, '#e05a8a'); P(x, cx + 2, shoulderY + 4, '#5ac8e0'); P(x, cx - 2, shoulderY + 6, '#e0d050'); }
    if (L.tote) { const tc = L.toteColor || '#d8ccb0'; if (d === 0) { for (let y = shoulderY; y < hip; y++) P(x, cx + halfS - (y - shoulderY) * 0.3, y, sh(tc, 0.6)); Rr(x, cx + halfS - 1, hip - 2, 4, 5, tc); } else if (back) Rr(x, cx - halfS - 3, hip - 2, 4, 5, tc); else Rr(x, sx - s * 3, hip - 3, 4, 5, tc); }
    // naked: plain, non-explicit; censor bars on by default
    if (L.bareTop || L.bareBottom) {
      const sd = sh(skin, 0.86), nip = mix(skin, '#8a4a3a', 0.4);
      if (!L.censored) {
        if (L.bareTop && d === 0) { P(x, cx - 2, shoulderY + 1, sh(skin, 1.08)); P(x, cx + 1, shoulderY + 1, sh(skin, 1.08)); P(x, cx - 2, shoulderY + 4, nip); P(x, cx + 2, shoulderY + 4, nip); if (fem) { Rr(x, cx - 3, shoulderY + 5, 2, 1, sd); Rr(x, cx + 2, shoulderY + 5, 2, 1, sd); } P(x, cx, shoulderY + 8, sd); }
        if (L.bareBottom && d === 0) { P(x, cx, hip - 1, mix(skin, sh(L.hair, 0.75), 0.5)); }
      } else {
        const bar = (bx, by, bw, bh) => { for (let i = 0; i < bw; i++) for (let j = 0; j < bh; j++) P(x, bx + i, by + j, (i + j) % 2 ? '#141418' : '#3a3a44'); };
        if (L.bareBottom) bar((side ? sx - 2 : cx - 3), hip - 2, side ? 5 : 6, 3);
        if (L.bareTop && fem && !back) bar((side ? sx - 2 : cx - 4), shoulderY + 3, side ? 5 : 8, 3);
      }
    }
  };

  // ------------------------------------------------ head
  const hx0 = (side ? sx + s * lean * 0.5 : cx) - 4, hy0 = headTop;
  const drawHead = () => {
    const km = ramp(skin);
    // neck
    Rr(x, (side ? sx : cx) - 1, hy0 + 8, 3, shoulderY - hy0 - 7, km.s);
    // skull and jaw
    for (let y = 0; y < 9; y++) {
      const w = L.kid ? (y < 1 ? 6 : y > 7 ? 5 : y > 6 ? 6 : 8) : (y < 1 ? 6 : y > 7 ? 4 + L.jaw : y > 6 ? 6 + Math.min(1, L.jaw) : 8), off = (8 - w) / 2;
      Rr(x, hx0 + off, hy0 + y, w, 1, km.b);
      if (!side || s < 0) P(x, hx0 + off + w - 1, hy0 + y, km.s); else P(x, hx0 + off, hy0 + y, km.s);
    }
    Rr(x, hx0 + 1, hy0 + 8, 6, 1, km.s);   // under the jaw
    if (back) { P(x, hx0 - 1, hy0 + 4, km.s); P(x, hx0 + 8, hy0 + 4, km.s); return; }
    const eyeY = hy0 + 4, white = L.eyeWhite, pupil = L.eyes;
    if (d === 0) {
      P(x, hx0 - 1, eyeY, km.s); P(x, hx0 + 8, eyeY, km.s);   // ears
      if (L.kid) {
        P(x, hx0 + 1, eyeY, white); P(x, hx0 + 2, eyeY, pupil); P(x, hx0 + 5, eyeY, pupil); P(x, hx0 + 6, eyeY, white);
        P(x, hx0 + 1, eyeY - 1, L.brow); P(x, hx0 + 2, eyeY - 1, L.brow); P(x, hx0 + 5, eyeY - 1, L.brow); P(x, hx0 + 6, eyeY - 1, L.brow);
        P(x, hx0 + 4, eyeY + 1, km.s); P(x, hx0 + 3, eyeY + 2, km.d);
        Rr(x, hx0 + 3, eyeY + 3, 2, 1, L.lip);
      } else {
        // a grown face: planes and shadow, not features stuck on a ball
        P(x, hx0, eyeY + 1, km.s); P(x, hx0 + 7, eyeY + 1, km.s); P(x, hx0, eyeY + 2, km.s); P(x, hx0 + 7, eyeY + 2, km.d);   // cheekbones turn away from the light
        Rr(x, hx0 + 1, eyeY, 2, 1, km.d); Rr(x, hx0 + 5, eyeY, 2, 1, km.d);                                                     // sockets
        P(x, hx0 + 2, eyeY, pupil); P(x, hx0 + 5, eyeY, pupil); P(x, hx0 + 1, eyeY, white); P(x, hx0 + 6, eyeY, white);
        Rr(x, hx0 + 1, eyeY - 1, 3, 1, L.brow); Rr(x, hx0 + 4, eyeY - 1, 3, 1, L.brow);                                         // a heavy, level brow
        P(x, hx0 + 1, eyeY + 1, km.s); P(x, hx0 + 6, eyeY + 1, km.s);                                                           // under the eyes
        P(x, hx0 + 4, eyeY, km.s); P(x, hx0 + 4, eyeY + 1, km.s); P(x, hx0 + 4, eyeY + 2, km.d); P(x, hx0 + 3, eyeY + 2, km.s);   // nose: bridge, underside
        Rr(x, hx0 + 2, eyeY + 3, 4, 1, L.lip); P(x, hx0 + 3, eyeY + 4, km.s);                                                   // a thin mouth, no smile
        if (L.lined) { P(x, hx0 + 1, eyeY + 2, km.s); P(x, hx0 + 6, eyeY + 2, km.s); }                                          // lines from the nose
        if (L.scar) { P(x, hx0 + (L.scar === 1 ? 1 : 6), eyeY - 2, sh(skin, 1.14)); P(x, hx0 + (L.scar === 1 ? 2 : 5), eyeY + 1, sh(skin, 1.14)); P(x, hx0 + (L.scar === 1 ? 2 : 5), eyeY + 2, km.d); }
      }
      if (L.old) { P(x, hx0 + 2, hy0 + 2, km.s); P(x, hx0 + 5, hy0 + 2, km.s); P(x, hx0 + 1, eyeY + 3, km.s); P(x, hx0 + 6, eyeY + 3, km.s); }
    } else {
      const fx = s > 0 ? hx0 + 7 : hx0, back1 = s > 0 ? -1 : 1;
      P(x, fx + s, eyeY + 1, km.b); P(x, fx + s, eyeY + 2, km.s);   // nose tip
      if (!L.kid) { P(x, fx + back1, eyeY, km.d); P(x, fx + back1 * 2, eyeY + 1, km.s); P(x, fx + back1 * 3, eyeY + 2, km.d); }   // the socket and the cheekbone from the side
      P(x, fx + back1 * 1, eyeY, white); P(x, fx, eyeY, pupil);
      P(x, fx, eyeY - 1, L.brow); P(x, fx + back1, eyeY - 1, L.brow); if (!L.kid) P(x, fx + back1 * 2, eyeY - 1, L.brow);
      P(x, fx, eyeY + 3, L.lip); if (!L.kid) P(x, fx + back1, eyeY + 3, km.s);
      P(x, (s > 0 ? hx0 + 2 : hx0 + 5), eyeY, km.s); P(x, (s > 0 ? hx0 + 2 : hx0 + 5), eyeY + 1, km.d);   // ear
      if (L.old) P(x, fx + back1 * 2, eyeY + 2, km.s);
    }
    // facial hair
    const hm = ramp(L.hair);
    if (L.facial === 1) { if (d === 0) { Rr(x, hx0 + 1, eyeY + 2, 6, 3, hm.b); Rr(x, hx0 + 3, eyeY + 3, 2, 1, L.lip); Rr(x, hx0 + 1, eyeY + 4, 6, 1, hm.s); } else Rr(x, s > 0 ? hx0 + 3 : hx0, eyeY + 2, 5, 3, hm.b); }
    else if (L.facial === 2) { if (d === 0) Rr(x, hx0 + 2, eyeY + 2, 4, 1, hm.b); else Rr(x, s > 0 ? hx0 + 5 : hx0, eyeY + 2, 3, 1, hm.b); }
    else if (L.facial === 3) { const st = sh(skin, 0.74); if (d === 0) { P(x, hx0 + 1, eyeY + 3, st); P(x, hx0 + 2, eyeY + 4, st); P(x, hx0 + 5, eyeY + 4, st); P(x, hx0 + 6, eyeY + 3, st); } else { P(x, s > 0 ? hx0 + 5 : hx0 + 2, eyeY + 3, st); P(x, s > 0 ? hx0 + 4 : hx0 + 3, eyeY + 4, st); } }
    // glasses, mask, nose ring
    if (L.glasses === 'sun') { if (d === 0) { Rr(x, hx0 + 1, eyeY, 6, 1, '#141418'); P(x, hx0 + 2, eyeY, '#3a4a60'); P(x, hx0 + 5, eyeY, '#3a4a60'); } else Rr(x, s > 0 ? hx0 + 4 : hx0, eyeY, 4, 1, '#141418'); }
    else if (L.glasses === 'round') { const g = '#c8a050'; if (d === 0) { P(x, hx0 + 0, eyeY, g); P(x, hx0 + 3, eyeY, g); P(x, hx0 + 4, eyeY, g); P(x, hx0 + 7, eyeY, g); } else P(x, s > 0 ? hx0 + 6 : hx0 + 1, eyeY, g); }
    if (L.mask) {
      const mc = { white: '#ece6dc', gold: '#d8b040', black: '#1a1618', red: '#8a1a1e', silver: '#b8bcc4' }[L.maskColor || L.mask] || '#5a5a60', mm = ramp(mc);
      if (d === 0) { Rr(x, hx0, hy0 + 2, 8, 6, mm.b); Rr(x, hx0, hy0 + 7, 8, 1, mm.s); P(x, hx0 + 2, eyeY, '#0a0808'); P(x, hx0 + 5, eyeY, '#0a0808'); if (L.maskBeak) Rr(x, hx0 + 3, eyeY + 1, 2, 4, mm.s); }
      else { Rr(x, s > 0 ? hx0 + 2 : hx0, hy0 + 2, 6, 6, mm.b); P(x, s > 0 ? hx0 + 7 : hx0, eyeY, '#0a0808'); if (L.maskBeak) Rr(x, s > 0 ? hx0 + 8 : hx0 - 3, eyeY + 1, 3, 2, mm.s); }
    }
    if (L.nosering) P(x, d === 0 ? hx0 + 4 : (s > 0 ? hx0 + 8 : hx0 - 1), eyeY + 2, '#d8dce4');
  };

  // ------------------------------------------------ hair (with a little swing) and hats
  const drawHair = () => {
    const H = ramp(L.hair), hs = L.hairStyle, hx = hx0, hy = hy0;
    const swing = (kind === 'walk' || kind === 'run') ? (f % 4 < 2 ? 1 : 0) * (kind === 'run' ? -s : 0) : 0;
    const cap = (rows = 3) => { Rr(x, hx, hy - 1, 8, rows, H.b); Rr(x, hx + 1, hy - 1, 3, 1, H.l); if (side) Rr(x, s > 0 ? hx : hx + 6, hy, 2, rows + 2, H.s); };
    const backHair = (len) => { Rr(x, hx, hy - 1, 8, len, H.b); Rr(x, hx, hy + len - 2, 8, 1, H.s); P(x, hx + 2, hy, H.l); };
    switch (hs) {
      case 2: if (back) P(x, hx + 3, hy + 1, sh(L.skin, 0.9)); break;   // bald
      case 1: if (back) backHair(12); else { cap(); if (d === 0) { Rr(x, hx - 1, hy, 1, 11, H.b); Rr(x, hx + 8, hy, 1, 11, H.s); } else Rr(x, s > 0 ? hx - 1 + swing : hx + 6 + swing, hy, 3, 11, H.b); } break;
      case 3: if (back) { backHair(6); Rr(x, hx + 2, hy - 3, 4, 3, H.b); } else { cap(); Rr(x, hx + (side ? (s > 0 ? 0 : 5) : 2), hy - 3, 3, 3, H.b); P(x, hx + (side ? (s > 0 ? 1 : 6) : 3), hy - 3, H.l); } break;
      case 4: Rr(x, hx + 3, hy - 3, 2, side ? 4 : (back ? 9 : 4), H.b); P(x, hx + 3, hy - 3, H.l); if (side) Rr(x, hx + 1, hy - 2, 6, 2, H.b); break;
      case 5: cap(); for (let i = 0; i < 8; i += 2) P(x, hx + i, hy - 2, H.b); P(x, hx + 1, hy - 2, H.l); break;
      case 6: if (back) backHair(9); else { cap(); if (d === 0) { Rr(x, hx - 1, hy, 2, 7, H.b); Rr(x, hx + 7, hy, 2, 7, H.s); } else Rr(x, s > 0 ? hx - 1 : hx + 5, hy, 4, 7, H.b); } break;
      case 7: cap(); if (back) Rr(x, hx + 3 + swing, hy + 7, 2, 7, H.b); else if (side) Rr(x, (s > 0 ? hx - 2 : hx + 8) + swing, hy + 2, 2, 7, H.b); break;   // ponytail
      case 8: Rr(x, hx - 1, hy - 5, 10, 1, H.b); Rr(x, hx - 2, hy - 4, 12, 5, H.b); P(x, hx - 2, hy - 4, 'rgba(0,0,0,0)'); if (back) Rr(x, hx - 2, hy + 1, 12, 7, H.b); else if (d === 0) { Rr(x, hx - 2, hy + 1, 2, 5, H.b); Rr(x, hx + 8, hy + 1, 2, 5, H.s); } else Rr(x, s > 0 ? hx - 2 : hx + 6, hy + 1, 4, 5, H.b); for (let i = 0; i < 5; i++) P(x, hx - 1 + i * 2, hy - 2 + (i % 2), H.l); break;   // afro
      case 9: if (back) { Rr(x, hx, hy - 1, 8, 3, H.b); Rr(x, hx, hy + 2, 8, 3, H.d); } else { Rr(x, hx, hy - 1, 8, 2, H.b); Rr(x, d === 0 ? hx : (s > 0 ? hx : hx + 3), hy + 1, d === 0 ? 5 : 5, 1, H.b); if (side) Rr(x, s > 0 ? hx : hx + 6, hy + 1, 2, 3, H.d); } break;
      case 10: if (back) backHair(12); else { cap(); if (d === 0) { Rr(x, hx - 1, hy, 1, 11, H.b); Rr(x, hx + 8, hy, 1, 11, H.s); } else Rr(x, s > 0 ? hx - 1 : hx + 6, hy, 3, 11, H.b); }
        for (let y = hy + 2; y < hy + 11; y += 2) { if (d === 0) { P(x, hx - 1, y, H.d); P(x, hx + 8, y, H.d); } else if (back) { P(x, hx + 2, y, H.d); P(x, hx + 5, y, H.d); } else P(x, s > 0 ? hx : hx + 7, y, H.d); } break;
      default: if (back) backHair(8); else { cap(); if (d === 0) { P(x, hx, hy + 2, H.b); P(x, hx + 7, hy + 2, H.s); } }
    }
    // hats
    const hat = L.hat, hc = L.hatColor;
    if (!hat) return;
    if (hat === 'cap') { const m = ramp(hc || '#7a3a3a'); Rr(x, hx, hy - 2, 8, 4, m.b); Rr(x, hx + 1, hy - 2, 4, 1, m.l); if (d === 0) Rr(x, hx, hy + 2, 8, 1, m.d); else if (side) Rr(x, s > 0 ? hx + 7 : hx - 3, hy + 1, 4, 1, m.d); }
    else if (hat === 'helmet') { const m = ramp(hc || '#9aa0a8'); Rr(x, hx - 1, hy - 3, 10, 5, m.b); Rr(x, hx, hy - 3, 6, 1, m.l); Rr(x, hx - 1, hy + 2, 10, 1, m.d); }
    else if (hat === 'straw') { Rr(x, hx - 3, hy + 1, 14, 1, '#b8903c'); Rr(x, hx, hy - 3, 8, 4, '#d8b45a'); Rr(x, hx, hy, 8, 1, '#8a4a2a'); }
    else if (hat === 'crown') { Rr(x, hx, hy - 3, 8, 3, '#e0b840'); P(x, hx, hy - 4, '#fff0a0'); P(x, hx + 3, hy - 4, '#d03a3a'); P(x, hx + 7, hy - 4, '#fff0a0'); }
    else if (hat === 'bandana') { const m = ramp(hc || '#c03030'); Rr(x, hx, hy, 8, 2, m.b); Rr(x, hx, hy + 1, 8, 1, m.s); if (back) Rr(x, hx + 3, hy + 2, 2, 3, m.b); }
    else if (hat === 'kippah') Rr(x, hx + 2, hy - 1, 4, 1, hc || '#1a1a22');
    else if (hat === 'blackhat') { const m = ramp(hc || '#121214'); Rr(x, hx - 3, hy + 1, 14, 1, m.b); Rr(x, hx, hy - 4, 8, 5, m.b); Rr(x, hx, hy - 1, 8, 1, m.l); }
    else if (hat === 'tophat') { const m = ramp(hc || '#141418'); Rr(x, hx - 2, hy + 1, 12, 1, m.b); Rr(x, hx + 1, hy - 6, 6, 7, m.b); Rr(x, hx + 1, hy - 1, 6, 1, '#8a1a2a'); }
    else if (hat === 'beanie') { const m = ramp(hc || '#c8506a'); Rr(x, hx, hy - 3, 8, 5, m.b); Rr(x, hx, hy + 1, 8, 1, m.s); for (let i = 0; i < 4; i++) P(x, hx + 1 + i * 2, hy - 1, m.l); }
    else if (hat === 'hood' || hat === 'cowl') { const m = ramp(hc || (hat === 'cowl' ? '#2a1a1e' : '#5a4a3a')); if (back) Rr(x, hx - 1, hy - 2, 10, 11, m.b); else { Rr(x, hx - 1, hy - 2, 10, 3, m.b); Rr(x, hx - 1, hy, 2, 9, m.b); Rr(x, hx + 7, hy, 2, 9, m.s); if (hat === 'cowl' && d === 0) { Rr(x, hx + 1, hy + 2, 6, 4, '#120a0c'); P(x, hx + 2, hy + 4, '#d0402a'); P(x, hx + 5, hy + 4, '#d0402a'); } } }
  };

  // (hands are recorded as the arms are drawn)
  const headDraw = () => { if (HK === 1) { drawHead(); drawHair(); return; } const px = hx0 + 4; x.save(); x.translate(px, shoulderY + 1); x.scale(HK, HK); x.translate(-px, -shoulderY - 1); drawHead(); drawHair(); x.restore(); };
  // ------------------------------------------------ assemble in depth order
  if (L.cape && (back || side)) Rr(x, (side ? sx - s * 3 : cx - halfS), shoulderY + 1, side ? 3 : halfS * 2, hip - shoulderY + 6, L.cape);
  if (side) {
    const near = s > 0 ? 1 : 0, farI = 1 - near;
    drawArm(farI, true); drawLeg(farI, true);
    // (under a dress, robe, tunic or skirt the near leg goes behind the hem, not over it)
    if (/dress|robe|tunic/.test(L.topStyle) || L.bottom === 'skirt') { drawLeg(near, false); drawTorso(); } else { drawTorso(); drawLeg(near, false); }
    headDraw(); drawArm(near, false);
  } else {
    drawLeg(0, false); drawLeg(1, false);
    if (back) { drawArm(0, false); drawArm(1, false); drawTorso(); }
    else { drawTorso(); drawArm(0, false); drawArm(1, false); }
    headDraw();
  }
  if (L.belly && d === 0) { const cm = ramp(L.bareTop ? skin : cloth); Rr(x, cx - 3, shoulderY + 6, 6, 1 + L.belly, cm.b); P(x, cx - 2, shoulderY + 6, cm.l); Rr(x, cx - 3, shoulderY + 7 + L.belly, 6, 1, cm.s); }
  return { hx: hx0 + 4 - 4 * HK, hy: shoulderY + 1 + (hy0 - shoulderY - 1) * HK, hs: HK, hands };
}

// a soft colored outline: the darker tone of whatever material the edge pixel is
function outline(c) {
  const x = c.getContext('2d'), img = x.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4;
    if (src[i + 3] > 40) continue;
    let n = -1;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = xx + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = (Y * w + X) * 4; if (src[j + 3] > 40) { n = j; break; } }
    if (n < 0) continue;
    // stay within the frame cell
    if (Math.floor(xx / FW) !== Math.floor((n / 4 % w) / FW) || Math.floor(y / FH) !== Math.floor(Math.floor(n / 4 / w) / FH)) continue;
    d[i] = src[n] * 0.5; d[i + 1] = src[n + 1] * 0.48; d[i + 2] = src[n + 2] * 0.5; d[i + 3] = 130;
  }
  x.putImageData(img, 0, 0);
}

const KINDS = []; // [col] -> [kind, f]
for (let f = 0; f < 4; f++) KINDS[COL.idle + f] = ['idle', f];
for (let f = 0; f < 8; f++) { KINDS[COL.walk + f] = ['walk', f]; KINDS[COL.run + f] = ['run', f]; }
for (const k of ['sit', 'crouch', 'cower', 'handsup', 'mouth', 'flinch', 'talk', 'aim', 'reload', 'phone', 'carry', 'getup']) KINDS[COL[k]] = [k, 0];
for (let f = 0; f < 8; f++) { KINDS[COL.limp + f] = ['limp', f]; KINDS[COL.hunch + f] = ['hunch', f]; }
for (const k of ['slump', 'winded', 'guard']) { KINDS[COL[k]] = [k, 0]; KINDS[COL[k] + 1] = [k, 1]; }
KINDS[COL.drag] = ['drag', 1]; KINDS[COL.drag + 1] = ['drag', 5]; KINDS[COL.swim] = ['swim', 0]; KINDS[COL.swim + 1] = ['swim', 1];

function build(look, censored) {
  const nude = look.naked || look.shirtless || look.pantsless;
  const hair = look.hair || '#4a3020', skin = look.skin || '#e0b088';
  const h = hashStr(JSON.stringify(look));
  const L = {
    race: look.race, maskSki: look.maskSki, fem: look.body === 'f', skin, hair, eyes: look.eyes || '#1d1a22', eyeWhite: mix(skin, '#e8e4dc', 0.5),
    brow: sh(hair, 0.55), lip: look.body === 'f' ? mix(sh(skin, 0.74), '#7a3a40', 0.4) : sh(skin, 0.62), jaw: look.body === 'f' ? (h >> 5) % 2 : 1 + (h >> 5) % 2, lined: (h >> 7) % 3 === 0, scar: (h >> 9) % 8 === 0 ? 1 + ((h >> 12) % 2) : 0,
    top: look.naked || look.shirtless ? skin : (look.shirt || '#6a8ab8'), top2: look.shirt2 || sh(look.shirt || '#6a8ab8', 0.6),
    pants: look.naked || look.pantsless ? skin : (look.pants || '#4a3a2a'), shoes: look.naked ? sh(skin, 0.85) : (look.shoes || '#2e2018'),
    topStyle: look.naked || look.shirtless ? 'shirt' : (look.top || 'shirt'), bottom: look.naked || look.pantsless ? 'pants' : (look.bottom || 'pants'),
    hairStyle: look.hairStyle || 0, facial: look.facial != null ? look.facial : look.beard ? 1 : 0,
    hat: look.naked ? null : look.hat, hatColor: look.hatColor, glasses: look.naked ? null : look.glasses, mask: look.mask, maskColor: look.maskColor, maskBeak: look.maskBeak,
    armor: look.naked ? null : look.armor, apron: look.naked || look.shirtless ? null : look.apron, cape: look.naked ? null : look.cape, belly: look.belly || 0,
    nosering: look.nosering, tote: look.naked ? null : look.tote, toteColor: look.toteColor, pins: look.pins,
    patch: look.patch, chain: look.chain, gloves: look.gloves, tattoo: look.tattoo, bikini: !!look.bikini, bareTop: !look.kid && !!(look.naked || look.shirtless), bareBottom: !look.kid && !!(look.naked || look.pantsless), censored: nude ? censored : true,
    build: look.build != null ? look.build : h % 5 === 0 ? 0 : h % 5 === 4 ? 2 : 1,
    old: /^#(c8c8c8|d8d8d8|b8b8b8|e0e0e0|a8a8a8)/i.test(hair), kid: !!look.kid, shortSleeves: look.top === 'tshirt' || ((h >> 3) % 3 === 0 && (look.top || 'shirt') === 'shirt'),
  };
  L.id = hashStr(JSON.stringify(look) + (censored ? 'c' : ''));
  // people are painted frame by frame now (js/game/realbody.js): a sheet is only their handle, and the skeleton answers where things are
  if (G.body) { const c0 = document.createElement('canvas'); c0.width = c0.height = 1; return { img: c0, fw: FW, fh: FH, ww: WW, wh: WH, heads: G.body.headsOf(L), L }; }
  const c = document.createElement('canvas'); c.width = FW * NCOL; c.height = FH * 4;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const heads = [[], [], [], []];
  for (let d = 0; d < 4; d++) for (let col = 0; col < NCOL; col++) {
    const k = KINDS[col]; if (!k) continue;
    x.save(); x.translate(col * FW, d * FH);
    x.beginPath(); x.rect(0, 0, FW, FH); x.clip();
    heads[d][col] = drawFrame(x, L, d, k[0], k[1]);
    x.restore();
  }
  outline(c);
  return { img: c, fw: FW, fh: FH, ww: WW, wh: WH, heads, L };
}

// ---------------------------------------------------------------- cache
const cache = new Map();
const _char = A.character;
A.character = function (look) {
  const s = _char.call(this, look);
  if (!s.srcLook) { s.srcLook = look; }
  return s;
};
G.hd = {
  COL, FW, FH, WW, WH, KINDS,
  key(look) { const nude = look.naked || look.shirtless || look.pantsless; return JSON.stringify(look) + (nude && G.settings.get('censor') === false ? '|u' : ''); },
  get(sheet) {
    const look = sheet && sheet.srcLook;
    if (!look) return null;
    const k = this.key(look);
    let e = cache.get(k);
    if (!e) { e = build(look, G.settings.get('censor') !== false); cache.set(k, e); }
    return e;
  },
  build,
};
G.events.on('settingsChanged', (k) => { if (k === 'censor') cache.clear(); });

// ---------------------------------------------------------------- which frame, live
const AP = G.Actor.prototype, _draw = AP.draw, _frame = AP.frame;
function animState(a, dt) {
  const st = a._hd || (a._hd = { phase: 0, idleT: Math.random() * 3, lx: a.x, ly: a.y, dir: a.dir, turnT: 0, shown: a.dir, fidgetT: 4 + Math.random() * 10, lookT: 0, lookDir: a.dir, blinkT: 2 + Math.random() * 4, speed: 0 });
  const moved = Math.hypot(a.x - st.lx, a.y - st.ly);
  st.lx = a.x; st.ly = a.y;
  const sp = dt > 0 ? moved / dt : 0;
  st.speed += (sp - st.speed) * Math.min(1, dt * 12);
  const running = st.speed > 62;
  if (a.moving && moved > 0.01) st.phase = (st.phase + moved / (running ? 38 : 25)) % 1;   // one full stride per this many world px: the feet stay where they land
  else if (!a.moving) st.phase = 0;
  st.idleT += dt;
  // turning: an in-between facing for a moment when someone turns around
  if (a.dir !== st.dir) {
    const opposite = (a.dir === 0 && st.dir === 3) || (a.dir === 3 && st.dir === 0) || (a.dir === 1 && st.dir === 2) || (a.dir === 2 && st.dir === 1);
    st.turnFrom = st.dir; st.dir = a.dir; st.turnT = opposite ? 0.09 : 0;
  }
  if (st.turnT > 0) st.turnT -= dt;
  // idle fidgets: look around now and then
  if (!a.moving && !a.talking) { if ((st.fidgetT -= dt) <= 0) { st.fidgetT = 5 + Math.random() * 12; st.lookT = 0.8 + Math.random() * 0.8; st.lookDir = a.dir === 0 || a.dir === 3 ? (Math.random() < 0.5 ? 1 : 2) : 0; } }
  if (st.lookT > 0) st.lookT -= dt;
  if ((st.blinkT -= dt) <= -0.12) st.blinkT = 2 + Math.random() * 4.5;
  return { st, running };
}
function pickFrame(a, st, running) {
  let dir = a.dir;
  if (st.turnT > 0) dir = st.turnFrom === 0 || st.turnFrom === 3 ? 1 + (a.x % 2 < 1 ? 0 : 1) : 0;
  else if (st.lookT > 0 && !a.moving) dir = st.lookDir;
  let col;
  if (a.swimming) col = COL.swim + (Math.floor(st.idleT * 3) % 2);
  else if ((a.seated && !a.moving) || a.sitting) col = COL.sit;   // (never walking in the sitting pose)
  else if (a.cower > 0) col = COL.cower;
  else if (a.surrender || a.handsUp) col = COL.handsup;
  else if (a.swing && a.swing.st) col = G.fight ? G.fight.col(a.swing) : COL.idle;   // the whole body strikes (js/game/fighting.js)
  else if (a.hurtTimer > 0 && a.hurtTimer > 0.12) col = COL.flinch;
  else if (a.downT > 0 && a.downT <= 0.35) col = COL.getup;   // getting back up (lying flat is drawn rotated)
  else if (a.dragging && a.moving) col = COL.drag + (st.phase < 0.5 ? 0 : 1);
  else if (a.dragging) col = COL.carry;
  else if (a.reloadT > 0) col = COL.reload;
  else if ((a.kind === 'player' && a.reading) || (a.kind === 'player' && G.PhoneScene && G.scenes.stack.some((s) => s instanceof G.PhoneScene)) || (a.doing && a.doing.kind === 'phone')) col = COL.phone;
  else if (a.moving) col = (running ? COL.run : G.hd.gait ? COL[G.hd.gait(a)] : COL.walk) + Math.floor(st.phase * 8) % 8;
  else if (G.hd.stance && !a.talking && !a.doing && !a.seated && G.hd.stance(a)) col = COL[G.hd.stance(a)] + (Math.floor(st.idleT * 1.4) % 2);
  else if (a.itemPose === 'bend') col = COL.crouch;
  else if (a.itemPose === 'mouth') col = COL.mouth;
  else if (a.doing && /crouch/.test((G.npcDoes && G.npcDoes.DOES[a.doing.kind] || {}).pose || '')) col = COL.crouch;
  else if (a.doing && a.doing.kind === '_use') col = a.doing.t < 1 ? COL.mouth : COL.idle;   // using an item (js/game/extras.js)
  else if (a.doing && (a.doing.t % 4) < 1.1 && /cig|cup|can|bottle|food/.test((G.npcDoes && G.npcDoes.DOES[a.doing.kind] || {}).prop || '')) col = COL.mouth;
  else if (a.smoking && (a.smoking.t % 6) < 1) col = COL.mouth;
  else if (a.talking && Math.floor(st.idleT * 1.5) % 3 === 0) col = COL.talk;
  else if (a.weaponItem && a.weaponItem.gun && (a.shotT > 0 || (a.kind === 'player' && a.mouseHeld))) col = COL.aim;
  else col = COL.idle + Math.floor(st.idleT * 1.6) % 4;
  return { col, dir };
}
AP.draw = function (ctx) {
  const s = this.sheet;
  if (!s || s.animal || this.kind === 'animal' || this.kind === 'vehicle') return _draw.call(this, ctx);
  const hd = G.hd.get(s);
  if (!hd) return _draw.call(this, ctx);
  const dt = Math.min(0.1, G.loop.time - (this._hdT || G.loop.time)); this._hdT = G.loop.time;
  const { st, running } = animState(this, dt);
  const { col, dir } = pickFrame(this, st, running);
  this._hdFrame = { col, dir };
  if (G.melee && G.melee.draw) G.melee.draw(ctx, this, true);   // the weapon behind the body (js/game/melee.js)
  this.drawShadow(ctx);
  const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0;
  const img = flash ? A.white(hd.img) : hd.img;
  let recoil = this.shotT > 0 ? -Math.cos(this.aim || 0) * 0.5 : 0, lungeY = 0;
  if (this.swing && this.swing.st) { const sw = this.swing, st = sw.st, p = sw.t < st.wind ? -0.3 * (sw.t / st.wind) : sw.t < st.wind + st.act ? (sw.t - st.wind) / st.act : Math.max(0, 1 - (sw.t - st.wind - st.act) / st.rec); const L = (st.kind === 'slam' || st.kind === 'chop' ? 2 : st.kind === 'kick' ? 0.8 : 1.5) * Math.sin(Math.max(-0.5, p) * Math.PI / 2); recoil += Math.cos(sw.base) * L; lungeY = Math.sin(sw.base) * L * 0.6; }   // lean back into the wind-up, lunge into the strike
  const x0 = Math.round((this.x + recoil) * 2) / 2 - WW / 2, y0 = Math.round((this.y + lungeY) * 2) / 2 - WH + 1;
  if (this.downT > 0.35) {   // knocked flat: lying on the ground, rotated toward where the blow sent them
    ctx.save(); ctx.translate(this.x, this.y - 4); ctx.rotate((this.downDir || 1) * Math.PI / 2); ctx.drawImage(img, COL.flinch * FW, dir * FH, FW, FH, -WW / 2, -WH / 2, WW, WH); ctx.restore();
  } else ctx.drawImage(img, col * FW, dir * FH, FW, FH, x0, y0, WW, WH);
  // live face: blinking, a moving mouth when talking
  const hp = hd.heads[dir] && hd.heads[dir][col];
  if (hp && dir !== 3 && !flash && !G.body) {
    const k = WW / FW, ky = WH / FH, skin = hd.L.skin;
    if (st.blinkT < 0) { ctx.fillStyle = A.shade(skin, 0.86); if (dir === 0) { ctx.fillRect(x0 + (hp.hx + 1) * k, y0 + (hp.hy + 4 * (hp.hs || 1)) * ky, 2 * k, k); ctx.fillRect(x0 + (hp.hx + 5) * k, y0 + (hp.hy + 4 * (hp.hs || 1)) * ky, 2 * k, k); } else ctx.fillRect(x0 + (dir === 2 ? hp.hx + 6 * (hp.hs || 1) : hp.hx) * k, y0 + (hp.hy + 4 * (hp.hs || 1)) * ky, 2 * k, k); }
    const speaking = (this.bark && this.barkT > 0) || this.talking;
    if (speaking && Math.floor(G.loop.time * 9) % 2 === 0 && !hd.L.mask) { ctx.fillStyle = '#3a1418'; ctx.fillRect(x0 + (dir === 0 ? hp.hx + 3 * (hp.hs || 1) : dir === 2 ? hp.hx + 7 * (hp.hs || 1) : hp.hx) * k, y0 + (hp.hy + 7 * (hp.hs || 1)) * ky, (dir === 0 ? 2 : 1) * k, k); }
  }
  // condition on the body: blood, wet, sick
  if (this.bloody > 0 || (this.effects && G.effects.has(this, 'blood_soaked'))) { if (G.bloodStains) G.bloodStains(ctx, this, x0, y0, col, dir, hd); else { const r = new G.RNG(this.bloodSeed || 7); ctx.fillStyle = 'rgba(120,10,10,0.8)'; for (let i = 0; i < 7; i++) ctx.fillRect(x0 + 5 + r.range(0, 6), y0 + 8 + r.range(0, 9), r.range(0.5, 1.5), r.range(0.5, 1)); } }   // (progressive: js/game/knockout.js)
  if (hp && dir !== 3 && !flash && G.hd.expression && !G.body) G.hd.expression(ctx, this, hd, dir, hp, x0, y0, WW / FW, WH / FH);
  if (G.wetOverlay && this.kind !== 'animal') G.wetOverlay(ctx, this, hd, col, dir, FW, FH, x0, y0, WW, WH);
  if (G.melee && G.melee.draw) G.melee.draw(ctx, this, false); else if (this.attackTimer > 0) this.drawSwing(ctx);
};
G.hd.anim = { animState, pickFrame };   // (for tests)
AP.drawShadow = function (ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(this.x, this.y - 0.5, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
};
// visuals.js reads frame() for sun shadows: give it the classic frame (same silhouette, cheaper)
AP.frame = function () { return _frame.call(this); };


// ---------------------------------------------------------------- dying: a fall, not a pop
const fallers = [];
const NP = G.NPC.prototype, _die = NP.die;
NP.die = function (source, scene) {
  if (!this.dead && this.sheet) {
    const dx = source && source.x != null ? this.x - source.x : (Math.random() - 0.5), dy = source && source.y != null ? this.y - source.y : 0;
    fallers.push({ sheet: this.sheet, x: this.x, y: this.y, dir: this.dir, t: 0, ang: Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx || 1) : (dy > 0 ? 1 : -1), map: scene.map.id });
    this._fallDir = dx >= 0 ? 1 : -1;
  }
  const r = _die.call(this, source, scene);
  // remember the pose on the corpse (stable: stored with it)
  const c = Object.values(scene.world.containers).find((k) => k.kind === 'corpse' && k.x === this.x && k.y === this.y && !k.pose);
  if (c) { const dx = source && source.x != null ? this.x - source.x : 0; c.pose = G.hd.posePick(c, dx, this); }
  return r;
};
G.hd.posePick = function (c, dx, actor) {
  const r = new G.RNG((c.id || 'c') + 'pose');
  const nearWall = actor && G.scenes.top() && actor.kind === 'npc' && (() => { const m = G.maps.cache[c.map]; return m && m.isSolidTile(Math.floor(c.x / 16), Math.floor((c.y - 12) / 16)); })();
  const opts = nearWall ? ['slumped', 'back', 'side'] : ['back', 'face', 'side', 'curled', 'face', 'back'];
  return { kind: r.pick(opts), flip: dx < 0 ? -1 : 1, eyes: r.chance(0.5) };
};
const GS = G.GameScene.prototype, _ph = GS.drawPhantoms;
GS.drawPhantoms = function (ctx) {
  _ph.call(this, ctx);
  for (let i = fallers.length - 1; i >= 0; i--) {
    const f = fallers[i];
    if (f.map !== this.map.id) { fallers.splice(i, 1); continue; }
    f.t += 1 / 60;
    if (f.t > 0.7) { fallers.splice(i, 1); continue; }
    const hd = G.hd.get(f.sheet); if (!hd) { fallers.splice(i, 1); continue; }
    const k = Math.min(1, f.t / 0.6), ease = k * k;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(ease * Math.PI / 2 * f.ang); ctx.globalAlpha = 1 - Math.max(0, (f.t - 0.6) * 8);
    ctx.drawImage(hd.img, COL.flinch * FW, f.dir * FH, FW, FH, -WW / 2, -WH + 1, WW, WH);
    ctx.restore();
  }
};

// ---------------------------------------------------------------- corpses: posed, decaying
G.hd.drawCorpse = function (ctx, c) {
  const sheet = A.character(c.look), hd = G.hd.get(sheet);
  if (!hd) return false;
  const pose = c.pose || (c.pose = G.hd.posePick(c, 0, null));
  const w = G.world, age = w ? w.day - (c.day || 0) + (w.hourF / 24) : 0;
  const drag = G.player && G.player.dragging === c.id;
  // the pose: which frame, how it lies
  let col = COL.idle, dir = 0, rot = Math.PI / 2 * pose.flip, oy = -5;
  if (pose.kind === 'face') { dir = 3; }
  else if (pose.kind === 'side') { dir = pose.flip > 0 ? 2 : 1; }
  else if (pose.kind === 'curled') { col = COL.cower; dir = pose.flip > 0 ? 2 : 1; }
  else if (pose.kind === 'slumped') { col = COL.sit; dir = 0; rot = 0; oy = 0; }
  if (drag) { col = COL.handsup; dir = 3; rot = Math.atan2(G.player.y - c.y, G.player.x - c.x) - Math.PI / 2; }   // arms trailing behind, pulled by the wrists
  ctx.save();
  ctx.translate(Math.round(c.x), Math.round(c.y + oy));
  ctx.rotate(rot);
  // decay: pale, then grey-green
  const f = [];
  if (age > 0.3) f.push(`saturate(${Math.max(0.35, 1 - age * 0.25).toFixed(2)})`, `brightness(${Math.max(0.75, 1 - age * 0.05).toFixed(2)})`);
  if (age > 2) f.push(`hue-rotate(${Math.min(40, (age - 2) * 10).toFixed(0)}deg)`);
  if (f.length) ctx.filter = f.join(' ');
  ctx.drawImage(hd.img, col * FW, dir * FH, FW, FH, -WW / 2, -WH / 2, WW, WH);
  ctx.filter = 'none';
  // eyes: open or closed
  const hp = hd.heads[dir] && hd.heads[dir][col];
  if (hp && dir !== 3 && !pose.eyes) { ctx.fillStyle = A.shade(hd.L.skin, 0.8); ctx.fillRect(-WW / 2 + (hp.hx + 1) * WW / FW, -WH / 2 + (hp.hy + 4 * (hp.hs || 1)) * WH / FH, 3, 0.5); }
  ctx.restore();
  // flies, after a day, with their buzz
  if (age > 1 && !c.burnt) {
    const n = Math.min(6, Math.floor(age * 1.5));
    ctx.fillStyle = '#141414';
    for (let i = 0; i < n; i++) { const t = G.loop.time * (2 + i * 0.37) + i * 1.7; ctx.fillRect(c.x + Math.sin(t) * 7 + Math.sin(t * 2.3) * 2, c.y - 6 + Math.cos(t * 1.3) * 4 - 3, 1, 0.6); }
    if (Math.random() < 0.01) G.audio.play('flies', { x: c.x, y: c.y });
  }
  return true;
};
G.audio.SFX.flies = function (o, T) { const w = T._out(o, { vol: 0.25, wet: 0.2, range: 140, ref: 20 }); if (!w) return; const s = T._osc(w.node, w.t, { type: 'sawtooth', f: 210, dur: 0.4, vol: 0.05, a: 0.2, hold: 0.8 }); const l = T.ctx.createOscillator(), lg = T.ctx.createGain(); l.frequency.value = 7; lg.gain.value = 25; l.connect(lg); lg.connect(s.frequency); l.start(w.t); l.stop(w.t + 1.5); };
})();

// where an HD person's hand is right now, in world coordinates (weapons are held there)
(() => {
G.hd.handOf = function (a, which) {
  if (!a.sheet || !a._hdFrame || a._hdFrame.dir !== a.dir) return null;   // (a frame from before they turned says nothing about now)
  const hd = G.hd.get(a.sheet); if (!hd) return null;
  const f = a._hdFrame, info = hd.heads[f.dir] && hd.heads[f.dir][f.col];
  if (!info || !info.hands) return null;
  const i = which != null ? which : f.dir === 2 ? 1 : f.dir === 1 ? 0 : f.dir === 3 ? 0 : 1;
  const h = info.hands[i] || info.hands[1 - i]; if (!h) return null;
  const x0 = a.x - G.hd.WW / 2, y0 = a.y - G.hd.WH + 1;
  const kx = G.hd.WW / G.hd.FW, ky = G.hd.WH / G.hd.FH;
  return { x: x0 + h[0] * kx, y: y0 + h[1] * ky, shoulderY: y0 + (info.hy + 11) * ky, dir: f.dir };
};
})();

// ---------------------------------------------------------------- every 16x20 sheet draw becomes HD
// Menus, portraits, the phone, barber, shop, doll views, beds, dreams, the jail, love scenes... all draw the
// 16x20 character sheet. Any draw of one is redirected to the
// matching frame of the HD sheet (same place on screen; a standing frame for frame 0, walking for 1-2).
(() => {
const A = G.assets, _c = A.character;
A.character = function (look) { const s = _c.call(this, look); if (s && s.img && !s.img._classic) s.img._classic = s; return s; };
const CP = CanvasRenderingContext2D.prototype, _di = CP.drawImage;
CP.drawImage = function (img, a, b, c, d, e, f, g2, h) {
  if (img && img._classic && arguments.length === 9 && !G._hdDrawing) {
    const s = img._classic, hd = G.hd.get(s);
    if (hd && s.fw === 16) {
      const col = Math.floor(a / s.fw), row = Math.floor(b / s.fh), oy = b - row * s.fh;
      const hcol = col === 0 ? G.hd.COL.idle : G.hd.COL.walk + (col === 1 ? 2 : 6);
      const kx = G.hd.FW / s.fw, ky = G.hd.FH / s.fh;
      return _di.call(this, hd.img, hcol * G.hd.FW + (a - col * s.fw) * kx, row * G.hd.FH + oy * ky, c * kx, d * ky, e, f, g2, h);
    }
  }
  return _di.apply(this, arguments);
};
})();
