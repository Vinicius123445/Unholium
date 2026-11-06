'use strict';
// What lies on the ground. One thing dropped is that thing, its own model on the floor, and [E] just picks it up. Two or more in
// one place make a heap (painted below, with the real things showing on top), and [E] opens it as before. Anything can be
// dropped, what you wear and hold included.
(() => {
const A = G.assets, C = G.containers, F = G.realFurn, _draw = C.draw;
const hash = (s) => { let h = 11; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h; };
const live = (c) => (c.items || []).filter((e) => e[1] > 0 && G.ITEMS[e[0]]);
// how big a thing is on the ground, in world pixels (the icons are square; a person stands 34 tall)
const sizeOf = (it) => (it.type === 'armor' ? 16 : it.type === 'clothing' ? 15 : it.type === 'quest' || it.type === 'tool' ? 9 : /kit|chair|table|bed|shelf|build/i.test(it.icon || '') ? 15 : it.type === 'ammo' ? 8 : 9.5);
const shadow = (ctx, x, y, a, b) => { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, a, b, 0, 0, 6.3); ctx.fill(); };
const icon = (ctx, it, x, y, S, rot) => {
  const img = A.icon(it.icon), smooth = ctx.imageSmoothingEnabled; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -S / 2, -S / 2, S, S); ctx.restore(); ctx.imageSmoothingEnabled = smooth;
};
const one = (ctx, c, it) => {
  const h = hash(c.id), x = Math.round(c.x), y = Math.round(c.y) - 2, rot = ((h % 9) - 4) * 0.13;
  if (it.type === 'weapon') {   // weapons lie flat, their real length
    const a = -0.35 + (h % 7) * 0.12 + (h % 2 ? Math.PI : 0), L = G.heldGear.length(Object.assign({ id: '' }, it)), bx = x - Math.cos(a) * L / 2, by = y - Math.sin(a) * L / 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by + 1.2); ctx.lineTo(bx + Math.cos(a) * L, by + 1.2 + Math.sin(a) * L); ctx.stroke(); ctx.lineCap = 'butt';
    G.heldGear.draw(ctx, it, bx, by, a, null);
    return;
  }
  const S = sizeOf(it); shadow(ctx, x, y + S * 0.3, S * 0.44, S * 0.16); icon(ctx, it, x, y, S, rot);
};
const heap = (ctx, c, list) => {
  const a = F.ART.loot_pile, W = a.width / F.D, H = a.height / F.D, x = Math.round(c.x), y = Math.round(c.y), smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(a, x - W / 2, y - H + 2, W, H); ctx.imageSmoothingEnabled = smooth;
  const h = hash(c.id), spots = [[-5.5, -8, -0.3], [4.5, -9.5, 0.26], [-0.5, -11.5, 0.05]];   // the real things on top
  list.slice(-3).forEach((e, i) => { const [dx, dy, r] = spots[(i + h) % 3]; icon(ctx, G.item(e[0]), x + dx, y + dy, 8.5, r); });
};
C.draw = function (ctx, c) {
  if (c.kind !== 'bag') return _draw.call(this, ctx, c);
  const list = live(c), n = list.reduce((s, e) => s + e[1], 0);
  if (!list.length) { if (c.gold > 0) { shadow(ctx, c.x, c.y, 5, 1.6); icon(ctx, { icon: 'coin' }, c.x, c.y - 2, 8, 0); } return undefined; }
  return n > 1 || c.gold > 0 ? heap(ctx, c, list) : one(ctx, c, G.item(list[0][0]));
};
const _more = F.more;
F.more = () => {
  if (_more) _more();
  const { make, fill, grad, wood } = F, sh = A.shade;
  make('loot_pile', 32, 21, (x, W, H) => {
    const blob = (X, Y, a, b, c, r = 0) => { const g = x.createRadialGradient(X - a * 0.3, Y - b * 0.4, 0.2, X, Y, Math.max(a, b)); g.addColorStop(0, sh(c, 1.28)); g.addColorStop(0.6, c); g.addColorStop(1, sh(c, 0.56)); x.fillStyle = g; x.beginPath(); x.ellipse(X, Y, a, b, r, 0, 6.3); x.fill(); };
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(W / 2, H - 3.2, 15.4, 3, 0, 0, 6.3); x.fill();
    // a cardboard box on its side at the back, a sack slumped against it, cloth over the rest, rope and a loose strap
    x.save(); x.translate(21, 8); x.rotate(0.16); fill(x, -6, -4, 12, 9, 0.2, grad(x, -6, 0, 6, 0, ['#b08c5c', '#8e6c42'])); fill(x, -6, -4, 12, 2.4, 0.1, '#c8a472'); x.fillStyle = 'rgba(60,40,20,0.5)'; x.fillRect(-0.4, -4, 0.8, 9); x.fillStyle = '#d8ccae'; x.fillRect(-2.8, -4, 5.6, 0.9); x.restore();
    blob(10, 11, 8.4, 6.8, '#7e6a4a', -0.2);
    for (let i = 0; i < 26; i++) { const a = 3 + (i * 37) % 15, b = 6 + (i * 23) % 10; x.fillStyle = i % 2 ? 'rgba(40,28,14,0.22)' : 'rgba(230,210,170,0.16)'; x.fillRect(a, b, 0.9, 0.22); x.fillRect(a + 0.3, b - 0.4, 0.22, 0.9); }
    x.strokeStyle = '#4e3e28'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(7, 5.2); x.quadraticCurveTo(10, 6.6, 13, 5); x.stroke();
    blob(19, 14.4, 9.6, 4.2, '#4e5a70', 0.08); blob(24, 15.4, 5.6, 2.8, '#6a3e38', -0.12); blob(12, 16, 6.8, 2.6, '#5e6a4c', 0.04);
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.32; for (const [a, b, c, d] of [[15, 12.6, 21, 15.6], [20, 11.8, 24, 14.2], [8, 15, 13, 17], [25, 14, 28, 16.4]]) { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo((a + c) / 2 + 1, (b + d) / 2 - 1, c, d); x.stroke(); }
    x.strokeStyle = '#a89468'; x.lineWidth = 0.55; x.beginPath(); x.moveTo(4, 17); x.bezierCurveTo(7, 14.6, 10, 18.6, 15, 16.6); x.stroke();
    wood(x, 2, 15.8, 6.4, 2.2, '#7a5a34', 5);
  });
};

// ---------------------------------------------------------------- [E]: one thing goes straight into your bag; a heap opens as before
G.groundLoot = {
  live,
  label(c) { const l = live(c); return l.length === 1 && l[0][1] === 1 && !c.gold ? `Pick up ${G.item(l[0][0]).name}` : 'Pick up'; },
  // a single thing, picked up with no window; false if it has to go through the window
  grab(scene, c) {
    const list = live(c), p = scene.player;
    if (c.kind !== 'bag' || c.gold > 0 || list.length !== 1 || list[0][1] !== 1) return false;
    const id = list[0][0]; if (!p.inventory.canFit(id)) return false;
    p.inventory.add(id, 1); list[0][1] = 0; delete scene.world.containers[c.id]; scene.refreshContainers();
    G.audio.play('select'); scene.toast(`Picked up ${G.item(id).name}.`, 'info');
    return true;
  },
};
// ---------------------------------------------------------------- dropping what you hold or wear
const IS = G.InventoryScene && G.InventoryScene.prototype;
if (IS) {
  const _drop = IS.dropSel;
  IS.dropSel = function () {
    if (this.sel >= this.inv.size) {   // from an equipment slot: off the body, onto the ground
      const slot = this.eqSlots[this.sel - this.inv.size], p = this.game.player, id = slot && p.equip[slot];
      if (!id || !p.unequip(slot)) return;
      const i = this.inv.slots.findIndex((s) => s && s.id === id); if (i < 0) return;
      this.sel = i;
    }
    return _drop.call(this);
  };
}
G.LANG_PT.t.push(['Picked up {0}.', 'Você pegou {0}.']); if (G.i18n.tpl) G.i18n.tpl = null;
})();
