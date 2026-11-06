'use strict';
// Benadryl delirium, closer to the real thing (replaces the waking nightmare in js/game/pills.js).
// A deliriant does not feel like a trip. You do not know you are on something: you just live inside it.
// It builds with the dose (the deliriant load) and drags on for hours. Mostly shown, rarely written:
//   The Hat Man. A tall figure in a wide-brimmed hat and a long coat, standing at the edge of your sight,
//     in a doorway, under a lamp, at the end of the street. Always still. Gone the moment you get close or
//     look straight at him (bring him toward the middle of the screen). Sometimes he is closer next time.
//   Shadow people. Darker than the dark, at the edge of your vision; they slip out of view as you turn.
//   People who are not there. Someone you know (or a stranger) standing near you, talking to you in an
//     ordinary voice about ordinary things. Walk up to them: there is nobody, or for a second it is a
//     shadow with your friend's outline.
//   Spiders. On the ground around you, scuttling in bursts, and over your eyes, legs and all.
//   Your eyes. Blurred double vision, visual snow (static over everything), the walls and the ground
//     crawling with dark veins, faces in the noise, lights that dim and swell, colors draining out.
//   Your body. A racing pulse at the edge of the screen, a mouth like sand, your feet going the wrong way
//     (the reversed controls in pills.js), sudden blackouts: the screen goes dark and you come to later,
//     somewhere else nearby, with time missing.
//   Sounds. Whispers just behind you, footsteps that stop when you stop, a phone buzzing in your pocket.
(() => {
const E = G.effects, PL = G.pills;
const LINES = [
  'Hey. Are you coming or not?', 'Did you feed the dog?', 'Your mom called. Twice.', 'Who are you talking to?', 'Pass me that. No, the other one.',
  'We already talked about this.', 'You should sit down.', 'Is that your phone?', 'Why are you looking at me like that?', 'The bus left already.',
  'I put it in your pocket.', 'Hey. Hey. Over here.', 'You know you are not supposed to be here.', 'Where did you go?', 'Turn around.',
];
const level = (p) => G.util.clamp(((E.drugState(p).load.deliriant || 0) - 40) / 90, 0.15, 1);

// ---------------------------------------------------------------- sounds
const SFX = G.audio.SFX;
SFX.whisper = function (o, T) {
  const w = T._out(o, { vol: 0.35, wet: 0.5, range: 300, ref: 30 }); if (!w) return;
  for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) T._burst(w.node, w.t + i * 0.13 + Math.random() * 0.05, { noise: 'white', dur: 0.09, vol: 0.06, type: 'bandpass', f: 2600 + Math.random() * 2400, q: 6, a: 0.02 });
};
SFX.buzz = function (o, T) {
  const w = T._out(o, { vol: 0.4, wet: 0 }); if (!w) return;
  for (let i = 0; i < 2; i++) T._osc(w.node, w.t + i * 0.32, { type: 'square', f: 140, dur: 0.22, vol: 0.05, hold: 0.12 });
};

// ---------------------------------------------------------------- what happens
PL.delirium = function (p, dt, scene) {
  const d = (scene.delir = scene.delir || { shadows: [], bugs: [], t: 0 });
  const L = level(p), R = G.renderer, v = R.viewRect(0);
  d.t += dt; d.L = L;
  d.spiders = d.spiders || []; d.talkers = d.talkers || [];
  if (!d.began) { d.began = true; for (let i = 0; i < 3; i++) { const a = Math.random() * 6.3, r = 30 + Math.random() * 50; d.spiders.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, ang: a, go: 0, life: 4 + Math.random() * 4, s: 1 }); } }   // it starts with something small moving at the edge of your eye
  p.thirst = Math.min(100, (p.thirst || 0) + dt * 0.08);   // bone-dry mouth
  const edge = () => {   // a spot near the edge of the screen, in the world
    const side = G.rng.int(0, 3), m = 18;
    return side === 0 ? { x: v.x + m + Math.random() * (v.w - m * 2), y: v.y + m + 30 } : side === 1 ? { x: v.x + m + Math.random() * (v.w - m * 2), y: v.y + v.h - m }
      : side === 2 ? { x: v.x + m, y: v.y + 40 + Math.random() * (v.h - 60) } : { x: v.x + v.w - m, y: v.y + 40 + Math.random() * (v.h - 60) };
  };
  const centered = (q) => Math.abs(q.x - (v.x + v.w / 2)) < v.w * 0.22 && Math.abs(q.y - 10 - (v.y + v.h / 2)) < v.h * 0.22;
  // shadow people at the edges; they slip away when looked at
  if (Math.random() < dt * 0.3 * L && d.shadows.length < 2 + Math.round(L * 4)) { const q = edge(); d.shadows.push({ x: q.x, y: q.y, a: 0, life: G.rng.range(3, 8), h: G.rng.range(0.9, 1.25) }); }
  for (const s of d.shadows) { s.life -= dt; s.a = Math.min(0.85, s.a + dt * 0.5); if (Math.hypot(s.x - p.x, s.y - p.y) < 50 || centered(s)) s.life = Math.min(s.life, 0.25); }
  // the Hat Man
  if (!d.hat && L > 0.35 && Math.random() < dt / (60 - L * 35)) { const q = edge(); d.hat = { x: q.x, y: q.y, a: 0, life: G.rng.range(6, 14) }; if (Math.random() < 0.5) G.audio.play('whisper', { x: q.x, y: q.y }); }
  if (d.hat) { const h = d.hat; h.life -= dt; h.a = Math.min(1, h.a + dt * 0.35); if (Math.hypot(h.x - p.x, h.y - p.y) < 70 || centered(h)) h.life = Math.min(h.life, 0.12); if (h.life <= 0) d.hat = null; }
  // people who are not there
  if (Math.random() < dt / (28 - L * 14) && d.talkers.length < 1 + Math.round(L)) {
    const known = G.phone ? G.phone.contacts(scene.world).filter((id) => G.NPCS[id]) : [];
    const id = known.length && Math.random() < 0.6 ? G.rng.pick(known) : null;
    const look = id ? (scene.world.npcs[id].look || G.NPCS[id].look || G.look(id)) : G.look('phantom' + Math.floor(Math.random() * 1e6));
    const a = Math.random() * Math.PI * 2, r = G.rng.range(36, 60);
    d.talkers.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, look, line: G.rng.pick(LINES), life: G.rng.range(6, 11), a: 0, t: 0 });
  }
  for (const t of d.talkers) {
    t.life -= dt; t.t += dt; t.a = Math.min(1, t.a + dt * 1.2);
    if (Math.hypot(t.x - p.x, t.y - p.y) < 20 && !t.gone) { t.gone = true; t.life = Math.min(t.life, 0.6); }   // there is nobody there
  }
  // spiders on the ground around you
  if (Math.random() < dt * 1.2 * L && d.spiders.length < 4 + Math.round(L * 10)) { const a = Math.random() * Math.PI * 2, r = G.rng.range(20, 110); d.spiders.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, ang: Math.random() * 6.3, go: 0, life: G.rng.range(3, 9), s: G.rng.range(0.7, 1.4) }); }
  for (const s of d.spiders) {
    s.life -= dt; s.go -= dt;
    if (s.go < -G.rng.range(0.2, 0.9)) { s.go = G.rng.range(0.15, 0.5); s.ang += G.rng.range(-1.6, 1.6); }   // still, then a burst
    if (s.go > 0) { s.x += Math.cos(s.ang) * 60 * dt; s.y += Math.sin(s.ang) * 60 * dt; s.ph = (s.ph || 0) + dt * 30; }
  }
  // spiders over your eyes (screen space)
  if (Math.random() < dt * 0.7 * L && d.bugs.length < 3 + Math.round(L * 8)) d.bugs.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, go: 0, life: G.rng.range(2, 6), ang: 0, s: G.rng.range(0.8, 1.6) });
  for (const b of d.bugs) {
    b.life -= dt; b.go -= dt;
    if (b.go < -G.rng.range(0.1, 0.7)) { b.go = G.rng.range(0.1, 0.4); b.ang = Math.random() * 6.3; }
    if (b.go > 0) { b.x += Math.cos(b.ang) * 0.35 * dt; b.y += Math.sin(b.ang) * 0.35 * dt; b.ph = (b.ph || 0) + dt * 30; }
  }
  d.shadows = d.shadows.filter((q) => q.life > 0); d.bugs = d.bugs.filter((q) => q.life > 0); d.spiders = d.spiders.filter((q) => q.life > 0); d.talkers = d.talkers.filter((q) => q.life > 0);
  // sounds that are not there
  if (Math.random() < dt / (16 - L * 8)) { const a = p.dir === 0 ? -Math.PI / 2 : p.dir === 3 ? Math.PI / 2 : p.dir === 1 ? 0 : Math.PI; G.audio.play('whisper', { x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30 }); }   // right behind you
  if (p.moving) d.stepT = 0.6; else if (d.stepT > 0) { d.stepT -= dt; if (d.stepT < 0.35 && !d.stepped && Math.random() < 0.02 * L) { d.stepped = true; G.audio.play('step', { x: p.x, y: p.y + 26 }); } }
  if (p.moving) d.stepped = false;
  if (Math.random() < dt / 70) { G.audio.play('buzz'); if (Math.random() < 0.35) scene.toast(G.rng.pick(['New message from ???', 'Missed call (0)']), 'bad'); }   // a phone buzzing in your pocket (rarely a message, from nobody)
  if (Math.random() < dt / 120) scene.toast(G.rng.pick(['You reach for the cigarette in your hand. There is no cigarette.', 'You have been walking for an hour. It has been two minutes.']), 'bad');
  // your body stops listening
  if (Math.random() < dt / (45 - L * 20)) d.flipT = 2 + L * 2;
  if (d.flipT > 0) d.flipT -= dt;
  // blackouts: dark, then you come to a little later, not quite where you were
  if (!d.black && L > 0.55 && d.t > 40 && Math.random() < dt / 150) d.black = { t: 0, dur: 2.6 };
  if (d.black) {
    const b = d.black; b.t += dt;
    if (b.t >= b.dur * 0.5 && !b.done) {
      b.done = true;
      const w = scene.world, mins = G.rng.int(8, 35);
      w.addMinutes(mins);   // (through the clock, so hours and days pass as they should)
      const map = scene.map;
      for (let i = 0; i < 12; i++) { const tx = Math.floor(p.x / 16) + G.rng.int(-3, 3), ty = Math.floor(p.y / 16) + G.rng.int(-3, 3); if (!map.isSolidTile(tx, ty) && !map.isWaterAt(tx * 16 + 8, ty * 16 + 8)) { p.x = tx * 16 + 8; p.y = ty * 16 + 12; break; } }
      d.shadows.length = 0; d.talkers.length = 0; d.hat = null;
    }
    if (b.t >= b.dur) d.black = null;
  }
};

// ---------------------------------------------------------------- what you see
function hatMan(ctx, x, y, a) {
  ctx.globalAlpha = a; ctx.fillStyle = '#030205';
  ctx.beginPath(); ctx.moveTo(x - 4, y - 25); ctx.lineTo(x + 4, y - 25); ctx.lineTo(x + 7, y); ctx.lineTo(x - 7, y); ctx.fill();   // the long coat
  ctx.fillRect(x - 5, y - 28, 10, 4);                                     // shoulders
  ctx.beginPath(); ctx.ellipse(x, y - 30, 2.6, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 7, y - 32.5, 14, 1.3); ctx.fillRect(x - 3, y - 37, 6, 4.6);   // the brim and crown of the hat
  ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y - 18, 14, 22, 0, 0, Math.PI * 2); ctx.fill();   // darkness clinging to him
}
function shadowPerson(ctx, x, y, a, h, t) {
  ctx.globalAlpha = a; ctx.fillStyle = '#05030a';
  const k = h, wob = Math.sin(t * 3 + x) * 0.6;
  ctx.beginPath(); ctx.ellipse(x + wob * 0.3, y - 21 * k, 3.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 17 * k); ctx.lineTo(x + 5, y - 17 * k); ctx.lineTo(x + 4 + wob, y); ctx.lineTo(x - 4 + wob, y); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * 0.3; ctx.fillRect(x - 5 + i * 3 + Math.sin(t * 5 + i) * 1.5, y - 8 * k + Math.cos(t * 4 + i) * 2, 1.2, 4); }   // smoking edges
}
function spider(ctx, x, y, s, ph, ang, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.45 * s;
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = ang + side * (0.5 + i * 0.45), wig = Math.sin((ph || 0) + i * 1.7 + (side > 0 ? 1 : 0)) * 0.35;
    const kx = x + Math.cos(a + wig) * 2.2 * s, ky = y + Math.sin(a + wig) * 2.2 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky - 0.8 * s); ctx.lineTo(x + Math.cos(a + wig) * 3.6 * s, y + Math.sin(a + wig) * 3.6 * s); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(x - Math.cos(ang) * 1.2 * s, y - Math.sin(ang) * 1.2 * s, 1.5 * s, 1.2 * s, ang, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + Math.cos(ang) * 0.6 * s, y + Math.sin(ang) * 0.6 * s, 0.8 * s, 0.7 * s, 0, 0, Math.PI * 2); ctx.fill();
}
function person(ctx, t, time) {
  const hd = G.hd && G.hd.get(G.assets.character(t.look)), a = t.a * Math.min(1, t.life);
  if (t.gone) {   // for a second, a shadow wearing their outline
    shadowPerson(ctx, t.x, t.y, a * 0.9, 1, time); ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = a * (0.85 + Math.sin(time * 7 + t.x) * 0.08);
  if (hd) ctx.drawImage(hd.img, G.hd.COL.talk * G.hd.FW, 0, G.hd.FW, G.hd.FH, Math.round(t.x - G.hd.WW / 2), Math.round(t.y - G.hd.WH + 1), G.hd.WW, G.hd.WH);
  else shadowPerson(ctx, t.x, t.y, a, 1, time);
  // they talk: a quiet line over their head, only while near
  if (t.t > 0.6 && t.t < 5 && G.facades) {
    const img = G.facades.textImg(t.line, 5, '#e8e4dc'), w = img.w;
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = 'rgba(10,8,12,0.7)'; ctx.fillRect(t.x - w / 2 - 2, t.y - 33, w + 4, 8);
    ctx.drawImage(img.c, t.x - w / 2, t.y - 32, w, 5);
  }
  ctx.globalAlpha = 1;
}

PL.draw = function (ctx, scene) {
  const d = scene.delir, p = scene.player;
  if (!d || !E.has(p, 'delirium')) { scene.delir = null; return; }
  const R = G.renderer, L = d.L || 0.5, time = G.loop.time;
  R.worldTransform();
  for (const s of d.spiders) { ctx.globalAlpha = Math.min(1, s.life) * 0.95; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 1, 2.5 * s.s, 1 * s.s, 0, 0, Math.PI * 2); ctx.fill(); spider(ctx, s.x, s.y, s.s, s.ph, s.ang, '#120c0e'); }
  for (const s of d.shadows) shadowPerson(ctx, s.x, s.y, s.a * Math.min(1, s.life), s.h, time);
  for (const t of d.talkers) person(ctx, t, time);
  if (d.hat) hatMan(ctx, d.hat.x, d.hat.y, d.hat.a * Math.min(1, d.hat.life * 2));
  ctx.globalAlpha = 1;
  R.screenTransform();
  const W = R.W, H = R.H, cv = ctx.canvas;
  // blurred double vision drifting in and out
  const dv = (0.12 + L * 0.2) * (0.5 + 0.5 * Math.sin(time * 0.7));
  if (dv > 0.05) { const o = (2 + L * 6) * (W / 640) * Math.sin(time * 0.43); ctx.globalAlpha = dv; ctx.drawImage(cv, o, o * 0.4); ctx.globalAlpha = 1; }
  // colors drain out, light swells and dims
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${(0.25 + L * 0.45).toFixed(2)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(10,6,12,${(0.12 + 0.12 * Math.sin(time * 0.9 + Math.sin(time * 2.3))) * L})`; ctx.fillRect(0, 0, W, H);
  // crawling veins over everything
  ctx.strokeStyle = `rgba(20,8,16,${(0.12 + L * 0.18).toFixed(2)})`; ctx.lineWidth = Math.max(1, W / 900);
  for (let i = 0; i < 6 + L * 10; i++) {
    const sx = ((i * 0.6180339 * W + time * 6 * (i % 2 ? 1 : -1)) % W + W) % W, sy = ((i * 0.381966 * H * 1.7) % H);
    ctx.beginPath(); ctx.moveTo(sx, sy);
    for (let k = 1; k < 8; k++) ctx.lineTo(sx + Math.sin(k * 1.3 + i + time * 0.5) * k * W / 90, sy + k * H / 40 + Math.cos(k + i * 2 + time * 0.4) * W / 120);
    ctx.stroke();
  }
  // visual snow
  const n = Math.round(80 + L * 160), ps = Math.max(1, Math.round(W / 640));
  for (let i = 0; i < n; i++) { const c = Math.random() < 0.5 ? 255 : 0; ctx.fillStyle = `rgba(${c},${c},${c},${(0.1 + Math.random() * 0.2).toFixed(2)})`; ctx.fillRect(Math.random() * W, Math.random() * H, ps, ps); }
  // a face in the noise, for a moment
  if (L > 0.5 && (Math.floor(time * 0.25) % 5 === 0) && ((time * 0.25) % 1) < 0.08) {
    const fx = W * (0.2 + 0.6 * ((Math.floor(time * 0.25) * 0.618) % 1)), fy = H * 0.4, fr = H * 0.12;
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(fx - fr * 0.35, fy, fr * 0.14, fr * 0.2, 0, 0, Math.PI * 2); ctx.ellipse(fx + fr * 0.35, fy, fr * 0.14, fr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx, fy + fr * 0.55, fr * 0.3, fr * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  // spiders crawling over your eyes
  for (const b of d.bugs) spider(ctx, b.x * W, b.y * H, b.s * 3.2 * (W / 640), b.ph, b.ang, `rgba(8,4,6,${Math.min(1, b.life).toFixed(2)})`);
  // tunnel vision with the racing pulse
  const pulse = 0.5 + L * 0.2 + Math.sin(time * (E.has(p, 'anticholinergic') ? 14 : 8)) * 0.1;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * (0.22 - L * 0.08), W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(16,0,8,${Math.min(0.95, pulse).toFixed(2)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // blackouts
  if (d.black) { const b = d.black, k = b.t < b.dur * 0.5 ? b.t / (b.dur * 0.5) : 1 - (b.t - b.dur * 0.5) / (b.dur * 0.5); ctx.fillStyle = `rgba(0,0,0,${Math.min(1, k * 1.4).toFixed(2)})`; ctx.fillRect(0, 0, W, H); }
  else if (Math.random() < 0.01 * L) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H); }
};
})();
