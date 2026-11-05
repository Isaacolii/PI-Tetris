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

/**
 * O jeito de explodir de cada bomba.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Cinco bombas iguais seriam cinco cores diferentes do mesmo efeito. O que
 * diferencia uma da outra aqui é a FORMA da onda, e ela vem do tema de cada
 * professor — quem lê a onda já sabe o que vai acontecer com a pilha, antes
 * mesmo de o estrago aparecer.
 *
 *   escalaX / escalaY  esticam a onda; uma onda achatada "varre a linha",
 *                      uma onda alta "desce a coluna".
 *   ritmo              multiplica a velocidade: o professor do Tempo é o
 *                      único cuja onda se arrasta.
 * ───────────────────────────────────────────────────────────────────────────
 */
const SABOR_DA_BOMBA = {
  A: { escalaX: 1, escalaY: 1, ritmo: 1.15 },      // Explosão: redonda e seca
  B: { escalaX: 1.7, escalaY: 0.5, ritmo: 1.1 },   // Linha: varre na horizontal
  C: { escalaX: 0.5, escalaY: 1.7, ritmo: 1.1 },   // Coluna: desce na vertical
  D: { escalaX: 1.15, escalaY: 1.15, ritmo: 0.85 }, // Conversão: larga e macia
  E: { escalaX: 1.3, escalaY: 1.3, ritmo: 0.6 },   // Tempo: lenta, como o poder
};

const SABOR_PADRAO = { escalaX: 1, escalaY: 1, ritmo: 1 };

/** '#rgb' ou '#rrggbb' para [r, g, b]. */
function paraCanais(hex) {
  const limpo = (hex ?? '#ffffff').replace('#', '');
  const cheio = limpo.length === 3 ? limpo.replace(/./g, (c) => c + c) : limpo;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16));
}

/**
 * Mistura duas cores pelo MATIZ, não pela média dos canais.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A média canal a canal parece a escolha óbvia e dá errado: vermelho com azul
 * resultava em #a08ba9, um lilás acinzentado. Canais opostos se cancelam e o
 * resultado desaba para o cinza — justo o contrário de uma explosão.
 *
 * Misturar o matiz pelo arco mais curto, guardando a MAIOR saturação das duas,
 * dá o que o olho espera de tinta: vermelho com azul vira roxo, azul com
 * laranja vira o verde que fica entre eles. A cor continua viva, e dá para
 * ver que ela nasceu de outras duas.
 * ───────────────────────────────────────────────────────────────────────────
 */
function misturarCores(primeira, segunda) {
  const [h1, s1, l1] = paraHsl(primeira);
  const [h2, s2, l2] = paraHsl(segunda);

  // Arco mais curto entre os dois matizes: 10° com 350° tem de dar 0°, não 180°.
  let diferenca = h2 - h1;
  if (diferenca > 180) diferenca -= 360;
  if (diferenca < -180) diferenca += 360;

  const matiz = (h1 + diferenca / 2 + 360) % 360;

  return hslParaHex(matiz, Math.max(s1, s2), (l1 + l2) / 2);
}

function paraHsl(hex) {
  const [r, g, b] = paraCanais(hex).map((v) => v / 255);
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const luz = (maior + menor) / 2;

  if (maior === menor) return [0, 0, luz];

  const d = maior - menor;
  const saturacao = luz > 0.5 ? d / (2 - maior - menor) : d / (maior + menor);

  let matiz;
  if (maior === r) matiz = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (maior === g) matiz = ((b - r) / d + 2) / 6;
  else matiz = ((r - g) / d + 4) / 6;

  return [matiz * 360, saturacao, luz];
}

function hslParaHex(matiz, saturacao, luz) {
  const h = ((matiz % 360) + 360) % 360 / 360;

  const canal = (p, q, t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  if (saturacao === 0) {
    const v = Math.round(luz * 255);
    return '#' + [v, v, v].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  const q = luz < 0.5 ? luz * (1 + saturacao) : luz + saturacao - luz * saturacao;
  const p = 2 * luz - q;

  const rgb = [canal(p, q, h + 1 / 3), canal(p, q, h), canal(p, q, h - 1 / 3)]
    .map((v) => Math.round(v * 255));

  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Quanto tempo cada efeito leva para desaparecer. */
const DURACAO_MS = 720;

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

    // Aceita um visual só (poder individual) ou a lista dos dois (combinação).
    const visuais = Array.isArray(visual) ? visual : [visual];
    const cores = visuais.map((v) => v?.cor ?? '#ffffff');

    const professores = relatorio.professores ?? [];
    const sabores = professores.map((id) => SABOR_DA_BOMBA[id] ?? SABOR_PADRAO);
    const sabor = sabores.length
      ? {
          // Duas bombas juntas: a onda fica entre as duas formas. Linha com
          // coluna vira quase um círculo, que é exatamente a Cruz Acadêmica.
          escalaX: sabores.reduce((s, x) => s + x.escalaX, 0) / sabores.length,
          escalaY: sabores.reduce((s, x) => s + x.escalaY, 0) / sabores.length,
          ritmo: sabores.reduce((s, x) => s + x.ritmo, 0) / sabores.length,
        }
      : SABOR_PADRAO;

    this.ativos.push({
      celulas: relatorio.celulas ?? [],
      linhas: relatorio.linhasAtingidas ?? [],
      colunas: relatorio.colunasAtingidas ?? [],
      ponto: relatorio.ponto ?? null,
      nome: relatorio.nome ?? '',
      cor: cores.length > 1 ? misturarCores(cores[0], cores[1]) : cores[0],
      cores,
      sabor,
      restanteMs: DURACAO_MS / sabor.ritmo,
      duracaoMs: DURACAO_MS / sabor.ritmo,
    });

    // Trava de segurança: se muitos poderes dispararem em sequência num
    // ambiente sem quadros, a lista não pode crescer sem limite.
    if (this.ativos.length > 12) this.ativos.splice(0, this.ativos.length - 12);
  }

  /** Converte '#rrggbb' em 'rgba(r, g, b, a)', para usar em gradiente. */
  #comAlfa(hex, alfa) {
    const [r, g, b] = paraCanais(hex);
    return `rgba(${r}, ${g}, ${b}, ${alfa})`;
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
      // A duração é do efeito, não global: a bomba do Tempo dura mais.
      const progresso = 1 - efeito.restanteMs / (efeito.duracaoMs ?? DURACAO_MS);
      const opacidade = 1 - progresso;

      ctx.save();
      ctx.globalAlpha = Math.max(opacidade, 0);

      /*
       * Faixas marcando as linhas e colunas atingidas.
       *
       * Estavam em 45% de opacidade por toda a duração, e cobrem muita área:
       * numa Cruz Acadêmica o tabuleiro inteiro virava um retângulo da cor do
       * professor, e os estilhaços coloridos sumiam dentro dele. A faixa é
       * para dizer ONDE o poder passou, não para pintar a tela.
       */
      const forcaDaFaixa = Math.pow(opacidade, 2.2) * 0.38;
      ctx.fillStyle = efeito.cor;
      for (const linha of efeito.linhas) {
        const y = (linha - linhasOcultas) * tamanhoDaCelula;
        if (y + tamanhoDaCelula < 0) continue;
        ctx.globalAlpha = Math.max(forcaDaFaixa, 0);
        ctx.fillRect(0, y, largura, tamanhoDaCelula);
      }
      for (const coluna of efeito.colunas) {
        ctx.globalAlpha = Math.max(forcaDaFaixa, 0);
        ctx.fillRect(coluna * tamanhoDaCelula, 0, tamanhoDaCelula, altura);
      }

      /*
       * Clarão em cada célula atingida, INCHANDO para fora.
       *
       * A primeira versão encolhia o quadrado conforme o efeito passava, e o
       * resultado lia como se o bloco estivesse sendo sugado para dentro. Um
       * poder destrói; o gesto tem que ser para fora.
       */
      const crescimento = Math.pow(progresso, 0.7) * tamanhoDaCelula * 0.5;
      // Some mais depressa do que cresce, senão o branco toma o tabuleiro.
      // O estouro colorido de cada bloco já marca a célula; este clarão é só
      // o pontapé do primeiro quadro.
      // Baixo de propósito: o clarão e o anel é que carregam a luz agora.
      // Com o branco forte aqui, os blocos atingidos ficavam pálidos e a
      // explosão parecia desbotar em vez de estourar.
      ctx.globalAlpha = Math.max(Math.pow(opacidade, 3) * 0.45, 0);
      ctx.fillStyle = '#ffffff';
      for (const celula of efeito.celulas) {
        const y = (celula.linha - linhasOcultas) * tamanhoDaCelula;
        if (y + tamanhoDaCelula < 0) continue;
        ctx.fillRect(
          celula.coluna * tamanhoDaCelula - crescimento,
          y - crescimento,
          tamanhoDaCelula + crescimento * 2,
          tamanhoDaCelula + crescimento * 2,
        );
      }

      /*
       * Onda de choque saindo do ponto da combinação.
       *
       * ─────────────────────────────────────────────────────────────────────
       * UM ANEL FINO NÃO LÊ COMO BOMBA.
       *
       * A versão anterior traçava duas linhas finas que se apagavam. Bomba de
       * jogo tem outra anatomia, e ela é construída em camadas somadas:
       *
       *   1. um clarão branco no centro, que nasce enorme e morre depressa;
       *   2. um anel GROSSO, com o miolo branco e a borda na cor de quem
       *      disparou;
       *   3. um halo largo e fraco em volta, que é o que faz o resto parecer
       *      estar brilhando.
       *
       * Tudo em composição aditiva: onde as camadas se cruzam a soma satura
       * para branco sozinha, que é exatamente o núcleo quente da explosão. É
       * o mesmo motivo de as fagulhas serem minoria — aditivo sem limite vira
       * mancha branca; aditivo em poucas camadas vira brilho.
       * ─────────────────────────────────────────────────────────────────────
       */
      if (efeito.ponto) {
        const centroX = (efeito.ponto.coluna + 0.5) * tamanhoDaCelula;
        const centroY = (efeito.ponto.linha - linhasOcultas + 0.5) * tamanhoDaCelula;

        /*
         * Saída rápida, mas não explosiva demais.
         *
         * Com expoente 2,2 a onda chegava à borda do tabuleiro em menos de
         * um terço da animação, e passava o resto do tempo como um aro fino
         * e apagado. 1,7 mantém a sensação de impacto e deixa o anel GROSSO
         * em cena durante a parte que o olho realmente acompanha.
         */
        const avanco = 1 - Math.pow(1 - progresso, 1.7);
        // A onda vai bem além do 3×3 que ela destrói: é assim que bomba de
        // jogo se lê — o estrago é pequeno, o susto é grande.
        const raio = tamanhoDaCelula * (0.3 + avanco * 4.6);

        const sabor = efeito.sabor ?? SABOR_PADRAO;
        const cores = efeito.cores?.length ? efeito.cores : [efeito.cor];

        // Elipse, não círculo: a forma é o que diz qual bomba estourou.
        // Achatada varre a linha, alta desce a coluna, redonda explode em volta.
        const tracarOnda = (escala) => {
          ctx.beginPath();
          ctx.ellipse(
            centroX,
            centroY,
            Math.max(1, raio * sabor.escalaX * escala),
            Math.max(1, raio * sabor.escalaY * escala),
            0,
            0,
            Math.PI * 2,
          );
        };

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // ── 1. Clarão central ──
        // Só no primeiro terço: é o estouro, não a fumaça.
        if (progresso < 0.5) {
          const forcaDoClarao = 1 - progresso / 0.5;
          const raioDoClarao = tamanhoDaCelula * (1.8 + progresso * 4.2);

          const brilho = ctx.createRadialGradient(
            centroX, centroY, 0,
            centroX, centroY, raioDoClarao,
          );
          // O meio é branco em qualquer bomba — é a temperatura, não a cor.
          // A borda do clarão é que leva a cor (ou a mistura das duas).
          brilho.addColorStop(0, `rgba(255, 255, 255, ${forcaDoClarao})`);
          brilho.addColorStop(0.18, `rgba(255, 244, 200, ${0.92 * forcaDoClarao})`);
          brilho.addColorStop(0.45, this.#comAlfa(efeito.cor, 0.55 * forcaDoClarao));
          brilho.addColorStop(1, this.#comAlfa(efeito.cor, 0));

          ctx.globalAlpha = 1;
          ctx.fillStyle = brilho;
          ctx.beginPath();
          ctx.arc(centroX, centroY, raioDoClarao, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── 2 e 3. Anel grosso e halo ──
        // O halo vai primeiro, por baixo, e é o que dá o brilho em volta.
        /*
         * Com DUAS bombas, cada cor ganha o seu aro, em raios ligeiramente
         * diferentes — o olho vê as duas e a sobreposição produz a mistura
         * sozinha, pela soma aditiva. Pintar só a cor média esconderia de quem
         * foi a jogada; pintar os dois aros separados conta a história toda.
         */
        const camadas = [];
        cores.forEach((cor, indice) => {
          const escala = 1 - indice * 0.14;
          camadas.push({ peso: 0.95 / cores.length, forca: 0.3, cor, desfoque: 26, escala });
          camadas.push({ peso: 0.42, forca: 0.85, cor, desfoque: 18, escala });
        });
        camadas.push({ peso: 0.14, forca: 1, cor: '#ffffff', desfoque: 10, escala: 1 });

        for (const camada of camadas) {
          // Afinar e apagar juntos matava o anel na metade do caminho. A
          // espessura cede pouco (0,4) e a opacidade cai quase linear, então
          // o aro chega grande AINDA aceso — que é o quadro da referência.
          ctx.globalAlpha = Math.max(Math.pow(1 - avanco, 0.95) * camada.forca, 0);
          ctx.strokeStyle = camada.cor;
          ctx.shadowColor = camada.cor;
          ctx.shadowBlur = camada.desfoque * (1 - avanco * 0.5);
          ctx.lineWidth = Math.max(2, tamanhoDaCelula * camada.peso * (1 - avanco * 0.4));
          tracarOnda(camada.escala);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore();
    }
  }
}
