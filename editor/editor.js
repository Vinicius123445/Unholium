'use strict';
// World Editor: edit every map, building, prop, point, exit, NPC and item of the game, and save the result
// as a world folder (worlds/<name>/world.json + maps/<id>.json) the game can play (New Game > world).
// Runs inside Unholium Creation Tool.exe (desktop/Editor.cs), which provides the Save/Open dialogs and Play.
(() => {
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'on') for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (k === 'style') e.style.cssText = attrs[k]; else if (k in e && k !== 'list') e[k] = attrs[k]; else e.setAttribute(k, attrs[k]); } for (const c of kids) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const WF = G.worldFile, A = G.assets;
const host = window.chrome && window.chrome.webview ? window.chrome.webview : null;
const pending = {};
let reqId = 0;
const ask = (cmd, o = {}) => new Promise((ok) => { const id = ++reqId; pending[id] = ok; host.postMessage(JSON.stringify(Object.assign({ cmd, id }, o))); });
if (host) host.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });

const TOOLS = [
  ['select', 'Select', 'V'], ['paint', 'Paint', 'B'], ['rect', 'Rect', 'R'], ['fill', 'Fill', 'G'],
  ['pick', 'Pick', 'I'], ['decor', 'Prop', 'P'], ['erase', 'Erase', 'E'], ['building', 'Building', 'H'],
  ['point', 'Point', 'T'], ['exit', 'Exit', 'X'], ['npc', 'Place NPC', 'N'], ['chest', 'Container', 'C'],
];
const ACTS = ['idle', 'wander', 'sleep', 'work', 'patrol'];
const COMBAT = ['flee', 'fight', 'guard'];
const ROOFS = Object.keys(G.ROOF_COLORS || { red: 1 });
const KINDS = ['house', 'shop', 'inn', 'office', 'mansion', 'temple', 'tower', 'barn', 'garage', 'barracks', 'manor', 'camp'];
const WALLS = G.TILES.filter((t) => t.wall || /^wall_|citywall/.test(t.name)).map((t) => t.name);
const FLOORS = ['woodfloor', 'stonefloor', 'carpet', 'tilefloor', 'concrete', 'darkstone'].filter((n) => G.T[n] != null);
const LOOKS = {
  body: ['m', 'f'], top: (G.assets.TOP_STYLES || ['shirt', 'tshirt', 'longsleeve', 'tank', 'tunic', 'jacket', 'hoodie', 'vest', 'dress', 'robe']).slice(), bottom: ['pants', 'shorts', 'skirt'],
  hat: ['', 'hood', 'cowl', 'helmet', 'hardhat', 'straw', 'cap', 'beanie', 'bucket', 'fedora', 'crown', 'bandana', 'kippah', 'blackhat', 'tophat'], glasses: ['', 'sun', 'round'],
  mask: ['', 'white', 'gold', 'black', 'red', 'silver', 'surgical', 'bandana', 'hockey', 'gas', 'balaclava'],
};

const E = window.Editor = {
  base: '', name: null, dirty: false, maps: {}, order: [], cur: null, npcs: {}, items: {}, deletedNpcs: [], desc: '',
  view: { x: 0, y: 0, z: 2 }, tool: 'paint', tile: G.T.grass, decor: 'oak0', brush: 1, sel: null, npcSel: null, hover: null,
  undo: [], redo: [], show: { buildings: true, points: true, exits: true, npcs: true, chests: true, grid: false, roofs: false },

  // ------------------------------------------------------------ the world in memory
  start(base) {
    this.base = base;
    this.reset();
    this.ui();
    this.loop();
    this.toast(host ? 'Ready. Your worlds are saved in the game\'s worlds folder.' : 'Ready (no desktop host: Save downloads files).');
  },
  reset() {
    this.maps = {}; this.order = Object.keys(G.MAPGEN); this.npcs = WF.serializeNPCs(); this.items = {}; this.deletedNpcs = []; this.desc = '';
    this.name = null; this.undo = []; this.redo = []; this.sel = null; this.npcSel = null; this.setDirty(false);
    this.openMap(this.order.includes('rural') ? 'rural' : this.order[0]);
  },
  model(id) {
    if (this.maps[id]) return this.maps[id];
    const data = WF.serializeMap(G.planMap(G.MAPGEN[id]));   // (a map as the game lays it out, at its real size)
    return (this.maps[id] = this.fromFile(data));
  },
  fromFile(data) {
    if (!data.scaled) data = WF.serializeMap(WF.deserializeMap(data));   // a world saved before the world doubled
    const tmap = (data.tiles || []).map((n) => (G.T[n] != null ? G.T[n] : 1));
    const ground = new Uint8Array(data.w * data.h); let i = 0;
    for (const part of data.ground.split(';')) { const [t, n] = part.split(',').map(Number); ground.fill(tmap[t] != null ? tmap[t] : 1, i, i + n); i += n; }
    const m = Object.assign({}, data); delete m.tiles; delete m.format;
    m.missing = [...new Set((data.decor || []).filter((d) => !G.DECOR[d[0]]).map((d) => d[0]))];
    m.ground = ground; m.decor = (data.decor || []).filter((d) => G.DECOR[d[0]]).map((d) => ({ type: d[0], tx: d[1], ty: d[2], extra: d[3] || null }));
    for (const k of ['buildings', 'points', 'exits', 'chests', 'animalZones', 'dangerZones', 'signs', 'meta']) if (m[k] == null) m[k] = k === 'points' || k === 'signs' || k === 'meta' ? {} : [];
    m.canvas = null;
    return m;
  },
  toFile(m) {
    const out = {};
    for (const k of Object.keys(m)) if (!['ground', 'decor', 'canvas', '_tm', 'missing'].includes(k)) out[k] = m[k];
    const data = clone(out);
    data.tiles = G.TILES.map((t) => t.name);
    const g = m.ground, parts = []; let prev = g[0], n = 0;
    for (let i = 0; i < g.length; i++) { if (g[i] === prev) n++; else { parts.push(prev + ',' + n); prev = g[i]; n = 1; } }
    parts.push(prev + ',' + n);
    data.ground = parts.join(';');
    data.decor = m.decor.map((d) => (d.extra && Object.keys(d.extra).length ? [d.type, d.tx, d.ty, d.extra] : [d.type, d.tx, d.ty]));
    data.format = 2; data.scaled = true;
    return data;
  },
  get M() { return this.maps[this.cur]; },
  setDirty(v) { this.dirty = v; $('dirty') && ($('dirty').textContent = v ? ' • unsaved' : ''); },
  openMap(id) {
    this.cur = id; const m = this.model(id);
    this.sel = null;
    if (!m.canvas) this.renderGround(m);
    const c = $('view');
    this.view.z = 2; this.view.x = m.w * 8 - (c ? c.clientWidth / 4 : 300); this.view.y = m.h * 8 - (c ? c.clientHeight / 4 : 200);
    if ($('mapSelect')) { $('mapSelect').value = id; this.refreshMapProps(); this.refreshNpcList(); this.inspect(); }
  },

  // ------------------------------------------------------------ undo
  snap() { this.undo.push({ map: this.cur, data: JSON.stringify(this.toFile(this.M)), npcs: JSON.stringify(this.npcs), items: JSON.stringify(this.items) }); if (this.undo.length > 60) this.undo.shift(); this.redo = []; this.setDirty(true); },
  restore(s) { const m = this.fromFile(JSON.parse(s.data)); this.maps[s.map] = m; this.npcs = JSON.parse(s.npcs); this.items = JSON.parse(s.items); if (s.map !== this.cur) this.cur = s.map; this.renderGround(m); this.sel = null; this.inspect(); this.refreshNpcList(); this.refreshItems(); },
  doUndo() { const s = this.undo.pop(); if (!s) return; this.redo.push({ map: s.map, data: JSON.stringify(this.toFile(this.maps[s.map])), npcs: JSON.stringify(this.npcs), items: JSON.stringify(this.items) }); this.restore(s); this.setDirty(true); },
  doRedo() { const s = this.redo.pop(); if (!s) return; this.undo.push({ map: s.map, data: JSON.stringify(this.toFile(this.maps[s.map])), npcs: JSON.stringify(this.npcs), items: JSON.stringify(this.items) }); this.restore(s); this.setDirty(true); },

  // ------------------------------------------------------------ drawing
  tileImg(t, tx, ty) {
    const def = G.TILES[t]; if (!def) return null;
    return def.tex ? A.tile(def.tex, def.anim ? 0 : G.util.hash2(tx, ty, 7)) : null;
  },
  drawTile(m, tx, ty) {
    const x = m.canvas.getContext('2d'), t = m.ground[ty * m.w + tx], def = G.TILES[t];
    x.fillStyle = '#000'; x.fillRect(tx * 16, ty * 16, 16, 16);
    if (def && def.over) x.drawImage(A.tile(def.over, G.util.hash2(tx, ty, 7)), tx * 16, ty * 16);
    const img = this.tileImg(t, tx, ty); if (img) x.drawImage(img, tx * 16, ty * 16);
  },
  renderGround(m) {
    m.canvas = document.createElement('canvas'); m.canvas.width = m.w * 16; m.canvas.height = m.h * 16;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) this.drawTile(m, tx, ty);
    this.renderMini();
  },
  renderMini() {
    const m = this.M, c = $('mini'); if (!c || !m) return;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / m.w, c.height / m.h); this.miniS = s;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { const d = G.TILES[m.ground[ty * m.w + tx]]; x.fillStyle = (d && d.mini) || '#333'; x.fillRect(tx * s, ty * s, Math.ceil(s), Math.ceil(s)); }
    x.strokeStyle = '#d8b468'; for (const b of m.buildings) x.strokeRect(b.x * s, b.y * s, b.w * s, b.h * s);
  },
  decorPos(d) { const e = d.extra || {}, fw = e.wide ? 2 : G.DECOR[d.type].fw || 1; return { x: d.tx * 16 + fw * 8 + (e.ox || 0), y: d.ty * 16 + 15 + (e.oy || 0) }; },
  npcSpot(id) {
    const d = this.npcs[id], m = this.M; if (!d || d.map !== this.cur) return null;
    const pt = (at) => { if (!at) return null; if (typeof at === 'object' && !Array.isArray(at)) return at; const p = m.points[at]; return Array.isArray(p) ? p[0] : p; };
    const e = (d.schedule || []).find((s) => G.util.hourInRange(12, s.from, s.to)) || (d.schedule || [])[0];
    return pt(e && e.at) || (d.home && m.points[d.home + '_in']) || null;
  },
  draw() {
    const c = $('view'), m = this.M; if (!m) return;
    if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight; }
    const x = c.getContext('2d'), v = this.view, z = v.z;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#050407'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    x.setTransform(z, 0, 0, z, -v.x * z, -v.y * z);
    this.drawGround(x, m, c);
    const vx0 = v.x - 64, vy0 = v.y - 64, vx1 = v.x + c.width / z + 64, vy1 = v.y + c.height / z + 96;
    // flat props, then the rest sorted by depth
    const list = [];
    for (const d of m.decor) { const p = this.decorPos(d); if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue; list.push({ d, p, flat: !!G.DECOR[d.type].flat }); }
    for (const o of list.filter((o) => o.flat)) this.drawDecor(x, o);
    if (this.show.chests) for (const ch of m.chests) { const s = A.sprites['st_' + (ch.style || 'stash')] || A.sprites.chest; if (s) x.drawImage(s.img, ch.tx * 16 + 8 - s.ax, ch.ty * 16 + 14 - s.ay); }
    const rest = list.filter((o) => !o.flat);
    if (this.show.npcs) for (const id in this.npcs) { const p = this.npcSpot(id); if (p) rest.push({ npc: id, p: { x: p.x * 16 + 8, y: p.y * 16 + 12 } }); }
    if (m._tm && !this.show.roofs) for (const r of G.realWalls.runs(m._tm, { x: v.x, y: v.y, w: c.width / z, h: c.height / z }, null)) { r.a = 1; rest.push({ run: r, p: { y: r.key } }); }   // (inside walls, at the game's height)
    rest.sort((a, b) => a.p.y - b.p.y);
    for (const o of rest) {
      if (o.npc) {
        this.drawPerson(x, this.npcs[o.npc].look, o.p.x, o.p.y);
        if (z >= 1.5) { x.font = '5px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(this.npcs[o.npc].name, o.p.x + 0.4, o.p.y + 6.4); x.fillStyle = this.npcSel === o.npc ? '#ffd860' : '#e8e0d0'; x.fillText(this.npcs[o.npc].name, o.p.x, o.p.y + 6); }
      } else if (o.run) G.realWalls.draw(x, m._tm, o.run);
      else this.drawDecor(x, o);
    }
    x.lineWidth = 1 / z;
    if (this.show.roofs) this.drawRoofs(x, m, c);
    if (this.show.buildings) for (const b of m.buildings) {
      x.strokeStyle = this.sel && this.sel.b === b ? '#ffd860' : 'rgba(216,180,104,0.8)'; x.strokeRect(b.x * 16, b.y * 16, b.w * 16, b.h * 16);
      x.fillStyle = 'rgba(255,220,120,0.5)'; x.fillRect(b.doorX * 16 + 4, b.doorY * 16 + 4, 8, 8);
      if (z >= 1) { x.font = 'bold 7px sans-serif'; x.textAlign = 'left'; x.fillStyle = '#000'; x.fillText(b.name, b.x * 16 + 3.5, b.y * 16 + 9.5); x.fillStyle = '#ffe8b0'; x.fillText(b.name, b.x * 16 + 3, b.y * 16 + 9); }
    }
    if (this.show.exits) for (const e of m.exits) { x.fillStyle = 'rgba(80,160,255,0.25)'; x.fillRect(e.x * 16, e.y * 16, e.w * 16, e.h * 16); x.strokeStyle = this.sel && this.sel.exit === e ? '#ffd860' : '#60a8ff'; x.strokeRect(e.x * 16, e.y * 16, e.w * 16, e.h * 16); x.font = '6px sans-serif'; x.fillStyle = '#bfe0ff'; x.textAlign = 'left'; x.fillText('→ ' + e.to, e.x * 16 + 2, e.y * 16 + 8); }
    if (this.show.points) for (const name in m.points) {
      const ps = Array.isArray(m.points[name]) ? m.points[name] : [m.points[name]];
      ps.forEach((p, i) => { if (!p) return; const cx = p.x * 16 + 8, cy = p.y * 16 + 8, on = this.sel && this.sel.point === name; x.fillStyle = on ? '#ffd860' : 'rgba(120,255,160,0.85)'; x.beginPath(); x.moveTo(cx, cy - 3); x.lineTo(cx + 3, cy); x.lineTo(cx, cy + 3); x.lineTo(cx - 3, cy); x.fill(); if (z >= 2.5 || on) { x.font = '4px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#c8ffd8'; x.fillText(name + (ps.length > 1 ? '#' + i : ''), cx, cy - 4); } });
    }
    if (this.show.grid && z >= 1.5) { x.strokeStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); for (let tx = Math.floor(vx0 / 16); tx < vx1 / 16; tx++) { x.moveTo(tx * 16, vy0); x.lineTo(tx * 16, vy1); } for (let ty = Math.floor(vy0 / 16); ty < vy1 / 16; ty++) { x.moveTo(vx0, ty * 16); x.lineTo(vx1, ty * 16); } x.stroke(); }
    if (this.sel && this.sel.decor) { const p = this.decorPos(this.sel.decor), fw = G.DECOR[this.sel.decor.type].fw || 1; x.strokeStyle = '#ffd860'; x.strokeRect(this.sel.decor.tx * 16, this.sel.decor.ty * 16, fw * 16, 16); }
    // the tool's footprint
    const h = this.hover;
    if (h) {
      x.strokeStyle = 'rgba(255,255,255,0.8)';
      if (this.drag && ['rect', 'building', 'exit'].includes(this.tool)) { const r = this.dragRect(); x.strokeRect(r.x * 16, r.y * 16, r.w * 16, r.h * 16); }
      else if (this.tool === 'paint' || this.tool === 'erase') { const b = this.brush, o = Math.floor((b - 1) / 2); x.strokeRect((h.tx - o) * 16, (h.ty - o) * 16, b * 16, b * 16); }
      else if (this.tool === 'decor' && G.DECOR[this.decor]) { this.ghost(x, this.decor, h.tx, h.ty); }
      else x.strokeRect(h.tx * 16, h.ty * 16, 16, 16);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    // minimap view box
    const mc = $('mini'), mx = mc.getContext('2d');
    if (this.miniDirty !== false) { this.renderMini(); this.miniDirty = false; }
  },
  drawDecor(x, o) {
    const def = G.DECOR[o.d.type], s = A.sprites[def.sprite]; if (!s) return;
    x.drawImage(s.img, Math.round(o.p.x - s.ax), Math.round(o.p.y - s.ay));
  },
  loop() { const f = () => { try { this.draw(); } catch (e) { console.error(e); } requestAnimationFrame(f); }; requestAnimationFrame(f); },

  // ------------------------------------------------------------ editing
  tileAt(ev) { const c = $('view'), r = c.getBoundingClientRect(), v = this.view; const wx = v.x + (ev.clientX - r.left) / v.z, wy = v.y + (ev.clientY - r.top) / v.z; return { wx, wy, tx: Math.floor(wx / 16), ty: Math.floor(wy / 16) }; },
  inb(tx, ty) { const m = this.M; return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h; },
  setTile(tx, ty, t) { const m = this.M; if (!this.inb(tx, ty) || m.ground[ty * m.w + tx] === t) return; m.ground[ty * m.w + tx] = t; this.drawTile(m, tx, ty); this.miniDirty = true; },
  decorAt(tx, ty) { const m = this.M; for (let i = m.decor.length - 1; i >= 0; i--) { const d = m.decor[i], def = G.DECOR[d.type], fw = def.fw || 1, fh = def.flat ? 1 : def.fh || 1; if (tx >= d.tx && tx < d.tx + fw && ty > d.ty - fh && ty <= d.ty) return d; } return null; },
  dragRect() { const a = this.drag.a, b = this.hover; return { x: Math.min(a.tx, b.tx), y: Math.min(a.ty, b.ty), w: Math.abs(a.tx - b.tx) + 1, h: Math.abs(a.ty - b.ty) + 1 }; },
  paintAt(h) { const b = this.brush, o = Math.floor((b - 1) / 2); for (let y = 0; y < b; y++) for (let x = 0; x < b; x++) { if (this.tool === 'paint') this.setTile(h.tx - o + x, h.ty - o + y, this.tile); else { const d = this.decorAt(h.tx - o + x, h.ty - o + y); if (d) this.M.decor = this.M.decor.filter((q) => q !== d); const ci = this.M.chests.findIndex((c) => c.tx === h.tx - o + x && c.ty === h.ty - o + y); if (ci >= 0) this.M.chests.splice(ci, 1); } } },
  flood(tx, ty, t) {
    const m = this.M, from = m.ground[ty * m.w + tx]; if (from === t) return;
    const q = [[tx, ty]]; let n = 0;
    while (q.length && n < 40000) { const [x, y] = q.pop(); if (!this.inb(x, y) || m.ground[y * m.w + x] !== from) continue; m.ground[y * m.w + x] = t; n++; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    this.renderGround(m);
  },
  addBuilding(r) {
    if (r.w < 4 || r.h < 4) { this.toast('A building needs at least 4x4 tiles.'); return; }
    const m = this.M; let k = 1; while (m.buildings.some((b) => b.id === this.cur + '_b' + k)) k++;
    const id = this.cur + '_b' + k, wall = G.T.wall_wood, floor = G.T.woodfloor;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.setTile(x, y, y === r.y || x === r.x || y === r.y + r.h - 1 || x === r.x + r.w - 1 ? wall : floor);
    const doorX = r.x + Math.floor(r.w / 2), doorY = r.y + r.h - 1;
    this.setTile(doorX, doorY, G.T.door);
    const b = { id, name: 'New Building', x: r.x, y: r.y, w: r.w, h: r.h, doorX, doorY, roof: 'red', chimney: r.w >= 5, kind: 'house', windows: [] };
    for (let i = r.x + 1; i < r.x + r.w - 1; i++) if (Math.abs(i - doorX) > 1 && (i - r.x) % 2 === 0) b.windows.push({ x: i * 16 + 8, y: doorY * 16 + 9 });
    m.buildings.push(b);
    m.points[id + '_door'] = { x: doorX, y: doorY + 1 }; m.points[id + '_in'] = { x: doorX, y: doorY - 1 }; m.points[id + '_center'] = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor((r.h - 1) / 2) };
    this.sel = { b }; this.inspect(); this.miniDirty = true;
  },
  // rebuild a building's walls/floor/door from its record (after changing its materials or size)
  rebuildBuilding(b, wallName, floorName) {
    const wall = G.T[wallName] != null ? G.T[wallName] : G.T.wall_wood, floor = G.T[floorName] != null ? G.T[floorName] : G.T.woodfloor;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const edge = y === b.y || x === b.x || y === b.y + b.h - 1 || x === b.x + b.w - 1; const cur = this.M.ground[y * this.M.w + x]; if (edge) this.setTile(x, y, wall); else if (!G.TILES[cur].solid || G.TILES[cur].wall) this.setTile(x, y, floor); }
    this.setTile(b.doorX, b.doorY, G.T.door);
  },
  furnish(b) {
    const m = this.M, tm = new G.TileMap(this.cur, m.w, m.h);
    tm.ground = m.ground.slice(); tm.buildings = [b]; tm.points = {}; tm.decor = []; tm.flats = []; tm.chests = [];
    for (const d of m.decor) if (d.tx >= b.x && d.tx < b.x + b.w && d.ty >= b.y && d.ty < b.y + b.h) m.decor = m.decor.filter((q) => q !== d);
    try { tm.computeSolids(); G.MB.furnish(tm, b, b.kind === 'shop' || b.kind === 'inn' || b.kind === 'office' || b.kind === 'mansion' ? b.kind : 'house', new G.RNG(b.id + Date.now()), { owner: b.owner || null }); tm.computeSolids(); G.worldScale.footBeds(tm, [b]); G.fillRooms(tm); } catch (e) { this.toast('Could not furnish: ' + e.message); return; }
    m.ground = tm.ground; this.renderGround(m);
    for (const d of tm.decor.concat(tm.flats)) { const ox = d.x - (d.tx * 16 + (d.def.fw || 1) * 8), oy = d.y - (d.ty * 16 + 15); m.decor.push({ type: d.type, tx: d.tx, ty: d.ty, extra: ox || oy ? { ox, oy } : null }); }
    m.chests = m.chests.filter((c) => !(c.tx >= b.x && c.tx < b.x + b.w && c.ty >= b.y && c.ty < b.y + b.h)).concat(tm.chests.map((c) => Object.assign({}, c)));
    Object.assign(m.points, tm.points);
    this.toast('Furnished ' + b.name + '.');
  },
  pickObject(h) {
    const m = this.M;
    for (const id in this.npcs) { const p = this.npcSpot(id); if (p && Math.abs(h.wx - (p.x * 16 + 8)) < 7 && h.wy > p.y * 16 - 8 && h.wy < p.y * 16 + 14) return { npc: id }; }
    if (this.show.points) for (const name in m.points) { const ps = Array.isArray(m.points[name]) ? m.points[name] : [m.points[name]]; const i = ps.findIndex((p) => p && p.x === h.tx && p.y === h.ty); if (i >= 0) return { point: name, idx: i }; }
    const ch = m.chests.find((c) => c.tx === h.tx && c.ty === h.ty); if (ch) return { chest: ch };
    const d = this.decorAt(h.tx, h.ty); if (d) return { decor: d };
    const e = m.exits.find((e) => h.tx >= e.x && h.tx < e.x + e.w && h.ty >= e.y && h.ty < e.y + e.h); if (e && this.show.exits) return { exit: e };
    const b = m.buildings.find((b) => h.tx >= b.x && h.tx < b.x + b.w && h.ty >= b.y && h.ty < b.y + b.h); if (b) return { b };
    return null;
  },
  down(ev) {
    const h = this.tileAt(ev);
    if (ev.button === 1 || ev.button === 2 || this.space) { this.pan = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y }; return; }
    if (ev.button !== 0 || !this.inb(h.tx, h.ty)) return;
    const t = this.tool;
    if (t === 'pick') { this.tile = this.M.ground[h.ty * this.M.w + h.tx]; const d = this.decorAt(h.tx, h.ty); if (d) this.decor = d.type; this.refreshPalettes(); this.toast('Picked ' + G.TILES[this.tile].name + (d ? ' and ' + d.type : '')); return; }
    if (t === 'select') { this.sel = this.pickObject(h); if (this.sel && this.sel.npc) this.npcSel = this.sel.npc; this.inspect(); if (this.sel && (this.sel.point || this.sel.decor || this.sel.npc || this.sel.chest)) { this.snap(); this.drag = { a: h, move: true }; } return; }
    this.snap();
    if (t === 'paint' || t === 'erase') { this.drag = { a: h }; this.paintAt(h); return; }
    if (t === 'fill') { this.flood(h.tx, h.ty, this.tile); return; }
    if (t === 'decor') { if (!this.M.decor.some((d) => d.tx === h.tx && d.ty === h.ty && d.type === this.decor)) this.M.decor.push({ type: this.decor, tx: h.tx, ty: h.ty, extra: null }); this.drag = { a: h, stamp: true }; return; }
    if (t === 'rect' || t === 'building' || t === 'exit') { this.drag = { a: h }; return; }
    if (t === 'point') {
      this.modal('New point', [{ k: 'name', label: 'Name (used by NPC schedules)', v: this.cur + '_spot' + (Object.keys(this.M.points).length + 1) }, { k: 'add', label: 'Add to an existing point list (patrol routes, wander areas)', type: 'check' }], (o) => {
        const p = { x: h.tx, y: h.ty }, cur = this.M.points[o.name];
        this.M.points[o.name] = o.add && cur ? (Array.isArray(cur) ? cur.concat([p]) : [cur, p]) : p;
        this.sel = { point: o.name }; this.inspect();
      });
      return;
    }
    if (t === 'npc') {
      const id = this.npcSel; if (!id || !this.npcs[id]) { this.toast('Choose a person in the NPCs tab first.'); return; }
      const d = this.npcs[id], pname = id + '_spot';
      d.map = this.cur; this.M.points[pname] = { x: h.tx, y: h.ty };
      if (!d.schedule || !d.schedule.length) d.schedule = [{ from: 0, to: 24, at: pname, act: 'wander' }];
      else for (const s of d.schedule) if (typeof s.at === 'string' && !this.M.points[s.at]) s.at = pname;
      this.sel = { npc: id }; this.inspect(); this.refreshNpcList(); return;
    }
    if (t === 'chest') { let k = 1; while (this.M.chests.some((c) => c.id === this.cur + ':box' + k)) k++; const c = { id: this.cur + ':box' + k, tx: h.tx, ty: h.ty, owner: null, loot: [], gold: 0, style: 'stash' }; this.M.chests.push(c); this.sel = { chest: c }; this.inspect(); }
  },
  move(ev) {
    if (this.pan) { this.view.x = this.pan.vx - (ev.clientX - this.pan.x) / this.view.z; this.view.y = this.pan.vy - (ev.clientY - this.pan.y) / this.view.z; return; }
    const h = this.hover = this.tileAt(ev);
    const m = this.M;
    const under = this.inb(h.tx, h.ty) ? G.TILES[m.ground[h.ty * m.w + h.tx]].name : '-';
    const b = m.buildings.find((b) => h.tx >= b.x && h.tx < b.x + b.w && h.ty >= b.y && h.ty < b.y + b.h), d = this.inb(h.tx, h.ty) && this.decorAt(h.tx, h.ty);
    $('status').textContent = `${m.meta.name || this.cur}  ·  ${h.tx}, ${h.ty}  ·  ${under}${d ? '  ·  prop: ' + d.type : ''}${b ? '  ·  ' + b.name + ' (' + b.id + ')' : ''}  ·  zoom ${this.view.z.toFixed(2)}  ·  tool: ${this.tool}`;
    if (!this.drag || !this.inb(h.tx, h.ty)) return;
    if ((this.tool === 'paint' || this.tool === 'erase') && (ev.buttons & 1)) this.paintAt(h);
    else if (this.tool === 'decor' && this.drag.stamp && (ev.buttons & 1) && !this.M.decor.some((q) => q.tx === h.tx && q.ty === h.ty)) this.M.decor.push({ type: this.decor, tx: h.tx, ty: h.ty, extra: null });
    else if (this.drag.move && this.sel) {
      const s = this.sel;
      if (s.point) { const ps = this.M.points[s.point]; if (Array.isArray(ps)) ps[s.idx || 0] = { x: h.tx, y: h.ty }; else this.M.points[s.point] = { x: h.tx, y: h.ty }; }
      else if (s.decor) { s.decor.tx = h.tx; s.decor.ty = h.ty; }
      else if (s.chest) { s.chest.tx = h.tx; s.chest.ty = h.ty; }
      else if (s.npc) { this.M.points[s.npc + '_spot'] = { x: h.tx, y: h.ty }; const d = this.npcs[s.npc]; if (!(d.schedule || []).some((q) => q.at === s.npc + '_spot')) { d.schedule = [{ from: 0, to: 24, at: s.npc + '_spot', act: 'wander' }]; } }
    }
  },
  up() {
    if (this.pan) { this.pan = null; return; }
    if (!this.drag) return;
    const r = this.hover && this.dragRect();
    if (r && this.tool === 'rect') for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.setTile(x, y, this.tile);
    if (r && this.tool === 'building') this.addBuilding(r);
    if (r && this.tool === 'exit') {
      const others = this.order.filter((i) => i !== this.cur);
      this.modal('New exit', [{ k: 'to', label: 'Leads to map', type: 'select', opts: others, v: others[0] }, { k: 'spawn', label: 'Arrive at point (on that map)', v: 'from_' + this.cur }, { k: 'label', label: 'Label', v: '' }], (o) => {
        const e = Object.assign({ x: r.x, y: r.y, w: r.w, h: r.h }, o); this.M.exits.push(e); this.sel = { exit: e }; this.inspect();
        const tm = this.model(o.to); if (!tm.points[o.spawn]) this.toast(`Tip: add a point named "${o.spawn}" on ${o.to} where people arrive.`);
      });
    }
    if (this.drag.move) this.inspect();
    this.drag = null; this.miniDirty = true;
  },
  wheel(ev) {
    ev.preventDefault();
    const before = this.tileAt(ev), v = this.view;
    v.z = G.util.clamp(v.z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), 0.12, 8);
    const r = $('view').getBoundingClientRect();
    v.x = before.wx - (ev.clientX - r.left) / v.z; v.y = before.wy - (ev.clientY - r.top) / v.z;
  },
  delSel() {
    const s = this.sel, m = this.M; if (!s) return;
    this.snap();
    if (s.decor) m.decor = m.decor.filter((d) => d !== s.decor);
    else if (s.point) { const ps = m.points[s.point]; if (Array.isArray(ps) && ps.length > 1) ps.splice(s.idx || 0, 1); else delete m.points[s.point]; }
    else if (s.exit) m.exits = m.exits.filter((e) => e !== s.exit);
    else if (s.chest) m.chests = m.chests.filter((c) => c !== s.chest);
    else if (s.b) { if (!confirm(`Remove the building record "${s.b.name}"? (Its walls stay; paint over them if you want them gone.)`)) { this.undo.pop(); return; } m.buildings = m.buildings.filter((b) => b !== s.b); }
    else if (s.npc) { this.deleteNpc(s.npc); }
    this.sel = null; this.inspect(); this.miniDirty = true;
  },

  // ------------------------------------------------------------ the interface
  ui() {
    const tools = $('tools');
    for (const [id, label, key] of TOOLS) tools.append(el('button', { textContent: label, title: `${label} (${key})`, on: { click: () => this.setTool(id) } }));
    this.setTool('paint');
    $('brush').oninput = (e) => { this.brush = +e.target.value; $('brushVal').textContent = this.brush; };
    $('palSearch').oninput = () => this.refreshPalettes();
    const ms = $('mapSelect');
    ms.onchange = () => this.openMap(ms.value);
    this.refreshMapSelect();
    $('newMap').onclick = () => this.newMap();
    for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => { for (const x of document.querySelectorAll('#tabs button')) x.classList.toggle('on', x === b); for (const p of document.querySelectorAll('.pane')) p.classList.toggle('hidden', p.id !== 'pane-' + b.dataset.tab); };
    for (const b of document.querySelectorAll('#bar button')) b.onclick = () => this.cmd(b.dataset.cmd);
    $('npcSearch').oninput = () => this.refreshNpcList(); $('npcThisMap').onchange = () => this.refreshNpcList();
    $('newNpc').onclick = () => this.newNpc();
    $('itemSearch').oninput = () => this.refreshItems(); $('newItem').onclick = () => this.newItem();
    $('worldDesc').oninput = (e) => { this.desc = e.target.value; this.setDirty(true); };
    const layers = $('layers');
    for (const k of Object.keys(this.show)) layers.append(el('label', {}, el('input', { type: 'checkbox', checked: this.show[k], on: { change: (e) => { this.show[k] = e.target.checked; } } }), ' ' + k));
    const c = $('view');
    c.addEventListener('mousedown', (e) => this.down(e)); window.addEventListener('mousemove', (e) => this.move(e)); window.addEventListener('mouseup', () => this.up());
    c.addEventListener('wheel', (e) => this.wheel(e), { passive: false }); c.addEventListener('contextmenu', (e) => e.preventDefault());
    $('mini').addEventListener('mousedown', (e) => { const r = e.target.getBoundingClientRect(), s = this.miniS || 1, sx = e.target.width / r.width; const tx = (e.clientX - r.left) * sx / s, ty = (e.clientY - r.top) * sx / s; const v = this.view, cv = $('view'); v.x = tx * 16 - cv.clientWidth / v.z / 2; v.y = ty * 16 - cv.clientHeight / v.z / 2; });
    window.addEventListener('keydown', (e) => this.key(e)); window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.space = false; });
    window.addEventListener('beforeunload', (e) => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    $('modalCancel').onclick = () => this.closeModal(); $('modalOk').onclick = () => this.modalOk && this.modalOk();
    this.refreshPalettes(); this.refreshMapProps(); this.refreshNpcList(); this.refreshItems();
  },
  key(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') { e.preventDefault(); this.cmd(e.shiftKey ? 'saveAs' : 'save'); return; }
    if (e.ctrlKey && k === 'o') { e.preventDefault(); this.cmd('open'); return; }
    if (e.ctrlKey && k === 'n') { e.preventDefault(); this.cmd('new'); return; }
    if (e.ctrlKey && k === 'z') { e.preventDefault(); this.doUndo(); return; }
    if (e.ctrlKey && k === 'y') { e.preventDefault(); this.doRedo(); return; }
    if (e.code === 'Space') { this.space = true; e.preventDefault(); return; }
    if (k === 'delete' || k === 'backspace') { this.delSel(); return; }
    const pan = 64 / this.view.z;
    if (k === 'arrowleft' || k === 'a') this.view.x -= pan; else if (k === 'arrowright' || k === 'd') this.view.x += pan; else if (k === 'arrowup' || k === 'w') this.view.y -= pan; else if (k === 'arrowdown' || k === 's') this.view.y += pan;
    const t = TOOLS.find((x) => x[2].toLowerCase() === k); if (t && !e.ctrlKey) this.setTool(t[0]);
    if (k === '[') { this.brush = Math.max(1, this.brush - 1); $('brush').value = this.brush; $('brushVal').textContent = this.brush; }
    if (k === ']') { this.brush = Math.min(6, this.brush + 1); $('brush').value = this.brush; $('brushVal').textContent = this.brush; }
  },
  setTool(id) { this.tool = id; [...$('tools').children].forEach((b, i) => b.classList.toggle('on', TOOLS[i][0] === id)); $('view').style.cursor = id === 'select' ? 'default' : 'crosshair'; },
  refreshMapSelect() { const ms = $('mapSelect'); ms.innerHTML = ''; for (const id of this.order) ms.append(el('option', { value: id, textContent: id + (this.maps[id] && this.maps[id].meta && this.maps[id].meta.name ? ' — ' + this.maps[id].meta.name : '') })); ms.value = this.cur; },
  thumb(img, w = 40, h = 40) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; const s = Math.min(w / img.width, h / img.height, 3); x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); return c.toDataURL(); },
  refreshPalettes() {
    const q = $('palSearch').value.toLowerCase();
    const tp = $('tilePal'); tp.innerHTML = '';
    G.TILES.forEach((t, i) => {
      if (!t.tex || (q && !t.name.includes(q))) return;
      this._tt = this._tt || {}; const url = this._tt[i] || (this._tt[i] = this.thumb(A.tile(t.tex, 0)));
      tp.append(el('div', { className: 'sw' + (this.tile === i ? ' on' : ''), style: `background-image:url(${url})`, 'data-name': t.name, on: { click: () => { this.tile = i; if (!['paint', 'rect', 'fill'].includes(this.tool)) this.setTool('paint'); this.refreshPalettes(); } } }));
    });
    const dp = $('decorPal'); dp.innerHTML = '';
    for (const k of Object.keys(G.DECOR).sort()) {
      if (q && !k.includes(q)) continue;
      const s = A.sprites[G.DECOR[k].sprite]; if (!s) continue;
      this._dt = this._dt || {}; const url = this._dt[k] || (this._dt[k] = this.thumb(this.propImg(k), 52, 52));
      dp.append(el('div', { className: 'sw' + (this.decor === k ? ' on' : ''), style: `background-image:url(${url})`, 'data-name': k, on: { click: () => { this.decor = k; this.setTool('decor'); this.refreshPalettes(); } } }));
    }
  },
  field(label, value, onchange, type = 'text', opts) {
    let input;
    if (type === 'select') { input = el('select', { on: { change: (e) => onchange(e.target.value) } }); for (const o of opts) input.append(el('option', { value: o, textContent: o === '' ? '(none)' : o })); input.value = value == null ? '' : value; }
    else if (type === 'check') { input = el('input', { type: 'checkbox', checked: !!value, on: { change: (e) => onchange(e.target.checked) } }); return el('label', {}, input, ' ' + label); }
    else if (type === 'area') input = el('textarea', { rows: 3, value: value == null ? '' : value, on: { change: (e) => onchange(e.target.value) } });
    else input = el('input', { type, value: value == null ? '' : value, on: { change: (e) => onchange(type === 'number' ? +e.target.value : e.target.value) } });
    return el('label', {}, label, input);
  },
  // the right-hand panel: properties of whatever is selected
  inspect() {
    const box = $('inspector'); box.innerHTML = ''; const s = this.sel, m = this.M, ch = () => { this.setDirty(true); };
    if (!s) { box.append(el('p', { className: 'dim', textContent: 'Select something on the map (V), or a person in the NPCs tab.' })); return; }
    if (s.npc) { this.npcForm(box, s.npc); return; }
    if (s.b) {
      const b = s.b;
      box.append(el('h3', { textContent: 'Building' }), el('p', { className: 'small', textContent: b.id + ` · ${b.w}×${b.h} at ${b.x},${b.y}` }));
      box.append(this.field('Name', b.name, (v) => { b.name = v; ch(); }));
      box.append(this.field('Kind', b.kind, (v) => { b.kind = v; ch(); }, 'select', KINDS));
      box.append(this.field('Roof', b.roof, (v) => { b.roof = v; ch(); }, 'select', ROOFS));
      box.append(this.field('Owner (NPC id)', b.owner || '', (v) => { b.owner = v || undefined; ch(); }));
      const walls = el('div', { className: 'grid2' });
      let wall = G.TILES[m.ground[b.y * m.w + b.x]].name, floor = G.TILES[m.ground[(b.y + 1) * m.w + b.x + 1]].name;
      walls.append(this.field('Walls', wall, (v) => { wall = v; }, 'select', WALLS), this.field('Floor', floor, (v) => { floor = v; }, 'select', FLOORS));
      box.append(walls, el('div', { className: 'row' }, el('button', { textContent: 'Apply walls/floor', on: { click: () => { this.snap(); this.rebuildBuilding(b, wall, floor); } } }), el('button', { textContent: 'Furnish', title: 'Lay out rooms and furniture for its kind', on: { click: () => { this.snap(); this.furnish(b); } } })));
      box.append(el('div', { className: 'row' }, el('button', { className: 'danger', textContent: 'Remove record', on: { click: () => this.delSel() } })));
      return;
    }
    if (s.exit) {
      const e = s.exit; box.append(el('h3', { textContent: 'Exit' }));
      box.append(this.field('Leads to', e.to, (v) => { e.to = v; ch(); }, 'select', this.order));
      box.append(this.field('Arrive at point', e.spawn, (v) => { e.spawn = v; ch(); }), this.field('Label', e.label || '', (v) => { e.label = v; ch(); }));
      const g = el('div', { className: 'grid2' }); for (const k of ['x', 'y', 'w', 'h']) g.append(this.field(k, e[k], (v) => { e[k] = v; ch(); }, 'number')); box.append(g);
      box.append(el('button', { className: 'danger', textContent: 'Delete exit', on: { click: () => this.delSel() } }));
      return;
    }
    if (s.point) {
      box.append(el('h3', { textContent: 'Point' }));
      box.append(this.field('Name', s.point, (v) => { if (!v || m.points[v]) return; m.points[v] = m.points[s.point]; delete m.points[s.point]; for (const id in this.npcs) for (const e of this.npcs[id].schedule || []) if (e.at === s.point) e.at = v; s.point = v; ch(); this.inspect(); }));
      const users = Object.keys(this.npcs).filter((id) => this.npcs[id].map === this.cur && (this.npcs[id].schedule || []).some((e) => e.at === s.point));
      box.append(el('p', { className: 'small', textContent: users.length ? 'Used by: ' + users.map((id) => this.npcs[id].name + ' (' + id + ')').join(', ') : 'No schedule uses this point yet.' }));
      box.append(el('button', { className: 'danger', textContent: 'Delete point', on: { click: () => this.delSel() } }));
      return;
    }
    if (s.decor) {
      const d = s.decor; box.append(el('h3', { textContent: 'Prop' }));
      box.append(this.field('Type', d.type, (v) => { d.type = v; ch(); }, 'select', Object.keys(G.DECOR).sort()));
      box.append(el('p', { className: 'small', textContent: `at ${d.tx}, ${d.ty}` + (G.DECOR[d.type].interact ? ' · use: ' + G.DECOR[d.type].interact : '') + (G.DECOR[d.type].solid ? ' · solid' : '') }));
      if (d.type === 'sign' || G.DECOR[d.type].interact === 'sign') box.append(this.field('Sign text', (m.signs || {})[d.tx + ',' + d.ty] || '', (v) => { m.signs = m.signs || {}; m.signs[d.tx + ',' + d.ty] = v; ch(); }, 'area'));
      box.append(el('button', { className: 'danger', textContent: 'Delete prop', on: { click: () => this.delSel() } }));
      return;
    }
    if (s.chest) {
      const c = s.chest; box.append(el('h3', { textContent: 'Container' }));
      box.append(this.field('Kind', c.style || 'stash', (v) => { c.style = v; ch(); }, 'select', Object.keys(G.STORAGE)));
      box.append(this.field('Owner (NPC id; taking from it is theft)', c.owner || '', (v) => { c.owner = v || null; ch(); }));
      box.append(this.field('Cash', c.gold || 0, (v) => { c.gold = v; ch(); }, 'number'));
      box.append(this.itemTable('Contents', c.loot = c.loot || [], ch));
      box.append(el('button', { className: 'danger', textContent: 'Delete container', on: { click: () => this.delSel() } }));
    }
  },
  itemTable(title, list, ch) {
    const wrap = el('div', {}, el('h3', { textContent: title }));
    const t = el('table'); wrap.append(t);
    const ids = Object.keys(G.ITEMS).sort();
    const render = () => {
      t.innerHTML = '';
      list.forEach((e, i) => {
        const sel = el('select', { on: { change: (ev) => { e[0] = ev.target.value; ch(); } } }); for (const id of ids) sel.append(el('option', { value: id, textContent: G.ITEMS[id].name + ' (' + id + ')' })); sel.value = e[0];
        t.append(el('tr', {}, el('td', {}, sel), el('td', { style: 'width:52px' }, el('input', { type: 'number', value: e[1], min: 1, on: { change: (ev) => { e[1] = +ev.target.value; ch(); } } })), el('td', { style: 'width:24px' }, el('button', { textContent: '×', on: { click: () => { list.splice(i, 1); ch(); render(); } } }))));
      });
      t.append(el('tr', {}, el('td', { colSpan: 3 }, el('button', { textContent: '+ Add item', on: { click: () => { list.push([ids[0], 1]); ch(); render(); } } }))));
    };
    render();
    return wrap;
  },
  // ------------------------------------------------------------ NPCs
  refreshNpcList() {
    const box = $('npcList'); if (!box) return; box.innerHTML = '';
    const q = $('npcSearch').value.toLowerCase(), only = $('npcThisMap').checked;
    const ids = Object.keys(this.npcs).filter((id) => (!only || this.npcs[id].map === this.cur) && (!q || (id + ' ' + this.npcs[id].name).toLowerCase().includes(q))).sort();
    for (const id of ids.slice(0, 400)) {
      const d = this.npcs[id], c = document.createElement('canvas'); c.width = 16; c.height = 20;
      try { c.getContext('2d').drawImage(this.personImg(d.look, 16, 20), 0, 0); } catch (e) { /* bad look */ }
      box.append(el('div', { className: 'it' + (this.npcSel === id ? ' on' : ''), on: { click: () => { this.npcSel = id; this.sel = { npc: id }; if (d.map !== this.cur && this.order.includes(d.map)) this.openMap(d.map); this.sel = { npc: id }; this.centerOn(this.npcSpot(id)); this.inspect(); this.refreshNpcList(); } } }, c, el('div', {}, d.name, el('div', { className: 'sub', textContent: `${id} · ${d.map} · ${d.faction}` }))));
    }
    if (!ids.length) box.append(el('p', { className: 'dim', textContent: 'Nobody here. Use + to add someone.' }));
  },
  centerOn(p) { if (!p) return; const c = $('view'); this.view.x = p.x * 16 - c.clientWidth / this.view.z / 2; this.view.y = p.y * 16 - c.clientHeight / this.view.z / 2; },
  newNpc() {
    this.modal('New person', [{ k: 'id', label: 'Id (letters, numbers, _)', v: 'custom_' + (Object.keys(this.npcs).filter((k) => k.startsWith('custom_')).length + 1) }, { k: 'name', label: 'Role / name shown', v: 'Townsperson' }], (o) => {
      const id = o.id.replace(/[^a-zA-Z0-9_]/g, '_'); if (this.npcs[id]) { this.toast('That id is taken.'); return; }
      this.snap();
      this.npcs[id] = { id, name: o.name, map: this.cur, faction: 'civilians', hp: 30, combat: 'flee', gold: 10, look: G.look(id), relations: {}, schedule: [], inv: [] };
      this.npcSel = id; this.sel = { npc: id }; this.setTool('npc'); this.toast('Click on the map to place ' + o.name + '.'); this.refreshNpcList(); this.inspect();
    });
  },
  deleteNpc(id) { if (!confirm('Delete ' + this.npcs[id].name + ' (' + id + ')?')) return; delete this.npcs[id]; if (G.NPCS[id]) this.deletedNpcs.push(id); this.npcSel = null; this.refreshNpcList(); },
  npcForm(box, id) {
    const d = this.npcs[id], ch = () => { this.setDirty(true); this.refreshPreview(d); };
    box.append(el('h3', { textContent: 'Person' }), el('p', { className: 'small', textContent: id }));
    const pv = el('div', { className: 'preview', id: 'npcPreview' }); box.append(pv); this.refreshPreview(d);
    const g = el('div', { className: 'grid2' });
    g.append(this.field('Name / role', d.name, (v) => { d.name = v; ch(); this.refreshNpcList(); }), this.field('Map', d.map, (v) => { d.map = v; ch(); }, 'select', this.order));
    g.append(this.field('Faction', d.faction, (v) => { d.faction = v; ch(); }, 'select', Object.keys(G.FACTIONS)), this.field('Combat', d.combat, (v) => { d.combat = v; ch(); }, 'select', COMBAT));
    g.append(this.field('Health', d.hp, (v) => { d.hp = v; ch(); }, 'number'), this.field('Cash', d.gold || 0, (v) => { d.gold = v; ch(); }, 'number'));
    const weapons = [''].concat(Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].type === 'weapon')), armors = [''].concat(Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].type === 'armor'));
    g.append(this.field('Weapon', d.weapon || '', (v) => { d.weapon = v || undefined; ch(); }, 'select', weapons), this.field('Armor', d.armor || '', (v) => { d.armor = v || undefined; ch(); }, 'select', armors));
    const homes = [''].concat((this.maps[d.map] || this.M).buildings.map((b) => b.id));
    g.append(this.field('Home', d.home || '', (v) => { d.home = v || undefined; ch(); }, 'select', homes), this.field('Dialogue', d.dialogue || '', (v) => { d.dialogue = v || undefined; ch(); }, 'select', [''].concat(Object.keys(G.DIALOGUES))));
    g.append(this.field('Shop', d.shop || '', (v) => { d.shop = v || undefined; ch(); }, 'select', [''].concat(Object.keys(G.SHOPS))), this.field('Age', d.kid || '', (v) => { d.kid = v || undefined; ch(); }, 'select', ['', 'kid', 'teen']));
    box.append(g);
    box.append(this.field('Leader of their faction', d.leader, (v) => { d.leader = v || undefined; ch(); }, 'check'), this.field('Drug dealer', d.dealer, (v) => { d.dealer = v ? true : undefined; ch(); }, 'check'));
    // looks
    const L = d.look = d.look || {};
    box.append(el('h3', { textContent: 'Looks' }));
    const lg = el('div', { className: 'grid2' });
    lg.append(this.field('Body', L.body || 'm', (v) => { L.body = v; ch(); }, 'select', LOOKS.body), this.field('Hair style', L.hairStyle || 0, (v) => { L.hairStyle = v; ch(); }, 'number'));
    for (const [k, label] of [['skin', 'Skin'], ['hair', 'Hair'], ['eyes', 'Eyes'], ['shirt', 'Top color'], ['shirt2', 'Top accent'], ['pants', 'Bottom color'], ['shoes', 'Shoes'], ['hatColor', 'Hat color']]) lg.append(this.field(label, L[k] || '#888888', (v) => { L[k] = v; ch(); }, 'color'));
    lg.append(this.field('Top', L.top || 'shirt', (v) => { L.top = v; ch(); }, 'select', LOOKS.top), this.field('Bottom', L.bottom || 'pants', (v) => { L.bottom = v; ch(); }, 'select', LOOKS.bottom));
    lg.append(this.field('Hat', L.hat || '', (v) => { L.hat = v || null; ch(); }, 'select', LOOKS.hat), this.field('Glasses', L.glasses || '', (v) => { L.glasses = v || null; ch(); }, 'select', LOOKS.glasses));
    lg.append(this.field('Mask', L.mask || '', (v) => { L.mask = v || null; ch(); }, 'select', LOOKS.mask), this.field('Facial hair (0-3)', L.facial || 0, (v) => { L.facial = v; ch(); }, 'number'));
    lg.append(this.field('Cape', L.cape || '', (v) => { L.cape = v || null; ch(); }, 'color'));
    box.append(lg, el('div', { className: 'row' }, el('button', { textContent: 'Random looks', on: { click: () => { d.look = G.look(id + Math.random()); ch(); this.inspect(); } } }), el('button', { textContent: 'No cape', on: { click: () => { L.cape = null; ch(); } } })));
    // schedule
    box.append(el('h3', { textContent: 'Daily schedule' }));
    const st = el('table'); box.append(st);
    const pts = Object.keys((this.maps[d.map] || this.M).points).sort();
    const renderS = () => {
      st.innerHTML = ''; st.append(el('tr', {}, el('td', { className: 'small', textContent: 'From' }), el('td', { className: 'small', textContent: 'To' }), el('td', { className: 'small', textContent: 'Where' }), el('td', { className: 'small', textContent: 'Does' }), el('td')));
      (d.schedule = d.schedule || []).forEach((e, i) => {
        const at = el('select', { on: { change: (ev) => { e.at = ev.target.value; ch(); } } }); for (const p of pts) at.append(el('option', { value: p, textContent: p })); if (typeof e.at === 'string') at.value = e.at;
        const act = el('select', { on: { change: (ev) => { e.act = ev.target.value; ch(); } } }); for (const a of ACTS) act.append(el('option', { value: a, textContent: a })); act.value = e.act;
        st.append(el('tr', {}, el('td', { style: 'width:40px' }, el('input', { type: 'number', min: 0, max: 24, step: 0.5, value: e.from, on: { change: (ev) => { e.from = +ev.target.value; ch(); } } })), el('td', { style: 'width:40px' }, el('input', { type: 'number', min: 0, max: 24, step: 0.5, value: e.to, on: { change: (ev) => { e.to = +ev.target.value; ch(); } } })), el('td', {}, at), el('td', { style: 'width:64px' }, act), el('td', { style: 'width:22px' }, el('button', { textContent: '×', on: { click: () => { d.schedule.splice(i, 1); ch(); renderS(); } } }))));
      });
      st.append(el('tr', {}, el('td', { colSpan: 5 }, el('button', { textContent: '+ Add time slot', on: { click: () => { d.schedule.push({ from: 8, to: 18, at: pts[0], act: 'wander' }); ch(); renderS(); } } }))));
    };
    renderS();
    box.append(this.itemTable('Carries', d.inv = d.inv || [], ch));
    // relations
    box.append(el('h3', { textContent: 'Relationships' }));
    const rt = el('table'); box.append(rt);
    const renderR = () => {
      rt.innerHTML = '';
      for (const o of Object.keys(d.relations = d.relations || {})) rt.append(el('tr', {}, el('td', { textContent: (this.npcs[o] ? this.npcs[o].name + ' ' : '') + '(' + o + ')' }), el('td', { style: 'width:90px' }, (() => { const s = el('select', { on: { change: (ev) => { d.relations[o] = ev.target.value; ch(); } } }); for (const r of ['spouse', 'family', 'friend', 'comrade', 'master', 'apprentice']) s.append(el('option', { value: r, textContent: r })); s.value = d.relations[o]; return s; })()), el('td', { style: 'width:22px' }, el('button', { textContent: '×', on: { click: () => { delete d.relations[o]; ch(); renderR(); } } }))));
      const who = el('select'); for (const o of Object.keys(this.npcs).filter((k) => k !== id).sort()) who.append(el('option', { value: o, textContent: this.npcs[o].name + ' (' + o + ')' }));
      rt.append(el('tr', {}, el('td', {}, who), el('td', { colSpan: 2 }, el('button', { textContent: '+ Relation', on: { click: () => { d.relations[who.value] = 'friend'; ch(); renderR(); } } }))));
    };
    renderR();
    box.append(el('div', { className: 'row' }, el('button', { textContent: 'Place on map (N)', on: { click: () => { this.npcSel = id; this.setTool('npc'); } } }), el('button', { textContent: 'Duplicate', on: { click: () => { let k = 2; while (this.npcs[id + '_' + k]) k++; const nid = id + '_' + k; this.snap(); this.npcs[nid] = clone(d); this.npcs[nid].id = nid; this.npcSel = nid; this.sel = { npc: nid }; this.refreshNpcList(); this.inspect(); } } }), el('button', { className: 'danger', textContent: 'Delete', on: { click: () => { this.snap(); this.deleteNpc(id); this.sel = null; this.inspect(); } } })));
  },
  // ------------------------------------------------------------ items
  refreshItems() {
    const box = $('itemList'); if (!box) return; box.innerHTML = '';
    const q = $('itemSearch').value.toLowerCase();
    const all = Object.assign({}, G.ITEMS, this.items);
    for (const id of Object.keys(all).sort().filter((k) => !q || (k + ' ' + all[k].name).toLowerCase().includes(q)).slice(0, 300)) {
      const it = all[id]; let ic = null; try { ic = A.icon(it.icon); } catch (e) { /* no icon */ }
      const c = document.createElement('canvas'); c.width = 16; c.height = 16; if (ic) c.getContext('2d').drawImage(ic, 0, 0, 16, 16);
      box.append(el('div', { className: 'it' + (this.itemSel === id ? ' on' : '') + (this.items[id] ? ' custom' : ''), on: { click: () => { this.itemSel = id; this.itemForm(id); this.refreshItems(); } } }, c, el('div', {}, it.name + (this.items[id] ? ' *' : ''), el('div', { className: 'sub', textContent: `${id} · ${it.type} · $${it.value || 0}` }))));
    }
  },
  newItem() {
    this.modal('New item', [{ k: 'id', label: 'Id', v: 'custom_item' + (Object.keys(this.items).length + 1) }, { k: 'name', label: 'Name', v: 'New Item' }, { k: 'type', label: 'Type', type: 'select', opts: ['consumable', 'weapon', 'armor', 'trinket', 'material', 'misc'], v: 'misc' }], (o) => {
      const id = o.id.replace(/[^a-zA-Z0-9_]/g, '_'); if (G.ITEMS[id] || this.items[id]) { this.toast('That id is taken.'); return; }
      this.snap(); this.items[id] = { name: o.name, type: o.type, icon: 'unknown', value: 5, desc: '' }; this.itemSel = id; this.itemForm(id); this.refreshItems();
    });
  },
  itemForm(id) {
    const box = $('inspector'); box.innerHTML = ''; this.sel = null;
    const it = this.items[id] || (this.items[id] = clone(G.ITEMS[id])), ch = () => { this.setDirty(true); this.refreshItems(); };
    box.append(el('h3', { textContent: 'Item' }), el('p', { className: 'small', textContent: id + (G.ITEMS[id] ? ' (a game item: your changes override it)' : ' (new)') }));
    box.append(this.field('Name', it.name, (v) => { it.name = v; ch(); }), this.field('Type', it.type, (v) => { it.type = v; ch(); }, 'select', ['consumable', 'weapon', 'armor', 'trinket', 'material', 'misc', 'ammo', 'clothing', 'key']));
    const icons = [...new Set(Object.values(G.ITEMS).map((x) => x.icon).filter(Boolean))].sort();
    const g = el('div', { className: 'grid2' });
    g.append(this.field('Icon', it.icon, (v) => { it.icon = v; ch(); }, 'select', icons), this.field('Value ($)', it.value || 0, (v) => { it.value = v; ch(); }, 'number'));
    for (const [k, label] of [['heal', 'Heals'], ['stamina', 'Stamina'], ['dmg', 'Damage'], ['def', 'Defense'], ['food', 'Food'], ['drink', 'Drink'], ['stack', 'Stack size']]) g.append(this.field(label, it[k] || 0, (v) => { if (v) it[k] = v; else delete it[k]; ch(); }, 'number'));
    box.append(g, this.field('Description', it.desc || '', (v) => { it.desc = v; ch(); }, 'area'));
    if (G.ITEMS[id]) box.append(el('button', { textContent: 'Revert to the game\'s version', on: { click: () => { this.snap(); delete this.items[id]; this.refreshItems(); box.innerHTML = ''; } } }));
    else box.append(el('button', { className: 'danger', textContent: 'Delete item', on: { click: () => { this.snap(); delete this.items[id]; this.refreshItems(); box.innerHTML = ''; } } }));
  },
  // ------------------------------------------------------------ maps
  refreshMapProps() {
    const box = $('mapProps'); if (!box || !this.M) return; box.innerHTML = '';
    const m = this.M, meta = m.meta = m.meta || {}, ch = () => { this.setDirty(true); };
    box.append(el('p', { className: 'small', textContent: `${this.cur} · ${m.w}×${m.h} tiles · ${m.buildings.length} buildings · ${m.decor.length} props` }));
    box.append(this.field('Name', meta.name || '', (v) => { meta.name = v; ch(); this.refreshMapSelect(); }), this.field('Region', meta.region || '', (v) => { meta.region = v; ch(); }, 'select', [''].concat(Object.keys(G.REGIONS || {}))));
    box.append(this.field('Darkness at night (0-1)', meta.darkness || 0, (v) => { meta.darkness = v; ch(); }, 'number'), this.field('Music', meta.music || '', (v) => { meta.music = v; ch(); }));
    box.append(el('div', { className: 'row' }, el('button', { textContent: 'Resize…', on: { click: () => this.resizeMap() } })));
  },
  newMap() {
    this.modal('New map', [{ k: 'id', label: 'Id', v: 'custom_map' + (this.order.filter((k) => k.startsWith('custom_map')).length + 1) }, { k: 'name', label: 'Name', v: 'New Place' }, { k: 'w', label: 'Width (tiles)', v: 60, type: 'number' }, { k: 'h', label: 'Height (tiles)', v: 45, type: 'number' }, { k: 'fill', label: 'Ground', type: 'select', opts: G.TILES.filter((t) => t.tex && !t.solid).map((t) => t.name), v: 'grass' }, { k: 'region', label: 'Region', type: 'select', opts: Object.keys(G.REGIONS || { rural: 1 }), v: 'rural' }], (o) => {
      const id = o.id.replace(/[^a-zA-Z0-9_]/g, '_'); if (this.order.includes(id)) { this.toast('That id is taken.'); return; }
      const w = G.util.clamp(o.w | 0, 10, 400), h = G.util.clamp(o.h | 0, 10, 400);
      const m = { id, w, h, ground: new Uint8Array(w * h).fill(G.T[o.fill] != null ? G.T[o.fill] : G.T.grass), decor: [], buildings: [], points: { start: { x: Math.floor(w / 2), y: Math.floor(h / 2) } }, exits: [], chests: [], animalZones: [], dangerZones: [], signs: {}, meta: { name: o.name, region: o.region, darkness: 0 } };
      m.points['from_' + this.cur] = { x: Math.floor(w / 2), y: h - 3 };
      this.maps[id] = m; this.order.push(id); this.renderGround(m); this.refreshMapSelect(); this.openMap(id); this.setDirty(true);
      this.toast('New map. Add an exit (X) on another map that leads here.');
    });
  },
  resizeMap() {
    const m = this.M;
    this.modal('Resize map', [{ k: 'w', label: 'Width', v: m.w, type: 'number' }, { k: 'h', label: 'Height', v: m.h, type: 'number' }, { k: 'fill', label: 'New ground', type: 'select', opts: G.TILES.filter((t) => t.tex).map((t) => t.name), v: 'grass' }], (o) => {
      this.snap();
      const w = G.util.clamp(o.w | 0, 10, 400), h = G.util.clamp(o.h | 0, 10, 400), g = new Uint8Array(w * h).fill(G.T[o.fill]);
      for (let y = 0; y < Math.min(h, m.h); y++) for (let x = 0; x < Math.min(w, m.w); x++) g[y * w + x] = m.ground[y * m.w + x];
      m.ground = g; m.w = w; m.h = h; m.decor = m.decor.filter((d) => d.tx < w && d.ty < h); this.renderGround(m); this.refreshMapProps();
    });
  },
  // ------------------------------------------------------------ files
  files() {
    const out = {}, ids = this.order.slice();
    for (const id of ids) out['maps/' + id + '.json'] = JSON.stringify(this.toFile(this.model(id)));
    out['world.json'] = JSON.stringify({ format: 2, name: this.name, description: this.desc, saved: new Date().toISOString(), maps: ids, npcs: this.npcs, deletedNpcs: this.deletedNpcs, items: this.items }, null, 1);
    return out;
  },
  load(name, files) {
    const w = WF.upgradeWorld(JSON.parse(files['world.json']));
    this.maps = {}; this.order = [];
    for (const id of w.maps || []) { const f = files['maps/' + id + '.json']; if (f) { this.maps[id] = this.fromFile(JSON.parse(f)); this.order.push(id); } }
    for (const id of Object.keys(G.MAPGEN)) if (!this.order.includes(id)) this.order.push(id);
    this.npcs = w.npcs || WF.serializeNPCs(); this.items = w.items || {}; this.deletedNpcs = w.deletedNpcs || []; this.desc = w.description || '';
    $('worldDesc').value = this.desc;
    this.name = name; $('worldName').textContent = '· ' + name; this.undo = []; this.redo = []; this.setDirty(false);
    for (const m of Object.values(this.maps)) m.canvas = null;
    this.refreshMapSelect(); this.openMap(this.order.includes('rural') ? 'rural' : this.order[0]); this.refreshItems();
    this.toast('Opened "' + name + '".');
  },
  async cmd(c) {
    if (c === 'undo') return this.doUndo();
    if (c === 'redo') return this.doRedo();
    if (c === 'help') return this.help();
    if (c === 'check') return this.check();
    if (c === 'new') { if (this.dirty && !confirm('Discard unsaved changes?')) return; this.reset(); $('worldName').textContent = '· default world'; this.refreshMapSelect(); this.refreshItems(); return; }
    if (c === 'open') {
      if (this.dirty && !confirm('Discard unsaved changes?')) return;
      if (!host) { this.toast('Open needs the desktop editor (Unholium Creation Tool.exe).'); return; }
      const r = await ask('open'); if (r.ok) this.load(r.name, r.files); else if (r.error) this.toast(r.error);
      return;
    }
    if (c === 'save' || c === 'saveAs' || c === 'play') {
      if (c === 'play' && !host) { this.toast('Play needs the desktop editor.'); return; }
      if (c === 'save' && !this.name || c === 'saveAs' || c === 'play' && !this.name) {
        if (!host) { this.download(); return; }
        this.toast('Preparing the world…'); await new Promise((ok) => setTimeout(ok, 30));
        const r = await ask('saveAs', { files: this.files(), suggested: this.name || 'My World' });
        if (!r.ok) { if (r.error) this.toast(r.error); return; }
        this.name = r.name; $('worldName').textContent = '· ' + r.name;
      } else {
        if (!host) { this.download(); return; }
        this.toast('Saving…'); await new Promise((ok) => setTimeout(ok, 30));
        const r = await ask('save', { name: this.name, files: this.files() }); if (!r.ok) { this.toast(r.error || 'Could not save.'); return; }
      }
      this.setDirty(false); this.toast('Saved "' + this.name + '".');
      if (c === 'play') ask('play', { name: this.name });
    }
  },
  download() { const blob = new Blob([JSON.stringify(this.files())], { type: 'application/json' }); const a = el('a', { href: URL.createObjectURL(blob), download: (this.name || 'world') + '.bundle.json' }); a.click(); },
  check() {
    const problems = [];
    for (const id in this.npcs) {
      const d = this.npcs[id]; if (!this.order.includes(d.map)) { problems.push(`${id}: map "${d.map}" does not exist`); continue; }
      const m = this.model(d.map);
      for (const e of d.schedule || []) if (typeof e.at === 'string' && !m.points[e.at]) problems.push(`${id} (${d.name}): schedule point "${e.at}" is missing on ${d.map}`);
      if (d.home && !m.buildings.some((b) => b.id === d.home)) problems.push(`${id}: home "${d.home}" is not a building on ${d.map}`);
    }
    for (const id of this.order) { const m = this.maps[id]; if (!m) continue; for (const e of m.exits) { if (!this.order.includes(e.to)) problems.push(`${id}: exit to unknown map "${e.to}"`); else if (!this.model(e.to).points[e.spawn]) problems.push(`${id}: exit to ${e.to} arrives at missing point "${e.spawn}"`); } }
    this.modal('World check', [], null, problems.length ? `<p>${problems.length} ${window.EditorI18n && window.EditorI18n.on ? 'problema(s)' : 'problem(s)'}:</p><ul>${problems.slice(0, 60).map((p) => '<li>' + p.replace(/</g, '&lt;') + '</li>').join('')}</ul>` : '<p>Everything checks out.</p>');
  },
  help() {
    this.modal('How to use the World Editor', [], null, `
      <p><b>Move around</b>: drag with the right or middle mouse button (or hold <kbd>Space</kbd>), wheel to zoom, <kbd>WASD</kbd>/arrows. Click the minimap to jump.</p>
      <p><b>Tools</b>: <kbd>V</kbd> select &amp; drag, <kbd>B</kbd> paint tiles (<kbd>[</kbd> <kbd>]</kbd> brush size), <kbd>R</kbd> rectangle, <kbd>G</kbd> fill, <kbd>I</kbd> pick, <kbd>P</kbd> place props, <kbd>E</kbd> erase props, <kbd>H</kbd> draw a building, <kbd>T</kbd> add a named point, <kbd>X</kbd> add an exit to another map, <kbd>N</kbd> place the selected person, <kbd>C</kbd> add a container.</p>
      <p><b>Delete</b> removes what is selected. <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> undo/redo.</p>
      <p><b>People</b> live by their schedule: each slot says where (a named point) and what they do. Use the NPCs tab to edit anyone or add someone new, then place them with <kbd>N</kbd>.</p>
      <p><b>Saving</b>: Save As asks for a name; each world is its own folder in the game's <i>worlds</i> folder. In the game, choose it under New Game. <b>▶ Play</b> saves and starts it.</p>`);
  },
  modal(title, fields, onOk, html) {
    const body = $('modalBody'); body.innerHTML = '<h2></h2>'; body.firstChild.textContent = title;
    if (html) body.insertAdjacentHTML('beforeend', html);
    const vals = {};
    for (const f of fields) { vals[f.k] = f.v; body.append(this.field(f.label, f.v, (v) => { vals[f.k] = v; }, f.type === 'number' ? 'number' : f.type || 'text', f.opts)); }
    for (const inp of body.querySelectorAll('input,select')) inp.addEventListener('input', () => inp.dispatchEvent(new Event('change')));
    $('modalCancel').classList.toggle('hidden', !onOk);
    this.modalOk = () => { this.closeModal(); if (onOk) { if (fields.length) this.snap(); onOk(vals); } };
    $('modal').classList.remove('hidden');
    const first = body.querySelector('input,select'); if (first) first.focus();
  },
  closeModal() { $('modal').classList.add('hidden'); },
  toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(this.toastT); this.toastT = setTimeout(() => e.classList.remove('show'), 2600); },
};
})();
