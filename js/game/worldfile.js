'use strict';
// Custom worlds made with the World Editor (WorldEditor.exe, editor/ folder).
//   A world is a folder: worlds/<name>/world.json (NPCs, items, which maps changed) and
//   worlds/<name>/maps/<map id>.json (every tile, prop, building, point and exit of a map).
//   The desktop game serves the worlds folder at https://worlds.local/ and lists them in New Game.
//   A game started in a custom world remembers it (world.flags.customWorld); loading that save uses the
//   same world again. Maps the world does not include stay as the game generates them.
// Shared with the editor: serializeMap / deserializeMap / serializeNPCs.
(() => {
const SKIP_MAP = new Set(['solid', 'swimmable', 'groundCanvas', 'groundCtx', 'decorAt', 'pathCost', 'minimap', 'lights', 'decor', 'flats', 'windowAt', 'chestAt', 'ground', 'residents', 'finalized', '_occupied', 'roofSigns', 'needSpots', '_walls', '_wallsN', '_fences', 'live', 'landOverlay', 'shore', 'scorchCanvas', '_needBlend', 'modN', 'waterMix']);
const SKIP_B = new Set(['frontCanvas', '_front', 'replanned', 'roofCanvas', '_burnt', 'roofAlpha', 'smoke', 'doorOpen', 'destroyed', 'gutted', 'lit']);
const clean = (v) => JSON.parse(JSON.stringify(v, (k, x) => {
  if (typeof x === 'function') return undefined;
  if (x && typeof x === 'object' && (x.getContext || (typeof HTMLImageElement !== 'undefined' && x instanceof HTMLImageElement))) return undefined;
  if (ArrayBuffer.isView(x)) return Array.from(x);
  return x;
}));
// run-length encoding of the ground: "tile,count;tile,count;..."
const rle = (arr) => { const out = []; let prev = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === prev) n++; else { out.push(prev + ',' + n); prev = arr[i]; n = 1; } } out.push(prev + ',' + n); return out.join(';'); };
const unrle = (s, len, map) => { const a = new Uint8Array(len); let i = 0; for (const part of s.split(';')) { const [t, n] = part.split(',').map(Number); a.fill(map[t] != null ? map[t] : 1, i, i + n); i += n; } return a; };

G.worldFile = {
  serializeMap(m) {
    const out = {};
    for (const k of Object.keys(m)) if (!SKIP_MAP.has(k)) out[k] = m[k];
    out.buildings = m.buildings.map((b) => { const o = {}; for (const k of Object.keys(b)) if (!SKIP_B.has(k)) o[k] = b[k]; return o; });
    const data = clean(out);
    data.tiles = G.TILES.map((t) => t.name);
    data.ground = rle(m.ground);
    data.decor = m.decor.concat(m.flats).filter((d) => !d.removed).map((d) => {
      const extra = {};
      for (const k of Object.keys(d)) if (!['type', 'def', 'tx', 'ty', 'x', 'y', 'light', 'hits', 'primed', 'leak', 'byPlayer', 'wallOf', 'auto'].includes(k)) extra[k] = d[k];
      // hung on a wall or set off its tile: the offset from where the tile would put it, so it survives being moved in the editor
      const ox = d.x - (d.tx * 16 + (d.def.fw || 1) * 8), oy = d.y - (d.ty * 16 + 15); if (ox) extra.ox = ox; if (oy) extra.oy = oy;
      if (d.wallOf) extra.wall = d.wallOf.id;
      return Object.keys(extra).length ? [d.type, d.tx, d.ty, clean(extra)] : [d.type, d.tx, d.ty];
    });
    data.format = 2;
    return data;
  },
  // A map saved before the world doubled (format 1, no "scaled") is laid out again as a plan and brought up to size, here and in the
  // editor alike. Its parked cars and beds take their plan footprints while it is read.
  deserializeMap(data) {
    G.parkedPlan(!data.scaled);
    const m = new G.TileMap(data.id, data.w, data.h);
    const tmap = (data.tiles || []).map((name) => (G.T[name] != null ? G.T[name] : 1));
    m.ground = unrle(data.ground, data.w * data.h, tmap);
    for (const k of Object.keys(data)) if (!['tiles', 'ground', 'decor', 'format', 'id', 'w', 'h'].includes(k)) m[k] = G.util.clone(data[k]);
    for (const b of m.buildings) { b.roofAlpha = 1; b.windows = b.windows || []; }
    for (const [type, tx, ty, extra] of data.decor || []) {
      if (!G.DECOR[type]) continue;
      const { ox, oy, wall, ...rest } = extra || {}, d = m.addDecor(type, tx, ty, rest);
      if (ox) d.x += ox; if (oy) d.y += oy; if (d.light && (ox || oy)) { d.light.x += ox || 0; d.light.y += oy || 0; }
      const b = wall && m.building(wall); if (b) { d.wallOf = b; (m.roofSigns = m.roofSigns || []).push(d); }
    }
    m.finalize();
    if (data.scaled) { m.scaled = true; G.parkedPlan(false); return m; }
    try { G.expandMap(m); m.computeSolids(); m.finalized = false; m.finalize(); } finally { G.parkedPlan(false); }
    return m;
  },
  // ...and the people of such a world: a schedule can name a bare tile
  upgradeWorld(w) {
    if ((w.format || 1) >= 2) return w;
    for (const id in w.npcs || {}) for (const e of w.npcs[id].schedule || []) if (e.at && typeof e.at === 'object' && !e.at.real) { e.at.x *= G.WORLD_SCALE; e.at.y *= G.WORLD_SCALE; e.at.real = true; }
    w.format = 2; return w;
  },
  serializeNPCs(ids) { const out = {}; for (const id of ids || Object.keys(G.NPCS)) out[id] = clean(G.NPCS[id]); return out; },

  // ---------------------------------------------------------------- the game side
  ORIG: null,
  cache: {},
  remember() { if (!this.ORIG) this.ORIG = { MAPGEN: Object.assign({}, G.MAPGEN), NPCS: Object.assign({}, G.NPCS), ITEMS: Object.assign({}, G.ITEMS) }; },
  base: 'https://worlds.local/',
  async list() {
    try { const r = await fetch(this.base + 'index.json', { cache: 'no-store' }); if (!r.ok) return []; const j = await r.json(); return (j.worlds || []).filter(Boolean); } catch (e) { return []; }
  },
  async fetchWorld(name) {
    if (this.cache[name]) return this.cache[name];
    const root = this.base + encodeURIComponent(name) + '/';
    const world = this.upgradeWorld(await (await fetch(root + 'world.json', { cache: 'no-store' })).json());
    const maps = {};
    for (const id of world.maps || []) { try { maps[id] = await (await fetch(root + 'maps/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })).json(); } catch (e) { G.reportError && G.reportError(e); } }
    return (this.cache[name] = { name, world, maps });
  },
  async preload() { for (const n of await this.list()) { try { await this.fetchWorld(n); } catch (e) { /* a broken world folder is skipped */ } } },
  // switch the running game to a world (null: the default one)
  activate(name) {
    this.remember();
    // back to the default world first
    for (const k of Object.keys(G.MAPGEN)) if (!this.ORIG.MAPGEN[k]) delete G.MAPGEN[k];
    Object.assign(G.MAPGEN, this.ORIG.MAPGEN);
    for (const k of Object.keys(G.NPCS)) if (!this.ORIG.NPCS[k]) delete G.NPCS[k];
    Object.assign(G.NPCS, this.ORIG.NPCS);
    for (const k of Object.keys(G.ITEMS)) if (!this.ORIG.ITEMS[k]) delete G.ITEMS[k];
    Object.assign(G.ITEMS, this.ORIG.ITEMS);
    this.active = null;
    G.maps.reset();
    if (!name) return true;
    const W = this.cache[name];
    if (!W) return false;
    for (const id in W.maps) { const data = W.maps[id]; G.MAPGEN[id] = () => this.deserializeMap(data); }
    for (const id of W.world.deletedNpcs || []) delete G.NPCS[id];
    for (const id in W.world.npcs || {}) { const d = G.util.clone(W.world.npcs[id]); d.id = id; d.relations = d.relations || {}; d.look = d.look || G.look(id); d.gender = d.look.body === 'f' ? 'female' : 'male'; d.schedule = d.schedule || []; G.NPCS[id] = d; }
    for (const id in W.world.items || {}) G.ITEMS[id] = Object.assign({ id, stack: 1, value: 1, desc: '' }, W.world.items[id]);
    this.active = name;
    return true;
  },
  pending: null,
};
// the default world is snapshotted once every script has run (activate() also does it lazily): taken here,
// any later file that adds maps or people (the hospital and its staff, js/game/ems.js) was undone on New Game
document.addEventListener('DOMContentLoaded', () => G.worldFile.remember());
// a GameScene starts in the right world: the chosen one for a new game, the save's one when loading
const Base = G.GameScene;
class WorldGameScene extends Base {
  constructor(opts = {}) {
    const want = opts.save ? (opts.save.world && opts.save.world.flags && opts.save.world.flags.customWorld) || null : G.worldFile.pending;
    if (want !== G.worldFile.active) {
      if (!G.worldFile.activate(want)) G.worldFile.activate(null);
    }
    super(opts);
    if (!opts.save && G.worldFile.active) { this.world.flags.customWorld = G.worldFile.active; }
    if (want && G.worldFile.active !== want) this.toast(`The world "${want}" could not be loaded. Playing the default world.`, 'bad');
  }
}
G.GameScene = WorldGameScene;
// New Game: pick a world when there are custom ones
if (G.desktop) G.worldFile.preload().then(() => {
  const q = new URLSearchParams(location.search).get('world');   // WorldEditor's "Play" button
  if (q && G.worldFile.cache[q]) { G.worldFile.pending = q; G.scenes.replace(new G.CharacterCreatorScene()); }
});
const MS = G.MenuScene.prototype, _build = MS.build;
MS.build = function () {
  _build.call(this);
  const names = Object.keys(G.worldFile.cache);
  const ng = this.items.find((i) => i.label === 'New Game');
  if (ng && names.length) ng.act = () => G.scenes.push(new G.ChoiceScene('Which world?', 'Worlds made in the World Editor are in the worlds folder.', [
    { label: 'The default world', fn: () => { G.worldFile.pending = null; G.scenes.replace(new G.CharacterCreatorScene()); } },
    ...names.map((n) => ({ label: n, fn: () => { G.worldFile.pending = n; G.scenes.replace(new G.CharacterCreatorScene()); } })),
  ]));
};
})();

// ---------------------------------------------------------------- dialogues and shops written in the editor
// A dialogue from the World Editor is plain data: nodes { text, common, choices: [{ text, next, ...}] }.
// A choice can require things (ifFlag, ifNotFlag, ifItem, ifGold, ifRep: [faction, n]) and do things
// (setFlag, give: [item, n], take: [item, n], gold (you get), pay (you pay; failNext if you cannot),
// rep: [faction, n], heal, shop, hostile, startQuest, log). This turns that into the game's dialogue form.
G.dialogueData = {
  compile(src) {
    const out = {};
    for (const id in src || {}) {
      const n = src[id] || {};
      out[id] = {
        text: n.text || '...', common: !!n.common,
        choices: (n.choices || []).map((ch) => {
          const o = { text: ch.text || '...', next: ch.next || null };
          const reqs = [];
          if (ch.ifFlag) reqs.push((c) => !!c.flag(ch.ifFlag));
          if (ch.ifNotFlag) reqs.push((c) => !c.flag(ch.ifNotFlag));
          if (ch.ifItem) reqs.push((c) => c.has(ch.ifItem, ch.ifItemN || 1));
          if (ch.ifGold) reqs.push((c) => c.gold() >= ch.ifGold);
          if (ch.ifRep && ch.ifRep[0]) reqs.push((c) => c.rep(ch.ifRep[0]) >= (ch.ifRep[1] || 0));
          if (reqs.length) o.if = (c) => reqs.every((f) => f(c));
          const acts = ch.setFlag || ch.give || ch.take || ch.gold || ch.pay || ch.rep || ch.heal || ch.shop || ch.hostile || ch.startQuest || ch.log;
          if (acts) o.do = (c) => {
            if (ch.pay) { if (!c.pay(ch.pay)) return ch.failNext || null; }
            if (ch.setFlag) c.set(ch.setFlag);
            if (ch.give && ch.give[0]) c.give(ch.give[0], ch.give[1] || 1);
            if (ch.take && ch.take[0]) c.take(ch.take[0], ch.take[1] || 1);
            if (ch.gold) c.giveGold(ch.gold);
            if (ch.rep && ch.rep[0]) c.addRep(ch.rep[0], ch.rep[1] || 0);
            if (ch.heal) c.heal(ch.heal);
            if (ch.startQuest) c.startQuest(ch.startQuest);
            if (ch.log) c.log(ch.log);
            if (ch.shop) c.openShop();
            if (ch.hostile) c.hostile(false);
            return undefined;
          };
          return o;
        }),
      };
      if (!out[id].choices.length) out[id].choices = [{ text: 'Goodbye.', next: null }];
    }
    if (!out.start) out.start = { text: '...', choices: [{ text: 'Goodbye.', next: null }] };
    return out;
  },
};
(() => {
  const WF = G.worldFile, _act = WF.activate.bind(WF);
  // (the snapshot is taken after every script has run, so these two join it then)
  const _rem = WF.remember;
  WF.remember = function () { const first = !this.ORIG; _rem.call(this); if (first) { this.ORIG.DIALOGUES = Object.assign({}, G.DIALOGUES); this.ORIG.SHOPS = {}; for (const id in G.SHOPS) this.ORIG.SHOPS[id] = G.util.clone(G.SHOPS[id]); } };
  WF.activate = function (name) {
    this.remember();
    for (const k of Object.keys(G.DIALOGUES)) if (!this.ORIG.DIALOGUES[k]) delete G.DIALOGUES[k];
    Object.assign(G.DIALOGUES, this.ORIG.DIALOGUES);
    for (const id in this.ORIG.SHOPS) G.SHOPS[id] = G.util.clone(this.ORIG.SHOPS[id]);
    const ok = _act(name);
    const W = name && this.cache[name];
    if (ok && W) {
      for (const id in W.world.dialogues || {}) G.DIALOGUES[id] = G.dialogueData.compile(W.world.dialogues[id]);
      for (const id in W.world.shops || {}) G.SHOPS[id] = Object.assign({}, G.SHOPS[id] || {}, W.world.shops[id]);
    }
    return ok;
  };
})();
// a person can have a fixed real name (set in the editor; the game otherwise makes one up)
(() => {
  const WP = G.World.prototype, _fresh = WP.freshNpcState;
  WP.freshNpcState = function (id) { const st = _fresh.apply(this, arguments), d = G.NPCS[id]; if (d && d.realName) st.realName = d.realName; return st; };
})();
