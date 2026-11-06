'use strict';
// Skill tree screen: five branches, nodes connected by requirements. Arrows/mouse select, Enter/click learns.
(() => {
const U = G.ui;

class SkillsScene {
  constructor(game) {
    this.transparent = true;
    this.game = game;
    this.sel = Object.keys(G.SKILLS)[0];
    this.layout = {};
    this.flash = 0;
    G.audio.play('select');
  }
  get p() { return this.game.player; }

  learn(id) {
    const why = G.skills.blocker(this.p, id);
    if (why) { this.msg = why; this.msgT = 2; G.audio.play('error'); return; }
    G.skills.learn(this.p, id);
    this.flash = 0.5;
    this.flashId = id;
    G.audio.play('quest');
  }

  // Move the selection to the nearest node in a direction.
  move(dx, dy) {
    const a = this.layout[this.sel];
    if (!a) return;
    let best = null, bd = 1e9;
    for (const id in this.layout) {
      if (id === this.sel) continue;
      const b = this.layout[id];
      const vx = b.cx - a.cx, vy = b.cy - a.cy;
      const along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const side = Math.abs(vx * dy) + Math.abs(vy * dx);
      const d = along + side * 2.5;
      if (d < bd) { bd = d; best = id; }
    }
    if (best) { this.sel = best; G.audio.play('select'); }
  }

  update(dt) {
    const I = G.input;
    if (this.flash > 0) this.flash -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (I.wasPressed('cancel') || I.wasPressed('skills')) { G.audio.play('back'); G.scenes.remove(this); return; }
    if (I.wasPressed('left')) this.move(-1, 0);
    if (I.wasPressed('right')) this.move(1, 0);
    if (I.wasPressed('up')) this.move(0, -1);
    if (I.wasPressed('down')) this.move(0, 1);
    if (I.wasPressed('confirm')) this.learn(this.sel);
  }

  render(ctx) {
    U.dim(ctx, 0.6);
    const R = G.renderer, p = this.p, s = p.skills, m = G.input.mouse;
    const W = Math.min(620, R.uiW - (this.inPhone ? 60 : 16)), H = 346, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
    U.panel(ctx, x, y, W, H, { title: 'Skills', titleSize: 13 });

    // header: level, xp, points, key stats
    const need = G.xpToNext(s.level);
    U.text(ctx, `Level ${s.level}`, x + 14, y + 22, { size: 10, weight: 'bold', color: U.colors.borderLight });
    U.bar(ctx, x + 64, y + 24, 110, 7, s.xp / need, '#5a8ae0', { label: `${s.xp} / ${need} XP` });
    U.text(ctx, s.points > 0 ? `${G.util.plural(s.points, 'point')} to spend` : 'No points to spend', x + 184, y + 22, { size: 9, color: s.points > 0 ? '#ffd86a' : U.colors.dim, weight: s.points > 0 ? 'bold' : 'normal' });
    U.text(ctx, `Charisma ${G.skills.charisma(p)}   Intimidation ${G.skills.intimidation(p)}`, x + W - 14, y + 22, { size: 9, align: 'right', color: '#e8c060' });
    if (G.attr && G.attr.of(p)) U.text(ctx, G.attr.NAMES.map((n) => `${G.attr.LABEL[n].slice(0, 3).toUpperCase()} ${G.attr.get(p, n)}`).join('  '), x + W - 14, y + 32, { size: 8, align: 'right', color: '#c8b8e8' });   // core attributes (js/game/attributes.js)

    // branches
    const top = y + 40, colW = (W - 20) / G.SKILL_BRANCHES.length, rowH = 35, box = 22;
    this.layout = {};
    G.SKILL_BRANCHES.forEach((b, bi) => {
      const cx0 = x + 10 + bi * colW;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(cx0 + 2, top, colW - 4, rowH * 6 + 22);
      U.text(ctx, b.name, cx0 + colW / 2, top + 3, { size: 10, align: 'center', weight: 'bold', color: b.color });
    });
    for (const id in G.SKILLS) {
      const k = G.SKILLS[id], bi = G.SKILL_BRANCHES.findIndex((b) => b.id === k.branch);
      const cx = x + 10 + bi * colW + colW * (0.25 + k.pos[0] * 0.5);
      const cy = top + 30 + k.pos[1] * rowH;
      this.layout[id] = { cx, cy };
    }
    // requirement links (the first requirement is the parent in the tree; others are listed in the details)
    for (const id in G.SKILLS) {
      const a = this.layout[id];
      for (const [rid, n] of (G.SKILLS[id].req || []).slice(0, 1)) {
        const b = this.layout[rid], ok = G.skills.rank(p, rid) >= n;
        ctx.strokeStyle = ok ? 'rgba(216,180,104,0.8)' : 'rgba(120,110,130,0.5)';
        ctx.lineWidth = ok ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(b.cx, b.cy + box / 2);
        ctx.lineTo(a.cx, a.cy - box / 2);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    // nodes
    for (const id in G.SKILLS) {
      const k = G.SKILLS[id], { cx, cy } = this.layout[id];
      const rank = G.skills.rank(p, id), why = G.skills.blocker(p, id);
      const branch = G.SKILL_BRANCHES.find((b) => b.id === k.branch);
      const bx = cx - box / 2, by = cy - box / 2;
      const hover = U.inRect(m.ux, m.uy, bx - 4, by - 2, box + 8, box + 14);
      if (hover && m.moved) this.sel = id;
      if (hover && m.pressed) { this.sel = id; this.learn(id); }
      const sel = this.sel === id;
      const available = !why;
      ctx.fillStyle = rank > 0 ? 'rgba(70,56,36,0.95)' : 'rgba(26,22,32,0.95)';
      ctx.fillRect(bx, by, box, box);
      const pulse = available ? 0.6 + 0.4 * Math.sin(G.loop.time * 5) : 1;
      ctx.strokeStyle = sel ? '#ffffff' : available ? `rgba(255,216,106,${pulse})` : rank > 0 ? branch.color : '#4a4050';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, box - 1, box - 1);
      ctx.lineWidth = 1;
      ctx.globalAlpha = rank > 0 || available ? 1 : 0.4;
      U.icon(ctx, k.icon, bx + 3, by + 3);
      ctx.globalAlpha = 1;
      if (this.flash > 0 && this.flashId === id) { ctx.fillStyle = `rgba(255,240,180,${this.flash})`; ctx.fillRect(bx, by, box, box); }
      // rank pips
      for (let i = 0; i < k.ranks; i++) {
        ctx.fillStyle = i < rank ? branch.color : 'rgba(0,0,0,0.7)';
        ctx.fillRect(cx - (k.ranks * 4) / 2 + i * 4 + 0.5, by + box - 3, 3, 2);
      }
      const maxW = k.pos[0] === 0.5 ? colW - 6 : colW / 2 - 2;
      const size = U.measure(ctx, k.name, 7) > maxW ? 6 : 7, col = rank > 0 ? U.colors.text : available ? '#e8dcc0' : U.colors.dim;
      const words = G.i18n.t(k.name).split(' ');
      if (U.measure(ctx, k.name, size) > maxW && words.length > 1) {   // still too wide: two lines
        const half = Math.ceil(words.length / 2);
        U.text(ctx, words.slice(0, half).join(' '), cx, by + box + 1, { size: 6, align: 'center', color: col });
        U.text(ctx, words.slice(half).join(' '), cx, by + box + 7, { size: 6, align: 'center', color: col });
      } else U.text(ctx, k.name, cx, by + box + 2, { size, align: 'center', color: col });
    }

    // details
    const dy = y + H - 64, k = G.SKILLS[this.sel];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 10, dy, W - 20, 50);
    if (k) {
      const rank = G.skills.rank(p, k.id), why = G.skills.blocker(p, k.id);
      const branch = G.SKILL_BRANCHES.find((b) => b.id === k.branch);
      U.icon(ctx, k.icon, x + 16, dy + 6, 1.5);
      U.text(ctx, k.name, x + 46, dy + 5, { size: 11, weight: 'bold', color: branch.color });
      U.text(ctx, `${branch.name} · Rank ${rank}/${k.ranks}`, x + W - 16, dy + 6, { size: 8, align: 'right', color: U.colors.dim });
      U.textBlock(ctx, k.desc, x + 46, dy + 19, W - 70, { size: 8 });
      const status = rank >= k.ranks ? 'Fully learned.' : why ? why : 'Ready to learn.';
      U.text(ctx, status, x + 46, dy + 38, { size: 8, color: rank >= k.ranks ? U.colors.good : why ? '#ff9a7a' : '#ffd86a' });
    }
    if (this.msgT > 0) U.text(ctx, this.msg, x + W / 2, dy - 12, { size: 9, align: 'center', color: '#ff9a7a' });
    U.text(ctx, 'Earn XP by fighting, questing, persuading, foraging and exploring', x + W / 2, y + H - 10, { size: 7, align: 'center', color: U.colors.dim });
  }
}

G.SkillsScene = SkillsScene;
})();
