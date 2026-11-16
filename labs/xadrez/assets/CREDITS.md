# Créditos dos materiais e modelos

Peças (rei, dama, torre, bispo, cavalo e peão): **A Beautiful Game**, MaterialX Project / ASWF (2020); conversão glTF de Ed Mackey (2022). Licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Fonte: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame . Adaptações: extração das geometrias; corpo e esfera do peão unidos numa peça só; simplificação com erro geométrico limitado a 0,05% de cada malha (`gltf-transform weld` + `simplify`), preservando UVs e normais; normalização de escala mantendo a proporção original entre as peças; compactação gzip com quantização de 16 bits. Conversor reproduzível em `../tools/pack-pieces.py`. As peças procedurais do laboratório ficam apenas como reserva caso o pacote não carregue.

Mapas das peças (`pieces/*-normal.jpg`, `pieces/*-orm.jpg`): texturas originais do mesmo conjunto (CC BY 4.0), reduzidas para 1024 px (normal) e 512 px (ORM: oclusão, rugosidade, metal) em JPEG. O albedo de cada cor (buxo/marfim, ébano e guarnições de latão) é gerado no navegador a partir do canal de metal do ORM; os materiais são do laboratório.

Madeira: **Wood Table 001**, Dimitrios Savva e Rico Cilliers / Poly Haven, [CC0](https://polyhaven.com/license). Fonte: https://polyhaven.com/a/wood_table_001 . Mapas diffuse e normal OpenGL em 1K, usados na moldura, na mesa, nas bandejas e no piso. As lâminas de bordo e nogueira das casas são procedurais.

Luz e reflexos (o cenário visível é a sala panorâmica abaixo): **Wooden Lounge**, Greg Zaal / Poly Haven, [CC0](https://polyhaven.com/license). Fonte: https://polyhaven.com/a/wooden_lounge . Arquivo: `wooden-lounge-1k.hdr` (HDRI equiretangular 1K, Radiance RGBE). O mesmo arquivo ilumina a cena (IBL), gera os reflexos das peças e aparece desfocado como fundo da sala.

Sala panorâmica: imagem original gerada para este laboratório com a ferramenta integrada **ImageGen** em 6 de setembro de 2026. Arquivo: `reading-room.webp` (1774 × 887, panorama 2:1, WebP). O panorama compõe o ambiente; mesa, tabuleiro e peças são geometria 3D interativa.

Brief utilizado: panorama equiretangular 360 × 180 de uma sala de leitura com paredes verde-escuras, boiserie de nogueira, estantes com livros, janelas com cortinas de linho, quadros, luminárias de latão, poltrona de couro e tapete persa; luz lateral difusa de fim de tarde, materiais fotográficos, centro vazio sem mesa ou peças, sem pessoas ou texto.
