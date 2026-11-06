'use strict';
// Love, sex, pregnancy and babies (all fade-to-black; caught-in-the-act sprites are censored).
//   Player:   flirt enough (romance 60+, or be partners) and "Want to go somewhere private?" appears.
//             Whether they say yes depends on their personality, marriage, work, and whether people
//             are watching. Condoms (pharmacy, gas station) make pregnancy very unlikely.
//   Jealousy: your partner, people with a crush on you, and your lover's spouse can find out (word
//             gets around over the following days). Each reacts by personality: some do not care,
//             some are hurt, some break up with you, some want you dead.
//   Pregnancy (1 game day = 1 week, 40 days): morning sickness, then fatigue, then a slow, hungry
//             third trimester; the belly grows; drinking and drugs hurt the baby; labor, then birth.
//             You name your children. Their crib appears in your house (or the NPC parents' house).
//   NPCs:     couples (spouses, and lovers who get together over time) make love at night in their
//             bed. Walk in on them and they jump out naked: they panic and run, or come at you.
//   Animals:  pair up, mate (they do not care who is watching) and have young some days later.

G.EFFECTS.afterglow = { name: 'Afterglow', kind: 'buff', color: '#f08ab0', stats: { charisma: 1, staminaRegen: 0.3 }, desc: 'Relaxed and confident.' };
G.EFFECTS.labor = { name: 'Contractions', kind: 'buff', bad: true, color: '#ff7aa0', stats: { charisma: -2, meleeDmg: -0.3 }, speed: 0.5, desc: 'The baby is coming. Find somewhere to lie down.' };
G.EFFECTS.postpartum = { name: 'Recovering', kind: 'buff', bad: true, color: '#d8a0b8', stats: { staminaRegen: -0.4 }, speed: 0.85, desc: 'You just gave birth. Take it easy.' };
G.EFFECTS.family = { name: 'Family Warmth', kind: 'buff', color: '#f0c070', stats: { charisma: 1 }, regen: 0.15, desc: 'You saw your baby.' };

G.love = {
  PREG_DAYS: 40,      // one game day per week
  CHANCE: 0.2,        // per time, unprotected
  NPC_CHANCE: 0.15,
  GESTATION: { rabbit: 1, chicken: 1, wolf: 3, boar: 4, deer: 6, bear: 7, cow: 9 },
  LITTER: { rabbit: [2, 3], wolf: [1, 2], chicken: [1, 3] },

  now() { return G.effects.now(); },
  scene() { return G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene); },
  sexOf(w, id) {
    if (id === 'player') { const s = this.scene(); return s ? s.player.look.body : 'm'; }
    const st = w.npcs[id];
    return st && st.lookSeed ? G.look(st.lookSeed).body : (G.NPCS[id].look.body || 'm');
  },
  // How jealous someone is (0..1): their personality, plus a little of who they are.
  jealousy(id) {
    const base = { suspicious: 0.95, proud: 0.85, grumpy: 0.75, nervous: 0.6, tired: 0.4, friendly: 0.3, chatty: 0.2, cheerful: 0.1 }[G.social.persona(id).trait];
    return G.util.clamp(base + ((G.util.hashString('jeal' + id) % 31) - 15) / 100, 0, 1);
  },
  married(w, id) { return G.romance.married(w, id); },
  spouseOf(w, id) { const rel = (G.NPCS[id] || {}).relations || {}; return Object.keys(rel).find((o) => rel[o] === 'spouse' && w.isAlive(o)) || null; },
  partnerOf(w, id) { const st = w.npcs[id]; return st.lover && w.isAlive(st.lover) ? st.lover : this.spouseOf(w, id); },
  days(preg, w) { return w.day - preg.day + w.hourF / 24; },
  belly(preg) {
    if (!preg || !G.world) return 0;
    const d = this.days(preg, G.world);
    return d < 12 ? 0 : d < 22 ? 1 : d < 32 ? 2 : 3;
  },
  trimester(preg) { const d = this.days(preg, G.world); return d < 14 ? 1 : d < 28 ? 2 : 3; },

  // ---------------- conception ----------------
  conceive(w, a, b, chance) {
    const sa = this.sexOf(w, a), sb = this.sexOf(w, b);
    if (sa === sb || !G.rng.chance(chance)) return false;
    const mother = sa === 'f' ? a : b, father = mother === a ? b : a;
    const preg = { day: w.day, father, known: false, harm: 0 };
    if (mother === 'player') { const s = this.scene(); if (!s || s.player.preg) return false; s.player.preg = preg; }
    else { if (w.npcs[mother].preg) return false; w.npcs[mother].preg = preg; }
    return true;
  },

  // ---------------- with the player ----------------
  refusal(scene, npc) {
    const w = scene.world, st = npc.st, P = G.social.persona(npc.id);
    if ((st.disp || 0) < 0) return 'After everything? No.';
    if (st.preg && this.days(st.preg, w) > 32) return 'Look at me. I am about to have a baby. Not now.';
    const e = npc.currentEntry(w);
    if (e && e.act === 'work' && npc.def.shop) return 'I am working! Later. Maybe.';
    if (!st.partner) {
      const need = 60 + ({ nervous: 10, suspicious: 10, proud: 5, cheerful: -5, chatty: -5 }[P.trait] || 0) + (this.married(w, npc.id) ? 25 : 0);
      if ((st.romance || 0) < need) return this.married(w, npc.id) && (st.romance || 0) >= 60 ? 'I want to... but I am married. I can not. Not yet.' : G.rng.pick(['I like you. But not like that. Not yet.', 'Slow down. Buy me dinner first.', 'Ha. You wish.']);
    }
    const witnesses = scene.actors.filter((a) => a.kind === 'npc' && a !== npc && !a.dead && !a.sleeping && a.canSee(scene, npc, 110));
    if (witnesses.length) return G.rng.pick(['Here? With people watching? Somewhere private.', 'Not here. People are looking at us.']);
    return null;
  },
  withPlayer(scene, npc) {
    const w = scene.world, p = scene.player, st = npc.st;
    G.scenes.push(new G.FadeScene(() => {
      // you wake up together at their place or yours (or stay where you are, if you are already home)
      scene.passTime(1, false);   // first: the hour going by puts people back on their schedules
      if (this.goHome(scene, npc)) { const here = scene.actors.find((a) => a.id === npc.id); if (here) npc = here; }
      else if (G.everyday) G.everyday.together(scene, scene.actors.find((a) => a.id === npc.id) || npc);
      p.stamina = p.maxStamina;
      G.effects.add(p, 'afterglow', 300);
      // how it went (the rhythm minigame): a better night means more
      const score = G.love.lastScore == null ? 0.5 : G.love.lastScore;
      st.romance = Math.min(100, (st.romance || 0) + Math.round(4 + score * 12));
      G.social.addDisp(w, npc.id, Math.round(2 + score * 10));
      st.loveDay = w.day;
      // wherever you woke up together, you are welcome there for the rest of the day (js/game/doors.js allowed)
      const hb = scene.map.buildingAt(p.x, p.y - 3);
      if (hb && w.flags.player_home !== hb.id) (w.invites = w.invites || {})[hb.id] = G.effects.now() + 720;
      const protectedSex = p.inventory.has('condom');
      if (protectedSex) p.inventory.remove('condom', 1);
      this.conceive(w, 'player', npc.id, protectedSex ? 0.02 : this.CHANCE);
      (w.affairs = w.affairs || []).push({ with: npc.id, day: w.day, known: {} });
      w.log(`You spent an intimate hour with ${w.displayName(npc.id)}.${protectedSex ? ' (Protected.)' : ''}`, 'good');
      G.events.emit('xp', 10, 'Romance');
      npc.say(score >= 0.8 ? G.rng.pick(['Wow. Just... wow.', 'Where did THAT come from?', 'We are doing that again. Soon.']) : score >= 0.45 ? G.rng.pick(['That was nice.', 'We should do that again.', 'Do not be a stranger.']) : G.rng.pick(['Well... that happened.', 'We will get better at that. Probably.', 'Hm. Okay.']), 4);
    }, 2.4));
    G.scenes.push(new LoveScene(scene, npc));   // the scene plays first, then the fade underneath it
  },

  goHome(scene, npc) {
    const w = scene.world, p = scene.player, d = G.NPCS[npc.id], st = npc.st, mine = w.flags.player_home || 'r_home';
    const homes = [];
    if (d && d.home && G.maps.get(d.map).building(d.home)) homes.push({ map: d.map, b: d.home });
    homes.push({ map: 'rural', b: mine });
    const inB = scene.map.buildingAt(p.x, p.y - 3);
    if (inB && homes.some((h) => h.map === scene.map.id && h.b === inB.id)) return false;
    const h = homes.find((x) => x.map === scene.map.id) || homes[0];
    const m = G.maps.get(h.map), bed = m.points[h.b + '_bed'] || m.points[h.b + '_in'];
    if (!bed) return false;
    const pos = { x: bed.x * 16 + 8, y: (bed.y + 1) * 16 + 12 };
    if (h.map !== scene.map.id) { st.map = h.map; st.trip = null; st.comingTo = null; scene.loadMap(h.map, null, pos); }
    else { p.x = pos.x; p.y = pos.y; }
    const sp = G.everyday && G.everyday.freeSpot(scene.map, p.x, p.y, p.w, p.h);
    if (sp) { p.x = sp.x; p.y = sp.y; }
    if (!scene.actors.some((a) => a.id === npc.id)) scene.syncPresence();
    const a = scene.actors.find((x) => x.id === npc.id);
    if (a) { const t = G.companions.besidePlayer(scene); a.x = t.x; a.y = t.y; a.path = null; a.sleeping = false; a.needTask = null; a.loveTask = null; a.holdT = 25; a.faceTowards(p); }
    w.log(`You woke up together at ${h.b === mine && h.map === 'rural' ? 'your place' : w.displayName(npc.id) + "'s place"}.`, 'info');
    return true;
  },

  // ---------------- jealousy: who finds out, and how they take it ----------------
  daily(w) {
    const affairs = (w.affairs = (w.affairs || []).filter((a) => w.day - a.day <= 10 && w.isAlive(a.with)));
    const partner = G.romance.partner(w);
    for (const a of affairs) {
      const lover = a.with, lmap = w.npcs[lover].map || G.NPCS[lover].map;
      const people = new Set();
      if (partner && partner !== lover) people.add(partner);
      for (const id in w.npcs) if (id !== lover && w.npcs[id].alive && (w.npcs[id].romance || 0) >= 40 && G.NPCS[id]) people.add(id);
      const sp = this.spouseOf(w, lover); if (sp) people.add(sp);
      if (w.npcs[lover].lover && w.isAlive(w.npcs[lover].lover)) people.add(w.npcs[lover].lover);
      for (const j of people) {
        if (a.known[j]) continue;
        const near = (w.npcs[j].map || G.NPCS[j].map) === lmap, close = G.NPCS[j].relations[lover] || G.NPCS[lover].relations[j];
        if (!G.rng.chance(0.12 + (near ? 0.18 : 0) + (close ? 0.25 : 0))) continue;
        a.known[j] = true;
        this.react(w, j, lover, j === partner, j === sp || j === w.npcs[lover].lover);
      }
    }
  },
  react(w, j, lover, isPartner, isTheirSpouse) {
    const st = w.npcs[j], J = this.jealousy(j), who = w.displayName(lover);
    let text;
    if (isTheirSpouse) {
      G.social.adjust(w, j, lover, -45);
      if (J < 0.3) text = `I know about you and ${who}. Honestly? We have an arrangement. Just do not make it weird.`;
      else {
        G.social.addDisp(w, j, -45);
        text = G.rng.pick([`You slept with ${who}. You think I would not find out?`, `Stay away from ${who}. I mean it.`]);
        if (J >= 0.7 && G.NPCS[j].combat !== 'flee') { st.hostile = true; text = `You slept with ${who}. Next time I see you, you are DEAD.`; }
      }
    } else if (isPartner) {
      if (J < 0.3) { st.romance = Math.max(0, (st.romance || 0) - 5); text = `So, you and ${who}. Whatever. We are cool, I guess. Just be careful.`; }
      else if (J < 0.65 && G.rng.chance(0.5)) { st.romance = Math.max(0, (st.romance || 0) - 30); G.social.addDisp(w, j, -20); text = `How could you? With ${who}?! I need some time.`; }
      else {
        st.partner = false; st.romance = 0; G.social.addDisp(w, j, -45);
        text = `We are DONE. I hope ${who} was worth it.`;
        if (J >= 0.85 && G.NPCS[j].combat !== 'flee') st.hostile = true;
        w.log(`${w.displayName(j)} broke up with you after finding out about ${who}.`, 'bad');
      }
    } else {
      if (J < 0.35) return;   // a crush who shrugs it off
      st.romance = Math.max(0, (st.romance || 0) - 20); G.social.addDisp(w, j, -8);
      text = G.rng.pick([`So you and ${who}, huh. Great. Just great.`, `I heard about you and ${who}. Forget I ever liked you.`]);
    }
    w.log(`${w.displayName(j)} found out about you and ${who}.`, 'warn');
    if (G.phone.isContact(w, j)) G.phone.queue(w, j, text, G.rng.int(10, 120));
    else st.loveNote = text;
  },

  // ---------------- pregnancy & birth ----------------
  hourly(scene) {
    const w = scene.world, p = scene.player;
    if (p.preg && !p.dead) {
      const pr = p.preg, d = this.days(pr, w);
      if (!pr.known && d >= 3) { pr.known = true; w.log('Morning sickness, a missed period... you are pregnant.', 'quest'); scene.toast('You are pregnant.', 'warn'); }
      if (d < 14 && w.hour >= 6 && w.hour <= 10 && G.rng.chance(0.3)) G.effects.add(p, 'nausea', 45);
      p.hunger = Math.min(100, (p.hunger || 0) + (d >= 28 ? 2 : d >= 14 ? 1 : 0));
      if (d >= this.PREG_DAYS && pr.labor == null) { pr.labor = 0; G.effects.add(p, 'labor', 99999); scene.toast('Your water broke! The baby is coming.', 'bad'); w.log('You went into labor.', 'quest'); }
      else if (pr.labor != null && ++pr.labor >= 3) this.birth(scene, 'player');
      if (p.preg && p.bellyShown !== this.belly(p.preg)) { p.bellyShown = this.belly(p.preg); p.refreshSprite(); }
    }
    for (const id in w.npcs) {
      const st = w.npcs[id], pr = st.preg;
      if (!pr || !st.alive) continue;
      const d = this.days(pr, w);
      if (!pr.known && d >= 4 && pr.father === 'player') {
        pr.known = true;
        const text = G.rng.pick(['I need to tell you something. I am pregnant. It is yours.', 'Can we talk? I took a test. I am pregnant. With your baby.']);
        if (!G.phone.isContact(w, id)) G.phone.contacts(w).push(id);   // she has your number
        G.phone.queue(w, id, text, 5);
        w.log(`${w.displayName(id)} is pregnant with your child.`, 'quest');
      }
      if (pr.father === 'player' && d >= this.PREG_DAYS - 0.4 && !pr.laborTexted) { pr.laborTexted = true; G.phone.queue(w, id, 'My water broke!! The baby is coming!', 1); }
      if (d >= this.PREG_DAYS) this.birth(scene, id);
    }
  },
  birth(scene, mother) {
    const w = scene.world, p = scene.player;
    const preg = mother === 'player' ? p.preg : w.npcs[mother].preg;
    const father = preg.father, mine = mother === 'player' || father === 'player';
    const sex = G.rng.chance(0.5) ? 'f' : 'm';
    const baby = { id: 'baby' + ((w.babies = w.babies || []).length + 1), sex, mother, father, born: w.day, name: null, sickly: preg.harm >= 3 };
    const home = mine ? { map: 'rural', b: w.flags.player_home } : { map: G.NPCS[mother].map, b: G.NPCS[mother].home };
    baby.crib = home.b ? this.placeCrib(w, home.map, home.b) : null;
    w.babies.push(baby);
    const nameOf = (id) => (id === 'player' ? 'you' : w.displayName(id));
    if (mother === 'player') {
      p.preg = null; p.bellyShown = 0;
      G.effects.remove(p, 'labor');
      G.effects.add(p, 'postpartum', 900);
      p.hp = Math.max(1, Math.min(p.hp, p.maxHp * 0.4)); p.stamina = 0;
      p.refreshSprite();
    } else w.npcs[mother].preg = null;
    if (!mine) {
      baby.name = G.randomName(G.rng, sex === 'f' ? 'female' : 'male').split(' ')[0];
      w.rumor(`${w.displayName(mother)} had a baby ${sex === 'f' ? 'girl' : 'boy'}. They named ${sex === 'f' ? 'her' : 'him'} ${baby.name}.`, G.maps.get(G.NPCS[mother].map).meta.region);
      return baby;
    }
    const kind = sex === 'f' ? 'girl' : 'boy';
    if (mother !== 'player') G.phone.queue(w, mother, `It is a ${kind}! ${sex === 'f' ? 'She' : 'He'} is perfect. Come see us. The crib is at your place.`, 1);
    const ask = () => G.scenes.push(new NameBabyScene(baby, (name) => {
      baby.name = name;
      w.log(`Your ${kind}, ${name}, was born (with ${mother === 'player' ? nameOf(father) : nameOf(mother)}).${baby.sickly ? ' Born small and sickly: the drinking and drugs took their toll.' : ''}`, 'quest');
      G.audio.play('quest');
    }));
    if (mother === 'player') G.scenes.push(new G.FadeScene(ask, 2.5)); else ask();
    return baby;
  },
  // A crib in a free corner of the house (top row first, never in front of the door).
  placeCrib(w, mapId, bid) {
    const map = G.maps.get(mapId), b = map.building(bid);
    if (!b) return null;
    const pts = new Set(Object.values(map.points).filter((q) => q && !Array.isArray(q)).map((q) => q.x + ',' + q.y));
    for (let ty = b.y + 1; ty <= b.y + b.h - 3; ty++) {
      for (let tx = b.x + 1; tx <= b.x + b.w - 2; tx++) {
        if (map.isSolidTile(tx, ty) || map.decorsAt(tx, ty).length || pts.has(tx + ',' + ty) || map.isSolidTile(tx, ty + 1)) continue;
        if (![[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => map.isSolidTile(tx + dx, ty + dy))) continue;   // against a wall or furniture, not in the middle of the room
        const d = map.addDecorRuntime('crib', tx, ty);
        w.modsFor(mapId).added[map.decorKey(d)] = ['crib', tx, ty, w.day];
        return { map: mapId, tx, ty };
      }
    }
    return null;
  },
  babyAt(w, mapId, tx, ty) { return (w.babies || []).find((b) => b.crib && b.crib.map === mapId && b.crib.tx === tx && b.crib.ty === ty) || null; },
  useCrib(d, scene) {
    const w = scene.world, baby = this.babyAt(w, scene.map.id, d.tx, d.ty);
    if (!baby) { scene.toast('An empty crib.'); return; }
    const par = [baby.mother, baby.father].map((id) => (id === 'player' ? 'you' : w.displayName(id))).join(' and ');
    const age = w.day - baby.born, mine = baby.mother === 'player' || baby.father === 'player';
    const mood = w.isNight() ? 'sleeping peacefully' : G.rng.pick(['babbling at the ceiling', 'chewing on a toy', 'staring at you very seriously', 'fast asleep', 'kicking the blanket off']);
    G.scenes.push(new G.MessageScene(`${baby.name || 'The baby'} (${baby.sex === 'f' ? 'girl' : 'boy'}, ${G.util.plural(age, 'day')} old) is ${mood}.${baby.sickly ? ' Small for their age.' : ''} Parents: ${par}.`, mine ? 'Your child' : 'A baby'));
    if (mine && G.usables.once(scene, d, 'crib')) G.effects.add(scene.player, 'family', 300);
  },

  // ---------------- NPC couples ----------------
  interval(id) { return 1 + (G.util.hashString('libido' + id) % 3); },   // every 1-3 days
  update(npc, dt, scene) {
    const st = npc.st, w = scene.world;
    if ((npc.loveRefreshT = (npc.loveRefreshT || 0) - dt) <= 0) { npc.loveRefreshT = 1; this.refreshNPC(npc); }
    if (st.loveNote && npc.state === 'schedule' && npc.canSee(scene, scene.player, 70)) { npc.say(st.loveNote, 5); st.loveNote = null; }
    const t = npc.loveTask;
    if (!t) {
      if (npc.state !== 'schedule' || npc.needTask || npc.transient) return false;
      if ((npc.loveScanT = (npc.loveScanT == null ? G.rng.range(1, 6) : npc.loveScanT) - dt) > 0) return false;
      npc.loveScanT = 5;
      this.tryStart(npc, scene);
      return !!npc.loveTask;
    }
    const mate = t.mate;
    if (npc.state !== 'schedule' || mate.dead || !mate.loveTask || mate.state !== 'schedule') { this.stop(npc); return false; }
    npc.sleeping = false;
    if (t.phase === 'go') {
      const there = npc.arrived(t.spot) || (!t.lead && G.util.dist(npc.x, npc.y, t.spot.x * 16 + 8, t.spot.y * 16 + 12) < 24);
      if (!there) {
        if ((t.walk += dt) > 60) { this.stop(npc); this.stop(mate); return false; }
        npc.walkTo(t.spot, dt, scene);
        return true;
      }
      npc.moving = false; t.ready = true;
      if (t.lead && mate.loveTask.ready) { t.phase = mate.loveTask.phase = 'act'; t.t = 0; }
      return true;
    }
    npc.moving = false;
    if (!t.lead) return true;
    t.t += dt;
    const p = scene.player;
    if (!p.dead && p.distTo(npc) < 120 && scene.map.buildingAt(p.x, p.y - 3) === scene.map.buildingAt(npc.x, npc.y - 3)) { this.caught(scene, npc, mate); return true; }
    if (t.t >= 35) {
      this.conceive(w, npc.id, mate.id, this.NPC_CHANCE);
      this.stop(npc); this.stop(mate);
    }
    return true;
  },
  tryStart(npc, scene) {
    const w = scene.world, h = w.hourF, st = npc.st;
    if (!(h >= 21.5 || h < 1)) return;
    const oid = this.partnerOf(w, npc.id);
    if (!oid || (st.loveDay != null && w.day - st.loveDay < this.interval(npc.id))) return;
    const mate = scene.actors.find((a) => a.id === oid && !a.dead);
    if (!mate || mate.loveTask || mate.needTask || mate.state !== 'schedule' || mate.talking) return;
    const map = scene.map, home = npc.def.home && map.building(npc.def.home);
    if (!home || w.isHomeLost(npc.def)) return;
    // their own bed: where they sleep, if that is in this house; any bed in the house otherwise
    const se = npc.scheduleList().find((e) => e.act === 'sleep');
    let spot = se && npc.resolvePoint(map, se.at);
    if (!spot || Array.isArray(spot) || map.buildingAtTile(spot.x, spot.y) !== home) {
      const bed = map.decor.find((d) => d.def.interact === 'bed' && map.buildingAtTile(d.tx, d.ty) === home);
      if (!bed) return;
      spot = { x: bed.tx, y: bed.ty };
    }
    const bed = spot; spot = npc.approach(map, spot);   // beds are solid: get in from the side
    st.loveDay = mate.st.loveDay = w.day;
    npc.loveTask = { lead: true, mate, spot, bed, phase: 'go', t: 0, walk: 0 };
    mate.loveTask = { lead: false, mate: npc, spot, bed, phase: 'go', t: 0, walk: 0 };
  },
  stop(npc) { npc.loveTask = null; },
  caught(scene, a, b) {
    const w = scene.world, p = scene.player, until = this.now() + 120;
    for (const n of [a, b]) { n.loveTask = null; n.st.nakedUntil = until; n.sleeping = false; this.refreshNPC(n); }
    b.x += 10;
    const cheating = a.st.lover === b.id && (this.married(w, a.id) || this.married(w, b.id));
    w.log(`You walked in on ${w.displayName(a.id)} and ${w.displayName(b.id)}.`, 'warn');
    for (const n of [a, b]) {
      const P = G.social.persona(n.id);
      G.social.addDisp(w, n.id, -15);
      const fighter = n.def.combat !== 'flee' && (['proud', 'grumpy', 'suspicious'].includes(P.trait) || G.rng.chance(0.35));
      if (fighter) {
        n.say(G.rng.pick(['GET OUT!', 'Are you kidding me?! You are dead!', 'You like to watch, huh? Come here!']), 3);
        n.aggressor = true;
        n.startFight(p, scene);
      } else {
        n.say(cheating ? 'Please... do not tell anyone!' : G.rng.pick(['AAAH! Do not look!', 'Ever heard of KNOCKING?!', 'Oh my god! Get OUT!', 'Pervert!']), 3);
        n.st.fear = Math.max(n.st.fear || 0, 70);
        n.startFlee(p);
      }
    }
  },
  // Naked (caught in the act) and pregnant bellies change how people look.
  refreshNPC(npc) {
    const st = npc.st, belly = this.belly(st.preg), naked = (st.nakedUntil || 0) > this.now();
    const key = belly + (naked ? 'n' : '');
    if (npc.loveKey === key) return;
    if (npc.loveKey === undefined && key === '0') { npc.loveKey = key; return; }
    npc.loveKey = key;
    npc.sheet = G.assets.character(Object.assign({}, npc.look, belly ? { belly } : {}, naked ? { naked: true } : {}));
  },
  // Off-screen couples (and the singles who become lovers).
  hourlyCouples(scene) {
    const w = scene.world;
    if (w.hour !== 23) return;
    for (const id in w.npcs) {
      const st = w.npcs[id];
      if (!st.alive || !G.NPCS[id] || G.NPCS[id].transient) continue;
      const o = this.partnerOf(w, id);
      if (!o || o < id) continue;
      if ((st.map || G.NPCS[id].map) === scene.map.id || (w.npcs[o].map || G.NPCS[o].map) === scene.map.id) continue;   // on screen: they do it for real
      if (st.loveDay != null && w.day - st.loveDay < this.interval(id)) continue;
      st.loveDay = w.npcs[o].loveDay = w.day;
      this.conceive(w, id, o, this.NPC_CHANCE);
    }
  },
  findLovers(w) {
    const singles = Object.keys(w.npcs).filter((id) => {
      const st = w.npcs[id], d = G.NPCS[id];
      return d && !d.transient && !d.kid && st.alive && !st.lover && !st.partner && !this.spouseOf(w, id) && d.combat !== 'guard' && d.home;
    });
    for (let i = 0; i < singles.length; i++) for (let k = i + 1; k < singles.length; k++) {
      const a = singles[i], b = singles[k];
      if (w.npcs[a].lover || w.npcs[b].lover || G.NPCS[a].map !== G.NPCS[b].map) continue;
      if (G.social.opinion(w, a, b) < 40 || G.social.opinion(w, b, a) < 40 || !G.rng.chance(0.04)) continue;
      w.npcs[a].lover = b; w.npcs[b].lover = a;
    }
  },

  // ---------------- drawing ----------------
  hearts(ctx, x, y) {
    for (let i = 0; i < 3; i++) {
      const ph = (G.loop.time * 0.7 + i / 3) % 1;
      const hx = Math.round(x + Math.sin((ph + i) * 6) * 4), hy = Math.round(y - ph * 18);
      ctx.globalAlpha = 1 - ph;
      ctx.fillStyle = '#ff5a8a';
      ctx.fillRect(hx - 2, hy, 2, 2); ctx.fillRect(hx + 1, hy, 2, 2); ctx.fillRect(hx - 2, hy + 1, 5, 2); ctx.fillRect(hx - 1, hy + 3, 3, 1); ctx.fillRect(hx, hy + 4, 1, 1);
    }
    ctx.globalAlpha = 1;
  },
  drawAct(ctx, a) {
    const b = a.loveTask.mate, map = G.maps.cache[a.st.map || a.def.map], sp = a.loveTask.bed || a.loveTask.spot;
    const bed = map && [map.decorsAt(sp.x, sp.y), map.decorsAt(sp.x, sp.y - 1), map.decorsAt(sp.x, sp.y + 1)].flat().find((d) => d.def.interact === 'bed');
    const cx = bed ? bed.x : sp.x * 16 + 8, top = bed ? Math.round(bed.y - G.assets.sprites[bed.def.sprite].ay) : sp.y * 16 - 4;
    const bob = Math.round(Math.sin(G.loop.time * 9));
    for (const [n, dx] of [[a, -4], [b, 4]]) ctx.drawImage(n.sheet.img, 0, 0, n.sheet.fw, 9, Math.round(cx - n.sheet.fw / 2 + dx), top + (n === a ? bob : 0), n.sheet.fw, 9);
    const col = bed ? ({ bed: '#4a6aa8', bed_red: '#a84a4a', bed_green: '#4a8a5a' }[bed.def.sprite] || '#6a6a8a') : '#8a7a9a';
    const bw = bed ? G.assets.sprites[bed.def.sprite].img.width : 18;
    ctx.fillStyle = col; ctx.fillRect(Math.round(cx - bw / 2) + 1, top + 7 + bob, bw - 2, 14);
    ctx.fillStyle = G.assets.shade(col, 1.25); ctx.fillRect(Math.round(cx - bw / 2) + 1, top + 7 + bob, bw - 2, 1);
    ctx.fillStyle = G.assets.shade(col, 0.8); ctx.fillRect(Math.round(cx - bw / 2) + 3, top + 12 - bob, bw - 6, 2);
    this.hearts(ctx, cx, top - 4);
  },

  // ---------------- animals ----------------
  // Called by animals that are fed and watered. Returns true while busy with a mate.
  animal(a, dt, scene) {
    const w = scene.world;
    if (a.hunger >= 70 || a.thirst >= 70) {   // hunger and thirst come first
      if (a.mate && a.mate.mate === a) { a.mate.mate = null; a.mate.mateT = 0; }
      a.mate = null; a.mateT = 0;
      return false;
    }
    if (a.mateT > 0) {
      a.mateT -= dt; a.moving = false;
      if (a.mateT <= 0) {
        a.mateNext = this.now() + 60 * 24 * 2;
        if (a.sex === 'f') { const pop = w.wildlife[a.zoneKey]; if (pop) (pop.preg = pop.preg || []).push(w.day + (this.GESTATION[a.species] || 3)); }
        a.mate = null;
      }
      return true;
    }
    if (a.mate) {
      const m = a.mate;
      if (m.dead || m.mate !== a || a.distTo(m) > 200) { a.mate = null; return false; }
      const d = a.distTo(m);
      if (d < 10) { a.mateT = m.mateT = 6; a.face(m.x - a.x, 0); return true; }
      a.go((m.x - a.x) / d, (m.y - a.y) / d, a.walkSpeed * 1.2, dt, scene);
      return true;
    }
    if ((a.mateScanT = (a.mateScanT == null ? G.rng.range(5, 20) : a.mateScanT) - dt) > 0) return false;
    a.mateScanT = G.rng.range(15, 30);
    if ((a.mateNext || 0) > this.now() || !G.rng.chance(0.4)) return false;
    const pop = w.wildlife[a.zoneKey];
    if (pop && pop.count + (pop.preg || []).length >= Math.ceil(pop.max * 1.5)) return false;
    const m = scene.actors.find((o) => o.kind === 'animal' && !o.dead && o.species === a.species && o.sex !== a.sex && !o.mate && (o.mateNext || 0) <= this.now() && o.state === 'wander' && o.distTo(a) < 140);
    if (!m) return false;
    a.mate = m; m.mate = a;
    return true;
  },
  animalBirths(scene) {
    const w = scene.world;
    for (const key in w.wildlife) {
      const pop = w.wildlife[key];
      if (!pop.preg || !pop.preg.length) continue;
      const due = pop.preg.filter((d) => d <= w.day);
      if (!due.length) continue;
      pop.preg = pop.preg.filter((d) => d > w.day);
      for (let i = 0; i < due.length; i++) {
        const [lo, hi] = this.LITTER[pop.kind] || [1, 1], n = Math.min(G.rng.int(lo, hi), Math.ceil(pop.max * 1.5) - pop.count);
        if (n <= 0) continue;
        pop.count += n;
        if (pop.map !== scene.map.id) continue;
        const zi = Number(key.split(':')[1]), zone = scene.map.animalZones[zi];
        const mom = scene.actors.find((o) => o.kind === 'animal' && !o.dead && o.zoneKey === key && o.sex === 'f');
        for (let k = 0; k < n && zone; k++) {
          const x = mom ? mom.x + G.rng.range(-8, 8) : (zone.x + zone.w / 2) * 16, y = mom ? mom.y + G.rng.range(-4, 4) : (zone.y + zone.h / 2) * 16;
          const baby = new G.Animal(pop.kind, x, y, key, Object.assign({ region: scene.map.meta.region }, zone));
          baby.young = true;
          baby.name = 'Young ' + baby.name.toLowerCase();
          scene.actors.push(baby);
        }
      }
    }
  },
};

// ---------------- naming your baby ----------------
// ---------------------------------------------------------------- the love scene (suggestive, never explicit)
// A private room, lights low: the two of them under the sheets, clothes on the floor, a lamp, some hearts.
class LoveScene {
  constructor(game, npc) {
    this.game = game; this.npc = npc; this.t = 0;
    this.lines = [G.rng.pick(['The door is locked. The lights are low.', 'Somewhere private, finally.']), G.rng.pick(['...', 'Nobody else in the world.']), G.rng.pick(['Later.', 'Much later.'])];
    G.audio.play('sleep');
    // the minigame: find each other's rhythm. A ring pulses out from the heart; tap [Space] or [E] when it
    // meets the outer ring. Their pace depends on who they are. ([Esc] skips it: an ordinary night.)
    const P = G.social.persona(npc.id);
    this.beat = { nervous: 1.35, tired: 1.4, friendly: 1.15, cheerful: 1.0, chatty: 0.95, proud: 1.05, grumpy: 1.2, suspicious: 1.25 }[P.trait] || 1.15;
    this.conn = 0.35; this.beats = 0; this.phase = 0; this.tapped = false; this.flash = 0; this.LEN = 11;
    G.love.lastScore = null;
  }
  finish() { G.love.lastScore = this.skipped ? 0.5 : G.util.clamp(this.conn, 0, 1); G.scenes.remove(this); }
  update(dt) {
    this.t += dt;
    const I = G.input;
    if (I.wasPressed('cancel')) { this.skipped = true; this.finish(); return; }
    if (this.t > this.LEN + 1.4) { this.finish(); return; }
    if (this.t > this.LEN) return;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.phase += dt / this.beat;
    if (this.phase >= 1) {
      this.phase -= 1; this.beats++;
      if (!this.tapped) this.conn -= 0.05;
      this.tapped = false;
      if (this.beats % 3 === 0) this.beat = G.util.clamp(this.beat * G.rng.range(0.92, 1.06), 0.8, 1.5);
    }
    if ((I.wasPressed('confirm') || I.wasPressed('attack') || I.pressed.has('Space')) && !this.tapped) {
      this.tapped = true;
      const off = Math.min(this.phase, 1 - this.phase);   // how far from the beat
      if (this.phase > 0.8 || off < 0.12) { this.conn += off < 0.06 ? 0.11 : 0.07; this.flash = 1; G.audio.play('select'); }
      else { this.conn -= 0.07; G.audio.play('back'); }
    }
    this.conn = G.util.clamp(this.conn, 0, 1);
  }
  render(ctx) {
    const R = G.renderer, A = G.assets, k = Math.max(2, Math.floor(Math.min(R.W / 160, R.H / 100)));
    R.screenTransform();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c080c'; ctx.fillRect(0, 0, R.W, R.H);
    const cx = R.W / 2, cy = R.H / 2;
    // floor and wall
    const fl = A.tile('woodfloor', 0), wl = A.tile('wall_inner', 0) || A.tile('wall_plaster', 0);
    for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) ctx.drawImage(y === -3 ? wl : fl, cx + x * 16 * k - 8 * k, cy + y * 16 * k - 8 * k, 16 * k, 16 * k);
    // the bed
    const bed = A.sprites.bed_double;
    const bw = bed.w * k * 1.6, bh = bed.h * k * 1.6, bx = cx - bw / 2, by = cy - bh / 2 - 10 * k;
    // the bed rocks with the rhythm, more when you are in sync; the two of you lean closer
    const sync = this.conn, bob = Math.sin(this.phase * Math.PI * 2) * k * (0.4 + sync * 0.8);
    ctx.drawImage(bed.img, bx, by + bob * 0.3, bw, bh);
    const heads = [this.game.player.sheet, this.npc.sheet];
    heads.forEach((s, i) => {
      const close = (i ? -1 : 1) * sync * 3 * k;
      const hx = cx + (i ? 3 : -15) * k * 1.6 + close, hy = by + 2 * k * 1.6 + (i ? -bob * 0.3 : bob * 0.5);
      ctx.drawImage(s.img, 0, 0, s.fw, 9, hx, hy, s.fw * k * 1.6, 9 * k * 1.6);
      ctx.fillStyle = (i ? this.npc.look.skin : this.game.player.look.skin) || '#e0b088';   // bare shoulders
      ctx.fillRect(hx + 3 * k * 1.6, hy + 9 * k * 1.6, 10 * k * 1.6, 2 * k * 1.6);
    });
    ctx.fillStyle = '#7a5aa0';   // the sheets
    ctx.fillRect(bx + k * 1.6, by + 13 * k * 1.6 + bob, bw - 2 * k * 1.6, bh - 14 * k * 1.6);
    ctx.fillStyle = '#9a7ac0'; ctx.fillRect(bx + k * 1.6, by + 13 * k * 1.6 + bob, bw - 2 * k * 1.6, k * 1.6);
    ctx.fillStyle = '#5a3a80'; ctx.fillRect(bx + 8 * k, by + 18 * k * 1.6 - bob, bw - 16 * k, 2 * k);
    // clothes on the floor
    const pl = this.game.player.currentLook(), nl = this.npc.look;
    [[pl.shirt, -60, 30], [pl.pants, -40, 42], [nl.shirt, 45, 34], [nl.pants || '#4a3a2a', 62, 46], ['#2a1e14', -70, 50], ['#2a1e14', 70, 54]].forEach(([c, ox, oy], i) => {
      ctx.fillStyle = c || '#888'; ctx.save(); ctx.translate(cx + ox * k, cy + oy * k); ctx.rotate((i * 0.7) % 1.2 - 0.6); ctx.fillRect(-5 * k, -3 * k, (i > 3 ? 5 : 11) * k, (i > 3 ? 3 : 6) * k); ctx.restore();
    });
    // the lamp: warm, dim light
    const lamp = A.sprites.nightstand;
    ctx.drawImage(lamp.img, bx + bw + 4 * k, by + 4 * k, lamp.w * k * 1.6, lamp.h * k * 1.6);
    const g = ctx.createRadialGradient(cx, cy - 10 * k, 20 * k, cx, cy, Math.max(R.W, R.H) * 0.6);
    g.addColorStop(0, 'rgba(255,170,90,0.08)'); g.addColorStop(1, 'rgba(10,0,8,0.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
    G.love.hearts(ctx, cx, by - 4 * k);
    G.love.hearts(ctx, cx + 20 * k, by + 4 * k);
    // the rhythm: a heart with a ring pulsing out; tap when it reaches the outer ring
    R.uiTransform();
    const U = G.ui, hx = R.uiW / 2, hy = R.uiH - 70, outer = 22;
    if (this.t < this.LEN) {
      ctx.strokeStyle = 'rgba(255,170,200,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, outer, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = this.flash > 0 ? `rgba(255,240,250,${0.5 + this.flash * 0.5})` : 'rgba(255,120,170,0.9)';
      ctx.beginPath(); ctx.arc(hx, hy, 4 + this.phase * (outer - 4), 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
      G.love.hearts(ctx, hx, hy + 3);
      const bw = 140, bx2 = hx - bw / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx2, hy + 30, bw, 5);
      ctx.fillStyle = '#ff7ab0'; ctx.fillRect(bx2, hy + 30, bw * this.conn, 5);
      U.text(ctx, 'Connection', hx, hy + 37, { size: 7, align: 'center', color: '#f4c8dc' });
      U.text(ctx, 'Keep the rhythm', hx, hy + 47, { size: 7, align: 'center', color: '#a88a98' });
    }
    const seg = this.LEN / 3, li = Math.min(this.lines.length - 1, Math.floor(this.t / seg));
    ctx.globalAlpha = Math.min(1, (this.t % seg) * 2);
    U.text(ctx, this.lines[li], R.uiW / 2, 30, { align: 'center', size: 11, color: '#f4dce8' });
    ctx.globalAlpha = 1;
    if (this.t > this.LEN - 0.4) { R.screenTransform(); ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (this.t - this.LEN + 0.4) / 1.2)})`; ctx.fillRect(0, 0, R.W, R.H); }
  }
}
G.LoveScene = LoveScene;

class NameBabyScene {
  constructor(baby, done) {
    this.transparent = true;
    this.baby = baby; this.done = done;
    this.input = G.randomName(G.rng, baby.sex === 'f' ? 'female' : 'male').split(' ')[0];
  }
  update() {
    const I = G.input;
    for (const ch of I.typed) if (this.input.length < 16 && /[\w '-]/.test(ch)) this.input += ch;
    if (I.pressed.has('Backspace')) this.input = this.input.slice(0, -1);
    if (I.pressed.has('Enter') && this.input.trim()) { G.scenes.remove(this); this.done(this.input.trim()); }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer;
    U.dim(ctx, 0.55);
    const w = 260, h = 96, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: `It's a ${this.baby.sex === 'f' ? 'girl' : 'boy'}!`, titleSize: 13 });
    U.text(ctx, 'What will you name your baby?', R.uiW / 2, y + 28, { align: 'center', size: 9 });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 30, y + 44, w - 60, 18);
    U.text(ctx, this.input + (Math.floor(G.loop.time * 2) % 2 ? '|' : ''), R.uiW / 2, y + 48, { align: 'center', size: 10, color: '#ffe8f0' });
    U.text(ctx, 'Type a name', R.uiW / 2, y + h - 16, { align: 'center', size: 7, color: U.colors.dim });
  }
}
G.NameBabyScene = NameBabyScene;

// ---------------- dialogue ----------------
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st;
  if (npc.transient || npc.remote || st.fear >= 60 || !(st.partner || (st.romance || 0) >= 60)) return [];
  return [{ text: '(Make love) Want to go somewhere private?', next: '_love' }];
});
G.DIALOGUE_NODES._love = (r) => {
  const { npc } = r, why = G.love.refusal(r.scene, npc);
  if (why) return { text: why, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
  return {
    text: G.rng.pick(['I thought you would never ask...', 'Mm. Lead the way.', 'Okay. Yes.', 'Finally.']),
    choices: [
      { text: `[Spend the night together]${r.scene.player.inventory.has('condom') ? ' (use a condom)' : ''}`, next: null, do: () => { G.love.withPlayer(r.scene, npc); } },
      { text: 'Actually... not now.', next: 'start' },
    ],
  };
};

// ---------------- crib interaction ----------------
G.usables.LABELS.crib = 'Look in the crib';
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'crib') return G.love.useCrib(d, scene);
  return _use.call(this, d, scene);
};

// ---------------- pregnancy effects on the player ----------------
const _mult = G.effects.mult, _hud = G.effects.hudList, _consume = G.effects.consume;
G.love.statBonus = (p, name) => {
  if (!p.preg || !G.world) return 0;
  const t = G.love.trimester(p.preg);
  if (name === 'staminaRegen') return t === 2 ? -0.2 : t === 3 ? -0.45 : 0;
  if (name === 'meleeDmg') return t === 3 ? -0.15 : 0;
  return 0;
};
G.effects.mult = function (p, key) {
  let m = _mult.call(this, p, key);
  if (key === 'speed' && p.preg && G.world) m *= [1, 1, 0.95, 0.85][G.love.trimester(p.preg)];
  return m;
};
G.effects.hudList = function (p) {
  const out = _hud.call(this, p);
  if (p.preg && p.preg.known && G.world) out.unshift({ name: `Pregnant (week ${Math.floor(G.love.days(p.preg, G.world))})`, color: '#f08ab0', t: null });
  return out;
};
G.effects.consume = function (p, it, scene) {
  if (p.preg && (it.drug || it.alcohol)) {
    p.preg.harm = (p.preg.harm || 0) + 1;
    if (p.preg.known && scene) scene.toast('That is not good for the baby.', 'bad');
  }
  return _consume.call(this, p, it, scene);
};

G.events.on('hour', () => {
  const scene = G.love.scene();
  if (!G.world || !scene) return;
  G.love.hourly(scene);
  G.love.hourlyCouples(scene);
  G.love.animalBirths(scene);
});
G.events.on('newDay', () => {
  if (!G.world) return;
  G.love.daily(G.world);
  G.love.findLovers(G.world);
});
