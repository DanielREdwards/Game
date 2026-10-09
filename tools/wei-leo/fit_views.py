import sys, numpy as np
from run_bake import body_pairs, face_pairs_in_box
from manual import resolve
from fitcam import fit_view
for name in sys.argv[1:]:
    parts = [body_pairs(name, keep=(11, 13, 15) if name == 'side' else (11, 12, 13, 14, 15, 16)), resolve(name)]
    if name == 'front':
        parts.append(face_pairs_in_box('front', (110, 20, 270, 230)))
    src = np.concatenate([p[0] for p in parts if len(p[0])])
    dst = np.concatenate([p[1] for p in parts if len(p[1])])
    fit_view(name, src, dst)
