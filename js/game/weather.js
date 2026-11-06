'use strict';
// Weather: clear skies, clouds, morning fog, rain and thunderstorms. Purely atmospheric (sound
// and picture); it is worked out from the day number, so it needs no save data and every
// playthrough gets the same forecast for the same day.
//   G.weather.cloud 0..1   rain 0..1   fog 0..1   storm 0/1   flash (lightning, fades out)
//   G.weather.force = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | null   (debug: G.debug.weather)
(() => {
const KINDS = [['clear', 40], ['cloudy', 24], ['fog', 12], ['rain', 16], ['storm', 8]];

G.weather = {
  cloud: 0, rain: 0, fog: 0, storm: 0, flash: 0, kind: 'clear', force: null, off: false,

  // the plan for a day: what kind, and when the rain starts and stops
  plan(day) {
    const r = new G.RNG(day * 7919 + 1013);
    let n = r.next() * KINDS.reduce((s, k) => s + k[1], 0), kind = 'clear';
    for (const [k, w] of KINDS) { if ((n -= w) <= 0) { kind = k; break; } }
    const start = 4 + r.next() * 14, len = 2 + r.next() * 6;
    return { kind, start, end: start + len };
  },

  targets(day, h) {
    const kind = this.force || this.plan(day).kind, p = this.plan(day);
    const t = { cloud: 0.1, rain: 0, fog: 0, storm: 0 };
    // rain falls inside the day's window, easing in and out over an hour
    const inWin = this.force ? 1 : Math.max(0, Math.min(1, h - p.start + 0.5, p.end - h + 0.5));
    switch (kind) {
      case 'cloudy': t.cloud = 0.65; break;
      case 'fog': t.cloud = 0.5; t.fog = this.force ? 0.8 : Math.max(0, Math.min(1, (10 - h) / 3)) * (h > 3 ? 1 : 0.5); break;
      case 'rain': t.cloud = 0.6 + 0.35 * inWin; t.rain = 0.65 * inWin; break;
      case 'storm': t.cloud = 0.7 + 0.3 * inWin; t.rain = inWin; t.storm = inWin > 0.6 ? 1 : 0; break;
    }
    // a light mist on any clear dawn
    if (h >= 4.5 && h < 7.5) t.fog = Math.max(t.fog, 0.18 * (1 - Math.abs(h - 6) / 1.5));
    return t;
  },

  update(scene, dt) {
    if (this.off || !scene.world) { this.cloud = this.rain = this.fog = this.storm = 0; return; }
    const w = scene.world, t = this.targets(w.day || 1, w.hourF);
    const k = 1 - Math.pow(0.5, dt / 2.5);
    for (const key of ['cloud', 'rain', 'fog']) this[key] += (t[key] - this[key]) * k;
    this.storm = t.storm;
    this.kind = this.force || this.plan(w.day || 1).kind;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    // storms bend the trees
    if (G.breeze && this.rain > 0.05) G.breeze.strength = Math.max(G.breeze.strength, this.rain * 0.6 + this.storm * 0.6);
    if (G.debug && !G.debug.weather) G.debug.weather = debugWeather;
  },
};

// debug: G.debug.weather('rain')  (G.debug is rebuilt at boot in main.js, so it is attached on first update)
const debugWeather = (kind) => { G.weather.force = kind || null; return G.weather.force || 'auto'; };
})();
