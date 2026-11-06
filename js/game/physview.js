'use strict';
// Putting a physics body (js/game/physbody.js) on the screen, and a room to try it in: Debug Menu > World > Physics test.
// The body is drawn from its joints, in the game's camera: ground distance is 1:1, height is 0.96, and the depth of a person
// who stands is flattened the way their sprite is (it goes back to 1:1 as they go down, since then they are lying on the ground).
(() => {
const A = G.assets, sh = A.shade, PX = 44 / 1.75;   // a person is 44 pixels tall and 1.75 m
const B = G.Body3, I = B.I;

// a screen point for a world point (x, y, z in metres) of body b, relative to where it stands
function proj(b, q, ox, oy) { const up = b.upright(), p = b.at('pelvis'), k = 0.3 + 0.7 * (1 - up), dy = q[1] - p[1]; return { x: ox + q[0] * PX, y: oy + (p[1] + dy * k) * PX - q[2] * PX * 0.96 }; }
function limb(x, a, b, r0, r1, col) {   // a tapered limb, lit from the upper left (as a painted one)
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 0.01, nx = -dy / l, ny = dx / l, left = (nx < 0) === (ny >= 0), g = x.createLinearGradient(a.x + nx * r0, a.y + ny * r0, a.x - nx * r0, a.y - ny * r0);
  g.addColorStop(0, left ? sh(col, 0.76) : sh(col, 1.14)); g.addColorStop(0.5, col); g.addColorStop(1, left ? sh(col, 1.14) : sh(col, 0.76));
  x.fillStyle = g; x.beginPath(); x.moveTo(a.x + nx * r0, a.y + ny * r0); x.lineTo(b.x + nx * r1, b.y + ny * r1); x.arc(b.x, b.y, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); x.lineTo(a.x - nx * r0, a.y - ny * r0); x.arc(a.x, a.y, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.25; x.stroke();
}
function shadow(x, b, ox, oy) {
  const g = b.world.ground || 0; x.fillStyle = 'rgba(0,0,0,0.22)';
  for (const n of ['pelvis', 'chest', 'head', 'kneeL', 'kneeR', 'ankL', 'ankR', 'handL', 'handR']) { const q = b.at(n), h = Math.max(0, q[2] - g), r = 0.13 * PX * Math.max(0.3, 1 - h * 0.25); x.beginPath(); x.ellipse(ox + q[0] * PX, oy + q[1] * PX, r, r * 0.6, 0, 0, 6.3); x.fill(); }
}
G.bodyView = {
  draw(x, b, look, actor, ox = 0, oy = 0) {
    const L = look, P = (n) => proj(b, b.at(n), ox, oy), f = b.frame(), U = (b.k || 1), parts = [], add = (d, fn) => parts.push({ d, fn }), near = (n) => { const q = b.at(n); return q[1] + q[2] * 0.2; };
    shadow(x, b, ox, oy);
    const pants = L.bareBottom ? L.skin : L.pants, top = L.bareTop ? L.skin : L.top, sleeve = L.bareTop || L.topStyle === 'tank' || L.topStyle === 'vest' ? L.skin : L.top;
    const leg = (hip, kn, an, toe) => add((near(hip) + near(an)) / 2, () => { const a = P(hip), c = P(kn), e = P(an), t = P(toe); limb(x, a, c, 2.3 * U, 1.7 * U, pants); limb(x, c, e, 1.6 * U, 1.05 * U, pants); limb(x, e, t, 1.2 * U, 0.95 * U, L.shoes || '#3a3028'); });
    const arm = (s, el, ha) => add((near(s) + near(ha)) / 2, () => { const a = P(s), c = P(el), e = P(ha); limb(x, a, c, 1.7 * U, 1.3 * U, sleeve); limb(x, c, e, 1.28 * U, 0.92 * U, L.shortSleeves ? L.skin : sleeve); x.fillStyle = L.gloves ? '#16161a' : L.skin; x.beginPath(); x.arc(e.x, e.y, 1.05 * U, 0, 6.3); x.fill(); });
    leg('hipL', 'kneeL', 'ankL', 'toeL'); leg('hipR', 'kneeR', 'ankR', 'toeR'); arm('shL', 'elbL', 'handL'); arm('shR', 'elbR', 'handR');
    add(near('belly'), () => {
      const hl = P('hipL'), hr = P('hipR'), sl = P('shL'), sr = P('shR'), be = P('belly'), pv = P('pelvis'), xs = [hl.x, hr.x, sl.x, sr.x], x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2;
      const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, sh(top, 1.14)); g.addColorStop(0.45, top); g.addColorStop(1, sh(top, 0.72));
      limb(x, pv, P('hipL'), 3 * U, 2.4 * U, pants); limb(x, pv, P('hipR'), 3 * U, 2.4 * U, pants);
      x.fillStyle = g; x.beginPath(); x.moveTo(sl.x, sl.y); x.quadraticCurveTo((sl.x + hl.x) / 2 + (be.x - (sl.x + sr.x + hl.x + hr.x) / 4) * 0.7, be.y, hl.x, hl.y); x.lineTo(pv.x, pv.y + 0.6); x.lineTo(hr.x, hr.y); x.quadraticCurveTo((sr.x + hr.x) / 2 + (be.x - (sl.x + sr.x + hl.x + hr.x) / 4) * 0.7, be.y, sr.x, sr.y); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.3; x.stroke();
      limb(x, sl, sr, 2 * U, 2 * U, top);
    });
    add(near('head') + 0.02, () => {
      const n = P('neck'), h = P('head'), c = G.bodyView.headOf(actor); limb(x, n, h, 1.5 * U, 1.3 * U, L.skin);
      if (!c) { x.fillStyle = L.skin; x.beginPath(); x.arc(h.x, h.y, 3.8 * U, 0, 6.3); x.fill(); return; }
      const k = 1 / 4 * 1.05, w = c.width * k, H = c.height * k, a = Math.atan2(h.x - n.x, n.y - h.y); x.save(); x.translate(h.x, h.y); x.rotate(a); x.imageSmoothingEnabled = true; x.drawImage(c, -w / 2, -H * 0.62, w, H); x.restore();
    });
    parts.sort((p, q) => p.d - q.d); for (const p of parts) p.fn();
    void f;
  },
  // the head of the person's own art, cut at the neck
  headOf(a) { if (!a) return null; const hd = G.hd.get(a.sheet); if (!hd) return null; if (hd._head3) return hd._head3; const K = 4, cut = Math.ceil(G.body.geom(hd.L, 0, 0, null).shoulderY) - 1, c = document.createElement('canvas'); c.width = G.hd.FW * K; c.height = cut * K; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(hd.img, 0, 0, G.hd.FW, G.hd.FH, 0, 0, G.hd.FW * K, G.hd.FH * K); hd._head3 = c; return c; },
};

// ---------------------------------------------------------------- the test room
const ROOM = { w: 12, h: 8 };   // metres
const SHOTS = {
  Digit1: ['Shove in the chest', (b, side) => b.hit(b.at('chest'), side, 55)],
  Digit2: ['Hard shove', (b, side) => b.hit(b.at('chest'), side, 150)],
  Digit3: ['Punch to the head', (b, side) => b.hit(b.at('head'), side, 14)],
  Digit4: ['Knockout punch', (b, side) => b.hit(b.at('head'), side, 34)],
  Digit5: ['Punch to the left shoulder', (b, side) => b.hit(b.at('shL'), side, 45)],
  Digit6: ['Punch to the right shoulder', (b, side) => b.hit(b.at('shR'), side, 45)],
  Digit7: ['Gunshot in the left knee', (b, side) => { b.hit(b.at('kneeL'), side, 10); b.wound('legL', 0.05); }],
  Digit8: ['Gunshot in the belly', (b, side) => { b.hit(b.at('belly'), side, 10); b.tone = 0.25; b.stun = 0.9; }],
  Digit9: ['Stab in the right thigh', (b, side) => { b.hit(b.at('hipR'), side, 6); b.wound('legR', 0.3); }],
  Digit0: ['Drop from 4 m', (b) => { b.place(b.com().x, b.com().y, 4, b.yaw); b.state = 'stand'; b.step = null; }],
};
class PhysTestScene {
  constructor(game) { this.game = game; this.slow = false; this.last = ''; this.from = 1; this.reset(); this.acc = 0; }
  reset() { this.body = new B(ROOM.w / 2, ROOM.h / 2, 0, 0, { world: { walls: [{ nx: 1, ny: 0, d: 0 }, { nx: -1, ny: 0, d: -ROOM.w }, { nx: 0, ny: 1, d: 0 }, { nx: 0, ny: -1, d: -ROOM.h }] } }); this.flash = []; }
  // the side blows come from (Q switches); a click lands a punch where you click
  dir() { return [this.from, 0, 0]; }
  update(dt) {
    const K = G.input, p = K.pressed; if (p.has('Escape')) { G.scenes.remove(this); return; }
    if (p.has('KeyR')) this.reset(); if (p.has('KeyQ')) this.from = -this.from; if (p.has('KeyS')) this.slow = !this.slow;
    for (const c in SHOTS) if (p.has(c)) { const before = this.body.at('chest'); SHOTS[c][1](this.body, this.dir()); this.last = SHOTS[c][0]; this.flash.push({ x: before[0], y: before[1], z: before[2], t: 0.25 }); }
    const m = K.mouse; if (m.pressed) { const R = G.renderer, W = this.view(R), wx = (m.ux - W.ox) / W.z / PX, wy = (m.uy - W.oy) / W.z / PX, b = this.body; let best = null, bd = 1e9; for (const j of B.JOINTS) { const q = proj(b, b.at(j[0]), 0, 0), d = Math.hypot(q.x / PX - wx, q.y / PX - wy); if (d < bd) { bd = d; best = j[0]; } } if (bd < 0.35) { const n = b.hit(b.at(best), this.dir(), 40); this.last = 'Punch at ' + n; } m.pressed = false; }
    this.body.update(this.slow ? dt / 4 : dt); for (const f of this.flash) f.t -= dt; this.flash = this.flash.filter((f) => f.t > 0);
  }
  view(R) { const z = Math.min((R.uiW - 12) / (ROOM.w * PX), (R.uiH - 70) / (ROOM.h * PX)); return { z, ox: (R.uiW - ROOM.w * PX * z) / 2, oy: 4 }; }
  render(ctx) {
    const R = G.renderer, U = G.ui, V = this.view(R), b = this.body, t = (s) => G.i18n.t(s); if (G.xp) { G.xp.rawFill = true; G.xp.rawInk = true; }
    R.ctx.setTransform(R.uiScale, 0, 0, R.uiScale, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#1c1c20'; ctx.fillRect(0, 0, R.uiW, R.uiH);
    ctx.save(); ctx.translate(V.ox, V.oy); ctx.scale(V.z, V.z);
    ctx.fillStyle = '#6a665e'; ctx.fillRect(0, 0, ROOM.w * PX, ROOM.h * PX); ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= ROOM.w; i++) { ctx.beginPath(); ctx.moveTo(i * PX, 0); ctx.lineTo(i * PX, ROOM.h * PX); ctx.stroke(); } for (let j = 0; j <= ROOM.h; j++) { ctx.beginPath(); ctx.moveTo(0, j * PX); ctx.lineTo(ROOM.w * PX, j * PX); ctx.stroke(); }
    G.bodyView.draw(ctx, b, G.hd.get(this.game.player.sheet).L, this.game.player);
    for (const f of this.flash) { const q = proj(b, [f.x, f.y, f.z], 0, 0); ctx.fillStyle = `rgba(255,220,120,${(f.t * 3).toFixed(2)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 6.3); ctx.fill(); }
    ctx.restore();
    const y = R.uiH - 62, col = '#e8e4d8', dim = '#a8a498', c = b.com(); U.text(ctx, 'Physics test', 8, y, { size: 9, color: col });
    U.text(ctx, `${t('State')}: ${t(STATE[b.state])}   ${t('Speed')}: ${Math.hypot(c.vx, c.vy, c.vz).toFixed(1)} m/s   ${t('Muscle tone')}: ${Math.round(b.tone * 100)}%   ${t('Legs')}: ${Math.round(b.limb.legL * 100)}/${Math.round(b.limb.legR * 100)}%`, 8, y + 11, { size: 8, color: dim });
    if (this.last) U.text(ctx, this.last, 8, y + 21, { size: 8, color: '#f0c070' });
    Object.keys(SHOTS).forEach((k, i) => U.text(ctx, `${k.slice(-1)} ${t(SHOTS[k][0])}`, 8 + (i % 5) * (R.uiW - 16) / 5, y + 32 + Math.floor(i / 5) * 9, { size: 6, color: dim }));
    U.text(ctx, `${t('Click: punch there')}   Q: ${t('other side')}   S: ${t('slow motion')}${this.slow ? ' (x1/4)' : ''}   R: ${t('reset')}   Esc: ${t('leave')}`, 8, y + 52, { size: 6, color: dim });
  }
}
const STATE = { stand: 'Standing', fall: 'Falling', down: 'Down', getup: 'Getting up' };
G.PhysTestScene = PhysTestScene;
if (G.LANG_PT && G.LANG_PT.s) Object.assign(G.LANG_PT.s, {
  'Physics test': 'Teste de física', 'Physics test (one body)': 'Teste de física (um corpo)', State: 'Estado', Speed: 'Velocidade', 'Muscle tone': 'Tônus muscular', Legs: 'Pernas', Standing: 'De pé', Falling: 'Caindo', Down: 'No chão', 'Getting up': 'Levantando',
  'Shove in the chest': 'Empurrão no peito', 'Hard shove': 'Empurrão forte', 'Punch to the head': 'Soco na cabeça', 'Knockout punch': 'Soco de nocaute', 'Punch to the left shoulder': 'Soco no ombro esquerdo', 'Punch to the right shoulder': 'Soco no ombro direito', 'Gunshot in the left knee': 'Tiro no joelho esquerdo', 'Gunshot in the belly': 'Tiro na barriga', 'Stab in the right thigh': 'Facada na coxa direita', 'Drop from 4 m': 'Queda de 4 m',
  'Click: punch there': 'Clique: soco ali', 'other side': 'outro lado', 'slow motion': 'câmera lenta', reset: 'reiniciar', leave: 'sair',
});
})();
