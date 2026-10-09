# Projeção da ficha do titular sobre o atlas UV do Wei Leo ("assar" a textura a partir de várias vistas).
import paths
import os, json, pickle, numpy as np, cv2
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates
from model import get_model, pose_mesh
from views import VIEWS, ref_crop, cam_of, root_of
from camera import raster, tri_depth_at
from uvmap import triangulate, raster_uv, vertex_normals_tri, dilate
from rigfit import GAME_BONES

OUT = paths.OUT
SIZE = 2048


def mirror_map(V, tol=2e-3):
    """Vértice espelho (x -> -x) da malha-base simétrica."""
    from scipy.spatial import cKDTree
    t = cKDTree(V)
    M = V.copy()
    M[:, 0] *= -1
    d, j = t.query(M)
    return j, d


def regions(m):
    """Região de cada vértice pelo osso dominante."""
    gi = {k: i for i, k in enumerate(GAME_BONES)}
    dom = np.array(GAME_BONES)[m['jidx'][:, 0]]
    reg = np.full(len(dom), 'torso', object)
    reg[np.isin(dom, ['head', 'neck'])] = 'head'
    reg[np.isin(dom, ['lSh', 'lEl'])] = 'armL'
    reg[np.isin(dom, ['rSh', 'rEl'])] = 'armR'
    reg[m['masks']['pants'] | m['masks']['belt']] = 'pants'
    reg[m['masks']['shoe']] = 'shoe'
    return reg


class Baker:
    def __init__(self, size=SIZE):
        self.m = m = get_model()
        F, FT = m['F'][m['keep']], m['FT'][m['keep']]
        self.TV, self.TT = triangulate(F, FT, m['Vnaked'])
        cache = os.path.join(OUT, f'uvraster{size}.npz')
        if os.path.exists(cache):
            z = np.load(cache)
            tri, bary = z['tri'], z['bary']
        else:
            tri, bary = raster_uv(self.TT, m['VT'], size)
            np.savez_compressed(cache, tri=tri, bary=bary)
        self.size = size
        self.valid = tri >= 0
        self.ty, self.tx = np.where(self.valid)
        self.tid = tri[self.ty, self.tx]
        self.b = bary[self.ty, self.tx].astype(np.float64)
        n = len(self.tid)
        self.acc = np.zeros((n, 3))
        self.wsum = np.zeros(n)
        self.best = np.zeros(n)
        reg = regions(m)
        self.vreg = reg
        self.reg = reg[self.TV[self.tid, 0]]
        # segunda região (transições entre ossos), para aceitar vizinhos legítimos
        dom2 = np.array(GAME_BONES)[m['jidx'][:, 1]]
        reg2 = reg.copy()
        tmp = {'head': 'head', 'neck': 'head', 'lSh': 'armL', 'lEl': 'armL', 'rSh': 'armR', 'rEl': 'armR'}
        for i, (b, w) in enumerate(zip(dom2, m['jw'][:, 1])):
            if w > 0.15:
                reg2[i] = tmp.get(b, 'torso' if reg[i] not in ('pants', 'shoe') else reg[i])
        self.reg2 = reg2[self.TV[self.tid, 0]]
        self.tri_reg = reg[self.TV[:, 0]]
        self.mirror, _ = mirror_map(m['Vnaked'])
        # posição de ligação de cada texel (para máscaras por altura etc.)
        self.Pbind = self.attr(m['V'])
        Nb = self.attr(vertex_normals_tri(m['V'], self.TV))
        self.Nbind = Nb / (np.linalg.norm(Nb, axis=1, keepdims=True) + 1e-12)
        self.log = []

    def attr(self, A, tv=None):
        t = self.TV[self.tid] if tv is None else tv
        return (A[t] * self.b[..., None]).sum(1)

    def view_geometry(self, name, mirror=False):
        view = VIEWS[name]
        P, _ = pose_mesh(self.m, view['pose'], root=root_of(view))
        N = vertex_normals_tri(P, self.TV)
        tv = self.TV[self.tid]
        if mirror:
            tv = self.mirror[tv]
        Pt = self.attr(P, tv)
        Nt = self.attr(N, tv)
        Nt /= np.linalg.norm(Nt, axis=1, keepdims=True) + 1e-12
        return view, P, Pt, Nt

    def bake_view(self, name, pairs, weight, mirror=False, image=None, smoothing=2.0, vis_eps=0.012, tag=None, region_check=True, gain=None, arm_pad=5):
        """pairs: (render_xy, ref_xy) N x 2 cada; weight: função(self, sel_regiões, Pt, Nt) -> peso por texel."""
        view, P, Pt, Nt = self.view_geometry(name, mirror)
        cam = cam_of(view)
        xy, d = cam.project(Pt)
        _, ids, _, _ = raster(cam, P, self.TV, shade=False)
        dvis, _ = tri_depth_at(cam, P, self.TV, ids, xy)
        vis = d <= dvis + vis_eps
        ndv = np.clip((Nt * cam.view_dir(Pt)).sum(1), 0, 1)
        ref = (image if image is not None else ref_crop(view)).astype(np.float32)
        H, W = ref.shape[:2]
        # deformação TPS (render -> ficha) calculada numa grade e interpolada
        if pairs is not None and len(pairs[0]) >= 3:
            src, dst = pairs
            rbf = RBFInterpolator(src, dst - src, kernel='thin_plate_spline', smoothing=smoothing)
            step = 4
            gx, gy = np.meshgrid(np.arange(-8, W + 9, step), np.arange(-8, H + 9, step))
            disp = rbf(np.stack([gx.ravel(), gy.ravel()], 1)).reshape(gy.shape + (2,))
            fx = (xy[:, 0] + 8) / step
            fy = (xy[:, 1] + 8) / step
            dx = map_coordinates(disp[..., 0], [fy, fx], order=1, mode='nearest')
            dy = map_coordinates(disp[..., 1], [fy, fx], order=1, mode='nearest')
            q = xy + np.stack([dx, dy], 1)
        else:
            q = xy
        inside = (q[:, 0] >= 1) & (q[:, 0] < W - 2) & (q[:, 1] >= 1) & (q[:, 1] < H - 2)
        # rótulos de região do modelo levados para o quadro da ficha (mapa inverso aproximado)
        names = ['head', 'torso', 'armL', 'armR', 'pants', 'shoe']
        code = {n: i + 1 for i, n in enumerate(names)}
        lab_r = np.zeros(ids.shape, np.int32)
        okp = ids >= 0
        lab_r[okp] = np.vectorize(code.get)(self.tri_reg[ids[okp]])
        if pairs is not None and len(pairs[0]) >= 3:
            gx2, gy2 = np.meshgrid(np.arange(W), np.arange(H))
            inv = np.stack([gx2, gy2], -1).astype(np.float64)
            for _ in range(3):
                fx2 = (inv[..., 0] + 8) / step
                fy2 = (inv[..., 1] + 8) / step
                ddx = map_coordinates(disp[..., 0], [fy2, fx2], order=1, mode='nearest')
                ddy = map_coordinates(disp[..., 1], [fy2, fx2], order=1, mode='nearest')
                inv = np.stack([gx2 - ddx, gy2 - ddy], -1)
            xi = np.clip(np.round(inv[..., 0]).astype(int), 0, W - 1)
            yi = np.clip(np.round(inv[..., 1]).astype(int), 0, H - 1)
            lab = lab_r[yi, xi]
        else:
            lab = lab_r
        # conflitos de oclusão: braço da ficha na frente do tronco/calça (e vice-versa) e fundo
        k5 = np.ones((5, 5), np.uint8)
        ka = np.ones((arm_pad, arm_pad), np.uint8)
        armm = cv2.dilate(np.isin(lab, [code['armL'], code['armR']]).astype(np.uint8), ka).astype(bool)
        bodym = cv2.dilate(np.isin(lab, [code['torso'], code['pants']]).astype(np.uint8), k5).astype(bool)
        bgm = cv2.dilate((lab == 0).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        self.last_lab = (lab, armm)
        qi = np.clip(np.round(q[:, 0]).astype(int), 0, W - 1)
        qj = np.clip(np.round(q[:, 1]).astype(int), 0, H - 1)
        low = self.Pbind[:, 1] < 1.36
        isbody = np.isin(self.reg, ['torso', 'pants'])
        isarm = np.isin(self.reg, ['armL', 'armR'])
        armlab = np.isin(lab[qj, qi], [code['armL'], code['armR']])
        match = ~bgm[qj, qi]
        match &= ~(isbody & low & armm[qj, qi])
        match &= ~(isarm & low & bodym[qj, qi] & ~armlab)
        # fundo real da ficha (escuro e liso) não entra na pele do tronco e dos braços
        g = cv2.cvtColor(np.clip(ref, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        mu = cv2.blur(g, (7, 7))
        sd = np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - mu * mu, 0))
        sat = cv2.cvtColor(np.clip(ref, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV)[..., 1]
        bgref = cv2.dilate(((sat < 60) & (g < 70) & (sd < 3.0)).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
        skin = np.isin(self.reg, ['torso', 'armL', 'armR']) | ((self.reg == 'head') & (self.Pbind[:, 1] < 1.62))
        match &= ~(skin & bgref[qj, qi])
        if region_check:
            inside &= match
        col = np.stack([map_coordinates(ref[..., c], [q[:, 1], q[:, 0]], order=1, mode='nearest') for c in range(3)], 1)
        col = col * np.asarray(gain if gain is not None else (1, 1, 1))[None, :]
        w = vis * inside * ndv ** 2 * weight(self, Pt, Nt)
        self.acc += col * w[:, None]
        self.wsum += w
        win = w > self.best
        if not hasattr(self, 'who'):
            self.who = np.full(len(w), -1)
        self.who[win] = len(self.log)
        self.best = np.maximum(self.best, w)
        self.log.append((tag or name, float((w > 0).mean())))
        return w, col

    def result(self):
        img = np.zeros((self.size, self.size, 3), np.float32)
        have = self.wsum > 1e-4
        c = np.zeros((len(self.tid), 3))
        c[have] = self.acc[have] / self.wsum[have, None]
        img[self.ty[have], self.tx[have]] = c[have]
        known = np.zeros((self.size, self.size), bool)
        known[self.ty[have], self.tx[have]] = True
        return img, known
