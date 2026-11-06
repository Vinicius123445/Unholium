'use strict';
// The HUD, redrawn in the game's look: a street-noir "ID card" with a heartbeat line, ring gauges for food,
// water and sleep, a banknote for cash; a green street sign for where you are, graffiti tags for gang turf,
// a WANTED poster for your bounty, the minimap in a GPS frame, a weapon card with bullet pips.
// No clock: the time is on your phone, or on your wrist if you carry a watch (then a little watch face shows).
(() => {
const U = G.ui, H = G.hud;
const C = { card: '#181818', cardHi: '#272726', line: '#535251', ink: '#cec6b4', dim: '#91908f', gold: '#c5b083' };
const lerpCol = (a, b, t) => { const A = G.assets; return A.mix(a, b, G.util.clamp(t, 0, 1)); };
const hpColor = (r) => (r > 0.5 ? lerpCol('#c2ab76', '#a3c7b7', (r - 0.5) * 2) : lerpCol('#c16461', '#c2ab76', r * 2));
H.hasWatch = (p) => p.inventory.slots.some((s) => s && G.ITEMS[s.id] && G.ITEMS[s.id].watch) || (p.equip.trinket && G.ITEMS[p.equip.trinket] && G.ITEMS[p.equip.trinket].watch);

function card(ctx, x, y, w, h, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = C.card; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.cardHi; for (let gy = y + 4; gy < y + h; gy += 6) ctx.fillRect(x + 4, gy, w - 8, 1);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(x, y, 3, h); }
}
function ring(ctx, cx, cy, r, frac, col, icon) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2f2f2e'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * G.util.clamp(frac, 0, 1)); ctx.stroke();
  ctx.lineWidth = 1;
  const P = (px, py, c) => { ctx.fillStyle = c; ctx.fillRect(cx + px, cy + py, 1, 1); };
  const R = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + px, cy + py, w, h); };
  if (icon === 'food') { R(-3, -3, 6, 2, '#b69e72'); R(-3, -1, 6, 1, '#593e2f'); R(-3, 0, 6, 1, '#534654'); R(-3, 1, 6, 2, '#b69e72'); }
  if (icon === 'water') { P(0, -3, '#b4afa6'); R(-1, -2, 3, 1, '#b4afa6'); R(-2, -1, 5, 3, '#b4afa6'); R(-1, 2, 3, 1, '#b4afa6'); P(-1, -1, '#eeece9'); }
  if (icon === 'sleep') { R(-2, -3, 3, 1, '#deddda'); R(-3, -2, 2, 4, '#deddda'); R(-2, 2, 3, 1, '#deddda'); P(2, -3, '#deddda'); }
}
// phase: heartbeats counted so far (accumulated by the caller, so a changing rate never makes the trace jump)
function ecg(ctx, x, y, w, h, phase, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath();
  const mid = y + h / 2;
  for (let i = 0; i <= w; i++) {
    const ph = (((i / w) * 1.6 + phase) % 1);
    let v = 0;
    if (ph > 0.42 && ph < 0.46) v = -0.25; else if (ph >= 0.46 && ph < 0.5) v = 1; else if (ph >= 0.5 && ph < 0.54) v = -0.6; else if (ph > 0.62 && ph < 0.72) v = 0.18 * Math.sin((ph - 0.62) / 0.1 * Math.PI);
    const yy = mid - v * (h / 2);
    if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy);
  }
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = col; ctx.globalAlpha = 0.18; ctx.fillRect(x, mid, w, 1); ctx.globalAlpha = 1;
}
function hexBadge(ctx, cx, cy, r, level, xpFrac, glow) {
  ctx.fillStyle = glow ? '#2f291a' : '#222222'; ctx.strokeStyle = glow ? C.gold : '#737271';
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#a49f96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xpFrac); ctx.stroke(); ctx.lineWidth = 1;
  U.text(ctx, String(level), cx, cy - 4, { size: 8, align: 'center', weight: 'bold', color: glow ? C.gold : C.ink, shadow: false });
}
function watch(ctx, x, y, w) {
  // strap, case, face, hands, and a digital line under it
  ctx.fillStyle = '#282422'; ctx.fillRect(x - 5, y - 18, 10, 36);
  ctx.fillStyle = '#a3a2a1'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d5cdbc'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f3b3f'; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.fillRect(x + Math.cos(a) * 8 - 0.5, y + Math.sin(a) * 8 - 0.5, 1, 1); }
  const m = w.minutes, hA = ((m / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2, mA = (m % 60) / 60 * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(hA) * 5, y + Math.sin(hA) * 5); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(mA) * 8, y + Math.sin(mA) * 8); ctx.stroke();
  ctx.fillStyle = '#a44e4e'; ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  ctx.fillStyle = '#1d1d1d'; ctx.fillRect(x - 15, y + 15, 30, 9);
  U.text(ctx, w.timeString, x, y + 15.5, { size: 7, align: 'center', color: '#8a8a8a', shadow: false });
}

H.draw = function (ctx, scene) {
  const R = G.renderer, w = scene.world, p = scene.player, sk = p.skills, W = R.uiW, t = G.loop.time;
  R.uiTransform();
  this.drawLabels(ctx, scene);

  // ---------------- vitals: a small, quiet strip in the bottom-left corner (health, breath, needs, level, cash)
  const hpR = Math.max(0, p.hp / p.maxHp), col = hpColor(hpR), H0 = R.uiH;
  const now = G.loop.time, dt = Math.min(0.1, Math.max(0, now - (H._hbT || now))); H._hbT = now;
  const fx = (G.effects.visuals && G.effects.visuals(p)) || {};
  const target = G.util.clamp(68 + (1 - hpR) * 45 + (p.moving && p.staminaDelay > 0.5 ? 35 : p.moving ? 10 : 0) + (fx.stim || 0) * 40 - (fx.opiate || 0) * 15, 45, 170);
  H._bpm = H._bpm == null ? target : H._bpm + (target - H._bpm) * Math.min(1, dt * 0.6);
  H._beat = (H._beat || 0) + dt * H._bpm / 60;
  const bph = H._beat % 1, beat = bph < 0.15 ? 1 - bph / 0.15 : 0;
  const vx = 8, vy = H0 - 26, bw = 92;
  const quiet = hpR > 0.6 && p.stamina > p.maxStamina * 0.6 && !(p.combatTimer > 0) ? 0.55 : 0.92;   // fades back when all is well
  ctx.globalAlpha = quiet;
  ctx.fillStyle = 'rgba(10,10,10,0.45)'; ctx.fillRect(vx - 3, vy - 4, bw + 52, 24);
  ctx.fillStyle = col; ctx.globalAlpha = quiet * (0.55 + beat * 0.45);   // a small heart beating
  ctx.fillRect(vx, vy, 2, 2); ctx.fillRect(vx + 3, vy, 2, 2); ctx.fillRect(vx, vy + 1, 5, 2); ctx.fillRect(vx + 1, vy + 3, 3, 1); ctx.fillRect(vx + 2, vy + 4, 1, 1);
  ctx.globalAlpha = quiet;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(vx + 8, vy + 1, bw, 3);
  ctx.fillStyle = col; ctx.fillRect(vx + 8, vy + 1, bw * hpR, 3);
  U.text(ctx, String(Math.ceil(p.hp)), vx + bw + 11, vy - 1, { size: 7, color: col, shadow: false });
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(vx + 8, vy + 6, bw, 1.5);   // breath
  ctx.fillStyle = p.stamina < p.maxStamina * 0.25 ? '#c2a776' : 'rgba(222,221,218,0.75)'; ctx.fillRect(vx + 8, vy + 6, bw * (p.stamina / p.maxStamina), 1.5);
  // needs: three tiny dots that only light up when they matter, the level, the cash
  const food = 1 - (p.hunger || 0) / 100, water = 1 - (p.thirst || 0) / 100, rest = G.rest.get(p) / 100;
  const dot = (i, f, c) => { const x2 = vx + 8 + i * 9, low = f < 0.3; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x2, vy + 11, 6, 2); ctx.fillStyle = f <= 0 ? (Math.floor(t * 4) % 2 ? '#cf635a' : '#4c2828') : low ? '#be756c' : c; ctx.fillRect(x2, vy + 11, 6 * Math.max(0.08, f), 2); };
  dot(0, food, '#b69e72'); dot(1, water, '#a09b92'); dot(2, rest, '#bcbab6');
  U.text(ctx, `LV ${sk.level}${sk.points > 0 ? ' +' : ''}`, vx + 38, vy + 9, { size: 6, color: sk.points > 0 ? '#d5ba80' : 'rgba(220,220,220,0.7)', shadow: false });
  U.text(ctx, '$' + p.gold, vx + bw + 11, vy + 9, { size: 6, color: '#a2a6a2', shadow: false });
  ctx.globalAlpha = 1;
  // the watch, if you have one
  if (H.hasWatch(p)) watch(ctx, vx + bw + 46, vy - 6, w);

  // chips under the card
  let cy = 8;   // (the vitals moved to the bottom: message chips and toasts start at the top)
  const chip = (text, colr) => { const tw = U.measure(ctx, text, 7) + 10; ctx.fillStyle = 'rgba(18,18,17,0.85)'; ctx.fillRect(6, cy, tw, 11); ctx.fillStyle = colr; ctx.fillRect(6, cy, 2, 11); U.text(ctx, text, 11, cy + 2, { size: 7, color: colr }); cy += 13; };
  // skill points waiting: the level badge pulses (no text)
  const unread = G.phone.unread(w);
  if (unread && G.phone.has(p)) chip(`${unread} new message${unread > 1 ? 's' : ''} [P]`, '#86867e');
  // (effects and withdrawal are not shown here any more: LifeLog > Effects lists them, with what each one does)
  this.toastY = cy + 2;
  G.phone.drawHud(ctx, scene);

  // reload bar & crosshair
  const wp = p.weaponItem;
  if (p.reloadT > 0 && wp && wp.gun) { const s = R.worldToUI(p.x, p.y - 26), tot = G.firearms.reloadTime(p, wp); U.bar(ctx, s.x - 14, s.y, 28, 4, 1 - p.reloadT / tot, '#c1b086'); }
  if (wp && wp.gun && scene.mouseSeenT > 0 && G.scenes.top() === scene) {
    const mx = G.input.mouse.ux, my = G.input.mouse.uy, sp = 3 + G.effects.spread(p) * 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(mx + ax * sp, my + ay * sp); ctx.lineTo(mx + ax * (sp + 4), my + ay * (sp + 4)); ctx.stroke(); }
  }

  // ---------------- top right: street sign, turf tag, wanted poster, GPS
  let y = 6;
  ctx.font = 'bold 9px sans-serif';
  // (the place name is a small caption on the minimap now, bottom right)
  const terr = G.gangWar.label(w, scene.map.id, Math.floor(p.x / 16), Math.floor((p.y - 3) / 16));
  if (terr) {
    const f = terr.owner && G.FACTIONS[terr.owner];
    ctx.save(); ctx.translate(W - 70, y + 8); ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(23,21,23,0.85)'; ctx.fillRect(-64, -8, 128, 18);
    U.text(ctx, (f ? f.name : 'No man\'s land').toUpperCase(), 0, -6, { size: 8, align: 'center', weight: 'bold', color: f ? f.color : C.dim });
    U.text(ctx, terr.name + (terr.contested ? '  · UNDER ATTACK' : ''), 0, 3, { size: 6, align: 'center', color: terr.contested ? '#da887f' : C.dim });
    ctx.restore();
    if (f) { ctx.fillStyle = '#2f2f2e'; ctx.fillRect(W - 132, y + 19, 124, 2); ctx.fillStyle = f.color; ctx.fillRect(W - 132, y + 19, 124 * terr.control / 100, 2); }
    y += 26;
  }
  const bounty = 0;   // no bounty on the HUD: your status shows in the world, the phone and chatBCT (js/game/law.js)
  if (bounty > 0) {
    ctx.fillStyle = '#cbc1ac'; ctx.fillRect(W - 92, y, 86, 22);
    ctx.strokeStyle = '#7e7666'; ctx.strokeRect(W - 91.5, y + 0.5, 85, 21);
    U.text(ctx, 'WANTED', W - 49, y + 1, { size: 9, align: 'center', weight: 'bold', color: '#6f322f', shadow: false });
    U.text(ctx, `$${bounty}${bounty >= G.BOUNTY_KILL_ON_SIGHT ? ' · DEAD OR ALIVE' : ''}`, W - 49, y + 12, { size: 6, align: 'center', color: '#322c22', shadow: false });
    y += 26;
  }
  // the minimap: small and quiet in the bottom-right corner, the place name under it
  const mmW = 74, mmH = 46, mmX = W - mmW - 8, mmY = R.uiH - mmH - 16;
  if (G.settings.get('showMinimap')) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(10,10,10,0.55)'; ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
    this.drawMinimap(ctx, scene, mmX, mmY, mmW, mmH);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.strokeRect(mmX - 1.5, mmY - 1.5, mmW + 3, mmH + 3);
    ctx.fillStyle = 'rgba(192,109,98,0.9)'; ctx.beginPath(); ctx.moveTo(mmX + mmW - 5, mmY + 2); ctx.lineTo(mmX + mmW - 3, mmY + 6); ctx.lineTo(mmX + mmW - 7, mmY + 6); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (!scene.map.meta.wilds) U.text(ctx, scene.map.meta.name, mmX + mmW, R.uiH - 12, { size: 6, align: 'right', color: 'rgba(197,194,188,0.7)', shadow: false });

  // ---------------- weapon card (bottom right)
  if (wp && !p.vehicle) {   // (driving: the speedometer sits here, js/game/vehicles.js)
    const bx = W - 104 - 86, by = R.uiH - 40;   // (left of the minimap)
    card(ctx, bx, by, 98, 30, '#a9a8a7');
    U.icon(ctx, wp.icon, bx + 6, by + 7, 1);
    U.text(ctx, wp.name, bx + 26, by + 4, { size: 7, color: C.ink });
    if (wp.gun) {
      const loaded = G.firearms.loaded(p, wp), spare = p.inventory.count(wp.ammo);
      if (p.reloadT > 0) U.text(ctx, 'RELOADING', bx + 26, by + 15, { size: 7, color: '#c1b086' });
      else for (let i = 0; i < Math.min(wp.mag, 20); i++) { ctx.fillStyle = i < loaded ? '#c5b083' : '#403f3e'; ctx.fillRect(bx + 26 + i * 3, by + 16, 2, 6); }
      U.text(ctx, '+' + spare, bx + 94, by + 15, { size: 7, align: 'right', color: loaded === 0 ? '#dd9d8c' : C.dim });
    }
  }

  // ---------------- interaction prompt: a key cap and a label
  const tg = scene.promptTarget;
  // a small key cap over the thing itself (only the nearest one); the label shows once you stand still
  H._stillT = p.moving ? 0 : (H._stillT || 0) + 1 / 60;
  if (tg && G.settings.get('notifications') !== 2) {
    const ref = tg.ref || tg;
    const wx = ref && ref.x != null ? ref.x : p.x, wy = ref && ref.y != null ? ref.y - 22 : p.y - 26;
    const s = R.worldToUI(wx, wy), kx = Math.round(s.x - 2), ky = Math.round(s.y - 2);
    ctx.fillStyle = 'rgba(14,13,11,0.55)'; ctx.fillRect(kx - 1, ky - 1, 6, 6); ctx.fillStyle = '#c8c2b2'; ctx.fillRect(kx, ky, 4, 4);   // a quiet mark on the thing
    if (H._stillT > 0.5) {
      const label = tg.label, tw = U.measure(ctx, label, 7) + 6;
      ctx.fillStyle = 'rgba(18,18,17,0.7)'; ctx.fillRect(kx + 8, ky - 3, tw, 10);
      U.text(ctx, label, kx + 11, ky - 1.5, { size: 7, color: C.ink });
    }
  } else if (tg) {
    const label = `${tg.label}${tg.type === 'npc' && !tg.ref.sleeping ? '  ·  [Enter] Say something' : ''}`;
    const tw = U.measure(ctx, label, 10) + 16, px = (W - tw) / 2, py = R.uiH - 60;
    card(ctx, px, py, tw, 20);
    U.text(ctx, label, px + 9, py + 5, { size: 10, color: C.ink });
  }

  // ---------------- toasts
  let ty = this.toastY || 64;
  for (const tt of scene.toasts) {
    ctx.globalAlpha = Math.min(1, tt.t);
    const colr = { bad: '#dd948c', good: '#86867e', quest: '#d5ba80', warn: '#d3b37c' }[tt.type] || C.ink;
    const tw = U.measure(ctx, tt.text, 9) + 14;
    ctx.fillStyle = 'rgba(18,18,17,0.85)'; ctx.fillRect(6, ty, tw, 14);
    ctx.fillStyle = colr; ctx.fillRect(6, ty, 2, 14);
    U.text(ctx, tt.text, 12, ty + 2.5, { size: 9, color: colr });
    ty += 16; ctx.globalAlpha = 1;
  }

  // ---------------- arrival banner: the place, no clock
  if (scene.banner && scene.banner.t > 0 && !(/^Day \d+/.test(scene.banner.text) && !H.hasWatch(p))) {
    ctx.globalAlpha = Math.max(0, Math.min(1, scene.banner.t, (3.5 - scene.banner.t) * 2));
    // a small fade in the corner, not a big title
    U.text(ctx, scene.banner.text, W / 2, 8, { size: 11, align: 'center', family: G.config.TITLE_FONT, weight: 'bold', color: '#d5c6a5' });
    const sub = (scene.banner.sub || '').replace(/^Day \d+ · \d+:\d+$/, '').replace(/^Day \d+.*$/, '');
    if (sub) U.text(ctx, sub, W / 2, 21, { size: 8, align: 'center', color: U.colors.dim });
    ctx.globalAlpha = 1;
  }
};
})();
