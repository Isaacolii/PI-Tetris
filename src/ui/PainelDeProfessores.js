/**
 * PainelDeProfessores.js — Legenda dos professores e da tabela de combinações.
 *
 * CAMADA: interface.
 *
 * Tudo aqui é gerado a partir das fontes de verdade em core/ e render/: os
 * professores vêm de `Professores.js`, os poderes de `PoderesEspeciais.js` e as
 * cores do catálogo de skins. Não há nenhuma lista repetida — acrescentar um
 * professor ou implementar uma combinação pendente atualiza esta tela sozinho.
 */

import { PROFESSORES, IDS_DE_PROFESSOR } from '../core/Professores.js';
import { tabelaDeCombinacoes } from '../core/PoderesEspeciais.js';
import { visualDoProfessor } from '../render/skins/catalogo.js';

export class PainelDeProfessores {
  /**
   * @param {Object} elementos
   * @param {HTMLElement} elementos.lista       onde vão os cinco professores
   * @param {HTMLElement} elementos.combinacoes onde vai a tabela de poderes
   */
  constructor(elementos) {
    this.el = elementos;
    this.montar();
  }

  montar() {
    this.#montarLista();
    this.#montarTabela();
  }

  #montarLista() {
    const destino = this.el.lista;
    if (!destino) return;

    destino.textContent = '';

    for (const id of IDS_DE_PROFESSOR) {
      const professor = PROFESSORES[id];
      const visual = visualDoProfessor(id);

      const cartao = document.createElement('div');
      cartao.className = 'professor';

      const distintivo = document.createElement('span');
      distintivo.className = 'professor__distintivo';
      distintivo.style.backgroundColor = visual.cor;
      distintivo.textContent = visual.simbolo;
      distintivo.setAttribute('aria-hidden', 'true');

      const texto = document.createElement('div');

      const nome = document.createElement('div');
      nome.className = 'professor__nome';
      nome.textContent = `${professor.nome} — ${professor.tema}`;

      const descricao = document.createElement('div');
      descricao.className = 'professor__descricao';
      descricao.textContent = professor.descricao;

      texto.append(nome, descricao);
      cartao.append(distintivo, texto);
      destino.append(cartao);
    }
  }

  #montarTabela() {
    const destino = this.el.combinacoes;
    if (!destino) return;

    destino.textContent = '';

    const tabela = document.createElement('table');
    tabela.className = 'tabela';

    const cabecalho = document.createElement('thead');
    const linhaTopo = document.createElement('tr');
    for (const titulo of ['Combinação', 'Poder', 'Situação']) {
      const celula = document.createElement('th');
      celula.textContent = titulo;
      linhaTopo.append(celula);
    }
    cabecalho.append(linhaTopo);
    tabela.append(cabecalho);

    const corpo = document.createElement('tbody');

    for (const item of tabelaDeCombinacoes()) {
      const linha = document.createElement('tr');

      const par = document.createElement('td');
      for (const id of item.par) {
        const marca = document.createElement('span');
        marca.className = 'professor__distintivo professor__distintivo--pequeno';
        marca.style.backgroundColor = visualDoProfessor(id).cor;
        marca.textContent = visualDoProfessor(id).simbolo;
        par.append(marca);
      }

      const nome = document.createElement('td');
      nome.textContent = item.nome;

      const situacao = document.createElement('td');
      if (item.implementado) {
        situacao.textContent = 'Disponível';
      } else {
        // Ser transparente sobre o que ainda não está pronto é mais honesto do
        // que anunciar um poder que na prática cai no efeito de reserva.
        situacao.textContent = 'Em desenvolvimento';
        situacao.className = 'situacao-pendente';
        linha.title = 'Por enquanto esta combinação usa a explosão padrão.';
      }

      linha.append(par, nome, situacao);
      corpo.append(linha);
    }

    tabela.append(corpo);
    destino.append(tabela);
  }
}
