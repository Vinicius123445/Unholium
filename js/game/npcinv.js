'use strict';
// The things people carry are real. st.inv is all an NPC has: what they eat, drink, smoke, hand over or shoot comes out of it and
// is gone; what they want and do not have, they go and get. They look over what lies around, weigh it against what they need and
// who they are, walk over, bend down and take it. Pockets have a limit.
// Talking to them: the model (Llama through js/game/aidialogue.js) reads what the player means and decides yes or no; its answer
// carries actions (pick_up, take_from, drop, use_item, equip, unequip, give). Nothing it says happens by itself: each action comes
// here, is checked against the world, and is done by the body in the world. If it cannot be done, the words are replaced by the
// reason, so nobody claims what did not happen.
(() => {
const NP = G.NPC.prototype, A = G.ai, CAP = 16, REACH = 170;
const pick = (a) => G.rng.pick(a);
const pc = (st) => st.inv || (st.inv = []);
const FOOD = (it) => it.type === 'consumable' && (it.hunger > 0 || it.food || /sandwich|bread|chips|candy|apple|burger|pizza|beans|snack|meat|soup|taco|donut|fruit/i.test(it.icon + ' ' + it.name));
const DRINK = (it) => it.type === 'consumable' && !it.alcohol && (it.thirst > 0 || /water|soda|milk|juice|coffee/i.test(it.icon + ' ' + it.name));
const MED = (it) => it.heal >= 8 && !it.alcohol && /aid|bandage|medkit|painkiller|ibuprofen/i.test(it.icon + ' ' + it.name);
const lawful = (npc) => npc.def.combat === 'guard' || npc.def.faction === 'government';
const looter = (npc) => { const l = G.lifestyle ? G.lifestyle.of(npc.id) : ''; return l === 'gang' || l === 'homeless' || l === 'dealer' || npc.def.faction === 'outlaw' || !!npc.st.companion; };
const say = (npc, line, t = 3) => { if (npc.say) npc.say(line, t); };
const note = (npc, scene, t) => { if (G.mem) G.mem.add(scene.world, npc.id, { k: 'item', t, by: 'self', s: 'did', f: 0, i: 2 }); };

const I = G.npcInv = {
  CAP,
  count(st, id) { return pc(st).reduce((n, e) => n + (e[0] === id ? e[1] : 0), 0); },
  stacks(st) { return pc(st).filter((e) => e[1] > 0).length; },
  room(st, id) { return pc(st).some((e) => e[0] === id && e[1] > 0) || this.stacks(st) < CAP; },
  // into their pockets, if there is room; how many went in
  add(st, id, n = 1) {
    if (!G.ITEMS[id] || !this.room(st, id)) return 0;
    const e = pc(st).find((x) => x[0] === id); if (e) e[1] += n; else st.inv.push([id, n]);
    return n;
  },
  remove(st, id, n = 1) {
    let left = n;
    for (const e of pc(st)) { if (e[0] !== id || left <= 0) continue; const k = Math.min(e[1], left); e[1] -= k; left -= k; }
    st.inv = st.inv.filter((e) => e[1] > 0);
    if (st.equip) for (const s in st.equip) if (st.equip[s] === id && !this.count(st, id)) st.equip[s] = null;
    return n - left;
  },
  // what something is worth to this person, right now; below 4 they leave it there
  worth(npc, id) {
    const it = G.ITEMS[id], st = npc.st; if (!it || it.type === 'quest') return 0;
    const P = G.social.persona(npc.id), greed = /greedy|sly/.test(P.trait || '') ? 2 : 0, kid = !!npc.def.kid;
    if (it.illegal && lawful(npc)) return 0;
    if (kid && (it.type === 'weapon' || it.type === 'ammo' || it.illegal || it.alcohol)) return 0;
    if (it.type === 'weapon') { const w = npc.weaponItem; return !w ? 8 + greed : (it.dmg || 0) > (w.dmg || 0) * 1.25 ? 6 : 1; }
    if (it.type === 'ammo') { const w = npc.weaponItem; return w && w.ammo === id ? (this.count(st, id) < (w.mag || 8) * 2 ? 9 : 2) : 1 + greed; }
    if (MED(it)) return (npc.hp < npc.maxHp * 0.7 ? 8 : 3) + greed;
    if (FOOD(it)) return ((st.hunger || 0) >= 60 ? 11 : (st.hunger || 0) >= 40 ? 7 : this.supply(st, FOOD) < 1 ? 4 : 1) + greed;
    if (DRINK(it)) return ((st.thirst || 0) >= 60 ? 11 : (st.thirst || 0) >= 40 ? 7 : this.supply(st, DRINK) < 1 ? 4 : 1) + greed;
    return ((it.value || 0) >= 40 ? 5 : (it.value || 0) >= 15 ? 3 : 1) + greed;
  },
  supply(st, kind) { return pc(st).reduce((n, e) => n + (G.ITEMS[e[0]] && kind(G.ITEMS[e[0]]) ? e[1] : 0), 0); },
  // what lies within reach that they may take: on the ground, on the dead, in their own chest
  open(npc, c) {
    if (c.carried || c.destroyed) return false;
    if (c.kind === 'bag') return true;
    if (c.kind === 'corpse') return looter(npc);
    return c.kind === 'chest' && c.owner === npc.id;
  },
  near(npc, scene, R = REACH) { return (scene.containers || []).filter((c) => Math.hypot(c.x - npc.x, c.y - npc.y) < R); },
  look(npc, scene) {
    let best = null;
    for (const c of this.near(npc, scene)) {
      if (!this.open(npc, c)) continue;
      for (const e of c.items || []) {
        if (!(e[1] > 0) || !this.room(npc.st, e[0])) continue;
        const v = this.worth(npc, e[0]) - Math.hypot(c.x - npc.x, c.y - npc.y) / 120;
        if (v >= 4 && (!best || v > best.v)) best = { c, id: e[0], v };
      }
    }
    return best;
  },
  // ---------------------------------------------------------------- what the model is told: always what is really there
  pockets(npc) {
    const st = npc.st, eq = st.equip || {}, list = pc(st).filter((x) => x[1] > 0 && G.ITEMS[x[0]]);
    if (!list.length) return 'nothing at all';
    return `${list.map((x) => `${G.item(x[0]).name}${x[1] > 1 ? ' x' + x[1] : ''} (id ${x[0]})${Object.values(eq).includes(x[0]) ? ' [equipped]' : ''}`).join(', ')}. Room for ${Math.max(0, CAP - this.stacks(st))} more kinds of thing.`;
  },
  reach(npc, scene) {
    const out = [];
    for (const c of this.near(npc, scene, 220)) {
      if (c.kind === 'chest' && c.owner !== npc.id) continue;
      const items = (c.items || []).filter((e) => e[1] > 0 && G.ITEMS[e[0]]).slice(0, 6); if (!items.length) continue;
      const where = c.kind === 'bag' ? 'on the ground' : c.kind === 'corpse' ? `on the body of ${c.name}` : 'in your chest';
      out.push(`${where}, ${Math.round(Math.hypot(c.x - npc.x, c.y - npc.y) / 20)} m away: ${items.map((e) => `${G.item(e[0]).name} (id ${e[0]})`).join(', ')}`);
    }
    return out.join(' | ') || 'nothing lying around';
  },
  // ---------------------------------------------------------------- the player's words to an item, or a thing to the id in it
  match(text, ids) {
    const t = String(text || '').toLowerCase(); let best = null;
    for (const id of ids) {
      const name = (G.ITEMS[id] ? G.ITEMS[id].name : id).toLowerCase(), pt = (G.i18n.t(G.ITEMS[id] ? G.ITEMS[id].name : id) || '').toLowerCase();
      if (id.toLowerCase() === t || name === t || pt === t) return id;
      const hit = t.includes(name) ? name.length : t.includes(pt) ? pt.length : name.split(/\s+/).filter((w) => w.length > 2 && t.includes(w)).join('').length;
      if (hit && (!best || hit > best.n)) best = { id, n: hit };
    }
    return best ? best.id : null;
  },
  source(npc, scene, want) {   // where that thing is, of what they may reach
    const all = [];
    for (const c of this.near(npc, scene, 240)) if (this.open(npc, c)) for (const e of c.items || []) if (e[1] > 0 && G.ITEMS[e[0]]) all.push([c, e[0]]);
    const id = this.match(want, [...new Set(all.map((q) => q[1]))]); if (!id) return null;
    const list = all.filter((q) => q[1] === id).sort((a, b) => Math.hypot(a[0].x - npc.x, a[0].y - npc.y) - Math.hypot(b[0].x - npc.x, b[0].y - npc.y));
    return { c: list[0][0], id };
  },
  // ---------------------------------------------------------------- one request, checked and started. { ok, line } where line says why not
  request(npc, scene, verb, want, opt = {}) {
    const st = npc.st, p = scene.player, no = (line) => ({ ok: false, line });
    if (npc.dead || (st && st.ko)) return no('');
    if (npc.remote) return no('I am on the phone. I cannot do that from here.');
    const mine = () => this.match(want, pc(st).filter((e) => e[1] > 0).map((e) => e[0]));
    if (verb === 'pick_up' || verb === 'take_from') {
      const s = this.source(npc, scene, want);
      if (!s) return no(pick(['I do not see that around here.', 'What are you talking about? There is nothing like that here.']));
      if (G.item(s.id).type === 'quest') return no('That is not mine to touch.');
      if (!this.room(st, s.id)) return no('I cannot carry any more. My hands are full.');
      this.start(npc, { kind: 'fetch', c: s.c.id, id: s.id, back: !!opt.bring, forPlayer: true });
      return { ok: true };
    }
    const id = mine();
    if (verb === 'give') {
      if (!id) return no(pick([`I do not have that.`, 'I have nothing like that on me.']));
      if (G.item(id).gun && (st.disp || 0) < 40) return no('I am not handing you my gun.');
      if (!p.inventory.canFit(id)) return no('Your hands are full. You could not take it.');
      if (Math.hypot(npc.x - p.x, npc.y - p.y) < 48) {   // right there, across the conversation: it changes hands as they say it
        this.remove(st, id, 1); p.inventory.add(id, 1); G.audio.play('select'); scene.toast(`${npc.displayName} gave you ${G.item(id).name}.`, 'good'); note(npc, scene, `I gave the player ${G.item(id).name}`);
        return { ok: true };
      }
      this.start(npc, { kind: 'hand', id, forPlayer: true });
      return { ok: true };
    }
    if (!id) return no(pick(['I do not have that.', 'I do not have one of those on me.']));
    const it = G.item(id);
    if (verb === 'drop') { this.start(npc, { kind: 'drop', id, forPlayer: true }); return { ok: true }; }
    if (verb === 'use_item') {
      if (it.type !== 'consumable' && !it.heal) return no('That is not something you use like that.');
      this.start(npc, { kind: 'use', id, forPlayer: true }); return { ok: true };
    }
    if (verb === 'equip') {
      const slot = it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor' : it.type === 'clothing' ? it.slot : null;
      if (!slot) return no('That is not something I can put on.');
      this.start(npc, { kind: 'equip', id, slot, forPlayer: true }); return { ok: true };
    }
    if (verb === 'unequip') {
      const slot = Object.keys(st.equip || {}).find((s) => st.equip[s] === id);
      if (!slot) return no('I am not using that.');
      this.start(npc, { kind: 'equip', id: null, slot, forPlayer: true }); return { ok: true };
    }
    return no('');
  },
  start(npc, job) { npc.itemJob = Object.assign(job, { t: 0, phase: 'go', map: npc.st.map || npc.def.map }); npc.doing = null; npc.path = null; },
  stop(npc, line) { npc.itemJob = null; npc.itemPose = null; npc.itemHeld = null; npc.moving = false; if (line) say(npc, line); },
  // ---------------------------------------------------------------- doing it
  tick(npc, dt, scene) {
    const J = npc.itemJob, st = npc.st, p = scene.player, w = scene.world;
    if (npc.dead || st.ko || npc.state === 'fight' || npc.state === 'flee') return this.stop(npc), false;
    J.t += dt;
    const walk = (x, y, r) => {
      if (Math.hypot(npc.x - x, npc.y - (y + 4)) < r) { npc.moving = false; return true; }
      if ((J.walked = (J.walked || 0) + dt) > 25) { this.stop(npc, J.forPlayer ? pick(['I cannot get there.', 'There is no way through.']) : null); return false; }
      npc.walkTo({ x: Math.floor(x / 16), y: Math.floor(y / 16) }, dt, scene, !!J.forPlayer);
      npc.baseUpdate(dt, scene.map);
      return false;
    };
    const bend = (s, fn) => { J.bent = (J.bent || 0) + dt; npc.itemPose = 'bend'; npc.moving = false; if (J.bent >= s) { J.bent = 0; npc.itemPose = null; fn(); } };
    if (J.kind === 'fetch') {
      const c = w.containers[J.c], e = c && (c.items || []).find((x) => x[0] === J.id && x[1] > 0);
      if (J.phase === 'go') {
        if (!c || !e) { this.stop(npc, J.forPlayer ? 'It is gone. Somebody took it.' : null); return true; }
        if (!walk(c.x, c.y, 16)) return true;
        bend(0.7, () => {
          if (!this.add(st, e[0], 1)) { this.stop(npc, J.forPlayer ? 'I have no room for it.' : null); return; }
          e[1]--; npc.itemHeld = e[0]; c.items = c.items.filter((x) => x[1] > 0);
          if (c.kind === 'bag' && G.containers.isEmpty(c)) delete w.containers[c.id];
          scene.refreshContainers(); G.audio.play('select', { x: npc.x, y: npc.y });
          if (J.forPlayer) note(npc, scene, `The player asked me to pick up ${G.item(J.id).name}, and I did`);
          if (J.back) { J.kind = 'hand'; J.phase = 'go'; J.walked = 0; } else { this.stop(npc, J.forPlayer ? pick(['Got it.', `There. I have the ${G.item(J.id).name.toLowerCase()}.`]) : null); }
        });
      }
      return true;
    }
    if (J.kind === 'hand') {
      if (!this.count(st, J.id)) { this.stop(npc); return true; }
      if (!walk(p.x, p.y, 26)) return true;
      npc.faceTowards && npc.faceTowards(p); npc.itemHeld = J.id;
      if ((J.give = (J.give || 0) + dt) < 0.5) return true;
      if (!p.inventory.canFit(J.id)) { this.stop(npc, 'You have no room for it.'); return true; }
      this.remove(st, J.id, 1); p.inventory.add(J.id, 1); G.audio.play('select');
      scene.toast(`${npc.displayName} gave you ${G.item(J.id).name}.`, 'good'); note(npc, scene, `I gave the player ${G.item(J.id).name}`);
      this.stop(npc, 'Here.');
      return true;
    }
    if (J.kind === 'drop') {
      bend(0.6, () => {
        if (!this.remove(st, J.id, 1)) { this.stop(npc); return; }
        const near = (scene.containers || []).find((c) => c.kind === 'bag' && Math.hypot(c.x - npc.x, c.y - npc.y) < 16);
        if (near) { const e = near.items.find((x) => x[0] === J.id); if (e) e[1]++; else near.items.push([J.id, 1]); } else G.containers.createBag(w, scene.map.id, npc.x, npc.y + 4, [[J.id, 1]]);
        scene.refreshContainers(); if (J.forPlayer) note(npc, scene, `The player asked me to drop ${G.item(J.id).name}, and I did`);
        this.stop(npc, J.forPlayer ? 'There.' : null);
      });
      return true;
    }
    if (J.kind === 'use') {
      npc.itemHeld = J.id; npc.itemPose = 'mouth'; npc.moving = false;
      if (J.t >= 1.4) { this.consume(npc, J.id); if (J.forPlayer) note(npc, scene, `I used ${G.item(J.id).name}`); this.stop(npc); }
      return true;
    }
    if (J.kind === 'equip') {
      if (J.t >= 0.5) {
        st.equip = st.equip || {}; st.equip[J.slot] = J.id;
        if (G.companionItems) { npc.eqKey = null; G.companionItems.applyLook(npc); }
        this.stop(npc, J.forPlayer ? 'There.' : null);
      }
      return true;
    }
    this.stop(npc);
    return true;
  },
  consume(npc, id) {
    const st = npc.st, it = G.item(id);
    if (!this.remove(st, id, 1)) return false;
    if (it.heal) { npc.hp = Math.min(npc.maxHp, npc.hp + it.heal); st.hp = npc.hp; }
    if (FOOD(it)) st.hunger = Math.max(0, (st.hunger || 0) - 50);
    if (DRINK(it)) st.thirst = Math.max(0, (st.thirst || 0) - 50);
    if (it.drug && G.npcFx) { const D = G.npcFx.st(npc).drugs; D.load[it.drug.cls] = (D.load[it.drug.cls] || 0) + (it.drug.load || 0); }
    return true;
  },
  // ---------------------------------------------------------------- on their own: needs first, then whatever is worth having
  think(npc, scene) {
    const st = npc.st;
    if (st.companion && st.compWait) return;
    if ((st.hunger || 0) >= 60 || (st.thirst || 0) >= 60) {
      const kind = (st.thirst || 0) >= (st.hunger || 0) ? DRINK : FOOD, own = pc(st).find((e) => e[1] > 0 && G.ITEMS[e[0]] && kind(G.ITEMS[e[0]]));
      if (own) { this.start(npc, { kind: 'use', id: own[0] }); return; }
    }
    const best = this.look(npc, scene);
    if (best) this.start(npc, { kind: 'fetch', c: best.c.id, id: best.id });
  },
};

const free = I.free = (npc) => npc.state === 'schedule' && !npc.talking && !npc.sleeping && !npc.seated && !npc.seek && !npc.task && !npc.needTask && !npc.loveTask && !npc.followTask && !(npc.st && npc.st.ko) && !(npc.def && npc.def.transient) && !npc.remote;
const _nu = NP.update;
NP.update = function (dt, scene) {
  if (this.itemJob) {
    if (this.talking && this.itemJob.forPlayer !== true) { this.itemJob = null; this.itemPose = null; } else if (!this.talking && I.tick(this, dt, scene)) return undefined;
  } else if (!this.dead && scene.containers && (this.itemThink = (this.itemThink == null ? 2 + Math.random() * 6 : this.itemThink) - dt) <= 0) {
    this.itemThink = 4 + Math.random() * 5;
    const e = this.currentEntry && this.currentEntry(scene.world);
    if (free(this) && !(e && e.act === 'work' && (this.st.hunger || 0) < 90)) I.think(this, scene);
  }
  return _nu.call(this, dt, scene);
};
// what is in their hand as they carry it
const _draw = NP.draw;
NP.draw = function (ctx) {
  const r = _draw.call(this, ctx);
  if (this.itemHeld && !this.sleeping && !this.dead && G.hd.handOf) {
    const h = G.hd.handOf(this); if (h) { const it = G.ITEMS[this.itemHeld]; if (it) { const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(G.assets.icon(it.icon), h.x - 3.5, h.y - 3.5, 7, 7); ctx.imageSmoothingEnabled = s; } }
  }
  return r;
};
// ---------------------------------------------------------------- nothing out of thin air: what they do with their hands needs the thing
const D = G.npcDoes && G.npcDoes.DOES;
if (D) {
  const NEEDS = { smoke: ['cigarettes'], coffee: ['coffee'], soda: ['soda'], beer: ['beer'], snack: null, pigeons: ['bread'] };
  for (const k in NEEDS) {
    if (!D[k]) continue;
    const w0 = D[k].w, ids = NEEDS[k];
    D[k].w = (n, c) => {
      const has = ids ? ids.some((id) => I.count(n.st, id) > 0) : I.supply(n.st, FOOD) > 0;
      return has || (c.bar && c.work) ? w0(n, c) : 0;
    };
  }
  const _finish = G.npcDoes.finish;
  G.npcDoes.finish = function (npc) {
    const k = npc.doing && npc.doing.kind, ids = k && NEEDS[k], st = npc.st;
    if (k === 'snack') { const e = pc(st).find((x) => x[1] > 0 && G.ITEMS[x[0]] && FOOD(G.ITEMS[x[0]])); if (e) I.remove(st, e[0], 1); }
    else if (ids) { const id = ids.find((q) => I.count(st, q) > 0); if (id) I.remove(st, id, 1); }
    return _finish.call(this, npc);
  };
}
// habits have to be bought too: smokers get cigarettes, drinkers beer, on the shopping run that already costs them money
if (G.behavior && G.behavior.stockUp) {
  const _stock = G.behavior.stockUp;
  G.behavior.stockUp = function (w) {
    _stock.call(this, w);
    for (const id in w.npcs) {
      const st = w.npcs[id], d = G.NPCS[id]; if (!d || !st.alive || d.transient || d.kid || st.jailedUntil > w.day) continue;
      for (const [item, want] of [['cigarettes', /smoker/], ['beer', /drink|gang/], ['coffee', /worker|cop|shopkeeper/]]) {
        const life = (G.lifestyle ? G.lifestyle.of(id) : '') + (st.smoker ? ' smoker' : '');
        if (!want.test(life) || I.count(st, item) >= 2 || (st.gold || 0) < 12 || Math.random() < 0.5) continue;
        st.gold -= Math.max(1, Math.round((G.item(item).value || 3) * 1.2)); I.add(st, item, 1);
      }
      // no weapon, in a life that wants one: a knife or a bat from someone who sells them
      if ((d.faction === 'outlaw' || /gang|dealer/.test(G.lifestyle ? G.lifestyle.of(id) : '')) && !pc(st).some((e) => G.ITEMS[e[0]] && G.ITEMS[e[0]].type === 'weapon') && (st.gold || 0) >= 60 && Math.random() < 0.3) {
        const it = pick(['pocket_knife', 'bat'].filter((x) => G.ITEMS[x])); if (it) { st.gold -= G.item(it).value || 40; I.add(st, it, 1); }
      }
    }
  };
}
// ---------------------------------------------------------------- a hungry person with food in their pocket eats that, wherever they are
if (G.needs && G.needs.plan) {
  const _plan = G.needs.plan;
  G.needs.plan = function (npc, scene) {
    const st = npc.st, kinds = [[st.thirst, DRINK], [st.hunger, FOOD]];
    for (const [v, kind] of kinds) { if (!(v >= 60)) continue; const e = pc(st).find((x) => x[1] > 0 && G.ITEMS[x[0]] && kind(G.ITEMS[x[0]])); if (e) { I.start(npc, { kind: 'use', id: e[0] }); return null; } }
    return _plan.apply(this, arguments);
  };
}
// ---------------------------------------------------------------- the model's actions
if (A) {
  for (const a of ['pick_up', 'take_from', 'drop', 'use_item', 'equip', 'unequip', 'option']) if (!A.ACTIONS.includes(a)) A.ACTIONS.push(a);
  const PHYS = /^(pick_up|take_from|drop|use_item|equip|unequip)$/;
  const _apply = A.apply;
  A.apply = function (r, actions, free2, attitude) {
    const sc = r.scene, npc = r.npc, phys = (actions || []).filter((a) => PHYS.test(a.type) || (a.type === 'give' && a.item)), rest = (actions || []).filter((a) => !phys.includes(a));
    const out = _apply.call(this, r, rest.filter((a) => a.type !== 'option'), free2, attitude);
    if (!free2) return out;
    { const o = rest.find((a) => a.type === 'option'); if (o) out.option = o.text || o.item || ''; }
    for (const a of phys.slice(0, 1)) {   // (one thing at a time: a body has two hands)
      const q = I.request(npc, sc, a.type, a.item || a.target || '', { bring: a.type === 'pick_up' && !!a.count });
      if (q.ok) out.done.push(a.type); else if (q.line && !a.soft) out.sayInstead = q.line;
    }
    return out;
  };
  // words without the action. They agreed, in words, to something a body has to do: the request is carried out if it can be;
  // and a claim of something already done that was not is taken back.
  const ASK = [['pick_up', /\b(pick up|pick that up|grab|get|fetch|bring|take)\b/i], ['give', /\b(give me|hand me|pass me|can i have|let me have|lend me)\b/i], ['drop', /\b(drop|put down|throw away|get rid of)\b/i], ['equip', /\b(put on|wear|equip|hold|use your|take out your|draw your)\b/i], ['use_item', /\b(eat|drink|smoke|take (a|your)|use)\b/i]];
  const CLAIM = /\b(i (just )?(picked|grabbed|took|got|dropped|put on|equipped|ate|drank|gave)|here(,| you go| it is)|there you go|got it)\b/i, YES = /^\s*(sure|ok|okay|fine|alright|all right|yes|yeah|you got it|on it|of course|will do|right away|no problem|here)\b/i, NO = /\b(no|not|won'?t|can'?t|never|don'?t|cannot)\b/i;
  const _promised = A.promised;
  A.promised = function (r, line, acts) {
    const out = _promised.apply(this, arguments), said = G.i18n.toEnglish(((r.aiLog || []).filter((m) => m.who === 'player').slice(-1)[0] || {}).text || ''), heard = G.i18n.toEnglish(line || '');
    if (acts.concat(out).some((a) => PHYS.test(a.type) || a.type === 'give') || r.npc.remote) return out;
    const agreed = YES.test(heard) || (CLAIM.test(heard) && !NO.test(heard));
    if (!agreed) return out;
    for (const [type, re] of ASK) { if (re.test(said)) { out.push({ type, item: said, soft: !CLAIM.test(heard) }); break; } }
    return out;
  };
  // the rule, for the model
  A.RULES_ITEMS = `\n- Things are real. "In your pockets" and "What your hands can reach" are everything there is: never claim to have, take, use or give anything else. To do something with an item you MUST include the action, with the item's id: {"type":"pick_up","item":"beer"} (walk over and take it from the ground; add "count":1 to bring it to the player), {"type":"take_from","item":"id"} (from a body or your chest), {"type":"give","item":"id"} (hand it to the player), {"type":"drop","item":"id"}, {"type":"use_item","item":"id"} (eat, drink, take it), {"type":"equip","item":"id"}, {"type":"unequip","item":"id"}. You decide whether you are willing, as the person you are; you may refuse, bargain or ask why. If you agree, say you will do it (not that you did it): the game does it after you speak. If you do not have it or cannot reach it, say so.\n- "What the player can ask of you here" lists what can really happen in this conversation. When the player asks for one of those in their own words (your name, your number, a trade, looking through your things, work...) and you agree, add {"type":"option","text":"<that entry, exactly>"}. The game then does it. If you do not want to, just say no and leave the action out.`;
}
// (what they say about things)
Object.assign(G.LANG_PT.s, {
  'I do not see that around here.': 'Não estou vendo isso por aqui.', 'What are you talking about? There is nothing like that here.': 'Do que você está falando? Não tem nada disso aqui.',
  'That is not mine to touch.': 'Isso não é meu para mexer.', 'I cannot carry any more. My hands are full.': 'Não consigo carregar mais nada. Estou com as mãos cheias.',
  'I do not have that.': 'Não tenho isso.', 'I have nothing like that on me.': 'Não tenho nada disso comigo.', 'I am not handing you my gun.': 'Não vou te dar a minha arma.',
  'Your hands are full. You could not take it.': 'Você está com as mãos cheias. Não conseguiria pegar.', 'I do not have one of those on me.': 'Não tenho nenhum desses comigo.',
  'That is not something you use like that.': 'Isso não se usa assim.', 'That is not something I can put on.': 'Isso não é algo que eu possa colocar.', 'I am not using that.': 'Não estou usando isso.',
  'I am on the phone. I cannot do that from here.': 'Estou no telefone. Não consigo fazer isso daqui.', 'I cannot get there.': 'Não consigo chegar lá.', 'There is no way through.': 'Não tem como passar.',
  'It is gone. Somebody took it.': 'Sumiu. Alguém pegou.', 'I have no room for it.': 'Não tenho espaço para isso.', 'Got it.': 'Peguei.', 'You have no room for it.': 'Você não tem espaço para isso.', 'Here.': 'Toma.', 'There.': 'Pronto.',
  'Pick up': 'Pegar',
});
G.LANG_PT.t.push(['There. I have the {0}.', 'Pronto. Peguei: {0}.'], ['{0} gave you {1}.', '{0} te deu {1}.'], ['Pick up {0}', 'Pegar {0}']); if (G.i18n.tpl) G.i18n.tpl = null;
})();
