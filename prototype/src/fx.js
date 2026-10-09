// Efeitos visuais: faíscas, clarões, ondas de choque, respingos e texturas compartilhadas.
import * as THREE from 'three';
import * as T from './textures.js';
import { mulberry32 } from './util.js';

class Particles {
  constructor(scene, max) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.size0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.25, 0.0, dot(c, c));
          gl_FragColor = vec4(vColor * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(p, n, { color = [3, 2, 1], speed = 5, up = 1.5, gravity = 9, life = 0.45, size = 0.07, spread = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = this.cursor;
      this.cursor = (k + 1) % this.max;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      this.vel[k * 3] = Math.sin(ph) * Math.cos(th) * s * spread;
      this.vel[k * 3 + 1] = Math.cos(ph) * s * 0.6 + up;
      this.vel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * s * spread;
      const v = 0.7 + Math.random() * 0.3;
      this.base[k * 3] = color[0] * v; this.base[k * 3 + 1] = color[1] * v; this.base[k * 3 + 2] = color[2] * v;
      this.size0[k] = size * (0.6 + Math.random() * 0.8);
      this.life[k] = this.maxLife[k] = life * (0.6 + Math.random() * 0.6);
      this.grav[k] = gravity;
    }
  }

  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.size[k] = 0; continue; }
      this.life[k] -= dt;
      const i = k * 3;
      this.vel[i + 1] -= this.grav[k] * dt;
      const drag = Math.exp(-2.2 * dt);
      this.vel[i] *= drag; this.vel[i + 2] *= drag;
      this.pos[i] += this.vel[i] * dt;
      this.pos[i + 1] += this.vel[i + 1] * dt;
      this.pos[i + 2] += this.vel[i + 2] * dt;
      if (this.pos[i + 1] < 0.02) { this.pos[i + 1] = 0.02; this.vel[i + 1] *= -0.3; }
      const f = Math.max(0, this.life[k] / this.maxLife[k]);
      this.col[i] = this.base[i] * f; this.col[i + 1] = this.base[i + 1] * f; this.col[i + 2] = this.base[i + 2] * f;
      this.size[k] = this.size0[k] * (0.35 + 0.65 * f);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const rng = mulberry32(77);
    this.sparks = new Particles(scene, 700);
    this.glowTex = T.radialTex([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.6)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
    this.blobMat = new THREE.MeshBasicMaterial({
      map: T.radialTex([[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true, depthWrite: false,
    });
    this.dangerTex = T.dangerTex();
    this.clothTex = { floral: T.floralTex(rng), track: T.trackTex() };
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 48);

    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      s.visible = false;
      s.renderOrder = 6;
      scene.add(s);
      this.flashes.push({ s, t: 1, dur: 0.14, size: 1 });
    }
    this.rings = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 4;
      scene.add(m);
      this.rings.push({ m, t: 1, dur: 0.5, size: 4 });
    }
  }

  flash(p, color = [3, 2.2, 1.4], size = 0.9, dur = 0.14) {
    const f = this.flashes.find((x) => x.t >= x.dur) || this.flashes[0];
    f.t = 0; f.dur = dur; f.size = size;
    f.s.position.copy(p);
    f.s.material.color.setRGB(color[0], color[1], color[2]);
    f.s.visible = true;
  }

  ring(p, color, size = 4, dur = 0.5) {
    const r = this.rings.find((x) => x.t >= x.dur) || this.rings[0];
    r.t = 0; r.dur = dur; r.size = size;
    r.m.position.set(p.x, 0.04, p.z);
    r.m.material.color.setRGB(color[0], color[1], color[2]);
    r.m.visible = true;
  }

  impact(p, { color = [3.2, 2.0, 1.0], count = 16, speed = 5 } = {}) {
    this.sparks.emit(p, count, { color, speed, up: 1.2, gravity: 7, life: 0.4, size: 0.06 });
    this.flash(p, color, 0.85);
  }

  splash(p) {
    this.sparks.emit(p, 34, { color: [0.9, 1.05, 1.3], speed: 3.2, up: 2.6, gravity: 11, life: 0.6, size: 0.05, spread: 1.4 });
    this.ring(p, [0.3, 0.4, 0.6], 1.1, 0.5);
  }

  shockwave(p, color) {
    this.ring(p, color, 5.5, 0.55);
    this.ring(p, [color[0] * 0.5, color[1] * 0.5, color[2] * 0.5], 3.2, 0.8);
    tmpV.set(p.x, 0.15, p.z);
    this.sparks.emit(tmpV, 40, { color, speed: 7, up: 0.8, gravity: 4, life: 0.6, size: 0.07, spread: 1.6 });
    this.splash(tmpV);
  }

  setScale(px) {
    this.sparks.uniforms.uScale.value = px;
  }

  update(dt) {
    this.sparks.update(dt);
    for (const f of this.flashes) {
      if (f.t >= f.dur) { f.s.visible = false; continue; }
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const s = f.size * (0.4 + k * 1.2);
      f.s.scale.set(s, s, 1);
      f.s.material.opacity = 1 - k;
    }
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.m.scale.setScalar(0.2 + r.size * (1 - (1 - k) * (1 - k)));
      r.m.material.opacity = 1 - k;
    }
  }
}

const tmpV = new THREE.Vector3();
