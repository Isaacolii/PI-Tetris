/**
 * GameModes.js — Regras de término e de vitória de cada modo.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Um modo NÃO altera o motor: ele apenas responde "a partida acabou?" e informa
 * como o resultado deve ser lido (por pontos ou por tempo). Adicionar um modo novo
 * é acrescentar uma entrada aqui — o GameEngine não muda.
 */

/**
 * @typedef {Object} Modo
 * @property {string} id
 * @property {string} nome
 * @property {string} descricao
 * @property {'pontos'|'tempo'} criterio       o que define um resultado melhor
 * @property {boolean} terminaAoTransbordar    a pilha estourando encerra a partida?
 * @property {number|null} limiteDeLinhas      encerra ao atingir X linhas
 * @property {number|null} limiteDeTempoMs     encerra ao atingir X milissegundos
 * @property {boolean} [comProfessores]        as peças trazem professores especiais?
 */

/** @type {Record<string, Modo>} */
export const MODOS = {
  maratona: {
    id: 'maratona',
    nome: 'Maratona',
    descricao: 'O clássico: jogue até a pilha estourar. A velocidade aumenta a cada 10 linhas.',
    criterio: 'pontos',
    terminaAoTransbordar: true,
    limiteDeLinhas: null,
    limiteDeTempoMs: null,
  },
  sprint: {
    id: 'sprint',
    nome: 'Sprint',
    descricao: 'Limpe 40 linhas no menor tempo possível.',
    criterio: 'tempo',
    terminaAoTransbordar: true,
    limiteDeLinhas: 40,
    limiteDeTempoMs: null,
  },
  ultra: {
    id: 'ultra',
    nome: 'Ultra',
    descricao: 'Faça o máximo de pontos em 2 minutos.',
    criterio: 'pontos',
    terminaAoTransbordar: true,
    limiteDeLinhas: null,
    limiteDeTempoMs: 2 * 60 * 1000,
  },
  zen: {
    id: 'zen',
    nome: 'Zen',
    descricao: 'Sem fim e sem pressão. Ideal para testar skins e treinar encaixes.',
    criterio: 'pontos',
    terminaAoTransbordar: false,
    limiteDeLinhas: null,
    limiteDeTempoMs: null,
  },

  /*
   * Modo Professores.
   *
   * Repare que ele é declarado exatamente como os outros: uma entrada nesta
   * tabela. A única diferença é a chave `comProfessores`, que o motor consulta
   * para ligar o sorteio. Nenhuma regra de término mudou, e os quatro modos
   * acima seguem sem saber que este existe.
   */
  professores: {
    id: 'professores',
    nome: 'Professores',
    descricao:
      'Algumas peças trazem um professor. Encoste dois deles e um poder especial é disparado.',
    criterio: 'pontos',
    terminaAoTransbordar: true,
    limiteDeLinhas: null,
    limiteDeTempoMs: null,
    comProfessores: true,
  },
};

export const MODO_PADRAO = 'maratona';

/** Devolve o modo pelo id, caindo no padrão se o id for desconhecido. */
export function obterModo(id) {
  return MODOS[id] ?? MODOS[MODO_PADRAO];
}

/**
 * A partida acabou?
 * @param {Modo} modo
 * @param {{linhas: number, tempoDecorridoMs: number, transbordou: boolean}} estado
 * @returns {{terminou: boolean, motivo: string|null}}
 */
export function verificarTermino(modo, estado) {
  if (modo.terminaAoTransbordar && estado.transbordou) {
    return { terminou: true, motivo: 'transbordo' };
  }
  if (modo.limiteDeLinhas !== null && estado.linhas >= modo.limiteDeLinhas) {
    return { terminou: true, motivo: 'objetivo' };
  }
  if (modo.limiteDeTempoMs !== null && estado.tempoDecorridoMs >= modo.limiteDeTempoMs) {
    return { terminou: true, motivo: 'tempo' };
  }
  return { terminou: false, motivo: null };
}

/**
 * No modo Zen a pilha não mata, mas precisa ser aliviada, senão o jogo trava.
 * Quando transborda, apagamos as linhas mais altas ocupadas e a partida segue.
 */
export const LINHAS_DE_ALIVIO_ZEN = 4;
