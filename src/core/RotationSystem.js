/**
 * RotationSystem.js — Rotação SRS (Super Rotation System) com wall kicks.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Girar não é só transpor a matriz. Quando a peça girada esbarra numa parede ou
 * na pilha, o SRS testa até cinco deslocamentos alternativos ("chutes") antes de
 * desistir. É isso que permite encaixar peças em poços e junto às paredes — sem
 * wall kick o jogo fica travado e a jogabilidade despenca.
 */

import { rotacionarMatriz } from './Tetromino.js';

/**
 * Tabelas oficiais do SRS.
 *
 * Chave: "estadoOrigem>estadoDestino" (0 = inicial, 1 = horário, 2 = 180°, 3 = anti-horário).
 * Valores: pares [x, y] na convenção ORIGINAL do SRS, em que y positivo aponta
 * para CIMA. Nosso grid cresce para baixo, então o y é invertido na hora de usar
 * (ver `aplicarChute`). Manter a tabela na forma original evita erro de transcrição
 * e permite conferir contra qualquer referência do padrão.
 */
const CHUTES_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

/** A peça I tem tabela própria porque seu centro de rotação fica entre células. */
const CHUTES_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

/** Escolhe a tabela de chutes conforme o tipo da peça. */
function tabelaDeChutes(tipo, origem, destino) {
  const tabela = tipo === 'I' ? CHUTES_I : CHUTES_JLSTZ;
  return tabela[`${origem}>${destino}`] ?? [[0, 0]];
}

/**
 * Tenta girar a peça, testando os chutes na ordem do padrão.
 *
 * @param {import('./Tetromino.js').PecaAtiva} peca  peça atual (não é modificada)
 * @param {1|-1} sentido   1 = horário, -1 = anti-horário
 * @param {import('./Grid.js').Grid} grid
 * @returns {{peca: object, indiceDoChute: number}|null} peça girada, ou null se nenhum chute coube
 */
export function tentarRotacionar(peca, sentido, grid) {
  // A peça O é um quadrado: girar não muda nada, e aplicar chutes só a faria escorregar.
  if (peca.tipo === 'O') return { peca: peca.clonar(), indiceDoChute: 0 };

  const origem = peca.rotacao;
  const destino = (origem + (sentido === 1 ? 1 : 3)) % 4;

  const candidata = peca.clonar();
  candidata.matriz = rotacionarMatriz(peca.matriz, sentido);
  candidata.rotacao = destino;

  // A marca do professor sofre a MESMA transformação da matriz. Sem esta linha
  // ela permanece na posição antiga e passa a apontar para outro bloco da peça —
  // era exatamente o bug em que a marca "pulava" de lugar ao girar.
  candidata.girarMarca(sentido);

  const chutes = tabelaDeChutes(peca.tipo, origem, destino);

  for (let i = 0; i < chutes.length; i++) {
    const [deslocamentoX, deslocamentoY] = chutes[i];
    const tentativa = candidata.clonar();
    tentativa.coluna += deslocamentoX;
    // Inversão do eixo Y: no SRS o y cresce para cima, no nosso grid cresce para baixo.
    tentativa.linha -= deslocamentoY;

    if (!grid.colide(tentativa)) {
      return { peca: tentativa, indiceDoChute: i };
    }
  }

  // Nenhum dos cinco deslocamentos coube: a rotação é recusada e a peça fica onde está.
  return null;
}
