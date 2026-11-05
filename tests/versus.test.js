/**
 * versus.test.js — Testes do modo de dois jogadores.
 *
 * Rodam **sem navegador**, como o resto do núcleo. O duelo é lógica pura:
 * dois motores, uma fila de lixo e uma condição de vitória. Nada aqui depende
 * de teclado, de controle ou de tela — por isso dá para provar no terminal que
 * o lixo cancela, que a semente é a mesma para os dois e que o poder mirado
 * atinge o tabuleiro certo.
 *
 * Rode com:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Versus } from '../src/core/Versus.js';
import { Grid, TIPO_DE_LIXO } from '../src/core/Grid.js';
import { PecaAtiva } from '../src/core/Tetromino.js';
import { KeyboardInput, MAPA_JOGADOR_1, MAPA_JOGADOR_2 } from '../src/input/KeyboardInput.js';
import { GamepadInput } from '../src/input/GamepadInput.js';
import { ESTADOS } from '../src/core/GameEngine.js';

// ───────────────────────────── Apoio ─────────────────────────────

/** Enche as linhas de baixo, deixando uma coluna livre para fechar a linha. */
function encherAteFaltarUma(grid, quantasLinhas, colunaLivre = 0) {
  const primeira = grid.totalDeLinhas - quantasLinhas;
  for (let linha = primeira; linha < grid.totalDeLinhas; linha++) {
    for (let coluna = 0; coluna < grid.colunas; coluna++) {
      grid.celulas[linha][coluna] = coluna === colunaLivre ? null : 'X';
    }
  }
  return primeira;
}

/**
 * Fecha N linhas passando pelo motor de verdade.
 *
 * Espiar `_ouvintes` e chamar o ouvinte à mão testaria o meu teste, não o
 * jogo: o evento só vale se vier de uma peça travando. Então o tabuleiro é
 * montado com N linhas faltando UMA célula, e uma peça I em pé fecha todas.
 */
function fecharLinhasDeVerdade(jogo, quantas) {
  const grid = jogo.grid;
  grid.limpar();
  encherAteFaltarUma(grid, quantas, 0);
  soltarIEmPe(jogo, 0);
}

/** Põe uma peça I na vertical na coluna pedida e deixa cair até travar. */
function soltarIEmPe(jogo, coluna) {
  const peca = new PecaAtiva('I', 0, coluna);
  // Matriz 4×4 com uma única coluna preenchida: é a I de pé.
  peca.matriz = [
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
  ];
  // A matriz ocupa o índice 1, então a peça recua uma coluna para cair onde
  // foi pedido.
  peca.coluna = coluna - 1;
  peca.linha = 0;
  jogo.peca = peca;
  jogo.hardDrop();
}

/**
 * Monta uma combinação de professores de verdade e dispara o poder.
 * Mesmo motivo do anterior: o evento `poderExecutado` só é confiável se o
 * motor o emitir sozinho.
 */
function montarCombinacao(jogo) {
  const grid = jogo.grid;
  grid.limpar();

  // A última coluna fica livre de propósito: linha completa se limparia
  // sozinha e a limpeza mascararia o estrago do poder na hora de medir.
  const base = grid.totalDeLinhas - 4;
  for (let c = 0; c < grid.colunas - 1; c++) {
    for (let d = 1; d < 4; d++) grid.celulas[base + d][c] = 'O';
  }
  grid.celulas[base][4] = 'O';
  grid.definirProfessor(base, 4, 'C');

  const peca = new PecaAtiva('O', 0, 4);
  peca.professor = 'B';
  peca.posicaoDoProfessor = { linha: 1, coluna: 0 };
  jogo.peca = peca;
}

function dispararCombinacaoDeVerdade(jogo) {
  montarCombinacao(jogo);
  jogo.hardDrop();
}

function contarBlocos(grid) {
  return grid.celulas.flat().filter((c) => c !== null).length;
}

// ───────────────────────────── Grid: receber lixo ─────────────────────────────

test('o lixo entra por baixo e empurra a pilha para cima', () => {
  const grid = new Grid();
  const ultima = grid.totalDeLinhas - 1;
  grid.celulas[ultima][3] = 'T';

  grid.adicionarLinhasDeLixo(2, 5);

  assert.equal(grid.celulas[ultima - 2][3], 'T', 'o bloco antigo subiu duas linhas');
  assert.equal(grid.celulas[ultima][3], TIPO_DE_LIXO, 'a última linha agora é lixo');
});

test('toda linha de lixo da mesma leva tem o buraco na MESMA coluna', () => {
  const grid = new Grid();
  grid.adicionarLinhasDeLixo(4, 7);

  for (let linha = grid.totalDeLinhas - 4; linha < grid.totalDeLinhas; linha++) {
    const vazias = grid.celulas[linha]
      .map((celula, coluna) => (celula === null ? coluna : null))
      .filter((c) => c !== null);

    assert.deepEqual(vazias, [7], `linha ${linha} devia ter um buraco só, na coluna 7`);
  }
});

test('o lixo não deixa marca de professor para trás', () => {
  const grid = new Grid();
  const ultima = grid.totalDeLinhas - 1;
  grid.celulas[ultima][2] = 'T';
  grid.definirProfessor(ultima, 2, 'A');

  grid.adicionarLinhasDeLixo(3, 0);

  assert.equal(grid.professorEm(ultima - 3, 2), 'A', 'a marca subiu junto com o bloco');
  assert.equal(grid.professorEm(ultima, 2), null, 'a linha de lixo nasce sem professor');
});

test('o buraco fica dentro do tabuleiro mesmo com coluna fora de faixa', () => {
  const grid = new Grid();
  grid.adicionarLinhasDeLixo(1, 999);
  const ultima = grid.celulas[grid.totalDeLinhas - 1];
  assert.equal(ultima.filter((c) => c === null).length, 1);
});

// ───────────────────────────── Semente compartilhada ─────────────────────────────

test('os dois jogadores recebem exatamente a mesma sequência de peças', () => {
  const duelo = new Versus({ semente: 1234 });
  const [p1, p2] = duelo.jogadores;

  assert.deepEqual(
    p1.jogo.filaDePecas(7),
    p2.jogo.filaDePecas(7),
    'sequências diferentes tornariam a partida injusta',
  );
});

test('duelos diferentes não repetem a mesma sequência', () => {
  const sementes = new Set();
  for (let i = 0; i < 5; i++) sementes.add(new Versus().semente);
  assert.ok(sementes.size > 1, 'a semente tem de ser sorteada a cada duelo');
});

// ───────────────────────────── Envio de lixo ─────────────────────────────

test('a tabela de envio segue a escada clássica', () => {
  for (const [linhas, esperado] of [[1, 0], [2, 1], [3, 2], [4, 4]]) {
    const duelo = new Versus({ semente: 9 });
    const [p1, p2] = duelo.jogadores;
    duelo.iniciar();

    fecharLinhasDeVerdade(p1.jogo, linhas);

    assert.equal(
      p2.lixoPendente,
      esperado,
      `${linhas} linha(s) deviam enviar ${esperado}, veio ${p2.lixoPendente}`,
    );
  }
});

test('o lixo que ia cair em você abate o que você acabou de mandar', () => {
  const duelo = new Versus({ semente: 31 });
  const [p1, p2] = duelo.jogadores;
  duelo.iniciar();

  p1.lixoPendente = 3;            // três linhas esperando para afogar o jogador 1
  fecharLinhasDeVerdade(p1.jogo, 4); // ele responde com um Tetris (envia 4)

  assert.equal(p1.lixoCancelado, 3, 'as três pendentes foram abatidas');
  assert.equal(p2.lixoPendente, 1, 'só a diferença atravessa');
});

// ───────────────────────────── Corrida pura ─────────────────────────────

test('com a interferência desligada, ninguém manda lixo para ninguém', () => {
  const duelo = new Versus({ semente: 3, interferencia: false });
  const [p1, p2] = duelo.jogadores;
  duelo.iniciar();

  fecharLinhasDeVerdade(p1.jogo, 4);

  assert.equal(p2.lixoPendente, 0, 'corrida pura: os tabuleiros não se tocam');
});

test('com a interferência desligada, mirar no adversário não tem efeito', () => {
  const duelo = new Versus({ semente: 3, interferencia: false });
  duelo.definirAlvo(0, 'adversario');

  assert.equal(duelo.jogadores[0].alvo, 'eu');
  assert.equal(
    duelo.jogadores[0].jogo.gridParaPoderes,
    duelo.jogadores[0].jogo.grid,
    'o poder tem de continuar agindo no próprio tabuleiro',
  );
});

// ───────────────────────────── Alvo do poder ─────────────────────────────

test('mirar no adversário aponta o poder para o tabuleiro dele', () => {
  const duelo = new Versus({ semente: 5 });
  const [p1, p2] = duelo.jogadores;

  duelo.definirAlvo(0, 'adversario');
  assert.equal(p1.jogo.gridParaPoderes, p2.jogo.grid);

  duelo.definirAlvo(0, 'eu');
  assert.equal(p1.jogo.gridParaPoderes, p1.jogo.grid);
});

test('alternarAlvo vai e volta', () => {
  const duelo = new Versus({ semente: 5 });
  assert.equal(duelo.jogadores[1].alvo, 'eu');
  duelo.alternarAlvo(1);
  assert.equal(duelo.jogadores[1].alvo, 'adversario');
  duelo.alternarAlvo(1);
  assert.equal(duelo.jogadores[1].alvo, 'eu');
});

test('o poder mirado age no tabuleiro do adversário, não no seu', () => {
  // Roda o MESMO cenário duas vezes, mudando só a mira, e compara qual dos
  // dois tabuleiros perdeu blocos. Medir um caso só exigiria cravar números
  // exatos de destruição, que mudam se o balanceamento do poder mudar.
  const medir = (alvo) => {
    const duelo = new Versus({ semente: 41 });
    const [p1, p2] = duelo.jogadores;
    duelo.iniciar();

    // Pilha no adversário, sem linha completa (ela se limparia sozinha).
    const gridDoOutro = p2.jogo.grid;
    gridDoOutro.limpar();
    for (let l = gridDoOutro.totalDeLinhas - 8; l < gridDoOutro.totalDeLinhas; l++) {
      for (let c = 0; c < gridDoOutro.colunas - 1; c++) gridDoOutro.celulas[l][c] = 'X';
    }

    // Monta o encontro em casa e só então mede: o montador limpa o tabuleiro.
    montarCombinacao(p1.jogo);
    const antes = { eu: contarBlocos(p1.jogo.grid), outro: contarBlocos(gridDoOutro) };

    duelo.definirAlvo(0, alvo);
    p1.jogo.hardDrop();

    return {
      perdeuEmCasa: antes.eu - contarBlocos(p1.jogo.grid),
      perdeuNoOutro: antes.outro - contarBlocos(p2.jogo.grid),
    };
  };

  const mirandoEmMim = medir('eu');
  const mirandoNoOutro = medir('adversario');

  assert.equal(mirandoEmMim.perdeuNoOutro, 0, 'sem mirar, o adversário não pode ser tocado');
  assert.ok(mirandoEmMim.perdeuEmCasa > 0, 'mirando em mim, o estrago é meu');

  assert.ok(
    mirandoNoOutro.perdeuNoOutro > 0,
    'mirando no adversário, o tabuleiro dele tinha de perder blocos',
  );
  assert.ok(
    mirandoNoOutro.perdeuEmCasa < mirandoEmMim.perdeuEmCasa,
    'mirando fora, o próprio tabuleiro sofre bem menos — só os dois professores consumidos',
  );
});

test('o alvo volta para o próprio tabuleiro depois de o poder disparar', () => {
  const duelo = new Versus({ semente: 43 });
  const [p1] = duelo.jogadores;
  duelo.iniciar();

  duelo.definirAlvo(0, 'adversario');
  dispararCombinacaoDeVerdade(p1.jogo);

  assert.equal(p1.alvo, 'eu', 'mira é decisão por jogada, não estado esquecido ligado');
  assert.equal(p1.jogo.gridParaPoderes, p1.jogo.grid);
});

// ───────────────────────────── Fim do duelo ─────────────────────────────

test('quem estoura perde, e o outro é declarado vencedor', () => {
  const duelo = new Versus({ semente: 11 });
  const [p1, p2] = duelo.jogadores;
  duelo.iniciar();

  let anunciado = null;
  duelo.em('fimDeDuelo', (dados) => { anunciado = dados; });

  // Afoga o jogador 2: lixo suficiente para passar do topo quando a próxima
  // peça dele travar. É o caminho real — o despejo acontece em 'pecaFixada'.
  p2.lixoPendente = p2.jogo.grid.totalDeLinhas;
  soltarIEmPe(p2.jogo, 3);

  assert.ok(anunciado, 'o fim do duelo tem de ser anunciado');
  assert.equal(anunciado.vencedor, 0);
  assert.equal(anunciado.perdedor, 1);
  assert.equal(duelo.vencedor, 0);
});

test('depois do fim, o relógio para para os dois', () => {
  const duelo = new Versus({ semente: 13 });
  duelo.iniciar();

  const [, p2] = duelo.jogadores;
  p2.lixoPendente = p2.jogo.grid.totalDeLinhas;
  soltarIEmPe(p2.jogo, 3);

  const antes = duelo.jogadores.map((j) => j.jogo.peca?.linha ?? null);
  duelo.update(5000);
  const depois = duelo.jogadores.map((j) => j.jogo.peca?.linha ?? null);

  assert.deepEqual(depois, antes, 'nenhuma peça pode continuar caindo depois do fim');
});

// ───────────────────────────── Relógio único ─────────────────────────────

test('um update avança os dois motores pelo mesmo tempo', () => {
  const duelo = new Versus({ semente: 17 });
  duelo.iniciar();

  const antes = duelo.jogadores.map((j) => j.jogo.peca.linha);
  duelo.update(1200);
  const depois = duelo.jogadores.map((j) => j.jogo.peca.linha);

  assert.ok(depois[0] > antes[0], 'a peça do jogador 1 tem de ter descido');
  assert.equal(
    depois[0] - antes[0],
    depois[1] - antes[1],
    'os dois caem na mesma velocidade; relógios separados divergiriam',
  );
});

// ───────────────────────────── Pressão ─────────────────────────────

test('a barra de pressão aponta para quem está sufocando o outro', () => {
  const duelo = new Versus({ semente: 19 });
  const [p1, p2] = duelo.jogadores;

  assert.equal(duelo.pressao(), 0, 'tabuleiros vazios: equilíbrio');

  p2.jogo.grid.adicionarLinhasDeLixo(8, 0);
  assert.ok(duelo.pressao() > 0, 'com o jogador 2 afogado, a pressão pende para o 1');

  p1.jogo.grid.adicionarLinhasDeLixo(16, 0);
  assert.ok(duelo.pressao() < 0, 'agora o jogador 1 é quem está pior');
});

// ───────────────────────────── Reinício ─────────────────────────────

test('reiniciar zera o lixo, a mira e o vencedor', () => {
  const duelo = new Versus({ semente: 23 });
  duelo.iniciar();

  duelo.jogadores[0].lixoPendente = 5;
  duelo.jogadores[1].lixoEnviado = 9;
  duelo.definirAlvo(1, 'adversario');
  duelo.vencedor = 0;
  duelo.encerrado = true;

  duelo.reiniciar();

  assert.equal(duelo.jogadores[0].lixoPendente, 0);
  assert.equal(duelo.jogadores[1].lixoEnviado, 0);
  assert.equal(duelo.jogadores[1].alvo, 'eu');
  assert.equal(duelo.vencedor, null);
  assert.equal(duelo.encerrado, false);
});

test('o placar traz os dois jogadores com os números do duelo', () => {
  const duelo = new Versus({ semente: 29 });
  duelo.iniciar();

  const placar = duelo.placar();
  assert.equal(placar.length, 2);
  for (const linha of placar) {
    for (const campo of ['pontos', 'linhas', 'lixoEnviado', 'lixoRecebido', 'alvo', 'estado']) {
      assert.ok(campo in linha, `falta ${campo} no placar`);
    }
  }
  assert.equal(placar[0].estado, ESTADOS.JOGANDO);
});

// ═══════════════════════ Entrada: teclado e controle ═══════════════════════

/** Controle falso no layout "standard": 16 botões e 4 eixos. */
function controleFalso({ botoes = [], eixos = [0, 0, 0, 0] } = {}) {
  const buttons = Array.from({ length: 16 }, (_, i) => ({
    pressed: botoes.includes(i),
    value: botoes.includes(i) ? 1 : 0,
  }));
  return { id: 'Controle de Teste', buttons, axes: eixos };
}

test('cada jogador enxerga só o próprio mapa de teclas', () => {
  const p1 = [];
  const p2 = [];
  const teclado1 = new KeyboardInput((c) => p1.push(c), { mapa: MAPA_JOGADOR_1 });
  const teclado2 = new KeyboardInput((c) => p2.push(c), { mapa: MAPA_JOGADOR_2 });

  assert.equal(teclado1.mapa.KeyA, 'esquerda');
  assert.equal(teclado1.mapa.ArrowLeft, undefined, 'a seta é do jogador 2');
  assert.equal(teclado2.mapa.ArrowLeft, 'esquerda');
  assert.equal(teclado2.mapa.KeyA, undefined, 'o A é do jogador 1');
});

test('os dois mapas não disputam nenhuma tecla', () => {
  const repetidas = Object.keys(MAPA_JOGADOR_1).filter((tecla) => tecla in MAPA_JOGADOR_2);
  assert.deepEqual(repetidas, [], 'tecla em comum faria um jogador mexer a peça do outro');
});

test('a chamada antiga do teclado, com o elemento no segundo argumento, continua valendo', () => {
  const alvoFalso = { addEventListener() {}, removeEventListener() {} };
  const teclado = new KeyboardInput(() => {}, alvoFalso);

  assert.equal(teclado.alvo, alvoFalso);
  assert.equal(teclado.mapa.ArrowLeft, 'esquerda', 'sem mapa, usa o padrão de um jogador');
});

test('apertar um botão do controle dispara o comando uma vez só', () => {
  const recebidos = [];
  let estado = controleFalso({ botoes: [0] });        // A = girar horário
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => [estado] });
  controle.ligar();

  controle.atualizar(16);
  controle.atualizar(16);                             // segue apertado
  controle.atualizar(16);

  assert.deepEqual(recebidos, ['girarHorario'], 'girar não repete enquanto segura');
});

test('segurar o direcional repete, mas só depois do atraso inicial', () => {
  const recebidos = [];
  const estado = controleFalso({ botoes: [14] });     // ← 
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => [estado] });
  controle.ligar();

  controle.atualizar(16);
  assert.equal(recebidos.length, 1, 'o primeiro toque anda uma casa');

  controle.atualizar(100);                            // ainda dentro do atraso
  assert.equal(recebidos.length, 1, 'não pode deslizar antes do tempo');

  controle.atualizar(100);                            // passou dos 170 ms
  assert.ok(recebidos.length > 1, 'depois do atraso, desliza');
  assert.ok(recebidos.every((c) => c === 'esquerda'));
});

test('soltar o direcional para a repetição', () => {
  const recebidos = [];
  let estado = controleFalso({ botoes: [15] });
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => [estado] });
  controle.ligar();

  controle.atualizar(16);
  controle.atualizar(300);
  const depoisDeSegurar = recebidos.length;

  estado = controleFalso({ botoes: [] });             // soltou
  controle.atualizar(300);

  assert.equal(recebidos.length, depoisDeSegurar, 'nada mais pode sair depois de soltar');
});

test('o analógico em repouso não move a peça', () => {
  const recebidos = [];
  const estado = controleFalso({ eixos: [0.2, -0.3, 0, 0] });  // tremor normal
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => [estado] });
  controle.ligar();

  controle.atualizar(16);
  controle.atualizar(500);

  assert.deepEqual(recebidos, [], 'controle largado na mesa não pode jogar sozinho');
});

test('o analógico além da zona morta move', () => {
  const recebidos = [];
  const estado = controleFalso({ eixos: [-0.9, 0, 0, 0] });
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => [estado] });
  controle.ligar();

  controle.atualizar(16);
  assert.deepEqual(recebidos, ['esquerda']);
});

test('desconectar no meio da partida solta tudo, em vez de travar a peça andando', () => {
  const recebidos = [];
  let controles = [controleFalso({ botoes: [14] })];
  const controle = new GamepadInput((c) => recebidos.push(c), { lerControles: () => controles });
  controle.ligar();

  controle.atualizar(16);
  controle.atualizar(300);
  const antes = recebidos.length;

  controles = [null];                                 // tirou o cabo
  controle.atualizar(500);

  assert.equal(recebidos.length, antes, 'sem controle, nenhum comando novo');
  assert.equal(controle.conectado, false);
  assert.equal(controle.segurando.size, 0, 'o estado de repetição tem de ser limpo');
});

test('sem controle nenhum, nada quebra', () => {
  const controle = new GamepadInput(() => {}, { lerControles: () => null });
  controle.ligar();
  controle.atualizar(16);
  assert.equal(controle.disponivel, false);
  assert.equal(controle.nome, null);
});

test('dois controles são lidos por índice, cada um no seu jogador', () => {
  const p1 = [];
  const p2 = [];
  const controles = [
    controleFalso({ botoes: [14] }),   // jogador 1 indo para a esquerda
    controleFalso({ botoes: [15] }),   // jogador 2 indo para a direita
  ];

  const c1 = new GamepadInput((c) => p1.push(c), { indice: 0, lerControles: () => controles });
  const c2 = new GamepadInput((c) => p2.push(c), { indice: 1, lerControles: () => controles });
  c1.ligar();
  c2.ligar();
  c1.atualizar(16);
  c2.atualizar(16);

  assert.deepEqual(p1, ['esquerda']);
  assert.deepEqual(p2, ['direita']);
});
