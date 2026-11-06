'use strict';
// Things to do with your hands. Each game is its own scene with its own rules, and each one really plays:
//   pool (ball physics, potting, turns against a local), bowling (aim, power, pins that knock each other over, frames),
//   darts (a shaky hand, a real board, five rounds), table football, chess (all the rules), basketball (a shooting
//   meter, ten shots), three arcade cabinets, karaoke (hit the notes),
//   an instrument you can play by key, gym machines that train you.
//   Also here: books, exhibits, props, tattoos, haircuts.
// Stakes are real money. Rivals are whoever is around, or a stranger with a stake: their money moves too.
(() => {
const U = G.ui, GS = G.GameScene.prototype, clamp = G.util.clamp, pick = (a) => G.rng.pick(a), S0 = G.venueSys, TAU = Math.PI * 2;
const I = () => G.input;
const hit = () => I().pressed.has('Space') || I().pressed.has('Enter') || I().wasPressed('interact') || (I().mouse.pressed);
class Mini {
  constructor(game, title, W = 460, H = 300) { this.game = game; this.title = title; this.W = W; this.H = H; this.t = 0; this.done = false; this.msg = ''; if (Mini.VS.has(this.constructor.name)) { let d = 150; for (const a of game.actors) { if (a.kind !== 'npc' || a.dead || a.talking || a.def.venue || a.def.kid || a.state !== 'schedule' || (a.st.gold || 0) < 10) continue; const q = a.distTo(game.player); if (q < d) { d = q; this.rival = a; } } } }
  get p() { return this.game.player; }
  box() { const R = G.renderer, W = Math.min(this.W, R.uiW - 12), H = Math.min(this.H, R.uiH - 12); return { x: (R.uiW - W) / 2, y: (R.uiH - H) / 2, W, H }; }
  frame(ctx) { const b = this.box(); G.renderer.uiTransform(); ctx.fillStyle = '#0a0a0e'; ctx.fillRect(0, 0, G.renderer.uiW, G.renderer.uiH); U.panel(ctx, b.x, b.y, b.W, b.H, { title: this.rival ? `${this.title}: ${this.rival.displayName}` : this.title, titleSize: 12 }); return b; }
  close() { G.scenes.remove(this); }
  common(dt) { this.t += dt; if (I().wasPressed('cancel')) { G.audio.play('back'); this.close(); return true; } if (this.done && (this.endT = (this.endT || 0) + dt) > 0.5 && hit()) { this.close(); return true; } return false; }
  // the stake moves between you and the person across the table; with nobody there, the house covers it
  finish(msg, money = 0) {
    this.done = true; this.msg = msg; if (!money) return;
    const w = this.game.world, F_ = G.finance, r = this.rival, p = this.p;
    if (money > 0) { const fromR = r ? Math.min(money, r.st.gold || 0) : 0; if (r) { r.st.gold -= fromR; p.gold += fromR; r.say(pick(['Double or nothing?', 'Lucky.', 'Good game.']), 3); } if (money > fromR) F_.pay(w, 'pool', p, money - fromR); G.audio.play('coin'); if (r) G.giveCash(this.game, r, p); }
    else { const n = Math.min(-money, p.gold); p.gold -= n; if (r) { r.st.gold = (r.st.gold || 0) + n; r.say(pick(['Thanks for the game.', 'Pay up.', 'Too easy.']), 3); G.giveCash(this.game, p, r); } else F_.pay(w, { gold: n }, 'pool', n); }
  }
  stake(n) { if (this.p.gold < n) return false; this.staked = n; return true; }
  mx() { const b = this.box(); return I().mouse.ux - b.x; } my() { const b = this.box(); return I().mouse.uy - b.y; }
}
Mini.VS = new Set(['PoolScene', 'BowlingScene', 'DartsScene', 'FoosScene', 'ChessScene', 'HoopScene']);
// ---------------------------------------------------------------- pool
class PoolScene extends Mini {
  constructor(g, stake = 10) { super(g, 'Pool', 520, 330); this.stakeN = stake; this.balls = []; this.w = 420; this.h = 210; const add = (x, y, c, n) => this.balls.push({ x, y, vx: 0, vy: 0, c, n, in: false }); add(100, 105, '#f4f4ee', 0); const cs = ['#d8b020', '#2040a0', '#c02020', '#6a2a8a', '#d86a20', '#208040', '#7a2020', '#141418', '#d8b020', '#2040a0']; let k = 0; for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) add(280 + r * 11.5, 105 + (i - r / 2) * 13, cs[k], ++k); this.aim = 0; this.pow = 0; this.turn = 0; this.score = [0, 0]; this.pockets = [[0, 0], [210, -3], [420, 0], [0, 210], [210, 213], [420, 210]]; this.moving = false; this.foeT = 1.2; }
  shoot(a, p) { const c = this.balls[0]; c.vx = Math.cos(a) * p; c.vy = Math.sin(a) * p; this.moving = true; this.pottedNow = 0; G.audio.tone(900, 0.03, { type: 'square', vol: 0.15 }); }
  step(dt) {
    const B = this.balls.filter((q) => !q.in); let any = false;
    for (const q of B) { q.x += q.vx * dt; q.y += q.vy * dt; const fr = Math.exp(-0.9 * dt); q.vx *= fr; q.vy *= fr; const s = Math.hypot(q.vx, q.vy); if (s < 5) q.vx = q.vy = 0; else any = true;
      if (q.x < 6) { q.x = 6; q.vx = Math.abs(q.vx) * 0.85; } if (q.x > this.w - 6) { q.x = this.w - 6; q.vx = -Math.abs(q.vx) * 0.85; } if (q.y < 6) { q.y = 6; q.vy = Math.abs(q.vy) * 0.85; } if (q.y > this.h - 6) { q.y = this.h - 6; q.vy = -Math.abs(q.vy) * 0.85; }
      for (const [px, py] of this.pockets) if (Math.hypot(q.x - px, q.y - py) < 12) { q.in = true; q.vx = q.vy = 0; G.audio.tone(200, 0.1, { type: 'sine', vol: 0.2 }); if (q.n) { this.score[this.turn]++; this.pottedNow++; } else { this.scratch = true; } } }
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], b = B[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d > 0 && d < 12) { const nx = dx / d, ny = dy / d, over = (12 - d) / 2; a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over; const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel > 0) { a.vx -= rel * nx * 0.96; a.vy -= rel * ny * 0.96; b.vx += rel * nx * 0.96; b.vy += rel * ny * 0.96; if (rel > 30) G.audio.tone(1200, 0.02, { type: 'square', vol: Math.min(0.15, rel / 900) }); } } }
    return any;
  }
  foeShot() { const c = this.balls[0]; let best = null; for (const q of this.balls) { if (q.in || !q.n) continue; for (const [px, py] of this.pockets) { const a = Math.atan2(py - q.y, px - q.x), gx = q.x - Math.cos(a) * 12, gy = q.y - Math.sin(a) * 12, d = Math.hypot(gx - c.x, gy - c.y) + Math.hypot(px - q.x, py - q.y); if (!best || d < best.d) best = { d, a: Math.atan2(gy - c.y, gx - c.x) }; } } if (best) this.shoot(best.a + (Math.random() - 0.5) * 0.16, 330 + Math.random() * 130); }
  update(dt) {
    if (this.common(dt) || this.done) return;
    for (let i = 0; i < 4; i++) this.moving = this.step(dt / 4) || false;
    if (this.moving) { this.wasMoving = true; return; }
    if (this.wasMoving) { this.wasMoving = false; if (this.scratch) { const c = this.balls[0]; c.in = false; c.x = 100; c.y = 105; this.scratch = false; this.pottedNow = 0; } if (!this.pottedNow) this.turn = 1 - this.turn; this.foeT = 1 + Math.random(); const left = this.balls.filter((q) => q.n && !q.in).length; if (!left) { const w = this.score[0] > this.score[1]; this.finish(w ? `You win, ${this.score[0]} to ${this.score[1]}. +$${this.stakeN}` : `You lose, ${this.score[0]} to ${this.score[1]}.`, w ? this.stakeN : -this.stakeN); return; } }
    if (this.turn === 1) { if ((this.foeT -= dt) <= 0) this.foeShot(); return; }
    const b = this.box(), ox = (b.W - this.w) / 2, oy = 44, c = this.balls[0], m = I().mouse;
    if (m.moved !== false) this.aim = Math.atan2(this.my() - oy - c.y, this.mx() - ox - c.x);
    if (I().pressed.has('ArrowLeft')) this.aim -= 0.03; if (I().pressed.has('ArrowRight')) this.aim += 0.03;
    if (m.down) this.pow = Math.min(1, this.pow + dt * 0.9); else if (this.pow > 0) { this.shoot(this.aim, 120 + this.pow * 560); this.pow = 0; }
  }
  render(ctx) {
    const b = this.frame(ctx), ox = b.x + (b.W - this.w) / 2, oy = b.y + 44;
    ctx.fillStyle = '#4a2e1a'; ctx.fillRect(ox - 14, oy - 14, this.w + 28, this.h + 28); ctx.fillStyle = '#1e8050'; ctx.fillRect(ox, oy, this.w, this.h);
    ctx.fillStyle = '#0a0a0c'; for (const [px, py] of this.pockets) { ctx.beginPath(); ctx.arc(ox + px, oy + py, 10, 0, TAU); ctx.fill(); }
    for (const q of this.balls) { if (q.in) continue; ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(ox + q.x, oy + q.y, 6, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(ox + q.x - 2, oy + q.y - 3, 2, 2); }
    const c = this.balls[0];
    if (!this.moving && this.turn === 0 && !this.done) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ox + c.x, oy + c.y); ctx.lineTo(ox + c.x + Math.cos(this.aim) * 140, oy + c.y + Math.sin(this.aim) * 140); ctx.stroke(); ctx.setLineDash([]); const back = 14 + this.pow * 40; ctx.strokeStyle = '#d8c090'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox + c.x - Math.cos(this.aim) * back, oy + c.y - Math.sin(this.aim) * back); ctx.lineTo(ox + c.x - Math.cos(this.aim) * (back + 90), oy + c.y - Math.sin(this.aim) * (back + 90)); ctx.stroke(); ctx.lineWidth = 1; }
    U.text(ctx, `You ${this.score[0]}   -   ${this.score[1]} Rival   ·   Stake $${this.stakeN}`, b.x + 14, b.y + 26, { size: 9 });
    U.text(ctx, this.done ? this.msg : this.turn === 0 ? 'Your shot' : 'Their shot', b.x + b.W - 14, b.y + 26, { size: 9, align: 'right', color: '#f0c040' });
  }
}
// ---------------------------------------------------------------- bowling
const PINS = [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]];
class BowlingScene extends Mini {
  constructor(g) { super(g, 'Bowling', 340, 400); this.frameN = 0; this.roll = 0; this.scores = []; this.rack(); this.phase = 'aim'; this.x = 0; this.pow = 0; this.ai = []; for (let i = 0; i < 5; i++) this.ai.push(4 + Math.floor(Math.random() * 7)); }
  rack() { this.pins = PINS.map(([a, b]) => ({ x: a * 11, y: b * 10, up: true, vx: 0, vy: 0 })); }
  update(dt) {
    if (this.common(dt) || this.done) return;
    if (this.phase === 'aim') { this.x = Math.sin(this.t * 2.4) * 42; if (hit()) { this.phase = 'power'; this.xs = this.x; this.t = 0; } }
    else if (this.phase === 'power') { this.pow = Math.abs(Math.sin(this.t * 2.8)); if (hit()) { this.phase = 'roll'; this.ball = { x: this.xs, y: 260, v: 200 + this.pow * 260, s: (this.pow - 0.75) * 40 }; this.wait = 0; G.audio.noise(0.9, { vol: 0.1, freq: 300 }); } }
    else if (this.phase === 'roll') {
      const q = this.ball; q.y -= q.v * dt; q.x += q.s * dt;
      for (const n of this.pins) { if (n.up && Math.hypot(n.x - q.x, n.y - q.y) < 11) { n.up = false; n.vx = (n.x - q.x) * 8 + (Math.random() - 0.5) * 40; n.vy = -q.v * 0.7; G.audio.tone(320, 0.05, { type: 'square', vol: 0.15 }); } }
      for (const a of this.pins) if (!a.up && (a.vx || a.vy)) { a.x += a.vx * dt; a.y += a.vy * dt; a.vx *= 0.97; a.vy *= 0.97; for (const b of this.pins) if (b.up && Math.hypot(a.x - b.x, a.y - b.y) < 8) { b.up = false; b.vx = a.vx * 0.8 + (b.x - a.x) * 6; b.vy = a.vy * 0.8; } }
      if (q.y < -40) { if ((this.wait += dt) > 0.9) this.endRoll(); }
    }
  }
  endRoll() {
    const down = this.pins.filter((n) => !n.up).length;
    if (this.roll === 0) { this.first = down; if (down === 10) { this.scores.push(15); this.next(); } else { this.roll = 1; this.pins = this.pins.filter((n) => n.up).map((n) => ({ ...n, vx: 0, vy: 0 })); this.phase = 'aim'; this.t = 0; } }
    else { const tot = this.first + down; this.scores.push(tot === 10 ? 12 : tot); this.next(); }
  }
  next() { this.frameN++; this.roll = 0; this.rack(); this.phase = 'aim'; this.t = 0; if (this.frameN >= 5) { const a = this.scores.reduce((s, n) => s + n, 0), c = this.ai.reduce((s, n) => s + n, 0), win = a > c; this.finish(`You ${a}, rival ${c}. ${win ? 'You win $10.' : 'You lose.'}`, win ? 10 : -10); } }
  render(ctx) {
    const b = this.frame(ctx), cx = b.x + b.W / 2, oy = b.y + 66;
    ctx.fillStyle = '#c8a060'; ctx.fillRect(cx - 62, oy - 30, 124, 310); ctx.fillStyle = '#2a2a30'; ctx.fillRect(cx - 74, oy - 30, 12, 310); ctx.fillRect(cx + 62, oy - 30, 12, 310); for (let i = -54; i < 60; i += 12) { ctx.fillStyle = 'rgba(120,80,40,0.25)'; ctx.fillRect(cx + i, oy - 30, 1, 310); }
    for (const n of this.pins) { ctx.fillStyle = n.up ? '#f4f4ee' : 'rgba(220,220,210,0.5)'; ctx.beginPath(); ctx.arc(cx + n.x, oy + n.y, 4, 0, TAU); ctx.fill(); if (n.up) { ctx.fillStyle = '#c02020'; ctx.fillRect(cx + n.x - 3, oy + n.y - 1, 6, 1); } }
    const q = this.ball, bx = this.phase === 'roll' ? q.x : this.phase === 'power' ? this.xs : this.x, by = this.phase === 'roll' ? q.y : 260;
    ctx.fillStyle = '#2040a0'; ctx.beginPath(); ctx.arc(cx + bx, oy + by, 7, 0, TAU); ctx.fill();
    U.text(ctx, `Frame ${Math.min(5, this.frameN + 1)}/5   Roll ${this.roll + 1}   Score ${this.scores.reduce((s, n) => s + n, 0)}`, b.x + 14, b.y + 26, { size: 9 });
    if (this.phase === 'power') { U.bar(ctx, cx - 70, b.y + b.H - 16, 140, 8, this.pow, '#f0c040'); }
    if (this.done) U.text(ctx, this.msg, cx, b.y + 42, { size: 10, align: 'center', color: '#f0c040', weight: 'bold' });
  }
}
// ---------------------------------------------------------------- darts
const SECT = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
class DartsScene extends Mini {
  constructor(g) { super(g, 'Darts', 400, 330); this.throws = []; this.score = 0; this.foeN = 0; this.round = 0; this.dart = 0; this.r = 120; }
  value(dx, dy) { const d = Math.hypot(dx, dy) / this.r; if (d > 1) return 0; if (d < 0.04) return 50; if (d < 0.1) return 25; const a = (Math.atan2(dx, -dy) + TAU + Math.PI / 20) % TAU, n = SECT[Math.floor(a / (TAU / 20))]; if (d > 0.93) return n * 2; if (d > 0.55 && d < 0.63) return n * 3; return n; }
  update(dt) {
    if (this.common(dt) || this.done) return;
    this.ax = this.mx() - this.box().W / 2 + Math.sin(this.t * 2.3) * 12 + Math.sin(this.t * 3.7) * 8; this.ay = this.my() - 175 + Math.cos(this.t * 2.9) * 12;
    if (I().mouse.pressed || I().pressed.has('Space')) {
      this.throws.push([this.ax, this.ay]); this.score += this.value(this.ax, this.ay); this.dart++; G.audio.tone(800, 0.03, { type: 'square', vol: 0.15 });
      if (this.dart >= 3) { this.dart = 0; this.round++; this.foeN += 20 + Math.floor(Math.random() * 60); this.throws = []; if (this.round >= 5) { const w = this.score > this.foeN; this.finish(`You ${this.score}, rival ${this.foeN}. ${w ? 'You win $10.' : 'You lose.'}`, w ? 10 : -10); } }
    }
  }
  render(ctx) {
    const b = this.frame(ctx), cx = b.x + b.W / 2, cy = b.y + 175, r = this.r;
    const ring = (rr, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill(); };
    ring(r + 16, '#141416');
    for (let i = 0; i < 20; i++) { const a0 = -Math.PI / 2 - Math.PI / 20 + i * TAU / 20, a1 = a0 + TAU / 20, seg = (r0, r1, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r1, a0, a1); ctx.arc(cx, cy, r0, a1, a0, true); ctx.fill(); }, odd = i % 2; seg(r * 0.93, r, odd ? '#208040' : '#c02020'); seg(r * 0.63, r * 0.93, odd ? '#e8dcb8' : '#141416'); seg(r * 0.55, r * 0.63, odd ? '#208040' : '#c02020'); seg(r * 0.1, r * 0.55, odd ? '#e8dcb8' : '#141416'); U.text(ctx, String(SECT[i]), cx + Math.cos(a0 + TAU / 40) * (r + 9), cy + Math.sin(a0 + TAU / 40) * (r + 9) - 4, { size: 7, align: 'center', color: '#e8e4d0' }); }
    ring(r * 0.1, '#208040'); ring(r * 0.04, '#c02020');
    ctx.fillStyle = '#f0f0f0'; for (const [x, y] of this.throws) ctx.fillRect(cx + x - 1, cy + y - 1, 3, 3);
    if (!this.done && this.ax != null) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + this.ax, cy + this.ay, 5, 0, TAU); ctx.stroke(); }
    U.text(ctx, this.done ? this.msg : `Round ${this.round + 1}/5   Dart ${this.dart + 1}/3   You ${this.score}   Rival ${this.foeN}`, b.x + 14, b.y + 26, { size: 9, color: this.done ? '#f0c040' : U.colors.text });
  }
}
// ---------------------------------------------------------------- table football
class FoosScene extends Mini {
  constructor(g) { super(g, 'Table Football', 460, 280); this.a = 100; this.c = 100; this.s = [0, 0]; this.kick(1); }
  kick(d) { this.b = { x: 200, y: 100, vx: 130 * d, vy: (Math.random() - 0.5) * 120 }; }
  update(dt) {
    if (this.common(dt) || this.done) return;
    const H = 200, W = 400, b = this.b;
    this.a = clamp(this.my() - 44, 20, H - 20); if (I().wasPressed('up')) this.a -= 24; if (I().wasPressed('down')) this.a += 24;
    this.c += clamp(b.y - this.c, -120 * dt, 120 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < 5 || b.y > H - 5) { b.vy = -b.vy; b.y = clamp(b.y, 5, H - 5); }
    for (const [x, py, d] of [[70, this.a, 1], [W - 70, this.c, -1], [190, this.a, 1], [210, this.c, -1]]) for (const o of [-36, 0, 36]) if (Math.abs(b.x - x) < 6 && Math.abs(b.y - py - o) < 8 && b.vx * d < 0) { b.vx = -b.vx * 1.05; b.vy += (b.y - py - o) * 7; G.audio.tone(500, 0.02, { type: 'square', vol: 0.15 }); }
    if (b.x < 0 || b.x > W) { const g = b.y > 60 && b.y < 140; if (g) { const i = b.x < 0 ? 1 : 0; this.s[i]++; G.audio.play('crowd'); if (this.s[i] >= 5) { this.finish(i === 0 ? 'You win $5.' : 'You lose.', i === 0 ? 5 : -5); return; } this.kick(i ? 1 : -1); } else { b.vx = -b.vx; b.x = clamp(b.x, 0, W); } }
  }
  render(ctx) {
    const b = this.frame(ctx), ox = b.x + 30, oy = b.y + 44; ctx.fillStyle = '#2a8a4a'; ctx.fillRect(ox, oy, 400, 200); ctx.strokeStyle = '#d8e8d8'; ctx.strokeRect(ox + 200, oy, 0.5, 200); ctx.fillStyle = '#e8e8e0'; ctx.fillRect(ox - 4, oy + 60, 4, 80); ctx.fillRect(ox + 400, oy + 60, 4, 80);
    for (const [x, py, c] of [[70, this.a, '#c02020'], [190, this.a, '#c02020'], [210, this.c, '#2040c0'], [330, this.c, '#2040c0']]) { ctx.fillStyle = '#a8acb4'; ctx.fillRect(ox + x - 1, oy, 2, 200); ctx.fillStyle = c; for (const o of [-36, 0, 36]) ctx.fillRect(ox + x - 4, oy + py + o - 8, 8, 16); }
    ctx.fillStyle = '#f4f4ee'; ctx.beginPath(); ctx.arc(ox + this.b.x, oy + this.b.y, 5, 0, TAU); ctx.fill();
    U.text(ctx, this.done ? this.msg : `You ${this.s[0]} - ${this.s[1]} Rival`, b.x + 14, b.y + 26, { size: 10, color: this.done ? '#f0c040' : U.colors.text });
  }
}
// ---------------------------------------------------------------- chess
const START = ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'];
const white = (c) => c >= 'A' && c <= 'Z', VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 200 };
const CH = G.chess = {
  fresh: () => { const B = START.map((r) => r.split('')); B.moved = {}; B.ep = null; return B; },
  pseudo(B, x, y) {
    const c = B[y][x], t = c.toLowerCase(), w = white(c), out = [], add = (a, b) => { if (a < 0 || b < 0 || a > 7 || b > 7) return false; const q = B[b][a]; if (q === '.') { out.push([a, b]); return true; } if (white(q) !== w) out.push([a, b]); return false; }, slide = (ds) => { for (const [dx, dy] of ds) for (let i = 1; i < 8; i++) if (!add(x + dx * i, y + dy * i)) break; };
    if (t === 'p') { const d = w ? -1 : 1, st = w ? 6 : 1; if (B[y + d] && B[y + d][x] === '.') { out.push([x, y + d]); if (y === st && B[y + d * 2][x] === '.') out.push([x, y + d * 2]); } for (const dx of [-1, 1]) { const q = B[y + d] && B[y + d][x + dx]; if (q && q !== '.' && white(q) !== w) out.push([x + dx, y + d]); else if (B.ep && B.ep[0] === x + dx && B.ep[1] === y + d) out.push([x + dx, y + d]); } }
    if (t === 'n') for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(x + dx, y + dy);
    if (t === 'b' || t === 'q') slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    if (t === 'r' || t === 'q') slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    if (t === 'k') for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) if (dx || dy) add(x + dx, y + dy);
    return out;
  },
  apply(B, m) {
    const N = B.map((r) => r.slice()), c = N[m[1]][m[0]], t = c.toLowerCase();
    N.moved = Object.assign({}, B.moved); N.moved[m[0] + ',' + m[1]] = 1; N.moved[m[2] + ',' + m[3]] = 1; N.ep = null;
    if (t === 'p' && B.ep && m[2] === B.ep[0] && m[3] === B.ep[1]) N[m[1]][m[2]] = '.';                                // en passant
    if (t === 'p' && Math.abs(m[3] - m[1]) === 2) N.ep = [m[0], (m[1] + m[3]) / 2];
    if (t === 'k' && Math.abs(m[2] - m[0]) === 2) { const rx = m[2] > m[0] ? 7 : 0, nx = m[2] > m[0] ? 5 : 3; N[m[1]][nx] = N[m[1]][rx]; N[m[1]][rx] = '.'; }   // castling
    N[m[1]][m[0]] = '.'; N[m[3]][m[2]] = c === 'P' && m[3] === 0 ? 'Q' : c === 'p' && m[3] === 7 ? 'q' : c;
    return N;
  },
  attacked(B, x, y, byWhite) { for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) { const c = B[b][a]; if (c !== '.' && white(c) === byWhite && c.toLowerCase() === 'p') { if (b + (white(c) ? -1 : 1) === y && Math.abs(a - x) === 1) return true; continue; } if (c !== '.' && white(c) === byWhite && this.pseudo(B, a, b).some(([p, q]) => p === x && q === y)) return true; } return false; },
  inCheck(B, w) { for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) if (B[b][a] === (w ? 'K' : 'k')) return this.attacked(B, a, b, !w); return true; },
  moves(B, w) { const out = []; for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) { const c = B[b][a]; if (c === '.' || white(c) !== w) continue; for (const [p, q] of this.pseudo(B, a, b)) { const m = [a, b, p, q]; if (!this.inCheck(this.apply(B, m), w)) out.push(m); } }
    // castling: king and rook unmoved, nothing between, and the king neither in, through nor into check
    const y = w ? 7 : 0, mv = B.moved || {};
    if (B[y][4] === (w ? 'K' : 'k') && !mv['4,' + y] && !this.inCheck(B, w)) for (const [rx, step, gap] of [[7, 1, [5, 6]], [0, -1, [1, 2, 3]]]) { if (mv[rx + ',' + y] || B[y][rx] !== (w ? 'R' : 'r') || gap.some((x) => B[y][x] !== '.')) continue; if (this.attacked(B, 4 + step, y, !w) || this.attacked(B, 4 + step * 2, y, !w)) continue; out.push([4, y, 4 + step * 2, y]); }
    return out; },
  score(B) { let s = 0; for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) { const c = B[b][a]; if (c === '.') continue; const v = VAL[c.toLowerCase()] + (3.5 - Math.abs(a - 3.5)) * 0.03; s += white(c) ? -v : v; } return s; },
  best(B) { let top = -1e9, best = []; for (const m of this.moves(B, false)) { const N = this.apply(B, m), rep = this.moves(N, true); let worst = rep.length ? 1e9 : (this.inCheck(N, true) ? 500 : 0); for (const r of rep) worst = Math.min(worst, this.score(this.apply(N, r))); const s = worst + Math.random() * 0.25; if (s > top) { top = s; best = m; } } return best; },
};
class ChessScene extends Mini {
  constructor(g) { super(g, 'Chess', 420, 390); this.B = CH.fresh(); this.sel = null; this.mine = true; this.wait = 0; }
  end(meWon, draw) { this.finish(draw ? 'A draw.' : meWon ? 'Checkmate. You win $20.' : 'Checkmate. You lose.', draw ? 0 : meWon ? 20 : -20); }
  afterMove() { const w = this.mine; if (!CH.moves(this.B, w).length) { if (CH.inCheck(this.B, w)) this.end(!w); else this.end(false, true); } }
  update(dt) {
    if (this.common(dt) || this.done) return;
    if (!this.mine) { if ((this.wait -= dt) <= 0) { const m = CH.best(this.B); if (m && m.length) this.B = CH.apply(this.B, m); this.mine = true; this.afterMove(); G.audio.tone(300, 0.05, { type: 'square', vol: 0.15 }); } return; }
    if (I().mouse.pressed) { const b = this.box(), a = Math.floor((this.mx() - (b.W - 320) / 2) / 40), c = Math.floor((this.my() - 44) / 40); if (a < 0 || c < 0 || a > 7 || c > 7) return; const q = this.B[c][a]; if (this.sel) { const mv = CH.moves(this.B, true).find((m) => m[0] === this.sel[0] && m[1] === this.sel[1] && m[2] === a && m[3] === c); if (mv) { this.B = CH.apply(this.B, mv); this.sel = null; this.mine = false; this.wait = 0.5; this.afterMove(); G.audio.tone(350, 0.05, { type: 'square', vol: 0.15 }); return; } } this.sel = q !== '.' && white(q) ? [a, c] : null; }
  }
  render(ctx) {
    const b = this.frame(ctx), ox = b.x + (b.W - 320) / 2, oy = b.y + 44, G_ = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#7a5a3a' : '#e0cca8'; ctx.fillRect(ox + x * 40, oy + y * 40, 40, 40); if (this.sel && this.sel[0] === x && this.sel[1] === y) { ctx.fillStyle = 'rgba(240,200,60,0.5)'; ctx.fillRect(ox + x * 40, oy + y * 40, 40, 40); } const c = this.B[y][x]; if (c !== '.') { ctx.font = '32px "Segoe UI Symbol", serif'; ctx.textAlign = 'center'; ctx.fillStyle = white(c) ? '#fafaf4' : '#141416'; ctx.strokeStyle = white(c) ? '#141416' : '#fafaf4'; ctx.lineWidth = 0.7; ctx.fillText(G_[c.toLowerCase()], ox + x * 40 + 20, oy + y * 40 + 31); ctx.strokeText(G_[c.toLowerCase()], ox + x * 40 + 20, oy + y * 40 + 31); ctx.textAlign = 'left'; } }
    if (this.sel) for (const m of CH.moves(this.B, true)) if (m[0] === this.sel[0] && m[1] === this.sel[1]) { ctx.fillStyle = 'rgba(60,200,120,0.6)'; ctx.beginPath(); ctx.arc(ox + m[2] * 40 + 20, oy + m[3] * 40 + 20, 6, 0, TAU); ctx.fill(); }
    U.text(ctx, this.done ? this.msg : this.mine ? (CH.inCheck(this.B, true) ? 'Check!' : 'Your move') : 'Thinking...', b.x + 14, b.y + 26, { size: 9, color: '#f0c040' });
  }
}
// ---------------------------------------------------------------- basketball
class HoopScene extends Mini {
  constructor(g) { super(g, 'Basketball', 400, 320); this.n = 0; this.made = 0; this.ai = 2 + Math.floor(Math.random() * 6); this.m = 0; this.shot = null; }
  update(dt) {
    if (this.common(dt) || this.done) return;
    if (this.shot) { const s = this.shot; s.t += dt * 1.5; if (s.t >= 1) { if (s.good) { this.made++; G.audio.play('crowd'); } else G.audio.tone(140, 0.1, { type: 'square', vol: 0.15 }); this.shot = null; this.n++; if (this.n >= 10) { const w = this.made > this.ai; this.finish(`You ${this.made}, rival ${this.ai}. ${w ? 'You win $10.' : 'You lose.'}`, w ? 10 : -10); } } return; }
    this.m = (Math.sin(this.t * (2.4 + this.n * 0.18)) + 1) / 2;
    if (hit()) { const zone = 0.1 - this.n * 0.004; this.shot = { t: 0, good: Math.abs(this.m - 0.5) < zone, off: (this.m - 0.5) * 80 }; G.audio.tone(200, 0.04, { type: 'sine', vol: 0.2 }); }
  }
  render(ctx) {
    const b = this.frame(ctx), cx = b.x + b.W / 2, hy = b.y + 60;
    ctx.fillStyle = '#a0603a'; ctx.fillRect(b.x + 12, b.y + 34, b.W - 24, b.H - 46); ctx.fillStyle = '#e8e8e4'; ctx.fillRect(cx - 44, hy - 30, 88, 50); ctx.fillStyle = '#e06020'; ctx.fillRect(cx - 18, hy + 18, 36, 3);
    const s = this.shot, px = s ? cx + s.off * s.t : cx, py = s ? b.y + b.H - 44 + (hy + 18 - (b.y + b.H - 44)) * s.t - Math.sin(s.t * 3.14) * 40 : b.y + b.H - 44; ctx.fillStyle = '#d8701c'; ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
    const mw = b.W - 60, mx = b.x + 30, my = b.y + b.H - 22; ctx.fillStyle = '#20242a'; ctx.fillRect(mx, my, mw, 10); ctx.fillStyle = '#40c070'; const zone = 0.1 - this.n * 0.004; ctx.fillRect(mx + mw * (0.5 - zone), my, mw * zone * 2, 10); ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw * this.m - 1, my - 2, 3, 14);
    U.text(ctx, this.done ? this.msg : `Shot ${Math.min(10, this.n + 1)}/10   Made ${this.made}   Rival ${this.ai}`, b.x + 14, b.y + 26, { size: 9, color: this.done ? '#f0c040' : U.colors.text });
  }
}
// ---------------------------------------------------------------- the cabinets
class ArcadeScene extends Mini {
  constructor(g, kind) { super(g, { runner: 'Rat Racer', swarm: 'Moth Swarm', stack: 'Tower Trouble' }[kind], 360, 400); this.kind = kind; this.score = 0; this.x = 1; this.obs = []; this.bul = []; this.en = []; this.blocks = [{ x: 60, w: 120 }]; this.cur = { x: 0, w: 120, d: 1 }; this.sp = 80; this.nextT = 0.8; }
  over() { const w = this.game.world, a = (w.arcade = w.arcade || {}), best = a[this.kind] || 0; if (this.score > best) a[this.kind] = this.score; this.finish(`Game over. Score ${this.score}. Best ${Math.max(best, this.score)}.`); }
  update(dt) {
    if (this.common(dt) || this.done) return;
    const left = I().wasPressed('left'), right = I().wasPressed('right');
    if (this.kind === 'runner') {
      if (left) this.x = Math.max(0, this.x - 1); if (right) this.x = Math.min(2, this.x + 1);
      this.sp += dt * 9; this.score += Math.round(dt * this.sp);
      if ((this.nextT -= dt) <= 0) { this.nextT = 0.5 + Math.random() * 0.5 * (120 / this.sp); this.obs.push({ l: G.rng.int(0, 2), y: -20 }); }
      for (const o of this.obs) { o.y += this.sp * 2 * dt; if (o.y > 280 && o.y < 310 && o.l === this.x) { this.over(); return; } }
      this.obs = this.obs.filter((o) => o.y < 340);
    } else if (this.kind === 'swarm') {
      this.x = clamp(this.mx() - 20, 10, 300) || this.x; if (I().pressed.has('ArrowLeft') || I().isDown && I().isDown('left')) this.x -= 180 * dt;
      if (I().mouse.down || I().pressed.has('Space')) { if ((this.cd = (this.cd || 0) - dt) <= 0) { this.cd = 0.2; this.bul.push({ x: this.x, y: 310 }); G.audio.tone(900, 0.02, { type: 'square', vol: 0.08 }); } }
      if ((this.nextT -= dt) <= 0) { this.nextT = Math.max(0.25, 0.9 - this.t * 0.012); this.en.push({ x: 20 + Math.random() * 280, y: -10, ph: Math.random() * 6 }); }
      for (const b of this.bul) b.y -= 330 * dt; for (const e of this.en) { e.y += (50 + this.t * 1.2) * dt; e.x += Math.sin(this.t * 3 + e.ph) * 60 * dt; if (e.y > 320) { this.over(); return; } for (const b of this.bul) if (!b.gone && Math.hypot(b.x - e.x, b.y - e.y) < 11) { b.gone = e.gone = true; this.score += 10; G.audio.tone(300, 0.04, { type: 'square', vol: 0.1 }); } }
      this.bul = this.bul.filter((b) => !b.gone && b.y > -10); this.en = this.en.filter((e) => !e.gone);
    } else {
      const c = this.cur; c.x += c.d * this.sp * dt; if (c.x < 0 || c.x + c.w > 240) { c.d = -c.d; c.x = clamp(c.x, 0, 240 - c.w); }
      if (hit()) { const top = this.blocks[this.blocks.length - 1], a = Math.max(c.x, top.x), e = Math.min(c.x + c.w, top.x + top.w), w = e - a; if (w <= 0) { this.over(); return; } this.blocks.push({ x: a, w }); this.score += Math.round(w); this.cur = { x: 0, w, d: 1 }; this.sp += 12; G.audio.tone(440 + this.blocks.length * 20, 0.05, { type: 'square', vol: 0.12 }); }
    }
  }
  render(ctx) {
    const b = this.frame(ctx), ox = b.x + 30, oy = b.y + 44, W = 300, H = 330; ctx.fillStyle = '#04060c'; ctx.fillRect(ox, oy, W, H);
    if (this.kind === 'runner') { for (let i = 1; i < 3; i++) { ctx.fillStyle = '#2a3a4a'; ctx.fillRect(ox + i * 100, oy, 2, H); } ctx.fillStyle = '#e04040'; for (const o of this.obs) ctx.fillRect(ox + o.l * 100 + 30, oy + o.y, 40, 20); ctx.fillStyle = '#c8c0a8'; ctx.fillRect(ox + this.x * 100 + 38, oy + 288, 24, 16); ctx.fillRect(ox + this.x * 100 + 62, oy + 298, 12, 2); }
    else if (this.kind === 'swarm') { ctx.fillStyle = '#40e0a0'; ctx.fillRect(ox + this.x - 10, oy + 306, 20, 10); ctx.fillStyle = '#f8f0a0'; for (const q of this.bul) ctx.fillRect(ox + q.x - 1, oy + q.y, 2, 8); ctx.fillStyle = '#e8a040'; for (const e of this.en) { const wing = Math.sin(this.t * 20) * 6; ctx.fillRect(ox + e.x - 2, oy + e.y - 3, 4, 7); ctx.fillRect(ox + e.x - 8, oy + e.y - 2 + wing / 3, 6, 3); ctx.fillRect(ox + e.x + 2, oy + e.y - 2 + wing / 3, 6, 3); } }
    else { const base = oy + H - 18, off = Math.max(0, (this.blocks.length - 13) * 22); this.blocks.forEach((q, i) => { ctx.fillStyle = `hsl(${i * 24},60%,55%)`; ctx.fillRect(ox + 30 + q.x, base - i * 22 + off, q.w, 20); }); const c = this.cur; ctx.fillStyle = '#f8f8f0'; ctx.fillRect(ox + 30 + c.x, base - this.blocks.length * 22 + off, c.w, 20); }
    U.text(ctx, `Score ${this.score}`, ox, b.y + 26, { size: 10 }); if (this.done) U.text(ctx, this.msg, b.x + b.W / 2, oy + 140, { size: 11, align: 'center', weight: 'bold', color: '#f0c040', shadow: true });
  }
}
// ---------------------------------------------------------------- karaoke
const SONGS = [['Harbor Lights', ['Oh the tide comes in', 'and the tide goes out', 'and I am still here', 'on the same old pier']], ['Neon Heart', ['Baby turn the lights down', 'I can see you fine', 'Every sign on this street', 'is spelling out your name']], ['Rent Is Due', ['Rent is due, rent is due', 'and I got a song for you', 'but the landlord does not sing', 'and he does not want a thing']]];
class KaraokeScene extends Mini {
  constructor(g) { super(g, 'Karaoke', 480, 300); this.song = pick(SONGS); this.title = this.song[0]; this.notes = []; for (let i = 0; i < 28; i++) this.notes.push({ t: 1.6 + i * 0.8 + (i % 4 === 3 ? 0.2 : 0), l: G.rng.int(0, 3) }); this.good = 0; this.miss = 0; }
  update(dt) {
    if (this.common(dt) || this.done) return;
    const keys = ['left', 'up', 'down', 'right'];
    keys.forEach((k, l) => { if (I().wasPressed(k)) { const n = this.notes.find((q) => !q.hit && !q.gone && q.l === l && Math.abs(q.t - this.t) < 0.26); if (n) { n.hit = true; this.good++; G.audio.tone([262, 330, 392, 523][l], 0.28, { type: 'triangle', vol: 0.14 }); } else this.miss++; } });
    for (const n of this.notes) if (!n.hit && !n.gone && this.t - n.t > 0.3) { n.gone = true; this.miss++; }
    if (this.t > this.notes[this.notes.length - 1].t + 1.5) { const k = this.good / this.notes.length, g = this.game, tips = k > 0.8 ? 15 : k > 0.5 ? 5 : 0; for (const a of g.actors) if (a.kind === 'npc' && !a.dead && a.distTo(g.player) < 180 && Math.random() < 0.5) a.say(k > 0.8 ? pick(['Encore!', 'What a voice!']) : k > 0.5 ? pick(['Not bad!', 'Good try!']) : pick(['Please stop.', 'My ears!', 'Somebody unplug that.']), 3); G.audio.play('crowd'); this.finish(`${Math.round(k * 100)}%. ${k > 0.8 ? 'The room loved it.' : k > 0.5 ? 'A fair effort.' : 'People winced.'}${tips ? ` Tips: $${tips}.` : ''}`, tips); }
  }
  render(ctx) {
    const b = this.frame(ctx), ox = b.x + 40, oy = b.y + 90, lane = 40; ctx.fillStyle = '#16141e'; ctx.fillRect(ox, oy, b.W - 80, lane * 4);
    const hitX = ox + 60; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(hitX - 2, oy, 4, lane * 4); const label = ['<', '^', 'v', '>'], col = ['#ff6060', '#60c0ff', '#60ff90', '#ffd060'];
    for (let i = 0; i < 4; i++) U.text(ctx, label[i], ox + 16, oy + i * lane + 12, { size: 12, color: col[i], weight: 'bold' });
    for (const n of this.notes) { if (n.hit || n.gone) continue; const x = hitX + (n.t - this.t) * 130; if (x > b.x + b.W - 40) continue; ctx.fillStyle = col[n.l]; ctx.fillRect(x - 9, oy + n.l * lane + 8, 18, 22); }
    const ln = this.song[1][Math.min(3, Math.floor(this.t / 6) % 4)]; U.text(ctx, ln, b.x + b.W / 2, b.y + 54, { size: 13, align: 'center', weight: 'bold' });
    U.text(ctx, this.done ? this.msg : `Hits ${this.good}   Misses ${this.miss}`, b.x + 14, b.y + 26, { size: 9, color: this.done ? '#f0c040' : U.colors.text });
  }
}
// ---------------------------------------------------------------- an instrument, played by key
const SCALE = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3];
class InstrumentScene extends Mini {
  constructor(g, inst) { super(g, { piano: 'Piano', guitar: 'Guitar', drums: 'Drums' }[inst], 420, 190); this.inst = inst; this.flash = new Array(8).fill(0); this.played = 0; }
  play(i) { this.flash[i] = 0.25; this.played++; const f = SCALE[i]; if (this.inst === 'drums') G.audio.noise(0.09, { vol: 0.2, freq: 200 + i * 300, type: i % 2 ? 'highpass' : 'lowpass' }); else G.audio.tone(f * (this.inst === 'guitar' ? 0.5 : 1), this.inst === 'guitar' ? 0.5 : 0.7, { type: this.inst === 'guitar' ? 'sawtooth' : 'triangle', vol: 0.16 }); if (this.played % 24 === 0) { const g = this.game, a = g.actors.find((n) => n.kind === 'npc' && !n.dead && n.distTo(g.player) < 150); if (a) a.say(pick(['Nice.', 'Keep playing!', 'You have done this before.', 'Is that supposed to sound like that?']), 3); } }
  update(dt) { if (this.common(dt)) return; for (let i = 0; i < 8; i++) { this.flash[i] = Math.max(0, this.flash[i] - dt); if (I().pressed.has(`Digit${i + 1}`)) this.play(i); } if (I().mouse.pressed) { const b = this.box(), i = Math.floor((this.mx() - 14) / ((b.W - 28) / 8)); if (i >= 0 && i < 8 && this.my() > 40) this.play(i); } }
  render(ctx) { const b = this.frame(ctx), w = (b.W - 28) / 8; for (let i = 0; i < 8; i++) { ctx.fillStyle = this.flash[i] > 0 ? '#f0c040' : '#e8e8e0'; ctx.fillRect(b.x + 14 + i * w + 1, b.y + 44, w - 2, b.H - 60); U.text(ctx, String(i + 1), b.x + 14 + i * w + w / 2, b.y + b.H - 32, { size: 11, align: 'center', color: '#20242a' }); } }
}
// ---------------------------------------------------------------- the gym
class GymScene extends Mini {
  constructor(g, kind, vid) { super(g, { stamina: 'Treadmill', strength: 'Bench Press', brawl: 'Heavy Bag' }[kind], 360, 220); this.kind = kind; this.vid = vid; this.reps = 0; this.m = 0; this.need = 12; this.misses = 0; }
  update(dt) {
    if (this.common(dt) || this.done) return;
    this.m = (Math.sin(this.t * (2.6 + this.reps * 0.08)) + 1) / 2;
    if (hit()) { if (Math.abs(this.m - 0.5) < 0.17) { this.reps++; G.audio.tone(this.kind === 'brawl' ? 120 : 240, 0.05, { type: 'sine', vol: 0.18 }); if (this.kind === 'brawl') G.audio.play('punch'); } else this.misses++; if (this.misses >= 4 || this.reps >= this.need) this.end(); }
  }
  end() { const g = this.game, w = g.world, p = this.p, today = w.flags.gymDay === w.day; const xp = today ? 2 : 6 + this.reps * 2; G.skills.addXp(p, xp, 'training', g); w.flags.gymDay = w.day; if (this.kind === 'strength' && !today) { w.flags.gymSets = (w.flags.gymSets || 0) + 1; if (w.flags.gymSets % 8 === 0 && G.attr.of(p) && G.attr.of(p).strength < G.attr.MAX) { G.attr.of(p).strength++; p.refreshStats(); g.toast('You feel stronger. Strength up.', 'good'); } } if (p.stamina != null) p.stamina = Math.max(0, p.stamina - 20); w.skipHours(0.5); this.finish(`${this.reps} reps. +${xp} XP.${today ? ' (Tired: you already trained today.)' : ''}`); }
  render(ctx) { const b = this.frame(ctx), mx = b.x + 30, mw = b.W - 60, my = b.y + 110; ctx.fillStyle = '#20242a'; ctx.fillRect(mx, my, mw, 16); ctx.fillStyle = '#40c070'; ctx.fillRect(mx + mw * 0.33, my, mw * 0.34, 16); ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw * this.m - 1.5, my - 3, 3, 22); U.text(ctx, this.done ? this.msg : `Reps ${this.reps}/${this.need}   Misses ${this.misses}/4`, b.x + b.W / 2, b.y + 60, { size: 11, align: 'center', color: this.done ? '#f0c040' : U.colors.text }); }
}
// ---------------------------------------------------------------- pages and plaques
const BOOKS = [
  ['The Lighthouse Keeper\'s Almanac', ['Tides do not care what you promised. Check them anyway.', 'A good lamp and a bad radio will outlast most marriages.', 'Fog: stay put. Everything else: also stay put.']],
  ['A Short History of the Port', ['The first pier was built by men who were paid in salt fish.', 'By the third strike, the owners had learned the workers\' names. By the fourth, they had forgotten them.', 'The cranes came, and then the containers, and then the quiet.']],
  ['Cooking for One', ['Chapter one: the good pan.', 'Chapter two: you are allowed to eat over the sink.', 'Chapter three: invite someone. The recipes double easily.']],
  ['Poems from a Night Shift', ['Three in the morning has its own weather.', 'The vending machine hums the only song it knows.', 'Someone has to be awake for the rest of you.']],
  ['Chess for the Impatient', ['Control the center. Do not move the same piece twice for no reason.', 'If you are winning, trade. If you are losing, complicate.', 'Every master has lost to a child. Remember that when you lose to one.']],
  ['The Law of the Lot', ['Owning land is not the same as being allowed to build on it.', 'A permit is a promise from the city. It is rarely in a hurry.', 'What you put up without paper, the city can take down without asking.']],
];
const EXHIBITS = {
  v_painting: ['"Harbor at Dusk", oil on canvas. The ships are painted over older ships.', '"Portrait of an Unknown Clerk". Nobody has ever claimed him.', '"Composition No. 9". The label says it is upside down on purpose.'],
  v_painting2: ['"Night, Eastside". The artist was evicted the week it sold.', '"Mountains I Never Saw". Painted from a postcard.'],
  v_sculpture: ['"Rising". Bronze. Children keep touching the left side, and it shines.', '"The Debt". It leans a little further every year, the plaque says.'],
  v_display_case: ['A dock worker\'s hook, 1931. The handle is worn to one man\'s grip.', 'Coins from a wreck in the bay. Press the button: a tide table lights up.', 'A strike banner, carefully mended. Someone kept it under a bed for forty years.'],
  v_dino: ['A giant ground sloth, found while digging the harbor tunnel. Press the button and it clacks its jaw, slowly.'],
};
class BookScene { constructor(b) { this.transparent = true; this.b = b; this.p = 0; }
  update() { const i = I(); if (i.wasPressed('cancel')) { G.scenes.remove(this); return; } if (i.wasPressed('right') || i.mouse.pressed) { G.audio.play('pickup'); this.p++; if (this.p >= this.b[1].length) G.scenes.remove(this); } if (i.wasPressed('left')) this.p = Math.max(0, this.p - 1); }
  render(ctx) { const R = G.renderer, W = Math.min(420, R.uiW - 20), H = Math.min(260, R.uiH - 20), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2; U.dim(ctx, 0.6); ctx.fillStyle = '#efe6cf'; ctx.fillRect(x, y, W, H); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x, y, 4, H); U.text(ctx, this.b[0], x + 20, y + 16, { size: 12, weight: 'bold', color: '#2a2018' }); U.wrap(ctx, this.b[1][Math.min(this.p, this.b[1].length - 1)], W - 40, 11).forEach((l, i) => U.text(ctx, l, x + 20, y + 54 + i * 18, { size: 11, color: '#2a2018' })); U.text(ctx, `${Math.min(this.p + 1, this.b[1].length)} / ${this.b[1].length}`, x + W - 16, y + H - 18, { size: 8, align: 'right', color: '#6a5a4a' }); } }
G.BookScene = BookScene;
const TATTOOS = [['Anchor', 60], ['Swallow', 80], ['Skull', 90], ['Rose', 70], ['Barbed wire', 110], ['A name', 40]];
const venueOf = (scene, d) => { const b = scene.map.buildingAtTile(d.tx, d.ty) || scene.map.buildingAt(scene.player.x, scene.player.y - 3); return (b && b.venue) || null; };
const USE = {
  v_pool(s) { if (s.player.gold < 10) { s.toast('The table costs a $10 stake.', 'warn'); return; } G.scenes.push(new PoolScene(s, 10)); },
  v_bowling(s, d) { const vid = venueOf(s, d), n = vid ? S0.price(s.world, vid, 8) : 8; if (s.player.gold < n) { s.toast(`A game is $${n}.`, 'warn'); return; } s.player.gold -= n; if (vid) S0.st(s.world, vid).till += n; G.audio.play('coin'); G.scenes.push(new BowlingScene(s)); },
  v_darts(s) { G.scenes.push(new DartsScene(s)); }, v_foosball(s) { G.scenes.push(new FoosScene(s)); }, v_chess(s) { G.scenes.push(new ChessScene(s)); }, v_hoop(s) { G.scenes.push(new HoopScene(s)); },
  v_arcade(s, d) { if (s.player.gold < 1) { s.toast('Out of quarters.', 'warn'); return; } s.player.gold -= 1; const vid = venueOf(s, d); if (vid) S0.st(s.world, vid).till += 1; G.audio.play('coin'); G.scenes.push(new ArcadeScene(s, d.def.game)); },
  v_mic(s) { G.scenes.push(new KaraokeScene(s)); }, v_instrument(s, d) { G.scenes.push(new InstrumentScene(s, d.def.inst)); },
  v_gym(s, d) { const vid = venueOf(s, d), w = s.world, n = vid ? S0.price(w, vid, 6) : 0; if (vid && w.flags.gymPass !== w.day) { if (s.player.gold < n) { s.toast(`A day pass is $${n}.`, 'warn'); return; } s.player.gold -= n; S0.st(w, vid).till += n; w.flags.gymPass = w.day; G.audio.play('coin'); } G.scenes.push(new GymScene(s, d.def.gym, vid)); },
  v_ticket(s, d) { const vid = venueOf(s, d); if (vid) G.showSys.tickets(s, vid); },
  v_book(s) { G.scenes.push(new BookScene(pick(BOOKS))); },
  v_exhibit(s, d) { const vid = venueOf(s, d), w = s.world; if (vid && G.VENUES[vid].kind === 'museum' && w.flags.museumDay !== w.day) { const n = S0.price(w, vid, 8); if (s.player.gold < n) { s.toast(`Admission is $${n}.`, 'warn'); return; } s.player.gold -= n; S0.st(w, vid).till += n; w.flags.museumDay = w.day; G.audio.play('coin'); } G.audio.tone(660, 0.06, { type: 'sine', vol: 0.1 }); G.scenes.push(new G.ChoiceScene(vid ? G.VENUES[vid].name : 'Exhibit', pick(EXHIBITS[d.type] || EXHIBITS.v_painting), [{ label: 'Step back.', fn: () => {} }])); if (w.flags.exhibitsDay !== w.day) { w.flags.exhibitsDay = w.day; G.skills.addXp(s.player, 4, 'culture', s); } },
  v_prop(s) { const a = s.actors.find((n) => n.kind === 'npc' && !n.dead && n.def.name === 'Actor' && n.distTo(s.player) < 160); if (a) a.say(pick(['That is a prop. Please do not sit on it.', 'Careful, that took me a week.']), 3); else s.toast('Painted plywood. It looks better from the seats.'); },
  v_tattoo(s, d) { const vid = venueOf(s, d), w = s.world, p = s.player; if (!vid || !S0.isOpen(w, vid)) { s.toast('Closed.', 'warn'); return; } G.scenes.push(new G.ListScene('Iron Ink', () => TATTOOS.map(([n, c]) => { const price = S0.price(w, vid, c), have = (p.tattoos || []).includes(n); return { label: `${n}   $${price}`, disabled: have || p.gold < price, act: () => { p.gold -= price; S0.st(w, vid).till += price; (p.tattoos = p.tattoos || []).push(n); G.audio.play('coin'); w.skipHours(1); return `${n}: done.`; } }; }))); },
  v_barber(s, d) { const vid = venueOf(s, d), w = s.world, p = s.player, n = vid ? S0.price(w, vid, 15) : 15; if (vid && !S0.isOpen(w, vid)) { s.toast('Closed.', 'warn'); return; } if (p.gold < n) { s.toast(`A cut is $${n}.`, 'warn'); return; } p.gold -= n; if (vid) S0.st(w, vid).till += n; G.audio.play('coin'); G.scenes.push(new G.BarberScene(s)); },
};
const LABELS = { v_pool: 'Play pool ($10 stake)', v_bowling: 'Bowl a game', v_darts: 'Throw darts', v_foosball: 'Play table football', v_chess: 'Play chess', v_hoop: 'Shoot hoops', v_arcade: 'Play ($1)', v_mic: 'Sing', v_instrument: 'Play it', v_gym: 'Train', v_ticket: 'Buy a ticket', v_book: 'Read', v_exhibit: 'Look closer', v_prop: 'Touch the prop', v_tattoo: 'Get a tattoo', v_barber: 'Get a haircut' };
const _use = GS.useDecor, _lab = GS.decorLabel;
GS.useDecor = function (d) { const f = USE[d.def.interact]; if (f) { f(this, d); return undefined; } return _use.apply(this, arguments); };
GS.decorLabel = function (d) { return LABELS[d.def.interact] || _lab.apply(this, arguments); };
Object.assign(G, { PoolScene, BowlingScene, DartsScene, FoosScene, ChessScene, HoopScene, ArcadeScene, KaraokeScene, InstrumentScene, GymScene });
// these draw their own screens: the window theme keeps out of them
for (const n of ['CinemaScene', 'StageScene', 'PoolScene', 'BowlingScene', 'DartsScene', 'FoosScene', 'ChessScene', 'HoopScene', 'ArcadeScene', 'KaraokeScene', 'InstrumentScene', 'GymScene']) G.xp.NOIR.add(n);
// a tattoo shows on the arm
const PL = G.Player.prototype, _pd = PL.draw;
PL.draw = function (ctx) { const r = _pd.call(this, ctx); if ((this.tattoos || []).length && this.dir !== 3 && !this.look.top) { ctx.fillStyle = 'rgba(30,40,70,0.7)'; ctx.fillRect(this.x - 6, this.y - 14, 2, 3); } return r; };
})();
