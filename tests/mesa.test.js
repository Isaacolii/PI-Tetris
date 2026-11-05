/**
 * mesa.test.js — Testes do tabuleiro compartilhado.
 *
 * Este modo inventou regras que o motor de um jogador não tem: uma peça é
 * sólida para a outra, as duas podem travar no mesmo quadro, e a linha é de
 * quem a fechou. Cada uma dessas regras é uma forma nova de o jogo quebrar,
 * então cada uma tem teste.
 *
 * Rodam sem navegador. Rode com:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MesaCompartilhada } from '../src/core/MesaCompartilhada.js';
import { PecaAtiva } from '../src/core/Tetromino.js';

// ───────────────────────────── Apoio ─────────────────────────────

/** Mesa já iniciada, sem professores, para os testes de regra básica. */
function mesaLimpa(semente = 123) {
  const mesa = new MesaCompartilhada({ semente, comProfessores: false });
  mesa.iniciar();
  return mesa;
}

/** Põe a peça de um jogador exatamente onde o teste precisa. */
function posicionar(mesa, indice, tipo, linha, coluna) {
  const peca = new PecaAtiva(tipo, linha, coluna);
  mesa.pilotos[indice].peca = peca;
  return peca;
}

function contarBlocos(grid) {
  return grid.celulas.flat().filter((c) => c !== null).length;
}

// ───────────────────────────── Nascimento ─────────────────────────────

test('as duas peças nascem sem se atravessar', () => {
  const mesa = mesaLimpa();
  const [p1, p2] = mesa.pilotos;

  assert.ok(p1.peca, 'o jogador 1 tem peça');
  assert.ok(p2.peca, 'o jogador 2 tem peça');

  const ocupadas1 = new Set(p1.peca.celulasOcupadas().map((c) => `${c.linha},${c.coluna}`));
  const sobrepostas = p2.peca
    .celulasOcupadas()
    .filter((c) => ocupadas1.has(`${c.linha},${c.coluna}`));

  assert.deepEqual(sobrepostas, [], 'nascer uma dentro da outra eliminaria os dois no 1º quadro');
});

test('os dois tiram peças do MESMO saco', () => {
  const mesa = new MesaCompartilhada({ semente: 7, comProfessores: false });
  const fila = mesa.filaDePecas(7);
  mesa.iniciar();

  // As duas primeiras peças saíram do saco, na ordem.
  assert.equal(mesa.pilotos[0].peca.tipo, fila[0]);
  assert.equal(mesa.pilotos[1].peca.tipo, fila[1]);
});

test('a mesma semente dá a mesma mesa', () => {
  const a = new MesaCompartilhada({ semente: 99, comProfessores: false });
  const b = new MesaCompartilhada({ semente: 99, comProfessores: false });
  assert.deepEqual(a.filaDePecas(10), b.filaDePecas(10));
});

// ───────────────────────────── Uma peça é sólida para a outra ──────────────

test('não dá para mover a peça para dentro da peça do outro', () => {
  const mesa = mesaLimpa();

  // Duas peças O lado a lado: a do jogador 1 à esquerda da do jogador 2.
  posicionar(mesa, 0, 'O', 5, 3);
  posicionar(mesa, 1, 'O', 5, 5);

  assert.equal(mesa.mover(0, 1), false, 'andar para a direita esbarraria no outro');
  assert.equal(mesa.pilotos[0].peca.coluna, 3, 'a peça não pode ter andado');

  assert.equal(mesa.mover(0, -1), true, 'para o outro lado está livre');
});

test('a peça do outro também bloqueia a queda', () => {
  const mesa = mesaLimpa();

  posicionar(mesa, 0, 'O', 5, 4);   // em cima
  posicionar(mesa, 1, 'O', 7, 4);   // logo abaixo

  mesa.hardDrop(0);

  // Travou em cima do outro, não no chão.
  const blocos = mesa.grid.celulas
    .map((linha, i) => (linha.some(Boolean) ? i : null))
    .filter((i) => i !== null);

  assert.ok(blocos.length > 0, 'a peça travou em algum lugar');
  assert.ok(
    Math.min(...blocos) < mesa.grid.totalDeLinhas - 2,
    'se tivesse atravessado, teria parado no fundo do tabuleiro',
  );
});

test('a sombra para em cima da peça do outro, não no chão', () => {
  const mesa = mesaLimpa();

  posicionar(mesa, 0, 'O', 2, 4);
  posicionar(mesa, 1, 'O', 10, 4);

  const sombra = mesa.fantasmaDe(0);
  assert.ok(sombra.linha < 10, 'a sombra tem de parar antes da peça do outro');
});

test('girar desvia da peça do outro, e não a atravessa', () => {
  const mesa = mesaLimpa();

  // Peça I deitada, com a peça do outro colada logo abaixo.
  const alvo = posicionar(mesa, 0, 'I', 5, 3);
  posicionar(mesa, 1, 'O', 6, 4);

  const antes = JSON.stringify(alvo.matriz);
  mesa.girar(0, 1);
  const depois = mesa.pilotos[0].peca;

  const ocupadasDoOutro = new Set(
    mesa.pilotos[1].peca.celulasOcupadas().map((c) => `${c.linha},${c.coluna}`),
  );
  const invadiu = depois
    .celulasOcupadas()
    .some((c) => ocupadasDoOutro.has(`${c.linha},${c.coluna}`));

  assert.equal(invadiu, false, 'girar nunca pode terminar dentro da peça do outro');
  // (Pode não ter girado, se nenhum desvio coubesse: isso também é correto.)
  assert.ok(typeof antes === 'string');
});

// ───────────────────────────── Crédito da linha ─────────────────────────────

test('a linha é de quem a fechou, não de quem pôs mais blocos nela', () => {
  const mesa = mesaLimpa();
  const grid = mesa.grid;
  const ultima = grid.totalDeLinhas - 1;

  // O jogador 2 encheu quase a linha inteira...
  for (let c = 0; c < grid.colunas; c++) if (c !== 4 && c !== 5) grid.celulas[ultima][c] = 'X';

  // ...e o jogador 1 põe a peça que fecha.
  posicionar(mesa, 0, 'O', ultima - 1, 4);
  mesa.pilotos[1].peca = null;

  let creditado = null;
  mesa.em('linhasLimpas', (e) => { creditado = e.jogador; });
  mesa.hardDrop(0);

  assert.equal(creditado, 0, 'quem fecha leva — é a regra que dá para ter na cabeça jogando');
  assert.equal(mesa.pilotos[0].linhasFechadas, 1);
  assert.equal(mesa.pilotos[1].linhasFechadas, 0);
  assert.ok(mesa.pilotos[0].pontuacao.pontos > 0);
  assert.equal(mesa.pilotos[1].pontuacao.pontos, 0);
});

test('a limpeza informa a cor de cada bloco destruído, não só quais linhas', () => {
  const mesa = mesaLimpa();
  const grid = mesa.grid;
  const ultima = grid.totalDeLinhas - 1;

  // Cores diferentes de propósito: a tela pinta cada estilhaço com a sua.
  const cores = ['T', 'I', 'S', 'L', 'O', 'Z', 'J', 'T', 'I', 'S'];
  for (let c = 0; c < grid.colunas; c++) if (c !== 4 && c !== 5) grid.celulas[ultima][c] = cores[c];

  posicionar(mesa, 0, 'O', ultima - 1, 4);
  mesa.pilotos[1].peca = null;

  let evento = null;
  mesa.em('linhasLimpas', (e) => { evento = e; });
  mesa.hardDrop(0);

  assert.ok(evento, 'a limpeza aconteceu');
  assert.equal(evento.blocosEliminados.length, 1);

  const { linha, tipos } = evento.blocosEliminados[0];
  assert.equal(linha, ultima);
  assert.equal(tipos.length, grid.colunas);

  // A fotografia é de ANTES da remoção: depois dela a cor já não existe em
  // lugar nenhum, e os estilhaços sairiam todos brancos.
  assert.equal(tipos[0], 'T');
  assert.equal(tipos[6], 'J');
  assert.ok(tipos[4], 'a célula que o jogador acabou de pôr também está na foto');
  assert.ok(
    tipos.every(Boolean),
    'a linha estava cheia quando foi fotografada',
  );
});

// ───────────────────────────── Eliminação ─────────────────────────────

test('quem não consegue fazer a peça nascer é eliminado, e o outro vence', () => {
  const mesa = mesaLimpa();
  const grid = mesa.grid;

  // Entope a área de nascimento do jogador 2.
  for (let linha = 0; linha < 4; linha++) {
    for (let coluna = 4; coluna < 9; coluna++) grid.celulas[linha][coluna] = 'X';
  }

  let fim = null;
  let eliminado = null;
  mesa.em('fimDaMesa', (e) => { fim = e; });
  mesa.em('jogadorEliminado', (e) => { eliminado = e.jogador; });

  // Força o jogador 2 a pedir peça nova.
  mesa.pilotos[1].peca = new PecaAtiva('I', 18, 0);
  mesa.hardDrop(1);

  assert.equal(eliminado, 1);
  assert.ok(fim, 'o fim da mesa tem de ser anunciado');
  assert.equal(fim.vencedor, 0);
  assert.equal(mesa.encerrada, true);
});

test('depois do fim, nenhum comando funciona', () => {
  const mesa = mesaLimpa();
  mesa.encerrada = true;
  mesa.rodando = false;

  assert.equal(mesa.mover(0, 1), false);
  assert.equal(mesa.girar(0, 1), false);
  assert.equal(mesa.hardDrop(0), false);
  assert.equal(mesa.guardar(0), false);
});

test('o relógio parado não move ninguém', () => {
  const mesa = mesaLimpa();
  mesa.encerrada = true;

  const antes = mesa.pilotos.map((p) => p.peca?.linha ?? null);
  mesa.update(5000);
  assert.deepEqual(mesa.pilotos.map((p) => p.peca?.linha ?? null), antes);
});

// ───────────────────────────── Gravidade e travamento ─────────────────────

test('o tempo faz as duas peças descerem', () => {
  const mesa = mesaLimpa();
  const antes = mesa.pilotos.map((p) => p.peca.linha);

  mesa.update(1200);

  const depois = mesa.pilotos.map((p) => p.peca.linha);
  assert.ok(depois[0] > antes[0], 'a peça do jogador 1 desceu');
  assert.ok(depois[1] > antes[1], 'a peça do jogador 2 desceu');
});

test('a peça encostada só trava depois do atraso, não na hora', () => {
  const mesa = mesaLimpa();
  mesa.pilotos[1].peca = null;

  const ultima = mesa.grid.totalDeLinhas - 2;
  posicionar(mesa, 0, 'O', ultima, 2);

  mesa.update(100);
  assert.ok(mesa.pilotos[0].peca, 'cedo demais para travar: dá para ajustar ainda');

  mesa.update(600);
  assert.equal(mesa.pilotos[0].peca === null || contarBlocos(mesa.grid) > 0, true);
});

// ───────────────────────────── Reserva ─────────────────────────────

test('a reserva é de cada jogador, e não vaza para o outro', () => {
  const mesa = mesaLimpa();
  const tipoDoUm = mesa.pilotos[0].peca.tipo;

  mesa.guardar(0);

  assert.equal(mesa.pilotos[0].pecaGuardada, tipoDoUm);
  assert.equal(mesa.pilotos[1].pecaGuardada, null, 'a reserva do outro não pode ter mudado');
});

test('a reserva só vale uma vez por peça', () => {
  const mesa = mesaLimpa();
  assert.equal(mesa.guardar(0), true);
  assert.equal(mesa.guardar(0), false, 'duas trocas seguidas seriam troca infinita');
});

// ───────────────────────────── Placar e estado ─────────────────────────────

test('o placar traz os dois jogadores', () => {
  const mesa = mesaLimpa();
  const placar = mesa.placar();

  assert.equal(placar.length, 2);
  for (const linha of placar) {
    for (const campo of ['pontos', 'linhas', 'nivel', 'eliminado', 'reserva']) {
      assert.ok(campo in linha, `falta ${campo}`);
    }
  }
});

test('a ocupação vai de 0 com o tabuleiro vazio a perto de 1 com ele cheio', () => {
  const mesa = mesaLimpa();
  assert.equal(mesa.ocupacao(), 0);

  const grid = mesa.grid;
  for (let linha = grid.linhasOcultas; linha < grid.totalDeLinhas; linha++) {
    grid.celulas[linha][0] = 'X';
  }
  assert.ok(mesa.ocupacao() > 0.9, 'pilha até o topo tem de marcar quase cheio');
});

test('reiniciar limpa o tabuleiro e devolve os dois jogadores ao jogo', () => {
  const mesa = mesaLimpa();
  mesa.grid.celulas[20][0] = 'X';
  mesa.pilotos[1].eliminado = true;
  mesa.encerrada = true;

  mesa.reiniciar();

  assert.equal(contarBlocos(mesa.grid), 0);
  assert.equal(mesa.pilotos[1].eliminado, false);
  assert.equal(mesa.encerrada, false);
  assert.equal(mesa.vencedor, null);
});

// ───────────────────────────── Professores na mesa ─────────────────────────

test('com professores ligados, a marca aparece em alguma peça', () => {
  const mesa = new MesaCompartilhada({ semente: 5, comProfessores: true });
  let vistos = 0;
  mesa.em('professorNaPeca', () => vistos++);
  mesa.iniciar();

  // Trava muitas peças: a garantia do sistema obriga a aparecer professor.
  for (let i = 0; i < 40 && !mesa.encerrada; i++) {
    mesa.hardDrop(i % 2);
  }

  assert.ok(vistos > 0, 'no modo professores, a marca tem de sair em alguma peça');
});

test('sem professores, nenhuma peça nasce marcada', () => {
  const mesa = new MesaCompartilhada({ semente: 5, comProfessores: false });
  let vistos = 0;
  mesa.em('professorNaPeca', () => vistos++);
  mesa.iniciar();

  for (let i = 0; i < 40 && !mesa.encerrada; i++) mesa.hardDrop(i % 2);

  assert.equal(vistos, 0);
});
