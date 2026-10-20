import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { T } from './house.js'
import { LEVELS } from '../data/house.js'

const rb = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r)

function part(geo, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// Sofá baixo de linhas retas.
function sofa(M, w = 3.2, d = 1.0) {
  const g = new THREE.Group()
  g.add(part(rb(w, 0.22, d, 0.03), M.walnut, 0, 0.11, 0))
  g.add(part(rb(w - 0.1, 0.2, d - 0.15, 0.08), M.fabric, 0, 0.32, 0.05))
  g.add(part(rb(w - 0.1, 0.38, 0.2, 0.08), M.fabric, 0, 0.55, -d / 2 + 0.12))
  for (const s of [-1, 1]) g.add(part(rb(0.18, 0.3, d - 0.05, 0.06), M.fabric, s * (w / 2 - 0.1), 0.45, 0))
  for (let i = 0; i < 3; i++) g.add(part(rb(0.5, 0.42, 0.14, 0.07), i === 1 ? M.fabricDark : M.linen, -0.9 + i * 0.9, 0.58, -d / 2 + 0.3, 0.1))
  return g
}

function bed(M) {
  const g = new THREE.Group()
  g.add(part(rb(2.0, 0.3, 2.1, 0.03), M.walnut, 0, 0.15, 0))
  g.add(part(rb(1.9, 0.24, 2.0, 0.08), M.linen, 0, 0.42, 0.02))
  g.add(part(rb(1.92, 0.08, 1.3, 0.04), M.fabric, 0, 0.56, 0.38))
  g.add(part(rb(2.4, 1.1, 0.08, 0.02), M.walnut, 0, 0.55, -1.08))
  for (const s of [-0.48, 0.48]) g.add(part(rb(0.75, 0.16, 0.4, 0.07), M.linen, s, 0.62, -0.75))
  for (const s of [-1.45, 1.45]) {
    g.add(part(rb(0.5, 0.45, 0.42, 0.02), M.walnut, s, 0.225, -0.8))
    g.add(part(new THREE.CylinderGeometry(0.12, 0.16, 0.32, 16), M.lamp, s, 0.62, -0.8))
  }
  return g
}

function lounger(M) {
  const g = new THREE.Group()
  g.add(part(rb(0.7, 0.12, 2.0, 0.03), M.oak, 0, 0.2, 0))
  g.add(part(rb(0.64, 0.08, 1.4, 0.04), M.linen, 0, 0.3, 0.25))
  const back = part(rb(0.64, 0.08, 0.7, 0.04), M.linen, 0, 0.45, -0.6)
  back.rotation.x = -0.6
  g.add(back)
  for (const z of [-0.85, 0.85]) for (const x of [-0.3, 0.3]) g.add(part(new THREE.BoxGeometry(0.05, 0.16, 0.05), M.oak, x, 0.08, z))
  return g
}

function diningSet(M, seats = 8) {
  const g = new THREE.Group()
  g.add(part(rb(3.0, 0.06, 1.1, 0.02), M.walnut, 0, 0.74, 0))
  for (const s of [-1, 1]) g.add(part(rb(0.1, 0.7, 0.8, 0.01), M.walnut, s * 1.1, 0.36, 0))
  const per = seats / 2
  for (let i = 0; i < per; i++) {
    const x = -1.05 + (i * 2.1) / (per - 1)
    for (const s of [-1, 1]) {
      const c = new THREE.Group()
      c.add(part(rb(0.46, 0.08, 0.46, 0.03), M.fabric, 0, 0.46, 0))
      c.add(part(rb(0.46, 0.4, 0.06, 0.03), M.fabric, 0, 0.72, -0.21))
      for (const lx of [-0.19, 0.19]) for (const lz of [-0.19, 0.19]) c.add(part(new THREE.BoxGeometry(0.03, 0.44, 0.03), M.black, lx, 0.22, lz))
      c.position.set(x, 0, s * 0.72)
      c.rotation.y = s > 0 ? Math.PI : 0
      g.add(c)
    }
  }
  return g
}

function pendant(M, len) {
  const g = new THREE.Group()
  g.add(part(new THREE.CylinderGeometry(0.004, 0.004, len, 4), M.black, 0, -len / 2, 0))
  const shade = part(new THREE.CylinderGeometry(0.08, 0.2, 0.26, 24, 1, true), M.brass, 0, -len - 0.13, 0)
  shade.material = M.brass.clone()
  shade.material.side = THREE.DoubleSide
  g.add(shade)
  g.add(part(new THREE.SphereGeometry(0.06, 12, 8), M.lamp, 0, -len - 0.2, 0))
  return g
}

// Mobiliário: aparece no fim da obra, em sequência (pop).
export function buildInterior(B, M, models) {
  const W = T.furniture
  const seq = (i, n) => [W[0] + ((W[1] - W[0] - 0.02) * i) / n, W[0] + ((W[1] - W[0] - 0.02) * i) / n + 0.03]
  const items = []
  const add = (obj, x, y, z, ry = 0) => {
    obj.position.x += x
    obj.position.y += y
    obj.position.z += z
    obj.rotation.y += ry
    items.push(obj)
  }

  // estar
  const rug = part(new THREE.BoxGeometry(5.2, 0.015, 3.6), M.rug, 0, 0.008, 0)
  rug.castShadow = false
  add(rug, 8.2, 0.02, -0.2)
  add(sofa(M, 3.4, 1.0), 8.2, 0.02, -1.6)
  add(part(rb(1.4, 0.32, 0.8, 0.02), M.stone, 0, 0.16, 0), 8.2, 0.02, 0.1)
  if (models.lounge) {
    add(models.lounge(), 6.4, 0.02, 1.2, Math.PI * 0.8)
    add(models.lounge(), 10.0, 0.02, 1.2, -Math.PI * 0.8)
  }
  if (models.plant) add(models.plant(1.6), 11.3, 0.02, 3.1)
  if (models.vase) add(models.vase(0.5), 8.4, 0.34, 0.1)

  // jantar
  add(diningSet(M, 8), 1.0, 0.02, 1.4)
  const lin = part(rb(2.4, 0.05, 0.12, 0.02), M.lamp, 0, 0, 0)
  add(lin, 1.0, 2.35, 1.4)

  // cozinha: armários de nogueira até o teto, ilha de pedra e pendentes
  add(part(rb(5.6, 2.9, 0.62, 0.01), M.walnut, 0, 1.45, 0), 1.0, 0.02, -4.9)
  add(part(rb(5.4, 0.04, 0.64, 0.005), M.marble, 0, 0, 0), 1.0, 0.92, -4.88)
  for (let i = 0; i <= 8; i++) add(part(new THREE.BoxGeometry(0.012, 2.86, 0.01), M.black, 0, 1.45, 0), -1.8 + i * 0.7, 0.02, -4.585)
  add(part(new THREE.BoxGeometry(5.6, 0.012, 0.01), M.black, 0, 0, 0), 1.0, 0.95, -4.585)
  add(part(rb(3.4, 0.9, 1.05, 0.015), M.marble, 0, 0.45, 0), 1.0, 0.02, -2.5)
  for (let i = 0; i < 3; i++) add(pendant(M, 0.9), -0.1 + i * 1.1, LEVELS.ceilingGround - 0.05, -2.5)
  if (models.vase) add(models.vase(0.35), 1.8, 0.94, -2.5)

  // escritório
  add(part(rb(1.8, 0.05, 0.8, 0.01), M.walnut, 0, 0.74, 0), -9.0, 0.02, 2.2)
  if (models.arm) add(models.arm(), -9.0, 0.02, 1.4, 0)

  // suítes
  for (const x of [-6.2, -0.6, 4.9]) add(bed(M), x, LEVELS.upper + 0.02, 1.2)
  add(bed(M), 12.3, LEVELS.upper + 0.02, 2.0)
  if (models.lounge) add(models.lounge(), 15.4, LEVELS.upper + 0.02, 3.2, -Math.PI * 0.65)
  if (models.plant) add(models.plant(1.3), 16.2, LEVELS.upper + 0.02, 4.0)

  // varanda sob o balanço
  add(sofa(M, 2.8, 0.95), 14.6, 0, -2.4)
  add(part(rb(1.1, 0.3, 1.1, 0.02), M.oak, 0, 0.15, 0), 14.6, 0, -0.8)
  if (models.arm) {
    add(models.arm(), 13.2, 0, 0.6, Math.PI * 0.85)
    add(models.arm(), 16.0, 0, 0.6, -Math.PI * 0.85)
  }
  if (models.plant) add(models.plant(1.4), 17.6, 0, 4.4)
  if (models.succulent) {
    add(models.succulent(0.9), -1.6, 0, 7.6)
    add(models.succulent(0.9), 16.6, 0, 7.8)
  }

  // espreguiçadeiras no deck
  for (let i = 0; i < 4; i++) add(lounger(M), 2.0 + i * 1.6, 0, 6.6, Math.PI)

  items.forEach((o, i) => {
    o.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true
        c.receiveShadow = true
      }
    })
    B.object(o, seq(i, items.length), 'pop')
  })
}
