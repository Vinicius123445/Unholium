'use strict';
// A* pathfinding on a tile grid: 8 directions (no cutting corners past walls), octile heuristic,
// road preference (map.pathCost), a node budget, and — when the goal is too far or unreachable — the
// best partial path toward it, so NPCs on big maps keep moving in the right direction.
// G.pathfind.smooth() then removes zig-zags by skipping waypoints that are in a clear straight line.

G.pathfind = (() => {
  class Heap {
    constructor() { this.a = []; }
    push(n) {
      const a = this.a;
      a.push(n);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    }
    get size() { return this.a.length; }
  }

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
  const octile = (dx, dy) => { dx = Math.abs(dx); dy = Math.abs(dy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };

  // Returns array of {x,y} tiles from start (exclusive) to goal (inclusive), or null.
  // opts.partial: return the path to the closest reached tile when the goal cannot be reached in budget.
  function find(map, sx, sy, gx, gy, maxNodes = 4000, opts = {}) {
    maxNodes *= (G.WORLD_SCALE || 1) * (G.WORLD_SCALE || 1);   // (budgets were set for maps a quarter of this area)
    const W = map.w, H = map.h, solid = map.solid;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
    if (solid[gy * W + gx]) {
      // goal blocked: use nearest open neighbour
      let best = null;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = gx + dx, ny = gy + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !solid[ny * W + nx]) { best = [nx, ny]; break; }
      }
      if (!best) return null;
      [gx, gy] = best;
    }
    if (sx === gx && sy === gy) return [];
    const start = sy * W + sx, goal = gy * W + gx;
    const g = new Map(), came = new Map();
    const open = new Heap();
    g.set(start, 0);
    open.push({ i: start, f: octile(gx - sx, gy - sy) });
    let expanded = 0, bestI = start, bestH = octile(gx - sx, gy - sy);
    const build = (end) => {
      const path = [];
      let i = end;
      while (i !== start) { path.push({ x: i % W, y: (i / W) | 0 }); i = came.get(i); }
      return path.reverse();
    };
    while (open.size) {
      const cur = open.pop();
      if (cur.i === goal) return build(goal);
      if (++expanded > maxNodes) break;
      const cx = cur.i % W, cy = (cur.i / W) | 0;
      const cg = g.get(cur.i);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (solid[ni] || (opts.avoid && opts.avoid(nx, ny))) continue;   // (avoid: e.g. animals stay out of the water)
        if (dx && dy && (solid[cy * W + nx] || solid[ny * W + cx])) continue;   // no squeezing past corners
        const ng = cg + cost + (map.pathCost ? map.pathCost[ni] * 0.6 : 0);
        if (g.has(ni) && g.get(ni) <= ng) continue;
        g.set(ni, ng);
        came.set(ni, cur.i);
        const h = octile(gx - nx, gy - ny);
        if (h < bestH) { bestH = h; bestI = ni; }
        open.push({ i: ni, f: ng + h * 1.05 });
      }
    }
    return opts.partial && bestI !== start ? build(bestI) : null;
  }

  // Clear straight line between two tile centers for an actor of half-width `hw` (px)?
  function clear(map, ax, ay, bx, by, hw = 5) {
    const x0 = ax * 16 + 8, y0 = ay * 16 + 9, x1 = bx * 16 + 8, y1 = by * 16 + 9;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 4);
    for (let k = 1; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      for (const ox of [-hw, hw]) for (const oy of [-3, 3]) if (map.isSolidTile(Math.floor((x + ox) / 16), Math.floor((y + oy) / 16))) return false;
    }
    return true;
  }

  // Drop waypoints that can be skipped in a straight line (keeps road-following mostly intact).
  function smooth(map, sx, sy, path) {
    if (!path || path.length < 3) return path;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < path.length) {
      let j = Math.min(path.length - 1, i + 6);
      while (j > i && !clear(map, ax, ay, path[j].x, path[j].y)) j--;
      out.push(path[j]);
      ax = path[j].x; ay = path[j].y;
      i = j + 1;
    }
    return out;
  }

  return { find, smooth, clear };
})();
