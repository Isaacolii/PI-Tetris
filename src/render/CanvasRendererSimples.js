/**
 * CanvasRendererSimples.js — desenha o tabuleiro com formas geométricas.
 *
 * CAMADA: renderização.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE ARQUIVO NÃO IMPORTA NADA.
 *
 *  Ele recebe o tabuleiro pronto e só traduz números em pixels. Não sabe o que
 *  é uma rotação, não conhece a pontuação e nunca decide nada sobre o jogo.
 *
 *  É por isso que o protótipo desta entrega pode desenhar retângulos coloridos
 *  hoje e fotos de pessoas depois, sem que uma linha da pasta `core/` mude.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nesta entrega o desenho é propositalmente simples — retângulo chapado por
 * bloco e um disco com letra para a marca do professor. O enunciado do PI 2
 * pede exatamente isso: "elementos gráficos simples (placeholders, formas
 * geométricas ou textos)".
 */

/**
 * Cor de cada tipo de peça.
 *
 * Esta tabela é o ÚNICO lugar do projeto que sabe que um 'T' é roxo. O motor
 * guarda a letra; quem escolhe a aparência é aqui.
 */
const CORES = {
  I: '#31c7ef',
  O: '#f7d308',
  T: '#ad4d9c',
  S: '#42b642',
  Z: '#ef2029',
  J: '#5a65ad',
  L: '#ef7921',
};

/** Cor do disco de cada professor. A letra desenhada é a própria chave. */
const CORES_DE_PROFESSOR = {
  A: '#ff5252',
  B: '#40c4ff',
  C: '#69f0ae',
  D: '#ffd740',
  E: '#b388ff',
};

const COR_DO_FUNDO = '#12141c';
const COR_DA_GRADE = '#1e2230';
const COR_DA_BORDA = '#2b3145';

/** Lado de cada célula em pixels, antes de multiplicar pela densidade da tela. */
const LADO_DA_CELULA = 30;

export class CanvasRendererSimples {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lado = LADO_DA_CELULA;
    this.colunas = 10;
    this.linhas = 20;
  }

  /**
   * Ajusta o tamanho do canvas ao tabuleiro e à densidade da tela.
   *
   * Sem o `devicePixelRatio` o desenho sai borrado em tela de celular e em
   * monitor com escala do Windows diferente de 100%.
   *
   * @param {number} colunas
   * @param {number} linhas  linhas VISÍVEIS (as ocultas do topo não entram)
   */
  redimensionar(colunas, linhas) {
    this.colunas = colunas;
    this.linhas = linhas;

    const densidade = window.devicePixelRatio || 1;
    const largura = colunas * this.lado;
    const altura = linhas * this.lado;

    this.canvas.width = largura * densidade;
    this.canvas.height = altura * densidade;
    this.canvas.style.width = `${largura}px`;
    this.canvas.style.height = `${altura}px`;

    this.ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
  }

  /**
   * Desenha um quadro inteiro.
   *
   * Recebe um retrato do estado — nunca o motor em si. Se receber `null` em
   * `peca`, simplesmente não desenha peça: é o que acontece na pausa e no fim
   * de jogo, sem precisar de nenhum aviso especial.
   *
   * @param {{grid: object, peca: object|null, fantasma: object|null}} estado
   */
  desenhar({ grid, peca = null, fantasma = null }) {
    const ctx = this.ctx;

    ctx.fillStyle = COR_DO_FUNDO;
    ctx.fillRect(0, 0, this.colunas * this.lado, this.linhas * this.lado);

    this.#desenharGrade();

    // Blocos já travados. `linhasOcultas` são as linhas acima do topo visível,
    // onde a peça nasce — elas existem no motor e não devem aparecer.
    for (let linha = grid.linhasOcultas; linha < grid.totalDeLinhas; linha++) {
      for (let coluna = 0; coluna < grid.colunas; coluna++) {
        const tipo = grid.celulas[linha][coluna];
        if (!tipo) continue;

        const linhaVisivel = linha - grid.linhasOcultas;
        this.#desenharBloco(linhaVisivel, coluna, CORES[tipo] ?? '#8894a8');

        const professor = grid.professores[linha][coluna];
        if (professor) this.#desenharMarca(linhaVisivel, coluna, professor);
      }
    }

    // Sombra de onde a peça vai cair. Desenhada antes da peça para que a peça
    // fique por cima quando as duas se sobrepõem.
    if (fantasma) this.#desenharPeca(fantasma, grid, true);
    if (peca) this.#desenharPeca(peca, grid, false);
  }

  // ───────────────────────────── desenho interno ─────────────────────────────

  #desenharGrade() {
    const ctx = this.ctx;
    ctx.strokeStyle = COR_DA_GRADE;
    ctx.lineWidth = 1;

    // O deslocamento de meio pixel é o que impede a linha de 1px de sair
    // borrada em dois pixels cinzentos.
    for (let c = 1; c < this.colunas; c++) {
      const x = Math.round(c * this.lado) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.linhas * this.lado);
      ctx.stroke();
    }
    for (let l = 1; l < this.linhas; l++) {
      const y = Math.round(l * this.lado) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.colunas * this.lado, y);
      ctx.stroke();
    }
  }

  /**
   * @param {object} peca
   * @param {object} grid
   * @param {boolean} ehFantasma
   */
  #desenharPeca(peca, grid, ehFantasma) {
    for (const { linha, coluna, professor } of peca.celulasOcupadas()) {
      const linhaVisivel = linha - grid.linhasOcultas;

      // Parte da peça ainda está acima do topo visível logo que ela nasce.
      if (linhaVisivel < 0) continue;

      if (ehFantasma) {
        this.#desenharContorno(linhaVisivel, coluna, CORES[peca.tipo] ?? '#8894a8');
      } else {
        this.#desenharBloco(linhaVisivel, coluna, CORES[peca.tipo] ?? '#8894a8');
        if (professor) this.#desenharMarca(linhaVisivel, coluna, professor);
      }
    }
  }

  #desenharBloco(linhaVisivel, coluna, cor) {
    const ctx = this.ctx;
    const x = coluna * this.lado;
    const y = linhaVisivel * this.lado;

    ctx.fillStyle = cor;
    ctx.fillRect(x + 1, y + 1, this.lado - 2, this.lado - 2);

    // Uma borda mais escura separa blocos vizinhos da mesma cor — sem ela,
    // quatro peças O empilhadas viram um retângulo amarelo sem forma.
    ctx.strokeStyle = COR_DA_BORDA;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, this.lado - 2, this.lado - 2);
  }

  #desenharContorno(linhaVisivel, coluna, cor) {
    const ctx = this.ctx;
    const x = coluna * this.lado;
    const y = linhaVisivel * this.lado;

    ctx.strokeStyle = cor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, this.lado - 4, this.lado - 4);
    ctx.globalAlpha = 1;
  }

  /**
   * A marca do professor: disco colorido com a letra do identificador.
   *
   * Quando as caricaturas ficarem prontas (PI 3), este método troca o disco
   * por `ctx.drawImage`. Nada fora deste arquivo precisa mudar.
   */
  #desenharMarca(linhaVisivel, coluna, professor) {
    const ctx = this.ctx;
    const centroX = coluna * this.lado + this.lado / 2;
    const centroY = linhaVisivel * this.lado + this.lado / 2;
    const raio = this.lado * 0.32;

    ctx.beginPath();
    ctx.arc(centroX, centroY, raio, 0, Math.PI * 2);
    ctx.fillStyle = CORES_DE_PROFESSOR[professor] ?? '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#12141c';
    ctx.font = `700 ${Math.round(this.lado * 0.42)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(professor, centroX, centroY + 1);
  }

  /**
   * Desenha uma peça fora do tabuleiro — usado na caixa "próxima" e "reserva".
   * @param {CanvasRenderingContext2D} ctx
   * @param {object|null} peca  objeto com `tipo` e `matriz`
   */
  static desenharPecaIsolada(ctx, peca) {
    const largura = ctx.canvas.width;
    const altura = ctx.canvas.height;

    ctx.clearRect(0, 0, largura, altura);
    if (!peca) return;

    // Descobre a caixa que a peça realmente ocupa, para centralizar sem que a
    // peça I fique encostada na borda e a O fique no canto.
    let minL = Infinity;
    let maxL = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;

    for (let l = 0; l < peca.matriz.length; l++) {
      for (let c = 0; c < peca.matriz[l].length; c++) {
        if (!peca.matriz[l][c]) continue;
        minL = Math.min(minL, l);
        maxL = Math.max(maxL, l);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
    if (minL === Infinity) return;

    const blocosLargura = maxC - minC + 1;
    const blocosAltura = maxL - minL + 1;
    const lado = Math.min(largura / (blocosLargura + 1), altura / (blocosAltura + 1));
    const deslocX = (largura - blocosLargura * lado) / 2;
    const deslocY = (altura - blocosAltura * lado) / 2;

    ctx.fillStyle = CORES[peca.tipo] ?? '#8894a8';
    ctx.strokeStyle = COR_DA_BORDA;
    ctx.lineWidth = 2;

    for (let l = minL; l <= maxL; l++) {
      for (let c = minC; c <= maxC; c++) {
        if (!peca.matriz[l][c]) continue;
        const x = deslocX + (c - minC) * lado;
        const y = deslocY + (l - minL) * lado;
        ctx.fillRect(x + 1, y + 1, lado - 2, lado - 2);
        ctx.strokeRect(x + 1, y + 1, lado - 2, lado - 2);
      }
    }
  }
}
