// Base comum ao protagonista e aos capangas: posição, orientação, queda e levantada.
import * as THREE from 'three';
import { Rig } from './rig.js';
import { STANCE, FALL, LYING, SIT, lerpPose } from './poses.js';
import { ARENA } from './config.js';
import { clamp, dampAngle, yawTo, smooth } from './util.js';

const tmp = new THREE.Vector3();

export class Fighter {
  constructor(game, outfit, scale = 1) {
    this.game = game;
    this.scale = scale;
    this.rig = new Rig(outfit, scale, game.fx.blobMat);
    this.root = this.rig.root;
    this.pos = this.root.position;
    this.yaw = 0;
    this.state = 'idle';
    this.t = 0;
    this.sharp = 16;
    this.pose = lerpPose(STANCE, STANCE, 0);
    this.kb = new THREE.Vector3();
    this.flash = 0;
    this.radius = 0.38 * scale;
    this.stance = STANCE;
    game.scene.add(this.root, this.rig.shadow);
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  forward(v = tmp) {
    return v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  face(target, rate, dt) {
    this.yaw = dampAngle(this.yaw, yawTo(this.pos, target), rate, dt);
  }

  clampArena() {
    this.pos.x = clamp(this.pos.x, ARENA.minX, ARENA.maxX);
    this.pos.z = clamp(this.pos.z, ARENA.minZ, ARENA.maxZ);
  }

  // Vira-se para o agressor e cai de costas, deslizando no asfalto molhado.
  beginFall(from, power) {
    this.yaw = yawTo(this.pos, from);
    this.forward(this.kb).multiplyScalar(-power);
    this.landed = false;
    this.rig.spin.rotation.x = 0;
  }

  updateFall(dt, dur = 0.5) {
    const f = clamp(this.t / dur, 0, 1);
    this.rig.tilt.rotation.x = -1.5 * f * f;
    this.pos.addScaledVector(this.kb, dt);
    this.kb.multiplyScalar(Math.exp(-3 * dt));
    this.pos.y = 0;
    lerpPose(FALL, LYING, f * f, this.pose);
    this.sharp = 14;
    if (f >= 1 && !this.landed) {
      this.landed = true;
      const g = this.game;
      const p = this.rig.world('chest', tmp);
      p.y = 0.05;
      g.fx.splash(p);
      g.sfx.splash();
      g.cam.shake(0.18);
    }
    return f >= 1;
  }

  updateGetup(dt, dur = 0.8) {
    const f = clamp(this.t / dur, 0, 1);
    this.rig.tilt.rotation.x = -1.5 * (1 - smooth(f));
    if (f < 0.5) lerpPose(LYING, SIT, f * 2, this.pose);
    else lerpPose(SIT, this.stance, (f - 0.5) * 2, this.pose);
    this.sharp = 16;
    return f >= 1;
  }

  syncRig(dt, sharp = this.sharp) {
    this.root.rotation.y = this.yaw;
    this.rig.applyPose(this.pose, 1 - Math.exp(-sharp * dt));
    this.flash = Math.max(0, this.flash - dt * 7);
    this.rig.fx.flash.value = this.flash * this.flash * 0.6;
    this.rig.updateShadow();
  }
}
