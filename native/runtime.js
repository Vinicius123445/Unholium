'use strict';
// Everything the game used to get from the browser and from the C# host, with neither. The game's own files do not change: they ask for a
// canvas, a storage, a gamepad, and talk to "the host" through the same small message channel, and this answers.
//   Canvas 2D: Skia on the GPU (skia-canvas). Sound: node-web-audio-api. Gamepad: XInput. Storage: one file per key under data\storage.
const fs = require('fs'), path = require('path');
const { Canvas, Image, ImageData, FontLibrary, CanvasRenderingContext2D } = require('skia-canvas');
const ROOT = path.join(__dirname, '..');
const HOME = process.env.UNHOLIUM_HOME || ROOT;   // where the exe is: saves, worlds and wallpapers live beside it
const DATA = process.env.UNHOLIUM_DATA || path.join(HOME, 'data');
const USE_GPU = process.env.UNHOLIUM_CPU !== '1';
process.chdir(ROOT);   // (the game's pictures are named from its own folder)
fs.mkdirSync(path.join(DATA, 'storage'), { recursive: true });
const noop = () => {};

// ---------------------------------------------------------------- events
const hub = () => { const L = {}; return { addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, removeEventListener(t, f) { if (L[t]) L[t] = L[t].filter((x) => x !== f); }, dispatchEvent(e) { for (const f of (L[e.type] || []).slice()) f(e); return true; } }; };
const fire = (o, type, e = {}) => o.dispatchEvent(Object.assign({ type, preventDefault: noop, stopPropagation: noop }, e));

// ---------------------------------------------------------------- canvas
const g_ = globalThis, W0_ = +(process.env.W || 1280), H0_ = +(process.env.H || 720); let gameMade = false;
const styleOf = () => ({ setProperty: noop, removeProperty: noop });
function canvas(w = 300, h = 150) {
  const c = new Canvas(w, h); c.gpu = USE_GPU;
  Object.assign(c, hub(), { style: styleOf(), focus: noop, blur: noop, setAttribute: noop, tabIndex: 0, getBoundingClientRect: () => ({ left: 0, top: 0, width: c.width, height: c.height, right: c.width, bottom: c.height }) });
  if (w === W0_ && h === H0_ && !gameMade) { gameMade = true; c.getBoundingClientRect = () => ({ left: 0, top: 0, width: g_.innerWidth, height: g_.innerHeight, right: g_.innerWidth, bottom: g_.innerHeight }); }
  c.toDataURL = (type = 'image/png') => `data:${type};base64,${c.toBufferSync(type === 'image/jpeg' ? 'jpeg' : 'png').toString('base64')}`;
  return c;
}
// anything else a script makes: enough of an element that nothing trips, and text stays readable
function element(tag) {
  const kids = [], e = Object.assign(hub(), { tagName: String(tag).toUpperCase(), style: styleOf(), dataset: {}, children: kids, textContent: '', id: '', appendChild(k) { kids.push(k); if (e.onAdd) e.onAdd(k); return k; }, removeChild(k) { const i = kids.indexOf(k); if (i >= 0) kids.splice(i, 1); return k; }, remove: noop, focus: noop, click: noop, setAttribute: noop, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  return e;
}
const W0 = +(process.env.W || 1280), H0 = +(process.env.H || 720), game = canvas(W0, H0), els = { game };
const body = element('body');
body.onAdd = (k) => { if (k.id) els[k.id] = k; };

const g = globalThis, win = hub();
g.window = g; g.self = g; g.addEventListener = win.addEventListener; g.removeEventListener = win.removeEventListener; g.dispatchEvent = win.dispatchEvent;
g.innerWidth = W0; g.innerHeight = H0; g.devicePixelRatio = 1;
const dq = process.argv.find((a) => a.startsWith('--search=')), wq = process.argv.find((a) => a.startsWith('--world='));   // (the tool's Play button)
g.location = { search: dq ? dq.slice(9) : wq ? '?world=' + encodeURIComponent(wq.slice(8)) : '', href: 'native://game/', protocol: 'native:', hash: '', hostname: 'game.local' };
g.document = Object.assign(hub(), { createElement: (t) => (t === 'canvas' ? canvas() : element(t)), getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [], body, head: element('head'), documentElement: element('html'), hidden: false, visibilityState: 'visible', hasFocus: () => true, fullscreenElement: null, title: '', write: noop });
for (const [a, b] of [['naturalWidth', 'width'], ['naturalHeight', 'height']]) if (!(a in Image.prototype)) Object.defineProperty(Image.prototype, a, { get() { return this[b]; } });
g.Image = Image; g.ImageData = ImageData; g.HTMLCanvasElement = Canvas; g.CanvasRenderingContext2D = CanvasRenderingContext2D; g.getComputedStyle = () => ({});
g.alert = (m) => console.log('ALERT', m); g.confirm = () => false; g.prompt = () => null;

// ---------------------------------------------------------------- storage: survives a crash mid-write
const nameOf = (k) => encodeURIComponent(k).replace(/[*]/g, '%2A') + '.json', dir = path.join(DATA, 'storage');
const cache = new Map(), reloadStorage = () => { cache.clear(); for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) cache.set(decodeURIComponent(f.slice(0, -5)), fs.readFileSync(path.join(dir, f), 'utf8')); };
reloadStorage();
g.localStorage = {
  getItem: (k) => (cache.has(k) ? cache.get(k) : null),
  setItem(k, v) { v = String(v); cache.set(k, v); const f = path.join(dir, nameOf(k)), t = f + '.tmp'; fs.writeFileSync(t, v); fs.renameSync(t, f); },
  removeItem(k) { cache.delete(k); try { fs.unlinkSync(path.join(dir, nameOf(k))); } catch (e) { /* it was not there */ } },
  clear() { for (const k of [...cache.keys()]) this.removeItem(k); },
  key: (i) => [...cache.keys()][i] ?? null, get length() { return cache.size; },
};

// ---------------------------------------------------------------- files the game fetches: the same little hosts the C# build mapped
const HOSTS = { 'worlds.local': path.join(HOME, 'worlds'), 'wallpapers.local': path.join(HOME, 'wallpapers'), 'game.local': ROOT };
const _fetch = g.fetch;
g.fetch = async (url, o) => {
  const u = String(url), m = /^https?:\/\/([a-z.]+)\/(.*)$/.exec(u), base = m ? HOSTS[m[1]] : (!/^https?:/.test(u) ? ROOT : null);
  if (base == null) return _fetch(url, o);   // the outside world: the AI services
  const f = path.join(base, decodeURIComponent((m ? m[2] : u).split('?')[0]));
  let buf = null; try { buf = fs.readFileSync(f); } catch (e) { /* not there */ }
  return { ok: !!buf, status: buf ? 200 : 404, json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8'), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), blob: async () => new Blob([buf]) };
};

// ---------------------------------------------------------------- sound
if (process.env.UNHOLIUM_MUTE !== '1') {
  const A = require('node-web-audio-api'), WORK = require('url').pathToFileURL(path.join(__dirname, 'compressor_worklet.js')).href;
  // a compressor the browser's way: it passes sound through until its processor has loaded (a moment)
  const patch = (C) => { C.prototype.createDynamicsCompressor = function () {
    const c = this, i = c.createGain(), o = c.createGain(), pv = {}, D = { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 };
    for (const k in D) { pv[k] = D[k]; i[k] = { get value() { return pv[k]; }, set value(v) { pv[k] = v; if (i._node) i._node.port.postMessage({ [k]: v }); } }; }
    const inConnect = i.connect.bind(i), inDisconnect = i.disconnect.bind(i);
    i.connect = (d, ...r) => o.connect(d, ...r); i.disconnect = (...r) => o.disconnect(...r);
    inConnect(o);
    const ready = c._cw || (c._cw = c.audioWorklet.addModule(WORK));
    i._ready = ready.then(() => { const n = new A.AudioWorkletNode(c, 'unholium-compressor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', processorOptions: Object.assign({}, pv) }); i._node = n; inDisconnect(); inConnect(n); n.connect(o); });
    (c._cwAll = c._cwAll || []).push(i._ready); return i;
  }; };
  if (process.env.UNHOLIUM_NATIVECOMP !== '1') { patch(A.AudioContext); patch(A.OfflineAudioContext); } 
  // the compressor runs in JavaScript, and now and then its thread stalls for 10 to 20 ms (the garbage collector). A 50 ms buffer rides over that; the smallest buffer
  // the audio device offers does not, and every stall was heard as a chop.
  g.AudioContext = class extends A.AudioContext { constructor(o) { super(Object.assign({ latencyHint: 0.05 }, o)); } };
  g.OfflineAudioContext = A.OfflineAudioContext;
}

// ---------------------------------------------------------------- gamepads: SDL knows Xbox, PlayStation, Switch and many others; XInput is the fallback
let pads = () => [];
const sdlPads = () => {
  const koffi = require('koffi'), dll = [path.join(__dirname, 'SDL3.dll'), path.join(ROOT, 'tools', 'sdl', 'SDL3.dll')].find((f) => fs.existsSync(f)); if (!dll) throw new Error('no SDL3.dll');
  const S = koffi.load(dll), f = (d) => S.func(d), hint = f('bool SDL_SetHint(const char *, const char *)');
  hint('SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS', '1'); hint('SDL_WINDOWS_ENABLE_MESSAGELOOP', '0');   // (the window's messages belong to the window)
  if (!f('bool SDL_Init(uint32)')(0x2000)) throw new Error('SDL would not start');
  const update = f('void SDL_UpdateGamepads()'), list = f('uint32 * SDL_GetGamepads(_Out_ int *)'), free = f('void SDL_free(void *)'), open = f('void * SDL_OpenGamepad(uint32)'), alive = f('bool SDL_GamepadConnected(void *)'), axis = f('int16 SDL_GetGamepadAxis(void *, int)'), btn = f('bool SDL_GetGamepadButton(void *, int)'), type = f('int SDL_GetGamepadType(void *)'), rumble = f('bool SDL_RumbleGamepad(void *, uint16, uint16, uint32)'), close = f('void SDL_CloseGamepad(void *)');
  const MAP = [0, 1, 2, 3, 9, 10, -1, -2, 4, 6, 7, 8, 11, 12, 13, 14], BRAND = { 4: 'ps', 5: 'ps', 6: 'ps', 7: 'switch', 8: 'switch', 9: 'switch', 10: 'switch' };
  let cur = null, next = 0;
  g.__rumble = (l, r, ms) => { if (cur) rumble(cur, Math.round(l * 65535), Math.round(r * 65535), ms); };
  return () => {
    update();
    if (cur && !alive(cur)) { close(cur); cur = null; }
    if (!cur) { const now = performance.now(); if (now < next) return []; next = now + 1000; const n = [0], ids = list(n); if (ids && n[0] > 0) { const a = koffi.decode(ids, 'uint32', n[0]); cur = open(a[0]); } if (ids) free(ids); if (!cur) return []; }
    const lt = axis(cur, 4) / 32767, rt = axis(cur, 5) / 32767;
    return [{ connected: true, id: 'SDL', index: 0, mapping: 'standard', brand: BRAND[type(cur)] || 'xbox', axes: [axis(cur, 0) / 32767, axis(cur, 1) / 32767, axis(cur, 2) / 32767, axis(cur, 3) / 32767], buttons: MAP.map((m) => { const v = m === -1 ? lt : m === -2 ? rt : (btn(cur, m) ? 1 : 0); return { pressed: v > 0.12, value: v, touched: v > 0 }; }) }];
  };
};
try { pads = sdlPads(); } catch (e) { console.log('SDL gamepads unavailable:', e.message);
try {
  const koffi = require('koffi'), lib = koffi.load('xinput1_4.dll');
  koffi.struct('XGP', { wButtons: 'uint16', bLeft: 'uint8', bRight: 'uint8', lx: 'int16', ly: 'int16', rx: 'int16', ry: 'int16' });
  koffi.struct('XST', { packet: 'uint32', pad: 'XGP' });
  const get = lib.func('uint32 __stdcall XInputGetState(uint32, _Out_ XST *)'), s = {};
  koffi.struct('XVIB', { l: 'uint16', r: 'uint16' }); const vib = lib.func('uint32 __stdcall XInputSetState(uint32, XVIB *)'); let vibT = null;
  g.__rumble = (l, r, ms) => { if (!found) return; const i = found.i; vib(i, { l: Math.round(l * 65535), r: Math.round(r * 65535) }); clearTimeout(vibT); vibT = setTimeout(() => vib(i, { l: 0, r: 0 }), ms); };
  // standard order: A B X Y, LB RB, LT RT, back start, sticks, d-pad up down left right
  const MAP = [0x1000, 0x2000, 0x4000, 0x8000, 0x0100, 0x0200, -1, -2, 0x0020, 0x0010, 0x0040, 0x0080, 0x0001, 0x0002, 0x0004, 0x0008];
  let next = 0, found = null;
  pads = () => {
    const now = performance.now();
    if (!found && now < next) return [];   // (asking for a pad that is not plugged in is slow: not every frame)
    for (const i of found ? [found.i] : [0, 1, 2, 3]) {
      if (get(i, s) !== 0) { found = null; next = now + 1500; continue; }
      const b = s.pad.wButtons, btn = MAP.map((m) => { const v = m === -1 ? s.pad.bLeft / 255 : m === -2 ? s.pad.bRight / 255 : (b & m ? 1 : 0); return { pressed: v > 0.12, value: v, touched: v > 0 }; });
      found = { i, connected: true, id: 'XInput', index: i, mapping: 'standard', buttons: btn, axes: [s.pad.lx / 32767, -s.pad.ly / 32767, s.pad.rx / 32767, -s.pad.ry / 32767] };
      return [found];
    }
    if (!found) next = now + 1500;
    return [];
  };
} catch (e2) { console.log('no gamepad support:', e2.message); }
}
Object.defineProperty(g, 'navigator', { value: { getGamepads: () => pads(), userAgent: 'UnholiumNative', language: 'en', languages: ['en'], onLine: true }, configurable: true });

// ---------------------------------------------------------------- the host: what Host.cs did
const webview = hub();
const toPage = (data) => setImmediate(() => webview.dispatchEvent({ type: 'message', data }));
const handlers = {};   // prefix -> function (filled by window.js, net.js, ai.js)
webview.postMessage = (msg) => {
  msg = String(msg);
  if (msg === 'wallpapers:scan') { try { const d = HOSTS['wallpapers.local']; fs.mkdirSync(d, { recursive: true }); const images = fs.readdirSync(d).filter((f) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(f)).sort(); fs.writeFileSync(path.join(d, 'index.json'), JSON.stringify({ images })); } catch (e) { /* no pictures */ } toPage('wallpapers:ready'); return; }
  if (msg.startsWith('rumble:')) { const [, l, r, ms] = msg.split(':'); if (g.__rumble) g.__rumble(+l, +r, +ms); return; }
  if (msg.startsWith('lang:')) { try { fs.writeFileSync(path.join(DATA, 'lang.txt'), msg.slice(5)); } catch (e) { /* not important */ } return; }
  for (const p in handlers) if (msg === p || msg.startsWith(p)) { handlers[p](msg.slice(p.length)); return; }
};
if (process.env.UNHOLIUM_BROWSERLIKE !== '1') g.chrome = { webview };

// frames: whoever draws calls frame() once per display refresh
const rafs = []; let rafId = 0;
g.requestAnimationFrame = (f) => { rafs.push(f); return ++rafId; };
g.cancelAnimationFrame = noop;
const frame = (t = performance.now()) => { const l = rafs.splice(0); for (const f of l) f(t); };

// nothing dies quietly: what goes wrong is written down next to the saves
const crash = (e) => { try { fs.appendFileSync(path.join(DATA, 'errors.log'), `${new Date().toISOString()} ${(e && e.stack) || e}\n`); } catch (x) { /* nowhere to write */ } };
if (!process.env.UNHOLIUM_TESTING) { process.on('uncaughtException', (e) => { crash(e); console.error(e); }); process.on('unhandledRejection', (e) => { crash(e); console.error(e); }); }

// the game's files, in the order js\scripts.txt gives them
const scriptList = () => fs.readFileSync(path.join(ROOT, 'js', 'scripts.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const vm = require('vm');
const runFile = (f) => vm.runInThisContext(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''), { filename: f });
const loadGame = (opts = {}) => {
  for (const s of scriptList()) { if (s === 'js/main.js' && opts.beforeMain) opts.beforeMain(); runFile(path.join(ROOT, s)); }
  if (opts.test) runFile(path.join(ROOT, 'js', 'test.js'));
  fire(win, 'load');
};
module.exports = { crash, game, win, fire, frame, handlers, toPage, loadGame, runFile, scriptList, reloadStorage, ROOT, DATA, FontLibrary };
