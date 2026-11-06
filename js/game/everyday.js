'use strict';
// Everyday fixes and behavior:
//   - Sitting: you sit ON the couch/bench/chair (drawn there) and get up where you were standing.
//   - Never stuck: if you ever end up inside something solid (a bed after sleeping, furniture), you are
//     moved to the nearest free spot.
//   - One person per seat: NPCs reserve the chair they are walking to, and nobody takes a seat that is
//     taken (by them or by you).
//   - Together: after a date, hanging out, making love... the person stays with you, right next to you,
//     instead of snapping back to wherever their schedule says.
//   - Clothes: take them off and you are naked (censored). People react the way they would: shock,
//     disgust, laughter; parents shield kids; the police write you up for indecent exposure.
//   - Companions still eat, drink and sleep when they need to.
(() => {
G.CRIMES.indecent = { label: 'Indecent exposure', bounty: 15, rep: -3, tension: 1 };

G.everyday = {
  // ---- seats ----
  seatKey: (x, y) => x + ',' + y,
  claims(map) { return (map.seatClaims = map.seatClaims || new Map()); },
  takenBy(scene, key, self) {
    const c = this.claims(scene.map).get(key);
    if (!c || c === self) return null;
    if (c === scene.player) return scene.player.sitting && scene.player.sitting.key === key ? c : null;
    return c.needTask && !c.dead && scene.actors.includes(c) ? c : null;
  },
  // ---- put someone next to the player (after an activity) ----
  together(scene, npc) {
    if (!npc || npc.remote || npc.dead || !scene.actors.includes(npc)) return;
    const t = G.companions.besidePlayer(scene);
    npc.x = t.x; npc.y = t.y; npc.path = null; npc.sleeping = false; npc.needTask = null; npc.loveTask = null;
    npc.faceTowards(scene.player);
    npc.holdT = 25;   // stays and hangs around you for a bit
  },
  // ---- unstick ----
  freeSpot(map, x, y, w, h, swim = false) {
    if (!map.rectCollides(x - w / 2, y - h, w, h, swim)) return null;   // swimmers are not "stuck" in open water
    const tx = Math.floor(x / 16), ty = Math.floor((y - 3) / 16);
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = (tx + dx) * 16 + 8, ny = (ty + dy) * 16 + 12;
      if (!map.rectCollides(nx - w / 2, ny - h, w, h)) return { x: nx, y: ny };
    }
    return null;
  },
  exposure(p) {
    const top = !!p.equip.top, bottom = !!p.equip.bottom, f = p.look.body === 'f';
    if (!bottom) return 'naked';
    if (!top && f) return 'topless';
    return null;
  },
  // ---- people react to nudity ----
  reactNudity(scene, dt) {
    const p = scene.player, w = scene.world;
    if ((this.nT = (this.nT || 0) - dt) > 0) return;
    this.nT = 0.7;
    const ex = this.exposure(p);
    if (!ex || p.vehicle) return;
    const b = scene.map.buildingAt(p.x, p.y - 3);
    if (b && (w.flags.player_home === b.id || (b.floorOf && w.flags.player_home === b.floorOf))) return;   // your own home
    const now = G.effects.now();
    for (const a of scene.actors) {
      if (a.kind !== 'npc' || a.dead || a.sleeping || a.talking || a.state !== 'schedule') continue;
      if (!a.canSee(scene, p, 100) || (a.nudeSeen || -1e9) > now - 120) continue;
      a.nudeSeen = now;
      const P = G.social.persona(a.id), st = a.st;
      if (a.def.kid) { a.say(G.rng.pick(['EW!', 'MOM!', 'Gross!!']), 2); a.startFlee(p); continue; }
      if (st.partner && b) { a.say(G.rng.pick(['Well, hello there.', 'Is that for me?']), 3); continue; }
      if (a.def.combat === 'guard') { a.say('Sir! Ma\'am! Put some clothes on. You are under arrest for indecent exposure.', 3); scene.reportCrime('indecent', a); continue; }
      const line = { nervous: ['Oh my god! Oh my god!', 'I did not see anything! I did not see anything!'], grumpy: ['Put some damn clothes on!', 'Disgusting.'], proud: ['How vulgar.', 'Have some self-respect.'], chatty: ['Uh... nice weather? For THAT?', 'Wait until everyone hears about this.'], cheerful: ['HA! Bold choice!', 'Oh! Um. Hi!'], suspicious: ['Is this some kind of trick?', 'Stay away from me, weirdo.'], tired: ['I am too tired for this.', 'Nope. Not today.'], friendly: ['Are you okay? Do you need clothes?', 'Hey... you might want to cover up.'] }[P.trait] || ['Put some clothes on!'];
      a.say(G.rng.pick(line), 3);
      G.social.addDisp(w, a.id, (st.disp || 0) > 40 ? -2 : -5);
      if (P.trait === 'nervous' || P.trait === 'suspicious') { st.fear = Math.max(st.fear || 0, 50); a.startFlee(p); }
      if (P.trait === 'chatty') w.rumor('Someone was walking around without any clothes on. In public!', scene.region);
    }
  },
};

// ---------------------------------------------------------------- sitting
const PL = G.Player.prototype, _pdraw = PL.draw, _pupd = PL.update;
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  if (d.def.interact === 'sit') {
    const p = scene.player, key = G.everyday.seatKey(d.tx, d.ty);
    if (G.everyday.takenBy(scene, key, p) || scene.actors.some((a) => { const q = a.perch && a.seated ? a.perch : a; return a.seated && Math.hypot(q.x - d.x, q.y - (d.y - 2)) < (d.def.fw === 2 ? 14 : 10); })) { scene.toast('Someone is already sitting there.'); return; }
    // couches and benches are solid: you are drawn on them, but you stay standing where you are in the world. Whichever
    // side you came from: on a seat that faces the room you are in front of it, on one that faces away its back hides you
    const fd = G.realFurn.faceOf(d), away = fd === 3;
    p.sitting = { x: d.x + (G.DECOR[d.type].fw === 2 ? (p.x < d.x ? -6 : 6) : 0), y: d.y - (away ? (d.type === 'pew' ? 4 : 7) : 2), z: d.y + (away ? -1 : 1), key, from: { x: p.x, y: p.y }, dir: fd || 0 };
    G.everyday.claims(scene.map).set(key, p);
    scene.toast('You sit down. (Move to get up)');
    return;
  }
  return _use.call(this, d, scene);
};
PL.draw = function (ctx) {
  const s = this.sitting;
  if (!s || this.vehicle) return _pdraw.call(this, ctx);
  const { x, y, dir, moving } = this;
  this.x = s.x; this.y = s.y; this.dir = s.dir || 0; this.moving = false;
  try { return G.Actor.prototype.draw.call(this, ctx); } finally { this.x = x; this.y = y; this.dir = dir; this.moving = moving; }
};
PL.sortY = function () { return this.sitting && this.sitting.z != null ? this.sitting.z : this.y; };
G.DECOR.pew.faceDir = 3;   // (the altar is that way)
PL.update = function (dt, scene) {
  const was = this.sitting;
  const r = _pupd.call(this, dt, scene);
  if (was && !this.sitting) {   // got up: back on your feet where you sat down from
    this.x = was.from.x; this.y = was.from.y;
    G.everyday.claims(scene.map).delete(was.key);
  }
  return r;
};

// while seated, [E] is "Get up" (and moving gets you up too)
G.everyday.standUp = (scene) => {
  const p = scene.player, s = p.sitting;
  if (!s) return;
  p.sitting = null;
  p.x = s.from.x; p.y = s.from.y;
  G.everyday.claims(scene.map).delete(s.key);
};
{
  const GSx = G.GameScene.prototype, _fi = GSx.findInteraction, _in = GSx.interact;
  GSx.findInteraction = function () { return this.player.sitting ? { type: 'getup', label: 'Get up' } : _fi.call(this); };
  GSx.interact = function () { if (this.promptTarget && this.promptTarget.type === 'getup') { G.everyday.standUp(this); return; } return _in.call(this); };
}

// ---------------------------------------------------------------- one person per seat
const N = G.needs, _publicSeat = N.publicSeat, _nearest = N.nearest, _nupdate = N.update;
N.nearest = function (list, npc, filter = () => true) {
  const scene = G.everyday.scene;
  if (!scene || !list.length || list[0].dir == null) return _nearest.call(this, list, npc, filter);   // only seats are claimable
  return _nearest.call(this, list, npc, (s) => filter(s) && !G.everyday.takenBy(scene, G.everyday.seatKey(s.x, s.y), npc) && !scene.actors.some((a) => a !== npc && a.seated && Math.floor(a.x / 16) === s.x && Math.floor((a.y - 3) / 16) === s.y));
};
N.update = function (npc, dt, scene) {
  G.everyday.scene = scene;
  const before = npc.needTask;
  const r = _nupdate.call(this, npc, dt, scene);
  const claims = G.everyday.claims(scene.map);
  if (npc.needTask && npc.needTask !== before) for (const s of npc.needTask.steps) if (s && (s.act === 'eat' || s.act === 'bar')) claims.set(G.everyday.seatKey(s.x, s.y), npc);
  if (before && npc.needTask !== before) for (const s of before.steps) if (s && claims.get(G.everyday.seatKey(s.x, s.y)) === npc) claims.delete(G.everyday.seatKey(s.x, s.y));
  return r;
};
void _publicSeat;

// ---------------------------------------------------------------- together after activities
const DR = G.DialogueRunner.prototype, _ctx = DR.makeContext;
DR.makeContext = function () {
  const c = _ctx.call(this), runner = this, wait = c.wait;
  c.wait = (h) => { wait(h); G.everyday.together(runner.scene, runner.npc); };
  return c;
};
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.holdT > 0 && !this.dead && this.state === 'schedule' && !this.talking && !this.st.companion) {
    this.holdT -= dt;
    this.baseUpdate(dt, scene.map);
    this.moving = false; this.sleeping = false;
    if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null;
    if (Math.random() < dt * 0.4) this.faceTowards(scene.player);
    if (this.holdT <= 0 && Math.random() < 0.5) this.say(G.rng.pick(['I should get going. See you!', 'That was nice. Bye for now.']), 3);
    return;
  }
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- companions: food, drink, sleep
const _cupd = G.companions.update;
G.companions.update = function (npc, dt, scene) {
  const st = npc.st, w = scene.world;
  if (st.companion && !st.compWait && npc.state === 'schedule') {
    if (npc.needTask) return false;   // busy eating/drinking (needs.js), then back to following
    if ((st.hunger >= 75 || st.thirst >= 75) && (npc.compNeedT = (npc.compNeedT || 0) - dt) <= 0) {
      npc.compNeedT = 30;
      const steps = G.needs.plan(npc, scene);
      if (steps && !steps.some((s) => !s)) { npc.needTask = { steps, i: 0, t: 0, walk: 0 }; npc.say(st.thirst >= 75 ? 'Hang on, I need something to drink.' : 'I am starving. Give me a minute to eat.', 3); return false; }
    }
    const h = w.hourF;
    if ((h >= 1 && h < 6) && !npc.tiredSaid) { npc.tiredSaid = true; npc.say(G.rng.pick(['I can barely keep my eyes open...', 'It is SO late.']), 3); }
    if (h >= 2.5 && h < 6) {
      const home = scene.map.building(w.flags.player_home);
      const bed = home && scene.map.buildingAt(npc.x, npc.y - 3) === home && scene.map.decor.find((d) => d.def.interact === 'bed' && scene.map.buildingAtTile(d.tx, d.ty) === home);
      if (bed) { npc.sleeping = true; npc.sleepSpot = { x: bed.tx, y: bed.ty }; npc.moving = false; return true; }   // crashes at your place
      npc.say('I am going home to sleep. Call me tomorrow!', 3);
      G.companions.dismiss(scene, npc);
      return true;
    }
    npc.tiredSaid = (h >= 1 && h < 6) && npc.tiredSaid;
  }
  return _cupd.call(this, npc, dt, scene);
};

// ---------------------------------------------------------------- per-frame: unstick, nudity, start dressed
const GS = G.GameScene.prototype, _gu = GS.update, _gl = GS.loadMap;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  const p = this.player;
  if (p && !p.dead && !p.vehicle && !p.swimming && !p.sitting && this.map) {
    // never a jump: the player walks out of whatever came to stand on them (a parked car, a shifted crate)
    if (this.map.rectCollides(p.x - p.w / 2, p.y - p.h, p.w, p.h, p.canSwim)) { const spot = G.everyday.nearSpot(this.map, p); if (spot) { const dx = spot.x - p.x, dy = spot.y - p.y, d = Math.hypot(dx, dy), s = Math.min(d, 60 * dt); p.x += dx / d * s; p.y += dy / d * s; } }
  }
  if (p && !p.dead) G.everyday.reactNudity(this, dt);
  return r;
};
GS.loadMap = function (id, spawnName, pos) {
  _gl.call(this, id, spawnName, pos);
  const p = this.player, w = this.world;
  if (p && !w.flags.shod && G.clothId) {   // ...and shoes (the pair they were drawn with)
    w.flags.shod = true;
    if (!p.equip.shoes) { p.equip.shoes = G.clothId('shoes', 'sneakers', p.look.shoes || '#2e2018'); p.refreshSprite(); }
  }
  if (p && !w.flags.dressed) {   // a new character always starts with clothes on
    w.flags.dressed = true;
    if (!p.equip.top && !p.equip.bottom && G.clothId) { p.equip.top = G.clothId('top', 'shirt', '#cfc6b0'); p.equip.bottom = G.clothId('bottom', 'pants', '#4a5a7a'); p.refreshSprite(); }
  }
};

// naked when you take your clothes off
const _look = PL.currentLook;
PL.currentLook = function () {
  const look = _look.call(this);
  if (!this.equip.top) { look.shirtless = true; look.top = 'shirt'; }
  if (!this.equip.bottom) { look.pantsless = true; look.bottom = 'pants'; }
  return look;
};
// Settings > Censor Nudity changed: redraw everyone who is undressed right now
const _gu2 = GS.update;
GS.update = function (dt) {
  const c = G.settings.get('censor') !== false;
  if (this.censorWas !== undefined && this.censorWas !== c) {
    if (this.player) this.player.refreshSprite();
    for (const a of this.actors) {
      if (a.kind !== 'npc') continue;
      if (a.look && a.look.naked) a.sheet = G.assets.character(a.look);
      a.loveKey = null;   // naked lovers are redrawn by js/game/love.js on its next refresh
    }
  }
  this.censorWas = c;
  return _gu2.call(this, dt);
};
})();
