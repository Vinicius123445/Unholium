'use strict';
// Loading screens. The world really is built in steps here, a map at a time between frames, so what moves on the screen is the truth:
// the island from orbit pushes in behind a skyline at night, a window lights for every bit of the city that is ready, and a car
// drives the road from one edge of the screen to the other. It arrives when the game does. G.startGame is the one way in.
// Changing maps is quicker: a street sign on the black, up while the next place is laid out.
(() => {
const R = G.renderer, A = G.assets;
const island = new Image(); island.src = 'js/art/menu_island.jpg';
const TIPS = [
  'Q kicks. Which kick depends on where you aim, how you move and how close they are.', 'When someone demands something, Y agrees and N refuses. You can keep walking. E opens the whole conversation.', 'Refusing the police is not a fight. Attacking them or running from them is.',
  'A bandage stops the bleeding. It does not fix what caused it.', 'Doors have owners. So do the people who notice you at them.', 'Fighters at the Pit are rated by what they have done lately. Read the board before you bet.',
  'Someone out cold can be dragged out of sight.', 'Fire spreads through anything that burns. Firefighters come, but not at once.', 'Cars can be hotwired. Their owners rarely take it well.',
  'Rain soaks your clothes. Wet clothes are cold ones.', 'Shops close. The people who run them go home.', 'Everyone in this city keeps a schedule. Learn it and you can use it.',
  'A hard day shows on your face. People notice.', 'A locked door is only a question of skill, tools and who is listening.', 'Sit down now and then. Not everything needs doing today.',
];
const STAGES = [[0, 'Pouring the asphalt'], [0.18, 'Raising the buildings'], [0.38, 'Furnishing the rooms'], [0.58, 'Parking the cars'], [0.74, 'Planting the trees'], [0.86, 'Waking up the neighbors'], [0.95, 'Turning on the lights']];
if (G.LANG_PT && G.LANG_PT.s) Object.assign(G.LANG_PT.s, {
  'Q kicks. Which kick depends on where you aim, how you move and how close they are.': 'Q chuta. O chute depende de onde você mira, de como se move e da distância.', 'When someone demands something, Y agrees and N refuses. You can keep walking. E opens the whole conversation.': 'Quando alguém exige algo, Y aceita e N recusa. Você pode continuar andando. E abre a conversa completa.', 'Refusing the police is not a fight. Attacking them or running from them is.': 'Recusar a polícia não é briga. Atacar ou fugir deles é.',
  'Pouring the asphalt': 'Despejando o asfalto', 'Raising the buildings': 'Erguendo os prédios', 'Furnishing the rooms': 'Mobiliando os cômodos', 'Parking the cars': 'Estacionando os carros', 'Planting the trees': 'Plantando as árvores', 'Waking up the neighbors': 'Acordando os vizinhos', 'Turning on the lights': 'Acendendo as luzes',
  'A new life': 'Uma nova vida', 'Picking up where you left off': 'Voltando de onde você parou', 'Day': 'Dia',
  'A bandage stops the bleeding. It does not fix what caused it.': 'Uma bandagem estanca o sangue. Não resolve o que o causou.', 'Doors have owners. So do the people who notice you at them.': 'Portas têm donos. E quem repara em você nelas também.', 'Fighters at the Pit are rated by what they have done lately. Read the board before you bet.': 'Os lutadores do Pit valem pelo que fizeram por último. Leia o quadro antes de apostar.', 'Someone out cold can be dragged out of sight.': 'Alguém desacordado pode ser arrastado para longe dos olhos.', 'Fire spreads through anything that burns. Firefighters come, but not at once.': 'O fogo se espalha por tudo que queima. Os bombeiros vêm, mas não na hora.', 'Cars can be hotwired. Their owners rarely take it well.': 'Carros podem ser ligados na ligação direta. Os donos raramente gostam.', 'Rain soaks your clothes. Wet clothes are cold ones.': 'A chuva encharca a roupa. Roupa molhada é roupa fria.', 'Shops close. The people who run them go home.': 'Lojas fecham. Quem cuida delas vai para casa.', 'Everyone in this city keeps a schedule. Learn it and you can use it.': 'Todo mundo nesta cidade tem uma rotina. Aprenda e use.', 'A hard day shows on your face. People notice.': 'Um dia difícil aparece no rosto. As pessoas notam.', 'A locked door is only a question of skill, tools and who is listening.': 'Porta trancada é só questão de habilidade, ferramentas e de quem está ouvindo.', 'Sit down now and then. Not everything needs doing today.': 'Sente-se de vez em quando. Nem tudo precisa ser feito hoje.',
});
const ease = (t) => t * t * (3 - 2 * t);
class LoadingScene {
  constructor(opts = {}) {
    this.xpNoir = true; this.opts = opts; this.t = 0; this.done = 0; this.shown = 0; this.game = null; this.leave = 0; this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.steps = null; this.sky = null;
    const s = opts.save; this.sub = s ? 'Picking up where you left off' : 'A new life';
    this.when = s && s.world ? `${G.i18n.t('Day')} ${s.world.day || 1}` : '';
  }
  enter() {
    const o = this.opts, want = o.save ? (o.save.world && o.save.world.flags && o.save.world.flags.customWorld) || null : G.worldFile.pending;
    if (want !== G.worldFile.active && !G.worldFile.activate(want)) G.worldFile.activate(null);
    G.maps.reset();
    const mods = o.save && o.save.world ? o.save.world.mapMods || {} : null, ids = Object.keys(G.MAPGEN);
    const map = (id) => () => { const was = G.world; G.world = mods ? { mapMods: mods } : null; try { G.maps.get(id); } catch (e) { delete G.maps.cache[id]; } finally { G.world = was; } };
    this.steps = ids.map(map);
    for (const n of ['oak0', 'oak1', 'oak2', 'pine0', 'pine1', 'bush', 'berrybush']) this.steps.push(() => G.floraHD.get(n));
    this.steps.push(() => { G.maps.keep = true; try { this.game = new G.GameScene(o); } finally { G.maps.keep = false; } });
    this.steps.push(() => { const m = this.game.map; if (!m.groundCanvas) { m.live = true; m.prerender(); } if (m._needBlend) { m._needBlend = false; try { G.terrain.blend(m); } catch (e) { G.reportError && G.reportError(e); } } });
    this.total = this.steps.length;
  }
  update(dt) {
    this.t += dt;
    if (this.done < this.total && this.t > 0.12) {   // (a first frame is on the screen before the work starts)
      const until = performance.now() + 24;
      do {
        try { this.steps[this.done++](); } catch (e) { G.reportError && G.reportError(e); G.maps.keep = false; G.scenes.replace(new G.MenuScene()); return; }
      } while (this.done < this.total && performance.now() < until && this.steps.length - this.done > 2);
    }
    const aim = this.done / (this.total || 1); this.shown += (aim - this.shown) * Math.min(1, dt * 9);
    if (this.done >= this.total && this.shown > 0.985) { this.leave += dt; if (this.leave > 0.42) { const g = this.game; G.scenes.replace(g); G.scenes.push(new G.FadeScene(null, 0.5)); const f = G.scenes.top(); f.t = 0.25; } }
  }
  build(W, H) {
    const r = new G.RNG('skyline'), blocks = [], wins = [];
    for (let x = -0.02; x < 1.02;) {
      const w = 0.035 + r.next() * 0.06, h = 0.1 + r.next() * r.next() * 0.34; blocks.push({ x, w, h, c: r.pick(['#0a0c14', '#0d1018', '#0b0e12', '#10121c']), beacon: h > 0.28 });
      const cols = Math.floor(w / 0.0085), rows = Math.floor(h / 0.021);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (r.next() < 0.72) wins.push({ x: x + 0.004 + i * 0.0085, j, h, c: r.pick(['#ffd98a', '#ffcc70', '#f4e4b0', '#9fd0ff', '#ffb878']), k: r.next() });
      x += w + r.next() * 0.008;
    }
    wins.sort((a, b) => a.k - b.k);
    this.sky = { blocks, wins, W, H };
  }
  render(ctx) {
    const W = R.W, H = R.H, S = H / 720; R.screenTransform();
    if (!this.sky) this.build(W, H);
    const t = this.t, p = Math.min(1, this.shown), base = H * 0.8;
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
    // the island, pushing in
    if (island.complete && island.naturalWidth) { const z = 1.14 + ease(Math.min(1, (t + p * 6) / 12)) * 0.34, iw = island.naturalWidth, ih = island.naturalHeight, k = Math.max(W / iw, H / ih) * z; ctx.globalAlpha = 0.62; ctx.imageSmoothingEnabled = true; ctx.drawImage(island, (W - iw * k) / 2, (H - ih * k) / 2 - H * 0.08, iw * k, ih * k); ctx.globalAlpha = 1; }
    const fog = ctx.createLinearGradient(0, 0, 0, H); fog.addColorStop(0, 'rgba(6,10,26,0.6)'); fog.addColorStop(0.55, 'rgba(10,12,26,0.5)'); fog.addColorStop(0.8, 'rgba(5,6,12,0.95)'); fog.addColorStop(1, '#05060a'); ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
    // the skyline: a window for every bit of the city that is ready
    const u = W, wn = Math.max(2, 5 * S), hn = Math.max(3, 7 * S);
    for (const b of this.sky.blocks) { ctx.fillStyle = b.c; ctx.fillRect(b.x * u, base - b.h * H, b.w * u + 1, b.h * H + 2); if (b.beacon && Math.sin(t * 2 + b.x * 40) > 0.5) { ctx.fillStyle = '#ff3a30'; ctx.fillRect((b.x + b.w / 2) * u, base - b.h * H - 5 * S, 3 * S, 3 * S); } }
    const lit = Math.floor(this.sky.wins.length * p);
    for (let i = 0; i < lit; i++) { const q = this.sky.wins[i]; ctx.fillStyle = q.c; ctx.globalAlpha = 0.62 + 0.3 * q.k; ctx.fillRect(q.x * u, base - q.h * H + 8 * S + q.j * 0.021 * H, wn, hn); }
    ctx.globalAlpha = 1;
    // light rain, close to the camera
    ctx.strokeStyle = 'rgba(170,195,230,0.13)'; ctx.lineWidth = Math.max(1, S); ctx.beginPath(); for (let i = 0; i < 46; i++) { const px = (i * 173.7 + t * 90) % W, py = ((i * 97.3 + t * (640 + i * 9)) % (H * 1.1)) - 20; ctx.moveTo(px, py); ctx.lineTo(px - 3 * S, py + 15 * S); } ctx.stroke();
    // the road is the progress bar
    const ry = base + 2, rh = 56 * S; ctx.fillStyle = '#17181c'; ctx.fillRect(0, ry, W, rh); ctx.fillStyle = '#0a0a0d'; ctx.fillRect(0, ry, W, 3 * S); ctx.fillRect(0, ry + rh - 3 * S, W, 3 * S);
    const cx = -60 * S + (W + 40 * S) * p, dash = 44 * S; ctx.fillStyle = '#c8a83a'; for (let x = 0; x < cx - 30 * S; x += dash) ctx.fillRect(x, ry + rh / 2 - 1.5 * S, dash * 0.58, 3 * S);
    const car = G.vehiclesHD.get('car_gray'); if (car) { const cw = 96 * S, ch = cw * car.height / car.width, wob = Math.sin(t * 22) * 0.5 * S, cy = ry + rh * 0.76 + wob; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const beam = ctx.createLinearGradient(cx + cw / 2, 0, cx + cw / 2 + 180 * S, 0); beam.addColorStop(0, 'rgba(255,240,190,0.5)'); beam.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(cx + cw / 2 - 4 * S, cy - ch * 0.3); ctx.lineTo(cx + cw / 2 + 180 * S, cy - ch * 0.8); ctx.lineTo(cx + cw / 2 + 180 * S, cy + ch * 0.8); ctx.lineTo(cx + cw / 2 - 4 * S, cy + ch * 0.3); ctx.fill(); ctx.restore(); ctx.imageSmoothingEnabled = true; ctx.drawImage(car, cx - cw / 2, cy - ch / 2, cw, ch); }
    // the words
    const T = (s, x, y, sz, col, w, al) => { ctx.font = `${w || ''} ${Math.round(sz * S)}px Georgia, 'Times New Roman', serif`; ctx.textAlign = al || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(s, x + 2 * S, y + 2 * S); ctx.fillStyle = col; ctx.fillText(s, x, y); };
    const stage = STAGES.filter((q) => q[0] <= p).pop()[1];
    T('UNHOLIUM', 48 * S, 92 * S, 58, '#f0ead8', 'bold'); T(G.i18n.t(this.sub) + (this.when ? `  ·  ${this.when}` : ''), 50 * S, 124 * S, 19, '#c8bfa8');
    T(`${G.i18n.t(stage)}...`, W - 44 * S, ry + rh + 34 * S, 20, '#f0c870', '', 'right'); T(`${Math.round(p * 100)}%`, W - 44 * S, ry + rh + 60 * S, 15, '#a8a090', '', 'right');
    T(G.i18n.t(this.tip), 44 * S, ry + rh + 34 * S, 18, '#d4ccba', 'italic');
    if (this.leave > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.leave / 0.42)})`; ctx.fillRect(0, 0, W, H); }
  }
}
G.LoadingScene = LoadingScene;
G.startGame = (opts) => G.scenes.replace(new LoadingScene(opts));

// a street sign on the black, for as long as the next place takes
G.mapCard = (id) => { const m = G.maps.cache[id]; if (!m || !m.meta || !m.meta.name || m.meta.indoor || m.meta.floorOf) return null; return { name: m.meta.name, line: G.world ? `${G.i18n.t('Day')} ${G.world.day}  ·  ${G.world.timeString}` : '' }; };
G.drawMapCard = (ctx, card, a) => {
  const W = R.W, H = R.H, S = H / 720; ctx.save(); ctx.globalAlpha = a; ctx.font = `bold ${Math.round(38 * S)}px Arial, Helvetica, sans-serif`;
  const name = G.i18n.t(card.name).toUpperCase(), w = Math.max(ctx.measureText(name).width + 96 * S, 300 * S), h = 104 * S, x = (W - w) / 2, y = H * 0.42 - h / 2, r = 7 * S;
  ctx.fillStyle = '#4a4e54'; ctx.fillRect(x + 26 * S, y + h, 10 * S, 120 * S); ctx.fillRect(x + w - 36 * S, y + h, 10 * S, 120 * S);   // the posts
  ctx.fillStyle = '#0d4a30'; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.lineTo(x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.lineTo(x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.lineTo(x, y + h - r); ctx.lineTo(x, y + r); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8e6da'; ctx.lineWidth = 3 * S; ctx.strokeRect(x + 7 * S, y + 7 * S, w - 14 * S, h - 14 * S);
  ctx.fillStyle = '#b8b8ae'; for (const [a2, b2] of [[14, 14], [w / S - 14, 14], [14, h / S - 14], [w / S - 14, h / S - 14]]) { ctx.beginPath(); ctx.arc(x + a2 * S, y + b2 * S, 2.6 * S, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = '#f2f0e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(name, W / 2, y + 56 * S);
  if (card.line) { ctx.font = `${Math.round(17 * S)}px Arial, Helvetica, sans-serif`; ctx.fillStyle = '#cfd8cc'; ctx.fillText(card.line, W / 2, y + 84 * S); }
  ctx.restore();
};
})();
