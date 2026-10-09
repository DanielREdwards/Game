// Interface sobreposta (HTML): vida, determinação, arma na mão, onda, avisos, cartões de onda,
// faixas de cinema, pausa e telas. Mínima durante a exploração; volta com o combate.

const $ = (id) => document.getElementById(id);

const NEED = {
  finisher: 'Finalizar pede 3 de determinação',
  heal: 'Curar pede 2 de determinação',
  full: 'Vida cheia',
};

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), hpFill: $('hpFill'), hpGhost: $('hpGhost'), combo: $('combo'), comboNum: $('comboNum'),
      det: $('det'), foes: $('foeCount'), callout: $('callout'), calloutText: $('calloutText'), calloutCjk: $('calloutCjk'),
      toast: $('toast'), prompt: $('prompt'), title: $('title'), end: $('end'), pause: $('pause'),
      start: $('startBtn'), again: $('againBtn'), retry: $('retryBtn'), retry2: $('retryBtn2'), restart: $('restartBtn'),
      resume: $('resumeBtn'), cinema: $('cinemaBtn'), sound2: $('soundBtn2'), pauseTouch: $('pauseTouch'),
      endKicker: $('endKicker'), endTitle: $('endTitle'), stats: $('endStats'), sound: $('soundBtn'),
      boss: $('boss'), bossFill: $('bossFill'), weapon: $('weapon'), wCjk: $('wCjk'), wName: $('wName'), wUses: $('wUses'),
      waveCjk: $('waveCjk'), waveName: $('waveName'), card: $('card'), cardTitle: $('cardTitle'), cardZone: $('cardZone'), cardSub: $('cardSub'),
    };
    this.ghost = 1;
    this.hpV = 1;
    this.quietT = 0;
    this.promptKind = null;
  }

  ready(h) {
    const e = this.el;
    e.start.disabled = false;
    e.start.textContent = 'Jogar';
    e.start.addEventListener('click', h.start);
    e.again.addEventListener('click', h.again);
    e.retry.addEventListener('click', h.restart);
    e.retry2.addEventListener('click', h.retry);
    e.restart.addEventListener('click', h.restart);
    e.resume.addEventListener('click', h.resume);
    e.cinema.addEventListener('click', () => this.cinema(h.cinema()));
    for (const b of [e.sound, e.sound2]) b.addEventListener('click', () => this.sound(h.sound()));
    e.pauseTouch.addEventListener('click', h.pause);
    e.start.focus({ preventScroll: true });
  }

  sound(on) {
    for (const b of [this.el.sound, this.el.sound2]) {
      b.textContent = on ? 'Som: ligado' : 'Som: desligado';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  cinema(on) {
    this.el.cinema.textContent = on ? 'Cinema P&B: ligado' : 'Cinema P&B: desligado';
    this.el.cinema.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  showPlay() {
    const e = this.el;
    e.title.hidden = true;
    e.end.hidden = true;
    e.pause.hidden = true;
    e.hud.hidden = false;
    e.pauseTouch.hidden = !document.body.classList.contains('touch');
    document.body.classList.add('playing');
  }

  pause(on) {
    const e = this.el;
    e.pause.hidden = !on;
    document.body.classList.toggle('playing', !on);
    if (on) e.resume.focus({ preventScroll: true });
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

  // Determinação: losangos que enchem por frações; a finalização fica pronta com 3.
  det(v, max) {
    const pips = this.el.det.querySelectorAll('i');
    pips.forEach((p, i) => {
      const f = Math.max(0, Math.min(1, v - i));
      p.style.setProperty('--f', f.toFixed(2));
      p.classList.toggle('full', f >= 1);
    });
    this.el.det.classList.toggle('ready', v >= 3);
    this.el.det.setAttribute('aria-label', `Determinação ${v.toFixed(1)} de ${max}`);
  }

  weapon(w) {
    const e = this.el;
    if (!w) { e.weapon.hidden = true; return; }
    e.weapon.hidden = false;
    e.wCjk.textContent = w.cjk;
    e.wName.textContent = w.name;
    e.wUses.innerHTML = Array.from({ length: w.max }, (_, i) => `<i class="${i < w.uses ? '' : 'off'}"></i>`).join('');
  }

  boss(frac) {
    const b = this.el.boss;
    if (frac < 0) { b.hidden = true; return; }
    b.hidden = false;
    this.el.bossFill.style.transform = `scaleX(${frac})`;
    b.classList.toggle('down', frac <= 0);
  }

  foes(n) {
    this.el.foes.textContent = n;
  }

  // A lista de teclas some depois da primeira onda (continua na pausa).
  keys(on) {
    document.querySelector('#hud .keys').classList.toggle('gone', !on);
  }

  wave(i, total, zone) {
    const nums = ['一', '二', '三', '四'];
    this.el.waveCjk.textContent = `第${nums[i]}波`;
    this.el.waveName.textContent = `${zone.label} · onda ${i + 1} de ${total}`;
  }

  // Cartão caligráfico de abertura da onda.
  card(title, zoneCjk, label) {
    const e = this.el;
    e.cardTitle.textContent = title;
    e.cardZone.textContent = zoneCjk;
    e.cardSub.textContent = label;
    e.card.classList.remove('go');
    void e.card.offsetWidth;
    e.card.classList.add('go');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => e.card.classList.remove('go'), 2900);
  }

  letterbox(on) {
    this.el.hud.classList.toggle('on', on);
  }

  // Avisos de ação: 'duel' (confronto), 'duel-next', 'pickup' (com nome da arma) ou null.
  prompt(kind, extra) {
    const p = this.el.prompt;
    const key = kind + (extra || '');
    if (key === this.promptKind) return;
    this.promptKind = key;
    if (!kind) { p.hidden = true; p.className = ''; return; }
    const touch = document.body.classList.contains('touch');
    const K = (k, t) => (touch ? `<kbd>${t}</kbd>` : `<kbd>${k}</kbd>`);
    p.hidden = false;
    p.className = kind.startsWith('duel') ? 'duel' : '';
    if (kind === 'duel') p.innerHTML = `<span class="cjk">斬</span>Segure ${K('K', 'CONTRA')} para o confronto · ataque para recusar`;
    else if (kind === 'duel-next') p.innerHTML = `<span class="cjk">斬</span>Segure ${K('K', 'CONTRA')} de novo para o próximo`;
    else if (kind === 'pickup') p.innerHTML = `${K('E', 'PEGAR')} pegar ${extra}`;
    else if (kind === 'drop') p.innerHTML = `${K('E', 'PEGAR')} largar ${extra}`;
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('go');
    void t.offsetWidth;
    t.classList.add('go');
  }

  callout(text, tone = 'jade', cjk = '') {
    const c = this.el.callout;
    this.el.calloutText.textContent = text;
    this.el.calloutCjk.textContent = cjk;
    c.dataset.tone = tone;
    c.classList.remove('go');
    void c.offsetWidth;
    c.classList.add('go');
  }

  need(kind) {
    this.toast(NEED[kind] || '');
  }

  end(win, stats) {
    const e = this.el;
    e.endKicker.textContent = win ? 'Vitória' : 'Derrota';
    e.endTitle.textContent = win ? 'Mong Kok em paz' : 'Nocauteado';
    e.end.dataset.result = win ? 'win' : 'lose';
    const rows = [
      ['Tempo', `${stats.time.toFixed(1)} s`],
      ['Ondas', `${win ? 4 : stats.waves} de 4`],
      ['Combo máximo', `${stats.maxCombo}×`],
      ['Contra-ataques', `${stats.counters} (${stats.perfect} perfeitos)`],
      ['Confrontos vencidos', stats.duels],
      ['Rajadas esquivadas', stats.dodged],
      ['Golpes sofridos', stats.hitsTaken],
      ['Curas', stats.heals],
    ];
    e.stats.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    e.again.textContent = win ? 'Jogar de novo' : 'Tentar de novo';
    e.retry.hidden = win;
    e.hud.hidden = true;
    e.end.hidden = false;
    e.pauseTouch.hidden = true;
    document.body.classList.remove('playing');
    e.again.focus({ preventScroll: true });
  }

  // fighting: há combate ativo; a interface some aos poucos fora dele.
  update(dt, fighting) {
    this.ghost += (this.hpV - this.ghost) * (1 - Math.exp(-2.5 * dt));
    this.el.hpGhost.style.transform = `scaleX(${this.ghost})`;
    this.quietT = fighting ? 0 : this.quietT + dt;
    this.el.hud.classList.toggle('quiet', this.quietT > 3.5 && this.hpV > 0.3);
  }
}
