'use strict';
// Companions and invitations.
//   "Want to come with me for a while?" — people who like you follow you around (up to 3), across maps and
//   floors. Fighters back you up when someone attacks you; the timid hang back. They chat, comment on where
//   you are, and you grow closer the longer you spend together. Tell them to wait, follow, or go home.
//   "Come over to my place?" — they agree to a time and show up at your house. Be there, or they will be
//   hurt. "Can I come over to yours?" — friends let you in (their door is unlocked for you).
(() => {
const MAX = 3;
G.companions = {
  list(scene) { return scene.actors.filter((a) => a.kind === 'npc' && !a.dead && a.st.companion); },
  start(scene, npc) {
    const st = npc.st;
    st.companion = true; st.compWait = false; st.goingHome = false;
    npc.state = 'schedule'; npc.needTask = null; npc.loveTask = null; npc.sleeping = false;
    scene.world.log(`${scene.world.displayName(npc.id)} is coming with you.`, 'good');
  },
  dismiss(scene, npc) {
    const st = npc.st;
    st.companion = false; st.compWait = false;
    if (scene.map.id !== npc.def.map) { st.goingHome = true; npc.goHomeT = 6; }
  },
  // Called from NPC.update. Returns true while this NPC is busy being a companion or a guest.
  update(npc, dt, scene) {
    const st = npc.st, p = scene.player, w = scene.world;
    if (st.goingHome) {   // walking off to go home (they vanish once out of sight, and are home later)
      npc.goHomeT -= dt;
      const ex = G.travel.exitTo(scene.map, npc.def.map) || scene.map.exits.find((e) => G.MAPGEN[e.to]) || scene.map.exits[0];
      if (ex) npc.walkTo({ x: ex.x, y: ex.y }, dt, scene);
      if ((npc.goHomeT <= 0 && !scene.isOnScreen(npc.x, npc.y)) || (ex && npc.arrived({ x: ex.x, y: ex.y })) || npc.goHomeT < -60) {   // out of sight (or at the exit), not in front of you
        st.goingHome = false; st.map = npc.def.map;
        scene.actors = scene.actors.filter((a) => a !== npc);
      }
      return true;
    }
    if (st.visiting && !st.companion) return this.updateGuest(npc, dt, scene);
    if (!st.companion || npc.talking) return false;
    if (npc.state === 'fight' || npc.state === 'flee') return false;
    npc.sleeping = false; npc.needTask = null;
    // back you up
    const enemy = scene.actors.find((a) => !a.dead && a !== npc && ((a.kind === 'npc' && a.state === 'fight' && a.target === p) || (a.kind === 'animal' && a.state === 'attack' && a.target === p)) && a.distTo(p) < 160);
    if (enemy && npc.def.combat !== 'flee' && !(enemy.kind === 'npc' && enemy.st && enemy.st.companion)) { npc.say(G.rng.pick(['I got your back!', 'Hey! Leave them alone!', 'Two against one, buddy.']), 2); npc.startFight(enemy, scene); return true; }
    if (enemy && npc.def.combat === 'flee' && npc.distTo(enemy) < 70) { npc.say('I am staying back here!', 2); npc.stepToward(npc.x + (npc.x - enemy.x), npc.y + (npc.y - enemy.y), dt, scene, true); return true; }
    if (st.compWait) { npc.moving = false; npc.lookAround && npc.lookAround(dt); return true; }
    // follow, a step behind
    const d = npc.distTo(p);
    if (d > 300) { const t = this.besidePlayer(scene); npc.x = t.x; npc.y = t.y; npc.path = null; }
    else if (d > 34) npc.walkTo({ x: Math.floor(p.x / 16), y: Math.floor((p.y - 3) / 16) }, dt, scene, d > 110);
    else { npc.moving = false; if (Math.random() < dt * 0.5) npc.faceTowards(p); }
    // small talk
    if ((npc.compTalkT = (npc.compTalkT == null ? G.rng.range(20, 40) : npc.compTalkT) - dt) <= 0) { npc.compTalkT = G.rng.range(35, 80); npc.say(this.remark(npc, scene), 4); }
    return true;
  },
  remark(npc, scene) {
    const w = scene.world, p = scene.player, P = G.social.persona(npc.id), map = scene.map;
    const pool = [
      `So this is ${map.meta.name}. ${map.meta.district === 'heights' ? 'Fancy. I feel poor just standing here.' : map.meta.district === 'southside' || map.meta.district === 'eastside' ? 'Keep your eyes open around here.' : 'Not bad.'}`,
      `You know I love ${P.hobby}, right? We should do that sometime.`,
      `I am worried about ${P.worry}. Sorry. Just thinking out loud.`,
      w.isNight() ? 'It is late. Are we doing something, or just walking around in the dark?' : 'Nice day for it, whatever "it" is.',
      `Someday I want to ${P.dream}.`,
      (p.hunger || 0) > 60 ? 'I can hear your stomach from here. Let us get food.' : 'I could eat. I could always eat.',
      p.hp < p.maxHp * 0.4 ? 'You are bleeding. Like, a lot. Should we... do something about that?' : 'Where are we going, anyway?',
    ];
    if (scene.map.buildingAt(p.x, p.y - 3) && G.doors.residents(scene, scene.map.buildingAt(p.x, p.y - 3)).length && !G.doors.allowed(scene, scene.map.buildingAt(p.x, p.y - 3))) pool.push('Are we supposed to be in here?', 'I do not think we should be in here.');
    return G.rng.pick(pool);
  },
  besidePlayer(scene) {
    const p = scene.player, map = scene.map, tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1], [2, 0], [-2, 0]]) if (!map.isSolidTile(tx + dx, ty + dy)) return { x: (tx + dx) * 16 + 8, y: (ty + dy) * 16 + 12 };
    return { x: p.x, y: p.y };
  },

  // ---- guests at your place ----
  homeMap: 'rural',
  updateGuest(npc, dt, scene) {
    const w = scene.world, p = scene.player, b = scene.map.building(w.flags.player_home);
    if (!b) return false;
    npc.sleeping = false;
    if (!npc.guestGoal || npc.arrived(npc.guestGoal)) {
      npc.moving = false;
      if ((npc.guestWait = (npc.guestWait || 0) - dt) <= 0) { npc.guestWait = G.rng.range(4, 10); npc.guestGoal = scene.map.randomWalkableNear(b.doorX, b.doorY - 2, 2, G.rng, false); }
    } else npc.walkTo(npc.guestGoal, dt, scene);
    const inside = scene.map.buildingAt(p.x, p.y - 3) === b;
    if (inside && !npc.st.visitMet) {
      npc.st.visitMet = true;
      npc.say(G.rng.pick(['There you are! Nice place.', 'Hey! Thanks for having me.', 'I brought nothing. I hope that is fine.']), 4);
      G.social.addDisp(w, npc.id, 4);
    }
    return true;
  },
  hourly(scene) {
    const w = scene.world, h = w.hour;
    for (const id in w.npcs) {
      const st = w.npcs[id], v = st.visit;
      if (st.companion && st.alive) { G.social.addDisp(w, id, 1); if ((st.romance || 0) > 0) st.romance = Math.min(100, st.romance + 0.5); }
      if (!v || !st.alive) continue;
      if (v.day === w.day && h === v.from - 1 && G.phone.isContact(w, id)) G.phone.queue(w, id, G.rng.pick(['On my way!', 'Leaving now. See you soon.', 'Be there in an hour!']), 5);
      if (v.day === w.day && h === v.from) {
        st.visiting = true; st.visitMet = false; st.map = this.homeMap;
        if (scene.map.id === this.homeMap) scene.syncPresence();
        const npc = scene.actors.find((a) => a.id === id);
        if (npc) { const pt = scene.map.points[w.flags.player_home + '_in']; npc.x = pt.x * 16 + 8; npc.y = pt.y * 16 + 12; }
      }
      if (st.visiting && (w.day > v.day || h >= v.to)) {
        st.visiting = false; st.visit = null; st.map = G.NPCS[id].map;
        if (st.visitMet) { G.social.addDisp(w, id, 6); if ((st.romance || 0) > 0) st.romance = Math.min(100, st.romance + 6); if (G.phone.isContact(w, id)) G.phone.queue(w, id, G.rng.pick(['Thanks for tonight. That was fun.', 'Had a great time. Let us do it again.']), 30); }
        else { G.social.addDisp(w, id, -10); if (G.phone.isContact(w, id)) G.phone.queue(w, id, G.rng.pick(['I came over. You were not even home. Thanks a lot.', 'Waited at your place for hours. Wow.']), 10); }
        const vis = scene.actors.find((a) => a.id === id && !a.st.companion && !a.dead);
        if (vis && scene.map.id !== G.NPCS[id].map && scene.isOnScreen(vis.x, vis.y)) { st.map = scene.map.id; st.goingHome = true; vis.goHomeT = 30; }   // they walk out
        else {
          scene.actors = scene.actors.filter((a) => a.id !== id || a.st.companion);
          if (scene.map.id === G.NPCS[id].map) scene.syncPresence();
        }
      }
    }
  },
};

// ---- dialogue ----
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, w = runner.scene.world, out = [];
  if (npc.transient || npc.remote || st.fear >= 60 || st.hostile) return out;
  if (st.companion) {
    out.push(st.compWait ? { text: 'Come on, follow me.', next: '_comp_follow' } : { text: 'Wait here for me.', next: '_comp_wait' });
    out.push({ text: 'You can head home now. Thanks.', next: '_comp_home' });
    return out;
  }
  if ((st.disp || 0) >= 15 || st.partner) out.push({ text: 'Want to come with me for a while?', next: '_comp_ask' });
  if (!st.visit && ((st.disp || 0) >= 30 || (st.romance || 0) >= 30 || st.partner)) out.push({ text: 'Want to come over to my place?', next: '_invite' });
  if (npc.def.home && ((st.disp || 0) >= 45 || st.partner)) out.push({ text: 'Can I come over to your place sometime?', next: '_visit_them' });
  return out;
});
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_NODES._comp_ask = (r) => {
  const { npc } = r, st = npc.st, w = r.scene.world, e = npc.currentEntry(w);
  if (G.companions.list(r.scene).length >= MAX) return { text: 'Looks like you already have a whole crew. Maybe another time.', choices: BACK };
  if (e && e.act === 'work' && (npc.def.shop || npc.def.combat === 'guard')) return { text: 'I am working. I can not just leave.', choices: BACK };
  if (w.isNight() && (w.hour >= 23 || w.hour < 6) && !st.partner && (st.disp || 0) < 50) return { text: 'At this hour? I am going to bed. Ask me tomorrow.', choices: BACK };
  const ok = st.partner || (st.disp || 0) >= 25 || r.c.check('comp_ask', 6);
  if (!ok) return { text: G.rng.pick(['I barely know you.', 'No thanks. I have things to do.', 'Hmm. Not today.']), choices: BACK };
  G.companions.start(r.scene, npc);
  return { text: G.rng.pick(['Sure! Where are we going?', 'Why not. Lead the way.', 'Finally, some excitement.']), choices: [{ text: 'Let us go.', next: null }] };
};
G.DIALOGUE_NODES._comp_wait = (r) => { r.npc.st.compWait = true; return { text: G.rng.pick(['I will be right here.', 'Do not take forever.']), choices: [{ text: 'Back soon.', next: null }] }; };
G.DIALOGUE_NODES._comp_follow = (r) => { r.npc.st.compWait = false; return { text: 'Right behind you.', choices: [{ text: 'Let us go.', next: null }] }; };
G.DIALOGUE_NODES._comp_home = (r) => {
  G.companions.dismiss(r.scene, r.npc);
  return { text: G.rng.pick(['That was fun. See you around!', 'Alright. Call me sometime.', 'Finally, my feet are killing me.']), choices: [{ text: 'Bye.', next: null }] };
};
G.DIALOGUE_NODES._invite = (r) => {
  const { npc } = r, st = npc.st, w = r.scene.world;
  const yes = st.partner || (st.disp || 0) >= 40 || (st.romance || 0) >= 30 || r.c.check('invite', 6);
  if (!yes) return { text: G.rng.pick(['Your place? I do not know you that well yet.', 'Maybe some other time.']), choices: BACK };
  const set = (day, from, to, text) => ({ text, next: null, do: () => { st.visit = { day, from, to }; G.phone.addContact(w, npc.id); w.log(`${w.displayName(npc.id)} is coming over to your house: day ${day}, ${from}:00.`, 'quest'); } });
  const tonight = w.hour < 19;
  return {
    text: G.rng.pick(['I would like that. When?', 'Sure! What time works?']),
    choices: [
      tonight ? set(w.day, 20, 23, 'Tonight at 8.') : set(w.day + 1, 20, 23, 'Tomorrow night at 8.'),
      set(w.day + 1, 13, 17, 'Tomorrow afternoon, around 1.'),
      { text: 'Right now. Come with me.', next: '_comp_ask' },
      { text: 'Actually, never mind.', next: 'start' },
    ],
  };
};
G.DIALOGUE_NODES._visit_them = (r) => {
  const { npc } = r, w = r.scene.world;
  (w.invites = w.invites || {})[npc.def.home] = G.effects.now() + 60 * 30;
  return { text: G.rng.pick(['Of course. My door is open for you. Today and tomorrow, anyway.', 'Sure, drop by whenever. I will leave it unlocked.']), choices: BACK };
};

// ---- the NPC side: companions take priority over schedules, needs and love ----
const NP = G.NPC.prototype, _npcUpdate = NP.update;
NP.update = function (dt, scene) {
  if (!this.dead && !this.talking && (this.st.companion || this.st.goingHome || this.st.visiting)) {
    this.baseUpdate(dt, scene.map);
    this.st.hp = this.hp;
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (this.state === 'fight') { this.updateFight(dt, scene); if (this.target && this.target.dead) { this.state = 'schedule'; this.target = null; } return; }
    if (this.state === 'flee') { this.updateFlee(dt, scene); return; }
    if (G.companions.update(this, dt, scene)) return;
  }
  return _npcUpdate.call(this, dt, scene);
};

// ---- they come along when you change maps ----
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  const w = this.world, p = this.player;
  const going = this.actors ? this.actors.filter((a) => a.kind === 'npc' && !a.dead && a.st.companion && !a.st.compWait && a.distTo(p) < 260) : [];
  for (const a of going) { if (id === 'jail') { a.st.companion = false; a.st.map = a.def.map; } else a.st.map = id; }
  _load.call(this, id, spawnName, pos);
  for (const a of this.actors) {
    if (a.kind !== 'npc' || !a.st.companion || a.st.compWait) continue;
    const t = G.companions.besidePlayer(this);
    a.x = t.x; a.y = t.y; a.path = null; a.sleeping = false;
  }
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && G.world) G.companions.hourly(scene);
});
})();
