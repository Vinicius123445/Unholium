'use strict';
// Relationships: how much someone likes you, as a "likeness" from -100 to 100, and what you know about them.
//   Tiers: Stranger (0), Acquaintance (10), Friend (20), Good Friend (30), Best Friend (50), Friends with
//   Benefits (70, only after you have slept together), Lovers (100, only as partners). Below zero: Cold
//   (-10), Rival (-20), Enemy (-35), Worst Enemy (-60), Mortal Enemy (-85).
//   Knowledge: you only know someone's hobby, worries, dream or where they are from once they have told
//   you. Conversation never brings up what you could not know; you have to ask first.
//   The meter shows at the top of every conversation and in LifeLog > Relationships.
(() => {
const TIERS = [
  [100, 'Lovers', '#ff6aa8'], [70, 'Friends with Benefits', '#ff9ac0'], [50, 'Best Friend', '#6ad070'], [30, 'Good Friend', '#8ad078'],
  [20, 'Friend', '#a8d088'], [10, 'Acquaintance', '#d0c8a8'], [-9, 'Stranger', '#c8c0b0'], [-19, 'Cold', '#e0b090'], [-34, 'Rival', '#f09a70'],
  [-59, 'Enemy', '#ff7a5a'], [-84, 'Worst Enemy', '#ff5040'], [-101, 'Mortal Enemy', '#d02020'],
];
G.rel = {
  TIERS,
  // the number shown: liking, raised by romance (lovers are 100, people you sleep with at least 70)
  value(st) {
    const d = st.disp || 0;
    if (st.partner) return 100;
    if (st.loveDay != null && d >= 0) return Math.max(70, Math.min(99, d + (st.romance || 0) / 2));
    return G.util.clamp(Math.round(d + (d > 0 ? (st.romance || 0) / 4 : 0)), -100, 69);
  },
  tier(st) {
    const v = this.value(st);
    if (v === 0 && !st.introduced && !(st.known && Object.keys(st.known).length)) return { v, name: 'Stranger', color: '#c8c0b0' };
    const t = TIERS.find(([min]) => v >= min) || TIERS[TIERS.length - 1];
    return { v, name: t[1], color: t[2] };
  },
  knows(st, k) { return !!(st && st.known && st.known[k]); },
  learn(st, k) {
    if (!st || !k || this.knows(st, k)) return;
    (st.known = st.known || {})[k] = G.world ? G.world.day : 1;
  },
  // what you have learned about them (for the LifeLog)
  facts(id) {
    const st = G.world.npcs[id], P = G.social.persona(id), out = [];
    if (this.knows(st, 'hobby')) out.push(`Into ${P.hobby}`);
    if (this.knows(st, 'worry')) out.push(`Worried about ${P.they.worry}`);
    if (this.knows(st, 'dream')) out.push(`Dreams of trying to ${P.they.dream}`);
    if (this.knows(st, 'origin')) out.push(`Originally: ${P.they.origin}`);
    if (st.addictKnown && st.addict) out.push(`Struggles with ${G.item(st.addict.drug).name.toLowerCase()}`);
    return out;
  },
  // a slim meter from -100 to 100, with the tier name above it
  drawBar(ctx, npc, x, y, w) {
    const st = npc.st, U = G.ui;
    if (!st || npc.def.combat === 'guard' && !st.introduced) return;
    const t = this.tier(st), mid = x + w / 2;
    U.text(ctx, t.name, x + w, y, { size: 8, align: 'right', color: t.color });
    const by = y + 11;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, by, w, 5);
    ctx.fillStyle = t.color;
    const len = (w / 2) * Math.abs(t.v) / 100;
    ctx.fillRect(t.v >= 0 ? mid : mid - len, by, len, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(mid - 0.5, by - 1, 1, 7);
    ctx.strokeStyle = 'rgba(216,180,104,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, by - 0.5, w - 1, 6);
    U.text(ctx, String(t.v), mid, by + 7, { size: 7, align: 'center', color: U.colors.dim });
  },
};
// the phone's relationship status uses the same tiers
G.phone.status = function (st) { const t = G.rel.tier(st); return [t.name, t.color]; };
})();
