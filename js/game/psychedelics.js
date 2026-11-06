'use strict';
// Psychedelics, felt properly.
//   LSD and mushrooms now have a shape: a slow come-up, a long peak and a gentle comedown. At the peak the
//   world breathes (surfaces swell and shrink), everything that moves leaves tracers, colors pulse, faint
//   geometry crawls over everything, and the colorful strangers (or, on a bad trip, the shadows) appear.
//   DMT (smoked: you need a lighter) is short and overwhelming: within seconds the world folds into a
//   kaleidoscope, strange beings made of light come close and say things you will not understand
//   ([Placeholder] lines for the lore), and a couple of minutes later you are back, shaken and amazed.
(() => {
G.ITEMS.dmt = { id: 'dmt', name: 'DMT', type: 'consumable', icon: 'crack', stack: 10, value: 60, illegal: true, effects: { dmt: [110, 1.6] }, drug: { cls: 'psychedelic', load: 6, tol: 60 }, desc: 'A crystalline powder you smoke. A few minutes somewhere else entirely. Not addictive. Needs a lighter.' };
if (!G.SMOKEABLE.includes('dmt')) G.SMOKEABLE.push('dmt');
G.EFFECTS.dmt = { id: 'dmt', name: 'Breakthrough', kind: 'drug', color: '#ff70ff', stats: { charisma: -3, aim: -0.5 }, spread: 0.4, visual: 'trip', desc: 'You are not in the world any more. Something else is. It is enormous and it is looking at you.' };
G.EFFECTS.afterglow_dmt = { id: 'afterglow_dmt', name: 'Back From Somewhere', kind: 'status', color: '#c0a0ff', stats: { charisma: 1 }, desc: 'You saw something you cannot describe. Everything looks a little new.' };
if (G.DRUG_MENU) G.DRUG_MENU.push(['dmt', 60]);
if (G.addiction) G.addiction.PRICE.dmt = 60;
// dealers stock it now and then
const _roll = G.lifestyle.roll;
G.lifestyle.roll = function (life, style) { const out = _roll.call(this, life, style); if (life === 'dealer' && Math.random() < 0.25) out.push(['dmt', 1]); return out; };

// how strong a trip is right now: 0..1, with a come-up and a comedown
const curve = (e) => { if (!e) return 0; const k = (e.dur - e.t) / e.dur; return Math.min(1, k / 0.18, (1 - k) / 0.25) * Math.min(1.3, e.power); };
G.psy = {
  level(p) { return Math.max(curve(G.effects.get(p, 'trip')), curve(G.effects.get(p, 'dmt')) * 1.2); },
  dmt(p) { return curve(G.effects.get(p, 'dmt')); },
};
// the trip ramps instead of switching on and off
const _vis = G.effects.visuals;
G.effects.visuals = function (p) { const v = _vis.call(this, p); if (G.effects.has(p, 'trip') || G.effects.has(p, 'dmt')) v.trip = Math.max(v.trip * 0.4, G.psy.level(p)); return v; };

const LINES = ['[Placeholder] You have been here before.', '[Placeholder] Welcome back.', '[Placeholder] Look. LOOK.', '[Placeholder] It is not time yet.', '[Placeholder] We have been waiting.', '[Placeholder] You cannot take this with you.'];
const GS = G.GameScene.prototype, _fx = GS.renderScreenFx, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  const p = this.player; if (!p) return r;
  const d = G.psy.dmt(p);
  if (d > 0.5 && (this.dmtT = (this.dmtT || 3) - dt) <= 0) { this.dmtT = G.rng.range(5, 9); this.dmtLine = { text: G.rng.pick(LINES), t: 4 }; }
  if (this.dmtLine && (this.dmtLine.t -= dt) <= 0) this.dmtLine = null;
  if (G.effects.has(p, 'dmt')) this.hadDmt = true;
  else if (this.hadDmt) { this.hadDmt = false; G.effects.add(p, 'afterglow_dmt', 600); this.toast('You are back. Your hands are shaking. You are smiling.', 'info'); this.world.log('You smoked DMT and went... somewhere.', 'info'); }
  return r;
};
GS.renderScreenFx = function (ctx) {
  const p = this.player, lvl = p ? G.psy.level(p) : 0, R = G.renderer, W = ctx.canvas.width, H = ctx.canvas.height, t = this.time || 0;
  // tracers: last frame's image, faintly, under this one
  if (lvl > 0.25) {
    if (!this.trace) { this.trace = document.createElement('canvas'); }
    const tc = this.trace;
    if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(0.45, lvl * 0.35); ctx.drawImage(tc, 0, 0); ctx.restore();
  }
  _fx.call(this, ctx);
  if (lvl > 0.25 && this.trace) { const x = this.trace.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(ctx.canvas, 0, 0); }
  if (lvl <= 0.05) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // breathing: the whole view swells and shrinks a little
  if (lvl > 0.4) { const s = 1 + Math.sin(t * 0.9) * 0.012 * lvl; ctx.globalAlpha = 0.25 * lvl; ctx.drawImage(ctx.canvas, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); ctx.globalAlpha = 1; }
  // geometry crawling over everything
  ctx.globalCompositeOperation = 'overlay';
  ctx.strokeStyle = `hsla(${(t * 40) % 360},90%,60%,${Math.min(0.5, lvl * 0.35)})`; ctx.lineWidth = Math.max(1, W / 600);
  const cell = Math.max(40, W / 14);
  for (let gy = -cell; gy < H + cell; gy += cell) for (let gx = -cell; gx < W + cell; gx += cell) {
    const ph = t * 0.6 + (gx + gy) * 0.004, r = cell * (0.3 + 0.12 * Math.sin(ph * 2));
    ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = ph + k * Math.PI / 3; const px = gx + Math.cos(a) * r, py = gy + Math.sin(a) * r; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // DMT: the world folds into a kaleidoscope, and something looks back
  const d = p ? G.psy.dmt(p) : 0;
  if (d > 0.05) {
    const cx = W / 2, cy = H / 2, R0 = Math.hypot(W, H) * 0.6;
    ctx.globalAlpha = Math.min(0.92, d * 0.85);
    ctx.fillStyle = '#05000a'; ctx.fillRect(0, 0, W, H);
    for (let ring = 0; ring < 14; ring++) {
      const rr = R0 * (1 - ring / 14) * (0.8 + 0.2 * Math.sin(t * 1.3 + ring)), n = 6 + (ring % 3) * 2;
      ctx.fillStyle = `hsl(${(t * 60 + ring * 27) % 360},95%,${45 + (ring % 2) * 15}%)`;
      ctx.beginPath();
      for (let k = 0; k <= n * 2; k++) { const a = t * (ring % 2 ? 0.4 : -0.3) + k * Math.PI / n; const rad = k % 2 ? rr : rr * 0.72; const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.fill();
    }
    // the beings: bright shapes with eyes
    for (let b = 0; b < 3; b++) {
      const a = t * 0.3 + b * 2.1, bx = cx + Math.cos(a) * W * 0.22, by = cy + Math.sin(a * 1.3) * H * 0.18, s = H * 0.06 * (1 + 0.2 * Math.sin(t * 2 + b));
      ctx.fillStyle = `hsl(${(t * 90 + b * 120) % 360},100%,75%)`;
      ctx.beginPath(); ctx.moveTo(bx, by - s * 1.6); ctx.lineTo(bx + s, by); ctx.lineTo(bx, by + s * 1.6); ctx.lineTo(bx - s, by); ctx.fill();
      ctx.fillStyle = '#05000a'; ctx.beginPath(); ctx.arc(bx, by, s * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx + s * 0.08, by - s * 0.06, s * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (this.dmtLine && d > 0.3) { R.uiTransform(); G.ui.text(ctx, this.dmtLine.text, R.uiW / 2, R.uiH * 0.72, { align: 'center', size: 12, color: '#ffffff', weight: 'bold' }); }
};
})();
