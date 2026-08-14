# 🤖 Instruções para Agentes de IA

Olá, Agente! Se você está lendo isso, significa que você está atuando no desenvolvimento deste projeto. Este documento centraliza o contexto, as diretrizes de arquitetura e as melhores práticas que você deve seguir rigorosamente ao criar, modificar ou analisar código neste repositório.

## 📌 Contexto do Projeto

Este repositório é o portfólio pessoal e *Playground* de laboratórios do Diogo Paulino. O site principal e a vasta maioria dos laboratórios (localizados na pasta `/labs/`) são construídos de forma limpa, direta e estática.

- **Stack Principal**: HTML, CSS e JavaScript puros (Vanilla).
- **Deploy**: GitHub Pages.
- **Sem Build Step**: O código fonte geralmente é o próprio código de produção. Não utilizamos Node.js, Webpack, Vite ou empacotadores na raiz do projeto (salvo exceções explícitas em alguns laboratórios). Tudo roda diretamente no navegador.

## 🏗 Estrutura de Diretórios

- `/index.html`: Arquivo raiz do portfólio.
- `/assets/`: Recursos compartilhados do site principal (estilos, imagens).
- `/labs/`: Diretório que contém todos os experimentos e mini-projetos.
  - Cada laboratório vive em sua própria subpasta em *kebab-case* (ex: `/labs/rock-kombat/`).
  - Cada pasta de laboratório é autocontida (possui seu próprio `index.html`, arquivos `.css`, `.js` e pastas de `assets/`), facilitando a manutenção e a visualização estática.

## 🛠 Melhores Práticas e Regras de Desenvolvimento

### 1. Stack e Tecnologias
- **Vanilla First**: Utilize recursos modernos e nativos dos navegadores (ES6+, Web APIs, Canvas, WebGL, Web Audio, LocalStorage) ao invés de introduzir dependências externas (bibliotecas/frameworks), a menos que estritamente solicitado pelo usuário.
- **JavaScript Modular**: Adote ES Modules (`<script type="module">`). Mantenha a lógica separada, utilize classes ou funções puras, e escreva código assíncrono moderno (`async/await`).
- **CSS Moderno**: Utilize Variáveis CSS (Custom Properties), Flexbox, CSS Grid e animações nativas. Evite frameworks CSS (como Tailwind ou Bootstrap) a menos que explicitamente solicitado.

### 2. Padrões de Design e UI/UX
- **Aparência Premium (WOW Factor)**: O design é essencial. Crie interfaces modernas, fluídas, responsivas e visualmente impressionantes. Considere o uso de:
  - Paletas de cores harmônicas (preferência por Dark Modes elegantes).
  - Tipografia moderna.
  - Efeitos de *glassmorphism*, gradientes sutis e sombras bem calibradas.
  - Micro-interações e *feedbacks* visuais ao passar o mouse ou clicar.
- **Sem "Placeholders" Definitivos**: Se um laboratório precisar de uma imagem ou *asset* visual, crie ou simule algo coerente em vez de usar blocos cinzas genéricos.

### 3. Workflow de Modificação (Aja com Precisão)
- **Não quebre o que está funcionando**: Faça modificações cirúrgicas. Evite reescrever arquivos inteiros ou refatorar códigos e lógicas que estão fora do escopo da solicitação do usuário.
- **Respeite Comentários e Lógica Existente**: Mantenha as assinaturas de funções antigas ou comentários de explicação a não ser que a tarefa seja especificamente limpar o código.
- **Caminhos de Arquivos (Paths)**: Como o projeto é servido no GitHub Pages, garanta que os caminhos para imagens e scripts estejam corretos, preferindo caminhos relativos (ex: `./assets/img.png` ou `../style.css`). Caminhos absolutos da raiz (`/labs/`, `/favicon.ico`, `/assets/...`) também são válidos — testar sempre via HTTP, nunca via `file://`.

### 4. SEO e Semântica
- Para novos arquivos HTML, inclua sempre as *tags* fundamentais: `<title>`, `<meta name="viewport">` adequada, meta descrições e utilize HTML semântico (`<main>`, `<section>`, `<article>`, `<header>`, `<footer>`).

### 5. Resolução de Problemas e Autonomia
- Analise, planeje e só então codifique. Se encontrar uma ambiguidade significativa nos requisitos do usuário que impacte a arquitetura, pare e peça esclarecimentos.
- Sempre documente o código de lógicas complexas (como fórmulas matemáticas para simulações ou regras de jogos).

### 6. Auditoria de links (obrigatória)
Toda vez que um lab for criado, movido, renomeado ou a galeria/README for tocado — e de preferência ao fechar qualquer PR — **verifique os links e corrija o que estiver quebrado na mesma mudança**. Não deixe 404, card órfão ou README desatualizado para depois.

Checklist mínimo (estas listas devem ter os **mesmos slugs**):

1. Pastas em `/labs/<kebab-case>/` com `index.html`
2. Card em [`labs/index.html`](labs/index.html) com `href="/labs/<slug>/"`
3. Linha no playground do [`README.md`](README.md) apontando para `https://diogopaulino.com.br/labs/<slug>/`
4. Entrada em [`sitemap.xml`](sitemap.xml) com a mesma URL canônica

Também conferir, e corrigir se falhar:

- Link **Labs** da home (`/labs/`) e voltar de cada lab (`/labs/` no header, `/` no footer)
- Assets, CSS e JS do lab (caminhos relativos ou absolutos a partir da raiz)
- Canonical / Open Graph `https://diogopaulino.com.br/labs/<slug>/`
- Servir a **raiz** do repo (`python3 -m http.server 8000`) e abrir home, galeria e o lab alterado — `file://` quebra módulos ES e `/favicon.ico`

### 7. Pull requests
**Todo PR novo deve nascer do template** [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Não envie descrição vazia, genérica ou só com a mensagem do commit.

- Título: emoji + resumo (`✨`, `🐛`, `📚`, `⚡️`, `🎨`, `🧪` conforme o objetivo)
- Preencha **Objetivo**, **O que mudou** e **Como testar** — apague os comentários placeholder
- Marque o checklist; se um item não se aplica, diga o porquê em vez de fingir que testou
- Agentes: ao criar/atualizar o PR, copie a estrutura do template no body (o GitHub só injeta o arquivo automaticamente na UI)

---

## Cursor Cloud specific instructions

Site 100% estático (HTML/CSS/JS puro). **Não há build, dependências, lockfiles, nem testes/lint automatizados** — não procure por `package.json`, `npm install`, etc. O código-fonte é o próprio artefato servido no GitHub Pages.

- **Rodar em desenvolvimento**: sirva a raiz do repositório por HTTP (abrir os arquivos via `file://` quebra caminhos absolutos como `/favicon.ico` e módulos ES). A partir de `/workspace`:
  - `python3 -m http.server 8000` → site principal em `http://localhost:8000/`, playground em `http://localhost:8000/labs/`.
- **Estrutura**: `index.html` (portfólio raiz) + `labs/<nome-do-lab>/index.html` (cada lab é autocontido). `labs/index.html` é a galeria que linka todos os labs.
- **Caminhos**: o `manifest.json` e alguns assets usam caminhos absolutos (`/favicon.ico`, `/assets/...`), por isso é necessário servir a partir da raiz do repositório, não de uma subpasta.
- **Verificação/"testes"**: não existe suíte automatizada. Sirva a raiz por HTTP e:
  - carregue a home (toggle de tema) e a galeria (`/labs/`)
  - rode a [auditoria de links](#6-auditoria-de-links-obrigatória) e **corrija** 404, cards órfãos e README/sitemap desatualizados
- **PRs**: todo PR novo usa [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) (objetivo, o que mudou, como testar, checklist). Sem descrição placeholder.

---
*Lembre-se: O objetivo principal do projeto é criatividade, performance e experimentação tecnológica na web sem barreiras.*
