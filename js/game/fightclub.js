'use strict';
// The Pit: an underground fight club under an old cannery in the Port District. Anyone can walk in.
//   The place: reception and manager, betting counter, a big roped arena with stands around it, fighters' rooms, an
//   underground bar, a corner where the dealers work and a corner where people use. Everyone in it is a real NPC.
//   Fighters (G.FIGHTERS) have their own look, stats, record and style, and each style fights differently (js below,
//   FC.ai): brawlers charge, boxers circle and throw combinations, wrestlers grab and throw, street fighters feint and
//   fight dirty, technicians wait and counter, heavyweights are slow and terrible.
//   Everything that happens in the ring is a knockout: nobody dies there, you included. Lose and you come to on the
//   floor outside the ropes with exactly 20 HP. Outside the ring the normal rules apply. Your weapon is held for you.
//   w.fc: { rec: { id: {w, l, s, best} }, card: [[a, b]...], survivalBest, payouts }
//   A match lives on scene._fc (never saved: loading a save inside the ring puts you back on the floor).
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, PL = G.Player.prototype, U = G.ui, T = G.T, pick = (a) => G.rng.pick(a), clamp = G.util.clamp;
const RING0 = { x0: 22, y0: 13, x1: 41, y1: 26 }, RING = Object.assign({}, RING0);   // RING0: the plan; RING: where it ended up (js/game/worldscale.js)
const px = (t) => t * 16 + 8, py = (t) => t * 16 + 12;
const G0 = (top, shirt, bottom, pants, o = {}) => Object.assign({ body: 'm', top, shirt, shirt2: shirt, bottom, pants }, o);
// name, style, str, sta, spd, dur, def, tec, agg, exp, look
const F = [
  ['fc_crusher', 'Knuckles Maddox', 'brawler', 82, 55, 50, 70, 25, 30, 90, 6, G0('tank', '#e8e4dc', 'pants', '#2a2a30', { build: 2, facial: 3, hair: '#3a2418', hairStyle: 2, race: 'caucasian' })],
  ['fc_saint', 'Saint Delgado', 'boxer', 60, 85, 80, 55, 75, 72, 55, 8, G0('tank', '#c02030', 'shorts', '#c02030', { build: 0, hair: '#14100e', hairStyle: 0, race: 'latino', hat: 'bandana', hatColor: '#e8e4dc' })],
  ['fc_ox', 'The Ox', 'wrestler', 86, 66, 42, 84, 50, 55, 60, 9, G0('tank', '#2848a0', 'shorts', '#2848a0', { build: 2, hair: '#20140c', hairStyle: 9, facial: 1, race: 'afro' })],
  ['fc_rat', 'Rat Costa', 'street', 56, 62, 78, 46, 40, 58, 88, 5, G0('hoodie', '#4a5a3a', 'pants', '#2e2e26', { build: 0, hair: '#5a3a1e', hairStyle: 5, facial: 2, race: 'latino' })],
  ['fc_prof', 'The Professor', 'technician', 58, 72, 68, 58, 85, 92, 35, 14, G0('tshirt', '#e8e4dc', 'pants', '#1e1e24', { hair: '#c8c8c8', hairStyle: 2, facial: 1, hat: 'bandana', hatColor: '#3a3a44', race: 'asian' })],
  ['fc_mountain', 'Big Sunday', 'heavy', 98, 50, 26, 98, 55, 40, 60, 11, G0('vest', '#1e1e24', 'pants', '#3a2a1e', { build: 2, hair: '#101010', hairStyle: 0, facial: 3, race: 'afro' })],
  ['fc_viper', 'Viper Reyes', 'boxer', 54, 78, 90, 44, 68, 80, 62, 6, G0('tank', '#2a8a4a', 'shorts', '#141418', { body: 'f', build: 0, hair: '#1a0e08', hairStyle: 6, race: 'latino' })],
  ['fc_hammer', 'Hammer Jo', 'brawler', 80, 60, 56, 72, 30, 38, 92, 7, G0('tank', '#e8a020', 'pants', '#3a3a44', { body: 'f', build: 2, hair: '#a83020', hairStyle: 3, race: 'caucasian' })],
  ['fc_ghost', 'Ghost', 'technician', 62, 76, 80, 52, 90, 88, 28, 12, G0('longsleeve', '#d8d8dc', 'pants', '#d8d8dc', { hair: '#e8e8e8', hairStyle: 8, build: 0, race: 'caucasian' })],
  ['fc_anvil', 'Anvil Okoye', 'wrestler', 78, 72, 50, 78, 60, 70, 50, 10, G0('tshirt', '#f0c030', 'shorts', '#14141a', { body: 'f', build: 2, hair: '#120a08', hairStyle: 7, race: 'afro' })],
  ['fc_razor', 'Razor Kid', 'street', 60, 58, 84, 40, 38, 52, 96, 3, G0('jacket', '#141418', 'pants', '#5a1a20', { build: 0, hair: '#d02060', hairStyle: 5, race: 'caucasian' })],
  ['fc_bull', 'Bull Tanaka', 'heavy', 92, 60, 34, 90, 62, 55, 58, 13, G0('robe', '#a02028', 'shorts', '#141418', { build: 2, hair: '#141414', hairStyle: 9, race: 'asian' })],
  ['fc_grinder', 'Grinder', 'brawler', 74, 78, 58, 66, 42, 46, 80, 8, G0('shirt', '#5a4a3a', 'pants', '#2a221a', { hat: 'beanie', hatColor: '#a03020', facial: 2, race: 'notraeli' })],
  ['fc_dancer', 'Sweet Marlo', 'boxer', 58, 82, 86, 50, 74, 84, 48, 10, G0('tank', '#a040c0', 'shorts', '#e8d060', { hair: '#2a180e', hairStyle: 2, race: 'afro' })],
];
const STYLE = { brawler: 'Brawler', boxer: 'Boxer', wrestler: 'Wrestler', street: 'Street Fighter', technician: 'Technician', heavy: 'Heavyweight' };
const LINES = {
  brawler: { in: ['Come on then!', 'I am going to enjoy this.'], win: ['Who is next?!', 'Stay down!'] }, boxer: { in: ['Hands up. You will need them.', 'Keep your chin down.'], win: ['Too slow.', 'Good round.'] },
  wrestler: { in: ['Once I get hold of you, it is over.', 'Nowhere to run in here.'], win: ['Pinned.', 'Gravity wins.'] }, street: { in: ['No rules, right?', 'Eyes on me, friend.'], win: ['Should have watched your feet.', 'That is how it is on the street.'] },
  technician: { in: ['Show me what you have.', 'I have already seen your mistake.'], win: ['As calculated.', 'You drop your left.'] }, heavy: { in: ['...', 'You are small.'], win: ['Sleep.', 'Next.'] },
};
G.FIGHTERS = {};
for (const [id, name, style, str, sta, spd, dur, def, tec, agg, exp, look] of F) {
  G.FIGHTERS[id] = { id, name, style, str, sta, spd, dur, def, tec, agg, exp };
  G.NPCS[id] = { id, name, map: 'fightclub', faction: 'punks', hp: 60 + dur, combat: 'fight', gold: 60, home: null, relations: {}, dialogue: 'fc_fighter', job: `I fight at the Pit. ${STYLE[style]}.`, ageGroup: 'adult', look: G.look(id, look), schedule: [{ from: 0, to: 24, at: 'fc_p' + (Object.keys(G.FIGHTERS).length % 8), act: 'wander' }] };
}
const regular = (id, name, faction, at, act, look, o = {}) => { G.NPCS[id] = Object.assign({ id, name, map: 'fightclub', faction, hp: 40, combat: 'fight', gold: 40, home: null, relations: {}, ageGroup: 'adult', look: G.look(id, look), schedule: [{ from: 0, to: 24, at, act }] }, o); };
regular('fc_boss', 'Mama Rust', 'punks', 'fc_mgr', 'work', { body: 'f', top: 'jacket', shirt: '#7a2a1a', shirt2: '#e8c040', bottom: 'pants', pants: '#141418', hair: '#c8c8c8', hairStyle: 3, hat: 'bandana', hatColor: '#c04020', build: 2, race: 'caucasian' }, { dialogue: 'fc_boss', job: 'I run the Pit. Everybody who bleeds here bleeds for me.', hp: 90, gold: 900 });
regular('fc_bookie', 'Two-Percent Lou', 'criminals', 'fc_book', 'work', { body: 'm', top: 'vest', shirt: '#2e2e34', shirt2: '#c8a040', bottom: 'pants', pants: '#2e2e34', hat: 'cap', hatColor: '#3a3a44', facial: 1 }, { dialogue: 'fc_bookie', job: 'I hold the money. I always hold the money.', gold: 3000 });
regular('fc_door', 'Doorman', 'punks', 'fc_doorpt', 'idle', { body: 'm', top: 'jacket', shirt: '#141418', bottom: 'pants', pants: '#141418', build: 2, facial: 3 }, { hp: 90, job: 'I watch who comes down the stairs. Everybody comes down the stairs.' });
regular('fc_barkeep', 'Pit Bartender', 'punks', 'fc_barw', 'work', { body: 'f', top: 'tank', shirt: '#2a2a30', bottom: 'pants', pants: '#14141a', hair: '#30a0a0', hairStyle: 7 }, { shop: 'fc_bar', job: 'Beer, liquor, and I do not hear anything.' });
const dealer = (id, name, at, look) => regular(id, name, 'criminals', at, 'wander', look, { dealer: true, job: 'I sell what people came down here for.', gold: 200, inv: [['weed', 6], ['cocaine', 4], ['xanax', 4]] });
dealer('fc_dealer1', 'Pit Dealer', 'fc_deal1', { body: 'm', top: 'hoodie', shirt: '#2a3a2a', bottom: 'pants', pants: '#1e1e22', hat: 'beanie', hatColor: '#141418' });
dealer('fc_dealer2', 'Pit Dealer', 'fc_deal2', { body: 'f', top: 'jacket', shirt: '#3a1e3a', bottom: 'pants', pants: '#1e1e22', hair: '#e8e0c0', hairStyle: 6 });
const CROWD = ['Punk', 'Gang Member', 'Thug', 'Drifter', 'Punk', 'Biker', 'Gang Member', 'Dock Rat', 'Punk', 'Drifter', 'Thug', 'Biker', 'Punk', 'Thug'];
CROWD.forEach((name, i) => {
  const f = i % 3 === 1, faction = /Gang/.test(name) ? (i % 2 ? 'gang_red' : 'gang_blue') : /Thug|Biker/.test(name) ? 'criminals' : 'punks';
  regular('fc_c' + i, name, faction, 'fc_s' + (i % 14), i % 5 === 4 ? 'wander' : 'idle', { body: f ? 'f' : 'm', top: pick(['jacket', 'tank', 'hoodie', 'tshirt', 'vest']), bottom: 'pants', hair: pick(['#d02060', '#30c070', '#3a2418', '#14100e', '#e8d060', '#4060e0']), hairStyle: f ? 6 : pick([5, 8, 2]) }, { job: 'I come for the fights. And the rest.', gold: 30 + i * 9, lifeOf: 'gang' });
});
G.SHOPS.fc_bar = { name: 'Pit Bar', owner: 'fc_barkeep', region: 'city', gold: 400, buyMult: 1.2, sellMult: 0.4, buys: ['consumable'], stock: [['beer', 30], ['whiskey', 10], ['vodka', 10], ['cigarettes', 12], ['chips', 8]] };

// ---------------------------------------------------------------- the place
G.MAPGEN.fightclub = () => {
  const RING = RING0;
  // One building, laid out the way a converted cannery basement would be:
  //   the stairs come down into a lobby; a wide archway opens north into the main hall.
  //   Straight ahead is the ring with the stands around it; just inside the arch, either side of the way in, are the
  //   registration counter (Mama Rust) and the betting counter (Lou). West of the ring the lounge, east the bar.
  //   Along the north wall, the fighters' rooms, each with one door into the hall, and the tunnel to the ring.
  const m = new G.TileMap('fightclub', 64, 46, T.wall_concrete);
  m.meta = { name: 'The Pit', region: 'city', music: 'city', darkness: 0.34, ownLight: 0.2, district: 'industrial', indoor: true };
  const put = (t, x, y, e) => m.addDecor('v_' + t, x, y, e);
  m.fill(1, 8, 62, 28, T.concrete);                                     // the hall
  m.fill(1, 8, 13, 28, T.darkstone); m.fill(50, 8, 13, 28, T.woodfloor);   // lounge and bar floors
  m.fill(1, 1, 62, 6, T.concrete); m.fill(1, 7, 62, 1, T.wall_brick);     // fighters' rooms and their wall
  for (const x of [12, 24, 40, 52]) m.fill(x, 1, 1, 6, T.wall_brick);
  for (const x of [6, 18, 31, 32, 46, 62]) m.set(x, 7, T.door);
  m.fill(1, 36, 62, 1, T.wall_brick); m.fill(30, 36, 4, 1, T.concrete);    // the archway
  m.fill(20, 37, 24, 8, T.stonefloor); m.fill(31, 45, 2, 1, T.stonefloor); // the lobby and the stairs up
  for (let y = RING.y0; y <= RING.y1; y++) for (let x = RING.x0; x <= RING.x1; x++) put('ring_floor', x, y);
  for (let x = RING.x0 - 1; x <= RING.x1 + 1; x++) { if (x !== 31 && x !== 32) put('rope_h', x, RING.y0 - 1); put('rope_h', x, RING.y1 + 1); }
  for (let y = RING.y0; y <= RING.y1; y++) { put('rope_v', RING.x0 - 1, y); put('rope_v', RING.x1 + 1, y); }
  for (const [x, y] of [[21, 12], [42, 12], [21, 27], [42, 27]]) put('ring_post', x, y);
  for (let x = 16; x < 48; x += 2) { if (x !== 30 && x !== 32) put('bleacher', x, 9); if (x < 22 || (x > 26 && x < 36) || x > 40) put('bleacher', x, 30); }
  for (let y = 12; y < 28; y += 4) { put('worn_couch', 15, y); put('worn_couch', 46, y); }
  for (const [x, y] of [[27, 12], [36, 12], [27, 27], [36, 27]]) put('cage_lamp', x, y);
  for (const [x, y] of [[15, 9], [47, 9], [15, 31], [47, 31]]) put('oildrum_fire', x, y);
  // the counters, the first thing you see coming through the arch
  for (const x of [22, 24, 26]) put('counter', x, 33);
  for (const x of [36, 38, 40]) put('counter', x, 33);
  put('bettingboard', 24, 31); put('bettingboard', 37, 31); put('cage_lamp', 21, 32); put('cage_lamp', 42, 32);
  put('sign_fights', 25, 33).x = 25 * 16; put('sign_bets', 39, 33).x = 39 * 16;   // (each in the middle of its counter)
  // the fighters' rooms
  for (const [x, w] of [[1, 11], [13, 11], [41, 11], [53, 10]]) { put('lockers', x + 1, 2); put('heavybag', x + w - 2, 3); put('lowtable', x + 1, 5); put('bench_steel', x + 4, 5); }
  put('benchpress', 26, 3); put('benchpress', 30, 3); put('heavybag', 36, 3); put('mirror', 34, 1); put('lockers', 37, 2);
  // the lounge: couches in twos, a low table between; the dealers keep to the far corners
  for (const [x, y] of [[2, 10], [8, 10], [2, 17], [8, 24], [2, 28]]) { put('worn_couch', x, y); put('lowtable', x, y + 1); }
  put('oildrum_fire', 6, 14); put('oildrum_fire', 11, 21); put('jukebox', 12, 9); put('foosball', 10, 29); put('trash_can', 1, 34);
  // the bar: bottles on the north wall, the counter in front, stools on the customers' side
  for (let x = 53; x < 59; x += 2) { put('backbar', x, 8); put('bar', x, 11); put('stool', x, 12); put('stool', x + 1, 12); }
  put('fridge_bar', 59, 8); put('neon_bar', 56, 8); put('payphone', 51, 8); put('pool_table', 52, 26); put('dartboard', 62, 22); put('trash_can', 62, 33);
  // the lobby
  put('stairs', 31, 44); put('worn_couch', 21, 39); put('worn_couch', 41, 39); put('oildrum_fire', 21, 43); put('oildrum_fire', 42, 43);
  // the wall facing you as you come down the stairs, the same on both sides of the arch; nothing stands in the arch itself
  put('sign_pit', 27, 36).x = 27 * 16; put('poster_fight', 23, 36); put('poster_fight', 40, 36);
  for (const [t, x, y] of [['graffiti1', 16, 7], ['graffiti2', 36, 7], ['graffiti3', 48, 7], ['graffiti1', 20, 36], ['graffiti2', 36, 36], ['graffiti3', 42, 36], ['graffiti3', 6, 36], ['graffiti1', 54, 36], ['graffiti2', 3, 7]]) put(t, x, y);
  Object.assign(m.points, {
    from_port: { x: 31, y: 42 }, fc_mgr: { x: 25, y: 32 }, fc_book: { x: 38, y: 32 }, fc_doorpt: { x: 29, y: 41 }, fc_barw: { x: 56, y: 10 }, fc_deal1: { x: 5, y: 16 }, fc_deal2: { x: 8, y: 27 },
    fc_out: { x: 31, y: 34 }, fc_side: { x: 31, y: 26 }, fc_w: { x: RING.x0 + 3, y: 20 }, fc_e: { x: RING.x1 - 3, y: 20 }, fc_gate: { x: 31, y: 10 }, fc_p0: { x: 6, y: 4 }, fc_p1: { x: 18, y: 4 }, fc_p2: { x: 28, y: 5 }, fc_p3: { x: 35, y: 5 }, fc_p4: { x: 46, y: 4 }, fc_p5: { x: 58, y: 4 }, fc_p6: { x: 3, y: 5 }, fc_p7: { x: 31, y: 5 },
  });
  const stands = [[18, 11], [24, 11], [29, 11], [34, 11], [39, 11], [45, 11], [18, 29], [20, 29], [28, 29], [35, 29], [43, 29], [45, 29], [55, 14], [6, 22]];
  stands.forEach(([x, y], i) => { m.points['fc_s' + i] = { x, y }; });
  m.addExit(31, 45, 2, 1, 'industrial', 'from_fightclub', 'Up to the street');
  m.finalize();
  return m;
};
const _ind = G.MAPGEN.industrial;
G.MAPGEN.industrial = () => {
  const m = _ind(), x = 4, y = 41, w = 16, h = 11;
  G.home.clearArea(m, x, y, w, h);
  const b = m.addBuilding('i_cannery', x, y, w, h, { name: 'Old Cannery', wall: 'wall_brick', floor: 'concrete', roof: 'flat_dark', kind: 'camp', chimney: false });
  m.addDecor('v_stairs', x + 7, y + 2); m.addDecor('v_graffiti2', x + 2, y + 1); m.addDecor('v_graffiti1', x + 11, y + 1);
  m.addExit(x + 7, y + 2, 2, 1, 'fightclub', 'from_port', 'Down to the Pit');
  m.points.from_fightclub = { x: b.doorX, y: b.doorY - 2 };
  m.computeSolids(); m.prerender();
  return m;
};

// ---------------------------------------------------------------- the books
const FC = G.fightClub = {
  placed(m) { const r = m.flats.concat(m.decor).filter((d) => /ring_floor/.test(d.type)); if (r.length) Object.assign(RING, { x0: Math.min(...r.map((d) => d.tx)), y0: Math.min(...r.map((d) => d.ty)), x1: Math.max(...r.map((d) => d.tx)), y1: Math.max(...r.map((d) => d.ty)) }); },
  RING,
  state(w) { const s = (w.fc = w.fc || { rec: {}, card: [], payouts: 0, survivalBest: 0 }); for (const id in G.FIGHTERS) if (!s.rec[id]) { const r = new G.RNG('rec' + id), d = G.FIGHTERS[id]; s.rec[id] = { w: r.int(d.exp, d.exp * 3), l: r.int(1, d.exp * 2), s: r.int(0, 3) }; } if (!s.card.length) this.newCard(w); return s; },
  rating(id) { const d = G.FIGHTERS[id]; return d ? (d.str * 1.1 + d.sta * 0.8 + d.spd * 0.8 + d.dur + d.def * 0.8 + d.tec + d.exp * 2) / 5.5 : 50; },
  odds(w, a, b) {
    const s = this.state(w), form = (id) => this.rating(id) + (s.rec[id].s || 0) * 1.5, p = form(a) ** 3 / (form(a) ** 3 + form(b) ** 3);
    return Math.round(clamp(0.92 / p, 1.08, 9) * 100) / 100;
  },
  avail(scene) { return Object.keys(G.FIGHTERS).filter((id) => { const st = scene.world.npcs[id]; return st && st.alive && !st.ko; }); },
  rival(w, id) { const s = this.state(w), c = s.card.find((m) => m.includes(id)); if (c) return c[0] === id ? c[1] : c[0]; const r = Object.keys(G.FIGHTERS).filter((x) => x !== id); return r.sort((p, q) => Math.abs(this.rating(p) - this.rating(id)) - Math.abs(this.rating(q) - this.rating(id)))[0]; },
  newCard(w) { const ids = Object.keys(G.FIGHTERS).sort(() => Math.random() - 0.5); w.fc.card = [[ids[0], ids[1]], [ids[2], ids[3]], [ids[4], ids[5]], [ids[6], ids[7]]]; },
  result(w, win, lose) { const s = this.state(w), a = s.rec[win], b = s.rec[lose]; if (a) { a.w++; a.s = (a.s || 0) + 1; } if (b) { b.l++; b.s = 0; } },
  daily(w) { const s = this.state(w), r = new G.RNG('fc' + w.day); for (const [a, b] of s.card.slice(1)) { const pa = this.rating(a) ** 3 / (this.rating(a) ** 3 + this.rating(b) ** 3); if (r.chance(pa)) this.result(w, a, b); else this.result(w, b, a); } this.newCard(w); },
  actor(scene, id) { return scene.actors.find((a) => a.id === id && !a.dead); },
  // stats on someone who has them: a fighter, or a walk-on in survival mode
  statOf(a) { return a.fcS || G.FIGHTERS[a.id] || null; },
  fade(fn, dur = 1.3) { G.scenes.push(new G.FadeScene(fn, dur)); },
  put(a, pt) { a.x = px(pt.x); a.y = py(pt.y); a.path = null; a.goal = null; a.moving = false; a.kbx = a.kby = 0; },
  ready(scene, a, pt, foe) {
    const s = this.statOf(a);
    this.put(a, pt);
    a.fcIn = true; a.errand = null; a.needTask = null; a.seated = false; a.sleeping = false; a.talking = false;
    if (a.st.ko) { a.st.ko = null; a.downT = 0; }
    a.maxHp = Math.round(50 + s.dur * 1.1); a.hp = a.st.hp = a.maxHp;
    a.fcSp = a.fcSp || a.speed; a.speed = 28 + s.spd * 0.42;
    a.state = 'fight'; a.target = foe; a.fcCd = 0.5; a.faceTowards(foe);
  },
  // ---------------------------------------------------------------- starting
  // a save made in the ring keeps the weapon that was left at the door
  rearm(scene, fn) { const f = scene._fc, p = scene.player; if (!f || !f.weapon) return fn(); const w = p.equip.weapon; p.equip.weapon = f.weapon; try { return fn(); } finally { p.equip.weapon = w; } },
  disarm(scene, f) { const p = scene.player; f.weapon = p.equip.weapon || null; p.equip.weapon = null; p.refreshStats(); },
  enter(scene, f, spot) { const p = scene.player, pt = scene.map.points[spot]; this.put(p, pt); p.sitting = null; p.fcIn = true; this.disarm(scene, f); },
  // a house bout gives way when you step up: the two of them are waved out of the ring
  clearShow(scene) { const f = scene._fc; if (!f || f.mode !== 'show' || f.over) return; for (const a of f.foes) { a.fcIn = false; a.state = 'schedule'; a.target = null; a.handsUp = false; if (a.fcSp) a.speed = a.fcSp; if (a.st.ko) { a.st.ko = null; a.downT = 0.5; } a.hp = a.st.hp = a.maxHp; a.placeBySchedule(scene.map, scene.world); } for (const [n, , amt] of f.side || []) n.st.gold += amt; scene.world.npcs.fc_bookie.gold -= (f.side || []).reduce((s, b) => s + b[2], 0); scene._fc = null; },
  fight(scene, id, mode = 'fight') {
    this.clearShow(scene);
    const a = this.actor(scene, id); if (!a || scene._fc) return false;
    const f = scene._fc = { mode, foes: [a], t: 0, purse: Math.round(30 + this.rating(id) * 2.4), hp0: scene.player.hp };
    this.fade(() => { this.enter(scene, f, 'fc_w'); this.ready(scene, a, scene.map.points.fc_e, scene.player); a.say(pick(LINES[G.FIGHTERS[id].style].in), 2.5); f.go = true; });
    return true;
  },
  // two fighters, your money on one of them
  bet(scene, pickId, foeId, amount) {
    this.clearShow(scene);
    const w = scene.world, p = scene.player, a = this.actor(scene, pickId), b = this.actor(scene, foeId);
    if (scene._fc || !a || !b || amount <= 0 || amount > p.gold) return false;
    const book = w.npcs.fc_bookie, odds = this.odds(w, pickId, foeId);
    p.gold -= amount; book.gold += amount; G.audio.play('coin');
    const f = scene._fc = { mode: 'bet', a, b, foes: [a, b], pick: pickId, amount, odds, t: 0 };
    this.crowdBets(scene, f);
    this.fade(() => { this.enter(scene, f, 'fc_side'); this.ready(scene, a, scene.map.points.fc_w, b); this.ready(scene, b, scene.map.points.fc_e, a); f.go = true; });
    return true;
  },
  show(scene) { const w = scene.world, s = this.state(w), c = s.card[0], a = this.actor(scene, c && c[0]), b = this.actor(scene, c && c[1]); if (!a || !b) { s.card.shift(); if (!s.card.length) this.newCard(w); return; } const f = scene._fc = { mode: 'show', a, b, foes: [a, b], t: 0 }; this.crowdBets(scene, f); this.ready(scene, a, scene.map.points.fc_w, b); this.ready(scene, b, scene.map.points.fc_e, a); f.go = true; },
  // people in the crowd put their own money down
  crowdBets(scene, f) {
    f.side = [];
    for (const n of scene.actors) {
      if (n.kind !== 'npc' || n.dead || !/^fc_c\d/.test(n.id) || (n.st.gold || 0) < 10) continue;
      const on = G.util.hashString(n.id + f.a.id) % 2 ? f.a.id : f.b.id, amt = Math.min(n.st.gold, 5 + G.util.hashString(n.id) % 20);
      n.st.gold -= amt; scene.world.npcs.fc_bookie.gold += amt; f.side.push([n, on, amt]);
    }
  },
  survival(scene) {
    this.clearShow(scene);
    if (scene._fc) return false;
    const f = scene._fc = { mode: 'survival', foes: [], round: 0, down: 0, done: 0, t: 0, pause: 2.5, paid: false };
    this.fade(() => { this.enter(scene, f, 'fc_out'); this.put(scene.player, { x: 31, y: 20 }); f.go = true; });
    return true;
  },
  // a nameless walk-on, built for this round
  walkOn(scene, f, n, i) {
    const lvl = clamp(26 + n * 6, 26, 96), styles = Object.keys(STYLE), style = pick(styles), v = (k) => clamp(lvl + k + G.rng.int(-10, 10), 10, 99);
    const seed = 'wave' + n + '_' + i + '_' + G.rng.int(0, 1e6), B = { heavy: 2, wrestler: 2, brawler: 2, boxer: 0, street: 0 }, gate = scene.map.points.fc_gate;
    const look = G.look(seed, { top: pick(['tank', 'tshirt', 'hoodie']), bottom: pick(['shorts', 'pants']), build: B[style] != null ? B[style] : 1 });
    const a = G.law.spawn(scene, { name: 'Pit Fighter', look, combat: 'fight', role: 'fc', hp: 60 }, px(gate.x) + i * 6, py(gate.y));
    a.def.faction = 'punks'; a.fcS = { id: seed, style, str: v(style === 'heavy' ? 14 : 0), sta: v(0), spd: v(style === 'heavy' ? -30 : style === 'boxer' ? 10 : 0), dur: v(style === 'heavy' ? 12 : -4), def: v(0), tec: v(style === 'technician' ? 16 : -5), agg: v(style === 'street' ? 20 : 0), exp: 3 };
    a.fcIn = true; a.speed = 28 + a.fcS.spd * 0.42; a.maxHp = Math.round(34 + a.fcS.dur * 0.8); a.hp = a.st.hp = a.maxHp; a.st.hostile = true; a.aggressor = true; a.state = 'fight'; a.target = scene.player; a.fcCd = 0.8;
    f.foes.push(a);
    return a;
  },
  rewardFor(rounds) { let n = 0; for (let r = 1; r <= rounds; r++) n += 20 + r * 12 + (r % 5 === 0 ? r * 40 : 0); return n; },
  // ---------------------------------------------------------------- running
  down(scene, a, by) {
    if (a === scene.player) { this.playerOut(scene, by); return; }
    G.ko.knockOut(scene, a, by, 'fist', 0.5);
    G.audio.play('slam', { x: a.x, y: a.y });
  },
  playerOut(scene) {
    const f = scene._fc; if (!f || f.out) return;
    f.out = true; const p = scene.player;
    p.hp = Math.max(1, p.hp); p.downT = 1e9; p.downDir = 1; p.fcKO = true; p.effects = (p.effects || []).filter((e) => e.id !== 'bleeding');
    for (const a of f.foes) if (!a.dead && !(a.st && a.st.ko)) { a.state = 'schedule'; a.target = null; a.moving = false; a.fcCheer = G.loop.time + 3; a.say(pick(LINES[(this.statOf(a) || {}).style || 'brawler'].win), 3); }
    this.cheer(scene, 'player');
    this.resolve(scene, f.foes.find((a) => !(a.st && a.st.ko)) || null);
  },
  cheer(scene, how) { G.audio.play('crowd'); for (const n of scene.actors) if (n.kind === 'npc' && !n.dead && /^fc_c\d/.test(n.id) && Math.random() < 0.5) n.say(pick(how === 'player' ? ['OHHH! Lights out!', 'That is what you get!', 'Pay up, pay up!'] : ['GET UP!', 'Yes! YES!', 'Hit him!', 'That is my money in there!', 'Come ON!']), 2.5); },
  // the ring is finished: settle it all, then move you out behind a fade
  resolve(scene, winner) {
    const f = scene._fc, w = scene.world, p = scene.player; if (!f || f.over) return;
    f.over = true; f.endT = G.loop.time + (f.mode === 'show' ? 3 : 2.6);
    const book = w.npcs.fc_bookie, F_ = G.finance;
    if (f.mode === 'bet' || f.mode === 'show') {
      const loser = winner === f.a ? f.b : f.a;
      this.result(w, winner.id, loser.id);
      w.fc.card = w.fc.card.filter((c) => !(c.includes(f.a.id) && c.includes(f.b.id)));
      if (!w.fc.card.length) this.newCard(w);
      for (const [n, on, amt] of f.side || []) { if (on === winner.id) { const pay = Math.min(book.gold, Math.round(amt * 1.8)); book.gold -= pay; n.st.gold += pay; n.say(pick(['Ha! Pay me!', 'I told you!', 'Easy money.']), 3); } else n.say(pick(['Damn it!', 'That was rent money...', 'Fixed! It was fixed!']), 3); }
      if (f.mode === 'bet') {
        if (f.pick === winner.id) { const want = Math.round(f.amount * f.odds), pay = Math.min(book.gold, want); book.gold -= pay; p.gold += pay; f.won = pay; w.fc.payouts += pay; } else f.won = 0;
      }
    } else if (f.mode === 'fight') {
      const foe = f.foes[0], won = !f.out;
      if (G.FIGHTERS[foe.id]) { if (won) { this.result(w, 'player', foe.id); } else this.result(w, foe.id, 'player'); }
      f.prize = won ? f.purse : 0;
      if (won) { const got = F_.pay(w, w.npcs.fc_boss, p, f.purse); f.prize = got; w.fc.wins = (w.fc.wins || 0) + 1; G.mem.add(w, 'fc_boss', { k: 'fight', t: `The player won a fight in my ring against ${foe.displayName}`, by: 'player', s: 'did', f: 1, i: 3 }); G.social.addDisp(w, 'fc_boss', 2); }
    } else if (f.mode === 'survival' && !f.paid) {
      f.paid = true; const rounds = f.done, r = this.rewardFor(rounds), got = r > 0 ? F_.pay(w, w.npcs.fc_boss, p, r) + F_.pay(w, 'pool', p, Math.max(0, r - (w.npcs.fc_boss.gold || 0))) : 0;
      f.prize = got; w.fc.survivalBest = Math.max(w.fc.survivalBest || 0, rounds);
    }
  },
  leave(scene) {
    const f = scene._fc, p = scene.player, w = scene.world;
    const end = () => {
      if (f.mode !== 'show') {
        const out = scene.map.points.fc_out;
        this.put(p, out); p.fcIn = false;
        if (f.weapon) { p.equip.weapon = f.weapon; p.refreshStats(); }
        if (f.out) { p.hp = 20; p.st && (p.st.hp = 20); p.downT = 1.2; p.fcKO = false; p.dead = false; }
      }
      for (const a of f.foes) {
        a.fcIn = false; a.state = 'schedule'; a.target = null; a.fcCheer = 0; a.handsUp = false; a.fcBlock = 0; if (a.fcSp) a.speed = a.fcSp;
        if (a.transient) a.gone = true;
        else { if (a.st.ko) { a.st.ko = null; a.downT = 0.8; } a.hp = a.st.hp = a.maxHp; a.placeBySchedule(scene.map, scene.world); }
      }
      scene.actors = scene.actors.filter((a) => !a.gone);
      scene._fc = null; scene._fcNext = G.loop.time + 50;
      if (f.mode === 'bet') scene.toast(f.won ? `You won $${f.won}. Collected at the counter.` : `Your $${f.amount} is gone.`, f.won ? 'good' : 'bad');
      if (f.mode === 'fight') scene.toast(f.out ? 'You lost. You wake up on the floor outside the ropes.' : `You won. $${f.prize || 0}.`, f.out ? 'bad' : 'good');
      if (f.mode === 'survival') {
        const line = `${f.done} rounds, ${f.down} down. Prize: $${f.prize || 0}.`;
        scene.toast(`Out cold. ${line}`, 'bad');
      }
      if (w.fc && f.mode === 'bet' && f.won) G.audio.play('coin');
    };
    if (f.mode === 'show') end(); else this.fade(end, 1.6);
  },
  tick(scene, dt) {
    if (scene.map.id !== 'fightclub') return;
    const f = scene._fc, p = scene.player;
    this.crowd(scene, dt);
    if (!f) { if (G.loop.time > (scene._fcNext || 0)) { scene._fcNext = G.loop.time + 80; if (!G.scenes.top().runner) this.show(scene); } return; }
    if (!f.go) return;
    f.t += dt;
    if (Math.random() < dt / 2.4) this.cheer(scene);
    for (const a of f.foes) {
      if (a.st && a.st.ko && !a.fcRecover) a.fcRecover = G.loop.time + 9 + Math.random() * 5;   // (however they went down, they stay down for now)
      if (a.st && a.st.ko) a.st.ko.until = 1e12;
      if (a.st && a.st.ko && !a.fcCheer && a.fcRecover && G.loop.time > a.fcRecover && !f.over) { a.st.ko = null; a.st.hostile = false; a.aggressor = false; a.downT = 0.6; a.hp = 8; a.state = 'schedule'; a.def.schedule = [{ from: 0, to: 24, at: { x: 31, y: 9 }, act: 'idle' }]; a.goal = null; a.fcLeaving = true; }
      if (a.fcLeaving && a.transient && a.distTo({ x: px(31), y: py(9) }) < 30) a.gone = true;
    }
    if (f.foes.some((a) => a.gone)) { f.foes = f.foes.filter((a) => !a.gone); scene.actors = scene.actors.filter((a) => !a.gone); }
    if (f.over) { for (const a of f.foes) if (a.fcCheer > G.loop.time) { a.moving = false; } if (G.loop.time > f.endT && !f.left) { f.left = true; this.leave(scene); } return; }
    const out = (a) => (a.st && a.st.ko) || a.dead;
    if (f.mode === 'bet' || f.mode === 'show') {
      const ko = out(f.a) ? f.a : out(f.b) ? f.b : null;
      if (ko) { const win = ko === f.a ? f.b : f.a; win.state = 'schedule'; win.target = null; win.moving = false; win.fcCheer = G.loop.time + 3; win.say(pick(LINES[G.FIGHTERS[win.id].style].win), 3); this.cheer(scene); this.resolve(scene, win); }
      else if (f.t > 90) { const win = f.a.hp / f.a.maxHp >= f.b.hp / f.b.maxHp ? f.a : f.b; this.down(scene, win === f.a ? f.b : f.a, win); }
    } else if (f.mode === 'fight') {
      if (out(f.foes[0]) && !f.out) { scene.player.handsUpT = G.loop.time + 2.5; this.cheer(scene); this.resolve(scene, null); }
    } else if (f.mode === 'survival' && !f.out) {
      const live = f.foes.filter((a) => !out(a) && !a.fcLeaving);
      for (const a of f.foes) if (out(a) && !a.fcCounted) { a.fcCounted = true; f.down++; }
      if (!live.length) {
        if (f.round > 0 && !f.cleared) { f.cleared = true; f.done = f.round; f.pause = 6; scene.toast(`Round ${f.round} survived.`, 'good'); scene.player.hp = Math.min(scene.player.maxHp, scene.player.hp + scene.player.maxHp * 0.12); G.audio.play('crowd'); }
        if ((f.pause -= dt) <= 0) { f.round++; f.cleared = false; const n = Math.min(5, 1 + Math.floor((f.round - 1) / 3)); for (let i = 0; i < n; i++) this.walkOn(scene, f, f.round, i); G.audio.play('alarm'); }
      }
    }
  },
  // the crowd is busy with its own business: buying, using, arguing
  crowd(scene, dt) {
    if ((scene._fcC = (scene._fcC || 0) - dt) > 0) return; scene._fcC = 5 + Math.random() * 7;
    const w = scene.world, all = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.fcIn && a.id && /^fc_c\d/.test(a.id) && a.state === 'schedule' && !a.talking), a = pick(all); if (!a) return;
    const st = a.st, roll = Math.random(), dealer = scene.actors.find((d) => d.kind === 'npc' && d.def.dealer && !d.dead && d.map !== null && /^fc_dealer/.test(d.id));
    if (roll < 0.35 && dealer && (st.gold || 0) >= 25) {
      const price = 25, e = (dealer.st.inv || []).find((i) => i[1] > 0);
      if (e) { e[1]--; st.gold -= price; dealer.st.gold += price; st.fcStash = e[0]; dealer.say(pick(['Twenty-five. Do not flash it.', 'Good stuff tonight.', 'You did not get this from me.']), 3); a.say(pick(['Same as last time.', 'What have you got?', 'I need something for the fights.']), 3); }
    } else if (roll < 0.6 && st.fcStash) {
      const id = st.fcStash; st.fcStash = null; st.fx = (st.fx || []).concat([{ id: 'high', t: 90, dur: 90, power: 1 }]); a.emote = 'cigarette'; a.say(pick(['Ohh, that is the stuff.', 'Everything is so... loud.', 'I can feel my teeth.']), 3.5); a.fcHigh = G.loop.time + 40; void id;
    } else if (roll < 0.8) {
      const b = pick(all.filter((o) => o !== a && o.distTo(a) < 120)); if (b) { a.say(pick(['You owe me from last week!', 'Say that again. Say it.', 'That was my spot.', 'You bet against your own crew?']), 3); b.say(pick(['Back off.', 'Make me.', 'Relax, man.']), 3); }
    } else a.say(pick(['That stuff from the docks is cut with something.', 'I am quitting. After tonight.', 'Who has papers?', 'My guy is out. Try the one by the couches.']), 3.5);
    void w;
  },
  sheet(id) { const st = G.world.npcs[id]; if (!st) return null; const n = (this._sh = this._sh || {}); return n[id] || (n[id] = new G.NPC(id, st).sheet); },
  portrait(ctx, id, x, y, sz) { const s = this.sheet(id); if (!s) return; ctx.fillStyle = '#22242a'; ctx.fillRect(x, y, sz, sz); const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(s.img, 0, 0, s.fw, s.fw, x, y, sz, sz); ctx.imageSmoothingEnabled = was; },
};
Object.assign(FC, { STYLE });

// ---------------------------------------------------------------- how each style fights
const STRAFE = 0.8;
const AI = {
  // pause in the fight, circling at this distance
  circle(a, t, dt, scene, r) { const d = a.distTo(t), ang = Math.atan2(a.y - t.y, a.x - t.x) + (a.fcDir || 1) * dt * STRAFE * 2.2, want = d < r ? d + 12 : d > r + 8 ? d - 10 : d; a.stepToward(t.x + Math.cos(ang) * want, t.y + Math.sin(ang) * want, dt, scene, true); if ((a.fcTurn = (a.fcTurn || 0) - dt) <= 0) { a.fcTurn = 1 + Math.random() * 2; a.fcDir = Math.random() < 0.5 ? 1 : -1; } },
  strike(a, scene, mult = 1) { a.fcMult = mult; a.moving = false; G.combat.attack(a, scene); a.fcMult = 1; },
  grab(a, t) { a.say(pick(['Got you!', 'Come here!']), 1.2); t.staggerT = 1.1; a.fcThrow = { t, hurt: 8 + FC.statOf(a).str * 0.16, at: G.loop.time + 0.9 }; },
};
const _uf = NP.updateFight;
NP.updateFight = function (dt, scene) {
  const f = scene._fc, s = this.fcIn && FC.statOf(this), t = this.target;
  if (!f || !s || !t || t.dead || f.over) return _uf.call(this, dt, scene);
  if ((this.fcCd -= dt) > 0) { this.moving = false; return; }
  if (this.staggerT > 0 || this.downT > 0) return;
  const d = this.distTo(t), incoming = !!(t.swing || t.attackTimer > 0) && d < 34, stam = clamp(this.hp / this.maxHp + s.sta / 200, 0.4, 1.2);
  this.faceTowards(t);
  // holding on, about to throw
  if (this.fcThrow) { this.moving = false; const h = this.fcThrow; if (G.loop.time >= h.at) { this.fcThrow = null; this.fcHold = null; if (Math.hypot(h.t.x - this.x, h.t.y - this.y) < 26 && !h.t.dead) { G.combat.damage(h.t, h.hurt, this, scene); h.t.kbx = (h.t.x >= this.x ? 1 : -1) * 90; h.t.downT = 0.7; h.t.downDir = this.dir % 2 ? 1 : -1; G.audio.play('slam', { x: h.t.x, y: h.t.y }); } } return; }
  // up the guard / out of the way
  if (this.fcBlock > 0) { this.fcBlock -= dt; this.moving = false; return; }
  if (incoming && (this.fcReact = (this.fcReact || 0) - dt) <= 0) {
    this.fcReact = 0.7;
    const roll = Math.random() * 100;
    if (s.style !== 'brawler' && s.style !== 'heavy' && roll < s.def * 0.55) { this.fcBlock = 0.5; return; }
    if ((s.style === 'boxer' || s.style === 'technician') && roll < s.spd * 0.7) { const side = Math.random() < 0.5 ? 1 : -1, ax = t.y - this.y, ay = this.x - t.x, n = Math.hypot(ax, ay) || 1; this.kbx = (ax / n) * side * 120; this.kby = (ay / n) * side * 120; this.fcEvade = G.loop.time + 0.3; if (s.style === 'technician') this.fcCounter = G.loop.time + 0.8; return; }
  }
  const reach = Math.max(this.weaponRange() + 2, G.melee.styleOf(this).reach + (t.radius || 5) - 3), can = this.attackCd <= 0;
  const close = () => this.stepToward(t.x, t.y, dt, scene, true);
  switch (s.style) {
    case 'boxer':
      if (this.fcCombo > 0 && d <= reach) { if (can) { this.fcCombo--; AI.strike(this, scene); this.attackCd = 0.24; } else this.moving = false; }
      else if (d > reach * 1.9) close();
      else if ((this.fcWait = (this.fcWait || 0) - dt) > 0) AI.circle(this, t, dt, scene, reach * 1.5);
      else if (d > reach) close();
      else { this.fcWait = 1.4 / stam; this.fcCombo = 2 + (Math.random() < s.tec / 100 ? 1 : 0); }
      break;
    case 'wrestler':
      if (d > reach) close();
      else if (can && Math.random() < 0.45 && !(t.downT > 0)) { AI.grab(this, t); this.attackCd = 2.6; }
      else if (can) AI.strike(this, scene); else this.moving = false;
      break;
    case 'street':
      if ((this.fcFeint = (this.fcFeint || 0) - dt) > 0) { const o = Math.atan2(this.y - t.y, this.x - t.x); this.stepToward(this.x + Math.cos(o) * 20, this.y + Math.sin(o) * 20, dt, scene, true); }
      else if (d > reach) close();
      else if (can) { if (Math.random() < 0.3) { scene.floatText(t.x, t.y - 24, 'Dirt in the eyes!', '#e8d060'); t.staggerT = Math.max(t.staggerT || 0, 0.5); scene.particles(t.x, t.y - 12, '#a89878', 8); } AI.strike(this, scene, Math.random() < 0.25 ? 1.8 : 1); this.fcFeint = Math.random() < 0.5 ? 0.45 : 0; } else this.moving = false;
      break;
    case 'technician':
      if (this.fcCounter > G.loop.time && d <= reach * 1.3) { if (d > reach) close(); else if (can) { this.fcCounter = 0; AI.strike(this, scene, 1.6); this.attackCd = 0.5; } }
      else if (d > reach * 2) close();
      else if ((this.fcPatient = (this.fcPatient || 0) + dt) > 3.2) { if (d > reach) close(); else if (can) { this.fcPatient = 0; AI.strike(this, scene, 1.2); } }
      else AI.circle(this, t, dt, scene, reach * 1.6);
      break;
    case 'heavy':
      if (d > reach) close();
      else if (can) { if (this.fcWind == null) { this.fcWind = 0.55; this.moving = false; } else if ((this.fcWind -= dt) <= 0) { this.fcWind = null; AI.strike(this, scene, 2.1); this.attackCd = 1.9 - s.spd / 200; G.renderer.shake(3); } } else this.moving = false;
      break;
    default:   // brawler
      if (d > reach) close();
      else if (can) { AI.strike(this, scene, 1.35); this.attackCd = 0.9 - s.agg / 300; } else this.moving = false;
  }
};
const _dm = NP.damage; NP.damage = function (t) { const s = this.fcIn && FC.statOf(this); if (!s) return _dm.call(this, t); return Math.round((3.5 + s.str * 0.085) * (this.fcMult || 1)); };
const _cd = NP.cooldown; NP.cooldown = function () { const s = this.fcIn && FC.statOf(this); return s ? 0.42 + (100 - s.spd) / 170 + Math.random() * 0.25 : _cd.call(this); };
const _hostile = NP.isHostileToPlayer; NP.isHostileToPlayer = function (scene) { return this.fcLeaving ? false : _hostile.call(this, scene); };
const _sf = NP.startFight; NP.startFight = function (t, scene) { if (this.fcLeaving) return undefined; return _sf.call(this, t, scene); };
const _isC = NP.isCrimeToAttack; NP.isCrimeToAttack = function () { return this.fcIn ? false : _isC.call(this); };
const _spd = NP.update;
NP.update = function (dt, scene) {
  if (this.fcCheer > G.loop.time) { this.moving = false; this.handsUp = Math.floor(G.loop.time * 3) % 2 === 0; this.baseUpdate(dt, scene.map); return undefined; }
  if (this.fcIn && this.handsUp) this.handsUp = false;
  if (this.fcHigh) { if (G.loop.time > this.fcHigh) { this.fcHigh = 0; this.emote = null; } else if (Math.random() < dt * 0.6 && this.state === 'schedule') this.kbx = (Math.random() - 0.5) * 50; }
  return _spd.call(this, dt, scene);
};
// everything that lands in the ring ends in a knockout
const _damage = G.combat.damage;
G.combat.damage = function (target, amount, source, scene, o = {}) {
  const f = scene && scene._fc;
  if (!f || !f.go || !(target.fcIn) || f.over) return _damage.apply(this, arguments);
  if (target.fcBlock > 0 && !(o && o.bullet)) { amount = Math.max(1, Math.round(amount * 0.28)); scene.floatText(target.x, target.y - 24, 'Blocked', '#b8c8e0'); G.audio.play('hit', { x: target.x, y: target.y }); }
  if (target.fcEvade > G.loop.time) { scene.floatText(target.x, target.y - 24, 'Dodged', '#b8e0c8'); return 0; }
  const prev = Object.getOwnPropertyDescriptor(target, 'cheatDeath');
  target.cheatDeath = (sc) => { target.hp = Math.max(1, target.hp); FC.down(sc, target, source); return true; };
  const r = _damage.call(this, target, amount, source, scene, o);
  if (prev) Object.defineProperty(target, 'cheatDeath', prev); else delete target.cheatDeath;
  // taking a real beating shows: a wobble after a big hit, a step back
  if (!target.dead && amount >= 9 && target.hp > 0 && target.kind === 'npc') target.staggerT = Math.max(target.staggerT || 0, 0.35);
  return r;
};
const _die = PL.die; PL.die = function (source, scene) { if (scene._fc && scene._fc.go && this.fcIn) { this.hp = 1; FC.playerOut(scene); return; } return _die.call(this, source, scene); };
const _ndie = NP.die; NP.die = function (source, scene) { if (scene._fc && this.fcIn && !this.gone) { this.hp = 1; FC.down(scene, this, source); return undefined; } return _ndie.call(this, source, scene); };
const _aa = GS.alertAllies; GS.alertAllies = function (victim) { if (victim && victim.fcIn) return undefined; return _aa.apply(this, arguments); };   // (a fight in the ring is nobody else's business)
const _rc = GS.reportCrime; GS.reportCrime = function () { if (this._fc && this.map.id === 'fightclub' && this.player.fcIn) return false; return _rc.apply(this, arguments); };
if (G.aware && G.aware.event) { const _ev = G.aware.event; G.aware.event = function (scene) { if (scene && scene._fc && scene.map.id === 'fightclub') return undefined; return _ev.apply(this, arguments); }; }
const _lg = G.spawnRule.legit; G.spawnRule.legit = function (scene, a) { return !!a.fcS || _lg.call(this, scene, a); };
// no walking away from it, no finding yourself in the ring after a load
const _load = GS.loadMap;
GS.loadMap = function (id) {
  const r = _load.apply(this, arguments);
  if (id === 'fightclub' && this.player && !this._fc) { const p = this.player, tx = p.x / 16, ty = p.y / 16; p.fcIn = false; if (tx > RING.x0 - 2 && tx < RING.x1 + 2 && ty > RING.y0 - 2 && ty < RING.y1 + 2) FC.put(p, this.map.points.fc_out); }
  return r;
};
const _u = GS.update;
GS.update = function (dt) {
  const p = this.player, f = this._fc;
  // the knocked-out player does not move; the room goes on
  if (p && p.fcKO) { p.moving = false; if (f && !f.left && f.over && G.loop.time > f.endT) { f.left = true; FC.leave(this); } }
  const r = _u.call(this, dt);
  if (this.actors) try { FC.tick(this, dt); } catch (e) { if (G.reportError) G.reportError(e); else throw e; }
  return r;
};
const _pu = PL.update;
PL.update = function (dt, scene) {
  if (this.fcKO) { this.vx = this.vy = 0; if (this.downT > 0) this.downT = 1e9; return undefined; }
  // in the ring: keep your guard up, or slip a punch
  if (this.fcIn && scene._fc && scene._fc.go && G.scenes.top() === scene) {
    const I = G.input; this.fcBlock = I.mouse.rdown ? 0.12 : 0;
    if ((this.fcDodgeCd = (this.fcDodgeCd || 0) - dt) <= 0 && I.wasPressed('dodge')) { this.fcDodgeCd = 0.9; const [fx, fy] = G.util.DIR_VEC[this.dir]; this.kbx = -fx * 170; this.kby = -fy * 170; this.fcEvade = G.loop.time + 0.28; G.audio.play('whoosh'); if (this.stamina != null) this.stamina = Math.max(0, this.stamina - 8); }
  } else this.fcBlock = 0;
  return _pu.call(this, dt, scene);
};
// each style carries itself differently; guard, stagger, wind-up and the celebration show on the whole body
const AP0 = G.Actor.prototype, _adr = AP0.draw;
AP0.draw = function (ctx) {
  if (!this.fcIn && !(this.fcCheer > G.loop.time)) return _adr.call(this, ctx);
  const t = G.loop.time + (this.x * 0.01), s = FC.statOf(this), style = s ? s.style : 'player', cheer = this.fcCheer > t - (this.x * 0.01);
  let sy = 1, sx = 1, rot = 0, dy = 0, dx = 0;
  if (this.st && this.st.ko) return _adr.call(this, ctx);
  if (cheer) dy = -Math.abs(Math.sin(t * 6)) * 7;
  else if (this.staggerT > 0) { rot = Math.sin(t * 13) * 0.16; dx = Math.sin(t * 9) * 2; }
  else if (this.downT > 0 && this.downT < 0.35) { sy = 0.72 + (0.35 - this.downT) * 0.8; }   // getting up: on one knee, then standing
  else if (this.fcThrow) { sy = 0.86; sx = 1.1; rot = Math.sin(t * 18) * 0.05; }
  else if (this.fcWind != null) { rot = -0.14 * (this.dir === 1 ? -1 : 1); sy = 1.04; }
  else switch (style) {
    case 'boxer': dy = -Math.abs(Math.sin(t * 7)) * 2; rot = Math.sin(t * 3.5) * 0.04; break;
    case 'wrestler': sy = 0.9; sx = 1.08; break;
    case 'street': dx = Math.sin(t * 11) * 1; rot = Math.sin(t * 5) * 0.08; break;
    case 'technician': rot = Math.sin(t * 2) * 0.03; break;
    case 'heavy': sx = 1.05; rot = Math.sin(t * 1.4) * 0.05; break;
    case 'brawler': rot = 0.06 * (this.dir === 1 ? -1 : 1); sy = 0.97; break;
    default: dy = -Math.abs(Math.sin(t * 5)) * 1;
  }
  ctx.save(); ctx.translate(this.x + dx, this.y + dy); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-this.x, -this.y);
  const r = _adr.call(this, ctx);
  ctx.restore();
  // fists up
  if (this.fcBlock > 0 && !cheer) { const skin = (this.look && this.look.skin) || '#d8b090', y = this.y - 19; ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(this.x - 4, y, 2.2, 0, 6.3); ctx.arc(this.x + 4, y, 2.2, 0, 6.3); ctx.fill(); }
  return r;
};
G.events.on('newDay', () => { if (G.world) { FC.state(G.world); FC.daily(G.world); } });
// rooms with their own lamps are not dark because it is night outside
const _rl = GS.renderLighting;
GS.renderLighting = function (ctx) {
  const d = this.map.meta.ownLight; if (d == null) return _rl.call(this, ctx);
  const w = this.world, base = Object.getPrototypeOf(w).lighting;
  w.lighting = function () { return Object.assign({}, base.call(w), { dark: d, tint: null }); };
  try { return _rl.call(this, ctx); } finally { delete w.lighting; }
};
const _r = GS.render;
GS.render = function (ctx) {
  _r.call(this, ctx);
  const f = this._fc; if (!f || !f.go || this.map.id !== 'fightclub' || this.hideHud) return;
  const R0 = G.renderer, cx = R0.uiW / 2; R0.uiTransform();
  if (f.mode === 'survival') { U.panel(ctx, cx - 90, 6, 180, 34); U.text(ctx, `Round ${Math.max(1, f.round)}`, cx, 12, { size: 12, align: 'center', weight: 'bold', color: '#f0c040' }); U.text(ctx, `Down: ${f.down}   Prize so far: $${FC.rewardFor(f.done)}`, cx, 27, { size: 8, align: 'center', color: U.colors.dim }); if (f.cleared) U.text(ctx, `Next round in ${Math.ceil(Math.max(0, f.pause))}`, cx, 46, { size: 9, align: 'center', color: '#e8e4d0', shadow: true }); }
  else {
    const bar = (a, x, al) => { if (!a) return; U.text(ctx, a === this.player ? 'You' : a.displayName, x, 8, { size: 9, align: al, weight: 'bold', shadow: true }); U.bar(ctx, al === 'left' ? x : x - 130, 20, 130, 7, clamp(a.hp / a.maxHp, 0, 1), '#d04030'); };
    const L = f.mode === 'fight' ? this.player : f.a, Rt = f.mode === 'fight' ? f.foes[0] : f.b;
    bar(L, cx - 150, 'left'); bar(Rt, cx + 150, 'right');
    if (f.mode === 'bet') U.text(ctx, `$${f.amount} on ${G.world.displayName(f.pick)} at ${f.odds}x`, cx, 32, { size: 8, align: 'center', color: '#f0c040', shadow: true });
  }
};
// the crowd noise
if (G.audio.SFX) G.audio.SFX.crowd = (o, T0) => { if (!T0.ctx) return; T0.noise(1.1, { vol: 0.16, freq: 900, q: 0.6, type: 'bandpass' }); T0.noise(0.7, { vol: 0.1, freq: 1700, q: 0.8, type: 'bandpass', delay: 0.2 }); };

// ---------------------------------------------------------------- the people you talk to
const cardText = (c) => { const s = FC.state(c.w); return s.card.map((m, i) => `${i ? '' : 'Next up: '}${c.w.displayName(m[0])} vs ${c.w.displayName(m[1])}`).join('\n'); };
G.DIALOGUES.fc_boss = {
  start: {
    text: (c) => { const s = FC.state(c.w); return s.wins >= 3 ? pick(['There is my favorite way to lose money. What do you want?', 'Back for more? The crowd likes you.']) : pick(['Fresh meat. No, I am not being rude, it is on the board. What do you want?', 'You came down the stairs, so you are welcome. What do you want?']); },
    choices: [
      { text: 'I want a fight.', do: (c) => { const r = FC.avail(c.scene).sort((a, b) => FC.rating(a) - FC.rating(b)), lvl = Math.min(r.length - 1, ((c.w.fc && c.w.fc.wins) || 0) + G.rng.int(0, 2)); FC.fight(c.scene, r[lvl]); return null; } },
      { text: 'I want to pick who I fight.', do: (c) => { c.close && c.close(); G.scenes.push(new G.FighterScene(c.scene, 'fight')); return null; } },
      { text: 'I want to bet on a fight.', do: (c) => { G.scenes.push(new G.FighterScene(c.scene, 'bet')); return null; } },
      { text: 'Show me the fighters.', do: (c) => { G.scenes.push(new G.FighterScene(c.scene, 'view')); return null; } },
      { text: 'Let\'s see how long I can last.', next: 'survival' },
      { text: 'What is coming up?', next: 'card' },
      { text: 'Goodbye.', next: null },
    ],
  },
  card: { text: cardText, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] },
  survival: { text: (c) => { const b = (c.w.fc && c.w.fc.survivalBest) || 0; return `One after another, then two, then a pack. Fists only. You get paid for every round you finish, and you stop when you hit the floor.${b ? ` Your best: ${b}.` : ''}`; }, choices: [{ text: 'Start it.', do: (c) => { FC.survival(c.scene); return null; } }, { text: 'Not tonight.', next: 'start' }] },
};
G.DIALOGUES.fc_bookie = { start: { text: (c) => { void c; return pick(['Odds are on the board. House takes its little piece.', 'You want to bet, you talk to me. You want a favor, you talk to God.']); }, choices: [{ text: 'I want to bet on a fight.', do: (c) => { G.scenes.push(new G.FighterScene(c.scene, 'bet')); return null; } }, { text: 'Goodbye.', next: null }] } };
G.DIALOGUES.fc_fighter = { start: { text: (c) => { const d = G.FIGHTERS[c.npc.id], r = FC.state(c.w).rec[c.npc.id]; return d ? `${pick(LINES[d.style].in)} ${r.w}-${r.l}.` : '...'; }, choices: [{ text: 'Good luck out there.', do: (c) => { G.social.addDisp(c.w, c.npc.id, 1); return null; } }, { text: 'Goodbye.', next: null }] } };

// ---------------------------------------------------------------- choosing a fighter (scrolls, any resolution)
const ROW = 74;
class FighterScene {
  constructor(game, mode) { this.transparent = true; this.game = game; this.mode = mode; this.scroll = 0; this.want = 0; this.sel = 0; this.pick = null; this.amount = 0; this.ids = FC.avail(game); FC.state(game.world); }
  get w() { return this.game.world; }
  close() { G.scenes.remove(this); }
  update(dt) {
    const I = G.input, n = this.ids.length;
    if (I.wasPressed('cancel')) { G.audio.play('back'); if (this.pick) this.pick = null; else this.close(); return; }
    if (this.pick) { this.keysBet(); return; }
    if (I.wasPressed('up')) this.sel = Math.max(0, this.sel - 1);
    if (I.wasPressed('down')) this.sel = Math.min(n - 1, this.sel + 1);
    if (I.mouse.wheel) this.want += Math.sign(I.mouse.wheel) * ROW * 0.8;
    if (I.pressed.has('Enter') || I.pressed.has('Space')) this.choose(this.ids[this.sel]);
    const h = this.h || 300;
    if (I.wasPressed('up') || I.wasPressed('down')) { const top = this.sel * ROW; if (top < this.want) this.want = top; if (top + ROW > this.want + h) this.want = top + ROW - h; }
    this.want = clamp(this.want, 0, Math.max(0, n * ROW - h));
    this.scroll += (this.want - this.scroll) * Math.min(1, dt * 14);
  }
  keysBet() { const I = G.input, p = this.game.player; if (I.wasPressed('left')) this.amount = Math.max(0, this.amount - 5); if (I.wasPressed('right')) this.amount = Math.min(p.gold, this.amount + 5); if (I.pressed.has('Enter')) this.confirm(); }
  choose(id) {
    if (this.mode === 'view') return;
    if (this.mode === 'fight') { this.close(); FC.fight(this.game, id); return; }
    this.pick = id; this.foe = FC.rival(this.w, id); this.amount = Math.min(this.game.player.gold, 25);
  }
  confirm() { if (this.amount <= 0 || this.amount > this.game.player.gold) { G.audio.play('error'); return; } const g = this.game, a = this.pick, b = this.foe, n = this.amount; this.close(); FC.bet(g, a, b, n); }
  render(ctx) {
    const R0 = G.renderer, W = Math.min(560, R0.uiW - 24), H = Math.min(R0.uiH - 24, 440), x = (R0.uiW - W) / 2, y = (R0.uiH - H) / 2, m = G.input.mouse;
    U.dim(ctx, 0.6);
    U.panel(ctx, x, y, W, H, { title: this.mode === 'fight' ? 'Pick your opponent' : this.mode === 'bet' ? 'Who is your money on?' : 'The fighters', titleSize: 12 });
    U.text(ctx, `$${this.game.player.gold}`, x + W - 40, y + 21, { align: 'right', size: 10, color: '#a87a10', weight: 'bold' });
    const lx = x + 8, ly = y + 34, lw = W - 26, lh = this.h = H - 44;
    ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, lw, lh); ctx.clip();
    this.ids.forEach((id, i) => {
      const ry = ly + i * ROW - this.scroll; if (ry + ROW < ly || ry > ly + lh) return;
      const d = G.FIGHTERS[id], r = this.w.fc.rec[id], hover = !this.pick && m.ux >= lx && m.ux < lx + lw && m.uy >= Math.max(ly, ry) && m.uy < Math.min(ly + lh, ry + ROW - 3);
      if (hover) { this.sel = i; if (m.pressed) { m.pressed = false; this.choose(id); } }
      ctx.fillStyle = i === this.sel ? 'rgba(216,180,104,0.18)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(lx, ry, lw, ROW - 3);
      FC.portrait(ctx, id, lx + 4, ry + 4, 62);
      U.text(ctx, d.name, lx + 74, ry + 5, { size: 11, weight: 'bold' });
      U.text(ctx, `${STYLE[d.style]} · ${d.exp} yrs`, lx + 74, ry + 20, { size: 8, color: U.colors.dim });
      U.text(ctx, `Record ${r.w}-${r.l}   Streak ${r.s || 0}`, lx + 74, ry + 32, { size: 8, color: U.colors.dim });
      const stats = [['Strength', d.str], ['Stamina', d.sta], ['Speed', d.spd], ['Durability', d.dur], ['Defense', d.def], ['Technique', d.tec]], sx = lx + Math.max(190, lw * 0.42), cw = Math.max(70, (lw - (sx - lx) - 74) / 2);
      stats.forEach(([k, v], j) => { const cx = sx + (j % 3 >= 0 ? (j % 2) * cw : 0), cy = ry + 5 + Math.floor(j / 2) * 22; U.text(ctx, k, cx, cy, { size: 7, color: U.colors.dim }); U.bar(ctx, cx, cy + 10, cw - 10, 5, v / 100, '#c89040'); });
      if (this.mode !== 'fight') { const o = FC.odds(this.w, id, FC.rival(this.w, id)); U.text(ctx, `${o.toFixed(2)}x`, lx + lw - 8, ry + 8, { size: 12, align: 'right', weight: 'bold', color: '#8aea7a' }); U.text(ctx, `$10 pays $${Math.round(10 * o)}`, lx + lw - 8, ry + 26, { size: 7, align: 'right', color: U.colors.dim }); }
      else U.text(ctx, `Purse $${Math.round(30 + FC.rating(id) * 2.4)}`, lx + lw - 8, ry + 8, { size: 9, align: 'right', color: '#8aea7a' });
    });
    ctx.restore();
    const total = this.ids.length * ROW;
    if (total > lh) { const th = Math.max(24, lh * lh / total), ty = ly + (lh - th) * (this.scroll / (total - lh)); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + W - 14, ly, 6, lh); ctx.fillStyle = '#c8b080'; ctx.fillRect(x + W - 14, ty, 6, th); if (m.down && m.ux > x + W - 18 && m.ux < x + W - 6 && m.uy >= ly && m.uy < ly + lh) this.want = this.scroll = clamp(((m.uy - ly) / lh) * total - lh / 2, 0, total - lh); }
    if (this.pick) {
      const BW = Math.min(340, W - 20), BH = 150, bx = (R0.uiW - BW) / 2, by = (R0.uiH - BH) / 2, o = FC.odds(this.w, this.pick, this.foe), p = this.game.player;
      U.dim(ctx, 0.5); U.panel(ctx, bx, by, BW, BH, { title: 'Your bet', titleSize: 11 });
      FC.portrait(ctx, this.pick, bx + 10, by + 32, 44);
      U.text(ctx, `${this.w.displayName(this.pick)} vs ${this.w.displayName(this.foe)}`, bx + 60, by + 34, { size: 9, weight: 'bold' });
      U.text(ctx, `Bet: $${this.amount}`, bx + 60, by + 50, { size: 11, color: '#e8c060', weight: 'bold' });
      U.text(ctx, `Pays: $${Math.round(this.amount * o)}`, bx + 60, by + 66, { size: 9, color: '#8aea7a' });
      [[-25, '-25'], [-5, '-5'], [5, '+5'], [25, '+25'], [1e9, 'All']].forEach(([v, l], i) => { const r = U.button(ctx, bx + 10 + i * 46, by + 88, 42, 18, l, { size: 8 }); if (r.clicked) this.amount = clamp(v === 1e9 ? p.gold : this.amount + v, 0, p.gold); });
      const c = U.button(ctx, bx + BW - 104, by + 118, 94, 20, 'Confirm', { size: 9, disabled: this.amount <= 0 }); if (c.clicked) this.confirm();
      const b = U.button(ctx, bx + 10, by + 118, 70, 20, 'Back', { size: 9 }); if (b.clicked) this.pick = null;
    }
  }
}
G.FighterScene = FighterScene;
const _wl = G.onWorldLoaded; G.onWorldLoaded = function (w) { if (_wl) _wl.apply(this, arguments); w.shops = w.shops || {}; if (!w.shops.fc_bar) w.shops.fc_bar = { stock: G.util.clone(G.SHOPS.fc_bar.stock), gold: G.SHOPS.fc_bar.gold, owner: 'fc_barkeep' }; };
{ const _w = G.saves.write; G.saves.write = function (slot, scene) { const a = arguments; return FC.rearm(scene, () => _w.apply(this, a)); }; }
})();
