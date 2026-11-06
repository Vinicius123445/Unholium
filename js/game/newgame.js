'use strict';
// New game: before the character creator, pick a difficulty (and, if you dare, Hardcore). After the starting
// skills, one last question: "Do my actions have consequences?" Yes keeps the Moral Causality system
// (js/game/fate.js) on for this run; No switches it off for good and the game answers with a line. Nothing in
// the game ever names the system; only the Debug Menu's Moral Causality tab shows it.
//   Difficulty (w.flags.difficulty 0/1/2, mirrored to the Difficulty setting): the damage you take (combat.js)
//   and the damage you deal (DEAL_MULT below).
//   Hardcore (w.flags.hardcore, w.flags.runId): one life. Dying deletes every save of that run.
(() => {
const U = G.ui;
const DIFFS = [
  { name: 'Easy', desc: 'You hit harder and the world hits softer. For taking in the story.' },
  { name: 'Normal', desc: 'The game as it is meant to be played.' },
  { name: 'Hard', desc: 'Your blows land lighter and theirs land heavier. Every fight is a risk.' },
];
const DEAL_MULT = [1.4, 1, 0.7];   // damage the player deals, by difficulty
const NO_LINES = [
  'It always has. Just not in this game.',
  'So you think.',
  'That\'s what they all say.',
  'If you say so.',
  'Comforting, isn\'t it?',
  'Bold of you to assume.',
  'Lucky you.',
  'Out there, they do. In here... fine.',
  'Noted.',
  'Then go. Nobody\'s counting.',
  'The world will forget. This once.',
  'Wish granted.',
  'Must be nice.',
  'Everyone believes that, until they don\'t.',
  'Sure. Sleep well.',
];

// ---------------------------------------------------------------- difficulty and Hardcore
class DifficultyScene {
  constructor(creator) {
    this.transparent = true; this.creator = creator;
    this.diff = G.settings.get('difficulty'); this.hard = false;
    this.sel = this.diff;
  }
  items() { return [...DIFFS.map((d) => d.name), `Hardcore: ${this.hard ? 'On' : 'Off'}`, 'Continue']; }
  toggleHard() {
    if (this.hard) { this.hard = false; G.audio.play('back'); return; }
    G.scenes.push(new G.ConfirmScene('Hardcore mode: you get one life. When you die, your save is deleted for good. Turn it on?', () => { this.hard = true; }));
  }
  done() {
    G.audio.play('confirm');
    G.pendingRun = { difficulty: this.diff, hardcore: this.hard };
    G.settings.set('difficulty', this.diff);
    G.scenes.remove(this);
  }
  activate(i) {
    if (i < 3) { this.diff = i; G.audio.play('select'); }
    else if (i === 3) this.toggleHard();
    else this.done();
  }
  update() {
    const r = U.nav(this, 'sel', 5);
    if (r === 'confirm') this.activate(this.sel);
    if (r === 'cancel') { G.audio.play('back'); G.scenes.replace(new G.MenuScene()); }
  }
  render(ctx) {
    U.dim(ctx, 0.85);
    const R = G.renderer, W = Math.min(380, R.uiW - 20), H = 216, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'New Game', titleSize: 13 });
    U.text(ctx, 'Difficulty', x + 14, y + 28, { size: 9, weight: 'bold', color: '#ffe8b0' });
    const bw = (W - 28 - 12) / 3;
    DIFFS.forEach((d, i) => {
      const b = U.button(ctx, x + 14 + i * (bw + 6), y + 42, bw, 22, d.name, { selected: this.diff === i || this.sel === i, size: 10, weight: this.diff === i ? 'bold' : 'normal' });
      if (this.diff === i) { ctx.strokeStyle = U.colors.borderLight; ctx.strokeRect(x + 14 + i * (bw + 6) + 0.5, y + 42.5, bw - 1, 21); }
      if (b.hover && G.input.mouse.moved) this.sel = i;
      if (b.clicked) this.activate(i);
    });
    const shown = this.sel < 3 ? this.sel : this.diff;
    U.wrap(ctx, DIFFS[shown].desc, W - 28, 8).forEach((l, i) => U.text(ctx, l, x + 14, y + 72 + i * 11, { size: 8, color: U.colors.dim }));
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 14, y + 104, W - 28, 1);
    U.text(ctx, 'Hardcore', x + 14, y + 114, { size: 9, weight: 'bold', color: this.hard ? '#ff8a6a' : '#ffe8b0' });
    U.wrap(ctx, 'One life. When you die, your save is deleted and the story is over.', W - 28, 8).forEach((l, i) => U.text(ctx, l, x + 14, y + 128 + i * 11, { size: 8, color: U.colors.dim }));
    const hb = U.button(ctx, x + 14, y + 154, 150, 22, this.hard ? 'Hardcore: On' : 'Hardcore: Off', { selected: this.sel === 3, size: 10, weight: this.hard ? 'bold' : 'normal' });
    if (this.hard) { ctx.fillStyle = 'rgba(200,58,42,0.25)'; ctx.fillRect(x + 14, y + 154, 150, 22); }
    if (hb.hover && G.input.mouse.moved) this.sel = 3;
    if (hb.clicked) this.activate(3);
    const back = U.button(ctx, x + 14, y + H - 32, 70, 20, 'Back');
    const go = U.button(ctx, x + W - 122, y + H - 32, 108, 20, 'Continue', { selected: this.sel === 4 });
    if (go.hover && G.input.mouse.moved) this.sel = 4;
    if (back.clicked) { G.audio.play('back'); G.scenes.replace(new G.MenuScene()); }
    if (go.clicked) this.done();
  }
}

// the window opens over the character creator (not when making a character for someone's co-op game)
const CC = G.CharacterCreatorScene.prototype, _ccUpd = CC.update;
CC.update = function (dt) {
  if (!this._diffAsked) { this._diffAsked = true; G.pendingRun = null; if (!G.coopCreate) { G.scenes.push(new DifficultyScene(this)); return; } }
  return _ccUpd.call(this, dt);
};

// ---------------------------------------------------------------- the question
class ConsequenceScene {
  constructor(onDone) { this.transparent = true; this.xpNoir = true; this.onDone = onDone; this.sel = 0; this.t = 0; this.reply = null; this.rt = 0; }   // (xpNoir: its own card, the window theme stays out)
  answer(yes) {
    if (G.pendingRun) G.pendingRun.fate = yes; else G.pendingRun = { fate: yes };
    if (yes) { G.audio.play('confirm'); this.finish(); return; }
    G.audio.play('select');
    this.reply = NO_LINES[Math.floor(Math.random() * NO_LINES.length)];
  }
  finish() { G.scenes.remove(this); this.onDone(); }
  update(dt) {
    this.t += dt;
    if (this.reply) {
      this.rt += dt;
      if (this.rt > 4.5 || (this.rt > 0.8 && (G.input.wasPressed('confirm') || G.input.wasPressed('cancel') || G.input.mouse.pressed))) this.finish();
      return;
    }
    const r = U.nav(this, 'sel', 2, { horizontal: true });
    if (r === 'confirm' && this.t > 0.5) this.answer(this.sel === 0);
    if (r === 'cancel') { G.audio.play('back'); G.scenes.remove(this); }   // back to the starting skills
  }
  render(ctx) {
    const R = G.renderer;
    U.dim(ctx, Math.min(0.96, this.t * 1.5));
    const a = Math.min(1, this.t / 0.8);
    ctx.globalAlpha = a;
    if (this.reply) {
      const f = Math.min(1, this.rt / 0.6) * (this.rt > 3.7 ? Math.max(0, (4.5 - this.rt) / 0.8) : 1);
      ctx.globalAlpha = f;
      U.text(ctx, this.reply, R.uiW / 2, R.uiH / 2 - 8, { size: 13, align: 'center', family: G.config.TITLE_FONT, color: '#d8ccb0' });
      ctx.globalAlpha = 1;
      return;
    }
    // a card of its own: one line, one choice, nothing else on the screen
    const title = 'Do my actions have consequences?', W = Math.min(R.uiW - 24, 340), H = 112, cx = R.uiW / 2, wx = Math.round(cx - W / 2), wy = Math.round(R.uiH / 2 - H / 2) - 6, rise = (1 - a) * 8;
    ctx.save(); ctx.translate(0, rise);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(wx + 5, wy + 6, W, H);
    const bg = ctx.createLinearGradient(0, wy, 0, wy + H); bg.addColorStop(0, '#191a20'); bg.addColorStop(1, '#101116'); ctx.fillStyle = bg; ctx.fillRect(wx, wy, W, H);
    ctx.fillStyle = '#8a1f26'; ctx.fillRect(wx, wy, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(wx, wy + 3, W, 1);
    ctx.strokeStyle = 'rgba(214,196,158,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(wx + 0.5, wy + 0.5, W - 1, H - 1);
    U.text(ctx, 'BEFORE YOU BEGIN', cx, wy + 13, { size: 7, align: 'center', color: '#9a8f7c' });
    U.text(ctx, title, cx, wy + 29, { size: 15, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#f4ead2' });
    ctx.fillStyle = 'rgba(214,196,158,0.26)'; ctx.fillRect(cx - 34, wy + 51, 68, 1);
    ctx.restore();
    const bw = 104, gap = 16, bx = R.uiW / 2 - bw - gap / 2, by = Math.round(R.uiH / 2 - 6 + 112 / 2 - 34);
    const yes = U.button(ctx, bx, by, bw, 22, 'Yes', { selected: this.sel === 0, size: 11 });
    const no = U.button(ctx, bx + bw + gap, by, bw, 22, 'No', { selected: this.sel === 1, size: 11 });
    if (yes.hover && G.input.mouse.moved) this.sel = 0;
    if (no.hover && G.input.mouse.moved) this.sel = 1;
    ctx.globalAlpha = 1;
    if (this.t < 0.5) return;
    if (yes.clicked) this.answer(true);
    if (no.clicked) this.answer(false);
  }
}
const SS = G.StartSkillsScene.prototype, _ssDone = SS.done;
SS.done = function () {
  if (G.scenes.stack.some((s) => s instanceof ConsequenceScene)) return;
  G.audio.play('confirm');
  G.scenes.push(new ConsequenceScene(() => _ssDone.call(this)));
};

// ---------------------------------------------------------------- the run starts: write the choices into the world
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  _load.call(this, id, spawnName, pos);
  const w = this.world;
  if (!w) return;
  if (G.pendingRun && !w.flags.run_set) {
    const r = G.pendingRun; G.pendingRun = null;
    w.flags.run_set = true;
    w.flags.difficulty = r.difficulty != null ? r.difficulty : G.settings.get('difficulty');
    if (r.hardcore) { w.flags.hardcore = true; w.flags.runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    if (r.fate === false) G.fate.st(w).off = true;
  }
  if (w.flags.difficulty != null && G.settings.get('difficulty') !== w.flags.difficulty) G.settings.set('difficulty', w.flags.difficulty);
};
// changing Difficulty in Settings during a run changes that run's difficulty
const _set = G.settings.set;
G.settings.set = function (k, v) {
  const r = _set.apply(this, arguments);
  if (k === 'difficulty' && G.world && G.world.flags && G.world.flags.run_set) G.world.flags.difficulty = v;
  return r;
};

// ---------------------------------------------------------------- damage you deal
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o) {
  if (source && source.kind === 'player' && target && target.kind !== 'player') amount *= DEAL_MULT[G.settings.get('difficulty')] || 1;
  return _dmg.call(this, target, amount, source, scene, o);
};

// ---------------------------------------------------------------- Hardcore: one life
const hardcore = (w) => !!(w && w.flags && w.flags.hardcore && w.flags.runId);
G.hardcore = {
  wipe(w) {
    for (const slot of G.saves.allSlots) { const d = G.saves.read(slot); if (d && d.world && d.world.flags && d.world.flags.runId === w.flags.runId) G.saves.remove(slot); }
  },
};
const _death = GS.onPlayerDeath;
GS.onPlayerDeath = function () {
  const r = _death.apply(this, arguments);
  if (hardcore(this.world)) G.hardcore.wipe(this.world);
  return r;
};
const _write = G.saves.write;
G.saves.write = function (slot, scene) {
  if (scene && scene.player && scene.player.dead && hardcore(scene.world)) return false;   // nothing of a dead run is kept
  return _write.apply(this, arguments);
};
const DS = G.DeathScene.prototype, _dsAct = DS.activate, _dsUpd = DS.update, _dsRender = DS.render;
const hcDeath = (ds) => { if (!hardcore(ds.game.world)) return false; if (!ds._hc) { ds._hc = true; ds.items = [{ label: 'Main Menu' }]; ds.latest = null; ds.sel = 0; } return true; };
DS.update = function (dt) {
  if (!hcDeath(this)) return _dsUpd.call(this, dt);
  this.t += dt;
  if (G.input.wasPressed('confirm')) this.activate(0);
};
DS.activate = function (i) {
  if (hardcore(this.game.world)) { G.scenes.replace(new G.MenuScene()); return; }
  return _dsAct.call(this, i);
};
DS.render = function (ctx) {
  if (hcDeath(this)) { const R = G.renderer; U.dim(ctx, Math.min(0.75, this.t)); U.text(ctx, 'You Died', R.uiW / 2, R.uiH / 2 - 60, { size: 30, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#c83a2a' }); U.text(ctx, 'Hardcore. This life is over, and so is the save.', R.uiW / 2, R.uiH / 2 - 22, { size: 9, align: 'center', color: U.colors.dim }); const i = U.menu(ctx, this, this.items, R.uiW / 2 - 80, R.uiH / 2, 160, 20, 6); if (i >= 0) this.activate(i); return; }
  return _dsRender.call(this, ctx);
};

Object.assign(G, { DifficultyScene, ConsequenceScene });
})();
