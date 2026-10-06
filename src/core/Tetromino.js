/**
 * Tetromino.js — Definição matemática das 7 peças.
 *
 * CAMADA: núcleo (lógica pura).
 * Este arquivo não sabe o que é cor, imagem, pixel ou canvas. Uma peça aqui é
 * apenas um identificador ('I', 'O', 'T'...) e uma matriz de 0s e 1s.
 * A aparência é responsabilidade exclusiva de src/render/.
 */

/** Identificadores das sete peças clássicas. A ordem importa para o sorteio 7-bag. */
export const TIPOS_DE_PECA = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/**
 * Formas na rotação inicial (estado 0), conforme o padrão SRS.
 * O I usa matriz 4x4 e o O usa 2x2 porque seus centros de rotação são diferentes
 * dos das demais peças — isso não é detalhe estético, é o que faz o SRS funcionar.
 */
const FORMAS_BASE = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

/** Devolve uma cópia da matriz base do tipo pedido (nunca a original, para não mutar). */
export function criarMatriz(tipo) {
  const base = FORMAS_BASE[tipo];
  if (!base) throw new Error(`Tipo de peça desconhecido: ${tipo}`);
  return base.map((linha) => [...linha]);
}

/**
 * Rotaciona uma matriz quadrada.
 * @param {number[][]} matriz
 * @param {1|-1} sentido  1 = horário, -1 = anti-horário
 */
export function rotacionarMatriz(matriz, sentido) {
  const n = matriz.length;
  const nova = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let linha = 0; linha < n; linha++) {
    for (let coluna = 0; coluna < n; coluna++) {
      if (sentido === 1) {
        // Horário: a linha vira coluna espelhada.
        nova[coluna][n - 1 - linha] = matriz[linha][coluna];
      } else {
        // Anti-horário: a coluna vira linha espelhada.
        nova[n - 1 - coluna][linha] = matriz[linha][coluna];
      }
    }
  }
  return nova;
}

/**
 * Uma peça em jogo: tipo, forma atual, posição no grid e estado de rotação.
 * A posição é a da célula superior-esquerda da matriz, não do bloco.
 */
export class PecaAtiva {
  /**
   * @param {string} tipo
   * @param {number} linha    posição vertical no grid (cresce para baixo)
   * @param {number} coluna   posição horizontal no grid
   */
  constructor(tipo, linha = 0, coluna = 0) {
    this.tipo = tipo;
    this.matriz = criarMatriz(tipo);
    this.linha = linha;
    this.coluna = coluna;
    /** Estado de rotação: 0 = inicial, 1 = horário, 2 = 180°, 3 = anti-horário. */
    this.rotacao = 0;

    /**
     * Modo Professores: id do professor que esta peça carrega, ou null.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * A MARCA GUARDA POSIÇÃO NA MATRIZ, NÃO ÍNDICE NA LISTA.
     *
     * A primeira versão guardava o índice da célula na lista devolvida por
     * `celulasOcupadas()` — e isso era um bug. Essa lista é montada varrendo a
     * matriz de cima para baixo, e a rotação reorganiza a matriz: a célula de
     * índice 1 antes do giro não é a mesma célula física depois dele.
     *
     * Na prática, a marca do professor pulava de bloco ao girar a peça.
     *
     * Guardando a posição {linha, coluna} DENTRO da matriz, basta aplicar à
     * marca a mesma transformação aplicada à matriz (ver `girarMarca`), e ela
     * permanece no mesmo bloco físico.
     * ─────────────────────────────────────────────────────────────────────────
     *
     * @type {string|null}
     */
    this.professor = null;

    /** @type {{linha: number, coluna: number}} posição da marca dentro da matriz */
    this.posicaoDoProfessor = { linha: 0, coluna: 0 };
  }

  /** Cópia independente — usada para testar movimentos antes de confirmá-los. */
  clonar() {
    const copia = new PecaAtiva(this.tipo, this.linha, this.coluna);
    copia.matriz = this.matriz.map((linha) => [...linha]);
    copia.rotacao = this.rotacao;
    copia.professor = this.professor;
    copia.posicaoDoProfessor = { ...this.posicaoDoProfessor };
    return copia;
  }

  /** Posições preenchidas da matriz, em coordenadas relativas à peça. */
  #celulasDaMatriz() {
    const celulas = [];
    for (let l = 0; l < this.matriz.length; l++) {
      for (let c = 0; c < this.matriz[l].length; c++) {
        if (this.matriz[l][c]) celulas.push({ linha: l, coluna: c });
      }
    }
    return celulas;
  }

  /**
   * Coloca um professor numa das células da peça.
   *
   * @param {string} professor  id ('A'..'E')
   * @param {number} [indice]   qual das células preenchidas recebe a marca.
   *                            É só a forma de ESCOLHER a célula; o que fica
   *                            guardado é a posição dela na matriz.
   */
  marcarComProfessor(professor, indice = 0) {
    const celulas = this.#celulasDaMatriz();
    if (celulas.length === 0) return;

    this.professor = professor;
    this.posicaoDoProfessor = { ...celulas[Math.abs(indice) % celulas.length] };
  }

  /**
   * Aplica à marca a mesma rotação aplicada à matriz.
   *
   * Precisa acompanhar exatamente a fórmula de `rotacionarMatriz`:
   *   horário       nova[coluna][n-1-linha] = matriz[linha][coluna]
   *   anti-horário  nova[n-1-coluna][linha] = matriz[linha][coluna]
   *
   * Se as duas divergirem, a marca volta a pular de bloco — por isso há teste
   * conferindo que a célula marcada continua sendo a mesma após quatro giros.
   *
   * @param {1|-1} sentido
   */
  girarMarca(sentido) {
    if (!this.professor) return;

    const n = this.matriz.length;
    const { linha, coluna } = this.posicaoDoProfessor;

    this.posicaoDoProfessor =
      sentido === 1
        ? { linha: coluna, coluna: n - 1 - linha }
        : { linha: n - 1 - coluna, coluna: linha };
  }

  /**
   * Coordenadas absolutas das células preenchidas, já somadas à posição da peça.
   * É por aqui que o Grid enxerga a peça — ele nunca lê a matriz diretamente.
   *
   * Quando a peça carrega um professor, a célula correspondente vem com o campo
   * `professor` preenchido; nas demais ele é null.
   *
   * @returns {{linha: number, coluna: number, professor: string|null}[]}
   */
  celulasOcupadas() {
    const celulas = [];

    for (let l = 0; l < this.matriz.length; l++) {
      for (let c = 0; c < this.matriz[l].length; c++) {
        if (!this.matriz[l][c]) continue;

        // A marca é reconhecida pela POSIÇÃO na matriz, então continua no mesmo
        // bloco mesmo depois de a peça girar.
        const marcada =
          this.professor !== null &&
          l === this.posicaoDoProfessor.linha &&
          c === this.posicaoDoProfessor.coluna;

        celulas.push({
          linha: this.linha + l,
          coluna: this.coluna + c,
          professor: marcada ? this.professor : null,
        });
      }
    }

    return celulas;
  }
}
