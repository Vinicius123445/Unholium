'use strict';
// Bodies run on the game clock. Effect durations (e.t) are kept in "clock seconds": one of them is two game minutes,
// whatever the Day Length setting says, so a 6-hour high lasts 6 game hours at any speed. G.clock converts.
//   Time that passes in one go (sleep, waiting, blacking out, the debug skips) is processed as a whole for you and for
//   everyone else: effects run out, chain into what comes after them (a high into its comedown) and keep doing their
//   damage, so sleeping through an overdose does not cure it. People you are not near keep going, hour by hour.
(() => {
const REF = 2;   // game minutes in one clock second
const C = G.clock = {
  REF,
  // real seconds of play -> clock seconds
  of(dt) { return dt * (12 / (G.settings.get('dayLengthMinutes') || 12)); },
  fromMinutes(min) { return min / REF; },
  skipping: false,
  // a stretch of clock seconds for one body: effects with chains, damage, the load in the blood
  body(o, fx, secs) {
    const out = { dmg: 0, ended: [] };
    let list = fx;
    for (let guard = 0; guard < 6; guard++) {
      const next = [];
      for (const e of list) {
        const d = G.EFFECTS[e.id]; if (!d) continue;
        const used = Math.min(Math.max(0, e.t), e.left != null ? e.left : secs), left = (e.left != null ? e.left : secs) - used;
        e.t -= used;
        if (d.dps) out.dmg += d.dps * e.power * used;
        if (e.t <= 0) { out.ended.push(e); if (d.then && left > 0) next.push({ id: d.then[0], t: d.then[1], dur: d.then[1], power: e.power, left }); }
        delete e.left;
      }
      if (!next.length) break;
      for (const n of next) fx.push(n);
      list = next;
    }
    for (let i = fx.length - 1; i >= 0; i--) { delete fx[i].left; if (fx[i].t <= 0) fx.splice(i, 1); }
    if (o.alcohol > 0) o.alcohol = Math.max(0, o.alcohol - (G.ALCOHOL_DECAY || 0.1) * secs);
    const load = o.drugs && o.drugs.load;
    if (load) for (const cls in load) if (load[cls] > 0) load[cls] = Math.max(0, load[cls] - ((G.DRUG_CLASSES[cls] || {}).decay || 0.3) * secs);
    return out;
  },
  // someone the frame loop is not running for: an hour goes by
  npcHour(w, id) {
    const st = w.npcs[id];
    if (!st || !st.alive || (!st.fx && !st.alcohol && !st.drugs)) return;
    const res = this.body(st, st.fx || (st.fx = []), this.fromMinutes(60));
    if (res.dmg > 0 && st.hp != null) st.hp = Math.max(st.ko ? 1 : 5, st.hp - res.dmg);   // (an overdose keeps eating at them; first aid or the hospital decides the rest)
  },
};

// ---------------------------------------------------------------- time passing in one go
const W = G.World.prototype, _skip = W.skipHours;
W.skipHours = function (h) {
  C.skipping = true;
  let r;
  try { r = _skip.call(this, h); } finally { C.skipping = false; }
  const p = G.player, scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!p || p.dead) return r;
  const res = C.body(p, p.effects || (p.effects = []), C.fromMinutes(h * 60));
  for (const e of res.ended) if (e.id === 'overdose' || e.id === 'resp_depression') res.dmg += 15;   // (ran its course with nobody there)
  if (res.dmg > 0) { p.hp -= res.dmg; if (p.hp <= 0 && scene) { p.hp = 1; G.combat.damage(p, 999, { kind: 'poison', x: p.x, y: p.y }, scene); } }
  if (scene && scene.delir && !G.effects.has(p, 'delirium')) scene.delir = null;
  return r;
};
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene), here = new Set(scene && !C.skipping ? scene.actors.map((a) => a.id) : []);
  for (const id in w.npcs) if (!here.has(id)) C.npcHour(w, id);
});

// conversations do not stop the clock (js/game/quietui.js), so they do not stop the body either
const DS = G.DialogueScene.prototype, _ds = DS.update;
DS.update = function (dt) {
  const r = _ds.call(this, dt), g = this.game, p = g && g.player;
  if (p && !p.dead && g.world && G.scenes.top() === this && p.effects) {
    const secs = C.of(dt);
    for (const e of p.effects) if (e.t > secs) e.t -= secs;
    if (p.alcohol > 0) p.alcohol = Math.max(0, p.alcohol - (G.ALCOHOL_DECAY || 0.1) * secs);
  }
  return r;
};
})();
