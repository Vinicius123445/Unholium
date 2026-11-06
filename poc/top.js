// the most expensive functions in a .cpuprofile: self time, and by file
const fs = require('fs'), f = process.argv[2], P = JSON.parse(fs.readFileSync(f, 'utf8')), self = new Map(), dt = P.timeDeltas, byNode = new Map(P.nodes.map((n) => [n.id, n]));
let total = 0; P.samples.forEach((id, i) => { const d = dt[i] || 0, n = byNode.get(id), k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/.*[\\/]/, '')}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + d); total += d; });
const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, +process.argv[3] || 34);
for (const [k, v] of rows) console.log(((v / total) * 100).toFixed(1).padStart(5), '%', (v / 1000).toFixed(0).padStart(7), 'ms', k.slice(0, 80));
const files = new Map(); for (const [k, v] of self) { const x = k.split(' ').pop().split(':')[0] || '(native)'; files.set(x, (files.get(x) || 0) + v); }
console.log('--- by file'); for (const [k, v] of [...files].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(((v / total) * 100).toFixed(1).padStart(5), '%', k);
