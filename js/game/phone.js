'use strict';
// The cellphone (P, or use it from the inventory; M opens Eagle Maps).
//   Eagle Maps — the map of where you are, a list of places, and a GPS that guides you there, across maps.
//   Contacts   — people who gave you their number: call them (a conversation over the phone) or text them.
//   Messages   — texts you sent and received. People text back after a while, and sometimes first.
//   LifeLog    — journal, skills, relationships, reputation.     News — rumors and gang war updates.
// world.contacts = [npcId]   world.messages = [{ from, to, text, day, min, read }]   world.gps = { map, x, y, label }

G.PHONE_APPS = G.PHONE_APPS || {};   // landscape apps added by other systems (gambling...)
G.phone = {
  has(p) { return p.inventory.has('phone'); },
  contacts(w) { return (w.contacts = w.contacts || []); },
  messages(w) { return (w.messages = w.messages || []); },
  isContact(w, id) { return this.contacts(w).includes(id); },
  addContact(w, id) { if (!this.isContact(w, id)) { this.contacts(w).push(id); G.events.emit('toast', `${w.displayName(id)} added to your contacts.`, 'good'); } },
  unread(w) { return this.messages(w).filter((m) => m.to === 'player' && !m.read).length; },

  // A text arrives later: `delay` game minutes from now.
  queue(w, from, text, delay = 20) {
    (w.pendingTexts = w.pendingTexts || []).push({ from, text, at: w.day * 1440 + w.minutes + delay });
  },
  send(w, to, text) {
    this.messages(w).push({ from: 'player', to, text, day: w.day, min: Math.floor(w.minutes), read: true });
    const reply = G.phone.reply(w, to, text);
    if (reply) this.queue(w, to, reply, G.rng.int(5, 40));
  },
  deliver(w, scene) {
    const now = w.day * 1440 + w.minutes, list = w.pendingTexts || [];
    for (const t of list.filter((x) => x.at <= now)) {
      if (!w.isAlive(t.from)) continue;
      const blk = (w.phoneBlock || {})[t.from];
      if (blk === 'block') continue;   // blocked: their texts never arrive
      // nobody texts someone standing next to them (or walking with them): they just say it
      const here = scene && scene.actors.find((a) => a.id === t.from && !a.dead && !a.remote);
      if (here && (here.st.companion || here.distTo(scene.player) < 200)) { here.say(t.text, 4); continue; }
      this.messages(w).push({ from: t.from, to: 'player', text: t.text, day: w.day, min: Math.floor(w.minutes), read: false });
      if (scene && this.has(scene.player) && blk !== 'mute') { scene.toast(`New message from ${w.displayName(t.from)}`, 'quest'); G.audio.play('coin'); }
    }
    w.pendingTexts = list.filter((x) => x.at > now);
  },

  // What someone texts back depends on how they feel about you.
  REPLIES: {
    hey: (d, r) => (d >= 30 ? G.rng.pick(['Hey you! Not much, you?', 'Heyyy :) What are you up to?']) : d <= -30 ? 'Why are you texting me?' : G.rng.pick(['Hey. What\'s up?', 'Hi. Who is this again?'])),
    hang: (d, r) => (d >= 30 || r >= 30 ? G.rng.pick(['Sure! Come find me, I am around.', 'Yes! Call me when you are close.']) : d <= -10 ? 'No thanks.' : 'Maybe another time.'),
    help: (d) => (d >= 20 ? 'What happened? Are you okay? Call me if you need anything.' : 'Sorry, I cannot help right now.'),
    love: (d, r) => (r >= 50 ? G.rng.pick(['<3 Thinking about you too.', 'You are sweet. Miss you.']) : r >= 20 ? 'Haha... that is nice of you :)' : d >= 0 ? 'Uh... okay?' : 'Please stop.'),
    sorry: (d) => (d < 0 ? 'I will think about it.' : 'Do not worry about it.'),
    job: () => G.rng.pick(['Call me and we can talk about it.', 'Maybe. Come see me.']),
  },
  PRESETS: [['hey', 'Hey, what\'s up?'], ['hang', 'Want to hang out?'], ['help', 'I need help.'], ['job', 'Got any work for me?'], ['love', 'Thinking of you <3'], ['sorry', 'Sorry about earlier.']],
  reply(w, id, text) {
    const st = w.npcs[id];
    if (!st) return null;
    const key = (this.PRESETS.find((p) => p[1] === text) || [])[0] || 'hey';
    const d = st.disp || 0, r = st.romance || 0;
    if (key === 'love') { if (r >= 20) st.romance = Math.min(100, r + 3); else G.social.addDisp(w, id, d >= 10 ? 0 : -3); }
    if (key === 'sorry' && d < 0) G.social.addDisp(w, id, 4);
    if (key === 'hey') G.social.addDisp(w, id, 1);
    return this.REPLIES[key](d, r);
  },

  // People text first: partners and close friends now and then.
  hourly(w) {
    if (G.rng.chance(0.85)) return;
    const close = this.contacts(w).filter((id) => w.isAlive(id) && ((w.npcs[id].romance || 0) >= 40 || (w.npcs[id].disp || 0) >= 50));
    if (!close.length || w.hour < 9 || w.hour > 22) return;
    const id = G.rng.pick(close), r = w.npcs[id].romance || 0;
    this.queue(w, id, r >= 40 ? G.rng.pick(['Miss you. Come see me later?', 'Thinking about you <3', 'Dinner tonight? My treat.']) : G.rng.pick(['Hey! Want to grab a drink sometime?', 'You will not believe what just happened...', 'How are you holding up?']), 1);
  },

  // ---------------- GPS ----------------
  // Only real places are listed: no jail, no upper floors, no Woods cells (those are made on demand and
  // dropped from memory, so listing them regenerated every visited cell on every frame and froze the game).
  listable(id) {
    if (id === 'jail' || (G.isWildsMap && G.isWildsMap(id)) || /_f\d+$/.test(id)) return false;
    const m = G.maps.cache[id];
    return !(m && (m.meta.floorOf || m.meta.dream));
  },
  _placeCache: new WeakMap(),   // map object -> its entries (a rebuilt or reset map gets fresh ones)
  mapPlaces(m, home) {
    let c = this._placeCache.get(m);
    if (!c || c.home !== home) {
      const list = [{ label: m.meta.name, map: m.id, x: Math.floor(m.w / 2), y: Math.floor(m.h / 2), area: true }];
      for (const b of m.buildings) {
        const mine = home === b.id;
        if (!mine && /^(House|Apartment|Apartment Block|Tenement|Trailer|Mansion)$/.test(b.name)) continue;
        list.push({ label: `${mine ? 'Home' : b.name} (${m.meta.name})`, map: m.id, x: b.doorX, y: b.doorY + 1 });
      }
      this._placeCache.set(m, (c = { home, list }));
    }
    return c.list;
  },
  places(w) {
    const out = [];
    for (const id of Object.keys(G.MAPGEN)) if (this.listable(id)) for (const pl of this.mapPlaces(G.maps.get(id), w.flags.player_home)) out.push(Object.assign({}, pl));
    for (const id of this.contacts(w)) {
      const d = G.NPCS[id], st = w.npcs[id];
      if (!d || !st || !st.alive || !d.home) continue;
      // their home is on their own map, wherever they are right now
      const m = [d.map, st.map].filter((x) => x && G.MAPGEN[x] && this.listable(x)).map((x) => G.maps.get(x)).find((x) => x.building(d.home));
      const b = m && m.building(d.home);
      if (b) out.push({ label: `${w.displayName(id)}'s place (${m.meta.name})`, map: m.id, x: b.doorX, y: b.doorY + 1 });
    }
    return out;
  },
  // Next step toward the GPS target: a tile on this map (the target itself, or the exit to take).
  route(scene) {
    const w = scene.world, g = w.gps;
    if (!g) return null;
    // following a person: keep the target on where they are now
    if (g.npc && G.bct && (!g.seen || G.loop.time - g.seen > 1.5)) { const at = w.isAlive(g.npc) && G.bct.locate(scene, g.npc); g.seen = G.loop.time; if (at) Object.assign(g, at); else { w.gps = null; return null; } }
    if (g.map === scene.map.id) return { x: g.x, y: g.y, final: true };
    // up (or down) some stairs: head for the stairs in this building, or the building's door from outside
    const tf = G.maps.get(g.map).meta.floorOf, hf = scene.map.meta.floorOf;
    if (tf || hf) {
      const base = (tf || hf).map, bid = (tf || hf).b, here = scene.map;
      if (here.id === base || (hf && hf.map === base && hf.b === bid)) {
        const b = here.id === base && here.building(bid);
        const lvH = hf ? hf.level : 0, lvT = tf ? tf.level : 0, want = lvT > lvH ? 'stairs_up' : 'stairs_down';
        const st = here.decor.find((d) => d.def.interact === 'stairs' && (d.type === want || (d.type !== 'stairs_up' && d.type !== 'stairs_down')) && (!b ||(d.tx > b.x && d.tx < b.x + b.w - 1 && d.ty > b.y && d.ty < b.y + b.h - 1)));
        const inside = b && here.buildingAt(scene.player.x, scene.player.y - 3) === b;
        if (b && !inside) return { x: b.doorX, y: b.doorY + 1, via: b.name };
        if (st) return { x: st.tx, y: st.ty + 1, via: 'the stairs' };
      }
      if (hf && hf.map !== (tf || {}).map) {   // on some other building's floor: go down first
        const st = here.decor.find((d) => d.type === 'stairs_down' || (d.def.interact === 'stairs' && d.type !== 'stairs_up'));
        if (st) return { x: st.tx, y: st.ty + 1, via: 'downstairs' };
      }
      if (tf && !hf) { const g2 = Object.assign({}, g, { map: base }); const b = G.maps.get(base).building(bid); if (b) { g2.x = b.doorX; g2.y = b.doorY + 1; } return this.routeTo(scene, g2); }
    }
    return this.routeTo(scene, g);
  },
  routeTo(scene, g) {
    if (g.map === scene.map.id) return { x: g.x, y: g.y, final: false };
    // breadth-first search over map exits
    const prev = { [scene.map.id]: null }, q = [scene.map.id];
    while (q.length) {
      const cur = q.shift();
      if (cur === g.map) break;
      // (woods cells are not expanded: they are made on demand, and the search runs every frame)
      for (const e of G.maps.get(cur).exits) if (!(e.to in prev) && G.MAPGEN[e.to] && e.to !== 'jail' && !(G.isWildsMap && G.isWildsMap(e.to) && e.to !== g.map)) { prev[e.to] = cur; q.push(e.to); }
    }
    if (!(g.map in prev)) return null;
    let step = g.map;
    while (prev[step] !== scene.map.id) step = prev[step];
    const ex = scene.map.exits.find((e) => e.to === step);
    return ex ? { x: ex.x + Math.floor(ex.w / 2), y: ex.y + Math.floor(ex.h / 2), via: G.maps.get(step).meta.name } : null;
  },
  drawHud(ctx, scene) {
    const w = scene.world, r = this.route(scene), p = scene.player;
    if (!w.gps || !r) return;
    const tx = r.x * 16 + 8, ty = r.y * 16 + 8, dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    if (r.final && dist < 28) { w.gps = null; scene.toast('Eagle Maps: you have arrived.', 'good'); return; }
    // (only the compass on the phone points the way: no arrow beside the character)
    this.drawCompass(ctx, w.gps.label.replace(/ \(.*\)$/, ''), Math.atan2(dy, dx), Math.round(dist / 16 * 2), r.via, !!p.vehicle);
  },
  // a small phone held sideways just above the weapon card (above the speedometer while driving): Eagle Maps as a
  // compass, the needle on where to go next (the place itself, or the way out of this map toward it)
  drawCompass(ctx, name, ang, meters, via, driving) {
    const U = G.ui, R = G.renderer, PW = 96, PH = 40, px = Math.round(R.uiW - 189), py = Math.round(R.uiH - (driving ? 70 : 44) - PH);
    const rr = (x, y, w, h, rad) => { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); };
    ctx.save();
    ctx.globalAlpha = 0.95;
    // the body and the screen
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(px + 2, py + 3, PW, PH, 7); ctx.fill();
    ctx.fillStyle = '#16161c'; rr(px, py, PW, PH, 7); ctx.fill();
    ctx.strokeStyle = '#4a4a56'; ctx.lineWidth = 1; rr(px + 0.5, py + 0.5, PW - 1, PH - 1, 7); ctx.stroke();
    const sx = px + 7, sy = py + 3, SW = PW - 14, SH = PH - 6;
    const g = ctx.createLinearGradient(0, sy, 0, sy + SH); g.addColorStop(0, '#1c3550'); g.addColorStop(1, '#0e1a28');
    ctx.fillStyle = g; rr(sx, sy, SW, SH, 4); ctx.fill();
    ctx.fillStyle = '#2a2a32'; ctx.fillRect(px + 2, py + PH / 2 - 6, 2, 12);   // the earpiece (on the side: the phone is sideways)
    // the dial on the left: north up, ticks, and the needle
    const cx = sx + 18, cy = sy + SH / 2, rad = 14;
    ctx.fillStyle = '#0a121c'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(138,216,255,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6, k = i % 3 ? 2 : 3.5; ctx.strokeStyle = i % 3 ? 'rgba(138,216,255,0.35)' : 'rgba(200,236,255,0.8)'; ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * (rad - k), cy + Math.sin(t) * (rad - k)); ctx.lineTo(cx + Math.cos(t) * (rad - 1), cy + Math.sin(t) * (rad - 1)); ctx.stroke(); }
    U.text(ctx, 'N', cx, cy - rad + 3, { size: 5, align: 'center', color: '#ff7a6a', shadow: false, raw: true });
    const pulse = 0.75 + 0.25 * Math.sin(G.loop.time * 4);
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = `rgba(80,200,255,${pulse})`; ctx.beginPath(); ctx.moveTo(rad - 3, 0); ctx.lineTo(-4, -4.5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 4.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-7, -2); ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
    ctx.rotate(-ang); ctx.translate(-cx, -cy);
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
    // on the right: the app, where, how far
    const fit = (t, size, max) => { if (U.measure(ctx, t, size) <= max) return t; while (t.length > 1 && U.measure(ctx, t + '…', size) > max) t = t.slice(0, -1); return t + '…'; };
    const tx = sx + 38, tw = sx + SW - 3 - tx;
    U.text(ctx, 'Eagle Maps', tx, sy + 3, { size: 4, color: '#8ad8ff', shadow: false, raw: true });
    U.text(ctx, fit(name, 5, tw), tx, sy + 10, { size: 5, color: '#e8f0f8', shadow: false, raw: true });
    U.text(ctx, meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : meters + ' m', tx, sy + 17, { size: 6, weight: 'bold', color: '#8ad8ff', shadow: false, raw: true });
    if (via) U.text(ctx, fit('via ' + via, 4, tw), tx, sy + 26, { size: 4, color: '#8a9ab0', shadow: false, raw: true });
    ctx.restore();
  },

  // ---------------- relationships ----------------
  status(st) {
    const d = st.disp || 0, r = st.romance || 0;
    if (st.partner) return ['Partner', '#ff7ab0'];
    if (r >= 40) return ['Dating', '#ff9ac0'];
    if (r >= 15) return ['Crush', '#ffb0d0'];
    if (d >= 60) return ['Best Friend', '#7cd070'];
    if (d >= 25) return ['Friend', '#9ad080'];
    if (d <= -60) return ['Enemy', '#ff5a4a'];
    if (d <= -25) return ['Disliked', '#ff9a7a'];
    return ['Acquaintance', '#c8c0b0'];
  },
  known(w) {
    return Object.keys(w.npcs).filter((id) => G.NPCS[id] && (w.npcs[id].introduced || this.isContact(w, id) || Math.abs(w.npcs[id].disp || 0) >= 10 || w.npcs[id].romance));
  },

  // Open an app. Journal, Skills and Settings turn the phone sideways (landscape) on top of it.
  openApp(scene, app, tab) {
    let phone = G.scenes.stack.find((s) => s instanceof G.PhoneScene);
    if (!phone) { phone = new G.PhoneScene(scene); G.scenes.push(phone); }
    if (app === 'journal') { const j = new G.JournalScene(scene); j.inPhone = true; if (tab != null) j.tab = tab; G.scenes.push(j); }
    else if (app === 'skills') { const s = new G.SkillsScene(scene); s.inPhone = true; G.scenes.push(s); }
    else if (app === 'settings') { const s = new G.SettingsScene(); s.inPhone = true; G.scenes.push(s); }
    else if (G.PHONE_APPS[app]) { const s = G.PHONE_APPS[app](scene); s.inPhone = true; G.scenes.push(s); }
    else phone.open(app);
  },

  // Someone to talk to over the phone (the real NPC if they are here, a stand-in otherwise).
  callee(scene, id) {
    const here = scene.actors.find((a) => a.id === id && !a.dead);
    if (here) return here;
    const npc = new G.NPC(id, scene.world.npcs[id]);
    npc.x = scene.player.x; npc.y = scene.player.y;
    npc.remote = true;
    return npc;
  },
  call(scene, id) {
    const w = scene.world, st = w.npcs[id];
    if (!st || !st.alive) { scene.toast('"The number you have dialed is not in service."', 'bad'); return; }
    const e = G.beds.entryNow(id, w);
    if (e && e.act === 'sleep' && !(st.romance >= 40) && G.rng.chance(0.8)) { scene.toast(`${w.displayName(id)} does not pick up. (Probably asleep.)`); return; }
    if ((st.disp || 0) <= -50) { scene.toast(`${w.displayName(id)} hangs up on you.`, 'bad'); return; }
    G.audio.play('select');
    const npc = this.callee(scene, id);
    G.scenes.push(new G.DialogueScene(scene, new G.DialogueRunner(npc, scene, '_phone')));
  },
};

G.ITEM_USE = G.ITEM_USE || {};
G.ITEM_USE.phone = (game) => { G.scenes.push(new G.PhoneScene(game)); return true; };
G.events.on('hour', () => { if (G.world) { G.phone.hourly(G.world); } });

// Phone calls: small talk, work, and plans.
G.DIALOGUES._phone = {
  start: {
    text: (c) => ((c.st.romance || 0) >= 40 ? G.rng.pick(['Hey you! I was just thinking about you.', 'Hi, babe. What is up?']) : (c.st.disp || 0) >= 30 ? G.rng.pick(['Hey! Good to hear from you.', 'Oh hey, what is going on?']) : G.rng.pick(['Hello?', 'Yeah, who is this?', 'Hello? ...Oh, it is you.'])),
    choices: [
      { text: 'Just calling to chat.', next: '_chat' },
      { text: 'Got any work for me?', next: '_job_offer' },
      { text: 'Want to go on a date?', if: (c) => (c.st.romance || 0) >= 25, next: '_date' },
      { text: 'Bye.', next: null },
    ],
  },
};

// ---------------------------------------------------------------- the phone screen
(() => {
const U = G.ui;
const APPS = [
  ['maps', 'Eagle Maps', '#2a8ad8', 'E'], ['contacts', 'Contacts', '#3aa860', 'C'], ['messages', 'Messages', '#5ac040', 'M'], ['bct', 'chatBCT', '#7a3ad8', 'B'],
  ['lifelog', 'LifeLog', '#d87a2a', 'L'], ['news', 'News', '#a83a3a', 'N'], ['settings', 'Settings', '#5a5a68', 'S'], ['clock', 'Clock', '#4a4a5a', 'T'],
  ['luckystrike', 'LuckyStrike', '#c8366a', '$'], ['sportsbet', 'SportsBet', '#2a8a4a', 'W'],
];
G.PHONE_APP_LIST = APPS;   // other modules add apps here (and their screens to G.PHONE_SCREENS)
G.PHONE_SCREENS = G.PHONE_SCREENS || {};

class PhoneScene {
  constructor(game, app = 'home') {
    this.transparent = true;
    this.game = game;
    this.stack = [];
    this.open(app);
    G.audio.play('select');
  }
  get w() { return this.game.world; }
  open(screen, data) { if (this.screen) this.stack.push([this.screen, this.data, this.sel]); this.screen = screen; this.data = data; this.sel = 0; this.scroll = 0; }
  back() { if (!this.stack.length) { G.scenes.remove(this); return; } [this.screen, this.data, this.sel] = this.stack.pop(); }

  // Rows for list screens: [{ label, sub, color, act }]
  rows() {
    const w = this.w, g = this.game;
    switch (this.screen) {
      case 'maps': {
        const rows = w.gps ? [{ label: 'Clear route', color: '#ff9a7a', act: () => { w.gps = null; } }] : [];
        return rows.concat(G.phone.places(w).map((pl) => ({ label: pl.label, sub: pl.area ? 'Area' : '', color: pl.area ? '#8ad8ff' : null, act: () => { w.gps = pl; g.toast(`Eagle Maps: route to ${pl.label}.`, 'good'); G.scenes.remove(this); } })));
      }
      case 'contacts':
        return G.phone.contacts(w).map((id) => ({ label: w.displayName(id), sub: w.npcs[id].alive ? G.phone.status(w.npcs[id])[0] : 'deceased', color: w.npcs[id].alive ? null : '#888', act: () => this.open('contact', id) }));
      case 'contact': {
        const id = this.data, st = w.npcs[id], d = G.NPCS[id];
        return [
          { label: 'Call', act: () => { G.scenes.remove(this); G.phone.call(g, id); } },
          { label: 'Text...', act: () => this.open('compose', id) },
          { label: 'Show their place on Eagle Maps', act: () => { const pl = G.phone.places(w).find((q) => q.label.startsWith(w.displayName(id) + "'s")); if (pl) { w.gps = pl; g.toast('Route set.', 'good'); G.scenes.remove(this); } else g.toast('No address for them.'); } },
          { label: (w.phoneBlock || {})[id] === 'mute' ? 'Unsilence notifications' : 'Silence notifications', act: () => { const b = w.phoneBlock = w.phoneBlock || {}; if (b[id] === 'mute') delete b[id]; else b[id] = 'mute'; g.toast(b[id] ? 'Silenced. Their texts arrive quietly.' : 'Notifications back on.'); } },
          { label: (w.phoneBlock || {})[id] === 'block' ? 'Unblock' : 'Block', color: '#ff9a7a', act: () => { const b = w.phoneBlock = w.phoneBlock || {}; if (b[id] === 'block') delete b[id]; else b[id] = 'block'; g.toast(b[id] ? 'Blocked. You will not get their texts.' : 'Unblocked.'); } },
          { label: 'Delete contact', color: '#ff9a7a', act: () => { w.contacts = G.phone.contacts(w).filter((x) => x !== id); this.back(); } },
        ].filter(() => st && d);
      }
      case 'compose':
        return G.phone.PRESETS.map(([, text]) => ({ label: text, act: () => { G.phone.send(w, this.data, text); g.toast('Message sent.'); this.back(); } }));
      case 'messages': {
        const people = [...new Set(G.phone.messages(w).map((m) => (m.from === 'player' ? m.to : m.from)))].reverse();
        return people.map((id) => {
          const last = G.phone.messages(w).filter((m) => m.from === id || m.to === id).pop();
          const unread = G.phone.messages(w).some((m) => m.from === id && !m.read);
          return { label: (unread ? '• ' : '') + w.displayName(id), sub: last.text.slice(0, 34), color: unread ? '#8aea7a' : null, act: () => this.open('thread', id) };
        });
      }
      case 'thread': {
        const id = this.data;
        const msgs = G.phone.messages(w).filter((m) => m.from === id || m.to === id);
        for (const m of msgs) m.read = true;
        return msgs.slice(-9).map((m) => ({ label: m.text, sub: m.from === 'player' ? 'You' : w.displayName(id), color: m.from === 'player' ? '#9ad0ff' : '#e8e0d0', info: true }))
          .concat([{ label: 'Reply...', act: () => this.open('compose', id) }]);
      }
      case 'lifelog':
        return [
          { label: 'Journal', act: () => G.phone.openApp(g, 'journal') },
          { label: 'Skills', act: () => G.phone.openApp(g, 'skills') },
          { label: 'Relationships', act: () => this.open('relations') },
          { label: 'Effects & Symptoms', sub: (() => { const n = G.effects.hudList(g.player).length; return n ? `${n} affecting you right now` : 'Nothing affecting you'; })(), act: () => this.open('effects') },
          { label: 'Legal status', act: () => this.open('legal') },
          { label: 'Notifications', sub: 'Everything that did not need to be on screen', act: () => this.open('notes') },
          { label: 'Attributes', act: () => this.open('attributes') },
          { label: 'Reputation', act: () => G.phone.openApp(g, 'journal', 3) },
          { label: 'Turf (gang war)', act: () => G.phone.openApp(g, 'journal', 6) },
        ];
      case 'relations':
        // one line each; open someone for the details (their page: 'relation')
        return G.phone.known(w).sort((a, b) => (w.npcs[b].disp || 0) - (w.npcs[a].disp || 0)).map((id) => {
          const t = G.rel.tier(w.npcs[id], id);
          return { label: w.displayName(id), sub: `${t.name} · ${G.NPCS[id].name}${w.npcs[id].alive ? '' : ' (dead)'}`, color: t.color, bar: G.rel.value(w.npcs[id]) / 100, act: () => this.open('relation', id) };
        });
      case 'relation': {   // what you can do from their page (the details are drawn above: drawRelation)
        const id = this.data, st = w.npcs[id], out = [];
        if (!st) return out;
        if (st.alive && G.phone.isContact(w, id)) {
          out.push({ label: 'Call', act: () => { G.scenes.remove(this); G.phone.call(g, id); } });
          out.push({ label: 'Text...', act: () => this.open('compose', id) });
        }
        const pl = st.alive && G.phone.places(w).find((q) => q.label.startsWith(w.displayName(id) + "'s"));
        if (pl) out.push({ label: 'Show their place on Eagle Maps', act: () => { w.gps = pl; g.toast('Route set.', 'good'); G.scenes.remove(this); } });
        return out;
      }
      case 'effects': {
        // everything affecting your body: highs, withdrawal, hangovers, injuries, hunger... (hover for what it does)
        const NAMES = { charisma: 'Charisma', intimidate: 'Intimidation', meleeDmg: 'Melee damage', staminaRegen: 'Stamina recovery', speed: 'Speed', aim: 'Aim', stamina: 'Stamina', maxHp: 'Max health', luck: 'Luck', stealth: 'Stealth', perception: 'Perception' };
        const statTxt = (s) => (s ? Object.keys(s).map((k) => `${NAMES[k] || k} ${s[k] > 0 ? '+' : ''}${Math.abs(s[k]) < 1 ? Math.round(s[k] * 100) + '%' : s[k]}`).join(', ') : '');
        return G.effects.hudList(g.player).map((e) => {
          const left = e.t == null ? 'ongoing' : e.t > 1e9 ? 'permanent' : e.t >= 3600 ? `${Math.round(e.t / 3600)}h left` : e.t >= 60 ? `${Math.round(e.t / 60)} min left` : `${Math.ceil(e.t)}s left`;
          const st = statTxt(e.stats);
          return { label: e.name, sub: `${left}${e.bad ? ' · harmful' : ''} · hover for details`, color: e.color, desc: (e.desc || 'No details.') + (st ? `\n\nEffects: ${st}.` : ''), info: true };
        });
      }
      case 'news':
        return w.rumors.slice().reverse().slice(0, 20).map((r) => ({ label: r.text, sub: `Day ${r.day}`, info: true }));
      default: return G.PHONE_SCREENS[this.screen] ? G.PHONE_SCREENS[this.screen](this) : [];   // screens added by other modules
    }
  }

  update() {
    const I = G.input;
    if (this.screen === 'bct') {   // chatBCT: type freely, or pick a suggestion
      this.bctInput = this.bctInput || '';
      for (const ch of I.typed) if (this.bctInput.length < 70) this.bctInput += ch;
      if (I.pressed.has('Backspace')) { if (this.bctInput) this.bctInput = this.bctInput.slice(0, -1); else { this.back(); return; } }
      if (I.pressed.has('ArrowUp')) this.sel = Math.max(0, this.sel - 1);
      if (I.pressed.has('ArrowDown')) this.sel = Math.min(G.bct.SUGGEST.length - 1, this.sel + 1);
      if (I.pressed.has('Enter')) { G.bct.ask(this.game, this.bctInput.trim() || G.bct.SUGGEST[this.sel]); this.bctInput = ''; G.audio.play('select'); }
      if (I.pressed.has('Escape')) this.back();
      return;
    }
    if (I.wasPressed('cancel') || I.wasPressed('phone')) { G.audio.play('back'); if (I.wasPressed('phone')) G.scenes.remove(this); else this.back(); return; }
    if (this.screen === 'home') {
      if (I.wasPressed('left')) this.sel = (this.sel + APPS.length - 1) % APPS.length;
      if (I.wasPressed('right')) this.sel = (this.sel + 1) % APPS.length;
      if (I.wasPressed('up')) this.sel = (this.sel + APPS.length - 3) % APPS.length;
      if (I.wasPressed('down')) this.sel = (this.sel + 3) % APPS.length;
      if (I.wasPressed('confirm')) this.launch(APPS[this.sel][0]);
      return;
    }
    if (this.screen === 'clock') return;
    const rows = this.rows();
    if (I.wasPressed('up')) this.sel = Math.max(0, this.sel - 1);
    if (I.wasPressed('down')) this.sel = Math.min(rows.length - 1, this.sel + 1);
    if (I.wasPressed('confirm') && rows[this.sel] && rows[this.sel].act) { G.audio.play('confirm'); rows[this.sel].act(); }
  }
  launch(app) {
    G.audio.play('confirm');
    if (app === 'settings' || G.PHONE_APPS[app]) { G.phone.openApp(this.game, app); return; }
    this.open(app);
  }

  drawFrame(ctx, px, py, PW, PH, sx, sy, SW, SH) {
    const w = this.w;
    ctx.fillStyle = '#111114'; ctx.fillRect(px, py, PW, PH);
    ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, PW - 2, PH - 2); ctx.lineWidth = 1;
    const grad = ctx.createLinearGradient(0, sy, 0, sy + SH);
    grad.addColorStop(0, '#1e2a40'); grad.addColorStop(1, '#141820');
    ctx.fillStyle = grad; ctx.fillRect(sx, sy, SW, SH);
    U.text(ctx, w.timeString, sx + 4, py + 8, { size: 8 });
    U.text(ctx, '▮▮▮ 87%', sx + SW - 4, py + 8, { size: 7, align: 'right', color: '#c8c8d0' });
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(px + PW / 2 - 18, py + PH - 16, 36, 8);
  }

  // Someone's page in Relationships: who they are to you, how much they trust you, where they live, everything you
  // have learned about them. Returns where the action rows (Call, Text, Eagle Maps) start.
  drawRelation(ctx, sx, top, SW) {
    const w = this.w, id = this.data, st = w.npcs[id], d = G.NPCS[id];
    if (!st || !d) return top;
    const x = sx + 6, wd = SW - 12, t = G.rel.tier(st, id);
    let y = top;
    const meter = (label, v, lo, col, right) => {   // a labelled bar: v in lo..100
      U.text(ctx, label, x, y, { size: 7, color: '#8a90a0' });
      U.text(ctx, right, x + wd, y, { size: 7, align: 'right', color: col });
      const by = y + 10, mid = lo < 0 ? x + wd / 2 : x;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, by, wd, 4);
      ctx.fillStyle = col;
      const len = lo < 0 ? (wd / 2) * Math.abs(v) / 100 : wd * v / 100;
      ctx.fillRect(lo < 0 && v < 0 ? mid - len : mid, by, len, 4);
      if (lo < 0) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(mid - 0.5, by - 1, 1, 6); }
      y += 19;
    };
    U.text(ctx, `${d.name}${st.alive ? '' : ' (dead)'}`, x, y, { size: 8, color: '#c8ccd8' }); y += 12;
    meter('Relationship', t.v, -100, t.color, `${t.name} (${t.v})`);
    if (G.trust) { const tr = G.trust.of(w, id); meter('Trust', tr.v, 0, tr.v >= 65 ? '#7cd070' : tr.v >= 45 ? '#d8c060' : '#e08a6a', `${tr.name} (${tr.v})`); }
    // what you know: a line per fact, wrapped to the screen
    const facts = [];
    const fam = G.rel.familyOf && G.rel.familyOf(w, id); if (fam) facts.push(`Your ${fam.toLowerCase()}`);
    if (st.partner) facts.push('Your partner');
    if (st.companion) facts.push(st.compWait ? 'In your party (waiting for you)' : 'In your party');
    if (st.introduced || G.phone.isContact(w, id)) { const m = G.maps.cache[d.map], b = d.home && m && m.building(d.home); if (m) facts.push(`Lives in ${m.meta.name}${b ? ', ' + b.name.toLowerCase() : ''}`); }
    if (G.phone.isContact(w, id)) facts.push('You have their number');
    for (const f of G.rel.facts(id)) facts.push(f);
    if (!st.introduced) facts.push('You do not know their name yet');
    U.text(ctx, 'What you know', x, y, { size: 7, weight: 'bold', color: '#8ad8ff' }); y += 11;
    if (!facts.length) { U.text(ctx, 'Not much yet. Talk to them.', x, y, { size: 7, color: '#8a90a0' }); y += 10; }
    for (const f of facts) for (const [k, line] of U.wrap(ctx, f, wd - 6, 7).entries()) { U.text(ctx, (k ? '  ' : '· ') + line, x, y, { size: 7, color: '#e0e2ea' }); y += 9; }
    return y + 6;
  }

  render(ctx) {
    const topScene = G.scenes.top();
    if (topScene !== this && topScene.inPhone) return;   // a landscape app (journal, skills, settings) is showing
    U.dim(ctx, 0.45);
    const R = G.renderer, w = this.w, m = G.input.mouse;
    const PW = 196, PH = 340, px = (R.uiW - PW) / 2, py = (R.uiH - PH) / 2;
    const sx = px + 8, sy = py + 22, SW = PW - 16, SH = PH - 44;
    this.drawFrame(ctx, px, py, PW, PH, sx, sy, SW, SH);   // (the body, the screen and the status bar: js/game/phoneui.js draws the real one)
    const titles = { bct: 'chatBCT', home: '', maps: 'Eagle Maps', contacts: 'Contacts', contact: this.data ? w.displayName(this.data) : '', compose: 'New Message', messages: 'Messages', thread: this.data ? w.displayName(this.data) : '', lifelog: 'LifeLog', relations: 'Relationships', relation: this.data ? w.displayName(this.data) : '', effects: 'Effects', news: 'News', clock: 'Clock' };
    if (this.screen === 'home') {
      U.text(ctx, w.timeString, sx + SW / 2, sy + 14, { size: 22, align: 'center', weight: 'bold' });
      U.text(ctx, `Day ${w.day}`, sx + SW / 2, sy + 42, { size: 9, align: 'center', color: '#a8b0c0' });
      APPS.forEach(([id, label, col, glyph], i) => {
        const ax = sx + 14 + (i % 3) * 58, ay = sy + 70 + Math.floor(i / 3) * 62;
        const hover = U.inRect(m.ux, m.uy, ax, ay, 40, 40);
        if (hover && m.moved) this.sel = i;
        if (hover && m.pressed) this.launch(id);
        ctx.fillStyle = col; ctx.fillRect(ax, ay, 40, 40);
        if (this.sel === i) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(ax - 1, ay - 1, 42, 42); ctx.lineWidth = 1; }
        U.text(ctx, glyph, ax + 20, ay + 11, { size: 16, align: 'center', weight: 'bold' });
        U.text(ctx, label, ax + 20, ay + 44, { size: 7, align: 'center' });
        const unread = id === 'messages' ? G.phone.unread(w) : 0;
        if (unread) { ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(ax + 38, ay + 2, 6, 0, Math.PI * 2); ctx.fill(); U.text(ctx, String(unread), ax + 38, ay - 2, { size: 7, align: 'center' }); }
      });
      return;
    }
    U.text(ctx, '‹ ' + (titles[this.screen] || ''), sx + 6, sy + 5, { size: 10, weight: 'bold' });
    if (U.inRect(m.ux, m.uy, sx, sy, 60, 16) && m.pressed) { this.back(); return; }
    let top = sy + 22;
    if (this.screen === 'relation') top = this.drawRelation(ctx, sx, top, SW);   // (their page: who they are to you, what you know)
    if (this.screen === 'maps') {
      // the map you are on, with you and your destination
      const map = this.game.map, s = Math.min((SW - 8) / map.w, 110 / map.h);
      const mx = sx + (SW - map.w * s) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(map.minimap, mx, top, map.w * s, map.h * s);
      const p = this.game.player;
      ctx.fillStyle = Math.floor(G.loop.time * 3) % 2 ? '#ffffff' : '#ff4040';
      ctx.fillRect(mx + (p.x / 16) * s - 2, top + (p.y / 16) * s - 2, 4, 4);
      const r = G.phone.route(this.game);
      if (r) { ctx.fillStyle = '#40d0ff'; ctx.fillRect(mx + r.x * s - 2, top + r.y * s - 2, 4, 4); }
      U.text(ctx, map.meta.name, sx + SW / 2, top + map.h * s + 2, { size: 7, align: 'center', color: '#8ad8ff' });
      top += map.h * s + 14;
    }
    if (this.screen === 'bct') {
      // chat bubbles, newest at the bottom, above the suggestions and the input field
      // the suggestions scroll: a few rows at a time (mouse wheel, arrow keys), with a bar when there are more
      const SUG = G.bct.SUGGEST, VIS = Math.min(SUG.length, 5);
      this.sel = Math.min(this.sel, SUG.length - 1);
      this.bctScroll = G.util.clamp(this.bctScroll || 0, 0, Math.max(0, SUG.length - VIS));
      if (this.sel < this.bctScroll) this.bctScroll = this.sel; else if (this.sel >= this.bctScroll + VIS) this.bctScroll = this.sel - VIS + 1;
      const hist = G.bct.history(w), sugTop = sy + SH - 16 - VIS * 13 - 18;
      let by = sugTop - 4;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, top, SW, sugTop - top); ctx.clip();
      for (let i = hist.length - 1; i >= 0 && by > top; i--) {
        const msg = hist[i], mine = msg.who === 'you';
        const lines = U.wrap(ctx, msg.text, SW - 40, 8);
        const bh = lines.length * 10 + 6, bw = Math.min(SW - 30, Math.max(...lines.map((l) => U.measure(ctx, l, 8))) + 10);
        by -= bh + 4;
        const bx = mine ? sx + SW - bw - 4 : sx + 4;
        ctx.fillStyle = mine ? '#2a5aa8' : '#3a2a5a'; ctx.fillRect(bx, by, bw, bh);
        lines.forEach((l, k) => U.text(ctx, l, bx + 5, by + 3 + k * 10, { size: 8, color: mine ? '#e8f0ff' : '#f0e0ff', shadow: false }));
      }
      ctx.restore();
      if (m.wheel && U.inRect(m.ux, m.uy, sx, sugTop, SW, VIS * 13)) { this.bctScroll = G.util.clamp(this.bctScroll + Math.sign(m.wheel), 0, Math.max(0, SUG.length - VIS)); this.sel = G.util.clamp(this.sel, this.bctScroll, this.bctScroll + VIS - 1); }
      if (SUG.length > VIS) { const th = Math.max(8, (VIS / SUG.length) * VIS * 13), ty = sugTop + (this.bctScroll / (SUG.length - VIS)) * (VIS * 13 - th); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx + SW - 4, sugTop, 2, VIS * 13); ctx.fillStyle = 'rgba(200,170,255,0.7)'; ctx.fillRect(sx + SW - 4, ty, 2, th); }
      SUG.slice(this.bctScroll, this.bctScroll + VIS).forEach((sgt, j) => {
        const i = this.bctScroll + j, ry = sugTop + j * 13;
        const hover = U.inRect(m.ux, m.uy, sx + 4, ry, SW - 8, 12);
        if (hover && m.moved) this.sel = i;
        if (hover && m.pressed) G.bct.ask(this.game, sgt);
        ctx.fillStyle = this.sel === i ? 'rgba(122,58,216,0.45)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(sx + 4, ry, SW - 10, 12);
        U.text(ctx, sgt, sx + 8, ry + 2, { size: 7, color: '#d8c8ff' });
      });
      const iy = sy + SH - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 4, iy, SW - 8, 13);
      const caret = Math.floor(G.loop.time * 2) % 2 ? '|' : '';
      U.text(ctx, (this.bctInput ? this.bctInput : 'Type, or pick above.') + (this.bctInput ? caret : ''), sx + 8, iy + 2.5, { size: 7, color: this.bctInput ? '#ffffff' : '#8a90a0' });
      return;
    }
    if (this.screen === 'clock') {
      U.text(ctx, w.timeString, sx + SW / 2, sy + 80, { size: 30, align: 'center', weight: 'bold' });
      U.text(ctx, `Day ${w.day} · ${w.isNight() ? 'Night' : 'Day'}`, sx + SW / 2, sy + 120, { size: 10, align: 'center', color: '#a8b0c0' });
      return;
    }
    const rows = this.rows(), rowH = 24, visible = Math.floor((sy + SH - top - 4) / rowH);
    if (!rows.length && this.screen !== 'relation') U.text(ctx, 'Nothing here yet.', sx + SW / 2, top + 20, { size: 9, align: 'center', color: '#8a90a0' });
    if (G.input.mouse.wheel) this.sel = G.util.clamp(this.sel + G.input.mouse.wheel, 0, Math.max(0, rows.length - 1));
    const start = G.util.clamp(this.sel - visible + 2, 0, Math.max(0, rows.length - visible));
    let tip = null;
    rows.slice(start, start + visible).forEach((row, i) => {
      const idx = start + i, ry = top + i * rowH;
      const hover = U.inRect(m.ux, m.uy, sx + 2, ry, SW - 4, rowH - 2);
      if (hover && row.desc) tip = row;
      if (hover && m.moved) this.sel = idx;
      if (hover && m.pressed && row.act) { this.sel = idx; row.act(); }
      // a card per row: rounded, the selected one lifted with an accent bar
      const rx = sx + 3, rw = SW - 6, rh = rowH - 3, rad = 5;
      ctx.beginPath(); ctx.moveTo(rx + rad, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rad); ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rad); ctx.arcTo(rx, ry + rh, rx, ry, rad); ctx.arcTo(rx, ry, rx + rw, ry, rad); ctx.closePath();
      ctx.fillStyle = this.sel === idx ? 'rgba(120,160,255,0.26)' : hover ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'; ctx.fill();
      if (this.sel === idx) { ctx.fillStyle = this.accent || '#7aa8ff'; ctx.fillRect(rx, ry + 4, 2, rh - 8); }
      const label = U.measure(ctx, row.label, 8) > SW - 12 ? row.label.slice(0, 40) + '…' : row.label;
      U.text(ctx, label, sx + 6, ry + 3, { size: 8, color: row.color || '#e8e8f0' });
      if (row.sub) { let sub = row.sub; if (U.measure(ctx, sub, 7) > SW - 12 - (row.bar != null ? 46 : 0)) { while (sub.length > 1 && U.measure(ctx, sub + '…', 7) > SW - 12 - (row.bar != null ? 46 : 0)) sub = sub.slice(0, -1); sub += '…'; } U.text(ctx, sub, sx + 6, ry + 13, { size: 7, color: '#8a90a0' }); }   // (cut to fit the screen)
      if (row.bar != null) { const bw = 40, bx = sx + SW - bw - 6; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, ry + 15, bw, 4); ctx.fillStyle = row.bar >= 0 ? '#7cd070' : '#e05a4a'; ctx.fillRect(row.bar >= 0 ? bx + bw / 2 : bx + bw / 2 + (bw / 2) * row.bar, ry + 15, (bw / 2) * Math.abs(row.bar), 4); }
    });
    // hover a row that has details (LifeLog > Effects): what it is and what it does to you
    if (tip) {
      const tw = 150, lines = U.wrap(ctx, tip.desc.replace(/\n/g, ' '), tw - 10, 7), th = 16 + lines.length * 9;
      let tx = m.ux + 10, ty = m.uy + 8;
      if (tx + tw > G.renderer.uiW - 4) tx = m.ux - tw - 10;
      if (ty + th > G.renderer.uiH - 4) ty = G.renderer.uiH - th - 4;
      U.panel(ctx, tx, ty, tw, th);
      U.text(ctx, tip.label, tx + 5, ty + 4, { size: 8, weight: 'bold', color: tip.color || U.colors.borderLight });
      lines.forEach((l, k) => U.text(ctx, l, tx + 5, ty + 14 + k * 9, { size: 7 }));
    }
  }
}
G.PhoneScene = PhoneScene;
})();
