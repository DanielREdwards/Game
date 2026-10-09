# Prévia rápida (algoritmo do pintor + sombreamento plano) para iterar a forma sem o navegador.
import numpy as np, cv2


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def render(V, F, yaw=0.0, size=(520, 900), center=None, scale=None, color=(0.78, 0.62, 0.5), light=(0.4, 0.6, 0.7), fcolors=None):
    W, H = size
    P = V @ rot_y(yaw).T
    if center is None:
        lo, hi = V.min(0), V.max(0)
        center = (lo + hi) / 2
        scale = 0.92 * H / (hi[1] - lo[1])
    c = rot_y(yaw) @ center
    x = (P[:, 0] - c[0]) * scale + W / 2
    y = H / 2 - (P[:, 1] - c[1]) * scale
    z = P[:, 2]
    tris = []
    for f in F:
        if len(f) == 4:
            tris += [(f[0], f[1], f[2]), (f[0], f[2], f[3])]
        else:
            tris.append(tuple(f))
    T = np.array(tris)
    a, b, cc = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    n = np.cross(b - a, cc - a)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    L = np.array(light) / np.linalg.norm(light)
    shade = 0.25 + 0.75 * np.clip(n @ L, 0, 1)
    vis = n[:, 2] > 0
    depth = (z[T[:, 0]] + z[T[:, 1]] + z[T[:, 2]]) / 3
    order = np.argsort(depth)
    img = np.full((H, W, 3), 40, np.uint8)
    fc = np.array(color)
    for i in order:
        if not vis[i]:
            continue
        pts = np.array([[x[k], y[k]] for k in T[i]], np.float32)
        col = (fcolors[i // 2 if len(F[0]) == 4 else i] if fcolors is not None else fc) * shade[i]
        cv2.fillConvexPoly(img, np.round(pts * 4).astype(np.int32), tuple(int(255 * v) for v in col[::-1]), lineType=cv2.LINE_AA, shift=2)
    return img


def grid(imgs, cols):
    rows = [np.hstack(imgs[i:i + cols]) for i in range(0, len(imgs), cols)]
    w = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 0), (0, w - r.shape[1]), (0, 0))) for r in rows]
    return np.vstack(rows)


def look_basis(view_dir, up=(0, 1, 0)):
    """Base da câmera: z aponta para o observador (oposto à direção de visão)."""
    z = -np.asarray(view_dir, float)
    z /= np.linalg.norm(z)
    x = np.cross(up, z)
    if np.linalg.norm(x) < 1e-6:
        x = np.cross((0, 0, 1), z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    return np.stack([x, y, z])


def render_dir(V, F, view_dir, center, scale, size=(320, 320), up=(0, 1, 0), color=(0.78, 0.62, 0.5), fcolors=None):
    Rm = look_basis(view_dir, up)
    P = (V - center) @ Rm.T
    W, H = size
    x = P[:, 0] * scale + W / 2
    y = H / 2 - P[:, 1] * scale
    z = P[:, 2]
    T = []
    src = []
    for i, f in enumerate(F):
        if len(f) == 4:
            T += [(f[0], f[1], f[2]), (f[0], f[2], f[3])]
            src += [i, i]
        else:
            T.append(tuple(f))
            src.append(i)
    T = np.array(T)
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    L = np.array([0.35, 0.6, 0.72])
    shade = 0.25 + 0.75 * np.clip(n @ (L / np.linalg.norm(L)), 0, 1)
    depth = (z[T[:, 0]] + z[T[:, 1]] + z[T[:, 2]]) / 3
    img = np.full((H, W, 3), 40, np.uint8)
    for i in np.argsort(depth):
        if n[i, 2] <= 0:
            continue
        pts = np.array([[x[k], y[k]] for k in T[i]], np.float32)
        col = (np.array(fcolors[src[i]]) if fcolors is not None else np.array(color)) * shade[i]
        cv2.fillConvexPoly(img, np.round(pts * 4).astype(np.int32), tuple(int(255 * v) for v in col[::-1]), lineType=cv2.LINE_AA, shift=2)
    return img
