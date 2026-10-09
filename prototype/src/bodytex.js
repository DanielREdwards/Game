// Texturas de corpo e figurino: pele com relevo muscular, tatuagens, ternos e tecidos.
// Convenção do tronco (geometria de revolução girada −90°): x = 0 flanco direito, 128 frente,
// 256 flanco esquerdo, 384 costas. O topo do canvas corresponde ao topo da peça.
import { makeCanvas, toTex } from './textures.js';
import { CJK_FONT } from './config.js';
import { mulberry32 } from './util.js';

const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", ' + CJK_FONT;
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

function wrapX(W, x, r, fn) {
  fn(x);
  if (x - r < 0) fn(x + W);
  if (x + r > W) fn(x - W);
}

function bump(g, x, y, rx, ry, amt, rot = 0) {
  wrapX(g.canvas.width, x, rx, (X) => {
    g.save();
    g.translate(X, y);
    g.rotate(rot);
    g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(255,255,255,${amt})`);
    gr.addColorStop(0.55, `rgba(255,255,255,${amt * 0.55})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

function groove(g, pts, w, amt) {
  g.save();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = `rgba(0,0,0,${amt})`;
  g.shadowColor = `rgba(0,0,0,${amt})`;
  g.shadowBlur = w * 1.6;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.restore();
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

function inkText(g, text, x, y, size) {
  g.save();
  g.fillStyle = INK;
  g.font = `900 ${size}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...text].forEach((ch, i) => g.fillText(ch, x, y + i * size * 1.05));
  g.restore();
}

// ------------------------------------------------------------ pele

function skinBase(g, W, H, rng, base) {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(120,60,40,0.05)' : 'rgba(255,220,200,0.04)';
    g.fillRect(rng() * W, rng() * H, 2, 2);
  }
}

// Tronco do protagonista: peito e abdômen, com tatuagens e relevo muscular.
export function heroTorso(skin) {
  const rng = mulberry32(25);
  const W = 512, H = 256;
  // relevo
  const hc = makeCanvas(W, H), hg = hc.getContext('2d');
  hg.fillStyle = 'rgb(100,100,100)';
  hg.fillRect(0, 0, W, H);
  for (const s of [-1, 1]) {
    bump(hg, 128 + s * 40, 98, 48, 40, 0.55);
    groove(hg, [[128 + s * 6, 136], [128 + s * 40, 140], [128 + s * 82, 112]], 5, 0.35);
    bump(hg, 128 + s * 45, 18, 42, 9, 0.25, s * 0.15);
    bump(hg, 128 + s * 112, 160, 20, 60, 0.3);
    for (let k = 0; k < 4; k++) bump(hg, 128 + s * (92 + k * 5), 150 + k * 22, 11, 6, 0.3, s * 0.6);
    bump(hg, 384 + s * 50, 82, 34, 42, 0.35);
    bump(hg, 384 + s * 95, 150, 26, 72, 0.32);
    bump(hg, 384 + s * 40, 26, 50, 20, 0.35);
  }
  groove(hg, [[128, 46], [128, 140]], 5, 0.32);
  groove(hg, [[384, 0], [384, 256]], 6, 0.35);
  const chestN = heightToNormal(hc, 2.2);

  const ac = makeCanvas(W, H), ag = ac.getContext('2d');
  ag.fillStyle = 'rgb(100,100,100)';
  ag.fillRect(0, 0, W, H);
  for (const s of [-1, 1]) {
    bump(ag, 128 + s * 19, 52, 16, 27, 0.55);
    bump(ag, 128 + s * 19, 118, 16, 26, 0.55);
    bump(ag, 128 + s * 18, 182, 15, 25, 0.48);
    groove(ag, [[128 + s * 6, 84], [128 + s * 34, 86]], 3, 0.25);
    groove(ag, [[128 + s * 6, 150], [128 + s * 33, 152]], 3, 0.25);
    bump(ag, 128 + s * 64, 130, 22, 62, 0.35);
    groove(ag, [[128 + s * 54, 170], [128 + s * 22, 256]], 5, 0.3);
    bump(ag, 384 + s * 18, 140, 14, 92, 0.4);
  }
  groove(ag, [[128, 18], [128, 232]], 4, 0.35);
  groove(ag, [[384, 0], [384, 256]], 6, 0.35);
  const absN = heightToNormal(ac, 2.4);

  // cor + tatuagens; as costas são desenhadas numa folha única de 512×512 (peito em cima, abdômen embaixo)
  const back = makeCanvas(W, H * 2), bg = back.getContext('2d');
  drawDragon(bg, [[332, 40], [360, 80], [412, 112], [426, 170], [384, 220], [346, 270], [356, 330], [404, 372], [430, 420], [412, 470]], { width: 30, seed: 7 });
  cloud(bg, 440, 260, 16, rng);
  cloud(bg, 330, 400, 14, rng);
  cloud(bg, 450, 470, 12, rng);
  inkText(bg, '洪門', 452, 52, 40);

  const cc = makeCanvas(W, H), cg = cc.getContext('2d');
  skinBase(cg, W, H, rng, skin);
  cg.fillStyle = 'rgba(110,60,45,0.55)';
  for (const s of [-1, 1]) { cg.beginPath(); cg.arc(128 + s * 44, 118, 4.5, 0, Math.PI * 2); cg.fill(); }
  drawDragon(cg, [[150, 72], [190, 52], [228, 30], [262, 52], [282, 96], [292, 150]], { width: 22, seed: 3 });
  cloud(cg, 236, 120, 12, rng);
  inkText(cg, '香港', 160, 118, 38);
  cg.drawImage(back, 0, 0, W, H, 0, 0, W, H);

  const bc = makeCanvas(W, H), bgc = bc.getContext('2d');
  skinBase(bgc, W, H, rng, skin);
  bgc.drawImage(back, 0, H, W, H, 0, 0, W, H);

  return {
    chest: { map: toTex(cc), normalMap: chestN },
    abdomen: { map: toTex(bc), normalMap: absN },
  };

}

// Manga de tatuagem do braço esquerdo (braço e antebraço) e ombro.
export function heroSleeve(skin) {
  const rng = mulberry32(31);
  const make = (ctrl, seed, head) => {
    const W = 256, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
    skinBase(g, W, H, rng, skin);
    for (const ox of [-W, 0, W]) {
      cloud(g, 60 + ox, 200, 14, rng);
      cloud(g, 190 + ox, 60, 13, rng);
      drawDragon(g, ctrl.map(([x, y]) => [x + ox, y]), { width: 34, seed, head: head && ox === 0 });
    }
    g.strokeStyle = 'rgba(14,17,24,0.6)';
    g.lineWidth = 3;
    for (let y = 20; y < H; y += 46) {
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 5);
      g.stroke();
    }
    return toTex(c);
  };
  return {
    upper: make([[60, 40], [130, 70], [200, 120], [260, 170], [320, 230]], 11, true),
    lower: make([[-40, 10], [40, 60], [120, 120], [190, 180], [250, 250]], 12, false),
    shoulder: make([[0, 60], [80, 100], [160, 140], [240, 180]], 13, false),
  };
}

export function plainSkin(skin) {
  const W = 128, c = makeCanvas(W, W), g = c.getContext('2d');
  skinBase(g, W, W, mulberry32(5), skin);
  return toTex(c);
}

// ------------------------------------------------------------ figurinos

function fabric(g, W, H, rng, base, stripe, gap = 8) {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H * 0.04; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.035)';
    g.fillRect(rng() * W, rng() * H, 1.5, 1.5);
  }
  if (stripe) {
    g.fillStyle = stripe;
    for (let x = 2; x < W; x += gap) g.fillRect(x, 0, 1, H);
  }
}

// Terno risca de giz: peito, abdômen, mangas e calça. Opções: colete, gravata, lenço, broche, sobretudo.
export function suitSet(o) {
  const rng = mulberry32(o.seed || 9);
  const W = 512, H = 256, F = 128;
  const chest = makeCanvas(W, H), g = chest.getContext('2d');
  fabric(g, W, H, rng, o.base, o.stripe);
  if (o.coat) {
    g.fillStyle = o.coat;
    g.fillRect(0, 0, F - 62, H);
    g.fillRect(F + 62, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(F - 66, 0, 4, H);
    g.fillRect(F + 62, 0, 4, H);
  }
  const lapel = 46;
  g.fillStyle = o.shirt;
  g.beginPath(); g.moveTo(F - lapel, 0); g.lineTo(F + lapel, 0); g.lineTo(F, 196); g.closePath(); g.fill();
  g.fillStyle = o.tie;
  g.beginPath(); g.moveTo(F - 8, 6); g.lineTo(F + 8, 6); g.lineTo(F + 6, 20); g.lineTo(F - 6, 20); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(F - 6, 20); g.lineTo(F + 6, 20); g.lineTo(F + 11, H); g.lineTo(F - 11, H); g.closePath(); g.fill();
  if (o.tiePattern) {
    g.fillStyle = o.tiePattern;
    for (let y = 26; y < H; y += 12) { g.beginPath(); g.arc(F, y, 3, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = o.collar || 'rgba(255,255,255,0.9)';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(F + s * 22, 0); g.lineTo(F + s * 6, 6); g.lineTo(F + s * 16, 18); g.closePath(); g.fill();
  }
  if (o.vest) {
    g.fillStyle = o.vest;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(F + s * lapel, 0); g.lineTo(F + s * 24, 0); g.lineTo(F, 120); g.lineTo(F, 200); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (const y of [138, 160, 182]) { g.beginPath(); g.arc(F, y, 3, 0, Math.PI * 2); g.fill(); }
  }
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath(); g.moveTo(F + s * lapel, 0); g.lineTo(F + s * (lapel + 14), 8); g.lineTo(F + s * 6, 210); g.lineTo(F, 200); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(F + s * (lapel + 14), 8); g.lineTo(F + s * 6, 210); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(F + 30, 112, 28, 3);
  if (o.square) {
    g.fillStyle = o.square;
    g.beginPath(); g.moveTo(F + 32, 112); g.lineTo(F + 38, 100); g.lineTo(F + 44, 112); g.lineTo(F + 50, 102); g.lineTo(F + 56, 112); g.closePath(); g.fill();
  }
  if (o.brooch) {
    g.fillStyle = o.brooch;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.arc(F + 40 + Math.cos(a) * 5, 60 + Math.sin(a) * 5, 3, 0, Math.PI * 2); g.fill(); }
  }

  const abd = makeCanvas(W, H), a = abd.getContext('2d');
  fabric(a, W, H, rng, o.base, o.stripe);
  if (o.coat) {
    a.fillStyle = o.coat;
    a.fillRect(0, 0, F - 56, H);
    a.fillRect(F + 56, 0, W, H);
  }
  if (!o.vest) {
    a.fillStyle = o.tie;
    a.beginPath(); a.moveTo(F - 11, 0); a.lineTo(F + 11, 0); a.lineTo(F + 12, 110); a.lineTo(F, 124); a.lineTo(F - 12, 110); a.closePath(); a.fill();
  }
  a.fillStyle = 'rgba(0,0,0,0.35)';
  a.fillRect(F - 1, 0, 2, H);
  a.fillStyle = 'rgba(0,0,0,0.6)';
  for (const y of [70, 150]) { a.beginPath(); a.arc(F + 4, y, 4, 0, Math.PI * 2); a.fill(); }
  if (o.watch) {
    a.strokeStyle = o.watch;
    a.lineWidth = 2;
    a.beginPath(); a.moveTo(F - 30, 60); a.quadraticCurveTo(F, 96, F + 34, 64); a.stroke();
  }

  const sleeve = (cuff) => {
    const c = makeCanvas(256, 256), s = c.getContext('2d');
    fabric(s, 256, 256, rng, o.sleeveBase || o.base, o.sleeveBase ? null : o.stripe);
    if (cuff) { s.fillStyle = o.cuff || '#eeeae2'; s.fillRect(0, 238, 256, 18); }
    return toTex(c);
  };
  const pants = makeCanvas(256, 256), p = pants.getContext('2d');
  fabric(p, 256, 256, rng, o.base, o.stripe);
  p.fillStyle = 'rgba(255,255,255,0.08)';
  p.fillRect(0, 0, 2, 256);
  p.fillRect(254, 0, 2, 256);
  return {
    chest: toTex(chest), abdomen: toTex(abd), upper: sleeve(false), lower: sleeve(true), pants: toTex(pants),
  };
}

export function cargoTex() {
  const rng = mulberry32(3);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  fabric(g, 256, 256, rng, '#1c1d21', null);
  g.strokeStyle = 'rgba(255,255,255,0.035)';
  g.lineWidth = 1;
  for (let i = -256; i < 512; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  for (const x of [62, 192]) g.fillRect(x, 0, 2, 256);
  return toTex(c);
}

// Calçados: o topo do canvas é a ponta do pé.
export function shoeTex(kind) {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  if (kind === 'sneaker') {
    g.fillStyle = '#121214'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, 128, 30); g.fillRect(0, 104, 128, 24);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 40; y < 100; y += 10) g.fillRect(56, y, 16, 3);
  } else if (kind === 'spectator') {
    g.fillStyle = '#efece4'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#0f0f11'; g.fillRect(0, 0, 128, 38); g.fillRect(0, 100, 128, 28);
  } else {
    g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, 128, 128);
  }
  return toTex(c);
}

export function neckInk(skin) {
  const rng = mulberry32(17);
  const c = makeCanvas(256, 128), g = c.getContext('2d');
  skinBase(g, 256, 128, rng, skin);
  g.strokeStyle = INK;
  g.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const x = 50 + k * 20, y = 40 + (k % 2) * 30;
    for (let r = 4; r < 16; r += 4) { g.beginPath(); g.arc(x, y, r, k, k + 4.6); g.stroke(); }
  }
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(30 + i * 18, 120);
    g.quadraticCurveTo(40 + i * 18, 70, 60 + i * 16, 20);
    g.stroke();
  }
  stipple(g, rng, 80, 60, 40, 120, 0.4);
  return toTex(c);
}
