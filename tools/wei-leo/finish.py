# Acabamento do atlas: preenche lacunas por ilha (difusão) e estende as bordas.
import numpy as np, cv2
from PIL import Image


def fill(img, known, valid, iters=6):
    """img float RGB, known = texels com dado, valid = texels cobertos pela malha."""
    out = img.copy()
    hole = valid & ~known
    if hole.any():
        # difusão em pirâmide (push-pull): média de vizinhos conhecidos em escalas crescentes
        acc = out * known[..., None]
        w = known.astype(np.float32)
        levels = []
        a, ww = acc, w
        for _ in range(9):
            levels.append((a, ww))
            a = cv2.resize(a, (a.shape[1] // 2, a.shape[0] // 2), interpolation=cv2.INTER_AREA) * 4
            ww = cv2.resize(ww, (ww.shape[1] // 2, ww.shape[0] // 2), interpolation=cv2.INTER_AREA) * 4
            if a.shape[0] < 4:
                break
        col = a / np.maximum(ww, 1e-6)[..., None]
        for a, ww in reversed(levels):
            up = cv2.resize(col, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_LINEAR)
            k = np.clip(ww, 0, 1)[..., None]
            col = np.where(ww[..., None] > 1e-6, (a / np.maximum(ww, 1e-6)[..., None]) * k + up * (1 - k), up)
        out[hole] = col[hole]
    return out


def pad_islands(img, valid, px=12):
    from uvmap import dilate
    out, _ = dilate(img, valid, iters=px)
    return out
