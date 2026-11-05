/**
 * dev-server.mjs — Servidor de desenvolvimento.
 *
 * Serve os arquivos do jogo na máquina local.
 *
 * Escrito em Node puro, sem nenhuma dependência: o projeto continua rodando
 * mesmo sem `npm install`, e não há pacote de terceiros para quebrar na véspera
 * da apresentação.
 *
 * Uso:  npm run dev      (ou: node scripts/dev-server.mjs 3050)
 *
 * Este arquivo NÃO vai para produção — lá quem serve os arquivos é a própria
 * hospedagem.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORTA = Number(process.argv[2]) || 3050;

/** Tipos de conteúdo por extensão. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/** Lê o corpo da requisição por inteiro. */
function lerCorpo(req) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let tamanho = 0;

    req.on('data', (parte) => {
      tamanho += parte.length;
      // Trava simples contra corpo gigante travando o servidor de desenvolvimento.
      if (tamanho > 2 * 1024 * 1024) {
        rejeitar(new Error('corpo grande demais'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });

    req.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
    req.on('error', rejeitar);
  });
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  let caminho = decodeURIComponent(url.pathname);

  /*
   * Rota auxiliar de desenvolvimento: salva o conteúdo de um canvas como PNG
   * em capturas/. Serve para gerar as imagens do relatório do Projeto
   * Integrador sem precisar recortar print de tela na mão:
   *
   *   const png = document.getElementById('canvas-tabuleiro').toDataURL('image/png');
   *   fetch('/__captura', { method: 'POST', headers: {'Content-Type':'application/json'},
   *                         body: JSON.stringify({ nome: 'tabuleiro.png', dados: png }) });
   *
   * Existe apenas neste servidor local — não vai para produção.
   */
  if (caminho === '/__captura' && req.method === 'POST') {
    try {
      const { nome, dados } = JSON.parse(await lerCorpo(req));

      // Só aceita nome de arquivo simples, para não escrever fora da pasta.
      // JPEG entrou junto do PNG: foto de bomba em PNG passa de 200 KB, e
      // este servidor também gera arquivos do projeto, não só capturas.
      if (!/^[\w-]+\.(png|jpg)$/.test(nome ?? '')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: 'Nome de arquivo inválido.' }));
        return;
      }

      const base64 = String(dados).replace(/^data:image\/(png|jpeg);base64,/, '');
      const destino = join(RAIZ, 'capturas');
      await mkdir(destino, { recursive: true });
      await writeFile(join(destino, nome), Buffer.from(base64, 'base64'));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, arquivo: `capturas/${nome}` }));
    } catch (erro) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: erro.message }));
    }
    return;
  }

  if (caminho === '/') caminho = '/index.html';

  // Impede que "../" saia da pasta do projeto.
  const relativo = normalize(caminho).replace(/^(\.\.[/\\])+/, '');
  const arquivo = join(RAIZ, relativo);

  if (!arquivo.startsWith(RAIZ + sep) && arquivo !== join(RAIZ, 'index.html')) {
    res.writeHead(403);
    res.end('Acesso negado');
    return;
  }

  try {
    const conteudo = await readFile(arquivo);
    const tipo = TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': tipo,
      // Sem cache em desenvolvimento: recarregar sempre traz o arquivo novo.
      'Cache-Control': 'no-store',
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Não encontrado: ${caminho}`);
  }
});

servidor.listen(PORTA, () => {
  console.log(`Tetris rodando em http://localhost:${PORTA}`);
});
