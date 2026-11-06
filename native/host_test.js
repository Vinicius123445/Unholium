'use strict';
// Co-op over a real TCP socket, two endpoints; AI key encryption; local AI through a fake server. Nothing here touches the real key.
const Net = require('./net'), Ai = require('./ai'), http = require('http'), fs = require('fs'), os = require('path');
let fails = 0, oks = 0; const check = (c, m) => { if (c) { oks++; } else { fails++; console.log('FAIL', m); } };
const wait = (f, ms = 3000) => new Promise((r) => { const t = Date.now(), i = setInterval(() => { if (f() || Date.now() - t > ms) { clearInterval(i); r(f()); } }, 10); });
(async () => {
  const A = [], B = [], C = [], host = new Net((m) => A.push(m)), g1 = new Net((m) => B.push(m)), g2 = new Net((m) => C.push(m)), PORT = 41873;
  host.command('host:' + PORT); await wait(() => A.some((m) => m.startsWith('net:ip:')));
  check(A.includes('net:hosting:' + PORT), 'hosting reported'); check(A.some((m) => /^net:ip:\d/.test(m)), 'addresses reported');
  g1.command(`join:127.0.0.1:${PORT}`); await wait(() => B.includes('net:connected') && A.includes('net:join:1')); check(A.includes('net:join:1'), 'a guest joins');
  g2.command(`join:127.0.0.1:${PORT}`); await wait(() => A.includes('net:join:2'));
  g1.command('send:{"t":"hello","s":"çã"}'); await wait(() => A.some((m) => m.startsWith('net:msg:1:')));
  check(A.includes('net:msg:1:{"t":"hello","s":"çã"}'), 'guest to host, Portuguese intact');
  host.command('send:{"t":"all"}'); await wait(() => B.includes('net:msg:0:{"t":"all"}') && C.includes('net:msg:0:{"t":"all"}')); check(C.includes('net:msg:0:{"t":"all"}') && B.includes('net:msg:0:{"t":"all"}'), 'host to every guest');
  host.command('sendto:2:{"t":"one"}'); await wait(() => C.includes('net:msg:0:{"t":"one"}')); check(C.includes('net:msg:0:{"t":"one"}') && !B.includes('net:msg:0:{"t":"one"}'), 'host to one guest');
  const big = 'x'.repeat(200000); g1.command(`send:{"t":"big","d":"${big}"}`); await wait(() => A.some((m) => m.length > 200000)); check(A.some((m) => m.length > 200000), 'a large world snapshot in one line');
  const many = []; for (let i = 0; i < 500; i++) many.push(i); for (const i of many) g1.command(`send:{"t":"n","i":${i}}`); await wait(() => A.filter((m) => m.includes('"t":"n"')).length === 500); const got = A.filter((m) => m.includes('"t":"n"')).map((m) => JSON.parse(m.slice(m.indexOf('{'))).i); check(got.length === 500 && got.every((v, i) => v === i), `in order (${got.length})`);
  g1.command(`send:${'y'.repeat(1100000)}`); await wait(() => A.includes('net:leave:1')); check(A.includes('net:leave:1'), 'a line over the limit ends the peer');
  const D = [], g3 = new Net((m) => D.push(m)), g4 = new Net((m) => D.push(m)), g5 = new Net((m) => D.push(m));
  g3.command(`join:127.0.0.1:${PORT}`); g4.command(`join:127.0.0.1:${PORT}`); await wait(() => A.filter((m) => m.startsWith('net:join:')).length >= 4); g5.command(`join:127.0.0.1:${PORT}`); await new Promise((r) => setTimeout(r, 300)); check(host.peers.size === 3, `three guests at most (${host.peers.size})`);
  host.command('kick:2'); await wait(() => A.includes('net:leave:2')); check(A.includes('net:leave:2'), 'kick');
  host.command('stop'); await wait(() => C.includes('net:closed') || D.includes('net:closed')); check(D.includes('net:closed'), 'the guests are told when the host stops');
  for (const n of [g1, g2, g3, g4, g5]) n.command('stop');
  const E = [], bad = new Net((m) => E.push(m)); bad.command('join:127.0.0.1:1'); await wait(() => E.some((m) => m.startsWith('net:error:'))); check(E.some((m) => m.startsWith('net:error:')), 'a failed join says so');
  // AI: encryption round trip in a scratch folder; a fake local server
  const dir = 'D:/Unholium_native/tools/tmp/aitest'; fs.mkdirSync(dir, { recursive: true }); const P = [], ai = new Ai((m) => P.push(m), dir), hadOld = !!ai.key;
  ai.keyFile = dir + '/ai.key'; const hold = ai.key; ai.command('key:test-not-a-real-key'); check(P.includes('ai:keystatus:1'), 'key stored'); const raw = fs.readFileSync(ai.keyFile); check(!raw.toString('latin1').includes('test-not-a-real-key'), 'stored encrypted');
  const ai2 = new Ai(() => {}, dir); check(ai2.key === 'test-not-a-real-key', 'and it opens again'); ai.command('key:'); check(!fs.existsSync(ai.keyFile), 'forgetting the key deletes it'); ai.key = hold; fs.rmSync(dir, { recursive: true, force: true });
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (d) => { b += d; }); q.on('end', () => { if (q.url === '/api/tags') { r.end('{"models":[{"name":"qwen:7b"},{"name":"nomic-embed"}]}'); return; } r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ echo: JSON.parse(b), url: q.url })); }); }); await new Promise((r) => srv.listen(41874, r));
  const Q = [], ai3 = new Ai((m) => Q.push(m), 'D:/Unholium_native/tools/tmp'); ai3.command('localurl:http://127.0.0.1:41874/v1/chat/completions'); ai3.command('local'); await wait(() => Q.some((m) => m.startsWith('ai:models:'))); check(Q.includes('ai:models:["qwen:7b","nomic-embed"]'), 'local models listed');
  ai3.command('ask:7:ollama:3000:{"a":"é:1"}'); await wait(() => Q.some((m) => m.startsWith('ai:reply:7:'))); const rp = Q.find((m) => m.startsWith('ai:reply:7:')) || ''; check(rp.startsWith('ai:reply:7:200:') && rp.includes('/api/chat') && rp.includes('é:1'), `a request goes through (${rp.slice(0, 80)})`);
  ai3.key = null; ai3.command('ask:8:claude:3000:{}'); await wait(() => Q.includes('ai:reply:8:0:no key')); check(Q.includes('ai:reply:8:0:no key'), 'Claude with no key: no request');
  srv.close(); ai3.command('ask:9:local:1000:{}'); await wait(() => Q.some((m) => m.startsWith('ai:reply:9:0:'))); check(Q.some((m) => m.startsWith('ai:reply:9:0:')), 'a server that is down: an answer, no crash');
  console.log(`host_test ok ${oks} failed ${fails}; an existing AI key ${hadOld ? 'was found and opened' : 'was not found'}`); process.exit(fails ? 1 : 0);
})();
void os;
