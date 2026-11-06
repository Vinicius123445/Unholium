'use strict';
// Companions who live a little on their own.
//   Waiting: "Wait here for me." and they stay right there, even if you go to another map, for a few hours. Come
//   back in time and they are still there; take too long and they get tired of waiting, leave the party and go
//   home (and send you a text about it, if they have your number).
//   Needs: hungry, thirsty, tired (tiredness builds the longer they are out with you; sleep, or a rest, clears it).
//   They say so, and look after themselves when you stand around: drink at a tap or fountain, buy a soda, eat
//   what they carry (js/game/companionitems.js), sit down for a breather.
//   "Do you need anything?" (anyone, not only companions): they tell you, and you can hand them something to eat
//   or drink from your pockets, or (a companion) take a break together.
(() => {
const clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const game = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const WAIT = [180, 360];   // how long they wait (game minutes)

const L = G.companionLife = {
  WAIT,
  needs(st) {
    const out = [];
    if ((st.hunger || 0) >= 60) out.push((st.hunger || 0) >= 85 ? 'starving' : 'hungry');
    if ((st.thirst || 0) >= 60) out.push((st.thirst || 0) >= 85 ? 'parched' : 'thirsty');
    if ((st.tired || 0) >= 60) out.push((st.tired || 0) >= 85 ? 'exhausted' : 'tired');
    return out;
  },
  // what helps: food for hunger, drink for thirst (from G.nutrition: [food, drink])
  helps(id, need) { const it = G.ITEMS[id]; if (!it || it.type !== 'consumable' || it.tox || it.drug) return false; const [f, d] = G.nutrition(it); return need === 'food' ? f > 0 : d > 0; },
  feed(scene, npc, id) {
    const st = npc.st, w = scene.world, it = G.item(id), [f, d] = G.nutrition(it);
    if (!scene.player.inventory.remove(id, 1)) return;
    const before = Math.max(st.hunger || 0, st.thirst || 0);
    st.hunger = clamp((st.hunger || 0) - f, 0, 100); st.thirst = clamp((st.thirst || 0) - d, 0, 100);
    G.social.addDisp(w, npc.id, before >= 80 ? 6 : before >= 60 ? 4 : 1);
    if (G.trust) G.trust.adjust(w, npc.id, before >= 60 ? 2 : 0);
    npc.say(G.rng.pick(before >= 60 ? ['Oh, thank you. I really needed that.', 'You are a lifesaver.', 'Finally. Thanks.'] : ['Thanks. That hit the spot.', 'Mm. Thanks.']), 3);
  },
  // they waited too long: off they go
  giveUp(w, id, scene) {
    const st = w.npcs[id];
    st.waitAt = null; st.compWait = false; st.companion = false;
    G.social.addDisp(w, id, -4);
    if (scene && scene.map.id === st.map) {
      const npc = scene.actors.find((a) => a.id === id);
      if (npc) { npc.say(G.rng.pick(['That is it, I am not waiting any longer.', 'Forget it. I am going home.']), 4); if (st.map !== G.NPCS[id].map) { st.goingHome = true; npc.goHomeT = 8; } }
    } else st.map = G.NPCS[id].map;
    if (G.phone && G.phone.isContact(w, id)) G.phone.queue(w, id, G.rng.pick(['Waited for you for hours. I went home.', 'I got tired of waiting. Call me next time.', 'You said you would be right back...']), 2);
    w.log(`${w.displayName(id)} got tired of waiting and went home.`, 'warn');
  },
};

// ---------------------------------------------------------------- waiting where you leave them
const _wait = G.DIALOGUE_NODES._comp_wait;
G.DIALOGUE_NODES._comp_wait = (r) => {
  const res = _wait(r), w = r.scene.world, npc = r.npc;
  npc.st.waitAt = { map: r.scene.map.id, x: npc.x, y: npc.y, until: nowMin(w) + G.rng.int(WAIT[0], WAIT[1]) };
  return res;
};
const _follow = G.DIALOGUE_NODES._comp_follow;
G.DIALOGUE_NODES._comp_follow = (r) => { r.npc.st.waitAt = null; return _follow(r); };
// back on that map: they are where you left them
const NP = G.NPC.prototype, _place = NP.placeBySchedule;
NP.placeBySchedule = function (map, w) {
  const wa = this.st.waitAt;
  if (wa && this.st.companion && this.st.compWait && wa.map === map.id && nowMin(w) < wa.until) { this.x = wa.x; this.y = wa.y; this.path = null; this.state = 'schedule'; return; }
  return _place.call(this, map, w);
};
G.events.on('hour', () => {
  const w = G.world; if (!w) return;
  const scene = game();
  for (const id in w.npcs) {
    const st = w.npcs[id];
    if (!st.alive) continue;
    if (st.waitAt && st.companion && st.compWait && nowMin(w) >= st.waitAt.until) L.giveUp(w, id, scene);
    if (st.waitAt && !st.compWait) st.waitAt = null;
    // tiredness: out and about with you it builds; at home (or asleep) it goes away
    if (st.companion && !st.compWait) st.tired = clamp((st.tired || 0) + (w.isNight() ? 9 : 5), 0, 100);
    else if (st.tired) st.tired = Math.max(0, st.tired - 15);
  }
});
// you sleep, they sleep (and eat and drink in the hours skipped)
const GS = G.GameScene.prototype, _pass = GS.passTime;
GS.passTime = function (hours, sleeping) {
  const r = _pass.apply(this, arguments);
  for (const a of G.companions.list(this)) { if (sleeping) a.st.tired = Math.max(0, (a.st.tired || 0) - hours * 14); else if (hours >= 1) a.st.tired = Math.max(0, (a.st.tired || 0) - hours * 6); }
  return r;
};

// ---------------------------------------------------------------- looking after themselves (while you stand around)
const _cu = G.companions.update.bind(G.companions);
G.companions.update = function (npc, dt, scene) {
  const st = npc.st, p = scene.player, w = scene.world;
  if (st.companion && !npc.talking && npc.state === 'schedule' && !st.goingHome) {
    const busy = npc.compErrand;
    if (busy) {
      busy.t -= dt;
      const sp = busy.spot;
      if (busy.t <= 0 || p.distTo && npc.distTo(p) > 280) { npc.compErrand = null; npc.seated = false; }
      else if (busy.kind === 'rest') { npc.moving = false; npc.seated = true; st.tired = Math.max(0, (st.tired || 0) - dt * 0.6); if (p.moving && npc.distTo(p) > 60) { npc.compErrand = null; npc.seated = false; } return true; }
      else if (npc.arrived(sp)) {
        if (busy.kind === 'water') { st.thirst = Math.max(0, (st.thirst || 0) - 60); npc.say('*drinks*', 2); }
        if (busy.kind === 'vending' && (st.gold || 0) >= 2) { st.gold -= 2; st.thirst = Math.max(0, (st.thirst || 0) - 45); npc.say('*buys a soda*', 2); }
        npc.compErrand = null;
      } else { npc.walkTo(sp, dt, scene); return true; }
    }
    // you have been standing still a while: time to see to themselves
    npc.idleWithPlayer = p.moving ? 0 : (npc.idleWithPlayer || 0) + dt;
    if (!npc.compErrand && npc.idleWithPlayer > 4 && !scene.actors.some((a) => !a.dead && a.state === 'fight' && a.target === p)) {
      const spots = G.needs && G.needs.spots(scene.map), near = (list) => spots && G.needs.nearest(list.filter((s) => Math.abs(s.x * 16 - npc.x) + Math.abs(s.y * 16 - npc.y) < 220), npc);
      if ((st.thirst || 0) >= 60) {
        const s = near(spots ? spots.water : []) || ((st.gold || 0) >= 2 && near(spots ? spots.vending : []));
        if (s) { npc.compErrand = { kind: spots.water.includes(s) ? 'water' : 'vending', spot: { x: s.x, y: s.y }, t: 20 }; npc.say('Hang on, I need a drink.', 2); return true; }
      }
      if ((st.tired || 0) >= 70) { npc.compErrand = { kind: 'rest', t: 25 }; npc.say(G.rng.pick(['I need to sit down for a minute.', 'My feet are killing me.']), 3); return true; }
    }
    // saying so, now and then
    const need = L.needs(st);
    if (need.length && (st.needSaidAt == null || nowMin(w) - st.needSaidAt > 120) && G.rng.chance(dt * 0.05)) {
      st.needSaidAt = nowMin(w);
      const n = need[0];
      npc.say(/hungry|starving/.test(n) ? G.rng.pick(['I am starving. Can we get something to eat?', 'My stomach is growling. Food soon?']) : /thirsty|parched/.test(n) ? G.rng.pick(['I could really use a drink.', 'Is there any water around here?']) : G.rng.pick(['I am beat. We should rest soon.', 'I can barely keep my eyes open.']), 4);
    }
  }
  return _cu(npc, dt, scene);
};

// ---------------------------------------------------------------- "Do you need anything?"
G.DIALOGUE_NODES._needs = (r) => {
  const npc = r.npc, st = npc.st, sc = r.scene, p = sc.player, need = L.needs(st);
  const hurt = npc.hp < (npc.maxHp || 30) * 0.6 || (G.bleed && G.bleed.is && G.bleed.is(npc));
  const parts = [];
  if (need.some((n) => /hungry|starving/.test(n))) parts.push(G.rng.pick(['I am really hungry, actually.', 'Honestly? I have not eaten all day.']));
  if (need.some((n) => /thirsty|parched/.test(n))) parts.push(G.rng.pick(['I would kill for a drink.', 'Something to drink would be nice.']));
  if (need.some((n) => /tired|exhausted/.test(n))) parts.push(G.rng.pick(['I am exhausted.', 'I need some rest.']));
  if (hurt) parts.push('And I am hurt. A bandage would help.');
  const choices = [];
  const offer = (kind, label) => {
    const ids = [...new Set(p.inventory.slots.filter(Boolean).map((s) => s.id))].filter((id) => L.helps(id, kind)).slice(0, 3);
    for (const id of ids) choices.push({ text: `[Give them: ${G.item(id).name}]`, do: () => { L.feed(sc, npc, id); return null; } });
    if (!ids.length) choices.push({ text: `(You have nothing ${label} to give them.)`, next: 'start' });
  };
  if (need.some((n) => /hungry|starving/.test(n))) offer('food', 'to eat');
  if (need.some((n) => /thirsty|parched/.test(n))) offer('drink', 'to drink');
  if (hurt && G.aid && G.aid.bestMed && G.aid.bestMed(p, G.bleed && G.bleed.is && G.bleed.is(npc))) choices.push({ text: '[Treat their wounds]', do: () => { G.aid.treat(sc, npc, G.aid.bestMed(p, G.bleed.is(npc))); return null; } });
  if (st.companion && need.some((n) => /tired|exhausted/.test(n))) choices.push({ text: 'Let us take a break. (rest an hour)', do: () => { sc.passTime(1, false); st.tired = Math.max(0, (st.tired || 0) - 40); npc.say('Ahh. Better.', 2); return null; } });
  choices.push({ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null });
  return { text: parts.length ? parts.join(' ') : G.rng.pick(['No, I am good. Thanks for asking.', 'I am fine. That is nice of you, though.']), choices, after: () => { if (!parts.length) G.social.addDisp(sc.world, npc.id, 1); } };
};
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.remote || runner.npc.transient || runner.npc.def.combat === 'guard' ? [] : [{ text: 'Do you need anything?', next: '_needs' }]));
})();
