// Campo de distância (SDF) feito de sólidos anatômicos unidos de forma suave.
// Sólidos: elipsoide, cone arredondado (entre dois pontos, raios diferentes), caixa arredondada,
// "loft" (tronco descrito por seções horizontais) e tubo (membro com perfil de raios ao longo do eixo).
// Sem dependências: roda também dentro de Web Workers.

// ---------------------------------------------------------------- construtores
// Opções comuns: bone (osso dono), region (região do atlas), k (raio da união suave),
// rot (Euler [x, y, z]), sub (subtrai em vez de somar), weight (função de pesos personalizada).
export const ell = (c, r, o = {}) => ({ t: 0, c, r, ...o });
export const cone = (a, b, ra, rb, o = {}) => ({ t: 1, a, b, ra, rb, ...o });
export const box = (c, h, round, o = {}) => ({ t: 2, c, h, round, ...o });
// Seções: [y, meia-largura, frente, costas, deslocamento z do centro?]. Opções: n (expoente da
// superelipse; 2 = elipse, maior = mais quadrada), round (arredondamento das tampas).
export const loft = (sections, o = {}) => ({ t: 3, sections, ...o });
// Perfil: [t (0..1 de a até b), raio lateral, raio frontal, desloc. lateral?, desloc. frontal?].
// Opções: side (direção lateral; padrão perpendicular ao eixo), fw (frente; padrão +Z), round.
export const tube = (a, b, profile, o = {}) => ({ t: 4, a, b, profile, ...o });

// Interpolação cúbica monótona (Fritsch–Carlson): curvas suaves que não ultrapassam os valores dados.
function pchip(xs, ys) {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const h = [], dl = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; dl[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = dl[0]; m[n - 1] = dl[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (dl[i - 1] * dl[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

// Tabela fina (n amostras de 4 valores) das curvas interpoladas: avaliação rápida por busca linear.
function table(xs, cols, n) {
  const fs = cols.map((c) => pchip(xs, c));
  const T = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = xs[0] + ((xs[xs.length - 1] - xs[0]) * i) / (n - 1);
    for (let c = 0; c < 4; c++) T[i * 4 + c] = c < fs.length ? fs[c](x) : 0;
  }
  return T;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Rotação inversa (mundo -> local) de um Euler na ordem XYZ, a mesma convenção do three.js.
function invRot(rot) {
  if (!rot) return null;
  const a = Math.cos(rot[0]), b = Math.sin(rot[0]), c = Math.cos(rot[1]), d = Math.sin(rot[1]);
  const e = Math.cos(rot[2]), f = Math.sin(rot[2]);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  // linhas da transposta = colunas da matriz de rotação
  return [c * e, af + be * d, bf - ae * d, -c * f, ae - bf * d, be + af * d, d, -b * c, a * c];
}

// Pré-calcula constantes e esferas envolventes; ordena do maior para o menor (poda mais cedo).
export function compile(prims) {
  for (const p of prims) {
    p.k = p.k ?? 0.02;
    if (p.t === 0) {
      p.inv = invRot(p.rot);
      p.bc = p.c;
      p.br = Math.max(p.r[0], p.r[1], p.r[2]);
    } else if (p.t === 1) {
      const [ax, ay, az] = p.a, [bx, by, bz] = p.b;
      p.bax = bx - ax; p.bay = by - ay; p.baz = bz - az;
      p.l2 = p.bax * p.bax + p.bay * p.bay + p.baz * p.baz;
      p.rr = p.ra - p.rb;
      p.a2 = p.l2 - p.rr * p.rr;
      p.il2 = 1 / p.l2;
      p.sc = p.s || null;
      p.scen = p.s ? p.sc0 || [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2] : null;
      p.bc = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
      p.br = Math.sqrt(p.l2) / 2 + Math.max(p.ra, p.rb);
      if (p.s) p.br *= Math.max(p.s[0], p.s[1], p.s[2]);
    } else if (p.t === 2) {
      p.inv = invRot(p.rot);
      p.bc = p.c;
      p.br = Math.sqrt(p.h[0] * p.h[0] + p.h[1] * p.h[1] + p.h[2] * p.h[2]);
    } else if (p.t === 3) {
      const S = p.sections;
      p.y0 = S[0][0]; p.y1 = S[S.length - 1][0];
      p.n = p.n ?? 2;
      p.round = p.round ?? 0.02;
      p.N = Math.max(8, Math.ceil((p.y1 - p.y0) / 0.003) + 1);
      p.tab = table(S.map((r) => r[0]), [1, 2, 3, 4].map((c) => S.map((r) => r[c] ?? 0)), p.N);
      let rmax = 0, czm = 0;
      for (let i = 0; i < p.N; i++) {
        const T = p.tab, o = i * 4;
        rmax = Math.max(rmax, T[o], T[o + 1] + Math.abs(T[o + 3]), T[o + 2] + Math.abs(T[o + 3]));
        czm += T[o + 3] / p.N;
      }
      p.bc = [0, (p.y0 + p.y1) / 2, czm];
      p.br = Math.hypot((p.y1 - p.y0) / 2, rmax);
    } else {
      const d = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]];
      p.len = Math.hypot(d[0], d[1], d[2]);
      p.d = unit(d);
      let fw = p.fw || [0, 0, 1];
      const k = fw[0] * p.d[0] + fw[1] * p.d[1] + fw[2] * p.d[2];
      fw = unit([fw[0] - p.d[0] * k, fw[1] - p.d[1] * k, fw[2] - p.d[2] * k]);
      let sd = p.side ? unit(p.side) : cross(fw, p.d);
      const ks = sd[0] * p.d[0] + sd[1] * p.d[1] + sd[2] * p.d[2];
      sd = unit([sd[0] - p.d[0] * ks, sd[1] - p.d[1] * ks, sd[2] - p.d[2] * ks]);
      p.fwv = fw; p.sdv = sd;
      const P = p.profile;
      p.N = 64;
      p.tab = table(P.map((r) => r[0]), [1, 2, 3, 4].map((c) => P.map((r) => r[c] ?? 0)), p.N);
      let rmin = 1, rmax = 0;
      for (let i = 0; i < p.N; i++) {
        const T = p.tab, o = i * 4;
        rmin = Math.min(rmin, T[o], T[o + 1]);
        rmax = Math.max(rmax, Math.max(T[o], T[o + 1]) + Math.hypot(T[o + 2], T[o + 3]));
      }
      p.round = Math.min(p.round ?? rmin * 0.7, rmin * 0.9, p.len * 0.45);
      p.bc = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2];
      p.br = p.len / 2 + rmax;
    }
  }
  const add = prims.filter((p) => !p.sub && !p.late).sort((a, b) => b.br - a.br);
  const sub = prims.filter((p) => p.sub);
  const late = prims.filter((p) => p.late && !p.sub);
  return { add: [...add, ...late], base: add, sub, late, all: [...add, ...sub, ...late] };
}

// ---------------------------------------------------------------- distâncias

function local(p, x, y, z, out) {
  let dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
  const m = p.inv;
  if (m) {
    const lx = m[0] * dx + m[1] * dy + m[2] * dz;
    const ly = m[3] * dx + m[4] * dy + m[5] * dz;
    const lz = m[6] * dx + m[7] * dy + m[8] * dz;
    dx = lx; dy = ly; dz = lz;
  }
  out[0] = dx; out[1] = dy; out[2] = dz;
  return out;
}
const L = [0, 0, 0];

export function primDist(p, x, y, z) {
  if (p.t === 0) {
    local(p, x, y, z, L);
    const [rx, ry, rz] = p.r;
    const k0 = Math.sqrt((L[0] / rx) ** 2 + (L[1] / ry) ** 2 + (L[2] / rz) ** 2);
    const k1 = Math.sqrt((L[0] / (rx * rx)) ** 2 + (L[1] / (ry * ry)) ** 2 + (L[2] / (rz * rz)) ** 2);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  }
  if (p.t === 1) {
    let sx = 1, mn = 1;
    if (p.sc) {
      // cone com seção elíptica: avalia num espaço escalado em torno do centro
      const c = p.scen;
      x = c[0] + (x - c[0]) / p.sc[0];
      y = c[1] + (y - c[1]) / p.sc[1];
      z = c[2] + (z - c[2]) / p.sc[2];
      mn = Math.min(p.sc[0], p.sc[1], p.sc[2]);
      sx = mn;
    }
    const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
    const l2 = p.l2, rr = p.rr, a2 = p.a2, il2 = p.il2;
    const yy = pax * p.bax + pay * p.bay + paz * p.baz;
    const zz = yy - l2;
    const qx = pax * l2 - p.bax * yy, qy = pay * l2 - p.bay * yy, qz = paz * l2 - p.baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    let d;
    if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - p.rb;
    else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - p.ra;
    else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.ra;
    return d * sx;
  }
  if (p.t === 2) {
    local(p, x, y, z, L);
    const r = p.round;
    const qx = Math.abs(L[0]) - (p.h[0] - r), qy = Math.abs(L[1]) - (p.h[1] - r), qz = Math.abs(L[2]) - (p.h[2] - r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }
  if (p.t === 3) return loftDist(p, x, y, z);
  return tubeDist(p, x, y, z);
}

// Seção num ponto da tabela (posição contínua s em amostras): devolve k (norma da superelipse
// encolhida por r) e a magnitude do gradiente radial em K[1].
const K = [0, 0];
function secK(T, N, s, u, v, r, n) {
  if (s < 0) s = 0; else if (s > N - 1) s = N - 1;
  const i = Math.min(N - 2, s | 0), f = s - i, o = i * 4;
  const a = Math.max(1e-4, T[o] + (T[o + 4] - T[o]) * f - r);
  const fr = Math.max(1e-4, T[o + 1] + (T[o + 5] - T[o + 1]) * f - r);
  const bk = Math.max(1e-4, T[o + 2] + (T[o + 6] - T[o + 2]) * f - r);
  const cz = T[o + 3] + (T[o + 7] - T[o + 3]) * f;
  const w = v - cz;
  const c = w >= 0 ? fr : bk;
  const X = Math.abs(u) / a, Z = Math.abs(w) / c;
  if (n === 2) {
    const k = Math.sqrt(X * X + Z * Z);
    K[0] = k;
    K[1] = k > 1e-9 ? Math.sqrt((X / a) ** 2 + (Z / c) ** 2) / k : 1 / Math.min(a, c);
    return K;
  }
  const xn = X ** n, zn = Z ** n;
  const k = (xn + zn) ** (1 / n);
  K[0] = k;
  if (k > 1e-9) {
    const kk = k ** (1 - n);
    K[1] = kk * Math.sqrt(((X > 0 ? xn / X : 0) / a) ** 2 + ((Z > 0 ? zn / Z : 0) / c) ** 2);
  } else K[1] = 1 / Math.min(a, c);
  return K;
}

// Combina a distância radial com as tampas (fórmula de extrusão) e devolve a distância final.
function capped(k, gr, gy, dy, r) {
  const ds = (k - 1) / Math.sqrt(gr * gr + gy * gy);
  const m = Math.min(Math.max(ds, dy), 0);
  const ox = Math.max(ds, 0), oy = Math.max(dy, 0);
  return m + Math.sqrt(ox * ox + oy * oy) - r;
}

function loftDist(p, x, y, z) {
  const r = p.round, N = p.N, T = p.tab;
  const lo = p.y0 + r, hi = p.y1 - r;
  const yc = y < lo ? lo : y > hi ? hi : y;
  const sc = (N - 1) / (p.y1 - p.y0);
  const s = (yc - p.y0) * sc;
  const k = secK(T, N, s, x, z, r, p.n)[0], gr = K[1];
  let gy = 0;
  if (y > lo && y < hi) {
    const e = 0.004;
    gy = (secK(T, N, s + e * sc, x, z, r, p.n)[0] - secK(T, N, s - e * sc, x, z, r, p.n)[0]) / (2 * e);
  }
  return capped(k, gr, gy, Math.max(lo - y, y - hi), r);
}

function tubeDist(p, x, y, z) {
  const qx = x - p.a[0], qy = y - p.a[1], qz = z - p.a[2];
  const tl = qx * p.d[0] + qy * p.d[1] + qz * p.d[2];
  const u = qx * p.sdv[0] + qy * p.sdv[1] + qz * p.sdv[2];
  const v = qx * p.fwv[0] + qy * p.fwv[1] + qz * p.fwv[2];
  const r = p.round, N = p.N, T = p.tab, len = p.len;
  const lo = r, hi = len - r;
  const tc = tl < lo ? lo : tl > hi ? hi : tl;
  const sc = (N - 1) / len;
  const s = tc * sc;
  // deslocamento lateral (coluna 2) e frontal (coluna 3): avaliados como no secK
  const kAt = (ss) => {
    if (ss < 0) ss = 0; else if (ss > N - 1) ss = N - 1;
    const i = Math.min(N - 2, ss | 0), f = ss - i, o = i * 4;
    const a = Math.max(1e-4, T[o] + (T[o + 4] - T[o]) * f - r);
    const c = Math.max(1e-4, T[o + 1] + (T[o + 5] - T[o + 1]) * f - r);
    const X = (u - (T[o + 2] + (T[o + 6] - T[o + 2]) * f)) / a;
    const Z = (v - (T[o + 3] + (T[o + 7] - T[o + 3]) * f)) / c;
    const k = Math.sqrt(X * X + Z * Z);
    K[0] = k;
    K[1] = k > 1e-9 ? Math.sqrt((X / a) ** 2 + (Z / c) ** 2) / k : 1 / Math.min(a, c);
    return k;
  };
  let gy = 0;
  if (tl > lo && tl < hi) {
    const e = 0.004;
    gy = (kAt(s + e * sc) - kAt(s - e * sc)) / (2 * e);
  }
  const k = kAt(s), gr = K[1];
  return capped(k, gr, gy, Math.max(lo - tl, tl - hi), r);
}

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

function unionInto(d, list, x, y, z) {
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const dx = x - p.bc[0], dy = y - p.bc[1], dz = z - p.bc[2];
    const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br;
    if (lb > d + p.k) continue;
    d = d === 1e9 ? primDist(p, x, y, z) : smin(d, primDist(p, x, y, z), p.k);
  }
  return d;
}

// Ordem: soma dos sólidos, subtrações e, por fim, sólidos "tardios" (ex.: globo ocular dentro da órbita).
function fieldOf(add, sub, late) {
  return (x, y, z) => {
    let d = unionInto(1e9, add, x, y, z);
    for (let i = 0; i < sub.length; i++) {
      const p = sub[i];
      const dx = x - p.bc[0], dy = y - p.bc[1], dz = z - p.bc[2];
      const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br;
      if (lb > p.k - d) continue;
      d = smax(d, -primDist(p, x, y, z), p.k);
    }
    return late.length ? unionInto(d, late, x, y, z) : d;
  };
}

// Distância do campo inteiro, com poda pelas esferas envolventes. "local" devolve um campo
// restrito aos sólidos que podem influenciar uma esfera (centro, raio): muito mais rápido.
export function field(set) {
  const f = fieldOf(set.base, set.sub, set.late);
  f.local = (cx, cy, cz, r, margin) => {
    const near = (p) => {
      const dx = cx - p.bc[0], dy = cy - p.bc[1], dz = cz - p.bc[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - r - p.br < margin + p.k;
    };
    return fieldOf(set.base.filter(near), set.sub.filter(near), set.late.filter(near));
  };
  return f;
}
