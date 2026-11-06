'use strict';
// County Jail. Getting arrested sends you here: your weapons, contraband and clothes go to the evidence
// room, you get an orange jumpsuit and a cell (cell 3), and you serve days according to your bounty.
// Sleep in your cell to pass the time; you are released at 8:00 on your release day.
//
// The rules: lights out 22:00-06:00 (be in your cell), and the warden's office, the evidence room and
// the gate are off limits. A guard who catches you breaking them sends you back and adds days.
//
// Escapes (all of them hard):
//   1. Tunnel     — steal a spoon from the mess hall, dig behind the loose tile in your cell at night,
//                   an hour at a time. Night inspections can find it. ~10 nights of digging.
//   2. Keycard    — the warden carries one and keeps another in the office safe. Get one, swipe the gate.
//   3. Bribe      — pay a guard a fortune to leave the gate open tonight (speech check; failing costs days).
//   4. Riot       — earn the yard boss's trust (or talk him into it) and the inmates rise up; the gate opens.
//   5. Laundry    — hide in a laundry cart when the truck collects it (05:00-06:00). Sneaky helps.
// An escape makes you a wanted fugitive: a huge bounty, and the police shoot on sight.

G.DIALOGUE_NODES = G.DIALOGUE_NODES || {};

G.jail = {
  CELL: 'j_cell3',
  INSPECT: 0.1,      // chance per hour of digging that a night inspection finds the tunnel (Sneaky lowers it)
  JUMPSUIT: ['top/shirt/d8782a', 'bottom/pants/d8782a'],
  now(w) { return w.day * 1440 + w.minutes; },
  in(scene) { return scene.map.id === 'jail' && !!scene.world.jail; },
  lockdown(w) { const h = w.hourF; return h >= 22 || h < 6; },

  imprison(scene) {
    const w = scene.world, p = scene.player, region = scene.region;
    const days = G.util.clamp(Math.ceil((w.bounty[region] || 0) / 120), 1, 10);
    // everything you carried that a jail would not let you keep goes to the evidence room
    const seized = [];
    p.inventory.slots.forEach((s, i) => {
      if (!s) return;
      const it = G.item(s.id);
      if (it.illegal || it.type === 'weapon' || it.type === 'ammo' || it.type === 'armor' || s.id === 'phone') { seized.push([s.id, s.qty]); p.inventory.slots[i] = null; }
    });
    for (const slot of ['weapon', 'armor', 'top', 'bottom']) if (p.equip[slot]) { seized.push([p.equip[slot], 1]); p.equip[slot] = null; }
    w.clearBounty(region);
    p.effects = []; p.alcohol = 0; p.drugs.load = {};
    w.jail = { release: w.day + days, served: 0, dig: 0, caught: 0, seized, gold: Math.floor(p.gold * 0.25) };
    p.gold -= w.jail.gold;
    p.equip.top = this.JUMPSUIT[0]; p.equip.bottom = this.JUMPSUIT[1];
    p.refreshSprite();
    p.hp = p.maxHp;
    G.maps.get('jail');
    G.containers.ensureChests(w, G.maps.get('jail'));
    const ev = w.containers['jail:evidence'];
    if (ev) ev.items = ev.items.concat(seized);
    w.log(`You were booked into the County Jail for ${G.util.plural(days, 'day')}. Your belongings are in the evidence room.`, 'warn');
    scene.loadMap('jail', this.CELL);
  },

  release(scene) {
    const w = scene.world, p = scene.player, j = w.jail;
    const ev = w.containers['jail:evidence'];
    for (const [id, n] of j.seized) if (!ev || ev.items.some((e) => e[0] === id)) p.inventory.add(id, n);
    if (ev) ev.items = ev.items.filter((e) => !j.seized.some((s) => s[0] === e[0]));
    for (const slot of ['top', 'bottom']) p.equip[slot] = null;
    const top = p.inventory.slots.findIndex((s) => s && s.id.startsWith('top/')); if (top >= 0) p.equipFromSlot(top);
    const bottom = p.inventory.slots.findIndex((s) => s && s.id.startsWith('bottom/')); if (bottom >= 0) p.equipFromSlot(bottom);
    p.refreshSprite();
    w.jail = null;
    w.log('You served your time. You are free to go.', 'good');
    scene.changeMap('city', 'from_jail');
  },

  escape(scene, how) {
    const w = scene.world, p = scene.player;
    if (!w.jail) return;
    w.jail = null;
    w.flags.escaped_convict = w.day;
    w.bounty.city = (w.bounty.city || 0) + 600;
    w.log(`You escaped from the County Jail (${how})! The police will shoot on sight.`, 'quest');
    w.rumor('A prisoner broke out of the County Jail. Police say the fugitive is armed and dangerous.', 'city');
    G.events.emit('xp', 150, 'Escape');
    G.audio.play('alarm');
  },

  // Caught breaking the rules: back to the cell, more days, contraband confiscated.
  caught(scene, guard, why, days = 1) {
    const w = scene.world, p = scene.player, j = w.jail;
    guard.say(G.rng.pick(['Back to your cell! NOW!', 'Where do you think you are going?', 'Nice try, inmate.']));
    j.release += days; j.caught++;
    for (const id of ['spoon', 'keycard']) p.inventory.remove(id, p.inventory.count(id));
    if (why === 'tunnel') j.dig = 0;
    w.log(`Caught: ${why}. +${G.util.plural(days, 'day')} on your sentence.`, 'bad');
    G.scenes.push(new G.FadeScene(() => { const c = scene.map.points[this.CELL]; p.x = c.x * 16 + 8; p.y = c.y * 16 + 12; p.dragging = null; }, 0.8));
  },

  // Is the player somewhere they should not be right now?
  restricted(scene) {
    const map = scene.map, p = scene.player, w = scene.world;
    const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
    const b = map.buildingAtTile(tx, ty);
    if (b && (b.id === 'j_office' || b.id === 'j_evidence')) return 'trespassing in a restricted area';
    const K = G.WORLD_SCALE;
    if (ty >= 44 * K && tx >= 30 * K && tx <= 42 * K && !map.buildingAtTile(tx, ty)) return 'loitering by the gate';
    if (this.lockdown(w)) {
      const cell = map.points[this.CELL];
      if (Math.abs(tx - cell.x) > 2 || ty < 9 * K || ty > 12 * K + 1) return 'out of your cell after lights out';
    }
    return null;
  },

  update(scene, dt) {
    const w = scene.world, p = scene.player;
    if (scene.map.id !== 'jail') return;
    if (!w.jail) return;
    // release day
    if (w.day >= w.jail.release && w.hour >= 8 && !p.dead && G.scenes.top() === scene) { this.release(scene); return; }
    // outside the walls = escaped
    const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
    const K = G.WORLD_SCALE;
    if (tx < 6 * K || tx > 65 * K || ty > 49 * K || ty < 6 * K) { this.escape(scene, w.jail.how || 'over the wall'); return; }
    // the gate: open while bribed (at night), during a riot, or right after a keycard swipe
    const gateOpen = w.jail.gateUntil && this.now(w) < w.jail.gateUntil;
    const gate = scene.map.decor.find((d) => d.type === 'security_door');
    if (gateOpen && gate) { scene.map.removeDecorRuntime(gate); }
    if (!gateOpen && !gate && !this.near(p, 35 * K, 49 * K)) scene.map.addDecorRuntime('security_door', 35 * K, 49 * K);
    if (w.jail.bribedNight === w.day && this.lockdown(w)) w.jail.gateUntil = Math.max(w.jail.gateUntil || 0, this.now(w) + 30);
    // guards enforce the rules
    if ((this.scanT = (this.scanT || 0) - dt) > 0) return;
    this.scanT = 0.5;
    const why = this.restricted(scene);
    if (!why || w.jail.riot && this.now(w) < w.jail.riot) return;
    const guard = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.map === 'jail' && a.def.combat === 'guard' && a.state !== 'fight' && a.canSee(scene, p, 110));
    if (guard && G.scenes.top() === scene) this.caught(scene, guard, why);
  },
  near(p, tx, ty) { return Math.abs(p.x / 16 - tx - 1) < 3 && Math.abs(p.y / 16 - ty) < 2; },

  // ---------------- interactions ----------------
  LABELS: { dig: 'Dig (spoon, 1 hour)', spoon: 'Take a spoon', laundry: 'Hide in the laundry cart', gate: 'Swipe a keycard' },
  label(k, d, scene) {
    const w = scene.world;
    if (k === 'dig') { const cell = scene.map.points[this.CELL]; if (Math.abs(d.tx - cell.x) > 2) return 'Loose tile (not your cell)'; return w.jail && w.jail.dig >= 100 ? 'Crawl into the tunnel' : `Dig (spoon, 1 hour) · ${w.jail ? w.jail.dig : 0}%`; }
    return this.LABELS[k];
  },
  use(k, d, scene) {
    const w = scene.world, p = scene.player, j = w.jail;
    if (!j) { scene.toast('Nothing to do here.'); return; }
    const guardSees = (range = 100) => scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.canSee(scene, p, range));
    switch (k) {
      case 'spoon': {
        if (p.inventory.has('spoon')) { scene.toast('You already have one hidden.'); return; }
        const g = guardSees(80);
        if (g && G.rng.chance(0.5)) { this.caught(scene, g, 'stealing cutlery', 1); return; }
        p.inventory.add('spoon', 1); scene.toast('You slip a spoon into your sleeve.', 'good');
        return;
      }
      case 'dig': {
        const cell = scene.map.points[this.CELL];
        if (Math.abs(d.tx - cell.x) > 2) { scene.toast('Not your cell. Not your tunnel.'); return; }
        if (j.dig >= 100) { const e = scene.map.points.j_tunnel_exit; j.how = 'through a tunnel'; G.scenes.push(new G.FadeScene(() => { p.x = e.x * 16 + 8; p.y = e.y * 16 + 12; }, 1.2)); scene.toast('You crawl through the tunnel and come up outside the wall.', 'good'); return; }
        if (!p.inventory.has('spoon')) { scene.toast('You need something to dig with. The mess hall has spoons.'); return; }
        if (!this.lockdown(w)) { scene.toast('Not now. Too many eyes during the day.', 'warn'); return; }
        scene.passTime(1, false);
        p.stamina = Math.max(0, p.stamina - 40);
        if (G.rng.chance(this.INSPECT * Math.max(0.3, 1 - G.skills.stat(p, 'stealth')))) {   // night inspection
          const g = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard') || { say() {} };
          this.caught(scene, g, 'tunnel', 2);
          return;
        }
        j.dig = Math.min(100, j.dig + G.rng.int(7, 12));
        scene.toast(j.dig >= 100 ? 'You break through! The tunnel is finished.' : `You scrape away at the tunnel. (${j.dig}%)`, j.dig >= 100 ? 'good' : 'info');
        return;
      }
      case 'laundry': {
        const h = w.hourF;
        if (h < 5 || h >= 6) { scene.toast('The laundry truck collects the carts between 05:00 and 06:00.'); return; }
        const chance = G.util.clamp(0.3 + G.skills.stat(p, 'stealth') + (guardSees(140) ? -0.25 : 0.1), 0.05, 0.85);
        if (G.rng.chance(chance)) {
          j.how = 'in a laundry cart';
          const e = scene.map.points.j_truck_drop;
          G.scenes.push(new G.FadeScene(() => { p.x = e.x * 16 + 8; p.y = e.y * 16 + 12; }, 1.5));
          scene.toast('You bury yourself in dirty sheets. The truck rolls out through the gate...', 'good');
        } else this.caught(scene, guardSees(400) || scene.actors.find((a) => a.def && a.def.combat === 'guard') || { say() {} }, 'hiding in the laundry', 3);
        return;
      }
      case 'gate':
        if (!p.inventory.has('keycard')) { scene.toast('The gate needs the warden\'s keycard.', 'bad'); return; }
        j.gateUntil = this.now(w) + 20;
        j.how = 'through the front gate';
        G.audio.play('door');
        scene.toast('The light turns green. The gate slides open. RUN.', 'good');
        for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.def.combat === 'guard' && a.canSee(scene, p, 200)) a.startFight(p, scene);
        return;
    }
  },
};
const _useBase = G.usables.use.bind(G.usables), _labelBase = G.usables.label.bind(G.usables);
G.usables.use = (d, scene) => (G.jail.LABELS[d.def.interact] ? G.jail.use(d.def.interact, d, scene) : _useBase(d, scene));
G.usables.label = (d, scene) => (G.jail.LABELS[d.def.interact] ? G.jail.label(d.def.interact, d, scene) : _labelBase(d, scene));

// ---------------- guards and the yard boss ----------------
G.DIALOGUES.jailguard = {
  start: {
    common: true,
    text: (c) => (c.w.jail ? `Inmate. You have ${G.util.plural(Math.max(0, c.w.jail.release - c.w.day), 'day')} left. Do not make it more.` : c.greet()),
    choices: [
      { text: 'When do I get out?', if: (c) => !!c.w.jail, next: 'when' },
      { text: (c) => `${c.tag(10)} Look the other way tonight. ($600)`, if: (c) => !!c.w.jail && c.gold() >= 600 && c.canTry('bribe_gate'), next: 'bribe' },
      { text: 'Goodbye.', next: null },
    ],
  },
  when: { text: (c) => `Day ${c.w.jail.release}, eight in the morning. Sleep in your cell and keep your head down.`, choices: [{ text: 'Got it.', next: 'start' }] },
  bribe: {
    text: (c) => {
      if (c.check('bribe_gate', 10)) { c.pay(600); c.w.jail.bribedNight = c.w.day; return 'I never had this conversation. Tonight, after lights out, the gate will not be locked. Be quick.'; }
      c.w.jail.release += 3;
      return 'Did you just try to BRIBE me? Three more days. Want to try for more?';
    },
    choices: [{ text: '[Leave]', next: null }],
  },
};
G.DIALOGUES.inmate_boss = {
  start: {
    common: true,
    text: (c) => ((c.st.disp || 0) >= 40 ? 'My friend. What do you need?' : 'You lost, fish? This is my yard.'),
    choices: [
      { text: 'What does it take to get out of here?', next: 'out' },
      { text: (c) => ((c.st.disp || 0) >= 40 ? 'Let\'s start a riot. Now.' : `${c.tag(11)} We should start a riot. Today.`), if: (c) => !!c.w.jail, next: 'riot' },
      { text: 'Goodbye.', next: null },
    ],
  },
  out: { text: 'Patience, a spoon, or a lot of money. Or the warden\'s card. Or all of us, at once. Earn my respect and maybe we talk about that last one.', choices: [{ text: 'Something else...', next: 'start' }] },
  riot: {
    text: (c) => {
      if ((c.st.disp || 0) < 40 && !c.check('riot', 11)) return 'You? Starting something? Get out of my face.';
      const scene = c.scene, w = c.w;
      w.jail.riot = G.jail.now(w) + 120;
      w.jail.gateUntil = G.jail.now(w) + 90;
      w.jail.how = 'during a riot';
      const guards = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard');
      for (const a of scene.actors) {
        if (a.kind !== 'npc' || a.dead || a.def.faction !== 'prisoners') continue;
        a.st.hostile = false;
        const g = guards.sort((x, y) => x.distTo(a) - y.distTo(a))[0];
        if (g && a.def.combat === 'fight') a.startFight(g, scene);
      }
      for (const g of guards) { const inmate = scene.actors.find((a) => a.def && a.def.faction === 'prisoners' && !a.dead); if (inmate) g.startFight(inmate, scene); }
      G.audio.play('alarm');
      w.log('A riot broke out in the County Jail!', 'quest');
      return 'Then let\'s burn it down! EVERYBODY! NOW!';
    },
    choices: [{ text: '[Run]', next: null }],
  },
};

