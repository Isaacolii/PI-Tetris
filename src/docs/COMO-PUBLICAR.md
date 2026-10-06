# Como publicar o jogo

Responsável: **Rafael** (Áudio, Publicação e Produção).

A publicação de verdade é do **PI 4**. Este documento existe agora para que o
caminho esteja testado antes da entrega final — descobrir um problema de deploy
na véspera da apresentação é o erro mais caro que dá para cometer.

---

## Por que a Vercel

O jogo é HTML, CSS e JavaScript puros: **não tem build, não tem dependência**.
Qualquer hospedagem de site estático serve. A Vercel foi escolhida por dois
motivos concretos:

1. É gratuita para projeto acadêmico e conecta direto no GitHub — cada push na
   branch `main` publica sozinho.
2. Ela roda **funções de servidor**, que o PI 4 vai precisar para a análise por
   IA. A chave da API nunca pode ficar no navegador; ela fica na Vercel, e só o
   servidor a lê.

---

## Passo a passo

1. Criar conta em <https://vercel.com> usando o **login do GitHub**.
2. **Add New → Project** e importar o repositório do projeto.
3. Nas configurações de build, deixar tudo em branco:
   - Framework Preset: **Other**
   - Build Command: *(vazio)*
   - Output Directory: *(vazio)*
   - Install Command: *(vazio)*
4. **Deploy**. Em menos de um minuto sai um endereço `.vercel.app`.

Esse endereço é o que vai no trabalho escrito e na apresentação.

---

## Teste em branco, para fazer agora no PI 2

Antes de importar o projeto de verdade, vale publicar uma página qualquer só
para confirmar que a conta funciona e que você sabe o caminho. Leva dez minutos
e elimina a surpresa.

**Checagem depois de publicar:**

- [ ] O endereço abre em uma aba anônima (sem estar logado na Vercel)
- [ ] Abre no celular, na rede de dados — não só no wi-fi de casa
- [ ] O console do navegador (F12) não mostra nada em vermelho
- [ ] Um push na `main` gera uma nova publicação sozinho

---

## A chave da IA — regra que não tem exceção

> **A chave da API nunca entra no repositório. Em nenhuma entrega, em nenhum
> arquivo, nem comentada.**

Ela é cadastrada **só** no painel da Vercel, em
`Settings → Environment Variables`, com o nome `ANTHROPIC_API_KEY`. O código do
servidor a lê de `process.env`; o navegador nunca a vê.

O `.gitignore` do projeto já bloqueia `.env`, `.env.local` e `.env*.local`.
Ainda assim, confira antes de cada push:

```
git status
```

Se aparecer qualquer arquivo `.env`, **pare** e avise o grupo.

Chave commitada por engano é detectada por varredura automática e revogada em
minutos — e, até ser revogada, pode ser usada por terceiros com a conta do
projeto pagando.

---

## Áudio — o que vem no PI 3

O som do jogo é **sintetizado em tempo real** pela Web Audio API: osciladores e
envelopes, nenhum arquivo `.mp3` ou `.wav`.

Foi decisão de projeto, por três motivos:

1. O jogo precisa funcionar offline, e arquivo de áudio pesa.
2. Nenhuma questão de licença de som de terceiros no trabalho acadêmico.
3. O tom pode acompanhar o jogo — o som de linha limpa sobe conforme o combo,
   o que arquivo gravado não faz.

O que precisa ser desenhado no PI 3: mover, girar, travar, limpar 1 linha,
limpar 4 linhas (Tetris), poder de professor, fim de jogo. Sete sons.

---

## No dia de cada apresentação

- [ ] Abrir o endereço público **antes** de sair de casa
- [ ] Levar o projeto rodando **localmente** também (`npm run dev`)
- [ ] Ter o vídeo de demonstração à mão

Internet de faculdade cai. O jogo rodando no próprio notebook nunca cai.
