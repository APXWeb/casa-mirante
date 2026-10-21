// Prancha da fachada (seção #obra): desenho -> volumes -> materiais -> casa.
// Tudo acontece sobre o mesmo quadro real (fim do vídeo 39576524), num palco
// virtual de 1920x1080 que é escalado por transform: primeiro como uma folha
// de desenho, depois ocupando a tela inteira.
import { facade as F } from '../data/facade.js'
import { media } from '../data/media.js'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const range = (p, a, b) => clamp01((p - a) / (b - a))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const mix = (a, b, t) => a + (b - a) * t

// Linha do tempo (fração da rolagem de #obra)
export const T = {
  frame: [0, 0.05],
  groups: { base: [0.04, 0.1], niveis: [0.05, 0.12], volume: [0.08, 0.17], terreo: [0.13, 0.21], aberturas: [0.17, 0.26], escada: [0.21, 0.28] },
  fills: [0.3, 0.47],
  mats: { madeira: [0.5, 0.57], pedra: [0.55, 0.62], vidro: [0.6, 0.67], estrutura: [0.65, 0.72] },
  env: [0.7, 0.82],
  labelsOut: 0.74,
  linesOut: [0.78, 0.86],
  expand: [0.8, 0.93],
  video: [0.915, 0.935],
  dolly: [0.93, 1],
}
export const PLATE_T = media.plateTime // quadro do vídeo igual à prancha
const DOLLY = 2.1 // segundos de vídeo percorridos para trás no fim de #obra
export const DOOR_T = PLATE_T - DOLLY

export class Plate {
  constructor(layer) {
    this.layer = layer
    this.sheet = layer.querySelector('[data-sheet]')
    this.plate = layer.querySelector('[data-plate]')
    this.frame = layer.querySelector('[data-frame]')
    this.lineSvg = layer.querySelector('svg.lines')
    this.groups = Object.fromEntries([...layer.querySelectorAll('.ln')].map((g) => [g.dataset.group, g]))
    this.fills = [...layer.querySelectorAll('[data-fill]')]
    this.dets = [...layer.querySelectorAll('[data-det]')]
    this.mats = Object.fromEntries([...layer.querySelectorAll('[data-mat]')].map((m) => [m.dataset.mat, m]))
    this.env = layer.querySelector('[data-env]')
    this.video = layer.querySelector('.plate-video')
    this.labels = [...layer.querySelectorAll('[data-label]')].map((el) => ({ el, i: el.dataset.label, d: F.labels[Number(el.dataset.label)] }))
    this.leaders = Object.fromEntries([...layer.querySelectorAll('[data-leader]')].map((l) => [l.dataset.leader, l]))
    this.anchors = Object.fromEntries([...layer.querySelectorAll('[data-anchor]')].map((l) => [l.dataset.anchor, l]))
    this.cache = new Map()
    this.clip = null
    this.layout()
  }

  // estilo só quando muda (evita recalcular estilo a cada quadro)
  set(el, prop, value) {
    let m = this.cache.get(el)
    if (!m) this.cache.set(el, (m = {}))
    if (m[prop] === value) return
    m[prop] = value
    if (prop.startsWith('--')) el.style.setProperty(prop, value)
    else el.style[prop] = value
  }

  layout() {
    const vw = innerWidth
    const vh = innerHeight
    const portrait = vh > vw * 1.08
    const cx = F.house.cx
    let x, y, w, h, s0, tx0, ty0
    if (portrait) {
      w = h = Math.min(vw - 32, vh * 0.46)
      x = (vw - w) / 2
      y = Math.max(84, vh * 0.12)
      s0 = h / F.h
      tx0 = x + w / 2 - cx * s0
      ty0 = y
    } else {
      const pad = Math.max(20, Math.min(64, vw * 0.042))
      w = Math.min(vw * (vw < 900 ? 0.6 : 0.56), (vh - (vw < 900 ? 90 : 220)) * (16 / 9))
      h = (w * 9) / 16
      x = vw - pad - w
      y = (vh - h) / 2 + (vw < 900 ? 10 : 0)
      s0 = w / F.w
      tx0 = x
      ty0 = y
    }
    const s1 = Math.max(vw / F.w, vh / F.h)
    const tx1 = Math.min(0, Math.max(vw - F.w * s1, vw / 2 - cx * s1))
    const ty1 = (vh - F.h * s1) / 2
    this.box = { vw, vh, portrait, x, y, w, h, s0, tx0, ty0, s1, tx1, ty1 }
    this.cache.clear()
    this.set(this.frame, 'left', `${x}px`)
    this.set(this.frame, 'top', `${y}px`)
    this.set(this.frame, 'width', `${w}px`)
    this.set(this.frame, 'height', `${h}px`)
    this.layer.classList.toggle('is-portrait', portrait)
    // a legenda das etapas fica logo abaixo da folha nas telas em pé
    document.documentElement.style.setProperty('--sheet-b', `${Math.round(y + h)}px`)
  }

  attach(clip) {
    this.clip = clip
    // vídeo vertical (celular): recorte de 9:16 posicionado no palco de 1920x1080
    if (clip.kind === 'm') {
      const cw = (F.h * 9) / 16
      const x0 = Math.max(0, Math.min(F.w - cw, F.w * clip.meta.focalX - cw / 2))
      this.video.style.left = `${x0}px`
      this.video.style.width = `${cw}px`
    }
  }

  // o: progresso de #obra; z: aproximação da porta no início de #casa
  update(o, z = 0) {
    const B = this.box
    const e = ease(range(o, ...T.expand))
    // escala/posição do palco: folha (contain) -> tela cheia (cover), em escala logarítmica
    let s = B.s0 * Math.pow(B.s1 / B.s0, e)
    let tx = mix(B.tx0, B.tx1, e)
    let ty = mix(B.ty0, B.ty1, e)
    if (z > 0) {
      // aproxima a câmera da porta e a traz para o centro da tela
      const k = 1 + 1.9 * ease(z)
      const px = tx + F.door.x * s
      const py = ty + F.door.y * s
      const qx = mix(px, B.vw / 2, ease(z))
      const qy = mix(py, B.vh / 2, ease(z))
      s *= k
      tx = qx - F.door.x * s
      ty = qy - F.door.y * s
    }
    this.s = s
    this.tx = tx
    this.ty = ty
    this.set(this.plate, 'transform', `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(5)})`)
    this.set(this.plate, '--px', (1 / s).toFixed(4))
    const r = 1 - e
    const ins = `inset(${(B.y * r).toFixed(1)}px ${((B.vw - B.x - B.w) * r).toFixed(1)}px ${((B.vh - B.y - B.h) * r).toFixed(1)}px ${(B.x * r).toFixed(1)}px round ${(4 * r).toFixed(1)}px)`
    this.set(this.sheet, 'clipPath', ins)

    // moldura e carimbo da folha
    const fr = easeOut(range(o, ...T.frame)) * (1 - range(o, 0.8, 0.86))
    this.set(this.frame, 'opacity', fr.toFixed(3))

    // 1. desenho
    for (const [id, g] of Object.entries(this.groups)) {
      const p = easeOut(range(o, ...T.groups[id]))
      this.set(g, 'strokeDashoffset', (1 - p).toFixed(4))
    }
    const lo = 1 - range(o, ...T.linesOut)
    this.set(this.lineSvg, 'opacity', lo.toFixed(3))

    // 2. volumes
    const [fa, fb] = T.fills
    const step = (fb - fa) / this.fills.length
    this.fills.forEach((f, i) => {
      const p = easeOut(range(o, fa + i * step, fa + i * step + 0.045))
      this.set(f, 'opacity', p.toFixed(3))
    })
    this.dets.forEach((d) => {
      const i = Number(d.dataset.det)
      const p = easeOut(range(o, fa + i * step + 0.02, fa + i * step + 0.07))
      this.set(d, 'opacity', p.toFixed(3))
    })

    // 3. materiais (recortes da fotografia) e entorno
    for (const [id, m] of Object.entries(this.mats)) {
      const p = ease(range(o, ...T.mats[id]))
      this.set(m, '--m', p.toFixed(4))
      this.set(m, 'visibility', p > 0 ? 'visible' : 'hidden')
    }
    const env = ease(range(o, ...T.env))
    this.set(this.env, '--r', env.toFixed(4))
    this.set(this.env, 'visibility', env > 0 ? 'visible' : 'hidden')

    // 4. vídeo real: entra sobre o mesmo quadro e recua um pouco (paralaxe das palmeiras)
    const clip = this.clip
    if (clip) {
      const vis = clip.ready && o >= T.video[0]
      this.set(this.video, 'opacity', vis ? range(o, ...T.video).toFixed(3) : '0')
      if (z > 0) clip.setTime(DOOR_T + DOLLY * ease(range(z, 0, 0.85)))
      else clip.setTime(PLATE_T - DOLLY * ease(range(o, ...T.dolly)))
      if (vis) clip.update()
    }

    // rótulos (tela), só com a folha grande o bastante
    const showLabels = B.w >= 620 && o < T.labelsOut + 0.03
    for (const { el, i, d } of this.labels) {
      const g = T.groups[d.g]
      const p = showLabels ? range(o, g[1] - 0.01, g[1] + 0.02) * (1 - range(o, T.labelsOut, T.labelsOut + 0.03)) : 0
      this.set(el, 'opacity', p.toFixed(3))
      if (p > 0) {
        const X = d.inline || d.level ? d.x : d.x + d.dx
        const Y = d.inline || d.level ? d.y : d.y + d.dy
        this.set(el, 'transform', `translate3d(${(tx + X * s).toFixed(1)}px, ${(ty + Y * s).toFixed(1)}px, 0)`)
      }
      if (this.leaders[i]) {
        this.set(this.leaders[i], 'strokeDashoffset', (1 - p).toFixed(3))
        this.set(this.anchors[i], 'opacity', p.toFixed(3))
      }
    }
  }
}
