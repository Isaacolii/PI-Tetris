/**
 * StatsPanel.js — Painel de estatísticas com cartões e gráficos.
 *
 * CAMADA: interface.
 * Os números vêm prontos de core/StatsCollector.js; aqui só se decide como exibir.
 */

import { desenharEvolucao, desenharDistribuicao, desenharLimpezas } from '../render/StatsChart.js';
import { formatarTempo, formatarNumero } from '../render/HudRenderer.js';

export class StatsPanel {
  /**
   * @param {Object} elementos
   * @param {import('../render/SkinRegistry.js').SkinRegistry} skins
   * @param {import('../storage/RankingStorage.js').RankingStorage} ranking
   */
  constructor(elementos, skins, ranking) {
    this.el = elementos;
    this.skins = skins;
    this.ranking = ranking;
    /** Última partida exibida, para redesenhar ao reabrir o painel. */
    this.ultimoResultado = null;
  }

  /**
   * Mostra as estatísticas de um resultado.
   * @param {object|null} resultado  saída de GameEngine.resultado()
   */
  mostrar(resultado) {
    if (resultado) this.ultimoResultado = resultado;

    const dados = this.ultimoResultado;
    if (!dados) {
      this.#semDados();
      return;
    }

    this.#montarCartoes(dados);
    this.desenharGraficos();
  }

  /**
   * Desenha os três gráficos.
   *
   * Só funciona com o painel JÁ VISÍVEL: um canvas dentro de um elemento
   * escondido mede zero pixels e o gráfico sairia em branco. Por isso quem
   * abre o painel chama este método, em vez de desenharmos na montagem.
   */
  desenharGraficos() {
    const dados = this.ultimoResultado;
    if (!dados) return;

    if (this.el.graficoEvolucao) {
      desenharEvolucao(this.el.graficoEvolucao, dados.serieTemporal ?? []);
    }
    if (this.el.graficoDistribuicao) {
      desenharDistribuicao(
        this.el.graficoDistribuicao,
        dados.estatisticas.distribuicaoDePecas,
        this.skins,
      );
    }
    if (this.el.graficoLimpezas) {
      desenharLimpezas(this.el.graficoLimpezas, dados.limpezas);
    }
  }

  #semDados() {
    if (!this.el.cartoes) return;
    this.el.cartoes.textContent = '';

    const aviso = document.createElement('p');
    aviso.className = 'vazio';
    aviso.textContent = 'Jogue uma partida para ver suas estatísticas aqui.';
    this.el.cartoes.append(aviso);
  }

  #montarCartoes(resultado) {
    const destino = this.el.cartoes;
    if (!destino) return;

    const stats = resultado.estatisticas;

    const cartoes = [
      { valor: formatarNumero(resultado.pontos), rotulo: 'Pontos' },
      { valor: String(resultado.linhas), rotulo: 'Linhas' },
      { valor: String(resultado.nivel), rotulo: 'Nível' },
      { valor: formatarTempo(stats.tempoDecorridoMs), rotulo: 'Tempo' },
      { valor: String(stats.pecasJogadas), rotulo: 'Peças' },
      { valor: stats.eficiencia.toFixed(2), rotulo: 'Linhas por peça' },
      { valor: String(Math.round(stats.acoesPorMinuto)), rotulo: 'Ações/min' },
      { valor: String(stats.buracosCriados), rotulo: 'Buracos' },
      { valor: String(stats.alturaMaxima), rotulo: 'Altura máx.' },
      { valor: String(resultado.limpezas['4'] ?? 0), rotulo: 'Tetris' },
    ];

    destino.textContent = '';

    for (const item of cartoes) {
      const cartao = document.createElement('div');
      cartao.className = 'cartao';

      const valor = document.createElement('div');
      valor.className = 'cartao__valor';
      valor.textContent = item.valor;

      const rotulo = document.createElement('div');
      rotulo.className = 'cartao__rotulo';
      rotulo.textContent = item.rotulo;

      cartao.append(valor, rotulo);
      destino.append(cartao);
    }
  }

  /**
   * Versão resumida para a tela de fim de partida.
   * @param {HTMLElement} destino
   * @param {object} resultado
   * @param {number|null} posicaoNoRanking
   */
  montarResumoDoFim(destino, resultado, posicaoNoRanking) {
    if (!destino) return;

    const stats = resultado.estatisticas;
    const cartoes = [
      { valor: formatarNumero(resultado.pontos), rotulo: 'Pontos' },
      { valor: String(resultado.linhas), rotulo: 'Linhas' },
      { valor: String(resultado.nivel), rotulo: 'Nível' },
      { valor: formatarTempo(stats.tempoDecorridoMs), rotulo: 'Tempo' },
    ];

    if (posicaoNoRanking) {
      cartoes.push({ valor: `${posicaoNoRanking}º`, rotulo: 'No ranking' });
    }

    destino.textContent = '';

    for (const item of cartoes) {
      const cartao = document.createElement('div');
      cartao.className = 'cartao';

      const valor = document.createElement('div');
      valor.className = 'cartao__valor';
      valor.textContent = item.valor;

      const rotulo = document.createElement('div');
      rotulo.className = 'cartao__rotulo';
      rotulo.textContent = item.rotulo;

      cartao.append(valor, rotulo);
      destino.append(cartao);
    }
  }
}
