// Mapa do quarteirão: áreas caminháveis (união de retângulos), zonas das ondas, obstáculos e
// limites da câmera. Ver docs/sala-limpa/ESPECIFICACAO-MAPA.md.

// Áreas caminháveis (m). +z aponta do fundo do beco para a rua.
export const RECTS = [
  { id: 'alley', x0: -7.4, x1: 7.4, z0: -6.4, z1: 17.4 },
  { id: 'street', x0: -49.5, x1: 49.5, z0: 16.8, z1: 30.8 },
  { id: 'temple', x0: -46.5, x1: -31.5, z0: 3.2, z1: 17.4 },
];

// Zonas de cada onda: retângulo de luta, ponto de entrada (gatilho) e para onde o vento sopra.
export const ZONES = {
  alley: { name: '後巷', label: 'O beco', x0: -7.4, x1: 7.4, z0: -6.4, z1: 15, center: [0, -1.5] },
  street: { name: '花園街', label: 'Rua Fa Yuen', x0: -16, x1: 14, z0: 17, z1: 30.8, center: [-1, 23.5] },
  market: { name: '女人街', label: 'Mercado noturno', x0: 14, x1: 46, z0: 17, z1: 30.8, center: [29, 23.5] },
  temple: { name: '天后廟', label: 'Templo de Tin Hau', x0: -46.5, x1: -31.5, z0: 3.2, z1: 15.6, center: [-39, 9.5] },
};

// Obstáculos preenchidos pelo cenário: { t: 'c', x, z, r } (círculo) ou { t: 'b', x, z, hw, hd } (caixa).
export const OBSTACLES = [];
export const addCircle = (x, z, r) => OBSTACLES.push({ t: 'c', x, z, r });
export const addBox = (x, z, hw, hd) => OBSTACLES.push({ t: 'b', x, z, hw, hd });

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function inRect(R, x, z, m = 0) {
  return x >= R.x0 - m && x <= R.x1 + m && z >= R.z0 - m && z <= R.z1 + m;
}

export function walkable(x, z, m = 0) {
  for (const R of RECTS) if (inRect(R, x, z, m)) return true;
  return false;
}

// Empurra um ponto (com raio) para fora dos obstáculos e para dentro da área caminhável.
export function resolve(p, r = 0.4) {
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dz = p.z - o.z;
    if (o.t === 'c') {
      const m = o.r + r, d2 = dx * dx + dz * dz;
      if (d2 < m * m && d2 > 1e-10) {
        const d = Math.sqrt(d2);
        p.x = o.x + (dx / d) * m;
        p.z = o.z + (dz / d) * m;
      }
    } else {
      const px = o.hw + r - Math.abs(dx), pz = o.hd + r - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) p.x += (dx < 0 ? -1 : 1) * px;
        else p.z += (dz < 0 ? -1 : 1) * pz;
      }
    }
  }
  let bx = p.x, bz = p.z, bd = Infinity;
  for (const R of RECTS) {
    const cx = clamp(p.x, R.x0 + r, R.x1 - r), cz = clamp(p.z, R.z0 + r, R.z1 - r);
    const d = (cx - p.x) ** 2 + (cz - p.z) ** 2;
    if (d === 0) return p;
    if (d < bd) { bd = d; bx = cx; bz = cz; }
  }
  p.x = bx;
  p.z = bz;
  return p;
}

// Distância livre ao longo de uma direção (para escolher o lado da esquiva, por exemplo).
export function room(x, z, dx, dz, max = 3, r = 0.4) {
  const p = { x: 0, z: 0 };
  for (let s = 0.5; s <= max; s += 0.5) {
    p.x = x + dx * s;
    p.z = z + dz * s;
    resolve(p, r);
    if (Math.hypot(p.x - (x + dx * s), p.z - (z + dz * s)) > 0.05) return s - 0.5;
  }
  return max;
}

// Volumes livres para a câmera (até pouco antes das fachadas).
export const CAM_RECTS = [
  { x0: -8.5, x1: 8.5, z0: -7.9, z1: 17.6 },
  { x0: -51, x1: 51, z0: 16.7, z1: 31.1 },
  { x0: -47.1, x1: -30.9, z0: 2.6, z1: 17.6 },
];
const camFree = (x, z) => CAM_RECTS.some((R) => inRect(R, x, z));

// Câmera: recua do foco até a posição desejada, parando antes de entrar num prédio.
export function cameraClamp(focus, pos) {
  const steps = 24;
  let lx = focus.x, lz = focus.z;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = focus.x + (pos.x - focus.x) * t, z = focus.z + (pos.z - focus.z) * t;
    if (!camFree(x, z)) {
      pos.x = lx;
      pos.z = lz;
      return pos;
    }
    lx = x;
    lz = z;
  }
  return pos;
}

export function zoneAt(x, z) {
  for (const [id, Z] of Object.entries(ZONES)) if (inRect(Z, x, z)) return id;
  return null;
}
