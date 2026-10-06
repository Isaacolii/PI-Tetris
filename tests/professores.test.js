/**
 * professores.test.js — Testes do modo Professores Especiais.
 *
 * Como todo o resto do núcleo, rodam **sem navegador**. O sistema de professores
 * mexe em tabuleiro, pontuação e velocidade — três coisas que precisam ser
 * verificáveis sem depender de alguém olhar a tela.
 *
 * Rode com:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Grid } from '../src/core/Grid.js';
import { PecaAtiva } from '../src/core/Tetromino.js';
import { tentarRotacionar } from '../src/core/RotationSystem.js';
import { GameEngine, ESTADOS } from '../src/core/GameEngine.js';
import { EfeitosAtivos } from '../src/core/EfeitosAtivos.js';
import { ProfessorSystem } from '../src/core/ProfessorSystem.js';
import { PROFESSORES, IDS_DE_PROFESSOR, chaveDoPar, todosOsPares } from '../src/core/Professores.js';
import {
  poderDoPar,
  executarPoder,
  executarPoderIndividual,
  tabelaDeCombinacoes,
} from '../src/core/PoderesEspeciais.js';

// ───────────────────────────── Apoio ─────────────────────────────

/** Tabuleiro com as linhas de baixo cheias, para os poderes terem o que destruir. */
function tabuleiroCheio(aPartirDaLinha = 10) {
  const grid = new Grid();
  for (let linha = aPartirDaLinha; linha < grid.totalDeLinhas; linha++) {
    for (let coluna = 0; coluna < grid.colunas; coluna++) grid.celulas[linha][coluna] = 'X';
  }
  return grid;
}

function contarBlocos(grid) {
  return grid.celulas.flat().filter((c) => c !== null).length;
}

// ───────────────────────── Identidade e tabela ─────────────────────────

test('existem exatamente cinco professores', () => {
  assert.equal(IDS_DE_PROFESSOR.length, 5);
  assert.deepEqual(IDS_DE_PROFESSOR, ['A', 'B', 'C', 'D', 'E']);
  for (const id of IDS_DE_PROFESSOR) {
    assert.ok(PROFESSORES[id], `faltou a definição do professor ${id}`);
    assert.equal(typeof PROFESSORES[id].tema, 'string');
  }
});

test('a chave do par é a mesma nos dois sentidos', () => {
  assert.equal(chaveDoPar('A', 'B'), chaveDoPar('B', 'A'));
  assert.equal(chaveDoPar('E', 'C'), 'C|E');
});

test('A+B e B+A disparam exatamente o mesmo poder', () => {
  for (const [primeiro, segundo] of todosOsPares()) {
    const ida = poderDoPar(primeiro, segundo);
    const volta = poderDoPar(segundo, primeiro);
    assert.equal(ida.nome, volta.nome, `${primeiro}+${segundo} difere de ${segundo}+${primeiro}`);
    assert.equal(ida.executar, volta.executar);
  }
});

test('os 15 pares têm resposta — nenhum cai em indefinido', () => {
  const tabela = tabelaDeCombinacoes();
  assert.equal(tabela.length, 15);

  for (const item of tabela) {
    assert.equal(typeof item.nome, 'string');
    assert.ok(item.nome.length > 0, `par ${item.chave} sem nome`);
    assert.equal(typeof poderDoPar(...item.par).executar, 'function');
  }
});

test('os cinco pares de professores iguais compartilham uma única regra', () => {
  const iguais = IDS_DE_PROFESSOR.map((id) => poderDoPar(id, id));
  for (const poder of iguais) {
    assert.equal(poder.nome, 'Aula Dobrada');
    assert.equal(poder.executar, iguais[0].executar, 'deveria ser a mesma função');
  }
});

test('as 15 combinações estão implementadas — nenhuma usa o efeito de reserva', () => {
  const pendentes = tabelaDeCombinacoes().filter((item) => !item.implementado);
  assert.deepEqual(pendentes, [], `ainda faltam: ${pendentes.map((p) => p.chave).join(', ')}`);
});

test('todo par faz alguma coisa no tabuleiro ou no tempo', () => {
  const PONTO = { linha: 15, coluna: 5 };

  for (const item of tabelaDeCombinacoes()) {
    const grid = tabuleiroCheio();

    // Os poderes de conversão precisam de vazios PARA PREENCHER, e no lugar
    // onde agem: um na linha do ponto, outro na coluna do ponto. Sem isso o
    // teste os acusaria de não fazer nada quando o problema é o cenário.
    grid.celulas[PONTO.linha][7] = null;
    grid.celulas[17][PONTO.coluna] = null;

    const antes = contarBlocos(grid);

    const relatorio = executarPoder(grid, item.par[0], item.par[1], PONTO);

    // Cada família de poder deixa um rastro diferente: destruir muda a
    // contagem, compactar só muda posições, marcar bombas não muda nenhuma das
    // duas, e os poderes de tempo não encostam no tabuleiro. Verificar só a
    // contagem de blocos deixaria a Reorganização passar por "não fez nada".
    const mudouAContagem = contarBlocos(grid) !== antes;
    const moveuBlocos = (relatorio.blocosMovidos ?? 0) > 0;
    const marcouBombas = (relatorio.bombasCriadas ?? 0) > 0;
    const temEfeito = relatorio.efeito !== null;

    assert.ok(
      mudouAContagem || moveuBlocos || marcouBombas || temEfeito,
      `${item.chave} (${item.nome}) não teve efeito nenhum`,
    );
  }
});

test('Blocos-Bomba marca blocos existentes em vez de destruí-los', () => {
  const grid = tabuleiroCheio();
  const antes = contarBlocos(grid);

  const relatorio = executarPoder(grid, 'A', 'D', { linha: 15, coluna: 5 });

  assert.equal(contarBlocos(grid), antes, 'este poder não deveria remover nada');
  assert.ok(relatorio.bombasCriadas > 0);

  // As bombas são blocos marcados com o Professor Alexandro: herdam o poder dele
  // quando a linha for limpa, sem precisar de um estado novo no tabuleiro.
  let marcados = 0;
  for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
    for (let coluna = 0; coluna < grid.colunas; coluna++) {
      if (grid.professorEm(linha, coluna) === 'A') marcados++;
    }
  }
  assert.equal(marcados, relatorio.bombasCriadas);
});

/*
 * Bug real, visto em jogo: um poder que eliminava uma linha inteira deixava a
 * faixa vazia no lugar, com a pilha flutuando acima. No Tetris, linha que
 * desaparece faz o resto descer — violar isso faz o tabuleiro parecer quebrado.
 */
test('linha esvaziada por poder desmorona e o resto desce', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < grid.colunas; coluna++) {
    grid.celulas[20][coluna] = 'X';
    grid.celulas[21][coluna] = 'X';
  }
  grid.celulas[19][2] = 'T'; // bloco solto acima das linhas que vão sumir

  executarPoder(grid, 'A', 'B', { linha: 20, coluna: 5 });
  grid.desmoronarLinhasVazias();

  // Nenhuma linha vazia pode sobrar SOB a pilha.
  const maisAltaOcupada = grid.celulas.findIndex((l) => l.some((c) => c !== null));
  for (let linha = maisAltaOcupada; linha < grid.totalDeLinhas; linha++) {
    const vazia = grid.celulas[linha].every((c) => c === null);
    assert.ok(!vazia, `a linha ${linha} ficou vazia sob a pilha — algo está flutuando`);
  }
  assert.equal(grid.celulas[21][2], 'T', 'o bloco solto deveria ter descido até o fundo');
});

test('a faixa vazia do topo não desmorona — é o estado normal do tabuleiro', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < grid.colunas; coluna++) grid.celulas[21][coluna] = 'X';

  const desmoronaram = grid.desmoronarLinhasVazias();

  assert.deepEqual(desmoronaram, [], 'não havia nada acima para descer');
  assert.equal(grid.celulas[21][0], 'X', 'a pilha não devia ter se movido');
});

test('desmoronar preserva buracos que não formam linha vazia', () => {
  const grid = new Grid();

  // Buraco em (19,0), mas a linha 19 NÃO está vazia — tem bloco na coluna 5.
  // Sem esse bloco a linha inteira desmoronaria e o buraco sumiria junto, o
  // que é correto, mas não é o caso que este teste quer cobrir.
  grid.celulas[18][0] = 'T';
  grid.celulas[19][5] = 'S';
  grid.celulas[20][0] = 'I';
  for (let coluna = 0; coluna < grid.colunas; coluna++) grid.celulas[21][coluna] = 'X';

  const buracosAntes = grid.contarBuracos();
  const desmoronaram = grid.desmoronarLinhasVazias();

  assert.deepEqual(desmoronaram, [], 'nenhuma linha estava vazia');
  assert.equal(
    grid.contarBuracos(),
    buracosAntes,
    'desmoronar não tapa buracos — isso é trabalho da Reorganização',
  );
});

test('compactar tapa buracos; desmoronar não — são operações diferentes', () => {
  const montar = () => {
    const grid = new Grid();
    grid.celulas[18][0] = 'T';
    grid.celulas[19][5] = 'S';
    grid.celulas[20][0] = 'I';
    for (let coluna = 0; coluna < grid.colunas; coluna++) grid.celulas[21][coluna] = 'X';
    return grid;
  };

  const comDesmoronar = montar();
  comDesmoronar.desmoronarLinhasVazias();

  const comCompactar = montar();
  comCompactar.compactar();

  assert.ok(comDesmoronar.contarBuracos() > 0, 'desmoronar deveria manter o buraco');
  assert.equal(comCompactar.contarBuracos(), 0, 'compactar deveria eliminar o buraco');
});

test('o motor desmorona sozinho depois de um poder', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 1 });
  jogo.iniciar();

  const grid = jogo.grid;
  for (let coluna = 0; coluna < grid.colunas; coluna++) {
    grid.celulas[20][coluna] = 'X';
    grid.celulas[21][coluna] = 'X';
  }
  grid.celulas[19][2] = 'T';
  grid.definirProfessor(20, 5, 'B');

  const peca = new PecaAtiva('O', 0, 5);
  peca.marcarComProfessor('A', 2);
  jogo.peca = peca;
  jogo.hardDrop();

  const maisAltaOcupada = grid.celulas.findIndex((l) => l.some((c) => c !== null));
  for (let linha = maisAltaOcupada; linha < grid.totalDeLinhas; linha++) {
    assert.ok(
      !grid.celulas[linha].every((c) => c === null),
      `linha ${linha} vazia sob a pilha depois do poder`,
    );
  }
});

test('Explosão Lenta destrói e ainda desacelera', () => {
  const grid = tabuleiroCheio();
  const relatorio = executarPoder(grid, 'A', 'E', { linha: 15, coluna: 5 });

  assert.equal(relatorio.blocosRemovidos, 9, 'deveria abrir uma área 3×3');
  assert.equal(relatorio.efeito.id, 'lentidao');
});

test('Varredura Horizontal remove a linha e faz o resto descer', () => {
  const grid = tabuleiroCheio(18);
  grid.celulas[17][3] = 'T'; // um bloco solto acima da faixa cheia

  const relatorio = executarPoder(grid, 'B', 'E', { linha: 20, coluna: 5 });

  assert.equal(relatorio.linhaVarrida, true);
  assert.equal(
    grid.celulas[18][3],
    'T',
    'o bloco de cima deveria ter descido — é o que diferencia a varredura da explosão',
  );
});

/*
 * Este teste nasceu de um defeito visto em jogo: a varredura agia na linha do
 * ponto da combinação, que fica no topo da pilha e está quase sempre vazia.
 * Chegou a remover UM bloco só — o poder era inútil na prática.
 */
test('Varredura Horizontal procura a linha mais cheia, não a do ponto', () => {
  const grid = new Grid();

  // Linha 21 quase cheia; a linha do ponto (10) tem um bloco só.
  for (let coluna = 0; coluna < 9; coluna++) grid.celulas[21][coluna] = 'X';
  grid.celulas[10][5] = 'T';

  const relatorio = executarPoder(grid, 'B', 'E', { linha: 10, coluna: 5 });

  assert.equal(relatorio.blocosRemovidos, 9, 'varreu a linha errada');
  assert.deepEqual(relatorio.linhasAtingidas, [21]);
});

test('Varredura Horizontal não quebra num tabuleiro vazio', () => {
  const grid = new Grid();
  const relatorio = executarPoder(grid, 'B', 'E', { linha: 10, coluna: 5 });

  assert.equal(relatorio.blocosRemovidos, 0);
  assert.equal(relatorio.linhaVarrida, false);
});

test('Coluna Coringa tapa os buracos sem erguer uma torre', () => {
  const grid = new Grid();
  grid.celulas[12][4] = 'T';
  grid.celulas[18][4] = 'I';
  grid.celulas[21][4] = 'O';

  const buracosAntes = grid.localizarBuracos().filter((b) => b.coluna === 4).length;
  assert.ok(buracosAntes > 0);

  const relatorio = executarPoder(grid, 'C', 'D', { linha: 15, coluna: 4 });

  assert.equal(relatorio.blocosPreenchidos, buracosAntes);
  assert.equal(grid.localizarBuracos().filter((b) => b.coluna === 4).length, 0);
  assert.equal(
    grid.celulas[11][4],
    null,
    'não pode preencher acima da pilha, senão o poder mata o jogador',
  );
});

test('Coluna Coringa procura outra coluna quando a do ponto não tem buracos', () => {
  const grid = new Grid();

  // A coluna 2 está cheia e sem buracos; a coluna 7 é a esburacada.
  for (let linha = 18; linha < 22; linha++) grid.celulas[linha][2] = 'X';
  grid.celulas[15][7] = 'T';
  grid.celulas[21][7] = 'O';

  const relatorio = executarPoder(grid, 'C', 'D', { linha: 18, coluna: 2 });

  assert.ok(relatorio.blocosPreenchidos > 0, 'o poder foi embora sem fazer nada');
  assert.deepEqual(relatorio.colunasAtingidas, [7]);
});

// ───────────────────────── Matriz paralela ─────────────────────────

test('o professor vai para a matriz paralela, não para a célula do tipo', () => {
  const grid = new Grid();
  const peca = new PecaAtiva('T', 5, 4);
  peca.marcarComProfessor('B', 0);

  const marcados = grid.fixar(peca);

  assert.equal(marcados.length, 1);
  const { linha, coluna } = marcados[0];
  assert.equal(grid.celulas[linha][coluna], 'T', 'a célula deve guardar o TIPO da peça');
  assert.equal(grid.professorEm(linha, coluna), 'B', 'e o professor fica na matriz paralela');
});

test('só uma célula da peça carrega o professor', () => {
  const peca = new PecaAtiva('O', 5, 4);
  peca.marcarComProfessor('C', 2);

  const comProfessor = peca.celulasOcupadas().filter((c) => c.professor !== null);
  assert.equal(comProfessor.length, 1);
  assert.equal(comProfessor[0].professor, 'C');
});

/*
 * Os três testes abaixo cobrem um bug real encontrado em jogo: a marca do
 * professor PULAVA de bloco ao girar a peça.
 *
 * A causa era guardar o índice da célula na lista de leitura da matriz. A
 * rotação reorganiza a matriz, então o índice 1 antes do giro apontava para
 * outro bloco depois dele. A correção foi guardar a POSIÇÃO na matriz e girá-la
 * junto — e estes testes existem para o bug não voltar despercebido.
 */

test('a marca fica na mesma célula física depois de girar', () => {
  const grid = new Grid();
  const peca = new PecaAtiva('T', 10, 4);
  peca.marcarComProfessor('A', 1);

  /** Onde a marca está, em coordenadas relativas à peça. */
  const ondeEsta = (p) => {
    const marcada = p.celulasOcupadas().find((c) => c.professor);
    return { linha: marcada.linha - p.linha, coluna: marcada.coluna - p.coluna };
  };

  // A peça T tem a marca no braço esquerdo (1,0). Girando no sentido horário,
  // esse braço vira o de cima: (0,1). Se a marca pular para o centro (1,1),
  // é o bug de novo.
  assert.deepEqual(ondeEsta(peca), { linha: 1, coluna: 0 });

  const girada = tentarRotacionar(peca, 1, grid).peca;
  assert.deepEqual(ondeEsta(girada), { linha: 0, coluna: 1 });
});

test('quatro giros devolvem a marca à célula original, em todas as peças', () => {
  const grid = new Grid();

  for (const tipo of ['I', 'O', 'T', 'S', 'Z', 'J', 'L']) {
    const peca = new PecaAtiva(tipo, 10, 3);
    peca.marcarComProfessor('B', 1);
    const inicial = { ...peca.posicaoDoProfessor };

    let atual = peca;
    for (let volta = 0; volta < 4; volta++) {
      const resultado = tentarRotacionar(atual, 1, grid);
      assert.notEqual(resultado, null, `a peça ${tipo} não conseguiu girar`);
      atual = resultado.peca;

      // Em nenhum momento a peça pode ficar sem marca ou com mais de uma.
      const marcadas = atual.celulasOcupadas().filter((c) => c.professor);
      assert.equal(marcadas.length, 1, `a peça ${tipo} ficou com ${marcadas.length} marcas`);
    }

    assert.deepEqual(atual.posicaoDoProfessor, inicial, `a peça ${tipo} não fechou o giro`);
  }
});

test('girar de ida e de volta devolve a marca ao lugar', () => {
  const grid = new Grid();
  const peca = new PecaAtiva('J', 10, 3);
  peca.marcarComProfessor('C', 2);
  const inicial = { ...peca.posicaoDoProfessor };

  const ida = tentarRotacionar(peca, 1, grid).peca;
  const volta = tentarRotacionar(ida, -1, grid).peca;

  assert.deepEqual(volta.posicaoDoProfessor, inicial);
});

test('a reserva devolve a peça com o professor que ela carregava', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 42 });
  jogo.iniciar();

  jogo.peca = new PecaAtiva('T', 0, 4);
  jogo.peca.marcarComProfessor('C', 1);
  const posicaoOriginal = { ...jogo.peca.posicaoDoProfessor };

  jogo.guardar();
  assert.equal(jogo.marcaGuardada?.professor, 'C', 'a reserva não guardou o professor');

  jogo.hardDrop(); // libera a reserva
  jogo.guardar();

  assert.equal(jogo.peca.tipo, 'T');
  assert.equal(jogo.peca.professor, 'C', 'o professor se perdeu na reserva');
  assert.deepEqual(jogo.peca.posicaoDoProfessor, posicaoOriginal, 'a marca mudou de bloco');
});

test('reiniciar limpa a marca guardada na reserva', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 1 });
  jogo.iniciar();
  jogo.peca = new PecaAtiva('T', 0, 4);
  jogo.peca.marcarComProfessor('D', 0);
  jogo.guardar();

  jogo.reiniciar({ modo: 'professores' });

  assert.equal(jogo.pecaGuardada, null);
  assert.equal(jogo.marcaGuardada, null, 'a marca sobreviveu ao reinício');
});

test('limpar uma linha leva o professor junto — as duas matrizes ficam em sincronia', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < grid.colunas; coluna++) grid.celulas[21][coluna] = 'I';
  grid.definirProfessor(21, 3, 'A');

  assert.equal(grid.professorEm(21, 3), 'A');
  grid.removerLinhas([21]);

  assert.equal(grid.professorEm(21, 3), null, 'sobrou professor sem bloco embaixo');
  assert.equal(grid.professores.length, grid.totalDeLinhas, 'a matriz mudou de tamanho');
  assert.equal(grid.celulas.length, grid.professores.length, 'as matrizes ficaram de tamanhos diferentes');
});

test('remover um bloco apaga o professor junto', () => {
  const grid = new Grid();
  grid.celulas[10][2] = 'T';
  grid.definirProfessor(10, 2, 'D');

  grid.removerBloco(10, 2);

  assert.equal(grid.celulas[10][2], null);
  assert.equal(grid.professorEm(10, 2), null);
});

test('compactar leva o professor junto com o bloco', () => {
  const grid = new Grid();
  grid.celulas[5][0] = 'T';
  grid.definirProfessor(5, 0, 'C');

  grid.compactar();

  assert.equal(grid.professorEm(5, 0), null, 'o professor ficou para trás');
  assert.equal(grid.celulas[21][0], 'T');
  assert.equal(grid.professorEm(21, 0), 'C', 'o professor deveria ter descido com o bloco');
});

// ───────────────────────── Detecção de vizinhança ─────────────────────────

test('professores ortogonalmente vizinhos combinam', () => {
  const sistema = new ProfessorSystem(() => 0.5);
  const grid = new Grid();
  grid.celulas[20][5] = 'T';
  grid.definirProfessor(20, 5, 'B');

  const par = sistema.encontrarPar(grid, [{ linha: 19, coluna: 5, professor: 'A' }]);

  assert.notEqual(par, null);
  assert.equal(par.b.professor, 'B');
});

test('professores na diagonal NÃO combinam', () => {
  const sistema = new ProfessorSystem(() => 0.5);
  const grid = new Grid();
  grid.celulas[20][5] = 'T';
  grid.definirProfessor(20, 5, 'B');

  // (19,4) é diagonal em relação a (20,5).
  assert.equal(sistema.encontrarPar(grid, [{ linha: 19, coluna: 4, professor: 'A' }]), null);
});

test('professor sem vizinho não dispara nada', () => {
  const sistema = new ProfessorSystem(() => 0.5);
  const grid = new Grid();
  assert.equal(sistema.resolverAoFixar(grid, [{ linha: 10, coluna: 5, professor: 'A' }]), null);
});

test('os dois blocos são consumidos ao combinar', () => {
  const sistema = new ProfessorSystem(() => 0.5);
  const grid = tabuleiroCheio(18);
  grid.definirProfessor(20, 5, 'D');
  grid.definirProfessor(19, 5, 'E');

  sistema.resolverAoFixar(grid, [{ linha: 19, coluna: 5, professor: 'E' }]);

  assert.equal(grid.professorEm(19, 5), null);
  assert.equal(grid.professorEm(20, 5), null);
});

// ───────────────────────── Cada poder ─────────────────────────

test('Aula Dobrada limpa a área 3×3 ao redor', () => {
  const grid = tabuleiroCheio();
  const relatorio = executarPoder(grid, 'A', 'A', { linha: 15, coluna: 5 });

  assert.equal(relatorio.blocosRemovidos, 9);
  for (let linha = 14; linha <= 16; linha++) {
    for (let coluna = 4; coluna <= 6; coluna++) {
      assert.equal(grid.celulas[linha][coluna], null, `sobrou bloco em ${linha},${coluna}`);
    }
  }
});

test('Explosão Horizontal elimina duas linhas', () => {
  const grid = tabuleiroCheio();
  const relatorio = executarPoder(grid, 'A', 'B', { linha: 15, coluna: 5 });

  assert.deepEqual(relatorio.linhasAtingidas, [15, 16]);
  assert.equal(relatorio.blocosRemovidos, 20);
  assert.ok(grid.celulas[15].every((c) => c === null));
  assert.ok(grid.celulas[14].some((c) => c !== null), 'a linha vizinha não devia sumir');
});

test('Explosão Vertical elimina duas colunas', () => {
  const grid = tabuleiroCheio();
  const relatorio = executarPoder(grid, 'A', 'C', { linha: 15, coluna: 5 });

  assert.deepEqual(relatorio.colunasAtingidas, [5, 6]);
  for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
    assert.equal(grid.celulas[linha][5], null);
    assert.equal(grid.celulas[linha][6], null);
  }
});

test('Cruz Acadêmica atinge duas linhas e duas colunas', () => {
  const grid = tabuleiroCheio();
  const relatorio = executarPoder(grid, 'B', 'C', { linha: 15, coluna: 5 });

  assert.equal(relatorio.linhasAtingidas.length, 2);
  assert.equal(relatorio.colunasAtingidas.length, 2);
  // 2 linhas (10 cada) + 2 colunas (12 cada) - 4 cruzamentos contados duas vezes.
  assert.equal(relatorio.blocosRemovidos, 40);
});

test('Linha Coringa completa a linha, que passa a poder ser limpa', () => {
  const grid = new Grid();
  for (let coluna = 0; coluna < 7; coluna++) grid.celulas[20][coluna] = 'X';

  assert.ok(!grid.linhasCompletas().includes(20));
  const relatorio = executarPoder(grid, 'B', 'D', { linha: 20, coluna: 3 });

  assert.equal(relatorio.blocosPreenchidos, 3);
  assert.ok(grid.linhasCompletas().includes(20), 'a linha deveria estar completa agora');
});

test('Queda Controlada não mexe no tabuleiro, só no tempo', () => {
  const grid = tabuleiroCheio();
  const antes = contarBlocos(grid);

  const relatorio = executarPoder(grid, 'C', 'E', { linha: 15, coluna: 5 });

  assert.equal(contarBlocos(grid), antes, 'este poder não deveria destruir nada');
  assert.equal(relatorio.efeito.id, 'lentidao');
  assert.equal(relatorio.efeito.pecasRestantes, 3);
  assert.ok(relatorio.efeito.multiplicadorDeQueda > 1);
});

test('Reorganização elimina todos os buracos da pilha', () => {
  const grid = new Grid();
  grid.celulas[5][0] = 'T';
  grid.celulas[8][0] = 'I';
  grid.celulas[3][7] = 'S';

  assert.ok(grid.contarBuracos() > 0);
  const relatorio = executarPoder(grid, 'D', 'E', { linha: 10, coluna: 5 });

  assert.equal(grid.contarBuracos(), 0);
  assert.ok(relatorio.buracosEliminados > 0);
});

test('cada professor tem um poder individual quando é levado numa linha', () => {
  for (const id of IDS_DE_PROFESSOR) {
    const grid = tabuleiroCheio();
    grid.celulas[19][4] = null; // um buraco, para o Professor D ter o que tapar

    const relatorio = executarPoderIndividual(grid, id, { linha: 15, coluna: 5 });

    assert.notEqual(relatorio, null, `professor ${id} não tem poder individual`);
    const fezAlgo =
      relatorio.blocosRemovidos > 0 || relatorio.blocosPreenchidos > 0 || relatorio.efeito !== null;
    assert.ok(fezAlgo, `o poder individual de ${id} não teve efeito nenhum`);
  }
});

// ───────────────────────── Efeitos com duração ─────────────────────────

test('a lentidão dura o número certo de peças', () => {
  const efeitos = new EfeitosAtivos();
  efeitos.registrar({ id: 'lentidao', nome: 'Queda lenta', multiplicadorDeQueda: 2, pecasRestantes: 3 });

  assert.equal(efeitos.estaAtivo('lentidao'), true);
  efeitos.consumirUmaPeca();
  efeitos.consumirUmaPeca();
  assert.equal(efeitos.estaAtivo('lentidao'), true, 'ainda deveria estar valendo');

  const expirados = efeitos.consumirUmaPeca();
  assert.equal(efeitos.estaAtivo('lentidao'), false);
  assert.equal(expirados.length, 1);
});

test('um segundo efeito de lentidão renova a duração, não empilha a força', () => {
  const efeitos = new EfeitosAtivos();
  efeitos.registrar({ id: 'lentidao', nome: 'Queda lenta', multiplicadorDeQueda: 2, pecasRestantes: 2 });
  efeitos.registrar({ id: 'lentidao', nome: 'Queda lenta', multiplicadorDeQueda: 2, pecasRestantes: 5 });

  assert.equal(efeitos.listar().length, 1, 'não pode haver dois efeitos do mesmo tipo');
  assert.equal(efeitos.multiplicadorDeQueda(), 2, 'a força não deveria dobrar');
  assert.equal(efeitos.listar()[0].pecasRestantes, 5, 'a duração deveria ter sido renovada');
});

test('sem efeito nenhum, a velocidade é a normal', () => {
  assert.equal(new EfeitosAtivos().multiplicadorDeQueda(), 1);
});

test('a lentidão realmente estica o intervalo de queda', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 1 });
  jogo.iniciar();

  const normal = jogo.pontuacao.intervaloDeQueda(jogo.efeitos.multiplicadorDeQueda());
  jogo.efeitos.registrar({
    id: 'lentidao',
    nome: 'Queda lenta',
    multiplicadorDeQueda: 2.5,
    pecasRestantes: 3,
  });
  const lento = jogo.pontuacao.intervaloDeQueda(jogo.efeitos.multiplicadorDeQueda());

  assert.equal(lento, normal * 2.5);
});

// ───────────────────────── Sorteio ─────────────────────────

test('o sorteio de professor é determinístico com a mesma semente', () => {
  const sortearDoJogo = (semente) => {
    const jogo = new GameEngine({ modo: 'professores', semente });
    jogo.iniciar();
    const vistos = [];
    jogo.em('professorNaPeca', (dados) => vistos.push(dados.professor));
    for (let i = 0; i < 40 && jogo.estado === ESTADOS.JOGANDO; i++) jogo.hardDrop();
    return vistos.join('');
  };

  assert.equal(sortearDoJogo(777), sortearDoJogo(777));
});

test('nenhuma sequência longa fica sem professor', () => {
  // Com um sorteio que sempre falha, a garantia de teto tem que agir sozinha.
  const sistema = new ProfessorSystem(() => 0.99);

  let apareceu = false;
  for (let i = 0; i < 12; i++) {
    if (sistema.sortearProfessor()) apareceu = true;
  }
  assert.ok(apareceu, 'a garantia de peças sem professor não funcionou');
});

test('o professor sorteado é sempre um dos cinco', () => {
  const sistema = new ProfessorSystem(() => 0.01);
  for (let i = 0; i < 30; i++) {
    const sorteado = sistema.sortearProfessor();
    if (sorteado) assert.ok(IDS_DE_PROFESSOR.includes(sorteado), `sorteou "${sorteado}"`);
  }
});

// ───────────────────────── Integração com o motor ─────────────────────────

test('os outros modos continuam sem professores', () => {
  for (const modo of ['maratona', 'sprint', 'ultra', 'zen']) {
    const jogo = new GameEngine({ modo, semente: 2026 });
    let houve = false;
    jogo.em('professorNaPeca', () => (houve = true));
    jogo.em('poderExecutado', () => (houve = true));

    jogo.iniciar();
    for (let i = 0; i < 50 && jogo.estado === ESTADOS.JOGANDO; i++) jogo.hardDrop();

    assert.equal(houve, false, `o modo ${modo} não deveria ter professores`);
    assert.equal(jogo.resultado().professores, null);
  }
});

test('a combinação dispara de verdade durante a partida', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 5 });
  jogo.iniciar();

  const poderes = [];
  jogo.em('poderExecutado', (relatorio) => poderes.push(relatorio));

  // Monta a situação: um professor já no tabuleiro e uma peça marcada caindo em cima.
  for (let coluna = 0; coluna < 10; coluna++) jogo.grid.celulas[21][coluna] = 'X';
  jogo.grid.definirProfessor(21, 5, 'A');

  const peca = new PecaAtiva('O', 0, 5);
  peca.marcarComProfessor('B', 2);
  jogo.peca = peca;
  jogo.hardDrop();

  assert.equal(poderes.length, 1, 'deveria ter disparado exatamente um poder');
  assert.equal(poderes[0].nome, 'Explosão Horizontal');
  assert.deepEqual([...poderes[0].professores].sort(), ['A', 'B']);
});

test('um poder não dispara outro em cadeia', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 9 });
  jogo.iniciar();

  const poderes = [];
  jogo.em('poderExecutado', (r) => poderes.push(r));

  // Três professores em fila: mesmo que a explosão alcance o terceiro, só um
  // poder pode acontecer por peça.
  for (let coluna = 0; coluna < 10; coluna++) jogo.grid.celulas[21][coluna] = 'X';
  jogo.grid.definirProfessor(21, 5, 'A');
  jogo.grid.definirProfessor(21, 6, 'A');
  jogo.grid.definirProfessor(21, 4, 'A');

  const peca = new PecaAtiva('O', 0, 5);
  peca.marcarComProfessor('A', 2);
  jogo.peca = peca;
  jogo.hardDrop();

  assert.equal(poderes.length, 1, 'houve encadeamento de poderes');
});

test('o resultado final traz o resumo dos poderes usados', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 3 });
  jogo.iniciar();
  for (let i = 0; i < 40 && jogo.estado === ESTADOS.JOGANDO; i++) jogo.hardDrop();

  const resultado = jogo.resultado();
  assert.notEqual(resultado.professores, null);
  assert.equal(typeof resultado.professores.poderesExecutados, 'number');
  assert.equal(typeof resultado.professores.porCombinacao, 'object');
});

test('linhas limpas por poder não alimentam o bônus de Tetris consecutivo', () => {
  const jogo = new GameEngine({ modo: 'professores', semente: 4 });
  jogo.iniciar();

  // Um Tetris feito à mão deixa a sequência armada.
  jogo.pontuacao.registrarLimpeza(4);
  assert.equal(jogo.pontuacao.sequenciaDeTetris, true);
  assert.equal(jogo.pontuacao.nivel, 1, 'quatro linhas ainda é nível 1');

  const pontosAntes = jogo.pontuacao.pontos;
  jogo.pontuacao.registrarLimpezaPorPoder(4);

  // Quatro linhas no nível 1 valem 800. Se o bônus de 1,5× tivesse sido
  // aplicado, seriam 1200 — e o modo Professores encheria o placar com um
  // bônus que o jogador não conquistou.
  assert.equal(jogo.pontuacao.pontos - pontosAntes, 800);
});
