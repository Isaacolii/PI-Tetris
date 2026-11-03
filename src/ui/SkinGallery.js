/**
 * SkinGallery.js — Catálogo de skins e criação de skins com fotos próprias.
 *
 * CAMADA: interface.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  É AQUI QUE O DIFERENCIAL DO PROJETO FICA VISÍVEL PARA QUEM JOGA.
 *
 *  O jogador escolhe uma foto para cada peça, e o Tetris passa a cair com
 *  rostos no lugar dos blocos — na mesma partida, sem recarregar a página.
 *  Nenhuma linha do núcleo do jogo participa disso: a galeria só troca a skin
 *  ativa no SkinRegistry, e o renderizador passa a pedir outro pintor.
 *
 *  As fotos nunca saem do aparelho. São recortadas em quadrado, reduzidas para
 *  128×128 e guardadas no próprio navegador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TIPOS_DE_PECA } from '../core/Tetromino.js';
import { criarPintor } from '../render/BlockPainter.js';
import { CORES_PADRAO } from '../render/skins/catalogo.js';
import { notificar } from './Painel.js';

/**
 * Lado da imagem salva, em pixels.
 *
 * Não é um número escolhido por estética. Uma foto de celular tem alguns
 * megabytes; convertida em texto (dataURL) para caber no armazenamento do
 * navegador, fica ainda maior — e o limite costuma ser 5 MB no total. A 128×128
 * cada foto ocupa poucos kilobytes, e sete cabem com folga. O bloco na tela tem
 * cerca de 30 pixels, então 128 já é mais resolução do que se consegue ver.
 */
const LADO_DA_IMAGEM = 128;

/** Qualidade do JPEG. Formato escolhido por ser muito menor que PNG para fotos. */
const QUALIDADE = 0.82;

/** Tamanho máximo aceito do arquivo original, antes de reduzir. */
const TAMANHO_MAXIMO_MB = 12;

export class SkinGallery {
  /**
   * @param {Object} elementos
   * @param {import('../render/SkinRegistry.js').SkinRegistry} skins
   * @param {import('../storage/SkinStorage.js').SkinStorage} armazenamento
   * @param {import('../render/CanvasRenderer.js').CanvasRenderer} renderizador
   * @param {import('../storage/SettingsStorage.js').SettingsStorage} configuracoes
   */
  constructor(elementos, skins, armazenamento, renderizador, configuracoes) {
    this.el = elementos;
    this.skins = skins;
    this.armazenamento = armazenamento;
    this.renderizador = renderizador;
    this.configuracoes = configuracoes;

    /** Fotos escolhidas mas ainda não salvas: peça -> dataURL */
    this.fotosEscolhidas = {};

    this.#carregarSkinsSalvas();
    this.#montarCriador();
    this.#ligarBotoes();
    this.montar();

    // Quando a skin muda (inclusive por outro caminho), as prévias acompanham.
    this.skins.aoMudar(() => this.#atualizarSelecao());
  }

  /** Traz as skins que o jogador criou em sessões anteriores. */
  #carregarSkinsSalvas() {
    for (const skin of this.armazenamento.listar()) {
      this.skins.registrarSkinPersonalizada(skin);
    }
  }

  // ───────────────────────────── Galerias ─────────────────────────────

  montar() {
    this.#montarGaleriaDePecas();
    this.#montarGaleriaDeFundos();
  }

  /**
   * Redesenha todas as prévias.
   *
   * Precisa ser chamado quando o painel ABRE, não quando é montado: um canvas
   * dentro de um elemento escondido mede zero pixels, e a prévia sairia em
   * branco. Este é o motivo de o desenho não acontecer junto com a montagem.
   */
  redesenharPrevias() {
    this.el.galeriaDePecas?.querySelectorAll('[data-skin]').forEach((cartao) => {
      const skin = this.skins.obterSkinDePeca(cartao.dataset.skin);
      const canvas = cartao.querySelector('.skin__previa');
      if (skin && canvas) this.#desenharPrevia(canvas, skin);
    });

    this.el.galeriaDeFundos?.querySelectorAll('[data-fundo]').forEach((cartao) => {
      const skin = this.skins.skinsDeFundoDisponiveis().find((s) => s.id === cartao.dataset.fundo);
      const canvas = cartao.querySelector('.skin__previa');
      if (skin && canvas) this.#desenharPreviaDeFundo(canvas, skin);
    });
  }

  #montarGaleriaDePecas() {
    const galeria = this.el.galeriaDePecas;
    if (!galeria) return;

    galeria.textContent = '';

    for (const skin of this.skins.skinsDePecaDisponiveis()) {
      galeria.append(this.#cartaoDeSkin(skin));
    }
  }

  #cartaoDeSkin(skin) {
    const cartao = document.createElement('button');
    cartao.type = 'button';
    cartao.className = 'skin';
    cartao.dataset.skin = skin.id;
    cartao.setAttribute('aria-pressed', String(this.skins.skinDePecaAtiva.id === skin.id));

    const previa = document.createElement('canvas');
    previa.className = 'skin__previa';
    cartao.append(previa);

    const nome = document.createElement('span');
    nome.className = 'skin__nome';
    nome.textContent = skin.nome;
    cartao.append(nome);

    if (skin.descricao) {
      const descricao = document.createElement('span');
      descricao.className = 'skin__descricao';
      descricao.textContent = skin.descricao;
      cartao.append(descricao);
    }

    cartao.addEventListener('click', () => {
      this.skins.definirSkinDePeca(skin.id);
      this.configuracoes.definir('skinDePeca', skin.id);
      this.#atualizarSelecao();
      notificar(`Skin "${skin.nome}" aplicada.`);
    });

    // Skins criadas pelo jogador podem ser removidas.
    if (skin.personalizada) {
      const remover = document.createElement('span');
      remover.className = 'skin__remover';
      remover.textContent = 'Remover';
      remover.setAttribute('role', 'button');
      remover.tabIndex = 0;

      const apagar = (evento) => {
        // Sem isto, o clique também selecionaria a skin que está sendo apagada.
        evento.stopPropagation();
        this.armazenamento.remover(skin.id);
        this.skins.removerSkinPersonalizada(skin.id);
        this.montar();
        notificar(`Skin "${skin.nome}" removida.`);
      };

      remover.addEventListener('click', apagar);
      remover.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') apagar(evento);
      });

      cartao.append(remover);
    }

    return cartao;
  }

  /**
   * Prévia da skin: desenha as sete peças em miniatura.
   *
   * Os pintores são criados aqui, na hora, para ESTA skin — sem passar pelo
   * SkinRegistry. É importante: trocar a skin ativa só para desenhar um cartão
   * avisaria todos os ouvintes e faria o tabuleiro piscar com a skin errada no
   * meio da partida. A prévia usa a mesma fábrica de pintores do jogo, então
   * continua mostrando exatamente o que vai aparecer no tabuleiro.
   */
  #desenharPrevia(canvas, skin) {
    const densidade = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth || 120;
    const altura = canvas.clientHeight || 58;

    canvas.width = Math.floor(largura * densidade);
    canvas.height = Math.floor(altura * densidade);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    // Skins de imagem precisam das fotos carregadas para a prévia aparecer.
    // Enquanto não chegam, o pintor usa a cor de reserva e redesenhamos depois.
    if (skin.tipo === 'imagem') {
      const caminhos = TIPOS_DE_PECA.map((tipo) => skin.mapa?.[tipo]).filter(Boolean);
      const faltando = caminhos.some((caminho) => !this.skins.carregador.estaPronta(caminho));
      if (faltando) {
        this.skins.carregador
          .carregarVarias(caminhos)
          .then(() => this.#desenharPrevia(canvas, skin));
      }
    }

    const tamanho = Math.floor(Math.min(largura / 8, altura / 2.4));
    const inicioX = (largura - tamanho * 7) / 2;
    const inicioY = (altura - tamanho * 2) / 2;

    TIPOS_DE_PECA.forEach((tipo, indice) => {
      const pintor = criarPintor(skin, tipo, this.skins.carregador, CORES_PADRAO[tipo]);
      const simbolo = this.skins.simboloPara(tipo);
      const x = inicioX + indice * tamanho;
      pintor.pintar(ctx, x, inicioY, tamanho, { simbolo });
      pintor.pintar(ctx, x, inicioY + tamanho, tamanho, { simbolo });
    });
  }

  #montarGaleriaDeFundos() {
    const galeria = this.el.galeriaDeFundos;
    if (!galeria) return;

    galeria.textContent = '';

    for (const skin of this.skins.skinsDeFundoDisponiveis()) {
      const cartao = document.createElement('button');
      cartao.type = 'button';
      cartao.className = 'skin';
      cartao.dataset.fundo = skin.id;
      cartao.setAttribute('aria-pressed', String(this.skins.skinDeFundoAtiva.id === skin.id));

      const previa = document.createElement('canvas');
      previa.className = 'skin__previa';
      cartao.append(previa);

      const nome = document.createElement('span');
      nome.className = 'skin__nome';
      nome.textContent = skin.nome;
      cartao.append(nome);

      cartao.addEventListener('click', () => {
        this.skins.definirSkinDeFundo(skin.id);
        this.configuracoes.definir('skinDeFundo', skin.id);
        this.#atualizarSelecao();
        notificar(`Fundo "${skin.nome}" aplicado.`);
      });

      galeria.append(cartao);
    }
  }

  /** Miniatura de um plano de fundo, usando o mesmo desenhista do tabuleiro. */
  #desenharPreviaDeFundo(canvas, skin) {
    const densidade = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth || 120;
    const altura = canvas.clientHeight || 58;

    canvas.width = Math.floor(largura * densidade);
    canvas.height = Math.floor(altura * densidade);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(densidade, 0, 0, densidade, 0, 0);
    this.renderizador.fundo.desenhar(ctx, largura, altura, skin);
  }

  /** Marca qual cartão está selecionado, sem redesenhar a galeria inteira. */
  #atualizarSelecao() {
    this.el.galeriaDePecas?.querySelectorAll('[data-skin]').forEach((cartao) => {
      cartao.setAttribute('aria-pressed', String(cartao.dataset.skin === this.skins.skinDePecaAtiva.id));
    });
    this.el.galeriaDeFundos?.querySelectorAll('[data-fundo]').forEach((cartao) => {
      cartao.setAttribute('aria-pressed', String(cartao.dataset.fundo === this.skins.skinDeFundoAtiva.id));
    });
  }

  // ───────────────────── Criador de skin com fotos ─────────────────────

  #montarCriador() {
    const area = this.el.criador;
    if (!area) return;

    area.textContent = '';

    for (const tipo of TIPOS_DE_PECA) {
      const slot = document.createElement('label');
      slot.className = 'slot-de-foto';
      slot.dataset.peca = tipo;

      const rotulo = document.createElement('span');
      rotulo.className = 'slot-de-foto__peca';
      rotulo.textContent = `Peça ${tipo}`;

      const vazio = document.createElement('span');
      vazio.className = 'slot-de-foto__vazio';
      vazio.textContent = '+';

      const entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = 'image/*';
      entrada.hidden = true;
      entrada.addEventListener('change', (evento) => this.#aoEscolherFoto(tipo, evento));

      slot.append(rotulo, vazio, entrada);
      area.append(slot);
    }
  }

  async #aoEscolherFoto(tipo, evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    // Limpa o valor para que escolher o MESMO arquivo de novo dispare o evento.
    evento.target.value = '';

    if (!arquivo.type.startsWith('image/')) {
      this.#avisar('Escolha um arquivo de imagem (JPG, PNG ou WEBP).', 'erro');
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      this.#avisar(`Imagem muito grande. O limite é ${TAMANHO_MAXIMO_MB} MB.`, 'erro');
      return;
    }

    try {
      const dataURL = await SkinGallery.reduzirParaQuadrado(arquivo);
      this.fotosEscolhidas[tipo] = dataURL;
      this.#atualizarSlot(tipo, dataURL);
      this.#atualizarBotaoSalvar();
    } catch (erro) {
      this.#avisar(`Não foi possível ler esta imagem: ${erro.message}`, 'erro');
    }
  }

  /**
   * Recorta a imagem no quadrado central e reduz para LADO_DA_IMAGEM.
   *
   * O recorte central é o que evita distorção: se esticássemos uma foto
   * retangular num bloco quadrado, todo rosto ficaria achatado.
   *
   * @param {File} arquivo
   * @returns {Promise<string>} dataURL da imagem já reduzida
   */
  static reduzirParaQuadrado(arquivo) {
    return new Promise((resolver, rejeitar) => {
      const leitor = new FileReader();

      leitor.onerror = () => rejeitar(new Error('falha ao ler o arquivo'));

      leitor.onload = () => {
        const imagem = new Image();

        imagem.onerror = () => rejeitar(new Error('formato de imagem não reconhecido'));

        imagem.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = LADO_DA_IMAGEM;
          canvas.height = LADO_DA_IMAGEM;

          const ctx = canvas.getContext('2d');
          // Suaviza a redução; sem isto a imagem fica serrilhada.
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Quadrado central da imagem original.
          const lado = Math.min(imagem.width, imagem.height);
          const origemX = (imagem.width - lado) / 2;
          const origemY = (imagem.height - lado) / 2;

          ctx.drawImage(
            imagem,
            origemX,
            origemY,
            lado,
            lado,
            0,
            0,
            LADO_DA_IMAGEM,
            LADO_DA_IMAGEM,
          );

          resolver(canvas.toDataURL('image/jpeg', QUALIDADE));
        };

        imagem.src = leitor.result;
      };

      leitor.readAsDataURL(arquivo);
    });
  }

  #atualizarSlot(tipo, dataURL) {
    const slot = this.el.criador?.querySelector(`[data-peca="${tipo}"]`);
    if (!slot) return;

    slot.classList.add('slot-de-foto--preenchido');

    const anterior = slot.querySelector('.slot-de-foto__previa, .slot-de-foto__vazio');
    const imagem = document.createElement('img');
    imagem.className = 'slot-de-foto__previa';
    imagem.src = dataURL;
    imagem.alt = `Foto escolhida para a peça ${tipo}`;

    anterior?.replaceWith(imagem);
  }

  #atualizarBotaoSalvar() {
    const botao = this.el.botaoSalvar;
    if (!botao) return;

    const quantas = Object.keys(this.fotosEscolhidas).length;
    botao.disabled = quantas === 0;
    botao.textContent =
      quantas === TIPOS_DE_PECA.length
        ? 'Salvar e usar'
        : `Salvar e usar (${quantas} de ${TIPOS_DE_PECA.length})`;
  }

  #ligarBotoes() {
    this.el.botaoSalvar?.addEventListener('click', () => this.#salvarSkin());

    this.el.botaoLimpar?.addEventListener('click', () => {
      this.fotosEscolhidas = {};
      this.#montarCriador();
      this.#atualizarBotaoSalvar();
      this.#avisar('');
    });

    this.#atualizarBotaoSalvar();
  }

  #salvarSkin() {
    const escolhidas = Object.keys(this.fotosEscolhidas);
    if (escolhidas.length === 0) return;

    // Peças sem foto reaproveitam a primeira escolhida — assim uma foto só já
    // rende uma skin completa, e ninguém precisa enviar sete arquivos.
    const primeira = this.fotosEscolhidas[escolhidas[0]];
    const fotos = Object.fromEntries(
      TIPOS_DE_PECA.map((tipo) => [tipo, this.fotosEscolhidas[tipo] ?? primeira]),
    );

    const nome = this.el.nomeDaSkin?.value.trim() || 'Minha skin';
    const skin = this.armazenamento.montar(nome, fotos);
    const gravacao = this.armazenamento.salvar(skin);

    if (!gravacao.ok && gravacao.motivo === 'cota') {
      this.#avisar(
        'A memória do navegador encheu. Remova alguma skin antiga e tente de novo.',
        'erro',
      );
      return;
    }

    this.skins.registrarSkinPersonalizada(skin);
    this.skins.definirSkinDePeca(skin.id);
    this.configuracoes.definir('skinDePeca', skin.id);

    this.fotosEscolhidas = {};
    this.#montarCriador();
    this.#atualizarBotaoSalvar();
    this.montar();

    if (!gravacao.ok) {
      this.#avisar(
        'A skin está em uso, mas não foi possível salvá-la neste navegador — ela some ao recarregar a página.',
        'erro',
      );
    } else {
      this.#avisar(`Skin "${skin.nome}" criada e aplicada.`, 'sucesso');
    }
  }

  #avisar(texto, tipo = 'sucesso') {
    const aviso = this.el.aviso;
    if (!aviso) return;

    if (!texto) {
      aviso.hidden = true;
      return;
    }

    aviso.hidden = false;
    aviso.textContent = texto;
    aviso.className = `aviso-inline aviso-inline--${tipo}`;
  }
}
