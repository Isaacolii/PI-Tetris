/**
 * DistintivoDeProfessor.js — a bomba de um professor, como elemento da página.
 *
 * CAMADA: interface.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUE ISTO É UM ARQUIVO SÓ, E NÃO TRÊS CÓPIAS
 *
 *  O distintivo aparece em três lugares diferentes da interface: no anúncio da
 *  combinação, nos cartões dos cinco professores e na tabela de combinações.
 *  Os três precisam da mesma regra — mostrar a bomba quando ela existe, cair na
 *  letra colorida quando não existe.
 *
 *  Com três cópias, trocar a arte de um professor exigiria lembrar de três
 *  lugares, e o esquecido ficaria com a letra antiga ao lado dos outros dois
 *  com a bomba nova. Esse tipo de divergência não dá erro: só fica errado na
 *  tela, em silêncio.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O canvas tem o seu próprio caminho (`BlockPainter.marcarProfessor`), porque
 * lá o desenho é pixel, não elemento. A regra de decisão é a mesma nos dois.
 */

import { PROFESSORES } from '../core/Professores.js';
import { visualDoProfessor } from '../render/skins/catalogo.js';

/**
 * Monta o distintivo de um professor.
 *
 * @param {string} id                 'A' a 'E'
 * @param {Object} [opcoes]
 * @param {string} [opcoes.classe]    classes CSS do elemento
 * @param {boolean} [opcoes.rotulo]   true põe o nome do professor no
 *                                    `aria-label`; false marca como decorativo
 * @param {Function} [opcoes.aoClicar] se vier, o distintivo vira botão
 * @returns {HTMLElement}
 */
export function criarDistintivo(id, { classe = '', rotulo = false, aoClicar = null } = {}) {
  const visual = visualDoProfessor(id);
  const professor = PROFESSORES[id];

  const caixa = document.createElement('span');
  caixa.className = classe;

  // A cor fica disponível ao CSS mesmo com a imagem presente: é ela que pinta
  // a borda e o brilho, e é a mesma cor que a explosão vai usar.
  caixa.style.setProperty('--cor-do-professor', visual.cor);

  if (visual.caricatura) {
    caixa.classList.add('distintivo--bomba');

    const imagem = document.createElement('img');
    imagem.src = visual.caricatura;
    imagem.alt = '';
    // A arte é um cubo: distorcer para caber num quadrado menor estragaria a
    // perspectiva. `cover` recorta sobra em vez de achatar.
    imagem.decoding = 'async';
    caixa.append(imagem);
  } else {
    // Sem arquivo de bomba, volta a ser o disco colorido com a letra.
    caixa.style.backgroundColor = visual.cor;
    caixa.textContent = visual.simbolo;
  }

  if (aoClicar) {
    /*
     * Vira botão de verdade, não um span com onclick.
     *
     * A arte é pequena demais para ser apreciada em 34 px, e quem olha o painel
     * quer VER a bomba. Como botão, ela também chega pelo teclado e é anunciada
     * como clicável — um span só funcionaria para quem usa o rato.
     */
    caixa.setAttribute('role', 'button');
    caixa.setAttribute('tabindex', '0');
    caixa.setAttribute('aria-label', `Ampliar a bomba de ${professor?.nome ?? id}`);
    caixa.classList.add('distintivo--clicavel');

    caixa.addEventListener('click', () => aoClicar(id, caixa));
    caixa.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      aoClicar(id, caixa);
    });
  } else if (rotulo) {
    caixa.setAttribute('aria-label', professor?.nome ?? id);
  } else {
    caixa.setAttribute('aria-hidden', 'true');
  }

  return caixa;
}
