'use strict';
// Skills & progression: XP, levels, skill points, derived stats and speech checks.
// Player state lives in player.skills = { level, xp, points, ranks: { skillId: rank }, secondWindDay }.

G.skills = {
  fresh() { return { level: 1, xp: 0, points: 1, ranks: {}, secondWindDay: 0 }; },

  rank(p, id) { return (p && p.skills && p.skills.ranks[id]) || 0; },
  has(p, id) { return this.rank(p, id) > 0; },

  // A stat = base + skill bonuses + active effects / intoxication.
  stat(p, name) {
    let v = G.BASE_STATS[name] || 0;
    const ranks = p.skills.ranks;
    for (const id in ranks) {
      const fx = G.SKILLS[id] && G.SKILLS[id].fx;
      if (fx && fx[name]) v += fx[name] * ranks[id];
    }
    const t = p.equip && p.equip.trinket && G.item(p.equip.trinket);   // gold chain, designer watch...
    if (t && t.stats && t.stats[name]) v += t.stats[name];
    return v + G.effects.statBonus(p, name) + (G.needs ? G.needs.statBonus(p, name) : 0) + (G.love && p.kind === 'player' ? G.love.statBonus(p, name) : 0);
  },

  charisma(p) { return Math.max(0, Math.round(this.stat(p, 'charisma'))); },

  // Intimidation: half your charisma, intimidation skill, booze/drugs, plus whatever you are holding.
  intimidation(p) {
    const w = p.weaponItem;
    return Math.max(0, Math.round(2 + this.charisma(p) / 2 + this.stat(p, 'intimidate') + (w ? (w.gun ? 3 : 1) : 0)));
  },

  score(p, stat) { return stat === 'intimidate' ? this.intimidation(p) : this.charisma(p); },

  // Chance (0..1) to pass a check of the given difficulty (roughly 2 = trivial .. 12 = near impossible).
  chance(p, difficulty, stat = 'charisma') {
    return G.util.clamp(0.5 + (this.score(p, stat) - difficulty) * 0.1, 0.05, 0.95);
  },

  // Roll a check. Success gives XP scaled by difficulty.
  roll(p, difficulty, stat = 'charisma') {
    const ok = G.rng.chance(this.chance(p, difficulty, stat));
    if (ok) G.events.emit('xp', Math.round(G.util.lerp(G.XP.speechEasy, G.XP.speechHard, G.util.clamp((difficulty - 3) / 7, 0, 1))), 'Persuasion');
    G.audio.play(ok ? 'confirm' : 'error');
    return ok;
  },

  // Why a skill cannot be learned right now (or null if it can).
  blocker(p, id) {
    const s = G.SKILLS[id], r = this.rank(p, id);
    if (r >= s.ranks) return 'Maxed out.';
    if (id === 'swimming' && r === 0) return 'Take lessons from the Swim Instructor at the lake (Rural Zone).';
    for (const [rid, n] of s.req || []) if (this.rank(p, rid) < n) return `Requires ${G.SKILLS[rid].name}${G.SKILLS[rid].ranks > 1 ? ' ' + n : ''}.`;
    if (p.skills.points <= 0) return 'No skill points. Level up to earn more.';
    return null;
  },

  learn(p, id) {
    if (this.blocker(p, id)) return false;
    p.skills.ranks[id] = this.rank(p, id) + 1;
    p.skills.points--;
    p.refreshStats();
    return true;
  },

  addXp(p, n, reason, scene) {
    const s = p.skills;
    if (n <= 0 || s.level >= G.MAX_LEVEL) return;
    s.xp += n;
    if (scene) scene.floatText(p.x, p.y - 26, `+${n} XP`, '#a0c8ff');
    while (s.level < G.MAX_LEVEL && s.xp >= G.xpToNext(s.level)) {
      s.xp -= G.xpToNext(s.level);
      s.level++;
      s.points++;
      if (scene) {
        G.audio.play('quest');
        scene.toast(`Level ${s.level}! You have ${G.util.plural(s.points, 'skill point')}.`, 'quest');
        scene.floatText(p.x, p.y - 34, 'LEVEL UP', '#ffd86a');
        G.world.log(`Reached level ${s.level}.`, 'good');
      }
    }
  },
};
