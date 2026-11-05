/**
 * SettingsStorage.js — Preferências do jogador.
 *
 * CAMADA: persistência.
 * Guarda skin escolhida, volumes, acessibilidade e nome do jogador.
 */

import { LocalStore } from './LocalStore.js';

const CHAVE = 'configuracoes';

/** Valores usados na primeira vez que o jogo abre. */
const PADRAO = {
  nomeDoJogador: '',
  skinDePeca: 'classico',
  skinDeFundo: 'carvao',
  volumeDosEfeitos: 0.7,
  volumeDaTrilha: 0,
  // Acessibilidade
  simbolosNasPecas: false,
  altoContraste: false,
  movimentoReduzido: false,
  tamanhoDoTabuleiro: 'medio', // pequeno | medio | grande
  mostrarFantasma: true,
  modoPreferido: 'maratona',
};

export class SettingsStorage {
  /** @param {LocalStore} [store] */
  constructor(store = new LocalStore()) {
    this.store = store;
    this.valores = { ...PADRAO, ...this.store.ler(CHAVE, {}) };
  }

  /** @param {string} chave */
  obter(chave) {
    return this.valores[chave];
  }

  todas() {
    return { ...this.valores };
  }

  /**
   * Altera uma preferência e salva.
   * @param {string} chave
   * @param {*} valor
   */
  definir(chave, valor) {
    this.valores[chave] = valor;
    return this.store.gravar(CHAVE, this.valores);
  }

  /** Altera várias de uma vez, com uma única gravação. */
  definirVarias(novos) {
    Object.assign(this.valores, novos);
    return this.store.gravar(CHAVE, this.valores);
  }

  /** Volta tudo ao estado de fábrica. */
  restaurarPadrao() {
    this.valores = { ...PADRAO };
    return this.store.gravar(CHAVE, this.valores);
  }

  /**
   * O sistema operacional do jogador pede menos animação?
   * Respeitar essa preferência é requisito de acessibilidade, não enfeite.
   */
  static sistemaPedeMovimentoReduzido() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

export { PADRAO as CONFIGURACOES_PADRAO };
