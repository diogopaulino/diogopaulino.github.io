# Agentes

Portfólio e playground estático do Diogo Paulino. HTML, CSS e JS puro no GitHub Pages — **sem build, sem npm**. O fonte é o que vai ao ar.

## Layout

- `/index.html` — home · `/assets/` — CSS/JS/imagens da home
- `/labs/<kebab-case>/` — lab autocontido (`index.html`, CSS, JS, `assets/`)
- `/labs/index.html` — galeria que lista todos os labs
- `/CLAUDE.md` — só `@AGENTS.md` (não escreva mais nada nele)
- `/.github/PULL_REQUEST_TEMPLATE.md` — template de todo PR

## Regras

- **Vanilla.** ES modules, CSS nativo (custom properties, flex/grid). Sem libs ou frameworks a menos que o usuário peça.
- **UI.** Visual premium (dark mode elegante, microinterações). Sem bloco cinza no lugar de asset.
- **Cirúrgico.** Não reescreva o que está fora do pedido. Preserve comentários e assinaturas existentes.
- **HTML novo.** `title`, `viewport`, description, tags semânticas (`main`, `header`, `footer`).
- **Jogo/simulação.** Documente regras e fórmulas no código.
- **Dúvida de arquitetura.** Pergunte; não invente um rumo novo.

## Links

Slug do lab = pasta = card da galeria = README = `sitemap.xml`. Ao criar, mover ou renomear um lab, **corrija os quatro na mesma mudança**.

- Galeria: `href="/labs/<slug>/"`
- README e sitemap: `https://diogopaulino.com.br/labs/<slug>/`
- Voltar: header `/labs/`, footer `/`
- Teste servindo a **raiz**: `python3 -m http.server 8000` — nunca `file://` (quebra `/favicon.ico` e módulos ES)

## PRs

Use [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md): emoji no título (`✨` feat · `🐛` fix · `📚` docs · `⚡️` perf · `🎨` UI · `🧪` lab), Objetivo, O que mudou, Como testar, checklist. Sem descrição vazia.

## Cursor Cloud specific instructions

Sirva a raiz por HTTP. Não rode `npm install`. Verificação = seção Links. PRs = template acima.
