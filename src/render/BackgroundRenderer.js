/**
 * BackgroundRenderer.js — Desenha o plano de fundo da área de jogo.
 *
 * CAMADA: renderização.
 *
 * Segue a mesma ideia dos pintores de bloco: o fundo é escolhido por descrição
 * declarativa ('solido', 'gradiente', 'grade', 'imagem') e trocar de um para
 * outro não afeta nada além deste arquivo.
 */

/*
 * Quanto a superfície dos painéis se afasta da cor do fundo.
 *
 * O alvo é um cinza-azulado claro: misturar 12% dele com a cor do fundo
 * levanta a superfície o suficiente para o painel FLUTUAR, sem clarear a
 * ponto de o texto branco perder contraste.
 *
 * O valor saiu da relação que já existia no tema escuro original
 * (fundo #12141c, painel #191d28): a mesma conta aplicada ao carvão
 * devolve #1a1d28, praticamente o painel de antes.
 */
const ALVO_DA_SUPERFICIE = [0x5a, 0x6a, 0x8a];
const FORCA_DA_SUPERFICIE = 0.12;

/**
 * Mistura um hex com o alvo claro, na proporção dada.
 *
 * @param {string} hex       cor do fundo, no formato #rrggbb
 * @param {number} proporcao 0 devolve o hex, 1 devolve o alvo
 * @returns {string}
 */
function levantar(hex, proporcao) {
  const limpo = String(hex ?? '').replace('#', '');
  if (limpo.length !== 6) return hex;

  const canais = [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16));
  if (canais.some(Number.isNaN)) return hex;

  const misturado = canais.map((canal, i) =>
    Math.round(canal + (ALVO_DA_SUPERFICIE[i] - canal) * proporcao),
  );
  return `#${misturado.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

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
    } else if (skin.tipo === 'grade' && cores.length > 1) {
      /*
       * A grade também existe FORA do tabuleiro.
       *
       * Antes, a página recebia só a cor de fundo e as linhas ficavam presas
       * ao canvas: a skin "Grade técnica" parecia um sólido quase preto com
       * um retângulo quadriculado no meio. As duas camadas de gradiente
       * repetido desenham as mesmas linhas de 24px do BackgroundRenderer.
       */
      const [fundo, linha] = cores;
      raiz.style.setProperty(
        '--fundo-pagina',
        `repeating-linear-gradient(0deg, ${linha} 0 1px, transparent 1px 24px), ` +
          `repeating-linear-gradient(90deg, ${linha} 0 1px, transparent 1px 24px), ` +
          fundo,
      );
    } else {
      raiz.style.setProperty('--fundo-pagina', cores[0]);
    }

    raiz.style.setProperty('--fundo-solido', cores[0]);

    /*
     * As superfícies seguem a skin, em vez de ficarem num azul-escuro fixo.
     *
     * Sem isto, trocar o fundo para Ameixa deixava a página roxa e TODOS os
     * painéis — skins, professores, estatísticas, ranking, ajustes — num
     * azul-marinho que não tinha mais relação com nada na tela. Parecia uma
     * janela de outro programa colada por cima do jogo.
     */
    raiz.style.setProperty('--superficie-alta', levantar(cores[0], FORCA_DA_SUPERFICIE));

    // A barra do navegador no telefone é parte da moldura: se ela não
    // acompanha, a tela fica com uma faixa escura presa no topo.
    const marca = document.querySelector('meta[name="theme-color"]');
    if (marca) marca.setAttribute('content', cores[0]);
  }
}
