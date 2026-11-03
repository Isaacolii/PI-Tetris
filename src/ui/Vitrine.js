/**
 * Vitrine.js — O tabuleiro que joga sozinho na tela inicial.
 *
 * CAMADA: interface.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA É A ARQUITETURA APARECENDO NA TELA DE ABERTURA.
 *
 * A vitrine cria um GameEngine INTEIRO e o desenha com o MESMO CanvasRenderer
 * da partida real. Nenhuma linha de lógica foi duplicada, nenhum modo de
 * "demonstração" existe no motor — ele nem sabe que está numa vitrine.
 *
 * Isso só é possível porque o motor não conhece a tela e o renderizador não
 * conhece o motor: os dois trocam um retrato de estado. Duas partidas
 * simultâneas, uma jogável e outra decorativa, saem de graça.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * O jogador que abre o site vê peças caindo antes de clicar em nada — como as
 * telas de espera dos fliperamas.
 */

import { GameEngine, ESTADOS } from '../core/GameEngine.js';
import { tentarRotacionar } from '../core/RotationSystem.js';

/** Intervalo entre as jogadas do piloto automático. */
const INTERVALO_DA_JOGADA_MS = 420;

/** Colunas e linhas da vitrine. Menor que o tabuleiro real: é um cartaz. */
const COLUNAS = 10;
const LINHAS = 16;

export class Vitrine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../render/CanvasRenderer.js').CanvasRenderer} ConstrutorDeRenderizador
   * @param {import('../render/SkinRegistry.js').SkinRegistry} skins
   * @param {import('../render/BackgroundRenderer.js').BackgroundRenderer} fundo
   */
  constructor(canvas, ConstrutorDeRenderizador, skins, fundo) {
    this.canvas = canvas;
    this.skins = skins;
    this.rodando = false;
    this.acumulador = 0;

    if (!canvas) return;

    this.renderizador = new ConstrutorDeRenderizador(canvas, skins, fundo);

    // Tabuleiro menor, sem faixa de nascimento visível.
    this.jogo = new GameEngine({ modo: 'zen' });
    this.jogo.grid.colunas = COLUNAS;
    this.jogo.grid.linhasVisiveis = LINHAS;
    this.jogo.grid.linhasOcultas = 2;
    this.jogo.grid.totalDeLinhas = LINHAS + 2;
    this.jogo.grid.limpar();

    // Trocar de skin na galeria atualiza a vitrine junto.
    this.skins.aoMudar(() => this.desenhar());
  }

  iniciar() {
    if (!this.canvas || this.rodando) return;
    this.rodando = true;
    this.jogo.reiniciar({ modo: 'zen' });
    this.jogo.iniciar();
    this.redimensionar();
  }

  /** Para de gastar quadros quando a tela inicial sai de cena. */
  parar() {
    this.rodando = false;
  }

  redimensionar() {
    if (!this.canvas || !this.renderizador) return;
    this.renderizador.redimensionar(COLUNAS, LINHAS);
    this.desenhar();
  }

  /**
   * Avança a demonstração.
   * @param {number} deltaMs
   */
  atualizar(deltaMs) {
    if (!this.rodando || !this.jogo) return;

    this.jogo.update(deltaMs);

    this.acumulador += deltaMs;
    if (this.acumulador >= INTERVALO_DA_JOGADA_MS) {
      this.acumulador = 0;
      this.#jogarUmaPeca();
    }

    this.desenhar();
  }

  /**
   * Piloto automático com heurística.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * Duas versões anteriores não limpavam UMA linha em três mil jogadas.
   *
   * A primeira soltava a peça na coluna mais baixa: virou uma torre no centro
   * com as bordas vazias. A segunda varria as colunas em ordem: encheu o
   * tabuleiro por igual, mas cheio de buracos — peça S, Z, L e J deixam vazios
   * quando caem sem planejamento, e linha com buraco nunca fecha.
   *
   * Sem limpeza, a demonstração não mostra o efeito de eliminação, que é a
   * coisa mais bonita que ela tem para exibir. Então o piloto precisa jogar de
   * verdade: testar cada coluna e cada rotação, e escolher o encaixe que
   * fecha linha, não cria buraco e mantém a pilha baixa.
   *
   * É IA simbólica clássica — a mesma família de heurística que os bots de
   * Tetris usam. Nada de aprendizado: três números e uma soma ponderada.
   * ───────────────────────────────────────────────────────────────────────────
   */
  #jogarUmaPeca() {
    if (this.jogo.estado !== ESTADOS.JOGANDO || !this.jogo.peca) return;

    const melhor = this.#escolherJogada();
    if (!melhor) {
      this.jogo.hardDrop();
      return;
    }

    for (let i = 0; i < melhor.rotacoes; i++) this.jogo.girar(1);

    const passos = melhor.coluna - this.jogo.peca.coluna;
    for (let i = 0; i < Math.abs(passos); i++) {
      if (!this.jogo.mover(Math.sign(passos))) break;
    }

    this.jogo.hardDrop();

    // O modo Zen alivia a pilha sozinho quando ela estoura, então a
    // demonstração roda para sempre sem precisar de reinício.
  }

  /**
   * Testa todas as combinações de rotação e coluna, e devolve a melhor.
   * @returns {{rotacoes: number, coluna: number}|null}
   */
  #escolherJogada() {
    const grid = this.jogo.grid;
    let melhor = null;

    for (let rotacoes = 0; rotacoes < 4; rotacoes++) {
      // Peça de teste, girada, sem tocar na peça real do jogo.
      const molde = this.jogo.peca.clonar();
      for (let i = 0; i < rotacoes; i++) {
        const girada = tentarRotacionar(molde, 1, grid);
        if (!girada) break;
        molde.matriz = girada.peca.matriz;
        molde.rotacao = girada.peca.rotacao;
      }

      for (let coluna = -2; coluna < grid.colunas; coluna++) {
        const tentativa = molde.clonar();
        tentativa.coluna = coluna;
        tentativa.linha = 0;

        if (grid.colide(tentativa)) continue;

        // Deixa cair até encostar.
        for (;;) {
          const abaixo = tentativa.clonar();
          abaixo.linha += 1;
          if (grid.colide(abaixo)) break;
          tentativa.linha += 1;
        }

        const nota = this.#avaliar(tentativa);
        if (!melhor || nota > melhor.nota) melhor = { nota, rotacoes, coluna };
      }
    }

    return melhor;
  }

  /**
   * Nota de um encaixe, sem alterar o tabuleiro de verdade.
   *
   * Os pesos foram ajustados olhando a demonstração rodar: buraco pesa mais
   * que altura porque buraco é permanente, e linha fechada pesa mais que tudo
   * porque é o que a demonstração existe para mostrar.
   */
  #avaliar(peca) {
    const grid = this.jogo.grid;
    const celulas = peca.celulasOcupadas();

    // Cópia rasa do que interessa: quais células passariam a estar ocupadas.
    const ocupada = (linha, coluna) =>
      celulas.some((c) => c.linha === linha && c.coluna === coluna) ||
      (linha >= 0 && grid.celulas[linha]?.[coluna] !== null);

    let linhasFechadas = 0;
    let buracos = 0;
    let alturaMaxima = 0;

    for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
      let completa = true;
      for (let coluna = 0; coluna < grid.colunas; coluna++) {
        if (!ocupada(linha, coluna)) completa = false;
      }
      if (completa) linhasFechadas++;
    }

    for (let coluna = 0; coluna < grid.colunas; coluna++) {
      let achouBloco = false;
      for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
        if (ocupada(linha, coluna)) {
          if (!achouBloco) alturaMaxima = Math.max(alturaMaxima, grid.totalDeLinhas - linha);
          achouBloco = true;
        } else if (achouBloco) {
          buracos++;
        }
      }
    }

    return linhasFechadas * 12 - buracos * 5 - alturaMaxima * 0.7;
  }

  desenhar() {
    if (!this.canvas || !this.renderizador || !this.jogo) return;
    this.renderizador.desenhar({
      grid: this.jogo.grid,
      peca: this.jogo.peca,
      fantasma: null, // sombra numa demonstração só polui
    });
  }
}
