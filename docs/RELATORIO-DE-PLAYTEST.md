# Relatório de playtest — PI 3

Responsável: **Douglas** (Qualidade e Testes).

Este documento é preenchido **durante** as sessões, não depois. Memória de
sessão de teste dura cerca de dez minutos.

---

## Por que testar com gente de fora

A equipe não consegue mais jogar este jogo como alguém que nunca o viu. Quem
escreveu a regra sabe que a diagonal não combina professores; o jogador novo
tenta a diagonal, nada acontece, e ele conclui que o jogo está quebrado.

**Regra da sessão: você não explica nada.** Entrega o teclado e observa. Cada
vez que você sentir vontade de explicar algo, anote — é exatamente ali que o
jogo está falhando em se explicar sozinho.

---

## Como conduzir

**Cinco pessoas, dez minutos cada.** Cinco é o suficiente: a partir daí os
problemas começam a se repetir.

1. Abra o jogo no menu e diga apenas: *"joga aí"*.
2. Não responda pergunta durante a partida. Anote a pergunta.
3. Peça para a pessoa **falar em voz alta** o que está pensando.
4. Ao fim, três perguntas:
   - O que você achou que os blocos com cara de professor faziam?
   - Teve alguma hora que você não entendeu o que aconteceu?
   - Você jogaria de novo?

---

## Ficha por sessão

Copie este bloco uma vez por pessoa.

```
SESSÃO Nº ___      DATA ___/___      JOGA TETRIS? ( ) nunca ( ) às vezes ( ) muito

TEMPO ATÉ A PRIMEIRA LINHA COMPLETA: _____
DESCOBRIU OS PROFESSORES SOZINHO?    ( ) sim ( ) não ( ) só depois de perguntar
TENTOU COMBINAR NA DIAGONAL?         ( ) sim ( ) não
USOU A RESERVA (tecla C)?            ( ) sim ( ) não
PONTUAÇÃO FINAL: _____   MODO: _____

O QUE PERGUNTOU EM VOZ ALTA:


ONDE TRAVOU OU SE CONFUNDIU:


O QUE DISSE NO FIM:
```

---

## O que medir depois das cinco sessões

Preencha com números, não com impressões — é isto que vai para o relatório
acadêmico e para o balanceamento do Wendel.

| Pergunta | Resultado |
|---|---|
| Quantos descobriram os professores sem ajuda? | ___ de 5 |
| Quantos tentaram a diagonal? | ___ de 5 |
| Quantos usaram a reserva? | ___ de 5 |
| Tempo médio até a primeira linha | ___ s |
| Partida média (do início ao fim de jogo) | ___ s |
| Quantos quiseram jogar de novo? | ___ de 5 |

### Sinais de alerta e o que cada um significa

| Se acontecer | O problema provável | Quem resolve |
|---|---|---|
| Menos de 3 descobrem os professores | A marca não se lê como algo especial | Nilza (arte) + Matheus (destaque visual) |
| A maioria tenta a diagonal | A regra contraria a expectativa natural | Nayeli — decidir: mudar a regra ou ensiná-la |
| Ninguém usa a reserva | O controle não está visível o bastante | Matheus (HUD) |
| Partida média abaixo de 60 s | Está difícil demais no começo | Wendel (curva de dificuldade) |
| Partida média acima de 6 min | Está fácil demais, fica monótono | Wendel |

---

## Bugs encontrados

| # | O que fiz | O que esperava | O que aconteceu | Quem | Resolvido |
|---|---|---|---|---|---|
| 1 | | | | | ☐ |
| 2 | | | | | ☐ |
| 3 | | | | | ☐ |

> Sempre nessa ordem, e sempre com o **modo** e se havia **professor na peça**.
> Vários problemas deste projeto só apareceram numa dessas condições.

---

## Regressão — rodar antes de cada entrega

- [ ] `npm test` passa inteiro
- [ ] Nenhuma mensagem vermelha no console (F12)
- [ ] Nenhuma camada escura sobre o tabuleiro durante a partida
- [ ] Três partidas seguidas trazem sequências de peças diferentes
- [ ] Girar peça com professor quatro vezes mantém a marca no mesmo bloco
- [ ] Guardar e recuperar peça com professor preserva a marca
- [ ] Poder que esvazia linha não deixa vão no meio da pilha
- [ ] O jogo abre e é jogável em tela de celular
