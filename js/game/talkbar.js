'use strict';
// T: say something to whoever is near, in your own words, without stopping the game.
//   A small line opens at the bottom of the screen. The world keeps going while you type (you just stand still).
//   Enter says it out loud: the person answers over their head and in a small running transcript, and you can keep
//   walking. T again to answer back. The same conversation goes on until you walk off or go quiet for a while, and is
//   remembered like any other. Whatever the dialogue window offers can be asked for here in your own words (their name, their
//   number, a trade, going through their things, work): if they agree it happens the same way, and no window ever opens by itself.
//   Something left to decide is said in the transcript, and you answer it the same way. Nobody around: T is the old Wait key.
//   People start things too: they bring up what you did, complain, thank you, ask, gossip (G.autonomy).
(() => {
const U = G.ui, pick = (a) => G.rng.pick(a);
const MAX = 200, IDLE = 40, FAR = 190;
// (threats are never read into a question: said as threats, they go the way threats go, js/game/chat.js)
const HARM = /Threaten|days are numbered|Hand over your cash/i;
const BYE = /^(Goodbye\.?|Nevermind\.?|Never mind\.?|\[Leave\])$/i, QUIET = new Set(['your', 'that', 'this', 'with', 'what', 'have', 'there', 'about', 'want', 'need', 'some', 'them', 'they', 'could', 'would']);
// the ways of asking for what the window offers, in English and Portuguese: [the option, the words]
const ASKS = [
  [/your name/i, /\b(your name|you called|who are you|nome|quem (é|e) voc)/i],
  [/your number/i, /\b(number|phone|digits|contact|n[uú]mero|telefone|celular|zap|whatsapp)\b/i],
  [/trade/i, /\b(trade|trading|swap|barter|exchange|trocar?|troca|escambo|negociar)\b/i],
  [/manage your items|go through your things/i, /\b(manage|inventory|your (stuff|things|items|gear|bag|pockets)|invent[aá]rio|gerenciar|suas coisas|seus itens)/i],
  [/your wares/i, /\b(wares|shop|buy|sell|for sale|store|comprar|vender|loja|mercadoria)/i],
  [/better on the prices/i, /\b(discount|cheaper|better price|lower (the )?price|desconto|mais barato)/i],
  [/any news/i, /\b(news|rumou?rs?|gossip|what'?s (new|happening|going on)|not[ií]cias?|novidades?|boatos?|fofocas?)/i],
  [/any work|work for me|is there work/i, /\b(work|job|hire|hiring|trabalho|emprego|servi[cç]o)\b/i],
  [/come with me/i, /\b(come with me|come along|join me|tag along|vem comigo|venha comigo)/i],
  [/who do you run with/i, /\b(run with|your (gang|crew|faction|people)|sua (gangue|turma|fac[cç][aã]o))/i],
  [/what do you do/i, /\b(what do you do|your job|o que voc[eê] faz)/i],
  [/let'?s talk|keep talking/i, /\b(let'?s talk|can we talk|got a minute|vamos conversar|podemos conversar)/i],
];
const GS = G.GameScene.prototype;

const B = G.talkbar = {
  session: null,    // { npc, runner, last }
  feed: [],         // { who, text, t } what was said, newest last
  wait: false,      // a reply is on its way
  // who you would be talking to: who you were talking to, who the prompt is on, the nearest person you could reach
  target(scene) {
    const p = scene.player, s = this.session;
    if (s && !s.npc.dead && s.npc.distTo(p) < FAR && !s.npc.st.ko) return s.npc;
    const t = scene.promptTarget;
    if (t && t.type === 'npc' && this.ok(t.ref)) return t.ref;
    const myB = scene.map.buildingAt(p.x, p.y - 3);
    return scene.actors.filter((a) => a.kind === 'npc' && this.ok(a) && a.distTo(p) < 72 && scene.map.buildingAt(a.x, a.y - 3) === myB).sort((a, b) => a.distTo(p) - b.distTo(p))[0] || null;
  },
  ok(a) { return !!a && !a.dead && !a.sleeping && !a.remote && !!a.st && !a.st.ko; },
  open(scene) {
    const npc = this.target(scene);
    if (!npc) return false;
    // an officer on you: this is surrendering, hands empty (js/game/policestop.js)
    if (G.policeStop.canSurrender(scene, npc)) { scene.talkTo(npc); return true; }
    G.scenes.push(new TalkBarScene(scene, npc));
    return true;
  },
  start(scene, npc) {
    const s = this.session;
    if (s && s.npc === npc && !s.runner.ended) return s;
    this.close();
    const had = npc.talking, r = new G.DialogueRunner(npc, scene);
    npc.talking = had;
    r.bar = true;
    return (this.session = { npc, runner: r, last: G.loop.time });
  },
  close() {
    const s = this.session; this.session = null;
    if (s && !s.runner.ended) s.runner.end();
  },
  push(who, text) { this.feed.push({ who, text, t: G.loop.time }); if (this.feed.length > 6) this.feed.shift(); },
  // what the conversation offers right now, as a list of what can be asked for
  list(node) { return ((node && node.choices) || []).map((c, i) => ({ text: String(c.text), i, say: !!c.aiSay })).filter((o) => !o.say && !BYE.test(o.text) && !HARM.test(o.text)); },
  // which of them these words are asking for; -1 if none
  match(text, opts) {
    const t = ` ${String(text).toLowerCase()} `, exact = opts.find((o) => o.text.toLowerCase() === String(text).trim().toLowerCase()); if (exact) return exact.i;
    for (const [lab, re] of ASKS) { const o = opts.find((q) => lab.test(q.text)); if (o && re.test(t)) return o.i; }
    let best = -1, top = 0;
    for (const o of opts) { const ws = o.text.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').match(/[a-z']{4,}/g) || []; const key = ws.filter((w) => !QUIET.has(w)); if (key.length < 2) continue; const n = key.filter((w) => t.includes(w)).length, k = n / key.length; if (n >= 2 && k >= 0.6 && k > top) { top = k; best = o.i; } }
    return best;
  },
  // the option happens as it would from the window: their answer is spoken, what it starts starts
  run(scene, s, i) { s.live = false; s.runner.choose(i); this.settle(scene, s, true); },
  settle(scene, s, speak) {
    const r = s.runner, npc = s.npc;
    if (r.ended) { const f = r.afterEnd; r.afterEnd = null; if (this.session === s) this.session = null; if (f) f(); return; }
    const node = r.node; if (!node) return;
    if (speak && node.text) { this.push(this.nameOf(npc), node.text); npc.say(node.text, Math.min(8, 2.5 + String(node.text).length / 22)); if (G.ai && G.ai.log) G.ai.log(r, 'npc', node.text); }
    const go = node.choices.findIndex((c) => /^\[(?!Leave|Fight|Back)/.test(String(c.text)));   // they said yes: [Trade] and the like are not a further question
    if (go >= 0) { r.choose(go); this.settle(scene, s, false); return; }
    const real = this.list(node).filter((o) => !/^Something else/.test(o.text));
    s.live = real.length > 0 && node.id !== 'start';
    if (s.live) this.push('...', real.slice(0, 3).map((o) => G.i18n.t(o.text)).join('   /   '));
  },
  // the player said it
  send(scene, npc, text) {
    const s = this.start(scene, npc), r = s.runner, A = G.ai;
    s.last = G.loop.time;
    this.push('You', text);
    if (s.live) {   // what was left to decide comes first
      const live = this.list(r.node).filter((o) => !/^Something else/.test(o.text)); let i = this.match(text, live);
      if (i < 0 && /^\s*(yes|yeah|yep|ok|okay|sure|sim|claro|pode|fechado)\b/i.test(text) && live.length) i = live[0].i;
      if (i >= 0) { this.run(scene, s, i); return; }
      s.live = false;
    }
    if (!r.ended && r.tree && r.tree.start && (!r.node || r.node.id !== 'start')) r.go('start');
    const opts = this.list(r.node); r.barOptions = opts.map((o) => o.text); s.opts = opts;
    if (!(A && A.usable(r))) { const i = this.match(text, opts); if (i >= 0) { if (G.aware) G.aware.speech(scene, scene.player, npc, text); this.run(scene, s, i); return; } }
    if (G.aware) G.aware.speech(scene, scene.player, npc, text);
    if (npc.state === 'schedule' && !npc.st.companion) { npc.chatT = Math.max(npc.chatT || 0, 8); npc.moving = false; npc.faceTowards(scene.player); }
    if (A && A.usable(r)) {
      this.wait = true; npc.say('...', 30);
      A.exchange(r, text).then((res) => { this.wait = false; if (npc.bark === '...') npc.bark = null; this.reply(scene, s, res, text); }, () => { this.wait = false; this.classic(scene, s, text); });
    } else this.classic(scene, s, text);
  },
  reply(scene, s, res, text) {
    if (!res) return this.classic(scene, s, text);
    const npc = s.npc, r = s.runner;
    if (r.ended || npc.dead) return;
    s.last = G.loop.time;
    this.push(this.nameOf(npc), res.line);
    npc.say(res.line, Math.min(8, 2.5 + res.line.length / 22));
    if (G.aware) G.aware.speech(scene, npc, scene.player, res.line);
    if (res.end) { for (const f of res.afters || []) f(); this.close(); return; }
    // they agreed to something the conversation offers: it happens (the model names it; if it only said yes in words, the words decide)
    const opts = s.opts || [], heard = G.i18n.toEnglish(res.line); let i = res.option != null ? this.match(res.option, opts) : -1;
    if (i < 0 && !/\b(no|not|nope|never|won'?t|can'?t|don'?t|cannot|sorry|later|maybe)\b/i.test(heard)) i = this.match(text, opts);
    if (i >= 0 && r.node) { this.run(scene, s, i); return; }
    // something left to decide: said here, answered here; no window opens by itself
    const pending = (res.extra || []).filter(Boolean);
    if (pending.length) { r.node = { id: '_ai', text: res.line, ai: true, choices: pending }; this.settle(scene, s, false); } else s.say = res.say || [];
  },
  classic(scene, s, text) {
    const npc = s.npc, r = s.runner;
    if (r.ended) return;
    r.say(text);
    const node = r.node, line = r.chatReply ? r.chatReply.text : node && node.text;
    if (line) { this.push(this.nameOf(npc), line); if (!r.ended) npc.say(line, Math.min(8, 2.5 + line.length / 22)); }
    if (r.ended) { this.session = null; return; }
    if (((r.chatReply && r.chatReply.choices) || []).length) this.settle(scene, s, false);
  },
  nameOf(npc) { return npc.displayName; },
  // walked away, or it went quiet
  tick(scene) {
    const s = this.session;
    if (!s) return;
    if (s.runner.ended || s.npc.dead || s.npc.st.ko || s.npc.distTo(scene.player) > FAR * 1.5 || (G.loop.time - s.last > IDLE && !this.wait)) this.close();
  },
  // the running transcript over the bottom edge of the screen (no window, no pause)
  draw(ctx, scene) {
    const R = G.renderer, now = G.loop.time, W = Math.min(330, R.uiW - 24), x = 12;
    const live = this.feed.filter((f) => now - f.t < 14).slice(-4);
    if (!live.length) return;
    let y = R.uiH - 96;
    const rows = [];
    for (const f of live) for (const [i, l] of U.wrap(ctx, `${f.who}: ${f.text}`, W - 10, 8).entries()) rows.push({ l, you: f.who === 'You', a: Math.min(1, (14 - (now - f.t)) / 2), i });
    const show = rows.slice(-7);
    y -= show.length * 10;
    ctx.fillStyle = 'rgba(13,13,12,0.55)'; ctx.fillRect(x - 3, y - 3, W, show.length * 10 + 6);
    show.forEach((o, k) => { ctx.globalAlpha = o.a; U.text(ctx, o.l, x + 2, y + k * 10, { size: 8, raw: true, color: o.you ? '#d2cec7' : '#d0c9bb' }); });
    ctx.globalAlpha = 1;
  },
};

// the typing line: the game goes on underneath, you stand still
class TalkBarScene {
  constructor(game, npc) {
    this.transparent = true; this.xpNoir = true;
    this.game = game; this.npc = npc; this.input = '';
    G.input.typed.length = 0;
    G.audio.play('select');
  }
  update(dt) {
    const I = G.input, g = this.game, p = g.player;
    for (const ch of I.typed) if (this.input.length < MAX) this.input += ch;
    I.typed.length = 0;
    if (I.pressed.has('Backspace')) this.input = this.input.slice(0, -1);
    const done = I.pressed.has('Enter'), cancel = I.pressed.has('Escape');
    // the world turns: nothing the keyboard does reaches the game while you type
    const down = new Set(I.down), pressed = new Set(I.pressed), m = I.mouse, mp = [m.pressed, m.down, m.rdown, m.rpressed];
    I.down.clear(); I.pressed.clear(); m.pressed = false; m.down = false; m.rdown = false; m.rpressed = false;
    const before = G.scenes.stack.length;
    try { g.update(dt); } finally { for (const k of down) I.down.add(k); for (const k of pressed) I.pressed.add(k); [m.pressed, m.down, m.rdown, m.rpressed] = mp; }
    if (G.scenes.stack.length !== before || p.dead) { G.scenes.remove(this); return; }
    if (cancel) { G.scenes.remove(this); I.pressed.delete('Escape'); return; }
    if (done) {
      const text = this.input.trim();
      G.scenes.remove(this); I.pressed.delete('Enter');
      if (text && B.ok(this.npc) && !this.npc.dead) { G.audio.play('confirm'); B.send(g, this.npc, text); }
    }
  }
  render(ctx) {
    const R = G.renderer; R.uiTransform();
    const W = Math.min(420, R.uiW - 24), x = (R.uiW - W) / 2, y = R.uiH - 78;
    ctx.fillStyle = 'rgba(17,17,17,0.86)'; ctx.fillRect(x, y, W, 26);
    ctx.fillStyle = 'rgba(193,167,114,0.55)'; ctx.fillRect(x, y, W, 1);
    U.text(ctx, `To ${this.npc.displayName}`, x + 6, y + 3, { size: 7, color: '#c1a772', weight: 'bold', raw: true });
    const caret = Math.floor(G.loop.time * 2) % 2 ? '|' : '', full = `${this.input}${caret}`;
    let shown = full;
    while (shown.length > 1 && ctx.measureText && U.wrap(ctx, shown, W - 12, 8).length > 1) shown = shown.slice(1);
    U.text(ctx, shown, x + 6, y + 13, { size: 8, raw: true, color: '#f5f4f2' });
  }
}
G.TalkBarScene = TalkBarScene;

// T: talk if someone is there, the old Wait if not
const _upd = GS.update;
GS.update = function (dt) {
  const I = G.input;
  if (G.scenes.top() === this && I.wasPressed('talk') && this.player && !this.player.dead && !this.player.vehicle && !G.coop.role) {
    if (B.open(this)) { for (const k of I.bindings.talk) I.pressed.delete(k); return; }
  }
  const r = _upd.call(this, dt);
  B.tick(this);
  if (G.autonomy) G.autonomy.tick(this, dt);
  return r;
};
const _draw = G.hud.draw;
G.hud.draw = function (ctx, scene) { const r = _draw.apply(this, arguments); try { B.draw(ctx, scene); } catch (e) { /* the HUD comes first */ } return r; };
G.xp && G.xp.NOIR.add('TalkBarScene');

// ---------------------------------------------------------------- people who start things
const AU = G.autonomy = {
  GAP: 75, NPC_GAP: 900, _t: 0, _last: -999,
  off: false,
  // what is on their mind about you, most pressing first
  topic(scene, npc) {
    const w = scene.world, st = npc.st, P = G.social.persona(npc.id), mems = G.mem.list(w, npc.id).filter((x) => !x.raised), p = scene.player;
    const by = mems.filter((x) => x.by === 'player');
    const broken = by.find((x) => x.k === 'promise' && x.done === 'broken');
    if (broken) return { m: broken, kind: 'promise', text: pick(['You made me a promise. I have not forgotten.', 'So much for your word.']), hint: `You are bringing up a promise the player did not keep: ${broken.t}` };
    const hurt = by.filter((x) => x.f <= -2 && x.i >= 3 && w.day - x.d <= 3).sort((a, b) => b.i - a.i)[0];
    if (hurt && P.courage >= 40 && (st.fear || 0) < 40) return { m: hurt, kind: 'grudge', text: pick(['I have not forgotten what you did.', 'You owe me an apology.', 'I remember you.']), hint: `You are complaining to the player, to their face, about this: ${hurt.t}` };
    const good = by.find((x) => x.f >= 2 && w.day - x.d <= 4);
    if (good) return { m: good, kind: 'thanks', text: pick(['Hey. I never thanked you properly.', 'What you did the other day meant a lot.']), hint: `You are thanking the player for this: ${good.t}` };
    if (p.hp < p.maxHp * 0.4 && P.empathy >= 55 && (st.disp || 0) >= -10) return { kind: 'help', text: pick(['You look terrible. Need help?', 'Are you hurt? You should see someone.']), hint: 'The player looks badly hurt. You offer to help or tell them to get to the hospital.' };
    if ((st.disp || 0) < 15) return null;
    const need = (st.hunger || 0) >= 70 ? 'food' : (st.thirst || 0) >= 70 ? 'something to drink' : null;
    if (need && P.courage >= 35) return { kind: 'ask', text: `You would not have ${need === 'food' ? 'anything to eat' : 'something to drink'} on you, would you?`, hint: `You ask the player for ${need}.` };
    const news = mems.filter((x) => x.by !== 'player' && x.i >= 2 && G.mem.shareable(w, x, npc.id, npc.id)).sort((a, b) => b.d - a.d)[0];
    if (news && P.sociable >= 50) return { m: news, kind: 'gossip', text: pick(['You hear about what happened?', 'Did you hear?']), hint: `You share some gossip with the player: ${news.t}. Do not make it sound more certain than it is.` };
    if (P.sociable >= 60 && (st.disp || 0) >= 25) return { kind: 'chat', text: pick(['Hey! Got a minute?', 'Good to see you. What have you been up to?']), hint: 'You start a little chat with the player: ask them something.' };
    return null;
  },
  tick(scene, dt) {
    if (this.off || G.scenes.top() !== scene || (this._t -= dt) > 0) return;
    this._t = 2.5;
    const now = G.loop.time, p = scene.player;
    if (now - this._last < this.GAP || !p || p.dead || p.vehicle || B.session) return;
    const w = scene.world, game = nowM(w);
    const a = scene.actors.find((n) => n.kind === 'npc' && !n.dead && !n.transient && n.state === 'schedule' && !n.sleeping && !n.talking && n.st && !n.st.ko && !n.st.companion && G.NPCS[n.id] && n.distTo(p) < 64 && n.canSee(scene, p, 80) && game - (n.st.spokeUp || -1e9) > this.NPC_GAP && !(n.def.combat === 'guard' && (w.bounty[scene.region] || 0) > 0));
    if (!a) return;
    const t = this.topic(scene, a);
    if (!t) { a.st.spokeUp = game - this.NPC_GAP + 120; return; }
    this._last = now; a.st.spokeUp = game;
    if (t.m) t.m.raised = true;
    a.faceTowards(p); a.chatT = 5;
    const line = t.text;
    const show = (l) => { if (a.dead || a.talking) return; a.say(l, 4.5); B.push(a.displayName, l); if (!B.session && B.ok(a)) { const s = B.start(scene, a); if (G.ai && G.ai.log) G.ai.log(s.runner, 'npc', l); } };
    const A = G.ai;
    if (A && A.active && A.active() && A.bark && !G.aware._busy) {
      G.aware._busy = true;
      A.bark(scene, a, { kind: t.kind, text: 'noticed the player nearby', sev: 1, hint: t.hint, direct: true }).then((l) => { G.aware._busy = false; show(l || line); }, () => { G.aware._busy = false; show(line); });
    } else show(line);
  },
};
const nowM = (w) => w.day * 1440 + w.minutes;
})();
