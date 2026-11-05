# Trocar as peças por imagens

Guia prático para substituir os blocos coloridos por fotos — de rostos, logos, personagens, o que for.

Há **dois caminhos**. O primeiro funciona sem programar; o segundo deixa a skin embutida no projeto.

---

## Caminho 1 — Pela tela do jogo (sem programar)

É o caminho para usar na apresentação: dá para colocar o rosto de alguém como peça em menos de um minuto, na frente da banca.

1. Abra o jogo e clique em **🎨 Skins**
2. Role até **"Criar skin com suas fotos"**
3. Clique em cada quadradinho (Peça I, Peça O, Peça T…) e escolha uma imagem
4. Dê um nome à skin — por exemplo, `Turma de 2026`
5. Clique em **Salvar e usar**

Pronto. As peças passam a cair com as fotos, **na mesma hora**, mesmo com uma partida em andamento.

### Detalhes que valem saber

- **Não precisa enviar as sete fotos.** As peças sem foto reaproveitam a primeira imagem escolhida.
- **A imagem é recortada no quadrado central** e reduzida para 128×128. O recorte central evita que rostos fiquem achatados — se a foto fosse esticada num bloco quadrado, todo mundo ficaria distorcido.
- **As fotos ficam só no seu navegador.** Nada é enviado para servidor nenhum. Elas são guardadas no `localStorage`, junto com as demais preferências.
- **Enquadre o rosto no centro** da foto antes de enviar. O bloco tem cerca de 30 pixels na tela; um rosto pequeno ou descentralizado vira uma mancha.

### Por que 128×128?

Não é escolha estética. Uma foto de celular tem alguns megabytes; convertida em texto para caber no armazenamento do navegador, fica ainda maior — e o limite costuma ser 5 MB **no total**. A 128×128 cada imagem ocupa poucos kilobytes e as sete cabem com folga.

Se aparecer o aviso *"A memória do navegador encheu"*, remova alguma skin antiga na própria galeria.

---

## Caminho 2 — Skin embutida no projeto (com código)

Use este caminho quando as imagens tiverem de vir junto com o projeto, para qualquer pessoa que abrir o jogo — sem precisar enviar nada.

### Passo 1 — Prepare as imagens

Sete arquivos **quadrados**, idealmente 128×128 ou 256×256, em PNG ou JPG:

```
assets/skins/ana.png
assets/skins/bruno.png
assets/skins/carla.png
assets/skins/diego.png
assets/skins/elisa.png
assets/skins/felipe.png
assets/skins/gabriela.png
```

> Recorte no quadrado antes de salvar. O jogo estica a imagem para o bloco, então uma foto retangular sairá deformada.

### Passo 2 — Descomente a skin no catálogo

Abra `src/render/skins/catalogo.js`. No fim do objeto `SKINS_DE_PECA` existe um bloco comentado — descomente e ajuste os nomes dos arquivos:

```js
turma: {
  id: 'turma',
  nome: 'A Turma',
  descricao: 'Cada peça é o rosto de um integrante do grupo.',
  tipo: 'imagem',
  mapa: {
    I: 'assets/skins/ana.png',
    O: 'assets/skins/bruno.png',
    T: 'assets/skins/carla.png',
    S: 'assets/skins/diego.png',
    Z: 'assets/skins/elisa.png',
    J: 'assets/skins/felipe.png',
    L: 'assets/skins/gabriela.png',
  },
  // Cores usadas enquanto as imagens carregam, ou se algum arquivo faltar.
  cores: { ...CORES_PADRAO },
},
```

### Passo 3 — Pronto

A skin aparece sozinha na galeria, junto com as demais. **Nenhum outro arquivo precisa ser alterado.**

Para que ela seja a skin inicial do jogo, mude a constante no fim do mesmo arquivo:

```js
export const SKIN_DE_PECA_PADRAO = 'turma';
```

---

## Trocar o plano de fundo

Mesmo princípio, no objeto `SKINS_DE_FUNDO` do mesmo arquivo. Há um exemplo comentado para fundo por imagem:

```js
foto: {
  id: 'foto',
  nome: 'Foto da turma',
  tipo: 'imagem',
  caminho: 'assets/skins/fundo-turma.jpg',
  cores: ['#12141c'],   // cor de reserva enquanto carrega
},
```

O fundo por imagem recebe automaticamente um véu escuro por cima, para as peças continuarem legíveis.

---

## Por que isso funciona sem mexer na lógica

O tabuleiro guarda apenas o **identificador** da peça:

```js
this.celulas[linha][coluna] = 'T';   // nunca uma cor, nunca um caminho de imagem
```

Na hora de desenhar, o renderizador pergunta ao registro de skins qual é o pintor daquele tipo:

```js
const pintor = this.skins.pintorPara('T');
pintor.pintar(ctx, x, y, tamanho);
```

Esse pintor pode ser um `PintorDeCor`, um `PintorDePadrao` ou um `PintorDeImagem` — o renderizador não sabe e não precisa saber. Trocar de um para outro não altera colisão, gravidade, rotação ou pontuação, porque **nenhum deles jamais viu uma cor**.

Detalhamento completo em [ARQUITETURA.md](ARQUITETURA.md).

---

## Criar um tipo de aparência novo

Quer blocos animados, com vídeo, ou com moldura personalizada? São dois passos.

**1.** Escreva a classe em `src/render/BlockPainter.js`, com o mesmo método dos outros:

```js
export class PintorAnimado extends PintorBase {
  desenharBloco(ctx, x, y, tamanho, opcoes) {
    // seu desenho aqui
  }
}
```

**2.** Registre o novo tipo na fábrica, no mesmo arquivo:

```js
export function criarPintor(skin, tipoDePeca, carregador, corDeReserva) {
  switch (skin.tipo) {
    case 'cor':     return new PintorDeCor(...);
    case 'padrao':  return new PintorDePadrao(...);
    case 'imagem':  return new PintorDeImagem(...);
    case 'animado': return new PintorAnimado(...);   // ← seu tipo novo
  }
}
```

Nenhum outro arquivo do projeto precisa saber que ele existe.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Peças aparecem coloridas, não com as fotos | Arquivo não encontrado | Confira o caminho no `mapa`. O console do navegador (F12) mostra `[AssetLoader] Não foi possível carregar...` |
| Rostos achatados ou esticados | Imagem não é quadrada | Recorte em quadrado antes de salvar |
| "A memória do navegador encheu" | Muitas skins salvas | Remova skins antigas na galeria |
| A skin some ao recarregar a página | `localStorage` bloqueado (navegação anônima) | A skin funciona na sessão, mas não persiste. Use o Caminho 2 |
| Rosto irreconhecível no jogo | Rosto pequeno na foto original | Aproxime o enquadramento; o bloco tem ~30 pixels |
| Alterei o catálogo e nada mudou | Cache do navegador | Recarregue com `Ctrl + Shift + R` |
