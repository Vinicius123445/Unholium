'use strict';
// Extra pixel art drawn at boot (after G.assets.init): home furniture (bathroom, kitchen, bedroom),
// shop fixtures, casino tables, stairs and elevators, plus icons for keys, lockpicks, fishing and gambling.

(() => {
  const A = G.assets, shade = A.shade;
  const P = (x, px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
  const R = (x, px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const sprite = (name, w, h, fn, outline = true) => {
    const { c, x } = A.mk(w, h);
    fn(x);
    if (outline) A.outline(c);
    A.sprites[name] = { img: c, ax: Math.floor(w / 2), ay: h - 1, w, h };
  };
  const icon = (name, fn) => { const { c, x } = A.mk(16, 16); fn(x); A.outline(c); A.icons[name] = c; };

  function furniture() {
    // ---- bathroom ----
    sprite('toilet', 10, 15, (x) => { R(x, 1, 0, 8, 6, '#f2f2f4'); R(x, 1, 0, 8, 1, '#ffffff'); P(x, 7, 2, '#b8b8c0'); R(x, 0, 6, 10, 6, '#e8e8ec'); R(x, 2, 7, 6, 3, '#9ac0d8'); R(x, 3, 12, 4, 3, '#d8d8de'); });
    sprite('sink', 12, 15, (x) => { R(x, 0, 4, 12, 11, '#c8b8a0'); R(x, 0, 4, 12, 4, '#f2f2f4'); R(x, 2, 5, 8, 2, '#a8c8e0'); R(x, 5, 1, 2, 4, '#b8bcc4'); R(x, 4, 1, 4, 1, '#d8dce4'); R(x, 1, 9, 4, 5, '#b0a088'); R(x, 7, 9, 4, 5, '#b0a088'); P(x, 4, 11, '#806850'); P(x, 7, 11, '#806850'); });
    sprite('shower', 15, 26, (x) => { R(x, 0, 0, 15, 26, '#d8e4ec'); R(x, 1, 1, 13, 24, '#b8d0e0'); for (let y = 2; y < 24; y += 3) R(x, 1, y, 13, 1, '#c8dce8'); R(x, 5, 2, 5, 2, '#9aa0aa'); for (let i = 0; i < 6; i++) P(x, 4 + i, 6 + (i * 3) % 9, '#ffffff'); R(x, 1, 23, 13, 2, '#e8eef2'); R(x, 13, 1, 1, 24, '#ffffff'); });
    sprite('bathtub', 31, 15, (x) => { R(x, 0, 2, 31, 13, '#f2f2f4'); R(x, 0, 2, 31, 1, '#ffffff'); R(x, 2, 4, 27, 7, '#8ac0e0'); R(x, 2, 4, 27, 1, '#b8dcf0'); R(x, 3, 0, 3, 3, '#b8bcc4'); R(x, 1, 13, 3, 2, '#c8a050'); R(x, 27, 13, 3, 2, '#c8a050'); });
    sprite('washer', 14, 16, (x) => { R(x, 0, 0, 14, 16, '#e8e8ec'); R(x, 0, 0, 14, 3, '#d0d0d8'); P(x, 2, 1, '#4ac04a'); P(x, 4, 1, '#d84a4a'); A.sprites; x.fillStyle = '#5a6a7a'; x.beginPath(); x.arc(7, 9.5, 4.5, 0, Math.PI * 2); x.fill(); x.fillStyle = '#8aa0b8'; x.beginPath(); x.arc(7, 9.5, 3, 0, Math.PI * 2); x.fill(); });
    // ---- kitchen ----
    sprite('stove', 15, 17, (x) => { R(x, 0, 0, 15, 17, '#d8d8de'); R(x, 0, 0, 15, 6, '#2a2a30'); for (const [a, b] of [[2, 1], [9, 1], [2, 4], [9, 4]]) { R(x, a, b, 4, 1, '#5a5a62'); } R(x, 2, 8, 11, 7, '#3a3a42'); R(x, 3, 9, 9, 4, '#5a4a3a'); R(x, 4, 7, 7, 1, '#9a9aa2'); });
    sprite('kcounter', 16, 15, (x) => { R(x, 0, 0, 16, 15, '#e8e0d0'); R(x, 0, 0, 16, 4, '#9a9aa2'); R(x, 0, 0, 16, 1, '#c8c8d0'); R(x, 1, 5, 6, 9, '#c8b898'); R(x, 9, 5, 6, 9, '#c8b898'); P(x, 6, 9, '#6a5a40'); P(x, 9, 9, '#6a5a40'); R(x, 4, 1, 3, 2, '#d84a3a'); P(x, 11, 1, '#f0f0f0'); });
    sprite('kcounter_sink', 16, 15, (x) => { R(x, 0, 0, 16, 15, '#e8e0d0'); R(x, 0, 0, 16, 4, '#9a9aa2'); R(x, 3, 1, 10, 3, '#5a6878'); R(x, 7, 0, 2, 1, '#d8dce4'); R(x, 1, 5, 6, 9, '#c8b898'); R(x, 9, 5, 6, 9, '#c8b898'); });
    // ---- bedroom & living ----
    sprite('nightstand', 10, 14, (x) => { R(x, 0, 4, 10, 10, '#7a4f28'); R(x, 0, 4, 10, 1, '#9a6a3a'); R(x, 1, 8, 8, 1, '#5b3a1e'); P(x, 5, 6, '#c8a050'); P(x, 5, 10, '#c8a050'); R(x, 3, 0, 4, 3, '#f0d890'); R(x, 4, 3, 2, 1, '#6a6a6a'); });
    sprite('wardrobe', 16, 27, (x) => { R(x, 0, 0, 16, 27, '#6b4423'); R(x, 1, 1, 14, 24, '#7a5030'); R(x, 7, 1, 1, 24, '#4a2e16'); P(x, 6, 12, '#c8a050'); P(x, 9, 12, '#c8a050'); R(x, 0, 25, 16, 2, '#4a2e16'); });
    sprite('bed_double', 30, 22, (x) => { R(x, 0, 0, 30, 22, '#6b4423'); R(x, 1, 1, 28, 20, '#d8d2c4'); R(x, 2, 2, 12, 4, '#f4f0e8'); R(x, 16, 2, 12, 4, '#f4f0e8'); R(x, 1, 8, 28, 13, '#7a5aa0'); R(x, 1, 8, 28, 1, '#9a7ac0'); });
    sprite('floorlamp', 8, 24, (x) => { R(x, 1, 0, 6, 5, '#f0e0a8'); R(x, 1, 4, 6, 1, '#c8b070'); R(x, 3, 5, 2, 17, '#3a3a40'); R(x, 1, 22, 6, 2, '#2a2a30'); });
    sprite('mirror', 10, 20, (x) => { R(x, 0, 0, 10, 16, '#c8a050'); R(x, 1, 1, 8, 14, '#b8d0e0'); P(x, 3, 3, '#ffffff'); P(x, 4, 4, '#ffffff'); R(x, 3, 16, 4, 4, '#8a6a30'); });
    sprite('piano', 30, 20, (x) => { R(x, 0, 0, 30, 14, '#1a1a1e'); R(x, 0, 0, 30, 2, '#3a3a40'); R(x, 2, 10, 26, 3, '#f4f4f0'); for (let i = 3; i < 28; i += 3) R(x, i, 10, 1, 2, '#1a1a1e'); R(x, 2, 14, 2, 6, '#1a1a1e'); R(x, 26, 14, 2, 6, '#1a1a1e'); });
    sprite('rug', 30, 14, (x) => { R(x, 0, 0, 30, 14, '#8a3a3a'); R(x, 2, 2, 26, 10, '#a85a4a'); R(x, 4, 4, 22, 6, '#c8a060'); R(x, 8, 6, 14, 2, '#8a3a3a'); }, false);
    sprite('doorway', 16, 16, (x) => { R(x, 0, 0, 16, 2, '#6b4423'); R(x, 0, 0, 2, 16, '#6b4423'); R(x, 14, 0, 2, 16, '#6b4423'); }, false);
    sprite('watercooler', 9, 20, (x) => { R(x, 1, 0, 7, 8, '#8ac8f0'); R(x, 2, 1, 2, 5, '#c8e8ff'); R(x, 0, 8, 9, 12, '#e8e8ec'); P(x, 3, 11, '#4a8ad8'); P(x, 5, 11, '#d84a4a'); });
    // ---- shops ----
    sprite('cooler', 15, 26, (x) => { R(x, 0, 0, 15, 26, '#d0d4dc'); R(x, 1, 2, 13, 22, '#a8d8f0'); for (let s = 0; s < 4; s++) { R(x, 1, 7 + s * 5, 13, 1, '#7a8a9a'); for (let i = 0; i < 6; i++) R(x, 2 + i * 2, 3 + s * 5, 1, 4, ['#d84a3a', '#4a8ad8', '#e8c040', '#5ac040', '#f0f0f0'][(i + s) % 5]); } R(x, 0, 0, 15, 2, '#2a5aa8'); });
    sprite('clothes_rack', 16, 20, (x) => { R(x, 1, 2, 14, 1, '#9aa0aa'); R(x, 1, 2, 1, 16, '#9aa0aa'); R(x, 14, 2, 1, 16, '#9aa0aa'); R(x, 0, 18, 16, 2, '#6a6a72'); const cols = ['#c84a4a', '#4a6ac8', '#e8e0d0', '#3a8a5a', '#2a2a30']; for (let i = 0; i < 5; i++) R(x, 2 + i * 2.4, 3, 2, 9 + (i % 2) * 2, cols[i]); });
    sprite('gun_rack', 16, 24, (x) => { R(x, 0, 0, 16, 24, '#4a2e16'); R(x, 1, 1, 14, 20, '#2a1a10'); for (let i = 0; i < 4; i++) { R(x, 2 + i * 3, 3, 1, 15, '#3a3a40'); R(x, 2 + i * 3, 13, 2, 5, '#6b4423'); } R(x, 0, 21, 16, 3, '#6b4423'); });
    sprite('display_case', 31, 15, (x) => { R(x, 0, 6, 31, 9, '#6b4423'); R(x, 0, 0, 31, 7, '#c8e8f8'); R(x, 0, 0, 31, 1, '#ffffff'); for (let i = 0; i < 6; i++) P(x, 3 + i * 5, 4, ['#e8c040', '#d8d8e8', '#e04a8a', '#40c0e0', '#e8c040', '#9a5ac8'][i]); R(x, 1, 7, 29, 1, '#8a5a2e'); });
    sprite('register', 12, 10, (x) => { R(x, 0, 4, 12, 6, '#3a3a40'); R(x, 2, 0, 8, 5, '#2a2a30'); R(x, 3, 1, 6, 2, '#4ac04a'); R(x, 1, 6, 10, 1, '#6a6a72'); });
    sprite('barstool', 8, 11, (x) => { R(x, 0, 0, 8, 3, '#a83a3a'); R(x, 3, 3, 2, 6, '#9aa0aa'); R(x, 1, 9, 6, 2, '#6a6a72'); });
    sprite('barber_chair', 12, 16, (x) => { R(x, 1, 0, 10, 7, '#a83a3a'); R(x, 0, 6, 12, 4, '#c84a4a'); R(x, 5, 10, 2, 4, '#9aa0aa'); R(x, 2, 14, 8, 2, '#6a6a72'); });
    sprite('pooltable', 31, 17, (x) => { R(x, 0, 0, 31, 13, '#5b3a1e'); R(x, 2, 2, 27, 9, '#2a7a4a'); P(x, 8, 6, '#ffffff'); P(x, 20, 5, '#d84a3a'); P(x, 21, 6, '#e8c040'); P(x, 20, 7, '#2a4ac8'); R(x, 2, 13, 3, 4, '#4a2e16'); R(x, 26, 13, 3, 4, '#4a2e16'); });
    // ---- casino ----
    sprite('slot_machine', 13, 24, (x) => { R(x, 0, 0, 13, 24, '#a82a3a'); R(x, 0, 0, 13, 3, '#e8c040'); R(x, 2, 5, 9, 6, '#f8f0e0'); R(x, 3, 6, 2, 4, '#d84a3a'); R(x, 5, 6, 3, 4, '#e8c040'); R(x, 8, 6, 2, 4, '#4a8ad8'); R(x, 2, 13, 9, 3, '#3a1a20'); R(x, 12, 6, 1, 8, '#c8c8d0'); P(x, 12, 5, '#e04a4a'); R(x, 1, 20, 11, 4, '#7a1a2a'); });
    sprite('bj_table', 31, 17, (x) => { R(x, 0, 0, 31, 12, '#5b3a1e'); R(x, 2, 0, 27, 10, '#1e7a46'); R(x, 13, 2, 5, 3, '#f4f0e8'); R(x, 6, 6, 3, 2, '#d84a3a'); R(x, 22, 6, 3, 2, '#2a4ac8'); R(x, 14, 7, 3, 2, '#e8c040'); R(x, 2, 12, 3, 5, '#4a2e16'); R(x, 26, 12, 3, 5, '#4a2e16'); });
    sprite('roulette', 31, 17, (x) => { R(x, 0, 0, 31, 12, '#5b3a1e'); R(x, 2, 0, 27, 10, '#1e7a46'); x.fillStyle = '#4a2e16'; x.beginPath(); x.arc(8, 5, 5, 0, Math.PI * 2); x.fill(); for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#d83a3a' : '#1a1a1e'; x.beginPath(); x.moveTo(8, 5); x.arc(8, 5, 4, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2); x.fill(); } P(x, 8, 5, '#e8c040'); for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) R(x, 15 + c * 3, 2 + r * 2, 2, 1, (c + r) % 2 ? '#d83a3a' : '#1a1a1e'); R(x, 2, 12, 3, 5, '#4a2e16'); R(x, 26, 12, 3, 5, '#4a2e16'); });
    // ---- building ----
    sprite('stairs_up', 16, 20, (x) => { for (let i = 0; i < 5; i++) { R(x, 1, 2 + i * 3.5, 14, 3, shade('#8a6a4a', 0.75 + i * 0.07)); R(x, 1, 2 + i * 3.5, 14, 1, shade('#8a6a4a', 1 + i * 0.05)); } R(x, 0, 0, 1, 20, '#4a2e16'); R(x, 15, 0, 1, 20, '#4a2e16'); R(x, 6, 0, 4, 2, '#e8e0d0'); });
    sprite('stairs_down', 16, 16, (x) => { R(x, 0, 0, 16, 16, '#2a1e16'); for (let i = 0; i < 4; i++) { R(x, 1, 1 + i * 3.6, 14, 3, shade('#8a6a4a', 1 - i * 0.18)); } R(x, 0, 0, 16, 1, '#6b4423'); }, false);
    sprite('elevator', 16, 27, (x) => { R(x, 0, 0, 16, 27, '#6a6e78'); R(x, 1, 4, 14, 23, '#9aa0aa'); R(x, 7, 4, 2, 23, '#5a5e68'); R(x, 2, 5, 4, 21, '#b8bcc4'); R(x, 10, 5, 4, 21, '#b8bcc4'); R(x, 5, 1, 6, 2, '#1a1a1e'); P(x, 7, 1, '#e8c040'); P(x, 8, 1, '#e8c040'); });
    sprite('fishing_sign', 14, 18, (x) => { R(x, 6, 7, 2, 11, '#5b3a1e'); R(x, 0, 0, 14, 8, '#2a6aa8'); R(x, 2, 3, 7, 2, '#c8e0f0'); P(x, 9, 3, '#c8e0f0'); P(x, 10, 2, '#c8e0f0'); P(x, 10, 5, '#c8e0f0'); });
  }

  function icons() {
    icon('candy', (x) => { R(x, 2, 6, 12, 5, '#8a3a2a'); R(x, 4, 6, 8, 5, '#d84a3a'); R(x, 5, 7, 6, 1, '#f8e8c0'); R(x, 1, 7, 2, 3, '#e8e0d0'); R(x, 13, 7, 2, 3, '#e8e0d0'); });
    icon('comic', (x) => { R(x, 3, 2, 10, 12, '#f0e040'); R(x, 4, 3, 8, 4, '#3a6ad8'); R(x, 5, 8, 6, 5, '#d84a3a'); P(x, 7, 4, '#ffffff'); P(x, 9, 5, '#ffffff'); });
    icon('pills_pink', (x) => { R(x, 3, 3, 10, 10, '#f0f0f0'); R(x, 3, 3, 10, 3, '#d870a8'); R(x, 5, 8, 2, 2, '#f8a8d0'); R(x, 9, 9, 2, 2, '#f8a8d0'); });
    icon('pills_blue', (x) => { R(x, 5, 2, 6, 12, '#e8ecf4'); R(x, 5, 2, 6, 3, '#3a6ad8'); R(x, 6, 7, 4, 1, '#8aa8e0'); R(x, 6, 10, 4, 1, '#8aa8e0'); });
    icon('key', (x) => { R(x, 2, 4, 6, 6, '#e8c040'); R(x, 4, 6, 2, 2, '#00000000'); x.clearRect(4, 6, 2, 2); R(x, 8, 6, 7, 2, '#e8c040'); R(x, 12, 8, 1, 3, '#e8c040'); R(x, 14, 8, 1, 2, '#e8c040'); });
    icon('lockpick', (x) => { R(x, 2, 12, 6, 2, '#5a5a62'); for (let i = 0; i < 9; i++) P(x, 6 + i, 12 - i, '#c8ccd4'); P(x, 14, 3, '#c8ccd4'); P(x, 13, 3, '#c8ccd4'); for (let i = 0; i < 7; i++) P(x, 3 + i, 14 - i, '#8a8e96'); });
    icon('rod', (x) => { for (let i = 0; i < 13; i++) P(x, 2 + i, 14 - i, i < 4 ? '#5b3a1e' : '#c8a050'); R(x, 4, 10, 3, 3, '#8a8e96'); for (let i = 0; i < 8; i++) P(x, 14, 2 + i, '#e8e8f0'); P(x, 13, 10, '#c8ccd4'); });
    icon('bait', (x) => { R(x, 3, 6, 10, 8, '#8a6a3a'); R(x, 3, 6, 10, 2, '#a88a5a'); for (const [a, b] of [[5, 9], [8, 10], [10, 8]]) { P(x, a, b, '#d87a8a'); P(x, a + 1, b, '#d87a8a'); P(x, a + 1, b + 1, '#b85a6a'); } });
    const fish = (name, body, belly, fin) => icon(name, (x) => { R(x, 3, 6, 9, 5, body); R(x, 4, 5, 7, 1, body); R(x, 4, 11, 7, 1, belly); R(x, 4, 9, 7, 2, belly); R(x, 12, 5, 2, 2, fin); R(x, 12, 9, 2, 2, fin); R(x, 11, 7, 3, 2, fin); P(x, 5, 7, '#111'); R(x, 6, 4, 3, 1, fin); });
    fish('fish_bluegill', '#4a7a9a', '#e8a040', '#2a5a7a');
    fish('fish_bass', '#4a7a3a', '#d8d8b8', '#2a5a2a');
    fish('fish_catfish', '#6a5a4a', '#c8b8a0', '#4a3a2a');
    fish('fish_trout', '#8a9a7a', '#e8a8a8', '#5a6a4a');
    fish('fish_carp', '#b8903a', '#e8d8a0', '#8a6a2a');
    fish('fish_pike', '#5a7a4a', '#e8e8c8', '#3a5a2a');
    fish('fish_snapper', '#d84a4a', '#f8c8b8', '#a83030');
    fish('fish_tuna', '#2a3a6a', '#c8d0e0', '#1a2a4a');
    fish('fish_golden', '#f0c030', '#fff0a0', '#c89010');
    icon('boot', (x) => { R(x, 5, 2, 5, 9, '#5a4a3a'); R(x, 3, 10, 10, 4, '#5a4a3a'); R(x, 3, 13, 10, 1, '#3a2a1a'); P(x, 7, 4, '#3a2a1a'); P(x, 7, 7, '#3a2a1a'); });
    icon('chips_casino', (x) => { for (const [cx, cy, col] of [[6, 10, '#d84a3a'], [10, 9, '#2a4ac8'], [8, 6, '#1a1a1e']]) { R(x, cx - 3, cy - 2, 7, 4, col); R(x, cx - 1, cy - 2, 3, 4, '#f4f0e8'); R(x, cx - 3, cy - 1, 7, 2, col); } });
    icon('dice', (x) => { R(x, 2, 4, 8, 8, '#f4f0e8'); P(x, 4, 6, '#111'); P(x, 7, 9, '#111'); R(x, 8, 2, 6, 6, '#e8e0d0'); P(x, 10, 4, '#111'); P(x, 12, 6, '#111'); });
    icon('ticket', (x) => { R(x, 2, 4, 12, 8, '#e8d890'); R(x, 2, 4, 12, 1, '#f8f0c0'); for (let i = 5; i < 12; i += 2) P(x, 10, i, '#a89040'); R(x, 4, 6, 4, 1, '#6a5a20'); R(x, 4, 8, 5, 1, '#6a5a20'); });
  }

  // inner walls: a dark cap on top, a painted face, a baseboard (reads as a wall, not a cabinet)
  function tiles() {
    const { c, x } = A.mk(16, 16);
    R(x, 0, 0, 16, 16, '#cfc4ae'); R(x, 0, 0, 16, 6, '#4e443a'); R(x, 0, 5, 16, 1, '#6e6252');
    for (let i = 0; i < 16; i += 4) R(x, i, 7, 1, 7, '#c4b9a2');
    R(x, 0, 14, 16, 2, '#8a7a62');
    A.tiles.wall_inner = [c];
  }

  const init = A.init;
  A.init = function () { init.call(this); tiles(); furniture(); icons(); };
})();
