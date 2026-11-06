'use strict';
// New game: after creating your character, pick the skills you start with (5 points, requirements apply;
// Swimming still has to be taught by the instructor at the lake).
(() => {
const U = G.ui;
const BUDGET = 5;
class StartSkillsScene {
  constructor(creator) {
    this.creator = creator; this.ranks = {}; this.sel = 0; this.scroll = 0;
    this.list = G.SKILL_BRANCHES.flatMap((b) => Object.keys(G.SKILLS).filter((id) => G.SKILLS[id].branch === b.id && id !== 'swimming').sort((a, c) => G.SKILLS[a].pos[1] - G.SKILLS[c].pos[1] || G.SKILLS[a].pos[0] - G.SKILLS[c].pos[0]));
  }
  spent() { return Object.values(this.ranks).reduce((a, b) => a + b, 0); }
  canAdd(id) { const s = G.SKILLS[id], r = this.ranks[id] || 0; return r < s.ranks && this.spent() < BUDGET && (s.req || []).every(([q, n]) => (this.ranks[q] || 0) >= n); }
  canRemove(id) { const r = this.ranks[id] || 0; if (!r) return false; return !this.list.some((o) => (this.ranks[o] || 0) > 0 && (G.SKILLS[o].req || []).some(([q, n]) => q === id && r - 1 < n)); }
  change(id, d) { if (d > 0 && this.canAdd(id)) { this.ranks[id] = (this.ranks[id] || 0) + 1; G.audio.play('select'); } else if (d < 0 && this.canRemove(id)) { this.ranks[id]--; if (!this.ranks[id]) delete this.ranks[id]; G.audio.play('back'); } else G.audio.play('error'); }
  done() { G.pendingStartSkills = Object.assign({}, this.ranks); G.scenes.remove(this); _act.call(this.creator, '_start'); }
  update() {
    const I = G.input, id = this.list[this.sel];
    if (I.pressed.has('ArrowUp') || I.pressed.has('KeyW')) this.sel = Math.max(0, this.sel - 1);
    if (I.pressed.has('ArrowDown') || I.pressed.has('KeyS')) this.sel = Math.min(this.list.length - 1, this.sel + 1);
    if (I.pressed.has('ArrowRight') || I.pressed.has('KeyD')) this.change(id, 1);
    if (I.pressed.has('ArrowLeft') || I.pressed.has('KeyA')) this.change(id, -1);
    if (I.pressed.has('Enter')) this.done();
    if (I.pressed.has('Escape')) G.scenes.remove(this);
    if (G.input.mouse.wheel) this.sel = G.util.clamp(this.sel + Math.sign(G.input.mouse.wheel) * 2, 0, this.list.length - 1);
  }
  render(ctx) {
    const R = G.renderer, m = G.input.mouse;
    U.dim(ctx, 0.75);
    const W = Math.min(520, R.uiW - 20), H = Math.min(330, R.uiH - 16), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.panel(ctx, x, y, W, H, { title: 'Starting Skills', titleSize: 13 });
    U.text(ctx, `Points left: ${BUDGET - this.spent()} / ${BUDGET}`, x + 12, y + 24, { size: 8, color: this.spent() < BUDGET ? '#ffd86a' : U.colors.dim });
    const rh = 13, vis = Math.floor((H - 100) / rh), lx = x + 12, lw = W * 0.58;
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + vis) this.scroll = this.sel - vis + 1;
    this.list.slice(this.scroll, this.scroll + vis).forEach((id, k) => {
      const i = this.scroll + k, s = G.SKILLS[id], ry = y + 40 + k * rh, r = this.ranks[id] || 0, b = G.SKILL_BRANCHES.find((q) => q.id === s.branch);
      const avail = this.canAdd(id) || r > 0;
      const hov = U.inRect(m.ux, m.uy, lx, ry, lw, rh - 1);
      if (hov && m.moved) this.sel = i;
      ctx.fillStyle = i === this.sel ? 'rgba(110,86,44,0.85)' : 'rgba(30,26,36,0.6)'; ctx.fillRect(lx, ry, lw, rh - 1);
      ctx.fillStyle = b.color; ctx.fillRect(lx, ry, 2, rh - 1);
      U.icon(ctx, s.icon, lx + 4, ry - 1, 0.75);
      U.text(ctx, s.name, lx + 18, ry + 2, { size: 8, color: avail ? U.colors.text : U.colors.dim });
      U.text(ctx, `${r}/${s.ranks}`, lx + lw - 30, ry + 2, { size: 8, align: 'right', color: r ? '#8aea7a' : U.colors.dim });
      const minus = U.button(ctx, lx + lw - 26, ry, 11, rh - 2, '-', { size: 7 }), plus = U.button(ctx, lx + lw - 13, ry, 11, rh - 2, '+', { size: 7 });
      if (minus.clicked) { this.sel = i; this.change(id, -1); }
      if (plus.clicked) { this.sel = i; this.change(id, 1); }
    });
    const s = G.SKILLS[this.list[this.sel]], dx = lx + lw + 10, dw = W - lw - 34;
    U.text(ctx, s.name, dx, y + 42, { size: 10, weight: 'bold', color: '#ffe8b0' });
    U.text(ctx, G.SKILL_BRANCHES.find((q) => q.id === s.branch).name, dx, y + 56, { size: 8, color: U.colors.dim });
    U.wrap(ctx, s.desc, dw, 8).forEach((l, i) => U.text(ctx, l, dx, y + 72 + i * 11, { size: 8 }));
    if (s.req) U.text(ctx, 'Needs: ' + s.req.map(([q, n]) => `${G.SKILLS[q].name} ${n}`).join(', '), dx, y + H - 70, { size: 7, color: '#ffb080' });
    if (U.button(ctx, x + W - 120, y + H - 30, 108, 20, 'Start the game', { selected: true }).clicked) this.done();
    if (U.button(ctx, x + 12, y + H - 30, 70, 20, 'Back').clicked) G.scenes.remove(this);
  }
}
G.StartSkillsScene = StartSkillsScene;
const CC = G.CharacterCreatorScene.prototype, _act = CC.act;
CC.act = function (key) {
  if (key === '_start' && this.editor.v.name.trim() && !G.scenes.stack.some((s) => s instanceof StartSkillsScene)) { G.audio.play('confirm'); G.scenes.push(new StartSkillsScene(this)); return; }
  return _act.call(this, key);
};
// apply them when the game starts
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  _load.call(this, id, spawnName, pos);
  if (G.pendingStartSkills && this.player && !this.world.flags.start_skills) {
    this.world.flags.start_skills = true;
    for (const k in G.pendingStartSkills) this.player.skills.ranks[k] = G.pendingStartSkills[k];
    G.pendingStartSkills = null;
    this.player.refreshStats();
  }
};
})();
