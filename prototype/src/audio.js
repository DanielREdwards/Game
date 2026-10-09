// Áudio 100% sintetizado em tempo real (Web Audio): chuva, cidade, golpes e uma trilha mínima.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.intensity = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.out = ctx.createGain();
    this.out.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.out.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ambience();
    this.music();
  }

  toggle() {
    this.on = !this.on;
    if (this.ctx) this.out.gain.setTargetAtTime(this.on ? 0.85 : 0, this.ctx.currentTime, 0.05);
    return this.on;
  }

  noise(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  env(vol, a, d, when = 0) {
    const g = this.ctx.createGain(), t = this.ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }

  tone(type, f0, f1, dur, vol, when = 0, dest = this.out) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), t = this.ctx.currentTime + when;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    o.connect(this.env(vol, 0.004, dur, when)).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  burst(dur, vol, type, freq, q = 0.7, when = 0, dest = this.out) {
    if (!this.ctx) return;
    const s = this.noise(), t = this.ctx.currentTime + when;
    s.connect(this.filter(type, freq, q)).connect(this.env(vol, 0.003, dur, when)).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  ambience() {
    const ctx = this.ctx;
    const rain = this.noise(true);
    const rg = ctx.createGain();
    rg.gain.value = 0.1;
    rain.connect(this.filter('highpass', 600)).connect(this.filter('lowpass', 7500)).connect(rg).connect(this.out);
    rain.start();
    const hum = this.noise(true);
    hum.playbackRate.value = 0.5;
    const hg = ctx.createGain();
    hg.gain.value = 0.3;
    hum.connect(this.filter('lowpass', 130)).connect(hg).connect(this.out);
    hum.start(0, 0.7);
    const drip = () => {
      if (this.on) this.tone('sine', 1600 + Math.random() * 2600, 900, 0.05, 0.015 + Math.random() * 0.03);
      setTimeout(drip, 90 + Math.random() * 420);
    };
    drip();
  }

  // Trilha procedural: baixo pulsante em Lá menor + bumbo e chimbal que crescem com o combate.
  music() {
    const ctx = this.ctx;
    this.mus = ctx.createGain();
    this.mus.gain.value = 0.55;
    this.mus.connect(this.out);
    const bpm = 94, step = 60 / bpm / 2;
    const bass = [55, 0, 55, 0, 65.41, 0, 49, 55, 55, 0, 55, 0, 73.42, 0, 65.41, 49];
    let i = 0, next = ctx.currentTime + 0.1;
    const tick = () => {
      while (next < ctx.currentTime + 0.12) {
        const when = next - ctx.currentTime;
        const n = bass[i % bass.length];
        if (n) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = n;
          o.connect(this.filter('lowpass', 240 + this.intensity * 300, 4)).connect(this.env(0.12, 0.01, step * 1.6, when)).connect(this.mus);
          o.start(next);
          o.stop(next + step * 2);
        }
        if (this.intensity > 0.2) {
          if (i % 4 === 0) this.tone('sine', 120, 42, 0.22, 0.32 * this.intensity, when, this.mus);
          this.burst(0.03, (i % 2 ? 0.035 : 0.06) * this.intensity, 'highpass', 7000, 0.7, when, this.mus);
          if (i % 8 === 4) this.burst(0.12, 0.09 * this.intensity, 'bandpass', 1800, 0.8, when, this.mus);
        }
        next += step;
        i++;
      }
    };
    setInterval(tick, 25);
  }

  setIntensity(v) { this.intensity = v; }

  punch(heavy) {
    this.tone('sine', heavy ? 130 : 160, 42, heavy ? 0.22 : 0.13, heavy ? 0.9 : 0.6);
    this.burst(heavy ? 0.09 : 0.06, heavy ? 0.55 : 0.38, 'lowpass', heavy ? 1700 : 2600);
    this.burst(0.025, 0.22, 'highpass', 3200);
  }

  whoosh(heavy) {
    if (!this.ctx) return;
    const s = this.noise(), t = this.ctx.currentTime;
    const f = this.filter('bandpass', 500, 1.4);
    f.frequency.exponentialRampToValueAtTime(heavy ? 1900 : 2800, t + 0.16);
    s.connect(f).connect(this.env(heavy ? 0.16 : 0.1, 0.03, 0.16)).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.3);
  }

  counter() {
    this.tone('triangle', 1320, 1250, 0.32, 0.12);
    this.tone('triangle', 1980, 1900, 0.26, 0.07);
    this.burst(0.05, 0.3, 'highpass', 2500);
  }

  telegraph() { this.tone('square', 1480, 1480, 0.07, 0.025); }

  hurt() {
    this.tone('sine', 95, 38, 0.26, 0.8);
    this.burst(0.12, 0.3, 'lowpass', 900);
  }

  splash() {
    this.burst(0.32, 0.3, 'bandpass', 1500, 0.6);
    this.tone('sine', 75, 35, 0.3, 0.5);
  }

  boom() {
    this.tone('sine', 70, 26, 1.0, 1.0);
    this.burst(0.8, 0.45, 'lowpass', 600);
  }

  ui() { this.tone('sine', 880, 870, 0.06, 0.06); }
}
