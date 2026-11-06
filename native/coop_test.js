'use strict';
// Co-op with two real copies of the game in two processes, over a real socket on this machine.
const { spawn } = require('child_process'), PORT = 41990, role = process.argv[2];
if (!role) {
  const run = (r) => new Promise((ok) => { const c = spawn(process.execPath, [__filename, r], { env: Object.assign({}, process.env, { UNHOLIUM_DATA: `D:/Unholium_native/tools/tmp/coop_${r}`, UNHOLIUM_MUTE: '1', W: '640', H: '360' }) }); let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; }); c.on('close', (code) => ok({ code, out })); setTimeout(() => c.kill(), 100000); });
  (async () => { const h = run('host'); await new Promise((r) => setTimeout(r, 14000)); const [a, b] = await Promise.all([h, run('guest')]); console.log('--host\n' + a.out.slice(-900)); console.log('--guest\n' + b.out.slice(-900)); process.exit(a.code || b.code ? 1 : 0); })();
  return;
}
const R = require('./runtime'), Net = require('./net'), fs = require('fs');
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 700)); process.exit(1); });
const net = new Net(R.toPage); R.handlers['net:'] = (c) => net.command(c);
R.loadGame();
const say = (s) => console.log(s), wait = (f, ms) => new Promise((ok) => { const t = Date.now(), i = setInterval(() => { try { const now = performance.now(), steps = Math.min(6, Math.floor((now - (globalThis.__last || now - 34)) / 16.67)); if (steps > 0) { globalThis.__last = now; for (let q = 0; q < steps; q++) G.loop.tick(1 / 60); G.loop.draw(); } } catch (e) { say('tick ' + e.message); } if (f() || Date.now() - t > ms) { clearInterval(i); ok(!!f()); } }, 16); });
const go = async () => {
  if (!(G.realMat && G.realMat.ready)) { setTimeout(go, 50); return; }
  G.loop.running = false; G.law.off = true; G.happenings.off = true; G.travel.off = true;
  if (role === 'host') {
    G.scenes.replace(new G.GameScene({})); await wait(() => true, 200); const g = G.scenes.stack.find((s) => s instanceof G.GameScene); while (G.scenes.top() !== g) G.scenes.pop(); g.player.playerName = 'Hoster'; g.loadMap('city', 'start'); G.coop.host(PORT);
    const joined = await wait(() => Object.keys(G.coop.peers || {}).length > 0, 40000); say(`host: a guest joined: ${joined}, players ${G.coop.count && G.coop.count()}`); if (!joined) process.exit(1);
    G.settings.data.moveMode = 1; await wait(() => false, 11000); const x0 = g.player.x; G.input.down.add('KeyA'); await wait(() => false, 1800); G.input.down.delete('KeyA'); say(`host walked ${Math.round(x0)} to ${Math.round(g.player.x)}`); await wait(() => false, 800);
    const peer = Object.values(G.coop.peers)[0], ax = peer && peer.actor; say(`host sees guest at ${ax && Math.round(ax.x)},${ax && Math.round(ax.y)} name ${ax && (ax.name || ax.playerName)}`);
    const cx = ax ? ax.tx : 0; G.coop.sendChat('ola do host çã'); G.input.down.add('KeyW'); await wait(() => false, 1200); G.input.down.delete('KeyW'); G.input.down.add('KeyS'); await wait(() => false, 1200); G.input.down.delete('KeyS'); G.input.down.add('KeyD'); await wait(() => false, 1200); G.input.down.delete('KeyD'); await wait(() => (ax ? Math.abs(ax.tx - cx) > 15 : false), 45000); const moved = ax && Math.abs(ax.tx - cx) > 15; say(`host saw the guest walk: ${!!moved}`);
    await wait(() => false, 2500); process.exit(moved ? 0 : 1);
  } else {
    G.scenes.replace(new G.MenuScene()); G.coop.join('127.0.0.1', PORT);
    const inGame = await wait(() => G.scenes.stack.some((s) => s instanceof G.GameScene && s.player) || false, 30000); const g = G.scenes.stack.find((s) => s instanceof G.GameScene); say(`guest in the world: ${inGame}, top ${G.scenes.top().constructor.name}, map ${g && g.map && g.map.id}`); if (!inGame) process.exit(1);
    if (G.scenes.top() !== g) { while (G.scenes.stack.length > 1 && G.scenes.top() !== g) G.scenes.pop(); }
    const pup = () => Object.values(G.coop.puppets || {})[0], at = () => { const q = pup(); return q ? (q.tx != null ? q.tx : q.x) : 0; }, close = () => { while (G.scenes.stack.length > 1 && G.scenes.top() !== g) G.scenes.pop(); }, gotP = await wait(() => { close(); return !!pup(); }, 8000); await wait(() => { close(); return false; }, 1500); close(); say(`world running, time ${g.time.toFixed(1)}`); say(`guest sees the host: ${gotP}`); const x0 = at(); const y0 = pup() ? pup().ty : 0; const moved = await wait(() => { close(); return pup() && (Math.abs(at() - x0) > 15 || Math.abs(pup().ty - y0) > 15); }, 22000); const shown = pup(), near = shown && Math.abs(shown.x - shown.tx) < 30; await wait(() => Math.abs(pup().x - pup().tx) < 30, 2000); say(`the host is drawn where he is: ${Math.abs(pup().x - pup().tx) < 30}`); void near; say(`guest saw the host walk: ${moved}`);
    const chat = await wait(() => JSON.stringify(G.coop.chat || G.coop.log || '').includes('ola do host çã') || (g.toasts || []).some((t) => /ola do host/.test(t.text || t)), 6000); say(`guest got the chat: ${chat}`);
    G.settings.data.moveMode = 1; G.input.down.add('KeyA'); await wait(() => false, 2000); G.input.down.delete('KeyA'); say('guest walked'); await wait(() => false, 3000); process.exit(gotP && moved ? 0 : 1);
  }
};
go();
