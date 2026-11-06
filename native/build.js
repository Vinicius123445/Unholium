'use strict';
// Builds the native game into D:\Unholium_native\dist. node native\build.js
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const R = path.join(__dirname, '..'), dist = path.join(R, 'dist'), app = path.join(dist, 'app'), node = process.execPath;
fs.mkdirSync(dist, { recursive: true });
for (const f of ['Unholium.exe', 'Unholium Creation Tool.exe']) { const p = path.join(dist, f); try { fs.rmSync(p, { force: true }); } catch (e) { throw new Error(`${f} is running: close it first`); } }
fs.rmSync(app, { recursive: true, force: true }); fs.mkdirSync(path.join(app, 'native'), { recursive: true });
for (const d of ['worlds', 'wallpapers', 'data']) fs.mkdirSync(path.join(dist, d), { recursive: true });
// the game, exactly as it is, without the test harness
fs.cpSync(path.join(R, 'js'), path.join(app, 'js'), { recursive: true }); fs.rmSync(path.join(app, 'js', 'test.js'), { force: true });

for (const f of ['runtime.js', 'main.js', 'net.js', 'ai.js', 'migrate.js', 'compressor_worklet.js', 'tool.js', 'ui.js']) fs.copyFileSync(path.join(__dirname, f), path.join(app, 'native', f));
fs.cpSync(path.join(R, 'editor'), path.join(app, 'editor'), { recursive: true });
fs.copyFileSync(path.join(R, 'tools', 'sdl', 'SDL3.dll'), path.join(app, 'native', 'SDL3.dll'));
// libraries: only what runs on 64-bit Windows
const skip = /(?:[\/.\-_+](?:darwin|linux|android|freebsd|openbsd|ios|arm64|musl|armv7|ia32)(?=[\/.\-_+]|$)|\.map$|\.md$|\.ts$|CHANGELOG|classic-level\/deps\/|\/tests?\/|\/examples?\/|\/docs?\/)/;
fs.cpSync(path.join(__dirname, 'node_modules'), path.join(app, 'native', 'node_modules'), { recursive: true, filter: (s) => !skip.test(s.replace(/\\/g, '/').split('node_modules').slice(1).join('node_modules')) });
// each exe: Node with its start file inside it, as a Windows program (no console), with the game's icon
const b = path.join(R, 'tools', 'tmp', 'sea'); fs.mkdirSync(b, { recursive: true });
const rc = path.join(__dirname, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
const makeExe = (name, title, tool) => {
  const exe = path.join(dist, name), cfg = path.join(b, 'sea.json'), start = path.join(b, tool ? 'boot_tool.js' : 'boot_game.js');
  fs.writeFileSync(start, fs.readFileSync(path.join(__dirname, 'boot.js'), 'utf8').replace("process.argv.includes('--tool')", String(!!tool)));
  fs.writeFileSync(cfg, JSON.stringify({ main: start, output: exe, disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }));
  execFileSync(node, ['--build-sea', cfg], { stdio: 'inherit' });
  const buf = fs.readFileSync(exe), pe = buf.readUInt32LE(0x3C); if (buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('not a PE file');
  buf.writeUInt16LE(2, pe + 0x5C); fs.writeFileSync(exe, buf);   // 2: Windows GUI
  if (fs.existsSync(rc)) execFileSync(rc, [exe, '--set-icon', path.join(R, 'tools', 'icon.ico'), '--set-version-string', 'FileDescription', title, '--set-version-string', 'ProductName', title, '--set-file-version', '0.3.0', '--set-product-version', '0.3.0'], { stdio: 'inherit' });
};
makeExe('Unholium.exe', 'Unholium', false); makeExe('Unholium Creation Tool.exe', 'Unholium Creation Tool', true);
const exe = path.join(dist, 'Unholium.exe');
let total = 0; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else total += fs.statSync(f).size; } }; walk(dist);
console.log(`built ${exe}, ${(fs.statSync(exe).size / 1048576).toFixed(0)} MB; whole folder ${(total / 1048576).toFixed(0)} MB`);
