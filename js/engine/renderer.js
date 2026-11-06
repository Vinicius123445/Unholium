'use strict';
// Renderer: canvas sizing, world camera, world/UI transforms, screen shake.

G.renderer = {
  canvas: null,
  ctx: null,
  W: 0, H: 0,
  zoom: 1,
  viewW: 0, viewH: 0,     // visible world area in world pixels
  uiScale: 1,
  uiW: 0, uiH: 0,         // virtual UI size
  cam: { x: 0, y: 0, shake: 0, sx: 0, sy: 0 },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    G.events.on('settingsChanged', (k) => { if (k === 'pixelPerfect') this.resize(); });
    this.resize();
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.W = Math.max(320, Math.floor(window.innerWidth * dpr));
    this.H = Math.max(180, Math.floor(window.innerHeight * dpr));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    let z = this.H / G.config.VIEW_H;
    if (G.settings.get('pixelPerfect')) z = Math.max(1, Math.round(z));
    this.zoom = z;
    this.viewW = this.W / z;
    this.viewH = this.H / z;
    this.uiScale = this.H / G.config.UI_H;
    this.uiW = this.W / this.uiScale;
    this.uiH = G.config.UI_H;
    this.ctx.imageSmoothingEnabled = false;
  },

  clear(color = '#000') {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = color;
    c.fillRect(0, 0, this.W, this.H);
  },

  // Center camera on (x,y), clamped to map bounds (centered if the map is smaller than the view).
  follow(x, y, mapW, mapH, dt, snap = false) {
    const cam = this.cam;
    let tx = x - this.viewW / 2;
    let ty = y - this.viewH / 2;
    tx = mapW <= this.viewW ? (mapW - this.viewW) / 2 : G.util.clamp(tx, 0, mapW - this.viewW);
    ty = mapH <= this.viewH ? (mapH - this.viewH) / 2 : G.util.clamp(ty, 0, mapH - this.viewH);
    if (snap) { cam.x = tx; cam.y = ty; }
    else {
      const k = 1 - Math.pow(0.0001, dt);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    }
    if (cam.shake > 0 && G.settings.get('screenShake')) {
      cam.sx = (Math.random() - 0.5) * cam.shake;
      cam.sy = (Math.random() - 0.5) * cam.shake;
      cam.shake = Math.max(0, cam.shake - dt * 20);
    } else {
      cam.sx = cam.sy = 0;
      cam.shake = 0;
    }
  },

  shake(amount) { this.cam.shake = Math.max(this.cam.shake, amount); },

  worldTransform() {
    const z = this.zoom, c = this.cam;
    this.ctx.setTransform(z, 0, 0, z, Math.round(-(c.x + c.sx) * z), Math.round(-(c.y + c.sy) * z));
    this.ctx.imageSmoothingEnabled = false;
  },

  uiTransform() {
    this.ctx.setTransform(this.uiScale, 0, 0, this.uiScale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  },

  screenTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  // Visible world rect (with margin) for culling
  viewRect(margin = 32) {
    return {
      x: this.cam.x - margin, y: this.cam.y - margin,
      w: this.viewW + margin * 2, h: this.viewH + margin * 2,
    };
  },

  worldToUI(x, y) {
    const z = this.zoom;
    return {
      x: ((x - this.cam.x) * z) / this.uiScale,
      y: ((y - this.cam.y) * z) / this.uiScale,
    };
  },
};
