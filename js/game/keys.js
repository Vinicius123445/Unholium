'use strict';
// Keys, break-ins and smarter residents.
//   Keys are items ("Key (Mini-Mart)"). Everyone who lives in a house or runs a store carries its key; so
//   do their spouses and lovers. A locked door opens for whoever has the key, NPCs included — nobody else
//   gets through (the police and angry fighters chasing you kick it in).
//   Getting a key: loot it, pickpocket it (sneak up behind someone, [G]), ask your partner or a close friend
//   for a spare, or check under the doormat (some people really do leave one there).
//   At a locked door: knock, check the doormat, pick the lock, kick it in (if you are strong enough), or
//   pry it with a crowbar. Noise wakes people up; so does walking around their house at night. Woken
//   residents come at you or run and call the police, depending on who they are.
(() => {
const KEY = 'key:';
const keyCache = {};
const _item = G.item;
G.item = (id) => {
  if (typeof id === 'string' && id.startsWith(KEY)) {
    if (keyCache[id]) return keyCache[id];
    const [, mapId, bid] = id.split(':');
    let name = bid;
    try { const b = G.maps.get(mapId).building(bid); if (b) name = b.name; } catch (e) { /* map not built yet */ }
    return (keyCache[id] = { id, name: `Key (${name})`, type: 'key', icon: 'key', value: 0, stack: 10, desc: `Opens the front door of the ${name}.` });
  }
  return _item(id);
};

G.keys = {
  id: (mapId, bid) => KEY + mapId + ':' + bid,
  playerHas(p, map, b) { return p.inventory.has(this.id(map.id, b.id)); },
  npcHas(npc, map, b) {
    const id = this.id(map.id, b.id), st = npc.st;
    if ((st.inv || []).some((e) => e[0] === id && e[1] > 0)) return true;
    if (npc.def.home === b.id) return true;
    const w = G.world, mates = [st.lover, G.love && G.love.spouseOf(w, npc.id)].filter(Boolean);
    return mates.some((m) => G.NPCS[m] && G.NPCS[m].home === b.id);
  },
  // everyone gets their own keys (and thugs get their stash) once per world
  ensure(w, p) {
    if (w.flags.keys_v1) return;
    w.flags.keys_v1 = true;
    for (const id in w.npcs) {
      const d = G.NPCS[id], st = w.npcs[id];
      if (!d || d.transient) continue;
      st.inv = st.inv || [];
      if (d.home) st.inv.push([this.id(d.map, d.home), 1]);
      if (['gang_red', 'gang_blue', 'punks', 'criminals'].includes(d.faction) || d.dealer) G.keys.stash(st, d.dealer ? 1 : 0.5);
    }
    p.inventory.add(this.id('rural', w.flags.player_home || 'r_home'), 1);
  },
  stash(st, chance) {
    const pool = [['joint', 0.5, [1, 3]], ['weed', 0.35, [1, 2]], ['cocaine', 0.25, [1, 2]], ['crack', 0.2, [1, 3]], ['heroin', 0.12, [1, 1]], ['xanax', 0.25, [1, 4]], ['speed_pills', 0.15, [1, 3]]];
    if (Math.random() > chance) return;
    for (const [id, p, [lo, hi]] of pool) if (G.ITEMS[id] && Math.random() < p) st.inv.push([id, G.rng.int(lo, hi)]);
  },
  strength(p) {
    const r = (k) => G.skills.rank(p, k) || 0;
    let s = 4 + r('brawler') + r('heavy_hitter') * 1.5 + r('conditioning') + r('toughness') * 0.5 + r('berserker');
    if (G.effects.has(p, 'stim') || G.effects.has(p, 'crack_high')) s += 2;
    if (G.rest && G.rest.get(p) < 10) s -= 1;
    return s;
  },
  // wake people up around a noise; residents defend their home
  noise(scene, x, y, loud) {
    const p = scene.player, b = scene.map.buildingAt(x, y - 3) || scene.map.buildings.find((q) => Math.abs(q.doorX * 16 + 8 - x) < 24 && Math.abs(q.doorY * 16 - y) < 30);
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a.distTo({ x, y }) > 40 + loud * 45) continue;
      if (a.sleeping && Math.random() < [0, 0.1, 0.35, 0.8, 0.95][Math.min(4, loud)]) { a.sleeping = false; a.say(G.rng.pick(['What was that?!', 'Who is there?!', 'Hello?!']), 3); }
      if (!a.sleeping && b && G.doors.residents(scene, b).includes(a.id)) this.defend(scene, a, b);
      else if (!a.sleeping && loud >= 3 && a.canSee(scene, p, 160)) scene.reportCrime('vandalism', a);
    }
  },
  defend(scene, a, b) {
    if (a.state !== 'schedule' || a.defending) return;
    const p = scene.player, P = G.social.persona(a.id), st = a.st;
    a.defending = true;
    const brave = a.def.combat !== 'flee' || ((P.trait === 'proud' || P.trait === 'grumpy') && (st.disp || 0) < 20 && Math.random() < 0.5);
    if (a.def.kid) { a.say('MOM! DAD! Someone is in the house!', 3); a.startFlee(p); return; }
    if (brave) { a.say(G.rng.pick(['You picked the wrong house!', 'Get out of my home!', 'I have a gun! ...Or a bat. Same thing.']), 3); a.aggressor = true; a.startFight(p, scene); }
    else { a.say(G.rng.pick(['Somebody help! Burglar!', 'I am calling 911!', 'Please, take whatever you want!']), 3); st.fear = 100; a.startFlee(p); }
    scene.reportCrime('trespass', a);
  },
};

// ---------------------------------------------------------------- the door menu (keys, doormat, kick)
const D = G.doors, _locked = D.locked;
D.baseLocked = function (scene, b) { return _locked.call(this, scene, b); };
D.locked = function (scene, b) { if (G.keys.playerHas(scene.player, scene.map, b)) return false; return _locked.call(this, scene, b); };
const _allowed = D.allowed;
D.allowed = function (scene, b, area) { return _allowed.call(this, scene, b, area); };
D.menu = function (scene, b) {
  const p = scene.player, w = scene.world, key = this.key(scene.map, b), opts = [];
  const tier = this.lockTier(scene, b), home = this.residents(scene, b).length && !this.shopOf(scene, b);
  opts.push({ label: 'Knock', fn: () => this.knock(scene, b) });
  if (home && !(w.matChecked || {})[key]) opts.push({ label: 'Check under the doormat', fn: () => {
    (w.matChecked = w.matChecked || {})[key] = true;
    if (G.util.hashString('mat' + key) % 100 < 18) { p.inventory.add(G.keys.id(scene.map.id, b.id), 1); scene.toast('A spare key. Of course it was under the mat.', 'good'); }
    else scene.toast('Nothing under the mat. Smart people.');
  } });
  if (p.inventory.has('lockpick')) opts.push({ label: `Pick the lock (${['', 'cheap', 'standard', 'secure', 'high-security'][tier]} lock)`, fn: () => this.pick(scene, tier, () => { (w.unlocked = w.unlocked || {})[key] = w.day; this.burgle(scene, b); G.keys.noise(scene, b.doorX * 16 + 8, b.doorY * 16, 1); scene.toast('Click. The door is open.', 'good'); }) });
  else opts.push({ label: 'Pick the lock (you need a lockpick)', disabled: true });
  const str = G.keys.strength(p), need = 3 + tier * 2;
  opts.push({ label: `Kick it in (strength ${Math.round(str)} vs ${need}, luck ${G.skills.stat(p, 'luck') || 0})`, fn: () => this.kick(scene, b, str, need) });
  if (p.inventory.has('crowbar')) opts.push({ label: 'Pry it open with the crowbar (loud)', fn: () => { this.breakDoor(scene, b); G.keys.noise(scene, b.doorX * 16 + 8, b.doorY * 16, 3); } });
  opts.push({ label: 'Leave', fn: () => {} });
  G.scenes.push(new G.ChoiceScene(`${b.name}: locked`, 'The door is locked.', opts));
};
D.kick = function (scene, b, str, need) {
  const p = scene.player, luck = G.skills.stat(p, 'luck') || 0, chance = G.util.clamp(0.15 + (str - need) * 0.18 + luck * 0.06, 0.05, 0.95);   // strength, and a little luck
  G.audio.play('hit'); G.renderer.shake(3);
  G.keys.noise(scene, b.doorX * 16 + 8, b.doorY * 16, 4);
  if (Math.random() < chance) { (scene.world.brokenDoors = scene.world.brokenDoors || {})[this.key(scene.map, b)] = scene.world.day; this.burgle(scene, b); scene.toast('BAM! The door flies open.', 'warn'); G.events.emit('xp', 8, 'Kicked in a door'); }
  else { p.hp = Math.max(1, p.hp - 3); p.stamina = Math.max(0, p.stamina - 30); scene.floatText(p.x, p.y - 20, '-3', '#ff6050'); scene.toast(str < need ? 'Ow. The door wins. (You are not strong enough for this one.)' : 'The door holds. Try again?', 'bad'); }
};

// ---------------------------------------------------------------- NPCs stop at locked doors without a key
const NP = G.NPC.prototype, _walk = NP.walkTo;
NP.walkTo = function (pt, dt, scene, run) {
  const map = scene.map;
  if (pt && !map.meta.floorOf && (scene.npcLockT = scene.npcLockT || 0) >= 0) {
    const goalB = map.buildingAtTile(pt.x, pt.y), here = map.buildingAt(this.x, this.y - 3);
    if (goalB && goalB !== here && Math.hypot(this.x - (goalB.doorX * 16 + 8), this.y - ((goalB.doorY + 1) * 16 + 8)) < 30) {
      const cache = scene.lockCache || (scene.lockCache = {});
      if (cache[goalB.id] == null || (cache.t || 0) < scene.time - 1) { cache[goalB.id] = D.baseLocked(scene, goalB); cache.t = scene.time; }
      if (cache[goalB.id] && !G.keys.npcHas(this, map, goalB)) {
        this.moving = false; this.path = null;
        this.doorT = (this.doorT || 0) + dt;
        if ((this.state === 'fight' || this.state === 'arrest') && this.doorT > 2.5 && this.def.combat !== 'flee') {
          this.say(this.def.combat === 'guard' ? 'Police! Open up! ...Fine.' : 'You think a door is gonna stop me?!', 2);
          (scene.world.brokenDoors = scene.world.brokenDoors || {})[D.key(map, goalB)] = scene.world.day;
          cache[goalB.id] = false; this.doorT = 0;
          G.keys.noise(scene, goalB.doorX * 16 + 8, goalB.doorY * 16, 4);
        } else if (this.doorT > 1 && !this.knocked) { this.knocked = true; this.say(G.rng.pick(['*knock knock*', 'Hello? Anyone home?', 'Locked. Great.']), 2); }
        return;
      }
    }
  }
  this.doorT = 0; this.knocked = false;
  return _walk.call(this, pt, dt, scene, run);
};

// ---------------------------------------------------------------- pickpocketing, sneaking around houses at night
const GS = G.GameScene.prototype, _find = GS.findInteraction, _upd = GS.update, _load = GS.loadMap;
const behind = (scene, a) => {
  const p = scene.player, [fx, fy] = G.util.DIR_VEC[a.dir], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
  return a.sleeping || (dx * fx + dy * fy) / d < -0.2;
};
GS.findInteraction = function () {
  const best = _find.call(this);
  if (best && best.type === 'npc' && !best.ref.def.kid && best.ref.state === 'schedule' && behind(this, best.ref)) best.label += '  ·  [G] Pickpocket';
  return best;
};
G.keys.pickpocket = function (scene, a) {
  const p = scene.player, w = scene.world, st = a.st;
  const chance = G.util.clamp(0.3 + (G.skills.stat(p, 'stealth') || 0) * 0.1 + G.skills.rank(p, 'sneaky') * 0.1 + (G.skills.stat(p, 'luck') || 0) * 0.03 + (a.sleeping ? 0.35 : 0) - (G.social.persona(a.id).trait === 'suspicious' ? 0.15 : 0), 0.05, 0.92);
  if (Math.random() < chance) {
    const keys = (st.inv || []).filter((e) => e[0].startsWith(KEY) && e[1] > 0), items = (st.inv || []).filter((e) => e[1] > 0 && !e[0].startsWith(KEY) && e[0] !== a.def.weapon && e[0] !== a.def.armor);
    let got;
    if (keys.length && Math.random() < 0.5) { const e = G.rng.pick(keys); e[1]--; p.inventory.add(e[0], 1); got = G.item(e[0]).name; }
    else if (st.gold > 0 && Math.random() < 0.6) { const n = Math.max(1, Math.round(st.gold * G.rng.range(0.2, 0.6))); st.gold -= n; p.gold += n; got = '$' + n; }
    else if (items.length) { const e = G.rng.pick(items); e[1]--; p.inventory.add(e[0], 1); got = G.item(e[0]).name; }
    else got = 'pocket lint';
    st.inv = (st.inv || []).filter((e) => e[1] > 0);
    scene.toast(`Pickpocketed: ${got}.`, 'good'); G.events.emit('xp', 6, 'Pickpocketing');
    return true;
  }
  a.sleeping = false; a.faceTowards(p);
  a.say(G.rng.pick(['Hey! Get your hand out of my pocket!', 'THIEF!', 'Are you robbing me?!']), 3);
  G.social.addDisp(w, a.id, -25);
  scene.reportCrime('theft', a, 10);
  if (a.def.combat !== 'flee') { a.aggressor = true; a.startFight(p, scene); } else { st.fear = 80; a.startFlee(p); }
  return false;
};
GS.update = function (dt) {
  const I = G.input, t = this.promptTarget;
  if (I.wasPressed('drag') && t && t.type === 'npc' && !t.ref.def.kid && t.ref.state === 'schedule' && behind(this, t.ref) && !this.player.dragging) {
    for (const k of G.input.bindings.drag || []) I.pressed.delete(k);
    G.keys.pickpocket(this, t.ref);
  }
  const r = _upd.call(this, dt);
  // creeping around a house at night wakes people up
  const p = this.player;
  if (p && !p.dead && this.map && (this.sneakT = (this.sneakT || 0) - dt) <= 0) {
    this.sneakT = 0.5;
    const b = this.map.buildingAt(p.x, p.y - 3);
    if (b && this.world.isNight() && !G.doors.allowed(this, b, 'front')) {
      const quiet = (G.skills.has(p, 'cat_burglar') ? 0.5 : 1) * (G.skills.rank(p, 'sneaky') ? 0.6 : 1) * (p.moving && G.input.isDown('run') ? 3 : 1);
      for (const a of this.actors) {
        if (a.kind !== 'npc' || a.dead || !a.sleeping || a.distTo(p) > 70) continue;
        if (Math.random() < 0.035 * quiet) { a.sleeping = false; a.say('...Is someone there?', 2); G.keys.defend(this, a, b); }
      }
      for (const a of this.actors) if (a.kind === 'npc' && !a.dead && !a.sleeping && !a.defending && G.doors.residents(this, b).includes(a.id) && a.canSee(this, p, 90)) G.keys.defend(this, a, b);
    }
  }
  return r;
};
GS.loadMap = function (id, spawnName, pos) {
  _load.call(this, id, spawnName, pos);
  G.keys.ensure(this.world, this.player);
  for (const a of this.actors) a.defending = false;
};

// ---------------------------------------------------------------- a spare key from people who trust you
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner, st = npc.st, p = runner.scene.player, d = npc.def;
  if (npc.transient || d.kid || !d.home || !(st.partner || (st.disp || 0) >= 70)) return [];
  if (p.inventory.has(G.keys.id(d.map, d.home))) return [];
  return [{ text: 'Could I have a spare key to your place?', next: '_spare_key' }];
});
G.DIALOGUE_NODES._spare_key = (r) => {
  const { npc } = r, st = npc.st, w = r.scene.world, d = npc.def;
  const ok = st.partner || (st.disp || 0) >= 80 || r.c.check('spare_key', 7);
  if (!ok) return { text: 'A key? Let us not rush things.', choices: [{ text: 'Fair enough.', next: 'start' }] };
  r.scene.player.inventory.add(G.keys.id(d.map, d.home), 1);
  (w.keys = w.keys || {})[d.home] = true;
  return { text: G.rng.pick(['Here. Do not lose it.', 'Sure. Come by whenever you want.', 'Here you go. Make yourself at home.']), choices: [{ text: 'Thanks.', next: 'start' }] };
};
})();
