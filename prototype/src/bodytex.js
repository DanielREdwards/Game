// Desenhos de tatuagem (dragão serpenteante, nuvens) e conversão de relevo em mapa de normais,
// usados pela pintura dos personagens (body/paint.js).
import { makeCanvas, toTex } from './textures.js';
import { mulberry32 } from './util.js';

const INK = 'rgba(14,17,24,0.92)';
const WASH = 'rgba(30,36,48,0.32)';

// ------------------------------------------------------------ relevo → mapa de normais

export function heightToNormal(src, strength = 2.5) {
  const W = src.width, H = src.height;
  const s = src.getContext('2d').getImageData(0, 0, W, H).data;
  const out = makeCanvas(W, H), og = out.getContext('2d');
  const img = og.createImageData(W, H), d = img.data;
  const h = (x, y) => s[(Math.min(H - 1, Math.max(0, y)) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1);
      const dy = h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1);
      const nx = -dx * strength, ny = dy * strength;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * W + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return toTex(out, { srgb: false, aniso: 4 });
}




// ------------------------------------------------------------ tatuagem: dragão, nuvens, pontilhado

function catmull(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c2, d2) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d2) * t2 + (-a + 3 * b - 3 * c2 + d2) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function stipple(g, rng, x, y, r, n, a = 0.5) {
  g.fillStyle = `rgba(14,17,24,${a})`;
  for (let i = 0; i < n; i++) {
    const ang = rng() * Math.PI * 2, d = Math.pow(rng(), 0.6) * r;
    g.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1.2, 1.2);
  }
}

export function cloud(g, x, y, r, rng) {
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, r * 0.09);
  for (let k = 0; k < 3; k++) {
    const cx = x + (k - 1) * r * 0.9, cy = y + (k === 1 ? -r * 0.35 : 0), rr = r * (k === 1 ? 0.75 : 0.55);
    g.beginPath();
    for (let a = 0; a <= Math.PI * 3.2; a += 0.15) {
      const q = rr * (1 - a / (Math.PI * 3.6));
      const px = cx + Math.cos(a + k) * q, py = cy + Math.sin(a + k) * q;
      a ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x - r * 1.6, y + r * 0.55);
  g.quadraticCurveTo(x, y + r * 0.9, x + r * 1.6, y + r * 0.5);
  g.stroke();
  stipple(g, rng, x, y + r * 0.3, r * 1.2, Math.round(r * 3), 0.35);
  g.restore();
}

function dragonHead(g, x, y, ang, s) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(s, s);
  g.strokeStyle = INK;
  g.fillStyle = 'rgba(40,46,58,0.5)';
  g.lineJoin = 'round';
  g.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) {
    const a = -2.4 + k * 0.42;
    g.beginPath();
    g.moveTo(-4, 0);
    g.quadraticCurveTo(-18 + Math.cos(a) * 10, Math.sin(a) * 18, -32 + Math.cos(a) * 8, Math.sin(a) * 28);
    g.stroke();
  }
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-8, -12); g.quadraticCurveTo(8, -21, 22, -12); g.quadraticCurveTo(34, -10, 45, -6);
  g.lineTo(45, -1); g.quadraticCurveTo(30, 0, 18, 1); g.lineTo(-6, 5); g.closePath();
  g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(16, 5); g.quadraticCurveTo(30, 8, 41, 15); g.lineTo(37, 18); g.quadraticCurveTo(20, 17, -4, 10); g.closePath();
  g.fill(); g.stroke();
  g.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(22 + k * 4.5, 1); g.lineTo(23 + k * 4.5, 5); g.stroke(); }
  g.beginPath(); g.ellipse(14, -9, 4.8, 2.6, -0.2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = INK;
  g.beginPath(); g.arc(15, -9, 1.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(41, -4.5, 1.5, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(5, -14); g.quadraticCurveTo(14, -20, 25, -13); g.stroke();
  g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(2, -15); g.quadraticCurveTo(-14, -31, -36, -30); g.stroke();
  g.beginPath(); g.moveTo(8, -16); g.quadraticCurveTo(-4, -37, -24, -44); g.stroke();
  g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(42, -4); g.bezierCurveTo(56, -20, 42, -40, 64, -52); g.stroke();
  g.beginPath(); g.moveTo(38, 13); g.bezierCurveTo(54, 27, 42, 45, 66, 54); g.stroke();
  g.restore();
}

// Dragão serpenteante ao longo de pontos de controle; a cabeça fica no primeiro ponto.
export function drawDragon(g, ctrl, { width = 22, seed = 1, head = true } = {}) {
  const rng = mulberry32(seed);
  const P = catmull(ctrl, 22);
  const N = P.length;
  const T = [], Lft = [], Rgt = [];
  for (let i = 0; i < N; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const f = i / (N - 1);
    const w = (width * (f < 0.06 ? 0.75 + f * 4 : Math.pow(1 - f, 0.5)) + 1.2) * 0.5;
    T.push([tx, ty, w]);
    Lft.push([P[i][0] - ty * w, P[i][1] + tx * w]);
    Rgt.push([P[i][0] + ty * w, P[i][1] - tx * w]);
  }
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = WASH;
  g.beginPath();
  Lft.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = N - 1; i >= 0; i--) g.lineTo(Rgt[i][0], Rgt[i][1]);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1;
  for (let i = 2; i < N - 2; i += 2) {
    const [tx, ty, w] = T[i];
    const base = Math.atan2(ty, tx);
    for (const s of [-0.5, 0.5]) {
      const cx = P[i][0] - ty * w * s, cy = P[i][1] + tx * w * s;
      g.beginPath();
      g.arc(cx, cy, w * 0.45, base + Math.PI * 0.5, base + Math.PI * 1.5);
      g.stroke();
    }
  }
  for (let i = 1; i < N - 1; i += 2) {
    const [tx, ty, w] = T[i];
    const r = Rgt[i];
    g.beginPath();
    g.moveTo(r[0], r[1]);
    g.lineTo(r[0] - ty * w * 0.4, r[1] + tx * w * 0.4);
    g.stroke();
  }
  g.fillStyle = INK;
  for (let i = 4; i < N - 6; i += 3) {
    const [tx, ty, w] = T[i];
    const p = Lft[i], q = Lft[i + 2];
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(p[0] - ty * w * 0.9 - tx * w * 0.6, p[1] + tx * w * 0.9 - ty * w * 0.6);
    g.lineTo(q[0], q[1]);
    g.closePath();
    g.fill();
  }
  g.lineWidth = 2.2;
  for (const side of [Lft, Rgt]) {
    g.beginPath();
    side.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
  }
  g.lineWidth = 1.6;
  for (const f of [0.2, 0.48, 0.72]) {
    const i = Math.floor(f * (N - 1));
    const [tx, ty, w] = T[i];
    const r = Rgt[i];
    const nx = ty, ny = -tx;
    const kx = r[0] + nx * w * 1.3 - tx * w * 0.6, ky = r[1] + ny * w * 1.3 - ty * w * 0.6;
    const fx = kx + nx * w * 0.6 + tx * w * 0.9, fy = ky + ny * w * 0.6 + ty * w * 0.9;
    g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    for (let c = -1; c <= 1; c++) {
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + (tx + nx * c * 0.6) * w * 0.5, fy + (ty + ny * c * 0.6) * w * 0.5, fx + (tx * 0.9 + nx * c) * w * 0.7, fy + (ty * 0.9 + ny * c) * w * 0.7);
      g.stroke();
    }
  }
  for (let i = 0; i < N; i += 6) stipple(g, rng, P[i][0], P[i][1], T[i][2] * 2.2, 14, 0.4);
  if (head) {
    const [tx, ty] = T[0];
    dragonHead(g, P[0][0], P[0][1], Math.atan2(-ty, -tx), width / 22);
  }
  g.restore();
}
