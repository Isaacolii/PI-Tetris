/**
 * EfeitoVisual.js — Animações de ativação dos poderes.
 *
 * CAMADA: renderização.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ANIMAÇÃO AQUI É DECORAÇÃO, NUNCA REGRA.
 *
 *  Quando um efeito começa, o tabuleiro JÁ FOI resolvido: os blocos sumiram, os
 *  pontos foram contados, a próxima peça já nasceu. O que se anima é o rastro
 *  do que aconteceu.
 *
 *  Isso não é detalhe de estilo. Se a lógica esperasse a animação terminar, o
 *  jogo travaria em qualquer ambiente que não desenhe quadros — e é exatamente
 *  o caso do navegador embutido usado para verificar este projeto. Como está,
 *  a partida corre igual com ou sem animação.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Quanto tempo cada efeito leva para desaparecer. */
const DURACAO_MS = 420;

export class EfeitoVisual {
  constructor() {
    /** @type {object[]} efeitos em andamento */
    this.ativos = [];
  }

  /**
   * Registra um efeito para ser desenhado nos próximos quadros.
   *
   * @param {object} relatorio  saída de PoderesEspeciais.executarPoder
   * @param {{cor: string}} visual  aparência do professor que disparou
   */
  registrar(relatorio, visual = { cor: '#ffffff' }) {
    if (!relatorio) return;

    this.ativos.push({
      celulas: relatorio.celulas ?? [],
      linhas: relatorio.linhasAtingidas ?? [],
      colunas: relatorio.colunasAtingidas ?? [],
      ponto: relatorio.ponto ?? null,
      nome: relatorio.nome ?? '',
      cor: visual.cor,
      restanteMs: DURACAO_MS,
    });

    // Trava de segurança: se muitos poderes dispararem em sequência num
    // ambiente sem quadros, a lista não pode crescer sem limite.
    if (this.ativos.length > 12) this.ativos.splice(0, this.ativos.length - 12);
  }

  /** Avança o tempo dos efeitos e descarta os que acabaram. */
  atualizar(deltaMs) {
    for (const efeito of this.ativos) efeito.restanteMs -= deltaMs;
    this.ativos = this.ativos.filter((efeito) => efeito.restanteMs > 0);
  }

  get temAlgoParaDesenhar() {
    return this.ativos.length > 0;
  }

  limpar() {
    this.ativos = [];
  }

  /**
   * Desenha os efeitos sobre o tabuleiro.
   * As coordenadas já chegam no sistema do tabuleiro (origem no canto superior
   * esquerdo da área de jogo).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} tamanhoDaCelula
   * @param {number} linhasOcultas
   * @param {number} largura
   * @param {number} altura
   */
  desenhar(ctx, tamanhoDaCelula, linhasOcultas, largura, altura) {
    for (const efeito of this.ativos) {
      // 0 = acabou de começar, 1 = prestes a sumir.
      const progresso = 1 - efeito.restanteMs / DURACAO_MS;
      const opacidade = 1 - progresso;

      ctx.save();
      ctx.globalAlpha = Math.max(opacidade, 0);

      // Faixas nas linhas e colunas atingidas.
      ctx.fillStyle = efeito.cor;
      for (const linha of efeito.linhas) {
        const y = (linha - linhasOcultas) * tamanhoDaCelula;
        if (y + tamanhoDaCelula < 0) continue;
        ctx.globalAlpha = Math.max(opacidade * 0.45, 0);
        ctx.fillRect(0, y, largura, tamanhoDaCelula);
      }
      for (const coluna of efeito.colunas) {
        ctx.globalAlpha = Math.max(opacidade * 0.45, 0);
        ctx.fillRect(coluna * tamanhoDaCelula, 0, tamanhoDaCelula, altura);
      }

      // Clarão em cada célula afetada, encolhendo conforme o efeito passa.
      ctx.globalAlpha = Math.max(opacidade * 0.85, 0);
      ctx.fillStyle = '#ffffff';
      const encolhimento = progresso * tamanhoDaCelula * 0.4;
      for (const celula of efeito.celulas) {
        const y = (celula.linha - linhasOcultas) * tamanhoDaCelula;
        if (y + tamanhoDaCelula < 0) continue;
        ctx.fillRect(
          celula.coluna * tamanhoDaCelula + encolhimento,
          y + encolhimento,
          tamanhoDaCelula - encolhimento * 2,
          tamanhoDaCelula - encolhimento * 2,
        );
      }

      // Onda circular saindo do ponto da combinação.
      if (efeito.ponto) {
        const centroX = (efeito.ponto.coluna + 0.5) * tamanhoDaCelula;
        const centroY = (efeito.ponto.linha - linhasOcultas + 0.5) * tamanhoDaCelula;
        ctx.globalAlpha = Math.max(opacidade * 0.8, 0);
        ctx.strokeStyle = efeito.cor;
        ctx.lineWidth = Math.max(2, tamanhoDaCelula * 0.12) * (1 - progresso);
        ctx.beginPath();
        ctx.arc(centroX, centroY, tamanhoDaCelula * (0.4 + progresso * 3), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
