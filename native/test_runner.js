'use strict';
// The game's own test suite, the same js/test.js, with no browser. node test_runner.js <group>
const only = process.argv[2];
process.argv.push(`--search=?test&only=${only}`);
process.env.UNHOLIUM_DATA = process.env.UNHOLIUM_DATA || `D:/Unholium_native/tools/tmp/td_${process.pid}`;
process.env.UNHOLIUM_NOPAD = '1'; process.env.UNHOLIUM_MUTE = process.env.UNHOLIUM_MUTE || '0'; process.env.UNHOLIUM_BROWSERLIKE = '1';   // (the suite was written for a page with no desktop host)
process.env.W = process.env.W || '1280'; process.env.H = process.env.H || '720';
const fs = require('fs'), R = require('./runtime');
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack); });
const finish = () => { try { fs.rmSync(process.env.UNHOLIUM_DATA, { recursive: true, force: true }); } catch (e) { /* later */ } };
const check = setInterval(() => {
  const p = document.getElementById('testlog');
  if (!p) return;
  clearInterval(check);
  const lines = p.textContent.split('\n'), ok = lines.filter((l) => /^\s*ok /.test(l)).length, bad = lines.filter((l) => /^\s*(FAIL|EXCEPTION)/.test(l));
  console.log(`${only}  ok ${ok}${bad.length ? `  FAIL ${bad.length}` : ''}`); for (const l of bad.slice(0, +process.env.SHOW || 12)) console.log('    ' + l.trim().slice(0, 300));
  finish(); process.exit(bad.length ? 1 : 0);
}, 50);
R.loadGame({ test: true });
