'use strict';
// Unholium Creation Tool, the game's own eyes. The editor does not imitate the game's look: every map on screen is a real G.TileMap
// drawn by the game's renderer, so ground materials, walls, roofs, shop fronts, signs and props are what a player sees.
//   Ground: E.renderGround builds the map once; a stroke paints fast, and the full look returns when the hand rests (E.idle).
//   Props: G.drawDecor with the same objects the game uses.
//   People and animals: the game's own sheets at the game's own size, previewed moving in all eight headings.
//   Worlds saved before the world doubled are brought up to scale when opened (G.worldFile.deserializeMap).
(() => {
const E = window.Editor, A = G.assets, WF = G.worldFile, $ = (id) => document.getElementById(id), H = G.hd;
if (!E) return;
const SCENE = { player: null, world: null, map: { meta: {} } };
let frontsOff = false;

// ---------------------------------------------------------------- the ground
E.renderGround = function (m) {
  const tm = WF.deserializeMap(this.toFile(m));
  tm.live = true; tm.prerender();
  m._tm = tm; m.ground = tm.ground; m.canvas = tm.groundCanvas; this.staleAt = 0;
  for (const b of tm.buildings) b.roofAlpha = 1;
  this.renderMini();
};
E.touch = function () { this.staleAt = performance.now(); };
E.idle = function () { if (!this.staleAt || this.mouseDown || this.drag || performance.now() - this.staleAt < 1100 || !this.M) return; this.renderGround(this.M); };
const _set = E.setTile; E.setTile = function (tx, ty, t) { _set.call(this, tx, ty, t); this.touch(); };
const _snap = E.snap; E.snap = function () { _snap.call(this); this.touch(); };
E.drawGround = function (x, m, c) {
  const v = this.view, z = v.z, tm = m._tm; if (!tm) { this.renderGround(m); return; }
  G.renderer.canvas = c; G.renderer.zoom = z;      // (the art passes draw at full density only on the main canvas)
  const view = { x: v.x, y: v.y, w: c.width / z, h: c.height / z };
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  tm.drawGround(x, view, performance.now() / 1000);
  if (!frontsOff) try { G.realFront.paint(x, tm, view); G.facades.signs(x, tm, view); } catch (e) { frontsOff = true; console.error(e); }
  x.imageSmoothingEnabled = false;
};
E.drawRoofs = function (x, m, c) { const v = this.view, tm = m._tm; if (!tm) return; const view = { x: v.x, y: v.y, w: c.width / v.z, h: c.height / v.z }; tm.drawRoofs(x, view); for (const b of G.realFront.fronts(tm, view)) G.realFront.drawFront(x, tm, b); };

// ---------------------------------------------------------------- props
const live = (d, pos) => { const o = d._o || (d._o = { def: G.DECOR[d.type], type: d.type }); o.tx = d.tx; o.ty = d.ty; o.x = pos.x; o.y = pos.y; if (d.extra) for (const k in d.extra) if (k !== 'ox' && k !== 'oy' && k !== 'wall') o[k] = d.extra[k]; return o; };
E.drawDecor = function (x, o) {
  const def = G.DECOR[o.d.type], s = def && A.sprites[def.sprite]; if (!s) return;
  const q = live(o.d, o.p);
  if (o.d.extra && o.d.extra.wall && !q.wallOf) q.wallOf = this.M.buildings.find((b) => b.id === o.d.extra.wall) || null;
  try { G.drawDecor(x, q, s, SCENE); } catch (e) { x.drawImage(s.img, Math.round(o.p.x - s.ax), Math.round(o.p.y - s.ay)); }
};
// R turns the selected piece: its next orientation, or the type that faces that way
const TURN = { chair: 'chair_right', chair_right: 'chair_up', chair_up: 'chair_left', chair_left: 'chair', couch: 'couch_r', couch_r: 'couch_up', couch_up: 'couch_l', couch_l: 'couch', table: 'table_v', table_v: 'table', desk: 'desk_r', desk_r: 'desk_l', desk_l: 'desk' };
const ORIS = [undefined, 'r', 'l', 'up', 'dl', 'dr'];
E.turnSel = function () {
  const d = this.sel && this.sel.decor; if (!d) return false;
  this.snap();
  if (TURN[d.type]) { d.type = TURN[d.type]; d._o = null; }
  else { const sp = G.DECOR[d.type].sprite, base = sp.replace(/^f_/, ''), has = (o) => !o || G.realFurn.ART[sp + '_' + o] || G.realFurn.ART['f_' + base + '_' + o]; let i = ORIS.indexOf(d.extra && d.extra.ori); for (let n = 0; n < ORIS.length; n++) { i = (i + 1) % ORIS.length; if (has(ORIS[i])) break; } d.extra = Object.assign({}, d.extra); if (ORIS[i]) d.extra.ori = ORIS[i]; else delete d.extra.ori; d._o = null; }
  return true;
};
document.addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'R') && E.tool === 'select' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && E.turnSel()) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
E.ghost = function (x, type, tx, ty) { const fw = G.DECOR[type].fw || 1; x.globalAlpha = 0.6; this.drawDecor(x, { d: { type, tx, ty, extra: null }, p: { x: tx * 16 + fw * 8, y: ty * 16 + 15 } }); x.globalAlpha = 1; };
E.propImg = function (k) {
  const def = G.DECOR[k], s = A.sprites[def.sprite], c = document.createElement('canvas'), S = 2; c.width = s.w * S; c.height = s.h * S;
  const x = c.getContext('2d'); x.scale(S, S); x.translate(s.ax, s.ay);
  try { G.drawDecor(x, { def, type: k, x: 0, y: 0, tx: 0, ty: 0 }, s, SCENE); } catch (e) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(s.img, 0, 0, c.width, c.height); }
  return c;
};

// ---------------------------------------------------------------- people, at the game's size
E.drawPerson = function (x, look, px, py) {
  const sheet = A.character(look || {}), h = H.get(sheet); if (!h) return;
  G._hdDrawing = true; x.imageSmoothingEnabled = true;
  x.drawImage(h.img, H.COL.idle * H.FW, 0, H.FW, H.FH, px - H.WW / 2, py - H.WH + 1, H.WW, H.WH);
  x.imageSmoothingEnabled = false; G._hdDrawing = false;
};
E.personImg = function (look, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const s = A.character(look || {}), hd = H.get(s), k = Math.min(w / H.WW, h / H.WH), x = c.getContext('2d'); G._hdDrawing = true; x.drawImage(hd.img, H.COL.idle * H.FW, 0, H.FW, H.FH, (w - H.WW * k) / 2, h - H.WH * k, H.WW * k, H.WH * k); G._hdDrawing = false; return c; };

// ---------------------------------------------------------------- moving previews
// Every heading is a body of its own: the same painter and the same eight directions the game draws (js/game/realbody.js).
const HEADINGS = [[0, 1, 'S'], [1, 1, 'SE'], [1, 0, 'E'], [1, -1, 'NE'], [0, -1, 'N'], [-1, -1, 'NW'], [-1, 0, 'W'], [-1, 1, 'SW']];
const spans = () => { const list = Object.entries(H.COL).sort((a, b) => a[1] - b[1]), out = {}; list.forEach(([k, c], i) => { out[k] = { col: c, n: (list[i + 1] ? list[i + 1][1] : H.NCOL || c + 1) - c }; }); return out; };
const anim = { hosts: new Set() }, sh2 = A.shade;
function stage(host, draw, cellW, cellH, cols) {
  const c = document.createElement('canvas'), rows = Math.ceil(HEADINGS.length / cols); c.width = cellW * cols; c.height = cellH * rows; c.className = 'animStage';
  host.append(c); const x = c.getContext('2d'), rec = { c, tick(t) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#23262b'; x.fillRect(0, 0, c.width, c.height); HEADINGS.forEach(([dx, dy, name], i) => { const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH; x.save(); x.beginPath(); x.rect(cx + 1, cy + 1, cellW - 2, cellH - 2); x.clip(); x.translate(cx + cellW / 2, cy + cellH - 12); draw(x, dx, dy, t); x.restore(); x.fillStyle = '#b8b2a4'; x.font = '9px sans-serif'; x.textAlign = 'left'; x.fillText(name, cx + 4, cy + 11); }); } };
  anim.hosts.add(rec); return rec;
}
setInterval(() => { const t = performance.now() / 1000; for (const r of anim.hosts) { if (!r.c.isConnected) anim.hosts.delete(r); else r.tick(t); } }, 50);
E.personStage = function (host, look, mode) {
  const sheet = A.character(look || {}), hd = H.get(sheet), S = spans(); if (!hd) return;
  const K = 2.2, sp = S[mode] || S.walk, fps = mode === 'run' ? 16 : 11;
  stage(host, (x, dx, dy, t) => { const dir = G.body.nearest(dx, dy), col = sp.col + Math.floor(t * fps) % sp.n; G.body.cur = { dir, face: 0 }; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(0, 0, 10, 4, 0, 0, 6.3); x.fill(); G._hdDrawing = true; x.drawImage(hd.img, col * H.FW, 0, H.FW, H.FH, -H.WW * K / 2, -H.WH * K + 2, H.WW * K, H.WH * K); G._hdDrawing = false; G.body.cur = null; }, 62, 88, 4);
};
E.animalStage = function (host, id) {
  const def = G.ANIMALS[id]; if (!def) return;
  const RA = G.realAnimal, s = RA.SP[id]; if (!s) { host.textContent = id; return; }
  const breed = Object.keys(RA.BREED[id] || {})[0], sp = RA.specOf(id, breed), K = Math.min(1.5, 56 / (sp.L + 18));
  stage(host, (x, dx, dy, t) => { const dir = G.body.nearest(dx, dy), f = Math.floor(t * 8) % 6, c = RA.paint(id, sp, sp.fur, sh2(sp.fur, 0.6), dir, 'walk', f, {}); x.imageSmoothingEnabled = true; x.drawImage(c, -c._ax * K, -c._ay * K, c.width / 3 * K, c.height / 3 * K); }, 96, 88, 4);
};
const modeSelect = (host, value, onchange) => { const s = document.createElement('select'); for (const k of Object.keys(H.COL)) { const o = document.createElement('option'); o.value = k; o.textContent = k; s.append(o); } s.value = value; s.onchange = () => onchange(s.value); host.append(s); return s; };
E.refreshPreview = function (d) {
  const pv = $('npcPreview'); if (!pv) return; pv.innerHTML = '';
  const make = (mode) => { const old = pv.querySelector('canvas'); if (old) old.remove(); this.personStage(pv, Object.assign({}, d.look), mode); };
  this.animMode = this.animMode || 'walk';
  modeSelect(pv, this.animMode, (v) => { this.animMode = v; make(v); });
  try { make(this.animMode); } catch (e) { pv.append(L('This look cannot be drawn: ', 'Esta aparência não pode ser desenhada: ') + e.message); }
};
E.animPreview = function () {
  this.modal('Animation Preview', [], null, '<p>People and animals as the game moves them, in all eight headings at their true proportions. </p><div id="animPick"></div><div id="animBox" class="preview"></div>');
  const pick = $('animPick'), box = $('animBox'), sel = document.createElement('select'), ids = Object.keys(G.ANIMALS).sort(); for (const id of ids) { const o = document.createElement('option'); o.value = id; o.textContent = G.ANIMALS[id].name || id; sel.append(o); } pick.append(sel);
  const show = () => { box.innerHTML = ''; try { this.animalStage(box, sel.value); } catch (e) { box.textContent = L('No animation: ', 'Sem animação: ') + e.message; } }; sel.onchange = show; show();
};

// ---------------------------------------------------------------- the world check: nothing dangling, nothing unreachable
const _check = E.check;
const L = (en, pt) => (window.EditorI18n && window.EditorI18n.on ? pt : en);
E.deepProblems = function () {
  const out = [];
  for (const id of Object.keys(this.maps)) {
    const m = this.maps[id], w = m.w, tiles = G.TILES;
    for (const k of m.missing || []) out.push(`${id}: ${L(`prop "${k}" no longer exists in the game and was left out`, `o objeto "${k}" não existe mais no jogo e foi deixado de fora`)}`);
    for (const d of m.decor) { const def = G.DECOR[d.type]; if (!def) { out.push(`${id}: ${L('unknown prop', 'objeto desconhecido')} "${d.type}" (${d.tx},${d.ty})`); continue; } if (!A.sprites[def.sprite]) out.push(`${id}: ${L(`prop "${d.type}" has no art`, `o objeto "${d.type}" não tem arte`)}`); if (d.tx < 0 || d.ty < 0 || d.tx >= m.w || d.ty >= m.h) out.push(`${id}: ${L(`prop "${d.type}" is outside the map`, `o objeto "${d.type}" está fora do mapa`)}`); }
    for (const i of new Set(m.ground)) if (!tiles[i]) out.push(`${id}: ${L(`tile ${i} does not exist`, `o tile ${i} não existe`)}`);
    const solid = (x, y) => { const t = tiles[m.ground[y * w + x]]; return !t || t.solid; };
    for (const b of m.buildings) {
      if (b.x < 0 || b.y < 0 || b.x + b.w > m.w || b.y + b.h > m.h) { out.push(`${id}: ${L(`building ${b.id} is outside the map`, `o prédio ${b.id} está fora do mapa`)}`); continue; }
      if (!(m.meta && m.meta.floorOf) && (!tiles[m.ground[b.doorY * w + b.doorX]] || (solid(b.doorX, b.doorY) && tiles[m.ground[b.doorY * w + b.doorX]].name !== 'door'))) out.push(`${id}: ${b.name || b.id} ${L('has no door at its door position', 'não tem porta na posição da porta')}`);
    }
    for (const name in m.points) for (const p of [].concat(m.points[name])) if (p && (p.x < 0 || p.y < 0 || p.x >= m.w || p.y >= m.h)) out.push(`${id}: ${L(`point ${name} is outside the map`, `o ponto ${name} está fora do mapa`)}`); else if (p && !(m.meta && m.meta.floorOf && /_door$/.test(name)) && solid(p.x, p.y) && tiles[m.ground[p.y * w + p.x]].name !== 'door') out.push(`${id}: ${L(`point ${name} is inside a wall`, `o ponto ${name} está dentro de uma parede`)}`);
    for (const e of m.exits) if (e.x + e.w > m.w || e.y + e.h > m.h || e.x < 0 || e.y < 0) out.push(`${id}: ${L('an exit lies outside the map', 'uma saída está fora do mapa')}`);
  }
  const items = Object.assign({}, G.ITEMS, this.items);
  for (const id in this.items) { const it = this.items[id]; try { if (it.icon && !A.icon(it.icon)) out.push(`item ${id}: ${L('icon', 'ícone')} "${it.icon}" ${L('is missing', 'não encontrado')}`); } catch (e) { out.push(`item ${id}: ${L('icon', 'ícone')} "${it.icon}" ${L('is missing', 'não encontrado')}`); } }
  for (const id in this.npcs) { const d = this.npcs[id]; try { H.get(A.character(Object.assign({}, d.look))); } catch (e) { out.push(`${id}: ${L('their look cannot be drawn', 'a aparência não pode ser desenhada')}`); } for (const [it] of d.inv || []) if (typeof it === 'string' && !items[it]) out.push(`${id}: ${L('carries unknown item', 'carrega um item desconhecido')} "${it}"`); }
  return out;
};
E.check = function () {
  const deep = this.deepProblems(), modal = this.modal; let done = false;
  this.modal = function (title, f, ok, html) { done = true; this.modal = modal; const extra = deep.length ? `<p>${deep.length} ${L('problem(s) with art and placement', 'problema(s) de arte e posição')}:</p><ul>${deep.slice(0, 60).map((p) => '<li>' + p.replace(/</g, '&lt;') + '</li>').join('')}</ul>` : '<p>All props, tiles and buildings match the current game.</p>'; return modal.call(this, title, f, ok, html + extra); };
  try { _check.call(this); } finally { if (!done) this.modal = modal; }
};
// the first look at a map takes a moment: say so before the work starts
const busy = (text, fn) => { let b = $('edBusy'); if (!b) { b = document.createElement('div'); b.id = 'edBusy'; b.style.cssText = 'position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);padding:14px 26px;background:#14161ae8;color:#f0ead8;font:15px sans-serif;border:1px solid #5a5e66;z-index:50'; document.body.append(b); } b.textContent = window.EditorI18n && window.EditorI18n.on ? 'Abrindo o mapa...' : text; b.style.display = 'block'; setTimeout(() => { try { fn(); } finally { b.style.display = 'none'; } }, 40); };
{ const ms = $('mapSelect'); if (ms) ms.onchange = () => { const id = ms.value; if (E.maps[id] && E.maps[id]._tm) E.openMap(id); else busy('Opening the map...', () => E.openMap(id)); }; }
// world size is shown in real tiles and metres, so distances mean something when building
G.realMat && G.realMat.ready;
const tick = () => { try { E.idle(); } catch (e) { console.error(e); } }; setInterval(tick, 300);
document.addEventListener('mousedown', () => { E.mouseDown = true; }, true); document.addEventListener('mouseup', () => { E.mouseDown = false; }, true);
})();
