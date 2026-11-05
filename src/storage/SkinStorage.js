/**
 * SkinStorage.js — Guarda as skins que o jogador monta com fotos próprias.
 *
 * CAMADA: persistência.
 *
 * As fotos são gravadas como dataURL (a imagem inteira codificada em texto).
 * Por isso a galeria SEMPRE reduz a foto para 128x128 antes de chegar aqui:
 * o localStorage costuma parar em torno de 5 MB, e uma única foto de celular
 * em tamanho original já passaria disso.
 */

import { LocalStore } from './LocalStore.js';
import { CORES_PADRAO } from '../render/skins/catalogo.js';
import { TIPOS_DE_PECA } from '../core/Tetromino.js';

const CHAVE = 'skins-personalizadas';

export class SkinStorage {
  /** @param {LocalStore} [store] */
  constructor(store = new LocalStore()) {
    this.store = store;
  }

  /** @returns {Array<object>} skins salvas pelo jogador */
  listar() {
    const salvas = this.store.ler(CHAVE, []);
    return Array.isArray(salvas) ? salvas.filter((skin) => this.#valida(skin)) : [];
  }

  /** Uma skin só é aceita se tiver id e um mapa com as sete peças. */
  #valida(skin) {
    if (!skin || typeof skin !== 'object' || !skin.id || !skin.mapa) return false;
    return TIPOS_DE_PECA.every((tipo) => typeof skin.mapa[tipo] === 'string');
  }

  /**
   * Cria a estrutura de uma skin de imagem a partir das fotos escolhidas.
   *
   * @param {string} nome
   * @param {Record<string, string>} fotos  peça -> dataURL
   * @returns {object} no mesmo formato do catálogo — indistinguível de uma skin embutida
   */
  montar(nome, fotos) {
    const rotulo = (nome || 'Minha skin').trim().slice(0, 32);
    return {
      id: `usuario-${Date.now().toString(36)}`,
      nome: rotulo,
      descricao: 'Skin criada por você com fotos próprias.',
      tipo: 'imagem',
      personalizada: true,
      mapa: Object.fromEntries(
        TIPOS_DE_PECA.map((tipo) => [tipo, fotos[tipo] ?? fotos.padrao ?? '']),
      ),
      // Cores de reserva: enquanto a foto carrega, ou se o dado se perder,
      // o jogo continua jogável com blocos coloridos.
      cores: { ...CORES_PADRAO },
      criadaEm: new Date().toISOString(),
    };
  }

  /**
   * Salva (ou atualiza) uma skin.
   * @returns {{ok: boolean, motivo?: string}} motivo 'cota' significa memória cheia
   */
  salvar(skin) {
    if (!this.#valida(skin)) return { ok: false, motivo: 'invalida' };

    const salvas = this.listar();
    const posicao = salvas.findIndex((outra) => outra.id === skin.id);

    if (posicao >= 0) salvas[posicao] = skin;
    else salvas.push(skin);

    return this.store.gravar(CHAVE, salvas);
  }

  remover(id) {
    const restantes = this.listar().filter((skin) => skin.id !== id);
    return this.store.gravar(CHAVE, restantes);
  }

  /** Quanto espaço as skins estão ocupando — a galeria mostra isso ao jogador. */
  espacoUsadoKb() {
    return this.store.espacoUsadoKb();
  }
}
