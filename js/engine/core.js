'use strict';
// Core: global namespace, config, utilities, RNG, event bus, storage, settings.

const G = (window.G = window.G || {});

G.config = {
  TITLE: 'Unholium',
  VERSION: '0.32',
  TILE: 16,
  VIEW_H: 240,          // world pixels visible vertically (zoom derives from this)
  UI_H: 360,            // virtual UI height; UI is laid out in these units
  START_HOUR: 8,
  SAVE_PREFIX: 'rpgbase_v3_save_',   // bump when the save format changes (old saves are ignored)
  SETTINGS_KEY: 'rpgbase_settings',
  FONT: '"Segoe UI", Tahoma, Verdana, sans-serif',
  TITLE_FONT: 'Bahnschrift, "Segoe UI", Tahoma, sans-serif',   // condensed street-sign lettering (matches the HUD)
};

G.util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  approach(v, target, step) {
    return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
  },
  hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  hash2(x, y, seed = 0) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  },
  clone: (o) => JSON.parse(JSON.stringify(o)),
  formatTime(min) {
    const h = Math.floor(min / 60) % 24;
    const m = Math.floor(min % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  },
  // 0 = down, 1 = left, 2 = right, 3 = up
  dirFromVec(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
    return dy < 0 ? 3 : 0;
  },
  DIR_VEC: [[0, 1], [-1, 0], [1, 0], [0, -1]],
  hourInRange(hour, from, to) {
    return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
  },
  capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
  plural: (n, word) => n + ' ' + word + (n === 1 ? '' : 's'),
};

let _uid = 1;
G.util.uid = (prefix = 'e') => prefix + (_uid++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

// Mulberry32 seeded RNG. Use for anything that must be deterministic (map gen, textures).
class RNG {
  constructor(seed = 1) {
    this.s = (typeof seed === 'string' ? G.util.hashString(seed) : seed) >>> 0 || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
G.RNG = RNG;
G.rng = new RNG(Date.now() & 0xffffffff); // non-deterministic runtime randomness

// Simple pub/sub used to decouple systems (combat -> world -> quests -> HUD ...)
G.events = {
  _h: {},
  on(name, fn) {
    (this._h[name] || (this._h[name] = [])).push(fn);
    return () => this.off(name, fn);
  },
  off(name, fn) {
    const l = this._h[name];
    if (l) this._h[name] = l.filter((f) => f !== fn);
  },
  emit(name, ...args) {
    const l = this._h[name];
    if (l) for (const f of l.slice()) {
      try { f(...args); } catch (e) { console.error(e); (G.errors = G.errors || []).push(`${name}: ${e.message}`); }   // one bad listener must not stop the others (or the clock)
    }
  },
};

// localStorage wrapper that never throws (private mode, blocked storage, file:// quirks)
G.store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },
};

G.settings = {
  defaults: {
    masterVolume: 0.8,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    showFps: false,
    screenShake: true,
    language: 0,           // 0 English, 1 Brazilian Portuguese (js/engine/i18n.js)
    textSpeed: 2,          // 0 slow, 1 normal, 2 fast, 3 instant
    pixelPerfect: false,
    showMinimap: true,
    gore: true,            // blood, pools and gibs
    censor: false,         // censor bars over naked bodies (off: drawn as they are)
    graphics: 3,           // 0 low, 1 medium, 2 high, 3 ultra (js/game/gfxsettings.js)
    dayLengthMinutes: 12,  // real minutes per in-game day
    difficulty: 1,         // 0 easy, 1 normal, 2 hard
    fullscreen: false,     // desktop build only (remembered between sessions)
    bindings: null,        // null => input defaults
  },
  data: {},
  load() {
    this.data = Object.assign({}, this.defaults, G.store.get(G.config.SETTINGS_KEY, {}));
    if (!this.data.nudeV2) { this.data.nudeV2 = true; this.data.censor = false; }   // (bars stay available in Settings)
  },
  save() {
    G.store.set(G.config.SETTINGS_KEY, this.data);
  },
  get(k) { return this.data[k]; },
  set(k, v) {
    this.data[k] = v;
    this.save();
    G.events.emit('settingsChanged', k, v);
  },
};
G.settings.load();

// Platform layer: the desktop build (desktop/Host.cs) runs the game inside a native window via WebView2
// and listens for these messages. When opened directly in a browser the same calls fall back gracefully.
G.desktop = !!(window.chrome && window.chrome.webview);
G.platform = {
  post(msg) { if (G.desktop) window.chrome.webview.postMessage(msg); },
  isFullscreen() { return G.desktop ? !!G.settings.get('fullscreen') : !!document.fullscreenElement; },
  setFullscreen(on) {
    if (G.desktop) {
      G.settings.set('fullscreen', on);
      this.post(on ? 'fullscreen:1' : 'fullscreen:0');
    } else if (on) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) document.exitFullscreen();
  },
  toggleFullscreen() { this.setFullscreen(!this.isFullscreen()); },
  quit() { this.post('quit'); },
};
