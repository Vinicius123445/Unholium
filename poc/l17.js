const Rt = require('D:/Unholium_native/native/runtime');
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.stack.length > 1) G.scenes.remove(G.scenes.top());
  const C = G.coop, post = G.platform.post; G.platform.post = () => {}; G.scenes.replace(new G.MenuScene()); const M = new G.CoopMenu(); G.scenes.push(M); M.options().find((q) => q.label === 'Find games').act(); const S = G.scenes.top();
  const add = () => { C.onFound(JSON.stringify({ ip: '192.168.1.9', port: 7777, id: 5, name: 'Ana', players: 2, v: C.VERSION })); C.onFound(JSON.stringify({ ip: '192.168.1.8', port: 7777, id: 6, name: 'Bruno', players: 1, v: '1999' })); };
  tick(3); shot('find_empty'); add(); tick(3); shot('find_list');
  const R = G.renderer, can = R.canvas, us = R.uiScale, x = R.uiW / 2 * us, y = (R.uiH / 2 - (44 + 3 * 17) / 2 + 26 + 7) * us;
  add(); Rt.fire(can, 'mousemove', { clientX: x, clientY: y, button: 0, buttons: 0 }); G.loop.tick(1 / 60); G.loop.draw(); Rt.fire(can, 'mousedown', { clientX: x, clientY: y, button: 0, buttons: 1 }); G.loop.tick(1 / 60); G.loop.draw(); Rt.fire(window, 'mouseup', { clientX: x, clientY: y, button: 0 });
  console.log('clicked first row; top', G.scenes.top().constructor.name, 'title', G.scenes.top().title);
  G.platform.post = post;
};
