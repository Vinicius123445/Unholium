'use strict';
// Main menu: the island from orbit (js/art/menu_island.jpg, painted by tools/satellite.html), title, menu, credits.
(() => {
const U = G.ui;
const island = new Image();
island.src = 'js/art/menu_island.jpg';

class MenuScene {
  constructor() {
    this.transparent = false;
    this.sel = 0;
    this.t = 0;
    G.audio.setMusic('menu');
    this.build();
  }

  build() {
    const latest = G.saves.latest();
    this.latest = latest;
    this.items = [
      { label: 'Continue', disabled: !latest, act: () => G.startGame({ save: G.saves.read(latest.slot) }) },
      { label: 'New Game', act: () => G.scenes.replace(new G.CharacterCreatorScene()) },
      { label: 'Load Game', disabled: !latest, act: () => G.scenes.push(new G.SaveLoadScene(null, 'load')) },
      { label: 'Settings', act: () => G.scenes.push(new G.SettingsScene()) },
      { get label() { return G.i18n.menuLabel(); }, act: () => G.i18n.toggle() },
      { label: 'Credits', act: () => G.scenes.push(new G.MessageScene('Built on a custom engine.\nAll art, sound and music are generated procedurally.\n\nGame design & lore: you.\n\n[Placeholder credits]', 'Credits')) },
    ];
    if (G.desktop) this.items.push({ label: 'Quit', act: () => G.scenes.push(new G.ConfirmScene('Quit the game?', () => G.platform.quit())) });
    if (!latest && this.sel === 0) this.sel = 1;
  }

  resume() { this.build(); }

  update(dt) {
    this.t += dt;

    let r = U.nav(this, 'sel', this.items.length);
    let guard = 0;
    while (this.items[this.sel].disabled && guard++ < 10) this.sel = (this.sel + (G.input.wasPressed('up') ? this.items.length - 1 : 1)) % this.items.length;
    if (r === 'confirm') this.activate(this.sel);
  }

  activate(i) {
    const it = this.items[i];
    if (it.disabled) { G.audio.play('error'); return; }
    G.audio.play('confirm');
    it.act();
  }

  render(ctx) {
    this.drawBackdrop(ctx);
    this.drawCard(ctx);
  }

  // the island from orbit, drifting very slowly (the Windows look draws its own card over it: js/game/xpscreens.js)
  drawBackdrop(ctx) {
    const R = G.renderer;
    R.clear('#06183a');
    R.screenTransform();
    if (island.complete && island.naturalWidth) {
      const k = Math.max(R.W / island.naturalWidth, R.H / island.naturalHeight) * (1.07 + Math.sin(this.t * 0.03) * 0.015), w = island.naturalWidth * k, h = island.naturalHeight * k;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(island, (R.W - w) / 2 + R.W * 0.035 + Math.sin(this.t * 0.021) * R.W * 0.012, (R.H - h) / 2 + Math.cos(this.t * 0.017) * R.H * 0.012, w, h);
      ctx.imageSmoothingEnabled = false;
    }
    const grad = ctx.createLinearGradient(0, 0, R.W * 0.6, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, R.W, R.H);
  }

  drawCard(ctx) {
    const R = G.renderer;
    R.uiTransform();
    const x = 40;
    // the menu is an ID card, like the one on the HUD: the title, a heartbeat line, the options
    const cw = 230, ch = 112 + this.items.length * 28 + (this.latest ? 16 : 4), cy = Math.max(20, (R.uiH - ch) / 2 - 10);
    U.panel(ctx, x - 16, cy, cw, ch);
    const title = String(G.config.TITLE).toUpperCase();
    // the title: cast concrete block letters and an engineering rule (js/game/wordmark.js)
    let tw;
    if (G.wordmark) { tw = G.wordmark.draw(ctx, title, x, cy + 16, 32); G.wordmark.rule(ctx, x, cy + 56, Math.min(cw - 40, tw), this.t); U.text(ctx, 'PLATE UNH-01  -  REV ' + G.config.VERSION, x + 10, cy + 59, { size: 5, color: 'rgba(214,208,194,0.6)', family: G.config.TITLE_FONT, weight: 'bold' }); }
    else { U.text(ctx, title, x, cy + 18, { size: 30, family: G.config.TITLE_FONT, weight: 'bold', color: '#f4ecd8' }); ctx.fillStyle = U.colors.borderLight; ctx.fillRect(x, cy + 56, Math.min(cw - 40, U.measure(ctx, title, 30, 'bold', G.config.TITLE_FONT)), 2); }
    // heartbeat
    ctx.strokeStyle = '#5ae08a'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const ph = ((i / 120) * 1.6 + this.t / 0.9) % 1; const v = ph > 0.46 && ph < 0.5 ? 1 : ph >= 0.5 && ph < 0.54 ? -0.6 : 0; const yy = cy + 72 - v * 6; if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy); }
    ctx.stroke(); ctx.lineWidth = 1;
    U.text(ctx, 'A WORLD THAT REMEMBERS', x, cy + 82, { size: 8, color: '#c8bca0', family: G.config.TITLE_FONT, weight: 'bold' });
    const i = U.menu(ctx, this, this.items, x, cy + 104, cw - 52, 22, 6, { size: 12, align: 'left' });
    if (i >= 0) this.activate(i);
    if (this.latest) U.text(ctx, `Last save: ${this.latest.meta.mapName}, Day ${this.latest.meta.day}`, x, cy + 104 + this.items.length * 28 + 2, { size: 8, color: U.colors.dim });   // under the last button
    // a green street sign in the corner, like the district sign on the HUD
    const sign = `v${G.config.VERSION}`, sw = U.measure(ctx, sign, 9, 'bold', G.config.TITLE_FONT) + 16;
    ctx.fillStyle = '#1e6a3a'; ctx.fillRect(R.uiW - sw - 10, R.uiH - 26, sw, 16); ctx.strokeStyle = '#e8f0e0'; ctx.strokeRect(R.uiW - sw - 8.5, R.uiH - 24.5, sw - 3, 13);
    U.text(ctx, sign, R.uiW - 10 - sw / 2, R.uiH - 22, { size: 9, align: 'center', weight: 'bold', family: G.config.TITLE_FONT, color: '#f0f8e8' });
  }
}

G.MenuScene = MenuScene;
})();
