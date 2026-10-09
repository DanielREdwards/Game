# Especificação de Personagens

**Status:** implementada · protótipo 02, revisada no protótipo 03 (seções 4 a 7) e no protótipo 04 (seção 8, Wei Leo realista)
**Fonte:** arte conceitual fornecida pelo titular do projeto, arquivada em `docs/arte-conceitual/`. A família Vittore e os soldados são interpretações procedurais dessa arte. Wei Leo, desde o protótipo 04, usa uma base humana de domínio público (CC0) com a pele projetada da própria ficha do titular (seção 8). Nenhum arquivo de outros jogos é usado.

---

## 1. Protagonista: Wei Leo

| Atributo | Valor |
|---|---|
| Altura | 1,80 m (escala 1,00 no jogo) |
| Origem | Hong Kong |
| Físico | Atlético, ombros largos, cintura estreita |
| Idade aparente | 25 anos |

**Figurino:** sem camisa; calça cargo preta folgada com bolsos laterais; cinto preto com fivela prateada; tênis de cano alto preto e branco **sem logotipo**; corrente prateada com plaqueta; brincos de argola prateados.

**Cabelo:** preto, laterais curtas e topo desfiado, com mechas caindo na testa.

**Tatuagens** (desenho próprio, em preto e cinza):

| Local | Conteúdo |
|---|---|
| Peito esquerdo | Cabeça de dragão e os ideogramas 香港 ("Hong Kong") na vertical |
| Braço esquerdo, fechado | Dragão serpenteando do ombro ao punho, entre nuvens |
| Costas | Dragão em "S" do ombro à lombar; 洪門 na vertical, sobre a escápula direita |

## 2. Família Vittore (antagonistas)

| Personagem | Função | Altura | Visual | Arma | Papel no combate |
|---|---|---|---|---|---|
| **Don Vittore** | Chefão | 1,82 m | Terno vermelho risca de giz com colete, chapéu vermelho de faixa preta, óculos escuros, barba grisalha, charuto aceso | Submetralhadora de tambor | Chefe: mais resistente; golpe de coronha por cima (contra-atacável) e rajadas longas (esquiváveis) |
| **Luca Moretti** | Capo / executor | 1,78 m | Terno azul risca de giz, chapéu creme de faixa preta, gravata branca, tatuagem no pescoço, sapatos bicolores | Pistola semiautomática dourada | Rápido: coronhada curta e dois disparos seguidos |
| **Salvatore Ricci** | Assassino | 1,85 m | Terno verde, sobretudo preto longo, chapéu verde, óculos escuros, luvas pretas, broche dourado, cigarro | Submetralhadora de tambor | Atirador: prefere manter distância e disparar rajadas |

## 3. Cuidados jurídicos aplicados ao visual

1. **Calçados sem marca.** A arte conceitual sugere tênis em estilo de modelos de mercado. No jogo, o tênis é genérico, sem logotipo nem combinação de elementos que imite conjunto-imagem de terceiros. Fundamentos:
   - Lei nº 9.279/1996, art. 129, que assegura ao titular o "uso exclusivo" da marca;
   - art. 189, I, que tipifica a reprodução ou imitação "de modo que possa induzir confusão";
   - art. 195, III, que trata de concorrência desleal.
2. **Armas com nomes genéricos.** O jogo diz "submetralhadora de tambor" e "pistola semiautomática", sem marcas de fabricantes nem gravações de logotipos.
3. **Nomes de personagens.** São livres, pois a Lei nº 9.610/1998, art. 8º, VI, exclui da proteção autoral "os nomes e títulos isolados". Recomenda-se, ainda assim, pesquisa antes de usá-los como marca.
4. **Arte gerada por ferramentas de IA.** Se a arte conceitual tiver sido gerada assim, convém registrar a contribuição humana (instruções, seleção e edição). A Lei nº 9.610/1998, art. 11, define que "Autor é a pessoa física criadora de obra literária, artística ou científica". Convém também conferir os termos de uso da ferramenta empregada.
5. **Rostos.** Nenhum rosto do jogo pode reproduzir pessoa real identificável. Fundamentos:
   - Constituição Federal, art. 5º, X, que declara invioláveis "a intimidade, a vida privada, a honra e a imagem das pessoas";
   - Código Civil, art. 20, que permite proibir a utilização da imagem "se lhe atingirem a honra, a boa fama ou a respeitabilidade, ou se se destinarem a fins comerciais".

## 4. Soldados da família Vittore (protótipo 03)

Capangas de rua no mesmo universo estético dos chefes (anos 1930):

| Tipo | Figurino |
|---|---|
| De punho, variante A | Camisa clara de mangas dobradas, suspensórios, calça marrom, boina de jornaleiro |
| De punho, variante B | Camisa azul listrada, colete cinza, calça cinza, boina escura |
| Com cano | Colete escuro sobre camisa, calça escura, boina, cano de ferro |
| Brutamontes | Regata, suspensórios, calça larga, cabeça raspada, porte pesado |

## 5. Técnica de modelagem (para eliminar o aspecto de boneco)

1. **Corpo contínuo.** Cada corpo é uma malha única gerada por campo de distância e extraída por *surface nets*. Não há juntas esféricas aparentes.
2. **Tronco por seções.** O tronco é descrito por seções horizontais (meia-largura, profundidade da frente e das costas) medidas de um homem adulto de 1,80 m: pescoço com cerca de 40 cm de circunferência, ombros de 41 cm entre os acrômios, cintura mais estreita que o peito e glúteos. As curvas entre as seções são suaves e não ultrapassam os valores medidos.
3. **Membros por perfil.** Braços e pernas são tubos com perfil de raios ao longo do osso: deltoide, bíceps e tríceps, antebraço que afina no punho, coxa e panturrilha. Nas roupas, o perfil é o do tecido: mangas retas, calça larga dos anos 1930, calça cargo folgada.
4. **Roupas com volume próprio.** Paletó com ombros largos e barra cobrindo o assento; sobretudo aberto da cintura para baixo, com fenda atrás; camisa por dentro da calça; regata do brutamontes.
5. **Pele com esqueleto.** Pesos de deformação suaves: o tronco passa do quadril para a coluna, o peito e o pescoço conforme a altura; o ombro passa do peito para o braço ao longo do úmero; a raiz da coxa passa do quadril para a perna; a barra do paletó e do sobretudo acompanha as coxas em parte.
6. **Cabeça adulta esculpida.** Crânio e nuca, maciço facial, mandíbula angulosa com ramo até a orelha, queixo quadrado, maçãs, arcada supraciliar, nariz com asas, lábios e orelhas rentes. Olhos em **decalque amendoado** (esclera, íris, pupila e linha dos cílios) sobre o globo esculpido, com a pálpebra superior cobrindo parte da íris, para evitar o olhar arregalado.
7. **Pintura.** Pele com variação de tom (testa mais clara, nariz e orelhas rosados), sombra de barba feita, sobrancelhas fio a fio, lábios em tom sóbrio, definição muscular masculina (borda reta do peitoral, abdome em blocos) e tatuagens; roupas pintadas num atlas de 1024 px por personagem.
8. **Cabelo e chapéus.** Topo desfiado com mechas curtas e franja caindo na testa; laterais raspadas pintadas em degradê. Fedoras e boinas torneados, com copa vincada e aba fina.
9. **Proporções adultas.** Cerca de 7,8 cabeças de altura.

## 6. Inspiração declarada em Ghost of Tsushima: ideias, não expressão

| Ideia de jogo (livre) | Expressão própria deste projeto |
|---|---|
| Recurso que cura e habilita técnicas | **Determinação**, com regras e valores próprios (seção 11 da especificação de combate) |
| Duelo de tempo antes da luta | **Confronto** com brilho de estrela, fintas e encadeamento próprios |
| Vento que guia o jogador | Folhas, pétalas de bauhínia e rastros de vento de Hong Kong |
| Interface mínima, que some fora de combate | Interface com tipografia, cores e ideogramas próprios |
| Pétalas e folhas ao vento | Bauhínia (flor-símbolo de Hong Kong) e figueira-de-bengala do templo |
| Modo de cinema em preto e branco | "Modo cinema P&B", sem referência a nomes de terceiros |

**Fundamentos:**
- Ideias, sistemas e regras de jogo não são protegidos (Lei nº 9.610/1998, art. 8º, I e II). Nada de código, arte, música, textos ou interface do jogo de referência é reproduzido.
- O nome "Ghost of Tsushima" e seus sinais não aparecem no jogo nem em material de divulgação (Lei nº 9.279/1996, arts. 129 e 195, III).

## 7. Nome do protagonista

"Wei" é prenome e sobrenome chinês muito comum, e o nome completo **Wei Leo** é distinto de personagens existentes. Nomes isolados não são protegidos (Lei nº 9.610/1998, art. 8º, VI).

A divulgação deve evitar associar o jogo a personagens ou títulos de terceiros, para afastar alegação de concorrência desleal (Lei nº 9.279/1996, art. 195, III).

## 8. Wei Leo realista (protótipo 04)

**Pedido do titular:** o personagem "exatamente como na foto", mais realista, usando a ficha que ele mesmo desenhou e cujo uso autorizou.

### 8.1 Por que a técnica anterior não chegava lá

Os corpos esculpidos por campo de distância (seção 5) são somas de formas geométricas (elipsoides, tubos, seções) pintadas por código. Servem para personagens estilizados, mas não reproduzem a anatomia fina de um rosto, de mãos e de músculos. Por isso não alcançam uma imagem fotográfica. A limitação era técnica, não jurídica: a ficha sempre foi a referência do personagem.

### 8.2 Técnica adotada

| Etapa | O que é feito | Origem do material |
|---|---|---|
| 1. Base humana | Malha masculina realista (13.380 vértices, só quadriláteros), esqueleto e pesos de deformação | MakeHuman, assets em **CC0 1.0**, baixados do repositório oficial |
| 2. Forma do corpo | Alvos de forma (homem, 25 anos, musculatura alta, proporções ideais, traços asiáticos) e reforços de peitoral, dorsais, ombros e braços; altura 1,80 m | Alvos CC0 do MakeHuman, com pesos escolhidos para casar com a ficha |
| 3. Forma do rosto | Ajuste automático de 285 alvos faciais (simétricos) aos 478 pontos do rosto detectados na ficha; erro médio caiu de 3,4 px para 1,2 px | Pontos detectados por MediaPipe (ferramenta Apache 2.0, só na preparação) |
| 4. Punhos | Dedos e polegar fechados em punho, cozidos na malha | Rotação dos ossos dos dedos da base CC0 |
| 5. Esqueleto do jogo | Os 15 ossos do jogo recebem a posição das juntas da base; os pesos dos 163 ossos da base são somados nos ossos do jogo | Código próprio |
| 6. Roupa | Calça cargo larga e cinto como deslocamento da própria malha; tênis paramétrico de cano médio, sem marca | Código próprio |
| 7. Pele | **Projeção da ficha do titular** sobre o mapa UV: 7 vistas (frente, costas, lado e seu espelho, rosto de frente, perfil e seu espelho), câmera e pose ajustadas por pontos, deformação fina por *thin-plate spline*, máscaras de oclusão (braço na frente do tronco, fundo da foto), harmonização de cor entre vistas, mãos em tom uniforme, brilhos especulares da foto atenuados | Ficha do titular (`docs/arte-conceitual/protagonista.png`) |
| 8. Limpeza da ficha | Corrente, plaqueta e brincos apagados da foto antes da projeção (viram peças 3D) | Ficha do titular |
| 9. Cabelo | 585 mechas em cartões com transparência (topo desfiado para a frente, franja, transição curta nas laterais); o degradê das laterais e da nuca vem da própria ficha | Código próprio |
| 10. Olhos e acessórios | Globos oculares com íris castanho-escura e verniz (*clearcoat*); corrente, plaqueta com gravação geométrica genérica, argolas e fivela | Código próprio |
| 11. Arquivo | `prototype/assets/wei-leo.glb` (glTF 2.0, cerca de 2,3 MB), aberto também em Blender | Gerado por `tools/wei-leo/` |

O processo inteiro é reproduzível com `python tools/wei-leo/build.py` (ver `tools/wei-leo/README.md`).

### 8.3 Limites honestos

1. A ficha é uma imagem 2D com vistas que não coincidem entre si: a manga do braço esquerdo aparece na frente e no lado, mas não na vista de costas. O modelo adota a manga completa, pois é o que a frente, o lado e o detalhe do braço mostram.
2. As regiões que nenhuma vista mostra (alto dos ombros, axilas, entrepernas, sola dos pés) são preenchidas a partir da vizinhança.
3. A resolução da ficha (1024 × 1536 px para todas as vistas) limita a nitidez em closes extremos. A textura tem 2048 px, mas o detalhe útil é o da foto.
4. A iluminação de estúdio da foto fica em parte "pintada" na pele. Na noite chuvosa do jogo, isso lembra oclusão ambiente e passa despercebido.

### 8.4 Fundamentos jurídicos

1. **Obra do titular.** "Pertencem ao autor os direitos morais e patrimoniais sobre a obra que criou" (Lei nº 9.610/1998, art. 22). O modelo 3D com a pele projetada é uma transformação da ficha, que "depende de autorização prévia e expressa do autor" (art. 29, III). A autorização foi dada pelo próprio titular.
   - Se uma empresa vier a explorar o jogo, a cessão ou a licença deve ser feita por escrito: "A cessão total ou parcial dos direitos de autor, que se fará sempre por escrito, presume-se onerosa" (art. 50).
2. **Base CC0 do MakeHuman.** A licença dos assets declara que foram "released under CC0 1.0 Universal". Há duas ressalvas:
   - No Brasil, "Os direitos morais do autor são inalienáveis e irrenunciáveis" (art. 27). Entre eles está o de ter o nome indicado na utilização da obra (art. 24, II).
   - Por isso, o projeto credita a MakeHuman no registro de proveniência e no README, ainda que a CC0 não o exija.
3. **MediaPipe.** É uma ferramenta usada só na preparação, sob licença Apache 2.0, e não é distribuída com o jogo. Os pontos que ela detecta são dados de medição e não carregam restrição.
4. **Tênis.** O par da ficha lembra um modelo de mercado com marca lateral. O tênis do jogo não tem logotipo e usa painéis e uma faixa reta genéricos, conforme a seção 3, item 1 (Lei nº 9.279/1996, arts. 129, 189, I, e 195, III).
5. **Rosto.** O rosto do jogo é o da ficha. Antes de uso comercial, o titular deve confirmar que ele não reproduz pessoa real identificável (seção 3, item 5: Constituição Federal, art. 5º, X; Código Civil, art. 20). O cuidado é maior se a ficha tiver sido feita com auxílio de IA a partir de fotografias.
