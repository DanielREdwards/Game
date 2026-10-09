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
    this.dodgeTex = T.dodgeTex();
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 48);
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);

    // Luz única reaproveitada para clarões de disparo (a contagem de luzes nunca muda).
    this.light = new THREE.PointLight(0xffb060, 0, 7, 2);
    scene.add(this.light);
    this.lightT = 0;

    this.tracers = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(this.unitBox, new THREE.MeshBasicMaterial({
        color: new THREE.Color(4, 3, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      m.visible = false;
      m.renderOrder = 6;
      scene.add(m);
      this.tracers.push({ m, t: 1 });
    }
    const smoke = T.smokeTex(rng);
    this.puffs = [];
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, color: 0xcfc8d8, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      s.renderOrder = 9;
      scene.add(s);
      this.puffs.push({ s, t: 9, life: 1.6 });
    }

    // brilho de estrela do confronto
    this.glintS = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starTex(), color: new THREE.Color(3.2, 3.4, 4.2), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.glintS.visible = false;
    this.glintS.renderOrder = 21;
    scene.add(this.glintS);
    this.glintT = 9;

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

  muzzle(p) {
    this.flash(p, [5, 3.2, 1.2], 0.42, 0.05);
    this.sparks.emit(p, 4, { color: [4, 2.6, 0.9], speed: 3, up: 0.3, gravity: 3, life: 0.12, size: 0.04 });
    this.light.position.copy(p);
    this.light.intensity = 30;
    this.lightT = 0.05;
  }

  tracer(a, b) {
    const tr = this.tracers.find((x) => x.t >= 0.08) || this.tracers[0];
    tr.t = 0;
    const len = a.distanceTo(b);
    tr.m.position.lerpVectors(a, b, 0.5);
    tr.m.lookAt(b);
    tr.m.scale.set(0.014, 0.014, len);
    tr.m.visible = true;
  }

  ricochet(p) {
    this.sparks.emit(p, 7, { color: [3.2, 2.4, 1.2], speed: 2.5, up: 1.4, gravity: 9, life: 0.3, size: 0.035 });
  }

  // Fumaça de charuto/cigarro.
  puff(p) {
    const f = this.puffs.find((x) => x.t >= x.life) || this.puffs[0];
    f.t = 0;
    f.s.position.copy(p);
    f.s.material.rotation = Math.random() * 6;
    f.s.visible = true;
  }

  // Partículas de cura subindo devagar (cor de jade).
  rise(p) {
    this.sparks.emit(p, 1, { color: [0.5, 2.4, 1.7], speed: 0.25, up: 1.1, gravity: -0.6, life: 0.9, size: 0.045, spread: 0.6 });
  }

  // Arma quebrando: cacos de vidro, lascas de madeira ou faíscas de metal.
  shatter(p, kind) {
    if (kind === 'glass') {
      this.sparks.emit(p, 46, { color: [1.6, 2.4, 2.0], speed: 5.5, up: 1.6, gravity: 10, life: 0.6, size: 0.035, spread: 1.4 });
      this.flash(p, [2.0, 2.6, 2.4], 1.0, 0.12);
    } else if (kind === 'wood') {
      this.sparks.emit(p, 30, { color: [1.3, 0.75, 0.35], speed: 4, up: 1.8, gravity: 11, life: 0.7, size: 0.045, spread: 1.2 });
    } else {
      this.sparks.emit(p, 24, { color: [4, 2.4, 0.8], speed: 6, up: 1.2, gravity: 9, life: 0.4, size: 0.03 });
      this.flash(p, [3.5, 2.4, 1.2], 0.7, 0.08);
    }
  }

  // Brilho de estrela sobre o adversário no confronto: sinal para soltar o botão.
  glint(p) {
    this.glintS.position.copy(p);
    this.glintS.visible = true;
    this.glintT = 0;
  }

  setScale(px) {
    this.sparks.uniforms.uScale.value = px;
  }

  update(dt) {
    this.sparks.update(dt);
    if (this.glintT < 0.55) {
      this.glintT += dt;
      const k = this.glintT / 0.55;
      const sc = (k < 0.18 ? k / 0.18 : 1 - (k - 0.18) * 0.6) * 0.5;
      this.glintS.scale.set(sc, sc, 1);
      this.glintS.material.rotation = k * 0.8;
      this.glintS.material.opacity = 1 - Math.max(0, k - 0.7) / 0.3;
      if (k >= 1) this.glintS.visible = false;
    }
    if (this.lightT > 0 && (this.lightT -= dt) <= 0) this.light.intensity = 0;
    for (const tr of this.tracers) {
      if (tr.t >= 0.08) { tr.m.visible = false; continue; }
      tr.t += dt;
      tr.m.material.opacity = 1 - tr.t / 0.08;
    }
    for (const f of this.puffs) {
      if (f.t >= f.life) { f.s.visible = false; continue; }
      f.t += dt;
      const k = f.t / f.life;
      f.s.position.y += dt * 0.35;
      f.s.position.x += dt * 0.08;
      f.s.scale.setScalar(0.08 + k * 0.45);
      f.s.material.opacity = 0.22 * Math.sin(Math.PI * Math.min(1, k));
    }
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

function starTex() {
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  const h = S / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(220,235,255,0.55)');
  gr.addColorStop(1, 'rgba(160,200,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const ray = (a, len, w) => {
    g.save();
    g.translate(h, h);
    g.rotate(a);
    const lg = g.createLinearGradient(0, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(200,225,255,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath();
    g.fill();
    g.restore();
  };
  for (let k = 0; k < 4; k++) ray((k * Math.PI) / 2, h * 0.98, 5);
  for (let k = 0; k < 4; k++) ray((k * Math.PI) / 2 + Math.PI / 4, h * 0.45, 3);
  return T.toTex(c);
}
