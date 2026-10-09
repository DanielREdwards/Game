# Limpa a ficha antes da projeção: remove corrente, pingente e brincos (viram peças 3D) por "inpainting".
import paths
import os, numpy as np, cv2
from PIL import Image
from views import VIEWS, ref_crop

OUT = paths.OUT

CHAIN = {
    'front': dict(lines=[[(141, 148), (143, 160), (145, 175), (147, 190), (152, 207), (157, 218), (163, 228)],
                         [(222, 138), (220, 150), (216, 158), (218, 160), (213, 177), (203, 193), (193, 207), (180, 218), (170, 225), (163, 228)]],
                  width=7, rects=[(156, 226, 172, 252)], dots=[(147, 112, 4), (217, 110, 4)]),
    'face_f': dict(lines=[[(66, 258), (65, 270), (62, 285), (70, 305), (82, 325), (100, 342), (120, 352), (137, 357)],
                          [(228, 258), (227, 270), (222, 290), (210, 315), (190, 332), (165, 347), (145, 356), (137, 357)]],
                   width=9, rects=[(128, 349, 147, 361)], dots=[(60, 182, 8), (219, 178, 9)]),
    'face_p': dict(lines=[[(40, 268), (50, 272), (75, 283), (100, 302), (125, 325), (140, 339), (157, 351), (172, 357), (185, 361)],
                          [(48, 266), (62, 270), (80, 278), (98, 290), (110, 300)]],
                   width=11, rects=[], dots=[(147, 192, 9)]),
    'side': dict(lines=[[(58, 119), (66, 114), (76, 111), (88, 110), (95, 112)]], width=4, rects=[], dots=[]),
    'back': dict(lines=[[(86, 112), (97, 114), (107, 115), (118, 114), (129, 112)]], width=4, rects=[], dots=[(137, 90, 4)]),
}


def clean(name, save=True):
    img = np.ascontiguousarray(ref_crop(VIEWS[name]))
    spec = CHAIN.get(name)
    if not spec:
        return img
    mask = np.zeros(img.shape[:2], np.uint8)
    for line in spec['lines']:
        cv2.polylines(mask, [np.array(line, np.int32)], False, 255, spec['width'], lineType=cv2.LINE_AA)
    for x0, y0, x1, y1 in spec['rects']:
        cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
    for x, y, r in spec['dots']:
        cv2.circle(mask, (x, y), r, 255, -1)
    mask = (mask > 0).astype(np.uint8) * 255
    out = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)
    if save:
        Image.fromarray(np.hstack([img, out])).save(f'{paths.SHOTS}/clean-{name}.png')
        Image.fromarray(out).save(os.path.join(OUT, f'clean_{name}.png'))
    return out


def cleaned(name):
    p = os.path.join(OUT, f'clean_{name}.png')
    if os.path.exists(p):
        return np.array(Image.open(p).convert('RGB'))
    return clean(name)


if __name__ == '__main__':
    for n in CHAIN:
        clean(n)
