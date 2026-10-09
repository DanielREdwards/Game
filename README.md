# Beco de Mong Kok — protótipo jogável 02

Protótipo de jogo de ação em terceira pessoa ambientado em um beco de Kowloon, à noite, sob chuva. O protagonista enfrenta a família Vittore (Don Vittore, Luca Moretti e Salvatore Ricci) em combate corpo a corpo de fluxo livre, com tiros a esquivar, e visual de neon sobre asfalto molhado.

Os personagens seguem a arte conceitual do titular, em [`docs/arte-conceitual/`](docs/arte-conceitual/), e a [especificação de personagens](docs/sala-limpa/ESPECIFICACAO-PERSONAGENS.md).

Os modelos, o cenário, as texturas (inclusive as tatuagens), as animações e os sons são **gerados por procedimento** no próprio código. Nenhum arquivo ou código de outros jogos foi usado. O processo segue o protocolo de [sala limpa](docs/sala-limpa/PROTOCOLO.md).

## Como jogar

Requer navegador com WebGL 2 (Chrome, Edge, Firefox ou Safari recentes) e internet para carregar o three.js e as fontes.

```bash
# na raiz do repositório
npx serve prototype
# ou
python3 -m http.server 8080 --directory prototype
```

Depois, abra `http://localhost:3000` (serve) ou `http://localhost:8080` (Python).

| Ação | Teclado/mouse | Controle | Toque |
|---|---|---|---|
| Mover | WASD / setas | Analógico esquerdo | Joystick |
| Atacar | J / clique | □ / X | ATACAR |
| Contra-atacar | K / botão direito | △ / Y | CONTRA |
| Esquivar (inclusive de tiros) | Espaço + direção | ✕ / A | ESQUIVA |
| Finalizar (medidor cheio) | F | ○ / B | FINAL |
| Câmera | Q / E | Analógico direito | — |
| Som | M | — | — |

**Sinais de perigo:**
- **危** sobre um inimigo: golpe corpo a corpo a caminho. Contra-ataque.
- **閃** com linha de mira vermelha: tiro a caminho. Esquive para sair da linha. Sem direção, o rolamento sai sozinho para o lado.

## O que o protótipo demonstra

**Gráficos**
- Pipeline HDR com tone mapping ACES, *bloom* e gradação de cor cinematográfica (vinheta, granulação, aberração cromática sutil).
- Reflexo planar no asfalto molhado, com máscara de poças, desfoque por rugosidade e ondulações procedurais das gotas.
- Letreiros de neon e caixas luminosas desenhados em canvas, alguns piscando.
- Chuva e respingos animados na GPU, vapor de bueiro e feixe volumétrico do poste.
- Sombras suaves do poste e luzes coloridas de cada letreiro.
- Resolução interna adaptativa para manter a fluidez em máquinas modestas.

**Personagens**
- Protagonista sem camisa, com relevo muscular por mapa de normais, tatuagens de dragão desenhadas por código (香港 no peito, manga no braço esquerdo, dragão e 洪門 nas costas), calça cargo, corrente com plaqueta e brincos.
- Don Vittore (chefe, com barra de vida própria), Luca Moretti e Salvatore Ricci: ternos risca de giz com colete, gravata e lenço; chapéus; óculos escuros; charuto e cigarros acesos com fumaça; sobretudo longo; pistola dourada e submetralhadoras de tambor.

**Combate**
- Seleção de alvo por direção e aproximação automática até o alcance do golpe.
- Sequência de 12 golpes com janelas de cancelamento.
- Contra-ataque múltiplo, esquiva com rolamento e finalização em câmera lenta.
- Disparos com mira travada, rastro de bala, clarão no cano e esquiva lateral automática.
- Diretor de combate que distribui "fichas" de ataque entre os inimigos.
- *Hit-stop*, tremor de câmera, faíscas e respingos no impacto.

**Plataformas**
- Teclado, mouse, controle (Gamepad API) e tela de toque.

## Estrutura

```
prototype/
  index.html        interface (tela inicial, HUD, tela final, controles de toque)
  src/
    main.js         laço principal e estados do jogo
    renderer.js     renderização HDR, bloom, gradação, resolução adaptativa
    world.js        beco, prédios, letreiros, chão molhado, chuva, vapor
    textures.js     texturas procedurais em canvas
    rig.js          esqueleto articulado, rosto, figurino e acessórios
    characters.js   visual de cada personagem (a partir da arte conceitual)
    bodytex.js      pele, relevo muscular, tatuagens, ternos e tecidos
    weapons.js      submetralhadora de tambor e pistola (genéricas)
    poses.js        poses, ciclo de corrida e golpes
    fighter.js      base comum (quedas, levantada, sincronia de pose)
    player.js       protagonista e sistema de combate
    enemy.js        família Vittore, disparos e diretor de combate
    camera.js       câmera em terceira pessoa
    fx.js           partículas, clarões e ondas de choque
    audio.js        áudio sintetizado
    input.js        teclado, mouse, controle e toque
    hud.js          atualização da interface
docs/
  sala-limpa/PROTOCOLO.md            regras jurídicas do desenvolvimento
  sala-limpa/ESPECIFICACAO-COMBATE.md especificação funcional do combate
  sala-limpa/ESPECIFICACAO-PERSONAGENS.md especificação dos personagens e cuidados jurídicos
  arte-conceitual/                   fichas de personagem fornecidas pelo titular
  PROVENIENCIA.md                    origem e licença de cada componente
```

## Próximos passos sugeridos

1. Substituir os bonecos procedurais por personagens modelados e animados por captura de movimento própria.
2. Portar o sistema de combate para Unreal Engine 5. A arquitetura (diretor de fichas, seleção de alvo e aproximação automática) se traduz para Gameplay Ability System + Motion Warping.
3. Ampliar o cenário para um quarteirão com tráfego e multidão.
4. Desarmar atiradores no corpo a corpo e adicionar inimigos com bloqueio.
