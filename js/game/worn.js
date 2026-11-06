'use strict';
// The interface as the world wears it: forms and steel boxes, not a desktop. The colors live in the screens themselves;
// this file gives every window its surface (scuffs, grime in the corners, square edges) and keeps the screen free of
// key hints: whatever a line of text says about a key is taken out as it is drawn, in either language.
(() => {
const U = G.ui, X = G.xp;
// ---------------------------------------------------------------- no key hints
const KEY = '(?:E|F|G|X|P|S|B|V|Z|C|T|U|Q|R|M|Y|I|H|N|W|Esc|Enter|Space|Espaço|Arrows|Setas|Ctrl|Tab|Shift)';
const RX = [
  [new RegExp(`:\\s*\\[${KEY}\\]\\)`, 'g'), ')'],                     // "(Construction inventory: [B])"
  [new RegExp(`\\s*·\\s*\\[${KEY}\\][^·]*`, 'g'), ''],                 // "  ·  [G] Pickpocket"
  [new RegExp(`\\s*·\\s*(?:or|ou) \\[${KEY}\\][^·]*`, 'g'), ''],       // "  ·  or [X] anywhere"
  [new RegExp(`\\(\\[${KEY}\\],\\s*`, 'g'), '('],                      // "([X], Machete)"
  [new RegExp(`\\s*\\(?\\[${KEY}\\](?:\\s*/\\s*\\[${KEY}\\])*\\)?\\s*$`, 'g'), ''],   // at the end
  [new RegExp(`(?:^|(?<=[.!?:]\\s))\\[${KEY}\\]\\s+`, 'g'), ''],        // at the start of a sentence
  [new RegExp(`\\s*\\[${KEY}\\](?:\\s*/\\s*\\[${KEY}\\])*`, 'g'), ''],  // anywhere else
  [/\(\s*\)/g, ''], [/\s+([.,!?)])/g, '$1'], [/ {2,}/g, ' '],
];
const HINT = new RegExp(`\\[${KEY}\\]`);
const strip = (s) => { for (const [a, b] of RX) s = s.replace(a, b); return s.trim(); };
G.ui.noKeys = (s) => { s = String(s); if (!HINT.test(s)) return s; return strip(G.i18n.t(s)); };
const _text = U.text;
U.text = function (ctx, str, x, y, o) { if (typeof str === 'string' && str.includes('[') && HINT.test(str)) str = G.ui.noKeys(str); return _text.call(this, ctx, str, x, y, o); };
const _wrap = U.wrap;
U.wrap = function (ctx, str, w, size) { return _wrap.call(this, ctx, typeof str === 'string' ? G.ui.noKeys(str) : str, w, size); };
const _measure = U.measure;
U.measure = function (ctx, str, ...r) { return _measure.call(this, ctx, typeof str === 'string' && str.includes('[') ? G.ui.noKeys(str) : str, ...r); };

// ---------------------------------------------------------------- the surface
let tex = null;
const surface = () => {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = new G.RNG('worn-surface');
  for (let i = 0; i < 2600; i++) { x.fillStyle = r.chance(0.5) ? 'rgba(255,250,235,0.018)' : 'rgba(30,24,16,0.028)'; x.fillRect(r.range(0, 256), r.range(0, 256), 1, 1); }
  for (let i = 0; i < 60; i++) { x.strokeStyle = r.chance(0.6) ? 'rgba(40,32,22,0.05)' : 'rgba(255,250,235,0.04)'; x.lineWidth = 0.6; const a = r.range(0, 256), b = r.range(0, 256), an = r.range(0, 6.3), l = r.range(8, 46); x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); }
  for (let i = 0; i < 14; i++) { const a = r.range(0, 256), b = r.range(0, 256), R0 = r.range(14, 46), g = x.createRadialGradient(a, b, 0, a, b, R0); g.addColorStop(0, 'rgba(60,46,28,0.05)'); g.addColorStop(1, 'rgba(60,46,28,0)'); x.fillStyle = g; x.fillRect(a - R0, b - R0, R0 * 2, R0 * 2); }
  return (tex = c);
};
const skin = (ctx, x, y, w, h) => {
  const pat = ctx.createPattern(surface(), 'repeat'), rf = X.rawFill;
  X.rawFill = true; ctx.save(); ctx.fillStyle = pat; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,250,235,0.03)'); g.addColorStop(1, 'rgba(36,28,18,0.1)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore(); X.rawFill = rf;
};
const _win = X.window;
X.window = function (ctx, x, y, w, h, o = {}) {
  const r = _win.apply(this, arguments);
  skin(ctx, r.x, r.y, r.w, r.h);
  return r;
};
const _face = X.face;
X.face = function (ctx, x, y, w, h, o = {}) { const r = _face.apply(this, arguments); skin(ctx, x, y, w, h); return r; };
// square, machined corners: nothing rounded and friendly
const _rr = X.rrect;
X.rrect = function (ctx, x, y, w, h, r, top, bottom) { return _rr.call(this, ctx, x, y, w, h, Math.min(r, 1), top, bottom); };
})();
