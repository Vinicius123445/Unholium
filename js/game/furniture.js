'use strict';
// Furniture that faces the right way, more of it, and a little more room.
//   Orientation: chairs come in four directions (facing the table or desk they belong to), couches face
//   the TV (seen from behind when it is on the other side), toilets and armchairs turn to the room. The
//   pass runs over every map as it is built, so all existing furniture is turned too.
//   New pieces: computer desks (monitor, keyboard, tower) with office chairs, armchairs, coffee tables,
//   tall bookcases, lamp tables, standing fans. Houses get them through the room planner.
//   Room: homes, shops and offices grow by one row of floor (north) wherever the ground behind them is
//   open, so the rooms inside are a little bigger.
(() => {
const A = G.assets;
const mk = (w, h, fn) => { const { c, x } = A.mk(w, h); fn(x, (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px, py, pw, ph); }); if (A.outline) A.outline(c); return c; };
const ART = {
  // chairs: the default one faces down (you see the seat and the back above it)
  chair_up: [8, 11, (x, R) => { R(0, 3, 8, 2, '#8a5a2e'); R(0, 5, 1, 6, '#5b3a1e'); R(7, 5, 1, 6, '#5b3a1e'); R(1, 5, 6, 5, '#7a4f28'); R(1, 5, 6, 1, '#9a6a3a'); }],
  chair_left: [8, 11, (x, R) => { R(2, 5, 6, 2, '#8a5a2e'); R(6, 0, 2, 7, '#7a4f28'); R(2, 7, 1, 4, '#5b3a1e'); R(6, 7, 1, 4, '#5b3a1e'); }],
  chair_right: [8, 11, (x, R) => { R(0, 5, 6, 2, '#8a5a2e'); R(0, 0, 2, 7, '#7a4f28'); R(1, 7, 1, 4, '#5b3a1e'); R(5, 7, 1, 4, '#5b3a1e'); }],
  office_chair: [10, 13, (x, R) => { R(2, 0, 6, 6, '#2a2a30'); R(1, 6, 8, 3, '#3a3a44'); R(4, 9, 2, 2, '#5a5a62'); R(1, 11, 8, 1, '#5a5a62'); R(1, 12, 1, 1, '#1a1a1e'); R(8, 12, 1, 1, '#1a1a1e'); }],
  office_chair_up: [10, 13, (x, R) => { R(1, 3, 8, 3, '#3a3a44'); R(2, 5, 6, 6, '#2a2a30'); R(4, 11, 2, 1, '#5a5a62'); R(1, 12, 8, 1, '#5a5a62'); }],
  couch_up: [30, 16, (x, R) => { R(0, 6, 30, 9, '#4a5a7a'); R(0, 6, 30, 1, '#6a7a9a'); R(0, 2, 4, 12, '#4a5a7a'); R(26, 2, 4, 12, '#4a5a7a'); R(2, 4, 26, 3, '#6a7a9a'); }],
  armchair: [14, 15, (x, R) => { R(1, 0, 12, 6, '#8a4a3a'); R(0, 5, 14, 7, '#9a5a4a'); R(0, 3, 3, 10, '#7a3a2a'); R(11, 3, 3, 10, '#7a3a2a'); R(3, 7, 8, 1, '#b06a5a'); R(1, 13, 2, 2, '#3a2214'); R(11, 13, 2, 2, '#3a2214'); }],
  armchair_up: [14, 15, (x, R) => { R(0, 3, 14, 10, '#8a4a3a'); R(0, 3, 14, 1, '#a05a4a'); R(0, 2, 3, 11, '#7a3a2a'); R(11, 2, 3, 11, '#7a3a2a'); R(1, 13, 2, 2, '#3a2214'); R(11, 13, 2, 2, '#3a2214'); }],
  coffee_table: [22, 10, (x, R) => { R(0, 1, 22, 5, '#6a4024'); R(0, 1, 22, 1, '#8a5a34'); R(1, 6, 2, 4, '#4a2c16'); R(19, 6, 2, 4, '#4a2c16'); R(5, 2, 4, 2, '#d8d0c0'); R(14, 2, 3, 2, '#c84a3a'); }],
  bookcase: [16, 30, (x, R) => { R(0, 0, 16, 30, '#5a3a20'); for (let s = 0; s < 4; s++) { R(1, 2 + s * 7, 14, 5, '#2a1a10'); for (let b = 0; b < 6; b++) R(2 + b * 2, 3 + s * 7, 2, 4, ['#a83232', '#3a6aa8', '#e0c040', '#3a8a4a', '#8a5ac8', '#d8d0c0'][(b + s) % 6]); } }],
  lamp_table: [10, 16, (x, R) => { R(1, 10, 8, 3, '#6a4024'); R(2, 13, 1, 3, '#4a2c16'); R(7, 13, 1, 3, '#4a2c16'); R(4, 6, 2, 4, '#3a3a40'); R(1, 0, 8, 6, '#f0e0b0'); R(1, 0, 8, 1, '#fff4d0'); }],
  fan: [12, 22, (x, R) => { R(5, 8, 2, 12, '#5a5a62'); R(2, 20, 8, 2, '#3a3a40'); x.fillStyle = '#c8ccd4'; x.beginPath(); x.arc(6, 5, 5, 0, Math.PI * 2); x.fill(); R(5, 4, 2, 2, '#5a5a62'); }],
  desk_pc: [30, 22, (x, R) => { R(0, 10, 30, 4, '#7a5a3a'); R(0, 10, 30, 1, '#9a7a4a'); R(1, 14, 3, 8, '#5a3a20'); R(26, 14, 3, 8, '#5a3a20'); R(9, 0, 12, 8, '#1e1e22'); R(10, 1, 10, 6, '#3a7ad8'); R(11, 2, 3, 2, '#9ad0ff'); R(14, 8, 2, 2, '#2a2a30'); R(8, 11, 13, 2, '#2a2a30'); R(23, 3, 5, 7, '#2a2a30'); R(24, 4, 1, 1, '#5ae08a'); R(4, 11, 3, 2, '#d8d0c0'); }],
};
const _init = A.init;
A.init = function () { _init.call(this); for (const id in ART) { const [w, h, fn] = ART[id]; A.sprites['f_' + id] = { img: mk(w, h, fn), ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
const WOOD = { fuel: 10, flam: 0.5, burnsTo: 'char_pile' };
Object.assign(G.DECOR, {
  chair_up: Object.assign({ sprite: 'f_chair_up', solid: false, interact: 'sit', faceDir: 3, breakHp: 5, owned: true }, WOOD),
  chair_left: Object.assign({ sprite: 'f_chair_left', solid: false, interact: 'sit', faceDir: 1, breakHp: 5, owned: true }, WOOD),
  chair_right: Object.assign({ sprite: 'f_chair_right', solid: false, interact: 'sit', faceDir: 2, breakHp: 5, owned: true }, WOOD),
  office_chair: { sprite: 'f_office_chair', solid: false, interact: 'sit', faceDir: 0, fuel: 6, flam: 0.4, burnsTo: 'char_pile' },
  office_chair_up: { sprite: 'f_office_chair_up', solid: false, interact: 'sit', faceDir: 3, fuel: 6, flam: 0.4, burnsTo: 'char_pile' },
  couch_up: { sprite: 'f_couch_up', solid: true, fw: 2, interact: 'sit', faceDir: 3, fuel: 16, flam: 0.7, breakHp: 15, burnsTo: 'char_pile' },
  armchair: { sprite: 'f_armchair', solid: true, interact: 'sit', faceDir: 0, fuel: 12, flam: 0.7, burnsTo: 'char_pile' },
  armchair_up: { sprite: 'f_armchair_up', solid: true, interact: 'sit', faceDir: 3, fuel: 12, flam: 0.7, burnsTo: 'char_pile' },
  coffee_table: Object.assign({ sprite: 'f_coffee_table', solid: true, fw: 2, interact: 'look', owned: true }, WOOD),
  bookcase: Object.assign({ sprite: 'f_bookcase', solid: true, interact: 'read', owned: true }, WOOD),
  lamp_table: Object.assign({ sprite: 'f_lamp_table', solid: true, light: { r: 34, color: '255,220,160' } }, WOOD),
  fan: { sprite: 'f_fan', solid: true, interact: 'look' },
  desk_pc: Object.assign({ sprite: 'f_desk_pc', solid: true, fw: 2, interact: 'computer', owned: true }, WOOD),
});

// ---------------------------------------------------------------- turn things to face what they belong to
const TABLES = /^(table|desk|desk_pc|kcounter|counter|bj_table|pooltable|roulette|round_table|coffee_table)$/;
const inB = (b, x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1;
G.furniture = {
  orient(m) {
    const at = (x, y) => (m.decorsAt ? m.decorsAt(x, y) : m.decor.filter((d) => d.ty === y && x >= d.tx && x < d.tx + (d.def.fw || 1)));
    const nearTable = (x, y) => {
      for (const [dx, dy, face] of [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']]) if (at(x + dx, y + dy).some((d) => TABLES.test(d.type))) return face;
      return null;
    };
    for (const d of m.decor.slice()) {
      if (d.type === 'chair') {
        const f = nearTable(d.tx, d.ty);
        const t = f === 'up' ? 'chair_up' : f === 'left' ? 'chair_left' : f === 'right' ? 'chair_right' : null;
        if (t) { d.type = t; d.def = G.DECOR[t]; }
      } else if (d.type === 'office_chair' && nearTable(d.tx, d.ty) === 'up') { d.type = 'office_chair_up'; d.def = G.DECOR.office_chair_up; }
      else if (d.type === 'couch' || d.type === 'armchair') {
        // face the TV in the same room: if it is above them, they are seen from behind
        const b = m.buildings.find((bb) => inB(bb, d.tx, d.ty)); if (!b) continue;
        const tv = m.decor.find((o) => o.type === 'tv' && inB(b, o.tx, o.ty));
        if (tv && tv.ty < d.ty - 1) { const t = d.type === 'couch' ? 'couch_up' : 'armchair_up'; d.type = t; d.def = G.DECOR[t]; }
      }
    }
  },
};
const _fin = G.TileMap.prototype.finalize;
G.TileMap.prototype.finalize = function () { try { G.furniture.orient(this); } catch (e) { G.reportError && G.reportError(e); } return _fin.call(this); };
// sitting on a turned chair turns you the same way
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  const r = _use.call(this, d, scene);
  const p = scene.player;
  if (d.def.interact === 'sit' && d.def.faceDir != null && p.sitting) { p.sitting.dir = d.def.faceDir; p.dir = d.def.faceDir; }
  return r;
};

// ---------------------------------------------------------------- a little more room
const TM = G.TileMap.prototype, _add = TM.addBuilding;
const OPEN = () => new Set([G.T.grass, G.T.darkgrass, G.T.dirt, G.T.sand, G.T.lot, G.T.ash, G.T.darksand].filter((t) => t != null));
TM.addBuilding = function (id, x, y, w, h, opts = {}) {
  const kind = opts.kind || 'house';
  if (!this.finalized && ['rural', 'city', 'suburbs', 'southside', 'eastside', 'heights'].includes(this.id) && opts.grow !== false && ['house', 'shop', 'inn', 'office', 'mansion'].includes(kind) && y >= 3) {
    // grow north by a row when that row (and one more beyond it) is open ground, nothing built, no props
    const open = OPEN(); let ok = true;
    for (let xx = x - 1; xx <= x + w && ok; xx++) for (const yy of [y - 1, y - 2]) {
      if (!this.inBounds(xx, yy) || !open.has(this.get(xx, yy)) || (this._occupied && this._occupied[yy * this.w + xx]) || this.decor.some((d) => d.tx === xx && d.ty === yy)) ok = false;
    }
    if (ok) { y -= 1; h += 1; }
  }
  return _add.call(this, id, x, y, w, h, opts);
};
})();
// You cannot press your face into a building's front wall: a little room is kept between your feet and the
// facade (except at the door), so you do not seem to walk into the windows and signs painted on it.
(() => {
const keepOff = (_move, band) => function (map, dx, dy, slide) {
  const r = _move.call(this, map, dx, dy, slide);
  if (dy < 0 && map && map.buildings && !this.dead) {
    const tx = Math.floor(this.x / 16), ty = Math.floor((this.y - 1) / 16);
    for (const b of map.buildings) {
      if (b.destroyed || ty !== b.y + b.h || tx < b.x || tx >= b.x + b.w || Math.abs(this.x - (b.doorX * 16 + 8)) < 10) continue;
      const min = ty * 16 + band;
      if (this.y < min) this.y = min;
    }
  }
  return r;
};
G.Player.prototype.move = keepOff(G.Player.prototype.move, 12);   // (people too: theirs a little less, so the
G.NPC.prototype.move = keepOff(G.NPC.prototype.move, 10);         //  sidewalk right under a wall stays walkable)
})();
