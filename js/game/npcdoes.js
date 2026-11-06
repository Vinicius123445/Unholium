'use strict';
// Little things people do: nobody just stands there. Whenever someone is standing around (waiting at
// a spot of their schedule, hanging out, between errands), every so often they feel like doing something
// that fits who they are, where they are and how they feel:
//   smoke a cigarette, sip a coffee or a soda, drink a beer (at the bar, gangs, the homeless), eat a snack,
//   scroll on their phone, read the paper or a book, check their watch, stretch, yawn, tie a shoe,
//   sweep or wipe the counter (shopkeepers), do push-ups or jog on the spot (in a park), dance (bar,
//   club), feed the pigeons (retirees), count cash (dealers, gangs), play cards with a friend...
// What they eat and drink counts for their hunger and thirst; smokers light up more when stressed.
// Drawn as a small prop in the hand (or a pose), with a word now and then.
(() => {
const NP = G.NPC.prototype, _nu = NP.update, _nd = NP.draw;
const pick = (a) => G.rng.pick(a);

// what: weight(npc, ctx) -> chance weight; len seconds; prop to draw; does(npc) on finish; say lines
const DOES = {
  smoke:   { len: [14, 24], prop: 'cig', w: (n, c) => (c.smoker ? 3 : 0.15) * (1 + (n.st.fear || 0) / 50) * (c.inside ? 0.2 : 1), say: ['*exhales*', 'Needed that.', 'Filthy habit. Love it.'] },
  coffee:  { len: [10, 18], prop: 'cup', w: (n, c) => (c.h >= 6 && c.h < 12 ? 2.2 : 0.6) * (c.life === 'worker' || c.life === 'cop' || c.life === 'shopkeeper' ? 1.5 : 1), thirst: 15, say: ['Ahh. Coffee.', 'Too hot.', 'Okay. Now I am awake.'] },
  soda:    { len: [8, 14], prop: 'can', w: (n, c) => 0.6 + (n.st.thirst || 0) / 30 + (c.kid ? 1.5 : 0), thirst: 30, say: ['*sip*', 'Refreshing.'] },
  beer:    { len: [16, 28], prop: 'bottle', w: (n, c) => c.kid ? 0 : (c.bar ? 4 : 0) + (c.life === 'gang' || c.life === 'homeless' ? 1.2 : 0) + (c.h >= 18 || c.h < 2 ? 0.6 : 0), thirst: 20, say: ['Cheers.', '*burp*', 'One more and I go home. Probably.'] },
  snack:   { len: [8, 14], prop: 'food', w: (n, c) => 0.4 + (n.st.hunger || 0) / 25, hunger: 25, say: ['*munch*', 'Mm. Not bad.', 'I was starving.'] },
  phone:   { len: [10, 30], prop: 'phone', w: (n, c) => c.life === 'homeless' ? 0.2 : c.kid === 'teen' ? 4 : c.life === 'retiree' ? 0.4 : 2, say: ['Ha! Look at this.', 'Ugh, the news...', 'Who even texts anymore?', 'Hm.'] },
  paper:   { len: [14, 30], prop: 'paper', w: (n, c) => (c.life === 'retiree' ? 2.5 : 0.4) * (c.h < 12 ? 1.5 : 0.7) * (c.kid ? 0 : 1), say: ['Hmph. Taxes again.', 'Did you see this?', 'Nothing good in here.'] },
  book:    { len: [20, 40], prop: 'book', w: (n, c) => (/reading/.test(c.hobby) ? 3 : 0.4) * (c.seated || c.inside ? 2 : 0.6), say: ['Just one more chapter.', 'Shh. Good part.'] },
  watch:   { len: [2, 4], pose: 'watch', w: () => 0.8, say: ['Late again...', 'Where is everyone?'] },
  stretch: { len: [3, 5], pose: 'arms', w: () => 0.7, say: ['*stretches*', 'Oof, my back.'] },
  yawn:    { len: [2, 3], pose: 'arms', w: (n, c) => (c.h >= 21 || c.h < 7 ? 2 : 0.3), say: ['*yaaawn*'] },
  shoe:    { len: [3, 5], pose: 'crouch', w: () => 0.3, say: ['Stupid laces.'] },
  sweep:   { len: [15, 30], prop: 'broom', w: (n, c) => (c.life === 'shopkeeper' && c.work ? 3 : c.inside && c.home ? 0.5 : 0), say: ['Who tracks all this in?', 'Never ends.'] },
  wipe:    { len: [8, 15], prop: 'rag', w: (n, c) => (c.life === 'shopkeeper' && c.work ? 2.5 : c.bar && c.work ? 3 : 0), say: ['Spotless.', '*wipes*'] },
  pushups: { len: [8, 14], pose: 'crouch', w: (n, c) => (c.park && !c.kid && c.life !== 'retiree' ? 1.2 : 0) + (c.hobby === 'jogging' || c.hobby === 'basketball' ? 2 : 0), say: ['...eighteen... nineteen...', 'Feel the burn!'] },
  jog:     { len: [6, 12], pose: 'bounce', w: (n, c) => (c.park ? 0.8 : 0) + (c.hobby === 'jogging' ? 1.5 : 0), say: ['Keep the heart rate up!'] },
  dance:   { len: [8, 20], pose: 'bounce', w: (n, c) => (c.bar && c.h >= 20 ? 3 : 0) + (c.kid === 'teen' ? 0.4 : 0), say: ['This is my song!', 'Woo!'] },
  pigeons: { len: [12, 25], prop: 'bread', w: (n, c) => (c.life === 'retiree' && c.park ? 3 : 0), say: ['Here, birdies.', 'There you go.'] },
  cash:    { len: [6, 10], prop: 'cash', w: (n, c) => (c.life === 'dealer' || c.life === 'gang' ? 1.5 : 0), say: ['...a hundred, hundred twenty...', 'Short again.'] },
  cards:   { len: [20, 40], prop: 'cards', w: (n, c) => (c.friend && (c.life === 'retiree' || c.life === 'gang' || c.hobby === 'poker') ? 1.5 : 0) * (c.seated ? 2 : 0.5), say: ['Read them and weep.', 'You cheated!', 'Again.'] },
  guitar:  { len: [20, 40], prop: 'guitar', w: (n, c) => (/karaoke|vinyl/.test(c.hobby) ? 1.5 : 0) * (c.inside || c.park ? 1 : 0.3), say: ['*strums*', 'Wrote this one myself.'] },
};

function context(npc, scene) {
  const w = scene.world, map = scene.map, id = npc.id, def = npc.def, P = G.social.persona(id);
  const b = map.buildingAt(npc.x, npc.y - 3), e = (G.NPCS[id] && G.beds.entryNow(id, w)) || {};
  const life = G.lifestyle ? G.lifestyle.of(id) : 'worker';
  const name = b ? (b.name || '') : '';
  const lp = map.lifeSpots;
  const park = !b && !!(lp && lp.park && lp.park.some((s) => Math.abs(s.x * 16 - npc.x) < 160 && Math.abs(s.y * 16 - npc.y) < 160));
  return {
    h: w.hourF, life, kid: def.kid || null, hobby: P.hobby, inside: !!b, home: b && def.home === b.id, work: e.act === 'work',
    bar: /bar|club|tavern|casino/i.test(name), park, seated: !!npc.seated,
    smoker: npc.st.smoker != null ? npc.st.smoker : (npc.st.smoker = !def.kid && new G.RNG('smoker' + id).next() < (life === 'gang' || life === 'homeless' || life === 'dealer' ? 0.65 : 0.25)),
    friend: scene.actors.some((a) => a !== npc && a.kind === 'npc' && !a.dead && Math.abs(a.x - npc.x) < 24 && Math.abs(a.y - npc.y) < 24),
  };
}

G.npcDoes = {
  DOES,
  idle(npc, scene) {
    return npc.state === 'schedule' && !npc.moving && !npc.sleeping && !npc.talking && !npc.dead && !npc.vehicle && !npc.loveTask && !(npc.cower > 0) && !npc.st.companion && !npc.remote;
  },
  choose(npc, scene) {
    const c = context(npc, scene), opts = [];
    let tot = 0;
    for (const k in DOES) { const wgt = Math.max(0, DOES[k].w(npc, c) || 0); if (wgt > 0) { opts.push([k, wgt]); tot += wgt; } }
    if (!tot) return null;
    let r = Math.random() * tot;
    for (const [k, wgt] of opts) if ((r -= wgt) <= 0) return k;
    return opts[0][0];
  },
  start(npc, kind) {
    const d = DOES[kind];
    npc.doing = { kind, t: 0, len: d.len[0] + Math.random() * (d.len[1] - d.len[0]), said: false };
  },
  finish(npc) {
    const d = DOES[npc.doing.kind], st = npc.st;
    if (d.hunger) st.hunger = Math.max(0, (st.hunger || 0) - d.hunger);
    if (d.thirst) st.thirst = Math.max(0, (st.thirst || 0) - d.thirst);
    npc.doing = null;
    npc.doNext = 6 + Math.random() * 18;
  },
};

NP.update = function (dt, scene) {
  const r = _nu.call(this, dt, scene);
  if (this.dead) return r;
  if (!G.npcDoes.idle(this, scene) || Math.abs(this.x - scene.player.x) > 700) { if (this.doing && (this.moving || this.state !== 'schedule')) this.doing = null; return r; }
  if (this.doing) {
    const D = this.doing;
    D.t += dt;
    if (!D.said && D.t > D.len * 0.4 && Math.random() < 0.35 && this.distTo(scene.player) < 160) { D.said = true; this.say(pick(DOES[D.kind].say), 2.5); }
    else if (!D.said && D.t > D.len * 0.4) D.said = true;
    if (D.t >= D.len) G.npcDoes.finish(this);
  } else {
    this.doNext = (this.doNext == null ? 2 + Math.random() * 10 : this.doNext) - dt;
    if (this.doNext <= 0) { const k = G.npcDoes.choose(this, scene); if (k) G.npcDoes.start(this, k); else this.doNext = 10; }
  }
  return r;
};

// ---------------------------------------------------------------- drawing the props and poses
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
NP.draw = function (ctx) {
  const D = this.doing;
  if (!D || this.sleeping || this.dead || (this.loveTask && this.loveTask.phase === 'act')) return _nd.call(this, ctx);
  const d = DOES[D.kind], t = D.t, x = Math.round(this.x), y = Math.round(this.y);
  // poses move the whole body a little
  let oy = 0;
  if (d.pose === 'crouch') oy = 3 + (D.kind === 'pushups' ? Math.round(Math.abs(Math.sin(t * 4)) * 2) : 0);
  if (d.pose === 'bounce') oy = -Math.round(Math.abs(Math.sin(t * (D.kind === 'dance' ? 6 : 9))) * 2);
  if (oy) { ctx.save(); ctx.translate(0, oy); _nd.call(this, ctx); ctx.restore(); } else _nd.call(this, ctx);
  const back = this.dir === 3;   // facing away: the prop is hidden in front of them
  const side = this.dir === 1 ? -1 : 1;
  // hand height: lifted to the mouth for a moment every few seconds
  const toMouth = /cig|cup|can|bottle|food/.test(d.prop || '') && (t % 4) < 1.1;
  const mth = toMouth && G.smoking ? G.smoking.mouth(this) : null;   // the real mouth of an HD person
  const hx = mth ? mth.x : x + side * (this.dir === 0 || this.dir === 3 ? 4 : 3), hy = mth ? mth.y : y - (toMouth ? 13 : 9) + oy;
  if (back && d.prop !== 'broom' && d.prop !== 'guitar') return;
  switch (d.prop) {
    case 'cig': if (G.handprops) G.handprops.cig(ctx, hx, hy, side > 0 ? (toMouth ? 0.22 : -0.3) : Math.PI - (toMouth ? 0.22 : -0.3), ((t * 0.02) % 1), toMouth ? 1 : 0.55 + Math.sin(t * 5) * 0.12); else { R(ctx, hx, hy, 3, 1, '#f0ece4'); }   // a real cigarette (js/game/handprops.js)
      ctx.fillStyle = 'rgba(200,200,200,0.35)'; for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3) % 1); ctx.fillRect(hx + 1 + Math.sin(k * 6 + i) * 2, hy - 2 - k * 9, 1.5, 1.5); } break;
    case 'cup': R(ctx, hx - 1, hy - 1, 3, 3, '#f4f0e8'); R(ctx, hx - 1, hy - 1, 3, 1, '#6a4428'); if (!toMouth) { ctx.fillStyle = 'rgba(230,230,230,0.3)'; ctx.fillRect(hx, hy - 3 - (t * 4) % 3, 1, 1); } break;
    case 'can': R(ctx, hx - 1, hy - 1, 2, 3, '#c83030'); R(ctx, hx - 1, hy - 1, 2, 1, '#d8d8d8'); break;
    case 'bottle': R(ctx, hx - 1, hy - 2, 2, 4, '#2e6a32'); R(ctx, hx - 1, hy - 3, 1, 1, '#c8b060'); break;
    case 'food': R(ctx, hx - 2, hy - 1, 4, 2, '#d8a860'); R(ctx, hx - 2, hy, 4, 1, '#5a9a3a'); break;
    case 'phone': break;   // (it is in the real hand: js/game/extras.js)
    case 'paper': R(ctx, x - 5, y - 13 + oy, 10, 6, '#e4e0d4'); R(ctx, x - 4, y - 12 + oy, 4, 1, '#5a5a5a'); R(ctx, x + 1, y - 12 + oy, 3, 1, '#8a8a8a'); R(ctx, x - 4, y - 10 + oy, 8, 1, '#a0a0a0'); break;
    case 'book': R(ctx, x - 3, y - 11 + oy, 6, 4, ['#8a2a2a', '#2a4a8a', '#2a6a3a'][this.id.length % 3]); R(ctx, x, y - 11 + oy, 1, 4, '#e8e0d0'); break;
    case 'broom': { const a = Math.sin(t * 3) * 0.5; ctx.save(); ctx.translate(x + side * 5, y - 10); ctx.rotate(a); R(ctx, 0, 0, 1, 11, '#8a6a3a'); R(ctx, -2, 10, 5, 3, '#c8a858'); ctx.restore(); if (Math.random() < 0.05) { ctx.fillStyle = 'rgba(160,140,110,0.5)'; ctx.fillRect(x + side * 6 + Math.random() * 4, y + 1, 1, 1); } break; }
    case 'rag': R(ctx, hx - 2 + Math.round(Math.sin(t * 5) * 2), hy + 2, 4, 2, '#5a8ac8'); break;
    case 'bread': R(ctx, hx - 1, hy, 2, 2, '#d8b070'); if ((t % 2) < 0.3) { ctx.fillStyle = '#d8b070'; ctx.fillRect(hx + side * (4 + (t % 2) * 20), y - 2, 1, 1); } break;
    case 'cash': R(ctx, hx - 2, hy - 1, 4, 2, '#5a9a4a'); R(ctx, hx - 1, hy - 1, 2, 1, '#8ac878'); break;
    case 'cards': R(ctx, hx - 2, hy - 1, 2, 3, '#f0f0f0'); R(ctx, hx, hy - 1, 2, 3, '#f0f0f0'); R(ctx, hx - 1, hy, 1, 1, '#c82a2a'); break;
    case 'guitar': R(ctx, x - 6, y - 9 + oy, 8, 4, '#a0643a'); R(ctx, x - 4, y - 8 + oy, 2, 2, '#3a2010'); R(ctx, x + 2, y - 8 + oy, 5, 1, '#5a3a1a'); break;
  }
  if (d.pose === 'arms') { const sk = (this.look && this.look.skin) || '#d8a888'; R(ctx, x - 5, y - 18 + oy, 1, 4, sk); R(ctx, x + 4, y - 18 + oy, 1, 4, sk); }
  if (d.pose === 'watch') R(ctx, hx, y - 11, 2, 1, '#c8c8c8');
};

})();
