/**
 * catalogo.js — Catálogo declarativo de aparências.
 *
 * CAMADA: renderização.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE É O ARQUIVO QUE TORNA O PROJETO ESCALÁVEL VISUALMENTE.
 *
 *  O núcleo do jogo (src/core/) guarda apenas o IDENTIFICADOR de cada peça:
 *  'I', 'O', 'T', 'S', 'Z', 'J', 'L'. Ele não sabe o que é cor nem imagem.
 *  É aqui — e só aqui — que esse identificador ganha aparência.
 *
 *  Para trocar os blocos coloridos por fotos de rostos, NÃO se mexe em nenhum
 *  arquivo de lógica: acrescenta-se uma entrada com tipo 'imagem' neste catálogo.
 *  O passo a passo completo está em docs/TROCAR-SKINS.md.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} SkinDePeca
 * @property {string} id
 * @property {string} nome         rótulo mostrado na galeria
 * @property {string} descricao
 * @property {'cor'|'padrao'|'imagem'} tipo   qual pintor será usado
 * @property {Record<string, string>} mapa    peça -> cor, nome de padrão ou caminho de imagem
 * @property {Record<string, string>} [cores] cores de reserva (usadas enquanto a imagem carrega)
 */

/** Cores oficiais do Tetris Guideline — servem de reserva para todas as demais skins. */
/*
 * O cinza do lixo entra na tabela padrão de cores, e não em cada skin: assim
 * toda skin — inclusive as que o jogador criar com fotos — recebe uma cor
 * legível para o lixo sem precisar declarar nada.
 */
export const CORES_PADRAO = {
  LIXO: '#6b7280',
  I: '#31c7ef',
  O: '#f7d308',
  T: '#ad4d9c',
  S: '#42b642',
  Z: '#ef2029',
  J: '#5a65ad',
  L: '#ef7921',
};

/**
 * Símbolo desenhado dentro de cada peça no modo daltônico.
 *
 * Repare que isto vive na camada de renderização: o núcleo não sabe que existe
 * acessibilidade, e não precisa saber. É a arquitetura se pagando.
 */
export const SIMBOLOS_DE_PECA = {
  I: '│',
  O: '■',
  T: '▲',
  S: 'S',
  Z: 'Z',
  J: '◤',
  L: '◥',
};

/** @type {Record<string, SkinDePeca>} */
export const SKINS_DE_PECA = {
  classico: {
    id: 'classico',
    nome: 'Clássico',
    descricao: 'As cores oficiais do Tetris, como no arcade.',
    tipo: 'cor',
    mapa: { ...CORES_PADRAO },
  },

  neon: {
    id: 'neon',
    nome: 'Neon',
    descricao: 'Cores saturadas com brilho, sobre fundo escuro.',
    tipo: 'cor',
    mapa: {
      I: '#00f0ff',
      O: '#ffe600',
      T: '#ff00e1',
      S: '#00ff85',
      Z: '#ff2d55',
      J: '#3d5afe',
      L: '#ff9100',
    },
  },

  pastel: {
    id: 'pastel',
    nome: 'Pastel',
    descricao: 'Tons suaves, mais confortáveis para partidas longas.',
    tipo: 'cor',
    mapa: {
      I: '#a8dadc',
      O: '#ffe8a3',
      T: '#cdb4db',
      S: '#b7e4c7',
      Z: '#ffb3c1',
      J: '#a2c4f0',
      L: '#ffd5a5',
    },
  },

  retro: {
    id: 'retro',
    nome: 'Retrô 8-bit',
    descricao: 'Blocos com textura desenhada, no espírito dos consoles antigos.',
    tipo: 'padrao',
    mapa: {
      I: 'listrado',
      O: 'xadrez',
      T: 'pontilhado',
      S: 'diagonal',
      Z: 'diagonal-inversa',
      J: 'moldura',
      L: 'cruz',
    },
    cores: { ...CORES_PADRAO },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // EXEMPLO DE SKIN COM IMAGENS — é assim que os rostos entram no jogo.
  //
  // Está comentada porque a pasta assets/skins/ ainda não tem os arquivos, e
  // uma skin apontando para imagem inexistente apareceria quebrada na galeria.
  //
  // Para ativar: coloque sete PNGs quadrados em assets/skins/ e descomente.
  // Nenhum outro arquivo do projeto precisa mudar.
  // ───────────────────────────────────────────────────────────────────────────
  //
  // turma: {
  //   id: 'turma',
  //   nome: 'A Turma',
  //   descricao: 'Cada peça é o rosto de um integrante do grupo.',
  //   tipo: 'imagem',
  //   mapa: {
  //     I: 'assets/skins/ana.png',
  //     O: 'assets/skins/bruno.png',
  //     T: 'assets/skins/carla.png',
  //     S: 'assets/skins/diego.png',
  //     Z: 'assets/skins/elisa.png',
  //     J: 'assets/skins/felipe.png',
  //     L: 'assets/skins/gabriela.png',
  //   },
  //   // Enquanto as imagens carregam (ou se alguma falhar), estas cores entram
  //   // no lugar. O jogo nunca fica com blocos invisíveis.
  //   cores: { ...CORES_PADRAO },
  // },
};

/**
 * @typedef {Object} SkinDeFundo
 * @property {string} id
 * @property {string} nome
 * @property {'solido'|'gradiente'|'grade'|'imagem'} tipo
 * @property {string[]} [cores]     usado por 'solido' e 'gradiente'
 * @property {string} [caminho]     usado por 'imagem'
 */

/** @type {Record<string, SkinDeFundo>} */
export const SKINS_DE_FUNDO = {
  carvao: {
    id: 'carvao',
    nome: 'Carvão',
    tipo: 'solido',
    cores: ['#12141c'],
  },
  aurora: {
    id: 'aurora',
    nome: 'Aurora',
    tipo: 'gradiente',
    cores: ['#0f2027', '#203a43', '#2c5364'],
  },
  crepusculo: {
    id: 'crepusculo',
    nome: 'Crepúsculo',
    tipo: 'gradiente',
    cores: ['#232526', '#414345'],
  },
  ameixa: {
    id: 'ameixa',
    nome: 'Ameixa',
    tipo: 'gradiente',
    cores: ['#2b1055', '#7597de'],
  },
  grade: {
    id: 'grade',
    nome: 'Grade técnica',
    tipo: 'grade',
    cores: ['#0d0f16', '#1e2430'],
  },

  // Fundo por imagem segue o mesmo princípio das peças. Descomente e aponte
  // para um arquivo em assets/ para usar uma foto como plano de fundo.
  //
  // foto: {
  //   id: 'foto',
  //   nome: 'Foto da turma',
  //   tipo: 'imagem',
  //   caminho: 'assets/skins/fundo-turma.jpg',
  //   cores: ['#12141c'],
  // },
};

export const SKIN_DE_PECA_PADRAO = 'classico';
export const SKIN_DE_FUNDO_PADRAO = 'carvao';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  APARÊNCIA DOS PROFESSORES ESPECIAIS
 *
 *  Mesmo princípio das peças: o núcleo do jogo guarda só o identificador do
 *  professor ('A'..'E'), e é aqui — e só aqui — que ele ganha cor e símbolo.
 *
 *  Quando as caricaturas ficarem prontas, basta preencher o campo `caricatura`
 *  com o caminho do arquivo. O desenho passa a usar a imagem, e nenhum arquivo
 *  de lógica muda. Enquanto isso, cada professor é uma cor e uma letra.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/*
 * As bombas dos professores.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A COR AQUI E A COR DA BOMBA TÊM DE SER A MESMA.
 *
 * Ela não é só decoração do distintivo: é ela que pinta a onda de choque, os
 * estilhaços e o anúncio da combinação. Se o arquivo de um professor for
 * trocado por outro de cor diferente, a explosão dele passa a sair numa cor
 * que não existe em lugar nenhum da tela.
 *
 * Para reatribuir qual bomba é de quem, basta renomear os arquivos da pasta
 * assets/professores — e ajustar a cor correspondente nesta tabela.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const PROFESSORES_VISUAL = {
  A: {
    cor: '#ff5252',
    simbolo: 'A',
    caricatura: 'assets/professores/prof-a.png',
    ampliada: 'assets/professores/prof-a-grande.jpg',
  },
  B: {
    cor: '#40c4ff',
    simbolo: 'B',
    caricatura: 'assets/professores/prof-b.png',
    ampliada: 'assets/professores/prof-b-grande.jpg',
  },
  // Era verde; passou a laranja para acompanhar a bomba do Jhonatta. Verde não
  // existe entre as cinco bombas, e marca de uma cor com explosão de outra é o
  // tipo de incoerência que ninguém consegue desver.
  C: {
    cor: '#ff9533',
    simbolo: 'C',
    caricatura: 'assets/professores/prof-c.png',
    ampliada: 'assets/professores/prof-c-grande.jpg',
  },
  D: {
    cor: '#ffd740',
    simbolo: 'D',
    caricatura: 'assets/professores/prof-d.png',
    ampliada: 'assets/professores/prof-d-grande.jpg',
  },
  E: {
    cor: '#b388ff',
    simbolo: 'E',
    caricatura: 'assets/professores/prof-e.png',
    ampliada: 'assets/professores/prof-e-grande.jpg',
  },
};

// Para usar caricaturas, coloque sete arquivos quadrados em assets/professores/
// e troque as linhas acima por algo assim:
//
//   A: { cor: '#ff5252', simbolo: 'A', caricatura: 'assets/professores/prof-a.png' },
//
// A cor continua sendo usada como reserva enquanto a imagem carrega.

/** Aparência de um professor, com reserva segura caso o id não exista. */
export function visualDoProfessor(id) {
  return (
    PROFESSORES_VISUAL[id] ?? { cor: '#ffffff', simbolo: '?', caricatura: null, ampliada: null }
  );
}
