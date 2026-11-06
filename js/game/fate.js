'use strict';
// Fate. A silent, persistent ledger of what the player does, and a hidden tilt on their luck.
// Nothing here is ever shown or announced: no meter, no messages, no confirmation it exists.
//   Sin (w.fate.guilt): grows with harmful acts, weighted by severity (five internal tiers, every weight in
//   G.fate.SINS), by repetition (the same kind of act again soon weighs more), and by context (killing someone
//   who was attacking you weighs a fraction of a murder; exposure is judged by place, witnesses and who
//   saw). Recorded from what the game already does: the crimes it reports, deaths you cause, drugs you take,
//   eating people, cutting up bodies, unique sexual partners beyond three, indecent exposure in public.
//   Redemption (w.fate.red, w.fate.virtue): prayer at an altar, time spent in a house of worship, confession,
//   donations and charity, giving to people in need, honest work for others, quiet sitting (meditation),
//   and days that pass without new harm. Each act is worth a little; the same act again the same day is
//   worth less; and redemption weighs less while the harm keeps coming (someone still sinning gets little
//   from occasional penance). Enough sustained good can wash away anything, slowly; beyond that, good
//   behavior builds up a quiet store of grace.
//   Luck: the hidden modifier (G.fate.luckMod) bends the player's luck stat (G.skills.stat 'luck'), which
//   every chance in the game already uses: loot, gambling, fishing, lockpicking, hotwiring, kicking doors,
//   crits, propositions... plus a few things that only luck decides here: a jammed gun, a lost or found bill.
//   It changes odds, never outcomes.
//   Off (w.fate.off): the player answered "no" to the question at the start of a new game (js/game/newgame.js).
//   Nothing is recorded and luck is left alone. Only the Debug Menu's Moral Causality tab shows or switches it.
(() => {
const W = () => G.world;
const F = G.fate = {
  // ---------------- configurable weights
  SINS: {
    vandalism: 2, trespass: 1, theft_petty: 3, theft: 8, theft_serious: 22, extortion: 9, drugs_public: 2, assault: 4, livestock: 6, arson: 30, minors: 12,
    murder: 55, kill_defense: 5, kill_child: 110, cruelty_animal: 8, cannibalism: 45, dismember: 25,
    drug_use: 2, binge: 3, partner_extra: 7, exposure_public: 9, exposure_child: 125,
  },
  GOOD: { pray: 1.5, attend: 3, confess: 4, donate: 4, charity_big: 10, give_needy: 3, job_help: 2, meditate: 1.5, clean_day: 1.5 },
  REPEAT_WINDOW: 3 * 1440,   // minutes: the same kind of harm again within three days weighs more
  LUCK_MIN: -2.4, LUCK_MAX: 1.2, GUILT_SCALE: 140, VIRTUE_SCALE: 60,
  // ---------------- state
  st(w = W()) {
    if (!w) return null;
    return (w.fate = w.fate || { guilt: 0, sinTotal: 0, red: 0, virtue: 0, log: [], partners: [], done: {}, goodDay: {}, lastSinDay: -1, cleanDays: 0 });
  },
  now() { const w = W(); return w ? w.day * 1440 + w.minutes : 0; },
  // ---------------- queries (for other systems; never shown)
  guilt() { const s = this.st(); return s ? s.guilt : 0; },
  redemption() { const s = this.st(); return s ? s.red : 0; },
  luckMod() {
    const s = this.st(); if (!s || s.off) return 0;
    const bad = this.LUCK_MIN * (1 - Math.exp(-s.guilt / this.GUILT_SCALE)), good = this.LUCK_MAX * (1 - Math.exp(-s.virtue / this.VIRTUE_SCALE));
    return G.util.clamp(bad + good, this.LUCK_MIN, this.LUCK_MAX);
  },
  effectiveLuck(p) { return G.skills.stat(p, 'luck'); },   // (the wrapper below adds the hidden part)
  // recent harm (the last week), for weighing penance
  recent(s, days = 7) { const t = this.now() - days * 1440; return s.log.filter((e) => e.t >= t).reduce((n, e) => n + e.w, 0); },
  // a new adult partner (repeat encounters with the same person do not count)
  partner(id) {
    const s = this.st(); if (!s || s.off || s.partners.includes(id)) return 0;
    s.partners.push(id);
    const n = s.partners.length;
    return n > 3 ? this.sin('partner_extra', { weight: this.SINS.partner_extra + (n - 4) * 2 }) : 0;
  },
  // how exposure is judged: at home, alone or swimming it is nothing; seen by children it is the gravest; seen
  // by a few adults in public it is indecent
  exposureKind(o) { if (!o.exposed || o.home || o.swimming || o.vehicle) return null; if (o.kids > 0) return 'exposure_child'; if (o.adults >= 2) return 'exposure_public'; return null; },
  findChance(luck) { return 0.012 * Math.max(0.2, 1 + luck * 0.35); },
  loseChance(luck) { return 0.01 * Math.max(0.2, 1 - luck * 0.35); },
  // ---------------- recording
  sin(kind, opts = {}) {
    const s = this.st(); if (!s || s.off) return 0;
    if (opts.key) { if (s.done[opts.key]) return 0; s.done[opts.key] = this.now(); }   // the same incident once
    let w = opts.weight != null ? opts.weight : this.SINS[kind] || 0;
    if (!w) return 0;
    const t = this.now(), same = s.log.filter((e) => e.k === kind && t - e.t < this.REPEAT_WINDOW).length;
    w *= Math.min(2.2, 1 + same * 0.25);   // a pattern weighs more than an incident
    s.guilt += w; s.sinTotal += w; s.virtue = Math.max(0, s.virtue - w * 0.6);
    s.log.push({ k: kind, w: Math.round(w * 10) / 10, t });
    if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
    s.lastSinDay = W().day; s.cleanDays = 0;
    return w;
  },
  good(kind, opts = {}) {
    const s = this.st(); if (!s || s.off) return 0;
    if (opts.key) { if (s.done[opts.key]) return 0; s.done[opts.key] = this.now(); }
    const day = W().day, gk = kind + '@' + day, n = s.goodDay[gk] = (s.goodDay[gk] || 0) + 1;
    let v = (opts.value != null ? opts.value : this.GOOD[kind] || 0) / n;   // the same act again today: worth less
    v /= 1 + this.recent(s) / 40;                                            // penance while still sinning: worth less
    s.red += v;
    const wash = Math.min(s.guilt, v); s.guilt -= wash; s.virtue += (v - wash) * 0.8 + wash * 0.1;
    for (const k in s.goodDay) if (+k.split('@')[1] < day - 2) delete s.goodDay[k];
    return v;
  },
};
// ---------------- the hidden part of luck
const _stat = G.skills.stat;
G.skills.stat = function (p, name) {
  const v = _stat.apply(this, arguments);
  return name === 'luck' && p && p.kind === 'player' ? v + F.luckMod() : v;
};

// ---------------- harm, from what the game already reports
const GS = G.GameScene.prototype, _rc = GS.reportCrime;
GS.reportCrime = function (type, victim, value = 0, victimId = null) {
  const r = _rc.apply(this, arguments);
  const vid = victimId || (victim && victim.id) || '', key = (k) => `${k}:${vid}:${Math.floor(F.now() / 10)}`;   // one record per act (10-minute window)
  switch (type) {
    case 'robbery': F.sin('theft_serious', { key: key('robbery') }); break;
    case 'theft': F.sin(value >= 200 ? 'theft_serious' : value >= 25 ? 'theft' : 'theft_petty', { key: key('theft' + value) }); break;
    case 'assault': if (!(victim && victim.state === 'fight' && victim.target === this.player)) F.sin('assault', { key: key('assault') }); break;
    case 'extortion': F.sin('extortion', { key: key('ext') }); break;
    case 'vandalism': F.sin('vandalism', { key: key('van') }); break;
    case 'trespass': F.sin('trespass', { key: key('tres') }); break;
    case 'drugs': F.sin('drugs_public', { key: key('drg') }); break;
    case 'livestock': F.sin('livestock', { key: key('liv') }); break;
    case 'arson': F.sin('arson', { key: key('arson') }); break;
    case 'minors': F.sin('minors', { key: key('min') }); break;
  }
  return r;
};
// deaths you cause: murder, a killing in self-defense, a child, an animal that was someone's companion
const NP = G.NPC.prototype, _die = NP.die;
NP.die = function (source, scene) {
  const was = this.dead, self = this.state === 'fight' && this.target && this.target.kind === 'player' || this.aggressor || this.state === 'mug';
  const r = _die.apply(this, arguments);
  if (!was && scene && (source === scene.player || (source && source.firePlayer))) {
    const kid = this.def && this.def.kid;
    F.sin(kid ? 'kill_child' : self ? 'kill_defense' : 'murder', { key: 'kill:' + this.id });
  }
  return r;
};
const AN = G.Animal.prototype, _adie = AN.die;
AN.die = function (source, scene) {
  const r = _adie.apply(this, arguments);
  if (scene && source === scene.player && (this.rec || this.strayId || this.species === 'dog' || this.species === 'cat')) F.sin('cruelty_animal', { key: 'animal:' + (this.rec ? this.rec.id : this.strayId || Math.random()) });
  return r;
};
// drugs (and drinking yourself senseless)
const E = G.effects, _take = E.takeDrug;
E.takeDrug = function (p, it, scene) {
  const r = _take.apply(this, arguments);
  if (p && p.kind === 'player') F.sin('drug_use');
  return r;
};
const _consume = E.consume;
E.consume = function (p, it, scene) {
  const r = _consume.apply(this, arguments);
  if (p && p.kind === 'player' && it) {
    const id = it.id || '';
    if (it.human || /^(body_|long_pork|cooked_brain)/.test(id)) { F.sin('cannibalism'); if (scene && scene.actors && scene.actors.some((a) => a.kind === 'npc' && !a.dead && !a.sleeping && a.canSee && a.canSee(scene, p, 110))) W().commitCrime('cannibalism', scene.region, true); }
    if (it.alcohol && p.alcohol > 70) F.sin('binge', { key: 'binge:' + W().day });
  }
  return r;
};
if (G.dismember && G.dismember.run) { const _run = G.dismember.run; G.dismember.run = function (scene, c) { const r = _run.apply(this, arguments); F.sin('dismember', { key: 'dis:' + (c && c.id) }); return r; }; }
// partners: unique adults; beyond three, each new one weighs a little more
if (G.love && G.love.withPlayer) {
  const _wp = G.love.withPlayer;
  G.love.withPlayer = function (scene, npc) {
    const r = _wp.apply(this, arguments);
    if (npc && npc.id && !(npc.def && npc.def.kid)) F.partner(npc.id);
    return r;
  };
}
// exposure: naked (or topless where it counts) in public, seen; never at home, alone, or swimming
if (G.everyday && G.everyday.reactNudity) {
  const EV = G.everyday, _rn = EV.reactNudity;
  EV.reactNudity = function (scene, dt) {
    const r = _rn.apply(this, arguments);
    if ((F.nT = (F.nT || 0) - dt) > 0) return r;
    F.nT = 1;
    const p = scene.player, w = scene.world, ex = this.exposure(p);
    if (!ex || p.vehicle || p.swimming || p.dead || p.sleeping) return r;
    const b = scene.map.buildingAt(p.x, p.y - 3);
    if (b && (w.flags.player_home === b.id || b.playerBuilt || (b.floorOf && w.flags.player_home === b.floorOf))) return r;   // your own home
    const seen = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.sleeping && a.canSee && a.canSee(scene, p, 120));
    const kids = seen.filter((a) => a.def && a.def.kid), adults = seen.length - kids.length;
    const hour = Math.floor(F.now() / 60), kind = F.exposureKind({ exposed: true, kids: kids.length, adults });
    if (kind === 'exposure_child') F.sin(kind, { key: 'expk:' + w.day });
    else if (kind) F.sin(kind, { key: 'exp:' + scene.map.id + ':' + hour });
    return r;
  };
}

// ---------------- redemption, from ordinary things people do
const _ud = GS.useDecor;
GS.useDecor = function (d) {
  const r = _ud.apply(this, arguments);
  if (d && d.def && d.def.interact === 'altar') F.good('pray', { key: 'pray:' + Math.floor(F.now() / 30) });   // (one prayer per half hour counts)
  return r;
};
// time in a house of worship, quiet sitting, days without harm
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.apply(this, arguments);
  const p = this.player, w = this.world, s = F.st(w);
  if (!p || !s || p.dead) return r;
  if ((F.uT = (F.uT || 0) - dt) > 0) return r;
  F.uT = 2;
  const b = this.map.buildingAt(p.x, p.y - 3);
  if (b && b.kind === 'temple') { s.inTemple = (s.inTemple || 0) + 2; if (s.inTemple >= 30) F.good('attend', { key: 'attend:' + w.day }); } else s.inTemple = 0;
  if (p.sitting && !p.moving) { s.sitT = (s.sitT || 0) + 2; if (s.sitT >= 60) F.good('meditate', { key: 'med:' + w.day }); } else s.sitT = 0;
  if (s.dayChecked !== w.day) {   // a new day: was yesterday clean?
    if (s.dayChecked != null && s.lastSinDay < w.day - 1 && s.sinTotal > 0) { s.cleanDays = (s.cleanDays || 0) + 1; F.good('clean_day', { value: F.GOOD.clean_day * Math.min(3, 1 + s.cleanDays * 0.2) }); }
    s.dayChecked = w.day;
  }
  return r;
};
// donations and charity
const PR = G.DIALOGUES && G.DIALOGUES.priest;
if (PR && PR.donate && typeof PR.donate.text === 'function') { const _t = PR.donate.text; PR.donate.text = function (c) { const g0 = c.p.gold, out = _t.apply(this, arguments); if (c.p.gold < g0) F.good('donate'); return out; }; }
const DN = G.DIALOGUE_NODES;
for (const [k, kind] of [['_mz_charity', 'charity_big'], ['_addict_give', 'give_needy']]) if (DN[k]) { const _n = DN[k]; DN[k] = function (r) { const g0 = r.scene.player.gold, out = _n.apply(this, arguments); if (r.scene.player.gold < g0) F.good(kind); return out; }; }
// confession: a priest will hear it
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.def && runner.npc.def.dialogue === 'priest' && !runner.npc.remote ? [{ text: 'I have something to confess.', next: '_confess' }] : []));
DN._confess = (r) => {
  const s = F.st(), heavy = s && s.guilt > 60;
  F.good('confess', { key: 'confess:' + Math.floor(F.now() / (1440 * 2)) });   // (once every two days counts)
  return { text: heavy ? 'I hear you. Words are a beginning, not an end. Go, and live differently.' : 'I hear you. Go in peace.', choices: [{ text: 'Thank you, Father.', next: null }] };
};
// honest work for others (not the crooked jobs)
if (G.jobs && G.jobs.complete) {
  const _c = G.jobs.complete;
  G.jobs.complete = function (runner, id) {
    const d = this.def(runner.scene.world, id), before = runner.scene.world.quests[id] && runner.scene.world.quests[id].state;
    const r = _c.apply(this, arguments);
    const after = runner.scene.world.quests[id] && runner.scene.world.quests[id].state;
    if (d && before !== 'done' && after === 'done' && !/kill|steal|rob|drug|deal|hit|extort|collect|smuggle/.test(d.type || '') && !d.minors) F.good('job_help', { key: 'job:' + id });
    return r;
  };
}

// ---------------- where luck alone decides (rare; odds only)
// a gun jams now and then for the unlucky
if (G.firearms && G.firearms.playerFire) {
  const FI = G.firearms, _pf = FI.playerFire;
  FI.playerFire = function (p, scene, angle) {
    const m = F.luckMod();
    if (m < -0.3 && p.weaponItem && p.weaponItem.gun && !(p.jamT > 0) && Math.random() < -m * 0.01) { p.jamT = 0.8; p.attackCd = Math.max(p.attackCd || 0, 0.8); G.audio.play('error', { x: p.x, y: p.y }); scene.toast('Your gun jams.', 'bad'); return; }
    return _pf.apply(this, arguments);
  };
  const PL = G.Player.prototype, _pu = PL.update;
  PL.update = function (dt, scene) { if (this.jamT > 0) this.jamT -= dt; return _pu.call(this, dt, scene); };
}
// an hour on the street: once in a long while you find (or lose) a little money
G.events.on('hour', () => {
  const w = W(), scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!w || !scene || !scene.player || scene.player.dead || scene.map.meta.indoor || G.scenes.top() !== scene) return;
  const p = scene.player, luck = G.skills.stat(p, 'luck'), roll = Math.random();
  if (roll < F.findChance(luck)) { const n = G.rng.int(2, 25); p.gold += n; scene.toast(`You spot a crumpled bill on the ground. $${n}.`, 'good'); }
  else if (roll > 1 - F.loseChance(luck) && p.gold > 20) { const n = Math.min(p.gold, G.rng.int(5, 30)); p.gold -= n; scene.toast(`Your pocket feels lighter. $${n} is gone.`, 'bad'); }
});
})();
