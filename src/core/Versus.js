/**
 * Versus.js — a partida de dois jogadores.
 *
 * CAMADA: núcleo. Não conhece tela, teclado nem controle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE ISTO NÃO ENTROU DENTRO DO GameEngine
 *
 *  O motor sabe conduzir UMA partida e não precisa saber que existe outra.
 *  Quem conhece as duas é este arquivo: ele segura dois motores, escuta o que
 *  cada um anuncia e traduz em consequência para o outro.
 *
 *  O ganho é concreto: os 119 testes do modo de um jogador continuam valendo
 *  sem alteração, porque o caminho de um jogador só não mudou. E o duelo roda
 *  no terminal, sem navegador, como todo o resto do núcleo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GameEngine, ESTADOS } from './GameEngine.js';

/**
 * Quantas linhas de lixo cada limpeza envia ao adversário.
 *
 * É a tabela clássica do Tetris competitivo, e a razão dela é o incentivo:
 * quatro linhas de uma vez valem mais do que quatro limpezas de uma linha.
 * Sem essa diferença, ninguém arriscaria empilhar para fazer um Tetris.
 */
const LIXO_POR_LIMPEZA = { 1: 0, 2: 1, 3: 2, 4: 4 };

/** Linhas enviadas quando um poder de professor limpa linhas. */
const LIXO_POR_PODER = { 1: 1, 2: 2, 3: 3, 4: 4 };

export class Versus {
  /**
   * @param {Object} [opcoes]
   * @param {string} [opcoes.modo]          id do modo que os dois jogam
   * @param {number} [opcoes.semente]       mesma sequência de peças para os dois
   * @param {boolean} [opcoes.interferencia] false = corrida pura, sem lixo nem
   *                                         poder atravessando para o outro lado
   */
  constructor({ modo = 'professores', semente, interferencia = true } = {}) {
    this.modo = modo;
    this.interferencia = interferencia;

    /**
     * A MESMA semente para os dois.
     *
     * Sem isso um jogador recebe uma sequência mais fácil que o outro e a
     * partida deixa de medir habilidade. Com ela, os dois enfrentam
     * exatamente as mesmas peças na mesma ordem — a diferença é só o que
     * cada um faz com elas.
     */
    this.semente = semente ?? Math.floor(Math.random() * 0xffffffff);

    /** @type {Map<string, Function[]>} */
    this.ouvintes = new Map();

    this.jogadores = [0, 1].map((indice) => this.#criarJogador(indice));
    this.vencedor = null;
    this.encerrado = false;

    this.#ligarEventos();
  }

  // ───────────────────────────── eventos ─────────────────────────────

  /**
   * Escuta um acontecimento do duelo.
   * @param {string} evento
   * @param {Function} ouvinte
   */
  em(evento, ouvinte) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, []);
    this.ouvintes.get(evento).push(ouvinte);
    return this;
  }

  #emitir(evento, dados) {
    for (const ouvinte of this.ouvintes.get(evento) ?? []) ouvinte(dados);
  }

  // ───────────────────────────── montagem ─────────────────────────────

  #criarJogador(indice) {
    return {
      indice,
      jogo: new GameEngine({ modo: this.modo, semente: this.semente }),
      /**
       * Linhas de lixo esperando para entrar.
       *
       * O lixo NÃO cai no instante em que o adversário limpa: espera a próxima
       * peça travar. Isso dá ao jogador atingido a chance de responder — se
       * ele limpar antes, o lixo é cancelado. Despejar na hora transforma uma
       * boa jogada do adversário em morte sem defesa.
       */
      lixoPendente: 0,
      /** 'eu' ou 'adversario' — para onde vai o próximo poder de professor. */
      alvo: 'eu',
      lixoEnviado: 0,
      lixoRecebido: 0,
      lixoCancelado: 0,
    };
  }

  #ligarEventos() {
    for (const jogador of this.jogadores) {
      const outro = this.oponenteDe(jogador.indice);

      jogador.jogo.em('linhasLimpas', ({ quantidade }) => {
        this.#resolverLimpeza(jogador, outro, quantidade, LIXO_POR_LIMPEZA);
      });

      jogador.jogo.em('poderExecutado', (relatorio) => {
        // Poder que limpou linhas também pressiona o adversário.
        const linhas = relatorio.linhasAtingidas?.length ?? 0;
        if (linhas > 0) this.#resolverLimpeza(jogador, outro, linhas, LIXO_POR_PODER);

        // Depois de disparar, o alvo volta para o próprio tabuleiro: mirar no
        // adversário é uma decisão por jogada, não um estado que se esquece
        // ligado e some com a própria pilha sem o jogador perceber.
        this.definirAlvo(jogador.indice, 'eu');
      });

      /*
       * O lixo entra quando a PEÇA SEGUINTE NASCE, não quando a anterior trava.
       *
       * A ordem do motor é: trava a peça, resolve poderes, limpa linhas, chama
       * a próxima. Despejar em 'pecaFixada' colocava o lixo antes da limpeza
       * ser contada, e aí o abate nunca acontecia: o jogador apanhava mesmo
       * tendo acabado de fazer um Tetris. Em 'novaPeca' a limpeza já entrou na
       * conta e o cancelamento funciona.
       */
      jogador.jogo.em('novaPeca', () => this.#despejarLixo(jogador));

      jogador.jogo.em('fimDeJogo', () => this.#encerrar(outro.indice, 'estourou'));
    }
  }

  // ───────────────────────────── lixo ─────────────────────────────

  #resolverLimpeza(jogador, outro, quantidade, tabela) {
    if (!this.interferencia || this.encerrado) return;

    const bruto = tabela[Math.min(quantidade, 4)] ?? 0;
    if (bruto <= 0) return;

    /*
     * Cancelamento: o lixo que estava para cair em cima de você abate o que
     * você acabou de mandar. É o que permite revidar em vez de só apanhar, e
     * é o que faz a partida ter idas e vindas em vez de uma bola de neve.
     */
    const abatido = Math.min(jogador.lixoPendente, bruto);
    jogador.lixoPendente -= abatido;
    jogador.lixoCancelado += abatido;

    const enviado = bruto - abatido;
    if (enviado <= 0) {
      this.#emitir('lixoCancelado', { jogador: jogador.indice, quantidade: abatido });
      return;
    }

    outro.lixoPendente += enviado;
    jogador.lixoEnviado += enviado;

    this.#emitir('lixoEnviado', {
      de: jogador.indice,
      para: outro.indice,
      quantidade: enviado,
      cancelado: abatido,
      pendenteNoAlvo: outro.lixoPendente,
    });
  }

  #despejarLixo(jogador) {
    if (jogador.lixoPendente <= 0) return;

    const quantidade = jogador.lixoPendente;
    jogador.lixoPendente = 0;
    jogador.lixoRecebido += quantidade;

    // Um buraco só para todas as linhas da mesma leva: é o que permite
    // desfazê-las com uma peça I. Buraco diferente por linha seria impossível
    // de limpar e viraria sentença de morte.
    const coluna = Math.floor(Math.random() * jogador.jogo.grid.colunas);
    const entraram = jogador.jogo.grid.adicionarLinhasDeLixo(quantidade, coluna);

    this.#emitir('lixoRecebido', {
      jogador: jogador.indice,
      quantidade: entraram,
      coluna,
    });

    /*
     * Empurrar a pilha para cima pode, sozinho, acabar com a partida — de duas
     * formas. A pilha pode passar do topo, e a peça que acabou de nascer pode
     * ficar presa dentro do lixo que subiu por baixo dela. As duas contam.
     */
    const grid = jogador.jogo.grid;
    const pecaPresa = jogador.jogo.peca ? grid.colide(jogador.jogo.peca) : false;

    if (grid.transbordou() || pecaPresa) {
      this.#encerrar(this.oponenteDe(jogador.indice).indice, pecaPresa ? 'afogou' : 'transbordou');
    }
  }

  // ───────────────────────────── alvo do poder ─────────────────────────────

  /**
   * Escolhe onde o próximo poder de professor vai agir.
   *
   * @param {number} indice    qual jogador está escolhendo
   * @param {'eu'|'adversario'} alvo
   */
  definirAlvo(indice, alvo) {
    const jogador = this.jogadores[indice];
    if (!jogador) return;

    const permitido = this.interferencia ? alvo : 'eu';
    jogador.alvo = permitido;

    // O motor não sabe que existe um adversário: ele só recebe QUAL tabuleiro
    // os poderes devem usar. É um campo, não um caminho novo de código.
    jogador.jogo.gridParaPoderes =
      permitido === 'adversario' ? this.oponenteDe(indice).jogo.grid : jogador.jogo.grid;

    this.#emitir('alvoTrocado', { jogador: indice, alvo: permitido });
  }

  /** Alterna o alvo do jogador entre o próprio tabuleiro e o do adversário. */
  alternarAlvo(indice) {
    const atual = this.jogadores[indice]?.alvo ?? 'eu';
    this.definirAlvo(indice, atual === 'eu' ? 'adversario' : 'eu');
  }

  // ───────────────────────────── ciclo ─────────────────────────────

  iniciar() {
    this.vencedor = null;
    this.encerrado = false;
    for (const jogador of this.jogadores) jogador.jogo.iniciar();
    this.#emitir('iniciado', { semente: this.semente, modo: this.modo });
  }

  reiniciar({ modo = this.modo, semente, interferencia = this.interferencia } = {}) {
    this.modo = modo;
    this.interferencia = interferencia;
    this.semente = semente ?? Math.floor(Math.random() * 0xffffffff);
    this.vencedor = null;
    this.encerrado = false;

    for (const jogador of this.jogadores) {
      jogador.jogo.reiniciar({ modo, semente: this.semente });
      jogador.lixoPendente = 0;
      jogador.lixoEnviado = 0;
      jogador.lixoRecebido = 0;
      jogador.lixoCancelado = 0;
      this.definirAlvo(jogador.indice, 'eu');
    }

    this.#emitir('reiniciado', { semente: this.semente, modo });
  }

  /**
   * Avança os dois motores pelo MESMO delta.
   *
   * Um relógio só para os dois é o que garante que a gravidade corre igual
   * dos dois lados. Dois laços separados divergiriam com o tempo e um
   * jogador receberia peças mais rápidas que o outro.
   *
   * @param {number} deltaMs
   */
  update(deltaMs) {
    if (this.encerrado) return;
    for (const jogador of this.jogadores) jogador.jogo.update(deltaMs);
  }

  pausar() {
    for (const jogador of this.jogadores) jogador.jogo.pausar();
  }

  retomar() {
    for (const jogador of this.jogadores) jogador.jogo.retomar();
  }

  alternarPausa() {
    const algumRodando = this.jogadores.some((j) => j.jogo.estado === ESTADOS.JOGANDO);
    if (algumRodando) this.pausar();
    else this.retomar();
  }

  #encerrar(indiceVencedor, motivo) {
    if (this.encerrado) return;

    this.encerrado = true;
    this.vencedor = indiceVencedor;

    for (const jogador of this.jogadores) jogador.jogo.pausar();

    this.#emitir('fimDeDuelo', {
      vencedor: indiceVencedor,
      perdedor: this.oponenteDe(indiceVencedor).indice,
      motivo,
      placar: this.placar(),
    });
  }

  // ───────────────────────────── consultas ─────────────────────────────

  /** @param {number} indice */
  oponenteDe(indice) {
    return this.jogadores[indice === 0 ? 1 : 0];
  }

  /** @param {number} indice */
  jogadorDe(indice) {
    return this.jogadores[indice];
  }

  /**
   * Diferença de pressão entre os dois, de -1 (jogador 2 sufocando) a
   * +1 (jogador 1 sufocando). Alimenta a barra que a plateia lê sem saber
   * jogar Tetris.
   */
  pressao() {
    const altura = (jogador) => {
      const alturas = jogador.jogo.grid.alturasPorColuna();
      return Math.max(...alturas, 0) + jogador.lixoPendente;
    };

    const a = altura(this.jogadores[0]);
    const b = altura(this.jogadores[1]);
    if (a + b === 0) return 0;

    // Positivo quando o jogador 1 está melhor (pilha menor que a do outro).
    return (b - a) / Math.max(a, b, 1);
  }

  placar() {
    return this.jogadores.map((jogador) => ({
      jogador: jogador.indice,
      pontos: jogador.jogo.pontuacao.pontos,
      linhas: jogador.jogo.pontuacao.linhas,
      nivel: jogador.jogo.pontuacao.nivel,
      lixoEnviado: jogador.lixoEnviado,
      lixoRecebido: jogador.lixoRecebido,
      lixoCancelado: jogador.lixoCancelado,
      lixoPendente: jogador.lixoPendente,
      alvo: jogador.alvo,
      estado: jogador.jogo.estado,
    }));
  }
}
