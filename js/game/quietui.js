'use strict';
// A quieter dialogue: a compact, semi-transparent strip along the bottom (never more than 28% of the
// screen), a small portrait, the speaker's name small above the text, a short scrolling list of answers.
// No dark overlay: the world stays visible and keeps moving behind it (people walk, cars drive), and the
// camera eases a little toward whoever you are talking to. The relationship meter is tiny and only shows
// for a few seconds when it changes.
(() => {
const U = G.ui, DS = G.DialogueScene.prototype, _upd = DS.update;
const MAXH = 0.28;

DS.render = function (ctx) {
  const R = G.renderer, npc = this.runner.npc;
  R.uiTransform();
  const W = Math.min(560, R.uiW - 16), x = (R.uiW - W) / 2;
  const H = Math.floor(R.uiH * MAXH), y = R.uiH - H - 6;
  this.panelH = H / R.uiH;   // (tests: the panel's share of the screen)
  // the strip
  // the same see-through strip, with the windows' finish (js/game/uihd.js)
  const gr = ctx.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, 'rgba(32,31,30,0.84)'); gr.addColorStop(1, 'rgba(13,13,12,0.80)'); ctx.fillStyle = gr; ctx.fillRect(x, y, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, y + 1, W, 1); ctx.fillStyle = 'rgba(193,167,114,0.4)';
  for (const [cx, cy, sx] of [[x + 2, y + H - 3, 1], [x + W - 3, y + H - 3, -1]]) { ctx.fillRect(sx > 0 ? cx : cx - 5, cy, 6, 1); ctx.fillRect(cx, cy - 5, 1, 6); }
  ctx.strokeStyle = 'rgba(193,167,114,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 5.5, y + 5.5, 27, 27);   // the portrait frame
  ctx.fillStyle = 'rgba(193,167,114,0.55)'; ctx.fillRect(x, y, W, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y + H, W, 1);
  // their face, above the strip (js/game/realface.js)
  if (G.portrait && npc.look) G.portrait.draw(ctx, npc, x + 6, Math.max(4, y - 66 + 30), 56);
  const name = npc.st.introduced ? `${npc.st.realName} · ${npc.st.name}` : npc.st.name;
  U.text(ctx, name, x + 38, y + 5, { size: 8, color: '#c1a772', weight: 'bold' });
  // tiny relationship meter, only when it moved
  const v = G.rel ? G.rel.value(npc.st) : null;
  if (v != null) { if (this._relV == null) this._relV = v; if (v !== this._relV) { this._relShow = 3; this._relV = v; } }
  if (this._relShow > 0 && G.rel) { this._relShow -= 1 / 60; ctx.globalAlpha = Math.min(1, this._relShow); G.rel.drawBar(ctx, npc, x + W - 96, y + 4, 88); ctx.globalAlpha = 1; }
  // the line
  const txt = this.fullText.slice(0, Math.floor(this.chars));
  const lines = U.wrap(ctx, txt, W - 50, 9);
  const maxLines = 3, first = Math.max(0, lines.length - maxLines);
  lines.slice(first).forEach((l, i) => U.text(ctx, l, x + 38, y + 16 + i * 11, { size: 9, color: '#d0c9bb' }));
  // the answers: a short list that scrolls
  const choices = this.runner.node ? this.runner.node.choices : [];
  const top = y + 16 + Math.min(lines.length, maxLines) * 11 + 3, rowH = 11;
  const rows = Math.max(1, Math.floor((y + H - 14 - top) / rowH));
  this.scroll = G.util.clamp(this.scroll || 0, 0, Math.max(0, choices.length - rows));
  if (this.sel < this.scroll) this.scroll = this.sel;
  if (this.sel >= this.scroll + rows) this.scroll = this.sel - rows + 1;
  if (G.input.mouse.wheel && choices.length > rows) { this.scroll = G.util.clamp(this.scroll + G.input.mouse.wheel, 0, choices.length - rows); this.sel = G.util.clamp(this.sel, this.scroll, this.scroll + rows - 1); }
  if (this.chars >= this.fullText.length) {
    choices.forEach((c, i) => {
      if (i < this.scroll || i >= this.scroll + rows) return;
      const by = top + (i - this.scroll) * rowH, on = this.sel === i;
      const m = G.input.mouse, hov = U.inRect(m.ux, m.uy, x + 36, by, W - 44, rowH);
      if (on) { ctx.fillStyle = 'rgba(193,167,114,0.16)'; ctx.fillRect(x + 36, by, W - 44, rowH); ctx.fillStyle = '#c5b083'; ctx.fillRect(x + 36, by, 2, rowH); }
      U.text(ctx, `${i + 1}. ${c.text}`, x + 40, by + 1, { size: 8, color: on ? '#e4d2ae' : '#b6b2aa' });
      if (hov && m.moved) this.sel = i;
      if (hov && m.pressed) this.choose(i);
    });
    if (this.scroll > 0) U.text(ctx, '▲', x + W - 8, top, { size: 7, align: 'right', color: '#847f77' });
    if (this.scroll + rows < choices.length) U.text(ctx, '▼', x + W - 8, top + (rows - 1) * rowH, { size: 7, align: 'right', color: '#847f77' });
  } else if (G.input.mouse.pressed) this.chars = this.fullText.length;
  // own words: one small line at the bottom
  const fy = y + H - 12, m = G.input.mouse;
  const caret = this.typing && Math.floor(G.loop.time * 2) % 2 ? '|' : '';
  if (this.typing) { ctx.fillStyle = 'rgba(57,55,53,0.9)'; ctx.fillRect(x + 36, fy - 1, W - 44, 11); }
  U.text(ctx, this.typing ? `> ${this.input}${caret}` : 'Say something in your own words...', x + 40, fy, { size: 7, color: this.typing ? '#f5f4f2' : '#76736d' });
  if (!this.typing && m.pressed && U.inRect(m.ux, m.uy, x + 36, fy - 1, W - 44, 11)) { this.typing = true; this.input = ''; G.input.typed.length = 0; }
};

// the world keeps going behind the conversation (everyone but you and the person you are talking to)
DS.update = function (dt) {
  const r = _upd.call(this, dt);
  const g = this.game;
  if (!g || !g.actors || G.scenes.top() !== this) return r;
  // time does not stop for a conversation (a phone call either): the clock, the hours and what they bring go on
  if (g.world && g.player && !g.player.dead) g.world.advance(dt);
  if (this.runner.npc.remote) return r;
  const npc = this.runner.npc, p = g.player;
  try {
    for (const a of g.actors) {
      if (a === p || a === npc || a.dead || a.kind === 'vehicle' || Math.abs(a.x - p.x) > 500 || (a.kind === 'npc' && a.state !== 'schedule')) continue;   // (nobody starts trouble mid-sentence)
      a.update(dt, g);
    }
    for (const v of g.vehicles || []) if (v.ai) G.vehicles.updateAI(v, dt, g);
    if (g.parts) for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.t -= dt; }
    if (g.parts) g.parts = g.parts.filter((q) => q.t > 0);
    // the camera leans toward the speaker
    const mx = p.x + (npc.x - p.x) * 0.35, my = p.y + (npc.y - p.y) * 0.35;
    G.renderer.follow(mx, my - 8, g.map.pw, g.map.ph, dt);
    g.time += dt;
  } catch (e) { /* the conversation matters more than the scenery */ }
  return r;
};
})();

// the camera looks a little ahead of where you are going (more in a car), and shakes more gently
(() => {
const R = G.renderer, _follow = R.follow, _shake = R.shake;
let lx = 0, ly = 0;
R.follow = function (x, y, mw, mh, dt, snap) {
  const g = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene), p = g && g.player;
  if (p && !snap && dt > 0 && Math.abs(x - p.x) < 2 && Math.abs(y - p.y + 0) < 40) {
    const v = p.vehicle, k = v ? 0.55 : 0.28;
    const tx = G.util.clamp((v ? Math.cos(v.angle) * v.speed : p._vx || 0) * k, -60, 60), ty = G.util.clamp((v ? Math.sin(v.angle) * v.speed : p._vy || 0) * k * 0.8, -40, 40);
    const e = 1 - Math.pow(0.08, dt);
    lx += (tx - lx) * e; ly += (ty - ly) * e;
    return _follow.call(this, x + lx, y + ly, mw, mh, dt, snap);
  }
  if (snap) { lx = 0; ly = 0; }
  return _follow.call(this, x, y, mw, mh, dt, snap);
};
R.shake = function (amount) { return _shake.call(this, amount * 0.65); };
})();
