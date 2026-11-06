'use strict';
// Traffic that knows where it is going.
//   Every car has a destination: usually out of the map at the end of some street (through traffic), or a
//   particular intersection (then it picks a new one). The road network — intersections and road ends — is
//   a graph; shortest paths are precomputed per map. At each intersection a car takes the turn that is
//   actually on its shortest route (with a little human randomness).
//   Intersections are shared: a car waits before entering one that a crossing car is already in.
(() => {
const { boxes, DIRS } = G.roadTools;

function graph(map) {
  if (map.roadGraph) return map.roadGraph;
  const bx = boxes(map), rs = map.roads || [], nodes = [], lists = new Map();
  bx.forEach((b, i) => nodes.push({ i, box: b, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }));
  for (const r of rs) {
    const list = [];
    bx.forEach((b, i) => { if (b.h === r || b.v === r) list.push({ node: i, pos: r.h ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2 }); });
    // a road end at the map border is a way out only where the map really has an exit there (not where the
    // road just stops at the harbor or a wall: cars used to head for those and into the water)
    const exitAt = (tx, ty) => (map.exits || []).some((e) => tx >= e.x - 2 && tx < e.x + e.w + 2 && ty >= e.y - 2 && ty < e.y + e.h + 2);
    const mid = r.at + Math.floor(r.W / 2);
    const ends = [[r.from * 16, r.from <= 1 && exitAt(r.h ? 0 : mid, r.h ? mid : 0)], [(r.to + 1) * 16, (r.h ? r.to >= map.w - 2 : r.to >= map.h - 2) && exitAt(r.h ? map.w - 1 : mid, r.h ? mid : map.h - 1)]];
    for (const [pos, edgeOut] of ends) {
      const n = nodes.length;
      nodes.push({ terminal: true, edge: edgeOut, road: r, x: r.h ? pos : (r.at + r.W / 2) * 16, y: r.h ? (r.at + r.W / 2) * 16 : pos });
      list.push({ node: n, pos });
    }
    list.sort((a, b) => a.pos - b.pos);
    lists.set(r, list);
  }
  const N = nodes.length, INF = 1e9, dist = Array.from({ length: N }, () => new Float64Array(N).fill(INF));
  for (let i = 0; i < N; i++) dist[i][i] = 0;
  for (const list of lists.values()) for (let k = 0; k + 1 < list.length; k++) {
    const a = list[k].node, b = list[k + 1].node, d = Math.abs(list[k + 1].pos - list[k].pos);
    if (d < dist[a][b]) { dist[a][b] = d; dist[b][a] = d; }
  }
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const dik = dist[i][k]; if (dik >= INF) continue; for (let j = 0; j < N; j++) { const v = dik + dist[k][j]; if (v < dist[i][j]) dist[i][j] = v; } }
  return (map.roadGraph = { nodes, lists, dist });
}

Object.assign(G.vehicles, {
  graph,
  pickDest(map) {
    const g = graph(map), exits = g.nodes.filter((n) => n.terminal && n.edge), inner = g.nodes.filter((n) => !n.terminal);
    const pool = Math.random() < 0.7 && exits.length ? exits : inner.length ? inner : exits;
    return pool.length ? g.nodes.indexOf(G.rng.pick(pool)) : -1;
  },
  // which way to go at this intersection: the option on the shortest path to the destination
  route(map, v, box, opts) {
    const g = graph(map), ai = v.ai, here = g.nodes.findIndex((n) => n.box === box);
    if (ai.dest === here || ai.dest == null || ai.dest < 0) ai.dest = this.pickDest(map);
    const cur = ai.road, choices = opts.map((o) => (o ? o : { dir: ai.dir, road: cur, straight: true }));
    let best = null, bc = Infinity;
    for (const o of choices) {
      const list = g.lists.get(o.road);
      if (!list) continue;
      const pos = o.road.h ? (box.x0 + box.x1) / 2 : (box.y0 + box.y1) / 2, fwd = o.dir === 'E' || o.dir === 'S';
      const next = fwd ? list.find((e) => e.pos > pos + 1) : [...list].reverse().find((e) => e.pos < pos - 1);
      if (!next) continue;
      const cost = Math.abs(next.pos - pos) + (g.dist[next.node][ai.dest] || 1e9) + Math.random() * 40;
      if (cost < bc) { bc = cost; best = o; }
    }
    if (!best || best.straight) return null;
    return best;
  },
});

// wait before entering an intersection that a crossing car is already in
const _ai = G.vehicles.updateAI;
G.vehicles.updateAI = function (v, dt, scene) {
  const ai = v.ai, [dx, dy] = DIRS[ai.dir], ahead = { x: v.x + dx * (v.L + 12), y: v.y + dy * (v.L + 12) };
  const inside = (b, p) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;
  const nextBox = boxes(scene.map).find((b) => inside(b, ahead) && !inside(b, v));
  if (nextBox && ai.waitT < 3.5) {
    const busy = scene.vehicles.some((o) => o !== v && o.ai && inside(nextBox, o) && o.speed > 5 && (o.ai.road.h !== ai.road.h));
    if (busy) { v.speed = Math.max(0, v.speed - 300 * dt); ai.waitT += dt; return; }
  }
  return _ai.call(this, v, dt, scene);
};
})();
// does this road lead off the map at that end (where the map has an exit), or is it a dead end?
G.vehicles.roadExit = function (map, r, fwd) {
  const mid = r.at + Math.floor(r.W / 2), n = r.h ? map.w : map.h;
  const atEdge = fwd ? r.to >= n - 2 : r.from <= 1;
  if (!atEdge) return false;
  const tx = r.h ? (fwd ? map.w - 1 : 0) : mid, ty = r.h ? mid : (fwd ? map.h - 1 : 0);
  return (map.exits || []).some((e) => tx >= e.x - 2 && tx < e.x + e.w + 2 && ty >= e.y - 2 && ty < e.y + e.h + 2);
};

// Dead ends (the Center streets that stop at the harbor): nobody drives into one on purpose. Routing avoids
// the turn onto a dead-end stretch, and a car never starts out heading down one (it would cruise up to the
// water's edge and U-turn there).
(() => {
const V = G.vehicles, _route = V.route, _spawn = V.spawnTraffic;
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
// the next node along road r from position pos going dir
const nextNode = (map, r, pos, dir) => {
  const g = V.graph(map), list = g.lists.get(r); if (!list) return null;
  const fwd = dir === 'E' || dir === 'S';
  const e = fwd ? list.find((q) => q.pos > pos + 1) : [...list].reverse().find((q) => q.pos < pos - 1);
  return e ? g.nodes[e.node] : null;
};
V.deadAhead = (map, r, pos, dir) => { const n = nextNode(map, r, pos, dir); return !!(n && n.terminal && !n.edge); };
V.route = function (map, v, box, opts) {
  const pos = (o) => (o.road.h ? (box.x0 + box.x1) / 2 : (box.y0 + box.y1) / 2);
  const ok = opts.filter((o) => !o || !V.deadAhead(map, o.road, pos(o), o.dir));
  const straightDead = V.deadAhead(map, v.ai.road, v.ai.road.h ? (box.x0 + box.x1) / 2 : (box.y0 + box.y1) / 2, v.ai.dir);
  // when going straight leads into a dead end, offer only real turns (if there are any)
  if (straightDead) { const turns = opts.filter((o) => o && !V.deadAhead(map, o.road, pos(o), o.dir)); if (turns.length) return _route.call(this, map, v, box, turns.concat([turns[0]])) || turns[0]; }
  return _route.call(this, map, v, box, ok.length ? ok : opts);
};
V.spawnTraffic = function (scene, edge) {
  const v = _spawn.call(this, scene, edge);
  if (v && v.ai && V.deadAhead(scene.map, v.ai.road, v.ai.road.h ? v.x : v.y, v.ai.dir)) {
    const r = v.ai.road, d = OPP[v.ai.dir], lane = r.h ? (r.at + r.W * (d === 'E' ? 0.75 : 0.25)) * 16 : (r.at + r.W * (d === 'S' ? 0.25 : 0.75)) * 16;
    v.ai.dir = d; if (r.h) { v.y = lane; v.ai.lane = lane; } else { v.x = lane; v.ai.lane = lane; }
    v.angle = Math.atan2(G.roadTools.DIRS[d][1], G.roadTools.DIRS[d][0]);
  }
  return v;
};
})();
