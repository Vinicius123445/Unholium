'use strict';
// The Revolutionaries (satire): 2026 activists who gave up on petitions and bought rifles. Their goal is an
// armed revolution that puts down the Government and the Elite. If they get it, they turn out worse.
//
// Out in the world they talk like it (barks when you pass). The ending: a member of the collective, with the
// Mayor (c_lord) and the Philanthropist (Jack Ashford, i_leader; see js/game/ashford.js) dead, can tell the Organizer it is time, and the
// revolution takes the city. The epilogue is a NON-CANON ending: the regime that follows is worse than
// the one it replaced.
(() => {
const pick = (a) => G.rng.pick(a);
const BARKS = [
  'Ugh. Capitalism.', 'Do you know what is in that coffee? Exploitation. ...Can I have a sip?', 'I am literally shaking right now.',
  'The Mayor is complicit. In what? Yes.', 'Silence is violence. So is the Philanthropist.', 'I unfollowed the government today. Next step: the government.',
  'Have you done the reading?', 'This is a safe space. *racks shotgun*', 'Smash the system. Gently. Then hard.',
  'My parents fund the Elite, but I am, like, against them. Spiritually.', 'Eat the rich. Not literally. ...Unless?',
  'We are building a world without hierarchy. I am in charge of it.', 'Do not perform allyship at me.',
];
const isRev = (a) => a.kind === 'npc' && !a.dead && a.def.faction === 'revolutionaries' && !a.def.kid;
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  if (isRev(this) && !this.bark && !this.talking && this.state === 'schedule' && scene.player && this.distTo(scene.player) < 90 && Math.random() < dt / 25) this.say(pick(BARKS), 3);
  return _nu.call(this, dt, scene);
};

// ---------------------------------------------------------------- the revolution wins
G.revolution = {
  ready(w) { return w.isMember('revolutionaries') && !w.isAlive('c_lord') && !w.isAlive('h_host'); },
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc, scene } = runner, w = scene.world;
  if (npc.id !== 'f_rev_leader' || !G.revolution.ready(w)) return [];
  return [{ text: '[Ending] The Mayor and the Philanthropist are dead. It is time.', next: '_rev_end' }];
});
G.DIALOGUE_NODES._rev_end = (r) => ({
  text: 'Then tonight the city is ours. Tomorrow, the work begins. ...You understand there will need to be some changes. For everyone. Including you.',
  choices: [
    { text: '[Take the city] (ends the game: a non-canon ending)', next: null, do: () => { const w = r.scene.world; w.flags.revolution_won = true; G.scenes.replace(new G.EndingScene('revolution', w)); } },
    { text: 'Not yet.', next: 'start' },
  ],
});
const EPILOGUE = [
  'Year One. City Hall is renamed the People\'s Listening Space. Nobody is allowed to stop listening.',
  'The Elite\'s mansions are seized for the people. The Committee needs them for meetings.',
  'The police are abolished, and replaced by the Community Safety Collective. They carry rifles. They are much worse.',
  'Unapproved opinions are reclassified as harm. Harm is a crime. Re-education workshops run seven days a week.',
  'Food is shared fairly: everyone gets oat milk and lentils. Everyone except the Committee.',
  'By month eight, half the founders have been purged for not being revolutionary enough.',
  'You, a hero of the revolution, are denounced in month nine for "centering yourself".',
  'Things were bad before. They are worse now.',
];
const ES = G.EndingScene ? G.EndingScene.prototype : null;
const install = (proto) => {
  const _render = proto.render;
  proto.render = function (ctx) {
    if (this.type !== 'revolution') return _render.call(this, ctx);
    const R = G.renderer, U = G.ui;
    R.clear('#0c0608'); R.uiTransform();
    U.text(ctx, 'The Revolution', R.uiW / 2, 34, { size: 26, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#e05a6a' });
    U.text(ctx, 'NON-CANON ENDING', R.uiW / 2, 66, { size: 8, align: 'center', color: U.colors.dim });
    EPILOGUE.forEach((l, i) => {
      ctx.globalAlpha = G.util.clamp(this.t * 1.2 - i * 0.9, 0, 1);
      U.text(ctx, l, R.uiW / 2, 92 + i * 19, { size: 9, align: 'center', color: i === EPILOGUE.length - 1 ? '#ff8a7a' : '#e8d8c8' });
    });
    ctx.globalAlpha = 1;
    const w = this.world;
    U.text(ctx, `Days survived: ${w.day}   People killed: ${w.stats.murders}   Crimes: ${w.stats.crimes}`, R.uiW / 2, R.uiH - 58, { size: 9, align: 'center', color: U.colors.dim });
  };
};
if (ES) install(ES);
})();
