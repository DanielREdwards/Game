// Texturas 100% procedurais (desenhadas em <canvas>). Nenhuma imagem externa é usada.
import * as THREE from 'three';
import { CJK_FONT } from './config.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTex(canvas, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = aniso;
  return t;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

function pickW(rng, list) {
  let s = 0;
  for (const [, w] of list) s += w;
  let r = rng() * s;
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[0][0];
}

// Desenha `fn(x, y)` também nas bordas opostas, para a textura repetir sem emenda.
function wrapped(S, x, y, r, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    const X = x + ox, Y = y + oy;
    if (X + r < 0 || X - r > S || Y + r < 0 || Y - r > S) continue;
    fn(X, Y);
  }
}

export function radialTex(stops, size = 128) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return toTex(c);
}

export function smokeTex(rng) {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const x = S / 2 + (rng() - 0.5) * S * 0.36, y = S / 2 + (rng() - 0.5) * S * 0.36;
    const r = S * (0.16 + rng() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  return toTex(c);
}

// ---------------------------------------------------------------- chão

export function asphaltTex(rng) {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#3b3b40';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 110, a = 0.05 + rng() * 0.09;
    const dark = rng() < 0.65;
    wrapped(S, x, y, r, (X, Y) => {
      const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.5})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(X - r, Y - r, r * 2, r * 2);
    });
  }
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 34;
    d[i] += n; d[i + 1] += n; d[i + 2] += n + 2;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 2600; i++) {
    const v = (78 + rng() * 70) | 0;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(rng() * S, rng() * S, 1 + rng() * 1.6, 1 + rng() * 1.6);
  }
  g.strokeStyle = 'rgba(12,12,14,0.7)';
  for (let i = 0; i < 12; i++) {
    g.lineWidth = 0.6 + rng() * 1.5;
    g.beginPath();
    let x = rng() * S, y = rng() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 10; k++) { x += (rng() - 0.5) * 44; y += (rng() - 0.5) * 44; g.lineTo(x, y); }
    g.stroke();
  }
  return toTex(c, { repeat: [7, 7] });
}

// Máscara de poças (canal G = rugosidade: preto = espelho d'água, branco = seco).
export function puddleTex(rng, w2c, spots) {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = 'rgb(222,222,222)';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 180; i++) {
    const x = rng() * S, y = rng() * S, r = 10 + rng() * 40, v = (150 + rng() * 70) | 0;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.6)`);
    gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const blob = (cx, cy, rx, ry, rot, core = 0.55) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(92,92,92,1)');
    gr.addColorStop(Math.max(core, 0.72), 'rgba(92,92,92,0.95)');
    gr.addColorStop(1, 'rgba(92,92,92,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const ppm = S / 24;
  for (const [x, z, rx, rz, rot] of spots) {
    const [cx, cy] = w2c(x, z, S);
    blob(cx, cy, rx * ppm, rz * ppm, rot);
    for (let k = 0; k < 5; k++) {
      blob(cx + (rng() - 0.5) * rx * ppm * 1.4, cy + (rng() - 0.5) * rz * ppm * 1.4,
        rx * ppm * (0.3 + rng() * 0.4), rz * ppm * (0.3 + rng() * 0.4), rng() * 3, 0.4);
    }
  }
  for (let i = 0; i < 26; i++) {
    const [cx, cy] = w2c(-11 + rng() * 22, -9 + rng() * 22, S);
    blob(cx, cy, (0.3 + rng() * 0.8) * ppm, (0.2 + rng() * 0.5) * ppm, rng() * 3, 0.3);
  }
  // sarjetas encharcadas junto às paredes
  for (const x of [-8.6, 8.6]) {
    for (let z = -8; z < 13; z += 0.7) {
      const [cx, cy] = w2c(x, z, S);
      blob(cx, cy, 0.5 * ppm, 0.6 * ppm, 0, 0.3);
    }
  }
  return toTex(c, { srgb: false, aniso: 4 });
}

// ---------------------------------------------------------------- fachadas

const WIN_LIGHTS = [['#ffc887', 5], ['#ffe8c2', 2.5], ['#bfe2ff', 2], ['#c9ffd9', 1.2], ['#ff9fb4', 0.6]];

export function facadeTex(rng, wM, hM, { base = '#8a9a92', shopH = 4.4, floorH = 3.0, cols = 3, lit = 0.42, cages = 0.35 } = {}) {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const e = makeCanvas(W, H), ge = e.getContext('2d');
  const sy = H / hM;
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, W, H);
  // pastilhas cerâmicas
  g.globalAlpha = 0.06;
  g.strokeStyle = '#000';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = rng() < 0.55 ? `rgba(0,0,0,${0.05 + rng() * 0.08})` : `rgba(255,255,255,${0.03 + rng() * 0.05})`;
    g.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2);
  }
  const floors = Math.floor((hM - shopH) / floorH);
  const colW = W / cols;
  for (let f = 0; f < floors; f++) {
    const y0 = H - (shopH + (f + 1) * floorH) * sy, fh = floorH * sy;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, y0 + fh - 4, W, 4);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, y0 + fh - 6, W, 2);
    for (let k = 0; k < cols; k++) {
      const wx = k * colW + colW * 0.14, ww = colW * 0.72, wy = y0 + fh * 0.2, wh = fh * 0.56;
      g.fillStyle = '#9aa3a6';
      g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const on = rng() < lit;
      g.fillStyle = on ? '#3a3022' : '#0b0e15';
      g.fillRect(wx, wy, ww, wh);
      if (!on) {
        const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        gr.addColorStop(0, 'rgba(110,80,160,0.28)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(wx, wy, ww, wh);
      } else {
        const col = pickW(rng, WIN_LIGHTS);
        const gr = ge.createLinearGradient(0, wy, 0, wy + wh);
        gr.addColorStop(0, col);
        gr.addColorStop(1, mixHex(col, '#000000', 0.45));
        ge.globalAlpha = 0.45 + rng() * 0.55;
        ge.fillStyle = gr;
        ge.fillRect(wx, wy, ww, wh);
        ge.globalAlpha = 1;
        ge.fillStyle = 'rgba(0,0,0,0.82)';
        if (rng() < 0.55) ge.fillRect(wx, wy, ww * (0.15 + rng() * 0.4), wh);
        if (rng() < 0.45) ge.fillRect(wx + ww * (0.5 + rng() * 0.2), wy + wh * (0.45 + rng() * 0.2), ww * 0.3, wh);
        g.globalAlpha = 0.5;
        g.fillStyle = col;
        g.fillRect(wx, wy, ww, wh);
        g.globalAlpha = 1;
      }
      for (const ctx of [g, ge]) {
        ctx.fillStyle = ctx === g ? '#7c8588' : '#000';
        ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
        ctx.fillRect(wx, wy + wh * 0.3, ww, 2);
      }
      if (rng() < cages) {
        // grades de janela ("gaiolas"), muito comuns nos prédios antigos
        const cx0 = wx - 6, cw = ww + 12, cy0 = wy - 4, ch = wh + 10;
        for (const ctx of [g, ge]) {
          ctx.strokeStyle = ctx === g ? '#2e3236' : '#000';
          ctx.lineWidth = 2;
          for (let x = cx0; x <= cx0 + cw; x += 7) { ctx.beginPath(); ctx.moveTo(x, cy0); ctx.lineTo(x, cy0 + ch); ctx.stroke(); }
          ctx.strokeRect(cx0, cy0, cw, ch);
        }
      }
      if (rng() < 0.3) {
        const aw = colW * 0.32, ah = fh * 0.16, ax = wx + rng() * (ww - aw), ay = wy + wh + fh * 0.05;
        g.fillStyle = '#cfccc2';
        g.fillRect(ax, ay, aw, ah);
        g.fillStyle = '#7d7a72';
        for (let x = ax + 3; x < ax + aw - 2; x += 3) g.fillRect(x, ay + 3, 1, ah - 6);
      }
      if (rng() < 0.55) {
        const sx = wx + rng() * ww, len = fh * (0.5 + rng() * 1.5);
        const gr = g.createLinearGradient(0, wy + wh, 0, wy + wh + len);
        gr.addColorStop(0, 'rgba(50,35,20,0.35)');
        gr.addColorStop(1, 'rgba(50,35,20,0)');
        g.fillStyle = gr;
        g.fillRect(sx, wy + wh, 2 + rng() * 6, len);
      }
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H, len = 40 + rng() * 320;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, 'rgba(0,0,0,0.2)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, 2 + rng() * 8, len);
  }
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 0, W, 10);
  g.fillStyle = '#121216';
  g.fillRect(0, H - shopH * sy, W, shopH * sy);
  return { map: toTex(c), emissiveMap: toTex(e) };
}

export function shutterTex(rng, tint = '#5f6b72') {
  const W = 256, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = tint;
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 9) {
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.fillRect(0, y, W, 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, y + 3, W, 1);
  }
  for (let i = 0; i < 18; i++) {
    const x = rng() * W, y = rng() * H, r = 8 + rng() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rng() < 0.5 ? 'rgba(110,60,25,0.35)' : 'rgba(0,0,0,0.3)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // cartazes rasgados genéricos, sem texto
  for (let i = 0; i < 3; i++) {
    g.fillStyle = ['#d8cfb4', '#c9473c', '#e0c34a'][i];
    g.globalAlpha = 0.55;
    g.fillRect(20 + rng() * 180, 30 + rng() * 150, 30 + rng() * 30, 40 + rng() * 30);
  }
  g.globalAlpha = 1;
  return toTex(c);
}

export function interiorTex(rng, kind) {
  const W = 512, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  const pal = {
    cafe: ['#ffe4b3', '#c98a4a'],
    pharm: ['#f2fff9', '#8fd3bc'],
    stair: ['#dcffe8', '#6fae8a'],
    mahjong: ['#ffd29e', '#b8743a'],
    massage: ['#ffd6ee', '#c4568f'],
  }[kind];
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, pal[0]);
  gr.addColorStop(1, pal[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let x = 30; x < W; x += 120) g.fillRect(x, 10, 80, 6);
  if (kind === 'cafe' || kind === 'mahjong') {
    for (let x = 16; x < W - 60; x += 74) {
      g.fillStyle = kind === 'cafe' ? '#b0221c' : '#2d6b3f';
      g.fillRect(x, 36, 60, 52);
      g.fillStyle = '#ffd86b';
      for (let y = 44; y < 82; y += 9) g.fillRect(x + 6, y, 18 + rng() * 30, 4);
    }
    g.fillStyle = 'rgba(70,35,15,0.65)';
    for (let x = 10; x < W; x += 110) {
      g.fillRect(x, 170, 70, 8);
      g.fillRect(x + 8, 178, 6, 60);
      g.fillRect(x + 56, 178, 6, 60);
    }
  } else if (kind === 'pharm') {
    for (let y = 50; y < 230; y += 36) {
      g.fillStyle = 'rgba(40,70,60,0.5)';
      g.fillRect(0, y + 26, W, 4);
      for (let x = 6; x < W; x += 9 + rng() * 6) {
        g.fillStyle = `hsl(${(rng() * 360) | 0},70%,${45 + rng() * 25}%)`;
        g.fillRect(x, y + 4 + rng() * 6, 6 + rng() * 4, 22 - rng() * 6);
      }
    }
  } else if (kind === 'stair') {
    g.strokeStyle = 'rgba(30,60,40,0.55)';
    g.lineWidth = 4;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(140 + i * 22, 240 - i * 18); g.lineTo(512, 240 - i * 18); g.stroke(); }
    g.fillStyle = 'rgba(60,70,60,0.6)';
    for (let x = 10; x < 120; x += 22) for (let y = 60; y < 150; y += 18) g.fillRect(x, y, 18, 14);
  } else {
    g.fillStyle = 'rgba(120,30,70,0.35)';
    for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 30, H);
  }
  return toTex(c);
}

// ---------------------------------------------------------------- letreiros

function tubeStroke(g, color, lw, draw) {
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.strokeStyle = color;
  g.shadowBlur = lw * 3.2;
  g.lineWidth = lw * 1.7;
  draw();
  g.shadowBlur = lw;
  draw();
  g.shadowBlur = 0;
  g.strokeStyle = mixHex(color, '#ffffff', 0.72);
  g.lineWidth = lw * 0.55;
  draw();
}

export function neonTex(text, { color = '#ff3355', vertical = true, w = 1, h = 3, style = 'tube', plate = '#fff3dc', ink = '#c21d24' } = {}) {
  const ppm = 150;
  let W = Math.round(w * ppm), H = Math.round(h * ppm);
  const k = Math.min(1, 1024 / Math.max(W, H));
  W = Math.round(W * k);
  H = Math.round(H * k);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const chars = [...text], n = chars.length;
  const m = Math.min(W, H);
  if (style === 'tube') {
    g.fillStyle = '#0b0a11';
    g.fillRect(0, 0, W, H);
    const lw = Math.max(3, m * 0.03);
    tubeStroke(g, color, lw, () => g.strokeRect(lw * 2.5, lw * 2.5, W - lw * 5, H - lw * 5));
  } else {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, plate);
    gr.addColorStop(1, mixHex(plate, '#000000', 0.14));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = color;
    g.lineWidth = m * 0.08;
    g.strokeRect(0, 0, W, H);
  }
  const pad = m * 0.16;
  const along = (vertical ? H : W) - pad * 2, across = (vertical ? W : H) - pad * 2;
  const cell = along / n, fs = Math.min(across * 0.92, cell * 0.9);
  g.font = `900 ${fs}px ${CJK_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const x = vertical ? W / 2 : pad + cell * (i + 0.5);
    const y = (vertical ? pad + cell * (i + 0.5) : H / 2) + fs * 0.04;
    if (style === 'tube') tubeStroke(g, color, Math.max(2, fs * 0.035), () => g.strokeText(ch, x, y));
    else { g.fillStyle = ink; g.fillText(ch, x, y); }
  });
  return toTex(c);
}

// Sinal de perigo exibido sobre o inimigo que vai atacar (design próprio: 危 = "perigo").
export function dangerTex() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.save();
  g.rotate(Math.PI / 4);
  g.strokeStyle = '#fff';
  g.lineWidth = 7;
  g.strokeRect(-36, -36, 72, 72);
  g.restore();
  g.fillStyle = '#fff';
  g.font = `900 54px ${CJK_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('危', 0, 3);
  return toTex(c);
}

// ---------------------------------------------------------------- roupas e adereços

export function floralTex(rng) {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#a51c2c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    const x = rng() * S, y = rng() * S, r = 9 + rng() * 9, rot = rng() * 6;
    wrapped(S, x, y, r * 2, (X, Y) => {
      g.fillStyle = '#1f6b45';
      g.beginPath();
      g.ellipse(X + r, Y + r * 0.6, r * 0.9, r * 0.35, rot, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rng() < 0.5 ? '#f3c04a' : '#f5ecd8';
      for (let p = 0; p < 5; p++) {
        const a = rot + (p / 5) * Math.PI * 2;
        g.beginPath();
        g.ellipse(X + Math.cos(a) * r * 0.55, Y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#7a1a10';
      g.beginPath();
      g.arc(X, Y, r * 0.22, 0, Math.PI * 2);
      g.fill();
    });
  }
  return toTex(c, { repeat: [2, 2] });
}

export function trackTex() {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#1d6a4a';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8efe9';
  g.fillRect(28, 0, 5, S);
  g.fillRect(37, 0, 5, S);
  g.fillRect(92, 0, 5, S);
  g.fillRect(101, 0, 5, S);
  return toTex(c);
}

export function wrapTex() {
  const S = 64, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#ece6da';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(120,100,80,0.35)';
  g.lineWidth = 2;
  for (let y = -S; y < S * 2; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + 20); g.stroke(); }
  return toTex(c);
}

export function acTex() {
  const W = 128, H = 96, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#d6d3ca';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#5d5b55';
  g.beginPath();
  g.arc(78, 48, 34, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#a9a69d';
  g.lineWidth = 2;
  for (let r = 6; r < 34; r += 6) { g.beginPath(); g.arc(78, 48, r, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#8f8c84';
  for (let y = 12; y < 84; y += 6) g.fillRect(10, y, 26, 2);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(60,40,20,0.35)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return toTex(c);
}

export function crateTex(rng) {
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
  for (let y = 0; y < S; y += 32) {
    const v = 95 + rng() * 40;
    g.fillStyle = `rgb(${v | 0},${(v * 0.72) | 0},${(v * 0.45) | 0})`;
    g.fillRect(0, y, S, 30);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, y + 30, S, 2);
    g.fillStyle = 'rgba(30,20,10,0.8)';
    g.fillRect(6, y + 13, 3, 3);
    g.fillRect(S - 10, y + 13, 3, 3);
  }
  return toTex(c);
}

export function taxiSignTex() {
  const W = 256, H = 96, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#fff6dc';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#c3161c';
  g.font = `900 64px ${CJK_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('的士', W / 2, H / 2 + 4);
  return toTex(c);
}

export function paintTex(text) {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = 'rgba(235,232,220,0.85)';
  g.font = `900 200px ${CJK_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, S / 2, S / 2 + 10);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.8})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 2 + Math.random() * 4);
  }
  return toTex(c);
}

export function manholeTex() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.fillStyle = '#26272b';
  g.beginPath();
  g.arc(0, 0, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#4a4c52';
  g.lineWidth = 8;
  g.stroke();
  g.lineWidth = 5;
  for (let r = 30; r < 120; r += 22) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 12; a++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos((a / 12) * Math.PI * 2) * 118, Math.sin((a / 12) * Math.PI * 2) * 118);
    g.stroke();
  }
  return toTex(c);
}
