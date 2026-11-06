module.exports = (G, g, p, shot, tick) => {
  // men and women side by side, bare and clothed, front and side
  const c = G.renderer.canvas, x = c.getContext('2d'), W = c.width, H = c.height;
  const skin = '#d8a880', looks = [
    { body: 'f', skin, hair: '#3a2010', hairStyle: 'long', naked: true },
    { skin, hair: '#3a2010', naked: true },
    { body: 'f', skin: '#8a5a3a', hair: '#201010', hairStyle: 'long', shirtless: true },
    { body: 'f', skin, hair: '#a05020', hairStyle: 'long', top: 'tshirt', shirt: '#c04040', pants: '#3a4a7a', bottom: 'pants' },
    { skin, hair: '#a05020', top: 'tshirt', shirt: '#c04040', pants: '#3a4a7a', bottom: 'pants' },
  ];
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#7a7a70'; x.fillRect(0, 0, W, H); x.imageSmoothingEnabled = true;
  looks.forEach((l, i) => {
    const s = G.assets.character(l), hd = G.hd.get(s); console.log(i, !!hd, hd && hd.L.fem, hd && hd.L.bareTop, hd && hd.L.bareBottom, hd && hd.L.censored);
    [0, 2].forEach((dir, j) => { G.body.cur = { dir: dir === 2 ? 2 : 0, face: 0, q: 0, yaw: 0, gaze: 0, wet: 0 }; x.drawImage(hd.img, 0, dir * G.hd.FH, G.hd.FW, G.hd.FH, 10 + i * 250, 10 + j * 340, 240, 330); G.body.cur = null; });
  });
  require('fs').writeFileSync('D:/Unholium_native/poc/out/f/bodies.png', c.toBufferSync('png'));
};
