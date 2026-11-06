'use strict';
// Fights closer to real ones.
//   Melee damage: a blow does about what it would: a punch hurts but rarely does much on its own, a bat or a
//   pipe can put someone down in a few swings, a knife opens wounds that bleed (js/game/aid.js) more than it
//   hits hard. Every melee hit is scaled by the kind of weapon (MELEE_MULT).
//   Out of rounds: an NPC whose gun is empty and who has nothing left to reload switches to the best melee
//   weapon in their pockets (or their fists) and closes in, instead of standing there aiming. They pick
//   the gun back up as soon as they have rounds again.
//   NPC skills: everyone has a few ranks in the same skill tree you do, by how they live (a gang member
//   brawls, a cop shoots and takes a hit, a farmer is strong, a shopkeeper haggles), seeded per person so it
//   never changes, and modest (2 to 4 ranks, a fighter or a leader a little more). They count wherever skills
//   count: melee damage, defense, damage resistance, luck, and how well they knock someone out (knockout.js).
(() => {
const NP = G.NPC.prototype, S = G.skills;

// ---------------------------------------------------------------- NPC skills
const PACKS = {
  gang: [['brawler', 2], ['power', 1], ['thick_skin', 1], ['intimidation', 1], ['marksman', 1], ['pain_tolerance', 1]],
  cop: [['marksman', 2], ['thick_skin', 1], ['conditioning', 1], ['quick_reload', 1], ['hard_head', 1], ['intimidation', 1]],
  farmer: [['power', 1], ['big_frame', 1], ['endurance', 1], ['strong_stomach', 1], ['brawler', 1]],
  worker: [['endurance', 1], ['power', 1], ['toughness', 1], ['haggler', 1]],
  rich: [['silver_tongue', 2], ['haggler', 1], ['networker', 1]],
  retiree: [['field_medic', 1], ['strong_stomach', 1], ['silver_tongue', 1]],
  homeless: [['iron_liver', 2], ['strong_stomach', 1], ['sneaky', 1], ['pain_tolerance', 1]],
  dealer: [['hardened_user', 1], ['sneaky', 1], ['haggler', 1], ['brawler', 1], ['marksman', 1]],
  shopkeeper: [['haggler', 2], ['silver_tongue', 1], ['marksman', 1]],
  teen: [['sneaky', 1], ['brawler', 1]],
  child: [],
};
const BUDGET = { gang: 4, cop: 4, farmer: 3, worker: 2, rich: 2, retiree: 2, homeless: 2, dealer: 3, shopkeeper: 2, teen: 1, child: 0 };
const cache = new Map();
G.npcSkills = {
  PACKS, BUDGET,
  ranks(id) {
    if (cache.has(id)) return cache.get(id);
    const def = G.NPCS[id] || {}, life = def.kid ? (def.kid === 'teen' ? 'teen' : 'child') : G.lifestyle ? G.lifestyle.of(id) : 'worker';
    const r = new G.RNG('skills-' + id), out = {};
    let left = (BUDGET[life] != null ? BUDGET[life] : 2) + (def.combat === 'fight' && !def.kid ? 1 : 0) + (def.leader ? 2 : 0);
    const pack = (PACKS[life] || PACKS.worker).slice();
    if (def.combat === 'fight' && !def.kid) pack.push(['brawler', 1]);
    if (def.leader) pack.push(['cult_of_personality', 1], ['silver_tongue', 1]);
    if (def.combat === 'guard') pack.push(['marksman', 1]);
    for (let i = pack.length - 1; i > 0; i--) { const j = r.int(0, i); [pack[i], pack[j]] = [pack[j], pack[i]]; }
    for (let pass = 0; pass < 3 && left > 0; pass++) for (const [sid, cap] of pack) {
      if (left <= 0) break;
      const sk = G.SKILLS[sid]; if (!sk) continue;
      if ((out[sid] || 0) >= Math.min(cap, sk.ranks) || r.next() < 0.25) continue;
      out[sid] = (out[sid] || 0) + 1; left--;
    }
    cache.set(id, out);
    return out;
  },
};
const _rank = S.rank, _stat = S.stat;
S.rank = function (p, id) { if (p && p.kind === 'npc') return G.npcSkills.ranks(p.id)[id] || 0; return _rank.apply(this, arguments); };
S.has = function (p, id) { return this.rank(p, id) > 0; };
S.stat = function (p, name) {
  if (!p || p.kind !== 'npc') return _stat.apply(this, arguments);
  let v = G.BASE_STATS[name] || 0;
  const ranks = G.npcSkills.ranks(p.id);
  for (const id in ranks) { const fx = G.SKILLS[id] && G.SKILLS[id].fx; if (fx && fx[name]) v += fx[name] * ranks[id]; }
  return v;
};
// NPCs hit as hard as their skills say, and take a hit as well as theirs do
const _ndmg = NP.damage, _ndef = NP.defense;
NP.damage = function (t) { const b = _ndmg.apply(this, arguments); return b * (1 + G.util.clamp(S.stat(this, 'meleeDmg'), 0, 0.5)); };
NP.defense = function () { return (_ndef ? _ndef.call(this) : 0) + Math.min(3, S.stat(this, 'defense')); };

// ---------------------------------------------------------------- melee: what a blow really does
const MELEE_MULT = { fist: 0.75, blunt: 0.6, heavy: 0.7, blade: 0.8, chop: 0.75 };
G.MELEE_MULT = MELEE_MULT;
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  if (source && source.swing && !(o && o.bullet)) {
    const k = G.ko.kindOf(source, o);
    if (MELEE_MULT[k]) amount = Math.max(1, amount * MELEE_MULT[k]);
  }
  return _dmg.call(this, target, amount, source, scene, o);
};

// ---------------------------------------------------------------- out of rounds: fight with what you have
const count = (st, id) => (st.inv || []).reduce((n, e) => n + (e[0] === id ? e[1] || 1 : 0), 0);
const bestMelee = (st) => {
  let best = null;
  for (const [id, n] of st.inv || []) { const it = G.ITEMS[id]; if (n > 0 && it && it.type === 'weapon' && !it.gun && (!best || (it.dmg || 0) > (best.dmg || 0))) best = it; }
  return best;
};
const desc = Object.getOwnPropertyDescriptor(NP, 'weaponItem');
Object.defineProperty(NP, 'weaponItem', { configurable: true, get() {
  const w = desc.get.call(this);
  if (!w || !w.gun || !w.ammo || !this.st || !G.npcAmmo) return w;
  G.npcAmmo.seed(this.st, this.def);
  const dry = (this.st.mag || 0) + count(this.st, w.ammo) <= 0;
  if (!dry || this.state !== 'fight' || this._firing) { if (!dry) this._dry = false; return w; }   // (an empty gun is still carried; it only gets swapped out in a fight)
  const m = bestMelee(this.st);
  if (!this._dry) {   // the moment it happens
    this._dry = true;
    if (this.state === 'fight' && this.say) this.say(m ? G.rng.pick([`I'm out! *pulls out a ${m.name.toLowerCase()}*`, 'Empty! Fine, the hard way.']) : G.rng.pick(['I\'m out! Come here!', 'No more rounds. I\'ll use my fists.']), 2.5);
    this.reloadT = 0; this.attackCd = Math.min(this.attackCd || 0, 0.3); this.flank = null;
  }
  return m || null;
} });
})();
// anything that asks an NPC to shoot when they have nothing to shoot with gets a blow instead
(() => {
const F = G.firearms, _nf = F.npcFire;
F.npcFire = function (npc, scene, target) {
  const w = npc.weaponItem;
  if (!w || !w.gun) { if (!(npc.attackCd > 0) && target && npc.distTo(target) < 24) { npc.faceTowards(target); G.combat.attack(npc, scene); } return; }
  npc._firing = true; try { return _nf.apply(this, arguments); } finally { npc._firing = false; }
};
})();
