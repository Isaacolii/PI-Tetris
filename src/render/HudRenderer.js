/**
 * HudRenderer.js — Placar, próxima peça e reserva.
 *
 * CAMADA: renderização.
 *
 * O placar é feito com HTML comum, não desenhado no canvas: texto em HTML é
 * lido por leitores de tela, aumenta junto com o zoom do navegador e se ajusta
 * sozinho em telas pequenas. Só as MINIATURAS DAS PEÇAS usam canvas — e usam o
 * mesmo pintor do tabuleiro, então a reserva mostra o rosto certo assim que a
 * skin de imagem for ativada.
 */

import { criarMatriz } from '../core/Tetromino.js';

/** Formata milissegundos como m:ss.d — o Sprint é decidido em décimos. */
function formatarTempo(ms) {
  const totalDeSegundos = ms / 1000;
  const minutos = Math.floor(totalDeSegundos / 60);
  const segundos = Math.floor(totalDeSegundos % 60);
  const decimos = Math.floor((totalDeSegundos * 10) % 10);
  return `${minutos}:${String(segundos).padStart(2, '0')}.${decimos}`;
}

/** Separador de milhar, para o placar não virar uma parede de dígitos. */
function formatarNumero(valor) {
  return Math.round(valor).toLocaleString('pt-BR');
}

export class HudRenderer {
  /**
   * @param {Object} elementos            referências do DOM
   * @param {import('./CanvasRenderer.js').CanvasRenderer} renderizador
   * @param {import('./SkinRegistry.js').SkinRegistry} skins
   */
  constructor(elementos, renderizador, skins) {
    this.el = elementos;
    this.renderizador = renderizador;
    this.skins = skins;

    /** Guarda os últimos valores para não reescrever o DOM à toa a cada quadro. */
    this._ultimo = {};
  }

  /**
   * Atualiza os números do placar.
   * @param {Object} estado
   */
  atualizar({ pontos, linhas, nivel, tempoMs, modo, objetivo }) {
    // Só a pontuação pulsa. Se cada número do placar reagisse, o canto da tela
    // viraria um piscar constante e nenhum deles significaria nada.
    this.#escrever(this.el.pontos, formatarNumero(pontos), true);
    this.#escrever(this.el.linhas, String(linhas));
    this.#escrever(this.el.nivel, String(nivel));
    this.#escrever(this.el.tempo, formatarTempo(tempoMs));

    if (this.el.modo) this.#escrever(this.el.modo, modo);

    // O rótulo do objetivo muda conforme o modo: linhas restantes no Sprint,
    // tempo restante no Ultra, nada nos demais.
    if (this.el.objetivo) {
      this.el.objetivo.hidden = !objetivo;
      if (objetivo) this.#escrever(this.el.objetivo, objetivo);
    }
  }

  /**
   * Só toca no DOM quando o valor realmente mudou.
   *
   * @param {boolean} [pulsar]  reinicia a animação de ganho quando o valor sobe
   */
  #escrever(elemento, texto, pulsar = false) {
    if (!elemento) return;
    if (this._ultimo[elemento.id] === texto) return;

    const primeiraVez = this._ultimo[elemento.id] === undefined;
    this._ultimo[elemento.id] = texto;
    elemento.textContent = texto;

    if (!pulsar || primeiraVez) return;

    // Remover, forçar o recálculo do layout e recolocar é o jeito de reiniciar
    // uma animação CSS já em andamento. Sem o passo do meio, o navegador junta
    // as duas mudanças num quadro só e a animação não se repete — pontos
    // ganhos em sequência rápida passariam sem feedback nenhum.
    elemento.classList.remove('placar__valor--pulsando');
    void elemento.offsetWidth;
    elemento.classList.add('placar__valor--pulsando');
  }

  /**
   * Desenha a fila de próximas peças.
   * @param {string[]} tipos
   */
  desenharProximas(tipos) {
    if (!this.el.proximas) return;

    const canvases = this.el.proximas.querySelectorAll('canvas');
    canvases.forEach((canvas, indice) => {
      const tipo = tipos[indice];
      this.#desenharMiniatura(canvas, tipo);
    });
  }

  /**
   * Desenha a peça guardada na reserva.
   *
   * O professor guardado é desenhado junto: a reserva serve justamente para
   * segurar um professor até a hora certa, e uma miniatura sem a marca faria o
   * jogador achar que o poder tinha se perdido.
   *
   * @param {string|null} tipo
   * @param {string|null} [professor]
   */
  desenharReserva(tipo, professor = null) {
    if (!this.el.reserva) return;
    this.#desenharMiniatura(this.el.reserva, tipo, professor);
  }

  #desenharMiniatura(canvas, tipo, professor = null) {
    if (!canvas) return;

    const densidade = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;

    if (canvas.width !== Math.floor(largura * densidade)) {
      canvas.width = Math.floor(largura * densidade);
      canvas.height = Math.floor(altura * densidade);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    if (!tipo) return;
    this.renderizador.desenharPecaIsolada(ctx, tipo, largura, altura, criarMatriz(tipo), professor);
  }

  /** Redesenha as miniaturas — chamado quando a skin muda no meio da partida. */
  redesenharMiniaturas(tiposDaFila, tipoNaReserva, professorNaReserva = null) {
    this.desenharProximas(tiposDaFila);
    this.desenharReserva(tipoNaReserva, professorNaReserva);
  }

  /**
   * Mostra os efeitos que estão valendo agora ("Queda lenta — 3 peças").
   *
   * A duração é contada em PEÇAS, não em segundos, e o texto diz isso: é uma
   * promessa que o jogador consegue conferir olhando o tabuleiro, em vez de
   * ver um efeito expirar no meio de um encaixe sem aviso.
   *
   * @param {{id: string, nome: string, pecasRestantes: number}[]} efeitos
   */
  mostrarEfeitos(efeitos) {
    const caixa = this.el.efeitos;
    if (!caixa) return;

    if (!efeitos || efeitos.length === 0) {
      caixa.hidden = true;
      caixa.textContent = '';
      return;
    }

    // Reescrever a lista a cada quadro desperdiçaria trabalho à toa.
    const assinatura = efeitos.map((e) => `${e.id}:${e.pecasRestantes}`).join(',');
    if (this._ultimaAssinaturaDeEfeitos === assinatura) return;
    this._ultimaAssinaturaDeEfeitos = assinatura;

    caixa.hidden = false;
    caixa.textContent = '';

    for (const efeito of efeitos) {
      const item = document.createElement('div');
      item.className = 'efeito-ativo';

      const nome = document.createElement('span');
      nome.className = 'efeito-ativo__nome';
      nome.textContent = efeito.nome;

      const restante = document.createElement('span');
      restante.className = 'efeito-ativo__restante';
      const n = efeito.pecasRestantes;
      restante.textContent = `${n} peça${n === 1 ? '' : 's'}`;

      item.append(nome, restante);
      caixa.append(item);
    }
  }

  /**
   * Mensagem grande sobre o tabuleiro (PAUSADO, FIM DE JOGO...).
   * @param {string|null} texto  null esconde a mensagem
   * @param {string} [detalhe]
   */
  mostrarAviso(texto, detalhe = '') {
    if (!this.el.aviso) return;

    if (!texto) {
      this.el.aviso.hidden = true;
      return;
    }

    this.el.aviso.hidden = false;
    this.el.avisoTitulo.textContent = texto;
    this.el.avisoDetalhe.textContent = detalhe;
  }

  /** Texto do objetivo conforme o modo, mostrado ao lado do placar. */
  static descreverObjetivo(modo, linhas, tempoMs) {
    if (modo.limiteDeLinhas !== null) {
      const faltam = Math.max(modo.limiteDeLinhas - linhas, 0);
      return `Faltam ${faltam} linha${faltam === 1 ? '' : 's'}`;
    }
    if (modo.limiteDeTempoMs !== null) {
      const restante = Math.max(modo.limiteDeTempoMs - tempoMs, 0);
      return `Resta ${formatarTempo(restante)}`;
    }
    return '';
  }
}

export { formatarTempo, formatarNumero };
