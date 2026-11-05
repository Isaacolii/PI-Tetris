/**
 * ProfileExport.js — Exportar e importar o perfil do jogador em JSON.
 *
 * CAMADA: persistência.
 *
 * POR QUE ISTO EXISTE:
 * o ranking vive no localStorage, então enxerga apenas quem jogou NAQUELE
 * navegador. Para o relatório comparativo entre jogadores fazer sentido, cada
 * pessoa joga, exporta o próprio arquivo, e os arquivos são reunidos em uma
 * máquina só. Resolve o problema sem servidor, sem cadastro e sem guardar dado
 * pessoal de ninguém em lugar nenhum.
 */

/** Versão do formato — se um dia o arquivo mudar, dá para migrar em vez de recusar. */
const VERSAO_DO_FORMATO = 1;

export class ProfileExport {
  /**
   * @param {import('./RankingStorage.js').RankingStorage} ranking
   * @param {import('./SettingsStorage.js').SettingsStorage} configuracoes
   */
  constructor(ranking, configuracoes) {
    this.ranking = ranking;
    this.configuracoes = configuracoes;
  }

  /**
   * Monta o objeto do perfil.
   * @param {string} [nome]  exporta só as partidas deste jogador; sem nome, exporta tudo
   */
  montar(nome = null) {
    const partidas = nome ? this.ranking.partidasDe(nome) : this.ranking.partidas;

    return {
      formato: 'tetris-pi-perfil',
      versao: VERSAO_DO_FORMATO,
      exportadoEm: new Date().toISOString(),
      jogador: nome ?? this.configuracoes.obter('nomeDoJogador') ?? 'Anônimo',
      totalDePartidas: partidas.length,
      // As skins com fotos NÃO são exportadas de propósito: são imagens de
      // pessoas e pesariam megabytes no arquivo. O perfil leva só números.
      partidas,
    };
  }

  /**
   * Gera o arquivo e dispara o download no navegador.
   * @param {string} [nome]
   * @returns {string} nome do arquivo gerado
   */
  baixar(nome = null) {
    const perfil = this.montar(nome);
    const texto = JSON.stringify(perfil, null, 2);
    const blob = new Blob([texto], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const rotulo = (perfil.jogador || 'jogador').replace(/[^\w-]/g, '_');
    const data = new Date().toISOString().slice(0, 10);
    const nomeDoArquivo = `tetris-perfil-${rotulo}-${data}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = nomeDoArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Sem revogar, o blob fica preso na memória do navegador.
    URL.revokeObjectURL(url);

    return nomeDoArquivo;
  }

  /**
   * Valida um perfil vindo de arquivo.
   *
   * Arquivo de fora é dado não confiável: pode estar corrompido, ser de outro
   * jogo, ou ter sido editado à mão. Conferimos antes de deixar entrar.
   *
   * @param {unknown} dados
   * @returns {{valido: boolean, erro?: string}}
   */
  static validar(dados) {
    if (!dados || typeof dados !== 'object') {
      return { valido: false, erro: 'O arquivo não contém um perfil válido.' };
    }
    if (dados.formato !== 'tetris-pi-perfil') {
      return { valido: false, erro: 'Este arquivo não é um perfil deste jogo.' };
    }
    if (dados.versao > VERSAO_DO_FORMATO) {
      return {
        valido: false,
        erro: 'O arquivo foi gerado por uma versão mais nova do jogo.',
      };
    }
    if (!Array.isArray(dados.partidas)) {
      return { valido: false, erro: 'O perfil não tem a lista de partidas.' };
    }
    return { valido: true };
  }

  /**
   * Lê um arquivo escolhido pelo jogador e junta as partidas ao histórico local.
   *
   * @param {File} arquivo
   * @returns {Promise<{ok: boolean, erro?: string, jogador?: string, novas?: number}>}
   */
  async importar(arquivo) {
    let dados;
    try {
      const texto = await arquivo.text();
      dados = JSON.parse(texto);
    } catch {
      return { ok: false, erro: 'Não foi possível ler o arquivo — ele não é um JSON válido.' };
    }

    const validacao = ProfileExport.validar(dados);
    if (!validacao.valido) return { ok: false, erro: validacao.erro };

    // Descarta registros malformados em vez de contaminar o ranking.
    const partidas = dados.partidas.filter(
      (partida) =>
        partida &&
        typeof partida.nome === 'string' &&
        typeof partida.pontos === 'number' &&
        typeof partida.dataISO === 'string',
    );

    const novas = this.ranking.mesclar(partidas);

    return {
      ok: true,
      jogador: dados.jogador,
      novas,
      ignoradas: dados.partidas.length - partidas.length,
    };
  }
}
