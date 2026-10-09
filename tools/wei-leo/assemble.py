# Monta o Wei Leo final (.glb): corpo com textura projetada da ficha + relevo, tênis, cabelo, olhos e acessórios.
import paths
import io, os, sys, json, numpy as np, cv2
from PIL import Image
from model import get_model
from mhbase import load_obj
from rigfit import GAME_BONES
from uvmap import triangulate, vertex_normals_tri
from clothes import BELT_TOP, BELT_BOT
import hair as H
import extras as X

OUT = paths.OUT


def jpeg(img, q=88):
    b = io.BytesIO()
    Image.fromarray(img).save(b, 'JPEG', quality=q, optimize=True)
    return b.getvalue()


def png(img):
    b = io.BytesIO()
    Image.fromarray(img).save(b, 'PNG', optimize=True)
    return b.getvalue()


def normal_map(albedo, cls, valid, strength=(2.2, 1.6)):
    """Relevo fino a partir da luminância (passa-alta) + poros na pele + trama na calça."""
    g = albedo.astype(np.float32).mean(2) / 255
    rng = np.random.default_rng(9)
    h = np.zeros_like(g)
    hp = cv2.GaussianBlur(g, (0, 0), 2.0) - cv2.GaussianBlur(g, (0, 0), 9.0)
    pores = cv2.GaussianBlur(rng.normal(0, 1, g.shape).astype(np.float32), (0, 0), 0.7) * 0.004
    weave = cv2.GaussianBlur(rng.normal(0, 1, g.shape).astype(np.float32), (0, 0), 0.6) * 0.01
    skin, pants = cls == 1, cls == 2
    h[skin] = hp[skin] * 0.06 + pores[skin]
    h[pants] = hp[pants] * 0.5 + weave[pants] * 0.6
    h = cv2.GaussianBlur(h, (0, 0), 0.6)
    dx = cv2.Sobel(h, cv2.CV_32F, 1, 0, ksize=3)
    dy = cv2.Sobel(h, cv2.CV_32F, 0, 1, ksize=3)
    k = np.where(pants, strength[1], strength[0]) * 2.5
    n = np.dstack([-dx * k, dy * k, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    out = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
    out[~valid] = (128, 128, 255)
    return out


def rough_map(cls, belt_uv, size=1024):
    """glTF metallicRoughness: G = rugosidade, B = metal."""
    c = cv2.resize(cls, (size, size), interpolation=cv2.INTER_NEAREST)
    r = np.full((size, size), 0.5, np.float32)
    r[c == 1] = 0.46
    r[c == 2] = 0.86
    b = cv2.resize(belt_uv.astype(np.uint8), (size, size), interpolation=cv2.INTER_NEAREST) > 0
    r[b] = 0.38
    out = np.zeros((size, size, 3), np.uint8)
    out[..., 1] = (r * 255).astype(np.uint8)
    return out


def head_patch(m):
    """Faces da cabeça (pose de ligação) e normais por vértice, para semear o cabelo."""
    F = m['F'][m['keep']]
    V = m['V']
    dom = np.array(GAME_BONES)[m['jidx'][:, 0]]
    head = np.isin(dom, ['head'])
    Fh = F[head[F].all(1)]
    TV, _ = triangulate(F, m['FT'][m['keep']], V)
    N = vertex_normals_tri(V, TV)
    return V, Fh, N


def rigid(prims_P, bone, n):
    j = np.zeros((n, 4), int)
    j[:, 0] = GAME_BONES.index(bone)
    w = np.zeros((n, 4))
    w[:, 0] = 1
    return j, w


def build_extras(g, m):
    out = []
    obj = load_obj()
    V = m['V']
    # ---- cabelo
    Vh, Fh, N = head_patch(m)
    hc = m['rig']['head']['world'] + np.array([0, 0.07, 0.02])
    P, UV, T = H.build(Vh, Fh, N, hc)
    tex = g.image(png(H.texture(512)), 'image/png', name='cabelo')
    mat = g.material('cabelo', tex=tex, roughness=0.7, alpha=('MASK', 0.5), double=True)
    Nn = np.zeros_like(P)
    tri = P[T]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for k in range(3):
        np.add.at(Nn, T[:, k], fn)
    Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12
    j, w = rigid(P, 'head', len(P))
    out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=mat, joints=j, weights=w))
    print('cabelo: cartões', len(P) // 14, 'triângulos', len(T))
    # ---- olhos
    etex = g.image(png(X.eye_texture(256)), 'image/png', name='olho')
    emat = g.material('olho', tex=etex, roughness=0.12, extras=dict(clearcoat=1))
    for side in ('l', 'r'):
        fs = [f for f, gg in zip(obj['F'], obj['G']) if gg == f'helper-{side}-eye']
        vi = np.unique([i for f in fs for i in f])
        c = V[vi].mean(0)
        r = np.linalg.norm(V[vi] - c, axis=1).mean() * 0.9
        P, Nn, UV, T = X.sphere(r)
        P = P + c + np.array([0, 0, 0.0015])
        j, w = rigid(P, 'head', len(P))
        out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=emat, joints=j, weights=w))
    # ---- metal: corrente, placa, brincos, fivela
    metal = g.material('metal', color=(0.82, 0.83, 0.86, 1), metallic=1.0, roughness=0.28)
    Vn = np.zeros_like(V)
    TV, _ = triangulate(m['F'][m['keep']], m['FT'][m['keep']], V)
    Vn = vertex_normals_tri(V, TV)
    used = np.unique(m['F'][m['keep']])
    Vs, Vns = V[used], Vn[used]
    ctrl = [(0, 1.505, -0.072), (0.05, 1.505, -0.05), (0.075, 1.49, -0.005), (0.075, 1.47, 0.04), (0.055, 1.445, 0.085),
            (0.022, 1.43, 0.112), (0.0, 1.425, 0.118), (-0.022, 1.43, 0.112), (-0.055, 1.445, 0.085), (-0.075, 1.47, 0.04),
            (-0.075, 1.49, -0.005), (-0.05, 1.505, -0.05)]
    pts = X.on_surface(Vs, Vns, ctrl, 0.0035)
    path = X.catmull(pts, k=14, closed=True)
    P, Nn, UV, T = X.tube(path, 0.0021, sides=6, closed=True, wobble=0.25)
    j, w = rigid(P, 'chest', len(P))
    out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=metal, joints=j, weights=w))
    # placa pendurada na frente do esterno
    bottom = pts[6]
    surf = X.on_surface(Vs, Vns, [bottom + np.array([0, -0.026, 0])], 0.004)[0]
    P, Nn, UV, T = X.rounded_box(0.024, 0.04, 0.0045)
    tilt = np.radians(8)
    Rx = np.array([[1, 0, 0], [0, np.cos(tilt), -np.sin(tilt)], [0, np.sin(tilt), np.cos(tilt)]])
    P = P @ Rx.T + surf
    Nn = Nn @ Rx.T
    ttex = g.image(jpeg(X.tag_texture(128)), name='placa')
    tmat = g.material('placa', tex=ttex, metallic=1.0, roughness=0.32)
    j, w = rigid(P, 'chest', len(P))
    out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=tmat, joints=j, weights=w))
    # argolas nas orelhas (lóbulo)
    from bake import mirror_map
    mir, _ = mirror_map(m['Vnaked'])
    for lobe in (5406, mir[5406]):
        p = V[lobe] + np.array([0, -0.004, 0.0])
        ring = np.array([[0, np.cos(a) * 0.0055 - 0.0045, np.sin(a) * 0.0055] for a in np.linspace(0, 2 * np.pi, 20, endpoint=False)]) + p
        ring[:, 0] += np.sign(p[0]) * 0.001
        P, Nn, UV, T = X.tube(ring, 0.0011, sides=6, closed=True)
        j, w = rigid(P, 'head', len(P))
        out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=metal, joints=j, weights=w))
    # fivela: moldura retangular na frente do cinto (um pouco à direita do personagem, como na ficha)
    yc = (BELT_TOP + BELT_BOT) / 2
    front = X.on_surface(Vs, Vns, [(-0.022, yc, 0.15)], 0.005)[0]
    fw, fh = 0.042, 0.034
    frame = np.array([(-fw / 2, -fh / 2, 0), (fw / 2, -fh / 2, 0), (fw / 2, fh / 2, 0), (-fw / 2, fh / 2, 0)])
    path = X.catmull(frame, k=6, closed=True)
    P, Nn, UV, T = X.tube(path, 0.0028, sides=6, closed=True)
    P = P + front
    j, w = rigid(P, 'hips', len(P))
    out.append(dict(pos=P, nrm=Nn, uv=UV, idx=T, mat=metal, joints=j, weights=w))
    return out


def main(albedo_path, out_path):
    import export
    m = get_model()
    alb = np.array(Image.open(albedo_path).convert('RGB'))
    cls = np.array(Image.open(os.path.join(OUT, 'albedo_class.png')))
    valid = np.load(os.path.join(OUT, 'uvraster2048.npz'))['tri'] >= 0
    nrm = normal_map(alb, cls, valid)
    Image.fromarray(nrm).resize((1024, 1024)).save(paths.SHOTS + '/normal_small.png')
    z = np.load(os.path.join(OUT, 'uvraster2048.npz'))
    TV, _ = triangulate(m['F'][m['keep']], m['FT'][m['keep']], m['Vnaked'])
    tri = z['tri']
    belt = np.zeros(tri.shape, bool)
    ok = tri >= 0
    belt[ok] = m['masks']['belt'][TV[tri[ok], 0]]
    rm = rough_map(cls, belt, 1024)
    nrm_small = cv2.resize(nrm, (1024, 1024), interpolation=cv2.INTER_AREA)
    fit, rig, n = export.export(out_path, albedo=Image.fromarray(alb), normal=Image.fromarray(nrm_small), mr=Image.fromarray(rm),
                                extra_prims=lambda g: build_extras(g, m))
    print('glb', out_path, n)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else paths.OUT + '/albedo_test.jpg', sys.argv[2] if len(sys.argv) > 2 else paths.OUT + '/wei-leo.glb')
