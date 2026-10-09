// Zona 2 · 花園街: Rua Fa Yuen. Prédios dos dois lados, lojas, letreiros em camadas sobre a rua,
// calçadas, faixa de pedestres, postes de luz de sódio, carros estacionados e obras nas pontas.
import * as THREE from 'three';
import * as T from '../textures.js';
import { V, frame, building, litShop, closedShop, sign, source } from './kit.js';
import { lampPost, makeTaxi } from './alley.js';
import { addBox, addCircle } from '../map.js';

export const NORTH = frame(V(-56, 0, 16.5), V(1, 0, 0), V(0, 0, 1), 0); // u = x + 56
export const SOUTH = frame(V(56, 0, 31.5), V(-1, 0, 0), V(0, 0, -1), Math.PI); // u = 56 - x

const SHOP_WORDS = ['茶餐廳', '藥房', '涼茶', '金行', '眼鏡', '鐘錶', '電器', '燒臘', '士多', '跌打', '中醫', '時裝', '文具', '麵家', '甜品', '鞋店', '酒樓', '雜貨', '餅家', '書局'];
const PERP_WORDS = ['按摩', '旅館', '夜總會', '麻雀館', '大押', '桑拿', '酒店', '足浴', '理髮', '補習社', '電腦', '當舖', '跌打', '牙醫'];
const BIG_WORDS = ['海鮮酒家', '珠寶金行', '大藥房', '牛腩麵', '雲吞麵', '涼茶舖', '跌打醫館', '夜市', '粥麵飯', '燒味'];
const NEON = ['#ff4a3d', '#3ef0d0', '#ff3fa4', '#ffb23e', '#5c8dff', '#b35cff', '#6dffb0', '#ffe14a', '#3ee6ff', '#ff6a2a'];
const PLATES = [['#fff1d0', '#c3161c'], ['#f4fff8', '#0d8a4f'], ['#fff4dd', '#1c47b8'], ['#ffe7c7', '#a3121a'], ['#ffe6f2', '#b0105a'], ['#fffbe0', '#7a4a00']];
const TINTS = ['#a9a59a', '#94a49a', '#a8a0b0', '#b4a690', '#8f9ba8', '#ac9a92', '#a3ab96', '#9d96a6'];
const KINDS = ['cafe', 'pharm', 'mahjong', 'massage', 'stair'];

export function buildStreet(ctx) {
  const { scene, rng, batch, kit, sk } = ctx;
  const pick = (a) => a[(rng() * a.length) | 0];

  // ---------------- prédios e térreo
  const rows = [
    // [moldura, trechos [u0, u1], faixas do mercado (u) sem toldo de loja]
    [NORTH, [[0, 4], [4, 8.5], [25.5, 33], [33, 40.5], [40.5, 47], [65, 72], [72, 80.5], [80.5, 88], [88, 97], [97, 104], [104, 112]]],
    [SOUTH, [[0, 6], [6, 14], [14, 21], [21, 30], [30, 37], [37, 45], [45, 53], [53, 61], [61, 69], [69, 77], [77, 85], [85, 93], [93, 100], [100, 106], [106, 112]]],
  ];
  let vi = 0;
  for (const [fr, segs] of rows) {
    for (const [u0, u1] of segs) {
      const h = 22 + Math.floor(rng() * 6) * 2.5;
      building(batch, kit, fr, u0, u1, h, { variant: vi++ % 6, tint: pick(TINTS) });
      // térreo: uma ou duas lojas por prédio
      const w = u1 - u0;
      const cuts = w > 7 ? [u0 + 0.3, u0 + w * 0.5, u1 - 0.3] : [u0 + 0.3, u1 - 0.3];
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (rng() < 0.62) litShop(batch, sk, rng, fr, a + 0.1, b - 0.1, pick(KINDS), rng() < 0.5 ? new THREE.Color().setHSL(rng(), 0.6, 0.28).getHex() : null);
        else closedShop(batch, sk, fr, a + 0.1, b - 0.1, rng() < 0.5);
        // placa horizontal sobre a loja
        if (rng() < 0.85) {
          const [plate, ink] = pick(PLATES);
          const tube = rng() < 0.45;
          sign(ctx, fr, {
            u: (a + b) / 2, v: 3.95, w: Math.min(4.6, (b - a) - 0.4), h: 0.8, text: pick(SHOP_WORDS),
            style: tube ? 'tube' : 'box', plate, ink, color: pick(NEON), glow: tube ? 1.8 : 1.4, flicker: rng() < 0.12,
          });
        }
      }
      // letreiros perpendiculares (verticais) e grandes letreiros sobre a rua
      if (rng() < 0.8) {
        const st = rng() < 0.5 ? 'tube' : 'box';
        const [plate, ink] = pick(PLATES);
        sign(ctx, fr, {
          u: u0 + 1 + rng() * (w - 2), v: 6.5 + rng() * 3.5, w: 1.0 + rng() * 0.3, h: 3.2 + rng() * 2, text: pick(PERP_WORDS),
          style: st, plate, ink, color: pick(NEON), glow: st === 'tube' ? 2.1 : 1.4, perp: true, flicker: rng() < 0.15,
        });
      }
      if (rng() < 0.55) {
        const st = rng() < 0.6 ? 'tube' : 'box';
        const [plate, ink] = pick(PLATES);
        sign(ctx, fr, {
          u: u0 + 1.5 + rng() * (w - 3), v: 9 + rng() * 6, w: 3.2 + rng() * 2.4, h: 1.3 + rng() * 0.6, text: pick(BIG_WORDS),
          style: st, plate, ink, color: pick(NEON), glow: st === 'tube' ? 2.0 : 1.5, perp: true, horiz: true, off: 0.9, light: 1.4,
        });
      }
    }
  }

  // ---------------- chão: calçadas, meio-fio e marcações
  const tile = new THREE.MeshStandardMaterial({ map: sidewalkTex(rng), roughness: 0.75, color: 0xb0aca6 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x77777a, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a51c, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  for (const [z0, z1] of [[16.5, 19.0], [28.6, 31.5]]) {
    const g = flat(112, z1 - z0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 112 / 2, uv.getY(i) * (z1 - z0) / 2);
    batch.add(g, tile, 0, 0.006, (z0 + z1) / 2);
  }
  // calçada do beco até a rua
  batch.add(flat(18, 0.6), tile, 0, 0.006, 16.8);
  for (const z of [19.0, 28.6]) batch.add(new THREE.BoxGeometry(112, 0.1, 0.16), curb, 0, 0.05, z);
  for (let x = -50; x < 50; x += 6) batch.add(flat(3, 0.14), white, x + 1.5, 0.007, 23.8);
  for (const z of [19.35, 19.55, 28.25, 28.05]) batch.add(flat(100, 0.09), yellow, 0, 0.007, z);
  // faixa de pedestres e aviso "望右 LOOK RIGHT"
  for (let z = 19.4; z < 28.4; z += 0.9) batch.add(flat(3.2, 0.48), white, -4, 0.007, z + 0.24);
  const look = new THREE.MeshStandardMaterial({ map: lookRightTex(), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  batch.add(flat(3.0, 0.9), look, -4, 0.008, 18.7 + 1.3, 0, Math.PI, 0);
  batch.add(flat(3.0, 0.9), look, -4, 0.008, 28.3 - 0.9);

  // ---------------- postes de luz (sódio) alternados nas duas calçadas
  for (const x of [-40, -24, -8.5, 10.5, 26, 42]) { lampPost(scene, x, 19.1, 0, 1, { arm: 1.6 }); addCircle(x, 19.1, 0.18); }
  for (const x of [-48, -32, -16, 2, 18, 34]) { lampPost(scene, x, 28.5, 0, -1, { arm: 1.6 }); addCircle(x, 28.5, 0.18); }

  // ---------------- carros estacionados (fora das áreas de luta)
  const cars = [
    ['taxi', -27, 20.4, 0], ['bus', -20.2, 20.6, 0], ['taxi', -44, 27.6, Math.PI], ['bus', -36, 27.5, Math.PI], ['taxi', 47, 27.6, Math.PI],
  ];
  for (const [kind, x, z, ry] of cars) {
    const c = kind === 'taxi' ? makeTaxi() : makeMinibus();
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    scene.add(c);
    addBox(x, z, kind === 'taxi' ? 2.3 : 3.1, 1.05);
  }

  // ---------------- obras fechando as duas pontas da rua
  roadworks(ctx, -49.9, 1);
  roadworks(ctx, 49.9, -1);
}

// Micro-ônibus creme com teto verde (desenho genérico de transporte público).
function makeMinibus() {
  const g = new THREE.Group();
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xe9e2c8, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const green = new THREE.MeshPhysicalMaterial({ color: 0x1f7a4a, roughness: 0.35, metalness: 0.2, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, roughness: 0.05, metalness: 0.9 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.5, 2.0), cream);
  body.position.y = 1.05;
  const win = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.62, 2.02), glass);
  win.position.set(-0.1, 1.55, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.28, 1.96), green);
  roof.position.set(0, 1.94, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.02, 0.12, 2.04), green);
  stripe.position.set(0, 0.72, 0);
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.4) });
  for (const z of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.3), headM);
    h.position.set(3.01, 0.75, z);
    g.add(h);
  }
  const wGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18);
  for (const [x, z] of [[2.0, 0.92], [2.0, -0.92], [-2.0, 0.92], [-2.0, -0.92]]) {
    const w = new THREE.Mesh(wGeo, tire);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  for (const m of [body, win, roof, stripe]) { m.castShadow = true; g.add(m); }
  return g;
}

function roadworks({ scene, batch, ups, rng }, x, dir) {
  const panel = new THREE.MeshStandardMaterial({ map: hoardingTex(rng), roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8241c, roughness: 0.45 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.45 });
  const g = new THREE.PlaneGeometry(15.2, 2.6);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 6);
  batch.add(g, panel, x - dir * 0.3, 1.3, 24, 0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  batch.add(new THREE.BoxGeometry(0.2, 2.6, 15.2), whiteM, x - dir * 0.45, 1.3, 24);
  addBox(x - dir * 0.4, 24, 0.4, 7.6);
  // barreiras plásticas vermelhas e brancas, com luzes âmbar piscando
  const lights = [];
  const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.4) });
  for (let z = 17.4, i = 0; z < 31; z += 1.25, i++) {
    batch.add(new THREE.BoxGeometry(0.5, 0.8, 1.15), i % 2 ? red : whiteM, x + dir * 0.6, 0.4, z);
    if (i % 3 === 0) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lm.clone());
      l.position.set(x + dir * 0.6, 0.9, z);
      scene.add(l);
      lights.push([l, i]);
    }
  }
  source(V(x + dir * 1.5, 1.5, 24), 0xffa030, 8, 10);
  ups.push((dt, t) => { for (const [l, i] of lights) l.material.color.setScalar(((t * 1.6 + i * 0.37) % 1) < 0.5 ? 1 : 0.05).multiply(new THREE.Color(4, 2.2, 0.4)); });
}

// ---------------------------------------------------------------- texturas próprias da rua

function sidewalkTex(rng) {
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#8c8984';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
    const v = 120 + rng() * 40;
    g.fillStyle = `rgb(${v | 0},${(v * 0.97) | 0},${(v * 0.92) | 0})`;
    g.fillRect(x + 2, y + 2, 60, 60);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(0,0,0,${rng() * 0.12})`;
      g.fillRect(x + 2 + rng() * 58, y + 2 + rng() * 58, 2, 2);
    }
  }
  return T.toTex(c, { repeat: [1, 1] });
}

function lookRightTex() {
  const W = 512, H = 154, c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = 'rgba(236,232,220,0.92)';
  g.font = '900 96px "Noto Sans TC", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('望右', 150, H / 2 + 6);
  g.font = '800 54px "Big Shoulders Display", sans-serif';
  g.fillText('LOOK', 380, H / 2 - 24);
  g.fillText('RIGHT', 380, H / 2 + 32);
  g.beginPath();
  g.moveTo(470, H / 2 - 50); g.lineTo(500, H / 2 - 30); g.lineTo(470, H / 2 - 10);
  g.strokeStyle = 'rgba(236,232,220,0.92)';
  g.lineWidth = 8;
  g.stroke();
  return T.toTex(c);
}

function hoardingTex(rng) {
  const W = 512, H = 128, c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#2f6b4a';
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 64) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x, 0, 3, H);
  }
  g.fillStyle = '#e8e2d0';
  g.fillRect(0, H - 22, W, 22);
  for (let x = -40; x < W; x += 40) {
    g.fillStyle = '#c8241c';
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + 20, H - 22); g.lineTo(x + 40, H - 22); g.lineTo(x + 20, H); g.fill();
  }
  g.fillStyle = '#f2ead2';
  g.font = '900 40px "Noto Sans TC", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('道路工程', W / 2, 48);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${rng() * 0.12})`;
    g.fillRect(rng() * W, rng() * H, 3, 3);
  }
  return T.toTex(c, { repeat: [1, 1] });
}
