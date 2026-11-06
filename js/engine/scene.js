'use strict';
// Scene stack + main loop. Overlay scenes set `transparent = true` so the scene beneath renders too.
// Only the top scene receives update() calls.

G.scenes = {
  stack: [],
  top() { return this.stack[this.stack.length - 1]; },
  push(s) {
    this.stack.push(s);
    if (s.enter) s.enter();
  },
  pop() {
    const s = this.stack.pop();
    if (s && s.exit) s.exit();
    const t = this.top();
    if (t && t.resume) t.resume();
    return s;
  },
  remove(s) {
    const i = this.stack.indexOf(s);
    if (i < 0) return;
    if (i === this.stack.length - 1) this.pop();
    else { this.stack.splice(i, 1); if (s.exit) s.exit(); }
  },
  replace(s) {
    while (this.stack.length) this.pop();
    this.push(s);
  },
  find(type) { return this.stack.find((s) => s instanceof type); },
  update(dt) {
    const t = this.top();
    if (t) t.update(dt);
  },
  render() {
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].transparent) start--;
    // only the top scene gets mouse clicks (menus underneath still draw, but must not react)
    const m = G.input.mouse, saved = { pressed: m.pressed, rpressed: m.rpressed, moved: m.moved, wheel: m.wheel, ux: m.ux, uy: m.uy };
    for (let i = Math.max(0, start); i < this.stack.length; i++) {
      const top = i === this.stack.length - 1;
      if (!top) Object.assign(m, { pressed: false, rpressed: false, moved: false, wheel: 0, ux: -9999, uy: -9999 });
      else Object.assign(m, saved);
      const before = this.stack.length, scene = this.stack[i];
      scene.render(G.renderer.ctx);
      if (this.stack.length !== before || this.stack[i] !== scene) { saved.pressed = false; saved.rpressed = false; }   // a click that opened/closed a menu is used up
    }
    Object.assign(m, saved);
  },
};

G.loop = {
  fps: 0,
  time: 0,
  _frames: 0,
  _fpsT: 0,
  running: false,
  STEP: 1 / 60,

  start() {
    this.running = true;
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= this.STEP) {
        this.tick(this.STEP);
        acc -= this.STEP;
      }
      this.draw();
      this._frames++;
      this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = this._frames; this._frames = 0; this._fpsT = 0; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  tick(dt) {
    this.time += dt;
    G.input.update();
    try {
      G.scenes.update(dt);
    } catch (e) {
      G.reportError(e);
    }
    G.input.endFrame();
    if (G.cursor) G.cursor.update();
  },

  draw() {
    try {
      G.scenes.render();
      if (G.settings.get('showFps')) {
        const c = G.renderer.ctx;
        G.renderer.uiTransform();
        G.ui.text(c, this.fps + ' FPS', G.renderer.uiW - 4, 4, { align: 'right', size: 8, color: '#9f9' });
      }
    } catch (e) {
      G.reportError(e);
    }
    G.input.endRender();
  },
};

G.reportError = (e) => {
  if (G._lastErr === String(e)) return;
  G._lastErr = String(e);
  console.error(e);
  G.errors = G.errors || [];
  G.errors.push(String(e && e.stack || e));
};
