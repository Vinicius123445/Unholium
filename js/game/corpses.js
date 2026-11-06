'use strict';
// What the dead leave behind.
//   Clothes: a body's top and bottom are in its inventory. Take them and they come off the body (it is drawn
//   shirtless or without pants, with the usual censor bars).
//   Pockets: what someone carries fits how they lived (js/game/lifestyle.js tables): dealers carry product
//   and cash, the rich carry jewelry, cops ammo and cuffs, kids candy, workers a sandwich and some pills.
(() => {
const C = G.containers, _corpse = C.createCorpse, _draw = C.draw;
const clothOf = (look, slot) => {
  if (slot === 'shoes') return look.shoes ? G.clothId('shoes', 'sneakers', look.shoes) : null;
  if (slot === 'hat') return look.hat && G.CLOTH_STYLES.hat[look.hat] ? G.clothId('hat', look.hat, look.hatColor || '#2a2a30') : null;
  if (slot === 'mask') return look.mask && G.CLOTH_STYLES.mask[look.mask] ? G.clothId('mask', look.mask, '#888888') : null;
  const style = slot === 'top' ? look.top || 'shirt' : look.bottom || 'pants';
  if (!G.CLOTH_STYLES[slot] || !G.CLOTH_STYLES[slot][style]) return null;
  return slot === 'top' ? G.clothId('top', style, look.shirt || '#6a8ab8', look.shirt2) : G.clothId('bottom', style, look.pants || '#4a3a2a');
};
C.createCorpse = function (world, npc, mapId) {
  const before = new Set(Object.keys(world.containers));
  _corpse.call(this, world, npc, mapId);
  const id = Object.keys(world.containers).find((k) => !before.has(k));
  const c = id && world.containers[id];
  if (!c || !c.look) return;
  const naked = (npc.st.nakedUntil || 0) > (G.love ? G.love.now() : 0);
  // pockets, by lifestyle (only once per person: what they were carrying is already in their inventory)
  if (!npc.st.pocketsRolled) {
    npc.st.pocketsRolled = true;
    const life = npc.def.kid || G.lifestyle.of(npc.id);
    for (const [it, n] of G.lifestyle.roll(life)) if (Math.random() < 0.6) { const e = c.items.find((x) => x[0] === it); if (e) e[1] += n; else c.items.push([it, n]); }
  }
  c.clothes = {};
  if (!naked && !npc.def.kid) for (const slot of ['top', 'bottom', 'shoes', 'mask', 'hat']) { const cid = clothOf(c.look, slot); if (cid) { c.items.push([cid, 1]); c.clothes[slot] = cid; } }
  c.look = Object.assign({}, c.look, naked ? { naked: true } : {});
};
// a corpse's look: whatever clothes are still on it
C.lookOf = function (c) {
  if (!c.clothes) return c.look;
  const has = (cid) => c.items.some((e) => e[0] === cid && e[1] > 0);
  const look = Object.assign({}, c.look);
  if (c.clothes.top && !has(c.clothes.top)) look.shirtless = true;
  if (c.clothes.bottom && !has(c.clothes.bottom)) look.pantsless = true;
  if (c.clothes.shoes && !has(c.clothes.shoes)) look.shoes = G.assets.shade(look.skin || '#e0b088', 0.85);
  if (c.clothes.mask && !has(c.clothes.mask)) look.mask = null;
  return look;
};
C.draw = function (ctx, c) {
  if (c.kind !== 'corpse' || !c.clothes) return _draw.call(this, ctx, c);
  const real = c.look;
  c.look = this.lookOf(c);
  try { return _draw.call(this, ctx, c); } finally { c.look = real; }
};
})();
