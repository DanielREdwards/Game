# Ajusta câmera e pose de uma vista para casar os pontos do modelo com os da ficha (antes da deformação fina).
import paths
import os, json, sys, numpy as np
from scipy.optimize import least_squares
from model import get_model, pose_mesh
from views import VIEWS, cam_of, root_of
from camera import raster, tris_of, Cam
from uvmap import triangulate

OUT = paths.OUT
POSE_KEYS = [('lSh', 0), ('lSh', 2), ('lEl', 0), ('rSh', 0), ('rSh', 2), ('rEl', 0), ('lHip', 2), ('rHip', 2), ('lHip', 0), ('rHip', 0), ('neck', 1), ('head', 0)]


def lift(m, view, src):
    """Pontos 2D do render -> (triângulo, baricêntricas) na malha posada."""
    P, _ = pose_mesh(m, view['pose'], root=root_of(view))
    T = tris_of(m['F'][m['keep']])
    cam = cam_of(view)
    _, ids, xy, _ = raster(cam, P, T, shade=False)
    H, W = ids.shape
    out = []
    for k, (x, y) in enumerate(src):
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < W and 0 <= yi < H) or ids[yi, xi] < 0:
            out.append(None)
            continue
        t = T[ids[yi, xi]]
        a, b, c = xy[t]
        v0, v1, v2 = b - a, c - a, np.array([x, y]) - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        l1 = (v2[0] * v1[1] - v1[0] * v2[1]) / den
        l2 = (v0[0] * v2[1] - v2[0] * v0[1]) / den
        out.append((t, np.array([1 - l1 - l2, l1, l2])))
    return out, T


def fit_view(name, src, dst, pose_too=True, iters=1):
    m = get_model()
    view = dict(VIEWS[name])
    view['pose'] = {k: list(v) for k, v in view['pose'].items()}
    L, T = lift(m, view, src)
    ok = [i for i, l in enumerate(L) if l is not None]
    dst = np.asarray(dst)[ok]
    L = [L[i] for i in ok]
    keys = POSE_KEYS if pose_too else []
    base = dict(view)

    def unpack(x):
        v = dict(base)
        v['pitch'], v['dist'], v['fov'], ty, sx, sy, v['root_yaw'], v['yaw'] = x[:8]
        v['target'] = (base['target'][0], ty, base['target'][2])
        v['shift'] = (sx, sy)
        p = {k: list(vv) for k, vv in base['pose'].items()}
        for (j, a), val in zip(keys, x[8:]):
            p.setdefault(j, [0.0, 0.0, 0.0])
            p[j][a] = val
        v['pose'] = p
        return v

    def resid(x):
        v = unpack(x)
        P, _ = pose_mesh(m, v['pose'], root=root_of(v))
        cam = cam_of(v)
        pts = np.array([(P[t] * b[:, None]).sum(0) for t, b in L])
        xy, _ = cam.project(pts)
        prior = [(x[8 + i] - x0[8 + i]) * 30 for i in range(len(keys))]
        return np.r_[(xy - dst).ravel(), prior, (x[1] - x0[1]) * 2]
    x0 = np.array([base['pitch'], base['dist'], base['fov'], base['target'][1], base['shift'][0], base['shift'][1], base.get('root_yaw', 0.0), base['yaw']] +
                  [base['pose'].get(j, [0, 0, 0])[a] for j, a in keys], float)
    lb = x0 - np.r_[[0.4, 3, 12, 0.4, 80, 80, 0.4, 0.25], [0.6] * len(keys)]
    ub = x0 + np.r_[[0.4, 3, 12, 0.4, 80, 80, 0.4, 0.25], [0.6] * len(keys)]
    lb[1] = max(lb[1], 0.4)
    r0 = resid(x0)
    sol = least_squares(resid, x0, bounds=(lb, ub), max_nfev=150)
    e0 = np.sqrt(np.mean(r0[:2 * len(L)] ** 2))
    e1 = np.sqrt(np.mean(sol.fun[:2 * len(L)] ** 2))
    v = unpack(sol.x)
    print(f'{name}: erro rms {e0:.1f} -> {e1:.1f} px')
    vf = os.path.join(paths.DATA, 'views_fit.json')
    fits = json.load(open(vf)) if os.path.exists(vf) else {}
    fits[name] = dict(pitch=v['pitch'], dist=v['dist'], fov=v['fov'], target=list(v['target']), shift=list(v['shift']), root_yaw=v['root_yaw'], yaw=v['yaw'], pose=v['pose'])
    json.dump(fits, open(vf, 'w'), indent=1)
    return v
