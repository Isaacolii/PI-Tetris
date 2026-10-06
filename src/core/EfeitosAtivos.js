/**
 * EfeitosAtivos.js — Efeitos com duração, como a lentidão do Professor E.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Os efeitos duram um NÚMERO DE PEÇAS, não uma quantidade de segundos. A razão
 * é jogabilidade: "as próximas 3 peças caem devagar" é uma promessa que o
 * jogador consegue verificar olhando o tabuleiro. Um efeito medido em segundos
 * expiraria no meio de um encaixe, sem aviso, e pareceria bug.
 *
 * Como consequência, este módulo não precisa de relógio nenhum — outro pedaço
 * do jogo que roda igual no navegador e no terminal.
 */

export class EfeitosAtivos {
  constructor() {
    this.limpar();
  }

  limpar() {
    /** @type {Map<string, object>} um efeito por id; um novo substitui o anterior */
    this.ativos = new Map();
  }

  /**
   * Liga um efeito, ou renova o que já estava valendo.
   *
   * Renovar em vez de acumular é deliberado: dois poderes de lentidão seguidos
   * dão mais TEMPO de lentidão, nunca uma lentidão mais forte. Acumular
   * multiplicadores travaria a peça no ar.
   *
   * @param {{id: string, nome: string, pecasRestantes: number}} efeito
   */
  registrar(efeito) {
    if (!efeito?.id) return null;

    const existente = this.ativos.get(efeito.id);
    if (existente) {
      existente.pecasRestantes = Math.max(existente.pecasRestantes, efeito.pecasRestantes);
      return existente;
    }

    const novo = { ...efeito };
    this.ativos.set(efeito.id, novo);
    return novo;
  }

  /**
   * Marca a passagem de uma peça. Chamado quando uma peça é fixada.
   * @returns {object[]} os efeitos que acabaram agora
   */
  consumirUmaPeca() {
    const expirados = [];

    for (const [id, efeito] of this.ativos) {
      efeito.pecasRestantes -= 1;
      if (efeito.pecasRestantes <= 0) {
        this.ativos.delete(id);
        expirados.push(efeito);
      }
    }

    return expirados;
  }

  /** Um efeito está valendo agora? */
  estaAtivo(id) {
    return this.ativos.has(id);
  }

  /**
   * Multiplicador combinado da velocidade de queda.
   * 1 = velocidade normal; 2,5 = intervalo 2,5 vezes maior (mais lento).
   */
  multiplicadorDeQueda() {
    let multiplicador = 1;
    for (const efeito of this.ativos.values()) {
      if (efeito.multiplicadorDeQueda) multiplicador *= efeito.multiplicadorDeQueda;
    }
    return multiplicador;
  }

  /** Lista para o HUD mostrar o que está valendo. */
  listar() {
    return [...this.ativos.values()].map((efeito) => ({
      id: efeito.id,
      nome: efeito.nome,
      pecasRestantes: efeito.pecasRestantes,
    }));
  }
}
