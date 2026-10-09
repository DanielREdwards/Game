# Beco de Mong Kok — protótipo jogável 01

Protótipo de jogo de ação em terceira pessoa ambientado em um beco de Kowloon, à noite, sob chuva. Três capangas, combate corpo a corpo de fluxo livre e visual de neon sobre asfalto molhado.

Tudo é **original e gerado por procedimento**: personagens, cenário, texturas, animações e sons nascem do próprio código. Nenhum arquivo ou código de outros jogos foi usado. O processo segue o protocolo de [sala limpa](docs/sala-limpa/PROTOCOLO.md).

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
| Esquivar | Espaço + direção | ✕ / A | ESQUIVA |
| Finalizar (medidor cheio) | F | ○ / B | FINAL |
| Câmera | Q / E | Analógico direito | — |
| Som | M | — | — |

**Dica:** quando o sinal **危** acender sobre um inimigo, contra-ataque.

## O que o protótipo demonstra

**Gráficos**
- Pipeline HDR com tone mapping ACES, *bloom* e gradação de cor cinematográfica (vinheta, granulação, aberração cromática sutil).
- Reflexo planar no asfalto molhado, com máscara de poças, desfoque por rugosidade e ondulações procedurais das gotas.
- Letreiros de neon e caixas luminosas desenhados em canvas, alguns piscando.
- Chuva e respingos animados na GPU, vapor de bueiro e feixe volumétrico do poste.
- Sombras suaves do poste e luzes coloridas de cada letreiro.
- Resolução interna adaptativa para manter a fluidez em máquinas modestas.

**Combate**
- Seleção de alvo por direção e aproximação automática até o alcance do golpe.
- Sequência de 12 golpes com janelas de cancelamento.
- Contra-ataque múltiplo, esquiva com rolamento e finalização em câmera lenta.
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
    rig.js          esqueleto articulado e material com luz de contorno
    poses.js        poses, ciclo de corrida e golpes
    fighter.js      base comum (quedas, levantada, sincronia de pose)
    player.js       protagonista e sistema de combate
    enemy.js        capangas e diretor de combate
    camera.js       câmera em terceira pessoa
    fx.js           partículas, clarões e ondas de choque
    audio.js        áudio sintetizado
    input.js        teclado, mouse, controle e toque
    hud.js          atualização da interface
docs/
  sala-limpa/PROTOCOLO.md            regras jurídicas do desenvolvimento
  sala-limpa/ESPECIFICACAO-COMBATE.md especificação funcional do combate
  PROVENIENCIA.md                    origem e licença de cada componente
```

## Próximos passos sugeridos

1. Substituir os bonecos procedurais por personagens modelados e animados por captura de movimento própria.
2. Portar o sistema de combate para Unreal Engine 5. A arquitetura (diretor de fichas, seleção de alvo e aproximação automática) se traduz para Gameplay Ability System + Motion Warping.
3. Ampliar o cenário para um quarteirão com tráfego e multidão.
4. Adicionar inimigos com armas, bloqueio e golpes que não podem ser contra-atacados.
