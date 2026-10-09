// Confronto (especificação de combate, seção 15): segurar CONTRA chama um adversário para o duelo;
// ele avança até ~3 m, pode fingir o ataque e, ao brilho de estrela, soltar o botão em até 0,4 s
// derruba o adversário. Até três adversários em sequência, cada um mais rápido.
import * as THREE from 'three';
import { MOVES, E_READY, E_FEINT, E_STRIKE, evalClip, lerpPose, idlePose, runPose } from './poses.js';
import { clamp, rand, smooth, flatDist } from './util.js';

const WINDOW = 0.4;
const tmp = new THREE.Vector3();

export class Standoff {
  constructor(game) {
    this.game = game;
    this.done = true;
    this.active = false;
  }

  start(duelists) {
    const g = this.game, pl = g.player;
    this.queue = duelists.slice().sort((a, b) => flatDist(a.pos, pl.pos) - flatDist(b.pos, pl.pos)).slice(0, 3);
    this.n = 0;
    this.won = 0;
    this.done = false;
    this.active = true;
    g.hud.letterbox(true);
    pl.setState('duel');
    this.next();
  }

  cancel() {
    if (!this.active) return;
    this.finish();
  }

  next() {
    const g = this.game, pl = g.player;
    const e = this.queue.shift();
    if (!e || e.hp <= 0) { this.finish(); return; }
    this.e = e;
    this.n++;
    this.phase = 'approach';
    this.t = 0;
    const k = [1, 0.78, 0.6][this.n - 1] || 0.6;
    this.waitT = rand(1.0, 3.0) * k;
    this.window = WINDOW;
    this.feints = [];
    const nf = Math.floor(Math.random() * 3);
    for (let i = 0; i < nf; i++) this.feints.push(rand(0.35, Math.max(0.4, this.waitT - 0.35)));
    this.feints.sort((a, b) => a - b);
    this.feintT = -1;
    e.setState('duel');
    tmp.subVectors(e.pos, pl.pos).setY(0).normalize();
    this.spot = pl.pos.clone().addScaledVector(tmp, 3.0);
    g.sfx.gust(0.08);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game, pl = g.player, e = this.e;
    this.t += dt;
    const held = g.input.held('counter');
    if (e) {
      g.cam.frameDuel(pl.pos, e.pos);
      pl.face(e.pos, 8, dt);
      e.face(pl.pos, 8, dt);
    }
    switch (this.phase) {
      case 'approach': {
        pl.duelPose(smooth(clamp(this.t / 0.6, 0, 1)));
        tmp.subVectors(this.spot, e.pos).setY(0);
        const d = tmp.length();
        if (d > 0.05) {
          e.pos.addScaledVector(tmp.normalize(), Math.min(d, 2.1 * dt));
          e.phase += dt * 8;
          runPose(e.phase, 0.35, e.pose);
          e.sharp = 10;
        } else { this.phase = 'wait'; this.t = 0; }
        if (!held && this.t > 0.15) this.fail();
        break;
      }
      case 'wait': {
        pl.duelPose(1);
        lerpPose(idlePose(e.stance, this.t), E_READY, smooth(clamp(this.t / 0.5, 0, 1)), e.pose);
        e.sharp = 8;
        if (this.feints.length && this.t >= this.feints[0]) {
          this.feints.shift();
          this.feintT = 0;
          g.sfx.feint();
          g.cam.shake(0.08);
        }
        if (this.feintT >= 0) {
          this.feintT += dt;
          const f = clamp(this.feintT / 0.26, 0, 1);
          lerpPose(E_READY, E_FEINT, Math.sin(Math.PI * f), e.pose);
          e.sharp = 30;
          if (f >= 1) this.feintT = -1;
        }
        if (!held) { this.fail(); break; }
        if (this.t >= this.waitT) {
          this.phase = 'glint';
          this.t = 0;
          // brilho no olho do adversário, um pouco à frente do rosto (lado da câmera)
          const h = e.rig.world('head', tmp);
          h.y += 0.08;
          h.addScaledVector(e.forward(new THREE.Vector3()), 0.14);
          g.fx.glint(h);
          g.sfx.glint();
        }
        break;
      }
      case 'glint': {
        pl.duelPose(1);
        lerpPose(E_READY, E_FEINT, smooth(clamp(this.t / this.window, 0, 1)) * 0.6, e.pose);
        e.sharp = 20;
        if (!held) this.success();
        else if (this.t > this.window) this.fail(true);
        break;
      }
      case 'strike': {
        // o protagonista golpeia primeiro; o adversário cai em câmera lenta
        evalClip(MOVES.counter, clamp(this.t / 0.5, 0, 1), pl.pose);
        pl.sharp = 30;
        if (this.t > 1.1) {
          this.phase = 'between';
          this.t = 0;
          if (this.queue.length && this.queue.some((q) => q.hp > 0)) g.hud.prompt('duel-next');
          else this.finish();
        }
        break;
      }
      case 'between': {
        pl.duelPose(smooth(clamp(1 - this.t / 0.4, 0, 1)));
        if (held && this.t > 0.2) { g.hud.prompt(null); this.next(); }
        else if (this.t > 4) this.finish();
        break;
      }
      case 'fail': {
        lerpPose(E_FEINT, E_STRIKE, smooth(clamp(this.t / 0.18, 0, 1)), e.pose);
        e.sharp = 30;
        if (this.t > 0.6) this.finish();
        break;
      }
    }
  }

  success() {
    const g = this.game, pl = g.player, e = this.e;
    this.phase = 'strike';
    this.t = 0;
    this.won++;
    g.stats.duels++;
    g.sfx.slash();
    g.slowPulse(0.9);
    g.hitstop(0.1);
    g.cam.shake(0.3);
    g.hud.callout(this.won > 1 ? `Confronto ×${this.won}` : 'Confronto', 'jade', '斬');
    tmp.subVectors(e.pos, pl.pos).setY(0).normalize();
    pl.pos.addScaledVector(tmp, 1.1);
    pl.gainDet(1);
    e.hp = 0;
    e.beginFall(pl.pos, 6);
    e.setState('knockdown');
    const h = e.rig.world('chest', tmp);
    g.fx.impact(h, { color: [0.8, 3.0, 2.6], count: 30, speed: 7 });
    e.die();
  }

  fail(late = false) {
    const g = this.game, pl = g.player, e = this.e;
    this.phase = 'fail';
    this.t = 0;
    g.hud.callout(late ? 'Tarde demais' : 'Cedo demais', 'amber', '敗');
    g.sfx.whoosh(true);
    pl.inv = 0;
    pl.setState('move');
    pl.takeHit(e, 20);
    g.stats.duelsLost++;
  }

  finish() {
    const g = this.game, pl = g.player;
    this.active = false;
    this.done = true;
    g.cam.frameDuel(null);
    g.hud.prompt(null);
    g.sfx.tension(false);
    if (pl.state === 'duel') pl.setState('move');
    for (const q of [...(this.queue || []), this.e]) if (q && q.state === 'duel') q.setState('circle');
    this.queue = [];
    this.e = null;
  }
}
