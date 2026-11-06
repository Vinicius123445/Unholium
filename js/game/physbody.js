'use strict';
// A body with real physics. In metres and seconds, in three dimensions (x, y on the ground, z up), and with no drawing in it: it is the
// same simulation when the engine goes 3D. js/game/physview.js puts it on the screen.
//   Joints are point masses, shared out like a real person's weight. Bones are rods between them, the trunk is braced, and knees and
//   elbows only fold the way they fold. Gravity, the ground and walls act on all of it, and a blow is an impulse (force times time) at
//   a point: where it lands and which way it goes decide what the body does, nothing else does.
//   Muscles are internal: they pull joints toward a pose but cannot move the body's centre, so nobody hangs in the air. Standing is
//   earned: legs push the trunk up against the feet only while the feet are on the ground, weight shifts over the feet, and when
//   the body is going over faster than that can hold it takes a step to catch itself. If no step can, the muscles let go and it falls.
//   Getting up is a pose the muscles drive (a blend of animation and physics). So is holding a stance.
(() => {
const G_ACC = 9.81, HZ = 60, SUB = 6, H = 1 / HZ / SUB, VMAX = 7;
// name, side (+ right), forward, height (at 1.75 m), share of body mass, radius
const JOINTS = [
  ['pelvis', 0, 0, 0.95, 0.10, 0.11], ['hipL', -0.09, 0, 0.92, 0.04, 0.08], ['hipR', 0.09, 0, 0.92, 0.04, 0.08],
  ['belly', 0, 0.01, 1.12, 0.10, 0.11], ['chest', 0, 0.01, 1.32, 0.16, 0.12], ['shL', -0.19, 0, 1.42, 0.04, 0.05], ['shR', 0.19, 0, 1.42, 0.04, 0.05], ['neck', 0, 0, 1.47, 0.02, 0.05], ['head', 0, 0.01, 1.62, 0.07, 0.10],
  ['elbL', -0.23, -0.01, 1.14, 0.025, 0.04], ['elbR', 0.23, -0.01, 1.14, 0.025, 0.04], ['handL', -0.24, 0.05, 0.89, 0.015, 0.04], ['handR', 0.24, 0.05, 0.89, 0.015, 0.04],
  ['kneeL', -0.1, 0.02, 0.50, 0.09, 0.06], ['kneeR', 0.1, 0.02, 0.50, 0.09, 0.06], ['ankL', -0.1, -0.02, 0.08, 0.04, 0.05], ['ankR', 0.1, -0.02, 0.08, 0.04, 0.05], ['toeL', -0.1, 0.15, 0.04, 0.0125, 0.04], ['toeR', 0.1, 0.15, 0.04, 0.0125, 0.04],
];
const I = {}; JOINTS.forEach((j, i) => { I[j[0]] = i; });
const SHARES = JOINTS.reduce((s, j) => s + j[4], 0);   // (the shares, so the joints add up to exactly the body's mass)
const N = JOINTS.length;
// rods: stay this long. Braced in the hips and in the shoulders; the spine between them bends.
const RODS = [['pelvis', 'hipL'], ['pelvis', 'hipR'], ['hipL', 'hipR'], ['pelvis', 'belly'], ['belly', 'chest'], ['chest', 'shL'], ['chest', 'shR'], ['shL', 'shR'], ['neck', 'shL'], ['neck', 'shR'], ['neck', 'chest'], ['neck', 'head'],
  ['shL', 'elbL'], ['elbL', 'handL'], ['shR', 'elbR'], ['elbR', 'handR'], ['hipL', 'kneeL'], ['kneeL', 'ankL'], ['ankL', 'toeL'], ['hipR', 'kneeR'], ['kneeR', 'ankR'], ['ankR', 'toeR'], ['belly', 'hipL'], ['belly', 'hipR'], ['belly', 'shL'], ['belly', 'shR']];
// ranges: how far two joints may come together and move apart (as a share of their standing distance); this is what limits a joint
const RANGES = [['pelvis', 'chest', 0.68, 1.03], ['chest', 'head', 0.82, 1.08], ['hipL', 'shR', 0.8, 1.1], ['hipR', 'shL', 0.8, 1.1], ['hipL', 'ankL', 0.3, 1.01], ['hipR', 'ankR', 0.3, 1.01], ['kneeL', 'toeL', 0.72, 1.14], ['kneeR', 'toeR', 0.72, 1.14], ['shL', 'handL', 0.16, 1.01], ['shR', 'handR', 0.16, 1.01],
  ['pelvis', 'kneeL', 0.4, 1.1], ['pelvis', 'kneeR', 0.4, 1.1], ['chest', 'elbL', 0.4, 1.25], ['chest', 'elbR', 0.4, 1.25], ['kneeL', 'kneeR', 0.5, 3.6], ['ankL', 'ankR', 0.4, 5.2], ['handL', 'pelvis', 0.2, 9], ['handR', 'pelvis', 0.2, 9], ['handL', 'chest', 0.15, 9], ['handR', 'chest', 0.15, 9]];
// what a blow to each joint does to the muscles around it
const LIMBS = { armL: ['elbL', 'handL', 'shL'], armR: ['elbR', 'handR', 'shR'], legL: ['kneeL', 'ankL', 'toeL', 'hipL'], legR: ['kneeR', 'ankR', 'toeR', 'hipR'] };
const LIMB_OF = {}; for (const k in LIMBS) for (const n of LIMBS[k]) LIMB_OF[n] = k;
const UPPER = ['belly', 'chest', 'shL', 'shR', 'neck', 'head', 'elbL', 'elbR', 'handL', 'handR'].map((n) => I[n]);
const FEET = [[I.ankL, I.toeL], [I.ankR, I.toeR]], GETUP = 2.1;
// the crouch a person passes through getting up: over their feet, weight forward, hands down (side, forward, height, in the order of JOINTS)
const CROUCH = [[0, -0.12, 0.42], [-0.09, -0.12, 0.40], [0.09, -0.12, 0.40], [0, -0.02, 0.60], [0, 0.17, 0.75], [-0.19, 0.2, 0.85], [0.19, 0.2, 0.85], [0, 0.26, 0.89], [0, 0.37, 1.0], [-0.23, 0.25, 0.54], [0.23, 0.25, 0.54], [-0.2, 0.3, 0.3], [0.2, 0.3, 0.3], [-0.12, 0.26, 0.45], [0.12, 0.26, 0.45], [-0.12, 0, 0.08], [0.12, 0, 0.08], [-0.12, 0.17, 0.04], [0.12, 0.17, 0.04]];
// who each leg lifts: mostly its own side of the body
const TRUNK = ['pelvis', 'hipL', 'hipR', 'belly', 'chest', 'shL', 'shR', 'neck', 'head'], liftOf = (s) => TRUNK.map((n) => [I[n], Math.max(0.15, 1 + 3.4 * s * JOINTS[I[n]][1] / 0.2)]), LIFT_L = liftOf(-1), LIFT_R = liftOf(1), LIFT_ALL = liftOf(0);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

class Body3 {
  // x, y, z: where the feet are; yaw: the way it faces (radians, 0 along +y); o.height (m), o.mass (kg), o.world: { walls: [{ nx, ny, d }], ground: z }
  constructor(x, y, z, yaw = 0, o = {}) {
    const k = (o.height || 1.75) / 1.75, m = o.mass || 75;
    this.k = k; this.mass = m; this.world = o.world || {}; this.yaw = yaw; this.state = 'stand'; this.tone = 1; this.time = 0;
    this.limb = { armL: 1, armR: 1, legL: 1, legR: 1 }; this.stun = 0; this.settled = 0; this.step = null; this.steps = 0; this.upT = 0; this.log = [];
    this.x = new Float64Array(N * 3); this.p = new Float64Array(N * 3); this.v = new Float64Array(N * 3); this.w = new Float64Array(N); this.r = new Float64Array(N); this.touch = new Uint8Array(N); this.stops = []; this.bends = [];
    this.rest = new Float64Array(N * 3);
    JOINTS.forEach((j, i) => { this.rest[i * 3] = j[1] * k; this.rest[i * 3 + 1] = j[2] * k; this.rest[i * 3 + 2] = j[3] * k; this.w[i] = SHARES / (j[4] * m); this.r[i] = j[5] * k; });
    this.place(x, y, z, yaw);
    const len = (a, b) => Math.hypot(this.rest[a * 3] - this.rest[b * 3], this.rest[a * 3 + 1] - this.rest[b * 3 + 1], this.rest[a * 3 + 2] - this.rest[b * 3 + 2]);
    this.rods = RODS.map(([a, b]) => [I[a], I[b], len(I[a], I[b])]);
    this.ranges = RANGES.map(([a, b, lo, hi]) => [I[a], I[b], len(I[a], I[b]) * lo, len(I[a], I[b]) * hi]);
  }
  place(x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < N; i++) { const a = this.rest[i * 3], f = this.rest[i * 3 + 1], u = this.rest[i * 3 + 2]; this.x[i * 3] = x + a * c - f * s; this.x[i * 3 + 1] = y + a * s + f * c; this.x[i * 3 + 2] = z + u; }
    this.v.fill(0); this.p.set(this.x); this.yaw = yaw;
  }
  // ---------------------------------------------------------------- questions
  at(name) { const i = I[name]; return [this.x[i * 3], this.x[i * 3 + 1], this.x[i * 3 + 2]]; }
  com() { let m = 0, a = 0, b = 0, c = 0, va = 0, vb = 0, vc = 0; for (let i = 0; i < N; i++) { const q = 1 / this.w[i]; m += q; a += this.x[i * 3] * q; b += this.x[i * 3 + 1] * q; c += this.x[i * 3 + 2] * q; va += this.v[i * 3] * q; vb += this.v[i * 3 + 1] * q; vc += this.v[i * 3 + 2] * q; } return { x: a / m, y: b / m, z: c / m, vx: va / m, vy: vb / m, vz: vc / m, m }; }
  energy() { let e = 0; for (let i = 0; i < N; i++) e += 0.5 * (this.v[i * 3] ** 2 + this.v[i * 3 + 1] ** 2 + this.v[i * 3 + 2] ** 2) / this.w[i]; return e; }
  // how upright: 1 standing straight, 0 lying flat
  upright() { const a = this.at('pelvis'), b = this.at('chest'), l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1; return Math.max(0, (b[2] - a[2]) / l); }
  // the body's own axes, from its hips and trunk
  frame() { const hl = this.at('hipL'), hr = this.at('hipR'), p = this.at('pelvis'), c = this.at('chest'), side = unit([hr[0] - hl[0], hr[1] - hl[1], hr[2] - hl[2]]), up0 = unit([c[0] - p[0], c[1] - p[1], c[2] - p[2]]), fwd = unit(cross(up0, side)), up = cross(side, fwd); return { side, fwd, up, p }; }
  // ---------------------------------------------------------------- a blow
  // impulse in newton-seconds at a point in the world, along a direction. Spread over the joints it lands on.
  hit(point, dir, impulse, o = {}) {
    const d = unit(dir); let best = 0, bd = 1e9, sum = 0, near = []; const far = new Float64Array(N);
    for (let i = 0; i < N; i++) { const q = Math.hypot(this.x[i * 3] - point[0], this.x[i * 3 + 1] - point[1], this.x[i * 3 + 2] - point[2]); far[i] = q; if (q < bd) { bd = q; best = i; } }
    // flesh and bone carry a blow on: the harder it is for what it lands on, the further along the body it spreads (no joint is ever sent off alone)
    for (const reach of [0.16, 0.3, 0.5, 0.8, 1.2, 3]) { near = []; sum = 0; for (let i = 0; i < N; i++) { const k = Math.max(0, 1 - far[i] / (reach * this.k)); if (k > 0) { near.push([i, k / this.w[i]]); sum += k / this.w[i]; } } if (!near.length) { near.push([best, 1 / this.w[best]]); sum = 1 / this.w[best]; } if (impulse / sum < VMAX) break; }
    // each joint in reach takes its share of the impulse by mass, so they all change speed together
    for (const [i, s] of near) { const dv = (impulse * (s / sum)) * this.w[i]; this.v[i * 3] += d[0] * dv; this.v[i * 3 + 1] += d[1] * dv; this.v[i * 3 + 2] += d[2] * dv; }
    const name = JOINTS[best][0], shock = impulse / (this.mass * 0.6), limb = LIMB_OF[name];
    // a blow takes the fight out of the muscles it lands on, and out of everything if it is to the head
    if (name === 'head' || name === 'neck') { this.stun = Math.max(this.stun, shock * 1.1); this.tone = Math.min(this.tone, 1 - Math.min(0.95, shock * 0.8)); } else this.tone = Math.min(this.tone, 1 - Math.min(0.5, shock * 0.18));
    if (limb) this.limb[limb] = Math.max(0, this.limb[limb] - Math.min(1, shock * 0.5));
    if (o.wound && limb) this.limb[limb] = Math.min(this.limb[limb], o.wound);
    this.log.push({ t: this.time, name, impulse }); if (this.log.length > 12) this.log.shift();
    if (this.state === 'down' || this.state === 'getup') { this.state = 'fall'; this.upT = 0; this.settled = 0; }
    return name;
  }
  // hurt that stays: a share of the strength of a limb (0 useless, 1 well)
  wound(limb, left) { this.limb[limb] = Math.min(this.limb[limb], left); this.woundL = this.woundL || {}; this.woundL[limb] = left; }
  // ---------------------------------------------------------------- simulation
  update(dt = 1 / HZ) { for (this._a = (this._a || 0) + dt; this._a >= 1 / HZ - 1e-9; this._a -= 1 / HZ) { for (let s = 0; s < SUB; s++) this.substep(); this.control(1 / HZ); this.time += 1 / HZ; } }
  substep() {
    const { x, p, v, w } = this, ground = this.world.ground || 0; this.stops.length = 0; this.bends.length = 0;
    if (this.state === 'stand') this.drive(); else if (this.state === 'getup') this.guide();
    for (let i = 0; i < N * 3; i += 3) { v[i + 2] -= G_ACC * H; p[i] = x[i]; p[i + 1] = x[i + 1]; p[i + 2] = x[i + 2]; x[i] += v[i] * H; x[i + 1] += v[i + 1] * H; x[i + 2] += v[i + 2] * H; }
    for (let n = 0; n < 2; n++) {
      for (const [a, b, l] of this.rods) this.keep(a, b, l, l);
      for (const [a, b, lo, hi] of this.ranges) this.keep(a, b, lo, hi, 0.012);
      this.hinge(I.kneeL, I.hipL, I.ankL, 1); this.hinge(I.kneeR, I.hipR, I.ankR, 1); this.hinge(I.elbL, I.shL, I.handL, -1); this.hinge(I.elbR, I.shR, I.handR, -1);
      // the ground is solved with the bones, so nothing is pressed through it and sprung back out
      for (let i = 0; i < N; i++) { const j = i * 3, low = ground + this.r[i]; if (x[j + 2] < low) x[j + 2] = low; }
    }
    this.touch.fill(0);
    const walls = this.world.walls;
    for (let i = 0; i < N; i++) {
      const j = i * 3, r = this.r[i], low = ground + r;
      if (x[j + 2] <= low + 1e-4) {
        this.touch[i] = 1;
        // friction with the ground: feet with weight on them grip, everything else drags
        const dx = x[j] - p[j], dy = x[j + 1] - p[j + 1], foot = i === I.ankL || i === I.ankR || i === I.toeL || i === I.toeR, planted = this.state === 'stand' && foot, f = planted ? 1 : this.state === 'getup' ? 0 : 0.42; x[j] -= dx * f; x[j + 1] -= dy * f;
      }
      if (walls) for (const q of walls) { const e = x[j] * q.nx + x[j + 1] * q.ny - q.d - r; if (e < 0) { x[j] -= q.nx * e; x[j + 1] -= q.ny * e; this.wallHit = Math.max(this.wallHit || 0, -(v[j] * q.nx + v[j + 1] * q.ny)); } }
    }
    for (let i = 0; i < N * 3; i++) v[i] = (x[i] - p[i]) / H;
    // a joint that reached its limit stops there, it does not spring back: that energy goes into the body, as it does in a real one
    const st = this.stops, be = this.bends;
    for (let i = 0; i < st.length; i += 5) { const a = st[i], b = st[i + 1], A = a * 3, B = b * 3, nx = st[i + 2], ny = st[i + 3], nz = st[i + 4], vn = (v[B] - v[A]) * nx + (v[B + 1] - v[A + 1]) * ny + (v[B + 2] - v[A + 2]) * nz, k = vn / (w[a] + w[b]); v[A] += nx * k * w[a]; v[A + 1] += ny * k * w[a]; v[A + 2] += nz * k * w[a]; v[B] -= nx * k * w[b]; v[B + 1] -= ny * k * w[b]; v[B + 2] -= nz * k * w[b]; }
    for (let i = 0; i < be.length; i += 6) { const m = be[i] * 3, a = be[i + 1] * 3, b = be[i + 2] * 3, fx = be[i + 3], fy = be[i + 4], fz = be[i + 5], vn = (v[m] - (v[a] + v[b]) / 2) * fx + (v[m + 1] - (v[a + 1] + v[b + 1]) / 2) * fy + (v[m + 2] - (v[a + 2] + v[b + 2]) / 2) * fz, wm = w[be[i]], wa = w[be[i + 1]], wb = w[be[i + 2]], k = vn / (wm + 0.25 * wa + 0.25 * wb); v[m] -= fx * k * wm; v[m + 1] -= fy * k * wm; v[m + 2] -= fz * k * wm; v[a] += fx * k * 0.5 * wa; v[a + 1] += fy * k * 0.5 * wa; v[a + 2] += fz * k * 0.5 * wa; v[b] += fx * k * 0.5 * wb; v[b + 1] += fy * k * 0.5 * wb; v[b + 2] += fz * k * 0.5 * wb; }
    // joints lose a little to soft tissue: only their speed against the body as a whole, which cannot slow the body itself
    { const c = this.com(); for (let i = 0; i < N * 3; i += 3) { v[i] -= (v[i] - c.vx) * 0.0008; v[i + 1] -= (v[i + 1] - c.vy) * 0.0008; v[i + 2] -= (v[i + 2] - c.vz) * 0.0008; } }
  }
  keep(a, b, lo, hi, most) {
    const { x, w } = this, A = a * 3, B = b * 3, dx = x[B] - x[A], dy = x[B + 1] - x[A + 1], dz = x[B + 2] - x[A + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    let c = 0; if (l < lo) c = l - lo; else if (l > hi) c = l - hi; else return; if (most) { c = c > most ? most : c < -most ? -most : c; this.stops.push(a, b, dx / l, dy / l, dz / l); }
    const k = c / l / (w[a] + w[b]), wa = k * w[a], wb = k * w[b]; x[A] += dx * wa; x[A + 1] += dy * wa; x[A + 2] += dz * wa; x[B] -= dx * wb; x[B + 1] -= dy * wb; x[B + 2] -= dz * wb;
  }
  // a knee bends forward, an elbow backward: the middle joint may not cross the line between its neighbours the wrong way
  hinge(m, a, b, sign) {
    const { x, w } = this, hl = I.hipL * 3, hr = I.hipR * 3, pv = I.pelvis * 3, ch = I.chest * 3;
    const sd = [x[hr] - x[hl], x[hr + 1] - x[hl + 1], x[hr + 2] - x[hl + 2]], up = [x[ch] - x[pv], x[ch + 1] - x[pv + 1], x[ch + 2] - x[pv + 2]], f = unit(cross(up, sd));
    const M = m * 3, A = a * 3, B = b * 3, d = sign * ((x[M] - (x[A] + x[B]) / 2) * f[0] + (x[M + 1] - (x[A + 1] + x[B + 1]) / 2) * f[1] + (x[M + 2] - (x[A + 2] + x[B + 2]) / 2) * f[2]);
    if (d >= 0) return; this.bends.push(m, a, b, f[0], f[1], f[2]); const c = Math.min(0.012, -d) * sign, k = c / (w[m] + 0.25 * w[a] + 0.25 * w[b]);
    x[M] += f[0] * k * w[m]; x[M + 1] += f[1] * k * w[m]; x[M + 2] += f[2] * k * w[m];
    for (const q of [a, b]) { const Q = q * 3, e = -0.5 * k * w[q]; x[Q] += f[0] * e; x[Q + 1] += f[1] * e; x[Q + 2] += f[2] * e; }
  }
  // the legs and trunk at work, as forces: what they do to the body they do back to the ground through the feet, so only feet on the ground can hold it up
  drive() {
    const { x, v, w } = this, s = this.tone; let onL = this.footOn(0), onR = this.footOn(1);
    if (this.step) { if (this.step.leg === 0) onL = false; else onR = false; }
    const legL = this.limb.legL, legR = this.limb.legR, power = s * ((onL ? legL : 0) + (onR ? legR : 0)) / ((onL ? 1 : 0) + (onR ? 1 : 0) || 1);
    const c = this.com();
    if (power > 0.02) {
      // how high the hips want to be, held by a spring with a real limit: more than twice body weight is more than legs have
      const want = 0.95 * this.k + (this.world.ground || 0), pz = x[I.pelvis * 3 + 2], Fz = Math.min(this.mass * G_ACC * 2.3 * power, Math.max(0, this.mass * (G_ACC + 260 * (want - pz) - 38 * c.vz)));
      // and the feet push the weight back over themselves, as far as the ankles and friction can
      const sup = this.support(), lim = 0.09 * this.mass * G_ACC * power, ax = 18 * (sup.x - c.x) - 7 * c.vx, ay = 18 * (sup.y - c.y) - 7 * c.vy, l = Math.hypot(ax, ay) * this.mass, q = l > lim ? lim / l : 1, Fx = ax * this.mass * q, Fy = ay * this.mass * q;
      for (const i of UPPER.concat([I.pelvis, I.hipL, I.hipR])) { const sh = 1 / w[i] / this.upperM(); v[i * 3] += Fx * sh * w[i] * H; v[i * 3 + 1] += Fy * sh * w[i] * H; }
      // each leg lifts its own side, as far as that leg can: the weight goes to the foot under it, and a ruined leg simply fails, and the body comes down on that side
      const ax0 = x[I.ankL * 3], ay0 = x[I.ankL * 3 + 1], ax1 = x[I.ankR * 3], ay1 = x[I.ankR * 3 + 1], dx = ax1 - ax0, dy = ay1 - ay0, u = Math.max(0, Math.min(1, ((c.x - ax0) * dx + (c.y - ay0) * dy) / (dx * dx + dy * dy || 1e-6)));
      const shareL = onL && onR ? 1 - u : onL ? 1 : 0, shareR = onL && onR ? u : onR ? 1 : 0, FL = Math.min(Fz * shareL, this.mass * G_ACC * 1.8 * s * legL), FR = Math.min(Fz * shareR, this.mass * G_ACC * 1.8 * s * legR);
      for (const [leg, F] of [[0, FL], [1, FR]]) {
        if (F <= 0) continue; const hip = leg ? I.hipR : I.hipL, list = !(onL && onR) || this.step ? LIFT_ALL : leg ? LIFT_R : LIFT_L; let m = 0;   /* (on one foot the weight is over that foot: the push goes through the whole body) */ for (const [i, k] of list) m += k / w[i];
        for (const [i, k] of list) v[i * 3 + 2] += F * (k / w[i]) / m * w[i] * H;
        const [a, t] = FEET[leg]; v[a * 3 + 2] -= F * 0.75 * w[a] * H; v[t * 3 + 2] -= F * 0.25 * w[t] * H; void hip;
      }
    }
    this.muscles(s);
  }
  upperM() { if (this._um) return this._um; let m = 0; for (const i of UPPER.concat([I.pelvis, I.hipL, I.hipR])) m += 1 / this.w[i]; return (this._um = m); }
  footOn(leg) { const [a, t] = FEET[leg], g = (this.world.ground || 0) + 0.012, x = this.x; return x[a * 3 + 2] - this.r[a] < g || x[t * 3 + 2] - this.r[t] < g; }
  support() { let n = 0, a = 0, b = 0; for (let l = 0; l < 2; l++) { if (this.step && this.step.leg === l) continue; if (!this.footOn(l)) continue; const [q, t] = FEET[l]; a += this.x[q * 3] * 0.45 + this.x[t * 3] * 0.55; b += this.x[q * 3 + 1] * 0.45 + this.x[t * 3 + 1] * 0.55; n++; } if (!n) { const c = this.com(); return { x: c.x, y: c.y, n: 0 }; } return { x: a / n, y: b / n, n }; }
  // muscles: pulls toward the pose that cancel out, so they can bend the body but cannot move it
  muscles(s) {
    const { x, v, w } = this; if (s <= 0.01) return; const f = this.frame(), yawF = unit([f.fwd[0], f.fwd[1], 0]), side = [yawF[1], -yawF[0], 0], P = f.p;
    let mx = 0, my = 0, mz = 0, m = 0, list = [];
    for (const i of UPPER) {
      const n = JOINTS[i][0], limb = LIMB_OF[n], tone = s * (limb ? this.limb[limb] : 1), R = this.rest, a = R[i * 3] - R[0], b = R[i * 3 + 1] - R[1], c = R[i * 3 + 2] - R[2];
      // (keeps its stance upright, with the frame the feet give it)
      const tx = P[0] + side[0] * a + yawF[0] * b, ty = P[1] + side[1] * a + yawF[1] * b, tz = P[2] + c, K = 90 * tone, D = 2 * Math.sqrt(K) * 0.9, q = 1 / w[i];
      let ax = K * (tx - x[i * 3]) - D * (v[i * 3] - v[0]), ay = K * (ty - x[i * 3 + 1]) - D * (v[i * 3 + 1] - v[1]), az = K * (tz - x[i * 3 + 2]) - D * (v[i * 3 + 2] - v[2]);
      list.push([i, ax, ay, az]); mx += ax * q; my += ay * q; mz += az * q; m += q;
    }
    mx /= m; my /= m; mz /= m; for (const [i, ax, ay, az] of list) { v[i * 3] += (ax - mx) * H; v[i * 3 + 1] += (ay - my) * H; v[i * 3 + 2] += (az - mz) * H; }
    if (this.step) this.swing();
  }
  // what a limb's muscles push on: the same momentum, the other way, into the trunk
  react(P) { const m = this.trunkM(), { v } = this; for (const n of TRUNK) { const i = I[n]; v[i * 3] -= P[0] / m; v[i * 3 + 1] -= P[1] / m; v[i * 3 + 2] -= P[2] / m; } }
  trunkM() { if (this._tm) return this._tm; let m = 0; for (const n of TRUNK) m += 1 / this.w[I[n]]; return (this._tm = m); }
  // a step: the free foot goes through the air to the place that will catch the body
  swing() {
    const st = this.step, [a, t] = FEET[st.leg], k = Math.min(1, st.t / st.T), lift = Math.sin(k * Math.PI) * 0.09, gx = st.fx + (st.x - st.fx) * k, gy = st.fy + (st.y - st.fy) * k, { x, v } = this, g = (this.world.ground || 0), f = this.frame(), F = unit([f.fwd[0], f.fwd[1], 0]);
    const c = this.com(), P = [0, 0, 0], put = (i, X, Y, Z) => { const K = 900, D = 60, ax = (K * (X - x[i * 3]) - D * (v[i * 3] - c.vx)) * H, ay = (K * (Y - x[i * 3 + 1]) - D * (v[i * 3 + 1] - c.vy)) * H, az = (K * (Z - x[i * 3 + 2]) - D * (v[i * 3 + 2] - c.vz) + G_ACC) * H, m = 1 / this.w[i]; v[i * 3] += ax; v[i * 3 + 1] += ay; v[i * 3 + 2] += az; P[0] += ax * m; P[1] += ay * m; P[2] += az * m; };
    put(a, gx - F[0] * 0.06, gy - F[1] * 0.06, g + 0.08 + lift); put(t, gx + F[0] * 0.11, gy + F[1] * 0.11, g + 0.04 + lift); this.react(P);
  }
  // Getting up is guided: from however the body landed, through a crouch over the feet, to standing. It is animation that the bones and the
  // ground still act on, and any blow hands it straight back to the physics. Over the body's own feet, facing along them.
  guide() {
    const T = GETUP * this.k ** 0, q = Math.min(1, this.upT / T), a = q < 0.55 ? q / 0.55 : 1, b = q < 0.55 ? 0 : (q - 0.55) / 0.45, ea = a * a * (3 - 2 * a), eb = b * b * (3 - 2 * b), F = this.upF, sd = [F[1], -F[0]], A = this.anchor, g = this.world.ground || 0, { x, v, rest: R, k } = this;
    for (let i = 0; i < N; i++) {
      const C = CROUCH[i], s0 = C[0] * k, f0 = C[1] * k, z0 = C[2] * k, s1 = R[i * 3], f1 = R[i * 3 + 1], z1 = R[i * 3 + 2], cx = A[0] + sd[0] * s0 + F[0] * f0, cy = A[1] + sd[1] * s0 + F[1] * f0, cz = g + z0;
      let tx = this.from[i * 3] + (cx - this.from[i * 3]) * ea, ty = this.from[i * 3 + 1] + (cy - this.from[i * 3 + 1]) * ea, tz = this.from[i * 3 + 2] + (cz - this.from[i * 3 + 2]) * ea;
      if (eb > 0) { tx = cx + (A[0] + sd[0] * s1 + F[0] * f1 - cx) * eb; ty = cy + (A[1] + sd[1] * s1 + F[1] * f1 - cy) * eb; tz = cz + (g + z1 - cz) * eb; }
      // (it gets there by moving, at a speed a person has, so the bones stay in charge; gravity is carried by the guide)
      const lim = 3.2, vx = (tx - x[i * 3]) * 18, vy = (ty - x[i * 3 + 1]) * 18, vz = (tz - x[i * 3 + 2]) * 18, l = Math.hypot(vx, vy, vz), s = l > lim ? lim / l : 1; v[i * 3] = vx * s; v[i * 3 + 1] = vy * s; v[i * 3 + 2] = vz * s + G_ACC * H;
    }
  }
  // once a frame: what state is it in, and does it need a step
  control(dt) {
    if (this.stun > 0) { this.stun -= dt; this.tone = Math.min(this.tone, Math.max(0, 1 - this.stun * 1.6)); } else this.tone = Math.min(1, this.tone + dt * 0.45);
    for (const k in this.limb) { const cap = this.woundL && this.woundL[k] != null ? this.woundL[k] : 1; this.limb[k] = Math.min(cap, this.limb[k] + dt * 0.25); }
    const c = this.com(), up = this.upright(), pz = this.x[I.pelvis * 3 + 2] - (this.world.ground || 0);
    if (this.state === 'stand') {
      this.gripped = this.footOn(0) || this.footOn(1);
      const sup = this.support(), om = Math.sqrt(G_ACC / Math.max(0.3, c.z)), cx = c.x + c.vx / om, cy = c.y + c.vy / om, off = Math.hypot(cx - sup.x, cy - sup.y), legs = this.limb.legL + this.limb.legR;
      if (this.step) {
        const st = this.step; st.t += dt;
        // the step aims at where the body will be when the foot lands
        const left = Math.max(0, st.T - st.t), tx = c.x + c.vx * left + (c.vx / om) * 0.8, ty = c.y + c.vy * left + (c.vy / om) * 0.8, R = 0.72 * this.k, o = this.at('pelvis'), dx = tx - o[0], dy = ty - o[1], d = Math.hypot(dx, dy), q = d > R ? R / d : 1; st.x = o[0] + dx * q; st.y = o[1] + dy * q;
        if (st.t >= st.T) { this.step = null; this.steps++; this.lastStep = this.time; }
      } else if (off > 0.13 * this.k && this.time - (this.lastStep || -9) > 0.02 && this.steps < 6 && legs > 0.3 && this.tone > 0.3) {
        // the foot further from where the body is going takes the step; a bad leg steps badly, or not at all
        const dist = (l) => { const [a] = FEET[l]; return Math.hypot(this.x[a * 3] - cx, this.x[a * 3 + 1] - cy); }; let leg = dist(0) > dist(1) ? 0 : 1; if (this.limb[leg ? 'legR' : 'legL'] < 0.3) leg = 1 - leg;
        if (this.footOn(1 - leg)) { const [a] = FEET[leg]; this.step = { leg, t: 0, T: 0.2, fx: this.x[a * 3], fy: this.x[a * 3 + 1], x: cx, y: cy }; }
      }
      if (off < 0.05 && Math.hypot(c.vx, c.vy) < 0.1 && !this.step) this.steps = 0;
      // gone: too far over, knees given out, or nothing left to step with
      if (up < 0.62 || pz < 0.52 * this.k || this.tone < 0.22 || (off > 0.55 * this.k && !this.step) || (!this.gripped && c.vz < -1.5)) { this.state = 'fall'; this.step = null; this.settled = 0; }
    } else if (this.state === 'fall') {
      // on the ground and still (or nearly): down
      const e = this.energy() / this.mass, low = c.z < 0.45 * this.k; this.settled = e < 0.04 && low ? this.settled + dt : 0;
      if (this.settled > 0.5) { this.state = 'down'; this.downT = 0; }
    } else if (this.state === 'down') {
      this.downT += dt; const can = Math.min(this.limb.legL, this.limb.legR) > 0.3 && this.stun <= 0 && this.tone > 0.5;
      if (this.downT > (this.waitDown == null ? 1 : this.waitDown) && can && !this.stayDown) { this.state = 'getup'; this.upT = 0; const a = this.at('ankL'), b = this.at('ankR'), p = this.at('pelvis'), d = [(a[0] + b[0]) / 2 - p[0], (a[1] + b[1]) / 2 - p[1], 0]; this.upF = Math.hypot(d[0], d[1]) > 0.05 ? unit(d) : [0, 1, 0]; this.anchor = [p[0] + this.upF[0] * 0.25, p[1] + this.upF[1] * 0.25]; this.from = this.x.slice(); }
    } else if (this.state === 'getup') {
            this.upT += dt; if (this.upT >= GETUP) { this.state = 'stand'; this.steps = 0; this.yaw = Math.atan2(-this.upF[0], this.upF[1]); }
    }
  }
  // what is left of the joints: how far every rod is from its length, the worst (0.01 is 1 %)
  strain() { let e = 0; for (const [a, b, l] of this.rods) { const q = Math.hypot(this.x[a * 3] - this.x[b * 3], this.x[a * 3 + 1] - this.x[b * 3 + 1], this.x[a * 3 + 2] - this.x[b * 3 + 2]); e = Math.max(e, Math.abs(q - l) / l); } return e; }
  // the lowest any joint gets, and whether all of it is real numbers
  sane() { for (let i = 0; i < N * 3; i++) if (!Number.isFinite(this.x[i]) || Math.abs(this.x[i]) > 1e5) return false; return true; }
}
Body3.I = I; Body3.N = N; Body3.JOINTS = JOINTS; Body3.HZ = HZ; Body3.SUB = SUB;
G.Body3 = Body3;
})();
