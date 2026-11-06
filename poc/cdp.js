'use strict';
// Runs a page in real Edge in real time and waits for #res: reference numbers from the old build.
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const [extra, outFile, flags = ''] = process.argv.slice(2), R = 'D:/Unholium_native', id = Date.now().toString(36), PORT = 9344;
let h = fs.readFileSync(R + '/index.html', 'utf8').replace('<head>', '<head><base href="file:///D:/Unholium_native/"><script src="poc/seed.js"></script>').replace('</body>', `<script src="poc/${extra.split(',')[0]}"></script><script src="poc/${extra.split(',')[1]}"></script></body>`);
const page = `${R}/poc/p_${id}.html`; fs.writeFileSync(page, h);
const prof = `${R}/tools/tmp/ue_${id}`;
const e = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-first-run', '--allow-file-access-from-files', `--user-data-dir=${prof}`, '--window-size=1280,720', `--remote-debugging-port=${PORT}`, ...flags.split(' ').filter(Boolean), `file:///${page}`], { stdio: 'ignore' });
const end = (c) => { try { e.kill(); } catch (x) { /* gone */ } setTimeout(() => { try { fs.unlinkSync(page); fs.rmSync(prof, { recursive: true, force: true }); } catch (x) { /* later */ } process.exit(c); }, 1200); };
(async () => {
  let tab = null; for (let i = 0; i < 60 && !tab; i++) { await new Promise((r) => setTimeout(r, 500)); try { tab = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page'); } catch (x) { /* starting */ } }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; }); let n = 0; const wait = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (wait[d.id]) wait[d.id](d); };
  const ev = (expression) => new Promise((r) => { const i = ++n; wait[i] = r; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })); });
  const t0 = Date.now(); while (Date.now() - t0 < 200000) { const r = await ev("(document.getElementById('res')||{}).textContent||''"); const v = r.result && r.result.result && r.result.result.value; if (v) { fs.writeFileSync(outFile, v); console.log('saved', v.length); end(0); return; } await new Promise((q) => setTimeout(q, 700)); }
  console.log('timed out'); end(1);
})();
