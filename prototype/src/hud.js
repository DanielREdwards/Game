// Interface sobreposta (HTML): vida, combo, medidor de finalização, avisos e telas.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), hpFill: $('hpFill'), hpGhost: $('hpGhost'), combo: $('combo'), comboNum: $('comboNum'),
      meter: $('meter'), foes: $('foeCount'), callout: $('callout'), title: $('title'), end: $('end'),
      start: $('startBtn'), again: $('againBtn'), endKicker: $('endKicker'), endTitle: $('endTitle'),
      stats: $('endStats'), sound: $('soundBtn'), boss: $('boss'), bossFill: $('bossFill'),
    };
    this.ghost = 1;
    this.hpV = 1;
    this.calloutTimer = 0;
  }

  ready(onStart, onAgain, onSound) {
    const s = this.el.start;
    s.disabled = false;
    s.textContent = 'Jogar';
    s.addEventListener('click', onStart);
    this.el.again.addEventListener('click', onAgain);
    this.el.sound.addEventListener('click', () => this.sound(onSound()));
    s.focus({ preventScroll: true });
  }

  sound(on) {
    this.el.sound.textContent = on ? 'Som: ligado' : 'Som: desligado';
    this.el.sound.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  showPlay() {
    this.el.title.hidden = true;
    this.el.end.hidden = true;
    this.el.hud.hidden = false;
    document.body.classList.add('playing');
  }

  hp(frac) {
    this.hpV = frac;
    this.el.hpFill.style.transform = `scaleX(${frac})`;
    this.el.hud.classList.toggle('low', frac < 0.3);
  }

  combo(n) {
    const c = this.el.combo;
    if (n < 2) { c.classList.remove('show'); return; }
    this.el.comboNum.textContent = n;
    c.classList.add('show');
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
  }

  meter(n, max) {
    const pips = this.el.meter.querySelectorAll('i');
    pips.forEach((p, i) => p.classList.toggle('on', i < n));
    this.el.meter.classList.toggle('ready', n >= max);
  }

  boss(frac) {
    this.el.bossFill.style.transform = `scaleX(${frac})`;
    this.el.boss.classList.toggle('down', frac <= 0);
  }

  foes(n) {
    this.el.foes.textContent = n;
  }

  callout(text, tone = 'jade') {
    const c = this.el.callout;
    c.textContent = text;
    c.dataset.tone = tone;
    c.classList.remove('go');
    void c.offsetWidth;
    c.classList.add('go');
  }

  end(win, stats) {
    const e = this.el;
    e.endKicker.textContent = win ? 'Vitória' : 'Derrota';
    e.endTitle.textContent = win ? 'Beco limpo' : 'Nocauteado';
    e.end.dataset.result = win ? 'win' : 'lose';
    const rows = [
      ['Tempo', `${stats.time.toFixed(1)} s`],
      ['Combo máximo', `${stats.maxCombo}×`],
      ['Contra-ataques', stats.counters],
      ['Rajadas esquivadas', stats.dodged],
      ['Golpes sofridos', stats.hitsTaken],
    ];
    e.stats.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    e.hud.hidden = true;
    e.end.hidden = false;
    document.body.classList.remove('playing');
    e.again.focus({ preventScroll: true });
  }

  update(dt) {
    this.ghost += (this.hpV - this.ghost) * (1 - Math.exp(-2.5 * dt));
    this.el.hpGhost.style.transform = `scaleX(${this.ghost})`;
  }
}
