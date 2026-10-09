// Ponto de entrada: monta a cena, conecta os sistemas e roda o laço principal.
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Enemy, Director } from './enemy.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { damp, flatDist } from './util.js';

const SPAWNS = [
  ['floral', [-3.2, 0, -3.0]],
  ['track', [3.4, 0, -2.4]],
  ['brute', [0.4, 0, -5.0]],
];

async function loadFonts() {
  if (!document.fonts) return;
  const sample = '茶餐廳麻雀館耍樂金龍酒家夜宵按摩足底夜總會旅館藥房粥麵飯糖水大押小時危的士慢旺角啟敵連擊0123456789';
  const faces = ['900 64px "Noto Sans TC"', '900 64px "Big Shoulders Display"', '500 16px "IBM Plex Mono"'];
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f, sample).catch(() => null))),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
}

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 220);
    this.renderer = new Renderer(this.canvas, this.scene, this.camera);
    this.hud = new HUD();
    this.sfx = new Sfx();
    this.input = new Input(this.canvas);
    this.cam = new CameraRig(this.camera);
    this.state = 'loading';
    this.timeScale = 1;
    this.targetScale = 1;
    this.hitstopT = 0;
    this.clock = 0;
    this.elapsed = 0;
    this.paused = false;
    this.last = 0;
    this.stats = { time: 0, maxCombo: 0, counters: 0, hitsTaken: 0 };
  }

  async init() {
    await loadFonts();
    this.fx = new FX(this.scene);
    this.world = buildWorld(this.scene, this.renderer.renderer);
    this.player = new Player(this);
    this.enemies = SPAWNS.map(([kind, pos], i) => new Enemy(this, kind, pos, i));
    this.director = new Director(this);
    this.renderer.onResize = (w, h, pr) => {
      this.world.resize(w, h, pr);
      this.fx.setScale((h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
    };
    this.renderer.resize();
    this.state = 'title';
    this.renderer.renderer.compile(this.scene, this.camera);
    this.hud.ready(() => this.start(), () => this.start(), () => this.sfx.toggle());
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
    document.body.classList.add('loaded');
    requestAnimationFrame(this.loop);
  }

  start() {
    this.sfx.init();
    this.sfx.ui();
    this.player.reset();
    for (const e of this.enemies) e.reset();
    this.director.reset();
    this.stats = { time: 0, maxCombo: 0, counters: 0, hitsTaken: 0 };
    this.elapsed = 0;
    this.timeScale = this.targetScale = 1;
    this.cam.mode = 'play';
    this.cam.yaw = 0;
    this.cam.cinematic(false);
    this.cam.focus.set(0, 1.15, 2.4);
    this.hud.foes(this.enemies.length);
    this.hud.showPlay();
    this.hud.callout('Lute!', 'amber');
    this.state = 'play';
    this.endT = 0;
  }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  slowmo(on) { this.targetScale = on ? 0.3 : 1; }

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
    const left = this.enemies.filter((e) => e.hp > 0).length;
    this.hud.foes(left);
    if (left === 0 && this.state === 'play') {
      this.state = 'win';
      this.endT = 2.2;
      this.stats.time = this.elapsed;
      this.player.inv = 99;
    }
  }

  onPlayerDown() {
    if (this.state !== 'play') return;
    this.state = 'lose';
    this.endT = 2.4;
    this.stats.time = this.elapsed;
    this.slowmo(false);
    this.cam.cinematic(false);
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
    this.input.update();
    if (this.input.take('mute')) this.hud.sound(this.sfx.toggle());
    if ((this.state === 'win' || this.state === 'lose') && this.endT <= 0 && (this.input.take('confirm') || this.input.take('restart'))) this.start();
    if (this.state === 'title' && this.input.take('confirm')) this.start();

    this.timeScale = damp(this.timeScale, this.targetScale, 8, rdt);
    let dt = rdt * this.timeScale;
    if (this.hitstopT > 0) { this.hitstopT -= rdt; dt *= 0.04; }
    this.clock += dt;
    if (this.state === 'play') this.elapsed += rdt;

    if (this.state !== 'loading') {
      this.player.update(dt);
      for (const e of this.enemies) e.update(dt);
      this.director.update(dt);
      this.separate();
      if (this.endT > 0) {
        this.endT -= rdt;
        if (this.state === 'win') this.player.celebrate();
        if (this.endT <= 0) this.hud.end(this.state === 'win', this.stats);
      }
      const fighting = this.state === 'play' ? Math.min(1, 0.45 + this.player.combo * 0.08) : 0;
      this.sfx.setIntensity(damp(this.sfx.intensity, fighting, 1.5, rdt));
    }
    this.fx.update(dt);
    this.world.update(dt, this.clock, this.camera);
    this.cam.update(rdt, this);
    this.hud.update(rdt);
    this.renderer.tick(rdt);
    if (draw) this.renderer.render(rdt);
    this.input.endFrame();
  }
}

const game = new Game();
window.__game = game;
game.init().catch((err) => {
  console.error(err);
  const s = document.getElementById('startBtn');
  if (s) s.textContent = 'Seu navegador não conseguiu iniciar o WebGL';
});

