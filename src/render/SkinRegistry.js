/**
 * SkinRegistry.js — Qual aparência está ativa agora.
 *
 * CAMADA: renderização.
 *
 * É a peça central da troca de skins. Guarda a skin escolhida (de peças e de
 * fundo), monta os pintores correspondentes e avisa quem estiver interessado
 * quando algo muda — permitindo trocar a aparência NO MEIO DA PARTIDA, sem
 * reiniciar nada e sem que o motor do jogo tome conhecimento.
 *
 * O registro conhece três origens de skin:
 *   1. as embutidas em skins/catalogo.js;
 *   2. as que o jogador monta enviando as próprias fotos;
 *   3. as que forem acrescentadas ao catálogo no futuro (os rostos da turma).
 * Para o restante do sistema, as três são indistinguíveis.
 */

import {
  SKINS_DE_PECA,
  SKINS_DE_FUNDO,
  CORES_PADRAO,
  SIMBOLOS_DE_PECA,
  SKIN_DE_PECA_PADRAO,
  SKIN_DE_FUNDO_PADRAO,
  visualDoProfessor,
} from './skins/catalogo.js';
import { criarPintor } from './BlockPainter.js';
import { TIPOS_DE_PECA } from '../core/Tetromino.js';

export class SkinRegistry {
  /** @param {import('./AssetLoader.js').AssetLoader} carregador */
  constructor(carregador) {
    this.carregador = carregador;

    /** Skins montadas pelo jogador com fotos próprias. @type {Map<string, object>} */
    this.skinsPersonalizadas = new Map();

    /** @type {Function[]} */
    this._ouvintes = [];

    /** Pintores prontos da skin ativa, um por tipo de peça. */
    this._pintores = new Map();

    /** Acessibilidade: desenhar o símbolo de cada peça dentro do bloco. */
    this.mostrarSimbolos = false;

    this.skinDePecaAtiva = SKINS_DE_PECA[SKIN_DE_PECA_PADRAO];
    this.skinDeFundoAtiva = SKINS_DE_FUNDO[SKIN_DE_FUNDO_PADRAO];
    this.#reconstruirPintores();
  }

  // ───────────────────────────── Avisos de mudança ─────────────────────────────

  /**
   * Inscreve quem precisa redesenhar quando a aparência muda.
   * @param {Function} ouvinte
   * @returns {Function} cancela a inscrição
   */
  aoMudar(ouvinte) {
    this._ouvintes.push(ouvinte);
    return () => {
      const posicao = this._ouvintes.indexOf(ouvinte);
      if (posicao >= 0) this._ouvintes.splice(posicao, 1);
    };
  }

  #avisar() {
    for (const ouvinte of this._ouvintes) ouvinte(this);
  }

  // ───────────────────────────── Catálogo ─────────────────────────────

  /** Todas as skins de peça disponíveis: as embutidas mais as do jogador. */
  skinsDePecaDisponiveis() {
    return [...Object.values(SKINS_DE_PECA), ...this.skinsPersonalizadas.values()];
  }

  skinsDeFundoDisponiveis() {
    return Object.values(SKINS_DE_FUNDO);
  }

  /** Procura uma skin de peça por id, em qualquer das origens. */
  obterSkinDePeca(id) {
    return SKINS_DE_PECA[id] ?? this.skinsPersonalizadas.get(id) ?? null;
  }

  /**
   * Registra (ou atualiza) uma skin montada com fotos do jogador.
   * @param {object} skin  mesmo formato do catálogo, com tipo 'imagem'
   */
  registrarSkinPersonalizada(skin) {
    this.skinsPersonalizadas.set(skin.id, skin);
    // Se a skin editada é justamente a que está em uso, refaz os pintores.
    if (this.skinDePecaAtiva?.id === skin.id) {
      this.skinDePecaAtiva = skin;
      this.#reconstruirPintores();
    }
    this.#avisar();
  }

  /** Remove uma skin do jogador; se estava em uso, volta para a padrão. */
  removerSkinPersonalizada(id) {
    this.skinsPersonalizadas.delete(id);
    if (this.skinDePecaAtiva?.id === id) this.definirSkinDePeca(SKIN_DE_PECA_PADRAO);
    else this.#avisar();
  }

  // ───────────────────────────── Troca de skin ─────────────────────────────

  /**
   * Troca a aparência das peças. Pode ser chamado a qualquer momento, inclusive
   * com a partida em andamento — é literalmente uma linha para trocar tudo.
   * @param {string} id
   */
  definirSkinDePeca(id) {
    const skin = this.obterSkinDePeca(id);
    if (!skin) {
      console.warn(`[SkinRegistry] Skin de peça desconhecida: ${id}`);
      return false;
    }

    this.skinDePecaAtiva = skin;
    this.#reconstruirPintores();
    this.#avisar();

    // Skins de imagem carregam em segundo plano; quando chegarem, avisamos de novo
    // para que a tela seja redesenhada já com as fotos.
    if (skin.tipo === 'imagem') {
      this.#precarregarImagens(skin).then(() => this.#avisar());
    }
    return true;
  }

  /** @param {string} id */
  definirSkinDeFundo(id) {
    const skin = SKINS_DE_FUNDO[id];
    if (!skin) {
      console.warn(`[SkinRegistry] Skin de fundo desconhecida: ${id}`);
      return false;
    }
    this.skinDeFundoAtiva = skin;
    this.#avisar();

    if (skin.tipo === 'imagem' && skin.caminho) {
      this.carregador.carregar(skin.caminho).then(() => this.#avisar());
    }
    return true;
  }

  /** Liga ou desliga os símbolos de acessibilidade dentro dos blocos. */
  definirSimbolos(ativo) {
    this.mostrarSimbolos = Boolean(ativo);
    this.#avisar();
  }

  // ───────────────────────────── Uso pelo renderizador ─────────────────────────────

  /**
   * O pintor da peça indicada. É por aqui que o CanvasRenderer desenha cada bloco,
   * sem nunca perguntar se a aparência é cor, textura ou foto.
   * @param {string} tipoDePeca
   */
  pintorPara(tipoDePeca) {
    return this._pintores.get(tipoDePeca) ?? this._pintores.get('I');
  }

  /** Símbolo de acessibilidade da peça, ou null quando o modo está desligado. */
  simboloPara(tipoDePeca) {
    return this.mostrarSimbolos ? (SIMBOLOS_DE_PECA[tipoDePeca] ?? null) : null;
  }

  /**
   * Aparência de um professor especial, pronta para o pintor usar.
   *
   * A caricatura é opcional: enquanto não existir arquivo, `imagem` vem null e
   * o distintivo é desenhado como disco colorido com a letra. O carregamento é
   * disparado aqui e, quando a imagem chega, os ouvintes são avisados para
   * redesenhar — o mesmo mecanismo das skins de peça.
   */
  visualDoProfessor(id) {
    const visual = visualDoProfessor(id);
    if (!visual.caricatura) return { ...visual, imagem: null };

    const imagem = this.carregador.obter(visual.caricatura);
    if (!imagem && !this.carregador.falhas.has(visual.caricatura)) {
      this.carregador.carregar(visual.caricatura).then(() => this.#avisar());
    }

    return { ...visual, imagem };
  }

  /** Cor representativa da peça — usada pela interface (legendas, gráficos). */
  corRepresentativa(tipoDePeca) {
    const skin = this.skinDePecaAtiva;
    if (skin.tipo === 'cor') return skin.mapa[tipoDePeca] ?? CORES_PADRAO[tipoDePeca];
    return skin.cores?.[tipoDePeca] ?? CORES_PADRAO[tipoDePeca];
  }

  // ───────────────────────────── Internos ─────────────────────────────

  #reconstruirPintores() {
    this._pintores.clear();
    for (const tipo of TIPOS_DE_PECA) {
      this._pintores.set(
        tipo,
        criarPintor(this.skinDePecaAtiva, tipo, this.carregador, CORES_PADRAO[tipo]),
      );
    }
  }

  #precarregarImagens(skin) {
    const caminhos = TIPOS_DE_PECA.map((tipo) => skin.mapa?.[tipo]).filter(Boolean);
    return this.carregador.carregarVarias(caminhos);
  }

  /** Estado a persistir entre sessões. */
  preferencias() {
    return {
      skinDePeca: this.skinDePecaAtiva.id,
      skinDeFundo: this.skinDeFundoAtiva.id,
      simbolos: this.mostrarSimbolos,
    };
  }

  /** Restaura o que foi salvo, ignorando silenciosamente ids que não existem mais. */
  aplicarPreferencias(preferencias = {}) {
    if (preferencias.skinDePeca) this.definirSkinDePeca(preferencias.skinDePeca);
    if (preferencias.skinDeFundo) this.definirSkinDeFundo(preferencias.skinDeFundo);
    if (typeof preferencias.simbolos === 'boolean') this.definirSimbolos(preferencias.simbolos);
  }
}
