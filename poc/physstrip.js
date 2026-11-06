// filmstrips of the test room: what each blow really does, one picture for each moment
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  const L = G.hd.get(p.sheet).L, B = G.Body3, W = 150, H = 130, runs = [['Punch to the head', 0.55, 14, 'head'], ['Hard shove', 0, 150, 'chest'], ['Knockout', 0, 34, 'head'], ['Left knee shot', 0, 10, 'kneeL'], ['Drop', 0, 0, null]];
  const times = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 6];
  const c = document.createElement('canvas'); c.width = W * times.length; c.height = H * runs.length; const x = c.getContext('2d'); x.fillStyle = '#6a665e'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = 'rgba(0,0,0,0.3)';
  runs.forEach(([name, , J, at], r) => {
    const b = new B(0, 0, name === 'Drop' ? 3 : 0, 0.5); for (let i = 0; i < 60; i++) b.update(1 / 60); const c0 = b.com();
    if (at) { b.hit(b.at(at), [1, 0, 0], J); if (at === 'kneeL') b.wound('legL', 0.05); }
    let T = 0; times.forEach((tt, k) => { while (T < tt) { b.update(1 / 60); T += 1 / 60; } x.save(); x.beginPath(); x.rect(k * W, r * H, W, H); x.clip(); x.translate(k * W + W * 0.5, r * H + H * 0.8); x.scale(1.5, 1.5); { const c1 = b.com(); G.bodyView.draw(x, b, L, p, -c1.x * 44 / 1.75, -c1.y * 44 / 1.75); } x.restore(); x.strokeRect(k * W, r * H, W, H); x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(`${name} ${tt}s ${b.state} ${b.com().x.toFixed(1)},${b.com().y.toFixed(1)}`, k * W + 3, r * H + 12); });
  });
  require('fs').writeFileSync('D:/Unholium_native/poc/out/physstrip.png', await c.toBuffer('png')); console.log('wrote strip', c.width, c.height);
  G.scenes.push(new G.PhysTestScene(g)); G.input.pressed.add('Digit4'); G.loop.tick(1 / 60); G.input.pressed.delete('Digit4'); for (let i = 0; i < 24; i++) G.loop.tick(1 / 60); G.loop.draw(); shot('physroom');
};
