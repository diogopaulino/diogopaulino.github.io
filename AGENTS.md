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
- **HTML novo.** `title`, `viewport`, description, tags semânticas (`main`, `header`, `footer`) e o bloco de SEO abaixo.
- **Jogo/simulação.** Documente regras e fórmulas no código.
- **Dúvida de arquitetura.** Pergunte; não invente um rumo novo.

## Links e catálogo

Slug do lab = pasta = card da galeria = README = `sitemap.xml`. Ao **criar, mover, renomear ou remover** um lab, **corrija os quatro na mesma mudança**. Sem exceção, sem “faço o README depois”.

**O README é obrigatório em toda mudança de catálogo.** Toda pasta em `/labs/<slug>/` precisa de uma linha na tabela do Playground apontando para `https://diogopaulino.com.br/labs/<slug>/`. Se o lab mudar de nome ou de slug, atualize o texto do link e a URL. Sem essa linha, o lab some do catálogo do GitHub. Atualize também o número de experimentos (badge no topo + texto “N experimentos”).

Na mesma mudança:

- Galeria (`labs/index.html`): card com `href="/labs/<slug>/"`, ícone SVG, título e tags; contagem nos `title`, `description`, Open Graph, Twitter e JSON-LD
- README: linha na tabela certa + URL absoluta + contagem
- `sitemap.xml`: `https://diogopaulino.com.br/labs/<slug>/`
- Voltar: header `/labs/`, footer `/`
- Teste servindo a **raiz**: `python3 -m http.server 8000` — nunca `file://` (quebra `/favicon.ico` e módulos ES)

## SEO (sempre consistente)

Garanta SEO consistente em **toda** página nova, lab novo ou lab que mudar de nome/slug. O nome **Diogo Paulino** precisa aparecer de forma estável (title, author, JSON-LD, `og:site_name`) para busca pelo nome, por IA e pelo playground.

Bloco mínimo no `<head>`:

- `html lang="pt-br"` (ou `pt-BR`)
- `<title>` — home e galeria: **Diogo Paulino** no título; lab: `{Nome do lab} — {gancho} | Diogo Paulino`
- `meta name="description"` — uma frase única; na home/galeria incluir o nome e o que o site é (design, código, música, IA, labs)
- `meta name="author" content="Diogo Paulino"`
- `meta name="robots" content="index, follow"`
- `link rel="canonical"` absoluto (`https://diogopaulino.com.br/...`)
- Open Graph: `og:type`, `og:site_name` (`Diogo Paulino` na home, `Diogo Paulino · Labs` nos labs), `og:url`, `og:title`, `og:description`, `og:image`, `og:image:alt`, `og:locale` (`pt_BR`)
- Twitter: `twitter:card` = `summary_large_image` + title, description e image iguais ao OG
- JSON-LD: Person + WebSite + ProfilePage na home; CollectionPage + ItemList na galeria; WebApplication + BreadcrumbList no lab (`author` = Diogo Paulino)
- Favicon (`/favicon.ico`)

Se o slug mudar, atualize canonical, `og:url`, JSON-LD, galeria, README e sitemap juntos. Não deixe description, title ou contagem defasados.

## PRs

Use [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md): emoji no título (`✨` feat · `🐛` fix · `📚` docs · `⚡️` perf · `🎨` UI · `🧪` lab), Objetivo, O que mudou, Como testar, checklist. Sem descrição vazia.

## Cursor Cloud specific instructions

Sirva a raiz por HTTP. Não rode `npm install`. Verificação = seção Links e catálogo + SEO. PRs = template acima.
