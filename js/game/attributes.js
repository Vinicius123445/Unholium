'use strict';
// Core attributes, under the skill trees: CHARISMA, STRENGTH, LUCK, KNOWLEDGE, ACCURACY, each 1..10.
// A new character gets 15 points to spend (every attribute starts at 1) right after the character
// creator, before picking starting skills. Old saves get the 15 points once, on load.
// They are stored in p.skills.attrs (saved with the skills) and act as base modifiers that the skills
// build on, mostly through G.skills.stat, so every existing check feels them:
//   Charisma  speech checks, prices, propositions, romance, lying to detectives, bribes
//   Strength  melee damage, health, carrying and dragging bodies, kicking doors, knockback
//   Luck      loot, gambling, fishing, crits, getting away with it (investigations), witnesses
//   Knowledge XP gain, lockpicking and hotwiring, cooking and first aid, knowing mushrooms and drugs
//   Accuracy  gun spread, crits, aim
// "3" is average: the bonuses are relative to it. NPCs get attributes from their role and nature.
(() => {
const U = G.ui;
const NAMES = ['charisma', 'strength', 'luck', 'knowledge', 'accuracy'];
const LABEL = { charisma: 'Charisma', strength: 'Strength', luck: 'Luck', knowledge: 'Knowledge', accuracy: 'Accuracy' };
const DESC = {
  charisma: 'Talking your way in and out of things: speech checks, prices, romance, propositions, lying to detectives, bribes.',
  strength: 'Raw power: melee damage, more health, dragging bodies faster, kicking doors in, knocking people back.',
  luck: 'Fortune: better loot, gambling and fishing, lucky crits, and investigations that never quite reach you.',
  knowledge: 'Know-how: more XP, lockpicking and hotwiring, first aid and cooking, telling a death cap from a chanterelle.',
  accuracy: 'A steady hand and a good eye: tighter gun spread and more critical hits.',
};
const BUDGET = 15, MAX = 10, MIN = 1;
// per point above (or below) average
const PER = {
  charisma: { charisma: 0.6, barter: 0.015 },
  strength: { meleeDmg: 0.05, maxHp: 4 },
  luck: { luck: 0.35 },
  knowledge: { healBonus: 0.05 },
  accuracy: { accuracy: 0.04 },
};
const ROLE = {   // NPC tendencies by lifestyle
  cop: { accuracy: 2, strength: 1 }, gang: { strength: 2, accuracy: 1, knowledge: -1 }, rich: { charisma: 2, knowledge: 1 }, retiree: { knowledge: 2, strength: -1 },
  homeless: { luck: -1, strength: -1 }, dealer: { charisma: 1, luck: 1 }, farmer: { strength: 2 }, shopkeeper: { charisma: 1, knowledge: 1 }, worker: {}, child: { strength: -2 }, teen: { strength: -1 },
};

const A = G.attr = {
  NAMES, LABEL, DESC, BUDGET, MAX,
  of(p) { return p && p.skills && p.skills.attrs; },
  get(p, name) {
    if (!p) return 3;
    if (p.kind === 'npc') return this.npc(p.id, name);
    const a = this.of(p);
    return a ? a[name] || MIN : 3;
  },
  npc(id, name) {
    const def = G.NPCS[id] || {}, life = G.lifestyle ? G.lifestyle.of(id) : 'worker';
    const r = new G.RNG('attr-' + id + '-' + name);
    let v = 3 + ((ROLE[life] || {})[name] || 0) + Math.round((r.next() - 0.5) * 3);
    if (def.combat === 'fight' && name === 'strength') v += 1;
    if (def.leader && name === 'charisma') v += 2;
    return G.util.clamp(v, 1, 10);
  },
  fresh() { const a = {}; for (const n of NAMES) a[n] = MIN; return a; },
  spent(a) { return NAMES.reduce((s, n) => s + (a[n] - MIN), 0); },
  valid(a) { return this.spent(a) <= BUDGET && NAMES.every((n) => a[n] >= MIN && a[n] <= MAX); },
  bonus(p, stat) {
    const a = this.of(p);
    if (!a) return 0;
    let v = 0;
    for (const n of NAMES) { const per = PER[n][stat]; if (per) v += per * ((a[n] || MIN) - 3); }
    return v;
  },
};

// every stat feels the attributes
const S = G.skills, _stat = S.stat;
S.stat = function (p, name) { return _stat.call(this, p, name) + (p && p.kind === 'player' ? A.bonus(p, name) : 0); };
// more XP for the knowledgeable
const _xp = S.addXp;
S.addXp = function (p, n, reason, scene) { return _xp.call(this, p, p && p.kind === 'player' && n > 0 ? Math.round(n * (1 + (A.get(p, 'knowledge') - 3) * 0.05)) : n, reason, scene); };
// kicking doors and dragging bodies
if (G.keys && G.keys.strength) { const _str = G.keys.strength; G.keys.strength = function (p) { return _str.call(this, p) + (A.get(p, 'strength') - 3) * 0.6; }; }
// rebalance: the Luck tree stacks on top of the Luck attribute now
if (G.SKILLS.lucky) G.SKILLS.lucky.fx.luck = 0.75;
if (G.SKILLS.four_leaf) G.SKILLS.four_leaf.fx.luck = 1.5;
// NPCs hit as hard as they are strong
const NP = G.NPC.prototype;
if (NP.damage) { const _d = NP.damage; NP.damage = function (t) { const b = _d.call(this, t); if (this.nonLethal || (t && t.nonLethal)) return b; return Math.max(1, Math.round(b * (1 + G.util.clamp(A.get(this, 'strength') - 3, -2, 4) * 0.025))); }; }
// guns: accuracy adds critical hits
const F = G.firearms, _shoot = F.shoot;
F.shoot = function (shooter, scene, angle, w, o) { if (shooter && shooter.kind === 'player' && o) o.crit = (o.crit || 0) + Math.max(0, A.get(shooter, 'accuracy') - 3) * 0.012 + Math.max(0, A.get(shooter, 'luck') - 3) * 0.005; return _shoot.apply(this, arguments); };

// ---------------------------------------------------------------- the allocation screen
class AttributesScene {
  constructor(onDone, title = 'Attributes') { this.a = A.fresh(); this.sel = 0; this.onDone = onDone; this.title = title; }
  left() { return BUDGET - A.spent(this.a); }
  change(n, d) {
    const v = this.a[n] + d;
    if (v < MIN || v > MAX || (d > 0 && this.left() <= 0)) { G.audio.play('error'); return; }
    this.a[n] = v; G.audio.play(d > 0 ? 'select' : 'back');
  }
  done() { if (this.left() > 0) { G.audio.play('error'); this.warn = 1.5; return; } G.scenes.remove(this); this.onDone(Object.assign({}, this.a)); }
  update(dt) {
    const I = G.input, n = NAMES[this.sel];
    if (this.warn) this.warn = Math.max(0, this.warn - (dt || 0.016));
    if (I.pressed.has('ArrowUp') || I.pressed.has('KeyW')) this.sel = (this.sel + NAMES.length - 1) % NAMES.length;
    if (I.pressed.has('ArrowDown') || I.pressed.has('KeyS')) this.sel = (this.sel + 1) % NAMES.length;
    if (I.pressed.has('ArrowRight') || I.pressed.has('KeyD')) this.change(n, 1);
    if (I.pressed.has('ArrowLeft') || I.pressed.has('KeyA')) this.change(n, -1);
    if (I.pressed.has('Enter')) this.done();
  }
  render(ctx) {
    const R = G.renderer, m = G.input.mouse;
    U.dim(ctx, 0.75);
    const W = Math.min(440, R.uiW - 20), H = 250, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: this.title, titleSize: 13 });
    U.text(ctx, `Points left: ${this.left()} / ${BUDGET}   ·   each from 1 to 10`, x + 12, y + 24, { size: 8, color: this.left() ? '#ffd86a' : U.colors.dim });
    NAMES.forEach((n, i) => {
      const ry = y + 42 + i * 26, sel = i === this.sel, hov = U.inRect(m.ux, m.uy, x + 10, ry, W - 20, 24);
      if (hov && m.moved) this.sel = i;
      ctx.fillStyle = sel ? 'rgba(110,86,44,0.85)' : 'rgba(30,26,36,0.6)'; ctx.fillRect(x + 10, ry, W - 20, 24);
      U.text(ctx, LABEL[n], x + 18, ry + 7, { size: 10, weight: 'bold', color: sel ? '#ffe8b0' : U.colors.text });
      for (let k = 0; k < MAX; k++) { ctx.fillStyle = k < this.a[n] ? '#e8b84a' : '#3a3444'; ctx.fillRect(x + 110 + k * 16, ry + 8, 13, 8); }
      U.text(ctx, String(this.a[n]), x + 280, ry + 7, { size: 10, weight: 'bold' });
      if (U.button(ctx, x + W - 58, ry + 4, 18, 16, '-', { size: 8 }).clicked) { this.sel = i; this.change(n, -1); }
      if (U.button(ctx, x + W - 36, ry + 4, 18, 16, '+', { size: 8 }).clicked) { this.sel = i; this.change(n, 1); }
    });
    U.wrap(ctx, DESC[NAMES[this.sel]], W - 24, 8).forEach((l, i) => U.text(ctx, l, x + 12, y + 178 + i * 11, { size: 8, color: U.colors.dim }));
    if (this.warn) U.text(ctx, 'Spend all your points first.', x + 12, y + H - 24, { size: 8, color: '#ff8a7a' });
    if (U.button(ctx, x + W - 110, y + H - 30, 98, 20, 'Continue', { selected: true }).clicked) this.done();
  }
}
G.AttributesScene = AttributesScene;

// new game: attributes come right after the character creator, then the starting skills
const CC = G.CharacterCreatorScene.prototype, _act = CC.act;
CC.act = function (key) {
  if (key === '_start' && this.editor.v.name.trim() && !G.pendingAttrs && !G.scenes.stack.some((s) => s instanceof AttributesScene)) {
    G.audio.play('confirm');
    G.scenes.push(new AttributesScene((a) => { G.pendingAttrs = a; CC.act.call(this, '_start'); }));
    return;
  }
  return _act.call(this, key);
};
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  _load.call(this, id, spawnName, pos);
  const p = this.player;
  if (!p || A.of(p)) return;
  if (G.pendingAttrs) { p.skills.attrs = G.pendingAttrs; G.pendingAttrs = null; p.refreshStats && p.refreshStats(); return; }
  if (G.shot || /[?&](test|shot)/.test(location.search)) { p.skills.attrs = { charisma: 4, strength: 4, luck: 4, knowledge: 4, accuracy: 4 }; return; }
  // an old save: spend your 15 points once
  if (!this._attrAsked) {
    this._attrAsked = true;
    setTimeout(() => G.scenes.push(new AttributesScene((a) => { p.skills.attrs = a; p.refreshStats && p.refreshStats(); this.toast('Attributes set.', 'good'); }, 'New: Attributes (15 points)')), 0);
  }
};

// phone: attributes at the top of the Skills app (shown in LifeLog too)
G.PHONE_SCREENS.attributes = (ps) => NAMES.map((n) => ({ label: `${LABEL[n]}: ${A.get(ps.game.player, n)} / 10`, sub: DESC[n], info: true, bar: A.get(ps.game.player, n) / 10 }));
})();
// Knowledge 8+: you know your mushrooms without the Mycologist skill
(() => {
const _isId = G.isIdentified;
G.isIdentified = (id) => _isId(id) || !!(G.player && G.attr.of(G.player) && G.attr.get(G.player, 'knowledge') >= 8);
})();
