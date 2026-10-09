# Cabelo em mechas (cartões com transparência): topo texturizado e bagunçado, franja sobre a testa,
# laterais e nuca curtas (o degradê fica pintado no couro cabeludo pela projeção da ficha).
import numpy as np, cv2


def scalp_samples(V, F, N, rng, n, zone):
    """Pontos na superfície da cabeça, ponderados por área, dentro de uma zona."""
    P = V[F]
    tris = np.concatenate([P[:, [0, 1, 2]], P[:, [0, 2, 3]]])
    ntri = np.concatenate([N[F][:, [0, 1, 2]], N[F][:, [0, 2, 3]]])
    c = tris.mean(1)
    ok = zone(c)
    tris, ntri = tris[ok], ntri[ok]
    area = 0.5 * np.linalg.norm(np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]), axis=1)
    pick = rng.choice(len(tris), n, p=area / area.sum())
    r1, r2 = rng.random(n), rng.random(n)
    s = np.sqrt(r1)
    b = np.stack([1 - s, s * (1 - r2), s * r2], 1)
    p = (tris[pick] * b[..., None]).sum(1)
    nn = (ntri[pick] * b[..., None]).sum(1)
    return p, nn / np.linalg.norm(nn, axis=1, keepdims=True)


def strand(p, n, d, length, segs, rng, grav=0.0, lift=0.3, curl=0.0, hug=0.85):
    """Fio que acompanha o couro cabeludo (tangente) com leve afastamento (volume) e queda."""
    pts = [p + n * 0.0015]
    t = d - n * np.dot(d, n)
    t /= np.linalg.norm(t) + 1e-9
    dirv = t + n * lift
    dirv /= np.linalg.norm(dirv)
    step = length / segs
    side = np.cross(dirv, n)
    side /= np.linalg.norm(side) + 1e-9
    for i in range(segs):
        # puxa de volta para a superfície (a cabeça é redonda) e aplica gravidade
        dirv = dirv - n * (lift * 0.35 * hug) + np.array([0, -grav, 0]) + side * curl * (rng.random() - 0.5)
        dirv /= np.linalg.norm(dirv)
        pts.append(pts[-1] + dirv * step)
    return np.array(pts)


def ribbon(pts, n_root, width, twist, variant, nvar):
    """Fita ao longo do fio; normal aproximada da do couro cabeludo (girada por 'twist')."""
    m = len(pts)
    P, UV = [], []
    for i in range(m):
        t = pts[min(i + 1, m - 1)] - pts[max(i - 1, 0)]
        t /= np.linalg.norm(t) + 1e-9
        lat = np.cross(t, n_root)
        if np.linalg.norm(lat) < 1e-6:
            lat = np.cross(t, [0, 1, 0])
        lat /= np.linalg.norm(lat)
        up = np.cross(lat, t)
        c, s = np.cos(twist), np.sin(twist)
        lat = lat * c + up * s
        w = width * (1 - 0.55 * i / (m - 1))
        for k, sg in enumerate((-0.5, 0.5)):
            P.append(pts[i] + lat * w * sg)
            UV.append([(variant + (k * 0.96 + 0.02)) / nvar, i / (m - 1)])
    T = []
    for i in range(m - 1):
        a = i * 2
        T += [(a, a + 1, a + 2), (a + 1, a + 3, a + 2)]
    return np.array(P), np.array(UV), np.array(T)


def build(V, F, N, head_c, seed=11):
    """V, F: malha (faces da cabeça), N normais por vértice. Devolve P, UV, T."""
    rng = np.random.default_rng(seed)
    allP, allUV, allT = [], [], []
    off = 0
    NV = 4

    def add(pts, n, width, twist):
        nonlocal off
        P, UV, T = ribbon(pts, n, width, twist, int(rng.integers(NV)), NV)
        allP.append(P)
        allUV.append(UV)
        allT.append(T + off)
        off += len(P)

    # camada de base: curta e rente, cobre o couro cabeludo do topo
    def cap(c):
        return (c[:, 1] > 1.745) & (np.abs(c[:, 0]) < 0.075) & (c[:, 2] < 0.11) & (c[:, 2] > -0.095)
    p, n = scalp_samples(V, F, N, rng, 260, cap)
    for pi, ni in zip(p, n):
        d = np.array([rng.normal(0, 0.3), 0.0, 1.0]) if pi[2] > -0.04 else np.array([rng.normal(0, 0.3), -0.6, -0.6])
        pts = strand(pi, ni, d, rng.uniform(0.035, 0.05), 4, rng, grav=0.01, lift=0.12, curl=0.2)
        add(pts, ni, rng.uniform(0.016, 0.026), rng.normal(0, 0.2))
    # topo texturizado: mechas para a frente com volume
    def top(c):
        return (c[:, 1] > 1.77) & (np.abs(c[:, 0]) < 0.06) & (c[:, 2] < 0.09) & (c[:, 2] > -0.07)
    p, n = scalp_samples(V, F, N, rng, 300, top)
    for pi, ni in zip(p, n):
        front = np.clip((pi[2] + 0.03) / 0.12, 0, 1)
        d = np.array([rng.normal(0, 0.35), 0.1, 1.0])
        L = rng.uniform(0.05, 0.08)
        pts = strand(pi, ni, d, L, 5, rng, grav=0.015 + 0.05 * front ** 2, lift=rng.uniform(0.35, 0.75), curl=0.55)
        add(pts, ni, rng.uniform(0.01, 0.019), rng.normal(0, 0.45))
    # franja: mechas que caem sobre a testa
    def fringe(c):
        return (c[:, 1] > 1.76) & (np.abs(c[:, 0]) < 0.05) & (c[:, 2] > 0.07)
    p, n = scalp_samples(V, F, N, rng, 45, fringe)
    for pi, ni in zip(p, n):
        d = np.array([rng.normal(0, 0.4), -0.3, 1.0])
        pts = strand(pi, ni, d, rng.uniform(0.05, 0.08), 6, rng, grav=0.12, lift=0.22, curl=0.5)
        add(pts, ni, rng.uniform(0.007, 0.013), rng.normal(0, 0.3))
    # transição das laterais e da nuca: curtas e deitadas (o degradê é pintado)
    def sides(c):
        r = (c[:, 1] > 1.725) & (c[:, 1] < 1.775) & (np.abs(c[:, 0]) > 0.05) & (c[:, 2] < 0.085) & (c[:, 2] > -0.06)
        b = (c[:, 2] < -0.05) & (c[:, 1] > 1.69) & (c[:, 1] < 1.765)
        return r | b
    p, n = scalp_samples(V, F, N, rng, 170, sides)
    for pi, ni in zip(p, n):
        d = np.array([0, -1.0, 0.25 if pi[2] > 0 else -0.25])
        pts = strand(pi, ni, d, rng.uniform(0.014, 0.026), 3, rng, grav=0.02, lift=0.08, curl=0.15)
        add(pts, ni, rng.uniform(0.012, 0.02), rng.normal(0, 0.15))
    return np.concatenate(allP), np.concatenate(allUV), np.concatenate(allT)


def texture(size=512, nvar=4, seed=5):
    """RGBA: colunas com feixes de fios (variações), transparente entre fios e nas pontas."""
    rng = np.random.default_rng(seed)
    W = size
    col = np.zeros((W, W, 3), np.float32)
    alpha = np.zeros((W, W), np.float32)
    cw = W // nvar
    for v in range(nvar):
        x0 = v * cw
        layer = np.zeros((W * 2, cw * 2), np.float32)
        tone = np.zeros((W * 2, cw * 2), np.float32)
        nfib = 26 + v * 8
        for _ in range(nfib):
            xs = rng.uniform(0.08, 0.92) * cw * 2
            ln = rng.uniform(0.55, 1.0) * W * 2
            amp = rng.uniform(2, 9)
            ph = rng.uniform(0, 6.28)
            th = int(rng.integers(3, 6))
            pts = []
            for yy in np.linspace(0, ln, 40):
                xx = xs + np.sin(yy / (W * 2) * 6.28 * rng.uniform(0.6, 1.4) + ph) * amp + (yy / (W * 2)) * rng.normal(0, 14)
                pts.append([xx, yy])
            pts = np.array(pts, np.int32)
            shade = rng.uniform(0.0, 1.0) ** 3
            cv2.polylines(layer, [pts], False, 1.0, int(th), lineType=cv2.LINE_AA)
            cv2.polylines(tone, [pts], False, float(shade), int(th), lineType=cv2.LINE_AA)
        layer = cv2.resize(layer, (cw, W), interpolation=cv2.INTER_AREA)
        tone = cv2.resize(tone, (cw, W), interpolation=cv2.INTER_AREA)
        a = np.clip(layer * 1.35, 0, 1)
        # afinamento nas pontas (v -> 1)
        yy = np.linspace(0, 1, W)[:, None]
        a *= np.clip(1.25 - yy ** 1.5, 0, 1)
        alpha[:, x0:x0 + cw] = a
        base = np.array([0.018, 0.016, 0.017])
        hi = np.array([0.12, 0.11, 0.115])
        t = np.clip(tone / np.maximum(layer, 1e-3), 0, 1)[..., None]
        col[:, x0:x0 + cw] = base * (1 - t) + hi * t
    rgba = np.dstack([np.clip(col * 255 * 1.0, 0, 255), alpha * 255]).astype(np.uint8)
    return rgba
