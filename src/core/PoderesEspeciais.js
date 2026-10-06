/**
 * PoderesEspeciais.js — O que acontece quando dois professores se encontram.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Cada poder é uma função que recebe o tabuleiro e o ponto da combinação, mexe
 * no grid e devolve um RELATÓRIO do que fez. O relatório serve para três coisas
 * ao mesmo tempo: pontuar, animar e testar — sem que nenhuma delas precise
 * inspecionar o tabuleiro por fora.
 *
 * Nenhuma função aqui sabe o que é cor, som ou animação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DUAS REGRAS QUE VALEM PARA TODOS OS PODERES
 *
 * 1. Blocos que ficam sem apoio CONTINUAM FLUTUANDO, como no Tetris clássico.
 *    O único poder que reacomoda a pilha é a Reorganização (D+E) — é justamente
 *    o que dá identidade a ele. Aplicar queda em cascata em todo poder tornaria
 *    o resultado imprevisível e apagaria a diferença entre eles.
 *
 * 2. Um poder NÃO dispara outro. Se uma explosão remove um bloco de professor
 *    que estava colado em outro, nada acontece em cadeia. Sem esse limite, uma
 *    combinação azarada poderia encadear até travar a partida.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { chaveDoPar, todosOsPares } from './Professores.js';

/** Tipo usado para preencher célula vazia por poder de conversão. */
const TIPO_DE_PREENCHIMENTO = 'D';

/**
 * @typedef {Object} Relatorio
 * @property {string} poder            id do poder executado
 * @property {string} nome             rótulo para a interface
 * @property {number} blocosRemovidos
 * @property {number} blocosPreenchidos
 * @property {number[]} linhasAtingidas
 * @property {number[]} colunasAtingidas
 * @property {object|null} efeito      efeito temporal a registrar, se houver
 * @property {{linha: number, coluna: number}[]} celulas  o que mudou, para animar
 */

/** Molde de relatório, para todo poder devolver o mesmo formato. */
function relatorioVazio(id, nome) {
  return {
    poder: id,
    nome,
    blocosRemovidos: 0,
    blocosPreenchidos: 0,
    linhasAtingidas: [],
    colunasAtingidas: [],
    efeito: null,
    celulas: [],
  };
}

// ─────────────────────────── Operações básicas ───────────────────────────

/** Remove um retângulo de blocos e anota o que saiu. */
function removerArea(grid, linhaInicial, colunaInicial, altura, largura, relatorio) {
  for (let l = linhaInicial; l < linhaInicial + altura; l++) {
    for (let c = colunaInicial; c < colunaInicial + largura; c++) {
      if (grid.removerBloco(l, c)) {
        relatorio.blocosRemovidos++;
        relatorio.celulas.push({ linha: l, coluna: c });
      }
    }
  }
}

/** Remove uma linha inteira do tabuleiro (sem fazer o resto descer). */
function removerLinhaInteira(grid, linha, relatorio) {
  if (linha < 0 || linha >= grid.totalDeLinhas) return;
  for (let coluna = 0; coluna < grid.colunas; coluna++) {
    if (grid.removerBloco(linha, coluna)) {
      relatorio.blocosRemovidos++;
      relatorio.celulas.push({ linha, coluna });
    }
  }
  relatorio.linhasAtingidas.push(linha);
}

/** Remove uma coluna inteira do tabuleiro. */
function removerColunaInteira(grid, coluna, relatorio) {
  if (coluna < 0 || coluna >= grid.colunas) return;
  for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
    if (grid.removerBloco(linha, coluna)) {
      relatorio.blocosRemovidos++;
      relatorio.celulas.push({ linha, coluna });
    }
  }
  relatorio.colunasAtingidas.push(coluna);
}

/** Preenche as células vazias de uma linha, deixando-a pronta para limpar. */
function preencherLinha(grid, linha, relatorio) {
  if (linha < 0 || linha >= grid.totalDeLinhas) return;
  for (let coluna = 0; coluna < grid.colunas; coluna++) {
    if (grid.celulas[linha][coluna] === null) {
      grid.celulas[linha][coluna] = TIPO_DE_PREENCHIMENTO;
      relatorio.blocosPreenchidos++;
      relatorio.celulas.push({ linha, coluna });
    }
  }
  relatorio.linhasAtingidas.push(linha);
}

// ─────────────────────────── Os poderes ───────────────────────────

/**
 * Explosão 3×3 — usada por todos os pares de professores IGUAIS.
 * Uma implementação atende cinco combinações (A+A, B+B, C+C, D+D, E+E).
 */
function auladobrada(grid, ponto) {
  const relatorio = relatorioVazio('aula-dobrada', 'Aula Dobrada');
  removerArea(grid, ponto.linha - 1, ponto.coluna - 1, 3, 3, relatorio);
  return relatorio;
}

/** A+B — elimina a linha do ponto e a de baixo. */
function explosaoHorizontal(grid, ponto) {
  const relatorio = relatorioVazio('explosao-horizontal', 'Explosão Horizontal');
  removerLinhaInteira(grid, ponto.linha, relatorio);
  removerLinhaInteira(grid, ponto.linha + 1, relatorio);
  return relatorio;
}

/** A+C — elimina a coluna do ponto e a vizinha à direita. */
function explosaoVertical(grid, ponto) {
  const relatorio = relatorioVazio('explosao-vertical', 'Explosão Vertical');
  removerColunaInteira(grid, ponto.coluna, relatorio);
  removerColunaInteira(grid, ponto.coluna + 1, relatorio);
  return relatorio;
}

/** B+C — duas linhas e duas colunas cruzando o ponto. */
function cruzAcademica(grid, ponto) {
  const relatorio = relatorioVazio('cruz-academica', 'Cruz Acadêmica');
  removerLinhaInteira(grid, ponto.linha, relatorio);
  removerLinhaInteira(grid, ponto.linha + 1, relatorio);
  removerColunaInteira(grid, ponto.coluna, relatorio);
  removerColunaInteira(grid, ponto.coluna + 1, relatorio);
  return relatorio;
}

/**
 * B+D — completa a linha do ponto.
 * O motor limpa a linha logo depois, então o efeito prático é uma linha grátis.
 */
function linhaCoringa(grid, ponto) {
  const relatorio = relatorioVazio('linha-coringa', 'Linha Coringa');
  preencherLinha(grid, ponto.linha, relatorio);
  return relatorio;
}

/** C+E — as próximas peças caem devagar. Não mexe no tabuleiro. */
function quedaControlada() {
  const relatorio = relatorioVazio('queda-controlada', 'Queda Controlada');
  relatorio.efeito = {
    id: 'lentidao',
    nome: 'Queda lenta',
    multiplicadorDeQueda: 2.5, // intervalo 2,5× maior = 40% da velocidade
    pecasRestantes: 3,
  };
  return relatorio;
}

/**
 * A+D — transforma blocos vizinhos em bombas.
 *
 * Uma "bomba" aqui não é um estado novo: é um bloco marcado com o Professor A
 * na matriz de professores. Assim ele já herda todo o comportamento existente —
 * explode quando a linha dele é limpa, e combina se outro professor encostar.
 * Reaproveitar o mecanismo em vez de inventar um terceiro estado evita ter que
 * ensinar o renderizador, o motor e a persistência sobre um conceito novo.
 */
function blocosBomba(grid, ponto) {
  const relatorio = relatorioVazio('blocos-bomba', 'Blocos-Bomba');
  const QUANTIDADE = 4;

  // Procura blocos ao redor do ponto, do mais perto para o mais longe.
  const candidatos = [];
  for (let raio = 1; raio <= 3 && candidatos.length < QUANTIDADE * 3; raio++) {
    for (let l = ponto.linha - raio; l <= ponto.linha + raio; l++) {
      for (let c = ponto.coluna - raio; c <= ponto.coluna + raio; c++) {
        if (l < 0 || l >= grid.totalDeLinhas || c < 0 || c >= grid.colunas) continue;
        if (grid.celulas[l][c] === null) continue;
        if (grid.professorEm(l, c) !== null) continue; // já é de alguém
        if (candidatos.some((p) => p.linha === l && p.coluna === c)) continue;
        candidatos.push({ linha: l, coluna: c });
      }
    }
  }

  for (const alvo of candidatos.slice(0, QUANTIDADE)) {
    grid.definirProfessor(alvo.linha, alvo.coluna, 'A');
    relatorio.celulas.push(alvo);
  }

  relatorio.bombasCriadas = Math.min(candidatos.length, QUANTIDADE);
  return relatorio;
}

/** A+E — destrói a área 3×3 e ainda deixa as próximas peças mais lentas. */
function explosaoLenta(grid, ponto) {
  const relatorio = relatorioVazio('explosao-lenta', 'Explosão Lenta');
  removerArea(grid, ponto.linha - 1, ponto.coluna - 1, 3, 3, relatorio);

  relatorio.efeito = {
    id: 'lentidao',
    nome: 'Queda lenta',
    multiplicadorDeQueda: 2,
    pecasRestantes: 4,
  };
  return relatorio;
}

/**
 * B+E — uma faixa atravessa o tabuleiro e leva uma linha inteira embora.
 *
 * Duas decisões que vieram de ver o poder em jogo:
 *
 * 1. A linha é REMOVIDA de verdade: tudo que estava acima desce, como numa
 *    limpeza normal. É o que distingue este poder da Explosão Horizontal —
 *    aquela abre um buraco, esta compacta.
 *
 * 2. Ela varre a linha MAIS PREENCHIDA, não a linha do ponto da combinação.
 *    O ponto fica sempre no topo da pilha, onde a linha está quase vazia; na
 *    primeira versão a varredura chegou a remover um único bloco, e o poder
 *    era inútil. Procurar onde há mais o que limpar também combina melhor com
 *    a ideia de uma varredura atravessando o tabuleiro.
 */
function varreduraHorizontal(grid, ponto) {
  const relatorio = relatorioVazio('varredura-horizontal', 'Varredura Horizontal');

  // Empate resolve pela linha mais baixa: é a que sustenta a pilha.
  let melhorLinha = -1;
  let maiorContagem = 0;

  for (let linha = 0; linha < grid.totalDeLinhas; linha++) {
    const preenchidas = grid.celulas[linha].filter((celula) => celula !== null).length;
    if (preenchidas >= maiorContagem && preenchidas > 0) {
      maiorContagem = preenchidas;
      melhorLinha = linha;
    }
  }

  // Tabuleiro vazio: nada a varrer, mas o poder não pode falhar.
  if (melhorLinha === -1) {
    relatorio.linhaVarrida = false;
    return relatorio;
  }

  for (let coluna = 0; coluna < grid.colunas; coluna++) {
    if (grid.celulas[melhorLinha][coluna] !== null) {
      relatorio.blocosRemovidos++;
      relatorio.celulas.push({ linha: melhorLinha, coluna });
    }
  }

  grid.removerLinhas([melhorLinha]);
  relatorio.linhasAtingidas.push(melhorLinha);
  relatorio.linhaVarrida = true;
  return relatorio;
}

/**
 * C+D — preenche todos os vazios cobertos de uma coluna.
 *
 * Só tapa buracos de verdade (vazio com bloco acima). Preencher a coluna do
 * fundo até o topo criaria uma torre gigante e mataria o jogador — o poder do
 * Professor Fabricio é consertar o erro, não construir um problema novo.
 */
function colunaCoringa(grid, ponto) {
  const relatorio = relatorioVazio('coluna-coringa', 'Coluna Coringa');

  const buracos = grid.localizarBuracos();
  if (buracos.length === 0) {
    relatorio.colunasAtingidas.push(Math.max(0, Math.min(ponto.coluna, grid.colunas - 1)));
    return relatorio;
  }

  // Prioridade para a coluna onde o jogador encaixou a peça — é a escolha que
  // ele consegue prever. Mas se ali não houver buraco, o poder iria embora sem
  // fazer nada; nesse caso vai para a coluna mais esburacada do tabuleiro.
  const naColunaDoPonto = buracos.filter((b) => b.coluna === ponto.coluna);

  let coluna = ponto.coluna;
  if (naColunaDoPonto.length === 0) {
    const contagem = new Map();
    for (const buraco of buracos) {
      contagem.set(buraco.coluna, (contagem.get(buraco.coluna) ?? 0) + 1);
    }
    coluna = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  for (const buraco of buracos.filter((b) => b.coluna === coluna)) {
    grid.celulas[buraco.linha][buraco.coluna] = TIPO_DE_PREENCHIMENTO;
    relatorio.blocosPreenchidos++;
    relatorio.celulas.push(buraco);
  }

  relatorio.colunasAtingidas.push(coluna);
  return relatorio;
}

/**
 * D+E — compacta a pilha: tudo cai e os buracos somem.
 * É o único poder que reacomoda o tabuleiro, e a razão de os demais não fazerem isso.
 */
function reorganizacao(grid) {
  const relatorio = relatorioVazio('reorganizacao', 'Reorganização');
  const buracosAntes = grid.contarBuracos();
  const movidos = grid.compactar();

  relatorio.blocosPreenchidos = 0;
  relatorio.buracosEliminados = buracosAntes - grid.contarBuracos();
  relatorio.blocosMovidos = movidos;
  return relatorio;
}

// ─────────────── Poderes individuais (professor levado numa linha limpa) ───────────────

/** Quando um professor sozinho é eliminado numa linha, age em versão reduzida. */
const PODERES_INDIVIDUAIS = {
  A: (grid, ponto) => {
    const relatorio = relatorioVazio('solo-explosao', 'Explosão');
    removerArea(grid, ponto.linha - 1, ponto.coluna - 1, 3, 3, relatorio);
    return relatorio;
  },
  B: (grid, ponto) => {
    const relatorio = relatorioVazio('solo-linha', 'Linha');
    removerLinhaInteira(grid, ponto.linha, relatorio);
    return relatorio;
  },
  C: (grid, ponto) => {
    const relatorio = relatorioVazio('solo-coluna', 'Coluna');
    removerColunaInteira(grid, ponto.coluna, relatorio);
    return relatorio;
  },
  D: (grid) => {
    const relatorio = relatorioVazio('solo-conversao', 'Conversão');
    // Tapa os quatro buracos mais fundos — os que mais atrapalham o jogador.
    for (const buraco of grid.localizarBuracos().slice(0, 4)) {
      grid.celulas[buraco.linha][buraco.coluna] = TIPO_DE_PREENCHIMENTO;
      relatorio.blocosPreenchidos++;
      relatorio.celulas.push(buraco);
    }
    return relatorio;
  },
  E: () => {
    const relatorio = relatorioVazio('solo-tempo', 'Tempo');
    relatorio.efeito = {
      id: 'lentidao',
      nome: 'Queda lenta',
      multiplicadorDeQueda: 2,
      pecasRestantes: 2,
    };
    return relatorio;
  },
};

// ─────────────────────────── A tabela ───────────────────────────

/**
 * Combinações implementadas nesta versão.
 * A chave é sempre ordenada (ver `chaveDoPar`), então A+B e B+A caem aqui.
 */
const COMBINACOES = {
  'A|B': { nome: 'Explosão Horizontal', executar: explosaoHorizontal },
  'A|C': { nome: 'Explosão Vertical', executar: explosaoVertical },
  'A|D': { nome: 'Blocos-Bomba', executar: blocosBomba },
  'A|E': { nome: 'Explosão Lenta', executar: explosaoLenta },
  'B|C': { nome: 'Cruz Acadêmica', executar: cruzAcademica },
  'B|D': { nome: 'Linha Coringa', executar: linhaCoringa },
  'B|E': { nome: 'Varredura Horizontal', executar: varreduraHorizontal },
  'C|D': { nome: 'Coluna Coringa', executar: colunaCoringa },
  'C|E': { nome: 'Queda Controlada', executar: quedaControlada },
  'D|E': { nome: 'Reorganização', executar: reorganizacao },
};

/**
 * Espaço para combinações previstas e ainda não escritas.
 *
 * Está vazio: as 15 combinações estão implementadas. A estrutura permanece
 * porque um professor novo traria pares novos, e é aqui que eles esperariam a
 * implementação — caindo na Aula Dobrada em vez de não fazer nada, para o
 * jogador nunca encontrar um par morto.
 */
const PREVISTAS_PARA_DEPOIS = {};

/**
 * Descobre qual poder um par dispara.
 *
 * @param {string} primeiro   id do professor
 * @param {string} segundo    id do professor
 * @returns {{nome: string, executar: Function, implementado: boolean}}
 */
export function poderDoPar(primeiro, segundo) {
  // Professores iguais compartilham uma única regra.
  if (primeiro === segundo) {
    return { nome: 'Aula Dobrada', executar: auladobrada, implementado: true };
  }

  const chave = chaveDoPar(primeiro, segundo);
  const combinacao = COMBINACOES[chave];
  if (combinacao) return { ...combinacao, implementado: true };

  const previsto = PREVISTAS_PARA_DEPOIS[chave];
  return {
    nome: previsto ?? 'Aula Dobrada',
    executar: auladobrada,
    implementado: false,
  };
}

/**
 * Aplica o poder de um par no tabuleiro.
 *
 * @param {import('./Grid.js').Grid} grid
 * @param {string} primeiro
 * @param {string} segundo
 * @param {{linha: number, coluna: number}} ponto  onde a combinação aconteceu
 * @returns {Relatorio}
 */
export function executarPoder(grid, primeiro, segundo, ponto) {
  const poder = poderDoPar(primeiro, segundo);
  const relatorio = poder.executar(grid, ponto);

  return {
    ...relatorio,
    nome: poder.nome,
    professores: [primeiro, segundo],
    implementado: poder.implementado,
    ponto,
  };
}

/**
 * Aplica o poder reduzido de um professor eliminado sozinho numa linha.
 * @returns {Relatorio|null} null se o id não existir
 */
export function executarPoderIndividual(grid, professor, ponto) {
  const executar = PODERES_INDIVIDUAIS[professor];
  if (!executar) return null;

  return { ...executar(grid, ponto), professores: [professor], ponto };
}

/** Tabela completa para a legenda da interface e para os testes. */
export function tabelaDeCombinacoes() {
  return todosOsPares().map(([primeiro, segundo]) => {
    const poder = poderDoPar(primeiro, segundo);
    return {
      par: [primeiro, segundo],
      chave: chaveDoPar(primeiro, segundo),
      nome: poder.nome,
      implementado: poder.implementado,
    };
  });
}
