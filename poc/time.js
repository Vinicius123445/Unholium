'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const t0 = performance.now();
require('./shim');
const root = path.join(__dirname, '..'), run = (f) => vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
run(path.join(__dirname, 'seed.js'));
for (const l of fs.readFileSync(path.join(root, 'js', 'scripts.txt'), 'utf8').split(/\r?\n/)) if (l && !l.startsWith('#')) run(path.join(root, l.trim()));
run(path.join(__dirname, 'timing.js'));
PocTiming(t0, (o) => { const m = process.memoryUsage(); o.rssMB = Math.round(m.rss / 1048576); o.peakMB = Math.round(process.resourceUsage().maxRSS / 1024); o.heapMB = Math.round(m.heapUsed / 1048576); console.log(JSON.stringify(o)); process.exit(0); });
