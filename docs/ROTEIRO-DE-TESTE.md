# Roteiro de teste manual — PI 2

Responsável: **Douglas** (Qualidade e Testes).

Este roteiro existe porque o enunciado do PI 2 pede que o protótipo "permita
testar o funcionamento básico". Ele é curto de propósito: qualquer pessoa da
banca consegue seguir em cinco minutos, sem saber programar.

**Antes de começar:** `npm run dev`, depois abrir <http://localhost:3050>.

---

## Parte 1 — Testes automatizados

```
npm test
```

**Esperado:** `# pass 92` e `# fail 0`.

Se algum falhar, anote o nome do teste e a linha — essa informação sozinha já
localiza o problema, porque cada teste cobre uma regra só.

---

## Parte 2 — Teste manual

Marque cada item. Onde falhar, descreva **o que você fez** e **o que aconteceu**,
nessa ordem.

### Movimento

| # | Ação | Esperado | OK |
|---|---|---|---|
| 1 | Seta ← e → | A peça anda uma coluna por toque | ☐ |
| 2 | Segurar ← | Depois de uma pausa curta, anda sozinha e rápido | ☐ |
| 3 | Empurrar a peça contra a parede | Ela para na parede, não sai do tabuleiro | ☐ |
| 4 | Seta ↓ | A peça desce mais rápido enquanto a tecla estiver pressionada | ☐ |
| 5 | Espaço | A peça cai instantaneamente até o fundo e trava | ☐ |

### Rotação

| # | Ação | Esperado | OK |
|---|---|---|---|
| 6 | ↑ ou X | A peça gira no sentido horário | ☐ |
| 7 | Z | A peça gira no sentido anti-horário | ☐ |
| 8 | Girar com a peça encostada na parede | Ela se desloca para caber, em vez de travar | ☐ |
| 9 | Girar a peça O (quadrado) | Nada muda — é o comportamento correto | ☐ |
| 10 | **Girar uma peça com marca de professor** | **A marca continua no MESMO bloco** | ☐ |

> O item 10 já foi um bug real do projeto: a marca pulava de bloco ao girar.
> Vale testar com atenção, girando quatro vezes seguidas até a peça voltar à
> posição original.

### Linhas e pontuação

| # | Ação | Esperado | OK |
|---|---|---|---|
| 11 | Completar uma linha | A linha some e o que estava acima desce | ☐ |
| 12 | Completar uma linha | Os pontos aumentam e "Linhas" sobe em 1 | ☐ |
| 13 | Completar 10 linhas | "Nível" vira 2 e as peças caem visivelmente mais rápido | ☐ |
| 14 | Deixar a pilha chegar ao topo | Aparece "Fim de jogo" com os pontos | ☐ |

### Reserva e próxima peça

| # | Ação | Esperado | OK |
|---|---|---|---|
| 15 | Olhar a caixa "Próxima" | Mostra a peça que vai vir em seguida | ☐ |
| 16 | C ou Shift | A peça atual vai para "Reserva" e outra entra | ☐ |
| 17 | C de novo, na mesma peça | Nada acontece — a reserva só vale uma vez por peça | ☐ |
| 18 | C na peça seguinte | As duas peças trocam de lugar | ☐ |
| 19 | **Guardar uma peça com professor e recuperá-la** | **A marca volta junto** | ☐ |

### Professores

| # | Ação | Esperado | OK |
|---|---|---|---|
| 20 | Jogar até aparecer um bloco marcado | Faixa no topo anuncia o nome do professor | ☐ |
| 21 | Encostar dois marcados **lado a lado** | Os dois somem e blocos ao redor são destruídos | ☐ |
| 22 | Encostar dois marcados **um sobre o outro** | Mesmo efeito | ☐ |
| 23 | Deixar dois marcados **na diagonal** | **Nada acontece** — é o correto | ☐ |
| 24 | Disparar pares diferentes | O nome do poder muda conforme o par | ☐ |
| 25 | Depois de um poder esvaziar uma linha | Não sobra linha vazia no meio da pilha | ☐ |

### Pausa e reinício

| # | Ação | Esperado | OK |
|---|---|---|---|
| 26 | P ou Esc | Aparece "Pausado" e a peça para de cair | ☐ |
| 27 | P de novo | O jogo volta de onde parou, com os pontos intactos | ☐ |
| 28 | R, ou o botão "Reiniciar partida" | Tabuleiro limpo, pontos zerados | ☐ |
| 29 | Reiniciar três vezes seguidas | **A sequência de peças é diferente a cada partida** | ☐ |

> O item 29 também já foi um bug: a mesma semente era reaproveitada e todas as
> partidas tinham a peça na mesma ordem.

### Tela

| # | Ação | Esperado | OK |
|---|---|---|---|
| 30 | Estreitar a janela até a largura de um celular | O painel vai para baixo do tabuleiro, sem barra de rolagem lateral | ☐ |
| 31 | Abrir o console do navegador (F12) | **Nenhuma mensagem em vermelho** | ☐ |
| 32 | Durante a partida, olhar o tabuleiro | Nenhuma camada escura cobrindo os blocos | ☐ |

> O item 32 tem história: um aviso com fundo preto ficou permanentemente sobre
> o tabuleiro e o jogo parecia "opaco", sem nenhum erro no console.

---

## Como relatar um problema

Três linhas bastam:

```
O QUE FIZ:       girei a peça S encostada na parede esquerda
O QUE ESPERAVA:  ela se deslocar para a direita e girar
O QUE ACONTECEU: ela não girou
```

Se der, anote também o **nível** e se havia **professor na peça** — muitos
problemas só aparecem numa dessas condições.
