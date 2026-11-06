'use strict';
// Addiction, for you and for everyone else.
//   Levels (per drug class): Casual (10+), Dependent (25+), Addicted (50+), Severe (75+). Each step makes
//   cravings come sooner and hit harder (charisma, focus), withdrawal last longer, and at Severe your body
//   wears down (less max health). The Stats tab and the HUD show where you are.
//   NPC addicts: who is hooked on what follows how they live — gang members on weed and coke, muggers and
//   thugs on crack and heroin, the homeless on heroin and booze, the rich on coke and pills, some ordinary
//   people on painkillers or drink — plus a new kind of person: drug addicts. When the craving comes they
//   use what they have, go buy from a dealer if they have the money, and if they do not: they beg you,
//   steal, or rob you. In withdrawal they shake, sweat, snap at people.
//   Muggers now mostly demand your money instead of attacking; some are just violent. Gangs ask for "toll"
//   far less often (once in a while, not every night).
(() => {
const LEVELS = [[75, 'Severe'], [50, 'Addicted'], [25, 'Dependent'], [10, 'Casual']];
G.addiction = {
  level(v) { for (let i = 0; i < LEVELS.length; i++) if (v >= LEVELS[i][0]) return 4 - i; return 0; },
  name(v) { const l = this.level(v); return l ? LEVELS[4 - l][1] : 'None'; },
  CLASS_DRUG: { opioid: 'heroin', stimulant: 'crack', cannabis: 'weed', benzo: 'xanax', alcohol: 'beer', nicotine: 'cigarettes' },
  PRICE: { heroin: 55, crack: 25, cocaine: 70, weed: 25, joint: 10, xanax: 12, beer: 4, whiskey: 15, cigarettes: 6, painkillers: 15 },
};
Object.assign(G.EFFECTS, {
  craving: { id: 'craving', name: 'Craving', kind: 'withdrawal', bad: true, color: '#c87a5a', stats: { charisma: -1 }, desc: 'All you can think about is your next fix.' },
});

// ---------------------------------------------------------------- you
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!scene || !G.world) return;
  const p = scene.player, s = G.effects.drugState(p), now = G.effects.now();
  let worst = 0, worstCls = null;
  for (const cls in s.addiction) { const v = s.addiction[cls] || 0; if (v > worst) { worst = v; worstCls = cls; } }
  const lv = G.addiction.level(worst);
  if (!lv || !worstCls) return;
  const since = (now - (s.lastUse[worstCls] || -1e9)) / 60, due = [99, 48, 18, 9, 5][lv];
  // one craving per relapse; while you stay off it, it comes back at most every four days (and it passes,
  // even while you wait or sleep)
  s.crave = s.crave || {};
  const c = s.crave[worstCls] || {}, last = s.lastUse[worstCls] || 0;
  const again = c.for === last && (now - (c.at || 0)) / 60 < 96;
  if (since >= due && !again && !G.effects.has(p, 'craving')) {
    s.crave[worstCls] = { for: last, at: now };
    G.effects.add(p, 'craving', (10 * 60) / (1440 / (G.settings.get('dayLengthMinutes') * 60)), lv * 0.75);   // a craving lasts about ten game hours
    scene.toast([, 'You could go for some ' + G.DRUG_CLASSES[worstCls].name.toLowerCase() + '.', 'You need it. Just a little.', 'You NEED it. Everything hurts without it.', 'You would do anything for a fix right now.'][lv], lv >= 3 ? 'bad' : 'warn');
  }
  // severe addiction wears the body down
  const target = lv >= 4 ? Math.round(p.baseMaxHp * 0.85) : null;
  p.addictionHpPenalty = target ? p.baseMaxHp - target : 0;
  p.refreshStats();
});
// using clears the craving
const _take = G.effects.takeDrug;
G.effects.takeDrug = function (p, it, scene) { _take.call(this, p, it, scene); this.remove(p, 'craving'); };
const PL = G.Player.prototype, _rs = PL.refreshStats;
PL.refreshStats = function () { _rs.call(this); if (this.addictionHpPenalty) { this.maxHp -= this.addictionHpPenalty; this.hp = Math.min(this.hp, this.maxHp); } };
const _hud = G.effects.hudList;
G.effects.hudList = function (p) {
  const out = _hud.call(this, p), s = this.drugState(p);
  for (const cls in s.addiction) { const lv = G.addiction.level(s.addiction[cls] || 0); if (lv >= 2) out.push({ name: `${G.DRUG_CLASSES[cls] ? G.DRUG_CLASSES[cls].name : cls}: ${G.addiction.name(s.addiction[cls])}`, color: ['', '', '#e0b060', '#e07a4a', '#e04a3a'][lv], t: null, bad: lv >= 3 }); }
  return out;
};

// ---------------------------------------------------------------- who is hooked on what
const PROFILES = {
  gang: [['weed', 0.6, [1, 2]], ['crack', 0.2, [1, 3]], ['cocaine', 0.25, [1, 2]]],
  dealer: [['cocaine', 0.4, [1, 2]]],
  mugger: [['crack', 0.5, [2, 4]], ['heroin', 0.35, [2, 4]]],
  addict: [['heroin', 0.55, [3, 4]], ['crack', 0.45, [3, 4]]],
  homeless: [['heroin', 0.35, [2, 4]], ['beer', 0.5, [2, 3]]],
  rich: [['cocaine', 0.25, [1, 2]], ['xanax', 0.2, [1, 3]]],
  worker: [['painkillers', 0.06, [1, 3]], ['beer', 0.08, [1, 2]], ['cigarettes', 0.15, [1, 2]]],
  retiree: [['painkillers', 0.12, [1, 2]]],
};
G.addiction.assign = function (st, life) {
  const list = PROFILES[life] || [];
  if (life === 'addict') { const [drug, , [lo, hi]] = G.rng.pick(list); st.addict = { drug, level: G.rng.int(lo, hi), lastFix: G.effects.now() - G.rng.int(0, 600) }; return; }   // that is what makes them addicts
  for (const [drug, p, [lo, hi]] of list) if (G.ITEMS[drug] && Math.random() < p) { st.addict = { drug, level: G.rng.int(lo, hi), lastFix: G.effects.now() - G.rng.int(0, 600) }; return; }
};
G.addiction.ensure = function (w) {
  if (w.flags.addicts_v1) return;
  w.flags.addicts_v1 = true;
  for (const id in w.npcs) { const d = G.NPCS[id]; if (d && !d.transient && !d.kid) G.addiction.assign(w.npcs[id], d.addictKind || G.lifestyle.of(id)); }
};

// ---------------------------------------------------------------- an addict's day
G.addiction.buy = function (npc, dealer, scene) {
  const st = npc.st, a = st.addict, price = G.addiction.PRICE[a.drug] || 20;
  npc.faceTowards(dealer); dealer.faceTowards(npc); npc.moving = false;
  st.gold -= price; dealer.st.gold = (dealer.st.gold || 0) + price; st.inv = st.inv || []; st.inv.push([a.drug, 1]);
  npc.seek = null; npc.addictT = 2;
  npc.say(G.rng.pick(['Same as always.', 'Hook me up.', 'Come on, come on...']), 2); dealer.say(G.rng.pick(['Here.', 'Cash first.', 'Do not do it all at once.']), 2);
  if (G.drugDeal) G.drugDeal(scene, dealer, npc);   // selling drugs is a crime for everyone (js/game/streetlife.js)
};
G.addiction.update = function (npc, dt, scene) {
  if (npc.badDealerT > 0) npc.badDealerT -= dt;
  const st = npc.st, a = st.addict;
  if (!a || npc.def.kid || npc.state !== 'schedule' || npc.talking) return false;
  const now = G.effects.now(), hours = (now - a.lastFix) / 60, due = [99, 30, 14, 7, 4][a.level];
  npc.withdrawal = hours >= due * 1.5;
  if (hours < due) return false;
  // on shift behind a counter (or guarding a post) the habit waits until they clock out
  if (!npc.seek && (npc.def.shop || npc.def.combat === 'guard') && !npc.def.dealer) { const e = npc.currentEntry(scene.world); if (e && e.act === 'work' && a.level < 4) return false; }
  // on the way to a dealer: keep walking every frame (only re-thinking once a second left them
  // "walking" on the spot in between, twitching in place forever)
  if (npc.seek) {
    const d = npc.seek.to;
    npc.seek.t = (npc.seek.t || 0) + dt;
    if (!d || d.dead || !scene.actors.includes(d) || npc.seek.t > 25 || (npc.giveUpT > 0) || (st.gold || 0) < (G.addiction.PRICE[a.drug] || 20)) { if (d && (npc.seek.t > 25 || npc.giveUpT > 0)) { npc.badDealer = d.id; npc.badDealerT = 120; } npc.addictT = npc.seek.t > 25 ? 20 : 0; npc.seek = null; npc.moving = false; return false; }
    if (npc.distTo(d) < 24) { G.addiction.buy(npc, d, scene); return true; }
    // aim at where the dealer is, refreshed now and then (a goal that changes every tile resets the walk
    // planner each step, and they stood there twitching)
    const dt2 = { x: Math.floor(d.x / 16), y: Math.floor((d.y - 3) / 16) }, sp = npc.seek.pt;
    if (!sp || Math.hypot(npc.x - (sp.x * 16 + 8), npc.y - (sp.y * 16 + 12)) < 20 || ((npc.seek.ptT = (npc.seek.ptT || 0) + dt) > 2.5 && Math.abs(sp.x - dt2.x) + Math.abs(sp.y - dt2.y) > 2)) { npc.seek.pt = dt2; npc.seek.ptT = 0; }
    const ox = npc.x, oy = npc.y;
    npc.walkTo(npc.seek.pt, dt, scene, a.level >= 3);
    // no headway (no path, a locked door, water in the way): give up on that dealer for a good while instead
    // of running on the spot
    const sk = npc.seek; sk.moved = (sk.moved || 0) + Math.hypot(npc.x - ox, npc.y - oy); sk.chk = (sk.chk || 0) + dt;
    if (sk.chk > 3) { const stuck = sk.moved < 10; sk.chk = 0; sk.moved = 0; if (stuck) { (npc.badDealers = npc.badDealers || {})[d.id] = now + 240; npc.addictT = 30; npc.seek = null; npc.moving = false; npc.path = null; return false; } }
    return true;
  }
  if ((npc.addictT = (npc.addictT || 0) - dt) > 0) return false;
  npc.addictT = 1;
  // 1) have it: use it
  const e = (st.inv || []).find((x) => x[0] === a.drug && x[1] > 0);
  if (e) { e[1]--; a.lastFix = now; npc.seek = null; npc.say(G.rng.pick(['Ahh... that is better.', '*sniff* Okay. Okay.', 'Finally.']), 3); return false; }
  const price = G.addiction.PRICE[a.drug] || 20, p = scene.player;
  // 2) money and a dealer around: go buy
  const dealer = scene.actors.find((x) => x.kind === 'npc' && !x.dead && x.def.dealer && x !== npc && !(npc.badDealer === x.id && npc.badDealerT > 0) && !((npc.badDealers || {})[x.id] > now));   // not the one they could not get to
  if ((st.gold || 0) >= price && dealer) {
    npc.seek = { to: dealer, t: 0 };
    return true;
  }
  // a shop sells it (beer, cigarettes, painkillers): they buy it there (off screen, if they have money)
  if ((st.gold || 0) >= price && ['beer', 'cigarettes', 'painkillers', 'whiskey'].includes(a.drug)) { st.gold -= price; st.inv = st.inv || []; st.inv.push([a.drug, 1]); return false; }
  // 3) no money: beg, then (if desperate and the type) rob
  if (!p.dead && npc.distTo(p) < 140 && npc.canSee(scene, p, 140) && a.level >= 2 && (npc.begT || 0) < now) {
    npc.begT = now + 90;
    const life = npc.def.mugger ? 'mugger' : G.lifestyle.of(npc.id);
    if ((life === 'mugger' || life === 'gang' || (a.level >= 4 && npc.def.combat !== 'flee')) && Math.random() < 0.5) { npc.state = 'mug'; npc.mugDone = false; npc.say('Hey. You. Wallet. Now.', 3); return true; }
    npc.begging = true;
    npc.say(G.rng.pick(['Hey... you got a few bucks? I am sick, man.', 'Please. Just five dollars. I will pay you back.', 'Spare some change? I just need to get well.']), 4);
  }
  return false;
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.st.addict && !this.dead) {
    if (this.withdrawal) { if (!this.wdSlow) { this.wdSlow = true; this.walkSpeed *= 0.85; } if (!this.bark && Math.random() < dt / 30) this.say(G.rng.pick(['*shivering*', 'So cold...', 'Everything hurts.', 'I need it...']), 3); }
    else if (this.wdSlow) { this.wdSlow = false; this.walkSpeed /= 0.85; }
    if (G.addiction.update(this, dt, scene)) { this.baseUpdate(dt, scene.map); return; }
  }
  return _nu.call(this, dt, scene);
};
// talking to an addict
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, a = npc.st.addict, p = runner.scene.player;
  if (!a || npc.def.kid) return [];
  const out = [];
  if (npc.begging || npc.withdrawal) out.push({ text: 'You look rough. Are you okay?', next: '_addict_talk' });
  if (p.gold >= 5 && (npc.begging || npc.withdrawal)) out.push({ text: 'Here, take $10.', next: '_addict_give' });
  const known = npc.st.addictKnown || npc.withdrawal || npc.begging;   // only once you know (they told you, or it shows)
  if (known && p.inventory.has(a.drug)) out.push({ text: `I have some ${G.item(a.drug).name.toLowerCase()}. Want it?`, next: '_addict_sell' });
  if (known && a.level >= 2) out.push({ text: 'You should get help. Seriously.', next: '_addict_help' });
  return out;
});
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_NODES._addict_talk = (r) => { const a = r.npc.st.addict; r.npc.st.addictKnown = true; return { text: a.level >= 3 ? `No. I am not. It is the ${G.item(a.drug).name.toLowerCase()}. I cannot stop. I have tried.` : 'I am fine. Just... need something to take the edge off.', choices: BACK }; };
G.DIALOGUE_NODES._addict_give = (r) => { r.scene.player.gold -= 10; r.npc.st.gold = (r.npc.st.gold || 0) + 10; G.social.addDisp(r.scene.world, r.npc.id, 10); r.npc.begging = false; return { text: G.rng.pick(['God bless you. Really.', 'You are a lifesaver. Literally.']), choices: BACK }; };
G.DIALOGUE_NODES._addict_sell = (r) => {
  const a = r.npc.st.addict, price = Math.round((G.addiction.PRICE[a.drug] || 20) * (a.level >= 3 ? 1.4 : 1.1)), st = r.npc.st;
  if ((st.gold || 0) < price) return { text: `I... I only have $${st.gold || 0}. Please. Anything.`, choices: [{ text: `Fine. Give me what you have.`, next: null, do: () => { r.scene.player.inventory.remove(a.drug, 1); r.scene.player.gold += st.gold || 0; st.gold = 0; a.lastFix = G.effects.now(); } }, { text: 'No money, no deal.', next: 'start' }] };
  r.scene.player.inventory.remove(a.drug, 1); r.scene.player.gold += price; st.gold -= price; a.lastFix = G.effects.now();
  const cop = r.scene.actors.find((x) => x.kind === 'npc' && !x.dead && x.def.combat === 'guard' && x.canSee(r.scene, r.scene.player, 110));
  if (cop) r.scene.reportCrime('drugs', cop);
  return { text: `$${price}. Yeah. Thank you. Thank you.`, choices: BACK };
};
G.DIALOGUE_NODES._addict_help = (r) => {
  const a = r.npc.st.addict, P = G.social.persona(r.npc.id), ok = (r.npc.st.disp || 0) > 30 && Math.random() < (P.trait === 'nervous' || P.trait === 'friendly' ? 0.4 : 0.2);
  if (ok) { a.level = Math.max(0, a.level - 1); if (!a.level) r.npc.st.addict = null; G.social.addDisp(r.scene.world, r.npc.id, 8); return { text: 'You know what? You are right. I am going to try. For real this time.', choices: BACK }; }
  return { text: G.rng.pick(['Help? Who is going to help me?', 'Mind your own business.', 'I know. I know. Just... not today.']), choices: BACK };
};

// ---------------------------------------------------------------- muggers rob instead of killing; gangs toll less
G.FACTIONS.criminals.hostileBelow = -60;   // criminals stop attacking on sight; they want your money
const _wants = NP.wantsToMug;
NP.wantsToMug = function (scene) {
  if (this.def.mugger || this.def.addictKind) return _wants.call(this, scene);
  // gangs: a toll only now and then (one gang asks you once a night at most, most nights not at all)
  if (!_wants.call(this, scene)) return false;
  // any gang: at most once every five days, and only on some of those nights
  const w = scene.world;
  if (w.day - (w.flags.lastToll == null ? -99 : w.flags.lastToll) < 5) return false;
  if (G.util.hashString('toll' + w.day) % 100 >= 30) return false;
  w.flags.lastToll = w.day;
  return true;
};
G.NIGHT_SPAWNS.addict = { name: 'Drug Addict', faction: 'criminals', hp: 25, combat: 'flee', addictKind: 'addict', gold: [0, 4], look: (s) => G.look(s, { top: 'hoodie', shirt: '#4a4440', pants: '#3a3630', hair: '#5a4a3a', facial: 3 }) };
const GS = G.GameScene.prototype, _spawn = GS.spawnTransient, _load = GS.loadMap;
GS.spawnTransient = function (kind, z) {
  const npc = _spawn.call(this, kind, z);
  if (!npc) return npc;
  if (npc.def.mugger || kind === 'addict') {
    G.addiction.assign(npc.st, kind === 'addict' ? 'addict' : 'mugger');
    if (npc.st.addict) npc.st.addict.lastFix = G.effects.now() - 60 * 12;   // out on the street because they need it
    if (npc.def.mugger && Math.random() < 0.25) npc.st.hostile = true;    // some are just violent
  }
  if (kind === 'addict') npc.def.addictKind = 'addict';
  return npc;
};
GS.loadMap = function (id, spawnName, pos) { _load.call(this, id, spawnName, pos); G.addiction.ensure(this.world); };
// addicts show up at night in the rough parts of town
for (const id of ['city', 'southside', 'eastside']) {
  const gen = G.MAPGEN[id];
  G.MAPGEN[id] = () => { const m = gen(); for (const z of m.dangerZones || []) z.spawns = Object.assign({ addict: 1 }, z.spawns); return m; };
}
})();
