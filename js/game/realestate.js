'use strict';
// Owning the city. w.estate holds everything: property records, permits, building sites, tenants, loans, the log.
//   G.estate.catalog: every building and lot on the city maps with a type, size, district and owner, worked out from the
//   maps (nothing to save). What changes (owner, condition, tenants, issues) lives in w.estate.props[id].
//   Buying: from whoever owns it. The bank's own stock sells at the asking price; a resident sells only if they agree
//   (their feelings for you, their money, what you offer). Negotiation is a charisma check. Mortgages: 20% down, weekly.
//   Permits: applied for at the Municipal Annex, take days, can be delayed, rejected, or cost extra.
//   Construction: pick a lot and a blueprint, have the permit, the materials and a contractor; the site goes up in stages
//   you can see (foundation, frame, walls, scaffolding down) over days, with a crew on it during the day. When it is done
//   the building is real: it is rebuilt from w.estate.built each time the map is generated.
//   Building by hand ([B]) on the city maps follows the same law: no title or no permit and it is illegal construction.
//   Discovery: a witness at the time, a neighbor's report, an inspection. Then a fine, a stop order, a demolition order,
//   sealing, and in serious cases confiscation, through the normal crime system. Rural and forest land has no zoning.
//   Rent: tenants pay weekly from their real money, get behind, complain, ask for repairs, leave, do damage.
//   Businesses: all venues have an owner and accounts, with competitors adjusting to each other. You can buy one and run
//   it (prices, staff, stock, hours, cleaning, upgrades); it runs without you. Weekly: taxes, utilities, insurance,
//   installments. Neglect wears a property down. Unpaid debts end in repossession.
(() => {
const GS = G.GameScene.prototype, S0 = G.venueSys, F = G.finance, H = G.home, pick = (a) => G.rng.pick(a), clamp = G.util.clamp;
G.CRIMES.illegal_build = { label: 'Illegal construction', bounty: 120, rep: -4, tension: 1 };
const mat = (id, name, value, desc) => { G.ITEMS[id] = { id, name, type: 'build', mat: true, icon: 'metal_sheet', value, desc, stack: 50 }; if (G.SHOPS.i_supply) G.SHOPS.i_supply.stock.push([id, 30]); };
mat('steel_beam', 'Steel Beam', 14, 'Structural steel.'); mat('roofing', 'Roofing Materials', 7, 'Felt, shingles, flashing.'); mat('electrical', 'Electrical Components', 9, 'Cable, breakers, boxes.'); mat('plumbing', 'Plumbing Materials', 9, 'Pipe, valves, fittings.'); mat('paint', 'Paint and Finishes', 5, 'Primer, paint, filler.');
G.ITEMS.prop_ledger = { id: 'prop_ledger', name: 'Property Ledger', type: 'misc', icon: 'letter', value: 0, stack: 1, desc: 'Deeds, permits, tenants, accounts. Use it to look after what you own.' };
G.ITEM_USE = G.ITEM_USE || {}; G.ITEM_USE.prop_ledger = (game) => { const top = G.scenes.top(); if (top !== game) G.scenes.remove(top); G.scenes.push(E.menu(game)); return true; };
const CITY = ['city', 'suburbs', 'southside', 'eastside', 'heights', 'industrial', 'neon', 'arts'];
const BASE = { center: 170, suburbs: 120, southside: 70, eastside: 75, heights: 340, industrial: 60, neon: 180, arts: 200 };
const LABEL = { house: 'House', apartment: 'Apartment Building', shop: 'Commercial Building', warehouse: 'Warehouse', business: 'Business', lot: 'Empty Lot', ruin: 'Abandoned Building', mansion: 'Luxury Property', office: 'Office Building' };
const NOSALE = /Police|City Hall|Hospital|Jail|Church|School|Fire Station|Bank|Cannery|Municipal/;
const PERMITS = { construction: ['Construction Permit', 180, [3, 8]], renovation: ['Renovation Permit', 90, [2, 5]], demolition: ['Demolition Permit', 120, [2, 6]], commercial: ['Commercial Development Permit', 320, [5, 12]] };
// wide, tall, cost of labour, days, floors, materials, kind (for the furnishing), venue kind if it opens for business
const BP = {
  house: { name: 'House', w: 10, h: 8, cost: 2800, days: 6, mats: { planks: 40, bricks: 30, cement: 14, glass_pane: 6, roofing: 12, electrical: 6, plumbing: 6, paint: 6 }, furnish: 'house', zone: 'res', wall: 'wall_brick', floor: 'woodfloor' },
  duplex: { name: 'Two-Story House', w: 11, h: 9, cost: 4600, days: 9, floors: 2, mats: { planks: 60, bricks: 44, cement: 20, glass_pane: 10, roofing: 14, electrical: 9, plumbing: 9, paint: 9 }, furnish: 'house', zone: 'res', wall: 'wall_siding', floor: 'woodfloor' },
  flats: { name: 'Apartment Block', w: 14, h: 10, cost: 9000, days: 14, floors: 3, units: 6, mats: { bricks: 90, cement: 40, steel_beam: 18, glass_pane: 16, roofing: 16, electrical: 16, plumbing: 16, paint: 14 }, furnish: 'house', zone: 'res', name2: 'Apartments', wall: 'wall_brick', floor: 'woodfloor' },
  shop: { name: 'Shop', w: 10, h: 8, cost: 3200, days: 7, mats: { bricks: 34, cement: 16, glass_pane: 10, roofing: 10, electrical: 6, plumbing: 3, paint: 6 }, furnish: 'shop', zone: 'com', venue: 'store', wall: 'wall_plaster', floor: 'tilefloor' },
  restaurant: { name: 'Restaurant', w: 13, h: 10, cost: 6400, days: 10, mats: { bricks: 50, cement: 22, glass_pane: 10, roofing: 12, electrical: 10, plumbing: 10, paint: 8 }, zone: 'com', venue: 'diner', wall: 'wall_brick', floor: 'tilefloor' },
  bar: { name: 'Bar', w: 12, h: 10, cost: 4800, days: 8, mats: { bricks: 44, planks: 24, cement: 16, roofing: 10, electrical: 8, plumbing: 6, paint: 6 }, zone: 'com', venue: 'dive', wall: 'wall_brick', floor: 'woodfloor' },
  nightclub: { name: 'Nightclub', w: 16, h: 11, cost: 11000, days: 14, mats: { steel_beam: 16, bricks: 70, cement: 34, roofing: 14, electrical: 18, plumbing: 8, paint: 10 }, zone: 'com', venue: 'club', wall: 'wall_dark', floor: 'darkstone' },
  warehouse: { name: 'Warehouse', w: 14, h: 10, cost: 3600, days: 7, mats: { steel_beam: 20, cement: 30, roofing: 14, electrical: 4 }, furnish: 'garage', zone: 'com', wall: 'wall_concrete', floor: 'concrete' },
  workshop: { name: 'Workshop', w: 10, h: 8, cost: 2400, days: 5, mats: { steel_beam: 8, bricks: 20, cement: 12, roofing: 8, electrical: 5 }, furnish: 'garage', zone: 'com', wall: 'wall_concrete', floor: 'concrete' },
  garage: { name: 'Garage', w: 8, h: 7, cost: 1200, days: 3, mats: { bricks: 16, cement: 8, roofing: 6, electrical: 2 }, furnish: 'garage', zone: 'res', wall: 'wall_concrete', floor: 'concrete' },
  office: { name: 'Office Building', w: 12, h: 9, cost: 5600, days: 9, floors: 2, mats: { steel_beam: 10, bricks: 40, cement: 18, glass_pane: 16, roofing: 10, electrical: 12, plumbing: 6, paint: 8 }, furnish: 'office', zone: 'com', wall: 'wall_marble', floor: 'tilefloor' },
  storage: { name: 'Storage Units', w: 12, h: 8, cost: 1800, days: 4, mats: { metal_sheet: 30, cement: 12, roofing: 8 }, furnish: 'garage', zone: 'com', wall: 'wall_concrete', floor: 'concrete' },
};
G.BLUEPRINTS = BP;
const CREW = {
  bert: { name: 'Bert and Sons', role: 'Contractor', rate: 0.8, speed: 0.75, reliable: 0.9, desc: 'Cheap, slow, always turns up.' },
  ines: { name: 'Ines Construction', role: 'Contractor', rate: 1, speed: 1, reliable: 0.97, desc: 'Fair price, does what she says.' },
  oskar: { name: 'Oskar and Partners', role: 'Contractor', rate: 1.5, speed: 1.4, reliable: 0.99, desc: 'Expensive, quick, flawless.' },
  cesar: { name: 'Cesar', role: 'Contractor', rate: 0.55, speed: 1, reliable: 0.55, desc: 'Cash only. Sometimes disappears for a while.' },
};
const EXTRA = { architect: ['Architect', 0.08, 'Shortens the job and raises the quality.'], electrician: ['Electrician', 0.05, 'Without one, the wiring fails inspection.'], plumber: ['Plumber', 0.05, 'Without one, the pipes fail inspection.'] };
const E = G.estate = {
  BP, CREW, PERMITS, LABEL,
  s(w) { const e = (w.estate = w.estate || { props: {}, permits: [], sites: [], built: [], illegal: [], loans: [], log: [], market: 1, nextId: 1 }); return e; },
  say(w, text, kind) { const e = this.s(w); e.log.push([w.day, text]); if (e.log.length > 60) e.log.shift(); if (w.log) w.log(text, kind || 'info'); const sc = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene); if (sc) sc.toast(text, kind === 'bad' ? 'bad' : kind === 'good' ? 'good' : 'warn'); },
  // ---------------------------------------------------------------- what exists
  catalog() {
    if (this._cat) return this._cat;
    const cat = {};
    for (const id of CITY) {
      const m = G.maps.get(id), d = m.meta.district || id;
      for (const b of m.buildings) {
        if (cat[b.id] || NOSALE.test(b.name)) continue;
        const v = b.venue && G.VENUES[b.venue], s = Object.values(G.SHOPS).find((q) => G.NPCS[q.owner] && G.NPCS[q.owner].home === b.id), res = Object.keys(G.NPCS).filter((n) => G.NPCS[n].home === b.id && G.NPCS[n].map === id);
        const type = v ? 'business' : /Warehouse|Garage|Storage|Factory/.test(b.name) ? 'warehouse' : /Flats|Apartment|Tenement/.test(b.name) ? 'apartment' : b.kind === 'mansion' ? 'mansion' : b.kind === 'office' ? 'office' : s || b.kind === 'shop' || b.kind === 'inn' ? 'shop' : !res.length ? 'ruin' : 'house';
        cat[b.id] = { id: b.id, map: id, name: v ? v.name : b.name, type, w: b.w, h: b.h, x: b.x, y: b.y, district: d, owner0: res[0] || (s && s.owner) || (v ? null : null), residents: res };
      }
    }
    (G.ART_LOTS || []).forEach(([x, y, w, h], i) => { const id = 'lot_' + i; cat[id] = { id, map: 'arts', name: `Empty Lot ${i + 1}, Old Quarter`, type: 'lot', w, h, x, y, district: 'arts', residents: [], zone: i < 2 ? 'res' : 'com' }; });
    return (this._cat = cat);
  },
  rec(w, id) { const e = this.s(w), c = this.catalog()[id]; if (!c) return null; if (!e.props[id]) { const r = new G.RNG('p' + id); e.props[id] = { owner: c.owner0 || null, cond: c.type === 'ruin' ? 25 + r.int(0, 20) : c.type === 'lot' ? 100 : 50 + r.int(0, 45), issues: [], tenant: null, rent: 0, listed: true }; } return e.props[id]; },
  price(w, id) {
    const c = this.catalog()[id], r = this.rec(w, id), area = c.w * c.h / (G.WORLD_SCALE * G.WORLD_SCALE), k = { house: 1, apartment: 1.1, shop: 1.3, warehouse: 0.7, business: 1.5, lot: 0.45, ruin: 0.5, mansion: 1.6, office: 1.3 }[c.type] || 1;
    let n = area * (BASE[c.district] || 100) * k * (0.45 + r.cond / 145) * this.s(w).market;
    if (c.type === 'business') { const s = S0.st(w, id); n *= 0.7 + s.rep / 110; }
    if ((this.s(w).hood || {})[c.district]) n *= this.s(w).hood[c.district];
    return Math.round(n / 10) * 10;
  },
  mine(w, id) { const r = this.s(w).props[id]; return !!r && r.owner === 'player'; },
  owned(w) { return Object.keys(this.s(w).props).filter((id) => this.s(w).props[id].owner === 'player'); },
  available(w) { return Object.keys(this.catalog()).filter((id) => { const r = this.rec(w, id), c = this.catalog()[id]; return r.owner !== 'player' && (c.type === 'lot' || r.listed !== false); }); },
  // pay from the wallet first, then the account
  charge(w, p, n, why) { const e = G.economy.state(w), wallet = Math.min(p.gold, n); p.gold -= wallet; const rest = n - wallet, bank = Math.min(Math.floor(e.bank), rest); if (bank) { e.bank -= bank; G.economy.bankLog(w, `${why} $${bank}`); } return wallet + bank; },
  funds(w, p) { return p.gold + Math.floor(G.economy.state(w).bank); },
  sellerAgrees(w, id, offer) {
    const r = this.rec(w, id), o = r.owner; if (!o || !w.npcs[o]) return true;
    const st = w.npcs[o], fair = this.price(w, id), P = G.social.persona(o), broke = (st.gold || 0) + (st.bank || 0) < 200;
    return offer >= fair * (1.25 - (st.disp || 0) / 300 - (broke ? 0.25 : 0) - (100 - P.patience) / 1000) || (st.disp || 0) >= 60 && offer >= fair;
  },
  give(w, scene, id, how) {
    const c = this.catalog()[id], r = this.rec(w, id), prev = r.owner;
    r.owner = 'player'; r.listed = false; r.bought = w.day; w.keys = w.keys || {}; if (c.type !== 'lot') w.keys[id] = true;
    if (scene.player && !scene.player.inventory.has('prop_ledger')) scene.player.inventory.add('prop_ledger', 1);
    if (c.type === 'business') { const s = S0.st(w, id); s.owner = 'player'; s.staffOK = true; }
    // whoever lived there stays on, now as your tenant
    if (c.residents.length && c.type !== 'business') { const t = c.residents[0]; r.tenant = { id: t, since: w.day, late: 0, mood: 60 }; r.rent = Math.round(this.fairRent(w, id)); }
    if (prev && prev !== 'player' && w.npcs[prev]) G.mem.add(w, prev, { k: 'sale', t: `I sold ${c.name} to the player`, by: 'player', s: 'did', f: 1, i: 3 });
    this.say(w, `You now own ${c.name}${how || ''}.`, 'good');
  },
  buy(scene, id, price, mortgage) {
    const w = scene.world, p = scene.player, r = this.rec(w, id), o = r.owner, need = mortgage ? Math.round(price * 0.2) : price;
    if (this.funds(w, p) < need) return 'You cannot afford that.';
    if (o && w.npcs[o] && !this.sellerAgrees(w, id, price)) { G.social.addDisp(w, o, -1); return 'The owner turned you down.'; }
    this.charge(w, p, need, 'Property');
    if (o && w.npcs[o]) w.npcs[o].gold = (w.npcs[o].gold || 0) + need; else F.state(w).pool += need;   // (a bank's property: the money goes back into the economy)
    if (mortgage) { const debt = price - need, weeks = 20, rate = 1.18; this.s(w).loans.push({ kind: 'mortgage', prop: id, left: Math.round(debt * rate), week: Math.ceil(debt * rate / weeks), missed: 0 }); if (o && w.npcs[o]) w.npcs[o].bank = (w.npcs[o].bank || 0) + debt; }
    this.give(w, scene, id, mortgage ? ' (with a mortgage)' : '');
    G.audio.play('coin');
    return null;
  },
  fairRent(w, id) { const c = this.catalog()[id], r = this.rec(w, id); return (c.w * c.h * (BASE[c.district] || 100) / 30) * (0.5 + r.cond / 200) * (c.type === 'apartment' ? 3 : 1) / 3; },
  // ---------------------------------------------------------------- permits
  apply(scene, id, type) {
    const w = scene.world, p = scene.player, P = PERMITS[type], e = this.s(w), c = this.catalog()[id];
    if (!this.mine(w, id)) return 'You have to own it first.';
    if (type === 'commercial' && c.zone === 'res') return 'This lot is zoned residential. No.';
    if (e.permits.some((q) => q.prop === id && q.type === type && q.status !== 'rejected')) return 'There is already an application on file.';
    if (this.funds(w, p) < P[1]) return `The fee is $${P[1]}.`;
    this.charge(w, p, P[1], 'Permit fee'); G.audio.play('coin');
    const r = new G.RNG('pm' + w.day + id + type);
    e.permits.push({ prop: id, type, status: 'pending', due: w.day + r.int(P[2][0], P[2][1]), by: w.day });
    return null;
  },
  has(w, id, type) { return this.s(w).permits.some((q) => q.prop === id && q.status === 'granted' && (q.type === type || (type === 'construction' && q.type === 'commercial'))); },
  permitDay(w) {
    const r = new G.RNG('pd' + w.day);
    for (const q of this.s(w).permits) {
      if (q.status !== 'pending' || w.day < q.due) continue;
      const roll = r.next(), n = PERMITS[q.type][0], name = this.catalog()[q.prop].name;
      if (roll < 0.2) { q.due += r.int(2, 5); this.say(w, `${n} for ${name}: delayed. A form is missing.`); }
      else if (roll < 0.32) { q.status = 'rejected'; this.say(w, `${n} for ${name}: rejected.`, 'bad'); }
      else if (roll < 0.45 && !q.extra) { q.extra = Math.round(PERMITS[q.type][1] * 0.4); q.due += 2; this.say(w, `${n} for ${name}: an unexpected fee of $${q.extra} is due at the Annex.`); }
      else { q.status = 'granted'; this.say(w, `${n} for ${name}: granted.`, 'good'); }
    }
  },
  // ---------------------------------------------------------------- building sites
  fits(id, bp) { const c = this.catalog()[id], b = BP[bp]; return c.type === 'lot' && b.w <= c.w - 1 && b.h <= c.h - 1 && (!c.zone || c.zone === 'com' || b.zone === 'res'); },
  matsShort(w, p, bp) { return Object.entries(BP[bp].mats).filter(([k, n]) => H.count(p, k) < n).map(([k, n]) => [k, n - H.count(p, k)]); },
  matCost(bp) { return Object.entries(BP[bp].mats).reduce((s, [k, n]) => s + (G.ITEMS[k].value || 3) * 1.4 * n, 0); },
  start(scene, id, bp, crew, extras, supplied) {
    const w = scene.world, p = scene.player, e = this.s(w), B = BP[bp], cr = CREW[crew];
    if (!this.mine(w, id)) return 'You do not own this.';
    if (!this.fits(id, bp)) return 'That will not fit here, or the zoning forbids it.';
    if (e.sites.some((q) => q.prop === id) || e.built.some((q) => q.prop === id)) return 'Something is already here.';
    if (!this.has(w, id, B.zone === 'com' ? 'commercial' : 'construction')) return 'No permit for that. Building anyway would be a crime.';
    const labour = Math.round(B.cost * cr.rate * (1 + extras.reduce((s, k) => s + EXTRA[k][1], 0))), buyMats = supplied ? Math.round(this.matCost(bp) * 1.25) : 0;
    if (!supplied && this.matsShort(w, p, bp).length) return 'You are short of materials.';
    if (this.funds(w, p) < labour + buyMats) return `You need $${labour + buyMats}.`;
    this.charge(w, p, labour + buyMats, 'Construction');
    if (!supplied) for (const [k, n] of Object.entries(B.mats)) H.take(p, k, n);
    e.sites.push({ id: e.nextId++, prop: id, bp, crew, extras, pct: 0, days: B.days / cr.speed * (extras.includes('architect') ? 0.85 : 1), stage: 0, paused: 0 });
    G.maps.invalidate(this.catalog()[id].map);
    this.say(w, `Work starts: ${B.name}, ${this.catalog()[id].name}.`, 'good');
    return null;
  },
  siteDay(w) {
    const e = this.s(w), r = new G.RNG('sd' + w.day);
    for (const q of e.sites.slice()) {
      const cr = CREW[q.crew], c = this.catalog()[q.prop];
      if (q.paused > 0) { q.paused--; continue; }
      if (!r.chance(cr.reliable)) { q.paused = r.int(1, 3); this.say(w, `${cr.name} did not turn up at ${c.name}.`); continue; }
      q.pct = Math.min(100, q.pct + 100 / q.days);
      const stage = Math.floor(q.pct / 25); if (stage !== q.stage) { q.stage = stage; G.maps.invalidate(c.map); }
      if (q.pct >= 100) this.finish(w, q);
    }
  },
  finish(w, q) {
    const e = this.s(w), c = this.catalog()[q.prop], B = BP[q.bp], ok = !(B.mats.electrical && !q.extras.includes('electrician') && Math.random() < 0.35) && !(B.mats.plumbing && !q.extras.includes('plumber') && Math.random() < 0.35);
    e.sites = e.sites.filter((x) => x !== q);
    const rec = { prop: q.prop, bp: q.bp, id: 'p_' + q.prop, map: c.map, x: c.x + 1, y: c.y, w: B.w, h: B.h, name: B.name2 || B.name, quality: (q.extras.includes('architect') ? 80 : 60) + (q.crew === 'oskar' ? 15 : 0) };
    e.built.push(rec); this.rec(w, q.prop).cond = ok ? 95 : 70;
    if (!ok) this.rec(w, q.prop).issues.push('electric');
    if (B.venue) this.openVenue(w, rec);
    delete this.catalog()[q.prop].lotDone;
    G.maps.invalidate(c.map);
    this.say(w, `${B.name} finished at ${c.name}.${ok ? '' : ' It failed part of the inspection: wiring problems.'}`, ok ? 'good' : 'warn');
  },
  // a building that opens for business becomes a venue like any other, with its own staff
  openVenue(w, rec) {
    const B = BP[rec.bp], id = rec.id, v = (G.VENUES[id] = G.VENUES[id] || { id, map: rec.map, x: rec.x, y: rec.y, w: rec.w, h: rec.h, name: `Your ${B.name}`, kind: B.venue, hours: G.VENUE_KINDS[B.venue].hours, stock: B.venue === 'store' ? 'books' : undefined, sign: ['#f0f0f0', '#303038'], wall: B.wall, floor: B.floor, built: true });
    S0.staffFor(v); for (const k in G.NPCS) if (k.startsWith(id + '_s') && !w.npcs[k]) w.npcs[k] = w.freshNpcState(k, null);
    const s = S0.st(w, id); s.owner = 'player'; s.rep = 45;
    this.catalogAdd(rec);
  },
  catalogAdd(rec) { this.catalog()[rec.id] = { id: rec.id, map: rec.map, name: rec.name, type: 'business', w: rec.w, h: rec.h, x: rec.x, y: rec.y, district: 'arts', residents: [] }; },
  // what stands on a map, from the record
  applyToMap(m, w) {
    const e = w.estate; if (!e) return;
    const decor = (t, x, y) => { if (m.inBounds(x, y) && !m.decors0) m.addDecor('v_' + t, x, y); };
    for (const q of e.sites) {
      const c = this.catalog()[q.prop]; if (!c || c.map !== m.id) continue;
      const x0 = c.x + 1, y0 = c.y + 1, x1 = x0 + BP[q.bp].w - 1, y1 = y0 + BP[q.bp].h - 1, st = q.stage;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) decor('foundation', x, y);
      if (st >= 1) for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) decor('wall_frame', x, y);
      if (st >= 2) for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) decor('wall_half', x, y);
      if (st >= 2) for (let x = x0; x + 2 <= x1; x += 3) decor('scaffold', x, y1 + 1);
      decor('mixer', c.x, c.y + c.h - 1); decor('brick_pile', c.x + 3, c.y + c.h - 1); decor('lumber_pile', c.x + 6, c.y + c.h - 1); decor('cone', c.x + 9, c.y + c.h - 1); decor('cone', c.x + 10, c.y + c.h - 1);
      m.points['site_' + q.id] = { x: x0 - 1 >= 0 ? x0 + 2 : x0, y: y1 + 2 };
    }
    for (const b of e.built) {
      if (b.map !== m.id || m.building(b.id)) continue;
      const B = BP[b.bp], r = new G.RNG('b' + b.id), v = G.VENUES[b.id];
      m.fill(b.x - 1, b.y, b.w + 2, b.h + 1, G.T.sidewalk);
      if (v) { S0.build(m, v, r); }
      else { const o = m.addBuilding(b.id, b.x, b.y, b.w, b.h, { name: b.name, wall: B.wall, floor: B.floor, roof: 'flat', kind: 'house', grow: false }); G.MB.furnish(m, o, B.furnish || 'house', r, { beds: B.units || 1 }); w.keys = w.keys || {}; w.keys[b.id] = true; }
    }
  },
  // the crew turns up on foot, works, goes home
  crew(scene) {
    const w = scene.world, e = this.s(w), on = e.sites.find((q) => this.catalog()[q.prop].map === scene.map.id && !q.paused), day = w.hour >= 8 && w.hour < 17;
    if (on && day && !scene.actors.some((a) => a.siteCrew)) {
      const pt = scene.map.points['site_' + on.id]; if (!pt) return;
      for (let i = 0; i < 3; i++) { const at = G.spawnRule.away(scene, pt.x * 16, pt.y * 16); if (!at) continue; const n = G.law.spawn(scene, { name: 'Construction Worker', look: { top: 'vest', shirt: '#e8a020', bottom: 'pants', hat: 'helmet', hatColor: '#f0d020' }, combat: 'flee', role: 'crew', hp: 30 }, at.x, at.y); n.def.faction = 'civilians'; n.siteCrew = true; G.law.sendTo(n, (pt.x + i * 2) * 16, pt.y * 16); }
    } else if (!(on && day)) for (const a of scene.actors) if (a.siteCrew && !a.leaving) { a.leaving = true; const at = G.spawnRule.away(scene, a.x, a.y); if (at) G.law.sendTo(a, at.x, at.y); }
    for (const a of scene.actors) if (a.siteCrew && !a.leaving && !a.moving && Math.random() < 0.25 && a.distTo(scene.player) < 200) { a.attackTimer = 0.22; G.audio.play(pick(['chop', 'swing']), { x: a.x, y: a.y }); if (Math.random() < 0.08) a.say(pick(['Mind the wet concrete!', 'Pass me that level.', 'Who ordered these bricks?']), 2.5); }
    scene.actors = scene.actors.filter((a) => !(a.leaving && !G.spawnRule.visible(scene, a.x, a.y) && !a.moving));
  },
  // ---------------------------------------------------------------- the law
  legal(w, map, tx, ty) {
    if (!CITY.includes(map)) return true;
    for (const id of this.owned(w)) { const c = this.catalog()[id]; if (c.map === map && tx >= c.x && tx < c.x + c.w && ty >= c.y && ty < c.y + c.h) return this.has(w, id, 'construction') || this.has(w, id, 'renovation'); }
    return false;
  },
  illegalWork(scene, tx, ty) {
    const w = scene.world, e = this.s(w), key = `${scene.map.id}:${Math.floor(tx / 8)},${Math.floor(ty / 8)}`;
    let q = e.illegal.find((i) => i.key === key); if (!q) { q = { key, map: scene.map.id, tx, ty, n: 0, day: w.day, found: false, stage: 0 }; e.illegal.push(q); }
    q.n++;
    const eye = scene.actors.find((a) => a.kind === 'npc' && !a.dead && !a.def.kid && a.canSee(scene, scene.player, 120));
    if (eye && !q.found && Math.random() < 0.1 + (w.isNight() ? 0 : 0.1)) { eye.say(pick(['Hey, do you have a permit for that?', 'I am calling the city.', 'You cannot just build here!']), 3); q.seen = (q.seen || 0) + 1; }
  },
  lawDay(w) {
    const r = new G.RNG('ld' + w.day), e = this.s(w);
    for (const q of e.illegal.slice()) {
      if (!q.found) {
        const big = Math.min(0.5, q.n * 0.012), chance = 0.04 + big + (q.seen || 0) * 0.14;
        if (r.chance(chance)) { q.found = true; q.stage = 1; const fine = 200 + q.n * 12; e.fines = (e.fines || 0) + fine; this.say(w, `A city inspector found your unauthorized work. Fine: $${fine}. Stop now.`, 'bad'); w.commitCrime('illegal_build', 'city', true, null, 0); }
      } else {
        q.stage++;
        if (q.stage === 4) { this.say(w, 'Demolition order: the city will pull down your unauthorized work.', 'bad'); }
        if (q.stage >= 6) { this.demolish(w, q); e.illegal = e.illegal.filter((x) => x !== q); }
      }
    }
  },
  // the city takes back what was built without leave
  demolish(w, q) {
    const mods = w.mapMods && w.mapMods[q.map]; if (mods && mods.tiles) for (const k in mods.tiles) { const t = +k, x = t % G.maps.get(q.map).w, y = Math.floor(t / G.maps.get(q.map).w); if (Math.abs(x - q.tx) < 12 && Math.abs(y - q.ty) < 12) delete mods.tiles[k]; }
    G.maps.invalidate(q.map);
    this.say(w, 'The city demolished your illegal construction.', 'bad');
  },
  // ---------------------------------------------------------------- rent
  rentDay(w) {
    const r = new G.RNG('rd' + w.day), e = this.s(w), weekly = w.day % 7 === 0;
    for (const id of this.owned(w)) {
      const c = this.catalog()[id], q = e.props[id]; if (c.type === 'business' || c.type === 'lot') continue;
      if (!q.tenant && q.asking && r.chance(q.asking <= this.fairRent(w, id) * 1.15 ? 0.25 : 0.05)) {
        const pool = Object.keys(w.npcs).filter((n) => G.NPCS[n] && !G.NPCS[n].kid && w.isAlive(n) && G.lifestyle.of(n) === 'homeless' ? false : G.NPCS[n] && !G.NPCS[n].venue && !G.NPCS[n].home && w.isAlive(n)), who = pool.length ? r.pick(pool) : pick(Object.keys(G.NPCS).filter((n) => /^[na]_r/.test(n)));
        q.tenant = { id: who, since: w.day, late: 0, mood: 60 }; q.rent = q.asking; this.say(w, `${w.displayName(who)} signed a lease on ${c.name}: $${q.rent} a week.`, 'good');
      }
      const t = q.tenant; if (!t) continue;
      if (!w.isAlive(t.id)) { q.tenant = null; continue; }
      if (t.notice && w.day >= t.notice) { q.tenant = null; this.say(w, `${w.displayName(t.id)} moved out of ${c.name}.`); continue; }
      if (weekly) {
        const st = w.npcs[t.id], bad = q.issues.length, due = q.rent * (t.late + 1), pay = Math.min((st.gold || 0) + (st.bank || 0), due), cash = Math.min(st.gold || 0, pay); st.gold -= cash; st.bank = (st.bank || 0) - (pay - cash);
        e.rentIn = (e.rentIn || 0) + pay; (q.earned = (q.earned || 0) + pay);
        if (pay >= due) t.late = 0; else { t.late++; this.say(w, `${w.displayName(t.id)} is behind on the rent at ${c.name}.`); }
        t.mood = clamp(t.mood + (bad ? -12 * bad : 3) - (q.rent > this.fairRent(w, id) * 1.3 ? 10 : 0), 0, 100);
        if (t.mood < 20 && !t.notice) { t.notice = w.day + 7; this.say(w, `${w.displayName(t.id)} gave notice on ${c.name}. They have had enough.`); }
      }
      if (q.issues.length && r.chance(0.12)) this.say(w, `${w.displayName(t.id)} complains about the ${q.issues[0]} at ${c.name}.`);
      if (t.late >= 2 && r.chance(0.15)) { q.cond = Math.max(5, q.cond - 8); this.say(w, `${w.displayName(t.id)} has been damaging ${c.name}.`, 'bad'); }
    }
  },
  evict(w, id) { const q = this.rec(w, id); if (q.tenant) { q.tenant.notice = w.day + 14; this.say(w, `Notice served. ${w.displayName(q.tenant.id)} has 14 days to leave.`); } },
  repairCost(id, w) { const q = this.rec(w, id), c = this.catalog()[id]; return Math.round((100 - q.cond) * c.w * c.h * 0.9 + q.issues.length * 120); },
  repair(scene, id, self) {
    const w = scene.world, p = scene.player, q = this.rec(w, id), n = self ? Math.round(this.repairCost(id, w) * 0.2) : this.repairCost(id, w);
    if (self) { if (!H.has(p, 'planks', 6) || !H.has(p, 'paint', 2)) return 'You need 6 planks and 2 paint.'; H.take(p, 'planks', 6); H.take(p, 'paint', 2); w.skipHours(4); }
    if (this.funds(w, p) < n) return `It will cost $${n}.`;
    this.charge(w, p, n, 'Repairs'); q.cond = self ? Math.min(100, q.cond + 25) : 96; q.issues = self ? q.issues.slice(1) : [];
    return null;
  },
  // ---------------------------------------------------------------- businesses
  bizDay(w) {
    const r = new G.RNG('bz' + w.day), vs = Object.values(G.VENUES);
    for (const v of vs) {
      const s = S0.st(w, v.id), k = G.VENUE_KINDS[v.kind];
      if (s.closed) { if (r.chance(0.03) && !s.sealed && s.owner !== 'player') { s.closed = false; s.cash = 500; } continue; }
      const staff = k.roles.length, wages = Math.round(staff * 28 * (s.wageK || 1)), util = 18 + Math.round(v.w * v.h * 0.15), stockCost = s.owner === 'player' ? 0 : Math.round(s.till * 0.3), rev = Math.max(0, s.till - (s.carry || 0));
      s.clean = clamp((s.clean != null ? s.clean : 70) - 3 - (s.today || 0) * 0.3 + (s.cleaner ? 8 : 0), 0, 100); s.stock = clamp((s.stock != null ? s.stock : 80) - 4 - (s.today || 0) * 0.5, 0, 100);
      if (s.owner === 'player') {
        const hist = (s.hist = s.hist || []); hist.push({ d: w.day, rev, cost: wages + util + stockCost, n: s.today || 0 }); if (hist.length > 14) hist.shift();
        s.till -= wages + util + stockCost;
        if (s.till < 0) { s.unpaid = (s.unpaid || 0) + 1; this.say(w, `${v.name}: not enough in the till for wages.`, 'bad'); if (s.unpaid >= 3) { s.closed = true; this.say(w, `${v.name}: staff walked out. Closed.`, 'bad'); } } else s.unpaid = 0;
        s.carry = Math.max(0, s.till);
      } else {
        s.cash = (s.cash != null ? s.cash : 600) + s.till - wages - util - stockCost; s.till = 0; s.carry = 0;
        s.clean = Math.max(s.clean, 55); s.stock = Math.max(s.stock, 50);
        if (s.cash < -600) { s.closed = true; if (w.log) w.log(`${v.name} has closed down.`, 'warn'); const q = this.rec(w, v.id); if (q) q.listed = true; }
        // answering a rival: cut prices when someone of the same kind is taking the customers
        const riv = vs.filter((o) => o !== v && o.kind === v.kind).map((o) => S0.st(w, o.id));
        if (riv.some((o) => o.owner === 'player' && (o.priceK || 1) < (s.priceK || 1))) s.priceK = Math.max(0.7, (s.priceK || 1) - 0.05);
        else if (s.cash > 4000) { s.priceK = Math.min(1.3, (s.priceK || 1) + 0.02); s.rep = Math.min(90, s.rep + 1); }
      }
      const q = this.s(w).props[v.id]; let crime = 0; if (q && q.issues.includes('raid')) crime = 3;
      s.rep = clamp(s.rep + (s.clean - 55) * 0.03 + ((s.quality || 50) - 50) * 0.02 + (s.stock < 20 ? -1 : 0) - ((s.priceK || 1) - 1) * 4 - crime + (r.next() - 0.5) * 1.2, 5, 98);
      s.today = 0;
    }
  },
  collect(w, p, id) { const s = S0.st(w, id), n = Math.max(0, Math.floor(s.till)); s.till = 0; s.carry = 0; p.gold += n; return n; },
  // ---------------------------------------------------------------- the week's bills
  bills(w, p) {
    const e = this.s(w); let total = 0, tax = 0;
    for (const id of this.owned(w)) { const q = e.props[id], c = this.catalog()[id], v = this.price(w, id); tax += Math.round(v * 0.0015); total += Math.round(v * 0.0015) + (c.type === 'lot' ? 0 : 20 + Math.round(c.w * c.h * 0.4)) + (q.insured ? Math.round(v * 0.0008) : 0); }
    for (const l of e.loans) { const n = Math.min(l.week, l.left), paid = this.charge(w, p, n, 'Installment'); l.left -= paid; if (paid < n) { l.missed++; this.say(w, `You missed a payment on ${this.catalog()[l.prop].name}. (${l.missed}/3)`, 'bad'); if (l.missed >= 3) this.repossess(w, l.prop); } else l.missed = 0; }
    e.loans = e.loans.filter((l) => l.left > 0 && l.missed < 3);
    if (total) { const paid = this.charge(w, p, total, 'Property bills'); if (paid < total) { e.arrears = (e.arrears || 0) + total - paid; this.say(w, `You could not pay this week's property bills. Arrears: $${e.arrears}.`, 'bad'); if (e.arrears > 1500) { const id = this.owned(w).pop(); if (id) this.repossess(w, id); e.arrears = 0; } } }
    e.lastTax = tax; e.lastBills = total;
  },
  repossess(w, id) { const q = this.rec(w, id), c = this.catalog()[id]; q.owner = null; q.listed = true; q.tenant = null; if (c.type === 'business') S0.st(w, id).owner = null; if (w.keys) delete w.keys[id]; this.s(w).loans = this.s(w).loans.filter((l) => l.prop !== id); this.say(w, `${c.name} was repossessed.`, 'bad'); },
  wear(w) {
    const r = new G.RNG('we' + w.day), ISS = ['plumbing', 'wiring', 'roof', 'structure', 'grime', 'furniture'];
    for (const id of this.owned(w)) { const q = this.s(w).props[id], c = this.catalog()[id]; if (c.type === 'lot') continue; q.cond = Math.max(0, q.cond - 0.5 - (q.tenant ? 0.15 : 0)); if (q.cond < 62 && r.chance((70 - q.cond) / 240)) { const i = r.pick(ISS); if (!q.issues.includes(i)) { q.issues.push(i); this.say(w, `${c.name}: ${i} problem.`, 'warn'); } } }
  },
  // ---------------------------------------------------------------- what the world does with all this
  EVENTS: [
    (w, r, E_) => { const t = E_.owned(w).find((i) => E_.s(w).props[i].tenant); if (!t) return false; E_.s(w).props[t].tenant.late++; E_.say(w, `${w.displayName(E_.s(w).props[t].tenant.id)} refuses to pay this week.`, 'bad'); return true; },
    (w, r, E_) => { const b = E_.myBiz(w); if (!b) return false; const s = S0.st(w, b), n = Math.min(Math.floor(s.till * 0.25), 300); if (n <= 0) return false; s.till -= n; E_.say(w, `An employee at ${G.VENUES[b].name} has been stealing: $${n} is missing.`, 'bad'); return true; },
    (w, r, E_) => { const o = E_.owned(w).filter((i) => E_.catalog()[i].type !== 'lot'); if (!o.length) return false; const id = r.pick(o), q = E_.s(w).props[id]; q.cond = Math.max(5, q.cond - 15); if (!q.issues.includes('structure')) q.issues.push('structure'); E_.say(w, `Cracks have appeared in the walls of ${E_.catalog()[id].name}.`, 'warn'); return true; },
    (w, r, E_) => { const b = E_.myBiz(w); if (!b) return false; S0.st(w, b).rep -= 3; E_.say(w, `Neighbors complain about the noise at ${G.VENUES[b].name}.`, 'warn'); return true; },
    (w, r, E_) => { const o = E_.owned(w); if (!o.length) return false; const fine = 60 + r.int(0, 140), id = r.pick(o), q = E_.s(w).props[id]; if (q.issues.length) { E_.s(w).fines = (E_.s(w).fines || 0) + fine; E_.say(w, `An inspector dropped by ${E_.catalog()[id].name} unannounced and wrote you up: $${fine}.`, 'bad'); } else E_.say(w, `An inspector dropped by ${E_.catalog()[id].name}. Everything in order.`); return true; },
    (w, r, E_) => { const b = E_.myBiz(w); if (!b) return false; const s = S0.st(w, b); s.rep -= 6; s.clean = Math.max(0, (s.clean || 70) - 25); E_.say(w, `Someone trashed ${G.VENUES[b].name} overnight. A rival, people say.`, 'bad'); return true; },
    (w, r, E_) => { const o = E_.owned(w).filter((i) => E_.catalog()[i].type !== 'lot'); if (!o.length) return false; const id = r.pick(o), q = E_.s(w).props[id], loss = q.insured ? 0 : 400; q.cond = Math.max(5, q.cond - 25); E_.s(w).fines = (E_.s(w).fines || 0) + loss; E_.say(w, `A fire damaged ${E_.catalog()[id].name}.${q.insured ? ' The insurance covers it.' : ` No insurance: $${loss}.`}`, 'bad'); return true; },
    (w, r, E_) => { const b = E_.myBiz(w); if (!b) return false; const s = S0.st(w, b), n = 150 + r.int(0, 300); s.till += n; s.rep += 2; E_.say(w, `${G.VENUES[b].name} is packed today. Word got around. +$${n}.`, 'good'); return true; },
    (w, r, E_) => { const b = E_.myBiz(w); if (!b) return false; const s = S0.st(w, b); s.wageK = Math.min(1.5, (s.wageK || 1) + 0.1); E_.say(w, `Your supplier raised prices for ${G.VENUES[b].name}.`, 'warn'); return true; },
    (w, r, E_) => { const t = E_.owned(w).find((i) => E_.s(w).props[i].tenant && (E_.s(w).illegal || []).length); if (!t) return false; E_.s(w).illegal[0].seen = (E_.s(w).illegal[0].seen || 0) + 2; E_.say(w, `Your tenant at ${E_.catalog()[t].name} noticed what you have been doing and is asking questions.`, 'warn'); return true; },
    (w, r, E_) => { const e = E_.s(w), d = r.pick(['southside', 'eastside', 'arts', 'neon', 'suburbs']); e.hood = e.hood || {}; e.hood[d] = clamp((e.hood[d] || 1) - 0.08, 0.6, 1.2); if (w.log) w.log(`Property values are falling in ${d}.`, 'warn'); return true; },
    (w, r, E_) => { const o = E_.owned(w); if (!o.length) return false; const id = r.pick(o), n = Math.round(E_.price(w, id) * (1.15 + r.next() * 0.25)); E_.s(w).offer = { prop: id, price: n, until: w.day + 3 }; E_.say(w, `A wealthy buyer offers $${n} for ${E_.catalog()[id].name}. See the ledger.`, 'good'); return true; },
  ],
  myBiz(w) { return this.owned(w).find((i) => G.VENUES[i]) || null; },
  acceptOffer(w, p) { const e = this.s(w), o = e.offer; if (!o || w.day > o.until) return; const q = this.rec(w, o.prop); q.owner = null; q.tenant = null; p.gold += o.price; if (w.keys) delete w.keys[o.prop]; if (G.VENUES[o.prop]) S0.st(w, o.prop).owner = null; e.offer = null; this.say(w, `Sold for $${o.price}.`, 'good'); },
  npcMarket(w) {
    const r = new G.RNG('nm' + w.day), e = this.s(w); e.market = clamp(e.market + (r.next() - 0.5) * 0.015, 0.8, 1.25);
    const list = this.available(w).filter((i) => e.props[i].owner !== 'player'); if (!list.length || !r.chance(0.25)) return;
    const id = r.pick(list), n = this.price(w, id), seller = e.props[id].owner, who = Object.keys(w.npcs).find((k) => k !== seller && G.NPCS[k] && ((w.npcs[k].gold || 0) + (w.npcs[k].bank || 0)) > n * 1.2);
    if (who) { const st = w.npcs[who], c = Math.min(st.gold || 0, n); st.gold -= c; st.bank = (st.bank || 0) - (n - c); if (seller && w.npcs[seller]) w.npcs[seller].gold = (w.npcs[seller].gold || 0) + n; e.props[id].owner = who; e.props[id].listed = false; if (w.log) w.log(`${w.displayName(who)} bought ${this.catalog()[id].name}.`, 'info'); }
  },
  daily(w, p) {
    this.permitDay(w); this.siteDay(w); this.lawDay(w); this.rentDay(w); this.bizDay(w); this.wear(w); this.npcMarket(w);
    if (w.day % 7 === 0) this.bills(w, p);
    const e = this.s(w);
    if (e.fines > 0) { const n = this.charge(w, p, e.fines, 'Fine'); e.fines -= n; }
    if (this.owned(w).length) { const r = new G.RNG('ev' + w.day); if (r.chance(0.2)) { const order = this.EVENTS.slice().sort(() => r.next() - 0.5); for (const f of order) if (f(w, r, this)) break; } }
  },
  // ---------------------------------------------------------------- the screens
  list(title, rows, sub) { return new G.ListScene(title, rows, { sub, w: 460 }); },
  describe(w, id) { const c = this.catalog()[id], q = this.rec(w, id), who = q.owner === 'player' ? 'you' : q.owner ? w.displayName(q.owner) : 'the bank'; return `${LABEL[c.type]} · ${c.w}x${c.h} · ${G.maps.get(c.map).meta.name} · condition ${Math.round(q.cond)}% · owner: ${who}`; },
  listing(scene) { const w = scene.world; return this.list('Property Listings', () => this.available(w).sort((a, b) => this.price(w, a) - this.price(w, b)).map((id) => ({ label: `${this.catalog()[id].name}   $${this.price(w, id)}`, sub: this.describe(w, id), act: () => { G.scenes.push(this.offer(scene, id)); } }))); },
  offer(scene, id) {
    const w = scene.world, p = scene.player, st = { ask: this.price(w, id), tries: 0 }, c = this.catalog()[id], ownerNpc = () => { const o = this.rec(w, id).owner; return o && w.npcs[o] ? o : null; };
    return this.list(c.name, (ls) => [
      { label: `${LABEL[c.type]}, ${c.w}x${c.h}, ${G.maps.get(c.map).meta.name}`, sub: this.describe(w, id), act: () => {} },
      { label: `Pay $${st.ask} in full`, disabled: this.funds(w, p) < st.ask, act: () => { const err = this.buy(scene, id, st.ask, false); if (err) return err; G.scenes.remove(ls); return undefined; } },
      { label: `Mortgage: $${Math.round(st.ask * 0.2)} down, 20 weekly payments`, disabled: this.funds(w, p) < st.ask * 0.2 || !!ownerNpc(), act: () => { const err = this.buy(scene, id, st.ask, true); if (err) return err; G.scenes.remove(ls); return undefined; } },
      { label: 'Negotiate the price', disabled: st.tries >= 2, act: () => { st.tries++; const won = G.skills.roll(p, 9 - st.tries, 'charisma'); if (won) { st.ask = Math.round(st.ask * (0.88 + Math.random() * 0.06) / 10) * 10; return `They come down to $${st.ask}.`; } return 'They will not budge.'; } },
    ]);
  },
  menu(scene) {
    const w = scene.world, p = scene.player;
    return this.list('Property Ledger', () => {
      const e = this.s(w), rows = [];
      rows.push({ label: `Your properties: ${this.owned(w).length}`, sub: `Weekly bills last week: $${e.lastBills || 0}. Rent received: $${e.rentIn || 0}. Loans: ${e.loans.length}.`, act: () => { G.scenes.push(this.mineList(scene)); } });
      rows.push({ label: 'Listings', act: () => { G.scenes.push(this.listing(scene)); } });
      rows.push({ label: 'Permits', sub: `${e.permits.filter((q) => q.status === 'pending').length} pending, ${e.permits.filter((q) => q.status === 'granted').length} granted`, act: () => { G.scenes.push(this.list('Permits', () => (e.permits.length ? e.permits.slice().reverse() : [null]).map((q) => (q ? { label: `${PERMITS[q.type][0]}: ${this.catalog()[q.prop].name}`, sub: q.status === 'pending' ? `pending, day ${q.due}` : q.status, act: () => {} } : { label: 'No applications yet.', act: () => {} })))); } });
      rows.push({ label: 'Building sites', sub: `${e.sites.length} under way`, act: () => { G.scenes.push(this.list('Building Sites', () => (e.sites.length ? e.sites : [null]).map((q) => (q ? { label: `${BP[q.bp].name}: ${Math.round(q.pct)}%`, sub: `${this.catalog()[q.prop].name} · ${CREW[q.crew].name}`, act: () => {} } : { label: 'Nothing being built.', act: () => {} })))); } });
      if (e.offer && w.day <= e.offer.until) rows.push({ label: `Accept $${e.offer.price} for ${this.catalog()[e.offer.prop].name}`, act: () => { this.acceptOffer(w, p); } });
      rows.push({ label: 'Recent events', act: () => { G.scenes.push(this.list('Recent Events', () => (e.log.length ? e.log.slice(-30).reverse() : [[w.day, 'Nothing yet.']]).map(([d, t]) => ({ label: t, sub: `Day ${d}`, act: () => {} })))); } });
      return rows;
    });
  },
  mineList(scene) { const w = scene.world; return this.list('Your Properties', () => { const o = this.owned(w); return o.length ? o.map((id) => ({ label: this.catalog()[id].name, sub: this.describe(w, id), act: () => { G.scenes.push(G.VENUES[id] ? this.biz(scene, id) : this.manage(scene, id)); } })) : [{ label: 'You own nothing yet.', act: () => {} }]; }); },
  manage(scene, id) {
    const w = scene.world, p = scene.player, c = this.catalog()[id];
    return this.list(c.name, () => {
      const q = this.rec(w, id), t = q.tenant, rows = [{ label: this.describe(w, id), sub: q.issues.length ? `Problems: ${q.issues.join(', ')}` : 'No known problems.', act: () => {} }];
      if (c.type === 'lot') {
        rows.push({ label: 'Build here', act: () => { G.scenes.push(this.blueprints(scene, id)); } });
        for (const k of ['construction', 'commercial']) rows.push({ label: `Apply: ${PERMITS[k][0]} ($${PERMITS[k][1]})`, act: () => this.apply(scene, id, k) || 'Application filed.' });
      } else {
        rows.push({ label: t ? `Tenant: ${w.displayName(t.id)}, $${q.rent} a week` : `No tenant. Asking $${q.asking || 0} a week`, sub: t ? `Mood ${Math.round(t.mood)}. ${t.late ? `${t.late} weeks behind.` : 'Paid up.'}${t.notice ? ` Leaving on day ${t.notice}.` : ''}` : `A fair rent is about $${Math.round(this.fairRent(w, id))}.`, act: () => {} });
        rows.push({ label: 'Raise the rent ($10)', act: () => { q.asking = (q.asking || Math.round(this.fairRent(w, id))) + 10; if (t) q.rent += 10; } });
        rows.push({ label: 'Lower the rent ($10)', act: () => { q.asking = Math.max(10, (q.asking || Math.round(this.fairRent(w, id))) - 10); if (t) q.rent = Math.max(10, q.rent - 10); } });
        if (t && !t.notice) rows.push({ label: 'Serve notice (14 days)', act: () => { this.evict(w, id); } });
        rows.push({ label: `Hire repairs ($${this.repairCost(id, w)})`, act: () => this.repair(scene, id, false) || 'Repaired.' });
        rows.push({ label: 'Repair it yourself', sub: '6 planks, 2 paint, a few hours, some of the cost', act: () => this.repair(scene, id, true) || 'Better.' });
        rows.push({ label: `Insurance: ${q.insured ? 'on' : 'off'}`, act: () => { q.insured = !q.insured; } });
        rows.push({ label: `Apply: ${PERMITS.renovation[0]} ($${PERMITS.renovation[1]})`, act: () => this.apply(scene, id, 'renovation') || 'Application filed.' });
      }
      void p;
      return rows;
    });
  },
  blueprints(scene, id) {
    const w = scene.world, p = scene.player;
    return this.list('Blueprints', () => Object.keys(BP).filter((k) => this.fits(id, k)).map((k) => { const B = BP[k], short = this.matsShort(w, p, k); return { label: `${B.name} (${B.w}x${B.h}${B.floors ? `, ${B.floors} floors` : ''})`, sub: `${Math.ceil(B.days)} days · labor from $${Math.round(B.cost * 0.55)} · ${short.length ? `short of ${short.length} materials` : 'materials ready'}`, act: () => { G.scenes.push(this.hire(scene, id, k)); } }; }));
  },
  hire(scene, id, bp) {
    const w = scene.world, p = scene.player, sel = { extras: [], supplied: this.matsShort(w, p, bp).length > 0 };
    return this.list(`${BP[bp].name}: who builds it`, (ls) => {
      const rows = Object.keys(EXTRA).map((k) => ({ label: `${sel.extras.includes(k) ? '[x]' : '[ ]'} ${EXTRA[k][0]} (+${Math.round(EXTRA[k][1] * 100)}%)`, sub: EXTRA[k][2], act: () => { sel.extras = sel.extras.includes(k) ? sel.extras.filter((q) => q !== k) : sel.extras.concat([k]); } }));
      rows.push({ label: `${sel.supplied ? '[x]' : '[ ]'} Have the contractor supply materials (+$${Math.round(this.matCost(bp) * 1.25)})`, act: () => { sel.supplied = !sel.supplied; } });
      for (const k in CREW) { const c = CREW[k], n = Math.round(BP[bp].cost * c.rate * (1 + sel.extras.reduce((s, q) => s + EXTRA[q][1], 0))) + (sel.supplied ? Math.round(this.matCost(bp) * 1.25) : 0); rows.push({ label: `${c.name}: $${n}`, sub: `${c.desc} About ${Math.ceil(BP[bp].days / c.speed)} days.`, act: () => { const err = this.start(scene, id, bp, k, sel.extras, sel.supplied); if (err) return err; G.scenes.remove(ls); return undefined; } }); }
      return rows;
    });
  },
  biz(scene, id) {
    const w = scene.world, p = scene.player, v = G.VENUES[id], s = S0.st(w, id), k = G.VENUE_KINDS[v.kind];
    return this.list(v.name, () => {
      const h = (s.hist || []).slice(-7), rev = h.reduce((n, q) => n + q.rev, 0), cost = h.reduce((n, q) => n + q.cost, 0), cust = h.reduce((n, q) => n + q.n, 0);
      return [
        { label: `Revenue, 7 days: $${rev}`, sub: `Expenses $${cost} · profit $${rev - cost}`, act: () => {} },
        { label: `Reputation: ${Math.round(s.rep)}   Customers: ${cust}`, sub: `Cleanliness ${Math.round(s.clean != null ? s.clean : 70)} · stock ${Math.round(s.stock != null ? s.stock : 80)} · quality ${s.quality || 50}`, act: () => {} },
        { label: `Collect the till: $${Math.max(0, Math.floor(s.till))}`, act: () => { const n = this.collect(w, p, id); G.audio.play('coin'); return `+$${n}`; } },
        { label: `Staff: ${this.staffed(w, id)} of ${k.roles.length}   Wages ${Math.round((s.wageK || 1) * 100)}%`, sub: k.roles.join(', '), act: () => {} },
        ...k.roles.map((role, i) => { const out = (s.out || []).includes(i), st = w.npcs[`${id}_s${i}`]; return { label: out ? `Hire a new ${role}` : `Let go: ${st ? w.displayName(`${id}_s${i}`) : role}`, sub: role, disabled: !out && this.staffed(w, id) <= 1, act: () => { this.setStaff(w, id, i, !out); s.quality = clamp((s.quality || 50) + (out ? 5 : -8), 0, 100); } }; }),
        { label: `Prices: ${Math.round((s.priceK || 1) * 100)}%  (raise)`, act: () => { s.priceK = Math.min(2, (s.priceK || 1) + 0.05); } },
        { label: `Prices: ${Math.round((s.priceK || 1) * 100)}%  (lower)`, act: () => { s.priceK = Math.max(0.5, (s.priceK || 1) - 0.05); } },
        { label: `Hours: ${(s.hours || v.hours).join(' - ')}  (open an hour earlier)`, act: () => { const q = (s.hours || v.hours).slice(); q[0] = (q[0] + 23) % 24; s.hours = q; } },
        { label: 'Hours: close an hour later', act: () => { const q = (s.hours || v.hours).slice(); q[1] = (q[1] + 1) % 24; s.hours = q; } },
        { label: 'Buy stock ($200)', disabled: this.funds(w, p) < 200, act: () => { this.charge(w, p, 200, 'Stock'); s.stock = Math.min(100, (s.stock != null ? s.stock : 80) + 40); } },
        { label: `Automatic restocking: ${s.autoStock === false ? 'off' : 'on'}`, act: () => { s.autoStock = s.autoStock === false; } },
        { label: `Cleaning crew: ${s.cleaner ? 'on' : 'off'}`, act: () => { s.cleaner = !s.cleaner; s.wageK = (s.wageK || 1) + (s.cleaner ? 0.1 : -0.1); } },
        { label: 'Renovate the interior ($1500)', disabled: this.funds(w, p) < 1500, act: () => { this.charge(w, p, 1500, 'Renovation'); s.quality = Math.min(100, (s.quality || 50) + 15); s.rep = Math.min(98, s.rep + 4); } },
        { label: 'Maintain the equipment ($300)', disabled: this.funds(w, p) < 300, act: () => { this.charge(w, p, 300, 'Maintenance'); const q = this.rec(w, id); q.cond = Math.min(100, q.cond + 12); } },
      ];
    });
  },
};

// ---------------------------------------------------------------- hooks
const _place = H.place;
H.place = function (scene, id, tx, ty) {
  const why = _place.apply(this, arguments), w = scene.world;
  if (!why && !E.legal(w, scene.map.id, tx, ty)) E.illegalWork(scene, tx, ty);
  return why;
};
const _gen = G.maps.get;
G.maps.get = function (id) { const fresh = !this.cache[id], m = _gen.call(this, id); if (fresh && G.world && G.world.estate) { E.applyToMap(m, G.world); if (G.world.estate.sites.length || G.world.estate.built.length) { m.finalized = false; m.computeSolids(); m.decor.sort((a, b) => a.y - b.y); m.prerender(); m.finalized = true; } } return m; };
G.events.on('newDay', () => { const w = G.world, sc = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene); if (w && sc && sc.player) try { E.daily(w, sc.player); } catch (e) { if (G.reportError) G.reportError(e); else throw e; } });
const _u = GS.update;
GS.update = function (dt) { const r = _u.call(this, dt); if (this.actors && (this._cr = (this._cr || 0) - dt) <= 0) { this._cr = 2; try { E.crew(this); } catch (e) { if (G.reportError) G.reportError(e); else throw e; } } return r; };
const _use = GS.useDecor, _lab = GS.decorLabel;
GS.useDecor = function (d) { if (d.def.interact === 'v_listing') { const i = (G.ART_LOTS || []).findIndex(([x, y, w, h]) => this.map.id === 'arts' && d.tx >= x && d.tx < x + w && d.ty >= y && d.ty < y + h); if (i >= 0) { const id = 'lot_' + i; G.scenes.push(E.mine(this.world, id) ? E.manage(this, id) : E.offer(this, id)); } return undefined; } return _use.apply(this, arguments); };
GS.decorLabel = function (d) { return d.def.interact === 'v_listing' ? 'Read the sign' : _lab.apply(this, arguments); };
G.PHONE_APP_LIST.push(['estate', 'Properties', '#2a6a4a', 'P']);
G.PHONE_APPS.estate = (scene) => E.menu(scene);
const _wl = G.onWorldLoaded;
G.onWorldLoaded = function (w) { if (_wl) _wl.apply(this, arguments); if (w.estate) for (const b of w.estate.built) if (BP[b.bp].venue) E.openVenue(w, b); else E.catalogAdd(b); };
// ---------------------------------------------------------------- the people behind the desks
G.DIALOGUES.v_agent = { start: { text: () => pick(['Homestead Realty. Everything is for sale if you ask nicely.', 'Looking to buy? Sell? Dream?']), choices: [
  { text: 'Show me what is for sale.', do: (c) => { G.scenes.push(E.listing(c.scene)); return null; } },
  { text: 'Open my ledger.', do: (c) => { G.scenes.push(E.menu(c.scene)); return null; } },
  { text: 'Goodbye.', next: null } ] } };
G.DIALOGUES.v_clerk = { start: { text: () => pick(['Take a number. There is no number. Go ahead.', 'Permits, fees, zoning. Which form is ruining your day?']), choices: [
  { text: 'I want to apply for a permit.', do: (c) => { const w = c.w, sc = c.scene; G.scenes.push(E.list('Permit Application', () => { const rows = []; for (const id of E.owned(w)) for (const k in PERMITS) rows.push({ label: `${PERMITS[k][0]}: ${E.catalog()[id].name}`, sub: `Fee $${PERMITS[k][1]}`, act: () => E.apply(sc, id, k) || 'Application filed.' }); return rows.length ? rows : [{ label: 'You do not own anything.', act: () => {} }]; })); return null; } },
  { text: (c) => { const q = E.s(c.w).permits.find((i) => i.extra); return q ? `Pay the extra fee ($${q.extra}).` : 'Do I owe anything?'; }, do: (c) => { const q = E.s(c.w).permits.find((i) => i.extra); if (q && E.funds(c.w, c.p) >= q.extra) { E.charge(c.w, c.p, q.extra, 'Permit fee'); q.extra = 0; } return 'start'; } },
  { text: 'What are the rules for building?', next: 'rules' },
  { text: 'Goodbye.', next: null } ] },
  rules: { text: () => 'Own the land. File for the permit. Wait. Then build. Lots marked residential take no commercial work. Build without paper and we fine you, stop you, and pull it down.', choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] },
};
})();
