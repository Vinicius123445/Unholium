'use strict';
// How the player walks.
//   Mouse mode (Settings > Controls > Movement, the default): the cursor sets which way is "forward".
//   Forward walks the way the cursor points from the player (not toward the spot: you keep going while the
//   key is held), back backs away from it, left/right strafe across it. The player always faces the cursor.
//   Classic mode: the keys move up/down/left/right on the screen and the cursor never turns you (it only
//   aims while a mouse button is held).
//   Both modes: any angle, not just eight. Speed is the same in every direction (diagonals are not faster);
//   in mouse mode backing up and strafing are a little slower than walking forward. The body has weight:
//   it speeds up over a fraction of a second, eases to a stop, and swings round into a new direction
//   instead of snapping. Walking into a wall bleeds off the speed that went into it.
(() => {
const S = G.settings;
S.defaults.moveMode = 0;   // 0 mouse-relative, 1 classic
if (S.data.moveMode == null) S.data.moveMode = 0;
const ACCEL = 9, DECEL = 13, TURN = 11;   // per second: getting up to speed, stopping, swinging into a new direction
const BACK = 0.72, STRAFE = 0.88;

G.movement = {
  mouseMode() { return S.get('moveMode') === 0; },

  // raw key input (-1..1 each) -> the wanted direction on the screen
  steer(p, ix, iy, scene) {
    if (!this.mouseMode() || !(ix || iy)) return [ix, iy];
    let f = p._fwd || [0, 1];
    if (G.scenes.top() === scene) {
      const mw = p.mouseWorld(), dx = mw.x - p.x, dy = mw.y - (p.y - 6), d = Math.hypot(dx, dy);
      if (d > 4) f = p._fwd = [dx / d, dy / d];   // the cursor right on the player: keep the last forward
    }
    // up = forward, down = back, right = strafe to the right of the cursor
    let fwd = -iy, side = ix;
    const n = Math.hypot(fwd, side); fwd /= n; side /= n;
    // speed blends smoothly with the angle: full ahead, a bit less sideways, less again backing up
    const k = fwd >= 0 ? STRAFE + (1 - STRAFE) * fwd : STRAFE + (BACK - STRAFE) * -fwd;
    // strafing: D always goes toward the right of the screen and A toward the left, whichever way you look
    // (pure "right of where you face" made them swap when looking down). Looking sideways the strafe runs
    // up/down; it keeps its last sense there so it does not flip back and forth.
    let px = -f[1], py = f[0];   // right of the forward direction (screen y points down)
    if (Math.abs(px) > 0.3) p._strafeFlip = px < 0;
    if (p._strafeFlip) { px = -px; py = -py; }
    return [(f[0] * fwd + px * side) * k, (f[1] * fwd + py * side) * k];
  },

  // the wanted direction (length 0..1) -> the body's velocity, with weight
  smooth(p, tx, ty, dt) {
    const v = p._mv || (p._mv = { x: 0, y: 0 });
    const tl = Math.hypot(tx, ty), vl = Math.hypot(v.x, v.y);
    if (tl < 0.01) {   // easing to a stop
      const nl = Math.max(0, vl - DECEL * dt * Math.max(0.35, vl));
      if (vl > 0) { v.x *= nl / vl; v.y *= nl / vl; }
      if (nl < 0.02) v.x = v.y = 0;
      return v;
    }
    if (vl < 0.05) {   // starting from standing: set off the way you want, then pick up speed
      const nl = Math.min(tl, vl + ACCEL * dt);
      v.x = (tx / tl) * nl; v.y = (ty / tl) * nl;
      return v;
    }
    // turning: swing the heading toward the wanted one (a sharp reversal also slows you down), and ease the speed
    const ha = Math.atan2(v.y, v.x), ta = Math.atan2(ty, tx);
    let da = ta - ha; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const step = Math.sign(da) * Math.min(Math.abs(da), TURN * dt * (1 + Math.abs(da)));
    const na = ha + step;
    const drag = Math.abs(da) > 2.2 ? 0.6 : Math.abs(da) > 1.2 ? 0.85 : 1;   // pivoting around costs speed
    const want = tl * drag;
    const nl = want > vl ? Math.min(want, vl + ACCEL * dt) : Math.max(want, vl - DECEL * dt);
    v.x = Math.cos(na) * nl; v.y = Math.sin(na) * nl;
    return v;
  },

  // after moving: what the wall took is gone
  blocked(p, wantX, wantY, gotX, gotY) {
    const v = p._mv; if (!v) return;
    if (Math.abs(wantX) > 0.01 && Math.abs(gotX) < Math.abs(wantX) * 0.3) v.x *= 0.4;
    if (Math.abs(wantY) > 0.01 && Math.abs(gotY) < Math.abs(wantY) * 0.3) v.y *= 0.4;
  },

  // which of the four body facings: keep the current one until the heading is clearly past the diagonal,
  // so walking at 45 degrees does not flicker between two sprites
  faceSmooth(p, dx, dy) {
    if (!dx && !dy) return;
    const a = Math.atan2(dy, dx), C = [Math.PI / 2, Math.PI, 0, -Math.PI / 2];   // dirs 0 down, 1 left, 2 right, 3 up
    let d = a - C[p.dir]; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < Math.PI / 4 + 0.26) { if (dx) p.facingRight = dx > 0; return; }
    p.face(dx, dy);
  },
};
})();

// Legacy controls (Settings > Controls, on by default): keys move you on the screen and you face where you
// walk; the cursor only turns you when you attack or aim. [Space] attacks and shoots the way you face.
// The mouse (TO DO 2026-11-01): LEFT click swings a melee weapon toward the cursor, or fires a gun at it (a
// quick hip shot); holding RIGHT raises the gun and aims at the cursor, and LEFT fires the aimed shot
// (automatic weapons fire while left is held). Menus, the phone and every other screen take the mouse as usual.
(() => {
const S = G.settings;
S.defaults.legacyControls = true;
if (S.data.legacyControls == null) S.data.legacyControls = true;
const M = G.movement, _mm = M.mouseMode;
M.legacy = () => S.get('legacyControls') !== false;
M.mouseMode = function () { return !M.legacy() && _mm.call(this); };
const PL = G.Player.prototype, _up = PL.update;
PL.update = function (dt, scene) {
  if (!M.legacy() || !scene || this !== scene.player) return _up.call(this, dt, scene);
  const I = G.input, m = I.mouse, saved = [m.down, m.pressed, m.rdown, m.rpressed], [ld, lp, rd] = saved;
  const w = this.weaponItem, gun = !!(w && w.gun), mine = G.scenes.top() === scene, ab = S.data.aimButton;
  if (!mine) { m.down = m.pressed = m.rdown = m.rpressed = false; }
  else if (gun) { S.data.aimButton = 1; m.rdown = rd; m.down = ld; m.pressed = lp; m.rpressed = false; }   // right holds the aim, left fires (at the cursor)
  else { m.down = ld; m.pressed = lp; m.rdown = m.rpressed = false; }                                     // melee: left swings toward the cursor
  try { return _up.call(this, dt, scene); } finally { [m.down, m.pressed, m.rdown, m.rpressed] = saved; S.data.aimButton = ab; }
};
const GS = G.GameScene.prototype, _gu = GS.update;
GS.update = function (dt) { const r = _gu.call(this, dt); if (M.legacy() && !(this.player && this.player.aiming)) this.mouseSeenT = 0; else if (M.legacy()) this.mouseSeenT = 1; return r; };   // a crosshair only while aiming
})();
