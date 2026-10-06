/**
 * servidor.mjs — servidor local para abrir o jogo no navegador.
 *
 * Por que isto é necessário: o projeto usa módulos ES (`import` / `export`).
 * Navegador nenhum carrega módulo por `file://` — a política de mesma origem
 * bloqueia. Abrir o `index.html` com dois cliques mostra uma tela preta e um
 * erro de CORS no console.
 *
 * Usa apenas o que já vem no Node. Nada de instalar pacote.
 *
 *     npm run dev        → http://localhost:3050
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORTA = Number(process.argv[2]) || 3050;

/** Tipo de conteúdo por extensão. Sem isto o navegador recusa os módulos. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const servidor = createServer(async (requisicao, resposta) => {
  const caminhoPedido = decodeURIComponent(new URL(requisicao.url, 'http://local').pathname);
  const relativo = caminhoPedido === '/' ? 'index.html' : caminhoPedido.slice(1);

  // Impede que "../.." saia da pasta do projeto e sirva arquivos do computador.
  const destino = join(RAIZ, normalize(relativo));
  if (!destino.startsWith(RAIZ + sep) && destino !== join(RAIZ, 'index.html')) {
    resposta.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    resposta.end('Fora da pasta do projeto.');
    return;
  }

  try {
    const conteudo = await readFile(destino);
    resposta.writeHead(200, {
      'content-type': TIPOS[extname(destino)] ?? 'application/octet-stream',
      // Sem isto o navegador guarda os módulos e as edições não aparecem.
      'cache-control': 'no-store',
    });
    resposta.end(conteudo);
  } catch {
    resposta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    resposta.end(`Não encontrado: ${relativo}`);
  }
});

servidor.listen(PORTA, () => {
  console.log(`Tetris dos Professores rodando em http://localhost:${PORTA}`);
  console.log('Encerre com Ctrl+C.');
});
