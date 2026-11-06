'use strict';
// HD windows: every menu, shop, inventory, journal and dialog box is drawn with G.ui.panel / G.ui.button, so
// redoing those two gives the whole interface the HUD's finish: a dark glass card with a soft vertical
// gradient, a lit top bevel, a coloured accent edge, corner brackets and a header band behind the title.
// Buttons get a gradient, a pressed-in look on hover and a glowing accent bar. Same sizes and positions as
// before (nothing moves, so layouts and clicks are unchanged).
(() => {
const U = G.ui, _panel = U.panel;
const grads = new Map();
function grad(ctx, y, h, top, bot) {
  const k = `${y}|${h}|${top}|${bot}`; let g = grads.get(k);
  if (!g) { g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bot); if (grads.size > 400) grads.clear(); grads.set(k, g); }
  return g;
}
function brackets(ctx, x, y, w, h, col, n = 5) {
  ctx.fillStyle = col;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    ctx.fillRect(sx > 0 ? cx : cx - n + 1, cy, n, 1); ctx.fillRect(cx, sy > 0 ? cy : cy - n + 1, 1, n);
  }
}

U.panel = function (ctx, x, y, w, h, o = {}) {
  if (o.fill) return _panel.apply(this, arguments);
  const C = this.colors, acc = o.accent || C.borderLight;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 4, y + 4, w, h); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 2, y + 2, w, h);   // a soft two-step shadow
  ctx.fillStyle = grad(ctx, y, h, 'rgba(36,35,34,0.97)', 'rgba(17,17,16,0.97)'); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.022)'; for (let gy = y + 4; gy < y + h - 2; gy += 4) ctx.fillRect(x + 4, gy, w - 8, 1);   // fine scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);   // lit top bevel
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.strokeStyle = o.border || C.border; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = acc; ctx.fillRect(x, y, 3, h); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, 1, h);   // accent edge with a highlight
  brackets(ctx, x + 2, y + 2, w - 4, h - 4, 'rgba(197,176,131,0.45)');
  if (o.title) {
    const size = o.titleSize || 12, t = String(o.title).toUpperCase();
    ctx.fillStyle = grad(ctx, y + 3, size + 8, 'rgba(197,176,131,0.16)', 'rgba(197,176,131,0.02)'); ctx.fillRect(x + 4, y + 3, w - 8, size + 8);   // header band
    this.text(ctx, t, x + w / 2, y + 6, { align: 'center', size, weight: 'bold', family: G.config.TITLE_FONT, color: C.borderLight });
    const tw = Math.min(w - 20, this.measure(ctx, t, size, 'bold', G.config.TITLE_FONT) + 16);
    ctx.fillStyle = 'rgba(197,176,131,0.5)'; ctx.fillRect(x + (w - tw) / 2, y + 8 + size, tw, 1);
    ctx.fillStyle = 'rgba(197,176,131,0.18)'; ctx.fillRect(x + 6, y + 8 + size, (w - tw) / 2 - 8, 1); ctx.fillRect(x + (w + tw) / 2 + 2, y + 8 + size, (w - tw) / 2 - 8, 1);
  }
};

U.button = function (ctx, x, y, w, h, label, o = {}) {
  const C = this.colors, m = G.input.mouse;
  const hover = this.inRect(m.ux, m.uy, x, y, w, h), active = (o.selected || hover) && !o.disabled;
  ctx.fillStyle = o.disabled ? 'rgba(27,27,27,0.85)' : active ? grad(ctx, y, h, 'rgba(80,73,81,0.98)', 'rgba(51,50,49,0.98)') : grad(ctx, y, h, 'rgba(46,45,44,0.95)', 'rgba(28,28,27,0.95)');
  ctx.fillRect(x, y, w, h);
  if (!o.disabled) { ctx.fillStyle = active ? 'rgba(226,207,167,0.12)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); }
  if (active) { ctx.fillStyle = 'rgba(197,176,131,0.10)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.borderLight; ctx.fillRect(x, y + 1, 2, h - 2); ctx.fillStyle = 'rgba(197,176,131,0.25)'; ctx.fillRect(x + 2, y + 1, 2, h - 2); }
  ctx.strokeStyle = active ? 'rgba(197,176,131,0.75)' : C.border; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  this.text(ctx, label, o.align === 'left' ? x + 8 : x + w / 2, y + h / 2, {
    align: o.align || 'center', baseline: 'middle', size: o.size || 11,
    color: o.disabled ? C.dim : active ? '#e4d2ae' : C.text, weight: o.weight,
  });
  return { hover, clicked: hover && m.pressed && !o.disabled };
};
})();
