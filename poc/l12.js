module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(30); G.autonomy.off = true;
  const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.sleeping && a.state === 'schedule'); p.x = npc.x + 24; p.y = npc.y + 6; tick(40);
  const I = G.input, m = I.mouse, R = G.renderer, X = G.xp;
  let wins = []; const was = X.window; X.window = function (ctx, x, y, w, h, o) { const r = was.apply(this, arguments); wins.push({ x, y, w, h, close: !!(o && o.close), title: o && o.title }); return r; };
  const open = () => { g.talkTo(npc); const d = G.scenes.top(); d.chars = 9999; G.loop.tick(1 / 60); wins = []; G.loop.draw(); return d; };
  const click = (ux, uy) => { const s = R.uiScale; m.x = ux * s; m.y = uy * s; m.ux = ux; m.uy = uy; m.moved = true; m.down = true; m.pressed = true; G.loop.tick(1 / 60); G.loop.draw(); m.down = false; G.loop.tick(1 / 60); G.loop.draw(); };
  const d = open(); console.log('xp on', X.on, 'wins', JSON.stringify(wins), 'ui', R.uiW, R.uiH, R.uiScale, 'stack', G.scenes.stack.map((s) => s.constructor.name).join(','));
  const W = wins[wins.length - 1]; const bx = W.x + W.w - 15 - 3 + 7, by = W.y + 7;
  console.log('click X at', bx, by); click(bx, by); console.log('after X: top', G.scenes.top().constructor.name);
  if (G.scenes.top() !== g) { console.log('X failed'); d.leave(); }
  const e = open(); const w2 = wins[wins.length - 1], fx = w2.x + 80, fy = w2.y + w2.h - 12; console.log('click field at', fx, fy, 'node chat', e.runner.node.chat); for (const dy of [-6, -3, 0, 3]) { click(fx, fy + dy); console.log(' y', fy + dy, 'typing', e.typing); if (e.typing) break; }
};
