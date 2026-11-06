'use strict';
// The phone, looking like a phone: a rounded body with a metal edge and side buttons, the screen running
// edge to edge under a camera notch, a real status bar (signal by area, Wi-Fi indoors, a battery that drains
// through the day), a home indicator, apps with their own colored header, and list rows as rounded cards.
// Wallpapers: the Wallpapers app picks the home screen picture: a set of built-in ones, or your own. Put
// PNG/JPG/WEBP/GIF/BMP pictures in the "wallpapers" folder next to Unholium.exe (the desktop app creates it);
// the app lists them (it looks again every time you open it) and fits them to the screen. The choice is
// kept in the settings (all saves).
(() => {
const U = G.ui, PS = G.PhoneScene.prototype, APPS = G.PHONE_APP_LIST, TAU = Math.PI * 2;
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
if (!APPS.some((a) => a[0] === 'wallpapers')) { const at = APPS.findIndex((a) => a[0] === 'settings'); APPS.splice(at < 0 ? APPS.length : at + 1, 0, ['wallpapers', 'Wallpapers', '#a8745a', 'W']); }
const ACCENT = { maps: '#8b8477', contacts: '#989692', contact: '#989692', compose: '#5c8463', messages: '#5c8463', thread: '#5c8463', bct: '#bebab4', lifelog: '#bb8b5f', relations: '#bb8b5f', effects: '#bb8b5f', legal: '#bb8b5f', notes: '#bb8b5f', attributes: '#bb8b5f', news: '#ac6666', clock: '#767574', wallpapers: '#b4815e' };

// ---------------------------------------------------------------- wallpapers
const BUILTIN = [
  ['city', 'Night City'], ['dusk', 'Dusk'], ['ocean', 'Ocean'], ['neon', 'Neon'], ['forest', 'Pines'], ['bloom', 'Bloom'], ['mono', 'Graphite'],
];
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
function paint(id, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), R = seeded(id.length * 7919 + id.charCodeAt(0));
  const grad = (stops) => { const g = x.createLinearGradient(0, 0, 0, H); stops.forEach(([k, col]) => g.addColorStop(k, col)); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  const glow = (cx, cy, r, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  const ridge = (base, amp, col, rough) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo(t * W, base - Math.abs(Math.sin(t * 7 + amp) * amp * 0.6 + Math.sin(t * 17 + amp * 3) * amp * 0.25 * rough) - amp * 0.3); } x.lineTo(W, H); x.fill(); };
  switch (id) {
    case 'city': {
      grad([[0, '#181716'], [0.55, '#393733'], [0.8, '#4b4947'], [1, '#181818']]);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; x.fillRect(R() * W, R() * H * 0.5, 1, 1); }
      glow(W * 0.75, H * 0.2, W * 0.25, 'rgba(209,203,186,0.25)'); x.fillStyle = '#d3cbb9'; x.beginPath(); x.arc(W * 0.75, H * 0.2, W * 0.07, 0, TAU); x.fill();
      glow(W * 0.5, H * 0.8, W * 0.9, 'rgba(216,141,119,0.25)');
      for (let layer = 0; layer < 2; layer++) {
        let bx = -5; const base = H * (layer ? 0.86 : 0.78), col = layer ? '#0b0b0a' : '#242220';
        while (bx < W) {
          const bw = 10 + R() * 22, bh = H * (0.12 + R() * (layer ? 0.28 : 0.4));
          x.fillStyle = col; x.fillRect(bx, base - bh, bw, H - base + bh);
          for (let wy = base - bh + 4; wy < H - 6; wy += 5) for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) if (R() < (layer ? 0.32 : 0.18)) { x.fillStyle = R() < 0.8 ? 'rgba(217,192,142,0.85)' : 'rgba(217,214,208,0.8)'; x.fillRect(wx, wy, 2, 2); }
          bx += bw + 1;
        }
      }
      break;
    }
    case 'dusk': {
      grad([[0, '#3c3a38'], [0.4, '#9a788f'], [0.65, '#ce997c'], [1, '#d4bd91']]);
      glow(W * 0.5, H * 0.66, W * 0.6, 'rgba(220,198,150,0.55)');
      x.fillStyle = '#dec99d'; x.beginPath(); x.arc(W * 0.5, H * 0.66, W * 0.13, 0, TAU); x.fill();
      ridge(H * 0.72, 24, 'rgba(97,95,93,0.85)', 1); ridge(H * 0.8, 18, 'rgba(56,55,54,0.92)', 1.4); ridge(H * 0.9, 12, '#1f2120', 2);
      break;
    }
    case 'ocean': {
      grad([[0, '#c3beb7'], [0.45, '#eae8e6'], [0.47, '#746f66'], [1, '#312e29']]);
      glow(W * 0.3, H * 0.3, W * 0.4, 'rgba(231,218,183,0.6)');
      for (let i = 0; i < 26; i++) { const y = H * 0.48 + i * i * 0.45; x.strokeStyle = `rgba(255,255,255,${0.25 - i * 0.008})`; x.lineWidth = 1 + i * 0.05; x.beginPath(); for (let k = 0; k <= W; k += 4) x.lineTo(k, y + Math.sin(k * 0.08 + i) * (1 + i * 0.15)); x.stroke(); }
      break;
    }
    case 'neon': {
      grad([[0, '#100f0e'], [1, '#1c161b']]);
      glow(W * 0.2, H * 0.25, W * 0.9, 'rgba(213,209,202,0.45)'); glow(W * 0.85, H * 0.75, W * 0.9, 'rgba(142,131,113,0.4)');
      x.lineWidth = 2; for (let i = 0; i < 7; i++) { x.strokeStyle = i % 2 ? 'rgba(142,131,113,0.55)' : 'rgba(226,223,219,0.55)'; x.beginPath(); x.moveTo(-20, H * (0.15 + i * 0.13)); x.lineTo(W + 20, H * (0.05 + i * 0.13) + W * 0.35); x.stroke(); }
      break;
    }
    case 'forest': {
      grad([[0, '#d3d9d7'], [0.5, '#939291'], [1, '#2f2b2c']]);
      for (let layer = 0; layer < 4; layer++) {
        const base = H * (0.45 + layer * 0.15), col = ['rgba(108,102,108,0.5)', 'rgba(78,72,78,0.7)', 'rgba(49,45,45,0.85)', '#1d1b1b'][layer], s = 0.6 + layer * 0.35;
        for (let px = -10; px < W + 10; px += 9 * s + R() * 8) { const h = (30 + R() * 30) * s; x.fillStyle = col; x.beginPath(); x.moveTo(px, base - h); x.lineTo(px - 7 * s, base); x.lineTo(px + 7 * s, base); x.fill(); x.fillRect(px - 1, base, 2, 6); }
        x.fillStyle = col; x.fillRect(0, base, W, H - base);
        glow(W * 0.5, base, W, 'rgba(238,238,237,0.12)');   // fog between the rows
      }
      break;
    }
    case 'bloom': {
      grad([[0, '#262524'], [1, '#363534']]);
      for (const [cx, cy, r, col] of [[0.25, 0.3, 0.7, 'rgba(218,144,127,0.65)'], [0.8, 0.45, 0.7, 'rgba(195,189,180,0.6)'], [0.45, 0.75, 0.8, 'rgba(209,178,117,0.5)'], [0.7, 0.1, 0.5, 'rgba(236,189,233,0.5)']]) glow(W * cx, H * cy, W * r, col);
      break;
    }
    default: grad([[0, '#31302f'], [1, '#151515']]); glow(W * 0.3, H * 0.2, W * 0.8, 'rgba(255,255,255,0.08)');
  }
  return c;
}
const cache = {};
G.wallpapers = {
  BUILTIN, custom: [],
  base: 'https://wallpapers.local/',
  current() { return G.settings.get('phoneWallpaper') || 'builtin:city'; },
  choose(id) { G.settings.set('phoneWallpaper', id); },
  entries() { return BUILTIN.map(([id, name]) => ({ id: 'builtin:' + id, name })).concat(this.custom.map((c) => ({ id: 'file:' + c.name, name: c.name.replace(/\.[a-z0-9]+$/i, ''), entry: c }))); },
  image(id, W, H) {
    if (id && id.startsWith('file:')) { const c = this.custom.find((e) => e.name === id.slice(5)); if (c && c.ok) return c.img; if (!c) this.scan(); return null; }
    const b = (id || '').startsWith('builtin:') ? id.slice(8) : 'city', k = b + ':' + W + 'x' + H;
    return cache[k] || (cache[k] = paint(b, W, H));
  },
  // a picture fitted to the screen: cover (fill it, crop what is left over), centered
  draw(ctx, id, x, y, w, h) {
    const img = this.image(id, Math.round(w * 2), Math.round(h * 2)) || this.image('builtin:city', Math.round(w * 2), Math.round(h * 2));
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.max(w / iw, h / ih), dw = iw * k, dh = ih * k;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.imageSmoothingEnabled = sm;
  },
  // the folder next to the exe (desktop app): ask the host to list it again, then load what is new
  scan() {
    if (!G.desktop || this.scanning) return;
    this.scanning = true;
    if (!this.listening) { this.listening = true; window.chrome.webview.addEventListener('message', (e) => { if (e.data === 'wallpapers:ready') this.fetchList(); }); }
    G.platform.post('wallpapers:scan');
    setTimeout(() => { if (this.scanning) this.fetchList(); }, 1500);   // (an older host never answers: read what is there)
  },
  async fetchList() {
    this.scanning = false;
    let names = [];
    try { const r = await fetch(this.base + 'index.json', { cache: 'no-store' }); if (r.ok) names = ((await r.json()).images || []).filter(Boolean); } catch (e) { return; }
    this.custom = this.custom.filter((c) => names.includes(c.name));
    for (const name of names) if (!this.custom.some((c) => c.name === name)) this.load(name);
  },
  async load(name) {
    const e = { name, ok: false, img: null }; this.custom.push(e);
    try {
      // (read as a blob so the picture is same-origin: drawing it never taints the game canvas)
      const r = await fetch(this.base + encodeURIComponent(name), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const url = URL.createObjectURL(await r.blob()), img = new Image();
      img.onload = () => { e.ok = true; }; img.onerror = () => { this.custom = this.custom.filter((c) => c !== e); };
      img.src = url; e.img = img;
    } catch (err) { this.custom = this.custom.filter((c) => c !== e); }
  },
};

// ---------------------------------------------------------------- the body, the screen, the status bar
function battery(w) { return Math.round(G.util.clamp(100 - (((w.minutes - 420) + 1440) % 1440) / 1440 * 88, 9, 100)); }   // full in the morning, low by night
function signal(scene) { const r = scene.region, id = scene.map.id; return /^wilds_/.test(id) ? 1 : ['rural', 'farmland'].includes(id) ? 2 : ['forest', 'island'].includes(r) || ['forest', 'island'].includes(id) ? 1 : id === 'jail' ? 0 : 4; }
PS.drawFrame = function (ctx, px, py, PW, PH, sx, sy, SW, SH) {
  const w = this.w, g = this.game, home = this.screen === 'home';
  this.accent = ACCENT[this.screen] || '#c4beb5';
  ctx.save();
  // the body: a soft shadow, the metal band, the black glass
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rr(ctx, px - 3, py - 3, PW + 6, PH + 6, 26); ctx.fillStyle = '#2a2a2a'; ctx.fill();
  ctx.shadowColor = 'transparent';
  const band = ctx.createLinearGradient(px - 3, 0, px + PW + 3, 0); band.addColorStop(0, '#626160'); band.addColorStop(0.08, '#2e2e2e'); band.addColorStop(0.92, '#2e2e2e'); band.addColorStop(1, '#626160');
  ctx.strokeStyle = band; ctx.lineWidth = 2; rr(ctx, px - 2, py - 2, PW + 4, PH + 4, 25); ctx.stroke();
  ctx.fillStyle = '#403f3e'; ctx.fillRect(px - 4, py + 70, 2, 26); ctx.fillRect(px - 4, py + 104, 2, 26); ctx.fillRect(px + PW + 2, py + 86, 2, 38);   // volume, power
  rr(ctx, px, py, PW, PH, 23); ctx.fillStyle = '#060605'; ctx.fill();
  // the screen, edge to edge
  const X = px + 5, Y = py + 5, W = PW - 10, H = PH - 10;
  rr(ctx, X, Y, W, H, 19); ctx.clip();
  if (home) {
    G.wallpapers.draw(ctx, G.wallpapers.current(), X, Y, W, H);
    const sh = ctx.createLinearGradient(0, Y, 0, Y + H); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.25, 'rgba(0,0,0,0.05)'); sh.addColorStop(0.75, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = sh; ctx.fillRect(X, Y, W, H);   // (the clock and the labels stay readable on any picture)
  } else {
    const bg = ctx.createLinearGradient(0, Y, 0, Y + H); bg.addColorStop(0, '#181716'); bg.addColorStop(1, '#0f0f0e'); ctx.fillStyle = bg; ctx.fillRect(X, Y, W, H);
    // the app's header: its color, fading down
    const hd = ctx.createLinearGradient(0, Y, 0, sy + 20); hd.addColorStop(0, this.accent); hd.addColorStop(1, G.assets.shade(this.accent, 0.55)); ctx.globalAlpha = 0.85; ctx.fillStyle = hd; ctx.fillRect(X, Y, W, sy + 20 - Y); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X, sy + 20, W, 1);
  }
  // the camera notch
  rr(ctx, px + PW / 2 - 19, Y + 3, 38, 11, 5.5); ctx.fillStyle = '#000000'; ctx.fill();
  ctx.fillStyle = '#2a2926'; ctx.beginPath(); ctx.arc(px + PW / 2 + 11, Y + 8.5, 2.2, 0, TAU); ctx.fill();
  // the status bar
  U.text(ctx, w.timeString, X + 14, Y + 4, { size: 8, weight: 'bold' });
  let rx = X + W - 12;
  const bat = battery(w), bw = 14;
  rx -= bw; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; rr(ctx, rx + 0.5, Y + 5.5, bw, 7, 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(rx + bw + 1, Y + 7.5, 1.5, 3);
  ctx.fillStyle = bat <= 20 ? '#d36f66' : '#ffffff'; ctx.fillRect(rx + 2, Y + 7, Math.max(1, (bw - 3) * bat / 100), 4);
  U.text(ctx, bat + '%', rx - 2, Y + 4.5, { size: 6, align: 'right', color: '#ececec' });
  rx -= 22;
  if (g && g.player && g.map && g.map.buildingAt(g.player.x, g.player.y - 3)) {   // Wi-Fi indoors
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(rx - 4, Y + 12, k * 2.4, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke(); }
    rx -= 12;
  }
  const bars = g && g.map ? signal(g) : 4;
  for (let k = 0; k < 4; k++) { ctx.fillStyle = k < bars ? '#ffffff' : 'rgba(255,255,255,0.3)'; ctx.fillRect(rx - 14 + k * 3.5, Y + 12 - (k + 1) * 1.8, 2.4, (k + 1) * 1.8); }
  if (!bars) U.text(ctx, 'SOS', rx - 18, Y + 4.5, { size: 6, align: 'right', color: '#eabeb5' });
  // the home indicator
  rr(ctx, px + PW / 2 - 30, Y + H - 7, 60, 3, 1.5); ctx.fillStyle = home ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------- the Wallpapers app
const geo = () => { const R = G.renderer, PW = 196, PH = 340, px = (R.uiW - PW) / 2, py = (R.uiH - PH) / 2; return { px, py, PW, PH, sx: px + 8, sy: py + 22, SW: PW - 16, SH: PH - 44 }; };
const COLS = 3;
const _launch = PS.launch;
PS.launch = function (app) { if (app === 'wallpapers') { G.wallpapers.scan(); G.audio.play('confirm'); this.open('wallpapers'); const all = G.wallpapers.entries(); this.sel = Math.max(0, all.findIndex((e) => e.id === G.wallpapers.current())); return; } return _launch.apply(this, arguments); };
const _upd = PS.update;
PS.update = function () {
  if (this.screen !== 'wallpapers') return _upd.apply(this, arguments);
  const I = G.input, n = G.wallpapers.entries().length;
  if (I.wasPressed('cancel') || I.wasPressed('phone')) { G.audio.play('back'); if (I.wasPressed('phone')) G.scenes.remove(this); else this.back(); return; }
  const go = (s) => { this.sel = G.util.clamp(s, 0, n - 1); G.audio.play('select'); };
  if (I.wasPressed('left')) go(this.sel - 1);
  if (I.wasPressed('right')) go(this.sel + 1);
  if (I.wasPressed('up')) go(this.sel - COLS);
  if (I.wasPressed('down')) go(this.sel + COLS);
  if (I.wasPressed('confirm')) { const e = G.wallpapers.entries()[this.sel]; if (e) { G.wallpapers.choose(e.id); G.audio.play('confirm'); this.game.toast(`Wallpaper: ${e.name}.`); } }
};
const _render = PS.render;
PS.render = function (ctx) {
  if (this.screen !== 'wallpapers') return _render.apply(this, arguments);
  const top = G.scenes.top(); if (top !== this && top.inPhone) return;
  U.dim(ctx, 0.45);
  const g = geo(), m = G.input.mouse, all = G.wallpapers.entries(), cur = G.wallpapers.current();
  this.drawFrame(ctx, g.px, g.py, g.PW, g.PH, g.sx, g.sy, g.SW, g.SH);
  U.text(ctx, '‹ Wallpapers', g.sx + 6, g.sy + 5, { size: 10, weight: 'bold' });
  if (U.inRect(m.ux, m.uy, g.sx, g.sy, 60, 16) && m.pressed) { this.back(); return; }
  const gx = g.sx + 6, gy = g.sy + 26, tw = Math.floor((g.SW - 12 - (COLS - 1) * 6) / COLS), th = Math.round(tw * (g.PH - 10) / (g.PW - 10)), rowH = th + 16;
  const listH = g.SH - 26 - 40, visRows = Math.max(1, Math.floor(listH / rowH)), rows = Math.ceil(all.length / COLS);
  this.sel = G.util.clamp(this.sel || 0, 0, Math.max(0, all.length - 1));
  const selRow = Math.floor(this.sel / COLS);
  this.wScroll = G.util.clamp(this.wScroll || 0, Math.max(0, selRow - visRows + 1), selRow);
  if (m.wheel && U.inRect(m.ux, m.uy, g.sx, gy, g.SW, listH)) this.wScroll = G.util.clamp(this.wScroll + Math.sign(m.wheel), 0, Math.max(0, rows - visRows));
  ctx.save(); ctx.beginPath(); ctx.rect(g.sx, gy - 2, g.SW, visRows * rowH + 2); ctx.clip();
  all.forEach((e, i) => {
    const r = Math.floor(i / COLS) - this.wScroll, c = i % COLS; if (r < 0 || r >= visRows) return;
    const x = gx + c * (tw + 6), y = gy + r * rowH, hover = U.inRect(m.ux, m.uy, x, y, tw, th);
    if (hover && m.moved) this.sel = i;
    if (hover && m.pressed) { this.sel = i; G.wallpapers.choose(e.id); G.audio.play('confirm'); this.game.toast(`Wallpaper: ${e.name}.`); }
    ctx.save(); rr(ctx, x, y, tw, th, 6); ctx.clip();
    if (e.entry && !e.entry.ok) { ctx.fillStyle = '#2a2928'; ctx.fillRect(x, y, tw, th); U.text(ctx, 'Loading...', x + tw / 2, y + th / 2 - 4, { size: 6, align: 'center', color: '#969594' }); }
    else G.wallpapers.draw(ctx, e.id, x, y, tw, th);
    ctx.restore();
    ctx.lineWidth = this.sel === i ? 2 : 1; ctx.strokeStyle = this.sel === i ? '#ffffff' : 'rgba(255,255,255,0.2)'; rr(ctx, x, y, tw, th, 6); ctx.stroke(); ctx.lineWidth = 1;
    if (e.id === cur) { ctx.fillStyle = '#a79f92'; ctx.beginPath(); ctx.arc(x + tw - 7, y + 7, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + tw - 9.5, y + 7); ctx.lineTo(x + tw - 7.5, y + 9); ctx.lineTo(x + tw - 4.5, y + 5); ctx.stroke(); ctx.lineWidth = 1; }
    const name = U.measure(ctx, e.name, 6) > tw ? e.name.slice(0, 11) + '…' : e.name;
    U.text(ctx, name, x + tw / 2, y + th + 3, { size: 6, align: 'center', color: e.id === cur ? '#d2cec7' : '#d1d0cf' });
  });
  ctx.restore();
  if (rows > visRows) { const bh = (visRows / rows) * visRows * rowH, by = gy + (this.wScroll / Math.max(1, rows - visRows)) * (visRows * rowH - bh); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(g.sx + g.SW - 3, gy, 2, visRows * rowH); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(g.sx + g.SW - 3, by, 2, bh); }
  // where your own pictures go
  const iy = g.sy + g.SH - 36;
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, g.sx + 4, iy, g.SW - 8, 32, 6); ctx.fill();
  const lines = U.wrap(ctx, G.desktop ? `Your own pictures: put them in the "wallpapers" folder next to Unholium.exe.${G.wallpapers.custom.length ? '' : ' None there yet.'}` : 'Your own pictures: put them in the "wallpapers" folder next to Unholium.exe (desktop app).', g.SW - 18, 6);
  lines.slice(0, 3).forEach((l, k) => U.text(ctx, l, g.sx + 9, iy + 4 + k * 8, { size: 6, color: '#b5b4b3' }));
};
// its icon: a landscape picture with a sun
const _icon = G.phoneIcon;
G.phoneIcon = function (ctx, id, x, y, col, glyph) {
  if (id !== 'wallpapers') return _icon.apply(this, arguments);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + 40); g.addColorStop(0, '#dfb390'); g.addColorStop(1, '#c09aba'); ctx.fillStyle = g; rr(ctx, x, y, 40, 40, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 1, y + 1, 38, 18, 8); ctx.fill();
  ctx.fillStyle = '#ffffff'; rr(ctx, x + 7, y + 9, 26, 22, 3); ctx.fill();
  ctx.save(); rr(ctx, x + 9, y + 11, 22, 18, 2); ctx.clip();
  const s = ctx.createLinearGradient(0, y + 11, 0, y + 29); s.addColorStop(0, '#b4afa6'); s.addColorStop(1, '#e7e4e0'); ctx.fillStyle = s; ctx.fillRect(x + 9, y + 11, 22, 18);
  ctx.fillStyle = '#cfb16f'; ctx.beginPath(); ctx.arc(x + 25, y + 16, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5d7763'; ctx.beginPath(); ctx.moveTo(x + 9, y + 29); ctx.lineTo(x + 16, y + 19); ctx.lineTo(x + 22, y + 26); ctx.lineTo(x + 26, y + 22); ctx.lineTo(x + 31, y + 29); ctx.fill();
  ctx.restore(); ctx.restore();
};
// a chosen picture of your own is loaded as soon as the game starts
if (G.desktop && (G.settings.get('phoneWallpaper') || '').startsWith('file:')) setTimeout(() => G.wallpapers.scan(), 500);
})();
