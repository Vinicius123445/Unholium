'use strict';
// Trust and trading.
//   G.trust: how much someone trusts you (0..100), apart from how much they like you. It grows from liking,
//   romance, being your partner or in your party, family, and honest trades; it falls when you have hurt them,
//   scared them, robbed or threatened them (what they remember of you), or when you are wanted by the police.
//   st.trustAdj keeps what happened between you (trades, and what the AI dialogue decided: js/game/aidialogue.js).
//
//   Trading: "Want to trade?" (or a generated conversation that ends in an offer) opens the barter screen if
//   they feel like it: their pockets on the left, yours on the right. Pick what changes hands (and cash);
//   they accept when what they get is worth enough to them, and that depends on how much they trust you.
//   Managing someone's things (give, take, make them wear or use something) needs a lot more: your party,
//   your partner, or deep trust (the companion screen, js/game/companionitems.js).
(() => {
const U = G.ui, clamp = G.util.clamp;
const nowMin = (w) => w.day * 1440 + w.minutes;
const BAD = /(stole|robbed|rob |mugged|hit me|hurt|beat|threat|shot|stab|attack|killed|lied|cheat)/i;
const LAWFUL = new Set(['government', 'civilians', 'cia']);

G.trust = {
  // -> { v: 0..100, name }
  of(w, id) {
    const st = w.npcs[id]; if (!st) return { v: 0, name: 'None' };
    let v = 30 + (st.disp || 0) * 0.45;
    if (st.partner) v += 30; else if ((st.romance || 0) >= 40) v += 12;
    if (st.loveDay != null) v += 8;
    if (st.companion) v += 15;
    if (G.rel.familyOf && G.rel.familyOf(w, id)) v += 25;
    if (st.introduced) v += 4;
    if (st.hurtByPlayer && nowMin(w) - st.hurtByPlayer < 3 * 1440) v -= 40;
    v -= Math.min(30, (st.fear || 0) * 0.35);
    const bad = (st.memory || []).filter((m) => BAD.test(m.what || '')).length + (st.aiMemory || []).filter((m) => BAD.test(m.text || '')).length;
    v -= Math.min(30, bad * 8);
    if (G.law && G.law.isWanted && G.law.isWanted(w)) v -= 10;
    v += st.trustAdj || 0;
    v = Math.round(clamp(v, 0, 100));
    return { v, name: v >= 85 ? 'Complete trust' : v >= 65 ? 'Trusts you' : v >= 45 ? 'Some trust' : v >= 25 ? 'Wary of you' : 'No trust at all' };
  },
  adjust(w, id, n) { const st = w.npcs[id]; if (st && n) st.trustAdj = clamp((st.trustAdj || 0) + n, -50, 50); },

  // Will they trade with you right now? -> null (yes) or why not (a line they could say)
  tradeRefusal(scene, npc) {
    const w = scene.world, st = npc.st, t = this.of(w, npc.id).v;
    if (npc.dead || npc.remote || npc.sleeping) return 'Not now.';
    if (npc.def.combat === 'guard') return 'I am on duty. No trading.';
    if (st.hostile || (st.fear || 0) >= 40) return 'Stay away from me.';
    if ((st.disp || 0) < -10 || t < 25) return 'I do not do business with people I do not trust.';
    if (!(st.inv || []).some((e) => e[1] > 0) && !(st.gold > 0)) return 'I have nothing worth trading.';
    return null;
  },
  // Will they let you go through their things? (party, partner, or deep trust)
  manageAllowed(scene, npc) {
    const st = npc.st;
    if (npc.dead || npc.remote || npc.def.combat === 'guard' || npc.def.kid) return false;
    return !!(st.companion || st.partner || this.of(scene.world, npc.id).v >= 75);
  },
  // How much more their side must be worth to them (1 = an even swap)
  margin(scene, npc) {
    const st = npc.st, t = this.of(scene.world, npc.id).v;
    if (st.companion || st.partner) return 0.7;
    const barter = G.skills && G.skills.stat ? G.skills.stat(scene.player, 'barter') || 0 : 0;
    return clamp(1.45 - t / 160 - barter * 0.5, 0.8, 1.5);
  },
};

// ---------------------------------------------------------------- the barter screen
class BarterScene {
  constructor(game, npc) {
    this.transparent = true;
    this.game = game; this.npc = npc; this.st = npc.st;
    this.st.inv = this.st.inv || [];
    this.side = 0; this.sel = 0; this.scroll = [0, 0];
    this.give = {}; this.take = {};       // item id -> units, from your pockets / from theirs
    this.cashGive = 0; this.cashTake = 0;
    this.say = G.rng.pick(['Let us see what you have.', 'Alright. Show me.', 'What are you offering?']);
    G.audio.play('select');
  }
  get w() { return this.game.world; }
  name() { return this.w.displayName(this.npc.id); }
  theirs() { return this.st.inv.filter((e) => e[1] > 0 && G.item(e[0])).map((e) => ({ id: e[0], qty: e[1] })); }
  yours() {
    const out = [];
    for (const s of this.game.player.inventory.slots) if (s && G.item(s.id) && G.item(s.id).type !== 'quest') { const e = out.find((o) => o.id === s.id); if (e) e.qty += s.qty; else out.push({ id: s.id, qty: s.qty }); }
    return out;
  }
  value(id) { return Math.max(1, G.item(id).value || 1); }
  sum(map) { return Object.entries(map).reduce((s, [id, n]) => s + this.value(id) * n, 0); }
  // what it is worth to them: what they get against what they give up
  offer() { return { get: this.sum(this.give) + this.cashGive, lose: this.sum(this.take) + this.cashTake }; }
  verdict() {
    const { get, lose } = this.offer(), need = Math.ceil(lose * G.trust.margin(this.game, this.npc));
    if (!get && !lose) return { ok: false, text: 'Pick something.' };
    if (!lose) return { ok: true, text: 'A gift? I will take it.' };
    const illegal = Object.keys(this.give).find((id) => G.item(id).illegal);
    if (illegal && LAWFUL.has(this.npc.def.faction) && !G.CRIMINAL_FACTIONS.includes(this.npc.def.faction)) return { ok: false, text: `I am not touching that ${G.item(illegal).name.toLowerCase()}.` };
    if (get >= need) return { ok: true, text: get >= need * 1.4 ? 'That is generous. Deal.' : 'Fair enough. Deal.' };
    return { ok: false, text: get >= need * 0.7 ? 'Close. Add a little more.' : 'Not worth it to me.' };
  }
  pick(side, e, d) {
    const map = side === 0 ? this.take : this.give, have = e.qty, cur = map[e.id] || 0;
    const n = clamp(cur + d, 0, have);
    if (n) map[e.id] = n; else delete map[e.id];
    G.audio.play('select');
  }
  deal() {
    const v = this.verdict(), p = this.game.player, w = this.w;
    if (!v.ok) { this.say = v.text; G.audio.play('error'); return; }
    const takeIds = Object.entries(this.take);
    for (const [id, n] of takeIds) if (!p.inventory.canFit(id, n)) { this.say = 'You cannot carry all that.'; G.audio.play('error'); return; }
    if (this.cashGive > p.gold || this.cashTake > (this.st.gold || 0)) { this.say = 'Somebody does not have that much cash.'; return; }
    for (const [id, n] of Object.entries(this.give)) { p.inventory.remove(id, n); const e = this.st.inv.find((x) => x[0] === id); if (e) e[1] += n; else this.st.inv.push([id, n]); }
    for (const [id, n] of takeIds) { const e = this.st.inv.find((x) => x[0] === id); if (e) e[1] -= n; p.inventory.add(id, n); if (this.st.equip) for (const k in this.st.equip) if (this.st.equip[k] === id && !(e && e[1] > 0)) delete this.st.equip[k]; }
    this.st.inv = this.st.inv.filter((x) => x[1] > 0);
    p.gold += this.cashTake - this.cashGive; this.st.gold = (this.st.gold || 0) + this.cashGive - this.cashTake;
    const { get, lose } = this.offer();
    G.trust.adjust(w, this.npc.id, get >= lose * 1.3 ? 2 : 1);
    if (get >= lose * 1.5 && lose > 0) G.social.addDisp(w, this.npc.id, 2);
    (this.st.aiMemory = this.st.aiMemory || []).push({ text: 'traded with the player fairly', day: w.day }); this.st.aiMemory = this.st.aiMemory.slice(-5);
    this.give = {}; this.take = {}; this.cashGive = 0; this.cashTake = 0;
    this.say = v.text; G.audio.play('coin');
    this.game.toast(`You traded with ${this.name()}.`, 'good');
  }
  close() { G.audio.play('back'); G.scenes.remove(this); }
  update() {
    const I = G.input, list = this.side === 0 ? this.theirs() : this.yours();
    if (I.wasPressed('cancel')) { this.close(); return; }
    if (I.wasPressed('left') || I.wasPressed('right')) { this.side = 1 - this.side; this.sel = 0; G.audio.play('select'); return; }
    if (I.wasPressed('up')) { this.sel = Math.max(0, this.sel - 1); this.follow = true; }
    if (I.wasPressed('down')) { this.sel = Math.min(list.length - 1, this.sel + 1); this.follow = true; }
    if (I.wasPressed('confirm') && list[this.sel]) this.pick(this.side, list[this.sel], 1);
    if (I.pressed.has('Backspace') && list[this.sel]) this.pick(this.side, list[this.sel], -1);
    if (I.pressed.has('KeyT')) this.deal();
  }
  render(ctx) {
    U.dim(ctx, 0.5);
    const R = G.renderer, m = G.input.mouse, W = Math.min(460, R.uiW - 20), H = Math.min(262, R.uiH - 10), x = Math.round((R.uiW - W) / 2), y = Math.round((R.uiH - H) / 2);
    U.panel(ctx, x, y, W, H, { title: `Trade with ${this.name()}`, titleSize: 11 });
    const t = G.trust.of(this.w, this.npc.id), tier = G.rel.tier(this.st, this.npc.id);
    U.text(ctx, `${tier.name} · ${t.name}`, x + W - 10, y + 20, { size: 7, align: 'right', color: G.xp && G.xp.on ? '#3a4a66' : tier.color });
    const colW = (W - 30) / 2, top = y + 30, rowH = 15, rows = Math.max(3, Math.floor((H - 30 - 74) / rowH));
    [[0, `${this.name()}'s things`, this.theirs(), this.take, this.st.gold || 0], [1, 'Your things', this.yours(), this.give, this.game.player.gold]].forEach(([side, label, list, map, cash]) => {
      const cx = x + 10 + side * (colW + 10);
      U.text(ctx, label, cx, top - 12, { size: 8, weight: 'bold', color: this.side === side ? U.colors.borderLight : U.colors.text });
      U.text(ctx, `$${cash}`, side === 1 ? cx + colW - 96 : cx + colW, top - 12, { size: 8, align: 'right', color: '#a8e0a0' });
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx, top, colW, rows * rowH);
      // each side scrolls on its own: the wheel over it, its bar, or the arrow keys (the selection comes into view)
      const barW = list.length > rows ? (G.xp && G.xp.on ? 11 : 8) : 0, rowW = colW - barW;
      this.scroll[side] = clamp(this.scroll[side], 0, Math.max(0, list.length - rows));
      if (this.side === side && this.follow) { this.scroll[side] = clamp(this.scroll[side], Math.max(0, this.sel - rows + 1), Math.min(this.sel, Math.max(0, list.length - rows))); this.follow = false; }
      if (barW) this.scroll[side] = U.scrollbar(ctx, cx + colW - barW + 1, top, rows * rowH, this.scroll[side], rows, list.length, 'barter' + side, [cx, top, colW, rows * rowH]);
      if (!list.length) U.text(ctx, 'Nothing.', cx + 6, top + 4, { size: 8, color: U.colors.dim });
      list.slice(this.scroll[side], this.scroll[side] + rows).forEach((e, k) => {
        const i = this.scroll[side] + k, ry = top + k * rowH, it = G.item(e.id), n = map[e.id] || 0;
        const hover = U.inRect(m.ux, m.uy, cx, ry, rowW, rowH);
        if (hover && m.moved) { this.side = side; this.sel = i; }
        if (hover && m.pressed) { this.side = side; this.sel = i; this.pick(side, e, 1); }
        if (hover && m.rpressed) this.pick(side, e, -1);
        if (this.side === side && this.sel === i) { ctx.fillStyle = 'rgba(120,160,255,0.22)'; ctx.fillRect(cx, ry, rowW, rowH); }
        if (n) { ctx.fillStyle = side === 0 ? 'rgba(90,200,120,0.25)' : 'rgba(230,170,70,0.25)'; ctx.fillRect(cx, ry, rowW, rowH); }
        U.icon(ctx, it.icon, cx + 2, ry - 0.5, 1);
        const price = n ? `${n} · $${this.value(e.id) * n}` : `$${this.value(e.id)}`;
        let label = `${it.name}${e.qty > 1 ? ' x' + e.qty : ''}`;   // (a long name is cut, it never runs under the price)
        while (label.length > 4 && U.wrap(ctx, label, rowW - 58, 8).length > 1) label = label.slice(0, -2);
        U.text(ctx, label, cx + 20, ry + 3, { size: 8 });
        U.text(ctx, price, cx + rowW - 4, ry + 3, { size: 7, align: 'right', color: n ? '#ffe08a' : U.colors.dim });
      });
      // cash on the table
      const by = top + rows * rowH + 4, key = side === 0 ? 'cashTake' : 'cashGive', max = cash;
      U.text(ctx, side === 0 ? 'Their cash:' : 'Your cash:', cx, by + 3, { size: 7, color: U.colors.dim });
      U.text(ctx, `$${this[key]}`, cx + 70, by + 3, { size: 8, color: '#a8e0a0' });
      for (const [lbl, d, ox] of [['-10', -10, 96], ['+10', 10, 122], ['+50', 50, 148]]) {
        const b = U.button(ctx, cx + ox, by, 24, 13, lbl, { size: 7 });
        if (b.clicked) { this[key] = clamp(this[key] + d, 0, max); G.audio.play('select'); }
      }
    });
    // the offer and what they think of it
    const { get, lose } = this.offer(), v = this.verdict(), fy = y + H - 50;
    U.text(ctx, `You give: $${get}   ·   You get: $${lose}`, x + 10, fy, { size: 8 });
    U.text(ctx, `"${this.say}"`, x + 10, fy + 12, { size: 8, color: '#e8dcb0' });
    U.text(ctx, v.text, x + 10, fy + 24, { size: 7, color: v.ok ? '#8aea7a' : '#ff9a7a' });
    const ok = U.button(ctx, x + W - 150, y + H - 24, 70, 17, 'Trade', { selected: v.ok, size: 9 });
    const no = U.button(ctx, x + W - 76, y + H - 24, 66, 17, 'Done', { size: 9 });
    if (ok.clicked) this.deal();
    if (no.clicked) this.close();
  }
}
G.BarterScene = BarterScene;
G.trust.openTrade = (scene, npc) => G.scenes.push(new BarterScene(scene, npc));
G.trust.openManage = (scene, npc) => { if (G.CompanionTradeScene) G.scenes.push(new G.CompanionTradeScene(scene, npc)); };

// ---------------------------------------------------------------- asking (the written way: works with AI dialogue off too)
G.DIALOGUE_NODES._barter = (r) => {
  const why = G.trust.tradeRefusal(r.scene, r.npc);
  if (why) return { text: why, choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
  return { text: G.rng.pick(['Sure. Let us see what you have.', 'Depends what you have. Show me.', 'Alright, let us trade.']), choices: [{ text: '[Trade]', next: null, do: (c) => { G.trust.openTrade(c.scene, c.npc); } }, { text: 'Never mind.', next: 'start' }] };
};
G.DIALOGUE_NODES._manage = (r) => {
  if (!G.trust.manageAllowed(r.scene, r.npc)) return { text: G.rng.pick(['My things are my things.', 'I do not know you that well.', 'No. Hands off.']), choices: [{ text: 'Something else...', next: 'start' }, { text: 'Goodbye.', next: null }] };
  return { text: G.rng.pick(['Go ahead. Take what you need.', 'Sure, have a look.']), choices: [{ text: '[Look through their things]', next: null, do: (c) => { G.trust.openManage(c.scene, c.npc); } }, { text: 'Never mind.', next: 'start' }] };
};
G.DIALOGUE_CHOICES.push((runner) => {
  const { npc } = runner;
  if (npc.remote || npc.transient || npc.def.combat === 'guard' || npc.def.shop) return [];
  const out = [{ text: 'Want to trade?', next: '_barter' }];
  // (party members already have "I need to manage your items.")
  if (!npc.st.companion && (npc.st.partner || G.trust.of(runner.scene.world, npc.id).v >= 75)) out.push({ text: 'Can I go through your things?', next: '_manage' });
  return out;
});
})();
