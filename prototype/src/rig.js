// Personagem articulado montado com primitivas (cápsulas/esferas) e material com luz de contorno.
import * as THREE from 'three';
import { JOINTS } from './poses.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const GEO = {};
const geo = (key, make) => GEO[key] || (GEO[key] = make());
const cap = (r, l) => geo(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const sph = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 22, 16));

const UPPER = 0.43, LOWER = 0.41, HIP_DROP = 0.03, SOLE = 0.075;

// MeshStandardMaterial + contorno colorido (rim light) + clarão branco ao ser atingido.
export function makeCharMaterial(params, fx) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = fx.rimColor;
    sh.uniforms.uRimStrength = fx.rimStrength;
    sh.uniforms.uFlash = fx.flash;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uFlash;')
      .replace(
        '#include <opaque_fragment>',
        `float rimF = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
        outgoingLight += uRimColor * pow(rimF, 3.0) * uRimStrength;
        outgoingLight = mix(outgoingLight, vec3(1.7, 1.5, 1.3), uFlash);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'char-rim';
  return m;
}

export class Rig {
  constructor(outfit, scale, blobMat) {
    this.fx = {
      rimColor: { value: new THREE.Color(outfit.rim) },
      rimStrength: { value: outfit.rimStrength ?? 0.6 },
      flash: { value: 0 },
    };
    const M = {};
    for (const [k, p] of Object.entries(outfit.mats)) M[k] = makeCharMaterial(p, this.fx);
    const part = (k) => M[outfit.parts[k]];
    const wide = outfit.wide || 1;

    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); // pivô no chão: quedas
    this.spin = new THREE.Group(); // pivô no centro do corpo: rolamentos
    this.body = new THREE.Group();
    this.root.add(this.tilt);
    this.tilt.add(this.spin);
    this.spin.add(this.body);
    this.spin.position.y = 0.55 * scale;
    this.body.position.y = -0.55 * scale;
    this.body.scale.setScalar(scale);

    const j = (this.j = {});
    const joint = (name, parent, x, y, z) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      parent.add(o);
      j[name] = o;
      return o;
    };
    const mesh = (g, m, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0) => {
      const me = new THREE.Mesh(g, m);
      me.position.set(x, y, z);
      me.scale.set(sx, sy, sz);
      me.rotation.x = rx;
      me.castShadow = true;
      parent.add(me);
      return me;
    };

    const hips = joint('hips', this.body, 0, 0.95, 0);
    mesh(cap(0.12, 0.05), part('pelvis'), hips, 0, 0, 0, 1.3 * wide, 0.9, 0.85);
    const spine = joint('spine', hips, 0, 0.06, 0);
    mesh(cap(0.12, 0.1), part('abdomen'), spine, 0, 0.1, 0, 1.15 * wide, 1, 0.82 * wide);
    const chest = joint('chest', spine, 0, 0.2, 0);
    mesh(cap(0.15, 0.12), part('chest'), chest, 0, 0.13, 0, 1.3 * wide, 1, 0.8 * wide);
    const neck = joint('neck', chest, 0, 0.33, 0);
    mesh(geo('neck', () => new THREE.CylinderGeometry(0.045, 0.052, 0.12, 12)), part('neck'), neck, 0, 0.03, 0, wide, 1, wide);
    const head = joint('head', neck, 0, 0.09, 0);
    mesh(sph(0.11), part('head'), head, 0, 0.1, 0.005, 0.9, 1.1, 1.0);
    mesh(sph(0.075), part('head'), head, 0, 0.04, 0.035, 1.0, 0.8, 1.0);
    for (const s of [1, -1]) mesh(sph(0.025), part('head'), head, 0.098 * s, 0.1, -0.005, 0.6, 1, 1);

    const ex = outfit.extras || {};
    if (ex.hair !== 'bald') {
      const capGeo = geo('hair', () => new THREE.SphereGeometry(0.118, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56));
      mesh(capGeo, M[outfit.parts.hair], head, 0, 0.115, -0.012, 0.95, 1.12, 1.04, -0.32);
      if (ex.hair === 'spiky') {
        const cone = geo('spike', () => new THREE.ConeGeometry(0.03, 0.09, 6));
        for (let i = 0; i < 7; i++) {
          const a = -0.9 + i * 0.3;
          const sp = mesh(cone, M[outfit.parts.hair], head, Math.sin(a) * 0.05, 0.235, -0.02 + Math.cos(a * 2) * 0.03);
          sp.rotation.set(-0.5 + i * 0.05, 0, -a * 0.6);
        }
      }
    }
    if (ex.shades) {
      mesh(geo('shades', () => new THREE.BoxGeometry(0.2, 0.045, 0.04)), M[ex.shades], head, 0, 0.115, 0.095);
    }
    if (ex.collar) {
      const t = mesh(geo('collar', () => new THREE.TorusGeometry(0.1, 0.034, 8, 18)), M[ex.collar], chest, 0, 0.3, -0.005, 1.15, 1, 0.95);
      t.rotation.x = Math.PI / 2 - 0.15;
    }
    if (ex.chain) {
      const t = mesh(geo('chain', () => new THREE.TorusGeometry(0.12, 0.012, 6, 24)), M[ex.chain], chest, 0, 0.23, 0.07);
      t.rotation.x = Math.PI / 2 - 0.9;
    }

    for (const s of [1, -1]) {
      const p = s > 0 ? 'l' : 'r';
      const sh = joint(p + 'Sh', chest, 0.19 * s * wide, 0.25, 0);
      mesh(sph(0.068), part('upperArm'), sh, 0, -0.01, 0, wide, 1, wide);
      mesh(cap(0.056, 0.17), part('upperArm'), sh, 0, -0.14, 0, wide, 1, wide);
      const el = joint(p + 'El', sh, 0, -0.29, 0);
      mesh(cap(0.048, 0.17), part('forearm'), el, 0, -0.13, 0, wide, 1, wide);
      mesh(sph(0.052), part('hand'), el, 0, -0.29, 0.005, 0.9 * wide, 1.05, 1.05 * wide);
      joint(p + 'Fist', el, 0, -0.3, 0);
      const hp = joint(p + 'Hip', hips, 0.1 * s * wide, -HIP_DROP, 0);
      mesh(cap(0.08, 0.27), part('thigh'), hp, 0, -0.21, 0, wide, 1, wide);
      const kn = joint(p + 'Kn', hp, 0, -UPPER, 0);
      mesh(cap(0.063, 0.27), part('shin'), kn, 0, -0.21, 0, wide, 1, wide);
      const an = joint(p + 'Ank', kn, 0, -LOWER, 0);
      mesh(cap(0.048, 0.14), part('foot'), an, 0, -0.035, 0.05, 1.1, 1, 0.9, Math.PI / 2);
      joint(p + 'Foot', an, 0, -0.03, 0.1);
    }

    this.shadow = new THREE.Mesh(geo('blob', () => new THREE.PlaneGeometry(1, 1)), blobMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.shadowBase = 1.2 * scale;
  }

  // Aplica a pose suavizando (alpha 0..1). O quadril é ajustado para o pé de apoio tocar o chão.
  applyPose(p, a) {
    for (const n of JOINTS) {
      const v = p[n];
      _e.set(v[0], v[1], v[2]);
      _q.setFromEuler(_e);
      this.j[n].quaternion.slerp(_q, a);
    }
    for (const s of ['l', 'r']) {
      const h = p[s + 'Hip'], k = p[s + 'Kn'];
      _e.set(-(h[0] + k[0]) * 0.85, 0, -h[2]);
      _q.setFromEuler(_e);
      this.j[s + 'Ank'].quaternion.slerp(_q, a);
    }
    const leg = (h, k) => HIP_DROP + Math.cos(h[2]) * (UPPER * Math.cos(h[0]) + LOWER * Math.cos(h[0] + k[0])) + SOLE;
    const target = Math.max(leg(p.lHip, p.lKn), leg(p.rHip, p.rKn)) + (p.hy || 0);
    this.j.hips.position.y += (target - this.j.hips.position.y) * a;
  }

  world(name, out) {
    return this.j[name].getWorldPosition(out);
  }

  updateShadow() {
    this.j.hips.getWorldPosition(_v);
    this.shadow.position.set(_v.x, 0.012, _v.z);
    const lying = Math.abs(this.tilt.rotation.x) > 0.6;
    const air = Math.max(0, this.root.position.y);
    this.shadow.scale.setScalar(this.shadowBase * (lying ? 1.6 : 1) * (1 - Math.min(0.5, air * 0.4)));
  }
}
