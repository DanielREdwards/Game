# Vistas da ficha do titular: recorte, pose do modelo e câmera; sobreposição para conferir o alinhamento.
import paths
import os, json, sys, numpy as np, cv2
from PIL import Image
from model import get_model, pose_mesh
from camera import Cam, tris_of, raster
from rigfit import rot_axis, T as T4, R4

REF = paths.REF

VIEWS = {
    'front': dict(crop=(0, 0, 400, 1100), yaw=0.0, pitch=-0.05, dist=4.0, fov=27, target=(0, 0.92, 0), root_yaw=-0.05, shift=(-38, 6),
                  pose=dict(lSh=[0.05, 0.0, 0.13], lEl=[-0.3, 0.0, 0.0], rSh=[0.05, 0.0, -0.06], rEl=[-0.15, 0.0, 0.0],
                            lHip=[0.0, 0.0, 0.18], rHip=[0.0, 0.0, 0.02], neck=[0.0, 0.0, 0.0], head=[0.0, 0.0, 0.0])),
    'side': dict(crop=(390, 40, 560, 690), yaw=np.pi / 2, pitch=0.0, dist=6.0, fov=17.8, target=(0, 0.92, 0), root_yaw=0.0, shift=(0, 0),
                 pose=dict(lSh=[-0.12, 0.0, 0.05], lEl=[-0.35, 0.0, 0.0], rSh=[-0.05, 0.0, -0.05], rEl=[-0.2, 0.0, 0.0])),
    'back': dict(crop=(555, 40, 790, 690), yaw=np.pi, pitch=0.0, dist=6.0, fov=17.8, target=(0, 0.92, 0), root_yaw=0.0, shift=(0, 0),
                 pose=dict(lSh=[0.0, 0.0, 0.16], lEl=[-0.15, 0.0, 0.0], rSh=[0.0, 0.0, -0.16], rEl=[-0.15, 0.0, 0.0],
                           lHip=[0.0, 0.0, 0.06], rHip=[0.0, 0.0, -0.06])),
    'face_f': dict(crop=(403, 743, 688, 1104), yaw=0.0, pitch=0.0, dist=1.0, fov=22.6, target=(0, 1.66, 0.05), root_yaw=0.0, shift=(0, 0), pose={}),
    'face_p': dict(crop=(698, 743, 993, 1104), yaw=np.pi / 2 * -1, pitch=0.0, dist=1.0, fov=22.6, target=(0, 1.66, 0.03), root_yaw=0.0, shift=(0, 0), pose={}),
}


_fit = os.path.join(paths.DATA, 'views_fit.json')
if os.path.exists(_fit) and not os.environ.get('NO_VIEW_FIT'):
    for _k, _v in json.load(open(_fit)).items():
        if _k in VIEWS:
            VIEWS[_k].update({kk: (tuple(vv) if kk in ('target', 'shift') else vv) for kk, vv in _v.items()})


def ref_crop(view):
    im = np.array(Image.open(REF).convert('RGB'))
    x0, y0, x1, y1 = view['crop']
    return im[y0:y1, x0:x1].copy()


def cam_of(view):
    x0, y0, x1, y1 = view['crop']
    return Cam(view['target'], view['yaw'], view['pitch'], view['dist'], view['fov'], (x1 - x0, y1 - y0), view.get('roll', 0.0), view.get('shift', (0, 0)))


def root_of(view):
    return R4(rot_axis([0, 1, 0], view.get('root_yaw', 0.0)))


def posed(m, view):
    P, mats = pose_mesh(m, view['pose'], root=root_of(view))
    return P, mats


def overlay(name, out=None, alpha=0.45):
    view = VIEWS[name]
    m = get_model()
    P, _ = posed(m, view)
    F = m['F'][m['keep']]
    T = tris_of(F)
    cam = cam_of(view)
    img, ids, xy, d = raster(cam, P, T)
    ref = ref_crop(view)
    mask = (ids >= 0)
    blend = ref.copy()
    blend[mask] = (ref[mask] * (1 - alpha) + img[mask][:, ::-1] * alpha).astype(np.uint8)
    # contorno do modelo em ciano
    cnt, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(blend, cnt, -1, (0, 255, 255), 1)
    both = np.hstack([ref, blend, img[:, :, ::-1]])
    Image.fromarray(both).save(out or f'{paths.SHOTS}/ov-{name}.png')
    return img, ids


if __name__ == '__main__':
    overlay(sys.argv[1])
