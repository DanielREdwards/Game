# Pares de pontos (render do modelo <-> ficha) para a deformação de cada vista, via MediaPipe + pontos manuais.
import paths
import os, json, numpy as np
from PIL import Image
from model import get_model
from views import VIEWS, ref_crop, cam_of, posed
from camera import tris_of, raster
from mpface import landmarks, pose_landmarks

OUT = paths.OUT
SKIN = np.array([0.82, 0.62, 0.48])


def render_view(name, m=None, texture=None):
    m = m or get_model()
    view = VIEWS[name]
    P, _ = posed(m, view)
    T = tris_of(m['F'][m['keep']])
    cam = cam_of(view)
    cols = np.tile(SKIN, (len(T), 1))
    img, ids, xy, d = raster(cam, P, T, light=(0.3, 0.4, 0.85), colors=cols)
    return np.ascontiguousarray(img[:, :, ::-1]), ids


def pad_pose(img, pad=150):
    return np.pad(img, ((20, 20), (pad, pad), (0, 0)), mode='edge')


def auto_pairs(name, use_face=True, use_pose=True, ren_img=None, min_vis=0.6, face_idx=None):
    view = VIEWS[name]
    ref = np.ascontiguousarray(ref_crop(view))
    ren = ren_img if ren_img is not None else render_view(name)[0]
    src, dst, kind = [], [], []
    if use_face:
        Lr = landmarks(ren)
        Lf = landmarks(ref)
        if Lr is not None and Lf is not None:
            idx = range(len(Lr)) if face_idx is None else face_idx
            for k in idx:
                src.append(Lr[k, :2])
                dst.append(Lf[k, :2])
                kind.append('f%d' % k)
    if use_pose:
        Pr = pose_landmarks(pad_pose(ren))
        Pf = pose_landmarks(pad_pose(ref))
        if Pr is not None and Pf is not None:
            for k in range(11, 33):  # do ombro para baixo (o rosto vem do detector de rosto)
                if Pr[k, 2] > min_vis and Pf[k, 2] > min_vis:
                    src.append(Pr[k, :2] - [150, 20])
                    dst.append(Pf[k, :2] - [150, 20])
                    kind.append('p%d' % k)
    src, dst = np.array(src), np.array(dst)
    json.dump(dict(src=src.tolist(), dst=dst.tolist(), kind=kind), open(os.path.join(OUT, f'pairs_{name}.json'), 'w'))
    return src, dst, kind


def load_pairs(name, manual=True):
    p = json.load(open(os.path.join(OUT, f'pairs_{name}.json')))
    src, dst, kind = np.array(p['src']).reshape(-1, 2), np.array(p['dst']).reshape(-1, 2), p['kind']
    mf = os.path.join(os.path.dirname(__file__), 'manual_pairs.json')
    if manual and os.path.exists(mf):
        M = json.load(open(mf)).get(name, [])
        if M:
            src = np.r_[src, np.array([a for a, b, *_ in M], float)]
            dst = np.r_[dst, np.array([b for a, b, *_ in M], float)]
            kind = kind + ['m'] * len(M)
    return src, dst, kind


def show_pairs(name, out=None):
    view = VIEWS[name]
    ref = ref_crop(view)
    ren = render_view(name)[0]
    src, dst, kind = load_pairs(name)
    import cv2
    a, b = ref.copy(), ren.copy()
    for s, d, k in zip(src, dst, kind):
        col = (0, 255, 0) if k.startswith('f') else (255, 80, 0) if k.startswith('p') else (0, 200, 255)
        cv2.circle(a, tuple(int(v) for v in d), 2, col, -1)
        cv2.circle(b, tuple(int(v) for v in s), 2, col, -1)
        cv2.line(a, tuple(int(v) for v in d), tuple(int(v) for v in s), (255, 255, 255), 1)
    Image.fromarray(np.hstack([a, b])).save(out or f'{paths.SHOTS}/pairs-{name}.png')


if __name__ == '__main__':
    import sys
    for n in sys.argv[1:]:
        s, d, k = auto_pairs(n, use_face=n in ('face_f', 'front'), use_pose=n in ('front', 'side', 'back'))
        print(n, len(s), 'pares', sum(1 for x in k if x.startswith('p')), 'do corpo')
        show_pairs(n)
