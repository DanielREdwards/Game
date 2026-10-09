# Rasterização no espaço UV: para cada texel, o triângulo da malha e as coordenadas baricêntricas.
import numpy as np


def triangulate(F, FT, V):
    """Mesma triangulação do exportador (diagonal mais curta). Devolve tris de vértices e de UVs."""
    TV, TT = [], []
    for f, t in zip(F, FT):
        if len(f) == 4:
            d02 = np.linalg.norm(V[f[0]] - V[f[2]])
            d13 = np.linalg.norm(V[f[1]] - V[f[3]])
            if d02 <= d13:
                ids = [(0, 1, 2), (0, 2, 3)]
            else:
                ids = [(0, 1, 3), (1, 2, 3)]
            for a, b, c in ids:
                TV.append((f[a], f[b], f[c]))
                TT.append((t[a], t[b], t[c]))
        else:
            TV.append(tuple(f))
            TT.append(tuple(t))
    return np.array(TV), np.array(TT)


def raster_uv(TT, VT, size):
    """Texel -> (triângulo, baricêntricas). UV no padrão glTF (v para baixo na imagem)."""
    S = size
    tri = np.full((S, S), -1, np.int32)
    bary = np.zeros((S, S, 3), np.float32)
    uv = VT.copy()
    uv[:, 1] = 1 - uv[:, 1]
    P = uv[TT] * S - 0.5  # centro do texel em inteiros
    for i, (a, b, c) in enumerate(P):
        x0 = int(np.floor(min(a[0], b[0], c[0])))
        x1 = int(np.ceil(max(a[0], b[0], c[0])))
        y0 = int(np.floor(min(a[1], b[1], c[1])))
        y1 = int(np.ceil(max(a[1], b[1], c[1])))
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, S - 1), min(y1, S - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-12:
            continue
        px, py = xs - a[0], ys - a[1]
        l1 = (px * v1[1] - v1[0] * py) / den
        l2 = (v0[0] * py - px * v0[1]) / den
        l0 = 1 - l1 - l2
        inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not inside.any():
            continue
        yy, xx = ys[inside], xs[inside]
        tri[yy, xx] = i
        bary[yy, xx, 0] = l0[inside]
        bary[yy, xx, 1] = l1[inside]
        bary[yy, xx, 2] = l2[inside]
    return tri, bary


def vertex_normals_tri(V, TV):
    N = np.zeros_like(V)
    a, b, c = V[TV[:, 0]], V[TV[:, 1]], V[TV[:, 2]]
    n = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(N, TV[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def dilate(img, mask, iters=8):
    """Estende as cores das ilhas para fora (evita costuras com filtragem bilinear/mipmaps)."""
    import cv2
    img = img.copy()
    m = mask.copy()
    k = np.ones((3, 3), np.uint8)
    for _ in range(iters):
        grown = cv2.dilate(m.astype(np.uint8), k).astype(bool) & ~m
        if not grown.any():
            break
        acc = np.zeros(img.shape, np.float32)
        cnt = np.zeros(m.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                sm = np.roll(np.roll(m, dy, 0), dx, 1)
                si = np.roll(np.roll(img, dy, 0), dx, 1)
                acc[sm] += si[sm]
                cnt += sm
        sel = grown & (cnt > 0)
        img[sel] = acc[sel] / cnt[sel][..., None]
        m = m | sel
    return img, m
