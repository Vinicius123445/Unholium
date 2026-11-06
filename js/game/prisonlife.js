'use strict';
// Life inside. Three inmate factions, Supremacists, Afros and Latinos, are ordinary factions in G.FACTIONS: membership,
// reputation, relations and hostility run through the same code as outside. Their data is theirs alone: ids of their
// own (no outside faction shares them), not listed in the Journal, never mentioned on the street.
//   Every inmate belongs to one (or to nobody, the unaffiliated keep their heads down). The player joins by asking a
//   member; each group has its own terms and takes only its own. They do not fight on sight: a yard runs on tension,
//   and trouble flares up between individuals (an hourly check by temper, grudges and how the groups stand).
//   Objects: the cells, mess hall, laundry, infirmary and yard are furnished one by one, with a little disorder.
(() => {
const pick = (a) => G.rng.pick(a);
const GANGS = { p_supremacists: 'Supremacists', p_afros: 'Afros', p_latinos: 'Latinos' };
const IDS = Object.keys(GANGS);
G.PRISON_FACTIONS = IDS;
const COLORS = { p_supremacists: '#c8b070', p_afros: '#3a9a5a', p_latinos: '#c85040' };
for (const id of IDS) G.FACTIONS[id] = { name: GANGS[id], prison: true, listed: false, startRep: 0, hostileBelow: -60, color: COLORS[id], desc: '' };
G.FACTION_RELATIONS['p_supremacists|p_afros'] = -0.8; G.FACTION_RELATIONS['p_supremacists|p_latinos'] = -0.7; G.FACTION_RELATIONS['p_afros|p_latinos'] = -0.5;
// who runs with whom, and who they will take in
const ROSTER = { j_boss: 'p_supremacists', j_inmate1: 'p_supremacists', j_inmate2: 'p_afros', j_inmate3: 'p_afros', j_inmate4: 'p_latinos', j_inmate5: 'p_latinos', j_inmate6: null };
// more bodies on each side of the yard
{ const base = G.NPCS.j_inmate1; if (base) for (const [id, fid] of [['j_s2', 'p_supremacists'], ['j_a2', 'p_afros'], ['j_l2', 'p_latinos']]) { G.NPCS[id] = Object.assign({}, base, { id, relations: {}, look: G.look(id, { body: 'm', top: 'shirt', shirt: '#d87020', bottom: 'pants', pants: '#d87020' }) }); ROSTER[id] = fid; } }
const RACE = { p_supremacists: ['caucasian'], p_afros: ['afro'], p_latinos: ['latino'] };
for (const id in ROSTER) {
  const d = G.NPCS[id]; if (!d || !ROSTER[id]) continue;
  d.faction = ROSTER[id];
  const f = RACE[ROSTER[id]][0]; if (d.look) { d.look.race = f; d.look.skin = G.races.nearest(f, d.look.skin); }
}
// the yard boss is one man; each group gets its own shot-caller
if (G.NPCS.j_inmate2) G.NPCS.j_inmate2.leader = true;
if (G.NPCS.j_inmate4) G.NPCS.j_inmate4.leader = true;

const P = G.prison = {
  IDS, GANGS,
  inside(scene) { return !!(scene && scene.map && scene.map.id === 'jail' && scene.world.jail); },
  gangOf(w, id) { const d = G.NPCS[id]; return d && IDS.includes(d.faction) ? d.faction : null; },
  yours(w) { return IDS.find((f) => w.isMember(f)) || null; },
  race(scene) { const p = scene.player; return (p.look && p.look.race) || 'other'; },
  canJoin(scene, fid) { return RACE[fid].includes(this.race(scene)); },
  // how the groups see each other from where you stand: read by the diary, never anything from outside
  standing(w) { return IDS.map((f) => ({ id: f, name: GANGS[f], rep: w.getRep(f), member: w.isMember(f), label: G.repLabel(w.getRep(f)) })); },
  inmates(w) { return Object.keys(G.NPCS).filter((id) => G.NPCS[id].map === 'jail' && /^j_(boss|inmate)/.test(id) && w.npcs[id]); },
};

// ---------------------------------------------------------------- talking about it
G.DIALOGUE_CHOICES.push((r) => {
  const { npc, scene } = r, w = scene.world, fid = P.gangOf(w, npc.id);
  if (!fid || !P.inside(scene) || npc.remote) return [];
  const out = [{ text: 'Who runs with you in here?', next: '_pg_who' }];
  if (!P.yours(w)) out.push({ text: `I want in with the ${GANGS[fid]}.`, next: '_pg_join' });
  else if (w.isMember(fid)) out.push({ text: 'Anything you need from me?', next: '_pg_favor' });
  return out;
});
const back = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
G.DIALOGUE_NODES._pg_who = (r) => {
  const w = r.scene.world, fid = P.gangOf(w, r.npc.id), mates = P.inmates(w).filter((id) => G.NPCS[id].faction === fid && id !== r.npc.id && w.isAlive(id)).map((id) => w.displayName(id));
  const rivals = IDS.filter((f) => f !== fid).map((f) => GANGS[f]);
  return { text: `${GANGS[fid]}. ${mates.length ? `${mates.join(', ')} and me.` : 'Just me left.'} ${rivals.join(' and ')}, that is who you watch out for.`, choices: back };
};
G.DIALOGUE_NODES._pg_join = (r) => {
  const { npc, scene } = r, w = scene.world, fid = P.gangOf(w, npc.id);
  if (!P.canJoin(scene, fid)) { G.social.addDisp(w, npc.id, -2); return { text: pick(['You? Look at yourself. Find your own people.', 'Wrong crowd. Find your own.']), choices: back }; }
  if (w.getRep(fid) < 5 && (npc.st.disp || 0) < 15) return { text: pick(['We do not know you yet. Do right by us first.', 'You have to earn that. Prove you can hold your own.']), choices: [{ text: 'What do I do?', next: '_pg_favor' }].concat(back) };
  w.flags['member_' + fid] = true;
  for (const f of IDS) if (f !== fid) w.addRep(f, -15);
  w.addRep(fid, 20);
  r.scene.toast(`You joined the ${GANGS[fid]}.`, 'good');
  P.note(w, `I am with the ${GANGS[fid]} now.`);
  return { text: pick(['Alright. You are with us. Watch your people and they watch you.', 'You are in. Do not make us regret it.']), choices: back };
};
G.DIALOGUE_NODES._pg_favor = (r) => {
  const { npc, scene } = r, w = scene.world, fid = P.gangOf(w, npc.id), st = npc.st;
  if (st.pgFavor === w.day) return { text: 'Nothing today. Keep your head down.', choices: back };
  st.pgFavor = w.day;
  const rival = P.inmates(w).filter((id) => G.NPCS[id].faction !== fid && P.gangOf(w, id) && w.isAlive(id));
  const name = rival.length ? w.displayName(pick(rival)) : null;
  return { text: name ? `${name} has been running their mouth. Hand over your dessert to one of ours and stay out of it, or make them regret it. Up to you.` : 'Share what you have with us. That is all.', choices: [
    { text: 'Here, take my tray. ($5)', if: (c) => c.gold() >= 5, do: (c) => { c.p.gold -= 5; st.gold = (st.gold || 0) + 5; w.addRep(fid, 4); G.social.addDisp(w, npc.id, 3); npc.say('Good. We remember.', 3); return null; } },
    { text: 'Not my problem.', do: () => { G.social.addDisp(w, npc.id, -2); return null; } },
  ] };
};

// ---------------------------------------------------------------- the yard's mood: trouble between individuals
G.events.on('hour', () => {
  const w = G.world, scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (!w || !scene || !P.inside(scene) || G.jail.lockdown(w)) return;
  const here = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && P.gangOf(w, a.id) && a.state === 'schedule');
  for (const a of here) for (const b of here) {
    if (a === b || P.gangOf(w, a.id) === P.gangOf(w, b.id) || a.distTo(b) > 90) continue;
    const Pa = G.social.persona(a.id), odds = (Pa.temper - Pa.patience / 2 - G.social.opinion(w, a.id, b.id) / 2) / 900;
    if (Math.random() < odds) { a.say(pick(['What are you looking at?', 'You are on the wrong side of the yard.', 'Say that again.']), 3); if (Pa.temper >= 72 && Math.random() < 0.4) a.startFight(b, scene); G.social.adjust(w, a.id, b.id, -3); return; }
  }
});

// ---------------------------------------------------------------- the furniture of a place people live in
const D = G.DECOR, A = G.assets;
const NEW = {
  bunk: ['bunk', 16, 26, true, { interact: 'bed' }], mattress: ['mattress', 16, 10, false, { interact: 'bed' }], stool: ['stool', 8, 9, false, {}], steel_toilet: ['steel_toilet', 11, 13, true, { interact: 'toilet' }], steel_sink: ['steel_sink', 11, 12, true, { interact: 'sink' }],
  j_locker: ['j_locker', 12, 22, true, {}], j_shelf: ['j_shelf', 16, 20, true, {}], tray: ['tray', 10, 6, false, {}], tray_stack: ['tray_stack', 12, 9, true, {}], mop_bucket: ['mop_bucket', 12, 16, true, {}], broom: ['broom', 6, 20, true, {}], trash_bag: ['trash_bag', 12, 11, false, {}], j_trash: ['j_trash', 11, 14, true, {}],
  book_stack: ['book_stack', 10, 7, false, {}], poster: ['poster', 10, 12, false, {}], weights: ['weights', 20, 11, true, {}], wash_tub: ['wash_tub', 18, 13, true, {}], shower_head: ['shower_head', 12, 20, false, { interact: 'shower' }], pillow_pile: ['pillow_pile', 12, 7, false, {}], j_table_s: ['j_table_s', 16, 11, true, {}],
  pay_phone: ['pay_phone', 12, 22, true, { interact: 'prison_phone' }],
};
const paint = {
  bunk(x) { x.fillStyle = '#6a6e74'; x.fillRect(0, 0, 2, 26); x.fillRect(14, 0, 2, 26); x.fillStyle = '#8a8e94'; x.fillRect(0, 3, 16, 2); x.fillRect(0, 15, 16, 2); x.fillStyle = '#d8d0c0'; x.fillRect(1, 5, 14, 5); x.fillRect(1, 17, 14, 6); x.fillStyle = '#f0ece0'; x.fillRect(2, 6, 5, 3); x.fillRect(2, 18, 5, 3); x.fillStyle = '#7a7e6a'; x.fillRect(7, 6, 7, 4); x.fillRect(7, 19, 7, 4); },
  mattress(x) { x.fillStyle = '#3a3a3a'; x.fillRect(0, 8, 16, 2); x.fillStyle = '#c8c0a8'; x.fillRect(0, 1, 16, 8); x.fillStyle = '#e8e0cc'; x.fillRect(1, 2, 5, 5); x.fillStyle = '#a89e88'; for (let i = 6; i < 16; i += 3) x.fillRect(i, 1, 1, 8); },
  stool(x) { x.fillStyle = '#5a5e64'; x.fillRect(1, 3, 1, 6); x.fillRect(6, 3, 1, 6); x.fillStyle = '#9a9ea4'; x.fillRect(0, 1, 8, 3); },
  steel_toilet(x) { x.fillStyle = '#9aa0a8'; x.fillRect(2, 0, 7, 7); x.fillStyle = '#c0c6ce'; x.fillRect(1, 6, 9, 6); x.fillStyle = '#5a7a8a'; x.fillRect(3, 8, 5, 3); },
  steel_sink(x) { x.fillStyle = '#a8aeb6'; x.fillRect(0, 2, 11, 5); x.fillStyle = '#6a8a9a'; x.fillRect(2, 3, 7, 3); x.fillStyle = '#7a8088'; x.fillRect(4, 0, 3, 3); x.fillRect(4, 7, 3, 5); },
  j_locker(x) { x.fillStyle = '#4e6a5e'; x.fillRect(0, 0, 12, 22); x.fillStyle = '#3a5046'; x.fillRect(5.5, 0, 1, 22); x.fillStyle = '#2a3a32'; for (let i = 3; i < 8; i += 2) { x.fillRect(1, i, 4, 1); x.fillRect(7, i, 4, 1); } x.fillStyle = '#c0c0a8'; x.fillRect(4, 12, 1, 2); x.fillRect(7, 12, 1, 2); },
  j_shelf(x) { x.fillStyle = '#5a5e64'; x.fillRect(0, 0, 2, 20); x.fillRect(14, 0, 2, 20); for (const y of [3, 10, 17]) x.fillRect(0, y, 16, 2); x.fillStyle = '#b89a6a'; x.fillRect(3, 11 - 5, 5, 4); x.fillStyle = '#d8d0c0'; x.fillRect(9, 7, 4, 3); x.fillRect(3, 14, 7, 3); },
  tray(x) { x.fillStyle = '#8a8e90'; x.fillRect(0, 1, 10, 5); x.fillStyle = '#c8b070'; x.fillRect(1, 2, 3, 3); x.fillStyle = '#a05a3a'; x.fillRect(5, 2, 4, 3); },
  tray_stack(x) { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#9a9ea0' : '#7a7e80'; x.fillRect(0, 7 - i * 2, 12, 2); } },
  mop_bucket(x) { x.fillStyle = '#d8b020'; x.fillRect(1, 9, 10, 7); x.fillStyle = '#5a6a6a'; x.fillRect(2, 8, 8, 2); x.fillStyle = '#b89060'; x.fillRect(5, 0, 1, 10); x.fillStyle = '#e0dcd0'; x.fillRect(3, 7, 5, 3); },
  broom(x) { x.fillStyle = '#a07a4a'; x.fillRect(2, 0, 2, 14); x.fillStyle = '#c8a860'; x.fillRect(0, 14, 6, 6); },
  trash_bag(x) { x.fillStyle = '#1e1e22'; x.beginPath(); x.ellipse(6, 7, 6, 4, 0, 0, 6.3); x.fill(); x.fillRect(5, 1, 2, 3); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(3, 5, 3, 1); },
  j_trash(x) { x.fillStyle = '#4a4e54'; x.fillRect(1, 2, 9, 12); x.fillStyle = '#6a6e74'; x.fillRect(0, 1, 11, 2); x.fillStyle = '#d8d0c0'; x.fillRect(3, 0, 3, 2); },
  book_stack(x) { for (const [y, c] of [[5, '#7a2a2a'], [3, '#2a4a7a'], [1, '#c8b890']]) { x.fillStyle = c; x.fillRect(1, y, 8, 2); } x.fillStyle = '#e8d8a0'; x.fillRect(7, 2, 2, 1); },
  poster(x) { x.fillStyle = '#e8e0cc'; x.fillRect(0, 0, 10, 12); x.fillStyle = '#7a8aa8'; x.fillRect(1, 1, 8, 6); x.fillStyle = '#a88a6a'; x.fillRect(3, 3, 4, 4); x.fillStyle = '#5a5a5a'; for (let i = 8; i < 11; i++) x.fillRect(1, i, 8, 0.6); },
  weights(x) { x.fillStyle = '#6a6e74'; x.fillRect(2, 5, 16, 2); x.fillStyle = '#26282c'; x.fillRect(0, 1, 4, 10); x.fillRect(16, 1, 4, 10); },
  wash_tub(x) { x.fillStyle = '#8a9098'; x.fillRect(0, 1, 18, 12); x.fillStyle = '#5a7a8e'; x.fillRect(2, 3, 14, 7); x.fillStyle = '#e0dcd0'; x.fillRect(4, 5, 6, 3); },
  shower_head(x) { x.fillStyle = '#7a8088'; x.fillRect(5, 0, 2, 6); x.fillRect(1, 4, 6, 2); x.fillStyle = 'rgba(160,200,230,0.5)'; for (let i = 0; i < 4; i++) x.fillRect(1 + i * 2, 7, 1, 12); },
  pillow_pile(x) { x.fillStyle = '#d8d0c0'; x.fillRect(0, 2, 8, 4); x.fillStyle = '#e8e0d0'; x.fillRect(4, 0, 8, 4); },
  j_table_s(x) { x.fillStyle = '#7a7e84'; x.fillRect(0, 2, 16, 6); x.fillStyle = '#5a5e64'; x.fillRect(2, 8, 2, 3); x.fillRect(12, 8, 2, 3); },
  pay_phone(x) { x.fillStyle = '#3a3e44'; x.fillRect(1, 0, 10, 20); x.fillStyle = '#6a6e74'; x.fillRect(2, 2, 8, 9); x.fillStyle = '#16181c'; x.fillRect(3, 3, 3, 8); x.fillStyle = '#c8c8c0'; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) x.fillRect(7 + c * 1.6, 4 + r * 2, 1, 1); x.fillStyle = '#26282c'; x.fillRect(5, 20, 2, 2); },
};
const art = () => { for (const k in NEW) { const [name, w, h] = NEW[k], c = document.createElement('canvas'); c.width = w; c.height = h; paint[name](c.getContext('2d')); A.sprites[name] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
for (const k in NEW) { const [name, , , solid, o] = NEW[k]; D[k] = Object.assign({ sprite: name, solid }, o); }
const _init = A.init; A.init = function () { _init.call(this); art(); };
if (A.sprites && A.sprites.bush) art();

const _gen = G.MAPGEN.jail;
G.MAPGEN.jail = () => {
  const m = _gen(), r = new G.RNG('jail-life');
  m.decor = m.decor.filter((d) => !(d.type === 'bed' && d.ty === 10));   // the single cots go: every cell is set up on its own
  const free = (x, y) => !m.isSolidTile(x, y) && !m.decorsAt(x, y).length;
  const put = (t, x, y) => { if (D[t] && m.inBounds(x, y) && free(x, y)) m.addDecor(t, x, y); };
  for (let k = 0; k < 8; k++) {
    const x0 = 9 + k * 4, bunk = k !== 3 && r.chance(0.6);
    m.addDecor(bunk ? 'bunk' : 'bed', x0, 10);   // (added directly: the old cots above still count as occupying the tile until the index is rebuilt)

    put(r.chance(0.5) ? 'steel_toilet' : 'steel_sink', x0 + 2, 10);
    put(r.pick(['book_stack', 'pillow_pile', 'tray', 'stool', 'poster']), x0 + 1, 9);
    if (r.chance(0.5)) put(r.pick(['trash_bag', 'book_stack', 'stool']), x0 + 2, 12);
  }
  for (const [x, y] of [[12, 15], [20, 15], [31, 15], [38, 15]]) put(r.pick(['j_locker', 'j_shelf', 'j_trash']), x, y);
  put('mop_bucket', 41, 20); put('broom', 42, 20); put('j_trash', 9, 20); put('trash_bag', 10, 20);
  put('pay_phone', 41, 15); m.points.j_phone = { x: 41, y: 16 };
  // the mess hall: stools at the tables, the tray stack by the line, a mess at the end of it
  for (let y = 12; y <= 17; y += 3) for (let x = 48; x <= 58; x += 5) { put('stool', x, y + 1); put('stool', x + 1, y - 1); if (r.chance(0.5)) put('tray', x + 2, y + 1); }
  put('tray_stack', 51, 9); put('tray_stack', 52, 9); put('j_trash', 62, 18); put('mop_bucket', 62, 10); put('j_shelf', 55, 9); put('j_shelf', 57, 9);
  // laundry, infirmary, yard
  put('wash_tub', 12, 33); put('j_shelf', 17, 27); put('trash_bag', 18, 33); put('broom', 9, 33); put('j_locker', 18, 31);
  put('j_shelf', 30, 27); put('steel_sink', 31, 31); put('j_trash', 24, 32); put('pillow_pile', 28, 28);
  put('weights', 25, 39); put('weights', 27, 42); put('stool', 39, 39); put('j_table_s', 37, 42); put('stool', 37, 43); put('stool', 35, 42); put('j_trash', 41, 38);
  m.computeSolids && m.computeSolids();
  return m;
};
})();
