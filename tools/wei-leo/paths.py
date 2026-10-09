# Caminhos do pipeline do Wei Leo. WEILEO_WORK guarda downloads, caches e imagens de conferência (fora do repositório).
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('WEILEO_WORK', os.path.join(HERE, 'work'))
MH = os.path.join(WORK, 'dl', 'mh')
MPMODEL = os.path.join(WORK, 'dl', 'mpmodel')
OUT = os.path.join(WORK, 'out')
SHOTS = os.path.join(WORK, 'shots')
DATA = os.path.join(HERE, 'data')
REF = os.path.join(ROOT, 'docs', 'arte-conceitual', 'protagonista.png')
ASSET = os.path.join(ROOT, 'prototype', 'assets', 'wei-leo.glb')
for d in (OUT, SHOTS):
    os.makedirs(d, exist_ok=True)
