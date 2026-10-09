# Registro de Proveniência

Inventário de tudo que compõe o protótipo, com origem e licença. Deve ser atualizado a cada novo arquivo ou dependência (ver `docs/sala-limpa/PROTOCOLO.md`, item 5).

## Elementos originais do projeto

| Elemento | Onde está | Como foi criado |
|---|---|---|
| Código do jogo (combate, IA, ondas, confronto, câmera, renderização) | `prototype/src/*.js` | Escrito para este projeto |
| Arte conceitual dos personagens | `docs/arte-conceitual/` | Fornecida pelo titular do projeto |
| Wei Leo (modelo realista) | `prototype/assets/wei-leo.glb`, gerado por `tools/wei-leo/` | Base humana CC0 do MakeHuman, com forma ajustada à ficha do titular; pele, tatuagens, rosto e calça **projetados da própria ficha** (`docs/arte-conceitual/protagonista.png`); cabelo em mechas, olhos, tênis sem marca, corrente, plaqueta, argolas e fivela modelados por código próprio |
| Corpos dos demais personagens | `prototype/src/body/sdf.js`, `mesher.js`, `humanoid.js`, `factory.js`, `worker.js` | Campo de distância com sólidos próprios (seções do tronco medidas de um adulto, tubos com perfil de músculos ou de tecido, peças de roupa), extração por *surface nets* e pesos de esqueleto calculados por código |
| Cabeças, olhos, cabelo e chapéus | `prototype/src/body/humanoid.js`, `paint.js`, `rig.js` | Esculpidos por sólidos de distância e geometria de revolução; olhos em decalque pintado em canvas |
| Tatuagens, ternos, camisas, rostos e relevo muscular | `prototype/src/body/paint.js`, `bodytex.js` | Desenhados em `<canvas>` no momento da execução; relevo convertido em mapa de normais por código |
| Elenco (Wei Leo, família Vittore e soldados) | `prototype/src/characters.js` | Wei Leo carregado do `.glb`; os demais são interpretação procedural da arte conceitual e da especificação dos soldados |
| Pipeline do Wei Leo | `tools/wei-leo/*.py`, `tools/wei-leo/data/` | Código próprio em Python: ajuste de forma, esqueleto do jogo, roupa, projeção da ficha em 7 vistas, cabelo, olhos, acessórios e gravador glTF. `data/` guarda os parâmetros ajustados (rosto e câmeras) |
| Armas de fogo e armas do chão | `prototype/src/weapons.js`, `pickups.js` | Geometria genérica, sem marcas nem logotipos |
| Animações (golpes, golpes com arma, quedas, corrida, confronto) | `prototype/src/poses.js` | Poses autorais, interpoladas por código |
| Mapa (beco, Rua Fa Yuen, mercado, templo) | `prototype/src/map.js`, `world.js`, `world/*.js` | Geometria procedural; arquitetura genérica; o templo é um desenho próprio de templo de Tin Hau, sem copiar edifício real |
| Leões de pedra | `prototype/src/world/temple.js` | Esculpidos por sólidos de distância |
| Texturas (fachadas, asfalto, calçadas, granito, telhas, toldos, letreiros) | `prototype/src/textures.js`, `world/*.js` | Desenhadas em `<canvas>` no momento da execução |
| Letreiros e marcações | `prototype/src/world/*.js` | Palavras comuns do cotidiano de Hong Kong (茶餐廳, 藥房, 涼茶, 金行, 夜市 etc.), nomes de lugares públicos (女人街, 天后廟) e a marcação de trânsito "望右 LOOK RIGHT". Nenhuma marca, logotipo ou estabelecimento real |
| Sinais 危, 閃 e brilho de estrela | `prototype/src/textures.js`, `fx.js` | Design próprio |
| Ondas, confronto, determinação e vento-guia | `prototype/src/waves.js`, `standoff.js`, `player.js`, `wind.js` | Regras próprias, registradas na especificação antes do código |
| Efeitos sonoros e trilha | `prototype/src/audio.js` | Sintetizados em tempo real (Web Audio API); nenhum arquivo de áudio |
| Interface (tela inicial, HUD, cartões de onda, pausa, tela final) | `prototype/index.html`, `prototype/src/hud.js` | Escrita para este projeto |

## Componentes de terceiros

| Componente | Versão | Licença | Forma de uso |
|---|---|---|---|
| three.js | 0.160.0 | MIT (© 2010–2023 three.js authors) | Carregado via CDN jsDelivr; módulos `EffectComposer`, `UnrealBloomPass`, `OutputPass`, `ShaderPass`, `RenderPass`, `Reflector` e `BufferGeometryUtils` |
| Big Shoulders Display | — | SIL Open Font License 1.1 | Google Fonts |
| IBM Plex Mono | — | SIL Open Font License 1.1 | Google Fonts |
| Noto Sans TC | — | SIL Open Font License 1.1 | Google Fonts |
| Noto Serif TC | — | SIL Open Font License 1.1 | Google Fonts |
| LXGW WenKai TC | — | SIL Open Font License 1.1 | Google Fonts (caligrafia dos cartões de onda, tatuagens e avisos) |
| MakeHuman — malha-base, esqueleto, pesos e alvos de forma | repositório `makehumancommunity/makehuman`, ramo `master` | **CC0 1.0 Universal** (`LICENSE.ASSETS.md` do repositório; os arquivos `.target` trazem "explicitly released as CC0") | Base do Wei Leo, já transformada e embutida em `wei-leo.glb`; baixada por `tools/wei-leo/fetch.py`. Crédito: MakeHuman Team (www.makehumancommunity.org); titulares à época da liberação: Data Collection AB, Joel Palmius e Jonas Hauquier |
| MediaPipe Face Landmarker e Pose Landmarker | modelos `float16/1` | Apache 2.0 | **Só na preparação** (detectar pontos do rosto e do corpo na ficha e no modelo); não é distribuído com o jogo |
| three.js `GLTFLoader` e `SkeletonUtils` | 0.160.0 | MIT | Carregar o `.glb` e clonar o esqueleto do Wei Leo |

A CC0 1.0 é uma renúncia aos direitos patrimoniais "na máxima extensão permitida por lei", com licença ampla subsidiária. No Brasil, porém, "Os direitos morais do autor são inalienáveis e irrenunciáveis" (Lei nº 9.610/1998, art. 27), entre eles o de ter o nome indicado na utilização da obra (art. 24, II). Por isso, o crédito à MakeHuman é mantido acima e no README.

A licença MIT permite uso, cópia, modificação e distribuição, desde que o aviso de copyright e a licença acompanhem cópias substanciais do software. Se a biblioteca passar a ser empacotada junto com o jogo, o texto da licença MIT deve ser incluído na distribuição. A SIL Open Font License 1.1 permite usar as fontes em produtos comerciais; só proíbe vendê-las isoladamente e exige que versões modificadas não usem o nome reservado da fonte.

## Inspirações declaradas

| Referência | O que foi aproveitado | O que **não** foi aproveitado |
|---|---|---|
| Jogos de ação em mundo urbano com combate de fluxo livre | Ideias e sistemas de jogo (fichas de ataque, contra-ataque, aproximação automática) | Código, arte, sons, textos e interface |
| Jogos de samurai em mundo aberto | Ideias de jogo (recurso que cura, duelo de reflexo antes da luta, vento que guia, interface mínima, modo em preto e branco) | Nome, sinais, arte, música, textos e interface; nada disso aparece no jogo nem na divulgação |

Fundamentos: Lei nº 9.610/1998, art. 8º, I e II (ideias, sistemas e regras de jogo não são protegidos); Lei nº 9.279/1996, arts. 129 e 195, III (marcas e concorrência desleal). Detalhes na seção 6 da especificação de personagens.

## Nomes

- **"Noite em Mong Kok"** é codinome de trabalho (o anterior era "Beco de Mong Kok"). Mong Kok (旺角) é um bairro real de Kowloon, usado como ambientação genérica. O título comercial definitivo depende de busca de anterioridade no INPI e deve ter distintividade suficiente: a Lei nº 9.279/1996, art. 124, VI, veda o registro de sinal "simplesmente descritivo".
- **Wei Leo** é o nome do protagonista definido pelo titular (substitui o provisório "Kai"). Ver a seção 7 da especificação de personagens.
- **Don Vittore, Luca Moretti e Salvatore Ricci** são nomes definidos pelo titular. Nomes isolados não são protegidos por direito autoral (Lei nº 9.610/1998, art. 8º, VI).
- **Fa Yuen Street, Tung Choi Street (女人街) e templo de Tin Hau** são lugares e designações públicas, usados como ambientação genérica (Lei nº 9.610/1998, arts. 8º, VI, e 48).
