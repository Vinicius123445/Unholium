'use strict';
// Beds: who owns which bed, sleeping in other people's beds, and what happens when they catch you.
// A bed belongs to the NPC whose schedule has them sleeping on that tile; other beds in a home belong to
// whoever lives there; motel/bar guest beds belong to the owner of the business.

G.beds = {
  // The schedule entry an NPC follows right now (works for NPCs not currently on screen).
  entryNow(id, w) {
    const def = G.NPCS[id], st = w.npcs[id];
    const sched = (st && st.scheduleFrom ? G.NPCS[st.scheduleFrom] : def).schedule || [];
    const h = w.hourF;
    return sched.find((e) => G.util.hourInRange(h, e.from, e.to)) || null;
  },

  pointOf(map, at) { return typeof at === 'string' ? map.points[at] : at; },

  ownerOf(scene, d) {
    const map = scene.map, w = scene.world;
    const b = map.buildingAtTile(d.tx, d.ty);
    if (b && w.flags.player_home === b.id) return null;
    if (d.guest) {
      const sid = Object.keys(G.SHOPS).find((s) => G.SHOPS[s].room && map.building(G.NPCS[w.shops[s].owner] && G.NPCS[w.shops[s].owner].home) === b);
      return sid ? w.shops[sid].owner : null;
    }
    let resident = null;
    for (const id in G.NPCS) {
      const def = G.NPCS[id];
      if (def.map !== map.id || !w.isAlive(id)) continue;
      for (const e of def.schedule || []) {
        if (e.act !== 'sleep') continue;
        const p = this.pointOf(map, e.at);
        if (p && !Array.isArray(p) && p.x === d.tx && p.y === d.ty) return id;
      }
      if (b && def.home === b.id && !resident) resident = id;
    }
    return resident;
  },

  isMine(scene, d) {
    if (scene.map.id === 'jail') { const c = scene.map.points[G.jail.CELL + '_bed']; return !!scene.world.jail && c.x === d.tx && c.y === d.ty; }
    const w = scene.world, b = scene.map.buildingAtTile(d.tx, d.ty);
    if (b && w.flags.player_home === b.id) return true;
    return !!(d.guest && w.rooms[scene.map.id] != null && w.rooms[scene.map.id] >= w.day);
  },

  // Sleep hour by hour in someone else's bed; stop as soon as the owner walks in.
  sleepForeign(scene, hours, d, owner) {
    const w = scene.world, p = scene.player, map = scene.map;
    const b = map.buildingAtTile(d.tx, d.ty);
    let slept = 0, caught = false;
    for (let i = 0; i < hours; i++) {
      w.skipHours(1);
      slept++;
      if (!owner || !w.isAlive(owner) || w.npcs[owner].map !== map.id) continue;
      const e = this.entryNow(owner, w);
      const at = e && this.pointOf(map, e.at);
      const pt = at && !Array.isArray(at) ? at : null;
      const coming = e && e.act === 'sleep' && pt && Math.hypot(pt.x - d.tx, pt.y - d.ty) <= 3;   // (the spot by the bed, not on it)
      const home = pt && b && map.buildingAtTile(pt.x, pt.y) === b && e.act !== 'sleep';
      if (coming || (home && G.rng.chance(d.guest ? 0.35 : 0.5))) { caught = true; break; }
    }
    // (a night's sleep does not mend wounds: only medicine heals, js/game/medicine.js)
    p.stamina = p.maxStamina;
    scene.resyncNPCs();
    if (!caught) { scene.toast('You slept like a baby. Nobody noticed.', 'good'); return; }
    const npc = scene.actors.find((a) => a.id === owner && !a.dead);
    if (!npc) return;
    // the owner is standing next to the bed
    const spot = [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: d.tx + dx, y: d.ty + dy })).find((q) => !map.isSolidTile(q.x, q.y)) || { x: d.tx, y: d.ty + 1 };
    npc.x = spot.x * 16 + 8; npc.y = spot.y * 16 + 12;
    npc.sleeping = false; npc.state = 'schedule'; npc.path = null;
    p.x = d.tx * 16 + 8; p.y = d.ty * 16 + 14;
    w.log(`${w.displayName(owner)} caught you sleeping in their bed.`, 'warn');
    scene.pendingBedReaction = npc;   // handled once the fade is over
  },

  // Angry, confused or terrified — depends on who they are and what they think of you.
  react(scene, npc) {
    const w = scene.world, st = npc.st;
    const disp = (st.disp || 0) + w.getRep(scene.region) / 2;
    if (npc.def.combat === 'guard') { npc.say('You are under arrest for trespassing!'); scene.reportCrime('trespass', npc); return; }
    let mood = 'question';
    if (disp >= 30) mood = 'friendly';
    else if (npc.def.combat === 'fight' && (disp < 0 || G.rng.chance(0.5))) mood = 'angry';
    else if (npc.def.combat === 'flee' && G.rng.chance(0.35)) mood = 'run';
    if (mood === 'run') {
      npc.say(G.rng.pick(['AAAH! Somebody help!', 'Intruder! Call the police!', 'Get out of my house!']));
      st.fear = 100;
      st.disp = (st.disp || 0) - 20;
      npc.startFlee(scene.player);
      scene.reportCrime('trespass', npc);
      return;
    }
    npc.bedMood = mood;
    if (mood === 'angry') npc.say('What the hell?!');
    G.demand.open(scene, npc, '_bed_intruder');
  },
};

G.DIALOGUES._bed_intruder = {
  start: {
    text: (c) => ({
      angry: G.rng.pick(['What the hell are you doing in MY bed?!', 'You have five seconds to explain why you are in my bed.']),
      question: G.rng.pick(['Uh... who are you? And why are you in my bed?', 'Excuse me? This is my house. That is my bed.']),
      friendly: G.rng.pick(['...Rough night? You could have asked, you know.', 'Well, this is awkward. Comfortable, at least?']),
    }[c.npc.bedMood] || 'Why are you in my bed?'),
    choices: [
      { text: (c) => `${c.tag(c.npc.bedMood === 'angry' ? 7 : 5)} Sorry! Wrong house. I'm leaving.`, if: (c) => c.npc.bedMood !== 'friendly', do: (c) => {
        if (c.check('bed_sorry', c.npc.bedMood === 'angry' ? 7 : 5)) { c.st.disp = (c.st.disp || 0) - 5; return 'leave'; }
        return 'escalate';
      } },
      { text: (c) => `${c.tag(7)} Best bed in town. Can you blame me?`, do: (c) => {
        if (c.check('bed_joke', 7)) { c.st.disp = (c.st.disp || 0) + 5; return 'laugh'; }
        c.st.disp = (c.st.disp || 0) - 15;
        return 'escalate';
      } },
      { text: (c) => `${c.tag(c.npc.def.combat === 'fight' ? 9 : 5, 'intimidate')} You did not see anything. Understood?`, do: (c) => {
        if (c.check('bed_scare', c.npc.def.combat === 'fight' ? 9 : 5, 'intimidate')) { c.st.fear = 80; c.st.disp = (c.st.disp || 0) - 20; return 'scared'; }
        return 'escalate';
      } },
      { text: 'Here is $20 for the trouble.', if: (c) => c.gold() >= 20 && c.npc.bedMood !== 'friendly', do: (c) => { c.pay(20); c.st.disp = (c.st.disp || 0) + 2; return 'paid'; } },
      { text: 'Thanks for the bed. I owe you one.', if: (c) => c.npc.bedMood === 'friendly', do: (c) => { c.st.disp = (c.st.disp || 0) + 3; return 'leave'; } },
    ],
  },
  leave: { text: 'Just... go. And do not come back.', choices: [{ text: '[Leave]', next: null }] },
  laugh: { text: 'Ha! Okay, that is fair. But this never happens again.', choices: [{ text: 'Deal.', next: null }] },
  scared: { text: 'O-okay. I did not see anything. Please go.', choices: [{ text: '[Leave]', next: null }] },
  paid: { text: '...Fine. Get out of my house.', choices: [{ text: '[Leave]', next: null }] },
  escalate: {
    text: (c) => (c.npc.def.combat === 'fight' ? 'That is it. You are dead.' : 'Get out! I am calling the police!'),
    choices: [{ text: '[Leave]', next: null }],
    after: () => {},
  },
};
// Escalation happens when the conversation ends (so the dialogue can still be read).
G.DIALOGUES._bed_intruder.escalate.choices[0].do = (c) => {
  if (c.npc.def.combat === 'fight') { c.npc.aggressor = true; c.npc.startFight(c.p, c.scene); }
  else { c.npc.st.fear = 100; c.npc.startFlee(c.p); c.scene.reportCrime('trespass', c.npc); }
};
