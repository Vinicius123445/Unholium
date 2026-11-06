'use strict';
// Jack Ashford, "the Philanthropist": the main villain. A billionaire financier who funds hospitals,
// universities, museums and half the city's politicians, and owns the island. Everyone powerful has been
// his guest; he keeps a record of what every guest did there, and that record is how he owns them.
// The island's Elite answer to him (he is its leader, i_leader). The captives in the Holding are people
// who owed him. (Nothing on the island involves children.)
//   - Out in the world: rumors, the news, what chatBCT knows, a line in your journal on day one.
//   - On the island: he talks. Charming, transactional, never threatening in so many words.
//   - Joining him: be a member of the Elite (their initiation, js/game/initiation.js), then come to the
//     island and ask for a seat at his table: the Inner Circle (a perk: Ashford's Favor), and a way to end
//     the story on his side ("join" ending).
// The mainland Elite leader (h_host) is his Gala Host now: the front man who throws his parties.
(() => {
const pick = (a) => G.rng.pick(a);
const NAME = 'Jack Ashford';
const L = G.NPCS.i_leader;
if (L) {
  L.name = 'The Philanthropist'; L.realName = NAME;
  L.look = G.look('ashford', { body: 'm', top: 'jacket', shirt: '#1a2238', shirt2: '#ecebe6', pants: '#1a2238', hair: '#c8c8c8', hairStyle: 0, facial: 0, skin: '#e8c8a8', glasses: null, hat: null, mask: null });
  L.job = 'I fund things. Hospitals, schools, careers.';
}
if (G.NPCS.h_host) { G.NPCS.h_host.name = 'Gala Host'; G.NPCS.h_host.job = 'I throw Mr. Ashford\'s parties. Everyone comes.'; }
// the people in the Holding are dressed (in rags), not on display
for (let k = 1; k <= 6; k++) { const c = G.NPCS['i_captive' + k]; if (c) c.look = G.look('icap' + k, { naked: false, top: 'shirt', shirt: '#8a8478', bottom: 'pants', pants: '#5a5448' }); }

// his name is his name, whatever the random name generator says
const fix = (w) => { const st = w && w.npcs && w.npcs.i_leader; if (st && st.realName !== NAME) st.realName = NAME; };
G.events.on('hour', () => fix(G.world));
const _cn = G.World.createNew;
G.World.createNew = function () { const w = _cn.apply(this, arguments); fix(w); w.journal.push({ day: 1, time: w.minutes, text: 'Everybody in this city owes somebody. Sooner or later, they all owe Jack Ashford.', type: 'info' }); return w; };

// ---------------------------------------------------------------- what people say about him
const RUMORS = [
  'Jack Ashford donated another hospital wing. They named it after him. Again.',
  'They say the Mayor spent a weekend on Ashford\'s island. Came back a different man.',
  'Nobody turns down an invitation to Ashford\'s island. The ones who did are not around anymore.',
  'A reporter was looking into Ashford\'s foundation. Her car went off the harbor road last week.',
  'Ashford keeps a book of everything his guests did on the island. Half the city is in it.',
];
G.events.on('newDay', () => { const w = G.world; if (w && (w.day % 3 === 2)) w.rumor(RUMORS[Math.floor(w.day / 3) % RUMORS.length], null); });
const _reply = G.bct.reply;
G.bct.reply = function (scene, raw) {
  const t = ' ' + raw.toLowerCase() + ' ';
  if (/\b(ashford|philanthropist|jack|the island|who runs)\b/.test(t)) return pick([
    'Jack Ashford. Billionaire. "Philanthropist." Owns the island, the foundation and, statistically, your local representative. I would not search his name on me. They read the logs.',
    'Ashford funds everything nice in this city and owns everyone important in it. The boat at the harbor goes to his island. People go there. Some come back.',
    'Ashford? Officially: a generous man. Unofficially: a man who keeps receipts on every powerful person who ever visited his island. Guess which one keeps him out of prison.',
  ]);
  return _reply.apply(this, arguments);
};

// ---------------------------------------------------------------- talking to him
const BACK = [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }];
const inner = (w) => !!w.flags.ashford_inner;
G.DIALOGUES.island_leader = {
  start: {
    common: true,
    text: (c) => inner(c.w || G.world) ? 'My friend. Sit, sit. Anything you need.' : c.flag && c.flag('met_ashford') ? 'Back again. The island grows on people.' : 'Ah. A new face. Everyone who comes to my island arrives a guest and leaves a friend. Or they do not leave.',
    choices: [
      { text: 'Who are you?', next: 'who' },
      { text: 'What is this place?', next: 'place' },
      { text: 'The people in the cells. Who are they?', next: 'cells' },
      { text: 'I want in. A seat at your table.', if: () => !inner(G.world), next: 'join' },
      { text: 'Goodbye.', next: null },
    ],
  },
  who: { text: (c) => { if (c.set) c.set('met_ashford'); const st = G.world.npcs.i_leader; if (st) st.introduced = true; return `${NAME}. A philanthropist. I fund hospitals, universities, a museum wing and three city councilors. Friends do favors for friends. And I keep a record of the favors.`; }, choices: BACK },
  place: { text: 'A retreat. Discreet. My guests come here to be themselves. What they do here is remembered, by me, so that nobody else ever has to know. They find that very reassuring. Eventually.', choices: BACK },
  cells: { text: 'Debts. Everyone pays, one way or another. Those are the ones who chose another. ...Do not look at me like that. Your Mayor has seen them. Your police chief has seen them. Nobody has done anything about it, have they?', choices: BACK },
  join: {
    text: () => G.world.isMember('elite') ? 'You are already a friend of the Foundation. Good. A seat at my table costs nothing... except that from now on, I know everything about you. Kneel, and it is yours.' : 'You are not even a friend of the Foundation. Go to the mainland, make yourself useful to my Gala Host and his people. Then come back.',
    choices: [
      { text: '[Kneel] (join his Inner Circle)', if: () => G.world.isMember('elite'), next: 'kneel' },
      { text: 'Not yet.', next: 'start' },
    ],
  },
  kneel: {
    text: (c) => { const w = G.world; w.flags.ashford_inner = true; const p = G.player; if (p && !G.effects.has(p, 'ashford_favor')) p.effects.push({ id: 'ashford_favor', t: 1e12, dur: 1e12, power: 1 }); w.addRep('elite', 25); w.log('You joined Jack Ashford\'s Inner Circle. He knows everything about you now.', 'quest'); G.audio.play('quest'); return 'Rise. Welcome to the table. Your problems are my problems now, and my problems... will occasionally be yours.'; },
    choices: [{ text: '[Ending] Take your seat at the round table (ends the game)', next: null, do: () => { G.scenes.replace(new G.EndingScene('ashford', G.world)); } }, { text: 'Thank you, Mr. Ashford.', next: null }],
  },
};
G.EFFECTS.ashford_favor = { id: 'ashford_favor', name: 'Ashford\'s Favor', kind: 'perk', bad: false, color: '#d8b040', permanent: true, stats: { charisma: 2, barter: 0.1 },
  desc: 'Doors open. Prices drop. Once a week, his people make a bounty go away (ask any Elite member). He owns you.' };
const _rem = G.effects.remove;
G.effects.remove = function (p, id) { if (id === 'ashford_favor' && G.world && G.world.flags.ashford_inner) return; return _rem.call(this, p, id); };
// Ashford's Favor: once a week, any Elite member makes a bounty disappear
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world;
  if (!inner(w) || npc.def.faction !== 'elite' || npc.def.kid || !Object.values(w.bounty || {}).some((b) => b > 0) || w.day - (w.flags.ashfordFixDay || -99) < 7) return [];
  return [{ text: '(Ashford\'s Favor) I have a problem with the law.', next: '_ashford_fix' }];
});
G.DIALOGUE_NODES._ashford_fix = (r) => { const w = r.scene.world; w.flags.ashfordFixDay = w.day; for (const k in w.bounty) w.bounty[k] = 0; r.scene.pendingReports = []; return { text: 'Mr. Ashford sends his regards. Your problem no longer exists.', choices: BACK }; };

// the ending at his side
const ES = G.EndingScene.prototype, _render = ES.render;
const EPI = [
  'You take your seat at the round table. Across from you: the Mayor, a judge, two senators, a bishop.',
  'Every one of them is in the book. So, now, are you.',
  'The city goes on. Hospitals open with his name on them. Reporters stop asking questions.',
  'The boat keeps running to the island. You are on it most weekends.',
  'You never find out what is written about you. You never stop wondering.',
];
ES.render = function (ctx) {
  if (this.type !== 'ashford') return _render.call(this, ctx);
  const R = G.renderer, U = G.ui; R.clear('#0a0806'); R.uiTransform();
  U.text(ctx, 'A Seat at the Table', R.uiW / 2, 40, { size: 24, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#d8b040' });
  EPI.forEach((l, i) => { ctx.globalAlpha = G.util.clamp(this.t * 1.2 - i * 0.9, 0, 1); U.text(ctx, l, R.uiW / 2, 96 + i * 22, { size: 10, align: 'center', color: '#e8dcc0' }); });
  ctx.globalAlpha = 1;
};
// the revolution's enemy is the Philanthropist himself now
if (G.revolution) G.revolution.ready = (w) => w.isMember('revolutionaries') && !w.isAlive('c_lord') && !w.isAlive('i_leader');
})();
