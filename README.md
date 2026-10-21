# Casa Mirante · experiência imobiliária cinematográfica

Site de venda de imóvel guiado pela rolagem, feito com **imagens reais de uma única residência**: um voo de drone entre o mar e a lagoa, a fachada revelada do desenho à casa pronta e os ambientes em vídeo, seguidos da galeria, da ficha completa e do contato.

> **Apresentação demonstrativa.** A casa das imagens é real (litoral da Bahia) e aparece apenas como referência visual. Ela não está sendo anunciada por este site. Valor, áreas e número de cômodos são **ilustrativos** e aparecem com esse selo na ficha. O nome "Casa Mirante" foi criado para a apresentação.

## Por que vídeo real e não 3D

A primeira versão (em `legacy-3d/`, fora do build) gerava a casa em Three.js e parecia um jogo. Na revisão, as três alternativas foram avaliadas:

1. **Modelo 3D realista:** o melhor candidato gratuito encontrado (Sketchfab, CC BY, cerca de 950 mil triângulos) não tinha iluminação pronta nem interiores e exigia login para baixar. Renderizado em tempo real no navegador, não chegaria perto de uma foto.
2. **Vídeos e fotografias reais:** foi a escolhida. Um lote de cerca de 30 vídeos 4K de **uma mesma casa** (fachada, entrada, escada, estar, jantar, suítes, varanda, pergolado, piscina e drone), publicados por Alef Morais no Pexels.
3. **Fotografia com elementos arquitetônicos:** está incluída na seção da fachada: o desenho, os volumes e os materiais são traçados sobre um quadro real e revelam a fotografia.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5280
npm run build      # gera dist/ (base relativa, funciona em qualquer subpasta)
npm run test:e2e   # 13 cenários Playwright em desktop e celular (build + preview)
node tools/shots.mjs http://localhost:5280/ shots 1440 900   # capturas da rolagem
node tools/perf.mjs  http://localhost:5280/ 1440 900          # fluidez e atraso dos vídeos
```

## Como funciona

| Parte | Onde |
| --- | --- |
| Dados do imóvel (ficha, textos, características, contato, mapa) | `src/data/property.js` |
| Mídias: origem, licença, clipes e quadros | `tools/media.json` → `src/data/media.js` (gerado) |
| Desenho da fachada: linhas, rótulos, volumes e recortes de material | `tools/facade-trace.py` → `src/data/facade.js` (gerado) |
| Vídeo controlado pela rolagem (baixa o arquivo inteiro e busca um quadro por vez) | `src/cinema/clip.js` |
| Prancha da fachada (folha → tela cheia, desenho → volumes → materiais → vídeo) | `src/cinema/plate.js` |
| Linha do tempo de cada seção fixada, transições entre ambientes | `src/main.js` |
| HTML gerado dos dados no build | `src/ui/render.js` + `vite.config.js` |

- **Três seções fixadas** controlam o palco: `#abertura` (voo do drone), `#obra` (revelação da fachada) e `#casa` (oito ambientes). Rolar para trás desfaz tudo; recarregar com âncora (`#ficha`) reconstrói o estado certo.
- **Vídeos:** H.264 com GOP de 12 quadros e sem quadros B, para a busca ser rápida nos dois sentidos. Cada arquivo é baixado inteiro (fila de dois por vez, na ordem da página) e só então controlado pela rolagem; até lá aparece o pôster. Telas em pé recebem um recorte vertical (720x1280) no ponto focal de cada cena.
- **Fachada:** o desenho foi traçado sobre o último quadro do vídeo da fachada; quando a casa ocupa a tela, o vídeo entra exatamente nesse quadro e recua, mostrando a paralaxe real das palmeiras. Depois a câmera se aproxima da porta, que se abre no vídeo seguinte.
- **Economia de dados, rede 2G, `?stills` ou movimento reduzido:** nenhum vídeo é baixado; a revelação da fachada continua e os ambientes usam os quadros fixos.
- Medido em `tools/perf.mjs`: 60 fps na rolagem rápida e atraso de vídeo abaixo de um quadro (p95) no desktop.

## Trocar de imóvel

1. Edite `tools/media.json` com os clipes (`range`, `focalX`) e os quadros da galeria (`t`) e rode `npm run media` (precisa de Python e do pacote `imageio-ffmpeg`, ou de `FFMPEG` apontando para um ffmpeg). Os arquivos de origem ficam em `.media-cache/`.
2. Retrace a fachada em `tools/facade-trace.py` sobre o novo quadro (`python tools/facade-trace.py --preview prancha.png conferencia.jpg --fills` desenha as linhas sobre a foto para conferir).
3. Atualize `src/data/property.js`. Para um imóvel autorizado, troque `demo` e `illustrative` para `false` nos dados confirmados; preencha `location.lat/lng` (o mapa só aparece com coordenadas exatas) e `contact.whatsapp`/`contact.email` (sem eles o formulário funciona em modo demonstração).

## Mídias e licenças

- Vídeos e quadros: [Alef Morais](https://www.pexels.com/@alef-morais-336305364/) no Pexels, sob a [Licença Pexels](https://www.pexels.com/license/): uso gratuito, inclusive comercial, com edição permitida e sem atribuição obrigatória (o site credita mesmo assim). A licença não permite sugerir endosso de pessoas ou marcas, revender cópias sem alteração nem redistribuir as mídias em bancos de imagem. Cada clipe tem o link da página original em `tools/media.json` e no rodapé do site.
- Todas as mídias pertencem a um único lote de filmagem (IDs 39576501 a 39576534); um teste garante que nenhuma imagem de outra casa entre no site.
- Desenho, volumes e revelação dos materiais foram feitos para esta página e não representam etapas reais de obra nem o projeto original.
- Fontes Fraunces e Figtree (SIL OFL) via Fontsource.
