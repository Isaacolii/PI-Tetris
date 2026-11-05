/**
 * sw.js — Service Worker: faz o jogo funcionar sem internet.
 *
 * CAMADA: infraestrutura do navegador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  A ROTA /api NUNCA É GUARDADA EM CACHE — E ISSO É PROPOSITAL.
 *
 *  Guardar uma resposta dinâmica seria o erro clássico desta combinação:
 *  o jogador terminaria a segunda partida e receberia, palavra por palavra, a
 *  análise da primeira — sem nenhum sinal de que algo está errado.
 *
 *  Cache serve para arquivos que não mudam (o código do jogo). Análise é
 *  resposta a dados novos toda vez, e por isso vai sempre à rede.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estratégias em uso:
 *   • navegação (abrir a página) → rede primeiro, cache como reserva;
 *   • arquivos do jogo           → cache primeiro, rede quando não houver;
 *   • /api/*                     → somente rede, nunca guardado.
 */

/**
 * Mudar esta versão descarta o cache antigo por completo.
 * Aumente o número sempre que publicar uma alteração, senão os navegadores que
 * já visitaram o site continuarão servindo a versão anterior.
 */
const VERSAO = 'tetris-pi-v7';

/** Arquivos guardados assim que o jogo é aberto pela primeira vez. */
const ARQUIVOS_ESSENCIAIS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/main.css',

  'src/main.js',

  'src/core/Tetromino.js',
  'src/core/Grid.js',
  'src/core/RotationSystem.js',
  'src/core/BagRandomizer.js',
  'src/core/ScoreSystem.js',
  'src/core/GameModes.js',
  'src/core/StatsCollector.js',
  'src/core/GameEngine.js',
  'src/core/Professores.js',
  'src/core/PoderesEspeciais.js',
  'src/core/ProfessorSystem.js',
  'src/core/EfeitosAtivos.js',

  'src/render/skins/catalogo.js',
  'src/render/SkinRegistry.js',
  'src/render/BlockPainter.js',
  'src/render/BackgroundRenderer.js',
  'src/render/AssetLoader.js',
  'src/render/CanvasRenderer.js',
  'src/render/HudRenderer.js',
  'src/render/StatsChart.js',
  'src/render/EfeitoVisual.js',
  'src/render/Particulas.js',
  'src/render/AnuncioDeCombo.js',

  'src/input/KeyboardInput.js',
  'src/input/TouchInput.js',
  'src/audio/AudioManager.js',

  'src/storage/LocalStore.js',
  'src/storage/RankingStorage.js',
  'src/storage/SkinStorage.js',
  'src/storage/SettingsStorage.js',
  'src/storage/ProfileExport.js',


  'src/ui/Painel.js',
  'src/ui/MenuScreen.js',
  'src/ui/SkinGallery.js',
  'src/ui/StatsPanel.js',
  'src/ui/SettingsPanel.js',
  'src/ui/RankingPanel.js',
  'src/ui/PainelDeProfessores.js',
  'src/ui/Vitrine.js',

  'assets/professores/prof-a.png',
  'assets/professores/prof-b.png',
  'assets/professores/prof-c.png',
  'assets/professores/prof-d.png',
  'assets/professores/prof-e.png',

  'assets/professores/prof-a-grande.jpg',
  'assets/professores/prof-b-grande.jpg',
  'assets/professores/prof-c-grande.jpg',
  'assets/professores/prof-d-grande.jpg',
  'assets/professores/prof-e-grande.jpg',

  'assets/icons/icone.svg',
  'assets/icons/icone-192.png',
  'assets/icons/icone-512.png',
];

// ───────────────────────────── Instalação ─────────────────────────────

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(VERSAO);

      // Guardamos um a um em vez de usar addAll: se UM arquivo falhar, o addAll
      // inteiro é descartado e o jogo fica sem cache nenhum. Assim, uma falha
      // isolada não impede o resto de funcionar offline.
      await Promise.all(
        ARQUIVOS_ESSENCIAIS.map(async (arquivo) => {
          try {
            await cache.add(new Request(arquivo, { cache: 'reload' }));
          } catch (erro) {
            console.warn('[SW] Não foi possível guardar:', arquivo, erro.message);
          }
        }),
      );

      // Entra em vigor sem esperar o fechamento das abas antigas.
      await self.skipWaiting();
    })(),
  );
});

// ───────────────────────────── Ativação ─────────────────────────────

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Apaga caches de versões anteriores.
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome)));

      // Assume o controle das abas já abertas.
      await self.clients.claim();
    })(),
  );
});

// ───────────────────────────── Requisições ─────────────────────────────

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;

  // Só interceptamos GET. POST (o caso da análise) passa direto para a rede.
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);

  // Requisições para outros domínios não são nossas para guardar.
  if (url.origin !== self.location.origin) return;

  // ★ A rota da análise nunca passa pelo cache.
  if (url.pathname.startsWith('/api/')) {
    evento.respondWith(fetch(requisicao));
    return;
  }

  // Abrir a página: tenta a rede primeiro, para pegar atualizações.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(requisicao);
          const cache = await caches.open(VERSAO);
          cache.put(requisicao, resposta.clone());
          return resposta;
        } catch {
          // Sem internet: entrega a versão guardada.
          const guardada = await caches.match(requisicao);
          return guardada ?? caches.match('index.html');
        }
      })(),
    );
    return;
  }

  // Demais arquivos: cache primeiro (rápido e funciona offline).
  evento.respondWith(
    (async () => {
      const guardada = await caches.match(requisicao);
      if (guardada) return guardada;

      try {
        const resposta = await fetch(requisicao);

        // Guarda apenas respostas completas e bem-sucedidas.
        if (resposta.ok && resposta.status === 200) {
          const cache = await caches.open(VERSAO);
          cache.put(requisicao, resposta.clone());
        }
        return resposta;
      } catch (erro) {
        // Sem rede e sem cache: devolvemos um erro claro em vez de deixar a
        // promessa falhar sem explicação.
        return new Response('Recurso indisponível offline.', {
          status: 504,
          statusText: 'Sem conexão',
        });
      }
    })(),
  );
});
