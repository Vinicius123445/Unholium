'use strict';
// Immediate-mode UI helpers. All coordinates are in virtual UI units (height = G.config.UI_H).

G.ui = {
  // the HUD's street-noir card look: near-black violet cards, faint scanlines, a thin slate border and a
  // gold accent (js/game/hud2.js)
  colors: {
    panel: 'rgba(21,18,27,0.96)',
    panel2: 'rgba(34,29,43,0.97)',
    border: '#4a3f5a',
    borderLight: '#e8c86a',
    text: '#ece4d0',
    dim: '#8a8296',
    gold: '#f0c850',
    good: '#7cd070',
    bad: '#e05a4a',
    sel: 'rgba(232,200,106,0.16)',
    hp: '#c83a3a',
    stamina: '#4aa860',
  },

  font(size, weight = 'normal', family = G.config.FONT) {
    return `${weight} ${size}px ${family}`;
  },

  text(ctx, str, x, y, o = {}) {
    str = G.i18n.t(str);
    const size = o.size || 10;
    ctx.font = this.font(size, o.weight || 'normal', o.family);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'top';
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillText(str, x + 0.7, y + 0.7);
    }
    ctx.fillStyle = o.color || this.colors.text;
    ctx.fillText(str, x, y);
  },

  measure(ctx, str, size = 10, weight = 'normal', family) {
    ctx.font = this.font(size, weight, family);
    return ctx.measureText(G.i18n.t(str)).width;
  },

  wrap(ctx, str, maxW, size = 10, weight = 'normal') {
    ctx.font = this.font(size, weight);
    const out = [];
    for (const para of String(G.i18n.t(String(str))).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  },

  textBlock(ctx, str, x, y, maxW, o = {}) {
    const size = o.size || 10;
    const lh = o.lineHeight || size * 1.35;
    const lines = this.wrap(ctx, str, maxW, size, o.weight);
    lines.forEach((l, i) => this.text(ctx, l, x, y + i * lh, o));
    return lines.length * lh;
  },

  panel(ctx, x, y, w, h, o = {}) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 3, y + 3, w, h);   // drop shadow
    ctx.fillStyle = o.fill || this.colors.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let gy = y + 4; gy < y + h - 2; gy += 6) ctx.fillRect(x + 4, gy, w - 8, 1);   // scanlines, like the ID card
    ctx.strokeStyle = o.border || this.colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = o.accent || this.colors.borderLight;
    ctx.fillRect(x, y, 3, h);                                                         // accent edge
    if (o.title) {
      const size = o.titleSize || 12;
      this.text(ctx, String(o.title).toUpperCase(), x + w / 2, y + 6, { align: 'center', size, weight: 'bold', family: G.config.TITLE_FONT, color: this.colors.borderLight });
      const tw = Math.min(w - 20, this.measure(ctx, String(o.title).toUpperCase(), size, 'bold', G.config.TITLE_FONT) + 16);
      ctx.fillStyle = 'rgba(232,200,106,0.35)'; ctx.fillRect(x + (w - tw) / 2, y + 8 + size, tw, 1);
    }
  },

  inRect(px, py, x, y, w, h) { return px >= x && py >= y && px < x + w && py < y + h; },
  // A scrollbar for long lists: the wheel over `area` [x, y, w, h], the arrows, dragging the thumb. Returns the first
  // visible row. In the Windows look it is that look's own bar.
  scrollbar(ctx, x, y, h, first, visible, total, id, area) {
    if (G.xp && G.xp.on) return G.xp.scroll(ctx, x, y, h, first, visible, total, id, area);
    const m = G.input.mouse, max = Math.max(0, total - visible), W = 7;
    let v = G.util.clamp(first, 0, max);
    if (area && m.wheel && this.inRect(m.ux, m.uy, area[0], area[1], area[2], area[3])) v = G.util.clamp(v + m.wheel, 0, max);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, W, h);
    if (max > 0) {
      const kh = Math.max(10, h * visible / total), ky = y + (h - kh) * (v / max), on = this.inRect(m.ux, m.uy, x - 2, y, W + 4, h);
      ctx.fillStyle = on || this._bar === id ? '#e8c86a' : '#a08a5a'; ctx.fillRect(x + 1, ky, W - 2, kh);
      if (on && m.pressed) { if (m.uy >= ky && m.uy < ky + kh) { this._bar = id; this._barOff = m.uy - ky; } else v = G.util.clamp(v + (m.uy < ky ? -visible : visible), 0, max); m.pressed = false; }
      if (this._bar === id) { if (!m.down) this._bar = null; else v = G.util.clamp(Math.round((m.uy - this._barOff - y) / Math.max(1, h - kh) * max), 0, max); }
    }
    return v;
  },

  // Returns { hover, clicked }. `selected` draws highlight (keyboard focus).
  button(ctx, x, y, w, h, label, o = {}) {
    const m = G.input.mouse;
    const hover = this.inRect(m.ux, m.uy, x, y, w, h);
    const active = o.selected || hover;
    ctx.fillStyle = o.disabled ? 'rgba(26,23,32,0.8)' : active ? 'rgba(52,44,64,0.97)' : 'rgba(30,26,38,0.94)';
    ctx.fillRect(x, y, w, h);
    if (active && !o.disabled) { ctx.fillStyle = 'rgba(232,200,106,0.12)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = this.colors.borderLight; ctx.fillRect(x, y, 2, h); }
    ctx.strokeStyle = active && !o.disabled ? 'rgba(232,200,106,0.7)' : this.colors.border;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.text(ctx, label, o.align === 'left' ? x + 8 : x + w / 2, y + h / 2, {
      align: o.align || 'center', baseline: 'middle', size: o.size || 11,
      color: o.disabled ? this.colors.dim : active ? '#fff4d8' : this.colors.text, weight: o.weight,
    });
    return { hover, clicked: hover && m.pressed && !o.disabled };
  },

  bar(ctx, x, y, w, h, frac, color, o = {}) {
    ctx.fillStyle = o.bg || 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * G.util.clamp(frac, 0, 1)), h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * G.util.clamp(frac, 0, 1)), 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (o.label) this.text(ctx, o.label, x + w / 2, y + h / 2 + 0.5, { align: 'center', baseline: 'middle', size: Math.max(6, h - 3) });
  },

  icon(ctx, name, x, y, scale = 1) {
    ctx.imageSmoothingEnabled = false;
    const img = G.assets.icon(name), sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = img.width > 16; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, 16 * scale, 16 * scale); ctx.imageSmoothingEnabled = sm;
  },

  slot(ctx, x, y, size, o = {}) {
    ctx.fillStyle = o.selected ? 'rgba(62,52,74,0.97)' : 'rgba(26,22,33,0.95)';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x + 1, y + 1, size - 2, Math.floor(size / 2));
    ctx.strokeStyle = o.selected ? this.colors.borderLight : o.equipped ? this.colors.good : '#3e3550';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  },

  // Keyboard/gamepad vertical navigation. Returns 'confirm' | 'cancel' | null and updates obj[key].
  nav(obj, key, count, o = {}) {
    const I = G.input;
    if (count <= 0) return I.wasPressed('cancel') ? 'cancel' : null;
    const prev = obj[key];
    const upA = o.horizontal ? 'left' : 'up', downA = o.horizontal ? 'right' : 'down';
    if (I.wasPressed(upA)) obj[key] = (obj[key] - 1 + count) % count;
    if (I.wasPressed(downA)) obj[key] = (obj[key] + 1) % count;
    if (obj[key] !== prev) G.audio.play('select');
    if (I.wasPressed('confirm')) return 'confirm';
    if (I.wasPressed('cancel')) return 'cancel';
    return null;
  },

  // A phone turned sideways around a rect (apps like Journal, Skills and Settings open inside the phone).
  phoneBezel(ctx, x, y, w, h) {
    const bx = x - 22, by = y - 6, bw = w + 44, bh = h + 12;
    ctx.fillStyle = '#111114'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2); ctx.lineWidth = 1;
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(bx + 7, by + bh / 2 - 18, 6, 36);           // home bar
    ctx.fillStyle = '#1e1e24'; ctx.beginPath(); ctx.arc(bx + bw - 11, by + bh / 2, 3, 0, Math.PI * 2); ctx.fill();   // camera
    this.text(ctx, G.world ? G.world.timeString : '', bx + bw - 6, by + 8, { size: 7, align: 'right', color: '#c8c8d0' });
  },

  dim(ctx, alpha = 0.55) {
    G.renderer.uiTransform();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, G.renderer.uiW, G.renderer.uiH);
  },

  // A vertical list of buttons with keyboard + mouse. items: [{label, disabled}]. Returns index clicked/confirmed or -1.
  menu(ctx, scene, items, x, y, w, h = 20, gap = 4, o = {}) {
    let result = -1;
    items.forEach((it, i) => {
      const b = this.button(ctx, x, y + i * (h + gap), w, h, it.label, { selected: scene.sel === i, disabled: it.disabled, size: o.size || 11, align: o.align });
      if (b.hover && G.input.mouse.moved && scene.sel !== i) { scene.sel = i; }
      if (b.clicked) result = i;
    });
    return result;
  },
};
