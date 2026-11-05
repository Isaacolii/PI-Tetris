/**
 * StatsChart.js — Gráficos das estatísticas, desenhados em canvas puro.
 *
 * CAMADA: renderização.
 *
 * POR QUE NÃO USAMOS UMA BIBLIOTECA DE GRÁFICOS:
 * qualquer biblioteca viria de um CDN ou de node_modules, e as duas opções
 * brigam com dois requisitos do projeto — o jogo precisa funcionar offline no
 * modo PWA, e não pode depender de um servidor de terceiros estar no ar no dia
 * da apresentação. Três gráficos simples cabem em um arquivo, sem dependência.
 */

/** Paleta dos gráficos, coerente com a interface. */
const CORES = {
  linha: '#4dd0e1',
  linhaSecundaria: '#ff8a65',
  eixo: 'rgba(255, 255, 255, 0.25)',
  texto: 'rgba(255, 255, 255, 0.65)',
  grade: 'rgba(255, 255, 255, 0.08)',
};

const MARGEM = { topo: 16, direita: 14, baixo: 28, esquerda: 44 };

/** Prepara o canvas para a densidade da tela e devolve o contexto já escalado. */
function prepararCanvas(canvas) {
  const densidade = window.devicePixelRatio || 1;
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;

  canvas.width = Math.floor(largura * densidade);
  canvas.height = Math.floor(altura * densidade);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  return { ctx, largura, altura };
}

/** Mensagem para quando ainda não há dados suficientes. */
function desenharVazio(ctx, largura, altura, mensagem) {
  ctx.fillStyle = CORES.texto;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mensagem, largura / 2, altura / 2);
}

/** Eixos e grade horizontal, comuns aos gráficos cartesianos. */
function desenharEixos(ctx, largura, altura, maximo, rotuloY) {
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;

  ctx.strokeStyle = CORES.eixo;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGEM.esquerda, MARGEM.topo);
  ctx.lineTo(MARGEM.esquerda, altura - MARGEM.baixo);
  ctx.lineTo(largura - MARGEM.direita, altura - MARGEM.baixo);
  ctx.stroke();

  // Quatro divisões horizontais com os valores à esquerda.
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = CORES.texto;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const DIVISOES = 4;
  for (let i = 0; i <= DIVISOES; i++) {
    const proporcao = i / DIVISOES;
    const y = altura - MARGEM.baixo - alturaUtil * proporcao;
    const valor = Math.round(maximo * proporcao);

    ctx.fillText(String(valor), MARGEM.esquerda - 6, y);

    if (i > 0) {
      ctx.strokeStyle = CORES.grade;
      ctx.beginPath();
      ctx.moveTo(MARGEM.esquerda, y);
      ctx.lineTo(largura - MARGEM.direita, y);
      ctx.stroke();
    }
  }

  if (rotuloY) {
    ctx.save();
    ctx.translate(11, altura / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = CORES.texto;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(rotuloY, 0, 0);
    ctx.restore();
  }
}

/**
 * Gráfico de linha da evolução da partida: pontos e altura da pilha ao longo
 * do tempo, no mesmo eixo horizontal.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{tempoMs: number, pontos: number, altura: number}>} serie
 */
export function desenharEvolucao(canvas, serie) {
  const { ctx, largura, altura } = prepararCanvas(canvas);

  if (!serie || serie.length < 2) {
    desenharVazio(ctx, largura, altura, 'Partida curta demais para gerar o gráfico.');
    return;
  }

  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;

  const pontoMaximo = Math.max(...serie.map((a) => a.pontos), 1);
  const tempoMaximo = Math.max(...serie.map((a) => a.tempoMs), 1);

  desenharEixos(ctx, largura, altura, pontoMaximo, 'Pontos');

  const xDe = (tempoMs) => MARGEM.esquerda + (tempoMs / tempoMaximo) * larguraUtil;
  const yDe = (valor, maximo) => altura - MARGEM.baixo - (valor / maximo) * alturaUtil;

  // Pontuação: linha cheia com área sombreada.
  ctx.beginPath();
  serie.forEach((amostra, indice) => {
    const x = xDe(amostra.tempoMs);
    const y = yDe(amostra.pontos, pontoMaximo);
    if (indice === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = CORES.linha;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineTo(xDe(serie[serie.length - 1].tempoMs), altura - MARGEM.baixo);
  ctx.lineTo(xDe(serie[0].tempoMs), altura - MARGEM.baixo);
  ctx.closePath();
  ctx.fillStyle = 'rgba(77, 208, 225, 0.16)';
  ctx.fill();

  // Altura da pilha: linha tracejada, na mesma área. Escala própria (0 a 20),
  // porque a grandeza é outra — o interesse aqui é a FORMA da curva, que mostra
  // quando o jogador deixou a pilha subir.
  ctx.beginPath();
  serie.forEach((amostra, indice) => {
    const x = xDe(amostra.tempoMs);
    const y = yDe(amostra.altura, 20);
    if (indice === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = CORES.linhaSecundaria;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Eixo do tempo.
  ctx.fillStyle = CORES.texto;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0s', MARGEM.esquerda, altura - MARGEM.baixo + 7);
  ctx.fillText(
    `${Math.round(tempoMaximo / 1000)}s`,
    largura - MARGEM.direita,
    altura - MARGEM.baixo + 7,
  );

  // Legenda.
  desenharLegenda(ctx, largura, [
    { cor: CORES.linha, rotulo: 'Pontos' },
    { cor: CORES.linhaSecundaria, rotulo: 'Altura da pilha', tracejado: true },
  ]);
}

function desenharLegenda(ctx, largura, itens) {
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let x = MARGEM.esquerda + 4;
  const y = 8;

  for (const item of itens) {
    ctx.strokeStyle = item.cor;
    ctx.lineWidth = 2;
    if (item.tracejado) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = CORES.texto;
    ctx.fillText(item.rotulo, x + 21, y);
    x += 30 + ctx.measureText(item.rotulo).width;
  }
}

/**
 * Gráfico de barras da distribuição de peças, pintado com as cores da skin ativa.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, number>} distribuicao
 * @param {import('./SkinRegistry.js').SkinRegistry} skins
 */
export function desenharDistribuicao(canvas, distribuicao, skins) {
  const { ctx, largura, altura } = prepararCanvas(canvas);

  const tipos = Object.keys(distribuicao);
  const valores = tipos.map((tipo) => distribuicao[tipo]);
  const maximo = Math.max(...valores, 1);
  const total = valores.reduce((soma, valor) => soma + valor, 0);

  if (total === 0) {
    desenharVazio(ctx, largura, altura, 'Nenhuma peça jogada ainda.');
    return;
  }

  desenharEixos(ctx, largura, altura, maximo, '');

  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;
  const larguraDaBarra = (larguraUtil / tipos.length) * 0.62;
  const passo = larguraUtil / tipos.length;

  tipos.forEach((tipo, indice) => {
    const valor = distribuicao[tipo];
    const alturaDaBarra = (valor / maximo) * alturaUtil;
    const x = MARGEM.esquerda + passo * indice + (passo - larguraDaBarra) / 2;
    const y = altura - MARGEM.baixo - alturaDaBarra;

    ctx.fillStyle = skins.corRepresentativa(tipo);
    ctx.fillRect(x, y, larguraDaBarra, alturaDaBarra);

    // Valor acima da barra.
    ctx.fillStyle = CORES.texto;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(valor), x + larguraDaBarra / 2, y - 3);

    // Nome da peça abaixo do eixo.
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = skins.corRepresentativa(tipo);
    ctx.fillText(tipo, x + larguraDaBarra / 2, altura - MARGEM.baixo + 7);
  });
}

/**
 * Barras horizontais com os tipos de limpeza (Simples, Dupla, Tripla, Tetris).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, number>} limpezas
 */
export function desenharLimpezas(canvas, limpezas) {
  const { ctx, largura, altura } = prepararCanvas(canvas);

  const rotulos = ['Simples', 'Dupla', 'Tripla', 'Tetris'];
  const cores = ['#78909c', '#4db6ac', '#ffb74d', '#ef5350'];
  const valores = [1, 2, 3, 4].map((n) => limpezas[n] ?? limpezas[String(n)] ?? 0);
  const maximo = Math.max(...valores, 1);
  const total = valores.reduce((soma, valor) => soma + valor, 0);

  if (total === 0) {
    desenharVazio(ctx, largura, altura, 'Nenhuma linha limpa nesta partida.');
    return;
  }

  const margemEsquerda = 62;
  const alturaDaFaixa = (altura - 16) / rotulos.length;
  const alturaDaBarra = alturaDaFaixa * 0.55;

  rotulos.forEach((rotulo, indice) => {
    const y = 8 + alturaDaFaixa * indice + (alturaDaFaixa - alturaDaBarra) / 2;
    const comprimento = (valores[indice] / maximo) * (largura - margemEsquerda - 34);

    ctx.fillStyle = CORES.texto;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(rotulo, margemEsquerda - 8, y + alturaDaBarra / 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(margemEsquerda, y, largura - margemEsquerda - 34, alturaDaBarra);

    ctx.fillStyle = cores[indice];
    ctx.fillRect(margemEsquerda, y, Math.max(comprimento, valores[indice] > 0 ? 3 : 0), alturaDaBarra);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(String(valores[indice]), margemEsquerda + Math.max(comprimento, 3) + 7, y + alturaDaBarra / 2);
  });
}

/**
 * Comparativo entre jogadores: barras agrupadas de uma métrica escolhida.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{nome: string, valor: number}>} dados
 * @param {string} rotuloDaMetrica
 */
export function desenharComparativo(canvas, dados, rotuloDaMetrica) {
  const { ctx, largura, altura } = prepararCanvas(canvas);

  if (!dados || dados.length === 0) {
    desenharVazio(ctx, largura, altura, 'Sem jogadores para comparar.');
    return;
  }

  const maximo = Math.max(...dados.map((d) => d.valor), 1);
  desenharEixos(ctx, largura, altura, maximo, rotuloDaMetrica);

  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = altura - MARGEM.topo - MARGEM.baixo;
  const passo = larguraUtil / dados.length;
  const larguraDaBarra = passo * 0.6;

  const paleta = ['#4dd0e1', '#ffb74d', '#ba68c8', '#81c784', '#ff8a65', '#7986cb'];

  dados.forEach((item, indice) => {
    const alturaDaBarra = (item.valor / maximo) * alturaUtil;
    const x = MARGEM.esquerda + passo * indice + (passo - larguraDaBarra) / 2;
    const y = altura - MARGEM.baixo - alturaDaBarra;

    ctx.fillStyle = paleta[indice % paleta.length];
    ctx.fillRect(x, y, larguraDaBarra, alturaDaBarra);

    ctx.fillStyle = CORES.texto;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(item.valor.toLocaleString('pt-BR'), x + larguraDaBarra / 2, y - 3);

    // Nome do jogador, encurtado para não invadir a barra vizinha.
    ctx.textBaseline = 'top';
    const nome = item.nome.length > 9 ? `${item.nome.slice(0, 8)}…` : item.nome;
    ctx.fillText(nome, x + larguraDaBarra / 2, altura - MARGEM.baixo + 7);
  });
}
