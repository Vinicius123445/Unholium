// inclusive time: which game functions the time is spent under (each function counted once per stack)
const fs = require('fs'), f = process.argv[2], P = JSON.parse(fs.readFileSync(f, 'utf8')), nodes = new Map(P.nodes.map((n) => [n.id, n])), parent = new Map();
for (const n of P.nodes) for (const c of n.children || []) parent.set(c, n.id);
const inc = new Map(), name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/.*[\\/]/, '')}:${n.callFrame.lineNumber + 1}`;
let total = 0; P.samples.forEach((id, i) => { const d = P.timeDeltas[i] || 0; total += d; const seen = new Set(); for (let q = id; q != null; q = parent.get(q)) { const k = name(nodes.get(q)); if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + d); } } });
const only = process.argv[4] ? new RegExp(process.argv[4]) : null;
const rows = [...inc].filter(([k]) => (!only || only.test(k)) && !/^\(|node:|look\.js|perf\.js|neon\.js|context\.js/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +process.argv[3] || 40);
for (const [k, v] of rows) console.log(((v / total) * 100).toFixed(1).padStart(5), '%', (v / 1000).toFixed(0).padStart(7), 'ms', k.slice(0, 72));
