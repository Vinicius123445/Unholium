'use strict';
// AI dialogue: the game builds each request and this sends it. The Claude API key lives only here: the game hands it over once, it is stored
// encrypted for the current Windows user (DPAPI, as the C# host did, so the existing key file still opens) and is never sent back to the game.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages', API_VERSION = '2026-10-21';
const clean = (s) => String(s || '').replace(/[\r\n]/g, ' ');
const baseOf = (u) => { try { return new URL(u).origin; } catch (e) { return 'http://localhost:11434'; } };
// DPAPI
let dpapi = null;
try {
  const koffi = require('koffi'), crypt = koffi.load('crypt32.dll'), kernel = koffi.load('kernel32.dll');
  koffi.struct('DATA_BLOB', { cbData: 'uint32', pbData: 'void *' });
  const P = crypt.func('bool __stdcall CryptProtectData(DATA_BLOB *pIn, const char16_t *desc, void *entropy, void *r, void *ps, uint32 flags, _Out_ DATA_BLOB *pOut)');
  const U = crypt.func('bool __stdcall CryptUnprotectData(DATA_BLOB *pIn, void *desc, void *entropy, void *r, void *ps, uint32 flags, _Out_ DATA_BLOB *pOut)');
  const free = kernel.func('void * __stdcall LocalFree(void *)');
  const run = (fn, buf, ...a) => { const inb = { cbData: buf.length, pbData: buf }, out = {}; if (!fn(inb, ...a, null, null, null, 0, out)) throw new Error('DPAPI failed'); const r = Buffer.from(koffi.view(out.pbData, out.cbData)); free(out.pbData); return r; };
  dpapi = { protect: (b) => run(P, b, null), unprotect: (b) => run(U, b, null) };
} catch (e) { console.log('no DPAPI:', e.message); }

class Ai {
  constructor(post, dataDir) {
    this.post = post; this.key = null; this.localUrl = 'http://localhost:11434/v1/chat/completions';
    this.keyFile = path.join(dataDir, 'ai.key');
    // the key the old build stored: read where it is, never moved
    const old = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Unholium', 'ai.key') : null;
    for (const f of [this.keyFile, old]) { if (!f || this.key) continue; try { if (fs.existsSync(f) && dpapi) this.key = dpapi.unprotect(fs.readFileSync(f)).toString('utf8'); } catch (e) { /* not readable */ } }
  }
  command(cmd) {
    try {
      if (cmd === 'status') this.status();
      else if (cmd.startsWith('key:')) this.setKey(cmd.slice(4).trim());
      else if (cmd.startsWith('localurl:')) { const u = cmd.slice(9).trim(); if (/^https?:\/\//.test(u)) this.localUrl = u; }
      else if (cmd.startsWith('ask:')) this.ask(cmd.slice(4));
      else if (cmd === 'local') this.local();
    } catch (e) { this.post('ai:error:' + clean(e.message)); }
  }
  status() { this.post('ai:keystatus:' + (this.key ? '1' : '0')); }
  setKey(k) {
    this.key = k || null;
    try { if (!this.key) { if (fs.existsSync(this.keyFile)) fs.unlinkSync(this.keyFile); } else if (dpapi) fs.writeFileSync(this.keyFile, dpapi.protect(Buffer.from(this.key, 'utf8'))); } catch (e) { /* kept for this session */ }
    this.status();
  }
  // ask:<id>:<provider>:<timeout>:<body>
  async ask(rest) {
    const i1 = rest.indexOf(':'), i2 = rest.indexOf(':', i1 + 1), i3 = rest.indexOf(':', i2 + 1); if (i3 < 0) return;
    const id = rest.slice(0, i1), provider = rest.slice(i1 + 1, i2), body = rest.slice(i3 + 1); let timeout = parseInt(rest.slice(i2 + 1, i3), 10); if (!timeout) timeout = 8000;
    timeout = Math.max(1000, Math.min(300000, timeout));   // (up to 5 minutes: the first load of a local model)
    const claude = provider === 'claude';
    if (claude && !this.key) { this.post(`ai:reply:${id}:0:no key`); return; }
    const url = claude ? CLAUDE_URL : provider === 'ollama' ? baseOf(this.localUrl) + '/api/chat' : this.localUrl;
    const headers = { 'content-type': 'application/json' }; if (claude) { headers['x-api-key'] = this.key; headers['anthropic-version'] = API_VERSION; }
    let status = 0, text;
    try { const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeout) }); status = r.status; text = await r.text(); } catch (e) { text = e.message; }
    this.post(`ai:reply:${id}:${status}:${text}`);
  }
  async get(url, ms) { try { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); return r.ok ? await r.text() : null; } catch (e) { return null; } }
  // is the local server up? If not and it is Ollama on this machine, start it hidden, then list its models
  async local() {
    const base = baseOf(this.localUrl); let tags = await this.get(base + '/api/tags', 2500);
    if (tags == null && this.startOllama()) for (let i = 0; i < 20 && tags == null; i++) { await new Promise((r) => setTimeout(r, 500)); tags = await this.get(base + '/api/tags', 2000); }
    const names = (json, key) => { try { const o = JSON.parse(json), l = o.models || o.data || []; return JSON.stringify(l.map((m) => m[key]).filter(Boolean)); } catch (e) { return '[]'; } };
    if (tags == null) { const v1 = await this.get(base + '/v1/models', 2500); if (v1 == null) { this.post('ai:localstatus:0'); return; } this.post('ai:models:' + names(v1, 'id')); return; }
    this.post('ai:models:' + names(tags, 'name'));
  }
  startOllama() {
    const exe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'); if (!fs.existsSync(exe)) return false;
    try { spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); return true; } catch (e) { return false; }
  }
}
module.exports = Ai;
