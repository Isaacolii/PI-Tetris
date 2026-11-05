/**
 * AnuncioDeCombo.js — O anúncio grande quando uma combinação dispara.
 *
 * CAMADA: renderização (DOM, não canvas).
 *
 * Por que DOM e não canvas: aqui o conteúdo é TEXTO, e texto em DOM sai nítido
 * em qualquer densidade de tela, acompanha o zoom do navegador e é lido por
 * leitores de tela. Desenhar tipografia no canvas para depois reimplementar
 * escala e acessibilidade seria trabalho a mais por um resultado pior.
 *
 * O anúncio caminha junto com o "hitstop" — a desaceleração do tempo que dá ao
 * jogador um instante para ver o que conseguiu. Quem controla a desaceleração é
 * o laço principal; este arquivo só cuida do que aparece na tela.
 */

/** Quanto tempo o anúncio fica visível, em milissegundos. */
/*
 * Tempo na tela.
 *
 * Era 1250 ms, o bastante para ver o nome e não para LER o que o poder faz.
 * O anúncio só ensina a combinação se o jogador conseguir ler a frase antes
 * de ela sumir, e ele está jogando ao mesmo tempo.
 */
const DURACAO_MS = 2100;

import { criarDistintivo } from '../ui/DistintivoDeProfessor.js';

export class AnuncioDeCombo {
  /**
   * @param {Object} elementos
   * @param {HTMLElement} elementos.caixa
   * @param {HTMLElement} elementos.professores
   * @param {HTMLElement} elementos.nome
   * @param {HTMLElement} elementos.descricao  o que o poder FAZ, em palavras
   * @param {HTMLElement} elementos.detalhe    os números do que acabou de sair
   * @param {import('./SkinRegistry.js').SkinRegistry} skins
   */
  constructor(elementos, skins) {
    this.el = elementos;
    this.skins = skins;
    this._relogio = null;
  }

  /**
   * Mostra a combinação.
   *
   * @param {Object} relatorio       saída de PoderesEspeciais.executarPoder
   * @param {Object[]} professores   dados dos professores envolvidos (id e nome)
   */
  mostrar(relatorio, professores) {
    const { caixa } = this.el;
    if (!caixa) return;

    this.#montarProfessores(professores);
    this.el.nome.textContent = relatorio.nome ?? '';

    // A frase do que o poder faz vem do próprio poder, não daqui: a legenda
    // do painel lê a mesma, então as duas nunca divergem.
    if (this.el.descricao) {
      this.el.descricao.textContent = relatorio.descricao ?? '';
      this.el.descricao.hidden = !relatorio.descricao;
    }

    this.el.detalhe.textContent = this.#descrever(relatorio);

    caixa.hidden = false;

    // Reinicia a animação: sem remover a classe e forçar o recálculo do
    // layout, dois poderes em sequência rápida mostrariam o segundo anúncio
    // já parado no fim da animação.
    caixa.classList.remove('combo--entrando');
    void caixa.offsetWidth;
    caixa.classList.add('combo--entrando');

    clearTimeout(this._relogio);
    this._relogio = setTimeout(() => this.esconder(), DURACAO_MS);
  }

  esconder() {
    clearTimeout(this._relogio);
    if (!this.el.caixa) return;
    this.el.caixa.hidden = true;
    this.el.caixa.classList.remove('combo--entrando');
  }

  /** Os dois distintivos, com o sinal de soma entre eles. */
  #montarProfessores(professores) {
    const destino = this.el.professores;
    if (!destino) return;

    destino.textContent = '';

    professores.forEach((professor, indice) => {
      if (indice > 0) {
        const mais = document.createElement('span');
        mais.className = 'combo__mais';
        mais.textContent = '+';
        mais.setAttribute('aria-hidden', 'true');
        destino.append(mais);
      }

      const visual = this.skins.visualDoProfessor(professor.id);

      // A bomba, não a letra: é o que o jogador acabou de ver no tabuleiro, e
      // o anúncio só ensina a combinação se mostrar a mesma coisa.
      const distintivo = criarDistintivo(professor.id, {
        classe: 'combo__distintivo',
        rotulo: true,
      });

      // A sombra usa a cor do próprio professor: o brilho identifica quem agiu.
      distintivo.style.boxShadow = `0 0 26px ${visual.cor}`;
      // Escalonar a entrada de cada disco dá a leitura de "um encontrou o outro".
      distintivo.style.animationDelay = `${indice * 90}ms`;

      destino.append(distintivo);
    });
  }

  /** Uma linha dizendo o que o poder fez, com os números reais. */
  #descrever(relatorio) {
    const partes = [];

    if (relatorio.blocosRemovidos > 0) {
      partes.push(`${relatorio.blocosRemovidos} blocos destruídos`);
    }
    if (relatorio.blocosPreenchidos > 0) {
      partes.push(`${relatorio.blocosPreenchidos} vazios preenchidos`);
    }
    if (relatorio.bombasCriadas > 0) {
      partes.push(`${relatorio.bombasCriadas} bombas plantadas`);
    }
    if (relatorio.blocosMovidos > 0) {
      partes.push('pilha reorganizada');
    }
    if (relatorio.efeito) {
      const n = relatorio.efeito.pecasRestantes;
      partes.push(`${relatorio.efeito.nome} por ${n} peça${n === 1 ? '' : 's'}`);
    }

    return partes.join(' · ');
  }
}
