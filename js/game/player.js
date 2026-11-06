'use strict';
// The player character: movement, running/stamina, attacking (melee and guns), equipment, consumables,
// skills (js/game/skills.js) and status effects (js/game/effects.js).

class Player extends G.Actor {
  constructor() {
    super({ id: 'player', name: 'You', hp: 100, w: 10, h: 6 });
    this.kind = 'player';
    this.walkSpeed = 58;
    this.runSpeed = 92;
    this.baseMaxHp = 100;
    this.baseMaxStamina = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.staminaDelay = 0;
    this.inventory = new G.Inventory(30);
    this.equip = { weapon: null, armor: null, trinket: null, top: null, bottom: null, shoes: null, mask: null };
    this.gold = 50;
    this.combatTimer = 0;
    this.stepT = 0;
    this.playerName = 'Traveler';
    this.skills = G.skills.fresh();
    this.effects = [];
    this.alcohol = 0;
    this.drugs = { load: {}, tol: {}, addiction: {}, lastUse: {} };
    this.mags = {};
    this.reloadT = 0;
    this.aim = Math.PI / 2;
    this.shotT = 0;
    this.mouseHeld = false;
    this.canSwim = true;     // may walk into water (see updateSwim)
    this.hunger = 10;        // 0..100 (js/game/needs.js)
    this.thirst = 10;
    this.rest = 85;          // sleep need, 0..100 (js/game/rest.js)
    this.swimming = false;
    this.breath = 6;
    // Body & face (set in character creation / barbershop). Clothes come from the Top/Bottom slots.
    this.look = { body: 'm', skin: '#e0b088', eyes: '#2a4a7a', hair: '#5a3a22', hairStyle: 0, facial: 0, shoes: '#2a1e14' };
    this.refreshSprite();
  }

  // Full look = body/face + worn clothes + armor overlay
  currentLook() {
    const look = Object.assign({}, this.look);
    if (this.preg && G.love && G.love.belly(this.preg)) look.belly = G.love.belly(this.preg);   // pregnant (js/game/love.js)
    const top = this.equip.top && G.item(this.equip.top);
    const bottom = this.equip.bottom && G.item(this.equip.bottom);
    if (top) { look.top = top.style; look.shirt = top.color; look.shirt2 = top.color2 || undefined; }
    else { look.top = 'shirt'; look.shirt = '#cfc6b0'; }
    if (bottom) { look.bottom = bottom.style; look.pants = bottom.color; }
    else { look.bottom = 'shorts'; look.pants = '#8a8478'; }
    const shoes = this.equip.shoes && G.item(this.equip.shoes), mask = this.equip.mask && G.item(this.equip.mask);
    if (shoes) look.shoes = shoes.color; else look.shoes = G.assets.shade(look.skin || '#e0b088', 0.85);   // barefoot
    if (mask) { look.mask = mask.style === 'ski' ? 'black' : mask.style; look.maskSki = mask.style === 'ski'; }
    const hat = this.equip.hat && G.item(this.equip.hat);
    if (hat) { look.hat = hat.style; look.hatColor = hat.color; }
    const armor = this.equip.armor && G.item(this.equip.armor);
    if (armor) look.armor = { armor_cloth: null, armor_leather: '#4a3020', armor_chain: '#44484e', armor_plate: '#1e2228', armor_kevlar: '#3a3e44' }[armor.icon] || null;
    return look;
  }

  refreshSprite() {
    this.sheet = G.assets.character(this.currentLook());
    this.refreshStats();
  }

  // Max health/stamina depend on gear and skills.
  refreshStats() {
    this.maxHp = Math.round(this.baseMaxHp + (this.equip.trinket ? G.item(this.equip.trinket).maxHp || 0 : 0) + G.skills.stat(this, 'maxHp'));
    this.maxStamina = Math.round(this.baseMaxStamina + G.skills.stat(this, 'maxStamina'));
    this.hp = Math.min(this.hp, this.maxHp);
    this.stamina = Math.min(this.stamina, this.maxStamina);
  }

  get weaponItem() { return this.equip.weapon ? G.item(this.equip.weapon) : null; }
  get berserk() { return G.skills.has(this, 'berserker') && this.hp < this.maxHp * 0.3; }

  // Melee damage per hit (rolled per target, so crits are per target). Pistol-whipping does 2.
  damage() {
    const w = this.weaponItem;
    let mult = 1 + G.skills.stat(this, 'meleeDmg');
    if (w && w.cat === 'blunt' && G.skills.has(this, 'heavy_hitter')) mult += 0.2;
    if (this.berserk) mult += 0.4;
    let dmg = (3 + (w ? (w.gun ? 2 : w.dmg) : 0)) * mult;
    if (w && w.cat === 'knife' && G.skills.has(this, 'knife_expert') && G.rng.chance(0.2)) dmg *= 2;
    return dmg;
  }
  cooldown() {
    const w = this.weaponItem;
    let cd = w && !w.gun ? w.cd || 0.4 : 0.35;
    if (w && w.cat === 'knife' && G.skills.has(this, 'knife_expert')) cd *= 0.75;
    return cd;
  }
  weaponRange() { const w = this.weaponItem; return w && !w.gun ? w.range || 18 : 13; }
  knockbackMult() { const w = this.weaponItem; return w && w.cat === 'blunt' && G.skills.has(this, 'heavy_hitter') ? 1.6 : 1; }
  defense() {
    let d = G.skills.stat(this, 'defense');
    if (this.equip.armor) d += G.item(this.equip.armor).def || 0;
    if (this.equip.trinket) d += G.item(this.equip.trinket).def || 0;
    return d;
  }
  bulletDefense() { return this.equip.armor ? G.item(this.equip.armor).bulletDef || 0 : 0; }
  damageTakenMult() { return G.effects.mult(this, 'dmgTaken') * (this.berserk ? 0.8 : 1); }
  canHit() { return true; }
  hasTorch() { return this.inventory.has('flashlight'); }   // light at night

  // Second Wind: once per day, survive a killing blow.
  cheatDeath(scene) {
    const s = this.skills;
    if (!G.skills.has(this, 'second_wind') || s.secondWindDay === scene.world.day) return false;
    s.secondWindDay = scene.world.day;
    this.hp = Math.round(this.maxHp * 0.25);
    this.invuln = 1.5;
    scene.toast('Second Wind! You refuse to go down.', 'good');
    scene.floatText(this.x, this.y - 30, 'SECOND WIND', '#ffd86a');
    return true;
  }

  // Where the mouse points in the world.
  mouseWorld() {
    const R = G.renderer, m = G.input.mouse;
    return { x: R.cam.x + m.x / R.zoom, y: R.cam.y + m.y / R.zoom };
  }

  update(dt, scene) {
    this.baseUpdate(dt, scene.map);
    if (this.dead) return;
    G.effects.update(this, dt, scene);
    G.needs.updatePlayer(this, dt, scene);
    if (this.dead) return;
    const I = G.input, m = I.mouse;
    let dx = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
    let dy = (I.isDown('down') ? 1 : 0) - (I.isDown('up') ? 1 : 0);
    if (this.sitting) {   // resting on a couch or bench until you move
      if (dx || dy || I.wasPressed('attack')) this.sitting = null;
      else { this.stamina = Math.min(this.maxStamina, this.stamina + 25 * dt); }
    }
    const wantsRun = I.isDown('run') && (dx || dy || (G.pad && G.pad.stick)) && !this.aiming;
    const raw = !!(dx || dy || (G.pad && G.pad.stick));
    if (G.movement) [dx, dy] = G.movement.steer(this, dx, dy, scene);   // mouse mode: forward = toward the cursor (js/game/movement.js)
    const stick = G.pad && G.pad.moveVec(); if (stick) { dx = stick.x; dy = stick.y; }   // (the full range of the stick: js/game/pad.js)
    const running = wantsRun && this.stamina > 0;
    const regen = 20 * Math.max(0.15, 1 + G.skills.stat(this, 'staminaRegen'));
    if (running) { this.stamina = Math.max(0, this.stamina - 22 * dt); this.staminaDelay = 0.8; }
    else if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(this.maxStamina, this.stamina + regen * dt);

    // wasted: you stumble around
    const lv = G.effects.intoxLevel(this);
    if (lv && lv.stumble && raw) {
      const t = scene.time;
      dx += Math.sin(t * 1.7) * 0.6;
      dy += Math.cos(t * 1.3) * 0.6;
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const swimRank = G.skills.rank(this, 'swimming');
    const swimMult = this.swimming ? (swimRank ? 0.45 + swimRank * 0.12 : 0.25) : 1;
    const sp = (running && !this.swimming && !this.dragging ? this.runSpeed : this.walkSpeed) * swimMult * (this.dragging ? 0.55 : 1) * (this.attackTimer > 0 ? 0.5 : 1) * (this.aiming ? 0.55 : 1) * G.effects.mult(this, 'speed') * (this.reloadT > 0 ? 0.8 : 1);
    this.moving = false;
    this.wishX = dx; this.wishY = dy;   // (where you are trying to go, whatever stops you: js/game/wilds.js)
    if (G.movement) { const v = G.movement.smooth(this, dx, dy, dt); dx = v.x; dy = v.y; }   // weight: ease in, ease out, swing round
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      if (G.movement) G.movement.faceSmooth(this, dx, dy); else this.face(dx, dy);
      this.aim = Math.atan2(dy, dx);
      const ox = this.x, oy = this.y;
      this.moving = this.move(scene.map, dx * sp * dt, dy * sp * dt, true);
      if (G.movement) G.movement.blocked(this, dx * sp * dt, dy * sp * dt, this.x - ox, this.y - oy);
      this.stepT -= dt * (running ? 1.5 : 1);
      if (this.stepT <= 0) { G.audio.play('step', { surface: this.swimming ? 'water' : G.audio.surfaceOf((scene.map.tileDef(Math.floor(this.x / 16), Math.floor((this.y - 2) / 16)) || {}).name), run: running, x: this.x, y: this.y }); this.stepT = 0.32; }
    }

    // Attacking: the keyboard swings/shoots where you face, the mouse aims at the cursor.
    if (m.pressed && !this.mouseHeld) this.mouseHeld = 'new';
    else if (!m.down) this.mouseHeld = false;
    const click = this.mouseHeld === 'new';
    if (this.mouseHeld) {
      const mw = this.mouseWorld();
      this.aim = Math.atan2(mw.y - (this.y - 6), mw.x - this.x);
      this.face(Math.cos(this.aim), Math.sin(this.aim));
      this.mouseHeld = true;
    } else if (I.isDown('attack')) {
      const [fx, fy] = G.util.DIR_VEC[this.dir];
      this.aim = Math.atan2(fy, fx);
    }

    // water: swimmers tire, non-swimmers drown
    const wet = scene.map.isWaterAt(this.x, this.y - 3);
    if (wet !== this.swimming) {
      this.swimming = wet;
      this.breath = 6;
      if (G.effectsHD) G.effectsHD.splash(scene, this.x, this.y - 2, true);
      if (wet) scene.toast(swimRank ? 'You start swimming.' : 'You cannot swim! You are drowning! Get out!', swimRank ? 'info' : 'bad');
      if (wet) G.audio.play('door');
    }
    if (this.swimming) {
      this.updateSwim(dt, scene, swimRank);
      if (this.dead) return;
      if (I.wasPressed('interact')) scene.interact();
      return;   // no fighting while you are paddling
    }

    if (this.dragging) {   // both hands on a body: no fighting
      if (I.wasPressed('interact')) scene.interact();
      return;
    }
    const w = this.weaponItem;
    if (this.shotT > 0) this.shotT -= dt;
    if (w && w.gun) {
      G.firearms.updatePlayer(this, dt);
      // keyboard: as before. Mouse: the aiming system decides (hold to aim, release to fire: js/game/aim.js)
      const keys = w.auto ? I.isDown('attack') : I.wasPressed('attack');
      const trigger = G.aim ? G.aim.update(this, scene, dt, click) || keys : keys || (w.auto ? this.mouseHeld : click);
      if (keys) this.aimSpread = 1;
      if (trigger) G.firearms.playerFire(this, scene, this.aim);
      if (I.wasPressed('reload')) G.firearms.startReload(this, scene);
    } else if ((I.wasPressed('attack') || click) && this.attackCd <= 0 && this.stamina >= 5) {
      this.stamina -= 6 * Math.max(0.2, 1 + G.skills.stat(this, 'meleeStamina'));
      this.staminaDelay = 0.5;
      G.combat.attack(this, scene);
      G.destruction.playerHit(scene, this);
      this.combatTimer = 4;
    }
    if (I.wasPressed('kick') && G.fight) G.fight.playerKick(this, scene);
    if (I.wasPressed('interact')) scene.interact();
    if (I.wasPressed('ignite')) {
      if (this.inventory.has('torch')) G.ITEM_USE.torch(scene);
      else scene.toast('You need a lighter to start a fire.');
    }

    if (this.combatTimer > 0) this.combatTimer -= dt;
    // (no healing on its own: only medicine heals you, js/game/medicine.js)
  }

  // Swimming costs stamina (less with practice). When you are out of stamina, or never learned to swim,
  // you run out of breath and drown.
  updateSwim(dt, scene, rank) {
    let drowning = false;
    if (!rank) { this.breath -= dt * 1.5; drowning = this.breath <= 0; }
    else {
      this.stamina = Math.max(0, this.stamina - Math.max(1.5, 7 - rank * 1.8) * dt);
      this.staminaDelay = 0.6;
      if (this.stamina <= 0) { this.breath -= dt; drowning = this.breath <= 0; if (!this.tiredSaid) { this.tiredSaid = true; scene.toast('You are exhausted. Get to shore!', 'bad'); } }
      else { this.breath = Math.min(6, this.breath + dt); this.tiredSaid = false; }
    }
    if (drowning) {
      this.hp -= 14 * dt;
      this.combatTimer = 2;
      if (G.rng.chance(dt * 3)) scene.particles(this.x, this.y - 6, '#c8e8ff', 4);
      if (this.hp <= 0 && !this.cheatDeath(scene)) { this.hp = 0; this.die({ kind: 'drown' }, scene); scene.toast('You drowned.', 'bad'); }
    }
  }

  draw(ctx) {
    if (this.swimming) {
      // HD: head and shoulders above the water, arms stroking, a wake behind and rings around
      const hd = G.hd.get(this.sheet), C = G.hd.COL, t = G.loop.time, moving = this.moving;
      const col = C.swim + (Math.floor(t * (moving ? 3 : 1.2)) % 2), row = this.dir, cutRows = 24;   // sprite rows above the water
      const bob = Math.sin(t * (moving ? 5 : 2.5)) * 0.7, kx = G.hd.WW / G.hd.FW, ky = G.hd.WH / G.hd.FH;
      const wx = this.x, wy = this.y - 6 + bob;
      ctx.drawImage(hd.img, col * G.hd.FW, row * G.hd.FH, G.hd.FW, cutRows, Math.round((wx - G.hd.WW / 2) * 2) / 2, wy - cutRows * ky, G.hd.WW, cutRows * ky);
      ctx.fillStyle = 'rgba(40,90,140,0.45)'; ctx.fillRect(wx - 6, wy - 1, 12, 1.5);   // the waterline over the chest
      for (let k = 0; k < 3; k++) {   // rings spreading out
        const ph = ((t * 0.9 + k / 3) % 1), r = 4 + ph * 9;
        ctx.strokeStyle = `rgba(220,240,255,${(0.6 * (1 - ph)).toFixed(2)})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(wx, wy + 0.5, r, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (moving) {   // a wake and splashes from the strokes
        const [fx, fy] = G.util.DIR_VEC[this.dir];
        ctx.fillStyle = 'rgba(236,246,255,0.55)';
        for (let i = 1; i <= 4; i++) ctx.fillRect(wx - fx * i * 3 + Math.sin(t * 9 + i) * 1.5, wy - fy * i * 2 + 1, 1.5, 1);
        if (Math.floor(t * 3) % 2 === 0) { ctx.fillRect(wx + (row === 2 ? 4 : -4), wy - 2 - (t * 12 % 3), 1, 1); }
      }
      ctx.lineWidth = 1;
      return;
    }
    super.draw(ctx);
    G.firearms.drawHeld(ctx, this);
  }

  onHurt() {
    this.combatTimer = 6;
  }

  die(source, scene) {
    this.dead = true;
    G.audio.play(this.look && this.look.body === 'f' ? 'death_f' : 'death');
    scene.onPlayerDeath(source);
  }

  // ---- inventory actions ----
  equipFromSlot(i) {
    const s = this.inventory.slots[i];
    if (!s) return false;
    const it = G.item(s.id);
    const slot = it.type === 'clothing' ? it.slot : { weapon: 'weapon', armor: 'armor', trinket: 'trinket' }[it.type];
    if (!slot) return false;
    this.inventory.removeAt(i, 1);
    if (this.equip[slot]) this.inventory.add(this.equip[slot], 1);
    this.equip[slot] = s.id;
    this.reloadT = 0;
    this.refreshSprite();
    G.audio.play('pickup');
    return true;
  }

  unequip(slot) {
    const id = this.equip[slot];
    if (!id || !this.inventory.canFit(id)) return false;
    this.equip[slot] = null;
    this.inventory.add(id, 1);
    this.reloadT = 0;
    this.refreshSprite();
    return true;
  }

  useFromSlot(i, scene) {
    const s = this.inventory.slots[i];
    if (!s) return false;
    const it = G.ITEMS[s.id] || G.item(s.id);
    if (G.ITEM_USE[s.id]) return G.ITEM_USE[s.id](scene);
    if (['weapon', 'armor', 'trinket', 'clothing'].includes(it.type)) return this.equipFromSlot(i);
    if (it.type !== 'consumable') return false;
    // anything you smoke needs a light
    if (G.SMOKEABLE.includes(s.id) && !this.inventory.has('torch')) { if (scene) scene.toast(`You need a lighter to smoke ${it.name.toLowerCase()}.`, 'bad'); return false; }
    this.inventory.removeAt(i, 1);
    G.audio.play(it.alcohol ? 'drink' : 'eat');
    G.effects.consume(this, it, scene);
    return true;
  }

  serialize() {
    return {
      x: this.x, y: this.y, dir: this.dir, hp: this.hp, stamina: this.stamina, gold: this.gold,
      inventory: this.inventory.toJSON(), equip: Object.assign({}, this.equip), look: this.look, name: this.playerName,
      skills: this.skills, effects: this.effects, alcohol: this.alcohol, drugs: this.drugs, mags: this.mags, hunger: this.hunger, thirst: this.thirst, rest: this.rest, preg: this.preg || null,
    };
  }

  static from(d) {
    const p = new Player();
    Object.assign(p, { x: d.x, y: d.y, dir: d.dir || 0, hp: d.hp, stamina: d.stamina, gold: d.gold });
    if (d.name) p.playerName = d.name;
    p.inventory = G.Inventory.from(d.inventory);
    p.equip = Object.assign({ weapon: null, armor: null, trinket: null, top: null, bottom: null, shoes: null, mask: null }, d.equip);
    if (d.look) p.look = d.look;
    if (d.skills) p.skills = Object.assign(G.skills.fresh(), d.skills);
    p.effects = (d.effects || []).filter((e) => G.EFFECTS[e.id]);
    p.alcohol = d.alcohol || 0;
    if (d.drugs) p.drugs = d.drugs;
    p.hunger = d.hunger || 0; p.thirst = d.thirst || 0; p.rest = d.rest != null ? d.rest : 85;
    p.preg = d.preg || null;
    if (p.preg) p.refreshSprite();
    p.mags = d.mags || {};
    p.refreshSprite();
    p.hp = d.hp;
    return p;
  }
}

G.Player = Player;
