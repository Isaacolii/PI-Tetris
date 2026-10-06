# Tetris dos Professores — Protótipo (PI 2)

Projeto Integrador de Games. Esta entrega é o **protótipo**: a mecânica central
funcionando e jogável, com elementos gráficos simples.

---

## O que esta entrega contém — e o que não contém

O enunciado do PI 2 pede o protótipo com **apenas a mecânica central**, e aceita
que os elementos visuais sejam placeholders ou formas geométricas. O recorte
abaixo é deliberado: o que está de fora não está faltando, está agendado.

| Nesta entrega | Entra depois |
|---|---|
| Peça cai, move, gira e trava | Menu e seleção de modo (PI 3) |
| Rotação com desvio de parede (SRS) | Catálogo de skins e fundos (PI 3) |
| Linha completa some e a pilha desce | Som (PI 3) |
| Sorteio 7-bag, próxima peça e reserva | Controle por toque (PI 3) |
| Gravidade que acelera por nível | Caricaturas dos professores (PI 3) |
| Pontuação, linhas e nível | Partículas e câmera lenta (PI 4) |
| Blocos de professor e poderes especiais | Análise por IA (PI 4) |
| 92 testes automatizados | Instalação offline e publicação (PI 4) |

Os blocos são **retângulos coloridos** e cada professor é um **disco com a
letra do seu identificador**. É o placeholder que o enunciado autoriza, e ele
sai sem tocar na lógica quando a arte ficar pronta.

---

## Como rodar

Precisa apenas do **Node.js** instalado. O projeto **não tem dependências** —
não existe `npm install` a fazer.

```
npm run dev
```

Depois abra <http://localhost:3050>.

> **Por que não dá para abrir o `index.html` com dois cliques:** o projeto usa
> módulos ES (`import`/`export`), e nenhum navegador carrega módulo por
> `file://`. Sem o servidor, a tela fica preta e o console acusa erro de CORS.

---

## Como testar

```
npm test
```

São **92 testes** rodando no terminal, **sem navegador**, com o executor nativo
do Node. Eles cobrem rotação e desvios de parede, colisão, limpeza de linhas,
sorteio 7-bag, pontuação, gravidade por nível, e o sistema de professores
inteiro — inclusive o caso de a diagonal **não** disparar combinação.

Que esses testes rodem sem navegador é a prova prática de que a lógica não
depende da tela: nada dentro de `src/core/` toca em `document`, `window` ou
`canvas`.

Para o teste manual, siga [docs/ROTEIRO-DE-TESTE.md](docs/ROTEIRO-DE-TESTE.md).

---

## Controles

| Ação | Teclas |
|---|---|
| Mover | ← → |
| Descer mais rápido | ↓ |
| Queda instantânea | Espaço |
| Girar (horário) | ↑ ou X |
| Girar (anti-horário) | Z |
| Guardar peça na reserva | C ou Shift |
| Pausar | P ou Esc |
| Reiniciar | R |

O jogo ainda **não tem controle por toque** — no celular ele aparece, mas não
é jogável. O toque entra no PI 3.

---

## Os professores

Algumas peças nascem com um bloco marcado. Quando dois blocos marcados ficam
**ortogonalmente vizinhos** — lado a lado ou um sobre o outro, nunca na
diagonal —, os dois são consumidos e um poder é disparado.

| Id | Professor | Tema |
|---|---|---|
| A | Alexandro | Explosão |
| B | Caetano | Linha |
| C | Jhonatta | Coluna |
| D | Fabricio | Conversão |
| E | Tadeu | Tempo |

O poder depende do **par**, e a tabela é simétrica: A+B e B+A são o mesmo
poder. Todas as combinações já respondem nesta entrega; o que falta é a parte
visual delas, que é trabalho do PI 3.

---

## Estrutura

```
index.html                    a página
styles/main.css               a aparência
scripts/servidor.mjs          servidor local (só Node, sem dependência)

src/main.js                   ← o único arquivo que conhece todos os outros

src/core/                     ← REGRAS. Não conhece a tela.
  Tetromino.js                  as sete peças e suas matrizes
  Grid.js                       o tabuleiro
  RotationSystem.js             rotação com desvios de parede
  BagRandomizer.js              sorteio 7-bag com semente
  ScoreSystem.js                pontos, linhas e nível
  GameModes.js                  os modos de jogo
  GameEngine.js                 o motor: junta tudo e avança o tempo
  Professores.js                identidade dos cinco
  PoderesEspeciais.js           o que cada combinação faz
  ProfessorSystem.js            detecta a vizinhança e resolve o par
  EfeitosAtivos.js              efeitos com duração
  StatsCollector.js             métricas da partida

src/input/KeyboardInput.js    ← teclado. Devolve o NOME da ação, nunca a tecla.
src/render/CanvasRendererSimples.js  ← desenho. Não importa nada.

tests/                        92 testes, rodam sem navegador
```

## A decisão que sustenta o projeto

**O motor guarda identidade, nunca aparência.** O tabuleiro armazena a letra
`'T'`, e não a cor roxa. Quem decide que um `'T'` é roxo é um único arquivo na
camada de desenho.

É por isso que trocar todos os blocos por fotos de pessoas — que é para onde o
projeto vai — não exige reescrever nenhuma regra do jogo. E é por isso que os
92 testes rodam no terminal: eles testam as regras, que não precisam de tela
para existir.

---

Projeto Integrador de Games · Entrega 2 — protótipo.
