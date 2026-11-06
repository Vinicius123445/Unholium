'use strict';
// The furniture of the places people go to: bars, arcades, pool halls, gyms. Same footprint as before, painted like the rest of the rooms.
(() => {
const F = G.realFurn, { make, wood, gloss, fill, line, grad } = F, sh = G.assets.shade, _more = F.more;
const metal = (x, X, Y, W, H, a = '#c8ccd2', b = '#5a5e64') => fill(x, X, Y, W, H, 0.2, grad(x, X, Y, X, Y + H, [a, b]));
const screen = (x, X, Y, W, H, c0, c1) => { fill(x, X - 0.5, Y - 0.5, W + 1, H + 1, 0.3, '#0c0c10'); fill(x, X, Y, W, H, 0.2, grad(x, X, Y, X + W, Y + H, [c0, c1])); x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(X, Y, W, 0.5); };
const bottles = (x, X, Y, W) => { const c = ['#2e5a34', '#7a4a1e', '#c8b070', '#3a2a5a', '#a03828', '#d8d0b0', '#2a4a6a']; for (let i = 0, a = X; a < X + W - 1; i++, a += 2.1) { const h = 4 + (i * 7 % 3), k = c[i * 5 % 7]; fill(x, a, Y - h + 1.6, 1.5, h - 1.6, 0.3, grad(x, a, 0, a + 1.5, 0, [sh(k, 1.5), k, sh(k, 0.6)])); x.fillStyle = sh(k, 0.8); x.fillRect(a + 0.45, Y - h, 0.6, 1.8); } };
const cabinet = (name, top, side, art) => make(name, 16, 28, (x, W, H) => {
  fill(x, 1, 3, W - 2, H - 3, 0.2, grad(x, 1, 0, W - 1, 0, [sh(side, 1.2), side, sh(side, 0.6)]));
  fill(x, 1.6, 0.6, W - 3.2, 4.6, 0.2, top); x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(2.4, 1.2, W - 4.8, 0.5);
  screen(x, 3, 6.4, W - 6, 7.6, '#101830', '#1a2c50'); art(x);
  fill(x, 2, 15, W - 4, 4.2, 0.2, '#22242a'); x.fillStyle = '#c02828'; x.beginPath(); x.arc(5, 16.8, 0.8, 0, 6.3); x.fill(); x.fillStyle = '#2858c8'; x.beginPath(); x.arc(8, 16.8, 0.8, 0, 6.3); x.fill(); x.fillStyle = '#d8b030'; x.beginPath(); x.arc(10.6, 16.8, 0.8, 0, 6.3); x.fill();
  metal(x, 6.4, 21, 3.2, 3, '#b8bcc4', '#6a6e76'); x.fillStyle = '#0c0c10'; x.fillRect(7.6, 21.6, 0.8, 1.8);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(1, H - 1.2, W - 2, 1.2);
});
F.more = () => {
  if (_more) _more();
  make('v_bar', 32, 20, (x, W, H) => {
    wood(x, 0, 6, W, H - 6, '#4a2c18', 3); for (let a = 1.5; a < W - 2; a += 7.4) { fill(x, a, 8, 6.2, 9.4, 0.2, 'rgba(0,0,0,0.2)'); x.strokeStyle = 'rgba(232,190,130,0.16)'; x.lineWidth = 0.3; x.strokeRect(a + 0.5, 8.5, 5.2, 8.4); }
    wood(x, 0, 1.4, W, 5, '#8a5a30', 5); gloss(x, 0, 1.4, W, 5); x.fillStyle = 'rgba(255,240,210,0.28)'; x.fillRect(0, 1.4, W, 0.5); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, 6.2, W, 0.6);
    metal(x, 0, H - 2.6, W, 0.8, '#d8b868', '#8a6a2c');   // the brass rail
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, H - 1, W, 1);
  });
  make('v_backbar', 32, 28, (x, W, H) => {
    wood(x, 0, 0, W, H, '#3a2214', 4); fill(x, 1.4, 1.6, W - 2.8, 16, 0.2, grad(x, 0, 1, 0, 17, ['#6a5238', '#2a2018'])); x.fillStyle = 'rgba(190,220,235,0.1)'; x.beginPath(); x.moveTo(3, 2); x.lineTo(12, 2); x.lineTo(6, 17); x.lineTo(2, 17); x.closePath(); x.fill();
    for (const y of [9, 16.6]) { wood(x, 1.4, y, W - 2.8, 1, '#7a5230', 2); x.fillStyle = 'rgba(255,214,150,0.3)'; x.fillRect(1.4, y - 0.4, W - 2.8, 0.4); bottles(x, 2.6, y, W - 5); }
    wood(x, 0, 18, W, H - 18, '#4a2c18', 6); for (let a = 1; a < W - 2; a += 7.6) { x.strokeStyle = 'rgba(0,0,0,0.44)'; x.lineWidth = 0.3; x.strokeRect(a, 19.4, 7, 7); metal(x, a + 3, 22.4, 1.2, 0.5); }
  });
  make('v_booth', 32, 22, (x, W, H) => {
    const c = '#6a1e24'; fill(x, 0.6, 0.6, W - 1.2, 11.6, 0.4, grad(x, 0, 0, 0, 12, [sh(c, 1.3), c, sh(c, 0.72)])); for (let a = 2.6; a < W - 2; a += 5.3) line(x, 'rgba(0,0,0,0.3)', 0.4, a, 1, a, 12);
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(0.6, 1, W - 1.2, 0.5); fill(x, 0.6, 11.4, W - 1.2, 5.6, 0.4, grad(x, 0, 11, 0, 17, [sh(c, 1.4), sh(c, 0.84)])); wood(x, 0.6, 17, W - 1.2, H - 17.6, '#2e1a10', 2);
  });
  make('v_sofa', 32, 18, (x, W, H) => {
    const c = '#3a3050'; fill(x, 0.4, 2, W - 0.8, 9.4, 0.4, grad(x, 0, 2, 0, 11, [sh(c, 1.34), c])); fill(x, 0, 6.6, 3.4, 9, 0.4, grad(x, 0, 0, 3.4, 0, [sh(c, 1.2), sh(c, 0.7)])); fill(x, W - 3.4, 6.6, 3.4, 9, 0.4, grad(x, W - 3.4, 0, W, 0, [sh(c, 1.1), sh(c, 0.62)]));
    for (const a of [3.6, 16.2]) { fill(x, a, 9.4, 12.2, 5.6, 0.4, grad(x, 0, 9, 0, 15, [sh(c, 1.5), sh(c, 0.9)])); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(a + 0.6, 9.8, 11, 0.5); }
    x.fillStyle = sh(c, 0.5); x.fillRect(1, 15, W - 2, 1.4); wood(x, 2.4, 16.2, 1.4, 1.8, '#2a1a10', 1); wood(x, W - 3.8, 16.2, 1.4, 1.8, '#2a1a10', 1);
  });
  make('v_lowtable', 16, 10, (x, W, H) => { wood(x, 0.6, 1, W - 1.2, 3.6, '#6a4426', 3); gloss(x, 0.6, 1, W - 1.2, 3.6); wood(x, 0.6, 4.6, W - 1.2, 1.4, '#3e2616', 2); wood(x, 1.6, 6, 1.4, H - 6, '#3e2616', 1); wood(x, W - 3, 6, 1.4, H - 6, '#3e2616', 1); });
  make('v_jukebox', 16, 28, (x, W, H) => {
    fill(x, 0.6, 9, W - 1.2, H - 9, 0.2, grad(x, 0, 0, W, 0, ['#c84030', '#8a2018', '#4a0e0a'])); x.fillStyle = grad(x, 0, 0, W, 0, ['#e85a40', '#a02a20']); x.beginPath(); x.arc(8, 9.4, 7.4, Math.PI, 0); x.fill();
    x.fillStyle = grad(x, 0, 2, 0, 11, ['#ffe9a0', '#e8a030']); x.beginPath(); x.arc(8, 9.6, 5.6, Math.PI, 0); x.fill(); for (let a = -0.9; a <= 0.91; a += 0.45) line(x, 'rgba(160,70,20,0.6)', 0.3, 8, 9.6, 8 + Math.sin(a) * 5.6, 9.6 - Math.cos(a) * 5.6);
    fill(x, 2.6, 10.6, W - 5.2, 5.6, 0.2, '#f4ecd0'); for (let y = 11.6; y < 16; y += 1.1) line(x, 'rgba(60,40,20,0.5)', 0.24, 3.4, y, W - 3.4, y);
    for (let i = 0; i < 6; i++) metal(x, 3 + i * 1.75, 17.4, 1.3, 1.1, '#f0f0f0', '#a0a4aa'); fill(x, 2.6, 20, W - 5.2, 5.6, 0.2, '#1a1216'); for (let y = 20.8; y < 25; y += 0.9) line(x, 'rgba(216,176,104,0.5)', 0.24, 3, y, W - 3, y);
    x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(1.6, 11, 0.5, H - 13);
  });
  make('v_pool_table', 48, 30, (x, W, H) => {
    wood(x, 1, 26, 3.4, H - 26, '#3a2212', 2); wood(x, W - 4.4, 26, 3.4, H - 26, '#3a2212', 2); wood(x, 0, 0.6, W, 26, '#5a3218', 4); gloss(x, 0, 0.6, W, 4);
    fill(x, 3, 3.4, W - 6, 19.4, 0.2, grad(x, 3, 3, W - 3, 23, ['#2e8a58', '#1e6a42', '#165436'])); x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.5; x.strokeRect(3.3, 3.7, W - 6.6, 18.8);
    for (const [a, b] of [[3.4, 3.8], [W / 2, 3.2], [W - 3.4, 3.8], [3.4, 22.4], [W / 2, 22.9], [W - 3.4, 22.4]]) { x.fillStyle = '#08080a'; x.beginPath(); x.arc(a, b, 1.5, 0, 6.3); x.fill(); }
    line(x, 'rgba(255,255,255,0.14)', 0.26, W * 0.74, 3.8, W * 0.74, 22.4);
    const bl = ['#e8d040', '#2850b8', '#c82828', '#5a2a8a', '#e87818', '#1a7a3a', '#7a1a1a', '#101014']; let k = 0; for (let r = 0; r < 4; r++) for (let j = 0; j <= r; j++) { const a = 13 - r * 1.5, b = 13 + (j - r / 2) * 1.8; x.fillStyle = bl[k++ % 8]; x.beginPath(); x.arc(a, b, 0.86, 0, 6.3); x.fill(); x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(a - 0.4, b - 0.5, 0.3, 0.3); }
    x.fillStyle = '#f4f0e4'; x.beginPath(); x.arc(W * 0.74, 13, 0.9, 0, 6.3); x.fill(); wood(x, 0, 21.6, W, 5, '#4a2812', 6); line(x, '#c8a860', 0.4, 22, 21.2, 40, 15);
  });
  cabinet('v_arcade1', '#d82840', '#1e2a78', (x) => { x.fillStyle = '#d8783a'; x.fillRect(3, 6.4, 10, 2.6); x.fillStyle = '#3a3a44'; x.beginPath(); x.moveTo(7, 9); x.lineTo(9, 9); x.lineTo(13, 14); x.lineTo(3, 14); x.closePath(); x.fill(); x.fillStyle = '#f0e8c0'; x.fillRect(7.8, 10, 0.4, 1); x.fillRect(7.7, 12, 0.6, 1.2); x.fillStyle = '#e03040'; x.fillRect(6.6, 12.2, 2.8, 1.4); });   // a night road
  cabinet('v_arcade2', '#28a860', '#3a1a5a', (x) => { x.fillStyle = '#284a7a'; x.fillRect(3, 6.4, 10, 7.6); x.fillStyle = '#2a6a3a'; x.beginPath(); x.moveTo(3, 12); x.lineTo(5.6, 9.4); x.lineTo(8, 11.4); x.lineTo(10.6, 8.8); x.lineTo(13, 11); x.lineTo(13, 14); x.lineTo(3, 14); x.closePath(); x.fill(); x.fillStyle = '#f4e8c0'; x.fillRect(5, 10.6, 0.9, 1.6); x.fillStyle = '#f0d040'; x.beginPath(); x.arc(11.2, 7.4, 0.7, 0, 6.3); x.fill(); });   // a walk in the hills
  cabinet('v_arcade3', '#2890d8', '#5a1a20', (x) => { x.fillStyle = '#5a2a3a'; x.fillRect(3, 6.4, 10, 5.4); x.fillStyle = '#26262e'; x.fillRect(3, 11.8, 10, 2.2); x.fillStyle = '#e8d8a0'; x.fillRect(5.2, 8.6, 1, 3.2); x.fillRect(6.2, 9.2, 1.2, 0.5); x.fillStyle = '#80c0e8'; x.fillRect(9.6, 8.6, 1, 3.2); x.fillRect(8.6, 9.8, 1, 0.5); });   // two people squaring up
  make('v_foosball', 32, 22, (x, W, H) => {
    wood(x, 2, 15, 2.4, H - 15, '#2e1c10', 1); wood(x, W - 4.4, 15, 2.4, H - 15, '#2e1c10', 1); wood(x, 0, 3, W, 13, '#5a3a20', 3); fill(x, 2, 4.6, W - 4, 9.6, 0.2, grad(x, 0, 4, 0, 14, ['#2a8a4a', '#1a6a38']));
    for (let a = 5; a < W - 3; a += 3.6) { metal(x, a, 1.4, 0.6, 15, '#e0e4ea', '#8a8e96'); for (let y = 6; y < 13; y += 3.2) { x.fillStyle = a < W / 2 ? '#c82828' : '#2848b8'; x.fillRect(a - 0.6, y, 1.8, 1.4); } }
    x.fillStyle = '#f4f4f0'; x.beginPath(); x.arc(W / 2 + 1.4, 9.4, 0.6, 0, 6.3); x.fill();
  });
  make('v_treadmill', 32, 26, (x, W, H) => {
    metal(x, 5, 1.6, 1.2, 15, '#b8bcc4', '#54585e'); metal(x, W - 6.2, 1.6, 1.2, 15, '#b8bcc4', '#54585e'); fill(x, 3.6, 0.4, W - 7.2, 6, 0.3, '#1a1c20'); screen(x, 7, 1.4, W - 14, 3.4, '#103040', '#206070'); line(x, '#80f0d0', 0.3, 8, 3.6, 11, 2.4, 14, 3.4, 18, 2.2, 23, 3);
    metal(x, 2, 7, 1, 8, '#d0d4da', '#70747a'); metal(x, W - 3, 7, 1, 8, '#d0d4da', '#70747a'); line(x, '#c8ccd2', 0.9, 2.4, 7.2, 9, 7.2); line(x, '#c8ccd2', 0.9, W - 2.4, 7.2, W - 9, 7.2);
    x.fillStyle = grad(x, 0, 14, 0, H, ['#2a2c32', '#141518']); x.beginPath(); x.moveTo(5.6, 14); x.lineTo(W - 5.6, 14); x.lineTo(W - 1, H - 1); x.lineTo(1, H - 1); x.closePath(); x.fill(); x.fillStyle = grad(x, 0, 15, 0, H, ['#40424a', '#22242a']); x.beginPath(); x.moveTo(7, 15); x.lineTo(W - 7, 15); x.lineTo(W - 4, H - 3); x.lineTo(4, H - 3); x.closePath(); x.fill();
    x.fillStyle = '#54585e'; x.fillRect(1, H - 1.4, W - 2, 1.4);
  });
  make('v_benchpress', 32, 24, (x, W, H) => {
    metal(x, 4.6, 2, 1.2, 15, '#9a9ea6', '#4a4e54'); metal(x, W - 5.8, 2, 1.2, 15, '#9a9ea6', '#4a4e54'); metal(x, 0, 2.8, W, 0.9, '#e4e8ee', '#90949c');
    for (const a of [1, 3, W - 4, W - 6]) fill(x, a, 0, 1.6, 7, 0.2, grad(x, 0, 0, 0, 7, ['#3a3c44', '#141518'])); fill(x, 6, 12, W - 12, 4.6, 0.4, grad(x, 0, 12, 0, 17, ['#7a2024', '#3e0e10'])); metal(x, 8, 16.6, W - 16, 1.4, '#5a5e64', '#2e3034'); metal(x, 9, 18, 1.2, H - 18, '#7a7e86', '#3a3c42'); metal(x, W - 10.2, 18, 1.2, H - 18, '#7a7e86', '#3a3c42');
  });
  make('v_lockers', 32, 28, (x, W, H) => { const c = '#54687c'; for (let i = 0; i < 4; i++) { const a = i * 8; fill(x, a + 0.2, 0.4, 7.6, H - 1.4, 0.1, grad(x, a, 0, a + 8, 0, [sh(c, 1.24), c, sh(c, 0.74)])); x.strokeStyle = 'rgba(0,0,0,0.44)'; x.lineWidth = 0.3; x.strokeRect(a + 0.4, 0.6, 7.2, H - 1.8); for (let k = 0; k < 3; k++) line(x, 'rgba(0,0,0,0.5)', 0.3, a + 2, 2.6 + k, a + 6, 2.6 + k); metal(x, a + 5.6, 12.6, 0.8, 3, '#e0e4ea', '#7a7e86'); x.fillStyle = '#e8e4d8'; x.fillRect(a + 2.4, 7, 3, 1.6); } x.fillStyle = 'rgba(0,0,0,0.34)'; x.fillRect(0, H - 1, W, 1); });
  make('v_counter', 32, 20, (x, W, H) => { fill(x, 0, 6, W, H - 6, 0.1, grad(x, 0, 0, W, 0, ['#c8c0b0', '#a8a094', '#847c70'])); for (let a = 8; a < W; a += 8) line(x, 'rgba(0,0,0,0.26)', 0.3, a, 7, a, H); fill(x, 0, 1.6, W, 4.8, 0.2, grad(x, 0, 1, W, 6, ['#ece8e0', '#b8b4ac'])); gloss(x, 0, 1.6, W, 4.8); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 6.2, W, 0.5); x.fillRect(0, H - 1, W, 1); });
  make('v_rtable', 16, 16, (x, W, H) => { x.fillStyle = '#1e1e22'; x.fillRect(7, 6, 2, H - 8); x.fillStyle = '#2a2a2e'; x.beginPath(); x.ellipse(8, H - 1.8, 4.6, 1.4, 0, 0, 6.3); x.fill(); x.fillStyle = grad(x, 1, 1, 15, 8, ['#a87448', '#6a4426']); x.beginPath(); x.ellipse(8, 4.4, 7, 3.4, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.3; x.stroke(); x.fillStyle = 'rgba(255,240,210,0.2)'; x.beginPath(); x.ellipse(6, 3.4, 3, 1, 0, 0, 6.3); x.fill(); });
  make('v_espresso', 26, 20, (x, W, H) => { fill(x, 1, 3, W - 2, 13, 0.3, grad(x, 0, 0, W, 0, ['#e8ecf0', '#a4a8b0', '#6a6e76'])); fill(x, 1, 1, W - 2, 2.6, 0.2, '#30343a'); for (let a = 4; a < W - 3; a += 6) { fill(x, a, 0, 3.4, 1.6, 0.2, '#f0ece4'); } fill(x, 3, 5, W - 6, 3, 0.2, '#30343a'); for (const a of [7, 17]) { metal(x, a, 7.6, 3, 2.6, '#d8dce2', '#70747c'); line(x, '#1e2024', 0.8, a + 1.5, 10.2, a + 3, 12.4); } x.fillStyle = '#c02828'; x.beginPath(); x.arc(13, 6.5, 0.6, 0, 6.3); x.fill(); metal(x, 2, 15.4, W - 4, 1.2, '#808690', '#3a3e44'); metal(x, 3, 16.6, 1.6, H - 16.6, '#70747c', '#3a3e44'); metal(x, W - 4.6, 16.6, 1.6, H - 16.6, '#70747c', '#3a3e44'); });
  make('v_djbooth', 32, 22, (x, W, H) => { fill(x, 0, 6, W, H - 6, 0.2, grad(x, 0, 6, 0, H, ['#26262e', '#0e0e12'])); for (let a = 2; a < W - 2; a += 2.6) line(x, 'rgba(120,200,255,0.1)', 0.3, a, 8, a, H - 2); fill(x, 0.6, 1.4, W - 1.2, 5, 0.2, '#16161a'); for (const a of [7.6, 24.4]) { x.fillStyle = '#0a0a0c'; x.beginPath(); x.ellipse(a, 3.9, 5.4, 2.1, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 0.24; x.beginPath(); x.ellipse(a, 3.9, 3.6, 1.4, 0, 0, 6.3); x.stroke(); x.fillStyle = '#d83060'; x.beginPath(); x.ellipse(a, 3.9, 1, 0.4, 0, 0, 6.3); x.fill(); } fill(x, 13.8, 2, 4.4, 3.8, 0.2, '#2e2e36'); for (let i = 0; i < 3; i++) { x.fillStyle = ['#40e0a0', '#e8c040', '#e04040'][i]; x.fillRect(14.6 + i * 1, 2.6, 0.5, 2.6); } x.fillStyle = 'rgba(64,224,255,0.5)'; x.fillRect(0, 6.4, W, 0.5); });
  make('v_speaker', 14, 26, (x, W, H) => { fill(x, 0.6, 0.6, W - 1.2, H - 1.2, 0.2, grad(x, 0, 0, W, 0, ['#2e2e34', '#16161a'])); for (const [c, r] of [[7, 2.2], [18, 4.6]]) { x.fillStyle = '#0a0a0c'; x.beginPath(); x.arc(7, c, r + 0.5, 0, 6.3); x.fill(); x.fillStyle = grad(x, 7 - r, c - r, 7 + r, c + r, ['#3a3a42', '#141418']); x.beginPath(); x.arc(7, c, r, 0, 6.3); x.fill(); x.fillStyle = '#50505a'; x.beginPath(); x.arc(7, c, r * 0.32, 0, 6.3); x.fill(); } });
  make('v_bookcase', 32, 30, (x, W, H) => { wood(x, 0, 0, W, H, '#4a2e1a', 4); const c = ['#7a2a2a', '#2a4a6a', '#3a6a3a', '#a07830', '#5a3a6a', '#2e2e34', '#8a5a2a', '#c8b890']; let n = 3; for (const y of [1.6, 11, 20.4]) { fill(x, 1.4, y, W - 2.8, 8.2, 0.1, '#1e120a'); for (let a = 1.8; a < W - 3;) { n = n * 7 % 31 + 2; const w = 1.1 + n % 3 * 0.5, h = 6 + n % 3 * 0.8; if (n % 11 === 0) { a += 2.4; continue; } x.fillStyle = grad(x, a, 0, a + w, 0, [sh(c[n % 8], 1.3), c[n % 8], sh(c[n % 8], 0.6)]); x.fillRect(a, y + 8.2 - h, w, h); x.fillStyle = 'rgba(232,216,160,0.5)'; x.fillRect(a + 0.15, y + 8.2 - h + 1, w - 0.3, 0.3); a += w + 0.12; } } });
  make('v_clothes_rack', 32, 26, (x, W, H) => { metal(x, 1, 3, 1, H - 4, '#d0d4da', '#70747c'); metal(x, W - 2, 3, 1, H - 4, '#d0d4da', '#70747c'); metal(x, 0, 2.6, W, 1, '#e8ecf0', '#8a8e96'); metal(x, 0, H - 1.2, 5, 1, '#a0a4aa', '#54585e'); metal(x, W - 5, H - 1.2, 5, 1, '#a0a4aa', '#54585e'); const c = ['#8a2a3a', '#2a4a7a', '#d8d0c0', '#3a6a4a', '#2a2a30', '#b8862e', '#6a3a7a']; for (let i = 0; i < 9; i++) { const a = 3.4 + i * 2.8, k = c[i * 3 % 7]; line(x, '#a0a4aa', 0.3, a + 1.3, 3.2, a + 1.3, 5); x.fillStyle = grad(x, a, 0, a + 2.6, 0, [sh(k, 1.24), k, sh(k, 0.64)]); x.beginPath(); x.moveTo(a + 0.2, 5); x.lineTo(a + 2.4, 5); x.lineTo(a + 2.6, 15 + i % 3 * 2); x.lineTo(a, 15 + i % 3 * 2); x.closePath(); x.fill(); } });
};
})();
