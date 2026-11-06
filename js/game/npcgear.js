'use strict';
// Everything someone has on them is real.
//   The first time you open someone's things (searching them while they are out cold, or managing a companion's
//   or partner's items), what they wear and wield becomes real items in their pockets, equipped: the top, the
//   bottom, the shoes, a mask, the weapon, the armor. Take something and it comes off them (shirtless, no pants,
//   barefoot, unarmed: drawn with the usual censor bars); give them something and equip it on the same screen.
//   Never children's clothes.
(() => {
const NP = G.NPC.prototype;
const owned = (st, id) => !!id && (st.inv || []).some((e) => e[0] === id && e[1] > 0);
const clothOf = (look, slot) => {
  if (slot === 'shoes') return look.shoes ? G.clothId('shoes', 'sneakers', look.shoes) : null;
  if (slot === 'hat') return look.hat && G.CLOTH_STYLES.hat[look.hat] ? G.clothId('hat', look.hat, look.hatColor || '#2a2a30') : null;
  if (slot === 'mask') return look.mask && G.CLOTH_STYLES.mask && G.CLOTH_STYLES.mask[look.mask] ? G.clothId('mask', look.mask, '#888888') : null;
  const style = slot === 'top' ? look.top || 'shirt' : look.bottom || 'pants';
  if (!G.CLOTH_STYLES[slot] || !G.CLOTH_STYLES[slot][style]) return null;
  return slot === 'top' ? G.clothId('top', style, look.shirt || '#6a8ab8', look.shirt2) : G.clothId('bottom', style, look.pants || '#4a3a2a');
};
const add = (st, id) => { const e = st.inv.find((x) => x[0] === id); if (e) e[1] = Math.max(1, e[1]); else st.inv.push([id, 1]); };

G.npcGear = {
  // turn what they wear and carry into items (once per person)
  materialize(npc) {
    const st = npc.st, d = npc.def;
    if (!st || st.gearV2 || npc.dead) return;
    st.inv = st.inv || []; st.equip = st.equip || {};
    if (d.weapon && !st.equip.weapon) { add(st, d.weapon); st.equip.weapon = d.weapon; }
    if (d.armor && !st.equip.armor) { add(st, d.armor); st.equip.armor = d.armor; }
    const naked = (st.nakedUntil || 0) > (G.love ? G.love.now() : 0);
    if (!d.kid && !naked) {
      const look = npc.baseLook || npc.look || d.look || {};
      for (const slot of ['top', 'bottom', 'shoes', 'mask', 'hat']) {
        if (st.equip[slot] && owned(st, st.equip[slot])) continue;   // (something you gave them is already on)
        const cid = clothOf(look, slot); if (!cid) continue;
        add(st, cid); st.equip[slot] = cid;
      }
    }
    st.gearV2 = true;
    npc.eqKey = null; npc.gearKey = null;
  },
  // what is on them now, for the look: a slot whose item they no longer have is bare
  bare(npc) {
    const st = npc.st, eq = st.equip || {};
    return { top: !owned(st, eq.top), bottom: !owned(st, eq.bottom), shoes: !owned(st, eq.shoes), mask: !owned(st, eq.mask), hat: !owned(st, eq.hat) };
  },
};

// the look follows the inventory (only for people whose things became real)
const CI = G.companionItems, _apply = CI.applyLook;
CI.applyLook = function (npc) {
  const st = npc.st;
  if (!st.gearV2) return _apply.call(this, npc);
  const b = G.npcGear.bare(npc), key = JSON.stringify([st.equip, b]);
  if (npc.gearKey === key) return;
  npc.gearKey = key; npc.eqKey = null;
  _apply.call(this, npc);
  if (npc.def.kid) return;
  const look = Object.assign({}, npc.look);
  if (b.top) { look.shirtless = true; look.apron = null; }
  if (b.bottom) look.pantsless = true;
  if (b.shoes) look.shoes = G.assets.shade(look.skin || '#e0b088', 0.85);
  if (b.mask) look.mask = null;
  if (b.hat) look.hat = null; else { const h = G.item(st.equip.hat); look.hat = h.style; look.hatColor = h.color; }
  npc.look = look; npc.sheet = G.assets.character(look);
  if (G.love) npc.loveKey = undefined;
};

// every screen that opens someone's things shows all of it
const CT = G.CompanionTradeScene;
if (CT) {
  G.CompanionTradeScene = class extends CT { constructor(game, npc) { G.npcGear.materialize(npc); super(game, npc); } };
  G.trust && (G.trust.openManage = (scene, npc) => G.scenes.push(new G.CompanionTradeScene(scene, npc)));
}
const LS = G.LootScene;
G.LootScene = class extends LS {
  constructor(game, c) {
    // an unconscious person's pockets (js/game/aid.js): their clothes and weapon are in there too
    if (c && c.kind === 'person') {
      const npc = game.actors.find((a) => a.kind === 'npc' && 'person_' + a.id === c.id);
      if (npc) { G.npcGear.materialize(npc); c.items = npc.st.inv; this_npc = npc; }
    }
    super(game, c);
    if (c && c.kind === 'person') this.gearNpc = this_npc; this_npc = null;
  }
  close() {
    const r = super.close ? super.close() : undefined;
    if (this.gearNpc) { const st = this.gearNpc.st; st.inv = (st.inv || []).filter((e) => e[1] > 0); G.companionItems.applyLook(this.gearNpc); }
    return r;
  }
};
let this_npc = null;

// a body keeps what it was wearing: no second copy of clothes that are already items
const C = G.containers, _corpse = C.createCorpse;
C.createCorpse = function (world, npc, mapId) {
  if (!npc.st || !npc.st.gearV2) return _corpse.apply(this, arguments);
  const before = new Set(Object.keys(world.containers));
  const r = _corpse.apply(this, arguments);
  const id = Object.keys(world.containers).find((k) => !before.has(k)), c = id && world.containers[id];
  if (c && c.clothes) {
    // their clothes were already items in their pockets (copied with the body): the copies made from the look go,
    // and the body wears what was really on it (bare slots were already bare in the look)
    const eq = npc.st.equip || {};
    for (const slot of Object.keys(c.clothes)) {
      const e = c.items.find((x) => x[0] === c.clothes[slot]);
      if (e && --e[1] <= 0) c.items.splice(c.items.indexOf(e), 1);
      if (eq[slot] && owned({ inv: c.items }, eq[slot])) c.clothes[slot] = eq[slot]; else delete c.clothes[slot];
    }
  }
  return r;
};
})();
