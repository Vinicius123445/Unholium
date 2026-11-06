'use strict';
// Walking out on the police, and giving up to them.
//   An arrest talk is not a chat. Close the window or say goodbye at any point without settling it (paying, a bribe,
//   talking your way out, a deal, going to jail) and the officer goes for you, with every officer around.
//   Even with officers on you, you can still give up: empty hands and [E] (or T) on one of them. The officer holds
//   as soon as they can (not in the middle of a swing), the others stop too, your hands go up, and you are back in
//   the arrest talk: go quietly, pay, bribe, argue. Walk out of that, or pull a weapon, and it starts again.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, DR = G.DialogueRunner.prototype, DS = G.DialogueScene.prototype;
const pick = (a) => G.rng.pick(a);
const isCop = (a) => a.kind === 'npc' && !a.dead && a.def.combat === 'guard';
const encounter = (r) => r.tree === G.DIALOGUES._arrest && !r.npc.remote;

const P = G.policeStop = {
  HOLD: 6,    // seconds after a talk ends that officers keep their hands off an unarmed, surrendered player
  busy(cop) { return !!(cop.swing || cop.staggerT > 0 || cop.downT > 0 || (cop.st && cop.st.ko) || cop.crash); },
  holding(scene) { return !!(scene.copHold && G.loop.time < scene.copHold); },
  // settled: nothing left to be angry about, or something the game already counts as an outcome
  settled(r) {
    const sc = r.scene, w = sc.world, wanted = G.law && G.law.isWanted(w);
    if (r._jail || sc.arrestCooldown > 3) return true;               // jail, or talked out, bribed, or already fighting
    if ((w.bounty[sc.region] || 0) <= 0 && !wanted) return true;     // paid, or cleared
    return G.jobs.active(w).some((id) => G.jobs.def(w, id).giver === r.npc.id);   // a deal: working it off
  },
  // they left the talk: the order stands, spoken, and it is walking off from that which gets them shot at
  refused(scene, cop) {
    cop.say(pick(['Hey! I am not done with you!', 'Where do you think you are going?!', 'Wrong answer.']), 3);
    scene.copHold = 0; scene.player.handsUp = false;
    G.mem.add(scene.world, cop.id, { k: 'defied', t: 'The player walked away from me during an arrest', by: 'player', s: 'did', f: -2, i: 4 });
    G.demand.open(scene, cop, '_arrest', { refused: 1 });
  },
  // running from an order is what opens fire
  escaped(scene, cop) {
    cop.say(pick(['Stop or I will shoot!', 'Suspect is running!', 'Stop right there!']), 3);
    scene.copHold = 0; scene.player.handsUp = false; scene.resistArrest(cop);
  },
  // how a talk with an officer ended
  finish(r) {
    const sc = r.scene, surrendered = r.surrendering || P.holding(sc);
    if (sc._jailing) { r._jail = true; sc._jailing = false; }
    if (P.settled(r)) { if (surrendered) { sc.copHold = G.loop.time + P.HOLD; sc.player.handsUp = false; sc.arrestCooldown = Math.max(sc.arrestCooldown, 4); } return true; }
    return false;
  },
  // can they stop and talk at all? hands empty, an officer on them
  canSurrender(scene, npc) { return isCop(npc) && !scene.player.weaponItem && (npc.state === 'fight' || npc.isHostileToPlayer(scene)); },
  surrender(scene, npc) {
    const p = scene.player;
    scene.copHold = G.loop.time + 3600;
    p.handsUp = true;
    npc.moving = false; npc.path = null;
    for (const a of scene.actors) {
      if (!isCop(a) || a.distTo(p) > 260) continue;
      a.st.hostile = false; a.aggressor = false;
      if (a.state === 'fight' && a.target === p) { a.endFight(); a.moving = false; a.faceTowards(p); }
    }
    npc.say(pick(['Hands up! Do not move!', 'Slowly! Keep your hands where I can see them!', 'Alright. Easy. Stay right there.']), 3);
    G.demand.close(); G.demand.open(scene, npc, '_arrest', { surrendering: true });
  },
};

// ---------------------------------------------------------------- the talk ends
const _goToJail = GS.goToJail;
GS.goToJail = function () { this._jailing = true; return _goToJail.apply(this, arguments); };
const _end = DR.end;
DR.end = function () {
  const was = this.ended, res = _end.apply(this, arguments);
  if (!was && encounter(this) && !this.demand && !P.finish(this)) P.refused(this.scene, this.npc);
  return res;
};
// the window closed with no goodbye to choose (the X, Escape): that is walking away too
const _upd = DS.update;
DS.update = function (dt) {
  const r = this.runner;
  if (r && !r.ended && encounter(r) && !this.typing && !this.aiWait && G.input.wasPressed('cancel') && !(r.node.choices || []).some((c) => c.raw && c.raw.next === null && !c.raw.do)) { G.input.pressed.clear(); r.end(); this.finish(); return; }
  return _upd.call(this, dt);
};
// surrendering: the talk opens differently, and giving up is one answer
const arrest = G.DIALOGUES._arrest.start, _text = arrest.text;
arrest.text = (c) => (P.holding(c.scene) && c.scene.player.handsUp ? `Do not move! Keep your hands up!${c.bounty() > 0 ? ' Now, you want to do this the easy way?' : ''}` : _text(c));
arrest.choices.push({ text: 'Goodbye.', next: null });
arrest.choices.unshift({ text: 'I give up. Take me in.', if: (c) => P.holding(c.scene) && c.scene.player.handsUp, do: (c) => { c.npc.say('Smart. Turn around.', 3); c.scene.goToJail(); } });

// ---------------------------------------------------------------- talking to an officer on you
const _talk = GS.talkTo;
GS.talkTo = function (npc) {
  if (npc && P.canSurrender(this, npc)) {
    if (P.busy(npc)) { this._surrenderTo = { npc, until: G.loop.time + 1.2 }; return; }   // (the swing finishes first)
    P.surrender(this, npc);
    return;
  }
  return _talk.apply(this, arguments);
};
// [E] on an officer who is after you says what it does
const _find = GS.findInteraction;
GS.findInteraction = function () {
  const t = _find.call(this);
  if (t && t.type === 'npc' && P.canSurrender(this, t.ref)) t.label = 'Surrender';
  return t;
};
// a hold: officers keep their distance from an unarmed, surrendered player; a weapon in hand ends it
const _hostile = NP.isHostileToPlayer;
NP.isHostileToPlayer = function (scene) { if (this.def.combat === 'guard' && scene && P.holding(scene)) return false; return _hostile.call(this, scene); };
const _fight = NP.startFight;
NP.startFight = function (target, scene) { if (scene && this.def.combat === 'guard' && target === scene.player && P.holding(scene) && !scene._forceFight) return; return _fight.apply(this, arguments); };
const _resist = GS.resistArrest;
GS.resistArrest = function (guard) { this.copHold = 0; this.player.handsUp = false; this._forceFight = true; this.copsHot = G.loop.time + 60; try { return _resist.apply(this, arguments); } finally { this._forceFight = false; } };
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt), p = this.player;
  if (!p || p.dead) return r;
  const want = this._surrenderTo;
  if (want && G.scenes.top() === this) {
    if (want.npc.dead || G.loop.time > want.until) this._surrenderTo = null;
    else if (!P.busy(want.npc) && !p.weaponItem) { this._surrenderTo = null; P.surrender(this, want.npc); return r; }
  }
  if (P.holding(this) && G.scenes.top() === this) {
    if (p.weaponItem) {   // threatening them again
      const cop = this.actors.filter(isCop).sort((a, b) => a.distTo(p) - b.distTo(p))[0];
      this.copHold = 0; p.handsUp = false;
      if (cop) { cop.say('Weapon! Drop it!', 3); this.resistArrest(cop); }
    }
  } else if (p.handsUp && G.scenes.top() === this) p.handsUp = false;
  return r;
};
})();
