'use strict';
// Rooms that make sense. The planners in js/data/interiors.js lay out generic homes, shops and offices; this pass gives each
// older building what its trade actually needs: filing cabinets in the station house, cots in the shelter, school desks,
// pallets, machine beds, tire stacks, bottle shelves. Pieces go along the walls, one at a time, and a piece is only kept
// if everywhere that could be reached before can still be reached, so no door, bed or counter is ever walled in.
(() => {
const V = G.vk, hash = G.signArt.hash;
const steel = '#6e7278', dark = '#34383e', rust = '#6a4630', wood = '#54402e', woodL = '#6e5840', paper = '#b8b2a2';
const shelf = (w, frame, goods) => (R) => { R(0, 0, w, 26, frame); for (const y of [8, 16, 24]) R(0, y, w, 1.4, '#22242a'); for (let r = 0; r < 3; r++) for (let i = 0; i < w / 3 - 1; i++) { const h = 3 + ((i * 7 + r * 3) % 4); R(1.5 + i * 3, 8 + r * 8 - h, 2.4, h, goods[(i + r * 2) % goods.length]); } };
V.add('file_cabinet', 14, 24, (R) => { R(0, 0, 14, 24, '#5a6066'); R(0, 0, 14, 1, '#7a8086'); for (let i = 0; i < 4; i++) { R(1, 2 + i * 5.4, 12, 4.6, '#4a5056'); R(5, 3.6 + i * 5.4, 4, 1, '#a8acb2'); R(2, 3 + i * 5.4, 2.4, 1.6, paper); } R(3, 8, 8, 0.4, '#2a2e34'); });
V.add('desk_files', 30, 18, (R) => { R(0, 4, 30, 9, woodL); R(0, 4, 30, 1.4, '#86705a'); R(2, 13, 2, 5, wood); R(26, 13, 2, 5, wood); R(3, 1, 8, 5, '#22262c'); R(4, 2, 6, 3, '#3a5a5a'); R(14, 2, 6, 3, paper); R(14.6, 1, 5, 2, '#d0caba'); R(22, 3, 5, 2, '#8a8474'); }, { fw: 2 });
V.add('gun_locker', 16, 26, (R) => { R(0, 0, 16, 26, '#3a3e44'); R(1, 1, 14, 24, '#2a2e34'); for (let i = 0; i < 4; i++) { R(2.5 + i * 3, 5, 1.4, 16, '#14161a'); R(2.2 + i * 3, 19, 2, 2, wood); } R(1, 1, 14, 2, '#50565e'); });
V.add('flag', 10, 26, (R) => { R(1, 0, 1.4, 26, '#8a8470'); R(2.4, 2, 7, 5, '#3a4660'); R(2.4, 7, 7, 4, '#7a2a2a'); R(0, 24, 4, 2, dark); }, { solid: false });
V.add('iv_stand', 8, 26, (R) => { R(3.4, 3, 1.2, 21, steel); R(0, 24, 8, 2, dark); R(1, 2, 6, 1, steel); R(5, 3, 2.4, 5, '#a8c0c8'); R(5.8, 8, 0.4, 8, '#c8d0d4'); }, { solid: true });
V.add('crash_cart', 14, 20, (R) => { R(0, 3, 14, 15, '#8a3a34'); R(0, 3, 14, 1, '#a85048'); for (let i = 0; i < 3; i++) { R(1, 5 + i * 4, 12, 3.2, '#742e2a'); R(5, 6 + i * 4, 4, 0.8, '#c8ccd2'); } R(2, 18, 2, 2, dark); R(10, 18, 2, 2, dark); R(3, 0, 6, 3, '#26282e'); });
V.add('cot', 16, 12, (R) => { R(0, 2, 16, 8, '#5a5e4e'); R(1, 2, 4, 8, '#b0aa98'); R(5, 3, 10, 6, '#4a5040'); R(0, 10, 1.4, 2, steel); R(14.6, 10, 1.4, 2, steel); R(7, 5, 5, 0.4, '#3a3e30'); }, { solid: true });
V.add('soup_table', 30, 18, (R) => { R(0, 5, 30, 7, '#7a786e'); R(0, 5, 30, 1.2, '#92907e'); R(2, 12, 2, 6, steel); R(26, 12, 2, 6, steel); R(4, 0, 9, 6, '#6e7278'); R(4, 0, 9, 1, '#8e9298'); R(17, 2, 3, 3, '#a8a494'); R(21, 2, 3, 3, '#a8a494'); }, { fw: 2 });
V.add('snack_shelf', 30, 26, shelf(30, '#4e5258', ['#8a4a34', '#3a5a6a', '#a8884a', '#5a6a3a', '#7a3a4a']), { fw: 2 });
V.add('med_shelf', 30, 26, shelf(30, '#a8a8a0', ['#c8c4b4', '#7a9aa0', '#b0806a', '#d0ccc0']), { fw: 2 });
V.add('bottle_shelf', 30, 26, shelf(30, '#3e2e20', ['#4a5a3a', '#6a3e24', '#a89878', '#3a4a5a', '#5a2a2a']), { fw: 2 });
V.add('ammo_shelf', 30, 26, shelf(30, '#34383e', ['#5a5a3a', '#6a5a2a', '#3e4a3a', '#4a3e2e']), { fw: 2 });
V.add('junk_shelf', 30, 26, shelf(30, '#4a3e30', ['#8a7a5a', '#5a6066', '#6a4a3a', '#a89868', '#3a3e44']), { fw: 2 });
V.add('mannequin', 10, 26, (R) => { R(3, 1, 4, 4, '#a8a498'); R(1.6, 6, 6.8, 9, '#5a5a62'); R(2, 15, 2.4, 8, '#3e4048'); R(5.6, 15, 2.4, 8, '#3e4048'); R(4.4, 23, 1.2, 1.5, steel); R(1, 24.5, 8, 1.5, dark); });
V.add('tire_stack', 16, 20, (R, x) => { for (let i = 0; i < 4; i++) { x.fillStyle = '#1a1a1e'; x.beginPath(); x.ellipse(8, 16 - i * 4, 7.6, 3.2, 0, 0, 6.3); x.fill(); x.fillStyle = '#2e2e34'; x.beginPath(); x.ellipse(8, 15.4 - i * 4, 6, 2.2, 0, 0, 6.3); x.fill(); } x.fillStyle = '#0c0c10'; x.beginPath(); x.ellipse(8, 3.4, 3, 1.2, 0, 0, 6.3); x.fill(); });
V.add('engine_hoist', 28, 30, (R) => { R(3, 0, 2, 28, rust); R(3, 0, 24, 2, rust); R(0, 27, 28, 3, dark); R(22, 2, 0.8, 9, '#a8a494'); R(18, 11, 9, 9, '#3a3a40'); R(19, 12, 7, 2, '#54545c'); R(20, 15, 5, 3, '#26262c'); }, { fw: 2 });
V.add('oil_drum', 14, 20, (R) => { R(1, 1, 12, 19, '#4e4438'); R(1, 1, 12, 1.4, '#6e6252'); R(1, 7, 12, 0.8, '#342c24'); R(1, 13, 12, 0.8, '#342c24'); R(3, 3, 2, 14, 'rgba(120,70,30,0.5)'); R(9, 10, 3, 7, 'rgba(20,16,12,0.6)'); });
V.add('pallet', 30, 18, (R) => { R(0, 14, 30, 4, '#5a4a34'); for (let i = 0; i < 3; i++) R(1 + i * 9.6, 3, 9, 11, i % 2 ? '#7a6a50' : '#6a5a44'); R(1, 8, 28, 0.8, '#3e3224'); R(10, 3, 0.6, 11, '#3e3224'); R(19.6, 3, 0.6, 11, '#3e3224'); R(3, 5, 5, 2, '#a8a494'); }, { fw: 2 });
V.add('machine', 30, 26, (R) => { R(0, 6, 30, 20, '#4a5258'); R(0, 6, 30, 2, '#64707a'); R(4, 0, 12, 7, '#3a4048'); R(6, 2, 8, 3, '#22262c'); R(20, 10, 7, 7, '#2a2e34'); R(21, 11, 5, 2, '#8a3a2a'); R(3, 12, 12, 10, '#34383e'); for (let i = 0; i < 4; i++) R(4 + i * 3, 14, 1, 6, '#54585e'); R(0, 24, 30, 2, 'rgba(0,0,0,0.5)'); }, { fw: 2 });
V.add('conveyor', 30, 14, (R) => { R(0, 3, 30, 7, '#26282e'); for (let i = 0; i < 30; i += 3) R(i, 3, 1, 7, '#34363c'); R(0, 2, 30, 1.2, steel); R(0, 10, 30, 1.2, steel); R(2, 11, 2, 3, dark); R(26, 11, 2, 3, dark); R(10, 0, 7, 4, '#6a5a44'); }, { fw: 2 });
V.add('folding_table', 30, 14, (R) => { R(0, 3, 30, 6, '#8a8878'); R(0, 3, 30, 1, '#a2a090'); R(3, 9, 1.4, 5, steel); R(26, 9, 1.4, 5, steel); R(5, 0, 7, 3.4, '#6a7a8a'); R(16, 1, 6, 2.4, '#a89a8a'); }, { fw: 2 });
V.add('school_desk', 14, 16, (R) => { R(1, 3, 12, 6, '#7a6248'); R(1, 3, 12, 1, '#94785a'); R(2, 9, 1.2, 7, steel); R(10.8, 9, 1.2, 7, steel); R(3, 5, 6, 0.4, '#54402e'); }, { solid: true });
V.add('hose_rack', 30, 26, (R, x) => { R(0, 2, 30, 2, steel); x.strokeStyle = '#7a3a2a'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(5 + i * 10, 13, 4, 8, 0, 0, 6.3); x.stroke(); } }, { fw: 2, solid: true });
V.add('mattress_floor', 16, 11, (R) => { R(0, 2, 16, 8, '#8a8270'); R(1, 3, 14, 6, '#a09880'); R(3, 4, 5, 3, 'rgba(90,70,40,0.4)'); R(10, 6, 4, 2, 'rgba(60,40,30,0.4)'); R(0, 9, 16, 1.4, '#3e3a30'); }, { solid: false });
V.add('weapon_crate', 28, 16, (R) => { R(0, 2, 28, 14, '#4e4a30'); R(0, 2, 28, 2, '#625e3e'); for (let x = 0; x < 28; x += 9) R(x, 2, 0.8, 14, '#34321e'); R(9, 7, 10, 4, '#2a2a1e'); R(10, 8, 8, 0.8, '#6a6848'); }, { fw: 2 });
V.add('w_chalkboard', 44, 16, (R) => { R(0, 0, 44, 16, '#54402e'); R(1.4, 1.4, 41, 12, '#2a3a32'); R(4, 4, 18, 0.6, '#a8b0a8'); R(4, 7, 26, 0.6, '#a8b0a8'); R(4, 10, 12, 0.6, '#a8b0a8'); R(0, 14, 44, 2, '#6e5840'); }, { fw: 3, solid: false });
// the old pieces that never got redrawn
const fine = {
  cooler: (R, x, w, h) => { R(0, 0, w, h, '#3a4048'); R(1, 2, w - 2, h - 6, '#7a9098'); for (let i = 1; i < 3; i++) R(1, 2 + i * (h - 6) / 3, w - 2, 0.7, '#34383e'); for (let i = 0; i < 5; i++) R(2 + (i * 7) % (w - 4), 4 + (i * 5) % (h - 10), 2, 4, ['#7a4a34', '#a8884a', '#4a6a5a'][i % 3]); R(w - 3, h / 2, 1, 5, '#a8acb2'); },
  pew: (R, x, w, h) => { R(0, 0, w, h * 0.5, '#4e3a28'); R(0, 0, w, 1, '#6a5038'); R(0, h * 0.5, w, h * 0.25, '#5e4632'); R(0, h * 0.72, w, h * 0.28, '#3a2c20'); for (let i = 4; i < w; i += 7) R(i, 1, 0.5, h * 0.48, '#3a2c20'); },
  stool: (R, x, w, h) => { R(1, 1, w - 2, 3, '#5a4632'); R(1, 1, w - 2, 1, '#74604a'); R(2, 4, 1.2, h - 4, '#3e3226'); R(w - 3.2, 4, 1.2, h - 4, '#3e3226'); },
  barstool: (R, x, w, h) => { R(1, 0, w - 2, 3, '#3e2a24'); R(1, 0, w - 2, 1, '#5a4034'); R(w / 2 - 0.8, 3, 1.6, h - 5, steel); R(1.5, h - 2, w - 3, 2, dark); },
  kcounter: (R, x, w, h) => { R(0, 3, w, h - 3, '#5e564a'); R(0, 2, w, 2.4, '#8a8478'); for (let i = 2; i < w; i += 8) { R(i, 6, 6, h - 8, '#50483e'); R(i + 2.4, 8, 1.2, 1, '#a8a494'); } },
  vending: (R, x, w, h) => { R(0, 0, w, h, '#3e4650'); R(1.5, 2, w * 0.62, h - 8, '#20262c'); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) R(2.4 + c * 2.8, 3 + r * ((h - 10) / 4), 2, 3, ['#7a3a2e', '#3a5a6a', '#a8884a'][(r + c) % 3]); R(w * 0.7, 3, w * 0.22, 4, '#7ab0a0'); R(w * 0.7, 9, w * 0.22, 8, '#22262c'); R(2, h - 5, w * 0.6, 3, '#14161a'); },
  gun_rack: (R, x, w, h) => { R(0, 0, w, h, '#3e2e20'); R(0, 2, w, 1.4, '#22180f'); R(0, h - 4, w, 2, '#22180f'); for (let i = 0; i < w / 5; i++) { R(2 + i * 5, 2, 1.4, h - 5, '#14161a'); R(1.6 + i * 5, h - 8, 2.2, 5, '#4e3a28'); } },
  statue: (R, x, w, h) => { R(1, h - 6, w - 2, 6, '#7a7a74'); R(1, h - 6, w - 2, 1, '#94948c'); x.fillStyle = '#54585a'; x.beginPath(); x.ellipse(w / 2, h * 0.17, w * 0.14, h * 0.09, 0, 0, 6.3); x.fill(); x.fillRect(w * 0.3, h * 0.26, w * 0.4, h * 0.44); x.fillStyle = 'rgba(200,200,190,0.35)'; x.fillRect(w * 0.3, h * 0.26, w * 0.1, h * 0.44); x.fillStyle = 'rgba(190,190,170,0.5)'; x.fillRect(w * 0.42, h * 0.12, w * 0.2, 1.4); },
  altar: (R, x, w, h) => { R(0, 3, w, h - 3, '#7a7468'); R(0, 2, w, 2, '#94907e'); R(2, 4, w - 4, 3, '#5e2a2a'); R(w / 2 - 0.6, h * 0.3, 1.2, h * 0.5, '#8a7a4a'); R(w / 2 - 3, h * 0.42, 6, 1.2, '#8a7a4a'); },
};
const fineArt = () => { const A = G.assets; for (const k in fine) { const s = A.sprites[k]; if (!s || s.vhd) continue; const w = s.img.width, h = s.img.height, c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3; const x = c.getContext('2d'); x.scale(3, 3); fine[k]((a, b, p, q, col) => { x.fillStyle = col; x.fillRect(a, b, p, q); }, x, w, h); s.vhd = c; s.w = w; s.h = h; } };
const A0 = G.assets, _ini = A0.init; A0.init = function () { _ini.call(this); fineArt(); };
if (A0.sprites && A0.sprites.bush) fineArt();
// what each trade needs, in order of importance
const JUNK = ['trash_can', 'oil_drum', 'mattress_floor'];
const PROFILES = [
  [/Police|Sheriff/, ['desk_files', 'desk_files', 'file_cabinet', 'file_cabinet', 'gun_locker', 'file_cabinet', 'flag']],
  [/City Hall/, ['flag', 'flag', 'desk_files', 'file_cabinet', 'file_cabinet', 'desk_files', 'file_cabinet', 'queue_rope']],
  [/Office Tower|Port Office|Search|Security Post/, ['desk_files', 'file_cabinet', 'desk_files', 'file_cabinet', 'trash_can']],
  [/Shelter/, ['soup_table', 'cot', 'cot', 'cot', 'cot', 'cot', 'trash_can']],
  [/Hospital|Infirmary/, ['iv_stand', 'crash_cart', 'iv_stand', 'file_cabinet']],
  [/Convenience|Mini-Mart|Bodega|General Store|Kosher|Gas Station/, ['snack_shelf', 'snack_shelf', 'snack_shelf', 'trash_can']],
  [/Liquor/, ['bottle_shelf', 'bottle_shelf', 'bottle_shelf']], [/Pharmacy/, ['med_shelf', 'med_shelf', 'med_shelf']], [/Gun Store/, ['ammo_shelf', 'gun_locker', 'ammo_shelf']],
  [/Clothes/, ['mannequin', 'mannequin', 'clothes_rack', 'mannequin', 'clothes_rack']], [/Pawn/, ['junk_shelf', 'junk_shelf', 'display_case']], [/Jewel/, ['display_case', 'display_case', 'display_case']],
  [/Chop Shop|Hardware/, ['engine_hoist', 'tire_stack', 'tire_stack', 'oil_drum', 'oil_drum', 'tire_stack']],
  [/Warehouse|Cold Storage/, ['pallet', 'pallet', 'oil_drum', 'pallet', 'pallet', 'tire_stack', 'pallet']], [/Factory/, ['machine', 'machine', 'conveyor', 'machine', 'conveyor', 'oil_drum', 'machine']],
  [/Laundromat/, ['folding_table', 'folding_table', 'trash_can']], [/School/, ['school_desk', 'school_desk', 'school_desk', 'school_desk', 'school_desk', 'school_desk', 'school_desk', 'school_desk', 'file_cabinet']],
  [/Fire Station/, ['hose_rack', 'hose_rack', 'lockers', 'oil_drum']], [/Hideout/, ['worn_couch', 'weapon_crate', 'mattress_floor', 'weapon_crate', 'mattress_floor', 'trash_can', 'lowtable']],
  [/Private Club/, ['sofa', 'sofa', 'sculpture', 'lowtable']], [/Mansion/, ['sculpture', 'display_case', 'sculpture']], [/Evidence/, ['file_cabinet', 'file_cabinet', 'file_cabinet', 'pallet']], [/Warden/, ['desk_files', 'file_cabinet', 'flag']],
  [/Tenement|Apartment Block|Workers' Flats|Trailer/, ['trash_can', 'mattress_floor']], [/Abandoned/, ['mattress_floor', 'oil_drum', 'pallet', 'trash_can']],
];
V.add('keg', 14, 18, (R) => { R(1, 2, 12, 16, '#6a5038'); R(1, 2, 12, 1.4, '#86705a'); R(1, 6, 12, 1, steel); R(1, 13, 12, 1, steel); R(6, 8.4, 2, 2.4, '#a8a494'); });
const R = G.roomsPass = {
  // the room planner put the same beds in everything: a working building keeps only what someone really sleeps on
  tidy(m, b) {
    const inside = m.decor.filter((d) => m.buildingAtTile(d.tx, d.ty) === b), beds = inside.filter((d) => /^bed/.test(d.type));
    const swap = (d, type) => { const x = d.tx, y = d.ty; m.removeDecorRuntime(d, false); return m.addDecor(type, x, y); };
    if (/Police|Sheriff|Church|Chapel|House of Prayer/.test(b.name)) beds.forEach((d) => swap(d, 'bunk'));
    else if (b.name === 'Bar') { beds.forEach((d, i) => swap(d, i ? 'v_keg' : 'bunk')); inside.filter((d) => d.type === 'wardrobe').forEach((d) => swap(d, 'v_keg')); }
    if (b.kind === 'temple' || /Chapel/.test(b.name)) inside.filter((d) => d.type === 'lamp').forEach((d) => swap(d, 'candles'));
  },
  fit(m, b, pieces, cap = 9) {
    const x0 = b.x + 1, x1 = b.x + b.w - 2, y0 = b.y + 1, y1 = b.y + b.h - 2, door = { x: b.doorX, y: b.doorY - 1 }, inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const flood = (extra) => { const s = new Set(); if (m.isSolidTile(door.x, door.y)) return s; const q = [[door.x, door.y]]; while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (s.has(k) || !inside(x, y) || m.isSolidTile(x, y) || (extra && extra.has(k))) continue; s.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } return s; };
    const keep = Object.values(m.points).filter((p) => p && !Array.isArray(p) && inside(p.x, p.y)), before = flood();
    // along the walls first: top row, then the sides
    const spots = []; for (let x = x0; x <= x1; x++) spots.push([x, y0]); for (let y = y0 + 1; y < y1; y++) { spots.push([x0, y]); spots.push([x1, y]); } for (let y = y0 + 2; y < y1 - 1; y += 2) for (let x = x0 + 2; x < x1 - 1; x += 3) spots.push([x, y]);
    let i = 0, n = 0;
    for (const name of pieces) {
      if (n >= cap) break;
      const type = 'v_' + name, def = G.DECOR[type]; if (!def) continue;
      const fw = def.fw || 1;
      while (i < spots.length) {
        const [x, y] = spots[i++], tiles = []; for (let k = 0; k < fw; k++) tiles.push(`${x + k},${y}`);
        if (tiles.some((t) => { const [a, c] = t.split(',').map(Number); return !before.has(t) || !inside(a, c) || m.decorsAt(a, c).length || (Math.abs(a - door.x) <= 1 && Math.abs(c - door.y) <= 1) || keep.some((p) => p.x === a && p.y === c); })) continue;
        // (a bed is a solid point: somebody still has to be able to stand beside it)
        const beside = (p, set) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => set.has((p.x + a) + ',' + (p.y + c)));
        if (def.solid !== false) { const blocked = new Set(tiles), after = flood(blocked); if (after.size < before.size - fw || !keep.every((p) => (m.isSolidTile(p.x, p.y) ? !beside(p, before) || beside(p, after) : after.has(p.x + ',' + p.y)))) continue; }
        m.addDecor(type, x, y); tiles.forEach((t) => before.delete(t)); n++;
        break;
      }
    }
    return n;
  },
  dress(m) {
    for (const b of m.buildings) {
      if (b.roomsDone || b.venue || b.playerBuilt) continue; b.roomsDone = true; this.tidy(m, b);
      const p = PROFILES.find(([rx]) => rx.test(b.name)); if (p) this.fit(m, b, p[1]);
      else if (/southside|eastside|industrial/.test(m.meta.district || '') && b.w >= 7) this.fit(m, b, [JUNK[hash(b.id) % 3]], 1);
      if (/School/.test(b.name)) { const d = m.addDecor('v_w_chalkboard', b.x + 2, b.y); d.y = (b.y + 1) * 16 + 2; }
      if (/Mansion|Private Club|Casino/.test(b.name)) { for (let x = b.x + 3; x < b.x + b.w - 3; x += 5) { const d = m.addDecor(x % 2 ? 'v_painting' : 'v_painting2', x, b.y); d.y = (b.y + 1) * 16 + 4; } }
    }
  },
};
for (const id of Object.keys(G.MAPGEN)) { const gen = G.MAPGEN[id]; G.MAPGEN[id] = () => { const m = gen(); if (!/^wilds|^hf_/.test(id) && m.finalized) R.dress(m); return m; }; }
})();
