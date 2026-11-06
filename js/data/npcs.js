'use strict';
// NPC roster. Every NPC is killable. `name` is the ROLE label shown until the player asks for their
// name; each NPC also gets a random real name per playthrough (see js/data/names.js).
//
// Fields:
//   name (role), map, faction, look (see G.look), hp, combat: flee | fight | guard
//   leader: true => faction leader (offers work, joining, contributions in dialogue)
//   weapon/armor: item ids (affect damage/defense and drop on death)
//   home: building id (used for sleeping, <home>_bed etc.)
//   schedule: [{ from, to, at, act }]  act = idle | work | wander | sleep | patrol
//             `at` = point name, {x,y} tile, or an array of points for patrols
//   dialogue: id in G.DIALOGUES (default 'generic')    shop: id in G.SHOPS
//   relations: { otherNpcId: 'spouse' | 'family' | 'friend' | 'master' | 'apprentice' | 'comrade' }
//   job: line used when asked "What do you do?"      inv: [[itemId, qty]] carried (lootable)
//   streetName: true => gets a street nickname       gender: derived from look.body

const SKINS = ['#f2cfa8', '#e0b088', '#c89068', '#a87050', '#8a5a3a', '#6a4028'];
const HAIRS = ['#2a1e18', '#4a3020', '#7a5030', '#b08040', '#d8c070', '#8a8a8a', '#6a2a1a', '#1a1a22', '#c8c8c8'];
const SHIRTS = ['#6a8ab8', '#8a4a4a', '#5a8a5a', '#a08a5a', '#7a5a8a', '#5a6a7a', '#b8a888', '#8a6a4a', '#4a6a6a', '#c8b898', '#6a7a3a'];
const PANTS = ['#4a3a2a', '#3a3a4a', '#5a4a3a', '#2e3a2e', '#4a4038', '#4a5a7a'];
const EYES = ['#1d1a22', '#3a2a1a', '#2a4a7a', '#2a5a3a', '#5a5a60'];
G.LOOK_PALETTE = { SKINS, HAIRS, SHIRTS, PANTS, EYES };
// Races (character creation picks one, then a skin tone from its own range; look.race is saved with the look).
// Each range is wide on purpose: nobody is reduced to one shade. 'other' keeps the whole palette.
G.RACES = {
  caucasian: { name: 'Caucasian', skins: ['#f6dcc4', '#f2cfa8', '#ecc4a0', '#e8c098', '#e0b088', '#d4a37c'] },
  afro: { name: 'Afro', skins: ['#b07a52', '#9a6440', '#8a5a3a', '#74482c', '#6a4028', '#563220', '#4a2e1c', '#3a2416'] },
  latino: { name: 'Latino', skins: ['#ecc4a0', '#e0b088', '#d4a07a', '#c89068', '#b07a52', '#a87050', '#8a5a3a'] },
  asian: { name: 'Asian', skins: ['#f4dcbc', '#ecd0a8', '#e4c49a', '#d8b48a', '#c8a074', '#b08860'] },
  notraeli: { name: 'Notraeli', skins: ['#f4d8c0', '#eccaa8', '#e0b890', '#d4a880', '#c89670', '#b08060'] },
  other: { name: 'Mixed / Other', skins: ['#f2cfa8', '#e8c098', '#e0b088', '#c89068', '#a87050', '#8a5a3a', '#6a4028', '#4a2e1c'] },
};
G.races = {
  ids: () => Object.keys(G.RACES),
  skins: (race) => (G.RACES[race] || G.RACES.other).skins,
  // how people are spread in the world (weights by repetition; the Notraeli are their own community: js/data/notrael.js)
  mix: ['caucasian', 'caucasian', 'caucasian', 'afro', 'afro', 'latino', 'latino', 'asian', 'other'],
  // the race whose range holds this tone best (for someone drawn with a fixed skin)
  closest(hex) {
    const v = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0), a = v(hex);
    let best = 'other', bd = 1e9;
    for (const id of ['caucasian', 'afro', 'latino', 'asian']) for (const c of G.RACES[id].skins) { const b = v(c), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = id; } }
    return best;
  },
  // the tone in this race's range closest to a given one (switching race keeps you as close as it can)
  nearest(race, hex) {
    const v = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0), a = v(hex);
    return this.skins(race).reduce((best, c) => { const b = v(c), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; return d < best[1] ? [c, d] : best; }, [null, 1e9])[0];
  },
};

G.look = (seed, o = {}) => {
  const r = new G.RNG('look-' + seed);
  const body = o.body || (r.chance(0.5) ? 'f' : 'm');
  const f = body === 'f';
  const top = f ? r.pick(['shirt', 'tunic', 'dress', 'vest', 'jacket', 'shirt', 'tshirt', 'tank', 'longsleeve']) : r.pick(['shirt', 'tunic', 'jacket', 'vest', 'shirt', 'tshirt', 'tshirt', 'tank', 'longsleeve']);
  // ethnicity (its own stream, so the rest of a look stays what it was); a skin given by hand decides the race instead
  const rr = new G.RNG('race-' + seed), race = o.race || (o.skin ? G.races.closest(o.skin) : rr.pick(G.races.mix));
  // what someone wears on their head says who they are: its own stream too, so the rest of a look stays what it was
  const hr = new G.RNG('hat-' + seed), hatPick = o.top === 'jacket' || o.apron ? null : hr.chance(0.16) ? hr.pick(f ? ['beanie', 'bucket', 'straw', 'cap'] : ['cap', 'cap', 'beanie', 'fedora', 'bucket']) : null;
  return Object.assign(hatPick ? { hat: hatPick, hatColor: hr.pick(['#2a2a30', '#5a3a2a', '#3a4a6a', '#7a3a3a', '#6a7a5a', '#b8a07a']) } : {}, {
    body, race, skin: (r.pick(SKINS), rr.pick(G.races.skins(race))), hair: r.pick(HAIRS), eyes: r.pick(EYES),
    hairStyle: f ? r.pick([1, 3, 6, 7, 10, 0, 8, 9]) : r.pick([0, 0, 2, 5, 9, 8, 0, 3]),
    facial: f ? 0 : r.pick([0, 0, 0, 1, 2, 3]),
    top, shirt: r.pick(SHIRTS), shirt2: r.pick(SHIRTS),
    bottom: f && top !== 'dress' ? r.pick(['pants', 'skirt', 'pants']) : 'pants', pants: r.pick(PANTS),
  }, o);
};

// Schedule templates
const S = {
  worker(work, home, o = {}) {
    const wake = o.wake ?? 6, start = o.start ?? 8, end = o.end ?? 18, sleep = o.sleep ?? 22;
    return [
      { from: wake, to: start, at: home + '_in', act: 'idle' },
      { from: start, to: end, at: work, act: o.workAct || 'work' },
      { from: end, to: sleep, at: o.evening || home + '_door', act: 'wander' },
      { from: sleep, to: wake, at: o.bed || home + '_bed', act: 'sleep' },
    ];
  },
  idler(area, home, o = {}) {
    return [
      { from: 7, to: o.end ?? 20, at: area, act: 'wander' },
      { from: o.end ?? 20, to: 22, at: home + '_in', act: 'idle' },
      { from: 22, to: 7, at: o.bed || home + '_bed', act: 'sleep' },
    ];
  },
  guard(route, bed, night = false) {
    return night
      ? [{ from: 20, to: 8, at: route, act: 'patrol' }, { from: 8, to: 20, at: bed, act: 'sleep' }]
      : [{ from: 7, to: 21, at: route, act: 'patrol' }, { from: 21, to: 7, at: bed, act: 'sleep' }];
  },
  post(point, bed, night = false) {
    return night
      ? [{ from: 20, to: 8, at: point, act: 'work' }, { from: 8, to: 20, at: bed, act: 'sleep' }]
      : [{ from: 6, to: 20, at: point, act: 'work' }, { from: 20, to: 6, at: bed, act: 'sleep' }];
  },
  camp(area, bedPoint) {
    return [{ from: 6, to: 23, at: area, act: 'wander' }, { from: 23, to: 6, at: bedPoint, act: 'sleep' }];
  },
  // gangs and punks: hang around the hideout by day, roam their turf at night, sleep in the morning
  street(hangout, turf, bed) {
    return [
      { from: 11, to: 20, at: hangout, act: 'wander' },
      { from: 20, to: 4, at: turf, act: 'patrol' },
      { from: 4, to: 11, at: bed, act: 'sleep' },
    ];
  },
  always(point, act = 'work') { return [{ from: 0, to: 24, at: point, act }]; },
};
G.SCHED = S;

const COP_LOOK = (seed, o) => G.look(seed, Object.assign({ top: 'shirt', bottom: 'pants', shirt: '#2a3a6a', pants: '#1e2230', shoes: '#111111', hat: 'cap', hatColor: '#1e2a4a' }, o));
const RURAL_GUARD_LOOK = (seed) => G.look(seed, { top: 'shirt', bottom: 'pants', shirt: '#8a7a5a', pants: '#3a3a2a', hat: 'cap', hatColor: '#5a4a2a' });
const BANDIT_LOOK = (seed) => G.look(seed, { top: 'jacket', bottom: 'pants', shirt: '#2a2220', shirt2: '#4a3a3a', pants: '#2a2a3a', hat: 'bandana', hatColor: '#3a2a2a' });
const SECURITY_LOOK = (seed) => G.look(seed, { body: 'm', top: 'jacket', bottom: 'pants', shirt: '#1a1a1e', shirt2: '#1a1a1e', pants: '#1a1a1e', shoes: '#111111', glasses: 'sun', hairStyle: 0, facial: 0 });
const INMATE_LOOK = (seed, o) => G.look(seed, Object.assign({ top: 'shirt', bottom: 'pants', shirt: '#d8782a', pants: '#d8782a', hat: null }, o));
// Inmates: count in their cell, meals in the mess hall, the yard (or laundry duty), lights out at 22:00.
const INMATE = (cell, laundry = false) => [
  { from: 22, to: 6, at: `j_cell${cell}_bed`, act: 'sleep' },
  { from: 6, to: 7, at: `j_cell${cell}`, act: 'idle' },
  { from: 7, to: 8, at: 'j_mess', act: 'wander' },
  { from: 8, to: 12, at: laundry ? 'j_laundry_work' : 'j_yard', act: 'wander' },
  { from: 12, to: 13, at: 'j_mess', act: 'wander' },
  { from: 13, to: 18, at: laundry ? 'j_laundry_work' : 'j_yard', act: 'wander' },
  { from: 18, to: 19, at: 'j_mess', act: 'wander' },
  { from: 19, to: 22, at: 'j_corridor', act: 'wander' },
];
// The Elite: days at home or about the district, evenings in the club lounge, and late at night
// (23:00-02:00) a secret gathering in the sanctum behind it.
const ELITE = (home, day) => [
  { from: 9, to: 19, at: day, act: 'wander' },
  { from: 19, to: 23, at: 'h_lounge', act: 'wander' },
  { from: 23, to: 2, at: 'h_club_sanctum', act: 'patrol' },
  { from: 2, to: 9, at: home + '_bed', act: 'sleep' },
];
const SUIT_LOOK = (seed, o) => G.look(seed, Object.assign({ top: 'jacket', bottom: 'pants', shirt: '#22242a', shirt2: '#e8e4dc', pants: '#22242a', shoes: '#111111', glasses: 'sun' }, o));
const GANG_LOOK = (seed, color, o) => G.look(seed, Object.assign({ top: 'jacket', bottom: 'pants', shirt: '#2a2a30', shirt2: color, pants: '#3a3a4a', hat: 'bandana', hatColor: color }, o));
const PUNK_LOOK = (seed, o) => G.look(seed, Object.assign({ top: 'jacket', bottom: 'pants', shirt: '#1a1a1e', shirt2: '#d060d0', pants: '#2a2a40', hairStyle: 4, hair: '#d040a0', eyes: '#1d1a22' }, o));
// the Revolutionaries: thrifted activist chic. Dyed hair, round glasses, a beanie, a tote full of zines, pins.
const REV_LOOK = (seed, o) => {
  const r = new G.RNG('rev-' + seed);
  return G.look(seed, Object.assign({
    top: r.pick(['hoodie', 'jacket', 'shirt', 'hoodie']), shirt: r.pick(['#c8a8d8', '#a8d8c0', '#e8c0a0', '#7a9a6a', '#d8d0b8', '#5a6a8a']), shirt2: r.pick(['#e8e0d0', '#3a3a40']),
    pants: r.pick(['#3a4a6a', '#5a4a3a', '#2a2a30', '#6a5a7a']), hair: r.pick(['#3ab0e0', '#e070b0', '#70d0a0', '#b080e0', '#e08040', '#e05050']),
    glasses: r.chance(0.6) ? 'round' : null, hat: r.chance(0.45) ? 'beanie' : null, hatColor: r.pick(['#c8506a', '#5a8a6a', '#d8a040', '#4a4a6a']),
    tote: r.chance(0.7), toteColor: r.pick(['#d8ccb0', '#e8e0d0', '#7a9a6a']), pins: true, nosering: r.chance(0.5),
  }, o));
};
G.REV_LOOK = REV_LOOK;

G.NPCS = {
  // ======================================================= RURAL ZONE
  r_elder: {
    name: 'Town Mayor', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee',
    look: G.look('elder', { body: 'm', hair: '#d8d8d8', facial: 1, top: 'jacket', shirt: '#5a4a3a', shirt2: '#e8e4dc', hairStyle: 2, glasses: 'round' }),
    home: 'r_elder', schedule: S.worker('r_square', 'r_elder', { start: 9, end: 17, workAct: 'wander' }),
    dialogue: 'r_elder', gold: 60, inv: [['bread', 1]], job: 'I look after this town, as best an old one can.',
  },
  r_innkeeper: {
    name: 'Motel Owner', map: 'rural', faction: 'civilians', hp: 30, combat: 'flee',
    look: G.look('innkeeper', { apron: '#d8d2c4', shirt: '#8a4a4a' }),
    home: 'r_inn', shop: 'r_inn', dialogue: 'innkeeper', gold: 80,
    schedule: [{ from: 6, to: 7, at: 'r_inn_in', act: 'idle' }, { from: 7, to: 23, at: 'r_inn_work', act: 'work' }, { from: 23, to: 6, at: 'r_inn_bed', act: 'sleep' }],
    job: 'I run the motel. Beds, food, beer, and gossip.',
  },
  r_merchant: {
    name: 'Shopkeeper', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee',
    look: G.look('rmerchant', { shirt: '#a08a5a', hat: 'cap', hatColor: '#5a3a2a' }),
    home: 'r_store', shop: 'r_store', dialogue: 'r_merchant', gold: 120,
    schedule: S.worker('r_store_work', 'r_store', { start: 8, end: 19 }),
    job: 'General goods. If I do not have it, you do not need it.',
  },
  r_smith: {
    name: 'Mechanic', map: 'rural', faction: 'civilians', hp: 55, combat: 'fight', weapon: 'sledgehammer',
    look: G.look('smith', { body: 'm', facial: 1, top: 'shirt', shirt: '#3a4a6a', pants: '#3a4a6a', hat: 'cap', hatColor: '#c83030', skin: '#c89068' }),
    home: 'r_smithy', shop: 'r_smith', gold: 150, relations: { r_apprentice: 'apprentice' },
    schedule: S.worker('r_smith_work', 'r_smithy', { start: 7, end: 18 }),
    job: 'Hardware, tools, car repairs. If it is broken, bring it here.',
  },
  r_apprentice: {
    name: 'Apprentice Mechanic', map: 'rural', faction: 'civilians', hp: 30, combat: 'flee',
    look: G.look('apprentice', { apron: '#4a3a2a' }), home: 'r_house4', gold: 20,
    relations: { r_smith: 'master' },
    schedule: S.worker('r_smithy_work', 'r_house4', { start: 8, end: 18 }),
    job: 'I am learning the trade from the mechanic.',
  },
  r_priest: {
    name: 'Priest', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee',
    look: G.look('rpriest', { top: 'jacket', shirt: '#1e1e22', shirt2: '#e8e4dc', pants: '#1e1e22', hairStyle: 2 }),
    home: 'r_chapel', dialogue: 'priest', gold: 40,
    schedule: S.worker('r_chapel_work', 'r_chapel', { start: 6, end: 20 }),
    job: 'I tend the church and the graves behind it.',
  },
  r_farmer1: {
    name: 'Farmer', map: 'rural', faction: 'civilians', hp: 35, combat: 'flee',
    look: G.look('farmer1', { hat: 'cap', hatColor: '#3a6a3a', shirt: '#6a8ab8', top: 'shirt' }), home: 'r_farm1', gold: 25, inv: [['wheat', 3]],
    schedule: S.worker('r_field_e', 'r_farm1', { start: 6, end: 18, workAct: 'wander' }),
    job: 'Wheat, mostly. The east fields are mine.',
  },
  r_farmer2: {
    name: 'Rancher', map: 'rural', faction: 'civilians', hp: 40, combat: 'fight', weapon: 'shotgun',
    look: G.look('farmer2', { hat: 'straw', shirt: '#8a6a4a', top: 'vest' }), home: 'r_farm2', gold: 30,
    relations: { r_farmwife: 'spouse' }, dialogue: 'rancher', inv: [['egg', 2]],
    schedule: S.worker('r_pen', 'r_farm2', { start: 6, end: 18, workAct: 'wander' }),
    job: 'Those chickens and cows in the pen? Mine. Hands off.',
  },
  r_farmwife: {
    name: "Rancher's Spouse", map: 'rural', faction: 'civilians', hp: 30, combat: 'flee',
    look: G.look('farmwife', { shirt: '#5a8a5a' }), home: 'r_farm2', gold: 15,
    relations: { r_farmer2: 'spouse' },
    schedule: S.worker('r_field_s', 'r_farm2', { start: 7, end: 17, workAct: 'wander', bed: 'r_farm2_bed2' }),
    job: 'I keep the south fields and the house.',
  },
  r_guard1: {
    name: "Sheriff's Deputy", map: 'rural', faction: 'government', hp: 60, combat: 'guard', weapon: 'police_baton', armor: 'leather_armor',
    look: RURAL_GUARD_LOOK('rg1'), home: 'r_watch', gold: 20, relations: { r_guard2: 'comrade' },
    schedule: S.guard('r_patrol', 'r_watch_bed'), job: 'I keep the peace out here. Do not make me work.',
  },
  r_guard2: {
    name: 'Night Deputy', map: 'rural', faction: 'government', hp: 60, combat: 'guard', weapon: 'police_baton', armor: 'leather_armor',
    look: RURAL_GUARD_LOOK('rg2'), home: 'r_watch', gold: 20, relations: { r_guard1: 'comrade' },
    schedule: S.guard('r_patrol', 'r_watch_bed2', true), job: 'Night watch. Someone has to.',
  },
  r_villager1: {
    name: 'Civilian', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('rv1'),
    home: 'r_house1', gold: 10, schedule: S.idler('r_square', 'r_house1'), relations: { r_villager2: 'friend' },
  },
  r_villager2: {
    name: 'Civilian', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('rv2'),
    home: 'r_house2', gold: 10, schedule: S.idler('r_well', 'r_house2'), relations: { r_villager1: 'friend' },
  },
  // secretly a revolutionary — only admits it to people the revolution trusts
  r_villager3: {
    name: 'Civilian', map: 'rural', faction: 'revolutionaries', hp: 25, combat: 'flee', look: G.look('rv3', { pins: true }),
    home: 'r_house3', gold: 10, schedule: S.idler('r_graveyard', 'r_house3', { end: 18 }), relations: { f_rev_leader: 'comrade' },
  },

  // ---- out on the county road, the lake and the trailer park
  r_cook: {
    name: 'Diner Cook', map: 'rural', faction: 'civilians', hp: 35, combat: 'fight', weapon: 'kitchen_knife',
    look: G.look('cook', { body: 'm', apron: '#e8e4dc', hat: 'cap', hatColor: '#e8e4dc', facial: 2 }), home: 'r_diner', shop: 'r_diner', gold: 120,
    schedule: S.worker('r_diner_work', 'r_diner', { start: 6, end: 21 }), job: 'Burgers, coffee, pie. The best and only diner in town.',
  },
  r_attendant: {
    name: 'Gas Station Clerk', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('gasclerk', { top: 'shirt', shirt: '#c83030', hat: 'cap', hatColor: '#c83030' }),
    home: 'r_gas', shop: 'r_gas', gold: 150, schedule: S.worker('r_gas_work', 'r_gas', { start: 5, end: 23, sleep: 23, wake: 4 }),
    job: 'Gas, smokes, snacks. Bathroom key is on the chain.',
  },
  r_swimcoach: {
    name: 'Swim Instructor', map: 'rural', faction: 'civilians', hp: 40, combat: 'flee', look: G.look('swimcoach', { body: 'f', top: 'shirt', shirt: '#d03030', bottom: 'shorts', pants: '#2a3a6a', hat: 'cap', hatColor: '#d03030', hairStyle: 6 }),
    home: 'r_lakehouse', dialogue: 'swimcoach', gold: 60, schedule: S.worker('r_lake_beach', 'r_lakehouse', { start: 8, end: 19, workAct: 'wander' }),
    job: 'I teach swimming at the lake. Lifeguard, too, when anyone bothers to swim.',
  },
  r_dealer: {
    name: 'Drifter', map: 'rural', faction: 'civilians', hp: 40, combat: 'fight', weapon: 'switchblade', streetName: true,
    look: G.look('drifter', { body: 'm', top: 'hoodie', shirt: '#3a3a2a', pants: '#2a2a2a', facial: 3, hairStyle: 5 }), home: 'r_trailer3', shop: 'r_dealer', gold: 200,
    schedule: [{ from: 13, to: 4, at: 'r_trailer_lot', act: 'wander' }, { from: 4, to: 13, at: 'r_trailer3_bed', act: 'sleep' }],
    job: 'I sell things that make the days go faster. You buying?',
  },
  r_trailer1: { name: 'Trailer Resident', map: 'rural', faction: 'civilians', hp: 35, combat: 'fight', weapon: 'baseball_bat', look: G.look('tr1', { top: 'vest', facial: 1, body: 'm' }), home: 'r_trailer1', gold: 10, schedule: S.idler('r_trailer_lot', 'r_trailer1', { end: 23 }), relations: { r_trailer2: 'friend', r_dealer: 'friend' } },
  r_trailer2: { name: 'Trailer Resident', map: 'rural', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('tr2', { body: 'f', top: 'shirt' }), home: 'r_trailer2', gold: 10, schedule: S.idler('r_trailer_lot', 'r_trailer2'), relations: { r_trailer1: 'friend' } },

  // ======================================================= CENTER — government & police
  c_lord: {
    name: 'Mayor', map: 'city', faction: 'government', leader: true, hp: 45, combat: 'flee',
    look: SUIT_LOOK('lord', { body: 'm', shirt: '#2a2a3a', glasses: null, facial: 1, hair: '#8a8a8a' }),
    home: 'c_manor', dialogue: 'lord', gold: 300, inv: [['gem', 1]], relations: { c_noble1: 'family', c_official: 'comrade' },
    schedule: S.worker('c_manor_work', 'c_manor', { start: 8, end: 22, evening: 'c_manor_in' }),
    job: 'I run this city. On paper, anyway.',
  },
  c_official: {
    name: 'City Official', map: 'city', faction: 'government', hp: 30, combat: 'flee',
    look: G.look('official', { top: 'jacket', shirt: '#3a4a6a', shirt2: '#e8e4dc', pants: '#2a2a3a', glasses: 'round' }),
    home: 'c_manor', gold: 80, relations: { c_lord: 'comrade' },
    schedule: S.worker({ x: 93, y: 12 }, 'c_manor', { start: 9, end: 17, evening: 'c_plaza', bed: 'c_manor_bed2' }),
    job: 'Permits, taxes, records. The machinery of government.',
  },
  c_captain: {
    name: 'Police Chief', map: 'city', faction: 'government', hp: 100, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest',
    look: COP_LOOK('captain', { body: 'm', facial: 1, shirt: '#22305a' }),
    home: 'c_barracks', dialogue: 'captain', gold: 80,
    schedule: S.worker('c_barracks_work', 'c_barracks', { start: 7, end: 20, evening: 'c_plaza' }),
    job: 'I run the police department. Pay your fines.',
  },
  c_guard1: { name: 'Police Officer', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest', look: COP_LOOK('cg1'), home: 'c_barracks', gold: 15, schedule: S.post('c_gate_w', 'c_barracks_bed2') },
  c_guard2: { name: 'Police Officer', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest', look: COP_LOOK('cg2'), home: 'c_barracks', gold: 15, schedule: S.post('c_gate_n', 'c_barracks_bed3') },
  c_guard3: { name: 'Police Officer', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'police_baton', armor: 'kevlar_vest', look: COP_LOOK('cg3'), home: 'c_barracks', gold: 15, schedule: S.guard('c_patrol_a', 'c_barracks_bed4') },
  c_guard4: { name: 'Police Officer', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'police_baton', armor: 'kevlar_vest', look: COP_LOOK('cg4'), home: 'c_barracks', gold: 15, schedule: S.guard('c_patrol_b', 'c_barracks_bed5') },
  c_guard5: { name: 'Night Patrol', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest', look: COP_LOOK('cg5'), home: 'c_barracks', gold: 15, schedule: S.guard('c_patrol_c', 'c_barracks_bed2', true) },
  c_guard6: { name: 'Night Patrol', map: 'city', faction: 'government', hp: 70, combat: 'guard', weapon: 'police_baton', armor: 'kevlar_vest', look: COP_LOOK('cg6'), home: 'c_barracks', gold: 15, schedule: S.guard('c_patrol_d', 'c_barracks_bed3', true) },

  // ======================================================= CENTER — CIA (covert)
  c_agent1: {
    name: 'Man in a Suit', map: 'city', faction: 'cia', leader: true, hp: 70, combat: 'fight', weapon: 'pistol',
    look: SUIT_LOOK('agent1', { body: 'm', hairStyle: 9, facial: 0 }), home: 'c_noble2', gold: 120, relations: { c_agent2: 'comrade' },
    schedule: S.worker('c_noble2_work', 'c_noble2', { start: 9, end: 17, evening: 'c_plaza' }),
    job: 'Import and export. Mostly paperwork.',
  },
  c_agent2: {
    name: 'Woman in a Suit', map: 'city', faction: 'cia', hp: 60, combat: 'fight', weapon: 'pistol',
    look: SUIT_LOOK('agent2', { body: 'f', hairStyle: 6, hair: '#1a1a22' }), home: 'c_noble2', gold: 60, relations: { c_agent1: 'comrade' },
    schedule: S.idler('c_plaza', 'c_noble2', { end: 21, bed: 'c_noble2_bed2' }),
    job: 'Just enjoying the city.',
  },

  // ======================================================= CENTER — civilians & businesses
  c_merchant: {
    name: 'Store Clerk', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cmerchant', { top: 'shirt', shirt: '#c83030', hat: 'cap', hatColor: '#c83030' }),
    home: 'c_store', shop: 'c_store', gold: 200, schedule: S.worker('c_store_work', 'c_store', { start: 7, end: 23 }),
    job: 'Open late. Cash only. Do not ask about the bathroom.',
  },
  c_armorer: {
    name: 'Gun Dealer', map: 'city', faction: 'civilians', hp: 60, combat: 'fight', weapon: 'shotgun', armor: 'kevlar_vest',
    look: G.look('armorer', { body: 'm', top: 'vest', shirt: '#4a5a3a', facial: 3, hat: 'cap', hatColor: '#3a4a2a' }), home: 'c_armory', shop: 'c_armory', gold: 400,
    schedule: S.worker('c_armory_work', 'c_armory', { start: 9, end: 19 }), job: 'Guns, ammo and body armor. All perfectly legal. Mostly.',
  },
  c_alchemist: {
    name: 'Pharmacist', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('alch', { top: 'jacket', shirt: '#e8e4dc', shirt2: '#e8e4dc', glasses: 'round' }),
    home: 'c_alchemist', shop: 'c_alchemist', gold: 250, schedule: S.worker('c_alchemist_work', 'c_alchemist', { start: 9, end: 20 }),
    job: 'Medicine, first aid and something for the pain.',
  },
  c_barber: {
    name: 'Barber', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('barber', { apron: '#e8e4dc', hairStyle: 9 }),
    home: 'c_barber', dialogue: 'barber', gold: 90, schedule: S.worker('c_barber_work', 'c_barber', { start: 8, end: 19 }),
    job: 'Haircuts, shaves, and hair dye. Sit down.',
  },
  c_tailor: {
    name: 'Fashion Designer', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('tailor', { top: 'dress', body: 'f', shirt: '#a83a6a', hairStyle: 3, glasses: 'sun' }),
    home: 'c_clothes', shop: 'c_clothes', gold: 300, schedule: S.worker('c_clothes_work', 'c_clothes', { start: 10, end: 19 }),
    job: 'I sell clothes. Good ones. Have a look.',
  },
  c_tavernkeep: {
    name: 'Bartender', map: 'city', faction: 'civilians', hp: 35, combat: 'fight', weapon: 'baseball_bat',
    look: G.look('tavern', { body: 'm', top: 'vest', shirt: '#2a2a30', shirt2: '#e8e4dc', facial: 1 }), home: 'c_tavern', shop: 'c_tavern', dialogue: 'innkeeper', gold: 120,
    schedule: [{ from: 7, to: 9, at: 'c_tavern_in', act: 'idle' }, { from: 9, to: 24, at: 'c_tavern_work', act: 'work' }, { from: 0, to: 7, at: 'c_tavern_bed', act: 'sleep' }],
    job: 'I pour drinks and rent the room upstairs.',
  },
  c_market1: {
    name: 'Food Vendor', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('m1', { apron: '#e8e4dc', hat: 'cap', hatColor: '#e8e4dc' }),
    home: 'c_house8', shop: 'c_market_food', gold: 100, schedule: S.worker('c_stall1', 'c_house8', { start: 7, end: 17 }),
  },
  c_market2: {
    name: 'Street Vendor', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('m2', { hat: 'cap', hatColor: '#3a5a3a', top: 'hoodie' }),
    home: 'c_house9', shop: 'c_market_goods', gold: 220, schedule: S.worker('c_stall2', 'c_house9', { start: 8, end: 18 }),
  },
  c_priest: {
    name: 'Pastor', map: 'city', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('cpriest', { body: 'm', top: 'jacket', shirt: '#1e1e22', shirt2: '#e8e4dc', pants: '#1e1e22', hairStyle: 2, facial: 1 }),
    home: 'c_temple', dialogue: 'priest', gold: 100, schedule: S.worker('c_temple_work', 'c_temple', { start: 6, end: 21 }),
  },
  c_noble1: {
    name: 'Businessman', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: SUIT_LOOK('noble1', { body: 'm', shirt: '#3a4a6a', glasses: null }),
    home: 'c_noble1', dialogue: 'noble', gold: 150, relations: { c_lord: 'family' }, schedule: S.worker('c_noble1_work', 'c_noble1', { start: 9, end: 18, evening: 'c_plaza' }),
  },
  c_harbormaster: {
    name: 'Harbormaster', map: 'city', faction: 'civilians', hp: 40, combat: 'fight', weapon: 'combat_knife',
    look: G.look('harbor', { body: 'm', hat: 'cap', hatColor: '#2a3a5a', facial: 1, shirt: '#5a6a7a', top: 'jacket' }),
    home: 'c_house10', dialogue: 'harbormaster', gold: 60, schedule: S.worker('c_ferry', 'c_house10', { start: 6, end: 20 }),
    job: 'Ships come, ships go. I keep the ledger.',
  },
  c_beggar: {
    name: 'Homeless Man', map: 'city', faction: 'civilians', hp: 15, combat: 'flee', look: G.look('beggar', { shirt: '#6a6050', pants: '#4a4438', facial: 1, body: 'm', top: 'hoodie' }),
    home: 'c_house7', dialogue: 'beggar', gold: 1, schedule: S.idler('c_plaza', 'c_house7', { end: 21 }),
  },
  c_citizen1: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc1'), home: 'c_house1', gold: 15, schedule: S.idler('c_plaza', 'c_house1') },
  c_citizen2: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc2'), home: 'c_house2', gold: 15, schedule: S.idler({ x: 40, y: 20 }, 'c_house2') },
  c_citizen3: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc3'), home: 'c_house3', gold: 15, schedule: S.idler('c_plaza', 'c_house3'), relations: { c_citizen4: 'spouse' } },
  c_citizen4: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc4'), home: 'c_house4', gold: 15, schedule: S.idler({ x: 20, y: 20 }, 'c_house4'), relations: { c_citizen3: 'spouse' } },
  c_citizen5: { name: 'Dock Worker', map: 'city', faction: 'civilians', hp: 35, combat: 'fight', weapon: 'crowbar', look: G.look('cc5', { hat: 'cap', top: 'vest' }), home: 'c_house5', gold: 10, schedule: S.worker('c_harbor', 'c_house5', { workAct: 'wander' }) },
  c_citizen7: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc7'), home: 'c_house11', gold: 15, schedule: S.idler({ x: 92, y: 40 }, 'c_house11') },
  c_citizen8: { name: 'Civilian', map: 'city', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('cc8'), home: 'c_house12', gold: 15, schedule: S.idler('c_plaza', 'c_house12') },

  // ======================================================= CENTER — revolutionaries (secret)
  c_preacher: {
    name: 'Street Canvasser', map: 'city', faction: 'revolutionaries', hp: 30, combat: 'flee',
    look: REV_LOOK('preacher', { hat: 'beanie', hairStyle: 2, facial: 1, body: 'm', tote: true }), home: 'c_house6', gold: 10,
    dialogue: 'preacher', relations: { f_rev_leader: 'comrade' }, schedule: S.idler('c_plaza', 'c_house6', { end: 19 }),
    job: 'Got a minute for the revolution? Clipboard, petitions, the whole thing.',
  },

  // ======================================================= CENTER — Punks (abandoned warehouse)
  c_punk_boss: {
    name: 'Punk Leader', map: 'city', faction: 'punks', leader: true, streetName: true, hp: 70, combat: 'fight', weapon: 'baseball_bat',
    look: PUNK_LOOK('punkboss', { body: 'f', hairStyle: 4, hair: '#40d0a0' }), home: 'c_warehouse', shop: 'c_punk', gold: 80,
    relations: { c_punk1: 'comrade', c_punk2: 'comrade' }, schedule: S.street('c_warehouse_door', 'c_punk_turf', 'c_warehouse_bed'),
  },
  c_punk1: {
    name: 'Punk', map: 'city', faction: 'punks', streetName: true, hp: 40, combat: 'fight', weapon: 'brass_knuckles',
    look: PUNK_LOOK('punk1', { body: 'm', hair: '#e04040', hairStyle: 5 }), home: 'c_warehouse', gold: 15, relations: { c_punk_boss: 'comrade' },
    schedule: S.street('c_warehouse_door', 'c_punk_turf', 'c_warehouse_bed2'),
  },
  c_punk2: {
    name: 'Punk', map: 'city', faction: 'punks', streetName: true, hp: 40, combat: 'fight', weapon: 'switchblade',
    look: PUNK_LOOK('punk2', { body: 'f', hair: '#60a0ff', hairStyle: 4, bottom: 'skirt' }), home: 'c_warehouse', gold: 15, relations: { c_punk_boss: 'comrade' },
    schedule: S.street('c_warehouse_door', 'c_punk_turf', 'c_warehouse_bed3'),
  },

  // ======================================================= SOUTHSIDE — Red Gang
  c_red_boss: {
    name: 'Red Gang Boss', map: 'southside', faction: 'gang_red', leader: true, streetName: true, hp: 90, combat: 'fight', weapon: 'revolver', armor: 'leather_armor',
    look: GANG_LOOK('redboss', '#d04040', { body: 'm', facial: 1 }), home: 's_redhq', gold: 150, inv: [['gold_chain', 1]],
    relations: { c_red1: 'comrade', c_red2: 'comrade', c_red3: 'comrade', c_red4: 'comrade' }, schedule: S.street('s_redhq_door', 's_red_turf', 's_redhq_bed'),
  },
  c_red1: {
    name: 'Red Gang Member', map: 'southside', faction: 'gang_red', streetName: true, hp: 45, combat: 'fight', weapon: 'baseball_bat',
    look: GANG_LOOK('red1', '#d04040', { top: 'hoodie' }), home: 's_redhq', gold: 25, relations: { c_red_boss: 'comrade', c_red2: 'comrade' },
    schedule: S.street('s_court', 's_red_turf', 's_redhq_bed2'),
  },
  c_red2: {
    name: 'Red Gang Member', map: 'southside', faction: 'gang_red', streetName: true, hp: 45, combat: 'fight', weapon: 'switchblade',
    look: GANG_LOOK('red2', '#d04040', { top: 'vest' }), home: 's_redhq', gold: 25, relations: { c_red_boss: 'comrade', c_red1: 'comrade' },
    schedule: S.street('s_redhq_door', 's_red_turf', 's_redhq_bed3'),
  },
  c_red3: {
    name: 'Red Gang Member', map: 'southside', faction: 'gang_red', streetName: true, hp: 50, combat: 'fight', weapon: 'pistol',
    look: GANG_LOOK('red3', '#d04040', { top: 'jacket', body: 'f', hairStyle: 7 }), home: 's_apt5', gold: 30, relations: { c_red_boss: 'comrade', c_red4: 'comrade' },
    schedule: S.street('s_garage_work', 's_red_turf', 's_apt5_bed'),
  },
  c_red4: {
    name: 'Red Gang Member', map: 'southside', faction: 'gang_red', streetName: true, hp: 45, combat: 'fight', weapon: 'crowbar',
    look: GANG_LOOK('red4', '#d04040', { top: 'hoodie' }), home: 's_apt5', gold: 20, relations: { c_red3: 'comrade' },
    schedule: S.street('s_park', 's_red_turf', 's_apt5_bed2'),
  },
  s_pawnbroker: {
    name: 'Pawnbroker', map: 'southside', faction: 'civilians', hp: 40, combat: 'fight', weapon: 'shotgun',
    look: G.look('pawn', { body: 'm', top: 'vest', shirt: '#6a5a3a', facial: 3, glasses: 'round' }), home: 's_pawn', shop: 's_pawn', gold: 300,
    schedule: S.worker('s_pawn_work', 's_pawn', { start: 10, end: 21 }), job: 'I buy anything. I ask nothing. Good business.',
  },
  s_clerk: {
    name: 'Liquor Store Clerk', map: 'southside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('sclerk', { top: 'shirt' }),
    home: 's_liquor', shop: 's_liquor', gold: 150, schedule: S.worker('s_liquor_work', 's_liquor', { start: 9, end: 23, sleep: 23, wake: 7 }),
  },
  s_res1: { name: 'Resident', map: 'southside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('sr1'), home: 's_apt1', gold: 8, schedule: S.idler('s_court', 's_apt1') },
  s_res2: { name: 'Resident', map: 'southside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('sr2'), home: 's_apt2', gold: 8, schedule: S.idler('s_park', 's_apt2') },
  s_res3: { name: 'Resident', map: 'southside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('sr3'), home: 's_house1', gold: 8, schedule: S.idler('s_park', 's_house1'), relations: { s_res4: 'spouse' } },
  s_res4: { name: 'Resident', map: 'southside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('sr4'), home: 's_house1', gold: 8, schedule: S.idler('s_liquor_door', 's_house1', { bed: 's_house1_bed2' }), relations: { s_res3: 'spouse' } },

  // ======================================================= EASTSIDE — Blue Gang
  c_blue_boss: {
    name: 'Blue Gang Boss', map: 'eastside', faction: 'gang_blue', leader: true, streetName: true, hp: 90, combat: 'fight', weapon: 'pistol', armor: 'leather_armor',
    look: GANG_LOOK('blueboss', '#4070d8', { body: 'f', hairStyle: 7 }), home: 'e_bluehq', gold: 150, inv: [['gold_chain', 1]],
    relations: { c_blue1: 'comrade', c_blue2: 'comrade', c_blue3: 'comrade', c_blue4: 'comrade' }, schedule: S.street('e_bluehq_door', 'x_blue_turf', 'e_bluehq_bed'),
  },
  c_blue1: {
    name: 'Blue Gang Member', map: 'eastside', faction: 'gang_blue', streetName: true, hp: 45, combat: 'fight', weapon: 'crowbar',
    look: GANG_LOOK('blue1', '#4070d8', { top: 'hoodie' }), home: 'e_bluehq', gold: 25, relations: { c_blue_boss: 'comrade', c_blue2: 'comrade' },
    schedule: S.street('x_docks', 'x_blue_turf', 'e_bluehq_bed2'),
  },
  c_blue2: {
    name: 'Blue Gang Member', map: 'eastside', faction: 'gang_blue', streetName: true, hp: 45, combat: 'fight', weapon: 'switchblade',
    look: GANG_LOOK('blue2', '#4070d8', { top: 'vest' }), home: 'e_bluehq', gold: 25, relations: { c_blue_boss: 'comrade', c_blue1: 'comrade' },
    schedule: S.street('e_bluehq_door', 'x_blue_turf', 'e_bluehq_bed3'),
  },
  c_blue3: {
    name: 'Blue Gang Member', map: 'eastside', faction: 'gang_blue', streetName: true, hp: 50, combat: 'fight', weapon: 'smg',
    look: GANG_LOOK('blue3', '#4070d8', { top: 'jacket', body: 'm', facial: 2 }), home: 'x_apt3', gold: 30, relations: { c_blue_boss: 'comrade', c_blue4: 'comrade' },
    schedule: S.street('x_court', 'x_blue_turf', 'x_apt3_bed'),
  },
  c_blue4: {
    name: 'Blue Gang Member', map: 'eastside', faction: 'gang_blue', streetName: true, hp: 45, combat: 'fight', weapon: 'baseball_bat',
    look: GANG_LOOK('blue4', '#4070d8', { top: 'hoodie', body: 'f', hairStyle: 6 }), home: 'x_apt3', gold: 20, relations: { c_blue3: 'comrade' },
    schedule: S.street('x_ware1_work', 'x_blue_turf', 'x_apt3_bed2'),
  },
  x_clerk: {
    name: 'Bodega Owner', map: 'eastside', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('xclerk', { body: 'm', apron: '#e8e4dc', facial: 1 }),
    home: 'x_bodega', shop: 'x_bodega', gold: 150, schedule: S.worker('x_bodega_work', 'x_bodega', { start: 7, end: 23 }),
  },
  x_res1: { name: 'Resident', map: 'eastside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('xr1'), home: 'x_apt1', gold: 8, schedule: S.idler('x_court', 'x_apt1') },
  x_res2: { name: 'Resident', map: 'eastside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('xr2'), home: 'x_apt2', gold: 8, schedule: S.idler('x_bodega_door', 'x_apt2') },
  x_res3: { name: 'Dock Worker', map: 'eastside', faction: 'civilians', hp: 35, combat: 'fight', weapon: 'crowbar', look: G.look('xr3', { hat: 'cap', top: 'vest' }), home: 'x_laundry', gold: 12, schedule: S.worker('x_docks', 'x_laundry', { workAct: 'wander' }) },
  x_res4: { name: 'Resident', map: 'eastside', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('xr4'), home: 'x_house1', gold: 8, schedule: S.idler('x_court', 'x_house1') },

  // ======================================================= SUBURBS
  u_clerk: {
    name: 'Mini-Mart Clerk', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('uclerk', { top: 'shirt', shirt: '#3a8a4a', hat: 'cap', hatColor: '#3a8a4a' }),
    home: 'u_house11', shop: 'u_store', gold: 150, schedule: S.worker('u_store_work', 'u_house11', { start: 7, end: 22 }),
  },
  u_cop: {
    name: 'Patrol Officer', map: 'suburbs', faction: 'government', hp: 70, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest',
    look: COP_LOOK('ucop'), home: 'u_house12', gold: 20, schedule: S.guard('u_patrol', 'u_house12_bed'), job: 'Quiet neighborhood. I like to keep it that way.',
  },
  u_res1: { name: 'Teacher', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur1', { glasses: 'round' }), home: 'u_house1', gold: 30, schedule: S.worker('u_school_work', 'u_house1', { start: 8, end: 15 }), relations: { u_res2: 'spouse' } },
  u_res2: { name: 'Suburban Resident', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur2'), home: 'u_house1', gold: 30, schedule: S.idler('u_park', 'u_house1', { bed: 'u_house1_bed2' }), relations: { u_res1: 'spouse' } },
  u_res3: { name: 'Suburban Resident', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur3'), home: 'u_house3', gold: 30, schedule: S.idler('u_park', 'u_house3') },
  u_res4: { name: 'Jogger', map: 'suburbs', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('ur4', { top: 'shirt', bottom: 'shorts' }), home: 'u_house4', gold: 10, schedule: [{ from: 6, to: 9, at: 'u_patrol', act: 'patrol' }, { from: 9, to: 22, at: 'u_house4_door', act: 'wander' }, { from: 22, to: 6, at: 'u_house4_bed', act: 'sleep' }] },
  u_res5: { name: 'Suburban Resident', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur5'), home: 'u_house9', gold: 30, schedule: S.idler('u_house9_door', 'u_house9'), relations: { u_res6: 'spouse' } },
  u_res6: { name: 'Suburban Resident', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur6'), home: 'u_house9', gold: 30, schedule: S.idler('u_park', 'u_house9', { bed: 'u_house9_bed2' }), relations: { u_res5: 'spouse' } },
  u_res7: { name: 'Retiree', map: 'suburbs', faction: 'civilians', hp: 20, combat: 'flee', look: G.look('ur7', { hair: '#c8c8c8' }), home: 'u_house14', gold: 50, schedule: S.idler('u_park', 'u_house14', { end: 19 }) },
  u_res8: { name: 'Teenager', map: 'suburbs', faction: 'civilians', kid: 'teen', hp: 25, combat: 'flee', look: G.look('ur8', { top: 'hoodie' }), home: 'u_house17', gold: 5, schedule: S.idler('u_court', 'u_house17', { end: 22 }) },
  u_res9: { name: 'Suburban Resident', map: 'suburbs', faction: 'civilians', hp: 25, combat: 'flee', look: G.look('ur9'), home: 'u_house20', gold: 30, schedule: S.idler('u_store_door', 'u_house20') },
  u_res10: { name: 'Handyman', map: 'suburbs', faction: 'civilians', hp: 40, combat: 'fight', weapon: 'woodaxe', look: G.look('ur10', { top: 'vest', hat: 'cap', facial: 2, body: 'm' }), home: 'u_house22', gold: 25, schedule: S.idler('u_house6_door', 'u_house22') },

  // ======================================================= RICH DISTRICT — the Elite (secret cult, placeholders)
  h_host: {
    name: 'Philanthropist', map: 'heights', faction: 'elite', leader: true, hp: 40, combat: 'flee',
    look: SUIT_LOOK('host', { body: 'm', shirt: '#2a1a2a', shirt2: '#c8a050', hair: '#c8c8c8', facial: 1, glasses: null }),
    home: 'h_mansion1', gold: 600, inv: [['designer_watch', 1]], relations: { h_elite1: 'comrade', h_elite2: 'comrade', h_elite3: 'comrade' },
    schedule: ELITE('h_mansion1', 'h_lounge'), job: 'I give back to the community. Generously.',
  },
  h_elite1: {
    name: 'Investor', map: 'heights', faction: 'elite', hp: 30, combat: 'flee', look: SUIT_LOOK('elite1', { body: 'm', shirt: '#22242a', glasses: null }),
    home: 'h_mansion2', gold: 400, inv: [['jewelry', 1]], relations: { h_host: 'comrade' }, schedule: ELITE('h_mansion2', 'h_jeweler_door'),
    job: 'Real estate, mostly. I own half of Eastside, though they do not know it.',
  },
  h_elite2: {
    name: 'Heiress', map: 'heights', faction: 'elite', hp: 25, combat: 'flee', look: G.look('elite2', { body: 'f', top: 'dress', shirt: '#e8e4dc', hairStyle: 6, hair: '#d8c070', glasses: 'sun' }),
    home: 'h_mansion3', gold: 500, inv: [['jewelry', 2]], relations: { h_host: 'comrade', h_elite3: 'friend' }, schedule: ELITE('h_mansion3', 'h_garden'),
    job: 'Work? How quaint.',
  },
  h_elite3: {
    name: 'Socialite', map: 'heights', faction: 'elite', hp: 25, combat: 'flee', look: G.look('elite3', { body: 'f', top: 'dress', shirt: '#6a1a3a', hairStyle: 3, hair: '#1a1a22' }),
    home: 'h_mansion4', gold: 400, inv: [['gold_chain', 1]], relations: { h_host: 'comrade', h_elite2: 'friend' }, schedule: ELITE('h_mansion4', 'h_lounge'),
  },
  h_sec1: { name: 'Private Security', map: 'heights', faction: 'elite', hp: 80, combat: 'fight', weapon: 'pistol', armor: 'kevlar_vest', look: SECURITY_LOOK('hs1'), home: 'h_gate', gold: 30, schedule: S.post('h_gate_post', 'h_gate_bed') },
  h_sec2: { name: 'Private Security', map: 'heights', faction: 'elite', hp: 80, combat: 'fight', weapon: 'pistol', armor: 'kevlar_vest', look: SECURITY_LOOK('hs2'), home: 'h_gate', gold: 30, schedule: S.guard('h_boulevard', 'h_gate_bed2') },
  h_sec3: { name: 'Private Security', map: 'heights', faction: 'elite', hp: 80, combat: 'fight', weapon: 'smg', armor: 'kevlar_vest', look: SECURITY_LOOK('hs3'), home: 'h_gate', gold: 30, schedule: S.post('h_club_door', 'h_gate_bed3', true) },
  // ---- street dealers (dealer: true → "What are you selling?", and they take orders by text) ----
  c_dealer: { name: 'Street Dealer', map: 'city', faction: 'criminals', dealer: 'street', streetName: true, hp: 40, combat: 'fight', weapon: 'switchblade', look: G.look('cdeal', { top: 'hoodie', shirt: '#2a2a30', hat: 'cap', hatColor: '#1a1a1e' }), home: 'c_house8', gold: 80,
    schedule: [{ from: 11, to: 4, at: 'c_punk_turf', act: 'patrol' }, { from: 4, to: 11, at: 'c_house8_in', act: 'sleep' }] },
  h_plug: { name: 'Well-Dressed Man', map: 'heights', faction: 'criminals', dealer: 'rich', streetName: true, hp: 40, combat: 'flee', look: SUIT_LOOK('plug', { shirt: '#3a2a4a' }), home: 'h_staff', gold: 300,
    schedule: [{ from: 19, to: 3, at: 'h_lounge', act: 'wander' }, { from: 3, to: 12, at: 'h_staff_in', act: 'sleep' }, { from: 12, to: 19, at: 'h_garden', act: 'wander' }] },
  // ---- drug addicts (addictKind: 'addict' → hooked on heroin or crack; beg, steal, sometimes rob)
  c_addict1: { name: 'Drug Addict', map: 'city', faction: 'civilians', addictKind: 'addict', hp: 22, combat: 'flee', look: G.look('caddict', { top: 'hoodie', shirt: '#4a4440', pants: '#3a3630', facial: 3 }), home: 'c_house7', gold: 2, schedule: S.idler('c_punk_turf', 'c_house7', { end: 23, bed: 'c_house7_in' }) },
  s_addict1: { name: 'Drug Addict', map: 'southside', faction: 'civilians', addictKind: 'addict', hp: 22, combat: 'flee', look: G.look('saddict', { top: 'shirt', shirt: '#6a5a4a', body: 'f', hair: '#8a7a5a' }), home: 's_apt1', gold: 1, schedule: S.idler('s_park', 's_apt1', { end: 23, bed: 's_apt1_in' }) },
  x_addict1: { name: 'Drug Addict', map: 'eastside', faction: 'civilians', addictKind: 'addict', hp: 22, combat: 'flee', look: G.look('xaddict', { top: 'jacket', shirt: '#3a3a3a', facial: 1 }), home: 'x_apt1', gold: 3, schedule: S.idler('x_docks', 'x_apt1', { end: 23, bed: 'x_apt1_in' }) },
  // ---- firefighters (Fire Station, the Suburbs; they answer fires all over the city) ----
  u_fire1: { name: 'Firefighter', map: 'suburbs', faction: 'government', hp: 60, combat: 'flee', look: G.look('fire1', { body: 'm', top: 'jacket', shirt: '#b8862a', shirt2: '#e8e040', pants: '#2e2e34', hat: 'helmet', hatColor: '#c82a2a' }), home: 'u_firestation', gold: 30,
    schedule: [{ from: 7, to: 22, at: 'u_firestation_work', act: 'idle' }, { from: 22, to: 7, at: 'u_firestation_bed', act: 'sleep' }] },
  u_fire2: { name: 'Firefighter', map: 'suburbs', faction: 'government', hp: 60, combat: 'flee', look: G.look('fire2', { body: 'f', top: 'jacket', shirt: '#b8862a', shirt2: '#e8e040', pants: '#2e2e34', hat: 'helmet', hatColor: '#c82a2a' }), home: 'u_firestation', gold: 30,
    schedule: [{ from: 7, to: 22, at: 'u_firestation_door', act: 'wander' }, { from: 22, to: 7, at: 'u_firestation_bed2', act: 'sleep' }] },
  u_fire3: { name: 'Fire Captain', map: 'suburbs', faction: 'government', hp: 70, combat: 'flee', look: G.look('fire3', { body: 'm', top: 'jacket', shirt: '#b8862a', shirt2: '#e8e040', pants: '#2e2e34', hat: 'helmet', hatColor: '#f0f0f0', facial: 2 }), home: 'u_firestation', gold: 40,
    schedule: [{ from: 19, to: 8, at: 'u_firestation_work', act: 'idle' }, { from: 8, to: 19, at: 'u_firestation_bed3', act: 'sleep' }] },
  // ---- kids (kid: 'kid' | 'teen'). They cannot be hurt, and adult interactions never apply to them ----
  u_kid1: { name: 'Kid', map: 'suburbs', faction: 'civilians', kid: 'kid', hp: 20, combat: 'flee', look: G.look('ukid1', { top: 'shirt', bottom: 'shorts' }), home: 'u_house1', gold: 3,
    schedule: [{ from: 7, to: 8, at: 'u_house1_in', act: 'idle' }, { from: 8, to: 15, at: 'u_school_center', act: 'idle' }, { from: 15, to: 19, at: 'u_park', act: 'wander' }, { from: 19, to: 21, at: 'u_house1_in', act: 'idle' }, { from: 21, to: 7, at: 'u_house1_bed3', act: 'sleep' }] },
  u_kid2: { name: 'Kid', map: 'suburbs', faction: 'civilians', kid: 'kid', hp: 20, combat: 'flee', look: G.look('ukid2', { top: 'hoodie', bottom: 'shorts' }), home: 'u_house3', gold: 2,
    schedule: [{ from: 7, to: 8, at: 'u_house3_in', act: 'idle' }, { from: 8, to: 15, at: 'u_school_center', act: 'idle' }, { from: 15, to: 19, at: 'u_court', act: 'wander' }, { from: 19, to: 21, at: 'u_house3_in', act: 'idle' }, { from: 21, to: 7, at: 'u_house3_bed2', act: 'sleep' }] },
  u_teen1: { name: 'Teenager', map: 'suburbs', faction: 'civilians', kid: 'teen', hp: 25, combat: 'flee', look: G.look('uteen1', { top: 'hoodie', hat: 'cap', hatColor: '#3a6ad8' }), home: 'u_house9', gold: 10,
    schedule: [{ from: 7, to: 8, at: 'u_house9_in', act: 'idle' }, { from: 8, to: 15, at: 'u_school_center', act: 'idle' }, { from: 15, to: 22, at: 'u_court', act: 'wander' }, { from: 22, to: 7, at: 'u_house9_bed3', act: 'sleep' }] },
  u_teen2: { name: 'Teenager', map: 'suburbs', faction: 'civilians', kid: 'teen', hp: 25, combat: 'flee', look: G.look('uteen2', { top: 'jacket', body: 'f' }), home: 'u_house20', gold: 12,
    schedule: [{ from: 7, to: 8, at: 'u_house20_in', act: 'idle' }, { from: 8, to: 15, at: 'u_school_center', act: 'idle' }, { from: 15, to: 22, at: 'u_store_door', act: 'wander' }, { from: 22, to: 7, at: 'u_house20_bed2', act: 'sleep' }] },
  // the casino (open 16:00-04:00): a blackjack dealer, a roulette croupier, the cashier and a guard
  h_dealer: { name: 'Blackjack Dealer', map: 'heights', faction: 'civilians', hp: 25, combat: 'flee', look: SUIT_LOOK('dealer', { shirt: '#f0f0f0', shirt2: '#1a1a1e', top: 'vest' }), home: 'h_casino', gold: 40,
    schedule: [{ from: 16, to: 4, at: 'h_casino_bj', act: 'work' }, { from: 4, to: 12, at: 'h_casino_bed', act: 'sleep' }, { from: 12, to: 16, at: 'h_casino_in', act: 'idle' }] },
  h_croupier: { name: 'Croupier', map: 'heights', faction: 'civilians', hp: 25, combat: 'flee', look: SUIT_LOOK('croupier', { body: 'f', shirt: '#f0f0f0', shirt2: '#1a1a1e', top: 'vest', hairStyle: 6 }), home: 'h_casino', gold: 40,
    schedule: [{ from: 16, to: 4, at: 'h_casino_roulette', act: 'work' }, { from: 4, to: 12, at: 'h_casino_bed2', act: 'sleep' }, { from: 12, to: 16, at: 'h_casino_in', act: 'idle' }] },
  h_cashier: { name: 'Casino Cashier', map: 'heights', faction: 'civilians', hp: 25, combat: 'flee', look: SUIT_LOOK('cashier', { shirt: '#a83a3a' }), home: 'h_casino', shop: 'h_casino', gold: 400,
    schedule: [{ from: 15, to: 4, at: 'h_casino_work', act: 'work' }, { from: 4, to: 12, at: 'h_casino_bed3', act: 'sleep' }, { from: 12, to: 15, at: 'h_casino_in', act: 'idle' }],
    job: 'Chips, drinks and hotel rooms. The house always wins, sweetheart.' },
  h_casino_sec: { name: 'Casino Security', map: 'heights', faction: 'elite', hp: 80, combat: 'fight', weapon: 'pistol', armor: 'kevlar_vest', look: SECURITY_LOOK('cs1'), home: 'h_casino', gold: 30,
    schedule: [{ from: 15, to: 5, at: 'h_casino_guard', act: 'work' }, { from: 5, to: 15, at: 'h_casino_bed4', act: 'sleep' }] },
  h_jeweler: {
    name: 'Jeweler', map: 'heights', faction: 'civilians', hp: 25, combat: 'flee', look: SUIT_LOOK('jeweler', { body: 'f', shirt: '#3a2a4a', glasses: 'round', hairStyle: 3 }),
    home: 'h_jeweler', shop: 'h_jeweler', gold: 600, schedule: S.worker('h_jeweler_work', 'h_jeweler', { start: 10, end: 19 }),
    job: 'Fine jewelry and watches. Browsing is free. Touching is not.',
  },
  h_butler: {
    name: 'Butler', map: 'heights', faction: 'civilians', hp: 30, combat: 'flee', look: SUIT_LOOK('butler', { body: 'm', shirt: '#1e1e22', glasses: null, hair: '#8a8a8a' }),
    home: 'h_staff', gold: 40, schedule: S.worker('h_club_work', 'h_staff', { start: 7, end: 22 }), job: 'I serve the club. Discreetly.',
  },
  h_gardener: {
    name: 'Gardener', map: 'heights', faction: 'civilians', hp: 30, combat: 'flee', look: G.look('gardener', { hat: 'straw', top: 'shirt', shirt: '#5a7a3a' }),
    home: 'h_staff', gold: 15, schedule: S.worker('h_garden', 'h_staff', { start: 6, end: 17, workAct: 'wander', bed: 'h_staff_bed2' }),
  },

  // ======================================================= FOREST
  f_hunter: {
    name: 'Hunter', map: 'forest', faction: 'hunters', hp: 60, combat: 'fight', weapon: 'hunting_rifle', armor: 'leather_armor',
    look: G.look('hunter', { hat: 'cap', hatColor: '#d8782a', shirt: '#5a6a3a', top: 'vest', shirt2: '#d8782a' }), home: 'f_lodge', shop: 'f_lodge', gold: 150,
    relations: { f_tracker: 'friend' }, schedule: S.worker('f_lodge_work', 'f_lodge', { start: 7, end: 19 }),
    job: 'I hunt, I trade pelts. Do not overhunt this forest or there will be nothing left.',
  },
  f_tracker: {
    name: 'Tracker', map: 'forest', faction: 'hunters', hp: 55, combat: 'fight', weapon: 'hunting_knife', armor: 'leather_armor',
    look: G.look('tracker', { hat: 'cap', hatColor: '#4a5a3a', top: 'jacket', shirt: '#4a5a3a' }), home: 'f_lodge', gold: 30, relations: { f_hunter: 'friend' },
    schedule: [{ from: 6, to: 20, at: 'f_patrol', act: 'patrol' }, { from: 20, to: 6, at: 'f_tracker_bed', act: 'sleep' }],
  },
  f_hermit: {
    name: 'Hermit', map: 'forest', faction: 'hunters', hp: 30, combat: 'flee', look: G.look('hermit', { body: 'm', top: 'robe', hat: 'hood', hatColor: '#6a5a4a', facial: 1, hair: '#c8c8c8' }),
    home: 'f_hermit', shop: 'f_hermit', dialogue: 'hermit', gold: 60, schedule: S.worker('f_hermit_work', 'f_hermit', { start: 6, end: 20 }),
    job: 'I gather herbs and keep to myself.',
  },
  f_woodcutter: {
    name: 'Woodcutter', map: 'forest', faction: 'hunters', hp: 45, combat: 'fight', weapon: 'woodaxe',
    look: G.look('woodcutter', { body: 'm', shirt: '#8a3a3a', facial: 1, top: 'shirt' }), home: 'f_cabin', gold: 25, inv: [['wood', 4]],
    schedule: S.worker('f_wood_work', 'f_cabin', { start: 7, end: 18 }),
  },
  f_bandit_boss: {
    name: 'Outlaw Leader', map: 'forest', faction: 'bandits', hp: 90, combat: 'fight', weapon: 'shotgun', armor: 'leather_armor',
    look: G.look('banditboss', { body: 'm', top: 'jacket', shirt: '#1e1a1a', shirt2: '#5a2a2a', hat: 'bandana', hatColor: '#2a1a1a', facial: 3, glasses: 'sun' }),
    dialogue: 'bandit_boss', gold: 120, inv: [['first_aid_kit', 1]],
    relations: { f_bandit1: 'comrade', f_bandit2: 'comrade', f_bandit3: 'comrade' },
    schedule: S.camp('f_camp_fire', 'f_boss_bed'),
  },
  f_bandit1: { name: 'Outlaw', map: 'forest', faction: 'bandits', hp: 40, combat: 'fight', weapon: 'combat_knife', look: BANDIT_LOOK('b1'), gold: 20, dialogue: 'bandit', schedule: S.camp('f_camp', 'f_bed1'), relations: { f_bandit_boss: 'comrade' } },
  f_bandit2: { name: 'Outlaw', map: 'forest', faction: 'bandits', hp: 40, combat: 'fight', weapon: 'baseball_bat', look: BANDIT_LOOK('b2'), gold: 20, dialogue: 'bandit', schedule: S.camp('f_camp', 'f_bed2'), relations: { f_bandit_boss: 'comrade' } },
  f_bandit3: { name: 'Outlaw', map: 'forest', faction: 'bandits', hp: 40, combat: 'fight', weapon: 'machete', look: BANDIT_LOOK('b3'), gold: 20, dialogue: 'bandit', schedule: S.camp('f_camp', 'f_bed3'), relations: { f_bandit_boss: 'comrade' } },

  // ======================================================= FOREST — the revolutionaries' hidden meeting place (ruins)
  f_rev_leader: {
    name: 'The Organizer', map: 'forest', faction: 'revolutionaries', leader: true, hp: 80, combat: 'fight', weapon: 'assault_rifle',
    look: REV_LOOK('revleader', { body: 'f', hat: 'beanie', hatColor: '#c8506a', hair: '#e070b0', glasses: 'round', tote: false }), gold: 90, dialogue: 'rev_leader',
    relations: { f_rev1: 'comrade', f_rev2: 'comrade', c_preacher: 'comrade', r_villager3: 'comrade' },
    schedule: [{ from: 8, to: 20, at: 'f_ruins', act: 'wander' }, { from: 20, to: 2, at: 'f_ruins_altar', act: 'work' }, { from: 2, to: 8, at: 'f_rev_bed1', act: 'sleep' }],
  },
  f_rev1: {
    name: 'Armed Activist', map: 'forest', faction: 'revolutionaries', hp: 45, combat: 'fight', weapon: 'shotgun',
    look: REV_LOOK('rev1'), gold: 15, relations: { f_rev_leader: 'comrade', f_rev2: 'comrade' },
    schedule: [{ from: 8, to: 20, at: 'f_ruins', act: 'wander' }, { from: 20, to: 2, at: 'f_ruins', act: 'wander' }, { from: 2, to: 8, at: 'f_rev_bed2', act: 'sleep' }],
  },
  f_rev2: {
    name: 'Armed Activist', map: 'forest', faction: 'revolutionaries', hp: 45, combat: 'fight', weapon: 'smg',
    look: REV_LOOK('rev2'), gold: 15, relations: { f_rev_leader: 'comrade', f_rev1: 'comrade' },
    schedule: [{ from: 8, to: 20, at: 'f_patrol', act: 'patrol' }, { from: 20, to: 2, at: 'f_ruins', act: 'wander' }, { from: 2, to: 8, at: 'f_rev_bed3', act: 'sleep' }],
  },


  // ======================================================= COUNTY JAIL
  j_warden: {
    name: 'Warden', map: 'jail', faction: 'government', hp: 70, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest',
    look: SUIT_LOOK('warden', { body: 'm', shirt: '#3a3a2a', glasses: null, facial: 1, hair: '#8a8a8a' }), home: 'j_office', inv: [['keycard', 1]], gold: 120,
    schedule: [{ from: 7, to: 19, at: 'j_office_work', act: 'work' }, { from: 19, to: 7, at: 'j_office_bed', act: 'sleep' }], dialogue: 'jailguard',
    job: 'I run this facility. Behave and you will walk out of here on time.',
  },
  j_guard1: { name: 'Corrections Officer', map: 'jail', faction: 'government', hp: 80, combat: 'guard', weapon: 'police_baton', armor: 'kevlar_vest', look: COP_LOOK('jg1', { shirt: '#4a4a3a' }), gold: 20, dialogue: 'jailguard', schedule: S.always('j_gate_post', 'work') },
  j_guard2: { name: 'Corrections Officer', map: 'jail', faction: 'government', hp: 80, combat: 'guard', weapon: 'police_baton', armor: 'kevlar_vest', look: COP_LOOK('jg2', { shirt: '#4a4a3a' }), gold: 20, dialogue: 'jailguard', schedule: [{ from: 6, to: 22, at: 'j_patrol', act: 'patrol' }, { from: 22, to: 6, at: 'j_block_patrol', act: 'patrol' }] },
  j_guard3: { name: 'Corrections Officer', map: 'jail', faction: 'government', hp: 80, combat: 'guard', weapon: 'pistol', armor: 'kevlar_vest', look: COP_LOOK('jg3', { shirt: '#4a4a3a' }), gold: 20, dialogue: 'jailguard', schedule: [{ from: 22, to: 6, at: 'j_patrol', act: 'patrol' }, { from: 6, to: 22, at: 'j_block_patrol', act: 'patrol' }] },
  j_boss: {
    name: 'Inmate', map: 'jail', faction: 'prisoners', leader: true, streetName: true, hp: 90, combat: 'fight', look: INMATE_LOOK('jboss', { facial: 3, body: 'm' }), gold: 30, dialogue: 'inmate_boss',
    schedule: INMATE(0), job: 'I run the yard. Everybody in here owes me something.', relations: { j_inmate1: 'comrade', j_inmate2: 'comrade' },
  },
  j_inmate1: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 50, combat: 'fight', look: INMATE_LOOK('ji1'), gold: 5, schedule: INMATE(1), relations: { j_boss: 'comrade' } },
  j_inmate2: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 50, combat: 'fight', look: INMATE_LOOK('ji2', { body: 'm' }), gold: 5, schedule: INMATE(2), relations: { j_boss: 'comrade' } },
  j_inmate3: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 45, combat: 'fight', look: INMATE_LOOK('ji3'), gold: 5, schedule: INMATE(4, true) },
  j_inmate4: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 40, combat: 'flee', look: INMATE_LOOK('ji4'), gold: 5, schedule: INMATE(5) },
  j_inmate5: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 45, combat: 'fight', look: INMATE_LOOK('ji5'), gold: 5, schedule: INMATE(6, true), relations: { j_inmate4: 'friend' } },
  j_inmate6: { name: 'Inmate', map: 'jail', faction: 'prisoners', streetName: true, hp: 40, combat: 'flee', look: INMATE_LOOK('ji6'), gold: 5, schedule: INMATE(7), relations: { j_inmate5: 'friend' } },
  // ======================================================= ISLAND (epilogue only — placeholders)
  i_leader: {
    name: 'Island Leader', map: 'island', faction: 'islanders', hp: 160, combat: 'fight', weapon: 'assault_rifle', armor: 'plate_armor',
    look: G.look('ileader', { top: 'robe', hat: 'cowl', shirt: '#2a1a1e', pants: '#1a1214', cape: '#5a1418' }),
    home: 'i_fortress', dialogue: 'island_leader', gold: 300, schedule: S.always('i_fortress_work'),
  },
  i_follower1: { name: 'Island Follower', map: 'island', faction: 'islanders', hp: 60, combat: 'fight', weapon: 'pistol', look: G.look('if1', { top: 'robe', hat: 'cowl', shirt: '#2a1a1e' }), dialogue: 'island_follower', gold: 30, schedule: S.always('i_yard', 'patrol') },
  i_follower2: { name: 'Island Follower', map: 'island', faction: 'islanders', hp: 60, combat: 'fight', weapon: 'machete', look: G.look('if2', { top: 'robe', hat: 'cowl', shirt: '#2a1a1e' }), dialogue: 'island_follower', gold: 30, schedule: S.always('i_yard', 'patrol') },
  i_follower3: { name: 'Island Follower', map: 'island', faction: 'islanders', hp: 60, combat: 'fight', weapon: 'shotgun', look: G.look('if3', { top: 'robe', hat: 'cowl', shirt: '#2a1a1e' }), dialogue: 'island_follower', gold: 30, schedule: S.always('i_fortress_in', 'wander') },
};

for (const id in G.NPCS) {
  const d = G.NPCS[id];
  d.id = id;
  d.relations = d.relations || {};
  d.gender = d.look.body === 'f' ? 'female' : 'male';
}

// Temporary NPCs that appear at night in dangerous zones (see maps: dangerZones). Not saved; gone by morning.
//   mugger: approaches and demands money instead of attacking straight away
G.NIGHT_SPAWNS = {
  mugger: { name: 'Mugger', faction: 'criminals', hp: 35, combat: 'fight', weapon: 'switchblade', mugger: true, gold: [5, 25],
    look: (s) => G.look(s, { top: 'hoodie', shirt: '#2a2a30', pants: '#2a2a30', hat: 'hood', hatColor: '#1e1e22' }) },
  thug: { name: 'Thug', faction: 'criminals', hp: 50, combat: 'fight', weapon: 'baseball_bat', mugger: true, gold: [5, 30],
    look: (s) => G.look(s, { body: 'm', top: 'vest', shirt: '#3a3030', shirt2: '#5a4a3a', facial: 3, hairStyle: 2 }) },
  gang_red: { name: 'Red Gang Member', faction: 'gang_red', hp: 45, combat: 'fight', weapon: 'baseball_bat', streetName: true, gold: [10, 30],
    look: (s) => GANG_LOOK(s, '#d04040', { top: 'hoodie' }) },
  gang_blue: { name: 'Blue Gang Member', faction: 'gang_blue', hp: 45, combat: 'fight', weapon: 'switchblade', streetName: true, gold: [10, 30],
    look: (s) => GANG_LOOK(s, '#4070d8', { top: 'hoodie' }) },
  punk: { name: 'Punk', faction: 'punks', hp: 40, combat: 'fight', weapon: 'brass_knuckles', streetName: true, gold: [2, 15],
    look: (s) => PUNK_LOOK(s, { hair: ['#e04040', '#40d0a0', '#d0d040', '#60a0ff'][G.util.hashString(String(s)) % 4] }) },
};
