/**
 * GamepadInput.js — controle de videogame.
 *
 * CAMADA: entrada. Devolve o NOME da ação, nunca o botão — exatamente como o
 * teclado. Para o resto do jogo, teclado e controle são indistinguíveis.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE ISTO É CONSULTADO A CADA QUADRO, E NÃO POR EVENTO
 *
 *  O navegador não avisa quando um botão é pressionado. A API de controles é
 *  de LEITURA: a cada quadro você pergunta o estado atual e compara com o que
 *  leu antes. Não existe `addEventListener('buttondown')`.
 *
 *  Por isso esta classe tem `atualizar(deltaMs)` e precisa ser chamada pelo
 *  laço principal. Se ninguém chamar, o controle simplesmente não responde —
 *  e não há erro nenhum para denunciar isso.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O ritmo de repetição vem do teclado de propósito: um jogador no controle e
 * outro no teclado precisam mover a peça na MESMA velocidade, senão o duelo é
 * decidido pelo periférico e não por quem joga melhor.
 */

import { DAS_MS, ARR_MS, ARR_SOFT_DROP_MS, COMANDOS_COM_REPETICAO } from './KeyboardInput.js';

/**
 * Botões do layout "standard", que é o que Xbox, PlayStation e a maioria dos
 * genéricos relatam. O índice é posicional: o botão 0 é o de baixo do losango
 * (A no Xbox, X no PlayStation), independentemente do que está escrito nele.
 */
export const MAPA_DE_BOTOES = {
  0: 'girarHorario',        // A  / X
  1: 'girarAntiHorario',    // B  / ◯
  2: 'alvo',                // X  / □
  3: 'hardDrop',            // Y  / △
  4: 'guardar',             // LB / L1
  5: 'guardar',             // RB / R1
  9: 'pausa',               // Start / Options
  12: 'hardDrop',           // direcional ↑
  13: 'softDrop',           // direcional ↓
  14: 'esquerda',           // direcional ←
  15: 'direita',            // direcional →
};

/**
 * Zona morta do analógico.
 *
 * Analógico em repouso raramente marca zero — fica tremendo perto dele. Sem
 * essa margem, a peça anda sozinha com o controle largado na mesa, que é
 * exatamente o tipo de defeito que aparece na hora da apresentação.
 */
const ZONA_MORTA = 0.55;

export class GamepadInput {
  /**
   * @param {(comando: string) => void} aoComando
   * @param {Object} [opcoes]
   * @param {number} [opcoes.indice]  qual controle: 0 é o primeiro conectado
   */
  constructor(aoComando, { indice = 0, lerControles = null } = {}) {
    this.aoComando = aoComando;
    this.indice = indice;

    /*
     * De onde vêm os controles.
     *
     * Por padrão é o navegador. Poder trocar essa fonte é o que permite provar
     * no terminal que segurar o direcional repete no ritmo certo e que o
     * analógico respeita a zona morta — sem isso, a única forma de verificar
     * seria alguém com um controle na mão, e defeito de entrada não aparece
     * olhando.
     */
    this.lerControles =
      lerControles ??
      (() =>
        typeof navigator !== 'undefined' && navigator.getGamepads
          ? navigator.getGamepads()
          : null);

    /** Comandos que estavam pressionados no quadro anterior. */
    this.pressionadosAntes = new Set();

    /** Estado da repetição: comando -> { tempoSegurado, jaRepetiu } */
    this.segurando = new Map();

    this.ativo = false;
    this.conectado = false;
  }

  ligar() {
    this.ativo = true;
  }

  desligar() {
    this.ativo = false;
    this.pressionadosAntes.clear();
    this.segurando.clear();
  }

  /** O controle deste índice está plugado agora? */
  get disponivel() {
    return this.#lerControle() !== null;
  }

  /** Nome que o navegador dá ao aparelho — serve para a tela de controles. */
  get nome() {
    return this.#lerControle()?.id ?? null;
  }

  #lerControle() {
    // getGamepads devolve um vetor com buracos: desconectar o primeiro
    // controle deixa a posição 0 nula sem reorganizar as outras.
    const controles = this.lerControles();
    return controles?.[this.indice] ?? null;
  }

  /**
   * Lê o controle e dispara o que mudou desde o quadro anterior.
   * @param {number} deltaMs  o MESMO delta do motor
   */
  atualizar(deltaMs) {
    if (!this.ativo) return;

    const controle = this.#lerControle();

    // Desconectou no meio da partida: solta tudo o que estava pressionado, em
    // vez de deixar a peça andando para sempre numa direção.
    if (!controle) {
      if (this.conectado) {
        this.conectado = false;
        this.pressionadosAntes.clear();
        this.segurando.clear();
      }
      return;
    }
    this.conectado = true;

    const agora = this.#comandosPressionados(controle);

    // Pressionado agora e não antes = apertou neste quadro.
    for (const comando of agora) {
      if (this.pressionadosAntes.has(comando)) continue;

      this.aoComando(comando);
      if (COMANDOS_COM_REPETICAO.has(comando)) {
        this.segurando.set(comando, { tempoSegurado: 0, jaRepetiu: false });
      }
    }

    // Estava antes e não está agora = soltou.
    for (const comando of this.pressionadosAntes) {
      if (!agora.has(comando)) this.segurando.delete(comando);
    }

    this.pressionadosAntes = agora;
    this.#avancarRepeticao(deltaMs);
  }

  /** @returns {Set<string>} comandos ativos neste instante */
  #comandosPressionados(controle) {
    const ativos = new Set();

    controle.buttons.forEach((botao, indice) => {
      // `pressed` não existe em todo navegador antigo; o valor analógico do
      // gatilho serve de reserva.
      const apertado = botao?.pressed ?? botao?.value > 0.5;
      if (!apertado) return;

      const comando = MAPA_DE_BOTOES[indice];
      if (comando) ativos.add(comando);
    });

    // Analógico esquerdo, com a mesma leitura do direcional.
    const [horizontal = 0, vertical = 0] = controle.axes ?? [];
    if (horizontal <= -ZONA_MORTA) ativos.add('esquerda');
    if (horizontal >= ZONA_MORTA) ativos.add('direita');
    if (vertical >= ZONA_MORTA) ativos.add('softDrop');
    if (vertical <= -ZONA_MORTA) ativos.add('hardDrop');

    return ativos;
  }

  /** Faz o tempo correr para os comandos segurados — cópia fiel do teclado. */
  #avancarRepeticao(deltaMs) {
    for (const [comando, estado] of this.segurando) {
      estado.tempoSegurado += deltaMs;

      const intervalo = comando === 'softDrop' ? ARR_SOFT_DROP_MS : ARR_MS;

      if (!estado.jaRepetiu) {
        if (estado.tempoSegurado >= DAS_MS) {
          estado.jaRepetiu = true;
          estado.tempoSegurado = 0;
          this.aoComando(comando);
        }
      } else if (estado.tempoSegurado >= intervalo) {
        while (estado.tempoSegurado >= intervalo) {
          estado.tempoSegurado -= intervalo;
          this.aoComando(comando);
        }
      }
    }
  }

  /** Lista legível dos controles — alimenta a tela de ajuda. */
  static descricaoDosControles() {
    return [
      { acao: 'Mover', teclas: 'Direcional ← → ou analógico' },
      { acao: 'Descer', teclas: 'Direcional ↓' },
      { acao: 'Queda instantânea', teclas: 'Y / △ ou direcional ↑' },
      { acao: 'Girar horário', teclas: 'A / X' },
      { acao: 'Girar anti-horário', teclas: 'B / ◯' },
      { acao: 'Guardar peça', teclas: 'LB / RB' },
      { acao: 'Mirar no adversário', teclas: 'X / □' },
      { acao: 'Pausar', teclas: 'Start / Options' },
    ];
  }

  /**
   * Quantos controles estão plugados agora.
   * A tela de escolha de modo usa isto para dizer o que está disponível.
   */
  static quantidadeConectada() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return 0;
    return Array.from(navigator.getGamepads() ?? []).filter(Boolean).length;
  }
}
