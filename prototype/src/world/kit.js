// Peças reutilizáveis do cenário: lotes de geometria estática (menos chamadas de desenho), fachadas
// compartilhadas, vitrines, letreiros e o registro de fontes de luz e postes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from '../textures.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Molduras de parede: origem, direção ao longo da parede (r), normal para a área livre (n) e giro
// dos planos voltados para n.
export function frame(o, r, n, ry) {
  return { o, r, n, ry };
}
export const at = (fr, u, v, off = 0) => fr.o.clone().addScaledVector(fr.r, u).setY(v).addScaledVector(fr.n, off);

// ---------------------------------------------------------------- lotes

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Junta malhas estáticas com o mesmo material numa só (uma chamada de desenho por material).
export class Batch {
  constructor() {
    this.parts = new Map();
  }

  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    return this.addMatrix(geo, mat, _m);
  }

  addMatrix(geo, mat, m4) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m4);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return g;
  }

  flush(scene, { shadow = false, receive = true, order = 0 } = {}) {
    const out = [];
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = receive;
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      out.push(mesh);
    }
    this.parts.clear();
    return out;
  }
}

// ---------------------------------------------------------------- luzes

// Fontes de luz do cenário (letreiros, vitrines, lanternas). Um conjunto fixo de luzes reais é
// redistribuído para as mais próximas (ver world.js).
export const SOURCES = [];
export function source(pos, color, intensity, range = 14) {
  SOURCES.push({ pos: pos.clone(), color: new THREE.Color(color), intensity, range });
}

// Postes: a luz com sombra acompanha o poste mais próximo do protagonista.
export const LAMPS = [];
export function lamp(pos, target, color = 0xffa457, power = 320) {
  LAMPS.push({ pos: pos.clone(), target: target.clone(), color: new THREE.Color(color), power });
}

// ---------------------------------------------------------------- fachadas

const FACADE_W = 9, FACADE_H = 36;

// Poucas variações de fachada (512 × 1024) reaproveitadas com tons diferentes.
export function facadeKit(rng) {
  const variants = [];
  for (let i = 0; i < 6; i++) {
    variants.push(T.facadeTex(rng, FACADE_W, FACADE_H, { base: '#c9c6bd', cols: 3, lit: 0.36 + (i % 3) * 0.06, cages: 0.25 + (i % 2) * 0.2 }));
  }
  for (const v of variants) {
    for (const t of [v.map, v.emissiveMap]) t.wrapS = THREE.RepeatWrapping;
  }
  const mats = new Map();
  const side = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.95 });
  return {
    side,
    mat(variant, tint) {
      const key = variant + ':' + tint;
      if (!mats.has(key)) {
        const v = variants[variant % variants.length];
        mats.set(key, new THREE.MeshStandardMaterial({
          map: v.map, emissiveMap: v.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.3, color: new THREE.Color(tint), roughness: 0.86,
        }));
      }
      return mats.get(key);
    },
  };
}

// Prédio: volume escuro + fachada texturizada na face voltada para a área livre.
export function building(batch, kit, fr, u0, u1, h, { variant = 0, tint = '#a9a59a', depth = 8 } = {}) {
  const w = u1 - u0, u = (u0 + u1) / 2;
  const c = at(fr, u, h / 2, -depth / 2);
  const along = Math.abs(fr.r.x) > 0.5;
  batch.add(new THREE.BoxGeometry(along ? w : depth, h, along ? depth : w), kit.side, c.x, c.y, c.z);
  const face = new THREE.PlaneGeometry(w, h);
  const uv = face.attributes.uv;
  const off = (u0 * 0.37) % 1;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / FACADE_W) + off, uv.getY(i) * (h / FACADE_H));
  const p = at(fr, u, h / 2, 0.01);
  batch.add(face, kit.mat(variant, tint), p.x, p.y, p.z, 0, fr.ry, 0);
}

// ---------------------------------------------------------------- térreo

const INTERIORS = new Map();
function interior(rng, kind) {
  if (!INTERIORS.has(kind)) {
    INTERIORS.set(kind, new THREE.MeshBasicMaterial({ map: T.interiorTex(rng, kind), color: new THREE.Color(0.92, 0.92, 0.92) }));
  }
  return INTERIORS.get(kind);
}

export function shopKit(rng) {
  return {
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.6, metalness: 0.4 }),
    shutter: new THREE.MeshStandardMaterial({ map: T.shutterTex(rng), roughness: 0.45, metalness: 0.55 }),
    shutterB: new THREE.MeshStandardMaterial({ map: T.shutterTex(rng, '#6d6458'), roughness: 0.45, metalness: 0.5 }),
    awnings: new Map(),
  };
}

const LIT = { cafe: 0xffc070, pharm: 0xb8ffe0, stair: 0xc8ffd8, mahjong: 0xffb060, massage: 0xff9ad0 };

// Vitrine acesa (interior pintado) com caixilhos e toldo opcional; registra uma fonte de luz.
export function litShop(batch, sk, rng, fr, u0, u1, kind, awning) {
  const w = u1 - u0, u = (u0 + u1) / 2;
  const p = at(fr, u, 1.5, 0.02);
  batch.add(new THREE.PlaneGeometry(w - 0.2, 2.9), interior(rng, kind), p.x, p.y, p.z, 0, fr.ry, 0);
  const post = new THREE.BoxGeometry(0.07, 3.0, 0.08);
  for (const du of [-w / 2 + 0.06, -w / 6, w / 6, w / 2 - 0.06]) {
    const q = at(fr, u + du, 1.5, 0.06);
    batch.add(post, sk.dark, q.x, q.y, q.z, 0, fr.ry, 0);
  }
  const top = at(fr, u, 3.0, 0.06);
  batch.add(new THREE.BoxGeometry(w, 0.1, 0.1), sk.dark, top.x, top.y, top.z, 0, fr.ry, 0);
  if (awning) {
    if (!sk.awnings.has(awning)) sk.awnings.set(awning, new THREE.MeshStandardMaterial({ color: awning, roughness: 0.5 }));
    const a = at(fr, u, 3.25, 0.55);
    batch.add(new THREE.BoxGeometry(w + 0.2, 0.08, 1.1), sk.awnings.get(awning), a.x, a.y, a.z, 0.12, fr.ry, 0, 1, 1, 1);
  }
  source(at(fr, u, 1.6, 1.4), LIT[kind] || 0xffd0a0, 6, 9);
}

export function closedShop(batch, sk, fr, u0, u1, alt = false) {
  const w = u1 - u0, u = (u0 + u1) / 2;
  const p = at(fr, u, 1.6, 0.03);
  batch.add(new THREE.PlaneGeometry(w - 0.1, 3.2), alt ? sk.shutterB : sk.shutter, p.x, p.y, p.z, 0, fr.ry, 0);
  const b = at(fr, u, 3.3, 0.16);
  const along = Math.abs(fr.r.x) > 0.5;
  batch.add(new THREE.BoxGeometry(along ? w : 0.32, 0.32, along ? 0.32 : w), sk.dark, b.x, b.y, b.z);
}

// ---------------------------------------------------------------- letreiros

const signMetal = new THREE.MeshStandardMaterial({ color: 0x18171d, roughness: 0.5, metalness: 0.6 });
const signArm = new THREE.BoxGeometry(0.4, 0.06, 0.06);

// Letreiro de neon ou de placa iluminada. perp: projeta-se da parede (visível dos dois lados).
export function sign({ scene, batch, flicker, rng }, fr, s) {
  const vertical = s.horiz ? false : !!(s.perp || s.vertical);
  const tex = T.neonTex(s.text, { color: s.color, vertical, w: s.w, h: s.h, style: s.style, plate: s.plate, ink: s.ink });
  const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(s.glow) });
  const mats = [signMetal, signMetal, signMetal, signMetal, face, face];
  const alongX = Math.abs(fr.r.x) > 0.5;
  let mesh;
  if (s.perp) {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.16), mats);
    mesh.position.copy(at(fr, s.u, s.v, (s.off ?? 0.35) + s.w / 2));
    if (alongX) mesh.rotation.y = Math.PI / 2;
    const off = s.off ?? 0.35;
    const ap = at(fr, s.u, s.v + s.h / 2 - 0.2, off / 2 + 0.03);
    batch.add(signArm, signMetal, ap.x, ap.y, ap.z, 0, alongX ? Math.PI / 2 : 0, 0, off / 0.4 + 0.15, 1, 1);
    if (s.w > 2.5) {
      // letreiros grandes sobre a rua: tirantes até a fachada
      for (const k of [0.2, 0.85]) {
        const tip = at(fr, s.u, s.v + s.h / 2, off + s.w * k);
        const base = at(fr, s.u, s.v + s.h / 2 + 1.6, 0.05);
        const mid = tip.clone().add(base).multiplyScalar(0.5);
        const len = tip.distanceTo(base);
        const g = new THREE.CylinderGeometry(0.012, 0.012, len, 4);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tip.clone().sub(base).normalize());
        batch.addMatrix(g, signMetal, new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
      }
    }
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.14), mats);
    mesh.position.copy(at(fr, s.u, s.v, s.off ?? 0.12));
    mesh.rotation.y = fr.ry;
  }
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
  source(at(fr, s.u, s.v, (s.perp ? (s.off ?? 0.35) + s.w / 2 : 0.4) + 0.8), s.color, (s.light ?? 1) * 14 * Math.min(1.6, (s.w * s.h) / 3 + 0.5), 13);
  if (s.flicker && flicker) {
    const st = { until: 0, next: 1 + rng() * 3 };
    flicker.push((t) => {
      if (t > st.next) {
        st.until = t + 0.04 + rng() * 0.14;
        st.next = t + (rng() < 0.6 ? 0.08 + rng() * 0.25 : 1.5 + rng() * 4);
      }
      face.color.setScalar(t < st.until ? s.glow * 0.1 : s.glow);
    });
  }
  return mesh;
}
