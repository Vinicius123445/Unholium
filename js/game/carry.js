'use strict';
// Things that hold things: wallets, purses, backpacks, duffel bags, briefcases, lunchboxes, toolboxes.
//   Each one has its own contents, made up the first time you open it to fit what it is (a wallet has
//   cash, cards and a photo; a duffel bag might have clothes, cash or something illegal; a toolbox has
//   tools). Open it from the inventory (use it): take what you want, the rest stays inside.
//   Opened ones keep what is left in them (they become "(opened)" so they do not stack with new ones).
//   People carry them too (they show up in their pockets and in drawers and trunks).
(() => {
const A = G.assets;
const NEW_ITEMS = {
  purse: { name: 'Purse', type: 'misc', icon: 'c_purse', value: 25, desc: 'Somebody\'s purse. Open it to see what is inside.' },
  backpack: { name: 'Backpack', type: 'misc', icon: 'c_backpack', value: 20, desc: 'A school or hiking backpack. Open it.' },
  duffel_bag: { name: 'Duffel Bag', type: 'misc', icon: 'c_duffel', value: 15, desc: 'A heavy duffel bag. Open it.' },
  briefcase: { name: 'Briefcase', type: 'misc', icon: 'c_briefcase', value: 45, desc: 'A leather briefcase. Open it.' },
  lunchbox: { name: 'Lunchbox', type: 'misc', icon: 'c_lunchbox', value: 5, desc: 'Somebody packed a lunch. Open it.' },
  toolbox_kit: { name: 'Toolbox', type: 'misc', icon: 'c_toolbox', value: 30, desc: 'A metal toolbox. Open it.' },
  id_card: { name: 'ID Card', type: 'misc', icon: 'c_card', value: 2, desc: 'Somebody\'s ID. Name, photo, address.' },
  credit_card: { name: 'Credit Card', type: 'misc', icon: 'c_card2', value: 15, desc: 'Stolen plastic. A fence might pay for it.' },
  photo: { name: 'Photo', type: 'misc', icon: 'letter', value: 1, desc: 'A worn photo of people smiling at a camera.' },
  lottery_ticket: { name: 'Lottery Ticket', type: 'misc', icon: 'letter', value: 2, desc: 'Scratched. Not a winner.' },
  lipstick: { name: 'Lipstick', type: 'misc', icon: 'c_lipstick', value: 4, desc: 'A tube of red lipstick.' },
  gum: { name: 'Chewing Gum', type: 'consumable', icon: 'candy', value: 1, stack: 20, food: 1, desc: 'Mint. Freshens your breath, fools your stomach for a second.' },
  documents: { name: 'Documents', type: 'misc', icon: 'letter', value: 10, desc: 'Contracts and memos. Someone might want these back.' },
  duct_tape: { name: 'Duct Tape', type: 'material', icon: 'c_tape', value: 4, stack: 5, desc: 'Fixes everything.' },
  hammer: { name: 'Hammer', type: 'weapon', icon: 'c_hammer', dmg: 7, cat: 'blunt', value: 12, desc: 'A claw hammer.' },
  screwdriver: { name: 'Screwdriver', type: 'weapon', icon: 'c_screwdriver', dmg: 5, value: 6, desc: 'A flat-head screwdriver.' },
};
for (const id in NEW_ITEMS) if (!G.ITEMS[id]) G.ITEMS[id] = Object.assign({ id, stack: 1 }, NEW_ITEMS[id]);

// what is inside, by kind: [item, chance, [min, max]]; cash: [min, max]
const KINDS = {
  wallet: { cash: [3, 90], loot: [['id_card', 0.9], ['credit_card', 0.5], ['photo', 0.4], ['lottery_ticket', 0.25], ['condom', 0.1], ['letter', 0.1]] },
  purse: { cash: [5, 120], loot: [['wallet', 0.5], ['lipstick', 0.7], ['gum', 0.5, [1, 5]], ['smartphone', 0.25], ['painkillers', 0.3], ['xanax', 0.08], ['jewelry', 0.15], ['photo', 0.3], ['candy', 0.2]] },
  backpack: { cash: [0, 25], loot: [['water_bottle', 0.6], ['sandwich', 0.4], ['book', 0.4], ['flashlight', 0.3], ['bandage', 0.3], ['comic_book', 0.25], ['energy_drink', 0.3], ['chips', 0.3], ['joint', 0.08], ['smartphone', 0.1]] },
  duffel_bag: { cash: [0, 300], loot: [['cloth', 0.8, [1, 3]], ['weed', 0.2, [1, 3]], ['cocaine', 0.1], ['pistol', 0.08], ['ammo_9mm', 0.15, [6, 18]], ['beer', 0.3, [1, 4]], ['towel', 0], ['bandage', 0.2], ['cigarettes', 0.3]] },
  briefcase: { cash: [20, 600], loot: [['documents', 0.9, [1, 3]], ['smartphone', 0.3], ['letter', 0.5], ['designer_watch', 0.1], ['coffee', 0.2], ['xanax', 0.1], ['keycard', 0.05]] },
  lunchbox: { cash: [0, 3], loot: [['sandwich', 0.9], ['apple', 0.6], ['soda', 0.5], ['candy', 0.5], ['chips', 0.4]] },
  toolbox_kit: { cash: [0, 0], loot: [['hammer', 0.8], ['screwdriver', 0.8], ['duct_tape', 0.6, [1, 2]], ['crowbar', 0.3], ['lockpick', 0.15], ['flashlight', 0.4], ['pocket_knife', 0.2]] },
};
const CLOTHES = () => G.rng.chance(0.5) ? G.clothId('top', G.rng.pick(['shirt', 'hoodie', 'jacket', 'tunic']), G.rng.pick(G.CLOTH_COLORS)[1]) : G.clothId('bottom', G.rng.pick(['pants', 'shorts']), G.rng.pick(G.CLOTH_COLORS)[1]);
G.carry = {
  KINDS,
  roll(kind) {
    const k = KINDS[kind], items = [];
    for (const [id, p, range] of k.loot) {
      if (Math.random() >= p) continue;
      const n = range ? G.rng.int(range[0], range[1]) : 1;
      if (id === 'cloth') { for (let i = 0; i < n; i++) items.push([CLOTHES(), 1]); continue; }
      if (G.ITEMS[id]) items.push([id, n]);
    }
    return { items, gold: k.cash[1] ? G.rng.int(k.cash[0], k.cash[1]) : 0 };
  },
  // contents live in the world (so they persist in your save), keyed by an id kept on the opened item
  open(scene, slotIdx) {
    const p = scene.player, w = scene.world, s = p.inventory.slots[slotIdx];
    if (!s) return false;
    let kind = s.id, key = null;
    const m = /^opened:([a-z_]+):(\d+)$/.exec(s.id);
    if (m) { kind = m[1]; key = 'carry_' + m[2]; }
    if (!KINDS[kind]) return false;
    if (!key) {   // first time: make up what is in it, and turn the item into "this particular one"
      w.carrySeq = (w.carrySeq || 0) + 1;
      key = 'carry_' + w.carrySeq;
      const roll = this.roll(kind);
      w.containers[key] = { id: key, map: '_carried', kind: 'bag', name: G.item(kind).name, owner: null, x: 0, y: 0, items: roll.items, gold: roll.gold, day: w.day, carried: true };
      p.inventory.removeAt(slotIdx, 1);
      const oid = `opened:${kind}:${w.carrySeq}`;
      if (p.inventory.slots[slotIdx] == null) p.inventory.slots[slotIdx] = { id: oid, qty: 1 }; else p.inventory.add(oid, 1);
    }
    const c = w.containers[key];
    if (!c) { scene.toast('It is empty.'); return true; }
    G.audio.play('door');
    G.scenes.push(new G.LootScene(scene, c));
    return true;
  },
};
// "opened" items: a wallet you went through (keeps its leftover contents)
const _item = G.item;
G.item = (id) => {
  const m = id && /^opened:([a-z_]+):(\d+)$/.exec(id);
  if (!m) return _item(id);
  const base = _item(m[1]);
  return Object.assign({}, base, { id, name: base.name + ' (opened)', stack: 1, value: Math.max(1, Math.round((base.value || 2) * 0.5)), desc: base.desc.replace(/ ?Open it[^.]*\./, '') + ' You already went through it; open it again to see what is left.' });
};
for (const kind in KINDS) {
  const fn = (scene) => { const p = scene.player, i = p.inventory.slots.findIndex((s) => s && s.id === kind); return i >= 0 && G.carry.open(scene, i); };
  G.ITEM_USE[kind] = fn;
}
const PL = G.Player.prototype, _use = PL.useFromSlot;
PL.useFromSlot = function (i, scene) {
  const s = this.inventory.slots[i];
  if (s && (KINDS[s.id] || /^opened:/.test(s.id))) return G.carry.open(scene, i);
  return _use.call(this, i, scene);
};
// carried bags never show up on a map, and never decay
const _forMap = G.containers.forMap, _clean = G.containers.cleanup;
G.containers.forMap = function (w, mapId) { return _forMap.call(this, w, mapId).filter((c) => !c.carried); };
G.containers.cleanup = function (w) {
  const keep = {}; for (const k in w.containers) if (w.containers[k].carried) keep[k] = w.containers[k];
  _clean.call(this, w);
  Object.assign(w.containers, keep);
};

// ---------------------------------------------------------------- people carry them, drawers hold them
const POCKET = { worker: [['wallet', 0.55], ['lunchbox', 0.15], ['backpack', 0.08]], shopkeeper: [['wallet', 0.6]], rich: [['wallet', 0.7], ['briefcase', 0.25], ['purse', 0.2]], retiree: [['wallet', 0.6], ['purse', 0.25]],
  farmer: [['wallet', 0.4], ['toolbox_kit', 0.1]], gang: [['wallet', 0.4], ['duffel_bag', 0.1]], dealer: [['duffel_bag', 0.3], ['wallet', 0.5]], cop: [['wallet', 0.7]], homeless: [['backpack', 0.3]], kid: [['backpack', 0.5], ['lunchbox', 0.4]], teen: [['backpack', 0.6], ['wallet', 0.3]] };
const _roll = G.lifestyle.roll;
G.lifestyle.roll = function (life, style) {
  const out = _roll.call(this, life, style);
  const table = style === 'cabinet' ? [['lunchbox', 0.1]] : style === 'toolbox' ? [['toolbox_kit', 0.5]] : POCKET[life] || [];
  for (const [id, p] of table) if (Math.random() < p * (style ? 0.5 : 1)) out.push([id, 1]);
  return out;
};
// a woman's purse instead of a wallet, sometimes
const _corpse = G.containers.createCorpse;
G.containers.createCorpse = function (w, npc, mapId) {
  if (npc.look && npc.look.body === 'f' && Math.random() < 0.5) for (const e of npc.st.inv || []) if (e[0] === 'wallet') e[0] = 'purse';
  return _corpse.call(this, w, npc, mapId);
};

// ---------------------------------------------------------------- icons
const extra = A.icons || {};
if (!A.icons) { const _icon = A.icon; A.icon = function (name) { return extra[name] || _icon.call(this, name); }; }
const icon = (name, fn) => { const { c, x } = A.mk(16, 16); fn(x); if (A.outline) A.outline(c); extra[name] = c; };
const R = (x, a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
const _init = A.init;
A.init = function () {
  _init.call(this);
  icon('c_purse', (x) => { R(x, 3, 7, 10, 7, '#a8304a'); R(x, 3, 7, 10, 2, '#c84a64'); R(x, 6, 3, 1, 4, '#5a1828'); R(x, 9, 3, 1, 4, '#5a1828'); R(x, 6, 3, 4, 1, '#5a1828'); R(x, 7, 9, 2, 2, '#e8c050'); });
  icon('c_backpack', (x) => { R(x, 4, 3, 8, 11, '#3a5a8a'); R(x, 5, 2, 6, 2, '#2a4a7a'); R(x, 5, 8, 6, 4, '#2a4a7a'); R(x, 7, 9, 2, 1, '#c8c8c8'); });
  icon('c_duffel', (x) => { R(x, 1, 6, 14, 7, '#2a3a2a'); R(x, 1, 6, 14, 2, '#3a4e3a'); R(x, 5, 4, 6, 2, '#1a221a'); R(x, 2, 9, 12, 1, '#c8c040'); });
  icon('c_briefcase', (x) => { R(x, 2, 5, 12, 9, '#5a3a22'); R(x, 2, 5, 12, 2, '#7a5232'); R(x, 6, 3, 4, 2, '#3a2412'); R(x, 7, 8, 2, 2, '#e8c050'); });
  icon('c_lunchbox', (x) => { R(x, 2, 5, 12, 8, '#d84a3a'); R(x, 2, 5, 12, 2, '#f06a5a'); R(x, 6, 3, 4, 2, '#8a2a22'); R(x, 4, 9, 8, 2, '#f0d860'); });
  icon('c_toolbox', (x) => { R(x, 1, 6, 14, 7, '#c83a2a'); R(x, 1, 6, 14, 2, '#e85a4a'); R(x, 5, 3, 6, 1, '#5a5a62'); R(x, 5, 3, 1, 3, '#5a5a62'); R(x, 10, 3, 1, 3, '#5a5a62'); R(x, 7, 9, 2, 2, '#d8d8d8'); });
  icon('c_card', (x) => { R(x, 2, 4, 12, 8, '#e8e4d8'); R(x, 3, 5, 4, 5, '#a8b8c8'); R(x, 8, 6, 5, 1, '#5a5a62'); R(x, 8, 8, 4, 1, '#5a5a62'); });
  icon('c_card2', (x) => { R(x, 2, 4, 12, 8, '#2a5ab0'); R(x, 2, 6, 12, 2, '#1a1a22'); R(x, 3, 9, 3, 2, '#e8c050'); });
  icon('c_lipstick', (x) => { R(x, 6, 7, 4, 7, '#1a1a1e'); R(x, 6, 4, 4, 3, '#c82a3a'); R(x, 7, 2, 2, 2, '#e83a4a'); });
  icon('c_tape', (x) => { x.fillStyle = '#9aa0a8'; x.beginPath(); x.arc(8, 8, 6, 0, Math.PI * 2); x.fill(); x.fillStyle = '#5a5e66'; x.beginPath(); x.arc(8, 8, 3, 0, Math.PI * 2); x.fill(); });
  icon('c_hammer', (x) => { R(x, 7, 5, 2, 10, '#8a5a2a'); R(x, 3, 2, 10, 4, '#7a7e86'); R(x, 3, 2, 3, 2, '#5a5e66'); });
  icon('c_screwdriver', (x) => { R(x, 7, 1, 2, 8, '#c8ccd4'); R(x, 6, 9, 4, 6, '#e0c030'); R(x, 6, 9, 4, 1, '#b09020'); });
};
})();
