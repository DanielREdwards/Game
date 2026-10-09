# Pontos anatômicos no modelo 3D (índices de vértice) para parear com marcações na ficha.
import numpy as np
from clothes import BELT_TOP, BELT_BOT


def find(V, used, cond, key):
    idx = np.where(cond & used)[0]
    return int(idx[np.argmax(key(V[idx]))])


def landmarks3d(m):
    V = m['V']
    used = np.zeros(len(V), bool)
    used[np.unique(m['F'][m['keep']])] = True
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    L = {}
    L['navel'] = 4120
    for s, sg in (('L', 1), ('R', -1)):
        L['nipple' + s] = 8451 if s == 'L' else 1779  # cauda do osso do peito (MakeHuman)
    mid = np.abs(x) < 0.004
    L['notch'] = find(V, used, mid & (z > 0.02) & (y > 1.42) & (y < 1.53), lambda P: -P[:, 2] - 0.3 * np.abs(P[:, 1] - 1.48))
    L['beltTopMid'] = find(V, used, mid & (z > 0.05), lambda P: -np.abs(P[:, 1] - (BELT_TOP - 0.002)))
    L['beltBotMid'] = find(V, used, mid & (z > 0.05), lambda P: -np.abs(P[:, 1] - (BELT_BOT + 0.002)))
    L['noseTip'] = find(V, used, mid & (y > 1.6), lambda P: P[:, 2])
    L['chin'] = find(V, used, mid & (y > 1.52) & (y < 1.66) & (z > 0.06), lambda P: -P[:, 1] + 0.5 * P[:, 2])
    back = np.abs(x) < 0.004
    L['c7'] = find(V, used, back & (z < -0.02) & (y > 1.44) & (y < 1.56), lambda P: -P[:, 2] - 2 * np.abs(P[:, 1] - 1.50))
    L['beltTopBack'] = find(V, used, back & (z < -0.05), lambda P: -np.abs(P[:, 1] - (BELT_TOP - 0.002)))
    L['beltBotBack'] = find(V, used, back & (z < -0.05), lambda P: -np.abs(P[:, 1] - (BELT_BOT + 0.002)))
    L['nape'] = find(V, used, back & (z < -0.02) & (y > 1.58) & (y < 1.66), lambda P: -np.abs(P[:, 1] - 1.62))
    L['crotch'] = find(V, used, mid & (y > 0.6) & (y < 0.95), lambda P: -P[:, 1] - 3 * np.abs(P[:, 2] - 0.0))
    return L


def project_lm(m, view_name, names=None):
    from views import VIEWS, cam_of, posed
    view = VIEWS[view_name]
    P, _ = posed(m, view)
    L = landmarks3d(m)
    cam = cam_of(view)
    names = names or list(L)
    xy, d = cam.project(P[[L[n] for n in names]])
    return dict(zip(names, xy.tolist()))


def ear_landmarks(m, side='R'):
    """Pontos da orelha: vértices laterais da cabeça na altura das orelhas."""
    V = m['V']
    used = np.zeros(len(V), bool)
    used[np.unique(m['F'])] = True
    sg = -1 if side == 'R' else 1
    sel = used & (V[:, 0] * sg > 0.07) & (V[:, 1] > 1.64) & (V[:, 1] < 1.775) & (V[:, 2] > -0.04) & (V[:, 2] < 0.05)
    ear = np.where(sel)[0]
    P = V[ear]
    top = ear[np.argmax(P[:, 1])]
    lobe = ear[np.argmin(P[:, 1])]
    back = ear[np.argmin(P[:, 2])]
    mid_y = (P[:, 1].max() + P[:, 1].min()) / 2
    band = np.abs(P[:, 1] - (mid_y - 0.004)) < 0.01
    tragus = ear[band][np.argmax(P[band, 2])]
    return dict(earTop=int(top), earLobe=int(lobe), earBack=int(back), tragus=int(tragus))


def pick(m, view_name, pts):
    """Vértices visíveis mais próximos de pontos (x, y) do render de uma vista."""
    from views import VIEWS, cam_of, posed
    from camera import tris_of, raster
    view = VIEWS[view_name]
    P, _ = posed(m, view)
    T = tris_of(m['F'][m['keep']])
    cam = cam_of(view)
    _, ids, xy, _ = raster(cam, P, T, shade=False)
    out = []
    for x, y in pts:
        t = ids[int(round(y)), int(round(x))]
        tri = T[t]
        d = np.linalg.norm(xy[tri] - np.array([x, y]), axis=1)
        out.append(int(tri[np.argmin(d)]))
    return out
