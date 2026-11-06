'use strict';
// Where the city goes out. Two new districts and a few places in the port:
//   Neon Row (id `neon`, north of Center): nightlife. Old Quarter (id `arts`, east of Neon Row): culture, sport, food.
//   G.VENUES: one record per place: where it stands, what kind it is, hours, prices, who works there.
//   Every venue is a real building with staff NPCs, an interior from its kind's layout (L below), a till, a reputation
//   and an owner (js/game/realestate.js sells them). w.venues[id] = { till, visits, rep, closed, owner, price, day... }
//   People go out on their own: on the map you are on they pick a place that suits them (G.venueSys.taste: their
//   lifestyle, a personal seed so nobody is identical, money, the hour, the day of the week, the place's reputation),
//   walk there, pay, sit, stay a while. Elsewhere the same choice happens hourly and only moves the money and the
//   counts. They arrive on foot through js/game/travel.js or from the street: nobody is generated inside a venue.
(() => {
const T = G.T, GS = G.GameScene.prototype, NP = G.NPC.prototype, pick = (a) => G.rng.pick(a), MB = G.MB, F = G.finance, clamp = G.util.clamp;
const item = (id, o) => { if (!G.ITEMS[id]) G.ITEMS[id] = Object.assign({ id, type: 'consumable', stack: 8, icon: 'sandwich' }, o); };
item('cocktail', { name: 'Cocktail', icon: 'whiskey', alcohol: 18, value: 12, desc: 'Something sweet with an umbrella in it.' });
item('popcorn', { name: 'Popcorn', icon: 'chips', heal: 6, value: 6, desc: 'Too much butter. Exactly enough butter.' });
item('espresso', { name: 'Espresso', icon: 'coffee', stamina: 40, effects: { caffeine: 80 }, value: 5, desc: 'Small and serious.' });
item('pasta', { name: 'Plate of Pasta', heal: 26, value: 16, desc: 'Fresh, with a sauce someone cares about.' });
item('sushi', { name: 'Sushi Set', heal: 24, value: 22, desc: 'Eight pieces, carefully arranged.' });
item('feijoada', { name: 'Feijoada', heal: 34, value: 18, desc: 'Black beans, pork, rice, orange. A serious meal.' });
item('burger', { name: 'Burger', heal: 22, value: 9, desc: 'Greasy, in the right way.' });
item('tacos', { name: 'Tacos', heal: 20, value: 8, desc: 'Three of them, with too much hot sauce.' });
item('pastry', { name: 'Pastry', heal: 8, value: 5, desc: 'Flaky, still warm.' });
item('vinyl_record', { name: 'Vinyl Record', type: 'misc', icon: 'letter', value: 18, desc: 'Someone\'s favorite album, once.' });
item('paperback', { name: 'Paperback', type: 'misc', icon: 'letter', value: 9, desc: 'Dog-eared. Smells of old houses.' });
item('sheet_music', { name: 'Sheet Music', type: 'misc', icon: 'letter', value: 6, desc: 'For an instrument you may or may not play.' });
item('old_poster', { name: 'Old Poster', type: 'misc', icon: 'letter', value: 7, desc: 'A band nobody remembers. It looks great anyway.' });
item('trinket', { name: 'Flea Market Trinket', type: 'misc', icon: 'gem', value: 5, desc: 'You are not sure what it is. Neither was the seller.' });

// kind: staff roles, hours [open, close] (close may pass midnight), price of entry or a typical spend, menu, who likes it
const KIND = {
  dive:    { roles: ['Bartender'], hours: [14, 3], spend: 6, menu: [['beer', 4], ['whiskey', 12], ['burger', 8], ['chips', 3]], likes: { gang: 3, worker: 2, homeless: 1, dealer: 2 } },
  punk:    { roles: ['Bartender', 'Bouncer'], hours: [18, 4], spend: 7, menu: [['beer', 4], ['vodka', 10], ['chips', 3]], likes: { gang: 4, dealer: 2, teen: 0 } },
  live:    { roles: ['Bartender', 'Bouncer'], hours: [18, 2], entry: 12, spend: 8, menu: [['beer', 5], ['cocktail', 10], ['soda', 3]], likes: { worker: 2, gang: 2, rich: 1 } },
  club:    { roles: ['Bartender', 'DJ', 'Bouncer'], hours: [21, 5], entry: 20, spend: 16, menu: [['cocktail', 14], ['beer', 7], ['vodka', 16]], likes: { rich: 2, worker: 2, gang: 2 } },
  karaoke: { roles: ['Bartender'], hours: [18, 2], spend: 8, menu: [['beer', 5], ['cocktail', 10], ['chips', 3]], likes: { worker: 3, retiree: 1 } },
  rooftop: { roles: ['Bartender'], hours: [17, 1], spend: 18, menu: [['cocktail', 16], ['whiskey', 20], ['soda', 4]], likes: { rich: 4 } },
  pool:    { roles: ['Bartender'], hours: [12, 2], spend: 6, menu: [['beer', 4], ['soda', 2]], likes: { gang: 3, worker: 2 } },
  strip:   { roles: ['Bartender', 'Bouncer', 'Performer', 'Performer', 'Performer'], hours: [19, 4], entry: 15, spend: 25, menu: [['cocktail', 14], ['beer', 8], ['whiskey', 22]], likes: { gang: 2, worker: 1, rich: 2, dealer: 2 }, adult: true },
  den:     { roles: ['Dealer', 'Bouncer'], hours: [20, 6], spend: 30, menu: [['beer', 5], ['whiskey', 15]], likes: { gang: 4, dealer: 3 } },
  casino:  { roles: ['Dealer', 'Bartender', 'Bouncer'], hours: [16, 4], spend: 40, menu: [['cocktail', 12], ['beer', 6]], likes: { rich: 3, gang: 1 } },
  bowling: { roles: ['Lane Attendant'], hours: [11, 23], entry: 8, spend: 8, menu: [['beer', 5], ['burger', 8], ['soda', 2]], likes: { worker: 3, retiree: 1, teen: 2 } },
  arcade:  { roles: ['Arcade Attendant'], hours: [10, 23], spend: 4, menu: [['soda', 2], ['chips', 2]], likes: { teen: 4, worker: 1, kid: 1 } },
  internet:{ roles: ['Cafe Attendant'], hours: [9, 1], spend: 4, menu: [['coffee', 3], ['soda', 2]], likes: { teen: 2, worker: 1 } },
  cinema:  { roles: ['Ticket Clerk', 'Usher', 'Concession Clerk'], hours: [12, 24], entry: 10, spend: 6, menu: [['popcorn', 6], ['soda', 3]], likes: { worker: 3, rich: 1, retiree: 2, teen: 3 } },
  theater: { roles: ['Ticket Clerk', 'Usher', 'Actor', 'Actor'], hours: [14, 23], entry: 25, spend: 5, menu: [['cocktail', 12], ['soda', 3]], likes: { rich: 4, retiree: 3 } },
  blackbox:{ roles: ['Ticket Clerk', 'Actor'], hours: [17, 24], entry: 8, spend: 4, menu: [['beer', 5], ['coffee', 3]], likes: { worker: 1, gang: 1, teen: 1 } },
  cafe:    { roles: ['Barista'], hours: [7, 19], spend: 6, menu: [['espresso', 4], ['coffee', 3], ['pastry', 5], ['sandwich', 7]], likes: { worker: 3, retiree: 3, rich: 2 } },
  italian: { roles: ['Waiter', 'Cook'], hours: [12, 23], spend: 18, menu: [['pasta', 18], ['cocktail', 10], ['soda', 3]], likes: { rich: 3, worker: 2, retiree: 2 } },
  japanese:{ roles: ['Waiter', 'Cook'], hours: [12, 23], spend: 24, menu: [['sushi', 24], ['soda', 3]], likes: { rich: 4 } },
  brazilian:{ roles: ['Waiter', 'Cook'], hours: [11, 22], spend: 16, menu: [['feijoada', 16], ['beer', 5], ['soda', 3]], likes: { worker: 3, shopkeeper: 2 } },
  diner:   { roles: ['Waiter'], hours: [6, 24], spend: 9, menu: [['burger', 8], ['tacos', 7], ['coffee', 2], ['soda', 2]], likes: { worker: 3, homeless: 1, gang: 1 } },
  gym:     { roles: ['Trainer'], hours: [6, 22], entry: 6, spend: 0, menu: [['soda', 3]], likes: { worker: 2, gang: 2, cop: 1 } },
  swim:    { roles: ['Lifeguard'], hours: [9, 20], entry: 5, spend: 0, menu: [['soda', 3]], likes: { worker: 1, kid: 2, teen: 2, retiree: 1 } },
  museum:  { roles: ['Guide'], hours: [9, 18], entry: 8, spend: 0, menu: [], likes: { retiree: 3, rich: 2 } },
  gallery: { roles: ['Gallery Attendant'], hours: [10, 19], spend: 0, menu: [], likes: { rich: 3, retiree: 1 } },
  library: { roles: ['Librarian'], hours: [8, 20], spend: 0, menu: [], likes: { retiree: 3, worker: 1, teen: 2 } },
  barber:  { roles: ['Barber'], hours: [9, 19], spend: 15, menu: [], likes: { worker: 1, gang: 1 } },
  tattoo:  { roles: ['Tattoo Artist'], hours: [12, 22], spend: 40, menu: [], likes: { gang: 2 } },
  store:   { roles: ['Clerk'], hours: [10, 20], spend: 10, menu: [], likes: { worker: 1, rich: 1, retiree: 1 } },
  market:  { roles: ['Stallholder', 'Stallholder', 'Stallholder'], hours: [8, 17], spend: 8, menu: [], likes: { retiree: 2, worker: 2, homeless: 1 } },
  office:  { roles: ['Clerk', 'Clerk'], hours: [9, 17], spend: 0, menu: [], likes: {} },
};
G.DECOR.v_pc = { sprite: 'f_desk_pc', solid: true, fw: 2, interact: 'computer' };
const VS = [];
const V0 = (id, map, x, y, w, h, name, kind, o = {}) => { VS.push(Object.assign({ id, map, x, y, w, h, name, kind }, o)); };
const BRICK = 'wall_brick', CONC = 'wall_concrete', MARB = 'wall_marble', PLAS = 'wall_plaster';
// Neon Row
V0('v_paragon', 'neon', 24, 21, 22, 19, 'Paragon Cinema', 'cinema', { wall: MARB, floor: 'carpet', sign: ['#ffe060', '#2a1e4a'], rooms: 2 });
V0('v_velvet', 'neon', 48, 21, 15, 19, 'Velvet Room', 'strip', { wall: 'wall_dark', floor: 'carpet', sign: ['#ff4aa8', '#1a0a18'] });
V0('v_pulse', 'neon', 69, 21, 20, 19, 'Pulse', 'club', { wall: 'wall_dark', floor: 'darkstone', sign: ['#40e8ff', '#0a1420'] });
V0('v_lanes', 'neon', 91, 21, 15, 19, 'Lucky Lanes', 'bowling', { wall: BRICK, floor: 'tilefloor', sign: ['#ffa030', '#201408'] });
V0('v_golden', 'neon', 111, 21, 16, 19, 'Golden Horseshoe', 'casino', { wall: MARB, floor: 'carpet', sign: ['#f8d060', '#2a1808'] });
V0('v_micdrop', 'neon', 1, 21, 16, 15, 'Mic Drop', 'karaoke', { wall: PLAS, floor: 'woodfloor', sign: ['#80ff80', '#102010'] });
V0('v_pixel', 'neon', 24, 51, 18, 16, 'Pixel Palace', 'arcade', { wall: CONC, floor: 'darkstone', sign: ['#60ff90', '#081a10'] });
V0('v_sidepocket', 'neon', 44, 51, 19, 16, 'Side Pocket', 'pool', { wall: BRICK, floor: 'woodfloor', sign: ['#40d080', '#0a1a10'] });
V0('v_tooth', 'neon', 69, 51, 16, 14, 'The Rotten Tooth', 'punk', { wall: 'wall_dark', floor: 'concrete', sign: ['#e83030', '#100808'] });
V0('v_bandshell', 'neon', 87, 51, 19, 16, 'The Bandshell', 'live', { wall: BRICK, floor: 'woodfloor', sign: ['#ffd040', '#201408'] });
V0('v_lastcall', 'neon', 1, 51, 15, 12, 'Last Call', 'dive', { wall: BRICK, floor: 'woodfloor', sign: ['#ff8040', '#180c08'] });
V0('v_skyline', 'neon', 111, 51, 15, 10, 'Skyline', 'rooftop', { wall: MARB, floor: 'tilefloor', sign: ['#a0c8ff', '#0a1020'] });
V0('v_byte', 'neon', 24, 80, 14, 9, 'Byte Cafe', 'internet', { wall: PLAS, floor: 'tilefloor', sign: ['#60c8ff', '#081420'] });
V0('v_rusty', 'neon', 40, 80, 12, 9, 'Rusty Spoon', 'diner', { wall: PLAS, floor: 'tilefloor', sign: ['#ffb040', '#201408'] });
// Old Quarter
V0('v_royal', 'arts', 3, 3, 26, 22, 'Royal Theater', 'theater', { wall: MARB, floor: 'carpet', sign: ['#f8d060', '#3a0a14'] });
V0('v_blackbox', 'arts', 31, 3, 15, 15, 'The Black Box', 'blackbox', { wall: 'wall_dark', floor: 'concrete', sign: ['#f0f0f0', '#141418'] });
V0('v_rex', 'arts', 48, 3, 18, 19, 'Rex Arthouse', 'cinema', { wall: BRICK, floor: 'carpet', sign: ['#ffa0c0', '#28101c'], rooms: 1 });
V0('v_museum', 'arts', 68, 3, 24, 19, 'City Museum', 'museum', { wall: MARB, floor: 'stonefloor', sign: ['#e8e0c8', '#2a2a30'] });
V0('v_gallery', 'arts', 94, 3, 16, 14, 'Whitewall Gallery', 'gallery', { wall: 'wall_siding', floor: 'tilefloor', sign: ['#202020', '#f4f4f0'] });
V0('v_library', 'arts', 3, 32, 22, 16, 'Public Library', 'library', { wall: BRICK, floor: 'woodfloor', sign: ['#e8e0c8', '#2a3a2a'] });
V0('v_books', 'arts', 27, 32, 12, 10, 'Dog-Eared Books', 'store', { wall: BRICK, floor: 'woodfloor', sign: ['#e8d0a0', '#2a1e12'], stock: 'books' });
V0('v_groove', 'arts', 41, 32, 12, 10, 'Groove Records', 'store', { wall: PLAS, floor: 'woodfloor', sign: ['#f06080', '#1c1018'], stock: 'records' });
V0('v_strings', 'arts', 55, 32, 12, 10, 'Six Strings', 'store', { wall: PLAS, floor: 'woodfloor', sign: ['#80d0f0', '#101c24'], stock: 'music' });
V0('v_threads', 'arts', 69, 32, 12, 10, 'Second Threads', 'store', { wall: PLAS, floor: 'woodfloor', sign: ['#e0a0f0', '#1c1024'], stock: 'vintage' });
V0('v_ink', 'arts', 83, 32, 11, 10, 'Iron Ink', 'tattoo', { wall: 'wall_dark', floor: 'darkstone', sign: ['#e84040', '#141014'] });
V0('v_fade', 'arts', 96, 32, 11, 10, 'Clean Fade', 'barber', { wall: PLAS, floor: 'tilefloor', sign: ['#f0f0f0', '#a02030'] });
V0('v_bean', 'arts', 3, 54, 12, 10, 'The Bean', 'cafe', { wall: PLAS, floor: 'woodfloor', sign: ['#e8c890', '#2a1a10'] });
V0('v_nonna', 'arts', 17, 54, 15, 11, 'Nonna\'s', 'italian', { wall: BRICK, floor: 'tilefloor', sign: ['#60c070', '#2a0a0a'] });
V0('v_hana', 'arts', 34, 54, 14, 11, 'Hana', 'japanese', { wall: 'wall_wood', floor: 'woodfloor', sign: ['#ff6060', '#1a0a0a'] });
V0('v_saudade', 'arts', 50, 54, 14, 11, 'Saudade', 'brazilian', { wall: PLAS, floor: 'tilefloor', sign: ['#60e080', '#0a2a18'] });
V0('v_iron', 'arts', 66, 54, 16, 12, 'Iron Works Gym', 'gym', { wall: CONC, floor: 'concrete', sign: ['#f0c040', '#1a1a1e'] });
V0('v_municipal', 'arts', 84, 54, 14, 11, 'Municipal Annex', 'office', { wall: MARB, floor: 'tilefloor', sign: ['#e8e8f0', '#20304a'] });
V0('v_homes', 'arts', 100, 54, 12, 11, 'Homestead Realty', 'office', { wall: PLAS, floor: 'carpet', sign: ['#ffe080', '#1a3a2a'] });
V0('v_flea', 'arts', 54, 88, 26, 16, 'Flea Market', 'market', { outdoor: true, stock: 'flea', hours: [8, 17] });
// the port
V0('v_anchor', 'industrial', 23, 41, 19, 14, 'The Anchor', 'strip', { wall: BRICK, floor: 'carpet', sign: ['#40c8ff', '#081824'] });
V0('v_backroom', 'industrial', 24, 65, 14, 11, 'Number Nine', 'den', { wall: CONC, floor: 'concrete', sign: ['#a0a0a0', '#141414'] });
G.VENUES = {}; for (const v of VS) { G.VENUES[v.id] = v; const k = KIND[v.kind]; v.hours = v.hours || k.hours; }
G.VENUE_KINDS = KIND;
const STOCK = {
  books: [['paperback', 14], ['sheet_music', 3]], records: [['vinyl_record', 16], ['old_poster', 6]], music: [['sheet_music', 10], ['vinyl_record', 4]], flea: [['trinket', 20], ['old_poster', 6], ['paperback', 6], ['vinyl_record', 6]],
  vintage: null,
};
const staffId = (v, i) => `${v.id}_s${i}`;
const FEM = [1, 0, 1, 0, 1];
// roles a venue employs (the staff are ordinary people, on a schedule; the adult venues employ adults only)
const makeStaff = (v) => {
  KIND[v.kind].roles.forEach((role, i) => {
    const id = staffId(v, i), perf = role === 'Performer', [a, b] = v.hours, sched = [];
    const stageCol = ['#e0307a', '#30c0e0', '#e8c020', '#a040e0', '#e8e4e0'][(id.length + i * 3 + v.x) % 5], look = perf ? { body: 'f', bikini: true, top: 'tank', bottom: 'shorts', shirt: stageCol, pants: stageCol, shoes: '#141418', hairStyle: [6, 3, 7, 10][i % 4], build: 1 } : role === 'Bouncer' ? { body: 'm', top: 'jacket', shirt: '#141418', bottom: 'pants', pants: '#141418', build: 2 } : role === 'Lifeguard' ? { top: 'tank', shirt: '#c83030', bottom: 'shorts', pants: '#c83030' } : role === 'Trainer' ? { top: 'tank', shirt: '#2a2a30', bottom: 'shorts', pants: '#2a2a30', build: 2 } : role === 'Cook' ? { top: 'shirt', shirt: '#f0f0ec', bottom: 'pants', pants: '#3a3a44', hat: 'bandana', hatColor: '#f0f0ec' } : {};
    if (FEM[i] && !look.body && (id.length + i) % 2) look.body = 'f';
    if (a < b) sched.push({ from: a, to: b, at: id, act: 'work' }, { from: b, to: 24, at: v.id + '_door', act: 'wander' }, { from: 0, to: a, at: v.id + '_door', act: 'wander' });
    else sched.push({ from: a, to: 24, at: id, act: 'work' }, { from: 0, to: b, at: id, act: 'work' }, { from: b, to: a, at: v.id + '_door', act: 'wander' });
    G.NPCS[id] = { id, name: role, map: v.map, faction: 'civilians', hp: role === 'Bouncer' ? 70 : 30, combat: role === 'Bouncer' ? 'fight' : 'flee', gold: 40, home: null, relations: {}, ageGroup: 'adult', venue: v.id, role, job: `I work at ${v.name}.`, look: G.look(id, look), schedule: sched, shop: i === 0 && (KIND[v.kind].menu.length || v.stock) ? 'shop_' + v.id : undefined, dialogue: perf ? 'v_performer' : role === 'Clerk' && v.id === 'v_municipal' ? 'v_clerk' : role === 'Clerk' && v.id === 'v_homes' ? 'v_agent' : undefined, performer: perf };
  });
  const stock = v.stock ? STOCK[v.stock] : KIND[v.kind].menu.map(([i]) => [i, 20]);
  if (v.outdoor) G.NPCS[staffId(v, 0)].shop = 'shop_' + v.id;
  if (stock || v.stock === 'vintage') G.SHOPS['shop_' + v.id] = { name: v.name, owner: staffId(v, 0), region: 'city', gold: 300, buyMult: 1.1, sellMult: 0.5, buys: v.stock ? ['misc', 'clothing'] : ['consumable'], stock: stock || G.util.clone((G.SHOPS.c_clothes || { stock: [] }).stock).slice(0, 12) };
};
for (const v of VS) makeStaff(v);
{ const d = G.NPCS.v_skyline_s0; d.map = 'neon_roof'; d.schedule = [{ from: 0, to: 24, at: 'v_skyline_s0', act: 'work' }]; }   // (the bar is up on the roof)
// the people who live here
const residents = [
  ['n_r', 'neon', 'n_flats', 'n_flats2', 12], ['a_r', 'arts', 'a_flats', 'a_flats2', 12],
];
const TOPS = ['shirt', 'tshirt', 'jacket', 'hoodie', 'longsleeve', 'tank', 'vest'];
for (const [pre, map, h1, h2, n] of residents) for (let i = 0; i < n; i++) {
  const id = pre + i, home = i % 2 ? h1 : h2, end = 17 + (i % 4);
  G.NPCS[id] = { id, name: i % 3 === 0 ? 'Artist' : i % 3 === 1 ? 'Resident' : 'Night Owl', map, faction: 'civilians', hp: 30, combat: 'flee', gold: 40 + i * 12, home, relations: {}, look: G.look(id, { top: TOPS[i % 7] }), schedule: [{ from: 9, to: end, at: (map === 'neon' ? ['n_plaza', 'n_plaza2', 'n_plaza3', 'n_plaza4'] : ['a_plaza', 'a_flea_park', 'a_pond_park', 'a_skate'])[i % 4], act: 'wander' }, { from: end, to: 23, at: home + '_door', act: 'wander' }, { from: 23, to: 9, at: home + '_bed', act: 'sleep' }], job: i % 3 === 0 ? 'I make things nobody buys yet.' : 'I get by.' };
}

// ---------------------------------------------------------------- interiors
const L = {};
const put = (m, v, t, x, y, e) => { const d = m.addDecor('v_' + t, x, y, e); if (d.def.seat && !d.def.solid) ((m.vseats = m.vseats || {})[v.id] = m.vseats[v.id] || []).push({ x, y, fw: d.def.fw || 1, perch: /^(booth|sofa|worn_couch)$/.test(t) ? { x: d.x + ((x + y) % 2 ? 6 : -6), y: d.y - 2, z: d.y + 1, dir: 0 } : null }); return d; };   // (a sofa faces the room: on it, not behind it)
const box = (b) => ({ x0: b.x + 1, y0: b.y + 1, x1: b.x + b.w - 2, y1: b.y + b.h - 2, cx: b.doorX });
const barAlong = (m, v, B, y = B.y0 + 2, x0 = B.x0, x1 = B.x1 - 1) => { if (x1 + 1 <= B.x1 && !m.decorsAt(x1 + 1, B.y0).length) put(m, v, 'fridge_bar', x1 + 1, B.y0); for (let x = x0; x <= x1 - 1; x += 2) { put(m, v, 'backbar', x, B.y0); put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); put(m, v, 'stool', x + 1, y + 1); } m.points[staffId(v, 0)] = { x: x0 + 2, y: B.y0 + 1 }; };
const stagePad = (m, v, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(m, v, 'stage', x, y); for (let x = x0; x <= x1; x++) put(m, v, 'stage_edge', x, y1 + 1); };
const staffAt = (m, v, i, x, y) => { m.points[staffId(v, i)] = { x, y }; };
const fillRest = (m, v) => { KIND[v.kind].roles.forEach((r, i) => { if (!m.points[staffId(v, i)]) m.points[staffId(v, i)] = { x: m.building(v.id).doorX + (i % 2 ? 1 : -1) * (1 + i), y: m.building(v.id).doorY - 2 }; }); };
L.strip = (m, v, B) => {
  const sx0 = B.x0 + 3, sx1 = B.x1 - 3, sy0 = B.y0, sy1 = B.y0 + 4;
  stagePad(m, v, sx0, sy0, sx1, sy1);
  // two private rooms off the floor, behind curtains, either side of the stage
  for (const [cx, dir] of [[B.x0 + 1, 1], [B.x1 - 1, -1]].filter(() => B.y1 - 4 > sy1 + 2)) { put(m, v, 'curtain', cx + dir, sy1 + 1); put(m, v, 'sofa', dir > 0 ? B.x0 : B.x1 - 1, sy1 + 1); put(m, v, 'lowtable', cx, sy1 + 2); }
  m.vstage = m.vstage || {}; m.vstage[v.id] = { x0: sx0, y0: sy0, x1: sx1, y1: sy1, pole: { x: Math.floor((sx0 + sx1) / 2), y: sy0 + 2 } };
  put(m, v, 'pole', m.vstage[v.id].pole.x, m.vstage[v.id].pole.y); put(m, v, 'neon_heart', sx0, sy0 - 1 < B.y0 ? sy0 : sy0 - 1); put(m, v, 'neon_heart', sx1 - 1, sy0);
  for (let x = sx0; x <= sx1 - 1; x += 2) { if (sy1 + 3 === B.y1 - 4 && x <= B.x0 + 3) continue; put(m, v, 'seat', x, sy1 + 3); put(m, v, 'seat', x + 1, sy1 + 3); }   // (in a short room the back bar takes the end of the row)
  for (const x of [B.x0, B.x1]) { put(m, v, 'booth', x === B.x0 ? B.x0 : B.x1 - 1, B.y0 + 1); put(m, v, 'lowtable', x, B.y0 + 3); }
  for (let x = B.x0; x <= B.x1 - 1 && x < v.barW + B.x0; x += 2) { /* (see below) */ }
  const by = B.y1 - 3; for (let x = B.x0; x <= B.x0 + 5; x += 2) { put(m, v, 'bar', x, by); put(m, v, 'stool', x, by + 1); put(m, v, 'stool', x + 1, by + 1); } put(m, v, 'backbar', B.x0, by - 1 < B.y0 ? by : by - 1); put(m, v, 'backbar', B.x0 + 2, by - 1);
  staffAt(m, v, 0, B.x0 + 7, by); staffAt(m, v, 1, B.cx + 2, B.y1 - 1);
  put(m, v, 'sofa', B.x1 - 3, by); put(m, v, 'sofa', B.x1 - 1, by); put(m, v, 'neon_bar', B.x1 - 3, by - 1); put(m, v, 'lowtable', B.x1 - 2, by + 1);   // VIP
  for (let i = 2; i < 5; i++) staffAt(m, v, i, sx0 + i, sy1 + 1);
};
L.cinema = (m, v, B) => {
  const rooms = v.rooms || 1, mid = B.y0 + Math.floor((B.y1 - B.y0) * 0.68);
  m.fill(B.x0, mid, B.x1 - B.x0 + 1, 1, T.wall_dark);
  const rw = Math.floor((B.x1 - B.x0 + 1) / rooms);
  m.vrooms = m.vrooms || {}; m.vrooms[v.id] = [];
  for (let r = 0; r < rooms; r++) {
    const x0 = B.x0 + r * rw, x1 = x0 + rw - 1 - (r < rooms - 1 ? 1 : 0), cx = Math.floor((x0 + x1) / 2);
    if (r < rooms - 1) m.fill(x1 + 1, B.y0, 1, mid - B.y0, T.wall_dark);
    m.fill(x0, B.y0, x1 - x0 + 1, mid - B.y0, T.darkstone);
    put(m, v, 'screen', cx - 2, B.y0);
    for (let y = B.y0 + 3; y < mid - 1; y += 2) for (let x = x0 + 1; x <= x1 - 1; x++) if (x !== cx) put(m, v, 'seat', x, y);
    put(m, v, 'projector', cx, mid - 1);
    m.set(cx + 1, mid, T.door); m.set(cx, mid, T.door);
    m.vrooms[v.id].push({ x0, x1, y0: B.y0, y1: mid - 1, door: { x: cx, y: mid + 1 } });
  }
  put(m, v, 'ticket_booth', B.x0, B.y1 - 2); staffAt(m, v, 0, B.x0, B.y1 - 3); put(m, v, 'popcorn', B.x1 - 1, B.y1 - 2); staffAt(m, v, 2, B.x1 - 1, B.y1 - 3); staffAt(m, v, 1, B.cx + 2, mid + 2);
  put(m, v, 'ticket_machine', B.x0 + 3, B.y1 - 1); for (const x of [B.x0 + 4, B.x0 + 6, B.x1 - 6, B.x1 - 4]) put(m, v, 'poster', x, mid + 1);
};
L.theater = (m, v, B) => {
  const small = v.kind === 'blackbox', by = B.y0 + (small ? 3 : 4), sy1 = by + (small ? 3 : 4), xs = small ? B.x0 + 1 : B.x0 + 3, xe = small ? B.x1 - 1 : B.x1 - 3;
  m.fill(B.x0, by - 1, B.x1 - B.x0 + 1, 1, T.wall_dark); m.set(B.x0, by - 1, T.door); m.set(B.x1, by - 1, T.door);   // backstage behind the stage
  put(m, v, 'makeup_table', B.x0, B.y0); put(m, v, 'costume_rack', B.x0 + 3, B.y0); put(m, v, 'prop_throne', B.x1 - 2, B.y0 + 1); put(m, v, 'prop_tree', B.x1 - 4, B.y0 + 1);
  stagePad(m, v, xs, by, xe, sy1);
  for (const x of [xs - 1, xe + 1]) for (const y of [by, by + 1]) if (x >= B.x0 && x <= B.x1) put(m, v, 'curtain', x, y + 2);
  put(m, v, 'stagelight', xs + 1, by); put(m, v, 'stagelight', xe - 1, by); if (!small) put(m, v, 'stagelight', B.cx, by);
  m.vstage = m.vstage || {}; m.vstage[v.id] = { x0: xs, y0: by, x1: xe, y1: sy1 };
  const end = B.y1 - 3; for (let y = sy1 + 3; y <= end; y += 2) for (let x = B.x0 + 1; x <= B.x1 - 1; x++) if (Math.abs(x - B.cx) > 0) put(m, v, 'seat', x, y);
  put(m, v, 'ticket_machine', B.x0, B.y1); staffAt(m, v, 0, B.x0 + 2, B.y1); staffAt(m, v, 1, B.cx + 2, B.y1); put(m, v, 'poster', B.x1 - 2, B.y1);
  for (let i = 2; i < KIND[v.kind].roles.length; i++) staffAt(m, v, i, xs + i, by + 1);
  if (small) staffAt(m, v, 1, xs + 2, by + 1);
};
L.blackbox = L.theater;
const dance = (m, v, B) => { const y1 = B.y0 + 7, x0 = B.x0 + 2, x1 = B.x1 - 2; m.fill(x0, B.y0 + 3, x1 - x0 + 1, y1 - B.y0 - 3, T.darkstone); m.vdance = m.vdance || {}; m.vdance[v.id] = { x0, x1, y0: B.y0 + 3, y1 }; };
L.club = (m, v, B) => { dance(m, v, B); put(m, v, 'djbooth', B.cx - 1, B.y0); put(m, v, 'speaker', B.cx - 4, B.y0 + 1); put(m, v, 'speaker', B.cx + 3, B.y0 + 1); put(m, v, 'neon_bar', B.x0 + 1, B.y0); put(m, v, 'neon_heart', B.x1 - 2, B.y0); staffAt(m, v, 1, B.cx, B.y0 + 1); const y = B.y1 - 4; for (let x = B.x0; x <= B.x0 + 7; x += 2) { put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); put(m, v, 'stool', x + 1, y + 1); } staffAt(m, v, 0, B.x0 + 3, y - 1); for (let x = B.x1 - 5; x <= B.x1 - 1; x += 2) put(m, v, 'sofa', x, B.y1 - 3); staffAt(m, v, 2, B.cx + 2, B.y1); };
L.punk = (m, v, B) => { stagePad(m, v, B.x1 - 7, B.y0, B.x1 - 1, B.y0 + 2); put(m, v, 'drums', B.x1 - 4, B.y0); put(m, v, 'guitaramp', B.x1 - 6, B.y0 + 1); put(m, v, 'mic', B.x1 - 2, B.y0 + 2); put(m, v, 'speaker', B.x1 - 7, B.y0 + 1); barAlong(m, v, B, B.y0 + 2, B.x0, B.x0 + 4); put(m, v, 'graffiti1', B.x0, B.y1); put(m, v, 'graffiti2', B.x1 - 3, B.y1); put(m, v, 'worn_couch', B.x0, B.y1 - 2); put(m, v, 'jukebox', B.x0 + 4, B.y1 - 1); staffAt(m, v, 1, B.cx + 2, B.y1); };
L.live = (m, v, B) => { stagePad(m, v, B.x0 + 4, B.y0, B.x1 - 4, B.y0 + 3); put(m, v, 'drums', B.cx - 1, B.y0); put(m, v, 'piano', B.x0 + 4, B.y0 + 1); put(m, v, 'guitaramp', B.x1 - 5, B.y0 + 1); put(m, v, 'mic', B.cx, B.y0 + 3); put(m, v, 'stagelight', B.x0 + 5, B.y0); put(m, v, 'stagelight', B.x1 - 5, B.y0); m.vstage = m.vstage || {}; m.vstage[v.id] = { x0: B.x0 + 4, y0: B.y0, x1: B.x1 - 4, y1: B.y0 + 3 }; const y = B.y1 - 3; for (let x = B.x0; x <= B.x0 + 5; x += 2) { put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); put(m, v, 'stool', x + 1, y + 1); } staffAt(m, v, 0, B.x0 + 7, y); staffAt(m, v, 1, B.cx + 2, B.y1); for (let x = B.x1 - 5; x < B.x1 - 1; x += 2) put(m, v, 'booth', x, y); };
L.dive = (m, v, B) => { barAlong(m, v, B); put(m, v, 'jukebox', B.x0, B.y1 - 1); put(m, v, 'dartboard', B.x1, B.y0 + 4); put(m, v, 'booth', B.x1 - 2, B.y1 - 2); put(m, v, 'foosball', B.x0 + 2, B.y1 - 1); };
L.karaoke = (m, v, B) => { stagePad(m, v, B.x0 + 3, B.y0, B.x1 - 3, B.y0 + 2); put(m, v, 'mic', B.cx, B.y0 + 1); put(m, v, 'speaker', B.x0 + 3, B.y0); put(m, v, 'speaker', B.x1 - 3, B.y0); const y = B.y1 - 2; for (let x = B.x0; x <= B.x0 + 5; x += 2) { put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); } staffAt(m, v, 0, B.x0 + 7, y); put(m, v, 'sofa', B.x1 - 3, B.y0 + 5); put(m, v, 'sofa', B.x0, B.y0 + 5); put(m, v, 'lowtable', B.x1 - 2, B.y0 + 6); };
L.rooftop = (m, v, B) => { put(m, v, 'stairs', B.cx - 1, B.y0); m.addExit(B.cx - 1, B.y0, 2, 1, 'neon_roof', 'from_neon', 'Up to the roof'); put(m, v, 'lowtable', B.x0, B.y1); staffAt(m, v, 0, B.cx + 3, B.y0 + 2); };
L.pool = (m, v, B) => { for (let y = B.y0 + 1; y <= B.y1 - 5; y += 4) { put(m, v, 'pool_table', B.x0 + 2, y); put(m, v, 'pool_table', B.x1 - 4, y); } const y = B.y1 - 2; for (let x = B.x0; x <= B.x0 + 5; x += 2) { put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); } staffAt(m, v, 0, B.x0 + 7, y); put(m, v, 'jukebox', B.x1, B.y1 - 1); put(m, v, 'dartboard', B.x1, B.y0); put(m, v, 'chess_table', B.x1 - 2, B.y1 - 1); };
L.arcade = (m, v, B) => { const g = ['arcade1', 'arcade2', 'arcade3']; for (let i = 0, x = B.x0; x <= B.x1; x += 2, i++) put(m, v, g[i % 3], x, B.y0 + 1); for (let i = 1, x = B.x0 + 1; x <= B.x1 - 1; x += 3, i++) put(m, v, g[i % 3], x, B.y0 + 5); put(m, v, 'foosball', B.x0 + 1, B.y0 + 9); put(m, v, 'foosball', B.x1 - 3, B.y0 + 9); put(m, v, 'neon_bar', B.cx, B.y0); staffAt(m, v, 0, B.x0 + 1, B.y1); put(m, v, 'counter', B.x0, B.y1 - 1); };
L.bowling = (m, v, B) => { for (let i = 0; i < 3; i++) { const x = B.x0 + 1 + i * 4; for (let y = B.y0 + 1; y <= B.y1 - 6; y++) { put(m, v, 'bowling_lane', x, y); put(m, v, 'bowling_lane', x + 1, y); } put(m, v, 'bowling_pins', x, B.y0); put(m, v, 'bowling_pins', x + 1, B.y0); put(m, v, 'bowling_rack', x, B.y1 - 4); } staffAt(m, v, 0, B.x1 - 1, B.y1 - 1); put(m, v, 'counter', B.x1 - 2, B.y1 - 2); for (let x = B.x0; x <= B.x0 + 4; x += 2) put(m, v, 'booth', x, B.y1 - 2); };
L.casino = (m, v, B) => { for (let x = B.x0 + 1; x <= B.x1 - 1; x += 2) m.addDecor('slot_machine', x, B.y0 + 1); for (const [t, x] of [['bj_table', B.x0 + 2], ['roulette', B.x1 - 5]]) m.addDecor(t, x, B.y0 + 4); staffAt(m, v, 0, B.x0 + 3, B.y0 + 3); const y = B.y1 - 2; for (let x = B.x0; x <= B.x0 + 5; x += 2) { put(m, v, 'bar', x, y); put(m, v, 'stool', x, y + 1); } staffAt(m, v, 1, B.x0 + 7, y); staffAt(m, v, 2, B.cx + 2, B.y1); };
L.den = (m, v, B) => { L.casino(m, v, B); put(m, v, 'graffiti3', B.x0, B.y1); };
L.internet = (m, v, B) => { for (let y = B.y0; y <= B.y1 - 2; y += 3) for (let x = B.x0; x <= B.x1 - 1; x += 3) { m.addDecor('v_pc', x, y); put(m, v, 'stool', x, y + 1); } put(m, v, 'counter', B.x1 - 2, B.y1); staffAt(m, v, 0, B.x1, B.y1 - 1); };
const restaurant = (m, v, B, open) => { for (let y = B.y0 + 2; y <= B.y1 - 2; y += 3) for (let x = B.x0 + 1; x <= B.x1 - 1; x += 3) { put(m, v, 'rtable', x, y); put(m, v, 'stool', x, y + 1); if (x + 1 <= B.x1) put(m, v, 'stool', x + 1, y); } put(m, v, 'counter', B.x0, B.y0); put(m, v, open || 'menu_board', B.x0 + 2, B.y0); staffAt(m, v, 0, B.x0 + 4, B.y0 + 1); staffAt(m, v, 1, B.x0 + 1, B.y0 + 1); if (m.points[staffId(v, 1)].y) put(m, v, 'mirror', B.x1 - 2, B.y0); };
L.italian = L.japanese = L.brazilian = L.diner = (m, v, B) => restaurant(m, v, B);
L.cafe = (m, v, B) => restaurant(m, v, B, 'espresso');
L.gym = (m, v, B) => { for (let x = B.x0; x <= B.x1 - 1; x += 3) put(m, v, 'treadmill', x, B.y0); for (let x = B.x0; x <= B.x1 - 1; x += 4) put(m, v, 'benchpress', x, B.y0 + 3); for (let x = B.x0 + 1; x <= B.x1; x += 4) put(m, v, 'heavybag', x, B.y0 + 6); put(m, v, 'lockers', B.x0, B.y1); put(m, v, 'mirror', B.x1 - 2, B.y1); staffAt(m, v, 0, B.cx + 2, B.y1 - 1); };
L.museum = (m, v, B) => { put(m, v, 'dino', B.cx - 1, B.y0 + 3); put(m, v, 'display_case', B.x0 + 1, B.y0); put(m, v, 'display_case', B.x1 - 2, B.y0); put(m, v, 'display_case', B.x0 + 1, B.y0 + 6); put(m, v, 'display_case', B.x1 - 2, B.y0 + 6); put(m, v, 'sculpture', B.x0 + 4, B.y0 + 9); put(m, v, 'sculpture', B.x1 - 4, B.y0 + 9); for (let x = B.x0 + 4; x <= B.x1 - 5; x += 3) put(m, v, 'painting', x, B.y0); staffAt(m, v, 0, B.cx + 3, B.y1 - 1); put(m, v, 'counter', B.x0, B.y1 - 1); };
L.gallery = (m, v, B) => { let i = 0; for (let x = B.x0; x <= B.x1 - 1; x += 3) put(m, v, i++ % 2 ? 'painting2' : 'painting', x, B.y0); put(m, v, 'sculpture', B.x0 + 3, B.y0 + 4); put(m, v, 'sculpture', B.x1 - 3, B.y0 + 4); staffAt(m, v, 0, B.cx + 2, B.y1 - 1); };
L.library = (m, v, B) => { for (let y = B.y0; y <= B.y1 - 6; y += 4) for (let x = B.x0; x <= B.x1 - 1; x += 3) put(m, v, 'bookcase', x, y); for (let x = B.x0 + 1; x <= B.x1 - 4; x += 4) { put(m, v, 'reading_desk', x, B.y1 - 3); put(m, v, 'stool', x, B.y1 - 2); } put(m, v, 'counter', B.x1 - 2, B.y1 - 1); staffAt(m, v, 0, B.x1 - 1, B.y1 - 2); };
L.store = (m, v, B) => { const r = v.stock === 'vintage' ? 'clothes_rack' : v.stock === 'books' ? 'bookcase' : 'record_rack'; for (let y = B.y0; y <= B.y1 - 3; y += 3) for (let x = B.x0; x <= B.x1 - 1; x += 3) if (Math.abs(x - B.cx) > 1) put(m, v, r, x, y); put(m, v, 'counter', B.x1 - 2, B.y1 - 1); staffAt(m, v, 0, B.x1 - 1, B.y1 - 2); if (v.stock === 'music') { put(m, v, 'piano', B.x0, B.y1 - 1); put(m, v, 'guitaramp', B.x0 + 3, B.y1 - 1); } };
L.tattoo = (m, v, B) => { put(m, v, 'tattoo_chair', B.x0, B.y0 + 1); put(m, v, 'tattoo_chair', B.x1 - 2, B.y0 + 1); put(m, v, 'painting2', B.x0 + 3, B.y0); staffAt(m, v, 0, B.cx, B.y0 + 3); put(m, v, 'sofa', B.x0, B.y1 - 1); };
L.barber = (m, v, B) => { for (let x = B.x0; x <= B.x1 - 1; x += 3) { put(m, v, 'mirror', x, B.y0); put(m, v, 'barber_chair', x + 1, B.y0 + 2); } staffAt(m, v, 0, B.cx + 1, B.y0 + 3); put(m, v, 'barber_pole', B.x1, B.y1); put(m, v, 'sofa', B.x0, B.y1 - 1); };
L.office = (m, v, B) => { put(m, v, 'counter', B.x0 + 2, B.y0 + 2); put(m, v, 'counter', B.x0 + 4, B.y0 + 2); put(m, v, 'counter', B.x0 + 6, B.y0 + 2); staffAt(m, v, 0, B.x0 + 3, B.y0 + 1); staffAt(m, v, 1, B.x0 + 6, B.y0 + 1); put(m, v, 'bookcase', B.x1 - 2, B.y0); for (let x = B.x0; x <= B.x0 + 3; x += 2) put(m, v, 'stool', x, B.y1 - 1); };
L.market = () => {};
const signFor = (v) => (G.vk.wallSign ? G.vk.wallSign(v) : null);   // (js/game/worldsigns.js; it signs the built-in venues itself)
for (const v of VS) v.signDecor = signFor(v);
const Sys = G.venueSys = {
  KIND, L,
  // a venue opened during the game (js/game/realestate.js)
  staffFor(v) { if (G.NPCS[staffId(v, 0)]) return; makeStaff(v); v.signDecor = signFor(v); G.vk.paintAll(); },
  build(m, v, r) {
    const b = m.addBuilding(v.id, v.x, v.y, v.w, v.h, { name: v.name, wall: v.wall || 'wall_brick', floor: v.floor || 'tilefloor', roof: v.roof || 'flat_dark', kind: 'venue', chimney: false, grow: false });
    b.venue = v.id; b.ownerId = 'venue';
    (L[v.kind] || (() => {}))(m, v, box(b), r);
    fillRest(m, v);
    const s = m.addDecor(v.signDecor, Math.max(b.x, b.doorX - 3), b.doorY); s.x = Math.round((b.x * 16 + b.doorX * 16) / 2 + 8); s.y = b.doorY * 16 + 10; if (s.light) { s.light.x = s.x; s.light.y = s.y; }
    return b;
  },
  st(w, id) { const v = G.VENUES[id], s = (w.venues = w.venues || {}); return s[id] || (s[id] = { till: 200, visits: 0, today: 0, rep: 50 + (G.util.hashString(id) % 25), priceK: 1, owner: null, closed: false }); },
  isOpen(w, id, h = w.hourF) { const v = G.VENUES[id], st = this.st(w, id); if (st.closed || st.sealed) return false; const [a, b] = st.hours || v.hours; return a < b ? h >= a && h < b : h >= a || h < b; },
  price(w, id, n) { return Math.max(1, Math.round(n * this.st(w, id).priceK)); },
  busy(w) { return (w.hour >= 20 || w.hour < 2 ? 1.7 : w.hour >= 17 ? 1.2 : 0.7) * (w.day % 7 === 5 || w.day % 7 === 6 ? 1.5 : 1); },
  // how much this person would like to go there, right now (0 = not at all)
  taste(id, st, v, w) {
    const d = G.NPCS[id], k = KIND[v.kind], life = G.lifestyle.of(id), base = k.likes[life] || 0; if (!base) return 0;
    if (k.adult && (d.kid || d.ageGroup === 'kid')) return 0;
    const need = (k.entry || 0) + (k.spend || 0); if ((st.gold || 0) < need) return 0;
    const seed = G.util.hashString(id + v.kind) % 100, habit = seed < 18 ? 3 : seed < 55 ? 1 : seed < 80 ? 0.3 : 0;   // some people never go, some always do
    return base * habit * (this.st(w, v.id).rep / 60);
  },
  charge(w, id, st, v) { const k = KIND[v.kind], s = this.st(w, v.id), base = (k.entry || 0) + Math.round((k.spend || 0) * (0.6 + Math.random())), n = base > 0 ? this.price(w, v.id, base) : 0, paid = Math.min(st.gold || 0, n); st.gold -= paid; s.till += paid; s.visits++; s.today++; st.lastVenue = v.id; return paid; },
  // people here go out
  pickFor(npc, scene) {
    const w = scene.world, opts = [];
    for (const b of scene.map.buildings) { if (!b.venue) continue; const v = G.VENUES[b.venue]; if (!this.isOpen(w, v.id) || (G.NPCS[npc.id] && G.NPCS[npc.id].venue === v.id)) continue; const t = this.taste(npc.id, npc.st, v, w); if (t > 0) opts.push([t, v, b]); }
    if (!opts.length) return null;
    let n = Math.random() * opts.reduce((s, o) => s + o[0], 0), c = opts[0]; for (const o of opts) { n -= o[0]; if (n <= 0) { c = o; break; } }
    const [, v, b] = c, seat = this.seat(scene, v.id) || { x: b.doorX + (Math.random() < 0.5 ? 2 : -2), y: b.doorY - 2 };
    return { kind: 'venue', venue: v.id, line: pick(['Going out tonight.', `I feel like ${v.name}.`, 'I earned this.']), pt: seat, until: G.effects.now() + (1 + Math.random() * 2) * 60, act: 'idle', seat: !!seat.seat };
  },
  seat(scene, id) { const m = scene.map, list = (m.vseats || {})[id] || []; const g = G.everyday.claims(m); const free = list.filter((s) => { const k = G.everyday.seatKey(s.x, s.y); return !g.get(k); }); const s = pick(free.length ? free : list); return s ? { x: s.x, y: s.y, seat: true, perch: s.perch } : null; },
  arrived(npc, g, scene) { const v = G.VENUES[g.venue]; this.charge(scene.world, npc.id, npc.st, v); npc.seated = !!g.seat; npc.perch = (g.seat && g.pt && g.pt.perch) || null; npc.dir = npc.perch ? npc.perch.dir : 3; if (scene.player && npc.distTo(scene.player) < 180 && Math.random() < 0.3) npc.say(pick(['Good to be out.', 'Same again, please.', 'I love this place.', 'It is packed tonight.']), 2.5); },
  // elsewhere, every hour
  hourly(w) {
    const here = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene), ids = Object.keys(w.npcs), busy = this.busy(w);
    for (const v of VS) {
      if (!this.isOpen(w, v.id)) continue;
      if (here && here.map.id === v.map) continue;     // (there, the real people are doing it)
      const n = Math.round((KIND[v.kind].entry || KIND[v.kind].spend ? 2 : 1) * busy * (this.st(w, v.id).rep / 60) * (1 + Math.random()));
      for (let i = 0, tries = 0; i < n && tries < 18; tries++) { const id = pick(ids), st = w.npcs[id]; if (!G.NPCS[id] || !st.alive || (st.jailedUntil > w.day) || this.taste(id, st, v, w) <= 0.4) continue; this.charge(w, id, st, v); i++; }
    }
  },
};
// ---------------------------------------------------------------- the districts
G.WILD_EXCLUDE = (G.WILD_EXCLUDE || []).concat(['neon', 'arts']);
G.MAPGEN.neon = () => {
  const m = new G.TileMap('neon', 130, 90, T.sidewalk);
  m.meta = { name: 'Neon Row', region: 'city', music: 'city', darkness: 0, district: 'neon', maxDark: 0.34 };
  const r = new G.RNG('neon');
  const roads = [{ h: true, at: 15, from: 0, to: 129 }, { h: true, at: 45, from: 0, to: 129 }, { h: true, at: 74, from: 0, to: 129 }, { h: false, at: 18, from: 0, to: 89 }, { h: false, at: 64, from: 0, to: 89 }, { h: false, at: 106, from: 0, to: 89 }];
  D.roads(m, roads);
  for (const v of VS) if (v.map === 'neon') Sys.build(m, v, r);
  const f1 = m.addBuilding('n_flats', 70, 79, 14, 10, { name: 'Neon Flats', wall: 'wall_brick', floor: 'woodfloor', roof: 'flat', kind: 'house' }); MB.furnish(m, f1, 'house', r, { owner: 'n_r1', beds: 6 });
  const f2 = m.addBuilding('n_flats2', 88, 79, 14, 10, { name: 'Neon Flats', wall: 'wall_brick', floor: 'woodfloor', roof: 'flat', kind: 'house' }); MB.furnish(m, f2, 'house', r, { owner: 'n_r0', beds: 6 });
  m.addBuilding('n_ruin', 54, 79, 9, 9, { name: 'Old Laundromat', wall: 'wall_plaster', floor: 'concrete', roof: 'flat_dark', kind: 'house' });
  m.points.n_plaza = { x: 66, y: 43 }; m.points.n_plaza2 = { x: 30, y: 43 }; m.points.n_plaza3 = { x: 100, y: 43 }; m.points.n_plaza4 = { x: 60, y: 72 };
  D.lamps(m, roads, 5); D.park(m, r, roads, 10, ['car_gray', 'car_black', 'car_white']);
  MB.scatter(m, r, ['trash', 'trashcan', 'hydrant', 'bench'], 40, 0, 0, 129, 89, [T.sidewalk]);
  for (const [x, y] of [[24, 42], [50, 42], [90, 42], [30, 70], [100, 70]]) D.put(m, 'v_payphone', x, y, [T.sidewalk]);
  m.points.from_city = { x: 65, y: 87 }; m.points.from_arts = { x: 127, y: 47 };
  m.addExit(64, 89, 4, 1, 'city', 'from_neon', 'To Center'); m.addExit(129, 45, 1, 4, 'arts', 'from_neon', 'To Old Quarter');
  m.dangerZones = [];
  m.finalize();
  return m;
};
G.MAPGEN.neon_roof = () => {
  const m = new G.TileMap('neon_roof', 26, 18, T.wall_concrete);
  m.meta = { name: 'Skyline', region: 'city', music: 'city', darkness: 0, district: 'neon', indoor: true, ownLight: 0.15 };
  m.fill(1, 1, 24, 16, T.woodfloor); const v = G.VENUES.v_skyline;
  for (let x = 3; x < 22; x += 2) { put(m, v, 'bar', x, 3); put(m, v, 'stool', x, 4); put(m, v, 'stool', x + 1, 4); } m.points[staffId(v, 0)] = { x: 8, y: 2 };
  for (const [x, y] of [[3, 8], [9, 8], [15, 8], [20, 8], [6, 12], [17, 12]]) { put(m, v, 'sofa', x, y); put(m, v, 'lowtable', x, y + 1); }
  put(m, v, 'neon_bar', 12, 1); put(m, v, 'stairs', 12, 16); m.points.from_neon = { x: 13, y: 14 };
  m.addExit(12, 17, 2, 1, 'neon', 'from_roof', 'Back down');
  m.finalize();
  return m;
};
const LOTS = [[3, 68, 14, 11], [19, 68, 14, 11], [35, 68, 14, 11], [51, 68, 18, 11]];
G.MAPGEN.arts = () => {
  const m = new G.TileMap('arts', 124, 108, T.sidewalk);
  m.meta = { name: 'Old Quarter', region: 'city', music: 'city', darkness: 0, district: 'arts' };
  const r = new G.RNG('arts');
  const roads = [{ h: true, at: 26, from: 0, to: 123 }, { h: true, at: 49, from: 0, to: 123 }, { h: true, at: 81, from: 0, to: 123 }, { h: false, at: 113, from: 0, to: 107 }];
  D.roads(m, roads);
  for (const v of VS) if (v.map === 'arts') Sys.build(m, v, r);
  const f1 = m.addBuilding('a_flats', 72, 68, 14, 12, { name: 'Quarter Flats', wall: 'wall_brick', floor: 'woodfloor', roof: 'flat', kind: 'house' }); MB.furnish(m, f1, 'house', r, { owner: 'a_r1', beds: 6 });
  const f2 = m.addBuilding('a_flats2', 88, 68, 14, 12, { name: 'Quarter Flats', wall: 'wall_brick', floor: 'woodfloor', roof: 'flat', kind: 'house' }); MB.furnish(m, f2, 'house', r, { owner: 'a_r0', beds: 6 });
  m.addBuilding('a_ruin', 103, 68, 9, 11, { name: 'Old Boarding House', wall: 'wall_plaster', floor: 'woodfloor', roof: 'flat_dark', kind: 'house' });
  // outdoors: the public pool, the court, the skate park, the flea market, the plaza
  m.fill(94, 18, 18, 8, T.plaza); m.fill(96, 19, 14, 6, T.pool);
  m.addDecor('v_lifeguard', 94, 22); m.points.a_pool = { x: 95, y: 18 };
  m.fill(4, 88, 20, 14, T.court); m.addDecor('v_hoop', 13, 89); m.addDecor('v_hoop', 13, 101); m.points.a_court = { x: 13, y: 95 };
  m.fill(28, 88, 22, 16, T.concrete); m.addDecor('v_skate_ramp', 31, 91); m.addDecor('v_skate_ramp', 42, 91); m.addDecor('v_rail', 36, 96); m.addDecor('v_rail', 33, 100); m.points.a_skate = { x: 38, y: 98 };
  m.fill(54, 88, 26, 16, T.plaza); const fl = G.VENUES.v_flea; for (let i = 0; i < 3; i++) { m.addDecor('v_stall', 57 + i * 8, 92); m.addDecor('v_stall', 57 + i * 8, 98); m.points[staffId(fl, i)] = { x: 58 + i * 8, y: 91 }; } m.points.a_flea_park = { x: 66, y: 96 }; m.points[fl.id + '_door'] = { x: 66, y: 103 };
  m.fill(84, 88, 26, 18, T.grass); m.fill(88, 92, 18, 12, T.water); m.fill(95, 88, 3, 8, T.dock); m.addDecor('bench', 90, 90); m.addDecor('bench', 101, 90); m.points.a_pond_park = { x: 97, y: 89 };
  for (const [x, y, w, h] of LOTS) { m.fill(x, y, w, h, T.lot); m.addDecor('v_sale_sign', x + 1, y + h - 1); }
  m.points.a_plaza = { x: 60, y: 47 };
  D.lamps(m, roads, 8); D.park(m, r, roads, 8, ['car_gray', 'car_white', 'car_black']);
  MB.scatter(m, r, ['trash', 'trashcan', 'bench', 'hydrant'], 30, 0, 0, 123, 83, [T.sidewalk]);
  m.points.from_neon = { x: 2, y: 28 };
  m.addExit(0, 26, 1, 4, 'neon', 'from_arts', 'To Neon Row');
  m.dangerZones = [];
  m.finalize();
  return m;
};
G.ART_LOTS = LOTS;
const _city = G.MAPGEN.city;
G.MAPGEN.city = () => { const m = _city(); m.points.from_neon = { x: 83, y: 2 }; m.exits.unshift({ x: 82, y: 0, w: 4, h: 1, to: 'neon', spawn: 'from_city', label: 'To Neon Row' }); return m; };
const _nn = G.MAPGEN.neon; G.MAPGEN.neon = () => { const m = _nn(); m.points.from_roof = { x: G.VENUES.v_skyline.x + 7, y: G.VENUES.v_skyline.y + 7 }; return m; };
const _ind = G.MAPGEN.industrial;
G.MAPGEN.industrial = () => { const m = _ind(), r = new G.RNG('portvenues'); for (const v of VS) if (v.map === 'industrial') { G.home.clearArea(m, v.x, v.y, v.w, v.h); Sys.build(m, v, r); } m.computeSolids(); m.prerender(); return m; };
// ---------------------------------------------------------------- doors, hours
const DD = G.doors, _pub = DD.isPublic; DD.isPublic = function (scene, b) { if (b.venue) return Sys.isOpen(scene.world, b.venue); return _pub.apply(this, arguments); };
const _locked = DD.locked; DD.locked = function (scene, b) { if (b.venue && !Sys.isOpen(scene.world, b.venue) && !(scene.world.keys || {})[b.id]) return true; return _locked.apply(this, arguments); };
const _shopOpen = G.shopSys.isOpen; G.shopSys.isOpen = function (shopId, scene) { const vid = shopId.startsWith('shop_') ? shopId.slice(5) : null; if (vid && G.VENUES[vid] && !Sys.isOpen(scene.world, vid)) return false; return _shopOpen.apply(this, arguments); };
// ---------------------------------------------------------------- people going out
const LF = G.lifestyle, _pick = LF.pick;
LF.pick = function (npc, scene) { if (scene.map.buildings.some((b) => b.venue) && Math.random() < 0.65 && !G.NPCS[npc.id].venue) { const g = Sys.pickFor(npc, scene); if (g) return g; } return _pick.apply(this, arguments); };
const _lu = LF.update;
LF.update = function (npc, dt, scene) {
  const g = npc.errand, was = g && g.there, r = _lu.apply(this, arguments);
  if (g && g.kind === 'venue' && !was && g.there) Sys.arrived(npc, g, scene);
  if (g && g.kind === 'venue' && !npc.errand) npc.seated = false;
  return r;
};
// a night out across town
const TR = G.travel, _wants = TR.WANTS;
for (const k of ['worker', 'gang', 'dealer', 'rich', 'retiree']) if (_wants[k]) _wants[k].push('neon', 'arts');
const _can = TR.canTravel;
TR.canTravel = function (id, st, w) { const h = w.hour; if (h >= 18 && h < 22) return _can.call(this, id, st, Object.create(w, { hour: { value: 12 } })) && (st.gold || 0) >= 25; return _can.call(this, id, st, w); };   // (hour is a getter on the world: ask as if it were noon, on a view of it)
G.events.on('hour', () => { if (G.world) try { Sys.hourly(G.world); } catch (e) { if (G.reportError) G.reportError(e); } });
G.events.on('newDay', () => { const w = G.world; if (w) for (const v of VS) Sys.st(w, v.id).today = 0; });
const _wl = G.onWorldLoaded;
G.onWorldLoaded = function (w) { if (_wl) _wl.apply(this, arguments); w.shops = w.shops || {}; for (const k in G.SHOPS) if (k.startsWith('shop_v_') && !w.shops[k]) w.shops[k] = { stock: G.util.clone(G.SHOPS[k].stock), gold: G.SHOPS[k].gold, owner: G.SHOPS[k].owner }; };
// ---------------------------------------------------------------- at the counter
const venueAt = (scene, d) => { const b = scene.map.buildingAtTile(d.tx, d.ty); return (b && b.venue) || (scene.map.id === 'neon_roof' ? 'v_skyline' : scene.map.id === 'arts' && d.type === 'v_stall' ? 'v_flea' : null); };
const menu = (scene, vid) => {
  const v = G.VENUES[vid], k = KIND[v.kind], w = scene.world, p = scene.player, st = Sys.st(w, vid);
  if (!Sys.isOpen(w, vid)) { scene.toast(`${v.name} is closed.`, 'warn'); return; }
  if ((st.out || []).includes(0)) { scene.toast('Nobody is serving.', 'warn'); return; }
  if (st.stock != null && st.stock <= 0) { scene.toast('Sold out. They have run out of everything.', 'warn'); return; }
  G.scenes.push(new G.ListScene(v.name, () => k.menu.map(([id, n]) => { const c = Sys.price(w, vid, n); return { label: `${G.item(id).name}   $${c}`, disabled: p.gold < c, act: () => { p.gold -= c; Sys.st(w, vid).till += c; Sys.st(w, vid).visits++; st.stock = Math.max(0, (st.stock != null ? st.stock : 80) - 0.5); G.audio.play('coin'); { const o = scene.actors.find((a) => a.kind === 'npc' && a.id === `${vid}_s0` && !a.dead); if (o && G.giveCash) G.giveCash(scene, p, o); } const it = G.item(id); if (it.type === 'consumable' && (it.heal || it.alcohol || it.stamina)) { G.effects.consume(p, it, scene); G.audio.play(it.alcohol ? 'drink' : 'eat'); return `${it.name}: enjoyed.`; } p.inventory.add(id, 1); return `${it.name}: bought.`; } }; })));
};
const JUKE = ['A slow song about a truck.', 'Something with too many guitars.', 'The one everybody pretends to hate.', 'A sad waltz. Somebody at the bar sighs.'];
const _use = GS.useDecor, _lab = GS.decorLabel;
const LABELS = { v_bar: 'Order a drink', v_menu: 'See the menu', v_jukebox: 'Play the jukebox ($1)', v_payphone: 'Use the phone', v_shelf: 'Browse', v_listing: 'Read the sign' };
GS.useDecor = function (d) {
  const k = d.def.interact, w = this.world, p = this.player, vid = venueAt(this, d);
  if (k === 'v_bar' || k === 'v_menu') { if (vid) menu(this, vid); return undefined; }
  if (k === 'v_jukebox') { if (p.gold < 1) { this.toast('You are out of coins.', 'warn'); return undefined; } p.gold -= 1; if (vid) Sys.st(w, vid).till += 1; G.audio.play('coin'); this.toast(`Now playing: ${pick(JUKE)}`, 'good'); for (const a of this.actors) if (a.kind === 'npc' && !a.dead && a.distTo(p) < 120 && Math.random() < 0.3) a.say(pick(['Good choice.', 'Not this one again.', 'Turn it up!']), 2.5); return undefined; }
  if (k === 'v_payphone') { if (p.gold < 1) { this.toast('The phone wants a dollar.', 'warn'); return undefined; } p.gold -= 1; G.audio.play('coin'); const r = (w.rumors || []).slice(-8), line = r.length ? pick(r) : null; G.scenes.push(new G.ChoiceScene('City Information Line', line ? (line.text || line) : 'Nothing to report. Thank you for calling.', [{ label: 'Hang up.', fn: () => {} }])); return undefined; }
  if (k === 'v_shelf') { const sid = 'shop_' + vid; if (w.shops[sid] && Sys.isOpen(w, vid)) { const o = this.actors.find((a) => a.id === w.shops[sid].owner && !a.dead); if (o) G.scenes.push(new G.ShopScene(this, sid, o)); else this.toast('Nobody at the counter.', 'warn'); } else this.toast('Closed.', 'warn'); return undefined; }
  return _use.apply(this, arguments);
};
GS.decorLabel = function (d) { return LABELS[d.def.interact] || _lab.apply(this, arguments); };
void NP; void F; void clamp;
})();
