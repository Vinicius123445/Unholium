'use strict';
// The Strength and Resistance trees in play (js/data/skills.js): a share of every hit shrugged off
// (damageResist), Last Stand when you are nearly done, Hard Head keeps you on your feet, Unbreakable stands
// you back up twice a day. Plus `nonLethal` on anyone: they can be beaten down to 1 health but no further
// (a gang beat-in, a fistfight that is "just business").
(() => {
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  if (target && target.kind === 'player' && amount > 0) {
    let k = 1 - G.util.clamp(G.skills.stat(target, 'damageResist'), 0, 0.6);
    if (G.skills.has(target, 'last_stand') && target.hp < target.maxHp * 0.25) k *= 0.7;
    amount = Math.max(1, Math.round(amount * k));
  }
  const keep = target && target.nonLethal && !target.dead && target.hp > 0;
  const own = keep && Object.prototype.hasOwnProperty.call(target, 'cheatDeath'), prev = keep && target.cheatDeath;
  if (keep) { target.cheatDeath = function () { this.hp = 1; this.invuln = 0.3; return true; }; }
  let r;
  try { r = _dmg.call(this, target, amount, source, scene, o); }
  finally { if (keep) { if (own) target.cheatDeath = prev; else delete target.cheatDeath; } }
  // a hard head: shoved around less
  if (target && target.kind === 'player' && target.kbx != null) { const hh = G.skills.rank(target, 'hard_head'); if (hh) { target.kbx *= 1 - 0.25 * hh; target.kby *= 1 - 0.25 * hh; } }
  return r;
};
// Unbreakable: twice a day a killing blow leaves you on 1 health (after Second Wind has had its turn)
const PL = G.Player.prototype, _cheat = PL.cheatDeath;
PL.cheatDeath = function (scene) {
  if (_cheat.call(this, scene)) return true;
  const s = this.skills, day = scene.world.day;
  if (!G.skills.has(this, 'unbreakable')) return false;
  if (s.unbreakDay !== day) { s.unbreakDay = day; s.unbreakN = 0; }
  if (s.unbreakN >= 2) return false;
  s.unbreakN++;
  this.hp = 1; this.invuln = 1.2;
  scene.toast('Unbreakable. You stay on your feet.', 'good');
  scene.floatText(this.x, this.y - 30, 'UNBREAKABLE', '#ffb060');
  return true;
};
})();
