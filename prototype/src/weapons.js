// Armas genéricas (sem marcas): submetralhadora de tambor e pistola semiautomática.
// Sistema local: empunhadura na origem, cano apontando para −Y, topo da arma em +Z.
import * as THREE from 'three';

const metal = new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.32, metalness: 0.85 });
const wood = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.45, metalness: 0 });
const gold = new THREE.MeshStandardMaterial({ color: 0xa8802c, roughness: 0.42, metalness: 1 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.4 });

function part(group, geo, mat, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  m.castShadow = true;
  group.add(m);
  return m;
}

export function makeTommy() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(0.045, 0.3, 0.065), metal, 0, -0.08, 0.05);
  part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10), metal, 0, -0.4, 0.06);
  const fin = new THREE.CylinderGeometry(0.021, 0.021, 0.008, 12);
  for (let k = 0; k < 9; k++) part(g, fin, metal, 0, -0.26 - k * 0.018, 0.06);
  part(g, new THREE.CylinderGeometry(0.017, 0.015, 0.09, 10), wood, 0, -0.29, 0.0, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.03, 0.045, 0.1), wood, 0, 0.0, -0.02, 0.25);
  part(g, new THREE.CylinderGeometry(0.075, 0.075, 0.048, 22), metal, 0, -0.15, -0.045, 0, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.035, 0.27, 0.06), wood, 0, 0.21, 0.01, -0.16);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.6, 0.06);
  g.add(muzzle);
  return { group: g, muzzle };
}

export function makePistol() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(0.026, 0.21, 0.034), gold, 0, -0.08, 0.035);
  part(g, new THREE.BoxGeometry(0.028, 0.05, 0.12), ivory, 0, 0.0, -0.025, 0.2);
  part(g, new THREE.TorusGeometry(0.02, 0.004, 6, 12), gold, 0, -0.04, 0.0).rotation.y = Math.PI / 2;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.19, 0.035);
  g.add(muzzle);
  return { group: g, muzzle };
}

// ---------------------------------------------------------------- armas brancas
// Sistema local: empunhadura na origem, comprimento ao longo de +Z (saindo do polegar).
// Na mão, o grupo é inclinado 0,5 rad em direção ao antebraço.

const steel = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.9 });
const rust = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.6, metalness: 0.6 });
const plank = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8 });
const glass = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.82 });
const label = new THREE.MeshStandardMaterial({ color: 0xd9cfa8, roughness: 0.7 });

const alongZ = (g) => g.rotateX(Math.PI / 2);

function grip(group) {
  const holder = new THREE.Group();
  holder.add(group);
  holder.rotation.x = 0.5;
  return holder;
}

function shape(parts) {
  const g = new THREE.Group();
  for (const [geo, mat, z, x = 0, y = 0] of parts) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export const ITEM_MODELS = {
  pipe: () => shape([
    [alongZ(new THREE.CylinderGeometry(0.016, 0.016, 0.58, 10)), steel, 0.22],
    [alongZ(new THREE.CylinderGeometry(0.021, 0.021, 0.04, 10)), rust, 0.5],
  ]),
  bottle: () => shape([
    [alongZ(new THREE.CylinderGeometry(0.012, 0.013, 0.09, 12)), glass, 0.01],
    [alongZ(new THREE.CylinderGeometry(0.013, 0.033, 0.04, 14)), glass, 0.075],
    [alongZ(new THREE.CylinderGeometry(0.033, 0.033, 0.18, 16)), glass, 0.185],
    [alongZ(new THREE.CylinderGeometry(0.0335, 0.0335, 0.07, 16)), label, 0.18],
  ]),
  stick: () => shape([
    [new THREE.BoxGeometry(0.045, 0.026, 0.78), plank, 0.3],
  ]),
  crowbar: () => {
    const g = shape([
      [alongZ(new THREE.CylinderGeometry(0.011, 0.011, 0.6, 8)), rust, 0.24],
      [new THREE.BoxGeometry(0.03, 0.008, 0.05), rust, -0.075, 0, -0.004],
    ]);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI), rust);
    hook.position.set(0, 0.035, 0.54);
    hook.rotation.y = Math.PI / 2;
    hook.castShadow = true;
    g.add(hook);
    return g;
  },
};

export function makePipe() {
  return grip(ITEM_MODELS.pipe());
}

export function makeHeld(type) {
  return grip(ITEM_MODELS[type]());
}
