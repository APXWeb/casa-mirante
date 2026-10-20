import * as THREE from 'three'

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const range = (p, a, b) => clamp01((p - a) / (b - a))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => t * t * (3 - 2 * t)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutBack = (t) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// Pseudo-aleatório determinístico (mesma cena em todo carregamento e em toda captura).
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Caixa com UVs proporcionais ao tamanho real: a textura mantém a escala
// (metros por repetição = texScale) em peças longas e curtas.
export function boxGeometry(w, h, d, texScale = 2) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const faces = [
    [d, h], [d, h], // +x, -x
    [w, d], [w, d], // +y, -y
    [w, h], [w, h], // +z, -z
  ]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f]
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * su) / texScale, (uv.getY(k) * sv) / texScale)
    }
  }
  return g
}

export function planeGeometryXZ(w, d, texScale = 2) {
  const g = new THREE.PlaneGeometry(w, d)
  g.rotateX(-Math.PI / 2)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / texScale, (uv.getY(i) * d) / texScale)
  return g
}
