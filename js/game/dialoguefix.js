'use strict';
// Leaving a conversation is always yours: Esc or the X close it at any moment, whatever is on screen (mid-line, while they are
// typing, while you are typing). And the camera: the world's smoothing keeps what it was at the last step, so a conversation,
// which moves the camera and the people without a step of the game scene, has to keep those up to date too.
(() => {
const DS = G.DialogueScene.prototype, _upd = DS.update, _submit = DS.submit;
DS.leave = function () {
  if (this.left) return; this.left = true;
  if (this.aiCancel) { const c = this.aiCancel; this.aiCancel = null; this.aiWait = false; try { c(); } catch (e) { /* it is over anyway */ } }
  G.input.pressed.delete('Escape');
  if (G.scenes.stack.includes(this)) this.finish();
};
// the close box and the text field answer here too, from the screen position of the click, as soon as it happens
const inside = (u, v, r) => !!r && u >= r[0] - 2 && u < r[0] + r[2] + 2 && v >= r[1] - 2 && v < r[1] + r[3] + 2;
DS.update = function (dt) {
  if (G.input.pressed.has('Escape') && G.scenes.top() === this) { G.audio.play('back'); this.leave(); return undefined; }
  const m = G.input.mouse, h = this._hit;
  if (m.pressed && G.scenes.top() === this) {
    const u = h ? m.x / h.us : 0, v = h ? m.y / h.us : 0, onClose = !!h && inside(u, v, h.close), onField = !!h && inside(u, v, h.field);
    if (G.desktop && G.platform.post) G.platform.post('log:' + JSON.stringify({ x: Math.round(m.x), y: Math.round(m.y), ux: Math.round(m.ux), uy: Math.round(m.uy), u: Math.round(u), v: Math.round(v), hit: h && { us: h.us, close: h.close, field: h.field }, W: G.renderer.W, H: G.renderer.H, uiW: G.renderer.uiW, uiH: G.renderer.uiH, onClose, onField, typing: this.typing, chars: Math.round(this.chars), len: this.fullText.length, ai: !!this.aiWait, xp: !!(G.xp && G.xp.enabled && G.xp.enabled()), noir: !!(G.xp && G.xp.noir && G.xp.noir(this)), stack: G.scenes.stack.map((s) => s.constructor.name) }));
    if (onClose) { m.pressed = false; G.audio.play('back'); this.leave(); return undefined; }
    if (onField && !this.typing && (!this.runner.node || this.runner.node.chat !== false)) { m.pressed = false; this.chars = 1e6; this.typing = true; this.input = ''; G.input.typed.length = 0; }
  }
  const g = this.game;
  if (g && g.actors) {
    for (const a of g.actors) { a._ix = a.x; a._iy = a.y; }
    for (const v of g.vehicles || []) { v._ix = v.x; v._iy = v.y; }
    const c = G.renderer.cam; g._icx = c.x; g._icy = c.y; g._stepT = G.loop.time;
  }
  return _upd.call(this, dt);
};
// what you type in the box does what the matching answer does
DS.submit = function () {
  const r = this.runner, text = (this.input || '').trim(), B = G.talkbar;
  if (this.aiWait || !text || !r.node) return _submit.call(this);
  const opts = B.list(r.node); r.barOptions = opts.map((o) => o.text);
  if (G.ai && G.ai.usable(r)) return _submit.call(this);
  const i = B.match(text, opts);
  if (i < 0) return _submit.call(this);
  this.typing = false; this.input = ''; this.choose(i);
  return undefined;
};
})();
