/**
 * TouchInput.js — Controles de toque para celular e tablet.
 *
 * CAMADA: entrada.
 *
 * Emite exatamente os mesmos comandos do teclado ('esquerda', 'hardDrop', ...),
 * então o jogo não precisa saber se quem está jogando usa dedo ou tecla.
 *
 * Duas formas de jogar:
 *   1. Botões na tela — previsíveis, bons para quem não conhece o jogo.
 *   2. Gestos sobre o tabuleiro — arrastar move, deslizar para baixo derruba,
 *      toque simples gira.
 */

/** Distância mínima, em pixels, para um arrasto contar como movimento de uma coluna. */
const PIXELS_POR_COLUNA = 28;

/** Velocidade mínima (px/ms) de um deslize para baixo virar queda instantânea. */
const VELOCIDADE_DE_QUEDA = 0.7;

/** Acima disso, o toque deixa de ser considerado um toque simples (giro). */
const MOVIMENTO_MAXIMO_DE_TOQUE = 14;
const DURACAO_MAXIMA_DE_TOQUE_MS = 250;

export class TouchInput {
  /**
   * @param {(comando: string) => void} aoComando
   * @param {HTMLElement} areaDeGestos   normalmente o canvas do tabuleiro
   * @param {HTMLElement|null} painelDeBotoes
   */
  constructor(aoComando, areaDeGestos, painelDeBotoes = null) {
    this.aoComando = aoComando;
    this.areaDeGestos = areaDeGestos;
    this.painelDeBotoes = painelDeBotoes;
    this.ativo = false;

    this._toque = null;

    this._aoIniciar = this.#aoIniciar.bind(this);
    this._aoMover = this.#aoMover.bind(this);
    this._aoTerminar = this.#aoTerminar.bind(this);
    this._aoClicarBotao = this.#aoClicarBotao.bind(this);
  }

  /** Este aparelho tem tela sensível ao toque? */
  static disponivel() {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  ligar() {
    if (this.ativo) return;

    // `passive: false` é necessário para conseguir impedir a rolagem da página
    // enquanto o jogador arrasta a peça.
    this.areaDeGestos.addEventListener('touchstart', this._aoIniciar, { passive: false });
    this.areaDeGestos.addEventListener('touchmove', this._aoMover, { passive: false });
    this.areaDeGestos.addEventListener('touchend', this._aoTerminar, { passive: false });
    this.areaDeGestos.addEventListener('touchcancel', this._aoTerminar, { passive: false });

    this.painelDeBotoes?.addEventListener('pointerdown', this._aoClicarBotao);

    this.ativo = true;
  }

  desligar() {
    if (!this.ativo) return;
    this.areaDeGestos.removeEventListener('touchstart', this._aoIniciar);
    this.areaDeGestos.removeEventListener('touchmove', this._aoMover);
    this.areaDeGestos.removeEventListener('touchend', this._aoTerminar);
    this.areaDeGestos.removeEventListener('touchcancel', this._aoTerminar);
    this.painelDeBotoes?.removeEventListener('pointerdown', this._aoClicarBotao);
    this.ativo = false;
  }

  // ───────────────────────────── Botões na tela ─────────────────────────────

  /**
   * Um único ouvinte no painel inteiro cuida de todos os botões (delegação de
   * eventos). Botões novos passam a funcionar só por existirem no HTML com o
   * atributo data-comando.
   */
  #aoClicarBotao(evento) {
    const botao = evento.target.closest('[data-comando]');
    if (!botao) return;
    evento.preventDefault();
    this.aoComando(botao.dataset.comando);
  }

  // ───────────────────────────── Gestos ─────────────────────────────

  #aoIniciar(evento) {
    if (evento.touches.length !== 1) return;
    const toque = evento.touches[0];
    this._toque = {
      xInicial: toque.clientX,
      yInicial: toque.clientY,
      xAtual: toque.clientX,
      yAtual: toque.clientY,
      instanteInicial: performance.now(),
      colunasMovidas: 0,
      maiorDeslocamento: 0,
    };
  }

  #aoMover(evento) {
    if (!this._toque || evento.touches.length !== 1) return;
    evento.preventDefault();

    const toque = evento.touches[0];
    this._toque.xAtual = toque.clientX;
    this._toque.yAtual = toque.clientY;

    const deltaX = toque.clientX - this._toque.xInicial;
    const deltaY = toque.clientY - this._toque.yInicial;
    this._toque.maiorDeslocamento = Math.max(
      this._toque.maiorDeslocamento,
      Math.hypot(deltaX, deltaY),
    );

    // Movimento horizontal: converte a distância arrastada em colunas.
    const colunasDesejadas = Math.trunc(deltaX / PIXELS_POR_COLUNA);
    const diferenca = colunasDesejadas - this._toque.colunasMovidas;

    if (diferenca !== 0) {
      const comando = diferenca > 0 ? 'direita' : 'esquerda';
      for (let i = 0; i < Math.abs(diferenca); i++) this.aoComando(comando);
      this._toque.colunasMovidas = colunasDesejadas;
    }

    // Arrastar para baixo devagar equivale a segurar a seta para baixo.
    if (deltaY > PIXELS_POR_COLUNA && Math.abs(deltaX) < PIXELS_POR_COLUNA) {
      const velocidade = deltaY / Math.max(performance.now() - this._toque.instanteInicial, 1);
      if (velocidade < VELOCIDADE_DE_QUEDA) this.aoComando('softDrop');
    }
  }

  #aoTerminar(evento) {
    if (!this._toque) return;
    evento.preventDefault();

    const duracao = performance.now() - this._toque.instanteInicial;
    const deltaX = this._toque.xAtual - this._toque.xInicial;
    const deltaY = this._toque.yAtual - this._toque.yInicial;
    const velocidade = deltaY / Math.max(duracao, 1);

    const foiToqueSimples =
      this._toque.maiorDeslocamento < MOVIMENTO_MAXIMO_DE_TOQUE &&
      duracao < DURACAO_MAXIMA_DE_TOQUE_MS;

    const foiDeslizeParaBaixo =
      deltaY > PIXELS_POR_COLUNA * 2 &&
      velocidade >= VELOCIDADE_DE_QUEDA &&
      Math.abs(deltaY) > Math.abs(deltaX);

    if (foiToqueSimples) this.aoComando('girarHorario');
    else if (foiDeslizeParaBaixo) this.aoComando('hardDrop');

    this._toque = null;
  }

  /** Lista legível dos gestos — alimenta a tela de ajuda. */
  static descricaoDosGestos() {
    return [
      { acao: 'Mover', gesto: 'Arraste para os lados' },
      { acao: 'Descer', gesto: 'Arraste para baixo devagar' },
      { acao: 'Queda instantânea', gesto: 'Deslize rápido para baixo' },
      { acao: 'Girar', gesto: 'Toque no tabuleiro' },
      { acao: 'Demais ações', gesto: 'Botões abaixo do tabuleiro' },
    ];
  }
}
