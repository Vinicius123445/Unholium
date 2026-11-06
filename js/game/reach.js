'use strict';
// You can only reach what you could actually touch: the last word on every [E] target (people, containers,
// fridges and other fixtures, furniture, cars...), after all the modules that add their own targets.
//   Same side of the walls: standing outside you cannot loot, use or talk to anything inside a building,
//   and inside you cannot reach outside through the wall (or into the next room through a partition).
//   A straight line from your hands to the thing must not pass through a wall tile (doorways are open).
(() => {
const GS = G.GameScene.prototype, _find = GS.findInteraction;
const posOf = (t) => {
  const r = t && t.ref;
  if (!r || !['npc', 'container', 'decor'].includes(t.type)) return null;   // (doors, cars, crops... carry their own rules)
  if (t.type === 'decor' && r.def) return { x: r.x, y: r.y - 6, tx: r.tx, ty: r.ty };
  if (r.x != null && r.y != null) return { x: r.x, y: r.y - 4 };
  return null;
};
G.reach = {
  // does a wall stand between (x0,y0) and (x1,y1)? (the target's own tile does not count: things on a wall)
  blocked(map, x0, y0, x1, y1, own) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 3);
    for (let i = 1; i < n; i++) {
      const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      if (Math.hypot(x1 - x, y1 - y) < 7) break;
      const tx = Math.floor(x / 16), ty = Math.floor(y / 16);
      if (own && own.some(([a, b]) => a === tx && b === ty)) continue;
      const def = map.tileDef(tx, ty);
      if (def && (def.wall || def.name === 'citywall' || def.name === 'cliff')) return true;
    }
    return false;
  },
  ok(scene, t) {
    const at = posOf(t);
    if (!at) return true;
    const p = scene.player, map = scene.map;
    const inB = map.buildingAt(p.x, p.y - 3), tB = map.buildingAt(at.x, at.y + 3);
    if (inB !== tB && t.type !== 'decor') return false;
    const own = t.type === 'decor' ? map.footprint(t.ref).map((i) => [i % map.w, Math.floor(i / map.w)]) : null;
    return !this.blocked(map, p.x, p.y - 6, at.x, at.y, own);
  },
};
GS.findInteraction = function () {
  const t = _find.call(this);
  if (!t || G.reach.ok(this, t)) return t;
  return null;
};
})();

// Standing behind something tall (a shop sign, a tree, a lamp post, a wardrobe): it turns see-through
// while it covers you, so you are clearly behind it and never look like you are inside it.
(() => {
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const p = scene && scene.player;
  if (!p || !s || p.dead || o.y <= p.y || s.h < 18) return _dd.call(this, ctx, o, s, scene);
  const k = G.decorScale(o.type), x0 = o.x - s.ax * k[0], y0 = o.y - s.ay * k[1];
  const covers = p.x + 5 > x0 + 2 && p.x - 5 < x0 + s.w * k[0] - 2 && p.y - 20 < y0 + s.h * k[1] - 4 && p.y > y0 + 2;
  if (!covers) return _dd.call(this, ctx, o, s, scene);
  const a = ctx.globalAlpha; ctx.globalAlpha = a * 0.45;
  try { return _dd.call(this, ctx, o, s, scene); } finally { ctx.globalAlpha = a; }
};
})();
