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
import { criarDistintivo } from './DistintivoDeProfessor.js';

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

  /**
   * Abre a bomba ampliada.
   *
   * A camada é criada uma vez e reaproveitada, e mora no `body` — não dentro
   * do painel. Dentro dele, o `overflow` da lista de combinações recortaria
   * a imagem justamente quando ela cresce.
   *
   * @param {string} id
   * @param {HTMLElement} origem  para devolver o foco ao fechar
   */
  #abrirLupa(id, origem) {
    const visual = visualDoProfessor(id);
    const professor = PROFESSORES[id];
    if (!visual.ampliada) return;

    const lupa = this.#garantirLupa();
    this.foco = origem;

    lupa.imagem.src = visual.ampliada;
    lupa.imagem.alt = `Bomba de ${professor?.nome ?? id}`;
    lupa.caixa.style.setProperty('--cor-do-professor', visual.cor);
    lupa.nome.textContent = `${professor?.nome ?? id} — ${professor?.tema ?? ''}`;
    lupa.descricao.textContent = professor?.descricao ?? '';

    lupa.fundo.hidden = false;
    lupa.fechar.focus();
  }

  #fecharLupa() {
    if (!this.lupa) return;
    this.lupa.fundo.hidden = true;
    // Devolve o foco a quem abriu: sem isto, quem usa teclado volta ao topo
    // da página e perde o lugar na tabela.
    this.foco?.focus?.();
  }

  #garantirLupa() {
    if (this.lupa) return this.lupa;

    const fundo = document.createElement('div');
    fundo.className = 'lupa';
    fundo.hidden = true;
    fundo.setAttribute('role', 'dialog');
    fundo.setAttribute('aria-modal', 'true');

    const caixa = document.createElement('div');
    caixa.className = 'lupa__caixa';

    const imagem = document.createElement('img');
    imagem.className = 'lupa__imagem';

    const nome = document.createElement('strong');
    nome.className = 'lupa__nome';

    const descricao = document.createElement('span');
    descricao.className = 'lupa__descricao';

    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'botao botao--fechar lupa__fechar';
    fechar.setAttribute('aria-label', 'Fechar');
    fechar.textContent = '✕';

    caixa.append(fechar, imagem, nome, descricao);
    fundo.append(caixa);
    document.body.append(fundo);

    fechar.addEventListener('click', () => this.#fecharLupa());
    // Clique no fundo fecha; clique na caixa não — senão fechava ao tentar
    // olhar a imagem de perto.
    fundo.addEventListener('click', (e) => { if (e.target === fundo) this.#fecharLupa(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !fundo.hidden) this.#fecharLupa();
    });

    this.lupa = { fundo, caixa, imagem, nome, descricao, fechar };
    return this.lupa;
  }

  #montarLista() {
    const destino = this.el.lista;
    if (!destino) return;

    destino.textContent = '';

    for (const id of IDS_DE_PROFESSOR) {
      const professor = PROFESSORES[id];

      const cartao = document.createElement('div');
      cartao.className = 'professor';

      const distintivo = criarDistintivo(id, {
        classe: 'professor__distintivo',
        aoClicar: (quem, elemento) => this.#abrirLupa(quem, elemento),
      });

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
        par.append(
          criarDistintivo(id, {
            classe: 'professor__distintivo professor__distintivo--pequeno',
            aoClicar: (quem, elemento) => this.#abrirLupa(quem, elemento),
          }),
        );
      }

      const nome = document.createElement('td');
      const titulo = document.createElement('strong');
      titulo.textContent = item.nome;
      nome.append(titulo);

      // O nome sozinho não ensina nada: "Cruz Acadêmica" não diz o que faz.
      // A frase vem da mesma tabela que o jogo usa no anúncio da jogada.
      if (item.descricao) {
        const explicacao = document.createElement('small');
        explicacao.className = 'combinacao__descricao';
        explicacao.textContent = item.descricao;
        nome.append(explicacao);
      }

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
