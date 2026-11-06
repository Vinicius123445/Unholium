'use strict';
// How buildings look from the street.
//   Height: buildings with upper floors are drawn taller — a facade with a row of windows per floor rises
//   above the ground floor and the roof sits on top, so a 4-floor tower looks like one.
//   Shop fronts: a sign board over the door (with the trade's colors and a little symbol), a striped awning
//   for shops, a barber pole, neon for the bar/motel/casino. Not HUD icons: things on the buildings.
//   Doors: swing open when someone (you or anyone with the right to get in) walks up, and close again.
//   Stairs and elevators: clearly drawn, with a small bobbing arrow when you are near.
(() => {
const A = G.assets;
const SIGNS = [
  [/Convenience|Mini-Mart|General Store|Bodega/, { text: '24/7', bg: '#2a8a4a', fg: '#ffffff', awning: ['#2a8a4a', '#f0f0f0'], icon: 'cart' }],
  [/Gun Store/, { text: 'GUNS', bg: '#1a1a1e', fg: '#e04a3a', awning: null, icon: 'gun' }],
  [/Pharmacy/, { text: 'PHARMACY', bg: '#f0f0f0', fg: '#2a9a4a', awning: ['#2a9a4a', '#f0f0f0'], icon: 'cross' }],
  [/Clothes/, { text: 'CLOTHING', bg: '#3a2a4a', fg: '#f0c0e0', awning: ['#a83a6a', '#f0e0e8'], icon: 'shirt' }],
  [/Barber/, { text: 'BARBER', bg: '#1a2a4a', fg: '#f0f0f0', awning: null, icon: 'pole' }],
  [/^Bar$/, { text: 'BAR', bg: '#1a1012', fg: '#ff5a8a', neon: true, icon: 'mug' }],
  [/Motel/, { text: 'MOTEL', bg: '#1a1012', fg: '#5ae0ff', neon: true, icon: null }],
  [/Diner/, { text: 'DINER', bg: '#c82a2a', fg: '#fff0c0', neon: true, awning: ['#c82a2a', '#f0f0f0'], icon: null }],
  [/Gas Station/, { text: 'GAS', bg: '#e8c040', fg: '#c82a2a', awning: null, icon: null }],
  [/Pawn/, { text: 'PAWN', bg: '#2a2a1a', fg: '#e8c040', awning: null, icon: 'balls' }],
  [/Liquor/, { text: 'LIQUOR', bg: '#4a1a1a', fg: '#f0d080', neon: true, icon: 'bottle' }],
  [/Jewel/, { text: 'JEWELS', bg: '#1a1a1e', fg: '#e8c040', awning: ['#1a1a1e', '#c8a040'], icon: 'gem' }],
  [/Casino/, { text: 'CASINO', bg: '#3a0a1a', fg: '#ffd040', neon: true, bulbs: true, icon: null }],
  [/Hardware/, { text: 'HARDWARE', bg: '#c86a1a', fg: '#ffffff', awning: null, icon: null }],
  [/Police/, { text: 'POLICE', bg: '#1a2a6a', fg: '#ffffff', awning: null, icon: null }],
  [/Fire Station/, { text: 'FIRE DEPT', bg: '#c82a2a', fg: '#ffffff', awning: null, icon: null }],
  [/School/, { text: 'SCHOOL', bg: '#7a3a2a', fg: '#f0e0c0', awning: null, icon: null }],
  [/City Hall/, { text: 'CITY HALL', bg: '#d8d0c0', fg: '#3a3a40', awning: null, icon: null }],
  [/Office Tower/, { text: 'OFFICES', bg: '#2a2e38', fg: '#c8d8f0', awning: null, icon: null }],
  [/Church/, { text: '', bg: null, icon: 'cross_church' }],
];
const signFor = (b) => { if (b.floorOf) return null; for (const [rx, s] of SIGNS) if (rx.test(b.name)) return s; return null; };
G.SHOP_SIGNS = SIGNS; G.signFor = signFor;   // the boards stand out front on posts now (js/game/signposts.js)

// ---------------------------------------------------------------- taller buildings
const TM = G.TileMap.prototype, _renderRoof = TM.renderRoof, _drawRoofs = TM.drawRoofs;
TM.floorsOf = function (b) { const s = G.FLOORS && G.FLOORS[b.id]; return s && s.base === this.id ? s.levels.length + 1 : 1; };
TM.renderRoof = function (b) {
  const roof = _renderRoof.call(this, b), floors = this.floorsOf(b);
  if (floors <= 1) { b.extraH = 0; return roof; }
  const extra = (floors - 1) * 20, W = roof.width, H = roof.height;
  const { c, x } = A.mk(W, H + extra);
  x.drawImage(roof, 0, 0);
  const wall = G.TILES[this.get(b.x, b.y + b.h - 1)], tile = wall && A.tile(wall.tex || wall.name, 0);
  for (let yy = H - 4; yy < H + extra; yy += 16) for (let xx = 0; xx < W; xx += 16) if (tile) x.drawImage(tile, xx, yy);
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, H - 4, W, extra + 4);
  for (let f = 0; f < floors - 1; f++) {
    const fy = H - 2 + f * 20;
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, fy, W, 1);
    for (let wx = 6; wx < W - 8; wx += 12) { x.fillStyle = '#2a3a50'; x.fillRect(wx, fy + 4, 8, 12); x.fillStyle = '#7aa8d0'; x.fillRect(wx + 1, fy + 5, 6, 10); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(wx, fy + 15, 8, 2); x.fillStyle = '#c8e0f0'; x.fillRect(wx + 1, fy + 4, 2, 1); }
  }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, H + extra - 2, W, 2);
  b.extraH = extra;
  return c;
};
TM.drawRoofs = function (ctx, view) {
  for (const b of this.buildings) {
    if (b.roofAlpha <= 0.01 || b.destroyed) continue;
    const rx = b.x * 16 - 2, ry = b.y * 16 - 8 - (b.extraH || 0);
    if (!b.roofCanvas) b.roofCanvas = this.renderRoof(b);
    if (rx > view.x + view.w || ry > view.y + view.h || rx + b.roofCanvas.width < view.x || ry + b.roofCanvas.height < view.y) continue;
    ctx.globalAlpha = b.roofAlpha;
    ctx.drawImage(b.roofCanvas, rx, ry);
  }
  ctx.globalAlpha = 1;
};
// Signs, shop windows and shutters belong to the front wall, so they are drawn with the ground (under people):
// drawn over the roofs, anyone walking past the wall looked like they were inside the sign.
const _lit = TM.drawWindowsLit;
TM.drawWindowsLit = function (ctx, view) { _lit.call(this, ctx, view); G.facades.signs(ctx, this, view); };

// ---------------------------------------------------------------- signs, doors, stairs
G.facades = {
  // Text is rendered once into a small canvas and drawn as an image: drawing it live with fillText made the
  // letters shimmer and hop a pixel as the camera moved.
  textCache: {},
  textImg(text, size, color) {
    text = G.i18n.t(text);
    const k = text + "|" + size + "|" + color;
    if (this.textCache[k]) return this.textCache[k];
    const S = 4, m = document.createElement("canvas").getContext("2d");
    m.font = `bold ${size * S}px monospace`;
    const w = Math.ceil(m.measureText(text).width / S) + 1;
    const c = document.createElement("canvas"); c.width = w * S; c.height = size * S;
    const x = c.getContext("2d"); x.font = `bold ${size * S}px monospace`; x.fillStyle = color; x.textBaseline = "alphabetic"; x.fillText(text, 0, size * S * 0.9);
    return (this.textCache[k] = { c, w });
  },
  signs(ctx, map, view) {
    for (const b of map.buildings) {
      if (b.destroyed) continue;
      const s = signFor(b);
      if (!s) continue;
      const dx = b.doorX * 16 + 8, wy = b.doorY * 16;
      if (dx < view.x - 60 || dx > view.x + view.w + 60 || wy < view.y - 40 || wy > view.y + view.h + 20) continue;
      // awning over the door
      if (s.awning) for (let i = 0; i < 6; i++) { ctx.fillStyle = s.awning[i % 2]; ctx.fillRect(dx - 18 + i * 6, wy - 3, 6, 5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx - 18 + i * 6, wy + 2, 6, 1); }
      // the board on the wall beside the door
      if (s.text && !G.signposts) {
        const img = G.facades.textImg(s.text, 6, s.fg);
        const tw = img.w + 6, sx = dx + 10, sy = wy + 2;
        ctx.fillStyle = '#1a1214'; ctx.fillRect(sx - 1, sy - 1, tw + 2, 10);
        ctx.fillStyle = s.bg; ctx.fillRect(sx, sy, tw, 8);
        const glow = s.neon ? 0.75 + Math.sin(G.loop.time * 3 + b.x) * 0.25 : 1;
        ctx.globalAlpha = glow; ctx.drawImage(img.c, sx + 3, sy + 1, img.w, 6); ctx.globalAlpha = 1;
        if (s.bulbs) for (let i = 0; i < tw; i += 3) { ctx.fillStyle = Math.floor(G.loop.time * 4 + i) % 2 ? '#ffe080' : '#a06020'; ctx.fillRect(sx + i, sy - 2, 1, 1); ctx.fillRect(sx + i, sy + 9, 1, 1); }
      }
      // small symbols
      const ix = dx - 22, iy = wy + 2;
      if (!G.signposts || s.icon === 'cross_church') switch (s.icon) {
        case 'pole': for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#d83a3a', '#f0f0f0', '#3a5ad8'][(i + Math.floor(G.loop.time * 4)) % 3]; ctx.fillRect(ix + 2, iy + i, 3, 1); } break;
        case 'cross': ctx.fillStyle = '#2a9a4a'; ctx.fillRect(ix + 1, iy + 3, 7, 3); ctx.fillRect(ix + 3, iy + 1, 3, 7); break;
        case 'mug': ctx.fillStyle = '#e8b040'; ctx.fillRect(ix + 1, iy + 2, 5, 6); ctx.fillStyle = '#fff'; ctx.fillRect(ix + 1, iy + 1, 5, 2); ctx.fillStyle = '#e8b040'; ctx.fillRect(ix + 6, iy + 3, 2, 3); break;
        case 'balls': ctx.fillStyle = '#e8c040'; for (const [a, c] of [[1, 5], [5, 5], [3, 1]]) { ctx.beginPath(); ctx.arc(ix + a + 1, iy + c + 1, 1.6, 0, Math.PI * 2); ctx.fill(); } break;
        case 'gem': ctx.fillStyle = '#7ae0ff'; ctx.beginPath(); ctx.moveTo(ix + 4, iy + 1); ctx.lineTo(ix + 8, iy + 4); ctx.lineTo(ix + 4, iy + 8); ctx.lineTo(ix, iy + 4); ctx.fill(); break;
        case 'bottle': ctx.fillStyle = '#3a8a4a'; ctx.fillRect(ix + 3, iy, 2, 3); ctx.fillRect(ix + 2, iy + 3, 4, 6); break;
        case 'cart': ctx.fillStyle = '#f0f0f0'; ctx.fillRect(ix, iy + 2, 7, 4); ctx.fillRect(ix + 1, iy + 7, 1, 1); ctx.fillRect(ix + 5, iy + 7, 1, 1); break;
        case 'gun': ctx.fillStyle = '#c8c8d0'; ctx.fillRect(ix, iy + 2, 8, 2); ctx.fillRect(ix + 1, iy + 4, 2, 4); break;
        case 'shirt': ctx.fillStyle = '#f0c0e0'; ctx.fillRect(ix + 2, iy + 2, 5, 6); ctx.fillRect(ix, iy + 2, 9, 2); break;
        case 'cross_church': ctx.fillStyle = '#e8d8a0'; ctx.fillRect(dx - 1, wy - 12, 2, 9); ctx.fillRect(dx - 3, wy - 10, 6, 2); break;
      }
    }
  },
  // doors open as people approach (only for those allowed through)
  doors(ctx, scene, view, dt) {
    const map = scene.map, locked = new Set((scene.lockedDoors || []).map((b) => b.id));
    for (const b of map.buildings) {
      if (b.destroyed || b.floorOf) continue;
      const cx = b.doorX * 16 + 8, cy = b.doorY * 16 + 8;
      if (cx < view.x - 20 || cx > view.x + view.w + 20 || cy < view.y - 20 || cy > view.y + view.h + 20) { b.doorOpen = 0; continue; }
      let want = 0;
      for (const a of scene.actors) {
        if (a.dead || (a.kind !== 'npc' && a.kind !== 'player')) continue;
        if (Math.abs(a.x - cx) > 12 || Math.abs(a.y - 4 - cy) > 22) continue;
        if (a.kind === 'player' && locked.has(b.id) && a.y > cy + 8) continue;
        if (a.kind === 'npc' && locked.has(b.id) && !(G.keys && G.keys.npcHas(a, map, b)) && a.y > cy + 8) continue;
        want = 1; break;
      }
      b.doorOpen = (b.doorOpen || 0) + G.util.clamp(want - (b.doorOpen || 0), -dt * 5, dt * 5);
      const o = b.doorOpen;
      if (o <= 0.01) continue;
      // the dark doorway, and the door leaf swinging inward against the left jamb
      ctx.fillStyle = '#1a120c'; ctx.fillRect(b.doorX * 16 + 1, b.doorY * 16 + 3, 14, 13);
      ctx.fillStyle = 'rgba(120,90,60,0.5)'; ctx.fillRect(b.doorX * 16 + 1, b.doorY * 16 + 3, 14, 2);
      const lw = Math.max(2, 14 * (1 - o) + 2 * o);
      ctx.fillStyle = '#8a4a2a'; ctx.fillRect(b.doorX * 16 + 1, b.doorY * 16 + 3, lw, 13 - o * 5);
      ctx.fillStyle = '#5a2e14'; ctx.fillRect(b.doorX * 16 + lw - 1 + 1, b.doorY * 16 + 3, 1, 13 - o * 5);
    }
  },
  // (no floating arrows over stairs and elevators: the [E] prompt names them when you walk up)
  markers() {},
};
const FS = G.FireSystem.prototype, _dg = FS.drawGround;
FS.drawGround = function (ctx, view) {
  _dg.call(this, ctx, view);
  const scene = this.scene;
  if (scene && scene.map === this.map) G.facades.doors(ctx, scene, view, 1 / 60);
};
const GS = G.GameScene.prototype, _r = GS.render;
GS.render = function (ctx) {
  _r.call(this, ctx);
  if (!this.map || !this.player) return;
  G.renderer.worldTransform();
  G.facades.markers(ctx, this);
};

// clearer stairs: a lit staircase with banisters, and a hole in the floor going down
const _init = A.init;
A.init = function () {
  _init.call(this);
  const mk = (name, w, h, fn) => { const { c, x } = A.mk(w, h); fn(x); A.outline(c); A.sprites[name] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h }; };
  const R = (x, px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  mk('stairs_up', 16, 26, (x) => {
    for (let i = 0; i < 6; i++) { const y = 2 + i * 4; R(x, 2, y, 12, 4, A.shade('#a07a4a', 0.7 + i * 0.07)); R(x, 2, y, 12, 1, '#f0d8a0'); }
    R(x, 0, 0, 2, 26, '#5a3a1e'); R(x, 14, 0, 2, 26, '#5a3a1e'); R(x, 0, 0, 2, 1, '#c8a060'); R(x, 14, 0, 2, 1, '#c8a060');
  });
  mk('stairs_down', 16, 16, (x) => {
    R(x, 0, 0, 16, 16, '#100a06');
    for (let i = 0; i < 4; i++) { R(x, 2, 2 + i * 3.5, 12, 3, A.shade('#a07a4a', 1 - i * 0.2)); R(x, 2, 2 + i * 3.5, 12, 1, A.shade('#f0d8a0', 1 - i * 0.2)); }
    R(x, 0, 0, 16, 1, '#c8a060'); R(x, 0, 0, 1, 16, '#5a3a1e'); R(x, 15, 0, 1, 16, '#5a3a1e');
  });
};
})();
