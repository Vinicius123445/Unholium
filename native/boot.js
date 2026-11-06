// What Unholium.exe runs first: everything else sits next to it.
const path = require('node:path'), { createRequire } = require('node:module');
const home = path.dirname(process.execPath);
process.env.UNHOLIUM_HOME = home;
if (process.argv.includes('--tool')) process.env.UNHOLIUM_TOOL = '1';
createRequire(path.join(home, 'app', 'native', 'boot.cjs'))(process.env.UNHOLIUM_TOOL ? './tool.js' : './main.js');
