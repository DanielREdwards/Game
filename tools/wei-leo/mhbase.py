# Carrega a malha-base CC0 do MakeHuman, aplica alvos e calcula juntas.
import paths
import json, os, numpy as np

MH = paths.MH


def load_obj(path=os.path.join(MH, 'base.obj')):
    V, VT, F, FT, G = [], [], [], [], []
    grp = None
    for line in open(path):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            grp = line.split()[1]
        elif line.startswith('f '):
            ps = [p.split('/') for p in line.split()[1:]]
            F.append([int(p[0]) - 1 for p in ps])
            FT.append([int(p[1]) - 1 if len(p) > 1 and p[1] else -1 for p in ps])
            G.append(grp)
    return dict(V=np.array(V), VT=np.array(VT), F=F, FT=FT, G=G)


def load_target(name):
    p = os.path.join(MH, 'targets', name.replace('/', '_') + ('' if name.endswith('.target') else '.target'))
    idx, d = [], []
    for line in open(p):
        if not line.strip() or line.startswith('#'):
            continue
        s = line.split()
        idx.append(int(s[0]))
        d.append([float(s[1]), float(s[2]), float(s[3])])
    return np.array(idx, dtype=int), np.array(d).reshape(-1, 3)


def apply_targets(V, spec):
    """spec: lista de (nome, peso)."""
    V = V.copy()
    for name, w in spec:
        if abs(w) < 1e-6:
            continue
        i, d = load_target(name)
        V[i] += d * w
    return V


def macro_spec(muscle=0.5, weight=0.5, height=0.5, proportions=0.5, asian=1.0):
    """Pesos dos alvos macro para homem jovem (25 anos), como no modificador do MakeHuman."""
    def tri(v):  # (min, average, max)
        if v < 0.5:
            return {'min': 1 - v / 0.5, 'average': v / 0.5, 'max': 0.0}
        return {'min': 0.0, 'average': 1 - (v - 0.5) / 0.5, 'max': (v - 0.5) / 0.5}
    m, w = tri(muscle), tri(weight)
    spec = []
    for mk, mw in m.items():
        for wk, ww in w.items():
            if mw * ww > 0:
                spec.append((f'macrodetails/universal-male-young-{mk}muscle-{wk}weight', mw * ww))
    spec.append(('macrodetails/asian-male-young', asian))
    # altura e proporções só existem para músculo/peso médio e máximo / mínimo e médio
    hm = {'average': m['average'] + m['min'], 'max': m['max']}
    hw = {'min': w['min'], 'average': w['average'] + w['max']}
    for mk, mw in hm.items():
        for wk, ww in hw.items():
            k = mw * ww
            if k <= 0:
                continue
            if height > 0.5:
                spec.append((f'macrodetails/height/male-young-{mk}muscle-{wk}weight-maxheight', k * (height - 0.5) / 0.5))
            if proportions > 0.5:
                spec.append((f'macrodetails/proportions/male-young-{mk}muscle-{wk}weight-idealproportions', k * (proportions - 0.5) / 0.5))
    return spec


def skeleton():
    return json.load(open(os.path.join(MH, 'default.mhskel')))


def joint_positions(V, skel):
    return {k: V[np.array(v)].mean(0) for k, v in skel['joints'].items()}


def bone_heads(V, skel):
    J = joint_positions(V, skel)
    out = {}
    for name, b in skel['bones'].items():
        out[name] = (J[b['head']], J[b['tail']], b['parent'])
    return out


def weights():
    return json.load(open(os.path.join(MH, 'default_weights.mhw')))['weights']


def body_faces(obj, groups=('body',)):
    F = [f for f, g in zip(obj['F'], obj['G']) if g in groups]
    FT = [t for t, g in zip(obj['FT'], obj['G']) if g in groups]
    return np.array(F), np.array(FT)
