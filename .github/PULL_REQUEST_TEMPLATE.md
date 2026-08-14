## 🎯 Objetivo

<!-- Uma frase: o que esta PR entrega e por quê. Comece o *título* com um emoji que bata com a intenção: ✨ feat · 🐛 fix · 📚 docs · ⚡️ perf · 🎨 UI · 🧪 lab -->

## ✨ O que mudou

<!-- Lista curta. Um item por mudança visível. -->
-

## 🧪 Como testar

1. Na raiz do repo: `python3 -m http.server 8000`
2. Abrir [http://localhost:8000/](http://localhost:8000/) (home) e [http://localhost:8000/labs/](http://localhost:8000/labs/) (galeria)
3. Abrir o lab ou a página alterada e confirmar que CSS, JS e o voltar funcionam
4. Se o lab for novo, renomeado ou removido: conferir pasta ↔ card da galeria ↔ README ↔ `sitemap.xml` ↔ canonical/OG

## ✅ Checklist

- [ ] Links conferidos: pasta do lab ↔ card da galeria ↔ README ↔ sitemap (e corrigidos se quebravam)
- [ ] README atualizado (linha na tabela + URL + contagem no badge/texto) — obrigatório em lab novo, renomeado ou removido
- [ ] SEO consistente: title, description, canonical, author, robots, OG, Twitter, JSON-LD (e contagem nos metas da galeria)
- [ ] Testado via HTTP na raiz, não via `file://`
- [ ] Nada fora do escopo foi quebrado
