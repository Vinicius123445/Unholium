'use strict';
// Co-op networking: a tiny TCP server (the host) or client (a guest), the same protocol as the old C# host, so the two builds can even play
// together. Messages are single lines of JSON (UTF-8, newline-terminated). Nothing received is ever executed; lines over 1 MB end the peer.
const net = require('net'), os = require('os'), dgram = require('dgram');
const MAX_GUESTS = 3, MAX_LINE = 1 << 20, TRY_MS = 9000, FIND_PORT = 7778, ASK = 'UNHOLIUM?', ASK_MS = 1500;
const clean = (s) => String(s || '').replace(/[\r\n]/g, ' ');
class Net {
  constructor(post) { this.post = post; this.server = null; this.client = null; this.peers = new Map(); this.nextId = 1; }
  command(cmd) {
    try {
      if (cmd.startsWith('host:')) this.host(parseInt(cmd.slice(5), 10));
      else if (cmd.startsWith('join:')) { const r = cmd.slice(5), c = r.lastIndexOf(':'); this.join(r.slice(0, c), parseInt(r.slice(c + 1), 10)); }
      else if (cmd.startsWith('sendto:')) { const r = cmd.slice(7), c = r.indexOf(':'); this.sendTo(parseInt(r.slice(0, c), 10), r.slice(c + 1)); }
      else if (cmd.startsWith('send:')) this.send(cmd.slice(5));
      else if (cmd.startsWith('kick:')) this.drop(parseInt(cmd.slice(5), 10));
      else if (cmd.startsWith('hostinfo:')) this.info = JSON.parse(cmd.slice(9));
      else if (cmd === 'find') this.find();
      else if (cmd === 'findstop') this.stopFind();
      else if (cmd === 'stop') this.stop();
    } catch (e) { this.post('net:error:' + clean(e.message)); }
  }
  // one line at a time; a line that is too long, or a connection that breaks, ends the peer
  lines(sock, onLine, onEnd) {
    let rest = Buffer.alloc(0), over = false, ended = false; sock.setNoDelay(true);
    const end = () => { if (!ended) { ended = true; onEnd(); } };
    sock.on('data', (d) => {
      if (over) return;
      rest = rest.length ? Buffer.concat([rest, d]) : d; let at;
      while ((at = rest.indexOf(10)) >= 0) { if (at > MAX_LINE) { over = true; sock.destroy(); end(); return; } const line = rest.subarray(0, at).toString('utf8').replace(/\r/g, ''); rest = rest.subarray(at + 1); if (line) onLine(line); }
      if (rest.length > MAX_LINE) { over = true; sock.destroy(); end(); }
    });
    sock.on('close', end); sock.on('error', end);
  }
  host(port) {
    this.stop();
    const s = this.server = net.createServer((sock) => {
      if (this.peers.size >= MAX_GUESTS) { sock.destroy(); return; }
      const id = this.nextId++; this.peers.set(id, sock); this.post('net:join:' + id);
      this.lines(sock, (l) => this.post(`net:msg:${id}:${l}`), () => this.drop(id));
    });
    s.on('error', (e) => this.post('net:error:' + clean(e.message)));
    s.listen(port, () => { this.post('net:hosting:' + port); this.post('net:ip:' + Net.localIPs().join(',')); this.beacon(port); });
  }
  // Find games: whoever searches shouts on the network, and a host answers with what its list row needs. Nothing but that one question gets an answer.
  beacon(port) {
    const u = this.udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    u.on('error', () => { /* no search on this machine: the address still works */ });
    u.on('message', (m, from) => { if (m.toString() !== ASK) return; const i = this.info || {}; u.send(Buffer.from(JSON.stringify({ unholium: 1, port, name: i.name, players: i.players, v: i.v, id: this.findId })), from.port, from.address); });
    this.findId = this.findId || Math.floor(Math.random() * 1e9);
    u.bind(FIND_PORT);
  }
  find() {
    this.stopFind();
    const s = this.finder = dgram.createSocket('udp4');
    s.on('error', (e) => this.post('net:error:' + clean(e.message)));
    s.on('message', (m, from) => {   // (anyone can send anything to this port: only checked fields go on)
      if (m.length > 512) return; let d; try { d = JSON.parse(m.toString()); } catch (e) { return; }
      if (!d || d.unholium !== 1 || !(d.port > 0 && d.port < 65536)) return;
      this.post('net:found:' + JSON.stringify({ ip: from.address, port: d.port | 0, id: d.id | 0, players: Math.max(1, Math.min(4, d.players | 0)), v: clean(d.v).slice(0, 20), name: clean(d.name).replace(/[^\p{L}\p{N} ._'-]/gu, '').slice(0, 24) }));
    });
    const ask = () => { for (const a of Net.broadcasts()) s.send(ASK, FIND_PORT, a, () => { /* that network is not there: the others are */ }); };
    s.bind(0, () => { s.setBroadcast(true); ask(); this.findT = setInterval(ask, ASK_MS); });
  }
  stopFind() {
    if (this.findT) { clearInterval(this.findT); this.findT = null; }
    if (this.finder) { try { this.finder.close(); } catch (e) { /* closed */ } this.finder = null; }
  }
  join(ip, port) {
    this.stop();
    const c = this.client = net.connect({ host: ip, port });
    let up = false, told = false;
    // a firewall drops the connection without a word: left alone, that is a long silence with nothing on screen
    const fail = (why) => { if (up || told) return; told = true; this.post('net:error:' + why); try { c.destroy(); } catch (e) { /* gone */ } };
    const far = `Could not reach ${ip}:${port}. Check the address, and that the host is hosting and allowed port ${port} in their firewall.`;
    c.setTimeout(TRY_MS, () => fail(far));
    c.once('connect', () => { up = true; c.setTimeout(0); this.post('net:connected'); });
    c.on('error', (e) => fail(e.code === 'ECONNREFUSED' ? `${ip} answered, but nobody is hosting on port ${port}.` : e.code === 'ENOTFOUND' ? `There is no address called ${ip}.` : far));
    this.lines(c, (l) => this.post(`net:msg:0:${l}`), () => { if (up && this.client === c) this.post('net:closed'); });
  }
  send(json) {
    if (this.client) { try { this.client.write(json + '\n'); } catch (e) { this.post('net:closed'); } return; }
    for (const s of this.peers.values()) { try { s.write(json + '\n'); } catch (e) { /* its close event drops it */ } }
  }
  sendTo(id, json) { const s = this.peers.get(id); if (s) { try { s.write(json + '\n'); } catch (e) { /* its close event drops it */ } } }
  drop(id) { const s = this.peers.get(id); if (!s) return; this.peers.delete(id); try { s.destroy(); } catch (e) { /* gone */ } this.post('net:leave:' + id); }
  stop() {
    this.stopFind();
    if (this.udp) { try { this.udp.close(); } catch (e) { /* closed */ } this.udp = null; }
    if (this.server) { try { this.server.close(); } catch (e) { /* not listening */ } this.server = null; }
    const all = [...this.peers.values()]; this.peers.clear(); for (const s of all) { try { s.destroy(); } catch (e) { /* gone */ } }
    if (this.client) { const c = this.client; this.client = null; try { c.destroy(); } catch (e) { /* gone */ } }
  }
  // every network this PC is on, this PC itself (someone hosting here), and the plain broadcast
  static broadcasts() {
    const l = new Set(['255.255.255.255', '127.0.0.1']);
    for (const v of Object.values(os.networkInterfaces())) for (const a of v) if (a.family === 'IPv4' && !a.internal && a.netmask) { const ip = a.address.split('.').map(Number), m = a.netmask.split('.').map(Number); l.add(ip.map((n, i) => (n & m[i]) | (~m[i] & 255)).join('.')); }
    return [...l];
  }
  static localIPs() { const l = []; for (const v of Object.values(os.networkInterfaces())) for (const a of v) if (a.family === 'IPv4' && !a.internal) l.push(a.address); return l.length ? l : ['127.0.0.1']; }
}
module.exports = Net;
