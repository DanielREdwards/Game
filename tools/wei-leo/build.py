# Monta o Wei Leo do zero: modelo ajustado -> limpeza da ficha -> projeção (7 vistas) -> acabamento -> .glb.
# Uso: python build.py            (usa os ajustes salvos em data/)
#      python build.py --refit    (refaz o ajuste do rosto e das câmeras antes)
import os, sys, subprocess, numpy as np
from PIL import Image
import paths

VIEWS = ['front', 'back', 'side', 'side~m', 'face_f', 'face_p', 'face_p~m']


def run(*args, **env):
    print('>', ' '.join(args), ' '.join(f'{k}=1' for k in env))
    subprocess.run([sys.executable, *args], check=True, cwd=paths.HERE, env={**os.environ, **{k: '1' for k in env}})


def finish():
    """Preenche lacunas por material, comprime brilhos especulares da foto e estende as ilhas do UV."""
    from finish import fill, pad_islands
    valid = np.load(os.path.join(paths.OUT, 'uvraster2048.npz'))['tri'] >= 0
    img = np.array(Image.open(os.path.join(paths.OUT, 'albedo_raw.png'))).astype(np.float32)
    known = np.array(Image.open(os.path.join(paths.OUT, 'albedo_known.png'))) > 0
    cls = np.array(Image.open(os.path.join(paths.OUT, 'albedo_class.png')))
    out = img.copy()
    for c in (1, 2, 3):
        vm = cls == c
        f = fill(img, known & vm, vm)
        out[vm] = f[vm]
    lum = out.mean(2, keepdims=True)
    knee = 175.0
    out = out * np.where(lum > knee, (knee + np.clip(lum - knee, 0, None) * 0.45) / np.maximum(lum, 1), 1.0)
    out = pad_islands(out, valid, 10)
    path = os.path.join(paths.OUT, 'albedo.jpg')
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path, quality=92)
    return path


def main():
    run('fetch.py')
    rebuild = ('-c', 'from model import get_model; get_model(rebuild=True)')
    if '--refit' in sys.argv:
        # rosto: ajusta sobre a base sem o ajuste anterior; câmeras: partem dos valores de views.py
        run(*rebuild, NO_FACE_FIT=1, NO_VIEW_FIT=1)
        run('facefit.py', NO_FACE_FIT=1, NO_VIEW_FIT=1)
        run(*rebuild)
        run('fit_views.py', 'front', 'back', 'side', NO_VIEW_FIT=1)
    run(*rebuild)
    run('prep.py')
    run('run_bake.py', *VIEWS)
    albedo = finish()
    run('assemble.py', albedo, paths.ASSET)
    print('pronto:', paths.ASSET)


if __name__ == '__main__':
    main()
