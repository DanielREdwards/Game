# Ajusta a base CC0 ao Wei Leo: forma, escala (m), punhos fechados, esqueleto do jogo e pesos.
import paths
import os, json
import numpy as np
from mhbase import load_target,  load_obj, apply_targets, macro_spec, skeleton, joint_positions, weights, body_faces

HEIGHT = 1.80      # altura descalço (m)
FACE_FIT = not os.environ.get('NO_FACE_FIT')  # aplica data/face_fit.json (rosto ajustado aos pontos da ficha)
SOLE_T = 0.028     # espessura da sola do tênis (m)

SHAPE = dict(muscle=1.0, weight=0.45, height=0.6, proportions=1.0)
EXTRA = [
    ('torso/torso-vshape-incr', 0.6), ('torso/torso-muscle-pectoral-incr', 0.6), ('torso/torso-muscle-dorsi-incr', 0.4),
    ('armslegs/l-upperarm-muscle-incr', 0.6), ('armslegs/r-upperarm-muscle-incr', 0.6),
    ('armslegs/l-upperarm-shoulder-muscle-incr', 0.6), ('armslegs/r-upperarm-shoulder-muscle-incr', 0.6),
    ('armslegs/l-lowerarm-muscle-incr', 0.5), ('armslegs/r-lowerarm-muscle-incr', 0.5),
    ('neck/neck-scale-horiz-incr', 0.35), ('stomach/stomach-pregnant-decr', 0.3), ('hip/hip-scale-horiz-decr', 0.15),
    # rosto: mandíbula marcada, maçãs altas, face em V, sobrancelhas baixas
    ('chin/chin-prominent-incr', 0.35), ('chin/chin-bones-incr', 0.5), ('head/head-fat-decr', 0.5),
    ('l-cheek-bones', 0), ('cheek/l-cheek-bones-incr', 0.5), ('cheek/r-cheek-bones-incr', 0.5),
    ('cheek/l-cheek-volume-decr', 0.4), ('cheek/r-cheek-volume-decr', 0.4), ('head/head-invertedtriangular', 0.3),
    ('eyebrows/eyebrows-trans-down', 0.3), ('nose/nose-scale-vert-incr', 0.2),
]

# ossos do MakeHuman -> ossos do jogo (pesos somados); listas = divisão entre dois ossos
GAME_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKn', 'lAnk', 'rHip', 'rKn', 'rAnk']


def game_bone_of(mh):
    s = 'l' if mh.endswith('.L') else 'r' if mh.endswith('.R') else ''
    b = mh[:-2] if s else mh
    if b in ('root', 'spine05', 'pelvis'):
        return 'hips'
    if b in ('spine04', 'spine03'):
        return 'spine'
    if b in ('spine02', 'spine01', 'breast', 'clavicle'):
        return 'chest'
    if b == 'shoulder01':
        return [('chest', 0.45), (s + 'Sh', 0.55)]
    if b.startswith('upperarm'):
        return s + 'Sh'
    if b.startswith(('lowerarm', 'wrist', 'metacarpal', 'finger')):
        return s + 'El'
    if b.startswith('neck'):
        return 'neck'
    if b.startswith('upperleg'):
        return s + 'Hip'
    if b.startswith('lowerleg'):
        return s + 'Kn'
    if b.startswith(('foot', 'toe')):
        return s + 'Ank'
    return 'head'  # cabeça, mandíbula, olhos, língua e ossos faciais


def rot_axis(axis, ang):
    a = np.asarray(axis, float)
    a = a / np.linalg.norm(a)
    x, y, z = a
    c, s, C = np.cos(ang), np.sin(ang), 1 - np.cos(ang)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def swing(a, b):
    """Rotação mínima que leva o vetor a ao vetor b."""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = np.dot(a, b)
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else rot_axis([1, 0, 0], np.pi)
    return rot_axis(v, np.arctan2(np.linalg.norm(v), c))


def euler_xyz(m):
    """Matriz -> ângulos de Euler na ordem XYZ do three.js."""
    y = np.arcsin(np.clip(m[0, 2], -1, 1))
    if abs(m[0, 2]) < 0.9999999:
        x = np.arctan2(-m[1, 2], m[2, 2])
        z = np.arctan2(-m[0, 1], m[0, 0])
    else:
        x = np.arctan2(m[2, 1], m[1, 1])
        z = 0.0
    return np.array([x, y, z])


def mat_euler(e):
    x, y, z = e
    Rx = rot_axis([1, 0, 0], x)
    Ry = rot_axis([0, 1, 0], y)
    Rz = rot_axis([0, 0, 1], z)
    return Rx @ Ry @ Rz  # ordem 'XYZ' do three.js


def mh_lbs(V, W, mats):
    """Pele linear com o esqueleto do MakeHuman: mats = {osso: matriz 4x4 (mundo)}."""
    out = np.zeros_like(V)
    acc = np.zeros(len(V))
    Vh = np.c_[V, np.ones(len(V))]
    for b, lst in W.items():
        M = mats.get(b)
        if M is None:
            continue
        idx = np.array([i for i, _ in lst])
        w = np.array([w for _, w in lst])
        out[idx] += (Vh[idx] @ M.T)[:, :3] * w[:, None]
        acc[idx] += w
    moved = acc > 0
    res = V.copy()
    res[moved] = out[moved] / acc[moved][:, None]
    return res


def T(p):
    m = np.eye(4)
    m[:3, 3] = p
    return m


def R4(r):
    m = np.eye(4)
    m[:3, :3] = r
    return m


def build():
    obj = load_obj()
    sk = skeleton()
    Wmh = weights()
    V = apply_targets(obj['V'], macro_spec(**SHAPE) + [e for e in EXTRA if e[1]])
    F, FT = body_faces(obj)
    used = np.unique(F)
    # escala para metros e chão (pé descalço sobre a sola do tênis)
    lo, hi = V[used].min(0), V[used].max(0)
    s = HEIGHT / (hi[1] - lo[1])
    V = (V - np.array([0, lo[1], 0])) * s + np.array([0, SOLE_T, 0])
    # rosto ajustado aos pontos da ficha (facefit.py), aplicado já em metros
    ff = os.path.join(paths.DATA, 'face_fit.json')
    if FACE_FIT and os.path.exists(ff):
        for name, wv in json.load(open(ff)):
            i, d = load_target(name)
            V[i] += d * s * wv
    J = joint_positions(V, sk)
    bones = {n: dict(head=J[b['head']], tail=J[b['tail']], parent=b['parent']) for n, b in sk['bones'].items()}
    V = make_fists(V, bones, Wmh)
    J = joint_positions(V, sk)
    bones = {n: dict(head=J[b['head']], tail=J[b['tail']], parent=b['parent']) for n, b in sk['bones'].items()}
    return dict(obj=obj, V=V, F=F, FT=FT, VT=obj['VT'], bones=bones, Wmh=Wmh, scale=s)


def chain_mats(bones, local):
    """local: {osso: matriz 3x3 girando em torno da cabeça do osso}. Devolve matrizes de mundo 4x4."""
    out = {}

    def get(n):
        if n in out:
            return out[n]
        b = bones[n]
        P = get(b['parent']) if b['parent'] else np.eye(4)
        r = local.get(n)
        M = P if r is None else P @ T(b['head']) @ R4(r) @ T(-b['head'])
        out[n] = M
        return M
    for n in bones:
        get(n)
    return out


def hand_frame(bones, s):
    """Eixos da mão: dedo (punho->nós dos dedos), lateral (mínimo->indicador) e palma."""
    wr = bones['wrist' + s]['head']
    k2, k5 = bones['finger2-1' + s]['head'], bones['finger5-1' + s]['head']
    fing = (k2 + k5) / 2 - wr
    fing /= np.linalg.norm(fing)
    lat = k2 - k5
    lat -= fing * np.dot(lat, fing)
    lat /= np.linalg.norm(lat)
    palm = np.cross(fing, lat) * (1 if s == '.L' else -1)
    return fing, lat, palm


def make_fists(V, bones, Wmh):
    """Fecha as mãos em punho (pose cozida na malha de ligação)."""
    local = {}
    for s in ('.L', '.R'):
        fing, lat, palm = hand_frame(bones, s)
        # palma: o sentido que faz os dedos dobrarem para dentro (verificado pelas pontas)
        for f in range(2, 6):
            ang = [1.45, 1.75, 1.15]
            for k in range(3):
                n = f'finger{f}-{k + 1}{s}'
                d = bones[n]['tail'] - bones[n]['head']
                ax = np.cross(d, palm)
                local[n] = rot_axis(ax, ang[k])
    mats = chain_mats(bones, local)
    # polegar: deita sobre as falanges médias do indicador e do médio (otimização simples)
    from scipy.optimize import minimize
    for s in ('.L', '.R'):
        fing, lat, palm = hand_frame(bones, s)
        P = lambda n, k='head': (mats[n] @ np.r_[bones[n][k], 1])[:3]
        mid = lambda n: (P(n) + P(n, 'tail')) / 2
        tgt = (mid('finger2-2' + s) + mid('finger3-2' + s)) / 2 + palm * 0.017
        face = (mid('finger2-2' + s) + mid('finger5-2' + s)) / 2

        def thumb(x):
            loc = dict(local)
            loc['finger1-1' + s] = rot_axis(x[:3], np.linalg.norm(x[:3])) if np.linalg.norm(x[:3]) > 1e-9 else np.eye(3)
            for k, a in ((2, x[3]), (3, x[4])):
                n = f'finger1-{k}{s}'
                d = bones[n]['tail'] - bones[n]['head']
                loc[n] = rot_axis(np.cross(d, palm), a)
            m = chain_mats(bones, {k: v for k, v in loc.items() if k.startswith('finger1')})
            q = lambda n, k='head': (m[n] @ np.r_[bones[n][k], 1])[:3]
            return loc, q('finger1-2' + s), q('finger1-3' + s), q('finger1-3' + s, 'tail')

        def cost(x):
            _, j2, j3, tip = thumb(x)
            dd = tip - j3
            dd /= np.linalg.norm(dd)
            c = np.sum((tip - tgt) ** 2) * 1e4
            c += 0.6 * (1 - np.dot(dd, -lat))
            for j in (j2, j3):  # não afundar na face do punho
                h = np.dot(j - face, palm)
                c += 50 * max(0.0, 0.012 - h) ** 2 * 1e3
            return c + 0.02 * (x[3] ** 2 + x[4] ** 2)
        best = None
        for x0 in ([0, 0, 0, 0.3, 0.3], list(palm * 0.8) + [0.3, 0.4], list(-palm * 0.8) + [0.3, 0.4], list(fing * 0.8) + [0.2, 0.2], list(-fing * 0.8) + [0.2, 0.2]):
            r = minimize(cost, np.array(x0, float), method='Nelder-Mead', options=dict(maxiter=4000, xatol=1e-5, fatol=1e-7))
            if best is None or r.fun < best.fun:
                best = r
        loc, j2, j3, tip = thumb(best.x)
        print('polegar', s, 'erro (mm)', round(float(np.linalg.norm(tip - tgt)) * 1000, 1), 'custo', round(float(best.fun), 4))
        for k in (1, 2, 3):
            local[f'finger1-{k}{s}'] = loc[f'finger1-{k}{s}']
    mats = chain_mats(bones, local)
    return mh_lbs(V, Wmh, mats)


def game_rig(fit):
    b = fit['bones']
    H = lambda n: b[n]['head']
    P = {
        'hips': H('spine05'), 'spine': H('spine04'), 'chest': H('spine02'), 'neck': H('neck01'), 'head': H('head'),
    }
    for s, x in (('l', '.L'), ('r', '.R')):
        P[s + 'Sh'] = H('upperarm01' + x)
        P[s + 'El'] = H('lowerarm01' + x)
        P[s + 'Wr'] = H('wrist' + x)
        P[s + 'Hip'] = H('upperleg01' + x)
        P[s + 'Kn'] = H('lowerleg01' + x)
        P[s + 'Ank'] = H('foot' + x)
    parents = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck',
               'lSh': 'chest', 'lEl': 'lSh', 'rSh': 'chest', 'rEl': 'rSh',
               'lHip': 'hips', 'lKn': 'lHip', 'lAnk': 'lKn', 'rHip': 'hips', 'rKn': 'rHip', 'rAnk': 'rKn'}
    # rotações de ligação (mundo): troncos sem rotação; membros apontando -Y para o filho
    Rw = {k: np.eye(3) for k in parents}
    down = np.array([0, -1.0, 0])
    for s in 'lr':
        Rw[s + 'Sh'] = swing(down, P[s + 'El'] - P[s + 'Sh'])
        Rw[s + 'El'] = swing(Rw[s + 'Sh'] @ down, P[s + 'Wr'] - P[s + 'El']) @ Rw[s + 'Sh']
        Rw[s + 'Hip'] = swing(down, P[s + 'Kn'] - P[s + 'Hip'])
        Rw[s + 'Kn'] = swing(Rw[s + 'Hip'] @ down, P[s + 'Ank'] - P[s + 'Kn']) @ Rw[s + 'Hip']
        Rw[s + 'Ank'] = np.eye(3)
    bones = {}
    for k, par in parents.items():
        Rp = Rw[par] if par else np.eye(3)
        pp = P[par] if par else np.zeros(3)
        loc_pos = Rp.T @ (P[k] - pp)
        loc_rot = Rp.T @ Rw[k]
        bones[k] = dict(parent=par, pos=loc_pos, rot=loc_rot, world=P[k], wrot=Rw[k])
    return bones


def game_weights(fit, n=4):
    V = fit['V']
    acc = np.zeros((len(V), len(GAME_BONES)))
    gi = {k: i for i, k in enumerate(GAME_BONES)}
    for b, lst in fit['Wmh'].items():
        g = game_bone_of(b)
        tgt = g if isinstance(g, list) else [(g, 1.0)]
        for i, w in lst:
            for name, f in tgt:
                acc[i, gi[name]] += w * f
    order = np.argsort(-acc, axis=1)[:, :n]
    w = np.take_along_axis(acc, order, 1)
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    return order, w


def world_mats(bones, pose=None):
    """Matrizes de mundo dos ossos; pose = {osso: euler XYZ} (rotação local absoluta), senão a de ligação."""
    out = {}
    for k in GAME_BONES:
        b = bones[k]
        r = mat_euler(pose[k]) if pose is not None and k in pose else b['rot']
        L = T(b['pos']) @ R4(r)
        out[k] = (out[b['parent']] @ L) if b['parent'] else L
    return out


def skin(V, bones, idx, w, pose):
    bind = world_mats(bones)
    cur = world_mats(bones, pose)
    Vh = np.c_[V, np.ones(len(V))]
    out = np.zeros((len(V), 3))
    for j, k in enumerate(GAME_BONES):
        M = cur[k] @ np.linalg.inv(bind[k])
        m = (idx == j)
        ww = (w * m).sum(1)
        sel = ww > 0
        out[sel] += (Vh[sel] @ M.T)[:, :3] * ww[sel, None]
    return out
