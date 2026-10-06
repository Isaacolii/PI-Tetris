/**
 * Grid.js — O tabuleiro: matriz, colisão, fixação e limpeza de linhas.
 *
 * CAMADA: núcleo (lógica pura).
 * Cada célula guarda `null` (vazia) ou o IDENTIFICADOR do tipo de peça ('I','O',...).
 * Jamais uma cor, jamais um caminho de imagem. É essa decisão que permite trocar
 * blocos coloridos por fotos de rostos sem tocar em uma linha deste arquivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MATRIZ PARALELA DE PROFESSORES
 *
 * O modo Professores precisa saber que uma célula carrega o Professor B. Em vez
 * de trocar o conteúdo de `celulas` por um objeto — o que quebraria a regra
 * acima e obrigaria a mexer no renderizador, nas estatísticas e nos testes —
 * existe uma SEGUNDA matriz, do mesmo tamanho, guardando `null` ou 'A'..'E':
 *
 *     celulas[l][c]     = 'T'    ← tipo da peça, como sempre foi
 *     professores[l][c] = 'B'    ← quem está ali, ou null
 *
 * As duas guardam identidade, nunca aparência — a mesma filosofia. A única
 * obrigação é mantê-las em sincronia: toda operação que mexe em uma precisa
 * mexer na outra, ou o tabuleiro passa a mostrar um professor onde não há bloco.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class Grid {
  /**
   * @param {number} colunas          largura do tabuleiro (padrão 10)
   * @param {number} linhasVisiveis   altura mostrada ao jogador (padrão 20)
   * @param {number} linhasOcultas    faixa acima do topo onde as peças nascem (padrão 2)
   */
  constructor(colunas = 10, linhasVisiveis = 20, linhasOcultas = 2) {
    this.colunas = colunas;
    this.linhasVisiveis = linhasVisiveis;
    this.linhasOcultas = linhasOcultas;
    this.totalDeLinhas = linhasVisiveis + linhasOcultas;
    this.celulas = this.#criarMatrizVazia();
    this.professores = this.#criarMatrizVazia();
  }

  #criarMatrizVazia() {
    return Array.from({ length: this.totalDeLinhas }, () =>
      new Array(this.colunas).fill(null),
    );
  }

  /** Esvazia o tabuleiro (reinício de partida). */
  limpar() {
    this.celulas = this.#criarMatrizVazia();
    this.professores = this.#criarMatrizVazia();
  }

  /**
   * A célula existe e está livre?
   * Fora das laterais e abaixo do fundo conta como ocupado. Acima do topo conta
   * como livre — é lá que a peça nasce antes de entrar na área visível.
   */
  estaLivre(linha, coluna) {
    if (coluna < 0 || coluna >= this.colunas) return false;
    if (linha >= this.totalDeLinhas) return false;
    if (linha < 0) return true;
    return this.celulas[linha][coluna] === null;
  }

  /** A peça, na posição em que está, bate em alguma coisa? */
  colide(peca) {
    return peca.celulasOcupadas().some(({ linha, coluna }) => !this.estaLivre(linha, coluna));
  }

  /**
   * Grava a peça no tabuleiro em definitivo, guardando só o tipo dela.
   *
   * Se a peça carregar um professor numa de suas células, a marca vai para a
   * matriz paralela — nunca misturada ao tipo.
   *
   * @returns {{linha: number, coluna: number, professor: string}[]} onde os
   *          professores desta peça ficaram, para o sistema de poderes conferir
   *          a vizinhança logo em seguida
   */
  fixar(peca) {
    const marcados = [];

    for (const celula of peca.celulasOcupadas()) {
      const { linha, coluna } = celula;
      if (linha < 0 || linha >= this.totalDeLinhas || coluna < 0 || coluna >= this.colunas) {
        continue;
      }

      this.celulas[linha][coluna] = peca.tipo;

      if (celula.professor) {
        this.professores[linha][coluna] = celula.professor;
        marcados.push({ linha, coluna, professor: celula.professor });
      }
    }

    return marcados;
  }

  // ─────────────────────────── Professores ───────────────────────────

  /** Quem está nesta célula, ou null. Fora dos limites também devolve null. */
  professorEm(linha, coluna) {
    if (linha < 0 || linha >= this.totalDeLinhas) return null;
    if (coluna < 0 || coluna >= this.colunas) return null;
    return this.professores[linha][coluna];
  }

  /** Marca (ou desmarca, passando null) o professor de uma célula. */
  definirProfessor(linha, coluna, professor) {
    if (linha < 0 || linha >= this.totalDeLinhas) return;
    if (coluna < 0 || coluna >= this.colunas) return;
    this.professores[linha][coluna] = professor;
  }

  /**
   * Apaga uma célula por completo — bloco e professor juntos.
   * É por aqui que todo poder de destruição remove blocos, justamente para as
   * duas matrizes nunca saírem de sincronia.
   *
   * @returns {boolean} true se havia algo ali
   */
  removerBloco(linha, coluna) {
    if (linha < 0 || linha >= this.totalDeLinhas) return false;
    if (coluna < 0 || coluna >= this.colunas) return false;

    const tinhaBloco = this.celulas[linha][coluna] !== null;
    this.celulas[linha][coluna] = null;
    this.professores[linha][coluna] = null;
    return tinhaBloco;
  }

  /**
   * Vizinhos ortogonais de uma célula: acima, abaixo, esquerda e direita.
   *
   * Diagonal NÃO conta — dois professores na diagonal não combinam. É uma
   * decisão de jogabilidade: diagonal aconteceria por acaso o tempo todo e o
   * jogador perderia o controle sobre quando o poder dispara.
   */
  vizinhosOrtogonais(linha, coluna) {
    const deslocamentos = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    return deslocamentos
      .map(([dl, dc]) => ({ linha: linha + dl, coluna: coluna + dc }))
      .filter(
        (v) =>
          v.linha >= 0 &&
          v.linha < this.totalDeLinhas &&
          v.coluna >= 0 &&
          v.coluna < this.colunas,
      );
  }

  /**
   * Remove as linhas que ficaram COMPLETAMENTE VAZIAS e faz o resto descer.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * Isto conserta um comportamento que parecia bug — e era.
   *
   * Um poder que elimina uma linha inteira (Explosão Horizontal, Cruz
   * Acadêmica, Varredura) deixava a faixa vazia no lugar, com a pilha
   * flutuando acima dela. No Tetris, linha que desaparece faz o resto descer:
   * é a mecânica mais básica do jogo, e violá-la faz o tabuleiro parecer
   * quebrado.
   *
   * Diferente de `compactar()`: aqui a FORMA da pilha é preservada — as linhas
   * descem juntas, como numa limpeza normal. `compactar` derruba cada coluna
   * separadamente e apaga buracos, o que é o efeito exclusivo da Reorganização.
   * ───────────────────────────────────────────────────────────────────────────
   *
   * @returns {number[]} índices das linhas que desmoronaram
   */
  desmoronarLinhasVazias() {
    const vazias = [];

    for (let linha = 0; linha < this.totalDeLinhas; linha++) {
      const estaVazia = this.celulas[linha].every((celula) => celula === null);
      if (!estaVazia) continue;

      // Só desmorona se houver algo ACIMA para descer. Uma faixa vazia no topo
      // do tabuleiro é o estado normal do jogo, não um vão a fechar.
      const temBlocoAcima = this.celulas
        .slice(0, linha)
        .some((outra) => outra.some((celula) => celula !== null));

      if (temBlocoAcima) vazias.push(linha);
    }

    if (vazias.length > 0) this.removerLinhas(vazias);
    return vazias;
  }

  /**
   * Faz todos os blocos caírem até encostar, eliminando os buracos.
   * É o efeito do poder de Reorganização (D+E) — e o único lugar do jogo onde
   * a pilha se reacomoda sozinha.
   *
   * @returns {number} quantos blocos mudaram de lugar
   */
  compactar() {
    let movidos = 0;

    for (let coluna = 0; coluna < this.colunas; coluna++) {
      // Recolhe o que existe na coluna, de baixo para cima, preservando a ordem.
      const empilhados = [];
      for (let linha = this.totalDeLinhas - 1; linha >= 0; linha--) {
        if (this.celulas[linha][coluna] !== null) {
          empilhados.push({
            tipo: this.celulas[linha][coluna],
            professor: this.professores[linha][coluna],
            linhaOriginal: linha,
          });
        }
      }

      // Reescreve a coluna colada no fundo.
      for (let linha = 0; linha < this.totalDeLinhas; linha++) {
        this.celulas[linha][coluna] = null;
        this.professores[linha][coluna] = null;
      }

      empilhados.forEach((bloco, indice) => {
        const destino = this.totalDeLinhas - 1 - indice;
        this.celulas[destino][coluna] = bloco.tipo;
        this.professores[destino][coluna] = bloco.professor;
        if (destino !== bloco.linhaOriginal) movidos++;
      });
    }

    return movidos;
  }

  /**
   * Buracos: células vazias com pelo menos um bloco acima, na mesma coluna.
   * Diferente de `contarBuracos`, aqui devolvemos ONDE eles estão — é o que os
   * poderes de conversão precisam para tapá-los.
   *
   * @returns {{linha: number, coluna: number}[]} de baixo para cima
   */
  localizarBuracos() {
    const buracos = [];

    for (let coluna = 0; coluna < this.colunas; coluna++) {
      let achouBloco = false;
      for (let linha = 0; linha < this.totalDeLinhas; linha++) {
        if (this.celulas[linha][coluna] !== null) achouBloco = true;
        else if (achouBloco) buracos.push({ linha, coluna });
      }
    }

    // Buraco mais fundo primeiro: tapar de baixo para cima é o que ajuda o jogador.
    return buracos.sort((a, b) => b.linha - a.linha);
  }

  /** Índices das linhas totalmente preenchidas, de cima para baixo. */
  linhasCompletas() {
    const completas = [];
    for (let linha = 0; linha < this.totalDeLinhas; linha++) {
      if (this.celulas[linha].every((celula) => celula !== null)) completas.push(linha);
    }
    return completas;
  }

  /**
   * Remove as linhas indicadas e faz o que está acima descer.
   * @returns {number} quantas linhas saíram
   */
  removerLinhas(indices) {
    if (indices.length === 0) return 0;
    const aRemover = new Set(indices);

    const vazias = () =>
      Array.from({ length: indices.length }, () => new Array(this.colunas).fill(null));

    // As duas matrizes sofrem exatamente a mesma operação, no mesmo momento.
    // Espelhar aqui é obrigatório: uma linha removida só de `celulas` deixaria
    // o professor dela órfão, flutuando sobre uma célula vazia.
    this.celulas = [...vazias(), ...this.celulas.filter((_, l) => !aRemover.has(l))];
    this.professores = [...vazias(), ...this.professores.filter((_, l) => !aRemover.has(l))];

    return indices.length;
  }

  /**
   * Quais professores estão nas linhas indicadas.
   * Consultado ANTES de remover as linhas, para o sistema saber quem foi levado
   * junto e conceder o poder individual de cada um.
   */
  professoresNasLinhas(indices) {
    const encontrados = [];
    for (const linha of indices) {
      if (linha < 0 || linha >= this.totalDeLinhas) continue;
      for (let coluna = 0; coluna < this.colunas; coluna++) {
        const professor = this.professores[linha][coluna];
        if (professor) encontrados.push({ linha, coluna, professor });
      }
    }
    return encontrados;
  }

  /** A pilha invadiu a faixa oculta? É o critério de fim de jogo. */
  transbordou() {
    for (let linha = 0; linha < this.linhasOcultas; linha++) {
      if (this.celulas[linha].some((celula) => celula !== null)) return true;
    }
    return false;
  }

  // ─────────── Consultas usadas pelas estatísticas e pela análise por IA ───────────

  /** Altura da pilha em cada coluna, medida a partir do fundo. */
  alturasPorColuna() {
    const alturas = new Array(this.colunas).fill(0);
    for (let coluna = 0; coluna < this.colunas; coluna++) {
      for (let linha = 0; linha < this.totalDeLinhas; linha++) {
        if (this.celulas[linha][coluna] !== null) {
          alturas[coluna] = this.totalDeLinhas - linha;
          break;
        }
      }
    }
    return alturas;
  }

  /**
   * Buracos: células vazias que têm pelo menos um bloco acima delas na mesma coluna.
   * É a métrica que mais separa jogador iniciante de jogador experiente.
   */
  contarBuracos() {
    let buracos = 0;
    for (let coluna = 0; coluna < this.colunas; coluna++) {
      let achouBloco = false;
      for (let linha = 0; linha < this.totalDeLinhas; linha++) {
        if (this.celulas[linha][coluna] !== null) achouBloco = true;
        else if (achouBloco) buracos++;
      }
    }
    return buracos;
  }

  /** Soma das diferenças de altura entre colunas vizinhas — mede o quanto a pilha está irregular. */
  irregularidade() {
    const alturas = this.alturasPorColuna();
    let soma = 0;
    for (let i = 0; i < alturas.length - 1; i++) soma += Math.abs(alturas[i] - alturas[i + 1]);
    return soma;
  }

  /** Só a parte visível, para a camada de renderização desenhar. */
  matrizVisivel() {
    return this.celulas.slice(this.linhasOcultas).map((linha) => [...linha]);
  }
}
