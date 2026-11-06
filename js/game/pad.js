'use strict';
// A controller plays the whole game. In menus the pad also presses the keyboard keys a screen listens for, so every screen works without
// knowing about pads. In the world the left stick walks and steers with the full range of the stick, and the right stick and the triggers
// drive a virtual mouse, so aiming, the crosshair and anything made for the mouse need nothing of their own. Whatever was touched last
// decides which prompts show: keyboard and mouse, or the pad's buttons. Text fields get an on-screen keyboard.
(() => {
const I = G.input, S = G.settings, U = G.ui, m = I.mouse;
S.defaults.padDeadzone = 0.2; S.defaults.padAimSpeed = 1; S.defaults.padRumble = true; S.defaults.padBindings = null; S.defaults.padGlyphs = 3;
for (const k of ['padDeadzone', 'padAimSpeed', 'padRumble', 'padGlyphs']) if (S.data[k] == null) S.data[k] = S.defaults[k];
// the buttons by their place on the pad, in the order the Gamepad API gives them
const BTN = ['PadA', 'PadB', 'PadX', 'PadY', 'PadLB', 'PadRB', 'PadLT', 'PadRT', 'PadBack', 'PadStart', 'PadL3', 'PadR3', 'PadDUp', 'PadDDown', 'PadDLeft', 'PadDRight'];
const NAMES = {
  0: { PadA: 'A', PadB: 'B', PadX: 'X', PadY: 'Y', PadLB: 'LB', PadRB: 'RB', PadLT: 'LT', PadRT: 'RT', PadBack: 'View', PadStart: 'Menu', PadL3: 'L3', PadR3: 'R3', PadDUp: 'D-Up', PadDDown: 'D-Down', PadDLeft: 'D-Left', PadDRight: 'D-Right' },
  2: { PadA: 'B', PadB: 'A', PadX: 'Y', PadY: 'X', PadLB: 'L', PadRB: 'R', PadLT: 'ZL', PadRT: 'ZR', PadBack: '-', PadStart: '+', PadL3: 'L3', PadR3: 'R3', PadDUp: 'D-Up', PadDDown: 'D-Down', PadDLeft: 'D-Left', PadDRight: 'D-Right' },
  1: { PadA: 'Cross', PadB: 'Circle', PadX: 'Square', PadY: 'Triangle', PadLB: 'L1', PadRB: 'R1', PadLT: 'L2', PadRT: 'R2', PadBack: 'Share', PadStart: 'Options', PadL3: 'L3', PadR3: 'R3', PadDUp: 'D-Up', PadDDown: 'D-Down', PadDLeft: 'D-Left', PadDRight: 'D-Right' },
};
const FACE = { PadA: '#3aa04a', PadB: '#c83a32', PadX: '#2f6fd0', PadY: '#d8a820' };
// what each gameplay action starts on
const DEFAULT = { interact: 'PadA', dodge: 'PadB', attack: 'PadX', kick: 'PadY', run: 'PadRB', reload: 'PadLB', inventory: 'PadDUp', phone: 'PadDDown', journal: 'PadDLeft', map: 'PadDRight', pause: 'PadStart', quickMenu: 'PadBack', drag: 'PadL3', minimap: 'PadR3' };
const LABEL = { interact: 'Interact / Talk', dodge: 'Dodge', attack: 'Attack', kick: 'Kick', run: 'Run', reload: 'Reload', inventory: 'Inventory', phone: 'Phone', journal: 'Journal', map: 'World Map', pause: 'Pause', quickMenu: 'Quick Menu', drag: 'Drag', minimap: 'Toggle Minimap' };
if (!I.defaultBindings.quickMenu) I.defaultBindings.quickMenu = [];
// a pad press in a menu is also the key that screen is listening for
const KEYS = { PadA: ['Enter'], PadB: ['Escape'], PadX: ['KeyX', 'KeyU'], PadY: ['KeyR', 'KeyT'], PadLB: ['PageUp'], PadRB: ['PageDown'], PadStart: ['Enter'] };
const DIRS = { up: ['PadUp', 'ArrowUp'], down: ['PadDown', 'ArrowDown'], left: ['PadLeft', 'ArrowLeft'], right: ['PadRight', 'ArrowRight'] };
const inWorld = () => { const t = G.scenes.top(); return !!(G.GameScene && t instanceof G.GameScene); };
const P = G.pad = {
  connected: false, device: 'kbm', held: new Set(), stick: null, aim: null, lt: 0, rt: 0, DEFAULT, LABEL, BTN, rep: {}, aimAng: 0, ptr: false, seen: false,
  zone(x, y, dz = S.get('padDeadzone')) { const l = Math.hypot(x, y); if (l < dz) return null; const k = Math.min(1, (l - dz) / (1 - dz)) / l; return { x: x * k, y: y * k, len: Math.min(1, (l - dz) / (1 - dz)) }; },
  map() { return Object.assign({}, DEFAULT, S.get('padBindings') || {}); },
  apply() { const M = this.map(); for (const a in I.bindings) I.bindings[a] = I.bindings[a].filter((c) => !/^Pad/.test(c) || !(a in DEFAULT)); for (const a in M) { if (!I.bindings[a]) I.bindings[a] = []; I.bindings[a].push(M[a]); } },
  // one button does one thing: the action already on it takes the old button of the one that moved
  rebind(action, code) { const M = this.map(); for (const a in M) if (a !== action && M[a] === code) M[a] = M[action]; M[action] = code; S.set('padBindings', M); this.apply(); },
  reset() { S.set('padBindings', null); this.apply(); },
  name(code) { const g = S.get('padGlyphs'), k = g === 3 ? { ps: 1, switch: 2 }[this.brand] || 0 : g; return (NAMES[k] || NAMES[0])[code] || code.replace(/^Pad/, ''); },
  // the prompt for an action, on whatever is in the player's hands
  prompt(action) { const l = I.bindings[action] || []; if (this.device === 'pad') { const c = l.find((k) => /^Pad/.test(k)); if (c) return this.name(c); } return I.keyName(l.find((k) => !/^Pad/.test(k)) || l[0]); },
  use() { if (this.device !== 'pad') { this.device = 'pad'; G.events && G.events.emit('inputDevice', 'pad'); } },
  // the walk: the stick's direction and how far it is pushed
  moveVec() { return this.stick && !this.oskOpen ? { x: this.stick.x, y: this.stick.y, run: this.stick.len > 0.92 } : null; },
  drive() { return this.device === 'pad' ? { gas: this.rt, brake: this.lt, steer: this.stick ? this.stick.x : 0 } : null; },
  press(code) { I.pressed.add(code); I.lastKey = code; I.down.add(code); },
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], pad = pads && Array.from(pads).find((p) => p && p.connected), now = new Set(), world = inWorld();
    if (!!pad !== this.connected) { this.connected = !!pad; const t = G.scenes.stack.find((s) => s instanceof G.GameScene); if (t && t.toast) t.toast(pad ? 'Controller connected.' : 'Controller disconnected.', 'info'); if (!pad && this.device === 'pad') this.device = 'kbm'; }
    this.stick = null; this.aim = null; this.lt = this.rt = 0;
    if (pad) {
      this.brand = pad.brand || 'xbox'; const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed), a = (i) => pad.axes[i] || 0;
      BTN.forEach((c, i) => { if (b(i)) now.add(c); });
      this.lt = (pad.buttons[6] && pad.buttons[6].value) || 0; this.rt = (pad.buttons[7] && pad.buttons[7].value) || 0;
      this.stick = this.zone(a(0), a(1)); this.aim = this.zone(a(2), a(3), Math.max(0.2, S.get('padDeadzone')));
      if (now.size || this.stick || this.aim) this.use();
    }
    if (this.oskOpen) { this.osk(now); this.held = now; return; }
    for (const c of now) { if (!this.held.has(c)) { this.press(c); if (!world) for (const k of KEYS[c] || []) this.press(k); } I.down.add(c); }
    for (const c of this.held) if (!now.has(c)) { I.down.delete(c); for (const k of KEYS[c] || []) I.down.delete(k); }
    // directions: in a menu, with repeat while held; in the world, the digital reading of the stick for whatever wants one
    const d = { up: now.has('PadDUp'), down: now.has('PadDDown'), left: now.has('PadDLeft'), right: now.has('PadDRight') }, s = this.stick;
    if (s) { if (s.y < -0.45) d.up = true; if (s.y > 0.45) d.down = true; if (s.x < -0.45) d.left = true; if (s.x > 0.45) d.right = true; }
    if (world) { d.up = !!(s && s.y < -0.45); d.down = !!(s && s.y > 0.45); d.left = !!(s && s.x < -0.45); d.right = !!(s && s.x > 0.45); }
    for (const k in DIRS) {
      const c = DIRS[k], r = this.rep[k] || (this.rep[k] = { t: 0, on: false });
      if (d[k]) { if (!r.on) { r.on = true; r.t = 0.34; for (const q of c) { I.pressed.add(q); I.lastKey = q; } } else if (!world && (r.t -= G.loop.STEP) <= 0) { r.t = 0.11; for (const q of c) I.pressed.add(q); } for (const q of c) I.down.add(q); }
      else if (r.on) { r.on = false; for (const q of c) I.down.delete(q); }
    }
    this.held = now;
    this.pointer(world);
  },
  // the virtual mouse
  pointer(world) {
    const R = G.renderer, top = G.scenes.top(), a = this.aim;
    if (world && top.player) {
      const p = top.player;
      if (p.vehicle) { this.relM(); return; }
      const sx = (p.x - R.cam.x) * R.zoom, sy = (p.y - 8 - R.cam.y) * R.zoom, gun = p.weaponItem && p.weaponItem.gun;
      if (a) this.aimAng = Math.atan2(a.y, a.x); else if (this.stick && !(this.lt > 0.3)) this.aimAng = Math.atan2(this.stick.y, this.stick.x);
      if (a || this.lt > 0.3 || this.rt > 0.3) {
        const r = (gun ? 120 + (a ? a.len : 0.6) * 260 * S.get('padAimSpeed') : 90) * (R.H / 720);
        m.x = sx + Math.cos(this.aimAng) * r; m.y = sy + Math.sin(this.aimAng) * r; m.ux = m.x / R.uiScale; m.uy = m.y / R.uiScale; this.ptr = !!gun;
      }
      const ld = this.lt > 0.3, rd = this.rt > 0.3;
      if (ld !== this.ldown) { this.ldown = ld; m.rdown = ld; if (ld) m.rpressed = true; }
      if (rd !== this.rdown) { this.rdown = rd; m.down = rd; if (rd) m.pressed = true; }
      return;
    }
    // in a menu: the right stick moves a pointer for what only a mouse can reach; the right trigger clicks, the left right-clicks
    if (a) { const v = 900 * G.loop.STEP * (R.H / 720) * (0.4 + a.len); m.x = G.util.clamp(m.x + a.x * v, 0, R.W); m.y = G.util.clamp(m.y + a.y * v, 0, R.H); m.ux = m.x / R.uiScale; m.uy = m.y / R.uiScale; m.moved = true; this.ptr = true; }
    const rd = this.rt > 0.3, ld = this.lt > 0.3;
    if (rd !== this.rdown) { this.rdown = rd; m.down = rd; if (rd) m.pressed = true; }
    if (ld !== this.ldown) { this.ldown = ld; m.rdown = ld; if (ld) m.rpressed = true; }
  },
  relM() { if (this.rdown) { this.rdown = false; m.down = false; } if (this.ldown) { this.ldown = false; m.rdown = false; } },
  rumble(l, r, ms) { if (this.connected && S.get('padRumble') && G.platform.post) { if (G.desktop) G.platform.post(`rumble:${l.toFixed(2)}:${r.toFixed(2)}:${Math.round(ms)}`); } },

  // ---------------------------------------------------------------- the on-screen keyboard: comes up when a text field is listening
  ROWS: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'], ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'], ['á', 'ã', 'é', 'ê', 'í', 'ó', 'õ', 'ú', '-', "'"]],
  oskOpen: false, oskR: 1, oskC: 0, oskShift: false, oskT: 0,
  osk(now) {
    const t = (c) => now.has(c) && !this.held.has(c), s = this.stick;
    const step = (dr, dc) => { this.oskR = (this.oskR + dr + this.ROWS.length) % this.ROWS.length; this.oskC = (this.oskC + dc + 10) % 10; G.audio.play('select'); };
    this.oskT -= G.loop.STEP; const dy = s ? (s.y < -0.5 ? -1 : s.y > 0.5 ? 1 : 0) : 0, dx = s ? (s.x < -0.5 ? -1 : s.x > 0.5 ? 1 : 0) : 0;
    if (dy || dx) { if (this.oskT <= 0) { step(dy, dx); this.oskT = 0.16; } } else this.oskT = 0;
    if (t('PadDUp')) step(-1, 0); if (t('PadDDown')) step(1, 0); if (t('PadDLeft')) step(0, -1); if (t('PadDRight')) step(0, 1);
    if (t('PadA')) { const c = this.ROWS[this.oskR][this.oskC]; I.typed.push(this.oskShift ? c.toUpperCase() : c); this.oskShift = false; }
    if (t('PadX')) { I.pressed.add('Backspace'); I.lastKey = 'Backspace'; }
    if (t('PadY')) I.typed.push(' ');
    if (t('PadLB') || t('PadL3')) this.oskShift = !this.oskShift;
    if (t('PadStart') || t('PadRB')) { I.pressed.add('Enter'); this.oskOpen = false; this.oskClosed = G.loop.time; }
    if (t('PadB')) { I.pressed.add('Escape'); this.oskOpen = false; this.oskClosed = G.loop.time; }
  },
  drawOsk(ctx) {
    const R = G.renderer; R.uiTransform(); const W = R.uiW, H = R.uiH, cw = 20, ch = 18, w = cw * 10 + 12, h = ch * this.ROWS.length + 26, x = (W - w) / 2, y = H - h - 8;
    ctx.fillStyle = 'rgba(14,14,18,0.92)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#d8b468'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this.ROWS.forEach((row, r) => row.forEach((c, i) => { const sel = r === this.oskR && i === this.oskC, a = x + 6 + i * cw, b = y + 5 + r * ch; ctx.fillStyle = sel ? '#d8b468' : '#2a2a32'; ctx.fillRect(a, b, cw - 2, ch - 2); U.text(ctx, this.oskShift ? c.toUpperCase() : c, a + (cw - 2) / 2, b + 3, { size: 10, align: 'center', color: sel ? '#141418' : '#e8e4dc', shadow: false }); }));
    U.text(ctx, `${this.name('PadA')} type · ${this.name('PadX')} erase · ${this.name('PadY')} space · ${this.name('PadLB')} shift · ${this.name('PadStart')} done · ${this.name('PadB')} cancel`, W / 2, y + h - 15, { size: 7, align: 'center', color: '#c8c4bc', shadow: false });
  },
  // a button on screen, in its colours
  glyph(ctx, code, x, y, sz = 8) {
    const t = this.name(code), f = FACE[code], w = Math.max(sz + 3, t.length * sz * 0.56 + 5);
    ctx.fillStyle = f || '#3a3a42'; ctx.beginPath(); if (f) ctx.arc(x + w / 2, y + w / 2, w / 2, 0, 6.3); else if (ctx.roundRect) ctx.roundRect(x, y, w, sz + 3, 2); else ctx.rect(x, y, w, sz + 3); ctx.fill();
    U.text(ctx, t, x + w / 2, y + (f ? (w - sz) / 2 : 1.5), { size: sz, align: 'center', color: '#f4f0e8', weight: 'bold', shadow: false });
    return w;
  },
};
// prompts written into text as [E], [R], [T]...: they become the pad's buttons while the pad is in hand
const KEY_ACTION = { E: 'interact', R: 'reload', T: 'talk', Q: 'kick', F: 'ignite', G: 'drag', I: 'inventory', M: 'map', K: 'skills', J: 'attack', P: 'phone', L: 'journal', N: 'minimap', B: 'build', Space: 'attack', Enter: 'confirm', Esc: 'cancel', Escape: 'cancel', Tab: 'inventory', Ctrl: 'dodge', Shift: 'run', Y: 'answerYes' };
const padText = (s) => (P.device === 'pad' && typeof s === 'string' && s.includes('[') ? s.replace(/\[(Space|Enter|Esc|Escape|Tab|Ctrl|Shift|[A-Z])\]/g, (w, k) => { const a = KEY_ACTION[k], c = a && (I.bindings[a] || []).find((q) => /^Pad/.test(q)); return c ? `[${P.name(c)}]` : w; }) : s);
const _text = U.text, _measure = U.measure;
U.text = function (ctx, s, ...r) { return _text.call(this, ctx, padText(s), ...r); };
U.measure = function (ctx, s, ...r) { return _measure.call(this, ctx, padText(s), ...r); };
// any input from the keyboard or the mouse hands the prompts back
window.addEventListener('keydown', () => { P.device = 'kbm'; P.ptr = false; });
window.addEventListener('mousemove', () => { P.device = 'kbm'; P.ptr = false; });
// a screen that reads typed text while the pad is in hand gets the keyboard
// (a text field is a screen that goes through the typed characters; clearing them is not)
const typed = []; delete I.typed;
typed[Symbol.iterator] = function () { P._reads = (P._reads || 0) + 1; return Array.prototype[Symbol.iterator].call(this); };
Object.defineProperty(typed, Symbol.iterator, { enumerable: false });
Object.defineProperty(I, 'typed', { configurable: true, get() { return typed; }, set(v) { typed.length = 0; for (let i = 0; i < v.length; i++) typed.push(v[i]); } });
const _poll = I.pollGamepad;
I.pollGamepad = function () { return P.poll(); }; void _poll;
const _load = I.loadBindings;
I.loadBindings = function () { _load.call(this); P.apply(); };
I.resetBindings = function () { G.settings.set('bindings', null); this.loadBindings(); };
const _end = I.endFrame;
I.endFrame = function () { const r = P._reads || 0, top = G.scenes.top(); P._reads = 0; if (r && P.device === 'pad' && !P.oskOpen && !(P.oskClosed > G.loop.time - 0.4) && !/debug/i.test(top && top.constructor.name)) P.oskOpen = true; else if (!r && P.oskOpen) { P.oskQuiet = (P.oskQuiet || 0) + 1; if (P.oskQuiet > 3) { P.oskOpen = false; P.oskQuiet = 0; } } else P.oskQuiet = 0; return _end.call(this); };
if (I.bindings) P.apply();
// on top of everything
const _draw = G.loop.draw;
G.loop.draw = function () { const r = _draw.apply(this, arguments); if (P.oskOpen) { try { P.drawOsk(G.renderer.ctx); } catch (e) { P.oskOpen = false; } } return r; };

// ---------------------------------------------------------------- the rest of the buttons: one list, on View
const QUICK = [['Journal', 'journal'], ['Skills', 'skills'], ['World Map', 'map'], ['Wait / Rest', 'wait'], ['Say something', 'talk'], ['Set Fire (Lighter)', 'ignite'], ['Drag', 'drag'], ['Build', 'build'], ['Toggle Minimap', 'minimap'], ['Phone', 'phone']];
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  if (G.scenes.top() === this && I.wasPressed('quickMenu') && !this.player.dead) {
    I.consume('quickMenu');
    G.scenes.push(new G.ChoiceScene('Quick Menu', '', QUICK.map(([label, a]) => ({ label, fn: () => { P.later = a; } })).concat([{ label: 'Close', fn: () => {} }])));
  } else if (P.later && G.scenes.top() === this) { const a = P.later; P.later = null; for (const c of (I.bindings[a] || []).filter((k) => !/^Pad/.test(k)).slice(0, 1)) I.pressed.add(c); }
  return _gu.call(this, dt);
};
// a blow lands: the pad feels it
const _dmg = G.combat.damage;
G.combat.damage = function (t, n, src) { const r = _dmg.apply(this, arguments); if (P.connected && t && t.kind === 'player') P.rumble(0.5, 0.8, 160); else if (P.connected && src && src.kind === 'player') P.rumble(0.2, 0.3, 70); return r; };

Object.assign(G.LANG_PT.s, {
  Cannibalism: 'Canibalismo', 'dismembering a body': 'esquartejar um corpo', 'Iron Hide': 'Couro de Ferro', 'Get them!': 'Peguem!', 'Stop smoking [C]': 'Parar de fumar [C]',
  'Controller connected.': 'Controle conectado.', 'Controller disconnected.': 'Controle desconectado.', 'Quick Menu': 'Menu Rápido', 'Close': 'Fechar', 'Say something': 'Dizer algo', 'Build': 'Construir', 'Drag': 'Arrastar', 'Dodge': 'Esquivar', 'Attack': 'Atacar', 'Run': 'Correr', 'Reload': 'Recarregar', 'Pause': 'Pausar',
  'Interact / Talk': 'Interagir / Falar', 'Toggle Minimap': 'Alternar Minimapa', 'Controller': 'Controle', 'Stick Dead Zone': 'Zona Morta do Analógico', 'Aim Sensitivity': 'Sensibilidade da Mira', 'Vibration': 'Vibração', 'Button Style': 'Estilo dos Botões', 'Xbox': 'Xbox', 'PlayStation': 'PlayStation', 'Switch': 'Switch', 'Automatic': 'Automático', 'Reset Controller': 'Restaurar Controle', 'Press a button...': 'Aperte um botão...',
  'Left stick: move. Right stick: aim. RT: fire or click. LT: aim or right-click.': 'Analógico esquerdo: mover. Direito: mirar. RT: atirar ou clicar. LT: mirar ou clique direito.',
  'Driving: left stick steers, RT accelerates, LT brakes.': 'Dirigindo: analógico esquerdo vira, RT acelera, LT freia.',
  'In menus the right stick moves a pointer and RT clicks.': 'Nos menus o analógico direito move um ponteiro e RT clica.',
});
})();
