'use strict';
// Your companion's things. "I need to manage your items." opens a trade screen: their pockets on the left,
// yours on the right; give and take freely (they are with you). Select one of their weapons, armor or
// clothes and press [E] (or click Equip) to make them use it: what they wear shows on them, the weapon is
// what they fight with, the armor protects them. They patch themselves up with your bandages when hurt
// (js/game/behavior.js) and eat your food when hungry.
(() => {
const U = G.ui;
const SLOT_OF = (it) => (it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor' : it.type === 'clothing' ? it.slot : null);
const NP = G.NPC.prototype;
const owned = (st, id) => id && st.inv.some((e) => e[0] === id && e[1] > 0);
// equipment chosen for them wins over what they came with
Object.defineProperty(NP, 'weaponItem', { configurable: true, get() {
  const eq = this.st.equip && this.st.equip.weapon, w = owned(this.st, eq) ? eq : this.def.weapon;
  return w && owned(this.st, w) ? G.item(w) : null;
} });
const armorOf = (npc) => { const eq = npc.st.equip && npc.st.equip.armor; return owned(npc.st, eq) ? eq : npc.def.armor && owned(npc.st, npc.def.armor) ? npc.def.armor : null; };
NP.defense = function () { const a = armorOf(this); return a ? G.item(a).def || 0 : 0; };
NP.bulletDefense = function () { const a = armorOf(this); return a ? G.item(a).bulletDef || 0 : 0; };
// clothes they wear show on them
G.companionItems = {
  applyLook(npc) {
    const eq = npc.st.equip || {}, key = JSON.stringify([eq.top, eq.bottom, armorOf(npc)]);
    if (npc.eqKey === key) return;
    npc.eqKey = key;
    if (!npc.baseLook) npc.baseLook = npc.look;
    const look = Object.assign({}, npc.baseLook);
    const top = owned(npc.st, eq.top) && G.item(eq.top), bottom = owned(npc.st, eq.bottom) && G.item(eq.bottom);
    if (top) { look.top = top.style; look.shirt = top.color; look.shirt2 = top.color2 || undefined; }
    if (bottom) { look.bottom = bottom.style; look.pants = bottom.color; }
    const shoes = owned(npc.st, eq.shoes) && G.item(eq.shoes), mask = owned(npc.st, eq.mask) && G.item(eq.mask);
    if (shoes) look.shoes = shoes.color;
    if (mask) look.mask = mask.style === 'ski' ? 'black' : mask.style;
    const a = armorOf(npc); if (a && G.item(a).look) look.armor = G.item(a).look;
    npc.look = look; npc.sheet = G.assets.character(look);
    if (G.love) npc.loveKey = undefined;
  },
};
const _upd = NP.update;
NP.update = function (dt, scene) {
  if (this.st.equip && !this.dead) G.companionItems.applyLook(this);
  // hungry or thirsty with food on them: they eat it
  if (this.st.companion && !this.dead && (this.careFoodT = (this.careFoodT || 3) - dt) <= 0) {
    this.careFoodT = 3;
    const inv = this.st.inv;
    for (const [need, key] of [['hunger', 'food'], ['thirst', 'drink']]) {
      if ((this.st[need] || 0) < 60) continue;
      const e = inv.find((x) => x[1] > 0 && G.ITEMS[x[0]] && G.ITEMS[x[0]].type === 'consumable' && (G.ITEMS[x[0]][key] || (key === 'food' && G.ITEMS[x[0]].heal && !G.ITEMS[x[0]].alcohol && !G.ITEMS[x[0]].tox)));
      if (!e) continue;
      e[1]--; this.st[need] = Math.max(0, (this.st[need] || 0) - 50);
      this.say(key === 'food' ? `*eats the ${G.item(e[0]).name.toLowerCase()}*` : `*drinks the ${G.item(e[0]).name.toLowerCase()}*`, 2);
    }
    this.st.inv = inv.filter((x) => x[1] > 0);
  }
  return _upd.call(this, dt, scene);
};

// ---------------------------------------------------------------- the trade screen
class CompanionTradeScene extends G.LootScene {
  constructor(game, npc) {
    const st = npc.st;
    const c = { kind: 'companion', name: `${game.world.displayName(npc.id)}'s things`, owner: null, items: st.inv,
      get gold() { return st.gold || 0; }, set gold(v) { st.gold = v; } };
    super(game, c);
    this.npc = npc; this.st = st;
    st.equip = st.equip || {};
  }
  entries() { return super.entries().map((e) => { if (e.id && this.isEquipped(e.id)) e.label += ' *'; return e; }); }
  isEquipped(id) { return Object.values(this.st.equip).includes(id); }
  equip(e) {
    if (!e || !e.id) return;
    const it = G.item(e.id), slot = SLOT_OF(it);
    if (!slot) { this.game.toast(`${it.name} is not something to wear or wield.`); return; }
    if (this.st.equip[slot] === e.id) { delete this.st.equip[slot]; this.game.toast(`${this.game.world.displayName(this.npc.id)} takes off the ${it.name.toLowerCase()}.`); }
    else { this.st.equip[slot] = e.id; this.game.toast(`${this.game.world.displayName(this.npc.id)} ${slot === 'weapon' ? 'now uses' : 'puts on'} the ${it.name.toLowerCase()}.`, 'good'); }
    G.audio.play('pickup');
    G.companionItems.applyLook(this.npc);
  }
  store(e) { super.store(e); }
  take(e, all) {
    super.take(e, all);
    if (e.id && !owned(this.st, e.id)) for (const k in this.st.equip) if (this.st.equip[k] === e.id) delete this.st.equip[k];
  }
  update() {
    const I = G.input;
    if (I.pressed.has('KeyE') && this.side === 0) { this.equip(this.entries()[this.sel]); return; }
    super.update();
  }
  close() { this.st.inv = this.c.items.filter((e) => e[1] > 0); this.c.items = this.st.inv; G.scenes.remove(this); }
  render(ctx) {
    super.render(ctx);
    const R = G.renderer, W = 420, H = 230, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    const eq = this.st.equip, name = (id) => (id && owned(this.st, id) ? G.item(id).name : '—');
    const line = `Uses: ${name(eq.weapon || this.npc.def.weapon)}  ·  Armor: ${name(eq.armor || this.npc.def.armor)}  ·  Top: ${name(eq.top)}  ·  Bottom: ${name(eq.bottom)}`;
    U.text(ctx, line, R.uiW / 2, y + H + 4, { size: 8, align: 'center', color: U.colors.borderLight });
    const sel = this.side === 0 && this.entries()[this.sel];
    const b = U.button(ctx, x + W / 2 - 45, y + H - 24, 90, 18, sel && SLOT_OF(G.item(sel.id || '')) ? (this.isEquipped(sel.id) ? 'Unequip [E]' : 'Equip [E]') : 'Equip [E]');
    if (b.clicked && sel) this.equip(sel);
  }
}
G.CompanionTradeScene = CompanionTradeScene;
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner;
  if (!npc.st.companion || npc.remote || npc.transient) return [];
  return [{ text: 'I need to manage your items.', next: null, do: () => { G.scenes.push(new CompanionTradeScene(runner.scene, npc)); } }];
});
})();
