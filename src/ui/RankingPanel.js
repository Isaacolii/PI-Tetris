/**
 * RankingPanel.js — Tabela de melhores partidas, com uma aba por modo.
 *
 * CAMADA: interface.
 *
 * A coluna principal muda conforme o modo: no Sprint o que importa é o TEMPO
 * (menor é melhor); nos demais, os pontos. Mostrar sempre a mesma coluna faria
 * o ranking do Sprint parecer embaralhado.
 */

import { MODOS } from '../core/GameModes.js';
import { formatarTempo, formatarNumero } from '../render/HudRenderer.js';

/** Quantas partidas aparecem por modo. */
const LIMITE = 10;

/**
 * Monta (ou remonta) o painel de ranking.
 *
 * @param {Object} opcoes
 * @param {HTMLElement} opcoes.abas
 * @param {HTMLElement} opcoes.tabela
 * @param {import('../storage/RankingStorage.js').RankingStorage} opcoes.ranking
 * @param {string} [opcoes.modoAtivo]
 */
export function montarRanking({ abas, tabela, ranking, modoAtivo = 'maratona' }) {
  if (!abas || !tabela) return;

  abas.textContent = '';

  for (const modo of Object.values(MODOS)) {
    const aba = document.createElement('button');
    aba.type = 'button';
    aba.className = 'aba';
    aba.setAttribute('role', 'tab');
    aba.setAttribute('aria-selected', String(modo.id === modoAtivo));
    aba.textContent = modo.nome;

    aba.addEventListener('click', () => {
      montarRanking({ abas, tabela, ranking, modoAtivo: modo.id });
    });

    abas.append(aba);
  }

  desenharTabela(tabela, ranking, modoAtivo);
}

function desenharTabela(destino, ranking, idDoModo) {
  const modo = MODOS[idDoModo];
  const partidas = ranking.melhores(idDoModo, LIMITE);

  destino.textContent = '';

  if (partidas.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'vazio';
    vazio.textContent = `Nenhuma partida registrada no modo ${modo.nome} ainda.`;
    destino.append(vazio);
    return;
  }

  const porTempo = modo.criterio === 'tempo';

  const tabela = document.createElement('table');
  tabela.className = 'tabela';

  // Cabeçalho
  const cabecalho = document.createElement('thead');
  const linhaDeCabecalho = document.createElement('tr');

  const colunas = porTempo
    ? ['#', 'Jogador', 'Tempo', 'Pontos', 'Linhas', 'Data']
    : ['#', 'Jogador', 'Pontos', 'Linhas', 'Nível', 'Data'];

  for (const titulo of colunas) {
    const celula = document.createElement('th');
    celula.textContent = titulo;
    linhaDeCabecalho.append(celula);
  }
  cabecalho.append(linhaDeCabecalho);
  tabela.append(cabecalho);

  // Corpo
  const corpo = document.createElement('tbody');

  partidas.forEach((partida, indice) => {
    const linha = document.createElement('tr');

    const posicao = document.createElement('td');
    posicao.className = 'tabela__posicao';
    posicao.textContent = String(indice + 1);

    const nome = document.createElement('td');
    nome.textContent = partida.nome;

    const valores = porTempo
      ? [
          // Quem não completou as 40 linhas não tem tempo válido.
          partida.motivoDoFim === 'objetivo' ? formatarTempo(partida.tempoMs) : '—',
          formatarNumero(partida.pontos),
          String(partida.linhas),
        ]
      : [formatarNumero(partida.pontos), String(partida.linhas), String(partida.nivel)];

    linha.append(posicao, nome);

    for (const valor of valores) {
      const celula = document.createElement('td');
      celula.textContent = valor;
      linha.append(celula);
    }

    const data = document.createElement('td');
    data.textContent = formatarData(partida.dataISO);
    linha.append(data);

    corpo.append(linha);
  });

  tabela.append(corpo);
  destino.append(tabela);
}

/** Data curta no formato brasileiro. */
function formatarData(dataISO) {
  try {
    return new Date(dataISO).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}
