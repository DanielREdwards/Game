// Protagonista e sistema de combate de fluxo livre (implementação própria, ver docs/sala-limpa).
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { MOVES, STANCE, TUCK, SALUTE, HIT_HEAD, evalClip, lerpPose, runPose, idlePose } from './poses.js';
import { clamp, damp, dampAngle, flatDist, easeOut, smooth } from './util.js';

export const METER_MAX = 5;
const CHAIN = ['jab', 'cross', 'hook', 'kick', 'jab', 'knee', 'cross', 'kick', 'hook', 'cross', 'knee', 'kick'];
const ACTIONS = ['attack', 'counter', 'dodge', 'finisher'];
const RUN_SPEED = 6.2;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const ZERO = { x: 0, y: 0 };

export class Player extends Fighter {
  constructor(game) {
    super(game, game.looks.hero, 1);
    this.maxHp = 100;
    this.moveDir = new THREE.Vector3(0, 0, -1);
    this.startPos = new THREE.Vector3();
    this.mv = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.pos.set(0, 0, 3.6);
    this.yaw = Math.PI;
    this.hp = this.maxHp;
    this.combo = 0;
    this.comboT = 0;
    this.meter = 0;
    this.chainI = 0;
    this.buffer = null;
    this.bufferT = 0;
    this.speed = 0;
    this.phase = 0;
    this.inv = 0;
    this.target = null;
    this.move = null;
    this.rig.tilt.rotation.x = 0;
    this.rig.spin.rotation.x = 0;
    this.setState('move');
    this.game.hud.hp(1);
    this.game.hud.combo(0);
    this.game.hud.meter(0, METER_MAX);
  }

  get alive() { return this.hp > 0; }
  get solid() { return this.state !== 'dodge' && this.state !== 'down'; }

  update(dt) {
    const g = this.game;
    const playing = g.state === 'play';
    if (playing) {
      for (const a of ACTIONS) if (g.input.take(a)) { this.buffer = a; this.bufferT = 0.35; }
    }
    if ((this.bufferT -= dt) <= 0) this.buffer = null;
    this.inv = Math.max(0, this.inv - dt);
    if (this.combo > 0 && (this.comboT -= dt) <= 0) this.breakCombo();
    g.cam.moveVector(playing ? g.input.move : ZERO, this.mv);
    this.t += dt;

    switch (this.state) {
      case 'move': this.updateMove(dt); break;
      case 'attack': case 'counter': case 'finisher': this.updateStrike(dt); break;
      case 'dodge': this.updateDodge(dt); break;
      case 'whiff': this.updateWhiff(); break;
      case 'hit': this.updateHit(dt); break;
      case 'down': this.updateFall(dt, 0.55); break;
      case 'victory': lerpPose(this.pose, SALUTE, 1 - Math.exp(-6 * dt), this.pose); this.sharp = 8; break;
    }
    if (this.state !== 'down') this.clampArena();
    this.syncRig(dt);
  }

  // ------------------------------------------------------------ locomoção

  updateMove(dt) {
    const mag = Math.min(1, this.mv.length());
    this.speed = damp(this.speed, mag * RUN_SPEED, 10, dt);
    if (mag > 0.1) {
      this.moveDir.copy(this.mv).normalize();
      this.yaw = dampAngle(this.yaw, Math.atan2(this.mv.x, this.mv.z), 12, dt);
    } else {
      const near = this.game.nearestEnemy(this.pos, 6);
      if (near) this.face(near.pos, 5, dt);
    }
    this.pos.addScaledVector(this.moveDir, this.speed * dt);
    const amt = clamp(this.speed / RUN_SPEED, 0, 1);
    this.phase += dt * (5 + 8 * amt);
    lerpPose(idlePose(STANCE, this.t), runPose(this.phase, amt), smooth(clamp(amt * 1.8, 0, 1)), this.pose);
    this.sharp = 14;
    this.tryActions();
  }

  tryActions() {
    const a = this.buffer;
    if (!a) return false;
    if (a === 'finisher' && this.meter < METER_MAX) { this.buffer = null; return false; }
    this.buffer = null;
    if (a === 'attack') this.startAttack();
    else if (a === 'counter') this.startCounter();
    else if (a === 'dodge') this.startDodge();
    else this.startFinisher();
    return true;
  }

  // ------------------------------------------------------------ seleção de alvo

  selectTarget() {
    const dir = this.mv;
    const hasDir = dir.lengthSq() > 0.04;
    if (hasDir) tmp2.copy(dir).normalize();
    let best = null, bestScore = -Infinity;
    for (const e of this.game.enemies) {
      if (!e.targetable) continue;
      tmp.subVectors(e.pos, this.pos).setY(0);
      const d = tmp.length();
      if (d > 11) continue;
      let score;
      if (hasDir) {
        const cos = d > 1e-3 ? tmp.divideScalar(d).dot(tmp2) : 1;
        if (cos < 0.25 && d > 1.6) continue;
        score = cos * 3 - d * 0.32;
      } else {
        score = -d * 0.6 + (e === this.lastTarget ? 1.0 : 0);
      }
      if (e.state === 'windup' || e.state === 'approach') score += 0.4;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------ golpes

  beginStrike(state, move, target) {
    this.setState(state);
    this.move = move;
    this.target = target;
    this.lastTarget = target || this.lastTarget;
    this.mt = 0;
    this.hitDone = false;
    this.dash = false;
    this.startPos.copy(this.pos);
    if (target && state === 'attack') {
      const d = flatDist(this.pos, target.pos);
      this.dash = d > move.reach + 1.6;
    }
  }

  startAttack() {
    const target = this.selectTarget();
    let move;
    if (target && flatDist(this.pos, target.pos) > 4.6) move = MOVES.fly;
    else move = MOVES[CHAIN[this.chainI++ % CHAIN.length]];
    this.beginStrike('attack', move, target);
    this.game.sfx.whoosh(move.heavy);
  }

  startCounter() {
    const threats = this.game.enemies.filter(
      (e) => e.state === 'windup' && e.t > 0.1 && flatDist(e.pos, this.pos) < 5.5,
    );
    if (!threats.length) {
      this.setState('whiff');
      this.game.sfx.whoosh(false);
      return;
    }
    threats.sort((a, b) => flatDist(a.pos, this.pos) - flatDist(b.pos, this.pos));
    for (const e of threats) e.stagger();
    this.counterTargets = threats;
    this.beginStrike('counter', MOVES.counter, threats[0]);
    this.inv = 0.9;
    const g = this.game;
    g.stats.counters += threats.length;
    g.sfx.counter();
    g.hitstop(0.07);
    g.hud.callout(threats.length > 1 ? `CONTRA-ATAQUE ×${threats.length}` : 'CONTRA-ATAQUE', 'jade');
    const hp = threats[0].rig.world('head', tmp);
    g.fx.flash(hp, [0.6, 2.6, 2.4], 1.1);
  }

  startFinisher() {
    const target = this.selectTarget();
    if (!target) return;
    this.meter = 0;
    this.game.hud.meter(0, METER_MAX);
    this.beginStrike('finisher', MOVES.finisher, target);
    this.dash = false;
    this.inv = 2;
    target.stagger(1.6);
    const g = this.game;
    g.slowmo(true);
    g.cam.cinematic(true);
    g.sfx.whoosh(true);
    g.hud.callout('FINALIZAÇÃO', 'amber');
  }

  updateStrike(dt) {
    const m = this.move, tgt = this.target;
    const valid = tgt && (tgt.targetable || tgt.state === 'stagger');
    if (this.dash) {
      if (!valid) this.dash = false;
      else {
        tmp.subVectors(tgt.pos, this.pos).setY(0);
        const d = tmp.length();
        tmp.divideScalar(d || 1);
        this.yaw = Math.atan2(tmp.x, tmp.z);
        this.pos.addScaledVector(tmp, Math.min(15 * dt, Math.max(0, d - (m.reach + 0.9))));
        this.phase += dt * 17;
        runPose(this.phase, 1, this.pose);
        this.pose.spine[0] += 0.25;
        this.sharp = 18;
        if (d <= m.reach + 1.0 || this.t > 0.7) { this.dash = false; this.startPos.copy(this.pos); }
        return;
      }
    }
    this.mt += dt / m.dur;
    const t = Math.min(this.mt, 1);
    if (valid && t <= m.impact) {
      // aproximação automática até a distância de alcance do golpe
      tmp.subVectors(tgt.pos, this.pos).setY(0);
      const d = tmp.length() || 1;
      tmp.divideScalar(d);
      this.face(tgt.pos, 30, dt);
      tmp2.copy(tgt.pos).addScaledVector(tmp, -m.reach);
      this.pos.lerpVectors(this.startPos, tmp2, easeOut(clamp(t / m.impact, 0, 1)));
    }
    this.pos.y = m.air ? m.air * Math.sin(Math.PI * clamp((t - 0.18) / 0.7, 0, 1)) : 0;
    evalClip(m, t, this.pose);
    this.sharp = 32;
    if (!this.hitDone && t >= m.impact) {
      this.hitDone = true;
      this.resolveHit();
    }
    const b = this.buffer;
    const canCounter = b === 'counter' && this.state === 'attack' && this.game.enemies.some((e) => e.state === 'windup');
    if (this.state !== 'finisher' && b && (t >= m.cancel || canCounter)) {
      this.pos.y = 0;
      if (this.tryActions()) return;
    }
    if (t >= 1) {
      this.pos.y = 0;
      if (this.state === 'finisher') { this.game.slowmo(false); this.game.cam.cinematic(false); }
      this.setState(this.game.state === 'win' ? 'victory' : 'move');
    }
  }

  resolveHit() {
    const g = this.game, m = this.move;
    const targets = this.state === 'counter' ? this.counterTargets : [this.target];
    let landed = 0;
    for (const e of targets) {
      if (!e || !(e.targetable || e.state === 'stagger')) continue;
      if (this.state !== 'counter' && flatDist(this.pos, e.pos) > m.reach + 0.9) continue;
      e.takeHit(this, m);
      landed++;
      tmp.set(e.pos.x, m.hitY * e.scale, e.pos.z);
      tmp2.subVectors(this.pos, e.pos).setY(0).normalize();
      tmp.addScaledVector(tmp2, 0.22);
      const hot = this.state === 'counter' ? [0.8, 3.0, 2.6] : [3.2, 2.0, 1.0];
      g.fx.impact(tmp, { color: hot, count: m.heavy ? 26 : 16, speed: m.heavy ? 6.5 : 4.5 });
    }
    if (!landed) return;
    for (let i = 0; i < landed; i++) this.registerHit();
    g.sfx.punch(!!m.heavy);
    if (this.state === 'finisher') {
      g.fx.shockwave(this.target.pos, [3.0, 1.6, 0.4]);
      g.sfx.boom();
      g.cam.shake(0.9);
      g.hitstop(0.14);
      for (const e of g.enemies) {
        if (e !== this.target && e.targetable && flatDist(e.pos, this.target.pos) < 2.8) e.knockBack(this.target.pos, 4);
      }
    } else {
      g.cam.shake(m.heavy ? 0.32 : 0.16);
      g.hitstop(m.heavy ? 0.085 : 0.05);
      g.renderer.punch(m.heavy ? 0.9 : 0.45);
    }
  }

  registerHit() {
    const g = this.game;
    this.combo++;
    this.comboT = 2.4;
    this.meter = Math.min(METER_MAX, this.meter + 1);
    g.stats.maxCombo = Math.max(g.stats.maxCombo, this.combo);
    g.hud.combo(this.combo);
    g.hud.meter(this.meter, METER_MAX);
  }

  breakCombo() {
    this.combo = 0;
    this.meter = 0;
    this.game.hud.combo(0);
    this.game.hud.meter(0, METER_MAX);
  }

  // ------------------------------------------------------------ esquiva e reações

  startDodge() {
    if (this.mv.lengthSq() > 0.04) this.dodgeDir = this.mv.clone().normalize();
    else this.dodgeDir = this.sidestep() || this.forward(new THREE.Vector3()).multiplyScalar(-1);
    this.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    this.inv = 0.42;
    this.setState('dodge');
    this.game.sfx.whoosh(false);
  }

  // Sem direção informada e com alguém mirando: rola para o lado, saindo da linha de tiro,
  // preferindo o lado com mais espaço até a parede.
  sidestep() {
    const shooter = this.game.enemies.find((e) => e.state === 'aim' || e.state === 'fire');
    if (!shooter) return null;
    tmp.subVectors(this.pos, shooter.pos).setY(0).normalize();
    const side = new THREE.Vector3(-tmp.z, 0, tmp.x);
    const room = (s) => {
      const x = this.pos.x + side.x * s * 3, z = this.pos.z + side.z * s * 3;
      return -Math.max(Math.abs(x) - 7.2, 0) - Math.max(Math.abs(z) - 6.2, 0);
    };
    return room(1) >= room(-1) ? side : side.multiplyScalar(-1);
  }

  updateDodge(dt) {
    const D = 0.46, f = clamp(this.t / D, 0, 1);
    this.pos.addScaledVector(this.dodgeDir, 10.5 * (1 - f) * dt);
    this.rig.spin.rotation.x = Math.PI * 2 * smooth(f);
    const k = f < 0.5 ? smooth(f * 2) : smooth((1 - f) * 2);
    lerpPose(STANCE, TUCK, k, this.pose);
    this.sharp = 30;
    if (f >= 1) {
      this.rig.spin.rotation.x = 0;
      this.setState('move');
      this.tryActions();
    }
  }

  updateWhiff() {
    lerpPose(STANCE, MOVES.counter.keys[1][1], Math.sin(Math.PI * clamp(this.t / 0.32, 0, 1)), this.pose);
    this.sharp = 20;
    if (this.t > 0.32) this.setState('move');
  }

  takeHit(attacker, dmg, { bullet = false } = {}) {
    if (this.inv > 0 || this.state === 'down' || this.state === 'finisher' || this.state === 'counter') return false;
    const g = this.game;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = bullet ? 0.55 : 1;
    this.breakCombo();
    g.stats.hitsTaken++;
    g.hud.hp(this.hp / this.maxHp);
    g.sfx.hurt();
    g.cam.shake(bullet ? 0.22 : 0.5);
    g.hitstop(bullet ? 0.015 : 0.06);
    g.renderer.punch(bullet ? 0.6 : 1.2);
    this.rig.spin.rotation.x = 0;
    this.pos.y = 0;
    const hp = this.rig.world(bullet ? 'chest' : 'head', tmp);
    if (bullet) hp.y += 0.15;
    g.fx.impact(hp, { color: [3.0, 0.5, 0.35], count: bullet ? 8 : 14, speed: 4 });
    if (this.hp <= 0) {
      this.beginFall(attacker.pos, 4);
      this.setState('down');
      g.onPlayerDown();
    } else {
      this.face(attacker.pos, 1000, 1);
      this.forward(this.kb).multiplyScalar(bullet ? -1.4 : -3.2);
      this.hitDur = bullet ? 0.26 : 0.42;
      this.hitCancel = bullet ? 0.08 : 0.22;
      this.setState('hit');
    }
    return true;
  }

  updateHit(dt) {
    this.pos.addScaledVector(this.kb, dt);
    this.kb.multiplyScalar(Math.exp(-7 * dt));
    const f = clamp(this.t / this.hitDur, 0, 1);
    lerpPose(HIT_HEAD, STANCE, smooth(f), this.pose);
    this.sharp = f < 0.2 ? 40 : 14;
    if (f >= 1) this.setState('move');
    else if (this.t > this.hitCancel && this.buffer === 'dodge') this.tryActions();
  }

  celebrate() {
    if (this.state === 'move') this.setState('victory');
  }
}

