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
    brilho = 0.22,
  }) {
    if (this.particulas.length >= MAXIMO_DE_PARTICULAS) return;

    const cabem = Math.min(quantidade, MAXIMO_DE_PARTICULAS - this.particulas.length);

    for (let i = 0; i < cabem; i++) {
      const angulo =
        direcao === null
          ? Math.random() * Math.PI * 2
          : direcao + (Math.random() - 0.5) * abertura;

      const velocidade = (150 + Math.random() * 330) * forca;
      const lado = tamanho * (0.1 + Math.random() * 0.18);

      // Três formas misturadas em vez de só quadrados. Quadrado sozinho lê
      // como "bloco quebrado"; com círculo e estrela no meio, lê como doce
      // estourando — que é o efeito pedido.
      const sorteio = Math.random();
      const forma = sorteio < 0.45 ? 'quadrado' : sorteio < 0.82 ? 'circulo' : 'estrela';

      this.particulas.push({
        x: x + (Math.random() - 0.5) * tamanho * 0.7,
        y: y + (Math.random() - 0.5) * tamanho * 0.7,
        vx: Math.cos(angulo) * velocidade,
        // Impulso para cima generoso: o estilhaço SOBE antes de cair, e é esse
        // arco — não a velocidade — que dá a leitura saltitante.
        vy: Math.sin(angulo) * velocidade - 175 * forca,
        lado,
        cor,
        forma,
        rotacao: Math.random() * Math.PI,
        velocidadeAngular: (Math.random() - 0.5) * 14,
        vida: 1,
        // Partículas com vidas diferentes evitam que todas sumam no mesmo quadro.
        decaimento: 1 / (0.4 + Math.random() * 0.45),
        /*
         * Só uma minoria brilha, e QUANTO depende de quem chamou.
         *
         * A bomba pede mais fagulha: ela tem um clarão enorme no centro, e
         * com poucas os estilhaços sumiam dentro da própria luz. A limpeza
         * de linha pede menos: um Tetris solta quarenta blocos de uma vez,
         * e a mesma proporção vira macarronada branca sobre o tabuleiro.
         *
         * Um número só não serve para os dois — é a quantidade de partículas
         * que muda, não o gosto.
         */
        fagulha: Math.random() < brilho,

        // Fagulha quente: o estilhaço brilhante puxa para o branco-amarelo da
        // explosão, não para a cor do bloco. É o que separa "faísca" de
        // "pedaço do bloco voando".
        corDaFagulha: Math.random() < 0.5 ? '#fff3c4' : '#ffb13d',
      });
    }
  }

  /**
   * O estouro da própria célula: ela incha e some.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * É a peça que faltava para a explosão parecer de jogo de combinar doces.
   *
   * Antes, o bloco simplesmente sumia e os estilhaços apareciam do nada. O
   * olho não via o bloco ser destruído — via blocos a menos e sujeira no ar.
   * Com o estouro, o bloco cresce um instante antes de desaparecer, e aí os
   * fragmentos têm de onde ter saído.
   * ─────────────────────────────────────────────────────────────────────────
   */
  estourarCelula({ x, y, tamanho, cor }) {
    if (this.particulas.length >= MAXIMO_DE_PARTICULAS) return;

    this.particulas.push({
      tipo: 'estouro',
      x,
      y,
      lado: tamanho,
      cor,
      vida: 1,
      decaimento: 1 / 0.26,
      vx: 0,
      vy: 0,
      rotacao: 0,
      velocidadeAngular: 0,
    });
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

      // Faixa e estouro ficam onde nasceram: só envelhecem.
      if (p.tipo === 'faixa' || p.tipo === 'estouro') continue;

      // A posição do quadro anterior vira o rastro da fagulha. Guardar é mais
      // barato e mais fiel do que recalcular a partir da velocidade: já está
      // com o arrasto e a gravidade aplicados.
      p.anteriorX = p.x;
      p.anteriorY = p.y;

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

    // 2. Estouros das células, ATRÁS dos fragmentos: o bloco incha e os
    //    estilhaços saem por cima dele.
    for (const p of this.particulas) {
      if (p.tipo !== 'estouro') continue;
      this.#desenharEstouro(ctx, p);
    }

    // 3. Fragmentos com a cor do bloco de origem. É o que faz a explosão ser
    //    reconhecível: dá para ver de qual peça cada estilhaço saiu.
    for (const p of this.particulas) {
      if (p.tipo === 'faixa' || p.tipo === 'estouro' || p.fagulha) continue;
      this.#desenharFragmento(ctx, p);
    }

    // 4. Fagulhas brilhantes, em minoria e por cima.
    ctx.globalCompositeOperation = 'lighter';

    // 4a. O rastro primeiro: a faísca fica na ponta dele, não dentro.
    ctx.lineCap = 'round';
    for (const p of this.particulas) {
      if (p.tipo === 'faixa' || p.tipo === 'estouro' || !p.fagulha) continue;
      if (p.anteriorX === undefined) continue;

      const opacidade = Math.max(0, Math.min(1, p.vida));

      /*
       * O rastro tem teto.
       *
       * Ele nasce da distância percorrida no último quadro, e quadro longo
       * — aba que volta do segundo plano, máquina engasgando — produzia um
       * risco atravessando o tabuleiro. Com o teto, um engasgo encurta a
       * animação em vez de riscar a tela.
       */
      const dx = p.x - p.anteriorX;
      const dy = p.y - p.anteriorY;
      const distancia = Math.hypot(dx, dy);
      const teto = p.lado * 3.5;
      const escala = distancia > teto ? teto / distancia : 1;

      ctx.globalAlpha = opacidade * 0.5;
      ctx.strokeStyle = p.corDaFagulha ?? p.cor;
      ctx.lineWidth = p.lado * 0.5 * opacidade;
      ctx.beginPath();
      ctx.moveTo(p.x - dx * escala, p.y - dy * escala);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    for (const p of this.particulas) {
      if (p.tipo === 'faixa' || p.tipo === 'estouro' || !p.fagulha) continue;
      this.#desenharFragmento(ctx, p);
    }

    ctx.restore();
  }

  /**
   * O bloco inchando no instante em que é destruído.
   * Cresce até quase o dobro e some — nunca encolhe: encolher lê como
   * "sugado", e o que se quer aqui é "estourou".
   */
  #desenharEstouro(ctx, p) {
    const vida = Math.max(0, Math.min(1, p.vida));
    const progresso = 1 - vida;

    // Desacelera no fim (saída cúbica): o inchaço é rápido e então segura,
    // que é o tempo de o olho registrar qual bloco saiu.
    const avanco = 1 - Math.pow(1 - progresso, 3);
    const lado = p.lado * (1 + avanco * 0.95);
    const raio = lado * 0.22;

    ctx.save();
    ctx.globalAlpha = vida * 0.7;
    ctx.fillStyle = p.cor;
    ctx.beginPath();
    this.#caminhoArredondado(ctx, p.x - lado / 2, p.y - lado / 2, lado, lado, raio);
    ctx.fill();

    // Contorno branco fino, para o estouro aparecer mesmo sobre um bloco da
    // mesma cor que ficou atrás.
    ctx.globalAlpha = vida * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, p.lado * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  /** Retângulo de cantos arredondados, sem depender de roundRect. */
  #caminhoArredondado(ctx, x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + largura - r, y);
    ctx.quadraticCurveTo(x + largura, y, x + largura, y + r);
    ctx.lineTo(x + largura, y + altura - r);
    ctx.quadraticCurveTo(x + largura, y + altura, x + largura - r, y + altura);
    ctx.lineTo(x + r, y + altura);
    ctx.quadraticCurveTo(x, y + altura, x, y + altura - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  #desenharFragmento(ctx, p) {
    const opacidade = Math.max(0, Math.min(1, p.vida));

    ctx.globalAlpha = opacidade;
    ctx.fillStyle = p.fagulha ? (p.corDaFagulha ?? p.cor) : p.cor;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotacao);
    // Encolhe ao morrer: some por tamanho E por opacidade ao mesmo tempo.
    const lado = p.lado * (0.4 + opacidade * 0.6);

    if (p.forma === 'circulo') {
      ctx.beginPath();
      ctx.arc(0, 0, lado / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.forma === 'estrela') {
      this.#desenharEstrela(ctx, lado / 2);
    } else {
      ctx.fillRect(-lado / 2, -lado / 2, lado, lado);
    }

    ctx.restore();
  }

  /** Estrela de cinco pontas, centrada na origem. */
  #desenharEstrela(ctx, raio) {
    const pontas = 5;
    const interno = raio * 0.45;

    ctx.beginPath();
    for (let i = 0; i < pontas * 2; i++) {
      const r = i % 2 === 0 ? raio : interno;
      const angulo = (i * Math.PI) / pontas - Math.PI / 2;
      const x = Math.cos(angulo) * r;
      const y = Math.sin(angulo) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Quantas partículas estão vivas — usado nos testes e na depuração. */
  get quantidade() {
    return this.particulas.length;
  }
}
