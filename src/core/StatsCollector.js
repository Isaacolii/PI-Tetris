/**
 * StatsCollector.js — Métricas da partida.
 *
 * CAMADA: núcleo (lógica pura).
 *
 * Observa a partida e produz números. Nada aqui desenha, e nada aqui sabe que
 * existe uma IA — mas é exatamente esta saída que alimenta tanto os gráficos
 * quanto a análise do treinador. Métrica boa é métrica que explica a derrota.
 */

import { TIPOS_DE_PECA } from './Tetromino.js';

export class StatsCollector {
  constructor() {
    this.reiniciar();
  }

  reiniciar() {
    this.pecasJogadas = 0;
    this.acoes = 0;
    this.tempoDecorridoMs = 0;
    this.buracosCriados = 0;
    this.alturaMaxima = 0;
    /** Peças usadas, por tipo: { I: 0, O: 0, ... } */
    this.distribuicaoDePecas = Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, 0]));
    /** Amostras periódicas para os gráficos: { tempoMs, pontos, linhas, altura, buracos } */
    this.serieTemporal = [];
    /** Estado anterior do tabuleiro, para medir o que cada peça causou. */
    this._buracosAnteriores = 0;
    this._somaDeAlturas = 0;
    this._amostrasDeAltura = 0;
  }

  /** Chamado toda vez que o jogador aperta algo — base do APM. */
  registrarAcao() {
    this.acoes++;
  }

  /**
   * Chamado quando uma peça é fixada no tabuleiro.
   * @param {string} tipo
   * @param {import('./Grid.js').Grid} grid  já com a peça fixada
   */
  registrarPecaFixada(tipo, grid) {
    this.pecasJogadas++;
    this.distribuicaoDePecas[tipo] = (this.distribuicaoDePecas[tipo] ?? 0) + 1;

    const buracosAgora = grid.contarBuracos();
    // Só contamos aumento: limpar linhas pode reduzir buracos, e isso não é demérito.
    if (buracosAgora > this._buracosAnteriores) {
      this.buracosCriados += buracosAgora - this._buracosAnteriores;
    }
    this._buracosAnteriores = buracosAgora;

    const alturas = grid.alturasPorColuna();
    const pico = Math.max(...alturas);
    if (pico > this.alturaMaxima) this.alturaMaxima = pico;
    this._somaDeAlturas += pico;
    this._amostrasDeAltura++;
  }

  /** Amostra periódica do estado, para desenhar a evolução da partida. */
  amostrar(tempoMs, pontos, linhas, grid) {
    const alturas = grid.alturasPorColuna();
    this.serieTemporal.push({
      tempoMs,
      pontos,
      linhas,
      altura: Math.max(...alturas),
      buracos: grid.contarBuracos(),
    });
  }

  /** Ações por minuto — mede o ritmo do jogador. */
  acoesPorMinuto() {
    const minutos = this.tempoDecorridoMs / 60000;
    return minutos > 0 ? this.acoes / minutos : 0;
  }

  /** Linhas por peça. Acima de 0,25 significa que o jogador está fechando bem. */
  eficiencia(linhas) {
    return this.pecasJogadas > 0 ? linhas / this.pecasJogadas : 0;
  }

  alturaMedia() {
    return this._amostrasDeAltura > 0 ? this._somaDeAlturas / this._amostrasDeAltura : 0;
  }

  /**
   * Fotografia final das métricas — é este objeto que vai para os gráficos,
   * para o ranking e (resumido) para a análise por IA.
   */
  resumo(linhas) {
    return {
      pecasJogadas: this.pecasJogadas,
      acoes: this.acoes,
      tempoDecorridoMs: Math.round(this.tempoDecorridoMs),
      acoesPorMinuto: Number(this.acoesPorMinuto().toFixed(1)),
      eficiencia: Number(this.eficiencia(linhas).toFixed(3)),
      buracosCriados: this.buracosCriados,
      alturaMaxima: this.alturaMaxima,
      alturaMedia: Number(this.alturaMedia().toFixed(1)),
      distribuicaoDePecas: { ...this.distribuicaoDePecas },
    };
  }
}
