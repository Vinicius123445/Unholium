'use strict';
// The love scene, staged in three acts (still the same rhythm minigame underneath, js/game/love.js):
//   1. The kiss: the two of you by the bed, closing in; clothes come off and land on the floor.
//   2. The bed: under the sheets, the bed rocking with your rhythm. How it is staged depends on who is in
//      it (a man and a woman, two men, two women): who is where, how you hold each other, and the lines.
//   3. Afterwards: lying together, breathing slowing down; how it went shows in how close you lie.
// Suggestive, not graphic: everything below the shoulders is under the sheet (and nudity still follows
// Settings > Censor Nudity).
(() => {
const pick = (a) => G.rng.pick(a);
const LINES = {
  mf: {
    one: ['A kiss at the door that does not stop at the door.', 'Clothes hit the floor one piece at a time.', 'Hands, buttons, a zipper that sticks. Laughter. Then no laughter.'],
    two: ['The bed creaks. Neither of you cares.', 'Slow at first. Then not.', 'Their breath catches. So does yours.'],
    swap: ['They roll you over with a grin.', 'You trade places. They seem to like it up there.'],
  },
  mm: {
    one: ['Neither of you is in any hurry. Then both of you are.', 'A hand on the back of the neck. A kiss like a dare.', 'Belts. Boots. Somebody swears at a stubborn button.'],
    two: ['Strong arms, rough stubble, the bed protesting.', 'He pulls you closer. Closer is not close enough.', 'Low voices in the dark.'],
    swap: ['He pushes you down onto the pillows, and you let him.', 'You take the lead. He does not argue.'],
  },
  ff: {
    one: ['Soft laughter, a zipper, then neither of you is laughing.', 'Her hands in your hair. Yours in hers.', 'Clothes left wherever they fall.'],
    two: ['Tangled together under the sheets.', 'Slow, and then slower, on purpose.', 'Whispers you will not repeat to anyone.'],
    swap: ['She rolls on top of you, hair falling around both your faces.', 'You pin her wrists to the pillow, gently. She smiles.'],
  },
  after: { good: ['Neither of you wants to move. Ever.', 'Their head on your chest. Heartbeats slowing down together.', 'You lie there in the warm dark, grinning like idiots.'],
    mid: ['Later. Sheets everywhere.', 'Quiet. Comfortable.'], bad: ['Well. That was... a thing.', 'You both stare at the ceiling. Awkward.'] },
};
const LS = G.LoveScene.prototype, _upd = LS.update;
LS.stageInit = function () {
  if (this.stage) return;
  const pb = (this.game.player.currentLook().body || 'm'), nb = (this.npc.look.body || 'm');
  this.pair = pb === nb ? (pb === 'f' ? 'ff' : 'mm') : 'mf';
  const L = LINES[this.pair];
  this.LEN = 15;
  this.stage = { one: pick(L.one), two: pick(L.two), swap: pick(L.swap), swapAt: G.rng.range(0.45, 0.6), sideBySide: Math.random() < 0.5 };
  // undressed looks for act two (the censor setting applies as everywhere else)
  const strip = (l) => Object.assign({}, l, { shirtless: true, hat: null, mask: null, glasses: null });
  this.bare = [G.assets.character(strip(this.game.player.currentLook())), G.assets.character(strip(this.npc.look))];
};
LS.update = function (dt) { this.stageInit(); return _upd.call(this, dt); };

LS.render = function (ctx) {
  this.stageInit();
  const R = G.renderer, A = G.assets, k = Math.max(2, Math.floor(Math.min(R.W / 160, R.H / 100))), K = k * 1.6;
  R.screenTransform();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0c080c'; ctx.fillRect(0, 0, R.W, R.H);
  const cx = R.W / 2, cy = R.H / 2, T = this.t / this.LEN, sync = this.conn;
  const act = T < 0.27 ? 1 : T < 0.82 ? 2 : 3;
  const fl = A.tile('woodfloor', 0), wl = A.tile('wall_inner', 0) || A.tile('wall_plaster', 0);
  for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) ctx.drawImage(y === -3 ? wl : fl, cx + x * 16 * k - 8 * k, cy + y * 16 * k - 8 * k, 16 * k, 16 * k);
  const bed = A.sprites.bed_double, bw = bed.w * K, bh = bed.h * K, bx = cx - bw / 2, by = cy - bh / 2 - 10 * k;
  const beatP = Math.sin(this.phase * Math.PI * 2);
  const bob = act === 2 ? beatP * k * (0.4 + sync * 0.9) : act === 3 ? Math.sin(this.t * 1.4) * k * 0.25 : 0;
  ctx.drawImage(bed.img, bx, by + bob * 0.3, bw, bh);
  const lamp = A.sprites.nightstand;
  ctx.drawImage(lamp.img, bx + bw + 4 * k, by + 4 * k, lamp.w * K, lamp.h * K);
  // clothes on the floor: they pile up during act one
  const pl = this.game.player.currentLook(), nl = this.npc.look;
  const pile = [[pl.shirt, -60, 30], [nl.shirt, 45, 34], [pl.pants, -40, 42], [nl.pants || '#4a3a2a', 62, 46], ['#2a1e14', -70, 50], ['#2a1e14', 70, 54]];
  const shown = act === 1 ? Math.floor((T / 0.27) * (pile.length + 1)) : pile.length;
  pile.slice(0, shown).forEach(([c, ox, oy], i) => {
    ctx.fillStyle = c || '#888'; ctx.save(); ctx.translate(cx + ox * k, cy + oy * k); ctx.rotate((i * 0.7) % 1.2 - 0.6); ctx.fillRect(-5 * k, -3 * k, (i > 3 ? 5 : 11) * k, (i > 3 ? 3 : 6) * k); ctx.restore();
  });
  const sheets = [this.game.player.sheet, this.npc.sheet], skin = [pl.skin || '#e0b088', nl.skin || '#e0b088'];
  // HD people (js/game/hdchars.js)
  const head = (s, i, x, y, row = 0) => { const h = G.hd.get(s), rows = 19, kk = (s.fw * K) / G.hd.FW * (G.hd.WW / 16); ctx.drawImage(h.img, 0, row * G.hd.FH, G.hd.FW, rows, x + (s.fw * K - G.hd.FW * kk) / 2, y - 2 * K, G.hd.FW * kk, rows * kk * (G.hd.WH / G.hd.FH) / (G.hd.WW / G.hd.FW)); };
  const fig = (s, row, x, fy, col = 0) => { const h = G.hd.get(s), w = G.hd.WW / 16 * s.fw * K, hh = G.hd.WH / 20 * s.fh * K; ctx.drawImage(h.img, ((G.hd.COL.idle + col)) * G.hd.FW, row * G.hd.FH, G.hd.FW, G.hd.FH, x - w / 2, fy - hh, w, hh); };
  const shoulders = (i, x, y, w = 10) => { ctx.fillStyle = skin[i]; ctx.fillRect(x + 3 * K, y + 9 * K, w * K, 2 * K); };
  const sheet = (x, y, w, h, hump) => {   // the bedsheet, with the shape of whoever is under it
    ctx.fillStyle = '#7a5aa0'; ctx.fillRect(x, y, w, h);
    if (hump) { ctx.fillStyle = '#86669f'; ctx.fillRect(hump.x, y - hump.h, hump.w, hump.h + 2); ctx.fillStyle = '#9a7ac0'; ctx.fillRect(hump.x, y - hump.h, hump.w, K); }
    ctx.fillStyle = '#9a7ac0'; ctx.fillRect(x, y, w, K);
    ctx.fillStyle = '#5a3a80'; ctx.fillRect(x + 6 * k, y + 5 * K - bob, w - 12 * k, 2 * k);
  };
  if (act === 1) {
    // standing by the foot of the bed, closing in, a kiss; clothes coming off
    const p1 = Math.min(1, (T / 0.27) * 1.6), gap = (1 - p1) * 26 * k + 4.5 * K, fy = by + bh + 12 * k;   // standing at the foot of the bed
    const bare = T > 0.17;
    const s0 = bare ? this.bare[0] : sheets[0], s1 = bare ? this.bare[1] : sheets[1];
    const lean = p1 >= 1 ? Math.sin(this.t * 3) * 0.5 * k : 0;
    fig(s0, 2, cx - gap + lean, fy, Math.floor(this.t * 1.6) % 4);   // you, facing right
    fig(s1, 1, cx + gap - lean, fy, (Math.floor(this.t * 1.6) + 2) % 4);  // them, facing left
    if (p1 >= 1) G.love.hearts(ctx, cx, fy - s0.fh * K - 4 * k);
  } else if (act === 2) {
    const swapped = T > 0.27 + (0.82 - 0.27) * this.stage.swapAt;
    const top = by + 2 * K, sx = bx + K, sw = bw - 2 * K, sy = by + 13 * K + bob;
    if (this.pair === 'mf' || (this.pair !== 'mf' && !this.stage.sideBySide)) {
      // one above the other: the one underneath on the pillow, the other over them (they trade places later)
      const lower = swapped ? 0 : 1, upper = 1 - lower;
      const lx = cx - 12 * K, ly = top + 1 * K;   // on the pillow
      head(this.bare[lower], lower, lx, ly, 0);
      shoulders(lower, lx, ly);
      const ux = cx - 3 * K + Math.sin(this.t * 2) * 0.4 * k, uy = ly + 6 * K + bob * 1.2;   // beside and over them, not on top of their face
      sheet(sx, sy, sw, bh - 14 * K, { x: cx - 9 * K, w: 18 * K, h: 4 * K + Math.abs(bob) });
      head(this.bare[upper], upper, ux, uy - 4 * K, 3);   // seen from behind, leaning over them
      ctx.fillStyle = skin[upper]; ctx.fillRect(ux + 2 * K, uy + 5 * K, 12 * K, 3 * K);   // a bare back above the sheet
    } else if (this.pair === 'mm') {
      // close together on their sides, one behind the other (then facing each other)
      const a = swapped ? [cx - 10 * K, cx + 1 * K] : [cx - 9 * K, cx - 3 * K];
      head(this.bare[0], 0, a[0] + bob * 0.4, top + K, swapped ? 2 : 2);
      head(this.bare[1], 1, a[1] - bob * 0.4, top + K + (swapped ? 0 : K), swapped ? 1 : 2);
      shoulders(0, a[0], top + K, 9); shoulders(1, a[1], top + K, 9);
      sheet(sx, sy, sw, bh - 14 * K, { x: cx - 12 * K, w: 24 * K, h: 3 * K + Math.abs(bob) });
    } else {
      // face to face, foreheads close, fingers laced on the pillow (then one curled against the other)
      const d = (1 - sync) * 3 * K + 4 * K;
      head(this.bare[0], 0, cx - d - 8 * K + bob * 0.3, top + K, 2);
      head(this.bare[1], 1, cx + d - 8 * K - bob * 0.3, top + K + (swapped ? 2 * K : 0), 1);
      shoulders(0, cx - d - 8 * K, top + K, 9); shoulders(1, cx + d - 8 * K, top + K, 9);
      ctx.fillStyle = skin[0]; ctx.fillRect(cx - 3 * K, top + 6 * K, 3 * K, 1.5 * K);
      ctx.fillStyle = skin[1]; ctx.fillRect(cx, top + 6.5 * K, 3 * K, 1.5 * K);
      sheet(sx, sy, sw, bh - 14 * K, { x: cx - 11 * K, w: 22 * K, h: 3 * K + Math.abs(bob) });
    }
    if (sync > 0.6) { G.love.hearts(ctx, cx, by - 4 * k); G.love.hearts(ctx, cx + 20 * k, by + 4 * k); }
  } else {
    // afterwards: side by side, closer the better it went; one head on the other's chest when it went well
    const close = sync > 0.65, top = by + 2 * K;
    if (close) {
      head(this.bare[1], 1, cx - 9 * K, top + K, 0); shoulders(1, cx - 9 * K, top + K, 10);
      head(this.bare[0], 0, cx - 3 * K, top + 7 * K, 1);   // resting on their chest
    } else {
      const gap = sync < 0.35 ? 8 * K : 3 * K;
      head(this.bare[0], 0, cx - gap - 12 * K, top + K, 0); head(this.bare[1], 1, cx + gap - 4 * K, top + K, 0);
      shoulders(0, cx - gap - 12 * K, top + K, 9); shoulders(1, cx + gap - 4 * K, top + K, 9);
    }
    sheet(bx + K, by + 13 * K + bob, bw - 2 * K, bh - 14 * K, null);
    if (close) G.love.hearts(ctx, cx + 6 * k, by - 2 * k);
  }
  // warm, dim light
  const g = ctx.createRadialGradient(cx, cy - 10 * k, 20 * k, cx, cy, Math.max(R.W, R.H) * 0.6);
  g.addColorStop(0, 'rgba(255,170,90,0.08)'); g.addColorStop(1, 'rgba(10,0,8,0.88)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
  // the rhythm ring (only while it matters: the bed act)
  R.uiTransform();
  const U = G.ui, hx = R.uiW / 2, hy = R.uiH - 70, outer = 22;
  if (this.t < this.LEN) {
    ctx.strokeStyle = 'rgba(255,170,200,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, outer, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = this.flash > 0 ? `rgba(255,240,250,${0.5 + this.flash * 0.5})` : 'rgba(255,120,170,0.9)';
    ctx.beginPath(); ctx.arc(hx, hy, 4 + this.phase * (outer - 4), 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    G.love.hearts(ctx, hx, hy + 3);
    const w2 = 140, x2 = hx - w2 / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x2, hy + 30, w2, 5);
    ctx.fillStyle = '#ff7ab0'; ctx.fillRect(x2, hy + 30, w2 * this.conn, 5);
    U.text(ctx, 'Connection', hx, hy + 37, { size: 7, align: 'center', color: '#f4c8dc' });
    U.text(ctx, 'Keep the rhythm', hx, hy + 47, { size: 7, align: 'center', color: '#a88a98' });
  }
  // captions: one per beat of the story
  const swapT = 0.27 + (0.82 - 0.27) * this.stage.swapAt;
  const line = act === 1 ? this.stage.one : act === 2 ? (T > swapT && T < swapT + 0.12 ? this.stage.swap : this.stage.two)
    : (this.stage.afterLine = this.stage.afterLine || pick(sync > 0.65 ? LINES.after.good : sync > 0.35 ? LINES.after.mid : LINES.after.bad));
  if (this.lastLine !== line) { this.lastLine = line; this.lineT = this.t; }
  ctx.globalAlpha = Math.min(1, (this.t - (this.lineT || 0)) * 2);
  U.text(ctx, line, R.uiW / 2, 30, { align: 'center', size: 11, color: '#f4dce8' });
  ctx.globalAlpha = 1;
  if (this.t > this.LEN - 0.4) { R.screenTransform(); ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (this.t - this.LEN + 0.4) / 1.2)})`; ctx.fillRect(0, 0, R.W, R.H); }
};
})();
