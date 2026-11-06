'use strict';
(() => {
// Doors, locks & trespassing — and the everyday objects of the new interiors.
//   Locks:     homes lock at night (how often depends on who lives there and the neighborhood; burgled
//              people always lock up), shops lock when closed, offices and mansions lock after hours.
//              At a locked door: knock (friends let you in), use your key, pick the lock (lockpicks,
//              a timing minigame; skill makes it easier), or break it down with a crowbar (loud).
//   Safes:     locked; pick them (harder) to get at what is inside.
//   Trespass:  being somewhere private without permission (someone's home, a shop's back room, closed
//              businesses). If a resident or the staff sees you they warn you, then call it in.
//              Permission: your home, your partner's, a key, an invitation, friends at home in the day.
//   Floors:    stairs and elevators between floors (js/data/floors.js).

G.doors = {
  key(map, b) { return map.id + ':' + b.id; },
  residents(scene, b) { return (scene.residents[b.id] || []).filter((id) => scene.world.isAlive(id)); },
  shopOf(scene, b) { return Object.keys(G.SHOPS).find((s) => { const o = scene.world.shopOwner ? scene.world.shopOwner(s) : G.SHOPS[s].owner; return o && G.NPCS[o] && G.NPCS[o].home === b.id && G.NPCS[o].map === scene.map.id; }) || null; },
  isPublic(scene, b) {
    const k = b.kind;
    if (k === 'temple' || k === 'barracks' || k === 'inn' || k === 'camp') return true;
    if (b.id === 'h_casino') { const h = scene.world.hourF; return h >= 15 || h < 4; }
    if (k === 'manor') return scene.world.hour >= 8 && scene.world.hour < 18;
    return false;
  },
  lockTier(scene, b) {
    const d = scene.map.meta.district;
    if (b.kind === 'mansion' || b.kind === 'club' || b.id === 'h_casino') return 4;
    if (d === 'heights' || b.kind === 'office') return 3;
    if (this.shopOf(scene, b)) return 2;
    return d === 'suburbs' || d === 'center' ? 2 : 1;
  },
  // Does the player have the right to be in here?
  allowed(scene, b, area = 'front') {
    const w = scene.world, key = this.key(scene.map, b);
    if (w.flags.player_home === b.id) return true;
    if ((w.keys || {})[b.id]) return true;
    if ((w.invites || {})[b.id] >= G.effects.now()) return true;
    const res = this.residents(scene, b);
    if (res.some((id) => w.npcs[id].partner)) return true;
    // someone who lives (or works) here is close to you: a friend, someone you are seeing, in your party, or you
    // spent the night together (today or yesterday): you are welcome, front and back
    if (res.some((id) => { const s = w.npcs[id]; return (s.disp || 0) >= 40 || (s.romance || 0) >= 40 || s.companion || (s.loveDay != null && w.day - s.loveDay <= 1); })) return true;
    if (area === 'front' && this.isPublic(scene, b)) return true;
    const sid = this.shopOf(scene, b);
    if (sid && area === 'front' && G.shopSys.isOpen(sid, scene)) return true;
    if (area === 'front' && !w.isNight() && res.some((id) => (w.npcs[id].disp || 0) >= 60 && scene.actors.some((a) => a.id === id && scene.map.buildingAt(a.x, a.y - 3) === b))) return true;
    if (!res.length && !sid && !b.ownerId) return true;   // abandoned / nobody's
    if ((w.unlocked || {})[key] === w.day && area === 'front' && !res.length) return true;
    return false;
  },
  // Is the front door locked right now (for the player)? Shops follow their hours; homes are locked and
  // unlocked by hand: a resident walks to the door and turns the key (see lockState below).
  locked(scene, b) {
    const w = scene.world, key = this.key(scene.map, b);
    if (scene.map.meta.floorOf) return false;
    if (w.flags.player_home === b.id || (w.keys || {})[b.id]) return false;
    if ((w.unlocked || {})[key] === w.day) return false;
    if (w.brokenDoors && w.brokenDoors[key] && w.day - w.brokenDoors[key] < 3) return false;
    if (this.isPublic(scene, b)) return false;
    const sid = this.shopOf(scene, b);
    if (sid) {   // the keeper locks up at closing and opens in the morning, by hand (when they are around to do it)
      const keeper = scene.actors.find((a) => a.kind === "npc" && !a.dead && this.residents(scene, b).includes(a.id));
      const L0 = w.doorLocks || (w.doorLocks = {});
      if (!keeper || L0[key] == null) return !G.shopSys.isOpen(sid, scene);
      return L0[key];
    }
    if (!this.residents(scene, b).length && !b.ownerId) return false;
    const L = w.doorLocks || (w.doorLocks = {});
    if (L[key] == null) L[key] = this.wants(scene, b);
    return L[key];
  },
  // Would the people living here want it locked right now?
  wants(scene, b) {
    const w = scene.world, key = this.key(scene.map, b);
    if (scene.map.meta.floorOf) return false;
    if (w.flags.player_home === b.id || (w.keys || {})[b.id]) return false;
    if ((w.unlocked || {})[key] === w.day) return false;
    if (w.brokenDoors && w.brokenDoors[key] && w.day - w.brokenDoors[key] < 3) return false;
    if (this.isPublic(scene, b)) return false;
    const sid = this.shopOf(scene, b);
    if (sid) return !G.shopSys.isOpen(sid, scene);
    const res = this.residents(scene, b);
    if (!res.length && !b.ownerId) return false;
    const h = w.hourF, night = h >= 22 || h < 7;
    const P = res.length ? G.social.persona(res[0]) : { trait: 'friendly' };
    let chance = { suspicious: 0.95, nervous: 0.9, proud: 0.8, grumpy: 0.7, tired: 0.5, friendly: 0.45, chatty: 0.4, cheerful: 0.35 }[P.trait] || 0.5;
    if (['southside', 'eastside', 'heights'].includes(scene.map.meta.district)) chance += 0.3;
    if (w.burgled && w.day - (w.burgled[key] || -99) < 7) chance = 1;
    if (b.kind === 'mansion' || b.kind === 'office') chance = 1;
    const roll = (G.util.hashString(key + w.day + (night ? 'n' : 'd')) % 100) / 100;
    if (night) return roll < chance;
    const someoneHome = scene.actors.some((a) => res.includes(a.id) && scene.map.buildingAt(a.x, a.y - 3) === b);
    return !someoneHome && roll < chance * 0.6;   // out for the day: often locked
  },

  // ---- every half second: which doors are locked, are we trespassing? ----
  update(scene, dt) {
    if ((this.t = (this.t || 0) - dt) > 0) return;
    this.t = 0.5;
    const map = scene.map, p = scene.player;
    if (scene.lockSyncMap !== map) this.syncLocks(scene);
    if (!map.meta.floorOf) this.lockRounds(scene);
    scene.lockedDoors = map.meta.floorOf ? [] : map.buildings.filter((b) => this.locked(scene, b)).map((b) => b);
    this.trespass(scene, 0.5);
  },
  // While you were away (another map, a time skip) people locked up as they wanted to.
  syncLocks(scene) {
    const w = scene.world, L = w.doorLocks || (w.doorLocks = {});
    scene.lockSyncMap = scene.map;
    for (const b of scene.map.buildings) L[this.key(scene.map, b)] = this.wants(scene, b);
    for (const a of scene.actors) a.doorTask = null;
  },
  // On screen nothing locks itself: someone who lives there walks to the door and turns the key.
  // Coming home or heading out they lock up behind them; at bedtime someone checks the front door.
  lockRounds(scene) {
    const w = scene.world, map = scene.map, L = w.doorLocks || (w.doorLocks = {});
    for (const a of scene.actors) {
      if (a.kind !== "npc" || a.dead || !a.def.home) continue;
      const b = map.building(a.def.home);
      if (!b) continue;
      const inside = map.buildingAt(a.x, a.y - 3) === b;
      if (a.wasInside != null && a.wasInside !== inside && !a.sleeping && a.state === "schedule") {
        const key = this.key(map, b), want = this.wants(scene, b);
        if (L[key] !== want) { L[key] = want; a.say(want ? "*locks the door*" : "*unlocks the door*", 1.5); G.audio.play("door"); }
      }
      a.wasInside = inside;
    }
    for (const b of map.buildings) {
      const key = this.key(map, b), want = this.wants(scene, b);
      if (L[key] == null) { L[key] = want; continue; }
      if (L[key] === want) continue;
      const res = this.residents(scene, b);
      if (scene.actors.some((a) => a.doorTask && a.doorTask.b === b)) continue;
      const who = scene.actors.find((a) => a.kind === "npc" && !a.dead && !a.sleeping && !a.talking && a.state === "schedule" && res.includes(a.id) && map.buildingAt(a.x, a.y - 3) === b);
      if (who) who.doorTask = { b, lock: want, t: 0 };
    }
  },
  trespass(scene, dt) {
    const w = scene.world, p = scene.player, map = scene.map;
    if (p.dead || w.jail) return;
    if (G.scenes.top() !== scene) return;   // (talking to them about it, a fade, a menu: nobody calls the police meanwhile)
    const floor = map.meta.floorOf;
    let b = map.buildingAt(p.x, p.y - 3);
    if (!b) { scene.trespassT = 0; scene.trespassIn = null; return; }
    const ptx = Math.floor(p.x / 16), pty = Math.floor((p.y - 3) / 16);
    const back = b.backroom && ptx >= b.backroom.x && ptx < b.backroom.x + b.backroom.w && pty >= b.backroom.y && pty < b.backroom.y + b.backroom.h;
    if (floor) return;   // upstairs nobody is watching (the door downstairs was the obstacle)
    if (this.allowed(scene, b, back ? 'back' : 'front')) { scene.trespassT = 0; scene.trespassIn = null; return; }
    if (scene.trespassIn !== b.id) { scene.trespassIn = b.id; scene.trespassT = 0; scene.trespassWarned = false; scene.toast(back ? 'Staff only. You should not be back here.' : `Trespassing: ${b.name}.`, 'warn'); }
    const sneak = G.skills.has(p, 'cat_burglar') ? 0.6 : 1;
    const watcher = scene.actors.find((a) => a.kind === 'npc' && !a.dead && !a.sleeping && a.state === 'schedule' && a.canSee(scene, p, 90 * sneak) && (this.residents(scene, b).includes(a.id) || G.NPCS[a.id] && G.NPCS[a.id].home === b.id || a.def.combat === 'guard'));
    if (!watcher) return;
    scene.trespassT += dt;
    if (!scene.trespassWarned) {
      scene.trespassWarned = true;
      watcher.faceTowards(p);
      watcher.say(G.rng.pick(['Hey! You can not be in here!', 'Excuse me?! Get out!', 'This is private property. Leave. Now.', 'Who let you in?!']), 3);
    } else if (scene.trespassT > 6) {
      scene.trespassT = -20;
      watcher.say(watcher.def.combat === 'fight' && (watcher.st.disp || 0) < 0 ? 'That is it!' : 'I am calling the police!', 3);
      scene.reportCrime('trespass', watcher);
      if (watcher.def.combat === 'fight' && (watcher.st.disp || 0) < -10) { watcher.aggressor = true; watcher.startFight(p, scene); }
    }
  },

  // The locked door the player is standing at (outside, facing it), if any.
  doorAhead(scene) {
    const p = scene.player, list = scene.lockedDoors || [];
    const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
    return list.find((b) => Math.abs(tx - b.doorX) <= 0 && ty === b.doorY + 1 && p.dir === 3) || list.find((b) => Math.abs(p.x - (b.doorX * 16 + 8)) < 12 && ty === b.doorY + 1) || null;
  },

  menu(scene, b) {
    const p = scene.player, w = scene.world, key = this.key(scene.map, b);
    const opts = [];
    opts.push({ label: 'Knock', fn: () => this.knock(scene, b) });
    if (p.inventory.has('lockpick')) opts.push({ label: `Pick the lock (${['', 'cheap', 'standard', 'secure', 'high-security'][this.lockTier(scene, b)]} lock)`, fn: () => this.pick(scene, this.lockTier(scene, b), () => { (w.unlocked = w.unlocked || {})[key] = w.day; this.burgle(scene, b); scene.toast('Click. The door is open.', 'good'); }) });
    else opts.push({ label: 'Pick the lock (you need a lockpick)', disabled: true });
    if (p.inventory.has('crowbar')) opts.push({ label: 'Break the door down (crowbar, loud)', fn: () => this.breakDoor(scene, b) });
    opts.push({ label: 'Leave', fn: () => {} });
    G.scenes.push(new ChoiceScene(`${b.name}: locked`, 'The door is locked.', opts));
  },
  knock(scene, b) {
    const w = scene.world, res = this.residents(scene, b);
    G.audio.play('door');
    const home = scene.actors.filter((a) => res.includes(a.id) && !a.dead && scene.map.buildingAt(a.x, a.y - 3) === b);
    if (!home.length) { scene.toast('You knock. No answer.'); return; }
    const a = home.find((x) => !x.sleeping) || home[0];
    const st = a.st, friend = st.partner || (st.disp || 0) >= 40 || ((w.invites || {})[b.id] >= G.effects.now());
    if (a.sleeping) {
      if (!G.rng.chance(friend ? 0.7 : 0.35)) { scene.toast('You knock. Somebody grumbles in their sleep. Nobody comes.'); return; }
      a.sleeping = false; G.social.addDisp(w, a.id, friend ? -2 : -8);
    }
    if (friend) {
      (w.unlocked = w.unlocked || {})[this.key(scene.map, b)] = w.day;
      (w.invites = w.invites || {})[b.id] = G.effects.now() + 180;
      a.say(G.rng.pick(['Oh, it is you! Come in.', 'Door is open, come on in.', 'Hey! Get in here.']), 3);
      scene.toast(`${w.displayName(a.id)} lets you in.`, 'good');
    } else a.say(w.isNight() ? G.rng.pick(['It is the middle of the night! Go away!', 'Whoever you are, I have a bat.']) : G.rng.pick(['Who is it? ...I do not know you. Go away.', 'Not interested!', 'We do not want any!']), 3);
  },
  breakDoor(scene, b) {
    const w = scene.world, key = this.key(scene.map, b);
    G.audio.play('hit'); scene.shake && scene.shake(4);
    (w.brokenDoors = w.brokenDoors || {})[key] = w.day;
    this.burgle(scene, b);
    scene.toast('CRACK. The door gives way.', 'warn');
    // everyone around hears it
    const p = scene.player;
    const heard = scene.actors.find((a) => a.kind === 'npc' && !a.dead && G.util.dist(a.x, a.y, p.x, p.y) < 200);
    if (heard) { heard.say('What was that?!', 2); scene.reportCrime('vandalism', null, 40, this.residents(scene, b)[0] || null); }
  },
  burgle(scene, b) { (scene.world.burgled = scene.world.burgled || {})[this.key(scene.map, b)] = scene.world.day; },

  // ---- lockpicking ----
  pick(scene, tier, onOpen) {
    const p = scene.player;
    if (tier >= 4 && !G.skills.has(p, 'locksmith')) { scene.toast('A high-security lock. You need the Locksmith skill.', 'bad'); return; }
    G.scenes.push(new LockpickScene(scene, tier, onOpen));
  },
};

// ---------------------------------------------------------------- choice menu (doors, elevators...)
class ChoiceScene {
  constructor(title, text, options) { this.transparent = true; this.title = title; this.text = text; this.options = options; this.sel = options.findIndex((o) => !o.disabled); }
  choose(i) { const o = this.options[i]; if (!o || o.disabled) return; G.scenes.remove(this); G.audio.play('confirm'); o.fn(); }
  update() {
    const U = G.ui, r = U.nav(this, 'sel', this.options.length);
    if (r === 'confirm') this.choose(this.sel);
    if (r === 'cancel') { G.audio.play('back'); G.scenes.remove(this); }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer;
    U.dim(ctx, 0.45);
    const w = 260, h = 46 + this.options.length * 20 + (this.text ? 14 : 0), x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: this.title, titleSize: 12 });
    if (this.text) U.text(ctx, this.text, R.uiW / 2, y + 26, { align: 'center', size: 9, color: U.colors.dim });
    const i = U.menu(ctx, this, this.options.map((o) => ({ label: o.label, disabled: o.disabled })), x + 12, y + (this.text ? 42 : 30), w - 24, 17, 3);
    if (i >= 0) this.choose(i);
  }
}
G.ChoiceScene = ChoiceScene;

// ---------------------------------------------------------------- lockpicking minigame
// Each pin: a marker swings across the bar; press [E]/[Space] when it is in the gold zone. Missing jars
// the pick (it may break). Higher tiers: more pins, faster, smaller zones. Skill and luck widen the zone.
class LockpickScene {
  constructor(game, tier, onOpen) {
    this.transparent = true; this.game = game; this.tier = tier; this.onOpen = onOpen;
    this.pins = tier + 1; this.done = 0; this.t = 0; this.flash = 0; this.msg = '';
    const p = game.player, sk = G.skills.rank(p, 'lockpicking'), luck = G.skills.stat(p, 'luck') || 0;
    this.zone = Math.max(0.07, 0.24 - tier * 0.04 + sk * 0.04 + luck * 0.01 + (G.attr ? (G.attr.get(p, 'knowledge') - 3) * 0.012 : 0));   // Knowledge helps (js/game/attributes.js)
    this.speed = 0.8 + tier * 0.35;
    this.breakChance = Math.max(0.08, 0.45 - sk * 0.08 - (G.skills.has(p, 'locksmith') ? 0.2 : 0));
    this.newPin();
  }
  newPin() { this.center = 0.2 + Math.random() * 0.6; this.t = Math.random() * 2; }
  pos() { return (Math.sin(this.t * this.speed * Math.PI) + 1) / 2; }
  update(dt) {
    const I = G.input, p = this.game.player;
    this.t += dt; if (this.flash > 0) this.flash -= dt;
    if (I.wasPressed('cancel')) { G.scenes.remove(this); return; }
    if (I.wasPressed('interact') || I.wasPressed('confirm') || I.pressed.has('Space')) {
      if (Math.abs(this.pos() - this.center) <= this.zone / 2) {
        this.done++; G.audio.play('select'); this.msg = 'Click.';
        if (this.done >= this.pins) {
          G.scenes.remove(this);
          G.events.emit('xp', 6 + this.tier * 6, 'Lockpicking');
          this.onOpen();
          return;
        }
        this.newPin();
      } else {
        this.flash = 0.3;
        if (Math.random() < this.breakChance) {
          p.inventory.remove('lockpick', 1);
          G.audio.play('hit');
          this.msg = 'SNAP. The pick broke.';
          if (!p.inventory.has('lockpick')) { G.scenes.remove(this); this.game.toast('Your last lockpick broke.', 'bad'); return; }
          this.done = Math.max(0, this.done - 1);
        } else this.msg = 'The pin slips.';
      }
    }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer;
    U.dim(ctx, 0.5);
    const w = 280, h = 130, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: 'Lockpicking', titleSize: 12 });
    // the pins
    for (let i = 0; i < this.pins; i++) {
      const px = x + w / 2 - this.pins * 9 + i * 18;
      ctx.fillStyle = i < this.done ? '#e8c040' : '#5a5a62'; ctx.fillRect(px, y + 30 + (i < this.done ? 0 : 6), 10, 16);
    }
    const bx = x + 20, by = y + 66, bw = w - 40;
    ctx.fillStyle = this.flash > 0 ? '#5a1a1a' : '#1a1a20'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(bx + (this.center - this.zone / 2) * bw, by, this.zone * bw, 12);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + this.pos() * bw - 1, by - 3, 3, 18);
    U.text(ctx, this.msg || 'Stop the pick in the gold zone.', R.uiW / 2, by + 20, { align: 'center', size: 8, color: U.colors.dim });
    U.text(ctx, `Lockpicks: ${this.game.player.inventory.count('lockpick')}`, R.uiW / 2, y + h - 14, { align: 'center', size: 7, color: U.colors.dim });
  }
}
G.LockpickScene = LockpickScene;

// ---------------------------------------------------------------- the player cannot walk through locked doors
const _move = G.Player.prototype.move;
G.Player.prototype.move = function (map, dx, dy, slide) {
  const scene = G.doors.scene;
  const list = scene && scene.map === map ? scene.lockedDoors : null;
  if (!list || !list.length) return _move.call(this, map, dx, dy, slide);
  // only from the outside (you can always unlock it from inside), and only once you are fully out of the
  // doorway: shutting it while your feet still overlap it would trap you in the frame
  const top = Math.floor((this.y - this.h) / 16);
  const shut = list.filter((b) => top > b.doorY);
  for (const b of shut) map.solid[b.doorY * map.w + b.doorX] = 1;
  const r = _move.call(this, map, dx, dy, slide);
  for (const b of shut) map.recomputeSolid(b.doorX, b.doorY);
  return r;
};

// ---------------------------------------------------------------- residents walk over and lock / unlock the door
const _npcUpdate = G.NPC.prototype.update;
G.NPC.prototype.update = function (dt, scene) {
  const t = this.doorTask;
  if (t && !this.dead && !this.talking && !this.sleeping && this.state === "schedule") {
    this.baseUpdate(dt, scene.map);
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    const b = t.b, pt = { x: b.doorX + Math.round(t.side || 0), y: b.doorY - 1 };   // beside the door, not in it
    t.t += dt;
    if (Math.hypot(this.x - (pt.x * 16 + 8), this.y - (pt.y * 16 + 12)) < 10 || t.t > 25) {
      const w = scene.world;
      (w.doorLocks = w.doorLocks || {})[G.doors.key(scene.map, b)] = t.lock;
      this.doorTask = null; this.moving = false; this.dir = 0;
      this.say(t.lock ? "*locks the door*" : "*unlocks the door*", 1.5);
      if (this.distTo(scene.player) < 160) G.audio.play("door");
      return;
    }
    this.walkTo(pt, dt, scene);
    return;
  }
  if (t && (this.dead || this.state !== "schedule")) this.doorTask = null;
  return _npcUpdate.call(this, dt, scene);
};

// ---------------------------------------------------------------- GameScene hooks
const GS = G.GameScene.prototype;
const _update = GS.update, _find = GS.findInteraction, _interact = GS.interact;
const _resyncD = GS.resyncNPCs;
GS.resyncNPCs = function () { this.lockSyncMap = null; return _resyncD.call(this); };   // time passed: doors are as people left them
GS.update = function (dt) {
  G.doors.scene = this;
  if (this.map && this.player) G.doors.update(this, dt);
  return _update.call(this, dt);
};
GS.findInteraction = function () {
  const best = _find.call(this);
  const b = G.doors.doorAhead(this);
  if (b && (!best || best.type === 'decor')) return { type: 'door', ref: b, label: `${b.name} (locked)` };
  return best;
};
GS.interact = function () {
  const t = this.promptTarget;
  if (t && t.type === 'door') { G.doors.menu(this, t.ref); return; }
  if (t && t.type === 'container' && t.ref.style === 'safe' && !t.ref.open && t.ref.owner !== 'player' && this.world.isAlive(t.ref.owner || '')) {
    const c = t.ref, p = this.player;
    G.scenes.push(new ChoiceScene('Safe', 'It is locked.', [
      p.inventory.has('lockpick') ? { label: 'Crack it (lockpick)', fn: () => G.doors.pick(this, c.id.includes('vault') ? 4 : 3, () => { c.open = true; G.scenes.push(new G.LootScene(this, c)); }) } : { label: 'Crack it (you need a lockpick)', disabled: true },
      { label: 'Leave it', fn: () => {} },
    ]));
    return;
  }
  return _interact.call(this);
};

// ---------------------------------------------------------------- stairs, elevators & household objects
G.usables.LABELS = Object.assign(G.usables.LABELS, { toilet: 'Use the toilet', shower: 'Take a shower', mirror: 'Look in the mirror', piano: 'Play the piano', pool: 'Play pool', stairs: 'Take the stairs', elevator: 'Call the elevator' });
const LOOKS = {
  washer: 'A washing machine. Someone left socks in it.', clothes_rack: 'Clothes on hangers. The price tags are ambitious.', gun_rack: 'Rifles and shotguns behind a locked bar. Ask at the counter.',
  display_case: 'A glass case. Everything inside is worth more than your car.', counter: 'A counter. Talk to whoever works here.',
};
const _label = G.usables.label;
G.usables.label = function (d, scene) {
  if (d.def.interact === 'stairs') return d.type === 'stairs_up' ? 'Go upstairs' : 'Go downstairs';
  if (d.type === 'stove') return 'Cook on the stove';
  if (d.type === 'sink' || d.type === 'kcounter_sink' || d.type === 'watercooler') return 'Drink water';
  return _label.call(this, d, scene);
};
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  const p = scene.player, w = scene.world, k = d.def.interact;
  switch (k) {
    case 'stairs':
      if (d.to && G.MAPGEN[d.to]) { G.audio.play('door'); scene.changeMap(d.to, d.spawn); }
      return;
    case 'elevator': {
      const spec = G.FLOORS[d.building], top = spec.levels.length + 1, opts = [];
      for (let n = 1; n <= top; n++) {
        const here = n === d.level;
        opts.push({ label: (n === 1 ? 'Ground floor' : `Floor ${n}`) + (here ? ' (you are here)' : ''), disabled: here, fn: () => { G.audio.play('select'); scene.changeMap(n === 1 ? spec.base : G.floorId(d.building, n), n === 1 ? d.building + '_elev' : 'from_elev'); } });
      }
      G.scenes.push(new ChoiceScene('Elevator', 'Ding. Which floor?', opts));
      return;
    }
    case 'toilet':
      w.addMinutes(15);
      if (p.alcohol > 40 || G.effects.has(p, 'nausea')) { G.effects.remove(p, 'nausea'); p.alcohol = Math.max(0, p.alcohol - 15); scene.toast('You throw up in the toilet. Classy, but you feel better.'); }
      else scene.toast(G.rng.pick(['You use the toilet. You wash your hands. Right?', 'Ahh. Relief.', 'You flush. The pipes groan.']));
      return;
    case 'shower':
      w.addMinutes(30);
      p.stamina = p.maxStamina; p.bloody = 0;
      G.effects.add(p, 'fresh', 600);
      scene.toast('A hot shower. You feel human again (and you no longer smell like it).', 'good');
      return;
    case 'mirror': {
      const notes = [];
      if (p.hp < p.maxHp * 0.5) notes.push('bruised and bloody');
      if (p.alcohol > 40) notes.push('red-eyed and swaying');
      if ((p.rest != null ? p.rest : 100) < 25) notes.push('dark circles under your eyes');
      if (p.preg && G.love.belly(p.preg) > 1) notes.push('definitely showing');
      if (G.effects.has(p, 'trip')) notes.push('...is that your face, or a melting candle?');
      G.scenes.push(new G.MessageScene(notes.length ? `You look ${notes.join(', ')}.` : G.rng.pick(['Looking good. Mostly.', 'You give yourself a nod. Still got it.', 'The person in the mirror looks tired of your nonsense.'])));
      return;
    }
    case 'piano': {
      w.addMinutes(30);
      const good = G.skills.stat(p, 'charisma') + G.rng.int(0, 6) >= 9;
      scene.toast(good ? 'You play something slow and lovely. For a moment, everything is fine.' : 'You play Chopsticks. Badly. Somewhere, a dog howls.', good ? 'good' : 'info');
      if (good) G.effects.add(p, 'fresh', 300);
      return;
    }
    case 'pool': {
      scene.passTime(1, false);
      const mates = (G.companions && G.companions.list(scene)) || [];
      for (const a of mates) G.social.addDisp(w, a.id, 4);
      scene.toast(mates.length ? `You shoot pool with ${w.displayName(mates[0].id)}. They talk trash the whole game.` : 'You shoot a few racks alone. You sink the eight ball. On the break. Nobody saw.');
      return;
    }
    case 'look':
      if (LOOKS[d.type]) { G.scenes.push(new G.MessageScene(LOOKS[d.type])); return; }
      break;
  }
  return _use.call(this, d, scene);
};
G.EFFECTS.fresh = { name: 'Fresh', kind: 'buff', color: '#8ad8f0', stats: { charisma: 1 }, desc: 'Clean and presentable. People like that.' };

// ---------------------------------------------------------------- upper floors: who owns what, hotel beds
const _ownerOf = G.beds.ownerOf, _isMine = G.beds.isMine, _owner = G.usables.owner;
G.beds.ownerOf = function (scene, d) {
  const f = scene.map.meta.floorOf;
  if (!f) return _ownerOf.call(this, scene, d);
  if (d.guest) { const sid = Object.keys(G.SHOPS).find((s) => G.SHOPS[s].room && G.NPCS[scene.world.shopOwner(s)] && G.NPCS[scene.world.shopOwner(s)].home === f.b); return sid ? scene.world.shopOwner(sid) : null; }
  const b = scene.map.buildingAtTile(d.tx, d.ty);
  return b && b.ownerId && scene.world.isAlive(b.ownerId) ? b.ownerId : null;
};
G.beds.isMine = function (scene, d) {
  const f = scene.map.meta.floorOf, w = scene.world;
  if (f && d.guest && w.rooms[f.map] != null && w.rooms[f.map] >= w.day) return true;
  if (f && w.flags.player_home === f.b) return true;
  return _isMine.call(this, scene, d);
};
G.usables.owner = function (scene, d) {
  const f = scene.map.meta.floorOf;
  if (!f) return _owner.call(this, scene, d);
  if (scene.world.flags.player_home === f.b) return 'player';
  const b = scene.map.buildingAtTile(d.tx, d.ty);
  return b && b.ownerId && scene.world.isAlive(b.ownerId) ? b.ownerId : null;
};
})();

// ---------------------------------------------------------------- nobody plugs a doorway
// Whoever goes to lock up stands beside the door, not in it, and waits until you are through; anyone in a
// doorway (or right in front of it) steps aside for you instead of shoving you back inside.
(() => {
const GS2 = G.GameScene.prototype, _sep = GS2.separate;
const doorNear = (map, x, y) => {
  const tx = Math.floor(x / 16), ty = Math.floor((y - 3) / 16);
  return map.buildings.find((b) => !b.destroyed && Math.abs(tx - b.doorX) <= 1 && ty >= b.doorY - 1 && ty <= b.doorY + 1);
};
GS2.separate = function () {
  const p = this.player, map = this.map;
  if (p && map && map.buildings && doorNear(map, p.x, p.y)) {
    for (const a of this.actors) {
      if (a === p || a.dead || a.sleeping || a.kind === 'player' || (a.st && a.st.ko) || a.downT > 0.35 || a.crash) continue;
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), min = 7 + a.radius * 0.6;
      if (d >= min || d < 0.01) continue;
      // they give way (sideways first, the doorway is narrow)
      const push = (min - d) * 0.6, side = Math.abs(dx) < 2 ? (a.x >= p.x ? 1 : -1) : Math.sign(dx);
      a.move(map, side * push * 1.4, (dy / d) * push);
    }
    return;
  }
  return _sep.call(this);
};
const NP = G.NPC.prototype, _up = NP.update;
NP.update = function (dt, scene) {
  const t = this.doorTask;
  if (t && !t.side) {
    const b = t.b, m = scene.map, ok = (x) => m.inBounds(x, b.doorY - 1) && !m.solid[(b.doorY - 1) * m.w + x];
    t.side = ok(b.doorX - 1) ? -1 : ok(b.doorX + 1) ? 1 : 0.01;
  }
  if (t && scene.player) {
    // not while you are in the doorway: wait for you to get through
    const p = scene.player, b = t.b;
    if (Math.abs(p.x - (b.doorX * 16 + 8)) < 14 && Math.abs(p.y - (b.doorY * 16 + 8)) < 22) { t.t = Math.min(t.t, 20); this.moving = false; this.baseUpdate(dt, scene.map); return; }
  }
  return _up.call(this, dt, scene);
};
})();

// ---------------------------------------------------------------- talking your way into staying
// You are somewhere you should not be and someone who lives (or works) there catches you: ask to stay. A Charisma
// check (easier the more they like you), or, with AI dialogue on, they can simply agree ("allow_stay",
// js/game/aidialogue.js). Either way you are their guest for a few hours.
(() => {
const D = G.doors;
// -> { b, area } if the player is somewhere they are not allowed right now, else null
D.intruding = function (scene) {
  const p = scene.player, map = scene.map, b = map.buildingAt(p.x, p.y - 3);
  if (!b || map.meta.floorOf) return null;
  const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 3) / 16);
  const area = b.backroom && tx >= b.backroom.x && tx < b.backroom.x + b.backroom.w && ty >= b.backroom.y && ty < b.backroom.y + b.backroom.h ? 'back' : 'front';
  return this.allowed(scene, b, area) ? null : { b, area };
};
// is this person one of the people whose place it is?
D.ownsHere = function (scene, npc, b) { return !!b && (this.residents(scene, b).includes(npc.id) || (G.NPCS[npc.id] && G.NPCS[npc.id].home === b.id)); };
D.letStay = function (scene, b, minutes = 180) {
  const w = scene.world;
  (w.invites = w.invites || {})[b.id] = Math.max((w.invites || {})[b.id] || 0, G.effects.now() + minutes);
  scene.trespassT = 0; scene.trespassIn = null; scene.trespassWarned = false;
};
G.DIALOGUE_NODES._stay_ask = (r) => {
  const sc = r.scene, here = D.intruding(sc), c = r.c;
  const back = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
  if (!here) return { text: 'You are fine where you are.', choices: back };
  const dc = G.util.clamp(9 - Math.round((r.npc.st.disp || 0) / 15), 2, 14);
  if (c.check('stay_ask', dc)) {
    D.letStay(sc, here.b);
    return { text: G.rng.pick(['...Fine. Make yourself at home. Just do not touch anything.', 'Alright, you can stay a while.', 'Okay, okay. Stay. But behave.']), choices: back };
  }
  G.social.addDisp(sc.world, r.npc.id, -3);
  return { text: G.rng.pick(['No. Out. Now.', 'Nice try. Leave.', 'I do not think so. Door is that way.']), choices: [{ text: '[Leave]', next: null }] };
};
G.DIALOGUE_CHOICES.push((runner) => {
  const sc = runner.scene, here = D.intruding(sc), npc = runner.npc;
  if (!here || npc.remote || npc.def.combat === 'guard' || !D.ownsHere(sc, npc, here.b) || !runner.c.canTry('stay_ask')) return [];
  const dc = G.util.clamp(9 - Math.round((npc.st.disp || 0) / 15), 2, 14);
  return [{ text: `${runner.c.tag(dc)} ${here.area === 'back' ? 'I will just be a minute back here, okay?' : 'Sorry for barging in. Mind if I stay a bit?'}`, next: '_stay_ask' }];
});
})();
