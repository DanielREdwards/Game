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

  // Disparo: estalo seco, corpo grave e um eco curto entre os prédios.
  gunshot(auto) {
    this.burst(0.07, auto ? 0.5 : 0.65, 'highpass', 1000);
    this.burst(0.16, auto ? 0.32 : 0.42, 'lowpass', 2400);
    this.tone('square', 240, 70, 0.04, 0.18);
    this.tone('sine', 130, 40, 0.14, auto ? 0.45 : 0.6);
    this.burst(0.32, 0.08, 'bandpass', 900, 0.8, 0.11);
  }

  // Ferrolho/cão sendo armado: aviso sonoro do disparo.
  cock() {
    this.burst(0.03, 0.22, 'highpass', 3000);
    this.burst(0.03, 0.2, 'bandpass', 1800, 2, 0.09);
  }

  ui() { this.tone('sine', 880, 870, 0.06, 0.06); }

  // ---------------------------------------------------------- determinação, cura e armas do chão

  ready() {
    this.tone('sine', 1046, 1040, 0.5, 0.07);
    this.tone('sine', 1568, 1560, 0.6, 0.05, 0.08);
  }

  focus() {
    if (!this.ctx) return;
    const s = this.noise(), t = this.ctx.currentTime;
    const f = this.filter('bandpass', 400, 0.8);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.7);
  }

  healed() {
    for (const [f, w] of [[523, 0], [784, 0.06], [1046, 0.12]]) this.tone('sine', f, f * 0.995, 0.7, 0.06, w);
    this.tone('sine', 98, 96, 0.6, 0.2);
  }

  pickup() {
    this.burst(0.04, 0.16, 'bandpass', 2400, 1.5);
    this.tone('triangle', 420, 380, 0.08, 0.06);
  }

  weaponHit(kind) {
    if (kind === 'glass') this.tone('triangle', 2200, 1900, 0.12, 0.08);
    else if (kind === 'wood') { this.tone('sine', 190, 90, 0.12, 0.55); this.burst(0.06, 0.3, 'bandpass', 900, 1.2); }
    else { this.tone('square', 640, 600, 0.18, 0.06); this.tone('sine', 1720, 1700, 0.35, 0.05); this.tone('sine', 150, 50, 0.15, 0.55); }
  }

  weaponBreak(kind) {
    if (kind === 'glass') {
      this.burst(0.35, 0.5, 'highpass', 3500);
      for (let i = 0; i < 7; i++) this.tone('sine', 2600 + Math.random() * 3200, 2400, 0.08 + Math.random() * 0.1, 0.05, i * 0.025);
    } else if (kind === 'wood') {
      this.burst(0.18, 0.55, 'bandpass', 700, 0.9);
      this.burst(0.06, 0.35, 'highpass', 2200, 0.7, 0.05);
    } else {
      this.tone('sine', 980, 940, 0.9, 0.08);
      this.tone('sine', 1390, 1350, 0.7, 0.05);
      this.burst(0.1, 0.25, 'bandpass', 3000, 2);
    }
  }

  // ---------------------------------------------------------- ondas e confronto

  // Tambor grave em três batidas (abertura de onda).
  drum() {
    for (const [w, v] of [[0, 0.9], [0.32, 0.6], [0.5, 1.0]]) {
      this.tone('sine', 110, 38, 0.6, v, w);
      this.burst(0.08, 0.25 * v, 'lowpass', 500, 0.7, w);
    }
  }

  // Gongo ao vencer uma onda.
  gong() {
    for (const [f, v] of [[196, 0.22], [293.7, 0.1], [415, 0.07], [622, 0.04]]) this.tone('sine', f, f * 0.98, 2.6, v);
    this.burst(0.5, 0.06, 'bandpass', 1200, 0.6);
  }

  // Rajada de vento (vento-guia e confronto).
  gust(vol = 0.12) {
    if (!this.ctx) return;
    const s = this.noise(), t = this.ctx.currentTime;
    const f = this.filter('bandpass', 300, 0.6);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
    f.frequency.exponentialRampToValueAtTime(380, t + 2.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 2.5);
  }

  // Tensão do confronto: zumbido grave que cresce até o golpe; a trilha se cala.
  tension(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.mus.gain.setTargetAtTime(on ? 0.0 : 0.55, t, 0.4);
    if (on && !this.ten) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 55;
      o2.type = 'sine'; o2.frequency.value = 55.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 2.5);
      o.connect(g); o2.connect(g); g.connect(this.out);
      o.start(); o2.start();
      this.ten = { o, o2, g };
    } else if (!on && this.ten) {
      const { o, o2, g } = this.ten;
      g.gain.setTargetAtTime(0.0001, t, 0.15);
      o.stop(t + 0.8); o2.stop(t + 0.8);
      this.ten = null;
    }
  }

  glint() {
    this.tone('sine', 2637, 2630, 0.5, 0.09);
    this.tone('sine', 3951, 3940, 0.4, 0.05, 0.02);
  }

  feint() {
    this.burst(0.06, 0.18, 'lowpass', 900);
    this.tone('sine', 90, 60, 0.1, 0.25);
  }

  slash() {
    if (!this.ctx) return;
    const s = this.noise(), t = this.ctx.currentTime;
    const f = this.filter('bandpass', 1200, 2);
    f.frequency.exponentialRampToValueAtTime(5200, t + 0.12);
    s.connect(f).connect(this.env(0.35, 0.005, 0.18)).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + 0.3);
    this.tone('sine', 140, 40, 0.3, 0.8, 0.02);
  }
}
