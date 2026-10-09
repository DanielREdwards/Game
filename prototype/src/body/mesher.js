// Extração de superfície por "surface nets" com faixa estreita: avalia o campo fino só perto da
// superfície, projeta os vértices sobre ela e usa o gradiente do campo como normal.

export function surfaceNets(f, bmin, bmax, h) {
  const C = 4;
  const nx = Math.ceil((bmax[0] - bmin[0]) / h / C) * C + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / h / C) * C + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / h / C) * C + 1;
  const cx = (nx - 1) / C + 1, cy = (ny - 1) / C + 1, cz = (nz - 1) / C + 1;
  const ox = bmin[0], oy = bmin[1], oz = bmin[2];

  // grade grossa
  const cv = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    cv[(k * cy + j) * cx + i] = f(ox + i * C * h, oy + j * C * h, oz + k * C * h);
  }
  // grade fina: interpolação da grossa (sinal correto longe da superfície) + valores exatos na faixa
  const v = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  const half = (C * h * 1.732) / 2;
  const band = half * 2 * 1.15;
  for (let ck = 0; ck < cz - 1; ck++) for (let cj = 0; cj < cy - 1; cj++) for (let ci = 0; ci < cx - 1; ci++) {
    const c000 = cv[(ck * cy + cj) * cx + ci], c100 = cv[(ck * cy + cj) * cx + ci + 1];
    const c010 = cv[(ck * cy + cj + 1) * cx + ci], c110 = cv[(ck * cy + cj + 1) * cx + ci + 1];
    const c001 = cv[((ck + 1) * cy + cj) * cx + ci], c101 = cv[((ck + 1) * cy + cj) * cx + ci + 1];
    const c011 = cv[((ck + 1) * cy + cj + 1) * cx + ci], c111 = cv[((ck + 1) * cy + cj + 1) * cx + ci + 1];
    const near = Math.min(Math.abs(c000), Math.abs(c100), Math.abs(c010), Math.abs(c110), Math.abs(c001), Math.abs(c101), Math.abs(c011), Math.abs(c111)) < band;
    const fl = near && f.local ? f.local(ox + (ci + 0.5) * C * h, oy + (cj + 0.5) * C * h, oz + (ck + 0.5) * C * h, half, band) : f;
    for (let dk = 0; dk <= C; dk++) for (let dj = 0; dj <= C; dj++) for (let di = 0; di <= C; di++) {
      const i = ci * C + di, j = cj * C + dj, k = ck * C + dk;
      if (near) v[idx(i, j, k)] = fl(ox + i * h, oy + j * h, oz + k * h);
      else {
        const u = di / C, w = dj / C, t = dk / C;
        const a = c000 + (c100 - c000) * u, b = c010 + (c110 - c010) * u;
        const c = c001 + (c101 - c001) * u, d = c011 + (c111 - c011) * u;
        const e = a + (b - a) * w, g = c + (d - c) * w;
        v[idx(i, j, k)] = e + (g - e) * t;
      }
    }
  }

  // um vértice por célula cortada pela superfície
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const g = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      g[c] = v[idx(i + CO[c][0], j + CO[c][1], k + CO[c][2])];
      if (g[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const ga = g[a], gb = g[b];
      if ((ga < 0) === (gb < 0)) continue;
      const t = ga / (ga - gb);
      sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
      sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
      sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
      n++;
    }
    cell[cidx(i, j, k)] = pos.length / 3;
    pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
  }

  // faces: um quadrilátero por aresta da grade que cruza a superfície
  const tri = [];
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tri.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = v[idx(i, j, k)] < 0;
    if (s0 !== v[idx(i + 1, j, k)] < 0) quad(cell[cidx(i, j - 1, k - 1)], cell[cidx(i, j, k - 1)], cell[cidx(i, j, k)], cell[cidx(i, j - 1, k)]);
    if (s0 !== v[idx(i, j + 1, k)] < 0) quad(cell[cidx(i - 1, j, k - 1)], cell[cidx(i - 1, j, k)], cell[cidx(i, j, k)], cell[cidx(i, j, k - 1)]);
    if (s0 !== v[idx(i, j, k + 1)] < 0) quad(cell[cidx(i - 1, j - 1, k)], cell[cidx(i, j - 1, k)], cell[cidx(i, j, k)], cell[cidx(i - 1, j, k)]);
  }

  // projeção dos vértices sobre a superfície e normais pelo gradiente
  const P = new Float32Array(pos);
  const N = new Float32Array(P.length);
  const e = h * 0.5;
  let fv = f;
  const grad = (x, y, z, out) => {
    out[0] = fv(x + e, y, z) - fv(x - e, y, z);
    out[1] = fv(x, y + e, z) - fv(x, y - e, z);
    out[2] = fv(x, y, z + e) - fv(x, y, z - e);
    const l = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  };
  const gr = [0, 0, 0];
  for (let i = 0; i < P.length; i += 3) {
    if (f.local) fv = f.local(P[i], P[i + 1], P[i + 2], h * 3, h * 2);
    for (let it = 0; it < 2; it++) {
      const d = fv(P[i], P[i + 1], P[i + 2]);
      grad(P[i], P[i + 1], P[i + 2], gr);
      const s = Math.max(-h, Math.min(h, d));
      P[i] -= gr[0] * s; P[i + 1] -= gr[1] * s; P[i + 2] -= gr[2] * s;
    }
    grad(P[i], P[i + 1], P[i + 2], gr);
    N[i] = gr[0]; N[i + 1] = gr[1]; N[i + 2] = gr[2];
  }
  // orienta cada triângulo pela normal do campo (garante a face externa)
  const I = new Uint32Array(tri);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * (N[a] + N[b] + N[c]) + gy * (N[a + 1] + N[b + 1] + N[c + 1]) + gz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) {
      const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp;
    }
  }
  return { positions: P, normals: N, indices: I };
}
