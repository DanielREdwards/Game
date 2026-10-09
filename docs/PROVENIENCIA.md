# Registro de Proveniência

Inventário de tudo que compõe o protótipo, com origem e licença. Deve ser atualizado a cada novo arquivo ou dependência (ver `docs/sala-limpa/PROTOCOLO.md`, item 5).

## Elementos originais do projeto

| Elemento | Onde está | Como foi criado |
|---|---|---|
| Código do jogo (combate, IA, câmera, renderização) | `prototype/src/*.js` | Escrito para este projeto |
| Personagens (Kai e três capangas) | `prototype/src/rig.js`, `player.js`, `enemy.js` | Montados com primitivas geométricas (cápsulas e esferas) |
| Animações (golpes, quedas, corrida) | `prototype/src/poses.js` | Poses autorais, interpoladas por código |
| Cenário (prédios, lojas, táxi, adereços) | `prototype/src/world.js` | Geometria procedural |
| Texturas (fachadas, asfalto, letreiros, roupas) | `prototype/src/textures.js` | Desenhadas em `<canvas>` no momento da execução |
| Letreiros | `prototype/src/world.js` | Palavras comuns do cotidiano de Hong Kong: 茶餐廳, 藥房, 麻雀館 etc. Nenhuma marca, logotipo ou estabelecimento real |
| Sinal de perigo 危 com anel que se contrai | `prototype/src/textures.js`, `enemy.js` | Design próprio |
| Efeitos sonoros e trilha | `prototype/src/audio.js` | Sintetizados em tempo real (Web Audio API); nenhum arquivo de áudio |
| Interface (tela inicial, HUD, tela final) | `prototype/index.html` | Escrita para este projeto |

## Componentes de terceiros

| Componente | Versão | Licença | Forma de uso |
|---|---|---|---|
| three.js | 0.160.0 | MIT (© 2010–2023 three.js authors) | Carregado via CDN jsDelivr; módulos `EffectComposer`, `UnrealBloomPass`, `OutputPass`, `ShaderPass`, `RenderPass` e `Reflector` |
| Big Shoulders Display | — | SIL Open Font License 1.1 | Google Fonts |
| IBM Plex Mono | — | SIL Open Font License 1.1 | Google Fonts |
| Noto Sans TC | — | SIL Open Font License 1.1 | Google Fonts |

A licença MIT permite uso, cópia, modificação e distribuição, desde que o aviso de copyright e a licença acompanhem cópias substanciais do software. Se a biblioteca passar a ser empacotada junto com o jogo, o texto da licença MIT deve ser incluído na distribuição.

## Nomes

- **"Beco de Mong Kok"** é codinome de trabalho. Mong Kok (旺角) é um bairro real de Kowloon, usado como ambientação genérica. O título comercial definitivo depende de busca de anterioridade no INPI e deve ter distintividade suficiente: a Lei nº 9.279/1996, art. 124, VI, veda o registro de sinal "simplesmente descritivo".
- **"Kai" (啟)** é personagem original.
