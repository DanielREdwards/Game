# Protocolo de Desenvolvimento em Sala Limpa

**Projeto:** Beco de Mong Kok (codinome) — protótipo jogável 01
**Natureza do documento:** norma interna de conduta e de constituição de prova de criação independente

---

## 1. Objeto

Este protocolo disciplina a criação de um jogo eletrônico original de ação em mundo urbano, com combate corpo a corpo de "fluxo livre", **inspirado** em convenções do gênero, mas **sem reprodução, adaptação ou transformação** de código, arquivos ou elementos expressivos de obras de terceiros.

O objetivo é dúplice: (i) assegurar a licitude do desenvolvimento; e (ii) constituir, desde o primeiro *commit*, prova documental de que a obra resultante é criação independente.

## 2. Fundamentos jurídicos

### 2.1 O que é livre

A Lei nº 9.610/1998, art. 8º, exclui da proteção autoral:

> "I - as idéias, procedimentos normativos, sistemas, métodos, projetos ou conceitos matemáticos como tais;
> II - os esquemas, planos ou regras para realizar atos mentais, jogos ou negócios;
> […]
> VII - o aproveitamento industrial ou comercial das idéias contidas nas obras."

A Lei nº 9.609/1998, art. 6º, III, afasta a ofensa quando ocorre:

> "a ocorrência de semelhança de programa a outro, preexistente, quando se der por força das características funcionais de sua aplicação, da observância de preceitos normativos e técnicos, ou de limitação de forma alternativa para a sua expressão".

No plano patentário, a Lei nº 9.279/1996, art. 10, dispõe que "não se considera invenção nem modelo de utilidade: […] V - programas de computador em si; […] VII - regras de jogo".

**Direito comparado** (relevante para distribuição internacional):

- 17 U.S.C. § 102(b): *"In no case does copyright protection […] extend to any idea, procedure, process, system, method of operation, concept, principle, or discovery."*
- Diretiva 2009/24/CE, art. 5º, n.º 3: o utente legítimo pode "observar, estudar ou testar o funcionamento do programa, a fim de apurar as ideias e princípios subjacentes a qualquer elemento do programa".

### 2.2 O que é protegido e, portanto, vedado

- **Reprodução e transformação.** A Lei nº 9.610/1998, art. 29, exige "autorização prévia e expressa do autor" para "I - a reprodução parcial ou integral" e "III - a adaptação, o arranjo musical e quaisquer outras transformações".
- **Tutela penal do software.** A Lei nº 9.609/1998, art. 12, § 1º, comina "reclusão de um a quatro anos e multa" à reprodução de programa de computador "para fins de comércio, sem autorização expressa do autor".
- **Medidas tecnológicas de proteção.** A Lei nº 9.610/1998, art. 107, I, responsabiliza quem "alterar, suprimir, modificar ou inutilizar, de qualquer maneira, dispositivos técnicos introduzidos nos exemplares das obras e produções protegidas para evitar ou restringir sua cópia".
- **Marcas e concorrência desleal.** A Lei nº 9.279/1996 assegura ao titular o "uso exclusivo" da marca registrada (art. 129) e tipifica a reprodução ou imitação "de modo que possa induzir confusão" (art. 189, I), bem como o emprego de "meio fraudulento, para desviar, em proveito próprio ou alheio, clientela de outrem" (art. 195, III).
- **Interpretação restritiva da exceção europeia.** Mesmo onde a descompilação é tolerada para fins de interoperabilidade, a Diretiva 2009/24/CE, art. 6º, n.º 2, alínea *c*, veda o uso das informações obtidas "para o desenvolvimento, produção ou comercialização de um programa substancialmente semelhante na sua expressão".

## 3. Vedações absolutas

É **proibido**, a qualquer integrante do projeto:

1. descompilar, desmontar ou depurar executáveis de jogos de terceiros;
2. extrair, converter, rastrear ou redesenhar a partir de modelos, texturas, animações, áudio, mapas ou textos de jogos de terceiros;
3. consultar ou copiar código-fonte vazado ou reconstruído por descompilação, inclusive projetos públicos de "decompilação" de jogos comerciais;
4. contornar DRM ou qualquer outra medida tecnológica de proteção;
5. utilizar nomes, títulos, logotipos, personagens, bordões, trilhas ou identidade visual de obras de terceiros, inclusive em material de divulgação;
6. usar ferramentas de geração automática alimentadas com arquivos extraídos de jogos de terceiros.

## 4. Papéis

| Papel | Atribuição | Limite |
|---|---|---|
| **Analista** | Joga cópias **legitimamente adquiridas**, observa o funcionamento e redige especificações funcionais em linguagem própria | Não escreve código de produção; não descreve arte, texto ou som de forma que permita reproduzi-los |
| **Implementador** | Escreve código, modelos, texturas e sons **exclusivamente** a partir da especificação aprovada | Não acessa os jogos de referência durante a implementação do mesmo sistema |
| **Revisor jurídico** | Filtra a especificação, removendo tudo que seja expressão protegida, e aprova a liberação | Registra a aprovação no histórico do repositório |

Em equipe reduzida, quando a mesma pessoa acumular papéis, o histórico de versões deve demonstrar que a especificação precede a implementação.

## 5. Documentação e prova

1. Toda especificação funcional fica em `docs/sala-limpa/` e é versionada **antes** do código correspondente.
2. Todo arquivo de terceiros (bibliotecas, fontes) é listado em `docs/PROVENIENCIA.md`, com licença e origem.
3. O histórico Git (autor, data, conteúdo) constitui meio de prova idôneo. O Código de Processo Civil, art. 369, assegura às partes "o direito de empregar todos os meios legais, bem como os moralmente legítimos, ainda que não especificados neste Código, para provar a verdade dos fatos".
4. O registro do programa no INPI é facultativo, mas recomendável como prova de anterioridade. Fundamentos: Lei nº 9.609/1998, art. 3º, e art. 2º, § 3º ("A proteção aos direitos de que trata esta Lei independe de registro").

## 6. Titularidade da obra criada

- **Código.** Salvo estipulação em contrário, pertencem ao contratante os direitos sobre programa "desenvolvido e elaborado durante a vigência de contrato […] expressamente destinado à pesquisa e desenvolvimento" (Lei nº 9.609/1998, art. 4º).
- **Arte, música e roteiro.** A cessão de direitos "se fará sempre por escrito" e "presume-se onerosa" (Lei nº 9.610/1998, art. 50). Todo colaborador deve firmar termo de cessão antes de contribuir.

## 7. Lista de verificação antes de cada publicação

- [ ] Nenhum arquivo de jogo de terceiros no repositório ou nas máquinas de build
- [ ] `docs/PROVENIENCIA.md` atualizado
- [ ] Nome, logotipo e material de divulgação sem referência a marcas de terceiros
- [ ] Busca de anterioridade de marca no INPI para o título comercial definitivo (classes 9 e 41 da Classificação de Nice)
- [ ] Análise de liberdade de operação (*freedom to operate*) quanto a patentes de mecânicas de jogo nos mercados de lançamento

## 8. Aplicação a este protótipo

O protótipo 01 foi escrito a partir de conhecimento geral de desenvolvimento de jogos e de convenções públicas do gênero, descritas na especificação `ESPECIFICACAO-COMBATE.md`.

Não houve acesso a binários, arquivos ou código de jogos comerciais. Personagens, cenário, texturas e sons são **gerados por procedimento** no próprio código, conforme registrado em `docs/PROVENIENCIA.md`.

---

*Documento de orientação interna. Não substitui parecer de advogado habilitado antes de lançamento comercial.*
