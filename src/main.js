/**
 * main.js — a raiz de composição do protótipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE É O ÚNICO ARQUIVO QUE CONHECE TODOS OS OUTROS.
 *
 *  O motor (`core/`) não sabe que existe uma tela. O renderizador não sabe que
 *  existe um motor. O teclado não sabe o que é uma peça. Quem apresenta os três
 *  é este arquivo — e só ele.
 *
 *  É por isso que os 92 testes do núcleo rodam no terminal, sem navegador:
 *  nada em `core/` depende de `document`, `window` ou `canvas`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ENTREGA 2 — PROTÓTIPO. Aqui não há menu, skins, som nem análise: o laço
 * começa a partida direto e o jogador já pode jogar. Essas camadas entram no
 * PI 3 e no PI 4 sem que este arquivo precise ser reescrito — apenas ganha
 * mais linhas de ligação.
 */

import { GameEngine, ESTADOS } from './core/GameEngine.js';
import { PROFESSORES } from './core/Professores.js';
import { criarMatriz } from './core/Tetromino.js';
import { KeyboardInput } from './input/KeyboardInput.js';
import { CanvasRendererSimples } from './render/CanvasRendererSimples.js';

/** Um quadro muito longo (aba em segundo plano) não pode teleportar a peça. */
const DELTA_MAXIMO_MS = 100;

/** Cores dos discos na legenda — as mesmas do renderizador. */
const CORES_DE_PROFESSOR = {
  A: '#ff5252',
  B: '#40c4ff',
  C: '#69f0ae',
  D: '#ffd740',
  E: '#b388ff',
};

// ───────────────────────────── elementos da página ─────────────────────────────

const tela = document.getElementById('tabuleiro');
const telaProxima = document.getElementById('proxima');
const telaReserva = document.getElementById('reserva');

const campoPontos = document.getElementById('pontos');
const campoLinhas = document.getElementById('linhas');
const campoNivel = document.getElementById('nivel');

const aviso = document.getElementById('aviso');
const avisoTitulo = document.getElementById('aviso-titulo');
const avisoTexto = document.getElementById('aviso-texto');
const faixa = document.getElementById('faixa');

const listaDeProfessores = document.getElementById('professores-lista');
const listaDeControles = document.getElementById('controles-lista');
const botaoReiniciar = document.getElementById('reiniciar');

// ───────────────────────────── as três peças do jogo ─────────────────────────────

const jogo = new GameEngine({ modo: 'professores' });
const renderizador = new CanvasRendererSimples(tela);

const teclado = new KeyboardInput((comando) => executarComando(comando));

const ctxProxima = telaProxima.getContext('2d');
const ctxReserva = telaReserva.getContext('2d');

/**
 * Traduz um comando do teclado em uma chamada ao motor.
 *
 * O teclado devolve o NOME da ação, nunca a tecla. Trocar a tecla de girar é
 * mexer só no mapa dentro de `KeyboardInput.js`; este bloco não muda.
 *
 * @param {string} comando
 */
function executarComando(comando) {
  switch (comando) {
    case 'esquerda':
      jogo.mover(-1);
      break;
    case 'direita':
      jogo.mover(1);
      break;
    case 'softDrop':
      jogo.softDrop();
      break;
    case 'hardDrop':
      jogo.hardDrop();
      break;
    case 'girarHorario':
      jogo.girar(1);
      break;
    case 'girarAntiHorario':
      jogo.girar(-1);
      break;
    case 'guardar':
      jogo.guardar();
      break;
    case 'pausa':
      jogo.alternarPausa();
      break;
    case 'reiniciar':
      reiniciarPartida();
      break;
    default:
      break;
  }
}

// ───────────────────────────── eventos do motor ─────────────────────────────

/*
 * O motor AVISA o que aconteceu; ele não manda ninguém desenhar. Quem escuta
 * decide o que fazer. No PI 3 o som entra aqui como mais um ouvinte, sem que
 * uma linha do motor mude.
 */

jogo.em('novaPeca', () => {
  atualizarPlacar();
  desenharCaixas();
});

jogo.em('reserva', () => desenharCaixas());

jogo.em('linhasLimpas', () => atualizarPlacar());

jogo.em('nivelAcima', () => atualizarPlacar());

jogo.em('pausado', () => {
  mostrarAviso('Pausado', 'Pressione P para continuar');
});

jogo.em('retomado', () => esconderAviso());

jogo.em('professorNaPeca', ({ professor }) => {
  const nome = PROFESSORES[professor]?.nome ?? professor;
  anunciar(`Professor ${nome} na peça`);
});

jogo.em('poderExecutado', (relatorio) => {
  anunciar(`Poder disparado: ${relatorio.nome}`);
});

jogo.em('fimDeJogo', () => {
  const { pontos, linhas } = jogo.resultado();
  mostrarAviso('Fim de jogo', `${pontos} pontos · ${linhas} linhas · R para recomeçar`);
});

// ───────────────────────────── desenho ─────────────────────────────

function desenhar() {
  renderizador.desenhar({
    grid: jogo.grid,
    peca: jogo.peca,
    fantasma: jogo.estado === ESTADOS.JOGANDO ? jogo.posicaoFantasma() : null,
  });
}

function desenharCaixas() {
  const [proximaPeca] = jogo.filaDePecas(1);

  CanvasRendererSimples.desenharPecaIsolada(
    ctxProxima,
    proximaPeca ? { tipo: proximaPeca, matriz: criarMatriz(proximaPeca) } : null,
  );

  CanvasRendererSimples.desenharPecaIsolada(
    ctxReserva,
    jogo.pecaGuardada
      ? { tipo: jogo.pecaGuardada, matriz: criarMatriz(jogo.pecaGuardada) }
      : null,
  );
}

/*
 * O placar é conferido a cada quadro, mas só escreve na página quando o número
 * muda de verdade.
 *
 * A primeira versão atualizava apenas em `novaPeca` e `linhasLimpas`, e errava
 * num caso: a queda instantânea pontua e, se ela encerra a partida, nenhum dos
 * dois eventos chega — a tela ficava dois pontos atrás do motor. Comparar antes
 * de escrever custa três comparações por quadro e nunca fica para trás.
 */
const placarNaTela = { pontos: null, linhas: null, nivel: null };

function atualizarPlacar() {
  if (placarNaTela.pontos !== jogo.pontuacao.pontos) {
    placarNaTela.pontos = jogo.pontuacao.pontos;
    campoPontos.textContent = placarNaTela.pontos;
  }
  if (placarNaTela.linhas !== jogo.pontuacao.linhas) {
    placarNaTela.linhas = jogo.pontuacao.linhas;
    campoLinhas.textContent = placarNaTela.linhas;
  }
  if (placarNaTela.nivel !== jogo.pontuacao.nivel) {
    placarNaTela.nivel = jogo.pontuacao.nivel;
    campoNivel.textContent = placarNaTela.nivel;
  }
}

// ───────────────────────────── avisos ─────────────────────────────

function mostrarAviso(titulo, texto) {
  avisoTitulo.textContent = titulo;
  avisoTexto.textContent = texto;
  aviso.hidden = false;

  // Uma pausa no meio de um recado deixaria os dois na tela ao mesmo tempo.
  clearTimeout(tempoDaFaixa);
  faixa.hidden = true;
}

function esconderAviso() {
  aviso.hidden = true;
}

/**
 * Recado passageiro, no topo do tabuleiro.
 *
 * Usa uma camada PRÓPRIA, não a do aviso de pausa. A primeira versão
 * reaproveitava o aviso e o resultado era o jogo apagando a tela inteira a cada
 * três peças, que é a frequência com que um professor aparece — a partida
 * ficava impossível de acompanhar.
 *
 * Nesta entrega é só texto. No PI 3 vira painel animado com o nome da
 * combinação, e o ponto de entrada continua sendo esta função.
 */
let tempoDaFaixa = null;
function anunciar(texto) {
  if (jogo.estado !== ESTADOS.JOGANDO) return;

  faixa.textContent = texto;
  faixa.hidden = false;

  clearTimeout(tempoDaFaixa);
  tempoDaFaixa = setTimeout(() => {
    faixa.hidden = true;
  }, 1400);
}

// ───────────────────────────── legendas ─────────────────────────────

function montarLegendaDeProfessores() {
  listaDeProfessores.innerHTML = '';

  for (const id of Object.keys(PROFESSORES)) {
    const { nome, tema } = PROFESSORES[id];

    const item = document.createElement('li');

    const disco = document.createElement('span');
    disco.className = 'professores__disco';
    disco.style.background = CORES_DE_PROFESSOR[id];
    disco.textContent = id;

    const rotulo = document.createElement('span');
    rotulo.textContent = `${nome} · ${tema}`;

    item.append(disco, rotulo);
    listaDeProfessores.append(item);
  }
}

function montarLegendaDeControles() {
  listaDeControles.innerHTML = '';

  for (const { acao, teclas } of KeyboardInput.descricaoDosControles()) {
    const termo = document.createElement('dt');
    termo.textContent = acao;

    const definicao = document.createElement('dd');
    definicao.textContent = teclas;

    listaDeControles.append(termo, definicao);
  }
}

// ───────────────────────────── partida ─────────────────────────────

function reiniciarPartida() {
  jogo.reiniciar({ modo: 'professores' });
  jogo.iniciar();
  esconderAviso();
  atualizarPlacar();
  desenharCaixas();
}

botaoReiniciar.addEventListener('click', () => {
  reiniciarPartida();
  botaoReiniciar.blur();   // devolve o foco ao jogo, senão Espaço reaperta o botão
});

// ───────────────────────────── laço principal ─────────────────────────────

let instanteAnterior = null;

function laco(instante) {
  if (instanteAnterior === null) instanteAnterior = instante;

  const bruto = instante - instanteAnterior;
  instanteAnterior = instante;

  // O mesmo delta alimenta o teclado e o motor. Se fossem relógios diferentes,
  // segurar a seta andaria mais rápido ou mais devagar que a gravidade.
  const delta = Math.min(bruto, DELTA_MAXIMO_MS);

  teclado.atualizar(delta);
  jogo.update(delta);
  atualizarPlacar();
  desenhar();

  requestAnimationFrame(laco);
}

// ───────────────────────────── partida ─────────────────────────────

renderizador.redimensionar(jogo.grid.colunas, jogo.grid.linhasVisiveis);
montarLegendaDeProfessores();
montarLegendaDeControles();

teclado.ligar();
jogo.iniciar();
atualizarPlacar();
desenharCaixas();

requestAnimationFrame(laco);

/**
 * Porta de inspeção para teste manual e automatizado.
 *
 * Existe porque o navegador embutido de algumas ferramentas não executa
 * `requestAnimationFrame` — ali o jogo pareceria travado. Com isto dá para
 * avançar o tempo à mão pelo console:
 *
 *     __tetris.avancarQuadro(1000)   // mil milissegundos de jogo
 *     __tetris.jogo.grid.celulas     // o tabuleiro em números
 */
window.__tetris = {
  jogo,
  renderizador,
  teclado,
  /**
   * Faz exatamente o que um quadro do laço faz — nem mais, nem menos.
   *
   * A primeira versão só chamava `update` e `desenhar`, e o placar ficava para
   * trás durante a inspeção. Não era bug do jogo: era o gancho de teste
   * mentindo sobre o quadro real, que é pior, porque manda procurar defeito
   * onde não há.
   */
  avancarQuadro(ms = 16) {
    teclado.atualizar(ms);
    jogo.update(ms);
    atualizarPlacar();
    desenhar();
  },
};
