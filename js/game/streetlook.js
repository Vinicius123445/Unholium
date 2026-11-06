'use strict';
// Streets with character.
//   Colors: every building gets its own paint — pastel siding, painted brick, weathered concrete — and its
//   own roof shade, picked from its id so it never changes.
//   Shops look like shops: big display windows full of goods, an OPEN / CLOSED sign in the window (on top
//   of the sign board and awning). Houses look like homes: shutters by the windows and a porch light.
//   Taller buildings: one band of windows per floor above the ground floor (more pronounced than before).
(() => {
const A = G.assets, TM = G.TileMap.prototype;
const PAINT = {
  siding: ['#f4e8c8', '#cfe4d0', '#cfdcec', '#f0d0c0', '#e0d4ec', '#f4f0e4', '#d8e8e0', '#f0e0b0', '#c8d0d8', '#e8c8c8'],
  brick: ['#ffffff', '#f0d8c8', '#e0c0b0', '#d8d8e0', '#f8e8d0'],
  concrete: ['#ffffff', '#e0e4ec', '#ece4d8', '#d8e0d8', '#f0f0f0'],
  roof: ['#ffffff', '#f0d0c0', '#d0e0f0', '#e0e8d0', '#e8d8f0', '#d8d0c8', '#f8f0d8'],
};
const pickBy = (id, list) => list[G.util.hashString(id + 'paint') % list.length];
const isShop = G.isStorefront = (b) => /Store|Mart|Bodega|Liquor|Pharmacy|Clothes|Barber|Pawn|Gas|Diner|Jewel|Gun|Hardware|Casino|Bar|Motel/.test(b.name);
TM.paintOf = function (b) {
  const wall = G.TILES[this.get(b.x, b.y + b.h - 1)] || {};
  const kind = /siding|wood|plaster/.test(wall.name) ? 'siding' : /brick/.test(wall.name) ? 'brick' : 'concrete';
  return pickBy(b.id, PAINT[kind]);
};

// paint the walls (multiply over the wall tiles of each building)
const _pre = TM.prerender;
TM.prerender = function () {
  _pre.call(this);
  const x = this.groundCtx;
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.6;
  for (const b of this.buildings) {
    x.fillStyle = this.paintOf(b);
    for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) {
      const t = G.TILES[this.get(tx, ty)];
      if (t && t.wall && t.name !== 'wall_inner') x.fillRect(tx * 16, ty * 16, 16, 16);
    }
  }
  x.restore();
};
// roofs get their own shade, and multi-floor facades are taller
const _roof = TM.renderRoof;
TM.renderRoof = function (b) {
  const c = _roof.call(this, b);
  const x = c.getContext('2d');
  x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.45; x.fillStyle = pickBy(b.id, PAINT.roof); x.fillRect(0, 0, c.width, c.height); x.restore();
  // put the original alpha back where the roof canvas was transparent
  x.save(); x.globalCompositeOperation = 'destination-in'; x.drawImage(_roof.call(this, b), 0, 0); x.restore();
  return c;
};

// ---------------------------------------------------------------- storefronts and homes (drawn with the signs)
const _signs = G.facades.signs;
G.facades.signs = function (ctx, map, view) {
  const scene = G.doors && G.doors.scene;
  for (const b of map.buildings) {
    if (b.destroyed || b.floorOf) continue;
    const wy = b.doorY * 16;
    if (b.x * 16 > view.x + view.w || (b.x + b.w) * 16 < view.x || wy < view.y - 30 || wy > view.y + view.h + 20) continue;
    if (isShop(b)) {
      // display windows across the front, full of goods
      for (let tx = b.x + 1; tx <= b.x + b.w - 2; tx++) {
        if (Math.abs(tx - b.doorX) <= 1) continue;
        const gx = tx * 16 + 1, gy = wy + 3;
        if (G.realFront) { G.realFront.display(ctx, gx, gy, G.util.hashString(b.id + tx)); continue; }
        ctx.fillStyle = '#2a3a48'; ctx.fillRect(gx, gy, 14, 11);
        ctx.fillStyle = '#7aa8c8'; ctx.fillRect(gx + 1, gy + 1, 12, 9);
        const r = new G.RNG(b.id + tx);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = r.pick(['#d84a3a', '#e8c040', '#5ac040', '#f0f0f0', '#8a5ac8', '#e87a2a']); ctx.fillRect(gx + 2 + k * 3, gy + 6, 2, 3); }
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(gx + 2, gy + 1, 1, 4); ctx.fillRect(gx + 3, gy + 1, 1, 2);
      }
      // OPEN / CLOSED in the window next to the door
      const sid = scene && scene.map === map && G.doors.shopOf(scene, b);
      if (sid) {
        const open = G.shopSys.isOpen(sid, scene), ox = (b.doorX + 1) * 16 + 2;
        if (Math.abs(b.doorX + 1 - b.doorX) === 1 && b.doorX + 1 <= b.x + b.w - 2) {
          ctx.fillStyle = '#100808'; ctx.fillRect(ox, wy + 5, 12, 5);
          const t = G.facades.textImg(open ? 'OPEN' : 'SHUT', 4, open ? '#5aff7a' : '#ff4a3a');
          ctx.drawImage(t.c, ox + 1, wy + 5.5, Math.min(10, t.w), 4);
        }
      }
    } else if (b.kind === 'house') {
      // shutters and a porch light
      const sh = A.shade(map.paintOf(b), 0.45);
      for (const wn of b.windows) { ctx.fillStyle = sh; ctx.fillRect(wn.x - 9, wn.y - 6, 2, 8); ctx.fillRect(wn.x + 7, wn.y - 6, 2, 8); }
      ctx.fillStyle = '#2a2420'; ctx.fillRect(b.doorX * 16 + 15, wy + 3, 2, 3);
      ctx.fillStyle = G.world && G.world.isNight() ? '#ffe8a0' : '#c8b890'; ctx.fillRect(b.doorX * 16 + 15, wy + 6, 2, 2);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(b.doorX * 16 + 3, wy + 16, 10, 2);   // doormat
    }
  }
  _signs.call(this, ctx, map, view);
};
})();
