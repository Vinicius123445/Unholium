const R = require('./runtime'), fs = require('fs'); process.on('uncaughtException', (e) => console.log(e.stack));
globalThis.__mode = process.env.MODE || '';
R.loadGame(); R.runFile('D:/Unholium_native/poc/audiotest.js');
PocAudio(globalThis.OfflineAudioContext, (o) => { fs.writeFileSync(`D:/Unholium_native/poc/out/audio_native${process.env.MODE || ''}.json`, JSON.stringify(o)); console.log('done', Object.keys(o).length); process.exit(0); }).catch((e) => { console.log(e.stack); process.exit(1); });
