# Pipeline do Wei Leo realista

Gera `prototype/assets/wei-leo.glb` a partir de duas fontes:

1. a **ficha do titular**, `docs/arte-conceitual/protagonista.png`, que fornece a pele, as tatuagens, o rosto, a calça e o cabelo pintado;
2. a **base humana CC0 do MakeHuman**, que fornece a malha, o esqueleto, os pesos e os alvos de forma.

Fundamentos e limites estão na [especificação de personagens](../../docs/sala-limpa/ESPECIFICACAO-PERSONAGENS.md), seção 8. A origem e a licença de cada componente estão no [registro de proveniência](../../docs/PROVENIENCIA.md).

## Como rodar

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r tools/wei-leo/requirements.txt
python tools/wei-leo/build.py            # usa os ajustes salvos em data/
python tools/wei-leo/build.py --refit    # refaz o ajuste do rosto e das câmeras
```

Downloads, caches e imagens de conferência ficam em `tools/wei-leo/work/`, ou na pasta indicada por `WEILEO_WORK`. Essa pasta não vai para o repositório.

**Linux sem interface gráfica:** o MediaPipe precisa de `libEGL.so.1`. Instale `libegl1` ou aponte `LD_LIBRARY_PATH` para uma `libEGL` existente, por exemplo a do Chromium do Playwright.

## Etapas

| Arquivo | Etapa |
|---|---|
| `fetch.py` | Baixa, do repositório oficial, a malha-base, o esqueleto, os pesos e os alvos do MakeHuman (confere a licença CC0), além dos modelos de pontos do MediaPipe |
| `mhbase.py`, `rigfit.py` | Aplica os alvos (homem de 25 anos, musculoso, proporções ideais, traços asiáticos, rosto ajustado), escala para 1,80 m, fecha os punhos, cria o esqueleto do jogo (15 ossos) e soma os pesos |
| `clothes.py`, `sneaker.py` | Calça cargo larga e cinto como deslocamento da malha; tênis paramétrico sem marca |
| `facefit.py` | Ajusta 285 alvos faciais simétricos aos 478 pontos do rosto detectados na ficha → `data/face_fit.json` |
| `views.py`, `fitcam.py`, `fit_views.py`, `manual.py`, `lm3d.py` | Vistas da ficha (frente, costas, lado, rosto de frente e perfil), pontos anatômicos e ajuste de câmera e pose → `data/views_fit.json` |
| `prep.py` | Apaga da ficha a corrente, a plaqueta e os brincos, que viram peças 3D |
| `bake.py`, `run_bake.py`, `pairs.py`, `uvmap.py`, `camera.py` | Projeção da ficha no mapa UV: deformação *thin-plate spline* por pontos, visibilidade, máscaras de oclusão e de fundo, harmonização de cor e espelho do lado oposto |
| `finish.py`, `build.py` | Preenche lacunas por material, atenua os brilhos especulares da foto e estende as ilhas do UV |
| `hair.py`, `extras.py` | Cabelo em mechas, olhos, corrente com plaqueta, argolas e fivela |
| `assemble.py`, `export.py`, `gltf.py` | Mapa de relevo e de rugosidade e gravação do `.glb` (glTF 2.0 com pele e esqueleto) |
| `compare.py`, `sheet.py`, `preview.py` | Conferência: reprojeção lado a lado com a ficha, folhas de anotação com grade e prévias rápidas |

## O que o `.glb` contém

- **Esqueleto:** os ossos `hips`, `spine`, `chest`, `neck`, `head`, `lSh`, `lEl`, `rSh`, `rEl`, `lHip`, `lKn`, `lAnk`, `rHip`, `rKn` e `rAnk`, com os mesmos nomes e eixos do jogo, mais os marcadores `lFist`, `rFist`, `lFoot` e `rFoot`.
- **Medidas da perna:** em `extras.seg` do nó raiz, usadas para apoiar o pé no chão.
- **Materiais:**
  - `corpo`: pele e calça, com cor 2048 px, relevo 1024 px e rugosidade 1024 px;
  - `tenis`, `cabelo` (com transparência), `olho`, `metal` e `placa`.
