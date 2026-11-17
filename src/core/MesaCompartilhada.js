/**
 * MesaCompartilhada.js — dois jogadores, UM tabuleiro, duas peças caindo juntas.
 *
 * CAMADA: núcleo. Sem tela, sem teclado, sem controle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE ISTO NÃO REAPROVEITA O GameEngine
 *
 *  O motor é, por construção, "uma peça ativa, um tabuleiro". Toda a sua
 *  lógica de gravidade, travamento e nascimento parte daí. Enfiar uma segunda
 *  peça nele significaria reescrever esse miolo — justamente o código com 150
 *  testes em cima e o único que o modo de um jogador usa.
 *
 *  Então a mesa compartilhada é um conjunto de regras PRÓPRIO, construído
 *  sobre as mesmas peças de baixo: Grid, Tetromino, RotationSystem,
 *  BagRandomizer, ScoreSystem e ProfessorSystem. Nenhum deles precisou mudar,
 *  o que é a prova de que foram bem divididos.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * As regras que este modo precisou inventar, e que o motor não tem:
 *
 *   • uma peça é sólida para a outra;
 *   • as duas podem travar no mesmo quadro, e a ordem precisa ser decidida;
 *   • os dois jogam PELA MESMA pontuação;
 *   • quem não consegue fazer a peça nascer fica esperando, não morre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE É COOPERATIVO, E NÃO UM DUELO
 *
 *  Como duelo este modo durava pouco e premiava a coisa errada. Duas peças
 *  caem no mesmo tabuleiro, então a pilha sobe pelo dobro — e a partida
 *  terminava no instante em que UM dos dois não conseguia fazer a peça
 *  nascer. Na prática: um erro de qualquer um encerrava o jogo dos dois, em
 *  menos de um minuto, e atrapalhar o colega era a jogada mais eficiente.
 *
 *  No cooperativo as três coisas se invertem:
 *
 *    • a pontuação é UMA, da dupla, então ajudar o outro é pontuar;
 *    • quem não consegue nascer fica ESPERANDO, e volta assim que o colega
 *      abrir espaço — o que faz do resgate a jogada mais importante do modo;
 *    • o jogo só acaba quando os DOIS estão esperando ao mesmo tempo, que é
 *      quando ninguém pode mais mexer no tabuleiro.
 *
 *  O tabuleiro também é mais largo que o de um jogador, e o nível sobe a cada
 *  20 linhas em vez de 10. Os dois números saem do mesmo raciocínio: duas
 *  pessoas enchem e limpam na metade do tempo, então o espaço e o ritmo
 *  precisam acompanhar, ou o modo vira uma corrida de trinta segundos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Grid } from './Grid.js';
import { PecaAtiva } from './Tetromino.js';
import { tentarRotacionar } from './RotationSystem.js';
import { BagRandomizer } from './BagRandomizer.js';
import { ScoreSystem } from './ScoreSystem.js';
import { ProfessorSystem } from './ProfessorSystem.js';

/** Tempo que a peça encostada ainda aceita ajuste antes de travar. */
const ATRASO_DE_TRAVAMENTO_MS = 500;

/** Quantas vezes mover ou girar pode adiar o travamento. */
const MAXIMO_DE_ADIAMENTOS = 15;

/**
 * Largura do tabuleiro da dupla.
 *
 * Duas colunas a mais que o tabuleiro de um jogador. Não é enfeite: com duas
 * peças caindo ao mesmo tempo em 10 colunas, as duas disputam o mesmo buraco
 * e cada jogador tem, na prática, cinco colunas para trabalhar — menos do que
 * uma peça I precisa para ser útil. Com 12, cada um tem seis.
 */
const COLUNAS_DA_MESA = 12;

/**
 * Coluna onde a peça de cada jogador nasce.
 *
 * Separadas de propósito: nascer no mesmo lugar faria as duas peças brotarem
 * uma dentro da outra e os dois ficarem presos já no primeiro quadro.
 */
const COLUNA_DE_NASCIMENTO = [1, 7];

/** Linhas para subir de nível. O dobro do normal — ver o cabeçalho. */
const LINHAS_POR_NIVEL_COOP = 20;

export class MesaCompartilhada {
  /**
   * @param {Object} [opcoes]
   * @param {number} [opcoes.semente]
   * @param {boolean} [opcoes.comProfessores]
   * @param {number} [opcoes.nivelInicial]
   */
  constructor({ semente, comProfessores = true, nivelInicial = 1 } = {}) {
    this.semente = semente ?? Math.floor(Math.random() * 0xffffffff);
    this.comProfessores = comProfessores;
    this.nivelInicial = nivelInicial;

    this.grid = new Grid(COLUNAS_DA_MESA);

    /**
     * Um saco de peças só para os dois.
     *
     * Dois sacos separados dariam a cada um a sua garantia de variedade, e o
     * tabuleiro receberia o dobro de peças iguais em sequência. Com um saco
     * compartilhado, a mesa inteira continua obedecendo ao 7-bag.
     */
    this.sorteio = new BagRandomizer(this.semente);

    // O ProfessorSystem recebe uma FUNÇÃO de sorteio, não uma semente. Dando
    // a dele mesmo o gerador do saco de peças, o sorteio de professor também
    // fica determinístico pela semente da mesa.
    this.professores = new ProfessorSystem(() => this.sorteio.sortear());

    /** @type {Map<string, Function[]>} */
    this.ouvintes = new Map();

    /**
     * UMA pontuação para os dois.
     *
     * É o que faz o modo ser cooperativo de verdade e não só de nome: com
     * placares separados, deixar o colega fechar a linha era perder pontos,
     * e o jogo empurrava os dois a competir dentro de um tabuleiro que só
     * funciona se eles se ajudarem.
     */
    this.equipe = new ScoreSystem(this.nivelInicial, LINHAS_POR_NIVEL_COOP);

    this.pilotos = [0, 1].map((indice) => this.#criarPiloto(indice));

    this.rodando = false;
    this.encerrada = false;
  }

  #criarPiloto(indice) {
    return {
      indice,
      /** @type {PecaAtiva|null} */
      peca: null,
      tempoDeQueda: 0,
      tempoEncostada: 0,
      adiamentos: 0,
      pecaGuardada: null,
      reservaBloqueada: false,
      /**
       * Sem espaço para a peça nascer AGORA.
       *
       * Não é derrota: é uma pausa. A cada quadro a mesa tenta de novo, e
       * assim que o colega limpar uma linha este jogador volta sozinho.
       */
      esperando: false,
      /** Peça já sorteada que ainda não coube; volta na próxima tentativa. */
      tipoRetido: null,
      linhasFechadas: 0,
      poderesDisparados: 0,
    };
  }

  // ───────────────────────────── eventos ─────────────────────────────

  em(evento, ouvinte) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, []);
    this.ouvintes.get(evento).push(ouvinte);
    return this;
  }

  #emitir(evento, dados = {}) {
    for (const ouvinte of this.ouvintes.get(evento) ?? []) ouvinte(dados);
  }

  // ───────────────────────────── colisão ─────────────────────────────

  /**
   * A peça do outro jogador é sólida.
   *
   * É a regra que define este modo. Sem ela as duas peças se atravessam, e o
   * tabuleiro compartilhado vira dois jogos independentes desenhados por cima
   * um do outro.
   *
   * @param {PecaAtiva} peca
   * @param {number} indice  de quem é a peça que está tentando se mover
   */
  colide(peca, indice) {
    if (this.grid.colide(peca)) return true;

    const outro = this.pilotos[indice === 0 ? 1 : 0];
    if (!outro?.peca || outro.esperando) return false;

    const ocupadasPeloOutro = new Set(
      outro.peca.celulasOcupadas().map(({ linha, coluna }) => `${linha},${coluna}`),
    );

    return peca
      .celulasOcupadas()
      .some(({ linha, coluna }) => ocupadasPeloOutro.has(`${linha},${coluna}`));
  }

  /**
   * Um tabuleiro de mentira que enxerga também a peça do outro.
   *
   * O sistema de rotação só chama `colide` no que recebe. Entregando esta
   * visão no lugar do grid, os desvios de parede passam a desviar também da
   * peça do adversário — sem uma linha alterada em RotationSystem.js.
   */
  #visaoDe(indice) {
    return { colide: (peca) => this.colide(peca, indice) };
  }

  // ───────────────────────────── ciclo ─────────────────────────────

  iniciar() {
    this.rodando = true;
    this.encerrada = false;
    this.equipe.reiniciar();

    for (const piloto of this.pilotos) this.#nascerPeca(piloto);
    this.#emitir('iniciada', { semente: this.semente });
  }

  reiniciar({ semente } = {}) {
    this.semente = semente ?? Math.floor(Math.random() * 0xffffffff);
    this.grid.limpar();
    this.sorteio.reiniciar(this.semente);
    this.professores.reiniciar();

    this.equipe.reiniciar();
    this.pilotos = [0, 1].map((indice) => this.#criarPiloto(indice));
    this.rodando = false;
    this.encerrada = false;

    this.#emitir('reiniciada', { semente: this.semente });
  }

  /** Para o relógio sem perder o estado da mesa. */
  pausar() {
    if (this.encerrada) return;
    this.rodando = false;
    this.#emitir('pausada', {});
  }

  retomar() {
    if (this.encerrada) return;
    this.rodando = true;
    this.#emitir('retomada', {});
  }

  alternarPausa() {
    if (this.rodando) this.pausar();
    else this.retomar();
  }

  get pausada() {
    return !this.rodando && !this.encerrada;
  }

  /**
   * Avança o tempo dos dois.
   *
   * Os dois pilotos são percorridos na mesma ordem todo quadro. Isso importa:
   * quando as duas peças travam no mesmo instante, a ordem decide quem fecha
   * a linha primeiro, e uma ordem estável é o que torna o resultado
   * reproduzível — inclusive nos testes.
   *
   * @param {number} deltaMs
   */
  update(deltaMs) {
    if (!this.rodando || this.encerrada) return;

    for (const piloto of this.pilotos) {
      /*
       * Quem está esperando tenta nascer de novo, todo quadro.
       *
       * É aqui que o resgate acontece: o colega limpa uma linha, a área de
       * nascimento abre, e na próxima passagem este jogador volta ao jogo
       * sem precisar de nada além disso.
       */
      if (piloto.esperando) {
        this.#nascerPeca(piloto);
        if (this.encerrada) return;
        continue;
      }

      if (!piloto.peca) continue;
      this.#avancarPiloto(piloto, deltaMs);
      if (this.encerrada) return;
    }
  }

  #avancarPiloto(piloto, deltaMs) {
    const intervalo = this.equipe.intervaloDeQueda();

    piloto.tempoDeQueda += deltaMs;
    while (piloto.tempoDeQueda >= intervalo) {
      piloto.tempoDeQueda -= intervalo;
      this.#descerUmaLinha(piloto);
      if (!piloto.peca) return;
    }

    // Encostada: conta o tempo até travar.
    if (this.#estaApoiada(piloto)) {
      piloto.tempoEncostada += deltaMs;
      if (piloto.tempoEncostada >= ATRASO_DE_TRAVAMENTO_MS) this.#travar(piloto);
    } else {
      piloto.tempoEncostada = 0;
    }
  }

  #estaApoiada(piloto) {
    const abaixo = piloto.peca.clonar();
    abaixo.linha += 1;
    return this.colide(abaixo, piloto.indice);
  }

  #descerUmaLinha(piloto) {
    const abaixo = piloto.peca.clonar();
    abaixo.linha += 1;

    if (this.colide(abaixo, piloto.indice)) {
      if (piloto.tempoEncostada >= ATRASO_DE_TRAVAMENTO_MS) this.#travar(piloto);
      return false;
    }

    piloto.peca = abaixo;
    piloto.tempoEncostada = 0;
    return true;
  }

  // ───────────────────────────── comandos ─────────────────────────────

  mover(indice, direcao) {
    const piloto = this.#ativo(indice);
    if (!piloto) return false;

    const alvo = piloto.peca.clonar();
    alvo.coluna += direcao;
    if (this.colide(alvo, indice)) return false;

    piloto.peca = alvo;
    this.#adiarTravamento(piloto);
    return true;
  }

  girar(indice, sentido) {
    const piloto = this.#ativo(indice);
    if (!piloto) return false;

    const resultado = tentarRotacionar(piloto.peca, sentido, this.#visaoDe(indice));
    if (!resultado) return false;

    // A rotação devolve uma peça nova; a marca do professor viaja com ela.
    resultado.peca.professor = piloto.peca.professor;
    resultado.peca.posicaoDoProfessor = piloto.peca.posicaoDoProfessor;
    if (resultado.peca.professor) resultado.peca.girarMarca?.(sentido);

    piloto.peca = resultado.peca;
    this.#adiarTravamento(piloto);
    return true;
  }

  softDrop(indice) {
    const piloto = this.#ativo(indice);
    if (!piloto) return false;

    if (!this.#descerUmaLinha(piloto)) return false;
    this.equipe.registrarSoftDrop(1);
    return true;
  }

  hardDrop(indice) {
    const piloto = this.#ativo(indice);
    if (!piloto) return false;

    let distancia = 0;
    for (;;) {
      const abaixo = piloto.peca.clonar();
      abaixo.linha += 1;
      if (this.colide(abaixo, indice)) break;
      piloto.peca = abaixo;
      distancia++;
    }

    this.equipe.registrarHardDrop(distancia);
    this.#travar(piloto);
    return true;
  }

  guardar(indice) {
    const piloto = this.#ativo(indice);
    if (!piloto || piloto.reservaBloqueada) return false;

    const guardada = piloto.pecaGuardada;
    piloto.pecaGuardada = piloto.peca.tipo;

    this.#nascerPeca(piloto, guardada);
    piloto.reservaBloqueada = true;
    return true;
  }

  /** Posição onde a peça do jogador vai parar — a sombra. */
  fantasmaDe(indice) {
    const piloto = this.pilotos[indice];
    if (!piloto?.peca || piloto.esperando) return null;

    const sombra = piloto.peca.clonar();
    for (;;) {
      const abaixo = sombra.clonar();
      abaixo.linha += 1;
      if (this.colide(abaixo, indice)) break;
      sombra.linha += 1;
    }
    return sombra;
  }

  /**
   * Quanto da próxima célula a peça deste piloto já percorreu, de 0 a 1.
   *
   * Mesma ideia do `deslizeDaQueda` do motor de um jogador, e pelo mesmo
   * motivo: a física continua de célula em célula, só o desenho é contínuo.
   * Aqui cada piloto tem o próprio relógio, então cada peça tem o seu.
   */
  deslizeDe(indice) {
    const piloto = this.pilotos[indice];
    if (!this.rodando || this.encerrada) return 0;
    if (!piloto?.peca || piloto.esperando) return 0;

    const livres = this.fantasmaDe(indice).linha - piloto.peca.linha;
    if (livres <= 0) return 0;

    const intervalo = this.equipe.intervaloDeQueda();
    return Math.max(0, Math.min(piloto.tempoDeQueda / intervalo, livres, 1));
  }

  #ativo(indice) {
    if (!this.rodando || this.encerrada) return null;
    const piloto = this.pilotos[indice];
    if (!piloto || piloto.esperando || !piloto.peca) return null;
    return piloto;
  }

  #adiarTravamento(piloto) {
    if (piloto.adiamentos >= MAXIMO_DE_ADIAMENTOS) return;
    if (!this.#estaApoiada(piloto)) return;

    // Mover a peça encostada devolve tempo — mas só até certo ponto, senão o
    // jogador segura a peça para sempre girando no lugar.
    piloto.adiamentos++;
    piloto.tempoEncostada = 0;
  }

  // ───────────────────────────── travar e limpar ─────────────────────────────

  #travar(piloto) {
    if (!piloto.peca) return;

    const professoresFixados = this.grid.fixar(piloto.peca);
    piloto.peca = null;
    piloto.tempoEncostada = 0;
    piloto.adiamentos = 0;

    this.#emitir('pecaTravada', { jogador: piloto.indice });

    if (this.comProfessores) this.#resolverPoderes(piloto, professoresFixados);
    this.#limparLinhas(piloto);

    if (!this.encerrada) this.#nascerPeca(piloto);
  }

  #resolverPoderes(piloto, professoresFixados) {
    const relatorio = this.professores.resolverAoFixar(this.grid, professoresFixados);
    if (!relatorio) return;

    piloto.poderesDisparados++;
    this.equipe.registrarColunasPorPoder?.(relatorio.colunasAtingidas?.length ?? 0);

    // Uma linha esvaziada por poder não pode ficar flutuando no meio da pilha.
    this.grid.desmoronarLinhasVazias();

    this.#emitir('poderExecutado', { ...relatorio, jogador: piloto.indice });
  }

  /**
   * Limpa as linhas completas e credita a QUEM travou a peça.
   *
   * Num tabuleiro compartilhado, a linha quase sempre tem blocos dos dois.
   * Dividir os pontos pela origem de cada bloco seria mais "justo" e seria
   * pior: ninguém conseguiria prever quanto vale uma jogada. Creditar quem
   * fechou é a regra que o jogador consegue ter na cabeça enquanto joga.
   */
  #limparLinhas(piloto) {
    const completas = this.grid.linhasCompletas();
    if (completas.length === 0) return;

    /*
     * Fotografia dos blocos ANTES de removê-los — a mesma que o motor de um
     * jogador tira. Depois da remoção, a cor de cada bloco destruído já não
     * existe em lugar nenhum, e as partículas sairiam todas brancas.
     */
    const blocosEliminados = completas.map((linha) => ({
      linha,
      tipos: [...this.grid.celulas[linha]],
    }));

    this.grid.removerLinhas(completas);

    const ganho = this.equipe.registrarLimpeza(completas.length);
    piloto.linhasFechadas += completas.length;

    this.#emitir('linhasLimpas', {
      jogador: piloto.indice,
      quantidade: completas.length,
      linhas: completas,
      blocosEliminados,
      ...ganho,
    });
  }

  // ───────────────────────────── nascimento ─────────────────────────────

  #nascerPeca(piloto, tipoForcado = null) {
    /*
     * Quem está esperando guarda a peça que não coube e tenta a MESMA de novo.
     *
     * Sem isto, a retentativa a cada quadro puxaria uma peça nova do saco
     * sessenta vezes por segundo: em três segundos de espera a dupla teria
     * perdido quase 200 peças, o 7-bag deixaria de valer para quem continua
     * jogando, e a sequência pararia de ser reproduzível pela semente.
     */
    const tipo = tipoForcado ?? piloto.tipoRetido ?? this.sorteio.proxima();
    piloto.tipoRetido = null;
    const peca = new PecaAtiva(tipo, 0, COLUNA_DE_NASCIMENTO[piloto.indice]);

    /*
     * Não coube AGORA: este jogador fica esperando.
     *
     * Repare que a peça do colega conta como obstáculo aqui — dá para travar
     * o nascimento do outro sem querer, estacionando a peça em cima da área
     * dele. No cooperativo isso não elimina ninguém: é um aviso de que a
     * dupla precisa abrir espaço, e quem continua jogando tem como fazê-lo.
     */
    if (this.colide(peca, piloto.indice)) {
      const jaEstava = piloto.esperando;
      piloto.peca = null;
      piloto.esperando = true;
      piloto.tipoRetido = tipo;
      if (!jaEstava) this.#emitir('jogadorEsperando', { jogador: piloto.indice });
      this.#verificarFim();
      return;
    }

    if (piloto.esperando) {
      piloto.esperando = false;
      this.#emitir('jogadorVoltou', { jogador: piloto.indice });
    }

    /*
     * A marca de professor é sorteada DEPOIS de saber que a peça coube.
     *
     * Antes ela vinha primeiro, e cada tentativa frustrada de nascer gastava
     * um sorteio: com a retentativa por quadro isso giraria o gerador sem
     * parar e quebraria a reprodução da partida pela semente — o saco de
     * peças e o sorteio de professor compartilham o mesmo gerador.
     */
    if (this.comProfessores) {
      const professor = this.professores.prepararPeca(peca);
      if (professor) {
        this.#emitir('professorNaPeca', { jogador: piloto.indice, tipo, professor });
      }
    }

    piloto.peca = peca;
    piloto.tempoDeQueda = 0;
    piloto.tempoEncostada = 0;
    piloto.adiamentos = 0;
    piloto.reservaBloqueada = false;

    this.#emitir('novaPeca', { jogador: piloto.indice, tipo });
  }

  /**
   * O jogo acaba quando os DOIS estão esperando.
   *
   * Enquanto um só estiver jogando ainda há saída: ele pode limpar a linha
   * que devolve o colega ao tabuleiro. Com os dois parados ninguém mais põe
   * uma peça, logo nada no tabuleiro pode mudar — aí sim acabou.
   */
  #verificarFim() {
    if (this.encerrada) return;
    if (this.pilotos.some((p) => !p.esperando)) return;

    this.encerrada = true;
    this.rodando = false;

    this.#emitir('fimDaMesa', {
      pontos: this.equipe.pontos,
      linhas: this.equipe.linhas,
      nivel: this.equipe.nivel,
      placar: this.placar(),
    });
  }

  // ───────────────────────────── consultas ─────────────────────────────

  /** Altura da pilha, de 0 a 1 — alimenta a barra de risco na tela. */
  ocupacao() {
    const alturas = this.grid.alturasPorColuna();
    return Math.max(...alturas, 0) / this.grid.linhasVisiveis;
  }

  /**
   * Os pontos e o nível são da DUPLA e vêm repetidos nos dois,
   * porque a tela mostra uma ficha por jogador. O que de fato separa um do
   * outro é `linhas`: quantas cada um fechou, a contribuição de cada um.
   */
  placar() {
    return this.pilotos.map((piloto) => ({
      jogador: piloto.indice,
      pontos: this.equipe.pontos,
      linhas: piloto.linhasFechadas,
      nivel: this.equipe.nivel,
      poderes: piloto.poderesDisparados,
      esperando: piloto.esperando,
      reserva: piloto.pecaGuardada,
    }));
  }

  filaDePecas(quantidade = 3) {
    return this.sorteio.espiar(quantidade);
  }
}
