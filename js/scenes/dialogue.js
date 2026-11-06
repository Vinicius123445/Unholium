'use strict';
// Dialogue box: portrait, name, typewriter text, numbered choices.
(() => {
const U = G.ui;

class DialogueScene {
  constructor(game, runner) {
    this.transparent = true;
    this.game = game;
    this.runner = runner;
    this.sel = 0; this.scroll = 0;
    this.chars = 0;
    this.nodeRef = null;
    this.typing = false;    // free-text mode: type what you want to say (T, or click the field)
    this.input = '';
  }

  get fullText() { return this.runner.node ? G.i18n.t(this.runner.node.text) : ''; }

  finish() {
    G.scenes.remove(this);
    this.runner.end();
    if (this.runner.afterEnd) this.runner.afterEnd();
  }

  choose(i) {
    G.audio.play('confirm');
    this.runner.choose(i);
    if (this.runner.ended) { this.finish(); return; }
    this.sel = 0; this.scroll = 0;
    this.chars = 0;
  }

  // Say something in your own words; the person answers (js/game/chat.js).
  submit() {
    const text = this.input.trim();
    this.typing = false;
    this.input = '';
    if (!text) return;
    G.audio.play('confirm');
    this.runner.say(text);
    if (this.runner.ended) { this.finish(); return; }
    this.sel = 0; this.scroll = 0;
    this.chars = 0;
  }

  update(dt) {
    if (this.runner.ended) { this.finish(); return; }
    const I = G.input;
    if (this.typing) {
      for (const ch of I.typed) if (this.input.length < 90) this.input += ch;
      if (I.pressed.has('Backspace')) this.input = this.input.slice(0, -1);
      if (I.pressed.has('Enter')) this.submit();
      else if (I.pressed.has('Escape')) { this.typing = false; this.input = ''; }
      return;
    }
    if (I.pressed.has('KeyT') && this.chars >= this.fullText.length && this.runner.node.chat !== false) { this.typing = true; this.input = ''; I.typed.length = 0; return; }
    const speed = [30, 60, 120, 99999][G.settings.get('textSpeed')];
    const full = this.fullText;
    const typing = this.chars < full.length;
    this.chars = Math.min(full.length, this.chars + speed * dt);
    const choices = this.runner.node.choices;
    if (typing) {
      if (G.input.wasPressed('confirm')) this.chars = full.length;
      return;
    }
    const r = U.nav(this, 'sel', choices.length);
    for (let k = 1; k <= Math.min(9, choices.length); k++) if (G.input.pressed.has('Digit' + k)) { this.choose(k - 1); return; }
    if (r === 'confirm') this.choose(this.sel);
    else if (r === 'cancel') {
      const bye = choices.findIndex((c) => c.raw.next === null && !c.raw.do);
      if (bye >= 0) this.choose(bye);
    }
  }

  render(ctx) {
    const R = G.renderer, npc = this.runner.npc;
    R.uiTransform();
    const W = Math.min(520, R.uiW - 20), x = (R.uiW - W) / 2;
    const choices = this.runner.node ? this.runner.node.choices : [];
    // long lists scroll: only as many rows as fit; the selection is always in view (wheel, arrows, digits)
    const rows = Math.max(3, Math.min(choices.length, Math.floor((R.uiH * 0.6 - 90) / 15)));
    this.scroll = G.util.clamp(this.scroll || 0, 0, Math.max(0, choices.length - rows));
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + rows) this.scroll = this.sel - rows + 1;
    const H = 70 + Math.min(rows, choices.length) * 15 + 20, y = R.uiH - H - 8;
    if (G.input.mouse.wheel && choices.length > rows) { this.scroll = G.util.clamp(this.scroll + G.input.mouse.wheel, 0, choices.length - rows); this.sel = G.util.clamp(this.sel, this.scroll, this.scroll + rows - 1); }
    U.panel(ctx, x, y, W, H);
    if (G.rel) G.rel.drawBar(ctx, npc, x + W - 150, y + 8, 138);
    // portrait
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 8, y + 8, 52, 52);
    const s = npc.sheet;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.img, 0, 0, s.fw, s.fh - 6, x + 10, y + 8, 48, (s.fh - 6) * 3);
    const title = npc.st.introduced ? `${npc.st.realName}  ·  ${npc.st.name}` : npc.st.name;
    U.text(ctx, title, x + 68, y + 8, { size: 11, weight: 'bold', color: U.colors.borderLight });
    const txt = this.fullText.slice(0, Math.floor(this.chars));
    U.textBlock(ctx, txt, x + 68, y + 24, W - 80, { size: 10 });
    if (this.chars >= this.fullText.length) {
      choices.forEach((c, i) => {
        if (i < this.scroll || i >= this.scroll + rows) return;
        const by = y + 64 + (i - this.scroll) * 15;
        const label = `${i + 1}. ${c.text}`;
        const b = U.button(ctx, x + 64, by - 2, W - 76, 14, '', { selected: this.sel === i });
        U.text(ctx, label, x + 70, by + 1, { size: 9, color: this.sel === i ? '#fff4d8' : U.colors.text });
        if (b.hover && G.input.mouse.moved) this.sel = i;
        if (b.clicked) this.choose(i);
      });
      if (this.scroll > 0) U.text(ctx, '▲ more', x + W - 14, y + 56, { size: 8, align: 'right', color: U.colors.dim });
      if (this.scroll + rows < choices.length) U.text(ctx, '▼ more', x + W - 14, y + 64 + rows * 15 - 2, { size: 8, align: 'right', color: U.colors.dim });
    } else if (G.input.mouse.pressed) this.chars = this.fullText.length;
    // the free-text field
    const fy = y + H - 22;
    ctx.fillStyle = this.typing ? 'rgba(40,50,70,0.95)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 64, fy, W - 76, 15);
    ctx.strokeStyle = this.typing ? '#8ad8ff' : '#4a4050';
    ctx.strokeRect(x + 64.5, fy + 0.5, W - 77, 14);
    const caret = this.typing && Math.floor(G.loop.time * 2) % 2 ? '|' : '';
    U.text(ctx, this.typing ? `> ${this.input}${caret}` : 'Say something in your own words...', x + 70, fy + 3, { size: 9, color: this.typing ? '#e8f4ff' : U.colors.dim });
    const m = G.input.mouse;
    if (!this.typing && m.pressed && U.inRect(m.ux, m.uy, x + 64, fy, W - 76, 15)) { this.typing = true; this.input = ''; G.input.typed.length = 0; }
  }
}

G.DialogueScene = DialogueScene;
})();
