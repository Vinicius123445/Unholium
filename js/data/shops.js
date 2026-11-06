'use strict';
// Shops. Stock restocks every morning (see consequences.js). Prices depend on the item value,
// the shop's margins, the player's reputation in the region and the region's tension, plus the
// player's Haggler skill and a successful "better prices?" speech check (15% for that day).
//   owner: npc id that must be alive and at work for the shop to open
//   buys: 'all' or list of item types the merchant will buy (illegal items: faction shops only, unless Fence)
//   room: price of a bed for the night (inns only)
//   faction + minRep: faction-run shops only trade with people they trust enough

G.SHOPS = {
  r_inn: {
    name: 'Motel', owner: 'r_innkeeper', region: 'rural', gold: 150, buyMult: 1.0, sellMult: 0.4, room: 10,
    buys: ['consumable'],
    stock: [['beer', 12], ['wine', 4], ['whiskey', 3], ['coffee', 6], ['sandwich', 6], ['cooked_meat', 5], ['bread', 6], ['apple', 6], ['milk', 4]],
  },
  r_store: {
    name: 'General Store', owner: 'r_merchant', region: 'rural', gold: 300, buyMult: 1.0, sellMult: 0.5, buys: 'all',
    stock: [['fishing_rod', 3], ['bait', 30], ['bread', 6], ['canned_beans', 6], ['chips', 6], ['soda', 6], ['coffee', 4], ['cigarettes', 10], ['bandage', 6], ['first_aid_kit', 2], ['painkillers', 2],
      ['torch', 4], ['flashlight', 2], ['oil_flask', 3], ['kitchen_knife', 2], ['baseball_bat', 2], ['crowbar', 1], ['wood', 10],
      [G.clothId('top', 'shirt', '#b8a07a'), 2], [G.clothId('top', 'tunic', '#6a4a2a'), 1], [G.clothId('bottom', 'pants', '#6a4a2a'), 2], [G.clothId('bottom', 'pants', '#4a5a7a'), 1]],
  },
  r_smith: {
    name: 'Hardware & Auto', owner: 'r_smith', region: 'rural', gold: 400, buyMult: 1.0, sellMult: 0.5, buys: ['weapon', 'armor', 'material'],
    stock: [['shovel', 2], ['machete', 2], ['sledgehammer', 1], ['crowbar', 2], ['woodaxe', 1], ['combat_knife', 1], ['hunting_knife', 1], ['leather_armor', 1], ['iron_ingot', 4]],
  },
  c_store: {
    name: 'Convenience Store', owner: 'c_merchant', region: 'city', gold: 500, buyMult: 1.1, sellMult: 0.5, buys: 'all',
    stock: [['wristwatch', 2], ['candy', 20], ['comic_book', 6], ['fishing_rod', 2], ['bait', 20], ['water_bottle', 15], ['sandwich', 8], ['canned_beans', 6], ['chips', 10], ['soda', 10], ['coffee', 6], ['energy_drink', 8], ['beer', 10], ['cigarettes', 20],
      ['bandage', 8], ['first_aid_kit', 3], ['painkillers', 4], ['torch', 6], ['flashlight', 3], ['oil_flask', 4], ['book', 3], ['kitchen_knife', 2], ['baseball_bat', 1]],
  },
  c_clothes: {
    name: 'Clothes Store', owner: 'c_tailor', region: 'city', gold: 400, buyMult: 1.0, sellMult: 0.4, buys: ['clothing'],
    stock: (() => {
      const out = [];
      const pick = ['#e8e4dc', '#2a2a30', '#a83232', '#3a8a4a', '#4070d8', '#6a3a8a', '#d8782a', '#2a8a8a', '#d070a0', '#c8a038'];
      for (const style of ['shirt', 'tshirt', 'longsleeve', 'tank', 'tunic', 'jacket', 'hoodie', 'vest', 'dress', 'robe']) {   // (T-shirts, long sleeves and tank tops too)
        for (const c of pick.slice(0, ['shirt', 'tshirt', 'longsleeve', 'jacket', 'hoodie'].includes(style) ? 10 : style === 'tank' ? 7 : 5)) {
          out.push([G.clothId('top', style, c, style === 'jacket' || style === 'vest' ? '#e8e4dc' : null), 1]);
        }
      }
      for (const style of ['pants', 'shorts', 'skirt']) for (const c of ['#2a2a30', '#4a5a7a', '#6a4a2a', '#b8a07a', '#8a8a90', '#a83232']) out.push([G.clothId('bottom', style, c), 1]);
      for (const style of ['sneakers', 'boots', 'dress_shoes', 'sandals']) for (const c of ['#1a1a1e', '#6a4a2a', '#f0f0f0']) out.push([G.clothId('shoes', style, c), 1]);
      for (const style of ['white', 'black', 'ski', 'surgical', 'bandana', 'balaclava']) out.push([G.clothId('mask', style, '#888888'), 1]);
      for (const style of ['cap', 'beanie', 'straw', 'fedora', 'bucket', 'bandana']) for (const c of ['#2a2a30', '#6a4a2a', '#a83232', '#3a4a6a']) out.push([G.clothId('hat', style, c), 1]);
      return out;
    })(),
  },
  // The underground: booze, drugs, blades and the occasional hot gun.
  c_punk: {
    name: 'Punk Stash', owner: 'c_punk_boss', region: 'city', faction: 'punks', minRep: 0, gold: 300, buyMult: 1.0, sellMult: 0.55, buys: 'all',
    stock: [['joint', 8], ['weed', 4], ['edible', 4], ['cocaine', 3], ['crack', 3], ['heroin', 2], ['speed_pills', 4], ['lsd', 3], ['magic_mushroom', 3], ['naloxone', 1], ['moonshine', 5], ['beer', 10], ['cigarettes', 10],
      ['switchblade', 2], ['brass_knuckles', 2], ['baseball_bat', 2], ['pistol', 1], ['smg', 1], ['ammo_9mm', 60], ['fire_bomb', 4], ['oil_flask', 6], ['torch', 6],
      [G.clothId('top', 'jacket', '#1a1a1e', '#d060d0'), 2], [G.clothId('bottom', 'pants', '#2a2a40'), 2]],
  },
  c_armory: {
    name: 'Gun Store', owner: 'c_armorer', region: 'city', gold: 1200, buyMult: 1.15, sellMult: 0.55, buys: ['weapon', 'armor', 'trinket', 'ammo'],
    stock: [['pistol', 3], ['revolver', 2], ['shotgun', 2], ['hunting_rifle', 1], ['ammo_9mm', 120], ['ammo_357', 60], ['ammo_shells', 48], ['ammo_rifle', 40],
      ['kevlar_vest', 2], ['combat_knife', 2], ['police_baton', 2], ['machete', 1], ['copper_ring', 1]],
  },
  c_alchemist: {
    name: 'Pharmacy', owner: 'c_alchemist', region: 'city', gold: 500, buyMult: 1.1, sellMult: 0.55, buys: ['consumable', 'material'],
    stock: [['benadryl', 10], ['condom', 12], ['first_aid_kit', 6], ['painkillers', 8], ['naloxone', 4], ['methadone', 4], ['antidote', 5], ['bandage', 8], ['energy_drink', 6], ['coffee', 4], ['herb', 6], ['health_potion', 2]],
  },
  c_tavern: {
    name: 'Bar', owner: 'c_tavernkeep', region: 'city', gold: 250, buyMult: 1.1, sellMult: 0.4, room: 18, buys: ['consumable'],
    stock: [['beer', 20], ['wine', 6], ['whiskey', 8], ['vodka', 6], ['ale', 8], ['cigarettes', 10], ['sandwich', 6], ['cooked_meat', 8], ['chips', 8]],
  },
  c_market_food: {
    name: 'Food Truck', owner: 'c_market1', region: 'city', gold: 150, buyMult: 0.95, sellMult: 0.5, buys: ['consumable'],
    stock: [['apple', 15], ['bread', 10], ['fish', 10], ['egg', 10], ['milk', 6], ['cheese', 5], ['soda', 6]],
  },
  c_market_goods: {
    name: 'Street Stall', owner: 'c_market2', region: 'city', gold: 400, buyMult: 1.05, sellMult: 0.6, buys: ['material', 'misc', 'trinket'],
    stock: [['torch', 6], ['wood', 15], ['iron_ore', 6], ['gem', 1], ['copper_ring', 1], ['amulet', 1], ['cigarettes', 10]],
  },
  f_lodge: {
    name: "Hunter's Lodge", owner: 'f_hunter', region: 'forest', gold: 500, buyMult: 1.0, sellMult: 0.7,
    buys: ['material', 'consumable', 'ammo'],
    stock: [['hunting_rifle', 1], ['shotgun', 1], ['ammo_rifle', 30], ['ammo_shells', 24], ['hunting_knife', 2], ['cooked_meat', 6], ['raw_meat', 6],
      ['leather_armor', 2], ['torch', 4], ['bandage', 4], ['beer', 6], ['coffee', 4]],
  },
  // ---- out on the county road ----
  r_diner: {
    name: 'Diner', owner: 'r_cook', region: 'rural', gold: 200, buyMult: 1.0, sellMult: 0.4, buys: ['consumable'],
    stock: [['cooked_meat', 10], ['sandwich', 8], ['coffee', 12], ['soda', 8], ['milk', 4], ['egg', 6], ['beer', 6]],
  },
  r_gas: {
    name: 'Gas Station', owner: 'r_attendant', region: 'rural', gold: 250, buyMult: 1.1, sellMult: 0.4, buys: ['consumable', 'misc'],
    stock: [['bait', 20], ['condom', 8], ['water_bottle', 12], ['oil_flask', 6], ['torch', 6], ['flashlight', 3], ['cigarettes', 20], ['energy_drink', 8], ['soda', 10], ['chips', 10], ['beer', 12], ['painkillers', 2]],
  },
  // the drifter in the trailer park sells what the city sells, cheaper and dirtier
  r_dealer: {
    name: 'Drifter', owner: 'r_dealer', region: 'rural', faction: 'criminals', minRep: -100, fence: true, gold: 400, buyMult: 0.9, sellMult: 0.5, buys: 'all',
    stock: [['lockpick', 10], ['joint', 6], ['weed', 3], ['edible', 3], ['crack', 4], ['heroin', 3], ['speed_pills', 4], ['moonshine', 6], ['switchblade', 1], ['naloxone', 1]],
  },
  // ---- city districts ----
  s_pawn: {
    name: 'Pawn Shop', owner: 's_pawnbroker', region: 'city', fence: true, gold: 900, buyMult: 1.0, sellMult: 0.45, buys: 'all',
    stock: [['wristwatch', 3], ['lockpick', 6], ['fishing_rod', 1], ['gold_chain', 2], ['smartphone', 3], ['revolver', 1], ['ammo_357', 24], ['brass_knuckles', 2], ['switchblade', 2], ['copper_ring', 2], ['amulet', 1], ['flashlight', 2], ['leather_armor', 1]],
  },
  s_liquor: {
    name: 'Liquor Store', owner: 's_clerk', region: 'city', gold: 200, buyMult: 1.0, sellMult: 0.4, buys: ['consumable'],
    stock: [['beer', 20], ['vodka', 8], ['whiskey', 8], ['wine', 6], ['cigarettes', 20], ['chips', 8], ['soda', 8]],
  },
  x_bodega: {
    name: 'Bodega', owner: 'x_clerk', region: 'city', gold: 200, buyMult: 0.95, sellMult: 0.45, buys: ['consumable'],
    stock: [['sandwich', 8], ['coffee', 6], ['energy_drink', 6], ['beer', 10], ['cigarettes', 15], ['canned_beans', 6], ['chips', 8], ['painkillers', 2]],
  },
  u_store: {
    name: 'Mini-Mart', owner: 'u_clerk', region: 'city', gold: 300, buyMult: 1.05, sellMult: 0.45, buys: 'all',
    stock: [['candy', 15], ['comic_book', 4], ['sandwich', 6], ['water_bottle', 12], ['soda', 10], ['chips', 10], ['coffee', 6], ['beer', 8], ['cigarettes', 10], ['bandage', 6], ['first_aid_kit', 2], ['flashlight', 2], ['torch', 4], ['kitchen_knife', 2], ['baseball_bat', 1]],
  },
  h_casino: {
    name: 'Casino Bar & Hotel', owner: 'h_cashier', region: 'city', gold: 2000, buyMult: 1.3, sellMult: 0.3, room: 60, buys: ['consumable'],
    stock: [['whiskey', 10], ['wine', 8], ['beer', 12], ['vodka', 6], ['soda', 10], ['water_bottle', 10], ['cigarettes', 10], ['sandwich', 6]],
  },
  h_jeweler: {
    name: 'Jewelry Boutique', owner: 'h_jeweler', region: 'city', gold: 3000, buyMult: 1.3, sellMult: 0.6, buys: ['trinket', 'material'],
    stock: [['designer_watch', 2], ['gold_chain', 3], ['copper_ring', 3], ['jewelry', 3], ['gem', 2]],
  },
  // The hermit knows his mushrooms (buying here teaches you what they are).
  f_hermit: {
    name: "Hermit's Remedies", owner: 'f_hermit', region: 'forest', gold: 200, buyMult: 0.9, sellMult: 0.6, buys: ['consumable', 'material'],
    stock: [['herb', 12], ['mushroom', 6], ['chanterelle', 4], ['magic_mushroom', 4], ['fly_agaric', 2], ['antidote', 3], ['moonshine', 3], ['health_potion', 2], ['apple', 6]],
  },
};
