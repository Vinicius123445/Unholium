'use strict';
// Shop screen: buy/sell tabs with reputation-adjusted prices.
(() => {
const U = G.ui;
const ROWS = 11;

class ShopScene {
  constructor(game, shopId, npc) {
    this.transparent = true;
    this.game = game;
    this.shopId = shopId;
    this.npc = npc;
    this.tab = 0;
    this.sel = 0;
    this.scroll = 0; this._navSel = 0;
    this.msg = null;
    this.msgT = 0;
    if (npc) npc.talking = true;
    // merchants label what they sell, so their mushrooms are identified
    for (const [id] of this.state.stock) if (G.ITEMS[id] && G.ITEMS[id].ident) game.world.flags['known_' + id] = true;
  }
  get state() { return this.game.world.shops[this.shopId]; }

  rows() {
    const w = this.game.world;
    if (this.tab === 0) {
      return this.state.stock.filter((e) => e[1] > 0).map((e) => ({ id: e[0], qty: e[1], price: G.shopSys.priceBuy(this.shopId, e[0], w) }));
    }
    return this.game.player.inventory.slots.map((s, i) => s && { slot: i, id: s.id, qty: s.qty, price: G.shopSys.priceSell(this.shopId, s.id, w), ok: G.shopSys.accepts(this.shopId, s.id) }).filter(Boolean);
  }

  act(row) {
    const err = this.tab === 0
      ? G.shopSys.buy(this.shopId, row.id, this.game.player, this.game.world)
      : G.shopSys.sell(this.shopId, row.slot, this.game.player, this.game.world);
    if (err) { this.msg = err; this.msgT = 2; G.audio.play('error'); }
    else G.audio.play('register');
  }

  close() {
    if (this.npc) this.npc.talking = false;
    G.scenes.remove(this);
  }

  update(dt) {
    const I = G.input;
    if (this.msgT > 0) this.msgT -= dt;
    if (I.wasPressed('left') || I.wasPressed('right') || I.wasPressed('tabLeft') || I.wasPressed('tabRight')) { this.tab = 1 - this.tab; this.sel = 0; this.scroll = 0; G.audio.play('select'); }
    const rows = this.rows();
    const r = U.nav(this, 'sel', Math.max(1, rows.length));
    this.sel = Math.min(this.sel, Math.max(0, rows.length - 1));
    if (this.sel !== this._navSel) {   // (only the keyboard moves the list; the wheel and the bar scroll it freely, render keeps the selection in view)
      const vis = this.vis || ROWS;
      if (this.sel < this.scroll) this.scroll = this.sel;
      if (this.sel >= this.scroll + vis) this.scroll = this.sel - vis + 1;
      this._navSel = this.sel;
    }
    if (r === 'confirm' && rows[this.sel]) this.act(rows[this.sel]);
    if (r === 'cancel') { G.audio.play('back'); this.close(); }
  }

  render(ctx) {
    U.dim(ctx, 0.55);
    const R = G.renderer, g = this.game, shop = G.SHOPS[this.shopId];
    const W = Math.min(400, R.uiW - 12), H = Math.min(270, R.uiH - 12), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    const vis = this.vis = Math.max(3, Math.floor((H - 105) / 15));
    U.panel(ctx, x, y, W, H, { title: shop.name, titleSize: 13 });
    const t0 = U.button(ctx, x + 12, y + 24, 80, 16, 'Buy', { selected: this.tab === 0, size: 9 });
    const t1 = U.button(ctx, x + 96, y + 24, 80, 16, 'Sell', { selected: this.tab === 1, size: 9 });
    if (t0.clicked) { this.tab = 0; this.sel = 0; this.scroll = 0; }
    if (t1.clicked) { this.tab = 1; this.sel = 0; this.scroll = 0; }
    U.text(ctx, `You: $${g.player.gold}`, x + W - 14, y + 22, { size: 9, align: 'right', color: U.colors.gold });
    U.text(ctx, `Merchant: $${this.state.gold}`, x + W - 14, y + 33, { size: 8, align: 'right', color: U.colors.dim });

    const rows = this.rows();
    const ly = y + 48;
    // the list scrolls: wheel, the bar, or the selection; whatever is selected stays in view
    this.scroll = G.util.clamp(this.scroll, 0, Math.max(0, rows.length - vis));
    if (rows.length > vis) this.scroll = U.scrollbar(ctx, x + W - 143, ly, vis * 15 - 1, this.scroll, vis, rows.length, 'shopNoir', [x + 12, ly, W - 142, vis * 15]);
    if (this.sel < this.scroll) this.sel = this._navSel = this.scroll;
    if (this.sel >= this.scroll + vis) this.sel = this._navSel = this.scroll + vis - 1;
    rows.slice(this.scroll, this.scroll + vis).forEach((row, k) => {
      const i = k + this.scroll;
      const it = G.item(row.id);
      const by = ly + k * 15;
      const dim = (this.tab === 0 && row.price > g.player.gold) || (this.tab === 1 && !row.ok);
      const b = U.button(ctx, x + 12, by, W - 158, 14, '', { selected: this.sel === i });
      U.icon(ctx, it.icon, x + 14, by - 1, 0.95);
      U.text(ctx, it.name + (row.qty > 1 ? ` (${row.qty})` : ''), x + 32, by + 3, { size: 8, color: dim ? U.colors.dim : U.colors.text });
      U.text(ctx, this.tab === 1 && !row.ok ? '—' : `$${row.price}`, x + W - 150, by + 3, { size: 8, align: 'right', color: dim ? U.colors.dim : U.colors.gold });
      if (b.hover && G.input.mouse.moved) this.sel = i;
      if (b.clicked) { this.sel = i; this.act(row); }
    });
    if (!rows.length) U.text(ctx, this.tab === 0 ? 'Nothing for sale.' : 'You have nothing to sell.', x + 16, ly + 4, { size: 9, color: U.colors.dim });

    // details
    const row = rows[this.sel];
    const dx = x + W - 130;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(dx, ly, 118, Math.min(165, H - 92));
    ctx.save(); ctx.beginPath(); ctx.rect(dx, ly, 118, Math.min(165, H - 92)); ctx.clip();   // (a long description stays inside its box)
    if (row) {
      const it = G.item(row.id);
      U.icon(ctx, it.icon, dx + 4, ly + 4, 2);
      U.text(ctx, it.name, dx + 40, ly + 6, { size: 9, weight: 'bold' });
      const stats = [it.dmg && `Damage ${it.dmg}`, it.def && `Defense ${it.def}`, it.heal && `Heals ${it.heal}`, it.maxHp && `Max HP +${it.maxHp}`, `Base value $${it.value}`].filter(Boolean);
      stats.forEach((s, i) => U.text(ctx, s, dx + 6, ly + 42 + i * 11, { size: 8, color: U.colors.dim }));
      if (it.type === 'clothing') {
        // try-on preview
        const look = g.player.currentLook();
        if (it.slot === 'top') { look.top = it.style; look.shirt = it.color; look.shirt2 = it.color2 || undefined; }
        else { look.bottom = it.style; look.pants = it.color; }
        const sh = G.assets.character(look);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sh.img, Math.floor(G.loop.time * 3) % 2 ? sh.fw : 0, 0, sh.fw, sh.fh, dx + 35, ly + 66, sh.fw * 3, sh.fh * 3);
        U.text(ctx, 'Preview', dx + 59, ly + 130, { size: 7, align: 'center', color: U.colors.dim });
      } else U.textBlock(ctx, it.desc || '', dx + 6, ly + 48 + stats.length * 11, 106, { size: 8 });
      if (it.type === 'weapon' && g.player.weaponItem) {
        const diff = it.dmg - g.player.weaponItem.dmg;
        U.text(ctx, `vs equipped: ${diff >= 0 ? '+' : ''}${diff}`, dx + 6, ly + 150, { size: 8, color: diff >= 0 ? U.colors.good : U.colors.bad });
      }
    }
    ctx.restore();
    const rep = g.world.getRep(shop.region);
    U.text(ctx, `Prices adjusted by your ${G.REGIONS[shop.region].name} reputation (${rep}) and local tension.`, x + 12, y + H - 30, { size: 7, color: U.colors.dim });
    if (this.msgT > 0) U.text(ctx, this.msg, x + W / 2, y + H - 44, { size: 9, align: 'center', color: U.colors.bad });
  }
}

G.ShopScene = ShopScene;
})();
