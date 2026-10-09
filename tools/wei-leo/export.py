# Exporta o Wei Leo (malha com pele, esqueleto do jogo e marcadores) para .glb.
import paths
import io, sys, json, numpy as np
from PIL import Image
from rigfit import build, game_rig, game_weights, GAME_BONES, T, R4
from gltf import GLB, quat_from_mat


def split_seams(F, FT, V, VT):
    """Um vértice por par (posição, UV); devolve mapa para o vértice original."""
    key = {}
    src, uvi = [], []
    tris = []
    for f, t in zip(F, FT):
        ids = []
        for a, b in zip(f, t):
            k = (a, b)
            if k not in key:
                key[k] = len(src)
                src.append(a)
                uvi.append(b)
            ids.append(key[k])
        if len(ids) == 4:
            # diagonal mais curta
            d02 = np.linalg.norm(V[f[0]] - V[f[2]])
            d13 = np.linalg.norm(V[f[1]] - V[f[3]])
            if d02 <= d13:
                tris += [(ids[0], ids[1], ids[2]), (ids[0], ids[2], ids[3])]
            else:
                tris += [(ids[0], ids[1], ids[3]), (ids[1], ids[2], ids[3])]
        else:
            tris.append(tuple(ids))
    return np.array(src), np.array(uvi), np.array(tris)


def vertex_normals(V, F):
    N = np.zeros_like(V)
    for f in F:
        p = V[list(f)]
        if len(f) == 4:
            n = np.cross(p[2] - p[0], p[3] - p[1])
        else:
            n = np.cross(p[1] - p[0], p[2] - p[0])
        for i in f:
            N[i] += n
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    return N


def markers(fit, rig):
    b = fit['bones']
    out = {}
    for s, x in (('l', '.L'), ('r', '.R')):
        # centro do punho: média das falanges proximais (já fechadas) e da cabeça dos metacarpos
        V = fit['V']
        pts = [b[f'finger{k}-1{x}']['head'] for k in range(2, 6)] + [b[f'finger{k}-2{x}']['head'] for k in range(2, 6)]
        fist = np.mean(pts, 0)
        el = rig[s + 'El']
        out[s + 'Fist'] = (s + 'El', el['wrot'].T @ (fist - el['world']))
        ank = rig[s + 'Ank']
        ball = (b['toe1-1' + x]['head'] + b['toe5-1' + x]['head']) / 2
        ball[1] = 0.0
        out[s + 'Foot'] = (s + 'Ank', ank['wrot'].T @ (ball - ank['world']))
    return out


def seg_of(rig):
    w = lambda k: rig[k]['world']
    return dict(
        HIP_DROP=float(w('hips')[1] - (w('lHip')[1] + w('rHip')[1]) / 2),
        UPPER=float(np.linalg.norm(w('lKn') - w('lHip'))),
        LOWER=float(np.linalg.norm(w('lAnk') - w('lKn'))),
        SOLE=float(w('lAnk')[1]),
    )


def shoe_prims(g, rig):
    import sneaker
    from rigfit import GAME_BONES
    buf = io.BytesIO()
    Image.fromarray(sneaker.paint(512)).save(buf, 'JPEG', quality=90)
    tex = g.image(buf.getvalue(), name='tenis')
    mat = g.material('tenis', tex=tex, roughness=0.42)
    out = []
    for s, sign in (('l', 1), ('r', -1)):
        ank = rig[s + 'Ank']['world']
        P, UV, Tr, part = sneaker.build(ground_y=-ank[1], x_off=-0.004)
        P = P.copy()
        P[:, 0] *= sign
        if sign < 0:
            Tr = Tr[:, ::-1]
        uv = UV.copy()
        uv[:, 1] = np.where(part == 0, uv[:, 1] * 0.5, 0.5 + uv[:, 1] * 0.5)
        Pw = P + ank
        N = np.zeros_like(Pw)
        tri = Pw[Tr]
        fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        for k in range(3):
            np.add.at(N, Tr[:, k], fn)
        N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
        j = np.zeros((len(P), 4), int)
        j[:, 0] = GAME_BONES.index(s + 'Ank')
        w = np.zeros((len(P), 4))
        w[:, 0] = 1
        out.append(dict(pos=Pw, nrm=N, uv=uv, idx=Tr, mat=mat, joints=j, weights=w))
    return out


def mask_texture(F, FT, VT, masks, S=1024):
    import cv2
    img = np.zeros((S, S, 3), np.uint8)
    for f, t in zip(F, FT):
        votes = {k: sum(masks[k][i] for i in f) for k in ('shoe', 'belt', 'pants', 'skin')}
        m = 'belt' if votes['belt'] >= 3 else max(('pants', 'skin', 'shoe'), key=lambda k: votes[k])
        if votes['skin'] < 4 and (votes['pants'] or votes['shoe']):
            m = 'pants' if m != 'belt' else m
        col = {'shoe': (22, 22, 24), 'belt': (40, 40, 40), 'pants': (22, 22, 24), 'skin': (196, 148, 112)}[m]
        pts = np.array([[VT[i][0] * S, (1 - VT[i][1]) * S] for i in t], np.float32)
        cv2.fillConvexPoly(img, np.round(pts * 4).astype(np.int32), col, shift=2)
    img = cv2.dilate(img, np.ones((5, 5), np.uint8))
    return Image.fromarray(img)


def export(path, albedo=None, normal=None, extra_prims=None, dressed=True, mr=None):
    fit = build()
    rig = game_rig(fit)
    jidx, jw = game_weights(fit)
    V, F, FT, VT = fit['V'], fit['F'], fit['FT'], fit['VT']
    if dressed:
        from clothes import dress
        V, masks = dress(V, F, rig, jidx, jw)
        fit['V_dressed'], fit['masks'] = V, masks
        if albedo == 'masks':
            albedo = mask_texture(F, FT, VT, masks)
    N = vertex_normals(V, F)
    if dressed:
        # pés ficam dentro do tênis: faces só de pé saem da malha
        keep = ~np.all(masks['shoe'][F], axis=1)
        F, FT = F[keep], FT[keep]
    src, uvi, tris = split_seams(F, FT, V, VT)
    g = GLB()
    tex = nrm = None
    if albedo is not None:
        buf = io.BytesIO()
        albedo.save(buf, 'JPEG', quality=88)
        tex = g.image(buf.getvalue(), name='pele')
    if normal is not None:
        buf = io.BytesIO()
        normal.save(buf, 'JPEG', quality=90)
        nrm = g.image(buf.getvalue(), name='relevo')
    mrt = None
    if mr is not None:
        buf = io.BytesIO()
        mr.save(buf, 'JPEG', quality=90)
        mrt = g.image(buf.getvalue(), name='rugosidade')
    mat = g.material('corpo', tex=tex, normal=nrm, mr=mrt, roughness=1.0 if mrt is not None else 0.55)
    uv = VT[uvi].copy()
    uv[:, 1] = 1 - uv[:, 1]
    prims = [dict(pos=V[src], nrm=N[src], uv=uv, idx=tris, mat=mat, joints=jidx[src], weights=jw[src])]
    if dressed:
        prims += shoe_prims(g, rig)
    mesh = g.mesh('wei-leo', prims + (extra_prims(g) if extra_prims else []))
    # nós do esqueleto (ordem = GAME_BONES)
    ids = {}
    for k in GAME_BONES:
        bb = rig[k]
        ids[k] = g.node(k, t=bb['pos'], r=quat_from_mat(bb['rot']))
    mk = markers(fit, rig)
    for name, (par, off) in mk.items():
        ids[name] = g.node(name, t=off)
    kids = {}
    for k in GAME_BONES:
        par = rig[k]['parent']
        if par:
            kids.setdefault(par, []).append(ids[k])
    for name, (par, off) in mk.items():
        kids.setdefault(par, []).append(ids[name])
    for k, ch in kids.items():
        g.j['nodes'][ids[k]]['children'] = ch
    # matrizes inversas de ligação
    W = {}
    for k in GAME_BONES:
        bb = rig[k]
        L = T(bb['pos']) @ R4(bb['rot'])
        W[k] = (W[bb['parent']] @ L) if bb['parent'] else L
    skin = g.skin([ids[k] for k in GAME_BONES], [np.linalg.inv(W[k]) for k in GAME_BONES], skeleton=ids['hips'])
    body = g.node('corpo', mesh=mesh, skin=skin)
    root = g.node('wei-leo', children=[ids['hips'], body], extras=dict(seg=seg_of(rig), height=1.8))
    g.j['scenes'][0]['nodes'] = [root]
    n = g.save(path)
    return fit, rig, n


if __name__ == '__main__':
    fit, rig, n = export(sys.argv[1] if len(sys.argv) > 1 else paths.OUT + '/wei-leo-test.glb', albedo='masks')
    print('bytes', n, 'seg', seg_of(rig))
