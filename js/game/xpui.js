'use strict';
// The Windows (2007) interface: every menu, window, list and dialog box the player opens is drawn as late-2000s
// desktop software, in the same palette as the Creation Tool (editor/editor.css): glossy blue title bars with a
// close box, pale blue-grey window faces, beveled buttons with the yellow hover glow, sunken white fields and
// list boxes, classic tabs, checkboxes, combo boxes, trackbars, segmented progress bars and old-school scrollbars.
//
// The gameplay HUD keeps its own minimalist street look: the theme is switched per scene, so GameScene (and the
// scenes that draw their own device or minigame art, like the phone) render with the old palette, and every other
// scene renders with this one. G.ui.panel / button / slot / bar / text are re-skinned in place (same sizes and
// positions, so layouts and clicks keep working); light text colors meant for dark panels are darkened ("ink").
// The bespoke screens (inventory, dialogue, shop, settings, skills, journal, menus...) are in js/game/xpscreens.js.

(() => {
const U = G.ui, R = G.renderer;
G.settings.data.uiStyle = 1;   // (the old Noir interface is gone; a save that chose it opens in this one)
G.settings.defaults.uiStyle = 1;

const NOIR = Object.assign({}, U.colors);
const XPC = {
  panel: '#e3ded2', panel2: '#ded9cd', border: '#aba9a5', borderLight: '#4e4b45', text: '#282726', dim: '#54524c',
  gold: '#5c471f', good: '#436347', bad: '#984a4b', sel: 'rgba(167,163,155,0.25)', hp: '#a85a5a', stamina: '#618368',
};
const X = G.xp = {
  on: false, scene: null, panels: 0,
  anim: !/[?&](test|shot)/.test(location.search),
  FONT: 'Tahoma, Verdana, "Segoe UI", sans-serif',
  CAPTION: '"Trebuchet MS", Tahoma, sans-serif',
  TB: 17,                       // title bar height (UI units)
  // scenes that draw their own device / minigame art keep the old look
  NOIR: new Set(['GameScene', 'WorldGameScene', 'PhoneScene', 'FadeScene', 'FishingScene', 'LockpickScene', 'DreamScene', 'DreamWorldScene', 'LoveScene', 'HotwireScene', 'EasyHotwire', 'AutoHotwire']),
  C: {
    face: '#e3ded2', face2: '#ded9cd', pane: '#e6e1d5', line: '#aba9a5', line2: '#cccbc8', field: '#9f9d99',
    text: '#282726', dim: '#54524c', head: '#4e4b45', link: '#7d766a', good: '#436347', bad: '#984a4b',
    selA: '#e0dbcf', selB: '#dad5c9', selLine: '#aaa7a1', hotA: '#e6d7b5', hotB: '#d5ba81', hotLine: '#b19762',
    cap: '#6c6860', tip: '#e5d7b1',
  },
};
X.enabled = () => true;
X.use = function (on) {
  if (on === this.on) return;
  this.on = on;
  Object.assign(U.colors, on ? XPC : NOIR);
};
X.noir = (s) => !s || s.xpNoir || X.NOIR.has(s.constructor && s.constructor.name);
X.hp = () => 1 / R.uiScale;    // one physical pixel, for bevels and hairlines

// ---------------------------------------------------------------- ink: light colors made for dark panels, darkened
const inkCache = new Map();
function parse(c) {
  if (typeof c !== 'string') return null;
  let m;
  if (c[0] === '#') {
    const h = c.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    if (h.length === 6 || h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    return null;
  }
  if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c))) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  return null;
}
function hsl2rgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
X.ink = function (c) {
  let v = inkCache.get(c);
  if (v) return v;
  v = c;
  const p = parse(c);
  if (p) {
    const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, ch = mx - mn;
    if (l > 0.5) {
      let h = 0;
      if (ch > 0) h = mx === r ? 60 * (((g - b) / ch) % 6) : mx === g ? 60 * ((b - r) / ch + 2) : 60 * ((r - g) / ch + 4);
      if (h < 0) h += 360;
      const s = ch === 0 ? 0 : ch / (1 - Math.abs(2 * l - 1));
      const [nr, ng, nb] = ch < 0.18 ? hsl2rgb(h, Math.min(0.25, s), 0.09 + (1 - l) * 0.7) : hsl2rgb(h, Math.min(0.85, s), 0.27 + (1 - l) * 0.18);
      v = p[3] < 1 ? `rgba(${nr},${ng},${nb},${Math.max(0.75, p[3])})` : `rgb(${nr},${ng},${nb})`;
    }
  }
  if (inkCache.size > 500) inkCache.clear();
  inkCache.set(c, v);
  return v;
};

// ---------------------------------------------------------------- paper: the dark row/box fills older screens draw
// themselves (rgba(33,33,33,0.85) rows, rgba(0,0,0,0.3) detail boxes, gold-brown selections) turned into the light
// list rows, panes and blue selections of this theme. Only plain fillRect on the screen canvas, only inside a themed
// window; faint shadows (alpha < 0.2), gradients and anything built off-screen (sprites) are left alone.
const paperCache = new Map();
X.paper = function (c) {
  let v = paperCache.get(c);
  if (v !== undefined) return v;
  v = c;
  const p = parse(c);
  if (p && p[3] >= 0.2) {
    const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, ch = mx - mn;
    let h = 0;
    if (ch > 0) h = mx === r ? 60 * (((g - b) / ch) % 6) : mx === g ? 60 * ((b - r) / ch + 2) : 60 * ((r - g) / ch + 4);
    if (h < 0) h += 360;
    if (l < 0.34 && ch < 0.2) v = p[3] < 0.5 ? 'rgba(255,255,255,0.6)' : p[3] < 0.999 ? '#e8e3d7' : '#dad5c9';
    else if (l < 0.42 && ch >= 0.2 && p[3] < 0.999) v = h >= 15 && h <= 70 ? '#ddd8cc' : (([a, b2, c2]) => `rgb(${a},${b2},${c2})`)(hsl2rgb(h, 0.55, 0.88));
  }
  if (paperCache.size > 500) paperCache.clear();
  paperCache.set(c, v);
  return v;
};
{
  const P = CanvasRenderingContext2D.prototype, _fr = P.fillRect;
  P.fillRect = function (x, y, w, h) {
    if (X.on && !X.rawFill && this === R.ctx && !(X.scene && X.scene.xpRawText)) {
      const fs = this.fillStyle;
      if (typeof fs === 'string') {
        const m = X.paper(fs);
        if (m !== fs) { this.fillStyle = m; _fr.call(this, x, y, w, h); this.fillStyle = fs; return; }
      }
    }
    return _fr.call(this, x, y, w, h);
  };
}

// ---------------------------------------------------------------- drawing primitives
const grads = new Map();
X.grad = function (ctx, x0, y0, x1, y1, stops) {
  const k = `${x0}|${y0}|${x1}|${y1}|${stops.join()}`;
  let g = grads.get(k);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    if (grads.size > 800) grads.clear();
    grads.set(k, g);
  }
  return g;
};
X.vgrad = (ctx, y, h, stops) => X.grad(ctx, 0, y, 0, y + h, stops);
X.rrect = function (ctx, x, y, w, h, r, top = true, bottom = true) {
  const a = top ? r : 0, b = bottom ? r : 0;
  ctx.beginPath();
  ctx.moveTo(x + a, y); ctx.lineTo(x + w - a, y); ctx.quadraticCurveTo(x + w, y, x + w, y + a);
  ctx.lineTo(x + w, y + h - b); ctx.quadraticCurveTo(x + w, y + h, x + w - b, y + h);
  ctx.lineTo(x + b, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - b);
  ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y);
  ctx.closePath();
};
X.hline = (ctx, x, y, w, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, X.hp()); };
X.vline = (ctx, x, y, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, X.hp(), h); };
// a one-pixel box: top/left in one color, bottom/right in another (raised or sunken bevels)
X.bevel = function (ctx, x, y, w, h, tl, br) {
  const p = X.hp();
  ctx.fillStyle = tl; ctx.fillRect(x, y, w, p); ctx.fillRect(x, y, p, h);
  ctx.fillStyle = br; ctx.fillRect(x, y + h - p, w, p); ctx.fillRect(x + w - p, y, p, h);
};
X.stroke = function (ctx, x, y, w, h, col) { X.bevel(ctx, x, y, w, h, col, col); };
X.txt = function (ctx, str, x, y, o = {}) { U.text(ctx, str, x, y, Object.assign({ raw: true, shadow: false, color: X.C.text }, o)); };
X.fit = function (ctx, str, maxW, size = 8, weight = 'normal') {   // cut with an ellipsis to fit
  str = G.i18n.t(String(str));
  if (U.measure(ctx, str, size, weight) <= maxW) return str;
  while (str.length > 1 && U.measure(ctx, str + '…', size, weight) > maxW) str = str.slice(0, -1);
  return str + '…';
};
X.hover = (x, y, w, h) => { const m = G.input.mouse; return U.inRect(m.ux, m.uy, x, y, w, h); };

// raised face (a plain dialog box without a caption)
X.face = function (ctx, x, y, w, h, o = {}) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = o.fill || X.vgrad(ctx, y, h, [0, '#e5e0d4', 1, '#e1dcd0']); ctx.fillRect(x, y, w, h);
  X.bevel(ctx, x, y, w, h, '#e8e3d7', '#8f8c88');
  X.bevel(ctx, x - X.hp(), y - X.hp(), w + 2 * X.hp(), h + 2 * X.hp(), '#d7d2c6', '#65625d');
};
// sunken field / list box
X.sunken = function (ctx, x, y, w, h, fill = '#e8e3d7') {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  X.stroke(ctx, x, y, w, h, X.C.field);
  X.hline(ctx, x + X.hp(), y + X.hp(), w - 2 * X.hp(), '#dfdace'); X.vline(ctx, x + X.hp(), y + X.hp(), h - 2 * X.hp(), '#dfdace');
};
// etched group box with a caption
X.group = function (ctx, x, y, w, h, title) {
  ctx.strokeStyle = '#cccbc8'; ctx.lineWidth = X.hp();
  X.rrect(ctx, x + 0.5 * X.hp(), y + 4.5, w - X.hp(), h - 4.5, 2.5); ctx.stroke();
  ctx.strokeStyle = '#e8e3d7'; X.rrect(ctx, x + 1.5 * X.hp(), y + 4.5 + X.hp(), w - 3 * X.hp(), h - 4.5 - X.hp(), 2.5); ctx.stroke();
  if (title) {
    const tw = U.measure(ctx, title, 8, 'bold') + 6;
    ctx.fillStyle = X.C.face; ctx.fillRect(x + 6, y, tw, 9);
    X.txt(ctx, title, x + 9, y, { size: 8, weight: 'bold', color: '#635e56' });
  }
};

// small drawn glyphs, in the spirit of the editor's toolbar icons
X.glyph = function (ctx, kind, x, y, s = 12) {
  const c = x + s / 2, m = y + s / 2, r = s / 2 - 0.5;
  const orb = (a, b, line) => { const g = ctx.createRadialGradient(c - r * 0.3, m - r * 0.35, 0.5, c, m, r); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, m, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = X.hp(); ctx.stroke(); };
  const mark = (t, col = '#e8e3d7', size = s * 0.78) => U.text(ctx, t, c, m + 0.5, { raw: true, shadow: false, size, weight: 'bold', align: 'center', baseline: 'middle', color: col, family: 'Tahoma, sans-serif' });
  switch (kind) {
    case 'info': orb('#d5d0c4', '#797369', '#58544c'); mark('i'); break;
    case 'question': orb('#d5d0c4', '#797369', '#58544c'); mark('?'); break;
    case 'error': orb('#eabeb5', '#a24e44', '#622d28'); mark('×', '#e8e3d7', s * 0.95); break;
    case 'good': orb('#b1b0af', '#3a3a3a', '#2a2a2a'); mark('✓', '#e8e3d7', s * 0.7); break;
    case 'warning': {
      ctx.fillStyle = X.vgrad(ctx, y, s, [0, '#dcc896', 1, '#bb994e']); ctx.beginPath(); ctx.moveTo(c, y + 0.5); ctx.lineTo(x + s - 0.5, y + s - 0.5); ctx.lineTo(x + 0.5, y + s - 0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#735a27'; ctx.lineWidth = X.hp(); ctx.stroke(); U.text(ctx, '!', c, m + s * 0.12, { raw: true, shadow: false, size: s * 0.62, weight: 'bold', align: 'center', baseline: 'middle', color: '#2c220f' }); break;
    }
    case 'app': orb('#d3cec2', '#46423b', '#37342e'); ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.arc(c + r * 0.3, m + r * 0.15, r * 0.45, 0, Math.PI * 2); ctx.fill(); break;
    case 'folder':
      ctx.fillStyle = X.vgrad(ctx, y, s, [0, '#dcc696', 1, '#c1a772']); ctx.fillRect(x + 1, y + s * 0.3, s - 2, s * 0.6);
      ctx.fillRect(x + 1, y + s * 0.18, s * 0.4, s * 0.15); X.stroke(ctx, x + 1, y + s * 0.3, s - 2, s * 0.6, '#836f48'); break;
    case 'gear': ctx.fillStyle = '#868480'; ctx.beginPath(); ctx.arc(c, m, r * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ded9cd'; ctx.beginPath(); ctx.arc(c, m, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#868480'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(c + Math.cos(a) * r * 0.85 - 1, m + Math.sin(a) * r * 0.85 - 1, 2, 2); } break;
    case 'disk': ctx.fillStyle = X.vgrad(ctx, y, s, [0, '#a09b92', 1, '#706b62']); ctx.fillRect(x + 1, y + 1, s - 2, s - 2); ctx.fillStyle = '#e4dfd3'; ctx.fillRect(x + s * 0.28, y + 1.5, s * 0.44, s * 0.32); ctx.fillStyle = '#4e4a44'; ctx.fillRect(x + s * 0.25, y + s * 0.6, s * 0.5, s * 0.3); break;
    case 'person': ctx.fillStyle = '#d4baa4'; ctx.beginPath(); ctx.arc(c, y + s * 0.32, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = X.vgrad(ctx, y + s * 0.5, s * 0.5, [0, '#a7a39b', 1, '#6c6860']); X.rrect(ctx, x + s * 0.2, y + s * 0.55, s * 0.6, s * 0.42, 2, true, false); ctx.fill(); break;
    case 'money': ctx.fillStyle = X.vgrad(ctx, y, s, [0, '#b1b0af', 1, '#3a3a3a']); ctx.fillRect(x + 0.5, y + s * 0.25, s - 1, s * 0.5); X.stroke(ctx, x + 0.5, y + s * 0.25, s - 1, s * 0.5, '#2a2a2a'); mark('$', '#1a1a1a', s * 0.5); break;
    case 'bag': ctx.fillStyle = X.vgrad(ctx, y, s, [0, '#bca987', 1, '#726042']); X.rrect(ctx, x + 1.5, y + s * 0.3, s - 3, s * 0.65, 2); ctx.fill(); ctx.strokeStyle = '#4a3e2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c, y + s * 0.32, s * 0.2, Math.PI, 0); ctx.stroke(); break;
    case 'book': ctx.fillStyle = '#6c6860'; ctx.fillRect(x + 2, y + 1, s - 4, s - 2); ctx.fillStyle = '#e8e3d7'; ctx.fillRect(x + s - 3.5, y + 2, 1.5, s - 4); ctx.fillStyle = '#d5ba81'; ctx.fillRect(x + 4, y + s * 0.3, s * 0.4, 1); break;
    default: orb('#ded9cd', '#aba9a5', '#706e6b');
  }
};

// ---------------------------------------------------------------- windows
// returns { close: clicked the close box }
X.window = function (ctx, x, y, w, h, o = {}) {
  const TB = o.tb || X.TB, active = o.active !== false, p = X.hp();
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(x + 4, y + 4, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + 2, y + 2, w, h);
  // the frame: a blue line all round with a lighter inner edge, rounded at the top
  ctx.fillStyle = active ? '#232220' : '#4a4844'; X.rrect(ctx, x, y, w, h, 4, true, false); ctx.fill();
  // title bar
  ctx.fillStyle = active ? X.vgrad(ctx, y, TB, [0, '#3c3a36', 0.5, '#2e2d2a', 0.51, '#262522', 1, '#2c2b28']) : X.vgrad(ctx, y, TB, [0, '#5a5852', 1, '#4a4844']);
  X.rrect(ctx, x + p, y + p, w - 2 * p, TB, 3.5, true, false); ctx.fill();
  ctx.fillStyle = 'rgba(255,245,225,0.08)'; ctx.fillRect(x + 3, y + p * 2, w - 6, p);
  // client area
  ctx.fillStyle = o.fill || X.vgrad(ctx, y + TB, h - TB, [0, '#e4dfd3', 1, '#e1dcd0']);
  ctx.fillRect(x + 2 * p, y + TB + p, w - 4 * p, h - TB - 3 * p);
  X.hline(ctx, x + 2 * p, y + TB + p, w - 4 * p, '#504c45');
  // icon + caption
  let tx = x + 5;
  if (o.icon !== false) {
    if (o.itemIcon) { ctx.imageSmoothingEnabled = false; ctx.drawImage(G.assets.icon(o.itemIcon), tx, y + (TB - 11) / 2, 11, 11); }
    else X.glyph(ctx, o.icon || 'app', tx, y + (TB - 11) / 2, 11);
    tx += 15;
  }
  const btnW = 15, closeX = x + w - btnW - 3;
  const title = X.fit(ctx, String(o.title || G.config.TITLE), closeX - tx - 6, 9, 'bold');
  U.text(ctx, title, tx + 0.6, y + TB / 2 + 1.1, { raw: true, shadow: false, size: 9, weight: 'bold', baseline: 'middle', color: active ? '#37342e' : 'rgba(73,71,67,0.5)', family: X.CAPTION });
  U.text(ctx, title, tx, y + TB / 2 + 0.5, { raw: true, shadow: false, size: 9, weight: 'bold', baseline: 'middle', color: active ? '#e8e3d7' : '#e3ded2', family: X.CAPTION });
  // the close box (only on the window you are using)
  let close = false;
  if (o.close) {
    const by = y + (TB - 13) / 2 + 0.5, hov = X.hover(closeX, by, btnW, 13), down = hov && G.input.mouse.down;
    ctx.fillStyle = X.vgrad(ctx, by, 13, hov ? [0, down ? '#a45a4e' : '#e6b7a9', 1, down ? '#cc9486' : '#b86956'] : [0, '#d7a799', 0.5, '#b46e5e', 1, '#a45a4e']);
    X.rrect(ctx, closeX, by, btnW, 13, 2.5); ctx.fill();
    ctx.strokeStyle = '#e8e3d7'; ctx.lineWidth = Math.max(p, 0.7); ctx.stroke();
    ctx.strokeStyle = '#e8e3d7'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
    const cx = closeX + btnW / 2, cy = by + 6.5;
    ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    if (hov && G.input.mouse.pressed) { close = true; G.input.mouse.pressed = false; }
  }
  return { close, x: x + 2 * p, y: y + TB + 2 * p, w: w - 4 * p, h: h - TB - 4 * p };
};
// closing a window from its close box: the same as pressing Escape in it
X.closeTop = function () { G.input.pressed.add('Escape'); G.audio.play('back'); };

// ---------------------------------------------------------------- controls
X.BTN = {
  normal: [0, '#e8e3d7', 0.5, '#e1dcd0', 0.51, '#dcd7cb', 1, '#e1dcd0'],
  hot: [0, '#e6d7b5', 0.5, '#ddc89a', 0.51, '#d5ba81', 1, '#dcc696'],
  down: [0, '#c9ac73', 1, '#d7bf90'],
  focus: [0, '#e6e1d5', 0.5, '#e0dbcf', 0.51, '#dbd6ca', 1, '#dfdace'],
  on: [0, '#d9c498', 1, '#cdb27a'],
  green: [0, '#ddd8cc', 0.5, '#b8b8b7', 0.51, '#9e9e9d', 1, '#c2c1c0'],
};
X.button = function (ctx, x, y, w, h, label, o = {}) {
  const m = G.input.mouse, hover = !o.disabled && U.inRect(m.ux, m.uy, x, y, w, h), down = hover && m.down;
  const st = o.disabled ? null : down ? 'down' : hover ? 'hot' : o.on ? 'on' : o.selected ? 'focus' : o.accent ? 'green' : 'normal';
  ctx.fillStyle = st ? X.vgrad(ctx, y, h, X.BTN[st]) : '#e2ddd1';
  X.rrect(ctx, x, y, w, h, Math.min(3, h / 4)); ctx.fill();
  ctx.strokeStyle = o.disabled ? '#d2cdc1' : st === 'hot' ? '#b19762' : st === 'down' || st === 'on' ? '#957d4e' : st === 'focus' ? '#7d7870' : st === 'green' ? '#655e66' : '#a6a4a1';
  ctx.lineWidth = Math.max(X.hp(), 0.6); ctx.stroke(); ctx.lineWidth = 1;
  if (st === 'focus') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; X.rrect(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(2, h / 5)); ctx.stroke(); }
  if (label) {
    const size = o.size || 9, dx = down ? 0.5 : 0;
    const tx = o.align === 'left' ? x + (o.icon || o.itemIcon ? 20 : 7) : x + w / 2;
    if (o.itemIcon) U.icon(ctx, o.itemIcon, x + 4, y + (h - 12) / 2, 0.75);
    else if (o.icon) X.glyph(ctx, o.icon, x + 5, y + (h - 11) / 2, 11);
    U.text(ctx, X.fit(ctx, label, w - (o.align === 'left' ? 12 + (o.icon || o.itemIcon ? 14 : 0) : 8), size, o.weight || 'normal'), tx + dx, y + h / 2 + 0.5 + dx, {
      raw: true, shadow: false, align: o.align || 'center', baseline: 'middle', size, weight: o.weight,
      color: o.disabled ? '#abaaa9' : o.color ? X.ink(o.color) : X.C.text,
    });
  }
  return { hover, clicked: hover && m.pressed && !o.disabled };
};
// a small button with a drawn arrow (-1 left, 1 right, -2 up, 2 down)
X.arrowButton = function (ctx, x, y, w, h, dir, o = {}) {
  const b = X.button(ctx, x, y, w, h, '', o), c = x + w / 2, m = y + h / 2, s = Math.min(w, h) * 0.2;
  ctx.fillStyle = o.disabled ? '#b8b6b4' : '#6c6a66'; ctx.beginPath();
  if (dir === -1) { ctx.moveTo(c + s * 0.6, m - s); ctx.lineTo(c + s * 0.6, m + s); ctx.lineTo(c - s * 0.7, m); }
  else if (dir === 1) { ctx.moveTo(c - s * 0.6, m - s); ctx.lineTo(c - s * 0.6, m + s); ctx.lineTo(c + s * 0.7, m); }
  else if (dir === -2) { ctx.moveTo(c - s, m + s * 0.6); ctx.lineTo(c + s, m + s * 0.6); ctx.lineTo(c, m - s * 0.7); }
  else { ctx.moveTo(c - s, m - s * 0.6); ctx.lineTo(c + s, m - s * 0.6); ctx.lineTo(c, m + s * 0.7); }
  ctx.closePath(); ctx.fill();
  return b;
};
// a list-box row (selection is the soft blue of Explorer)
X.row = function (ctx, x, y, w, h, o = {}) {
  const m = G.input.mouse, hover = U.inRect(m.ux, m.uy, x, y, w, h);
  if (o.fill !== false) { ctx.fillStyle = o.alt ? '#e6e1d5' : '#e8e3d7'; ctx.fillRect(x, y, w, h); }
  if (o.selected || (hover && !o.disabled)) {
    ctx.fillStyle = o.selected ? X.vgrad(ctx, y, h, [0, '#e2ddd1', 1, '#dad5c9']) : X.vgrad(ctx, y, h, [0, '#e6e1d5', 1, '#e1dcd0']);
    X.rrect(ctx, x + 0.5, y + 0.25, w - 1, h - 0.5, 1.5); ctx.fill();
    ctx.strokeStyle = o.selected ? '#aaa7a1' : '#d5d0c4'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
  }
  return { hover, clicked: hover && m.pressed && !o.disabled };
};
X.slot = function (ctx, x, y, s, o = {}) {
  X.sunken(ctx, x, y, s, s, o.selected ? '#e0dbcf' : '#e8e3d7');
  if (o.selected) X.stroke(ctx, x, y, s, s, '#837d73');
  else if (o.equipped) X.stroke(ctx, x, y, s, s, '#3a3a3a');
};
X.check = function (ctx, x, y, checked, label, o = {}) {
  const s = 9, w = o.w || (s + 4 + (label ? U.measure(ctx, label, o.size || 8) : 0)), h = Math.max(s, o.h || s);
  const m = G.input.mouse, hover = U.inRect(m.ux, m.uy, x, y, w, h), by = y + (h - s) / 2;
  ctx.fillStyle = X.vgrad(ctx, by, s, hover ? [0, '#e3d0aa', 1, '#c6a462'] : [0, '#c1c0bd', 1, '#e8e3d7']); ctx.fillRect(x, by, s, s);
  ctx.fillStyle = '#e8e3d7'; if (!hover) ctx.fillRect(x + 1.2, by + 1.2, s - 2.4, s - 2.4);
  X.stroke(ctx, x, by, s, s, '#544f49');
  if (checked) { ctx.strokeStyle = '#212121'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 2, by + 4.5); ctx.lineTo(x + 3.8, by + 6.6); ctx.lineTo(x + 7, by + 2.3); ctx.stroke(); ctx.lineWidth = 1; }
  if (label) X.txt(ctx, label, x + s + 4, y + h / 2 + 0.5, { size: o.size || 8, baseline: 'middle' });
  return { hover, clicked: hover && m.pressed };
};
X.radio = function (ctx, x, y, on, label, o = {}) {
  const s = 9, w = s + 4 + (label ? U.measure(ctx, label, o.size || 8) : 0);
  const m = G.input.mouse, hover = U.inRect(m.ux, m.uy, x, y, w, s);
  ctx.fillStyle = hover ? '#e3d0aa' : '#e8e3d7'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#544f49'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
  if (on) { ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, 2.2, 0, Math.PI * 2); ctx.fill(); }
  if (label) X.txt(ctx, label, x + s + 4, y + s / 2 + 0.5, { size: o.size || 8, baseline: 'middle' });
  return { hover, clicked: hover && m.pressed };
};
// combo box: a white field with the blue drop button; returns { hover, clicked }
X.combo = function (ctx, x, y, w, h, value, o = {}) {
  const m = G.input.mouse, hover = U.inRect(m.ux, m.uy, x, y, w, h);
  X.sunken(ctx, x, y, w, h, o.focus ? '#e6e1d5' : '#e8e3d7');
  if (hover) X.stroke(ctx, x, y, w, h, '#7b776f');
  X.txt(ctx, X.fit(ctx, value, w - h - 8, o.size || 8), x + 4, y + h / 2 + 0.5, { size: o.size || 8, baseline: 'middle' });
  const bx = x + w - h + 1, bw = h - 2;
  ctx.fillStyle = X.vgrad(ctx, y + 1, h - 2, hover ? [0, '#dfdace', 1, '#d3cec2'] : [0, '#dad5c9', 1, '#cbc8c3']);
  X.rrect(ctx, bx, y + 1, bw, h - 2, 1.5); ctx.fill(); ctx.strokeStyle = '#d3cec2'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#6c6a66'; ctx.beginPath(); const ax = bx + bw / 2, ay = y + h / 2; ctx.moveTo(ax - 3, ay - 1.2); ctx.lineTo(ax + 3, ay - 1.2); ctx.lineTo(ax, ay + 2); ctx.closePath(); ctx.fill();
  return { hover, clicked: hover && m.pressed };
};
// trackbar: returns the new fraction while dragged (or null)
X.track = function (ctx, x, y, w, frac, id) {
  const m = G.input.mouse, h = 12, gy = y + h / 2 - 1.5;
  X.sunken(ctx, x, gy, w, 3, '#ceccc5');
  for (let i = 0; i <= 10; i++) X.vline(ctx, x + 2 + (w - 4) * i / 10, y + h + 1, 2, '#a6a4a1');
  const tx = x + 2 + (w - 4) * G.util.clamp(frac, 0, 1), hover = U.inRect(m.ux, m.uy, x - 3, y, w + 6, h + 3);
  ctx.fillStyle = X.vgrad(ctx, y, h, hover || X.drag === id ? [0, '#e8e3d7', 1, '#d5ba81'] : [0, '#e8e3d7', 1, '#dbd6ca']);
  ctx.beginPath(); ctx.moveTo(tx - 3.5, y + 1); ctx.lineTo(tx + 3.5, y + 1); ctx.lineTo(tx + 3.5, y + h - 4); ctx.lineTo(tx, y + h); ctx.lineTo(tx - 3.5, y + h - 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hover ? '#b19762' : '#86837d'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#212121'; ctx.fillRect(tx - 2.5, y + 1.6, 5, 1);
  if (hover && m.pressed) { X.drag = id; m.pressed = false; }
  if (X.drag === id) { if (!m.down) X.drag = null; else return G.util.clamp((m.ux - x - 2) / (w - 4), 0, 1); }
  return null;
};
// progress bar in the XP manner: a sunken trough filled with little glossy blocks
X.progress = function (ctx, x, y, w, h, frac, col = '#2f2f2f', o = {}) {
  X.sunken(ctx, x, y, w, h, '#e8e3d7');
  const f = G.util.clamp(frac || 0, 0, 1), inner = w - 4, bw = Math.max(2.5, Math.min(6, (h - 3) * 0.75)), n = Math.floor(inner * f / (bw + 1));
  const base = parse(col) || [47, 181, 47, 1], lite = `rgb(${Math.min(255, base[0] + 90)},${Math.min(255, base[1] + 90)},${Math.min(255, base[2] + 90)})`;
  ctx.fillStyle = X.vgrad(ctx, y + 2, h - 4, [0, lite, 0.45, col, 1, col]);
  for (let i = 0; i < n; i++) ctx.fillRect(x + 2 + i * (bw + 1), y + 2, bw, h - 4);
  const rest = inner * f - n * (bw + 1);
  if (rest > 0.8 && n * (bw + 1) < inner) ctx.fillRect(x + 2 + n * (bw + 1), y + 2, Math.min(bw, rest), h - 4);
  if (o.label) {
    const sz = Math.max(6, Math.min(8, h - 2));
    U.text(ctx, o.label, x + w / 2, y + h / 2 + 0.5, { raw: true, shadow: false, size: sz, align: 'center', baseline: 'middle', color: '#e8e3d7', weight: 'bold' });
    U.text(ctx, o.label, x + w / 2 - 0.4, y + h / 2 + 0.1, { raw: true, shadow: false, size: sz, align: 'center', baseline: 'middle', color: '#282726', weight: 'bold' });
  }
};
// tab strip: returns the clicked index or -1. Tabs sit on (y + h) where the page starts.
X.tabs = function (ctx, x, y, w, labels, active, o = {}) {
  const h = o.h || 15, size = o.size || 8, m = G.input.mouse;
  const widths = labels.map((l) => U.measure(ctx, l, size, 'normal') + 14);
  const total = widths.reduce((a, b) => a + b, 0), k = total > w - 4 ? (w - 4) / total : 1;
  let tx = x + 2, hit = -1, ax = 0, aw = 0;
  labels.forEach((l, i) => {
    const tw = widths[i] * k, on = i === active, ty = on ? y : y + 2, th = on ? h + 1 : h - 2;
    const hover = U.inRect(m.ux, m.uy, tx, ty, tw, th);
    if (on) { ax = tx; aw = tw; }
    else {
      ctx.fillStyle = X.vgrad(ctx, ty, th, hover ? [0, '#e8e3d7', 1, '#d6c9ad'] : [0, '#e7e2d6', 1, '#ded9cd']);
      X.rrect(ctx, tx, ty, tw, th, 2, true, false); ctx.fill();
      ctx.strokeStyle = '#a4a3a1'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
      if (hover) { ctx.fillStyle = '#b8965a'; ctx.fillRect(tx + 1, ty, tw - 2, 1.5); }
      X.txt(ctx, X.fit(ctx, l, tw - 6, size), tx + tw / 2, ty + th / 2 + 0.5, { size, align: 'center', baseline: 'middle', color: X.C.text });
    }
    if (hover && m.pressed && !on) { hit = i; m.pressed = false; }
    tx += tw;
  });
  // the page frame, then the active tab joined to it
  if (o.page) { const [px, py, pw, ph] = o.page; ctx.fillStyle = o.pageFill || '#e8e3d7'; ctx.fillRect(px, py, pw, ph); X.stroke(ctx, px, py, pw, ph, '#a4a3a1'); }
  else X.hline(ctx, x, y + h, w, '#a4a3a1');
  if (aw) {
    ctx.fillStyle = o.pageFill || '#e8e3d7'; X.rrect(ctx, ax - 1, y, aw + 2, h + 1.5, 2, true, false); ctx.fill();
    ctx.strokeStyle = '#a4a3a1'; ctx.lineWidth = X.hp(); ctx.beginPath(); ctx.moveTo(ax - 1, y + h + 1); ctx.lineTo(ax - 1, y + 2); ctx.quadraticCurveTo(ax - 1, y, ax + 1, y); ctx.lineTo(ax + aw - 1, y); ctx.quadraticCurveTo(ax + aw + 1, y, ax + aw + 1, y + 2); ctx.lineTo(ax + aw + 1, y + h + 1); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#ceaf6d'; ctx.fillRect(ax, y, aw, 1); ctx.fillStyle = '#b8965a'; ctx.fillRect(ax + 1, y + 1, aw - 2, 0.8);
    X.txt(ctx, X.fit(ctx, labels[active], aw - 6, size, 'bold'), ax + aw / 2, y + h / 2 + 1, { size, align: 'center', baseline: 'middle', weight: 'bold' });
  }
  return hit;
};
// list-view column headers: cols = [{ label, w, align }]
X.header = function (ctx, x, y, w, cols, h = 12) {
  ctx.fillStyle = X.vgrad(ctx, y, h, [0, '#e8e3d7', 1, '#e1dcd0']); ctx.fillRect(x, y, w, h);
  X.hline(ctx, x, y + h - X.hp() * 3, w, '#ded9cd'); X.hline(ctx, x, y + h - X.hp() * 2, w, '#d9d4c8'); X.hline(ctx, x, y + h - X.hp(), w, '#c8c6c4');
  let cx = x;
  for (const c of cols) {
    const cw = c.w == null ? x + w - cx : c.w;
    X.txt(ctx, X.fit(ctx, c.label, cw - 8, 7.5), c.align === 'right' ? cx + cw - 5 : cx + 5, y + h / 2 + 0.5, { size: 7.5, baseline: 'middle', align: c.align || 'left', color: '#282726' });
    cx += cw;
    if (cx < x + w - 1) { X.vline(ctx, cx - X.hp(), y + 2, h - 4, '#d4cfc3'); X.vline(ctx, cx, y + 2, h - 4, '#e8e3d7'); }
  }
};
// vertical scrollbar. Returns the new first visible row (wheel over `area`, arrows, track paging, thumb drag).
X.scroll = function (ctx, x, y, h, first, visible, total, id, area) {
  const m = G.input.mouse, max = Math.max(0, total - visible), W = 10;
  let v = G.util.clamp(first, 0, max);
  if (area && m.wheel && U.inRect(m.ux, m.uy, area[0], area[1], area[2], area[3])) v = G.util.clamp(v + m.wheel, 0, max);
  ctx.fillStyle = '#e3ded2'; ctx.fillRect(x, y, W, h); X.vline(ctx, x, y, h, '#ddd8cc');
  const arrow = (ay, up) => {
    const hov = U.inRect(m.ux, m.uy, x, ay, W, W) && max > 0;
    ctx.fillStyle = X.vgrad(ctx, ay, W, hov ? [0, '#e4d3ad', 1, '#d5ba81'] : [0, '#e1dcd0', 1, '#d6d1c5']); X.rrect(ctx, x + 0.5, ay + 0.5, W - 1, W - 1, 1.5); ctx.fill();
    ctx.strokeStyle = hov ? '#b19762' : '#aba9a5'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = max > 0 ? '#6c6a66' : '#b8b6b4'; ctx.beginPath(); const c = x + W / 2, my = ay + W / 2;
    if (up) { ctx.moveTo(c - 2.8, my + 1.3); ctx.lineTo(c + 2.8, my + 1.3); ctx.lineTo(c, my - 1.6); } else { ctx.moveTo(c - 2.8, my - 1.3); ctx.lineTo(c + 2.8, my - 1.3); ctx.lineTo(c, my + 1.6); }
    ctx.closePath(); ctx.fill();
    if (hov && m.pressed) { m.pressed = false; v = G.util.clamp(v + (up ? -1 : 1), 0, max); }
  };
  arrow(y, true); arrow(y + h - W, false);
  const th = h - 2 * W;
  if (max > 0 && th > 6) {
    const kh = Math.max(8, th * visible / total), ky = y + W + (th - kh) * (v / max);
    const hov = U.inRect(m.ux, m.uy, x, ky, W, kh) || X.drag === id;
    ctx.fillStyle = X.grad(ctx, x, 0, x + W, 0, hov ? [0, '#e2d0a9', 1, '#d5ba81'] : [0, '#ded9cd', 1, '#d6d1c5']); X.rrect(ctx, x + 0.5, ky, W - 1, kh, 1.5); ctx.fill();
    ctx.strokeStyle = hov ? '#b19762' : '#aba9a5'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { X.hline(ctx, x + 3, ky + kh / 2 + i * 2, W - 6, '#aba9a5'); }
    if (U.inRect(m.ux, m.uy, x, ky, W, kh) && m.pressed) { X.drag = id; X.dragOff = m.uy - ky; m.pressed = false; }
    else if (U.inRect(m.ux, m.uy, x, y + W, W, th) && m.pressed) { m.pressed = false; v = G.util.clamp(v + (m.uy < ky ? -visible : visible), 0, max); }
    if (X.drag === id) {
      if (!m.down) X.drag = null;
      else v = G.util.clamp(Math.round(((m.uy - X.dragOff - y - W) / Math.max(1, th - kh)) * max), 0, max);
    }
  }
  return v;
};
X.status = function (ctx, x, y, w, parts, h = 12) {
  ctx.fillStyle = X.vgrad(ctx, y, h, [0, '#e2ddd1', 1, '#d9d4c8']); ctx.fillRect(x, y, w, h);
  X.hline(ctx, x, y, w, '#aba9a5');
  let cx = x + 2;
  parts.forEach((pt, i) => {
    const pw = pt.w == null ? x + w - 2 - cx : pt.w;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx, y + 1.5, pw - 2, h - 3);
    X.bevel(ctx, cx, y + 1.5, pw - 2, h - 3, '#b8b6b3', '#e8e3d7');
    if (pt.icon) X.glyph(ctx, pt.icon, cx + 2, y + 2.5, 7);
    X.txt(ctx, X.fit(ctx, pt.text, pw - (pt.icon ? 14 : 8), 7), pt.align === 'right' ? cx + pw - 6 : cx + (pt.icon ? 11 : 4), y + h / 2 + 0.5, { size: 7, baseline: 'middle', align: pt.align || 'left', color: pt.color || X.C.text });
    cx += pw;
  });
  // the size grip
  for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { ctx.fillStyle = '#aba9a5'; ctx.fillRect(x + w - 3 - (i - j) * 2.5, y + h - 3 - j * 2.5, 1.2, 1.2); }
};
X.tooltip = function (ctx, x, y, text, o = {}) {
  const lines = U.wrap(ctx, text, o.maxW || 180, 7.5), w = Math.max(...lines.map((l) => U.measure(ctx, l, 7.5))) + 10, h = lines.length * 9.5 + 5;
  x = Math.min(x, R.uiW - w - 4); y = Math.min(y, R.uiH - h - 4);
  ctx.fillStyle = 'rgba(0,0,0,0.19)'; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = X.C.tip; ctx.fillRect(x, y, w, h); X.stroke(ctx, x, y, w, h, '#767676');
  lines.forEach((l, i) => X.txt(ctx, l, x + 5, y + 3 + i * 9.5, { size: 7.5, color: '#000000' }));
};
X.link = function (ctx, x, y, label, o = {}) {
  const size = o.size || 8, w = U.measure(ctx, label, size), m = G.input.mouse, hover = !o.disabled && U.inRect(m.ux, m.uy, x - 1, y - 1, w + 2, size + 3);
  X.txt(ctx, label, x, y, { size, color: o.disabled ? '#aba9a7' : hover ? '#aba396' : X.C.link, weight: o.weight });
  if (hover) X.hline(ctx, x, y + size + 0.5, w, '#aba396');
  return { hover, clicked: hover && m.pressed };
};

// ---------------------------------------------------------------- dropdown lists (drawn over everything)
X.dropdown = null;   // { id, x, y, w, items, sel, pick(i) }
X.openDropdown = function (id, x, y, w, items, sel, pick) { X.dropdown = { id, x, y, w, items, sel: Math.max(0, sel), pick }; G.audio.play('select'); };
function drawDropdown(ctx) {
  const d = X.dropdown, m = G.input.mouse, rh = 11, h = d.items.length * rh + 2;
  const y = d.y + h > R.uiH - 4 ? d.y - h - 14 : d.y;
  ctx.fillStyle = 'rgba(0,0,0,0.19)'; ctx.fillRect(d.x + 2, y + 2, d.w, h);
  ctx.fillStyle = '#e8e3d7'; ctx.fillRect(d.x, y, d.w, h); X.stroke(ctx, d.x, y, d.w, h, '#9f9d99');
  d.items.forEach((it, i) => {
    const ry = y + 1 + i * rh, hov = U.inRect(m.ux, m.uy, d.x, ry, d.w, rh);
    if (hov && m.moved) d.sel = i;
    if (d.sel === i) { ctx.fillStyle = '#837d73'; ctx.fillRect(d.x + 1, ry, d.w - 2, rh); }
    X.txt(ctx, X.fit(ctx, it, d.w - 8, 8), d.x + 4, ry + rh / 2 + 0.5, { size: 8, baseline: 'middle', color: d.sel === i ? '#e8e3d7' : X.C.text });
  });
  if (m.pressed) {
    m.pressed = false;
    const i = U.inRect(m.ux, m.uy, d.x, y, d.w, h) ? Math.floor((m.uy - y - 1) / rh) : -1;
    X.dropdown = null;
    if (i >= 0 && i < d.items.length) { d.pick(i); G.audio.play('select'); }
  }
}

// ---------------------------------------------------------------- the G.ui helpers, re-skinned
const _font = U.font, _text = U.text, _panel = U.panel, _button = U.button, _slot = U.slot, _bar = U.bar, _dim = U.dim;
U.font = function (size, weight = 'normal', family = G.config.FONT) {
  if (X.on) family = family === G.config.FONT ? X.FONT : family === G.config.TITLE_FONT ? X.CAPTION : family;
  return _font.call(this, size, weight, family);
};
U.text = function (ctx, str, x, y, o = {}) {
  if (!X.on || o.raw || X.rawInk) return _text.call(this, ctx, str, x, y, o);
  return _text.call(this, ctx, str, x, y, Object.assign({}, o, { color: X.ink(o.color || this.colors.text), shadow: o.shadow === true }));
};
U.panel = function (ctx, x, y, w, h, o = {}) {
  if (!X.on) return _panel.apply(this, arguments);
  const titled = o.title != null && o.title !== '';
  if (!titled && (w < 120 || h < 36 || o.plain)) return X.face(ctx, x, y, w, h, o);
  const close = !!X.scene && X.scene === G.scenes.top() && X.panels === 0 && o.close !== false;
  const active = !X.scene || X.scene === G.scenes.top();
  X.panels++;
  const r = titled ? X.window(ctx, x, y, w, h, { title: o.title, close, active, icon: o.icon, itemIcon: o.itemIcon })
    : X.window(ctx, x, y - X.TB + 1, w, h + X.TB - 1, { title: o.caption || G.config.TITLE, close, active, icon: o.icon });
  if (r.close) X.closeTop();
};
U.button = function (ctx, x, y, w, h, label, o = {}) {
  if (!X.on) return _button.apply(this, arguments);
  if (label === '' || label == null) return X.row(ctx, x, y, w, h, o);   // used as a clickable list row
  return X.button(ctx, x, y, w, h, label, Object.assign({}, o, { size: o.size ? Math.min(o.size, 10) : 9 }));
};
U.slot = function (ctx, x, y, size, o = {}) { if (!X.on) return _slot.apply(this, arguments); X.slot(ctx, x, y, size, o); };
U.bar = function (ctx, x, y, w, h, frac, color, o = {}) {
  if (!X.on) return _bar.apply(this, arguments);
  X.progress(ctx, x, y, w, Math.max(4, h), frac, color === '#bba983' ? '#2f2f2f' : color, o);
};
U.dim = function (ctx, alpha = 0.55) {
  if (!X.on) return _dim.apply(this, arguments);
  R.uiTransform(); ctx.fillStyle = `rgba(20,19,18,${alpha * 0.82})`; X.rawFill = true; ctx.fillRect(0, 0, R.uiW, R.uiH); X.rawFill = false;
};

// the phone around phone apps stays a black phone
const _bezel = U.phoneBezel;
U.phoneBezel = function () {
  const f = X.rawFill, k = X.rawInk;
  X.rawFill = X.rawInk = true;
  try { return _bezel.apply(this, arguments); } finally { X.rawFill = f; X.rawInk = k; }
};

// ---------------------------------------------------------------- per-scene theme, window fade-in, dropdowns
const SC = G.scenes;
SC.render = function () {
  let start = this.stack.length - 1;
  while (start > 0 && this.stack[start].transparent) start--;
  const m = G.input.mouse, saved = { pressed: m.pressed, rpressed: m.rpressed, moved: m.moved, wheel: m.wheel, ux: m.ux, uy: m.uy };
  const on = X.enabled(), ctx = G.renderer.ctx, now = performance.now();
  for (let i = Math.max(0, start); i < this.stack.length; i++) {
    const top = i === this.stack.length - 1;
    if (!top) Object.assign(m, { pressed: false, rpressed: false, moved: false, wheel: 0, ux: -9999, uy: -9999 });
    else Object.assign(m, saved);
    const before = this.stack.length, scene = this.stack[i], xp = on && !X.noir(scene);
    // an open dropdown takes the click before the window under it
    let dd = null;
    if (top && X.dropdown && xp) { dd = { pressed: m.pressed }; m.pressed = false; }
    X.use(xp); X.scene = scene; X.panels = 0;
    let fade = 1;
    if (xp && X.anim) { if (!scene._xpT0) scene._xpT0 = now; fade = Math.min(1, (now - scene._xpT0) / 110); }
    ctx.save();
    if (fade < 1) ctx.globalAlpha = 0.25 + 0.75 * fade;
    // a big UI Scale never pushes a window off the screen: windows stop growing where they would stop fitting
    const fitH = 356, us = R.uiScale, uw = R.uiW, uh = R.uiH;
    if (xp && R.uiH < fitH) { const k = R.H / fitH, f = us / k; m.ux *= f; m.uy *= f; R.uiScale = k; R.uiW = R.W / k; R.uiH = fitH; }
    try { scene.render(ctx); } finally { ctx.restore(); X.rawFill = X.rawInk = false; R.uiScale = us; R.uiW = uw; R.uiH = uh; }
    if (dd && X.dropdown) { R.uiTransform(); m.pressed = dd.pressed; drawDropdown(ctx); }
    if (this.stack.length !== before || this.stack[i] !== scene) { saved.pressed = false; saved.rpressed = false; X.dropdown = null; }
    else if (top) saved.pressed = m.pressed && saved.pressed;
  }
  Object.assign(m, saved);
  X.use(false); X.scene = null;
  if (!this.stack.length || !on) X.dropdown = null;
};
// keys go to an open dropdown first
const _update = SC.update;
SC.update = function (dt) {
  const d = X.dropdown, I = G.input;
  if (d) {
    if (I.wasPressed('up')) d.sel = (d.sel + d.items.length - 1) % d.items.length;
    if (I.wasPressed('down')) d.sel = (d.sel + 1) % d.items.length;
    if (I.wasPressed('confirm')) { X.dropdown = null; d.pick(d.sel); G.audio.play('select'); }
    else if (I.wasPressed('cancel')) X.dropdown = null;
    return;
  }
  return _update.call(this, dt);
};

// ---------------------------------------------------------------- notifications: small balloon tips (the HUD stays as it is)
const H = G.hud, _draw = H.draw;
const TIP = { bad: 'error', good: 'good', quest: 'info', warn: 'warning' };
H.draw = function (ctx, scene) {
  if (!X.enabled() || !scene || !scene.toasts || !scene.toasts.length) return _draw.apply(this, arguments);
  const toasts = scene.toasts;
  scene.toasts = [];
  try { _draw.apply(this, arguments); } finally { scene.toasts = toasts; }
  let ty = this.toastY || 64;
  for (const tt of toasts) {
    const a = Math.max(0, Math.min(1, tt.t)), slide = tt._xp == null ? (tt._xp = G.loop.time) : tt._xp, k = Math.min(1, (G.loop.time - slide) / 0.15);
    ctx.globalAlpha = a;
    const tw = U.measure(ctx, tt.text, 8) + 22, x = 6 - (1 - k) * 12;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 1.5, ty + 1.5, tw, 13);
    ctx.fillStyle = '#e5d7b1'; X.rrect(ctx, x, ty, tw, 13, 2.5); ctx.fill();
    ctx.strokeStyle = '#767676'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
    X.glyph(ctx, TIP[tt.type] || 'info', x + 3, ty + 2.5, 8);
    U.text(ctx, tt.text, x + 14, ty + 7, { raw: true, shadow: false, size: 8, baseline: 'middle', color: '#000000' });
    ty += 15;
  }
  ctx.globalAlpha = 1;
};
})();
