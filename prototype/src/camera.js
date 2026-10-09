// Câmera em terceira pessoa que enquadra o protagonista e os inimigos próximos.
import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';
import { REDUCED_MOTION } from './config.js';

const tmp = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 7.2;
    this.focus = new THREE.Vector3(0, 1.1, 1);
    this.trauma = 0;
    this.cine = 0;
    this.cineTarget = 0;
    this.mode = 'title';
    this.t = 0;
  }

  // Converte a direção do analógico/teclado para o plano do chão, relativa à câmera.
  moveVector(m, out) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    return out.set(rx * m.x + fx * m.y, 0, rz * m.x + fz * m.y);
  }

  shake(a) {
    this.trauma = Math.min(1, this.trauma + a * (REDUCED_MOTION ? 0.3 : 1));
  }

  cinematic(on) {
    this.cineTarget = on ? 1 : 0;
  }

  update(dt, game) {
    this.t += dt;
    const c = this.cam;
    if (this.mode === 'free') return;
    let pos;
    if (this.mode === 'title') {
      const a = this.t * 0.07 - 0.35;
      this.focus.set(0, 2.2, -1.5);
      pos = tmp.set(Math.sin(a) * 6.5, 2.0 + Math.sin(this.t * 0.2) * 0.3, 6.4 + Math.cos(a) * 1.5);
    } else {
      this.yaw += game.input.cam * dt * 1.9;
      const p = game.player.pos;
      let cx = 0, cz = 0, n = 0;
      for (const e of game.enemies) {
        if (!e.targetable) continue;
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (d > 8) continue;
        cx += e.pos.x; cz += e.pos.z; n++;
      }
      const fx = n ? p.x + (cx / n - p.x) * 0.3 : p.x;
      const fz = n ? p.z + (cz / n - p.z) * 0.3 : p.z;
      this.focus.x = damp(this.focus.x, fx, 5, dt);
      this.focus.z = damp(this.focus.z, fz, 5, dt);
      this.focus.y = damp(this.focus.y, 1.15 + Math.max(0, p.y) * 0.5, 5, dt);
      this.cine = damp(this.cine, this.cineTarget, 5, dt);
      // Em telas em retrato, abre o campo de visão e afasta a câmera para enquadrar a luta.
      const aspect = c.aspect;
      const narrow = aspect < 1.3 ? Math.pow(1.3 / aspect, 0.12) : 1;
      const dist = lerp(this.dist * narrow, 4.4 * narrow, this.cine);
      const pitch = lerp(this.pitch, 0.2, this.cine);
      const yaw = this.yaw + this.cine * 0.55;
      pos = tmp.set(
        this.focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        this.focus.y + Math.sin(pitch) * dist,
        this.focus.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      pos.x = clamp(pos.x, -8.4, 8.4);
      pos.z = clamp(pos.z, -7.6, 22);
    }
    c.position.copy(pos);
    c.lookAt(this.focus);
    const s = this.trauma * this.trauma;
    if (s > 0.001) {
      const t = this.t * 40;
      c.position.x += (Math.sin(t * 1.3) + Math.sin(t * 2.7)) * 0.09 * s;
      c.position.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1)) * 0.07 * s;
      c.rotation.z += Math.sin(t * 2.1) * 0.03 * s;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const base = c.aspect < 1.3 ? Math.min(66, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * 1.3 / c.aspect))) : 50;
    const fov = lerp(base, base * 0.8, this.cine);
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
  }
}
