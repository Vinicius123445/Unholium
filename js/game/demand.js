'use strict';
// Nobody stops the game to talk at you. A mugger, a gang at their corner, an officer, the man whose bed you slept in, the shark: they walk
// up and say it out loud, and you stay free to walk, run or swing. Two small marks show what you can answer: Y thumb up (give them what
// they ask), N thumb down (refuse). After you answer, the mark you chose stays for a moment and goes. [E] on them still opens the whole
// conversation, with every bribe, lie and threat in it, because then it is you who stopped to talk.
//   Police give orders. Refusing is not an attack: they repeat it, the bill grows, and in the end they cuff you. They open fire only if you
//   attack them or run from them without complying.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, DR = G.DialogueRunner.prototype, I = G.input, pick = (a) => G.rng.pick(a);
if (!I.defaultBindings.answerYes) { I.defaultBindings.answerYes = ['KeyY', 'PadRB']; I.defaultBindings.answerNo = ['KeyN', 'PadLB']; if (I.bindings) { I.bindings.answerYes = I.bindings.answerYes || ['KeyY', 'PadRB']; I.bindings.answerNo = I.bindings.answerNo || ['KeyN', 'PadLB']; } }
const find = (r, ...res) => { const ch = r.node ? r.node.choices : []; for (const re of res) { const i = ch.findIndex((c) => re.test(String(c.text))); if (i >= 0) return i; } return -1; };
// what each answer means, by who is asking
const SPEC = {
  _mugging: { life: 13, leash: 120, yes: (r) => find(r, /^Pay\./, /do not have that kind of money/), no: (r) => find(r, /^No.$/, /^Make me/) },
  _debt: { life: 16, leash: 150, yes: (r) => find(r, /^Here\. All of it/, /^Take what I have/, /more time/), no: (r) => find(r, /^I am not paying/) },
  _bed_intruder: { life: 14, leash: 200, yes: (r) => find(r, /Sorry! Wrong house/, /Thanks for the bed/, /Best bed/), no: (r) => find(r, /You did not see anything/, /Best bed/, /Thanks for the bed/) },
  _detective: { life: 16, leash: 170, yes: (r) => find(r, /I was home all night/, /I have nothing to say/), no: (r) => find(r, /I have nothing to say/) },
  _arrest: { life: 12, leash: 118, police: true, yes: (r) => find(r, /^I give up/, /^Pay the bounty/, /^Go to jail/), no: () => -1 },
};
const D = G.demand = {
  cur: null, mark: null,
  active(scene) { return !!(this.cur && this.cur.scene === scene); },
  // they say it, and the game goes on
  open(scene, npc, tree, o = {}) {
    if (this.cur || !npc || npc.dead || !scene.player || scene.player.dead) return false;
    const spec = SPEC[tree]; if (!spec) { scene.openDialogue(npc, tree); return true; }
    const r = new G.DialogueRunner(npc, scene, tree); r.demand = true; if (o.surrendering) r.surrendering = true;
    const c = this.cur = { scene, npc, tree, spec, r, t: 0, refused: o.refused || 0, handsUp: !!o.surrendering, state: npc.state };
    npc.demanding = true; npc.moving = false; npc.faceTowards(scene.player);
    npc.seek = null; if (npc.state !== 'arrest') npc.state = 'mug';
    this.speak(c);
    return true;
  },
  speak(c) { const txt = c.r.node && c.r.node.text; if (txt) c.npc.say(txt, Math.min(9, 3.5 + String(txt).length / 22)); },
  close() { const c = this.cur; if (!c) return; this.cur = null; c.npc.demanding = false; if (c.npc.state === 'mug') c.npc.state = 'schedule'; c.scene._jailing = false; },
  show(up) { this.mark = { up, t: 1.1 }; },
  update(scene, dt) {
    if (this.mark && (this.mark.t -= dt) <= 0) this.mark = null;
    const c = this.cur; if (!c || c.scene !== scene) return;
    const n = c.npc, p = scene.player;
    if (!scene.actors.includes(n) || n.dead || p.dead || (n.st && n.st.ko) || n.state === 'fight' || n.state === 'flee') { this.close(); return; }
    c.t += dt;
    if (c.grab != null) { c.grab -= dt; if (c.grab <= 0 && n.distTo(p) < 34) { this.cuff(c); return; } }
    if (G.scenes.top() !== scene) return;
    const yes = this.pressed('answerYes'), no = this.pressed('answerNo');
    if (yes) { this.show(true); this.answer(c, true); return; }
    if (no) { this.show(false); this.answer(c, false); return; }
    if (n.distTo(p) > c.spec.leash) { this.walkedOff(c); return; }
    if (c.t > c.spec.life) { if (c.spec.police) this.refuse(c, true); else this.answer(c, false); }
  },
  pressed(action) { let hit = false; for (const k of I.bindings[action] || []) if (I.pressed.has(k)) { hit = true; I.pressed.delete(k); } return hit; },
  // walking away from someone who wants something is an answer too
  walkedOff(c) {
    if (c.spec.police) { const sc = c.scene, cop = c.npc; this.close(); G.policeStop.escaped(sc, cop); return; }
    this.answer(c, false);
  },
  answer(c, yes) {
    if (c.spec.police && !yes) { this.refuse(c); return; }
    const r = c.r, i = yes ? c.spec.yes(r) : c.spec.no(r);
    if (i < 0) { this.close(); return; }
    r.choose(i);
    let guard = 0;
    while (!r.ended && r.node && guard++ < 6) { this.speak(c); r.choose(Math.max(0, r.node.choices.findIndex((x) => x.raw.next === null)) || 0); }
    if (!r.ended) r.end();
    if (c.spec.police) G.policeStop.finish(r);
    this.close();
  },
  // saying no to an officer: they say it again, the charge grows, and they come to cuff you
  refuse(c, silent) {
    const w = c.scene.world, n = c.npc, reg = c.scene.region;
    c.refused++;
    if (c.handsUp) { c.scene.player.handsUp = false; c.handsUp = false; }
    w.bounty[reg] = (w.bounty[reg] || 0) + 25;
    c.t = 0;
    if (c.refused === 1) n.say(silent ? pick(['I said now!', 'Are you deaf? Hands where I can see them!']) : pick(['Bad idea. Hands where I can see them.', 'You are only making this worse.']), 4);
    else if (c.refused === 2) { n.say('Last warning. Turn around and put your hands behind your back.', 4.5); c.grab = 7; }
    else { n.say('That is it. You are coming with me.', 3); c.grab = Math.min(c.grab == null ? 2 : c.grab, 2); }
    G.mem.add(w, n.id, { k: 'defied', t: 'The player refused my orders during an arrest', by: 'player', s: 'did', f: -1, i: 3 });
  },
  cuff(c) { const sc = c.scene; this.show(false); c.npc.say('Hands behind your back. Let\'s go.', 3); this.close(); sc.player.handsUp = false; sc.goToJail(); },
  // two small thumbs, out of the way; then the one you chose, and nothing
  draw(ctx, scene) {
    const W = G.renderer.uiW || G.WIDTH || 640, H = G.renderer.uiH || G.HEIGHT || 360, c = this.cur, m = this.mark, y = H - 62;
    if (m) { const a = Math.min(1, m.t / 0.3); this.thumb(ctx, W / 2 - 7, y, m.up, a * 0.95, null, 0.9); return; }
    if (!c || c.scene !== scene || G.scenes.top() !== scene || c.grab != null && c.grab < 0) return;
    const pulse = Math.min(1, c.t / 0.25) * 0.86;
    this.thumb(ctx, W / 2 - 20, y, true, pulse, G.pad ? G.pad.prompt('answerYes') : 'Y', 0.8);
    this.thumb(ctx, W / 2 + 6, y, false, pulse, G.pad ? G.pad.prompt('answerNo') : 'N', 0.8);
  },
  thumb(ctx, x, y, up, alpha, key, k) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x + 9 * k, y + 9 * k);
    ctx.fillStyle = 'rgba(14,14,18,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 9 * k, 0, 6.3); ctx.fill();
    ctx.strokeStyle = up ? '#7ad08a' : '#e07a6a'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.scale(k, up ? k : -k); ctx.fillStyle = up ? '#a8e8b4' : '#f0a090';
    ctx.fillRect(-5.4, -0.6, 2.4, 5.4);                                                     // the cuff
    ctx.beginPath(); ctx.moveTo(-2.4, -0.8); ctx.lineTo(-0.6, -5.4); ctx.quadraticCurveTo(0.8, -6.2, 1, -4.6); ctx.lineTo(0.5, -1.6); ctx.lineTo(4, -1.6); ctx.quadraticCurveTo(5.2, -1.4, 4.8, 0); ctx.lineTo(3.8, 4); ctx.quadraticCurveTo(3.4, 4.9, 2.4, 4.9); ctx.lineTo(-2.4, 4.9); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (key) { ctx.save(); ctx.globalAlpha = alpha; G.ui.text(ctx, key, x + 9 * k, y + 19 * k, { size: 7, align: 'center', color: '#e8e4dc' }); ctx.restore(); }
  },
};

// ---------------------------------------------------------------- who walks up, and how it starts now
GS.startMugging = function (npc) { if (G.scenes.top() !== this) return; G.demand.open(this, npc, '_mugging'); };
GS.startArrest = function (guard) {
  if (this.arrestCooldown > 0 || G.scenes.top() !== this || G.demand.cur) return;
  this.arrestCooldown = 3; G.demand.open(this, guard, '_arrest');
};
// while they wait for an answer they stay on you
const follow = function (dt, scene) {
  const p = scene.player, d = this.distTo(p);
  this.faceTowards(p);
  if (d < 26) { this.moving = false; return; }
  if (d < 40) this.stepToward(p.x, p.y, dt, scene, true); else this.walkTo({ x: Math.floor(p.x / 16), y: Math.floor((p.y - 3) / 16) }, dt, scene, true);
};
const _um = NP.updateMug, _ua = NP.updateArrest;
NP.updateMug = function (dt, scene) { if (this.demanding) return follow.call(this, dt, scene); return _um.apply(this, arguments); };
NP.updateArrest = function (dt, scene) { if (this.demanding) return follow.call(this, dt, scene); return _ua.apply(this, arguments); };
// asking for the whole conversation yourself
const _talk = GS.talkTo;
GS.talkTo = function (npc) {
  const c = D.cur;
  if (c && c.npc === npc && c.scene === this && !G.policeStop.canSurrender(this, npc)) { const tree = c.tree; D.close(); this.openDialogue(npc, tree); return undefined; }
  return _talk.apply(this, arguments);
};
const _update = GS.update;
GS.update = function (dt) { try { D.update(this, dt); } catch (e) { G.reportError && G.reportError(e); D.cur = null; } return _update.apply(this, arguments); };
const _hud = G.hud.draw;
G.hud.draw = function (ctx, scene) { const r = _hud.apply(this, arguments); try { G.renderer.uiTransform(); D.draw(ctx, scene); } catch (e) { /* the marks never take the frame down */ } return r; };
// a new map, a load, a jail cell: what was going on is over
const _load = GS.loadMap;
GS.loadMap = function () { D.close(); D.mark = null; return _load.apply(this, arguments); };

Object.assign(G.LANG_PT.s, {
  'Bad idea. Hands where I can see them.': 'Má ideia. Mãos onde eu possa ver.', 'You are only making this worse.': 'Você só está piorando as coisas.',
  'I said now!': 'Eu disse agora!', 'Are you deaf? Hands where I can see them!': 'Tá surdo? Mãos onde eu possa ver!',
  'Last warning. Turn around and put your hands behind your back.': 'Último aviso. Vire-se e coloque as mãos nas costas.',
  'That is it. You are coming with me.': 'Chega. Você vem comigo.', "Hands behind your back. Let's go.": 'Mãos nas costas. Vamos.',
});
void DR;
})();
