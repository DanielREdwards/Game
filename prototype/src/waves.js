// Sistema de ondas (especificação de combate, seção 14): quatro ondas, uma por zona do mapa, com
// cartão caligráfico de abertura, confronto opcional, vento-guia até a zona seguinte e "tentar de novo"
// a partir do início da onda atual.
import { Enemy } from './enemy.js';
import { ZONES, inRect } from './map.js';
import { flatDist } from './util.js';

// [tipo, posição inicial, posição de chegada]
export const WAVES = [
  {
    zone: 'alley', title: '第一波', start: { pos: [0, 0, 7.5], yaw: Math.PI },
    enemies: [
      ['soldato', [-3.5, 0, -6], [-2.6, 0, 0.4]], ['soldato2', [3.2, 0, -6.2], [2.8, 0, 0.6]],
      ['piper', [0.6, 0, -7], [0.4, 0, -1.6]], ['soldato', [-5.5, 0, -2.5], [-4.2, 0, 2.8]],
    ],
    duel: false, wind: [0, 19.5],
  },
  {
    zone: 'street', title: '第二波', trigger: (p) => p.z > 18.6 && p.x > -18 && p.x < 16, start: { pos: [0, 0, 20.5], yaw: 0 },
    enemies: [
      ['soldato', [-27, 0, 22.5], [-7.8, 0, 22.5]], ['piper', [-28, 0, 26.5], [-6.6, 0, 26.8]],
      ['soldato2', [24, 0, 23.0], [7.8, 0, 22.8]], ['piper', [25, 0, 27.0], [6.8, 0, 27.0]],
      ['brute', [0.5, 0, 30.6], [0.2, 0, 28.4]],
    ],
    duel: true, wind: [16, 24],
  },
  {
    zone: 'market', title: '第三波', trigger: (p) => p.x > 15.5 && p.z > 16.8, start: { pos: [17.5, 0, 23.8], yaw: Math.PI / 2 },
    enemies: [
      ['soldato', [27, 0, 20.2], [24.2, 0, 21.0]], ['soldato2', [27.5, 0, 27.6], [24.6, 0, 26.6]], ['piper', [30, 0, 23.8], [25.6, 0, 23.8]],
      ['moretti', [40, 0, 21.5], [31.5, 0, 21.8]], ['ricci', [41, 0, 26.5], [32.5, 0, 26.2]],
    ],
    duel: true, wind: [-39, 16.4],
  },
  {
    zone: 'temple', title: '第四波', trigger: (p) => inRect(ZONES.temple, p.x, p.z) && p.z < 15.4, start: { pos: [-39, 0, 14.8], yaw: Math.PI },
    enemies: [
      ['soldato2', [-41.5, 0, 3.6], [-41.4, 0, 8.4]], ['piper', [-36.5, 0, 3.6], [-36.6, 0, 8.6]],
      ['vittore', [-39, 0, 3.4], [-39, 0, 5.4]],
    ],
    duel: true, boss: 'vittore', wind: null,
  },
];

export class Waves {
  constructor(game) {
    this.game = game;
    this.i = -1;
    this.state = 'idle';
    this.list = [];
    this.old = [];
  }

  get wave() { return WAVES[this.i]; }
  get zone() { return this.wave ? ZONES[this.wave.zone] : null; }

  reset() {
    for (const e of [...this.list, ...this.old]) e.dispose();
    this.list = [];
    this.old = [];
    this.game.enemies = [];
    this.i = -1;
    this.state = 'idle';
  }

  // Começa a onda n (0..3). retry: recomeço da mesma onda (vida cheia e 2 de determinação).
  begin(n, retry = false) {
    const g = this.game;
    this.i = n;
    const W = this.wave;
    for (const e of this.old) e.dispose();
    this.old = this.list.filter((e) => !retry);
    if (retry) for (const e of this.list) e.dispose();
    this.list = [];
    if (retry || n === 0) {
      const s = W.start;
      g.player.reset(s.pos, s.yaw, g.player.maxHp, retry ? 2 : 0);
      g.cam.yaw = s.yaw + Math.PI;
      g.cam.focus.set(s.pos[0], 1.15, s.pos[2]);
    }
    W.enemies.forEach(([kind, spawn, goal], i) => {
      const soldier = !['vittore', 'moretti', 'ricci'].includes(kind);
      this.list.push(new Enemy(g, kind, spawn, { index: i, goal, duel: W.duel && soldier }));
    });
    g.enemies = [...this.old, ...this.list];
    g.fighting = false;
    g.wind.guide(null);
    this.state = 'card';
    this.t = 0;
    this.checkpoint = { n };
    g.hud.wave(n, WAVES.length, ZONES[W.zone]);
    g.hud.keys(n === 0);
    g.hud.card(W.title, ZONES[W.zone].name, ZONES[W.zone].label);
    g.hud.letterbox(true);
    g.hud.boss(W.boss ? 1 : -1);
    g.sfx.drum();
    g.stats.waves = n;
    this.updateFoes();
  }

  alive() { return this.list.filter((e) => e.hp > 0); }

  updateFoes() { this.game.hud.foes(this.alive().length); }

  onDown() {
    this.updateFoes();
    if (this.state === 'fight' || this.state === 'offer' || this.state === 'duel') {
      if (this.alive().length === 0) this.clear();
    }
  }

  // Começa a luta (atacar recusa o confronto).
  engage() {
    if (this.state === 'offer' || this.state === 'card') this.fight();
  }

  fight() {
    const g = this.game;
    this.state = 'fight';
    g.fighting = true;
    g.director.reset();
    g.standoff.cancel();
    g.hud.letterbox(false);
    g.hud.prompt(null);
    for (const e of this.list) e.engage();
  }

  clear() {
    const g = this.game, W = this.wave;
    g.fighting = false;
    this.state = 'cleared';
    this.t = 0;
    g.sfx.gong();
    g.player.heal(25);
    g.player.gainDet(1);
    g.hud.boss(-1);
    if (this.i >= WAVES.length - 1) {
      g.onVictory();
      return;
    }
    g.hud.callout('Onda vencida', 'jade', '勝');
    g.hud.toast('+25 de vida · +1 de determinação');
    if (W.wind) {
      g.wind.guide(W.wind);
      g.sfx.gust(0.16);
      this.gustT = 6;
    }
  }

  update(dt) {
    const g = this.game, pl = g.player;
    this.t += dt;
    switch (this.state) {
      case 'card':
        // o cartão fica ~2,4 s; os inimigos caminham até suas posições
        if (this.t > 2.4) {
          if (this.wave.duel && this.list.some((e) => e.waitDuel && e.hp > 0)) {
            this.state = 'offer';
            this.t = 0;
            g.hud.prompt('duel');
            g.sfx.tension(true);
            g.sfx.gust(0.1);
          } else this.fight();
        }
        break;
      case 'offer':
        // espera a escolha: segurar CONTRA aceita o confronto; atacar recusa
        if (g.input.held('counter') && pl.state === 'move' && this.ready()) {
          this.state = 'duel';
          g.hud.prompt(null);
          g.standoff.start(this.list.filter((e) => e.waitDuel && e.hp > 0));
        } else if (this.t > 14) this.fight();
        break;
      case 'duel':
        if (g.standoff.done) this.fight();
        break;
      case 'cleared':
        if (this.t > 2.5 && !this.hinted && this.wave.wind) {
          this.hinted = true;
          g.hud.toast('Siga o vento');
        }
        if (this.gustT !== undefined && (this.gustT -= dt) <= 0) { this.gustT = 7; g.sfx.gust(0.1); }
        {
          const next = WAVES[this.i + 1];
          if (next && next.trigger(pl.pos)) {
            this.hinted = false;
            this.begin(this.i + 1);
          }
        }
        break;
    }
    // fim do vento perto da zona seguinte
    if (this.state !== 'cleared' && g.wind.target) g.wind.guide(null);
  }

  // Só aceita o confronto quando os soldados já chegaram e esperam.
  ready() {
    return this.list.some((e) => e.state === 'standby');
  }

  nearestZoneCenter() {
    const z = this.zone;
    return z ? z.center : [0, 0];
  }

  distanceTo(p) {
    const c = this.nearestZoneCenter();
    return flatDist(p, { x: c[0], z: c[1] });
  }
}
