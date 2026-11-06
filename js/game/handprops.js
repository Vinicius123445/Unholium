'use strict';
// Things in the hand and at the mouth, done properly.
//   Cigarettes: a real cigarette at the HD mouth, thin and slightly drooping: tan cork filter, white paper
//   that burns down as you smoke, a grey ash tip, an ember that glows (and flares on a drag, lighting the
//   face a little). Joints are cone-rolled and crinkled at the end; cigars are thick and brown with a band.
//   Using things (you and everyone else): the hand travels smoothly from the side up to the mouth and back
//   instead of jumping. Food is bitten: it gets smaller as you eat (crumbs fall); bottles and cans tilt up
//   as you drink; pills are flicked into the mouth from the palm; a bandage is wound round the forearm.
(() => {
const SM = G.smoking;
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const LOOK = {
  cigarettes: { paper: '#f2efe8', filter: '#d89a4a', w: 0.62, len: 3.2 },
  joint: { paper: '#ede8d6', filter: '#ede8d6', w: 0.75, len: 3.4, cone: true },
  cigar: { paper: '#6a4024', filter: '#5a3420', w: 1.15, len: 3.6, band: '#c83a2a' },
};
if (SM) {
  const _draw = SM.draw;
  SM.draw = function (ctx, p) {
    const s = p.smoking, L = s && LOOK[s.id];
    if (!L || p.vehicle || p.dir === 3) return _draw.call(this, ctx, p);   // pipes (and from behind): as before
    const m = this.mouth(p), left = Math.max(0, 1 - s.t / s.len);
    const ang = [1.15, Math.PI - 0.22, 0.22][p.dir] + Math.sin(G.loop.time * 0.7) * 0.03;   // a slight droop, a tremble
    const len = 0.9 + (L.len - 0.9) * left, fl = L.cone ? 0.5 : 0.85;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(ang);
    // shadow under it on the chin
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0.2, L.w * 0.5, len, 0.35);
    // filter, paper (a cone for a joint), the ash and the ember
    ctx.fillStyle = L.filter; ctx.fillRect(0, -L.w / 2, fl, L.w);
    if (s.id === 'cigarettes') { ctx.fillStyle = 'rgba(120,70,20,0.45)'; ctx.fillRect(0.2, -L.w / 2, 0.15, L.w); ctx.fillRect(0.55, -L.w / 2 + 0.15, 0.15, 0.2); }
    const paperEnd = Math.max(fl, len - 0.35);
    if (L.cone) { ctx.fillStyle = L.paper; ctx.beginPath(); ctx.moveTo(fl, -L.w / 2 + 0.1); ctx.lineTo(paperEnd, -L.w / 2 - 0.15); ctx.lineTo(paperEnd, L.w / 2 + 0.15); ctx.lineTo(fl, L.w / 2 - 0.1); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = L.paper; ctx.fillRect(fl, -L.w / 2, paperEnd - fl, L.w); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(fl, -L.w / 2, paperEnd - fl, Math.max(0.15, L.w * 0.25));   // a highlight along the top
    if (L.band && paperEnd - fl > 0.8) { ctx.fillStyle = L.band; ctx.fillRect(fl + 0.3, -L.w / 2, 0.45, L.w); }
    ctx.fillStyle = '#8a8884'; ctx.fillRect(paperEnd, -L.w / 2 + 0.05, 0.3, L.w - 0.1);   // ash
    const glow = s.drag > 0 ? 1 : 0.55 + Math.sin(G.loop.time * 5) * 0.12;
    ctx.fillStyle = `rgba(255,${Math.round(90 + 80 * glow)},40,${glow.toFixed(2)})`; ctx.fillRect(paperEnd + 0.22, -L.w / 2 + 0.1, 0.25, L.w - 0.2);
    ctx.restore();
    if (s.drag > 0) {   // the flare lights the face a little
      const tx = m.x + Math.cos(ang) * len, ty = m.y + Math.sin(ang) * len, g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 4);
      g.addColorStop(0, 'rgba(255,150,60,0.45)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(tx - 4, ty - 4, 8, 8);
    }
    for (const w of s.wisps) { ctx.fillStyle = `rgba(210,210,215,${Math.max(0, w.a)})`; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); }
  };
}
// ---------------------------------------------------------------- using things
const AP = G.Actor.prototype, _ad = AP.draw;
AP.draw = function (ctx) {
  const u = this.useAnim;
  if (!u || this.dead) return _ad.call(this, ctx);
  // draw the body in the hand-to-mouth pose without the old prop, then the prop on a smooth path
  const k = 1 - u.t / u.len, saved = u.prop; u.prop = '_none';
  try { _ad.call(this, ctx); } finally { u.prop = saved; }
  if (this.dir === 3) return;
  const m = G.smoking ? G.smoking.mouth(this) : { x: this.x, y: this.y - 14 };
  const side = { x: this.x + (this.dir === 1 ? -3 : this.dir === 2 ? 3 : 3.5), y: this.y - 9 };
  // raise (0-25%), at the mouth (25-80%), lower (80-100%)
  const up = k < 0.25 ? easeIO(k / 0.25) : k < 0.8 ? 1 : 1 - easeIO((k - 0.8) / 0.2), hold = k >= 0.25 && k < 0.8 ? (k - 0.25) / 0.55 : k >= 0.8 ? 1 : 0;
  const hx = side.x + (m.x + (this.dir === 1 ? -1 : 1) - side.x) * up, hy = side.y + (m.y + 1.2 - side.y) * up + (hold > 0 && hold < 1 ? Math.sin(hold * Math.PI * 6) * 0.25 : 0);
  const skin = (this.look && this.look.skin) || '#e0b088';
  if (u.prop === 'drink') {
    const tilt = (this.dir === 1 ? -1 : 1) * (0.2 + up * (0.4 + hold * 0.7));
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-tilt);
    ctx.fillStyle = u.color || '#3a7a4a'; ctx.fillRect(-0.7, -2.6, 1.4, 3.2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-0.6, -2.4, 0.35, 2.8);
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(-0.5, -3.1, 1, 0.5); ctx.restore();
  } else if (u.prop === 'pill') {
    if (hold < 0.35) { ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.ellipse(hx + (this.dir === 1 ? -0.5 : 0.5), hy - 0.6 - (up > 0.9 ? hold * 2 : 0), 0.45, 0.28, 0.4, 0, Math.PI * 2); ctx.fill(); }
  } else if (u.prop === 'bandage') {
    const ax = this.x + (this.dir === 1 ? 2 : -2), ay = this.y - 10, n = Math.floor(k * 6);
    ctx.fillStyle = '#efe9de'; for (let i = 0; i < n; i++) ctx.fillRect(ax - 1.2, ay + i * 0.6, 2.4, 0.45);
    ctx.fillStyle = '#d8d0c4'; ctx.fillRect(hx - 0.6, hy - 0.4, 1.2, 0.9);
  } else if (u.prop !== '_none') {   // food: bitten smaller while at the mouth
    const bite = 1 - hold * 0.75, w = 2.2 * bite;
    if (w > 0.3) { ctx.fillStyle = u.color || '#d8a860'; ctx.beginPath(); ctx.ellipse(hx, hy - 0.2, w / 2, 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(90,154,58,0.9)'; ctx.fillRect(hx - w / 2, hy - 0.05, w, 0.3); }
    if (hold > 0 && hold < 1 && Math.random() < 0.1) { ctx.fillStyle = 'rgba(216,168,96,0.85)'; ctx.fillRect(hx + (Math.random() - 0.5) * 2, hy + 1 + Math.random() * 2, 0.5, 0.5); }   // crumbs
  }
  if (u.prop !== 'bandage') { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx, hy + 0.4, 0.75, 0.65, 0, 0, Math.PI * 2); ctx.fill(); }   // the fingers round it
};
})();
// the same cigarette, for anyone (NPCs smoking on a break: js/game/npcdoes.js)
G.handprops = {
  cig(ctx, x, y, ang, burn = 0.5, glow = 0.6) {
    const w = 0.62, len = 1 + 2.2 * (1 - burn), fl = 0.85;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#d89a4a'; ctx.fillRect(0, -w / 2, fl, w);
    ctx.fillStyle = '#f2efe8'; ctx.fillRect(fl, -w / 2, Math.max(0, len - fl - 0.3), w);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(fl, -w / 2, Math.max(0, len - fl - 0.3), 0.18);
    ctx.fillStyle = '#8a8884'; ctx.fillRect(len - 0.3, -w / 2 + 0.05, 0.3, w - 0.1);
    ctx.fillStyle = `rgba(255,${Math.round(90 + 80 * glow)},40,${glow.toFixed(2)})`; ctx.fillRect(len - 0.08, -w / 2 + 0.1, 0.25, w - 0.2);
    ctx.restore();
  },
};
