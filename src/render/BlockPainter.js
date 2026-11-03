/**
 * BlockPainter.js — Como um bloco é desenhado (padrão de projeto Strategy).
 *
 * CAMADA: renderização.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  O GANCHO PARA AS IMAGENS FUTURAS FICA AQUI.
 *
 *  Todos os pintores expõem exatamente o mesmo método:
 *
 *      pintar(contexto, x, y, tamanho, opcoes)
 *
 *  O CanvasRenderer chama esse método sem saber qual pintor está segurando —
 *  pode ser cor sólida, textura desenhada ou uma foto de rosto. Trocar de um
 *  para o outro não exige nenhuma alteração no renderizador nem na lógica.
 *
 *  Para criar uma aparência nova (vídeo, animação, sprite sheet), basta
 *  escrever uma classe com esse método e registrá-la em `criarPintor`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Transparência do preenchimento da sombra que mostra onde a peça vai cair.
 *
 * Fica baixa de propósito — a sombra não pode competir com as peças de verdade.
 * A leitura dela vem principalmente do contorno, desenhado em `contornarFantasma`.
 */
const OPACIDADE_DO_FANTASMA = 0.22;

/**
 * Contrato comum a todos os pintores.
 * Concentra o que não muda: sombra da peça e símbolo de acessibilidade.
 */
class PintorBase {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x         canto esquerdo do bloco, em pixels
   * @param {number} y         topo do bloco, em pixels
   * @param {number} tamanho   lado do bloco, em pixels
   * @param {{fantasma?: boolean, simbolo?: string|null}} [opcoes]
   */
  pintar(ctx, x, y, tamanho, opcoes = {}) {
    ctx.save();
    if (opcoes.fantasma) ctx.globalAlpha = OPACIDADE_DO_FANTASMA;

    this.desenharBloco(ctx, x, y, tamanho, opcoes);

    ctx.restore();

    // O contorno da sombra fica FORA do bloco de transparência: se herdasse o
    // globalAlpha do preenchimento, sumiria junto e a sombra viraria um borrão
    // sem forma. É o contorno que faz o jogador enxergar onde a peça vai cair.
    if (opcoes.fantasma) {
      this.contornarFantasma(ctx, x, y, tamanho);
      return;
    }

    if (opcoes.simbolo) {
      ctx.save();
      this.#desenharSimbolo(ctx, x, y, tamanho, opcoes.simbolo);
      ctx.restore();
    }
  }

  /**
   * Marca de professor especial, desenhada POR CIMA do bloco já pintado.
   *
   * Sobrepor em vez de substituir é o que faz a marca funcionar com qualquer
   * skin: o bloco continua sendo cor, textura ou foto, e o distintivo do
   * professor aparece igual nos três casos. Um pintor separado para "bloco com
   * professor" teria de existir em três versões e sairia de sincronia.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {{cor: string, simbolo: string, imagem: HTMLImageElement|null}} visual
   */
  marcarProfessor(ctx, x, y, tamanho, visual) {
    ctx.save();

    const margem = tamanho * 0.16;
    const lado = tamanho - margem * 2;

    if (visual.imagem) {
      // Caricatura recortada em círculo, para não virar um quadrado dentro de outro.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + tamanho / 2, y + tamanho / 2, lado / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(visual.imagem, x + margem, y + margem, lado, lado);
      ctx.restore();
    } else {
      // Sem caricatura: disco colorido com a letra do professor.
      ctx.beginPath();
      ctx.arc(x + tamanho / 2, y + tamanho / 2, lado / 2, 0, Math.PI * 2);
      ctx.fillStyle = visual.cor;
      ctx.fill();

      ctx.font = `bold ${Math.floor(tamanho * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillText(visual.simbolo, x + tamanho / 2, y + tamanho / 2 + tamanho * 0.02);
    }

    // Anel branco: separa o distintivo do bloco, seja ele claro ou escuro.
    ctx.beginPath();
    ctx.arc(x + tamanho / 2, y + tamanho / 2, lado / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = Math.max(1.5, tamanho * 0.06);
    ctx.stroke();

    ctx.restore();
  }

  /** Contorno claro que dá forma à sombra da peça. */
  contornarFantasma(ctx, x, y, tamanho) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = Math.max(1.5, tamanho * 0.055);
    const recuo = ctx.lineWidth / 2;
    ctx.strokeRect(x + recuo, y + recuo, tamanho - ctx.lineWidth, tamanho - ctx.lineWidth);
    ctx.restore();
  }

  /** Cada pintor concreto implementa só isto. */
  desenharBloco() {
    throw new Error('desenharBloco precisa ser implementado pelo pintor concreto');
  }

  /**
   * Marca de acessibilidade: quem não distingue as cores identifica a peça
   * pelo símbolo. Desenhado com contorno para ficar legível sobre qualquer fundo.
   */
  #desenharSimbolo(ctx, x, y, tamanho, simbolo) {
    ctx.save();
    ctx.font = `bold ${Math.floor(tamanho * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, tamanho * 0.08);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    const centroX = x + tamanho / 2;
    const centroY = y + tamanho / 2;
    ctx.strokeText(simbolo, centroX, centroY);
    ctx.fillText(simbolo, centroX, centroY);
    ctx.restore();
  }

  /**
   * Relevo comum: luz no topo/esquerda, sombra embaixo/direita.
   *
   * O contorno escuro é o que separa dois blocos vizinhos da MESMA cor — sem
   * ele, quatro peças amarelas encostadas viram uma mancha só e o jogador perde
   * a noção de onde cada peça termina.
   */
  aplicarRelevo(ctx, x, y, tamanho) {
    const espessura = Math.max(2, tamanho * 0.14);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.fillRect(x, y, tamanho, espessura);
    ctx.fillRect(x, y, espessura, tamanho);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(x, y + tamanho - espessura, tamanho, espessura);
    ctx.fillRect(x + tamanho - espessura, y, espessura, tamanho);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = Math.max(1, tamanho * 0.05);
    const recuo = ctx.lineWidth / 2;
    ctx.strokeRect(x + recuo, y + recuo, tamanho - ctx.lineWidth, tamanho - ctx.lineWidth);
  }
}

/** Bloco de cor sólida com relevo — a aparência atual do jogo. */
export class PintorDeCor extends PintorBase {
  /** @param {string} cor */
  constructor(cor) {
    super();
    this.cor = cor;
  }

  desenharBloco(ctx, x, y, tamanho) {
    ctx.fillStyle = this.cor;
    ctx.fillRect(x, y, tamanho, tamanho);
    this.aplicarRelevo(ctx, x, y, tamanho);
  }
}

/**
 * Bloco com textura desenhada em código (skin Retrô 8-bit).
 * Mostra que "aparência" não precisa ser cor nem arquivo de imagem.
 */
export class PintorDePadrao extends PintorBase {
  /**
   * @param {string} padrao  listrado | xadrez | pontilhado | diagonal | diagonal-inversa | moldura | cruz
   * @param {string} cor     cor de base
   */
  constructor(padrao, cor) {
    super();
    this.padrao = padrao;
    this.cor = cor;
  }

  desenharBloco(ctx, x, y, tamanho) {
    ctx.fillStyle = this.cor;
    ctx.fillRect(x, y, tamanho, tamanho);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    const passo = Math.max(3, Math.floor(tamanho / 4));

    switch (this.padrao) {
      case 'listrado':
        for (let i = 0; i < tamanho; i += passo * 2) {
          ctx.fillRect(x, y + i, tamanho, passo);
        }
        break;

      case 'xadrez':
        for (let linha = 0; linha < tamanho; linha += passo) {
          for (let coluna = 0; coluna < tamanho; coluna += passo) {
            if (((linha / passo) + (coluna / passo)) % 2 === 0) {
              ctx.fillRect(x + coluna, y + linha, passo, passo);
            }
          }
        }
        break;

      case 'pontilhado':
        for (let linha = passo / 2; linha < tamanho; linha += passo) {
          for (let coluna = passo / 2; coluna < tamanho; coluna += passo) {
            ctx.beginPath();
            ctx.arc(x + coluna, y + linha, passo * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'diagonal':
      case 'diagonal-inversa': {
        const inverso = this.padrao === 'diagonal-inversa';
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, tamanho, tamanho);
        ctx.clip();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.lineWidth = Math.max(2, passo * 0.5);
        for (let i = -tamanho; i < tamanho * 2; i += passo) {
          ctx.beginPath();
          if (inverso) {
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i - tamanho, y + tamanho);
          } else {
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + tamanho, y + tamanho);
          }
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'moldura':
        ctx.fillRect(x + passo, y + passo, tamanho - passo * 2, tamanho - passo * 2);
        break;

      case 'cruz':
        ctx.fillRect(x + tamanho / 2 - passo / 2, y, passo, tamanho);
        ctx.fillRect(x, y + tamanho / 2 - passo / 2, tamanho, passo);
        break;

      default:
        // Padrão desconhecido: fica só a cor de base, sem quebrar o desenho.
        break;
    }

    this.aplicarRelevo(ctx, x, y, tamanho);
  }
}

/**
 * ★ Bloco desenhado a partir de uma imagem — o destino final do projeto.
 *
 * Funciona hoje: é este pintor que entra em ação quando o jogador envia a
 * própria foto pela galeria de skins. Quando os PNGs dos rostos forem colocados
 * em assets/skins/, será exatamente o mesmo caminho de código.
 *
 * Enquanto a imagem não estiver carregada (ou se o arquivo faltar), delega
 * para um pintor de reserva. O tabuleiro nunca fica com blocos invisíveis.
 */
export class PintorDeImagem extends PintorBase {
  /**
   * @param {string} caminho                 arquivo ou dataURL
   * @param {import('./AssetLoader.js').AssetLoader} carregador
   * @param {PintorBase} pintorDeReserva     usado enquanto a imagem não chega
   */
  constructor(caminho, carregador, pintorDeReserva) {
    super();
    this.caminho = caminho;
    this.carregador = carregador;
    this.pintorDeReserva = pintorDeReserva;
  }

  desenharBloco(ctx, x, y, tamanho, opcoes) {
    const imagem = this.carregador.obter(this.caminho);

    if (!imagem) {
      // Ainda carregando, ou falhou: a reserva garante que o jogo continua legível.
      this.pintorDeReserva.desenharBloco(ctx, x, y, tamanho, opcoes);
      return;
    }

    // A imagem é esticada para o bloco. Fotos quadradas (128x128) não distorcem —
    // por isso a galeria recorta em quadrado antes de salvar.
    ctx.drawImage(imagem, x, y, tamanho, tamanho);

    // Contorno duplo — claro por dentro, escuro por fora. Fotos vizinhas costumam
    // ter tons parecidos, e um contorno de uma cor só some sobre metade delas.
    const espessura = Math.max(1, tamanho * 0.05);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = espessura;
    ctx.strokeRect(
      x + espessura * 1.5,
      y + espessura * 1.5,
      tamanho - espessura * 3,
      tamanho - espessura * 3,
    );

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = espessura;
    ctx.strokeRect(
      x + espessura / 2,
      y + espessura / 2,
      tamanho - espessura,
      tamanho - espessura,
    );
  }
}

/**
 * Fábrica: recebe a descrição de uma skin e devolve o pintor certo para uma peça.
 *
 * Para acrescentar um tipo de aparência novo, adicione um caso aqui e uma classe
 * acima. Nenhum outro arquivo do projeto precisa saber que ele existe.
 *
 * @param {import('./skins/catalogo.js').SkinDePeca} skin
 * @param {string} tipoDePeca
 * @param {import('./AssetLoader.js').AssetLoader} carregador
 * @param {string} corDeReserva
 * @returns {PintorBase}
 */
export function criarPintor(skin, tipoDePeca, carregador, corDeReserva) {
  const valor = skin.mapa?.[tipoDePeca];
  const cor = skin.cores?.[tipoDePeca] ?? corDeReserva;

  switch (skin.tipo) {
    case 'cor':
      return new PintorDeCor(valor ?? corDeReserva);

    case 'padrao':
      return new PintorDePadrao(valor ?? 'listrado', cor);

    case 'imagem':
      return new PintorDeImagem(valor, carregador, new PintorDeCor(cor));

    default:
      return new PintorDeCor(corDeReserva);
  }
}
