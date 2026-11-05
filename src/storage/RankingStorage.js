/**
 * RankingStorage.js — Histórico de partidas e ranking.
 *
 * CAMADA: persistência.
 *
 * LIMITE IMPORTANTE, E DECLARADO DE PROPÓSITO:
 * os dados ficam no localStorage, ou seja, SÓ NESTE NAVEGADOR. Não existe
 * servidor, banco de dados nem contas de usuário — isso exigiria back-end,
 * autenticação e tratamento de dados pessoais (LGPD), fora do escopo do projeto.
 *
 * Para comparar o desempenho de várias pessoas, cada uma joga, exporta o próprio
 * perfil em JSON (ver ProfileExport.js) e os arquivos são reunidos. É honesto,
 * funciona sem infraestrutura e é o que alimenta o relatório comparativo da IA.
 */

import { LocalStore } from './LocalStore.js';

const CHAVE = 'ranking';

/** Quantas partidas guardamos por modo. Acima disso, as mais antigas saem. */
const MAXIMO_POR_MODO = 50;

export class RankingStorage {
  /** @param {LocalStore} [store] */
  constructor(store = new LocalStore()) {
    this.store = store;
    /** @type {Array<object>} lista plana de partidas, mais recentes primeiro */
    this.partidas = this.store.ler(CHAVE, []);
  }

  /**
   * Guarda o resultado de uma partida.
   *
   * @param {object} resultado   saída de GameEngine.resultado()
   * @param {string} nome        nome do jogador
   * @returns {{ok: boolean, motivo?: string, posicao: number|null}}
   */
  registrar(resultado, nome) {
    const registro = {
      nome: (nome || 'Anônimo').trim().slice(0, 24),
      modo: resultado.modo,
      nomeDoModo: resultado.nomeDoModo,
      criterio: resultado.criterio,
      pontos: resultado.pontos,
      linhas: resultado.linhas,
      nivel: resultado.nivel,
      tempoMs: resultado.estatisticas.tempoDecorridoMs,
      motivoDoFim: resultado.motivoDoFim,
      limpezas: resultado.limpezas,
      estatisticas: resultado.estatisticas,
      dataISO: resultado.dataISO,
    };

    this.partidas.unshift(registro);
    this.#podar();

    const gravacao = this.store.gravar(CHAVE, this.partidas);
    const posicao = this.posicaoDe(registro);

    return { ...gravacao, posicao };
  }

  /** Mantém no máximo MAXIMO_POR_MODO partidas de cada modo. */
  #podar() {
    const contagem = new Map();
    this.partidas = this.partidas.filter((partida) => {
      const quantas = contagem.get(partida.modo) ?? 0;
      if (quantas >= MAXIMO_POR_MODO) return false;
      contagem.set(partida.modo, quantas + 1);
      return true;
    });
  }

  /**
   * Compara duas partidas segundo o critério do modo.
   * Em Sprint vence quem fez menos tempo; nos demais, quem fez mais pontos.
   */
  static #melhorPrimeiro(a, b) {
    if (a.criterio === 'tempo') {
      // Sprint só vale se o objetivo foi cumprido; quem desistiu vai para o fim.
      const aCumpriu = a.motivoDoFim === 'objetivo';
      const bCumpriu = b.motivoDoFim === 'objetivo';
      if (aCumpriu !== bCumpriu) return aCumpriu ? -1 : 1;
      if (aCumpriu && bCumpriu) return a.tempoMs - b.tempoMs;
    }
    return b.pontos - a.pontos;
  }

  /**
   * Melhores partidas de um modo.
   * @param {string} modo
   * @param {number} limite
   */
  melhores(modo, limite = 10) {
    return this.partidas
      .filter((partida) => partida.modo === modo)
      .sort(RankingStorage.#melhorPrimeiro)
      .slice(0, limite);
  }

  /** Em que posição do ranking do seu modo esta partida ficou (1 = primeiro). */
  posicaoDe(partida) {
    const doModo = this.partidas
      .filter((outra) => outra.modo === partida.modo)
      .sort(RankingStorage.#melhorPrimeiro);
    const indice = doModo.findIndex((outra) => outra.dataISO === partida.dataISO);
    return indice >= 0 ? indice + 1 : null;
  }

  /** Todas as partidas de um jogador, das mais recentes para as mais antigas. */
  partidasDe(nome, modo = null) {
    return this.partidas.filter(
      (partida) => partida.nome === nome && (modo === null || partida.modo === modo),
    );
  }

  /** Nomes distintos já registrados neste navegador. */
  jogadores() {
    return [...new Set(this.partidas.map((partida) => partida.nome))];
  }

  /** Últimas partidas de qualquer modo — usado para medir a evolução do jogador. */
  ultimasPartidas(nome, quantidade = 5, modo = null) {
    return this.partidasDe(nome, modo).slice(0, quantidade);
  }

  /**
   * Média de desempenho de um jogador — base do comparativo entre pessoas.
   * @returns {object|null} null se o jogador não tem partidas registradas
   */
  perfilDe(nome, modo = null) {
    const partidas = this.partidasDe(nome, modo);
    if (partidas.length === 0) return null;

    const somar = (extrair) => partidas.reduce((total, p) => total + (extrair(p) ?? 0), 0);
    const media = (extrair) => somar(extrair) / partidas.length;

    return {
      nome,
      partidas: partidas.length,
      melhorPontuacao: Math.max(...partidas.map((p) => p.pontos)),
      pontuacaoMedia: Math.round(media((p) => p.pontos)),
      linhasMedia: Number(media((p) => p.linhas).toFixed(1)),
      nivelMaximo: Math.max(...partidas.map((p) => p.nivel)),
      tempoMedioMs: Math.round(media((p) => p.tempoMs)),
      eficienciaMedia: Number(media((p) => p.estatisticas?.eficiencia).toFixed(3)),
      acoesPorMinutoMedia: Number(media((p) => p.estatisticas?.acoesPorMinuto).toFixed(1)),
      buracosMedios: Number(media((p) => p.estatisticas?.buracosCriados).toFixed(1)),
      totalDeTetris: somar((p) => p.limpezas?.['4']),
    };
  }

  /** Apaga todo o histórico. */
  limpar() {
    this.partidas = [];
    this.store.remover(CHAVE);
  }

  /** Substitui o histórico — usado ao importar o perfil de um colega. */
  substituir(partidas) {
    this.partidas = partidas;
    this.#podar();
    return this.store.gravar(CHAVE, this.partidas);
  }

  /** Acrescenta partidas sem apagar as existentes, ignorando duplicatas. */
  mesclar(partidas) {
    const existentes = new Set(this.partidas.map((p) => `${p.nome}|${p.dataISO}`));
    let novas = 0;

    for (const partida of partidas) {
      const chave = `${partida.nome}|${partida.dataISO}`;
      if (existentes.has(chave)) continue;
      this.partidas.push(partida);
      existentes.add(chave);
      novas++;
    }

    this.partidas.sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO));
    this.#podar();
    this.store.gravar(CHAVE, this.partidas);
    return novas;
  }
}
