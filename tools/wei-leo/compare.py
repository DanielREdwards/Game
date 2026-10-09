# Reprojeção: render do modelo texturizado em cada vista, ao lado da ficha.
import paths
import sys, numpy as np, cv2
from PIL import Image
from model import get_model
from views import VIEWS, cam_of, posed, ref_crop
from camera import render_textured
from uvmap import triangulate

m = get_model()
F, FT = m['F'][m['keep']], m['FT'][m['keep']]
TV, TT = triangulate(F, FT, m['Vnaked'])
tex = np.array(Image.open(sys.argv[2] if len(sys.argv) > 2 else paths.OUT + '/albedo_test.jpg').convert('RGB'))
rows = []
for name in sys.argv[1].split(','):
    view = VIEWS[name]
    P, _ = posed(m, view)
    img = render_textured(cam_of(view), P, TV, TT, m['VT'], tex)
    ref = ref_crop(view)
    row = np.hstack([ref, np.full((ref.shape[0], 4, 3), 255, np.uint8), img])
    rows.append(row)
w = max(r.shape[1] for r in rows)
out = np.hstack([np.pad(r, ((0, max(x.shape[0] for x in rows) - r.shape[0]), (0, 6), (0, 0))) for r in rows])
Image.fromarray(out).save(paths.SHOTS + '/compare.png')
print(out.shape)
