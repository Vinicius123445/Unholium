'use strict';
// A world made in the tool, opened by the real game the way Play opens it (--world=name): the change must be there, in play.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const home = 'D:/Unholium_native/tools/tmp/wt', node = process.execPath;
if (!process.argv[2]) {
  fs.rmSync(home, { recursive: true, force: true }); fs.mkdirSync(path.join(home, 'worlds'), { recursive: true });
  const r = spawnSync(node, [__filename, 'make'], { env: Object.assign({}, process.env, { UNHOLIUM_HOME: home, UNHOLIUM_DATA: home + '/td', UNHOLIUM_MUTE: '1', UNHOLIUM_TOOL_HEADLESS: '1', UNHOLIUM_CPU: '1' }), encoding: 'utf8', timeout: 150000 }); console.log((r.stdout || '').trim().slice(-300), (r.stderr || '').slice(-300));
  const p = spawnSync(node, [__filename, 'play', '--world=TestWorld'], { env: Object.assign({}, process.env, { UNHOLIUM_HOME: home, UNHOLIUM_DATA: home + '/gd', UNHOLIUM_MUTE: '1' }), encoding: 'utf8', timeout: 150000 }); console.log((p.stdout || '').trim().slice(-500), (p.stderr || '').slice(-400)); process.exit(p.status);
}
if (process.argv[2] === 'play') {
  const R = require('./runtime'); process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 500)); process.exit(1); });
  R.loadGame();
  const want = JSON.parse(fs.readFileSync(home + '/want.json', 'utf8'));
  let n = 0; const go = () => {
    if (!(G.realMat && G.realMat.ready) || !(G.worldFile.pending || n > 600)) { n++; setTimeout(go, 20); return; }
    console.log('the game took the world:', G.worldFile.pending, 'menu is', G.scenes.top().constructor.name);
    G.scenes.replace(new G.GameScene({})); const g = G.scenes.top(); g.loadMap('city', 'start'); const m = g.map;
    const got = m.ground[want.y * m.w + want.x], npc = G.NPCS[want.npc], item = G.ITEMS[want.item], b = g.world.flags.customWorld;
    console.log(`custom world ${b}; tile ${got} wanted ${want.tile}; npc ${npc && npc.name}; item ${item && item.name}`); process.exit(got === want.tile && b === 'TestWorld' && npc ? 0 : 1);
  }; go();
}
if (process.argv[2] === 'make') {
  const T = require('./tool'), { UI, R } = T; process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 500)); process.exit(1); });
  T.boot(() => { const go = async () => {
    if (!(G.realMat && G.realMat.ready)) { setTimeout(go, 50); return; }
    const E = window.Editor, x = new UI.Canvas(1400, 860).getContext('2d'); UI.W = 1400; UI.H = 860; for (let i = 0; i < 3; i++) { UI.paint(x); R.frame(); }
    E.openMap('city'); const tx = 30, ty = 30, tile = E.M.ground[ty * E.M.w + tx] === G.T.sand ? G.T.dirt : G.T.sand; E.snap(); E.M.ground[ty * E.M.w + tx] = tile;
    E.modal = (t, f, ok) => ok && ok({ name: 'Maker Test', id: 'maker_test' }); E.newNpc(); const npc = Object.keys(E.npcs).find((k) => !G.NPCS[k]) || 'none'; E.newItem(); const item = Object.keys(E.items).find((k) => !G.ITEMS[k]) || 'none'; E.setDirty(true);
    fs.writeFileSync(home + '/want.json', JSON.stringify({ x: tx, y: ty, tile, npc, item })); E.name = 'TestWorld'; await E.cmd('save'); await new Promise((r) => setTimeout(r, 2500));
    console.log('saved', fs.existsSync(home + '/worlds/TestWorld/world.json'), 'npc', npc, 'item', item); process.exit(0);
  }; go().catch((e) => { console.log(e.stack); process.exit(1); }); });
}
