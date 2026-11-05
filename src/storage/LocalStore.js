/**
 * LocalStore.js — Acesso seguro ao armazenamento do navegador.
 *
 * CAMADA: persistência.
 *
 * O localStorage falha em mais situações do que parece: navegação anônima,
 * cota esgotada, cookies bloqueados, política corporativa. Nenhuma delas pode
 * derrubar o jogo — no pior caso o jogador perde o ranking, nunca a partida.
 *
 * Todos os módulos de persistência do projeto passam por aqui, para que esse
 * tratamento exista em um lugar só.
 */

export class LocalStore {
  /** @param {string} prefixo  namespace das chaves, evita conflito com outros sites */
  constructor(prefixo = 'tetris-pi') {
    this.prefixo = prefixo;
    this.disponivel = LocalStore.#testarDisponibilidade();
    /** Reserva em memória: quando o disco falha, ao menos a sessão atual funciona. */
    this.memoria = new Map();
  }

  static #testarDisponibilidade() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const chave = '__teste_tetris__';
      localStorage.setItem(chave, '1');
      localStorage.removeItem(chave);
      return true;
    } catch {
      return false;
    }
  }

  #chave(nome) {
    return `${this.prefixo}:${nome}`;
  }

  /**
   * Lê e converte de JSON.
   * @param {string} nome
   * @param {*} padrao  devolvido quando não há nada salvo ou o dado está corrompido
   */
  ler(nome, padrao = null) {
    try {
      const bruto = this.disponivel
        ? localStorage.getItem(this.#chave(nome))
        : this.memoria.get(this.#chave(nome));

      if (bruto === null || bruto === undefined) return padrao;
      return JSON.parse(bruto);
    } catch (erro) {
      // Dado corrompido (edição manual, versão antiga do formato): recomeça limpo
      // em vez de deixar o jogo travado numa tela de erro.
      console.warn(`[LocalStore] Não foi possível ler "${nome}":`, erro.message);
      return padrao;
    }
  }

  /**
   * Grava em JSON.
   * @returns {{ok: boolean, motivo?: string}}
   */
  gravar(nome, valor) {
    const texto = JSON.stringify(valor);

    if (!this.disponivel) {
      this.memoria.set(this.#chave(nome), texto);
      return { ok: false, motivo: 'indisponivel' };
    }

    try {
      localStorage.setItem(this.#chave(nome), texto);
      return { ok: true };
    } catch (erro) {
      this.memoria.set(this.#chave(nome), texto);

      // Cota estourada é o erro mais provável aqui, e a causa quase sempre é
      // foto grande demais salva como skin. Quem chamou precisa saber disso
      // para avisar o jogador em vez de falhar em silêncio.
      const cotaEstourada =
        erro?.name === 'QuotaExceededError' || erro?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

      console.warn(`[LocalStore] Não foi possível gravar "${nome}":`, erro.message);
      return { ok: false, motivo: cotaEstourada ? 'cota' : 'erro' };
    }
  }

  remover(nome) {
    this.memoria.delete(this.#chave(nome));
    if (!this.disponivel) return;
    try {
      localStorage.removeItem(this.#chave(nome));
    } catch {
      // Remover não é crítico o bastante para merecer tratamento.
    }
  }

  /** Espaço aproximado ocupado por este jogo, em kilobytes. */
  espacoUsadoKb() {
    if (!this.disponivel) return 0;
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        if (chave?.startsWith(this.prefixo)) {
          total += (localStorage.getItem(chave)?.length ?? 0) + chave.length;
        }
      }
    } catch {
      return 0;
    }
    // Cada caractere ocupa 2 bytes (UTF-16) na maioria dos navegadores.
    return Math.round((total * 2) / 1024);
  }
}
