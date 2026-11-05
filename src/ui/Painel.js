/**
 * Painel.js — Abrir e fechar os painéis sobrepostos.
 *
 * CAMADA: interface.
 *
 * Não usamos o elemento <dialog> nativo: ele tem comportamento inconsistente
 * entre navegadores e, em ambientes de teste automatizado, nem sempre dispara
 * os eventos de fechamento. Um contêiner comum com [hidden] é previsível,
 * testável e nos deixa controlar o foco do jeito certo.
 *
 * Cuidados de acessibilidade implementados aqui:
 *   • Esc fecha;
 *   • clique fora fecha;
 *   • o foco vai para dentro do painel ao abrir e volta ao botão de origem ao fechar;
 *   • Tab circula dentro do painel enquanto ele está aberto (armadilha de foco).
 */

/** Seletor dos elementos que podem receber foco. */
const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export class Painel {
  /** @param {HTMLElement} elemento */
  constructor(elemento) {
    this.elemento = elemento;
    this.caixa = elemento.querySelector('.painel__caixa');
    this.aberto = false;
    this._elementoAnterior = null;
    this._aoFechar = [];

    this._aoTeclar = this.#aoTeclar.bind(this);

    // Clique no fundo escuro (fora da caixa) fecha.
    elemento.addEventListener('pointerdown', (evento) => {
      if (evento.target === elemento) this.fechar();
    });

    // Qualquer botão marcado com data-fechar fecha este painel.
    elemento.querySelectorAll('[data-fechar]').forEach((botao) => {
      botao.addEventListener('click', () => this.fechar());
    });
  }

  abrir() {
    if (this.aberto) return;

    this._elementoAnterior = document.activeElement;
    this.elemento.hidden = false;
    this.aberto = true;

    document.addEventListener('keydown', this._aoTeclar);

    // Foco no primeiro elemento útil do painel, para quem usa teclado ou leitor de tela.
    const primeiro = this.caixa?.querySelector(FOCAVEIS);
    primeiro?.focus();
  }

  fechar() {
    if (!this.aberto) return;

    this.elemento.hidden = true;
    this.aberto = false;

    document.removeEventListener('keydown', this._aoTeclar);

    // Devolve o foco a quem abriu o painel.
    this._elementoAnterior?.focus?.();
    this._elementoAnterior = null;

    for (const ouvinte of this._aoFechar) ouvinte();
  }

  alternar() {
    if (this.aberto) this.fechar();
    else this.abrir();
  }

  /** Registra algo para rodar quando o painel fechar (retomar a partida, por exemplo). */
  aoFechar(ouvinte) {
    this._aoFechar.push(ouvinte);
  }

  #aoTeclar(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.fechar();
      return;
    }

    if (evento.key !== 'Tab') return;

    // Armadilha de foco: sem isso, o Tab escapa para a página atrás do painel.
    const focaveis = [...(this.caixa?.querySelectorAll(FOCAVEIS) ?? [])].filter(
      (elemento) => elemento.offsetParent !== null,
    );
    if (focaveis.length === 0) return;

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }
}

/**
 * Encontra os painéis da página e liga os botões que os abrem
 * (qualquer elemento com data-abrir="id-do-painel").
 *
 * @returns {Map<string, Painel>}
 */
export function ligarPaineis() {
  const paineis = new Map();

  document.querySelectorAll('.painel').forEach((elemento) => {
    paineis.set(elemento.id, new Painel(elemento));
  });

  document.querySelectorAll('[data-abrir]').forEach((gatilho) => {
    gatilho.addEventListener('click', () => {
      paineis.get(gatilho.dataset.abrir)?.abrir();
    });
  });

  return paineis;
}

/**
 * Mensagem curta no rodapé (salvo, importado, erro).
 * @param {string} texto
 * @param {number} duracaoMs
 */
export function notificar(texto, duracaoMs = 2600) {
  const elemento = document.getElementById('notificacao');
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.hidden = false;

  clearTimeout(notificar._relogio);
  notificar._relogio = setTimeout(() => {
    elemento.hidden = true;
  }, duracaoMs);
}
