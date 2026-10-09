// Zona 1 · 後巷: o beco de Mong Kok (fundo fechado, aberto para a Rua Fa Yuen em z ≈ 16,5).
import * as THREE from 'three';
import * as T from '../textures.js';
import { V, frame, at, building, litShop, closedShop, sign, source, lamp } from './kit.js';
import { addBox } from '../map.js';

const FR = {
  B: frame(V(-9, 0, -8.5), V(1, 0, 0), V(0, 0, 1), 0),
  L: frame(V(-9, 0, -8.5), V(0, 0, 1), V(1, 0, 0), Math.PI / 2),
  R: frame(V(9, 0, -8.5), V(0, 0, 1), V(-1, 0, 0), -Math.PI / 2),
};

const SIGNS = [
  { fr: 'B', u: 3.1, v: 3.95, w: 4.6, h: 0.85, text: '茶餐廳', style: 'box', plate: '#fff1d0', ink: '#c3161c', color: '#ff4a3d', glow: 1.5 },
  { fr: 'B', u: 9.5, v: 3.95, w: 3.4, h: 0.8, text: '粥麵飯', style: 'tube', color: '#3ef0d0', glow: 1.9, flicker: true },
  { fr: 'B', u: 15.3, v: 3.95, w: 3.6, h: 0.85, text: '藥房', style: 'box', plate: '#f4fff8', ink: '#0d8a4f', color: '#25d07a', glow: 1.45 },
  { fr: 'B', u: 9.5, v: 10.0, w: 2.0, h: 6.4, text: '金龍酒家', style: 'tube', color: '#ffb23e', glow: 2.0, vertical: true, off: 0.3 },
  { fr: 'B', u: 3.0, v: 9.0, w: 1.4, h: 4.4, text: '夜宵', style: 'box', plate: '#fff4dd', ink: '#1c47b8', color: '#4d7dff', glow: 1.3, vertical: true, off: 0.3 },
  { fr: 'L', u: 4.6, v: 7.2, w: 1.1, h: 4.2, text: '麻雀館', style: 'tube', color: '#ff3fa4', glow: 2.2, perp: true },
  { fr: 'L', u: 11.6, v: 3.95, w: 4.4, h: 0.8, text: '麻雀耍樂', style: 'tube', color: '#ff3fa4', glow: 1.7 },
  { fr: 'L', u: 12.0, v: 7.0, w: 1.0, h: 3.4, text: '旅館', style: 'box', plate: '#fff3d6', ink: '#1b3d9c', color: '#5c8dff', glow: 1.35, perp: true },
  { fr: 'L', u: 18.6, v: 8.0, w: 1.3, h: 5.2, text: '夜總會', style: 'tube', color: '#b35cff', glow: 2.2, perp: true, flicker: true },
  { fr: 'R', u: 3.2, v: 6.6, w: 1.0, h: 3.4, text: '按摩', style: 'tube', color: '#3ee6ff', glow: 2.0, perp: true },
  { fr: 'R', u: 3.4, v: 3.95, w: 3.0, h: 0.72, text: '24小時', style: 'tube', color: '#ff4a3d', glow: 1.7, flicker: true },
  { fr: 'R', u: 10.2, v: 7.6, w: 1.2, h: 4.6, text: '大押', style: 'box', plate: '#ffe7c7', ink: '#a3121a', color: '#ff5a3a', glow: 1.45, perp: true },
  { fr: 'R', u: 12.6, v: 3.95, w: 4.0, h: 0.8, text: '足底按摩', style: 'box', plate: '#ffe6f2', ink: '#b0105a', color: '#ff4fa0', glow: 1.3 },
  { fr: 'R', u: 19.2, v: 6.6, w: 1.0, h: 3.6, text: '糖水', style: 'tube', color: '#ffe14a', glow: 1.9, perp: true },
];

export function buildAlley(ctx) {
  const { scene, rng, batch, kit, sk, flicker, ups } = ctx;
  // prédios (fachadas compartilhadas com tons próprios)
  building(batch, kit, FR.B, 0, 6.5, 30, { variant: 0, tint: '#8fa498' });
  building(batch, kit, FR.B, 6.5, 12.5, 36, { variant: 1, tint: '#b3aa98' });
  building(batch, kit, FR.B, 12.5, 18, 27, { variant: 2, tint: '#9c9fb3' });
  building(batch, kit, FR.L, 0, 8, 28, { variant: 3, tint: '#ab9f8b' });
  building(batch, kit, FR.L, 8, 15, 22, { variant: 4, tint: '#8d9fa9' });
  building(batch, kit, FR.L, 15, 25, 33, { variant: 5, tint: '#b09c9c' });
  building(batch, kit, FR.R, 0, 9, 34, { variant: 2, tint: '#9daa9a' });
  building(batch, kit, FR.R, 9, 16, 25, { variant: 0, tint: '#aa9a8a' });
  building(batch, kit, FR.R, 16, 25, 30, { variant: 4, tint: '#8b97a8' });

  // térreo
  litShop(batch, sk, rng, FR.B, 0.4, 5.8, 'cafe', 0x9d1d1d);
  closedShop(batch, sk, FR.B, 6.6, 12.4, true);
  litShop(batch, sk, rng, FR.B, 13.0, 17.6, 'pharm', 0x1d6f4c);
  closedShop(batch, sk, FR.L, 0.4, 5.2);
  litShop(batch, sk, rng, FR.L, 5.6, 7.4, 'stair');
  litShop(batch, sk, rng, FR.L, 8.6, 14.6, 'mahjong', 0x7b1446);
  closedShop(batch, sk, FR.L, 15.4, 19.6, true);
  litShop(batch, sk, rng, FR.L, 20.2, 24.4, 'cafe', 0x8a5a1d);
  closedShop(batch, sk, FR.R, 0.4, 6.4, true);
  litShop(batch, sk, rng, FR.R, 6.8, 8.6, 'stair');
  litShop(batch, sk, rng, FR.R, 9.6, 15.6, 'massage', 0x5a1a6b);
  closedShop(batch, sk, FR.R, 16.4, 20.4);
  litShop(batch, sk, rng, FR.R, 21.0, 24.4, 'pharm');

  for (const s of SIGNS) sign(ctx, FR[s.fr], s);

  wallDetails(ctx);
  props(ctx);
  alleyLamp(ctx);
  // luzes de ambiente do beco (entram no conjunto de luzes reais)
  for (const [c, i, p] of [
    [0xff4a2e, 22, [-5.6, 2.8, -7.2]], [0x30f0d0, 20, [7.4, 5.2, -5.6]], [0xff3fa4, 26, [-7.3, 6.0, -4.0]],
    [0xffa83e, 22, [0.5, 8.0, -7.6]], [0xa35cff, 22, [-7.3, 7.0, 10]], [0x6dffb0, 14, [6.0, 2.7, -7.3]], [0xff5a3a, 16, [7.4, 6.5, 1.5]],
  ]) source(V(...p), c, i, 16);
}

function wallDetails({ scene, rng, ups, batch }) {
  // aparelhos de ar-condicionado (instanciados)
  const acMat = [
    new THREE.MeshStandardMaterial({ color: 0xbdb9ae, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: T.acTex(), roughness: 0.7 }),
  ];
  const N = 60;
  const acs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.55, 0.45), [acMat[0], acMat[0], acMat[0], acMat[0], acMat[1], acMat[0]], N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const frs = [FR.B, FR.L, FR.L, FR.R, FR.R];
  for (let i = 0; i < N; i++) {
    const fr = frs[i % frs.length];
    const len = fr === FR.B ? 18 : 24;
    const p = at(fr, 0.6 + rng() * (len - 1.2), 5.2 + Math.floor(rng() * 7) * 3.0 + 0.4, 0.25);
    q.setFromAxisAngle(V(0, 1, 0), fr.ry);
    m4.compose(p, q, sc);
    acs.setMatrixAt(i, m4);
  }
  scene.add(acs);

  // cabos atravessando o beco
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  const cables = [];
  for (let i = 0; i < 14; i++) {
    const z0 = -7.5 + i * 1.75 + rng() * 0.8, z1 = z0 + (rng() - 0.5) * 3;
    const y0 = 6 + rng() * 5, y1 = 6 + rng() * 5, sag = 0.5 + rng() * 1.2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      pts.push(V(-9 + 18 * f, y0 + (y1 - y0) * f - Math.sin(Math.PI * f) * sag, z0 + (z1 - z0) * f));
    }
    cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 5));
  }
  for (const g of cables) batch.add(g, cableMat);

  // varais de roupa na parede esquerda
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.4, metalness: 0.7 });
  const cloths = [];
  const clothCols = [0xd9d2c3, 0x3d5a80, 0xa63d40, 0xe9c46a, 0x2a2a2a, 0x7d8f69, 0xcfa5b4];
  const clothMats = clothCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
  for (let i = 0; i < 8; i++) {
    const u = 1 + rng() * 23, v = 8 + Math.floor(rng() * 5) * 3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6), poleMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.copy(at(FR.L, u, v, 0.8));
    scene.add(pole);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.55 + rng() * 0.3), clothMats[(rng() * clothMats.length) | 0]);
      const piv = new THREE.Group();
      piv.position.copy(at(FR.L, u + (rng() - 0.5) * 0.1, v, 0.25 + k * 0.48));
      c.position.y = -0.32;
      c.rotation.y = Math.PI / 2;
      piv.add(c);
      scene.add(piv);
      cloths.push({ piv, ph: rng() * 6 });
    }
  }
  ups.push((dt, t, cam, wind) => { for (const c of cloths) c.piv.rotation.z = Math.sin(t * 1.3 + c.ph) * (0.08 + wind * 0.25); });

  // andaime de bambu na parede direita
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xb59a63, roughness: 0.6 });
  const bv = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 12, 6), bamboo, 14);
  const bh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 6.4, 6), bamboo, 16);
  let iv = 0, ih = 0;
  for (const off of [0.35, 0.95]) {
    for (let k = 0; k < 7; k++) { m4.makeTranslation(at(FR.R, 9.6 + k, 10.4, off)); bv.setMatrixAt(iv++, m4); }
    for (let k = 0; k < 8; k++) {
      q.setFromAxisAngle(V(1, 0, 0), Math.PI / 2);
      m4.compose(at(FR.R, 12.6, 5 + k * 1.5, off), q, sc);
      bh.setMatrixAt(ih++, m4);
    }
  }
  scene.add(bv, bh);

  // calhas verticais
  const pipe = new THREE.MeshStandardMaterial({ color: 0x5b5f58, roughness: 0.5, metalness: 0.3 });
  const pg = new THREE.CylinderGeometry(0.06, 0.06, 20, 8);
  for (const [fr, u] of [[FR.B, 6.5], [FR.B, 12.5], [FR.L, 8], [FR.L, 15], [FR.R, 9], [FR.R, 16]]) {
    const p = new THREE.Mesh(pg, pipe);
    p.position.copy(at(fr, u, 10, 0.12));
    scene.add(p);
  }
}

function props({ scene, rng, batch }) {
  const add = (m, x, y, z, ry = 0) => {
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // mesas dobráveis e banquinhos plásticos do 茶餐廳
  const tableTop = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.4, metalness: 0.6 });
  const stoolMats = [0xc8242a, 0x2456c8, 0xc8242a, 0x2a9a5a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
  for (const [x, z] of [[-7.1, -7.4], [-4.6, -7.5]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), tableTop), x, 0.74, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.72, 8), leg), x, 0.36, z);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rng();
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.46, 12), stoolMats[(rng() * 4) | 0]), x + Math.cos(a) * 0.8, 0.23, z + Math.sin(a) * 0.55);
    }
  }
  // caixotes, isopor, papelão e sacos de lixo junto às paredes
  const crate = new THREE.MeshStandardMaterial({ map: T.crateTex(rng), roughness: 0.85 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.9 });
  const cardboard = new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.95 });
  const bags = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.18, metalness: 0.1 });
  for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), crate), -8.45, 0.225 + (i > 2 ? 0.45 : 0), -5.6 + (i % 3) * 0.62, rng() * 0.2);
  for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.4), foam), 8.4, 0.16 + Math.floor(i / 3) * 0.32, 3.6 + (i % 3) * 0.56, rng() * 0.1);
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), cardboard), 8.3, 0.2, -1.8 - i * 0.55, rng() * 0.4);
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), crate), -8.4, 0.225 + (i > 1 ? 0.45 : 0), 9.4 + (i % 2) * 0.64, rng() * 0.2);
  const bagGeo = new THREE.SphereGeometry(0.32, 14, 10);
  for (const [x, z] of [[8.2, -6.6], [8.5, -6.1], [7.9, -6.9], [-8.3, 2.4], [-8.5, 2.9], [-8.2, 3.3], [8.3, 12.6], [8.6, 13.1]]) {
    const b = add(new THREE.Mesh(bagGeo, bags), x, 0.22, z, rng() * 3);
    b.scale.set(1, 0.72 + rng() * 0.2, 1);
  }
  // táxi vermelho estacionado diante da porta de aço do fundo
  const taxi = makeTaxi();
  taxi.position.set(2.3, 0, -7.55);
  taxi.rotation.y = 0.04;
  scene.add(taxi);
  addBox(2.3, -7.55, 2.3, 1.0);
}

// Táxi de Hong Kong (vermelho com teto prateado), geometria própria.
export function makeTaxi(color = 0xb3121a) {
  const taxi = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xcfd2d6, roughness: 0.25, metalness: 0.8, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, roughness: 0.05, metalness: 0.9 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.62, 1.76), red);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.6), glass);
  cabin.position.set(-0.2, 1.17, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.5), silver);
  roof.position.set(-0.2, 1.44, 0);
  const signM = new THREE.MeshBasicMaterial({ map: T.taxiSignTex(), color: new THREE.Color(1.6, 1.6, 1.6) });
  const sgn = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), [silver, silver, silver, silver, signM, signM]);
  sgn.position.set(-0.2, 1.56, 0);
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.4) });
  const tailM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.15, 0.1) });
  for (const z of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), headM);
    h.position.set(2.21, 0.72, z);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.3), tailM);
    tl.position.set(-2.21, 0.74, z);
    taxi.add(h, tl);
  }
  const wGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18);
  for (const [x, z] of [[1.4, 0.82], [1.4, -0.82], [-1.4, 0.82], [-1.4, -0.82]]) {
    const w = new THREE.Mesh(wGeo, tire);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.33, z);
    taxi.add(w);
  }
  for (const m of [body, cabin, roof, sgn]) { m.castShadow = true; taxi.add(m); }
  return taxi;
}

// Poste de luz com feixe volumétrico falso. A luz com sombra é posicionada pelo world.js.
export function lampPost(scene, x, z, dirX, dirZ, { arm = 1.7, height = 7, target = null, color = 0xffa457 } = {}) {
  const poleM = lampPost.mat || (lampPost.mat = new THREE.MeshStandardMaterial({ color: 0x2f3a36, roughness: 0.5, metalness: 0.6 }));
  const bulbM = lampPost.bulb || (lampPost.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.1, 1.5) }));
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, height, 10), poleM);
  pole.position.set(0, height / 2, 0);
  const a = new THREE.Mesh(new THREE.BoxGeometry(arm, 0.08, 0.08), poleM);
  a.position.set(arm / 2 - 0.05, height - 0.1, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.32), poleM);
  head.position.set(arm - 0.1, height - 0.18, 0);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.24), bulbM);
  bulb.position.set(arm - 0.1, height - 0.26, 0);
  g.add(pole, a, head, bulb);
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-dirZ, dirX);
  scene.add(g);
  const lp = new THREE.Vector3(x + dirX * (arm - 0.1), height - 0.3, z + dirZ * (arm - 0.1));
  const tg = target || new THREE.Vector3(lp.x + dirX * 3, 0, lp.z + dirZ * 3);
  lamp(lp, tg, color);
  // feixe
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, lp.y, 32, 1, true), lampPost.beam || (lampPost.beam = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.6, 0.28) }, uI: { value: 0.15 } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
      void main() { vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() { float e = abs(dot(normalize(vN), normalize(vV))); float a = pow(e, 1.8) * pow(vH, 1.6) * uI; gl_FragColor = vec4(uColor * a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  })));
  const dir = tg.clone().sub(lp).normalize();
  cone.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
  cone.position.copy(lp).addScaledVector(dir, lp.y / 2);
  cone.renderOrder = 7;
  scene.add(cone);
  source(lp.clone().setY(lp.y - 1), color, 10, 12);
  return g;
}

function alleyLamp({ scene }) {
  lampPost(scene, 8.5, -2.6, -1, 0, { target: V(1.0, 0, -0.6) });
  lampPost(scene, -8.6, 9.5, 1, 0, { target: V(-1.2, 0, 10.5), arm: 1.5 });
}
