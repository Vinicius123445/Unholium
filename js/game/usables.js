'use strict';
// Everyday objects: TVs, couches, vending machines, computers, bookshelves, trash cans, mailboxes,
// fridges, cars, gas pumps, campfires, workbenches... Most can be used once a day; using other
// people's things (their fridge, their mail, their car) is theft if somebody sees you.

const EPITAPHS = ['Beloved father. Terrible cook.', 'Gone fishing. For good.', 'She told you she was sick.', 'Here lies a good dog\'s best friend.', 'Rest now. You earned it.', 'Loving wife, mother and poker champion.', 'He finally found some peace and quiet.', 'Taken too soon.'];
const CHANNELS = ['A cooking show. Someone burns a cake.', 'Local news: the mayor promises "change". Again.', 'A rerun of a sitcom you have seen ten times.', 'A late-night infomercial for knives that cut through shoes.', 'Sports highlights. Someone, somewhere, scored.', 'A nature documentary about wolves.'];
const EMAILS = ['Unpaid bill reminders. Lots of them.', 'An argument with a sibling about a borrowed car.', 'Spam: "You have won a cruise!"', 'A love letter that was never sent.', 'A job rejection, read many times.', 'Online orders: way too many shoes.'];
const LOOK = {
  statue: 'A bronze statue of someone important, covered in pigeon droppings.', plant: 'A potted plant. Someone waters it. Probably.',
  hydrant: 'A fire hydrant. Do not park here.', haybale: 'A bale of hay. Smells like summer.', counter: 'A counter. Talk to whoever works here.', table: 'A table. Nothing interesting on it.',
};
const TRASH = [['chips', 0.3], ['soda', 0.3], ['canned_beans', 0.2], ['iron_ore', 0.25], ['cigarettes', 0.15], ['smartphone', 0.04], ['wallet', 0.04], ['beer', 0.1]];
const GLOVEBOX = [['cigarettes', 0.4], ['wallet', 0.2], ['smartphone', 0.1], ['flashlight', 0.15], ['ammo_9mm', 0.1], ['painkillers', 0.1], ['torch', 0.2]];
const RECIPES = [
  { out: 'fire_bomb', need: [['beer', 1], ['oil_flask', 1]], name: 'Molotov Cocktail (beer bottle + gas can)' },
  { out: 'mace', need: [['baseball_bat', 1], ['iron_ore', 2]], name: 'Spiked Bat (baseball bat + 2 scrap metal)' },
  { out: 'bandage', need: [['cloth_tunic', 1]], name: 'Bandages (tear up a denim jacket)', qty: 3 },
];

G.usables = {
  LABELS: {
    tv: 'Watch TV', sit: 'Sit down', vending: 'Buy a soda ($2)', computer: 'Use the computer', read: 'Read a book', trash: 'Search the trash',
    dumpster: 'Search the dumpster', mail: 'Check the mailbox', gas: 'Fill a gas can ($10)', campfire: 'Cook / warm up', grave: 'Read the headstone',
    workbench: 'Use the workbench', fridge: 'Open the fridge', look: 'Look', search: 'Search', car: 'Break into the car',
  },

  label(d, scene) {
    const k = d.def.interact;
    if (scene.player.dragging && k === 'dumpster') return 'Hide the body in the dumpster';
    if (k === 'car' && d.type === 'police_car') return 'Break into the police car';
    return this.LABELS[k] || 'Use';
  },

  // Who owns this object: the people living in the building it stands in, or next to (mailboxes, cars in driveways).
  owner(scene, d) {
    const map = scene.map;
    let b = map.buildingAtTile(d.tx, d.ty);
    if (!b) b = map.buildings.find((q) => d.tx >= q.x - 1 && d.tx <= q.x + q.w && d.ty >= q.y && d.ty <= q.y + q.h + 2);
    if (!b) return null;
    if (scene.world.flags.player_home === b.id) return 'player';
    const res = scene.residents[b.id] || [];
    return res.find((id) => scene.world.isAlive(id)) || null;
  },

  // Some things only work once a day each.
  once(scene, d, tag) {
    const key = `use_${tag}_${scene.map.id}_${d.tx}_${d.ty}`, w = scene.world;
    if (w.flags[key] === w.day) return false;
    w.flags[key] = w.day;
    return true;
  },

  roll(table) { return table.filter(([, p]) => G.rng.chance(p)).map(([id]) => id); },
  give(scene, ids, empty) {
    const p = scene.player;
    if (!ids.length) { scene.toast(empty); return; }
    for (const id of ids) p.inventory.add(id, 1);
    scene.toast('Found: ' + ids.map((id) => G.item(id).name).join(', '), 'good');
    G.audio.play('pickup');
  },
  stealing(scene, owner, value) { if (owner && owner !== 'player') scene.reportCrime('theft', null, value, owner); },

  use(d, scene) {
    const p = scene.player, w = scene.world, k = d.def.interact;
    const owner = this.owner(scene, d);
    switch (k) {
      case 'tv':
        scene.passTime(1, false);
        p.stamina = Math.min(p.maxStamina, p.stamina + 30);
        scene.toast(G.rng.chance(0.5) && w.rumors.length ? `On the news: "${G.rng.pick(w.rumors).text}"` : G.rng.pick(CHANNELS));
        break;
      case 'sit':
        p.sitting = { x: d.x, y: d.y - 2 };
        p.x = d.x; p.y = d.y + 1;
        scene.toast('You sit down. (Move to get up)');
        break;
      case 'vending':
        if (p.gold < 2) { scene.toast('You need $2.', 'bad'); break; }
        p.gold -= 2; p.inventory.add('soda', 1); G.audio.play('coin'); scene.toast('Clunk. A soda drops out.');
        break;
      case 'computer':
        if (!owner || owner === 'player') { scene.toast('You check the news and your email. Nothing new.'); break; }
        scene.toast(`You snoop through ${w.displayName(owner)}'s computer: ${G.rng.pick(EMAILS)}`);
        if (G.rng.chance(0.3)) { const op = G.social.strongest(w, owner, -1); if (op) scene.toast(`There are angry messages about ${w.displayName(op.id)} in here.`, 'warn'); }
        break;
      case 'read':
        if (!this.once(scene, d, 'read')) { scene.toast('You have read everything interesting here today.'); break; }
        scene.passTime(1, false);
        G.events.emit('xp', 6, 'Reading');
        scene.toast(G.rng.pick(['You read a few chapters of a crime novel.', 'You flip through an old encyclopedia.', 'A self-help book. You feel slightly helped.', 'A cookbook. Now you are hungry.']));
        break;
      case 'trash':
      case 'dumpster':
        if (k === 'dumpster' && p.dragging) { G.bodies.dispose(scene, 'dumpster'); break; }
        if (!this.once(scene, d, 'trash')) { scene.toast('Already picked through today.'); break; }
        this.give(scene, this.roll(TRASH), 'Nothing but garbage.');
        break;
      case 'mail':
        if (!this.once(scene, d, 'mail')) { scene.toast('The mailbox is empty.'); break; }
        if (owner === 'player') {
          if (G.rng.chance(0.25)) { p.gold += 20; scene.toast('A check for $20! (Tax refund?)', 'good'); }
          else scene.toast(G.rng.pick(['Bills. Ignored.', 'A flyer for pizza.', 'Junk mail.']));
        } else {
          this.give(scene, G.rng.chance(0.3) ? ['wallet'] : [], 'Just bills and flyers.');
          this.stealing(scene, owner, 10);
        }
        break;
      case 'gas':
        if (p.gold < 10) { scene.toast('You need $10.', 'bad'); break; }
        p.gold -= 10; p.inventory.add('oil_flask', 1); G.audio.play('coin'); scene.toast('You fill a gas can.');
        break;
      case 'campfire': {
        const raw = p.inventory.count('raw_meat');
        if (raw) { p.inventory.remove('raw_meat', raw); p.inventory.add('cooked_meat', raw); scene.toast(`You grill ${raw} piece${raw > 1 ? 's' : ''} of meat.`, 'good'); }
        else scene.toast('You warm your hands by the fire.');
        p.stamina = p.maxStamina;
        break;
      }
      case 'grave':
        scene.toast(`"${EPITAPHS[G.util.hash2(d.tx, d.ty) % EPITAPHS.length]}"`);
        break;
      case 'workbench': {
        const r = RECIPES.find((q) => q.need.every(([id, n]) => p.inventory.has(id, n)));
        if (!r) { scene.toast('You can make: ' + RECIPES.map((q) => q.name).join('; ')); break; }
        scene.confirm(`Make ${r.name}?`, () => { for (const [id, n] of r.need) p.inventory.remove(id, n); p.inventory.add(r.out, r.qty || 1); scene.toast(`Made: ${G.item(r.out).name}`, 'good'); G.audio.play('pickup'); });
        break;
      }
      case 'fridge':
        if (!this.once(scene, d, 'fridge')) { scene.toast('Nothing left you would want to eat.'); break; }
        this.give(scene, this.roll([['sandwich', 0.5], ['beer', 0.4], ['milk', 0.3], ['cheese', 0.3], ['apple', 0.3]]), 'Just condiments and a sad lemon.');
        this.stealing(scene, owner, 6);
        break;
      case 'search':
        if (!this.once(scene, d, 'search')) { scene.toast('Empty.'); break; }
        this.give(scene, this.roll([['wood', 0.3], ['iron_ore', 0.25], ['beer', 0.15], ['canned_beans', 0.2], ['torch', 0.1]]), 'Nothing useful inside.');
        break;
      case 'car': {
        if (!this.once(scene, d, 'car')) { scene.toast('You already went through this one.'); break; }
        const police = d.type === 'police_car';
        if (police && !p.inventory.has('crowbar')) { scene.toast('Locked tight. You would need a crowbar.', 'bad'); break; }
        G.audio.play('hit');
        if (G.rng.chance(police ? 1 : 0.3)) { G.audio.play('alarm'); scene.toast('The car alarm goes off!', 'bad'); for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 160) { a.sleeping = false; if (a.def.combat === 'flee') a.startFlee(p); } }
        this.give(scene, police ? this.roll([['ammo_9mm', 1], ['shotgun', 0.25], ['police_baton', 0.5], ['first_aid_kit', 0.5]]) : this.roll(GLOVEBOX), 'The glovebox is empty.');
        if (G.rng.chance(0.5)) { const cash = G.rng.int(3, 30); p.gold += cash; scene.toast(`+$${cash} in loose change.`); }
        scene.reportCrime('theft', null, police ? 80 : 20, owner && owner !== 'player' ? owner : null);
        break;
      }
      case 'look':
        scene.toast(LOOK[d.type] || 'Nothing special.');
        break;
      default:
        scene.toast('Nothing happens.');
    }
  },
};
