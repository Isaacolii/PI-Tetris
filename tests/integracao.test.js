/**
 * integracao.test.js — Testes das camadas fora do núcleo.
 *
 * Cobre skins, persistência e análise de desempenho. Assim como os testes do
 * núcleo, rodam **sem navegador**: as classes de renderização foram escritas de
 * modo que a lógica de escolha de pintor não dependa de um canvas existir.
 *
 * Rode com:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AssetLoader } from '../src/render/AssetLoader.js';
import { SkinRegistry } from '../src/render/SkinRegistry.js';
import { PintorDeCor, PintorDePadrao, PintorDeImagem } from '../src/render/BlockPainter.js';
import { TIPOS_DE_PECA } from '../src/core/Tetromino.js';

import { LocalStore } from '../src/storage/LocalStore.js';
import { RankingStorage } from '../src/storage/RankingStorage.js';
import { SettingsStorage } from '../src/storage/SettingsStorage.js';
import { ProfileExport } from '../src/storage/ProfileExport.js';

import { GameEngine, ESTADOS } from '../src/core/GameEngine.js';
// ───────────────────────── Apoio ─────────────────────────

/** Contexto de canvas falso: registra as chamadas de desenho em vez de pintar. */
function criarContextoFalso() {
  const chamadas = [];
  const nada = () => {};
  const ctx = new Proxy(
    {},
    {
      get: (_, prop) =>
        ['fillRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText'].includes(prop)
          ? (...args) => chamadas.push({ metodo: prop, args })
          : nada,
      set: () => true,
    },
  );
  return { ctx, chamadas };
}

/** Joga uma partida completa e devolve o resultado. */
function jogarPartida({ modo = 'maratona', semente = 1, maximoDePecas = 80, deltaMs = 900 } = {}) {
  const jogo = new GameEngine({ modo, semente });
  jogo.iniciar();

  let jogadas = 0;
  while (jogo.estado === ESTADOS.JOGANDO && jogadas < maximoDePecas) {
    for (let i = 0; i < jogadas % 5; i++) jogo.mover(-1);
    jogo.hardDrop();
    jogo.update(deltaMs);
    jogadas++;
  }
  return jogo.resultado();
}

// ───────────────────────── Skins ─────────────────────────

test('o catálogo traz as skins embutidas de peça e de fundo', () => {
  const skins = new SkinRegistry(new AssetLoader());

  const idsDePeca = skins.skinsDePecaDisponiveis().map((s) => s.id);
  assert.ok(idsDePeca.includes('classico'));
  assert.ok(idsDePeca.includes('retro'));
  assert.ok(skins.skinsDeFundoDisponiveis().length >= 3);
});

test('cada tipo de skin produz o pintor correspondente', () => {
  const skins = new SkinRegistry(new AssetLoader());

  skins.definirSkinDePeca('classico');
  assert.ok(skins.pintorPara('T') instanceof PintorDeCor);

  skins.definirSkinDePeca('retro');
  assert.ok(skins.pintorPara('T') instanceof PintorDePadrao);
});

test('trocar de skin muda a cor de todas as sete peças', () => {
  const skins = new SkinRegistry(new AssetLoader());

  skins.definirSkinDePeca('classico');
  const antes = TIPOS_DE_PECA.map((tipo) => skins.corRepresentativa(tipo));

  skins.definirSkinDePeca('neon');
  const depois = TIPOS_DE_PECA.map((tipo) => skins.corRepresentativa(tipo));

  assert.equal(antes.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.notEqual(antes[i], depois[i], `a peça ${TIPOS_DE_PECA[i]} não mudou de cor`);
  }
});

test('skin de imagem usa o pintor de imagem e guarda uma cor de reserva', () => {
  const skins = new SkinRegistry(new AssetLoader());

  skins.registrarSkinPersonalizada({
    id: 'fotos',
    nome: 'Fotos',
    tipo: 'imagem',
    personalizada: true,
    mapa: Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, `foto-${t}.png`])),
    cores: Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, '#123456'])),
  });
  skins.definirSkinDePeca('fotos');

  const pintor = skins.pintorPara('T');
  assert.ok(pintor instanceof PintorDeImagem);
  assert.equal(pintor.caminho, 'foto-T.png');
  assert.ok(pintor.pintorDeReserva instanceof PintorDeCor, 'faltou a cor de reserva');
});

test('imagem indisponível cai na cor de reserva em vez de deixar o bloco invisível', () => {
  const skins = new SkinRegistry(new AssetLoader());
  skins.registrarSkinPersonalizada({
    id: 'fotos',
    nome: 'Fotos',
    tipo: 'imagem',
    mapa: Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, 'nao-existe.png'])),
    cores: Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, '#123456'])),
  });
  skins.definirSkinDePeca('fotos');

  const { ctx, chamadas } = criarContextoFalso();
  skins.pintorPara('T').pintar(ctx, 0, 0, 30, {});

  const desenhou = chamadas.map((c) => c.metodo);
  assert.ok(desenhou.includes('fillRect'), 'deveria ter pintado a cor de reserva');
  assert.ok(!desenhou.includes('drawImage'), 'não havia imagem para desenhar');
});

test('o modo daltônico desenha um símbolo dentro do bloco', () => {
  const skins = new SkinRegistry(new AssetLoader());

  skins.definirSimbolos(false);
  assert.equal(skins.simboloPara('T'), null);

  skins.definirSimbolos(true);
  assert.equal(typeof skins.simboloPara('T'), 'string');

  const { ctx, chamadas } = criarContextoFalso();
  skins.pintorPara('T').pintar(ctx, 0, 0, 30, { simbolo: skins.simboloPara('T') });
  assert.ok(chamadas.some((c) => c.metodo === 'fillText'), 'o símbolo não foi desenhado');
});

test('a sombra da peça é desenhada, mas sem o símbolo', () => {
  const skins = new SkinRegistry(new AssetLoader());
  skins.definirSimbolos(true);

  const { ctx, chamadas } = criarContextoFalso();
  skins.pintorPara('T').pintar(ctx, 0, 0, 30, { fantasma: true, simbolo: '▲' });

  assert.ok(chamadas.some((c) => c.metodo === 'fillRect'), 'a sombra deveria ser desenhada');
  assert.ok(
    !chamadas.some((c) => c.metodo === 'fillText'),
    'a sombra não deve receber símbolo, senão polui o tabuleiro',
  );
});

test('skin desconhecida é recusada sem quebrar o jogo', () => {
  const skins = new SkinRegistry(new AssetLoader());
  const antes = skins.skinDePecaAtiva.id;

  assert.equal(skins.definirSkinDePeca('nao-existe'), false);
  assert.equal(skins.skinDePecaAtiva.id, antes, 'a skin ativa não deveria ter mudado');
});

test('remover a skin em uso volta para a padrão', () => {
  const skins = new SkinRegistry(new AssetLoader());
  skins.registrarSkinPersonalizada({
    id: 'temporaria',
    nome: 'Temporária',
    tipo: 'imagem',
    mapa: Object.fromEntries(TIPOS_DE_PECA.map((t) => [t, 'x.png'])),
  });
  skins.definirSkinDePeca('temporaria');
  skins.removerSkinPersonalizada('temporaria');

  assert.equal(skins.skinDePecaAtiva.id, 'classico');
});

test('a troca de skin avisa quem estiver ouvindo', () => {
  const skins = new SkinRegistry(new AssetLoader());
  let avisos = 0;
  skins.aoMudar(() => avisos++);

  skins.definirSkinDePeca('neon');
  skins.definirSkinDeFundo('aurora');
  skins.definirSimbolos(true);

  assert.equal(avisos, 3);
});

// ───────────────────────── Persistência ─────────────────────────

test('o armazenamento sobrevive quando o localStorage não existe', () => {
  const store = new LocalStore('teste');
  // No Node não há localStorage: o LocalStore deve cair na reserva em memória
  // em vez de estourar. É o mesmo caminho da navegação anônima.
  assert.equal(store.disponivel, false);

  store.gravar('chave', { a: 1 });
  assert.deepEqual(store.ler('chave'), { a: 1 });
  assert.deepEqual(store.ler('inexistente', 'padrao'), 'padrao');
});

test('o ranking ordena por pontos, e o Sprint por tempo', () => {
  const ranking = new RankingStorage(new LocalStore('r1'));

  ranking.registrar({ ...jogarPartida({ semente: 1 }), pontos: 100 }, 'A');
  ranking.registrar({ ...jogarPartida({ semente: 2 }), pontos: 300 }, 'B');
  ranking.registrar({ ...jogarPartida({ semente: 3 }), pontos: 200 }, 'C');

  const melhores = ranking.melhores('maratona', 3);
  assert.deepEqual(melhores.map((p) => p.nome), ['B', 'C', 'A']);
});

test('no Sprint, quem não cumpriu o objetivo fica atrás de quem cumpriu', () => {
  const ranking = new RankingStorage(new LocalStore('r2'));
  const base = jogarPartida({ modo: 'sprint', semente: 4 });

  ranking.registrar({ ...base, motivoDoFim: 'transbordo', pontos: 9999 }, 'Desistiu');
  ranking.registrar(
    { ...base, motivoDoFim: 'objetivo', pontos: 10, estatisticas: { ...base.estatisticas, tempoDecorridoMs: 60000 } },
    'Terminou',
  );

  assert.equal(ranking.melhores('sprint', 2)[0].nome, 'Terminou');
});

test('o perfil resume as partidas de um jogador', () => {
  const ranking = new RankingStorage(new LocalStore('r3'));
  ranking.registrar(jogarPartida({ semente: 5 }), 'Isaac');
  ranking.registrar(jogarPartida({ semente: 6 }), 'Isaac');

  const perfil = ranking.perfilDe('Isaac');
  assert.equal(perfil.partidas, 2);
  assert.ok(perfil.melhorPontuacao >= perfil.pontuacaoMedia);
  assert.equal(ranking.perfilDe('NinguemJogouComEsteNome'), null);
});

test('mesclar perfis não duplica partidas já existentes', () => {
  const ranking = new RankingStorage(new LocalStore('r4'));
  ranking.registrar(jogarPartida({ semente: 7 }), 'Isaac');

  const quantidade = ranking.partidas.length;
  const novas = ranking.mesclar([...ranking.partidas]);

  assert.equal(novas, 0);
  assert.equal(ranking.partidas.length, quantidade);
});

test('as configurações têm padrões e aceitam alteração', () => {
  const config = new SettingsStorage(new LocalStore('c1'));

  assert.equal(config.obter('skinDePeca'), 'classico');
  assert.equal(config.obter('mostrarFantasma'), true);

  config.definir('skinDePeca', 'neon');
  assert.equal(config.obter('skinDePeca'), 'neon');
});

test('perfil importado é validado antes de entrar no ranking', () => {
  assert.equal(ProfileExport.validar(null).valido, false);
  assert.equal(ProfileExport.validar({ formato: 'outro-jogo' }).valido, false);
  assert.equal(ProfileExport.validar({ formato: 'tetris-pi-perfil', versao: 999 }).valido, false);
  assert.equal(
    ProfileExport.validar({ formato: 'tetris-pi-perfil', versao: 1, partidas: [] }).valido,
    true,
  );
});

test('o perfil exportado carrega as partidas do jogador', () => {
  const store = new LocalStore('e1');
  const ranking = new RankingStorage(store);
  const config = new SettingsStorage(store);
  ranking.registrar(jogarPartida({ semente: 8 }), 'Isaac');

  const perfil = new ProfileExport(ranking, config).montar('Isaac');

  assert.equal(perfil.formato, 'tetris-pi-perfil');
  assert.equal(perfil.jogador, 'Isaac');
  assert.equal(perfil.partidas.length, 1);
  assert.equal(ProfileExport.validar(perfil).valido, true);
});
