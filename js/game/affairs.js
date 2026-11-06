'use strict';
// ---------------- the betrayed spouse, in person ----------------
// A husband or wife who found out does not only text you: when they next see you they come straight at
// you (fighters start a fight if they are jealous enough; others yell, shove you and storm off). When they
// are near the one who cheated, the two of them fight. Very jealous spouses leave for good (a divorce).
(() => {
const L = G.love, _react = L.react, _spouse = L.spouseOf;
L.spouseOf = function (w, id) { const s = _spouse.call(this, w, id); return s && !((w.divorces || {})[id + '|' + s] || (w.divorces || {})[s + '|' + id]) ? s : null; };
const _married = G.romance.married;
G.romance.married = function (w, id) { if (!_married.call(this, w, id)) return false; const rel = (G.NPCS[id] || {}).relations || {}; return Object.keys(rel).some((o) => rel[o] === 'spouse' && !((w.divorces || {})[id + '|' + o] || (w.divorces || {})[o + '|' + id])); };
L.react = function (w, j, lover, isPartner, isTheirSpouse) {
  _react.apply(this, arguments);
  if (!isTheirSpouse) return;
  const st = w.npcs[j];
  st.betrayed = { by: lover, day: w.day, confronted: false };
  G.social.adjust(w, j, lover, -50); G.social.adjust(w, lover, j, -10);
  if (this.jealousy(j) >= 0.75 && G.rng.chance(0.5)) {
    (w.divorces = w.divorces || {})[j + '|' + lover] = w.day;
    w.rumor(`${w.displayName(j)} and ${w.displayName(lover)} are getting a divorce. Apparently someone cheated.`, G.maps.get(G.NPCS[j].map).meta.region);
    w.log(`${w.displayName(j)} is divorcing ${w.displayName(lover)} because of you.`, 'bad');
  }
};
const NP = G.NPC.prototype, _upd = NP.update;
NP.update = function (dt, scene) {
  const st = this.st, b = st.betrayed;
  if (b && !this.dead && !this.talking && this.state === 'schedule' && (this.betrayT = (this.betrayT || 0) - dt) <= 0) {
    this.betrayT = 1;
    const p = scene.player, w = scene.world;
    if (!b.confronted && this.canSee(scene, p, 110)) {
      b.confronted = true;
      const J = L.jealousy(this.id);
      if (this.def.combat !== 'flee' && J >= 0.55) { this.say(G.rng.pick([this.look && this.look.body === 'f' ? 'You slept with my husband. Come here.' : 'YOU. You slept with my wife?!', 'I know what you did!']), 3); this.aggressor = true; this.startFight(p, scene); }
      else {
        this.say(G.rng.pick(['How DARE you show your face around me.', 'You ruined my marriage. I hope you are happy.', 'Stay away from my family!']), 4);
        if (this.distTo(p) < 30) { G.combat.damage(p, 2, this, scene); scene.toast(`${w.displayName(this.id)} shoves you.`, 'bad'); }
        st.fear = Math.max(st.fear || 0, 30); this.goal = scene.map.randomWalkableNear(Math.floor(this.x / 16), Math.floor(this.y / 16), 8);
      }
      w.log(`${w.displayName(this.id)} confronted you about ${w.displayName(b.by)}.`, 'bad');
    }
    const cheat = scene.actors.find((a) => a.id === b.by && !a.dead);
    if (cheat && this.distTo(cheat) < 50 && w.day - b.day < 7 && Math.random() < 0.3) {
      this.say(G.rng.pick(['How could you do this to us?!', 'Do not touch me.', 'Was it worth it?!', 'I trusted you!']), 3);
      cheat.say(G.rng.pick(['It meant nothing, I swear!', 'Please, let me explain...', 'I am sorry. I am so sorry.']), 3);
    }
    if (w.day - b.day > 14) st.betrayed = null;   // time heals (a little)
  }
  return _upd.call(this, dt, scene);
};
})();
