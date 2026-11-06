'use strict';
// Unholium, native: a window, the game, nothing else.
const R = require('./runtime'), { Window, App } = require('skia-canvas'), { game, win, fire, frame, handlers } = R;
const w = new Window(game.width, game.height, { title: 'Unholium', canvas: game, background: '#000000', resizable: true });
w.fit = 'fill'; App.fps = 60; w.cursor = 'none';
let cursor = 'default';
// the game's own cursor: the browser showed it for us; it is drawn with the frame now
const { Image } = require('skia-canvas'), cur = { img: null, hx: 0, hy: 0, over: true }, seen = new Map();
Object.defineProperty(game.style, 'cursor', { get: () => cursor, set(v) { cursor = v; const q = /url\((.*?)\)\s+(\d+)\s+(\d+)/.exec(v || ''); if (!q) { cur.img = null; return; } let i = seen.get(q[1]); if (!i) { i = new Image(); i.src = q[1]; seen.set(q[1], i); } cur.img = i; cur.hx = +q[2]; cur.hy = +q[3]; } });
w.on('mouseleave', () => { cur.over = false; }); w.on('mouseenter', () => { cur.over = true; });
const drawCursor = () => { const P = globalThis.G && G.pad, m = globalThis.G && G.input.mouse; if (!m || !cur.img || !cur.img.complete || !cur.over) return; if (P && P.device === 'pad' && !P.ptr) return; const x = game.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.imageSmoothingEnabled = false; x.drawImage(cur.img, Math.round(m.x - cur.hx), Math.round(m.y - cur.hy)); x.restore(); };
const size = (W, H) => { globalThis.innerWidth = Math.round(W); globalThis.innerHeight = Math.round(H); fire(win, 'resize'); };
if (process.env.UNHOLIUM_KEYLOG) { const L = [], log = (k) => { L.push(k); require('fs').writeFileSync(process.env.UNHOLIUM_KEYLOG, L.join('\n')); }; w.on('keydown', (e) => log('key ' + e.code + ' ' + JSON.stringify(e.key))); w.on('mousedown', (e) => log('down ' + e.button + ' ' + Math.round(e.x) + ',' + Math.round(e.y))); w.on('wheel', (e) => log('wheel ' + e.deltaY)); }
// keys and the mouse, as the browser reported them
const keyOf = (e) => (e.key === 'Space' ? ' ' : e.key), codeOf = (e) => (/^Arrow/.test(e.key) ? e.key : e.code);   // (as the browser names them)
w.on('keydown', (e) => { e.preventDefault(); fire(win, 'keydown', { code: codeOf(e), key: keyOf(e), repeat: e.repeat, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey, metaKey: e.metaKey }); });
w.on('keyup', (e) => fire(win, 'keyup', { code: codeOf(e), key: keyOf(e) }));
const mouse = (t, e) => ({ clientX: e.x, clientY: e.y, button: e.button, buttons: e.buttons, type: t });
w.on('mousemove', (e) => fire(game, 'mousemove', mouse('mousemove', e)));
w.on('mousedown', (e) => fire(game, 'mousedown', mouse('mousedown', e)));
w.on('mouseup', (e) => fire(win, 'mouseup', mouse('mouseup', e)));
w.on('wheel', (e) => fire(game, 'wheel', { deltaY: -e.deltaY }));
w.on('blur', () => fire(win, 'blur'));
w.on('resize', (e) => size(e.width, e.height));
// leaving: the window goes first, outside any event, so the GPU has finished before the process does
let leaving = false;
const leave = () => { if (leaving) return; leaving = true; setImmediate(() => { try { w.close(); } catch (e) { /* already gone */ } try { App.quit(); } catch (e) { /* already stopping */ } setTimeout(() => process.exit(0), 250); }); };
w.on('close', leave);
// brightness and saturation: the browser did these on the finished picture; so do we
let look = '', x2 = null;
Object.defineProperty(game.style, 'filter', { get: () => look, set(v) { look = v || ''; } });
w.on('frame', () => { frame(); if (look) { const x = x2 || (x2 = game.getContext('2d')); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = look; x.drawImage(game, 0, 0); x.restore(); } drawCursor(); });
const Net = require('./net'), Ai = require('./ai'), net = new Net(R.toPage), ai = new Ai(R.toPage, R.DATA);
handlers['net:'] = (c) => net.command(c);
handlers['ai:'] = (c) => ai.command(c);
handlers.quit = leave;
// a click in a dialogue, written down: what the game saw (dataicks.log, the last few only)
{ let n = 0; handlers['log:'] = (v) => { if (n++ < 60) try { require('fs').appendFileSync(require('path').join(R.DATA, 'clicks.log'), new Date().toISOString() + ' ' + v + String.fromCharCode(10)); } catch (e) { /* only a note */ } }; }
// Full screen is a borderless window over the whole monitor. The window library's own full screen cannot stay: Esc belongs to the game (the pause menu),
// and the library always takes it as "leave full screen", whatever the handler says.
let wantFull = false, before = null, user32 = null, pending = false;
const api = () => {
  if (user32) return user32;
  const koffi = require('koffi'), u = koffi.load('user32.dll'), RECT = koffi.struct('UH_RECT', { left: 'int', top: 'int', right: 'int', bottom: 'int' }), INFO = koffi.struct('UH_MON', { size: 'uint32', mon: RECT, work: RECT, flags: 'uint32' }), f = (n, r, a) => u.func('__stdcall', n, r, a);
  return (user32 = { find: f('FindWindowExW', 'void *', ['void *', 'void *', 'void *', 'str16']), pid: f('GetWindowThreadProcessId', 'uint32', ['void *', koffi.out(koffi.pointer('uint32'))]), rect: f('GetWindowRect', 'bool', ['void *', koffi.out(koffi.pointer(RECT))]), getStyle: f('GetWindowLongPtrW', 'int64', ['void *', 'int']), setStyle: f('SetWindowLongPtrW', 'int64', ['void *', 'int', 'int64']), place: f('SetWindowPos', 'bool', ['void *', 'void *', 'int', 'int', 'int', 'int', 'uint32']), monitor: f('MonitorFromWindow', 'void *', ['void *', 'uint32']), info: f('GetMonitorInfoW', 'bool', ['void *', koffi.inout(koffi.pointer(INFO))]) });
};
const applyFull = () => {
  const U = api(), pid = [0]; let h = null;
  do { h = U.find(null, h, null, 'Unholium'); if (h) U.pid(h, pid); } while (h && pid[0] !== process.pid);
  if (!h) return false;
  if (wantFull && !before) {
    const r = {}, style = U.getStyle(h, -16), m = { size: 40, mon: {}, work: {}, flags: 0 }; U.rect(h, r); before = { style, r };
    U.setStyle(h, -16, Number(style) & ~0x00CF0000); U.info(U.monitor(h, 2), m);
    U.place(h, null, m.mon.left, m.mon.top, m.mon.right - m.mon.left, m.mon.bottom - m.mon.top, 0x0224);
  } else if (!wantFull && before) { const { style, r } = before; before = null; U.setStyle(h, -16, Number(style)); U.place(h, null, r.left, r.top, r.right - r.left, r.bottom - r.top, 0x0224); }
  return true;
};
handlers['fullscreen:'] = (v) => { wantFull = v === '1'; try { pending = !applyFull(); } catch (e) { R.crash(e); } };
w.on('frame', () => { if (pending) { try { pending = !applyFull(); } catch (e) { pending = false; R.crash(e); } } });
if (process.env.UNHOLIUM_SHOT) { const n = +process.env.UNHOLIUM_SHOT_FRAME || 240; let c = 0; w.on('frame', () => { if (c === n - 3 && process.env.UNHOLIUM_SHOT_MOUSE) { const [a, b] = process.env.UNHOLIUM_SHOT_MOUSE.split(',').map(Number); G.input.mouse.x = a; G.input.mouse.y = b; } if (++c === n) { require('fs').writeFileSync('D:/Unholium_native/native/shot.png', game.toBufferSync('png')); leave(); } }); }
// the first time: bring over the saves of the old build, from a copy of them
// the game reports its own errors through G.reportError: those go to the same log
(async () => {
  try { const old = require('path').join(process.env.LOCALAPPDATA || '', 'Unholium', 'EBWebView', 'Default', 'Local Storage', 'leveldb'), r = await require('./migrate').importSaves(old, R.DATA); if (r.imported) R.reloadStorage(); } catch (e) { console.log('saves not imported:', e.message); }
  R.loadGame();
  { const rep = G.reportError; G.reportError = function (e) { R.crash(e); return rep && rep.apply(this, arguments); }; }
  App.launch();
})();
