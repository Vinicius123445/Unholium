'use strict';
// Riders on bicycles and motorcycles, seen from above, in the HD look: whoever is riding (you, or the
// traffic rider with their own clothes, skin and hair) sits on the saddle with their hands on the grips
// and their feet on the pedals or pegs.
//   Bicycle: upright, bare head (hair, ears, the tip of the nose past the brow), legs pedaling with the
//   distance covered, knees rising and falling, the body rocking a little with each stroke.
//   Motorcycle: leaning forward over the tank, a helmet (in the rider's colour or black) with a dark
//   visor, gloves, knees tucked in against the tank, boots on the pegs.
//   Both lean into turns and shade like the HD people (lit from the front-left).
// Drawn by js/game/vehicleshd.js inside the vehicle's own frame (x forward, y to the right).
(() => {
const sh = (c, f) => G.assets.shade(c, f);
const lookOf = (v) => {
  const scene = G.doors && G.doors.scene;
  if (v.driver === 'player' && scene) return scene.player.currentLook();
  if (v.driver === 'law') return { skin: '#c89070', hair: '#2a2a2a', shirt: '#2a3a6a', pants: '#1a2440', shoes: '#141416', hatColor: '#1a2440' };
  if (v.driver && v.driver.look) return v.driver.look;
  return v.ai && v.ai.driver && v.ai.driver.look;
};
const ell = (ctx, x, y, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); };
const seg = (ctx, x0, y0, x1, y1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };

G.riders = {
  draw(ctx, v, bike) {
    const look = lookOf(v); if (!look) return;
    const st = v._rd || (v._rd = { odo: 0, lx: v.x, ly: v.y, lean: 0, la: v.angle });
    st.odo += Math.hypot(v.x - st.lx, v.y - st.ly); st.lx = v.x; st.ly = v.y;
    let da = v.angle - st.la; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; st.la = v.angle;
    st.lean += (G.util.clamp(da * 40 * Math.sign(v.speed || 0), -1.2, 1.2) - st.lean) * 0.15;   // into the turn
    const skin = look.skin || '#e0b088', shirt = look.naked || look.shirtless ? skin : look.shirt || '#6a8ab8', pants = look.naked ? skin : look.pants || '#3a3a4a';
    const shoes = look.shoes || '#2a2420', hair = look.hair || '#3a2a1a';
    const lean = st.lean, sy = (k) => k + lean * 0.6;   // the upper body shifts toward the inside of the turn
    ctx.save();
    if (bike) {
      // pedals turn with the distance covered: the knees rise and fall in turn
      const ph = st.odo * 0.55, rock = Math.sin(ph) * 0.25;
      for (const s of [-1, 1]) {
        const a = ph + (s > 0 ? Math.PI : 0), px = -0.5 + Math.cos(a) * 1.4, kx = 1.6 + Math.max(0, Math.cos(a)) * 0.9;
        seg(ctx, -2.2, s * 1.2, kx, s * 1.9, 1.5, sh(pants, s > 0 ? 0.82 : 1));     // thigh
        seg(ctx, kx, s * 1.9, px, s * 2.7, 1.3, sh(pants, s > 0 ? 0.72 : 0.92));      // shin
        ell(ctx, px + 0.3, s * 2.9, 0.9, 0.5, shoes);
      }
      ell(ctx, -2.4, 0, 1.8, 2.2, sh(pants, 0.9));                                     // seat of the pants
      // torso: upright, shoulders square to the bars, lit from the front-left
      ell(ctx, -1.6, sy(rock), 2.1, 3.0, sh(shirt, 0.72));
      ell(ctx, -1.4, sy(rock - 0.3), 1.8, 2.6, shirt);
      ell(ctx, -1.0, sy(rock - 1.0), 0.9, 1.2, sh(shirt, 1.15));
      for (const s of [-1, 1]) {   // arms out to the grips
        seg(ctx, -0.8, sy(s * 2.5), 2.0, s * 3.2, 1.2, sh(shirt, s > 0 ? 0.8 : 0.95));
        seg(ctx, 2.0, s * 3.2, 4.4, s * 3.6, 1.0, skin);
        ell(ctx, 4.7, s * 3.7, 0.65, 0.65, sh(skin, 0.9));
      }
      // head from above: hair over the crown, ears, the nose past the brow
      const hx = -0.9, hy = sy(rock * 0.5);
      ell(ctx, hx + 1.5, hy, 0.5, 0.45, sh(skin, 0.95));
      ell(ctx, hx, hy - 1.75, 0.4, 0.5, skin); ell(ctx, hx, hy + 1.75, 0.4, 0.5, sh(skin, 0.85));
      ell(ctx, hx, hy, 1.75, 1.7, skin);
      ell(ctx, hx - 0.25, hy, 1.6, 1.7, hair);
      ell(ctx, hx - 0.6, hy - 0.6, 0.6, 0.5, sh(hair, 1.35));
    } else {
      // knees tucked against the tank, boots on the pegs
      for (const s of [-1, 1]) {
        seg(ctx, -3, s * 1.5, 1.6, s * 2.9, 1.8, sh(pants, s > 0 ? 0.8 : 1));
        seg(ctx, 1.6, s * 2.9, -0.4, s * 4.0, 1.5, sh(pants, s > 0 ? 0.7 : 0.9));
        ell(ctx, -0.6, s * 4.2, 1.1, 0.6, '#18181c');
      }
      ell(ctx, -3.4, 0, 2.0, 2.4, sh(pants, 0.9));
      // torso leaning forward over the tank (the back is what you see from above)
      ell(ctx, -0.8, sy(0), 3.4, 2.9, sh(shirt, 0.7));
      ell(ctx, -0.6, sy(-0.3), 3.0, 2.5, shirt);
      seg(ctx, -3.4, sy(0), 1.6, sy(0), 0.5, sh(shirt, 0.6));                          // the spine's crease
      ell(ctx, -0.2, sy(-1.1), 1.4, 0.9, sh(shirt, 1.18));
      for (const s of [-1, 1]) {   // arms forward, gloved hands on the grips
        seg(ctx, 1.2, sy(s * 2.4), 4.2, s * 4.0, 1.4, sh(shirt, s > 0 ? 0.78 : 0.95));
        seg(ctx, 4.2, s * 4.0, 6.6, s * 5.0, 1.1, sh(shirt, 0.85));
        ell(ctx, 7.0, s * 5.2, 0.8, 0.7, '#18181c');
      }
      // helmet: shell in the rider's colour (or black), a highlight, the visor strip at the front
      const hc = look.hatColor || (G.util.hashString ? ['#18181c', '#c82a2a', '#e8e8ec', '#2a4aa8'][G.util.hashString(shirt + pants) % 4] : '#18181c');
      const hx = 2.2, hy = sy(0);
      ell(ctx, hx, hy, 2.2, 2.0, sh(hc, 0.7));
      ell(ctx, hx - 0.15, hy - 0.1, 2.0, 1.8, hc);
      ctx.fillStyle = '#10141c'; ctx.beginPath(); ctx.ellipse(hx + 0.4, hy, 1.95, 1.75, 0, -1.0, 1.0); ctx.fill();   // visor
      ctx.fillStyle = 'rgba(150,190,230,0.55)'; ctx.fillRect(hx + 1.6, hy - 0.9, 0.35, 0.8);
      ell(ctx, hx - 0.7, hy - 0.7, 0.7, 0.45, sh(hc, 1.5));
    }
    ctx.restore();
  },
};
})();
