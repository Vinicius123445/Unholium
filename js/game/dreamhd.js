'use strict';
// Dreams in the HD look, and quieter.
//   The pictures: every dream scene is a real little place (the same kind the explorable part builds:
//   rooms that do not add up, things where they do not belong) drawn with the game's HD ground, HD
//   furniture, swaying trees and HD people, seen through a camera that drifts on its own.
//   The feel: a soft glow that bleeds out of the bright parts, edges that blur away, slow fog, motes of
//   light floating up, colors that shift; nightmares are darker, redder, with the light closing in.
//   Less text: the story lines are shorter and fewer (at most three per scene, one line at a time, small),
//   the controls are shown once at the start and then fade, the dream pockets only open when you ask,
//   and people in the dream speak in small bubbles over their heads instead of captions.
(() => {
const DW = G.DreamWorldScene.prototype, DS = G.DreamScene.prototype, A = G.assets;
const buildMap = (set, theme) => DW.build.call({ freeOn: DW.freeOn }, set, theme);
const SET = () => G.dreams.SETTINGS || {};

// ---------------------------------------------------------------- shared drawing
function hdPerson(ctx, sheet, x, y, dir, moving, anim, t, alpha = 1) {
  const hd = G.hd && sheet && G.hd.get(sheet);
  ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;
  if (hd) {
    const C = G.hd.COL, col = moving ? C.walk + (Math.floor(anim * 10) % 8) : C.idle + (Math.floor(t * 2) % 4);
    ctx.drawImage(hd.img, col * G.hd.FW, (dir || 0) * G.hd.FH, G.hd.FW, G.hd.FH, Math.round(x - G.hd.WW / 2), Math.round(y - G.hd.WH + 1), G.hd.WW, G.hd.WH);
  } else if (sheet) {
    const c = moving ? 1 + (Math.floor(anim * 7) % 2) : 0;
    ctx.drawImage(sheet.img, c * sheet.fw, (dir || 0) * sheet.fh, sheet.fw, sheet.fh, Math.round(x - sheet.fw / 2), Math.round(y - sheet.fh + 1), sheet.fw, sheet.fh);
  }
  ctx.globalAlpha = 1;
}
function drawProps(ctx, map, view, extra) {
  const list = [];
  for (const d of map.decor) if (d.x > view.x - 40 && d.x < view.x + view.w + 40 && d.y > view.y - 10 && d.y < view.y + view.h + 60) list.push({ d, y: d.y });
  for (const e of extra || []) list.push(e);
  list.sort((a, b) => a.y - b.y);
  const fake = { map, player: null };
  for (const o of list) {
    if (o.d) { const s = A.sprites[o.d.def.sprite]; if (!s) continue; if (G.drawDecor) G.drawDecor(ctx, o.d, s, fake); else ctx.drawImage(s.img, Math.round(o.d.x - s.ax), Math.round(o.d.y - s.ay)); }
    else if (o.draw) o.draw();
  }
}
// the dream look, over a finished frame: glow, blurred edges, fog, motes, grade, vignette
const fx = { small: null, edge: null };
function dreamPost(ctx, W, H, t, mood, light, motes) {
  const cv = ctx.canvas, sw = Math.max(16, Math.round(W / 8)), sh = Math.max(9, Math.round(H / 8));
  if (!fx.small || fx.small.width !== sw || fx.small.height !== sh) { fx.small = A.mk(sw, sh).c; fx.edge = A.mk(W, H).c; }
  const sx = fx.small.getContext('2d'); sx.imageSmoothingEnabled = true; sx.clearRect(0, 0, sw, sh); sx.drawImage(cv, 0, 0, sw, sh);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  // edges blur away: the blurred frame, kept only toward the edges
  const ex = fx.edge.getContext('2d'); ex.globalCompositeOperation = 'source-over'; ex.clearRect(0, 0, W, H); ex.imageSmoothingEnabled = true; ex.drawImage(fx.small, 0, 0, W, H);
  ex.globalCompositeOperation = 'destination-in';
  const m = ex.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.62); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  ex.fillStyle = m; ex.fillRect(0, 0, W, H); ex.globalCompositeOperation = 'source-over';
  ctx.drawImage(fx.edge, 0, 0);
  // the glow bleeding out of bright things
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = mood === 'nightmare' ? 0.18 : 0.38; ctx.drawImage(fx.small, 0, 0, W, H); ctx.globalAlpha = 1;
  // slow fog banks
  for (let i = 0; i < 3; i++) {
    const fxp = ((t * (6 + i * 3) + i * W * 0.37) % (W * 1.6)) - W * 0.3, fyp = H * (0.25 + i * 0.25) + Math.sin(t * 0.3 + i) * H * 0.05, r = W * 0.35;
    const g = ctx.createRadialGradient(fxp, fyp, 0, fxp, fyp, r); g.addColorStop(0, mood === 'nightmare' ? 'rgba(60,20,40,0.22)' : 'rgba(235,225,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(fxp - r, fyp - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // floating motes of light
  for (const q of motes) { const a = 0.35 + 0.35 * Math.sin(t * 2 + q.p); ctx.fillStyle = mood === 'nightmare' ? `rgba(255,120,120,${(a * 0.6).toFixed(2)})` : `rgba(255,248,220,${a.toFixed(2)})`; const x = (q.x * W + Math.sin(t * 0.5 + q.p) * W * 0.02), y = ((q.y - t * q.v) % 1 + 1) % 1 * H; ctx.fillRect(x, y, Math.max(1, W / 500) * q.s, Math.max(1, W / 500) * q.s); }
  // color: a slow drifting tint (warm for good dreams, red and dark for nightmares)
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = mood === 'nightmare' ? '#7a1030' : mood === 'good' ? '#ffd890' : `hsl(${(t * 10) % 360},55%,62%)`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const r0 = Math.max(W, H) * ((light ? 0.6 : 0.44) + Math.sin(t) * 0.03) * (mood === 'nightmare' ? 0.8 : 1);
  const vg = ctx.createRadialGradient(W / 2, H / 2, r0 * 0.35, W / 2, H / 2, r0 * 1.2); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, mood === 'nightmare' ? 'rgba(8,0,4,0.96)' : 'rgba(10,6,20,0.82)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (mood === 'nightmare' && Math.random() < 0.015) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
const makeMotes = (n) => Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.03, p: Math.random() * 6, s: 1 + Math.floor(Math.random() * 2) }));
function bubble(ctx, text, x, y, a) {
  if (!G.facades) return;
  const img = G.facades.textImg(text, 5, '#f4ecff');
  ctx.globalAlpha = a; ctx.fillStyle = 'rgba(16,10,28,0.72)'; ctx.fillRect(Math.round(x - img.w / 2 - 2), Math.round(y - 7), img.w + 4, 8);
  ctx.drawImage(img.c, Math.round(x - img.w / 2), Math.round(y - 6), img.w, 5); ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the explorable dream
const _upd = DW.update;
DW.update = function (dt) {
  const before = this.msg, me = this.me;
  _upd.call(this, dt);
  // a stranger's words go in a bubble over their head, not across the bottom of the screen
  if (this.msg !== before && /^"/.test(this.msg || '')) {
    const f = this.figures.filter((o) => !o.shadow).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (f) { f.say = this.msg.replace(/"/g, ''); f.sayT = 3.5; this.msgT = 0; }
  }
  for (const f of this.figures) if (f.sayT > 0) f.sayT -= dt;
};
DW.render = function (ctx) {
  const RR = G.renderer, UU = G.ui, m = this.map, me = this.me, t = this.t;
  // the camera follows loosely and never quite holds still
  const tx = me.x - RR.viewW / 2 + Math.sin(t * 0.31) * 5, ty = me.y - RR.viewH / 2 + Math.cos(t * 0.23) * 4;
  this.cx = this.cx == null ? tx : this.cx + (tx - this.cx) * 0.08; this.cy = this.cy == null ? ty : this.cy + (ty - this.cy) * 0.08;
  RR.cam.x = G.util.clamp(this.cx, 0, Math.max(0, m.pw - RR.viewW)); RR.cam.y = G.util.clamp(this.cy, 0, Math.max(0, m.ph - RR.viewH)); RR.cam.sx = RR.cam.sy = 0;
  RR.clear(this.nightmare ? '#050206' : '#0c0a14');
  RR.worldTransform();
  const view = RR.viewRect(40);
  m.drawGround(ctx, view, t);
  // the glowing door
  const ex = m.exit, gx = ex.x * 16 + 8, gy = ex.y * 16 + 12;
  const gl = ctx.createRadialGradient(gx, gy - 10, 2, gx, gy - 10, 34); gl.addColorStop(0, m.exitLocked ? 'rgba(255,200,120,0.55)' : 'rgba(255,250,220,0.9)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gl; ctx.fillRect(gx - 34, gy - 44, 68, 68);
  ctx.fillStyle = '#2a1a0e'; ctx.fillRect(gx - 8, gy - 23, 16, 23); ctx.fillStyle = '#5a3a1e'; ctx.fillRect(gx - 7, gy - 22, 14, 22);
  ctx.fillStyle = m.exitLocked ? 'rgba(232,176,96,0.9)' : 'rgba(255,248,224,0.95)'; ctx.fillRect(gx - 7, gy - 22, 14, 1); ctx.fillRect(gx - 8, gy - 22, 1, 22); ctx.fillRect(gx + 7, gy - 22, 1, 22); ctx.fillRect(gx + 3, gy - 11, 2, 2);
  // things lying around: a small glint where they are
  for (const l of m.loose) {
    const tw = Math.sin(t * 4 + l.x) * 0.5 + 0.5;
    const g = ctx.createRadialGradient(l.x, l.y - 4, 0, l.x, l.y - 4, 9); g.addColorStop(0, `rgba(255,250,220,${(0.35 + tw * 0.4).toFixed(2)})`); g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g; ctx.fillRect(l.x - 9, l.y - 13, 18, 18);
    ctx.drawImage(A.icon(G.dreamworld.ITEMS[l.id].icon), Math.round(l.x - 4), Math.round(l.y - 8 - tw), 8, 8);
  }
  const extra = [];
  for (const f of this.figures) {
    const moving = Math.hypot(f.vx, f.vy) > 1 || f.shadow, dir = f.shadow ? G.util.dirFromVec(me.x - f.x, me.y - f.y) : Math.abs(f.vx) > Math.abs(f.vy) ? (f.vx < 0 ? 1 : 2) : f.vy < 0 ? 3 : 0;
    f.anim = (f.anim || 0) + (moving ? 1 / 60 : 0);
    extra.push({ y: f.y, draw: () => {
      hdPerson(ctx, f.sheet, f.x, f.y, dir, moving, f.anim, t + f.x, f.shadow ? 0.9 : 0.55 + Math.sin(t + f.x) * 0.25);
      if (f.shadow) for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(5,0,10,${0.25 + 0.15 * Math.sin(t * 5 + i)})`; ctx.fillRect(f.x - 6 + i * 3 + Math.sin(t * 4 + i) * 1.5, f.y - 14 - ((t * 10 + i * 4) % 10), 2, 3); }
    } });
  }
  extra.push({ y: me.y, draw: () => hdPerson(ctx, this.sheet, me.x, me.y - (me.fly > 0 ? 6 + Math.sin(t * 3) * 2 : 0), me.dir, me.moving, me.anim, t) });
  drawProps(ctx, m, view, extra);
  for (const f of this.figures) if (f.sayT > 0 && f.say) bubble(ctx, f.say, f.x, f.y - 26, Math.min(1, f.sayT));
  this.motes = this.motes || makeMotes(40);
  dreamPost(ctx, RR.W, RR.H, t, this.nightmare ? 'nightmare' : this.ds && this.ds.dream.mood, me.light > 0, this.motes);
  // the few words left on screen
  RR.uiTransform();
  if (this.msgT > 0) { ctx.globalAlpha = Math.min(1, this.msgT) * 0.9; UU.text(ctx, this.msg, RR.uiW / 2, RR.uiH - 34, { align: 'center', size: 9, color: '#f4ecff', font: 'serif' }); ctx.globalAlpha = 1; }
  if (this.showInv) {
    const w = 140, h = 16 + this.inv.length * 13, x = 8, y = 22;
    UU.panel(ctx, x, y, w, h, { accent: '#b08ae0' });
    this.inv.forEach((id, i) => { UU.icon(ctx, G.dreamworld.ITEMS[id].icon, x + 6, y + 6 + i * 13, 0.7); UU.text(ctx, `${i + 1}. ${G.dreamworld.ITEMS[id].name}`, x + 20, y + 8 + i * 13, { size: 7 }); });
  }
};

// ---------------------------------------------------------------- the told part of a dream
const _build = DS.buildScene;
DS.buildScene = function () {
  _build.call(this);
  const b = this.scene.beats;
  if (b.length > 3 && !this.scene.trimmed) { this.scene.trimmed = true; this.scene.beats = [b[0], b[Math.floor(b.length / 2)], b[b.length - 1]]; }   // fewer words
  const set = this.scene.set || 'void';
  this.wmap = set === 'void' ? null : buildMap(set, this.scene.theme);
  if (this.wmap) { this.pan = { x: this.wmap.start.x * 16 - 160 + (Math.random() - 0.5) * 120, y: this.wmap.start.y * 16 - 100 + (Math.random() - 0.5) * 60, a: Math.random() * 6.28 }; }
  this.motes = makeMotes(this.dream.mood === 'nightmare' ? 25 : 45);
};
// the picture: a live HD view of the dream place, 640x360 (twice the old picture's detail)
DS.paintBg = function () {
  const W = 320, H = 180, K = 2;
  if (!this.bg2) { this.bg2 = A.mk(W * K, H * K).c; }
  const x = this.bg2.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#05040a'; x.fillRect(0, 0, W * K, H * K);
  const m = this.wmap;
  if (!m) {   // the void: soft nothing, with light drifting in it
    const g = x.createRadialGradient(W, H, 0, W, H, W); g.addColorStop(0, 'rgba(60,50,90,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W * K, H * K);
    return;
  }
  const p = this.pan, cx = G.util.clamp(p.x + Math.sin(this.t * 0.06 + p.a) * 50, 0, Math.max(0, m.pw - W)), cy = G.util.clamp(p.y + Math.cos(this.t * 0.05 + p.a) * 24, 0, Math.max(0, m.ph - H));
  x.imageSmoothingEnabled = false;
  x.setTransform(K, 0, 0, K, -Math.round(cx * K), -Math.round(cy * K));
  const view = { x: cx - 20, y: cy - 20, w: W + 40, h: H + 40 };
  m.drawGround(x, view, this.t);
  drawProps(x, m, view, []);
  x.setTransform(1, 0, 0, 1, 0, 0);
  this.bgCam = { x: cx, y: cy };
};
DS.render = function (ctx) {
  const R = G.renderer, U = G.ui, mood = this.dream.mood;
  this.paintBg();
  R.screenTransform();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, R.W, R.H);
  const scale = Math.min(R.W / 320, R.H / 180), iw = 320 * scale, ih = 180 * scale, ox = (R.W - iw) / 2, oy = (R.H - ih) / 2;
  ctx.imageSmoothingEnabled = false;
  // nothing holds still: the picture sways in slow slices
  const wob = mood === 'nightmare' ? 3 : 1.6;
  for (let y = 0; y < 360; y += 4) { const off = Math.sin(this.t * 1.1 + y * 0.03) * wob; ctx.drawImage(this.bg2, 0, y, 640, 4, ox + off * scale, oy + (y / 2) * scale, iw, 2 * scale); }
  const sheetAt = (sheet, x, y, dir, i, alpha) => { ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale); hdPerson(ctx, sheet, x, y, dir, false, 0, this.t + i, alpha); ctx.restore(); };
  this.figures.forEach((fg, i) => sheetAt(fg.sheet, fg.x + Math.sin(this.t * 0.4 + i * 2) * 10, fg.y, i % 2 ? 2 : 0, i, 0.5 + Math.sin(this.t * 0.7 + i) * 0.3));
  if (!this.play && this.body) sheetAt(this.body, 160 + Math.sin(this.t * 0.5) * 6, 132 + (this.scene.theme === 'flying' || (this.dream.lucid && this.si === this.dream.scenes.length - 1) ? -40 + Math.sin(this.t * 2) * 6 : 0), 0, 0, 1);
  dreamPost(ctx, R.W, R.H, this.t, mood, false, this.motes || (this.motes = makeMotes(40)));
  if (this.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${this.fade})`; ctx.fillRect(0, 0, R.W, R.H); }
  if (this.play) { R.screenTransform(); this.drawPlay(ctx, ox, oy, scale); return; }
  // the words: one short line at a time, small, near the bottom
  R.uiTransform();
  const text = G.i18n.t(this.beatText()).slice(0, Math.floor(this.chars));
  const lines = U.wrap(ctx, text, Math.min(380, R.uiW - 40), 9).slice(0, 3);
  lines.forEach((l, i) => U.text(ctx, l, R.uiW / 2, R.uiH - 46 + i * 12, { align: 'center', size: 9, color: mood === 'nightmare' ? '#ffc8d0' : '#f4ecff', font: 'serif' }));
};
})();
