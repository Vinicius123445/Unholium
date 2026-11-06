'use strict';
// Graphics settings (Settings > Graphics):
//   Display: render resolution (native, or a fixed 720p..4K, stretched to the window), render scale,
//     world zoom (how much of the world you see), UI scale, V-Sync, frame rate limit, upscale filter
//     (sharp pixels or smooth), brightness, saturation.
//   Quality: Low, Medium, High, Ultra. All four use the HD art; G.gfxLevel() is what the level pays for.
//     Picking a level sets the effect toggles and the render scale; they can be changed by hand afterwards.
//   Effects: each piece of the look on its own: dynamic lighting, sun and cloud shadows, weather,
//     water effects, vignette, particle amount.
// G.gfx(name) tells the effect modules whether they are on.
(() => {
const S = G.settings, D = S.defaults;
Object.assign(D, {
  resolution: 0, renderScale: 1, worldZoom: 2, uiScale: 1, vsync: true, fpsLimit: 0, upscale: 0, brightness: 1, saturation: 1,
  fxLighting: true, fxShadows: true, fxClouds: true, fxWeather: true, fxWater: true, fxVignette: true, particles: 3,
});
for (const k of Object.keys(D)) if (S.data[k] === undefined) S.data[k] = D[k];

const RES = [null, [1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]];
const RES_NAMES = ['Native', '1280 x 720', '1600 x 900', '1920 x 1080', '2560 x 1440', '3840 x 2160'];
const SCALES = [0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];
const ZOOM = [170, 200, 240, 280, 330];
const ZOOM_NAMES = ['Very close', 'Close', 'Normal', 'Far', 'Very far'];
const UISC = [0.8, 0.9, 1, 1.1, 1.25, 1.4];
const FPS = [0, 30, 60, 75, 120, 144, 165, 240];
const FX = { lighting: 'fxLighting', shadows: 'fxShadows', clouds: 'fxClouds', weather: 'fxWeather', water: 'fxWater', vignette: 'fxVignette' };
// allTiles: the two extra variants of each tile (js/game/hdart.js). lightDiv: the light map is drawn at 1/lightDiv of the screen.
// rain, splash: streaks on screen and rings on the ground in a downpour. casings: how many stay on the ground. traffic: most cars on a map.
const LEVELS = [
  { name: 'Low', allTiles: false, lightDiv: 4, rain: 160, splash: 20, casings: 30, traffic: 5, set: { renderScale: 0.75, fxShadows: false, fxClouds: false, fxWater: false, fxVignette: false, particles: 1 } },
  { name: 'Medium', allTiles: false, lightDiv: 3, rain: 240, splash: 30, casings: 50, traffic: 7, set: { renderScale: 1, fxShadows: true, fxClouds: false, fxWater: true, fxVignette: true, particles: 2 } },
  { name: 'High', allTiles: true, lightDiv: 2, rain: 320, splash: 45, casings: 80, traffic: 10, set: { renderScale: 1, fxShadows: true, fxClouds: false, fxWater: true, fxVignette: true, particles: 2 } },
  { name: 'Ultra', allTiles: true, lightDiv: 2, rain: 650, splash: 90, casings: 120, traffic: 10, set: { renderScale: 1, fxShadows: true, fxClouds: true, fxWater: true, fxVignette: true, particles: 3 } },
];

G.gfx = (name) => S.get(FX[name]) !== false;
G.gfxLevel = () => LEVELS[S.get('graphics')] || LEVELS[LEVELS.length - 1];
G.gfxOpts = { RES, RES_NAMES, SCALES, ZOOM, ZOOM_NAMES, UISC, FPS, LEVELS };

// ---------------------------------------------------------------- the canvas: resolution, scale, zoom, UI
const R = G.renderer;
R.resize = function () {
  const dpr = window.devicePixelRatio || 1, ww = Math.max(320, window.innerWidth), wh = Math.max(180, window.innerHeight);
  const res = RES[S.get('resolution')] || null;
  let W, H;
  if (res) { H = res[1]; W = Math.round(H * ww / wh); }
  else { const k = S.get('renderScale') || 1; W = Math.floor(ww * dpr * k); H = Math.floor(wh * dpr * k); }
  this.W = Math.max(320, W); this.H = Math.max(180, H);
  this.canvas.width = this.W; this.canvas.height = this.H;
  const viewH = ZOOM[S.get('worldZoom')] || G.config.VIEW_H;
  let z = this.H / viewH;
  if (S.get('pixelPerfect')) z = Math.max(1, Math.round(z));
  this.zoom = z;
  this.viewW = this.W / z; this.viewH = this.H / z;
  const u = S.get('uiScale') || 1;
  this.uiScale = (this.H / G.config.UI_H) * u;
  this.uiW = this.W / this.uiScale; this.uiH = G.config.UI_H / u;
  this.ctx.imageSmoothingEnabled = false;
  applyCss();
};
function applyCss() {
  const c = R.canvas; if (!c) return;
  c.style.imageRendering = S.get('upscale') ? 'auto' : 'pixelated';
  const b = S.get('brightness'), s = S.get('saturation');
  c.style.filter = b !== 1 || s !== 1 ? `brightness(${b}) saturate(${s})` : '';
}
G.events.on('settingsChanged', (k) => {
  if (k === 'graphics') { Object.assign(S.data, G.gfxLevel().set); S.save(); R.resize(); }
  if (['resolution', 'renderScale', 'worldZoom', 'uiScale', 'pixelPerfect'].includes(k) || k == null) R.resize();
  if (['upscale', 'brightness', 'saturation'].includes(k)) applyCss();
});
if (R.canvas) R.resize();

// ---------------------------------------------------------------- the loop: V-Sync and a frame cap
// V-Sync on: frames follow the display's refresh (requestAnimationFrame), optionally capped.
// V-Sync off: frames run as fast as the frame cap allows (or as fast as possible), not tied to the display.
const LP = G.loop;
LP.start = function () {
  this.running = true;
  let last = performance.now(), acc = 0, lastDraw = 0;
  const mc = new MessageChannel();
  const frame = (now) => {
    if (!this.running) return;
    now = now || performance.now();
    const cap = FPS[S.get('fpsLimit')] || 0, vs = S.get('vsync') !== false;
    if (cap && now - lastDraw < 1000 / cap - 0.5) { schedule(vs); return; }
    lastDraw = now;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= this.STEP) { this.tick(this.STEP); acc -= this.STEP; }
    this.alpha = acc / this.STEP;
    this.draw();
    this._frames++; this._fpsT += dt;
    if (this._fpsT >= 1) { this.fps = this._frames; this._frames = 0; this._fpsT = 0; }
    schedule(vs);
  };
  const schedule = (vs) => { if (vs || document.hidden) requestAnimationFrame(frame); else mc.port2.postMessage(0); };
  mc.port1.onmessage = () => frame(performance.now());
  requestAnimationFrame(frame);
};

// ---------------------------------------------------------------- particle amount
const GS = G.GameScene.prototype, _parts = GS.particles;
GS.particles = function (x, y, color, n) { const k = [0, 0.5, 1, 1.6][S.get('particles')] ?? 1; if (k <= 0) return; return _parts.call(this, x, y, color, Math.max(1, Math.round(n * k))); };
})();
