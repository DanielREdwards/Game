# Câmera em perspectiva e rasterização por algoritmo do pintor (OpenCV) para alinhar o modelo às vistas da ficha.
import numpy as np, cv2


class Cam:
    def __init__(self, target, yaw, pitch, dist, fov, size, roll=0.0, shift=(0.0, 0.0)):
        self.size = size  # (W, H) do recorte da ficha
        self.target = np.asarray(target, float)
        cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
        # olho na esfera em volta do alvo (yaw 0 = de frente, olhando para -z)
        fwd = -np.array([sy * cp, sp, cy * cp])
        self.eye = self.target - fwd * dist
        up = np.array([0, 1.0, 0])
        z = -fwd
        x = np.cross(up, z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)
        if roll:
            c, s = np.cos(roll), np.sin(roll)
            x, y = c * x + s * y, -s * x + c * y
        self.R = np.stack([x, y, z])
        W, H = size
        self.f = 0.5 * H / np.tan(np.radians(fov) / 2)
        self.c = np.array([W / 2 + shift[0], H / 2 + shift[1]])

    def project(self, P):
        Q = (P - self.eye) @ self.R.T
        d = -Q[:, 2]
        xy = np.stack([Q[:, 0] / d, -Q[:, 1] / d], 1) * self.f + self.c
        return xy, d

    def view_dir(self, P):
        v = self.eye - P
        return v / np.linalg.norm(v, axis=1, keepdims=True)


def tris_of(F):
    T = []
    for f in F:
        if len(f) == 4:
            T += [(f[0], f[1], f[2]), (f[0], f[2], f[3])]
        else:
            T.append(tuple(f))
    return np.array(T)


def raster(cam, V, T, shade=True, light=(0.3, 0.5, 0.8), colors=None):
    """Devolve (imagem sombreada, buffer de id de triângulo, profundidade por vértice projetado)."""
    W, H = cam.size
    xy, d = cam.project(V)
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    cen = (a + b + c) / 3
    vd = cam.view_dir(cen)
    front = (n * vd).sum(1) > 0
    depth = d[T].mean(1)
    order = np.argsort(-depth)
    ids = np.full((H, W), -1, np.int32)
    img = np.full((H, W, 3), 30, np.uint8)
    L = np.asarray(light, float)
    L /= np.linalg.norm(L)
    Lc = L @ cam.R  # luz presa à câmera
    sh = 0.22 + 0.78 * np.clip(n @ Lc, 0, 1)
    pts_all = np.round(xy[T] * 4).astype(np.int32)
    for i in order:
        if not front[i]:
            continue
        p = pts_all[i]
        cv2.fillConvexPoly(ids, p, int(i), shift=2)
        if shade:
            col = (colors[i] if colors is not None else np.array([0.8, 0.66, 0.55])) * sh[i]
            cv2.fillConvexPoly(img, p, tuple(int(255 * v) for v in col[::-1]), lineType=cv2.LINE_AA, shift=2)
    return img, ids, xy, d


def tri_depth_at(cam, V, T, ids, px):
    """Profundidade do triângulo visível em cada ponto px (N x 2), por interseção raio-plano."""
    out = np.full(len(px), np.inf)
    W, H = cam.size
    xi = np.clip(np.round(px[:, 0]).astype(int), 0, W - 1)
    yi = np.clip(np.round(px[:, 1]).astype(int), 0, H - 1)
    inside = (px[:, 0] >= 0) & (px[:, 0] < W) & (px[:, 1] >= 0) & (px[:, 1] < H)
    tid = np.where(inside, ids[yi, xi], -1)
    ok = tid >= 0
    t = T[tid[ok]]
    a, b, c = V[t[:, 0]], V[t[:, 1]], V[t[:, 2]]
    n = np.cross(b - a, c - a)
    # raio da câmera pelo pixel
    q = px[ok]
    dirc = np.stack([(q[:, 0] - cam.c[0]) / cam.f, -(q[:, 1] - cam.c[1]) / cam.f, -np.ones(len(q))], 1)
    dirw = dirc @ cam.R
    num = ((a - cam.eye) * n).sum(1)
    den = (dirw * n).sum(1)
    tt = num / np.where(np.abs(den) < 1e-12, 1e-12, den)
    out[ok] = tt  # distância ao longo de -z da câmera (dirc tem z=-1)
    return out, tid


def render_textured(cam, V, T, TT, VT, tex, ids=None, bg=30):
    """Render com textura (amostragem por pixel a partir do buffer de ids). TT = triângulos de UV; tex = imagem HxWx3."""
    W, H = cam.size
    if ids is None:
        _, ids, _, _ = raster(cam, V, T, shade=False)
    xy, d = cam.project(V)
    out = np.full((H, W, 3), bg, np.uint8)
    ys, xs = np.where(ids >= 0)
    t = ids[ys, xs]
    a, b, c = xy[T[t, 0]], xy[T[t, 1]], xy[T[t, 2]]
    p = np.stack([xs, ys], 1).astype(np.float64)
    v0, v1, v2 = b - a, c - a, p - a
    den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
    den = np.where(np.abs(den) < 1e-9, 1e-9, den)
    l1 = (v2[:, 0] * v1[:, 1] - v1[:, 0] * v2[:, 1]) / den
    l2 = (v0[:, 0] * v2[:, 1] - v2[:, 0] * v0[:, 1]) / den
    l0 = 1 - l1 - l2
    uv = VT.copy()
    uv[:, 1] = 1 - uv[:, 1]
    U = uv[TT[t, 0]] * l0[:, None] + uv[TT[t, 1]] * l1[:, None] + uv[TT[t, 2]] * l2[:, None]
    S = tex.shape[0]
    from scipy.ndimage import map_coordinates
    for k in range(3):
        out[ys, xs, k] = np.clip(map_coordinates(tex[..., k].astype(np.float32), [U[:, 1] * S - 0.5, U[:, 0] * S - 0.5], order=1, mode='nearest'), 0, 255)
    return out
