'use strict';
// Actor: base class for anything that moves, animates, takes damage and dies (player, NPCs, animals).

class Actor {
  constructor(o = {}) {
    this.id = o.id || G.util.uid('a');
    this.name = o.name || '???';
    this.kind = 'actor';
    this.x = o.x || 0;           // feet center (world px)
    this.y = o.y || 0;
    this.w = o.w || 10;          // hitbox at the feet
    this.h = o.h || 6;
    this.dir = 0;                // 0 down, 1 left, 2 right, 3 up
    this.facingRight = false;
    this.speed = o.speed || 40;
    this.maxHp = o.hp || 20;
    this.hp = this.maxHp;
    this.dead = false;
    this.sheet = null;
    this.anim = 0;
    this.moving = false;
    this.hurtTimer = 0;
    this.invuln = 0;
    this.kbx = 0; this.kby = 0;
    this.attackTimer = 0;        // >0 while swinging
    this.attackCd = 0;
    this.radius = 6;             // for hit tests between actors
  }

  get cx() { return this.x; }
  get cy() { return this.y - 6; }

  // Move with tile collision. `slide` enables corner nudging (helps squeezing through doors).
  move(map, dx, dy, slide = false) {
    let moved = false;
    const hw = this.w / 2;
    if (dx) {
      const nx = this.x + dx;
      if (!map.rectCollides(nx - hw, this.y - this.h, this.w, this.h, this.canSwim)) { this.x = nx; moved = true; }
      else if (slide && !dy) moved = this._nudge(map, 'y', dx) || moved;
    }
    if (dy) {
      const ny = this.y + dy;
      if (!map.rectCollides(this.x - hw, ny - this.h, this.w, this.h, this.canSwim)) { this.y = ny; moved = true; }
      else if (slide && !dx) moved = this._nudge(map, 'x', dy) || moved;
    }
    return moved;
  }

  _nudge(map, axis, amount) {
    const hw = this.w / 2;
    const step = Math.min(1, Math.abs(amount));
    for (const n of [2, -2, 4, -4, 6, -6]) {
      const ox = axis === 'x' ? n : 0, oy = axis === 'y' ? n : 0;
      const tx = this.x + ox + (axis === 'y' ? amount : 0);
      const ty = this.y + oy + (axis === 'x' ? amount : 0);
      if (!map.rectCollides(tx - hw, ty - this.h, this.w, this.h, this.canSwim)) {
        const s = Math.sign(n) * step;
        const cx = this.x + (axis === 'x' ? s : 0), cy = this.y + (axis === 'y' ? s : 0);
        if (!map.rectCollides(cx - hw, cy - this.h, this.w, this.h, this.canSwim)) { this.x = cx; this.y = cy; return true; }
        return false;
      }
    }
    return false;
  }

  face(dx, dy) {
    if (!dx && !dy) return;
    this.dir = G.util.dirFromVec(dx, dy);
    if (dx) this.facingRight = dx > 0;
  }

  faceTowards(other) { this.face(other.x - this.x, other.y - this.y); }

  distTo(other) { return Math.hypot(other.x - this.x, other.y - this.y); }

  baseUpdate(dt, map) {
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.kbx || this.kby) {
      this.move(map, this.kbx * dt, this.kby * dt);
      this.kbx *= Math.pow(0.0005, dt);
      this.kby *= Math.pow(0.0005, dt);
      if (Math.abs(this.kbx) < 2) this.kbx = 0;
      if (Math.abs(this.kby) < 2) this.kby = 0;
    }
    this.anim = this.moving ? this.anim + dt : 0;
  }

  frame() {
    const s = this.sheet;
    if (s.animal) return { col: this.moving ? Math.floor(this.anim * 8) % 2 : 0, row: this.facingRight ? 1 : 0 };
    return { col: this.moving ? 1 + (Math.floor(this.anim * 7) % 2) : 0, row: this.dir };
  }

  drawShadow(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 1, this.sheet ? this.sheet.fw * 0.32 : 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx) {
    const s = this.sheet;
    if (!s) return;
    this.drawShadow(ctx);
    const { col, row } = this.frame();
    const flash = this.hurtTimer > 0 && Math.floor(this.hurtTimer * 20) % 2 === 0;
    const img = flash ? G.assets.white(s.img) : s.img;
    ctx.drawImage(img, col * s.fw, row * s.fh, s.fw, s.fh, Math.round(this.x - s.fw / 2), Math.round(this.y - s.fh + 1), s.fw, s.fh);
    if (this.attackTimer > 0) this.drawSwing(ctx);
  }

  drawSwing(ctx) {
    const t = 1 - this.attackTimer / 0.22;
    const base = [Math.PI / 2, Math.PI, 0, -Math.PI / 2][this.dir];
    const a0 = base - 1.1 + t * 2.2;
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y - 7, 13, a0 - 0.6, a0);
    ctx.stroke();
  }
}

G.Actor = Actor;
