'use strict';
// Dreams you can walk around in. Each dream is a place made up on the spot from the dream's setting (a
// school, a beach, a street, a forest, a mall, a hospital...), with rooms that do not quite make sense,
// things from other places where they do not belong, faceless people drifting about, and somewhere a
// glowing door: the way out. In nightmares, shadows come for you.
//   Your pockets in a dream are not your pockets: you start with a few strange things and find more lying
//   around (made up for this dream: a key that hums, a photo of nobody, cake that tastes like childhood...).
//   [E] picks things up, [I] opens your dream pockets, [1]-[8] use something, [Esc] forces you awake.
//   Nothing you carry here comes back with you, and your real things are safe in the real world.
(() => {
const R = () => G.renderer, U = () => G.ui, pick = (a) => G.rng.pick(a);
const ADJ = ['Humming', 'Warm', 'Weightless', 'Familiar', 'Upside-Down', 'Whispering', 'Endless', 'Paper', 'Glowing', 'Melting', 'Silent', 'Borrowed', 'Your Own', 'Tiny', 'Enormous', 'Wet'];
const KINDS = [
  { noun: 'Key', icon: 'key', use: 'key', text: 'It fits a lock you have not found yet.' },
  { noun: 'Photo', icon: 'letter', use: 'look', text: (n) => `A photo of ${n}. You have never seen this place, but you were there.` },
  { noun: 'Cake', icon: 'bread', use: 'eat', text: 'It tastes exactly like your childhood.' },
  { noun: 'Watch', icon: 'watch', use: 'time', text: 'It shows a time that does not exist.' },
  { noun: 'Phone', icon: 'phone', use: 'call', text: 'You dial. It rings in your own pocket.' },
  { noun: 'Lantern', icon: 'flashlight', use: 'light', text: 'Light spills out. The shadows step back.' },
  { noun: 'Feather', icon: 'feather', use: 'fly', text: 'You are lighter. Your feet barely touch the ground.' },
  { noun: 'Tooth', icon: 'gem', use: 'look', text: 'It is yours. You feel the gap with your tongue.' },
  { noun: 'Letter', icon: 'letter', use: 'read', text: 'The words rearrange themselves as you read.' },
  { noun: 'Coin', icon: 'gem', use: 'look', text: 'Both sides are heads. Both heads are you.' },
  { noun: 'Mirror', icon: 'ring', use: 'mirror', text: 'Your reflection is a little late.' },
  { noun: 'Seed', icon: 'herb', use: 'plant', text: 'You drop it. A tree grows in seconds, then is gone.' },
];
let seq = 0;
const ITEMS = {};
const makeItem = (k) => { const kind = k || pick(KINDS), id = 'dream:' + (++seq); ITEMS[id] = { id, name: `${pick(ADJ)} ${kind.noun}`, kind, icon: kind.icon }; return id; };

class DreamWorldScene {
  constructor(game, dreamScene, onDone) {
    this.game = game; this.ds = dreamScene; this.onDone = onDone; this.t = 0;
    const sc = dreamScene.scene, set = sc.set || 'void';
    this.nightmare = dreamScene.dream.mood === 'nightmare';
    this.limit = 75 + Math.random() * 45;
    this.map = this.build(set, sc.theme);
    this.me = { x: this.map.start.x * 16 + 8, y: this.map.start.y * 16 + 12, dir: 0, moving: false, anim: 0, speed: 70, fly: 0, light: 0 };
    this.sheet = (sc.body && G.assets.character(sc.body.look)) || game.player.sheet;
    // dream pockets: a few strange things to start with
    this.inv = [makeItem(), makeItem()];
    if (Math.random() < 0.5) this.inv.push(makeItem(KINDS[0]));
    this.figures = [];
    for (let i = 0; i < 5 + G.rng.int(0, 4); i++) {
      const look = G.look('dreamfig' + Math.floor(Math.random() * 1e6));
      if (Math.random() < 0.6) { look.eyes = look.skin; }   // no face
      const p = this.free();
      this.figures.push({ x: p.x * 16 + 8, y: p.y * 16 + 12, sheet: G.assets.character(look), vx: 0, vy: 0, t: 0, shadow: false });
    }
    if (this.nightmare) for (let i = 0; i < 2 + G.rng.int(0, 2); i++) { const p = this.free(); this.figures.push({ x: p.x * 16 + 8, y: p.y * 16 + 12, sheet: G.assets.character(Object.assign(G.look('shadow' + i), { skin: '#0a080c', hair: '#0a080c', eyes: '#d02030', shirt: '#0a080c', shirt2: '#0a080c', pants: '#0a080c', shoes: '#0a080c' })), vx: 0, vy: 0, t: 0, shadow: true }); }
    this.msg = G.rng.pick((dreamScene.scene.beats || ['...'])); this.msgT = 5;
    this.showInv = false;
  }
  free() { for (let k = 0; k < 200; k++) { const x = G.rng.int(2, this.map.w - 3), y = G.rng.int(2, this.map.h - 3); if (!this.map.isSolidTile(x, y)) return { x, y }; } return this.map.start; }
  build(set, theme) {
    const S = G.dreams.SETTINGS || {}, s = S[set] || { ground: 'grass', props: ['pine0', 'oak0'] };
    const W = 44, H = 34, m = new G.TileMap('dream', W, H, G.T[s.ground] != null ? G.T[s.ground] : G.T.grass);
    m.meta = { name: 'A dream', indoor: !!s.wall, darkness: 0 };
    const r = new G.RNG('dream' + Math.random());
    if (s.wall) {   // rooms that do not quite make sense
      const wall = G.T[s.wall];
      for (let x = 0; x < W; x++) { m.set(x, 0, wall); m.set(x, H - 1, wall); }
      for (let y = 0; y < H; y++) { m.set(0, y, wall); m.set(W - 1, y, wall); }
      for (let i = 0; i < 7; i++) {
        const rx = r.int(2, W - 12), ry = r.int(2, H - 10), rw = r.int(6, 12), rh = r.int(5, 9);
        for (let x = rx; x < rx + rw; x++) { m.set(x, ry, wall); m.set(x, ry + rh, wall); }
        for (let y = ry; y <= ry + rh; y++) { m.set(rx, y, wall); m.set(rx + rw, y, wall); }
        for (let g = 0; g < 3; g++) { const side = r.int(0, 3); const gx = side < 2 ? r.int(rx + 1, rx + rw - 1) : side === 2 ? rx : rx + rw, gy = side >= 2 ? r.int(ry + 1, ry + rh - 1) : side === 0 ? ry : ry + rh; m.set(gx, gy, G.T[s.ground] || G.T.tilefloor); }
      }
    }
    if (s.water) for (let i = 0; i < 3; i++) MB().ellipse(m, r.int(5, W - 5), r.int(4, H - 4), r.int(3, 6), r.int(2, 4), G.T[s.water]);
    const all = Object.keys(G.DECOR).filter((k) => !G.DECOR[k].flat && G.assets.sprites[G.DECOR[k].sprite] && !/stairs|elevator|door|cell_bars|shopsign/.test(k));
    for (let i = 0; i < 46; i++) {
      const type = r.chance(0.18) ? r.pick(all) : r.pick(s.props && s.props.length ? s.props : ['plant']);   // things where they do not belong
      const x = r.int(2, W - 3), y = r.int(2, H - 3);
      if (G.DECOR[type] && !m.isSolidTile(x, y) && m.isFree(x, y)) { m.addDecor(type, x, y); m.markOccupied(x, y); }
    }
    m.start = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
    m.decor = m.decor.filter((d) => Math.abs(d.tx - m.start.x) > 2 || Math.abs(d.ty - m.start.y) > 2);
    if (m.isSolidTile(m.start.x, m.start.y)) m.set(m.start.x, m.start.y, G.T[s.ground] || G.T.grass);
    m.finalize();
    // the way out: far from where you start; locked (needs a key) half the time
    let ex = null; for (let k = 0; k < 300 && !ex; k++) { const x = r.int(2, W - 3), y = r.int(2, H - 3); if (!m.isSolidTile(x, y) && Math.hypot(x - m.start.x, y - m.start.y) > 14) ex = { x, y }; }
    m.exit = ex || { x: 2, y: 2 }; m.exitLocked = r.chance(0.5);
    // things lying around
    m.loose = [];
    for (let i = 0; i < 6; i++) { const p = this.freeOn(m); m.loose.push({ x: p.x * 16 + 8, y: p.y * 16 + 10, id: makeItem(m.exitLocked && i === 0 ? KINDS[0] : null) }); }
    return m;
  }
  freeOn(m) { for (let k = 0; k < 200; k++) { const x = G.rng.int(2, m.w - 3), y = G.rng.int(2, m.h - 3); if (!m.isSolidTile(x, y)) return { x, y }; } return m.start; }
  say(t) { this.msg = t; this.msgT = 4; }
  use(i) {
    const id = this.inv[i]; if (!id) return;
    const it = ITEMS[id], k = it.kind, txt = typeof k.text === 'function' ? k.text(pick(['your old street', 'a house by the sea', 'a party you never went to'])) : k.text;
    if (k.use === 'key') { const d = Math.hypot(this.me.x - (this.map.exit.x * 16 + 8), this.me.y - (this.map.exit.y * 16 + 12)); if (d < 40) { this.map.exitLocked = false; this.say('The key turns. The door is open.'); } else this.say(txt); return; }
    if (k.use === 'eat') { this.inv.splice(i, 1); this.say(txt); return; }
    if (k.use === 'fly') { this.me.fly = 20; this.say(txt); return; }
    if (k.use === 'light') { this.me.light = 25; this.say(txt); return; }
    if (k.use === 'time') { this.limit += 20; this.say(txt + ' Time stretches.'); return; }
    this.say(txt);
  }
  end(text, good) {
    G.scenes.remove(this);
    if (this.onDone) this.onDone(text, good);
  }
  update(dt) {
    const I = G.input, me = this.me, m = this.map;
    this.t += dt; this.msgT -= dt;
    if (I.wasPressed('cancel')) { this.end('You force yourself awake.', false); return; }
    if (I.wasPressed('inventory') || I.pressed.has('KeyI')) this.showInv = !this.showInv;
    for (let k = 1; k <= 8; k++) if (I.pressed.has('Digit' + k)) this.use(k - 1);
    if (me.fly > 0) me.fly -= dt; if (me.light > 0) me.light -= dt;
    let mx = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0), my = (I.isDown('down') ? 1 : 0) - (I.isDown('up') ? 1 : 0);
    const n = Math.hypot(mx, my) || 1, sp = (me.fly > 0 ? 1.6 : 1) * me.speed * (this.nightmare ? 0.9 : 1);
    me.moving = !!(mx || my);
    if (mx) me.dir = mx < 0 ? 1 : 2; else if (my) me.dir = my < 0 ? 3 : 0;
    const nx = me.x + (mx / n) * sp * dt, ny = me.y + (my / n) * sp * dt;
    if (me.fly > 0 || !m.rectCollides(nx - 5, me.y - 6, 10, 6)) me.x = G.util.clamp(nx, 8, m.pw - 8);
    if (me.fly > 0 || !m.rectCollides(me.x - 5, ny - 6, 10, 6)) me.y = G.util.clamp(ny, 10, m.ph - 2);
    me.anim += me.moving ? dt : 0;
    // pick things up
    if (I.wasPressed('interact')) {
      const l = m.loose.find((o) => Math.hypot(o.x - me.x, o.y - me.y) < 18);
      if (l) { if (this.inv.length < 8) { this.inv.push(l.id); m.loose = m.loose.filter((o) => o !== l); this.say(`You pick up the ${ITEMS[l.id].name.toLowerCase()}.`); G.audio.play('pickup'); } else this.say('Your pockets are full of dream.'); }
      const f = this.figures.find((o) => !o.shadow && Math.hypot(o.x - me.x, o.y - me.y) < 20);
      if (!l && f) this.say(pick(['"You are late. Everyone is waiting."', '"Do I know you?" Their face keeps changing.', '"The door is that way." They point in every direction.', '"You were here yesterday. You are always here."', '"Wake up." They smile. "Not yet, though."']));
    }
    // the people of the dream drift; shadows come for you
    for (const f of this.figures) {
      f.t -= dt;
      if (f.shadow) {
        const d = Math.hypot(me.x - f.x, me.y - f.y) || 1, v = (me.light > 0 ? -30 : 26 + this.t * 0.4);
        f.x += ((me.x - f.x) / d) * v * dt; f.y += ((me.y - f.y) / d) * v * dt;
        if (d < 10 && me.light <= 0) { this.end('Cold hands on your shoulders—', false); return; }
      } else {
        if (f.t <= 0) { f.t = 1 + Math.random() * 3; const a = Math.random() * Math.PI * 2; f.vx = Math.cos(a) * 14; f.vy = Math.sin(a) * 14; }
        const fx = f.x + f.vx * dt, fy = f.y + f.vy * dt;
        if (!m.rectCollides(fx - 4, fy - 4, 8, 4)) { f.x = fx; f.y = fy; } else f.t = 0;
      }
    }
    // the way out
    const ex = m.exit, de = Math.hypot(me.x - (ex.x * 16 + 8), me.y - (ex.y * 16 + 12));
    if (de < 14) {
      if (m.exitLocked) { if (!this.lockedSaid) { this.lockedSaid = true; this.say('A door, glowing at the edges. Locked. Maybe something you have opens it.'); } }
      else { this.end(pick(['You open the door, and light pours in. You are waking up.', 'Through the door, and you are in your own bed.']), true); return; }
    } else this.lockedSaid = false;
    if (this.t > this.limit) { this.end(this.nightmare ? 'The dream folds in on itself, and you jolt awake.' : 'The dream fades at the edges, gently.', null); }
  }
  render(ctx) {
    const RR = R(), UU = U(), m = this.map, me = this.me;
    RR.cam.x = G.util.clamp(me.x - RR.viewW / 2, 0, Math.max(0, m.pw - RR.viewW)); RR.cam.y = G.util.clamp(me.y - RR.viewH / 2, 0, Math.max(0, m.ph - RR.viewH)); RR.cam.sx = RR.cam.sy = 0;
    RR.clear('#000');
    RR.worldTransform();
    const view = RR.viewRect(40);
    m.drawGround(ctx, view, this.t);
    // the glowing door
    const ex = m.exit, gx = ex.x * 16 + 8, gy = ex.y * 16 + 12;
    const gl = ctx.createRadialGradient(gx, gy - 10, 2, gx, gy - 10, 30); gl.addColorStop(0, m.exitLocked ? 'rgba(255,200,120,0.6)' : 'rgba(255,250,220,0.9)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = gl; ctx.fillRect(gx - 30, gy - 40, 60, 60);
    ctx.fillStyle = '#3a2414'; ctx.fillRect(gx - 7, gy - 22, 14, 22); ctx.fillStyle = m.exitLocked ? '#e8b060' : '#fff8e0'; ctx.fillRect(gx - 6, gy - 21, 12, 1); ctx.fillRect(gx - 6, gy - 1, 12, 1); ctx.fillRect(gx + 3, gy - 11, 2, 2);
    for (const l of m.loose) { const tw = Math.sin(this.t * 4 + l.x) * 0.5 + 0.5; ctx.fillStyle = `rgba(255,255,220,${0.4 + tw * 0.5})`; ctx.fillRect(Math.round(l.x) - 1, Math.round(l.y) - 6 - tw * 2, 3, 3); ctx.drawImage(G.assets.icon(ITEMS[l.id].icon), l.x - 6, l.y - 8, 12, 12); }
    const list = m.decor.map((d) => ({ d, y: d.y }));
    for (const f of this.figures) list.push({ f, y: f.y });
    list.push({ me: true, y: me.y });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      if (o.d) { const s = G.assets.sprites[o.d.def.sprite]; if (s) ctx.drawImage(s.img, Math.round(o.d.x - s.ax), Math.round(o.d.y - s.ay)); }
      else if (o.f) { const s = o.f.sheet; ctx.globalAlpha = o.f.shadow ? 0.85 : 0.6 + Math.sin(this.t + o.f.x) * 0.25; ctx.drawImage(s.img, (Math.floor(this.t * 4) % 3) * s.fw, 0, s.fw, s.fh, Math.round(o.f.x - s.fw / 2), Math.round(o.f.y - s.fh + 1), s.fw, s.fh); ctx.globalAlpha = 1; }
      else { const s = this.sheet, col = me.moving ? 1 + (Math.floor(me.anim * 7) % 2) : 0; ctx.drawImage(s.img, col * s.fw, me.dir * s.fh, s.fw, s.fh, Math.round(me.x - s.fw / 2), Math.round(me.y - s.fh + 1 - (me.fly > 0 ? 6 + Math.sin(this.t * 3) * 2 : 0)), s.fw, s.fh); }
    }
    // the dream's color and a vignette that breathes
    RR.screenTransform();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = this.nightmare ? '#a04060' : `hsl(${(this.t * 12) % 360},45%,82%)`; ctx.fillRect(0, 0, RR.W, RR.H);
    ctx.globalCompositeOperation = 'source-over';
    const r0 = Math.max(RR.W, RR.H) * (me.light > 0 ? 0.6 : 0.42 + Math.sin(this.t) * 0.03);
    const vg = ctx.createRadialGradient(RR.W / 2, RR.H / 2, r0 * 0.4, RR.W / 2, RR.H / 2, r0 * 1.2); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, this.nightmare ? 'rgba(10,0,4,0.95)' : 'rgba(10,6,20,0.85)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, RR.W, RR.H);
    RR.uiTransform();
    if (this.msgT > 0) { ctx.globalAlpha = Math.min(1, this.msgT); UU.text(ctx, this.msg, RR.uiW / 2, RR.uiH - 44, { align: 'center', size: 10, color: '#f4ecff' }); ctx.globalAlpha = 1; }
    if (this.showInv || this.t < 4) {
      const w = 150, h = 16 + this.inv.length * 14, x = 8, y = 24;
      UU.panel(ctx, x, y, w, h, { accent: '#b08ae0' });
      UU.text(ctx, 'DREAM POCKETS', x + 8, y + 3, { size: 7, weight: 'bold', color: '#d8c0ff' });
      this.inv.forEach((id, i) => { UU.icon(ctx, ITEMS[id].icon, x + 6, y + 12 + i * 14, 0.75); UU.text(ctx, `${i + 1}. ${ITEMS[id].name}`, x + 20, y + 14 + i * 14, { size: 8 }); });
    }
  }
}
const MB = () => G.MB;
G.DreamWorldScene = DreamWorldScene;
G.dreamworld = { ITEMS, makeItem };
// the dream's playable part is now a place to explore
const DS = G.DreamScene.prototype;
DS.startPlay = function () {
  const self = this;
  this.scene.played = true;
  G.scenes.remove(this);
  G.scenes.push(new DreamWorldScene(this.game, this, (text, good) => {
    G.scenes.push(self);
    self.scene.beats.splice(self.bi, 0, text);
    if (good === true && self.dream.mood !== 'nightmare') self.dream.mood = 'good';
    if (good === false) { self.dream.mood = 'nightmare'; self.scene.beats.length = self.bi + 1; self.dream.scenes.length = self.si + 1; self.dream.wake = self.dream.wake || 1; }
    self.chars = 0;
  }));
};
})();
