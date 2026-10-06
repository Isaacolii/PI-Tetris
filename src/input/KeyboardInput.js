/**
 * KeyboardInput.js — Teclado, com DAS e ARR.
 *
 * CAMADA: entrada.
 *
 * A entrada não conhece o motor do jogo: ela apenas traduz teclas em COMANDOS
 * ('esquerda', 'hardDrop', ...) e entrega a quem contratou. Isso permite que o
 * mesmo comando venha do teclado, dos botões de toque ou, no futuro, de um
 * controle — sem que o jogo saiba a diferença.
 *
 * DAS (Delayed Auto Shift) e ARR (Auto Repeat Rate) são os dois tempos que fazem
 * o movimento lateral parecer natural: segurar a seta espera um instante (DAS) e
 * depois repete rapidamente (ARR). Sem isso, mover a peça de uma ponta à outra
 * exige apertar a tecla dez vezes, e a jogabilidade despenca.
 */

/** Espera antes de a repetição começar, em milissegundos. */
const DAS_MS = 170;

/** Intervalo entre repetições depois que o DAS passa. */
const ARR_MS = 50;

/** Repetição da descida voluntária — mais rápida, porque o jogador quer precisão. */
const ARR_SOFT_DROP_MS = 40;

/**
 * Mapa tecla -> comando.
 * As teclas usam `event.code`, que independe do layout do teclado: em teclado
 * ABNT2 ou americano, `KeyZ` é sempre a tecla física Z.
 */
const MAPA_DE_TECLAS = {
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  ArrowDown: 'softDrop',
  ArrowUp: 'girarHorario',
  KeyX: 'girarHorario',
  KeyZ: 'girarAntiHorario',
  ControlLeft: 'girarAntiHorario',
  Space: 'hardDrop',
  KeyC: 'guardar',
  ShiftLeft: 'guardar',
  ShiftRight: 'guardar',
  KeyP: 'pausa',
  Escape: 'pausa',
  KeyR: 'reiniciar',
};

/** Comandos que repetem enquanto a tecla fica pressionada. */
const COMANDOS_COM_REPETICAO = new Set(['esquerda', 'direita', 'softDrop']);

export class KeyboardInput {
  /**
   * @param {(comando: string) => void} aoComando  recebe cada comando disparado
   * @param {HTMLElement|Document} [alvo]
   */
  constructor(aoComando, alvo = document) {
    this.aoComando = aoComando;
    this.alvo = alvo;

    /** Estado das teclas em repetição: comando -> { tempoSegurado, jaRepetiu } */
    this.segurando = new Map();

    this._aoPressionar = this.#aoPressionar.bind(this);
    this._aoSoltar = this.#aoSoltar.bind(this);
    this._aoPerderFoco = this.#aoPerderFoco.bind(this);

    this.ativo = false;
  }

  /** Passa a escutar o teclado. */
  ligar() {
    if (this.ativo) return;
    this.alvo.addEventListener('keydown', this._aoPressionar);
    this.alvo.addEventListener('keyup', this._aoSoltar);
    window.addEventListener('blur', this._aoPerderFoco);
    this.ativo = true;
  }

  /** Para de escutar e esquece as teclas presas. */
  desligar() {
    if (!this.ativo) return;
    this.alvo.removeEventListener('keydown', this._aoPressionar);
    this.alvo.removeEventListener('keyup', this._aoSoltar);
    window.removeEventListener('blur', this._aoPerderFoco);
    this.segurando.clear();
    this.ativo = false;
  }

  #aoPressionar(evento) {
    // Se o jogador está digitando o nome no ranking, o jogo não pode roubar as teclas.
    if (this.#focoEmCampoDeTexto()) return;

    const comando = MAPA_DE_TECLAS[evento.code];
    if (!comando) return;

    // Impede a página de rolar com as setas e a barra de espaço.
    evento.preventDefault();

    // O navegador repete keydown sozinho enquanto a tecla fica presa; ignoramos
    // essa repetição porque o ritmo é controlado aqui, pelo DAS/ARR.
    if (evento.repeat) return;

    this.aoComando(comando);

    if (COMANDOS_COM_REPETICAO.has(comando)) {
      this.segurando.set(comando, { tempoSegurado: 0, jaRepetiu: false });
    }
  }

  #aoSoltar(evento) {
    const comando = MAPA_DE_TECLAS[evento.code];
    if (comando) this.segurando.delete(comando);
  }

  /** Sair da aba com a tecla presa deixaria a peça andando sozinha na volta. */
  #aoPerderFoco() {
    this.segurando.clear();
  }

  #focoEmCampoDeTexto() {
    const elemento = document.activeElement;
    if (!elemento) return false;
    const etiqueta = elemento.tagName;
    return etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || elemento.isContentEditable;
  }

  /**
   * Faz o tempo correr para as teclas seguradas.
   * Chamado a cada quadro pelo laço principal — pelo mesmo delta que alimenta o motor.
   * @param {number} deltaMs
   */
  atualizar(deltaMs) {
    for (const [comando, estado] of this.segurando) {
      estado.tempoSegurado += deltaMs;

      const intervalo = comando === 'softDrop' ? ARR_SOFT_DROP_MS : ARR_MS;

      if (!estado.jaRepetiu) {
        // Primeira repetição: só depois do atraso inicial.
        if (estado.tempoSegurado >= DAS_MS) {
          estado.jaRepetiu = true;
          estado.tempoSegurado = 0;
          this.aoComando(comando);
        }
      } else if (estado.tempoSegurado >= intervalo) {
        // Depois do DAS, repete no ritmo do ARR. O laço cobre o caso de um quadro
        // demorado ter acumulado tempo para mais de uma repetição.
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
      { acao: 'Mover', teclas: '← →' },
      { acao: 'Descer', teclas: '↓' },
      { acao: 'Queda instantânea', teclas: 'Espaço' },
      { acao: 'Girar horário', teclas: '↑ ou X' },
      { acao: 'Girar anti-horário', teclas: 'Z' },
      { acao: 'Guardar peça', teclas: 'C ou Shift' },
      { acao: 'Pausar', teclas: 'P ou Esc' },
      { acao: 'Reiniciar', teclas: 'R' },
    ];
  }
}
