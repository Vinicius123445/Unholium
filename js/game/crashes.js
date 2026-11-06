'use strict';
// Crashes on two wheels. A bicycle or a motorcycle hit hard enough (by a car, by another bike, or ridden into
// a wall or a person at speed) throws its rider: they lose the bike, fly off in the direction the collision
// sends them, tumble through the air with their arms and legs flailing, hit the ground (and bounce if it was
// fast), roll and slide to a stop, lie there for a moment, and get back up. The bike goes its own way: it
// tips over and slides on with its momentum, spinning, scraping (sparks and marks from a motorcycle), until
// friction or a wall stops it. It stays on its side until someone picks it up.
//   Force: the relative speed of the two vehicles (or the speed into the wall). Under the threshold nothing
//   throws you; a little under it the rider wobbles and slows down. Everything scales with it: how far and how
//   high they fly, how many times they bounce, how long they lie there, how much it hurts.
//   Same for everyone: the player (riding, the input is lost while flying and lying) and traffic riders (the
//   rider becomes a real person on the street, js/game/drivers.js ejectDriver, who then reacts to whoever hit
//   them). Lying and getting up use the knockdown state (actor.downT, js/game/extras.js and hdchars.js).
(() => {
const V = G.vehicles, GS = G.GameScene.prototype, AP = G.Actor.prototype, VP = G.Vehicle.prototype;
const GRAV = 560;           // px/s² while flying
const TAU = Math.PI * 2;

const C = G.crashes = {
  THRESH: { bike: 55, moto: 85 },   // relative speed (px/s) that throws a rider off
  WOBBLE: 0.55,                     // above this share of it, they only lose their balance for a moment
  twoWheel: (v) => !!(v && v.m && v.m.moto),
  thresh(v) { return v.m.bike ? this.THRESH.bike : this.THRESH.moto; },
  rider(v) { return v.driver === 'player' ? 'player' : v.ai && v.ai.driver ? 'npc' : null; },
  ridden(v) { return this.twoWheel(v) && !!this.rider(v) && !v.fallen; },
  vel(v) { if (v.crash) return [v.crash.vx, v.crash.vy]; const s = v.speed || 0; return [Math.cos(v.angle) * s, Math.sin(v.angle) * s]; },
  // do two vehicles' bodies touch? (a can be tested at another position)
  overlap(a, b, ax = a.x, ay = a.y) {
    for (const [px, py] of a.points(ax, ay, a.angle)) if (b.covers(px, py, 0)) return true;
    const c = Math.cos(-a.angle), s = Math.sin(-a.angle);
    for (const [px, py] of b.points(b.x, b.y, b.angle)) { const dx = px - ax, dy = py - ay; if (Math.abs(dx * c - dy * s) < a.L && Math.abs(dx * s + dy * c) < a.Wd) return true; }
    return false;
  },
  near(scene, x, y) { const p = scene.player; return p && Math.hypot(p.x - x, p.y - y) < 220; },

  // ---------------------------------------------------------------- a collision between two vehicles
  // returns true when it involved a rider (thrown or shaken)
  collide(scene, a, b, impact, causer) {
    if (!this.ridden(a) && !this.ridden(b)) return false;
    a._ccd = b._ccd = 0.6;
    let thrown = false;
    for (const [r, o] of [[a, b], [b, a]]) {
      if (!this.ridden(r)) continue;
      const T = this.thresh(r), [rx, ry] = this.vel(r), [ox, oy] = this.vel(o);
      if (impact >= T) {
        // the rider keeps most of their own momentum and takes the push of what hit them (heavier pushes harder)
        const mass = o.m.bike ? 0.3 : o.m.moto ? 0.6 : o.m.len > 36 ? 1.1 : 0.85;
        let tx = rx * 0.75 + ox * mass, ty = ry * 0.75 + oy * mass;
        if (Math.hypot(tx, ty) < impact * 0.5) { const ang = Math.atan2(r.y - o.y, r.x - o.x); tx += Math.cos(ang) * impact * 0.5; ty += Math.sin(ang) * impact * 0.5; }
        const by = o.driver === 'player' ? scene.player : causer && causer !== r.driver ? causer : null;
        this.eject(scene, r, [tx, ty], impact, by === scene.player && r.driver === 'player' ? null : by, [rx * 0.45 + ox * mass * 0.7, ry * 0.45 + oy * mass * 0.7], o);
        thrown = true;
      } else if (impact >= T * this.WOBBLE) {
        r.wobble = { t: 0.7, amp: 0.1 + 0.22 * impact / T };
        r.speed *= 0.55;
        G.audio.play('punch', { x: r.x, y: r.y });
      }
    }
    if (thrown || impact > 50) {
      G.audio.play('crash', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      if (this.near(scene, a.x, a.y)) G.renderer.shake(Math.min(7, impact / 35));
      for (const v of [a, b]) if (!v.m.bike || impact > 90) v.damage(Math.round(impact / 18), scene);
    }
    for (const o of [a, b]) if (o.ai && !o.crash) { o.speed = 0; o.ai.waitT = 0; }   // whoever hit a cyclist does not drive on
    for (const o of [a, b]) if (o.driver === 'player' && !this.twoWheel(o)) o.speed *= 0.7;
    return true;
  },

  // ---------------------------------------------------------------- the rider comes off
  eject(scene, v, [tx, ty], impact, causer, [bx, by], other) {
    const who = this.rider(v);
    if (!who) return null;
    let a;
    if (who === 'player') { a = scene.player; V.exit(scene, true); }
    else { a = V.ejectDriver(scene, v, false); if (!a) return null; v.ai = null; }
    a.x = v.x; a.y = v.y;
    v.driver = null; v.speed = 0;
    this.launch(scene, a, [tx, ty], impact, v, causer, other);
    this.topple(scene, v, [bx, by], impact);
    this.hurt(scene, a, (impact - this.thresh(v) * 0.6) * (v.m.bike ? 0.08 : 0.11));
    if (a.kind === 'npc' && causer === scene.player && !a.dead) { scene.reportCrime('assault', a); a.st.fear = 100; }
    return a;
  },
  launch(scene, a, [vx, vy], impact, v, causer, other) {
    const s = Math.hypot(vx, vy) || 1;
    a.crash = {
      vx, vy, z: v && v.m.bike ? 7 : 9, vz: Math.min(230, 40 + impact * 0.36),
      rot: 0, spin: (Math.random() < 0.5 ? -1 : 1) * (3 + impact / 45), t: 0, phase: 'air', bounces: 0, land: 0,
      impact, from: v, other: other || null, causer: causer || null, hitCD: 0,
    };
    a.moving = false; a.sitting = null; a.seated = false; a.kbx = a.kby = 0; a.downT = 0; a.path = null; a.swing = null;
    a.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 1) : (vy > 0 ? 0 : 3);
    void s;
  },
  hurt(scene, a, dmg) {
    if (!(dmg >= 1) || a.dead) return;
    const c = a.crash, helmet = c && c.from && !c.from.m.bike ? 0.8 : 1;   // motorcyclists wear a helmet
    a.invuln = 0;
    G.combat.damage(a, Math.round(dmg * helmet), c && c.causer, scene);
    a.kbx = a.kby = 0; a.downT = 0;          // the crash moves them, not the knockback
    a.invuln = 0.35;                          // (and passing traffic does not count the same blow twice)
  },

  // ---------------------------------------------------------------- flying, landing, rolling, sliding
  step(a, dt, scene) {
    const c = a.crash, map = scene.map;
    if (a.dead) { a.crash = null; return; }
    c.t += dt;
    if (c.land > 0) c.land -= dt;
    if (c.hitCD > 0) c.hitCD -= dt;
    if (a.hurtTimer > 0) a.hurtTimer -= dt;
    // the body moves, and stops against walls and cars (and gets hurt by them when it is fast)
    const solid = (x, y) => map.rectCollides(x - 3, y - 4, 6, 4);
    let hit = 0;
    const nx = a.x + c.vx * dt, ny = a.y + c.vy * dt;
    if (solid(nx, a.y)) { hit = Math.abs(c.vx); c.vx = -c.vx * 0.3; } else a.x = nx;
    if (solid(a.x, ny)) { hit = Math.max(hit, Math.abs(c.vy)); c.vy = -c.vy * 0.3; } else a.y = ny;
    if (c.z < 14) for (const o of scene.vehicles || []) {
      if (o === c.from || o.fallen || (o === c.other && c.t < 0.5) || !o.covers(a.x, a.y, 1)) continue;   // (thrown clear of what hit them)
      const ang = Math.atan2(a.y - o.y, a.x - o.x), s = Math.hypot(c.vx, c.vy);
      hit = Math.max(hit, s * 0.8);
      c.vx = Math.cos(ang) * s * 0.35; c.vy = Math.sin(ang) * s * 0.35; a.x += Math.cos(ang) * 2; a.y += Math.sin(ang) * 2;
      break;
    }
    if (hit > 90 && !(c.hitCD > 0)) {
      c.hitCD = 0.25;
      c.wallHits = (c.wallHits || 0) + 1;
      this.hurt(scene, a, (hit - 60) * 0.12);
      c.spin = -c.spin * 0.7;
      G.audio.play('punch', { x: a.x, y: a.y });
      scene.particles(a.x, a.y - 6 - c.z, '#d8c8a0', 4);
    }
    if (c.phase === 'air') {
      c.vz -= GRAV * dt; c.z += c.vz * dt; c.rot += c.spin * dt;
      if (c.z <= 0) {   // the ground
        const down = -c.vz;
        c.maxDown = Math.max(c.maxDown || 0, down);
        c.z = 0; c.land = 0.16;
        scene.particles(a.x, a.y - 1, '#b8ae98', 3 + Math.min(6, Math.round(down / 50)));
        G.audio.play('punch', { x: a.x, y: a.y });
        if (this.near(scene, a.x, a.y)) G.renderer.shake(Math.min(4, down / 90));
        this.hurt(scene, a, (down - 110) * 0.09);
        if (down > 120 && c.bounces < 2) { c.vz = down * 0.32; c.vx *= 0.62; c.vy *= 0.62; c.spin *= 0.65; c.bounces++; }
        else { c.phase = 'slide'; c.vz = 0; }
      }
      return;
    }
    // rolling while it is fast, then sliding, and settling flat (on the side the body ends up on)
    const s = Math.hypot(c.vx, c.vy), dec = 420 * dt, k = s > dec ? (s - dec) / s : 0;
    c.vx *= k; c.vy *= k;
    if (s > 110) { c.rot += Math.sign(c.spin || 1) * (s / 9) * dt; c.target = null; }
    else {
      if (c.target == null) {   // the nearer of the two ways to lie: on one side or the other
        const r = ((c.rot % TAU) + TAU) % TAU, d1 = Math.abs(r - Math.PI / 2), d2 = Math.abs(r - Math.PI * 1.5);
        c.side = d1 <= d2 ? 1 : -1;
        c.target = c.rot + ((c.side > 0 ? Math.PI / 2 : Math.PI * 1.5) - r);
      }
      c.rot += (c.target - c.rot) * Math.min(1, dt * 8);
    }
    if (s > 40 && Math.random() < dt * 20) scene.particles(a.x, a.y - 2, '#b8b0a0', 1);
    if (s < 6 && c.target != null && Math.abs(c.target - c.rot) < 0.06) this.finish(a, scene);
  },
  finish(a, scene) {
    const c = a.crash;
    a.crash = null;
    a.kbx = a.kby = 0;
    a.downDir = c.side || 1;
    a.downT = 0.35 + G.util.clamp(0.5 + c.impact / 220, 0.6, 2.6);   // lying there, then getting up (extras.js)
    // how hard the head hit: a bad enough crash leaves them unconscious (and maybe brain damaged, js/game/brain.js)
    if (a.kind === 'npc' && !a.dead && !(a.def && a.def.kid) && G.ko && a.st) {
      const T = c.from ? (c.from.m.bike ? 55 : 85) : 70, helmet = c.from && !c.from.m.bike ? 0.6 : 1;
      const score = (Math.max(0, c.impact - T) / 90 + (c.maxDown || 0) / 260 + (c.wallHits || 0) * 0.5 + (c.bounces || 0) * 0.15) * helmet;
      if (Math.random() < G.util.clamp(score * 0.55, 0, 0.85)) {
        const hp = a.hp;
        a.koTr = { hits: 1, dmg: a.maxHp * Math.min(1, score * 0.4), head: Math.round(score * 2.2), heavy: score > 1.5 ? 1 : 0, t: G.loop.time };
        G.ko.knockOut(scene, a, c.causer || null, 'heavy', G.util.clamp(score * 0.8, 0.2, 3));
        a.hp = Math.max(1, hp);
        if (a.st.ko) { a.st.ko.head = Math.round(score * 2.2); a.st.ko.crash = true; }
        return;
      }
    }
    if (a.kind === 'npc' && !a.dead) {
      if (c.causer === scene.player) { a.say(G.rng.pick(['You hit me!', 'Are you insane?!', 'My leg... you maniac!']), 3); a.startFlee(scene.player); }
      else a.say(G.rng.pick(['Ow...', 'My bike!', 'Did anyone get the plate?']), 3);
    }
  },

  // ---------------------------------------------------------------- the bike on its own
  topple(scene, v, [vx, vy], impact) {
    v.crash = { vx, vy, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + impact / 60), t: 0 };
    v.fallen = true; v.fallT = 0; v.fallSide = Math.random() < 0.5 ? -1 : 1;
    v.ai = null; v.speed = 0; v.wobble = null;
  },
  stepVehicle(v, dt, scene) {
    const c = v.crash, map = scene.map;
    c.t += dt;
    const s = Math.hypot(c.vx, c.vy), dec = (v.m.bike ? 300 : 240) * dt, k = s > dec ? (s - dec) / s : 0;
    c.vx *= k; c.vy *= k;
    c.spin *= Math.pow(0.25, dt);
    const na = v.angle + c.spin * dt, nx = v.x + c.vx * dt, ny = v.y + c.vy * dt;
    let bang = 0;
    if (v.blocked(map, nx, v.y, na)) { bang = Math.abs(c.vx); c.vx = -c.vx * 0.35; c.spin = -c.spin * 0.5; } else v.x = nx;
    if (v.blocked(map, v.x, ny, na)) { bang = Math.max(bang, Math.abs(c.vy)); c.vy = -c.vy * 0.35; c.spin = -c.spin * 0.5; } else v.y = ny;
    if (!v.blocked(map, v.x, v.y, na)) v.angle = na; else c.spin = 0;
    for (const o of scene.vehicles) {
      if (o === v || o.fallen || Math.hypot(o.x - v.x, o.y - v.y) > v.L + o.L || !this.overlap(v, o)) continue;
      const ang = Math.atan2(v.y - o.y, v.x - o.x), sp = Math.hypot(c.vx, c.vy);
      bang = Math.max(bang, sp);
      c.vx = Math.cos(ang) * sp * 0.3; c.vy = Math.sin(ang) * sp * 0.3; v.x += Math.cos(ang) * 1.5; v.y += Math.sin(ang) * 1.5;
    }
    if (bang > 70) G.audio.play('crash', { x: v.x, y: v.y, vol: 0.5 });
    // metal on the street: sparks and scrape marks from a motorcycle
    if (s > 50 && !v.m.bike) {
      if (Math.random() < dt * 30) scene.particles(v.x + (Math.random() - 0.5) * 6, v.y, '#ffd27a', 1);
      if (!c.mx || Math.hypot(v.x - c.mx, v.y - c.my) > 5) {
        c.mx = v.x; c.my = v.y;
        const w = scene.world; w.skids = w.skids || {}; const sk = (w.skids[map.id] = w.skids[map.id] || []);
        sk.push({ x: v.x, y: v.y, day: w.day });
        if (sk.length > 400) sk.splice(0, sk.length - 400);
      }
    }
    if (s < 4 && Math.abs(c.spin) < 0.25) {
      v.crash = null;
      if (v.rec) Object.assign(v.rec, { x: v.x, y: v.y, angle: v.angle });
    }
  },

  // ---------------------------------------------------------------- the player's own vehicle, before it moves
  precheck(scene, dt) {
    const p = scene.player, v = p && p.vehicle;
    if (!v || v._ccd > 0 || p.crash) return;
    const [vx, vy] = this.vel(v), sp = Math.hypot(vx, vy);
    if (sp < 20) return;
    const nx = v.x + vx * dt * 1.5, ny = v.y + vy * dt * 1.5;
    for (const o of scene.vehicles) {
      if (o === v || o._ccd > 0 || o.fallen || Math.hypot(o.x - nx, o.y - ny) > v.L + o.L + 4 || !this.overlap(v, o, nx, ny)) continue;
      const [ox, oy] = this.vel(o);
      if (this.collide(scene, v, o, Math.hypot(vx - ox, vy - oy), p)) return;
    }
    if (!this.twoWheel(v)) return;
    const T = this.thresh(v);
    // a wall, a fence, the side of a building: over the handlebars, and the bike stops dead
    if (sp >= T && v.blocked(scene.map, nx, ny, v.angle)) {
      v._ccd = 0.6;
      G.audio.play('crash', { x: v.x, y: v.y }); G.renderer.shake(Math.min(7, sp / 35));
      v.damage(Math.round(sp / 16), scene);
      this.eject(scene, v, [vx * 0.8, vy * 0.8], sp, null, [-vx * 0.12, -vy * 0.12]);
      return;
    }
    // a person (or a big animal) at speed: you go over them
    if (sp >= T * 1.5) for (const a of scene.actors) {
      if (a === p || a.dead || (a.kind !== 'npc' && a.kind !== 'animal') || a.crash) continue;
      if (!v.covers(a.x, a.y, 2) && Math.hypot(a.x - nx, a.y - ny) > 6) continue;
      v._ccd = 0.6;
      G.audio.play('hit', { x: a.x, y: a.y }); G.audio.play('crash', { x: v.x, y: v.y });
      G.combat.damage(a, Math.round(sp * (v.m.bike ? 0.07 : 0.1)), p, scene);
      if (a.kind === 'npc' && !a.dead) { scene.reportCrime('assault', a); a.st.fear = 100; }
      this.eject(scene, v, [vx * 0.7, vy * 0.7], sp * 0.8, null, [vx * 0.3, vy * 0.3]);
      return;
    }
  },
  // every vehicle, after it moved: anything that ran into a rider (traffic at a crossing, a bike into a car)
  postcheck(scene, pre) {
    const vs = scene.vehicles;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i], b = vs[j];
      if (a._ccd > 0 || b._ccd > 0 || a.fallen || b.fallen || (!this.ridden(a) && !this.ridden(b))) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > a.L + b.L + 2 || !this.overlap(a, b)) continue;
      const [ax, ay] = pre.get(a) || this.vel(a), [bx, by] = pre.get(b) || this.vel(b);
      this.collide(scene, a, b, Math.hypot(ax - bx, ay - by), a.driver === 'player' || b.driver === 'player' ? scene.player : null);
    }
  },

  // ---------------------------------------------------------------- drawing
  drawBody(ctx, a) {
    const c = a.crash, s = a.sheet, H = G.hd;
    // the shadow stays on the ground, smaller and fainter the higher they are
    const k = Math.max(0.35, 1 - c.z / 60);
    ctx.fillStyle = `rgba(0,0,0,${(0.28 * k).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(a.x, a.y - 0.5, 6 * k, 2.5 * k, 0, 0, TAU); ctx.fill();
    const sq = c.land > 0 ? c.land / 0.16 : 0;   // squashed for a moment by each impact
    const hd = s ? H.get(s) : null;
    const flash = a.hurtTimer > 0 && Math.floor(a.hurtTimer * 20) % 2 === 0;
    ctx.save();
    ctx.translate(a.x, a.y - 4 - c.z);
    ctx.rotate(c.rot);
    ctx.scale(1 + 0.18 * sq, 1 - 0.22 * sq);
    if (hd) {
      // in the air the limbs flail (the running frames, fast, faster with the spin); on the ground, the fall pose
      const col = c.phase === 'air' ? H.COL.run + Math.floor(c.t * (10 + Math.abs(c.spin) * 1.5)) % 8 : H.COL.flinch;
      ctx.drawImage(flash ? G.assets.white(hd.img) : hd.img, col * H.FW, (a.dir || 0) * H.FH, H.FW, H.FH, -H.WW / 2, -H.WH / 2, H.WW, H.WH);
    }
    ctx.restore();
  },
  // a bicycle or motorcycle lying on its side, seen from above: its side profile flat on the ground
  drawFallen(ctx, v, k) {
    const m = v.m, L = v.L, side = v.fallSide || 1, sh = G.assets.shade;
    ctx.save();
    ctx.translate(Math.round(v.x), Math.round(v.y));
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, side * 2.5, L + 1, 4.5, 0, 0, TAU); ctx.fill();
    ctx.scale(1, side * k);
    const r = m.bike ? 3.6 : 4.6, wx = L - r;
    for (const x of [-wx, wx]) {
      if (m.bike) { ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, 0, r, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(160,166,176,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x - r, 0); ctx.lineTo(x + r, 0); ctx.moveTo(x, -r); ctx.lineTo(x, r); ctx.stroke(); }
      else { ctx.fillStyle = '#141416'; ctx.beginPath(); ctx.arc(x, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a8e96'; ctx.beginPath(); ctx.arc(x, 0, r * 0.45, 0, TAU); ctx.fill(); }
    }
    ctx.lineCap = 'round';
    const line = (x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    if (m.bike) {   // the frame: a triangle from the back wheel to the saddle, the pedals and the handlebar
      line(-wx, 0, -1, 4, 1.1, m.body); line(-1, 4, 0, 1, 1.1, m.body); line(0, 1, -wx, 0, 1.1, m.body);
      line(-1, 4, wx - 2, 4.5, 1.1, m.body); line(wx - 2, 4.5, wx, 0, 1.1, m.body); line(0, 1, wx - 2, 4.5, 1.1, m.body);
      line(-2.5, 5, 0.5, 5, 1.6, '#2a2420');                     // saddle
      line(wx - 3, 5.5, wx - 1, 6.5, 1, '#9aa0aa');             // handlebar
    } else {        // engine, tank, seat, exhaust, forks
      ctx.fillStyle = '#3a3c42'; ctx.fillRect(-4, 0.5, 8, 3.5);
      line(-wx + 1, 1, wx - 2, 1, 1.2, '#6a6e78');
      ctx.fillStyle = m.body; ctx.beginPath(); ctx.ellipse(2.5, 5, 6, 2.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = sh(m.body, 1.3); ctx.fillRect(0, 3.4, 5, 1);
      ctx.fillStyle = '#1a1a1e'; ctx.fillRect(-7, 3.8, 6, 2.4);
      line(-3, 1.5, -wx - 1, 2.5, 1.4, '#b8bcc4');
      line(wx, 0, wx - 3, 6.5, 1.2, '#8a8e96');
      line(wx - 4, 7, wx - 2, 7.5, 1.2, '#2a2a30');
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------- hooks
const PL = G.Player.prototype, _pu = PL.update;
PL.update = function (dt, scene) { if (this.crash) { C.step(this, dt, scene); return; } return _pu.call(this, dt, scene); };
const NP = G.NPC.prototype, _nu = NP.update;
NP.update = function (dt, scene) { if (this.crash) { C.step(this, dt, scene); return; } return _nu.call(this, dt, scene); };
const _ad = AP.draw;
AP.draw = function (ctx) { if (this.crash && !this.dead) return C.drawBody(ctx, this); return _ad.call(this, ctx); };

const _vd = VP.draw;
VP.draw = function (ctx) {
  if (this.fallen) {
    const f = this.fallT == null ? 1 : this.fallT;
    if (f >= 0.5) return C.drawFallen(ctx, this, (f - 0.5) * 2);
    // tipping over: the upright bike leans onto its side
    const k = 1 - f * 2, a = this.angle;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a); ctx.scale(1, 0.15 + 0.85 * k); ctx.rotate(-a); ctx.translate(-this.x, -this.y);
    _vd.call(this, ctx);
    ctx.restore();
    return;
  }
  if (this.wobble) {   // a knock that did not throw them: the bike shakes and they fight to stay up
    const w = this.wobble, r = Math.sin(w.t * 28) * w.amp * (w.t / 0.7);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(r); ctx.translate(-this.x, -this.y);
    _vd.call(this, ctx);
    ctx.restore();
    return;
  }
  return _vd.call(this, ctx);
};

// picking a fallen bike back up
const _enter = V.enter;
V.enter = function (scene, v) { if (v.fallen) { v.fallen = false; v.crash = null; v.fallT = null; } return _enter.apply(this, arguments); };

const _gu = GS.update;
GS.update = function (dt) {
  if (!this.vehicles || !dt) return _gu.call(this, dt);
  const pre = new Map();
  for (const v of this.vehicles) pre.set(v, C.vel(v));
  C.precheck(this, dt);
  const r = _gu.call(this, dt);
  if (!this.vehicles) return r;
  C.postcheck(this, pre);
  for (const v of this.vehicles) {
    if (v._ccd > 0) v._ccd -= dt;
    if (v.fallen && v.fallT < 1) v.fallT = Math.min(1, v.fallT + dt / 0.28);
    if (v.crash) C.stepVehicle(v, dt, this);
    if (v.wobble && (v.wobble.t -= dt) <= 0) v.wobble = null;
  }
  return r;
};
})();
