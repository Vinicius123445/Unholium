'use strict';
// Melee combat: arc hit detection, damage, knockback, feedback. Guns are in firearms.js.

G.combat = {
  // Swing in the attacker's facing direction. Hits every valid target inside the arc.
  attack(attacker, scene) {
    const range = attacker.weaponRange();
    const [fx, fy] = G.util.DIR_VEC[attacker.dir];
    attacker.attackTimer = 0.22;
    attacker.attackCd = attacker.cooldown();
    G.audio.play('swing');
    let hit = 0;
    for (const t of scene.actors) {
      if (t === attacker || t.dead || !attacker.canHit(t)) continue;
      const dx = t.x - attacker.x, dy = t.cy - attacker.cy;
      const d = Math.hypot(dx, dy);
      if (d > range + t.radius) continue;
      if (d > 6 && (dx * fx + dy * fy) / d < 0.25) continue;
      this.damage(t, attacker.damage(t), attacker, scene);
      hit++;
    }
    return hit;
  },

  // o.bullet: armor with bulletDef (kevlar) protects more against it
  damage(target, amount, source, scene, o = {}) {
    if (target.dead || target.invuln > 0) return 0;
    let def = target.defense ? target.defense() : 0;
    if (o.bullet && target.bulletDefense) def += target.bulletDefense();
    let dmg = Math.round(amount * (0.85 + Math.random() * 0.3)) - def;
    if (target.damageTakenMult) dmg = Math.round(dmg * target.damageTakenMult());
    if (target.kind === 'player') dmg = Math.round(dmg * [0.6, 1, 1.4][G.settings.get('difficulty')]);
    dmg = Math.max(1, dmg);
    target.hp -= dmg;
    target.hurtTimer = 0.25;
    target.invuln = target.kind === 'player' ? (o.bullet ? 0.12 : 0.45) : o.bullet ? 0.02 : 0.15;
    if (source) {
      const dx = target.x - source.x, dy = target.y - source.y, d = Math.hypot(dx, dy) || 1;
      let kb = target.kind === 'animal' && target.def.hp > 80 ? 40 : 120;
      if (o.bullet) kb = 45;
      else if (source.knockbackMult) kb *= source.knockbackMult();
      target.kbx = (dx / d) * kb;
      target.kby = (dy / d) * kb;
    }
    const isPlayer = target.kind === 'player';
    scene.floatText(target.x, target.y - 18, '-' + dmg, isPlayer ? '#ff6050' : '#ffffff');
    scene.particles(target.x, target.y - 8, isPlayer || target.human ? '#a02020' : '#8a2020', o.bullet ? 9 : 6);
    G.audio.play(isPlayer ? 'hurt' : 'hit', { x: target.x, y: target.y });
    if (isPlayer || source === scene.player) G.renderer.shake(isPlayer ? 5 : 2);
    G.gore.onHit(scene, target, source, dmg, o.bullet);
    if (target.onHurt) target.onHurt(source, dmg, scene);
    if (target.hp <= 0 && !target.dead) {
      if (target.cheatDeath && target.cheatDeath(scene)) return dmg;
      target.hp = 0;
      G.gore.onDeath(scene, target, source);
      target.die(source, scene);
    }
    return dmg;
  },
};
