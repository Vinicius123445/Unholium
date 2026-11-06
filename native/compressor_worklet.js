// The dynamics compressor the browser uses (the Blink/WebKit kernel), so the game's mix comes out the way it was balanced.
const db2l = (d) => Math.pow(10, 0.05 * d), l2db = (x) => 20 * Math.log10(x);
class Compressor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }
  constructor(o) {
    super();
    const p = o.processorOptions || {}, sr = sampleRate;
    this.th = p.threshold; this.knee = p.knee; this.ratio = p.ratio; this.attack = p.attack; this.release = p.release;
    this.size = 1024; this.delay = [new Float32Array(1024), new Float32Array(1024)]; this.w = 0; this.r = (this.size - Math.round(0.006 * sr)) & 1023;
    this.det = 0; this.gain = 1; this.maxAtt = -1; this.pos = 0; this.env = 1; this.want = 1;
    this.setup(sr);
    this.port.onmessage = (e) => { Object.assign(this, e.data); this.setup(sr); };
  }
  curve(x, k) { return x < this.lin ? x : this.lin + (1 - Math.exp(-k * (x - this.lin))) / k; }
  sat(x, k) { if (x < this.kt) return this.curve(x, k); const d = l2db(x); return db2l(this.ykt + this.slope * (d - this.ktdb)); }
  slopeAt(x, k) { if (x < this.lin) return 1; const x2 = x * 1.001, d = l2db(x), d2 = l2db(x2), y = l2db(this.curve(x, k)), y2 = l2db(this.curve(x2, k)); return (y2 - y) / (d2 - d); }
  setup(sr) {
    this.lin = db2l(this.th); this.slope = 1 / this.ratio;
    const xd = this.th + this.knee, x = db2l(xd); let lo = 0.1, hi = 10000, k = 5;
    for (let i = 0; i < 15; i++) { if (this.slopeAt(x, k) < this.slope) hi = k; else lo = k; k = Math.sqrt(lo * hi); }
    this.k = k; this.kt = x; this.ktdb = xd; this.ykt = l2db(this.curve(x, k));
    const full = this.sat(1, k), makeup = Math.pow(1 / full, 0.6); this.master = makeup;
    this.attF = Math.max(0.001, this.attack) * sr; const R = sr * this.release; this.satF = 0.0025 * sr;
    const y = [0.09, 0.16, 0.42, 0.98].map((z) => R * z);
    this.A = 0.9999999999999998 * y[0] + 1.8432219684323923e-16 * y[1] - 1.9373394351676423e-16 * y[2] + 8.824516011816245e-18 * y[3];
    this.B = -1.5788320352845888 * y[0] + 2.3305837032074286 * y[1] - 0.9141194204840429 * y[2] + 0.1623677525612032 * y[3];
    this.C = 0.5334142869106424 * y[0] - 1.272736789213631 * y[1] + 0.9258856042207512 * y[2] - 0.18656310191776226 * y[3];
    this.D = 0.08783463138207234 * y[0] - 0.1694162967925622 * y[1] + 0.08588057951595272 * y[2] - 0.00429891410546283 * y[3];
    this.E = -0.042416883008123074 * y[0] + 0.1115693827987602 * y[1] - 0.09764676325265872 * y[2] + 0.028494263462021576 * y[3];
  }
  division() {
    const want = Math.asin(this.det) / (Math.PI / 2); let diff = l2db(this.gain / want), rate;
    if (want > this.gain) {
      this.maxAtt = -1; if (!Number.isFinite(diff)) diff = -1;
      let x = Math.max(-12, Math.min(0, diff)); x = 0.25 * (x + 12); const x2 = x * x, x3 = x2 * x, x4 = x2 * x2, rf = this.A + this.B * x + this.C * x2 + this.D * x3 + this.E * x4;
      rate = db2l(5 / rf);
    } else {
      if (!Number.isFinite(diff) || diff <= 0) diff = 1;   // (attacking: the difference is positive)
      if (this.maxAtt === -1 || this.maxAtt < diff) this.maxAtt = diff;
      rate = 1 - Math.pow(0.25 / Math.max(0.5, this.maxAtt), 1 / this.attF);
    }
    this.env = rate; this.want = want;
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0], n = out[0].length, L = inp[0], Rr = inp[1] || inp[0];
    const outL = out[0], outR = out[1] || out[0], dl = this.delay[0], dr = this.delay[1];
    for (let i = 0; i < n; i++) {
      if (this.pos === 0) this.division();
      const a = L ? L[i] : 0, b = Rr ? Rr[i] : 0; dl[this.w] = a; dr[this.w] = b;
      const abs = Math.max(Math.abs(a), Math.abs(b)), att = abs < 0.0001 ? 1 : this.sat(abs, this.k) / abs, dbA = Math.max(2, -l2db(att)), sr = db2l(dbA / this.satF) - 1, rt = att > this.det ? sr : 1;
      this.det = Math.min(1, this.det + (att - this.det) * rt);
      if (this.env < 1) this.gain += (this.want - this.gain) * this.env; else this.gain = Math.min(1, this.gain * this.env);
      const tot = this.master * Math.sin(Math.PI / 2 * this.gain);
      outL[i] = dl[this.r] * tot; outR[i] = dr[this.r] * tot;
      this.w = (this.w + 1) & 1023; this.r = (this.r + 1) & 1023; this.pos = (this.pos + 1) & 31;
    }
    return true;
  }
}
registerProcessor('unholium-compressor', Compressor);
