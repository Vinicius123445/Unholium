const Rt = require('D:/Unholium_native/native/runtime');
module.exports = async (G, g, p, shot, tick) => {
  g.loadMap('fightclub', 'from_port'); tick(30); G.autonomy.off = true;
  const npc = g.actors.find((a) => a.kind === 'npc' && /door/i.test(a.id + a.st.name)) || g.actors.find((a) => a.kind === 'npc'); console.log('npc', npc.id, npc.st.name, npc.state);
  p.x = npc.x + 8; p.y = npc.y + 20; npc.update = () => {}; tick(30);
  const I = G.input, m = I.mouse, R = G.renderer, X = G.xp, can = R.canvas, A = G.ai;
  // the model on, answering at once
  A.usable = () => true; A.active = () => true; A.npcLine = async (r) => ({ line: 'Hey, what are you yelling about?', attitude: 'annoyed', choices: ['What toll?', 'Nothing.'], actions: [], job: null, order: null });
  let wins = []; const was = X.window; X.window = function (ctx, x, y, w, h, o) { const r = was.apply(this, arguments); wins.push({ x, y, w, h, us: R.uiScale }); return r; };
  const ev = (t, x, y) => Rt.fire(t === 'mouseup' ? window : can, t, { clientX: x, clientY: y, button: 0, buttons: 1, type: t });
  const seen = []; const orig = Object.getOwnPropertyDescriptor(m, 'pressed');
  let val = false; Object.defineProperty(m, 'pressed', { get: () => val, set(v) { if (val && !v) seen.push(new Error().stack.split('\n').slice(2, 5).map((s) => s.trim().replace(/D:\\Unholium_native\\/, '')).join(' < ')); val = v; }, configurable: true });
  const step = (n = 1) => { for (let i = 0; i < n; i++) { G.loop.tick(1 / 60); G.loop.draw(); } };
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); g.talkTo(npc); const d = G.scenes.top(); console.log('top', d.constructor.name);
  for (let i = 0; i < 300; i++) { step(); await new Promise((r) => setImmediate(r)); }
  console.log('node', d.runner.node && d.runner.node.id, 'aiWait', d.aiWait, 'typing', d.typing, 'chars', d.chars, 'len', d.fullText.length, 'choices', (d.runner.node.choices || []).map((c) => c.text).join(' | '), 'stack', G.scenes.stack.map((s) => s.constructor.name).join(','));
  wins = []; step(); const W = wins[wins.length - 1]; console.log('win', JSON.stringify(W));
  const click = (ux, uy) => { const x = ux * W.us, y = uy * W.us; ev('mousemove', x, y); step(); seen.length = 0; ev('mousedown', x, y); console.log(' wantL', m.wantL); step(); ev('mouseup', x, y); step(); console.log(' cleared by', seen.slice(0, 2)); };
  console.log('field click'); click(W.x + 120, W.y + W.h - 15); console.log(' typing', d.typing, 'top', G.scenes.top().constructor.name);
  d.typing = false;
  console.log('X click'); click(W.x + W.w - 11, W.y + 8); console.log(' top', G.scenes.top().constructor.name);
};
