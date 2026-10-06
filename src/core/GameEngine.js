/**
 * GameEngine.js — Motor do jogo: estados, gravidade e ações do jogador.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Ponto mais importante do projeto: este arquivo NÃO conhece navegador.
 * Não existe document, window, canvas, requestAnimationFrame ou cor aqui dentro.
 * O tempo entra por um único lugar — update(deltaMs) — e quem chama pode ser o
 * laço de animação do navegador ou um teste automatizado rodando no Node.
 *
 * Para conversar com o mundo externo (som, tela, placar) o motor apenas EMITE
 * eventos. Quem quiser ouvir se inscreve. O motor nunca chama a interface.
 */

import { PecaAtiva } from './Tetromino.js';
import { Grid } from './Grid.js';
import { tentarRotacionar } from './RotationSystem.js';
import { BagRandomizer } from './BagRandomizer.js';
import { ScoreSystem } from './ScoreSystem.js';
import { StatsCollector } from './StatsCollector.js';
import { obterModo, verificarTermino, LINHAS_DE_ALIVIO_ZEN, MODO_PADRAO } from './GameModes.js';
import { ProfessorSystem } from './ProfessorSystem.js';
import { EfeitosAtivos } from './EfeitosAtivos.js';

/** Estados possíveis da partida. */
export const ESTADOS = {
  MENU: 'menu',
  JOGANDO: 'jogando',
  PAUSADO: 'pausado',
  FIM_DE_JOGO: 'fim_de_jogo',
};

/** Tempo que a peça encostada ainda aceita ajustes antes de travar. */
const LOCK_DELAY_MS = 500;

/**
 * Quantas vezes mover ou girar pode adiar o travamento da peça.
 * Sem esse limite, girar sem parar mantém a peça viva para sempre.
 */
const MAX_RESETS_DE_LOCK = 15;

/** De quanto em quanto tempo guardamos uma amostra para os gráficos. */
const INTERVALO_DE_AMOSTRAGEM_MS = 1000;

/** Quantas peças futuras ficam visíveis no painel lateral. */
const PECAS_VISIVEIS_NA_FILA = 3;

export class GameEngine {
  /**
   * @param {Object} [opcoes]
   * @param {string} [opcoes.modo]      id do modo de jogo
   * @param {number} [opcoes.semente]   semente do sorteio (torna a partida reproduzível)
   * @param {number} [opcoes.nivelInicial]
   */
  constructor({ modo = MODO_PADRAO, semente, nivelInicial = 1 } = {}) {
    this.grid = new Grid();
    this.pontuacao = new ScoreSystem(nivelInicial);
    this.estatisticas = new StatsCollector();
    this.sorteio = new BagRandomizer(semente);
    this.modo = obterModo(modo);

    // O sistema de professores usa o MESMO gerador com semente do sorteio de
    // peças. É o que mantém o modo determinístico: mesma semente, mesma
    // sequência de professores — e portanto testes confiáveis.
    this.professores = new ProfessorSystem(() => this.sorteio.sortear());
    this.efeitos = new EfeitosAtivos();

    /** @type {Map<string, Function[]>} */
    this._ouvintes = new Map();

    this.reiniciar({ modo, semente: this.sorteio.semente, nivelInicial });
  }

  // ───────────────────────────── Eventos ─────────────────────────────

  /**
   * Inscreve um ouvinte. É assim que som, tela e placar reagem ao jogo
   * sem que o motor precise conhecê-los.
   * @param {string} evento
   * @param {Function} ouvinte
   * @returns {Function} função que cancela a inscrição
   */
  em(evento, ouvinte) {
    if (!this._ouvintes.has(evento)) this._ouvintes.set(evento, []);
    this._ouvintes.get(evento).push(ouvinte);
    return () => {
      const lista = this._ouvintes.get(evento) ?? [];
      const posicao = lista.indexOf(ouvinte);
      if (posicao >= 0) lista.splice(posicao, 1);
    };
  }

  #emitir(evento, dados = {}) {
    for (const ouvinte of this._ouvintes.get(evento) ?? []) ouvinte(dados);
  }

  // ─────────────────────────── Ciclo de vida ───────────────────────────

  /** Zera tudo e prepara uma partida nova. */
  reiniciar({ modo = this.modo.id, semente, nivelInicial = this.pontuacao.nivelInicial } = {}) {
    this.modo = obterModo(modo);
    this.grid.limpar();
    this.pontuacao.nivelInicial = nivelInicial;
    this.pontuacao.reiniciar();
    this.estatisticas.reiniciar();
    this.sorteio.reiniciar(semente);
    this.professores.reiniciar();
    this.efeitos.limpar();

    this.estado = ESTADOS.MENU;
    this.tempoDecorridoMs = 0;
    this.acumuladorDeQueda = 0;
    this.acumuladorDeAmostra = 0;
    this.tempoEncostada = 0;
    this.resetsDeLock = 0;

    /** @type {PecaAtiva|null} */
    this.peca = null;
    /** @type {string|null} tipo da peça guardada na reserva */
    this.pecaGuardada = null;

    /**
     * O que a peça guardada carregava, no modo Professores.
     *
     * Sem isto, guardar uma peça marcada e recuperá-la depois devolvia uma peça
     * limpa: o professor sumia. Como o jogador usa a reserva justamente para
     * segurar um professor até a hora certa, era perder o recurso guardado.
     *
     * @type {{professor: string, posicao: {linha: number, coluna: number}}|null}
     */
    this.marcaGuardada = null;
    /** A reserva só pode ser usada uma vez por peça, senão vira troca infinita. */
    this.reservaBloqueada = false;
    this.motivoDoFim = null;

    this.#emitir('reiniciado', { modo: this.modo });
  }

  /** Sai do menu e começa a valer. */
  iniciar() {
    if (this.estado === ESTADOS.JOGANDO) return;
    this.estado = ESTADOS.JOGANDO;
    if (!this.peca) this.#gerarProximaPeca();
    this.#emitir('iniciado', { modo: this.modo });
  }

  pausar() {
    if (this.estado !== ESTADOS.JOGANDO) return;
    this.estado = ESTADOS.PAUSADO;
    this.#emitir('pausado');
  }

  retomar() {
    if (this.estado !== ESTADOS.PAUSADO) return;
    this.estado = ESTADOS.JOGANDO;
    this.#emitir('retomado');
  }

  alternarPausa() {
    if (this.estado === ESTADOS.JOGANDO) this.pausar();
    else if (this.estado === ESTADOS.PAUSADO) this.retomar();
  }

  // ─────────────────────────── Passagem do tempo ───────────────────────────

  /**
   * Avança o jogo. ESTA É A ÚNICA PORTA DE ENTRADA DO TEMPO.
   * @param {number} deltaMs  milissegundos desde a última chamada
   */
  update(deltaMs) {
    if (this.estado !== ESTADOS.JOGANDO) return;

    this.tempoDecorridoMs += deltaMs;
    this.estatisticas.tempoDecorridoMs = this.tempoDecorridoMs;

    this.#aplicarGravidade(deltaMs);
    this.#atualizarTravamento(deltaMs);
    this.#amostrarEstatisticas(deltaMs);
    this.#verificarTerminoDoModo();
  }

  #aplicarGravidade(deltaMs) {
    // O multiplicador vem dos efeitos ativos: sem nenhum, vale 1 e a velocidade
    // é a normal; com a lentidão do Professor E, o intervalo estica.
    const intervalo = this.pontuacao.intervaloDeQueda(this.efeitos.multiplicadorDeQueda());
    this.acumuladorDeQueda += deltaMs;

    // Laço em vez de condição simples: se um quadro demorar muito (aba em segundo
    // plano, máquina lenta), a peça desce todos os passos devidos em vez de engasgar.
    while (this.acumuladorDeQueda >= intervalo && this.estado === ESTADOS.JOGANDO) {
      this.acumuladorDeQueda -= intervalo;
      this.#descerUmPasso();
    }
  }

  /** Desce a peça uma célula. Se não couber, ela passa a contar o tempo de travamento. */
  #descerUmPasso() {
    if (!this.peca) return false;
    const tentativa = this.peca.clonar();
    tentativa.linha += 1;

    if (this.grid.colide(tentativa)) return false;

    this.peca = tentativa;
    this.tempoEncostada = 0;
    return true;
  }

  /** A peça está apoiada em alguma coisa? */
  #estaApoiada() {
    if (!this.peca) return false;
    const abaixo = this.peca.clonar();
    abaixo.linha += 1;
    return this.grid.colide(abaixo);
  }

  #atualizarTravamento(deltaMs) {
    if (!this.peca) return;

    if (this.#estaApoiada()) {
      this.tempoEncostada += deltaMs;
      if (this.tempoEncostada >= LOCK_DELAY_MS) this.#fixarPeca();
    } else {
      this.tempoEncostada = 0;
      this.resetsDeLock = 0;
    }
  }

  /** Mover ou girar com sucesso dá mais um instante de sobrevida à peça apoiada. */
  #adiarTravamento() {
    if (this.#estaApoiada() && this.resetsDeLock < MAX_RESETS_DE_LOCK) {
      this.tempoEncostada = 0;
      this.resetsDeLock++;
    }
  }

  #amostrarEstatisticas(deltaMs) {
    this.acumuladorDeAmostra += deltaMs;
    if (this.acumuladorDeAmostra >= INTERVALO_DE_AMOSTRAGEM_MS) {
      this.acumuladorDeAmostra = 0;
      this.estatisticas.amostrar(
        this.tempoDecorridoMs,
        this.pontuacao.pontos,
        this.pontuacao.linhas,
        this.grid,
      );
    }
  }

  #verificarTerminoDoModo() {
    const { terminou, motivo } = verificarTermino(this.modo, {
      linhas: this.pontuacao.linhas,
      tempoDecorridoMs: this.tempoDecorridoMs,
      transbordou: this.grid.transbordou(),
    });
    if (terminou) this.#encerrar(motivo);
  }

  // ─────────────────────────── Peças ───────────────────────────

  /** Traz a próxima peça da fila para o topo do tabuleiro. */
  /**
   * @param {string|null} [tipoForcado]   usado ao recuperar da reserva
   * @param {{professor: string, posicao: object}|null} [marcaForcada]
   *        marca que veio da reserva; quando presente, o sorteio é pulado —
   *        a peça volta exatamente como o jogador a guardou.
   */
  #gerarProximaPeca(tipoForcado = null, marcaForcada = null) {
    const tipo = tipoForcado ?? this.sorteio.proxima();
    const peca = new PecaAtiva(tipo, 0, 0);
    peca.coluna = Math.floor((this.grid.colunas - peca.matriz.length) / 2);

    if (marcaForcada) {
      peca.professor = marcaForcada.professor;
      peca.posicaoDoProfessor = { ...marcaForcada.posicao };
      this.#emitir('professorNaPeca', { tipo, professor: marcaForcada.professor, daReserva: true });
    } else if (this.modo.comProfessores) {
      // Só no modo Professores uma peça pode nascer marcada. Nos demais modos o
      // sorteio nem é consultado, e a sequência de peças fica idêntica à de antes.
      const professor = this.professores.prepararPeca(peca);
      if (professor) this.#emitir('professorNaPeca', { tipo, professor });
    }

    this.peca = peca;
    this.tempoEncostada = 0;
    this.resetsDeLock = 0;
    this.reservaBloqueada = false;

    // Não há espaço nem para a peça nascer.
    if (this.grid.colide(peca)) {
      if (this.modo.terminaAoTransbordar) {
        this.#encerrar('transbordo');
        return;
      }
      this.#aliviarPilha();
    }

    this.#emitir('novaPeca', { tipo, fila: this.filaDePecas() });
  }

  /** Fixa a peça, resolve poderes, limpa linhas, pontua e chama a próxima. */
  #fixarPeca() {
    if (!this.peca) return;
    const tipo = this.peca.tipo;

    // `fixar` devolve onde os professores desta peça pararam.
    const professoresFixados = this.grid.fixar(this.peca);
    this.estatisticas.registrarPecaFixada(tipo, this.grid);
    this.#emitir('pecaFixada', { tipo });

    // Efeitos com duração contam peças, não segundos.
    for (const expirado of this.efeitos.consumirUmaPeca()) {
      this.#emitir('efeitoTerminou', expirado);
    }

    // 1. Encontro entre professores — antes da limpeza de linhas, porque o
    //    poder pode justamente COMPLETAR as linhas que serão limpas em seguida.
    if (this.modo.comProfessores) {
      this.#resolverPoderes(professoresFixados);
    }

    // 2. Limpeza de linhas, já considerando o que o poder deixou no tabuleiro.
    this.#limparLinhasCompletas();

    this.peca = null;
    this.#verificarTerminoDoModo();
    if (this.estado === ESTADOS.JOGANDO) this.#gerarProximaPeca();
  }

  /**
   * Resolve a combinação de professores gerada por esta peça.
   *
   * Roda UMA vez por peça: um poder não dispara outro. Sem esse limite, uma
   * explosão que remove blocos de professor poderia encadear indefinidamente.
   */
  #resolverPoderes(professoresFixados) {
    const relatorio = this.professores.resolverAoFixar(this.grid, professoresFixados);
    if (!relatorio) return;

    if (relatorio.colunasAtingidas.length > 0) {
      this.pontuacao.registrarColunasPorPoder(relatorio.colunasAtingidas.length);
    }

    // Linha que o poder esvaziou por completo desmorona, e o resto desce — a
    // mesma regra de uma limpeza normal. Sem isto, a pilha ficava flutuando
    // sobre a faixa vazia e o tabuleiro parecia quebrado.
    const desmoronaram = this.grid.desmoronarLinhasVazias();
    if (desmoronaram.length > 0) relatorio.linhasDesmoronadas = desmoronaram;

    if (relatorio.efeito) {
      this.efeitos.registrar(relatorio.efeito);
      this.#emitir('efeitoIniciado', relatorio.efeito);
    }

    this.#emitir('poderExecutado', relatorio);
  }

  /** Limpa as linhas completas e pontua, distinguindo o que veio de poder. */
  #limparLinhasCompletas() {
    const completas = this.grid.linhasCompletas();

    if (completas.length === 0) {
      this.pontuacao.registrarLimpeza(0);
      return;
    }

    const nivelAntes = this.pontuacao.nivel;

    // Professor levado por uma linha completada age sozinho, em versão reduzida.
    // Precisa acontecer ANTES da remoção: depois, quem estava ali já se perdeu.
    let relatoriosIndividuais = [];
    if (this.modo.comProfessores) {
      relatoriosIndividuais = this.professores.resolverAoLimparLinhas(this.grid, completas);

      for (const relatorio of relatoriosIndividuais) {
        if (relatorio.efeito) {
          this.efeitos.registrar(relatorio.efeito);
          this.#emitir('efeitoIniciado', relatorio.efeito);
        }
        this.#emitir('poderExecutado', relatorio);
      }

      // Mesma regra dos poderes por combinação: linha esvaziada desmorona.
      if (relatoriosIndividuais.length > 0) this.grid.desmoronarLinhasVazias();
    }

    // O poder individual pode ter desfeito alguma das linhas (uma explosão que
    // apagou blocos de uma linha vizinha), então reconferimos antes de remover.
    const aindaCompletas = this.grid.linhasCompletas().filter((l) => completas.includes(l));
    if (aindaCompletas.length === 0) return;

    // Fotografia dos blocos ANTES de removê-los. A camada de renderização usa
    // isto para as partículas saírem com a cor de cada bloco destruído; depois
    // da remoção essa informação já não existe em lugar nenhum.
    const blocosEliminados = aindaCompletas.map((linha) => ({
      linha,
      tipos: [...this.grid.celulas[linha]],
    }));

    this.grid.removerLinhas(aindaCompletas);
    const ganho = this.pontuacao.registrarLimpeza(aindaCompletas.length);

    this.#emitir('linhasLimpas', {
      quantidade: aindaCompletas.length,
      linhas: aindaCompletas,
      blocosEliminados,
      ...ganho,
    });

    if (this.pontuacao.nivel > nivelAntes) {
      this.#emitir('nivelAcima', { nivel: this.pontuacao.nivel });
    }
  }

  /** Modo Zen: em vez de encerrar, derruba as linhas mais altas e a partida segue. */
  #aliviarPilha() {
    const ocupadas = [];
    for (let linha = 0; linha < this.grid.totalDeLinhas; linha++) {
      if (this.grid.celulas[linha].some((celula) => celula !== null)) ocupadas.push(linha);
      if (ocupadas.length >= LINHAS_DE_ALIVIO_ZEN) break;
    }
    this.grid.removerLinhas(ocupadas);
    this.#emitir('pilhaAliviada', { linhas: ocupadas.length });
  }

  #encerrar(motivo) {
    if (this.estado === ESTADOS.FIM_DE_JOGO) return;
    this.estado = ESTADOS.FIM_DE_JOGO;
    this.motivoDoFim = motivo;
    this.#emitir('fimDeJogo', this.resultado());
  }

  // ─────────────────────────── Ações do jogador ───────────────────────────

  /**
   * Move a peça na horizontal.
   * @param {-1|1} direcao  -1 = esquerda, 1 = direita
   */
  mover(direcao) {
    if (this.estado !== ESTADOS.JOGANDO || !this.peca) return false;

    const tentativa = this.peca.clonar();
    tentativa.coluna += direcao;
    if (this.grid.colide(tentativa)) return false;

    this.peca = tentativa;
    this.estatisticas.registrarAcao();
    this.#adiarTravamento();
    this.#emitir('movimento', { direcao });
    return true;
  }

  /**
   * Gira a peça aplicando o SRS.
   * @param {1|-1} sentido  1 = horário, -1 = anti-horário
   */
  girar(sentido) {
    if (this.estado !== ESTADOS.JOGANDO || !this.peca) return false;

    const resultado = tentarRotacionar(this.peca, sentido, this.grid);
    if (!resultado) return false;

    this.peca = resultado.peca;
    this.estatisticas.registrarAcao();
    this.#adiarTravamento();
    this.#emitir('rotacao', { sentido, chute: resultado.indiceDoChute });
    return true;
  }

  /** Descida voluntária de uma célula, valendo 1 ponto. */
  softDrop() {
    if (this.estado !== ESTADOS.JOGANDO || !this.peca) return false;
    if (!this.#descerUmPasso()) return false;

    this.pontuacao.registrarSoftDrop(1);
    this.estatisticas.registrarAcao();
    this.acumuladorDeQueda = 0;
    this.#emitir('softDrop');
    return true;
  }

  /** Joga a peça direto no fundo e trava na hora. */
  hardDrop() {
    if (this.estado !== ESTADOS.JOGANDO || !this.peca) return false;

    let distancia = 0;
    while (this.#descerUmPasso()) distancia++;

    this.pontuacao.registrarHardDrop(distancia);
    this.estatisticas.registrarAcao();
    this.#emitir('hardDrop', { distancia });
    this.#fixarPeca();
    return true;
  }

  /** Guarda a peça atual na reserva, trocando com o que já estiver lá. */
  guardar() {
    if (this.estado !== ESTADOS.JOGANDO || !this.peca || this.reservaBloqueada) return false;

    const tipoAtual = this.peca.tipo;
    const tipoGuardado = this.pecaGuardada;

    // A marca do professor entra e sai da reserva junto com a peça.
    const marcaAtual = this.peca.professor
      ? { professor: this.peca.professor, posicao: { ...this.peca.posicaoDoProfessor } }
      : null;
    const marcaRecuperada = this.marcaGuardada;

    this.pecaGuardada = tipoAtual;
    this.marcaGuardada = marcaAtual;

    this.#gerarProximaPeca(tipoGuardado, marcaRecuperada);
    // Trava a reserva DEPOIS de gerar, porque gerar peça libera a reserva.
    this.reservaBloqueada = true;

    this.estatisticas.registrarAcao();
    this.#emitir('reserva', {
      guardada: tipoAtual,
      recuperada: tipoGuardado,
      professorGuardado: marcaAtual?.professor ?? null,
      professorRecuperado: marcaRecuperada?.professor ?? null,
    });
    return true;
  }

  // ─────────────────────── Consultas para a interface ───────────────────────

  /**
   * Onde a peça cairia se fosse solta agora — a sombra que orienta o jogador.
   * @returns {PecaAtiva|null}
   */
  posicaoFantasma() {
    if (!this.peca) return null;
    const fantasma = this.peca.clonar();
    for (;;) {
      const abaixo = fantasma.clonar();
      abaixo.linha += 1;
      if (this.grid.colide(abaixo)) break;
      fantasma.linha += 1;
    }
    return fantasma;
  }

  /** Próximas peças da fila, sem consumi-las. */
  filaDePecas(quantidade = PECAS_VISIVEIS_NA_FILA) {
    return this.sorteio.espiar(quantidade);
  }

  /** Fotografia do resultado — vai para o ranking, os gráficos e a análise por IA. */
  resultado() {
    return {
      modo: this.modo.id,
      nomeDoModo: this.modo.nome,
      criterio: this.modo.criterio,
      motivoDoFim: this.motivoDoFim,
      pontos: this.pontuacao.pontos,
      linhas: this.pontuacao.linhas,
      nivel: this.pontuacao.nivel,
      limpezas: { ...this.pontuacao.limpezas },
      semente: this.sorteio.semente,
      estatisticas: this.estatisticas.resumo(this.pontuacao.linhas),
      serieTemporal: this.estatisticas.serieTemporal,
      // Só faz sentido no modo Professores; nos outros vem zerado e é ignorado.
      professores: this.modo.comProfessores ? this.professores.resumo() : null,
      dataISO: new Date().toISOString(),
    };
  }

  /** Efeitos valendo agora — o HUD mostra isso ao jogador. */
  efeitosAtivos() {
    return this.efeitos.listar();
  }
}
