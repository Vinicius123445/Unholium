'use strict';
// The loan shark: Vince, a real man with a real roll of cash. He lends what he has, to you and to anyone desperate
// enough, at rates that hurt, and he remembers. All of it lives in w.loans, one record per borrower, and every dollar
// moves between real pockets (his st.gold is his capital, interest is his income).
//   You: ask, name an amount, hear his terms, take them, walk away or haggle (how you ask matters as much as how well
//   you talk, and he never tells you why). Past the deadline he comes for you: on foot, through the map's own way in,
//   anywhere but the woods. Then pay, pay some, beg, bargain, refuse or threaten him. Refuse and he and his boys hurt you;
//   push it (a lot owed, broken promises, threats) and they are there to kill. He goes back to his corner afterwards.
//   Borrowers: broke people borrow, pay back when they can, and get a visit when they cannot.
(() => {
const F = G.finance, GS = G.GameScene.prototype, NP = G.NPC.prototype, pick = (a) => G.rng.pick(a), clamp = G.util.clamp;
const nowM = (w) => w.day * 1440 + w.minutes;
const ID = 'c_shark';
G.NPCS[ID] = { id: ID, name: 'Vince', map: 'southside', faction: 'civilians', hp: 110, combat: 'fight', weapon: 'brass_knuckles', gold: 15000, home: null, relations: {}, dialogue: 'loanshark', ageGroup: 'middle', job: 'I help people out. For a while.', look: G.look('c_shark', { body: 'm', top: 'jacket', shirt: '#2a1e1e', shirt2: '#c8a040', bottom: 'pants', pants: '#1e1a1a', hat: 'cap', hatColor: '#1e1a1a', facial: 3, hair: '#2a1e18' }), schedule: [{ from: 10, to: 23, at: 'shark_corner', act: 'wander' }, { from: 23, to: 24, at: 'shark_corner', act: 'idle' }, { from: 0, to: 10, at: 'shark_corner', act: 'idle' }] };
const _sth = G.MAPGEN.southside;
if (_sth) G.MAPGEN.southside = () => { const m = _sth(); if (!m.points.shark_corner) { const pt = m.points.from_city || { x: 22, y: 36 }; m.points.shark_corner = { x: pt.x + 6, y: pt.y }; } return m; };
const shark = (w) => w.npcs[ID];
const S = G.loanShark = {
  ID,
  list(w) { return (w.loans = w.loans || []); },
  of(w, who) { return this.list(w).find((l) => l.who === who && l.status !== 'paid' && l.status !== 'dead'); },
  days(n) { return n <= 300 ? 4 : n <= 1500 ? 7 : n <= 5000 ? 11 : 14; },
  // his first offer: never shown as a sum, always high
  offer(w, n) { const st = shark(w), bad = this.list(w).filter((l) => l.who === 'player' && l.late).length; let rate = 45 + Math.min(20, n / 300) + bad * 10 - (st.disp || 0) / 6; return clamp(Math.round(rate), 25, 90); },
  lend(w, who, pocket, n, rate, days) {
    const st = shark(w), given = Math.min(n, st.gold); if (given <= 0) return null;
    st.gold -= given; pocket.gold = (pocket.gold || 0) + given;
    const rec = { who, principal: given, rate, owed: Math.round(given * (1 + rate / 100)), paid: 0, due: w.day + days, status: 'open', strikes: 0, late: false };
    this.list(w).push(rec);
    return rec;
  },
  repay(w, rec, pocket, n) {
    const left = rec.owed - rec.paid, a = Math.min(Math.floor(n), left, Math.floor(pocket.gold || 0)); if (a <= 0) return 0;
    pocket.gold -= a; shark(w).gold += a; rec.paid += a;
    if (rec.paid >= rec.owed) rec.status = 'paid';
    return a;
  },
  left(rec) { return rec.owed - rec.paid; },
  overdue(w, rec) { return rec.status === 'open' || rec.status === 'overdue' ? w.day > rec.due : false; },
  safeHere(scene) { const id = scene.map.id; return /^wilds|^forest/.test(id) || id === 'jail' || id === 'island' || !!scene.map.meta.dream || !!scene.map.meta.wild; },
};

// ---------------------------------------------------------------- asking
const moods = ['Respectfully, that rate is steep. Can we do better?', 'I have other offers. Lower it.', 'Please. I really need this. I am desperate.', 'Lower the rate or I will make you regret it.'];
G.DIALOGUES.loanshark = {
  start: {
    text: (c) => { const rec = S.of(c.w, 'player'); if (rec) return `You owe me $${S.left(rec)}. Day ${rec.due}. I do not forget numbers.`; return pick(['You look like you need a friend. I am expensive.', 'Talk. I have got people waiting.', 'Everyone needs money. Not everyone pays it back. Most do. Once.']); },
    choices: [
      { text: 'I need to borrow some money.', if: (c) => !S.of(c.w, 'player'), next: 'amount' },
      { text: (c) => `Here is what I owe you. ($${S.left(S.of(c.w, 'player'))})`, if: (c) => S.of(c.w, 'player') && c.gold() >= S.left(S.of(c.w, 'player')), do: (c) => { const rec = S.of(c.w, 'player'); S.repay(c.w, rec, c.p, S.left(rec)); G.audio.play('coin'); G.social.addDisp(c.w, ID, 4); c.npc.say('Pleasure. See how easy that was?', 3); return null; } },
      { text: 'Here is some of it. ($100)', if: (c) => S.of(c.w, 'player') && c.gold() >= 100, do: (c) => { S.repay(c.w, S.of(c.w, 'player'), c.p, 100); G.audio.play('coin'); return 'start'; } },
      { text: 'Goodbye.', next: null },
    ],
  },
  amount: {
    text: () => 'How much?',
    choices: [100, 500, 1500, 5000].map((n) => ({ text: `$${n}.`, if: (c) => c.st.gold >= n, do: (c) => { c.w.flags.sharkAsk = { n, rate: S.offer(c.w, n), tries: 0, days: S.days(n) }; return (c.st.disp || 0) <= -30 ? 'refuse' : 'terms'; } })).concat([{ text: 'Never mind.', next: 'start' }]),
  },
  refuse: { text: () => pick(['Not to you. Get off my street.', 'You? I do not lend to people like you.']), choices: [{ text: 'Goodbye.', next: null }] },
  terms: {
    text: (c) => { const a = c.w.flags.sharkAsk; return `$${a.n}, you pay back $${Math.round(a.n * (1 + a.rate / 100))}. ${a.rate}%. You have ${a.days} days: day ${c.w.day + a.days}. Late, and I come find you.`; },
    choices: [
      { text: 'Deal.', do: (c) => { const a = c.w.flags.sharkAsk; S.lend(c.w, 'player', c.p, a.n, a.rate, a.days); G.audio.play('coin'); c.scene.toast(`+$${a.n}`, 'good'); c.w.log(`You borrowed $${a.n} from Vince. Due day ${c.w.day + a.days}.`, 'warn'); c.npc.say('Do not make me walk.', 3); return null; } },
      { text: moods[0], if: (c) => c.w.flags.sharkAsk.tries < 3, do: (c) => haggle(c, 0) },
      { text: moods[1], if: (c) => c.w.flags.sharkAsk.tries < 3, do: (c) => haggle(c, 1) },
      { text: moods[2], if: (c) => c.w.flags.sharkAsk.tries < 3, do: (c) => haggle(c, 2) },
      { text: moods[3], if: (c) => c.w.flags.sharkAsk.tries < 3, do: (c) => haggle(c, 3) },
      { text: 'Forget it.', next: null },
    ],
  },
  lines: { text: (c) => c.w.flags.sharkSaid || '...', choices: [{ text: 'Go on.', next: 'terms' }] },
};
const haggle = (c, how) => {
  const a = c.w.flags.sharkAsk, P = G.social.persona(ID), base = [-1, 0, -3, 2][how], used = (a.used = a.used || {});
  a.tries++;
  const again = used[how]; used[how] = 1;
  const won = !again && how !== 3 && G.skills.roll(c.p, 9 + base - Math.round((c.st.disp || 0) / 25), 'charisma');
  if (how === 3) { G.social.addDisp(c.w, ID, -8); a.rate = Math.min(95, a.rate + 8); c.w.flags.sharkSaid = pick(['You threaten me? On my street? The price just went up.', 'Cute. Eight more, for the laugh.']); return 'lines'; }
  if (won) { a.rate = Math.max(20, a.rate - (how === 2 ? 3 : how === 0 ? 7 : 5) - Math.floor(Math.random() * 4)); if (how === 0) G.social.addDisp(c.w, ID, 1); c.w.flags.sharkSaid = pick(['You have manners. A little off, then.', 'Hm. You talk well. I like that. Not much, but I do.', 'Fine. I am feeling generous. It will pass.']); }
  else { if (how === 2 && P.empathy < 50) a.rate += 2; c.w.flags.sharkSaid = pick(['No.', 'That is not how this works.', 'You want cheap, go to a bank. Oh, wait.']); }
  return 'lines';
};

// ---------------------------------------------------------------- past the deadline
G.DIALOGUES._debt = {
  start: {
    text: (c) => { const rec = S.of(c.w, 'player'), n = rec ? S.left(rec) : 0; return rec && rec.strikes ? `I came all this way twice now. $${n}. Today.` : pick([`Day ${rec ? rec.due : 0} came and went. You owe me $${n}. Now.`, `$${n}. You had your days. I had to walk here.`]); },
    choices: [
      { text: (c) => `Here. All of it. ($${S.left(S.of(c.w, 'player'))})`, if: (c) => c.gold() >= S.left(S.of(c.w, 'player')), do: (c) => { const rec = S.of(c.w, 'player'); S.repay(c.w, rec, c.p, S.left(rec)); G.audio.play('coin'); G.social.addDisp(c.w, ID, 2); c.npc.say('Good. We are done. For now.', 3); S.home(c.scene); return null; } },
      { text: 'Take what I have on me.', if: (c) => c.gold() >= Math.ceil(S.left(S.of(c.w, 'player')) * 0.25), do: (c) => { const rec = S.of(c.w, 'player'); S.repay(c.w, rec, c.p, c.gold()); if (rec.status === 'paid') { S.home(c.scene); return null; } rec.due = c.w.day + 2; c.npc.say('Two days for the rest. Do not make me come back.', 3); S.home(c.scene); return null; } },
      { text: (c) => `${c.tag(9)} I need more time. Give me a few days.`, do: (c) => { const rec = S.of(c.w, 'player'); if ((rec.extended || 0) < 2 && c.check('shark_time', 9 + rec.strikes * 2)) { rec.extended = (rec.extended || 0) + 1; rec.due = c.w.day + 3; c.npc.say('Three days. That is the last favor you get.', 3); S.home(c.scene); return null; } c.npc.say('No.', 2); return S.escalate(c, 1); } },
      { text: 'I am not paying you.', do: (c) => S.escalate(c, 2) },
      { text: 'Come near me again and I will kill you.', do: (c) => S.escalate(c, 4) },
    ],
  },
};
Object.assign(S, {
  actor(scene) { return scene.actors.find((a) => a.id === ID && !a.dead); },
  home(scene) { const a = this.actor(scene), st = scene.world.npcs[ID]; st.hunting = null; st.order = null; if (a) { a.st.hostile = false; a.aggressor = false; a.nonLethal = false; if (a.state === 'fight') a.endFight(); } st.map = G.NPCS[ID].map; for (const b of scene.actors) if (b.sharkBoy) b.gone = true; scene.actors = scene.actors.filter((b) => !b.gone); },
  // how bad it gets depends on the sum, his temper, what you have done
  escalate(c, heat) {
    const rec = S.of(c.w, 'player'), P = G.social.persona(ID), total = heat + rec.strikes + (S.left(rec) >= 2000 ? 1 : 0) + (P.temper >= 65 ? 1 : 0), kill = total >= 4;
    rec.strikes++; rec.status = 'overdue'; rec.due = c.w.day + 3; rec.late = true;
    G.mem.add(c.w, ID, { k: 'debt', t: `The player refused to pay me $${S.left(rec)}`, by: 'player', s: 'did', f: -3, i: 5 });
    G.social.addDisp(c.w, ID, -10);
    const a = c.npc, sc = c.scene;
    a.say(kill ? pick(['You are finished.', 'I will collect from your family.']) : pick(['You need a lesson.', 'Hold still.']), 3);
    G.overhear.later((s) => {
      a.nonLethal = !kill; a.aggressor = true; a.st.hostile = true; a.startFight(s.player, s);
      if (G.law && G.law.spawn) for (let k = 0; k < (kill ? 2 : 1); k++) { const b = G.law.spawn(s, { name: 'Thug', look: { top: 'jacket', shirt: '#1e1e22', bottom: 'pants', pants: '#1e1e22' }, combat: 'fight', role: 'thug', hp: 60, weapon: kill ? 'baseball_bat' : null }, a.x + (k ? 14 : -14), a.y + 4); b.def.faction = 'criminals'; b.sharkBoy = true; b.nonLethal = !kill; b.st.hostile = true; b.aggressor = true; b.startFight(s.player, s); }
      s._sharkBeat = kill ? null : { until: G.loop.time + 25 };
    }, a);
    void sc;
    return null;
  },
  // he comes for you: as soon as you are somewhere he can reach, he walks in through the map's way in
  hunt(scene) {
    const w = scene.world, rec = this.of(w, 'player'), st = shark(w);
    if (!rec || !this.overdue(w, rec) || !st || !st.alive || st.jailedUntil > w.day) return;
    if (this.safeHere(scene) || scene.map.meta.indoor && false) { st.hunting = null; return; }
    rec.status = 'overdue'; rec.late = true;
    if (this.actor(scene) && st.hunting === scene.map.id) return;
    const at = this.gate(scene); if (!at) return;
    st.hunting = scene.map.id; st.map = scene.map.id;
    const a = new G.NPC(ID, st); a.x = at.x; a.y = at.y; scene.actors = scene.actors.filter((x) => x.id !== ID); scene.actors.push(a);
    a.sharkHunt = true;
  },
  // an actual way into this map, out of sight
  gate(scene) { const m = scene.map; for (const e of m.exits || []) { const x = e.x * 16 + 8, y = e.y * 16 + 8; if (!G.spawnRule.visible(scene, x, y)) return { x, y }; } return G.spawnRule.away(scene, scene.player.x, scene.player.y); },
  tick(scene, dt) {
    const a = this.actor(scene), w = scene.world;
    if (a && a.sharkHunt && a.state === 'schedule' && !a.talking) {
      const p = scene.player;
      if (this.safeHere(scene)) { this.home(scene); return; }
      if (a.distTo(p) < 28) { if (G.scenes.top() === scene && !p.dead) { a.sharkHunt = false; a.moving = false; a.say('There you are.', 2); G.demand.open(scene, a, '_debt'); } }
      else a.walkTo({ x: Math.floor(p.x / 16), y: Math.floor((p.y - 3) / 16) }, dt, scene, a.distTo(p) > 90);
    }
    // a beating ends when they have made their point
    if (scene._sharkBeat && a) { const p = scene.player; if (p.hp < p.maxHp * 0.3 || G.loop.time > scene._sharkBeat.until) { scene._sharkBeat = null; a.say(pick(['That is the interest.', 'Three days. Then I come back.']), 3.5); for (const b of scene.actors) if (b === a || b.sharkBoy) { b.st.hostile = false; b.aggressor = false; if (b.state === 'fight') b.endFight(); } S.home(scene); } }
    void w;
  },
  // once a day: who borrows, who pays, who gets a visit
  daily(w) {
    const st = shark(w); if (!st || !st.alive) return;
    const rng = new G.RNG('shark' + w.day), ids = Object.keys(w.npcs).filter((id) => id !== ID && G.NPCS[id] && !G.NPCS[id].kid && w.isAlive(id) && !S.of(w, id));
    const broke = ids.filter((id) => (w.npcs[id].gold || 0) < 40 && (w.npcs[id].bank || 0) < 40 && G.social.persona(id).courage >= 25);
    for (const id of broke.slice(0, 40)) if (rng.chance(0.08) && st.gold > 500) { const n = rng.pick([100, 200, 400]), P = G.social.persona(id); this.lend(w, id, w.npcs[id], n, clamp(55 - (P.wits - 50) / 3, 30, 75), this.days(n)); }
    for (const rec of this.list(w)) {
      if (rec.who === 'player' || rec.status === 'paid' || rec.status === 'dead') continue;
      const s = w.npcs[rec.who]; if (!s || !s.alive) { rec.status = 'dead'; continue; }
      const P = G.social.persona(rec.who);
      if (w.day >= rec.due - 1 && (s.gold || 0) + (s.bank || 0) > 0) { if ((s.gold || 0) < this.left(rec) && (s.bank || 0) > 0) F.withdraw(w, s, this.left(rec)); this.repay(w, rec, s, s.gold * (P.honesty >= 40 ? 0.8 : 0.4)); }
      if (rec.status === 'paid') continue;
      if (w.day > rec.due) {   // the visit: whatever the map, it happens
        rec.status = 'overdue'; rec.strikes++; rec.late = true; rec.due = w.day + 3;
        const brave = P.courage + P.temper / 2;
        if (brave >= 95 && rng.chance(0.4)) { G.mem.add(w, rec.who, { k: 'debt', t: 'I stood up to Vince over my debt', by: ID, s: 'did', f: -1, i: 4 }); continue; }
        const hurt = rec.strikes >= 3 ? 0.75 : 0.4;
        s.hp = Math.max(4, Math.round((s.hp || 30) * (1 - hurt)));
        G.mem.add(w, rec.who, { k: 'debt', t: rec.strikes >= 3 ? 'Vince nearly killed me over what I owe him' : 'Vince beat me over what I owe him', by: ID, s: 'did', f: -3, i: 5 });
        if (rng.chance(0.4)) w.rumor(`${w.displayName(rec.who)} got a visit from Vince. Word is it was not friendly.`, null);
      }
    }
  },
});
// when he finds a borrower on your screen, you see it happen
const _hour = () => {
  const sc = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene), w = G.world; if (!sc || !w) return;
  try {
    S.hunt(sc);
    const a = S.actor(sc); if (!a || a.sharkHunt) return;
    const rec = S.list(w).find((l) => l.who !== 'player' && l.status === 'overdue' && sc.actors.some((o) => o.id === l.who && !o.dead));
    if (rec) { const t = sc.actors.find((o) => o.id === rec.who); a.st.order = { t: 'come', map: sc.map.id, until: nowM(w) + 40, who: rec.who }; a.say(`${w.displayName(rec.who)}. You and me need to talk.`, 3); t.say(pick(['Please, I just need more time!', 'Not here...', 'I have got some of it, I swear!']), 3); }
  } catch (e) { G.reportError && G.reportError(e); }
};
G.events.on('hour', _hour);
G.events.on('newDay', () => { if (G.world) try { S.daily(G.world); } catch (e) { G.reportError && G.reportError(e); } });
const _u = GS.update;
GS.update = function (dt) { const r = _u.call(this, dt); if (this.actors) try { S.tick(this, dt); } catch (e) { G.reportError && G.reportError(e); } return r; };
void NP;
})();
