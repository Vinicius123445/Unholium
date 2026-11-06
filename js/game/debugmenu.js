'use strict';
// Debug menu: F1 in game (or Pause > Debug Menu). Everything in the game at your fingertips.
//   Cheats (toggles): immortal, noclip, infinite stamina, no needs, invisible to NPCs, never wanted,
//   one-hit kills, double speed. Player: heal, money, XP, skill points, max skills. Items: every item
//   (type to filter; Enter = 1, Right = 10). Teleport: every map and floor, every building on this map.
//   NPCs: go to, bring here, heal, kill, love, partner, companion. World: time, days, bounty, reputation,
//   raids, fire. Spawn: vehicles, animals, thugs. Effects: any drug or status. Dreams & life: dreams of
//   every kind, pregnancy, a love scene.
(() => {
const U = G.ui;
G.cheats = { god: false, noclip: false, stamina: false, needs: false, invisible: false, wanted: false, onehit: false, fast: false };
const CHEAT_NAMES = { god: 'Immortal (god mode)', noclip: 'Noclip (walk through walls)', stamina: 'Infinite stamina', needs: 'No hunger/thirst/sleep', invisible: 'Invisible to NPCs', wanted: 'Never wanted (no bounty)', onehit: 'One-hit kills', fast: 'Double speed' };
const game = () => G.scenes.stack.find((s) => s instanceof G.GameScene);

class DebugMenuScene {
  constructor(scene) {
    this.transparent = true; this.game = scene;
    this.tabs = ['Cheats', 'Player', 'Skills', 'Items', 'Teleport', 'NPCs', 'World', 'Spawn', 'Effects', 'Pregnancy', 'Dreams & Life', 'Moral Causality'];
    this.tab = 0; this.sel = 0; this.scroll = 0; this.filter = ''; this.msg = '';
  }
  say(m) { this.msg = m; this.msgT = 2.5; }
  rows() {
    const g = this.game, p = g.player, w = g.world, f = this.filter.toLowerCase();
    const ok = (s) => !f || s.toLowerCase().includes(f);
    switch (this.tabs[this.tab]) {
      case 'Cheats': return Object.keys(G.cheats).map((k) => ({ label: CHEAT_NAMES[k], on: G.cheats[k], act: () => { G.cheats[k] = !G.cheats[k]; } }));
      case 'Player': return [
        { label: 'Full heal (health, stamina, needs)', act: () => { p.hp = p.maxHp; p.stamina = p.maxStamina; p.hunger = p.thirst = 0; p.rest = 100; p.alcohol = 0; } },
        { label: '+$1,000', act: () => { p.gold += 1000; } }, { label: '+$100,000', act: () => { p.gold += 100000; } },
        { label: '+500 XP', act: () => G.skills.addXp(p, 500, 'debug', g) },
        { label: 'Sober up / clear all effects', act: () => { p.effects = []; p.alcohol = 0; const s = G.effects.drugState(p); for (const c in s.load) s.load[c] = 0; for (const c in s.addiction) s.addiction[c] = 0; g.delir = null; } },
        { label: 'Clear bounty everywhere', act: () => { for (const r in w.bounty) w.bounty[r] = 0; g.pendingReports = []; } },
        { label: 'Get all keys on this map', act: () => { for (const b of g.map.buildings) p.inventory.add(G.keys.id(g.map.id, b.id), 1); } },
        { label: 'Burglar kit (10 lockpicks, crowbar, flashlight)', act: () => { p.inventory.add('lockpick', 10); p.inventory.add('crowbar', 1); p.inventory.add('flashlight', 1); } },
        { label: 'Wristwatch & phone', act: () => { p.inventory.add('wristwatch', 1); if (!p.inventory.has('phone')) p.inventory.add('phone', 1); } },
        { label: 'Learn to swim', act: () => { p.skills.ranks.swimming = Math.max(1, p.skills.ranks.swimming || 0); } },
        { label: 'Toggle naked', act: () => { if (p.equip.top || p.equip.bottom) { p._clothes = [p.equip.top, p.equip.bottom]; p.equip.top = p.equip.bottom = null; } else if (p._clothes) [p.equip.top, p.equip.bottom] = p._clothes; p.refreshSprite(); } },
      ];
      case 'Skills': return [
        { label: '+10 skill points', act: () => { p.skills.points += 10; } },
        { label: 'Level up', act: () => G.skills.addXp(p, G.xpToNext(p.skills.level) - p.skills.xp, 'debug', g) },
        { label: 'Max every skill', act: () => { for (const id in G.SKILLS) p.skills.ranks[id] = G.SKILLS[id].ranks; p.refreshStats(); } },
        { label: 'Reset skills (refund points)', act: () => { let n = 0; for (const id in p.skills.ranks) n += p.skills.ranks[id]; p.skills.ranks = {}; p.skills.points += n; p.refreshStats(); } },
      ].concat(Object.keys(G.SKILLS).filter((id) => ok(G.SKILLS[id].name)).map((id) => ({ label: `${G.SKILLS[id].name} (${p.skills.ranks[id] || 0}/${G.SKILLS[id].ranks})`, act: () => { p.skills.ranks[id] = ((p.skills.ranks[id] || 0) + 1) % (G.SKILLS[id].ranks + 1); p.refreshStats(); } })));
      case 'Items': return Object.keys(G.ITEMS).filter((id) => ok(G.ITEMS[id].name + ' ' + id + ' ' + G.ITEMS[id].type)).sort((a, b) => (G.ITEMS[a].type + G.ITEMS[a].name).localeCompare(G.ITEMS[b].type + G.ITEMS[b].name))
        .map((id) => ({ label: `${G.ITEMS[id].name}`, sub: G.ITEMS[id].type, icon: G.ITEMS[id].icon, act: (n = 1) => { p.inventory.add(id, n); this.say(`+${n} ${G.ITEMS[id].name}`); } }));
      case 'Teleport': {
        const maps = Object.keys(G.MAPGEN).filter(ok).map((id) => ({ label: `Map: ${G.maps.cache[id] ? G.maps.cache[id].meta.name : id}`, sub: id, act: () => { const pts = G.maps.get(id).points; const sp = Object.keys(pts).find((k) => k.startsWith('from_')) || (pts.start ? 'start' : Object.keys(pts)[0]); this.close(); g.changeMap(id, sp); } }));
        const here = g.map.buildings.filter((b) => ok(b.name + b.id)).map((b) => ({ label: `Here: ${b.name}`, sub: b.id, act: () => { p.x = b.doorX * 16 + 8; p.y = (b.doorY + 1) * 16 + 12; this.close(); } }));
        return here.concat(maps);
      }
      case 'NPCs': {
        const ids = Object.keys(w.npcs).filter((id) => G.NPCS[id] && w.npcs[id].alive && ok(w.displayName(id) + ' ' + id + ' ' + G.NPCS[id].name));
        return ids.sort((a, b) => (w.npcs[a].map === g.map.id ? 0 : 1) - (w.npcs[b].map === g.map.id ? 0 : 1)).map((id) => ({ label: `${w.displayName(id)} (${G.NPCS[id].name})`, sub: w.npcs[id].map, act: () => this.npcMenu(id) }));
      }
      case 'World': return [
        { label: 'Physics test (one body)', act: () => G.scenes.push(new G.PhysTestScene(g)) },
        ...[6, 9, 12, 15, 18, 21, 0, 3].map((h) => ({ label: `Set time to ${String(h).padStart(2, '0')}:00`, act: () => G.debug.time(h) })),
        { label: '+1 hour', act: () => { w.skipHours(1); g.resyncNPCs(); } }, { label: '+1 day', act: () => G.debug.days(1) },
        { label: '+3 days', act: () => G.debug.days(3) }, { label: '+1 week', act: () => G.debug.days(7) }, { label: '+2 weeks', act: () => G.debug.days(14) },
        { label: '+1 month (30 days)', act: () => G.debug.days(30) }, { label: '+3 months', act: () => G.debug.days(90) }, { label: '+1 year', act: () => G.debug.days(365) },
        { label: 'Reputation +50 with everyone', act: () => { for (const f in G.FACTIONS) if (G.FACTIONS[f].listed) w.addRep(f, 50); } },
        { label: 'Everyone on this map loves you', act: () => { for (const a of g.actors) if (a.kind === 'npc' && !a.transient) { a.st.disp = 100; a.st.fear = 0; a.st.hostile = false; } } },
        { label: 'Start a gang raid (Red Gang)', act: () => { const t = Object.keys(G.TERRITORIES).find((k) => w.territories[k] && w.territories[k].owner !== 'gang_red'); if (t) G.debug.raid('gang_red', t); } },
        { label: 'Start a fire where I am facing', act: () => {   // two steps ahead, exactly the way you face; any ground (a splash of fuel if it would not catch)
          const a = G.facingAngle ? G.facingAngle(p) : Math.PI / 2, x = p.x + Math.cos(a) * 30, y = p.y - 4 + Math.sin(a) * 30, tx = Math.floor(x / 16), ty = Math.floor(y / 16);
          if (!g.fire.canBurn(tx, ty)) g.fire.pourOil(tx, ty, 'gas', 14);
          if (g.fire.ignite(tx, ty, false, false)) { const c = g.fire.cells.get(ty * g.map.w + tx); if (c) c.heat = 0.8; this.say('Fire started.'); } else this.say('Nothing there can burn (water or a wall).');
          this.close(); } },
        { label: 'Give me fire supplies (lighter, gas cans, rubbing alcohol)', act: () => { p.inventory.add('torch', 1); p.inventory.add('oil_flask', 3); p.inventory.add('rubbing_alcohol', 3); this.say('Fire supplies added.'); } },
        { label: 'Toggle debug overlay (paths, hitboxes)', act: () => { g.debug = !g.debug; } },
        
      ];
      case 'Spawn': return Object.keys(G.vehicles.MODELS).filter(ok).map((m) => ({ label: `Vehicle: ${m}`, act: () => { const v = new G.Vehicle({ model: m, x: p.x + 30, y: p.y, angle: 0, keys: true, owner: 'player' }); g.vehicles.push(v); this.close(); } }))
        .concat(Object.keys(G.ANIMALS).filter(ok).map((k) => ({ label: `Animal: ${G.ANIMALS[k].name}`, act: () => { g.actors.push(new G.Animal(k, p.x + 40, p.y, 'debug', { x: Math.floor(p.x / 16) - 4, y: Math.floor(p.y / 16) - 4, w: 8, h: 8 })); this.close(); } })))
        .concat([{ label: 'A thug (hostile)', act: () => { const z = { key: 'debug', x: Math.floor(p.x / 16) - 6, y: Math.floor(p.y / 16) - 6, w: 12, h: 12 }; const n = g.spawnTransient(Object.keys(G.NIGHT_SPAWNS || { mugger: 1 })[0], z); if (n) { n.x = p.x + 50; n.y = p.y; n.st.hostile = true; } this.close(); } }]);
      case 'Effects': return Object.keys(G.EFFECTS).filter((id) => ok(G.EFFECTS[id].name + id)).map((id) => ({ label: G.EFFECTS[id].name, sub: G.EFFECTS[id].kind, act: () => { G.effects.add(p, id, 120); this.say(`${G.EFFECTS[id].name} for 2 minutes`); } }));
      case 'Pregnancy': {   // only people whose name you know (you asked)
        const known = Object.keys(w.npcs).filter((id) => G.NPCS[id] && !G.NPCS[id].kid && w.npcs[id].alive && w.npcs[id].introduced && ok(w.displayName(id)));
        const rows = [{ label: `Your body: ${p.look.body === 'f' ? 'female' : 'male'} (switch)`, act: () => { p.look.body = p.look.body === 'f' ? 'm' : 'f'; p.refreshSprite(); } }];
        if (p.preg) rows.push({ label: `You are pregnant (week ${Math.floor(G.love.days(p.preg, w))}). +5 weeks`, act: () => { p.preg.day -= 5; } });
        if (p.look.body === 'f' && !p.preg) for (const id of known.filter((i) => G.love.sexOf(w, i) === 'm')) rows.push({ label: `Get pregnant by ${w.displayName(id)}`, sub: G.NPCS[id].name, act: () => { G.love.conceive(w, 'player', id, 1); p.preg.known = true; p.preg.day = w.day - 3; this.say('You are pregnant.'); } });
        if (p.look.body !== 'f') rows.push({ label: '(Switch to a female body above to get pregnant yourself)', act: () => {} });
        for (const id of known.filter((i) => G.love.sexOf(w, i) === 'f')) rows.push({ label: w.npcs[id].preg ? `${w.displayName(id)} is pregnant (week ${Math.floor(G.love.days(w.npcs[id].preg, w))}). +5 weeks` : `Get ${w.displayName(id)} pregnant`, sub: G.NPCS[id].name, act: () => { if (w.npcs[id].preg) w.npcs[id].preg.day -= 5; else { w.npcs[id].preg = { day: w.day - 4, father: 'player', known: true, harm: 0 }; G.phone.queue(w, id, 'I need to tell you something. I am pregnant. It is yours.', 1); this.say(`${w.displayName(id)} is pregnant.`); } } });
        if (rows.length < 3) rows.push({ label: '(Ask people their name to see them here)', act: () => {} });
        return rows;
      }
      case 'Moral Causality': {   // the hidden sin/redemption/luck system (js/game/fate.js); only ever shown here
        const F = G.fate, s = F.st(w), r1 = (n) => Math.round(n * 10) / 10, fl = w.flags;
        return [
          { label: `System: ${s.off ? 'OFF (answered "no")' : 'ON'}  (toggle)`, on: !s.off, act: () => { s.off = !s.off; } },
          { label: `Run: ${['Easy', 'Normal', 'Hard'][G.settings.get('difficulty')]}${fl.hardcore ? ' · Hardcore' : ''}`, act: () => {} },
          { label: `Guilt ${r1(s.guilt)} · total sin ${r1(s.sinTotal)}`, act: () => {} },
          { label: `Redemption ${r1(s.red)} · virtue ${r1(s.virtue)} · clean days ${s.cleanDays || 0}`, act: () => {} },
          { label: `Hidden luck ${F.luckMod() >= 0 ? '+' : ''}${r1(F.luckMod())} (luck stat now ${r1(G.skills.stat(p, 'luck'))})`, act: () => {} },
          { label: 'Commit a murder (+sin)', act: () => this.say(`+${r1(F.sin('murder'))} guilt`) },
          { label: 'Petty theft (+sin)', act: () => this.say(`+${r1(F.sin('theft_petty'))} guilt`) },
          { label: 'Confess (+good)', act: () => this.say(`+${r1(F.good('confess'))} redemption`) },
          { label: 'Big charity (+good)', act: () => this.say(`+${r1(F.good('charity_big'))} redemption`) },
          { label: 'Reset the ledger', act: () => { const off = s.off; delete w.fate; F.st(w).off = off; } },
          ...s.log.slice(-12).reverse().map((e) => ({ label: `Log: ${e.k} ${e.w}`, sub: `day ${Math.floor(e.t / 1440)} ${String(Math.floor(e.t % 1440 / 60)).padStart(2, '0')}:${String(e.t % 60).padStart(2, '0')}`, act: () => {} })),
        ];
      }
      case 'Dreams & Life': return [
        { label: 'Dream now (random)', act: () => { this.close(); const d = G.dreams.make(g, 9) || G.dreams.make(g, 9); if (d) G.scenes.push(new G.DreamScene(g, d, () => {})); } },
        ...['chase', 'flying', 'rooms', 'drown', 'money', 'falling', 'paralysis', 'love', 'teeth'].map((th) => ({ label: `Dream: ${th} (playable)`, act: () => { this.close(); G.scenes.push(new G.DreamScene(g, G.dreams.themed(g, th), () => {})); } })),
        { label: 'Become pregnant (week 30)', act: () => G.debug.pregnant(30) },
        { label: 'Every pregnancy +5 weeks', act: () => G.debug.weeks(5) },
        { label: 'Love scene with the nearest person', act: () => { const n = g.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.def.kid).sort((a, b) => a.distTo(p) - b.distTo(p))[0]; if (n) { this.close(); G.scenes.push(new G.LoveScene(g, n)); } } },
        { label: 'Collapse from exhaustion', act: () => { this.close(); p.rest = 0; g.passOut('exhaustion'); } },
      ];
    }
    return [];
  }
  npcMenu(id) {
    const g = this.game, w = g.world, st = w.npcs[id], p = g.player;
    const actor = () => g.actors.find((a) => a.id === id);
    const opts = [
      { label: 'Go to them', fn: () => { const map = st.map || G.NPCS[id].map; if (map !== g.map.id) { g.changeMap(map, Object.keys(G.maps.get(map).points).find((k) => k.startsWith('from_'))); setTimeout(() => { const a = actor(); if (a) { p.x = a.x + 14; p.y = a.y; } }, 900); } else { const a = actor(); if (a) { p.x = a.x + 14; p.y = a.y; } } this.close(); } },
      { label: 'Bring them here', fn: () => { st.map = g.map.id; g.resyncNPCs(); const a = actor(); if (a) { a.x = p.x + 16; a.y = p.y; } this.close(); } },
      { label: 'Heal / calm down', fn: () => { st.hp = G.NPCS[id].hp || 30; st.fear = 0; st.hostile = false; const a = actor(); if (a) { a.hp = st.hp; a.state = 'schedule'; } } },
      { label: 'Kill', fn: () => G.debug.kill(id) },
      { label: 'Max friendship & romance', fn: () => { st.disp = 100; st.romance = 100; } },
      { label: 'Make them your partner', fn: () => { st.disp = 100; st.romance = 100; st.partner = true; G.phone.addContact(w, id); } },
      { label: 'Make them follow you', fn: () => { const a = actor(); if (a) G.companions.start(g, a); } },
      { label: 'Add to contacts', fn: () => G.phone.addContact(w, id) },
      { label: 'Make them pregnant (week 30)', fn: () => { if (G.love.sexOf(w, id) === 'f' && !G.NPCS[id].kid) st.preg = { day: w.day - 30, father: 'player', known: true }; } },
      { label: 'Back', fn: () => {} },
    ];
    G.scenes.push(new G.ChoiceScene(w.displayName(id), `${G.NPCS[id].name} · ${st.map || G.NPCS[id].map} · disp ${Math.round(st.disp || 0)}`, opts));
  }
  close() { G.scenes.remove(this); }
  update(dt) {
    const I = G.input, rows = this.rows();
    if (this.msgT > 0) this.msgT -= dt;
    if (I.pressed.has('Escape') || I.pressed.has('F1') || I.pressed.has('Backquote')) { this.close(); return; }
    if (I.pressed.has('ArrowLeft') || I.pressed.has('PageUp')) { this.tab = (this.tab + this.tabs.length - 1) % this.tabs.length; this.sel = 0; this.scroll = 0; this.filter = ''; }
    if (I.pressed.has('ArrowRight') && this.tabs[this.tab] === 'Items' && rows[this.sel]) rows[this.sel].act(10);
    else if (I.pressed.has('ArrowRight') || I.pressed.has('PageDown') || I.pressed.has('Tab')) { this.tab = (this.tab + 1) % this.tabs.length; this.sel = 0; this.scroll = 0; this.filter = ''; }
    if (I.pressed.has('ArrowUp')) this.sel = Math.max(0, this.sel - 1);
    if (I.pressed.has('ArrowDown')) this.sel = Math.min(rows.length - 1, this.sel + 1);
    if (I.pressed.has('Enter') && rows[this.sel]) { rows[this.sel].act(); G.audio.play('select'); }
    for (const ch of I.typed) if (/[\w \-']/.test(ch) && this.filter.length < 20) { this.filter += ch; this.sel = 0; this.scroll = 0; }
    if (I.pressed.has('Backspace')) { this.filter = this.filter.slice(0, -1); this.sel = 0; }
    if (I.mouse.wheel) this.scroll = Math.max(0, this.scroll + Math.sign(I.mouse.wheel) * 3);
  }
  render(ctx) {
    const R = G.renderer, m = G.input.mouse;
    U.dim(ctx, 0.55);
    const W = Math.min(560, R.uiW - 20), H = Math.min(330, R.uiH - 16), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Debug Menu', titleSize: 12 });
    this.tabs.forEach((t, i) => {
      const b = U.button(ctx, x + 8, y + 26 + i * 19, 92, 17, t, { selected: i === this.tab, size: 8 });
      if (b.clicked) { this.tab = i; this.sel = 0; this.scroll = 0; this.filter = ''; }
    });
    const rows = this.rows(), lx = x + 108, ly = y + 40, lw = W - 116, rh = 13, vis = Math.floor((H - 62) / rh);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + vis) this.scroll = this.sel - vis + 1;
    this.scroll = Math.min(this.scroll, Math.max(0, rows.length - vis));
    U.text(ctx, this.filter ? `Filter: ${this.filter}_` : 'Type to filter', lx, y + 26, { size: 8, color: this.filter ? '#ffe08a' : U.colors.dim });
    rows.slice(this.scroll, this.scroll + vis).forEach((r, k) => {
      const i = this.scroll + k, ry = ly + k * rh, sel = i === this.sel;
      const hover = U.inRect(m.ux, m.uy, lx, ry, lw, rh - 1);
      if (hover && m.moved) this.sel = i;
      ctx.fillStyle = sel ? 'rgba(110,86,44,0.85)' : 'rgba(30,26,36,0.6)'; ctx.fillRect(lx, ry, lw, rh - 1);
      let tx = lx + 4;
      if (r.icon) { U.icon(ctx, r.icon, lx + 2, ry - 1, 0.75); tx += 14; }
      if (r.on != null) { ctx.fillStyle = r.on ? '#5ae08a' : '#4a4452'; ctx.fillRect(lx + 3, ry + 3, 7, 6); tx += 12; }
      U.text(ctx, r.label, tx, ry + 2, { size: 8, color: sel ? '#fff4d8' : U.colors.text });
      if (r.sub) U.text(ctx, r.sub, lx + lw - 4, ry + 2, { size: 7, align: 'right', color: U.colors.dim });
      if (hover && m.pressed) { this.sel = i; r.act(); G.audio.play('select'); }
    });
    if (rows.length > vis) U.text(ctx, `${this.scroll + 1}-${Math.min(rows.length, this.scroll + vis)} of ${rows.length}`, x + W - 10, y + H - 14, { size: 7, align: 'right', color: U.colors.dim });
    if (this.msgT > 0) U.text(ctx, this.msg, x + 108, y + H - 14, { size: 8, color: '#8aea7a' });
  }
}
G.DebugMenuScene = DebugMenuScene;

// ---------------------------------------------------------------- the cheats themselves
const _damage = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  if (G.cheats.god && target && target.kind === 'player') return 0;
  if (G.cheats.onehit && source && source.kind === 'player' && target && target.kind !== 'player') amount = 9999;
  return _damage.call(this, target, amount, source, scene, o);
};
const PL = G.Player.prototype, _move = PL.move, _upd = PL.update;
PL.move = function (map, dx, dy, slide) {
  if (G.cheats.noclip) { this.x = G.util.clamp(this.x + dx, 4, map.pw - 4); this.y = G.util.clamp(this.y + dy, 8, map.ph - 2); return true; }
  return _move.call(this, map, dx, dy, slide);
};
PL.update = function (dt, scene) {
  const r = _upd.call(this, dt, scene);
  const c = G.cheats;
  if (c.god) { this.hp = this.maxHp; this.dead = false; }
  if (c.stamina) this.stamina = this.maxStamina;
  if (c.needs) { this.hunger = 0; this.thirst = 0; this.rest = 100; }
  if (c.wanted && scene.world) { for (const k in scene.world.bounty) scene.world.bounty[k] = 0; scene.pendingReports = []; }
  return r;
};
const _mult = G.effects.mult;
G.effects.mult = function (p, key) { const m = _mult.call(this, p, key); return key === 'speed' && G.cheats.fast && p.kind === 'player' ? m * 2 : m; };
const NP = G.NPC.prototype, _see = NP.canSee;
NP.canSee = function (scene, other, range) { if (G.cheats.invisible && other && other.kind === 'player') return false; return _see.call(this, scene, other, range); };

// F1 opens it in game; it is also in the pause menu
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  if ((G.input.pressed.has('F1') || G.input.pressed.has('Backquote')) && G.scenes.top() === this) { G.input.pressed.delete('F1'); G.input.pressed.delete('Backquote'); G.scenes.push(new DebugMenuScene(this)); return; }
  return _gu.call(this, dt);
};
const PS = G.PauseScene.prototype, _act = PS.activate;
PS.activate = function (i) {
  if (this.items[i] === 'Debug Menu') { G.scenes.pop(); G.scenes.push(new DebugMenuScene(this.game)); return; }
  return _act.call(this, i);
};
const _ctor = G.PauseScene;
G.PauseScene = function (g) { const s = new _ctor(g); s.items.splice(s.items.length - (G.desktop ? 2 : 1), 0, 'Debug Menu'); return s; };
G.PauseScene.prototype = PS;
void game;
})();
