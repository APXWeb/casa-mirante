# Casa Mirante · experiência imobiliária cinematográfica

Site de venda de imóvel em que a **casa é construída enquanto o visitante rola a página**: blueprint → fundação → estrutura → fachada → casa pronta, seguido de uma apresentação cinematográfica, da ficha completa, da galeria, da planta e do contato.

> **Imóvel demonstrativo.** A casa, os números, o valor e as imagens foram criados para esta apresentação e não correspondem a uma propriedade real. O site exibe esse aviso enquanto `property.demo` for `true`.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5280
npm run build      # gera dist/ (base relativa, funciona em qualquer subpasta)
npm run test:e2e   # 12 cenários Playwright em desktop e celular (build + preview)
```

## Como funciona

| Parte | Onde |
| --- | --- |
| Dados do imóvel (preço, áreas, textos, características, contato, mapa) | `src/data/property.js` |
| Modelo arquitetônico (volumes, ambientes, pilares, piscina) | `src/data/house.js` |
| Cena 3D (Three.js): peças da obra, cada uma com sua janela de progresso | `src/three/house.js` (tabela `T`) |
| Luz do "dia de obra", câmeras e cenas da apresentação | `src/three/director.js` |
| Vegetação, terreno e céu procedurais | `src/three/nature.js` |
| Mobiliário | `src/three/interior.js` |
| HTML das seções gerado a partir dos dados (no build) | `src/ui/render.js` + `vite.config.js` |
| Planta baixa em SVG (gerada do mesmo modelo do 3D) | `src/ui/plan-svg.js` |

- A rolagem controla tudo: o progresso de cada seção fixada (`#abertura`, `#obra`, `#casa`) vira estado da cena a cada quadro. Rolar para trás desfaz a obra; recarregar ou abrir um link com âncora (`#ficha`) reconstrói o estado certo.
- As linhas do blueprint pertencem às peças: cada linha some quando a peça correspondente é construída.
- A área construída e a do terreno exibidas na ficha são calculadas do modelo (`houseAreas()`), e um teste confere isso.
- **Sem WebGL** (ou com `?no3d`), a mesma progressão usa 13 quadros renderizados da obra e 5 das cenas (`public/img/seq`).
- **Celular**: mesma cena com perfil mais leve (sombras, vegetação, resolução) e qualidade adaptativa se o aparelho não acompanhar. `?q=low|medium|high` força um perfil.
- **Movimento reduzido**: sem rolagem suave nem deriva de câmera; as trocas de cena viram cortes.

## Cadastrar outro imóvel

1. Edite `src/data/property.js`: nome, preço, endereço, `facts`, `additional`, `description`, `features`, `gallery`.
   Campos `null` não aparecem (ou aparecem como "a informar" em `additional`).
2. Para usar fotos reais, coloque `public/img/<id>-1600.webp` e `<id>-800.webp` e liste os ids em `gallery`/`highlights`.
3. Mapa: preencha `location.lat`/`lng` com as coordenadas **exatas**; sem elas o mapa não é exibido.
4. Contato: preencha `contact.whatsapp` (só dígitos, com DDI) e/ou `contact.email`. Sem eles, o formulário funciona em modo demonstração e não envia nada. Nome do corretor, imobiliária e CRECI também ficam em `contact`.

## Imagens

Todas as imagens do site são renderizadas do próprio modelo 3D:

```bash
npm run dev
npm run capture            # tudo
node tools/capture.mjs http://localhost:5280/ cozinha obra-   # só algumas
```

As câmeras dos stills ficam no topo de `tools/capture.mjs`. `tools/shots.mjs` captura a página em pontos da rolagem para revisão visual.

## Assets e licenças

- Céu HDRI `kloppenheim_06_puresky`, texturas PBR e 5 modelos de mobiliário: [Poly Haven](https://polyhaven.com) (CC0). Baixados e otimizados por `npm run assets` (`tools/fetch-assets.mjs`).
- Fontes Fraunces e Figtree (SIL OFL) via Fontsource.
- Arquitetura, palmeiras, árvores, terreno e o restante do mobiliário são gerados em código.
