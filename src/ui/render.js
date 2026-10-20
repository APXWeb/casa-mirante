// Gera o HTML estático das seções a partir de src/data/property.js.
// Roda no build (plugin do Vite em vite.config.js): a página chega pronta,
// legível e indexável mesmo antes do JavaScript.
import { property as P, stages, scenes, highlights, gallery, fmt, fmtPrice } from '../data/property.js'
import { planSVG } from './plan-svg.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const img = (id, alt, cls = '', sizes = '100vw', eager = false) =>
  `<img class="${cls}" src="img/${id}-1600.webp" srcset="img/${id}-800.webp 800w, img/${id}-1600.webp 1600w" sizes="${sizes}" width="1600" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`

function addressLine() {
  const a = P.address
  const parts = [a.street && `${a.street}${a.number ? `, ${a.number}` : ''}`, a.neighborhood, a.city && `${a.city}${a.state ? ` · ${a.state}` : ''}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : a.placeholder
}

const F = P.facts
const factList = [
  { k: 'Terreno', v: F.lotArea, u: 'm²' },
  { k: 'Área construída', v: F.builtArea, u: 'm²' },
  { k: 'Quartos', v: F.bedrooms },
  { k: 'Suítes', v: F.suites },
  { k: 'Banheiros', v: F.bathrooms },
  { k: 'Vagas', v: F.parking },
].filter((f) => f.v != null)

export const sections = {
  heroMeta: () => `${P.demo ? 'Imóvel demonstrativo · ' : ''}${F.suites} suítes · ${fmt(F.builtArea)} m²`,

  stages: () =>
    stages
      .map(
        (s, i) => `<li class="stage-cap" data-stage="${i}">
        <p class="eyebrow"><span>${s.n}</span> ${esc(s.kicker)}</p>
        <h2 class="stage-title">${esc(s.title)}</h2>
        <p class="stage-text">${esc(s.text)}</p>
      </li>`,
      )
      .join(''),

  stageTicks: () => stages.map((s, i) => `<li data-tick="${i}"><span>${s.n}</span>${esc(s.kicker)}</li>`).join(''),

  scenes: () =>
    scenes
      .map(
        (s, i) => `<li class="scene-cap" data-scene="${i}">
        <p class="eyebrow"><span>${String(i + 1).padStart(2, '0')}</span> / ${String(scenes.length).padStart(2, '0')}</p>
        <h2 class="scene-title">${esc(s.title)}</h2>
        <p class="scene-text">${esc(s.text)}</p>
      </li>`,
      )
      .join(''),

  numbers: () => {
    const items = [
      { v: F.builtArea, u: 'm²', k: 'de área construída' },
      { v: F.lotArea, u: 'm²', k: 'de terreno' },
      { v: F.suites, u: '', k: 'suítes' },
      { v: 5, u: 'm', k: 'de balanço sem pilares' },
      { v: 16, u: 'm', k: 'de piscina com borda infinita' },
    ]
    return items
      .map((n) => `<li><strong class="count" data-count="${n.v}">${fmt(n.v)}</strong><span class="unit">${n.u}</span><span class="k">${esc(n.k)}</span></li>`)
      .join('')
  },

  highlights: () =>
    highlights
      .map(
        (h, i) => `<article class="hl${i % 2 ? ' is-alt' : ''}">
        <figure class="hl-media">${img(h.image, h.title, '', '(min-width: 900px) 62vw, 100vw')}</figure>
        <div class="hl-copy">
          <span class="hl-n">${h.n}</span>
          <h3>${esc(h.title)}</h3>
          <p>${esc(h.text)}</p>
        </div>
      </article>`,
      )
      .join(''),

  ficha: () => {
    const status = P.status ? `<span class="pill">${esc(P.status)}</span>` : ''
    const ref = P.reference ? `<span class="ref">Ref. ${esc(P.reference)}</span>` : ''
    const facts = factList
      .map((f) => `<li><span class="f-v">${fmt(f.v)}${f.u ? `<small>${f.u}</small>` : ''}</span><span class="f-k">${f.k}</span></li>`)
      .join('')
    const desc = P.description.map((p) => `<p>${esc(p)}</p>`).join('')
    const feats = P.features
      .map((g) => `<div class="feat"><h4>${esc(g.group)}</h4><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`)
      .join('')
    const add = P.additional
      .map((a) => `<div class="add-row${a.value == null ? ' is-pending' : ''}"><dt>${esc(a.label)}</dt><dd>${a.value == null ? 'A informar' : esc(a.value)}</dd></div>`)
      .join('')
    const pending = P.pendingFeatures?.length
      ? `<p class="pending-note">Itens a confirmar no imóvel real: ${P.pendingFeatures.map(esc).join(', ')}.</p>`
      : ''
    return `
      <header class="ficha-head">
        <div class="ficha-id">
          <p class="eyebrow">${status}${ref}</p>
          <h2 class="ficha-name">${esc(P.name)}</h2>
          <p class="ficha-addr">${esc(addressLine())}</p>
        </div>
        <div class="ficha-price">
          <span class="price-k">Valor de venda</span>
          <strong class="price-v">${fmtPrice(P.price)}</strong>
          ${P.price.note ? `<span class="price-note">${esc(P.price.note)}</span>` : ''}
        </div>
      </header>
      <ul class="facts">${facts}</ul>
      <div class="ficha-body">
        <div class="ficha-desc"><h3 class="sub">Sobre a casa</h3>${desc}</div>
        <aside class="ficha-add"><h3 class="sub">Informações adicionais</h3><dl>${add}</dl></aside>
      </div>
      <div class="feats"><h3 class="sub">Características</h3><div class="feat-grid">${feats}</div>${pending}</div>`
  },

  galleryFilters: () => {
    const groups = [...new Set(gallery.map((g) => g.group))]
    return ['Todas', ...groups].map((g, i) => `<button type="button" class="chip${i === 0 ? ' is-on' : ''}" data-filter="${i === 0 ? '*' : esc(g)}" aria-pressed="${i === 0}">${esc(g)}</button>`).join('')
  },

  gallery: () =>
    gallery
      .map(
        (g, i) => `<li class="g-item" data-group="${esc(g.group)}">
        <button type="button" class="g-btn" data-index="${i}" aria-label="Ampliar: ${esc(g.alt)}">
          ${img(g.id, g.alt, '', '(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw')}
        </button>
      </li>`,
      )
      .join(''),

  galleryData: () => JSON.stringify(gallery.map((g) => ({ id: g.id, alt: g.alt, group: g.group }))),

  planGround: () => planSVG('ground'),
  planUpper: () => planSVG('upper'),

  location: () => {
    const l = P.location
    if (l.lat != null && l.lng != null) {
      const d = 0.004
      const bbox = [l.lng - d, l.lat - d, l.lng + d, l.lat + d].join(',')
      return `<iframe class="map" title="Mapa com a localização de ${esc(P.name)}" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${l.lat},${l.lng}"></iframe>
        <a class="link" href="https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=${l.zoom}/${l.lat}/${l.lng}" target="_blank" rel="noopener">Abrir mapa ampliado</a>`
    }
    return `<div class="map-empty"><p class="map-k">Localização</p><p>${esc(addressLine())}.</p><p class="muted">O mapa aparece aqui assim que as coordenadas exatas do imóvel forem cadastradas.</p></div>`
  },

  contactAgent: () => {
    const c = P.contact
    const who = [c.agentName, c.agency, c.creci && `CRECI ${c.creci}`].filter(Boolean)
    return who.length ? `<p class="agent">${who.map(esc).join(' · ')}</p>` : ''
  },

  contactConfig: () => JSON.stringify({ whatsapp: P.contact.whatsapp, email: P.contact.email, message: P.contact.message, name: P.name, demo: P.demo }),
}

// Substitui <!--@nome--> no index.html pelo HTML gerado.
export function renderPage(html) {
  return html.replace(/<!--@(\w+)-->/g, (m, k) => (sections[k] ? sections[k]() : m)).replace(/@@(\w+)@@/g, (m, k) => {
    const v = { name: P.name, tagline: P.tagline, price: fmtPrice(P.price), demo: P.demo ? 'is-demo' : '' }[k]
    return v ?? m
  })
}
