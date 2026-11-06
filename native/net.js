'use strict';
// Co-op networking: a tiny TCP server (the host) or client (a guest), the same protocol as the old C# host, so the two builds can even play
// together. Messages are single lines of JSON (UTF-8, newline-terminated). Nothing received is ever executed; lines over 1 MB end the peer.
const net = require('net'), os = require('os');
const MAX_GUESTS = 3, MAX_LINE = 1 << 20;
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
    s.listen(port, () => { this.post('net:hosting:' + port); this.post('net:ip:' + Net.localIPs().join(',')); });
  }
  join(ip, port) {
    this.stop();
    const c = this.client = net.connect({ host: ip, port });
    c.on('connect', () => { this.post('net:connected'); });
    let up = false; c.once('connect', () => { up = true; });
    c.on('error', (e) => { if (!up) this.post('net:error:' + clean(e.message)); });
    this.lines(c, (l) => this.post(`net:msg:0:${l}`), () => { if (up && this.client === c) this.post('net:closed'); });
  }
  send(json) {
    if (this.client) { try { this.client.write(json + '\n'); } catch (e) { this.post('net:closed'); } return; }
    for (const s of this.peers.values()) { try { s.write(json + '\n'); } catch (e) { /* its close event drops it */ } }
  }
  sendTo(id, json) { const s = this.peers.get(id); if (s) { try { s.write(json + '\n'); } catch (e) { /* its close event drops it */ } } }
  drop(id) { const s = this.peers.get(id); if (!s) return; this.peers.delete(id); try { s.destroy(); } catch (e) { /* gone */ } this.post('net:leave:' + id); }
  stop() {
    if (this.server) { try { this.server.close(); } catch (e) { /* not listening */ } this.server = null; }
    const all = [...this.peers.values()]; this.peers.clear(); for (const s of all) { try { s.destroy(); } catch (e) { /* gone */ } }
    if (this.client) { const c = this.client; this.client = null; try { c.destroy(); } catch (e) { /* gone */ } }
  }
  static localIPs() { const l = []; for (const v of Object.values(os.networkInterfaces())) for (const a of v) if (a.family === 'IPv4' && !a.internal) l.push(a.address); return l.length ? l : ['127.0.0.1']; }
}
module.exports = Net;
