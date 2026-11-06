'use strict';
// Inventory screen: item grid, equipment, details, use/equip/drop/sort. Keyboard, mouse and gamepad.
(() => {
const U = G.ui;
const COLS = 6;

class InventoryScene {
  constructor(game) {
    this.transparent = true;
    this.game = game;
    this.sel = 0;            // 0..size-1 = grid, size.. = equipment slots
    this.eqSlots = ['weapon', 'armor', 'trinket', 'hat', 'mask', 'top', 'bottom', 'shoes'];
    G.audio.play('select');
  }
  get inv() { return this.game.player.inventory; }

  useSel() {
    const p = this.game.player;
    if (this.sel >= this.inv.size) {
      const slot = this.eqSlots[this.sel - this.inv.size];
      if (p.unequip(slot)) G.audio.play('select');
      return;
    }
    const s = this.inv.slots[this.sel];
    if (!s) return;
    const tool = G.item(s.id).type === 'tool';
    if (!p.useFromSlot(this.sel, this.game)) G.audio.play('error');
    else if (tool) G.scenes.remove(this);
  }

  // Drag and drop: press on an item and move the mouse to carry it, let go somewhere to put it there:
  //   another bag slot: the same item stacks, anything else swaps;
  //   an equipment slot: you put it on (if it goes there); an equipped item onto the bag: you take it off;
  //   outside the window: you drop it on the ground.
  // A click that does not move still does what it did (use / equip / unequip).
  slotPress(i) {
    const m = G.input.mouse;
    this.sel = i;
    if (this.idAt(i)) this.drag = { from: i, x: m.ux, y: m.uy, moved: false };
    else this.useSel();
  }
  // the item in a bag slot (0..size-1) or an equipment slot (size..)
  idAt(i) {
    if (i < this.inv.size) return this.inv.slots[i] && this.inv.slots[i].id;
    return this.game.player.equip[this.eqSlots[i - this.inv.size]] || null;
  }
  // once per frame after the slots are drawn; `over` is the slot under the mouse (or null), `outside`: the
  // mouse is off the window
  dragFrame(ctx, over, outside) {
    const d = this.drag, m = G.input.mouse, p = this.game.player, size = this.inv.size;
    if (!d) return;
    const id = this.idAt(d.from);
    if (!id) { this.drag = null; return; }
    if (!d.moved && Math.hypot(m.ux - d.x, m.uy - d.y) > 4) d.moved = true;
    if (m.down) {
      if (d.moved) { ctx.globalAlpha = 0.85; U.icon(ctx, G.item(id).icon, m.ux - 10, m.uy - 10, 1.25); ctx.globalAlpha = 1; }
      return;
    }
    this.drag = null;
    if (!d.moved) { this.sel = d.from; this.useSel(); return; }
    const fromBag = d.from < size;
    if (outside && over == null) {   // off the window: on the ground
      if (fromBag) { this.sel = d.from; this.dropSel(); }
      return;
    }
    if (over == null || over === d.from) return;
    if (fromBag && over < size) { if (this.inv.move(d.from, over)) { this.sel = over; G.audio.play('select'); } return; }
    if (fromBag) {   // onto an equipment slot: only where it is worn
      const it = G.item(id), goes = it.type === 'clothing' ? it.slot : { weapon: 'weapon', armor: 'armor', trinket: 'trinket' }[it.type];
      if (goes !== this.eqSlots[over - size]) { G.audio.play('error'); return; }
      if (p.equipFromSlot(d.from)) { this.sel = over; G.audio.play('select'); }
      return;
    }
    if (over < size) {   // an equipped item onto the bag: take it off, and into that slot if it is free
      const slot = this.eqSlots[d.from - size];
      if (!p.unequip(slot)) { G.audio.play('error'); return; }
      const at = this.inv.slots.findIndex((s, k) => s && s.id === id && s.qty === 1 && k !== over);
      if (!this.inv.slots[over] && at >= 0) this.inv.move(at, over);
      this.sel = this.inv.slots[over] && this.inv.slots[over].id === id ? over : Math.max(0, this.inv.slots.findIndex((s) => s && s.id === id));
      G.audio.play('select');
    }
  }

  dropSel() {
    if (this.sel >= this.inv.size) return;
    const s = this.inv.slots[this.sel];
    if (!s) return;
    // (everything can be dropped, quest items too: a bag holding one never rots away, js/game/containers.js)
    const g = this.game;
    const it = this.inv.removeAt(this.sel, s.qty);
    const near = g.containers.find((c) => c.kind === 'bag' && G.util.dist(c.x, c.y, g.player.x, g.player.y) < 16);
    if (near) {
      const e = near.items.find((x) => x[0] === it.id);
      if (e) e[1] += it.qty; else near.items.push([it.id, it.qty]);
    } else G.containers.createBag(g.world, g.map.id, g.player.x, g.player.y + 2, [[it.id, it.qty]]);
    g.refreshContainers();
    G.audio.play('door');
  }

  update() {
    const I = G.input, size = this.inv.size;
    if (I.wasPressed('cancel') || I.wasPressed('inventory')) { G.audio.play('back'); G.scenes.remove(this); return; }
    const prev = this.sel;
    if (this.sel < size) {
      if (I.wasPressed('left')) this.sel = this.sel % COLS === 0 ? this.sel : this.sel - 1;
      if (I.wasPressed('right')) this.sel = this.sel % COLS === COLS - 1 ? size : this.sel + 1;
      if (I.wasPressed('up')) this.sel = Math.max(0, this.sel - COLS);
      if (I.wasPressed('down')) this.sel = Math.min(size - 1, this.sel + COLS);
    } else {
      const e = this.sel - size;
      if (I.wasPressed('up')) this.sel = size + Math.max(0, e - 1);
      if (I.wasPressed('down')) this.sel = size + Math.min(this.eqSlots.length - 1, e + 1);
      if (I.wasPressed('left')) this.sel = COLS - 1;
    }
    if (prev !== this.sel) G.audio.play('select');
    if (I.wasPressed('confirm')) this.useSel();
    if (I.pressed.has('KeyX') || I.pressed.has('Delete')) this.dropSel();
    if (I.pressed.has('KeyR')) { this.inv.sort(); G.audio.play('select'); }
  }

  render(ctx) {
    U.dim(ctx, 0.55);
    const R = G.renderer, p = this.game.player;
    const W = 440, H = 300, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Inventory', titleSize: 13 });
    const S = 26, gx = x + 14, gy = y + 30;
    const m = G.input.mouse;
    let over = null;
    for (let i = 0; i < this.inv.size; i++) {
      const sx = gx + (i % COLS) * (S + 3), sy = gy + Math.floor(i / COLS) * (S + 3);
      U.slot(ctx, sx, sy, S, { selected: this.sel === i });
      const s = this.inv.slots[i];
      if (s) {
        U.icon(ctx, G.item(s.id).icon, sx + 5, sy + 5);
        if (s.qty > 1) U.text(ctx, String(s.qty), sx + S - 3, sy + S - 10, { size: 7, align: 'right' });
      }
      if (U.inRect(m.ux, m.uy, sx, sy, S, S)) {
        over = i;
        if (m.moved && !this.drag) this.sel = i;
        if (m.pressed) this.slotPress(i);
        if (m.rpressed) { this.sel = i; this.dropSel(); }
      }
    }
    // equipment
    const ex = gx + COLS * (S + 3) + 12;
    U.text(ctx, 'Equipped', ex, gy - 2, { size: 9, weight: 'bold', color: U.colors.borderLight });
    const half = Math.ceil(this.eqSlots.length / 2), colW = Math.max(90, (x + W - 10 - ex) / 2);   // two columns: seven slots now
    this.eqSlots.forEach((slot, i) => {
      const sy = gy + 12 + (i % half) * (S + 2), ex0 = ex;
      { const ex = ex0 + Math.floor(i / half) * colW;
      const idx = this.inv.size + i;
      U.slot(ctx, ex, sy, S, { selected: this.sel === idx, equipped: !!p.equip[slot] });
      if (p.equip[slot]) U.icon(ctx, G.item(p.equip[slot]).icon, ex + 5, sy + 5);
      U.text(ctx, G.util.capitalize(slot), ex + S + 6, sy + 3, { size: 8, color: U.colors.dim });
      U.text(ctx, p.equip[slot] ? G.item(p.equip[slot]).name : '—', ex + S + 6, sy + 14, { size: 8 });
      if (U.inRect(m.ux, m.uy, ex, sy, S, S)) {
        if (m.moved) this.sel = idx;
        over = idx;
        if (m.pressed) this.slotPress(idx);
      }
      }
    });
    // stats
    const sy0 = gy + 12 + half * (S + 2) + 4;
    U.text(ctx, `Health ${Math.ceil(p.hp)}/${p.maxHp}`, ex, sy0, { size: 8 });
    U.text(ctx, `Damage ${p.damage()}   Defense ${p.defense()}`, ex, sy0 + 12, { size: 8 });
    U.text(ctx, `Cash $${p.gold}`, ex, sy0 + 24, { size: 8, color: U.colors.gold });
    U.text(ctx, `Level ${p.skills.level} · Charisma ${G.skills.charisma(p)}`, ex, sy0 + 36, { size: 8, color: '#e8c060' });

    // details
    const dy = y + H - 66;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 10, dy, W - 20, 56);
    let id = null;
    if (this.sel < this.inv.size) id = this.inv.slots[this.sel] && this.inv.slots[this.sel].id;
    else id = p.equip[this.eqSlots[this.sel - this.inv.size]];
    if (id) {
      const it = G.item(id);
      U.icon(ctx, it.icon, x + 16, dy + 6, 1.5);
      U.text(ctx, it.name, x + 46, dy + 5, { size: 11, weight: 'bold' });
      const fx = Object.keys(it.effects || {}).map((e) => G.EFFECTS[e]).filter((e) => !e.hidden).map((e) => e.name);
      const stats = [it.type === 'clothing' ? 'clothing (' + it.slot + ')' : it.cat || it.type, it.dmg && `Damage ${it.dmg}${it.pellets ? 'x' + it.pellets : ''}`, it.gun && `Mag ${it.mag}`, it.gun && G.item(it.ammo).name,
        it.def && `Defense ${it.def}`, it.bulletDef && `+${it.bulletDef} vs bullets`, it.heal && `Heals ${it.heal}`, it.stamina && `Stamina +${it.stamina}`, it.alcohol && 'Alcohol',
        !it.unidentified && fx.length && fx.join(', '), it.maxHp && `Max HP +${it.maxHp}`, it.value && `Value $${it.value}`].filter(Boolean).join(' · ');
      U.text(ctx, stats, x + 46, dy + 19, { size: 8, color: U.colors.dim });
      if (it.illegal && !it.unidentified) U.text(ctx, 'ILLEGAL', x + W - 16, dy + 6, { size: 8, align: 'right', weight: 'bold', color: '#ff7a5a' });
      U.text(ctx, it.desc || '', x + 46, dy + 31, { size: 8 });
    }
    this.dragFrame(ctx, over, !U.inRect(m.ux, m.uy, x, y, W, H));
  }
}

G.InventoryScene = InventoryScene;
})();
