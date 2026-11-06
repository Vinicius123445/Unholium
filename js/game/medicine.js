'use strict';
// Only medicine heals.
//   Health no longer comes back by itself: not over time, not from sleeping or waiting, not from food or
//   water. Pills and medicine do it: painkillers, ibuprofen, bandages, first aid kits, medicinal herbs (and
//   the doctors' and dialogue heals that already exist). Food still fills you up exactly as much as before.
//   Bandages and first aid kits also stop a bleeding wound (see js/game/gore2.js).
(() => {
const MED = new Set(['bandage', 'first_aid_kit', 'herb', 'painkillers', 'ibuprofen', 'medkit', 'morphine', 'stitches', 'splint']);
Object.assign(G.ITEMS, {
  ibuprofen: { name: 'Ibuprofen', type: 'consumable', icon: 'pills_blue', heal: 18, medical: true, value: 8, desc: 'Over-the-counter pain relief. Restores 18 health.' },
});
G.ITEMS.ibuprofen.id = 'ibuprofen';
G.medicine = {
  isMed(id, it) { return MED.has(id) || !!(it && it.medical); },
  STOPS_BLEEDING: new Set(['bandage', 'first_aid_kit', 'medkit', 'stitches']),
};
// food keeps what it does for hunger, and stops healing
for (const id in G.ITEMS) {
  const it = G.ITEMS[id];
  if (!it.heal || G.medicine.isMed(id, it)) continue;
  if (it.food == null && it.drink == null && !G.NUTRITION[id]) { const [f, d] = G.nutrition(Object.assign({ id }, it)); it.food = f; if (d) it.drink = d; }
  it.heal = 0;
  if (it.desc) it.desc = it.desc.replace(/\s*Restores \d+ health( and stamina)?\.?/i, (m, s) => (s ? ' Restores stamina.' : '')).trim() || 'Fills you up.';
}
for (const id of MED) if (G.ITEMS[id]) G.ITEMS[id].medical = true;
// the pharmacy carries it
if (G.SHOPS.c_alchemist && !G.SHOPS.c_alchemist.stock.some((s) => s[0] === 'ibuprofen')) G.SHOPS.c_alchemist.stock.push(['ibuprofen', 10]);
// a bandage stops the bleeding
const E = G.effects, _consume = E.consume;
E.consume = function (p, it, scene) {
  const r = _consume.apply(this, arguments);
  const id = it && (it.id || Object.keys(G.ITEMS).find((k) => G.ITEMS[k] === it));
  if (G.medicine.STOPS_BLEEDING.has(id)) { p.bleedT = 0; if (scene && scene.toast) scene.toast('The bleeding stops.', 'good'); }
  return r;
};
})();
