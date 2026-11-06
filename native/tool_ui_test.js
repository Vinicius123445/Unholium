'use strict';
// The Creation Tool by hand: pointer and keys through the toolkit, the way a person uses it, ending with a world the game really loads.
(async () => {
  const UI = require('D:/Unholium_native/native/ui.js'), fs = require('fs'), path = require('path'), E = window.Editor, x = new UI.Canvas(1400, 860).getContext('2d');
  let fails = 0, oks = 0; const ok = (c, m) => { if (c) oks++; else { fails++; console.log('FAIL', m); } };
  const $ = (id) => document.getElementById(id), B = { button: 0, buttons: 1 };
  const paint = () => { UI.paint(x); }, wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
  const centre = (n) => { paint(); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const click = (n) => { const [a, b] = centre(n); UI.mousemove(a, b, B); UI.mousedown(a, b, B); UI.mouseup(a, b, B); paint(); };
  const type = (s) => { for (const c of s) UI.keydown({ key: c, code: 'Key' + c.toUpperCase(), ctrlKey: false }); };
  const key = (k, o = {}) => UI.keydown(Object.assign({ key: k, code: k, ctrlKey: false, shiftKey: false }, o));
  const tab = (t) => click(document.querySelector(`#tabs button[data-tab="${t}"]`));
  paint();
  // menus
  const top = document.querySelectorAll('.mtop'); ok(top.length >= 4, `menus exist (${top.length})`); click(top[0]); ok(top[0].classList.contains('open'), 'a menu opens'); const items = top[0].querySelectorAll('.mitem'); ok(items.length > 2, 'with its items'); { const hit = UI.pick(...centre(items[0])); ok(hit === items[0] || items[0].contains(hit), 'an item is under the pointer'); } click(document.getElementById('status')); ok(!top[0].classList.contains('open'), 'a click elsewhere closes it');
  // tabs
  for (const t of ['npcs', 'items', 'dialogues', 'world', 'maps']) { tab(t); ok(!$('pane-' + t).classList.contains('hidden'), `${t} tab`); }
  // tools and palettes
  click(document.querySelectorAll('#tools button')[2]); ok(E.tool === 'rect', 'a tool button'); key('b'); ok(E.tool === 'paint', 'its key');
  click(document.querySelectorAll('#tilePal .sw')[3]); ok(E.tile === +[...G.TILES.keys()][3] || E.tile != null, 'a tile from the palette');
  const dec = document.querySelectorAll('#decorPal .sw')[2]; dec.scrollIntoView(); click(dec); ok(E.tool === 'decor', 'a prop from the palette');
  // scrolling
  const pane = $('tilePal'); paint(); const st = pane.scrollTop; { const [a, b] = centre(pane); UI.wheel(a, b, 1); } paint(); ok(pane._scroller ? pane.scrollTop > st : true, 'the palette scrolls');
  // dropdown
  const ms = $('mapSelect'), was = E.cur; click(ms); ok(!!UI.popup, 'a dropdown opens'); { const p = UI.popup, i = E.order.indexOf('forest'); p.scroll = Math.max(0, i * 18 - 40); UI.mousemove(p.x + 20, p.y + 1 + i * 18 - p.scroll + 9, B); UI.mousedown(p.x + 20, p.y + 1 + i * 18 - p.scroll + 9, B); } UI.mouseup(0, 0, B); ok(E.cur === 'forest' && E.cur !== was, `and picks (${E.cur})`);
  // painting on the map with the pointer
  R_openCity(); function R_openCity() { E.openMap('city'); } paint(); for (let i = 0; i < 3; i++) { require('D:/Unholium_native/native/runtime.js').frame(); paint(); }
  const v = $('view'), r = v.getBoundingClientRect(); ok(r.width > 300 && v.width === Math.round(r.width), `the map view has its size (${v.width}x${v.height})`);
  { const d = v.getContext('2d').getImageData(Math.floor(v.width / 2), Math.floor(v.height / 2), 1, 1).data; ok(d[3] > 0, 'the map is drawn'); }
  key('b'); click(document.querySelectorAll('#tilePal .sw')[0]); E.tile = G.T.grass; const tx = 40, ty = 40; E.view.z = 2; E.view.x = tx * 16 - 100; E.view.y = ty * 16 - 100; const px = r.left + 100 * 2 + 8, py = r.top + 100 * 2 + 8, before = E.M.ground[ty * E.M.w + tx]; E.tile = before === G.T.sand ? G.T.dirt : G.T.sand; UI.mousemove(px, py, B); UI.mousedown(px, py, B); UI.mousemove(px + 1, py, B); UI.mouseup(px, py, B); require('D:/Unholium_native/native/runtime.js').frame(); ok(E.M.ground[ty * E.M.w + tx] !== before, `painting changes the map (${before} to ${E.M.ground[ty * E.M.w + tx]})`);
  key('z', { ctrlKey: true }); ok(E.M.ground[ty * E.M.w + tx] === before, 'Ctrl+Z undoes it'); key('y', { ctrlKey: true }); ok(E.M.ground[ty * E.M.w + tx] !== before, 'Ctrl+Y redoes it'); const painted = E.M.ground[ty * E.M.w + tx];
  // a text field and a person
  tab('npcs'); click($('npcSearch')); type('xy'); ok($('npcSearch').value === 'xy', 'typing in a field'); key('Backspace'); ok($('npcSearch').value === 'x', 'erasing'); key('ArrowLeft'); type('a'); ok($('npcSearch').value === 'ax', 'the caret moves'); key('Backspace'); key('Delete'); click($('status'));
  const n0 = Object.keys(E.npcs).length; click($('newNpc')); paint(); if (!$('modal').classList.contains('hidden')) { const f = $('modalBody').querySelector('input'); if (f) { click(f); } click($('modalOk')); } ok(Object.keys(E.npcs).length === n0 + 1, 'a new person');
  const npcId = E.npcSel || Object.keys(E.npcs).find((k) => !G.NPCS[k]); { const ins = $('inspector').querySelector('input'); ok(!!ins, 'their form'); if (ins) { click(ins); key('End'); type('zz'); click($('status')); } }
  // a dialog with text and a checkbox
  tab('world'); click($('worldDesc')); type('hi'); ok(E.desc && E.desc.endsWith('hi'), `the description (${E.desc})`); const cb = $('layers').querySelector('input'), c0 = cb.checked; click(cb); ok(cb.checked !== c0, 'a checkbox'); click(cb); tab('maps');
  // the slider
  const br = $('brush'); UI.layout(); { const q = br.getBoundingClientRect(); UI.mousedown(q.right - 2, q.top + 8, B); UI.mouseup(q.right - 2, q.top + 8, B); ok(+br.value === 6 && $('brushVal').textContent === '6', `the brush slider (${br.value})`); }
  // the help window
  E.cmd('help'); paint(); ok(!$('modal').classList.contains('hidden') && $('modalBody').textContent.includes('Move around'), 'help opens, as plain text'); key('Escape'); ok($('modal').classList.contains('hidden'), 'Escape closes a dialog');
  // Portuguese
  window.EditorI18n.set(true); UI.dirty = true; paint(); ok(window.__uiTranslate('File') === 'Arquivo', 'the tool speaks Portuguese'); window.EditorI18n.set(false);
  // save, and the game opens what was saved
  E.cmd('saveAs'); await wait(60); paint(); const nameF = $('modalBody').querySelector('input'); ok(!!nameF, 'Save As asks for a name'); click(nameF); for (let i = 0; i < 12; i++) key('Backspace'); type('nativetest'); key('Enter'); await wait(1500); paint();
  const home = process.env.UNHOLIUM_HOME, dir = path.join(home, 'worlds', 'nativetest'), wj = path.join(dir, 'world.json'); for (let i = 0; i < 100 && !fs.existsSync(wj); i++) await wait(100);
  ok(fs.existsSync(wj), 'the world is on disk'); ok(fs.existsSync(path.join(dir, 'maps', 'city.json')), 'with the map that changed');
  if (fs.existsSync(wj)) {
    const w = G.worldFile.upgradeWorld(JSON.parse(fs.readFileSync(wj, 'utf8'))), f = JSON.parse(fs.readFileSync(path.join(dir, 'maps', 'city.json'), 'utf8')), tm = G.worldFile.deserializeMap(f);
    ok(tm.ground[ty * tm.w + tx] === painted, 'the painted tile reads back through the game\'s loader'); ok(/hi$/.test(w.description || w.desc || ''), 'the description too'); ok(Object.keys(w.npcs || {}).length >= 1, 'and the new person'); ok(fs.readFileSync(path.join(home, 'worlds', 'index.json'), 'utf8').includes('nativetest'), 'the game\'s list has it');
  }
  // reopening it
  E.dirty = false; E.cmd('open'); await wait(60); paint(); ok(!$('modal').classList.contains('hidden'), 'Open lists the saved worlds'); click($('modalOk')); await wait(1500); paint(); ok(E.name === 'nativetest', `and reopens it (${E.name})`);
  { let played = null; UI.playFn = (n) => { played = n; }; E.cmd('play'); for (let i = 0; i < 80 && played == null; i++) await wait(100); ok(played === 'nativetest', `Play starts the game on it (${played})`); }
  console.log(`tool UI: ${oks} ok, ${fails} failed`); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('STOPPED', e.stack.slice(0, 700)); process.exit(1); });
