'use strict';
// Children grow up, on a real calendar (G.YEAR_DAYS days to a year).
//   Baby (0-1) and toddler (1-2) live in the crib. At 2 they outgrow it: the crib goes and the child is a
//   person in the house, walking around (small). Child (3-12, def.kid 'kid'), teenager (13-17, 'teen'),
//   young adult (18-25), adult (26+). They keep their name, their parents and their home; your own
//   children know you (introduced, and they like you).
//   Adoption: in a romantic relationship (any couple, same sex too), ask your partner to adopt. Whether
//   they want to depends on how they live (a steady job and a home: likelier; gangs, dealing, the street:
//   no) and on how close you are. The agency takes a fee and a few days, then a child comes home to you.
//   (Two women, or two men, cannot have a baby together: G.love.conceive checks; adoption is the way.)
(() => {
G.YEAR_DAYS = 365;
const Y = () => G.YEAR_DAYS;
G.growth = {
  age(w, baby) { return (w.day - baby.born) / Y(); },   // in years
  stage(w, baby) {
    const a = this.age(w, baby);
    return a < 1 ? 'baby' : a < 2 ? 'toddler' : a < 3 ? 'little' : a < 13 ? 'child' : a < 18 ? 'teen' : a < 26 ? 'young adult' : 'adult';
  },
  STAGE_NAME: { baby: 'Baby', toddler: 'Toddler', little: 'Little Kid', child: 'Child', teen: 'Teenager', 'young adult': 'Young Adult', adult: 'Adult' },
  home(baby) { return baby.home || (baby.mother === 'player' || baby.father === 'player' || baby.adopted ? { map: 'rural', b: G.world.flags.player_home || 'r_home' } : { map: G.NPCS[baby.mother] && G.NPCS[baby.mother].map, b: G.NPCS[baby.mother] && G.NPCS[baby.mother].home }); },
  mine(baby) { return baby.mother === 'player' || baby.father === 'player' || baby.adoptedBy === 'player'; },
  // the NPC definition for a child who has left the crib (rebuilt every load; only the state is saved)
  define(w, baby) {
    const id = baby.npc || (baby.npc = 'child_' + baby.id);
    const h = this.home(baby), stage = this.stage(w, baby);
    const look = G.look('child-' + baby.id + (baby.name || ''), { body: baby.sex, skin: baby.skin || undefined });
    const kid = stage === 'little' || stage === 'child' ? 'kid' : stage === 'teen' ? 'teen' : null;
    const at = h.b ? h.b + '_in' : 'start';
    const map = G.maps.get(h.map);
    const sched = map && map.points[at] ? (kid
      ? [{ from: 21, to: 7, at, act: 'sleep' }, { from: 7, to: 21, at, act: 'wander' }]
      : [{ from: 23, to: 7, at, act: 'sleep' }, { from: 7, to: 23, at, act: 'wander' }]) : [];
    const relations = {};
    for (const par of [baby.mother, baby.father, baby.adoptedBy, baby.partner]) if (par && par !== 'player') relations[par] = 'family';
    G.NPCS[id] = { name: this.STAGE_NAME[stage], map: h.map, home: h.b, faction: 'civilians', hp: kid ? 20 : 40, combat: 'flee', look, kid, toddler: stage === 'little', relations, schedule: sched, gender: baby.sex === 'f' ? 'female' : 'male', grownChild: baby.id };
    return id;
  },
  // bring a child out of the crib: they are a person now
  promote(w, baby, scene) {
    const id = this.define(w, baby);
    if (!w.npcs[id]) {
      const st = w.freshNpcState(id, null);
      const parent = [baby.mother, baby.father, baby.adoptedBy].find((x) => x && x !== 'player' && w.npcs[x]);
      const surname = parent ? w.npcs[parent].realName.split(' ').slice(-1)[0] : (scene && scene.player.playerName ? scene.player.playerName.split(' ').slice(-1)[0] : '');
      st.realName = [baby.name || G.randomName(G.rng, baby.sex === 'f' ? 'female' : 'male').split(' ')[0], surname].filter(Boolean).join(' ');
      if (this.mine(baby)) { st.introduced = true; st.disp = 60; }
      w.npcs[id] = st;
    }
    w.npcs[id].name = this.STAGE_NAME[this.stage(w, baby)];
    if (baby.crib) this.removeCrib(w, baby, scene);
    baby.out = true;
    if (scene && scene.map.id === w.npcs[id].map && !scene.actors.some((a) => a.id === id)) scene.syncPresence();
  },
  removeCrib(w, baby, scene) {
    const c = baby.crib; baby.crib = null;
    const mods = w.modsFor(c.map), key = 'crib@' + c.tx + ',' + c.ty;
    if (scene && scene.map.id === c.map) { const d = scene.map.decorsAt(c.tx, c.ty).find((x) => x.type === 'crib'); if (d) G.mods.removeDecor(scene.map, d); }
    if (mods.added[key]) delete mods.added[key];
    else if (!(scene && scene.map.id === c.map)) mods.removed[key] = w.day;
    if (!(scene && scene.map.id === c.map)) G.maps.invalidate(c.map);
  },
  // once a day: everyone gets a little older
  daily(w, scene) {
    for (const baby of w.babies || []) {
      if (baby.dead) continue;
      const stage = this.stage(w, baby);
      if (!baby.out && this.age(w, baby) >= 2) {
        this.promote(w, baby, scene);
        if (this.mine(baby)) w.log(`${baby.name || 'Your child'} has outgrown the crib. ${baby.sex === 'f' ? 'She' : 'He'} is walking all over the house now.`, 'quest');
      }
      if (baby.out && baby.stage !== stage) {
        if (baby.stage && this.mine(baby)) w.log(`${baby.name || 'Your child'} is a ${this.STAGE_NAME[stage].toLowerCase()} now.`, 'quest');
        baby.stage = stage;
        const id = this.define(w, baby);
        if (w.npcs[id]) w.npcs[id].name = this.STAGE_NAME[stage];
        if (scene) { const a = scene.actors.find((x) => x.id === id); if (a) { a.def = G.NPCS[id]; a.look = a.def.look; a.sheet = G.assets.character(a.look); } }
      }
    }
  },
};
// a grown-up child who dies stops growing
G.events.on('npcDied', (id) => { const b = (G.world && G.world.babies || []).find((x) => x.npc === id); if (b) b.dead = true; });
G.onWorldLoaded = (w) => {
  // children from another save (one played later, or another game) are not part of this world: forget them
  const mine = new Set((w.babies || []).filter((b) => b.out).map((b) => b.npc || 'child_' + b.id));
  for (const id of Object.keys(G.NPCS)) if (G.NPCS[id].grownChild && !mine.has(id)) { delete G.NPCS[id]; for (const o in G.NPCS) if (G.NPCS[o].relations) delete G.NPCS[o].relations[id]; }
  for (const baby of w.babies || []) if (baby.out) G.growth.define(w, baby);
};
G.events.on('hour', () => {
  const w = G.world; if (!w || w.hour !== 6) return;
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  G.growth.daily(w, scene);
});
// toddlers are tiny
const NP = G.NPC.prototype, _draw = NP.draw;
NP.draw = function (ctx) {
  if (!this.def.toddler) return _draw.call(this, ctx);
  ctx.save(); ctx.translate(this.x, this.y); ctx.scale(0.8, 0.8); ctx.translate(-this.x, -this.y); _draw.call(this, ctx); ctx.restore();   // on top of the kid scale
};
// the crib says how old they are
const _use = G.love.useCrib;
G.love.useCrib = function (d, scene) {
  const baby = this.babyAt(scene.world, scene.map.id, d.tx, d.ty);
  if (baby && G.growth.age(scene.world, baby) >= 1 && !baby.out) { scene.toast(`${baby.name || 'The toddler'} is ${Math.floor(G.growth.age(scene.world, baby) * 12)} months old and trying to climb out of the crib.`); return; }
  return _use.call(this, d, scene);
};

// ---------------------------------------------------------------- adoption
const LIFE_WANTS = { worker: 0.6, shopkeeper: 0.6, farmer: 0.65, rich: 0.5, retiree: 0.25, cop: 0.55, gang: 0.1, dealer: 0.05, homeless: 0.02 };
G.adoption = {
  FEE: 500, DAYS: 3,
  // does `id` want to adopt with you?
  decide(w, id) {
    const st = w.npcs[id], life = G.lifestyle.of(id), P = G.social.persona(id);
    let p = LIFE_WANTS[life] != null ? LIFE_WANTS[life] : 0.4;
    if (st.addict && st.addict.level >= 2) p *= 0.2;
    p += (G.rel.value(st) - 70) / 150;
    if (['friendly', 'cheerful', 'nervous'].includes(P.trait)) p += 0.1;
    if (['grumpy', 'tired'].includes(P.trait)) p -= 0.15;
    if ((w.babies || []).some((b) => !b.dead && (b.adoptedBy === 'player' || G.growth.mine(b)) && G.growth.age(w, b) < 5)) p -= 0.25;   // a little one at home already
    const r = new G.RNG('adopt' + id + Math.floor(w.day / 7));   // they will not change their mind every five minutes
    return { yes: r.next() < G.util.clamp(p, 0.02, 0.95), life, trait: P.trait };
  },
  start(w, partner) {
    w.adoption = { partner, ready: w.day + this.DAYS, sex: G.rng.chance(0.5) ? 'f' : 'm', age: G.rng.int(0, 9) };
  },
  arrive(w, scene) {
    const a = w.adoption; w.adoption = null;
    const baby = { id: 'baby' + ((w.babies = w.babies || []).length + 1), sex: a.sex, mother: null, father: null, adopted: true, adoptedBy: 'player', partner: a.partner, born: w.day - Math.round(a.age * G.YEAR_DAYS) - G.rng.int(0, 200), name: G.randomName(G.rng, a.sex === 'f' ? 'female' : 'male').split(' ')[0], sickly: false };
    baby.home = { map: 'rural', b: w.flags.player_home || 'r_home' };
    if (G.growth.age(w, baby) < 2) baby.crib = G.love.placeCrib(w, baby.home.map, baby.home.b);
    w.babies.push(baby);
    if (!baby.crib) G.growth.promote(w, baby, scene);
    const age = Math.floor(G.growth.age(w, baby));
    w.log(`The adoption went through. ${baby.name} (${a.sex === 'f' ? 'a girl' : 'a boy'}, ${age ? age + (age === 1 ? ' year' : ' years') + ' old' : 'a baby'}) is home with you now.`, 'quest');
    if (a.partner && w.isAlive(a.partner)) G.phone.queue(w, a.partner, `${baby.name} is HOME. I keep staring at ${a.sex === 'f' ? 'her' : 'him'}. We are a family now.`, 1);
  },
};
G.events.on('hour', () => {
  const w = G.world; if (!w || !w.adoption || w.day < w.adoption.ready || w.hour < 10) return;
  G.adoption.arrive(w, G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene));
});
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, w = runner.scene.world;
  if (npc.def.kid || npc.remote && !st.partner || !(st.partner || (st.romance || 0) >= 40) || w.adoption) return [];
  return [{ text: 'I have been thinking... would you want to adopt a child with me?', next: '_adopt' }];
});
G.DIALOGUE_NODES._adopt = (r) => {
  const { npc, scene } = r, w = scene.world, p = scene.player, d = G.adoption.decide(w, npc.id);
  const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
  if (!d.yes) {
    const why = { gang: 'With the life I live? A kid does not belong anywhere near it.', dealer: 'In my line of work? No. Never.', homeless: 'I can barely take care of myself.', retiree: 'At my age? I love you, but no.' }[d.life]
      || G.rng.pick(['I... I do not think I am ready for that. I am sorry.', 'A kid? That is a huge thing. Not now.', 'I do not see myself as a parent. I never have.']);
    G.social.addDisp(w, npc.id, -2);
    return { text: why, choices: BACK };
  }
  return { text: G.rng.pick(['Are you serious? ...Yes. YES. I have wanted that for so long.', 'Adopt? You and me? ...I would love that.']) + ` The agency charges $${G.adoption.FEE} and needs a few days.`, choices: [
    { text: `Let's do it. ($${G.adoption.FEE})`, next: null, if: () => p.gold >= G.adoption.FEE, do: () => { p.gold -= G.adoption.FEE; G.adoption.start(w, npc.id); G.social.addDisp(w, npc.id, 10); w.log(`You and ${w.displayName(npc.id)} applied to adopt. The agency will call in a few days.`, 'quest'); scene.toast('Adoption: the agency will be in touch in a few days.', 'quest'); } },
    { text: p.gold >= G.adoption.FEE ? 'Let me think about it.' : `I need to save up the $${G.adoption.FEE} first.`, next: null },
  ].filter((c) => !c.if || c.if()) };
};
})();
// a new game starts without anybody's children
(() => {
const _cn = G.World.createNew;
G.World.createNew = function () { for (const id of Object.keys(G.NPCS)) if (G.NPCS[id].grownChild) { delete G.NPCS[id]; for (const o in G.NPCS) if (G.NPCS[o].relations) delete G.NPCS[o].relations[id]; } return _cn.apply(this, arguments); };
})();
