module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(30);
  const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.sleeping && a.state === 'schedule');
  p.x = npc.x + 24; p.y = npc.y + 6; tick(60);
  const R = G.renderer, cam = R.cam, m = G.input.mouse;
  const run = (name, n) => { const xs = []; for (let i = 0; i < n; i++) { G.loop.tick(1 / 60); G.loop.draw(); xs.push([cam.x + cam.sx, cam.y + cam.sy, cam.sx, cam.sy, cam.shake]); } const tail = xs.slice(-Math.floor(n / 2)); let jx = 0, jy = 0, flips = 0, d0 = 0; for (let i = 1; i < tail.length; i++) { const d = tail[i][0] - tail[i - 1][0], e = tail[i][1] - tail[i - 1][1]; jx = Math.max(jx, Math.abs(d)); jy = Math.max(jy, Math.abs(e)); if (d * d0 < 0) flips++; d0 = d; } console.log(name, 'max step x', jx.toFixed(3), 'y', jy.toFixed(3), 'direction flips', flips, 'of', tail.length, 'shake', tail[tail.length - 1][4].toFixed(3), 'sx', tail[tail.length - 1][2].toFixed(3)); };
  run('walkless', 60);
  g.talkTo(npc); console.log('top', G.scenes.top().constructor.name);
  run('dialogue still', 180);
  m.ux = 300; m.uy = 100; m.x = 900; m.y = 300; run('dialogue mouse aside', 120);
  const vp = G.scenes.top(); console.log('xp', G.xp && G.xp.on, 'scene', vp.constructor.name);
  // a shake running when the talk starts
  G.renderer.shake(5); run('after shake', 60);
  p.hurtTimer = 0; npc.say('Hello there', 4); run('speech', 60);
};
