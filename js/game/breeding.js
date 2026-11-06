'use strict';
// Breeds, sexes and breeding.
//   Every animal is male or female (♂/♀ shown with its name). Deer: only the stags carry antlers.
//   Breeds, each with its own look and strengths:
//     Dogs: Mutt; German Shepherd (bites hard, sturdy); Pit Bull (hardest bite); Rottweiler (strong and
//       tough, a little slower); Greyhound (very fast); Husky (fast,
//       tough); Chihuahua (tiny, quick, barely bites); Dalmatian (spotted, fast); Labrador (gentle, sturdy).
//     Cats: Alley Cat; Siamese; Maine Coon (big, tough); Bengal (fast, spotted); Persian; Sphynx.
//     Horses: Quarter Horse; Thoroughbred (the fastest gallop); Arabian (fast, light); Mustang (tough,
//       quick); Clydesdale (huge, strong, slow); Appaloosa (spotted).  Donkeys: Standard; Mammoth (big,
//       strong); Miniature (small).  Cows: Holstein (two pails of milk a day); Jersey; Angus (more meat).
//     Hens: Rhode Island Red; Leghorn (two eggs a day).
//   Your dog defends you: anyone fighting you gets bitten (harder by the fighting breeds).
//   Breeding: a male and a female of the same species, both yours, inside something you built (a house,
//   or a ring of your own fences/walls). Now and then the female becomes pregnant; after a while (a hen's
//   egg hatches in a day, a cat or dog takes two, a cow four, a horse or donkey five) she has a baby: the
//   breed of a parent (a mixed litter when the parents differ), male or female. Walk up to a newborn and
//   [E] to name it. Babies are small and grow up in three days.
(() => {
const B = {
  dog: { mutt: ['Mutt', {}, [['#8a6a4a', '#5a4230'], ['#6a5a50', '#3a3230'], ['#c8a070', '#9a7a50']]], shepherd: ['German Shepherd', { dmg: 1.6, hp: 1.25, speed: 1.05 }, [['#8a5a2a', '#1e1814']]], pitbull: ['Pit Bull', { dmg: 1.9, hp: 1.2, speed: 0.95 }, [['#9a8a7a', '#5a4a40'], ['#3a3438', '#1a1618']]],
    rottweiler: ['Rottweiler', { dmg: 1.75, hp: 1.45, speed: 0.9, scale: 1.1 }, [['#1e1a1a', '#8a5028']]], greyhound: ['Greyhound', { speed: 1.5, hp: 0.9, dmg: 0.9 }, [['#a8a49c', '#6a6660']]], labrador: ['Labrador', { hp: 1.1, trust: 1.4 }, [['#e0c080', '#b89050'], ['#2a2422', '#141010']]],
    husky: ['Husky', { speed: 1.2, hp: 1.2, dmg: 1.2 }, [['#d8d8dc', '#4a4a52']]], chihuahua: ['Chihuahua', { speed: 1.15, dmg: 0.4, hp: 0.6, scale: 0.7 }, [['#d8b080', '#a88050']]], dalmatian: ['Dalmatian', { speed: 1.2, spots: '#1a1818' }, [['#f0eee8', '#c8c4bc']]] },
  cat: { alley: ['Alley Cat', {}, [['#c8843a', '#8a5a2a'], ['#2a2628', '#121014'], ['#8a8a92', '#5a5a62']]], siamese: ['Siamese', { trust: 1.2 }, [['#e8dcc8', '#5a4030']]], mainecoon: ['Maine Coon', { hp: 1.4, scale: 1.2 }, [['#7a5a3a', '#3a2a1a']]],
    bengal: ['Bengal', { speed: 1.3, spots: '#3a2210' }, [['#d8a050', '#5a3a1a']]], persian: ['Persian', { speed: 0.85, trust: 0.8 }, [['#e8e4dc', '#b8b0a4'], ['#8a8a92', '#5a5a62']]], sphynx: ['Sphynx', {}, [['#e8b8a0', '#c08870']]] },
  horse: { quarter: ['Quarter Horse', {}, [['#7a4a2a', '#2a1a12'], ['#9a5a2a', '#6a3a1a']]], thoroughbred: ['Thoroughbred', { speed: 1.3, hp: 0.95 }, [['#5a3020', '#1a100c'], ['#2a2224', '#121012']]], arabian: ['Arabian', { speed: 1.18, hp: 0.95 }, [['#d8d4cc', '#a8a4a0'], ['#9a6a3a', '#3a2214']]],
    mustang: ['Mustang', { speed: 1.08, hp: 1.25 }, [['#8a6a4a', '#3a2a1a']]], clydesdale: ['Clydesdale', { speed: 0.85, hp: 1.7, scale: 1.15 }, [['#6a3a1e', '#f0ece4']]], appaloosa: ['Appaloosa', { speed: 1.05, spots: '#3a2a22' }, [['#e8e2d6', '#5a4a40']]] },
  donkey: { standard: ['Donkey', {}, [['#8a7e72', '#4a4038']]], mammoth: ['Mammoth Donkey', { hp: 1.5, speed: 1.05, scale: 1.12 }, [['#5a4e44', '#2a221c']]], miniature: ['Miniature Donkey', { speed: 0.85, hp: 0.7, scale: 0.8 }, [['#a89a8a', '#5a5048']]] },
  cow: { holstein: ['Holstein', { yield: 2 }], jersey: ['Jersey', {}], angus: ['Angus', { meat: 2, hp: 1.2 }] },
  chicken: { rhode: ['Rhode Island Red', {}], leghorn: ['Leghorn', { yield: 2 }] },
};
const WEIGHT = { dog: { mutt: 5 }, cat: { alley: 5 } };   // strays are mostly mixed
const BR = G.breeds = {
  LIST: B,
  of(x) { const sp = x.species, k = x.breed || (x.rec && x.rec.breed); const t = B[sp] && (B[sp][k] || B[sp][Object.keys(B[sp])[0]]); return t ? Object.assign({ key: k || Object.keys(B[sp])[0], name: t[0] }, t[1]) : { name: '' }; },
  random(sp, rng = G.rng) {
    const ks = Object.keys(B[sp] || {}); if (!ks.length) return null;
    const pool = []; for (const k of ks) for (let i = 0; i < ((WEIGHT[sp] || {})[k] || 1); i++) pool.push(k);
    return rng.pick(pool);
  },
  coat(sp, breed, seed) { const t = B[sp] && B[sp][breed]; const list = t && t[2]; return list ? list[G.util.hashString(String(seed)) % list.length] : null; },
  sexMark: (sex) => (sex === 'f' ? '♀' : '♂'),
};
// every record of yours has a sex and a breed (older saves get theirs now)
const fill = (rec) => {
  if (!rec) return rec;
  if (!rec.sex) rec.sex = Math.random() < 0.5 ? 'f' : 'm';
  if (!rec.breed && B[rec.species]) { rec.breed = BR.random(rec.species); const c = BR.coat(rec.species, rec.breed, rec.id || Math.random()); if (c && (rec.species === 'dog' || rec.species === 'cat' || rec.species === 'horse' || rec.species === 'donkey')) rec.coat = c; }
  return rec;
};
G.breeds.fill = fill;
const allRecs = (w) => (w.pets || []).concat(w.mounts || [], w.livestock || []);
// ---------------------------------------------------------------- on the animal itself
const AN = G.Animal.prototype, _upd = AN.update, _draw = AN.draw;
const apply = (a) => {
  if (a._bred) return; a._bred = true;
  if (a.rec) { fill(a.rec); a.sex = a.rec.sex; a.breed = a.rec.breed; a.young = !!a.rec.young; if (a.rec.coat) a.coat = a.rec.coat; }
  else if (a.strayId && B[a.species]) { const r = new G.RNG(a.strayId); a.breed = BR.random(a.species, r); a.sex = r.chance(0.5) ? 'f' : 'm'; const c = BR.coat(a.species, a.breed, a.strayId); if (c) a.coat = c; }
  const b = BR.of(a);
  if (b.speed) { a.walkSpeed *= b.speed; a.runSpeed *= b.speed; }
  if (b.hp) { a.maxHp = Math.round((a.maxHp || a.hp) * b.hp); a.hp = Math.min(a.maxHp, Math.round(a.hp * b.hp)); }
  // deer: only stags carry antlers
  if (a.species === 'deer' && a.sex === 'f' && a.sheet && a.sheet.opt && a.sheet.opt.antlers) { a.sheet = G.assets.animal('deer', a.def.color, { antlers: false }); a._sheet2 = null; a.antlerOpt = null; }
};
AN.update = function (dt, scene) {
  apply(this);
  if (this.rec && this.rec.young && G.world && G.world.day - (this.rec.born || 0) >= 3) { this.rec.young = false; this.young = false; }
  // your dog defends you
  if (this.rec && this.species === 'dog' && !this.dead && !this.young) {
    const p = scene.player, foe = this.guardT > 0 ? this.foe : scene.actors.find((x) => !x.dead && x !== p && x.kind !== 'animal' && x.state === 'fight' && x.target === p && Math.hypot(x.x - p.x, x.y - p.y) < 160);
    if (foe && !foe.dead) {
      this.foe = foe; this.guardT = 5;
      const d = Math.hypot(foe.x - this.x, foe.y - this.y);
      this.baseUpdate(dt, scene.map);
      if (d > 14) { this.seek(foe.x, foe.y, this.runSpeed * 1.1, dt, scene); this.moving = true; }
      else { this.moving = false; this.facingRight = foe.x > this.x; if ((this.biteCd = (this.biteCd || 0) - dt) <= 0) { this.biteCd = 0.9; G.combat.damage(foe, Math.round(5 * (BR.of(this).dmg || 1)), this, scene); G.audio.play('growl', { x: this.x, y: this.y }); } }
      if ((this.guardT -= dt) <= 0 || foe.dead) { this.foe = null; this.guardT = 0; }
      return;
    }
  }
  return _upd.call(this, dt, scene);
};
AN.draw = function (ctx) {
  apply(this);
  return _draw.call(this, ctx);
};
// the breed's look: size and spots (on top of the coat colors), drawn over the body
const _bd = G.beasts.draw;
G.beasts.draw = function (ctx, b, x, y, face, phase, speed, t, o = {}) {
  const br = BR.of(b);
  const scale = (o.scale || 1) * (br.scale || 1);
  _bd.call(this, ctx, b, x, y, face, phase, speed, t, Object.assign({}, o, { scale }));
  if (br.spots && !b.dead) {
    const big = b.species === 'horse' || b.species === 'donkey', r = new G.RNG((b.rid || b.id || 'x') + 'spots');
    ctx.save(); ctx.translate(x, y); if (!face) ctx.scale(-1, 1); ctx.scale(scale, scale);
    ctx.fillStyle = br.spots;
    const by = big ? -13 : b.species === 'dog' ? -6 : -4.2, bl = big ? 8 : b.species === 'dog' ? 4 : 3.2;
    for (let i = 0; i < (big ? 9 : 6); i++) { ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(r.range(-bl, bl), by + r.range(-1.5, 3.5), r.range(0.4, 0.9), r.range(0.35, 0.7), 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
};
// the breed's speed under the saddle
const PL = G.Player.prototype, _pu = PL.update;
PL.update = function (dt, scene) {
  if (!this.mount) return _pu.call(this, dt, scene);
  fill(this.mount);
  const k = BR.of(this.mount).speed || 1, ws = this.walkSpeed, rs = this.runSpeed;
  this.walkSpeed = ws * k; this.runSpeed = rs * k;
  try { return _pu.call(this, dt, scene); } finally { this.walkSpeed = ws; this.runSpeed = rs; }
};
// names show the sex, and the breed
const _menu = G.beasts.menu;
G.beasts.menu = function (scene, a) {
  apply(a);
  if (a.rec && !a.rec.name) {   // a newborn: name it
    G.scenes.push(new G.beasts.NameScene(`Name the ${a.rec.sex === 'f' ? 'female' : 'male'} ${babyWord(a.species)}`, '', (n) => { a.rec.name = n; scene.toast(`Welcome, ${n}.`, 'good'); }));
    return;
  }
  _menu.call(this, scene, a);
  const top = G.scenes.top();
  if (top instanceof G.ChoiceScene) {
    const br = BR.of(a), parts = [br.name, a.sex === 'f' ? 'female' : 'male', a.rec && a.rec.preg ? 'pregnant' : '', a.rec && a.rec.young ? 'young' : ''].filter(Boolean);
    top.text = (top.text ? top.text + '  ' : '') + parts.join(', ');
  }
};
// trust grows faster with the gentle breeds
const W0 = () => G.world;
// ---------------------------------------------------------------- the Rancher sells breeds now
const SALE = [['horse', 'quarter', 850], ['horse', 'mustang', 950], ['horse', 'appaloosa', 1050], ['horse', 'arabian', 1400], ['horse', 'clydesdale', 1150], ['horse', 'thoroughbred', 1700],
  ['donkey', 'standard', 380], ['donkey', 'miniature', 300], ['donkey', 'mammoth', 620], ['cow', 'jersey', 300], ['cow', 'holstein', 380], ['cow', 'angus', 340], ['chicken', 'rhode', 35], ['chicken', 'leghorn', 55]];
G.DIALOGUE_NODES._buy_animal = (r) => {
  const p = r.scene.player, w = r.scene.world;
  return { text: 'Good stock, all of them. Pick one, and pick the sex: they wait in the paddock by the stable.', choices: SALE.map(([sp, bk, price]) => ({ text: `${B[sp][bk][0]}${sp === 'chicken' ? ' hen' : ''} — $${price}`, next: null, do: () => {
    const go = (sex) => {
      if (p.gold < price) { r.scene.toast('Not enough money.', 'bad'); return; }
      p.gold -= price; G.audio.play('coin');
      const map = G.maps.get('farmland'), pt = map.points.f_paddock || map.points.f_farm2_door || { x: 80, y: 20 };
      const rec = fill({ id: G.util.uid(sp), species: sp, breed: bk, sex, map: 'farmland', x: (pt.x + G.rng.int(-2, 2)) * 16 + 8, y: (pt.y + G.rng.int(0, 2)) * 16 + 12, follow: false });
      const c = BR.coat(sp, bk, rec.id); if (c) rec.coat = c;
      (G.ANIMALS[sp].mount ? (w.mounts = w.mounts || []) : (w.livestock = w.livestock || [])).push(rec);
      const finish = (name) => { rec.name = name; if (r.scene.map.id === 'farmland') { const a = new G.Animal(sp, rec.x, rec.y, null, { x: Math.floor(rec.x / 16) - 3, y: Math.floor(rec.y / 16) - 3, w: 7, h: 7, owner: 'player' }); a.rec = rec; a.owner = 'player'; a.def = Object.assign({}, a.def, { behavior: 'docile' }); r.scene.actors.push(a); } r.scene.toast(`${name} is yours. In the paddock by the stable.`, 'good'); };
      G.scenes.push(new G.beasts.NameScene(`Name your ${B[sp][bk][0]}`, '', finish));
    };
    if (sp === 'chicken') go('f');
    else G.scenes.push(new G.ChoiceScene(B[sp][bk][0], `$${price}`, [{ label: 'Female', fn: () => go('f') }, { label: 'Male', fn: () => go('m') }, { label: 'Never mind', fn: () => {} }]));
  } })).concat([{ text: 'A rooster too ($40).', next: null, do: () => { if (p.gold < 40) return; p.gold -= 40; const map = G.maps.get('farmland'), pt = map.points.f_paddock || { x: 80, y: 20 }; const rec = fill({ id: G.util.uid('chicken'), species: 'chicken', breed: 'rhode', sex: 'm', map: 'farmland', x: pt.x * 16 + 8, y: pt.y * 16 + 12, follow: false, name: 'Rooster' }); (w.livestock = w.livestock || []).push(rec); r.scene.toast('A rooster, for your hens.', 'good'); } }, { text: 'Just looking.', next: null }]) };
};
// livestock yields by breed
const _bm = G.beasts.menu;
// ---------------------------------------------------------------- breeding
const GEST = { chicken: 1, cat: 2, dog: 2, cow: 4, horse: 5, donkey: 5 };
const babyWord = (sp) => ({ dog: 'puppy', cat: 'kitten', horse: 'foal', donkey: 'foal', cow: 'calf', chicken: 'chick' }[sp] || 'baby');
// the closed space an animal stands in, if it is closed by something you built: a key for it, or null
const pen = (w, map, x, y) => {
  const sx = Math.floor(x / 16), sy = Math.floor((y - 3) / 16), seen = new Set(), q = [[sx, sy]], built = (w.built || {})[map.id] || {};
  let ours = false, n = 0, minK = null;
  const house = map.buildings.find((b) => b.playerBuilt && sx > b.x && sx < b.x + b.w - 1 && sy > b.y && sy < b.y + b.h - 1);
  if (house) return 'house:' + house.id;
  while (q.length) {
    const [tx, ty] = q.pop(), k = tx + ',' + ty;
    if (seen.has(k)) continue; seen.add(k);
    if (!map.inBounds(tx, ty) || tx <= 0 || ty <= 0 || tx >= map.w - 1 || ty >= map.h - 1) return null;   // open to the world
    const d = map.tileDef(tx, ty);
    if (d.solid && !d.water) { if (built[k]) ours = true; continue; }
    if (d.water) continue;
    if (++n > 900) return null;
    if (minK === null || k < minK) minK = k;
    q.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
  }
  return ours ? 'pen:' + minK : null;
};
G.breeds.pen = pen;
G.breeds.hourly = function (w) {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && scene.actors) for (const a of scene.actors) if (a.rec && !a.dead) { a.rec.x = a.x; a.rec.y = a.y; a.rec.map = scene.map.id; }
  const recs = allRecs(w).filter((r) => !r.dead).map(fill);
  // births
  for (const f of recs) {
    if (!f.preg || w.day * 24 + w.hour < f.preg.due) continue;
    const dad = f.preg.dad, n = f.species === 'dog' || f.species === 'cat' ? G.rng.int(1, 3) : 1, out = [];
    for (let i = 0; i < n; i++) {
      const breed = dad && dad !== f.breed && (f.species === 'dog' || f.species === 'cat') ? (f.species === 'dog' ? 'mutt' : 'alley') : G.rng.pick([f.breed, dad || f.breed]);
      const baby = fill({ id: G.util.uid(f.species), species: f.species, breed, sex: G.rng.chance(0.5) ? 'f' : 'm', map: f.map, x: f.x + G.rng.range(-8, 8), y: f.y + G.rng.range(-4, 6), follow: false, young: true, born: w.day, name: null, mother: f.id });
      const c = BR.coat(f.species, breed, baby.id); baby.coat = G.rng.chance(0.5) && f.coat ? f.coat : c || f.coat;
      (G.ANIMALS[f.species].mount ? (w.mounts = w.mounts || []) : f.species === 'dog' || f.species === 'cat' ? (w.pets = w.pets || []) : (w.livestock = w.livestock || [])).push(baby);
      out.push(baby);
      if (scene && scene.map.id === baby.map) { const a = new G.Animal(baby.species, baby.x, baby.y, null, { x: Math.floor(baby.x / 16) - 3, y: Math.floor(baby.y / 16) - 3, w: 7, h: 7, owner: 'player' }); a.rec = baby; a.owner = 'player'; a.young = true; a.def = Object.assign({}, a.def, { behavior: 'docile' }); scene.actors.push(a); }
    }
    f.preg = null; f.lastBirth = w.day;
    if (scene) scene.toast(`${f.name || 'Your ' + G.ANIMALS[f.species].name.toLowerCase()} had ${n > 1 ? n + ' ' + ({ puppy: 'puppies', calf: 'calves', baby: 'babies' }[babyWord(f.species)] || babyWord(f.species) + 's') : 'a ' + babyWord(f.species)}! Walk up to name ${n > 1 ? 'them' : 'it'}.`, 'good');
    w.log && w.log(`${f.name || 'Your animal'} gave birth.`, 'good');
  }
  // conceptions: a male and a female of one species, adults, in the same pen you built
  const byPen = {};
  for (const r of recs) { if (r.young) continue; const map = G.maps.get(r.map); if (!map) continue; const k = G.breeds.pen(w, map, r.x, r.y); if (k) (byPen[r.map + '|' + k + '|' + r.species] = byPen[r.map + '|' + k + '|' + r.species] || []).push(r); }
  for (const k in byPen) {
    const g = byPen[k], males = g.filter((r) => r.sex === 'm');
    if (!males.length) continue;
    for (const f of g) {
      if (f.sex !== 'f' || f.preg || (f.lastBirth != null && w.day - f.lastBirth < 3)) continue;
      if (Math.random() < 0.12) { const m = G.rng.pick(males); f.preg = { dad: m.breed, dadId: m.id, due: w.day * 24 + w.hour + GEST[f.species] * 24 }; if (scene) scene.toast(`${f.name || 'One of your animals'} is expecting.`, 'info'); }
    }
  }
};
G.events.on('hour', () => { if (G.world) G.breeds.hourly(G.world); });
// a newborn's name label, ♂/♀ on the others
const _ad = AN.draw;
AN.draw = function (ctx) {
  _ad.call(this, ctx);
  if (this.rec && !this.dead && G.player && Math.hypot(G.player.x - this.x, G.player.y - this.y) < 40) {
    const label = this.rec.name ? BR.sexMark(this.rec.sex) : `${BR.sexMark(this.rec.sex)} (new)`;
    const img = G.facades && G.facades.textImg(label, 5, this.rec.sex === 'f' ? '#ffb0d0' : '#a8d0ff');
    if (img) { ctx.globalAlpha = 0.85; ctx.drawImage(img.c, this.x - img.w / 2, this.y - (this.def.mount ? 36 : this.def.beast ? 23 : 20), img.w, 5); ctx.globalAlpha = 1; }
  }
};
// produce by breed (Holstein: two pails, Leghorn: two eggs)
const _men = G.beasts.menu;
G.beasts.menu = function (scene, a) {
  _men.call(this, scene, a);
  const top = G.scenes.top();
  if (a.rec && top instanceof G.ChoiceScene) for (const o of top.options) {
    if (!/^(Milk her|Collect the egg)/.test(o.label)) continue;
    if (a.rec.sex !== 'f') { o.label = a.species === 'cow' ? 'Milk (only cows give milk)' : 'Collect the egg (roosters do not lay)'; o.disabled = true; continue; }
    const y = BR.of(a).yield || 1, fn = o.fn; o.fn = () => { fn(); if (y > 1) scene.player.inventory.add(a.species === 'cow' ? 'milk' : 'egg', y - 1); };
  }
};
void W0; void _bm;
})();
