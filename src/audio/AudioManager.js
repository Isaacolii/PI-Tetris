/**
 * AudioManager.js — Efeitos sonoros e trilha, gerados em tempo real.
 *
 * CAMADA: áudio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE NÃO HÁ NENHUM ARQUIVO .mp3 NESTE PROJETO
 *
 *  Todo o som é SINTETIZADO pela Web Audio API (osciladores e envelopes), sem
 *  um único arquivo externo. A decisão é deliberada:
 *
 *   • nada para baixar — o jogo continua funcionando offline, no modo PWA;
 *   • nenhuma dependência de site de terceiros que possa sair do ar na véspera
 *     da apresentação;
 *   • nenhuma dúvida sobre licença de uso: a música é gerada por este código.
 *
 *  Se um dia você quiser usar arquivos de áudio próprios, o gancho já existe:
 *  veja `registrarAmostra` no fim do arquivo. A troca não afeta o resto do jogo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Notas usadas pela trilha, em hertz (escala de lá menor pentatônica). */
const NOTAS = {
  la2: 110.0,
  do3: 130.81,
  re3: 146.83,
  mi3: 164.81,
  sol3: 196.0,
  la3: 220.0,
  do4: 261.63,
  re4: 293.66,
  mi4: 329.63,
  sol4: 392.0,
  la4: 440.0,
  do5: 523.25,
  mi5: 659.25,
};

/**
 * Receitas dos efeitos. Cada uma é uma lista de notas com forma de onda,
 * frequência, momento de início e duração — em segundos, relativos ao disparo.
 */
const EFEITOS = {
  mover: [{ onda: 'square', frequencia: 220, inicio: 0, duracao: 0.04, volume: 0.18 }],

  girar: [{ onda: 'square', frequencia: 330, inicio: 0, duracao: 0.05, volume: 0.2 }],

  encaixe: [
    { onda: 'triangle', frequencia: 160, inicio: 0, duracao: 0.08, volume: 0.3 },
    { onda: 'sine', frequencia: 80, inicio: 0, duracao: 0.12, volume: 0.25 },
  ],

  guardar: [
    { onda: 'sine', frequencia: 392, inicio: 0, duracao: 0.06, volume: 0.2 },
    { onda: 'sine', frequencia: 523.25, inicio: 0.05, duracao: 0.08, volume: 0.2 },
  ],

  queda: [{ onda: 'sawtooth', frequencia: 120, inicio: 0, duracao: 0.1, volume: 0.22 }],

  // Uma linha: arpejo curto para cima.
  linha1: [
    { onda: 'square', frequencia: NOTAS.la3, inicio: 0, duracao: 0.08, volume: 0.25 },
    { onda: 'square', frequencia: NOTAS.do4, inicio: 0.07, duracao: 0.1, volume: 0.25 },
  ],

  linha2: [
    { onda: 'square', frequencia: NOTAS.la3, inicio: 0, duracao: 0.07, volume: 0.25 },
    { onda: 'square', frequencia: NOTAS.do4, inicio: 0.06, duracao: 0.07, volume: 0.25 },
    { onda: 'square', frequencia: NOTAS.mi4, inicio: 0.12, duracao: 0.12, volume: 0.25 },
  ],

  linha3: [
    { onda: 'square', frequencia: NOTAS.la3, inicio: 0, duracao: 0.07, volume: 0.26 },
    { onda: 'square', frequencia: NOTAS.do4, inicio: 0.06, duracao: 0.07, volume: 0.26 },
    { onda: 'square', frequencia: NOTAS.mi4, inicio: 0.12, duracao: 0.07, volume: 0.26 },
    { onda: 'square', frequencia: NOTAS.la4, inicio: 0.18, duracao: 0.14, volume: 0.26 },
  ],

  // Tetris: quatro linhas de uma vez merece fanfarra.
  linha4: [
    { onda: 'square', frequencia: NOTAS.la3, inicio: 0, duracao: 0.07, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.mi4, inicio: 0.06, duracao: 0.07, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.la4, inicio: 0.12, duracao: 0.07, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.do5, inicio: 0.18, duracao: 0.07, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.mi5, inicio: 0.24, duracao: 0.22, volume: 0.32 },
    { onda: 'triangle', frequencia: NOTAS.la2, inicio: 0.24, duracao: 0.22, volume: 0.2 },
  ],

  nivel: [
    { onda: 'sine', frequencia: NOTAS.do4, inicio: 0, duracao: 0.1, volume: 0.28 },
    { onda: 'sine', frequencia: NOTAS.mi4, inicio: 0.09, duracao: 0.1, volume: 0.28 },
    { onda: 'sine', frequencia: NOTAS.sol4, inicio: 0.18, duracao: 0.1, volume: 0.28 },
    { onda: 'sine', frequencia: NOTAS.do5, inicio: 0.27, duracao: 0.25, volume: 0.3 },
  ],

  fimDeJogo: [
    { onda: 'sawtooth', frequencia: NOTAS.la3, inicio: 0, duracao: 0.18, volume: 0.28 },
    { onda: 'sawtooth', frequencia: NOTAS.sol3, inicio: 0.17, duracao: 0.18, volume: 0.28 },
    { onda: 'sawtooth', frequencia: NOTAS.mi3, inicio: 0.34, duracao: 0.2, volume: 0.28 },
    { onda: 'sawtooth', frequencia: NOTAS.la2, inicio: 0.52, duracao: 0.6, volume: 0.3 },
  ],

  objetivo: [
    { onda: 'square', frequencia: NOTAS.do4, inicio: 0, duracao: 0.09, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.mi4, inicio: 0.08, duracao: 0.09, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.sol4, inicio: 0.16, duracao: 0.09, volume: 0.3 },
    { onda: 'square', frequencia: NOTAS.do5, inicio: 0.24, duracao: 0.3, volume: 0.32 },
  ],
};

/**
 * Trilha: sequência de graus da escala tocada em laço.
 * Não é a música de nenhum outro jogo — é uma progressão própria, gerada aqui.
 */
const TRILHA = [
  NOTAS.la3, NOTAS.do4, NOTAS.mi4, NOTAS.do4,
  NOTAS.sol3, NOTAS.re4, NOTAS.sol4, NOTAS.re4,
  NOTAS.la3, NOTAS.mi4, NOTAS.la4, NOTAS.mi4,
  NOTAS.sol3, NOTAS.do4, NOTAS.mi4, NOTAS.sol3,
];

/** Baixo, uma nota por compasso de quatro. */
const BAIXO = [NOTAS.la2, NOTAS.sol3 / 2, NOTAS.la2, NOTAS.sol3 / 2];

/** Duração de cada nota da trilha, em segundos. */
const DURACAO_DA_NOTA = 0.22;

export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} criado só depois do primeiro toque do jogador. */
    this.contexto = null;
    this.ganhoPrincipal = null;
    this.ganhoDosEfeitos = null;
    this.ganhoDaTrilha = null;

    this.volumeDosEfeitos = 0.7;
    this.volumeDaTrilha = 0.35;
    this.efeitosLigados = true;
    this.trilhaLigada = false;

    this._trilhaTocando = false;
    this._proximaNota = 0;
    this._indiceDaNota = 0;
    this._agendador = null;

    /** Gancho para arquivos de áudio futuros: nome -> AudioBuffer. */
    this.amostras = new Map();
  }

  /**
   * Cria o contexto de áudio.
   *
   * Precisa ser chamado a partir de uma ação do jogador (clique ou tecla):
   * os navegadores bloqueiam áudio iniciado sem interação, e um contexto criado
   * cedo demais nasce suspenso e nunca toca nada.
   */
  inicializar() {
    if (this.contexto) {
      // Voltando de outra aba o contexto pode estar suspenso.
      if (this.contexto.state === 'suspended') this.contexto.resume();
      return true;
    }

    const Construtor = window.AudioContext || window.webkitAudioContext;
    if (!Construtor) {
      console.warn('[AudioManager] Este navegador não tem Web Audio API; o jogo seguirá mudo.');
      return false;
    }

    this.contexto = new Construtor();

    this.ganhoPrincipal = this.contexto.createGain();
    this.ganhoPrincipal.connect(this.contexto.destination);

    this.ganhoDosEfeitos = this.contexto.createGain();
    this.ganhoDosEfeitos.gain.value = this.volumeDosEfeitos;
    this.ganhoDosEfeitos.connect(this.ganhoPrincipal);

    this.ganhoDaTrilha = this.contexto.createGain();
    this.ganhoDaTrilha.gain.value = this.volumeDaTrilha;
    this.ganhoDaTrilha.connect(this.ganhoPrincipal);

    return true;
  }

  /** Está pronto para tocar? */
  get disponivel() {
    return this.contexto !== null && this.contexto.state === 'running';
  }

  // ───────────────────────────── Efeitos ─────────────────────────────

  /**
   * Toca um efeito pelo nome.
   * @param {string} nome  chave de EFEITOS (ou de uma amostra registrada)
   */
  tocar(nome) {
    if (!this.efeitosLigados || !this.contexto) return;
    if (this.contexto.state === 'suspended') this.contexto.resume();

    // Se existir um arquivo registrado com este nome, ele tem prioridade.
    if (this.amostras.has(nome)) {
      this.#tocarAmostra(nome);
      return;
    }

    const receita = EFEITOS[nome];
    if (!receita) return;

    const agora = this.contexto.currentTime;
    for (const nota of receita) {
      this.#tocarNota({ ...nota, quando: agora + nota.inicio, saida: this.ganhoDosEfeitos });
    }
  }

  /** Atalho: o som da limpeza depende de quantas linhas saíram. */
  tocarLimpeza(quantidadeDeLinhas) {
    this.tocar(`linha${Math.min(Math.max(quantidadeDeLinhas, 1), 4)}`);
  }

  /**
   * Toca uma nota: oscilador + envelope para não estalar.
   * O envelope (subida rápida, descida suave) é o que diferencia um som musical
   * de um "clique" desagradável.
   */
  #tocarNota({ onda, frequencia, duracao, volume, quando, saida }) {
    const oscilador = this.contexto.createOscillator();
    const envelope = this.contexto.createGain();

    oscilador.type = onda;
    oscilador.frequency.setValueAtTime(frequencia, quando);

    const ATAQUE = 0.008;
    envelope.gain.setValueAtTime(0, quando);
    envelope.gain.linearRampToValueAtTime(volume, quando + ATAQUE);
    envelope.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);

    oscilador.connect(envelope);
    envelope.connect(saida);

    oscilador.start(quando);
    oscilador.stop(quando + duracao + 0.02);
  }

  // ───────────────────────────── Trilha ─────────────────────────────

  /**
   * Liga a trilha.
   *
   * As notas são agendadas com antecedência (look-ahead) em vez de tocadas por
   * temporizador: setInterval não tem precisão suficiente e o resultado sairia
   * desafinado no tempo. Este é o padrão recomendado para sequenciar áudio na web.
   */
  iniciarTrilha() {
    if (!this.contexto || this._trilhaTocando || !this.trilhaLigada) return;

    this._trilhaTocando = true;
    this._proximaNota = this.contexto.currentTime + 0.1;
    this._indiceDaNota = 0;

    const AGENDAR_ATE = 0.4; // segundos de antecedência
    const INTERVALO_DO_AGENDADOR = 60; // ms

    this._agendador = setInterval(() => {
      if (!this._trilhaTocando || !this.contexto) return;

      while (this._proximaNota < this.contexto.currentTime + AGENDAR_ATE) {
        const frequencia = TRILHA[this._indiceDaNota % TRILHA.length];

        this.#tocarNota({
          onda: 'triangle',
          frequencia,
          duracao: DURACAO_DA_NOTA * 0.85,
          volume: 0.22,
          quando: this._proximaNota,
          saida: this.ganhoDaTrilha,
        });

        // Baixo: uma nota a cada quatro da melodia.
        if (this._indiceDaNota % 4 === 0) {
          const nota = BAIXO[Math.floor(this._indiceDaNota / 4) % BAIXO.length];
          this.#tocarNota({
            onda: 'sine',
            frequencia: nota,
            duracao: DURACAO_DA_NOTA * 3.5,
            volume: 0.18,
            quando: this._proximaNota,
            saida: this.ganhoDaTrilha,
          });
        }

        this._proximaNota += DURACAO_DA_NOTA;
        this._indiceDaNota++;
      }
    }, INTERVALO_DO_AGENDADOR);
  }

  pararTrilha() {
    this._trilhaTocando = false;
    if (this._agendador) {
      clearInterval(this._agendador);
      this._agendador = null;
    }
  }

  // ───────────────────────────── Volumes ─────────────────────────────

  definirVolumeDosEfeitos(valor) {
    this.volumeDosEfeitos = Math.min(Math.max(valor, 0), 1);
    this.efeitosLigados = this.volumeDosEfeitos > 0;
    if (this.ganhoDosEfeitos) this.ganhoDosEfeitos.gain.value = this.volumeDosEfeitos;
  }

  definirVolumeDaTrilha(valor) {
    this.volumeDaTrilha = Math.min(Math.max(valor, 0), 1);
    if (this.ganhoDaTrilha) this.ganhoDaTrilha.gain.value = this.volumeDaTrilha;

    const deveTocar = this.volumeDaTrilha > 0;
    this.trilhaLigada = deveTocar;
    if (!deveTocar) this.pararTrilha();
    else if (!this._trilhaTocando) this.iniciarTrilha();
  }

  /** Estado a salvar entre sessões. */
  preferencias() {
    return {
      volumeDosEfeitos: this.volumeDosEfeitos,
      volumeDaTrilha: this.volumeDaTrilha,
    };
  }

  aplicarPreferencias(preferencias = {}) {
    if (typeof preferencias.volumeDosEfeitos === 'number') {
      this.definirVolumeDosEfeitos(preferencias.volumeDosEfeitos);
    }
    if (typeof preferencias.volumeDaTrilha === 'number') {
      this.volumeDaTrilha = Math.min(Math.max(preferencias.volumeDaTrilha, 0), 1);
      this.trilhaLigada = this.volumeDaTrilha > 0;
      if (this.ganhoDaTrilha) this.ganhoDaTrilha.gain.value = this.volumeDaTrilha;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GANCHO PARA ÁUDIO EM ARQUIVO (hoje não utilizado)
  //
  // Se você quiser trocar os sons sintetizados por arquivos próprios, registre-os
  // aqui. Um nome registrado passa a ter prioridade sobre a receita sintetizada
  // de mesmo nome — ou seja, dá para trocar um efeito de cada vez, sem remover
  // nada. O restante do jogo continua chamando apenas `tocar('nomeDoEfeito')`.
  //
  //   await audio.registrarAmostra('linha4', 'assets/sons/tetris.mp3');
  //
  // Use somente arquivos cuja licença você conheça.
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} nome    mesmo nome usado em `tocar`
   * @param {string} url     caminho do arquivo de áudio
   * @returns {Promise<boolean>} false quando o arquivo não pôde ser carregado
   */
  async registrarAmostra(nome, url) {
    if (!this.contexto) {
      console.warn('[AudioManager] Inicialize o áudio antes de registrar amostras.');
      return false;
    }
    try {
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.arrayBuffer();
      const buffer = await this.contexto.decodeAudioData(dados);
      this.amostras.set(nome, buffer);
      return true;
    } catch (erro) {
      // Falhar aqui não pode derrubar o jogo: seguimos com o som sintetizado.
      console.warn(`[AudioManager] Não foi possível carregar "${url}":`, erro.message);
      return false;
    }
  }

  #tocarAmostra(nome) {
    const buffer = this.amostras.get(nome);
    if (!buffer) return;
    const fonte = this.contexto.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(this.ganhoDosEfeitos);
    fonte.start();
  }
}
