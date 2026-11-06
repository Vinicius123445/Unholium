'use strict';
// Witnesses have to actually report a crime. When someone sees you, it takes them a little while to get
// to a phone (or to a cop); only then do the police know, and only then does the bounty appear. If every
// witness is dead (or the victim was the only one, and they are dead) before that happens, nobody tells
// anyone: no bounty, no rumor. The police seeing it themselves counts immediately.
(() => {
G.WITNESS_DELAY = 25;   // seconds before a civilian's report goes through (tests set 0)

const GS = G.GameScene.prototype, _report = GS.reportCrime, _upd = GS.update, _load = GS.loadMap;
GS.reportCrime = function (type, victim, value = 0, victimId = null) {
  const w = this.world, real = w.commitCrime;
  const witnesses = this.witnessesOf(victim);
  const ids = witnesses.map((a) => a.id);
  if (victim && victim.kind === 'npc' && !victim.dead) ids.push(victim.id);
  const police = witnesses.some((a) => a.def.combat === 'guard') || (victim && victim.def && victim.def.combat === 'guard');
  if (police || G.WITNESS_DELAY <= 0) return _report.call(this, type, victim, value, victimId);
  // run the normal reaction (fleeing, shouting, fighting) but hold the report itself
  let held = null;
  w.commitCrime = (...args) => { held = args; };
  let r;
  try { r = _report.call(this, type, victim, value, victimId); } finally { w.commitCrime = real; }
  if (held && held[2]) {   // witnessed
    (this.pendingReports = this.pendingReports || []).push({ args: held, ids: [...new Set(ids)], t: G.WITNESS_DELAY * G.rng.range(0.7, 1.3) });
    if (!this.reportHintT || this.reportHintT < this.time) { this.toast('Someone saw that. They are going to call the police...', 'warn'); this.reportHintT = this.time + 10; }
  } else if (held) real.apply(w, held);
  return r;
};
GS.flushReports = function (all) {
  const w = this.world;
  for (const rep of this.pendingReports || []) {
    if (!all && rep.t > 0) continue;
    rep.done = true;
    const alive = rep.ids.filter((id) => w.npcs[id] ? w.npcs[id].alive : this.actors.some((a) => a.id === id && !a.dead));
    if (alive.length) {
      w.commitCrime(...rep.args);
      if (!all) this.toast('A witness called the police.', 'bad');
    } else {
      w.stats.crimes++;
      if (!all) this.toast('No witnesses left alive. Nobody will ever know.', 'warn');
    }
  }
  this.pendingReports = (this.pendingReports || []).filter((r) => !r.done);
};
GS.update = function (dt) {
  if (this.pendingReports && this.pendingReports.length) {
    for (const r of this.pendingReports) {
      // a witness who is fleeing or terrified still calls; a dead one does not
      r.t -= dt;
    }
    this.flushReports(false);
  }
  return _upd.call(this, dt);
};
GS.loadMap = function (id, spawnName, pos) {
  if (this.pendingReports && this.pendingReports.length) this.flushReports(true);   // leaving: the living ones report
  return _load.call(this, id, spawnName, pos);
};
})();

// Self-defense is not a crime: whoever lands the first blow on you (or holds you up) started it, whatever
// made them do it, so hitting them back (or killing them in the fight) is not assault or murder.
(() => {
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  if (target && target.kind === 'player' && source && source.kind === 'npc' && !source.dead && !source.assaulted && amount > 0) source.aggressor = true;
  return _dmg.apply(this, arguments);
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.state === 'mug' && !this.assaulted) this.aggressor = true;   // "your wallet, now"
  return _nu.call(this, dt, scene);
};
})();

// Heat cools off: lie low (no witnessed crime there for three days) and a region's bounty shrinks a little
// every day. A known killer stays wanted: that part of the bounty never just goes away.
G.events.on('newDay', () => {
  const w = G.world;
  if (!w || !w.bounty) return;
  for (const r in w.bounty) {
    const b = w.bounty[r] || 0;
    if (b <= 0 || w.day - ((w.lastCrimeDay || {})[r] || 0) < 3) continue;
    const floor = w.knownKiller && w.knownKiller[r] ? Math.min(b, (G.CRIMES.murder && G.CRIMES.murder.bounty) || 200) : 0;
    w.bounty[r] = Math.max(floor, Math.floor(b * 0.85) - 5);
    if (w.bounty[r] === 0) w.log(`The police in ${G.REGIONS[r] ? G.REGIONS[r].name : r} have stopped looking for you.`, 'good');
  }
});
