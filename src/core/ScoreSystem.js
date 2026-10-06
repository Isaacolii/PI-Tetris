/**
 * ScoreSystem.js — Pontuação, nível e velocidade de queda.
 *
 * CAMADA: núcleo (lógica pura).
 * Segue a tabela do Tetris Guideline, que é a referência usada pelos jogos oficiais.
 */

/** Pontos-base por quantidade de linhas limpas de uma vez, multiplicados pelo nível. */
const PONTOS_POR_LIMPEZA = { 1: 100, 2: 300, 3: 500, 4: 800 };

/** Nome de cada tipo de limpeza — usado no relatório e na análise por IA. */
export const NOMES_DE_LIMPEZA = { 1: 'Simples', 2: 'Dupla', 3: 'Tripla', 4: 'Tetris' };

/** Linhas necessárias para subir de nível. */
const LINHAS_POR_NIVEL = 10;

export class ScoreSystem {
  constructor(nivelInicial = 1) {
    this.nivelInicial = nivelInicial;
    this.reiniciar();
  }

  reiniciar() {
    this.pontos = 0;
    this.linhas = 0;
    this.nivel = this.nivelInicial;
    /** Contagem por tipo de limpeza: { 1: n, 2: n, 3: n, 4: n } */
    this.limpezas = { 1: 0, 2: 0, 3: 0, 4: 0 };
    /** Um Tetris seguido de outro vale 50% a mais. Isso guarda se o anterior valeu bônus. */
    this.sequenciaDeTetris = false;
  }

  /**
   * Registra a limpeza de linhas e devolve o detalhamento do que foi ganho.
   * @param {number} quantidade  1 a 4
   */
  registrarLimpeza(quantidade) {
    if (quantidade <= 0) {
      // Encaixar sem limpar linha quebra a sequência de Tetris.
      this.sequenciaDeTetris = false;
      return { pontos: 0, bonusSequencia: false };
    }

    const base = (PONTOS_POR_LIMPEZA[quantidade] ?? 0) * this.nivel;
    const bonusSequencia = quantidade === 4 && this.sequenciaDeTetris;
    const ganho = bonusSequencia ? Math.floor(base * 1.5) : base;

    this.pontos += ganho;
    this.linhas += quantidade;
    this.limpezas[quantidade]++;
    this.sequenciaDeTetris = quantidade === 4;
    this.nivel = this.nivelInicial + Math.floor(this.linhas / LINHAS_POR_NIVEL);

    return { pontos: ganho, bonusSequencia, tipo: NOMES_DE_LIMPEZA[quantidade] };
  }

  /** 1 ponto por célula descida voluntariamente. */
  registrarSoftDrop(celulas) {
    this.pontos += celulas;
  }

  /** 2 pontos por célula na queda instantânea — recompensa quem joga rápido. */
  registrarHardDrop(celulas) {
    this.pontos += celulas * 2;
  }

  /**
   * Pontos por linhas eliminadas por um poder especial.
   *
   * Vale a mesma tabela, mas NÃO alimenta o bônus de Tetris consecutivo: esse
   * bônus premia quem montou o Tetris de propósito, e um poder que apaga quatro
   * linhas de uma vez não é a mesma proeza. Sem essa separação, o modo
   * Professores encheria o placar com bônus que o jogador não conquistou.
   */
  registrarLimpezaPorPoder(quantidade) {
    if (quantidade <= 0) return { pontos: 0 };

    const base = (PONTOS_POR_LIMPEZA[Math.min(quantidade, 4)] ?? 0) * this.nivel;
    this.pontos += base;
    this.linhas += quantidade;
    this.nivel = this.nivelInicial + Math.floor(this.linhas / LINHAS_POR_NIVEL);

    return { pontos: base, porPoder: true };
  }

  /** Colunas apagadas por poder não completam linha, então pontuam à parte. */
  registrarColunasPorPoder(quantidade) {
    const ganho = quantidade * 50 * this.nivel;
    this.pontos += ganho;
    return { pontos: ganho };
  }

  /**
   * Intervalo entre um passo de queda e o próximo, em milissegundos.
   * Fórmula oficial do Guideline: (0,8 - (nível-1) × 0,007) ^ (nível-1) segundos por linha.
   * O piso de 1 ms evita divisão de tempo degenerada em níveis altíssimos.
   *
   * @param {number} [multiplicador]  1 = normal; 2,5 deixa a queda 2,5× mais lenta
   *                                  (é assim que o poder do Professor E age)
   */
  intervaloDeQueda(multiplicador = 1) {
    const base = 0.8 - (this.nivel - 1) * 0.007;
    const segundos = Math.pow(Math.max(base, 0.0001), this.nivel - 1);
    return Math.max(segundos * 1000 * multiplicador, 1);
  }
}
