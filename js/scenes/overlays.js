'use strict';
// Overlay scenes: fade transitions, pause menu, confirm/message boxes, waiting & sleeping,
// death screen, ending screen, map view, looting containers, save/load slots.
(() => {
const U = G.ui;

// ---------------------------------------------------------------- Fade
G.TRANSITION = 0.26;   // the dip to black between two places, in seconds
class FadeScene {
  constructor(midpoint, dur = 0.6, card = null) {
    this.transparent = true;
    this.card = card;
    this.midpoint = midpoint;
    this.dur = dur;
    this.t = 0;
    this.called = false;
  }
  update(dt) {
    this.t += dt;
    if (!this.called && this.t >= this.dur / 2) {
      this.called = true;
      if (this.midpoint) this.midpoint();
      if (!G.scenes.stack.includes(this)) return;
    }
    if (this.t >= this.dur) G.scenes.remove(this);
  }
  render(ctx) {
    const h = this.dur / 2;
    const a = this.t < h ? this.t / h : Math.max(0, 1 - (this.t - h) / h);
    G.renderer.screenTransform();
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, G.renderer.W, G.renderer.H);
    if (this.card) G.drawMapCard(ctx, this.card, Math.min(1, Math.max(0, (a - 0.45) / 0.4)));
  }
}

// ---------------------------------------------------------------- Pause
class PauseScene {
  constructor(game) {
    this.transparent = true;
    this.game = game;
    this.sel = 0;
    this.items = ['Resume', 'Save Game', 'Load Game', 'Settings', 'Main Menu'];   // journal and skills live in the phone
    if (G.desktop) this.items.push('Quit Game');
  }
  activate(i) {
    const g = this.game;
    G.audio.play('confirm');
    switch (this.items[i]) {
      case 'Resume': G.scenes.pop(); break;
      case 'Save Game': G.scenes.push(new SaveLoadScene(g, 'save')); break;
      case 'Load Game': G.scenes.push(new SaveLoadScene(g, 'load')); break;
      case 'Settings': G.scenes.push(new G.SettingsScene()); break;
      case 'Main Menu': G.scenes.push(new ConfirmScene('Return to the main menu? Unsaved progress will be lost.', () => G.scenes.replace(new G.MenuScene()))); break;
      case 'Quit Game': G.scenes.push(new ConfirmScene('Quit to desktop? Unsaved progress will be lost.', () => G.platform.quit())); break;
    }
  }
  update() {
    const r = U.nav(this, 'sel', this.items.length);
    if (r === 'confirm') this.activate(this.sel);
    if (r === 'cancel' || G.input.wasPressed('pause')) { G.audio.play('back'); G.scenes.pop(); }
  }
  render(ctx) {
    U.dim(ctx, 0.6);
    const R = G.renderer;
    const w = 160, h = this.items.length * 24 + 44, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: 'Paused', titleSize: 14 });
    const i = U.menu(ctx, this, this.items.map((label) => ({ label })), x + 14, y + 30, w - 28, 20, 4);
    if (i >= 0) this.activate(i);
  }
}

// ---------------------------------------------------------------- Confirm / Message
class ConfirmScene {
  constructor(text, onYes, onNo) {
    this.transparent = true;
    this.text = text; this.onYes = onYes; this.onNo = onNo;
    this.sel = 1;
  }
  answer(yes) {
    G.scenes.remove(this);
    G.audio.play(yes ? 'confirm' : 'back');
    if (yes && this.onYes) this.onYes();
    if (!yes && this.onNo) this.onNo();
  }
  update() {
    const r = U.nav(this, 'sel', 2, { horizontal: true });
    if (r === 'confirm') this.answer(this.sel === 0);
    if (r === 'cancel') this.answer(false);
  }
  render(ctx) {
    U.dim(ctx, 0.5);
    const R = G.renderer, w = 240, x = (R.uiW - w) / 2;
    const lines = U.wrap(ctx, this.text, w - 24, 10);
    const h = lines.length * 14 + 54, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h);
    lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, y + 12 + i * 14, { align: 'center', size: 10 }));
    const by = y + h - 30;
    const yes = U.button(ctx, x + 30, by, 80, 20, 'Yes', { selected: this.sel === 0 });
    const no = U.button(ctx, x + w - 110, by, 80, 20, 'No', { selected: this.sel === 1 });
    if (yes.hover) this.sel = 0;
    if (no.hover) this.sel = 1;
    if (yes.clicked) this.answer(true);
    if (no.clicked) this.answer(false);
  }
}

class MessageScene {
  constructor(text, title) { this.transparent = true; this.text = text; this.title = title; }
  update() {
    if (G.input.wasPressed('confirm') || G.input.wasPressed('cancel') || G.input.wasPressed('interact')) { G.audio.play('select'); G.scenes.remove(this); }
  }
  render(ctx) {
    U.dim(ctx, 0.4);
    const R = G.renderer, w = 260, x = (R.uiW - w) / 2;
    const lines = U.wrap(ctx, this.text, w - 28, 10);
    const h = lines.length * 14 + (this.title ? 52 : 36), y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: this.title });
    lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, y + (this.title ? 28 : 12) + i * 14, { align: 'center', size: 10 }));
    if (G.input.mouse.pressed) G.scenes.remove(this);
  }
}

// ---------------------------------------------------------------- Wait / Sleep
class WaitScene {
  constructor(game, sleeping, foreign = null) {
    this.transparent = true;
    this.game = game;
    this.sleeping = sleeping;
    this.foreign = foreign;   // { bed, owner }: someone else's bed
    const h = game.world.hourF;
    this.hours = sleeping ? Math.max(1, Math.round(((7 - h) + 24) % 24) || 8) : 1;
  }
  update() {
    const I = G.input;
    if (I.wasPressed('left')) { this.hours = Math.max(1, this.hours - 1); G.audio.play('select'); }
    if (I.wasPressed('right')) { this.hours = Math.min(24, this.hours + 1); G.audio.play('select'); }
    if (I.wasPressed('confirm')) this.go();
    if (I.wasPressed('cancel')) { G.audio.play('back'); G.scenes.remove(this); }
  }
  go() {
    const g = this.game, h = this.hours, sleeping = this.sleeping;
    G.scenes.remove(this);
    if (sleeping) G.audio.play('sleep');
    G.scenes.push(new FadeScene(() => {
      if (this.foreign) { G.beds.sleepForeign(g, h, this.foreign.bed, this.foreign.owner); g.banner = { text: `Day ${g.world.day}`, sub: g.world.timeString, t: 2.5 }; return; }
      g.passTime(h, sleeping);
      if (sleeping) { G.saves.write('auto', g); g.toast('You feel rested. (Autosaved)', 'good'); }
      g.banner = { text: `Day ${g.world.day}`, sub: g.world.timeString, t: 2.5 };
    }, 1.4));
  }
  render(ctx) {
    U.dim(ctx, 0.4);
    const R = G.renderer, w = 220, h = 96, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: this.sleeping ? 'Sleep' : 'Wait' });
    const until = G.util.formatTime((this.game.world.minutes + this.hours * 60) % 1440);
    U.text(ctx, `< ${G.util.plural(this.hours, 'hour')} >`, R.uiW / 2, y + 32, { align: 'center', size: 13, weight: 'bold' });
    U.text(ctx, `Until ${until}`, R.uiW / 2, y + 50, { align: 'center', size: 9, color: U.colors.dim });
    const ok = U.button(ctx, x + 20, y + h - 28, 80, 20, 'Confirm', { selected: true });
    const no = U.button(ctx, x + w - 100, y + h - 28, 80, 20, 'Cancel');
    const minus = U.button(ctx, x + 20, y + 26, 22, 20, '-');
    const plus = U.button(ctx, x + w - 42, y + 26, 22, 20, '+');
    if (minus.clicked) this.hours = Math.max(1, this.hours - 1);
    if (plus.clicked) this.hours = Math.min(24, this.hours + 1);
    if (ok.clicked) this.go();
    if (no.clicked) G.scenes.remove(this);
  }
}

// ---------------------------------------------------------------- Death
class DeathScene {
  constructor(game) {
    this.transparent = true;
    this.game = game;
    this.sel = 0;
    this.t = 0;
    const latest = G.saves.latest();
    this.items = [{ label: latest ? `Load ${G.saves.label(latest.slot)}` : 'No save available', disabled: !latest }, { label: 'Main Menu' }];
    this.latest = latest;
  }
  activate(i) {
    if (i === 0 && this.latest) G.startGame({ save: G.saves.read(this.latest.slot) });
    if (i === 1) G.scenes.replace(new G.MenuScene());
  }
  update(dt) {
    this.t += dt;
    const r = U.nav(this, 'sel', 2);
    if (r === 'confirm' && !this.items[this.sel].disabled) this.activate(this.sel);
  }
  render(ctx) {
    U.dim(ctx, Math.min(0.75, this.t));
    const R = G.renderer;
    U.text(ctx, 'You Died', R.uiW / 2, R.uiH / 2 - 60, { size: 30, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#c83a2a' });
    const i = U.menu(ctx, this, this.items, R.uiW / 2 - 80, R.uiH / 2, 160, 20, 6);
    if (i >= 0) this.activate(i);
  }
}

// ---------------------------------------------------------------- Ending (placeholder)
class EndingScene {
  constructor(type, world) {
    this.type = type;
    this.world = world;
    this.t = 0;
    G.audio.setMusic('menu');
  }
  update(dt) {
    this.t += dt;
    if (this.t > 2 && (G.input.wasPressed('confirm') || G.input.wasPressed('cancel') || G.input.mouse.pressed)) G.scenes.replace(new G.MenuScene());
  }
  render(ctx) {
    const R = G.renderer, w = this.world;
    R.clear('#08060c');
    R.uiTransform();
    const titles = { join: 'You Joined Them', destroy: 'You Destroyed Them', neutral: 'You Walked Away' };
    U.text(ctx, titles[this.type] || 'The End', R.uiW / 2, 50, { size: 26, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#e8d8a8' });
    U.text(ctx, '[Placeholder ending — write your epilogue in js/scenes/overlays.js / data]', R.uiW / 2, 90, { size: 9, align: 'center', color: U.colors.dim });
    const lines = [
      `Days survived: ${w.day}`,
      `People killed: ${w.stats.murders}   Animals hunted: ${w.stats.animals}   Crimes: ${w.stats.crimes}`,
      `Reputation — Rural: ${w.getRep('rural')}  City: ${w.getRep('city')}  Forest: ${w.getRep('forest')}`,
      `Bandits: ${w.flags.bandits_destroyed ? 'destroyed' : w.flags.bandits_joined ? 'joined' : 'still out there'}`,
    ];
    lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, 130 + i * 18, { size: 11, align: 'center' }));
  }
}

// ---------------------------------------------------------------- Map view
class MapScene {
  constructor(game) { this.transparent = true; this.game = game; }
  update() {
    const I = G.input;
    if (I.wasPressed('map') || I.wasPressed('cancel') || I.wasPressed('confirm')) { G.audio.play('back'); G.scenes.remove(this); }
  }
  render(ctx) {
    U.dim(ctx, 0.75);
    const R = G.renderer, g = this.game, map = g.map;
    const maxW = R.uiW - 220, maxH = R.uiH - 60;
    const s = Math.min(maxW / map.w, maxH / map.h);
    const w = map.w * s, h = map.h * s, x = 20, y = 30;
    U.panel(ctx, x - 6, y - 24, w + 12, h + 30, { title: map.meta.name });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.minimap, x, y, w, h);
    for (const b of map.buildings) {
      if (b.kind === 'house') continue;
      U.text(ctx, b.name, x + (b.x + b.w / 2) * s, y + (b.y - 1) * s, { size: 7, align: 'center', color: '#fff4d0' });
    }
    for (const e of map.exits) {
      U.text(ctx, e.label, x + (e.x + e.w / 2) * s, y + (e.y + e.h / 2) * s - 4, { size: 7, align: e.x === 0 ? 'left' : e.x >= map.w - 2 ? 'right' : 'center', color: '#8ad0ff' });
    }
    const p = g.player;
    const blink = Math.floor(G.loop.time * 3) % 2;
    ctx.fillStyle = blink ? '#ffffff' : '#ff4040';
    ctx.fillRect(x + (p.x / 16) * s - 2, y + (p.y / 16) * s - 2, 4, 4);

    // world overview
    const ox = R.uiW - 190, oy = 30;
    U.panel(ctx, ox, oy - 24, 180, 220, { title: 'The World' });
    const N = {
      forest: ['Forest', 45, 22], heights: ['Rich District', 130, 22], rural: ['Rural', 35, 72], suburbs: ['Suburbs', 95, 62],
      city: ['Center', 130, 108], southside: ['Southside', 65, 150], eastside: ['Eastside', 140, 150], island: ['Island', 130, 188],
    };
    const link = (a, b, dash) => {
      ctx.setLineDash(dash ? [2, 2] : []);
      ctx.beginPath(); ctx.moveTo(ox + N[a][1], oy + N[a][2]); ctx.lineTo(ox + N[b][1], oy + N[b][2]); ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.strokeStyle = '#8a7a5a';
    for (const [a, b] of [['forest', 'rural'], ['forest', 'heights'], ['rural', 'suburbs'], ['suburbs', 'heights'], ['suburbs', 'city'], ['heights', 'city'], ['city', 'southside'], ['city', 'eastside'], ['southside', 'eastside']]) link(a, b);
    link('city', 'island', true);
    for (const id in N) {
      const [label, nx, ny] = N[id];
      const here = g.map.id === id, known = g.world.flags['visited_' + id];
      // gang districts are outlined in the color of whoever holds most of their blocks
      const blocks = Object.keys(G.TERRITORIES).filter((t) => G.TERRITORIES[t].map === id).map((t) => g.world.territories[t].owner).filter(Boolean);
      const top = G.GANGS.map((gg) => [gg, blocks.filter((o) => o === gg).length]).sort((a, b) => b[1] - a[1])[0];
      ctx.fillStyle = here ? '#d8b468' : known ? '#5a7a5a' : '#3a3a44';
      ctx.fillRect(ox + nx - 30, oy + ny - 9, 60, 18);
      if (blocks.length && top[1] > 0) { ctx.strokeStyle = G.FACTIONS[top[0]].color; ctx.lineWidth = 2; ctx.strokeRect(ox + nx - 30, oy + ny - 9, 60, 18); ctx.lineWidth = 1; ctx.strokeStyle = '#8a7a5a'; }
      U.text(ctx, known || here ? label : '???', ox + nx, oy + ny - 4, { size: 8, align: 'center', color: here ? '#1a1410' : '#e8e0d0', shadow: !here });
    }
  }
}

// ---------------------------------------------------------------- Loot
class LootScene {
  constructor(game, container) {
    this.transparent = true;
    this.game = game;
    this.c = container;
    this.side = 0;  // 0 container, 1 player
    this.sel = 0;
    this.stolen = 0;
    this.owned = container.kind === 'chest' && container.owner && game.world.isAlive(container.owner);
    G.audio.play('door');
  }
  entries() {
    const out = [];
    if (this.c.gold > 0) out.push({ gold: true, label: `$${this.c.gold}`, icon: 'coin' });
    this.c.items.forEach((e, i) => { if (e[1] > 0) out.push({ idx: i, id: e[0], qty: e[1], label: G.item(e[0]).name + (e[1] > 1 ? ` x${e[1]}` : ''), icon: G.item(e[0]).icon }); });
    return out;
  }
  pEntries() {
    return this.game.player.inventory.slots.map((s, i) => s && { slot: i, id: s.id, qty: s.qty, label: G.item(s.id).name + (s.qty > 1 ? ` x${s.qty}` : ''), icon: G.item(s.id).icon }).filter(Boolean);
  }
  take(e, all = false) {
    const p = this.game.player;
    if (e.gold) { p.gold += this.c.gold; if (this.owned) this.stolen += this.c.gold; this.c.gold = 0; G.audio.play('coin'); return; }
    const n = all ? e.qty : 1;
    const left = p.inventory.add(e.id, n);
    const took = n - left;
    if (!took) { this.game.toast('Inventory full.', 'bad'); G.audio.play('error'); return; }
    this.c.items[e.idx][1] -= took;
    if (this.owned) this.stolen += G.item(e.id).value * took;
    G.audio.play('pickup');
  }
  store(e) {
    // (quest items can be stored like anything else)
    const p = this.game.player;
    p.inventory.removeAt(e.slot, 1);
    const ex = this.c.items.find((x) => x[0] === e.id);
    if (ex) ex[1]++; else this.c.items.push([e.id, 1]);
    G.audio.play('select');
  }
  takeAll() { for (const e of this.entries()) this.take(e, true); }
  close() {
    this.c.items = this.c.items.filter((e) => e[1] > 0);
    if (this.stolen > 0) this.game.reportCrime('theft', null, this.stolen, this.c.owner);
    // a dropped bag you emptied is gone from the ground
    if (this.c.kind === 'bag' && G.containers.isEmpty(this.c)) delete this.game.world.containers[this.c.id];
    G.scenes.remove(this);
    this.game.refreshContainers();
  }
  update() {
    const I = G.input;
    const list = this.side === 0 ? this.entries() : this.pEntries();
    if (I.wasPressed('left') || I.wasPressed('right')) { this.side = 1 - this.side; this.sel = 0; G.audio.play('select'); return; }
    const r = U.nav(this, 'sel', Math.max(1, list.length));
    this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
    if (r === 'confirm' && list[this.sel]) this.side === 0 ? this.take(list[this.sel], true) : this.store(list[this.sel]);
    if (I.pressed.has('KeyR') || I.pressed.has('KeyT')) this.takeAll();
    if (r === 'cancel' || I.wasPressed('inventory')) this.close();
  }
  render(ctx) {
    U.dim(ctx, 0.5);
    const R = G.renderer, W = 420, H = 230, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    const title = this.c.kind === 'chest' ? (this.owned ? `${this.c.name} (owned by ${this.game.world.displayName(this.c.owner)})` : this.c.name) : this.c.name;
    U.panel(ctx, x, y, W, H, { title });
    if (this.owned) U.text(ctx, 'Taking anything is theft if someone sees you.', R.uiW / 2, y + 22, { size: 8, align: 'center', color: '#ffa060' });
    // each side scrolls on its own: the selection stays in view, the wheel scrolls the side under the mouse
    const ROWS = 10, m = G.input.mouse;
    this.scrolls = this.scrolls || [0, 0];
    const col = (list, cx, label, side) => {
      U.text(ctx, label, cx, y + 34, { size: 9, color: U.colors.borderLight, weight: 'bold' });
      const max = Math.max(0, list.length - ROWS);
      let s = G.util.clamp(this.scrolls[side], 0, max);
      if (this.side === side) { if (this.sel < s) s = this.sel; if (this.sel >= s + ROWS) s = this.sel - ROWS + 1; }
      if (m.wheel && U.inRect(m.ux, m.uy, cx, y + 44, W / 2 - 24, ROWS * 15)) {
        s = G.util.clamp(s + m.wheel, 0, max);
        if (this.side === side) this.sel = G.util.clamp(this.sel, s, Math.min(list.length - 1, s + ROWS - 1));
      }
      this.scrolls[side] = s;
      list.slice(s, s + ROWS).forEach((e, k) => {
        const i = s + k, ry = y + 46 + k * 15;
        const sel = this.side === side && this.sel === i;
        const b = U.button(ctx, cx, ry, W / 2 - 24, 14, '', { selected: sel });
        U.icon(ctx, e.icon, cx + 2, ry - 1, 0.95);
        U.text(ctx, e.label, cx + 20, ry + 3, { size: 8 });
        if (b.hover && G.input.mouse.moved) { this.side = side; this.sel = i; }
        if (b.clicked) side === 0 ? this.take(e, true) : this.store(e);
      });
      if (s > 0) U.text(ctx, '▲', cx + W / 2 - 30, y + 34, { size: 8, align: 'right', color: U.colors.dim });
      if (s < max) U.text(ctx, `▼ ${list.length - s - ROWS} more`, cx + W / 2 - 30, y + 46 + ROWS * 15, { size: 7, align: 'right', color: U.colors.dim });
      if (!list.length) U.text(ctx, 'Empty', cx + 4, y + 50, { size: 9, color: U.colors.dim });
    };
    col(this.entries(), x + 12, 'Contents', 0);
    col(this.pEntries(), x + W / 2 + 6, `Your items ($${this.game.player.gold})`, 1);
    const ta = U.button(ctx, x + 12, y + H - 24, 90, 18, 'Take All');
    const cl = U.button(ctx, x + W - 102, y + H - 24, 90, 18, 'Close');
    if (ta.clicked) this.takeAll();
    if (cl.clicked) this.close();
  }
}

// ---------------------------------------------------------------- Save / Load
class SaveLoadScene {
  constructor(game, mode) {
    this.transparent = true;
    this.game = game;
    this.mode = mode;
    this.sel = 0;
    this.slots = mode === 'save' ? G.saves.manualSlots : G.saves.allSlots;
  }
  act(i) {
    const slot = this.slots[i];
    const meta = G.saves.meta(slot);
    if (this.mode === 'save') {
      const doSave = () => {
        const ok = G.saves.write(slot, this.game);
        G.audio.play(ok ? 'confirm' : 'error');
        G.scenes.remove(this);
        if (this.game) this.game.toast(ok ? `Saved to ${G.saves.label(slot)}.` : 'Save failed (storage unavailable).', ok ? 'good' : 'bad');
      };
      if (meta) G.scenes.push(new ConfirmScene(`Overwrite ${G.saves.label(slot)}?`, doSave));
      else doSave();
    } else {
      if (!meta) { G.audio.play('error'); return; }
      G.audio.play('confirm');
      G.startGame({ save: G.saves.read(slot) });
    }
  }
  update() {
    const r = U.nav(this, 'sel', this.slots.length);
    if (r === 'confirm') this.act(this.sel);
    if (r === 'cancel') { G.audio.play('back'); G.scenes.remove(this); }
    if (G.input.pressed.has('Delete')) {
      const slot = this.slots[this.sel];
      if (G.saves.meta(slot)) G.scenes.push(new ConfirmScene(`Delete ${G.saves.label(slot)}?`, () => G.saves.remove(slot)));
    }
  }
  render(ctx) {
    U.dim(ctx, 0.6);
    const R = G.renderer, W = 300, H = this.slots.length * 36 + 60, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: this.mode === 'save' ? 'Save Game' : 'Load Game', titleSize: 13 });
    this.slots.forEach((slot, i) => {
      const m = G.saves.meta(slot);
      const by = y + 30 + i * 36;
      const b = U.button(ctx, x + 12, by, W - 24, 32, '', { selected: this.sel === i, disabled: this.mode === 'load' && !m });
      U.text(ctx, G.saves.label(slot), x + 22, by + 5, { size: 10, weight: 'bold' });
      if (m) {
        U.text(ctx, `${m.mapName} · Day ${m.day} ${m.time} · $${m.gold}`, x + 22, by + 18, { size: 8, color: U.colors.dim });
        U.text(ctx, new Date(m.date).toLocaleString(), x + W - 22, by + 5, { size: 7, align: 'right', color: U.colors.dim });
      } else U.text(ctx, 'Empty', x + 22, by + 18, { size: 8, color: U.colors.dim });
      if (b.hover && G.input.mouse.moved) this.sel = i;
      if (b.clicked) this.act(i);
    });
  }
}

Object.assign(G, { FadeScene, PauseScene, ConfirmScene, MessageScene, WaitScene, DeathScene, EndingScene, MapScene, LootScene, SaveLoadScene });
})();
