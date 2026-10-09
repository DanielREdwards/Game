# Assa a textura do Wei Leo a partir da ficha (vistas configuradas em views.py).
import paths
import os, sys, json, numpy as np, cv2
from PIL import Image
from bake import Baker, OUT
from views import VIEWS, ref_crop
from pairs import render_view, pad_pose
from manual import resolve
from mpface import landmarks, pose_landmarks
from prep import cleaned


def face_pairs_in_box(name, box, up=3):
    """Pontos do rosto detectados num recorte ampliado (render e ficha)."""
    x0, y0, x1, y1 = box
    ref = ref_crop(VIEWS[name])[y0:y1, x0:x1]
    ren = render_view(name)[0][y0:y1, x0:x1]
    big = lambda im: cv2.resize(np.ascontiguousarray(im), None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    Lf, Lr = landmarks(big(ref)), landmarks(big(ren))
    if Lf is None or Lr is None:
        print('rosto não detectado em', name)
        return np.zeros((0, 2)), np.zeros((0, 2))
    return Lr[:, :2] / up + [x0, y0], Lf[:, :2] / up + [x0, y0]


def body_pairs(name, keep=(11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26), min_vis=0.6):
    ref = np.ascontiguousarray(ref_crop(VIEWS[name]))
    ren = render_view(name)[0]
    Pr, Pf = pose_landmarks(pad_pose(ren)), pose_landmarks(pad_pose(ref))
    s, d = [], []
    if Pr is not None and Pf is not None:
        for k in keep:
            if Pr[k, 2] > min_vis and Pf[k, 2] > min_vis:
                s.append(Pr[k, :2] - [150, 20])
                d.append(Pf[k, :2] - [150, 20])
    return np.array(s).reshape(-1, 2), np.array(d).reshape(-1, 2)


def pairs_for(name):
    parts = []
    if name == 'front':
        parts.append(face_pairs_in_box('front', (110, 20, 270, 230)))
        parts.append(body_pairs('front', keep=(11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)))
    elif name == 'back':
        parts.append(body_pairs('back', keep=(11, 12, 13, 14, 15, 16)))
    elif name == 'side':
        parts.append(body_pairs('side', keep=(11, 13, 15)))
    elif name == 'face_f':
        ref = np.ascontiguousarray(ref_crop(VIEWS[name]))
        ren = render_view(name)[0]
        Lr, Lf = landmarks(ren), landmarks(ref)
        parts.append((Lr[:, :2], Lf[:, :2]))
    elif name == 'face_p':
        parts.append(profile_pairs())
    parts.append(resolve(name))
    src = np.concatenate([p[0] for p in parts if len(p[0])])
    dst = np.concatenate([p[1] for p in parts if len(p[1])])
    json.dump(dict(src=src.tolist(), dst=dst.tolist()), open(os.path.join(OUT, f'pairs_{name}.json'), 'w'))
    return src, dst


EAR_P = [(5372, (131, 127.5)), (876, (115, 147.5)), (5406, (135, 190)), (5632, (149, 164)), ('nape', (100, 220))]


def profile_pairs():
    from facefit import correspond
    from model import get_model
    from views import posed, cam_of
    from camera import tris_of, raster, tri_depth_at
    m = get_model()
    Pf, _ = posed(m, VIEWS['face_f'])
    corr, Lf_ref, _, _ = correspond('face_f', Pf, m)
    Lp = landmarks(np.ascontiguousarray(cleaned('face_p')))
    view = VIEWS['face_p']
    Pp, _ = posed(m, view)
    cam = cam_of(view)
    T = tris_of(m['F'][m['keep']])
    _, ids, _, _ = raster(cam, Pp, T, shade=False)
    mid = np.median(Lf_ref[:, 0])
    src, dst = [], []
    for k, tri, b in corr:
        if Lf_ref[k, 0] > mid + 2:
            continue
        p = (Pp[tri] * b[:, None]).sum(0)
        xy, d = cam.project(p[None])
        dv, _ = tri_depth_at(cam, Pp, T, ids, xy)
        if d[0] > dv[0] + 0.006:
            continue
        src.append(xy[0])
        dst.append(Lp[k, :2])
    from lm3d import landmarks3d
    L3 = landmarks3d(m)
    xy, _ = cam.project(Pp[[L3[v] if isinstance(v, str) else v for v, _ in EAR_P]])
    for (v, r), q in zip(EAR_P, xy):
        src.append(q)
        dst.append(r)
    print('perfil: pares', len(src))
    return np.array(src), np.array(dst)


def W_front(bk, Pt, Nt):
    r = bk.reg
    w = np.where(r == 'head', 0.25, 1.0)
    return w * (r != 'shoe')


def W_back(bk, Pt, Nt):
    r = bk.reg
    w = np.where(r == 'head', np.where(bk.Nbind[:, 2] < -0.25, 3.0, 0.6), 1.0)
    w = np.where(r == 'armL', 0.0, w)
    return w * (r != 'shoe')


def ramp(x, a, b):
    return np.clip((x - a) / (b - a), 0, 1)


def neck_base(bk):
    """Peso suave (0..1) da base do pescoço/alto do peito, sem bordas retas."""
    return ramp(bk.Pbind[:, 1], 1.42, 1.50) * (1 - ramp(np.abs(bk.Pbind[:, 0]), 0.06, 0.11)) * (bk.reg == 'torso')


def W_face(bk, Pt, Nt):
    return np.where(bk.reg == 'head', 3.0, 1.0 * neck_base(bk))


def W_prof(bk, Pt, Nt):
    back = bk.Nbind[:, 2] < -0.25
    return np.where(bk.reg == 'head', np.where(back, 0.4, 3.0), 0.6 * neck_base(bk) * (bk.Nbind[:, 2] > 0))


def W_prof_m(bk, Pt, Nt):
    back = bk.Nbind[:, 2] < -0.25
    return np.where(bk.reg == 'head', np.where(back, 0.2, 1.6), 0.0)


def W_side(bk, Pt, Nt):
    r = bk.reg
    w = np.select([r == 'armL', r == 'torso', r == 'pants', r == 'head'], [2.0, 0.7, 1.0, 0.5], 0.0)
    return w


def W_side_m(bk, Pt, Nt):
    # espelho do lado esquerdo para o direito: calça e flanco; nunca o braço (a manga é só do esquerdo)
    r = bk.reg
    return np.select([r == 'torso', r == 'pants'], [0.5, 0.8], 0.0)


ARM_PAD = {'side': 23, 'front': 11, 'back': 11}

WEIGHTS = {'front': W_front, 'back': W_back, 'face_f': W_face, 'side': W_side, 'side~m': W_side_m, 'face_p': W_prof, 'face_p~m': W_prof_m}


if __name__ == '__main__':
    bk = Baker()
    cache = {}
    tags = sys.argv[1:] or ['front']
    # passada 1: cor mediana da pele (sem tatuagem) que cada vista entrega
    med = {}
    for tag in tags:
        name, mirror = tag.split('~')[0], tag.endswith('~m')
        if name not in cache:
            cache[name] = pairs_for(name)
        w, col = bk.bake_view(name, cache[name], WEIGHTS[tag], mirror=mirror, smoothing=1.0, tag=tag, image=cleaned(name), arm_pad=ARM_PAD.get(name, 5))
        sk = (w > 0.05) & np.isin(bk.reg, ['torso', 'armR', 'head'])
        c = col[sk]
        sat = (c.max(1) - c.min(1)) / np.maximum(c.max(1), 1)
        c = c[(sat > 0.25) & (c.mean(1) > 90)]
        med[tag] = np.median(c, 0) if len(c) > 200 else None
        print(tag, 'pares', len(cache[name][0]), 'pele', None if med[tag] is None else med[tag].round(0))
    refc = med.get('front')
    bk = Baker()
    for tag in tags:
        name, mirror = tag.split('~')[0], tag.endswith('~m')
        g = None
        if refc is not None and med.get(tag) is not None:
            g = np.clip(refc / med[tag], 0.8, 1.25)
            g = 1 + (g - 1) * 0.8
        bk.bake_view(name, cache[name], WEIGHTS[tag], mirror=mirror, smoothing=1.0, tag=tag, image=cleaned(name), gain=g, arm_pad=ARM_PAD.get(name, 5))
    # mãos (punhos fechados): tom de pele uniforme do punho direito, com leve variação
    m = bk.m
    hand = np.zeros(len(bk.tid), bool)
    for s, x in (('l', '.L'), ('r', '.R')):
        wr = m['bones_mh']['wrist' + x]['head']
        el = m['bones_mh']['lowerarm01' + x]['head']
        d = (wr - el) / np.linalg.norm(wr - el)
        t = (bk.Pbind - wr) @ d
        side = bk.reg == ('armL' if s == 'l' else 'armR')
        hand |= side & (t > -0.005)
    wr = m['bones_mh']['wrist.R']['head']
    near = (bk.reg == 'armR') & (np.linalg.norm(bk.Pbind - wr, axis=1) < 0.06) & ~hand & (bk.wsum > 1e-3)
    base = np.median(bk.acc[near] / bk.wsum[near, None], 0) if near.sum() > 50 else np.array([175, 128, 104.0])
    rng = np.random.default_rng(7)
    noise = 1 + rng.normal(0, 0.025, (hand.sum(), 1))
    shade = 1 - 0.18 * np.clip(-bk.Nbind[hand, 1], 0, 1)[:, None]  # palma/baixo um pouco mais escuros
    bk.acc[hand] = base[None, :] * noise * shade
    bk.wsum[hand] = 1.0
    print('mãos: tom', base.round(0), 'texels', int(hand.sum()))
    img, known = bk.result()
    print(bk.log)
    # classe por texel (pele / calça) para preencher lacunas sem misturar materiais
    cls = np.zeros((bk.size, bk.size), np.uint8)
    cls[bk.ty, bk.tx] = np.where(np.isin(bk.reg, ['pants']), 2, np.where(bk.reg == 'shoe', 3, 1))
    Image.fromarray(cls).save(os.path.join(OUT, 'albedo_class.png'))
    pal = np.array([[230, 60, 60], [60, 200, 60], [60, 90, 230], [200, 200, 40], [200, 60, 200], [60, 200, 200], [240, 140, 40]], np.uint8)
    who = np.zeros((bk.size, bk.size, 3), np.uint8)
    ok = bk.who >= 0
    who[bk.ty[ok], bk.tx[ok]] = pal[bk.who[ok] % len(pal)]
    Image.fromarray(who).resize((1024, 1024), Image.NEAREST).save(paths.SHOTS + '/who.png')
    out = (np.clip(img, 0, 255)).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(OUT, 'albedo_raw.png'))
    Image.fromarray((known * 255).astype(np.uint8)).save(os.path.join(OUT, 'albedo_known.png'))
