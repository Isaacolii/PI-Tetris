/**
 * SettingsPanel.js — Ajustes de som, acessibilidade e exibição.
 *
 * CAMADA: interface.
 *
 * O painel é montado a partir de uma lista declarativa de opções: acrescentar
 * um ajuste novo é acrescentar um item ao array, não escrever HTML à mão.
 */

import { KeyboardInput } from '../input/KeyboardInput.js';
import { TouchInput } from '../input/TouchInput.js';

export class SettingsPanel {
  /**
   * @param {HTMLElement} destino
   * @param {import('../storage/SettingsStorage.js').SettingsStorage} configuracoes
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   * @param {import('../render/SkinRegistry.js').SkinRegistry} skins
   * @param {(chave: string, valor: any) => void} aoMudar  avisa o jogo de mudanças
   */
  constructor(destino, configuracoes, audio, skins, aoMudar) {
    this.destino = destino;
    this.configuracoes = configuracoes;
    this.audio = audio;
    this.skins = skins;
    this.aoMudar = aoMudar;

    this.montar();
  }

  /** Descrição declarativa de todos os ajustes. */
  #opcoes() {
    return [
      {
        secao: 'Som',
        itens: [
          {
            chave: 'volumeDosEfeitos',
            tipo: 'faixa',
            rotulo: 'Efeitos sonoros',
            ajuda: 'Sons de encaixe, rotação e limpeza de linha.',
          },
          {
            chave: 'volumeDaTrilha',
            tipo: 'faixa',
            rotulo: 'Trilha de fundo',
            ajuda: 'Música gerada pelo próprio jogo. Comece em zero se preferir silêncio.',
          },
        ],
      },
      {
        secao: 'Acessibilidade',
        itens: [
          {
            chave: 'simbolosNasPecas',
            tipo: 'interruptor',
            rotulo: 'Símbolos nas peças',
            ajuda: 'Desenha um símbolo dentro de cada peça, para identificá-las sem depender da cor.',
          },
          {
            chave: 'altoContraste',
            tipo: 'interruptor',
            rotulo: 'Alto contraste',
            ajuda: 'Aumenta o contraste do texto e das bordas da interface.',
          },
          {
            chave: 'movimentoReduzido',
            tipo: 'interruptor',
            rotulo: 'Reduzir movimento',
            ajuda: 'Desliga transições e animações da interface.',
          },
        ],
      },
      {
        secao: 'Exibição',
        itens: [
          {
            chave: 'tamanhoDoTabuleiro',
            tipo: 'lista',
            rotulo: 'Tamanho do tabuleiro',
            ajuda: 'Ajuste conforme o tamanho da sua tela.',
            valores: [
              { valor: 'pequeno', rotulo: 'Pequeno' },
              { valor: 'medio', rotulo: 'Médio' },
              { valor: 'grande', rotulo: 'Grande' },
            ],
          },
          {
            chave: 'mostrarFantasma',
            tipo: 'interruptor',
            rotulo: 'Sombra da peça',
            ajuda: 'Mostra onde a peça vai cair. Desligue para aumentar a dificuldade.',
          },
        ],
      },
    ];
  }

  montar() {
    if (!this.destino) return;
    this.destino.textContent = '';

    for (const grupo of this.#opcoes()) {
      const secao = document.createElement('section');
      secao.className = 'secao';

      const titulo = document.createElement('h3');
      titulo.className = 'secao__titulo';
      titulo.textContent = grupo.secao;
      secao.append(titulo);

      for (const opcao of grupo.itens) {
        secao.append(this.#montarOpcao(opcao));
      }

      this.destino.append(secao);
    }

    this.destino.append(this.#montarAjudaDeControles());
  }

  #montarOpcao(opcao) {
    const linha = document.createElement('div');
    linha.className = 'opcao';

    const texto = document.createElement('div');
    texto.className = 'opcao__texto';

    const rotulo = document.createElement('div');
    rotulo.className = 'opcao__rotulo';
    rotulo.textContent = opcao.rotulo;
    texto.append(rotulo);

    if (opcao.ajuda) {
      const ajuda = document.createElement('p');
      ajuda.className = 'opcao__ajuda';
      ajuda.textContent = opcao.ajuda;
      texto.append(ajuda);
    }

    linha.append(texto, this.#montarControle(opcao, rotulo));
    return linha;
  }

  #montarControle(opcao, rotuloElemento) {
    const valorAtual = this.configuracoes.obter(opcao.chave);
    const idDoRotulo = `rotulo-${opcao.chave}`;
    rotuloElemento.id = idDoRotulo;

    if (opcao.tipo === 'interruptor') {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'interruptor';
      botao.setAttribute('role', 'switch');
      botao.setAttribute('aria-checked', String(Boolean(valorAtual)));
      botao.setAttribute('aria-labelledby', idDoRotulo);

      botao.addEventListener('click', () => {
        const novo = botao.getAttribute('aria-checked') !== 'true';
        botao.setAttribute('aria-checked', String(novo));
        this.#aplicar(opcao.chave, novo);
      });

      return botao;
    }

    if (opcao.tipo === 'faixa') {
      const faixa = document.createElement('input');
      faixa.type = 'range';
      faixa.min = '0';
      faixa.max = '100';
      faixa.step = '5';
      faixa.value = String(Math.round((valorAtual ?? 0) * 100));
      faixa.setAttribute('aria-labelledby', idDoRotulo);

      faixa.addEventListener('input', () => {
        this.#aplicar(opcao.chave, Number(faixa.value) / 100);
      });

      return faixa;
    }

    // Lista de opções.
    const lista = document.createElement('select');
    lista.setAttribute('aria-labelledby', idDoRotulo);

    for (const item of opcao.valores) {
      const escolha = document.createElement('option');
      escolha.value = item.valor;
      escolha.textContent = item.rotulo;
      if (item.valor === valorAtual) escolha.selected = true;
      lista.append(escolha);
    }

    lista.addEventListener('change', () => this.#aplicar(opcao.chave, lista.value));
    return lista;
  }

  /** Salva a preferência e a aplica imediatamente. */
  #aplicar(chave, valor) {
    this.configuracoes.definir(chave, valor);

    switch (chave) {
      case 'volumeDosEfeitos':
        this.audio.definirVolumeDosEfeitos(valor);
        break;
      case 'volumeDaTrilha':
        this.audio.definirVolumeDaTrilha(valor);
        break;
      case 'simbolosNasPecas':
        this.skins.definirSimbolos(valor);
        break;
      case 'altoContraste':
        document.body.classList.toggle('alto-contraste', valor);
        break;
      case 'movimentoReduzido':
        document.body.classList.toggle('movimento-reduzido', valor);
        break;
      case 'tamanhoDoTabuleiro':
        SettingsPanel.aplicarTamanhoDoTabuleiro(valor);
        break;
      default:
        break;
    }

    this.aoMudar?.(chave, valor);
  }

  /** Troca a classe do tamanho do tabuleiro no body. */
  static aplicarTamanhoDoTabuleiro(tamanho) {
    document.body.classList.remove('tabuleiro-pequeno', 'tabuleiro-grande');
    if (tamanho === 'pequeno') document.body.classList.add('tabuleiro-pequeno');
    if (tamanho === 'grande') document.body.classList.add('tabuleiro-grande');
  }

  /**
   * Aplica ao carregar a página tudo que estava salvo.
   * Chamado uma vez, na inicialização.
   */
  static aplicarTudo(configuracoes, audio, skins) {
    document.body.classList.toggle('alto-contraste', configuracoes.obter('altoContraste'));

    // A preferência do sistema operacional vale mesmo que o jogador não tenha
    // marcado nada nos ajustes — é a leitura correta de prefers-reduced-motion.
    const reduzir =
      configuracoes.obter('movimentoReduzido') ||
      configuracoes.constructor.sistemaPedeMovimentoReduzido();
    document.body.classList.toggle('movimento-reduzido', reduzir);

    SettingsPanel.aplicarTamanhoDoTabuleiro(configuracoes.obter('tamanhoDoTabuleiro'));

    skins.definirSimbolos(configuracoes.obter('simbolosNasPecas'));
    audio.aplicarPreferencias({
      volumeDosEfeitos: configuracoes.obter('volumeDosEfeitos'),
      volumeDaTrilha: configuracoes.obter('volumeDaTrilha'),
    });
  }

  /** Tabela de controles, montada a partir das próprias classes de entrada. */
  #montarAjudaDeControles() {
    const secao = document.createElement('section');
    secao.className = 'secao';

    const titulo = document.createElement('h3');
    titulo.className = 'secao__titulo';
    titulo.textContent = 'Controles';
    secao.append(titulo);

    const tabela = document.createElement('table');
    tabela.className = 'tabela';

    const corpo = document.createElement('tbody');

    for (const item of KeyboardInput.descricaoDosControles()) {
      const linha = document.createElement('tr');

      const acao = document.createElement('td');
      acao.textContent = item.acao;

      const teclas = document.createElement('td');
      const marca = document.createElement('kbd');
      marca.textContent = item.teclas;
      teclas.append(marca);

      linha.append(acao, teclas);
      corpo.append(linha);
    }

    // Em aparelhos com toque, mostramos também os gestos.
    if (TouchInput.disponivel()) {
      for (const item of TouchInput.descricaoDosGestos()) {
        const linha = document.createElement('tr');

        const acao = document.createElement('td');
        acao.textContent = item.acao;

        const gesto = document.createElement('td');
        gesto.textContent = item.gesto;

        linha.append(acao, gesto);
        corpo.append(linha);
      }
    }

    tabela.append(corpo);
    secao.append(tabela);
    return secao;
  }
}
