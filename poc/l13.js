const Rt = require('D:/Unholium_native/native/runtime');
module.exports = (G, g, p, shot, tick) => {
  g.loadMap('city', 'start'); tick(30); G.autonomy.off = true;
  const npc = g.actors.find((a) => a.kind === 'npc' && !a.def.kid && !a.sleeping && a.state === 'schedule'); p.x = npc.x + 24; p.y = npc.y + 6; npc.update = () => {}; tick(40);
  const I = G.input, m = I.mouse, R = G.renderer, X = G.xp, can = R.canvas;
  let wins = []; const was = X.window; X.window = function (ctx, x, y, w, h, o) { const r = was.apply(this, arguments); wins.push({ x, y, w, h, us: R.uiScale, close: !!(o && o.close) }); return r; };
  const ev = (t, x, y) => Rt.fire(t === 'mouseup' ? window : can, t, { clientX: x, clientY: y, button: 0, buttons: 1, type: t });
  const clickUi = (ux, uy, us) => { const x = ux * us, y = uy * us; const r = can.getBoundingClientRect(), k = can.width / r.width; ev('mousemove', x / k + r.left, y / k + r.top); G.loop.tick(1 / 60); G.loop.draw(); ev('mousedown', x / k + r.left, y / k + r.top); G.loop.tick(1 / 60); G.loop.draw(); ev('mouseup', x / k + r.left, y / k + r.top); G.loop.tick(1 / 60); G.loop.draw(); };
  const open = () => { if (G.scenes.top() !== g) G.scenes.top().leave && G.scenes.top().leave(); g.talkTo(npc); const d = G.scenes.top(); for (let i = 0; i < 200 && d.chars < d.fullText.length; i++) { G.loop.tick(1 / 60); } wins = []; G.loop.draw(); return d; };
  const trial = (name) => {
    let d = open(), W = wins[wins.length - 1]; const x0 = W.x + W.w - 11, y0 = W.y + 8;
    clickUi(x0, y0, W.us); const xok = G.scenes.top() === g; console.log(name, 'canvas', can.width, can.height, 'rect', JSON.stringify(can.getBoundingClientRect()).slice(0, 80), 'scale', W.us.toFixed(3), 'X works', xok, 'mouse', m.ux.toFixed(1), m.uy.toFixed(1), 'target', x0, y0);
    if (!xok) d.leave();
    d = open(); W = wins[wins.length - 1]; const f = W.y + W.h - 15; let got = null; for (let dy = -12; dy <= 6 && got == null; dy += 3) { clickUi(W.x + 120, f + dy, W.us); if (d.typing) got = dy; } console.log('   field works', got != null, got); if (G.scenes.top() !== g) d.leave();
  };
  trial('plain');
  for (const u of [1.25, 1.5, 2]) { G.settings.data.uiScale = u; R.resize && R.resize(); if (window.dispatchEvent) Rt.fire(window, 'resize'); tick(2); trial('uiScale ' + u); }
  G.settings.data.uiScale = 1; Rt.fire(window, 'resize'); tick(2);
  // the model switched on, a reply that never comes
  const A = G.ai, u0 = A.usable, ask = A.npcLine; A.usable = () => true; A.active = () => true; A.npcLine = () => new Promise(() => {}); trial('AI waiting');
  A.usable = u0; A.npcLine = ask;
};
