'use strict';
// Everything you can rummage through is a real container now, with the same loot window as chests and
// bodies: fridges and coolers, kitchen cabinets, nightstands, wardrobes, crates, barrels, trash cans,
// dumpsters, mailboxes and the gloveboxes of cars. What is inside is rolled the first time you open it and
// then it stays (you can put things in, take them later); fridges, trash and mail fill up again over time.
// Owned things are still theft if anyone sees you take them (the loot window reports it on close).
// Furniture that already IS a chest (a dresser, a wardrobe with its own drawer) just opens that chest.
//
// Also: a new game starts with nothing in your pockets. What you used to start with is in the drawer of
// the dresser in your bedroom (only the clothes you are wearing come with you).
(() => {
const T = {
  fridge: [['sandwich', 0.5], ['beer', 0.5], ['milk', 0.4], ['cheese', 0.35], ['apple', 0.4], ['soda', 0.4], ['raw_meat', 0.25], ['canned_beans', 0.15]],
  cooler: [['soda', 0.7], ['beer', 0.6], ['milk', 0.3], ['sandwich', 0.3]],
  kcounter: [['canned_beans', 0.5], ['chips', 0.4], ['bread', 0.35], ['coffee', 0.3], ['soda', 0.2], ['kitchen_knife', 0.15]],
  nightstand: [['cigarettes', 0.3], ['condom', 0.25], ['painkillers', 0.25], ['torch', 0.2], ['book', 0.2], ['letter', 0.15], ['wallet', 0.08], ['jewelry', 0.05]],
  wardrobe: [['cigarettes', 0.1], ['jewelry', 0.08]],
  crate: [['wood', 0.35], ['iron_ore', 0.3], ['beer', 0.15], ['canned_beans', 0.2], ['torch', 0.1], ['oil_flask', 0.1]],
  trash: [['chips', 0.3], ['soda', 0.3], ['canned_beans', 0.2], ['iron_ore', 0.25], ['cigarettes', 0.15], ['smartphone', 0.04], ['wallet', 0.04], ['beer', 0.1]],
  mail: [['letter', 0.6], ['wallet', 0.1]],
  glovebox: [['cigarettes', 0.4], ['wallet', 0.2], ['smartphone', 0.1], ['flashlight', 0.15], ['ammo_9mm', 0.1], ['painkillers', 0.1], ['torch', 0.2]],
  police: [['ammo_9mm', 1], ['shotgun', 0.25], ['police_baton', 0.5], ['first_aid_kit', 0.5]],
};
const KIND = (d) => {
  const ext = G.lootables && G.lootables.extraKind && G.lootables.extraKind(d); if (ext) return ext;   // (kinds added by other modules: prison lockers...)
  const k = d.def.interact, t = d.type;
  if (k === 'fridge') return t === 'cooler' ? ['cooler', 'Cooler', 2] : ['fridge', 'Fridge', 3];
  if (k === 'trash') return ['trash', 'Trash can', 1];
  if (k === 'dumpster') return ['trash', 'Dumpster', 1];
  if (k === 'mail') return ['mail', 'Mailbox', 1];
  if (k === 'car') return [t === 'police_car' ? 'police' : 'glovebox', t === 'police_car' ? 'Police car' : 'Glovebox', null];
  if (k === 'search') {
    if (t === 'kcounter') return ['kcounter', 'Kitchen cabinet', 5];
    if (t === 'nightstand') return ['nightstand', 'Nightstand', null];
    if (t === 'wardrobe') return ['wardrobe', 'Wardrobe', null];
    return ['crate', t === 'barrel' ? 'Barrel' : 'Crate', null];
  }
  return null;
};
const roll = (table) => table.filter(([id, p]) => (G.ITEMS[id] || G.item(id)) && G.rng.chance(p)).map(([id]) => [id, 1]);
const clothes = () => {
  if (!G.clothId || !G.CLOTH_STYLES) return [];
  const out = [];
  for (const slot of ['top', 'bottom', 'shoes']) if (G.rng.chance(0.55)) {
    const styles = G.CLOTH_STYLES[slot]; if (!styles) continue;
    const style = Array.isArray(styles) ? G.rng.pick(styles) : G.rng.pick(Object.keys(styles));
    try { out.push([G.clothId(slot, typeof style === 'string' ? style : style.id, G.rng.pick(['#3a4a6a', '#8a3a3a', '#2a2a30', '#d8d0c0', '#5a7a4a'])), 1]); } catch (e) { /* unknown style */ }
  }
  return out;
};
const fill = (c, kind) => {
  const items = kind === 'wardrobe' ? clothes().concat(roll(T.wardrobe)) : roll(T[kind] || []);
  for (const [id, n] of items) { const e = c.items.find((x) => x[0] === id); if (e) e[1] += n; else if (c.items.length < 10) c.items.push([id, n]); }
  if (kind === 'mail' && G.rng.chance(0.2)) c.gold += G.rng.int(5, 25);
  if (kind === 'glovebox' && G.rng.chance(0.5)) c.gold += G.rng.int(3, 30);
  if (kind === 'wardrobe' && G.rng.chance(0.25)) c.gold += G.rng.int(5, 40);
};

G.lootables = {
  T,
  kind: KIND,
  // the container behind this piece of furniture (made, filled and topped up as needed)
  forDecor(scene, d) {
    const w = scene.world, m = scene.map, k = KIND(d); if (!k) return null;
    // it is already a chest (a dresser, a drawer): that one
    const real = G.containers.forMap(w, m.id).find((c) => c.kind === 'chest' && !c.fixture && Math.floor(c.x / 16) === d.tx && Math.abs(Math.floor(c.y / 16) - d.ty) <= 1);
    if (real) return real;
    const id = `fx_${m.id}_${d.tx}_${d.ty}`;
    let c = w.containers[id];
    if (!c) {
      c = w.containers[id] = { id, map: m.id, kind: 'chest', fixture: true, name: k[1], owner: G.usables.owner(scene, d), x: d.tx * 16 + 8, y: d.ty * 16 + 14, items: [], gold: 0, day: w.day, fillDay: w.day };
      fill(c, k[0]);
    } else if (k[2] && w.day - (c.fillDay || 0) >= k[2]) {   // fridges, trash and mail fill up again
      c.fillDay = w.day; fill(c, k[0]);
    }
    c.owner = G.usables.owner(scene, d);
    return c;
  },
  open(scene, d) {
    const c = this.forDecor(scene, d); if (!c) return false;
    G.scenes.push(new G.LootScene(scene, c));
    return true;
  },
};
// fixtures are opened through their furniture, not drawn or offered as chests of their own
const _forMap = G.containers.forMap;
G.containers.forMap = function (world, mapId) { return _forMap.call(this, world, mapId).filter((c) => !c.fixture); };
G.containers.forMapAll = _forMap;

const U = G.usables, _use = U.use, _label = U.label;
U.use = function (d, scene) {
  const k = d.def.interact, p = scene.player, w = scene.world;
  if (!KIND(d)) return _use.call(this, d, scene);
  if (k === 'dumpster' && p.dragging) return _use.call(this, d, scene);   // hiding a body
  // a parked car: the car's own menu (drive it, hotwire it, or search the glovebox, which comes back here)
  if (k === 'car' && G.vehicles && G.vehicles.MODELS[d.type] && !scene._gloveOnly) { G.vehicles.menu(scene, G.vehicles.fromDecor(scene, d), d); return; }
  scene._gloveOnly = false;
  if (k === 'car') {
    // breaking in comes first (the alarm, the crowbar, the crime); after that it is just a glovebox
    const c0 = w.containers[`fx_${scene.map.id}_${d.tx}_${d.ty}`];
    if (!c0 || !c0.brokenInto) {
      const police = d.type === 'police_car', owner = this.owner(scene, d);
      if (police && !p.inventory.has('crowbar')) { scene.toast('Locked tight. You would need a crowbar.', 'bad'); return; }
      G.audio.play('hit');
      if (G.rng.chance(police ? 1 : 0.3)) { G.audio.play('alarm'); scene.toast('The car alarm goes off!', 'bad'); for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 160) { a.sleeping = false; } }
      scene.reportCrime('theft', null, police ? 80 : 20, owner && owner !== 'player' ? owner : null);
      G.lootables.forDecor(scene, d).brokenInto = true;
    }
  }
  G.lootables.open(scene, d);
};
U.label = function (d, scene) {
  const k = KIND(d);
  if (d.def.interact === 'car' && G.vehicles && G.vehicles.MODELS[d.type]) return G.vehicles.MODELS[d.type].moto ? 'Motorcycle (steal or search)' : 'Car (steal or search)';
  if (k && !(d.def.interact === 'dumpster' && scene.player.dragging) && !(d.def.interact === 'car' && !((scene.world.containers[`fx_${scene.map.id}_${d.tx}_${d.ty}`] || {}).brokenInto))) return `Open the ${k[1].toLowerCase()}`;
  return _label.call(this, d, scene);
};

// ---------------------------------------------------------------- a new game: empty pockets, a stocked drawer
const GS = G.GameScene.prototype, _load = GS.loadMap;
G.ITEMS.own_wallet = { id: 'own_wallet', name: 'Wallet', type: 'misc', icon: 'wallet', value: 0, stack: 1, desc: 'Your wallet: your ID, a bank card, a receipt you keep meaning to throw away. (Your cash is counted on its own.)' };
const POCKETS = [['phone', 1], ['own_wallet', 1]];   // a new character starts with these on them
const START = [['baseball_bat', 1], ['sandwich', 2], ['bandage', 2], ['apple', 2], ['torch', 1], ['cigarettes', 3], ['beer', 1]];
GS.loadMap = function (id, spawnName, pos) {
  const r = _load.apply(this, arguments);
  const w = this.world;
  if (w && w.flags.startStashPending && w.flags.player_home && this.map.building(w.flags.player_home)) {
    w.flags.startStashPending = false;
    if (this.player) for (const [it, n] of POCKETS) if (!this.player.inventory.has(it)) this.player.inventory.add(it, n);
    G.containers.ensureChests(w, this.map);
    const drawer = w.containers[this.map.id + ':' + w.flags.player_home + '_chest'] || w.containers[w.flags.player_home + '_chest'] || Object.values(w.containers).find((c) => c.map === this.map.id && c.kind === 'chest' && c.owner === 'player');
    if (drawer) {
      drawer.owner = 'player';
      for (const [it, n] of START) { const e = drawer.items.find((x) => x[0] === it); if (e) e[1] += n; else drawer.items.push([it, n]); }
      this.refreshContainers();
    }
  }
  return r;
};
// (the pockets themselves are emptied in js/scenes/game.js: a new character gets only the clothes on their back)
})();
