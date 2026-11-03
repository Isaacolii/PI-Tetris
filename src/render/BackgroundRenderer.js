/**
 * BackgroundRenderer.js — Desenha o plano de fundo da área de jogo.
 *
 * CAMADA: renderização.
 *
 * Segue a mesma ideia dos pintores de bloco: o fundo é escolhido por descrição
 * declarativa ('solido', 'gradiente', 'grade', 'imagem') e trocar de um para
 * outro não afeta nada além deste arquivo.
 */

export class BackgroundRenderer {
  /** @param {import('./AssetLoader.js').AssetLoader} carregador */
  constructor(carregador) {
    this.carregador = carregador;
  }

  /**
   * Pinta o fundo ocupando toda a área informada.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} largura
   * @param {number} altura
   * @param {import('./skins/catalogo.js').SkinDeFundo} skin
   */
  desenhar(ctx, largura, altura, skin) {
    switch (skin.tipo) {
      case 'solido':
        ctx.fillStyle = skin.cores?.[0] ?? '#12141c';
        ctx.fillRect(0, 0, largura, altura);
        break;

      case 'gradiente': {
        const gradiente = ctx.createLinearGradient(0, 0, largura, altura);
        const cores = skin.cores ?? ['#12141c', '#242938'];
        cores.forEach((cor, indice) => {
          gradiente.addColorStop(indice / Math.max(cores.length - 1, 1), cor);
        });
        ctx.fillStyle = gradiente;
        ctx.fillRect(0, 0, largura, altura);
        break;
      }

      case 'grade': {
        const [fundo, linha] = skin.cores ?? ['#0d0f16', '#1e2430'];
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, largura, altura);

        ctx.strokeStyle = linha;
        ctx.lineWidth = 1;
        const passo = 24;
        ctx.beginPath();
        for (let x = 0; x <= largura; x += passo) {
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, altura);
        }
        for (let y = 0; y <= altura; y += passo) {
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(largura, y + 0.5);
        }
        ctx.stroke();
        break;
      }

      case 'imagem': {
        const imagem = this.carregador.obter(skin.caminho);
        if (imagem) {
          // Cobre a área inteira preservando a proporção da foto (efeito "cover").
          const escala = Math.max(largura / imagem.width, altura / imagem.height);
          const larguraFinal = imagem.width * escala;
          const alturaFinal = imagem.height * escala;
          ctx.drawImage(
            imagem,
            (largura - larguraFinal) / 2,
            (altura - alturaFinal) / 2,
            larguraFinal,
            alturaFinal,
          );
          // Véu escuro para as peças continuarem legíveis sobre a foto.
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(0, 0, largura, altura);
        } else {
          // Ainda carregando: usa a cor de reserva.
          ctx.fillStyle = skin.cores?.[0] ?? '#12141c';
          ctx.fillRect(0, 0, largura, altura);
        }
        break;
      }

      default:
        ctx.fillStyle = '#12141c';
        ctx.fillRect(0, 0, largura, altura);
    }
  }

  /**
   * Reflete a skin de fundo também na página, através de variáveis CSS.
   * Mantém a moldura em volta do tabuleiro coerente com a área de jogo.
   * @param {import('./skins/catalogo.js').SkinDeFundo} skin
   */
  aplicarNaPagina(skin) {
    if (typeof document === 'undefined') return;
    const cores = skin.cores ?? ['#12141c'];
    const raiz = document.documentElement;

    if (skin.tipo === 'gradiente' && cores.length > 1) {
      raiz.style.setProperty('--fundo-pagina', `linear-gradient(160deg, ${cores.join(', ')})`);
    } else {
      raiz.style.setProperty('--fundo-pagina', cores[0]);
    }
    raiz.style.setProperty('--fundo-solido', cores[0]);
  }
}
