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
