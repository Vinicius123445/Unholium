'use strict';
// Animals that move like animals: new sheets with a 6-frame walk, a 4-frame run (a gallop for deer and
// wolves, a hop for rabbits), breathing when they stand, grazing (head down, chewing) for the grass
// eaters, a head-up "alert" when something comes close, and smooth turns. The body comes from the procedural
// drawing in assets.js; the legs are redrawn per frame with a real gait (diagonal pairs for four-legged walks).
(() => {
const A = G.assets;
// per kind: where the legs start, their x positions and widths, color, the head's width (it faces left)
const RIG = {
  rabbit: { top: 8, len: 2, legs: [[4, 1], [9, 2]], col: 0.8, head: 5, hop: true, graze: true },
  chicken: { top: 9, len: 2, legs: [[3, 1], [6, 1]], col: '#e8a030', head: 4, biped: true, graze: true },
  deer: { top: 14, len: 6, legs: [[7, 1], [9, 1], [15, 1], [17, 1]], col: 0.7, head: 8, graze: true },
  wolf: { top: 10, len: 4, legs: [[6, 1], [8, 1], [13, 1], [15, 1]], col: 0.7, head: 7 },
  boar: { top: 10, len: 3, legs: [[5, 2], [13, 2]], col: 0.7, head: 6, graze: true },
  bear: { top: 14, len: 6, legs: [[6, 3], [17, 3]], col: 0.7, head: 9 },
  cow: { top: 12, len: 6, legs: [[7, 2], [18, 2]], col: '#8a8780', head: 7, graze: true },
};
const COLS = { idle: 0, walk: 2, run: 8, graze: 12, alert: 14 }, N = 15;
const cache = {};

function frameCanvas(kind, color, opt, base, rig, mode, f) {
  const d = { w: base.fw, h: base.fh };
  const c = document.createElement('canvas'); c.width = d.w; c.height = d.h + 2;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  // the body without its legs (row 0 of the classic sheet: facing left, frame 0)
  const b = document.createElement('canvas'); b.width = d.w; b.height = d.h;
  const bx = b.getContext('2d'); bx.drawImage(base.img, 0, 0, d.w, d.h, 0, 0, d.w, d.h);
  bx.clearRect(0, rig.top + 1, d.w, d.h);   // (the outline under the belly stays)
  let bob = 0, headDy = 0;
  if (mode === 'idle') bob = f;   // breathing
  if (mode === 'walk') bob = f % 3 === 0 ? 1 : 0;
  if (mode === 'run') bob = rig.hop ? [0, -2, -3, -1][f] : [0, -1, 0, 1][f];
  if (mode === 'graze') headDy = 3 + (f ? 1 : 0);
  if (mode === 'alert') headDy = -1;
  // legs: a gait. Four legs: diagonal pairs swing together; two legs: alternate; rabbits hop with both
  const legCol = typeof rig.col === 'string' ? rig.col : A.shade(color, rig.col);
  const phase = mode === 'walk' ? f / 6 : mode === 'run' ? f / 4 : 0;
  rig.legs.forEach(([lx, lw], i) => {
    const pairs = rig.legs.length === 4 ? [0, 0.5, 0.5, 0][i] : rig.biped ? i * 0.5 : (rig.hop ? 0 : i * 0.5);
    const p = (phase + pairs) * Math.PI * 2, amp = mode === 'run' ? 2.5 : mode === 'walk' ? 1.5 : 0;
    const swing = Math.sin(p) * amp, lift = mode === 'run' || mode === 'walk' ? Math.max(0, Math.cos(p)) * (mode === 'run' ? 2 : 1) : 0;
    const top = rig.top + 1 + bob, len = rig.len - Math.round(lift);
    for (let k = 0; k < len; k++) { const t = k / Math.max(1, len - 1); x.fillStyle = legCol; x.fillRect(Math.round(lx + swing * t), top + k, lw, 1); }
    x.fillStyle = A.shade(legCol, 0.7); x.fillRect(Math.round(lx + swing), top + len - 1, lw, 1);   // hoof / paw
  });
  // the body on top, and the head moved for grazing / alert
  const hw = rig.head;
  x.drawImage(b, hw, 0, d.w - hw, d.h, hw, bob, d.w - hw, d.h);
  x.drawImage(b, 0, 0, hw, d.h, 0, bob + headDy, hw, d.h);
  if (mode === 'graze' && f) { x.fillStyle = '#4a8a38'; x.fillRect(0, rig.top + headDy - 1, 2, 1); }   // a mouthful of grass
  return c;
}

function sheet2(kind, color, opt) {
  const key = kind + color + JSON.stringify(opt);
  if (cache[key]) return cache[key];
  const base = A.animal(kind, color, opt), rig = RIG[kind];
  if (!rig) return null;
  const fw = base.fw, fh = base.fh + 2;
  const c = document.createElement('canvas'); c.width = fw * N; c.height = fh * 2;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const plan = [['idle', 0], ['idle', 1], ...[0, 1, 2, 3, 4, 5].map((f) => ['walk', f]), ...[0, 1, 2, 3].map((f) => ['run', f]), ['graze', 0], ['graze', 1], ['alert', 0]];
  plan.forEach(([mode, f], col) => {
    const fc = frameCanvas(kind, color, opt, base, rig, mode, f);
    x.drawImage(fc, col * fw, 0);
    x.save(); x.translate(col * fw + fw, fh); x.scale(-1, 1); x.drawImage(fc, 0, 0); x.restore();   // row 1: facing right
  });
  return (cache[key] = { img: c, fw, fh, animal: true, animal2: true, kind, base });
}

G.animals2 = { sheet: sheet2, RIG };
const AN = G.Animal.prototype, _draw = AN.draw, _frame = AN.frame;
AN.draw = function (ctx) {
  if (this.dead || !this.sheet) return _draw.call(this, ctx);
  const s2 = this._sheet2 || (this._sheet2 = sheet2(this.species, this.def.color, this.sheet === undefined ? {} : this.antlerOpt || {}));
  if (!s2) return _draw.call(this, ctx);
  const st = this._a2 || (this._a2 = { phase: 0, lx: this.x, ly: this.y, t: Math.random() * 5, grazeT: 0, face: this.facingRight ? 1 : 0, turnT: 0 });
  const dt = Math.min(0.1, G.loop.time - (st.last || G.loop.time)); st.last = G.loop.time;
  const moved = Math.hypot(this.x - st.lx, this.y - st.ly); st.lx = this.x; st.ly = this.y;
  const fast = this.state === 'flee' || this.state === 'attack' || this.state === 'hunt' || moved / Math.max(dt, 0.001) > 45;
  if (this.moving && moved > 0.01) st.phase = (st.phase + moved / (fast ? 22 : 12)) % 1;
  st.t += dt;
  // grass eaters graze when they stand around; anyone looks up when you come close
  const rig = RIG[this.species] || {};
  const p = G.player, near = p && Math.hypot(p.x - this.x, p.y - this.y) < 60;
  if (!this.moving && rig.graze && !near) { if ((st.grazeT -= dt) <= -6) st.grazeT = 4 + Math.random() * 6; } else st.grazeT = 0;
  // turning: a quick squash instead of an instant flip
  const face = this.facingRight ? 1 : 0;
  if (face !== st.face) { st.face = face; st.turnT = 0.1; }
  if (st.turnT > 0) st.turnT -= dt;
  let col;
  if (this.moving) col = fast ? COLS.run + Math.floor(st.phase * 4) % 4 : COLS.walk + Math.floor(st.phase * 6) % 6;
  else if (near) col = COLS.alert;
  else if (st.grazeT > 0) col = COLS.graze + (Math.floor(st.t * 2.5) % 2);
  else col = COLS.idle + (Math.floor(st.t * 0.8) % 2);
  this.drawShadow ? this.drawShadow(ctx) : null;
  const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0;
  const img = flash ? A.white(s2.img) : s2.img;
  ctx.save();
  ctx.translate(Math.round(this.x), Math.round(this.y + 1));
  if (this.young) ctx.scale(0.65, 0.65);   // the young are small
  if (st.turnT > 0) ctx.scale(Math.max(0.3, 1 - st.turnT * 7), 1);
  ctx.drawImage(img, col * s2.fw, face * s2.fh, s2.fw, s2.fh, -s2.fw / 2, -s2.fh, s2.fw, s2.fh);
  ctx.restore();
};
// keep the deer's antlers when building the new sheet
const _ctorSheet = A.animal;
A.animal = function (kind, color, opt = {}) { const s = _ctorSheet.call(this, kind, color, opt); s.opt = opt; return s; };
const _aDraw = AN.draw;
AN.draw = function (ctx) { if (!this.antlerOpt && this.sheet && this.sheet.opt) this.antlerOpt = this.sheet.opt; return _aDraw.call(this, ctx); };
void _frame;
})();
