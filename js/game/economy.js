'use strict';
// The economy: money moves through the world instead of appearing from nowhere.
//   People: everyone earns by what they do (wages on workdays, a pension, a dealer's take, a beggar's
//   coins, a farmer's harvest money), spends on food every day and rent every week. Run out and they are
//   broke: worried, borrowing from friends, and the desperate ones turn to crime (they mug people). The
//   rich get richer and carry more cash; your pickpocketing and muggings take what people actually have.
//   Shops: every sale goes into the till. Restocking costs the shop wholesale (about half the price); a
//   shop that cannot pay restocks less. The owner takes a salary from the till.
//   Prices: a price level (inflation, ~2-3% a year), category prices that drift with supply (shortages and
//   gluts make the news), scarcity (the last few on the shelf cost more) and the neighborhood (the Rich
//   District charges more than Southside).
//   You: a bank account in the "Vault" phone app (deposit, withdraw, interest), and weekly bills: a phone
//   plan (unpaid: service suspended) and property tax on your home (unpaid: it piles up as debt).
//   State: w.econ.
(() => {
const WAGE = { worker: [70, 120], shopkeeper: [0, 0], cop: [90, 130], rich: [300, 600], retiree: [35, 50], homeless: [0, 12], gang: [20, 80], dealer: [40, 160], farmer: [60, 100], child: [3, 8], teen: [5, 20] };
const SPEND = { worker: 18, shopkeeper: 18, cop: 18, rich: 70, retiree: 12, homeless: 3, gang: 20, dealer: 25, farmer: 12, child: 0, teen: 4 };
const RENT = { worker: 140, shopkeeper: 120, cop: 140, rich: 700, retiree: 90, homeless: 0, gang: 80, dealer: 100, farmer: 50, child: 0, teen: 0 };
const AREA = { heights: 1.25, center: 1.1, suburbs: 1.0, southside: 0.88, eastside: 0.9, rural: 0.92, jail: 1, island: 1.4 };
const CATS = ['food', 'drink', 'drug', 'weapon', 'ammo', 'tool', 'clothing', 'medical', 'valuable', 'misc'];
const EVENTS = [
  ['food', 1.3, 'Bad harvest upstate: grocery prices are climbing.'], ['food', 0.8, 'Farmers\' glut: food is cheap this week.'],
  ['drug', 1.5, 'Police seized a big shipment. Street prices for drugs are up.'], ['drug', 0.7, 'The streets are flooded with product. Prices crash.'],
  ['ammo', 1.4, 'Ammunition shortage: stores are rationing rounds.'], ['weapon', 1.25, 'New gun law talk sends buyers rushing to the stores.'],
  ['medical', 1.3, 'Pharmacy supply problems: medicine costs more.'], ['valuable', 1.3, 'Gold hits a record high. Jewelers raise prices.'],
  ['valuable', 0.8, 'Gold slumps. Pawn shops pay less.'], ['drink', 1.2, 'Brewery strike: beer and liquor prices up.'],
];

const E = G.economy = {
  WAGE, SPEND, RENT, AREA,
  state(w) {
    const e = w.econ = w.econ || {};
    e.cpi = e.cpi || 1;
    e.cat = e.cat || {};
    for (const c of CATS) if (e.cat[c] == null) e.cat[c] = 1;
    e.events = e.events || [];
    e.bank = e.bank || 0;
    e.log = e.log || [];
    e.debt = e.debt || 0;
    e.phoneDue = e.phoneDue || 0;
    return e;
  },
  catOf(itemId) {
    const it = G.item(itemId) || {};
    if (it.ammo || /^ammo/.test(itemId)) return 'ammo';
    if (it.gun || it.type === 'weapon') return 'weapon';
    if (it.drug || it.illegal && it.type === 'consumable') return 'drug';
    if (it.alcohol || it.drink) return 'drink';
    if (it.type === 'food' || it.food) return 'food';
    if (it.heal || it.medical) return 'medical';
    if (it.type === 'valuable' || /gem|jewel|gold|watch|ring/.test(itemId)) return 'valuable';
    if (it.slot || it.type === 'clothing') return 'clothing';
    if (it.type === 'tool') return 'tool';
    return 'misc';
  },
  areaOf(shopId) {
    const s = G.SHOPS[shopId] || {}, owner = s.owner && G.NPCS[s.owner];
    const map = owner && G.maps.get(owner.map);
    return (map && (map.meta.district || map.meta.region)) || s.region || 'center';
  },
  // the market price multiplier for an item at a shop
  factor(w, shopId, itemId) {
    const e = this.state(w), cat = this.catOf(itemId);
    let f = e.cpi * (e.cat[cat] || 1) * (AREA[this.areaOf(shopId)] || 1);
    const base = G.SHOPS[shopId], live = w.shops && w.shops[shopId];
    if (base && live) {   // the last few on the shelf cost more
      const b = base.stock.find((x) => x[0] === itemId), l = live.stock.find((x) => x[0] === itemId);
      if (b && b[1] > 0) f *= 1 + 0.3 * (1 - Math.min(1, (l ? l[1] : 0) / b[1]));
    }
    return f;
  },

  bankLog(w, text) { const e = this.state(w); e.log.push({ day: w.day, text }); if (e.log.length > 40) e.log.shift(); },

  daily(w) {
    const e = this.state(w), rng = G.rng;
    // prices: slow inflation, categories drift back to normal, events
    e.cpi *= 1 + 0.00007 + (rng.next() - 0.5) * 0.0004;
    for (const c of CATS) {
      const ev = e.events.find((x) => x.cat === c && x.until >= w.day);
      const target = ev ? ev.mult : 1;
      e.cat[c] += (target - e.cat[c]) * 0.35 + (rng.next() - 0.5) * 0.02;
    }
    e.events = e.events.filter((x) => x.until >= w.day);
    if (rng.chance(0.06) && e.events.length < 2) {
      const [cat, mult, text] = rng.pick(EVENTS);
      if (!e.events.some((x) => x.cat === cat)) { e.events.push({ cat, mult, until: w.day + rng.int(3, 7) }); w.rumor('Business: ' + text, null); }
    }
    // people: earn, spend, pay rent
    const weekday = w.day % 7 !== 0 && w.day % 7 !== 6, rentDay = w.day % 7 === 1;
    for (const id in w.npcs) {
      const st = w.npcs[id], def = G.NPCS[id];
      if (!st || !st.alive || !def || st.jailedUntil > w.day) continue;
      const life = G.lifestyle ? G.lifestyle.of(id) : 'worker';
      const wage = WAGE[life] || WAGE.worker, spend = (SPEND[life] || 15) * e.cpi, rent = (RENT[life] || 0) * e.cpi;
      let g = st.gold || 0;
      if (weekday || life === 'dealer' || life === 'gang' || life === 'homeless' || life === 'retiree') g += rng.int(wage[0], wage[1]) * (life === 'retiree' ? 1 : e.cpi);
      g -= spend;
      if (rentDay && !def.kid) g -= rent;
      if (g < 0) {
        // broke: a friend might lend a hand, otherwise it gets desperate
        st.brokeDays = (st.brokeDays || 0) + 1;
        if (st.brokeDays >= 3 && !def.kid && rng.chance(0.15) && (life === 'homeless' || life === 'worker' || life === 'gang')) st.desperate = true;
        g = 0;
      } else if (g > 40) { st.brokeDays = 0; st.desperate = false; }
      st.gold = Math.round(Math.min(g, life === 'rich' ? 20000 : 3000));
    }
    // shops: owner salary out of the till; NPC customers' spending into it
    for (const sid in w.shops) {
      const s = w.shops[sid], o = s.owner && w.npcs[s.owner];
      if (!o || !o.alive) continue;
      s.gold += Math.round(rng.int(20, 70) * e.cpi * (AREA[this.areaOf(sid)] || 1));
      const pay = Math.min(Math.round(s.gold * 0.15), Math.round(120 * e.cpi));
      if (weekday && pay > 0) { s.gold -= pay; o.gold = (o.gold || 0) + pay; }
    }
    // you: interest on savings, weekly bills
    if (e.bank > 0) { const i = Math.round(e.bank * 0.0005 * 100) / 100; if (i >= 0.01) e.bank = Math.round((e.bank + i) * 100) / 100; }
    if (w.day % 7 === 1) this.bills(w);
  },

  // weekly bills: paid from the bank first, then your pocket; what is left becomes debt
  bills(w) {
    const e = this.state(w), p = G.player;
    if (!p) return;
    const due = [];
    if (p.inventory.has('phone')) due.push(['Phone plan', Math.round(15 * e.cpi), 'phone']);
    if (w.flags.player_home) due.push(['Property tax', Math.round(25 * e.cpi), 'tax']);
    for (const [name, amt, kind] of due) {
      let left = amt;
      const fromBank = Math.min(e.bank, left); e.bank -= fromBank; left -= fromBank;
      const fromCash = Math.min(p.gold, left); p.gold -= fromCash; left -= fromCash;
      if (left > 0) {
        if (kind === 'phone') { e.phoneDue += left; e.phoneCut = true; }
        else e.debt += left;
        this.bankLog(w, `${name}: $${amt} - could not pay $${left}.`);
        G.events.emit('toast', `${name} overdue ($${left}).`, 'warn');
      } else this.bankLog(w, `${name}: -$${amt}`);
    }
  },
  payDebts(w, scene) {
    const e = this.state(w), p = scene.player;
    const owed = e.debt + e.phoneDue;
    if (!owed) return 'Nothing to pay.';
    let paid = 0;
    for (const k of ['phoneDue', 'debt']) {
      const fromBank = Math.min(e.bank, e[k]); e.bank -= fromBank; e[k] -= fromBank; paid += fromBank;
      const fromCash = Math.min(p.gold, e[k]); p.gold -= fromCash; e[k] -= fromCash; paid += fromCash;
    }
    if (!e.phoneDue) e.phoneCut = false;
    this.bankLog(w, `Paid overdue bills: $${paid}`);
    return e.debt + e.phoneDue ? `Paid $${paid}. Still owed: $${e.debt + e.phoneDue}.` : `All paid off ($${paid}).`;
  },
};

// shop prices follow the market (buying and selling alike)
const S = G.shopSys, _pb = S.priceBuy, _ps = S.priceSell;
S.priceBuy = function (shopId, itemId, world) { return Math.max(1, Math.round(_pb.call(this, shopId, itemId, world) * E.factor(world, shopId, itemId))); };
S.priceSell = function (shopId, itemId, world) { const p = _ps.call(this, shopId, itemId, world); return p ? Math.max(1, Math.floor(p * E.factor(world, shopId, itemId))) : 0; };

// restocking costs the shop wholesale; a broke shop restocks what it can afford
const WP = G.World.prototype, _restock = WP.restockShop;
WP.restockShop = function (id) {
  const s = this.shops[id], base = G.SHOPS[id];
  if (!s || !base || !this.econ) return _restock.call(this, id);
  const before = s.stock.map((x) => [x[0], x[1]]), till = s.gold;
  _restock.call(this, id);
  s.gold = till;   // no free money: the till only holds what was earned
  let cost = 0;
  for (const e of s.stock) {
    const b = before.find((x) => x[0] === e[0]), add = e[1] - (b ? b[1] : 0);
    if (add <= 0) continue;
    const unit = Math.max(1, Math.round(G.item(e[0]).value * 0.5 * E.factor(this, id, e[0])));
    const can = Math.min(add, Math.floor(Math.max(0, s.gold - cost) / unit));
    e[1] = (b ? b[1] : 0) + can;
    cost += can * unit;
  }
  s.stock = s.stock.filter((x) => x[1] > 0);
  s.gold = Math.max(0, s.gold - cost);
  if (s.gold < base.gold * 0.25) s.gold += Math.round(base.gold * 0.25);   // the owner tops up the float from savings
};

G.events.on('newDay', () => { if (G.world) { try { E.daily(G.world); } catch (err) { G.reportError && G.reportError(err); } } });

// the desperate turn to crime: they rob people (the addicts' mugger code does the robbing)
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) {
  const p = scene.player;
  if (!E.mugOff && this.st && this.st.desperate && !this.def.kid && !this.st.companion && this.def.combat !== 'guard' && this.state === 'schedule' && !p.dead && (this.mugT || 0) < scene.time && this.distTo(p) < 120 && this.canSee(scene, p, 120)) {
    this.mugT = scene.time + 240;
    if (Math.random() < 0.3) { this.state = 'mug'; this.mugDone = false; this.say(G.rng.pick(['Give me your wallet. Now.', 'I am not asking twice. Cash.']), 3); }
    else this.say(G.rng.pick(['Hey... could you spare a few bucks? Rent is due.', 'I lost my job. Anything helps.']), 3);
  }
  return _nu.call(this, dt, scene);
};

// no service with an unpaid phone bill
const P = G.phone, _call = P.call, _send = P.send;
P.call = function (scene, id) { const e = E.state(scene.world); if (e.phoneCut) { scene.toast('Service suspended: unpaid phone bill. (Vault app)', 'bad'); return; } return _call.apply(this, arguments); };
P.send = function (w, to, text) { const e = E.state(w); if (e.phoneCut) { G.events.emit('toast', 'Message not sent: service suspended.', 'bad'); return; } return _send.apply(this, arguments); };

// ---------------------------------------------------------------- the Vault app (mobile banking)
G.PHONE_APP_LIST.push(['vault', 'Vault', '#2a7a5a', 'V']);
G.PHONE_SCREENS.vault = (ps) => {
  const w = ps.w, g = ps.game, e = E.state(w), p = g.player, $ = (n) => '$' + Math.round(n).toLocaleString();
  const dep = (n) => () => { const a = Math.min(n, p.gold); if (a <= 0) return; p.gold -= a; e.bank += a; E.bankLog(w, `Deposit ${$(a)}`); G.audio.play('coin'); };
  const wd = (n) => () => { const a = Math.min(n, Math.floor(e.bank)); if (a <= 0) return; e.bank -= a; p.gold += a; E.bankLog(w, `Withdrawal ${$(a)}`); G.audio.play('coin'); };
  const owed = e.debt + e.phoneDue;
  const rows = [
    { label: `Balance: ${$(e.bank)}`, sub: `Cash on you: ${$(p.gold)} · interest 0.05%/day`, color: '#8ae0b0', info: true },
    { label: 'Deposit all cash', act: dep(p.gold) }, { label: 'Deposit $100', act: dep(100) },
    { label: 'Withdraw $50', act: wd(50) }, { label: 'Withdraw $200', act: wd(200) }, { label: 'Withdraw all', act: wd(e.bank) },
  ];
  if (owed) rows.push({ label: `Pay overdue bills (${$(owed)})`, color: '#ff9a7a', act: () => g.toast(E.payDebts(w, g)) });
  rows.push({ label: 'Markets', act: () => ps.open('vault_market') }, { label: 'Statement', act: () => ps.open('vault_log') });
  return rows;
};
G.PHONE_SCREENS.vault_market = (ps) => {
  const e = E.state(ps.w), pct = (f) => (f >= 1 ? '+' : '') + Math.round((f - 1) * 100) + '%';
  return [{ label: `Price level: ${pct(e.cpi)} since day 1`, info: true }].concat(CATS.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), sub: pct(e.cat[c]), color: e.cat[c] > 1.08 ? '#ff9a7a' : e.cat[c] < 0.92 ? '#8ae0b0' : null, info: true })));
};
G.PHONE_SCREENS.vault_log = (ps) => E.state(ps.w).log.slice().reverse().map((l) => ({ label: l.text, sub: `Day ${l.day}`, info: true }));
})();
