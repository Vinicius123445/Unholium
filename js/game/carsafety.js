'use strict';
// Drivers watch the sidewalk, not only the lane: they see where people are walking (their speed and
// heading), and if someone will be in front of the car within the distance it needs to stop, they brake
// hard before it is too late. A car that has slowed right down only nudges a person aside.
(() => {
const GS = G.GameScene.prototype, _gu = GS.update, V = G.vehicles, _ai = V.updateAI;
const BRAKE = 420;   // px/s² of hard braking
const DIRS = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };

// everyone's walking velocity, from their last position
GS.update = function (dt) {
  if (dt > 0) for (const a of this.actors) {
    if (a._lx != null) { a._vx = (a.x - a._lx) / dt; a._vy = (a.y - a._ly) / dt; }
    a._lx = a.x; a._ly = a.y;
  }
  return _gu.call(this, dt);
};

// is anyone going to be in front of this car before it could stop?
V.conflict = function (v, scene) {
  const ai = v.ai, d = DIRS[ai.dir];
  if (!d) return null;
  const [dx, dy] = d, stop = (v.speed * v.speed) / (2 * BRAKE) + v.L + 16;
  for (const a of scene.actors) {
    if (a.dead || (a.kind !== 'npc' && a.kind !== 'animal' && a.kind !== 'player')) continue;
    if (a.kind === 'player' && a.vehicle) continue;
    for (const t of [0, 0.35, 0.7]) {   // now, and where they are heading
      const px = a.x + (a._vx || 0) * t, py = a.y + (a._vy || 0) * t;
      const rx = px - v.x, ry = py - v.y, ahead = rx * dx + ry * dy, side = Math.abs(rx * -dy + ry * dx);
      const carAt = v.speed * t;   // the car moves too
      if (ahead > carAt - 4 && ahead < stop + carAt * 0.3 && side < v.Wd + 9) return a;
    }
  }
  return null;
};

V.updateAI = function (v, dt, scene) {
  const who = v.ai && v.speed > 5 ? this.conflict(v, scene) : null;
  const before = v.speed;
  _ai.call(this, v, dt, scene);
  if (who) {
    v.speed = Math.min(v.speed, Math.max(0, before - BRAKE * dt));
    // a pedestrian about to step out sees the car coming and stops at the curb
    if (who.kind === 'npc' && !who.dodge && Math.hypot(who.x - v.x, who.y - v.y) < 70) { who.waitT = Math.max(who.waitT || 0, 0.6); }
  }
};

// slow cars do not hurt anyone: remember who was hit at walking pace and spare them
const _gu2 = GS.update;
GS.update = function (dt) {
  for (const v of this.vehicles || []) if (v.ai && v.speed > 0 && v.speed <= 60) {
    for (const a of this.actors) {
      if (a.dead || (a === this.player && this.player.vehicle) || !v.covers(a.x, a.y, 0)) continue;
      const ang = Math.atan2(a.y - v.y, a.x - v.x);
      a.x += Math.cos(ang) * 3; a.y += Math.sin(ang) * 3;   // a nudge, not a hit
      v.speed = 0;
    }
  }
  return _gu2.call(this, dt);
};
})();
