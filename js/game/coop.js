'use strict';
// Online co-op: play together over the network (LAN, or friends through port forwarding or a VPN like
// Tailscale / ZeroTier). Direct IP only, max 4 players, no accounts, no servers.
//   The host's save is the world and the host's game is the authority: time, NPCs, AI, combat results,
//   crimes, police, quests, economy, containers. Only the host's save is written; guests never write it.
//   Guests bring their own character (look, name, stats, skills, attributes, inventory, money, effects),
//   kept on their machine (rpgbase_coop_char_<name>) and saved between sessions.
//   Guests send their position and actions ~20 times a second; the host checks them (no teleporting),
//   applies them, and sends snapshots ~12 times a second (other players, NPCs, animals, cars on the guest's
//   map, the time) plus events (damage, items given, chat). Guests interpolate between snapshots.
//   Dialogue, shops and menus are local to whoever opened them. Friendly fire is off unless the host
//   turns it on. A downed player can be revived by another within 30 seconds. Sleeping and waiting need
//   everyone to agree (a vote). Text chat: [Y]. Single player is untouched when co-op is not used.
// Transport: the desktop host's Net.cs (TCP, newline JSON) through WebView2 messages; tests use a loopback.
(() => {
const VERSION = '2026.10.31';
const PORT = 7777;
const pick = (a) => G.rng.pick(a);
const gameScene = () => G.scenes && G.scenes.stack.find((s) => s instanceof G.GameScene);
const safe = (s) => { try { const o = JSON.parse(s); return o && typeof o === 'object' && typeof o.t === 'string' ? o : null; } catch (e) { return null; } };
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

// ---------------------------------------------------------------- transports
const DesktopTransport = {
  open(handler) {
    this.h = handler;
    if (this.bound || !(window.chrome && window.chrome.webview)) return;
    this.bound = true;
    window.chrome.webview.addEventListener('message', (e) => {
      const m = typeof e.data === 'string' ? e.data : '';
      if (!m.startsWith('net:') || !this.h) return;
      const rest = m.slice(4), c = rest.indexOf(':'), kind = c < 0 ? rest : rest.slice(0, c), arg = c < 0 ? '' : rest.slice(c + 1);
      if (kind === 'msg') { const c2 = arg.indexOf(':'); this.h.msg(+arg.slice(0, c2), arg.slice(c2 + 1)); }
      else if (kind === 'join') this.h.join(+arg);
      else if (kind === 'leave') this.h.leave(+arg);
      else if (this.h[kind]) this.h[kind](arg);
    });
  },
  host(port) { G.platform.post('net:host:' + port); },
  join(ip, port) { G.platform.post('net:join:' + ip + ':' + port); },
  send(obj) { G.platform.post('net:send:' + JSON.stringify(obj)); },
  sendTo(id, obj) { G.platform.post('net:sendto:' + id + ':' + JSON.stringify(obj)); },
  kick(id) { G.platform.post('net:kick:' + id); },
  stop() { G.platform.post('net:stop'); },
};
// two endpoints in one page (tests): the "guest" side is a plain object with its own handler
const Loopback = () => {
  const L = { guestH: null, hostH: null, id: 1 };
  L.hostSide = { open(h) { L.hostH = h; }, host() {}, send(obj) { if (L.guestH) L.guestH.msg(0, JSON.stringify(obj)); }, sendTo(id, obj) { if (L.guestH) L.guestH.msg(0, JSON.stringify(obj)); }, kick(id) { if (L.hostH) L.hostH.leave(id); }, stop() {} };
  L.guestSide = { open(h) { L.guestH = h; }, connect() { L.hostH.join(L.id); }, send(obj) { L.hostH.msg(L.id, JSON.stringify(obj)); }, close() { L.hostH.leave(L.id); } };
  return L;
};

// ---------------------------------------------------------------- the host
const C = G.coop = {
  VERSION, PORT,
  role: null, peers: {}, net: DesktopTransport, friendlyFire: false, chat: [], ips: [], myId: 0,
  active() { return !!this.role; },
  count() { return 1 + Object.keys(this.peers).length; },

  host(port = PORT, transport) {
    this.net = transport || DesktopTransport; this.role = 'host'; this.peers = {}; this.port = port;
    this.net.open(this.handler());
    this.net.host(port);
    this.say('Hosting on port ' + port + '. Friends join with your IP address (LAN, or port forwarding / Tailscale / ZeroTier).');
  },
  stop() {
    if (this.role === 'guest') this.saveChar();
    const g = gameScene();
    if (g) g.actors = g.actors.filter((a) => !a.coopId);
    try { this.net.stop && this.net.stop(); } catch (e) { /* gone */ }
    this.role = null; this.peers = {}; this.puppets = {};
  },
  handler() {
    return {
      join: (id) => { this.peers[id] = { id, joined: false, last: performance.now() }; },
      leave: (id) => this.dropPeer(id, 'left the game'),
      msg: (id, s) => { const m = safe(s); if (m) try { this.role === 'host' ? this.onHostMsg(id, m) : this.onGuestMsg(m); } catch (e) { G.reportError && G.reportError(e); } },
      hosting: () => {}, ip: (s) => { this.ips = String(s).split(',').filter(Boolean); },
      connected: () => this.sendHello(), error: (t) => this.netError(t), closed: () => this.netError('Connection closed.'),
    };
  },
  say(text, type = 'info') { const g = gameScene(); if (g) g.toast(text, type); },
  dropPeer(id, why) {
    const p = this.peers[id]; if (!p) return;
    const g = gameScene();
    if (g && p.actor) g.actors = g.actors.filter((a) => a !== p.actor);
    delete this.peers[id];
    if (p.name) this.say(`${p.name} ${why}.`, 'warn');
    this.broadcast({ t: 'left', id });
  },
  broadcast(obj, except) { for (const id in this.peers) if (+id !== except && this.peers[id].joined) this.net.sendTo(+id, obj); },

  onHostMsg(id, m) {
    const p = this.peers[id] || (this.peers[id] = { id, joined: false });
    p.last = performance.now();
    const g = gameScene(); if (!g) return;
    if (m.t === 'hello' && p.joined) return;   // (already in)
    if (m.t === 'hello') {
      if (m.v !== VERSION) { this.net.sendTo(id, { t: 'reject', reason: `Different game versions (host ${VERSION}, you ${String(m.v).slice(0, 20)}).` }); this.net.kick(id); delete this.peers[id]; return; }
      if (this.count() > 4) { this.net.sendTo(id, { t: 'reject', reason: 'The game is full (4 players).' }); this.net.kick(id); return; }
      const ch = m.char && typeof m.char === 'object' ? m.char : {};
      const a = this.remoteActor(id, ch, String(m.name || 'Guest').slice(0, 20));
      Object.assign(p, { joined: true, name: a.playerName, actor: a, map: g.map.id, char: ch });
      a.x = g.player.x + 12; a.y = g.player.y; a.tx = a.x; a.ty = a.y;
      g.actors.push(a);
      this.net.sendTo(id, { t: 'welcome', id, map: g.map.id, x: a.x, y: a.y, day: g.world.day, minutes: g.world.minutes, ff: this.friendlyFire, host: g.player.playerName || 'Host' });
      this.say(`${a.playerName} joined the game.`, 'good');
      this.broadcast({ t: 'chat', from: 'Game', text: `${a.playerName} joined.` }, id);
      return;
    }
    if (!p.joined) return;
    const a = p.actor;
    switch (m.t) {
      case 'input': {   // position and pose: checked (no teleporting), then applied
        const x = num(m.x, a.x), y = num(m.y, a.y), map = typeof m.map === 'string' && G.maps.get(m.map) ? m.map : p.map;
        const dt = Math.max(0.03, (performance.now() - (p.lastInput || 0)) / 1000); p.lastInput = performance.now();
        if (map === p.map && Math.hypot(x - a.tx, y - a.ty) > 420 * dt + 24) { this.net.sendTo(id, { t: 'correct', x: a.tx, y: a.ty }); return; }
        a.tx = x; a.ty = y; a.dir = num(m.dir, a.dir) & 3; a.moving = !!m.moving; a.swimming = !!m.swim; a.inVehicle = m.veh || null;
        if (map !== p.map) {   // changed map: off this scene, or onto it
          p.map = map; g.actors = g.actors.filter((q) => q !== a);
          if (map === g.map.id) { a.x = x; a.y = y; g.actors.push(a); }
        }
        break;
      }
      case 'attack': {
        if (p.map !== g.map.id || a.downed) break;
        a.aim = num(m.aim, a.aim || 0); a.dir = num(m.dir, a.dir) & 3;
        const w = a.weaponItem;
        if (w && w.gun) G.firearms.shoot(a, g, a.aim, w, { spread: w.spread || 0.05, dmg: w.dmg || 10 });
        else G.melee.start(a);
        break;
      }
      case 'take': {   // from a container (a corpse, a bag, a chest): the host's containers are the truth
        const c = g.world.containers[m.c], item = String(m.item || '');
        let ok = false;
        if (c && c.map === p.map && Math.hypot(c.x - a.x, c.y - a.y) < 40) { const e = c.items.find((x) => x[0] === item && x[1] > 0); if (e) { e[1]--; c.items = c.items.filter((x) => x[1] > 0); ok = true; g.refreshContainers(); } }
        this.net.sendTo(id, { t: ok ? 'grant' : 'deny', item, c: m.c });
        break;
      }
      case 'chat': { const text = String(m.text || '').slice(0, 140); if (!text) break; this.addChat(a.playerName, text); this.broadcast({ t: 'chat', from: a.playerName, text }, id); break; }
      case 'downed': a.downed = !!m.on; break;
      case 'revive': this.revive(m.target); break;
      case 'vote': this.onVote(id, m); break;
      case 'char': if (m.char && typeof m.char === 'object') { p.char = m.char; this.applyChar(a, m.char); } break;
      case 'bye': this.dropPeer(id, 'left the game'); break;
    }
  },
  // a guest, as the host's world sees them: a player body that only moves where the guest says
  remoteActor(id, ch, name) {
    let a;
    try { a = G.Player.from(Object.assign({ x: 0, y: 0, hp: 100, stamina: 100, gold: 0, inventory: { slots: [] }, equip: {}, skills: G.skills.fresh() }, ch)); } catch (e) { a = new G.Player(); }
    a.playerName = name; a.coopId = id; a.kind = 'remote'; a.remote = true;
    a.update = function (dt, scene) {
      if (this.downed) { this.moving = false; return; }
      const k = Math.min(1, dt * 12); this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k;
      this.baseUpdate(dt, scene.map);
    };
    a.canHit = (t) => t && t !== a && (C.friendlyFire || (t.kind !== 'player' && t.kind !== 'remote'));
    try { a.refreshSprite && a.refreshSprite(); } catch (e) { /* default look */ }
    return a;
  },
  applyChar(a, ch) { try { if (ch.look) a.look = ch.look; if (ch.equip) a.equip = Object.assign({}, ch.equip); a.refreshSprite && a.refreshSprite(); } catch (e) { /* keep */ } },
  // ~12 times a second: what each guest should see
  snapshot(g) {
    const players = [{ id: 0, name: g.player.playerName || 'Host', look: g.player.currentLook ? g.player.currentLook() : g.player.look, x: g.player.x, y: g.player.y, dir: g.player.dir, moving: g.player.moving, map: g.map.id, downed: !!g.player.downed }];
    for (const pid in this.peers) { const q = this.peers[pid]; if (q.joined) players.push({ id: +pid, name: q.name, look: q.actor.look, x: q.actor.x, y: q.actor.y, dir: q.actor.dir, moving: q.actor.moving, map: q.map, downed: !!q.actor.downed }); }
    for (const pid in this.peers) {
      const q = this.peers[pid]; if (!q.joined) continue;
      const snap = { t: 'snap', minutes: g.world.minutes, day: g.world.day, players: players.filter((x) => x.map === q.map && x.id !== +pid), hp: q.actor.hp };
      if (q.map === g.map.id) {
        snap.npcs = g.actors.filter((x) => (x.kind === 'npc' || x.kind === 'animal') && Math.abs(x.x - q.actor.x) < 520 && Math.abs(x.y - q.actor.y) < 400).slice(0, 60)
          .map((x) => ({ id: x.id || null, k: x.kind, s: x.species || null, look: x.transient || x.kind === 'npc' && !G.NPCS[x.id] ? x.look : undefined, x: Math.round(x.x), y: Math.round(x.y), d: x.dir, m: x.moving ? 1 : 0, dead: x.dead ? 1 : 0, hp: Math.round(x.hp || 0), say: x.bark && x.barkT > 0 ? x.bark : undefined }));
        snap.cars = (g.vehicles || []).filter((v) => Math.abs(v.x - q.actor.x) < 520).slice(0, 20).map((v) => ({ m: v.model, x: Math.round(v.x), y: Math.round(v.y), a: +v.angle.toFixed(2), s: Math.round(v.speed || 0) }));
      } else snap.offmap = true;   // the guest's map is not running here: their game places people by schedule
      this.net.sendTo(+pid, snap);
    }
  },
  // the host's world hurts a guest: tell them
  onDamage(target, dmg) { if (target.coopId) this.net.sendTo(target.coopId, { t: 'hurt', dmg: Math.round(dmg), hp: Math.round(target.hp) }); },
  addChat(from, text) {
    this.chat.push({ from, text, t: performance.now() }); if (this.chat.length > 30) this.chat.shift();
    const w = G.world; if (w) { G.phone.messages(w).push({ from: 'coop', to: 'player', text: `${from}: ${text}`, day: w.day, min: Math.floor(w.minutes), read: false }); }
  },
  sendChat(text) {
    text = String(text || '').trim().slice(0, 140); if (!text) return;
    const g = gameScene(), me = (g && g.player.playerName) || 'You';
    this.addChat(me, text);
    if (this.role === 'host') this.broadcast({ t: 'chat', from: me, text });
    else if (this.role === 'guest') this.net.send({ t: 'chat', text });
  },
  revive(target) {
    const g = gameScene(); if (!g) return;
    if (target === 0 || target === 'host') { if (g.player.downed) { g.player.downed = 0; g.player.hp = Math.round(g.player.maxHp * 0.3); this.say('Someone got you back on your feet.', 'good'); } return; }
    const q = this.peers[target]; if (q && q.actor.downed) { q.actor.downed = false; this.net.sendTo(+target, { t: 'revived' }); }
  },

  // ---------------------------------------------------------------- votes for sleeping and waiting
  requestSkip(hours, sleeping, then) {
    if (!this.active() || this.count() < 2) return then();
    if (this.role === 'guest') { this.net.send({ t: 'vote', ask: true, hours, sleeping }); this.say('Asked the others to skip time...', 'info'); return; }
    this.vote = { hours, sleeping, yes: new Set([0]), then, until: performance.now() + 20000 };
    this.broadcast({ t: 'vote', ask: true, hours, sleeping });
    this.say('Waiting for everyone to agree...', 'info');
  },
  onVote(id, m) {
    if (m.ask) { const g = gameScene(); if (g) this.requestSkip(num(m.hours, 1), !!m.sleeping, () => g.passTime(num(m.hours, 1), !!m.sleeping, true)); return; }
    const v = this.vote; if (!v) return;
    if (m.yes) v.yes.add(id); else { this.vote = null; this.say('Someone said no. Time keeps going.', 'warn'); this.broadcast({ t: 'chat', from: 'Game', text: 'Time skip refused.' }); return; }
    if (v.yes.size >= this.count()) { this.vote = null; v.then(); }
  },
  answerVote(yes) { if (this.role === 'guest') this.net.send({ t: 'vote', yes }); else if (this.role === 'host') this.onVote(0, { yes }); },

  // ---------------------------------------------------------------- the guest
  join(ip, port = PORT, char, transport) {
    this.net = transport || DesktopTransport; this.role = 'guest'; this.helloSent = false; this.puppets = {}; this.pendingChar = char;
    this.net.open(this.handler());
    if (this.net.join) this.net.join(ip, port); else if (this.net.connect) this.net.connect();
    if (transport && transport.connect) this.sendHello();
  },
  sendHello() {
    if (this.role !== 'guest' || this.helloSent) return;
    this.helloSent = true;
    const ch = this.pendingChar || {};
    this.net.send({ t: 'hello', v: VERSION, name: ch.name || 'Guest', char: ch });
  },
  netError(text) {
    if (!this.role) return;
    const wasGuest = this.role === 'guest';
    this.say('Co-op: ' + text, 'bad');
    if (wasGuest) { this.stop(); this.helloSent = false; G.scenes.replace(new G.MenuScene()); setTimeout(() => G.scenes.push(new G.MessageScene('Disconnected from the host.\n' + text, 'Co-op')), 0); }
  },
  onGuestMsg(m) {
    switch (m.t) {
      case 'reject': this.netError(String(m.reason || 'Refused.')); break;
      case 'welcome': this.startGuestGame(m); break;
      case 'snap': this.applySnap(m); break;
      case 'correct': { const g = gameScene(); if (g) { g.player.x = num(m.x, g.player.x); g.player.y = num(m.y, g.player.y); } break; }
      case 'grant': { const g = gameScene(); if (g && m.item) { g.player.inventory.add(String(m.item), 1); G.audio.play('pickup'); } break; }
      case 'deny': this.say('Someone else got it first.', 'warn'); break;
      case 'hurt': { const g = gameScene(); if (g) { g.player.hp = Math.min(g.player.hp, num(m.hp, g.player.hp)); g.player.hurtTimer = 0.3; G.audio.play('hurt'); if (g.player.hp <= 0) g.player.die(null, g); } break; }
      case 'chat': this.addChat(String(m.from || '?').slice(0, 20), String(m.text || '').slice(0, 140)); break;
      case 'left': { const g = gameScene(), pz = this.puppets['p' + m.id]; if (g && pz) g.actors = g.actors.filter((a) => a !== pz); delete this.puppets['p' + m.id]; break; }
      case 'vote': if (m.ask) G.scenes.push(new G.ConfirmScene(`Someone wants to ${m.sleeping ? 'sleep' : 'wait'} ${num(m.hours, 1)} hour(s). Agree?`, () => C.answerVote(true), () => C.answerVote(false))); break;
      case 'revived': { const g = gameScene(); if (g) { g.player.downed = 0; g.player.hp = Math.round(g.player.maxHp * 0.3); this.say('A friend got you back on your feet.', 'good'); } break; }
    }
  },
  startGuestGame(m) {
    this.myId = m.id; this.friendlyFire = !!m.ff;
    const ch = this.pendingChar || {};
    // a fresh local game (never saved: saves are blocked while you are a guest) with your own character in it
    const g = new G.GameScene({});
    g.coopGuest = true;
    try { g.player = G.Player.from(Object.assign({ x: 0, y: 0, hp: 100, stamina: 100, gold: 0, inventory: { slots: [] } }, ch)); g.player.playerName = ch.name || 'Guest'; G.player = g.player; if (g.player.refreshSprite) g.player.refreshSprite(); if (g.player.refreshStats) g.player.refreshStats(); } catch (e) { /* keep the default body */ }
    g.loadMap(typeof m.map === 'string' && G.maps.get(m.map) ? m.map : 'rural', null, { x: num(m.x, g.player.x), y: num(m.y, g.player.y) });
    G.world.day = num(m.day, G.world.day); G.world.minutes = num(m.minutes, G.world.minutes);
    G.scenes.replace(g);
    this.say(`Joined ${String(m.host || 'the host').slice(0, 20)}'s world.`, 'good');
  },
  applySnap(m) {
    const g = gameScene(); if (!g || !g.coopGuest) return;
    g.world.minutes = num(m.minutes, g.world.minutes); g.world.day = num(m.day, g.world.day);
    const seen = new Set();
    for (const pl of m.players || []) {
      const key = 'p' + pl.id; seen.add(key);
      let a = this.puppets[key];
      if (!a) { a = this.remoteActor(pl.id, { look: pl.look }, String(pl.name || 'Player').slice(0, 20)); this.puppets[key] = a; g.actors.push(a); }
      a.tx = num(pl.x, a.x); a.ty = num(pl.y, a.y); a.dir = num(pl.dir, 0) & 3; a.moving = !!pl.moving; a.downed = !!pl.downed;
      if (!g.actors.includes(a)) g.actors.push(a);
    }
    for (const k in this.puppets) if (k[0] === 'p' && !seen.has(k)) g.actors = g.actors.filter((a) => a !== this.puppets[k]);
    if (m.offmap || !m.npcs) return;
    // NPCs and animals are puppets: they stand where the host says
    const byId = new Map(g.actors.filter((a) => a.kind === 'npc' || a.kind === 'animal').map((a) => [a.id || a._coopKey, a]));
    const keep = new Set();
    for (const n of m.npcs) {
      const key = n.id || `${n.k}${n.s}${Math.round(n.x / 32)}`;
      let a = byId.get(key);
      if (!a && n.k === 'npc' && n.id && g.world.npcs[n.id] && G.NPCS[n.id]) { a = new G.NPC(n.id, g.world.npcs[n.id]); g.actors.push(a); }
      if (!a && n.k === 'animal' && n.s && G.ANIMALS[n.s]) { a = new G.Animal(n.s, n.x, n.y, 'coop', {}); a._coopKey = key; g.actors.push(a); }
      if (!a) continue;
      keep.add(a); a.coopPuppet = true; a.tx = n.x; a.ty = n.y; a.dir = n.d & 3; a.moving = !!n.m; a.hp = n.hp;
      if (a.x == null || Math.hypot(a.x - n.x, a.y - n.y) > 120) { a.x = n.x; a.y = n.y; }
      if (n.dead && !a.dead) { a.dead = true; a.st && (a.st.alive = false); }
      if (n.say && a.say && a.bark !== n.say) a.say(n.say, 2.5);
    }
    g.actors = g.actors.filter((a) => !(a.coopPuppet && !keep.has(a)));
    // cars
    g.vehicles = g.vehicles || [];
    g.vehicles = g.vehicles.filter((v) => !v.coopPuppet);
    for (const c of m.cars || []) if (G.vehicles.MODELS[c.m]) { const v = new G.Vehicle({ model: c.m, x: c.x, y: c.y, angle: c.a }); v.speed = c.s; v.coopPuppet = true; g.vehicles.push(v); }
  },
  // the guest's own state, ~20 times a second
  tickGuest(g) {
    const p = g.player;
    this.net.send({ t: 'input', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, dir: p.dir, moving: !!p.moving, map: g.map.id, swim: !!p.swimming, veh: p.vehicle ? p.vehicle.model : null });
    if ((this.charT = (this.charT || 0) + 1) % 200 === 0) this.saveChar();
  },
  // the guest's character, saved on their own machine, apart from single-player saves
  charKey(name) { return 'rpgbase_coop_char_' + String(name || 'guest').replace(/[^a-z0-9_-]/gi, '_').slice(0, 24); },
  saveChar() { const g = gameScene(); if (!g || !g.coopGuest) return; const d = g.player.serialize(); d.name = g.player.playerName; G.store.set(this.charKey(d.name), d); },
  chars() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('rpgbase_coop_char_')) { const d = G.store.get(k); if (d) out.push({ label: `${d.name || 'Guest'} (co-op)`, char: d }); } } } catch (e) { /* none */ }
    for (const slot of ['auto', 'quick', 1, 2, 3, 4, 5, 6]) { const s = G.saves.read(slot); if (s && s.player) out.push({ label: `${s.player.name || 'You'} (from ${G.saves.label(slot)})`, char: Object.assign({}, s.player) }); }
    return out;
  },
};

// ---------------------------------------------------------------- hooks into the game
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) {
  const r = _gu.call(this, dt);
  if (!C.role) return r;
  try {
    this._coopT = (this._coopT || 0) + dt;
    if (C.role === 'host' && this._coopT >= 0.08) { this._coopT = 0; C.snapshot(this); }
    if (C.role === 'guest' && this._coopT >= 0.05) { this._coopT = 0; C.tickGuest(this); }
    if (this.player.downed > 0 && (this.player.downed -= dt) <= 0) { this.player.downed = 0; this.player.hp = 0; C._realDie.call(this.player, null, this); }
    if (G.input.pressed.has('KeyY') && G.scenes.top() === this) G.scenes.push(new ChatScene());
  } catch (e) { G.reportError && G.reportError(e); }
  return r;
};
// guests: NPCs and animals are puppets (no AI here); damage the guest deals is decided by the host
const NP = G.NPC.prototype, _nu = NP.update, AN = G.Animal.prototype, _au = AN.update;
const puppet = function (dt, scene) { if (this.dead) return; const k = Math.min(1, dt * 10); if (this.tx != null) { this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k; } this.baseUpdate(dt, scene.map); if (this.barkT > 0 && (this.barkT -= dt) <= 0) this.bark = null; };
NP.update = function (dt, scene) { if (C.role === 'guest' && scene.coopGuest) return puppet.call(this, dt, scene); return _nu.call(this, dt, scene); };
AN.update = function (dt, scene) { if (C.role === 'guest' && scene.coopGuest) return puppet.call(this, dt, scene); return _au.call(this, dt, scene); };
const _dmg = G.combat.damage;
G.combat.damage = function (target, dmg, source, scene, o) {
  if (C.role === 'guest' && scene && scene.coopGuest && target && target !== scene.player) return 0;   // the host decides
  if (C.role === 'host' && target && target.coopId) { target.hp = Math.max(0, target.hp - dmg); target.hurtTimer = 0.25; C.onDamage(target, dmg); return dmg; }
  return _dmg.apply(this, arguments);
};
// guest attacks go to the host too
const PL = G.Player.prototype;
if (G.melee) { const _ms = G.melee.start; G.melee.start = function (a) { const r = _ms.apply(this, arguments); const g = gameScene(); if (r && C.role === 'guest' && g && a === g.player) C.net.send({ t: 'attack', aim: a.aim || 0, dir: a.dir }); return r; }; }
const _pf = G.firearms.playerFire;
G.firearms.playerFire = function (p, scene, angle) { const r = _pf.apply(this, arguments); if (C.role === 'guest' && scene.coopGuest) C.net.send({ t: 'attack', aim: angle, dir: p.dir }); return r; };
// guests: crimes and the world's consequences are the host's business
const _rc = GS.reportCrime;
GS.reportCrime = function () { if (C.role === 'guest' && this.coopGuest) return false; return _rc.apply(this, arguments); };
// downed, not dead (in co-op): 30 seconds for a friend to revive you
C._realDie = PL.die;
PL.die = function (source, scene) {
  if (C.active() && C.count() > 1 && !this.downed && this === scene.player) { this.downed = 30; this.hp = 1; scene.toast('You are down! A friend can revive you in 30 seconds.', 'bad'); if (C.role === 'guest') C.net.send({ t: 'downed', on: true }); return; }
  return C._realDie.call(this, source, scene);
};
const _pu = PL.update;
PL.update = function (dt, scene) { if (this.downed > 0 && this === scene.player) { this.moving = false; return; } return _pu.call(this, dt, scene); };
// [E] on a downed friend: revive them
const _fi = GS.findInteraction;
GS.findInteraction = function () {
  if (C.active()) {
    const p = this.player;
    for (const a of this.actors) if (a.remote && a.downed && Math.hypot(a.x - p.x, a.y - p.y) < 22) return { type: 'revive', ref: a, label: `Revive ${a.playerName}` };
  }
  return _fi.apply(this, arguments);
};
const _int = GS.interact;
if (_int) GS.interact = function (t) {
  t = t || this.promptTarget;
  if (t && t.type === 'revive') { if (C.role === 'host') C.revive(t.ref.coopId); else C.net.send({ t: 'revive', target: t.ref.coopId }); G.audio.play('confirm'); return; }
  return _int.apply(this, arguments);
};
// sleeping and waiting: everyone has to agree
const _pt = GS.passTime;
GS.passTime = function (hours, sleeping, agreed) {
  if (!C.active() || C.count() < 2 || agreed) return _pt.call(this, hours, sleeping);
  C.requestSkip(hours, sleeping, () => { _pt.call(this, hours, sleeping); });
};
// the host's save never holds a guest: remote bodies are not part of the world
const _write = G.saves.write;
G.saves.write = function (slot, scene) {
  if (C.role === 'guest') { if (scene && scene.coopGuest) C.saveChar(); return; }   // guests never write a world (or their own single-player saves)
  const keep = scene ? scene.actors : null;
  if (scene) scene.actors = scene.actors.filter((a) => !a.coopId && !a.coopPuppet);
  try { return _write.call(this, slot, scene); } finally { if (scene && keep) scene.actors = keep; }
};

// ---------------------------------------------------------------- chat
class ChatScene {
  constructor() { this.transparent = true; this.text = ''; G.input.typed.length = 0; }
  update() {
    const I = G.input;
    for (const ch of I.typed) if (this.text.length < 140) this.text += ch;
    if (I.pressed.has('Backspace')) this.text = this.text.slice(0, -1);
    if (I.pressed.has('Enter')) { C.sendChat(this.text); G.scenes.remove(this); }
    if (I.pressed.has('Escape')) G.scenes.remove(this);
  }
  render(ctx) {
    const R = G.renderer, U = G.ui;
    ctx.fillStyle = 'rgba(14,12,20,0.85)'; ctx.fillRect(8, R.uiH - 40, 300, 14);
    U.text(ctx, '> ' + this.text + (Math.floor(G.loop.time * 2) % 2 ? '|' : ''), 12, R.uiH - 38, { size: 8, color: '#e8f4ff' });
  }
}
// the chat box and the host's address, small, bottom left / top
const H = G.hud, _hd = H.draw;
H.draw = function (ctx, scene) {
  _hd.call(this, ctx, scene);
  if (!C.role) return;
  const R = G.renderer, U = G.ui, now = performance.now();
  const recent = C.chat.filter((c) => now - c.t < 12000).slice(-5);
  recent.forEach((c, i) => { const y = R.uiH - 56 - (recent.length - 1 - i) * 10; ctx.globalAlpha = Math.min(1, (12000 - (now - c.t)) / 1500); ctx.fillStyle = 'rgba(14,12,20,0.55)'; ctx.fillRect(8, y - 1, U.measure(ctx, `${c.from}: ${c.text}`, 7) + 8, 10); U.text(ctx, `${c.from}: ${c.text}`, 12, y, { size: 7, color: '#d8e8ff' }); ctx.globalAlpha = 1; });
  if (C.role === 'host') U.text(ctx, `Co-op host · ${C.ips.join(' / ') || 'your IP'}:${C.port} · ${C.count()}/4 players`, R.uiW / 2, R.uiH - 10, { size: 7, align: 'center', color: '#8ad8ff' });
  else U.text(ctx, `Co-op · ${C.count()} players`, R.uiW / 2, R.uiH - 10, { size: 7, align: 'center', color: '#8ad8ff' });
  // name tags over the other players
  for (const a of scene.actors) if (a.remote) { const s = R.worldToUI(a.x, a.y - 26); U.text(ctx, a.playerName + (a.downed ? ' (down!)' : ''), s.x, s.y, { size: 7, align: 'center', color: a.downed ? '#ff8a7a' : '#8ad8ff' }); }
};
// the minimap shows the other players
const _mm = G.TileMap.prototype.renderMinimap;
void _mm;

// ---------------------------------------------------------------- menus: Co-op > Host a game / Join a game
class CoopMenu {
  constructor() { this.transparent = true; this.sel = 0; }
  options() {
    const saves = ['auto', 'quick', 1, 2, 3, 4, 5, 6].filter((s) => G.saves.read(s));
    return [
      { label: 'Host a game', act: () => {
        if (!saves.length) { G.scenes.push(new G.MessageScene('You need a saved game to host: start one in single player first.', 'Co-op')); return; }
        G.scenes.push(new G.ChoiceScene('Host: pick a save', 'Your save is the world your friends join.', saves.map((s) => ({ label: `${G.saves.label(s)} · ${(G.saves.meta(s) || {}).mapName || ''} · Day ${(G.saves.meta(s) || {}).day || '?'}`, fn: () => { G.scenes.replace(new G.GameScene({ save: G.saves.read(s) })); C.host(PORT); } }))));
      } },
      { label: 'Join a game', act: () => G.scenes.push(new IpScene()) },
      { label: `Friendly fire: ${C.friendlyFire ? 'On' : 'Off'} (host)`, act: () => { C.friendlyFire = !C.friendlyFire; } },
      { label: 'How do friends connect?', act: () => G.scenes.push(new G.MessageScene('On the same network: the host\'s local IP (shown on screen while hosting), port 7777.\nOver the internet: the host forwards TCP port 7777 on their router, or everyone joins the same Tailscale / ZeroTier network and uses that IP.\nEveryone needs the same game version.', 'Co-op')) },
      { label: 'Back', act: () => G.scenes.remove(this) },
    ];
  }
  update() { const o = this.options(), r = G.ui.nav(this, 'sel', o.length); if (r === 'confirm') o[this.sel].act(); if (r === 'cancel') G.scenes.remove(this); }
  render(ctx) {
    const U = G.ui, R = G.renderer, o = this.options();
    U.dim(ctx, 0.5);
    const w = 280, h = 40 + o.length * 22, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.panel(ctx, x, y, w, h, { title: 'Co-op', titleSize: 12 });
    const i = U.menu(ctx, this, o.map((q) => ({ label: q.label })), x + 14, y + 30, w - 28, 18, 4);
    if (i >= 0) o[i].act();
  }
}
class IpScene {
  constructor() { this.transparent = true; this.text = G.store.get('rpgbase_coop_lastip', '') || ''; G.input.typed.length = 0; }
  update() {
    const I = G.input;
    for (const ch of I.typed) if (/[0-9a-z.:\-]/i.test(ch) && this.text.length < 60) this.text += ch;
    if (I.pressed.has('Backspace')) this.text = this.text.slice(0, -1);
    if (I.pressed.has('Escape')) G.scenes.remove(this);
    if (I.pressed.has('Enter') && this.text) {
      G.store.set('rpgbase_coop_lastip', this.text);
      const [ip, port] = this.text.includes(':') ? this.text.split(':') : [this.text, PORT];
      const chars = C.chars();
      G.scenes.remove(this);
      G.scenes.push(new G.ChoiceScene('Join with which character?', 'Only the character comes along: look, skills, things, money.', chars.map((c) => ({ label: c.label, fn: () => C.join(ip, +port || PORT, c.char) }))
        .concat([{ label: 'Create a new character', fn: () => { G.coopCreate = { ip, port: +port || PORT }; G.scenes.replace(new G.CharacterCreatorScene()); } }])));
    }
  }
  render(ctx) {
    const U = G.ui, R = G.renderer, w = 300, h = 70, x = (R.uiW - w) / 2, y = (R.uiH - h) / 2;
    U.dim(ctx, 0.5); U.panel(ctx, x, y, w, h, { title: 'Join a game', titleSize: 12 });
    U.text(ctx, 'The host\'s IP (and :port, default 7777):', x + 12, y + 26, { size: 8, color: U.colors.dim });
    ctx.fillStyle = 'rgba(40,50,70,0.95)'; ctx.fillRect(x + 12, y + 40, w - 24, 16);
    U.text(ctx, this.text + (Math.floor(G.loop.time * 2) % 2 ? '|' : ''), x + 16, y + 43, { size: 9, color: '#e8f4ff' });
  }
}
G.CoopMenu = CoopMenu;
// a character made for co-op goes to the host instead of starting a single-player game
const _gsInit = G.GameScene;
const MP = G.MenuScene.prototype, _build = MP.build;
MP.build = function () { _build.call(this); const at = this.items.findIndex((i) => i.label === 'Settings'); this.items.splice(at < 0 ? 3 : at, 0, { label: 'Co-op', act: () => G.scenes.push(new CoopMenu()) }); };
const CCP = G.CharacterCreatorScene.prototype, _act = CCP.act;
CCP.act = function (key) {
  if (key === '_start' && G.coopCreate && G.pendingAttrs && !G.scenes.stack.some((s) => s instanceof G.StartSkillsScene)) {
    // build the character (no world is started or saved), then send it along to the host
    const lk = this.look(), p = new G.Player();
    p.playerName = this.editor.v.name.trim();
    p.look = { body: lk.body, race: lk.race, skin: lk.skin, eyes: lk.eyes, hair: lk.hair, hairStyle: lk.hairStyle, facial: lk.facial, shoes: lk.shoes };
    p.inventory.add(G.clothId('top', lk.top, lk.shirt, lk.shirt2)); p.equipFromSlot(0);
    p.inventory.add(G.clothId('bottom', lk.bottom, lk.pants)); p.equipFromSlot(0);
    p.skills.attrs = G.pendingAttrs; p.refreshSprite(); p.hp = p.maxHp;
    const ch = p.serialize(); ch.name = p.playerName;
    G.pendingAttrs = null; const target = G.coopCreate; G.coopCreate = null;
    C.join(target.ip, target.port, ch);
    return;
  }
  return _act.call(this, key);
};
G.coop.Loopback = Loopback;
})();
