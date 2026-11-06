'use strict';
// Status effects on the player: alcohol intoxication, drug highs and comedowns, poison, nausea,
// overdoses and blackouts. Definitions are in js/data/effects.js.
// player.effects = [{ id, t (seconds left), dur, power }]   player.alcohol 0..100+
// player.drugs = { load, tol, addiction, lastUse } per drug class (G.DRUG_CLASSES)

G.effects = {
  get(p, id) { return p.effects.find((e) => e.id === id) || null; },
  has(p, id) { return !!this.get(p, id); },

  add(p, id, secs, power = 1) {
    const def = G.EFFECTS[id];
    if (!def) return;
    const mastery = G.skills.stat(p, 'drugMastery');
    if (def.kind === 'drug') secs *= def.bad ? Math.max(0.25, 1 - mastery) : 1 + mastery;
    if (def.kind === 'poison') { const r = G.util.clamp(G.skills.stat(p, 'poisonResist'), 0, 0.8); secs *= 1 - r * 0.5; power *= 1 - r; }
    const e = this.get(p, id);
    if (e) { e.t = Math.max(e.t, secs); e.dur = Math.max(e.dur, e.t); e.power = Math.max(e.power, power); }
    else p.effects.push({ id, t: secs, dur: secs, power });
  },

  remove(p, id) { p.effects = p.effects.filter((e) => e.id !== id); },

  intoxLevel(p) {
    let lv = null;
    for (const l of G.INTOX_LEVELS) if (p.alcohol >= l.min) lv = l;
    return lv;
  },

  // Sum of a stat from effects and intoxication. Liquid Courage turns booze into charm.
  statBonus(p, name) {
    let v = 0;
    for (const e of p.effects) { const s = G.EFFECTS[e.id].stats; if (s && s[name]) v += s[name]; }
    const lv = this.intoxLevel(p);
    if (lv && lv.stats[name]) {
      let b = lv.stats[name];
      if (name === 'charisma' && G.skills.has(p, 'liquid_courage')) b = lv.name === 'Tipsy' ? 2 : Math.max(0, b);
      v += b;
    }
    return v;
  },

  // Product of a multiplier (speed, dmgTaken) over effects and intoxication.
  mult(p, key) {
    let m = 1;
    for (const e of p.effects) { const d = G.EFFECTS[e.id]; if (d[key]) m *= d[key]; }
    const lv = this.intoxLevel(p);
    if (lv && lv[key]) m *= lv[key];
    return m;
  },

  // Extra gun spread from being drunk/high. Steady Hands halves it.
  spread(p) {
    let s = 0;
    for (const e of p.effects) s += (G.EFFECTS[e.id].spread || 0) * e.power;
    const lv = this.intoxLevel(p);
    if (lv) s += lv.spread;
    return G.skills.has(p, 'steady_hands') ? s / 2 : s;
  },

  // ---------------- drugs: load, tolerance, addiction, withdrawal ----------------
  drugState(p) {
    if (!p.drugs) p.drugs = { load: {}, tol: {}, addiction: {}, lastUse: {} };
    return p.drugs;
  },
  now() { return G.world ? G.world.day * 1440 + G.world.minutes : 0; },
  load(p, cls) { return this.drugState(p).load[cls] || 0; },
  addiction(p, cls) { return this.drugState(p).addiction[cls] || 0; },
  dependent(p, cls) { const c = G.DRUG_CLASSES[cls]; return !!(c && c.dependent != null && this.addiction(p, cls) >= c.dependent); },

  // How close each class is to an overdose, including dangerous combinations:
  //   opioids + alcohol (both depress breathing), cocaine + alcohol (cocaethylene, harder on the heart).
  // Opioid tolerance raises the threshold; it fades when you stay clean.
  risk(p, cls) {
    const s = this.drugState(p), c = G.DRUG_CLASSES[cls];
    if (!c || !c.od) return 0;
    let v = s.load[cls] || 0;
    if (cls === 'opioid') v += p.alcohol * 0.7;
    if (cls === 'stimulant' && p.alcohol > 20) v *= 1.45;
    const threshold = c.od + (cls === 'opioid' ? (s.tol.opioid || 0) * 0.4 : cls === 'stimulant' ? (s.tol.stimulant || 0) * 0.3 : 0);
    return v / threshold;
  },

  takeDrug(p, it, scene) {
    const d = it.drug, s = this.drugState(p);
    const mastery = G.skills.stat(p, 'drugMastery');
    s.load[d.cls] = (s.load[d.cls] || 0) + (d.load || 0) * Math.max(0.4, 1 - mastery * 0.4);
    if (d.addict) s.addiction[d.cls] = Math.min(100, (s.addiction[d.cls] || 0) + d.addict * (1 + (s.addiction[d.cls] || 0) / 100));
    if (d.tol) s.tol[d.cls] = Math.min(90, (s.tol[d.cls] || 0) + d.tol);
    if (!d.relief) s.lastUse[d.cls] = this.now();
    else s.lastUse.opioid_relief = this.now();
    const wd = G.DRUG_CLASSES[d.cls].withdrawal;
    if (wd && this.has(p, wd)) { this.remove(p, wd); if (scene) scene.toast('The craving lets go. For now.', 'info'); }
    // cannabis: occasional paranoia; mixing it with alcohol makes people sick ("cross-faded")
    if (d.cls === 'cannabis' && G.rng.chance(0.15 + s.load.cannabis / 200)) this.add(p, 'paranoia', 40);
    if (d.cls === 'cannabis' && p.alcohol > 45) this.add(p, 'nausea', 30);
  },

  // Eat/drink/take an item.
  consume(p, it, scene) {
    const munch = this.has(p, 'high') && !it.drug && !it.alcohol ? 1.5 : 1;
    const heal = Math.round((it.heal || 0) * (1 + G.skills.stat(p, 'healBonus')) * munch);
    if (heal) p.hp = Math.min(p.maxHp, p.hp + heal);
    if (it.stamina) p.stamina = Math.min(p.maxStamina, p.stamina + it.stamina);
    G.needs.eat(p, it);
    if (it.alcohol) {
      p.alcohol += it.alcohol * Math.max(0.2, 1 - G.skills.stat(p, 'alcoholResist'));
      const s = this.drugState(p);
      s.lastUse.alcohol = this.now();
      if (p.alcohol > 40) s.addiction.alcohol = Math.min(100, (s.addiction.alcohol || 0) + 2.5);   // binge drinking breeds dependence
      if (this.has(p, 'wd_alcohol')) this.remove(p, 'wd_alcohol');
    }
    // naloxone knocks opioids out of the body at once; if you are dependent, withdrawal hits immediately
    if (it.antidote) {
      const s = this.drugState(p);
      s.load[it.antidote] = 0;
      if (this.dependent(p, it.antidote) && scene) { this.add(p, 'wd_opioid', 90); scene.toast('You gasp awake. Instant withdrawal.', 'bad'); }
    }
    for (const id of it.cures || []) this.remove(p, id);
    const tolFactor = it.drug ? Math.max(0.25, 1 - (this.drugState(p).tol[it.drug.cls] || 0) / 120) : 1;
    for (const id in it.effects || {}) {
      const v = it.effects[id];
      const secs = Array.isArray(v) ? v[0] : v, power = Array.isArray(v) ? v[1] : 1;
      // tolerance: weaker highs (psychedelic tolerance builds so fast that a second dose barely works)
      const drugFx = G.EFFECTS[id].kind === 'drug' && !G.EFFECTS[id].bad;
      this.add(p, id, drugFx ? secs * tolFactor : secs, drugFx ? power * (it.drug && it.drug.cls === 'psychedelic' ? tolFactor : 1) : power);
    }
    if (it.drug) this.takeDrug(p, it, scene);
    if (scene) {
      const msg = heal ? '+' + heal : it.alcohol ? '*gulp*' : it.effects ? '...' : '+' + (it.stamina || 0);
      scene.floatText(p.x, p.y - 20, msg, heal ? '#70e070' : '#e0d0a0');
      if (it.cures) scene.toast('You feel the poison leave your body.', 'good');
    }
    if (it.ident && G.world && !G.world.flags['known_' + it.id]) {
      G.world.flags['known_' + it.id] = true;
      if (scene) { scene.toast(`That was a ${G.ITEMS[it.id].name}.${it.effects ? ' Uh oh.' : ''}`, it.effects ? 'warn' : 'good'); G.events.emit('xp', G.XP.identify, 'Identified'); }
    }
    if (it.illegal && scene) scene.reportDrugUse();
  },

  // Once per game hour: tolerance and addiction fade, withdrawal sets in for dependent users.
  hourly(p, scene) {
    const s = this.drugState(p), now = this.now();
    for (const cls in G.DRUG_CLASSES) {
      const c = G.DRUG_CLASSES[cls];
      if (s.tol[cls]) s.tol[cls] = Math.max(0, s.tol[cls] - G.TOLERANCE_DECAY_PER_HOUR);
      const since = (now - (s.lastUse[cls] || -1e9)) / 60;
      if (s.addiction[cls] && since > 2) s.addiction[cls] = Math.max(0, s.addiction[cls] - G.ADDICTION_DECAY_PER_HOUR);
      if (!c.withdrawal || !this.dependent(p, cls) || since < c.after) continue;
      if (cls === 'opioid' && (now - (s.lastUse.opioid_relief || -1e9)) / 60 < 24) continue;   // methadone
      // one bout of withdrawal per relapse: it runs its course (and passes, even while you wait or sleep)
      s.wdFor = s.wdFor || {};
      if (s.wdFor[cls] === (s.lastUse[cls] || 0) || this.has(p, c.withdrawal)) continue;
      s.wdFor[cls] = s.lastUse[cls] || 0;
      const severe = s.addiction[cls] >= 60;
      this.add(p, c.withdrawal, severe ? 3600 : 2400, severe ? 1.5 : 1);
      if (scene && G.rng.chance(0.5)) scene.toast(`You are craving ${c.name.toLowerCase()}${severe ? ' badly' : ''}.`, 'warn');
    }
  },

  update(p, dt0, scene) {
    const dt = G.clock ? G.clock.of(dt0) : dt0;   // (the game clock: js/game/gameclock.js)
    if (p.alcohol > 0) p.alcohol = Math.max(0, p.alcohol - G.ALCOHOL_DECAY * dt);
    const s = this.drugState(p);
    for (const cls in s.load) if (s.load[cls] > 0) s.load[cls] = Math.max(0, s.load[cls] - (G.DRUG_CLASSES[cls].decay || 0.3) * dt);
    // overdoses
    for (const cls of ['opioid', 'stimulant', 'cannabis']) {
      const c = G.DRUG_CLASSES[cls];
      if (this.risk(p, cls) >= 1 && !this.has(p, c.odEffect)) {
        this.add(p, c.odEffect, cls === 'cannabis' ? 60 : cls === 'opioid' ? 30 : 12);
        if (cls !== 'cannabis') { s.load[cls] *= 0.7; G.audio.play('hurt'); }
        scene.toast({ opioid: 'Your breathing slows... and stops. You are overdosing! (Naloxone)', stimulant: 'Your heart is racing out of control. You are overdosing!', cannabis: 'Way too much. The room is spinning.' }[cls], 'bad');
      }
    }
    // alcohol withdrawal can cause seizures
    const shakes = this.get(p, 'wd_alcohol');
    if (shakes && shakes.power > 1 && G.rng.chance(dt / 90)) {
      G.combat.damage(p, 8, null, scene); p.stamina = 0; p.kbx = (Math.random() - 0.5) * 80;
      scene.toast('You have a seizure.', 'bad');
      scene.floatText(p.x, p.y - 20, '-8', '#ff6050');
    }
    const ended = [];
    let dmg = 0, regen = 0;
    for (const e of p.effects) {
      const d = G.EFFECTS[e.id];
      e.t -= dt;
      if (d.dps) dmg += d.dps * e.power * dt;
      if (d.regen) regen += d.regen * dt;
      if (d.vomit && G.rng.chance(dt / 7)) this.vomit(p, scene);
      if (e.t <= 0) ended.push(e);
    }
    for (const e of ended) {
      this.remove(p, e.id);
      const d = G.EFFECTS[e.id];
      if (d.then) this.add(p, d.then[0], d.then[1], e.power);
      if (e.id === 'amatoxin') scene.toast('Your stomach twists violently. Something you ate was poisonous!', 'bad');
      if (e.id === 'overdose' || e.id === 'resp_depression') scene.passOut('overdose');
    }
    if (regen) p.hp = Math.min(p.maxHp, p.hp + regen);
    if (dmg > 0) {
      p.poisonAcc = (p.poisonAcc || 0) + dmg;
      if (p.poisonAcc >= 1) {
        const n = Math.floor(p.poisonAcc);
        p.poisonAcc -= n;
        p.hp -= n;
        p.combatTimer = Math.max(p.combatTimer, 1);
        if (p.hp <= 0 && !p.cheatDeath(scene)) { p.hp = 0; p.die({ kind: 'poison' }, scene); return; }
      }
    }
    if (p.alcohol >= 100) scene.passOut('alcohol');
  },

  vomit(p, scene) {
    p.stamina = Math.max(0, p.stamina - 30);
    p.alcohol = Math.max(0, p.alcohol - 15);
    for (const e of p.effects) if (G.EFFECTS[e.id].kind === 'poison' && e.id !== 'amatoxin') e.t *= 0.8;
    scene.floatText(p.x, p.y - 20, '*hurgh*', '#c8d070');
    scene.particles(p.x + G.util.DIR_VEC[p.dir][0] * 6, p.y - 6, '#b8b050', 10);
    G.audio.play('eat');
  },

  // Screen-effect intensities 0..1 (fade in over 3 s, out over the last 8 s).
  visuals(p) {
    const v = { sway: 0, high: 0, stim: 0, crash: 0, trip: 0, nausea: 0, poison: 0, painkiller: 0, opiate: 0, resp: 0 };
    for (const e of p.effects) {
      const d = G.EFFECTS[e.id];
      if (!d.visual) continue;
      const k = Math.min(1, (e.dur - e.t) / 3, e.t / 8) * Math.min(1.3, e.power);
      v[d.visual] = Math.max(v[d.visual], k);
    }
    const lv = this.intoxLevel(p);
    if (lv) v.sway = Math.max(v.sway, lv.sway * Math.min(1, (p.alcohol - lv.min + 10) / 20));
    v.sway = Math.max(v.sway, v.nausea * 0.6);
    return v;
  },

  // What the HUD shows.
  hudList(p) {
    const out = [];
    const lv = this.intoxLevel(p);
    if (lv) out.push({ name: lv.name, color: lv.color, t: null, desc: 'How drunk you are. Your aim, balance and judgment get worse the higher it goes; too much and you black out.' });
    for (const e of p.effects) {
      const d = G.EFFECTS[e.id];
      if (!d.hidden) out.push({ name: d.name, color: d.color, t: e.t, bad: d.bad, desc: d.desc || '', stats: d.stats || null, kind: d.kind });
    }
    if ((p.thirst || 0) >= 60) out.push({ name: p.thirst >= 85 ? 'Dehydrated' : 'Thirsty', color: '#6ab0f0', t: null, bad: p.thirst >= 85, desc: 'You need water. Thirst makes you tired and slow; an empty water meter drains your health.' });
    if ((p.hunger || 0) >= 60) out.push({ name: p.hunger >= 85 ? 'Starving' : 'Hungry', color: '#e0b060', t: null, bad: p.hunger >= 85, desc: 'You need food. Hunger weakens you; an empty food meter drains your health.' });
    if (this.risk(p, 'stimulant') >= 0.6) out.push({ name: 'Heart racing', color: '#ff7060', t: null, bad: true, desc: 'Too many stimulants in your blood. Any more and your heart could give out (overdose).' });
    if (this.risk(p, 'opioid') >= 0.6) out.push({ name: 'Breathing shallow', color: '#8090ff', t: null, bad: true, desc: 'Too many opioids or downers. Your breathing is slowing down; any more could stop it (overdose).' });
    return out;
  },
};
