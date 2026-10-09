# Marcações manuais na ficha pareadas com pontos do modelo (vértice ou contorno numa altura do corpo).
import numpy as np
from lm3d import landmarks3d
from views import VIEWS, cam_of, posed
from model import get_model
from bake import regions

# ref = (x, y) no recorte da vista; model = ('v', nome|índice) ou ('sil', região, lado, altura_m)
MANUAL = {
    'front': [
        ((163, 385), ('v', 'navel')),
        ((113, 295), ('v', 'nippleR')),
        ((218, 282), ('v', 'nippleL')),
        ((164, 416), ('v', 'beltTopMid')),
        ((164, 442), ('v', 'beltBotMid')),
        ((258, 400), ('sil', 'torso', 'L', 1.13)),
        ((72, 404), ('sil', 'torso', 'R', 1.13)),
        ((70, 600), ('sil', 'pantsR', 'out', 0.75)),
        ((77, 700), ('sil', 'pantsR', 'out', 0.56)),
        ((90, 900), ('sil', 'pantsR', 'out', 0.19)),
        ((185, 900), ('sil', 'pantsR', 'in', 0.19)),
        ((330, 700), ('sil', 'pantsL', 'out', 0.59)),
        ((365, 900), ('sil', 'pantsL', 'out', 0.245)),
        ((255, 900), ('sil', 'pantsL', 'in', 0.245)),
    ],
    'side': [
        ((22, 85), ('v', 'noseTip')),
        ((31, 185), ('v', 'nippleL')),
        ((30, 272), ('v', 'beltTopMid')),
        ((100, 270), ('v', 'beltTopBack')),
        ((22, 235), ('sil', 'torso', 'front', 1.19)),
        ((97, 250), ('sil', 'torso', 'back', 1.147)),
        ((112, 165), ('sil', 'torso', 'back', 1.406)),
        ((31, 450), ('sil', 'pantsB', 'front', 0.54)),
        ((36, 550), ('sil', 'pantsB', 'front', 0.24)),
        ((106, 450), ('sil', 'pantsB', 'back', 0.54)),
        ((111, 550), ('sil', 'pantsB', 'back', 0.24)),
    ],
    'back': [
        ((107, 118), ('v', 'c7')),
        ((107, 100), ('v', 'nape')),
        ((107, 282), ('v', 'beltTopBack')),
        ((107, 295), ('v', 'beltBotBack')),
        ((59, 277), ('sil', 'torso', 'L', 1.10)),
        ((165, 277), ('sil', 'torso', 'R', 1.10)),
        ((35, 450), ('sil', 'pantsL', 'out', 0.60)),
        ((20, 550), ('sil', 'pantsL', 'out', 0.31)),
        ((187, 450), ('sil', 'pantsR', 'out', 0.60)),
        ((192, 550), ('sil', 'pantsR', 'out', 0.31)),
        ((75, 550), ('sil', 'pantsL', 'in', 0.31)),
        ((140, 550), ('sil', 'pantsR', 'in', 0.31)),
    ],
}


def resolve(view_name, items=None, m=None):
    m = m or get_model()
    view = VIEWS[view_name]
    P, _ = posed(m, view)
    cam = cam_of(view)
    L = landmarks3d(m)
    reg = regions(m)
    Vb = m['V']
    used = np.zeros(len(Vb), bool)
    used[np.unique(m['F'][m['keep']])] = True
    xyall, _ = cam.project(P)
    src, dst = [], []
    for ref, (kind, *a) in (items if items is not None else MANUAL.get(view_name, [])):
        if kind == 'v':
            vi = L[a[0]] if isinstance(a[0], str) else a[0]
            src.append(xyall[vi])
        else:
            r, side, h = a
            if r == 'pantsB':
                s = 'B'
                sel = used & (reg == 'pants')
            elif r.startswith('pants'):
                s = r[-1]
                sel = used & (reg == 'pants') & ((Vb[:, 0] > 0.01) if s == 'L' else (Vb[:, 0] < -0.01))
            else:
                sel = used & (reg == r)
                s = side
            sel &= np.abs(Vb[:, 1] - h) < 0.012
            idx = np.where(sel)[0]
            xs = xyall[idx, 0]
            # lado esquerdo do personagem aparece à direita na vista de frente
            if side in ('front', 'back'):  # vista de lado (câmera à esquerda do personagem): frente fica à esquerda
                want_max = side == 'back'
            else:
                want_max = ((s == 'L') == (side == 'out')) if r.startswith('pants') else (side == 'L')
                if view.get('yaw', 0) > 2.5:  # costas: espelha
                    want_max = not want_max
            k = idx[np.argmax(xs)] if want_max else idx[np.argmin(xs)]
            src.append(xyall[k])
        dst.append(ref)
    return np.array(src, float), np.array(dst, float)
