// Biblioteca de poses e golpes. Cada pose define rotações (Euler XYZ, radianos) por articulação.
// Convenções: personagem olha para +Z; lado esquerdo = +X.
//   ombro/quadril: x < 0 leva o membro para frente; z > 0 afasta o membro esquerdo do corpo.
//   cotovelo: x < 0 dobra o antebraço para frente/cima. Joelho: x > 0 dobra a perna para trás.
//   coluna/peito: x > 0 inclina para frente; y > 0 gira o ombro direito para frente.
// Todas as poses e golpes foram autorados do zero para este projeto.
import { clamp, smooth } from './util.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKn', 'rHip', 'rKn'];

export const STANCE = {
  hips: [0, -0.35, 0], spine: [0.1, 0.18, 0], chest: [0.04, 0.12, 0], neck: [-0.08, 0.05, 0], head: [0, 0, 0],
  lSh: [-0.8, 0, 0.12], lEl: [-2.1, 0.3, 0], rSh: [-0.55, 0, -0.16], rEl: [-2.3, -0.3, 0],
  lHip: [-0.38, 0, 0.12], lKn: [0.5, 0, 0], rHip: [0.28, 0, -0.14], rKn: [0.42, 0, 0], hy: 0,
};

export function pose(over, base = STANCE) {
  const p = {};
  for (const k of JOINTS) p[k] = (over[k] || base[k]).slice();
  p.hy = over.hy ?? 0;
  return p;
}

export function lerpPose(a, b, t, out = {}) {
  for (const k of JOINTS) {
    const x = a[k], y = b[k];
    const o = out[k] || (out[k] = [0, 0, 0]);
    o[0] = x[0] + (y[0] - x[0]) * t;
    o[1] = x[1] + (y[1] - x[1]) * t;
    o[2] = x[2] + (y[2] - x[2]) * t;
  }
  out.hy = (a.hy || 0) + ((b.hy || 0) - (a.hy || 0)) * t;
  return out;
}

export function copyPose(a, out) { return lerpPose(a, a, 0, out); }

// ------------------------------------------------------------ locomoção

const RUN = pose({});
export function runPose(phase, amt, out = RUN) {
  const s = Math.sin(phase), c = Math.cos(phase);
  out.hips[0] = 0; out.hips[1] = s * 0.12 * amt; out.hips[2] = 0;
  out.spine[0] = 0.08 + 0.22 * amt; out.spine[1] = -s * 0.12 * amt; out.spine[2] = 0;
  out.chest[0] = 0.04; out.chest[1] = -s * 0.18 * amt; out.chest[2] = 0;
  out.neck[0] = -0.1 - 0.12 * amt; out.neck[1] = 0; out.neck[2] = 0;
  out.head[0] = 0; out.head[1] = 0; out.head[2] = 0;
  out.lSh[0] = s * 1.0 * amt - 0.25; out.lSh[1] = 0; out.lSh[2] = 0.14;
  out.rSh[0] = -s * 1.0 * amt - 0.25; out.rSh[1] = 0; out.rSh[2] = -0.14;
  out.lEl[0] = -1.35 - 0.25 * amt; out.lEl[1] = 0; out.lEl[2] = 0;
  out.rEl[0] = -1.35 - 0.25 * amt; out.rEl[1] = 0; out.rEl[2] = 0;
  out.lHip[0] = -s * 0.85 * amt - 0.1 * amt; out.lHip[1] = 0; out.lHip[2] = 0.05;
  out.rHip[0] = s * 0.85 * amt - 0.1 * amt; out.rHip[1] = 0; out.rHip[2] = -0.05;
  out.lKn[0] = 0.15 + (0.25 + 1.0 * Math.max(0, c)) * amt; out.lKn[1] = 0; out.lKn[2] = 0;
  out.rKn[0] = 0.15 + (0.25 + 1.0 * Math.max(0, -c)) * amt; out.rKn[1] = 0; out.rKn[2] = 0;
  out.hy = -Math.abs(Math.cos(phase)) * 0.05 * amt;
  return out;
}

// Deslocamento lateral curto em guarda (inimigos rondando).
const SHUF = pose({});
export function shufflePose(base, phase, amt, out = SHUF) {
  copyPose(base, out);
  const s = Math.sin(phase);
  out.lHip[0] += s * 0.35 * amt; out.rHip[0] -= s * 0.35 * amt;
  out.lKn[0] += Math.max(0, s) * 0.5 * amt; out.rKn[0] += Math.max(0, -s) * 0.5 * amt;
  out.hy = -Math.abs(s) * 0.03 * amt;
  return out;
}

const IDLE = pose({});
export function idlePose(base, t, out = IDLE) {
  copyPose(base, out);
  const b = Math.sin(t * 2.2);
  out.chest[0] += b * 0.025;
  out.lSh[0] += b * 0.04; out.rSh[0] += b * 0.04;
  out.lEl[0] -= b * 0.05; out.rEl[0] -= b * 0.05;
  out.hy = b * 0.008;
  return out;
}

// ------------------------------------------------------------ golpes do protagonista

const JAB = pose({
  hips: [0, -0.42, 0], spine: [0.12, 0, 0], chest: [0.04, -0.06, 0], neck: [-0.06, 0.45, 0],
  lSh: [-1.52, 0, 0.12], lEl: [-0.08, 0, 0], rSh: [-0.6, 0, -0.18], rEl: [-2.3, -0.3, 0],
  lHip: [-0.5, 0, 0.12], lKn: [0.45, 0, 0], rHip: [0.38, 0, -0.14], rKn: [0.3, 0, 0],
});
const CROSS_W = pose({ hips: [0, -0.5, 0], spine: [0.1, 0.05, 0], chest: [0.04, -0.1, 0], neck: [-0.06, 0.5, 0], rSh: [-0.7, 0, -0.2], rEl: [-2.2, 0, 0] });
const CROSS = pose({
  hips: [0, 0.22, 0], spine: [0.16, 0.1, 0], chest: [0.04, 0.14, 0], neck: [-0.06, -0.46, 0],
  lSh: [-0.7, 0, 0.15], lEl: [-2.2, 0.3, 0], rSh: [-1.52, 0, -0.1], rEl: [-0.08, 0, 0],
  lHip: [-0.52, 0, 0.12], lKn: [0.5, 0, 0], rHip: [0.48, 0, -0.12], rKn: [0.12, 0, 0],
});
const HOOK_W = pose({
  hips: [0, -0.1, 0], spine: [0.12, 0.25, 0], chest: [0.04, 0.2, 0], neck: [-0.06, -0.35, 0],
  lSh: [-1.0, 0, 0.75], lEl: [-0.4, 0, -1.7],
});
const HOOK = pose({
  hips: [0, -0.3, 0], spine: [0.14, -0.25, 0], chest: [0.05, -0.35, 0], neck: [-0.06, 0.85, 0],
  lSh: [-1.42, 0, 0.85], lEl: [-0.2, 0, -1.45], rSh: [-0.6, 0, -0.2], rEl: [-2.3, -0.3, 0],
  lHip: [-0.48, 0, 0.12], lKn: [0.5, 0, 0], rHip: [0.32, 0, -0.14], rKn: [0.38, 0, 0],
});
const KICK_W = pose({
  hips: [0, 0.3, 0], spine: [-0.05, -0.15, -0.2], chest: [0, -0.1, 0], neck: [-0.05, -0.15, 0.2],
  lSh: [-0.9, 0, 0.45], lEl: [-1.8, 0, 0], rSh: [-0.5, 0, -0.6], rEl: [-1.4, 0, 0],
  lHip: [-0.15, 0, 0.08], lKn: [0.35, 0, 0], rHip: [-1.3, 0, -0.5], rKn: [1.7, 0, 0],
});
const KICK = pose({
  hips: [0, 0.62, 0], spine: [-0.12, -0.3, -0.42], chest: [0, -0.25, 0], neck: [0, -0.15, 0.35],
  lSh: [-0.8, 0, 0.55], lEl: [-1.6, 0, 0], rSh: [-0.25, 0, -0.95], rEl: [-1.0, 0, 0],
  lHip: [-0.08, 0, 0.06], lKn: [0.22, 0, 0], rHip: [-1.6, 0, -0.42], rKn: [0.1, 0, 0],
});
const KNEE_W = pose({ spine: [0.2, 0, 0], lSh: [-1.6, 0, 0.25], lEl: [-0.9, 0, 0], rSh: [-1.6, 0, -0.25], rEl: [-0.9, 0, 0], rHip: [-0.6, 0, -0.1], rKn: [1.4, 0, 0] });
const KNEE = pose({
  hips: [0, 0.15, 0], spine: [0.35, 0, 0], chest: [0.15, 0, 0], neck: [-0.35, 0, 0],
  lSh: [-1.15, 0, 0.18], lEl: [-1.25, 0, 0], rSh: [-1.15, 0, -0.18], rEl: [-1.25, 0, 0],
  lHip: [0.1, 0, 0.08], lKn: [0.15, 0, 0], rHip: [-1.75, 0, -0.06], rKn: [2.05, 0, 0],
});
const FLY_W = pose({
  hips: [0, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0, 0], neck: [-0.35, 0, 0],
  lSh: [0.5, 0, 0.35], lEl: [-0.4, 0, 0], rSh: [0.5, 0, -0.35], rEl: [-0.4, 0, 0],
  lHip: [-1.1, 0, 0.1], lKn: [1.7, 0, 0], rHip: [-0.4, 0, -0.1], rKn: [1.5, 0, 0],
});
const FLY = pose({
  hips: [0, 0.25, 0], spine: [-0.25, 0, 0], chest: [0, 0, 0], neck: [0.15, -0.2, 0],
  lSh: [-0.6, 0, 1.2], lEl: [-0.5, 0, 0], rSh: [-0.4, 0, -1.3], rEl: [-0.5, 0, 0],
  lHip: [-1.5, 0, 0.05], lKn: [0.05, 0, 0], rHip: [-0.3, 0, -0.1], rKn: [1.9, 0, 0],
});
const PARRY = pose({
  hips: [0, -0.25, 0], spine: [0.04, -0.25, 0], chest: [0, -0.2, 0], neck: [0, 0.5, 0],
  lSh: [-2.15, 0, 0.45], lEl: [-0.9, 0, 0], rSh: [-0.5, 0, -0.35], rEl: [-1.9, 0, 0],
  lHip: [-0.42, 0, 0.2], lKn: [0.62, 0, 0], rHip: [0.3, 0, -0.2], rKn: [0.6, 0, 0],
});
const PALM = pose({
  hips: [0, 0.32, 0], spine: [0.22, 0.2, 0], chest: [0.06, 0.25, 0], neck: [-0.05, -0.7, 0],
  lSh: [-1.0, 0, 0.6], lEl: [-1.3, 0, 0], rSh: [-1.5, 0, -0.04], rEl: [-0.05, 0, 0],
  lHip: [-0.62, 0, 0.15], lKn: [0.62, 0, 0], rHip: [0.52, 0, -0.15], rKn: [0.1, 0, 0],
});
const FIN_UP = pose({
  hips: [0, 0, 0], spine: [-0.35, 0, 0], chest: [-0.1, 0, 0], neck: [0.3, 0, 0],
  lSh: [-0.3, 0, 1.15], lEl: [-0.6, 0, 0], rSh: [-0.3, 0, -1.15], rEl: [-0.6, 0, 0],
  lHip: [0.05, 0, 0.08], lKn: [0.12, 0, 0], rHip: [-2.7, 0, -0.08], rKn: [0.05, 0, 0],
});
const FIN_SLAM = pose({
  hips: [0, 0, 0], spine: [0.55, 0, 0], chest: [0.2, 0, 0], neck: [-0.35, 0, 0],
  lSh: [-1.7, 0, 0.6], lEl: [-0.8, 0, 0], rSh: [0.35, 0, -0.6], rEl: [-0.4, 0, 0],
  lHip: [0.15, 0, 0.1], lKn: [0.95, 0, 0], rHip: [-1.05, 0, -0.08], rKn: [0.3, 0, 0], hy: -0.08,
});
export const TUCK = pose({
  hips: [0, 0, 0], spine: [0.9, 0, 0], chest: [0.4, 0, 0], neck: [0.5, 0, 0],
  lSh: [-1.4, 0, 0.3], lEl: [-1.9, 0, 0], rSh: [-1.4, 0, -0.3], rEl: [-1.9, 0, 0],
  lHip: [-2.0, 0, 0.12], lKn: [2.3, 0, 0], rHip: [-2.0, 0, -0.12], rKn: [2.3, 0, 0],
});
export const SALUTE = pose({
  hips: [0, 0, 0], spine: [0.02, 0, 0], chest: [0, 0, 0], neck: [0.05, 0, 0],
  lSh: [-1.0, 0, -0.42], lEl: [-1.55, 0, 0], rSh: [-1.0, 0, 0.42], rEl: [-1.55, 0, 0],
  lHip: [0, 0, 0.05], lKn: [0.05, 0, 0], rHip: [0, 0, -0.05], rKn: [0.05, 0, 0],
});

// ------------------------------------------------------------ reações (compartilhadas)

export const HIT_HEAD = pose({
  hips: [0, -0.2, 0], spine: [-0.32, 0.2, 0], chest: [-0.2, 0, 0], neck: [-0.5, 0.4, 0],
  lSh: [-0.3, 0, 0.7], lEl: [-0.9, 0, 0], rSh: [-0.5, 0, -0.6], rEl: [-1.0, 0, 0],
  lHip: [-0.2, 0, 0.12], lKn: [0.3, 0, 0], rHip: [0.35, 0, -0.12], rKn: [0.35, 0, 0],
});
export const HIT_BODY = pose({
  hips: [0, -0.1, 0], spine: [0.55, 0, 0], chest: [0.3, 0, 0], neck: [0.1, 0, 0],
  lSh: [-0.7, 0, -0.1], lEl: [-1.6, 0, 0], rSh: [-0.7, 0, 0.1], rEl: [-1.6, 0, 0],
  lHip: [-0.45, 0, 0.1], lKn: [0.75, 0, 0], rHip: [-0.1, 0, -0.1], rKn: [0.65, 0, 0],
});
export const FALL = pose({
  hips: [0, 0, 0], spine: [-0.3, 0, 0], chest: [-0.1, 0, 0], neck: [0.3, 0, 0],
  lSh: [-2.4, 0, 0.7], lEl: [-0.4, 0, 0], rSh: [-2.2, 0, -0.8], rEl: [-0.5, 0, 0],
  lHip: [-0.7, 0, 0.15], lKn: [0.8, 0, 0], rHip: [-0.3, 0, -0.12], rKn: [0.4, 0, 0],
});
export const LYING = pose({
  hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0.1, 0.5, 0],
  lSh: [-0.3, 0, 1.2], lEl: [-0.3, 0, 0], rSh: [-0.15, 0, -0.9], rEl: [-0.6, 0, 0],
  lHip: [-0.12, 0, 0.18], lKn: [0.2, 0, 0], rHip: [0, 0, -0.12], rKn: [0.45, 0, 0],
});
export const SIT = pose({
  hips: [0, 0, 0], spine: [0.7, 0, 0], chest: [0.25, 0, 0], neck: [-0.2, 0, 0],
  lSh: [-0.6, 0, 0.35], lEl: [-0.6, 0, 0], rSh: [-0.6, 0, -0.35], rEl: [-0.6, 0, 0],
  lHip: [-1.5, 0, 0.18], lKn: [2.0, 0, 0], rHip: [-1.25, 0, -0.18], rKn: [1.7, 0, 0],
});

// ------------------------------------------------------------ capangas

export const E_STANCE = pose({
  hips: [0, -0.2, 0], spine: [0.14, 0.1, 0], chest: [0.06, 0.1, 0], neck: [-0.12, 0, 0],
  lSh: [-0.6, 0, 0.28], lEl: [-1.75, 0, 0], rSh: [-0.45, 0, -0.32], rEl: [-1.9, 0, 0],
  lHip: [-0.3, 0, 0.16], lKn: [0.42, 0, 0], rHip: [0.2, 0, -0.16], rKn: [0.38, 0, 0],
});
export const E_TAUNT = pose({
  hips: [0, 0, 0], spine: [-0.08, 0, 0], chest: [-0.06, 0, 0], neck: [-0.15, 0, 0],
  lSh: [-0.5, 0, 0.85], lEl: [-1.0, 0, 0], rSh: [-0.5, 0, -0.85], rEl: [-1.0, 0, 0],
  lHip: [-0.1, 0, 0.18], lKn: [0.15, 0, 0], rHip: [0.05, 0, -0.18], rKn: [0.15, 0, 0],
});
export const E_WIND = pose({
  hips: [0, -0.5, 0], spine: [-0.06, -0.4, 0], chest: [0, -0.4, 0], neck: [0, 0.65, 0],
  lSh: [-1.15, 0, 0.4], lEl: [-0.7, 0, 0], rSh: [0.25, 0, -1.1], rEl: [-1.9, 0, 0],
  lHip: [-0.45, 0, 0.12], lKn: [0.45, 0, 0], rHip: [0.35, 0, -0.14], rKn: [0.5, 0, 0],
});
export const E_STRIKE = pose({
  hips: [0, 0.4, 0], spine: [0.3, 0.3, 0], chest: [0.05, 0.4, 0], neck: [-0.2, -0.6, 0],
  lSh: [-0.3, 0, 0.4], lEl: [-0.8, 0, 0], rSh: [-1.5, 0, 0.15], rEl: [-0.2, 0, 0],
  lHip: [-0.65, 0, 0.12], lKn: [0.55, 0, 0], rHip: [0.45, 0, -0.14], rKn: [0.15, 0, 0],
});
export const B_WIND = pose({
  hips: [0, 0, 0], spine: [-0.3, 0, 0], chest: [-0.1, 0, 0], neck: [0.2, 0, 0],
  lSh: [-2.9, 0, 0.25], lEl: [-0.7, 0, 0], rSh: [-2.9, 0, -0.25], rEl: [-0.7, 0, 0],
  lHip: [-0.3, 0, 0.22], lKn: [0.45, 0, 0], rHip: [0.25, 0, -0.22], rKn: [0.45, 0, 0],
});
export const B_STRIKE = pose({
  hips: [0, 0, 0], spine: [0.62, 0, 0], chest: [0.2, 0, 0], neck: [-0.3, 0, 0],
  lSh: [-1.3, 0, 0.1], lEl: [-0.2, 0, 0], rSh: [-1.3, 0, -0.1], rEl: [-0.2, 0, 0],
  lHip: [-0.62, 0, 0.2], lKn: [0.8, 0, 0], rHip: [0.3, 0, -0.2], rKn: [0.6, 0, 0], hy: -0.05,
});

// ------------------------------------------------------------ clipes

function clip(name, dur, keys, extra) {
  return { name, dur, keys, impact: 0.45, cancel: 0.62, reach: 0.9, dmg: 1, hitY: 1.45, kb: 0.3, ...extra };
}

export function evalClip(c, t, out) {
  const k = c.keys;
  let i = 0;
  while (i < k.length - 2 && t >= k[i + 1][0]) i++;
  const a = k[i], b = k[i + 1];
  const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  const e = b[2] === 'out' ? 1 - (1 - u) * (1 - u) : b[2] === 'in' ? u * u : smooth(u);
  return lerpPose(a[1], b[1], e, out);
}

const S = STANCE;
export const MOVES = {
  jab: clip('jab', 0.3, [[0, S], [0.42, JAB, 'out'], [0.62, JAB], [1, S]], { impact: 0.42, cancel: 0.55, reach: 0.88 }),
  cross: clip('cross', 0.36, [[0, S], [0.2, CROSS_W], [0.45, CROSS, 'out'], [0.62, CROSS], [1, S]], { impact: 0.45, cancel: 0.58, reach: 0.9 }),
  hook: clip('hook', 0.4, [[0, S], [0.25, HOOK_W], [0.48, HOOK, 'out'], [0.66, HOOK], [1, S]], { impact: 0.48, cancel: 0.6, reach: 0.82 }),
  kick: clip('kick', 0.5, [[0, S], [0.28, KICK_W], [0.5, KICK, 'out'], [0.7, KICK], [1, S]],
    { impact: 0.5, cancel: 0.66, reach: 1.05, dmg: 2, hitY: 1.1, kb: 0.6, heavy: true }),
  knee: clip('knee', 0.4, [[0, S], [0.25, KNEE_W], [0.48, KNEE, 'out'], [0.66, KNEE], [1, S]],
    { impact: 0.48, cancel: 0.62, reach: 0.72, hitY: 1.1 }),
  fly: clip('fly', 0.62, [[0, S], [0.28, FLY_W], [0.55, FLY, 'out'], [0.76, FLY], [1, S]],
    { impact: 0.55, cancel: 0.72, reach: 1.0, dmg: 2, hitY: 1.35, heavy: true, knock: true, air: 0.85 }),
  counter: clip('counter', 0.55, [[0, S], [0.26, PARRY, 'out'], [0.48, PALM, 'out'], [0.7, PALM], [1, S]],
    { impact: 0.48, cancel: 0.72, reach: 0.85, dmg: 2, hitY: 1.3, heavy: true, knock: true }),
  finisher: clip('finisher', 0.95, [[0, S], [0.45, FIN_UP], [0.6, FIN_SLAM, 'in'], [0.82, FIN_SLAM], [1, S]],
    { impact: 0.6, cancel: 0.9, reach: 0.95, dmg: 99, hitY: 1.25, heavy: true, knock: true, air: 0.3 }),
};
