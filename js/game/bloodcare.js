'use strict';
// Blood does not stay for ever. Far from you, or on a map you have been away from for a long while, it is gone when you come back:
// someone dealt with it, the rain did. And people deal with it where you can see them: those it bothers, in the place they look
// after, get down and scrub, unless a body is still there or the police are working the scene. Gangs, the homeless, children,
// the frightened and the police leave it alone.
(() => {
const I = G.npcInv, NP = G.NPC.prototype, pick = (a) => G.rng.pick(a);
const LONG = 1440, FAR = 700, SEE = 420, NEAR = 130;   // a day of game minutes; pixels
const nowOf = (w) => w.day * 1440 + w.minutes;
const hasBody = (w, map, d) => Object.values(w.containers || {}).some((c) => c.map === map && c.kind === 'corpse' && Math.hypot(c.x - d.x, c.y - d.y) < 48);
const taken = new Set();
const B = G.bloodCare = {
  LONG, FAR,
  // the hourly sweep
  sweep(w, scene) {
    const cur = scene && scene.map ? scene.map.id : null, p = scene && scene.player, now = nowOf(w);
    if (cur) (w.mapSeen = w.mapSeen || {})[cur] = now;
    for (const map of Object.keys(w.decals || {})) {
      const seen = (w.mapSeen || {})[map], away = map !== cur && seen != null && now - seen >= LONG, list = w.decals[map];
      if (map !== cur && seen == null) { (w.mapSeen = w.mapSeen || {})[map] = now; continue; }   // (saves from before: the wait starts now)
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i]; if (hasBody(w, map, d)) continue;
        if (away || (map === cur && p && Math.hypot(d.x - p.x, d.y - p.y) > FAR && now - d.day * 1440 >= LONG)) list.splice(i, 1);
      }
      if (away && G.marks) { const l = G.marks.on(w, map); for (let i = l.length - 1; i >= 0; i--) if (/blood/.test(l[i].k)) l.splice(i, 1); }
    }
  },
  willing(npc, scene, d) {
    const st = npc.st, def = npc.def, life = G.lifestyle ? G.lifestyle.of(npc.id) : '';
    if (def.kid || st.hostile || (st.fear || 0) >= 30 || def.combat === 'guard' || def.faction === 'government' || /gang|homeless|dealer/.test(life) || (npc.faction && npc.faction.outlaw)) return 0;
    const b = scene.map.buildingAt(d.x, d.y), mine = b && (def.home === b.id || def.shop && b.owner === npc.id || (G.beds && false));
    const P = G.social.persona(npc.id);
    return (mine ? 0.7 : b ? 0.2 : 0.12) + (/shopkeeper|worker|retiree/.test(life) ? 0.15 : 0) + (/nervous|proud/.test(P.trait || '') ? 0.1 : 0) - (/tired|grumpy/.test(P.trait || '') ? 0.08 : 0);
  },
  // is there something they would scrub, now
  look(npc, scene) {
    const w = scene.world, list = G.gore.list(scene); let best = null, bd = NEAR;
    const jobs = G.law && G.law.state ? (G.law.state(w).jobs || []).filter((j) => j.stage !== 'done') : [];
    for (const d of list) {
      if (taken.has(d) || (d.unreach || 0) > 0) continue;
      const q = Math.hypot(d.x - npc.x, d.y - npc.y); if (q >= bd) continue;
      if (hasBody(w, scene.map.id, d) || jobs.some((j) => j.map === scene.map.id && Math.hypot(j.x - d.x, j.y - d.y) < 80)) continue;
      best = d; bd = q;
    }
    return best;
  },
};
G.events.on('hour', () => { try { const w = G.world, sc = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene); if (w) B.sweep(w, sc); } catch (e) { /* the hour goes on */ } });
const _nu = NP.update;
NP.update = function (dt, scene) {
  if (!this.dead && !this.itemJob && (this.scrubThink = (this.scrubThink == null ? 2 + Math.random() * 8 : this.scrubThink) - dt) <= 0) {
    this.scrubThink = 5 + Math.random() * 6;
    const p = scene.player, e = this.currentEntry && this.currentEntry(scene.world);
    if (G.gore.on() && p && this.distTo(p) < SEE && I.free(this) && e && e.act !== 'sleep') {
      const d = B.look(this, scene);
      if (d && Math.random() < B.willing(this, scene, d)) { taken.add(d); if (this.distTo(p) < 200) this.say(pick(['What a mess...', 'I am not leaving this here.', 'Ugh. Somebody has to clean this.']), 3); I.start(this, { kind: 'scrub', d }); }
    }
  }
  return _nu.call(this, dt, scene);
};
const _tick = I.tick;
I.tick = function (npc, dt, scene) {
  const J = npc.itemJob; if (J.kind !== 'scrub') return _tick.call(this, npc, dt, scene);
  const d = J.d, list = G.gore.list(scene);
  if (npc.dead || npc.st.ko || npc.state === 'fight' || npc.state === 'flee' || !list.includes(d)) { taken.delete(d); this.stop(npc); return false; }
  J.t += dt;
  if (Math.hypot(npc.x - d.x, npc.y - (d.y + 5)) > 13) {
    if (J.t > 15) { d.unreach = 1; taken.delete(d); this.stop(npc); return true; }
    npc.walkTo({ x: Math.floor(d.x / 16), y: Math.floor(d.y / 16) }, dt, scene); npc.baseUpdate(dt, scene.map);
    return true;
  }
  npc.moving = false; npc.itemPose = 'bend'; if (npc.faceTowards) npc.faceTowards(d);
  d.clean = Math.min(1, (d.clean || 0) + dt / (d.type === 'pool' ? 7 : 2.6));
  if (Math.random() < dt * 8 && scene.particles) scene.particles(d.x + (Math.random() - 0.5) * 6, d.y - 1, Math.random() < 0.6 ? '#f0f4f8' : '#e8b8c0', 1);
  if (d.clean >= 1) { const i = list.indexOf(d); if (i >= 0) list.splice(i, 1); if (G.marks) G.marks.clean(scene.world, scene.map.id, d.x, d.y, 18, /blood/); taken.delete(d); npc.scrubThink = 0.8; this.stop(npc); }
  return true;
};
Object.assign(G.LANG_PT.s, { 'What a mess...': 'Que bagunça...', 'I am not leaving this here.': 'Não vou deixar isso aqui.', 'Ugh. Somebody has to clean this.': 'Argh. Alguém tem que limpar isso.' });
})();
