'use strict';
// The city's loose ends, tied up.
//   People use the places: cabinets, lanes, tables, machines and shelves have someone at them; moviegoers time their
//   trip to a showing, stop at the concession stand first and sit in the right room. Skaters, ball players and street
//   musicians work the Old Quarter and Neon Row. Cash visibly changes hands. Bodies are wheeled to the morgue.
//   People sell what they do not need, landlords collect from their tenants, the broke put their property on the market.
//   Tenants are real people: they arrive on foot, live in the place, and leave. Staff are real too: let someone go and
//   they stop coming to work. Goods run out: a bar with no stock takes no drink money.
//   Building: rotate pieces, read the lot's measurements as you go, wire and plumb a house, add a staircase and build
//   upstairs. Stop orders stop you, sealed properties stay shut, and the city confiscates in serious cases.
(() => {
const GS = G.GameScene.prototype, NP = G.NPC.prototype, AP = G.Actor.prototype, V = G.venueSys, Sh = G.showSys, E = G.estate, F = G.finance, H = G.home, LF = G.lifestyle, pick = (a) => G.rng.pick(a);
const sceneNow = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const nowMin = () => G.effects.now();
// ---------------------------------------------------------------- cash changing hands
G.giveCash = (scene, a, b, n = 2) => { if (!scene || !a || !b || scene.map.id == null) return; for (let i = 0; i < n; i++) Sh.bills.push({ map: scene.map.id, x: a.x, y: a.y - 12, tx: b.x, ty: b.y - 12, t: 0, dur: 0.35, spin: i, delay: i * 0.07, hand: true }); };
const nearest = (scene, x, y, test) => { let best = null, bd = 90; for (const a of scene.actors) { if (a.kind !== 'npc' || a.dead || !test(a)) continue; const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } } return best; };
const counterAct = (fn, test) => function (w, p) { const r = fn.apply(this, arguments), sc = sceneNow(); if (r && sc) { const o = nearest(sc, p.x, p.y, test); if (o) G.giveCash(sc, p, o); } return r; };
const B = G.bankSys, teller = (a) => /^c_teller/.test(a.id);
B.dep = counterAct(B.dep, teller);
{ const wd = B.wd; B.wd = function (w, p) { const r = wd.apply(this, arguments), sc = sceneNow(); if (r && sc) { const o = nearest(sc, p.x, p.y, teller); if (o) G.giveCash(sc, o, p); } return r; }; }
{ const c = B.counter; B.counter = function (scene, npc) { const r = c.apply(this, arguments), t = nearest(scene, npc.x, npc.y, teller); if (t) G.giveCash(scene, npc, t); return r; }; }
{ const S = G.loanShark, rp = S.repay; S.repay = function (w, rec, pocket) { const r = rp.apply(this, arguments), sc = sceneNow(); if (r && sc) { const a = S.actor(sc); if (a && pocket === sc.player) G.giveCash(sc, pocket, a, 3); } return r; }; }
{ const b = G.drugs.buy; G.drugs.buy = function (scene, npc) { const r = b.apply(this, arguments); if (r) G.giveCash(scene, scene.player, npc); return r; }; }
{ const b = G.fightClub.bet; G.fightClub.bet = function (scene) { const r = b.apply(this, arguments); if (r) { const k = G.fightClub.actor(scene, 'fc_bookie'); if (k) G.giveCash(scene, scene.player, k, 3); } return r; }; }
// ---------------------------------------------------------------- at the machines, in the right seat, at the right time
const USED = new Set(['v_arcade', 'v_bowling', 'v_pool', 'v_gym', 'v_book', 'v_exhibit', 'v_shelf', 'v_darts', 'v_foosball', 'v_chess']);
V.spots = function (m, id) {
  const c = (m.vspots = m.vspots || {}); if (c[id]) return c[id];
  const out = [], b = m.building(id);
  if (b) for (const d of m.decor) if (USED.has(d.def.interact) && m.buildingAtTile(d.tx, d.ty) === b) { const y = d.ty + 1; if (!m.isSolidTile(d.tx, y)) out.push({ x: d.tx, y, spot: d.def.interact }); }
  return (c[id] = out);
};
const LINES = { v_arcade: ['One more credit.', 'New high score!'], v_bowling: ['Strike!', 'Gutter ball. Again.'], v_pool: ['Corner pocket.', 'Rack them up.'], v_gym: ['Two more.', 'Feel the burn.'], v_book: ['Hm. Good chapter.', 'Shh.'], v_exhibit: ['Fascinating.', 'My kid could do that.'], v_shelf: ['Do you have this in another size?', 'This one is nice.'], v_darts: ['Double top!', 'Missed the board.'], v_foosball: ['Goal!', 'No spinning!'], v_chess: ['Check.', 'Your move.'] };
const _pf = V.pickFor;
V.pickFor = function (npc, scene) {
  let g = _pf.call(this, npc, scene);
  for (let i = 0; g && i < 3; i++) {
    const v = G.VENUES[g.venue], w = scene.world, m = scene.map;
    if (/cinema|theater|blackbox/.test(v.kind)) {
      const next = Sh.programme(w, v.id).find((s) => s.at >= w.hourF - 0.1 && s.at < w.hourF + 1.2);
      if (!next) { g = _pf.call(this, npc, scene); continue; }
      g.until = nowMin() + ((next.at - w.hourF) + (next.film ? 1.8 : 1.4)) * 60;
      const room = (m.vrooms || {})[v.id] && m.vrooms[v.id][next.room || 0], seats = ((m.vseats || {})[v.id] || []).filter((q) => !room || (q.x >= room.x0 && q.x <= room.x1)), s = seats.length ? pick(seats) : null;
      if (s) { g.pt = { x: s.x, y: s.y, seat: true }; g.seat = true; }
      if (v.kind === 'cinema') { const q = m.points[`${v.id}_s2`]; if (q && (npc.st.gold || 0) >= 20 && Math.random() < 0.6) { g.then = g.pt; g.pt = { x: q.x, y: q.y + 2 }; g.seat = false; } }
      break;
    }
    const sp = this.spots(m, v.id);
    if (sp.length && !g.seat) { const q = pick(sp); g.pt = { x: q.x, y: q.y }; g.spot = q.spot; }
    else if (sp.length && Math.random() < 0.5) { const q = pick(sp); g.pt = { x: q.x, y: q.y }; g.spot = q.spot; g.seat = false; }
    break;
  }
  return g;
};
const _ar = V.arrived;
V.arrived = function (npc, g, scene) {
  const v = G.VENUES[g.venue];
  if (g.then) {   // the concession stand first
    const staff = scene.actors.find((a) => a.id === `${v.id}_s2` && !a.dead), s = this.st(scene.world, v.id), n = Math.min(npc.st.gold || 0, this.price(scene.world, v.id, 8));
    npc.st.gold -= n; s.till += n; if (staff) { G.giveCash(scene, npc, staff); staff.say(pick(['Popcorn and a soda.', 'Enjoy the movie.']), 2); } npc.emote = 'soda';
    g.pt = g.then; g.then = null; g.there = false; g.walk = 0; g.seat = !!g.pt.seat; g.snacked = true;
    return undefined;
  }
  if (g.paid) return undefined;
  g.paid = true;
  const r = _ar.apply(this, arguments), st0 = scene.actors.find((a) => a.id === `${v.id}_s0` && !a.dead && a.distTo(npc) < 90); if (st0) G.giveCash(scene, npc, st0);
  if (g.spot) { npc.dir = 3; npc.usingT = 0; }
  return r;
};
const _lu = LF.update;
LF.update = function (npc, dt, scene) {
  const g = npc.errand, r = _lu.apply(this, arguments);
  if (npc.seated && npc.moving) npc.seated = false;   // (on the way somewhere: nobody walks sitting down)
  if (g && g.there && g.spot && npc.errand === g) {
    npc.dir = 3; npc.attackTimer = 0;
    if ((npc.usingT = (npc.usingT || 0) - dt) <= 0) { npc.usingT = 5 + Math.random() * 7; if (npc.distTo(scene.player) < 170) { npc.say(pick(LINES[g.spot] || ['...']), 2); if (g.spot === 'v_arcade') G.audio.tone(660 + Math.random() * 500, 0.06, { type: 'square', vol: 0.05 }); } }
  }
  return r;
};
// the theme keeps its bills in one place: handed cash disappears into the hand
const _tv = Sh.tickVenues;
Sh.tickVenues = function (scene, dt) { const r = _tv.call(this, scene, dt); if (this.bills.some((q) => q.hand)) this.bills = this.bills.filter((q) => !q.hand || q.t < q.delay + q.dur + 0.05); return r; };
// ---------------------------------------------------------------- the street
const person = (id, name, map, at, o) => { G.NPCS[id] = Object.assign({ id, name, map, faction: 'civilians', hp: 30, combat: 'flee', gold: 30, home: null, relations: {}, ageGroup: 'adult', look: G.look(id, o.lookO || {}), schedule: [{ from: 10, to: 22, at, act: 'wander' }, { from: 22, to: 24, at, act: 'wander' }, { from: 0, to: 10, at: map === 'neon' ? 'n_flats_door' : 'a_flats_door', act: 'wander' }] }, o); };
for (let i = 0; i < 3; i++) person('a_skate' + i, 'Skater', 'arts', 'a_skate', { skater: true, job: 'I skate. That is the whole plan.', lookO: { top: i % 2 ? 'hoodie' : 'tshirt', bottom: 'shorts', hat: i === 1 ? 'cap' : undefined } });
for (let i = 0; i < 2; i++) person('a_ball' + i, 'Basketball Player', 'arts', 'a_court', { baller: true, job: 'Pickup games. Winner stays on.', lookO: { top: 'tank', shirt: i ? '#e8e4dc' : '#c03030', bottom: 'shorts', build: 1 } });
person('n_busker', 'Street Musician', 'neon', 'n_plaza', { busker: true, dialogue: 'v_busker', job: 'I play for whoever walks by.', gold: 12, lookO: { top: 'jacket', shirt: '#6a5a3a', bottom: 'pants', hat: 'cap' } });
person('a_busker', 'Street Musician', 'arts', 'a_plaza', { busker: true, dialogue: 'v_busker', job: 'I play for whoever walks by.', gold: 12, lookO: { top: 'vest', shirt: '#3a5a4a', bottom: 'pants' } });
G.DIALOGUES.v_busker = { start: { text: () => pick(['Any requests? I know three songs.', 'This one is called "Rent".', 'Spare a dollar for the arts?']), choices: [
  { text: 'Here, a dollar.', if: (c) => c.gold() >= 1, do: (c) => { c.p.gold -= 1; c.st.gold += 1; G.giveCash(c.scene, c.p, c.npc); G.social.addDisp(c.w, c.npc.id, 1); c.npc.say('Bless you.', 2); return null; } },
  { text: 'Here, five.', if: (c) => c.gold() >= 5, do: (c) => { c.p.gold -= 5; c.st.gold += 5; G.giveCash(c.scene, c.p, c.npc, 3); G.social.addDisp(c.w, c.npc.id, 2); c.npc.say('Now that is a patron of the arts.', 2.5); return null; } },
  { text: 'Goodbye.', next: null } ] } };
const TUNE = [392, 440, 494, 587, 494, 440, 392, 330];
const _nu = NP.update;
NP.update = function (dt, scene) {
  const d = this.def, r = _nu.call(this, dt, scene);
  if (!d || this.dead || this.state !== 'schedule' || this.talking) return r;
  if (d.skater) {
    this.speed = 74;
    if ((this.trickT = (this.trickT || 0) - dt) <= 0) { this.trickT = 3 + Math.random() * 4; this.trick = 0.7; if (this.distTo(scene.player) < 170) { G.audio.tone(180, 0.05, { type: 'square', vol: 0.06 }); if (Math.random() < 0.3) this.say(pick(['Kickflip!', 'Almost!', 'Did you see that?']), 2); } }
    if (this.trick > 0) { this.trick -= dt; const k = 1 - this.trick / 0.7; this.bob = -Math.sin(k * Math.PI) * 11; this.dir = Math.floor(k * 8) % 4; } else this.bob = 0;
  } else if (d.baller) {
    if ((this.shotT = (this.shotT || 0) - dt) <= 0) { this.shotT = 4 + Math.random() * 5; this.ball = 1; }
    if (this.ball > 0) { this.ball -= dt; this.bob = this.ball > 0.7 ? -Math.sin((1 - this.ball) / 0.3 * Math.PI) * 6 : 0; }
  } else if (d.busker) {
    const pt = scene.map.points[scene.map.id === 'neon' ? 'n_plaza' : 'a_plaza']; this.moving = false; this.path = null; this.goal = null; if (pt && scene.world.hour >= 10 && scene.world.hour < 24) { this.x = pt.x * 16 + 8; this.y = pt.y * 16 + 12; this.dir = 0; }
    if (this.distTo(scene.player) < 150 && (this.tuneT = (this.tuneT || 0) - dt) <= 0) { this.tuneT = 0.42; this.note = ((this.note || 0) + 1) % TUNE.length; G.audio.tone(TUNE[this.note], 0.4, { type: 'triangle', vol: 0.05 * (1 - this.distTo(scene.player) / 150) }); }
    if (Math.random() < dt * 0.05) { const c = scene.actors.find((a) => a.kind === 'npc' && !a.dead && a !== this && a.distTo(this) < 60 && (a.st.gold || 0) > 20); if (c) { c.st.gold -= 1; this.st.gold = (this.st.gold || 0) + 1; G.giveCash(scene, c, this, 1); } }
  }
  return r;
};
const _ad = AP.draw;
AP.draw = function (ctx) {
  const d = this.def, r = _ad.call(this, ctx); if (!d || this.dead) return r;
  if (d.skater) { const y = this.y + (this.bob || 0) + 1; ctx.fillStyle = '#6a3a1e'; ctx.fillRect(this.x - 7, y - 1, 14, 2); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(this.x - 6, y + 1, 2, 1.4); ctx.fillRect(this.x + 4, y + 1, 2, 1.4); }
  else if (d.baller) { const t = G.loop.time * 5 + this.x, k = this.ball > 0 ? 1 - this.ball : 0, y = this.ball > 0 ? this.y - 18 - Math.sin(k * Math.PI) * 26 : this.y - 2 - Math.abs(Math.sin(t)) * 8; ctx.fillStyle = '#d8701c'; ctx.beginPath(); ctx.arc(this.x + 7, y, 2.4, 0, 6.3); ctx.fill(); }
  else if (d.busker) { ctx.fillStyle = '#a85a20'; ctx.fillRect(this.x - 5, this.y - 13, 9, 4); ctx.fillStyle = '#3a2418'; ctx.fillRect(this.x + 3, this.y - 13, 8, 1.2); ctx.fillStyle = '#2a2018'; ctx.fillRect(this.x - 11, this.y - 2, 9, 3); const n = Math.floor(G.loop.time * 2) % 3; ctx.fillStyle = 'rgba(255,240,180,0.8)'; ctx.fillRect(this.x + 6 + n * 2, this.y - 22 - n * 3, 2, 2); }
  return r;
};
// ---------------------------------------------------------------- the tables at the new casinos
const _uu = G.usables.use, Gm = G.gambling;
G.usables.use = function (d, scene) {
  const k = d.def.interact, b = scene.map.buildingAtTile(d.tx, d.ty);
  if ((k !== 'slots' && k !== 'blackjack' && k !== 'roulette') || !b || !b.venue) return _uu.apply(this, arguments);
  const vid = b.venue, co = Gm.casinoOpen, sa = Gm.staffAt, w = scene.world;
  Gm.casinoOpen = () => V.isOpen(w, vid);
  Gm.staffAt = () => scene.actors.some((a) => a.kind === 'npc' && !a.dead && a.def.venue === vid && a.def.name === 'Dealer' && a.state === 'schedule');
  try { return _uu.apply(this, arguments); } finally { Gm.casinoOpen = co; Gm.staffAt = sa; }
};
// ---------------------------------------------------------------- goods run out; staff are people
const _ch = V.charge;
V.charge = function (w, id, st, v) {
  const s = this.st(w, v.id), k = G.VENUE_KINDS[v.kind];
  if (k.menu.length && s.stock != null && s.stock <= 0) { const sp = k.spend; k.spend = 0; s.rep = Math.max(5, s.rep - 0.15); try { return _ch.apply(this, arguments); } finally { k.spend = sp; } }
  if (k.menu.length) s.stock = Math.max(0, (s.stock != null ? s.stock : 80) - 0.5);
  return _ch.apply(this, arguments);
};
Object.assign(E, {
  setStaff(w, vid, i, out) {
    const s = V.st(w, vid), id = `${vid}_s${i}`, d = G.NPCS[id]; if (!d) return;
    s.out = (s.out || []).filter((n) => n !== i); if (out) s.out.push(i);
    d.schedule0 = d.schedule0 || d.schedule; d.performer0 = d.performer0 != null ? d.performer0 : !!d.performer;
    d.schedule = out ? [{ from: 0, to: 24, at: vid + '_door', act: 'wander' }] : d.schedule0; d.performer = out ? false : d.performer0;
    const sc = sceneNow(), a = sc && sc.actors.find((q) => q.id === id); if (a) { a.goal = null; a.path = null; a.def = d; }
    if (i === 0) { const q = this.s(w).props[vid]; void q; }
  },
  staffed(w, vid) { const k = G.VENUE_KINDS[G.VENUES[vid].kind]; return k.roles.length - (V.st(w, vid).out || []).length; },
  // somebody new comes to live here
  moveIn(w, id, rent) {
    const c = this.catalog()[id], e = this.s(w), nid = `t_${e.nextId++}`, m = G.maps.get(c.map), bed = m.points[id + '_bed'] ? id + '_bed' : id + '_in';
    e.tenantDefs = e.tenantDefs || {}; e.tenantDefs[nid] = { prop: id, map: c.map, bed };
    this.tenantDef(nid, e.tenantDefs[nid]);
    w.npcs[nid] = w.freshNpcState(nid, null); w.npcs[nid].gold = 0; F.pay(w, 'pool', w.npcs[nid], 200);
    const sc = sceneNow();
    if (sc && sc.map.id === c.map) { const at = G.spawnRule.away(sc, (m.points[id + '_door'].x) * 16, m.points[id + '_door'].y * 16); if (at) { const a = new G.NPC(nid, w.npcs[nid]); a.x = at.x; a.y = at.y; sc.actors.push(a); } }
    return nid;
  },
  tenantDef(nid, t) { G.NPCS[nid] = { id: nid, name: 'Tenant', map: t.map, faction: 'civilians', hp: 30, combat: 'flee', gold: 0, home: t.prop, relations: {}, ageGroup: 'adult', job: 'I rent around here.', look: G.look(nid), schedule: [{ from: 8, to: 20, at: t.prop + '_door', act: 'wander' }, { from: 20, to: 23, at: t.prop + '_in', act: 'idle' }, { from: 23, to: 24, at: t.bed, act: 'sleep' }, { from: 0, to: 8, at: t.bed, act: 'sleep' }] }; },
  moveOut(w, nid) {
    const e = this.s(w); if (!(e.tenantDefs || {})[nid]) return;
    delete e.tenantDefs[nid];
    const sc = sceneNow(), a = sc && sc.actors.find((q) => q.id === nid);
    if (a) { a.siteCrew = true; a.leaving = true; const at = G.spawnRule.away(sc, a.x, a.y); if (at) G.law.sendTo(a, at.x, at.y); a.def = Object.assign({}, a.def, { transient: true }); }
    F.pay(w, w.npcs[nid], 'pool', w.npcs[nid].gold || 0);
    delete G.NPCS[nid]; delete w.npcs[nid];
  },
  npcLandlords(w) {
    if (w.day % 7) return;
    for (const id in this.s(w).props) {
      const q = this.s(w).props[id], c = this.catalog()[id]; if (!c || !q.owner || q.owner === 'player' || !w.npcs[q.owner]) continue;
      const home = c.residents.find((n) => n !== q.owner && w.isAlive(n)); if (!home) continue;
      const st = w.npcs[home], n = Math.round(this.fairRent(w, id)), pay = Math.min(st.gold || 0, n); st.gold -= pay; w.npcs[q.owner].gold = (w.npcs[q.owner].gold || 0) + pay;
    }
    for (const id in this.s(w).props) { const q = this.s(w).props[id], o = q.owner && w.npcs[q.owner]; if (o && (o.gold || 0) + (o.bank || 0) < 100) q.listed = true; }
  },
});
const _bz = E.bizDay;
E.bizDay = function (w) {
  const r0 = _bz.call(this, w);
  for (const v of Object.values(G.VENUES)) {
    const s = V.st(w, v.id); if (s.owner !== 'player' || s.closed) continue;
    if ((s.out || []).length) s.till += (s.out || []).length * 28;                                     // nobody draws those wages
    if (s.autoStock !== false && s.stock < 40 && s.till >= 200) { s.till -= 200; s.stock += 40; const h = s.hist && s.hist[s.hist.length - 1]; if (h) h.cost += 200; }
  }
  return r0;
};
const _rd = E.rentDay;
E.rentDay = function (w) {
  const before = new Map(this.owned(w).map((id) => [id, this.s(w).props[id].tenant && this.s(w).props[id].tenant.id]));
  // new leases go to new people, not to whoever the pool happened to hold
  const hold = {}; for (const id of this.owned(w)) { const q = this.s(w).props[id]; if (!q.tenant) hold[id] = q.asking; }
  const r = _rd.call(this, w);
  for (const [id, was] of before) {
    const q = this.s(w).props[id], now = q.tenant && q.tenant.id;
    if (was !== now && was && /^t_/.test(was)) this.moveOut(w, was);
    if (!was && now && !/^t_/.test(now)) q.tenant.id = this.moveIn(w, id, q.rent);
  }
  return r;
};
const _nm = E.npcMarket;
E.npcMarket = function (w) { this.npcLandlords(w); return _nm.call(this, w); };
// people sell what they do not need
const SELL = (w) => {
  const rng = new G.RNG('sell' + w.day + w.hour), ids = Object.keys(w.npcs), shops = Object.keys(w.shops).filter((s) => (w.shops[s].gold || 0) > 80);
  if (!shops.length) return;
  for (let i = 0; i < 6; i++) {
    const id = rng.pick(ids), st = w.npcs[id]; if (!G.NPCS[id] || !st.alive || G.NPCS[id].kid || G.NPCS[id].venue || G.NPCS[id].shop) continue;
    if ((st.gold || 0) > 60) continue;   // only when money is short
    const e = (st.inv || []).find((q) => q[1] > 0 && G.ITEMS[q[0]] && (G.ITEMS[q[0]].value || 0) >= 8 && G.ITEMS[q[0]].type !== 'weapon'); if (!e) continue;
    const sid = rng.pick(shops), s = w.shops[sid], price = Math.min(s.gold, Math.round(G.ITEMS[e[0]].value * 0.5));
    e[1]--; st.gold = (st.gold || 0) + price; s.gold -= price; const row = s.stock.find((q) => q[0] === e[0]); if (row) row[1]++; else s.stock.push([e[0], 1]);
  }
};
G.events.on('hour', () => { if (G.world) try { SELL(G.world); } catch (e) { if (G.reportError) G.reportError(e); } });
// ---------------------------------------------------------------- the dead reach the morgue on a gurney
const P = G.emsPlus, _rb = G.law.removeBody;
G.law.removeBody = function (w, j) {
  const r = _rb.apply(this, arguments), sc = sceneNow(), id = j && j.victim;
  if (id && w.dead[id]) { w.dead[id].enRoute = true; const m = sc && sc.map; if (m && m.id === 'city' && m.morgueDoor) P.gurney(sc, id); else P.admit(w, id); }
  return r;
};
P.gurney = function (scene, id) {
  const m = scene.map, b = m.building('c_hospital') || m.buildings.find((q) => /Hospital/.test(q.name)), w = scene.world; if (!b) { this.admit(w, id); return; }
  const door = { x: b.doorX * 16 + 8, y: (b.doorY + 1) * 16 + 12 }, at = G.spawnRule.away(scene, door.x, door.y); if (!at) { this.admit(w, id); return; }
  const r = m.points.from_morgue, dest = r ? { x: r.x * 16, y: r.y * 16 } : door, crew = [];
  for (let i = 0; i < 2; i++) { const c = G.law.spawn(scene, { name: 'Coroner\'s Crew', combat: 'flee', role: 'coroner', look: { top: 'jacket', shirt: '#2a2a30', bottom: 'pants', pants: '#2a2a30' } }, at.x + i * 12, at.y); c.def.faction = 'civilians'; G.law.sendTo(c, dest.x + i * 12, dest.y); c.gurney = id; crew.push(c); }
  crew[0].gurneyLead = crew[1]; crew[0].gurneyT = 90;
};
const _un = NP.update;
NP.update = function (dt, scene) {
  const r = _un.call(this, dt, scene);
  if (this.gurneyLead) { this.gurneyT -= dt; const c = this.gurneyLead; if (this.gurneyT <= 0 || (!this.moving && this.goal == null && this.distTo({ x: this.def.schedule[0].at.x * 16, y: this.def.schedule[0].at.y * 16 }) < 24)) { P.admit(scene.world, this.gurney); this.gurneyLead = null; this.gone = true; c.gone = true; scene.actors = scene.actors.filter((a) => !a.gone || a.kind !== 'npc'); } }
  return r;
};
const _adg = AP.draw;
AP.draw = function (ctx) {
  if (this.gurneyLead) { const c = this.gurneyLead, x = (this.x + c.x) / 2, y = (this.y + c.y) / 2 - 5; ctx.fillStyle = '#8e949c'; ctx.fillRect(x - 13, y + 3, 26, 2); ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(x, y, 13, 4, 0, 0, 6.3); ctx.fill(); }
  return _adg.call(this, ctx);
};
// ---------------------------------------------------------------- building: new pieces
const vk = G.vk;
vk.add('fusebox', 14, 18, (R) => { R(0, 0, 14, 18, '#5a6068'); R(1, 1, 12, 16, '#70767e'); for (let i = 0; i < 3; i++) { R(3, 3 + i * 4, 3, 2, '#2a2a30'); R(8, 3 + i * 4, 3, 2, '#c03030'); } }, { solid: true, light: { r: 40, color: '255,240,200' } });
vk.add('watermain', 16, 16, (R) => { R(6, 0, 4, 16, '#8e6a3a'); R(0, 9, 16, 4, '#8e6a3a'); R(5, 6, 6, 3, '#c02828'); R(7, 3, 2, 3, '#50565e'); }, { solid: true });
vk.add('tarp', 32, 24, (R) => { R(0, 3, 32, 21, '#2a5a8a'); for (let x = 2; x < 32; x += 6) R(x, 3, 1, 21, '#1e4468'); R(0, 2, 32, 2, '#c8c8c8'); }, { fw: 2, solid: true });
vk.add('hstairs', 16, 22, (R) => { for (let i = 0; i < 6; i++) R(1 + i, 18 - i * 3, 14 - i, 3, `rgb(${150 - i * 10},${110 - i * 8},${70 - i * 6})`); R(0, 2, 2, 20, '#5a3a22'); }, { interact: 'v_hstairs', solid: true });
const piece = (id, name, decor, value, recipe, desc) => { G.ITEMS[id] = { id, name, type: 'build', piece: true, place: { decor }, icon: 'kit_wall_wood', value, stack: 50, desc }; G.BUILD_PIECES[id] = { place: { decor }, recipe }; if (G.CRAFT_RECIPES) G.CRAFT_RECIPES.push({ out: [id, 1], in: recipe }); G.SHOPS.i_supply.stock.push([id, 6]); };
piece('kit_fusebox', 'Fuse Box', 'v_fusebox', 40, [['electrical', 4]], 'Puts a house on the grid: lights, and a better rent.'); G.ITEMS.kit_fusebox.icon = 'metal_sheet';
piece('kit_watermain', 'Water Main', 'v_watermain', 40, [['plumbing', 4]], 'Connects a house to the water: a better rent.'); G.ITEMS.kit_watermain.icon = 'metal_sheet';
piece('kit_tarp', 'Construction Tarp', 'v_tarp', 12, [['cloth', 4]], 'Hides work from the street. Inspectors can still look behind it.'); G.ITEMS.kit_tarp.icon = 'cloth';
piece('kit_stairs', 'Staircase', 'v_hstairs', 60, [['planks', 10], ['nails', 2]], 'Place it in a roofed house to build an upper floor.'); G.ITEMS.kit_stairs.icon = 'planks';
// ---------------------------------------------------------------- building: rules, rotation, measurements
const hfId = (bid, n) => `hf_${bid}_${n}`, parseHf = (id) => /^hf_(.+)_(\d+)$/.exec(id || '');
const roomOf = (scene, tx, ty) => { const b = scene.map.buildingAtTile(tx, ty); if (b && b.playerBuilt) return { bid: b.id, level: 1, x: b.x, y: b.y, w: b.w, h: b.h, map: scene.map.id }; const m = parseHf(scene.map.id); if (m) { const f = E.s(scene.world).hand[m[1]]; return f && { bid: m[1], level: +m[2], x: f.x, y: f.y, w: f.w, h: f.h, map: f.map }; } return null; };
const makeFloor = (bid, n) => { G.MAPGEN[hfId(bid, n)] = () => { const f = E.s(G.world).hand[bid], m = new G.TileMap(hfId(bid, n), f.w + 2, f.h + 2, G.T.wall_dark); m.meta = { name: `Floor ${n}`, region: 'city', music: 'city', darkness: 0, indoor: true, ownLight: 0.12, district: 'home' }; m.fill(2, 2, f.w - 2, f.h - 2, G.T.woodfloor); const st = f.stairs[n - 1] || { x: 3, y: 3 }; m.addDecor('v_hstairs', st.x - f.x + 1, st.y - f.y + 1, { down: true, level: n, bid }); m.points.from_stairs = { x: st.x - f.x + 2, y: st.y - f.y + 1 }; m.dangerZones = []; m.animalZones = []; m.finalize(); return m; }; };
const _why = H.why;
H.why = function (scene, id, tx, ty) {
  const pc = G.BUILD_PIECES[id];
  if (id === 'kit_stairs' && !roomOf(scene, tx, ty)) return 'Stairs go inside a finished house.';
  const stop = (E.s(scene.world).illegal || []).find((q) => q.found && q.map === scene.map.id && Math.hypot(q.tx - tx, q.ty - ty) < 14);
  if (stop) return 'There is a stop order on this site.';
  const held = E.owned(scene.world).find((i) => { const c = E.catalog()[i]; return E.s(scene.world).props[i].sealed && c.map === scene.map.id && tx >= c.x && tx < c.x + c.w && ty >= c.y && ty < c.y + c.h; });
  if (held) return 'This property is sealed.';
  if (pc && G.ITEMS[id] && (id === 'kit_fusebox' || id === 'kit_watermain') && !roomOf(scene, tx, ty)) return 'That goes inside a finished house.';
  return _why.apply(this, arguments);
};
const _pl = H.place;
H.place = function (scene, id, tx, ty) {
  const room = roomOf(scene, tx, ty), why = _pl.apply(this, arguments); if (why) return why;
  const w = scene.world, built = H.built(w, scene.map.id)[tx + ',' + ty];
  if (built && scene.buildRot) { built.rot = scene.buildRot; for (const d of scene.map.decorsAt(tx, ty)) if (d.tx === tx && d.ty === ty) d.rot = scene.buildRot; }
  if (id === 'kit_stairs' && room) {
    const e = E.s(w); e.hand = e.hand || {}; const f = (e.hand[room.bid] = e.hand[room.bid] || { map: room.map, x: room.x, y: room.y, w: room.w, h: room.h, stairs: {}, top: 1 });
    const n = room.level + 1; f.stairs[n - 1] = { x: tx + (room.level > 1 ? f.x - 1 : 0), y: ty + (room.level > 1 ? f.y - 1 : 0) }; f.top = Math.max(f.top, n); makeFloor(room.bid, n);
  }
  if ((id === 'kit_fusebox' || id === 'kit_watermain') && room) { const e = E.s(w); e.util = e.util || {}; const u = (e.util[room.bid] = e.util[room.bid] || {}); u[id === 'kit_fusebox' ? 'power' : 'water'] = true; }
  return '';
};
const _fr = E.fairRent;
E.fairRent = function (w, id) { const u = (this.s(w).util || {})[id] || {}; return _fr.call(this, w, id) * (1 + (u.power ? 0.15 : 0) + (u.water ? 0.15 : 0)); };
// [R] turns a piece; wide furniture only flips, so it still fills the same tiles
const _gu = GS.update;
GS.update = function (dt) {
  if (this.buildMode && G.scenes.top() === this && G.input.pressed.has('KeyR')) { const list = H.pieces(this.world), id = list[G.util.clamp(this.buildSel || 0, 0, list.length - 1)], pc = id && G.BUILD_PIECES[id], d = pc && pc.place.decor && G.DECOR[pc.place.decor]; if (d) { const wide = (d.fw || 1) > 1; this.buildRot = wide ? ((this.buildRot || 0) ? 0 : 2) : ((this.buildRot || 0) + 1) % 4; G.audio.play('select'); } G.input.pressed.delete('KeyR'); }
  return _gu.call(this, dt);
};
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) { if (!o.rot) return _dd.call(this, ctx, o, s, scene); ctx.save(); ctx.translate(o.x, o.y - 8); ctx.rotate(o.rot * Math.PI / 2); ctx.translate(-o.x, -(o.y - 8)); try { return _dd.call(this, ctx, o, s, scene); } finally { ctx.restore(); } };
const _rn = GS.render;
GS.render = function (ctx) {
  _rn.call(this, ctx);
  if (!this.buildMode || !this.player || !H.target) return;
  const t = H.target(this), w = this.world, R0 = G.renderer, U = G.ui, mine = E.owned(w).map((i) => E.catalog()[i]).find((c) => c.map === this.map.id && t.tx >= c.x && t.tx < c.x + c.w && t.ty >= c.y && t.ty < c.y + c.h);
  R0.uiTransform();
  const lines = [mine ? `Lot ${mine.w} x ${mine.h}   ${t.tx - mine.x + 1} from the left, ${t.ty - mine.y + 1} from the top` : `Tile ${t.tx}, ${t.ty}`];
  if (!E.legal(w, this.map.id, t.tx, t.ty)) lines.push('Unauthorized: this would be illegal construction.');
  lines.forEach((l, i) => U.text(ctx, l, R0.uiW / 2, 46 + i * 12, { size: 9, align: 'center', color: i ? '#ff8a7a' : '#e8e4d0', shadow: true }));
};
const _rl = H.remove;
H.remove = function (scene, tx, ty) { const b = H.built(scene.world, scene.map.id)[tx + ',' + ty]; if (b && b.decor === 'v_hstairs') { const room = roomOf(scene, tx, ty), f = room && E.s(scene.world).hand[room.bid]; if (f && f.top > room.level) return 'Clear the floor above first.'; if (f) { delete f.stairs[room.level]; f.top = room.level; } } return _rl.apply(this, arguments); };
const _use = GS.useDecor, _lab = GS.decorLabel;
GS.useDecor = function (d) {
  if (d.def.interact !== 'v_hstairs') return _use.apply(this, arguments);
  const w = this.world, e = E.s(w);
  if (d.down) { const f = e.hand[d.bid]; if (d.level === 2) { this._hfTo = f.stairs[1]; this.changeMap(f.map); } else { const s = f.stairs[d.level - 1]; this._hfTo = { x: s.x - f.x + 1, y: s.y - f.y + 1 }; this.changeMap(hfId(d.bid, d.level - 1)); } return undefined; }
  const room = roomOf(this, d.tx, d.ty); if (!room) { this.toast('It leads nowhere yet: this is not a finished house.', 'warn'); return undefined; }
  const n = room.level + 1; if (G.MAPGEN[hfId(room.bid, n)]) this.changeMap(hfId(room.bid, n), 'from_stairs');
  return undefined;
};
GS.decorLabel = function (d) { return d.def.interact === 'v_hstairs' ? (d.down ? 'Go downstairs' : 'Go upstairs') : _lab.apply(this, arguments); };
const _lm = GS.loadMap;
GS.loadMap = function (id) { const r = _lm.apply(this, arguments); if (this._hfTo) { const t = this._hfTo; this._hfTo = null; this.player.x = (t.x + 1) * 16 + 8; this.player.y = t.y * 16 + 12; } const b = H.built(this.world, id); for (const k in b) if (b[k].rot) { const [x, y] = k.split(',').map(Number); for (const d of this.map.decorsAt(x, y)) if (d.tx === x && d.ty === y) d.rot = b[k].rot; } return r; };
// ---------------------------------------------------------------- the law: stop orders, sealing, confiscation
const _ld = E.lawDay;
E.lawDay = function (w) {
  const e = this.s(w), had = new Set(e.illegal.filter((q) => q.found));
  // tarps and walls keep prying eyes off: discovery gets harder, not impossible
  for (const q of e.illegal) if (!q.found) { const m = G.maps.get(q.map), hidden = m.decor.some((d) => d.type === 'v_tarp' && Math.hypot(d.tx - q.tx, d.ty - q.ty) < 8) || !!m.buildingAtTile(q.tx, q.ty); q.hidden = hidden; }
  const seen = e.illegal.map((q) => [q, q.seen, q.n]); for (const q of e.illegal) if (q.hidden) { q.seen = Math.floor((q.seen || 0) / 2); q.n = Math.ceil(q.n * 0.4); }
  const r = _ld.call(this, w);
  for (const [q, s, n] of seen) if (e.illegal.includes(q) && q.hidden) { q.seen = s; q.n = n; }
  for (const q of e.illegal) {
    if (q.found && !had.has(q)) { const sc = sceneNow(); this.say(w, 'Stop order: all work on that site is suspended.', 'bad'); if (sc && sc.map.id === q.map && G.law.dispatch) G.law.dispatch(sc, q.tx * 16, q.ty * 16, 'backup'); }
    const id = this.owned(w).find((i) => { const c = this.catalog()[i]; return c.map === q.map && q.tx >= c.x && q.tx < c.x + c.w && q.ty >= c.y && q.ty < c.y + c.h; });
    if (id && q.found && q.stage === 3 && !e.props[id].sealed) { e.props[id].sealed = true; if (w.keys) delete w.keys[id]; if (G.VENUES[id]) V.st(w, id).sealed = true; G.maps.invalidate(q.map); this.say(w, `${this.catalog()[id].name} has been sealed by the city.`, 'bad'); }
    if (id && q.found && q.stage === 5 && q.n >= 60) { this.confiscate(w, id); }
  }
  return r;
};
Object.assign(E, {
  confiscate(w, id) { const c = this.catalog()[id]; this.repossess(w, id); this.s(w).props[id].sealed = false; this.say(w, `The city confiscated ${c.name}.`, 'bad'); },
  // pay up and regularize, before the bulldozers arrive
  violation(w) { return this.s(w).illegal.find((q) => q.found) || null; },
  settle(w, p) {
    const q = this.violation(w); if (!q) return 'Nothing on file.';
    const n = 300 + q.n * 15; if (this.funds(w, p) < n) return `It will cost $${n}.`;
    this.charge(w, p, n, 'Fine');
    this.s(w).illegal = this.s(w).illegal.filter((x) => x !== q);
    for (const id of this.owned(w)) { const pr = this.s(w).props[id]; if (pr.sealed) { pr.sealed = false; w.keys = w.keys || {}; w.keys[id] = true; if (G.VENUES[id]) V.st(w, id).sealed = false; } }
    G.maps.invalidate(q.map);
    return null;
  },
});
const _ap = E.applyToMap;
E.applyToMap = function (m, w) {
  const e = w.estate;
  // upper floors go on file first: the ground floor's planner then lays out the stairs by itself
  for (const b of e ? e.built : []) {
    const B = E.BP[b.bp]; if (b.map !== m.id || !B.floors) continue;
    G.FLOORS[b.id] = { base: b.map, levels: Array.from({ length: B.floors - 1 }, () => ({ kind: B.units ? 'apartment' : b.bp === 'office' ? 'office' : 'upstairs' })) };
    for (let n = 2; n <= B.floors; n++) G.MAPGEN[G.floorId(b.id, n)] = () => G.buildFloor(b.id, n);
  }
  _ap.call(this, m, w);
  if (!e) return;
  for (const id in e.props) { if (!e.props[id].sealed) continue; const c = this.catalog()[id]; if (c.map !== m.id) continue; const b = m.building(id); if (b) { m.addDecor('v_seal_tape', b.doorX, b.doorY + 1); } else for (let x = c.x; x < c.x + c.w; x++) m.addDecor('v_seal_tape', x, c.y + c.h - 1); }
};
// the books at the Annex
const CL = G.DIALOGUES.v_clerk.start.choices;
CL.splice(CL.length - 2, 0, { text: 'I want to settle my violation.', if: (c) => !!E.violation(c.w), do: (c) => { const err = E.settle(c.w, c.p); c.scene.toast(err || 'Settled. Build legally from now on.', err ? 'bad' : 'good'); return 'start'; } });
const _wl = G.onWorldLoaded;
G.onWorldLoaded = function (w) {
  if (_wl) _wl.apply(this, arguments);
  const e = w.estate; if (!e) return;
  for (const nid in e.tenantDefs || {}) E.tenantDef(nid, e.tenantDefs[nid]);
  for (const bid in e.hand || {}) for (let n = 2; n <= e.hand[bid].top; n++) makeFloor(bid, n);
  for (const id in w.venues || {}) for (const i of w.venues[id].out || []) E.setStaff(w, id, i, true);
};
})();
