'use strict';
// The Creation Tool's own checks, with no browser and no window. node tool_test.js [shot]
process.env.UNHOLIUM_TOOL_HEADLESS = '1'; process.env.UNHOLIUM_DATA = process.env.UNHOLIUM_DATA || 'D:/Unholium_native/tools/tmp/tooldata'; process.env.UNHOLIUM_CPU = '1';
process.env.UNHOLIUM_HOME = process.env.UNHOLIUM_HOME || 'D:/Unholium_native/tools/tmp/toolhome';
const fs = require('fs'), path = require('path'); fs.mkdirSync(process.env.UNHOLIUM_HOME, { recursive: true });
const T = require('./tool'), { UI, R } = T, { Canvas } = UI;
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack.slice(0, 900)); process.exit(1); });
const scr = new Canvas(1400, 860); scr.gpu = false; const x = scr.getContext('2d'); UI.W = 1400; UI.H = 860;
const shot = (n) => { UI.paint(x); fs.writeFileSync(path.join(__dirname, n), scr.toBufferSync('png')); };
const settle = () => { for (let i = 0; i < 4; i++) { UI.paint(x); R.frame(); } };
T.boot(() => {
  const go = async () => {
    if (!(G.realMat && G.realMat.ready)) { setTimeout(go, 50); return; }
    settle();
    if (process.argv[2] === 'shot') { shot('tool_shot.png'); UI.dirty = true; const t = performance.now(); UI.paint(x); console.log('shot, frame paint', Math.round(performance.now() - t), 'ms'); process.exit(0); }
    if (process.argv[2] === 'ui') { globalThis.require = require; R.runFile(path.join(__dirname, 'tool_ui_test.js')); return; }
    R.runFile(path.join(R.ROOT, 'tools', 'editor_test.js'));
    const s = String(await window.__edTest()), L = s.split('\n'), bad = L.filter((l) => l.startsWith('FAIL'));
    console.log(L[0], '|', L[L.length - 1]); for (const l of bad.slice(0, 20)) console.log(l.slice(0, 220));
    process.exit(bad.length ? 1 : 0);
  };
  go().catch((e) => { console.log(e.stack); process.exit(1); });
});
