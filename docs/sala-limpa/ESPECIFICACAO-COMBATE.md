# Especificação Funcional — Combate de Fluxo Livre

**Status:** aprovada para implementação · protótipo 01
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
| Esquivar | Espaço / L | Botão sul (✕ / A) | ESQUIVA |
| Finalizar | F / I | Botão leste (○ / B) | FINAL |
| Câmera | Q / E | Analógico direito | — |

O mapeamento de botões segue convenções funcionais de controles de videogame, que não constituem expressão protegida.
