// Zona 3 · 女人街: mercado noturno no trecho leste da rua (barracas nas duas calçadas).
import * as THREE from 'three';
import * as T from '../textures.js';
import { V, source, sign, frame } from './kit.js';
import { addBox } from '../map.js';

const AWNINGS = [['#c8241c', '#efe6d2'], ['#1f4fa8', '#efe6d2'], ['#1f7a4a', '#f1d24a'], ['#d8661c', '#efe6d2'], ['#7a1f6b', '#f0d8e8']];
const GOODS = [0xd94a3a, 0x3a6ad9, 0xe8c64a, 0x2a2a2e, 0xe8e2d0, 0x6ac9a0, 0xd97ab8, 0x8a5a3a, 0x9a9aa8];

export function buildMarket(ctx) {
  const { scene, rng, batch } = ctx;
  const awningMats = AWNINGS.map(([a, b]) => new THREE.MeshStandardMaterial({ map: stripeTex(a, b), roughness: 0.7, side: THREE.DoubleSide }));
  const pole = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.45, metalness: 0.7 });
  const table = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const goodsMats = GOODS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
  const hangMats = GOODS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
  const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 3.0, 1.6) });
  const wireM = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 });
  const priceM = new THREE.MeshStandardMaterial({ map: priceTex(rng), roughness: 0.9 });
  const poleG = new THREE.BoxGeometry(0.045, 2.35, 0.045);
  const bulbG = new THREE.SphereGeometry(0.055, 10, 8);
  const boxG = new THREE.BoxGeometry(1, 1, 1);

  for (const side of [1, -1]) {
    // lado norte: frente para +z; lado sul: frente para -z
    const zc = side > 0 ? 17.75 : 29.75;
    for (let x = 15.4; x < 45.5; x += 2.75) {
      if (rng() < 0.08) continue;
      const W = 2.4, D = 1.5;
      const front = zc + side * D / 2, back = zc - side * D / 2;
      for (const dx of [-W / 2, W / 2]) for (const z of [front, back]) batch.add(poleG, pole, x + dx, 1.175, z);
      // toldo inclinado para a rua
      const aw = awningMats[(rng() * awningMats.length) | 0];
      const ag = new THREE.PlaneGeometry(W + 0.2, D + 0.5);
      batch.add(ag, aw, x, 2.28, zc + side * 0.25, -Math.PI / 2 + side * 0.22, 0, 0);
      // bancada com pano e mercadorias
      batch.add(boxG, table, x, 0.42, front - side * 0.4, 0, 0, 0, W - 0.1, 0.84, 0.7);
      batch.add(boxG, cloth, x, 0.86, front - side * 0.4, 0, 0, 0, W - 0.05, 0.03, 0.75);
      for (let k = 0; k < 9; k++) {
        const gw = 0.12 + rng() * 0.22, gh = 0.05 + rng() * 0.16, gd = 0.1 + rng() * 0.18;
        batch.add(boxG, goodsMats[(rng() * goodsMats.length) | 0], x - W / 2 + 0.2 + rng() * (W - 0.4), 0.88 + gh / 2, front - side * (0.15 + rng() * 0.5), 0, rng() * 0.6, 0, gw, gh, gd);
      }
      // roupas, bolsas e lanternas de papel penduradas na frente
      for (let k = 0; k < 6; k++) {
        const hx = x - W / 2 + 0.25 + k * ((W - 0.5) / 5) + (rng() - 0.5) * 0.1;
        const hh = 0.35 + rng() * 0.3;
        batch.add(new THREE.PlaneGeometry(0.3 + rng() * 0.1, hh), hangMats[(rng() * hangMats.length) | 0], hx, 2.05 - hh / 2, front + side * 0.02, 0, side > 0 ? 0 : Math.PI, (rng() - 0.5) * 0.12);
      }
      batch.add(boxG, wireM, x, 2.12, front, 0, 0, 0, W, 0.02, 0.02);
      for (const dx of [-0.6, 0.6]) {
        batch.add(bulbG, bulbM, x + dx, 1.92, front + side * 0.05);
        batch.add(boxG, wireM, x + dx, 2.02, front + side * 0.05, 0, 0, 0, 0.01, 0.18, 0.01);
      }
      // plaquinha de preço
      batch.add(new THREE.PlaneGeometry(0.34, 0.22), priceM, x + (rng() - 0.5) * 1.2, 1.02, front + side * 0.03, -0.2 * side, side > 0 ? 0 : Math.PI, 0);
      source(V(x, 1.8, front + side * 0.6), 0xffc27a, 5.5, 7);
      addBox(x, zc, W / 2 + 0.05, D / 2 + 0.1);
    }
  }

  // portais com o nome do mercado nas duas entradas
  for (const x of [13.6, 46.6]) {
    for (const z of [18.9, 28.7]) batch.add(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 10), pole, x, 3.2, z);
    const fr = frame(V(x, 0, 23.8), V(0, 0, 1), V(x < 30 ? -1 : 1, 0, 0), x < 30 ? -Math.PI / 2 : Math.PI / 2);
    sign(ctx, fr, { u: 0, v: 6.0, w: 9.6, h: 1.3, text: '女人街', style: 'box', plate: '#fff0c8', ink: '#b0141c', color: '#ff5a3a', glow: 1.6, off: 0.0 });
    const back = frame(V(x, 0, 23.8), V(0, 0, -1), V(x < 30 ? 1 : -1, 0, 0), x < 30 ? Math.PI / 2 : -Math.PI / 2);
    sign(ctx, back, { u: 0, v: 6.0, w: 9.6, h: 1.3, text: '夜市', style: 'tube', color: '#ffb23e', glow: 1.9, off: 0.16 });
  }
}

function stripeTex(a, b) {
  const W = 128, H = 128, c = T.makeCanvas(W, H), g = c.getContext('2d');
  for (let x = 0; x < W; x += 32) {
    g.fillStyle = a; g.fillRect(x, 0, 16, H);
    g.fillStyle = b; g.fillRect(x + 16, 0, 16, H);
  }
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return T.toTex(c, { repeat: [3, 1] });
}

function priceTex(rng) {
  const W = 256, H = 160, c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#c3161c';
  g.font = '900 64px "Noto Sans TC", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$' + [10, 20, 30, 50][(rng() * 4) | 0], W / 2, 62);
  g.fillStyle = '#1a1a1a';
  g.font = '900 34px "Noto Sans TC", sans-serif';
  g.fillText('大減價', W / 2, 128);
  return T.toTex(c);
}
