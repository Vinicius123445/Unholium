'use strict';
// The few browser things the game asks for, with no browser. Canvas 2D itself is Skia (@napi-rs/canvas).
const GPU = process.env.SKIA === 'gpu' || process.env.SKIA === 'skcpu';
const nap = GPU ? null : require('@napi-rs/canvas'), sk = GPU ? require('skia-canvas') : null;
const createCanvas = GPU ? (w, h) => { const c = new sk.Canvas(w, h); c.gpu = process.env.SKIA === 'gpu'; return c; } : nap.createCanvas, Image = (nap || sk).Image, ImageData = (nap || sk).ImageData;
const W = +(process.env.W || 1256), H = +(process.env.H || 628);   // (the default: what headless Edge really gives the page)
if (nap) nap.GlobalFonts.loadSystemFonts();
const noop = () => {};
const listeners = {};
const target = (o) => Object.assign(o, { addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener: noop, dispatchEvent: noop });
const styleOf = () => ({ setProperty: noop, removeProperty: noop });
function canvas(w = 300, h = 150) {
  const c = createCanvas(w, h);
  c.style = styleOf(); c.addEventListener = noop; c.removeEventListener = noop; c.focus = noop; c.setAttribute = noop; c.tabIndex = 0;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height, right: c.width, bottom: c.height });
  c.toDataURL = c.toDataURL || (() => 'data:,');
  return c;
}
const stubEl = () => target({ style: styleOf(), appendChild: noop, removeChild: noop, setAttribute: noop, remove: noop, focus: noop, click: noop, classList: { add: noop, remove: noop, contains: () => false }, children: [] });
const game = canvas(W, H), els = { game, boot: null };
const g = globalThis;
g.window = g; g.self = g;
Object.assign(g, target({}));
g.innerWidth = W; g.innerHeight = H; g.devicePixelRatio = 1;
g.document = target({ createElement: (t) => (t === 'canvas' ? canvas() : stubEl()), getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [], body: stubEl(), head: stubEl(), documentElement: stubEl(), hidden: false, visibilityState: 'visible', hasFocus: () => true, fullscreenElement: null, write: noop, title: '' });
g.location = { search: '', href: 'native://game/', protocol: 'native:', hash: '' };
Object.defineProperty(g, 'navigator', { value: { getGamepads: () => [], userAgent: 'UnholiumNative', language: 'en', languages: ['en'] }, configurable: true });
const store = new Map();
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
g.requestAnimationFrame = (f) => { g.__raf = f; return 1; };   // (the proof of concept drives the frames itself)
g.cancelAnimationFrame = noop;
g.Image = Image; g.ImageData = ImageData; g.HTMLCanvasElement = game.constructor; g.getComputedStyle = () => ({});
g.CanvasRenderingContext2D = { prototype: Object.getPrototypeOf(game.getContext('2d')) };
g.fetch = g.fetch || (() => Promise.reject(new Error('no network')));
g.alert = noop; g.confirm = () => false; g.prompt = () => null;
module.exports = { game, W, H };
