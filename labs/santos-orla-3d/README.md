# Santos Orla 3D

Exploração da orla contemporânea de Santos. ES modules, CSS e HTML estáticos;
CesiumJS 1.121 via CDN, sem build ou dependências npm no projeto.

## Rodar

Na raiz do repositório: `python3 -m http.server 8000`.
Abra `http://localhost:8000/labs/santos-orla-3d/`.

## O que funciona sem chave

- Globo com imagens reais Esri World Imagery, vista aérea e voo pela orla.
- Mapa vetorial da rota, sete canais e seis marcos, disponível mesmo se o motor/CDN falhar.
- Perspectivas Turista e Morador, seleção de pontos e links oficiais de Street View.
- Barra da rota e compartilhamento do trecho por URL, sem transmitir credenciais.
- Clima modelado Open-Meteo, com horário local; áudio de ondas sintetizado e opt-in.

## Ativar a cidade fotorrealista

1. No Google Cloud, habilite **Map Tiles API**, configure faturamento e uma chave.
2. Restrinja por **HTTP referrer** ao domínio de publicação (`https://diogopaulino.com.br/*`).
   Para teste local, use uma chave separada restrita a `http://localhost:8000/*`.
3. Restrinja o acesso de API a Map Tiles API e defina cotas/alertas de cobrança.
4. Cole no painel ⚙. A chave é mantida em memória nesta sessão, sem localStorage,
   URL, analytics, proxy ou logs. Ela necessariamente é enviada ao Google nas requisições.
5. Opcional: configure `googleMapsApiKey` em `src/config.js` para uma publicação com
   3D por padrão. Essa é uma **chave pública de navegador**, jamais uma credencial de servidor.

O renderer usa a raiz oficial dos Photorealistic 3D Tiles e mantém o streaming,
LOD, limites de memória e créditos. Os dados não são baixados para o repositório,
extraídos ou armazenados offline. Não há geocoder alternativo.

A caminhada só é liberada com a malha conectada **e uma amostra válida do chão
no trecho renderizado**. W/S ou setas e botões de toque movem o observador pela
rota a 1,4 m/s. A/D ou arrastar a tela gira a visão; Shift usa 3 m/s. A câmera fica a 1,72 m acima
da superfície amostrada. A malha pode ser imprecisa perto de árvores, pontes e
fachadas; isso não é um sistema de colisões para navegação livre. Sem cobertura,
o app interrompe o deslocamento e mantém os demais modos disponíveis.

**Não há chave fornecida neste projeto. Não foi possível verificar ao vivo a
cobertura fotorrealista de Santos.** Satélite é uma imagem sobre elipsoide, não
uma cidade com prédios 3D. Nunca é apresentado como substituto fotorrealista.

## Precisão e atualidade

- `src/geography.json`: snapshot OpenStreetMap consultado em 01/10/2026 UTC
  (30/09/2026 em Santos), com URL de origem, IDs OSM e atribuição ODbL.
- Percurso de 6,48 km José Menino → Canal 7, derivado do grafo de caminhos.
  Dois conectores aproximados de 6,8 m e 57,9 m resolvem lacunas do cadastro.
  Não é orientação de trânsito, condição da calçada ou garantia de acessibilidade.
- O Canal 7 fica na face do estuário. Não forçamos todos os canais numa praia reta.
- Aquário: a Prefeitura informou reforma em setembro de 2026. O texto não promete
  visitação aberta. As condições futuras precisam ser consultadas na fonte.
- Imagens são atualizadas pelos provedores, sem garantia de captura diária.
  Clima é um modelo, não ocupação da praia ou observação ao vivo.

## Módulos

`geo.js`: geodesia, referência de pesquisa e interpolação por distância.
`renderer.js`: globo, imagens, malha, LOD e câmera.
`map.js`: fallback geográfico vetorial independente do motor 3D.
`audio.js`: ambiente procedural isolado.
`app.js`: estado, modos, controles, clima e UI.

Os módulos visuais expõem `create(context)` e métodos isolados. Falhas no 3D,
áudio ou clima não apagam a exploração geográfica. A abordagem de pesquisa
antes da geometria e crítica independente vem da referência do Ruben, sem
recriar sua ambientação histórica nem copiar assets.

## Fontes

- [Referência de processo: Ruben Marcus](https://www.rubenmarcus.dev/pt/blog/reconstruindo-1554-no-navegador)
- [Prefeitura: orla e jardins](https://www.santos.sp.gov.br/?q=node%2F169653)
- [Prefeitura: reforma do Aquário, setembro/2026](https://www.santos.sp.gov.br/?q=node%2F174094)
- [OpenStreetMap: licença e atribuição](https://www.openstreetmap.org/copyright)
- [CesiumJS](https://cesium.com/learn/cesiumjs/ref-doc/)
- [Google: Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [Google: políticas e créditos](https://developers.google.com/maps/documentation/tile/policies)
- [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)
- [Open-Meteo](https://open-meteo.com/)
