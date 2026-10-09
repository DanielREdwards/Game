// Gerador de humanoides: esqueleto em pose "A", sólidos anatômicos por arquétipo, malha contínua
// com pesos de esqueleto (skinning) e mapeamento para o atlas de textura por regiões.
// Sem dependências: roda em Web Workers e devolve vetores tipados.
import { ell, cone, box, loft, tube, compile, field, primDist } from './sdf.js';
import { surfaceNets } from './mesher.js';

export const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKn', 'lAnk', 'rHip', 'rKn', 'rAnk'];
export const ARM_A = 0.6;
export const LEG_A = 0.1;
export const SEG = { UPPER: 0.43, LOWER: 0.41, HIP_DROP: 0.03, SOLE: 0.084 };
// Alturas das juntas (m) e larguras de referência; o esqueleto de factory.js usa os mesmos números.
export const SKEL = { HIPS: 0.95, SPINE: 1.01, CHEST: 1.21, NECK: 1.5, HEAD: 1.6, SH_Y: 1.46, SW: 0.19, HW: 0.1, UPPER_ARM: 0.29, FOREARM: 0.3 };

// ---------------------------------------------------------------- esqueleto

// Posições das juntas na pose de ligação.
export function jointsOf(wide = 1) {
  const sw = SKEL.SW * wide, hw = SKEL.HW * wide;
  const J = { hips: [0, SKEL.HIPS, 0], spine: [0, SKEL.SPINE, 0], chest: [0, SKEL.CHEST, 0], neck: [0, SKEL.NECK, 0], head: [0, SKEL.HEAD, 0] };
  for (const s of [1, -1]) {
    const p = s > 0 ? 'l' : 'r';
    const da = [s * Math.sin(ARM_A), -Math.cos(ARM_A), 0];
    const dl = [s * Math.sin(LEG_A), -Math.cos(LEG_A), 0];
    J[p + 'Sh'] = [s * sw, SKEL.SH_Y, 0];
    J[p + 'El'] = [s * sw + da[0] * SKEL.UPPER_ARM, SKEL.SH_Y + da[1] * SKEL.UPPER_ARM, 0];
    const fa = SKEL.UPPER_ARM + SKEL.FOREARM;
    J[p + 'Fist'] = [s * sw + da[0] * fa, SKEL.SH_Y + da[1] * fa, 0];
    J[p + 'Hip'] = [s * hw, SKEL.HIPS - SEG.HIP_DROP, 0];
    J[p + 'Kn'] = [s * hw + dl[0] * SEG.UPPER, J[p + 'Hip'][1] + dl[1] * SEG.UPPER, 0];
    J[p + 'Ank'] = [J[p + 'Kn'][0] + dl[0] * SEG.LOWER, J[p + 'Kn'][1] + dl[1] * SEG.LOWER, 0];
    J[p + 'Foot'] = [J[p + 'Ank'][0], J[p + 'Ank'][1] - 0.03, 0.1];
  }
  return J;
}

// ---------------------------------------------------------------- vetores

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (o, ...terms) => terms.reduce((p, [v, s]) => add(p, mul(v, s)), o);
const UP = [0, 1, 0], FW = [0, 0, 1];
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function limbs(J) {
  const L = {};
  for (const s of [1, -1]) {
    const p = s > 0 ? 'l' : 'r';
    const d = norm(sub(J[p + 'Fist'], J[p + 'Sh']));
    const dl = norm(sub(J[p + 'Ank'], J[p + 'Hip']));
    L[p] = {
      s, p, S: J[p + 'Sh'], E: J[p + 'El'], H: J[p + 'Hip'], K: J[p + 'Kn'], A: J[p + 'Ank'],
      d, dl, out: [s * Math.abs(d[1]), Math.abs(d[0]), 0], lout: [s * Math.abs(dl[1]), Math.abs(dl[0]), 0],
      rz: s * ARM_A, lz: s * LEG_A, arm: s > 0 ? 'larm' : 'rarm', leg: s > 0 ? 'lleg' : 'rleg',
      hand: s > 0 ? 'lhand' : 'rhand', foot: s > 0 ? 'lfoot' : 'rfoot',
    };
  }
  return L;
}

// ---------------------------------------------------------------- pesos do esqueleto

// Tronco por altura: quadril → coluna → peito → pescoço. Com "skirt", a barra do paletó ou do
// sobretudo abaixo da cintura acompanha as coxas em parte (cada lado com a sua).
function torsoWeights(skirt) {
  return (x, y) => {
    const a = ss(0.97, 1.06, y), b = ss(1.12, 1.24, y), c = ss(1.49, 1.56, y);
    const w = { hips: 1 - a, spine: a * (1 - b), chest: b * (1 - c), neck: c };
    if (skirt && y < skirt.top) {
      const t = Math.min(skirt.max, (skirt.top - y) / skirt.span) * w.hips;
      const side = ss(-0.03, 0.03, x);
      w.hips -= t;
      w.lHip = t * side;
      w.rHip = t * (1 - side);
    }
    return w;
  };
}
// Pescoço: base no peito, topo acompanhando a cabeça (a emenda com a cabeça rígida fica estável).
const neckWeights = (x, y) => {
  const a = ss(1.46, 1.53, y), h = ss(1.56, 1.63, y) * 0.8;
  return { chest: 1 - a, neck: a * (1 - h), head: a * h };
};
// Braço: o ombro passa do peito para o braço ao longo do eixo do úmero.
function armWeights(l) {
  return (x, y, z) => {
    const t = (x - l.S[0]) * l.d[0] + (y - l.S[1]) * l.d[1] + (z - l.S[2]) * l.d[2];
    const w = ss(-0.035, 0.07, t);
    return { chest: 1 - w, [l.p + 'Sh']: w };
  };
}
// Coxa: a raiz da coxa passa do quadril para a perna.
function thighWeights(l) {
  return (x, y, z) => {
    const t = (x - l.H[0]) * l.dl[0] + (y - l.H[1]) * l.dl[1] + (z - l.H[2]) * l.dl[2];
    const w = ss(-0.05, 0.08, t);
    return { hips: 1 - w, [l.p + 'Hip']: w };
  };
}

// ---------------------------------------------------------------- medidas

// Seções do tronco [y, meia-largura, frente, costas] medidas no "wide" de referência de cada tipo.
const scaleSecs = (S, sx, sf = 1, sb = sf) => S.map(([y, w, f, b, cz]) => [y, w * sx, f * sf, b * sb, cz || 0]);

// Atlético, sem camisa (medidas de um homem atlético de 1,80 m; "wide" 1,1).
const ATHLETE_T = [
  [0.84, 0.122, 0.052, 0.072],
  [0.88, 0.155, 0.078, 0.104],
  [0.92, 0.168, 0.09, 0.122],
  [0.97, 0.166, 0.096, 0.114],
  [1.02, 0.155, 0.099, 0.097],
  [1.07, 0.146, 0.1, 0.087],
  [1.12, 0.148, 0.102, 0.089],
  [1.17, 0.155, 0.105, 0.095],
  [1.22, 0.165, 0.11, 0.101],
  [1.27, 0.174, 0.116, 0.106],
  [1.32, 0.179, 0.12, 0.109],
  [1.37, 0.178, 0.119, 0.111],
  [1.42, 0.168, 0.111, 0.107],
  [1.47, 0.136, 0.088, 0.095],
  [1.51, 0.09, 0.066, 0.079],
  [1.545, 0.066, 0.058, 0.066],
];
// Paletó dos anos 1930: ombros largos, cintura levemente marcada, barra cobrindo o assento ("wide" 1,05).
const JACKET_T = [
  [0.772, 0.176, 0.12, 0.134],
  [0.83, 0.174, 0.118, 0.132],
  [0.9, 0.172, 0.116, 0.13],
  [0.97, 0.166, 0.117, 0.121],
  [1.04, 0.16, 0.119, 0.112],
  [1.12, 0.165, 0.124, 0.11],
  [1.2, 0.173, 0.13, 0.112],
  [1.28, 0.181, 0.134, 0.115],
  [1.36, 0.186, 0.132, 0.117],
  [1.42, 0.196, 0.124, 0.113],
  [1.455, 0.2, 0.108, 0.104],
  [1.48, 0.184, 0.094, 0.095],
  [1.5, 0.13, 0.08, 0.085],
  [1.52, 0.088, 0.07, 0.075],
  [1.548, 0.07, 0.064, 0.066],
];
// Sobretudo longo, aberto da cintura para baixo ("wide" 1,06).
const COAT_T = [
  [0.44, 0.232, 0.168, 0.172],
  [0.55, 0.222, 0.16, 0.163],
  [0.7, 0.208, 0.151, 0.154],
  [0.85, 0.196, 0.145, 0.147],
  [0.97, 0.185, 0.141, 0.137],
  [1.06, 0.179, 0.141, 0.128],
  [1.15, 0.183, 0.144, 0.126],
  [1.25, 0.19, 0.147, 0.128],
  [1.35, 0.198, 0.145, 0.13],
  [1.42, 0.207, 0.136, 0.126],
  [1.455, 0.21, 0.118, 0.114],
  [1.48, 0.194, 0.102, 0.102],
  [1.5, 0.14, 0.088, 0.092],
  [1.525, 0.098, 0.08, 0.082],
  [1.565, 0.08, 0.076, 0.076],
];
// Camisa por dentro da calça, porte comum ("wide" 1,0).
const SHIRT_T = [
  [0.84, 0.126, 0.064, 0.076],
  [0.9, 0.16, 0.092, 0.11],
  [0.96, 0.164, 0.102, 0.106],
  [1.02, 0.158, 0.108, 0.099],
  [1.1, 0.156, 0.112, 0.095],
  [1.18, 0.161, 0.115, 0.099],
  [1.26, 0.168, 0.118, 0.105],
  [1.34, 0.172, 0.119, 0.109],
  [1.41, 0.166, 0.109, 0.105],
  [1.47, 0.134, 0.085, 0.093],
  [1.51, 0.09, 0.064, 0.078],
  [1.545, 0.066, 0.057, 0.064],
];

// Perfis dos membros [t, raio lateral, raio frontal, desloc. lateral, desloc. frontal].
const ARM_UP = [[0, 0.062, 0.058, 0.004], [0.2, 0.06, 0.056, 0.006], [0.42, 0.05, 0.053, 0.002, 0.002], [0.62, 0.047, 0.055, 0, 0.007], [0.85, 0.041, 0.046, 0, 0.003], [1, 0.038, 0.039]];
const ARM_LO = [[0, 0.041, 0.039], [0.18, 0.047, 0.041, 0.003], [0.5, 0.037, 0.034], [0.85, 0.027, 0.031], [1, 0.025, 0.03]];
const SLEEVE_UP = [[0, 0.058, 0.058], [0.3, 0.058, 0.057], [1, 0.051, 0.05]];
const SLEEVE_LO = [[0, 0.051, 0.05], [1, 0.045, 0.045]];
const CARGO_TH = [[0, 0.09, 0.095], [0.25, 0.092, 0.096], [0.6, 0.084, 0.086], [0.9, 0.076, 0.078], [1, 0.073, 0.075]];
const CARGO_SH = [[0, 0.073, 0.075], [0.3, 0.07, 0.072], [0.7, 0.066, 0.068], [0.9, 0.069, 0.071], [1, 0.067, 0.07]];
const TROUSER_TH = [[0, 0.09, 0.094], [0.5, 0.083, 0.086], [1, 0.073, 0.075]];
const TROUSER_SH = [[0, 0.073, 0.075], [0.6, 0.069, 0.071], [1, 0.068, 0.07]];

const scaleProf = (P, k) => P.map(([t, a, b, c = 0, d = 0]) => [t, a * k, b * k, c * k, d * k]);

// ---------------------------------------------------------------- partes reutilizáveis

function fists(L, P, glove = false) {
  for (const p of ['l', 'r']) {
    const l = L[p], o = { bone: p + 'El', region: l.hand, k: 0.01 };
    const c = at(l.E, [l.d, 0.305]);
    P.push(box(c, [0.025, 0.047, 0.043], 0.02, { ...o, rot: [0, 0, l.rz] }));
    // nós dos dedos e polegar dobrado sobre os dedos
    P.push(cone(at(c, [l.d, 0.03], [FW, 0.03], [l.out, -0.004]), at(c, [l.d, 0.03], [FW, -0.03], [l.out, -0.004]), 0.019, 0.017, { ...o, k: 0.012 }));
    P.push(cone(at(c, [l.d, -0.03], [FW, 0.036], [l.out, -0.008]), at(c, [l.d, 0.016], [FW, 0.048], [l.out, -0.018]), 0.013, 0.011, o));
    if (glove) P.push(tube(at(l.E, [l.d, 0.215]), at(l.E, [l.d, 0.262]), [[0, 0.03, 0.034], [1, 0.031, 0.035]], { ...o, side: l.out, k: 0.006 }));
  }
}

function shoes(L, P, kind) {
  for (const p of ['l', 'r']) {
    const l = L[p], o = { bone: p + 'Ank', region: l.foot, k: 0.014 };
    if (kind === 'sneaker') {
      P.push(box(add(l.A, [0, -0.044, 0.042]), [0.05, 0.036, 0.122], 0.03, o));
      P.push(ell(add(l.A, [0, -0.05, 0.13]), [0.049, 0.033, 0.046], o));
      P.push(cone(add(l.A, [0, -0.03, -0.02]), add(l.A, [0, 0.07, -0.012]), 0.058, 0.053, o));
      P.push(box(add(l.A, [0, -0.072, 0.042]), [0.056, 0.012, 0.131], 0.01, { ...o, k: 0.008 }));
    } else if (kind === 'boot') {
      P.push(box(add(l.A, [0, -0.045, 0.04]), [0.05, 0.036, 0.12], 0.028, o));
      P.push(cone(add(l.A, [0, -0.03, -0.01]), add(l.A, [0, 0.09, -0.005]), 0.056, 0.052, o));
      P.push(box(add(l.A, [0, -0.073, 0.04]), [0.054, 0.011, 0.126], 0.008, { ...o, k: 0.006 }));
    } else {
      P.push(box(add(l.A, [0, -0.05, 0.045]), [0.045, 0.03, 0.125], 0.024, o));
      P.push(ell(add(l.A, [0, -0.056, 0.135]), [0.044, 0.026, 0.046], o));
      P.push(box(add(l.A, [0, -0.071, -0.04]), [0.042, 0.013, 0.04], 0.006, { ...o, k: 0.006 }));
    }
  }
}

function neck(P, r0, r1) {
  P.push(cone([0, 1.47, -0.012], [0, 1.61, -0.004], r0, r1, { bone: 'neck', region: 'torso', k: 0.03, weight: neckWeights }));
}

// Braço inteiro: braço (úmero) e antebraço como tubos com perfil, mão fechada.
function arms(L, P, up, lo, k = 0.03) {
  for (const p of ['l', 'r']) {
    const l = L[p];
    P.push(tube(at(l.S, [l.d, -0.005]), at(l.E, [l.d, 0.02]), up, { bone: p + 'Sh', region: l.arm, k, side: l.out, weight: armWeights(l) }));
    P.push(tube(at(l.E, [l.d, -0.012]), at(l.E, [l.d, 0.245]), lo, { bone: p + 'El', region: l.arm, k: k * 0.8, side: l.out }));
  }
}

function legs(L, P, th, sh, k = 0.03) {
  for (const p of ['l', 'r']) {
    const l = L[p];
    P.push(tube(at(l.H, [UP, 0.045]), at(l.K, [l.dl, 0.0]), th, { bone: p + 'Hip', region: l.leg, k, side: l.lout, weight: thighWeights(l) }));
    P.push(tube(at(l.K, [l.dl, -0.02]), at(l.A, [l.dl, 0.0]), sh, { bone: p + 'Kn', region: l.leg, k, side: l.lout }));
  }
}

// ---------------------------------------------------------------- arquétipos

function athlete(L, o) {
  const P = [];
  const T = { region: 'torso' };
  const sx = (o.wide || 1.1) / 1.1;
  P.push(loft(scaleSecs(ATHLETE_T, sx), { ...T, bone: 'chest', n: 2.3, round: 0.03, k: 0.03, weight: torsoWeights() }));
  for (const s of [1, -1]) {
    // peitorais (placas largas e baixas), escápulas, trapézio, clavículas e esternocleidomastoide
    P.push(ell([s * 0.07 * sx, 1.338, 0.102], [0.074 * sx, 0.056, 0.03], { ...T, bone: 'chest', rot: [-0.2, s * 0.32, s * 0.14], k: 0.026 }));
    P.push(ell([s * 0.074 * sx, 1.36, -0.098], [0.055, 0.066, 0.02], { ...T, bone: 'chest', rot: [0.15, -s * 0.2, 0], k: 0.025 }));
    P.push(cone([0, 1.574, -0.04], [s * 0.18 * sx, 1.488, -0.02], 0.05, 0.03, { ...T, bone: 'chest', k: 0.035 }));
    P.push(cone([s * 0.02, 1.474, 0.064], [s * 0.165 * sx, 1.48, 0.022], 0.0115, 0.011, { ...T, bone: 'chest', k: 0.012 }));
    P.push(cone([s * 0.046, 1.6, -0.01], [s * 0.014, 1.478, 0.05], 0.0135, 0.012, { ...T, bone: 'neck', k: 0.018, weight: neckWeights }));
  }
  // abdome (reto abdominal levemente saliente) e sulco do esterno
  P.push(ell([0, 1.12, 0.086], [0.066 * sx, 0.13, 0.026], { ...T, bone: 'spine', k: 0.03, weight: torsoWeights() }));
  P.push(cone([0, 1.29, 0.152], [0, 1.41, 0.142], 0.011, 0.01, { ...T, sub: true, k: 0.014 }));
  neck(P, 0.063, 0.056);
  arms(L, P, ARM_UP, ARM_LO);
  legs(L, P, CARGO_TH, CARGO_SH);
  for (const p of ['l', 'r']) {
    const l = L[p], G = { bone: p + 'Hip', region: l.leg };
    // bolsos laterais da calça cargo
    P.push(box(at(l.H, [l.dl, 0.27], [l.lout, 0.088], [FW, 0.005]), [0.022, 0.075, 0.065], 0.014, { ...G, rot: [0, 0, l.lz], k: 0.012 }));
    P.push(box(at(l.H, [l.dl, 0.19], [l.lout, 0.095]), [0.022, 0.016, 0.068], 0.008, { ...G, rot: [0, 0, l.lz], k: 0.008 }));
  }
  fists(L, P);
  shoes(L, P, 'sneaker');
  return P;
}

function suit(L, o) {
  const P = [];
  const T = { region: 'torso' };
  const sx = (o.wide || 1.05) / 1.05;
  if (o.coat) {
    P.push(loft(scaleSecs(COAT_T, sx), { ...T, bone: 'chest', n: 2.5, round: 0.014, k: 0.02, weight: torsoWeights({ top: 0.95, span: 0.5, max: 0.75 }) }));
    // abertura da frente (da cintura para baixo) e fenda das costas
    P.push(box([0, 0.66, 0.17], [0.012, 0.25, 0.07], 0.004, { ...T, sub: true, k: 0.01 }));
    P.push(box([0, 0.57, -0.17], [0.007, 0.14, 0.07], 0.003, { ...T, sub: true, k: 0.008 }));
  } else {
    P.push(loft(scaleSecs(JACKET_T, sx), { ...T, bone: 'chest', n: 2.6, round: 0.012, k: 0.02, weight: torsoWeights({ top: 0.95, span: 0.2, max: 0.5 }) }));
  }
  const bulk = o.coat ? 0.012 : 0;
  // colarinho da camisa (e gola alta do sobretudo)
  P.push(cone([0, 1.515, -0.012], [0, 1.585 + bulk, -0.004], 0.066 + bulk, 0.064 + bulk, { ...T, bone: 'neck', k: 0.012, weight: neckWeights }));
  neck(P, 0.058, 0.054);
  arms(L, P, o.coat ? scaleProf(SLEEVE_UP, 1.1) : SLEEVE_UP, o.coat ? scaleProf(SLEEVE_LO, 1.1) : SLEEVE_LO, 0.025);
  if (!o.gloves) {
    // punho da camisa aparecendo na manga
    for (const p of ['l', 'r']) {
      const l = L[p];
      P.push(tube(at(l.E, [l.d, 0.235]), at(l.E, [l.d, 0.258]), [[0, 0.037, 0.038], [1, 0.036, 0.037]], { bone: p + 'El', region: l.arm, k: 0.004, side: l.out }));
    }
  }
  legs(L, P, TROUSER_TH, TROUSER_SH, 0.02);
  fists(L, P, o.gloves);
  shoes(L, P, 'dress');
  return P;
}

function goon(L, o) {
  const P = [];
  const T = { region: 'torso' };
  const big = o.big ? 1 : 0;
  const sx = (o.wide || 1) * (big ? 0.97 : 1);
  P.push(loft(scaleSecs(SHIRT_T, sx, 1 + big * 0.18, 1 + big * 0.12), { ...T, bone: 'chest', n: 2.3, round: 0.03, k: 0.03, weight: torsoWeights() }));
  if (big) P.push(ell([0, 1.1, 0.06], [0.15, 0.15, 0.1], { ...T, bone: 'spine', k: 0.05, weight: torsoWeights() }));
  for (const s of [1, -1]) {
    P.push(cone([0, 1.556, -0.034], [s * 0.18 * sx, 1.476, -0.02], 0.046 + big * 0.014, 0.03 + big * 0.006, { ...T, bone: 'chest', k: 0.035 }));
    P.push(box([s * 0.07 * sx, 1.335, 0.098 + big * 0.015], [0.068 * sx, 0.05, 0.02], 0.018, { ...T, bone: 'chest', rot: [-0.15, s * 0.3, s * 0.1], k: 0.025 }));
  }
  neck(P, 0.062 + big * 0.012, 0.056 + big * 0.01);
  const r = 1 + big * 0.24;
  if (o.bare) {
    arms(L, P, scaleProf(ARM_UP, r), scaleProf(ARM_LO, r * 1.04));
  } else {
    // manga da camisa dobrada até o cotovelo, antebraço à mostra
    arms(L, P, scaleProf(SLEEVE_UP, 0.94 * r), scaleProf(ARM_LO, r * 1.02));
    for (const p of ['l', 'r']) {
      const l = L[p];
      P.push(tube(at(l.E, [l.d, -0.045]), at(l.E, [l.d, 0.005]), [[0, 0.05, 0.05], [0.5, 0.053, 0.053], [1, 0.049, 0.049]], { bone: p + 'Sh', region: l.arm, k: 0.01, side: l.out }));
    }
  }
  legs(L, P, scaleProf(TROUSER_TH, 1 + big * 0.06), TROUSER_SH, 0.025);
  fists(L, P);
  shoes(L, P, 'boot');
  return P;
}

const ARCH = { athlete, suit, goon };

// ---------------------------------------------------------------- mapeamento do atlas

// Atlas de 1024 px: retângulos [x, y, largura, altura] em pixels.
export const ATLAS = 1024;
export const REGIONS = {
  torso: [0, 0, 512, 512], larm: [512, 0, 256, 512], rarm: [768, 0, 256, 512],
  lleg: [0, 512, 256, 512], rleg: [256, 512, 256, 512], lfoot: [512, 512, 256, 256], rfoot: [512, 512, 256, 256],
  lhand: [768, 512, 256, 256], rhand: [768, 512, 256, 256],
};
export const TORSO_Y = [0.4, 1.68];
// Faixa (m ao longo do membro, a partir do ombro/quadril) coberta pelas regiões dos braços e pernas.
export const LIMB = { arm: [-0.1, 0.66], leg: [-0.14, 0.86] };
const CYL = new Set(['torso', 'larm', 'rarm', 'lleg', 'rleg', 'lhand', 'rhand']);

// Coordenadas (u, v) locais da região, em 0..1. v = 1 no topo da região.
export function regionUV(region, x, y, z, J) {
  if (region === 'torso') {
    let u = 0.25 + Math.atan2(x, z) / (2 * Math.PI);
    if (u < 0) u += 1;
    return [u, (y - TORSO_Y[0]) / (TORSO_Y[1] - TORSO_Y[0])];
  }
  if (region === 'lfoot' || region === 'rfoot') {
    const A = J[region === 'lfoot' ? 'lAnk' : 'rAnk'];
    return [(z - (A[2] - 0.1)) / 0.3, y / 0.17];
  }
  const p = region[0];
  const limb = region.endsWith('arm') || region.endsWith('hand');
  const o = J[p + (limb ? 'Sh' : 'Hip')];
  const e = J[p + (limb ? 'Fist' : 'Ank')];
  const d = norm(sub(e, o));
  const [t0, t1] = limb ? LIMB.arm : LIMB.leg;
  const q = [x - o[0], y - o[1], z - o[2]];
  const t = q[0] * d[0] + q[1] * d[1] + q[2] * d[2];
  const r = [q[0] - d[0] * t, q[1] - d[1] * t, q[2] - d[2] * t];
  const s = norm([d[1] * FW[2] - d[2] * FW[1], d[2] * FW[0] - d[0] * FW[2], d[0] * FW[1] - d[1] * FW[0]]);
  const ang = Math.atan2(r[0] * s[0] + r[1] * s[1] + r[2] * s[2], r[2]);
  const u = 0.5 + ang / (2 * Math.PI);
  if (region.endsWith('hand')) return [u, 1 - (t - 0.5) / 0.2];
  return [u, 1 - (t - t0) / (t1 - t0)];
}

export function atlasUV(region, u, v) {
  const [rx, ry, rw, rh] = REGIONS[region];
  u = Math.min(1, Math.max(0, u));
  v = Math.min(1, Math.max(0, v));
  return [(rx + u * rw) / ATLAS, 1 - (ry + (1 - v) * rh) / ATLAS];
}

// ---------------------------------------------------------------- construção da malha

function bounds(set, pad) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of set.add) for (let i = 0; i < 3; i++) {
    mn[i] = Math.min(mn[i], p.bc[i] - p.br);
    mx[i] = Math.max(mx[i], p.bc[i] + p.br);
  }
  return [mn.map((v) => v - pad), mx.map((v) => v + pad)];
}

// Converte índices em triângulos independentes, cada um numa só região, com UV do atlas.
function toGeometry(m, regionOf, uvOf, skin, mode = 'atlas') {
  const I = m.indices, P = m.positions, N = m.normals;
  const nt = I.length / 3;
  const pos = new Float32Array(nt * 9), nor = new Float32Array(nt * 9), uv = new Float32Array(nt * 6);
  const si = skin ? new Uint16Array(nt * 12) : null, sw = skin ? new Float32Array(nt * 12) : null;
  const uvs = [[0, 0], [0, 0], [0, 0]];
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const ra = regionOf[a], rb = regionOf[b], rc = regionOf[c];
    const reg = ra === rb || ra === rc ? ra : rb === rc ? rb : ra;
    const name = mode === 'head' ? 'head' : REGION_NAMES[reg];
    const vs = [a, b, c];
    for (let k = 0; k < 3; k++) {
      const vi = vs[k];
      const r = uvOf(reg, P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]);
      uvs[k][0] = r[0]; uvs[k][1] = r[1];
    }
    if (CYL.has(name) || name === 'head') {
      const mx = Math.max(uvs[0][0], uvs[1][0], uvs[2][0]), mn = Math.min(uvs[0][0], uvs[1][0], uvs[2][0]);
      if (mx - mn > 0.5) for (const q of uvs) if (q[0] < 0.5) q[0] = Math.min(1, q[0] + 1);
    }
    for (let k = 0; k < 3; k++) {
      const vi = vs[k], o = t * 9 + k * 3;
      pos[o] = P[vi * 3]; pos[o + 1] = P[vi * 3 + 1]; pos[o + 2] = P[vi * 3 + 2];
      nor[o] = N[vi * 3]; nor[o + 1] = N[vi * 3 + 1]; nor[o + 2] = N[vi * 3 + 2];
      const [U, V] = name === 'head' ? uvs[k] : atlasUV(name, uvs[k][0], uvs[k][1]);
      uv[t * 6 + k * 2] = U; uv[t * 6 + k * 2 + 1] = V;
      if (skin) for (let w = 0; w < 4; w++) { si[t * 12 + k * 4 + w] = skin.idx[vi * 4 + w]; sw[t * 12 + k * 4 + w] = skin.wt[vi * 4 + w]; }
    }
  }
  const out = { position: pos, normal: nor, uv };
  if (skin) { out.skinIndex = si; out.skinWeight = sw; }
  return out;
}

const REGION_NAMES = Object.keys(REGIONS);
const REGION_ID = Object.fromEntries(REGION_NAMES.map((n, i) => [n, i]));
const BONE_ID = Object.fromEntries(BONES.map((n, i) => [n, i]));

// Corpo com esqueleto. Retorna geometria, posições das juntas na pose de ligação e o arquétipo.
export function buildBody(arch, opts = {}) {
  const wide = opts.wide || 1;
  const J = jointsOf(wide);
  const L = limbs(J);
  const prims = ARCH[arch](L, opts);
  const set = compile(prims);
  const f = field(set);
  const [bmin, bmax] = bounds(set, 0.03);
  const m = surfaceNets(f, bmin, bmax, opts.h || 0.0182);
  const nv = m.positions.length / 3;
  const regionOf = new Uint8Array(nv);
  const idx = new Uint16Array(nv * 4), wt = new Float32Array(nv * 4);
  const sigma = 0.015;
  const acc = new Float32Array(BONES.length);
  const ds = new Float32Array(set.add.length);
  const boneOf = set.add.map((p) => BONES.indexOf(p.bone));
  const top = [0, 0, 0, 0];
  for (let v = 0; v < nv; v++) {
    const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
    let dmin = 1e9, best = null;
    for (let i = 0; i < set.add.length; i++) {
      const p = set.add[i];
      const dx = x - p.bc[0], dy = y - p.bc[1], dz = z - p.bc[2];
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br > dmin + sigma * 4) { ds[i] = 1e9; continue; }
      const d = primDist(p, x, y, z);
      ds[i] = d;
      if (d < dmin) { dmin = d; best = p; }
    }
    regionOf[v] = REGION_ID[best.region];
    // mistura dos sólidos mais próximos; cada um contribui com o seu osso ou com a sua função de pesos
    acc.fill(0);
    for (let i = 0; i < ds.length; i++) {
      const e = ds[i] - dmin;
      if (e > sigma * 4) continue;
      const k = Math.exp(-e / sigma), p = set.add[i];
      if (p.weight) { const W = p.weight(x, y, z); for (const b in W) acc[BONE_ID[b]] += k * W[b]; }
      else acc[boneOf[i]] += k;
    }
    // os 4 ossos de maior peso
    for (let w = 0; w < 4; w++) {
      let bi = -1, bv = -1;
      for (let b = 0; b < acc.length; b++) if (acc[b] > bv) { bv = acc[b]; bi = b; }
      top[w] = bi;
      wt[v * 4 + w] = Math.max(0, bv);
      acc[bi] = -1;
    }
    let sum = wt[v * 4] + wt[v * 4 + 1] + wt[v * 4 + 2] + wt[v * 4 + 3];
    if (sum <= 0) { wt[v * 4] = sum = 1; }
    for (let w = 0; w < 4; w++) { idx[v * 4 + w] = top[w]; wt[v * 4 + w] /= sum; }
  }
  const arrays = toGeometry(m, regionOf, (reg, x, y, z) => regionUV(REGION_NAMES[reg], x, y, z, J), { idx, wt });
  return { arrays, J, verts: nv, tris: m.indices.length / 3 };
}

// ---------------------------------------------------------------- cabeça, cabelo

// Espaço local da cabeça (origem na base do queixo, frente = +Z), antes da escala do personagem.
export const HEAD_Y = [-0.1, 0.26];
export const EYE = { x: 0.032, y: 0.107, z: 0.066, r: 0.0122 };

export function headUV(x, y, z) {
  let u = 0.5 + Math.atan2(x, z) / (2 * Math.PI);
  if (u < 0) u += 1;
  return [u, (y - HEAD_Y[0]) / (HEAD_Y[1] - HEAD_Y[0])];
}

// Cabeça masculina adulta: crânio, nuca, maciço facial, mandíbula angulosa, queixo quadrado,
// maçãs, arcada supraciliar, órbitas com globos (pálpebras), nariz, lábios e orelhas.
function headPrims(o) {
  const jaw = o.jaw || 1, chin = o.chin || 1, nose = o.nose || 1, brow = o.brow || 1, cheek = o.cheek || 1, face = o.face || 0;
  const nk = o.neck || 0.051;
  const P = [];
  P.push(ell([0, 0.128, -0.014], [0.0765, 0.095, 0.098], { k: 0.02 }));
  P.push(ell([0, 0.112, -0.04], [0.066, 0.07, 0.066], { k: 0.025 }));
  P.push(ell([0, 0.074, 0.028], [0.056 * cheek, 0.056, 0.054], { k: 0.024 }));
  P.push(cone([-0.021, 0.046 - face * 0.5, 0.064], [0.021, 0.046 - face * 0.5, 0.064], 0.019, 0.019, { k: 0.018 }));
  for (const s of [1, -1]) {
    // mandíbula: ângulo sob a orelha, corpo até o queixo e ramo subindo até a articulação
    P.push(cone([s * 0.047 * jaw, 0.036, -0.02], [s * 0.022 * jaw, 0.008 - face, 0.058], 0.016, 0.015, { k: 0.022 }));
    P.push(cone([s * 0.047 * jaw, 0.036, -0.02], [s * 0.056, 0.085, -0.016], 0.015, 0.012, { k: 0.022 }));
    P.push(ell([s * 0.05 * cheek, 0.096, 0.047], [0.02, 0.012, 0.022], { k: 0.026 }));
    P.push(cone([s * 0.006, 0.131, 0.083], [s * 0.053, 0.127, 0.06], 0.0125 * brow, 0.01 * brow, { k: 0.015 }));
    P.push(ell([s * EYE.x, EYE.y, 0.083], [0.02, 0.012, 0.011], { sub: true, k: 0.016 }));
    P.push(ell([s * EYE.x, EYE.y, EYE.z], [EYE.r, EYE.r, EYE.r], { late: true, k: 0.005 }));
    P.push(ell([s * 0.0135 * nose, 0.068, 0.089], [0.0075, 0.0072, 0.009], { k: 0.008 }));
    P.push(ell([s * 0.0735, 0.097, -0.014], [0.0065, 0.028, 0.017], { rot: [0, s * 0.28, s * 0.06], k: 0.007 }));
    P.push(ell([s * 0.0745, 0.074, -0.01], [0.006, 0.0085, 0.0075], { k: 0.006 }));
  }
  P.push(ell([0, 0.128, 0.08], [0.012, 0.01, 0.01], { k: 0.012 }));
  P.push(box([0, 0.013 - face, 0.066], [0.02 * chin, 0.016, 0.016], 0.013, { k: 0.018 }));
  P.push(cone([0, 0.122, 0.084], [0, 0.075, 0.105 + 0.005 * (nose - 1)], 0.0072, 0.0102 * nose, { k: 0.01 }));
  P.push(ell([0, 0.072, 0.1 + 0.005 * (nose - 1)], [0.011 * nose, 0.0102, 0.0115], { k: 0.008 }));
  P.push(ell([0, 0.0505 - face * 0.5, 0.0855], [0.02, 0.0055, 0.008], { k: 0.007 }));
  P.push(ell([0, 0.0405 - face * 0.5, 0.0835], [0.018, 0.007, 0.0085], { k: 0.007 }));
  P.push(cone([0, -0.035, -0.016], [0, 0.07, -0.008], nk, nk * 0.94, { k: 0.02 }));
  if (o.beard === 'full') {
    // barba cheia: volume rente à mandíbula e ao queixo, bigode
    for (const s of [1, -1]) {
      P.push(cone([s * 0.05 * jaw, 0.045, -0.018], [s * 0.023 * jaw, 0.004 - face, 0.06], 0.019, 0.021, { k: 0.018 }));
      P.push(ell([s * 0.04 * jaw, 0.06, 0.035], [0.02, 0.028, 0.028], { k: 0.022 }));
    }
    P.push(box([0, 0.008 - face, 0.068], [0.024 * chin, 0.02, 0.02], 0.017, { k: 0.018 }));
    P.push(cone([-0.022, 0.056, 0.089], [0.022, 0.056, 0.089], 0.006, 0.006, { k: 0.006 }));
  }
  return P;
}

function rigid(prims, h, uvOf) {
  const set = compile(prims);
  const f = field(set);
  const [bmin, bmax] = bounds(set, 0.01);
  const m = surfaceNets(f, bmin, bmax, h);
  return toGeometry(m, new Uint8Array(m.positions.length / 3), (reg, x, y, z) => uvOf(x, y, z), null, 'head');
}

// Cabeça com rosto esculpido (geometria rígida presa ao osso da cabeça).
export function buildHead(o = {}) {
  const prims = headPrims(o).map((p) => ({ ...p, region: 'head' }));
  return { arrays: rigid(prims, o.h || 0.006, headUV) };
}

// Gerador pseudoaleatório determinístico (os tufos do cabelo saem iguais em todo carregamento).
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cabelo: laterais e nuca curtas (pintadas na pele); topo desfiado e mechas caindo na testa.
export function buildHair(style) {
  const P = [];
  const rnd = rand(11);
  P.push(ell([0, 0.15, -0.012], [0.0802, 0.087, 0.103], { k: 0.01 }));
  P.push(ell([0, 0.186, 0.004], [0.06, 0.042, 0.084], { k: 0.024 }));
  if (style === 'textured') {
    // topo desfiado: mechas curtas e pontudas, viradas para a frente e para cima
    for (let i = 0; i < 30; i++) {
      const x = (rnd() - 0.5) * 0.09, z = -0.07 + rnd() * 0.15;
      const top = 0.128 + 0.106 * Math.sqrt(Math.max(0, 1 - (x / 0.085) ** 2 - ((z + 0.01) / 0.11) ** 2));
      const len = 0.022 + rnd() * 0.016;
      const dx = x * 0.12 + (rnd() - 0.5) * 0.012, dy = 0.006 + rnd() * 0.009, dz = 0.026 + rnd() * 0.01;
      const l = Math.hypot(dx, dy, dz);
      const b = [x, top - 0.006, z];
      P.push(cone(b, [b[0] + (dx / l) * len, b[1] + (dy / l) * len, b[2] + (dz / l) * len], 0.0115 + rnd() * 0.004, 0.003, { k: 0.007 }));
    }
    for (let i = 0; i < 7; i++) {
      const x = -0.05 + i * 0.0165 + (rnd() - 0.5) * 0.006;
      P.push(cone([x, 0.205, 0.045], [x + (i - 3) * 0.006, 0.14 - (i % 2) * 0.01 - rnd() * 0.006, 0.096], 0.012, 0.0032, { k: 0.008 }));
    }
  }
  // corte: abaixo de uma linha inclinada (mais baixa na testa) e rente nas laterais
  P.push(box([0, 0.065, -0.02], [0.2, 0.1, 0.2], 0.01, { sub: true, rot: [0.2, 0, 0], k: 0.012 }));
  for (const s of [1, -1]) P.push(box([s * 0.168, 0.115, -0.02], [0.1, 0.07, 0.16], 0.01, { sub: true, k: 0.014 }));
  return { arrays: rigid(P, 0.0058, hairUV) };
}

// Cabelo: projeção de cima (fios correm de trás para a frente na textura).
export const hairUV = (x, y, z) => [0.5 + x / 0.26, 0.5 - z / 0.26];
