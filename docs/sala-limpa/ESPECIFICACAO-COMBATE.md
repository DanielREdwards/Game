# Especificação Funcional — Combate de Fluxo Livre

**Status:** aprovada para implementação · protótipo 01, ampliada no protótipo 02 (seção 7-A) e no protótipo 03 (seções 11 a 15)
**Fonte:** convenções públicas do gênero de ação corpo a corpo em terceira pessoa, descritas em linguagem própria. Nenhum valor, arte ou texto foi extraído de jogo de terceiros.

> Esta especificação descreve **ideias e regras de jogo**, matéria não protegida nos termos da Lei nº 9.610/1998, art. 8º, I e II. Todos os elementos de **expressão** (nomes, aparência, sinais visuais, sons e valores numéricos) foram criados para este projeto.

---

## 1. Princípios

1. **Um botão, muitos alvos.** O jogador ataca com um só comando; o sistema escolhe o alvo e aproxima o personagem dele.
2. **Ritmo acima de execução.** O desafio está em reagir ao tempo dos adversários, não em decorar sequências.
3. **Legibilidade.** Poucos inimigos atacam ao mesmo tempo, e todo ataque é anunciado.

## 2. Seleção de alvo

Ao atacar, cada inimigo apto (em pé e a até 11 m) recebe uma pontuação.

- **Com direção informada** pelo jogador:
  `pontuação = 3 × cos(ângulo entre a direção e o inimigo) − 0,32 × distância`.
  Inimigos fora de um cone aproximado (cosseno < 0,25) só são considerados se estiverem a menos de 1,6 m.
- **Sem direção informada:**
  `pontuação = −0,6 × distância`, com bônus de +1,0 para o último alvo atingido.
- **Bônus de ameaça:** +0,4 para o inimigo que está avançando ou preparando golpe.

Vence a maior pontuação.

## 3. Aproximação automática

1. Se o alvo estiver além do alcance do golpe + 1,6 m, o personagem **corre** até ele (até 15 m/s).
2. Durante a antecipação do golpe, a posição é interpolada até a distância de alcance (≈ 0,8–1,05 m), com curva de desaceleração.
3. Se o alvo estiver a mais de 4,6 m no início, usa-se o **chute voador**.

## 4. Golpes e encadeamento

| Golpe | Duração (s) | Instante do impacto | Dano | Observação |
|---|---|---|---|---|
| Direto de esquerda | 0,30 | 42 % | 1 | — |
| Direto de direita | 0,36 | 45 % | 1 | — |
| Gancho | 0,40 | 48 % | 1 | — |
| Chute circular | 0,50 | 50 % | 2 | Pesado |
| Joelhada | 0,40 | 48 % | 1 | Altura do tronco |
| Chute voador | 0,62 | 55 % | 2 | Derruba; arco aéreo de 0,85 m |

- **Sequência cíclica:** direto, direto, gancho, chute, direto, joelhada, direto, chute, gancho, direto, joelhada, chute.
- **Janela de cancelamento:** entre 55 % e 72 % da duração, um novo comando inicia o próximo golpe sem esperar o fim.
- **Fila de comandos:** entradas ficam guardadas por 0,35 s.

## 5. Combo e medidor

1. Cada acerto soma 1 ao combo e 1 ao medidor (máximo de 5).
2. O combo expira após 2,4 s sem acertos, ou imediatamente quando o jogador sofre dano. Em ambos os casos, o medidor também zera.
3. Com o medidor cheio, a **finalização** derruba o alvo de vez. Ela também empurra inimigos a até 2,8 m, sem causar dano a eles. Durante a finalização:
   - o tempo desacelera para 30 %;
   - a câmera se aproxima;
   - o jogador fica invulnerável.

## 6. Ataque inimigo e contra-ataque

1. **Diretor de combate.** Um gerente central concede "fichas" de ataque. Só um inimigo ataca por vez; com três inimigos vivos e após 14 s de luta, até dois. Entre concessões há um intervalo aleatório de 0,6 a 1,4 s. Inimigos às costas do jogador têm preferência.
2. **Ciclo do inimigo com ficha:** aproximação → preparação → golpe → recuperação.

   | Tipo | Preparação | Dano |
   |---|---|---|
   | Capangas comuns | 0,80–0,85 s | 12 |
   | Brutamontes | 1,05 s | 20 |

3. **Aviso (expressão própria do projeto).** Durante a preparação, acende sobre a cabeça do inimigo o ideograma **危** ("perigo") dentro de um losango. Ao mesmo tempo, um **anel no chão se contrai** à medida que o golpe se aproxima. A cor migra de âmbar para vermelho.
4. **Contra-ataque:**
   - aceito a partir de 0,1 s de preparação, para qualquer inimigo a até 5,5 m;
   - atinge **todos** os inimigos em preparação naquele instante;
   - imobiliza esses inimigos, aproxima o jogador do mais próximo e derruba todos;
   - dá 0,9 s de invulnerabilidade.
5. **Comando de contra-ataque sem ameaça:** gera 0,32 s de recuperação. Isso desestimula apertar o botão sem critério.

## 7-A. Armas de fogo (protótipo 02)

1. **Escolha do ataque.** Ao receber uma ficha, o inimigo armado decide entre:
   - **corpo a corpo** (coronhada), regra da seção 6;
   - **disparo**, só se estiver a mais de 2,2 m. Preferência de disparo por personagem: Ricci 70 %, Moretti 50 %, Vittore 45 %.
2. **Aviso de disparo (expressão própria, distinta do 危).**
   - Acende sobre o atirador o ideograma **閃** ("esquivar") dentro de um círculo, em ciano-branco.
   - Uma linha de mira vermelha liga a arma ao protagonista e fica mais intensa conforme o disparo se aproxima.
   - Um anel ciano se contrai **sob os pés do protagonista**.
3. **Mira travada.** No instante do primeiro disparo, a direção é fixada. Cada projétil sai nessa direção com dispersão de ±0,03 rad. Sair da linha de tiro (esquiva) evita o dano, além da invulnerabilidade da própria esquiva.

   | Arma | Mira | Disparos | Intervalo | Dano por acerto |
   |---|---|---|---|---|
   | Submetralhadora (Ricci) | 0,90 s | 6 | 0,075 s | 5 |
   | Submetralhadora (Vittore) | 1,00 s | 5 | 0,075 s | 5 |
   | Pistola (Moretti) | 0,75 s | 2 | 0,22 s | 9 |

4. **Acerto.** O projétil atinge se passar a menos de 0,38 m do tronco do protagonista e ele não estiver invulnerável.
5. **Interrupção.** Golpear o atirador durante a mira ou o disparo interrompe o ataque.
6. **Contra-ataque não se aplica a disparos.** Usá-lo durante a mira gera a recuperação de comando sem ameaça.
7. **Recompensa.** Escapar de uma rajada inteira mostra "ESQUIVA" e não quebra o combo.
8. **Chefe.** Don Vittore tem 10 pontos de vida e barra própria na interface.

## 7. Esquiva

- Rolamento de 0,46 s na direção informada; sem direção, para trás.
- Invulnerabilidade nos primeiros 0,38 s.
- O personagem atravessa os inimigos durante o rolamento.

## 8. Reações

| Situação | Resposta |
|---|---|
| Inimigo atingido | Recuo de 0,34 s. A reação muda conforme a altura do golpe: cabeça ou tronco |
| Golpe que derruba | Queda de costas (0,5 s) com respingo no asfalto molhado → caído por 1,4 s → levanta em 0,8 s |
| Vida zerada | Inimigo fica caído (nocaute) |
| Jogador atingido | Recuo de 0,42 s; pode esquivar a partir de 0,22 s |

## 9. Sensação de impacto

| Recurso | Intensidade |
|---|---|
| Congelamento de quadro (*hit-stop*) | 50 ms (leve), 85 ms (pesado), 140 ms (finalização) |
| Tremor de câmera | Proporcional ao peso do golpe |
| Pulso de imagem | Leve aberração cromática e clarão |
| Faíscas e clarão no ponto de impacto | Em todo acerto |

Respeita-se a preferência do sistema por movimento reduzido: tremor e pulso são atenuados.

## 10. Controles

| Ação | Teclado/mouse | Controle | Toque |
|---|---|---|---|
| Mover | WASD / setas | Analógico esquerdo | Joystick virtual |
| Atacar | J / clique esquerdo | Botão oeste (□ / X) | ATACAR |
| Contra-atacar | K / clique direito | Botão norte (△ / Y) | CONTRA |
| Esquivar (inclusive de disparos) | Espaço / L | Botão sul (✕ / A) | ESQUIVA |
| Finalizar | F / I | Botão leste (○ / B) | FINAL |
| Câmera | Q / E | Analógico direito | — |

O mapeamento de botões segue convenções funcionais de controles de videogame, que não constituem expressão protegida.

## 11. Determinação (protótipo 03)

Recurso de 0 a 5 pontos, exibido junto à barra de vida.

| Ganho | Pontos |
|---|---|
| Acerto | +0,4 |
| Inimigo contra-atacado | +1 |
| Rajada esquivada por inteiro | +1 |
| Inimigo nocauteado | +0,5 |

| Uso | Custo | Efeito |
|---|---|---|
| **Finalização** (F / ○ / FINAL) | 3 | Regra da seção 5, que deixa de exigir combo |
| **Cura** (H / LB / CURAR) | 2 | Recupera 35 de vida após 0,6 s de concentração. Se o protagonista for atingido nesse intervalo, a cura é cancelada e nada é gasto |

A determinação não zera ao quebrar o combo.

## 12. Precisão recompensada

- **Contra-ataque perfeito:** dentro dos últimos 30 % da preparação inimiga. Gera câmera lenta de 0,35 s, dano dobrado, +1 ponto extra de determinação e o aviso "PERFEITO".
- **Esquiva perfeita:** iniciada até 0,15 s antes do primeiro disparo de uma rajada. Gera câmera lenta breve e o aviso "ESQUIVA PERFEITA".

## 13. Armas do chão

Poucas unidades espalhadas pelo mapa. Brilham de leve para serem notadas.

| Arma | Usos | Dano | Particularidade |
|---|---|---|---|
| Garrafa de vidro | 1 | 4 | Derruba; estilhaça |
| Pau | 4 | 2 | Alcance +0,25 m; lascas ao quebrar |
| Pé de cabra | 8 | 3 | Derruba no 3º golpe seguido |
| Cano de ferro | 6 | 2,5 | Largado por capangas armados |

- **Pegar e largar:** E / RB / botão PEGAR, que aparece no toque quando há arma por perto.
- **Golpes com arma:** sequência própria (diagonal, horizontal, revés).
- **Contra-ataque e finalização** continuam disponíveis com a arma na mão.
- **Fim da arma:** com os usos esgotados, ela se quebra e as mãos ficam livres.

## 14. Ondas

| Onda | Zona | Inimigos | Confronto |
|---|---|---|---|
| 1 | Beco | 4 soldados: 3 de punho, 1 com cano | Não |
| 2 | Rua Fa Yuen | 5 soldados: 2 com cano, 1 brutamontes; chegam pelos dois lados da rua | Sim |
| 3 | Mercado | Luca Moretti, Salvatore Ricci e 3 soldados | Sim |
| 4 | Templo de Tin Hau | Don Vittore e 2 soldados | Sim, com os soldados; depois, o chefe |

- **Abertura:** cada onda começa com um cartão caligráfico (第一波 a 第四波, mais o nome da zona) e faixas de cinema.
- **Ao vencer uma onda:** +25 de vida e +1 de determinação. O **vento-guia** (folhas, pétalas e rastros de vento) sopra em direção à próxima zona, e a onda seguinte começa ao entrar nela.
- **Derrota:** "Tentar de novo" reinicia a onda atual com vida cheia e 2 de determinação. "Recomeçar" volta ao início.

**Soldados da família Vittore:**

| Tipo | Vida | Dano | Velocidade |
|---|---|---|---|
| De punho | 4 | 12 | Normal |
| Com cano | 5 | 16 | Normal |
| Brutamontes | 8 | 20 | Lento |

Todos os golpes de soldados são contra-atacáveis.

## 15. Confronto

1. **Desafio.** No início das ondas 2, 3 e 4, os inimigos param a cerca de 8 m. Aparecem o aviso "Segure CONTRA para o confronto" e faixas de cinema.
2. **Recusar.** Atacar recusa o confronto e inicia a luta normal.
3. **Aceitar.** Segurar contra-atacar (K / △ / CONTRA) faz o primeiro adversário caminhar até cerca de 3 m. Após 1,0 a 3,0 s, ele ataca. Antes disso pode fingir o ataque até duas vezes, com um tranco sem brilho.
4. **Sinal de ataque.** Um **brilho de estrela** acende no adversário. Soltar o botão em até 0,4 s derruba o adversário em câmera lenta.
5. **Encadeamento.** Até três adversários, cada um mais rápido que o anterior.
6. **Erro.** Soltar antes do brilho, inclusive durante uma finta, ou tarde demais custa um golpe de 20 de vida, e a luta começa.
7. **Chefe.** Don Vittore não participa do confronto.
