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
- **Responsivo.** Todo lab — jogo, ferramenta, simulação ou instrumento — precisa funcionar muito bem em celular, tablet e desktop. Não é opcional nem “faço depois”. Ver seção Responsivo.
- **Cirúrgico.** Não reescreva o que está fora do pedido. Preserve comentários e assinaturas existentes.
- **HTML novo.** `title`, `viewport`, description, tags semânticas (`main`, `header`, `footer`) e o bloco de SEO abaixo.
- **Jogo/simulação.** Documente regras e fórmulas no código.
- **Dúvida de arquitetura.** Pergunte; não invente um rumo novo.

## Responsivo (obrigatório)

Aplica-se a **todo** lab novo ou alterado, e à home/galeria. Um layout que só cabe no desktop não entra.

Alvos de teste (DevTools ou aparelho): **375×667** (iPhone SE), **390×844** (iPhone 14) e **landscape curto** (~667×375). Sem barra de rolagem horizontal. Sem HUD/controles cobrindo o que o usuário precisa ver ou tocar.

Checklist:

- **Viewport.** `width=device-width, initial-scale=1, viewport-fit=cover` (jogos fullscreen podem manter `maximum-scale=1` / `user-scalable=no`).
- **Safe-area.** Notch e home indicator: `env(safe-area-inset-*)` no padding de header, HUD, overlays, docks e controles de toque. Sem `viewport-fit=cover`, o inset fica 0 no iPhone.
- **Largura fluida.** Nada com largura fixa maior que o viewport. Use `min(…, 100%)`, `clamp()`, `minmax(0, 1fr)`. Canvas/stage escala com o container — nunca `width: 820px` sem `max-width: 100%`.
- **Overflow.** `overflow-x: clip` no `html`/`body` quando o lab não precisa de scroll lateral. Grids com `minmax(300px, 1fr)` viram `1fr` abaixo de 768px.
- **Toque.** Alvos interativos ≥ **44×44px**. Botões de HUD (mute, pause) não ficam embaixo dos controles de jogo. Mostrar pad/stick em `pointer: coarse` (e esconder em `pointer: fine` se o teclado/mouse basta).
- **HUD e overlays.** Empilhar em 1 coluna no estreito; `max-height: min(92dvh, …)` + `overflow-y: auto` em menus. Landscape: compactar HUD, reduzir stick/pads, não deixar painel inferior cobrir o canvas.
- **Tipografia.** `clamp()` / `vw` com teto; títulos longos com `ellipsis` ou quebra. Sem `white-space: nowrap` em frases que estouram 375px.
- **Altura.** Preferir `100dvh` a `100vh` em apps fullscreen. Não force `min-height: 600px` em wrappers de ferramenta — no SE isso empurra o canvas para fora.

Ao criar um lab, escreva os `@media` (pelo menos `max-width: 768px` e, se for jogo/fullscreen, `max-height: 520px and (orientation: landscape)`) na mesma mudança. Referência boa: `river-knight` (landscape + safe-area) e `labs/shared.css` (header 44px no mobile).

## Links e catálogo

Slug do lab = pasta = card da galeria = README = `sitemap.xml`. Ao **criar, mover, renomear ou remover** um lab, **corrija os quatro na mesma mudança**. Sem exceção, sem “faço o README depois”.

**O README é obrigatório em toda mudança de catálogo.** Toda pasta em `/labs/<slug>/` precisa de uma linha na tabela do Playground apontando para `https://diogopaulino.com.br/labs/<slug>/`. Se o lab mudar de nome ou de slug, atualize o texto do link e a URL. Sem essa linha, o lab some do catálogo do GitHub. Atualize também o número de experimentos (badge no topo + texto “N experimentos”).

Na mesma mudança:

- Galeria (`labs/index.html`): card com `href="/labs/<slug>/"`, ícone SVG, título e tags; contagem nos `title`, `description`, Open Graph, Twitter e JSON-LD
- README: linha na tabela certa + URL absoluta + contagem
- `sitemap.xml`: `https://diogopaulino.com.br/labs/<slug>/`
- Voltar: header `/labs/`, footer `/`
- Teste servindo a **raiz**: `python3 -m http.server 8000` — nunca `file://` (quebra `/favicon.ico` e módulos ES)
- Teste **responsivo**: 375px, 390px e landscape curto — overflow, HUD, toque, safe-area (seção Responsivo)

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

Sirva a raiz por HTTP. Não rode `npm install`. Verificação = seção Links e catálogo + SEO + Responsivo. PRs = template acima.
