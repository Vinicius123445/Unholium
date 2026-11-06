'use strict';
// The bank, in the city center: counters, tellers, a manager's office, chairs to wait on, cameras, ATMs, the vault door.
// Your account is the one the Vault app has always shown (w.econ.bank); people's are st.bank. Tellers keep a real float
// at their station, the vault holds what has been deposited (w.bankVault), and that is all there is to steal.
// People with business walk in, wait at the counter and walk out; the transaction happens when they get there.
(() => {
const F = G.finance, E = G.economy, GS = G.GameScene.prototype, pick = (a) => G.rng.pick(a), clamp = G.util.clamp;
G.CRIMES.robbery = { label: 'Bank robbery', bounty: 700, rep: -25, tension: 20 };
const H = G.hours = G.hours || {};
void H;
const open = (w) => w.hourF >= 9 && w.hourF < 17 && w.day % 7 !== 0;
const STAFF = {
  c_teller1: { name: 'Bank Teller', at: 'c_bank_t1', look: { top: 'shirt', shirt: '#e8e8ec', bottom: 'pants', pants: '#2e3440' } },
  c_teller2: { name: 'Bank Teller', at: 'c_bank_t2', look: { top: 'vest', shirt: '#3a4660', bottom: 'skirt', pants: '#2e3440', body: 'f' } },
  c_bankmgr: { name: 'Bank Manager', at: 'c_bank_mgr', look: { top: 'jacket', shirt: '#2a2e3a', shirt2: '#e8e8ec', bottom: 'pants', pants: '#2a2e3a' } },
  c_bankguard: { name: 'Bank Security', at: 'c_bank_door', combat: 'fight', weapon: 'pistol', hp: 70, look: { top: 'shirt', shirt: '#3a4a6a', bottom: 'pants', pants: '#26303c', hat: 'cap', hatColor: '#26303c' } },
};
for (const id in STAFF) {
  const s = STAFF[id];
  G.NPCS[id] = { id, name: s.name, map: 'city', faction: 'civilians', hp: s.hp || 30, combat: s.combat || 'flee', weapon: s.weapon, gold: 40, home: null, relations: {}, dialogue: id.startsWith('c_teller') || id === 'c_bankmgr' ? 'bank_teller' : undefined, inv: s.weapon ? [['ammo_9mm', 12]] : [], job: id === 'c_bankmgr' ? 'I run this branch. Mind the paperwork.' : id === 'c_bankguard' ? 'I watch the door.' : 'Deposits, withdrawals, statements. Next, please.', look: G.look(id, s.look), schedule: [{ from: 8, to: 18, at: s.at, act: 'work' }, { from: 18, to: 24, at: 'c_bank_out', act: 'wander' }, { from: 0, to: 8, at: 'c_bank_out', act: 'wander' }] };
}
const D = G.DECOR, A = G.assets;
const NEW = { atm: [14, 24, { interact: 'atm' }], teller_desk: [30, 16, { fw: 2 }], vault_door: [32, 30, { fw: 2, interact: 'vault' }], bank_camera: [10, 8, {}], waiting_chair: [10, 13, { solid: false }], bank_desk: [28, 14, { fw: 2 }] };
const paint = {
  atm(x) { x.fillStyle = '#3a4a5e'; x.fillRect(0, 0, 14, 24); x.fillStyle = '#1e2a3a'; x.fillRect(2, 3, 10, 7); x.fillStyle = '#70d0a0'; x.fillRect(3, 4, 8, 1); x.fillRect(3, 6, 5, 1); x.fillStyle = '#c8ccd2'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) x.fillRect(3 + c * 3, 12 + r * 2.2, 2, 1.4); x.fillStyle = '#16181c'; x.fillRect(3, 20, 8, 2); },
  teller_desk(x) { x.fillStyle = '#6a4a30'; x.fillRect(0, 4, 30, 12); x.fillStyle = '#8a6a48'; x.fillRect(0, 3, 30, 3); x.fillStyle = 'rgba(180,210,230,0.35)'; x.fillRect(2, 0, 26, 4); x.fillStyle = '#20242c'; x.fillRect(5, 5, 7, 4); x.fillStyle = '#e8e4d8'; x.fillRect(16, 5, 6, 3); x.fillStyle = '#7aa070'; x.fillRect(24, 5, 4, 2); },
  vault_door(x) { const g = x.createRadialGradient(16, 15, 2, 16, 15, 16); g.addColorStop(0, '#c0c4ca'); g.addColorStop(1, '#5a5e66'); x.fillStyle = '#34383e'; x.fillRect(0, 0, 32, 30); x.fillStyle = g; x.beginPath(); x.arc(16, 15, 13, 0, 6.3); x.fill(); x.strokeStyle = '#34383e'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(16, 7); x.lineTo(16, 23); x.moveTo(8, 15); x.lineTo(24, 15); x.stroke(); x.fillStyle = '#20242a'; x.beginPath(); x.arc(16, 15, 3, 0, 6.3); x.fill(); },
  bank_camera(x) { x.fillStyle = '#2a2e34'; x.fillRect(1, 2, 8, 4); x.fillStyle = '#c03030'; x.fillRect(7, 3, 1, 1); x.fillStyle = '#5a5e64'; x.fillRect(4, 0, 2, 2); },
  waiting_chair(x) { x.fillStyle = '#3a4660'; x.fillRect(1, 1, 8, 7); x.fillRect(0, 7, 10, 3); x.fillStyle = '#5a5e64'; x.fillRect(1, 10, 1, 3); x.fillRect(8, 10, 1, 3); },
  bank_desk(x) { x.fillStyle = '#5a3a24'; x.fillRect(0, 3, 28, 11); x.fillStyle = '#7a5434'; x.fillRect(0, 2, 28, 3); x.fillStyle = '#20242c'; x.fillRect(11, 0, 8, 5); x.fillStyle = '#e8e4d8'; x.fillRect(3, 3, 5, 2); },
};
const art = () => { for (const k in NEW) { const [w, h] = NEW[k], c = document.createElement('canvas'); c.width = w; c.height = h; paint[k](c.getContext('2d')); A.sprites[k] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; } };
for (const k in NEW) D[k] = Object.assign({ sprite: k, solid: true }, NEW[k][2]);
const _init = A.init; A.init = function () { _init.call(this); art(); };
if (A.sprites && A.sprites.bush) art();
if (G.SHOP_SIGNS) G.SHOP_SIGNS.push([/^Bank$/, { text: 'BANK', bg: '#2a3a5a', fg: '#e8d890' }]);
const _city = G.MAPGEN.city;
G.MAPGEN.city = () => {
  const m = _city(), BW = 14, BH = 9, at = G.home && (G.home.findSpot(m, BW, BH, Math.floor(m.w / 2) + 12, Math.floor(m.h / 2), Math.max(m.w, m.h)) || G.home.findSpot(m, 11, 8, Math.floor(m.w / 2), Math.floor(m.h / 2), Math.max(m.w, m.h)));
  const pts = (b) => { m.points.c_bank_door = { x: b ? b.doorX + 1 : 30, y: b ? b.doorY - 1 : 30 }; m.points.c_bank_out = { x: b ? b.doorX : 30, y: b ? b.doorY + 2 : 32 }; };
  let spot = at, bw = BW, bh = BH;
  if (!spot) {   // the center is built up: the bank takes over the biggest building nobody lives or works in
    const used = JSON.stringify(Object.values(G.NPCS).filter((d) => d.map === 'city').map((d) => [d.home, d.schedule]));
    const old = m.buildings.filter((q) => (!q.kind || q.kind === 'house') && q.w >= 9 && q.h >= 7 && !used.includes('"' + q.id) && !used.includes(q.id + '_')).sort((p, q) => q.w * q.h - p.w * p.h)[0];
    if (!old) { pts(null); m.points.c_bank_t1 = m.points.c_bank_t2 = m.points.c_bank_mgr = m.points.c_bank_door; return m; }
    spot = { x: old.x, y: old.y }; bw = Math.min(BW, old.w); bh = Math.min(BH, old.h);
    m.buildings.splice(m.buildings.indexOf(old), 1);
    m.decor = m.decor.filter((d) => !(d.tx >= old.x && d.tx < old.x + old.w && d.ty >= old.y && d.ty < old.y + old.h));
    m.chests = (m.chests || []).filter((c) => !(c.tx >= old.x && c.tx < old.x + old.w && c.ty >= old.y && c.ty < old.y + old.h));
  } else G.home.clearArea(m, spot.x, spot.y, bw, bh);
  const b = m.addBuilding('c_bank', spot.x, spot.y, bw, bh, { name: 'Bank', wall: 'wall_brick', floor: 'tilefloor', roof: 'flat_light', kind: 'bank' });
  const P = new G.RoomPlan(m, b);
  P.put('teller_desk', P.ix0 + 1, P.iy0 + 2); P.put('teller_desk', P.ix0 + 4, P.iy0 + 2);
  m.points.c_bank_t1 = { x: P.ix0 + 1, y: P.iy0 + 1 }; m.points.c_bank_t2 = { x: P.ix0 + 4, y: P.iy0 + 1 };
  m.points.c_bank_line = { x: P.ix0 + 2, y: P.iy0 + 4 };
  P.put('bank_desk', P.ix1 - 3, P.iy0 + 1); m.points.c_bank_mgr = { x: P.ix1 - 3, y: P.iy0 };
  P.put('vault_door', P.ix1 - 1, P.iy0 + 2);
  for (let i = 0; i < 3; i++) P.putAny('waiting_chair', P.row(P.iy1, P.ix0, P.ix0 + 5));
  P.putAny('atm', P.row(P.iy1, P.ix1 - 3, P.ix1)); P.putAny('atm', P.row(P.iy1 - 1, P.ix1 - 3, P.ix1));
  P.putAny('plant', P.row(P.iy1, P.ix0, P.ix1)); P.putAny('bank_camera', P.row(P.iy0, P.ix0 + 6, P.ix1 - 5));
  // the queue: posts and a rope ending at the counter
  for (const [x, y] of [[P.ix0 + 1, P.iy0 + 3], [P.ix0 + 3, P.iy0 + 3], [P.ix0 + 5, P.iy0 + 3]]) if (!m.isSolidTile(x, y)) m.addDecor('v_queue_rope', x, y);
  pts(b);
  m.computeSolids(); m.prerender && m.prerender();
  return m;
};
const B = G.bankSys = {
  state(w) { if (w.bankVault == null) { w.bankVault = 60000; w.bankFloat = { c_teller1: 2500, c_teller2: 2500 }; } return w; },
  acct(w) { return E.state(w); },
  dep(w, p, n) { const a = Math.min(n, p.gold), e = this.acct(w); if (a <= 0) return 0; p.gold -= a; e.bank += a; this.state(w).bankVault += a; E.bankLog(w, `Deposit $${a}`); G.audio.play('coin'); return a; },
  wd(w, p, n) { const e = this.acct(w), a = Math.min(n, Math.floor(e.bank), this.state(w).bankVault); if (a <= 0) return 0; e.bank -= a; w.bankVault -= a; p.gold += a; E.bankLog(w, `Withdrawal $${a}`); G.audio.play('coin'); return a; },
  // people with business here, on this map, in opening hours, walk over
  walkIn(scene) {
    const w = scene.world; if (scene.map.id !== 'city' || !open(w) || !scene.map.building('c_bank')) return;
    const pt = scene.map.points.c_bank_line;
    const who = scene.actors.filter((a) => a.kind === 'npc' && !a.dead && !a.transient && G.NPCS[a.id] && a.state === 'schedule' && !a.st.order && !a.st.companion && !a.sleeping && !a.def.kid && !/^c_(teller|bank)/.test(a.id) && ((a.st.gold || 0) > 250 || ((a.st.gold || 0) < 25 && (a.st.bank || 0) > 40)));
    for (const a of who.slice(0, 2)) a.st.order = { t: 'goto', x: pt.x, y: pt.y, map: 'city', until: w.day * 1440 + w.minutes + 90, done: 'bank' };
  },
  counter(scene, npc) {
    const w = scene.world, st = npc.st, keep = F.habit(npc.id), wealth = (st.gold || 0) + (st.bank || 0);
    this.state(w);
    const t = scene.actors.find((a) => a.id === 'c_teller1' || a.id === 'c_teller2');
    npc.say(pick(['Morning. Just some banking.', 'I would like to make a transaction.']), 2.5);
    if (t) { t.faceTowards(npc); t.say(pick(['Next, please.', 'Sign here.', 'There you are.']), 2.5); }
    if ((st.gold || 0) > 250) F.deposit(w, st, st.gold - wealth * keep); else F.withdraw(w, st, 80);
  },
};
F.nearBank = (id) => { const d = G.NPCS[id]; return !!d && d.map === 'city' && false; };
// the counter
const back = [{ text: 'Goodbye.', next: null }];
const robbed = (c) => { c.w.flags.bankRobbed = c.w.day; };
// the tills are made up again each morning, from the vault
G.events.on('newDay', () => { const w = G.world; if (!w || !w.bankFloat) return; for (const k in w.bankFloat) { const need = Math.max(0, 2500 - w.bankFloat[k]), got = Math.min(need, w.bankVault || 0); w.bankFloat[k] += got; w.bankVault -= got; } });
G.DIALOGUES.bank_teller = {
  start: {
    text: (c) => { B.state(c.w); if (c.w.flags.bankRobbed === c.w.day) return 'We... we are closed. Please.'; return open(c.w) ? `Good day. Your balance is $${Math.floor(E.state(c.w).bank)}. How can I help?` : 'We are closed. The ATM is by the wall.'; },
    choices: [
      { text: 'Deposit $100.', if: (c) => open(c.w) && c.gold() >= 100, do: (c) => { B.dep(c.w, c.p, 100); return 'start'; } },
      { text: 'Deposit everything I have on me.', if: (c) => open(c.w) && c.gold() > 0, do: (c) => { B.dep(c.w, c.p, c.gold()); return 'start'; } },
      { text: 'Withdraw $100.', if: (c) => open(c.w) && E.state(c.w).bank >= 100, do: (c) => { B.wd(c.w, c.p, 100); return 'start'; } },
      { text: 'Withdraw everything.', if: (c) => open(c.w) && E.state(c.w).bank >= 1, do: (c) => { B.wd(c.w, c.p, Math.floor(E.state(c.w).bank)); return 'start'; } },
      { text: 'Show me my last transactions.', next: 'history' },
      { text: 'This is a robbery! Give me all your money!', if: (c) => c.w.flags.bankRobbed !== c.w.day && /^c_teller/.test(c.npc.id), next: '_robbery' },
      { text: 'Goodbye.', next: null },
    ],
  },
  history: { text: (c) => { const l = E.state(c.w).log.slice(-5).reverse().map((x) => `Day ${x.day}: ${x.text}`); return l.length ? l.join('\n') : 'Nothing on this account yet.'; }, choices: [{ text: 'Something else...', next: 'start' }].concat(back) },
};
G.DIALOGUE_NODES._robbery = (r) => {
  const { npc, scene } = r, w = scene.world, p = scene.player, P = G.social.persona(npc.id), armed = !!(p.weaponItem && (p.weaponItem.gun || p.weaponItem.dmg > 4)), masked = !!p.equip.mask;
  B.state(w); robbed(r.c);
  const float = w.bankFloat[npc.id] || 0, nerve = P.courage + P.temper / 3 + (armed ? -35 : 25) + (Math.random() * 30 - 15);
  const panic = () => {
    if (G.aware) G.aware.event(scene, { kind: 'crime', x: p.x, y: p.y, who: p, sev: 3, text: `saw the player rob the bank${masked ? ' (face covered)' : ''}`, sight: 220, loud: 200 });
    for (const a of scene.actors) if (a.kind === 'npc' && !a.dead && a !== npc && a.distTo(p) < 170) { if (a.id === 'c_bankguard') { a.startFight(p, scene); a.say('Freeze! Drop it!', 3); } else if (a.def.combat === 'flee') { a.st.fear = Math.max(a.st.fear || 0, 70); a.startFlee(p); a.say(pick(['Oh my God, oh my God!', 'Get down!', 'Somebody call the police!']), 3); } }
  };
  const alarm = () => { scene.reportCrime('robbery', npc); panic(); };
  if (nerve >= 62 || !armed) return { text: pick(['No. I am not doing that. Security!', 'Are you serious? Get out of here. Security!']), choices: [{ text: '[Leave]', next: null, do: () => { alarm(); npc.startFlee(p); } }] };
  if (nerve >= 38) return { text: pick(['O-okay. Okay. Just stay calm. It is coming. *their foot moves under the desk*', 'Alright. Alright. Give me a second...']), choices: [{ text: 'Hurry up.', next: null, do: () => { const n = Math.floor(float * 0.6); w.bankFloat[npc.id] -= n; p.gold += n; G.audio.play('coin'); scene.toast(`+$${n}`); alarm(); } }] };
  return { text: pick(['Please do not hurt me! Here, take it, it is all I have at this window!', 'Take it! Take it! Please!']), choices: [{ text: `[Take the cash] ($${float})`, next: null, do: () => { w.bankFloat[npc.id] = 0; p.gold += float; G.audio.play('coin'); npc.st.fear = 90; npc.startFlee(p); scene.reportCrime('robbery', npc); panic(); } }] };
};
// ATMs, the vault door
const _use = GS.useDecor, _label = GS.decorLabel;
GS.useDecor = function (d) {
  const k = d.def.interact, w = this.world, p = this.player;
  if (k === 'atm') {
    const sc = new G.ListScene('ATM', () => [
      { label: `Balance: $${Math.floor(E.state(w).bank)}`, act: () => '' }, { label: 'Deposit $100', act: () => { B.dep(w, p, 100); } }, { label: 'Withdraw $50', act: () => { B.wd(w, p, 50); } }, { label: 'Withdraw $200', act: () => { B.wd(w, p, 200); } },
    ]);
    G.scenes.push(sc); return;
  }
  if (k === 'vault') { this.toast('A foot of steel. It does not open for you.', 'warn'); return; }
  return _use.apply(this, arguments);
};
GS.decorLabel = function (d) { return d.def.interact === 'atm' ? 'Use the ATM' : d.def.interact === 'vault' ? 'Vault door' : _label.apply(this, arguments); };
G.events.on('hour', () => { const sc = G.scenes && G.scenes.stack.find((x) => x instanceof G.GameScene); if (sc && G.world) try { B.walkIn(sc); } catch (e) { G.reportError && G.reportError(e); } });
void clamp;
})();
