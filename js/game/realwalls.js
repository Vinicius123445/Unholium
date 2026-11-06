'use strict';
// Inside walls with height, and building at this scale.
// Any wall with floor on its south side shows a face 48 pixels tall, in depth order with people: furniture and whoever stands south of it
// are in front, the room north of it is partly behind. So a wall lowers when you are in the room behind it, the way a doll's house
// opens up. Openings are 40 pixels tall under a lintel. Faces belong to the interior: they appear as the roof lifts.
// Building: hold and drag to lay a whole line of wall, or a rectangle of floor, with a preview and a count of what it takes.
(() => {
const RD = 3, H = 48, OPEN = 40, A = G.assets, sh = A.shade, TM = G.TileMap.prototype, GS = G.GameScene.prototype;
if (G.LANG_PT && G.LANG_PT.s) Object.assign(G.LANG_PT.s, { 'Pieces placed': 'Peças colocadas', 'Pieces removed': 'Peças removidas', 'Hold and drag to lay a line  ·  right drag erases': 'Segure e arraste para fazer uma linha  ·  botão direito apaga', '[R] turns it': '[R] gira a peça', 'Pieces needed': 'Peças necessárias', 'you have': 'você tem', 'Starter shack: 32 wooden walls, 36 wood floors, a door': 'Casinha inicial: 32 paredes de madeira, 36 pisos de madeira, uma porta' });
const lin = (x, a, b, c, d, st) => { const g = x.createLinearGradient(a, b, c, d); st.forEach((s, i) => g.addColorStop(i / (st.length - 1), s)); return g; };
const isWall = (m, x, y) => { const t = G.TILES[m.get(x, y)]; return !!(t && t.wall && t.solid); };
const isOpening = (m, x, y) => m.get(x, y) === G.T.door || m.decorsAt(x, y).some((d) => d.type === 'doorway');
function compute(m) {
  const out = [];
  for (let y = 1; y < m.h - 1; y++) {
    let run = null;
    for (let x = 0; x <= m.w; x++) {
      const inside = x < m.w, b = inside ? m.buildingAtTile(x, y) : null, front = false;
      const openBelow = (q) => !isWall(m, q, y + 1) && !(G.TILES[m.get(q, y + 1)] || {}).solid, belowOpen = inside && openBelow(x), plain = (q) => q >= 0 && q < m.w && isWall(m, q, y) && openBelow(q);
      // a corner, or a wall joining this one from the south, has wall under it and not floor: the face still runs across it
      const face = inside && !front && isWall(m, x, y) && (belowOpen || plain(x - 1) || plain(x + 1)), gap = inside && !front && belowOpen && isOpening(m, x, y) && (isWall(m, x - 1, y) || isWall(m, x + 1, y));
      if ((face || gap) && run && run.b === b) { run.x1 = x; if (gap) run.gaps.push(x); }
      else { if (run) out.push(run); run = face || gap ? { y, x0: x, x1: x, b, gaps: gap ? [x] : [], a: 0, key: y * 16 + 14.5, street: !!(b && y === b.y + b.h - 1) } : null; }
    }
  }
  return out;
}
function paint(m, r) {
  const W = (r.x1 - r.x0 + 1) * 16, c = document.createElement('canvas'); c.width = W * RD; c.height = H * RD; const x = c.getContext('2d'); x.scale(RD, RD); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  let tx = r.x0; while (tx <= r.x1 && !isWall(m, tx, r.y)) tx++; const tex = (G.TILES[m.get(tx, r.y)] || {}).tex;
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, W, H);
  // the clean middle of the material: a wall tile's own top and foot would repeat as stripes up a tall wall
  if (tex) for (let yy = H - 8, j = 0; yy > -8; yy -= 8, j++) for (let xx = 0, i = 0; xx < W; xx += 16, i++) { const t = A.tile(tex, G.util.hash2(r.x0 + i, r.y + j, 5)); if (t) x.drawImage(t, 0, t.height * 0.25, t.width, t.height * 0.5, xx, yy, 16, 8); const d = G.realMat && G.realMat.ready && G.realMat.detail(tex, G.util.hash2(i, j, 7)); if (d) { x.globalCompositeOperation = 'overlay'; x.drawImage(d, 0, d.height * 0.25, d.width, d.height * 0.5, xx, yy, 16, 8); x.globalCompositeOperation = 'source-over'; } }
  x.fillStyle = lin(x, 0, 0, 0, H, ['rgba(255,245,230,0.06)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.2)']); x.fillRect(0, 0, W, H);
  x.fillStyle = lin(x, 0, 0, 0, 3.4, ['#c4bfb2', '#8c887c']); x.fillRect(0, 0, W, 3.4); x.fillStyle = 'rgba(0,0,0,0.34)'; x.fillRect(0, 3.4, W, 1.2);   // the top of the wall
  x.fillStyle = lin(x, 0, H - 5, 0, H, ['#5a4634', '#3a2c20']); x.fillRect(0, H - 5, W, 5); x.fillStyle = 'rgba(255,240,220,0.16)'; x.fillRect(0, H - 5, W, 0.6);   // the skirting
  for (const g of r.gaps) {
    const a = (g - r.x0) * 16, top = H - OPEN;
    x.clearRect(a + 1, top, 14, OPEN);
    x.fillStyle = lin(x, a, 0, a + 2, 0, ['#8a6442', '#5a3e28']); x.fillRect(a - 1, top - 1, 2.6, OPEN + 1); x.fillStyle = lin(x, a + 14, 0, a + 17, 0, ['#5a3e28', '#7a5838']); x.fillRect(a + 14.4, top - 1, 2.6, OPEN + 1); x.fillStyle = '#7e5a3a'; x.fillRect(a - 1, top - 2.4, 18, 2.6); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(a + 1.6, top + 0.2, 12.8, 1);
  }
  return c;
}
// Fences stand up. They were pictures on the ground; now each tile of one is a piece at its real height, in depth order with everyone
// (the wooden one to the waist, iron railings and chain link above a person's head), and collision stays on the tile.
const FENCE = { fence: { h: 26, post: '#6a4a2e', rail: '#8a6240' }, chainlink: { h: 44, post: '#6e7278', rail: '#9aa0a8' }, ironfence: { h: 38, post: '#1e2024', rail: '#2e3034' }, hedge: { h: 24, post: '#1e4a22', rail: '#2e6a2c' } };
const fenceArt = {};
// a clipped hedge: a wall of leaves, lit along its top, dark at the foot
function hedgePiece(k, h, v, n) {
  const H0 = FENCE.hedge.h, base = H0 + 14, c = document.createElement('canvas'); c.width = 16 * 4; c.height = (H0 + 16) * 4; const x = c.getContext('2d'); x.scale(4, 4);
  let s = (n + 1) * 7919 + (h ? 31 : 0) + (v ? 57 : 0); const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }, X0 = h ? -1 : 1.4, X1 = h ? 17 : 14.6;
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(Math.max(0, X0), base - 1, Math.min(16, X1) - Math.max(0, X0), 1.8);
  x.fillStyle = lin(x, 0, base - H0, 0, base, ['#3e7c34', '#245a26', '#12301a']); x.beginPath(); x.moveTo(X0, base); x.lineTo(X0, base - H0 + 2); x.quadraticCurveTo(X0, base - H0, X0 + 2, base - H0); x.lineTo(X1 - 2, base - H0); x.quadraticCurveTo(X1, base - H0, X1, base - H0 + 2); x.lineTo(X1, base); x.closePath(); x.fill();
  for (let i = 0; i < 190; i++) { const a = X0 + r() * (X1 - X0), b = base - H0 + r() * H0, t = (b - base + H0) / H0, l = r(); x.fillStyle = l < 0.3 - t * 0.2 ? '#7ab454' : l < 0.62 - t * 0.3 ? '#4a8c3a' : l < 0.86 ? '#2a642a' : '#123018'; x.beginPath(); x.ellipse(a, b, 0.7 + r() * 0.6, 0.45 + r() * 0.4, r() * 3, 0, 6.3); x.fill(); }
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; x.fillRect(Math.max(0, X0), base - H0 - 1, Math.min(16, X1) - Math.max(0, X0), H0 + 2);
  return (fenceArt[k] = { c, h: H0 });
}
function fencePiece(tex, h, v, n = 0) {
  const k = tex + (h ? 'h' : '') + (v ? 'v' : '') + (tex === 'hedge' ? n : ''); if (fenceArt[k]) return fenceArt[k];
  if (tex === 'hedge') return hedgePiece(k, h, v, n);
  const f = FENCE[tex], c = document.createElement('canvas'); c.width = 16 * 4; c.height = (f.h + 16) * 4; const x = c.getContext('2d'); x.scale(4, 4); const H0 = f.h, base = H0 + 14, sh2 = (y, n) => { x.fillStyle = 'rgba(0,0,0,0.26)'; x.fillRect(y, base - 0.6, n, 1.4); };
  const post = (a, top) => { x.fillStyle = lin(x, a, 0, a + 2.6, 0, [sh(f.post, 1.3), f.post, sh(f.post, 0.6)]); x.fillRect(a, top, 2.6, base - top); x.fillStyle = sh(f.post, 1.4); x.fillRect(a, top, 2.6, 0.7); };
  if (h) {
    sh2(0, 16);
    if (tex === 'fence') { for (const y of [base - H0 + 6, base - H0 + 15]) { x.fillStyle = lin(x, 0, y, 0, y + 2.4, [sh(f.rail, 1.2), sh(f.rail, 0.72)]); x.fillRect(0, y, 16, 2.4); } for (let a = 2.6; a < 14; a += 4.4) { x.fillStyle = lin(x, a, 0, a + 2.8, 0, [sh(f.rail, 1.16), sh(f.rail, 0.8)]); x.fillRect(a, base - H0 + 2, 2.8, H0 - 3); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(a + 2.8, base - H0 + 2, 0.4, H0 - 3); } }
    else if (tex === 'chainlink') { x.strokeStyle = 'rgba(170,178,186,0.75)'; x.lineWidth = 0.22; for (let i = -40; i < 44; i += 2.4) { x.beginPath(); x.moveTo(i, base - H0 + 2); x.lineTo(i + H0, base); x.moveTo(i + H0, base - H0 + 2); x.lineTo(i, base); x.stroke(); } x.fillStyle = '#9aa0a8'; x.fillRect(0, base - H0 + 1, 16, 1.2); }
    else { x.fillStyle = f.rail; x.fillRect(0, base - H0 + 5, 16, 1.4); x.fillRect(0, base - 8, 16, 1.4); for (let a = 1.2; a < 16; a += 3.2) { x.fillRect(a, base - H0 + 2, 1, H0 - 2); x.beginPath(); x.moveTo(a - 0.5, base - H0 + 2); x.lineTo(a + 0.5, base - H0); x.lineTo(a + 1.5, base - H0 + 2); x.closePath(); x.fill(); } }
    post(0, base - H0);
  }
  if (v) { sh2(5, 6); const a = 6.7; x.fillStyle = lin(x, a - 1, 0, a + 3.6, 0, [sh(f.rail, 1.1), sh(f.rail, 0.7)]); x.fillRect(a - 0.8, base - H0 + 1, 4.2, H0 - 1 - 2); post(a - 0.2, base - H0 - 1); }
  if (!h && !v) { sh2(5, 6); post(6.7, base - H0); }
  return (fenceArt[k] = { c, h: f.h });
}
function fencesOf(m) {
  const out = [], is = (x, y, tex) => { const t = m.inBounds(x, y) && G.TILES[m.get(x, y)]; return !!t && t.tex === tex; };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const t = G.TILES[m.ground[y * m.w + x]]; if (!t || !FENCE[t.tex]) continue; out.push({ fence: true, x0: x, x1: x, y, tex: t.tex, h: is(x - 1, y, t.tex) || is(x + 1, y, t.tex), v: is(x, y - 1, t.tex) || is(x, y + 1, t.tex), a: 1, key: y * 16 + 14 }); }
  return out;
}
let leafC = null;
const leaf = () => { if (leafC) return leafC; const c = leafC = document.createElement('canvas'); c.width = 14 * RD; c.height = OPEN * RD; const x = c.getContext('2d'); x.scale(RD, RD); x.fillStyle = lin(x, 0, 0, 14, 0, ['#8a5e3a', '#6e4628', '#4e301c']); x.fillRect(0, 0, 14, OPEN); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.4; for (const [a, b, e, f] of [[2.4, 3, 9.2, 12], [2.4, 18, 9.2, 18]]) { x.fillStyle = 'rgba(255,235,210,0.07)'; x.fillRect(a, b, e, f); x.strokeRect(a, b, e, f); } x.fillStyle = '#d8c070'; x.beginPath(); x.arc(2, 20, 0.8, 0, 6.3); x.fill(); return c; };
const runsOf = (m) => { const n = (m.modN || 0) + m.buildings.length * 100000; if (!m._walls || m._wallsN !== n) { const old = m._walls; m._walls = compute(m); m._fences = fencesOf(m); m._wallsN = n; if (old) for (const r of m._walls) { const q = old.find((o) => o.y === r.y && o.x0 === r.x0); if (q) r.a = q.a; } } return m._walls; };
G.realWalls = {
  runs(m, view, p) {
    const out = []; if (!m.buildings || (m.meta && m.meta.wilds)) return out;
    const roomless = m.meta && (m.meta.indoor || m.meta.floorOf);
    for (const r of runsOf(m)) {
      const bot = (r.y + 1) * 16; if (r.x0 * 16 > view.x + view.w || (r.x1 + 1) * 16 < view.x || bot < view.y || bot - H > view.y + view.h + 8) continue;
      const b = r.b; if (b && (b.destroyed || b.gutted)) continue;
      let want = roomless || !b ? 1 : 1 - (b.roofAlpha == null ? 1 : b.roofAlpha);
      if (r.street) want *= 0.46;   // the front wall seen from inside: there, at full height, with its door, but you see through it
      else if (p && p.x > r.x0 * 16 - 10 && p.x < (r.x1 + 1) * 16 + 10 && p.y < bot - 8 && p.y > bot - H - 26) want *= 0.26;   // you are in the room behind it
      r.a += (want - r.a) * 0.2; if (r.a < 0.02) continue;
      out.push(r);
    }
    for (const r of m._fences || []) { if (r.x0 * 16 > view.x + view.w + 8 || (r.x0 + 1) * 16 < view.x - 8 || (r.y + 1) * 16 < view.y || r.y * 16 - 44 > view.y + view.h) continue; out.push(r); }
    return out;
  },
  // how far this door stands open, moving toward what it should be
  doorStep(r, g) {
    const s = r.doors || (r.doors = {}), sc = G.scenes && G.scenes.stack.find((q) => q instanceof G.GameScene), cx = g * 16 + 8, cy = r.y * 16 + 12, was = s[g] || 0;
    const near = !!sc && sc.actors.some((a) => (a.kind === 'npc' || a.kind === 'player') && !a.dead && Math.abs(a.x - cx) < 16 && Math.abs(a.y - cy) < 30);
    if (near && was < 0.02 && sc.player && Math.hypot(sc.player.x - cx, sc.player.y - cy) < 110) G.audio.play('door', { x: cx, y: cy });
    return (s[g] = was + ((near ? 1 : 0) - was) * 0.16);
  },
  draw(ctx, m, r) {
    if (r.fence) { const p = fencePiece(r.tex, r.h, r.v, (r.x0 + r.y) % 3), was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(p.c, r.x0 * 16, (r.y + 1) * 16 - 2 - (p.h + 14), 16, p.h + 16); ctx.imageSmoothingEnabled = was; return; }
    if (!r.c) r.c = paint(m, r);
    const W = (r.x1 - r.x0 + 1) * 16, was = ctx.imageSmoothingEnabled, a0 = ctx.globalAlpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = a0 * r.a;
    ctx.drawImage(r.c, r.x0 * 16, (r.y + 1) * 16 - H, W, H);
    // the street door from inside: solid, full height, and it swings like the one you see from outside
    if (r.street && r.b) for (const g of r.gaps) { if (g !== r.b.doorX) continue; const o = r.b.doorOpen || 0, X = g * 16, Y = (r.y + 1) * 16 - OPEN, w = Math.max(2.4, 14 * (1 - o * 0.86)); ctx.globalAlpha = a0 * Math.min(1, r.a * 2.2); ctx.drawImage(leaf(), X + 1, Y, w, OPEN); }
    // the doors between rooms: a real door in the frame, that swings when someone walks up to it and shuts behind them
    if (!r.street) for (const g of r.gaps) {
      const o = this.doorStep(r, g), X = g * 16, Y = (r.y + 1) * 16 - OPEN, w = Math.max(2.4, 14 * (1 - o * 0.86));
      ctx.globalAlpha = a0 * Math.min(1, r.a * 2.2); ctx.drawImage(leaf(), X + 1, Y, w, OPEN);
    }
    ctx.imageSmoothingEnabled = was; ctx.globalAlpha = a0;
  },
  H,
};
// ---------------------------------------------------------------- building
const K = G.home, I = G.input;
// [R] turns a piece to its real side or diagonal view. Long pieces change type (their footprint changes with them); the rest keep their
// type and remember an orientation in the build record, so they come back that way.
const CHAINS = [['chair', 'chair_right', 'chair_up', 'chair_left'], ['couch', 'couch_r', 'couch_up', 'couch_l'], ['table', 'table_v'], ['desk', 'desk_r', 'desk_l']];
const ORIS = [null, 'r', 'l', 'up', 'dl', 'dr'];
const variant = (scene, pc) => {
  const base = pc.place.decor, n = scene.buildTurn || 0; if (!base || !G.DECOR[base]) return { type: base, ori: null };
  const ch = CHAINS.find((c) => c[0] === base); if (ch) { const t = ch[n % ch.length]; return { type: G.DECOR[t] ? t : base, ori: null }; }
  const sp = G.DECOR[base].sprite, b0 = sp.replace(/^f_/, ''), has = ORIS.filter((o) => !o || G.realFurn.ART[sp + '_' + o] || G.realFurn.ART['f_' + b0 + '_' + o]);
  return { type: base, ori: has[n % has.length] };
};
const swapped = (pc, type, fn) => { const was = pc.place; pc.place = Object.assign({}, was, { decor: type }); try { return fn(); } finally { pc.place = was; } };
const _why = K.why, _place = K.place;
K.why = function (scene, id, tx, ty) {
  const pc = G.BUILD_PIECES[id]; if (!pc || !pc.place.decor || !scene.buildMode) return _why.apply(this, arguments);
  const args = arguments; return swapped(pc, variant(scene, pc).type, () => _why.apply(this, args));
};
K.place = function (scene, id, tx, ty) {
  const pc = G.BUILD_PIECES[id], map = scene.map, built = K.built(scene.world, map.id), key = tx + ',' + ty, old = built[key];
  // a door goes straight into a wall you built, and the wall piece comes back to you
  if (id === 'kit_door' && old && old.tile && (G.TILES[map.get(tx, ty)] || {}).wall) {
    const p = scene.player; if (!p.inventory.has('hammer') && p.equip.weapon !== 'hammer') return 'You need a hammer to build.';
    K.take(p, id, 1); K.give(p, old.id, 1); built[key] = { id, tile: true, under: old.under }; G.mods.tile(map, tx, ty, G.T.door); G.audio.play('craft'); return '';
  }
  if (!pc || !pc.place.decor || !scene.buildMode) return _place.apply(this, arguments);
  const v = variant(scene, pc), args = arguments, why = swapped(pc, v.type, () => _place.apply(this, args));
  if (!why && v.ori) { if (built[key]) built[key].ori = v.ori; for (const d of map.decorsAt(tx, ty)) if (d.tx === tx && d.ty === ty) d.ori = v.ori; }
  return why;
};
const _load = GS.loadMap;
GS.loadMap = function (id) { const r = _load.apply(this, arguments), b = K.built(this.world, id); for (const k in b) if (b[k] && b[k].ori) { const [x, y] = k.split(',').map(Number); for (const d of this.map.decorsAt(x, y)) if (d.tx === x && d.ty === y) d.ori = b[k].ori; } return r; };
const pieceOf = (s) => { const list = K.pieces(s.world), id = list[G.util.clamp(s.buildSel || 0, 0, list.length - 1)]; return id ? { id, pc: G.BUILD_PIECES[id] } : null; };
// walls and doors run in a straight line from where you pressed; floors fill the rectangle
const cellsOf = (a, b, tile) => {
  const out = [];
  if (/wall|door|fence/.test(tile)) { const dx = Math.abs(b.tx - a.tx), dy = Math.abs(b.ty - a.ty), n = Math.max(dx, dy), sx = Math.sign(b.tx - a.tx), sy = Math.sign(b.ty - a.ty); for (let i = 0; i <= n; i++) out.push(dx >= dy ? [a.tx + sx * i, a.ty] : [a.tx, a.ty + sy * i]); }
  else for (let y = Math.min(a.ty, b.ty); y <= Math.max(a.ty, b.ty); y++) for (let x = Math.min(a.tx, b.tx); x <= Math.max(a.tx, b.tx); x++) out.push([x, y]);
  return out;
};
const lay = (scene, id, cells) => { let n = 0, why = ''; for (const [x, y] of cells) { const w = K.place(scene, id, x, y); if (w) why = why || w; else n++; if (w && /nothing|have no|You do not/i.test(w)) break; } return { n, why }; };
G.buildKit = { cellsOf, lay, variant };
const _gu = GS.update;
GS.update = function (dt) {
  const m = I.mouse;
  if (!this.buildMode || G.scenes.top() !== this || !this.player) { this._drag = null; return _gu.call(this, dt); }
  const cur = pieceOf(this);
  if (cur && cur.pc.place.decor && I.pressed.has('KeyR')) { I.pressed.delete('KeyR'); this.buildTurn = (this.buildTurn || 0) + 1; this.buildRot = 0; G.audio.play('select'); }
  if (!cur || !cur.pc.place.tile) { this._drag = null; return _gu.call(this, dt); }
  const t = K.target(this), onBar = K.overBar(this), wasPressed = m.pressed, wasR = m.rpressed;
  if (wasPressed && !onBar && !this._drag) this._drag = { a: t, b: t, id: cur.id, tile: cur.pc.place.tile };
  if (wasR && !onBar && !this._drag) this._drag = { a: t, b: t, id: cur.id, tile: cur.pc.place.tile, erase: true };
  else if (wasR && this._drag && !this._drag.erase) { this._drag = null; m.rpressed = false; }   // right button during a drag: never mind
  if (this._drag) { this._drag.b = t; m.pressed = false; m.rpressed = false; }
  let r; try { r = _gu.call(this, dt); } finally { m.pressed = wasPressed; m.rpressed = wasR; }
  const d = this._drag;
  if (d && d.erase) { if (!m.rdown) { this._drag = null; let n = 0; for (const [x, y] of cellsOf(d.a, d.b, d.tile)) if (K.built(this.world, this.map.id)[x + ',' + y] && !K.remove(this, x, y)) n++; if (n > 1) this.toast(`${G.i18n.t('Pieces removed')}: ${n}`, 'info'); } }
  else if (d && !m.down) { this._drag = null; const res = lay(this, d.id, cellsOf(d.a, d.b, d.tile)); if (res.n > 1) this.toast(`${G.i18n.t('Pieces placed')}: ${res.n}`, 'good'); else if (!res.n && res.why) { this.toast(res.why, 'bad'); G.audio.play('error'); } }
  return r;
};
const _rn = GS.render;
GS.render = function (ctx) {
  _rn.call(this, ctx);
  if (!this.buildMode || !this.player) return;
  const cur = pieceOf(this); if (!cur || K.overBar(this)) return;
  if (!cur.pc.place.tile) { G.renderer.uiTransform(); G.ui.text(ctx, G.i18n.t('[R] turns it'), G.renderer.uiW / 2, G.renderer.uiH - 62, { size: 8, align: 'center', color: '#e8f0d8', shadow: true }); return; }
  const d = this._drag, t = K.target(this), tile = cur.pc.place.tile, cells = d ? cellsOf(d.a, d.b, d.tile) : [[t.tx, t.ty]], def = G.TILES[G.T[tile]], img = def && def.tex && A.tile(def.tex, 0), tall = /wall/.test(tile), R = G.renderer;
  R.worldTransform();
  for (const [x, y] of cells) {
    const ok = !K.why(this, cur.id, x, y); ctx.globalAlpha = 0.6;
    if (img) { ctx.drawImage(img, x * 16, y * 16); if (tall) for (const j of [1, 2]) ctx.drawImage(img, x * 16, (y - j) * 16); }
    ctx.globalAlpha = 1; ctx.strokeStyle = ok ? 'rgba(120,255,140,0.9)' : 'rgba(255,90,90,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(x * 16 + 0.5, (y - (tall ? 2 : 0)) * 16 + 0.5, 15, tall ? 47 : 15);
  }
  R.uiTransform(); const have = K.inv(this.world)[cur.id] || 0, U = G.ui;
  const text = d && !d.erase ? `${G.i18n.t('Pieces needed')}: ${cells.length}  (${G.i18n.t('you have')} ${have})` : G.i18n.t('Hold and drag to lay a line  ·  right drag erases');
  U.text(ctx, text, R.uiW / 2, R.uiH - 62, { size: 8, align: 'center', color: d && !d.erase && cells.length > have ? '#ff9a8a' : '#e8f0d8', shadow: true });
};
})();
