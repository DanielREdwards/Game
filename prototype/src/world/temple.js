// Zona 4 · 天后廟: pátio de um templo de Tin Hau ao norte da rua. Salão com telhado de beirais
// curvos, pórtico, leões de pedra, urna de bronze, lanternas vermelhas, espirais de incenso,
// figueira-de-bengala e bauhínia. Arquitetura genérica, desenhada por procedimento.
import * as THREE from 'three';
import * as T from '../textures.js';
import { V, frame, building, sign, source, lamp } from './kit.js';
import { addBox, addCircle } from '../map.js';
import { ell, cone, compile, field } from '../body/sdf.js';
import { surfaceNets } from '../body/mesher.js';

const X0 = -47.5, X1 = -30.5, ZF = 2.2; // pátio e frente do salão
const CX = (X0 + X1) / 2;

export function buildTemple(ctx) {
  const { scene, rng, batch, kit, ups } = ctx;

  // prédios em volta (o templo fica espremido entre torres, como é comum em Kowloon)
  const W = frame(V(-48, 0, -6), V(0, 0, 1), V(1, 0, 0), Math.PI / 2);
  const E = frame(V(-30, 0, -6), V(0, 0, 1), V(-1, 0, 0), -Math.PI / 2);
  const N = frame(V(-49, 0, -6.5), V(1, 0, 0), V(0, 0, 1), 0);
  building(batch, kit, W, 0, 7, 30, { variant: 1, tint: '#9a968c' });
  building(batch, kit, W, 7, 14.5, 26, { variant: 3, tint: '#8e9aa0' });
  building(batch, kit, E, 0, 7.5, 34, { variant: 5, tint: '#a39d92' });
  building(batch, kit, E, 7.5, 14.5, 24, { variant: 2, tint: '#9c9488' });
  building(batch, kit, N, 0, 20, 44, { variant: 4, tint: '#8f8c96' });

  // piso de granito
  const pave = new THREE.MeshStandardMaterial({ map: paveTex(rng), roughness: 0.7, color: 0xb9b4aa });
  const pg = new THREE.PlaneGeometry(X1 - X0, 16.5 - 0).rotateX(-Math.PI / 2);
  const uv = pg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (X1 - X0) / 1.2, uv.getY(i) * 16.5 / 1.2);
  batch.add(pg, pave, CX, 0.007, 16.5 / 2);

  // muros laterais com cobertura de telhas verdes e pórtico para a rua
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex(rng), roughness: 0.85, color: 0xd8cdb8 });
  const tileM = new THREE.MeshStandardMaterial({ map: roofTex(rng), color: 0x5f8f5a, roughness: 0.35, metalness: 0.1 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9e1b14, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.35, metalness: 0.8 });
  for (const x of [X0 + 0.2, X1 - 0.2]) {
    batch.add(new THREE.BoxGeometry(0.4, 3.0, 14.5), wallM, x, 1.5, 9.25);
    batch.add(new THREE.BoxGeometry(0.75, 0.22, 14.7), tileM, x, 3.1, 9.25);
    addBox(x, 9.25, 0.2, 7.25);
  }
  for (const [a, b] of [[X0, -44.9], [-33.1, X1]]) {
    batch.add(new THREE.BoxGeometry(b - a, 3.0, 0.4), wallM, (a + b) / 2, 1.5, 16.3);
    batch.add(new THREE.BoxGeometry(b - a + 0.2, 0.22, 0.75), tileM, (a + b) / 2, 3.1, 16.3);
    addBox((a + b) / 2, 16.3, (b - a) / 2, 0.2);
  }
  for (const x of [-44.6, -33.4]) {
    batch.add(new THREE.CylinderGeometry(0.3, 0.33, 4.8, 16), red, x, 2.4, 16.3);
    batch.add(new THREE.BoxGeometry(0.8, 0.4, 0.8), wallM, x, 0.2, 16.3);
    addCircle(x, 16.3, 0.4);
  }
  batch.add(new THREE.BoxGeometry(12.2, 0.5, 0.5), red, CX, 4.95, 16.3);
  batch.add(new THREE.BoxGeometry(11.6, 0.18, 0.4), gold, CX, 4.62, 16.3);
  scene.add(roofMesh(13.4, 1.9, 0.75, 0.55, tileM, CX, 5.2, 16.3));
  const gateFr = frame(V(CX, 0, 16.3), V(1, 0, 0), V(0, 0, 1), 0);
  sign(ctx, gateFr, { u: 0, v: 4.2, w: 2.6, h: 0.8, text: '天后廟', style: 'box', plate: '#a3121a', ink: '#f2c14e', color: '#ffb23e', glow: 1.1, off: 0.3, light: 0.6 });

  hall(ctx, { red, gold, tileM, wallM });
  lions(ctx);
  urn(ctx);
  lanterns(ctx);
  trees(ctx);
  lamp(V(CX, 6.6, 3.2), V(CX, 0, 10.5), 0xffb070, 300);
  lamp(V(CX, 6.2, 15.8), V(CX + 0.5, 0, 9.5), 0xffa060, 260);
}

// ---------------------------------------------------------------- salão principal

function hall({ scene, batch, rng }, { red, gold, tileM, wallM }) {
  const zb = ZF - 1.8; // parede frontal (recuada sob o beiral)
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.8 });
  batch.add(new THREE.BoxGeometry(15.5, 0.36, 4.6), stone, CX, 0.18, -0.4);
  batch.add(new THREE.BoxGeometry(6, 0.18, 0.7), stone, CX, 0.09, ZF + 0.55);
  batch.add(new THREE.BoxGeometry(14.8, 4.2, 6.5), wallM, CX, 2.46, zb - 3.25);
  // portas vermelhas com tachas, janelas de treliça acesas e colunas
  const door = new THREE.MeshStandardMaterial({ map: doorTex(), roughness: 0.5 });
  const lattice = new THREE.MeshStandardMaterial({ map: latticeTex(), emissiveMap: latticeTex(true), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.6 });
  batch.add(new THREE.PlaneGeometry(2.6, 3.0), door, CX, 1.86, zb + 0.01);
  for (const s of [-1, 1]) batch.add(new THREE.PlaneGeometry(2.4, 1.7), lattice, CX + s * 3.6, 2.2, zb + 0.01);
  for (const x of [-6.6, -4.4, -1.6, 1.6, 4.4, 6.6]) batch.add(new THREE.CylinderGeometry(0.2, 0.22, 3.7, 14), red, CX + x, 2.2, ZF - 0.2);
  batch.add(new THREE.BoxGeometry(14, 0.35, 0.3), red, CX, 4.1, ZF - 0.2);
  batch.add(new THREE.BoxGeometry(13.6, 0.12, 0.32), gold, CX, 3.86, ZF - 0.2);
  scene.add(roofMesh(17.5, 8.4, 2.6, 1.0, tileM, CX, 4.4, ZF - 4.0));
  // brilho quente da porta
  source(V(CX, 2.0, ZF + 1.2), 0xffb060, 10, 10);
  // mesa de oferendas com laranjas e velas
  const cloth = new THREE.MeshStandardMaterial({ color: 0xa3121a, roughness: 0.7 });
  batch.add(new THREE.BoxGeometry(2.0, 0.85, 0.8), cloth, CX, 0.43, ZF + 0.6 + 0.6);
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a1c, roughness: 0.5 });
  for (let i = 0; i < 9; i++) batch.add(new THREE.SphereGeometry(0.05, 10, 8), orange, CX - 0.3 + (i % 3) * 0.1, 0.92 + Math.floor(i / 3) * 0.06, ZF + 1.2 + (i % 2) * 0.05);
  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.6) });
  for (const s of [-1, 1]) {
    batch.add(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), cloth, CX + s * 0.7, 1.0, ZF + 1.2);
    batch.add(new THREE.SphereGeometry(0.025, 8, 6), flame, CX + s * 0.7, 1.18, ZF + 1.2);
  }
  // espirais de incenso penduradas sob o beiral, com ponta acesa
  const coilM = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.6, 0.3) });
  const tag = new THREE.MeshStandardMaterial({ color: 0xc8241c, roughness: 0.6, side: THREE.DoubleSide });
  for (const x of [-5.5, -3, 3, 5.5]) {
    const cx = CX + x, cy = 3.2 + rng() * 0.3, cz = ZF + 0.4;
    batch.add(coilGeometry(0.42, 0.55, 11), coilM, cx, cy, cz);
    batch.add(new THREE.PlaneGeometry(0.12, 0.42), tag, cx, cy - 0.32, cz + 0.02);
    batch.add(new THREE.SphereGeometry(0.02, 6, 4), ember, cx + 0.4, cy - 0.5, cz);
    batch.add(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 3), coilM, cx, cy + 0.45, cz);
    ctxSmoke.push([cx + 0.4, cy - 0.5, cz]);
  }
  addBox(CX, -0.4, 7.8, 2.6);
}

const ctxSmoke = [];
export const TEMPLE_SMOKE = ctxSmoke;

// Telhado de duas águas com curva côncava e cantos dos beirais levantados.
function roofMesh(len, depth, rise, curl, mat, x, y, z) {
  const NS = 14, NT = 28;
  const pos = [], uvs = [], idx = [];
  const half = depth / 2 + 0.6;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      for (let j = 0; j <= NT; j++) {
        const t = j / NT * 2 - 1;
        const edge = Math.pow(Math.abs(t), 6);
        const yy = rise * (1 - Math.pow(s, 0.7)) + curl * edge * s * s + 0.25 * s * s;
        const zz = side * (s * half + edge * s * 0.35);
        const xx = t * (len / 2 + s * 0.35);
        pos.push(xx, yy, zz);
        uvs.push(t * len / 2.4, s * half * 1.2);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
      const a = base + i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.material.side = THREE.DoubleSide;
  m.position.set(x, y, z);
  m.castShadow = true;
  // cumeeira com pontas enroladas
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.28, 0.32), mat);
  ridge.position.y = rise + 0.1;
  m.add(ridge);
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 16, Math.PI * 1.4), mat);
    end.position.set(s * len * 0.46, rise + 0.32, 0);
    end.rotation.set(0, Math.PI / 2, s > 0 ? 0.6 : Math.PI - 0.6);
    m.add(end);
  }
  return m;
}

function coilGeometry(r, h, turns) {
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2, f = i / (turns * 24);
    pts.push(V(Math.cos(a) * r * f, -h * f, Math.sin(a) * r * f));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.008, 4);
}

// ---------------------------------------------------------------- leões de pedra (esculpidos por SDF)

function lionGeometry(ball) {
  const P = [];
  P.push(ell([0, 0.36, -0.1], [0.24, 0.3, 0.3], { k: 0.06 }));
  P.push(ell([0, 0.58, 0.1], [0.22, 0.32, 0.2], { k: 0.06 }));
  P.push(ell([0, 0.98, 0.14], [0.21, 0.2, 0.2], { k: 0.05 }));
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * 0.85 + (i / 11) * Math.PI * 1.7;
    P.push(ell([Math.sin(a) * 0.2, 0.98 + Math.cos(a * 1.3) * 0.12, 0.08 - Math.cos(a) * 0.14], [0.07, 0.07, 0.06], { k: 0.04 }));
  }
  P.push(ell([0, 0.9, 0.31], [0.12, 0.08, 0.08], { k: 0.04 }));
  for (const s of [1, -1]) {
    P.push(ell([s * 0.08, 1.03, 0.3], [0.045, 0.04, 0.035], { k: 0.02 }));
    P.push(cone([s * 0.12, 0.64, 0.18], [s * 0.13, 0.09, 0.27], 0.075, 0.065, { k: 0.05 }));
    P.push(ell([s * 0.13, 0.06, 0.32], [0.08, 0.06, 0.1], { k: 0.03 }));
    P.push(ell([s * 0.19, 0.26, -0.08], [0.1, 0.2, 0.25], { k: 0.05 }));
    P.push(ell([s * 0.2, 0.06, 0.1], [0.08, 0.06, 0.1], { k: 0.03 }));
  }
  P.push(ell([0, 0.94, 0.39], [0.045, 0.03, 0.03], { k: 0.02 }));
  P.push(ell([0, 0.85, 0.36], [0.075, 0.03, 0.06], { sub: true, k: 0.02 }));
  P.push(cone([0, 0.5, -0.38], [0, 0.85, -0.42], 0.06, 0.09, { k: 0.05 }));
  if (ball) {
    P.push(ell([-0.17, 0.12, 0.36], [0.12, 0.12, 0.12], { k: 0.02 }));
    P.push(ell([-0.15, 0.25, 0.36], [0.08, 0.05, 0.09], { k: 0.03 }));
  }
  const set = compile(P);
  const m = surfaceNets(field(set), [-0.5, -0.05, -0.6], [0.5, 1.25, 0.6], 0.018);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}

function lions({ scene, batch }) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.88 });
  const ped = new THREE.MeshStandardMaterial({ color: 0x7a766e, roughness: 0.85 });
  for (const s of [-1, 1]) {
    const x = CX + s * 4.2, z = 14.6;
    batch.add(new THREE.BoxGeometry(0.9, 0.9, 1.15), ped, x, 0.45, z);
    batch.add(new THREE.BoxGeometry(1.0, 0.08, 1.25), ped, x, 0.92, z);
    const lion = new THREE.Mesh(lionGeometry(s < 0), stone);
    lion.position.set(x, 0.96, z);
    lion.scale.set(s * 1.1, 1.1, 1.1);
    lion.rotation.y = -s * 0.25;
    lion.castShadow = true;
    lion.receiveShadow = true;
    scene.add(lion);
    addBox(x, z, 0.5, 0.62);
  }
}

// ---------------------------------------------------------------- urna de bronze com incenso

function urn({ scene, batch, rng }) {
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.38, metalness: 0.85 });
  const patina = new THREE.MeshStandardMaterial({ color: 0x4f6a52, roughness: 0.6, metalness: 0.4 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.8 });
  const x = CX, z = 8.6;
  batch.add(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 24), stone, x, 0.175, z);
  const prof = [[0.0, 0.0], [0.42, 0.0], [0.5, 0.08], [0.66, 0.35], [0.72, 0.55], [0.7, 0.66], [0.76, 0.7], [0.7, 0.74], [0.6, 0.66], [0.0, 0.6]];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 36);
  batch.add(body, bronze, x, 0.62, z);
  batch.add(new THREE.CylinderGeometry(0.69, 0.69, 0.05, 30), patina, x, 1.36, z);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    batch.add(new THREE.CylinderGeometry(0.07, 0.1, 0.4, 10), bronze, x + Math.cos(a) * 0.45, 0.52, z + Math.sin(a) * 0.45);
  }
  for (const s of [-1, 1]) batch.add(new THREE.TorusGeometry(0.16, 0.035, 8, 16), bronze, x + s * 0.8, 1.36, z, 0, Math.PI / 2, 0);
  // varetas de incenso com pontas acesas
  const stick = new THREE.MeshStandardMaterial({ color: 0xb02a1c, roughness: 0.7 });
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.6, 0.3) });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, r = rng() * 0.45;
    const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r, h = 0.35 + rng() * 0.25;
    const tx = (rng() - 0.5) * 0.25, tz = (rng() - 0.5) * 0.25;
    batch.add(new THREE.CylinderGeometry(0.006, 0.006, h, 3), stick, sx, 1.38 + h / 2, sz, tx, 0, tz);
    batch.add(new THREE.SphereGeometry(0.012, 5, 4), ember, sx - Math.sin(tz) * h / 2, 1.38 + h, sz + Math.sin(tx) * h / 2);
  }
  ctxSmoke.push([x, 1.9, z]);
  source(V(x, 1.8, z), 0xff8a3a, 4, 6);
  addCircle(x, z, 1.05);
}

// ---------------------------------------------------------------- lanternas vermelhas

function lanterns({ scene, batch }) {
  const lm = new THREE.MeshStandardMaterial({ color: 0xc8140c, emissive: 0xff3a10, emissiveIntensity: 1.6, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.35, metalness: 0.8 });
  const rope = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 });
  const tassel = new THREE.MeshStandardMaterial({ color: 0xe8b830, roughness: 0.7 });
  const lg = new THREE.SphereGeometry(0.28, 16, 12);
  for (const z of [6.2, 10.6, 13.6]) {
    const n = 7;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      pts.push(V(X0 + 0.4 + (X1 - X0 - 0.8) * f, 5.2 - Math.sin(Math.PI * f) * 0.8, z));
    }
    batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.012, 4), rope);
    for (let i = 1; i <= n; i++) {
      const f = i / (n + 1);
      const x = X0 + 0.4 + (X1 - X0 - 0.8) * f, y = 5.2 - Math.sin(Math.PI * f) * 0.8 - 0.42;
      batch.add(lg, lm, x, y, z, 0, 0, 0, 1, 1.15, 1);
      batch.add(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), gold, x, y + 0.32, z);
      batch.add(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), gold, x, y - 0.32, z);
      batch.add(new THREE.CylinderGeometry(0.02, 0.05, 0.3, 6), tassel, x, y - 0.5, z);
      if (i % 3 === 2) source(V(x, y, z), 0xff5020, 9, 9);
    }
  }
}

// ---------------------------------------------------------------- árvores

function leafCards(batch, mat, cx, cy, cz, rx, ry, rz, n, rng, size = 1.1) {
  const g = new THREE.PlaneGeometry(size, size);
  for (let i = 0; i < n; i++) {
    let x, y, z;
    do { x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1; } while (x * x + y * y + z * z > 1);
    batch.add(g, mat, cx + x * rx, cy + y * ry, cz + z * rz, rng() * Math.PI, rng() * Math.PI, rng() * Math.PI, 1 + rng() * 0.5, 1 + rng() * 0.5, 1);
  }
}

function trees({ batch, rng }) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 });
  const leaves = new THREE.MeshStandardMaterial({ map: leafTex(rng, ['#1f4a26', '#2f6a32', '#3d7a3a', '#1a3a20']), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const blossom = new THREE.MeshStandardMaterial({ map: leafTex(rng, ['#c25aa0', '#d97ab8', '#a8408a', '#2f5a2a', '#e6a0cc'], true), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, emissive: 0x3a0a28, emissiveIntensity: 0.6 });
  // figueira-de-bengala: tronco largo, galhos e raízes aéreas
  const bx = X0 + 2.6, bz = 5.6;
  batch.add(new THREE.CylinderGeometry(0.42, 0.75, 4.6, 12), bark, bx, 2.3, bz);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng();
    const len = 2.2 + rng() * 1.6;
    const tip = V(bx + Math.cos(a) * len, 4.6 + rng() * 1.6, bz + Math.sin(a) * len * 0.8);
    const base = V(bx, 3.8, bz);
    const mid = base.clone().add(tip).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tip.clone().sub(base).normalize());
    batch.addMatrix(new THREE.CylinderGeometry(0.1, 0.22, base.distanceTo(tip), 8), bark, new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
    for (let k = 0; k < 3; k++) {
      const f = 0.4 + rng() * 0.6, h = 3.6 + rng() * 1.5;
      const p = base.clone().lerp(tip, f);
      batch.add(new THREE.CylinderGeometry(0.012, 0.02, h, 4), bark, p.x, p.y - h / 2, p.z);
    }
  }
  leafCards(batch, leaves, bx + 0.4, 6.4, bz + 0.3, 3.4, 1.9, 3.0, 150, rng, 1.3);
  addCircle(bx, bz, 0.8);
  // bauhínia: tronco fino e copa florida (pétalas caem ao vento)
  const hx = X1 - 2.4, hz = 10.8;
  batch.add(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 10), bark, hx, 1.6, hz);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const tip = V(hx + Math.cos(a) * 1.3, 3.8 + rng(), hz + Math.sin(a) * 1.3);
    const base = V(hx, 3.0, hz);
    const mid = base.clone().add(tip).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tip.clone().sub(base).normalize());
    batch.addMatrix(new THREE.CylinderGeometry(0.05, 0.1, base.distanceTo(tip), 6), bark, new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
  }
  leafCards(batch, blossom, hx, 4.6, hz, 2.0, 1.2, 2.0, 90, rng, 1.0);
  addCircle(hx, hz, 0.35);
  BLOSSOM.set(hx, 4.6, hz);
}

export const BLOSSOM = new THREE.Vector3();

// ---------------------------------------------------------------- texturas

function paveTex(rng) {
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#6e6a64';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 128) for (let x = 0; x < S; x += 128) {
    const v = 150 + rng() * 40;
    g.fillStyle = `rgb(${v | 0},${(v * 0.97) | 0},${(v * 0.93) | 0})`;
    g.fillRect(x + 2, y + 2, 124, 124);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${rng() * 0.12})`;
      g.fillRect(x + 2 + rng() * 122, y + 2 + rng() * 122, 2, 2);
    }
  }
  return T.toTex(c, { repeat: [1, 1] });
}

function wallTex(rng) {
  const S = 128, c = T.makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#c9bea8';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(${rng() < 0.6 ? '60,50,40' : '255,255,255'},${rng() * 0.12})`;
    g.fillRect(rng() * S, rng() * S, 3, 3);
  }
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(40,30,20,0.35)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return T.toTex(c);
}

function roofTex(rng) {
  const S = 128, c = T.makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#4f7d4a';
  g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)');
    gr.addColorStop(0.5, 'rgba(255,255,230,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = gr;
    g.fillRect(x, 0, 16, S);
  }
  for (let y = 0; y < S; y += 32) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y, S, 3); }
  return T.toTex(c, { repeat: [1, 1] });
}

function doorTex() {
  const W = 256, H = 296, c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#8e150f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#5a0c08';
  g.fillRect(W / 2 - 2, 0, 4, H);
  g.fillStyle = '#e0b040';
  for (let y = 30; y < H - 20; y += 30) for (const x0 of [24, W / 2 + 24]) for (let k = 0; k < 4; k++) {
    g.beginPath(); g.arc(x0 + k * 26, y, 5, 0, Math.PI * 2); g.fill();
  }
  return T.toTex(c);
}

function latticeTex(emissive = false) {
  const W = 256, H = 180, c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = emissive ? '#ffb060' : '#5a1a10';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = emissive ? '#000' : '#7a1f12';
  g.lineWidth = 6;
  for (let x = 0; x <= W; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeRect(0, 0, W, H);
  return T.toTex(c);
}

function leafTex(rng, cols, flowers = false) {
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < (flowers ? 160 : 220); i++) {
    const x = 20 + rng() * (S - 40), y = 20 + rng() * (S - 40);
    const d = Math.hypot(x - S / 2, y - S / 2);
    if (d > S * 0.46) continue;
    g.save();
    g.translate(x, y);
    g.rotate(rng() * Math.PI * 2);
    g.fillStyle = cols[(rng() * cols.length) | 0];
    if (flowers && rng() < 0.7) {
      for (let k = 0; k < 5; k++) {
        g.rotate((Math.PI * 2) / 5);
        g.beginPath(); g.ellipse(0, 7, 4, 8, 0, 0, Math.PI * 2); g.fill();
      }
    } else {
      g.beginPath(); g.ellipse(0, 0, 5 + rng() * 4, 11 + rng() * 6, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  return T.toTex(c);
}
