'use strict';
// Who sleeps where: a single bed holds one sleeper, a double bed two (one on each side). Whoever comes
// to a full bed takes another free bed in the same home, then a couch, and otherwise sleeps on the floor
// beside it. Waking someone up ([E] on a sleeper) really wakes them: they get out of bed, react, and stay
// up for a while before going back to sleep.
(() => {
const NP = G.NPC.prototype, _nu = NP.update;
const isBed = (d) => d.def.interact === 'bed';
const isCouch = (d) => /couch|sofa/.test(d.type);

function bedNear(map, sp) {
  if (!sp) return null;
  for (const [x, y] of [[sp.x, sp.y], [sp.x - 1, sp.y], [sp.x, sp.y - 1], [sp.x, sp.y + 1], [sp.x + 1, sp.y], [sp.x, sp.y + 2], [sp.x - 1, sp.y + 1], [sp.x + 1, sp.y + 1], [sp.x, sp.y - 2]]) {
    const b = map.decorsAt(x, y).find(isBed);
    if (b) return b;
  }
  return null;
}
const bunk = (bed) => /bunk/.test(bed.def.sprite || '');
const capOf = (bed) => ((bed.def.fw || 1) > 1 || bunk(bed) ? 2 : 1);

G.sleepers = {
  // sleepers already in this bed (other than npc)
  occupants(scene, bed, npc) {
    return scene.actors.filter((a) => a !== npc && a.kind === 'npc' && !a.dead && a.sleeping && a.bedRef === bed);
  },
  claim(npc, scene) {
    const map = scene.map;
    let bed = bedNear(map, npc.sleepSpot);
    if (bed && this.occupants(scene, bed, npc).length >= capOf(bed)) {
      // full: another free bed (or a couch) in the same building
      const b = map.buildingAt(bed.x, bed.y - 2);
      const pool = b ? map.decor.filter((d) => (isBed(d) || isCouch(d)) && d.tx > b.x && d.tx < b.x + b.w - 1 && d.ty > b.y && d.ty < b.y + b.h - 1) : [];
      pool.sort((p, q) => (isBed(q) - isBed(p)) || (Math.hypot(p.x - bed.x, p.y - bed.y) - Math.hypot(q.x - bed.x, q.y - bed.y)));
      bed = pool.find((d) => this.occupants(scene, d, npc).length < (isBed(d) ? capOf(d) : 1)) || null;
      if (bed) {
        npc.sleepSpot = { x: bed.tx, y: bed.ty };
        if (isCouch(bed)) { npc.bedRef = bed; npc.bedSide = null; npc.onFloor = true; npc.x = bed.x; npc.y = bed.y - 2; return; }
      } else {
        // the floor, next to the bed
        npc.bedRef = 'floor'; npc.onFloor = true; npc.bedSide = null; npc.sleepSpot = null;
        const t = map.randomWalkableNear(Math.floor(npc.x / 16), Math.floor(npc.y / 16), 2);
        if (t) { npc.x = t.x * 16 + 8; npc.y = t.y * 16 + 12; }
        return;
      }
    }
    npc.bedRef = bed || 'none';
    npc.onFloor = false;
    npc.bedSide = bed && capOf(bed) > 1 ? this.occupants(scene, bed, npc).length : null;
    if (bed && bunk(bed)) { const o = this.occupants(scene, bed, npc)[0]; npc.bedSide = o ? 1 - (o.bedSide || 0) : npc.id.length % 2; }   // (bottom bunk 0, top bunk 1)
  },
};

NP.update = function (dt, scene) {
  const r = _nu.call(this, dt, scene);
  if (this.sleeping && !this.bedRef && scene.map) G.sleepers.claim(this, scene);
  else if (!this.sleeping && this.bedRef) { this.bedRef = null; this.bedSide = null; this.onFloor = false; }
  return r;
};

// waking someone up
const GS = G.GameScene.prototype, _talk = GS.talkTo;
GS.talkTo = function (npc) {
  if (!npc.sleeping) return _talk.call(this, npc);
  npc.sleeping = false;
  npc.wokeT = this.time + 60;   // stays up for a minute
  npc.bedRef = null; npc.onFloor = false;
  npc.dir = 0;
  const own = this.map.buildingAt(npc.x, npc.y - 3);
  const home = own && npc.def.home === own.id;
  const close = (npc.st.romance || 0) >= 40 || (npc.st.disp || 0) >= 40 || npc.st.companion;
  npc.say(close ? G.rng.pick(['Mmh... what time is it?', 'Hey... you okay?', '*yawns* What is it?'])
    : home ? G.rng.pick(['What are you doing in my house?!', 'WHO ARE YOU?! Get out!', 'How did you get in here?!'])
      : G.rng.pick(['Huh?! What?', 'Ugh... leave me alone.', 'What do you want?']), 3);
  if (!close) npc.st.fear = Math.max(npc.st.fear || 0, home ? 50 : 20);
  npc.waitT = 0;
  G.audio.play('select');
};
})();
