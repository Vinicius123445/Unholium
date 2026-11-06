'use strict';
// HD vehicles: every car, the police car, the limo, motorcycles and bicycles drawn at twice the pixel
// density (same size in the world, smoother when they turn), with shaded bodywork, glass with
// reflections, door seams, mirrors, bumpers, lights and tyres. Alive on the road: brake lights glow when
// they slow, exhaust puffs when they speed up, the body rolls a little in turns and bobs at speed, dents,
// scratches and a cracked windshield as they take damage, smoke when badly hurt.
// Parked (decor) cars use the same art.
(() => {
const A = G.assets, V = G.vehicles, MODELS = V.MODELS, sh = A.shade;
const hd = {};

function car(id, m) {
  const L = (m.len + 2) * 2, W = (m.wid + 2) * 2, c = document.createElement('canvas'); c.width = L; c.height = W;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const body = m.body, lt = sh(body, 1.18), dk = sh(body, 0.72), dd = sh(body, 0.55);
  const r = 4;
  // tyres peeking out at the corners
  for (const [tx, ty] of [[6, 1], [6, W - 5], [L - 14, 1], [L - 14, W - 5]]) { R(tx, ty, 8, 4, '#141416'); R(tx + 1, ty + (ty < 4 ? 0 : 3), 6, 1, '#3a3a3e'); }
  // the body: a rounded rectangle, darker toward the sides
  for (let y = 2; y < W - 2; y++) {
    const e = Math.min(y - 2, W - 3 - y), inset = e < r ? r - Math.round(Math.sqrt(r * r - (r - e) * (r - e))) : 0;
    const col = e < 2 ? dd : e < 4 ? dk : body;
    R(2 + inset, y, L - 4 - inset * 2, 1, col);
  }
  const cab = m.cab || sh(body, 1.1);
  const ws = Math.round(L * 0.6), rw = Math.round(L * 0.2), roofEnd = ws;
  // hood crease and the trunk line
  R(ws + 10, W / 2 - 1, L - ws - 14, 1, lt); R(ws + 10, W / 2, L - ws - 14, 1, dk);
  R(rw - 5, 5, 1, W - 10, dk);
  // roof
  R(rw + 6, 6, roofEnd - rw - 6, W - 12, cab); R(rw + 6, 6, roofEnd - rw - 6, 2, sh(cab, 1.15));
  R(rw + 8, W / 2 - 1, roofEnd - rw - 12, 2, sh(cab, 1.25));   // a highlight across the roof
  // glass: windshield, rear window, side windows, with reflections
  for (let i = 0; i < 8; i++) R(ws + i, 5 + Math.floor(i / 3), 1, W - 10 - Math.floor(i / 3) * 2, i < 2 ? '#2a3a4e' : '#4a6a8a');
  R(ws + 3, 7, 1, W - 16, '#a8c8e0'); R(ws + 5, 8, 1, 4, '#d8e8f4');
  for (let i = 0; i < 6; i++) R(rw + i, 6, 1, W - 12, '#3a5068');
  R(rw + 2, 8, 1, 3, '#9ab8d0');
  R(rw + 6, 4, roofEnd - rw - 6, 2, '#3a5068'); R(rw + 6, W - 6, roofEnd - rw - 6, 2, '#3a5068');   // side windows
  R(Math.round((rw + roofEnd) / 2), 4, 1, 2, dd); R(Math.round((rw + roofEnd) / 2), W - 6, 1, 2, dd);   // the B-pillar
  // door seams and handles
  for (const sx of [rw + 4, Math.round((rw + roofEnd) / 2) + 1, roofEnd + 2]) { R(sx, 2, 1, 3, dd); R(sx, W - 5, 1, 3, dd); }
  R(rw + 10, 3, 2, 1, sh(body, 1.35)); R(rw + 10, W - 4, 2, 1, sh(body, 1.35));
  // mirrors
  R(ws - 1, 0, 3, 2, dk); R(ws - 1, W - 2, 3, 2, dk);
  // bumpers and lights
  R(L - 3, 4, 2, W - 8, '#2a2a2e'); R(1, 4, 2, W - 8, '#2a2a2e');
  R(L - 4, 3, 3, 4, '#f8f2d0'); R(L - 4, W - 7, 3, 4, '#f8f2d0'); R(L - 3, 4, 1, 2, '#ffffff'); R(L - 3, W - 6, 1, 2, '#ffffff');
  R(1, 3, 3, 4, '#b02020'); R(1, W - 7, 3, 4, '#b02020');
  if (id === 'limo') { R(rw + 10, 4, roofEnd - rw - 20, 2, '#22222a'); R(rw + 10, W - 6, roofEnd - rw - 20, 2, '#22222a'); R(rw + 14, 7, 1, W - 14, sh(cab, 0.8)); }
  if (m.siren) {   // police: a white cab, a light bar, a stripe
    R(Math.round(L * 0.44), 5, 4, Math.floor((W - 10) / 2), '#d02828'); R(Math.round(L * 0.44), 5 + Math.floor((W - 10) / 2), 4, Math.ceil((W - 10) / 2), '#2850d0');
    R(Math.round(L * 0.44) + 1, 6, 1, 2, '#ff8080'); R(Math.round(L * 0.44) + 1, W - 8, 1, 2, '#80a0ff');
    R(ws + 10, 2, L - ws - 14, 1, '#e8e4dc'); R(ws + 10, W - 3, L - ws - 14, 1, '#e8e4dc');
  }
  A.outline(c, [16, 14, 20, 230]);
  return c;
}
// a motorcycle seen from above (front to the right): knobbly tyres under fenders, the swingarm, a finned
// engine, a chrome exhaust, a stitched seat, a glossy tank, fork legs, the headlight, bars with grips,
// levers and round mirrors, a tail light
function moto(id, m) {
  const L = (m.len + 2) * 2, W = (m.wid + 2) * 2, c = document.createElement('canvas'); c.width = L; c.height = W;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const mid = Math.floor(W / 2), body = m.body, lt = sh(body, 1.3), dk = sh(body, 0.7), dd = sh(body, 0.5);
  const tyre = (x0) => {
    R(x0 + 1, mid - 3, 10, 6, '#141416'); R(x0, mid - 2, 12, 4, '#141416');
    for (let i = 1; i < 11; i += 2) { R(x0 + i, mid - 3, 1, 1, '#2e2e32'); R(x0 + i, mid + 2, 1, 1, '#2e2e32'); }   // tread blocks
    R(x0 + 2, mid - 1, 8, 1, '#3a3a40');
  };
  tyre(1); tyre(L - 13);
  R(4, mid - 2, 9, 4, dk); R(5, mid - 2, 7, 1, body);                       // rear fender
  R(10, mid - 1, 10, 2, '#3a3a40'); R(10, mid - 1, 10, 1, '#5a5a62');      // swingarm
  R(18, mid - 6, 12, 12, '#2e2e34');                                          // engine
  for (let i = 19; i < 30; i += 2) R(i, mid - 6, 1, 12, '#4a4a54');           // cooling fins
  R(20, mid - 3, 8, 6, '#3a3a42'); R(21, mid - 2, 3, 2, '#7a7a84');
  R(5, mid + 5, 22, 2, '#a8acb4'); R(5, mid + 5, 22, 1, '#e8ecf4'); R(3, mid + 5, 3, 2, '#2a2a2e');   // exhaust, dark tip
  R(13, mid - 4, 15, 8, '#18161a'); R(14, mid - 3, 13, 1, '#34303a'); R(14, mid + 2, 13, 1, '#0e0c10');   // seat
  for (let i = 15; i < 27; i += 3) R(i, mid, 1, 1, '#2a2630');                // stitching
  // tank: rounded, glossy
  R(29, mid - 4, 13, 8, body); R(28, mid - 3, 15, 6, body);
  R(29, mid - 4, 13, 1, dk); R(29, mid + 3, 13, 1, dd); R(30, mid - 3, 11, 1, lt);
  R(32, mid - 2, 5, 1, '#ffffff'); R(33, mid - 1, 2, 1, sh(body, 1.6));       // specular glint
  R(40, mid - 1, 2, 2, '#c8ccd4');                                            // filler cap
  R(43, mid - 4, 9, 1, '#c8ccd4'); R(43, mid + 3, 9, 1, '#c8ccd4');            // fork legs
  R(L - 12, mid - 2, 9, 4, dk); R(L - 11, mid - 2, 7, 1, body);              // front fender
  R(L - 15, mid - 3, 4, 6, '#d8dce4'); R(L - 14, mid - 2, 2, 4, '#fff6d0');    // headlight
  R(L - 19, 2, 2, W - 4, '#9aa0aa'); R(L - 19, 2, 1, W - 4, '#d0d4dc');        // handlebar
  R(L - 19, 0, 3, 3, '#141416'); R(L - 19, W - 3, 3, 3, '#141416');            // grips
  R(L - 17, 3, 3, 1, '#7a7e86'); R(L - 17, W - 4, 3, 1, '#7a7e86');            // levers
  for (const my of [1, W - 3]) { R(L - 23, my, 3, 2, '#2a2a30'); R(L - 22, my, 1, 1, '#c8e0f0'); }   // mirrors
  R(1, mid - 1, 2, 2, '#e02a2a'); R(1, mid - 1, 1, 1, '#ff8a8a');            // tail light
  A.outline(c, [16, 14, 20, 230]);
  return c;
}
// a bicycle seen from above: thin tyres with hubs, the frame tubes, the chainring and chain, pedals on
// their cranks, a saddle, the stem, flat bars with grips and a bell
function bike(id, m) {
  const L = (m.len + 2) * 2, W = (m.wid + 4) * 2, c = document.createElement('canvas'); c.width = L; c.height = W;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const mid = Math.floor(W / 2), body = m.body, lt = sh(body, 1.35), dk = sh(body, 0.65);
  for (const x0 of [0, L - 12]) { R(x0 + 1, mid - 1, 10, 2, '#18181c'); R(x0, mid - 1, 1, 2, '#2a2a2e'); R(x0 + 11, mid - 1, 1, 2, '#2a2a2e'); R(x0 + 2, mid - 1, 8, 1, '#3a3a40'); R(x0 + 5, mid - 1, 2, 2, '#9aa0aa'); }
  R(6, mid + 1, 11, 1, '#5a5a62');                                            // chain
  R(8, mid - 1, 22, 2, body); R(9, mid - 1, 20, 1, lt); R(12, mid + 1, 12, 1, dk);   // top and down tubes
  R(4, mid - 2, 8, 1, dk); R(4, mid + 1, 8, 1, dk);                           // seat stays
  R(14, mid + 1, 4, 3, '#7a7e86'); R(15, mid + 2, 2, 1, '#b8bcc4');          // chainring
  R(15, mid - 5, 2, 10, '#5a5a62'); R(14, mid - 6, 4, 2, '#2a2a2e'); R(14, mid + 4, 4, 2, '#2a2a2e');   // cranks and pedals
  R(8, mid - 2, 7, 4, '#2a2420'); R(14, mid - 1, 2, 2, '#2a2420'); R(9, mid - 2, 5, 1, '#4a3a30');      // saddle, nose forward
  R(L - 12, mid - 1, 3, 2, '#7a7e86');                                        // stem
  R(L - 11, 2, 2, W - 4, '#9aa0aa'); R(L - 11, 2, 1, W - 4, '#d0d4dc');        // bars
  R(L - 11, 0, 2, 3, '#18181c'); R(L - 11, W - 3, 2, 3, '#18181c');            // grips
  R(L - 13, 3, 2, 2, '#e8c040');                                              // bell
  A.outline(c, [16, 14, 20, 230]);
  return c;
}
function build() {
  for (const id in MODELS) {
    const m = MODELS[id];
    hd[id] = m.bike ? bike(id, m) : m.moto ? moto(id, m) : car(id, m);
  }
}
G.vehiclesHD = { get: (model) => { if (!hd[model]) build(); return hd[model]; } };

// driving: the HD body, rolling into turns, bobbing at speed, brake lights, exhaust, damage
const VP = G.Vehicle.prototype;
VP.draw = function (ctx) {
  const img = G.vehiclesHD.get(this.model);
  const spr = A.sprites['veh_' + this.model];
  if (!img || !spr) return;
  const st = this._vh || (this._vh = { lastSp: 0, lastA: this.angle, roll: 0, puffs: [] });
  const dt = Math.min(0.1, Math.max(0.001, G.loop.time - (st.t || G.loop.time))); st.t = G.loop.time;
  const sp = this.speed || 0, accel = (sp - st.lastSp) / dt; st.lastSp = sp;
  let da = this.angle - st.lastA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; st.lastA = this.angle;
  st.roll += ((da / dt) * Math.abs(sp) * 0.004 - st.roll) * Math.min(1, dt * 8);
  const braking = accel < -40 && Math.abs(sp) > 5, moto = this.m.moto, bike = this.m.bike;
  // exhaust puffs when accelerating (not bikes)
  if (!bike && accel > 30 && Math.random() < dt * 14) st.puffs.push({ x: this.x - Math.cos(this.angle) * this.L, y: this.y - Math.sin(this.angle) * this.L, t: 0 });
  st.puffs = st.puffs.filter((p) => (p.t += dt) < 0.8);
  for (const p of st.puffs) { ctx.fillStyle = `rgba(160,160,165,${(0.35 * (1 - p.t / 0.8)).toFixed(2)})`; ctx.beginPath(); ctx.arc(p.x - Math.cos(this.angle) * p.t * 10, p.y - Math.sin(this.angle) * p.t * 10 - p.t * 4, 1.2 + p.t * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.save();
  ctx.translate(Math.round(this.x * 2) / 2, Math.round(this.y * 2) / 2);
  // the shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 3, this.L + 2, this.Wd + 1, this.angle, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(this.angle);
  const bob = Math.abs(sp) > 40 ? Math.sin(G.loop.time * 18 + this.x) * 0.25 : 0;
  ctx.translate(0, G.util.clamp(st.roll, -1, 1) + bob);   // body roll: leans out of the turn
  if (this.hurtT > 0) ctx.globalAlpha = 0.75;
  ctx.drawImage(img, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
  ctx.globalAlpha = 1;
  const hw = spr.w / 2, hh = spr.h / 2;
  // brake lights
  if (braking && !bike) { ctx.fillStyle = 'rgba(255,40,30,0.95)'; if (moto) ctx.fillRect(-hw, -0.5, 1.5, 1); else { ctx.fillRect(-hw + 0.5, -hh + 1.5, 1.5, 2); ctx.fillRect(-hw + 0.5, hh - 3.5, 1.5, 2); } }
  // damage: dents, scratches, a cracked windshield
  const dmg = 1 - Math.max(0, this.hp) / this.m.hp;
  if (dmg > 0.2 && !bike) {
    const r = new G.RNG((this.id || this.model) + 'dmg'), n = Math.floor(dmg * 10);
    for (let i = 0; i < n; i++) { ctx.fillStyle = r.chance(0.5) ? 'rgba(20,20,24,0.45)' : 'rgba(220,220,220,0.35)'; ctx.fillRect(-hw + 2 + r.range(0, spr.w - 4), -hh + 1 + r.range(0, spr.h - 2), r.range(0.5, 2), 0.5); }
    if (dmg > 0.45 && !moto) { ctx.strokeStyle = 'rgba(230,240,250,0.8)'; ctx.lineWidth = 0.4; const wx = spr.w * 0.1 + 2; ctx.beginPath(); ctx.moveTo(wx, -2); ctx.lineTo(wx + 1.5, 0); ctx.lineTo(wx, 2); ctx.moveTo(wx + 1.5, 0); ctx.lineTo(wx + 0.5, 1); ctx.stroke(); ctx.lineWidth = 1; }
  }
  // the rider on a bike or motorcycle
  if (moto && (this.driver || this.ai) && G.riders) { ctx.save(); ctx.translate(bike ? -1 : -2.5, 0); ctx.scale(1.6, 1.6); G.riders.draw(ctx, this, bike); ctx.restore(); }   // a seated rider, seen from above (js/game/riders.js)
  ctx.restore();
  if (this.burning) { for (let i = 0; i < 4; i++) { const t = G.loop.time * 8 + i * 1.7; ctx.fillStyle = ['#ffd040', '#ff8a2a', '#d84a1a', '#ffe8a0'][i]; ctx.fillRect(this.x + Math.sin(t) * this.L * 0.5, this.y - 4 - Math.abs(Math.sin(t * 1.3)) * 5, 1.5, 2); } }
  if (this.hp < this.m.hp * 0.35 && !bike) { ctx.fillStyle = 'rgba(70,70,70,0.45)'; ctx.beginPath(); ctx.arc(this.x + Math.cos(this.angle) * (this.L - 4) + Math.sin(G.loop.time * 9) * 2, this.y + Math.sin(this.angle) * (this.L - 4) - 4 - (G.loop.time * 12 % 8), 2.5 + Math.sin(G.loop.time * 5), 0, Math.PI * 2); ctx.fill(); }
};

// parked cars (decor) use the HD art too
const _dd = G.drawDecor;
G.drawDecor = function (ctx, o, s, scene) {
  if (MODELS[o.type]) {
    const img = G.vehiclesHD.get(o.type);
    if (img) { ctx.drawImage(img, Math.round(o.x - s.ax), Math.round(o.y - s.ay), s.w, s.h); return; }
  }
  return _dd ? _dd.call(this, ctx, o, s, scene) : ctx.drawImage(s.img, Math.round(o.x - s.ax), Math.round(o.y - s.ay));
};
})();
