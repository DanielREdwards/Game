// Personagem articulado: tronco anatômico por revolução, membros em cápsulas, rosto, cabelo,
// figurino e acessórios descritos por um objeto "look" (ver characters.js).
import * as THREE from 'three';
import { JOINTS } from './poses.js';
import { makeTommy, makePistol } from './weapons.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const GEO = {};
const geo = (key, make) => GEO[key] || (GEO[key] = make());
const cap = (r, l) => geo(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 16));
const sph = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 22, 16));
const cyl = (rt, rb, h, open = false, seg = 24) => geo(`y${rt}_${rb}_${h}_${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const box = (x, y, z) => geo(`b${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));

// Perfis (raio, altura) do tórax e do abdômen. A rotação de −90° põe a costura sob o braço direito.
function lathe(key, pts) {
  return geo(key, () => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 36);
    g.rotateY(-Math.PI / 2);
    return g;
  });
}
const CHEST = [[0.116, -0.06], [0.131, 0], [0.149, 0.06], [0.162, 0.12], [0.168, 0.18], [0.169, 0.235], [0.164, 0.28], [0.148, 0.318], [0.118, 0.347], [0.08, 0.365], [0.045, 0.374], [0.01, 0.377]];
const ABDOMEN = [[0.136, -0.05], [0.129, 0], [0.123, 0.06], [0.121, 0.12], [0.127, 0.18], [0.134, 0.24]];

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
        `float rimF = 1.0 - saturate(dot(nonPerturbedNormal, normalize(vViewPosition)));
        outgoingLight += uRimColor * pow(rimF, 3.0) * uRimStrength;
        outgoingLight = mix(outgoingLight, vec3(1.7, 1.5, 1.3), uFlash);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'char-rim';
  return m;
}

export class Rig {
  constructor(look, scale, blobMat) {
    this.fx = {
      rimColor: { value: new THREE.Color(look.rim) },
      rimStrength: { value: look.rimStrength ?? 0.6 },
      flash: { value: 0 },
    };
    const M = {};
    for (const [k, p] of Object.entries(look.mats)) M[k] = makeCharMaterial(p, this.fx);
    const P = (k) => M[look.parts[k]];
    const wide = look.wide || 1;
    const leg = look.leg || 1;
    const arm = look.arm || 1;

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
    const mesh = (g, m, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      const me = new THREE.Mesh(g, m);
      me.position.set(x, y, z);
      me.scale.set(sx, sy, sz);
      me.rotation.set(rx, ry, rz);
      me.castShadow = true;
      parent.add(me);
      return me;
    };

    // ---------------- tronco
    const hips = joint('hips', this.body, 0, 0.95, 0);
    mesh(cap(0.12, 0.05), P('pelvis'), hips, 0, 0, 0, 1.32 * wide * leg, 0.92, 0.88 * leg);
    const spine = joint('spine', hips, 0, 0.06, 0);
    mesh(lathe('abd', ABDOMEN), P('abdomen'), spine, 0, 0, 0, 1.18 * wide, 1, 0.8 * wide);
    const chest = joint('chest', spine, 0, 0.2, 0);
    mesh(lathe('chest', CHEST), P('chest'), chest, 0, 0, 0, 1.3 * wide, 1, 0.78 * wide);
    const neck = joint('neck', chest, 0, 0.33, 0);
    mesh(cyl(0.05, 0.058, 0.13), P('neck'), neck, 0, 0.03, 0, wide, 1, wide);
    const head = joint('head', neck, 0, 0.09, 0);

    // ---------------- cabeça e rosto
    const skin = P('head');
    mesh(sph(0.11), skin, head, 0, 0.1, 0.005, 0.9, 1.1, 1.0);
    const bearded = !!look.face?.beard;
    mesh(sph(0.068), M[look.face?.beard] || skin, head, 0, 0.05, 0.024, bearded ? 1.04 : 0.95, 0.8, bearded ? 1.02 : 0.95);
    for (const s of [1, -1]) mesh(sph(0.025), skin, head, 0.098 * s, 0.095, -0.005, 0.6, 1, 1);
    const dark = M[look.face?.brow] || M.hair;
    if (dark) {
      for (const s of [1, -1]) {
        mesh(box(0.042, 0.009, 0.014), dark, head, 0.04 * s, 0.14, 0.098, 1, 1, 1, 0, 0, s * 0.16);
        mesh(sph(0.012), M.eye || dark, head, 0.038 * s, 0.118, 0.096);
      }
    }
    mesh(cap(0.012, 0.02), skin, head, 0, 0.096, 0.112, 1, 1, 1, -0.35);
    mesh(box(0.034, 0.005, 0.006), M.lip || dark || skin, head, 0, 0.063, 0.106);
    if (look.face?.mustache) mesh(box(0.05, 0.012, 0.012), M[look.face.mustache], head, 0, 0.077, 0.108);

    const hairM = M[look.parts.hair];
    if (hairM && look.hair !== 'bald') {
      const capG = geo('hair', () => new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56));
      mesh(capG, hairM, head, 0, 0.115, -0.012, 0.95, 1.12, 1.04, -0.32);
      if (look.hair === 'textured') {
        const cone = geo('spike', () => new THREE.ConeGeometry(0.03, 0.1, 6));
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = 0.035 + (i % 3) * 0.018;
          const sp = mesh(cone, hairM, head, Math.sin(a) * r, 0.225 + (i % 2) * 0.01, Math.cos(a) * r - 0.01);
          sp.rotation.set(-0.35 + Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        }
        for (let i = 0; i < 5; i++) {
          const sp = mesh(cone, hairM, head, -0.05 + i * 0.025, 0.2, 0.085, 1, 1.2, 1);
          sp.rotation.set(2.2 + (i % 2) * 0.2, 0, (i - 2) * 0.15);
        }
      }
    }

    // ---------------- braços
    const sw = (look.shoulder || 0.19) * wide;
    for (const s of [1, -1]) {
      const p = s > 0 ? 'l' : 'r';
      const sh = joint(p + 'Sh', chest, sw * s, 0.25, 0);
      mesh(sph(0.064), P(p + 'Delt') || P(p + 'Upper'), sh, 0, -0.03, 0, arm, 1.22, arm * 0.95);
      mesh(cap(0.058, 0.17), P(p + 'Upper'), sh, 0, -0.14, 0, arm, 1, arm);
      const el = joint(p + 'El', sh, 0, -0.29, 0);
      mesh(cap(0.05, 0.17), P(p + 'Lower'), el, 0, -0.13, 0, arm, 1, arm);
      if (look.cuffs) mesh(cyl(0.052, 0.052, 0.03, true, 16), M[look.cuffs], el, 0, -0.235, 0, arm, 1, arm);
      mesh(sph(0.052), P('hand'), el, 0, -0.29, 0.005, 0.9, 1.05, 1.05);
      joint(p + 'Fist', el, 0, -0.3, 0);
    }

    // ---------------- pernas
    for (const s of [1, -1]) {
      const p = s > 0 ? 'l' : 'r';
      const hp = joint(p + 'Hip', hips, 0.1 * s * wide, -HIP_DROP, 0);
      mesh(cap(0.082, 0.27), P('thigh'), hp, 0, -0.21, 0, leg, 1, leg);
      if (look.cargo) {
        mesh(box(0.035, 0.13, 0.12), M[look.cargo], hp, 0.09 * s * leg, -0.25, 0.01);
        mesh(box(0.04, 0.025, 0.125), M[look.cargo], hp, 0.092 * s * leg, -0.18, 0.01);
      }
      const kn = joint(p + 'Kn', hp, 0, -UPPER, 0);
      mesh(cap(0.066, 0.27), P('shin'), kn, 0, -0.21, 0, leg, 1, leg);
      const an = joint(p + 'Ank', kn, 0, -LOWER, 0);
      mesh(cap(0.05, 0.14), P('foot'), an, 0, -0.035, 0.05, 1.12, 1, 0.92, Math.PI / 2);
      if (look.sole) {
        mesh(cap(0.05, 0.15), M[look.sole], an, 0, -0.07, 0.05, 1.22, 1, 0.5, Math.PI / 2);
        mesh(cyl(0.06, 0.062, 0.08), P('foot'), an, 0, 0.0, -0.005);
      }
      joint(p + 'Foot', an, 0, -0.03, 0.1);
    }

    // ---------------- figurino e acessórios
    const A = look.acc || {};
    if (A.belt) {
      mesh(cyl(0.15, 0.148, 0.05, true, 28), M[A.belt], hips, 0, 0.05, 0, 1.3 * wide * leg, 1, 0.9 * leg);
      mesh(box(0.05, 0.036, 0.012), M[A.buckle], hips, 0, 0.05, 0.142 * leg);
    }
    if (A.skirt) {
      const [mat, h, flare] = A.skirt;
      const skM = makeCharMaterial({ ...look.mats[mat], side: THREE.DoubleSide }, this.fx);
      mesh(cyl(0.16, 0.16 + flare, h, true, 28), skM, hips, 0, 0.08 - h / 2, 0, 1.28 * wide, 1, 0.92);
    }
    if (A.chain) {
      const c = mesh(geo('neckchain', () => new THREE.TorusGeometry(0.095, 0.0045, 6, 40)), M[A.chain], chest, 0, 0.3, 0.035, 1.2, 1.6, 1, -0.82);
      c.castShadow = false;
      if (A.tag) mesh(box(0.028, 0.045, 0.005), M[A.chain], chest, 0, 0.19, 0.134 * wide, 1, 1, 1, 0.1);
    }
    if (A.earrings) {
      for (const s of [1, -1]) mesh(geo('ear', () => new THREE.TorusGeometry(0.011, 0.0028, 6, 14)), M[A.earrings], head, 0.103 * s, 0.075, 0.0, 1, 1, 1, 0, Math.PI / 2);
    }
    if (A.hat) {
      const [crown, band] = A.hat;
      const hat = new THREE.Group();
      hat.position.set(0, 0.19, -0.004);
      hat.rotation.set(0.08, 0, 0.05);
      head.add(hat);
      mesh(cyl(0.098, 0.113, 0.11), M[crown], hat, 0, 0.05, 0);
      mesh(sph(0.098), M[crown], hat, 0, 0.1, 0, 1, 0.25, 1.05);
      mesh(cyl(0.1145, 0.1145, 0.03), M[band], hat, 0, 0.012, 0);
      mesh(cyl(0.2, 0.2, 0.01, false, 36), M[crown], hat, 0, -0.005, 0.01, 1, 1, 1.08, 0.05);
    }
    if (A.shades) {
      for (const s of [1, -1]) mesh(cyl(0.024, 0.024, 0.006, false, 16), M[A.shades], head, 0.037 * s, 0.118, 0.107, 1, 1, 1, Math.PI / 2);
      mesh(box(0.03, 0.005, 0.005), M[A.shades], head, 0, 0.122, 0.108);
    }
    this.ember = null;
    if (A.smoke) {
      const big = A.smoke === 'cigar';
      const holder = new THREE.Group();
      holder.position.set(0.018, 0.062, 0.11);
      holder.rotation.set(Math.PI / 2 + 0.3, 0, -0.25);
      head.add(holder);
      const len = big ? 0.085 : 0.06;
      mesh(cap(big ? 0.011 : 0.0055, len), M[big ? 'cigar' : 'paper'], holder, 0, len / 2 + 0.01, 0).castShadow = false;
      const ember = new THREE.Mesh(sph(big ? 0.012 : 0.007), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.35) }));
      ember.position.set(0, len + 0.022, 0);
      holder.add(ember);
      this.ember = ember;
    }

    // ---------------- arma na mão direita
    this.muzzle = null;
    if (look.weapon) {
      const w = look.weapon === 'tommy' ? makeTommy() : makePistol();
      j.rFist.add(w.group);
      w.group.position.set(0, 0.02, 0.0);
      this.muzzle = w.muzzle;
      this.weapon = look.weapon;
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
