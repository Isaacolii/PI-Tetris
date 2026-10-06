/**
 * core.test.js — Testes automatizados da lógica de jogo.
 *
 * Rode com:  npm test
 *
 * Estes testes NÃO abrem navegador. Isso é a prova prática da tese arquitetural
 * do projeto: a lógica está tão separada da tela que dá para verificá-la inteira
 * no terminal. Se algum dia estes testes precisarem de um canvas para rodar,
 * é sinal de que o isolamento foi quebrado.
 *
 * Usa o executor de testes nativo do Node (módulo node:test, disponível a partir
 * do Node 18) — sem instalar nenhuma dependência.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PecaAtiva, criarMatriz, rotacionarMatriz, TIPOS_DE_PECA } from '../src/core/Tetromino.js';
import { Grid } from '../src/core/Grid.js';
import { tentarRotacionar } from '../src/core/RotationSystem.js';
import { BagRandomizer } from '../src/core/BagRandomizer.js';
import { ScoreSystem } from '../src/core/ScoreSystem.js';
import { MODOS, verificarTermino, obterModo } from '../src/core/GameModes.js';
import { GameEngine, ESTADOS } from '../src/core/GameEngine.js';

// ───────────────────────────── Peças ─────────────────────────────

test('existem exatamente as sete peças clássicas', () => {
  assert.equal(TIPOS_DE_PECA.length, 7);
  assert.deepEqual([...TIPOS_DE_PECA].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
});

test('criarMatriz devolve cópia — alterar o resultado não contamina a forma base', () => {
  const primeira = criarMatriz('T');
  primeira[0][0] = 9;
  assert.equal(criarMatriz('T')[0][0], 0);
});

test('rotacionar quatro vezes no mesmo sentido volta à forma original', () => {
  for (const tipo of TIPOS_DE_PECA) {
    let matriz = criarMatriz(tipo);
    for (let i = 0; i < 4; i++) matriz = rotacionarMatriz(matriz, 1);
    assert.deepEqual(matriz, criarMatriz(tipo), `a peça ${tipo} não voltou ao original`);
  }
});

test('celulasOcupadas soma a posição da peça à matriz', () => {
  const peca = new PecaAtiva('O', 5, 4);
  // O campo `professor` vem null numa peça comum; ele só é preenchido no modo
  // Professores, e apenas na célula marcada.
  assert.deepEqual(peca.celulasOcupadas(), [
    { linha: 5, coluna: 4, professor: null },
    { linha: 5, coluna: 5, professor: null },
    { linha: 6, coluna: 4, professor: null },
    { linha: 6, coluna: 5, professor: null },
  ]);
});

// ───────────────────────────── Colisão ─────────────────────────────

test('parede esquerda, parede direita e fundo bloqueiam a peça', () => {
  const grid = new Grid();

  const foraEsquerda = new PecaAtiva('O', 5, -1);
  assert.equal(grid.colide(foraEsquerda), true, 'deveria bater na parede esquerda');

  const foraDireita = new PecaAtiva('O', 5, 9);
  assert.equal(grid.colide(foraDireita), true, 'deveria bater na parede direita');

  const noFundo = new PecaAtiva('O', 21, 4);
  assert.equal(grid.colide(noFundo), true, 'deveria bater no fundo');

  const valida = new PecaAtiva('O', 5, 4);
  assert.equal(grid.colide(valida), false, 'no meio do tabuleiro não deveria colidir');
});

test('acima do topo não colide — é onde a peça nasce', () => {
  const grid = new Grid();
  const peca = new PecaAtiva('T', -1, 4);
  assert.equal(grid.colide(peca), false);
});

test('peça colide com bloco já fixado', () => {
  const grid = new Grid();
  grid.celulas[10][4] = 'I';
  const peca = new PecaAtiva('O', 10, 4);
  assert.equal(grid.colide(peca), true);
});

// ───────────────────────────── Limpeza de linhas ─────────────────────────────

test('linha só conta como completa quando não sobra nenhuma célula vazia', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < 9; coluna++) grid.celulas[21][coluna] = 'I';
  assert.deepEqual(grid.linhasCompletas(), [], 'faltando uma célula não pode contar');

  grid.celulas[21][9] = 'I';
  assert.deepEqual(grid.linhasCompletas(), [21]);
});

test('remover linhas mantém a altura do tabuleiro e faz o resto descer', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < 10; coluna++) grid.celulas[21][coluna] = 'I';
  grid.celulas[20][0] = 'T';

  const removidas = grid.removerLinhas(grid.linhasCompletas());

  assert.equal(removidas, 1);
  assert.equal(grid.celulas.length, grid.totalDeLinhas, 'o tabuleiro mudou de tamanho');
  assert.equal(grid.celulas[21][0], 'T', 'o bloco de cima deveria ter descido');
  assert.equal(grid.celulas[21][1], null);
});

test('limpar 1, 2, 3 e 4 linhas de uma vez funciona', () => {
  for (const quantidade of [1, 2, 3, 4]) {
    const grid = new Grid();
    for (let i = 0; i < quantidade; i++) {
      const linha = 21 - i;
      for (let coluna = 0; coluna < 10; coluna++) grid.celulas[linha][coluna] = 'I';
    }
    assert.equal(grid.linhasCompletas().length, quantidade);
    assert.equal(grid.removerLinhas(grid.linhasCompletas()), quantidade);
    assert.equal(grid.contarBuracos(), 0, 'não deveria sobrar nada');
  }
});

test('buracos são contados só quando há bloco acima', () => {
  const grid = new Grid();
  assert.equal(grid.contarBuracos(), 0, 'tabuleiro vazio não tem buraco');

  grid.celulas[20][3] = 'T';
  assert.equal(grid.contarBuracos(), 1, 'uma célula vazia sob o bloco = 1 buraco');

  grid.celulas[21][3] = 'T';
  assert.equal(grid.contarBuracos(), 0, 'preenchido embaixo, o buraco some');
});

// ───────────────────────────── Rotação SRS ─────────────────────────────

test('rotação livre no meio do tabuleiro usa o primeiro chute (sem deslocamento)', () => {
  const grid = new Grid();
  const resultado = tentarRotacionar(new PecaAtiva('T', 10, 4), 1, grid);
  assert.equal(resultado.indiceDoChute, 0);
  assert.equal(resultado.peca.rotacao, 1);
  assert.equal(resultado.peca.coluna, 4, 'sem obstáculo, a peça não deveria se deslocar');
});

test('wall kick: com o destino bloqueado, o SRS desloca a peça em vez de recusar', () => {
  const grid = new Grid();
  // O T girado ocuparia (12,5); bloqueando essa célula, o chute 0 falha
  // e o SRS deve tentar o chute 1, que empurra a peça uma coluna para a esquerda.
  grid.celulas[12][5] = 'X';

  const resultado = tentarRotacionar(new PecaAtiva('T', 10, 4), 1, grid);

  assert.notEqual(resultado, null, 'a rotação deveria ter sido salva por um wall kick');
  assert.equal(resultado.indiceDoChute, 1);
  assert.equal(resultado.peca.coluna, 3, 'o chute 1 desloca uma coluna à esquerda');
});

test('rotação é recusada quando nenhum dos cinco chutes cabe', () => {
  const grid = new Grid();
  // Preenche tudo menos uma única coluna: não há espaço lateral para girar.
  for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
    for (let coluna = 0; coluna < grid.colunas; coluna++) {
      if (coluna !== 4) grid.celulas[linha][coluna] = 'X';
    }
  }
  assert.equal(tentarRotacionar(new PecaAtiva('T', 10, 3), 1, grid), null);
});

test('a peça O não se desloca ao girar', () => {
  const grid = new Grid();
  const resultado = tentarRotacionar(new PecaAtiva('O', 10, 4), 1, grid);
  assert.equal(resultado.peca.coluna, 4);
  assert.equal(resultado.peca.linha, 10);
});

// ───────────────────────────── Sorteio 7-bag ─────────────────────────────

test('cada sacola entrega as sete peças sem repetir', () => {
  const sorteio = new BagRandomizer(2024);
  for (let sacola = 0; sacola < 5; sacola++) {
    const tiradas = Array.from({ length: 7 }, () => sorteio.proxima());
    assert.equal(new Set(tiradas).size, 7, `a sacola ${sacola} repetiu peça`);
  }
});

test('mesma semente produz exatamente a mesma sequência', () => {
  const gerar = (semente) => {
    const sorteio = new BagRandomizer(semente);
    return Array.from({ length: 21 }, () => sorteio.proxima()).join('');
  };
  assert.equal(gerar(99), gerar(99));
  assert.notEqual(gerar(99), gerar(100));
});

/*
 * Bug real: o jogo abria com as MESMAS sete peças, na mesma ordem, em todas as
 * partidas. A causa era `reiniciar(semente = this.semente)`, que reusava a
 * semente antiga quando chamado sem argumento — e é assim que o jogo reinicia.
 * Não era falta de aleatoriedade: era aleatoriedade congelada.
 */
test('cada partida nova recebe uma sequência de peças diferente', () => {
  const sorteio = new BagRandomizer(12345);
  const sequencias = new Set();

  for (let partida = 0; partida < 6; partida++) {
    sorteio.reiniciar(); // sem semente: é como o jogo reinicia
    sequencias.add(Array.from({ length: 7 }, () => sorteio.proxima()).join(''));
  }

  assert.ok(sequencias.size >= 5, `só ${sequencias.size} sequências distintas em 6 partidas`);
});

test('reiniciar com semente explícita ainda repete a sequência', () => {
  // Este caminho tem que continuar determinístico: é o que sustenta os testes.
  const gerar = () => {
    const sorteio = new BagRandomizer(1);
    sorteio.reiniciar(777);
    return Array.from({ length: 14 }, () => sorteio.proxima()).join('');
  };
  assert.equal(gerar(), gerar());
});

test('espiar mostra as próximas peças sem consumi-las', () => {
  const sorteio = new BagRandomizer(5);
  const espiadas = sorteio.espiar(3);
  assert.equal(sorteio.proxima(), espiadas[0]);
  assert.equal(sorteio.proxima(), espiadas[1]);
  assert.equal(sorteio.proxima(), espiadas[2]);
});

// ───────────────────────────── Pontuação ─────────────────────────────

test('tabela de pontos do Guideline, multiplicada pelo nível', () => {
  const esperado = { 1: 100, 2: 300, 3: 500, 4: 800 };
  for (const [linhas, pontos] of Object.entries(esperado)) {
    const placar = new ScoreSystem(1);
    assert.equal(placar.registrarLimpeza(Number(linhas)).pontos, pontos);
  }

  const nivel3 = new ScoreSystem(3);
  assert.equal(nivel3.registrarLimpeza(1).pontos, 300, 'no nível 3, uma linha vale o triplo');
});

test('dois Tetris seguidos valem 50% a mais no segundo', () => {
  const placar = new ScoreSystem(1);
  assert.equal(placar.registrarLimpeza(4).pontos, 800);
  assert.equal(placar.registrarLimpeza(4).pontos, 1200);
});

test('limpar menos de 4 linhas quebra a sequência de Tetris', () => {
  const placar = new ScoreSystem(1);
  placar.registrarLimpeza(4);
  placar.registrarLimpeza(1);
  assert.equal(placar.registrarLimpeza(4).bonusSequencia, false);
});

test('sobe um nível a cada 10 linhas', () => {
  const placar = new ScoreSystem(1);
  for (let i = 0; i < 4; i++) placar.registrarLimpeza(2);
  assert.equal(placar.nivel, 1, '8 linhas ainda é nível 1');
  placar.registrarLimpeza(2);
  assert.equal(placar.nivel, 2, '10 linhas deveria virar nível 2');
});

test('a queda acelera conforme o nível sobe', () => {
  const nivel1 = new ScoreSystem(1).intervaloDeQueda();
  const nivel5 = new ScoreSystem(5).intervaloDeQueda();
  const nivel10 = new ScoreSystem(10).intervaloDeQueda();

  assert.equal(Math.round(nivel1), 1000, 'nível 1 deveria ser 1 segundo por linha');
  assert.ok(nivel5 < nivel1);
  assert.ok(nivel10 < nivel5);
  assert.ok(nivel10 > 0, 'o intervalo nunca pode chegar a zero');
});

// ───────────────────────────── Modos de jogo ─────────────────────────────

test('Sprint termina exatamente em 40 linhas', () => {
  const estado = { tempoDecorridoMs: 0, transbordou: false };
  assert.equal(verificarTermino(MODOS.sprint, { ...estado, linhas: 39 }).terminou, false);
  assert.equal(verificarTermino(MODOS.sprint, { ...estado, linhas: 40 }).motivo, 'objetivo');
});

test('Ultra termina em 2 minutos', () => {
  const estado = { linhas: 0, transbordou: false };
  assert.equal(verificarTermino(MODOS.ultra, { ...estado, tempoDecorridoMs: 119999 }).terminou, false);
  assert.equal(verificarTermino(MODOS.ultra, { ...estado, tempoDecorridoMs: 120000 }).motivo, 'tempo');
});

test('Zen não acaba nem quando a pilha estoura', () => {
  const transbordando = { linhas: 0, tempoDecorridoMs: 0, transbordou: true };
  assert.equal(verificarTermino(MODOS.zen, transbordando).terminou, false);
  assert.equal(verificarTermino(MODOS.maratona, transbordando).motivo, 'transbordo');
});

test('modo desconhecido cai no padrão em vez de quebrar', () => {
  assert.equal(obterModo('nao-existe').id, 'maratona');
});

// ───────────────────────────── Motor ─────────────────────────────

test('o motor só avança o tempo quando está jogando', () => {
  const jogo = new GameEngine({ semente: 1 });
  jogo.update(5000);
  assert.equal(jogo.tempoDecorridoMs, 0, 'no menu o tempo não deveria correr');

  jogo.iniciar();
  jogo.update(500);
  assert.equal(jogo.tempoDecorridoMs, 500);

  jogo.pausar();
  jogo.update(5000);
  assert.equal(jogo.tempoDecorridoMs, 500, 'pausado o tempo não deveria correr');
});

test('a gravidade derruba a peça sozinha com o passar do tempo', () => {
  const jogo = new GameEngine({ semente: 1 });
  jogo.iniciar();
  const linhaInicial = jogo.peca.linha;

  jogo.update(1000); // nível 1 = uma linha por segundo

  assert.equal(jogo.peca.linha, linhaInicial + 1);
});

test('hard drop leva a peça até o fundo e a fixa', () => {
  const jogo = new GameEngine({ semente: 1 });
  jogo.iniciar();
  jogo.hardDrop();

  assert.ok(jogo.grid.alturasPorColuna().some((altura) => altura > 0), 'nada foi fixado');
  assert.ok(jogo.pontuacao.pontos > 0, 'hard drop deveria pontuar');
});

test('a reserva só pode ser usada uma vez por peça', () => {
  const jogo = new GameEngine({ semente: 1 });
  jogo.iniciar();

  assert.equal(jogo.guardar(), true, 'a primeira reserva deveria funcionar');
  assert.equal(jogo.guardar(), false, 'a segunda seguida deveria ser recusada');

  jogo.hardDrop(); // nova peça libera a reserva de novo
  assert.equal(jogo.guardar(), true);
});

test('a sombra da peça mostra onde ela cairia', () => {
  const jogo = new GameEngine({ semente: 1 });
  jogo.iniciar();
  const fantasma = jogo.posicaoFantasma();

  assert.ok(fantasma.linha > jogo.peca.linha, 'a sombra deveria estar abaixo da peça');
  assert.equal(fantasma.coluna, jogo.peca.coluna, 'a sombra fica na mesma coluna');

  const maisAbaixo = fantasma.clonar();
  maisAbaixo.linha += 1;
  assert.equal(jogo.grid.colide(maisAbaixo), true, 'a sombra deveria estar no ponto mais baixo');
});

test('o motor avisa por evento quando limpa linhas', () => {
  const jogo = new GameEngine({ semente: 7 });
  jogo.iniciar();

  const avisos = [];
  jogo.em('linhasLimpas', (dados) => avisos.push(dados));

  // Monta quatro linhas cheias deixando a coluna 0 livre, e encaixa um I em pé.
  for (let linha = 18; linha <= 21; linha++) {
    for (let coluna = 1; coluna < 10; coluna++) jogo.grid.celulas[linha][coluna] = 'X';
  }
  jogo.peca = new PecaAtiva('I', 0, 3);
  jogo.girar(1);
  while (jogo.mover(-1));
  jogo.hardDrop();

  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].quantidade, 4);
  assert.equal(avisos[0].tipo, 'Tetris');
  assert.equal(jogo.pontuacao.linhas, 4);
});

test('a partida acaba quando a pilha invade a faixa de nascimento', () => {
  const jogo = new GameEngine({ modo: 'maratona', semente: 3 });
  jogo.iniciar();

  const fins = [];
  jogo.em('fimDeJogo', (resultado) => fins.push(resultado));

  // Empilha tudo na mesma região até estourar.
  let seguranca = 0;
  while (jogo.estado === ESTADOS.JOGANDO && seguranca++ < 500) {
    jogo.hardDrop();
  }

  assert.equal(jogo.estado, ESTADOS.FIM_DE_JOGO);
  assert.equal(fins.length, 1, 'o fim de jogo deveria ser avisado uma única vez');
  assert.equal(fins[0].motivoDoFim, 'transbordo');
});

test('no modo Zen a partida continua mesmo com a pilha estourando', () => {
  const jogo = new GameEngine({ modo: 'zen', semente: 3 });
  jogo.iniciar();

  let seguranca = 0;
  while (seguranca++ < 300) jogo.hardDrop();

  assert.equal(jogo.estado, ESTADOS.JOGANDO, 'o Zen não pode terminar sozinho');
});

test('mesma semente e mesmas jogadas produzem exatamente o mesmo resultado', () => {
  const jogarPartida = () => {
    const jogo = new GameEngine({ modo: 'maratona', semente: 12345 });
    jogo.iniciar();
    let seguranca = 0;
    while (jogo.estado === ESTADOS.JOGANDO && seguranca++ < 200) {
      for (let i = 0; i < seguranca % 5; i++) jogo.mover(-1);
      jogo.girar(1);
      jogo.hardDrop();
    }
    return jogo.resultado();
  };

  const primeira = jogarPartida();
  const segunda = jogarPartida();

  assert.equal(primeira.pontos, segunda.pontos);
  assert.equal(primeira.linhas, segunda.linhas);
  assert.deepEqual(primeira.estatisticas.distribuicaoDePecas, segunda.estatisticas.distribuicaoDePecas);
});

test('o resultado final traz tudo que o ranking e a análise precisam', () => {
  const jogo = new GameEngine({ modo: 'sprint', semente: 8 });
  jogo.iniciar();
  jogo.hardDrop();

  const resultado = jogo.resultado();
  for (const campo of ['modo', 'pontos', 'linhas', 'nivel', 'limpezas', 'semente', 'estatisticas', 'dataISO']) {
    assert.ok(campo in resultado, `faltou o campo ${campo} no resultado`);
  }
  assert.ok('acoesPorMinuto' in resultado.estatisticas);
  assert.ok('buracosCriados' in resultado.estatisticas);
});
