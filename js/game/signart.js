'use strict';
// Signs as objects. Every sign is painted once at high density: a real board with a material (neon tube on a dark
// backing, painted steel, grained wood, lit acrylic, LED panel, printed poster), a frame or brackets, screws, cable, and
// the wear its life has given it: faded paint, rust at the bolts, grime running down from the top edge. All in the same
// hand as the rest of the world: limited palette, light from the top left, nothing photographic.
//   G.signArt.board(R-context x, w, h, spec)  draws one
//   spec: { text, sub, mat: neon|steel|wood|acrylic|led|poster|concrete, fg, bg, icon, age (0..1) }
// Neon and LED signs light what is around them, flicker a little, and go dimmer if they are old.
(() => {
const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${clampByte((n >> 16 & 255) * k)},${clampByte((n >> 8 & 255) * k)},${clampByte((n & 255) * k)})`; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const hash = (t) => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const FONTS = { neon: '"Trebuchet MS", Arial, sans-serif', steel: 'Impact, "Arial Narrow", sans-serif', wood: 'Georgia, "Times New Roman", serif', acrylic: 'Arial, sans-serif', led: '"Consolas", monospace', poster: 'Impact, Arial, sans-serif', concrete: 'Impact, Arial, sans-serif' };
const fit = (x, text, w, h, font, weight) => { let size = h; for (; size > 3; size -= 0.25) { x.font = `${weight} ${size}px ${font}`; if (x.measureText(text).width <= w) break; } return size; };
const screws = (x, w, h) => { for (const [a, b] of [[2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2]]) { x.fillStyle = '#8a8e94'; x.beginPath(); x.arc(a, b, 0.8, 0, 6.3); x.fill(); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(a - 0.6, b - 0.1, 1.2, 0.25); x.fillStyle = 'rgba(150,80,30,0.5)'; x.fillRect(a - 0.5, b + 0.8, 0.9, 1.6); } };
const grime = (x, w, h, age, r) => {
  if (age <= 0) return;
  for (let i = 0; i < 26 * age; i++) { const a = r() * w, len = 2 + r() * h * 0.5; x.fillStyle = `rgba(30,22,14,${0.05 + r() * 0.1})`; x.fillRect(a, r() * 2, 0.5 + r(), len); }
  for (let i = 0; i < 40 * age; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * w, r() * h, 0.4 + r() * 2, 0.3); }   // scratches
  for (let i = 0; i < 5 * age; i++) { const a = r() * w, b = r() * h; x.fillStyle = 'rgba(120,70,30,0.3)'; x.beginPath(); x.arc(a, b, 0.5 + r() * 1.2, 0, 6.3); x.fill(); }   // rust
};
const ICON = {
  cross(x, c, s) { x.fillStyle = c; x.fillRect(-s * 0.15, -s * 0.5, s * 0.3, s); x.fillRect(-s * 0.5, -s * 0.15, s, s * 0.3); },
  star(x, c, s) { x.fillStyle = c; x.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.22 : 0.5) * s, a = -1.57 + i * 0.628; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); },
  heart(x, c, s) { x.fillStyle = c; x.beginPath(); x.moveTo(0, s * 0.45); x.bezierCurveTo(-s * 0.7, -s * 0.05, -s * 0.3, -s * 0.55, 0, -s * 0.15); x.bezierCurveTo(s * 0.3, -s * 0.55, s * 0.7, -s * 0.05, 0, s * 0.45); x.fill(); },
  glass(x, c, s) { x.strokeStyle = c; x.lineWidth = s * 0.1; x.beginPath(); x.moveTo(-s * 0.4, -s * 0.4); x.lineTo(s * 0.4, -s * 0.4); x.lineTo(0, s * 0.1); x.closePath(); x.moveTo(0, s * 0.1); x.lineTo(0, s * 0.45); x.moveTo(-s * 0.25, s * 0.45); x.lineTo(s * 0.25, s * 0.45); x.stroke(); },
  film(x, c, s) { x.fillStyle = c; x.fillRect(-s * 0.5, -s * 0.35, s, s * 0.7); x.fillStyle = 'rgba(0,0,0,0.7)'; for (let i = 0; i < 4; i++) { x.fillRect(-s * 0.45 + i * s * 0.24, -s * 0.3, s * 0.12, s * 0.1); x.fillRect(-s * 0.45 + i * s * 0.24, s * 0.2, s * 0.12, s * 0.1); } },
  mask(x, c, s) { x.fillStyle = c; x.beginPath(); x.arc(0, -s * 0.05, s * 0.42, 0, 6.3); x.fill(); x.fillStyle = 'rgba(0,0,0,0.75)'; x.beginPath(); x.arc(-s * 0.16, -s * 0.12, s * 0.08, 0, 6.3); x.arc(s * 0.16, -s * 0.12, s * 0.08, 0, 6.3); x.fill(); x.beginPath(); x.arc(0, s * 0.08, s * 0.2, 0.2, 2.9); x.fill(); },
  note(x, c, s) { x.fillStyle = c; x.beginPath(); x.ellipse(-s * 0.2, s * 0.3, s * 0.16, s * 0.12, -0.3, 0, 6.3); x.fill(); x.fillRect(-s * 0.08, -s * 0.45, s * 0.08, s * 0.75); x.fillRect(-s * 0.08, -s * 0.45, s * 0.4, s * 0.12); },
  fist(x, c, s) { x.fillStyle = c; x.fillRect(-s * 0.38, -s * 0.28, s * 0.76, s * 0.6); for (let i = 0; i < 4; i++) x.fillRect(-s * 0.38 + i * s * 0.2, -s * 0.42, s * 0.17, s * 0.2); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(-s * 0.38, 0, s * 0.76, s * 0.05); },
  coin(x, c, s) { x.fillStyle = c; x.beginPath(); x.arc(0, 0, s * 0.42, 0, 6.3); x.fill(); x.fillStyle = 'rgba(0,0,0,0.5)'; x.font = `bold ${s * 0.6}px Arial`; x.textAlign = 'center'; x.fillText('$', 0, s * 0.22); },
  book(x, c, s) { x.fillStyle = c; x.fillRect(-s * 0.45, -s * 0.3, s * 0.42, s * 0.62); x.fillRect(s * 0.03, -s * 0.3, s * 0.42, s * 0.62); },
  pin(x, c, s) { x.fillStyle = c; x.beginPath(); x.ellipse(0, -s * 0.28, s * 0.13, s * 0.16, 0, 0, 6.3); x.ellipse(0, s * 0.15, s * 0.2, s * 0.32, 0, 0, 6.3); x.fill(); },
  fork(x, c, s) { x.fillStyle = c; x.fillRect(-s * 0.05, -s * 0.1, s * 0.1, s * 0.6); for (let i = -1; i <= 1; i++) x.fillRect(i * s * 0.12 - s * 0.03, -s * 0.5, s * 0.06, s * 0.42); },
  scissors(x, c, s) { x.strokeStyle = c; x.lineWidth = s * 0.09; x.beginPath(); x.moveTo(-s * 0.4, -s * 0.4); x.lineTo(s * 0.25, s * 0.2); x.moveTo(s * 0.4, -s * 0.4); x.lineTo(-s * 0.25, s * 0.2); x.stroke(); x.beginPath(); x.arc(-s * 0.3, s * 0.32, s * 0.12, 0, 6.3); x.arc(s * 0.3, s * 0.32, s * 0.12, 0, 6.3); x.stroke(); },
  bank(x, c, s) { x.fillStyle = c; x.beginPath(); x.moveTo(-s * 0.5, -s * 0.12); x.lineTo(0, -s * 0.48); x.lineTo(s * 0.5, -s * 0.12); x.fill(); for (let i = 0; i < 4; i++) x.fillRect(-s * 0.42 + i * s * 0.26, -s * 0.06, s * 0.1, s * 0.4); x.fillRect(-s * 0.5, s * 0.36, s, s * 0.1); },
};
const S = G.signArt = {
  shade, hash, ICON, sizes: [],
  board(x, w, h, o0) {
    const tr = (s) => (s && G.i18n ? G.i18n.t(s) : s), o = Object.assign({}, o0, { text: tr(o0.text), sub: tr(o0.sub) });
    const r = rnd(hash(o.text + w)), mat = o.mat || 'steel', fg = o.fg || '#f0f0f0', bg = o.bg || '#202024', age = o.age != null ? o.age : 0.5;
    const iconW = o.icon && ICON[o.icon] ? h * 0.8 : 0, tx = (w + iconW) / 2, sub = o.sub ? h * 0.27 : 0, thMax = h - 4 - sub, avail = w - 6 - iconW;
    x.save();
    if (mat === 'neon') {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(0, 0, w, h * 0.4);
      x.strokeStyle = shade(bg, 1.7); x.lineWidth = 0.6; x.strokeRect(0.5, 0.5, w - 1, h - 1);
      const size = fit(x, o.text, avail, thMax * 0.95, FONTS.neon, 'bold'); S.sizes.push({ text: o.text, size, w });
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONTS.neon}`;
      x.shadowColor = fg; x.shadowBlur = 5; x.fillStyle = fg; x.fillText(o.text, tx, (h - sub) / 2 + 0.4, avail); x.shadowBlur = 2; x.fillText(o.text, tx, (h - sub) / 2 + 0.4, avail);
      x.shadowBlur = 0; x.lineWidth = Math.max(0.3, size * 0.05); x.strokeStyle = 'rgba(255,255,255,0.85)'; x.strokeText(o.text, tx, (h - sub) / 2 + 0.4, avail);    // the hot core of the tube
      x.strokeStyle = fg; x.lineWidth = 0.5; x.shadowColor = fg; x.shadowBlur = 3; x.strokeRect(2, 2, w - 4, h - 4); x.shadowBlur = 0;
      x.fillStyle = '#16161a'; for (let i = 8; i < w; i += Math.max(14, w / 4)) x.fillRect(i, h - 0.8, 1, 0.8);       // tube standoffs
    } else if (mat === 'wood') {
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 0.8) { x.fillStyle = `rgba(${r() < 0.5 ? '255,220,170' : '30,16,8'},${0.04 + r() * 0.08})`; x.fillRect(0, y, w, 0.5); }
      for (let i = 0; i < 3; i++) { x.strokeStyle = 'rgba(30,16,8,0.3)'; x.lineWidth = 0.3; x.beginPath(); x.ellipse(r() * w, r() * h, 3 + r() * 3, 0.8, 0, 0, 6.3); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = h / 3; y < h; y += h / 3) x.fillRect(0, y, w, 0.4);
    } else if (mat === 'acrylic') {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, shade(bg, 1.3)); g.addColorStop(0.55, bg); g.addColorStop(1, shade(bg, 0.8)); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w * 0.5, 0); x.lineTo(w * 0.32, h * 0.5); x.lineTo(0, h * 0.5); x.fill();
      x.strokeStyle = '#c8ccd2'; x.lineWidth = 0.8; x.strokeRect(0.4, 0.4, w - 0.8, h - 0.8);
    } else if (mat === 'led') {
      x.fillStyle = '#08080c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a3e46'; x.lineWidth = 0.8; x.strokeRect(0.4, 0.4, w - 0.8, h - 0.8);
    } else if (mat === 'poster') {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.moveTo(w, 0); x.lineTo(w - 3, 0); x.lineTo(w, 3); x.fill();    // a peeling corner
    } else if (mat === 'concrete') {
      x.fillStyle = bg; x.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect(r() * w, r() * h, 0.6, 0.6); }
    } else {   // painted steel
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, shade(bg, 1.15)); g.addColorStop(1, shade(bg, 0.82)); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = shade(bg, 0.55); x.lineWidth = 0.7; x.strokeRect(0.4, 0.4, w - 0.8, h - 0.8); x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 0.3; x.strokeRect(1.1, 1.1, w - 2.2, h - 2.2);
    }
    if (mat !== 'neon') {
      const led = mat === 'led', size = fit(x, o.text, avail, thMax, FONTS[mat] || FONTS.steel, 'bold'); S.sizes.push({ text: o.text, size, w });
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${size}px ${FONTS[mat] || FONTS.steel}`;
      if (!led) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(o.text, tx + 0.4, (h - sub) / 2 + 0.8, avail); }
      x.fillStyle = fg; if (led) { x.shadowColor = fg; x.shadowBlur = 2; } x.fillText(o.text, tx, (h - sub) / 2 + 0.4, avail); x.shadowBlur = 0;
      if (led) { x.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 0; i < w; i += 1) x.fillRect(i, 0, 0.3, h); for (let i = 0; i < h; i += 1) x.fillRect(0, i, w, 0.3); }
    }
    if (o.sub) { x.textAlign = 'center'; x.textBaseline = 'middle'; const size = fit(x, o.sub, avail, sub * 0.9, FONTS.acrylic, 'bold'); x.font = `bold ${size}px ${FONTS.acrylic}`; x.fillStyle = shade(fg.length === 7 ? fg : '#f0f0f0', 0.82); x.fillText(o.sub, tx, h - sub / 2 - 1.5, avail); }
    if (iconW) { x.save(); x.translate(3 + iconW / 2, h / 2); if (mat === 'neon') { x.shadowColor = fg; x.shadowBlur = 4; } ICON[o.icon](x, fg, h * 0.62); x.restore(); }
    if (mat !== 'neon' && mat !== 'led') grime(x, w, h, age, r);
    if (mat === 'steel' || mat === 'wood') screws(x, w, h);
    x.restore();
  },
  // a small enamel plate with the opening hours, screwed to the wall beside the door
  hours(x, w, h, text) { x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6a6458'; x.lineWidth = 0.5; x.strokeRect(0.3, 0.3, w - 0.6, h - 0.6); x.fillStyle = '#26262a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${h * 0.56}px Arial, sans-serif`; x.fillText(text, w / 2, h / 2 + 0.2); },
};
// the small signs of the fight club
const V = G.vk;
const addBoard = (id, w, h, spec, def) => V.add(id, w, h, (R, x) => { S.board(x, w, h, spec); }, Object.assign({ solid: false }, def));
addBoard('sign_fights', 72, 15, { text: 'FIGHTS', sub: 'REGISTER HERE', mat: 'neon', fg: '#ff5a3a', bg: '#140808', icon: 'fist' }, { glow: 'rgba(255,90,50,0.5)', light: { r: 80, color: '255,110,70' } });
addBoard('sign_bets', 72, 15, { text: 'BETS', sub: 'ODDS ON THE BOARD', mat: 'neon', fg: '#ffd040', bg: '#141008', icon: 'coin' }, { glow: 'rgba(255,210,60,0.5)', light: { r: 80, color: '255,210,90' } });
addBoard('sign_pit', 54, 15, { text: 'THE PIT', sub: 'NO RULES  NO REFUNDS', mat: 'steel', fg: '#e8e0c8', bg: '#7a2a1e', age: 1, icon: 'fist' }, {});
addBoard('poster_fight', 22, 15, { text: 'TONIGHT', sub: 'THE PIT', mat: 'poster', fg: '#f8e8a0', bg: '#8a1e1a', age: 0.8 }, {});
V.add('queue_rope', 16, 14, (R) => { R(1, 3, 2, 10, '#c8a040'); R(0, 12, 4, 2, '#8a6a20'); R(0, 2, 4, 2, '#e8c860'); R(3, 5, 12, 1.2, '#8a1e28'); R(3, 6, 12, 0.5, '#5a1218'); }, { solid: false });
V.add('bench_steel', 32, 12, (R) => { R(0, 2, 32, 3, '#8e949c'); R(0, 2, 32, 1, '#b8bcc4'); R(3, 5, 2, 7, '#50565e'); R(27, 5, 2, 7, '#50565e'); }, { fw: 2, solid: true });
V.add('trash_can', 12, 16, (R) => { R(1, 3, 10, 13, '#4a4e54'); for (let i = 2; i < 11; i += 2) R(i, 4, 0.6, 11, '#34383e'); R(0, 2, 12, 2, '#5a5e64'); R(3, 0, 6, 2, '#2a2e34'); R(4, 1, 3, 2, '#c8c0a0'); }, { solid: true });
V.add('fridge_bar', 16, 28, (R) => { R(0, 0, 16, 28, '#2a2e34'); R(1, 1, 14, 22, '#a8d0e0'); R(1, 8, 14, 0.7, '#6a7078'); R(1, 15, 14, 0.7, '#6a7078'); for (let i = 0; i < 4; i++) { R(2 + i * 3.2, 3, 2, 5, ['#7a9a5a', '#a86a3a', '#c8a040', '#8a2a2a'][i]); R(2 + i * 3.2, 10, 2, 5, ['#a86a3a', '#c8a040', '#7a9a5a', '#3a5a8a'][i]); } R(13, 11, 1, 6, '#c8ccd2'); }, { solid: true, light: { r: 30, color: '190,230,255' } });
})();
