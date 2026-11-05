/**
 * TelaVersus.js — a tela do duelo de dois jogadores.
 *
 * CAMADA: interface. É ela quem conhece canvas, teclado e controle; o
 * `core/Versus.js` que ela comanda não conhece nenhum dos três.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  DOIS TABULEIROS SAEM DE GRAÇA, E ISSO NÃO É SORTE
 *
 *  Esta tela cria dois CanvasRenderer e o duelo cria dois GameEngine. Nenhum
 *  dos quatro precisou ser alterado para conviver: o motor nunca soube que
 *  existe uma tela, e o renderizador nunca soube que existe um motor.
 *
 *  A tela inicial já provava isso com o tabuleiro que joga sozinho. O duelo é
 *  a mesma propriedade cobrada de novo, agora com entrada de verdade nos dois
 *  lados.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Versus } from '../core/Versus.js';
import { MesaCompartilhada } from '../core/MesaCompartilhada.js';
import { ESTADOS } from '../core/GameEngine.js';
import { EfeitoVisual } from '../render/EfeitoVisual.js';
import { SistemaDeParticulas } from '../render/Particulas.js';
import { criarMatriz } from '../core/Tetromino.js';
import {
  KeyboardInput,
  MAPA_JOGADOR_1,
  MAPA_JOGADOR_2,
  MAPA_COMPARTILHADO,
} from '../input/KeyboardInput.js';
import { GamepadInput } from '../input/GamepadInput.js';

/** Cor de cada jogador, para a plateia saber de quem é cada tabuleiro. */
const CORES_DO_JOGADOR = ['#5ad2f0', '#ffb74d'];

export class TelaVersus {
  /**
   * @param {Object} elementos  nós da página, já consultados pelo main.js
   * @param {Object} dependencias
   * @param {Function} dependencias.CanvasRenderer  o construtor, não a instância
   * @param {import('../render/SkinRegistry.js').SkinRegistry} dependencias.skins
   * @param {import('../render/BackgroundRenderer.js').BackgroundRenderer} dependencias.fundo
   * @param {import('../audio/AudioManager.js').AudioManager} [dependencias.audio]
   */
  constructor(elementos, { CanvasRenderer, skins, fundo, audio = null }) {
    this.el = elementos;
    this.skins = skins;
    this.audio = audio;
    this.rodando = false;

    this.duelo = null;

    this.renderizadores = [0, 1].map(
      (i) => new CanvasRenderer(this.el.canvas[i], skins, fundo),
    );

    this.entradas = [[], []];
    this.#montarEntradas();

    /*
     * Cada tabuleiro tem o SEU sistema de efeitos e o SEU de partículas.
     *
     * Um só, compartilhado, colocaria os estilhaços do jogador 1 em cima do
     * tabuleiro do jogador 2: as coordenadas das partículas são relativas ao
     * canvas em que foram criadas, e não existe nada nelas dizendo de qual.
     * Dois sistemas separados resolvem isso sem uma linha de conversão.
     */
    this.efeitos = [new EfeitoVisual(), new EfeitoVisual()];
    this.particulas = [new SistemaDeParticulas(), new SistemaDeParticulas()];

    /** Os mesmos dois, para o tabuleiro único do formato compartilhado. */
    this.efeitoDaMesa = new EfeitoVisual();
    this.particulasDaMesa = new SistemaDeParticulas();

    /*
     * Trocar o tipo de duelo reinicia a partida de propósito.
     *
     * Ligar "corrida pura" no meio do jogo deixaria lixo já enviado a caminho,
     * sem forma de cancelá-lo — o jogador apanharia por uma regra que acabou
     * de deixar de existir.
     */
    /*
     * O terceiro renderizador é o do tabuleiro compartilhado.
     *
     * Criar os três de uma vez custa quase nada e evita o caso em que trocar
     * de formato no meio da sessão tenta desenhar num canvas que ainda não
     * tem renderizador.
     */
    this.renderizadorDaMesa = new CanvasRenderer(this.el.canvasDaMesa, skins, fundo);

    /**
     * 'lado-a-lado' ou 'compartilhado'.
     *
     * Vem de quem abriu a tela, que por sua vez veio do cartão escolhido no
     * menu. Antes era uma lista suspensa aqui dentro, e trocar no meio da
     * sessão reiniciava a partida sem aviso — escolher o formato é escolher
     * o jogo, e isso pertence à tela inicial.
     */
    this.formato = 'lado-a-lado';

    this.el.corridaPura?.addEventListener('change', () => this.reiniciar());

    this.el.botaoRevanche?.addEventListener('click', () => this.reiniciar());
    this.el.botaoSair?.addEventListener('click', () => this.aoSair?.());

    /** @type {Function|null} chamado quando o jogador pede para voltar ao menu */
    this.aoSair = null;
  }

  // ───────────────────────────── entrada ─────────────────────────────

  #montarEntradas() {
    const mapas = [MAPA_JOGADOR_1, MAPA_JOGADOR_2];

    for (const indice of [0, 1]) {
      const responder = (comando) => this.#executar(indice, comando);

      // Teclado e controle entregam o MESMO nome de comando. Para daqui para
      // baixo, nada no jogo sabe de qual aparelho a jogada veio.
      this.entradas[indice].push(
        new KeyboardInput(responder, { mapa: mapas[indice] }),
        new GamepadInput(responder, { indice }),
      );
    }

    // Pausar e reiniciar valem para a partida, não para um jogador: ficam num
    // teclado à parte, para não ocupar tecla de ninguém.
    this.entradaCompartilhada = new KeyboardInput(
      (comando) => this.#executarCompartilhado(comando),
      { mapa: MAPA_COMPARTILHADO },
    );
  }

  #executar(indice, comando) {
    if (comando === 'pausa') {
      this.partida?.alternarPausa();
      this.#pintarAviso();
      return;
    }

    if (this.ehMesa) this.#executarNaMesa(indice, comando);
    else this.#executarNoDuelo(indice, comando);
  }

  /** Dois tabuleiros: cada comando vai ao motor daquele jogador. */
  #executarNoDuelo(indice, comando) {
    if (!this.duelo || this.duelo.encerrado) return;

    const jogo = this.duelo.jogadorDe(indice)?.jogo;
    if (!jogo || jogo.estado !== ESTADOS.JOGANDO) return;

    switch (comando) {
      case 'esquerda': jogo.mover(-1); break;
      case 'direita': jogo.mover(1); break;
      case 'softDrop': jogo.softDrop(); break;
      case 'hardDrop': jogo.hardDrop(); break;
      case 'girarHorario': jogo.girar(1); break;
      case 'girarAntiHorario': jogo.girar(-1); break;
      case 'guardar': jogo.guardar(); break;
      case 'alvo': this.duelo.alternarAlvo(indice); break;
      default: break;
    }
  }

  /**
   * Um tabuleiro: o comando leva o número do jogador junto.
   *
   * Não existe "mirar no adversário" aqui — os dois já estão no mesmo
   * tabuleiro, e todo poder atinge os dois por definição.
   */
  #executarNaMesa(indice, comando) {
    const mesa = this.mesa;
    if (!mesa || mesa.encerrada) return;

    switch (comando) {
      case 'esquerda': mesa.mover(indice, -1); break;
      case 'direita': mesa.mover(indice, 1); break;
      case 'softDrop': mesa.softDrop(indice); break;
      case 'hardDrop': mesa.hardDrop(indice); break;
      case 'girarHorario': mesa.girar(indice, 1); break;
      case 'girarAntiHorario': mesa.girar(indice, -1); break;
      case 'guardar': mesa.guardar(indice); break;
      default: break;
    }
  }

  get ehMesa() {
    return this.formato === 'compartilhado';
  }

  /** O objeto que está conduzindo a partida agora, seja qual for o formato. */
  get partida() {
    return this.ehMesa ? this.mesa : this.duelo;
  }

  #executarCompartilhado(comando) {
    if (!this.duelo) return;
    if (comando === 'pausa') { this.duelo.alternarPausa(); this.#pintarAviso(); }
    if (comando === 'reiniciar') this.reiniciar();
  }

  // ───────────────────────────── ciclo ─────────────────────────────

  /**
   * @param {Object} [opcoes]
   * @param {boolean} [opcoes.interferencia]  false = corrida pura
   */
  /**
   * @param {Object} [opcoes]
   * @param {'lado-a-lado'|'compartilhado'} [opcoes.formato]
   * @param {boolean} [opcoes.interferencia]
   */
  iniciar({ formato, interferencia } = {}) {
    if (formato) this.formato = formato;

    if (this.ehMesa) {
      this.duelo = null;
      this.mesa = new MesaCompartilhada({ comProfessores: true });
      this.#ligarEventosDaMesa();
    } else {
      this.mesa = null;
      const comInterferencia = interferencia ?? !this.el.corridaPura?.checked;
      this.duelo = new Versus({ modo: 'professores', interferencia: comInterferencia });
      this.#ligarEventosDoDuelo();
    }

    this.#mostrarFormato();

    this.rodando = true;
    this.el.secao.hidden = false;
    this.el.fim.hidden = true;

    for (const entradas of this.entradas) for (const e of entradas) e.ligar();
    this.entradaCompartilhada.ligar();

    for (const efeito of this.efeitos) efeito.limpar();
    for (const sistema of this.particulas) sistema.limpar();
    this.efeitoDaMesa.limpar();
    this.particulasDaMesa.limpar();

    this.partida.iniciar();
    this.redimensionar();
    this.#pintarPaineis();
    this.#pintarAviso();
  }

  /** Mostra os blocos do formato escolhido e esconde os do outro. */
  #mostrarFormato() {
    const mesa = this.ehMesa;

    for (const bloco of this.el.ladoAlado ?? []) if (bloco) bloco.hidden = mesa;
    if (this.el.meio) this.el.meio.hidden = mesa;
    if (this.el.mesa) this.el.mesa.hidden = !mesa;

    // "Corrida pura" é regra de dois tabuleiros: num só, não há para onde
    // mandar lixo. Esconder é mais honesto do que deixar um controle inerte.
    if (this.el.opcaoCorrida) this.el.opcaoCorrida.hidden = mesa;
    // A dica explica a corrida pura; sem a caixa, ela descreve regra que não
    // existe neste formato.
    if (this.el.dica) this.el.dica.hidden = mesa;
  }

  parar() {
    this.rodando = false;
    this.el.secao.hidden = true;

    for (const entradas of this.entradas) for (const e of entradas) e.desligar();
    this.entradaCompartilhada.desligar();
  }

  reiniciar() {
    if (!this.partida) return;

    if (this.ehMesa) this.mesa.reiniciar();
    else this.duelo.reiniciar({ interferencia: !this.el.corridaPura?.checked });

    this.partida.iniciar();
    this.el.fim.hidden = true;
    this.#pintarPaineis();
    this.#pintarAviso();
  }

  redimensionar() {
    if (this.ehMesa) {
      const grid = this.mesa?.grid;
      this.renderizadorDaMesa.redimensionar(grid?.colunas ?? 10, grid?.linhasVisiveis ?? 20);
    } else {
      for (const renderizador of this.renderizadores) {
        const grid = this.duelo?.jogadorDe(0)?.jogo.grid;
        renderizador.redimensionar(grid?.colunas ?? 10, grid?.linhasVisiveis ?? 20);
      }
    }
    this.desenhar();
  }

  /**
   * Avança o duelo e redesenha.
   * @param {number} deltaMs  o mesmo delta do laço principal
   */
  atualizar(deltaMs) {
    if (!this.rodando || !this.partida) return;

    // As entradas avançam ANTES do motor, pelo mesmo delta: é o que faz
    // segurar a seta andar no mesmo ritmo em que a peça cai.
    for (const entradas of this.entradas) for (const e of entradas) e.atualizar(deltaMs);
    this.entradaCompartilhada.atualizar(deltaMs);

    this.partida.update(deltaMs);

    /*
     * Efeitos e partículas avançam pelo delta CHEIO, sem passar pela
     * desaceleração do motor. É a mesma decisão do modo de um jogador:
     * fragmento parado no ar parece travamento, não câmera lenta.
     */
    for (const efeito of this.efeitos) efeito.atualizar(deltaMs);
    for (const sistema of this.particulas) sistema.atualizar(deltaMs);
    this.efeitoDaMesa.atualizar(deltaMs);
    this.particulasDaMesa.atualizar(deltaMs);

    this.#pintarPaineis();
    this.desenhar();
  }

  desenhar() {
    if (this.ehMesa) return this.#desenharMesa();
    if (!this.duelo) return;

    for (const indice of [0, 1]) {
      const jogo = this.duelo.jogadorDe(indice).jogo;
      this.renderizadores[indice].desenhar({
        grid: jogo.grid,
        peca: jogo.peca,
        fantasma: jogo.estado === ESTADOS.JOGANDO ? jogo.posicaoFantasma() : null,
        efeitos: this.efeitos[indice],
        particulas: this.particulas[indice],
      });
    }
  }

  /**
   * Um tabuleiro, duas peças.
   *
   * As duas vão juntas na mesma chamada: o renderizador desenha todas as
   * sombras antes de todas as peças, senão a sombra de um ficaria por cima
   * da peça do outro.
   */
  #desenharMesa() {
    if (!this.mesa) return;

    const vivas = this.mesa.pilotos.filter((p) => p.peca && !p.eliminado);

    this.renderizadorDaMesa.desenhar({
      grid: this.mesa.grid,
      pecas: vivas.map((p) => ({ peca: p.peca, contorno: CORES_DO_JOGADOR[p.indice] })),
      fantasmas: this.mesa.rodando ? vivas.map((p) => this.mesa.fantasmaDe(p.indice)) : [],
      efeitos: this.efeitoDaMesa,
      particulas: this.particulasDaMesa,
    });
  }

  // ───────────────────────────── eventos do duelo ─────────────────────────────

  /**
   * Explosão e estilhaços de um tabuleiro.
   *
   * @param {number} indice             qual tabuleiro
   * @param {Object} relatorio          saída do poder
   * @param {Object} renderizador       quem sabe converter célula em pixel
   * @param {Object} efeitos
   * @param {Object} particulas
   */
  #explodirPoder(relatorio, renderizador, efeitos, particulas, grid) {
    const visuais = (relatorio.professores ?? []).map((id) =>
      this.skins.visualDoProfessor(id),
    );
    efeitos.registrar(relatorio, visuais.length ? visuais : { cor: '#ffffff' });

    const corDoProfessor = visuais[0]?.cor ?? '#ffffff';
    for (const celula of (relatorio.celulas ?? []).slice(0, 60)) {
      const linhaVisivel = celula.linha - grid.linhasOcultas;
      if (linhaVisivel < 0) continue;

      const { x, y, tamanho } = renderizador.centroDaCelula(linhaVisivel, celula.coluna);
      // Cada bloco estoura na SUA cor, como no modo de um jogador.
      const cor = celula.tipo ? this.skins.corRepresentativa(celula.tipo) : corDoProfessor;

      particulas.estourarCelula({ x, y, tamanho, cor });
      particulas.explodirBloco({ x, y, tamanho, cor, quantidade: 11, forca: 1.9, brilho: 0.34 });
    }
    if ((relatorio.blocosRemovidos ?? 0) > 2) particulas.sacudir(11, 320);
  }

  /** Estilhaços de uma limpeza de linha, num tabuleiro. */
  #explodirLimpeza(quantidade, blocosEliminados, renderizador, particulas, grid) {
    if (!blocosEliminados?.length) return;

    const forca = 0.7 + quantidade * 0.3;
    const porBloco = quantidade >= 4 ? 6 : 5;
    let maisAlta = Infinity;
    let maisBaixa = -Infinity;

    for (const { linha, tipos } of blocosEliminados) {
      const linhaVisivel = linha - grid.linhasOcultas;
      if (linhaVisivel < 0) continue;
      maisAlta = Math.min(maisAlta, linhaVisivel);
      maisBaixa = Math.max(maisBaixa, linhaVisivel);

      tipos.forEach((tipo, coluna) => {
        if (!tipo) return;
        const { x, y, tamanho } = renderizador.centroDaCelula(linhaVisivel, coluna);
        const cor = this.skins.corRepresentativa(tipo);
        particulas.estourarCelula({ x, y, tamanho, cor });
        particulas.explodirBloco({ x, y, tamanho, cor, quantidade: porBloco, forca });
      });
    }

    // UMA faixa cobrindo todas as linhas, não uma por linha.
    if (maisAlta !== Infinity) {
      const topo = renderizador.centroDaCelula(maisAlta, 0);
      particulas.brilhoDeLinha({
        y: topo.y - topo.tamanho / 2,
        largura: renderizador.larguraDoTabuleiro,
        altura: (maisBaixa - maisAlta + 1) * topo.tamanho,
      });
    }

    particulas.sacudir(quantidade * quantidade * 0.9, 180 + quantidade * 45);
  }

  #ligarEventosDoDuelo() {
    // Cada motor anuncia o seu; o efeito vai para o tabuleiro certo.
    for (const indice of [0, 1]) {
      const jogo = this.duelo.jogadorDe(indice).jogo;

      jogo.em('poderExecutado', (relatorio) => {
        this.#explodirPoder(
          relatorio,
          this.renderizadores[indice],
          this.efeitos[indice],
          this.particulas[indice],
          jogo.grid,
        );
        this.#anunciar(indice, relatorio.nome);
      });

      jogo.em('linhasLimpas', ({ quantidade, blocosEliminados }) => {
        this.audio?.tocarLimpeza(quantidade);
        this.#explodirLimpeza(
          quantidade,
          blocosEliminados,
          this.renderizadores[indice],
          this.particulas[indice],
          jogo.grid,
        );
      });
    }

    this.duelo.em('lixoEnviado', ({ para, quantidade }) => {
      this.audio?.tocar('guardar');
      this.#piscar(para, quantidade);
    });

    this.duelo.em('fimDeDuelo', ({ vencedor, motivo }) => {
      this.audio?.tocar('fimDeJogo');
      this.#mostrarFim(vencedor, motivo);
    });
  }

  #ligarEventosDaMesa() {
    this.mesa.em('linhasLimpas', ({ quantidade, blocosEliminados }) => {
      this.audio?.tocarLimpeza(quantidade);
      this.#explodirLimpeza(
        quantidade,
        blocosEliminados,
        this.renderizadorDaMesa,
        this.particulasDaMesa,
        this.mesa.grid,
      );
    });

    this.mesa.em('poderExecutado', (relatorio) => {
      this.audio?.tocar('nivel');
      this.#explodirPoder(
        relatorio,
        this.renderizadorDaMesa,
        this.efeitoDaMesa,
        this.particulasDaMesa,
        this.mesa.grid,
      );
    });

    this.mesa.em('jogadorEliminado', ({ jogador }) => {
      this.audio?.tocar('fimDeJogo');
      this.#piscar(jogador, 'fora');
    });

    this.mesa.em('fimDaMesa', ({ vencedor }) => {
      const placar = this.mesa.placar();
      this.el.fimTitulo.textContent =
        vencedor === null ? 'Empate' : `Jogador ${vencedor + 1} venceu`;
      this.el.fimDetalhe.textContent =
        `O tabuleiro encheu · ${placar[0].pontos} a ${placar[1].pontos} pontos`;
      this.el.fim.hidden = false;
    });
  }

  /**
   * Nome da combinação, numa faixa sobre o tabuleiro de quem a fez.
   *
   * O anúncio grande do modo de um jogador não serve aqui: ele cobriria
   * metade de um tabuleiro que já é menor, e o adversário continua jogando.
   */
  #anunciar(indice, nome) {
    const faixa = this.el.combo?.[indice];
    if (!faixa || !nome) return;

    /*
     * Elemento e relógio SEPARADOS do aviso de lixo.
     *
     * Os dois acontecem no mesmo instante — o poder que explode é o mesmo
     * que manda lixo — e, dividindo o mesmo elemento, o segundo apagaria o
     * primeiro: o jogador veria "+3" e nunca o nome da combinação que fez.
     */
    faixa.textContent = nome;
    faixa.hidden = false;

    this._relogioDoCombo ??= [];
    clearTimeout(this._relogioDoCombo[indice]);
    this._relogioDoCombo[indice] = setTimeout(() => { faixa.hidden = true; }, 1400);
  }

  /** Marca visualmente o tabuleiro que vai receber lixo. */
  #piscar(indice, quantidade) {
    const caixa = this.el.tabuleiro[indice];
    if (!caixa) return;

    caixa.classList.remove('duelo__tabuleiro--atingido');
    void caixa.offsetWidth;
    caixa.classList.add('duelo__tabuleiro--atingido');

    const aviso = this.el.aviso[indice];
    if (aviso) {
      aviso.textContent = `+${quantidade}`;
      aviso.hidden = false;
      clearTimeout(this._relogioDoAviso?.[indice]);
      this._relogioDoAviso ??= [];
      this._relogioDoAviso[indice] = setTimeout(() => { aviso.hidden = true; }, 900);
    }
  }

  #mostrarFim(vencedor, motivo) {
    const placar = this.duelo.placar();
    this.el.fimTitulo.textContent = `Jogador ${vencedor + 1} venceu`;

    const perdedor = vencedor === 0 ? 1 : 0;
    const explicacao =
      motivo === 'afogou'
        ? `O jogador ${perdedor + 1} foi afogado pelo lixo`
        : `A pilha do jogador ${perdedor + 1} estourou`;

    this.el.fimDetalhe.textContent =
      `${explicacao} · ${placar[vencedor].linhas} linhas e ` +
      `${placar[vencedor].lixoEnviado} linhas enviadas`;

    this.el.fim.hidden = false;
  }

  #pintarAviso() {
    const pausado = this.ehMesa
      ? this.mesa?.pausada === true
      : this.duelo?.jogadorDe(0)?.jogo.estado === ESTADOS.PAUSADO;

    if (this.el.pausa) this.el.pausa.hidden = !pausado;
  }

  // ───────────────────────────── painéis ─────────────────────────────

  #pintarPaineis() {
    if (this.ehMesa) return this.#pintarPaineisDaMesa();
    if (!this.duelo) return;
    const placar = this.duelo.placar();

    for (const indice of [0, 1]) {
      const dados = placar[indice];
      const painel = this.el.painel[indice];
      if (!painel) continue;

      painel.pontos.textContent = dados.pontos.toLocaleString('pt-BR');
      painel.linhas.textContent = dados.linhas;

      // Lixo a caminho: o número mais importante da tela para quem está
      // jogando, porque é o que ele tem de cancelar antes de travar a peça.
      painel.lixo.textContent = dados.lixoPendente;
      painel.lixo.parentElement?.classList.toggle('duelo__lixo--urgente', dados.lixoPendente >= 4);

      const mirando = dados.alvo === 'adversario';
      painel.alvo.textContent = mirando ? 'No adversário' : 'Em mim';
      painel.alvo.classList.toggle('duelo__alvo--fora', mirando);

      this.#desenharProxima(indice);
    }

    this.#pintarPressao();
  }

  #pintarPaineisDaMesa() {
    if (!this.mesa) return;

    const placar = this.mesa.placar();
    for (const indice of [0, 1]) {
      const ficha = this.el.fichaDaMesa?.[indice];
      if (!ficha) continue;

      ficha.pontos.textContent = placar[indice].pontos.toLocaleString('pt-BR');
      ficha.linhas.textContent = placar[indice].linhas;
      ficha.caixa?.classList.toggle('duelo__ficha--fora', placar[indice].eliminado);
    }

    // A altura da pilha substitui a barra de pressão: num tabuleiro só não há
    // "quem está melhor", há "quanto falta para acabar".
    if (this.el.risco) {
      this.el.risco.style.width = `${Math.min(this.mesa.ocupacao() * 100, 100).toFixed(1)}%`;
    }
  }

  #desenharProxima(indice) {
    const tela = this.el.proxima[indice];
    if (!tela) return;

    /*
     * O canvas tem DOIS tamanhos: o da memória (width/height) e o da tela
     * (CSS). Quando divergem, o navegador estica o desenho — a peça saía
     * achatada. Igualar os dois é o conserto, e só quando muda, para não
     * limpar o canvas a cada quadro à toa.
     */
    const densidade = window.devicePixelRatio || 1;
    const largura = Math.round(tela.clientWidth * densidade);
    const altura = Math.round(tela.clientHeight * densidade);
    if (largura > 0 && (tela.width !== largura || tela.height !== altura)) {
      tela.width = largura;
      tela.height = altura;
    }

    const ctx = tela.getContext('2d');
    ctx.clearRect(0, 0, tela.width, tela.height);

    const [tipo] = this.duelo.jogadorDe(indice).jogo.filaDePecas(1);
    if (!tipo) return;

    this.renderizadores[indice].desenharPecaIsolada(
      ctx,
      tipo,
      tela.width,
      tela.height,
      criarMatriz(tipo),
    );
  }

  /**
   * A barra entre os tabuleiros.
   *
   * Existe para a plateia: quem não joga Tetris não sabe ler uma pilha, mas
   * entende na hora uma barra pendendo para um lado.
   */
  #pintarPressao() {
    const barra = this.el.pressao;
    if (!barra) return;

    const valor = this.duelo.pressao();           // -1 (jogador 2 ganhando) a +1
    const percentual = (0.5 + valor / 2) * 100;   // 50% = equilíbrio

    barra.style.setProperty('--vantagem', `${percentual.toFixed(1)}%`);
    barra.setAttribute(
      'aria-valuetext',
      valor > 0.1 ? 'Jogador 1 à frente' : valor < -0.1 ? 'Jogador 2 à frente' : 'Equilibrado',
    );
  }

  /** Cores dos dois jogadores — a interface usa para as bordas e rótulos. */
  static get cores() {
    return [...CORES_DO_JOGADOR];
  }
}
