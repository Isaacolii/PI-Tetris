/**
 * Particulas.js — Sistema de partículas do tabuleiro.
 *
 * CAMADA: renderização.
 *
 * Cada partícula é um fragmento de bloco com física simples: velocidade,
 * gravidade, rotação e tempo de vida. É o que transforma "os blocos sumiram"
 * em "os blocos foram destruídos".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DECORATIVO POR CONSTRUÇÃO
 *
 * Nada aqui influencia a partida. Quando uma partícula nasce, o tabuleiro já
 * foi resolvido: os blocos saíram, os pontos foram contados, a próxima peça já
 * está caindo. Se o navegador não desenhar um único quadro, o jogo corre igual.
 *
 * Isso não é preciosismo — é o que mantém a lógica testável fora do navegador e
 * protege contra ambientes que não compõem quadros.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Teto de partículas vivas. Acima disso o ganho visual some e o custo fica. */
const MAXIMO_DE_PARTICULAS = 900;

/** Aceleração da gravidade, em pixels por segundo ao quadrado. */
const GRAVIDADE = 2400;

/** Atrito do ar por segundo — segura as partículas horizontais. */
const ARRASTO = 0.86;

export class SistemaDeParticulas {
  constructor() {
    this.particulas = [];
    /** Deslocamento do tabuleiro inteiro, para o tranco das eliminações grandes. */
    this.tremor = { x: 0, y: 0, intensidade: 0, restanteMs: 0 };
  }

  limpar() {
    this.particulas.length = 0;
    this.tremor = { x: 0, y: 0, intensidade: 0, restanteMs: 0 };
  }

  get temAlgoParaDesenhar() {
    return this.particulas.length > 0 || this.tremor.restanteMs > 0;
  }

  /**
   * Cria um jato de partículas a partir de um bloco.
   *
   * @param {Object} opcoes
   * @param {number} opcoes.x           centro do bloco, em pixels do tabuleiro
   * @param {number} opcoes.y
   * @param {number} opcoes.tamanho     lado do bloco
   * @param {string} opcoes.cor
   * @param {number} [opcoes.quantidade]
   * @param {number} [opcoes.forca]     multiplicador da velocidade inicial
   * @param {number} [opcoes.direcao]   ângulo preferencial em radianos; sem ele, espalha em círculo
   * @param {number} [opcoes.abertura]  quanto o jato abre em torno da direção
   */
  explodirBloco({
    x,
    y,
    tamanho,
    cor,
    quantidade = 7,
    forca = 1,
    direcao = null,
    abertura = Math.PI * 2,
  }) {
    if (this.particulas.length >= MAXIMO_DE_PARTICULAS) return;

    const cabem = Math.min(quantidade, MAXIMO_DE_PARTICULAS - this.particulas.length);

    for (let i = 0; i < cabem; i++) {
      const angulo =
        direcao === null
          ? Math.random() * Math.PI * 2
          : direcao + (Math.random() - 0.5) * abertura;

      const velocidade = (140 + Math.random() * 300) * forca;
      const lado = tamanho * (0.1 + Math.random() * 0.16);

      this.particulas.push({
        x: x + (Math.random() - 0.5) * tamanho * 0.7,
        y: y + (Math.random() - 0.5) * tamanho * 0.7,
        vx: Math.cos(angulo) * velocidade,
        vy: Math.sin(angulo) * velocidade - 90 * forca, // impulso para cima
        lado,
        cor,
        rotacao: Math.random() * Math.PI,
        velocidadeAngular: (Math.random() - 0.5) * 14,
        vida: 1,
        // Partículas com vidas diferentes evitam que todas sumam no mesmo quadro.
        decaimento: 1 / (0.4 + Math.random() * 0.45),
        // Só uma minoria brilha. Se todas fossem aditivas, quarenta blocos
        // explodindo juntos somariam luz até virar uma mancha branca — foi
        // exatamente o que aconteceu na primeira versão de um Tetris.
        fagulha: Math.random() < 0.22,
      });
    }
  }

  /**
   * Faixa de luz que atravessa uma linha limpa.
   * É desenhada como partícula para acompanhar o mesmo ciclo de vida do resto.
   */
  brilhoDeLinha({ y, largura, altura, cor }) {
    this.particulas.push({
      tipo: 'faixa',
      x: 0,
      y,
      largura,
      lado: altura,
      cor,
      vida: 1,
      decaimento: 1 / 0.45,
      vx: 0,
      vy: 0,
      rotacao: 0,
      velocidadeAngular: 0,
    });
  }

  /**
   * Sacode o tabuleiro.
   * @param {number} intensidade  em pixels
   * @param {number} duracaoMs
   */
  sacudir(intensidade, duracaoMs = 260) {
    // Um tranco novo não soma ao anterior: sobrepõe se for mais forte. Somar
    // faria uma sequência de eliminações embaralhar a tela inteira.
    if (intensidade <= this.tremor.intensidade && this.tremor.restanteMs > 0) return;
    this.tremor = { x: 0, y: 0, intensidade, restanteMs: duracaoMs, duracaoTotal: duracaoMs };
  }

  /**
   * Avança a física.
   * @param {number} deltaMs
   */
  atualizar(deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000; // trava contra quadros muito longos

    for (const p of this.particulas) {
      p.vida -= p.decaimento * dt;

      if (p.tipo === 'faixa') continue;

      p.vy += GRAVIDADE * dt;
      p.vx *= Math.pow(ARRASTO, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotacao += p.velocidadeAngular * dt;
    }

    this.particulas = this.particulas.filter((p) => p.vida > 0);

    if (this.tremor.restanteMs > 0) {
      this.tremor.restanteMs -= deltaMs;
      const progresso = Math.max(this.tremor.restanteMs, 0) / this.tremor.duracaoTotal;
      const forca = this.tremor.intensidade * progresso * progresso;
      this.tremor.x = (Math.random() - 0.5) * 2 * forca;
      this.tremor.y = (Math.random() - 0.5) * 2 * forca;
      if (this.tremor.restanteMs <= 0) this.tremor = { x: 0, y: 0, intensidade: 0, restanteMs: 0 };
    }
  }

  /**
   * Desenha tudo. As coordenadas já estão no sistema do tabuleiro.
   * @param {CanvasRenderingContext2D} ctx
   */
  desenhar(ctx) {
    if (this.particulas.length === 0) return;

    ctx.save();

    // Ordem importa: faixas primeiro (fundo), depois os fragmentos coloridos,
    // e só então as fagulhas aditivas por cima. Misturar tudo num laço só
    // obrigaria a trocar de modo de composição dezenas de vezes por quadro.

    // 1. Faixas de luz atravessando as linhas eliminadas.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particulas) {
      if (p.tipo !== 'faixa') continue;
      const opacidade = Math.max(0, Math.min(1, p.vida));
      const gradiente = ctx.createLinearGradient(0, p.y, p.largura, p.y);
      // Clarão contido: a faixa marca ONDE a linha saiu, não apaga o tabuleiro.
      gradiente.addColorStop(0, 'rgba(255,255,255,0)');
      gradiente.addColorStop(0.5, `rgba(255,255,255,${opacidade * 0.34})`);
      gradiente.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradiente;
      ctx.fillRect(0, p.y, p.largura, p.lado);
    }

    // 2. Fragmentos com a cor do bloco de origem. É o que faz a explosão ser
    //    reconhecível: dá para ver de qual peça cada estilhaço saiu.
    for (const p of this.particulas) {
      if (p.tipo === 'faixa' || p.fagulha) continue;
      this.#desenharFragmento(ctx, p);
    }

    // 3. Fagulhas brilhantes, em minoria e por cima.
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particulas) {
      if (p.tipo === 'faixa' || !p.fagulha) continue;
      this.#desenharFragmento(ctx, p);
    }

    ctx.restore();
  }

  #desenharFragmento(ctx, p) {
    const opacidade = Math.max(0, Math.min(1, p.vida));

    ctx.globalAlpha = opacidade;
    ctx.fillStyle = p.cor;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotacao);
    // Encolhe ao morrer: some por tamanho E por opacidade ao mesmo tempo.
    const lado = p.lado * (0.4 + opacidade * 0.6);
    ctx.fillRect(-lado / 2, -lado / 2, lado, lado);
    ctx.restore();
  }

  /** Quantas partículas estão vivas — usado nos testes e na depuração. */
  get quantidade() {
    return this.particulas.length;
  }
}
