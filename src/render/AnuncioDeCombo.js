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
const DURACAO_MS = 1250;

export class AnuncioDeCombo {
  /**
   * @param {Object} elementos
   * @param {HTMLElement} elementos.caixa
   * @param {HTMLElement} elementos.professores
   * @param {HTMLElement} elementos.nome
   * @param {HTMLElement} elementos.detalhe
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

      const distintivo = document.createElement('span');
      distintivo.className = 'combo__distintivo';
      distintivo.style.backgroundColor = visual.cor;
      // A sombra usa a cor do próprio professor: o brilho identifica quem agiu.
      distintivo.style.boxShadow = `0 0 26px ${visual.cor}`;
      distintivo.textContent = visual.simbolo;
      // O nome vai no rótulo acessível; o disco mostra só a letra, por espaço.
      distintivo.setAttribute('aria-label', professor.nome ?? professor.id);
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
