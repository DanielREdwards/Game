# Ajusta a forma do rosto (alvos CC0 do MakeHuman) aos pontos faciais detectados na ficha (frente e perfil).
import paths
import os, json, pickle, numpy as np, cv2
from PIL import Image
from scipy.optimize import least_squares
from mhbase import load_target, MH
from model import get_model
from views import VIEWS, ref_crop, cam_of, root_of, posed
from camera import tris_of, raster
from mpface import landmarks

OUT = paths.OUT


SKIP = ('head/head-trans', 'head/head-angle', 'neck/', 'ears/', 'head/head-back', 'head/head-scale-vert', 'head/head-age')


def face_targets():
    names = [l.strip() for l in open(os.path.join(MH, 'face_targets.txt')) if l.strip()]
    names = [n for n in names if os.path.exists(os.path.join(MH, 'targets', n.replace('/', '_') + '.target'))]
    return [n for n in names if not n.startswith(SKIP)]


def groups_of(names):
    """Pares l-/r- viram uma variável só (rosto simétrico)."""
    G, seen = [], set()
    for n in names:
        if n in seen:
            continue
        g, t = n.split('/')
        if t.startswith('l-'):
            other = g + '/r-' + t[2:]
            G.append([n] + ([other] if other in names else []))
            seen.update(G[-1])
        elif t.startswith('r-'):
            other = g + '/l-' + t[2:]
            G.append(([other] if other in names else []) + [n])
            seen.update(G[-1])
        else:
            G.append([n])
            seen.add(n)
    return G


def bary_of(px, tri2d):
    a, b, c = tri2d
    v0, v1, v2 = b - a, c - a, px - a
    d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
    d20, d21 = v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return np.array([1 - v - w, v, w])


def correspond(view_name, V, m, side=None):
    """Detecta pontos no render do modelo e os prende à superfície (triângulo + baricêntricas)."""
    view = VIEWS[view_name]
    T = tris_of(m['F'][m['keep']])
    cam = cam_of(view)
    img, ids, xy, d = raster(cam, V, T, light=(0.3, 0.4, 0.85))
    rgb = np.ascontiguousarray(img[:, :, ::-1])
    Lr = landmarks(rgb, 'ren_' + view_name)
    Lf = landmarks(np.ascontiguousarray(ref_crop(view)), 'ref_' + view_name)
    out = []
    H, W = ids.shape
    for k, (x, y, _) in enumerate(Lr):
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < W and 0 <= yi < H) or ids[yi, xi] < 0:
            continue
        t = ids[yi, xi]
        b = bary_of(np.array([x, y]), xy[T[t]])
        if np.any(b < -0.2):
            continue
        out.append((k, T[t], np.clip(b, 0, 1) / np.clip(b, 0, 1).sum()))
    return out, Lf, Lr, cam


def fit(rebuild=False, lam=0.02):
    m = get_model()
    V0 = m['V']
    names = face_targets()
    s = m.get('mh_scale')
    if s is None:
        from rigfit import HEIGHT
        from mhbase import load_obj, apply_targets, macro_spec
        s = None
    # escala dm -> m: recupera pela razão entre as malhas (altura 1,80 m sobre a malha-base com alvos)
    s = m.get('scale', 0.1015)
    D = {}
    for n in names:
        i, d = load_target(n)
        D[n] = (i, d * s)
    views = {}
    # vistas: frente usa todos os pontos; perfil (lado direito) só os do lado visível
    Pf, _ = posed(m, VIEWS['face_f'])
    cf, Lf_ref, Lf_ren, camf = correspond('face_f', Pf, m)
    views['face_f'] = (cf, Lf_ref, camf)
    try:
        Pp, _ = posed(m, VIEWS['face_p'])
        cp, Lp_ref, Lp_ren, camp = correspond('face_p', Pp, m)
        mid = np.median(Lf_ref[:, 0])
        right_side = set(k for k in range(len(Lf_ref)) if Lf_ref[k, 0] < mid + 3)
        cp = [c for c in cp if c[0] in right_side]
        views['face_p'] = (cp, Lp_ref, camp)
    except TypeError:
        print('perfil: sem pontos no render (fica para depois da textura)')
    # matriz de deslocamento por ponto e alvo
    def lm_delta(corr):
        A = np.zeros((len(corr), len(G), 3))
        for li, (k, tri, b) in enumerate(corr):
            for n in names:
                idx, d = D[n]
                for vv, bb in zip(tri, b):
                    j = np.searchsorted(idx, vv)
                    if j < len(idx) and idx[j] == vv:
                        A[li, gi[n]] += bb * d[j]
        return A
    for n in names:  # índices ordenados para busca
        i, d = D[n]
        o = np.argsort(i)
        D[n] = (i[o], d[o])
    G = groups_of(names)
    gi = {n: k for k, g in enumerate(G) for n in g}
    data = {}
    for vn, (corr, Lref, cam) in views.items():
        P0 = np.array([sum(b[k] * V0[tri[k]] for k in range(3)) for _, tri, b in corr])
        A = lm_delta(corr)
        tgt = np.array([Lref[k, :2] for k, _, _ in corr])
        data[vn] = (P0, A, tgt, cam)
    nw = len(G)
    hc = m['rig']['head']['world'] + np.array([0, 0.06, 0.03])
    from rigfit import rot_axis

    def resid(x):
        w = x[:nw]
        r = []
        off = nw
        for vn, (P0, A, tgt, cam) in data.items():
            sc, rot, tx, ty, yw, pt = x[off:off + 6]
            off += 6
            P = P0 + np.einsum('lnc,n->lc', A, w)
            Rh = rot_axis([0, 1, 0], yw) @ rot_axis([1, 0, 0], pt)
            P = (P - hc) @ Rh.T + hc
            # pose de cabeça já aplicada no render; o deslocamento de alvo é na pose de ligação (cabeça parada)
            xy, _ = cam.project(P)
            c = np.array(cam.size) / 2
            q = xy - c
            cr, sr = np.cos(rot), np.sin(rot)
            q = np.stack([cr * q[:, 0] - sr * q[:, 1], sr * q[:, 0] + cr * q[:, 1]], 1) * sc + c + np.array([tx, ty])
            r.append((q - tgt).ravel())
        r.append(np.sqrt(lam) * w * 40)
        return np.concatenate(r)
    x0 = np.r_[np.zeros(nw), [1, 0, 0, 0, 0, 0] * len(data)]
    lb = np.r_[np.zeros(nw), [0.7, -0.3, -60, -60, -0.35, -0.35] * len(data)]
    ub = np.r_[np.ones(nw) * 0.8, [1.4, 0.3, 60, 60, 0.35, 0.35] * len(data)]
    r0 = resid(x0)
    sol = least_squares(resid, x0, bounds=(lb, ub), max_nfev=200, verbose=0)
    w = sol.x[:nw]
    def err(x):
        r = resid(x)[:-nw]
        return np.sqrt(np.mean(r.reshape(-1, 2) ** 2, 0).sum())
    print('erro rms (px): antes %.2f  depois %.2f' % (err(np.r_[np.zeros(nw), sol.x[nw:]]), err(sol.x)))
    print('câmera/cabeça por vista:', np.round(sol.x[nw:], 3))
    chosen = [(n, float(v)) for g, v in zip(G, w) for n in g if v > 0.03]
    chosen.sort(key=lambda t: -t[1])
    for n, v in chosen:
        print('%-40s %.2f' % (n, v))
    json.dump(chosen, open(os.path.join(paths.DATA, 'face_fit.json'), 'w'), indent=1)
    return chosen, sol


if __name__ == '__main__':
    fit()
