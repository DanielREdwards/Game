// Pintura do atlas de cada personagem (pele, tatuagens, roupas, calçados) e da textura da cabeça.
// As posições são calculadas com as mesmas projeções usadas para gerar os UVs da malha.
import { REGIONS, ATLAS, regionUV, headUV, TORSO_Y, HEAD_Y, EYE, LIMB } from './humanoid.js';
import { makeCanvas, toTex } from '../textures.js';
import { drawDragon, cloud, heightToNormal } from '../bodytex.js';
import { mulberry32 } from '../util.js';

const SERIF = '"LXGW WenKai TC", "Noto Serif TC", "Songti TC", serif';
const INK = 'rgba(14,17,24,0.92)';

// ---------------------------------------------------------------- utilidades

// Desenha dentro de uma região do atlas, em pixels locais da região. Regiões cilíndricas
// são desenhadas três vezes (deslocadas) para a emenda horizontal ficar contínua.
function region(g, name, draw, { wrap = true, gutter = 8 } = {}) {
  const [x, y, w, h] = REGIONS[name];
  g.save();
  g.beginPath();
  g.rect(x - gutter, y - gutter, w + gutter * 2, h + gutter * 2);
  g.clip();
  for (const ox of wrap ? [0, -w, w] : [0]) {
    g.save();
    g.translate(x + ox, y);
    draw(g, w, h);
    g.restore();
  }
  g.restore();
}

// Torso: pixel local a partir de coordenadas do corpo.
const TPX = 512 / (TORSO_Y[1] - TORSO_Y[0]);
const ty = (y) => (TORSO_Y[1] - y) * TPX;
const tu = (ang) => (0.25 + ang / (2 * Math.PI)) * 512; // ângulo 0 = frente, +π/2 = esquerda
// Membros: t ao longo do membro (m), ângulo em torno dele (0 = frente).
const armY = (t) => ((t - LIMB.arm[0]) / (LIMB.arm[1] - LIMB.arm[0])) * 512;
const legY = (t) => ((t - LIMB.leg[0]) / (LIMB.leg[1] - LIMB.leg[0])) * 512;
const limbX = (ang) => (0.5 + ang / (2 * Math.PI)) * 256;

function noiseFill(g, w, h, rng, base, amt = 0.06, n = 0.03) {
  g.fillStyle = base;
  g.fillRect(-8, -8, w + 16, h + 16);
  for (let i = 0; i < w * h * n; i++) {
    g.fillStyle = rng() < 0.5 ? `rgba(0,0,0,${amt})` : `rgba(255,255,255,${amt * 0.6})`;
    g.fillRect(rng() * w, rng() * h, 1.5, 1.5);
  }
}

function stripes(g, w, h, color, gap = 7, width = 1) {
  g.fillStyle = color;
  for (let x = 1; x < w; x += gap) g.fillRect(x, 0, width, h);
}

function ink(g, text, x, y, size, sy = 1) {
  g.save();
  g.translate(x, y);
  g.scale(1, sy);
  g.fillStyle = INK;
  g.font = `700 ${size}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...text].forEach((ch, i) => g.fillText(ch, 0, i * size * 1.02));
  g.restore();
}

function soft(g, x, y, rx, ry, color) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 1, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- partes comuns

function skinRegion(g, name, skin, seed) {
  region(g, name, (c, w, h) => {
    const rng = mulberry32(seed);
    noiseFill(c, w, h, rng, skin, 0.04, 0.02);
  });
}

function hands(g, skin, glove) {
  region(g, 'lhand', (c, w, h) => {
    const rng = mulberry32(7);
    noiseFill(c, w, h, rng, glove || skin, glove ? 0.08 : 0.04, 0.02);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 4; i++) c.fillRect(w * 0.3 + i * w * 0.1, h * 0.55, w * 0.05, h * 0.08);
  }, { wrap: false });
}

function shoes(g, kind) {
  region(g, 'lfoot', (c, w, h) => {
    const rng = mulberry32(19);
    if (kind === 'sneaker') {
      noiseFill(c, w, h, rng, '#141416', 0.05);
      c.fillStyle = '#ecebe6';
      c.fillRect(-8, h * 0.84, w + 16, h * 0.2);
      c.fillRect(w * 0.7, -8, w * 0.4, h + 16);
      c.fillRect(-8, h * 0.08, w + 16, h * 0.05);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(-8, h * 0.83, w + 16, 3);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 6; i++) c.fillRect(w * (0.42 + i * 0.045), h * 0.28, 4, h * 0.25);
    } else if (kind === 'spectator') {
      noiseFill(c, w, h, rng, '#efece4', 0.04);
      c.fillStyle = '#101012';
      c.fillRect(w * 0.68, -8, w * 0.5, h + 16);
      c.fillRect(-8, -8, w * 0.24, h + 16);
      c.fillRect(-8, h * 0.86, w + 16, h * 0.2);
    } else if (kind === 'boot') {
      noiseFill(c, w, h, rng, '#3a2618', 0.08);
      c.fillStyle = '#1a120c';
      c.fillRect(-8, h * 0.86, w + 16, h * 0.2);
    } else {
      noiseFill(c, w, h, rng, '#0e0e10', 0.04);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(w * 0.55, h * 0.35, w * 0.3, 4);
      c.fillStyle = '#060607';
      c.fillRect(-8, h * 0.86, w + 16, h * 0.2);
    }
  }, { wrap: false });
}

function rough(r, name, v) {
  region(r, name, (c, w, h) => {
    const k = Math.round(v * 255);
    c.fillStyle = `rgb(${k},${k},${k})`;
    c.fillRect(-8, -8, w + 16, h + 16);
  }, { wrap: false });
}

// ---------------------------------------------------------------- Wei Leo

function hero(g, r, hg, p) {
  const skin = p.skin;
  // tronco: pele, sombras de musculatura, tatuagens, cinto e calça cargo
  region(g, 'torso', (c, w, h) => {
    const rng = mulberry32(25);
    noiseFill(c, w, h, rng, skin, 0.04, 0.02);
    muscles(c, (x, y, rx, ry, a) => soft(c, x, y, rx, ry, `rgba(70,35,20,${a})`), (pts, wd, a) => {
      c.strokeStyle = `rgba(70,35,20,${a})`;
      c.lineWidth = wd;
      c.lineCap = 'round';
      c.filter = 'blur(3px)';
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.filter = 'none';
    });
    // mamilos discretos na parte baixa e externa do peitoral; umbigo
    for (const s of [-1, 1]) soft(c, tu(s * 0.53), ty(1.302), 3.2, 2.6, 'rgba(110,58,45,0.55)');
    soft(c, tu(0), ty(1.03), 3, 4, 'rgba(60,30,20,0.6)');
    // dragão do peito, subindo pelo ombro esquerdo
    c.save();
    c.translate(tu(0.42), ty(1.42));
    c.scale(1, 0.66);
    drawDragon(c, [[-12, 18], [30, -10], [70, -40], [110, -30], [150, 10], [190, 50]], { width: 22, seed: 3 });
    cloud(c, 120, 60, 12, rng);
    c.restore();
    ink(c, '香港', tu(0.52), ty(1.395), 26, 0.66);
    // costas: dragão em "S" e 洪門
    c.save();
    c.translate(tu(Math.PI), ty(1.5));
    c.scale(1, 0.66);
    drawDragon(c, [[-52, -10], [-30, 40], [25, 80], [42, 150], [-5, 215], [-48, 270], [-30, 330], [20, 375], [45, 420]], { width: 34, seed: 7 });
    cloud(c, 60, 230, 16, rng);
    cloud(c, -60, 360, 14, rng);
    c.restore();
    ink(c, '洪門', tu(Math.PI + 0.65), ty(1.43), 30, 0.66);
    // cinto e calça
    c.fillStyle = '#121214';
    c.fillRect(-8, ty(1.0), w + 16, ty(0.972) - ty(1.0));
    c.fillStyle = '#bfc2c7';
    c.fillRect(tu(0) - 10, ty(0.998), 20, ty(0.975) - ty(0.998));
    const top = ty(0.972);
    c.save();
    c.beginPath();
    c.rect(-8, top, w + 16, h - top + 8);
    c.clip();
    noiseFill(c, w, h, mulberry32(41), '#1c1d21', 0.06);
    c.restore();
  });
  // braços: manga de dragão só no esquerdo
  region(g, 'larm', (c, w, h) => {
    const rng = mulberry32(31);
    noiseFill(c, w, h, rng, skin, 0.04, 0.02);
    const end = armY(0.54);
    c.save();
    c.beginPath();
    c.rect(-w, 0, w * 3, end);
    c.clip();
    drawDragon(c, [[limbX(-0.6), 20], [limbX(0.8), 110], [limbX(2.4), 210], [limbX(4.2) - w, 300], [limbX(-0.2), 380], [limbX(1.4), end + 20]], { width: 40, seed: 11 });
    cloud(c, limbX(2.6), 70, 16, rng);
    cloud(c, limbX(-1.6) + w, 240, 14, rng);
    c.strokeStyle = 'rgba(14,17,24,0.55)';
    c.lineWidth = 3;
    for (const yy of [150, 330]) {
      c.beginPath();
      for (let x = -w; x <= w * 2; x += 12) c.lineTo(x, yy + Math.sin(x * 0.05) * 6);
      c.stroke();
    }
    c.restore();
  });
  skinRegion(g, 'rarm', skin, 33);
  for (const leg of ['lleg', 'rleg']) {
    region(g, leg, (c, w, h) => {
      const rng = mulberry32(41);
      noiseFill(c, w, h, rng, '#1c1d21', 0.06);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (const ang of [Math.PI / 2, -Math.PI / 2]) c.fillRect(limbX(ang) - 1, 0, 2, h);
      soft(c, limbX(0), legY(0.46), 50, 12, 'rgba(0,0,0,0.25)');
    });
  }
  hands(g, skin);
  shoes(g, 'sneaker');
  for (const n of ['torso', 'larm', 'rarm', 'lhand']) rough(r, n, 0.46);
  for (const n of ['lleg', 'rleg']) rough(r, n, 0.92);
  rough(r, 'lfoot', 0.5);
  region(r, 'torso', (c, w, h) => {
    c.fillStyle = 'rgb(235,235,235)';
    c.fillRect(-8, ty(0.972), w + 16, h);
    c.fillStyle = 'rgb(100,100,100)';
    c.fillRect(-8, ty(1.0), w + 16, ty(0.972) - ty(1.0));
  });
  // relevo muscular (mapa de altura → normais): blocos do abdome, peitorais, serrátil e costas
  region(hg, 'torso', (c) => {
    const bump = (x, y, rx, ry, a) => soft(c, x, y, rx, ry, `rgba(255,255,255,${a})`);
    c.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      bump(tu(s * 0.42), ty(1.345), 50, 20, 0.3);
      for (const [y0, y1] of [[1.205, 1.26], [1.14, 1.195], [1.075, 1.13]]) {
        const yc = ty((y0 + y1) / 2);
        bump(tu(s * 0.17), yc, 15, (ty(y0) - ty(y1)) * 0.62, 0.36);
      }
      bump(tu(s * 0.17), ty(1.04), 15, 12, 0.22);
      for (let k = 0; k < 3; k++) bump(tu(s * (1.0 + k * 0.05)), ty(1.29 - k * 0.045), 9, 6, 0.18);
      bump(tu(Math.PI + s * 0.5), ty(1.36), 30, 26, 0.2);
      bump(tu(Math.PI + s * 0.12), ty(1.12), 9, 46, 0.22);
    }
    c.globalCompositeOperation = 'source-over';
  });
}

// Sombras de definição muscular do tronco masculino (traço suave = sulco; mancha = volume).
function muscles(c, blob, line) {
  for (const s of [-1, 1]) {
    // borda inferior do peitoral: quase reta no esterno, subindo para a axila
    const pec = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * 0.95;
      pec.push([tu(s * a), ty(1.282 + 0.085 * Math.pow(a / 0.95, 2.2))]);
    }
    line(pec, 7, 0.34);
    // linha semilunar (borda externa do reto abdominal) e serrátil
    line([[tu(s * 0.36), ty(1.26)], [tu(s * 0.38), ty(1.16)], [tu(s * 0.34), ty(1.05)], [tu(s * 0.2), ty(0.98)]], 6, 0.22);
    for (let k = 0; k < 3; k++) line([[tu(s * 0.86), ty(1.27 - k * 0.045)], [tu(s * 1.05), ty(1.255 - k * 0.045)]], 4, 0.18);
    blob(tu(s * 1.2), ty(1.14), 16, 40, 0.16);
    // costas: escápulas e lombar
    blob(tu(Math.PI + s * 0.52), ty(1.27), 26, 12, 0.18);
    line([[tu(Math.PI + s * 0.25), ty(1.45)], [tu(Math.PI + s * 0.38), ty(1.3)], [tu(Math.PI + s * 0.62), ty(1.22)]], 5, 0.16);
  }
  // linha alba, intersecções tendíneas, esterno e coluna
  line([[tu(0), ty(1.27)], [tu(0), ty(1.04)]], 4, 0.3);
  for (const yy of [1.203, 1.138, 1.073]) line([[tu(-0.3), ty(yy + 0.004)], [tu(-0.1), ty(yy)], [tu(0.1), ty(yy)], [tu(0.3), ty(yy + 0.004)]], 4, 0.26);
  line([[tu(0), ty(1.42)], [tu(0), ty(1.29)]], 4, 0.22);
  line([[tu(Math.PI), ty(1.5)], [tu(Math.PI), ty(1.02)]], 5, 0.26);
}

// ---------------------------------------------------------------- ternos (família Vittore)

function suit(g, r, p) {
  const F = tu(0);
  region(g, 'torso', (c, w, h) => {
    const rng = mulberry32(p.seed);
    noiseFill(c, w, h, rng, p.base, 0.06);
    stripes(c, w, h, p.stripe);
    if (p.coat) {
      // sobretudo aberto na frente
      c.fillStyle = p.coat;
      c.fillRect(-8, -8, F - 40, h + 16);
      c.fillRect(F + 40, -8, w, h + 16);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(F - 44, ty(1.5), 5, h);
      c.fillRect(F + 40, ty(1.5), 5, h);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(F - 70, ty(1.52), 26, ty(1.18) - ty(1.52));
      c.fillRect(F + 44, ty(1.52), 26, ty(1.18) - ty(1.52));
    }
    // pescoço (pele) e colarinho
    c.fillStyle = p.skin;
    c.fillRect(-8, -8, w + 16, ty(1.565) + 8);
    if (p.neckInk) {
      c.save();
      c.translate(tu(0.85), ty(1.62));
      c.strokeStyle = INK;
      c.lineWidth = 2;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(k * 8 - 12, (k % 2) * 6, 6 + k, k, k + 4.4); c.stroke(); }
      c.restore();
    }
    c.fillStyle = p.collar;
    c.fillRect(-8, ty(1.565), w + 16, ty(1.53) - ty(1.565));
    // abertura em "V": camisa, gravata, colete e lapelas
    const vy = ty(p.coat ? 1.18 : 1.27);
    c.fillStyle = p.shirt;
    c.beginPath(); c.moveTo(F - 36, ty(1.53)); c.lineTo(F + 36, ty(1.53)); c.lineTo(F, vy); c.closePath(); c.fill();
    c.fillStyle = p.tie;
    c.beginPath(); c.moveTo(F - 6, ty(1.535)); c.lineTo(F + 6, ty(1.535)); c.lineTo(F + 4, ty(1.515)); c.lineTo(F - 4, ty(1.515)); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(F - 4, ty(1.515)); c.lineTo(F + 4, ty(1.515)); c.lineTo(F + 9, ty(1.12)); c.lineTo(F, ty(1.09)); c.lineTo(F - 9, ty(1.12)); c.closePath(); c.fill();
    if (p.tiePattern) {
      c.fillStyle = p.tiePattern;
      for (let yy = ty(1.5); yy < ty(1.13); yy += 9) { c.beginPath(); c.arc(F, yy, 2.2, 0, Math.PI * 2); c.fill(); }
    }
    if (p.vest) {
      c.fillStyle = p.vest;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(F + s * 36, ty(1.53)); c.lineTo(F + s * 16, ty(1.5)); c.lineTo(F, ty(1.3)); c.lineTo(F, ty(1.02)); c.lineTo(F + s * 40, ty(1.02)); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(0,0,0,0.5)';
      for (const yy of [1.27, 1.21, 1.15, 1.09]) { c.beginPath(); c.arc(F, ty(yy), 2.4, 0, Math.PI * 2); c.fill(); }
      if (p.watch) {
        c.strokeStyle = p.watch;
        c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(F - 22, ty(1.12)); c.quadraticCurveTo(F, ty(1.08), F + 24, ty(1.13)); c.stroke();
      }
    }
    for (const s of [-1, 1]) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.moveTo(F + s * 36, ty(1.53)); c.lineTo(F + s * 52, ty(1.5)); c.lineTo(F + s * 10, vy + 8); c.lineTo(F, vy); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.16)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(F + s * 52, ty(1.5)); c.lineTo(F + s * 10, vy + 8); c.stroke();
    }
    // frente do paletó: linha, botões, bolsos e lenço
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(F - 1, vy, 2, ty(0.775) - vy);
    for (const yy of [1.12, 1.03]) { c.beginPath(); c.arc(F + 3, ty(yy), 3, 0, Math.PI * 2); c.fill(); }
    for (const s of [-1, 1]) c.fillRect(F + s * 52 - 14, ty(0.97), 28, 2);
    c.fillRect(F + 30, ty(1.38), 22, 2);
    if (p.square) {
      c.fillStyle = p.square;
      c.beginPath(); c.moveTo(F + 31, ty(1.38)); c.lineTo(F + 36, ty(1.41)); c.lineTo(F + 41, ty(1.38)); c.lineTo(F + 46, ty(1.405)); c.lineTo(F + 51, ty(1.38)); c.closePath(); c.fill();
    }
    if (p.brooch) {
      c.fillStyle = p.brooch;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.arc(F + 34 + Math.cos(a) * 3.5, ty(1.47) + Math.sin(a) * 3.5, 2.2, 0, Math.PI * 2); c.fill(); }
    }
    // costas: costura central e fenda
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(tu(Math.PI) - 1, ty(1.5), 2, ty(0.8) - ty(1.5));
  });
  for (const arm of ['larm', 'rarm']) {
    region(g, arm, (c, w, h) => {
      const rng = mulberry32(p.seed + 1);
      if (p.coat) noiseFill(c, w, h, rng, p.coat, 0.06);
      else { noiseFill(c, w, h, rng, p.base, 0.06); stripes(c, w, h, p.stripe); }
      if (!p.coat) {
        c.fillStyle = p.cuff;
        c.fillRect(-8, armY(0.532), w + 16, armY(0.556) - armY(0.532));
      }
    });
  }
  for (const leg of ['lleg', 'rleg']) {
    region(g, leg, (c, w, h) => {
      const rng = mulberry32(p.seed + 2);
      noiseFill(c, w, h, rng, p.base, 0.06);
      stripes(c, w, h, p.stripe);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(limbX(0) - 1, 0, 2, h);
      if (p.coat) {
        c.fillStyle = p.coat;
        c.fillRect(-8, -8, w + 16, legY(0.12));
      }
    });
  }
  hands(g, p.skin, p.gloves ? '#0d0d0f' : null);
  shoes(g, p.shoes);
  for (const n of ['torso', 'larm', 'rarm', 'lleg', 'rleg']) rough(r, n, 0.8);
  rough(r, 'lhand', p.gloves ? 0.35 : 0.5);
  rough(r, 'lfoot', p.shoes === 'boot' ? 0.6 : 0.16);
  region(r, 'torso', (c, w) => {
    c.fillStyle = 'rgb(128,128,128)';
    c.fillRect(-8, -8, w + 16, ty(1.53) + 8);
  });
}

// ---------------------------------------------------------------- soldados

function goon(g, r, p) {
  const F = tu(0), B = tu(Math.PI);
  region(g, 'torso', (c, w, h) => {
    const rng = mulberry32(p.seed);
    noiseFill(c, w, h, rng, p.shirt, 0.05);
    if (p.shirtStripe) stripes(c, w, h, p.shirtStripe, 6, 2);
    c.fillStyle = p.skin;
    c.fillRect(-8, -8, w + 16, ty(1.555) + 8);
    if (p.tank) {
      // regata: cavas e decote mostram a pele
      c.fillStyle = p.skin;
      for (const s of [-1, 1]) c.fillRect(tu(s * Math.PI / 2) - 36, -8, 72, ty(1.33));
      c.beginPath(); c.ellipse(F, ty(1.56), 34, 30, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(B, ty(1.56), 30, 18, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      for (let x = 0; x < w; x += 3) { c.beginPath(); c.moveTo(x, ty(1.45)); c.lineTo(x, ty(0.99)); c.stroke(); }
    } else {
      // colarinho aberto
      c.fillStyle = p.skin;
      c.beginPath(); c.moveTo(F - 14, ty(1.56)); c.lineTo(F + 14, ty(1.56)); c.lineTo(F, ty(1.47)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (const yy of [1.44, 1.36, 1.28, 1.2, 1.12]) { c.beginPath(); c.arc(F, ty(yy), 2, 0, Math.PI * 2); c.fill(); }
    }
    if (p.vest) {
      c.fillStyle = p.vest;
      c.fillRect(-8, ty(1.5), F - 18 + 8, ty(0.99) - ty(1.5));
      c.fillRect(F + 18, ty(1.5), w - F, ty(0.99) - ty(1.5));
      c.beginPath(); c.moveTo(F - 18, ty(1.5)); c.lineTo(F, ty(1.3)); c.lineTo(F + 18, ty(1.5)); c.lineTo(F + 18, ty(0.99)); c.lineTo(F - 18, ty(0.99)); c.closePath(); c.fill();
      for (const s of [-1, 1]) c.fillRect(tu(s * Math.PI / 2) - 30, ty(1.5), 60, ty(1.36) - ty(1.5));
      c.fillStyle = 'rgba(0,0,0,0.45)';
      for (const yy of [1.25, 1.17, 1.09, 1.02]) { c.beginPath(); c.arc(F, ty(yy), 2.2, 0, Math.PI * 2); c.fill(); }
    }
    if (p.suspenders) {
      c.strokeStyle = p.suspenders;
      c.lineWidth = 8;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(F + s * 26, ty(1.0)); c.lineTo(F + s * 30, ty(1.48)); c.lineTo(tu(s * 1.2), ty(1.5)); c.stroke();
        c.beginPath(); c.moveTo(B + s * 28, ty(1.0)); c.lineTo(B, ty(1.25)); c.lineTo(B - s * 34, ty(1.47)); c.stroke();
      }
    }
    // calça
    c.fillStyle = p.pants;
    c.fillRect(-8, ty(0.99), w + 16, h);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(-8, ty(0.995), w + 16, 4);
  });
  for (const arm of ['larm', 'rarm']) {
    region(g, arm, (c, w, h) => {
      const rng = mulberry32(p.seed + 3);
      noiseFill(c, w, h, rng, p.skin, 0.04, 0.02);
      if (!p.tank) {
        c.fillStyle = p.shirt;
        c.fillRect(-8, -8, w + 16, armY(0.27) + 8);
        if (p.shirtStripe) { c.save(); c.beginPath(); c.rect(-8, -8, w + 16, armY(0.27) + 8); c.clip(); stripes(c, w, h, p.shirtStripe, 6, 2); c.restore(); }
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(-8, armY(0.24), w + 16, 3);
        c.fillRect(-8, armY(0.3), w + 16, 3);
        c.fillStyle = p.shirt;
        c.fillRect(-8, armY(0.255), w + 16, armY(0.3) - armY(0.255));
      }
    });
  }
  for (const leg of ['lleg', 'rleg']) {
    region(g, leg, (c, w, h) => {
      const rng = mulberry32(p.seed + 4);
      noiseFill(c, w, h, rng, p.pants, 0.07);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(limbX(0) - 1, 0, 2, h);
    });
  }
  hands(g, p.skin);
  shoes(g, 'boot');
  for (const n of ['torso', 'larm', 'rarm', 'lleg', 'rleg']) rough(r, n, 0.78);
  rough(r, 'lhand', 0.5);
  rough(r, 'lfoot', 0.55);
}

// ---------------------------------------------------------------- atlas do corpo

export function paintBody(p) {
  const g = makeCanvas(ATLAS, ATLAS).getContext('2d');
  const r = makeCanvas(ATLAS, ATLAS).getContext('2d');
  r.fillStyle = 'rgb(200,200,200)';
  r.fillRect(0, 0, ATLAS, ATLAS);
  let hg = null;
  if (p.kind === 'hero') {
    hg = makeCanvas(ATLAS, ATLAS).getContext('2d');
    hg.fillStyle = 'rgb(90,90,90)';
    hg.fillRect(0, 0, ATLAS, ATLAS);
    hero(g, r, hg, p);
  } else if (p.kind === 'suit') suit(g, r, p);
  else goon(g, r, p);
  return {
    map: toTex(g.canvas, { aniso: 8 }),
    roughnessMap: toTex(r.canvas, { srgb: false, aniso: 4 }),
    normalMap: hg ? heightToNormal(hg.canvas, 1.6) : null,
  };
}

// ---------------------------------------------------------------- cabeça

const HPX = 512 / (HEAD_Y[1] - HEAD_Y[0]);
const hy = (y) => (HEAD_Y[1] - y) * HPX;
const hu = (ang) => (0.5 + ang / (2 * Math.PI)) * 512;

// Pelos curtos (sobrancelha, costeleta): traços pequenos inclinados ao longo de um caminho.
function hairStrokes(g, pts, color, n, len, width, rng, alpha = 0.85) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = rng();
    const k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
    const f = t * (pts.length - 1) - k;
    const [x0, y0, w0] = pts[k], [x1, y1, w1] = pts[k + 1];
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, w = w0 + (w1 - w0) * f;
    const a = Math.atan2(y1 - y0, x1 - x0) - 0.5 + rng() * 0.25;
    const oy = (rng() - 0.5) * w;
    g.globalAlpha = alpha * (0.55 + rng() * 0.45);
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y + oy);
    g.lineTo(x + Math.cos(a) * len, y + oy + Math.sin(a) * len);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function paintHead(p) {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  const rng = mulberry32(p.seed || 3);
  noiseFill(g, 512, 512, rng, p.skin, 0.03, 0.02);
  const F = hu(0);
  const eyeA = Math.atan2(EYE.x, EYE.z + 0.012);
  // variação de tom: testa mais clara, nariz, maçãs e orelhas mais rosados
  soft(g, F, hy(0.16), 90, 34, 'rgba(255,236,200,0.10)');
  soft(g, F, hy(0.08), 16, 24, 'rgba(190,80,60,0.12)');
  for (const s of [-1, 1]) {
    soft(g, hu(s * 0.62), hy(0.082), 30, 22, 'rgba(180,72,58,0.10)');
    soft(g, hu(s * 1.72), hy(0.098), 22, 40, 'rgba(170,70,55,0.16)');
    soft(g, hu(s * 1.74), hy(0.1), 7, 16, 'rgba(60,25,20,0.35)');
    // vinco da pálpebra superior e leve sombra sob os olhos
    g.strokeStyle = 'rgba(70,35,28,0.32)';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(hu(s * (eyeA - 0.26)), hy(EYE.y + 0.012));
    g.quadraticCurveTo(hu(s * eyeA), hy(EYE.y + 0.021), hu(s * (eyeA + 0.3)), hy(EYE.y + 0.011));
    g.stroke();
    soft(g, hu(s * eyeA), hy(EYE.y - 0.016), 22, 6, 'rgba(80,40,40,0.12)');
    // narinas
    soft(g, hu(s * 0.075), hy(0.0655), 4, 2.6, 'rgba(40,15,12,0.7)');
  }
  // barba feita: sombra azulada no buço e na mandíbula
  if (!p.beard) {
    g.globalCompositeOperation = 'multiply';
    for (const [x, y, rx, ry] of [[F, hy(0.054), 36, 9], [F, hy(0.02), 60, 22]]) soft(g, x, y, rx, ry, 'rgba(150,150,170,0.5)');
    for (const s of [-1, 1]) soft(g, hu(s * 0.95), hy(0.04), 50, 26, 'rgba(160,160,175,0.45)');
    g.globalCompositeOperation = 'source-over';
  }
  // cabelo pintado: laterais e nuca (degradê) ou cabelo penteado sob o chapéu
  if (p.hair) {
    const top = p.hairTop ?? 0.16;
    for (let x = 0; x < 512; x++) {
      const ang = Math.abs((x / 512 - 0.5) * Math.PI * 2);
      if (ang < 0.8) continue;
      // linha do cabelo: têmporas, costeleta à frente da orelha, contorno atrás da orelha, nuca
      let lim;
      if (ang < 1.45) lim = 0.15 - (ang - 0.8) * 0.12;
      else if (ang < 1.6) lim = 0.072;
      else if (ang < 2.0) lim = 0.128;
      else lim = 0.128 - (ang - 2.0) * 0.06;
      const fade = p.shaved ? 0.045 : 0.012;
      for (let yy = top + 0.06; yy > lim - fade; yy -= 0.0015) {
        const a = yy > lim ? 1 : 1 - (lim - yy) / fade;
        const dens = p.shaved ? a * (0.18 + Math.min(1, (yy - lim + fade) / 0.09) * 0.4) : 0.92 * a;
        g.globalAlpha = dens * (0.75 + rng() * 0.25);
        g.fillStyle = p.hair;
        g.fillRect(x, hy(yy), 1, 2.2);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = p.hair;
    g.fillRect(0, 0, 512, hy(top + 0.03));
  }
  if (p.bald) {
    soft(g, F, hy(0.2), 200, 80, 'rgba(255,240,220,0.08)');
    g.fillStyle = 'rgba(40,30,25,0.22)';
    for (let i = 0; i < 6000; i++) {
      const x = rng() * 512, y = rng() * hy(0.13);
      g.fillRect(x, y, 1, 1);
    }
  }
  if (p.beard || p.stubble) {
    // barba cheia ou por fazer: mandíbula, queixo, buço e costeletas; a boca fica livre
    const inBeard = (ang, yy) => {
      const a = Math.abs(ang);
      if (yy > 0.034 && yy < 0.056 && a < 0.27) return yy > 0.051 && a < 0.24;
      if (yy < 0.064) return a < 1.4;
      if (yy < 0.1) return a > 0.95 && a < 1.45;
      return false;
    };
    const dense = p.beard ? 0.82 : 0.2;
    // borda superior da barba em diagonal (da costeleta ao canto da boca), sem degrau
    const edge = (ang) => { const a = Math.abs(ang); return a < 0.3 ? 0.058 : a < 0.95 ? 0.058 + (a - 0.3) * 0.05 : 0.1; };
    if (p.stubble) {
      g.globalCompositeOperation = 'multiply';
      for (const s of [-1, 1]) soft(g, hu(s * 0.7), hy(0.035), 70, 30, 'rgba(150,140,140,0.6)');
      soft(g, F, hy(0.02), 40, 22, 'rgba(150,140,140,0.6)');
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = p.beard || 'rgb(35,30,30)';
    for (let i = 0; i < (p.beard ? 36000 : 14000); i++) {
      const ang = (rng() - 0.5) * 3.0;
      const yy = -0.012 + rng() * 0.115;
      if (!inBeard(ang, yy) || yy > edge(ang)) continue;
      const soft = Math.min(1, (edge(ang) - yy) / 0.012, (yy + 0.012) / 0.012);
      g.globalAlpha = dense * (0.4 + rng() * 0.6) * soft;
      g.fillRect(hu(ang), hy(yy), p.beard ? 1.6 : 1.1, p.beard ? 2.2 : 1.1);
    }
    g.globalAlpha = 1;
  }
  // sobrancelhas: pelos curtos, mais espessas no início
  const brow = p.brow || '#1a1210';
  for (const s of [-1, 1]) {
    const pts = [[hu(s * 0.14), hy(0.1215), 9], [hu(s * 0.3), hy(0.1265), 8], [hu(s * 0.46), hy(0.1285 + (p.browArch || 0)), 6], [hu(s * 0.62), hy(0.1235), 3]];
    hairStrokes(g, pts, brow, 260 * (p.browW || 6) / 6, 4.5, 1.5, rng);
  }
  // boca: lábio superior mais escuro, inferior com leve brilho, linha da boca e sombra do queixo
  g.fillStyle = p.lips || 'rgba(120,58,50,0.42)';
  g.beginPath(); g.ellipse(F, hy(0.0495), 21, 4.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,75,65,0.28)';
  g.beginPath(); g.ellipse(F, hy(0.04), 18, 6, 0, 0, Math.PI * 2); g.fill();
  soft(g, F, hy(0.041), 10, 3, 'rgba(255,220,200,0.18)');
  g.strokeStyle = 'rgba(45,20,18,0.75)';
  g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(F - 21, hy(0.0438)); g.quadraticCurveTo(F, hy(0.0462), F + 21, hy(0.0438)); g.stroke();
  soft(g, F, hy(0.03), 16, 5, 'rgba(60,30,25,0.2)');
  if (p.scar) {
    g.strokeStyle = 'rgba(235,200,180,0.85)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(hu(0.44), hy(0.142)); g.lineTo(hu(0.5), hy(0.114)); g.stroke();
  }
  if (p.neckInk) {
    g.strokeStyle = INK;
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(hu(0.9 + k * 0.08), hy(-0.04 - (k % 2) * 0.02), 8 + k, k, k + 4.4); g.stroke(); }
  }
  return toTex(c, { aniso: 8 });
}

// Olho em decalque (esfera equirretangular, frente em x = 1/4): amêndoa com esclera, íris e cílios;
// fora da amêndoa é transparente e aparecem as pálpebras esculpidas na cabeça.
export function eyeTex(iris = '#3a2416') {
  const W = 512, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const cx = W * 0.25, cy = H * 0.5;
  const hw = W * (60 / 360), hh = H * (19 / 180);
  // contorno: canto interno (esquerda da textura) um pouco mais baixo que o externo
  const almond = () => {
    g.beginPath();
    g.moveTo(cx - hw, cy + 3);
    g.bezierCurveTo(cx - hw * 0.55, cy - hh * 1.25, cx + hw * 0.35, cy - hh * 1.35, cx + hw, cy - 5);
    g.bezierCurveTo(cx + hw * 0.5, cy + hh * 0.95, cx - hw * 0.45, cy + hh * 1.05, cx - hw, cy + 3);
    g.closePath();
  };
  g.save();
  almond();
  g.clip();
  const sc = g.createRadialGradient(cx, cy, 10, cx, cy, hw);
  sc.addColorStop(0, '#e2dbd0');
  sc.addColorStop(1, '#a89a8c');
  g.fillStyle = sc;
  g.fillRect(0, 0, W, H);
  soft(g, cx - hw * 0.9, cy + 2, 16, 10, 'rgba(200,110,100,0.7)');
  // íris e pupila
  const ir = W * (27 / 360);
  const ig = g.createRadialGradient(cx, cy - 2, ir * 0.3, cx, cy - 2, ir);
  ig.addColorStop(0, iris);
  ig.addColorStop(0.75, iris);
  ig.addColorStop(1, '#0b0705');
  g.fillStyle = ig;
  g.beginPath(); g.arc(cx, cy - 2, ir, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,230,190,0.12)';
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * ir * 0.4, cy - 2 + Math.sin(a) * ir * 0.4); g.lineTo(cx + Math.cos(a) * ir * 0.85, cy - 2 + Math.sin(a) * ir * 0.85); g.stroke();
  }
  g.fillStyle = '#040303';
  g.beginPath(); g.arc(cx, cy - 2, ir * 0.36, 0, Math.PI * 2); g.fill();
  // sombra da pálpebra superior sobre o olho
  const sh = g.createLinearGradient(0, cy - hh * 1.3, 0, cy - hh * 0.2);
  sh.addColorStop(0, 'rgba(30,15,10,0.7)');
  sh.addColorStop(1, 'rgba(30,15,10,0)');
  g.fillStyle = sh;
  g.fillRect(0, 0, W, cy + 2);
  g.restore();
  // linha dos cílios (superior forte, inferior suave)
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(16,10,8,1)';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx - hw, cy + 3);
  g.bezierCurveTo(cx - hw * 0.55, cy - hh * 1.25, cx + hw * 0.35, cy - hh * 1.35, cx + hw, cy - 5);
  g.stroke();
  g.strokeStyle = 'rgba(40,24,20,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx + hw, cy - 5);
  g.bezierCurveTo(cx + hw * 0.5, cy + hh * 0.95, cx - hw * 0.45, cy + hh * 1.05, cx - hw, cy + 3);
  g.stroke();
  return toTex(c, { aniso: 4 });
}

// Cabelo: fios finos de trás para a frente (cor + relevo para o mapa de normais).
export function hairTex(color = '#0d0b0a', seed = 9) {
  const N = 256;
  const c = makeCanvas(N, N), g = c.getContext('2d');
  const hc = makeCanvas(N, N), hg = hc.getContext('2d');
  const rng = mulberry32(seed);
  g.fillStyle = color;
  g.fillRect(0, 0, N, N);
  hg.fillStyle = 'rgb(110,110,110)';
  hg.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) {
    const x = rng() * N, y = rng() * N, len = 20 + rng() * 60, sway = (rng() - 0.5) * 10;
    const light = rng() < 0.5;
    g.strokeStyle = light ? `rgba(120,110,100,${0.1 + rng() * 0.18})` : `rgba(0,0,0,${0.2 + rng() * 0.3})`;
    hg.strokeStyle = light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
    for (const [G, w] of [[g, 1], [hg, 1.6]]) {
      G.lineWidth = w;
      G.beginPath();
      G.moveTo(x, y);
      G.quadraticCurveTo(x + sway, y + len / 2, x + sway * 0.4, y + len);
      G.stroke();
    }
  }
  return { map: toTex(c, { aniso: 4 }), normalMap: heightToNormal(hc, 1.2) };
}

// Referência de UV para testes e para quem for pintar novas roupas.
export const UVMAP = { regionUV, headUV };
