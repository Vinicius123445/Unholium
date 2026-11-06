'use strict';
// The phone's home screen, like a real one.
//   Pages: nine apps to a page (three by three); arrow keys move across the edge of a page onto the next one,
//   a drag with the mouse (or the wheel) swipes between pages, the dots at the bottom show where you are.
//   Icons: every app has its own drawn icon (a map with a pin, a speech bubble, a gear, a clock showing the
//   time...), not a letter on a square.
//   Flashlight: a toggle. On, the phone's LED lights a small cool pool around you at night (js/game/visuals.js,
//   js/scenes/game.js); it stays on until you switch it off.
(() => {
const U = G.ui, PS = G.PhoneScene.prototype, APPS = G.PHONE_APP_LIST;
const PER = 9, COLS = 3, TAU = Math.PI * 2;
if (!APPS.some((a) => a[0] === 'flashlight')) { const at = APPS.findIndex((a) => a[0] === 'clock'); APPS.splice(at < 0 ? APPS.length : at + 1, 0, ['flashlight', 'Flashlight', '#302f2e', 'F']); }
const pages = () => Math.max(1, Math.ceil(APPS.length / PER));
const geo = () => { const R = G.renderer, PW = 196, PH = 340, px = (R.uiW - PW) / 2, py = (R.uiH - PH) / 2; return { px, py, sx: px + 8, sy: py + 22, SW: PW - 16, SH: PH - 44 }; };
const slot = (i, g, ox) => { const k = i % PER; return { x: g.sx + 14 + (k % COLS) * 58 + ox, y: g.sy + 70 + Math.floor(k / COLS) * 62 }; };

// ---------------------------------------------------------------- the icons
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const tile = (ctx, x, y, top, bot) => { const g = ctx.createLinearGradient(0, y, 0, y + 40); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; rr(ctx, x, y, 40, 40, 9); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 1, y + 1, 38, 18, 8); ctx.fill(); };
const ICON = {
  maps(ctx, x, y) {
    tile(ctx, x, y, '#e1e5df', '#bdc3bd');
    ctx.fillStyle = '#d0cdc8'; ctx.beginPath(); ctx.moveTo(x + 26, y + 40); ctx.quadraticCurveTo(x + 30, y + 22, x + 40, y + 18); ctx.lineTo(x + 40, y + 40); ctx.fill();   // water
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x + 40, y + 12); ctx.moveTo(x + 14, y); ctx.lineTo(x + 20, y + 40); ctx.stroke();
    ctx.strokeStyle = '#c4a86c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x + 40, y + 12); ctx.stroke();
    ctx.fillStyle = '#b85d58'; ctx.beginPath(); ctx.arc(x + 27, y + 15, 6, Math.PI, 0); ctx.lineTo(x + 27, y + 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 27, y + 15, 2.3, 0, TAU); ctx.fill();
  },
  contacts(ctx, x, y) {
    tile(ctx, x, y, '#929190', '#626160');
    ctx.fillStyle = '#ebebeb'; ctx.beginPath(); ctx.arc(x + 20, y + 15, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 20, y + 33, 13, 9, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#cecdcc'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 35, y + 8 + i * 8, 3, 5);   // the alphabet tabs
  },
  messages(ctx, x, y) {
    tile(ctx, x, y, '#62665e', '#5c8463');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + 20, y + 18, 13, 10, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 11, y + 24); ctx.lineTo(x + 8, y + 32); ctx.lineTo(x + 17, y + 27); ctx.fill();
    ctx.fillStyle = '#5c8463'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + 20 + i * 5, y + 18, 1.6, 0, TAU); ctx.fill(); }
  },
  bct(ctx, x, y) {
    tile(ctx, x, y, '#c5c2bd', '#85827d');
    ctx.fillStyle = '#f8f7f6'; rr(ctx, x + 9, y + 12, 22, 17, 5); ctx.fill();
    ctx.strokeStyle = '#f8f7f6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 20, y + 12); ctx.lineTo(x + 20, y + 6); ctx.stroke();
    ctx.fillStyle = '#d0b373'; ctx.beginPath(); ctx.arc(x + 20, y + 6, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#85827d'; ctx.fillRect(x + 13, y + 17, 4, 4); ctx.fillRect(x + 23, y + 17, 4, 4);
    ctx.fillRect(x + 15, y + 24, 10, 1.5);
    ctx.fillStyle = '#d0b373'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('?', x + 30, y + 35);   // (it has opinions)
  },
  lifelog(ctx, x, y) {
    tile(ctx, x, y, '#c8aa77', '#a26f46');
    ctx.fillStyle = '#e6d5b5'; rr(ctx, x + 8, y + 8, 24, 26, 3); ctx.fill();
    ctx.strokeStyle = '#b45e5e'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(x + 10, y + 22); ctx.lineTo(x + 15, y + 22); ctx.lineTo(x + 17, y + 15); ctx.lineTo(x + 20, y + 28); ctx.lineTo(x + 23, y + 19); ctx.lineTo(x + 25, y + 22); ctx.lineTo(x + 30, y + 22); ctx.stroke();
    ctx.fillStyle = '#caba9c'; ctx.fillRect(x + 11, y + 11, 12, 1.5);
  },
  news(ctx, x, y) {
    tile(ctx, x, y, '#b86a6a', '#7f3d3d');
    ctx.fillStyle = '#d6cfc1'; ctx.save(); ctx.translate(x + 20, y + 21); ctx.rotate(-0.12); ctx.fillRect(-13, -12, 26, 24);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-11, -10, 22, 4);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(-11, -3, 9, 8); for (let i = 0; i < 4; i++) ctx.fillRect(0, -3 + i * 2.5, 11, 1);
    for (let i = 0; i < 2; i++) ctx.fillRect(-11, 7 + i * 2.5, 22, 1);
    ctx.restore();
  },
  settings(ctx, x, y) {
    tile(ctx, x, y, '#908f8e', '#5a5a59');
    ctx.fillStyle = '#e7e7e7'; ctx.save(); ctx.translate(x + 20, y + 20);
    for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillRect(-2.5, -14, 5, 6); }
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#747372'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill(); ctx.restore();
  },
  clock(ctx, x, y) {
    tile(ctx, x, y, '#303030', '#191919');
    ctx.fillStyle = '#f5f5f5'; ctx.beginPath(); ctx.arc(x + 20, y + 20, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#303030'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillRect(x + 20 + Math.cos(a) * 11.5 - 0.6, y + 20 + Math.sin(a) * 11.5 - 0.6, 1.2, 1.2); }
    const w = G.world, h = w ? w.hourF : 10;   // the real (game) time
    const hand = (a, len, wd, col) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 20, y + 20); ctx.lineTo(x + 20 + Math.cos(a) * len, y + 20 + Math.sin(a) * len); ctx.stroke(); };
    hand((h % 12) / 12 * TAU - Math.PI / 2, 7, 2, '#303030'); hand((h % 1) * TAU - Math.PI / 2, 10, 1.2, '#303030');
    ctx.fillStyle = '#c18161'; ctx.beginPath(); ctx.arc(x + 20, y + 20, 1.6, 0, TAU); ctx.fill();
  },
  flashlight(ctx, x, y, on) {
    tile(ctx, x, y, on ? '#46443e' : '#343332', on ? '#22211e' : '#1b1b1b');
    if (on) { const g = ctx.createRadialGradient(x + 26, y + 14, 1, x + 26, y + 14, 18); g.addColorStop(0, 'rgba(227,210,171,0.95)'); g.addColorStop(1, 'rgba(227,210,171,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + 22, y + 18); ctx.lineTo(x + 40, y + 0); ctx.lineTo(x + 40, y + 22); ctx.closePath(); ctx.fill(); }
    ctx.save(); ctx.translate(x + 18, y + 22); ctx.rotate(-0.75);
    ctx.fillStyle = '#cfcecd'; rr(ctx, -4, -2, 8, 18, 2); ctx.fill();
    ctx.fillStyle = '#eae9e8'; ctx.fillRect(-6, -8, 12, 7);
    ctx.fillStyle = on ? '#e2d0a7' : '#767574'; ctx.fillRect(-5, -9, 10, 2);
    ctx.fillStyle = on ? '#85ad93' : '#908f8e'; ctx.fillRect(-1.5, 3, 3, 4);   // the switch
    ctx.restore();
  },
  luckystrike(ctx, x, y) {
    tile(ctx, x, y, '#d39fbf', '#8e6482');
    ctx.fillStyle = '#d0b473'; ctx.font = 'bold 22px serif'; ctx.textAlign = 'center'; ctx.fillText('7', x + 20, y + 29); ctx.textAlign = 'left';
    for (const [dx, dy] of [[8, 8], [32, 8], [8, 33], [32, 33]]) { ctx.fillStyle = '#decb9d'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.5, 0, TAU); ctx.fill(); }
  },
  sportsbet(ctx, x, y) {
    tile(ctx, x, y, '#759385', '#4e625c');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 5, y + 5, 30, 30); ctx.beginPath(); ctx.moveTo(x + 20, y + 5); ctx.lineTo(x + 20, y + 35); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 20, y + 20, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU; ctx.lineTo(x + 20 + Math.cos(a) * 3.5, y + 20 + Math.sin(a) * 3.5); } ctx.fill();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU; ctx.beginPath(); ctx.arc(x + 20 + Math.cos(a) * 8, y + 20 + Math.sin(a) * 8, 1.6, 0, TAU); ctx.fill(); }
  },
  vault(ctx, x, y) {
    tile(ctx, x, y, '#8c8a88', '#5f5e5d');
    ctx.fillStyle = '#dfdedd'; rr(ctx, x + 8, y + 8, 24, 24, 3); ctx.fill();
    ctx.fillStyle = '#a3a2a1'; ctx.beginPath(); ctx.arc(x + 20, y + 20, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#535251'; ctx.lineWidth = 1.4; ctx.save(); ctx.translate(x + 20, y + 20); for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke(); } ctx.restore();
    ctx.fillStyle = '#535251'; ctx.fillRect(x + 29, y + 13, 2, 4); ctx.fillRect(x + 29, y + 23, 2, 4);
  },
};
G.phoneIcon = function (ctx, id, x, y, col, glyph) {
  ctx.save();
  if (ICON[id]) ICON[id](ctx, x, y, id === 'flashlight' && G.player && G.player.phoneLight);
  else { tile(ctx, x, y, col || '#626160', G.assets.shade(col || '#626160', 0.7)); U.text(ctx, glyph || '?', x + 20, y + 11, { size: 16, align: 'center', weight: 'bold' }); }
  ctx.restore();
};

// ---------------------------------------------------------------- the flashlight toggle
const _launch = PS.launch;
PS.launch = function (app) {
  if (app === 'flashlight') { const p = this.game.player; p.phoneLight = !p.phoneLight; G.audio.play('select'); this.game.toast(p.phoneLight ? 'Phone flashlight on.' : 'Phone flashlight off.'); return; }
  return _launch.apply(this, arguments);
};
// no phone, no light
const PL = G.Player.prototype, _pu = PL.update;
PL.update = function (dt, scene) { if (this.phoneLight && (!this.inventory.has('phone') || this.swimming)) this.phoneLight = false; return _pu.apply(this, arguments); };

// ---------------------------------------------------------------- pages: keys, swipes, clicks
const _upd = PS.update;
PS.update = function () {
  const I = G.input;
  if (this.screen !== 'home' || I.wasPressed('cancel') || I.wasPressed('phone')) return _upd.apply(this, arguments);
  const n = APPS.length, np = pages();
  this.sel = G.util.clamp(this.sel || 0, 0, n - 1);
  const pg = Math.floor(this.sel / PER), k = this.sel % PER, col = k % COLS, row = Math.floor(k / COLS);
  const go = (s) => { this.sel = G.util.clamp(s, 0, n - 1); G.audio.play('select'); };
  if (I.wasPressed('left')) { if (col > 0) go(this.sel - 1); else if (pg > 0) go((pg - 1) * PER + row * COLS + COLS - 1); }
  if (I.wasPressed('right')) { if (col < COLS - 1 && this.sel + 1 < n) go(this.sel + 1); else if (pg < np - 1) go(Math.min(n - 1, (pg + 1) * PER + row * COLS)); }
  if (I.wasPressed('up') && row > 0) go(this.sel - COLS);
  if (I.wasPressed('down') && row < 2 && this.sel + COLS < n) go(this.sel + COLS);
  if (I.wasPressed('confirm')) this.launch(APPS[this.sel][0]);
  // the mouse: drag to swipe, click to open, the wheel turns pages
  const m = I.mouse, g = geo();
  if (m.pressed && U.inRect(m.ux, m.uy, g.sx, g.sy, g.SW, g.SH)) this.drag = { x0: m.ux, y0: m.uy, page: pg };
  if (this.drag) {
    const dx = m.ux - this.drag.x0;
    this.dragDx = dx;
    if (!m.down) {
      const page = this.drag.page;
      if (dx < -24 && page < np - 1) go((page + 1) * PER);
      else if (dx > 24 && page > 0) go((page - 1) * PER);
      else if (Math.abs(dx) < 6) {   // a tap: open what is under it
        for (let i = page * PER; i < Math.min(n, (page + 1) * PER); i++) { const s = slot(i, g, 0); if (U.inRect(m.ux, m.uy, s.x, s.y, 40, 40)) { this.sel = i; this.launch(APPS[i][0]); break; } }
      }
      this.drag = null; this.dragDx = 0;
    }
  }
  if (m.wheel) { const dir = Math.sign(m.wheel); if (dir > 0 && pg < np - 1) go((pg + 1) * PER); else if (dir < 0 && pg > 0) go((pg - 1) * PER); }
};
const _render = PS.render;
PS.render = function (ctx) {
  if (this.screen !== 'home') return _render.apply(this, arguments);
  const top = G.scenes.top();
  if (top !== this && top.inPhone) return;
  // the frame, the status bar and the clock from the original; the apps are drawn here
  const keep = APPS.splice(0, APPS.length);
  try { _render.apply(this, arguments); } finally { APPS.push(...keep); }
  const g = geo(), w = this.w, m = G.input.mouse, n = APPS.length, np = pages();
  const pg = Math.floor((this.sel || 0) / PER);
  const target = -pg * g.SW + (this.drag ? this.dragDx || 0 : 0);
  this.slideX = this.slideX == null ? target : this.slideX + (target - this.slideX) * Math.min(1, (G.loop.dt || 0.016) * 14);
  ctx.save(); ctx.beginPath(); ctx.rect(g.sx, g.sy + 60, g.SW, g.SH - 60); ctx.clip();
  for (let i = 0; i < n; i++) {
    const [id, label, col, glyph] = APPS[i], p = Math.floor(i / PER), s = slot(i, g, p * g.SW + this.slideX);
    if (s.x < g.sx - 44 || s.x > g.sx + g.SW) continue;
    const hover = !this.drag && U.inRect(m.ux, m.uy, s.x, s.y, 40, 40);
    if (hover && m.moved) this.sel = i;
    G.phoneIcon(ctx, id, s.x, s.y, col, glyph);
    if (this.sel === i) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; rr(ctx, s.x - 2, s.y - 2, 44, 44, 10); ctx.stroke(); ctx.lineWidth = 1; }
    U.text(ctx, label, s.x + 20, s.y + 44, { size: 7, align: 'center' });
    const unread = id === 'messages' ? G.phone.unread(w) : 0;
    if (unread) { ctx.fillStyle = '#b85858'; ctx.beginPath(); ctx.arc(s.x + 38, s.y + 2, 6, 0, TAU); ctx.fill(); U.text(ctx, String(unread), s.x + 38, s.y - 2, { size: 7, align: 'center' }); }
  }
  ctx.restore();
  // the page dots
  if (np > 1) for (let i = 0; i < np; i++) { ctx.fillStyle = i === pg ? '#ffffff' : 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(g.sx + g.SW / 2 + (i - (np - 1) / 2) * 10, g.sy + g.SH - 10, 2.5, 0, TAU); ctx.fill(); }
  if (G.player && G.player.phoneLight) { ctx.fillStyle = '#decb9d'; ctx.beginPath(); ctx.arc(g.sx + 8, g.sy - 14, 2, 0, TAU); ctx.fill(); }   // the status bar knows the light is on
};
})();
