# Assets compartilhados dos labs

Binários usados pelos labs 3D via [`../gfx/assets.js`](../gfx/assets.js). São os únicos arquivos do site
que não nascem de código: céus HDR, conjuntos de textura PBR e props fotogramétricos.

| Pasta | Conteúdo | Origem | Licença |
| --- | --- | --- | --- |
| `hdri/` | 5 céus HDR equirretangulares, 1k (`.hdr`) | [Poly Haven](https://polyhaven.com/hdris) | CC0 1.0 |
| `tex/<nome>/` | 31 conjuntos PBR tileáveis, 1k: `diff.jpg` (albedo), `nor.jpg` (normal OpenGL), `arm.jpg` (AO · rugosidade · metal) | [Poly Haven](https://polyhaven.com/textures) | CC0 1.0 |
| `models/<nome>/` | 37 modelos glTF 1k (`.gltf` + `.bin` + `textures/`) | [Poly Haven](https://polyhaven.com/models) | CC0 1.0 |
| `models/fox/Fox.glb` | Raposa com esqueleto e 3 clipes | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox) | Modelo: CC0 1.0 (PixelMannen) · Rig e animação: CC BY 4.0 (tomkranis) · Conversão glTF: CC BY 4.0 (AsoboStudio, scurest) |

O nome de cada pasta é o identificador do asset no Poly Haven (`https://polyhaven.com/a/<nome>`).

## Processamento

- Resolução 1k em tudo: é o ponto em que a textura ainda segura um close em terceira pessoa e o conjunto
  inteiro cabe em ~80 MB.
- Os JPEG foram recomprimidos com qualidade 68 (`sips -s format jpeg -s formatOptions 68`), o que corta o
  peso pela metade sem artefato visível em albedo, normal ou `arm`.
- No perfil leve ou com economia de dados, o carregador usa as cópias de 512 × 512 em `tex/<nome>/512/`. O albedo é WebP e os mapas de dados são JPEG 4:4:4 para preservar a resolução dos canais. Inclua as três cópias ao adicionar um conjunto.
- Geometria e `.gltf` estão como vieram do Poly Haven.

## Como adicionar um asset

1. Baixe do Poly Haven em 1k (HDRI `.hdr`; textura `Diffuse` + `nor_gl` + `arm` em JPG; modelo em glTF).
2. Salve seguindo o layout acima, com os nomes `diff.jpg` / `nor.jpg` / `arm.jpg` no caso de textura.
3. Recomprima os JPEG e registre o nome em `TEXTURE_SETS`, `MODELS` ou `HDRIS` em `gfx/assets.js`.
4. Acrescente a origem e a licença nesta tabela se não for Poly Haven.
