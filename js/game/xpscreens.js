'use strict';
// The Windows (2007) look for the screens that need more than a re-skin (the theme itself is js/game/xpui.js):
// the inventory as an Explorer window (task pane, icon/details views, preview pane, status bar), the dialogue as
// a compact conversation window, the shop as a tabbed list view, Settings as a properties dialog with checkboxes,
// combo boxes and trackbars, Skills with a Statistics page (base values and temporary modifiers apart), the
// Journal with real tabs, the main menu, message boxes, looting, save/load and the map. Only the drawing changes:
// every screen keeps its own update(), keys, state and actions, and with the Noir style the old render() runs.
(() => {
const U = G.ui, R = G.renderer, X = G.xp, C = X.C;
const skin = (cls, fn) => {
  if (!cls) return;
  const P = cls.prototype, orig = P.render;
  P.render = function (ctx) { return X.on ? fn.call(this, ctx, orig) : orig.call(this, ctx); };
};
const isTop = (s) => G.scenes.top() === s;
const clip = (ctx, x, y, w, h) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };

// a flat toolbar button that lights up on hover (like the Creation Tool's toolbar)
function tool(ctx, x, y, label, o = {}) {
  const size = 8, w = (o.glyph || o.itemIcon ? 15 : 6) + U.measure(ctx, label, size) + 6, h = 17;
  const m = G.input.mouse, hover = !o.disabled && U.inRect(m.ux, m.uy, x, y, w, h), down = hover && m.down;
  if (hover || o.on) {
    ctx.fillStyle = X.vgrad(ctx, y, h, down || o.on ? X.BTN.on : X.BTN.hot); X.rrect(ctx, x, y, w, h, 2.5); ctx.fill();
    ctx.strokeStyle = down || o.on ? '#957d4e' : '#b19762'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1;
  }
  ctx.globalAlpha = o.disabled ? 0.45 : 1;
  if (o.itemIcon) U.icon(ctx, o.itemIcon, x + 3, y + 2.5, 0.75);
  else if (o.glyph) X.glyph(ctx, o.glyph, x + 3, y + 3, 11);
  X.txt(ctx, label, x + (o.glyph || o.itemIcon ? 17 : 6), y + h / 2 + 0.5, { size, baseline: 'middle' });
  ctx.globalAlpha = 1;
  return { w, hover, clicked: hover && m.pressed };
}
function toolbar(ctx, x, y, w, h = 21) {
  ctx.fillStyle = X.vgrad(ctx, y, h, [0, '#e7e2d6', 0.48, '#e0dbcf', 0.52, '#dbd6ca', 1, '#e1dcd0']); ctx.fillRect(x, y, w, h);
  X.hline(ctx, x, y + h - X.hp(), w, '#aba9a5');
}
const sep = (ctx, x, y) => { X.vline(ctx, x, y + 3, 14, '#c2c0bc'); X.vline(ctx, x + X.hp(), y + 3, 14, '#e8e3d7'); };

// ------------------------------------------------------------------------------------------------ Dialogue
skin(G.DialogueScene, function (ctx) {
  const npc = this.runner.npc, m = G.input.mouse;
  R.uiTransform();
  const W = Math.min(620, R.uiW - 16), x = Math.round((R.uiW - W) / 2), H = Math.floor(R.uiH * 0.28), y = R.uiH - H - 6;
  this.panelH = H / R.uiH;
  const name = npc.st.introduced ? `${npc.st.realName} · ${npc.st.name}` : npc.st.name;
  const win = X.window(ctx, x, y, W, H, { title: name, icon: 'person', close: isTop(this) });
  if (win.close) { G.audio.play('back'); this.leave(); return; }
  this._hit = { us: R.uiScale, close: [x + W - 22, y, 22, 19], field: null };
  const cx = win.x + 4, cy = win.y + 3, chat = this.runner.node && this.runner.node.chat !== false;
  const bodyH = win.h - 6 - (chat ? 15 : 0);
  // portrait
  X.sunken(ctx, cx, cy, 40, 40, '#e5e0d4');
  const s = npc.sheet;
  if (G.portrait && (npc.look || s)) { clip(ctx, cx + 1, cy + 1, 38, 38); X.rawFill = true; G.portrait.draw(ctx, npc, cx - 3, cy - 3, 46); X.rawFill = false; ctx.restore(); }   // their face (js/game/realface.js)
  // relationship meter (only for a while after it moves, like before)
  const v = G.rel ? G.rel.value(npc.st) : null;
  if (v != null) { if (this._relV == null) this._relV = v; if (v !== this._relV) { this._relShow = 3; this._relV = v; } }
  if (this._relShow > 0 && G.rel) { this._relShow -= 1 / 60; ctx.globalAlpha = Math.min(1, this._relShow); G.rel.drawBar(ctx, npc, cx, cy + 44, 40); ctx.globalAlpha = 1; }
  // what they say: a read-only text box that follows the newest line (scroll back with the bar)
  const tx = cx + 46, tw = Math.floor((win.w - 54) * 0.5), th = bodyH;
  X.sunken(ctx, tx, cy, tw, th);
  const full = this.fullText;
  if (this._xpText !== full) { this._xpText = full; this._tUser = false; this._tFirst = 0; }
  const lines = U.wrap(ctx, full.slice(0, Math.floor(this.chars)), tw - 18, 8.5), lh = 10.5, vis = Math.max(1, Math.floor((th - 4) / lh));
  let first = this._tUser ? this._tFirst : Math.max(0, lines.length - vis);
  if (lines.length > vis) {
    const nf = X.scroll(ctx, tx + tw - 10.5, cy + 0.5, th - 1, first, vis, lines.length, 'dlgText', [tx, cy, tw, th]);
    if (nf !== first) { this._tUser = nf < lines.length - vis; first = nf; }
  }
  this._tFirst = first;
  clip(ctx, tx + 1, cy + 1, tw - 2, th - 2);
  lines.slice(first, first + vis).forEach((l, i) => X.txt(ctx, l, tx + 4, cy + 3 + i * lh, { size: 8.5 }));
  ctx.restore();
  // the answers: a list box
  const lx = tx + tw + 4, lw = win.x + win.w - 4 - lx, choices = this.runner.node ? this.runner.node.choices : [];
  X.sunken(ctx, lx, cy, lw, th);
  X.header(ctx, lx + 1, cy + 1, lw - 2, [{ label: 'Responses' }], 11);
  const rh = 11, ry0 = cy + 13, rows = Math.max(1, Math.floor((th - 14) / rh));
  this.scroll = G.util.clamp(this.scroll || 0, 0, Math.max(0, choices.length - rows));
  if (this.sel < this.scroll) this.scroll = this.sel;
  if (this.sel >= this.scroll + rows) this.scroll = this.sel - rows + 1;
  const done = this.chars >= full.length, sb = choices.length > rows;
  if (done) {
    if (sb) {
      const ns = X.scroll(ctx, lx + lw - 10.5, ry0, th - 13.5, this.scroll, rows, choices.length, 'dlgChoices', [lx, cy, lw, th]);
      if (ns !== this.scroll) { this.scroll = ns; this.sel = G.util.clamp(this.sel, ns, ns + rows - 1); }
    }
    let tip = null;
    choices.forEach((c, i) => {
      if (i < this.scroll || i >= this.scroll + rows) return;
      const by = ry0 + (i - this.scroll) * rh, rw = lw - 3 - (sb ? 11 : 0);
      const r = X.row(ctx, lx + 1.5, by, rw, rh, { selected: this.sel === i, fill: false });
      const label = `${i + 1}. ${c.text}`, fit = X.fit(ctx, label, rw - 8, 8);
      X.txt(ctx, fit, lx + 5, by + rh / 2 + 0.5, { size: 8, baseline: 'middle', color: this.sel === i ? '#37342e' : C.text });
      if (r.hover && fit !== label) tip = [label, by];
      if (r.hover && m.moved) this.sel = i;
      if (r.clicked) { m.pressed = false; this.choose(i); }
    });
    if (tip) X.tooltip(ctx, lx + 10, tip[1] - 14, tip[0], { maxW: 260 });
  } else {
    X.txt(ctx, '…', lx + 6, ry0 + 2, { size: 9, color: C.dim });
    if (m.pressed) this.chars = full.length;
  }
  if (this.aiWait) X.txt(ctx, `${npc.st.introduced ? npc.st.realName.split(' ')[0] : npc.st.name} is typing${'.'.repeat(1 + Math.floor(G.loop.time * 3) % 3)}`, lx + 6, ry0 + 2, { size: 8, color: C.dim });   // AI dialogue (js/game/aidialogue.js)
  // own words: a text field and a Say button
  if (chat) {
    const fy = cy + th + 3, fw = win.x + win.w - 4 - tx - 40;
    this._hit.field = [tx, fy - 1, fw, 14];
    X.sunken(ctx, tx, fy, fw, 12, this.typing ? '#e8e3d7' : '#e6e1d5');
    if (this.typing) X.stroke(ctx, tx, fy, fw, 12, '#7b776f');
    const caret = this.typing && Math.floor(G.loop.time * 2) % 2 ? '|' : '';
    X.txt(ctx, this.typing ? this.input + caret : 'Say something in your own words...', tx + 4, fy + 6.5, { size: 8, baseline: 'middle', color: this.typing ? C.text : '#9b9997' });
    const say = X.button(ctx, tx + fw + 4, fy - 0.5, 36, 13, 'Say', { size: 8, disabled: !this.typing && !done });
    if (say.clicked) { m.pressed = false; if (this.typing) this.submit(); else { this.typing = true; this.input = ''; G.input.typed.length = 0; } }
    if (!this.typing && m.pressed && U.inRect(m.ux, m.uy, tx, fy, fw, 12) && done) { this.typing = true; this.input = ''; G.input.typed.length = 0; }
  }
});

// ------------------------------------------------------------------------------------------------ Inventory
const IP = G.InventoryScene && G.InventoryScene.prototype;
if (IP) {
  const _iupd = IP.update;
  // the Details view lists only the slots in use, so the arrows step through those
  IP.update = function (dt) {
    const I = G.input;
    if (X.enabled() && this.xpView === 1 && this.sel < this.inv.size && (I.wasPressed('up') || I.wasPressed('down') || I.wasPressed('left') || I.wasPressed('right'))) {
      const used = this.inv.slots.map((s, i) => s ? i : -1).filter((i) => i >= 0);
      if (used.length) {
        const k = Math.max(0, used.indexOf(this.sel)), up = I.wasPressed('up');
        if (I.wasPressed('up') || I.wasPressed('down')) { this.sel = used[G.util.clamp(k + (up ? -1 : 1), 0, used.length - 1)]; G.audio.play('select'); }
        else if (I.wasPressed('right')) { this.sel = this.inv.size; G.audio.play('select'); }
      }
      for (const a of ['up', 'down', 'left', 'right']) I.consume(a);
    }
    return _iupd.call(this, dt);
  };
}
skin(G.InventoryScene, function (ctx) {
  U.dim(ctx, 0.45);
  const p = this.game.player, m = G.input.mouse, inv = this.inv;
  const W = 500, H = 322, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const win = X.window(ctx, x, y, W, H, { title: 'Inventory', icon: 'bag', close: isTop(this) });
  if (win.close) X.closeTop();
  this.xpView = this.xpView || 0;
  let over = null;   // the slot under the mouse (for dragging)
  const eq = this.sel >= inv.size, slotName = eq ? this.eqSlots[this.sel - inv.size] : null;
  const curId = eq ? p.equip[slotName] : inv.slots[this.sel] && inv.slots[this.sel].id;
  // toolbar
  toolbar(ctx, win.x, win.y, win.w);
  let bx = win.x + 3;
  const cur = curId && G.item(curId);
  const useLbl = eq ? 'Unequip' : cur && (cur.slot || ['weapon', 'armor', 'clothing', 'trinket'].includes(cur.type)) ? 'Equip' : 'Use';
  const b1 = tool(ctx, bx, win.y + 2, useLbl, { glyph: 'good', disabled: !curId }); bx += b1.w + 2;
  const b2 = tool(ctx, bx, win.y + 2, 'Drop', { glyph: 'error', disabled: !curId }); bx += b2.w + 2;
  const b3 = tool(ctx, bx, win.y + 2, 'Sort', { glyph: 'folder' }); bx += b3.w + 4;
  sep(ctx, bx, win.y + 2); bx += 6;
  const b4 = tool(ctx, bx, win.y + 2, 'Icons', { on: this.xpView === 0 }); bx += b4.w + 2;
  const b5 = tool(ctx, bx, win.y + 2, 'Details', { on: this.xpView === 1 });
  if (b1.clicked && curId) { m.pressed = false; this.useSel(); }
  if (b2.clicked && curId) { m.pressed = false; this.dropSel(); }
  if (b3.clicked) { m.pressed = false; inv.sort(); G.audio.play('select'); }
  if (b4.clicked) { m.pressed = false; this.xpView = 0; G.audio.play('select'); }
  if (b5.clicked) { m.pressed = false; this.xpView = 1; G.audio.play('select'); }
  const top = win.y + 22, bottom = win.y + win.h - 12, bodyH = bottom - top;
  // the task pane
  const tpW = 146;
  ctx.fillStyle = X.vgrad(ctx, top, bodyH, [0, '#b7b3ab', 1, '#a39e96']); ctx.fillRect(win.x, top, tpW, bodyH);
  const box = (by, title, h, glyph) => {
    const bx0 = win.x + 6, bw = tpW - 12;
    ctx.fillStyle = X.grad(ctx, bx0, 0, bx0 + bw, 0, [0, '#e8e3d7', 1, '#dad5c9']); X.rrect(ctx, bx0, by, bw, 13, 3, true, false); ctx.fill();
    if (glyph) X.glyph(ctx, glyph, bx0 + 3, by + 1.5, 10);
    X.txt(ctx, title, bx0 + (glyph ? 16 : 6), by + 7, { size: 8, weight: 'bold', baseline: 'middle', color: '#7d766a' });
    ctx.fillStyle = '#ddd8cc'; ctx.fillRect(bx0, by + 13, bw, h); X.stroke(ctx, bx0, by + 13, bw, h, '#e8e3d7');
    return [bx0 + 6, by + 16, bw - 12];
  };
  let ty = top + 6;
  {
    const [lx, ly] = box(ty, 'Item Tasks', 34, 'gear');
    const l1 = X.link(ctx, lx, ly, eq ? 'Unequip this item' : useLbl === 'Use' ? 'Use this item' : 'Equip this item', { disabled: !curId, size: 7.5 });
    const l2 = X.link(ctx, lx, ly + 10, 'Drop this item', { disabled: !curId || eq, size: 7.5 });
    const l3 = X.link(ctx, lx, ly + 20, 'Sort items', { size: 7.5 });
    if (l1.clicked && curId) { m.pressed = false; this.useSel(); }
    if (l2.clicked && curId) { m.pressed = false; this.dropSel(); }
    if (l3.clicked) { m.pressed = false; inv.sort(); G.audio.play('select'); }
    ty += 13 + 34 + 6;
  }
  {
    const n = this.eqSlots.length, [lx, ly, lw] = box(ty, 'Equipped', n * 13 + 3, 'person');
    this.eqSlots.forEach((slot, i) => {
      const ry = ly - 1 + i * 13, idx = inv.size + i, id = p.equip[slot];
      const r = X.row(ctx, lx - 3, ry, lw + 6, 12.5, { selected: this.sel === idx, fill: false });
      ctx.fillStyle = '#e8e3d7'; ctx.fillRect(lx - 1, ry + 1, 10.5, 10.5); X.stroke(ctx, lx - 1, ry + 1, 10.5, 10.5, id ? '#3a3a3a' : '#b8b6b3');
      if (id) U.icon(ctx, G.item(id).icon, lx - 0.5, ry + 1.5, 0.6);
      X.txt(ctx, G.util.capitalize(slot), lx + 13, ry + 6.5, { size: 7, baseline: 'middle', color: C.dim });
      X.txt(ctx, X.fit(ctx, id ? G.item(id).name : '(none)', lw - 46, 7), lx + 46, ry + 6.5, { size: 7, baseline: 'middle', color: id ? C.text : '#aba9a7' });
      if (r.hover) { over = idx; if (m.moved && !this.drag) this.sel = idx; }
      if (r.hover && this.drag && this.drag.moved && this.drag.from !== idx) { ctx.strokeStyle = '#837d73'; ctx.setLineDash([2, 2]); ctx.strokeRect(lx - 2.5, ry + 0.5, lw + 5, 11.5); ctx.setLineDash([]); }
      if (r.clicked) { m.pressed = false; this.slotPress(idx); }
    });
    ty += 13 + n * 13 + 3 + 6;
  }
  {
    const [lx, ly, lw] = box(ty, 'Character', 41, 'info');
    const kv = (k, v, yy, col) => { X.txt(ctx, k, lx, yy, { size: 7, color: C.dim }); X.txt(ctx, v, lx + lw, yy, { size: 7, align: 'right', color: col || C.text, weight: 'bold' }); };
    kv('Health', `${Math.ceil(p.hp)} / ${p.maxHp}`, ly, p.hp < p.maxHp * 0.35 ? C.bad : null);
    kv('Damage · Defense', `${p.damage()} · ${p.defense()}`, ly + 9);
    kv('Cash', `$${p.gold}`, ly + 18, C.good);
    kv('Level · Charisma', `${p.skills.level} · ${G.skills.charisma(p)}`, ly + 27);
  }
  // the item area
  const ax = win.x + tpW + 1, aw = win.x + win.w - ax, prevH = 58, gh = bodyH - prevH - 1;
  ctx.fillStyle = '#e8e3d7'; ctx.fillRect(ax, top, aw, gh);
  if (this.xpView === 0) {
    const cols = 6, cw = Math.floor((aw - 14) / cols), ch = Math.min(38, Math.floor((gh - 6) / Math.ceil(inv.size / cols)));
    for (let i = 0; i < inv.size; i++) {
      const sx = ax + 6 + (i % cols) * cw, sy = top + 4 + Math.floor(i / cols) * ch, s = inv.slots[i];
      const hov = U.inRect(m.ux, m.uy, sx, sy, cw - 2, ch - 2), on = this.sel === i;
      if (on || hov) X.row(ctx, sx, sy, cw - 2, ch - 2, { selected: on, fill: false });
      else if (!s) { ctx.strokeStyle = '#e3ded2'; ctx.lineWidth = X.hp(); X.rrect(ctx, sx + 0.5, sy + 0.5, cw - 3, ch - 3, 2); ctx.stroke(); ctx.lineWidth = 1; }
      if (s) {
        const it = G.item(s.id);
        U.icon(ctx, it.icon, sx + (cw - 2) / 2 - 10, sy + 2, 1.25);
        if (s.qty > 1) { const q = String(s.qty), qw = U.measure(ctx, q, 6.5, 'bold') + 4; ctx.fillStyle = '#6c6860'; X.rrect(ctx, sx + cw - 4 - qw, sy + 1.5, qw, 8, 2); ctx.fill(); X.txt(ctx, q, sx + cw - 4 - qw / 2, sy + 6, { size: 6.5, align: 'center', baseline: 'middle', color: '#e8e3d7', weight: 'bold' }); }
        X.txt(ctx, X.fit(ctx, it.name, cw - 6, 6.5), sx + (cw - 2) / 2, sy + 24, { size: 6.5, align: 'center', color: on ? '#37342e' : C.text });
      }
      if (this.drag && this.drag.moved && hov && i !== this.drag.from) { ctx.strokeStyle = '#837d73'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); X.rrect(ctx, sx + 0.5, sy + 0.5, cw - 3, ch - 3, 2); ctx.stroke(); ctx.setLineDash([]); }
      if (hov) {
        over = i;
        if (m.moved && !this.drag) this.sel = i;
        if (m.pressed) { m.pressed = false; this.slotPress(i); }
        if (m.rpressed) { m.rpressed = false; this.sel = i; this.dropSel(); }
      }
    }
  } else {
    const cols = [{ label: 'Name', w: aw - 160 }, { label: 'Qty', w: 34, align: 'right' }, { label: 'Type', w: 70 }, { label: 'Value', w: null, align: 'right' }];
    X.header(ctx, ax, top, aw, cols);
    const used = inv.slots.map((s, i) => s ? i : -1).filter((i) => i >= 0), rh = 12, vis = Math.floor((gh - 14) / rh);
    this.xpScroll = G.util.clamp(this.xpScroll || 0, 0, Math.max(0, used.length - vis));
    const k = used.indexOf(this.sel);
    if (k >= 0 && k < this.xpScroll) this.xpScroll = k;
    if (k >= this.xpScroll + vis) this.xpScroll = k - vis + 1;
    if (used.length > vis) this.xpScroll = X.scroll(ctx, ax + aw - 10, top + 12, gh - 12, this.xpScroll, vis, used.length, 'invList', [ax, top, aw, gh]);
    used.slice(this.xpScroll, this.xpScroll + vis).forEach((i, j) => {
      const s = inv.slots[i], it = G.item(s.id), ry = top + 13 + j * rh, rw = aw - 2 - (used.length > vis ? 10 : 0);
      const r = X.row(ctx, ax + 1, ry, rw, rh, { selected: this.sel === i, fill: false });
      U.icon(ctx, it.icon, ax + 4, ry + 1.5, 0.6);
      X.txt(ctx, X.fit(ctx, it.name, cols[0].w - 22, 7.5), ax + 18, ry + 6.5, { size: 7.5, baseline: 'middle' });
      X.txt(ctx, String(s.qty), ax + cols[0].w + 34 - 5, ry + 6.5, { size: 7.5, baseline: 'middle', align: 'right' });
      X.txt(ctx, X.fit(ctx, it.type === 'clothing' ? 'clothing' : it.cat || it.type || '', 64, 7.5), ax + cols[0].w + 34 + 5, ry + 6.5, { size: 7.5, baseline: 'middle', color: C.dim });
      X.txt(ctx, it.value ? `$${it.value}` : '', ax + rw - 4, ry + 6.5, { size: 7.5, baseline: 'middle', align: 'right', color: C.dim });
      if (r.hover && m.moved) this.sel = i;
      if (r.clicked) { m.pressed = false; this.sel = i; this.useSel(); }
      if (r.hover && m.rpressed) { m.rpressed = false; this.sel = i; this.dropSel(); }
    });
    if (!used.length) X.txt(ctx, 'This folder is empty.', ax + aw / 2, top + 40, { size: 8, align: 'center', color: C.dim });
  }
  // preview pane
  const py = top + gh + 1;
  ctx.fillStyle = X.vgrad(ctx, py, prevH, [0, '#e6e1d5', 1, '#dfdace']); ctx.fillRect(ax, py, aw, prevH); X.hline(ctx, ax, py, aw, '#cccbc8');
  if (curId) {
    const it = G.item(curId);
    X.sunken(ctx, ax + 6, py + 6, 30, 30, '#e8e3d7'); U.icon(ctx, it.icon, ax + 7, py + 7, 1.75);
    X.txt(ctx, X.fit(ctx, it.name, aw - 110, 9.5, 'bold'), ax + 42, py + 5, { size: 9.5, weight: 'bold' });
    if (it.illegal && !it.unidentified) { X.glyph(ctx, 'warning', ax + aw - 52, py + 5, 9); X.txt(ctx, 'Illegal', ax + aw - 40, py + 6, { size: 7.5, weight: 'bold', color: C.bad }); }
    const fx = Object.keys(it.effects || {}).map((e) => G.EFFECTS[e]).filter((e) => e && !e.hidden).map((e) => e.name);
    const stats = [it.type === 'clothing' ? 'clothing (' + it.slot + ')' : it.cat || it.type, it.dmg && `Damage ${it.dmg}${it.pellets ? 'x' + it.pellets : ''}`, it.gun && `Mag ${it.mag}`, it.gun && G.item(it.ammo).name,
      it.def && `Defense ${it.def}`, it.bulletDef && `+${it.bulletDef} vs bullets`, it.heal && `Heals ${it.heal}`, it.stamina && `Stamina +${it.stamina}`, it.alcohol && 'Alcohol',
      !it.unidentified && fx.length && fx.join(', '), it.maxHp && `Max HP +${it.maxHp}`, it.value && `Value $${it.value}`].filter(Boolean).join(' · ');
    X.txt(ctx, X.fit(ctx, stats, aw - 50, 7), ax + 42, py + 17, { size: 7, color: C.dim });
    const d = U.wrap(ctx, it.desc || '', aw - 50, 7.5);
    d.slice(0, 2).forEach((l, i) => X.txt(ctx, i === 1 && d.length > 2 ? X.fit(ctx, l + '…', aw - 50, 7.5) : l, ax + 42, py + 27 + i * 9.5, { size: 7.5 }));
  } else X.txt(ctx, eq ? 'Nothing equipped in this slot.' : 'Select an item to see its details.', ax + 8, py + 8, { size: 8, color: C.dim });
  // status bar
  const n = inv.slots.filter(Boolean).length;
  X.status(ctx, win.x, bottom, win.w, [{ text: `${n} object${n === 1 ? '' : 's'} (${inv.size - n} free)`, w: 150 }, { text: `Cash: $${p.gold}`, w: 100, icon: 'money' }, { text: `Health ${Math.ceil(p.hp)}/${p.maxHp}` }]);
  this.dragFrame(ctx, over, !U.inRect(m.ux, m.uy, x, y, W, H));   // the item being carried is drawn over everything; off the window it is dropped
});

// ------------------------------------------------------------------------------------------------ Shop
skin(G.ShopScene, function (ctx) {
  U.dim(ctx, 0.45);
  const g = this.game, shop = G.SHOPS[this.shopId], m = G.input.mouse;
  const W = Math.min(470, R.uiW - 12), H = Math.min(250, R.uiH - 12), x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const win = X.window(ctx, x, y, W, H, { title: shop.name, icon: 'money', close: isTop(this) });
  if (win.close) X.closeTop();
  const pageY = win.y + 20, pageH = win.h - 20 - 36;
  const hit = X.tabs(ctx, win.x + 6, win.y + 5, win.w - 12, ['Buy', 'Sell'], this.tab, { page: [win.x + 6, pageY, win.w - 12, pageH], h: 15 });
  if (hit >= 0) { this.tab = hit; this.sel = 0; this.scroll = 0; G.audio.play('select'); }
  const rows = this.rows(), lx = win.x + 12, lw = Math.min(270, win.w - 170), ly = pageY + 6, rh = 13, vis = this.vis = Math.max(3, Math.floor((pageH - 12 - 16) / rh)), lh = 12 + vis * rh + 2;
  X.sunken(ctx, lx, ly, lw, lh);
  X.header(ctx, lx + 1, ly + 1, lw - 2, [{ label: 'Item', w: lw - 100 }, { label: this.tab === 0 ? 'Stock' : 'Owned', w: 40, align: 'right' }, { label: 'Price', align: 'right' }]);
  this.scroll = G.util.clamp(this.scroll, 0, Math.max(0, rows.length - vis));
  if (rows.length > vis) this.scroll = X.scroll(ctx, lx + lw - 11, ly + 13, lh - 14, this.scroll, vis, rows.length, 'shopList', [lx, ly, lw, lh]);
  if (this.sel < this.scroll) this.sel = this._navSel = this.scroll;
  if (this.sel >= this.scroll + vis) this.sel = this._navSel = this.scroll + vis - 1;
  rows.slice(this.scroll, this.scroll + vis).forEach((row, k) => {
    const i = k + this.scroll, it = G.item(row.id), by = ly + 13 + k * rh, rw = lw - 3 - (rows.length > vis ? 11 : 0);
    const dim = (this.tab === 0 && row.price > g.player.gold) || (this.tab === 1 && !row.ok);
    const r = X.row(ctx, lx + 1.5, by, rw, rh, { selected: this.sel === i, alt: k % 2 === 1 });
    U.icon(ctx, it.icon, lx + 4, by + 1.5, 0.65);
    X.txt(ctx, X.fit(ctx, it.name, lw - 124, 8), lx + 19, by + rh / 2 + 0.5, { size: 8, baseline: 'middle', color: dim ? '#9b9997' : C.text });
    X.txt(ctx, String(row.qty), lx + lw - 100 + 40 - 5, by + rh / 2 + 0.5, { size: 8, baseline: 'middle', align: 'right', color: C.dim });
    X.txt(ctx, this.tab === 1 && !row.ok ? '—' : `$${row.price}`, lx + rw - 3, by + rh / 2 + 0.5, { size: 8, baseline: 'middle', align: 'right', color: dim ? '#9b9997' : C.good, weight: 'bold' });
    if (r.hover && m.moved) this.sel = i;
    if (r.clicked) { m.pressed = false; this.sel = i; this.act(row); }
  });
  if (!rows.length) X.txt(ctx, this.tab === 0 ? 'Nothing for sale.' : 'You have nothing to sell.', lx + lw / 2, ly + 40, { size: 8, align: 'center', color: C.dim });
  // details
  const dx = lx + lw + 8, dw = win.x + win.w - 12 - dx, row = rows[this.sel];
  X.group(ctx, dx, ly - 2, dw, lh + 2, 'Details');
  ctx.save(); ctx.beginPath(); ctx.rect(dx + 2, ly + 8, dw - 4, lh - 10); ctx.clip();   // (a long description stays inside its box)
  if (row) {
    const it = G.item(row.id);
    X.sunken(ctx, dx + 7, ly + 10, 30, 30); U.icon(ctx, it.icon, dx + 8, ly + 11, 1.75);
    U.textBlock(ctx, it.name, dx + 42, ly + 11, dw - 48, { size: 8.5, weight: 'bold', raw: true, shadow: false, color: C.text, lineHeight: 10 });
    const stats = [it.dmg && `Damage ${it.dmg}`, it.def && `Defense ${it.def}`, it.heal && `Heals ${it.heal}`, it.maxHp && `Max HP +${it.maxHp}`, `Base value $${it.value}`].filter(Boolean);
    stats.forEach((s2, i) => X.txt(ctx, s2, dx + 8, ly + 46 + i * 10, { size: 7.5, color: C.dim }));
    const sy = ly + 48 + stats.length * 10;
    if (it.type === 'clothing') {
      const look = g.player.currentLook();
      if (it.slot === 'top') { look.top = it.style; look.shirt = it.color; look.shirt2 = it.color2 || undefined; }
      else { look.bottom = it.style; look.pants = it.color; }
      const sh = G.assets.character(look);
      X.sunken(ctx, dx + dw / 2 - 26, sy, 52, 70, '#e5e0d4');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sh.img, Math.floor(G.loop.time * 3) % 2 ? sh.fw : 0, 0, sh.fw, sh.fh, dx + dw / 2 - sh.fw * 1.4, sy + 3, sh.fw * 2.8, sh.fh * 2.8);
      X.txt(ctx, 'Preview', dx + dw / 2, sy + 72, { size: 7, align: 'center', color: C.dim });
    } else U.textBlock(ctx, it.desc || '', dx + 8, sy, dw - 16, { size: 7.5, raw: true, shadow: false, color: C.text, lineHeight: 9.5 });
    if (it.type === 'weapon' && g.player.weaponItem) {
      const diff = it.dmg - g.player.weaponItem.dmg;
      X.txt(ctx, `${diff >= 0 ? '▲ +' : '▼ '}${diff} vs equipped`, dx + 8, ly + lh - 12, { size: 7.5, color: diff >= 0 ? C.good : C.bad, weight: 'bold' });
    }
  }
  ctx.restore();
  // buttons
  const by = win.y + win.h - 32;
  const buy = X.button(ctx, win.x + win.w - 140, by, 64, 16, this.tab === 0 ? 'Buy' : 'Sell', { selected: true, disabled: !row });
  const cl = X.button(ctx, win.x + win.w - 70, by, 64, 16, 'Close');
  if (buy.clicked && row) { m.pressed = false; this.act(row); }
  if (cl.clicked) { m.pressed = false; G.audio.play('back'); this.close(); }
  if (this.msgT > 0) { X.glyph(ctx, 'error', win.x + 10, by + 2.5, 11); X.txt(ctx, X.fit(ctx, this.msg, win.w - 180, 8), win.x + 25, by + 8.5, { size: 8, baseline: 'middle', color: C.bad }); }
  const rep = g.world.getRep(shop.region);
  X.status(ctx, win.x, win.y + win.h - 12, win.w, [{ text: `Your cash: $${g.player.gold}`, w: 110, icon: 'money' }, { text: `Merchant: $${this.state.gold}`, w: 100 }, { text: `Prices follow your ${G.REGIONS[shop.region].name} reputation (${rep}) and local tension` }]);
});

// ------------------------------------------------------------------------------------------------ Settings
skin(G.SettingsScene, function (ctx) {
  U.dim(ctx, 0.5);
  const TABS = G.SettingsScene.TABS, m = G.input.mouse;
  const W = 380, H = Math.min(R.uiH - 10, 320), x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
  const win = X.window(ctx, x, y, W, H, { title: 'Settings', icon: 'gear', close: isTop(this) && !this.rebinding });
  if (win.close) X.closeTop();
  const px = win.x + 6, pageY = win.y + 20, pw = win.w - 12, ph = win.h - 20 - 26;
  const hit = X.tabs(ctx, px, win.y + 5, pw, TABS, this.tab, { page: [px, pageY, pw, ph] });
  if (hit >= 0 && !this.rebinding) { this.tab = hit; this.sel = 0; this.xpScroll = 0; G.audio.play('select'); }
  const opts = this.options(), rh = 15, vis = Math.floor((ph - 10) / rh), tab = this.tab;
  this.xpScroll = G.util.clamp(this.xpScroll || 0, 0, Math.max(0, opts.length - vis));
  if (this.sel < this.xpScroll) this.xpScroll = this.sel;
  if (this.sel >= this.xpScroll + vis) this.xpScroll = this.sel - vis + 1;
  const sb = opts.length > vis;
  if (sb) this.xpScroll = X.scroll(ctx, px + pw - 11, pageY + 1, ph - 2, this.xpScroll, vis, opts.length, 'setList', [px, pageY, pw, ph]);
  const nBind = tab === 3 ? G.input.rebindable.length : 0, cw = 128;
  opts.slice(this.xpScroll, this.xpScroll + vis).forEach((o, k) => {
    const i = k + this.xpScroll, ry = pageY + 5 + k * rh, rx = px + 8, rw = pw - 16 - (sb ? 11 : 0), ctlX = rx + rw - cw;
    const rowHover = U.inRect(m.ux, m.uy, rx - 3, ry, rw + 6, rh) && !this.rebinding;
    if (rowHover && m.moved) this.sel = i;
    if (this.sel === i) { ctx.fillStyle = 'rgba(226,223,219,0.45)'; X.rrect(ctx, rx - 3, ry, rw + 6, rh, 2); ctx.fill(); ctx.strokeStyle = '#d5d0c4'; ctx.lineWidth = X.hp(); ctx.stroke(); ctx.lineWidth = 1; }
    const isToggle = (o.value === 'On' || o.value === 'Off') && o.act && !o.left;
    if (isToggle) {
      const c = X.check(ctx, rx, ry + 3, o.value === 'On', o.label, { w: rw, h: 9 });
      if (c.clicked && !this.rebinding) { m.pressed = false; this.sel = i; o.act(); G.audio.play('select'); }
      return;
    }
    X.txt(ctx, X.fit(ctx, o.label, rw - cw - 8, 8), rx, ry + rh / 2 + 0.5, { size: 8, baseline: 'middle' });
    if (i < nBind) {   // a key: a "hotkey" field
      const waiting = this.rebinding && i === this.sel;
      X.sunken(ctx, ctlX, ry + 2, cw, 11, waiting ? '#e4d3ae' : '#e8e3d7');
      if (waiting) X.stroke(ctx, ctlX, ry + 2, cw, 11, '#b19762');
      X.txt(ctx, waiting ? 'Press a key...' : o.value, ctlX + cw / 2, ry + 8, { size: 8, align: 'center', baseline: 'middle', weight: waiting ? 'normal' : 'bold' });
      if (!this.rebinding && m.pressed && U.inRect(m.ux, m.uy, ctlX, ry + 2, cw, 11)) { m.pressed = false; this.sel = i; o.act(); }
    } else if (o.frac != null) {   // a trackbar
      const nv = X.track(ctx, ctlX, ry + 1, cw - 30, o.frac, 'set:' + tab + ':' + i);
      X.txt(ctx, o.value, ctlX + cw, ry + rh / 2 + 0.5, { size: 8, align: 'right', baseline: 'middle' });
      if (nv != null && Math.abs(nv - o.frac) > 0.04) { const steps = Math.round((nv - o.frac) / 0.05), f = steps > 0 ? o.right : o.left; for (let n = 0; n < Math.abs(steps) && f; n++) f(); this.sel = i; }
    } else if (o.names) {   // a combo box with a drop-down list
      const c = X.combo(ctx, ctlX, ry + 1.5, cw, 12, o.value, { focus: this.sel === i });
      if (c.clicked && !this.rebinding) { m.pressed = false; this.sel = i; X.openDropdown('set:' + tab + ':' + i, ctlX, ry + 14, cw, o.names, o.idx, (j) => o.set(j)); }
    } else if (o.left || o.right) {   // a spin box
      X.sunken(ctx, ctlX, ry + 1.5, cw - 22, 12);
      X.txt(ctx, o.value, ctlX + 4, ry + 8, { size: 8, baseline: 'middle' });
      const dn = X.arrowButton(ctx, ctlX + cw - 21, ry + 1.5, 10, 12, -1), up = X.arrowButton(ctx, ctlX + cw - 10, ry + 1.5, 10, 12, 1);
      if (dn.clicked && o.left) { m.pressed = false; this.sel = i; o.left(); G.audio.play('select'); }
      if (up.clicked && o.right) { m.pressed = false; this.sel = i; o.right(); G.audio.play('select'); }
    } else if (o.field) {   // a text field: click to edit
      const hov = U.inRect(m.ux, m.uy, ctlX, ry + 1.5, cw, 12);
      X.sunken(ctx, ctlX, ry + 1.5, cw, 12, hov ? '#e6e1d5' : '#e8e3d7');
      if (hov) X.stroke(ctx, ctlX, ry + 1.5, cw, 12, '#7b776f');
      X.txt(ctx, X.fit(ctx, o.value, cw - 8, 8), ctlX + 4, ry + 8, { size: 8, baseline: 'middle' });
      if (hov && m.pressed && !this.rebinding) { m.pressed = false; this.sel = i; o.act(); }
    } else if (o.act && o.value) {   // a command with a status beside it
      const bw = 52, b = X.button(ctx, ctlX + cw - bw, ry + 1, bw, 13, 'Test', { size: 8 });
      X.txt(ctx, X.fit(ctx, o.value, cw - bw - 6, 7.5), ctlX + cw - bw - 4, ry + 8, { size: 7.5, align: 'right', baseline: 'middle', color: /Works|Ready/.test(o.value) ? C.good : /Fail|Needs|Off/.test(o.value) ? C.bad : C.dim });
      if (b.clicked && !this.rebinding) { m.pressed = false; this.sel = i; o.act(); G.audio.play('confirm'); }
    } else if (o.act) {   // a command button
      const b = X.button(ctx, ctlX, ry + 1, cw, 13, o.label.replace(/^Reset /, 'Reset '), { size: 8 });
      if (b.clicked && !this.rebinding) { m.pressed = false; this.sel = i; o.act(); G.audio.play('confirm'); }
    }
  });
  const ok = X.button(ctx, win.x + win.w - 76, win.y + win.h - 21, 68, 16, 'OK', { selected: true, disabled: !!this.rebinding });
  if (ok.clicked) { m.pressed = false; G.audio.play('back'); G.scenes.remove(this); }
});

// ------------------------------------------------------------------------------------------------ Journal
skin(G.JournalScene, function (ctx) {
  U.dim(ctx, 0.5);
  const W = 480, H = 296, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
  const win = X.window(ctx, x, y, W, H, { title: 'Journal', icon: 'book', close: isTop(this) });
  if (win.close) X.closeTop();
  const px = win.x + 6, pageY = win.y + 20, pw = win.w - 12, ph = win.h - 26;
  const hit = X.tabs(ctx, px, win.y + 5, pw, G.JournalScene.TABS, this.tab, { page: [px, pageY, pw, ph], pageFill: '#e8e3d7' });
  if (hit >= 0) { this.tab = hit; this.scroll = 0; G.audio.play('select'); }
  // the old page body, placed inside the tab page (it clips itself to x+4 .. and cy-2 .. H-70)
  this.drawBody(ctx, x - 4, pageY - 44, W, ph + 60);
});

// ------------------------------------------------------------------------------------------------ Skills (+ Statistics)
// the abilities skills and effects modify. The attributes have their own meters, and luck is never listed (the
// hidden fate system adds to it, js/game/fate.js).
const STAT_LABEL = { charisma: 'Charisma', intimidate: 'Intimidation', barter: 'Bartering', repGain: 'Reputation Gain', stealth: 'Stealth', alcoholResist: 'Alcohol Tolerance',
  drugMastery: 'Drug Handling', meleeDmg: 'Melee Damage', meleeStamina: 'Melee Stamina', damageResist: 'Damage Resistance', gunDmg: 'Gun Damage', reloadSpeed: 'Reload Speed', maxHp: 'Max Health' };
function statRows(p) {
  const names = new Set(Object.keys(G.BASE_STATS || {}));
  for (const id in G.SKILLS) for (const k in G.SKILLS[id].fx || {}) names.add(k);
  for (const n of ['luck', 'strength', 'knowledge', 'accuracy']) names.delete(n);
  return [...names].map((n) => {
    const total = G.skills.stat(p, n), temp = (G.effects.statBonus(p, n) || 0) + (G.needs ? G.needs.statBonus(p, n) || 0 : 0) + (G.love && G.love.statBonus ? G.love.statBonus(p, n) || 0 : 0);
    return { n, label: STAT_LABEL[n] || G.util.capitalize(n.replace(/([A-Z])/g, ' $1').toLowerCase()), base: total - temp, temp, total };
  });
}
const num = (v) => (Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : v.toFixed(1));
skin(G.SkillsScene, function (ctx) {
  U.dim(ctx, 0.5);
  const p = this.p, s = p.skills, m = G.input.mouse;
  const W = Math.min(620, R.uiW - (this.inPhone ? 60 : 16)), H = 350, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
  const win = X.window(ctx, x, y, W, H, { title: 'Skills', icon: 'gear', close: isTop(this) });
  if (win.close) X.closeTop();
  this.xpTab = this.xpTab || 0;
  const px = win.x + 6, pageY = win.y + 20, pw = win.w - 12, ph = win.h - 26;
  const hit = X.tabs(ctx, px, win.y + 5, pw, ['Skill Tree', 'Statistics'], this.xpTab, { page: [px, pageY, pw, ph] });
  if (hit >= 0) { this.xpTab = hit; G.audio.play('select'); }
  // header: level, XP bar, points
  const need = G.xpToNext(s.level), hy = pageY + 6;
  X.txt(ctx, `Level ${s.level}`, px + 8, hy + 1, { size: 9, weight: 'bold', color: C.head });
  X.progress(ctx, px + 58, hy, 130, 10, s.xp / need, '#2f2f2f', { label: `${s.xp} / ${need} XP` });
  if (s.points > 0) { X.glyph(ctx, 'good', px + 196, hy - 0.5, 11); X.txt(ctx, `${G.util.plural(s.points, 'point')} to spend`, px + 210, hy + 1, { size: 8.5, weight: 'bold', color: C.good }); }
  else X.txt(ctx, 'No points to spend', px + 196, hy + 1, { size: 8.5, color: C.dim });
  X.txt(ctx, `Charisma ${G.skills.charisma(p)}   ·   Intimidation ${G.skills.intimidation(p)}`, px + pw - 8, hy + 1, { size: 8.5, align: 'right' });
  if (this.xpTab === 1) return drawStats.call(this, ctx, px, hy + 16, pw, pageY + ph - hy - 18);
  // the tree
  const top = hy + 16, colW = (pw - 12) / G.SKILL_BRANCHES.length, rowH = 34, box = 22, treeH = rowH * 6 + 20;
  this.layout = {};
  G.SKILL_BRANCHES.forEach((b, bi) => {
    const cx0 = px + 6 + bi * colW;
    ctx.fillStyle = bi % 2 ? '#e6e1d5' : '#e8e3d7'; ctx.fillRect(cx0 + 1, top, colW - 2, treeH);
    ctx.fillStyle = X.vgrad(ctx, top, 13, [0, '#e8e3d7', 1, '#e0dbcf']); ctx.fillRect(cx0 + 1, top, colW - 2, 13); X.hline(ctx, cx0 + 1, top + 13, colW - 2, '#cccbc8');
    ctx.fillStyle = b.color; ctx.fillRect(cx0 + 4, top + 4, 5, 5);
    X.txt(ctx, X.fit(ctx, b.name, colW - 18, 8, 'bold'), cx0 + colW / 2 + 3, top + 7, { size: 8, align: 'center', baseline: 'middle', weight: 'bold', color: C.head });
  });
  X.stroke(ctx, px + 6, top, pw - 12, treeH, '#cccbc8');
  for (const id in G.SKILLS) {
    const k = G.SKILLS[id], bi = G.SKILL_BRANCHES.findIndex((b) => b.id === k.branch);
    this.layout[id] = { cx: px + 6 + bi * colW + colW * (0.25 + k.pos[0] * 0.5), cy: top + 30 + k.pos[1] * rowH };
  }
  for (const id in G.SKILLS) {
    const a = this.layout[id];
    for (const [rid, n] of (G.SKILLS[id].req || []).slice(0, 1)) {
      const b = this.layout[rid], ok = G.skills.rank(p, rid) >= n;
      ctx.strokeStyle = ok ? '#8d877d' : '#d3cec2'; ctx.lineWidth = ok ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(b.cx, b.cy + box / 2); ctx.lineTo(a.cx, a.cy - box / 2); ctx.stroke();
    }
  }
  ctx.lineWidth = 1;
  for (const id in G.SKILLS) {
    const k = G.SKILLS[id], { cx, cy } = this.layout[id], rank = G.skills.rank(p, id), why = G.skills.blocker(p, id);
    const branch = G.SKILL_BRANCHES.find((b) => b.id === k.branch), bx = cx - box / 2, by = cy - box / 2;
    const hover = U.inRect(m.ux, m.uy, bx - 4, by - 2, box + 8, box + 14);
    if (hover && m.moved) this.sel = id;
    if (hover && m.pressed) { m.pressed = false; this.sel = id; this.learn(id); }
    const sel = this.sel === id, available = !why;
    ctx.fillStyle = X.vgrad(ctx, by, box, rank > 0 ? [0, '#e6d7b5', 1, '#d5ba81'] : available ? X.BTN.green : [0, '#e8e3d7', 1, '#e1dcd0']);
    X.rrect(ctx, bx, by, box, box, 3); ctx.fill();
    ctx.strokeStyle = sel ? '#837d73' : rank > 0 ? '#a18652' : available ? '#655e66' : '#c8c6c4'; ctx.lineWidth = sel ? 1.6 : X.hp(); ctx.stroke(); ctx.lineWidth = 1;
    if (available && !sel) { ctx.strokeStyle = `rgba(81,115,88,${0.35 + 0.35 * Math.sin(G.loop.time * 5)})`; X.rrect(ctx, bx - 1.5, by - 1.5, box + 3, box + 3, 4); ctx.stroke(); }
    ctx.globalAlpha = rank > 0 || available ? 1 : 0.62; U.icon(ctx, k.icon, bx + 3, by + 3); ctx.globalAlpha = 1;
    if (this.flash > 0 && this.flashId === id) { ctx.fillStyle = `rgba(223,203,159,${this.flash})`; ctx.fillRect(bx, by, box, box); }
    for (let i = 0; i < k.ranks; i++) { ctx.fillStyle = i < rank ? branch.color : '#d4cfc3'; ctx.fillRect(cx - (k.ranks * 4) / 2 + i * 4 + 0.5, by + box - 3, 3, 2); }
    const maxW = k.pos[0] === 0.5 ? colW - 6 : colW / 2 - 2, size = U.measure(ctx, k.name, 6.5) > maxW ? 6 : 6.5, col = rank > 0 ? C.text : available ? C.good : '#5e5a52';
    const words = G.i18n.t(k.name).split(' ');
    if (U.measure(ctx, k.name, size) > maxW && words.length > 1) {
      const half = Math.ceil(words.length / 2);
      X.txt(ctx, words.slice(0, half).join(' '), cx, by + box + 1, { size: 6, align: 'center', color: col });
      X.txt(ctx, words.slice(half).join(' '), cx, by + box + 7, { size: 6, align: 'center', color: col });
    } else X.txt(ctx, k.name, cx, by + box + 2, { size, align: 'center', color: col });
  }
  // details
  const dy = top + treeH + 6, dh = pageY + ph - dy - 6, k = G.SKILLS[this.sel];
  X.group(ctx, px + 6, dy - 2, pw - 12, dh + 2, 'Description');
  if (k) {
    const rank = G.skills.rank(p, k.id), why = G.skills.blocker(p, k.id), branch = G.SKILL_BRANCHES.find((b) => b.id === k.branch);
    U.icon(ctx, k.icon, px + 14, dy + 10, 1.25);
    X.txt(ctx, k.name, px + 38, dy + 9, { size: 9.5, weight: 'bold', color: C.head });
    X.txt(ctx, `${branch.name} · Rank ${rank}/${k.ranks}`, px + pw - 14, dy + 10, { size: 7.5, align: 'right', color: C.dim });
    U.textBlock(ctx, k.desc, px + 38, dy + 21, pw - 60, { size: 7.5, raw: true, shadow: false, color: C.text, lineHeight: 9.5 });
    const status = rank >= k.ranks ? 'Fully learned.' : why ? why : 'Ready to learn.';
    X.glyph(ctx, rank >= k.ranks ? 'good' : why ? 'warning' : 'info', px + 38, dy + dh - 13, 9);
    X.txt(ctx, status, px + 50, dy + dh - 12, { size: 7.5, color: rank >= k.ranks ? C.good : why ? C.bad : C.link });
  }
  if (this.msgT > 0) X.tooltip(ctx, px + pw / 2 - 80, dy - 16, this.msg);
});
function drawStats(ctx, x, y, w, h) {
  const p = this.p, rows = statRows(p), rh = 13;
  // attributes: the points you spent, as ten-block meters
  const aw = 196, ax = x + 6;
  let ty = y;
  if (G.attr && G.attr.of(p)) {
    const names = G.attr.NAMES;
    X.group(ctx, ax, ty, aw, names.length * 16 + 16, 'Attributes');
    names.forEach((n, i) => {
      const ry = ty + 13 + i * 16, v = G.attr.get(p, n);
      X.txt(ctx, G.attr.LABEL[n], ax + 8, ry + 5, { size: 8, baseline: 'middle' });
      X.progress(ctx, ax + 70, ry, 96, 10, v / 10, '#8d877d');
      X.txt(ctx, String(v), ax + aw - 8, ry + 5, { size: 8, baseline: 'middle', align: 'right', weight: 'bold' });
    });
    ty += names.length * 16 + 22;
  }
  X.glyph(ctx, 'info', ax, ty + 2, 10);
  U.textBlock(ctx, 'Base values come from your attributes, learned skills and what you wear. Temporary changes come from drink, drugs, medicine, hunger, tiredness and how you feel, and they wear off.', ax + 14, ty + 2, aw - 16, { size: 7.5, raw: true, shadow: false, color: C.dim, lineHeight: 9.5 });
  // abilities: base and temporary apart, temporary changes marked up or down
  const lx = ax + aw + 8, lw = x + w - 6 - lx, cols = [{ label: 'Ability', w: lw - 196 }, { label: 'Base', w: 56, align: 'right' }, { label: 'Temporary', w: 80, align: 'right' }, { label: 'Total', align: 'right' }];
  const lh = Math.min(h - 4, 14 + rows.length * rh + 2);
  X.sunken(ctx, lx, y + 4, lw, lh);
  X.header(ctx, lx + 1, y + 5, lw - 2, cols);
  rows.forEach((r, i) => {
    const ry = y + 18 + i * rh;
    if (ry + rh > y + 4 + lh) return;
    X.row(ctx, lx + 1, ry, lw - 2, rh, { alt: i % 2 === 1 });
    const mid = ry + rh / 2 + 0.5, changed = Math.abs(r.temp) >= 0.05, up = r.temp > 0, col = up ? C.good : C.bad;
    X.txt(ctx, r.label, lx + 6, mid, { size: 8, baseline: 'middle' });
    let cx = lx + 1 + cols[0].w;
    X.txt(ctx, num(r.base), cx + 56 - 5, mid, { size: 8, baseline: 'middle', align: 'right' }); cx += 56;
    if (changed) {
      const tv = (up ? '+' : '') + num(r.temp), ax2 = cx + 80 - 5 - U.measure(ctx, tv, 8, 'bold') - 6, ay = ry + rh / 2;
      ctx.fillStyle = col; ctx.beginPath();
      if (up) { ctx.moveTo(ax2 - 2.5, ay + 1.5); ctx.lineTo(ax2 + 2.5, ay + 1.5); ctx.lineTo(ax2, ay - 2); } else { ctx.moveTo(ax2 - 2.5, ay - 1.5); ctx.lineTo(ax2 + 2.5, ay - 1.5); ctx.lineTo(ax2, ay + 2); }
      ctx.fill();
      X.txt(ctx, tv, cx + 80 - 5, mid, { size: 8, baseline: 'middle', align: 'right', color: col, weight: 'bold' });
    } else X.txt(ctx, '—', cx + 80 - 5, mid, { size: 8, baseline: 'middle', align: 'right', color: '#b8b6b4' });
    X.txt(ctx, num(r.total), lx + lw - 6, mid, { size: 8, baseline: 'middle', align: 'right', weight: 'bold', color: changed ? col : C.text });
  });
}
// ------------------------------------------------------------------------------------------------ Character creator / barber
const LE = G.LookEditor && G.LookEditor.prototype;
if (LE) {
  const _rows = LE.drawRows, _prev = LE.drawPreview;
  LE.drawPreview = function (ctx, look, x, y, w, h) {
    if (!X.on) return _prev.apply(this, arguments);
    X.sunken(ctx, x, y, w, h, '#e8e3d7');
    ctx.fillStyle = X.vgrad(ctx, y + h * 0.55, h * 0.45, [0, 'rgba(233,232,231,0)', 1, 'rgba(219,217,215,0.9)']); ctx.fillRect(x + 1, y + h * 0.55, w - 2, h * 0.45 - 1);
    const _p = U.panel; U.panel = () => {};
    try { _prev.apply(this, arguments); } finally { U.panel = _p; }
  };
  LE.drawRows = function (ctx, x, y, w, rowH = 17) {
    if (!X.on) return _rows.apply(this, arguments);
    const rows = this.visible(), m = G.input.mouse, gap = 1;
    let clicked = null;
    X.sunken(ctx, x, y - 1, w, rows.filter((r) => r.type !== 'button').length * (rowH + gap) + 2);
    rows.forEach((row, i) => {
      const ry = y + i * (rowH + gap), sel = this.sel === i;
      if (row.type === 'button') {
        const b = X.button(ctx, x, ry + 3, w, rowH, row.label, { selected: sel, size: 9, accent: row.key === '_start' || row.key === '_ok', weight: row.key === '_start' || row.key === '_ok' ? 'bold' : 'normal' });
        if (b.hover && m.moved) this.sel = i;
        if (b.clicked) { m.pressed = false; clicked = row.key; }
        return;
      }
      X.row(ctx, x + 1, ry, w - 2, rowH, { selected: sel, alt: i % 2 === 1 });
      X.txt(ctx, row.label, x + 7, ry + rowH / 2 + 0.5, { size: 8, baseline: 'middle', weight: sel ? 'bold' : 'normal' });
      const vx = x + w * 0.4, vw = w * 0.6 - 6;
      if (row.colors) {
        const n = row.colors.length, sw = Math.min(12, (vw - 4) / n);
        X.rawFill = true;
        row.colors.forEach((c, k) => {
          const cx = vx + k * sw;
          ctx.fillStyle = c; ctx.fillRect(cx + 1, ry + 3, sw - 2, rowH - 6);
          X.stroke(ctx, cx + 1, ry + 3, sw - 2, rowH - 6, 'rgba(68,66,62,0.45)');
          if (this.v[row.key] === c) { ctx.strokeStyle = '#837d73'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 0.25, ry + 1.75, sw + 0.5, rowH - 3.5); ctx.lineWidth = 1; }
          if (m.pressed && U.inRect(m.ux, m.uy, cx, ry, sw, rowH)) { this.v[row.key] = c; this.sel = i; G.audio.play('select'); }
        });
        X.rawFill = false;
      } else if (row.type === 'text') {
        X.sunken(ctx, vx, ry + 2, vw, rowH - 4, '#e8e3d7');
        if (sel) X.stroke(ctx, vx, ry + 2, vw, rowH - 4, '#7b776f');
        const empty = !this.v[row.key] && !sel;
        X.txt(ctx, empty ? 'Type a name...' : this.valueLabel(row), vx + 4, ry + rowH / 2 + 0.5, { size: 8, baseline: 'middle', color: empty ? '#9b9997' : C.text });
      } else {
        X.sunken(ctx, vx, ry + 2, vw, rowH - 4, '#e8e3d7');
        X.txt(ctx, this.valueLabel(row), vx + vw / 2, ry + rowH / 2 + 0.5, { size: 8, align: 'center', baseline: 'middle' });
        const lb = X.arrowButton(ctx, vx + 1, ry + 2.5, 13, rowH - 5, -1), rb = X.arrowButton(ctx, vx + vw - 14, ry + 2.5, 13, rowH - 5, 1);
        if (lb.clicked) { m.pressed = false; this.sel = i; this.cycle(row, -1); }
        if (rb.clicked) { m.pressed = false; this.sel = i; this.cycle(row, 1); }
      }
      if (m.pressed && U.inRect(m.ux, m.uy, x, ry, w * 0.4, rowH)) this.sel = i;
    });
    return clicked;
  };
}
// the classic desktop blue behind the setup screens
function desktop(ctx) {
  R.clear('#75716a'); R.uiTransform();
  ctx.fillStyle = X.vgrad(ctx, 0, R.uiH, [0, '#87837b', 1, '#67635c']); X.rawFill = true; ctx.fillRect(0, 0, R.uiW, R.uiH); X.rawFill = false;
}
// a wizard page: a white header band with a title, a subtitle and a picture, then the page
function wizard(ctx, x, y, w, h, title, head, sub, glyph, close) {
  const win = X.window(ctx, x, y, w, h, { title, icon: glyph, close });
  ctx.fillStyle = '#e8e3d7'; ctx.fillRect(win.x, win.y, win.w, 32);
  X.hline(ctx, win.x, win.y + 32, win.w, '#b8b7b4'); X.hline(ctx, win.x, win.y + 32 + X.hp(), win.w, '#e8e3d7');
  X.txt(ctx, head, win.x + 12, win.y + 6, { size: 9.5, weight: 'bold' });
  X.txt(ctx, sub, win.x + 22, win.y + 18, { size: 8, color: C.dim });
  X.glyph(ctx, glyph, win.x + win.w - 32, win.y + 5, 22);
  return { close: win.close, x: win.x, y: win.y + 34, w: win.w, h: win.h - 34 };
}
X.desktop = desktop; X.wizard = wizard;
skin(G.CharacterCreatorScene, function (ctx) {
  desktop(ctx);
  const W = Math.min(580, R.uiW - 16), H = 340, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const pg = wizard(ctx, x, y, W, H, 'New Game - Create Your Character', 'Create your character', 'Choose a name and how you look.', 'person', isTop(this));
  if (pg.close) X.closeTop();
  this.editor.drawPreview(ctx, this.look(), pg.x + 8, pg.y + 6, 180, pg.h - 14);
  const k = this.editor.drawRows(ctx, pg.x + 196, pg.y + 7, pg.w - 204, 15);
  if (k) this.act(k);
  if (this.error > 0) X.tooltip(ctx, pg.x + 196, pg.y + pg.h - 28, 'Please enter a name.');
});

// ------------------------------------------------------------------------------------------------ Main menu
skin(G.MenuScene, function (ctx) {
  this.drawBackdrop(ctx);
  R.uiTransform();
  const wm = G.wordmark;
  const n = this.items.length, W = 236, bannerH = 84, H = X.TB + bannerH + 14 + n * 24 + 16 + 14, x = 30, y = Math.max(12, Math.round((R.uiH - H) / 2));
  const win = X.window(ctx, x, y, W, H, { title: G.config.TITLE, close: false });
  // the banner: a dark band holding the wordmark, like an old setup wizard
  ctx.fillStyle = X.vgrad(ctx, win.y, bannerH, [0, '#34322e', 1, '#1b1917']); ctx.fillRect(win.x, win.y, win.w, bannerH);
  ctx.fillStyle = X.grad(ctx, win.x, 0, win.x + win.w, 0, [0, 'rgba(162,157,148,0.25)', 1, 'rgba(162,157,148,0)']); ctx.fillRect(win.x, win.y, win.w, bannerH);
  X.hline(ctx, win.x, win.y + bannerH, win.w, '#a7a39b'); X.hline(ctx, win.x, win.y + bannerH + X.hp(), win.w, '#e8e3d7');
  const title = String(G.config.TITLE).toUpperCase(), tx = win.x + 14;
  if (wm) { const tw = wm.draw(ctx, title, tx, win.y + 10, 30); wm.rule(ctx, tx, win.y + 48, Math.min(W - 40, tw), this.t); }
  else U.text(ctx, title, tx, win.y + 12, { raw: true, size: 30, weight: 'bold', family: X.CAPTION, color: '#d6cbb6' });
  ctx.strokeStyle = '#a3c7b7'; ctx.lineWidth = 1.1; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const ph = ((i / 120) * 1.6 + this.t / 0.9) % 1; const v = ph > 0.46 && ph < 0.5 ? 1 : ph >= 0.5 && ph < 0.54 ? -0.6 : 0; const yy = win.y + 62 - v * 6; if (i === 0) ctx.moveTo(tx + i, yy); else ctx.lineTo(tx + i, yy); }
  ctx.stroke(); ctx.lineWidth = 1;
  U.text(ctx, 'A WORLD THAT REMEMBERS', tx, win.y + 70, { raw: true, shadow: false, size: 7.5, weight: 'bold', family: X.CAPTION, color: '#c3c0bc' });
  // the commands
  const gy = win.y + bannerH + 8;
  X.group(ctx, win.x + 6, gy, win.w - 12, n * 24 + 12, 'What would you like to do?');
  const glyphs = { Continue: 'good', 'New Game': 'person', 'Load Game': 'folder', Settings: 'gear', Credits: 'info', Quit: 'error' };
  this.items.forEach((it, i) => {
    const b = X.button(ctx, win.x + 16, gy + 12 + i * 24, win.w - 32, 19, it.label, { selected: this.sel === i, disabled: it.disabled, align: 'left', icon: glyphs[it.label] || 'app', size: 9 });
    if (b.hover && G.input.mouse.moved) this.sel = i;
    if (b.clicked) { G.input.mouse.pressed = false; this.activate(i); }
  });
  X.status(ctx, win.x, win.y + win.h - 12, win.w, [{ text: this.latest ? `Last save: ${this.latest.meta.mapName}, Day ${this.latest.meta.day}` : 'No saved games', w: win.w - 56 }, { text: 'v' + G.config.VERSION, align: 'right' }]);
});

// ------------------------------------------------------------------------------------------------ message boxes
function msgBox(ctx, scene, text, title, glyph, buttons, sel) {
  const W = 270, lines = U.wrap(ctx, text, W - 60, 8.5), H = X.TB + Math.max(30, lines.length * 11 + 14) + 30;
  const x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const win = X.window(ctx, x, y, W, H, { title: title || G.config.TITLE, icon: glyph, close: isTop(scene) });
  if (win.close) X.closeTop();
  X.glyph(ctx, glyph, win.x + 12, win.y + 10, 22);
  lines.forEach((l, i) => X.txt(ctx, l, win.x + 44, win.y + 12 + i * 11, { size: 8.5 }));
  const bw = 62, gap = 6, total = buttons.length * bw + (buttons.length - 1) * gap, bx = win.x + (win.w - total) / 2, by = win.y + win.h - 22;
  return buttons.map((l, i) => X.button(ctx, bx + i * (bw + gap), by, bw, 16, l, { selected: sel === i, size: 8.5 }));
}
skin(G.ConfirmScene, function (ctx) {
  U.dim(ctx, 0.4);
  const [yes, no] = msgBox(ctx, this, this.text, null, 'question', ['Yes', 'No'], this.sel);
  if (yes.hover) this.sel = 0;
  if (no.hover) this.sel = 1;
  if (yes.clicked) { G.input.mouse.pressed = false; this.answer(true); }
  else if (no.clicked) { G.input.mouse.pressed = false; this.answer(false); }
});
skin(G.MessageScene, function (ctx) {
  U.dim(ctx, 0.35);
  msgBox(ctx, this, this.text, this.title, 'info', ['OK'], 0);
  if (G.input.mouse.pressed) G.scenes.remove(this);
});

// ------------------------------------------------------------------------------------------------ Loot
skin(G.LootScene, function (ctx) {
  U.dim(ctx, 0.45);
  const m = G.input.mouse, W = 440, H = 252, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const title = this.c.kind === 'chest' ? (this.owned ? `${this.c.name} (owned by ${this.game.world.displayName(this.c.owner)})` : this.c.name) : this.c.name;
  const win = X.window(ctx, x, y, W, H, { title, icon: 'folder', close: isTop(this) });
  if (win.close) X.closeTop();
  let top = win.y + 6;
  if (this.owned) { X.glyph(ctx, 'warning', win.x + 8, top, 10); X.txt(ctx, 'Taking anything is theft if someone sees you.', win.x + 22, top + 1, { size: 8, color: '#684f23' }); top += 14; }
  const rh = 12, lh = win.y + win.h - 28 - top, rows = Math.floor((lh - 14) / rh);
  this.scrolls = this.scrolls || [0, 0];
  const col = (list, lx, lw, label, side) => {
    X.sunken(ctx, lx, top, lw, lh);
    X.header(ctx, lx + 1, top + 1, lw - 2, [{ label }]);
    const max = Math.max(0, list.length - rows);
    let s = G.util.clamp(this.scrolls[side], 0, max);
    if (this.side === side) { if (this.sel < s) s = this.sel; if (this.sel >= s + rows) s = this.sel - rows + 1; }
    if (list.length > rows) {
      const ns = X.scroll(ctx, lx + lw - 11, top + 13, lh - 14, s, rows, list.length, 'loot' + side, [lx, top, lw, lh]);
      if (ns !== s) { s = ns; if (this.side === side) this.sel = G.util.clamp(this.sel, s, Math.min(list.length - 1, s + rows - 1)); }
    }
    this.scrolls[side] = s;
    list.slice(s, s + rows).forEach((e, k) => {
      const i = s + k, ry = top + 13 + k * rh, rw = lw - 3 - (list.length > rows ? 11 : 0);
      const r = X.row(ctx, lx + 1.5, ry, rw, rh, { selected: this.side === side && this.sel === i, fill: false });
      U.icon(ctx, e.icon, lx + 4, ry + 1, 0.62);
      X.txt(ctx, X.fit(ctx, e.label, rw - 22, 8), lx + 18, ry + rh / 2 + 0.5, { size: 8, baseline: 'middle' });
      if (r.hover && m.moved) { this.side = side; this.sel = i; }
      if (r.clicked) { m.pressed = false; side === 0 ? this.take(e, true) : this.store(e); }
    });
    if (!list.length) X.txt(ctx, 'This folder is empty.', lx + lw / 2, top + 30, { size: 8, align: 'center', color: C.dim });
  };
  const half = (win.w - 18) / 2;
  col(this.entries(), win.x + 6, half, 'Contents', 0);
  col(this.pEntries(), win.x + 12 + half, half, `Your items ($${this.game.player.gold})`, 1);
  const by = win.y + win.h - 21;
  const ta = X.button(ctx, win.x + 6, by, 72, 16, 'Take All', { icon: 'good', align: 'left', size: 8.5 });
  const cl = X.button(ctx, win.x + win.w - 78, by, 72, 16, 'Close', { size: 8.5, selected: true });
  if (ta.clicked) { m.pressed = false; this.takeAll(); }
  if (cl.clicked) { m.pressed = false; this.close(); }
});

// ------------------------------------------------------------------------------------------------ Save / Load
skin(G.SaveLoadScene, function (ctx) {
  U.dim(ctx, 0.5);
  const m = G.input.mouse, n = this.slots.length, rh = 22, W = 380, H = X.TB + 14 + n * rh + 16 + 30, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const win = X.window(ctx, x, y, W, H, { title: this.mode === 'save' ? 'Save Game' : 'Load Game', icon: this.mode === 'save' ? 'disk' : 'folder', close: isTop(this) });
  if (win.close) X.closeTop();
  const lx = win.x + 6, ly = win.y + 6, lw = win.w - 12, lh = 14 + n * rh + 2;
  X.sunken(ctx, lx, ly, lw, lh);
  X.header(ctx, lx + 1, ly + 1, lw - 2, [{ label: 'Name', w: 120 }, { label: 'Where', w: 120 }, { label: 'Saved', align: 'right' }]);
  this.slots.forEach((slot, i) => {
    const meta = G.saves.meta(slot), ry = ly + 14 + i * rh, dis = this.mode === 'load' && !meta;
    const r = X.row(ctx, lx + 1.5, ry, lw - 3, rh, { selected: this.sel === i, disabled: dis, fill: false });
    X.glyph(ctx, 'disk', lx + 5, ry + 5, 11);
    X.txt(ctx, G.saves.label(slot), lx + 20, ry + 4, { size: 8.5, weight: 'bold', color: dis ? '#9b9997' : C.text });
    if (meta) {
      X.txt(ctx, `$${meta.gold}`, lx + 20, ry + 13, { size: 7, color: C.dim });
      X.txt(ctx, X.fit(ctx, meta.mapName, 112, 8), lx + 122, ry + 4, { size: 8 });
      X.txt(ctx, `Day ${meta.day}, ${meta.time}`, lx + 122, ry + 13, { size: 7, color: C.dim });
      X.txt(ctx, new Date(meta.date).toLocaleDateString(), lx + lw - 6, ry + 4, { size: 7.5, align: 'right', color: C.dim });
      X.txt(ctx, new Date(meta.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), lx + lw - 6, ry + 13, { size: 7, align: 'right', color: C.dim });
    } else X.txt(ctx, '(empty)', lx + 122, ry + 8, { size: 8, color: '#9b9997' });
    if (r.hover && m.moved) this.sel = i;
    if (r.clicked) { m.pressed = false; this.act(i); }
  });
  const by = win.y + win.h - 21, cur = G.saves.meta(this.slots[this.sel]);
  const go = X.button(ctx, win.x + win.w - 210, by, 64, 16, this.mode === 'save' ? 'Save' : 'Load', { selected: true, disabled: this.mode === 'load' && !cur, size: 8.5 });
  const del = X.button(ctx, win.x + win.w - 140, by, 64, 16, 'Delete', { disabled: !cur, size: 8.5 });
  const cl = X.button(ctx, win.x + win.w - 70, by, 64, 16, 'Cancel', { size: 8.5 });
  if (go.clicked) { m.pressed = false; this.act(this.sel); }
  else if (del.clicked && cur) { m.pressed = false; const slot = this.slots[this.sel]; G.scenes.push(new G.ConfirmScene(`Delete ${G.saves.label(slot)}?`, () => G.saves.remove(slot))); }
  else if (cl.clicked) { m.pressed = false; G.audio.play('back'); G.scenes.remove(this); }
});

// ------------------------------------------------------------------------------------------------ Pause
skin(G.PauseScene, function (ctx) {
  U.dim(ctx, 0.5);
  const n = this.items.length, W = 190, H = X.TB + 12 + n * 23 + 10, x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
  const win = X.window(ctx, x, y, W, H, { title: 'Paused', icon: 'app', close: isTop(this) });
  if (win.close) X.closeTop();
  const glyphs = { Resume: 'good', 'Save Game': 'disk', 'Load Game': 'folder', Settings: 'gear', 'Main Menu': 'app', 'Quit Game': 'error' };
  this.items.forEach((label, i) => {
    const b = X.button(ctx, win.x + 12, win.y + 8 + i * 23, win.w - 24, 19, label, { selected: this.sel === i, align: 'left', icon: glyphs[label], size: 9 });
    if (b.hover && G.input.mouse.moved) this.sel = i;
    if (b.clicked) { G.input.mouse.pressed = false; this.activate(i); }
  });
});

// ------------------------------------------------------------------------------------------------ the world map keeps its light labels
if (G.MapScene) G.MapScene.prototype.xpRawText = true;
const _text = U.text;
U.text = function (ctx, str, x, y, o = {}) {
  if (X.on && X.scene && X.scene.xpRawText && !o.raw) return _text.call(this, ctx, str, x, y, Object.assign({}, o, { raw: true }));
  return _text.call(this, ctx, str, x, y, o);
};
})();
