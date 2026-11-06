'use strict';
// The Notrael ("the chosen people"): a religious community living together in the north of the Rural Zone,
// east of the path to the forest. Men in black coats and white shirts with small round caps (kippot) or
// wide-brimmed black hats; the elder and the teacher lead prayers at the House of Prayer morning and
// evening. They will matter in the lore: everything they say is a placeholder until it is written.
(() => {
const MB = G.MB;
G.FACTIONS.notrael = { name: 'Notrael', listed: true, startRep: 0, hostileBelow: -60, color: '#d8d0b0', desc: '[Placeholder] The chosen people.' };

const _rural = G.MAPGEN.rural;
G.MAPGEN.rural = () => {
  const m = _rural();
  const r = new G.RNG('notrael');
  const area = (x0, y0, w, h) => { m.decor = m.decor.filter((d) => !(d.tx >= x0 - 1 && d.tx <= x0 + w && d.ty >= y0 - 1 && d.ty <= y0 + h)); m.flats = m.flats.filter((d) => !(d.tx >= x0 - 1 && d.tx <= x0 + w && d.ty >= y0 - 1 && d.ty <= y0 + h)); };
  area(84, 2, 24, 18);
  // the House of Prayer
  const t = m.addBuilding('n_prayer', 84, 2, 14, 10, { name: 'Notrael House of Prayer', wall: 'wall_stone', floor: 'woodfloor', roof: 'slate', kind: 'temple', chimney: false });
  m.fill(85, 3, 12, 2, G.T.carpet);
  m.addDecor('wardrobe', 90, 3); m.addDecor('wardrobe', 91, 3);          // the cabinet holding the scrolls
  m.addDecor('candles', 88, 3); m.addDecor('candles', 93, 3); m.addDecor('floorlamp', 85, 3); m.addDecor('floorlamp', 96, 3);
  m.addDecor('desk', 90, 6);                                              // the reading table in the middle
  for (const y of [8, 9]) for (const x of [85, 87, 93, 95]) m.addDecor('pew', x, y);
  m.points.n_prayer_lead = { x: 91, y: 5 };
  m.points.n_prayer_rows = [{ x: 86, y: 7 }, { x: 88, y: 7 }, { x: 94, y: 7 }, { x: 96, y: 7 }, { x: 89, y: 9 }, { x: 92, y: 9 }];
  // two family homes
  const h1 = m.addBuilding('n_home1', 99, 2, 9, 8, { name: 'House', wall: 'wall_wood', roof: 'brown', kind: 'house' });
  const h2 = m.addBuilding('n_home2', 99, 11, 9, 8, { name: 'House', wall: 'wall_wood', roof: 'brown', kind: 'house' });
  MB.furnish(m, h1, 'house', r, { owner: 'n_elder', beds: 2, loot: [['book', 2], ['bread', 2]] });
  MB.furnish(m, h2, 'house', r, { owner: 'n_member1', beds: 3, loot: [['book', 1], ['candles', 0]].filter((x) => x[1]) });
  // a small garden with benches between them and the path
  m.addDecor('bench', 86, 14); m.addDecor('bench', 92, 14); m.addDecor('lamp', 89, 13); m.addDecor('lamp', 95, 13);
  m.points.n_yard = [{ x: 88, y: 15 }, { x: 94, y: 15 }, { x: 90, y: 17 }, { x: 96, y: 16 }];
  m.finalize();
  return m;
};

const BLACK = (seed, o) => G.look(seed, Object.assign({ body: 'm', top: 'jacket', shirt: '#121214', shirt2: '#ecebe6', bottom: 'pants', pants: '#121214', shoes: '#0a0a0a', hat: 'kippah', hatColor: '#1a1a22', facial: 1, hair: '#2a1e18', glasses: null, mask: null, cape: null }, o));
const PRAY = (home, bed, yard) => [
  { from: 22, to: 6, at: home + '_' + bed, act: 'sleep' },
  { from: 6, to: 8, at: 'n_prayer_rows', act: 'idle' },
  { from: 8, to: 12, at: home + '_work', act: 'wander' },
  { from: 12, to: 17, at: yard, act: 'wander' },
  { from: 17, to: 19, at: home + '_kitchen', act: 'wander' },
  { from: 19, to: 21, at: 'n_prayer_rows', act: 'idle' },
  { from: 21, to: 22, at: home + '_work', act: 'wander' },
];
const NEW = {
  n_elder: { name: 'Notrael Elder', map: 'rural', faction: 'notrael', leader: true, hp: 35, combat: 'flee', home: 'n_home1', gold: 60, dialogue: 'notrael',
    look: BLACK('n_elder', { hat: 'blackhat', hair: '#d8d8d8', facial: 1 }), inv: [['book', 1]],
    schedule: [{ from: 22, to: 6, at: 'n_home1_bed', act: 'sleep' }, { from: 6, to: 8, at: 'n_prayer_lead', act: 'idle' }, { from: 8, to: 12, at: 'n_prayer_lead', act: 'wander' }, { from: 12, to: 19, at: 'n_yard', act: 'wander' }, { from: 19, to: 21, at: 'n_prayer_lead', act: 'idle' }, { from: 21, to: 22, at: 'n_home1_work', act: 'wander' }] },
  n_teacher: { name: 'Notrael Teacher', map: 'rural', faction: 'notrael', hp: 30, combat: 'flee', home: 'n_home1', gold: 30, dialogue: 'notrael', look: BLACK('n_teacher', { hat: 'blackhat', glasses: 'round', hair: '#3a2a20' }), inv: [['book', 2]], schedule: PRAY('n_home1', 'bed2', 'n_yard'), relations: { n_elder: 'family' } },
  n_member1: { name: 'Notrael Member', map: 'rural', faction: 'notrael', hp: 30, combat: 'flee', home: 'n_home2', gold: 25, dialogue: 'notrael', look: BLACK('n_member1', {}), schedule: PRAY('n_home2', 'bed', 'n_yard'), relations: { n_member2: 'spouse' } },
  n_member2: { name: 'Notrael Member', map: 'rural', faction: 'notrael', hp: 25, combat: 'flee', home: 'n_home2', gold: 20, dialogue: 'notrael', look: BLACK('n_member2', { body: 'f', top: 'dress', shirt: '#1e2230', hat: null, facial: 0, hairStyle: 6, hair: '#3a2418' }), schedule: PRAY('n_home2', 'bed2', 'n_yard'), relations: { n_member1: 'spouse' } },
  n_member3: { name: 'Notrael Member', map: 'rural', faction: 'notrael', hp: 30, combat: 'flee', home: 'n_home2', gold: 15, dialogue: 'notrael', look: BLACK('n_member3', { hat: 'blackhat', facial: 2 }), schedule: PRAY('n_home2', 'bed3', 'n_yard') },
  n_member4: { name: 'Notrael Member', map: 'rural', faction: 'notrael', hp: 25, combat: 'flee', home: 'n_home1', gold: 15, dialogue: 'notrael', look: BLACK('n_member4', { body: 'f', top: 'dress', shirt: '#2a2234', hat: null, facial: 0, hairStyle: 3, hair: '#1a1210' }), schedule: PRAY('n_home1', 'bed2', 'n_yard'), relations: { n_teacher: 'spouse' } },
};
for (const id in NEW) { const d = NEW[id]; d.id = id; d.relations = d.relations || {}; d.gender = d.look.body === 'f' ? 'female' : 'male'; G.NPCS[id] = d; }
NEW.n_elder.relations = { n_teacher: 'family', n_member1: 'comrade', n_member3: 'comrade' };

G.DIALOGUES.notrael = {
  start: { common: true, text: (c) => (c.st.introduced ? '[Placeholder] Peace be with you, friend.' : '[Placeholder] Peace be with you, stranger.'), choices: [{ text: 'Who are you people?', next: 'who' }, { text: 'What is this place?', next: 'place' }] },
  who: { text: '[Placeholder] We are the Notrael. The chosen. More than that is not for today.', choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] },
  place: { text: '[Placeholder] Our House of Prayer. Morning and evening, we pray. You may sit at the back, if you are quiet.', choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] },
};
})();
