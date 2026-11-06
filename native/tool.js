'use strict';
// Unholium Creation Tool, native. The window and the panels are built here by code; the tool's logic (editor\*.js) is what it always was.
process.env.UNHOLIUM_MUTE = '1';
const fs = require('fs'), path = require('path');
process.env.W = process.env.W || '1400'; process.env.H = process.env.H || '860';
const R = require('./runtime'), UI = require('./ui'), { Canvas } = UI, HOME = process.env.UNHOLIUM_HOME || R.ROOT, WORLDS = path.join(HOME, 'worlds');
const g = globalThis, HEADLESS = !!process.env.UNHOLIUM_TOOL_HEADLESS;
fs.mkdirSync(WORLDS, { recursive: true });
const { El } = UI, E_ = (tag, attrs = {}, ...kids) => { const e = new El(tag); for (const k in attrs) { if (k === 'data') Object.assign(e.dataset, attrs.data); else e[k] = attrs[k]; } e.append(...kids); return e; };
const btn = (cmd, label, title, cls) => E_('button', { title, className: cls || '', data: { cmd } }, label || '');
// the same panels, the same ids
const pick = (id) => E_('div', { id, className: 'palette' });
const root = UI.root = E_('div', { id: 'app' },
  E_('div', { id: 'titlebar' }, E_('span', { className: 'appicon' }), 'Unholium Creation Tool ', E_('span', { id: 'worldName' }, '· default world'), E_('span', { id: 'dirty' })),
  E_('div', { id: 'menubar' }),
  E_('div', { id: 'bar' },
    E_('div', { className: 'group' }, btn('new', 'New', 'New world (Ctrl+N)'), btn('open', 'Open', 'Open a saved world (Ctrl+O)'), btn('save', 'Save', 'Save (Ctrl+S)'), btn('saveAs', 'Save As', 'Save under a new name (Ctrl+Shift+S)')), E_('div', { className: 'sep' }),
    E_('div', { className: 'group' }, btn('undo', 'Undo', 'Undo (Ctrl+Z)'), btn('redo', 'Redo', 'Redo (Ctrl+Y)')), E_('div', { className: 'sep' }),
    E_('div', { className: 'group' }, btn('check', 'Check', 'Look for broken references'), btn('play', '▶ Play', 'Save and play this world in the game (F5)', 'accent'), btn('help', 'Help', 'Keys and tools'))),
  E_('div', { id: 'main' },
    E_('div', { id: 'left' }, E_('div', { className: 'caption' }, 'World Explorer'),
      E_('div', { className: 'tabs', id: 'tabs' }, ...[['maps', 'Maps'], ['npcs', 'NPCs'], ['items', 'Items'], ['world', 'World']].map(([t, l], i) => E_('button', { className: i ? '' : 'on', data: { tab: t } }, l))),
      E_('section', { className: 'pane', id: 'pane-maps' },
        E_('div', { className: 'row' }, E_('select', { id: 'mapSelect' }), E_('button', { id: 'newMap', title: 'A new, empty map' }, '+')), E_('div', { className: 'tools', id: 'tools' }),
        E_('div', { className: 'row small', id: 'brushRow' }, 'Brush ', E_('input', { type: 'range', id: 'brush', min: 1, max: 6, value: 1 }), E_('span', { id: 'brushVal' }, '1')),
        E_('input', { id: 'palSearch', placeholder: 'Search tiles and props…' }), E_('h3', {}, 'Tiles'), E_('div', { className: 'palette', id: 'tilePal' }), E_('h3', {}, 'Props'), E_('div', { className: 'palette decor', id: 'decorPal' })),
      E_('section', { className: 'pane hidden', id: 'pane-npcs' }, E_('div', { className: 'row' }, E_('input', { id: 'npcSearch', placeholder: 'Search people…' }), E_('button', { id: 'newNpc', title: 'A new person' }, '+')), E_('label', { className: 'small' }, E_('input', { type: 'checkbox', id: 'npcThisMap', checked: true }), ' Only this map'), E_('div', { className: 'list', id: 'npcList' })),
      E_('section', { className: 'pane hidden', id: 'pane-items' }, E_('div', { className: 'row' }, E_('input', { id: 'itemSearch', placeholder: 'Search items…' }), E_('button', { id: 'newItem', title: 'A new item' }, '+')), E_('div', { className: 'list', id: 'itemList' })),
      E_('section', { className: 'pane hidden', id: 'pane-world' }, E_('label', {}, 'Description', E_('textarea', { id: 'worldDesc', rows: 5, placeholder: 'What is this world?' })), E_('h3', {}, 'Map'), E_('div', { id: 'mapProps' }), E_('h3', {}, 'Show'), E_('div', { id: 'layers' }))),
    E_('section', { id: 'center' }, E_('div', { className: 'caption doc' }, 'Map View'), E_('div', { id: 'viewWrap' })),
    E_('div', { id: 'right' }, E_('div', { className: 'caption' }, 'Overview'), E_('div', { className: 'inner', id: 'miniBox' }), E_('div', { className: 'caption' }, 'Properties'), E_('div', { className: 'inner' }, E_('div', { id: 'inspector' }, E_('p', { className: 'dim' }, 'Select something on the map, or a person in the NPCs tab.'))))),
  E_('div', { id: 'statusbar' }, E_('div', { id: 'status' }), E_('div', { id: 'statusRight' })),
  E_('div', { id: 'modal', className: 'hidden' }, E_('div', { className: 'box' }, E_('div', { id: 'modalBody' }), E_('div', { className: 'row end' }, E_('button', { id: 'modalCancel' }, 'Cancel'), E_('button', { id: 'modalOk' }, 'OK')))),
  E_('div', { id: 'toast' }));
void pick;
// the document the tool talks to
const docHub = { _on: {} }, hub = (o) => { o.addEventListener = (t, f) => { (o._on[t] = o._on[t] || []).push(f); }; o.removeEventListener = (t, f) => { o._on[t] = (o._on[t] || []).filter((x) => x !== f); }; o.dispatchEvent = (e) => { for (const f of o._on[e.type] || []) f(e); return true; }; return o; };
hub(docHub); const winHub = hub({ _on: {} });
const makeEl = (t) => { if (String(t).toLowerCase() === 'canvas') { const c = new Canvas(300, 150); c.gpu = false; c.style = {}; c.toDataURL = () => `data:image/png;base64,${c.toBufferSync('png').toString('base64')}`; return c; } const e = new El(t); return e; };
const installDoc = () => {
  const d = g.document, keep = d.createElement;
  Object.assign(d, { createElement: (t) => { const e = makeEl(t); if (e._cls) UI.lastMade = e; return e; }, createTextNode: (s) => new UI.Text(String(s)), getElementById: (id) => UI.findId(id), querySelector: (s) => root.querySelector(s), querySelectorAll: (s) => root.querySelectorAll(s), addEventListener: docHub.addEventListener, removeEventListener: docHub.removeEventListener, dispatchEvent: docHub.dispatchEvent, body: root, documentElement: root, get activeElement() { return UI.focused || root; } });
  void keep; UI.document = docHub; UI.window = winHub;
  g.addEventListener = winHub.addEventListener; g.removeEventListener = winHub.removeEventListener; g.Event = function (t) { this.type = t; };
};
// the host side: what Editor.cs did. Dialogs for files are the operating system's
const safe = (n) => { n = String(n || '').trim() || 'My World'; return n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/\.+$/, ''); };
const writeIndex = () => { const names = fs.readdirSync(WORLDS, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(WORLDS, d.name, 'world.json'))).map((d) => d.name).sort(); fs.writeFileSync(path.join(WORLDS, 'index.json'), JSON.stringify({ worlds: names })); };
const writeWorld = (dir, files) => { const maps = path.join(dir, 'maps'); fs.mkdirSync(maps, { recursive: true }); const keep = new Set(); for (const rel of Object.keys(files)) { if (rel.includes('..') || path.isAbsolute(rel)) continue; const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, String(files[rel])); fs.renameSync(t, f); keep.add(path.resolve(f).toLowerCase()); } for (const f of fs.readdirSync(maps)) if (f.endsWith('.json') && !keep.has(path.resolve(maps, f).toLowerCase())) fs.unlinkSync(path.join(maps, f)); writeIndex(); };
const readWorld = (dir) => { const files = { 'world.json': fs.readFileSync(path.join(dir, 'world.json'), 'utf8') }, maps = path.join(dir, 'maps'); if (fs.existsSync(maps)) for (const f of fs.readdirSync(maps)) if (f.endsWith('.json')) files['maps/' + f] = fs.readFileSync(path.join(maps, f), 'utf8'); return files; };
// a list of the saved worlds and a name box, in the tool's own window
const pickWorld = (forSave, suggested) => new Promise((ok) => {
  const E = g.Editor, names = fs.existsSync(WORLDS) ? fs.readdirSync(WORLDS, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(WORLDS, d.name, 'world.json'))).map((d) => d.name).sort() : [];
  if (forSave) { E.modal('Save world as', [{ k: 'name', label: 'Name', v: suggested || 'My World' }], (v) => ok(safe(v.name))); const c = g.document.getElementById('modalCancel'), was = c.onclick; c.onclick = () => { c.onclick = was; E.closeModal(); ok(null); }; return; }
  if (!names.length) { E.toast('No saved worlds yet.'); ok(null); return; }
  E.modal('Open a world', [{ k: 'name', label: 'World', v: names[0], type: 'select', opts: names }], (v) => ok(v.name)); const c = g.document.getElementById('modalCancel'), was = c.onclick; c.onclick = () => { c.onclick = was; E.closeModal(); ok(null); };
});
const host = async (m) => {
  const r = { id: m.id };
  try {
    if (m.cmd === 'save') { const name = safe(m.name); writeWorld(path.join(WORLDS, name), m.files); r.ok = true; r.name = name; }
    else if (m.cmd === 'saveAs') { const name = await pickWorld(true, m.suggest || m.name); if (!name) r.ok = false; else { const dir = path.join(WORLDS, name); if (fs.existsSync(path.join(dir, 'world.json')) && !g.confirm(`A world called "${name}" is already here. Replace it?`)) r.ok = false; else { writeWorld(dir, m.files); r.ok = true; r.name = name; } } }
    else if (m.cmd === 'open') { const name = await pickWorld(false); if (!name) r.ok = false; else { r.ok = true; r.name = name; r.files = readWorld(path.join(WORLDS, name)); } }
    else if (m.cmd === 'play') { const exe = path.join(HOME, 'Unholium.exe'), name = safe(m.name); if (!fs.existsSync(exe) && !UI.playFn) { r.ok = false; r.error = 'Unholium.exe was not found next to the tool.'; } else { (UI.playFn || ((n) => require('child_process').spawn(exe, [`--world=${n}`], { detached: true, stdio: 'ignore', cwd: HOME }).unref()))(name); r.ok = true; } }
  } catch (e) { r.ok = false; r.error = e.message; }
  setImmediate(() => hostPort.dispatchEvent({ type: 'message', data: JSON.stringify(r) }));
};
const hostPort = hub({ _on: {} }); hostPort.postMessage = (s) => { if (String(s)[0] === "{") host(JSON.parse(s)); };   // (the game scripts talk here too: nobody is listening for those)
g.chrome = { webview: hostPort };
g.confirm = (t) => !!UI.confirmFn ? UI.confirmFn(t) : true;
g.prompt = (t, d) => (UI.promptFn ? UI.promptFn(t, d) : d);
g.alert = (t) => { if (g.Editor) g.Editor.toast(t); };
g.URL = g.URL || {};

g.__uiChanged = () => { UI.dirty = true; };
// start: the game's scripts, then the tool's
function boot(after) {
  installDoc();
  const lang = (() => { try { return fs.readFileSync(path.join(R.DATA, 'lang.txt'), 'utf8').trim(); } catch (e) { return '0'; } })();
  g.location.search = `?lang=${lang}`;
  const list = R.scriptList().filter((s) => !/main\.js|test\.js/.test(s));
  // the game's art scripts make their own canvases; those need nothing from the tree
  for (const s of list) R.runFile(path.join(R.ROOT, s));
  G.renderer.canvas = G.renderer.canvas || null; G.assets.init();
  const ed = path.join(R.ROOT, 'editor');
  R.runFile(path.join(ed, 'i18n_tool.js'));
  for (const f of ['editor.js', 'editor_more.js', 'editor_hd.js', 'editor_real.js']) R.runFile(path.join(ed, f));
  // the two canvases the map is drawn on
  const view = new Canvas(800, 600); view.gpu = !HEADLESS && process.env.UNHOLIUM_CPU !== '1'; view.id = 'view'; view.style = {}; UI.findId('viewWrap').appendChild(view); view.parentNode = UI.findId('viewWrap');
  const mini = new Canvas(220, 160); mini.gpu = false; mini.id = 'mini'; mini.style = {}; UI.findId('miniBox').appendChild(mini);
  g.Editor.start('');
  after();
}
module.exports = { boot, UI, R, WORLDS, root };
if (!HEADLESS) {
  const { Window, App } = require('skia-canvas');
  const w = new Window(+process.env.W, +process.env.H, { title: 'Unholium Creation Tool', background: '#cfcabd', resizable: true }), screen = new Canvas(+process.env.W, +process.env.H); screen.gpu = process.env.UNHOLIUM_CPU !== '1';
  w.canvas = screen; w.fit = 'none'; App.fps = 60; UI.W = screen.width; UI.H = screen.height; const x = screen.getContext('2d');
  const num = (e) => ({ button: e.button, buttons: e.buttons, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey });
  w.on('mousemove', (e) => UI.mousemove(e.x, e.y, num(e))); w.on('mousedown', (e) => UI.mousedown(e.x, e.y, num(e))); w.on('mouseup', (e) => UI.mouseup(e.x, e.y, num(e))); w.on('wheel', (e) => UI.wheel(UI.mouse.x, UI.mouse.y, -Math.sign(e.deltaY)));
  const fix = (e) => ({ code: /^Arrow/.test(e.key) ? e.key : e.code, key: e.key === 'Space' ? ' ' : e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, repeat: e.repeat, preventDefault() {} });
  w.on('keydown', (e) => { e.preventDefault(); UI.keydown(fix(e)); }); w.on('keyup', (e) => winHub.dispatchEvent(Object.assign({ type: 'keyup' }, fix(e))));
  w.on('resize', (e) => { const W = Math.round(e.width), H = Math.round(e.height); screen.width = W; screen.height = H; UI.W = W; UI.H = H; UI.dirty = true; });
  let leaving = false; const leave = () => { if (leaving) return; leaving = true; setImmediate(() => { try { w.close(); } catch (e) { /* gone */ } try { App.quit(); } catch (e) { /* stopping */ } setTimeout(() => process.exit(0), 250); }); };
  w.on('close', leave);
  const shot = +process.env.UNHOLIUM_SHOT_FRAME || 0; let n = 0;
  w.on('frame', () => { R.frame(); UI.paint(x); if (shot && ++n === shot) { fs.writeFileSync(path.join(__dirname, 'shot.png'), screen.toBufferSync('png')); leave(); } });
  boot(() => {}); App.launch();
}
