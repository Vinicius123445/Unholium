'use strict';
// Money goes around. js/game/economy.js moved money through the day; here it stops coming from nowhere.
//   w.econ.pool is the rest of the economy (employers, landlords, suppliers, customers from out of town): wages come
//   out of it, rent and groceries go into it, and every transfer is paid by someone. Criminals have no wage at all:
//   dealers earn only by selling stock they hold (st.stock), and pay a supplier to restock; gangs earn from the turf
//   their crew holds, taken out of real shop tills.
//   Everyone has a wallet (st.gold) and an account (st.bank), which never mix. Habits differ: the careful keep little
//   on them, the careless keep it all. People near the bank walk in and do it at a counter; elsewhere it happens on
//   the day. G.finance.ledger checks that money only moves.
(() => {
const clamp = G.util.clamp, E = G.economy;
const F = G.finance = {
  POOL: 400000,
  state(w) { const e = E.state(w); if (e.pool == null) e.pool = this.POOL; return e; },
  // one payment, between two pockets of any kind: nothing is created or lost
  pay(w, from, to, n) {
    const amt = Math.floor(n); if (amt <= 0) return 0;
    const e = this.state(w), get = (k) => (k === 'pool' ? e.pool : k.gold != null ? k.gold : 0), got = Math.min(amt, get(from));
    if (got <= 0) return 0;
    if (from === 'pool') e.pool -= got; else from.gold -= got;
    if (to === 'pool') e.pool += got; else to.gold = (to.gold || 0) + got;
    return got;
  },
  // what is in the world right now (tests, and a sanity line in the debug log)
  ledger(w) {
    const e = this.state(w); let cash = e.pool;
    for (const id in w.npcs) cash += (w.npcs[id].gold || 0);
    for (const id in w.shops) cash += (w.shops[id].gold || 0);
    return cash;
  },
  bank(st) { return st.bank || 0; },
  habit(id) { const P = G.social.persona(id); return clamp(0.25 + (P.patience - 50) / 200 + (P.wits - 50) / 250, 0.05, 0.6); },   // what stays in the wallet is the rest
  deposit(w, st, n) { const a = Math.min(Math.floor(n), st.gold || 0); if (a <= 0) return 0; st.gold -= a; st.bank = (st.bank || 0) + a; this.note(st, w, 'deposit', a); if (w.bankVault != null) w.bankVault += a; return a; },
  withdraw(w, st, n) { const a = Math.min(Math.floor(n), st.bank || 0, w.bankVault != null ? w.bankVault : 1e9); if (a <= 0) return 0; st.bank -= a; st.gold = (st.gold || 0) + a; this.note(st, w, 'withdrawal', a); if (w.bankVault != null) w.bankVault -= a; return a; },
  note(st, w, kind, n) { st.fin = (st.fin || []).concat([[w.day, kind, n]]).slice(-8); },
  // a day of a dealer's trade: customers buy what is there; when it runs out, there is no income
  dealerDay(w, id, st, rng) {
    st.stock = st.stock == null ? 12 : st.stock;
    const sold = Math.min(st.stock, rng.int(0, 5)), price = 25;
    if (sold > 0) { st.stock -= sold; this.pay(w, 'pool', st, sold * price); this.note(st, w, 'sales', sold * price); }
    if (st.stock < 4 && (st.gold || 0) >= 90) { const n = Math.min(10, Math.floor(st.gold / 12)); this.pay(w, st, 'pool', n * 12); st.stock += n; }
  },
  gangDay(w, id, st, rng) {
    const fid = G.NPCS[id].faction, held = G.gangWar && w.turf ? Object.values(w.turf).filter((t) => (t.owner || t) === fid).length : 1;
    if (!rng.chance(0.3 + held * 0.05)) return;
    const shops = Object.values(w.shops).filter((s) => s.gold > 200);
    if (shops.length) { const s = rng.pick(shops), take = Math.min(rng.int(15, 60), s.gold); s.gold -= take; st.gold = (st.gold || 0) + take; this.note(st, w, 'protection', take); }
  },
  // the morning: replaces the wages of js/game/economy.js with money that comes from somewhere
  settle(w, id, st, before, rng) {
    const life = G.lifestyle ? G.lifestyle.of(id) : 'worker', change = (st.gold || 0) - before;
    if (id === 'c_shark') { st.gold = before; return; }      // (his roll is his business: loans and repayments only)
    if (life === 'dealer') { st.gold = before + Math.min(0, change); this.dealerDay(w, id, st, rng); }
    else if (life === 'gang') { st.gold = before + Math.min(0, change); this.gangDay(w, id, st, rng); }
    if (!st.jailedUntil) this.habits(w, id, st);
  },
  habits(w, id, st) {
    const keep = this.habit(id), cash = st.gold || 0, wealth = cash + (st.bank || 0);
    const near = this.nearBank(id);
    if (near) return;   // (these walk in: js/game/bank.js)
    if (cash > 150 && cash > wealth * keep + 60) this.deposit(w, st, cash - wealth * keep);
    else if (cash < 25 && (st.bank || 0) > 0) this.withdraw(w, st, Math.min(st.bank, 60));
  },
  nearBank() { return false; },
};
const _daily = E.daily;
E.daily = function (w) {
  const before = {}, e = F.state(w), total = F.ledger(w), bank0 = Object.values(w.npcs).reduce((n, s) => n + (s.bank || 0), 0);
  for (const id in w.npcs) before[id] = w.npcs[id].gold || 0;
  const r = _daily.call(this, w), rng = new G.RNG('fin' + w.day);
  for (const id in w.npcs) { const st = w.npcs[id]; if (st.alive && G.NPCS[id] && !(st.jailedUntil > w.day)) F.settle(w, id, st, before[id], rng); }
  // whatever people and tills gained today, the rest of the economy paid (and the other way round); money in accounts
  // left the wallets, and is not part of this count
  const bank1 = Object.values(w.npcs).reduce((n, s) => n + (s.bank || 0), 0);
  e.pool += total - F.ledger(w) - (bank1 - bank0);
  return r;
};
// dealers sell real stock to addicts too
const AD = G.addiction;
if (AD && AD.buy) { const _b = AD.buy; AD.buy = function (npc, dealer, scene) { const st = dealer.st; if (st.stock != null && st.stock <= 0) { dealer.say(G.rng.pick(['I am out. Come back tomorrow.', 'Nothing left today.']), 2.5); return false; } const r = _b.apply(this, arguments); if (st.stock != null) st.stock--; return r; }; }
})();
