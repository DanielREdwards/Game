# Noite em Mong Kok — protótipo jogável 03

Protótipo de jogo de ação em terceira pessoa ambientado em um quarteirão de Kowloon, à noite, sob chuva. Wei Leo atravessa quatro zonas (o beco, a Rua Fa Yuen, o mercado noturno e o pátio do templo de Tin Hau) e enfrenta quatro ondas da família Vittore: soldados de rua, Luca Moretti, Salvatore Ricci e, por fim, Don Vittore.

O combate é corpo a corpo de fluxo livre, com tiros a esquivar, armas improvisadas recolhidas do chão e confrontos de reflexo antes de cada luta. O visual é de neon sobre asfalto molhado.

Os personagens seguem a arte conceitual do titular, em [`docs/arte-conceitual/`](docs/arte-conceitual/), e a [especificação de personagens](docs/sala-limpa/ESPECIFICACAO-PERSONAGENS.md). O mapa segue a [especificação do mapa](docs/sala-limpa/ESPECIFICACAO-MAPA.md). Ondas, confronto, determinação e armas do chão seguem a [especificação de combate](docs/sala-limpa/ESPECIFICACAO-COMBATE.md), seções 11 a 16.

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
| Mover | WASD | Analógico esquerdo | Joystick |
| Atacar (com ou sem arma) | J / clique | □ / X | ATACAR |
| Contra-atacar | K / botão direito | △ / Y | CONTRA |
| Confronto (segurar e soltar no brilho) | segurar K | segurar △ / Y | segurar CONTRA |
| Esquivar (inclusive de tiros) | Espaço + direção | ✕ / A | ESQUIVA |
| Finalizar (3 de determinação) | F | ○ / B | FINAL |
| Curar (2 de determinação) | H | LB | CURAR |
| Pegar ou largar arma do chão | E | RB | PEGAR |
| Câmera | ← / → ou mouse (clique para travar o ponteiro) | Analógico direito | Arrastar à direita |
| Modo cinema em preto e branco | C | Select | Pausa |
| Pausa | Esc | Start | II |
| Som | M | — | Pausa |

**Sinais na tela:**
- **危** sobre um inimigo: golpe corpo a corpo a caminho. Contra-ataque. No fim da preparação, sai um contra-ataque perfeito (câmera lenta e dano dobrado). Golpes já comprometidos não param com socos, só com o contra-ataque.
- **閃** com linha de mira vermelha: tiro a caminho. Esquive para sair da linha. Esquivar logo antes do primeiro disparo gera uma esquiva perfeita.
- **Brilho de estrela** no adversário, durante o confronto: solte o botão de contra-ataque em até 0,4 s.
- **Vento** com pétalas e folhas: aponta a próxima zona depois de cada onda.

## O que o protótipo demonstra

**Mapa**
- Quarteirão de cerca de 100 m × 45 m com quatro zonas: beco, Rua Fa Yuen (calçadas, faixa "望右 LOOK RIGHT", táxis e micro-ônibus, obras nas pontas), mercado noturno 女人街 (barracas com toldos, lâmpadas e mercadorias) e templo de Tin Hau (telhado de beirais curvos, leões de pedra, urna de bronze com incenso, lanternas, figueira-de-bengala e bauhínia).
- Área caminhável por união de retângulos, obstáculos com deslizamento e câmera contida antes das fachadas.
- Oito luzes reais redistribuídas entre as dezenas de fontes do cenário e luz de poste com sombra que acompanha o poste mais próximo.
- Geometria estática agrupada por material, fachadas compartilhadas com tons diferentes e letreiros em camadas sobre a rua.

**Gráficos**
- Pipeline HDR com tone mapping ACES, *bloom* e gradação de cor cinematográfica (vinheta, granulação, aberração cromática sutil).
- Modo cinema em preto e branco, com contraste de filme e grão.
- Reflexo planar no asfalto molhado, com máscara de poças, desfoque por rugosidade e ondulações procedurais das gotas.
- Chuva na GPU, vapor de bueiro, fumaça de incenso, pétalas de bauhínia e feixes volumétricos dos postes.
- Resolução interna adaptativa.

**Personagens**
- Corpos contínuos (sem juntas aparentes) esculpidos por campo de distância: tronco descrito por seções medidas de um adulto, membros com perfil de músculos ou de tecido, extraídos por *surface nets* e deformados por esqueleto.
- Cabeças adultas esculpidas (mandíbula, arcadas, maçãs, nariz, lábios, orelhas), olhos em decalque amendoado, sobrancelhas fio a fio, barba e cabelo com topo desfiado.
- Wei Leo, Don Vittore, Luca Moretti, Salvatore Ricci e quatro tipos de soldado (dois de punho, com cano e brutamontes), com ternos dos anos 1930, sobretudo aberto, camisas, coletes, boinas e fedoras torneados.
- Geração em Web Workers durante o carregamento.

**Combate e progressão**
- Quatro ondas com cartão caligráfico de abertura (第一波 a 第四波), faixas de cinema e "tentar de novo" no início da onda.
- Confronto antes das ondas 2, 3 e 4, com fintas e até três adversários em sequência.
- Determinação (0 a 5) para finalizar e curar; contra-ataque e esquiva perfeitos.
- Armas do chão (garrafa, pau, pé de cabra e o cano largado pelos capangas), com usos contados e quebra.
- Seleção de alvo por direção, aproximação automática, sequência de golpes, contra-ataque múltiplo, esquiva com rolamento, finalização em câmera lenta, disparos com mira travada e diretor de fichas de ataque.

**Interface**
- Interface mínima inspirada no gênero de samurai (vida e determinação no canto, onda no alto), que some fora de combate.
- Teclado, mouse com ponteiro travado, controle (Gamepad API) e tela de toque.

## Estrutura

```
prototype/
  index.html          interface (tela inicial, HUD, cartões de onda, pausa, tela final, toque)
  src/
    main.js           laço principal, estados do jogo, pausa e "tentar de novo"
    renderer.js       HDR, bloom, gradação, modo P&B, resolução adaptativa
    map.js            áreas caminháveis, zonas, obstáculos e limites da câmera
    world.js          chão molhado, luzes, chuva, vapor, incenso e pétalas
    world/kit.js      lotes de geometria, fachadas, vitrines, letreiros, registro de luzes
    world/alley.js    o beco, táxi e postes
    world/street.js   Rua Fa Yuen: prédios, calçadas, faixa, carros e obras
    world/market.js   mercado noturno: barracas e portais
    world/temple.js   templo de Tin Hau: salão, leões, urna, lanternas e árvores
    textures.js       texturas procedurais em canvas
    body/sdf.js       sólidos de distância (elipsoide, cone, caixa, seções, tubos)
    body/mesher.js    extração de superfície (surface nets)
    body/humanoid.js  anatomia dos arquétipos, pesos de esqueleto, cabeças e cabelo
    body/paint.js     pintura de pele, tatuagens, roupas, rostos e olhos
    body/factory.js   esqueletos e geração em Web Workers
    body/worker.js    trabalhador de geração de malhas
    rig.js            personagem com pele, cabeça, olhos, chapéus e acessórios
    characters.js     elenco (protagonista, chefes e soldados)
    bodytex.js        dragões e nuvens das tatuagens; relevo → mapa de normais
    weapons.js        armas de fogo genéricas e armas do chão
    poses.js          poses, corrida, golpes, golpes com arma e poses do confronto
    fighter.js        base comum (quedas, levantada, colisão)
    player.js         Wei Leo: combate, determinação, cura e armas do chão
    enemy.js          chefes, soldados, disparos e diretor de combate
    waves.js          sistema de quatro ondas
    standoff.js       confronto
    pickups.js        armas do chão
    wind.js           vento-guia
    camera.js         câmera em terceira pessoa, mouse e enquadramento do confronto
    fx.js             partículas, clarões, cacos, brilho de estrela
    audio.js          áudio sintetizado
    input.js          teclado, mouse, controle e toque (inclusive botões segurados)
    hud.js            interface
docs/
  sala-limpa/PROTOCOLO.md                 regras jurídicas do desenvolvimento
  sala-limpa/ESPECIFICACAO-COMBATE.md     combate, determinação, armas do chão, ondas e confronto
  sala-limpa/ESPECIFICACAO-PERSONAGENS.md personagens, técnica de modelagem e cuidados jurídicos
  sala-limpa/ESPECIFICACAO-MAPA.md        zonas, navegação, iluminação e fundamentos
  arte-conceitual/                        fichas de personagem fornecidas pelo titular
  PROVENIENCIA.md                         origem e licença de cada componente
```

## Próximos passos sugeridos

1. Animação por captura de movimento própria e roupas com simulação de tecido.
2. Portar o combate para Unreal Engine 5 (Gameplay Ability System + Motion Warping); o mapa e as ondas viram níveis e *data assets*.
3. Tráfego e multidão no quarteirão, com NPCs que reagem à luta.
4. Inimigos com bloqueio e desarme de atiradores no corpo a corpo.
