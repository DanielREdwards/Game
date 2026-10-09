# Especificação do Mapa — Quarteirão de Mong Kok

**Status:** aprovada para implementação · protótipo 03
**Escala:** cerca de 100 m × 45 m, contra 15 m × 13 m do protótipo anterior.

---

## 1. Zonas

| Zona | Nome no jogo | Área aproximada | Clima visual | Onda |
|---|---|---|---|---|
| Beco | 後巷 · O beco | x −7,4 a 7,4; z −6,4 a 17 | Neon magenta e ciano, poças, vapor de bueiro | 1 |
| Rua | 花園街 · Rua Fa Yuen | x −50 a 50; z 16,8 a 31 | Luz de sódio, letreiros em camadas sobre a rua, táxis e micro-ônibus estacionados, faixa de pedestres com "望右 LOOK RIGHT" | 2 |
| Mercado noturno | 女人街 · Mercado | Trecho leste da rua, x 14 a 46 | Barracas com toldos listrados e lâmpadas nuas nas calçadas, mercadorias penduradas, vapor de comida | 3 |
| Templo | 天后廟 · Templo de Tin Hau | Pátio ao norte, x −47 a −31; z 2 a 17 | Lanternas vermelhas, espirais de incenso, urna de bronze, leões de pedra, figueira-de-bengala e bauhínia soltando pétalas ao vento | 4 |

## 2. Regras de navegação

1. A área caminhável é a união de retângulos (beco, rua e pátio do templo).
2. Barracas, carros, urna, leões, troncos de árvore e barreiras de obra são obstáculos. Os personagens deslizam ao longo deles.
3. As extremidades da rua são fechadas por obras viárias, com tapumes e barreiras.
4. A câmera é contida na mesma união de áreas, com margem, para não atravessar prédios.

## 3. Iluminação de um mapa grande

Há dezenas de fontes de luz no mapa (letreiros, vitrines, postes, lanternas). Para manter o desempenho:

- Um conjunto fixo de **8 luzes pontuais reais** é redistribuído a cada quadro para as fontes mais próximas da câmera, com transição suave. O número de luzes nunca muda, o que evita recompilar sombreadores.
- A **luz de poste com sombra** acompanha o poste mais próximo do protagonista.
- O restante da ambientação vem de superfícies emissivas, *bloom* e reflexos no asfalto molhado.

## 4. Fundamentação jurídica

1. **Nomes de lugares.** Fa Yuen Street, Tung Choi Street ("女人街") e o tipo de templo dedicado a Tin Hau são lugares e designações públicas, usados como ambientação genérica. Nomes isolados não são protegidos (Lei nº 9.610/1998, art. 8º, VI).
2. **Logradouros públicos.** A representação de obras situadas em logradouros públicos é livre: "As obras situadas permanentemente em logradouros públicos podem ser representadas livremente, por meio de pinturas, desenhos, fotografias e procedimentos audiovisuais" (Lei nº 9.610/1998, art. 48). Ainda assim, nenhum edifício real é reproduzido: a arquitetura é genérica e procedural.
3. **Sem marcas reais.** Letreiros usam apenas palavras comuns (茶餐廳, 藥房, 涼茶 etc.), sem marcas nem estabelecimentos existentes.
