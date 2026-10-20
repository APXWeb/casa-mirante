import Lenis from 'lenis'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/figtree'
import './styles/main.css'
import { initGallery } from './ui/gallery.js'
import { initContact } from './ui/contact.js'
import { initPlanTabs, initCounters, initReveal } from './ui/sections.js'
import { stages } from './data/property.js'

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const range = (p, a, b) => clamp01((p - a) / (b - a))
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------- rolagem ----------------
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
const scrollY = () => (lenis ? lenis.scroll : window.scrollY)

let pinsEnd = Infinity
const pins = Object.fromEntries($$('[data-pin]').map((el) => [el.dataset.pin, { el, top: 0, len: 1 }]))
function measure() {
  const vh = innerHeight
  for (const p of Object.values(pins)) {
    p.top = p.el.offsetTop
    p.len = Math.max(1, p.el.offsetHeight - vh)
  }
  pinsEnd = pins.casa.top + pins.casa.el.offsetHeight
}
const progress = (name) => clamp01((scrollY() - pins[name].top) / pins[name].len)

// ---------------- elementos de interface ----------------
const ui = {
  heroCopy: $('[data-hero-copy]'),
  cue: $('[data-hero-cue]'),
  scanNote: $('[data-scan-note]'),
  stageCaps: $$('.stage-cap'),
  ticks: $$('[data-tick]'),
  bar: $('[data-bar]'),
  pct: $('[data-pct]'),
  meter: $('[data-meter]'),
  sceneCaps: $$('.scene-cap'),
  top: $('[data-top]'),
  stage: $('[data-stage]'),
  canvas: $('[data-gl]'),
  poster: $('[data-poster]'),
  fallback: $('[data-fallback]'),
  notes: $('[data-notes]'),
  loader: $('[data-loader]'),
  loaderBar: $('[data-loader-bar]'),
}

// Etapa visível conforme P (mesmos limites da obra em src/three/house.js)
const STAGE_AT = [0, 0.16, 0.345, 0.585, 0.8]
const stageIndex = (P) => STAGE_AT.reduce((acc, a, i) => (P >= a - 0.02 ? i : acc), 0)

function setCaption(list, active, fade) {
  list.forEach((el, i) => {
    const on = i === active
    el.style.opacity = on ? fade : 0
    el.style.transform = `translateY(${on ? (1 - fade) * 14 : 14}px)`
    el.classList.toggle('is-on', on)
  })
}

let world = null
let lastStage = -1
function updateUI(view, P) {
  const { hero, obra, casa } = view
  // abertura
  const heroFade = 1 - range(hero, 0.12, 0.38)
  ui.heroCopy.style.opacity = heroFade
  ui.heroCopy.style.transform = `translateY(${(1 - heroFade) * -30}px)`
  ui.cue.style.opacity = 1 - range(hero, 0.02, 0.12)
  const note = range(hero, 0.42, 0.6) * (1 - range(hero, 0.86, 0.98))
  ui.scanNote.style.opacity = note

  // obra
  const si = stageIndex(P)
  const local = P - STAGE_AT[si]
  const next = STAGE_AT[si + 1] ?? 1.02
  const fade = obra <= 0 ? 0 : Math.min(range(local, 0, 0.035), 1 - range(P, next - 0.045, next - 0.012))
  setCaption(ui.stageCaps, obra > 0 && obra < 1 ? si : -1, fade)
  ui.meter.style.opacity = obra > 0 && obra < 0.995 ? 1 : 0
  ui.bar.style.transform = `scaleX(${P})`
  ui.pct.textContent = Math.round(P * 100)
  if (si !== lastStage) {
    ui.ticks.forEach((t, i) => t.classList.toggle('is-on', i <= si))
    lastStage = si
    document.documentElement.dataset.stage = stages[si].id
  }

  // apresentação
  const n = ui.sceneCaps.length
  if (casa > 0.1 && casa < 1) {
    const u = Math.min(n - 0.0001, range(casa, 0.1, 1) * n)
    const i = Math.floor(u)
    const f = u - i
    const fd = Math.min(range(f, 0.04, 0.16), i === n - 1 ? 1 : 1 - range(f, 0.44, 0.54))
    setCaption(ui.sceneCaps, i, fd)
  } else setCaption(ui.sceneCaps, -1, 0)

  // cabeçalho: sólido sobre o conteúdo
  const past = scrollY() > pinsEnd - innerHeight * 0.5
  ui.top.classList.toggle('is-solid', past)
  ui.stage.classList.toggle('is-off', scrollY() > pinsEnd + 10)
}

// Anotações técnicas do blueprint (projetadas da cena 3D).
const NOTES = [
  { t: 'Balanço 5,00 m', p: [14.5, 3.6, 6.1], r: [0.0, 0.62] },
  { t: '29,00 m', p: [2.5, 0.1, 6.4], r: [0.0, 0.5] },
  { t: 'Piscina 16,00 x 3,80 m', p: [7, 0.1, 13.9], r: [0.0, 0.34] },
  { t: 'Laje L1 +3,50', p: [-12.2, 3.5, 5.4], r: [0.38, 0.6] },
  { t: 'Cobertura +6,92', p: [-9.2, 6.92, 5.6], r: [0.5, 0.66] },
  { t: 'Pé-direito 3,20 m', p: [12.2, 1.6, 4.4], r: [0.36, 0.56] },
]
let noteEls = []
let V3
function updateNotes(P, active) {
  if (!world || !V3) return
  if (!noteEls.length) {
    noteEls = NOTES.map((n) => {
      const el = document.createElement('span')
      el.className = 'note'
      el.textContent = n.t
      ui.notes.appendChild(el)
      return el
    })
  }
  const cam = world.engine.camera
  const w = ui.canvas.clientWidth
  const h = ui.canvas.clientHeight
  NOTES.forEach((n, i) => {
    const el = noteEls[i]
    const vis = active ? range(P, n.r[0], n.r[0] + 0.03) * (1 - range(P, n.r[1] - 0.04, n.r[1])) : 0
    if (vis <= 0.01) {
      el.style.opacity = 0
      return
    }
    const v = new V3(...n.p).project(cam)
    el.style.opacity = vis
    el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
  })
}

// ---------------- 3D ----------------
let createWorld, detectQuality, THREE
async function startWorld() {
  let ok = false
  try {
    const c = document.createElement('canvas')
    ok = !!c.getContext('webgl2')
  } catch {
    ok = false
  }
  if (!ok || new URLSearchParams(location.search).has('no3d')) return startFallback()
  try {
    ;[{ createWorld }, { detectQuality }, THREE] = await Promise.all([import('./three/world.js'), import('./three/engine.js'), import('three')])
    V3 = THREE.Vector3
    const quality = detectQuality()
    document.documentElement.dataset.quality = quality.tier
    world = await createWorld(ui.canvas, quality, (p) => (ui.loaderBar.style.transform = `scaleX(${p})`))
    world.director.reduced = reduced
    const D = await import('./three/director.js')
    window.__cm = {
      world,
      measure,
      view: currentView,
      renderNow,
      // usado por tools/capture.mjs para renderizar quadros fixos
      still({ P = 1, pos, target, fov = 35, light = 'golden', lightP }) {
        const shot = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target), fov, fit: 0 }
        const L = lightP != null ? D.buildLight(lightP) : D.LIGHTS[light]
        world.director.frozen = { P, shot, light: L }
        world.director.lastP = -1
      },
      shots: D.SHOTS,
    }
    addEventListener('resize', () => world.engine.resize())
    document.documentElement.classList.add('gl-ready')
    ui.loader.classList.add('is-done')
  } catch (err) {
    console.error('3D indisponível, usando imagens', err)
    startFallback()
  }
}

// Sem WebGL: a mesma progressão com quadros renderizados previamente.
const SEQ = 13
let fbFrames = null
function startFallback() {
  document.documentElement.classList.add('no-gl')
  ui.loader.classList.add('is-done')
  const frames = []
  for (let i = 0; i < SEQ; i++) frames.push(`obra-${String(i).padStart(2, '0')}`)
  const scenes = ['cena-residencia', 'cena-piscina', 'cena-sala', 'cena-balanco', 'cena-noite']
  fbFrames = [...frames, ...scenes].map((id) => {
    const img = new Image()
    img.alt = ''
    img.decoding = 'async'
    img.loading = 'lazy'
    img.srcset = `img/seq/${id}-800.webp 800w, img/seq/${id}-1600.webp 1600w`
    img.sizes = '100vw'
    img.src = `img/seq/${id}-1600.webp`
    ui.fallback.appendChild(img)
    return img
  })
}
function updateFallback(view, P) {
  if (!fbFrames) return
  const { hero, obra, casa } = view
  let idx = -1
  let blend = 0
  if (casa > 0) {
    const u = Math.min(4.999, range(casa, 0.1, 1) * 5)
    idx = SEQ + Math.floor(u)
  } else if (obra > 0 || hero > 0.6) {
    const f = P * (SEQ - 1)
    idx = Math.floor(f)
    blend = f - idx
  }
  ui.poster.style.opacity = idx < 0 ? 1 : 0
  fbFrames.forEach((img, i) => {
    let o = 0
    if (i === idx) o = 1
    if (i === idx + 1 && idx < SEQ - 1) o = blend
    img.style.opacity = o
  })
}

// ---------------- laço principal ----------------
function currentView() {
  return { hero: progress('hero'), obra: progress('obra'), casa: progress('casa') }
}
let last = performance.now()
let slow = 0
function renderNow() {
  const view = currentView()
  if (world) {
    world.director.update(view, 0)
    world.engine.render()
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  lenis?.raf(now)
  const view = currentView()
  let P
  if (world) {
    world.director.update(view, dt)
    P = world.director.P
    const visible = scrollY() < pinsEnd + 10
    if (visible && !document.hidden) {
      world.engine.render()
      // qualidade adaptativa: reduz a resolução se o aparelho não acompanhar
      if (dt > 0.034) slow++
      else slow = Math.max(0, slow - 1)
      if (slow > 45) {
        const r = world.engine.renderer
        const pr = Math.max(0.7, r.getPixelRatio() * 0.85)
        if (pr < r.getPixelRatio() - 0.01) {
          r.setPixelRatio(pr)
          world.engine.resize()
        }
        slow = 0
      }
    }
  } else {
    P = range(view.obra, 0.03, 0.97)
    if (view.obra <= 0 && view.casa <= 0) P = 0
    if (view.casa > 0) P = 1
    updateFallback(view, P)
  }
  updateUI(view, P)
  updateNotes(P, world && view.obra > 0 && view.casa <= 0)
  requestAnimationFrame(frame)
}

// ---------------- navegação por âncoras / recarregar ----------------
function goToHash(hash, immediate) {
  const el = hash && document.querySelector(hash)
  if (!el) return
  if (immediate || !lenis) {
    // salto direto (recarregar com âncora): rolagem nativa, o Lenis sincroniza
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: immediate || reduced ? 'auto' : 'smooth' })
    lenis?.resize()
  } else lenis.scrollTo(el, { offset: 0, duration: 1.6 })
}

measure()
addEventListener('resize', measure)
new ResizeObserver(measure).observe(document.body)
if (location.hash) {
  requestAnimationFrame(() => goToHash(location.hash, true))
  addEventListener('load', () => goToHash(location.hash, true), { once: true })
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]')
  if (!a || a.getAttribute('href') === '#') return
  e.preventDefault()
  history.replaceState(null, '', a.getAttribute('href'))
  goToHash(a.getAttribute('href'), false)
  if (a.classList.contains('skip')) document.querySelector(a.getAttribute('href'))?.focus?.({ preventScroll: true })
})

initGallery()
initContact()
initPlanTabs()
initCounters(reduced)
initReveal(reduced)
requestAnimationFrame(frame)
startWorld()
