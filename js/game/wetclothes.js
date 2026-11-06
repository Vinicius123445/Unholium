'use strict';
// Wet clothes. Only clothes get wet: skin, hair and fur do not. Each piece of clothing carries its own wetness, wherever it
// is. Worn in the rain it soaks through little by little; in the water it is soaked at once. It stays wet when you take it
// off, put it in a bag, drop it, sell it or loot it from a body, and it comes through a save and a reload.
//   A wet piece is its own item: `<clothing id>~wet<n>`, with its level in w.wetClothes.items[n]. G.item() gives it the
//   name of the dry one plus " (wet)", so every list in the game says so without being told, it does not stack, and when it
//   has dried the id goes back to the plain one. Worn by someone whose things are not items yet (most people on the street)
//   the level sits on them (st.wetWorn) and turns into a real piece the moment their clothes do.
//   Drying is by game time, so sleep and waiting count: it starts once the clothes are out of the rain, slow outdoors,
//   quicker indoors, quickest near a fire, a stove, a furnace or anything burning. Packed away it hardly dries at all.
//   The look: clothes alone go dark and heavy with a sheen and drips; each sheet gets a mask of its cloth pixels.
(() => {
const clamp = G.util.clamp, A = G.assets, GS = G.GameScene.prototype;
const MARK = '~wet';
const SLOTS = ['top', 'bottom', 'shoes', 'mask', 'hat', 'armor'];
const SOAK = 55;                                      // game minutes of steady rain to soak through
const DRY = { open: 360, indoors: 180, heat: 60, packed: 540, store: 240 };   // game minutes from soaked to dry
const SWEEP = 5;                                      // game minutes between passes over everything that is wet
const now = (w) => w.day * 1440 + w.minutes;
const reg = (w) => (w.wetClothes = w.wetClothes || { seq: 0, items: {}, t: now(w) });
const split = (id) => { const i = typeof id === 'string' ? id.indexOf(MARK) : -1; return i < 0 ? null : { base: id.slice(0, i), n: id.slice(i + MARK.length) }; };
const base = (id) => { const s = split(id); return s ? s.base : id; };
const wettable = (it) => !!it && (it.type === 'clothing' || (it.type === 'armor' && !/plate|chain|iron|steel/.test(`${it.icon} ${it.id}`)));   // (metal does not soak)

const W = G.wet = {
  DRY, SOAK, base, maskOf: (hd) => maskOf(hd),
  isWet: (id) => !!split(id),
  level(id, w = G.world) { const s = split(id), e = s && w && w.wetClothes && w.wetClothes.items[s.n]; return e ? e.l : 0; },
  wettable(id) { return wettable(G.item(base(id))); },
  // a new wet piece of this clothing; or more water on one that is already wet
  soak(id, amount, w = G.world) {
    const s = split(id), R = reg(w);
    if (s) { const e = R.items[s.n]; if (e) { e.l = clamp(e.l + amount, 0, 1); return id; } id = s.base; }
    if (!this.wettable(id) || !(amount > 0)) return id;
    const n = ++R.seq; R.items[n] = { l: clamp(amount, 0, 1) };
    return id + MARK + n;
  },
  // how wet someone's clothes are, 0..1 (the wettest thing they have on)
  worn(a) {
    if (!a || !G.world) return 0;
    let v = 0;
    if (a.kind === 'player') { for (const s of SLOTS) if (a.equip && a.equip[s]) v = Math.max(v, this.level(a.equip[s])); return v; }
    const st = a.st; if (!st) return 0;
    if (st.equip) for (const s of SLOTS) if (st.equip[s]) v = Math.max(v, this.level(st.equip[s]));
    if (st.wetWorn) for (const s in st.wetWorn) v = Math.max(v, st.wetWorn[s]);
    return v;
  },
  slotLevel(a, slot) {
    if (a.kind === 'player') return a.equip && a.equip[slot] ? this.level(a.equip[slot]) : 0;
    const st = a.st; if (!st) return 0;
    return Math.max(st.equip && st.equip[slot] ? this.level(st.equip[slot]) : 0, (st.wetWorn && st.wetWorn[slot]) || 0);
  },
  // water on what someone wears
  wetActor(a, amount, w) {
    if (a.kind === 'player') {
      let ch = false;
      for (const s of SLOTS) { const id = a.equip && a.equip[s]; if (!id || !this.wettable(id)) continue; const nid = this.soak(id, amount, w); if (nid !== id) { a.equip[s] = nid; ch = true; } }
      if (ch && a.refreshSprite) a.refreshSprite();
      return;
    }
    const st = a.st; if (!st) return;
    if (st.gearV2) { for (const s of SLOTS) { const id = st.equip && st.equip[s]; if (!id || !this.wettable(id)) continue; const nid = this.soak(id, amount, w); if (nid !== id) { const e = (st.inv || []).find((x) => x[0] === id); if (e) { if (e[1] > 1) { e[1]--; st.inv.push([nid, 1]); } else e[0] = nid; } st.equip[s] = nid; } } return; }
    const wet = st.wetWorn || (st.wetWorn = {});
    for (const s of ['top', 'bottom', 'shoes']) wet[s] = clamp((wet[s] || 0) + amount, 0, 1);
  },
  // clothes on the body while it rains or in the water: every frame
  step(a, dt, scene) {
    const m = scene.map, w = scene.world, wx = G.weather, rain = wx ? wx.rain : 0;
    if (a.swimming || (a.kind !== 'player' && m.isWaterAt && m.isWaterAt(a.x, a.y - 3))) { this.wetActor(a, 1, w); return; }
    if (this.inside(m, a) || a.vehicle || !(rain > 0.05)) return;
    this.wetActor(a, (G.clock ? G.clock.of(dt) : dt) * G.clock.REF * rain / SOAK, w);
  },
  inside(m, a) { return !!(m.meta.indoor || m.meta.floorOf || m.buildingAt(a.x, a.y - 3)); },
  // near something hot? (what the game already has: campfires, stoves, furnaces, forges, anything burning)
  heatNear(scene, x, y) {
    const m = scene.map, tx = Math.floor(x / 16), ty = Math.floor(y / 16), R = 3;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (scene.fire && scene.fire.isBurning && scene.fire.isBurning(tx + dx, ty + dy)) return true;
      for (const d of m.decorsAt(tx + dx, ty + dy)) if (d.def.interact === 'campfire' || d.def.interact === 'stove' || /^(campfire|stove|furnace|forge|brazier|fireplace)/.test(d.type) || /furnace|forge|brazier|hearth/.test(d.def.sprite || '')) return true;
    }
    return false;
  },
  // game minutes from soaked to dry for clothes in this place; 0: they are not drying
  rate(scene, a) {
    const m = scene.map, wx = G.weather, rain = wx ? wx.rain : 0, inside = this.inside(m, a);
    if (a.swimming) return 0;
    if (this.heatNear(scene, a.x, a.y)) return DRY.heat;
    if (inside || a.vehicle) return DRY.indoors;
    return rain > 0.05 ? 0 : DRY.open;
  },
  dryId(id, step, w) { const s = split(id), R = reg(w), e = s && R.items[s.n]; if (!e) return s ? s.base : id; e.l -= step; if (e.l > 0.001) return id; delete R.items[s.n]; return s.base; },
  // list rows [[id, n], ...] with wet pieces drying by `step`; a piece that is dry merges back
  dryList(list, step, w) {
    let ch = false;
    for (const e of list) { if (!split(e[0])) continue; const nid = this.dryId(e[0], step, w); if (nid !== e[0]) { e[0] = nid; ch = true; } }
    if (ch) for (let i = list.length - 1; i >= 0; i--) { const j = list.findIndex((q) => q[0] === list[i][0]); if (j !== i && j >= 0 && G.item(list[i][0]).stack > 1) { list[j][1] += list[i][1]; list.splice(i, 1); } }
  },
  // the sweep: every wet thing anywhere, by the game time that has passed
  sweep(scene, mins) {
    const w = scene.world, R = reg(w);
    if (!(mins > 0)) return;
    const live = new Set();
    const note = (id) => { const s = split(id); if (s) live.add(s.n); };
    const p = scene.player, rate = this.rate(scene, p), packed = mins / (rate ? Math.max(rate, DRY.packed) : DRY.packed), onYou = rate ? mins / rate : 0;
    // what you wear dries where you are; what is in your pockets dries slowly
    let look = false;
    for (const s of SLOTS) { const id = p.equip[s]; if (!id || !split(id)) continue; const nid = onYou ? this.dryId(id, onYou, w) : id; if (nid !== id) { p.equip[s] = nid; look = true; } note(p.equip[s]); }
    if (look && p.refreshSprite) p.refreshSprite();
    for (const sl of p.inventory.slots) if (sl && split(sl.id)) { sl.id = this.dryId(sl.id, packed, w); note(sl.id); }
    // people: those here dry where they stand, the rest as if indoors
    const person = (st, a) => {
      const r = a ? this.rate(scene, a) : DRY.indoors, st0 = r ? mins / r : 0;
      if (st.wetWorn) { for (const k in st.wetWorn) { st.wetWorn[k] -= st0; if (st.wetWorn[k] <= 0) delete st.wetWorn[k]; } if (!Object.keys(st.wetWorn).length) st.wetWorn = null; }
      if (st.equip) for (const k in st.equip) { const eid = st.equip[k]; if (!split(eid)) continue; const nid = st0 ? this.dryId(eid, st0, w) : eid; if (nid !== eid) { const e = (st.inv || []).find((x) => x[0] === eid); if (e) e[0] = nid; st.equip[k] = nid; } note(st.equip[k]); }
      if (st.inv) { const worn = st.equip ? Object.values(st.equip) : []; for (const e of st.inv) if (split(e[0]) && !worn.includes(e[0])) { e[0] = this.dryId(e[0], packed, w); } for (const e of st.inv) note(e[0]); }
    };
    const here = new Map(scene.actors.filter((a) => a.kind === 'npc').map((a) => [a.id, a]));
    for (const id in w.npcs) person(w.npcs[id], here.get(id));
    for (const a of scene.actors) if (a.kind === 'npc' && a.st && !w.npcs[a.id]) person(a.st, a);
    // what the police took: it dries in the evidence bag, and the record of it keeps up
    const seizedDone = new Set();
    if (w.jail && Array.isArray(w.jail.seized)) for (const e of w.jail.seized) {
      if (!split(e[0])) continue;
      const old = e[0], nid = this.dryId(old, mins / DRY.store, w); seizedDone.add(nid); note(nid);
      if (nid === old) continue;
      e[0] = nid; for (const id in w.containers) { const c = w.containers[id]; if (c.items) for (const q of c.items) if (q[0] === old) q[0] = nid; }
    }
    // containers, bodies, bags on the ground, shelves, the evidence locker
    for (const id in w.containers) {
      const c = w.containers[id]; if (!c.items) continue;
      if (!c.items.some((e) => split(e[0]) && !seizedDone.has(e[0]))) { for (const e of c.items) note(e[0]); continue; }
      const open = (c.kind === 'corpse' || c.kind === 'bag') && !c.carried, map = G.maps.cache[c.map], indoor = !map || map.meta.indoor || map.meta.floorOf || (c.x != null && map.buildingAt(c.x, c.y - 3));
      const raining = G.weather && G.weather.rain > 0.05;
      const per = open && !indoor ? (raining ? 0 : DRY.open) : DRY.store, step = per ? mins / per : 0, was = c.items.map((e) => e[0]);
      if (step) this.dryList(c.items, step, w);
      if (c.clothes) for (const k in c.clothes) { const i = was.indexOf(c.clothes[k]); if (i >= 0 && c.items[i]) c.clothes[k] = c.items[i][0]; else c.clothes[k] = split(c.clothes[k]) ? base(c.clothes[k]) : c.clothes[k]; }
      for (const e of c.items) note(e[0]);
    }
    for (const id in w.shops || {}) { const s = w.shops[id]; if (s.stock && s.stock.some((e) => split(e[0]))) { this.dryList(s.stock, mins / DRY.store, w); for (const e of s.stock) note(e[0]); } }
    // anything else that holds a wet piece (nobody here knows of it): it dries as if packed away
    for (const n in R.items) if (!live.has(n)) { R.items[n].l -= packed; if (R.items[n].l <= 0) delete R.items[n]; }
  },
};

// ---------------------------------------------------------------- the item: the dry one, plus "(wet)"
const _item = G.item, wetItems = new Map();
G.item = (id) => {
  const s = split(id);
  if (!s) return _item(id);
  const b = _item(s.base);
  if (!W.level(id)) return b;
  let it = wetItems.get(id);
  if (!it || it.src !== b) { it = Object.assign({}, b, { id, baseId: s.base, src: b, name: `${b.name} (wet)`, stack: 1, wetItem: true, value: b.value, desc: `${b.desc || ''} Soaked. It will dry with time, faster indoors or near a fire.`.trim() }); wetItems.set(id, it); }
  return it;
};
// asking for "a shirt" finds a wet one too (a shop job, a quest, a recipe), the dry ones first
const IP = G.Inventory.prototype, _count = IP.count, _remove = IP.remove;
IP.count = function (id) {
  let n = _count.call(this, id);
  if (!split(id)) for (const s of this.slots) if (s && s.id.startsWith(id + MARK)) n += s.qty;
  return n;
};
IP.remove = function (id, qty = 1) {
  if (split(id) || !G.world) return _remove.call(this, id, qty);
  const plain = _count.call(this, id);
  if (plain >= qty) return _remove.call(this, id, qty);
  if (this.count(id) < qty) return false;
  if (plain) { _remove.call(this, id, plain); qty -= plain; }
  for (let i = this.size - 1; i >= 0 && qty > 0; i--) { const s = this.slots[i]; if (s && s.id.startsWith(id + MARK)) { qty -= s.qty; this.slots[i] = null; } }
  return true;
};
// a piece whose wetness has gone stops being special wherever it turns up
const _add = IP.add;
IP.add = function (id, qty = 1) { if (split(id) && G.world && !W.level(id)) id = base(id); return _add.call(this, id, qty); };

// ---------------------------------------------------------------- someone's clothes becoming real items, and bodies
if (G.npcGear) {
  const NG = G.npcGear, _mat = NG.materialize;
  NG.materialize = function (npc) {
    const st = npc.st, had = st && !st.gearV2 && st.wetWorn;
    const r = _mat.apply(this, arguments);
    if (had && st.gearV2) { for (const s in had) { const id = st.equip[s]; if (!id || !W.wettable(id)) continue; const nid = W.soak(id, had[s]); const e = st.inv.find((x) => x[0] === id); if (e) e[0] = nid; st.equip[s] = nid; } st.wetWorn = null; }
    return r;
  };
}
const C = G.containers, _corpse = C.createCorpse;
C.createCorpse = function (world, npc, mapId) {
  const wet = npc.st && !npc.st.gearV2 && npc.st.wetWorn, before = new Set(Object.keys(world.containers));
  const r = _corpse.apply(this, arguments);
  if (wet) {
    const id = Object.keys(world.containers).find((k) => !before.has(k)), c = id && world.containers[id];
    if (c && c.clothes) for (const s in wet) { const cid = c.clothes[s], e = cid && c.items.find((x) => x[0] === cid); if (!e) continue; const nid = W.soak(cid, wet[s], world); e[0] = nid; c.clothes[s] = nid; }
    npc.st.wetWorn = null;
  }
  return r;
};

// ---------------------------------------------------------------- the clock
const _u = GS.update;
GS.update = function (dt) {
  const r = _u.call(this, dt), w = this.world;
  if (!w || !this.actors) return r;
  for (const a of this.actors) if (!a.dead && (a.kind === 'player' || (a.kind === 'npc' && !a.transient))) W.step(a, dt, this);
  // drips from what is soaked
  if (Math.random() < 0.3) for (const a of this.actors) { if (a.dead || !(a.kind === 'player' || a.kind === 'npc') || a.swimming) continue; const k = W.worn(a); if (k > 0.45 && Math.random() < dt * k * 12 && this.isOnScreen && this.isOnScreen(a.x, a.y)) this.particles(a.x + (Math.random() - 0.5) * 8, a.y - 4 - Math.random() * 12, '#b8cce0', 1); }
  const R = reg(w), t = now(w), mins = t - (R.t == null ? t : R.t);
  if (mins >= SWEEP) { R.t = t; W.sweep(this, mins); }
  else if (mins < 0) R.t = t;
  return r;
};

// ---------------------------------------------------------------- the look: cloth goes dark and heavy, nothing else
const near = (r, g, b, ramp) => ramp.some((c) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 34);
const rampOf = (hex) => { const c = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#808080', out = []; for (const f of [1.16, 1, 0.78, 0.6, 0.42, 0.85]) { const s = A.shade(c, f); out.push([1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))); } return out; };
const hexOf = (hex) => { if (!hex) return '#808080'; let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return '#' + h.slice(0, 6); };
// one mask per sheet and slot: the pixels that are that piece of cloth (finish() adds grain, so match by nearness)
const masks = new WeakMap();
let maskT = -1, maskN = 0;
const maskOf = (hd) => {
  let e = masks.get(hd); if (e) return e;
  if (maskT !== G.loop.time) { maskT = G.loop.time; maskN = 0; }
  if (maskN++ >= 1) return null;   // (one sheet a frame: a whole street walking into the rain does not stutter)
  const L = hd.L, c = hd.img, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, W0 = c.width, H0 = c.height;
  const skin = rampOf(hexOf(L.skin)), hair = rampOf(hexOf(L.hair));
  const sets = { top: rampOf(hexOf(L.top)).concat(rampOf(hexOf(L.top2))), bottom: rampOf(hexOf(L.pants)), shoes: rampOf(hexOf(L.shoes)) };
  e = {};
  for (const slot in sets) {
    const m = document.createElement('canvas'); m.width = W0; m.height = H0;
    const mx = m.getContext('2d'), img = mx.createImageData(W0, H0), o = img.data, ramp = sets[slot];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 120) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (!near(r, g, b, ramp) || near(r, g, b, skin) || near(r, g, b, hair)) continue;
      o[i] = 14; o[i + 1] = 22; o[i + 2] = 40; o[i + 3] = 255;
    }
    mx.putImageData(img, 0, 0);
    e[slot] = m;
  }
  masks.set(hd, e);
  return e;
};
const hashK = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
G.wetOverlay = (ctx, a, hd, col, dir, FW, FH, x0, y0, WW, WH) => {
  if (a.kind === 'animal' || !hd.L) return;
  const k = W.worn(a); if (!(k > 0.01)) return;
  const M = maskOf(hd); if (!M) return;
  ctx.save();
  for (const slot of ['top', 'bottom', 'shoes']) {
    const lv = W.slotLevel(a, slot); if (!(lv > 0.01)) continue;
    ctx.globalAlpha = 0.16 + lv * 0.4; ctx.drawImage(M[slot], col * FW, dir * FH, FW, FH, x0, y0, WW, WH);
  }
  ctx.restore();
  // water running down the cloth: a few bright beads on the top and legs only
  if (k > 0.3) {
    const t = Math.floor(G.loop.time * 3 + a.x), Y = (v) => y0 + WH * v, n = Math.round(2 + k * 4);
    ctx.fillStyle = `rgba(214,226,240,${(k * 0.42).toFixed(2)})`;
    for (let i = 0; i < n; i++) { const up = i % 2 === 0; ctx.fillRect(x0 + WW * (0.34 + 0.32 * hashK(i, t % 3)), up ? Y(0.36 + 0.26 * hashK(i, 7)) : Y(0.66 + 0.24 * hashK(i, 9)), 0.5, 1); }
  }
};
// the window chrome cuts long names: never the part that says it is wet
if (G.xp) { const X = G.xp, _fit = X.fit; X.fit = function (ctx, str, maxW, size = 8, weight = 'normal') { const s = G.i18n.t(String(str)), m = /^(.*)( \([^()]+\))$/.exec(s); if (!m || !/\(wet\)|\(molhad[oa]s?\)/.test(s) || G.ui.measure(ctx, s, size, weight) <= maxW) return _fit.apply(this, arguments); return _fit.call(this, ctx, m[1], maxW - G.ui.measure(ctx, m[2], size, weight), size, weight) + m[2]; }; }
})();
