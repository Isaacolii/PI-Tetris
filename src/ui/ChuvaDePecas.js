/**
 * ChuvaDePecas.js — Peças caindo devagar atrás da tela inicial.
 *
 * CAMADA: interface.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO NÃO É UM CANVAS COM requestAnimationFrame
 *
 * A primeira ideia óbvia seria desenhar a chuva num canvas, como o jogo faz.
 * Seria a escolha errada: a tela inicial JÁ roda um laço de quadros (a vitrine
 * jogando sozinha), e um segundo laço disputaria a mesma thread. Qualquer
 * engasgo do JavaScript apareceria como tranco no fundo — justamente o que
 * um fundo não pode fazer.
 *
 * Aqui cada peça é um punhado de divs com UMA animação de `transform`. O
 * navegador manda isso para o compositor e nunca mais volta ao JavaScript:
 * a chuva continua lisa mesmo enquanto o laço do jogo está ocupado, e custa
 * zero por quadro. Este arquivo roda UMA vez, monta os elementos e sai.
 *
 * As formas e as cores vêm das MESMAS tabelas do jogo. Se alguém mudar o
 * desenho de um tetrominó, a chuva muda junto — não há um segundo desenho
 * das peças escondido aqui.
 */

import { TIPOS_DE_PECA, criarMatriz } from '../core/Tetromino.js';
import { CORES_PADRAO } from '../render/skins/catalogo.js';

/**
 * Quantas peças caem ao mesmo tempo.
 *
 * Dezesseis é o ponto em que a tela parece habitada sem parecer ocupada.
 * Acima disso o olho começa a ler a chuva como conteúdo e para de ler o
 * título, que é o que a tela veio dizer.
 */
const QUANTIDADE = 16;

/** Mesma sequência a cada carregamento seria decoração; sorteada é clima. */
function entre(minimo, maximo) {
  return minimo + Math.random() * (maximo - minimo);
}

/**
 * Monta a chuva dentro do container.
 *
 * @param {HTMLElement|null} container
 */
export function montarChuvaDePecas(container) {
  if (!container) return;
  container.replaceChildren();

  const fragmento = document.createDocumentFragment();

  for (let i = 0; i < QUANTIDADE; i++) {
    const tipo = TIPOS_DE_PECA[Math.floor(Math.random() * TIPOS_DE_PECA.length)];
    const matriz = criarMatriz(tipo);

    const peca = document.createElement('div');
    peca.className = 'chuva__peca';

    const duracao = entre(16, 34);

    peca.style.setProperty('--cor', CORES_PADRAO[tipo]);
    peca.style.setProperty('--x', `${entre(-2, 98).toFixed(2)}%`);
    peca.style.setProperty('--escala', entre(0.6, 1.3).toFixed(2));
    peca.style.setProperty('--opacidade', entre(0.1, 0.22).toFixed(3));
    peca.style.setProperty('--duracao', `${duracao.toFixed(1)}s`);
    peca.style.setProperty('--giro', `${entre(-200, 200).toFixed(0)}deg`);

    /*
     * Atraso NEGATIVO, e sorteado dentro da própria duração.
     *
     * Com atraso positivo a tela abriria vazia e as peças entrariam uma a uma
     * pelo topo — a página pareceria estar carregando. Negativo, o navegador
     * começa a animação já no meio: a primeira pintura mostra a chuva em
     * andamento, como se ela estivesse ali antes de alguém chegar.
     */
    peca.style.setProperty('--atraso', `${(-entre(0, duracao)).toFixed(1)}s`);

    for (let linha = 0; linha < matriz.length; linha++) {
      for (let coluna = 0; coluna < matriz[linha].length; coluna++) {
        if (!matriz[linha][coluna]) continue;

        // Só as células cheias viram elemento. A grade do CSS posiciona cada
        // uma pela coordenada, então as vazias não precisam existir.
        const bloco = document.createElement('span');
        bloco.className = 'chuva__bloco';
        bloco.style.gridArea = `${linha + 1} / ${coluna + 1}`;
        peca.append(bloco);
      }
    }

    fragmento.append(peca);
  }

  container.append(fragmento);
}
