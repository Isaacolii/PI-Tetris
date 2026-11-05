/**
 * MenuScreen.js — Tela inicial: nome do jogador e escolha do modo.
 *
 * CAMADA: interface.
 *
 * Os cartões de modo são gerados a partir de core/GameModes.js. Acrescentar um
 * modo novo lá faz o cartão aparecer aqui sozinho — não há lista duplicada.
 */

import { MODOS } from '../core/GameModes.js';
import { formatarTempo, formatarNumero } from '../render/HudRenderer.js';

export class MenuScreen {
  /**
   * @param {Object} elementos
   * @param {import('../storage/RankingStorage.js').RankingStorage} ranking
   * @param {import('../storage/SettingsStorage.js').SettingsStorage} configuracoes
   * @param {(modo: string) => void} aoEscolherModo
   */
  constructor(elementos, ranking, configuracoes, aoEscolherModo) {
    this.el = elementos;
    this.ranking = ranking;
    this.configuracoes = configuracoes;
    this.aoEscolherModo = aoEscolherModo;

    this.#ligarCampoDeNome();
    this.montar();
  }

  /**
   * Recorde em destaque na entrada.
   *
   * Mostra a melhor pontuação de QUALQUER modo, com o nome do modo ao lado —
   * um número sem contexto ("12.400") não diz ao jogador o que ele precisa
   * bater. Fica escondido enquanto não houver partida registrada: um troféu
   * vazio na primeira visita é pior que nenhum troféu.
   */
  #montarRecorde() {
    const caixa = this.el.recorde;
    if (!caixa) return;

    let melhor = null;
    for (const modo of Object.values(MODOS)) {
      const [primeiro] = this.ranking.melhores(modo.id, 1);
      if (!primeiro) continue;
      if (!melhor || primeiro.pontos > melhor.partida.pontos) {
        melhor = { partida: primeiro, modo };
      }
    }

    if (!melhor || melhor.partida.pontos <= 0) {
      caixa.hidden = true;
      return;
    }

    caixa.hidden = false;
    if (this.el.recordeValor) {
      this.el.recordeValor.textContent = formatarNumero(melhor.partida.pontos);
    }
    if (this.el.recordeModo) {
      this.el.recordeModo.textContent = `${melhor.modo.nome} · ${melhor.partida.nome}`;
    }
  }

  #ligarCampoDeNome() {
    const campo = this.el.nome;
    if (!campo) return;

    campo.value = this.configuracoes.obter('nomeDoJogador') ?? '';

    // Salva ao sair do campo, não a cada tecla — evita gravar dezenas de vezes.
    campo.addEventListener('change', () => {
      this.configuracoes.definir('nomeDoJogador', campo.value.trim());
    });
  }

  /** Nome digitado, ou 'Anônimo' se o jogador não quis informar. */
  nomeDoJogador() {
    const digitado = this.el.nome?.value.trim();
    return digitado || 'Anônimo';
  }

  /** Desenha os cartões de modo, cada um com o recorde do jogador. */
  montar() {
    this.#montarRecorde();

    const lista = this.el.listaDeModos;
    if (!lista) return;

    lista.textContent = '';

    for (const modo of Object.values(MODOS)) {
      const cartao = document.createElement('button');
      cartao.type = 'button';
      cartao.className = 'modo';
      cartao.dataset.modo = modo.id;
      // Sem isto, o leitor de tela anunciaria o cartão inteiro (nome + descrição
      // + recorde) como se fosse o rótulo do botão.
      cartao.setAttribute('aria-label', `Jogar ${modo.nome}`);

      const nome = document.createElement('span');
      nome.className = 'modo__nome';
      nome.textContent = modo.nome;

      const descricao = document.createElement('span');
      descricao.className = 'modo__descricao';
      descricao.textContent = modo.descricao;

      cartao.append(nome, descricao);

      const recorde = this.#descreverRecorde(modo);
      if (recorde) {
        const marca = document.createElement('span');
        marca.className = 'modo__recorde';
        marca.textContent = recorde;
        cartao.append(marca);
      }

      cartao.addEventListener('click', () => this.aoEscolherModo(modo.id));
      lista.append(cartao);
    }

    this.#montarDuelos();
  }

  /**
   * Os dois formatos de dois jogadores, lado a lado na tela inicial.
   *
   * Cada um é um cartão próprio porque são jogos diferentes, não a mesma
   * partida vista de outro jeito: num, cada jogador tem o seu tabuleiro e
   * manda lixo para o outro; no outro, os dois disputam o mesmo espaço.
   */
  #montarDuelos() {
    const lista = this.el.listaDeDuelos;
    if (!lista) return;

    lista.textContent = '';

    const formatos = [
      {
        id: 'duelo:lado-a-lado',
        nome: 'Dois tabuleiros',
        descricao:
          'Cada um no seu tabuleiro. Limpar linhas envia lixo para o adversário, e os ' +
          'poderes de professor podem ser mirados nele. Perde quem estourar primeiro.',
      },
      {
        id: 'duelo:compartilhado',
        nome: 'Um tabuleiro, duas peças',
        descricao:
          'Os dois no mesmo tabuleiro, cada um com a sua peça caindo ao mesmo tempo. ' +
          'A linha é de quem a fechou, e dá para bloquear o espaço do outro.',
      },
    ];

    for (const formato of formatos) {
      const cartao = document.createElement('button');
      cartao.type = 'button';
      cartao.className = 'modo modo--duelo';
      cartao.dataset.modo = formato.id;
      cartao.setAttribute('aria-label', `Jogar ${formato.nome}, dois jogadores`);

      const nome = document.createElement('span');
      nome.className = 'modo__nome';
      nome.textContent = formato.nome;

      const descricao = document.createElement('span');
      descricao.className = 'modo__descricao';
      descricao.textContent = formato.descricao;

      cartao.append(nome, descricao);
      cartao.addEventListener('click', () => this.aoEscolherModo(formato.id));
      lista.append(cartao);
    }
  }

  /** Melhor resultado registrado neste modo, respeitando o critério do modo. */
  #descreverRecorde(modo) {
    const melhores = this.ranking.melhores(modo.id, 1);
    if (melhores.length === 0) return null;

    const melhor = melhores[0];

    if (modo.criterio === 'tempo') {
      // No Sprint só faz sentido mostrar o tempo de quem cumpriu o objetivo.
      if (melhor.motivoDoFim !== 'objetivo') return null;
      return `Recorde: ${formatarTempo(melhor.tempoMs)} — ${melhor.nome}`;
    }

    return `Recorde: ${formatarNumero(melhor.pontos)} — ${melhor.nome}`;
  }

  mostrar() {
    if (this.el.tela) this.el.tela.hidden = false;
    if (this.el.areaDeJogo) this.el.areaDeJogo.hidden = true;
    this.montar();
  }

  esconder() {
    if (this.el.tela) this.el.tela.hidden = true;
    if (this.el.areaDeJogo) this.el.areaDeJogo.hidden = false;
  }
}
