'use strict';
// Rooms that belong to someone. js/data/interiors.js lays a home out and js/game/rooms.js gives a workplace its trade;
// this pass puts the people in: who lives here decides the bedding, what is on the walls and what is left lying around.
// A pensioner's flat, a family house, a dealer's room and a Heights townhouse are not the same room with other curtains.
//   G.homelife.profile(m, b)  who lives here, from the people on file (nothing is invented about them)
//   The police station gets a real plan: a public counter, the squad room behind it, bunks and a holding cell at the back.
//   Household furniture can be smashed. What is left stays where it fell: it goes through G.mods like everything else
//   that happens to the map, so it is still there next week and after a reload. A shot that hits furniture hurts it the
//   same way; a shot that hits a wall leaves its hole there (a mark, G.marks, the newest few per map).
(() => {
const V = G.vk, R = G.roomsPass, T = G.T, hash = G.signArt.hash;
const steel = '#6e7278', dark = '#2e3034', wood = '#54402e', woodL = '#6e5840', paper = '#b4ae9e', dirt = '#4a4438';
const bedDef = () => { const d = Object.assign({}, G.DECOR.bed); delete d.sprite; return d; };
const bed = (id, cover, fold, stain) => V.add(id, 16, 24, (r, x) => {
  r(0, 0, 16, 5, wood); r(0, 0, 16, 1, woodL); r(1, 4, 14, 18, '#3a3a3a'); r(2, 5, 12, 5, '#a8a294'); r(2, 5, 12, 1, '#c0baa8'); r(3, 9, 10, 1, '#7e7a6e');
  r(1, 10, 14, 12, cover); r(1, 10, 14, 1.4, fold); for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(2 + i * 3.4, 12 + (i % 2) * 3, 2.4, 7 - (i % 3) * 2); }
  if (stain) { x.fillStyle = stain; x.beginPath(); x.ellipse(10, 16, 3.4, 2.2, 0.3, 0, 6.3); x.fill(); } r(0, 21.5, 16, 2.5, wood);
}, bedDef());
bed('bed_grey', '#4e5054', '#6a6c70'); bed('bed_brown', '#5a4a38', '#74624c'); bed('bed_quilt', '#5c5448', '#7a7264', null); bed('bed_navy', '#30384a', '#485064');
bed('bed_stained', '#6a6658', '#827e6e', 'rgba(70,56,30,0.4)'); bed('bed_white', '#a8a498', '#c4c0b2'); bed('bed_kid', '#4a5a54', '#62726a');
// lying on the floor
const floor = { solid: false, flat: true };
V.add('stain_damp', 24, 16, (r, x) => { x.fillStyle = 'rgba(30,26,20,0.3)'; x.beginPath(); x.ellipse(12, 8, 11, 6.4, 0.2, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(60,50,30,0.4)'; x.lineWidth = 0.6; x.stroke(); }, floor);
V.add('stain_coffee', 16, 12, (r, x) => { x.fillStyle = 'rgba(52,34,18,0.42)'; x.beginPath(); x.ellipse(8, 6, 6, 3.8, 0, 0, 6.3); x.fill(); r(11, 3, 2, 1.6, 'rgba(52,34,18,0.42)'); }, floor);
V.add('rug_worn', 32, 22, (r) => { r(0, 0, 32, 22, '#4c4238'); r(1.5, 1.5, 29, 19, '#5e5244'); r(4, 4, 24, 14, '#4a3e34'); for (let i = 0; i < 9; i++) r(2 + i * 3.4, 0, 1, 1.4, '#7a7060'); r(9, 8, 12, 5, 'rgba(120,110,90,0.18)'); }, Object.assign({ fw: 2 }, floor));
V.add('doormat', 16, 8, (r) => { r(0, 0, 16, 8, '#3e3a30'); for (let y = 1; y < 8; y += 2) r(1, y, 14, 0.8, '#524c40'); }, floor);
V.add('newspapers', 16, 10, (r) => { r(1, 2, 12, 7, '#9a958a'); r(3, 1, 12, 7, paper); r(4, 2, 5, 3, '#6a6660'); for (let i = 0; i < 3; i++) r(10, 2.4 + i * 1.5, 4, 0.6, '#6a6660'); }, floor);
V.add('butts', 14, 8, (r) => { for (const [a, b] of [[2, 3], [5, 5], [8, 2], [10, 5], [4, 1], [12, 3]]) { r(a, b, 2.4, 0.9, '#c0b8a0'); r(a + 1.8, b, 0.8, 0.9, '#a08860'); } }, floor);
V.add('crumbs', 14, 8, (r) => { for (let i = 0; i < 12; i++) r((i * 37) % 13, (i * 23) % 7, 1, 0.8, i % 2 ? '#6a5a44' : '#4e4434'); }, floor);
const lying = { solid: false };
V.add('clothes_pile', 18, 11, (r, x) => { x.fillStyle = '#3e4048'; x.beginPath(); x.ellipse(9, 7, 8.4, 3.8, 0, 0, 6.3); x.fill(); x.fillStyle = '#5a5044'; x.beginPath(); x.ellipse(6, 6, 4.6, 2.4, 0.4, 0, 6.3); x.fill(); x.fillStyle = '#6e6a60'; x.beginPath(); x.ellipse(12, 5, 3.6, 2, -0.3, 0, 6.3); x.fill(); r(8, 3, 1, 3, '#2e3038'); }, lying);
V.add('bottles', 16, 12, (r) => { for (const [a, h, c] of [[2, 8, '#3e4a30'], [6, 9, '#4a3a22'], [10, 7, '#6a6a60']]) { r(a, 11 - h, 2.6, h, c); r(a + 0.6, 9 - h, 1.4, 2.4, c); r(a + 0.4, 11 - h + 1, 0.7, h - 3, 'rgba(255,255,255,0.14)'); } r(12, 9.4, 3.8, 1.8, '#4a3a22'); }, lying);
V.add('pizza_boxes', 18, 9, (r) => { r(0, 5, 18, 4, '#8a7a5e'); r(1, 2.6, 16, 3, '#9a8a6c'); r(2, 0.4, 14, 3, '#a89878'); r(5, 1, 7, 1.4, '#6a3a2a'); r(1, 8, 16, 0.6, '#6a5c44'); }, lying);
V.add('toys', 16, 10, (r, x) => { r(1, 5, 5, 4, '#7a4a3a'); r(1, 5, 5, 1, '#94604c'); x.fillStyle = '#4e6474'; x.beginPath(); x.arc(10, 6.4, 3, 0, 6.3); x.fill(); r(10, 2, 4, 2.4, '#8a8050'); r(6, 8, 3, 1, '#5a6a4a'); }, lying);
V.add('shoes', 14, 7, (r) => { for (const a of [0, 7]) { r(a, 3, 6, 3, '#2e2a26'); r(a, 2, 3, 2, '#3e3a34'); r(a, 5.6, 6, 1, '#141210'); } }, lying);
V.add('book_stack', 12, 11, (r) => { for (let i = 0; i < 4; i++) r(1 + (i % 2), 8 - i * 2.2, 9, 2, ['#4a3a2e', '#3a4438', '#5e5240', '#34384a'][i]); }, lying);
V.add('wet_bucket', 12, 13, (r) => { r(1.4, 3, 9, 9.4, '#5e6268'); r(1, 2, 10, 1.6, '#7e8288'); r(2.4, 2.4, 7, 1.2, '#2e3a40'); r(9, 0, 1, 9, wood); }, lying);
// standing about
V.add('box_stack', 16, 24, (r) => { for (const [a, b, w, h] of [[0, 12, 16, 12], [1, 2, 13, 10]]) { r(a, b, w, h, '#7a6a50'); r(a, b, w, 1, '#94846a'); r(a + w / 2 - 1, b, 2, h, '#94846a'); r(a + 1.4, b + h - 4, 4, 2.4, '#b0a890'); } });
V.add('laundry', 14, 13, (r) => { r(1, 4, 12, 9, '#7a7264'); for (let i = 0; i < 5; i++) r(2 + i * 2.2, 5, 1, 7.4, '#5e584c'); r(0, 3, 14, 1.6, '#94887a'); r(2, 0.6, 10, 3, '#4e5660'); r(5, 0, 5, 2, '#6a5e50'); });
V.add('radio', 14, 16, (r) => { r(1, 8, 12, 8, wood); r(1, 8, 12, 1, woodL); r(2, 0, 10, 8, '#3e3a30'); r(3, 1, 5, 6, '#2a2822'); for (let y = 1.4; y < 7; y += 1.4) r(3, y, 5, 0.5, '#54504a'); r(9, 1.6, 2, 2, '#8a8270'); r(9, 4.6, 2, 2, '#8a8270'); });
V.add('coat_rack', 12, 28, (r) => { r(5, 2, 2, 24, wood); r(2, 25.6, 8, 2.4, dark); r(1, 3, 10, 1, wood); r(0, 4, 5, 13, '#3e4048'); r(0, 4, 5, 1, '#54565e'); r(7, 4, 4, 9, '#5a4a38'); });
V.add('water_heater', 14, 28, (r) => { r(1, 3, 12, 24, '#8a8a84'); r(1, 3, 3, 24, '#a2a29c'); r(10, 3, 3, 24, '#6e6e6a'); r(6, 0, 2, 4, '#7a5a3a'); r(4, 18, 6, 5, '#54544e'); r(5, 19, 2, 1.4, '#a04a30'); r(1, 26, 12, 2, dark); r(2, 11, 9, 0.6, '#5e4a30'); });
V.add('ironing', 28, 16, (r) => { r(0, 5, 26, 3, '#7e8084'); r(0, 4, 26, 1.4, '#94969a'); r(4, 8, 1.2, 8, steel); r(20, 8, 1.2, 8, steel); r(16, 2, 7, 3, '#5a5e64'); r(17, 1, 4, 1, dark); }, { fw: 2 });
V.add('fan', 12, 24, (r, x) => { r(5, 10, 2, 12, steel); r(2, 22, 8, 2, dark); x.strokeStyle = '#7e8288'; x.lineWidth = 1; x.beginPath(); x.arc(6, 6, 5.4, 0, 6.3); x.stroke(); r(5, 1, 2, 10, '#5a5e64'); r(1, 5, 10, 2, '#5a5e64'); });
V.add('trunk', 24, 13, (r) => { r(0, 3, 24, 10, '#4a3a2a'); r(0, 3, 24, 1.4, '#62503a'); for (const a of [3, 18]) r(a, 3, 2.4, 10, '#2e2a26'); r(10, 6, 4, 3, '#8a7a50'); }, { fw: 2 });
V.add('wine_rack', 16, 26, (r) => { r(0, 0, 16, 26, wood); for (let y = 0; y < 4; y++) for (let a = 0; a < 3; a++) { r(1.4 + a * 4.6, 2 + y * 5.8, 4, 4.6, '#241a12'); r(2.6 + a * 4.6, 3 + y * 5.8, 1.8, 2.8, ['#3a4430', '#4a2a26', '#2a2a22'][(a + y) % 3]); } });
V.add('jars', 30, 26, (r) => { r(0, 0, 30, 26, '#4a3a2a'); for (const y of [8, 16, 24]) r(0, y, 30, 1.4, '#2a2018'); for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) { r(1.5 + i * 4.8, 3 + s * 8, 3.6, 5, ['#8a7a4a', '#6a4a3a', '#5a6a44'][(i + s) % 3]); r(1.8 + i * 4.8, 2.4 + s * 8, 3, 1, '#9a9a90'); } }, { fw: 2 });
V.add('tool_board', 30, 24, (r) => { r(0, 0, 30, 18, '#5a4a34'); r(0, 0, 30, 1, '#74624a'); r(3, 3, 1.4, 11, steel); r(2, 3, 3.4, 2.4, '#3e3a34'); r(9, 4, 5, 1.4, steel); r(13, 4, 1.4, 9, wood); r(19, 3, 2, 10, wood); r(18, 2, 4, 2.6, steel); r(25, 3, 1.4, 12, '#8a7a50'); }, { fw: 2, solid: false });
// on the walls: hung on the wall row, never in the way
const hung = { solid: false };
V.add('w_calendar', 12, 14, (r) => { r(0, 0, 12, 14, '#b4ae9e'); r(0, 0, 12, 3.4, '#6a3a30'); for (let y = 5; y < 13; y += 2) for (let x = 1; x < 11; x += 2) r(x, y, 1.2, 1, '#5e5a52'); }, hung);
V.add('w_photos', 26, 14, (r) => { for (const [a, b, w, h, c] of [[0, 1, 8, 11, '#4e4a42'], [10, 0, 7, 8, '#5e5244'], [19, 2, 7, 10, '#3e4438']]) { r(a, b, w, h, wood); r(a + 1, b + 1, w - 2, h - 2, c); r(a + w / 2 - 1, b + 3, 2, 2, '#9a9080'); r(a + w / 2 - 2, b + 5, 4, h - 7, '#2e2e2c'); } }, Object.assign({ fw: 2 }, hung));
V.add('w_clock', 12, 12, (r, x) => { x.fillStyle = '#2e2a26'; x.beginPath(); x.arc(6, 6, 6, 0, 6.3); x.fill(); x.fillStyle = '#b4ae9e'; x.beginPath(); x.arc(6, 6, 4.8, 0, 6.3); x.fill(); r(5.6, 2.4, 0.8, 3.8, dark); r(5.6, 5.6, 3, 0.8, dark); }, hung);
V.add('w_cross', 8, 14, (r) => { r(3, 0, 2, 14, wood); r(0, 3.4, 8, 2, wood); r(3.4, 0.4, 0.6, 13, woodL); }, hung);
V.add('w_poster', 14, 20, (r) => { r(0, 0, 14, 20, '#30323a'); r(1, 1, 12, 13, '#4a4038'); r(3, 3, 8, 9, '#6a4a3a'); r(2, 15, 10, 1.4, '#a8a294'); r(2, 17, 7, 1, '#7e7a70'); r(0, 0, 1.4, 1.4, '#a8a294'); r(12.6, 0, 1.4, 1.4, '#a8a294'); }, hung);
V.add('w_drawing', 14, 11, (r, x) => { r(0, 0, 14, 11, '#b4ae9e'); x.strokeStyle = '#6a4a3a'; x.lineWidth = 0.8; x.beginPath(); x.arc(4, 6, 2, 0, 6.3); x.moveTo(8, 9); x.lineTo(10, 3); x.lineTo(12, 9); x.stroke(); r(1, 9.4, 12, 0.8, '#4e6a4a'); }, hung);
V.add('w_mold', 24, 16, (r, x) => { for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(${28 + (i % 3) * 8},${34 + (i % 3) * 6},24,${0.2 + (i % 4) * 0.06})`; x.beginPath(); x.ellipse(4 + (i * 17) % 18, 3 + (i * 7) % 11, 2 + (i % 3), 1.4 + (i % 2), 0, 0, 6.3); x.fill(); } }, Object.assign({ fw: 2 }, hung));
V.add('w_crack', 16, 16, (r, x) => { x.strokeStyle = 'rgba(16,14,12,0.7)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(3, 0); x.lineTo(6, 5); x.lineTo(5, 9); x.lineTo(10, 12); x.lineTo(9, 16); x.moveTo(6, 5); x.lineTo(11, 4); x.stroke(); }, hung);
V.add('w_shelf', 26, 12, (r) => { r(0, 8, 26, 2, wood); r(0, 8, 26, 0.7, woodL); for (const [a, h, c] of [[2, 6, '#4a3a2e'], [5, 7, '#3a4438'], [8, 5, '#5e5240'], [16, 5, '#6a6a60'], [20, 6, '#8a7a5a']]) r(a, 8 - h, 2.6, h, c); }, Object.assign({ fw: 2 }, hung));
V.add('w_wanted', 44, 22, (r) => { r(0, 0, 44, 22, '#4a3a2a'); r(1.4, 1.4, 41, 19, '#6e5c44'); for (let i = 0; i < 5; i++) { const a = 3 + i * 8; r(a, 3 + (i % 2), 7, 9, paper); r(a + 2, 4.6 + (i % 2), 3, 3, '#3e3a34'); r(a + 1, 8.6 + (i % 2), 5, 0.6, '#5e5a52'); r(a + 1, 10 + (i % 2), 4, 0.6, '#5e5a52'); r(a + 3, 3 + (i % 2), 1, 1, '#8a3030'); } r(5, 14, 16, 5, paper); r(25, 14, 14, 5, '#a8a294'); for (let y = 15; y < 18.6; y += 1.2) r(6, y, 13, 0.5, '#5e5a52'); }, Object.assign({ fw: 3 }, hung));
V.add('w_notice', 30, 16, (r) => { r(0, 0, 30, 16, '#3e3a30'); r(1, 1, 28, 14, '#5a5244'); for (let i = 0; i < 4; i++) { r(3 + i * 6.4, 2.4 + (i % 2) * 2, 5, 7, paper); r(4 + i * 6.4, 3.6 + (i % 2) * 2, 3, 0.5, '#5e5a52'); } r(4, 12, 22, 0.8, '#2e2c28'); }, Object.assign({ fw: 2 }, hung));
// wreckage: what furniture is once it has been smashed
V.add('wreck_wood', 22, 12, (r) => { r(1, 8, 12, 2, '#4e3a28'); r(8, 4, 2, 7, '#5e4632'); r(13, 7, 8, 2, '#3e2e20'); r(4, 5, 6, 1.4, '#6a5038'); r(15, 3, 1.6, 6, '#54402e'); for (const [a, b] of [[2, 3], [18, 10], [11, 2]]) r(a, b, 2, 1, '#7a6048'); }, Object.assign({ fw: 1 }, lying));
V.add('wreck_soft', 26, 13, (r, x) => { x.fillStyle = '#4a4238'; x.beginPath(); x.ellipse(13, 8, 12, 4.4, 0, 0, 6.3); x.fill(); r(3, 6, 8, 3, '#5e5648'); r(14, 5, 9, 4, '#544c40'); for (const [a, b] of [[6, 4], [12, 3], [19, 3], [9, 11], [16, 11]]) r(a, b, 2, 1.2, '#a8a294'); r(21, 8, 3, 1, steel); }, Object.assign({ fw: 1 }, lying));
V.add('wreck_glass', 18, 11, (r) => { r(2, 8, 13, 1.6, '#2e3034'); r(5, 4, 8, 4, '#3a3e44'); for (const [a, b, c] of [[1, 5, '#8a9098'], [14, 4, '#a8b0b6'], [8, 9, '#7a8088'], [15, 9, '#9aa2a8'], [3, 9, '#a8b0b6']]) r(a, b, 2, 1, c); }, Object.assign({ fw: 1 }, lying));
V.add('wreck_metal', 20, 12, (r) => { r(2, 6, 14, 4, '#54565a'); r(3, 5, 9, 1.4, '#70747a'); r(13, 3, 2, 7, '#44484c'); r(6, 9.6, 12, 1, '#2e3034'); for (const [a, b] of [[1, 4], [17, 7], [8, 2]]) r(a, b, 2, 1, '#8a8e94'); }, Object.assign({ fw: 1 }, lying));

// what breaks, how hard it is, and what it leaves
const BREAK = { table: [14, 'wood'], chair: [7, 'wood'], stool: [6, 'wood'], shelf: [12, 'wood'], desk: [16, 'wood'], coffee_table: [10, 'wood'], nightstand: [8, 'wood'], wardrobe: [18, 'wood'], bookcase: [14, 'wood'], armchair: [12, 'soft'], couch: [16, 'soft'], tv: [5, 'glass'], mirror: [4, 'glass'], floorlamp: [5, 'glass'], lamp: [4, 'glass'], vending: [24, 'metal'], fridge: [24, 'metal'], stove: [24, 'metal'], washer: [20, 'metal'], v_radio: [5, 'wood'], v_fan: [5, 'metal'], v_laundry: [5, 'soft'] };
const breakable = () => { for (const k in BREAK) { const d = G.DECOR[k]; if (!d) continue; d.breakHp = d.breakHp || BREAK[k][0]; d.breakTo = d.breakTo || 'v_wreck_' + BREAK[k][1]; d.owned = true; } };
breakable();

const COL = { poor: ['v_bed_stained', 'v_bed_brown', 'v_bed_grey'], worker: ['v_bed_grey', 'v_bed_brown', 'v_bed_navy'], family: ['v_bed_quilt', 'v_bed_navy', 'v_bed_kid'], elderly: ['v_bed_quilt', 'v_bed_white'], rich: ['v_bed_white', 'v_bed_navy'], rural: ['v_bed_quilt', 'v_bed_brown'], gang: ['v_bed_stained', 'v_bed_grey'], addict: ['v_bed_stained'], cop: ['v_bed_navy', 'v_bed_grey'] };
// [solid pieces, things lying around, things on the walls]
const STUFF = {
  poor: [['box_stack', 'laundry', 'fan'], ['clothes_pile', 'bottles', 'butts', 'stain_damp', 'pizza_boxes'], ['w_mold', 'w_crack', 'w_calendar']],
  worker: [['coat_rack', 'laundry', 'radio', 'ironing'], ['shoes', 'newspapers', 'stain_coffee', 'doormat'], ['w_calendar', 'w_photos', 'w_clock']],
  family: [['coat_rack', 'laundry', 'ironing', 'box_stack'], ['toys', 'shoes', 'clothes_pile', 'doormat', 'crumbs'], ['w_drawing', 'w_photos', 'w_calendar', 'w_clock']],
  elderly: [['radio', 'trunk', 'coat_rack'], ['rug_worn', 'book_stack', 'doormat'], ['w_photos', 'w_cross', 'w_clock', 'w_shelf']],
  rich: [['wine_rack', 'v_x'], ['rug_worn', 'book_stack'], ['v_painting', 'w_shelf', 'w_clock']],
  rural: [['jars', 'tool_board', 'trunk', 'coat_rack'], ['shoes', 'wet_bucket', 'doormat', 'rug_worn'], ['w_calendar', 'w_cross', 'w_photos']],
  gang: [['box_stack', 'weapon_crate'], ['bottles', 'butts', 'pizza_boxes', 'clothes_pile', 'stain_damp'], ['w_poster', 'w_crack', 'v_graffiti2']],
  addict: [['box_stack'], ['clothes_pile', 'bottles', 'butts', 'stain_damp', 'pizza_boxes', 'crumbs'], ['w_mold', 'w_crack']],
  cop: [['coat_rack', 'radio', 'trunk'], ['shoes', 'newspapers', 'doormat'], ['w_calendar', 'w_photos', 'w_clock']],
};
const GANGS = /^(gang_|punks|criminals|bandits)/;
const HL = G.homelife = {
  // who lives here: read off the people on file
  residents(m, b) { return Object.keys(G.NPCS).filter((id) => { const d = G.NPCS[id]; return d.home === b.id && d.map === m.id; }); },
  profile(m, b) {
    const ids = this.residents(m, b), ds = ids.map((id) => G.NPCS[id]), district = m.meta.district || m.id;
    if (!ds.length) return /_home$/.test(b.id) ? null : (/south|east|industrial/.test(district) ? 'poor' : 'worker');
    if (ds.some((d) => d.addictKind)) return 'addict';
    if (ds.some((d) => GANGS.test(d.faction || ''))) return 'gang';
    if (ds.some((d) => d.combat === 'guard')) return 'cop';
    if (ds.some((d) => d.kid)) return 'family';
    if (ds.every((d) => d.ageGroup === 'elderly' || /Retiree/.test(d.name))) return 'elderly';
    if (m.id === 'heights' || b.kind === 'mansion') return 'rich';
    if (m.id === 'rural' || m.id === 'farmland') return 'rural';
    if (/south|east|industrial/.test(district)) return 'poor';
    return 'worker';
  },
  home(m, b) { return !b.venue && !b.playerBuilt && (b.planned === 'house' || b.planned === 'apartment' || b.planned === 'mansion' || (b.kind === 'house' && !!b.planned)) && !/_home$/.test(b.id) && b.id !== (G.world && G.world.flags && G.world.flags.player_home); },
  // bare floor a thing may lie on: never a doorway or a spot someone stands on
  free(m, b) {
    const pts = new Set(Object.values(m.points).filter((q) => q && !Array.isArray(q)).map((q) => q.x + ',' + q.y)), out = [];
    for (let y = b.y + 1; y <= b.y + b.h - 2; y++) for (let x = b.x + 1; x <= b.x + b.w - 2; x++) {
      if (m.isSolidTile(x, y) || m.decorsAt(x, y).length || pts.has(x + ',' + y) || (Math.abs(x - b.doorX) <= 1 && y >= b.doorY - 2)) continue;
      out.push({ x, y, edge: m.isSolidTile(x - 1, y) || m.isSolidTile(x + 1, y) || m.isSolidTile(x, y - 1) });
    }
    return out;
  },
  // wall tiles with floor in front of them, for things that hang
  walls(m, b) {
    const out = [];
    for (let y = b.y; y <= b.y + b.h - 3; y++) for (let x = b.x + 1; x <= b.x + b.w - 2; x++) { const d = m.tileDef(x, y); if (d && d.wall && !m.isSolidTile(x, y + 1) && !m.decorsAt(x, y).length) out.push({ x, y }); }
    return out;
  },
  hang(m, type, x, y) { const d = m.addDecor(type, x, y); d.y = (y + 1) * 16 - 1; return d; },
  beds(m, b, kind) {
    const list = COL[kind]; if (!list) return;
    const r = new G.RNG('beds' + b.id);
    for (const d of m.decor.filter((q) => /^bed(_red|_green)?$/.test(q.type) && m.buildingAtTile(q.tx, q.ty) === b)) { const x = d.tx, y = d.ty, t = r.pick(list); m.removeDecorRuntime(d, false); m.addDecor(t, x, y); }
  },
  dress(m, b, kind) {
    const S = STUFF[kind]; if (!S) return false;
    const r = new G.RNG('lived' + b.id), n = Math.max(2, Math.round(b.w * b.h / 22));
    this.beds(m, b, kind);
    R.fit(m, b, S[0].filter((t) => G.DECOR['v_' + t]).sort(() => r.next() - 0.5).slice(0, 1 + (b.w * b.h > 80 ? 1 : 0)), 2);
    const free = this.free(m, b).sort((p, q) => (q.edge - p.edge) || r.next() - 0.5), lie = S[1].slice().sort(() => r.next() - 0.5);
    for (let i = 0; i < Math.min(n, lie.length) && free.length; i++) {
      const t = 'v_' + lie[i], def = G.DECOR[t]; if (!def) continue;
      const k = free.findIndex((f) => !(def.fw > 1) || free.some((o) => o.x === f.x + 1 && o.y === f.y)); if (k < 0) continue;
      const s = free.splice(k, 1)[0]; m.addDecor(t, s.x, s.y);
    }
    const walls = this.walls(m, b).sort(() => r.next() - 0.5);
    for (const t0 of S[2].slice().sort(() => r.next() - 0.5).slice(0, Math.max(2, Math.round(n * 0.7)))) {
      const t = t0.startsWith('v_') ? t0 : 'v_' + t0, def = G.DECOR[t]; if (!def) continue;
      const w = walls.find((q) => !(def.fw > 1) || walls.some((o) => o.x === q.x + 1 && o.y === q.y)); if (!w) continue;
      walls.splice(walls.indexOf(w), 1); this.hang(m, t, w.x, w.y);
    }
    return true;
  },
  // ---------------------------------------------------------------- the station house
  // Who needs what: the public stops at the counter; officers sleep behind a wall, not beside the desks.
  station(m, b) {
    const iw = b.w - 2, ih = b.h - 2; if (iw < 12 || ih < 7) return false;
    const inB = (d) => d.tx >= b.x && d.tx < b.x + b.w && d.ty >= b.y && d.ty < b.y + b.h, safe = m.chests.find((c) => c.id === m.id + ':' + b.id + '_chest');
    for (const d of m.decor.filter(inB)) m.removeDecorRuntime(d, false);
    if (safe) m.chests.splice(m.chests.indexOf(safe), 1);
    const P = new G.RoomPlan(m, b), ix0 = P.ix0, ix1 = P.ix1, iy0 = P.iy0, dx = P.dx, wy = iy0 + 2, cell = Math.max(4, Math.floor(iw / 3)), wc = 2;
    const bunkW = iw - cell - wc - 2, { rooms } = G.INTERIOR.backRooms(P, 2, [bunkW, wc, cell], (q) => q.x0);
    const [bunks, loo, hold] = rooms;
    for (let x = ix0; x <= ix1; x++) if (x !== bunks.x0 && x !== loo.x0) P.reserved.delete(P.k(x, wy + 1));
    // the holding cell: barred from the squad room, nobody walks through
    for (let x = hold.x0; x <= hold.x1; x++) { m.set(x, wy, T.concrete); P.reserved.delete(P.k(x, wy)); }
    m.decor = m.decor.filter((d) => !(d.type === 'doorway' && d.ty === wy && d.tx >= hold.x0 && d.tx <= hold.x1));
    P.need = P.need.filter(([x, y]) => !(y === wy - 1 && x >= hold.x0 && x <= hold.x1));
    P.floor(hold.x0, iy0, hold.x1, wy - 1, T.concrete);
    for (let x = hold.x0; x <= hold.x1; x++) { P.blocked.add(P.k(x, wy)); m.addDecor('cell_bars', x, wy); }
    m.addDecor('bunk', hold.x0, iy0); m.addDecor('toilet', hold.x1, iy0); m.addDecor('v_stain_damp', hold.x0 + 1, iy0 + 1);
    for (let y = iy0; y <= wy - 1; y++) for (let x = hold.x0; x <= hold.x1; x++) P.blocked.add(P.k(x, y));
    // bunks, lockers, the washroom
    let n = 0; for (let x = bunks.x0; x <= bunks.x1 && n < 5; x++) if (P.put('bunk', x, iy0)) { m.points[b.id + (n ? '_bed' + (n + 1) : '_bed')] = { x, y: iy0 }; n++; }
    P.floor(loo.x0, iy0, loo.x1, wy - 1, T.tilefloor); P.put('toilet', loo.x0, iy0); P.put('sink', loo.x1, iy0);
    // the counter across the room, the gate in it, the public on the street side
    const fy0 = wy + 1, cy = fy0 + 2, gate = dx + 2 <= ix1 - 1 ? dx + 2 : dx - 3;
    P.reserve(gate, cy); P.reserve(gate, cy - 1); P.reserve(gate, cy + 1); P.mustReach(gate, fy0); P.mustReach(dx, cy + 1);
    for (let x = ix0; x + 1 <= ix1; x += 2) { if (x === gate || x + 1 === gate) { if (x + 1 === gate) { P.put('v_steel_rail', x, cy); } continue; } P.put('counter', x, cy); }
    // squad room: desks and files behind the counter, facing the street
    const desks = []; for (let x = ix0 + 1; x + 1 <= ix1 - 1; x += 4) if (Math.abs(x - gate) > 1 && Math.abs(x + 1 - gate) > 1) desks.push(x);
    for (const x of desks.slice(0, 3)) if (P.put('v_desk_files', x, cy - 1)) P.put('office_chair', x + 1, fy0);
    const w0 = desks[0] != null ? desks[0] + 1 : ix0 + 1;
    m.points[b.id + '_work'] = { x: gate === w0 ? w0 + 1 : w0 + 2, y: cy - 1 }; P.reserve(m.points[b.id + '_work'].x, cy - 1); P.mustReach(m.points[b.id + '_work'].x, cy - 1);
    if (safe) P.putAny('filing', P.row(fy0, ix0, ix1), {}, { id: b.id + '_chest', owner: safe.owner, loot: safe.loot, gold: safe.gold || 0 });
    for (const t of ['v_file_cabinet', 'v_gun_locker', 'v_file_cabinet']) P.putAny(t, P.row(fy0, ix0, ix1).concat(P.row(fy0, ix1, ix0)));
    // the public side: a bench, a bin, the flag by the door
    for (const x of [ix0 + 1, ix1 - 2]) P.put('v_bench_steel', x, P.iy1);
    P.putAny('v_trash_can', [[dx - 2, P.iy1], [dx + 2, P.iy1]]); P.put('v_flag', dx - 1, cy + 1);
    this.hang(m, 'v_w_wanted', Math.max(ix0, dx - 6), wy);
    if (bunks.x1 >= ix0 + 3) this.hang(m, 'v_w_notice', ix0 + 1, wy);
    for (const d of m.decor) if (inB(d) && d.def.solid) m.markOccupied && m.markOccupied(d.tx, d.ty);
    return true;
  },
};
V.add('steel_rail', 16, 14, (r) => { r(1, 3, 14, 1.6, steel); r(1, 3, 1.4, 11, dark); r(13.6, 3, 1.4, 11, dark); r(1, 8, 14, 1, '#54565c'); }, { solid: true });
// a bullet leaves something behind
const MAX_MARKS = 140;
if (G.explosions && G.explosions.bulletHitTile) {
  const _hit = G.explosions.bulletHitTile;
  G.explosions.bulletHitTile = function (scene, tx, ty, b) {
    const r = _hit.apply(this, arguments), map = scene.map, w = scene.world;
    const d = map.decorsAt(tx, ty).find((q) => !q.def.flat && q.def.breakHp && !q.def.chop);
    if (d) {
      d.hp = (d.hp != null ? d.hp : d.def.breakHp) - (b.dmg || 8);
      if (d.hp <= 0) { if (b.owner === scene.player) G.destruction.breakDecor(scene, d); else { G.mods.removeDecor(map, d); if (d.def.breakTo) G.mods.addDecor(map, d.def.breakTo, d.tx, d.ty); } }
    } else if ((map.tileDef(tx, ty) || {}).wall) {
      const M = G.marks, list = M.on(w, map.id); M.add(w, map.id, 'hole', b.x, b.y - 5);
      if (list.filter((q) => q.k === 'hole').length > MAX_MARKS) list.splice(list.findIndex((q) => q.k === 'hole'), 1);
    }
    return r;
  };
}
// someone sitting on a bench is drawn on it, though they stand on the tile in front of it (js/game/needs.js)
const NP = G.NPC.prototype, _npd = NP.draw, _nsy = NP.sortY;
NP.draw = function (ctx) {
  const q = this.seated && !this.moving && this.perch; if (!q) return _npd.call(this, ctx);
  const { x, y, dir } = this; this.x = q.x; this.y = q.y; this.dir = q.dir;
  try { return _npd.call(this, ctx); } finally { this.x = x; this.y = y; this.dir = dir; }
};
NP.sortY = function () { return this.seated && !this.moving && this.perch ? this.perch.z : _nsy.call(this); };
const _dress = R.dress;
R.dress = function (m) {
  const was = new Set(m.buildings.filter((b) => b.roomsDone).map((b) => b.id));
  _dress.call(this, m);
  let touched = false;
  for (const b of m.buildings) {
    if (was.has(b.id) || b.venue || b.playerBuilt) continue;
    if (/Police Station/.test(b.name) && b.kind === 'barracks') { if (HL.station(m, b)) { touched = true; b.planned = 'station'; } }
    else if (b.name === 'Bar' && b.planned === 'shop') { R.fit(m, b, ['bottle_shelf', 'keg', 'keg'], 3); touched = true; }
    else if (HL.home(m, b)) { const k = HL.profile(m, b); if (k && HL.dress(m, b, k)) { b.lived = k; touched = true; } }
  }
  if (touched) { m.computeSolids(); m.prerender(); }
};
})();
