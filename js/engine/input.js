'use strict';
// Input: keyboard, mouse and gamepad mapped to named actions. Rebindable.

G.input = {
  defaultBindings: {
    up: ['KeyW', 'ArrowUp', 'PadUp'],
    down: ['KeyS', 'ArrowDown', 'PadDown'],
    left: ['KeyA', 'ArrowLeft', 'PadLeft'],
    right: ['KeyD', 'ArrowRight', 'PadRight'],
    attack: ['Space', 'KeyJ', 'PadA'],
    interact: ['KeyE', 'PadX'],
    run: ['ShiftLeft', 'ShiftRight', 'PadRB'],
    inventory: ['KeyI', 'Tab', 'PadY'],
    journal: ['KeyL', 'PadBack'],
    map: ['KeyM', 'PadLB'],
    wait: ['KeyT'],
    talk: ['KeyT'],
    ignite: ['KeyF'],
    reload: ['KeyR', 'PadB'],
    skills: ['KeyK'],
    minimap: ['KeyN'],
    drag: ['KeyG'],
    phone: ['KeyP'],
    pause: ['Escape', 'PadStart'],
    // UI actions (not shown in rebinding)
    confirm: ['Enter', 'Space', 'KeyE', 'PadA'],
    cancel: ['Escape', 'Backspace', 'PadB'],
    tabLeft: ['KeyQ', 'PadLB'],
    tabRight: ['KeyR', 'PadRB'],
    quicksave: ['F5'],
    quickload: ['F9'],
    debug: ['F3'],
  },
  rebindable: ['up', 'down', 'left', 'right', 'attack', 'interact', 'run', 'inventory', 'journal', 'skills', 'map', 'talk', 'wait', 'ignite', 'reload', 'minimap', 'drag', 'phone', 'pause'],
  actionLabels: {
    up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right',
    attack: 'Attack', interact: 'Interact / Talk', run: 'Run', inventory: 'Inventory',
    journal: 'Journal', skills: 'Skills', map: 'World Map', talk: 'Talk (type)', wait: 'Wait / Rest', ignite: 'Set Fire (Lighter)', reload: 'Reload', minimap: 'Toggle Minimap', drag: 'Drag Body', phone: 'Phone', pause: 'Pause',
  },
  typed: [],              // printable characters typed this step (text fields)

  bindings: null,
  down: new Set(),
  pressed: new Set(),
  lastKey: null,        // last physical key pressed this frame (for rebinding)
  mouse: { x: 0, y: 0, ux: 0, uy: 0, down: false, pressed: false, rpressed: false, wheel: 0, moved: false },
  padPrev: new Set(),

  init(canvas) {
    this.loadBindings();
    const block = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3', 'F5', 'F9', 'Backspace', 'Backquote']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat && (e.code === 'F11' || (e.code === 'Enter' && e.altKey))) {
        e.preventDefault();
        G.platform.toggleFullscreen();
        return;
      }
      if (!this.down.has(e.code)) {
        this.pressed.add(e.code);
        this.lastKey = e.code;
      }
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey) this.typed.push(e.key);
      this.down.add(e.code);
      G.audio && G.audio.unlock();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const dpr = canvas.width / r.width;
      this.mouse.x = (e.clientX - r.left) * dpr;
      this.mouse.y = (e.clientY - r.top) * dpr;
      this.mouse.ux = this.mouse.x / G.renderer.uiScale;
      this.mouse.uy = this.mouse.y / G.renderer.uiScale;
      this.mouse.moved = true;
    };
    canvas.addEventListener('mousemove', pos);
    canvas.addEventListener('mousedown', (e) => {
      pos(e);
      // a click waits for the next game step: a frame with no step would otherwise lose it
      if (e.button === 0) { this.mouse.down = true; this.mouse.wantL = true; }
      if (e.button === 2) { this.mouse.wantR = true; this.mouse.rdown = true; }
      G.audio && G.audio.unlock();
      canvas.focus();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rdown = false; });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  loadBindings() {
    const saved = G.settings.get('bindings');
    this.bindings = G.util.clone(this.defaultBindings);
    if (saved) for (const a in saved) if (this.bindings[a] && saved[a]) this.bindings[a] = saved[a].slice();
  },

  saveBindings() {
    const out = {};
    for (const a of this.rebindable) out[a] = this.bindings[a];
    G.settings.set('bindings', out);
  },

  // Replace the primary (first) key of an action.
  rebind(action, code) {
    const list = this.bindings[action];
    list[0] = code;
    this.saveBindings();
  },

  resetBindings() {
    G.settings.set('bindings', null);
    this.loadBindings();
  },

  keyName(code) {
    if (!code) return '-';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '')
      .replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace(/^Pad/, 'Pad ');
  },

  isDown(action) {
    const l = this.bindings[action];
    if (!l) return false;
    for (const c of l) if (this.down.has(c)) return true;
    return false;
  },

  wasPressed(action) {
    const l = this.bindings[action];
    if (!l) return false;
    for (const c of l) if (this.pressed.has(c)) return true;
    return false;
  },

  consume(action) {
    const l = this.bindings[action];
    if (l) for (const c of l) this.pressed.delete(c);
  },

  // Call once per fixed step before scene updates.
  update() {
    if (this.mouse.wantL) { this.mouse.wantL = false; this.mouse.pressed = true; }
    if (this.mouse.wantR) { this.mouse.wantR = false; this.mouse.rpressed = true; }
    this.pollGamepad();
  },

  // Keyboard edge state is cleared after each fixed update step.
  endFrame() {
    this.pressed.clear();
    this.lastKey = null;
    this.typed.length = 0;
  },

  // Mouse edge state is cleared after rendering, because UI buttons are evaluated while drawing.
  endRender() {
    this.mouse.pressed = false;
    this.mouse.rpressed = false;
    this.mouse.wheel = 0;
    this.mouse.moved = false;
  },

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    const now = new Set();
    if (pad) {
      const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (b(12) || ay < -0.5) now.add('PadUp');
      if (b(13) || ay > 0.5) now.add('PadDown');
      if (b(14) || ax < -0.5) now.add('PadLeft');
      if (b(15) || ax > 0.5) now.add('PadRight');
      if (b(0)) now.add('PadA');
      if (b(1)) now.add('PadB');
      if (b(2)) now.add('PadX');
      if (b(3)) now.add('PadY');
      if (b(4)) now.add('PadLB');
      if (b(5)) now.add('PadRB');
      if (b(8)) now.add('PadBack');
      if (b(9)) now.add('PadStart');
    }
    for (const c of now) {
      if (!this.padPrev.has(c)) { this.pressed.add(c); this.lastKey = c; }
      this.down.add(c);
    }
    for (const c of this.padPrev) if (!now.has(c)) this.down.delete(c);
    this.padPrev = now;
  },
};
