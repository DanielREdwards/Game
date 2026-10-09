# Baixa o que o pipeline usa de terceiros: base humana CC0 do MakeHuman (malha, esqueleto, pesos, alvos)
# do repositório oficial e os modelos de pontos do MediaPipe (Apache 2.0), usados só na preparação.
import os, json, urllib.request
import paths
from rigfit import EXTRA

RAW = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master'
MP = 'https://storage.googleapis.com/mediapipe-models'


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print('baixando', url)
    urllib.request.urlretrieve(url, dest)


def main():
    mh = paths.MH
    for p in ['LICENSE.md', 'LICENSE.ASSETS.md']:
        get(f'{RAW}/{p}', os.path.join(mh, p))
    for p in ['data/3dobjs/base.obj', 'data/rigs/default.mhskel', 'data/rigs/default_weights.mhw', 'data/modifiers/modeling_modifiers.json']:
        get(f'{RAW}/makehuman/{p}', os.path.join(mh, os.path.basename(p)))
    names = []
    for m in ('minmuscle', 'averagemuscle', 'maxmuscle'):
        for w in ('minweight', 'averageweight', 'maxweight'):
            names.append(f'macrodetails/universal-male-young-{m}-{w}')
    names.append('macrodetails/asian-male-young')
    for m in ('averagemuscle', 'maxmuscle'):
        for w in ('minweight', 'averageweight'):
            names.append(f'macrodetails/height/male-young-{m}-{w}-maxheight')
            names.append(f'macrodetails/proportions/male-young-{m}-{w}-idealproportions')
    names += [n for n, w in EXTRA if w]
    face = []
    for g in json.load(open(os.path.join(mh, 'modeling_modifiers.json'))):
        if g['group'] not in ('head', 'forehead', 'eyebrows', 'neck', 'eyes', 'nose', 'mouth', 'ears', 'chin', 'cheek'):
            continue
        for mo in g['modifiers']:
            t = mo.get('target')
            if t:
                face += [f"{g['group']}/{t}-{mo['min']}", f"{g['group']}/{t}-{mo['max']}"] if 'min' in mo else [f"{g['group']}/{t}"]
    open(os.path.join(mh, 'face_targets.txt'), 'w').write('\n'.join(face) + '\n')
    for n in sorted(set(names + face)):
        try:
            get(f'{RAW}/makehuman/data/targets/{n}.target', os.path.join(mh, 'targets', n.replace('/', '_') + '.target'))
        except Exception as e:  # alguns alvos do arquivo de modificadores não existem no repositório
            print('  (ausente)', n, e)
    get(f'{MP}/face_landmarker/face_landmarker/float16/1/face_landmarker.task', os.path.join(paths.MPMODEL, 'face_landmarker.task'))
    get(f'{MP}/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task', os.path.join(paths.MPMODEL, 'pose_landmarker_heavy.task'))
    lic = open(os.path.join(mh, 'LICENSE.ASSETS.md')).read()
    assert 'CC0' in lic, 'licença dos assets do MakeHuman mudou: conferir antes de usar'
    print('ok: assets CC0 do MakeHuman e modelos do MediaPipe em', paths.WORK)


if __name__ == '__main__':
    main()
