'use strict';
// Character creation (new game) and the barbershop. Both use the same row-based appearance editor
// with a live, rotating preview of the character.
(() => {
const U = G.ui;
const A = G.assets;

const HAIR_COLORS = ['#1a1a22', '#2a1e18', '#4a3020', '#7a5030', '#b08040', '#d8c070', '#e8e0c0', '#8a8a8a', '#c8c8c8',
  '#6a2a1a', '#a83a1a', '#d040a0', '#40d0a0', '#4070d8', '#d04040', '#8a40d0'];
// (skin tones: per race, G.RACES in js/data/npcs.js)
const EYES = ['#1d1a22', '#3a2a1a', '#6a4a2a', '#2a4a7a', '#4a8ac8', '#2a5a3a', '#5a5a60', '#6a3a8a'];
const CLOTH = G.CLOTH_COLORS.map((c) => c[1]);
const SHOES = ['#2a1e14', '#111111', '#4a3a2a', '#6a4a2a', '#e8e4dc', '#8a2a2a'];
const STYLE_NAMES = { tshirt: 'T-Shirt', longsleeve: 'Long Sleeve', tank: 'Tank Top', shirt: 'Shirt', tunic: 'Tunic', jacket: 'Jacket', hoodie: 'Hoodie', vest: 'Vest', dress: 'Dress', robe: 'Robe', pants: 'Pants', shorts: 'Shorts', skirt: 'Skirt' };

// Shared editor: rows = [{ key, label, options:[[value,label]] | colors:[hex] | type:'text'|'button', show?(v) }]
class LookEditor {
  constructor(rows, values) {
    this.rows = rows;
    this.v = values;
    this.sel = 0;
    this.turn = 0;
  }
  visible() { return this.rows.filter((r) => !r.show || r.show(this.v)); }
  cycle(row, d) {
    const list = row.colors || row.options.map((o) => o[0]);
    const i = Math.max(0, list.indexOf(this.v[row.key]));
    this.v[row.key] = list[(i + d + list.length) % list.length];
    G.audio.play('select');
  }
  valueLabel(row) {
    if (row.type === 'text') return this.v[row.key] + (Math.floor(G.loop.time * 2) % 2 ? '_' : ' ');
    if (row.options) { const o = row.options.find((x) => x[0] === this.v[row.key]); return o ? o[1] : '?'; }
    return '';
  }
  // returns the activated button key, or null
  update(dt) {
    const I = G.input;
    this.turn += dt;
    const rows = this.visible();
    this.sel = Math.min(this.sel, rows.length - 1);
    const row = rows[this.sel];
    const typing = row && row.type === 'text';
    const up = I.pressed.has('ArrowUp') || I.pressed.has('PadUp') || (!typing && I.pressed.has('KeyW'));
    const down = I.pressed.has('ArrowDown') || I.pressed.has('PadDown') || I.pressed.has('Tab') || (!typing && I.pressed.has('KeyS'));
    const left = I.pressed.has('ArrowLeft') || I.pressed.has('PadLeft') || (!typing && I.pressed.has('KeyA'));
    const right = I.pressed.has('ArrowRight') || I.pressed.has('PadRight') || (!typing && I.pressed.has('KeyD'));
    if (up) { this.sel = (this.sel + rows.length - 1) % rows.length; G.audio.play('select'); }
    if (down) { this.sel = (this.sel + 1) % rows.length; G.audio.play('select'); }
    if (typing) {
      for (const ch of I.typed) if (this.v.name.length < 18 && /[\p{L}\p{N} '\-.]/u.test(ch)) this.v.name += ch;
      if (I.pressed.has('Backspace')) this.v.name = this.v.name.slice(0, -1);
      if (I.pressed.has('Enter')) { this.sel++; G.audio.play('select'); }
      return null;
    }
    if (row && (row.options || row.colors)) {
      if (left) this.cycle(row, -1);
      if (right) this.cycle(row, 1);
    }
    if (row && row.type === 'button' && (I.pressed.has('Enter') || I.pressed.has('Space') || I.pressed.has('KeyE') || I.pressed.has('PadA'))) return row.key;
    return null;
  }
  drawPreview(ctx, look, x, y, w, h) {
    U.panel(ctx, x, y, w, h);
    const sheet = A.character(look);
    const dir = [0, 1, 3, 2][Math.floor(this.turn / 1.2) % 4];
    // the same model you play with (HD people, js/game/hdchars.js): walking, turning
    const hd = G.hd.get(sheet), C = G.hd.COL, ar = G.hd.WW / G.hd.WH, ph = h - 80, pw = ph * ar;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 14 + ph - 6, pw * 0.3, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(hd.img, (C.walk + Math.floor(this.turn * 8) % 8) * G.hd.FW, dir * G.hd.FH, G.hd.FW, G.hd.FH, x + w / 2 - pw / 2, y + 12, pw, ph);
    for (let d = 0; d < 4; d++) ctx.drawImage(hd.img, (C.idle + Math.floor(this.turn * 1.6) % 4) * G.hd.FW, d * G.hd.FH, G.hd.FW, G.hd.FH, x + w / 2 - 70 + d * 36, y + h - 62, 40 * ar, 40);
  }
  // returns the clicked button key, or null
  drawRows(ctx, x, y, w, rowH = 17) {
    const rows = this.visible();
    const m = G.input.mouse;
    let clicked = null;
    rows.forEach((row, i) => {
      const ry = y + i * (rowH + 2);
      const sel = this.sel === i;
      if (row.type === 'button') {
        const b = U.button(ctx, x, ry, w, rowH, row.label, { selected: sel, size: 10, weight: row.key === '_start' || row.key === '_ok' ? 'bold' : 'normal' });
        if (b.hover && m.moved) this.sel = i;
        if (b.clicked) clicked = row.key;
        return;
      }
      ctx.fillStyle = sel ? 'rgba(110,86,44,0.85)' : 'rgba(30,26,36,0.85)';
      ctx.fillRect(x, ry, w, rowH);
      if (sel) { ctx.strokeStyle = U.colors.borderLight; ctx.strokeRect(x + 0.5, ry + 0.5, w - 1, rowH - 1); }
      U.text(ctx, row.label, x + 8, ry + rowH / 2, { size: 9, baseline: 'middle', color: sel ? '#fff4d8' : U.colors.text });
      const vx = x + w * 0.45, vw = w * 0.55 - 8;
      if (row.colors) {
        const n = row.colors.length, sw = Math.min(12, (vw - 4) / n);
        row.colors.forEach((c, k) => {
          const cx = vx + k * sw;
          ctx.fillStyle = c;
          ctx.fillRect(cx + 1, ry + 3, sw - 2, rowH - 6);
          if (this.v[row.key] === c) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(cx + 0.5, ry + 2.5, sw - 1, rowH - 5); ctx.lineWidth = 1; }
          if (m.pressed && U.inRect(m.ux, m.uy, cx, ry, sw, rowH)) { this.v[row.key] = c; this.sel = i; G.audio.play('select'); }
        });
      } else {
        if (row.type === 'text') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(vx, ry + 2, vw, rowH - 4);
          const empty = !this.v[row.key] && !sel;
          U.text(ctx, empty ? 'Type a name...' : this.valueLabel(row), vx + 6, ry + rowH / 2, { size: 9, baseline: 'middle', color: empty ? U.colors.dim : '#fff4d8' });
        } else {
          const lb = U.button(ctx, vx, ry + 1, 16, rowH - 2, '<', { size: 9 });
          const rb = U.button(ctx, vx + vw - 16, ry + 1, 16, rowH - 2, '>', { size: 9 });
          U.text(ctx, this.valueLabel(row), vx + vw / 2, ry + rowH / 2, { size: 9, align: 'center', baseline: 'middle', color: U.colors.borderLight });
          if (lb.clicked) { this.sel = i; this.cycle(row, -1); }
          if (rb.clicked) { this.sel = i; this.cycle(row, 1); }
        }
      }
      if (m.pressed && U.inRect(m.ux, m.uy, x, ry, w * 0.45, rowH)) this.sel = i;
    });
    return clicked;
  }
}

// ---------------------------------------------------------------- Character creation
class CharacterCreatorScene {
  constructor() {
    this.transparent = false;
    const r = G.rng, self = this;
    this.editor = new LookEditor([
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'body', label: 'Sex', options: [['f', 'Female'], ['m', 'Male']] },
      { key: 'race', label: 'Race', options: G.races.ids().map((id) => [id, G.RACES[id].name]) },
      // only the tones of the chosen race (picking another race moves you to its closest tone)
      { key: 'skin', label: 'Skin Tone', get colors() { const v = self.editor.v, list = G.races.skins(v.race); if (!list.includes(v.skin)) v.skin = G.races.nearest(v.race, v.skin || list[0]); return list; } },
      { key: 'eyes', label: 'Eye Color', colors: EYES },
      { key: 'hairStyle', label: 'Hair Style', options: A.HAIR_STYLES.map((n, i) => [i, n]) },
      { key: 'hair', label: 'Hair Color', colors: HAIR_COLORS },
      { key: 'facial', label: 'Facial Hair', options: [[0, 'None'], [1, 'Beard'], [2, 'Mustache'], [3, 'Stubble']], show: (v) => v.body === 'm' },
      { key: 'top', label: 'Top', options: A.TOP_STYLES.map((s) => [s, STYLE_NAMES[s]]) },
      { key: 'shirt', label: 'Top Color', colors: CLOTH },
      { key: 'shirt2', label: 'Top Accent', colors: CLOTH, show: (v) => v.top === 'jacket' || v.top === 'vest' },
      { key: 'bottom', label: 'Bottom', options: A.BOTTOM_STYLES.map((s) => [s, STYLE_NAMES[s]]) },
      { key: 'pants', label: 'Bottom Color', colors: CLOTH },
      { key: 'shoes', label: 'Shoes', colors: SHOES },
      { key: '_random', label: 'Randomize', type: 'button' },
      { key: '_start', label: 'Begin Your Journey', type: 'button' },
    ], {});
    this.randomize(r.chance(0.5) ? 'f' : 'm');
    this.editor.v.name = '';
    this.error = 0;
    G.audio.setMusic('menu');
  }

  randomize(body) {
    const r = G.rng, v = this.editor.v;
    const name = v.name, race = r.pick(G.races.ids());
    Object.assign(v, {
      body: body || (r.chance(0.5) ? 'f' : 'm'), race, skin: r.pick(G.races.skins(race)), eyes: r.pick(EYES), hair: r.pick(HAIR_COLORS.slice(0, 11)),
      top: r.pick(['shirt', 'tunic', 'jacket', 'hoodie', 'vest']), shirt: r.pick(CLOTH), shirt2: r.pick(CLOTH),
      bottom: 'pants', pants: r.pick(CLOTH), shoes: r.pick(SHOES),
    });
    v.hairStyle = v.body === 'f' ? r.pick([1, 3, 6, 7, 10, 0, 8]) : r.pick([0, 2, 5, 9, 8, 4]);
    v.facial = v.body === 'm' ? r.pick([0, 0, 1, 2, 3]) : 0;
    v.name = name;
  }

  look() {
    const v = this.editor.v;
    return {
      body: v.body, race: v.race, skin: v.skin, eyes: v.eyes, hair: v.hair, hairStyle: v.hairStyle, facial: v.body === 'm' ? v.facial : 0,
      top: v.top, shirt: v.shirt, shirt2: v.top === 'jacket' || v.top === 'vest' ? v.shirt2 : undefined,
      bottom: v.bottom, pants: v.pants, shoes: v.shoes,
    };
  }

  act(key) {
    if (key === '_random') { this.randomize(); G.audio.play('select'); }
    if (key === '_start') {
      const v = this.editor.v;
      if (!v.name.trim()) { this.error = 2; G.audio.play('error'); this.editor.sel = 0; return; }
      G.audio.play('confirm');
      const lk = this.look();
      G.startGame({
        create: {
          name: v.name.trim(),
          look: { body: lk.body, race: lk.race, skin: lk.skin, eyes: lk.eyes, hair: lk.hair, hairStyle: lk.hairStyle, facial: lk.facial, shoes: lk.shoes },
          top: G.clothId('top', lk.top, lk.shirt, lk.shirt2),
          bottom: G.clothId('bottom', lk.bottom, lk.pants),
        },
      });
    }
  }

  update(dt) {
    if (this.error > 0) this.error -= dt;
    if (G.input.pressed.has('Escape')) { G.audio.play('back'); G.scenes.replace(new G.MenuScene()); return; }
    const k = this.editor.update(dt);
    if (k) this.act(k);
  }

  render(ctx) {
    const R = G.renderer;
    R.clear('#14111a');
    R.uiTransform();
    const grad = ctx.createLinearGradient(0, 0, 0, R.uiH);
    grad.addColorStop(0, '#221c2c');
    grad.addColorStop(1, '#0e0c12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, R.uiW, R.uiH);
    const W = Math.min(560, R.uiW - 20), x0 = (R.uiW - W) / 2;
    U.text(ctx, 'Create Your Character', R.uiW / 2, 12, { size: 18, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#f4e4b8' });
    this.editor.drawPreview(ctx, this.look(), x0, 40, 190, 290);
    const k = this.editor.drawRows(ctx, x0 + 200, 40, W - 200);
    if (k) this.act(k);
    if (this.error > 0) U.text(ctx, 'Please enter a name.', x0 + 200 + (W - 200) / 2, 334, { size: 9, align: 'center', color: U.colors.bad });
  }
}

// ---------------------------------------------------------------- Barbershop
class BarberScene {
  constructor(game, npc) {
    this.transparent = true;
    this.game = game;
    this.npc = npc;
    if (npc) npc.talking = true;
    const p = game.player;
    this.orig = { hairStyle: p.look.hairStyle, hair: p.look.hair, facial: p.look.facial || 0 };
    this.editor = new LookEditor([
      { key: 'hairStyle', label: 'Haircut', options: A.HAIR_STYLES.map((n, i) => [i, n]) },
      { key: 'hair', label: 'Hair Color (dye)', colors: HAIR_COLORS },
      { key: 'facial', label: 'Facial Hair', options: [[0, 'None'], [1, 'Beard'], [2, 'Mustache'], [3, 'Stubble']], show: () => p.look.body === 'm' },
      { key: '_ok', label: 'Confirm', type: 'button' },
      { key: '_cancel', label: 'Cancel', type: 'button' },
    ], Object.assign({}, this.orig));
  }

  price() {
    const v = this.editor.v, o = this.orig;
    let p = 0;
    if (v.hairStyle !== o.hairStyle || v.facial !== o.facial) p += 15;
    if (v.hair !== o.hair) p += 10;
    return p;
  }

  close() {
    if (this.npc) this.npc.talking = false;
    G.scenes.remove(this);
  }

  act(key) {
    if (key === '_cancel') { G.audio.play('back'); this.close(); return; }
    if (key === '_ok') {
      const p = this.game.player, cost = this.price();
      if (p.gold < cost) { G.audio.play('error'); this.game.toast('You cannot afford that.', 'bad'); return; }
      p.gold -= cost;
      if (this.npc) this.npc.st.gold += cost;
      Object.assign(p.look, { hairStyle: this.editor.v.hairStyle, hair: this.editor.v.hair, facial: this.editor.v.facial });
      p.refreshSprite();
      G.audio.play(cost ? 'coin' : 'confirm');
      if (cost) this.game.toast(`New look! (-$${cost})`, 'good');
      this.close();
    }
  }

  update(dt) {
    if (G.input.wasPressed('cancel')) { this.act('_cancel'); return; }
    const k = this.editor.update(dt);
    if (k) this.act(k);
  }

  render(ctx) {
    U.dim(ctx, 0.6);
    const R = G.renderer, W = 440, H = 250, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Barbershop', titleSize: 13 });
    const p = this.game.player;
    const look = Object.assign(p.currentLook(), { hairStyle: this.editor.v.hairStyle, hair: this.editor.v.hair, facial: this.editor.v.facial });
    this.editor.drawPreview(ctx, look, x + 10, y + 26, 160, H - 36);
    const k = this.editor.drawRows(ctx, x + 180, y + 30, W - 190, 20);
    if (k) this.act(k);
    U.text(ctx, `Price: $${this.price()}   (you have ${p.gold})`, x + 180, y + H - 30, { size: 10, color: this.price() > p.gold ? U.colors.bad : U.colors.gold });
  }
}

Object.assign(G, { CharacterCreatorScene, BarberScene, LookEditor });
})();
