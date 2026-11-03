/**
 * CanvasRenderer.js — Desenha o tabuleiro na tela.
 *
 * CAMADA: renderização.
 *
 * Observe o que este arquivo NÃO faz: ele não decide cor, não carrega imagem e
 * não sabe se um bloco é um quadrado azul ou o rosto de alguém. Ele pergunta ao
 * SkinRegistry qual é o pintor daquela peça e manda pintar. Essa indireção de
 * uma linha é o que permite trocar toda a identidade visual do jogo sem tocar
 * em nenhuma outra parte do código.
 *
 * Também não conhece o GameEngine: recebe um retrato do estado, não o motor.
 * Assim o renderizador pode desenhar uma partida ao vivo, um replay ou uma
 * pré-visualização de skin — tanto faz de onde vieram os dados.
 */

export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./SkinRegistry.js').SkinRegistry} skins
   * @param {import('./BackgroundRenderer.js').BackgroundRenderer} fundo
   */
  constructor(canvas, skins, fundo) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.skins = skins;
    this.fundo = fundo;

    /** Lado de cada célula em pixels — recalculado a cada redimensionamento. */
    this.tamanhoDaCelula = 30;
    this.colunas = 10;
    this.linhas = 20;
  }

  /**
   * Ajusta o canvas ao espaço disponível, respeitando a densidade de pixels da
   * tela. Sem isso o jogo fica borrado em telas de celular e em monitores 4K.
   *
   * @param {number} colunas
   * @param {number} linhas
   */
  redimensionar(colunas, linhas) {
    this.colunas = colunas;
    this.linhas = linhas;

    const densidade = window.devicePixelRatio || 1;
    const larguraCss = this.canvas.clientWidth;
    const alturaCss = this.canvas.clientHeight;

    // Célula quadrada: usamos o menor lado disponível como referência.
    this.tamanhoDaCelula = Math.floor(Math.min(larguraCss / colunas, alturaCss / linhas));

    this.canvas.width = Math.floor(larguraCss * densidade);
    this.canvas.height = Math.floor(alturaCss * densidade);
    this.ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
  }

  /**
   * Centro de uma célula, em pixels do sistema do tabuleiro.
   *
   * É a ponte entre "linha 18, coluna 4" (linguagem do jogo) e "x=140, y=612"
   * (linguagem das partículas). Fica aqui porque só o renderizador sabe o
   * tamanho atual da célula — que muda com a tela e com o ajuste do jogador.
   *
   * @param {number} linhaVisivel  já descontada a faixa de nascimento
   * @param {number} coluna
   */
  centroDaCelula(linhaVisivel, coluna) {
    return {
      x: (coluna + 0.5) * this.tamanhoDaCelula,
      y: (linhaVisivel + 0.5) * this.tamanhoDaCelula,
      tamanho: this.tamanhoDaCelula,
    };
  }

  /** Largura do tabuleiro em pixels — as faixas de luz precisam saber. */
  get larguraDoTabuleiro() {
    return this.tamanhoDaCelula * this.colunas;
  }

  /** Área efetivamente ocupada pelo tabuleiro, centralizada no canvas. */
  #areaDoTabuleiro() {
    const largura = this.tamanhoDaCelula * this.colunas;
    const altura = this.tamanhoDaCelula * this.linhas;
    const deslocamentoX = Math.floor((this.canvas.clientWidth - largura) / 2);
    const deslocamentoY = Math.floor((this.canvas.clientHeight - altura) / 2);
    return { largura, altura, deslocamentoX, deslocamentoY };
  }

  /**
   * Desenha um quadro completo.
   *
   * @param {Object} estado
   * @param {import('../core/Grid.js').Grid} estado.grid
   * @param {object|null} [estado.peca]      peça em queda
   * @param {object|null} [estado.fantasma]  sombra de onde ela vai cair
   * @param {import('./EfeitoVisual.js').EfeitoVisual} [estado.efeitos]  animações de poder
   * @param {import('./Particulas.js').SistemaDeParticulas} [estado.particulas]
   */
  desenhar({ grid, peca = null, fantasma = null, efeitos = null, particulas = null }) {
    const ctx = this.ctx;
    const area = this.#areaDoTabuleiro();
    const { largura, altura } = area;

    // O tremor desloca o tabuleiro inteiro, moldura incluída — é o que faz o
    // tranco parecer o tabuleiro sacudindo, e não o conteúdo escorregando dentro
    // de uma moldura parada.
    const tremor = particulas?.tremor ?? { x: 0, y: 0 };
    const deslocamentoX = area.deslocamentoX + tremor.x;
    const deslocamentoY = area.deslocamentoY + tremor.y;

    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    // 1. Fundo da área de jogo.
    ctx.save();
    ctx.translate(deslocamentoX, deslocamentoY);
    ctx.beginPath();
    ctx.rect(0, 0, largura, altura);
    ctx.clip();
    this.fundo.desenhar(ctx, largura, altura, this.skins.skinDeFundoAtiva);
    ctx.restore();

    ctx.save();
    ctx.translate(deslocamentoX, deslocamentoY);

    // 2. Malha discreta, para o jogador enxergar as colunas.
    this.#desenharMalha(ctx, largura, altura);

    // 3. Blocos já fixados. A matriz visível esconde a faixa de nascimento.
    const matriz = grid.matrizVisivel();
    for (let linha = 0; linha < matriz.length; linha++) {
      for (let coluna = 0; coluna < matriz[linha].length; coluna++) {
        const tipo = matriz[linha][coluna];
        if (!tipo) continue;
        // A matriz de professores usa as coordenadas do grid completo, então
        // somamos de volta a faixa de nascimento que `matrizVisivel` cortou.
        const professor = grid.professorEm(linha + grid.linhasOcultas, coluna);
        this.#pintarCelula(ctx, linha, coluna, tipo, {}, professor);
      }
    }

    // 4. Sombra da peça — desenhada antes da peça para ficar por baixo.
    if (fantasma) this.#pintarPeca(ctx, fantasma, grid.linhasOcultas, { fantasma: true });

    // 5. Peça em queda.
    if (peca) this.#pintarPeca(ctx, peca, grid.linhasOcultas);

    // 6b. Animações dos poderes especiais — puramente decorativas: o tabuleiro
    //     já está no estado final quando elas começam.
    if (efeitos?.temAlgoParaDesenhar) {
      efeitos.desenhar(ctx, this.tamanhoDaCelula, grid.linhasOcultas, largura, altura);
    }

    // 6c. Partículas das eliminações. Ficam recortadas na área de jogo para os
    //     fragmentos não voarem por cima do placar.
    if (particulas?.temAlgoParaDesenhar) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, largura, altura);
      ctx.clip();
      particulas.desenhar(ctx);
      ctx.restore();
    }

    // 7. Moldura. Marca onde o tabuleiro começa e termina — sem ela, a área de
    // jogo se dissolve no fundo da página, que é quase da mesma cor.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, largura - 2, altura - 2);

    ctx.restore();
  }

  #desenharMalha(ctx, largura, altura) {
    ctx.save();
    // Visível o bastante para o jogador contar colunas de relance, discreta o
    // bastante para não competir com as peças.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let coluna = 1; coluna < this.colunas; coluna++) {
      const x = coluna * this.tamanhoDaCelula + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, altura);
    }
    for (let linha = 1; linha < this.linhas; linha++) {
      const y = linha * this.tamanhoDaCelula + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(largura, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Pinta uma célula pedindo o pintor ao registro de skins.
   * Esta é, literalmente, a fronteira entre lógica e aparência no projeto.
   *
   * @param {string|null} [professor]  id do professor nesta célula, se houver
   */
  #pintarCelula(ctx, linha, coluna, tipo, opcoes = {}, professor = null) {
    const pintor = this.skins.pintorPara(tipo);
    if (!pintor) return;

    const x = coluna * this.tamanhoDaCelula;
    const y = linha * this.tamanhoDaCelula;

    pintor.pintar(ctx, x, y, this.tamanhoDaCelula, {
      ...opcoes,
      simbolo: this.skins.simboloPara(tipo),
    });

    // A marca do professor vai POR CIMA do bloco já pintado, então funciona
    // igual com skin de cor, de textura ou de foto. A sombra da peça não
    // recebe marca: ela indicaria um poder onde ainda não há bloco nenhum.
    if (professor && !opcoes.fantasma) {
      pintor.marcarProfessor(ctx, x, y, this.tamanhoDaCelula, this.skins.visualDoProfessor(professor));
    }
  }

  /** Pinta todas as células de uma peça, convertendo da linha do grid para a linha visível. */
  #pintarPeca(ctx, peca, linhasOcultas, opcoes = {}) {
    for (const { linha, coluna, professor } of peca.celulasOcupadas()) {
      const linhaVisivel = linha - linhasOcultas;
      // Parte da peça pode estar na faixa de nascimento, acima do tabuleiro visível.
      if (linhaVisivel < 0) continue;
      this.#pintarCelula(ctx, linhaVisivel, coluna, peca.tipo, opcoes, professor);
    }
  }

  /**
   * Desenha uma peça isolada, centralizada — usada nos painéis "próxima peça",
   * "reserva" e nas miniaturas da galeria de skins.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} tipo
   * @param {number} largura
   * @param {number} altura
   * @param {number[][]} matriz  forma da peça
   * @param {string|null} [professor]  marca desenhada no primeiro bloco, quando houver
   */
  desenharPecaIsolada(ctx, tipo, largura, altura, matriz, professor = null) {
    ctx.clearRect(0, 0, largura, altura);

    // Descobre a caixa realmente ocupada, para centralizar sem contar linhas vazias.
    let minLinha = Infinity;
    let maxLinha = -Infinity;
    let minColuna = Infinity;
    let maxColuna = -Infinity;

    for (let l = 0; l < matriz.length; l++) {
      for (let c = 0; c < matriz[l].length; c++) {
        if (matriz[l][c]) {
          minLinha = Math.min(minLinha, l);
          maxLinha = Math.max(maxLinha, l);
          minColuna = Math.min(minColuna, c);
          maxColuna = Math.max(maxColuna, c);
        }
      }
    }
    if (minLinha === Infinity) return;

    const largurasEmCelulas = maxColuna - minColuna + 1;
    const alturasEmCelulas = maxLinha - minLinha + 1;
    const tamanho = Math.floor(
      Math.min(largura / (largurasEmCelulas + 0.6), altura / (alturasEmCelulas + 0.6)),
    );
    const inicioX = (largura - largurasEmCelulas * tamanho) / 2;
    const inicioY = (altura - alturasEmCelulas * tamanho) / 2;

    const pintor = this.skins.pintorPara(tipo);
    const simbolo = this.skins.simboloPara(tipo);

    // Numa miniatura não interessa QUAL bloco carrega a marca — o painel é
    // pequeno demais para isso importar. O que precisa ficar claro é que existe
    // um professor ali, então marcamos o primeiro bloco desenhado.
    let jaMarcou = false;

    for (let l = minLinha; l <= maxLinha; l++) {
      for (let c = minColuna; c <= maxColuna; c++) {
        if (!matriz[l][c]) continue;

        const x = inicioX + (c - minColuna) * tamanho;
        const y = inicioY + (l - minLinha) * tamanho;

        pintor.pintar(ctx, x, y, tamanho, { simbolo });

        if (professor && !jaMarcou) {
          pintor.marcarProfessor(ctx, x, y, tamanho, this.skins.visualDoProfessor(professor));
          jaMarcou = true;
        }
      }
    }
  }
}
