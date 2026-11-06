module.exports = async (G, g, p, shot, tick) => {
  g.loadMap('fightclub', 'from_port'); tick(20); const c = G.renderer.canvas, x = c.getContext('2d'); await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  const list = g.actors.filter((a) => a.kind === 'npc').slice(0, 8); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#444'; x.fillRect(0, 0, 1280, 720); x.scale(2, 2);
  list.forEach((n, i) => { console.log(i, n.id, n.st.name, JSON.stringify(n.look).slice(0, 170)); G.portrait.draw(x, n, 10 + (i % 4) * 150, 10 + Math.floor(i / 4) * 150, 130); });
  x.setTransform(1, 0, 0, 1, 0, 0); require('fs').writeFileSync('D:/Unholium_native/poc/out/f/faces.png', c.toBufferSync('png'));
};
