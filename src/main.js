/**
 * main.js — Ponto de montagem da aplicação (composition root).
 *
 * CAMADA: composição.
 *
 * Este é o único arquivo do projeto que conhece TODAS as camadas ao mesmo tempo.
 * Ele cria cada peça e as conecta; nenhuma delas precisa conhecer as outras.
 *
 *   entrada (teclado/toque)  ──comandos──▶  GameEngine (lógica pura)
 *                                                │
 *                                                │ eventos
 *                                                ▼
 *                            áudio · renderização · interface · persistência
 *
 * O motor nunca chama a tela, e a tela nunca chama o motor: os dois se falam
 * por comandos e eventos, montados aqui.
 */

import { GameEngine, ESTADOS } from './core/GameEngine.js';
import { MODOS } from './core/GameModes.js';
import { PROFESSORES } from './core/Professores.js';

import { AssetLoader } from './render/AssetLoader.js';
import { SkinRegistry } from './render/SkinRegistry.js';
import { BackgroundRenderer } from './render/BackgroundRenderer.js';
import { CanvasRenderer } from './render/CanvasRenderer.js';
import { HudRenderer } from './render/HudRenderer.js';
import { EfeitoVisual } from './render/EfeitoVisual.js';
import { SistemaDeParticulas } from './render/Particulas.js';
import { AnuncioDeCombo } from './render/AnuncioDeCombo.js';

import { KeyboardInput } from './input/KeyboardInput.js';
import { TouchInput } from './input/TouchInput.js';
import { AudioManager } from './audio/AudioManager.js';

import { LocalStore } from './storage/LocalStore.js';
import { RankingStorage } from './storage/RankingStorage.js';
import { SkinStorage } from './storage/SkinStorage.js';
import { SettingsStorage } from './storage/SettingsStorage.js';
import { ProfileExport } from './storage/ProfileExport.js';

import { ligarPaineis, notificar } from './ui/Painel.js';
import { MenuScreen } from './ui/MenuScreen.js';
import { SkinGallery } from './ui/SkinGallery.js';
import { StatsPanel } from './ui/StatsPanel.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { montarRanking } from './ui/RankingPanel.js';
import { PainelDeProfessores } from './ui/PainelDeProfessores.js';
import { Vitrine } from './ui/Vitrine.js';
import { TelaVersus } from './ui/TelaVersus.js';

/**
 * Teto para o delta de tempo entre quadros.
 *
 * Quando a aba fica em segundo plano, o navegador para de desenhar; ao voltar,
 * o primeiro delta pode valer minutos. Sem este limite, o motor processaria
 * milhares de passos de queda de uma vez e a peça atravessaria o tabuleiro.
 */
const DELTA_MAXIMO_MS = 100;

/**
 * "Hitstop": o tempo do jogo desacelera quando um poder dispara.
 *
 * Sem essa pausa, a combinação acontece e desaparece no mesmo quadro — o
 * jogador vê o tabuleiro mudar sem entender o que aconteceu. Desacelerar dá
 * um instante para ler o anúncio e enxergar a explosão, e é o que faz o poder
 * parecer um acontecimento em vez de um efeito colateral.
 *
 * Não é pausa total: a 22% da velocidade o jogo continua correndo, então o
 * jogador nunca perde o controle da peça.
 */
const HITSTOP_DURACAO_MS = 620;
const HITSTOP_FATOR = 0.22;

function iniciar() {
  // ───────────────────── Elementos da página ─────────────────────

  const el = {
    telaInicial: document.getElementById('tela-inicial'),
    areaDeJogo: document.getElementById('area-de-jogo'),
    listaDeModos: document.getElementById('lista-de-modos'),
    listaDeDuelos: document.getElementById('lista-de-duelos'),
    nome: document.getElementById('entrada-nome'),

    canvas: document.getElementById('canvas-tabuleiro'),
    reserva: document.getElementById('canvas-reserva'),
    proximas: document.getElementById('proximas'),
    controlesToque: document.getElementById('controles-toque'),

    pontos: document.getElementById('hud-pontos'),
    linhas: document.getElementById('hud-linhas'),
    nivel: document.getElementById('hud-nivel'),
    tempo: document.getElementById('hud-tempo'),
    modo: document.getElementById('hud-modo'),
    objetivo: document.getElementById('hud-objetivo'),

    aviso: document.getElementById('aviso'),
    avisoTitulo: document.getElementById('aviso-titulo'),
    avisoDetalhe: document.getElementById('aviso-detalhe'),
    avisoAcoes: document.getElementById('aviso-acoes'),
    efeitos: document.getElementById('hud-efeitos'),

    botaoPausa: document.getElementById('botao-pausa'),
  };

  // ───────────────────── Serviços ─────────────────────

  const store = new LocalStore();
  const configuracoes = new SettingsStorage(store);
  const ranking = new RankingStorage(store);
  const skinStorage = new SkinStorage(store);

  const carregador = new AssetLoader();
  const skins = new SkinRegistry(carregador);
  const fundo = new BackgroundRenderer(carregador);
  const renderizador = new CanvasRenderer(el.canvas, skins, fundo);
  const hud = new HudRenderer(el, renderizador, skins);

  const audio = new AudioManager();
  const exportador = new ProfileExport(ranking, configuracoes);

  // Restaura as preferências salvas antes de desenhar qualquer coisa.
  skins.aplicarPreferencias({
    skinDePeca: configuracoes.obter('skinDePeca'),
    skinDeFundo: configuracoes.obter('skinDeFundo'),
    simbolos: configuracoes.obter('simbolosNasPecas'),
  });
  SettingsPanel.aplicarTudo(configuracoes, audio, skins);
  fundo.aplicarNaPagina(skins.skinDeFundoAtiva);

  // ───────────────────── Motor ─────────────────────

  const jogo = new GameEngine({ modo: configuracoes.obter('modoPreferido') });

  /** Animações dos poderes especiais. Decorativas: nunca seguram a partida. */
  const efeitosVisuais = new EfeitoVisual();

  /** Fragmentos, faixas de luz e tranco das eliminações. Também decorativos. */
  const particulas = new SistemaDeParticulas();

  /** Anúncio grande da combinação de professores. */
  const anuncio = new AnuncioDeCombo(
    {
      caixa: document.getElementById('combo'),
      professores: document.getElementById('combo-professores'),
      nome: document.getElementById('combo-nome'),
      descricao: document.getElementById('combo-descricao'),
      detalhe: document.getElementById('combo-detalhe'),
    },
    skins,
  );

  /** Milissegundos restantes de desaceleração. Zero = tempo normal. */
  let hitstopRestanteMs = 0;

  /**
   * O tabuleiro que joga sozinho na tela inicial.
   *
   * Recebe o CONSTRUTOR do renderizador, não a instância: ela precisa do
   * próprio canvas e do próprio estado de tamanho. É o mesmo código de desenho
   * atendendo duas telas ao mesmo tempo.
   */
  const vitrine = new Vitrine(document.getElementById('canvas-vitrine'), CanvasRenderer, skins, fundo);

  /**
   * A tela do duelo.
   *
   * Recebe o CONSTRUTOR do renderizador, como a vitrine: ela cria os dois dela,
   * cada um com o próprio canvas e o próprio estado de tamanho.
   */
  const duelo = new TelaVersus(
    {
      secao: document.getElementById('area-de-duelo'),
      canvas: [
        document.getElementById('duelo-canvas-1'),
        document.getElementById('duelo-canvas-2'),
      ],
      tabuleiro: [
        document.getElementById('duelo-tabuleiro-1'),
        document.getElementById('duelo-tabuleiro-2'),
      ],
      aviso: [
        document.getElementById('duelo-aviso-1'),
        document.getElementById('duelo-aviso-2'),
      ],
      combo: [
        document.getElementById('duelo-combo-1'),
        document.getElementById('duelo-combo-2'),
      ],
      proxima: [
        document.getElementById('duelo-proxima-1'),
        document.getElementById('duelo-proxima-2'),
      ],
      painel: [1, 2].map((n) => ({
        pontos: document.getElementById(`duelo-pontos-${n}`),
        linhas: document.getElementById(`duelo-linhas-${n}`),
        lixo: document.getElementById(`duelo-lixo-${n}`),
        alvo: document.getElementById(`duelo-alvo-${n}`),
      })),
      pressao: document.getElementById('duelo-pressao'),
      pausa: document.getElementById('duelo-pausa'),
      fim: document.getElementById('duelo-fim'),
      fimTitulo: document.getElementById('duelo-fim-titulo'),
      fimDetalhe: document.getElementById('duelo-fim-detalhe'),
      corridaPura: document.getElementById('duelo-corrida-pura'),
      opcaoCorrida: document.getElementById('duelo-opcao-corrida'),
      dica: document.querySelector('.duelo__dica'),
      ladoAlado: [...document.querySelectorAll('.duelo__lado')],
      meio: document.querySelector('.duelo__meio'),
      mesa: document.getElementById('duelo-mesa'),
      canvasDaMesa: document.getElementById('mesa-canvas'),
      fichaDaMesa: [1, 2].map((n) => ({
        caixa: document.querySelector(`.duelo__ficha--${n}`),
        pontos: document.getElementById(`mesa-pontos-${n}`),
        linhas: document.getElementById(`mesa-linhas-${n}`),
      })),
      risco: document.getElementById('mesa-risco'),
      botaoRevanche: document.getElementById('duelo-revanche'),
      botaoSair: document.getElementById('duelo-sair'),
    },
    { CanvasRenderer, skins, fundo, audio },
  );

  duelo.aoSair = () => {
    duelo.parar();
    voltarAoMenu();
  };

  /** Resultado da última partida, usado pelas estatísticas e pela análise. */
  let ultimoResultado = null;

  // ───────────────────── Painéis ─────────────────────

  const paineis = ligarPaineis();

  const galeria = new SkinGallery(
    {
      galeriaDePecas: document.getElementById('galeria-pecas'),
      galeriaDeFundos: document.getElementById('galeria-fundos'),
      criador: document.getElementById('criador-de-skin'),
      nomeDaSkin: document.getElementById('nome-da-skin'),
      botaoSalvar: document.getElementById('botao-salvar-skin'),
      botaoLimpar: document.getElementById('botao-limpar-fotos'),
      aviso: document.getElementById('aviso-skin'),
    },
    skins,
    skinStorage,
    renderizador,
    configuracoes,
  );

  const estatisticas = new StatsPanel(
    {
      cartoes: document.getElementById('cartoes-estatisticas'),
      graficoEvolucao: document.getElementById('grafico-evolucao'),
      graficoDistribuicao: document.getElementById('grafico-distribuicao'),
      graficoLimpezas: document.getElementById('grafico-limpezas'),
    },
    skins,
    ranking,
  );

  new PainelDeProfessores({
    lista: document.getElementById('lista-de-professores'),
    combinacoes: document.getElementById('tabela-de-combinacoes'),
  });

  new SettingsPanel(
    document.getElementById('corpo-config'),
    configuracoes,
    audio,
    skins,
    (chave) => {
      // Mudar o tamanho do tabuleiro exige recalcular o canvas.
      if (chave === 'tamanhoDoTabuleiro') ajustarCanvas();
      desenhar();
    },
  );

  const menu = new MenuScreen(
    {
      tela: el.telaInicial,
      areaDeJogo: el.areaDeJogo,
      listaDeModos: el.listaDeModos,
      listaDeDuelos: el.listaDeDuelos,
      nome: el.nome,
      recorde: document.getElementById('recorde-em-destaque'),
      recordeValor: document.getElementById('recorde-valor'),
      recordeModo: document.getElementById('recorde-modo'),
    },
    ranking,
    configuracoes,
    comecarPartida,
  );

  /**
   * O que cada painel precisa desenhar ao abrir.
   *
   * Canvas dentro de elemento escondido mede zero pixels, então prévias e
   * gráficos só podem ser desenhados DEPOIS que o painel fica visível.
   */
  const aoAbrirPainel = {
    'painel-skins': () => galeria.redesenharPrevias(),
    'painel-estatisticas': () => {
      estatisticas.mostrar(ultimoResultado);
      estatisticas.desenharGraficos();
    },
    'painel-fim': () => estatisticas.desenharGraficos(),
    // A tabela precisa ser remontada a cada abertura: montá-la uma vez só, na
    // inicialização, deixaria o ranking congelado no estado do começo da sessão.
    'painel-ranking': () => atualizarRanking(),
  };

  // Abrir um painel durante a partida pausa o jogo; fechar retoma.
  for (const [id, painel] of paineis) {
    const abrirOriginal = painel.abrir.bind(painel);
    painel.abrir = () => {
      if (jogo.estado === ESTADOS.JOGANDO) {
        painel._pausouOJogo = true;
        jogo.pausar();
      }
      abrirOriginal();
      aoAbrirPainel[id]?.();
    };
    painel.aoFechar(() => {
      if (painel._pausouOJogo) {
        painel._pausouOJogo = false;
        jogo.retomar();
      }
      atualizarAviso();
    });
  }

  // ───────────────────── Entrada ─────────────────────

  /** Traduz um comando em ação no motor. Vale para teclado, toque e botões. */
  function executarComando(comando) {
    // O contexto de áudio só pode nascer a partir de uma ação do jogador.
    audio.inicializar();

    switch (comando) {
      case 'esquerda':
        if (jogo.mover(-1)) audio.tocar('mover');
        break;
      case 'direita':
        if (jogo.mover(1)) audio.tocar('mover');
        break;
      case 'softDrop':
        jogo.softDrop();
        break;
      case 'hardDrop':
        if (jogo.hardDrop()) audio.tocar('queda');
        break;
      case 'girarHorario':
        if (jogo.girar(1)) audio.tocar('girar');
        break;
      case 'girarAntiHorario':
        if (jogo.girar(-1)) audio.tocar('girar');
        break;
      case 'guardar':
        if (jogo.guardar()) audio.tocar('guardar');
        break;
      case 'pausa':
        alternarPausa();
        break;
      case 'reiniciar':
        if (jogo.estado !== ESTADOS.MENU) comecarPartida(jogo.modo.id);
        break;
      default:
        break;
    }
  }

  const teclado = new KeyboardInput(executarComando);
  teclado.ligar();

  const toque = new TouchInput(executarComando, el.canvas, el.controlesToque);
  if (TouchInput.disponivel()) {
    el.controlesToque.hidden = false;
    toque.ligar();
  }

  el.botaoPausa?.addEventListener('click', () => {
    audio.inicializar();
    alternarPausa();
  });

  function alternarPausa() {
    if (jogo.estado === ESTADOS.MENU || jogo.estado === ESTADOS.FIM_DE_JOGO) return;
    jogo.alternarPausa();
    atualizarAviso();
  }

  // ───────────────────── Eventos do motor ─────────────────────

  jogo.em('novaPeca', () => {
    hud.desenharProximas(jogo.filaDePecas(), jogo.marcaDaProxima());
    hud.desenharReserva(jogo.pecaGuardada, jogo.marcaGuardada?.professor ?? null);
  });

  jogo.em('reserva', () => {
    hud.desenharReserva(jogo.pecaGuardada, jogo.marcaGuardada?.professor ?? null);
    hud.desenharProximas(jogo.filaDePecas(), jogo.marcaDaProxima());
  });

  jogo.em('pecaFixada', () => audio.tocar('encaixe'));

  jogo.em('linhasLimpas', ({ quantidade, blocosEliminados }) => {
    audio.tocarLimpeza(quantidade);

    dispararEfeitoDeLimpeza(quantidade, blocosEliminados);
  });

  /**
   * Efeito de eliminação: fragmentos voando, faixa de luz e tranco no tabuleiro.
   *
   * A força escala com o feito. Uma linha simples dá um estalo discreto; um
   * Tetris sacode a tela. Se todas as eliminações tivessem o mesmo efeito, o
   * jogador não sentiria diferença entre a jogada segura e a arriscada — e é
   * justamente essa diferença que o sistema de pontuação recompensa.
   */
  function dispararEfeitoDeLimpeza(quantidade, blocosEliminados) {
    if (configuracoes.obter('movimentoReduzido')) return;
    if (!blocosEliminados?.length) return;

    const forca = 0.7 + quantidade * 0.3;

    // Quantidade calibrada olhando o resultado: dez fragmentos por bloco vezes
    // quarenta blocos empastelavam a tela num Tetris. Cinco leem como estilhaço;
    // o peso do feito vem da FORÇA e do tranco, não do número de partículas.
    const fragmentosPorBloco = quantidade >= 4 ? 6 : 5;

    let linhaMaisAlta = Infinity;
    let linhaMaisBaixa = -Infinity;

    for (const { linha, tipos } of blocosEliminados) {
      const linhaVisivel = linha - jogo.grid.linhasOcultas;
      if (linhaVisivel < 0) continue;

      linhaMaisAlta = Math.min(linhaMaisAlta, linhaVisivel);
      linhaMaisBaixa = Math.max(linhaMaisBaixa, linhaVisivel);

      tipos.forEach((tipo, coluna) => {
        if (!tipo) return;
        const { x, y, tamanho } = renderizador.centroDaCelula(linhaVisivel, coluna);
        const cor = skins.corRepresentativa(tipo);

        // O bloco incha antes de os estilhaços saírem. Sem isso, a explosão
        // começa no vazio: o bloco já sumiu quando os fragmentos aparecem.
        particulas.estourarCelula({ x, y, tamanho, cor });
        particulas.explodirBloco({
          x,
          y,
          tamanho,
          cor,
          quantidade: fragmentosPorBloco,
          forca,
        });
      });
    }

    // UMA faixa cobrindo todas as linhas eliminadas, não uma por linha.
    // Quatro faixas semitransparentes empilhadas somavam até branco puro, e o
    // Tetris — a jogada mais bonita do jogo — virava um borrão.
    if (linhaMaisAlta !== Infinity) {
      const topo = renderizador.centroDaCelula(linhaMaisAlta, 0);
      const altura = (linhaMaisBaixa - linhaMaisAlta + 1) * topo.tamanho;
      particulas.brilhoDeLinha({
        y: topo.y - topo.tamanho / 2,
        largura: renderizador.larguraDoTabuleiro,
        altura,
      });
    }

    // 1 linha mal se nota; um Tetris dá um soco.
    particulas.sacudir(quantidade * quantidade * 0.9, 180 + quantidade * 45);
  }

  jogo.em('nivelAcima', () => audio.tocar('nivel'));

  // ── Modo Professores ──

  jogo.em('poderExecutado', (relatorio) => {
    // O som escolhe a família do efeito: destruição, conversão ou tempo.
    if (relatorio.efeito) audio.tocar('guardar');
    else if (relatorio.blocosPreenchidos > 0) audio.tocar('nivel');
    else audio.tocarLimpeza(Math.min(Math.ceil(relatorio.blocosRemovidos / 8) || 1, 4));

    // Todos os professores envolvidos, não só o primeiro: é o que permite a
    // onda sair com as duas cores quando a jogada foi uma combinação.
    const visuais = (relatorio.professores ?? []).map((id) => skins.visualDoProfessor(id));
    const visual = visuais[0] ?? { cor: '#ffffff' };
    efeitosVisuais.registrar(relatorio, visuais.length ? visuais : visual);

    // Fragmentos nas células que o poder atingiu, na cor de quem o disparou.
    if (!configuracoes.obter('movimentoReduzido')) {
      for (const celula of (relatorio.celulas ?? []).slice(0, 60)) {
        const linhaVisivel = celula.linha - jogo.grid.linhasOcultas;
        if (linhaVisivel < 0) continue;
        const { x, y, tamanho } = renderizador.centroDaCelula(linhaVisivel, celula.coluna);

        // Cada bloco estoura na SUA cor, não na do professor. Pintar tudo com
        // a cor de quem disparou transformava a explosão numa mancha de uma
        // cor só; com a cor de origem, vê-se a pilha se desfazendo.
        const cor = celula.tipo ? skins.corRepresentativa(celula.tipo) : visual.cor;

        particulas.estourarCelula({ x, y, tamanho, cor });
        // Bomba joga mais longe e mais coisa que uma limpeza de linha: a
        // quantidade e a força são o que separam as duas na leitura.
        particulas.explodirBloco({ x, y, tamanho, cor, quantidade: 11, forca: 1.9, brilho: 0.34 });
      }
      if (relatorio.blocosRemovidos > 2) particulas.sacudir(11, 320);
    }

    // Hitstop + anúncio: o jogador precisa de um instante para ver o que fez.
    if (!configuracoes.obter('movimentoReduzido')) {
      hitstopRestanteMs = HITSTOP_DURACAO_MS;
    }

    anuncio.mostrar(
      relatorio,
      (relatorio.professores ?? []).map((id) => PROFESSORES[id] ?? { id, nome: id }),
    );
  });

  jogo.em('efeitoIniciado', () => hud.mostrarEfeitos(jogo.efeitosAtivos()));
  jogo.em('efeitoTerminou', () => hud.mostrarEfeitos(jogo.efeitosAtivos()));

  jogo.em('fimDeJogo', (resultado) => {
    audio.tocar(resultado.motivoDoFim === 'objetivo' ? 'objetivo' : 'fimDeJogo');
    audio.pararTrilha();
    encerrarPartida(resultado);
  });

  // ───────────────────── Ciclo de vida da partida ─────────────────────

  function comecarPartida(idDoModo) {
    audio.inicializar();

    /*
     * O duelo não passa pelo motor único: tem o próprio ciclo de vida.
     *
     * O id vem do cartão da tela inicial já com o formato: 'duelo:lado-a-lado'
     * ou 'duelo:compartilhado'. O formato é parte da escolha do modo, não um
     * ajuste a encontrar depois de a partida começar.
     */
    if (idDoModo.startsWith('duelo')) {
      const [, formato = 'lado-a-lado'] = idDoModo.split(':');
      vitrine.parar();
      menu.esconder();
      el.areaDeJogo.hidden = true;
      duelo.iniciar({ formato });
      return;
    }

    configuracoes.definir('modoPreferido', idDoModo);

    jogo.reiniciar({ modo: idDoModo });
    jogo.iniciar();

    efeitosVisuais.limpar();
    particulas.limpar();
    anuncio.esconder();
    hitstopRestanteMs = 0;

    // A demonstração para de gastar quadros durante a partida de verdade.
    vitrine.parar();
    menu.esconder();
    ajustarCanvas();

    hud.desenharProximas(jogo.filaDePecas(), jogo.marcaDaProxima());
    hud.desenharReserva(null, null);
    hud.mostrarEfeitos(jogo.efeitosAtivos());
    atualizarAviso();

    if (audio.trilhaLigada) audio.iniciarTrilha();

    // O foco vai para o tabuleiro para que as teclas cheguem ao jogo, e não
    // continuem no cartão do menu que acabou de ser clicado.
    el.canvas.focus?.();
  }

  function encerrarPartida(resultado) {
    ultimoResultado = resultado;

    const nome = menu.nomeDoJogador();

    // O histórico é lido ANTES de registrar esta partida: senão a análise de
    // evolução compararia a partida com ela mesma.
    const registro = ranking.registrar(resultado, nome);

    estatisticas.mostrar(resultado);
    estatisticas.montarResumoDoFim(
      document.getElementById('cartoes-resultado'),
      resultado,
      registro.posicao,
    );

    if (!registro.ok && registro.motivo === 'cota') {
      notificar('Não foi possível salvar no ranking: memória do navegador cheia.');
    }

    paineis.get('painel-fim')?.abrir();
    atualizarAviso();
  }

  // ───────────────────────────── Ranking ─────────────────────────────

  /** Redesenha abas e tabela do ranking com o estado atual. */
  function atualizarRanking() {
    montarRanking({
      abas: document.getElementById('abas-ranking'),
      tabela: document.getElementById('tabela-ranking'),
      ranking,
    });
  }

  atualizarRanking();

  document.getElementById('botao-exportar-perfil')?.addEventListener('click', () => {
    const nome = menu.nomeDoJogador();
    if (ranking.partidasDe(nome).length === 0) {
      mostrarAvisoDePerfil('Você ainda não tem partidas registradas com este nome.', 'erro');
      return;
    }
    const arquivo = exportador.baixar(nome);
    mostrarAvisoDePerfil(`Perfil exportado como ${arquivo}.`, 'sucesso');
  });

  document.getElementById('entrada-importar')?.addEventListener('change', async (evento) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;

    const resultado = await exportador.importar(arquivo);

    if (!resultado.ok) {
      mostrarAvisoDePerfil(resultado.erro, 'erro');
      return;
    }

    mostrarAvisoDePerfil(
      `Perfil de ${resultado.jogador} importado: ${resultado.novas} partida(s) nova(s).`,
      'sucesso',
    );
    atualizarRanking();
    menu.montar();
  });

  function mostrarAvisoDePerfil(texto, tipo) {
    const aviso = document.getElementById('aviso-perfil');
    if (!aviso) return;
    aviso.hidden = false;
    aviso.textContent = texto;
    aviso.className = `aviso-inline aviso-inline--${tipo}`;
  }

  document.getElementById('botao-jogar-de-novo')?.addEventListener('click', () => {
    paineis.get('painel-fim')?.fechar();
    comecarPartida(jogo.modo.id);
  });

  document.getElementById('botao-voltar-menu')?.addEventListener('click', () => {
    paineis.get('painel-fim')?.fechar();
    voltarAoMenu();
  });

  function voltarAoMenu() {
    duelo.parar();
    el.areaDeJogo.hidden = false;
    jogo.reiniciar({ modo: jogo.modo.id });
    audio.pararTrilha();
    efeitosVisuais.limpar();
    particulas.limpar();
    anuncio.esconder();
    hitstopRestanteMs = 0;
    menu.mostrar();
    hud.mostrarAviso(null);
    vitrine.iniciar();
  }

  /**
   * Clique no logotipo: volta ao menu inicial.
   *
   * Com partida em andamento, pede confirmação — sair perde a partida e ela
   * não entra no ranking. Um clique acidental no título não pode custar a
   * pontuação de alguém.
   *
   * A partida fica PAUSADA enquanto a pergunta está na tela, senão a peça
   * continuaria caindo enquanto o jogador decide.
   */
  document.getElementById('botao-inicio')?.addEventListener('click', () => {
    const emPartida = jogo.estado === ESTADOS.JOGANDO || jogo.estado === ESTADOS.PAUSADO;

    if (!emPartida) {
      voltarAoMenu();
      return;
    }

    // O painel pausa o jogo sozinho ao abrir (ver o laço que envolve `abrir`).
    paineis.get('painel-sair')?.abrir();
  });

  document.getElementById('botao-continuar-jogando')?.addEventListener('click', () => {
    // Fechar o painel retoma a partida pelo mesmo caminho de todos os outros.
    paineis.get('painel-sair')?.fechar();
  });

  document.getElementById('botao-confirmar-sair')?.addEventListener('click', () => {
    const painel = paineis.get('painel-sair');
    // Desarma a retomada automática: a partida vai ser descartada, não continuada.
    if (painel) painel._pausouOJogo = false;
    painel?.fechar();
    voltarAoMenu();
  });

  // ───────────────────── Desenho e laço principal ─────────────────────

  function ajustarCanvas() {
    renderizador.redimensionar(jogo.grid.colunas, jogo.grid.linhasVisiveis);
    desenhar();
  }

  function desenhar() {
    renderizador.desenhar({
      grid: jogo.grid,
      peca: jogo.peca,
      fantasma: configuracoes.obter('mostrarFantasma') ? jogo.posicaoFantasma() : null,
      efeitos: efeitosVisuais,
      particulas,
    });

    hud.atualizar({
      pontos: jogo.pontuacao.pontos,
      linhas: jogo.pontuacao.linhas,
      nivel: jogo.pontuacao.nivel,
      tempoMs: jogo.tempoDecorridoMs,
      modo: jogo.modo.nome,
      objetivo: HudRenderer.descreverObjetivo(
        jogo.modo,
        jogo.pontuacao.linhas,
        jogo.tempoDecorridoMs,
      ),
    });

    // A contagem regressiva dos efeitos precisa ser reavaliada sempre, não só
    // quando um efeito começa: senão o painel mostra "3 peças" até o fim e o
    // efeito parece sumir do nada. O próprio `mostrarEfeitos` compara com o
    // estado anterior e só mexe no DOM quando algo mudou de verdade.
    hud.mostrarEfeitos(jogo.efeitosAtivos());
  }

  function atualizarAviso() {
    if (jogo.estado === ESTADOS.PAUSADO) {
      hud.mostrarAviso('Pausado', 'Pressione P ou Esc para continuar.');
    } else {
      hud.mostrarAviso(null);
    }
  }

  // Trocar de skin no meio da partida redesenha tudo na hora.
  skins.aoMudar(() => {
    fundo.aplicarNaPagina(skins.skinDeFundoAtiva);
    hud.redesenharMiniaturas(
      jogo.filaDePecas(),
      jogo.pecaGuardada,
      jogo.marcaGuardada?.professor ?? null,
      jogo.marcaDaProxima(),
    );
    desenhar();
  });

  /**
   * Laço principal.
   *
   * O tempo é medido aqui e repassado ao motor por `update(deltaMs)`. Nenhuma
   * outra parte do jogo consulta o relógio — é o que torna a lógica testável
   * fora do navegador e independente da taxa de quadros do aparelho.
   */
  let ultimoInstante = performance.now();

  function laco(instante) {
    const bruto = instante - ultimoInstante;
    ultimoInstante = instante;

    const delta = Math.min(bruto, DELTA_MAXIMO_MS);

    /*
     * A desaceleração vale para o MOTOR e para o teclado, mas não para os
     * efeitos visuais: as partículas continuam em velocidade normal.
     *
     * É de propósito. Desacelerar a explosão junto com o jogo deixaria os
     * fragmentos parados no ar, o que parece travamento. Com o tempo do jogo
     * lento e a explosão em velocidade cheia, a leitura é "o mundo parou para
     * ver isso acontecer" — que é o efeito pretendido.
     */
    let fatorDoTempo = 1;
    if (hitstopRestanteMs > 0) {
      hitstopRestanteMs = Math.max(0, hitstopRestanteMs - delta);
      fatorDoTempo = HITSTOP_FATOR;
    }

    // O duelo tem o próprio relógio interno, mas o MESMO delta: dois laços
    // separados fariam as duas partidas divergirem com o tempo.
    duelo.atualizar(delta);

    teclado.atualizar(delta * fatorDoTempo);
    jogo.update(delta * fatorDoTempo);
    efeitosVisuais.atualizar(delta);
    particulas.atualizar(delta);
    desenhar();

    // A vitrine só consome tempo enquanto a tela inicial está à mostra.
    vitrine.atualizar(delta);

    requestAnimationFrame(laco);
  }

  requestAnimationFrame(laco);

  // Trocar de aba com o jogo rodando pausa automaticamente, para o jogador não
  // voltar e encontrar a partida perdida.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && jogo.estado === ESTADOS.JOGANDO) {
      jogo.pausar();
      atualizarAviso();
    }
    // Um delta correto na volta: sem isso o primeiro quadro traria o tempo todo
    // em que a aba esteve escondida.
    ultimoInstante = performance.now();
  });

  // Redimensionar a janela recalcula o tabuleiro.
  window.addEventListener('resize', () => {
    ajustarCanvas();
    vitrine.redimensionar();
    duelo.redimensionar();
  });

  // ───────────────────── Primeiro quadro ─────────────────────

  menu.mostrar();
  ajustarCanvas();
  vitrine.iniciar();

  // ───────────────────── PWA ─────────────────────

  /**
   * O Service Worker (que faz o jogo funcionar offline) é registrado APENAS em
   * produção.
   *
   * Em desenvolvimento ele atrapalha mais do que ajuda: guarda os arquivos em
   * cache e passa a servir a versão antiga, então você edita o código, recarrega
   * a página e nada muda — um erro difícil de diagnosticar, porque tudo parece
   * certo no editor. Fora do localhost, o comportamento é o normal do PWA.
   */
  const emDesenvolvimento = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

  if ('serviceWorker' in navigator) {
    if (emDesenvolvimento) {
      // Se um Service Worker ficou registrado de uma sessão anterior, tira do caminho.
      navigator.serviceWorker.getRegistrations?.().then((registros) => {
        for (const registro of registros) registro.unregister();
      });
      caches?.keys?.().then((nomes) => nomes.forEach((nome) => caches.delete(nome)));
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((erro) => {
          // Falhar aqui só significa que o jogo não funcionará offline.
          console.warn('[PWA] Service Worker não registrado:', erro.message);
        });
      });
    }
  }

  /**
   * Acesso para depuração e verificação automatizada.
   *
   * Existe por um motivo prático: em navegadores embutidos de ferramentas de
   * teste, requestAnimationFrame às vezes não roda, e o jogo pareceria travado.
   * Com isto dá para avançar o tempo manualmente e conferir o estado:
   *
   *     __tetris.jogo.iniciar();
   *     __tetris.jogo.update(1000);   // avança um segundo
   *     __tetris.desenhar();
   *     __tetris.jogo.grid.matrizVisivel();
   */
  window.__tetris = {
    jogo,
    skins,
    renderizador,
    ranking,
    configuracoes,
    audio,
    teclado,
    particulas,
    efeitosVisuais,
    anuncio,
    vitrine,
    duelo,
    hud,
    get hitstopRestanteMs() { return hitstopRestanteMs; },
    desenhar,
    comecarPartida,
    executarComando,
    MODOS,
    /**
     * Avança um quadro à mão, incluindo física de partículas.
     * Existe porque em navegadores que não compõem quadros o laço de animação
     * nunca roda, e sem isto os efeitos ficariam congelados no instante zero.
     */
    avancarQuadro(deltaMs = 16) {
      let fator = 1;
      if (hitstopRestanteMs > 0) {
        hitstopRestanteMs = Math.max(0, hitstopRestanteMs - deltaMs);
        fator = HITSTOP_FATOR;
      }
      teclado.atualizar(deltaMs * fator);
      jogo.update(deltaMs * fator);
      efeitosVisuais.atualizar(deltaMs);
      particulas.atualizar(deltaMs);
      desenhar();
    },
  };
}

// Só montamos depois que o HTML existe.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
