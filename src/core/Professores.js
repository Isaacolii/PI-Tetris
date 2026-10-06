/**
 * Professores.js — Identidade dos cinco professores especiais.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Mesma regra que vale para as peças vale aqui: este arquivo guarda apenas
 * IDENTIDADE — quem é o professor e qual é o tema dele. Cor, ícone e caricatura
 * são decisão exclusiva de src/render/. Trocar a aparência dos professores não
 * encosta em nenhuma linha deste arquivo.
 *
 * Os nomes ainda são provisórios (A a E). Quando os nomes reais forem definidos,
 * basta alterar o campo `nome` — nenhum outro arquivo depende dele.
 */

/** Identificadores dos professores. A ordem define a ordem na legenda. */
export const IDS_DE_PROFESSOR = ['A', 'B', 'C', 'D', 'E'];

/**
 * @typedef {Object} Professor
 * @property {string} id
 * @property {string} nome        rótulo mostrado ao jogador (provisório)
 * @property {string} tema        a que família de efeito ele pertence
 * @property {string} descricao   o que faz quando age sozinho
 */

/**
 * Os cinco professores.
 *
 * Os ids continuam sendo as letras A–E: eles são a chave usada pelo tabuleiro,
 * pela tabela de combinações e pelos arquivos salvos. Trocar um NOME não afeta
 * nada além do que aparece na tela — o que é justamente o ponto de separar
 * identificador de rótulo.
 *
 * @type {Record<string, Professor>}
 */
export const PROFESSORES = {
  A: {
    id: 'A',
    nome: 'Alexandro',
    tema: 'Explosão',
    descricao: 'Destrói a área ao redor.',
  },
  B: {
    id: 'B',
    nome: 'Caetano',
    tema: 'Linha',
    descricao: 'Age no sentido horizontal.',
  },
  C: {
    id: 'C',
    nome: 'Jhonatta',
    tema: 'Coluna',
    descricao: 'Age no sentido vertical.',
  },
  D: {
    id: 'D',
    nome: 'Fabricio',
    tema: 'Conversão',
    descricao: 'Preenche os buracos da pilha.',
  },
  E: {
    id: 'E',
    nome: 'Tadeu',
    tema: 'Tempo',
    descricao: 'Altera a velocidade da queda.',
  },
};

/** Busca por id, devolvendo null em vez de estourar. */
export function obterProfessor(id) {
  return PROFESSORES[id] ?? null;
}

/**
 * Chave canônica de um par de professores.
 *
 * Ordena os dois ids antes de juntar, então A+B e B+A produzem a MESMA chave.
 * Sem isso, a tabela de poderes precisaria de 25 entradas em vez de 15, e a
 * metade delas seria cópia da outra — fonte garantida de divergência.
 *
 * @returns {string} por exemplo 'A|B'
 */
export function chaveDoPar(primeiro, segundo) {
  return [primeiro, segundo].sort().join('|');
}

/** Todos os pares possíveis, sem repetir A+B e B+A. Usado nos testes e na legenda. */
export function todosOsPares() {
  const pares = [];
  for (let i = 0; i < IDS_DE_PROFESSOR.length; i++) {
    for (let j = i; j < IDS_DE_PROFESSOR.length; j++) {
      pares.push([IDS_DE_PROFESSOR[i], IDS_DE_PROFESSOR[j]]);
    }
  }
  return pares;
}
