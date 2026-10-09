# Olhos, corrente com placa, brincos de argola e fivela do cinto (peças rígidas presas a ossos do jogo).
import numpy as np, cv2
from scipy.spatial import cKDTree


def sphere(r, nu=28, nv=18):
    P, UV, N = [], [], []
    for i in range(nv + 1):
        th = np.pi * i / nv          # 0 = frente (+z), pi = trás
        for j in range(nu + 1):
            ph = 2 * np.pi * j / nu
            d = np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)])
            P.append(d * r)
            N.append(d)
            # mapa "de frente": a íris fica no centro da textura
            rr = 0.5 * th / np.pi
            UV.append([0.5 + rr * np.cos(ph), 0.5 - rr * np.sin(ph)])
    T = []
    for i in range(nv):
        for j in range(nu):
            a = i * (nu + 1) + j
            b = a + nu + 1
            T += [(a, b, a + 1), (a + 1, b, b + 1)]
    return np.array(P), np.array(N), np.array(UV), np.array(T)


def eye_texture(size=256, iris=(0.13, 0.085, 0.06), seed=2):
    """Íris castanho-escura com fibras radiais, pupila, anel límbico e esclera levemente rosada nas bordas."""
    rng = np.random.default_rng(seed)
    S = size
    yy, xx = np.mgrid[0:S, 0:S]
    u = (xx + 0.5) / S - 0.5
    v = (yy + 0.5) / S - 0.5
    r = np.sqrt(u * u + v * v) * 2  # 0 no centro (frente), 1 na borda (trás)
    th = np.arctan2(v, u)
    img = np.zeros((S, S, 3), np.float32)
    scl = np.array([0.86, 0.82, 0.78])
    edge = np.array([0.72, 0.58, 0.55])
    k = np.clip((r - 0.25) / 0.5, 0, 1)[..., None]
    img[:] = scl * (1 - k) + edge * k
    R_IRIS = 0.205  # raio angular relativo da íris
    fib = 0.5 + 0.5 * np.sin(th * 46 + rng.uniform(0, 6) + np.sin(th * 7) * 2) * np.sin(th * 23 + 1.3)
    t = np.clip(r / R_IRIS, 0, 1)
    ir = np.array(iris) * (0.75 + 0.5 * fib[..., None] * (0.4 + 0.6 * t[..., None]))
    ir = ir * (1 - 0.45 * t[..., None] ** 6)  # anel límbico escuro
    inside = r < R_IRIS
    img[inside] = ir[inside]
    pup = r < 0.075
    img[pup] = np.array([0.015, 0.012, 0.012])
    # suavização da borda da íris
    img = cv2.GaussianBlur(img, (0, 0), 0.8)
    # veias finas
    for _ in range(14):
        a0 = rng.uniform(0, 6.28)
        pts = [(0.5 + np.cos(a0) * rad * 0.5, 0.5 + np.sin(a0) * rad * 0.5) for rad in np.linspace(0.95, 0.45, 8)]
        pts = (np.array(pts) * S + rng.normal(0, 2, (8, 2))).astype(np.int32)
        cv2.polylines(img, [pts], False, (0.65, 0.35, 0.33), 1, lineType=cv2.LINE_AA)
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def tube(path, radius, sides=8, closed=False, wobble=0.0):
    n = len(path)
    P, N, UV, T = [], [], [], []
    for i in range(n):
        t = path[(i + 1) % n] - path[i - 1] if closed else path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        t /= np.linalg.norm(t) + 1e-12
        a = np.cross(t, [0, 1, 0])
        if np.linalg.norm(a) < 1e-6:
            a = np.cross(t, [1, 0, 0])
        a /= np.linalg.norm(a)
        b = np.cross(t, a)
        rr = radius * (1 + wobble * np.cos(i * 2.2))
        for j in range(sides + 1):
            ang = 2 * np.pi * j / sides + (i * 0.9 if wobble else 0)
            d = a * np.cos(ang) + b * np.sin(ang)
            P.append(path[i] + d * rr)
            N.append(d)
            UV.append([i / (n - 1), j / sides])
    rows = n if closed else n - 1
    for i in range(rows):
        i2 = (i + 1) % n
        for j in range(sides):
            a0 = i * (sides + 1) + j
            b0 = i2 * (sides + 1) + j
            T += [(a0, b0, a0 + 1), (a0 + 1, b0, b0 + 1)]
    return np.array(P), np.array(N), np.array(UV), np.array(T)


def on_surface(V, Vn, pts, off):
    tree = cKDTree(V)
    out = []
    for p in pts:
        d, i = tree.query(p, k=6)
        q = V[i].mean(0)
        n = Vn[i].mean(0)
        n /= np.linalg.norm(n)
        out.append(q + n * off)
    return np.array(out)


def catmull(pts, k=10, closed=False):
    P = np.asarray(pts, float)
    n = len(P)
    out = []
    rng_ = range(n) if closed else range(n - 1)
    for i in rng_:
        p0, p1, p2, p3 = P[(i - 1) % n if closed else max(i - 1, 0)], P[i], P[(i + 1) % n], P[(i + 2) % n if closed else min(i + 2, n - 1)]
        for t in np.linspace(0, 1, k, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(P[-1])
    return np.array(out)


def rounded_box(w, h, d, r=0.002, seg=3):
    """Placa (pingente) com cantos arredondados no plano xy e espessura d."""
    outline = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(seg + 1):
            a = np.radians(a0 + 90 * k / seg)
            outline.append((cx + r * np.cos(a), cy + r * np.sin(a)))
    outline = np.array(outline)
    m = len(outline)
    P, N, UV, T = [], [], [], []
    for zf, nz in ((d / 2, 1), (-d / 2, -1)):
        c = len(P)
        P.append([0, 0, zf]); N.append([0, 0, nz]); UV.append([0.5, 0.5])
        for x, y in outline:
            P.append([x, y, zf]); N.append([0, 0, nz]); UV.append([0.5 + x / w, 0.5 - y / h])
        for k in range(m):
            a, b = c + 1 + k, c + 1 + (k + 1) % m
            T.append((c, a, b) if nz > 0 else (c, b, a))
    base = len(P)
    for x, y in outline:
        nn = np.array([x, y, 0.0]); nn /= np.linalg.norm(nn) + 1e-9
        P += [[x, y, d / 2], [x, y, -d / 2]]
        N += [nn, nn]
        UV += [[0, 0], [0, 1]]
    for k in range(m):
        a, b = base + 2 * k, base + 2 * ((k + 1) % m)
        T += [(a, a + 1, b), (b, a + 1, b + 1)]
    return np.array(P, float), np.array(N, float), np.array(UV, float), np.array(T)


def tag_texture(size=128):
    """Placa: metal escovado com borda e gravação genérica (padrão geométrico, sem marca)."""
    S = size
    img = np.full((S * 2, S, 3), 200, np.float32)
    rng = np.random.default_rng(4)
    img += rng.normal(0, 6, (S * 2, 1, 1))
    cv2.rectangle(img, (8, 8), (S - 9, S * 2 - 9), (110, 110, 112), 3)
    for y in range(28, S * 2 - 28, 22):
        cv2.line(img, (24, y), (S - 25, y), (125, 125, 128), 2)
        cv2.circle(img, (S // 2, y + 11), 4, (120, 120, 122), 1)
    return np.clip(img, 0, 255).astype(np.uint8)
