# Arte e identidade visual

Responsável: **Nilza** (Arte e Identidade Visual).

Este documento registra as decisões visuais e prepara a arte do PI 3. No PI 2
**não há arte no jogo de propósito** — o enunciado pede placeholders, e é o que
está no ar.

---

## O que está no jogo hoje (placeholders)

| Elemento | Hoje | No PI 3 |
|---|---|---|
| Bloco de peça | Retângulo chapado com borda escura | Skin com textura, e depois fotos |
| Marca de professor | Disco colorido com a letra do id | Caricatura do professor |
| Fundo | Cor sólida com grade | Fundo temático por skin |

Tudo isso vive em **um único arquivo**: `src/render/CanvasRendererSimples.js`.
Nenhuma regra do jogo sabe que cor um bloco tem, então trocar a arte inteira
nunca exige mexer na lógica.

---

## Cores das peças

São as cores clássicas do Tetris, mantidas para que quem já conhece o jogo
reconheça as peças de imediato.

| Peça | Cor | Formato |
|---|---|---|
| I | `#31c7ef` | barra de 4 |
| O | `#f7d308` | quadrado |
| T | `#ad4d9c` | T |
| S | `#42b642` | S |
| Z | `#ef2029` | Z |
| J | `#5a65ad` | L espelhado |
| L | `#ef7921` | L |

## Cores dos professores

Escolhidas para se distinguirem **entre si** e das cores das peças, porque o
disco fica por cima de um bloco colorido.

| Id | Professor | Cor |
|---|---|---|
| A | Alexandro | `#ff5252` |
| B | Caetano | `#40c4ff` |
| C | Jhonatta | `#69f0ae` |
| D | Fabricio | `#ffd740` |
| E | Tadeu | `#b388ff` |

---

## O que precisa ser produzido para o PI 3

### 1. Caricaturas dos cinco professores

**Cinco arquivos PNG, quadrados, com fundo transparente.**

| Requisito | Valor | Por quê |
|---|---|---|
| Dimensão | 128 × 128 px | É o tamanho que o jogo já usa para fotos enviadas |
| Formato | PNG com transparência | O bloco colorido aparece atrás |
| Enquadramento | Rosto centralizado, ombros cortados | No jogo o desenho ocupa ~30px de lado |
| Peso | Até 40 KB cada | O jogo precisa funcionar offline |

Nomes dos arquivos, exatamente assim:

```
assets/professores/prof-a.png     Alexandro
assets/professores/prof-b.png     Caetano
assets/professores/prof-c.png     Jhonatta
assets/professores/prof-d.png     Fabricio
assets/professores/prof-e.png     Tadeu
```

> **O teste que decide se a caricatura funciona:** reduza o desenho para 30
> pixels de lado e olhe. Se não der para distinguir um professor do outro nesse
> tamanho, o traço está detalhado demais para o jogo. Trace por **silhueta e
> uma característica marcante** (cabelo, óculos, barba), não por realismo.

### 2. Ícone do jogo

`assets/icons/icone.svg`, mais versões em 192×192 e 512×512 para a instalação
no celular (PI 4). Precisa ser legível em 32px.

### 3. Para a apresentação

- Capturas de tela do jogo rodando
- Slides com a identidade visual do projeto
- Vídeo curto de demonstração, como reserva caso a internet falhe

---

## Como a caricatura entra no jogo

Quando os arquivos estiverem prontos, é **uma linha por professor**. O caminho
já existe no código:

```js
// src/render/CanvasRendererSimples.js — método #desenharMarca
// Hoje desenha um disco com a letra.
// Com a arte pronta, vira ctx.drawImage(caricatura, ...).
```

Nada fora desse arquivo muda. É o mesmo caminho que as fotos de pessoas vão
usar depois, e foi por isso que o projeto foi construído assim desde o começo.
