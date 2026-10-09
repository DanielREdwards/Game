# Tênis genérico de cano médio (sem marca): malha paramétrica + pintura procedural.
# Referencial local do tornozelo esquerdo: x para fora, y para cima (chão em y = -tornozelo), z para a frente.
import numpy as np, cv2

SOLE = 0.04
L0, L1 = -0.088, 0.226   # calcanhar e bico em z (relativos ao tornozelo)
NS, NT = 30, 22          # estações ao longo do pé e divisões da seção


def prof(s):
    hw = np.interp(s, [0, 0.05, 0.15, 0.3, 0.5, 0.68, 0.82, 0.92, 1.0], [0.034, 0.042, 0.046, 0.048, 0.053, 0.059, 0.057, 0.048, 0.03])
    ht = np.interp(s, [0, 0.08, 0.25, 0.42, 0.58, 0.72, 0.86, 0.95, 1.0], [0.128, 0.14, 0.136, 0.122, 0.104, 0.09, 0.078, 0.068, 0.056])
    return hw, ht


def end_k(s):
    a = np.clip((s - 0.78) / 0.22, 0, 1)
    b = np.clip((0.1 - s) / 0.1, 0, 1)
    return np.sqrt(max(0.0, 1 - a * a)) * np.sqrt(max(0.0, 1 - b * b)) ** 0.7


def superellipse(t, e=2.6):
    c, s = np.cos(t), np.sin(t)
    return np.sign(c) * np.abs(c) ** (2 / e), np.abs(s) ** (2 / e)


def build(ground_y, x_off=0.0):
    """Malha do tênis esquerdo no referencial do tornozelo. ground_y = altura do chão nesse referencial."""
    P, UV, T = [], [], []
    S = np.linspace(0, 1, NS)
    TH = np.linspace(0, np.pi, NT)
    base = ground_y + SOLE
    # cabedal
    for i, s in enumerate(S):
        hw, ht = prof(s)
        z = L0 + (L1 - L0) * s
        # fechamento arredondado nas pontas
        endk = end_k(s)
        for j, t in enumerate(TH):
            cx, sy = superellipse(t)
            x = x_off + cx * hw * endk
            y = base + sy * (ht - SOLE) * (0.35 + 0.65 * endk)
            zz = z
            P.append([x, y + ground_y * 0 - 0, zz])
            UV.append([s, t / np.pi])
    for i in range(NS - 1):
        for j in range(NT - 1):
            a = i * NT + j
            T += [(a, a + 1, a + NT), (a + 1, a + NT + 1, a + NT)]
    nU = len(P)
    # sola: contorno da base do cabedal ampliado, parede e fundo
    ring = []
    for i, s in enumerate(S):
        hw, _ = prof(s)
        z = L0 + (L1 - L0) * s
        ring.append((z, hw * end_k(s)))
    outline = [(x_off + w + 0.006, z) for z, w in ring] + [(x_off - w - 0.006, z) for z, w in ring[::-1]]
    outline = np.array(outline)
    # alongar bico e calcanhar da sola
    outline[:, 1] = np.where(outline[:, 1] > 0.1, outline[:, 1] + 0.006, np.where(outline[:, 1] < -0.06, outline[:, 1] - 0.005, outline[:, 1]))
    n = len(outline)
    per = np.r_[0, np.cumsum(np.linalg.norm(np.diff(np.r_[outline, outline[:1]], axis=0), axis=1))]
    per /= per[-1]
    levels = [(base + 0.002, 0.0), (base - 0.004, 0.18), (ground_y + 0.008, 0.82), (ground_y + 0.0, 1.0)]
    start = len(P)
    for li, (yy, v) in enumerate(levels):
        shrink = 0.004 if li == 3 else 0.0
        for k in range(n):
            x, z = outline[k]
            cx = x - x_off
            P.append([x_off + cx * (1 - shrink / max(abs(cx), 1e-3)) if abs(cx) > shrink else x, yy, z])
            UV.append([per[k], v])
    for li in range(len(levels) - 1):
        for k in range(n):
            a = start + li * n + k
            b = start + li * n + (k + 1) % n
            T += [(a, b, a + n), (b, b + n, a + n)]
    # fundo (leque a partir do centro)
    c = len(P)
    P.append([x_off, ground_y, (L0 + L1) / 2])
    UV.append([0.5, 1.0])
    last = start + (len(levels) - 1) * n
    for k in range(n):
        T.append((c, last + k, last + (k + 1) % n))
    P, UV, T = np.array(P), np.array(UV), np.array(T)
    part = np.zeros(len(P), int)
    part[nU:] = 1
    return P, UV, T, part


def paint(size=512):
    """Textura do tênis: metade de cima = cabedal (u = calcanhar->bico, v = lado de fora->topo->lado de dentro);
    metade de baixo = parede da sola (u = perímetro, v = topo->chão)."""
    W = size
    img = np.zeros((W, W, 3), np.float32)
    H = W // 2
    u = np.linspace(0, 1, W)[None, :].repeat(H, 0)
    v = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    light = np.array([0.84, 0.83, 0.80])
    black = np.array([0.045, 0.045, 0.05])
    up = np.ones((H, W, 3)) * light
    side = np.abs(v - 0.5) * 2          # 0 no topo, 1 junto da sola
    def put(mask, col):
        up[mask] = col
    # contraforte do calcanhar e colarinho
    put((u < 0.22) | ((u < 0.42) & (side < 0.35)), black)
    # biqueira: faixa preta em volta (lameira) e capa do bico
    put((u > 0.62) & (side > 0.72), black)
    # região dos cadarços (ilhós) preta
    put((u > 0.3) & (u < 0.74) & (side < 0.3), black)
    # faixa lateral genérica (reta, inclinada)
    band = (u > 0.36) & (u < 0.66) & (side > 0.35) & (side < 0.8) & (np.abs((u - 0.36) * 1.2 - (0.8 - side)) < 0.16)
    put(band, black)
    # cadarços: listras claras finas sobre a língua
    lace = (u > 0.32) & (u < 0.72) & (side < 0.22) & (np.sin(u * 110) > 0.55)
    up[lace] = np.array([0.08, 0.08, 0.09])
    # costuras e vincos: escurecimento leve
    noise = np.random.default_rng(3).normal(0, 0.02, (H, W, 1))
    up = up * (1 + noise)
    # brilho do couro preto (envernizado) fica no material; aqui só sujeira leve perto da sola
    up *= (1 - 0.12 * np.clip((side - 0.85) / 0.15, 0, 1))[..., None]
    img[:H] = up
    # sola: entressola clara com friso, solado escuro embaixo
    vs = np.linspace(0, 1, W - H)[:, None].repeat(W, 1)
    sole = np.ones((W - H, W, 3)) * np.array([0.88, 0.86, 0.82])
    sole[(vs > 0.38) & (vs < 0.42)] *= 0.82
    sole[vs > 0.78] = np.array([0.07, 0.07, 0.075])
    sole *= (1 + np.random.default_rng(4).normal(0, 0.015, (W - H, W, 1)))
    img[H:] = sole
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)
