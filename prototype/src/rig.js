// Personagem com malha contínua deformada por esqueleto, cabeça esculpida, olhos, cabelo e acessórios.
// A interface (juntas em this.j, applyPose, world, updateShadow) é a mesma usada pelo combate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { JOINTS } from './poses.js';
import { makeTommy, makePistol, makePipe } from './weapons.js';
import { makeSkeleton } from './body/factory.js';
import { SEG, EYE } from './body/humanoid.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const GEO = {};
const geo = (key, make) => GEO[key] || (GEO[key] = make());

// Chapéu fedora torneado: copa com vinco no alto, aba fina levemente caída na borda.
function fedoraGeometry() {
  const P = [[0, 0.094], [0.028, 0.1], [0.05, 0.108], [0.064, 0.106], [0.072, 0.096], [0.077, 0.06], [0.082, 0.02], [0.085, 0.006],
    [0.104, 0.003], [0.122, -0.002], [0.131, -0.009], [0.13, -0.014], [0.122, -0.01], [0.102, -0.004], [0.085, -0.001], [0.078, 0]];
  const g = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 48);
  g.scale(1, 1, 1.18);
  g.computeVertexNormals();
  return g;
}

// Boina de jornaleiro: copa achatada puxada para a frente sobre a pala curta.
function flatCapGeometry() {
  const P = [[0, 0.056], [0.04, 0.054], [0.07, 0.044], [0.088, 0.026], [0.092, 0.008], [0.088, -0.004], [0.08, -0.004]];
  const g = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 40);
  g.scale(1, 1, 1.2);
  g.translate(0, 0, 0.012);
  const visor = new THREE.CylinderGeometry(0.1, 0.1, 0.006, 32, 1, false, -0.95, 1.9);
  visor.scale(1, 1, 1.25);
  visor.translate(0, -0.004, 0.012);
  const pos = visor.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - Math.max(0, pos.getZ(i) - 0.07) * 0.25);
  const merged = mergeGeometries([g.toNonIndexed(), visor.toNonIndexed()]);
  merged.computeVertexNormals();
  return merged;
}

// MeshStandardMaterial + contorno colorido discreto (rim light) + clarão ao ser atingido.
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
      rimStrength: { value: look.rimStrength ?? 0.3 },
      flash: { value: 0 },
    };
    const fx = this.fx;
    const std = (p) => makeCharMaterial(p, fx);

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

    // esqueleto próprio (cada instância) sobre a geometria compartilhada
    const { B, list } = makeSkeleton(look.wide);
    this.j = B;
    this.body.add(B.hips);
    const T = look.tex;
    const bodyMat = std({
      map: T.map, roughnessMap: T.roughnessMap, roughness: 1, metalness: 0,
      normalMap: T.normalMap || null, normalScale: new THREE.Vector2(0.8, 0.8),
    });
    const mesh = new THREE.SkinnedMesh(look.assets.body.geometry, bodyMat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.body.add(mesh);
    this.root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    this.mesh = mesh;

    // grupo da cabeça: queixo logo abaixo do osso (pescoço com comprimento natural)
    const head = new THREE.Group();
    head.position.y = -0.025;
    head.scale.setScalar(look.headScale || 1.07);
    B.head.add(head);
    const add = (g, m, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const me = new THREE.Mesh(g, m);
      me.position.set(x, y, z);
      me.rotation.set(rx, ry, rz);
      me.scale.set(sx, sy, sz);
      me.castShadow = true;
      parent.add(me);
      return me;
    };
    add(look.assets.head.geometry, std({ map: T.head, roughness: 0.58 }), head);
    // olhos: decalque amendoado sobre o globo esculpido (as pálpebras são a própria cabeça)
    const eyeM = new THREE.MeshStandardMaterial({ map: T.eye, roughness: 0.22, alphaTest: 0.5 });
    for (const s of [1, -1]) {
      const e = add(geo('eye', () => new THREE.SphereGeometry(EYE.r + 0.0009, 40, 20)), eyeM, head, s * EYE.x, EYE.y, EYE.z, 0, s * 0.12, 0, s, 1, 1);
      e.castShadow = false;
    }
    if (look.assets.hair) {
      add(look.assets.hair.geometry, std({ map: T.hair || null, normalMap: T.hairN || null, color: T.hair ? 0xffffff : look.hairColor, roughness: 0.5 }), head);
    }

    const A = look.acc || {};
    const metal = (c, r = 0.18) => std({ color: c, roughness: r, metalness: 1 });
    if (A.hat) {
      const [kind, color] = A.hat;
      const hm = std({ color: new THREE.Color(color), roughness: 0.82, side: THREE.DoubleSide });
      const band = std({ color: 0x0b0b0c, roughness: 0.6 });
      const hat = new THREE.Group();
      head.add(hat);
      if (kind === 'fedora') {
        hat.position.set(0, 0.161, -0.006);
        hat.rotation.set(0.13, 0, 0.04);
        add(geo('fedora', fedoraGeometry), hm, hat);
        add(geo('fedoraBand', () => new THREE.CylinderGeometry(0.0848, 0.0858, 0.026, 40, 1, true).scale(1, 1, 1.18)), band, hat, 0, 0.019, 0);
      } else {
        hat.position.set(0, 0.163, 0.0);
        hat.rotation.set(0.14, 0, 0);
        add(geo('flatcap', flatCapGeometry), hm, hat);
        add(geo('capBtn', () => new THREE.SphereGeometry(0.009, 10, 6)), hm, hat, 0, 0.052, 0.012);
      }
    }
    if (A.shades) {
      const sm = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.04, metalness: 0.6 });
      const fm = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.3, metalness: 0.8 });
      for (const s of [1, -1]) add(geo('lens', () => new THREE.CylinderGeometry(0.0175, 0.0175, 0.004, 24)), sm, head, s * 0.033, EYE.y + 0.001, 0.089, Math.PI / 2, 0, -s * 0.18);
      add(geo('bridge', () => new THREE.BoxGeometry(0.022, 0.003, 0.003)), fm, head, 0, EYE.y + 0.006, 0.094);
      for (const s of [1, -1]) add(geo('temple', () => new THREE.BoxGeometry(0.003, 0.003, 0.085)), fm, head, s * 0.0765, EYE.y + 0.004, 0.045, 0, s * 0.12, 0);
    }
    this.ember = null;
    if (A.smoke) {
      const big = A.smoke === 'cigar';
      const holder = new THREE.Group();
      holder.position.set(0.012, 0.045, 0.091);
      holder.rotation.set(Math.PI / 2 + 0.3, 0, -0.25);
      head.add(holder);
      const len = big ? 0.085 : 0.06;
      add(geo(big ? 'cigar' : 'cig', () => new THREE.CapsuleGeometry(big ? 0.0105 : 0.005, len, 4, 10)), std({ color: big ? 0x5a3317 : 0xeeeeea, roughness: 0.7 }), holder, 0, len / 2 + 0.008, 0).castShadow = false;
      const ember = new THREE.Mesh(geo('ember' + big, () => new THREE.SphereGeometry(big ? 0.011 : 0.0065, 10, 8)), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.35) }));
      ember.position.set(0, len + 0.02, 0);
      holder.add(ember);
      this.ember = ember;
    }
    if (A.chain) {
      const sm = metal(0xd8dade, 0.16);
      add(geo('neckchain', () => new THREE.TorusGeometry(0.075, 0.0042, 6, 44)), sm, B.chest, 0, 0.29, 0.03, -0.78, 0, 0, 1.25, 1.5, 1).castShadow = false;
      if (A.tag) add(geo('tag', () => new THREE.BoxGeometry(0.026, 0.042, 0.004)), sm, B.chest, 0, 0.165, 0.098, 0.25);
    }
    if (A.earrings) {
      const sm = metal(0xd8dade, 0.16);
      for (const s of [1, -1]) add(geo('earring', () => new THREE.TorusGeometry(0.0085, 0.0022, 6, 14)), sm, head, s * 0.082, 0.064, -0.006, 0, Math.PI / 2, 0).castShadow = false;
    }

    // arma na mão direita
    this.muzzle = null;
    this.weapon = null;
    this.held = null;
    if (look.weapon) this.setWeapon(look.weapon);

    this.shadow = new THREE.Mesh(geo('blob', () => new THREE.PlaneGeometry(1, 1)), blobMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.shadowBase = 1.2 * scale;
  }

  // Troca o que está na mão direita: 'tommy', 'pistol', 'pipe' ou um objeto 3D (arma do chão).
  setWeapon(w) {
    if (this.held) this.j.rFist.remove(this.held);
    this.held = null;
    this.muzzle = null;
    this.weapon = null;
    if (!w) return;
    let group;
    if (w === 'tommy' || w === 'pistol') {
      const g = w === 'tommy' ? makeTommy() : makePistol();
      group = g.group;
      this.muzzle = g.muzzle;
      group.position.set(0, 0.02, 0);
    } else if (w === 'pipe') {
      group = makePipe();
    } else group = w;
    this.weapon = typeof w === 'string' ? w : 'item';
    this.j.rFist.add(group);
    this.held = group;
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
    const leg = (h, k) => SEG.HIP_DROP + Math.cos(h[2]) * (SEG.UPPER * Math.cos(h[0]) + SEG.LOWER * Math.cos(h[0] + k[0])) + SEG.SOLE;
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
