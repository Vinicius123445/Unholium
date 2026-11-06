'use strict';
// The Notrael Kosher Market: the community's own grocery, next to their homes in the north of the Rural
// Zone. Run by a Notrael member (the grocer); fresh bread, challah and matzah, dairy, fish, produce, wine.
// It keeps the community's hours: closed on their day of rest (every seventh day) and during evening prayer.
(() => {
const look = G.look('n_grocer', { body: 'm', top: 'jacket', shirt: '#121214', shirt2: '#ecebe6', bottom: 'pants', pants: '#121214', shoes: '#0a0a0a', hat: 'kippah', hatColor: '#1a1a22', facial: 1, hair: '#3a2a20', glasses: 'round', apron: '#e8e4dc' });
G.NPCS.n_grocer = { id: 'n_grocer', name: 'Notrael Grocer', map: 'rural', faction: 'notrael', hp: 28, combat: 'flee', gold: 120, home: 'n_market', shop: 'n_market', relations: { n_elder: 'comrade' }, gender: 'male', look,
  job: 'Runs the community market.',
  schedule: [{ from: 22, to: 6, at: 'n_market_bed', act: 'sleep' }, { from: 6, to: 8, at: 'n_prayer_rows', act: 'idle' }, { from: 8, to: 18, at: 'n_market_work', act: 'work' }, { from: 18, to: 19, at: 'n_market_in', act: 'idle' }, { from: 19, to: 21, at: 'n_prayer_rows', act: 'idle' }, { from: 21, to: 22, at: 'n_market_in', act: 'idle' }] };
G.SHOPS.n_market = { name: 'Notrael Kosher Market', owner: 'n_grocer', region: 'rural', gold: 260, buyMult: 1.0, sellMult: 0.45, buys: ['consumable'], faction: 'notrael', minRep: -20,
  stock: [['challah', 6], ['matzah', 8], ['bread', 6], ['cheese', 6], ['milk', 6], ['egg', 10], ['cooked_fish', 4], ['fish', 4], ['apple', 8], ['tomato', 8], ['potato', 8], ['carrot', 8], ['cabbage_head', 4], ['wine', 6], ['water_bottle', 8]].filter(([id]) => G.ITEMS[id]) };
if (G.SHOP_SIGNS) G.SHOP_SIGNS.push([/Kosher Market/, { text: 'KOSHER MARKET', bg: '#1e3a6a', fg: '#f0e8c8', awning: ['#1e3a6a', '#f0f0f0'], icon: null }]);
const _rural = G.MAPGEN.rural;
G.MAPGEN.rural = () => {
  const m = _rural(), r = new G.RNG('n_market');
  const at = G.home.findSpot(m, 9, 7, 92, 24, 30);
  if (!at) return m;
  G.home.clearArea(m, at.x, at.y, 9, 7);
  const b = m.addBuilding('n_market', at.x, at.y, 9, 7, { name: 'Notrael Kosher Market', wall: 'wall_stone', floor: 'woodfloor', roof: 'slate', kind: 'shop', chimney: false });
  G.MB.furnish(m, b, 'shop', r, { owner: 'n_grocer', loot: [['bread', 2], ['matzah', 2]] });
  if (G.placeSign) G.placeSign(m, b);   // (the board out front: this shop comes after the others are signed)
  m.computeSolids(); m.prerender();
  return m;
};
// the shop's hours follow the community: no trading on the day of rest
if (G.shopSys && G.shopSys.isOpen) {
  const _open = G.shopSys.isOpen;
  G.shopSys.isOpen = function (sid, scene) { if (sid === 'n_market' && scene && scene.world && scene.world.day % 7 === 6) return false; return _open.apply(this, arguments); };
}
const _onLoad = G.onWorldLoaded;
G.onWorldLoaded = function (w) {
  if (_onLoad) _onLoad.apply(this, arguments);
  w.shops = w.shops || {};
  if (!w.shops.n_market) w.shops.n_market = { stock: G.util.clone(G.SHOPS.n_market.stock), gold: G.SHOPS.n_market.gold, owner: 'n_grocer' };
};
})();
