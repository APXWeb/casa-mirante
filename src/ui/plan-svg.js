// Planta baixa em SVG gerada do mesmo modelo usado no 3D (src/data/house.js).
import { ROOMS, VOLUMES, POOL, TERRACE, STAIR, houseAreas } from '../data/house.js'

const S = 22 // px por metro
const PAD = 2.2 // m de margem

function num(n) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function planSVG(level) {
  const areas = houseAreas().rooms
  const isGround = level === 'ground'
  const x0 = -12 - PAD
  const x1 = 17 + PAD
  const z0 = -5.5 - PAD
  const z1 = (isGround ? POOL.z1 + 0.6 : 5.4) + PAD
  const W = (x1 - x0) * S
  const H = (z1 - z0) * S
  const X = (x) => ((x - x0) * S).toFixed(1)
  const Z = (z) => ((z - z0) * S).toFixed(1)
  const rect = (r, cls) => `<rect class="${cls}" x="${X(r.x0)}" y="${Z(r.z0)}" width="${((r.x1 - r.x0) * S).toFixed(1)}" height="${((r.z1 - r.z0) * S).toFixed(1)}"/>`
  const label = (r, area) => {
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    const small = r.x1 - r.x0 < 4.5 || r.z1 - r.z0 < 2.4
    return `<text class="pl-label${small ? ' is-small' : ''}" x="${X(cx)}" y="${Z(cz)}">${r.label}</text>
      <text class="pl-area${small ? ' is-small' : ''}" x="${X(cx)}" y="${(Z(cz) * 1 + (small ? 12 : 16)).toFixed(1)}">${num(area)} m²</text>`
  }

  const parts = []
  if (isGround) {
    parts.push(rect({ x0: -12, x1: 18.5, z0: 4.0, z1: POOL.z1 + 1.2 }, 'pl-deck'))
    parts.push(rect(TERRACE, 'pl-deck'))
    parts.push(rect(POOL, 'pl-pool'))
    parts.push(`<text class="pl-label is-pool" x="${X((POOL.x0 + POOL.x1) / 2)}" y="${Z((POOL.z0 + POOL.z1) / 2) * 1 + 4}">Piscina · 16 x 3,8 m</text>`)
    parts.push(label({ ...TERRACE, label: 'Varanda coberta' }, (TERRACE.x1 - TERRACE.x0) * (TERRACE.z1 - TERRACE.z0)))
    // projeção do pavimento superior (tracejado)
    parts.push(rect(VOLUMES.upper, 'pl-proj'))
  }
  const list = isGround ? areas.ground : areas.upper
  for (const r of list) parts.push(rect(r, 'pl-room'))
  parts.push(rect(isGround ? VOLUMES.ground : VOLUMES.upper, 'pl-wall'))
  if (isGround) {
    // vidro piso-teto
    parts.push(`<line class="pl-glass" x1="${X(-2)}" y1="${Z(4)}" x2="${X(12)}" y2="${Z(4)}"/>`)
    parts.push(`<line class="pl-glass" x1="${X(12)}" y1="${Z(-5.3)}" x2="${X(12)}" y2="${Z(4)}"/>`)
  } else {
    parts.push(`<line class="pl-glass" x1="${X(-8.8)}" y1="${Z(4.25)}" x2="${X(16.8)}" y2="${Z(4.25)}"/>`)
    parts.push(`<line class="pl-brise" x1="${X(-9)}" y1="${Z(5.15)}" x2="${X(17)}" y2="${Z(5.15)}"/>`)
  }
  // escada
  const steps = []
  for (let i = 0; i <= STAIR.steps; i += 2) {
    const x = STAIR.x0 + (i * (STAIR.x1 - STAIR.x0)) / STAIR.steps
    steps.push(`<line class="pl-step" x1="${X(x)}" y1="${Z(-5.25)}" x2="${X(x)}" y2="${Z(-4.1)}"/>`)
  }
  parts.push(...steps)
  for (const r of list) if (!['circulacao'].includes(r.id)) parts.push(label(r, r.area))

  // escala gráfica
  const sx = X(x0 + 0.8) * 1
  const sy = H - 14
  parts.push(`<g class="pl-scale"><line x1="${sx}" y1="${sy}" x2="${sx + 5 * S}" y2="${sy}"/><line x1="${sx}" y1="${sy - 4}" x2="${sx}" y2="${sy + 4}"/><line x1="${sx + 5 * S}" y1="${sy - 4}" x2="${sx + 5 * S}" y2="${sy + 4}"/><text x="${sx + 5 * S + 8}" y="${sy + 4}">5 m</text></g>`)

  const title = isGround ? 'Planta do pavimento térreo' : 'Planta do pavimento superior'
  return `<svg class="plan-svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${title}"><title>${title}</title>${parts.join('')}</svg>`
}
