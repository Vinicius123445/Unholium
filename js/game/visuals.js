'use strict';
// Visuals: the picture on top of the pixel art.
//   Light:   a colored light map multiplied over the world. Daylight is graded through the day
//            (cool dawn, white noon, golden hour, blue dusk, moonlight); lamps, windows, fire,
//            muzzle flashes, flashlight cones and car headlights add real colored light.
//   Shadows: the sun casts shadows from trees, posts, people, cars and buildings; their length
//            and direction follow the sun across the sky and fade under clouds. Cloud shadows drift
//            over the ground with the wind.
//   Water:   sun glints and breaking foam along the shore.
//   Weather: rain (streaks, splashes, wet grade), fog banks, lightning (js/game/weather.js).
//   Ground:  soft contact shadows baked at the foot of walls, and richer terrain textures.
// Settings > Graphics > Quality Preset decides how much of this is drawn (js/game/gfxsettings.js).
(() => {
const A = G.assets;

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c) => `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
function curve(keys, h) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, c0] = keys[i], [h1, c1] = keys[i + 1];
    if (h >= h0 && h <= h1) return mix3(c0, c1, (h - h0) / (h1 - h0 || 1));
  }
  return keys[0][1];
}
// the color of daylight through the day (multiplied over the world)
const GRADE = [
  [0, [150, 168, 235]], [4.6, [150, 168, 235]], [5.5, [205, 175, 200]], [6.3, [255, 192, 155]], [7.3, [255, 228, 205]],
  [9, [255, 247, 236]], [12, [255, 255, 252]], [15.5, [255, 250, 238]], [17.4, [255, 224, 172]], [18.5, [255, 186, 128]],
  [19.4, [236, 148, 132]], [20.3, [172, 160, 212]], [21.2, [150, 168, 235]], [24, [150, 168, 235]],
];
const NIGHT = [12, 16, 38];

const blackCache = new WeakMap();
function black(img) {
  let c = blackCache.get(img);
  if (!c) {
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    blackCache.set(img, c);
  }
  return c;
}

// tileable soft noise (clouds and fog)
function cloudTex(seed, size = 128, cover = 0.5) {
  const r = new G.RNG(seed), c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const octs = [[4, 0.5], [8, 0.27], [16, 0.15], [32, 0.08]];
  const grids = octs.map(([n]) => Array.from({ length: n * n }, () => r.next()));
  const sm = (t) => t * t * (3 - 2 * t);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let v = 0;
    octs.forEach(([n, amp], k) => {
      const gx = px / size * n, gy = py / size * n, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
      const g = grids[k], at = (a, b) => g[((b + n) % n) * n + ((a + n) % n)];
      v += amp * lerp(lerp(at(x0, y0), at(x0 + 1, y0), fx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy);
    });
    const a = Math.max(0, Math.min(1, (v - (1 - cover) * 0.9) / 0.25));
    const i = (py * size + px) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(sm(a) * 255);
  }
  x.putImageData(img, 0, 0);
  return c;
}

G.visuals = {
  splashes: [],
  drops: [],
  flashAng: null,
  _last: 0,

  outdoorMap(scene) { const m = scene.map.meta; return !(m.indoor || m.floorOf || m.district === 'jail'); },

  // where the sun is: the direction and length of a shadow per pixel of height
  sun(h) {
    if (h < 6 || h > 19.6) return null;
    const t = (h - 6) / 13.6, elev = Math.sin(Math.PI * t);
    // (the sun stands behind the camera, so shadows fall toward the bottom of the screen where they can be seen)
    const dx = 2 * t - 1, dy = 0.5, n = Math.hypot(dx, dy), len = Math.min(2.2, 0.42 + (1 - elev) * 1.7);
    return { x: dx / n * len, y: dy / n * len, a: Math.min(1, elev * 3.2) };
  },

  shadowAlpha(scene) {
    const W = G.weather, s = this.sun(scene.world.hourF);
    if (!s || !this.outdoorMap(scene)) return 0;
    return s.a * 0.34 * (1 - (W ? W.cloud : 0) * 0.85) * (1 - (scene.map.meta.darkness || 0) * 1.5);
  },

  // ------------------------------------------------------------ under the world objects
  afterGround(ctx, scene, view) {
    const t = scene.time;
    if (G.gfx('water')) this.drawWater(ctx, scene, view, t);
    if (G.gfx('shadows')) this.drawShadows(ctx, scene, view);
  },

  drawWater(ctx, scene, view, t) {
    const map = scene.map, T = G.TILES, g = map.ground, W = map.w;
    const tx0 = Math.max(0, Math.floor(view.x / 16)), ty0 = Math.max(0, Math.floor(view.y / 16));
    const tx1 = Math.min(map.w - 1, Math.ceil((view.x + view.w) / 16)), ty1 = Math.min(map.h - 1, Math.ceil((view.y + view.h) / 16));
    const sun = this.sun(scene.world.hourF), glint = sun ? 0.9 * (1 - (G.weather ? G.weather.cloud : 0) * 0.7) : 0.35;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const def = T[g[ty * W + tx]];
      if (!def || !def.water) continue;
      const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      // sun glints: brief sparkles where a wave faces the sky
      for (let k = 0; k < 2; k++) {
        const s = Math.sin(t * (0.9 + ((h >> (k * 4)) & 7) * 0.13) + (h & 255) * 0.1 + k * 3.1);
        if (s > 0.9) {
          ctx.fillStyle = `rgba(255,255,245,${((s - 0.9) / 0.1 * glint).toFixed(2)})`;
          ctx.fillRect(tx * 16 + ((h >> (8 + k * 5)) & 15), ty * 16 + ((h >> (13 + k * 5)) & 15), 2, 1);
        }
      }
      // foam where the water meets the land, washing in and out
      if (def.name === 'pool' || map.shore) continue;   // (an organic shoreline draws its own foam below: js/game/terrain.js)
      const wash = Math.sin(t * 1.4 + tx * 0.7 + ty * 1.3);
      const fa = 0.28 + 0.18 * wash, off = 1 + Math.round((wash + 1) * 1.2);
      const edge = (dx, dy) => { const n = T[map.get(tx + dx, ty + dy)]; return map.inBounds(tx + dx, ty + dy) && n && !n.water; };
      ctx.fillStyle = `rgba(236,244,255,${fa.toFixed(2)})`;
      if (edge(0, -1)) { ctx.fillRect(tx * 16, ty * 16, 16, 1); for (let i = (h & 3); i < 16; i += 3) ctx.fillRect(tx * 16 + i, ty * 16 + off, 1, 1); }
      if (edge(0, 1)) { ctx.fillRect(tx * 16, ty * 16 + 15, 16, 1); for (let i = (h & 3); i < 16; i += 3) ctx.fillRect(tx * 16 + i, ty * 16 + 15 - off, 1, 1); }
      if (edge(-1, 0)) { ctx.fillRect(tx * 16, ty * 16, 1, 16); for (let i = (h & 3); i < 16; i += 3) ctx.fillRect(tx * 16 + off, ty * 16 + i, 1, 1); }
      if (edge(1, 0)) { ctx.fillRect(tx * 16 + 15, ty * 16, 1, 16); for (let i = (h & 3); i < 16; i += 3) ctx.fillRect(tx * 16 + 15 - off, ty * 16 + i, 1, 1); }
    }
    // foam along the organic shoreline: each shore pixel brightens as a wave washes along the beach
    if (map.shore) for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const s = map.shore.get(ty * W + tx);
      if (!s) continue;
      for (let k = 0; k < s.length; k += 2) {
        const X = tx * 16 + s[k], Y = ty * 16 + s[k + 1];
        const a = 0.2 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.5 - X * 0.12 - Y * 0.17));
        ctx.fillStyle = `rgba(236,244,255,${a.toFixed(2)})`;
        ctx.fillRect(X, Y, 1, 1);
      }
    }
  },

  drawShadows(ctx, scene, view) {
    const alpha = this.shadowAlpha(scene);
    if (alpha < 0.02) return;
    const s = this.sun(scene.world.hourF), R = G.renderer, map = scene.map;
    const ox = Math.floor(R.cam.x + R.cam.sx) - 2, oy = Math.floor(R.cam.y + R.cam.sy) - 2;
    const sw = Math.ceil(R.viewW) + 4, sh = Math.ceil(R.viewH) + 4;
    const c = this.shadowCanvas || (this.shadowCanvas = document.createElement('canvas'));
    if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, sw, sh);
    x.globalCompositeOperation = 'source-over';
    // buildings: the footprint swept along the sun direction
    for (const b of map.buildings) {
      if (b.destroyed) continue;
      const hgt = 40 + (b.extraH || 0), X0 = b.x * 16 - ox, Y0 = b.y * 16 - 6 - oy, X1 = (b.x + b.w) * 16 - ox, Y1 = (b.y + b.h) * 16 - oy;
      const dx = s.x * hgt, dy = s.y * hgt;
      if (Math.max(X1, X1 + dx) < 0 || Math.min(X0, X0 + dx) > sw || Math.max(Y1, Y1 + dy) < 0 || Math.min(Y0, Y0 + dy) > sh) continue;
      x.fillStyle = '#000';
      x.beginPath();
      const pts = hull([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0 + dx, Y0 + dy], [X1 + dx, Y0 + dy], [X1 + dx, Y1 + dy], [X0 + dx, Y1 + dy]]);
      pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.closePath(); x.fill();
      x.globalCompositeOperation = 'destination-out'; x.fillRect(X0, Y0, X1 - X0, Y1 - Y0); x.globalCompositeOperation = 'source-over';   // never on itself
    }
    // trees, posts, signs...: their silhouettes, sheared along the ground
    const decor = map.decorInView ? map.decorInView(view) : map.decor;
    for (const d of decor) {
      if (d.def.flat || (d._room && d._room.roofAlpha >= 0.99)) continue;
      const sp = A.sprites[d.def.sprite];
      if (!sp || sp.h < 12) continue;
      if (d._inB === undefined) d._inB = !!map.buildingAt(d.x, d.y - 2);
      if (d._inB) continue;
      if (d.x < view.x - 60 || d.x > view.x + view.w + 60) continue;
      if (d.def.pfw && !d.def.pfh) { const art = (G.vehiclesHD && G.vehiclesHD.get(d.type)) || sp.img; x.setTransform(1, 0, 0, 1, Math.round(d.x + s.x * 6) - ox, Math.round(d.y + s.y * 6) - oy); x.drawImage(black(art), -sp.ax, -sp.ay, sp.w, sp.h); continue; }   // (a parked car lies flat: its shadow is its own outline, not a tall thing's)
      const dk = G.decorScale(d.type); x.setTransform(dk[0], 0, -s.x * dk[1], -s.y * dk[1], Math.round(d.x) - ox, Math.round(d.y) - oy);
      x.drawImage(black(sp.img), -sp.ax, -sp.ay);
    }
    // people and animals (their current animation frame), and cars
    for (const a of scene.actors) {
      if (a.dead || a.sleeping || a.vehicle || a.kind === 'vehicle' || !a.sheet) continue;
      if (a.x < view.x - 40 || a.x > view.x + view.w + 40 || a.y < view.y - 20 || a.y > view.y + view.h + 60) continue;
      if (map.buildingAt(a.x, a.y - 3)) continue;
      const sh2 = a.sheet, fr = a.frame();
      x.setTransform(1, 0, -s.x, -s.y, Math.round(a.x) - ox, Math.round(a.y) - oy);
      x.drawImage(black(sh2.img), fr.col * sh2.fw, fr.row * sh2.fh, sh2.fw, sh2.fh, -sh2.fw / 2, -sh2.fh + 1, sh2.fw, sh2.fh);
    }
    for (const v of scene.vehicles || []) {
      const sp = A.sprites['veh_' + v.model];
      if (!sp || v.x < view.x - 40 || v.x > view.x + view.w + 40) continue;
      x.setTransform(1, 0, 0, 1, Math.round(v.x + s.x * 6) - ox, Math.round(v.y + s.y * 6) - oy);
      x.rotate(v.angle);
      const art = (G.vehiclesHD && G.vehiclesHD.get(v.model)) || sp.img; x.drawImage(black(art), -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;   // a soft penumbra
    ctx.drawImage(c, ox, oy);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  },

  // ------------------------------------------------------------ over the world, under the light
  beforeLighting(ctx, scene, view) {
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (this._last || now));
    this._last = now;
    this._dt = dt;
    const W = G.weather, out = this.outdoorMap(scene);
    // cloud shadows drifting with the wind
    if (G.gfx('clouds') && out && W) {
      const sa = this.shadowAlpha(scene) / 0.34, cover = W.cloud;
      const k = sa * 0.26 * Math.min(1, cover * 2.2) * (1 - Math.max(0, cover - 0.75) * 3);
      if (k > 0.01) {
        const tex = this.clouds || (this.clouds = cloudTex(77, 128, 0.55));
        const S = 1024, b = G.breeze || { angle: 0.3 };
        const offX = ((scene.time * 9 * Math.cos(b.angle)) % S + S) % S, offY = ((scene.time * 9 * Math.sin(b.angle) * 0.5) % S + S) % S;
        const bt = this.cloudBlack || (this.cloudBlack = black(tex));
        ctx.save(); ctx.globalAlpha = k; ctx.imageSmoothingEnabled = true;
        const x0 = Math.floor((view.x - offX) / S) * S + offX, y0 = Math.floor((view.y - offY) / S) * S + offY;
        for (let yy = y0; yy < view.y + view.h; yy += S) for (let xx = x0; xx < view.x + view.w; xx += S) ctx.drawImage(bt, xx, yy, S, S);
        ctx.restore(); ctx.imageSmoothingEnabled = false;
      }
    }
    // raindrops hitting the ground (and the roofs): little rings
    const rain = W && out && G.gfx('weather') ? W.rain : 0;
    if (rain > 0.02) {
      const n = rain * G.gfxLevel().splash * dt * 10;
      for (let i = 0; i < n; i++) {
        const sx = view.x + Math.random() * view.w, sy = view.y + Math.random() * view.h;
        const b = scene.map.buildingAt(sx, sy);
        if (b && b.roofAlpha < 0.5) continue;
        this.splashes.push({ x: sx, y: sy, t: 0 });
      }
    }
    if (this.splashes.length) {
      ctx.lineWidth = 0.6;
      const keep = [];
      for (const p of this.splashes) {
        p.t += dt;
        if (p.t > 0.32) continue;
        keep.push(p);
        const k = p.t / 0.32;
        ctx.strokeStyle = `rgba(215,228,242,${(0.55 * (1 - k)).toFixed(2)})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.5 + k * 3, 0.3 + k * 1.6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      this.splashes = keep.length > 600 ? keep.slice(-600) : keep;
    }
  },

  // ------------------------------------------------------------ the light map
  renderLighting(ctx, scene) {
    const R = G.renderer, w = scene.world, W = G.weather;
    const lt = w.lighting();
    const pl = scene.player, indoorLit = scene.map.buildingAt(pl.x, pl.y - 3);
    const meta = scene.map.meta, out = this.outdoorMap(scene);
    // the same darkness rules as before: at night, without a flashlight, it is really dark out there
    const blind = lt.dark > 0.2 && !pl.hasTorch() && !pl.phoneLight && !indoorLit;
    const dark = Math.min(blind ? 0.96 : 0.88, lt.dark * (blind ? 1.35 : 1) + (meta.darkness || 0));
    const h = w.hourF;
    let grade = out ? curve(GRADE, h) : [255, 244, 228];
    if (out && W) {
      grade = mix3(grade, [168, 176, 192], W.cloud * 0.5 + W.rain * 0.15);
      if (W.fog > 0.05) grade = mix3(grade, [205, 210, 218], W.fog * 0.3);
    }
    let amb = mix3(grade, NIGHT, dark);
    // deep night with no flashlight and no lamp, window or fire nearby: nothing to see by at all. Pitch black
    // (the lights below still light their own patch, so you can see them and what stands near them)
    const pitch = blind && out ? G.util.clamp((lt.dark - 0.45) / 0.25, 0, 1) : 0;
    if (pitch > 0) amb = mix3(amb, [0, 0, 0], pitch);
    const flash = out && W ? W.flash : 0;
    if (flash > 0) amb = mix3(amb, [235, 240, 255], Math.min(1, flash * 1.4));
    this.amb = amb;
    const night = lt.dark > 0.2;
    // the lights
    const lights = [];
    if (night) {
      for (const l of scene.map.lights) lights.push(l);
      for (const b of scene.map.buildings) if (b.lit && !b.destroyed && !b.gutted) for (const wn of b.windows) lights.push({ x: wn.x, y: (wn.fy || wn.y) + 6, r: 24, color: '255,196,120', i: 0.7 });
      for (const b of scene.map.buildings) if (b.roofAlpha < 0.5 && !b.destroyed && !b.gutted) lights.push({ x: (b.x + b.w / 2) * 16, y: (b.y + b.h / 2) * 16, r: Math.max(b.w, b.h) * 11, color: '255,214,160', i: 0.9 });
    }
    for (const l of scene.fire.lights()) lights.push(l);
    for (const f of scene.flashes) lights.push({ x: f.x, y: f.y, r: 54, color: '255,214,140', i: 1.1 });
    const torch = pl.hasTorch() && night;
    if (pl.phoneLight && night) { const [fx, fy] = G.util.DIR_VEC[pl.dir]; lights.push({ x: pl.x + fx * 5, y: pl.y - 6 + fy * 4, r: 50, color: '226,234,255', i: 0.95 }); lights.push({ x: pl.x + fx * 22, y: pl.y - 6 + fy * 18, r: 30, color: '226,234,255', i: 0.45 }); }   // the phone's LED: a small cool pool of light around you (js/game/phonehd.js)
    if (!torch && dark > 0.05 && !(pitch > 0.5)) lights.push({ x: pl.x, y: pl.y - 8, r: night ? (pl.inventory.has('torch') ? 28 : 13) : 34, color: night && pl.inventory.has('torch') ? '255,180,110' : '150,160,190', self: true, i: 0.75 });
    const white = amb[0] > 252 && amb[1] > 252 && amb[2] > 250;
    if (white && !night && dark < 0.01 && !lights.some((l) => !l.self && l.color) && !(scene.vehicles || []).some((v) => v.sirenOn || v.lightsOn || v.chase)) return;
    // draw the light map at a fraction of the resolution (light is soft anyway)
    const div = G.gfxLevel().lightDiv, lw = Math.ceil(R.W / div), lh = Math.ceil(R.H / div), k = R.zoom / div;
    const lc = scene.lightCanvas, lx = scene.lightCtx;
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = 'source-over';
    lx.fillStyle = `rgb(${rgb(amb)})`;
    lx.fillRect(0, 0, lw, lh);
    lx.globalCompositeOperation = 'lighter';
    const cam = R.cam, t = scene.time;
    const toL = (x, y) => [(x - cam.x - cam.sx) * k, (y - cam.y - cam.sy) * k];
    const glows = [];
    const strength = Math.max(0.35, dark);
    for (const l of lights) {
      const [sx, sy] = toL(l.x, l.y);
      const r = l.r * k * (l.flicker ? 0.9 + Math.sin(t * 13 + l.x) * 0.05 + Math.random() * 0.05 : 1);
      if (sx < -r || sy < -r || sx > lw + r || sy > lh + r) continue;
      radial(lx, sx, sy, r, l.color || '255,220,160', (l.i || 1) * (l.self ? 0.8 : 1));
      if (!l.self && night) glows.push({ x: sx * div, y: sy * div, r: r * div, color: l.color || '255,220,160', i: l.i || 1 });
    }
    // flashlight: a cone of light where you look, with soft edges and a little spill
    if (torch) {
      const [fx, fy] = G.util.DIR_VEC[pl.dir];
      const target = Math.atan2(fy, fx);
      if (this.flashAng == null) this.flashAng = target;
      let d = target - this.flashAng; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.flashAng += d * Math.min(1, (this._dt || 0.016) * 14);
      const [sx, sy] = toL(pl.x + fx * 3, pl.y - 7);
      radial(lx, sx, sy, 30 * k, '255,240,215', 0.55);
      for (const [spread, i] of [[0.22, 0.45], [0.36, 0.4], [0.5, 0.2]]) cone(lx, sx, sy, this.flashAng, 125 * k, spread, '255,246,224', i);
    }
    // police light bars: red and blue, alternating
    for (const v of scene.vehicles || []) {
      if (!(v.sirenOn || v.lightsOn || v.chase)) continue;
      const ph = Math.floor(t * 6) % 2, [sx, sy] = toL(v.x, v.y - 4);
      radial(lx, sx - 3 * k, sy, 34 * k, ph ? '255,40,40' : '40,40,90', ph ? 0.8 : 0.2);
      radial(lx, sx + 3 * k, sy, 34 * k, ph ? '40,40,90' : '40,90,255', ph ? 0.2 : 0.8);
      glows.push({ x: sx * div, y: sy * div, r: 28 * k * div, color: ph ? '255,50,50' : '60,110,255', i: 1.4 });
    }
    // headlights and tail lights
    if (night) for (const v of scene.vehicles || []) {
      if (v.wrecked || v.dead || !(v.driver || v.ai) || (v.m && v.m.bike)) continue;
      const c = Math.cos(v.angle), s = Math.sin(v.angle), L = v.L, Wd = v.Wd;
      for (const side of (v.m && v.m.moto ? [0] : [-0.6, 0.6])) {
        const [hx, hy] = toL(v.x + c * L - s * Wd * side, v.y + s * L + c * Wd * side);
        cone(lx, hx, hy, v.angle, 105 * k, 0.26, '255,244,212', 0.55);
        radial(lx, hx, hy, 8 * k, '255,250,230', 0.8);
        const [rx, ry] = toL(v.x - c * L - s * Wd * side, v.y - s * L + c * Wd * side);
        radial(lx, rx, ry, 10 * k, '255,30,20', 0.55);
      }
    }
    lx.globalCompositeOperation = 'source-over';
    R.screenTransform();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0, lw, lh, 0, 0, lw * div, lh * div);
    // bloom: bright sources bleed a little light into the air around them
    ctx.globalCompositeOperation = 'lighter';
    for (const g0 of glows) {
      const r = g0.r * 0.6, g = ctx.createRadialGradient(g0.x, g0.y, 0, g0.x, g0.y, r);
      g.addColorStop(0, `rgba(${g0.color},${(0.3 * strength * Math.min(1, g0.i)).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(${g0.color},${(0.1 * strength * Math.min(1, g0.i)).toFixed(3)})`);
      g.addColorStop(1, `rgba(${g0.color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(g0.x - r, g0.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  },

  // ------------------------------------------------------------ over everything (before HUD)
  post(ctx, scene) {
    const R = G.renderer, W = G.weather, out = this.outdoorMap(scene), dt = this._dt || 0.016;
    const amb = this.amb || [255, 255, 255];
    const lum = (amb[0] + amb[1] + amb[2]) / 765;
    R.screenTransform();
    const pb = scene.map.buildingAt(scene.player.x, scene.player.y - 3);
    const inside = pb ? 1 - pb.roofAlpha : 0;
    // fog banks rolling through
    if (W && out && G.gfx('weather') && W.fog > 0.02) {
      const tex = this.fogTex || (this.fogTex = cloudTex(311, 128, 0.7));
      const fc = mix3([40, 46, 62], [222, 226, 232], lum);
      const tint = this.fogTint || (this.fogTint = document.createElement('canvas'));
      if (tint.width !== 128 || this._fogC !== rgb(fc)) {
        tint.width = tint.height = 128; const x = tint.getContext('2d');
        x.clearRect(0, 0, 128, 128); x.drawImage(tex, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${rgb(fc)})`; x.fillRect(0, 0, 128, 128);
        this._fogC = rgb(fc);
      }
      // composed at 1/8 resolution, then stretched once over the screen (fog has no sharp edges)
      const fw = Math.ceil(R.W / 8), fh = Math.ceil(R.H / 8);
      const fcv = this.fogCanvas || (this.fogCanvas = document.createElement('canvas'));
      if (fcv.width !== fw || fcv.height !== fh) { fcv.width = fw; fcv.height = fh; }
      const fx = fcv.getContext('2d');
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.globalAlpha = 1;
      fx.clearRect(0, 0, fw, fh);
      fx.fillStyle = `rgba(${rgb(fc)},0.28)`;
      fx.fillRect(0, 0, fw, fh);
      fx.imageSmoothingEnabled = true;
      const S = fh * 2.2, cam = R.cam, z = R.zoom / 8;
      for (const [sp, a] of [[0.6, 0.45], [1, 0.35]]) {
        fx.globalAlpha = a;
        const ox = ((-(cam.x * z * sp) - scene.time * 14 * sp * z) % S + S) % S - S, oy = ((-(cam.y * z * sp)) % S + S) % S - S;
        for (let y = oy; y < fh; y += S) for (let x = ox; x < fw; x += S) fx.drawImage(tint, x, y, S, S);
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, W.fog * (1 - inside * 0.7));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fcv, 0, 0, fw, fh, 0, 0, fw * 8, fh * 8);
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }
    // rain streaks, slanted by the wind
    const rain = W && out && G.gfx('weather') ? W.rain * (1 - inside * 0.75) : 0;
    const want = Math.round(rain * G.gfxLevel().rain * (R.W * R.H) / (1280 * 720));
    const D = this.drops, sc = R.H / 720;
    while (D.length < want) D.push({ x: Math.random() * R.W, y: Math.random() * R.H, l: (12 + Math.random() * 14) * sc, v: (1100 + Math.random() * 500) * sc });
    if (D.length > want) D.length = want;
    if (D.length) {
      const slant = 0.12 + (G.breeze ? G.breeze.dx * 0.3 : 0);
      ctx.strokeStyle = `rgba(${rgb(mix3([70, 80, 100], [205, 215, 230], lum))},${(0.22 + 0.2 * rain).toFixed(2)})`;
      ctx.lineWidth = Math.max(1, sc);
      ctx.beginPath();
      for (const d of D) {
        d.y += d.v * dt; d.x += d.v * slant * dt;
        if (d.y > R.H) { d.y = -d.l; d.x = Math.random() * R.W * 1.2 - R.W * 0.1; }
        if (d.x > R.W) d.x -= R.W; else if (d.x < 0) d.x += R.W;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * slant, d.y - d.l);
      }
      ctx.stroke();
    }
    // lightning
    if (W && out && G.gfx('weather') && W.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${(W.flash * 0.35 * (1 - inside * 0.6)).toFixed(3)})`; ctx.fillRect(0, 0, R.W, R.H); }
    // a lens vignette (the last thing drawn here)
    if (!G.gfx('vignette')) return;
    const v = this.vig;
    if (!v || v.width !== R.W || v.height !== R.H) {
      const c = this.vig = document.createElement('canvas'); c.width = R.W; c.height = R.H;
      const x = c.getContext('2d'), g = x.createRadialGradient(R.W / 2, R.H / 2, R.H * 0.35, R.W / 2, R.H / 2, Math.hypot(R.W, R.H) * 0.58);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
      x.fillStyle = g; x.fillRect(0, 0, R.W, R.H);
    }
    ctx.drawImage(this.vig, 0, 0);
  },
};

function radial(x, sx, sy, r, color, i) {
  const g = x.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, `rgba(${color},${Math.min(1, i).toFixed(3)})`);
  g.addColorStop(0.22, `rgba(${color},${(i * 0.66).toFixed(3)})`);
  g.addColorStop(0.5, `rgba(${color},${(i * 0.3).toFixed(3)})`);
  g.addColorStop(0.78, `rgba(${color},${(i * 0.09).toFixed(3)})`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(sx - r, sy - r, r * 2, r * 2);
}
function cone(x, sx, sy, ang, len, spread, color, i) {
  x.save();
  x.beginPath(); x.moveTo(sx, sy); x.arc(sx, sy, len, ang - spread, ang + spread); x.closePath(); x.clip();
  const g = x.createRadialGradient(sx, sy, 0, sx, sy, len);
  g.addColorStop(0, `rgba(${color},${i.toFixed(3)})`);
  g.addColorStop(0.25, `rgba(${color},${(i * 0.85).toFixed(3)})`);
  g.addColorStop(0.65, `rgba(${color},${(i * 0.35).toFixed(3)})`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(sx - len, sy - len, len * 2, len * 2);
  x.restore();
}
// convex hull (monotone chain) for building shadows
function hull(p) {
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// the new light replaces the old one (Settings > Graphics > Dynamic Lighting off keeps the plain one)
const GS = G.GameScene.prototype, _rl = GS.renderLighting;
GS.renderLighting = function (ctx) {
  if (!G.gfx('lighting')) return _rl.call(this, ctx);
  try { G.visuals.renderLighting(ctx, this); } catch (e) { _rl.call(this, ctx); }
};

// ------------------------------------------------------------ baked ground detail
// soft contact shadow at the foot of walls and along their sides (ambient occlusion)
const TM = G.TileMap.prototype, _dti = TM.drawTileInto;
TM.drawTileInto = function (x, tx, ty, withExtras = true) {
  _dti.call(this, x, tx, ty, withExtras);
  const T = G.TILES, def = T[this.get(tx, ty)];
  if (!def || def.solid || def.water) return;
  const tall = (d) => d && (d.wall || d.name === 'citywall' || d.name === 'cliff');
  const X = tx * 16, Y = ty * 16;
  if (ty > 0 && tall(T[this.get(tx, ty - 1)])) {
    const g = x.createLinearGradient(0, Y, 0, Y + 9);
    g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(X, Y, 16, 9);
  }
  if (tx > 0 && tall(T[this.get(tx - 1, ty)])) {
    const g = x.createLinearGradient(X, 0, X + 5, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(X, Y, 5, 16);
  }
  if (tx < this.w - 1 && tall(T[this.get(tx + 1, ty)])) {
    const g = x.createLinearGradient(X + 16, 0, X + 11, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(X + 11, Y, 5, 16);
  }
};

// ------------------------------------------------------------ richer terrain textures
// Same tile names, counts and sizes as the originals in assets.js, which these replace.
const HI = {};
function tileSet(name, count, fn) {
  const arr = [];
  for (let v = 0; v < count; v++) {
    const { c, x } = A.mk(16, 16);
    fn(x, new G.RNG(G.util.hashString(name + '_hd') + v * 7919), v);
    arr.push(c);
  }
  HI[name] = arr;
}
const P = (x, px, py, col) => { x.fillStyle = col; x.fillRect(((px % 16) + 16) % 16, ((py % 16) + 16) % 16, 1, 1); };
const Rc = (x, px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
const sh = A.shade;

function grass(x, r, pal, extra) {
  Rc(x, 0, 0, 16, 16, pal.base);
  for (let i = 0; i < 80; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(pal.mid));
  for (let i = 0; i < 24; i++) {   // blades: a dark root, a body, a sunlit tip
    const px = r.int(0, 15), py = r.int(0, 15), hgt = r.int(1, 3), col = r.pick(pal.blade);
    P(x, px, py + 1, pal.shadow);
    for (let k = 0; k < hgt; k++) P(x, px + (k === hgt - 1 && r.chance(0.3) ? 1 : 0), py - k, col);
    P(x, px, py - hgt, pal.tip);
  }
  if (extra) extra(x, r);
}
function genHD() {
  const G1 = { base: '#4a8a38', mid: ['#528f3d', '#438232', '#4d8c3a', '#3f7a30', '#56933f'], blade: ['#5fa447', '#68ad4e', '#57993f'], tip: '#80c25e', shadow: '#376a2a' };
  tileSet('grass', 4, (x, r, v) => grass(x, r, G1, v === 3 ? (x2, r2) => { for (let i = 0; i < 3; i++) { const px = r2.int(1, 14), py = r2.int(1, 14), c = r2.pick(['#f4f0d8', '#f2d45c', '#d8708a', '#b8a0e8']); P(x2, px, py, c); P(x2, px, py + 1, '#2f5f24'); } } : v === 2 ? (x2, r2) => { const px = r2.int(2, 12), py = r2.int(3, 12); P(x2, px, py, '#8a8578'); P(x2, px + 1, py, '#a09a8c'); P(x2, px, py + 1, '#5a564c'); } : null));
  const G2 = { base: '#2e5a2a', mid: ['#33622e', '#284f25', '#2c5528', '#376630'], blade: ['#3d7236', '#447a3c', '#386b32'], tip: '#58904a', shadow: '#1f3f1c' };
  tileSet('darkgrass', 4, (x, r, v) => grass(x, r, G2, v === 3 ? (x2, r2) => { P(x2, r2.int(2, 13), r2.int(2, 13), '#b0473a'); P(x2, r2.int(2, 13), r2.int(2, 13), '#8a6a3a'); } : null));
  tileSet('dirt', 3, (x, r) => {
    Rc(x, 0, 0, 16, 16, '#82603c');
    for (let i = 0; i < 70; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(['#8e6c45', '#765636', '#6d4f31', '#8a6842']));
    for (let i = 0; i < 4; i++) { const px = r.int(0, 15), py = r.int(0, 15), c = r.pick(['#9a8466', '#7e7262', '#a89478']); P(x, px, py, c); P(x, px + 1, py, sh(c, 0.85)); P(x, px, py + 1, '#5a4028'); }
  });
  tileSet('sand', 3, (x, r) => {
    Rc(x, 0, 0, 16, 16, '#d8c38c');
    for (let y = 0; y < 16; y++) for (let xx = 0; xx < 16; xx++) {   // wind ripples (tileable)
      const s = Math.sin((xx / 16 + y / 8) * Math.PI * 2 + Math.sin(xx / 16 * Math.PI * 2) * 0.6);
      if (s > 0.82) P(x, xx, y, '#e6d4a2'); else if (s < -0.86) P(x, xx, y, '#c9b27c');
    }
    for (let i = 0; i < 30; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(['#e3d09c', '#cdb67e', '#d2bc84', '#bfa874']));
    if (r.chance(0.4)) { const px = r.int(2, 13), py = r.int(2, 13); P(x, px, py, '#f2ece0'); P(x, px + 1, py, '#e0d4c0'); }
  });
  const asphalt = (x, r) => {
    Rc(x, 0, 0, 16, 16, '#3c3d42');
    for (let i = 0; i < 70; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(['#444549', '#36373b', '#47484d', '#333438']));
    for (let i = 0; i < 6; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(['#55565b', '#5c5d62', '#2c2d31']));
  };
  tileSet('asphalt', 4, (x, r, v) => {
    asphalt(x, r);
    if (v === 3) {   // a crack, with a lighter broken edge
      let px = r.int(0, 5), py = r.int(3, 12);
      const end = px + r.int(5, 9); while (px < end) { P(x, px, py, '#2f3034'); px++; if (r.chance(0.4)) py += r.pick([-1, 1]); }
    } else if (v === 2) {   // an old oil stain
      x.fillStyle = 'rgba(20,18,26,0.35)'; x.beginPath(); x.ellipse(r.int(5, 11), r.int(5, 11), r.int(2, 4), r.int(1, 3), 0, 0, Math.PI * 2); x.fill();
    }
  });
  tileSet('road_line', 2, (x, r) => { asphalt(x, r); Rc(x, 2, 0, 7, 1, '#e2c444'); Rc(x, 2, 1, 7, 1, '#b89a30'); P(x, r.int(2, 8), 0, '#9a8a50'); });
  tileSet('road_line_v', 2, (x, r) => { asphalt(x, r); Rc(x, 0, 2, 1, 7, '#e2c444'); Rc(x, 1, 2, 1, 7, '#b89a30'); P(x, 0, r.int(2, 8), '#9a8a50'); });
  tileSet('sidewalk', 3, (x, r, v) => {
    // four slabs, each with a bevel, a tone of its own and worn speckle; joints between them
    for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
      const base = r.pick(['#a8a49c', '#aca8a0', '#a4a098', '#b0aca4']);
      Rc(x, sx, sy, 8, 8, base);
      for (let i = 0; i < 9; i++) P(x, sx + r.int(1, 7), sy + r.int(1, 7), r.pick([sh(base, 1.05), sh(base, 0.94)]));
      Rc(x, sx + 1, sy + 1, 6, 1, sh(base, 1.07)); Rc(x, sx + 1, sy + 1, 1, 6, sh(base, 1.04));
      Rc(x, sx + 1, sy + 7, 7, 1, sh(base, 0.93));
    }
    Rc(x, 0, 0, 16, 1, '#86827a'); Rc(x, 0, 0, 1, 16, '#86827a'); Rc(x, 0, 8, 16, 1, '#928e86'); Rc(x, 8, 0, 1, 16, '#928e86');
    if (v === 2) { P(x, r.int(10, 14), r.int(10, 14), '#5a5650'); P(x, r.int(2, 6), r.int(2, 6), '#6a6660'); }   // gum
    if (v === 1) { let px = r.int(1, 6), py = r.int(9, 10); for (let i = 0; i < 6; i++) { P(x, px, py, '#8a867e'); px++; if (r.chance(0.5)) py++; } }
  });
  tileSet('concrete', 3, (x, r) => {
    Rc(x, 0, 0, 16, 16, '#8a8780');
    for (let i = 0; i < 80; i++) P(x, r.int(0, 15), r.int(0, 15), r.pick(['#918e87', '#827f78', '#7c7972', '#8e8b84']));
    x.fillStyle = 'rgba(60,55,50,0.08)'; x.beginPath(); x.ellipse(r.int(3, 13), r.int(3, 13), r.int(2, 5), r.int(2, 4), 0, 0, Math.PI * 2); x.fill();
    Rc(x, 0, 0, 16, 1, '#74716a'); Rc(x, 0, 1, 16, 1, '#96938c');
  });
  tileSet('dock', 2, (x, r) => {   // weathered planks; the gaps between them are deep shadow, not bright water
    Rc(x, 0, 0, 16, 16, '#14202e');
    for (let y = 0; y < 16; y += 4) {
      const col = r.pick(['#8a6338', '#94693c', '#7f5a32', '#86603a']);
      Rc(x, 0, y, 16, 3, col);
      Rc(x, 0, y, 16, 1, sh(col, 1.12));
      for (let g = 0; g < 2; g++) Rc(x, r.int(0, 12), y + 1, r.int(3, 6), 1, sh(col, 0.88));
      P(x, 2, y + 1, '#3e2a16'); P(x, 13, y + 1, '#3e2a16');   // nails
      Rc(x, 0, y + 3, 16, 1, '#1e2a36');
    }
  });
  tileSet('woodfloor', 2, (x, r) => {
    for (let row = 0; row < 4; row++) {
      const col = r.pick(['#8a5a30', '#93633a', '#7f5229', '#875830']), y = row * 4;
      Rc(x, 0, y, 16, 4, col);
      for (let g = 0; g < 3; g++) { const gy = y + r.int(0, 2), gx = r.int(0, 15), len = r.int(3, 8); Rc(x, gx, gy, Math.min(len, 16 - gx), 1, sh(col, r.pick([0.9, 1.08]))); }
      Rc(x, 0, y, 16, 1, sh(col, 1.1));   // varnish catches the light
      Rc(x, 0, y + 3, 16, 1, '#5a381b');
      const jx = (r.int(0, 15) + row * 5) % 16;
      Rc(x, jx, y, 1, 3, '#5e3b1d'); P(x, jx + 1, y + 1, sh(col, 1.15));
      if (r.chance(0.5)) P(x, r.int(1, 14), y + 2, sh(col, 0.7));   // a knot
    }
  });
  // water: layered, tileable waves moving across four frames
  for (const [name, base, lo, hi, top] of [['water', '#2a64a3', '#225690', '#3d7cbd', '#6aa4dc'], ['deepwater', '#1e4b80', '#183f6c', '#2c5f98', '#4c82bc']]) {
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const { c, x } = A.mk(16, 16);
      Rc(x, 0, 0, 16, 16, base);
      const ph = f * Math.PI / 2;
      for (let y = 0; y < 16; y++) for (let xx = 0; xx < 16; xx++) {
        const a = Math.sin((xx / 16 * 2 + y / 8) * Math.PI * 2 - ph) + 0.6 * Math.sin((xx / 8 - y / 16) * Math.PI * 2 + ph);
        if (a > 1.5) P(x, xx, y, top); else if (a > 1.15) P(x, xx, y, hi); else if (a < -1.3) P(x, xx, y, lo);
      }
      frames.push(c);
    }
    HI[name] = frames;
  }
}

G.visuals.hiNames = () => Object.keys(HI);   // (js/game/hdart.js leaves these to the bespoke textures)
G.visuals.applyTextures = function () {
  if (!Object.keys(HI).length) genHD();
  Object.assign(A.tiles, HI);
};
const _init = A.init;
A.init = function () { _init.call(this); G.visuals.applyTextures(); };
})();

// ---------------------------------------------------------------- detailed furniture
// Every piece of furniture (anything placed inside a building) gets a pixel-exact detail pass: light from
// the top left, rim light on its top edges and a contact shade at its foot; wood gets grain and the odd
// knot, cloth a fine weave, white goods and metal a soft gradient and a highlight.
(() => {
const A = G.assets;
const toHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
function detail(spr, seed) {
  const c = spr.img, w = c.width, h = c.height;
  if (!spr.orig) { const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, 0, 0); spr.orig = o; }
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h); x.drawImage(spr.orig, 0, 0);
  const img = x.getImageData(0, 0, w, h), d = img.data, src = new Uint8ClampedArray(d);
  const a = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : src[(py * w + px) * 4 + 3]);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = (py * w + px) * 4;
    if (src[i + 3] < 40) continue;
    const r = src[i], g = src[i + 1], b = src[i + 2];
    if (r < 40 && g < 34 && b < 44) continue;   // the outline stays
    const [hue, sat, lum] = toHsl(r, g, b);
    let f = 1 + 0.1 * (1 - py / h) - 0.07 * (px / w);   // light from the top left
    if (hue >= 12 && hue <= 48 && sat > 0.22 && lum > 0.12 && lum < 0.62) {   // wood: grain and knots
      f *= 1 + 0.07 * Math.sin((py + 2.5 * Math.sin(px * 0.6 + seed)) * 1.9);
      if (((px * 7 + py * 13 + seed) % 53) === 0) f *= 0.82;
    } else if (sat < 0.12 && lum > 0.55) {   // white goods, porcelain, metal
      f *= 1 - 0.1 * (py / h);
      if (py < h * 0.3 && px < w * 0.45) f *= 1.06;
    } else if (sat > 0.28) f *= ((px + py) & 1) ? 1.035 : 0.97;   // cloth: a fine weave
    if (!a(px, py - 1)) f *= 1.14;          // rim light on top edges
    else if (!a(px, py + 1)) f *= 0.84;     // the underside
    if (py >= h - 2) f *= 0.9;              // contact shade at the foot
    d[i] = r * f; d[i + 1] = g * f; d[i + 2] = b * f;
  }
  x.putImageData(img, 0, 0);
  spr.detailed = true;
}

G.visuals.detailFurniture = function (map) {
  for (const dc of map.decor) {
    const s = A.sprites[dc.def.sprite];
    if (!s || s.detailed || s.hd || /oak|pine|palm|bush|tree|tuft|flower|lamp|rock|stump/.test(dc.type)) continue;
    if (!map.buildingAt(dc.x, dc.y - 2) && !(map.meta && (map.meta.indoor || map.meta.floorOf))) continue;
    detail(s, G.util.hashString(dc.def.sprite) % 97);
  }
};
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawn, pos) { const r = _load.call(this, id, spawn, pos); try { G.visuals.detailFurniture(this.map); } catch (e) { /* plain is fine */ } return r; };
})();
