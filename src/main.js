import Lenis from 'lenis'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/figtree'
import './styles/main.css'
import { initGallery } from './ui/gallery.js'
import { initContact } from './ui/contact.js'
import { initReveal } from './ui/sections.js'
import { stages, scenes } from './data/property.js'
import { Clip, Loader, variant } from './cinema/clip.js'
import { Plate, T as PT } from './cinema/plate.js'

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const range = (p, a, b) => clamp01((p - a) / (b - a))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

const params = new URLSearchParams(location.search)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const conn = navigator.connection
// economia de dados, rede lenta ou ?stills: só quadros fixos, sem baixar vídeos
const stillsOnly = params.has('stills') || reduced || !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')
document.documentElement.classList.toggle('stills', stillsOnly)

// ---------------- rolagem ----------------
const lenis = reduced ? null : new Lenis({ lerp: 0.08, wheelMultiplier: 0.85 })
const scrollY = () => (lenis ? lenis.scroll : window.scrollY)

let pinsEnd = Infinity
const pins = Object.fromEntries($$('[data-pin]').map((el) => [el.dataset.pin, { el, top: 0, len: 1 }]))
function measure() {
  const vh = innerHeight
  for (const p of Object.values(pins)) {
    p.top = p.el.getBoundingClientRect().top + window.scrollY
    p.len = Math.max(1, p.el.offsetHeight - vh)
  }
  pinsEnd = pins.casa.top + pins.casa.el.offsetHeight
}
const progress = (name) => clamp01((scrollY() - pins[name].top) / pins[name].len)

// ---------------- elementos ----------------
const ui = {
  top: $('[data-top]'),
  stage: $('[data-stage]'),
  layers: Object.fromEntries($$('[data-layer]').map((l) => [l.dataset.layer, l])),
  veil: $('[data-veil]'),
  heroCopy: $('[data-hero-copy]'),
  cue: $('[data-hero-cue]'),
  heroLines: $$('[data-hero-line]'),
  veilNote: $('[data-veil-note]'),
  stageCaps: $$('.stage-cap'),
  ticks: $$('[data-tick]'),
  matChips: $$('[data-matchip]'),
  bar: $('[data-bar]'),
  meter: $('[data-meter]'),
  sceneCaps: $$('.scene-cap'),
  sceneLayers: $$('.l-scenes .scene'),
  sceneBar: $('[data-scene-bar]'),
  sceneMeter: $('[data-scene-meter]'),
}

// ---------------- vídeos ----------------
const kind = variant()
const clipOf = (id, scope = document) => {
  const v = $(`video[data-clip="${id}"]`, scope)
  return new Clip(id, v, v.parentElement.querySelector(`[data-poster="${id}"]`), kind)
}
const clips = {
  drone: clipOf('drone', ui.layers.hero),
  fachada: clipOf('fachada', ui.layers.plate),
  scenes: scenes.map((s, i) => clipOf(s.clip, ui.sceneLayers[i])),
}
const plate = new Plate(ui.layers.plate)
plate.attach(clips.fachada)

const loader = new Loader(2)
if (!stillsOnly) {
  loader.add(clips.drone, null, true)
  loader.add(clips.fachada)
  clips.scenes.forEach((c) => loader.add(c))
}

// ---------------- abertura ----------------
function fade(el, v, dy = 0) {
  el.style.opacity = v.toFixed(3)
  el.style.transform = dy ? `translate3d(0, ${dy.toFixed(1)}px, 0)` : ''
}
function updateHero(h) {
  clips.drone.setProgress(range(h, 0, 0.94))
  const a = 1 - range(h, 0.1, 0.26)
  fade(ui.heroCopy, a, (1 - a) * -36)
  ui.cue.style.opacity = (1 - range(h, 0.02, 0.1)).toFixed(3)
  const win = [
    [0.28, 0.5],
    [0.56, 0.78],
  ]
  ui.heroLines.forEach((el, i) => {
    const [s, e] = win[i]
    const v = range(h, s, s + 0.06) * (1 - range(h, e - 0.06, e))
    fade(el, v, (1 - range(h, s, s + 0.08)) * 18)
  })
  const veil = range(h, 0.84, 0.97)
  ui.veil.style.opacity = veil.toFixed(3)
  ui.veilNote.style.opacity = (range(h, 0.86, 0.94) * (1 - range(h, 0.985, 1))).toFixed(3)
}

// ---------------- revelação da fachada ----------------
let lastStage = -1
function updateObra(o, active) {
  const si = stages.reduce((acc, s, i) => (o >= s.at ? i : acc), 0)
  const next = stages[si + 1]?.at ?? 1.05
  const local = o - stages[si].at
  const f = active ? Math.min(range(local, 0, 0.03), 1 - range(o, next - 0.035, next - 0.008)) : 0
  ui.stageCaps.forEach((el, i) => {
    const on = i === si
    el.style.opacity = on ? f.toFixed(3) : '0'
    el.style.transform = `translate3d(0, ${on ? ((1 - f) * 14).toFixed(1) : 14}px, 0)`
    el.classList.toggle('is-on', on && f > 0.5)
  })
  ui.meter.style.opacity = active && o < 0.985 ? '1' : '0'
  ui.bar.style.transform = `scaleX(${o.toFixed(4)})`
  if (si !== lastStage) {
    ui.ticks.forEach((t, i) => t.classList.toggle('is-on', i <= si))
    lastStage = si
    document.documentElement.dataset.stage = stages[si].id
  }
  // material em revelação
  const wins = [...Object.values(PT.mats), PT.env]
  ui.matChips.forEach((c, i) => {
    c.classList.toggle('is-on', o >= wins[i][0])
    c.classList.toggle('is-now', o >= wins[i][0] && o < wins[i][1])
  })
}

// ---------------- ambientes ----------------
const N = scenes.length
const W = 1 / N
const ZOOM_END = 0.05 // fim da aproximação da porta (fração de #casa)
function sceneWindow(k) {
  const start = k * W
  return { start, t0: k === 0 ? 0.035 : start - 0.02, t1: start + W, r0: start - 0.02, r1: start + 0.26 * W }
}
function updateCasa(c, active) {
  ui.sceneLayers.forEach((el, k) => {
    const w = sceneWindow(k)
    let vis, reveal
    if (k === 0) {
      reveal = range(c, 0.03, 0.056)
      vis = active && c < w.t1 + 0.26 * W + 0.01
    } else {
      reveal = ease(range(c, w.r0, w.r1))
      vis = active && c >= w.r0 - 0.01 && c < w.t1 + 0.26 * W + 0.01
    }
    el.classList.toggle('is-on', vis)
    if (!vis) return
    if (k === 0 || reduced) {
      el.style.opacity = (k === 0 ? reveal : range(c, w.r0, w.r0 + 0.04)).toFixed(3)
      el.style.clipPath = ''
    } else {
      const g = (50 * (1 - reveal)).toFixed(2)
      el.style.opacity = '1'
      el.style.clipPath = reveal >= 1 ? '' : `inset(0 ${g}% 0 ${g}%)`
    }
    // a cena seguinte, ao abrir, empurra levemente a anterior
    const nextReveal = k < N - 1 ? ease(range(c, sceneWindow(k + 1).r0, sceneWindow(k + 1).r1)) : 0
    const sc = reduced ? 1 : 1 + 0.1 * (1 - reveal) + 0.04 * nextReveal
    el.style.setProperty('--s', sc.toFixed(4))
    el.style.setProperty('--dim', (0.45 * nextReveal).toFixed(3))
    const clip = clips.scenes[k]
    clip.setProgress(range(c, w.t0, w.t1))
    clip.update()
  })
  // legendas
  ui.sceneCaps.forEach((el, k) => {
    const w = sceneWindow(k)
    const u = range(c, w.start, w.t1)
    const inA = k === 0 ? range(c, 0.05, 0.07) : range(u, 0.12, 0.24)
    const v = active ? Math.min(inA, k === N - 1 ? 1 - range(c, 0.985, 1) : 1 - range(u, 0.84, 0.97)) : 0
    el.style.opacity = v.toFixed(3)
    el.style.transform = `translate3d(0, ${((1 - v) * 16).toFixed(1)}px, 0)`
    el.classList.toggle('is-on', v > 0.5)
  })
  ui.sceneMeter.style.opacity = active && c > 0.05 && c < 0.995 ? '1' : '0'
  ui.sceneBar.style.transform = `scaleX(${range(c, 0.05, 1).toFixed(4)})`
}

// ---------------- laço principal ----------------
let phase = ''
function frame(now) {
  lenis?.raf(now)
  const h = progress('hero')
  const o = progress('obra')
  const c = progress('casa')
  const y = scrollY()

  // camadas visíveis
  const heroOn = o <= 0
  const plateOn = (h > 0.9 || o > 0) && c < ZOOM_END + 0.02
  const scenesOn = c > 0.025
  ui.layers.hero.classList.toggle('is-on', heroOn)
  ui.layers.plate.classList.toggle('is-on', plateOn)
  ui.layers.scenes.classList.toggle('is-on', scenesOn)
  const ph = c > 0.05 ? 'casa' : o >= 0.82 ? 'reveal' : o > 0 || h >= 1 ? 'obra' : 'hero'
  if (ph !== phase) ui.stage.dataset.phase = phase = ph

  if (heroOn) {
    updateHero(h)
    clips.drone.update()
  } else ui.veil.style.opacity = o < 0.02 ? (1 - range(o, 0, 0.02)).toFixed(3) : '0'
  if (plateOn) plate.update(o, reduced ? 0 : range(c, 0, ZOOM_END))
  updateObra(o, o > 0 && c <= 0)
  updateCasa(c, scenesOn)

  ui.top.classList.toggle('is-solid', y > pinsEnd - innerHeight * 0.5)
  ui.stage.classList.toggle('is-off', y > pinsEnd + 10)
  requestAnimationFrame(frame)
}

// ---------------- ambiente final (vídeo em loop) ----------------
function initManifesto() {
  const fig = $('[data-manifesto]')
  if (!fig || stillsOnly) return
  const clip = clipOf('lagoa', fig)
  const v = clip.video
  v.loop = true
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          loader.add(clip).then(() => clip.ready && v.play().catch(() => {}))
          if (clip.ready) v.play().catch(() => {})
        } else if (clip.ready) v.pause()
      }
    },
    { rootMargin: '300px 0px' },
  )
  io.observe(fig)
}

// ---------------- navegação por âncoras / recarregar ----------------
function goToHash(hash, immediate) {
  const el = hash && document.querySelector(hash)
  if (!el) return
  if (immediate || !lenis) {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: immediate || reduced ? 'auto' : 'smooth' })
    lenis?.resize()
  } else lenis.scrollTo(el, { offset: 0, duration: 1.8 })
}

function relayout() {
  measure()
  plate.layout()
}
measure()
addEventListener('resize', relayout)
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

// usado pelos testes e por tools/shots.mjs
window.__cm = { clips, plate, view: () => ({ hero: progress('hero'), obra: progress('obra'), casa: progress('casa') }), stillsOnly, measure }

initGallery()
initContact()
initReveal(reduced)
initManifesto()
document.documentElement.classList.add('cm-ready')
requestAnimationFrame(frame)
