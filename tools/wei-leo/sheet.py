# Folhas de anotação: recorte ampliado com grade e coordenadas (referência e render lado a lado).
import paths
import sys, numpy as np, cv2
from PIL import Image
from views import VIEWS, ref_crop
from pairs import render_view


def grid(img, x0, y0, x1, y1, z=2, step=10):
    c = cv2.resize(np.ascontiguousarray(img[y0:y1, x0:x1]), None, fx=z, fy=z, interpolation=cv2.INTER_CUBIC)
    for x in range((x0 // step + 1) * step, x1, step):
        X = (x - x0) * z
        major = x % 50 == 0
        cv2.line(c, (X, 0), (X, c.shape[0]), (255, 255, 0) if major else (110, 110, 110), 1)
        if major:
            cv2.putText(c, str(x), (X + 2, 11), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (255, 255, 0), 1)
    for y in range((y0 // step + 1) * step, y1, step):
        Y = (y - y0) * z
        major = y % 50 == 0
        cv2.line(c, (0, Y), (c.shape[1], Y), (255, 255, 0) if major else (110, 110, 110), 1)
        if major:
            cv2.putText(c, str(y), (2, Y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (255, 255, 0), 1)
    return c


def sheet(name, box, z=2, out=None):
    ref = ref_crop(VIEWS[name])
    ren = render_view(name)[0]
    a = grid(ref, *box, z=z)
    b = grid(ren, *box, z=z)
    Image.fromarray(np.hstack([a, np.full((a.shape[0], 6, 3), 255, np.uint8), b])).save(out or f'{paths.SHOTS}/sheet-{name}-{"_".join(map(str, box))}.png')


if __name__ == '__main__':
    name = sys.argv[1]
    box = tuple(int(v) for v in sys.argv[2].split(','))
    sheet(name, box, z=float(sys.argv[3]) if len(sys.argv) > 3 else 2)
