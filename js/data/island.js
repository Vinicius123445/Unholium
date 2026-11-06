'use strict';
// The Island: where the Elite meet, far from anyone's eyes. Reached by the boat at the city harbor.
//   Only high-ranking Elite and their cultists live here, in extravagant robes, capes and masks.
//   Structures: the Grand Temple (altar, sacrificial slab, pews, braziers, a pentagram on the floor), the
//   Council Hall (a round table where the leader and the inner circle sit), the Holding (cells with
//   captives behind bars), villas for the leader and the councilors, a dormitory for the cultists, the
//   obelisk with the eye on the plaza and a stone ritual circle. Ritual events happen on their own
//   schedule (js/game/happenings.js); you only see them if you are here when they do.
// Names, titles and words are placeholders until the lore is written.
(() => {
const A = G.assets, MB = G.MB;

// ---------------------------------------------------------------- props
const ART = {
  altar: [32, 20, (x) => { x.fillStyle = '#2a0a10'; x.fillRect(0, 6, 32, 14); x.fillStyle = '#5a1018'; x.fillRect(1, 4, 30, 4); x.fillStyle = '#d8b040'; x.fillRect(0, 4, 32, 1); x.fillRect(14, 8, 4, 10); x.fillRect(11, 11, 10, 3); x.fillStyle = '#1a0608'; x.fillRect(2, 17, 28, 3); }],
  slab: [32, 14, (x) => { x.fillStyle = '#5a5654'; x.fillRect(0, 4, 32, 10); x.fillStyle = '#7a7672'; x.fillRect(1, 3, 30, 3); x.fillStyle = '#6a0a10'; x.fillRect(8, 4, 12, 2); x.fillRect(20, 6, 4, 6); x.fillRect(12, 6, 3, 2); x.fillStyle = '#3a3634'; x.fillRect(2, 12, 28, 2); }],
  candles: [10, 14, (x) => { for (const [cx, h] of [[1, 8], [4, 11], [7, 6]]) { x.fillStyle = '#ece4d0'; x.fillRect(cx, 14 - h, 2, h); x.fillStyle = '#ffd060'; x.fillRect(cx, 12 - h, 2, 2); x.fillStyle = '#ff8a20'; x.fillRect(cx, 13 - h, 2, 1); } }],
  brazier: [14, 20, (x) => { x.fillStyle = '#2a2420'; x.fillRect(6, 8, 2, 12); x.fillRect(3, 18, 8, 2); x.fillStyle = '#4a3a2a'; x.fillRect(1, 6, 12, 4); x.fillStyle = '#ff8a20'; x.fillRect(3, 2, 8, 4); x.fillStyle = '#ffd060'; x.fillRect(5, 0, 4, 3); }],
  hooded_statue: [16, 34, (x) => { x.fillStyle = '#4a4648'; x.fillRect(3, 6, 10, 26); x.fillRect(5, 0, 6, 8); x.fillStyle = '#1a1618'; x.fillRect(6, 3, 4, 4); x.fillStyle = '#5a5658'; x.fillRect(1, 30, 14, 4); x.fillStyle = '#3a3638'; x.fillRect(5, 12, 6, 2); }],
  obelisk: [24, 64, (x) => { x.fillStyle = '#2a2628'; x.fillRect(7, 6, 10, 52); x.fillStyle = '#3a3638'; x.fillRect(9, 6, 6, 52); x.fillStyle = '#2a2628'; x.fillRect(9, 0, 6, 6); x.fillRect(11, 0, 2, 2);
    x.fillStyle = '#d8b040'; x.fillRect(9, 16, 6, 4); x.fillStyle = '#f0e8c0'; x.fillRect(10, 17, 4, 2); x.fillStyle = '#1a0a0a'; x.fillRect(11, 17, 2, 2); x.fillStyle = '#4a4446'; x.fillRect(2, 56, 20, 8); x.fillStyle = '#5a5456'; x.fillRect(4, 54, 16, 3); }],
  standing_stone: [12, 28, (x) => { x.fillStyle = '#5a5856'; x.fillRect(2, 2, 8, 26); x.fillRect(3, 0, 6, 3); x.fillStyle = '#3a3836'; x.fillRect(2, 22, 8, 6); x.fillStyle = '#6a0a10'; x.fillRect(5, 10, 2, 4); }],
  throne: [18, 30, (x) => { x.fillStyle = '#5a0a14'; x.fillRect(3, 0, 12, 22); x.fillStyle = '#d8b040'; x.fillRect(2, 0, 14, 2); x.fillRect(2, 0, 2, 26); x.fillRect(14, 0, 2, 26); x.fillRect(8, 3, 2, 6); x.fillStyle = '#3a0610'; x.fillRect(4, 18, 10, 6); x.fillStyle = '#a88030'; x.fillRect(2, 26, 14, 4); }],
  round_table: [66, 38, (x) => { x.fillStyle = '#1a0e08'; x.beginPath(); x.ellipse(33, 22, 32, 15, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#4a2a14'; x.beginPath(); x.ellipse(33, 19, 31, 14, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#5a3418'; x.beginPath(); x.ellipse(33, 18, 26, 11, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#d8b040'; x.lineWidth = 1; x.beginPath(); x.ellipse(33, 18, 9, 4, 0, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#d8b040'; x.fillRect(31, 16, 4, 3); x.fillStyle = '#f0e8c0'; x.fillRect(32, 17, 2, 1); }],
  cell_bars: [16, 30, (x) => { x.fillStyle = '#2a2a2e'; x.fillRect(0, 0, 16, 2); x.fillRect(0, 26, 16, 2); for (let i = 1; i < 16; i += 3) { x.fillStyle = '#4a4a52'; x.fillRect(i, 0, 2, 28); x.fillStyle = '#6a6a74'; x.fillRect(i, 0, 1, 28); } }],
  pentagram: [56, 40, (x) => { x.strokeStyle = 'rgba(150,20,24,0.85)'; x.lineWidth = 2; x.beginPath(); x.ellipse(28, 20, 26, 18, 0, 0, Math.PI * 2); x.stroke();
    const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; pts.push([28 + Math.cos(a) * 24, 20 + Math.sin(a) * 16]); }
    x.beginPath(); x.moveTo(...pts[0]); for (let i = 1; i <= 5; i++) x.lineTo(...pts[i % 5]); x.stroke(); }],
  blood_pool: [20, 10, (x) => { x.fillStyle = 'rgba(110,8,12,0.85)'; x.beginPath(); x.ellipse(10, 5, 9, 4, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(150,20,24,0.8)'; x.beginPath(); x.ellipse(8, 4, 4, 2, 0, 0, Math.PI * 2); x.fill(); }],
  chains: [12, 18, (x) => { x.fillStyle = '#5a5a62'; for (let y = 0; y < 16; y += 3) { x.fillRect(3, y, 2, 2); x.fillRect(8, y + 1, 2, 2); } x.fillStyle = '#3a3a40'; x.fillRect(1, 15, 10, 3); }],
  gold_statue: [16, 30, (x) => { x.fillStyle = '#a88030'; x.fillRect(3, 26, 10, 4); x.fillStyle = '#d8b040'; x.fillRect(5, 6, 6, 20); x.fillRect(6, 0, 4, 6); x.fillRect(2, 8, 3, 8); x.fillRect(11, 8, 3, 8); x.fillStyle = '#f0e090'; x.fillRect(6, 2, 1, 3); x.fillRect(6, 8, 1, 16); }],
};
const art = () => { for (const id in ART) { const [w, h, fn] = ART[id]; const { c, x } = A.mk(w, h); fn(x); if (A.outline && !['pentagram', 'blood_pool'].includes(id)) A.outline(c); A.sprites['isl_' + id] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
const _init = A.init; A.init = function () { _init.call(this); art(); };
Object.assign(G.DECOR, {
  altar: { sprite: 'isl_altar', solid: true, fw: 2, interact: 'look' },
  slab: { sprite: 'isl_slab', solid: true, fw: 2, interact: 'look' },
  candles: { sprite: 'isl_candles', solid: true, light: { r: 30, color: '255,190,110' }, flicker: true },
  brazier: { sprite: 'isl_brazier', solid: true, light: { r: 60, color: '255,120,40' }, flicker: true },
  hooded_statue: { sprite: 'isl_hooded_statue', solid: true, interact: 'look' },
  obelisk: { sprite: 'isl_obelisk', solid: true, interact: 'look' },
  standing_stone: { sprite: 'isl_standing_stone', solid: true },
  throne: { sprite: 'isl_throne', solid: false, interact: 'sit' },
  round_table: { sprite: 'isl_round_table', solid: true, fw: 4, fh: 2, interact: 'look' },
  cell_bars: { sprite: 'isl_cell_bars', solid: true, interact: 'cell' },
  pentagram: { sprite: 'isl_pentagram', flat: true },
  blood_pool: { sprite: 'isl_blood_pool', flat: true },
  chains: { sprite: 'isl_chains', solid: true },
  gold_statue: { sprite: 'isl_gold_statue', solid: true, interact: 'look' },
});

// ---------------------------------------------------------------- the map
G.MAPGEN.island = () => {
  const m = new G.TileMap('island', 110, 96, G.T.deepwater);
  m.meta = { name: 'The Island', region: 'island', music: 'island', darkness: 0.3 };
  const r = new G.RNG('island-map-v2');
  MB.ellipse(m, 55, 46, 55, 47, G.T.water);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const d = ((x - 55) / 53) ** 2 + ((y - 46) / 42) ** 2 + (MB.noise(x, y, 6, 4) - 0.5) * 0.1;
    if (d < 1) m.set(x, y, d < 0.9 ? (MB.noise(x, y, 4, 9) > 0.55 ? G.T.darkgrass : G.T.grass) : G.T.darksand);
  }
  // paths: the avenue from the dock to the temple, the cross street to the hall and the holding
  MB.vline(m, 54, 24, 86, G.T.darkstone, 3);
  MB.hline(m, 14, 96, 47, G.T.darkstone, 3);
  MB.hline(m, 17, 93, 77, G.T.darkstone, 2);
  m.fill(51, 85, 9, 9, G.T.dock);
  // the plaza: obelisk, stone circle and braziers
  MB.ellipse(m, 55, 52, 8, 6, G.T.plaza);
  m.addDecor('obelisk', 55, 52);
  m.addDecor('pentagram', 55, 54);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const x = Math.round(55 + Math.cos(a) * 7), y = Math.round(52 + Math.sin(a) * 5); if (i % 2) m.addDecor('standing_stone', x, y); else m.addDecor('brazier', x, y); }

  // the Grand Temple
  const temple = m.addBuilding('i_temple', 38, 6, 34, 20, { name: 'Grand Temple', wall: 'wall_dark', floor: 'darkstone', roof: 'dark', kind: 'temple', chimney: false });
  m.fill(39, 7, 32, 8, G.T.carpet);
  m.addDecor('altar', 54, 8); m.addDecor('slab', 54, 11); m.addDecor('blood_pool', 55, 12);
  for (const [x, y] of [[50, 8], [60, 8], [48, 10], [62, 10], [50, 12], [60, 12]]) m.addDecor('candles', x, y);
  m.addDecor('hooded_statue', 43, 8); m.addDecor('hooded_statue', 67, 8); m.addDecor('gold_statue', 46, 8); m.addDecor('gold_statue', 64, 8);
  m.addDecor('brazier', 47, 13); m.addDecor('brazier', 63, 13);
  m.addDecor('banner', 40, 8); m.addDecor('banner', 70, 8);
  for (const y of [16, 18, 20, 22]) for (const x of [42, 45, 48, 59, 62, 65]) m.addDecor('pew', x, y);
  m.addDecor('pentagram', 55, 15);
  m.points.i_altar = { x: 55, y: 10 };
  m.points.i_victim = { x: 54, y: 12 };
  m.points.i_temple_work = { x: 55, y: 14 };
  m.points.i_congregation = [{ x: 52, y: 14 }, { x: 58, y: 14 }, { x: 51, y: 16 }, { x: 57, y: 16 }, { x: 53, y: 18 }, { x: 58, y: 18 }, { x: 52, y: 20 }, { x: 57, y: 20 }, { x: 54, y: 22 }, { x: 56, y: 23 }];

  // the Council Hall
  const hall = m.addBuilding('i_council', 6, 30, 24, 15, { name: 'Council Hall', wall: 'wall_marble', floor: 'carpet', roof: 'slate', kind: 'temple', chimney: false });
  m.addDecor('round_table', 16, 37);
  const seats = [[16, 35], [17, 35], [19, 35], [15, 36], [15, 37], [20, 36], [20, 37], [16, 38], [17, 38], [18, 38], [19, 38]];
  m.addDecor('throne', 18, 35);
  seats.forEach(([x, y], i) => { m.addDecor('chair', x, y); m.points['i_seat' + i] = { x, y }; });
  m.points.i_council_head = { x: 18, y: 35 };
  m.addDecor('banner', 8, 32); m.addDecor('banner', 27, 32); m.addDecor('gold_statue', 8, 42); m.addDecor('gold_statue', 27, 42);
  for (const [x, y] of [[11, 32], [24, 32]]) m.addDecor('floorlamp', x, y);
  m.points.i_council_work = { x: 18, y: 41 };

  // the Holding: five cells behind bars, a corridor and a guard desk
  const hold = m.addBuilding('i_holding', 80, 30, 24, 15, { name: 'The Holding', wall: 'wall_dark', floor: 'stonefloor', roof: 'dark', kind: 'house', chimney: false });
  for (let k = 0; k < 5; k++) {
    const x0 = 81 + k * 4;
    for (let y = 31; y <= 37; y++) m.set(x0 + 3, y, G.T.wall_dark);
    for (let x = x0; x < x0 + 3; x++) m.addDecor('cell_bars', x, 37);
    m.points['i_cell' + k] = { x: x0 + 1, y: 33 };
    m.points['i_cell' + k + 'b'] = { x: x0, y: 35 };
    m.addDecor('chains', x0 + 2, 31);
    if (k % 2) m.addDecor('blood_pool', x0 + 1, 35);
  }
  m.addDecor('desk', 100, 40); m.addDecor('chair', 101, 41);
  m.points.i_holding_guard = { x: 101, y: 42 };
  m.points.i_holding_walk = [{ x: 84, y: 40 }, { x: 92, y: 41 }, { x: 99, y: 39 }];

  // villas
  const villas = [['i_villa1', 8, 54, 18, 12, "The Leader's Villa"], ['i_villa2', 24, 64, 16, 11, 'Villa'], ['i_villa3', 70, 64, 16, 11, 'Villa'], ['i_villa4', 84, 54, 18, 12, 'Villa']];
  for (const [id, x, y, w, h, name] of villas) {
    const b = m.addBuilding(id, x, y, w, h, { name, wall: 'wall_marble', floor: 'carpet', roof: id === 'i_villa1' ? 'dark' : 'slate', kind: 'mansion' });
    MB.furnish(m, b, 'mansion', r, { owner: id === 'i_villa1' ? 'i_leader' : null, loot: [['jewelry', 2], ['gem', 1], ['designer_watch', 1], ['wine', 2]] });
  }
  // the dormitory
  const dorm = m.addBuilding('i_dorm', 60, 76, 16, 8, { name: 'Dormitory', wall: 'wall_dark', floor: 'woodfloor', roof: 'dark', kind: 'house' });
  for (let k = 0; k < 6; k++) { const x = 61 + k * 2 + (k > 2 ? 1 : 0); m.addDecor('bed_red', x, 77); m.points['i_dorm_bed' + k] = { x, y: 77 }; }
  m.addDecor('table', 63, 80); m.addDecor('table', 70, 80); m.addDecor('candles', 61, 82); m.addDecor('candles', 74, 82);
  m.points.i_dorm_work = { x: 67, y: 81 };
  // guardhouse at the dock
  const gh = m.addBuilding('i_guardhouse', 44, 78, 8, 6, { name: 'Guardhouse', wall: 'wall_dark', floor: 'concrete', roof: 'dark', kind: 'house' });
  m.addDecor('desk', 46, 79); m.points.i_dock_post = { x: 57, y: 84 };
  m.points.i_patrol = [{ x: 54, y: 30 }, { x: 30, y: 47 }, { x: 80, y: 47 }, { x: 54, y: 62 }, { x: 54, y: 80 }, { x: 93, y: 72 }, { x: 17, y: 72 }];
  m.points.i_garden = [{ x: 36, y: 52 }, { x: 74, y: 52 }, { x: 30, y: 58 }, { x: 80, y: 58 }, { x: 46, y: 50 }, { x: 64, y: 50 }];
  m.points.i_circle = [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 49, y: 53 }, { x: 61, y: 53 }, { x: 52, y: 56 }, { x: 58, y: 56 }, { x: 55, y: 57 }, { x: 52, y: 48 }, { x: 58, y: 48 }];
  m.points.i_circle_center = { x: 55, y: 55 };

  m.addDecor('boat', 55, 93);
  m.points.i_ferry = { x: 55, y: 91 };
  m.points.from_city = { x: 55, y: 88 };
  // manicured grounds: hedges, statues and lamps
  for (let y = 28; y <= 82; y += 6) { if (y > 44 && y < 60) continue; m.addDecor('darklamp', 52, y); m.addDecor('darklamp', 58, y); }
  MB.scatter(m, r, ['bush', 'bush', 'oak0', 'pine0', 'statue', 'deadtree'], 70, 4, 4, 106, 90, [G.T.grass, G.T.darkgrass], 2);
  MB.scatter(m, r, ['flowers', 'tuft'], 80, 4, 4, 106, 90, [G.T.grass, G.T.darkgrass]);
  m.finalize();
  return m;
};

// ---------------------------------------------------------------- the people
const ROBE = (seed, o) => G.look(seed, Object.assign({ top: 'robe', bottom: 'pants', pants: '#140a0c', shoes: '#0a0808' }, o));
const VILLA = (home, day) => [
  { from: 23.5, to: 9, at: home + '_bed', act: 'sleep' },
  { from: 9, to: 12, at: home + '_work', act: 'wander' },
  { from: 12, to: 18, at: day, act: 'wander' },
  { from: 18, to: 23.5, at: home + '_work', act: 'wander' },
];
const CULT = (bed) => [
  { from: 23, to: 7, at: bed, act: 'sleep' },
  { from: 7, to: 9, at: 'i_dorm_work', act: 'wander' },
  { from: 9, to: 13, at: 'i_temple_work', act: 'wander' },
  { from: 13, to: 18, at: 'i_garden', act: 'wander' },
  { from: 18, to: 23, at: 'i_temple_work', act: 'wander' },
];
const C = 'elite';
const NEW = {
  i_leader: { name: 'Cult Leader', map: 'island', faction: C, leader: true, hp: 160, combat: 'fight', weapon: 'pistol', armor: 'kevlar_vest', home: 'i_villa1', gold: 900, dialogue: 'island_leader',
    look: ROBE('ileader2', { body: 'm', shirt: '#4a0612', shirt2: '#d8b040', cape: '#d8b040', hat: 'crown', mask: 'gold', glasses: null }), inv: [['designer_watch', 1], ['jewelry', 2], ['gem', 2]],
    schedule: [{ from: 0, to: 9, at: 'i_villa1_bed', act: 'sleep' }, { from: 9, to: 13, at: 'i_villa1_work', act: 'wander' }, { from: 13, to: 17, at: 'i_temple_work', act: 'idle' }, { from: 17, to: 24, at: 'i_villa1_work', act: 'wander' }] },
  i_council1: { name: 'High Councilor', map: 'island', faction: C, hp: 60, combat: 'flee', home: 'i_villa2', gold: 600, look: ROBE('ic1', { body: 'm', top: 'jacket', shirt: '#1a1a2a', shirt2: '#d8b040', cape: '#5a0a3a', hat: 'tophat', mask: 'white' }), inv: [['jewelry', 1]], schedule: VILLA('i_villa2', 'i_garden') },
  i_council2: { name: 'High Councilor', map: 'island', faction: C, hp: 55, combat: 'flee', home: 'i_villa2', gold: 600, look: G.look('ic2', { body: 'f', top: 'dress', shirt: '#6a0a2a', cape: '#2a0a1a', hairStyle: 6, hair: '#d8c070', mask: 'silver' }), inv: [['jewelry', 2]], schedule: VILLA('i_villa2', 'i_garden') },
  i_council3: { name: 'High Councilor', map: 'island', faction: C, hp: 60, combat: 'flee', home: 'i_villa3', gold: 650, look: ROBE('ic3', { body: 'm', shirt: '#1a3a2a', shirt2: '#d8b040', cape: '#0a2a1a', mask: 'black', maskBeak: true }), inv: [['gem', 1]], schedule: VILLA('i_villa3', 'i_circle') },
  i_council4: { name: 'High Councilor', map: 'island', faction: C, hp: 55, combat: 'flee', home: 'i_villa3', gold: 650, look: G.look('ic4', { body: 'f', top: 'dress', shirt: '#2a1a4a', cape: '#d8b040', hairStyle: 3, hair: '#1a1a22', mask: 'gold' }), inv: [['jewelry', 2]], schedule: VILLA('i_villa3', 'i_garden') },
  i_council5: { name: 'High Councilor', map: 'island', faction: C, hp: 60, combat: 'flee', home: 'i_villa4', gold: 700, look: ROBE('ic5', { body: 'm', shirt: '#e8e4dc', shirt2: '#d8b040', cape: '#6a0a10', hat: 'tophat', hatColor: '#e8e4dc', mask: 'red' }), inv: [['designer_watch', 1]], schedule: VILLA('i_villa4', 'i_circle') },
  i_council6: { name: 'High Councilor', map: 'island', faction: C, hp: 55, combat: 'flee', home: 'i_villa4', gold: 700, look: G.look('ic6', { body: 'f', top: 'dress', shirt: '#0a0a0e', cape: '#4a0612', hairStyle: 8, hair: '#e8e4dc', mask: 'white', glasses: null }), inv: [['gem', 1]], schedule: VILLA('i_villa4', 'i_garden') },
  i_guard1: { name: 'Elite Guard', map: 'island', faction: C, hp: 100, combat: 'fight', weapon: 'assault_rifle', armor: 'kevlar_vest', home: 'i_guardhouse', gold: 40, look: G.look('ig1', { body: 'm', top: 'jacket', shirt: '#0a0a0e', shirt2: '#0a0a0e', pants: '#0a0a0e', mask: 'black', hairStyle: 0 }), schedule: [{ from: 0, to: 24, at: 'i_dock_post', act: 'idle' }] },
  i_guard2: { name: 'Elite Guard', map: 'island', faction: C, hp: 100, combat: 'fight', weapon: 'smg', armor: 'kevlar_vest', home: 'i_guardhouse', gold: 40, look: G.look('ig2', { body: 'm', top: 'jacket', shirt: '#0a0a0e', shirt2: '#0a0a0e', pants: '#0a0a0e', mask: 'black', hairStyle: 0 }), schedule: [{ from: 0, to: 24, at: 'i_patrol', act: 'patrol' }] },
  i_guard3: { name: 'Elite Guard', map: 'island', faction: C, hp: 100, combat: 'fight', weapon: 'shotgun', armor: 'kevlar_vest', home: 'i_holding', gold: 40, look: G.look('ig3', { body: 'f', top: 'jacket', shirt: '#0a0a0e', shirt2: '#0a0a0e', pants: '#0a0a0e', mask: 'black', hairStyle: 1 }), schedule: [{ from: 0, to: 24, at: 'i_holding_walk', act: 'patrol' }] },
  i_guard4: { name: 'Elite Guard', map: 'island', faction: C, hp: 100, combat: 'fight', weapon: 'assault_rifle', armor: 'kevlar_vest', home: 'i_temple', gold: 40, look: G.look('ig4', { body: 'm', top: 'jacket', shirt: '#0a0a0e', shirt2: '#0a0a0e', pants: '#0a0a0e', mask: 'black', hairStyle: 0 }), schedule: [{ from: 0, to: 24, at: 'i_temple_work', act: 'idle' }] },
};
for (let k = 0; k < 6; k++) NEW['i_cultist' + (k + 1)] = { name: 'Cultist', map: 'island', faction: C, hp: 50, combat: k % 2 ? 'fight' : 'flee', weapon: k % 2 ? 'machete' : null, home: 'i_dorm', gold: 60,
  look: ROBE('icult' + k, { shirt: ['#5a0612', '#3a0a1a', '#4a0a10'][k % 3], hat: 'hood', hatColor: ['#5a0612', '#3a0a1a', '#4a0a10'][k % 3], mask: k % 3 === 2 ? 'gold' : 'white' }), schedule: CULT('i_dorm_bed' + k) };
for (let k = 0; k < 6; k++) NEW['i_captive' + (k + 1)] = { name: 'Captive', map: 'island', faction: 'captives', hp: 25, combat: 'flee', home: 'i_holding', gold: 0, dialogue: 'island_captive', captive: true,
  look: G.look('icap' + k, { naked: true }), schedule: [{ from: 0, to: 24, at: k === 5 ? 'i_cell2b' : 'i_cell' + k, act: 'idle' }] };
G.FACTIONS.captives = { name: 'Captives', startRep: 0 };
for (const id of Object.keys(G.NPCS)) if (/^i_(leader|follower)/.test(id)) delete G.NPCS[id];
for (const id in NEW) { const d = NEW[id]; d.id = id; d.relations = d.relations || {}; d.gender = d.look.body === 'f' ? 'female' : 'male'; G.NPCS[id] = d; }
for (const id in NEW) if (/^i_(council|cultist|guard)/.test(id)) NEW[id].relations.i_leader = 'comrade';
NEW.i_leader.relations = Object.fromEntries(Object.keys(NEW).filter((k) => /^i_council/.test(k)).map((k) => [k, 'comrade']));

// ---------------------------------------------------------------- talk (placeholders)
G.DIALOGUES.island_leader = {
  start: { common: true, text: '[Placeholder] You are not one of us. And yet the boat brought you here. Curious.', choices: [{ text: 'Who are you people?', next: 'who' }, { text: 'Goodbye.', next: null }] },
  who: { text: '[Placeholder] We are the ones who decide. That is all you need to know.', choices: [{ text: 'Goodbye.', next: null }] },
};
G.DIALOGUES.island_captive = {
  start: { text: '[Placeholder] Please... please get me out of here. They are going to kill me.', choices: [{ text: 'I will find a way to open the cell.', next: null }, { text: 'Goodbye.', next: null }] },
};
G.DIALOGUES.island_follower = { start: { text: '[Placeholder] You should not be here.', choices: [{ text: 'Goodbye.', next: null }] } };
})();
