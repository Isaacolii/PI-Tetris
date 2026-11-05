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
 *   • a linha limpa é de QUEM a fechou;
 *   • quem não consegue mais fazer a peça nascer está eliminado.
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
 * Coluna onde a peça de cada jogador nasce.
 *
 * Separadas de propósito: nascer no mesmo lugar faria as duas peças brotarem
 * uma dentro da outra e os dois jogadores serem eliminados no primeiro quadro.
 */
const COLUNA_DE_NASCIMENTO = [1, 5];

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

    this.grid = new Grid();

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

    this.pilotos = [0, 1].map((indice) => this.#criarPiloto(indice));

    this.rodando = false;
    this.encerrada = false;
    this.vencedor = null;
  }

  #criarPiloto(indice) {
    return {
      indice,
      /** @type {PecaAtiva|null} */
      peca: null,
      pontuacao: new ScoreSystem(this.nivelInicial),
      tempoDeQueda: 0,
      tempoEncostada: 0,
      adiamentos: 0,
      pecaGuardada: null,
      reservaBloqueada: false,
      eliminado: false,
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
    if (!outro?.peca || outro.eliminado) return false;

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
    this.vencedor = null;

    for (const piloto of this.pilotos) this.#nascerPeca(piloto);
    this.#emitir('iniciada', { semente: this.semente });
  }

  reiniciar({ semente } = {}) {
    this.semente = semente ?? Math.floor(Math.random() * 0xffffffff);
    this.grid.limpar();
    this.sorteio.reiniciar(this.semente);
    this.professores.reiniciar();

    this.pilotos = [0, 1].map((indice) => this.#criarPiloto(indice));
    this.rodando = false;
    this.encerrada = false;
    this.vencedor = null;

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
      if (piloto.eliminado || !piloto.peca) continue;
      this.#avancarPiloto(piloto, deltaMs);
      if (this.encerrada) return;
    }
  }

  #avancarPiloto(piloto, deltaMs) {
    const intervalo = piloto.pontuacao.intervaloDeQueda();

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
    piloto.pontuacao.registrarSoftDrop(1);
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

    piloto.pontuacao.registrarHardDrop(distancia);
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
    if (!piloto?.peca || piloto.eliminado) return null;

    const sombra = piloto.peca.clonar();
    for (;;) {
      const abaixo = sombra.clonar();
      abaixo.linha += 1;
      if (this.colide(abaixo, indice)) break;
      sombra.linha += 1;
    }
    return sombra;
  }

  #ativo(indice) {
    if (!this.rodando || this.encerrada) return null;
    const piloto = this.pilotos[indice];
    if (!piloto || piloto.eliminado || !piloto.peca) return null;
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
    piloto.pontuacao.registrarColunasPorPoder?.(relatorio.colunasAtingidas?.length ?? 0);

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

    const ganho = piloto.pontuacao.registrarLimpeza(completas.length);
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
    const tipo = tipoForcado ?? this.sorteio.proxima();
    const peca = new PecaAtiva(tipo, 0, COLUNA_DE_NASCIMENTO[piloto.indice]);

    if (this.comProfessores) {
      const professor = this.professores.prepararPeca(peca);
      if (professor) {
        this.#emitir('professorNaPeca', { jogador: piloto.indice, tipo, professor });
      }
    }

    /*
     * Não coube: este jogador está fora.
     *
     * Repare que a peça do OUTRO conta como obstáculo aqui. É possível ser
     * eliminado porque o adversário estacionou a peça dele em cima da sua
     * área de nascimento — e isso é jogada legítima neste modo, não defeito.
     */
    if (this.colide(peca, piloto.indice)) {
      piloto.peca = null;
      piloto.eliminado = true;
      this.#emitir('jogadorEliminado', { jogador: piloto.indice });
      this.#verificarFim();
      return;
    }

    piloto.peca = peca;
    piloto.tempoDeQueda = 0;
    piloto.tempoEncostada = 0;
    piloto.adiamentos = 0;
    piloto.reservaBloqueada = false;

    this.#emitir('novaPeca', { jogador: piloto.indice, tipo });
  }

  #verificarFim() {
    if (this.encerrada) return;

    const vivos = this.pilotos.filter((p) => !p.eliminado);
    if (vivos.length > 1) return;

    this.encerrada = true;
    this.rodando = false;
    this.vencedor = vivos[0]?.indice ?? null;

    this.#emitir('fimDaMesa', {
      vencedor: this.vencedor,
      placar: this.placar(),
    });
  }

  // ───────────────────────────── consultas ─────────────────────────────

  /** Altura da pilha, de 0 a 1 — alimenta a barra de risco na tela. */
  ocupacao() {
    const alturas = this.grid.alturasPorColuna();
    return Math.max(...alturas, 0) / this.grid.linhasVisiveis;
  }

  placar() {
    return this.pilotos.map((piloto) => ({
      jogador: piloto.indice,
      pontos: piloto.pontuacao.pontos,
      linhas: piloto.linhasFechadas,
      nivel: piloto.pontuacao.nivel,
      poderes: piloto.poderesDisparados,
      eliminado: piloto.eliminado,
      reserva: piloto.pecaGuardada,
    }));
  }

  filaDePecas(quantidade = 3) {
    return this.sorteio.espiar(quantidade);
  }
}
