// Vento-guia: depois de cada onda, folhas, pétalas e rastros de vento correm na direção da
// próxima zona (sem setas nem marcadores na tela).
import * as THREE from 'three';
import { petalTex } from './textures.js';

const tmp = new THREE.Vector3();

export class Wind {
  constructor(scene) {
    this.target = null;
    this.k = 0; // intensidade (0..1), suavizada
    this.dir = new THREE.Vector3(1, 0, 0);
    // folhas e pétalas
    const N = this.N = 150;
    const geo = new THREE.PlaneGeometry(0.075, 0.1);
    const mat = new THREE.MeshStandardMaterial({ map: petalTex(), alphaTest: 0.5, color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x2a1a20, emissiveIntensity: 0.7 });
    this.leaves = new THREE.InstancedMesh(geo, mat, N);
    this.leaves.frustumCulled = false;
    const cols = [0xd96aa8, 0xe8a0c8, 0xc8a040, 0x8fb04a, 0xe07ab8];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) this.leaves.setColorAt(i, c.setHex(cols[i % cols.length]));
    scene.add(this.leaves);
    this.L = [];
    for (let i = 0; i < N; i++) this.L.push({ p: new THREE.Vector3(0, -10, 0), v: new THREE.Vector3(), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0), age: 9, life: 1, w: 0.5 + Math.random() });
    // rastros de vento (linhas claras, aditivas)
    const M = this.M = 40;
    const pos = new Float32Array(M * 2 * 3), alpha = new Float32Array(M * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.trails = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * vA, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.trails.frustumCulled = false;
    this.trails.renderOrder = 8;
    scene.add(this.trails);
    this.T = [];
    for (let i = 0; i < M; i++) this.T.push({ p: new THREE.Vector3(0, -10, 0), age: 9, life: 1, len: 2 });
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.one = new THREE.Vector3(1, 1, 1);
  }

  // Direciona o vento para um ponto (ou desliga com null).
  guide(target) {
    this.target = target ? new THREE.Vector3(target[0], 0, target[1]) : null;
  }

  update(dt, t, center) {
    const on = !!this.target;
    this.k += ((on ? 1 : 0) - this.k) * (1 - Math.exp(-1.5 * dt));
    if (on) {
      tmp.subVectors(this.target, center).setY(0);
      if (tmp.lengthSq() > 0.01) this.dir.lerp(tmp.normalize(), 1 - Math.exp(-3 * dt)).normalize();
    }
    const d = this.dir, side = tmp.set(-d.z, 0, d.x);
    const rate = this.k;
    for (let i = 0; i < this.N; i++) {
      const o = this.L[i];
      o.age += dt;
      if (o.age > o.life) {
        if (Math.random() > rate * 0.9) { o.p.y = -10; o.age = 0; o.life = 0.2; }
        else {
          const back = 3 + Math.random() * 4, lat = (Math.random() - 0.5) * 7;
          o.p.set(center.x - d.x * back + side.x * lat, 0.2 + Math.random() * 2.4, center.z - d.z * back + side.z * lat);
          o.v.copy(d).multiplyScalar(4 + Math.random() * 3);
          o.v.y = 0.3 + Math.random() * 0.5;
          o.age = 0;
          o.life = 2 + Math.random() * 1.6;
        }
      }
      if (o.p.y > -5) {
        o.p.addScaledVector(o.v, dt);
        o.p.y += Math.sin(t * 3 + i) * 0.6 * dt;
        o.p.addScaledVector(side, Math.cos(t * 2.2 + i * 1.7) * 0.9 * dt);
        o.r.x += dt * o.w * 6;
        o.r.y += dt * o.w * 4;
      }
      const f = o.age / o.life;
      const s = o.p.y > -5 ? Math.sin(Math.PI * Math.min(1, f)) : 0;
      this.q.setFromEuler(this.e.set(o.r.x, o.r.y, 0));
      this.m4.compose(o.p, this.q, this.one.setScalar(Math.max(0.001, s)));
      this.leaves.setMatrixAt(i, this.m4);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    const pos = this.trails.geometry.attributes.position.array, al = this.trails.geometry.attributes.aA.array;
    for (let i = 0; i < this.M; i++) {
      const o = this.T[i];
      o.age += dt;
      if (o.age > o.life && Math.random() < rate * dt * 6) {
        const back = 2 + Math.random() * 5, lat = (Math.random() - 0.5) * 6;
        o.p.set(center.x - d.x * back + side.x * lat, 0.4 + Math.random() * 2.2, center.z - d.z * back + side.z * lat);
        o.age = 0;
        o.life = 0.7 + Math.random() * 0.6;
        o.len = 1.2 + Math.random() * 2.2;
      }
      const f = Math.min(1, o.age / o.life);
      const a = o.age < o.life ? Math.sin(Math.PI * f) * 0.5 * this.k : 0;
      o.p.addScaledVector(d, dt * 9);
      const wave = Math.sin(t * 4 + i) * 0.08;
      pos[i * 6] = o.p.x; pos[i * 6 + 1] = o.p.y + wave; pos[i * 6 + 2] = o.p.z;
      pos[i * 6 + 3] = o.p.x + d.x * o.len; pos[i * 6 + 4] = o.p.y - wave; pos[i * 6 + 5] = o.p.z + d.z * o.len;
      al[i * 2] = 0; al[i * 2 + 1] = a;
    }
    this.trails.geometry.attributes.position.needsUpdate = true;
    this.trails.geometry.attributes.aA.needsUpdate = true;
  }
}
