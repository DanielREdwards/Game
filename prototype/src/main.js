// Ponto de entrada: monta a cena, conecta os sistemas e roda o laço principal.
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Director } from './enemy.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { loadCharacters } from './characters.js';
import { Pickups, WEAPONS } from './pickups.js';
import { Wind } from './wind.js';
import { Standoff } from './standoff.js';
import { Waves } from './waves.js';
import { damp, flatDist } from './util.js';

async function loadFonts() {
  if (!document.fonts) return;
  const sample = '茶餐廳麻雀館耍樂金龍酒家夜宵按摩足底夜總會旅館藥房粥麵飯糖水大押小時危閃的士慢旺角之夜敵連擊香港洪門龍第一二三四波後巷花園街女人街天后廟涼茶偉斬氣完美終碎勝敗瓶棍撬管暫停';
  const faces = ['900 64px "Noto Sans TC"', '900 64px "Noto Serif TC"', '700 64px "LXGW WenKai TC"', '900 64px "Big Shoulders Display"', '500 16px "IBM Plex Mono"'];
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f, sample).catch(() => null))),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
}

const blankStats = () => ({ time: 0, maxCombo: 0, counters: 0, perfect: 0, dodged: 0, perfectDodges: 0, hitsTaken: 0, duels: 0, duelsLost: 0, heals: 0, waves: 0 });

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 260);
    this.renderer = new Renderer(this.canvas, this.scene, this.camera);
    this.hud = new HUD();
    this.sfx = new Sfx();
    this.input = new Input(this.canvas);
    this.cam = new CameraRig(this.camera);
    this.state = 'loading';
    this.timeScale = 1;
    this.targetScale = 1;
    this.slowOn = false;
    this.slowT = 0;
    this.hitstopT = 0;
    this.clock = 0;
    this.elapsed = 0;
    this.paused = false;
    this.menu = false;
    this.last = 0;
    this.enemies = [];
    this.fighting = false;
    this.stats = blankStats();
  }

  async init() {
    await loadFonts();
    this.fx = new FX(this.scene);
    const btn = document.getElementById('startBtn');
    this.looks = await loadCharacters((p) => { btn.textContent = `Preparando personagens… ${Math.round(p * 100)}%`; });
    btn.textContent = 'Montando o quarteirão…';
    await new Promise((r) => setTimeout(r, 0));
    this.world = buildWorld(this.scene, this.renderer.renderer);
    this.player = new Player(this);
    this.pickups = new Pickups(this);
    this.pickups.reset();
    this.wind = new Wind(this.scene);
    this.standoff = new Standoff(this);
    this.waves = new Waves(this);
    this.director = new Director(this);
    this.renderer.onResize = (w, h, pr) => {
      this.world.resize(w, h, pr);
      this.fx.setScale((h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
    };
    this.renderer.resize();
    this.state = 'title';
    this.renderer.renderer.compile(this.scene, this.camera);
    this.hud.ready({
      start: () => this.start(),
      again: () => (this.state === 'lose' ? this.retry() : this.start()),
      retry: () => this.retry(),
      restart: () => this.start(),
      resume: () => this.setMenu(false),
      pause: () => this.setMenu(true),
      cinema: () => this.renderer.toggleBW(),
      sound: () => this.sfx.toggle(),
    });
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
    document.body.classList.add('loaded');
    requestAnimationFrame(this.loop);
  }

  // Novo jogo, da primeira onda.
  start() {
    this.sfx.init();
    this.sfx.ui();
    this.stats = blankStats();
    this.elapsed = 0;
    this.timeScale = this.targetScale = 1;
    this.slowOn = false;
    this.slowT = 0;
    this.menu = false;
    this.cam.mode = 'play';
    this.cam.cinematic(false);
    this.cam.frameDuel(null);
    this.standoff.cancel();
    this.pickups.reset();
    this.waves.reset();
    this.hud.combo(0);
    this.hud.showPlay();
    this.state = 'play';
    this.input.wantLock = true;
    this.waves.begin(0);
    this.endT = 0;
    this.renderer.renderer.compile(this.scene, this.camera);
  }

  // Tenta de novo a onda atual: vida cheia e 2 de determinação.
  retry() {
    if (this.waves.i < 0) { this.start(); return; }
    this.sfx.init();
    this.sfx.ui();
    this.timeScale = this.targetScale = 1;
    this.slowOn = false;
    this.slowT = 0;
    this.menu = false;
    this.cam.mode = 'play';
    this.cam.cinematic(false);
    this.cam.frameDuel(null);
    this.standoff.cancel();
    this.pickups.reset();
    this.hud.showPlay();
    this.state = 'play';
    this.waves.begin(this.waves.i, true);
    this.endT = 0;
  }

  setMenu(on) {
    if (this.state !== 'play' && on) return;
    this.menu = on;
    this.hud.pause(on);
    if (on && document.pointerLockElement) document.exitPointerLock();
    this.sfx.ui();
  }

  engage() { this.waves.engage(); }
  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(on) { this.slowOn = on; }
  slowPulse(d) { this.slowT = Math.max(this.slowT, d); }
  get blockCounter() { return this.waves.state === 'offer' || this.waves.state === 'duel'; }

  nearestEnemy(p, max) {
    let best = null, bd = max;
    for (const e of this.enemies) {
      if (!e.targetable) continue;
      const d = flatDist(p, e.pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  onEnemyDown() {
    this.player.gainDet(0.5);
    this.waves.onDown();
  }

  onPerfectDodge() {
    this.stats.perfectDodges++;
    this.slowPulse(0.3);
    this.hud.callout('Esquiva perfeita', 'jade', '閃');
  }

  onVictory() {
    this.state = 'win';
    this.endT = 3.0;
    this.stats.time = this.elapsed;
    this.player.inv = 99;
    this.hud.letterbox(true);
    this.hud.callout('Vitória', 'amber', '勝');
  }

  onPlayerDown() {
    if (this.state !== 'play') return;
    this.state = 'lose';
    this.endT = 2.4;
    this.stats.time = this.elapsed;
    this.slowmo(false);
    this.cam.cinematic(false);
    this.cam.frameDuel(null);
    this.standoff.cancel();
  }

  // Empurra lutadores sobrepostos para longe uns dos outros.
  separate() {
    const all = [this.player, ...this.enemies].filter((f) => f.solid);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d >= min || d < 1e-4) continue;
        const push = min - d;
        const wa = a === this.player ? 0.15 : 0.5, wb = b === this.player ? 0.15 : 0.5;
        a.pos.x -= (dx / d) * push * wa; a.pos.z -= (dz / d) * push * wa;
        b.pos.x += (dx / d) * push * wb; b.pos.z += (dz / d) * push * wb;
      }
    }
  }

  loop = (now) => {
    requestAnimationFrame(this.loop);
    const rdt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 20);
    this.last = now;
    if (this.paused) return;
    this.frame(rdt);
  };

  frame(rdt, draw = true) {
    const inp = this.input;
    inp.update();
    if (inp.take('mute')) this.hud.sound(this.sfx.toggle());
    if (inp.take('cinema')) this.hud.cinema(this.renderer.toggleBW());
    if (this.menu) {
      if (inp.take('pause')) this.setMenu(false);
      inp.endFrame();
      if (draw) this.renderer.render(0);
      return;
    }
    if ((inp.take('pause') || inp.take('unlock')) && this.state === 'play') { this.setMenu(true); inp.endFrame(); return; }
    if ((this.state === 'win' || this.state === 'lose') && this.endT <= 0 && (inp.take('confirm') || inp.take('restart'))) {
      if (this.state === 'lose') this.retry(); else this.start();
    }
    if (this.state === 'title' && inp.take('confirm')) this.start();
    if (this.blockCounter) inp.take('counter');

    if (this.slowT > 0) this.slowT -= rdt;
    this.targetScale = this.slowOn || this.slowT > 0 ? 0.3 : 1;
    this.timeScale = damp(this.timeScale, this.targetScale, 8, rdt);
    let dt = rdt * this.timeScale;
    if (this.hitstopT > 0) { this.hitstopT -= rdt; dt *= 0.04; }
    this.clock += dt;
    if (this.state === 'play') this.elapsed += rdt;

    if (this.state !== 'loading') {
      this.player.update(dt);
      for (const e of this.enemies) e.update(dt);
      this.director.update(dt);
      this.standoff.update(dt);
      if (this.state === 'play') this.waves.update(dt);
      this.separate();
      this.pickups.update(dt, this.clock);
      this.updatePrompt();
      if (this.endT > 0) {
        this.endT -= rdt;
        if (this.state === 'win') this.player.celebrate();
        if (this.endT <= 0) { this.hud.letterbox(false); this.hud.end(this.state === 'win', this.stats); }
      }
      const fighting = this.state === 'play' && this.fighting ? Math.min(1, 0.45 + this.player.combo * 0.08) : 0;
      this.sfx.setIntensity(damp(this.sfx.intensity, fighting, 1.5, rdt));
      this.wind.update(dt, this.clock, this.player.pos);
      this.world.wind = this.wind.k * (0.7 + 0.3 * Math.sin(this.clock * 0.8));
    }
    this.fx.update(dt);
    this.world.update(dt, this.clock, this.camera, this.state === 'title' ? null : this.player.pos);
    this.cam.update(rdt, this);
    this.hud.update(rdt, this.fighting || this.waves.state === 'offer' || this.waves.state === 'duel');
    this.renderer.tick(rdt);
    if (draw) this.renderer.render(rdt);
    inp.endFrame();
  }

  // Aviso para pegar a arma mais próxima (os avisos do confronto têm prioridade).
  updatePrompt() {
    if (this.state !== 'play' || this.blockCounter) return;
    const it = this.pickups.nearest(this.player.pos);
    if (it && this.player.state === 'move') this.hud.prompt('pickup', WEAPONS[it.type].name.toLowerCase());
    else this.hud.prompt(null);
  }
}

const game = new Game();
window.__game = game;
game.init().catch((err) => {
  console.error(err);
  const s = document.getElementById('startBtn');
  if (s) s.textContent = 'Seu navegador não conseguiu iniciar o WebGL';
});
