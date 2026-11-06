'use strict';
// The city as it is, and as you have left it.

//   Bodies: people carry what has happened to them. Hurt, they stoop; afraid, they shake; soaked, they hunch.
//   Districts: each has its own condition. The Heights are spotless, Center is worn, the Southside, Eastside and the port
//   have tags, rubbish, oil and broken things. Abandoned or failed places are boarded up.
//   Marks: w.marks[map] is what the world remembers. Blood stays where it fell until someone cleans it (the coroner's
//   crew at a reported scene, a cleaning kit, or a long time in the rain). Spent brass stays. A killing leaves a
//   memorial the next day that stays for a month. While you are wanted, your face goes up on the walls. The gangs tag the
//   blocks they hold. People notice all of it, and a known killer gets a wide berth.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, AP = G.Actor.prototype, TM = G.TileMap.prototype, V = G.vk, pick = (a) => G.rng.pick(a), clamp = G.util.clamp;
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const hash2 = (a, b, s = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
// ---------------------------------------------------------------- how a body carries itself
const _ad = AP.draw;
AP.draw = function (ctx) {
  if (this.kind === 'animal' || this.kind === 'vehicle' || this.dead || (this.st && this.st.ko) || this.downT > 0 || this.fcIn) return _ad.call(this, ctx);
  const fear = this.st ? (this.st.fear || 0) / 100 : 0, t = G.loop.time + this.x * 0.03;
  const dx = fear > 0.5 ? Math.sin(t * 34) * 0.5 * fear : 0;   // trembling (limps, slumps and hunches are real frames: js/game/hdchars.js)
  if (!dx) return _ad.call(this, ctx);
  ctx.save(); ctx.translate(dx, 0);
  try { return _ad.call(this, ctx); } finally { ctx.restore(); }
};
// ---------------------------------------------------------------- districts
V.add('tag1', 40, 16, (R, x) => { x.font = 'bold 13px Impact, sans-serif'; x.fillStyle = '#c8c4b4'; x.fillText('NO GOD', 0, 12); x.fillRect(4, 13, 0.8, 3); }, { fw: 2, solid: false });
V.add('tag2', 40, 16, (R, x) => { x.font = 'bold 12px Impact, sans-serif'; x.fillStyle = '#88a8c0'; x.fillText('RENT KILLS', 0, 12); x.fillRect(30, 13, 0.8, 3); }, { fw: 2, solid: false });
V.add('tag3', 36, 16, (R, x) => { x.strokeStyle = '#b8b890'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(1, 13); x.bezierCurveTo(8, -4, 14, 20, 20, 3); x.lineTo(32, 12); x.moveTo(6, 3); x.lineTo(30, 3); x.stroke(); }, { fw: 2, solid: false });
V.add('boards', 16, 12, (R) => { for (const [a, b, c] of [[0, 2, 0.08], [0, 6, -0.07], [0, 9, 0.04]]) { R(a, b, 16, 2.4, ['#5a4a38', '#4e4030', '#625240'][b % 3]); void c; } R(2, 2.8, 0.8, 0.8, '#26282e'); R(13, 6.8, 0.8, 0.8, '#26282e'); }, { solid: false });
V.add('rubbish', 14, 12, (R, x) => { x.fillStyle = '#26282c'; x.beginPath(); x.ellipse(7, 7.4, 5.6, 4, 0, 0, 6.3); x.fill(); R(6, 1.6, 2, 2.6, '#34383e'); R(4, 6, 3, 0.7, '#44484e'); R(10, 9.6, 3, 1.4, '#8a8474'); }, { solid: false });
V.add('rubbish2', 18, 10, (R) => { R(1, 3, 12, 7, '#7a6a50'); R(1, 3, 12, 1, '#94826a'); R(6, 3, 0.6, 7, '#5a4c38'); R(11, 1, 6, 5, '#6a5a44'); R(12, 2, 3, 0.6, '#3e3424'); }, { solid: false });
V.add('rubbish3', 16, 8, (R) => { R(1, 4, 5, 2, '#8a3a2e'); R(1, 4, 0.8, 2, '#c8c4b4'); R(8, 2, 2, 5, '#4a5a3a'); R(8.4, 0.8, 1.2, 1.6, '#3a4a2e'); R(12, 5, 3, 2, '#a8a494'); R(4, 7, 2, 0.8, '#6e7278'); }, { solid: false });
V.add('rubbish4', 18, 10, (R) => { R(0, 3, 10, 6, '#b0aa98'); R(1, 4, 8, 0.5, '#54585e'); R(1, 5.6, 7, 0.5, '#54585e'); R(1, 7.2, 8, 0.5, '#54585e'); R(9, 5, 8, 4, '#a09a88'); R(10, 6, 6, 0.5, '#54585e'); }, { solid: false, flat: true });
V.add('oil_stain', 26, 14, (R, x) => { x.fillStyle = 'rgba(14,12,14,0.5)'; x.beginPath(); x.ellipse(12, 7, 11, 5, 0.2, 0, 6.3); x.fill(); x.fillStyle = 'rgba(70,60,90,0.25)'; x.beginPath(); x.ellipse(10, 6, 5, 2, 0, 0, 6.3); x.fill(); }, { solid: false, flat: true });
V.add('weeds', 14, 10, (R) => { for (let i = 0; i < 9; i++) R(1 + i * 1.4, 2 + (i * 5) % 6, 0.8, 8 - (i * 5) % 6, i % 2 ? '#4e5a34' : '#3a4628'); }, { solid: false });
const GRIME = { southside: 1, eastside: 1, industrial: 0.8, neon: 0.5, center: 0.4, arts: 0.2, suburbs: 0.08, heights: 0 };
// nothing gets nailed or sprayed over a sign
const signAt = (m, b, x) => (m.roofSigns || []).some((q) => { const s = G.assets.sprites[q.def.sprite]; return q.wallOf === b && s && Math.abs(q.x - x) < s.w * (q.sc || 1) / 2 + 9; });
G.signAt = signAt;
const dressStreet = (m) => {
  const k = GRIME[m.meta.district] || 0; if (!k || m.meta.indoor) return;
  const r = new G.RNG('grime' + m.id), tags = ['v_tag1', 'v_tag2', 'v_tag3'];
  for (const b of m.buildings) {
    if (b.venue || b.playerBuilt) continue;
    if (r.chance(0.55 * k) && !(m.roofSigns || []).some((q) => q.wallOf === b)) { const x = clamp(b.doorX + (r.chance(0.5) ? -3 : 2), b.x, b.x + b.w - 2), d = m.addDecor(r.pick(tags), x, b.doorY); d.y = b.doorY * 16 + 13; }
    if (/Abandoned|Old /.test(b.name) || (k >= 0.8 && r.chance(0.2))) for (const w of b.windows) { if (signAt(m, b, w.x)) continue; const d = m.addDecor('v_boards', Math.floor(w.x / 16), b.doorY); d.y = b.doorY * 16 + 13; d.x = w.x; }
  }
  const n = Math.round(m.w * m.h / 900 * k * 1.5), ok = [G.T.sidewalk, G.T.concrete, G.T.lot];
  for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
    const x = r.int(2, m.w - 3), y = r.int(2, m.h - 3); if (!ok.includes(m.get(x, y)) || m.isSolidTile(x, y) || m.decorsAt(x, y).length || m.buildingAtTile(x, y)) continue;
    m.addDecor(r.pick(['v_rubbish', 'v_rubbish2', 'v_rubbish3', 'v_rubbish4', 'v_weeds']), x, y); i++;
  }
};
for (const id of Object.keys(G.MAPGEN)) { const gen = G.MAPGEN[id]; G.MAPGEN[id] = () => { const m = gen(); if (m.finalized && !/^wilds|^hf_/.test(id)) dressStreet(m); return m; }; }
// failed businesses and neglected property show it
const _ap = G.estate.applyToMap;
G.estate.applyToMap = function (m, w) {
  _ap.call(this, m, w);
  for (const b of m.buildings) {
    const v = b.venue && w.venues && w.venues[b.venue], q = w.estate && w.estate.props[b.id], gone = (v && v.closed) || (q && q.cond < 30 && q.owner === 'player');
    if (!gone) continue;
    for (const win of b.windows) { if (signAt(m, b, win.x)) continue; const d = m.addDecor('v_boards', Math.floor(win.x / 16), b.doorY); d.y = b.doorY * 16 + 13; d.x = win.x; }
    const o = m.addDecor('v_weeds', b.doorX + 2, b.doorY + 1); void o; b.neglected = true;
  }
};
// ---------------------------------------------------------------- marks
const M = G.marks = {
  CAP: 240,
  on(w, map) { const s = (w.marks = w.marks || {}); return (s[map] = s[map] || []); },
  add(w, map, kind, x, y, o = {}) { const l = this.on(w, map); l.push(Object.assign({ k: kind, x: Math.round(x), y: Math.round(y), d: w.day, s: Math.floor(Math.random() * 1e4) }, o)); if (l.length > this.CAP) { const i = l.findIndex((q) => q.k === 'blood' || q.k === 'brass'); l.splice(i >= 0 ? i : 0, 1); } },
  clean(w, map, x, y, r, kinds = /blood|brass|spat/) { const l = this.on(w, map); let n = 0; for (let i = l.length - 1; i >= 0; i--) if (kinds.test(l[i].k) && Math.hypot(l[i].x - x, l[i].y - y) < r) { l.splice(i, 1); n++; } return n; },
  draw(ctx, view, w, id) {
    const list = w.marks && w.marks[id]; if (!list) return;
    for (const q of list) {
      if (q.x < view.x - 30 || q.x > view.x + view.w + 30 || q.y < view.y - 30 || q.y > view.y + view.h + 30) continue;
      const age = clamp((w.day - q.d) / 12, 0, 1), s = q.s, A = 1 - age * 0.45;
      if (q.k === 'blood') { ctx.fillStyle = `rgba(${60 - age * 24},${10 + age * 8},${12 + age * 6},${0.72 * A})`; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = hash2(s, i) * 6.3, r = 3 + hash2(i, s) * 7; ctx.ellipse(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r * 0.55, 3 + hash2(s, i, 2) * 5, 2 + hash2(s, i, 3) * 3, a, 0, 6.3); } ctx.fill(); for (let i = 0; i < 9; i++) { const a = hash2(i, s, 4) * 6.3, r = 12 + hash2(i, s, 5) * 12; ctx.fillRect(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r * 0.6, 1, 1); } }
      else if (q.k === 'spat') { ctx.fillStyle = `rgba(70,14,14,${0.6 * A})`; for (let i = 0; i < 7; i++) ctx.fillRect(q.x + (hash2(i, s) - 0.5) * 16, q.y + (hash2(s, i) - 0.5) * 9, 1.2, 1); }
      else if (q.k === 'brass') { ctx.fillStyle = '#a8904a'; for (let i = 0; i < (q.n || 2); i++) ctx.fillRect(q.x + (hash2(i, s) - 0.5) * 10, q.y + (hash2(s, i) - 0.5) * 6, 1.4, 0.7); }
      else if (q.k === 'memorial') { ctx.fillStyle = '#6a5a4a'; ctx.fillRect(q.x - 6, q.y - 1, 12, 2); for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#8a2a2a', '#a8a494', '#6a5a7a'][i % 3]; ctx.fillRect(q.x - 6 + i * 2.8, q.y - 4 - (i % 2), 2, 2); } ctx.fillStyle = '#d8c8a0'; ctx.fillRect(q.x - 1.5, q.y - 8, 3, 4); ctx.fillStyle = '#f0c868'; ctx.fillRect(q.x + 5, q.y - 5, 1, 2); ctx.fillRect(q.x - 7, q.y - 5, 1, 2); }
      else if (q.k === 'poster') { ctx.fillStyle = '#c8c0a8'; ctx.fillRect(q.x - 6, q.y - 18, 12, 15); ctx.fillStyle = '#7a2a2a'; ctx.fillRect(q.x - 5, q.y - 17, 10, 3); ctx.fillStyle = '#34383e'; ctx.fillRect(q.x - 3, q.y - 13, 6, 6); ctx.fillStyle = '#54585e'; ctx.fillRect(q.x - 5, q.y - 6, 10, 1); }
      else if (q.k === 'hole') { ctx.fillStyle = 'rgba(190,184,170,0.35)'; ctx.fillRect(q.x - 1.5, q.y - 1, 3, 3); ctx.fillStyle = '#0e0d0c'; ctx.fillRect(q.x - 0.7, q.y - 0.3, 1.4, 1.4); }
      else if (q.k === 'tag') { ctx.font = 'bold 9px Impact, sans-serif'; ctx.fillStyle = q.c; ctx.globalAlpha = 0.75; ctx.fillText(q.t, q.x - 12, q.y); ctx.globalAlpha = 1; }
    }
  },
  murders(w) { return (w.stats && (w.stats.peopleKilled || w.stats.kills)) || 0; },
};
const _dg = TM.drawGround;
TM.drawGround = function (ctx, view) { const r = _dg.apply(this, arguments), w = G.world; if (w && w.marks) M.draw(ctx, view, w, this.id); return r; };
// what leaves a mark
const _dmg = G.combat.damage;
G.combat.damage = function (target, amount, source, scene) { const r = _dmg.apply(this, arguments); if (scene && scene.world && r >= 6 && target && target.kind !== 'vehicle' && !(scene._fc && target.fcIn) && Math.random() < 0.35) M.add(scene.world, scene.map.id, 'spat', target.x, target.y); return r; };
const _die = NP.die;
NP.die = function (source, scene) {
  const was = this.dead, fc = this.fcIn, r = _die.call(this, source, scene);
  if (!was && this.dead && scene && scene.world && !fc && !this.def.kid) { const w = scene.world; M.add(w, scene.map.id, 'blood', this.x, this.y, { id: this.id }); if (!this.transient) (w.markDue = w.markDue || []).push({ map: scene.map.id, x: this.x, y: this.y, day: w.day + 1, name: this.id }); }
  return r;
};
const _pf = G.firearms.playerFire;
G.firearms.playerFire = function (p, scene) { const n = p.attackCd, r = _pf.apply(this, arguments); if (p.attackCd > n && Math.random() < 0.4) M.add(scene.world, scene.map.id, 'brass', p.x, p.y, { n: 1 + Math.floor(Math.random() * 2) }); return r; };
// the coroner's crew clears a reported scene; nobody cleans the rest
const _rb = G.law.removeBody;
G.law.removeBody = function (w, j) { const r = _rb.apply(this, arguments); if (j && j.map) M.clean(w, j.map, j.x, j.y, 44); return r; };
G.ITEMS.cleaning_kit = { id: 'cleaning_kit', name: 'Cleaning Kit', type: 'tool', icon: 'cloth', value: 18, stack: 5, desc: 'Bleach, rags, a stiff brush. Takes time, and leaves a smell.' };
G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.cleaning_kit = (game) => { const top = G.scenes.top(); if (top !== game) G.scenes.remove(top); const p = game.player, w = game.world, n = M.clean(w, game.map.id, p.x, p.y, 48); if (!n) { game.toast('There is nothing here to clean.'); return false; } p.inventory.remove('cleaning_kit', 1); w.addMinutes(30); game.toast('You scrub until the stain is gone. Mostly.', 'warn'); return true; };
for (const id of ['c_merchant', 'i_supply']) if (G.SHOPS[id]) G.SHOPS[id].stock.push(['cleaning_kit', 6]);
// day by day: memorials appear, rain thins the old stains, posters go up and come down, gangs tag what they hold
G.events.on('newDay', () => {
  const w = G.world; if (!w) return;
  for (const q of (w.markDue || []).slice()) if (w.day >= q.day) { M.add(w, q.map, 'memorial', q.x, q.y, { name: q.name }); w.markDue.splice(w.markDue.indexOf(q), 1); }
  for (const id in w.marks || {}) w.marks[id] = w.marks[id].filter((q) => !(q.k === 'memorial' && w.day - q.d > 30) && !(q.k === 'brass' && w.day - q.d > 20) && !(q.k === 'spat' && w.day - q.d > 25) && !(q.k === 'blood' && w.day - q.d > 90));
  const wanted = G.law && G.law.isWanted && G.law.isWanted(w);
  for (const id of ['city', 'southside', 'eastside', 'neon']) { const l = M.on(w, id); if (!wanted) { w.marks[id] = l.filter((q) => q.k !== 'poster'); continue; } if (l.filter((q) => q.k === 'poster').length < 5) { const m = G.maps.get(id), r = new G.RNG('post' + w.day + id), b = r.pick(m.buildings); M.add(w, id, 'poster', (b.doorX + r.int(2, 3)) * 16, (b.doorY + 1) * 16 - 2); } }
  for (const t of Object.keys(G.TERRITORIES || {})) { const T = G.TERRITORIES[t], owner = w.territories && w.territories[t] && w.territories[t].owner; if (!owner || !G.FACTIONS[owner]) continue; const l = M.on(w, T.map); if (l.some((q) => q.k === 'tag' && q.o === owner && q.t0 === t)) continue; const old = l.findIndex((q) => q.k === 'tag' && q.t0 === t); if (old >= 0) l.splice(old, 1); const r = new G.RNG('tag' + t + owner); M.add(w, T.map, 'tag', (T.x + r.int(4, T.w - 4)) * 16, (T.y + r.int(4, T.h - 4)) * 16, { c: G.FACTIONS[owner].color || '#6a6a6a', t: String(G.FACTIONS[owner].name).replace(/^The /, '').toUpperCase(), o: owner, t0: t }); }
});
// people see it, and they see you
let noticed = 0;
const _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if (!this.actors || (noticed -= dt) > 0) return r; noticed = 2.5;
  const w = this.world, p = this.player, l = (w.marks && w.marks[this.map.id]) || [];
  const fresh = l.filter((q) => (q.k === 'blood' || q.k === 'memorial') && w.day - q.d < 4);
  for (const a of this.actors) {
    if (a.kind !== 'npc' || a.dead || a.def.kid || a.talking || a.state !== 'schedule' || a.def.venue) continue;
    const q = fresh.find((o) => Math.hypot(o.x - a.x, o.y - a.y) < 34);
    if (q && Math.random() < 0.3 && a.distTo(p) < 200) { a.say(q.k === 'blood' ? pick(['Jesus. Is that blood?', 'Nobody cleaned this?', 'Do not look at it.']) : pick(['They were a good person.', 'Someone should pay for this.', 'I knew them.']), 3); break; }
    if (M.murders(w) >= 3 && a.distTo(p) < 44 && a.def.combat === 'flee' && Math.random() < 0.25) { a.say(pick(['That is them. Keep walking.', 'Do not look at them.', 'Oh God. It is them.']), 2.5); a.st.fear = Math.max(a.st.fear || 0, 45); break; }
  }
  return r;
};
// animated marquees, rain on the signs
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  const r = _dd.call(this, ctx, o, s, scene);
  if (o.def.led && s) { const t = Math.floor(G.loop.time * 12), w = s.w - 6; ctx.save(); ctx.beginPath(); ctx.rect(o.x - s.ax + 3, o.y - s.ay + s.h - 7, w, 5); ctx.clip(); ctx.fillStyle = o.def.ledCol || '#ffc040'; for (let i = 0; i < w + 8; i += 4) if (((i + t) >> 2) % 3) ctx.fillRect(o.x - s.ax + 3 + ((i + t) % (w + 8)) - 4, o.y - s.ay + s.h - 3, 2, 1); ctx.restore(); }
  if (o.def.signRain && G.weather && G.weather.ground > 0.2 && s) { ctx.fillStyle = 'rgba(190,210,235,0.3)'; for (let i = 0; i < 4; i++) { const t = (G.loop.time * 0.5 + i * 0.27 + o.tx * 0.1) % 1; ctx.fillRect(o.x - s.ax + (i + 1) * s.w / 5, o.y - s.ay + t * s.h, 0.5, 2); } }
  return r;
};
for (const k in G.DECOR) if (/^v_hdsign_|^v_sign_/.test(k)) G.DECOR[k].signRain = true;
for (const v of Object.values(G.VENUES)) if (/cinema|arcade/.test(v.kind) && v.signDecor) { G.DECOR[v.signDecor].led = true; G.DECOR[v.signDecor].ledCol = v.sign[0]; }
// cows and hens of different breeds look different
const AN = G.Animal.prototype, _an = AN.draw;
AN.draw = function (ctx) {
  const r = _an.call(this, ctx); if (this.dead || !this.breed) return r;
  if (this.species === 'cow') { const c = { angus: 'rgba(20,18,18,0.72)', jersey: 'rgba(150,100,50,0.6)' }[this.breed]; if (c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(this.x, this.y - 8, 11, 6, 0, 0, 6.3); ctx.fill(); } }
  else if (this.species === 'chicken') { ctx.fillStyle = this.breed === 'rhode' ? 'rgba(120,50,20,0.6)' : 'rgba(240,238,228,0.5)'; ctx.beginPath(); ctx.ellipse(this.x, this.y - 4, 3.4, 2.6, 0, 0, 6.3); ctx.fill(); }
  return r;
};
})();
