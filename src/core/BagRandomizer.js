/**
 * BagRandomizer.js — Sorteio "7-bag" com semente.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Sortear peça a peça de forma aleatória pura gera sequências cruéis (seis peças S
 * seguidas). O padrão moderno embaralha as sete peças numa "sacola" e distribui uma
 * a uma; quando acaba, embaralha outra sacola. Assim nenhuma peça demora mais de
 * 12 jogadas para aparecer.
 *
 * O gerador usa semente própria em vez de Math.random porque a partida precisa ser
 * REPRODUZÍVEL: mesma semente, mesma sequência de peças. É isso que torna o motor
 * testável de forma determinística e abre caminho para replay no futuro.
 */

import { TIPOS_DE_PECA } from './Tetromino.js';

/**
 * Gerador pseudoaleatório mulberry32: pequeno, rápido e determinístico.
 * Recebe um inteiro de 32 bits e devolve uma função que produz números em [0, 1).
 */
function criarGerador(semente) {
  let estado = semente >>> 0;
  return function proximo() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BagRandomizer {
  /** @param {number} [semente] omitida = sorteada na hora (partida normal) */
  constructor(semente = Math.floor(Math.random() * 0xffffffff)) {
    this.semente = semente >>> 0;
    this.sortear = criarGerador(this.semente);
    this.fila = [];
    this.#reabastecer();
  }

  /** Embaralha uma sacola nova (Fisher-Yates) e a acrescenta ao fim da fila. */
  #reabastecer() {
    const sacola = [...TIPOS_DE_PECA];
    for (let i = sacola.length - 1; i > 0; i--) {
      const j = Math.floor(this.sortear() * (i + 1));
      [sacola[i], sacola[j]] = [sacola[j], sacola[i]];
    }
    this.fila.push(...sacola);
  }

  /** Retira e devolve o próximo tipo de peça. */
  proxima() {
    if (this.fila.length <= TIPOS_DE_PECA.length) this.#reabastecer();
    return this.fila.shift();
  }

  /**
   * Espia as próximas peças sem consumi-las — alimenta o painel "próxima peça".
   * @param {number} quantidade
   */
  espiar(quantidade = 1) {
    while (this.fila.length < quantidade + TIPOS_DE_PECA.length) this.#reabastecer();
    return this.fila.slice(0, quantidade);
  }

  /**
   * Recomeça o sorteio.
   *
   * Sem argumento, sorteia uma SEMENTE NOVA — cada partida recebe uma sequência
   * de peças diferente. A versão anterior tinha `semente = this.semente` como
   * padrão e reusava a semente antiga: o jogo abria com as mesmas sete peças,
   * na mesma ordem, em todas as partidas. Parecia falta de aleatoriedade e era,
   * na verdade, aleatoriedade congelada.
   *
   * Para repetir uma partida de propósito (testes, replay), passe a semente
   * explicitamente.
   *
   * @param {number} [semente]
   */
  reiniciar(semente) {
    this.semente = (semente ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.sortear = criarGerador(this.semente);
    this.fila = [];
    this.#reabastecer();
  }
}
