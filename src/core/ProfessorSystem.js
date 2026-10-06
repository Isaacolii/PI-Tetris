/**
 * ProfessorSystem.js — Detecta encontros entre professores e dispara os poderes.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Responde a uma pergunta só, feita toda vez que uma peça trava:
 * "algum professor desta peça encostou em outro professor?"
 *
 * Se sim, os dois são consumidos e o poder correspondente é executado.
 *
 * Também cuida do sorteio: quais peças recebem professor e qual professor elas
 * recebem. O sorteio usa o gerador com semente da partida, então o modo
 * Professores continua determinístico — mesma semente, mesma sequência de
 * professores. Sem isso, nenhum teste do sistema seria confiável.
 */

import { IDS_DE_PROFESSOR } from './Professores.js';
import { executarPoder, executarPoderIndividual } from './PoderesEspeciais.js';

/**
 * A cada quantas peças, em média, aparece um professor.
 * Ajustar aqui é a alavanca de balanceamento do modo — quanto menor, mais
 * poderes e mais caos; quanto maior, mais parece Tetris comum.
 */
export const PECAS_ENTRE_PROFESSORES = 3;

/**
 * Teto de segurança: depois desta quantidade de peças sem nenhum professor,
 * a próxima recebe um obrigatoriamente. Impede que o azar do sorteio deixe o
 * jogador muito tempo sem ver o diferencial do modo.
 */
export const MAXIMO_DE_PECAS_SEM_PROFESSOR = 5;

export class ProfessorSystem {
  /**
   * @param {() => number} sortear  função que devolve um número em [0, 1),
   *                                normalmente a do BagRandomizer da partida
   */
  constructor(sortear = Math.random) {
    this.sortear = sortear;
    this.reiniciar();
  }

  reiniciar() {
    this.pecasDesdeOUltimo = 0;
    /** Quantos poderes já dispararam nesta partida — vira estatística no fim. */
    this.poderesExecutados = 0;
    /** Contagem por combinação, para o relatório de fim de partida. */
    this.historico = [];
  }

  // ─────────────────────────── Sorteio ───────────────────────────

  /**
   * Decide se a próxima peça carrega um professor e qual.
   * @returns {string|null} id do professor, ou null
   */
  sortearProfessor() {
    this.pecasDesdeOUltimo++;

    const porGarantia = this.pecasDesdeOUltimo >= MAXIMO_DE_PECAS_SEM_PROFESSOR;
    const porSorte = this.sortear() < 1 / PECAS_ENTRE_PROFESSORES;

    if (!porGarantia && !porSorte) return null;

    this.pecasDesdeOUltimo = 0;
    const indice = Math.floor(this.sortear() * IDS_DE_PROFESSOR.length);
    return IDS_DE_PROFESSOR[Math.min(indice, IDS_DE_PROFESSOR.length - 1)];
  }

  /** Marca a peça com um professor sorteado, se for o caso. */
  prepararPeca(peca) {
    const professor = this.sortearProfessor();
    if (!professor) return null;

    const totalDeCelulas = peca.celulasOcupadas().length;
    const indice = Math.floor(this.sortear() * totalDeCelulas);
    peca.marcarComProfessor(professor, indice);
    return professor;
  }

  // ─────────────────────────── Detecção ───────────────────────────

  /**
   * Procura um encontro entre os professores recém-fixados e os que já estavam
   * no tabuleiro.
   *
   * @param {import('./Grid.js').Grid} grid
   * @param {{linha: number, coluna: number, professor: string}[]} recemFixados
   * @returns {{a: object, b: object}|null} o par encontrado, ou null
   */
  encontrarPar(grid, recemFixados) {
    for (const bloco of recemFixados) {
      for (const vizinho of grid.vizinhosOrtogonais(bloco.linha, bloco.coluna)) {
        const professorVizinho = grid.professorEm(vizinho.linha, vizinho.coluna);
        if (!professorVizinho) continue;

        // Não vale combinar com um bloco da própria peça que acabou de cair:
        // ela só traz um professor, então isso nunca acontece hoje — mas a
        // guarda protege caso a raridade mude para várias marcas por peça.
        const ehDaPropriaPeca = recemFixados.some(
          (outro) => outro.linha === vizinho.linha && outro.coluna === vizinho.coluna,
        );
        if (ehDaPropriaPeca) continue;

        return {
          a: bloco,
          b: { ...vizinho, professor: professorVizinho },
        };
      }
    }

    return null;
  }

  /**
   * Fluxo completo depois que uma peça é fixada.
   *
   * @param {import('./Grid.js').Grid} grid
   * @param {{linha: number, coluna: number, professor: string}[]} recemFixados
   * @returns {object|null} relatório do poder executado, ou null se nada aconteceu
   */
  resolverAoFixar(grid, recemFixados) {
    if (!recemFixados || recemFixados.length === 0) return null;

    const par = this.encontrarPar(grid, recemFixados);
    if (!par) return null;

    // Os dois blocos são consumidos ANTES do poder rodar. Assim eles não podem
    // ser contados de novo, e o poder age sobre um tabuleiro já sem eles.
    grid.removerBloco(par.a.linha, par.a.coluna);
    grid.removerBloco(par.b.linha, par.b.coluna);

    const ponto = { linha: par.a.linha, coluna: par.a.coluna };
    const relatorio = executarPoder(grid, par.a.professor, par.b.professor, ponto);

    this.poderesExecutados++;
    this.historico.push({
      professores: [par.a.professor, par.b.professor],
      nome: relatorio.nome,
    });

    return relatorio;
  }

  /**
   * Professores levados por uma linha completada agem sozinhos, em versão reduzida.
   *
   * Precisa ser chamado ANTES de a linha ser removida — depois, a informação de
   * quem estava ali já se perdeu.
   *
   * @returns {object[]} relatórios dos poderes individuais
   */
  resolverAoLimparLinhas(grid, linhas) {
    const encontrados = grid.professoresNasLinhas(linhas);
    if (encontrados.length === 0) return [];

    const relatorios = [];

    for (const { linha, coluna, professor } of encontrados) {
      // Some primeiro, para não disparar o próprio poder sobre si mesmo.
      grid.removerBloco(linha, coluna);

      const relatorio = executarPoderIndividual(grid, professor, { linha, coluna });
      if (relatorio) {
        this.poderesExecutados++;
        relatorios.push(relatorio);
      }
    }

    return relatorios;
  }

  /** Resumo para o fim de partida e para a análise de desempenho. */
  resumo() {
    const porCombinacao = {};
    for (const item of this.historico) {
      porCombinacao[item.nome] = (porCombinacao[item.nome] ?? 0) + 1;
    }
    return {
      poderesExecutados: this.poderesExecutados,
      porCombinacao,
    };
  }
}
