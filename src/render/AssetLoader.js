/**
 * AssetLoader.js — Carregamento de imagens para as skins.
 *
 * CAMADA: renderização.
 *
 * Existe desde já, funcionando, e é usado toda vez que o jogador envia uma foto
 * pela galeria de skins. Quando os PNGs dos rostos entrarem em assets/skins/,
 * este mesmo carregador cuidará deles — nada aqui precisará mudar.
 *
 * Regra de ouro: imagem que falha NUNCA derruba o jogo. O carregamento devolve
 * null e o pintor cai na cor de reserva.
 */

export class AssetLoader {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} imagens já carregadas com sucesso */
    this.cache = new Map();
    /** @type {Map<string, Promise<HTMLImageElement|null>>} carregamentos em andamento */
    this.emAndamento = new Map();
    /** @type {Set<string>} caminhos que já falharam — não tentamos de novo */
    this.falhas = new Set();
  }

  /** A imagem já está pronta para desenhar? */
  estaPronta(caminho) {
    return this.cache.has(caminho);
  }

  /** Devolve a imagem carregada, ou null se ainda não estiver disponível. */
  obter(caminho) {
    return this.cache.get(caminho) ?? null;
  }

  /**
   * Carrega uma imagem. Aceita caminho de arquivo ou dataURL (que é o formato
   * das fotos enviadas pelo jogador).
   *
   * @param {string} caminho
   * @returns {Promise<HTMLImageElement|null>} null quando o carregamento falha
   */
  carregar(caminho) {
    if (!caminho) return Promise.resolve(null);
    if (this.cache.has(caminho)) return Promise.resolve(this.cache.get(caminho));
    if (this.falhas.has(caminho)) return Promise.resolve(null);
    if (this.emAndamento.has(caminho)) return this.emAndamento.get(caminho);

    // Fora do navegador (por exemplo, nos testes rodando no Node) não existe Image.
    // Em vez de estourar, tratamos como imagem indisponível — o pintor usa a cor
    // de reserva e todo o resto do sistema continua testável no terminal.
    if (typeof Image === 'undefined') {
      this.falhas.add(caminho);
      return Promise.resolve(null);
    }

    const promessa = new Promise((resolver) => {
      const imagem = new Image();

      imagem.onload = () => {
        this.cache.set(caminho, imagem);
        this.emAndamento.delete(caminho);
        resolver(imagem);
      };

      imagem.onerror = () => {
        // Registramos a falha e seguimos: o pintor usará a cor de reserva.
        this.falhas.add(caminho);
        this.emAndamento.delete(caminho);
        console.warn(`[AssetLoader] Não foi possível carregar a imagem: ${caminho}`);
        resolver(null);
      };

      imagem.src = caminho;
    });

    this.emAndamento.set(caminho, promessa);
    return promessa;
  }

  /**
   * Carrega várias imagens de uma vez.
   * @param {string[]} caminhos
   * @returns {Promise<Map<string, HTMLImageElement|null>>}
   */
  async carregarVarias(caminhos) {
    const unicos = [...new Set(caminhos.filter(Boolean))];
    const resultados = await Promise.all(unicos.map((caminho) => this.carregar(caminho)));
    return new Map(unicos.map((caminho, indice) => [caminho, resultados[indice]]));
  }

  /** Esquece uma imagem — usado quando o jogador troca a foto de uma peça. */
  descartar(caminho) {
    this.cache.delete(caminho);
    this.falhas.delete(caminho);
    this.emAndamento.delete(caminho);
  }
}
