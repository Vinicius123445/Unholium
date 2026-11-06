// Every sound effect rendered to numbers in each build: loudness over time and how bright it is, so sound can be compared without ears.
globalThis.PocAudio = async function (Offline, report) {
  const A = G.audio, names = Object.keys(A.SFX).sort(), out = {}, SR = 44100, LEN = 2;
  G.settings.data.volumeMaster = 1;
  for (const n of names) {
    let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const hold = window.AudioContext; window.AudioContext = function () { const o = new Offline(2, SR * LEN, SR), q = globalThis.__mode || ""; if (q.includes("c")) o.createDynamicsCompressor = () => { const g = o.createGain(); for (const k of ["threshold", "knee", "ratio", "attack", "release"]) g[k] = { value: 0 }; return g; }; if (q.includes("v")) o.createConvolver = () => { const g = o.createGain(); g.gain.value = 0; return g; }; return o; };
    A.ctx = null; A._lastPlay = {}; if (A._timer) clearInterval(A._timer);
    try {
      A.unlock(); if (A._timer) clearInterval(A._timer);
      const c = A.ctx; if (!c) { out[n] = 'noctx'; continue; }
      if (c._cwAll) await Promise.all(c._cwAll); A.play(n, {}); const b = await c.startRendering(), d = b.getChannelData(0), e = b.getChannelData(1), env = []; let z = 0, sum = 0;
      for (let i = 0; i < d.length; i += 2205) { let s = 0; for (let j = i; j < i + 2205 && j < d.length; j++) s += d[j] * d[j] + e[j] * e[j]; env.push(+Math.sqrt(s / 4410).toFixed(4)); sum += s; }
      for (let i = 1; i < d.length; i++) if ((d[i] >= 0) !== (d[i - 1] >= 0)) z++;
      out[n] = { rms: +Math.sqrt(sum / (2 * d.length)).toFixed(5), zc: z, env };
    } catch (err) { out[n] = 'ERR ' + err.message; }
    window.AudioContext = hold;
  }
  report(out);
};
