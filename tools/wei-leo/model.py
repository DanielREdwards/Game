# Modelo vestido em cache + pose com o mesmo esquema do jogo (Rig.applyPose).
import paths
import os, pickle, numpy as np
from rigfit import build, game_rig, game_weights, GAME_BONES, mat_euler, T, R4
from clothes import dress

CACHE = os.path.join(paths.OUT, 'model.pkl')
JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKn', 'rHip', 'rKn']


def get_model(rebuild=False):
    if not rebuild and os.path.exists(CACHE):
        return pickle.load(open(CACHE, 'rb'))
    fit = build()
    rig = game_rig(fit)
    jidx, jw = game_weights(fit)
    Vd, masks = dress(fit['V'], fit['F'], rig, jidx, jw)
    keep = ~np.all(masks['shoe'][fit['F']], axis=1)
    m = dict(scale=fit['scale'], V=Vd, Vnaked=fit['V'], F=fit['F'], FT=fit['FT'], VT=fit['VT'], keep=keep, rig=rig, jidx=jidx, jw=jw, masks=masks,
             bones_mh={k: dict(head=v['head'], tail=v['tail'], parent=v['parent']) for k, v in fit['bones'].items()})
    pickle.dump(m, open(CACHE, 'wb'))
    return m


def seg(rig):
    w = lambda k: rig[k]['world']
    return dict(HIP_DROP=w('hips')[1] - (w('lHip')[1] + w('rHip')[1]) / 2, UPPER=np.linalg.norm(w('lKn') - w('lHip')),
                LOWER=np.linalg.norm(w('lAnk') - w('lKn')), SOLE=w('lAnk')[1])


def full_pose(p, rig):
    """p: {junta: [x,y,z]} como nas poses do jogo. Completa tornozelos e altura do quadril."""
    q = {k: np.array(p.get(k, [0, 0, 0]), float) for k in JOINTS}
    for s in 'lr':
        h, k = q[s + 'Hip'], q[s + 'Kn']
        q[s + 'Ank'] = np.array([-(h[0] + k[0]) * 0.85, 0, -h[2]])
    S = seg(rig)
    leg = lambda h, k: S['HIP_DROP'] + np.cos(h[2]) * (S['UPPER'] * np.cos(h[0]) + S['LOWER'] * np.cos(h[0] + k[0])) + S['SOLE']
    hy = max(leg(q['lHip'], q['lKn']), leg(q['rHip'], q['rKn'])) + p.get('hy', 0)
    return q, hy


def world_mats(rig, q=None, hy=None, root=None):
    out = {}
    for k in GAME_BONES:
        b = rig[k]
        r = mat_euler(q[k]) if q is not None else b['rot']
        pos = b['pos'].copy()
        if k == 'hips' and hy is not None:
            pos[1] = hy
        L = T(pos) @ R4(r)
        out[k] = (out[b['parent']] @ L) if b['parent'] else ((root if root is not None else np.eye(4)) @ L)
    return out


def pose_mesh(m, p, root=None, V=None):
    """Malha posada (e matrizes) para a pose p; root = matriz 4x4 extra (giro do corpo inteiro)."""
    rig = m['rig']
    q, hy = full_pose(p, rig)
    bind = world_mats(rig)
    cur = world_mats(rig, q, hy, root)
    V = m['V'] if V is None else V
    Vh = np.c_[V, np.ones(len(V))]
    out = np.zeros((len(V), 3))
    for j, k in enumerate(GAME_BONES):
        M = cur[k] @ np.linalg.inv(bind[k])
        ww = (m['jw'] * (m['jidx'] == j)).sum(1)
        sel = ww > 0
        out[sel] += (Vh[sel] @ M.T)[:, :3] * ww[sel, None]
    return out, cur
