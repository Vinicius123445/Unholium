'use strict';
// Settings: audio, video, gameplay and key rebinding. Persists to localStorage.
(() => {
const U = G.ui;
const TABS = ['Audio', 'Video', 'Gameplay', 'Controls', 'Graphics', 'Controller'];

class SettingsScene {
  constructor() {
    this.transparent = true;
    this.tab = 0;
    this.sel = 0;
    this.rebinding = null;
  }

  options() {
    const s = G.settings;
    const pct = (v) => Math.round(v * 100) + '%';
    const slider = (key, label) => ({ label, value: pct(s.get(key)), left: () => s.set(key, Math.max(0, +(s.get(key) - 0.1).toFixed(2))), right: () => s.set(key, Math.min(1, +(s.get(key) + 0.1).toFixed(2))), frac: s.get(key) });
    const toggle = (key, label) => ({ label, value: s.get(key) ? 'On' : 'Off', act: () => s.set(key, !s.get(key)) });
    const fineP = (key, label, lo, hi) => ({ label, value: pct(s.get(key)), left: () => s.set(key, Math.max(lo, +(s.get(key) - 0.05).toFixed(2))), right: () => s.set(key, Math.min(hi, +(s.get(key) + 0.05).toFixed(2))) });
    const cycle = (key, label, names) => ({ label, value: names[s.get(key)], names, idx: s.get(key), set: (i) => s.set(key, i), left: () => s.set(key, (s.get(key) + names.length - 1) % names.length), right: () => s.set(key, (s.get(key) + 1) % names.length) });
    switch (this.tab) {
      case 0: return [slider('masterVolume', 'Master Volume'), slider('musicVolume', 'Music Volume'), slider('sfxVolume', 'Effects Volume')];
      case 1: return [
        { label: 'Fullscreen (F11)', value: G.platform.isFullscreen() ? 'On' : 'Off', act: () => G.platform.toggleFullscreen() },
        cycle('graphics', 'Quality Preset', ['Low', 'Medium', 'High', 'Ultra']),

        toggle('pixelPerfect', 'Pixel-Perfect Scaling'), toggle('screenShake', 'Screen Shake'), toggle('showMinimap', 'Show Minimap'), toggle('gore', 'Gore & Blood'), toggle('censor', 'Censor Nudity'), toggle('showFps', 'Show FPS'),
      ];
      case 2: return [
        cycle('language', 'Language', G.i18n.NAMES),
        cycle('textSpeed', 'Text Speed', ['Slow', 'Normal', 'Fast', 'Instant']),
        cycle('difficulty', 'Difficulty', ['Easy', 'Normal', 'Hard']),
        cycle('notifications', 'Notifications', ['Minimal', 'Normal', 'All']),
        toggle('bubbles', 'Speech Bubbles'),
        // AI dialogue (js/game/aidialogue.js): on by default with Llama on this PC; or Claude online with your key
        // (the key is handed to the desktop app, which keeps it encrypted: it is never kept here)
        { label: 'Generative NPC Dialogue', value: G.ai.enabled() ? 'On' : 'Off', act: () => G.ai.setEnabled(!G.ai.enabled()) },
        (() => {   // every model you can use: the ones installed on this PC (Llama), then Claude online
          const list = G.ai.modelChoices(), cur = Math.max(0, list.indexOf(G.ai.currentChoice()));
          return { label: 'AI Model', value: G.ai.choiceLabel(list[cur]), names: list.map((c) => G.ai.choiceLabel(c)), idx: cur, set: (i) => G.ai.choose(list[i]), left: () => G.ai.choose(list[(cur + list.length - 1) % list.length]), right: () => G.ai.choose(list[(cur + 1) % list.length]) };
        })(),
        { label: 'Claude API Key', value: G.ai.keySet ? 'Saved' : 'Not set (only for Claude)', field: true, act: () => G.scenes.push(new G.ai.PromptScene('Claude API Key', '', (v) => G.ai.setKey(v), { secret: true, hint: 'Paste your key. The desktop app keeps it encrypted. Empty removes it.' })) },
        { label: 'Other Local Model...', value: '', field: true, act: () => G.scenes.push(new G.ai.PromptScene('Local Model Name', s.get('aiLocalModel'), (v) => { if (v) G.ai.choose('local:' + v); }, { hint: 'A model your local server has, e.g. llama3.1:8b' })) },
        { label: 'Local AI Address', value: s.get('aiLocalUrl'), field: true, act: () => G.scenes.push(new G.ai.PromptScene('Local AI Address', s.get('aiLocalUrl'), (v) => { if (/^https?:\/\//.test(v)) G.ai.setLocalUrl(v); }, { hint: 'Ollama (port 11434) or an OpenAI-compatible server (llama.cpp).' })) },
        { label: 'Test AI Connection', value: G.ai.lastTest || G.ai.status(), act: () => G.ai.test() },
        { label: 'Day Length', value: s.get('dayLengthMinutes') + ' min', left: () => s.set('dayLengthMinutes', Math.max(4, s.get('dayLengthMinutes') - 2)), right: () => s.set('dayLengthMinutes', Math.min(60, s.get('dayLengthMinutes') + 2)) },
        { label: 'Reset All Settings', value: '', act: () => G.scenes.push(new G.ConfirmScene('Reset all settings to defaults?', () => { const b = s.get('bindings'); s.data = Object.assign({}, s.defaults, { bindings: b }); s.save(); G.events.emit('settingsChanged'); G.renderer.resize(); })) },
      ];
      case 3: return G.input.rebindable.map((a) => ({ label: G.input.actionLabels[a], value: G.input.keyName(G.input.bindings[a][0]), act: () => { this.rebinding = a; } }))
        .concat([toggle('legacyControls', 'Legacy Controls (keys; RMB attack, LMB aim)'), cycle('moveMode', 'Movement', ['Mouse: forward = cursor', 'Classic: keys only']), cycle('aimButton', 'Aim (mouse)', ['Left: hold, let go fires', 'Right: hold, left fires'])])
        .concat([{ label: 'Reset Controls', value: '', act: () => G.input.resetBindings() }]);
      case 5: {   // the pad (js/game/pad.js): each action to a button, and how the sticks feel
        const P = G.pad, M = P.map();
        return [{ label: 'Left stick: move. Right stick: aim. RT: fire or click. LT: aim or right-click.', value: '', info: true }, { label: 'Driving: left stick steers, RT accelerates, LT brakes.', value: '', info: true }, { label: 'In menus the right stick moves a pointer and RT clicks.', value: '', info: true }]
          .concat(Object.keys(P.LABEL).map((a) => { const at = P.BTN.indexOf(M[a]), go = (d) => P.rebind(a, P.BTN[(at + d + P.BTN.length) % P.BTN.length]); return { label: P.LABEL[a], value: P.name(M[a]), left: () => go(-1), right: () => go(1), act: () => { this.padBinding = a; } }; }))
          .concat([fineP('padDeadzone', 'Stick Dead Zone', 0.05, 0.5), fineP('padAimSpeed', 'Aim Sensitivity', 0.4, 2), toggle('padRumble', 'Vibration'), cycle('padGlyphs', 'Button Style', ['Xbox', 'PlayStation', 'Switch', 'Automatic']), { label: 'Reset Controller', value: '', act: () => P.reset() }]);
      }
      case 4: {   // Graphics (js/game/gfxsettings.js)
        const O = G.gfxOpts, pick = (key, label, list, names) => ({ label, value: names[Math.max(0, list.indexOf(s.get(key)))], names, idx: list.indexOf(s.get(key)), set: (i) => s.set(key, list[i]), left: () => { const i = list.indexOf(s.get(key)); s.set(key, list[Math.max(0, (i < 0 ? 0 : i) - 1)]); }, right: () => { const i = list.indexOf(s.get(key)); s.set(key, list[Math.min(list.length - 1, (i < 0 ? 0 : i) + 1)]); } });
        const fine = (key, label, lo, hi) => ({ label, value: pct(s.get(key)), left: () => s.set(key, Math.max(lo, +(s.get(key) - 0.05).toFixed(2))), right: () => s.set(key, Math.min(hi, +(s.get(key) + 0.05).toFixed(2))), frac: (s.get(key) - lo) / (hi - lo) });
        return [
          cycle('graphics', 'Quality Preset', ['Low', 'Medium', 'High', 'Ultra']),
          cycle('resolution', 'Render Resolution', O.RES_NAMES),
          pick('renderScale', 'Render Scale (Native only)', O.SCALES, O.SCALES.map((k) => Math.round(k * 100) + '%')),
          cycle('worldZoom', 'World Zoom', O.ZOOM_NAMES),
          pick('uiScale', 'UI Scale', O.UISC, O.UISC.map((k) => Math.round(k * 100) + '%')),
          toggle('vsync', 'V-Sync'), toggle('smoothing', 'Motion Smoothing'),
          pick('fpsLimit', 'Frame Rate Limit', O.FPS.map((_, i) => i), O.FPS.map((f) => (f ? f + ' FPS' : 'Unlimited'))),
          cycle('upscale', 'Upscale Filter', ['Sharp', 'Smooth']),
          toggle('pixelPerfect', 'Pixel-Perfect Scaling'),
          fine('brightness', 'Brightness', 0.6, 1.5), fine('saturation', 'Saturation', 0, 1.6),
          toggle('fxLighting', 'Dynamic Lighting'), toggle('fxShadows', 'Sun Shadows'), toggle('fxClouds', 'Cloud Shadows'), toggle('fxWeather', 'Weather Effects'),
          toggle('fxWater', 'Water Effects'), toggle('fxVignette', 'Vignette'),
          cycle('particles', 'Particles', ['Off', 'Low', 'Normal', 'High']),
          { label: 'Show FPS', value: s.get('showFps') ? 'On' : 'Off', act: () => s.set('showFps', !s.get('showFps')) },
        ];
      }
    }
    return [];
  }

  update() {
    const I = G.input;
    if (this.padBinding) { const c = I.lastKey && G.pad.BTN.includes(I.lastKey) ? I.lastKey : null; if (c || I.pressed.has('Escape')) { if (c) G.pad.rebind(this.padBinding, c); this.padBinding = null; I.pressed.clear(); G.audio.play('confirm'); } return; }
    if (this.rebinding) {
      if (I.lastKey) {
        if (I.lastKey !== 'Escape') { G.input.rebind(this.rebinding, I.lastKey); G.audio.play('confirm'); }
        this.rebinding = null;
        I.pressed.clear();
      }
      return;
    }
    const opts = this.options();
    if (I.wasPressed('tabLeft')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.sel = 0; }
    if (I.wasPressed('tabRight')) { this.tab = (this.tab + 1) % TABS.length; this.sel = 0; }
    const o = opts[this.sel];
    if (o && I.wasPressed('left') && o.left) { o.left(); G.audio.play('select'); }
    if (o && I.wasPressed('right') && o.right) { o.right(); G.audio.play('select'); }
    const r = U.nav(this, 'sel', opts.length);
    if (r === 'confirm' && o) { if (o.act) o.act(); else if (o.right) o.right(); G.audio.play('confirm'); }
    if (r === 'cancel') { G.audio.play('back'); G.scenes.remove(this); }
  }

  render(ctx) {
    U.dim(ctx, 0.65);
    const R = G.renderer, W = 360, H = Math.min(R.uiH - 8, this.tab >= 3 ? 350 : 250), x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;   // the controls and graphics lists are long
    if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
    U.panel(ctx, x, y, W, H, { title: 'Settings', titleSize: 13 });
    TABS.forEach((t, i) => {
      const tw = (W - 24) / TABS.length, b = U.button(ctx, x + 12 + i * tw, y + 24, tw - 4, 16, t, { selected: this.tab === i, size: 9 });
      if (b.clicked) { this.tab = i; this.sel = 0; }
    });
    const opts = this.options();
    const rowH = this.tab >= 3 ? Math.max(8, Math.min(12, Math.floor((H - 74) / Math.max(1, opts.length)) - 2)) : 20;
    opts.forEach((o, i) => {
      const by = y + 50 + i * (rowH + 2);
      const b = U.button(ctx, x + 14, by, W - 28, rowH, '', { selected: this.sel === i });
      U.text(ctx, o.label, x + 22, by + rowH / 2, { size: 9, baseline: 'middle' });
      const val = this.padBinding && this.tab === 5 && i === this.sel ? 'Press a button...' : this.rebinding && this.tab === 3 && i === this.sel ? 'Press a key...' : o.value;
      if (o.frac != null) {
        U.bar(ctx, x + W - 130, by + rowH / 2 - 3, 80, 6, o.frac, '#d8b468');
      }
      U.text(ctx, (o.left ? '< ' : '') + val + (o.right ? ' >' : ''), x + W - 22, by + rowH / 2, { size: 9, align: 'right', baseline: 'middle', color: U.colors.borderLight });
      if (b.hover && G.input.mouse.moved && !this.rebinding) this.sel = i;
      if (b.clicked && !this.rebinding) {
        this.sel = i;
        if (o.act) o.act();
        else if (o.right) {
          const m = G.input.mouse;
          if (m.ux < x + W / 2 + 40 && o.left) o.left(); else o.right();
        }
      }
    });
  }
}

G.SettingsScene = SettingsScene;
SettingsScene.TABS = TABS;
})();
