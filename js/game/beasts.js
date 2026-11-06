'use strict';
// Dogs, cats, horses and donkeys; pets, mounts and your own livestock.
//   Strays: a few dogs and cats live on the streets of the city districts. [E] on one: pet it, or give it
//   what it eats (dogs: raw meat or a burger; cats: fish). Each kindness fills its trust bar (shown over
//   it). Full: it is yours. You name it, and from then on it follows you everywhere (map to map), comes when
//   you walk off, and you can pet it, feed it (only what it eats), tell it to stay or to follow.
//   The stable (Farmland, next to the Rancher's house): the Rancher sells horses, donkeys, cows and chickens.
//   Horses and donkeys: [E] to ride (and [E] again to get off). Riding is fast (a horse at a gallop when you
//   run, a donkey slower but steady); you sit in the saddle, the animal walks, trots and gallops under you.
//   Feed them apples, carrots or wheat. Cows give milk and chickens eggs, once a day each; "Follow me" leads
//   them (to your own fenced farm), "Stay here" settles them where they are.
//   Every animal here is drawn live in the HD side view: bodies with light and shade, legs that move in
//   a real gait (walk, trot, gallop), wagging tails, flicking ears, breathing.
(() => {
const A = G.assets, AN = G.Animal.prototype, sh = (c, f) => A.shade(c, f);
Object.assign(G.ANIMALS, {
  dog: { name: 'Dog', color: '#8a6a4a', hp: 22, speed: 74, behavior: 'docile', sight: 40, w: 10, h: 5, base: 'wolf', drops: [['raw_meat', 1, 1, 1]], eats: ['raw_meat', 'cooked_meat', 'meat_stew'], beast: true },
  cat: { name: 'Cat', color: '#c8843a', hp: 12, speed: 80, behavior: 'docile', sight: 40, w: 8, h: 4, base: 'rabbit', drops: [], eats: ['fish', 'cooked_fish', 'fish_bluegill', 'fish_bass', 'fish_catfish', 'fish_trout', 'fish_carp', 'fish_pike', 'fish_snapper', 'fish_tuna'], beast: true },
  horse: { name: 'Horse', color: '#7a4a2a', hp: 70, speed: 64, behavior: 'docile', sight: 30, w: 16, h: 7, base: 'deer', drops: [['raw_meat', 3, 5, 1]], eats: ['apple', 'carrot', 'wheat', 'corn', 'cabbage_head'], beast: true, mount: { walk: 1.9, run: 2.9, back: 12 } },
  donkey: { name: 'Donkey', color: '#8a7e72', hp: 55, speed: 50, behavior: 'docile', sight: 30, w: 14, h: 6, base: 'deer', drops: [['raw_meat', 2, 4, 1]], eats: ['apple', 'carrot', 'wheat', 'corn', 'cabbage_head'], beast: true, mount: { walk: 1.6, run: 2.1, back: 9 } },
});
// the classic sheet (used by old code paths) borrows a similar animal's
const _an = A.animal;
A.animal = function (kind, color, opt) { const d = G.ANIMALS[kind]; return _an.call(this, d && d.base ? d.base : kind, color, opt); };
const COATS = {
  dog: [['#8a6a4a', '#5a4230'], ['#2a2420', '#1a1614'], ['#c8a070', '#9a7a50'], ['#e8e4dc', '#8a7a6a'], ['#6a5a50', '#3a3230']],
  cat: [['#c8843a', '#8a5a2a'], ['#2a2628', '#121014'], ['#8a8a92', '#5a5a62'], ['#e8e0d0', '#c8843a'], ['#6a5a4a', '#3a2e24']],
  horse: [['#7a4a2a', '#2a1a12'], ['#9a5a2a', '#6a3a1a'], ['#2a2224', '#121012'], ['#d8d4cc', '#a8a4a0'], ['#d8b070', '#f0e8d0']],
  donkey: [['#8a7e72', '#4a4038'], ['#6a5e54', '#3a322c'], ['#a89a8a', '#5a5048']],
};
const coatOf = (species, seed) => { const list = COATS[species] || [['#888', '#555']]; return list[G.util.hashString(String(seed)) % list.length]; };

// ---------------------------------------------------------------- drawing (side view, facing right; mirrored for left)
const E = (ctx, x, y, rx, ry, c, rot = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill(); };
const L = (ctx, x0, y0, x1, y1, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
// a leg: hip at (x, y), swing angle a, length l; the lower leg bends back when it lifts
function leg(ctx, x, y, a, l, w, c, hoof, lift) {
  const kx = x + Math.sin(a) * l * 0.52, ky = y + Math.cos(a) * l * 0.52;
  const b = a - Math.max(0, lift) * 1.1, fx = kx + Math.sin(b) * l * 0.5, fy = Math.min(y + l, ky + Math.cos(b) * l * 0.5);
  L(ctx, x, y, kx, ky, w, c); L(ctx, kx, ky, fx, fy, w * 0.8, c);
  if (hoof) E(ctx, fx + 0.3, fy, w * 0.55, w * 0.35, hoof);
}
// gait: speed (px/s) -> how the four legs move (phase offsets: walk = four-beat, gallop = gathered pairs)
function gait(st, speed) {
  const g = speed > 95 ? 'gallop' : speed > 45 ? 'trot' : speed > 3 ? 'walk' : 'stand';
  const off = g === 'gallop' ? [0, 0.12, 0.5, 0.62] : g === 'trot' ? [0, 0.5, 0.5, 0] : [0, 0.5, 0.25, 0.75];
  const amp = g === 'gallop' ? 0.75 : g === 'trot' ? 0.5 : g === 'walk' ? 0.36 : 0;
  return { g, off, amp };
}
function drawBeast(ctx, b, x, y, face, phase, speed, t, o = {}) {
  const sp = b.species, [coat, dark] = b.coat || coatOf(sp, b.rid || b.id || sp), lt = sh(coat, 1.22), sd = sh(coat, 0.72);
  const { g, off, amp } = gait(null, speed);
  const swing = (i) => (amp ? Math.sin((phase + off[i]) * Math.PI * 2) * amp : 0), lift = (i) => (amp ? Math.max(0, Math.cos((phase + off[i]) * Math.PI * 2)) * (g === 'gallop' ? 0.9 : 0.6) : 0);
  const bob = g === 'gallop' ? Math.sin(phase * Math.PI * 4) * 1.2 : g === 'trot' ? Math.abs(Math.sin(phase * Math.PI * 2)) * 0.8 : g === 'walk' ? Math.sin(phase * Math.PI * 4) * 0.3 : Math.sin(t * 1.6) * 0.25;
  ctx.save(); ctx.translate(Math.round(x * 2) / 2, Math.round(y * 2) / 2);
  E(ctx, 0, 0.5, sp === 'horse' ? 11 : sp === 'donkey' ? 9.5 : sp === 'dog' ? 6.5 : 5, sp === 'horse' || sp === 'donkey' ? 2.4 : 1.6, 'rgba(0,0,0,0.28)');   // shadow
  if (!face) ctx.scale(-1, 1);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (sp === 'horse' || sp === 'donkey') {
    const big = sp === 'horse', H = big ? 13 : 10.5, Lg = big ? 9 : 7.5, BL = big ? 9 : 7.5, by = -H - bob;
    const mane = big ? dark : sh(coat, 0.6);
    // far legs
    leg(ctx, -BL + 1.5, by + 3, swing(1), Lg + 1.5, 1.9, sd, '#1a1614', lift(1)); leg(ctx, BL - 2, by + 3, swing(3), Lg + 1.5, 1.9, sd, '#1a1614', lift(3));
    // tail
    const tw = Math.sin(t * 2.2) * 0.25 + (g !== 'stand' ? -0.4 : 0);
    if (big) { ctx.strokeStyle = dark; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-BL - 1.5, by - 0.5); ctx.quadraticCurveTo(-BL - 4, by + 3 + tw * 3, -BL - 3 + tw * 2, by + 9); ctx.stroke(); }
    else { L(ctx, -BL - 1, by, -BL - 2.5 + tw, by + 6, 0.9, sd); E(ctx, -BL - 2.6 + tw, by + 6.8, 0.8, 1.4, dark); }
    // body: barrel, rump, chest, with a lit back and a shaded belly
    E(ctx, 0, by + 2.5, BL + 1.2, big ? 4.6 : 4.1, sd); E(ctx, 0, by + 1.8, BL + 0.8, big ? 4.1 : 3.6, coat);
    E(ctx, -BL + 1.5, by + 1.5, big ? 4.2 : 3.6, big ? 4.2 : 3.6, coat); E(ctx, BL - 1.5, by + 2, big ? 3.8 : 3.3, big ? 4.2 : 3.6, coat);
    E(ctx, -1, by - 1, BL - 1, 1.3, lt); E(ctx, 0, by + 5.4, BL - 2, 1, sh(coat, 0.62));
    if (sp === 'donkey') { E(ctx, 0, by + 5, BL - 2.5, 1.3, '#d8d0c4'); L(ctx, -2, by - 2.6, 3, by - 2.4, 0.8, sh(coat, 0.55)); }   // pale belly, the dark stripe
    // neck and head (head down a little when it walks, up at a gallop)
    const nod = g === 'walk' ? Math.sin(phase * Math.PI * 4) * 0.6 : g === 'stand' ? Math.sin(t * 0.7) * 0.4 : 0;
    const nx = BL + 1, ny = by - 1, hx = nx + (big ? 5.5 : 4.5), hy = ny - (big ? 7 : 5.5) + nod;
    ctx.fillStyle = coat; ctx.beginPath(); ctx.moveTo(nx - 2.5, ny + 3); ctx.lineTo(nx + 1.5, ny + 3.5); ctx.lineTo(hx + 1, hy + 2); ctx.lineTo(hx - 2.2, hy - 0.5); ctx.closePath(); ctx.fill();
    L(ctx, nx - 1.5, ny + 1, hx - 1.5, hy + 0.5, 1.2, lt);
    E(ctx, hx + 1, hy + 1.2, big ? 3.6 : 3.2, big ? 1.9 : 1.8, coat, 0.45); E(ctx, hx + 3.6, hy + 3, 1.4, 1.2, sh(coat, 0.8));   // head, muzzle
    if (sp === 'donkey') E(ctx, hx + 3.6, hy + 3, 1.3, 1.1, '#d8d0c4');
    E(ctx, hx + 0.9, hy + 0.2, 0.5, 0.45, '#120c0a'); E(ctx, hx + 0.75, hy, 0.18, 0.18, '#ffffff');   // eye
    const ear = Math.sin(t * 1.3) > 0.9 ? 0.3 : 0, el = big ? 2.4 : 4.6;
    L(ctx, hx - 0.8, hy - 1, hx - 1.4 - ear, hy - 1 - el, big ? 1 : 1.3, sd); if (!big) E(ctx, hx - 1.5 - ear, hy - 1 - el, 0.5, 0.5, dark);
    if (big) { ctx.strokeStyle = mane; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(nx - 2.5, ny + 0.5); ctx.quadraticCurveTo(nx, ny - 3 + (g === 'gallop' ? Math.sin(t * 9) : 0), hx - 1.6, hy - 0.8); ctx.stroke(); }
    else L(ctx, nx - 2, ny + 0.5, hx - 1.5, hy - 0.5, 0.9, mane);
    if (o.saddle) { E(ctx, -0.5, by - 0.8, 3.6, 1.6, '#4a2a16'); E(ctx, -0.5, by - 1.2, 3, 1, '#6a3e22'); L(ctx, -0.5, by, -0.5, by + 4.5, 0.6, '#3a2010'); E(ctx, -0.5, by + 5, 0.7, 0.5, '#9aa0aa'); }   // saddle, girth, stirrup
    // near legs
    leg(ctx, -BL + 2, by + 3.5, swing(0), Lg + 1.5, 2.1, coat, '#1a1614', lift(0)); leg(ctx, BL - 1.5, by + 3.5, swing(2), Lg + 1.5, 2.1, coat, '#1a1614', lift(2));
  } else {
    const dog = sp === 'dog', H = dog ? 6 : 4.2, Lg = dog ? 4.6 : 3.3, BL = dog ? 4.2 : 3.4, by = -H - bob * 0.6;
    const happy = b.happyT > 0 || b.pet;
    leg(ctx, -BL + 1, by + 1.5, swing(1), Lg, 1.2, sd, null, lift(1)); leg(ctx, BL - 1, by + 1.5, swing(3), Lg, 1.2, sd, null, lift(3));
    // tail: a dog wags when happy; a cat's stands up and curls at the tip
    if (dog) { const wag = happy ? Math.sin(t * 16) * 0.9 : Math.sin(t * 1.5) * 0.2; L(ctx, -BL - 0.5, by - 0.5, -BL - 3.2, by - 2.6 + wag * 1.5, 1.1, coat); }
    else { const s2 = Math.sin(t * 1.8) * 0.6; ctx.strokeStyle = coat; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-BL - 0.3, by); ctx.quadraticCurveTo(-BL - 2.5, by - 2, -BL - 1.6 + s2, by - 5); ctx.stroke(); }
    E(ctx, 0, by + 0.8, BL + 0.8, dog ? 2.6 : 2, sd); E(ctx, 0, by + 0.4, BL + 0.5, dog ? 2.3 : 1.8, coat); E(ctx, -0.5, by - 0.9, BL - 0.8, 0.7, lt);
    if (sp === 'cat' && b.coat && b.coat[1] !== sd) for (let i = -2; i <= 2; i++) L(ctx, i * 1.3, by - 1.5, i * 1.3 - 0.3, by + 0.5, 0.45, b.coat[1]);   // tabby stripes
    const hx = BL + (dog ? 1.8 : 1.3), hy = by - (dog ? 2.6 : 2) + (g === 'stand' ? Math.sin(t * 0.9) * 0.3 : 0);
    E(ctx, hx, hy, dog ? 2.3 : 1.9, dog ? 2 : 1.7, coat); E(ctx, hx - 0.3, hy - 0.8, dog ? 1.4 : 1.1, 0.6, lt);
    if (dog) { E(ctx, hx + 2.1, hy + 0.7, 1.4, 1, sh(coat, 0.9)); E(ctx, hx + 3.2, hy + 0.4, 0.45, 0.4, '#141010'); E(ctx, hx - 0.8, hy - 0.4, 0.9, 1.6, b.coat ? b.coat[1] : dark, 0.3); }   // muzzle, nose, floppy ear
    else { ctx.fillStyle = coat; for (const ex of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(hx + ex - 0.7, hy - 1.2); ctx.lineTo(hx + ex, hy - 3); ctx.lineTo(hx + ex + 0.7, hy - 1.2); ctx.fill(); } E(ctx, hx + 1.7, hy + 0.4, 0.35, 0.3, '#d88a8a'); }
    E(ctx, hx + 0.7, hy - 0.4, 0.42, 0.4, dog ? '#120c0a' : '#8ac840'); E(ctx, hx + 0.6, hy - 0.55, 0.14, 0.14, '#ffffff');
    leg(ctx, -BL + 1.4, by + 1.8, swing(0), Lg, 1.3, coat, null, lift(0)); leg(ctx, BL - 0.6, by + 1.8, swing(2), Lg, 1.3, coat, null, lift(2));
  }
  ctx.restore();
}
G.beasts = { draw: drawBeast, coatOf };
AN.draw = (function (_d) {
  return function (ctx) {
    if (!this.def || !this.def.beast) return _d.call(this, ctx);
    if (this.dead || this.ridden) return;
    const st = this._bs || (this._bs = { phase: 0, lx: this.x, ly: this.y, sp: 0, t: Math.random() * 5 });
    const dt = Math.min(0.1, Math.max(0.001, G.loop.time - (st.last || G.loop.time))); st.last = G.loop.time; st.t += dt;
    const moved = Math.hypot(this.x - st.lx, this.y - st.ly); st.lx = this.x; st.ly = this.y;
    st.sp += (moved / dt - st.sp) * Math.min(1, dt * 8);
    if (moved > 0.01) st.phase = (st.phase + moved / (this.species === 'horse' ? 30 : this.species === 'donkey' ? 24 : 14)) % 1;
    if (this.happyT > 0) this.happyT -= dt;
    G.beasts.draw(ctx, this, this.x, this.y, this.facingRight ? 1 : 0, st.phase, this.moving ? st.sp : 0, st.t, { saddle: !!this.rec && !!this.def.mount, scale: this.young ? 0.65 : 1 });
    // a stray's trust, filling up
    const tm = this.strayId && G.world && (G.world.tame || {})[this.strayId];
    if (tm && tm.p > 0 && tm.p < 1) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - 8, this.y - 16, 16, 3); ctx.fillStyle = '#e8708a'; ctx.fillRect(this.x - 7.5, this.y - 15.5, 15 * tm.p, 2); }
    if (this.heartT > 0) { this.heartT -= dt; G.love && G.love.hearts && G.love.hearts(ctx, this.x, this.y - (this.def.mount ? 26 : 14) - (1 - this.heartT) * 4); }
    if (this.rec && this.rec.name && G.player && Math.hypot(G.player.x - this.x, G.player.y - this.y) < 40) { const img = G.facades && G.facades.textImg(this.rec.name, 5, '#ffffff'); if (img) { ctx.globalAlpha = 0.8; ctx.drawImage(img.c, this.x - img.w / 2, this.y - (this.def.mount ? 30 : 17), img.w, 5); ctx.globalAlpha = 1; } }
  };
})(AN.draw);
// our animals do not starve, mate or wander off: they have people
const _needs = AN.updateNeeds;
AN.updateNeeds = function (dt, scene) { if (this.def && this.def.beast) { this.hunger = 0; this.thirst = 0; return false; } return _needs.call(this, dt, scene); };
const _upd = AN.update;
AN.update = function (dt, scene) {
  if (this.ridden) return;
  if (this.rec && this.rec.follow && !this.dead) {   // following you
    const p = scene.player, d = Math.hypot(p.x - this.x, p.y - this.y);
    this.baseUpdate(dt, scene.map);
    if (d > (this.def.mount ? 34 : 22)) { this.seek(p.x - (p.facingRight ? 14 : -14), p.y + 4, d > 90 ? this.runSpeed * 1.2 : this.walkSpeed * 1.8, dt, scene); this.moving = true; }
    else { this.moving = false; if (Math.random() < dt * 0.5) this.facingRight = p.x > this.x; }
    if (d > 420) { this.x = p.x - 12; this.y = p.y + 6; }   // left far behind: catches up (out of sight)
    return;
  }
  return _upd.call(this, dt, scene);
};

// ---------------------------------------------------------------- strays, pets, mounts and livestock in the world
const STRAY_MAPS = { city: [2, 2], southside: [3, 2], eastside: [2, 3], suburbs: [2, 2], industrial: [2, 2], heights: [1, 1] };
const W = () => G.world;
const recs = (w) => { w.pets = w.pets || []; w.mounts = w.mounts || []; w.livestock = w.livestock || []; w.tame = w.tame || {}; return w.pets.concat(w.mounts, w.livestock); };
const make = (scene, species, x, y, rec, zoneR = 4) => {
  const tx = Math.floor(x / 16), ty = Math.floor(y / 16);
  const a = new G.Animal(species, x, y, null, { x: tx - zoneR, y: ty - zoneR, w: zoneR * 2 + 1, h: zoneR * 2 + 1, owner: rec ? 'player' : null, region: scene.map.meta.region });
  if (rec) { a.rec = rec; a.coat = rec.coat; a.rid = rec.id; a.owner = 'player'; a.def = Object.assign({}, a.def, { behavior: 'docile' }); }   // your own animals do not run from you
  return a;
};
const freeNear = (map, x, y) => { const s = G.everyday && G.everyday.freeSpot ? G.everyday.freeSpot(map, x, y, 10, 6) : null; return s || { x, y }; };
const GS = G.GameScene.prototype, _load = GS.loadMap;
GS.loadMap = function (id, spawnName, pos) {
  const w = this.world, prev = this.map && this.map.id;
  // remember where your animals were on the map you are leaving (followers come along)
  if (prev && this.actors) for (const a of this.actors) if (a.rec && !a.dead) { a.rec.x = a.x; a.rec.y = a.y; a.rec.map = a.rec.follow ? id : prev; }
  const p = this.player;
  if (p && p.mount) p.mount.map = id;
  const r = _load.apply(this, arguments);
  if (!w || !this.map) return r;
  recs(w);
  for (const rec of w.pets.concat(w.mounts, w.livestock)) {
    if (rec.dead || rec.map !== this.map.id || (p.mount === rec)) continue;
    let x = rec.x, y = rec.y;
    if (rec.follow || x == null) { const s = freeNear(this.map, p.x - 14, p.y + 6); x = s.x; y = s.y; }
    this.actors.push(make(this, rec.species, x, y, rec, rec.follow ? 2 : 4));
  }
  // strays (the same few animals each time: their trust is remembered)
  const cfg = STRAY_MAPS[this.map.id];
  if (cfg) {
    const rr = new G.RNG('strays' + this.map.id);
    ['dog', 'cat'].forEach((sp, k) => {
      for (let i = 0; i < cfg[k]; i++) {
        const sid = `stray:${this.map.id}:${sp}${i}`;
        if (w.tame[sid] && w.tame[sid].adopted) continue;
        for (let tries = 0; tries < 30; tries++) {
          const tx = rr.int(3, this.map.w - 4), ty = rr.int(3, this.map.h - 4), t = this.map.get(tx, ty);
          if (this.map.isSolidTile(tx, ty) || this.map.buildingAtTile(tx, ty) || ![G.T.sidewalk, G.T.concrete, G.T.grass, G.T.plaza, G.T.lot, G.T.dirt].includes(t)) continue;
          const a = make(this, sp, tx * 16 + 8, ty * 16 + 12, null, 6); a.strayId = sid; a.coat = coatOf(sp, sid); this.actors.push(a); break;
        }
      }
    });
  }
  return r;
};

// ---------------------------------------------------------------- [E] on an animal
const nearAnimal = (scene) => {
  const p = scene.player, [fx, fy] = G.util.DIR_VEC[p.dir], px = p.x + fx * 8, py = p.y - 4 + fy * 8;
  let best = null, bd = 26;
  for (const a of scene.actors) { if (a.kind !== 'animal' || a.dead || !(a.strayId || a.rec || (a.owner === 'player'))) continue; const d = Math.hypot(a.x - px, a.y - 4 - py); if (d < bd) { bd = d; best = a; } }
  return best;
};
const _find = GS.findInteraction, _int = GS.interact;
GS.findInteraction = function () {
  const p = this.player;
  const t = _find.call(this);
  if (p && p.mount) return t && t.type !== 'decor' && t.type !== 'farm' ? t : { type: 'beast', dismount: true, label: `Get off ${p.mount.name || 'the ' + G.ANIMALS[p.mount.species].name.toLowerCase()}` };
  if (t && t.type !== 'decor' && t.type !== 'farm') return t;
  const a = nearAnimal(this);
  if (a) return { type: 'beast', ref: a, label: a.rec ? (a.def.mount ? `${a.rec.name} (ride, feed)` : `${a.rec.name || a.def.name}`) : `Stray ${a.def.name.toLowerCase()}` };
  return t;
};
GS.interact = function () {
  const t = this.promptTarget;
  if (t && t.type === 'beast') { if (t.dismount) G.beasts.dismount(this); else G.beasts.menu(this, t.ref); return; }
  return _int.apply(this, arguments);
};
const foodFor = (p, def) => def.eats.filter((id) => p.inventory.has(id));
const feedOpts = (scene, a, after) => foodFor(scene.player, a.def).map((id) => ({ label: `Give ${G.ITEMS[id].name.toLowerCase()}`, fn: () => { scene.player.inventory.remove(id, 1); after(id); } }));
G.beasts.menu = function (scene, a) {
  const w = scene.world, p = scene.player, name = (a.rec && a.rec.name) || `the ${a.def.name.toLowerCase()}`;
  const opts = [];
  const pet = () => { a.happyT = 3; a.heartT = 1; G.audio.play('animal', { x: a.x, y: a.y }); a.facingRight = p.x > a.x; };
  if (a.strayId) {
    const tm = w.tame[a.strayId] = w.tame[a.strayId] || { p: 0, petT: -1e9 };
    const gain = (k, msg) => { tm.p = Math.min(1, tm.p + k); scene.toast(msg, 'good'); if (tm.p >= 1) G.beasts.adopt(scene, a); };
    opts.push({ label: 'Pet it', fn: () => { pet(); const now = G.effects.now(); if (now - tm.petT > 30) { tm.petT = now; gain(0.08, `It leans into your hand. (${Math.round(tm.p * 100 + 8)}% trust)`); } else scene.toast('It lets you. It wants food more than pats right now.'); } });
    opts.push(...feedOpts(scene, a, (id) => { pet(); gain(0.34, `It eats hungrily and watches you. (${Math.min(100, Math.round(tm.p * 100 + 34))}% trust)`); }));
    if (!foodFor(p, a.def).length) opts.push({ label: a.species === 'dog' ? 'Give food (it wants meat)' : 'Give food (it wants fish)', disabled: true });
  } else if (a.rec) {
    const rec = a.rec;
    if (a.def.mount) opts.push({ label: `Ride ${rec.name}`, fn: () => G.beasts.mount(scene, a) });
    opts.push({ label: `Pet ${rec.name || 'it'}`, fn: pet });
    opts.push(...feedOpts(scene, a, () => { pet(); rec.fed = w.day; scene.toast(`${rec.name || 'It'} eats happily.`, 'good'); }));
    if (rec.species === 'cow' || rec.species === 'chicken') {
      const what = rec.species === 'cow' ? 'milk' : 'egg';
      opts.push({ label: rec.species === 'cow' ? 'Milk her' : 'Collect the egg', disabled: rec.produced === w.day, fn: () => { rec.produced = w.day; p.inventory.add(what, 1); scene.toast(rec.species === 'cow' ? 'A pail of fresh milk.' : 'A warm egg.', 'good'); } });
    }
    opts.push(rec.follow ? { label: 'Stay here', fn: () => { rec.follow = false; rec.x = a.x; rec.y = a.y; rec.map = scene.map.id; a.zone = { x: Math.floor(a.x / 16) - 4, y: Math.floor(a.y / 16) - 4, w: 9, h: 9 }; scene.toast(`${rec.name || 'It'} stays.`); } }
      : { label: 'Follow me', fn: () => { rec.follow = true; scene.toast(`${rec.name || 'It'} follows you.`); } });
    opts.push({ label: 'Rename', fn: () => G.scenes.push(new NameScene(`Rename ${rec.name || 'it'}`, rec.name || '', (n) => { rec.name = n; })) });
  }
  opts.push({ label: 'Leave', fn: () => {} });
  G.scenes.push(new G.ChoiceScene(a.rec ? (a.rec.name || a.def.name) : `A stray ${a.def.name.toLowerCase()}`, a.strayId ? 'Wary, but hungry.' : '', opts));
};
class NameScene {
  constructor(title, start, done) { this.transparent = true; this.title = title; this.input = start; this.done = done; }
  update() {
    const I = G.input;
    for (const ch of I.typed) if (this.input.length < 14 && /[\w '-]/.test(ch)) this.input += ch;
    if (I.pressed.has('Backspace')) this.input = this.input.slice(0, -1);
    if (I.pressed.has('Enter') && this.input.trim()) { G.scenes.remove(this); this.done(this.input.trim()); }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer, w = 240, h = 86, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.dim(ctx, 0.5); U.panel(ctx, x, y, w, h, { title: this.title, titleSize: 12 });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 30, y + 34, w - 60, 18);
    U.text(ctx, this.input + (Math.floor(G.loop.time * 2) % 2 ? '|' : ''), R.uiW / 2, y + 38, { align: 'center', size: 10 });
    U.text(ctx, 'Type a name', R.uiW / 2, y + h - 16, { align: 'center', size: 7, color: U.colors.dim });
  }
}
G.beasts.NameScene = NameScene;
G.beasts.adopt = function (scene, a) {
  const w = scene.world, sp = a.species;
  w.tame[a.strayId].adopted = true;
  const def = sp === 'dog' ? G.rng.pick(['Buddy', 'Max', 'Luna', 'Rocky', 'Bella', 'Rex']) : G.rng.pick(['Mittens', 'Shadow', 'Ginger', 'Oreo', 'Whiskers', 'Nala']);
  G.scenes.push(new NameScene(`The ${sp} trusts you!`, def, (name) => {
    const rec = { id: G.util.uid ? G.util.uid('pet') : 'pet' + Date.now(), species: sp, name, coat: a.coat, map: scene.map.id, x: a.x, y: a.y, follow: true };
    recs(w); w.pets.push(rec);
    a.strayId = null; a.rec = rec; a.owner = 'player'; a.heartT = 1.5; a.happyT = 4;
    scene.toast(`${name} is yours. They will follow you around.`, 'good'); G.events.emit('xp', 10, 'Animals');
  }));
};

// ---------------------------------------------------------------- riding
G.beasts.mount = function (scene, a) {
  const p = scene.player;
  if (p.vehicle || p.dragging || p.swimming) return;
  p.mount = a.rec; a.rec.follow = false;
  p.x = a.x; p.y = a.y; p.facingRight = a.facingRight; p.dir = a.facingRight ? 2 : 1;
  scene.actors = scene.actors.filter((x) => x !== a);
  G.audio.play('animal', { x: p.x, y: p.y }); scene.toast(`You swing up onto ${a.rec.name}.`);
};
G.beasts.dismount = function (scene) {
  const p = scene.player, rec = p.mount; if (!rec) return;
  p.mount = null; rec.map = scene.map.id; rec.x = p.x; rec.y = p.y;
  const a = make(scene, rec.species, p.x, p.y, rec, 3); a.facingRight = p.facingRight; scene.actors.push(a);
  const s = freeNear(scene.map, p.x + (p.facingRight ? -12 : 12), p.y + 6); p.x = s.x; p.y = s.y;
};
const PL = G.Player.prototype, _pu = PL.update, _pd = PL.draw;
PL.update = function (dt, scene) {
  if (!this.mount) return _pu.call(this, dt, scene);
  const m = G.ANIMALS[this.mount.species].mount, ws = this.walkSpeed, rs = this.runSpeed, sw = this.swimming;
  this.walkSpeed = ws * m.walk; this.runSpeed = rs * m.run * (this.stamina > 0 ? 1 : 0.6);
  const st0 = this.stamina;
  try { return _pu.call(this, dt, scene); } finally {
    this.walkSpeed = ws; this.runSpeed = rs;
    if (this.stamina < st0) this.stamina = st0 - (st0 - this.stamina) * 0.35;   // the animal does the running
    if (this.swimming && !sw) { G.beasts.dismount(scene); scene.toast('You slide off into the water.', 'warn'); }
    if (this.dir === 1) this.facingRight = false; else if (this.dir === 2) this.facingRight = true;
  }
};
PL.draw = function (ctx) {
  if (!this.mount || this.dead) return _pd.call(this, ctx);
  const rec = this.mount, def = G.ANIMALS[rec.species], st = this._ride || (this._ride = { phase: 0, lx: this.x, ly: this.y, sp: 0, t: 0 });
  const dt = Math.min(0.1, Math.max(0.001, G.loop.time - (st.last || G.loop.time))); st.last = G.loop.time; st.t += dt;
  const moved = Math.hypot(this.x - st.lx, this.y - st.ly); st.lx = this.x; st.ly = this.y;
  st.sp += (moved / dt - st.sp) * Math.min(1, dt * 8);
  if (moved > 0.01) st.phase = (st.phase + moved / (rec.species === 'horse' ? 30 : 24)) % 1;
  const face = this.facingRight ? 1 : 0, sp = this.moving ? st.sp : 0;
  const g = sp > 95 ? 'gallop' : sp > 45 ? 'trot' : sp > 3 ? 'walk' : 'stand';
  const bob = g === 'gallop' ? Math.sin(st.phase * Math.PI * 4) * 1.2 : g === 'trot' ? Math.abs(Math.sin(st.phase * Math.PI * 2)) * 0.8 : g === 'walk' ? Math.sin(st.phase * Math.PI * 4) * 0.3 : 0;
  G.beasts.draw(ctx, { species: rec.species, coat: rec.coat, rid: rec.id, breed: rec.breed }, this.x, this.y, face, st.phase, sp, st.t, { saddle: true, track: st });
  // the rider: sitting in the saddle, facing the way the animal goes, rising and falling with its back
  const ox = this.x, oy = this.y, d0 = this.dir, s0 = this.seated, m0 = this.moving;
  this.dir = face ? 2 : 1; this.seated = true; this.moving = false;
  // astride, on whichever heading the animal has: the seat is the top of its back, whatever its breed
  const sp2 = G.realAnimal.specOf(rec.species, rec.breed), hd2 = st.dir8 != null ? st.dir8 : face ? 2 : 1;
  this.x = ox; this.y = oy - sp2.H - sp2.D * 0.5 - bob + 12; this._rideDir = hd2;
  try { _pd.call(this, ctx); } finally { this.x = ox; this.y = oy; this.dir = d0; this.seated = s0; this.moving = m0; this._rideDir = null; }
};

// ---------------------------------------------------------------- the stable (Farmland, by the Rancher's house)
if (G.MAPGEN.farmland) {
  const _fl = G.MAPGEN.farmland;
  G.MAPGEN.farmland = () => {
    const m = _fl(), r = new G.RNG('stable');
    const home = m.building('f_farm2'), cx = home ? home.x - 14 : 70, cy = home ? home.y + 2 : 8;
    const at = G.home.findSpot(m, 10, 7, cx, cy, 24);
    if (!at) return m;
    G.home.clearArea(m, at.x, at.y, 10, 7);
    const b = m.addBuilding('f_stable', at.x, at.y, 10, 7, { name: 'Stable', wall: 'wall_wood', floor: 'dirt', roof: 'red', kind: 'barn', chimney: false });
    // stalls: hay and troughs inside
    for (let x = at.x + 1; x < at.x + 9; x += 3) { if (x !== b.doorX) { m.addDecor('haybale', x, at.y + 1); } }
    m.addDecor('trough', at.x + 1, at.y + 4); if (at.x + 8 !== b.doorX) m.addDecor('trough', at.x + 8, at.y + 4);
    // a paddock out front: a fenced yard where the animals you buy wait
    const px0 = at.x - 1, py0 = at.y + 8, px1 = at.x + 10, py1 = at.y + 13;
    if (m.inBounds(px1, py1)) {
      for (let x = px0; x <= px1; x++) for (const y of [py0, py1]) if (Math.abs(x - b.doorX) > 1 && !m.decorsAt(x, y).length && !G.TILES[m.get(x, y)].solid) m.set(x, y, G.T.fence);
      for (let y = py0; y <= py1; y++) for (const x of [px0, px1]) if (!m.decorsAt(x, y).length && !G.TILES[m.get(x, y)].solid) m.set(x, y, G.T.fence);
      m.points.f_paddock = { x: b.doorX + 2, y: py0 + 2 };
    }
    m.computeSolids(); m.prerender();
    return m;
  };
}
const PRICES = [['horse', 'Horse', 850, 'A riding horse, saddled. Fast.'], ['donkey', 'Donkey', 380, 'Slower than a horse, never in a hurry, never quits.'], ['cow', 'Dairy Cow', 320, 'Milk every day.'], ['chicken', 'Hen', 35, 'An egg a day.']];
G.DIALOGUE_CHOICES.push((runner) => (runner.npc.id === 'f_farmer2' && !runner.npc.remote ? [{ text: 'I want to buy an animal.', next: '_buy_animal' }] : []));
G.DIALOGUE_NODES._buy_animal = (r) => {
  const p = r.scene.player, w = r.scene.world;
  return { text: 'Good stock, all of them. They will be waiting in the paddock by the stable.', choices: PRICES.map(([sp, name, price, blurb]) => ({ text: `${name} — $${price} (${blurb})`, next: null, do: () => {
    if (p.gold < price) { r.scene.toast('Not enough money.', 'bad'); return; }
    p.gold -= price; G.audio.play('coin');
    const map = G.maps.get('farmland'), pt = map.points.f_paddock || map.points.f_farm2_door || { x: 80, y: 20 };
    const rec = { id: (G.util.uid ? G.util.uid(sp) : sp + Date.now()), species: sp, coat: G.ANIMALS[sp].mount || sp === 'dog' || sp === 'cat' ? coatOf(sp, Math.random()) : null, map: 'farmland', x: (pt.x + G.rng.int(-2, 2)) * 16 + 8, y: (pt.y + G.rng.int(0, 2)) * 16 + 12, follow: false };
    recs(w); (G.ANIMALS[sp].mount ? w.mounts : w.livestock).push(rec);
    const finish = (name) => { rec.name = name; if (r.scene.map.id === 'farmland') r.scene.actors.push(make(r.scene, sp, rec.x, rec.y, rec, 3)); r.scene.toast(`${name} is yours. In the paddock by the stable.`, 'good'); };
    if (G.ANIMALS[sp].mount) G.scenes.push(new NameScene(`Name your ${name.toLowerCase()}`, sp === 'horse' ? G.rng.pick(['Thunder', 'Daisy', 'Copper', 'Willow', 'Ranger']) : G.rng.pick(['Biscuit', 'Pepper', 'Jack', 'Clover']), finish));
    else finish(name);
  } })).concat([{ text: 'Just looking.', next: null }]) };
};
})();
