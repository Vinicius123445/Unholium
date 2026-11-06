'use strict';
// Saves from the old build, once. The browser kept them in a LevelDB database; this reads a copy of it (the original is never opened, so the
// old build keeps working) and writes each entry as a storage file. Only entries of the game's own page, and only into an empty storage.
const fs = require('fs'), path = require('path');
const ORIGIN = Buffer.from('_https://game.local\x00\x01', 'latin1');
const value = (b) => { if (!b.length) return ''; return b[0] === 0 ? b.subarray(1).toString('utf16le') : b.subarray(1).toString('latin1'); };
async function importSaves(srcDir, dataDir) {
  const store = path.join(dataDir, 'storage'), tmp = path.join(dataDir, 'import_tmp');
  if (!fs.existsSync(srcDir)) return { imported: 0, why: 'no old saves' };
  fs.mkdirSync(store, { recursive: true });
  if (fs.readdirSync(store).some((f) => f.endsWith('.json'))) return { imported: 0, why: 'storage is not empty' };
  fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(srcDir, tmp, { recursive: true }); try { fs.unlinkSync(path.join(tmp, 'LOCK')); } catch (e) { /* none */ }
  const { ClassicLevel } = require('classic-level'), db = new ClassicLevel(tmp, { keyEncoding: 'buffer', valueEncoding: 'buffer', createIfMissing: false });
  await db.open(); const seen = []; let n = 0;
  for await (const [k, v] of db.iterator()) {
    if (k.length <= ORIGIN.length || !k.subarray(0, ORIGIN.length).equals(ORIGIN)) continue;
    const name = k.subarray(ORIGIN.length).toString('latin1'), f = path.join(store, encodeURIComponent(name).replace(/[*]/g, '%2A') + '.json');
    fs.writeFileSync(f, value(v)); seen.push(name); n++;
  }
  await db.close(); fs.rmSync(tmp, { recursive: true, force: true });
  return { imported: n, keys: seen };
}
module.exports = { importSaves };
