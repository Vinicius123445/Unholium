'use strict';
// Families: parents and children, for you and for everyone else.
//   Your own children (born or adopted) show as your Son or Daughter on the relationship meter, not as a
//   "Friend". NPCs get real parent/child relations too: kids are linked to the adults they live with, and
//   grown-up children to their mother and father. Losing a child or a parent hits hardest (grief and, if
//   they saw who did it, revenge: js/data/consequences.js).
(() => {
G.social.REL_BASE.parent = 70; G.social.REL_BASE.child = 80;
const _word = G.social.relationWord;
G.social.relationWord = function (id, other) {
  const r = G.NPCS[id].relations[other], f = (G.NPCS[other] || {}).gender === 'female';
  if (r === 'parent') return f ? 'my mom' : 'my dad';
  if (r === 'child') return f ? 'my daughter' : 'my son';
  return _word.call(this, id, other);
};
// link kids to the adults they live with (once, at load)
const link = () => {
  for (const id in G.NPCS) {
    const d = G.NPCS[id];
    if (!d.kid || !d.home) continue;
    const adults = Object.keys(G.NPCS).filter((o) => o !== id && !G.NPCS[o].kid && G.NPCS[o].home === d.home && G.NPCS[o].map === d.map);
    const parents = adults.filter((o) => d.relations[o] === 'family').concat(adults.filter((o) => d.relations[o] !== 'family')).slice(0, 2);
    for (const o of parents) { d.relations[o] = 'parent'; G.NPCS[o].relations = G.NPCS[o].relations || {}; G.NPCS[o].relations[id] = 'child'; }
  }
};
link();
// grown-up children (js/game/growth.js) know their parents, and the parents know them
const _define = G.growth.define;
G.growth.define = function (w, baby) {
  const id = _define.call(this, w, baby), d = G.NPCS[id];
  for (const par of [baby.mother, baby.father, baby.adoptedBy, baby.partner]) {
    if (!par || par === 'player' || !G.NPCS[par]) continue;
    d.relations[par] = 'parent'; G.NPCS[par].relations[id] = 'child';
  }
  return id;
};
// what you are to them, when it is family
G.rel.familyOf = function (w, id) {
  const b = (w.babies || []).find((x) => x.npc === id && !x.dead && G.growth.mine(x));
  if (b) return b.sex === 'f' ? 'Daughter' : 'Son';
  return null;
};
const _tier = G.rel.tier;
G.rel.tier = function (st, id) {
  const t = _tier.call(this, st);
  const w = G.world;
  if (w) {
    if (!id) id = Object.keys(w.npcs).find((k) => w.npcs[k] === st);
    const fam = id && this.familyOf(w, id);
    if (fam && t.v > -35) return { v: t.v, name: fam, color: '#f0c060' };
  }
  return t;
};
})();
