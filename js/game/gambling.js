'use strict';
// Gambling: the casino (Rich District, open 16:00-04:00) and two phone apps.
//   Slots:     3 reels, weighted symbols, pays on three of a kind and on cherries. Casino machines return
//              ~92% of what goes in, the LuckyStrike app ~86%. Luck and the Gambler skill nudge it up.
//   Blackjack: a 6-deck shoe, dealer stands on soft 17, blackjack pays 3:2, double down on two cards.
//              Gambler 1 shows your odds of busting; Gambler 2 sometimes lets you glimpse the hole card.
//   Roulette:  European wheel (one zero). Red/black, odd/even, 1-18/19-36 pay 1:1, dozens 2:1, a number 35:1.
//   SportsBet: bet on tonight's games (results at 21:00). Odds include the bookmaker's cut.
// Table games need the dealer at the table. The house always wins in the long run. That is the point.
(() => {
const U = G.ui;
G.gambling = {
  BETS: [5, 10, 25, 50, 100],
  HIGH: [250, 500, 1000],
  bets(p) { return this.BETS.concat(G.skills.has(p, 'high_roller') ? this.HIGH : []); },
  record(w, bet, won) {
    const g = (w.gambling = w.gambling || { wagered: 0, won: 0, biggest: 0 });
    g.wagered += bet; g.won += won; g.biggest = Math.max(g.biggest, won - bet);
  },
  edge(p, online) { return (online ? 1 : 1.08) + G.skills.rank(p, 'gambler') * 0.02 + (G.skills.stat(p, 'luck') || 0) * 0.01; },
  casinoOpen(w) { const h = w.hourF; return h >= 16 || h < 4; },
  staffAt(scene, id, point) {
    const a = scene.actors.find((x) => x.id === id && !x.dead && x.state === 'schedule');
    const pt = scene.map.points[point];
    return !!(a && pt && Math.hypot(a.x - (pt.x * 16 + 8), a.y - (pt.y * 16 + 12)) < 40);
  },
};

// ---------------------------------------------------------------- shared panel
class GameTable {
  constructor(game, title, online) { this.transparent = true; this.game = game; this.title = title; this.online = online; this.betIdx = 0; this.msg = ''; this.msgCol = U.colors.text; }
  get p() { return this.game.player; }
  get bet() { const b = G.gambling.bets(this.p); return b[Math.min(this.betIdx, b.length - 1)]; }
  frame(ctx, W = 380, H = 230) {
    const R = G.renderer;
    U.dim(ctx, this.inPhone ? 0.6 : 0.5);
    const x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    if (this.inPhone) U.phoneBezel(ctx, x, y, W, H);
    U.panel(ctx, x, y, W, H, { title: this.title, titleSize: 12 });
    U.text(ctx, `$${this.p.gold}`, x + W - 12, y + (G.xp && G.xp.on ? 21 : 8), { align: 'right', size: 10, color: '#e8c060', weight: 'bold' });
    return { x, y, W, H };
  }
  betRow(ctx, x, y, enabled = true) {
    U.text(ctx, 'Bet', x, y + 4, { size: 9, color: U.colors.dim });
    G.gambling.bets(this.p).forEach((b, i) => {
      const r = U.button(ctx, x + 26 + i * 40, y, 36, 16, `$${b}`, { selected: i === this.betIdx, disabled: !enabled || b > this.p.gold, size: 8 });
      if (r.clicked && enabled && b <= this.p.gold) this.betIdx = i;
    });
  }
  keysBet() { const I = G.input, n = G.gambling.bets(this.p).length; if (I.wasPressed('left')) this.betIdx = Math.max(0, this.betIdx - 1); if (I.wasPressed('right')) this.betIdx = Math.min(n - 1, this.betIdx + 1); }
  say(msg, good) { this.msg = msg; this.msgCol = good == null ? U.colors.text : good ? '#8aea7a' : '#ff8a7a'; }
  close() { G.scenes.remove(this); }
}

// ---------------------------------------------------------------- slots
const SYMBOLS = [
  { id: 'cherry', w: 30, pay3: 5, col: '#d83a3a' }, { id: 'lemon', w: 25, pay3: 8, col: '#e8d040' }, { id: 'bell', w: 18, pay3: 15, col: '#e8a030' },
  { id: 'bar', w: 14, pay3: 25, col: '#3a3a3a' }, { id: 'seven', w: 8, pay3: 75, col: '#c82a5a' }, { id: 'diamond', w: 5, pay3: 150, col: '#5ad8f0' },
];
function drawSymbol(ctx, s, x, y, size) {
  const c = (col) => { ctx.fillStyle = col; };
  const k = size / 16;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  switch (s.id) {
    case 'cherry': c('#3a8a3a'); ctx.fillRect(7, 1, 1, 6); ctx.fillRect(8, 1, 4, 1); c(s.col); ctx.fillRect(3, 7, 5, 5); ctx.fillRect(9, 8, 5, 5); c('#ff8a8a'); ctx.fillRect(4, 8, 1, 1); ctx.fillRect(10, 9, 1, 1); break;
    case 'lemon': c(s.col); ctx.fillRect(3, 4, 10, 8); ctx.fillRect(2, 6, 12, 4); c('#fff8a0'); ctx.fillRect(5, 5, 3, 1); break;
    case 'bell': c(s.col); ctx.fillRect(5, 3, 6, 2); ctx.fillRect(4, 5, 8, 5); ctx.fillRect(3, 10, 10, 2); c('#7a5a20'); ctx.fillRect(7, 12, 2, 2); break;
    case 'bar': c('#1a1a1a'); ctx.fillRect(1, 5, 14, 6); c('#f0f0f0'); ctx.font = 'bold 5px sans-serif'; ctx.fillText('BAR', 3, 10); break;
    case 'seven': c(s.col); ctx.fillRect(3, 3, 10, 2); ctx.fillRect(10, 5, 3, 2); ctx.fillRect(8, 7, 3, 2); ctx.fillRect(7, 9, 3, 4); break;
    case 'diamond': c(s.col); ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(14, 8); ctx.lineTo(8, 14); ctx.lineTo(2, 8); ctx.fill(); c('#d8f8ff'); ctx.fillRect(6, 6, 2, 2); break;
  }
  ctx.restore();
}
class SlotsScene extends GameTable {
  constructor(game, online) { super(game, online ? 'LuckyStrike · Slots' : 'Slot Machine', online); this.reels = [0, 1, 2]; this.spinT = 0; this.say('Pick a bet and pull the lever.'); }
  roll() {
    const total = SYMBOLS.reduce((s, x) => s + x.w, 0), luck = G.skills.stat(this.p, 'luck') || 0;
    let r = Math.random() * (total - luck * 1.5);
    for (let i = 0; i < SYMBOLS.length; i++) { r -= SYMBOLS[i].w; if (r <= 0) return i; }
    return SYMBOLS.length - 1;
  }
  spin() {
    const w = this.game.world, bet = this.bet;
    if (this.spinT > 0) return;
    if (this.p.gold < bet) { this.say('Not enough money.', false); return; }
    this.p.gold -= bet;
    this.result = [this.roll(), this.roll(), this.roll()];
    this.spinT = 1.4; this.paid = false;
    G.audio.play('select');
  }
  settle() {
    const w = this.game.world, bet = this.bet, [a, b, c] = this.result;
    let mult = 0;
    if (a === b && b === c) mult = SYMBOLS[a].pay3;
    else if (this.result.filter((i) => SYMBOLS[i].id === 'cherry').length === 2) mult = 2;
    const won = Math.round(bet * mult * (mult ? G.gambling.edge(this.p, this.online) : 0));
    this.p.gold += won;
    G.gambling.record(w, bet, won);
    if (mult >= 75) { this.say(`JACKPOT! +$${won}`, true); G.audio.play('quest'); w.log(`You hit the jackpot on the slots: $${won}!`, 'good'); }
    else if (won) { this.say(`Winner! +$${won}`, true); G.audio.play('pickup'); }
    else this.say(G.rng.pick(['Nothing.', 'So close.', 'The machine blinks at you, smugly.', 'Again?']), false);
  }
  update(dt) {
    const I = G.input;
    if (this.spinT > 0) { this.spinT -= dt; for (let i = 0; i < 3; i++) if (this.spinT > 0.3 + i * 0.35) this.reels[i] = Math.floor(Math.random() * SYMBOLS.length); else this.reels[i] = this.result[i]; if (this.spinT <= 0) this.settle(); return; }
    this.keysBet();
    if (I.wasPressed('confirm') || I.wasPressed('interact')) this.spin();
    if (I.wasPressed('cancel')) this.close();
  }
  render(ctx) {
    const { x, y, W, H } = this.frame(ctx);
    const rx = x + W / 2 - 90;
    if (G.xp) G.xp.rawFill = true;   // the machine's own colors in the Windows look too
    ctx.fillStyle = '#2a0a12'; ctx.fillRect(rx - 6, y + 30, 192, 76);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#f8f0e0'; ctx.fillRect(rx + i * 62, y + 36, 56, 64);
      drawSymbol(ctx, SYMBOLS[this.reels[i]], rx + i * 62 + 8, y + 44, 40);
    }
    if (G.xp) G.xp.rawFill = false;
    U.text(ctx, this.msg, x + W / 2, y + 116, { align: 'center', size: 11, color: this.msgCol, weight: 'bold' });
    U.text(ctx, '3 cherries 5x · 3 lemons 8x · 3 bells 15x · 3 bars 25x · 3 sevens 75x · 3 diamonds 150x · 2 cherries 2x', x + W / 2, y + 136, { align: 'center', size: 6, color: U.colors.dim });
    this.betRow(ctx, x + 20, y + 156, this.spinT <= 0);
    const b = U.button(ctx, x + W / 2 - 50, y + H - 36, 100, 22, this.spinT > 0 ? 'Spinning...' : 'SPIN', { selected: true, disabled: this.spinT > 0 });
    if (b.clicked) this.spin();
    if (U.button(ctx, x + W - 70, y + H - 36, 56, 22, 'Leave', { size: 9 }).clicked) this.close();
  }
}

// ---------------------------------------------------------------- blackjack
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
class BlackjackScene extends GameTable {
  constructor(game) { super(game, 'Blackjack', false); this.shoe = []; this.phase = 'bet'; this.say('Place your bet.'); }
  draw() {
    if (this.shoe.length < 52) { this.shoe = []; for (let d = 0; d < 6; d++) for (const s of SUITS) for (const r of RANKS) this.shoe.push({ s, r }); for (let i = this.shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]]; } }
    return this.shoe.pop();
  }
  value(hand) {
    let v = 0, aces = 0;
    for (const c of hand) { if (c.r === 'A') { aces++; v += 11; } else v += ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r); }
    while (v > 21 && aces) { v -= 10; aces--; }
    return { v, soft: aces > 0 };
  }
  deal() {
    if (this.p.gold < this.bet) { this.say('Not enough money.', false); return; }
    this.stake = this.bet; this.p.gold -= this.stake;
    this.player = [this.draw(), this.draw()]; this.dealer = [this.draw(), this.draw()];
    this.phase = 'play'; this.peek = G.skills.rank(this.p, 'gambler') >= 2 && Math.random() < 0.3;
    this.say('Hit or stand?');
    G.audio.play('select');
    if (this.value(this.player).v === 21) this.finish();
  }
  hit() { this.player.push(this.draw()); G.audio.play('select'); if (this.value(this.player).v > 21) this.finish(); }
  double() { if (this.player.length !== 2 || this.p.gold < this.stake) return; this.p.gold -= this.stake; this.stake *= 2; this.player.push(this.draw()); this.finish(); }
  finish() {
    const w = this.game.world, pv = this.value(this.player).v, natural = pv === 21 && this.player.length === 2;
    if (pv <= 21 && !natural) while (true) { const d = this.value(this.dealer); if (d.v < 17) this.dealer.push(this.draw()); else break; }
    const dv = this.value(this.dealer).v, dNatural = dv === 21 && this.dealer.length === 2;
    let won = 0, msg;
    if (pv > 21) msg = 'Bust.';
    else if (natural && !dNatural) { won = Math.round(this.stake * 2.5); msg = 'BLACKJACK! Pays 3 to 2.'; }
    else if (dNatural && !natural) msg = 'Dealer has blackjack.';
    else if (dv > 21) { won = this.stake * 2; msg = 'Dealer busts. You win!'; }
    else if (pv > dv) { won = this.stake * 2; msg = 'You win!'; }
    else if (pv === dv) { won = this.stake; msg = 'Push. Bet returned.'; }
    else msg = 'Dealer wins.';
    this.p.gold += won;
    G.gambling.record(w, this.stake, won);
    this.say(`${msg} ${won > this.stake ? '+$' + (won - this.stake) : won === this.stake ? '' : '-$' + this.stake}`, won > this.stake ? true : won === this.stake ? null : false);
    this.phase = 'done';
    if (won > this.stake) G.audio.play('pickup');
  }
  bustChance() {
    const v = this.value(this.player);
    let bust = 0, n = 0;
    for (const r of RANKS) { const add = r === 'A' ? 1 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r); const k = r === '10' || r === 'J' || r === 'Q' || r === 'K' ? 1 : 1; n += k; if (!v.soft && v.v + add > 21) bust += k; }
    return Math.round((bust / n) * 100);
  }
  update() {
    const I = G.input;
    if (I.wasPressed('cancel') && this.phase !== 'play') { this.close(); return; }
    if (this.phase === 'bet' || this.phase === 'done') { this.keysBet(); if (I.wasPressed('confirm') || I.wasPressed('interact')) this.deal(); }
    else if (this.phase === 'play') {
      if (I.wasPressed('interact') || I.pressed.has('KeyH')) this.hit();
      else if (I.wasPressed('confirm') || I.pressed.has('KeyS')) this.finish();
      else if (I.pressed.has('KeyD')) this.double();
    }
  }
  drawCard(ctx, c, x, y, hidden) {
    ctx.fillStyle = hidden ? '#7a1a2a' : '#f8f6f0'; ctx.fillRect(x, y, 26, 36);
    ctx.strokeStyle = '#1a1a1a'; ctx.strokeRect(x + 0.5, y + 0.5, 25, 35);
    if (hidden) { ctx.fillStyle = '#a83a4a'; ctx.fillRect(x + 4, y + 4, 18, 28); return; }
    const red = c.s === '♥' || c.s === '♦';
    U.text(ctx, c.r, x + 4, y + 3, { size: 9, color: red ? '#c82a2a' : '#1a1a1a', weight: 'bold', shadow: false });
    U.text(ctx, c.s, x + 13, y + 16, { size: 12, color: red ? '#c82a2a' : '#1a1a1a', align: 'center', shadow: false });
  }
  render(ctx) {
    const { x, y, W, H } = this.frame(ctx);
    ctx.fillStyle = '#1e6a3e'; ctx.fillRect(x + 10, y + 26, W - 20, 132);
    const showHole = this.phase === 'done' || this.phase === 'bet';
    U.text(ctx, 'Dealer' + (this.dealer && showHole ? ` (${this.value(this.dealer).v})` : ''), x + 20, y + 30, { size: 8, color: '#d8f0d8' });
    (this.dealer || []).forEach((c, i) => this.drawCard(ctx, c, x + 20 + i * 30, y + 42, i === 1 && !showHole && !this.peek));
    if (this.peek && this.phase === 'play') U.text(ctx, '(you glimpse the hole card)', x + 20, y + 80, { size: 7, color: '#e8e0a0' });
    U.text(ctx, 'You' + (this.player ? ` (${this.value(this.player).v})` : ''), x + 20, y + 92, { size: 8, color: '#d8f0d8' });
    (this.player || []).forEach((c, i) => this.drawCard(ctx, c, x + 20 + i * 30, y + 104, false));
    if (this.phase === 'play' && G.skills.rank(this.p, 'gambler') >= 1) U.text(ctx, `Bust if you hit: ${this.bustChance()}%`, x + W - 20, y + 104, { size: 8, align: 'right', color: '#e8e0a0' });
    U.text(ctx, this.msg, x + W / 2, y + 162, { align: 'center', size: 10, color: this.msgCol, weight: 'bold' });
    if (this.phase === 'play') {
      if (U.button(ctx, x + 40, y + H - 34, 80, 20, 'Hit').clicked) this.hit();
      if (U.button(ctx, x + 130, y + H - 34, 80, 20, 'Stand', { selected: true }).clicked) this.finish();
      if (U.button(ctx, x + 220, y + H - 34, 90, 20, 'Double', { disabled: this.player.length !== 2 || this.p.gold < this.stake }).clicked) this.double();
    } else {
      this.betRow(ctx, x + 20, y + H - 56);
      if (U.button(ctx, x + W / 2 - 50, y + H - 32, 100, 20, 'Deal', { selected: true }).clicked) this.deal();
      if (U.button(ctx, x + W - 70, y + H - 32, 56, 20, 'Leave', { size: 9 }).clicked) this.close();
    }
  }
}

// ---------------------------------------------------------------- roulette
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_BETS = [
  { id: 'red', label: 'Red', pay: 1, win: (n) => REDS.has(n) }, { id: 'black', label: 'Black', pay: 1, win: (n) => n > 0 && !REDS.has(n) },
  { id: 'odd', label: 'Odd', pay: 1, win: (n) => n > 0 && n % 2 === 1 }, { id: 'even', label: 'Even', pay: 1, win: (n) => n > 0 && n % 2 === 0 },
  { id: 'low', label: '1-18', pay: 1, win: (n) => n >= 1 && n <= 18 }, { id: 'high', label: '19-36', pay: 1, win: (n) => n >= 19 },
  { id: 'd1', label: '1st 12', pay: 2, win: (n) => n >= 1 && n <= 12 }, { id: 'd2', label: '2nd 12', pay: 2, win: (n) => n >= 13 && n <= 24 }, { id: 'd3', label: '3rd 12', pay: 2, win: (n) => n >= 25 },
  { id: 'num', label: 'Number', pay: 35, win: (n, s) => n === s.number },
];
class RouletteScene extends GameTable {
  constructor(game, online) { super(game, online ? 'LuckyStrike · Roulette' : 'Roulette', online); this.kind = 0; this.number = 17; this.spinT = 0; this.ball = 0; this.say('Pick a bet, then spin.'); }
  spin() {
    if (this.spinT > 0) return;
    if (this.p.gold < this.bet) { this.say('Not enough money.', false); return; }
    this.p.gold -= this.bet; this.stake = this.bet;
    this.result = Math.floor(Math.random() * 37);
    this.spinT = 2.2; G.audio.play('select');
  }
  settle() {
    const w = this.game.world, b = ROULETTE_BETS[this.kind], n = this.result;
    const win = b.win(n, this);
    const paid = win ? Math.round(this.stake * (b.pay + 1) * (this.online ? 0.97 : 1)) : 0;
    this.p.gold += paid;
    G.gambling.record(w, this.stake, paid);
    const col = n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
    this.say(`${n} ${col}. ${win ? 'You win +$' + (paid - this.stake) : 'You lose.'}`, win);
    if (win) G.audio.play('pickup');
  }
  update(dt) {
    const I = G.input;
    if (this.spinT > 0) { this.spinT -= dt; this.ball += dt * (4 + this.spinT * 10); if (this.spinT <= 0) this.settle(); return; }
    if (I.wasPressed('up')) this.kind = (this.kind + ROULETTE_BETS.length - 1) % ROULETTE_BETS.length;
    if (I.wasPressed('down')) this.kind = (this.kind + 1) % ROULETTE_BETS.length;
    this.keysBet();
    if (ROULETTE_BETS[this.kind].id === 'num') { if (I.pressed.has('Equal') || I.pressed.has('NumpadAdd')) this.number = (this.number + 1) % 37; if (I.pressed.has('Minus') || I.pressed.has('NumpadSubtract')) this.number = (this.number + 36) % 37; }
    if (I.wasPressed('confirm') || I.wasPressed('interact')) this.spin();
    if (I.wasPressed('cancel')) this.close();
  }
  render(ctx) {
    const { x, y, W, H } = this.frame(ctx);
    // the wheel
    const cx = x + 70, cy = y + 90, r = 50;
    for (let i = 0; i < 37; i++) {
      ctx.fillStyle = i === 0 ? '#1e8a3e' : REDS.has(i) ? '#c82a2a' : '#1a1a1e';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, (i / 37) * Math.PI * 2, ((i + 1) / 37) * Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.fill();
    const ba = this.spinT > 0 ? this.ball : ((this.result || 0) + 0.5) / 37 * Math.PI * 2;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * r * 0.8, cy + Math.sin(ba) * r * 0.8, 3, 0, Math.PI * 2); ctx.fill();
    // bets
    ROULETTE_BETS.forEach((b, i) => {
      const bx = x + 140 + (i % 2) * 112, by = y + 30 + Math.floor(i / 2) * 20;
      const label = b.id === 'num' ? `Number: ${this.number}` : `${b.label} (${b.pay}:1)`;
      const r2 = U.button(ctx, bx, by, 106, 17, label, { selected: i === this.kind, size: 8 });
      if (r2.clicked && this.spinT <= 0) this.kind = i;
      if (b.id === 'num' && i === this.kind) {
        if (U.button(ctx, bx + 110, by, 16, 17, '-', { size: 8 }).clicked) this.number = (this.number + 36) % 37;
        if (U.button(ctx, bx + 128, by, 16, 17, '+', { size: 8 }).clicked) this.number = (this.number + 1) % 37;
      }
    });
    U.text(ctx, this.msg, x + W / 2, y + 150, { align: 'center', size: 10, color: this.msgCol, weight: 'bold' });
    this.betRow(ctx, x + 20, y + H - 56, this.spinT <= 0);
    if (U.button(ctx, x + W / 2 - 50, y + H - 32, 100, 20, this.spinT > 0 ? 'Spinning...' : 'SPIN', { selected: true, disabled: this.spinT > 0 }).clicked) this.spin();
    if (U.button(ctx, x + W - 70, y + H - 32, 56, 20, 'Leave', { size: 9 }).clicked) this.close();
  }
}

// ---------------------------------------------------------------- LuckyStrike (online casino app)
class LuckyStrikeScene {
  constructor(game) { this.transparent = true; this.game = game; this.sel = 0; }
  open(i) { const s = i === 0 ? new SlotsScene(this.game, true) : new RouletteScene(this.game, true); s.inPhone = true; G.scenes.push(s); }
  update() { const r = U.nav(this, 'sel', 2); if (r === 'confirm') this.open(this.sel); if (r === 'cancel') G.scenes.remove(this); }
  render(ctx) {
    const R = G.renderer, W = 300, H = 170, x = (R.uiW - W) / 2, y = (R.uiH - H) / 2;
    U.dim(ctx, 0.6); U.phoneBezel(ctx, x, y, W, H);
    U.panel(ctx, x, y, W, H, { title: 'LuckyStrike Online Casino', titleSize: 12 });
    const g = this.game.world.gambling || { wagered: 0, won: 0 };
    U.text(ctx, `Lifetime: wagered $${g.wagered}, won back $${g.won}`, x + W / 2, y + 28, { align: 'center', size: 8, color: U.colors.dim });
    const i = U.menu(ctx, this, [{ label: 'Slots' }, { label: 'Roulette' }], x + 60, y + 50, W - 120, 22, 6);
    if (i >= 0) this.open(i);
    U.text(ctx, 'Gamble responsibly. (Nobody does.)', x + W / 2, y + H - 16, { align: 'center', size: 7, color: U.colors.dim });
  }
}

// ---------------------------------------------------------------- SportsBet
const TEAMS = ['Harbor Hawks', 'Eastside Bulldogs', 'Southside Kings', 'Suburb Stallions', 'Rural Rattlers', 'Center City FC', 'Heights Royals', 'County Convicts'];
G.sports = {
  today(w) {
    if (w.sports && w.sports.day === w.day) return w.sports;
    const r = new G.RNG('sports' + w.day), games = [];
    const pool = TEAMS.slice();
    for (let i = 0; i < 3; i++) {
      const a = pool.splice(r.int(0, pool.length - 1), 1)[0], b = pool.splice(r.int(0, pool.length - 1), 1)[0];
      const pa = r.range(0.25, 0.75);
      games.push({ a, b, pa, oa: Math.max(1.05, +(0.93 / pa).toFixed(2)), ob: Math.max(1.05, +(0.93 / (1 - pa)).toFixed(2)), winner: null });
    }
    w.sports = { day: w.day, games, bets: (w.sports && w.sports.bets || []).filter((b) => !b.done) };
    return w.sports;
  },
  place(w, p, gi, side, amount) {
    const s = this.today(w), gm = s.games[gi];
    if (w.hour >= 19 || gm.winner || p.gold < amount) return false;
    p.gold -= amount;
    s.bets.push({ day: w.day, gi, side, amount, odds: side === 'a' ? gm.oa : gm.ob, team: side === 'a' ? gm.a : gm.b });
    return true;
  },
  resolve(w, scene) {
    const s = this.today(w);
    if (w.hour !== 21) return;
    for (const gm of s.games) if (!gm.winner) gm.winner = Math.random() < gm.pa ? 'a' : 'b';
    for (const b of s.bets) {
      if (b.done || b.day !== w.day) continue;
      b.done = true;
      const gm = s.games[b.gi], won = gm.winner === b.side;
      const pay = won ? Math.round(b.amount * b.odds) : 0;
      scene.player.gold += pay;
      G.gambling.record(w, b.amount, pay);
      w.log(`SportsBet: ${gm.a} vs ${gm.b}, ${gm.winner === 'a' ? gm.a : gm.b} won. ${won ? 'You won $' + pay + '!' : 'You lost $' + b.amount + '.'}`, won ? 'good' : 'warn');
      scene.toast(`SportsBet: ${won ? 'you won $' + pay : 'your bet on ' + b.team + ' lost'}.`, won ? 'good' : 'bad');
    }
  },
};
class SportsBetScene extends GameTable {
  constructor(game) { super(game, 'SportsBet · Tonight 21:00', true); this.say(game.world.hour >= 19 ? 'Betting is closed for tonight. Results at 21:00.' : 'Pick a team. Odds include our cut. Bets close at 19:00.'); }
  update() { this.keysBet(); if (G.input.wasPressed('cancel')) this.close(); }
  render(ctx) {
    const { x, y, W, H } = this.frame(ctx, 360, 210), w = this.game.world, s = G.sports.today(w);
    s.games.forEach((gm, i) => {
      const gy = y + 30 + i * 34;
      U.text(ctx, `${gm.a}  vs  ${gm.b}`, x + 16, gy, { size: 9 });
      if (gm.winner) { U.text(ctx, `Final: ${gm.winner === 'a' ? gm.a : gm.b} won`, x + 16, gy + 14, { size: 8, color: U.colors.dim }); return; }
      for (const side of ['a', 'b']) {
        const r = U.button(ctx, x + 16 + (side === 'a' ? 0 : 160), gy + 12, 150, 16, `${side === 'a' ? gm.a : gm.b} @ ${side === 'a' ? gm.oa : gm.ob}`, { size: 7, disabled: w.hour >= 19 || this.p.gold < this.bet });
        if (r.clicked && G.sports.place(w, this.p, i, side, this.bet)) { this.say(`$${this.bet} on ${side === 'a' ? gm.a : gm.b}. Good luck.`, true); G.audio.play('select'); }
      }
    });
    const open = s.bets.filter((b) => !b.done).length;
    U.text(ctx, this.msg + (open ? `  (${open} open bet${open > 1 ? 's' : ''})` : ''), x + W / 2, y + 136, { align: 'center', size: 8, color: this.msgCol });
    this.betRow(ctx, x + 16, y + H - 50);
    if (U.button(ctx, x + W - 70, y + H - 28, 56, 18, 'Close', { size: 9 }).clicked) this.close();
  }
}

G.PHONE_APPS.luckystrike = (scene) => new LuckyStrikeScene(scene);
G.PHONE_APPS.sportsbet = (scene) => new SportsBetScene(scene);
Object.assign(G, { SlotsScene, BlackjackScene, RouletteScene, SportsBetScene, LuckyStrikeScene });

// ---------------------------------------------------------------- the casino floor
G.usables.LABELS = Object.assign(G.usables.LABELS, { slots: 'Play the slots', blackjack: 'Play blackjack', roulette: 'Play roulette' });
const _use = G.usables.use;
G.usables.use = function (d, scene) {
  const k = d.def.interact, w = scene.world;
  if (k === 'slots' || k === 'blackjack' || k === 'roulette') {
    if (!G.gambling.casinoOpen(w)) { scene.toast('The casino is closed. (Open 16:00 to 04:00)'); return; }
    if (k === 'slots') { G.scenes.push(new SlotsScene(scene, false)); return; }
    const staff = k === 'blackjack' ? ['h_dealer', 'h_casino_bj'] : ['h_croupier', 'h_casino_roulette'];
    if (!G.gambling.staffAt(scene, ...staff)) { scene.toast('There is nobody running this table right now.'); return; }
    G.scenes.push(k === 'blackjack' ? new BlackjackScene(scene) : new RouletteScene(scene, false));
    return;
  }
  return _use.call(this, d, scene);
};
G.events.on('hour', () => {
  const scene = G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
  if (scene && G.world) G.sports.resolve(G.world, scene);
});
})();
