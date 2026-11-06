'use strict';
// HD effects on the ground:
//   Blood pools: an uneven outline (lobes rolled from the pool's seed), a darker rim where it thickens, a wet
//     highlight while fresh, and drying over the days from glossy red to a matte brown-black crust.
//   Splats: a drop with a direction, a tail and satellite droplets thrown the same way, not a round dot.
//   Trails: smeared drag marks. Gibs: little wet chunks with a dark edge.
//   Skid marks: rubber streaks joined into lines instead of separate squares.
//   Bullet casings: brass that spins out of the gun, bounces, then lies on the ground and glints.
//   Water splashes: a crown of droplets and an expanding ring.
(() => {
const hash = (s, k) => { const v = Math.sin(s * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
// dried blood: fresh red -> dark red -> brown
const tone = (age, fresh) => (age === 0 ? (fresh ? [128, 10, 12] : [104, 8, 10]) : age === 1 ? [70, 10, 8] : [52, 20, 14]);

function blob(ctx, x, y, r, seed, sq = 0.55, lobes = 9) {
  ctx.beginPath();
  for (let k = 0; k <= lobes * 2; k++) {
    const a = (k / (lobes * 2)) * Math.PI * 2, j = k % (lobes * 2);
    const rr = r * (0.78 + 0.34 * hash(seed, j) + (j % 2 ? 0.08 : -0.04));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * sq;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGore(ctx, scene, view) {
  const list = G.gore.list(scene), day = scene.world.day, now = G.loop.time;
  for (let i = list.length - 1; i >= 0; i--) if (day - list[i].day > 2) list.splice(i, 1);
  for (const d of list) {
    if (d.x < view.x - 24 || d.x > view.x + view.w + 24 || d.y < view.y - 24 || d.y > view.y + view.h + 24) continue;
    const age = day - d.day, a = (age === 0 ? 0.9 : age === 1 ? 0.72 : 0.5) * (1 - (d.clean || 0) * 0.9), seed = d.seed || 7;   // (d.clean: being scrubbed away, js/game/ems.js)
    const fresh = d.born != null && now - d.born < 90;
    const [cr, cg, cb] = tone(age, fresh);
    if (d.type === 'pool') {
      const r = d.born != null ? Math.min(d.grow, 3 + (now - d.born) * 3) : d.grow * (1 - (d.clean || 0) * 0.6);
      ctx.fillStyle = `rgba(${cr * 0.6 | 0},${cg * 0.6 | 0},${cb * 0.6 | 0},${a})`; blob(ctx, d.x, d.y, r + 0.8, seed); ctx.fill();   // the thick dark rim
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`; blob(ctx, d.x, d.y, r, seed); ctx.fill();
      // a couple of side runs where it found a dip
      for (let k = 0; k < 2; k++) { const ang = hash(seed, 30 + k) * Math.PI * 2, rr = r * (0.9 + hash(seed, 40 + k) * 0.4); blob(ctx, d.x + Math.cos(ang) * rr * 0.8, d.y + Math.sin(ang) * rr * 0.45, r * 0.3, seed + k + 1, 0.6, 6); ctx.fill(); }
      if (age === 0) {   // wet: a soft highlight and a glint
        ctx.fillStyle = `rgba(190,40,40,${fresh ? 0.45 : 0.22})`; blob(ctx, d.x - r * 0.25, d.y - r * 0.14, r * 0.45, seed + 3, 0.45, 6); ctx.fill();
        if (fresh) { ctx.fillStyle = 'rgba(255,200,200,0.55)'; ctx.fillRect(Math.round(d.x - r * 0.35), Math.round(d.y - r * 0.22), 2, 1); }
      } else { ctx.fillStyle = `rgba(20,6,4,${a * 0.35})`; for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(d.x + (hash(seed, k) - 0.5) * r * 1.4), Math.round(d.y + (hash(seed, k + 9) - 0.5) * r * 0.7), 1, 1); }   // crust
    } else if (d.type === 'trail') {
      const ang = hash(seed, 1) * 0.8 - 0.4;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(ang);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.75})`; ctx.fillRect(-3, -1, 6, 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.4})`; ctx.fillRect(-5, -0.5, 10, 1); ctx.fillRect(-2, 1, 4, 1);
      ctx.restore();
    } else if (d.type === 'gib') {
      const x = Math.round(d.x), y = Math.round(d.y), s = 1 + Math.round(hash(seed, 2) * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.7})`; ctx.fillRect(x - 1, y, s + 2, 2);   // the smear under it
      ctx.fillStyle = `rgba(110,24,24,${a})`; ctx.fillRect(x, y - 1, s + 1, s);
      ctx.fillStyle = `rgba(200,120,120,${a})`; ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillStyle = `rgba(40,4,4,${a})`; ctx.fillRect(x + s, y - 1 + s - 1, 1, 1);
    } else {
      // a splat: the drop, a tail pointing away from the blow, droplets flung further along
      const ang = d.ang != null ? d.ang : hash(seed, 5) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang) * 0.6, r = d.r || 2;
      ctx.fillStyle = `rgba(${cr + 20},${cg + 4},${cb + 4},${a})`; blob(ctx, d.x, d.y, r, seed, 0.6, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(d.x - s * r * 0.7, d.y + c * r * 0.4); ctx.lineTo(d.x + c * r * 2.6, d.y + s * r * 2.6); ctx.lineTo(d.x + s * r * 0.7, d.y - c * r * 0.4); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 4; k++) { const t = 2.4 + hash(seed, 10 + k) * 4, off = (hash(seed, 20 + k) - 0.5) * 3; ctx.fillRect(Math.round(d.x + c * r * t - s * off), Math.round(d.y + s * r * t + c * off * 0.6), 1, 1); }
    }
  }
}

function drawSkids(ctx, scene, view) {
  const w = scene.world, sk = (w.skids && w.skids[scene.map.id]) || [], day = w.day;
  for (let i = sk.length - 1; i >= 0; i--) if (day - sk[i].day > 1) sk.splice(i, 1);
  ctx.strokeStyle = 'rgba(18,18,20,0.32)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  // marks come in pairs (left and right wheel) pushed one after the other: join each to its partner from the
  // previous pair when close, so a skid reads as two streaks
  for (let i = 2; i < sk.length; i++) {
    const a = sk[i - 2], b = sk[i];
    if (b.x < view.x - 10 || b.x > view.x + view.w + 10 || b.y < view.y - 10 || b.y > view.y + view.h + 10) continue;
    const dd = Math.hypot(a.x - b.x, a.y - b.y);
    if (dd > 0.3 && dd < 9) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } else { ctx.moveTo(b.x - 0.8, b.y); ctx.lineTo(b.x + 0.8, b.y); }
  }
  ctx.stroke();
}

G.gore.draw = function (ctx, scene, view) {
  drawSkids(ctx, scene, view);
  if (this.on()) drawGore(ctx, scene, view);
  drawCasings(ctx, scene, view);
};
// splats remember which way the blood flew, so the tail points away from the blow
const _onHit = G.gore.onHit;
G.gore.onHit = function (scene, target, source) {
  const list = this.list(scene), n0 = list.length;
  const r = _onHit.apply(this, arguments);
  if (source && source.x != null && target) { const ang = Math.atan2(target.y - source.y, target.x - source.x); for (let i = n0; i < list.length; i++) if (list[i].type === 'splat' && list[i].ang == null) list[i].ang = ang; }
  return r;
};

// ---------------------------------------------------------------- brass
const CAS = [];
G.effectsHD = {
  casing(x, y, dir, shell) {
    const side = dir === 1 ? -1 : 1;   // thrown out to the right of the gun
    CAS.push({ x, y: y - 10, z: 10, vx: side * (30 + Math.random() * 30), vy: (Math.random() - 0.5) * 20, vz: 40 + Math.random() * 25, spin: Math.random() * 6, t: 0, shell: !!shell, rest: false });
    const cap = G.gfxLevel().casings; if (CAS.length > cap) CAS.splice(0, CAS.length - cap);
    const sc = G.scenes && G.scenes.stack.find((s) => s.map); if (sc && CAS._map == null) CAS._map = sc.map.id;
  },
  casings: CAS,
  splash(scene, x, y, big) {
    if (!scene) return;
    (scene._splashes = scene._splashes || []).push({ x, y, t: 0, big: !!big });
  },
};
function drawCasings(ctx, scene, view) {
  const dt = Math.max(0, Math.min(0.05, G.loop.time - (drawCasings._t || G.loop.time))); drawCasings._t = G.loop.time;
  if (scene.map && CAS._map !== scene.map.id) { CAS.length = 0; CAS._map = scene.map.id; }   // a new map: the brass stays behind
  for (const c of CAS) {
    if (!c.rest) {
      c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vz -= 220 * dt; c.z += c.vz * dt; c.spin += dt * 25;
      if (c.z <= 0) { c.z = 0; if (Math.abs(c.vz) < 25) { c.rest = true; if (G.audio && Math.random() < 0.6) G.audio.play('step', { x: c.x, y: c.y, vol: 0.15, surface: 'metal' }); } else { c.vz = -c.vz * 0.35; c.vx *= 0.5; c.vy *= 0.5; } }
    }
    if (c.x < view.x - 8 || c.x > view.x + view.w + 8 || c.y < view.y - 8 || c.y > view.y + view.h + 8) continue;
    const x = Math.round(c.x), y = Math.round(c.y - c.z), horiz = c.rest ? (Math.floor(c.x + c.y) % 2 === 0) : Math.floor(c.spin) % 2 === 0;
    if (!c.rest) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(c.x), Math.round(c.y), 2, 1); }
    ctx.fillStyle = c.shell ? '#b02a22' : '#c8a040'; ctx.fillRect(x, y, horiz ? 2 : 1, horiz ? 1 : 2);
    ctx.fillStyle = c.shell ? '#d8b040' : '#f0d878'; ctx.fillRect(x, y, 1, 1);
    if (c.rest && Math.sin(G.loop.time * 2 + c.x) > 0.97) { ctx.fillStyle = 'rgba(255,250,210,0.9)'; ctx.fillRect(x, y - 1, 1, 1); }   // the odd glint
  }
  // splashes: a crown of drops and a ring
  const sp = scene._splashes || [];
  for (const s of sp) {
    s.t += dt; const k = s.t / (s.big ? 0.9 : 0.6), R = (s.big ? 10 : 6) * k;
    ctx.strokeStyle = `rgba(220,240,255,${(0.7 * (1 - k)).toFixed(2)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, R, R * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    if (k < 0.6) { ctx.fillStyle = `rgba(230,245,255,${(0.9 * (1 - k / 0.6)).toFixed(2)})`; for (let i = 0; i < (s.big ? 10 : 6); i++) { const a = (i / (s.big ? 10 : 6)) * Math.PI * 2, h = Math.sin(k / 0.6 * Math.PI) * (s.big ? 9 : 5); ctx.fillRect(Math.round(s.x + Math.cos(a) * R * 0.8), Math.round(s.y + Math.sin(a) * R * 0.35 - h), 1, 1); } }
  }
  if (sp.length) scene._splashes = sp.filter((s) => s.t < (s.big ? 0.9 : 0.6));

}
})();
