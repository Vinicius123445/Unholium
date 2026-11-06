'use strict';
// Custom mouse cursors, drawn as pixel art at boot: a pointer (dark body, cream outline, a gold edge and
// a little red tip, like the HUD) and a crosshair used in-game while you hold a gun.

G.cursor = {
  styles: {},
  current: null,

  // Pixel rows: '#' outline, 'x' body, 'g' gold edge, 'r' red tip, '.' clear
  POINTER: [
    'r.........',
    '#r........',
    '#g#.......',
    '#gx#......',
    '#gxx#.....',
    '#gxxx#....',
    '#gxxxx#...',
    '#gxxxxx#..',
    '#gxxxxxx#.',
    '#gxxx####.',
    '#gx#x#....',
    '#g#.#x#...',
    '##...#x#..',
    '......##..',
  ],
  CROSS: [
    '....#.#....',
    '....#r#....',
    '....#.#....',
    '...........',
    '###.....###',
    '.r...g...r.',
    '###.....###',
    '...........',
    '....#.#....',
    '....#r#....',
    '....#.#....',
  ],
  COLORS: { '#': '#ece4d0', x: '#1e1a24', g: '#d8b468', r: '#e04a3a' },

  make(rows, scale, hot) {
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale; c.height = rows.length * scale;
    const x = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, i) => { if (this.COLORS[ch]) { x.fillStyle = this.COLORS[ch]; x.fillRect(i * scale, y * scale, scale, scale); } }));
    return `url(${c.toDataURL()}) ${hot[0] * scale} ${hot[1] * scale}, auto`;
  },

  init(canvas) {
    this.canvas = canvas;
    this.styles.pointer = this.make(this.POINTER, 2, [0, 0]);
    this.styles.cross = this.make(this.CROSS, 2, [5, 5]);
    this.set('pointer');
  },
  set(name) {
    if (this.current === name || !this.canvas) return;
    this.current = name;
    this.canvas.style.cursor = this.styles[name];
  },
  // Called every frame: crosshair in the world with a gun, pointer everywhere else.
  update() {
    const top = G.scenes.top();
    const p = top && top.player;
    this.set(top instanceof G.GameScene && p && p.weaponItem && p.weaponItem.gun ? 'cross' : 'pointer');
  },
};
