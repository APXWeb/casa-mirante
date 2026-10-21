// Gera o HTML estático das seções a partir de src/data/*.js.
// Roda no build (plugin do Vite em vite.config.js): a página chega pronta,
// legível e indexável mesmo antes do JavaScript.
import { property as P, stages, scenes, gallery, fmt, fmtPrice } from '../data/property.js'
import { facade as F } from '../data/facade.js'
import { media as M } from '../data/media.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const pad2 = (n) => String(n).padStart(2, '0')

// pôster de um clipe: horizontal ou vertical conforme a tela; `end` usa o último quadro
const poster = (id, end, cls = 'poster', eager = false) => {
  const k = end ? 'b' : 'a'
  return `<picture class="${cls}" data-poster="${id}">
      <source media="(orientation: portrait) and (max-aspect-ratio: 25/27)" srcset="img/poster/${id}-m-${k}.webp">
      <img src="img/poster/${id}-d-${k}.webp" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    </picture>`
}
const video = (id, cls = '') => `<video class="${cls}" data-clip="${id}" muted playsinline preload="none" disablepictureinpicture></video>`

const still = (g, sizes, eager = false) => {
  const [w, h] = g.portrait ? [900, 1600] : [1600, 900]
  return `<img src="img/${g.id}-1600.webp" srcset="img/${g.id}-800.webp ${w / 2}w, img/${g.id}-1600.webp ${w}w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(g.alt)}" ${eager ? '' : 'loading="lazy"'} decoding="async">`
}

const illus = '<span class="tag-illus" title="Dado ilustrativo, criado para esta apresentação">ilustrativo</span>'

function addressLine() {
  const a = P.address
  return a.street ? `${a.street} · ${a.region}` : a.region
}

const svgOpen = (cls) => `<svg class="${cls}" viewBox="0 0 ${F.w} ${F.h}" width="${F.w}" height="${F.h}" aria-hidden="true" focusable="false">`

export const sections = {
  heroMeta: () => `${esc(P.address.region)}${P.demo ? ' <span class="dot"></span> Apresentação demonstrativa' : ''}`,

  heroLayer: () => `${poster('drone', false, 'poster', true)}${video('drone')}`,

  // prancha da fachada: volumes vetoriais, recortes de material, vídeo e desenho
  plate: () => {
    const fills = F.fills.map((f, i) => `<path class="fill ${f.cls}" data-fill="${i}" d="${f.d}"/>`).join('')
    const det = (k, cls, fill) => `<g class="det ${cls}" data-det="${fill}">${F.details[k].map((d) => `<path d="${d}"/>`).join('')}</g>`
    const details = [det('slats', 'd-wood', 9), det('grooves', 'd-wood', 3), det('hatch', 'd-stone', 2), det('refl', 'd-glass', 4)].join('')
    const mats = F.materials.map((m) => `<img class="mat" data-mat="${m.id}" data-from="${m.from}" src="img/plate-3200.webp" alt="" style="clip-path: path('${m.d}')">`).join('')
    const groups = F.groups.map((g) => `<g class="ln" data-group="${g.id}">${g.paths.map((d) => `<path d="${d}" pathLength="1"/>`).join('')}</g>`).join('')
    const leaders = F.labels
      .map((l, i) => (l.inline || l.level ? '' : `<path class="leader" data-leader="${i}" d="M${l.x} ${l.y} L${l.x + l.dx} ${l.y + l.dy}" pathLength="1"/><circle class="anchor" data-anchor="${i}" cx="${l.x}" cy="${l.y}" r="4"/>`))
      .join('')
    return `<div class="plate" data-plate>
        ${svgOpen('fills')}${fills}${details}</svg>
        ${mats}
        <img class="env" data-env src="img/plate-3200.webp" alt="">
        ${video('fachada', 'plate-video')}
        ${svgOpen('lines')}${groups}<g class="leaders">${leaders}</g></svg>
      </div>`
  },

  plateLabels: () =>
    F.labels
      .map((l, i) => `<span class="pl${l.level ? ' is-level' : ''}${l.inline ? ' is-inline' : ''}${l.dy > 0 ? ' is-below' : ''}" data-label="${i}" data-group="${l.g}">${esc(l.t)}</span>`)
      .join(''),

  sceneLayers: () =>
    scenes
      .map((s, i) => `<div class="scene" data-scene="${i}">${poster(s.clip)}${video(s.clip)}</div>`)
      .join(''),

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

  matChips: () => [...F.materials.map((m) => m.label), 'Paisagismo'].map((t, i) => `<li data-matchip="${i}">${esc(t)}</li>`).join(''),

  scenes: () =>
    scenes
      .map(
        (s, i) => `<li class="scene-cap" data-scene="${i}">
        <p class="eyebrow"><span>${pad2(i + 1)}</span> / ${pad2(scenes.length)}</p>
        <h2 class="scene-title">${esc(s.title)}</h2>
        <p class="scene-text">${esc(s.text)}</p>
      </li>`,
      )
      .join(''),

  manifestoMedia: () => `${poster('lagoa')}${video('lagoa', 'loop')}`,

  ficha: () => {
    const facts = P.facts
      .map((f) => `<li><span class="f-v">${fmt(f.v)}${f.u ? `<small>${f.u}</small>` : ''}</span><span class="f-k">${esc(f.k)}${f.note ? ` <span class="f-note">${esc(f.note)}</span>` : ''}</span>${f.illustrative ? illus : '<span class="tag-obs">nas imagens</span>'}</li>`)
      .join('')
    const desc = P.description.map((p) => `<p>${esc(p)}</p>`).join('')
    const feats = P.features
      .map((g) => `<div class="feat"><h4>${esc(g.group)}</h4><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`)
      .join('')
    const add = P.additional
      .map((a) => {
        const v = a.value == null ? `<span class="pend">${esc(a.note || 'Não informado')}</span>` : esc(a.value)
        return `<div class="add-row${a.value == null ? ' is-pending' : ''}"><dt>${esc(a.label)}</dt><dd>${v}</dd></div>`
      })
      .join('')
    return `
      <header class="ficha-head">
        <div class="ficha-id">
          <p class="eyebrow"><span class="pill">${esc(P.status)}</span><span class="ref">Ref. ${esc(P.reference)}</span></p>
          <h2 class="ficha-name">${esc(P.name)}</h2>
          <p class="ficha-addr">${esc(addressLine())} <span class="muted">· ${esc(P.address.placeholder)}</span></p>
          <p class="ficha-note muted small">${esc(P.nameNote)}. ${esc(P.address.regionSource)}.</p>
        </div>
        <div class="ficha-price">
          <span class="price-k">Valor de venda</span>
          <strong class="price-v">${fmtPrice(P.price)}</strong>
          <span class="price-note">${P.price.illustrative ? illus : ''} ${esc(P.price.note)}</span>
        </div>
      </header>
      <ul class="facts">${facts}</ul>
      <div class="ficha-body">
        <div class="ficha-desc"><h3 class="sub">Sobre a casa</h3>${desc}<p class="disclaimer">${esc(P.disclaimer)}</p></div>
        <aside class="ficha-add"><h3 class="sub">Informações adicionais</h3><dl>${add}</dl></aside>
      </div>
      <div class="feats"><h3 class="sub">Características vistas nas imagens</h3><div class="feat-grid">${feats}</div>
        <p class="pending-note">Não confirmado pelas imagens: ${P.pendingFeatures.map(esc).join(', ')}.</p>
      </div>
      <div class="ficha-actions">
        <a class="btn btn-dark" href="#galeria">Ver as ${gallery.length} imagens</a>
        <a class="btn btn-line" href="#contato">Agendar visita</a>
      </div>`
  },

  galleryFilters: () => {
    const groups = [...new Set(gallery.map((g) => g.group))]
    return ['Todas', ...groups]
      .map((g, i) => `<button type="button" class="chip${i === 0 ? ' is-on' : ''}" data-filter="${i === 0 ? '*' : esc(g)}" aria-pressed="${i === 0}">${esc(g)}</button>`)
      .join('')
  },

  gallery: () =>
    gallery
      .map(
        (g, i) => `<li class="g-item${g.portrait ? ' is-tall' : ''}" data-group="${esc(g.group)}">
        <button type="button" class="g-btn" data-index="${i}" aria-label="Ampliar: ${esc(g.alt)}">
          ${still(g, '(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw')}
          <span class="g-cap" aria-hidden="true"><b>${pad2(i + 1)}</b> ${esc(g.alt)}</span>
        </button>
      </li>`,
      )
      .join(''),

  galleryData: () => JSON.stringify(gallery.map((g) => ({ id: g.id, alt: g.alt, group: g.group, portrait: g.portrait }))),

  location: () => {
    const l = P.location
    if (l.lat != null && l.lng != null) {
      const d = 0.004
      const bbox = [l.lng - d, l.lat - d, l.lng + d, l.lat + d].join(',')
      return `<iframe class="map" title="Mapa com a localização de ${esc(P.name)}" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${l.lat},${l.lng}"></iframe>`
    }
    return `<div class="map-empty">
        <p class="map-k">Localização</p>
        <p class="map-v">${esc(P.address.region)}</p>
        <p class="muted">Entre a orla e uma lagoa, como mostram as imagens aéreas. Endereço e mapa não são exibidos: a casa real não está à venda por este site e as coordenadas exatas não foram publicadas pelo autor das imagens.</p>
      </div>`
  },

  credits: () => {
    const a = M.author
    return `<p>Imagens e vídeos: <a href="${a.profile}" target="_blank" rel="noopener">${esc(a.name)}</a>, publicados no Pexels sob a <a href="${M.license.url}" target="_blank" rel="noopener">${esc(M.license.name)}</a>. ${esc(M.session)}</p>
      <p class="muted">${esc(M.license.summary)}</p>
      <p class="muted">O desenho técnico, o estudo de volumes e a revelação dos materiais foram traçados para esta página sobre o quadro final de um dos vídeos. Não representam etapas reais de obra nem o projeto original.</p>`
  },

  creditList: () =>
    Object.values(M.clips)
      .map((c) => `<li><a href="${c.page}" target="_blank" rel="noopener">${esc(c.alt)}</a></li>`)
      .join(''),

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
    const v = { name: P.name, tagline: P.tagline, region: P.address.region, demo: P.demo ? 'is-demo' : '' }[k]
    return v ?? m
  })
}
