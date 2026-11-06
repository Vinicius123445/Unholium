// a long session, sped up: walking between maps, day after day. Memory is read after a full collection each round: what keeps growing is a leak.
module.exports = async (G, g, p, shot, tick) => {
  await new Promise((r) => setTimeout(r, 1200)); while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top());
  G.settings.data.smoothing = false; const maps = [['city', 'start'], ['rural', 'start'], ['heights', 'from_city'], ['jail', 'cell']], rows = [], rounds = +process.env.ROUNDS || 18; let crash = 0;
  const count = () => ({ act: g.actors.length, veh: g.vehicles.length, con: Object.keys(g.world.containers).length, dec: Object.values(g.world.decals || {}).reduce((a, l) => a + l.length, 0), recs: (g.world.vehicles || []).length });
  for (let r = 0; r < rounds; r++) {
    const [m, s] = maps[r % maps.length]; try { g.loadMap(m, s); } catch (e) { crash++; console.log('load', e.message); }
    for (let i = 0; i < 900; i++) { G.loop.tick(1 / 60); if (i % 2 === 0) { G.loop.draw(); if (i % 60 === 0) G.renderer.canvas.toBufferSync('raw'); } while (G.scenes.top() !== g) G.scenes.remove(G.scenes.top()); }
    g.world.minutes += 240; await new Promise((q) => setTimeout(q, 40)); global.gc(); await new Promise((q) => setTimeout(q, 40)); global.gc(); const q = process.memoryUsage(); rows.push([r, (q.heapUsed / 1048576) | 0, (q.rss / 1048576) | 0, (q.external / 1048576) | 0]); console.log(r, m, 'heap', rows[r][1], 'rss', rows[r][2], 'ext', rows[r][3], JSON.stringify(count()));
  }
  const a = rows[rounds >> 1], b = rows[rounds - 1]; console.log(`second half: heap ${a[1]} -> ${b[1]} MB, rss ${a[2]} -> ${b[2]} MB, errors ${crash}`);
};
