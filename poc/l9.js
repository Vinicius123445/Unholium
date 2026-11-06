module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(20); G.autonomy.off = true; const B = G.talkbar, w = g.world;
  const n = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.dead && !a.sleeping && a.state === 'schedule' && !a.def.shop); n.st.fear = 0; n.st.disp = 90; p.x = n.x + 22; p.y = n.y;
  const s = B.start(g, n); console.log(n.id, B.list(s.runner.node).map((o) => o.text).join(' | ')); console.log('usable', G.ai && G.ai.usable(s.runner), 'match', B.match('can i have your number?', B.list(s.runner.node)));
  B.send(g, n, 'can i have your number?'); console.log(B.feed.map((f) => f.who + ': ' + f.text)); console.log(G.phone.isContact(w, n.id), s.live, s.runner.ended, s.runner.node && s.runner.node.id);
};
