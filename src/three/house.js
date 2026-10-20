import * as THREE from 'three'
import { boxGeometry, planeGeometryXZ, range, easeOutCubic, easeOutBack, smooth } from './util.js'
import { LineCollector } from './blueprint.js'
import { U } from './materials.js'
import { VOLUMES, LEVELS, ROOMS, COLUMNS, STAIR, POOL, LOT } from '../data/house.js'

// Janelas da obra no progresso P (0 = blueprint, 1 = casa pronta).
export const T = {
  draw: [0.0, 0.11],
  lotDirt: [0.13, 0.19],
  excavation: 0.2,
  footings: [0.19, 0.25],
  rebar: [0.21, 0.27],
  beams: [0.23, 0.28],
  slab0: [0.27, 0.33],
  poolShell: [0.29, 0.345],
  columns: [0.345, 0.41],
  cores: [0.37, 0.46],
  stair: [0.42, 0.47],
  shoringIn: [0.405, 0.44],
  slab1: [0.44, 0.5],
  upperColumns: [0.495, 0.53],
  partitions: [0.5, 0.57],
  slabRoof: [0.525, 0.575],
  shoringOut: [0.56, 0.6],
  wallsRaw: [0.585, 0.64],
  plaster: [0.635, 0.69],
  parapet: [0.6, 0.63],
  frames: [0.645, 0.7],
  glass: [0.68, 0.74],
  brise: [0.7, 0.8],
  soffit: [0.72, 0.78],
  doors: [0.74, 0.79],
  floors: [0.78, 0.83],
  deck: [0.8, 0.86],
  water: [0.835, 0.89],
  lawn: [0.83, 0.93],
  plants: [0.86, 0.96],
  furniture: [0.88, 0.95],
}

const BOTTOM = { rise: 1, pop: 1 }

// Registro de peças: cada uma tem pivô, janela de obra e tipo de animação.
export class Builder {
  constructor(root) {
    this.root = root
    this.elements = []
    this.lines = new LineCollector()
  }

  // Caixa por limites em metros.
  box(b, mat, win, anim = 'rise', o = {}) {
    const w = b.x1 - b.x0
    const h = b.y1 - b.y0
    const d = b.z1 - b.z0
    const mesh = new THREE.Mesh(boxGeometry(w, h, d, o.tex ?? 2), mat)
    mesh.castShadow = o.cast ?? true
    mesh.receiveShadow = true
    const g = new THREE.Group()
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const cz = (b.z0 + b.z1) / 2
    // pivô conforme a animação
    const piv = {
      rise: [cx, b.y0, cz, 0, h / 2, 0],
      pop: [cx, b.y0, cz, 0, h / 2, 0],
      down: [cx, b.y1, cz, 0, -h / 2, 0],
      growX: [b.x0, cy, cz, w / 2, 0, 0],
      growXr: [b.x1, cy, cz, -w / 2, 0, 0],
      growZ: [cx, cy, b.z0, 0, 0, d / 2],
      growZr: [cx, cy, b.z1, 0, 0, -d / 2],
    }[anim] || [cx, cy, cz, 0, 0, 0]
    g.position.set(piv[0], piv[1], piv[2])
    mesh.position.set(piv[3], piv[4], piv[5])
    g.add(mesh)
    this.root.add(g)
    const e = { g, mesh, win, anim, out: o.out, drop: o.drop ?? 0 }
    this.elements.push(e)
    if (o.lines !== false) this.lines.box(b, o.lineWin ?? win)
    return e
  }

  // Objeto qualquer (modelo, geometria custom). Pivô = origem do objeto.
  object(obj, win, anim = 'pop', o = {}) {
    const g = new THREE.Group()
    g.position.copy(obj.position)
    obj.position.set(0, 0, 0)
    g.add(obj)
    this.root.add(g)
    const e = { g, mesh: obj, win, anim, out: o.out }
    this.elements.push(e)
    if (o.bbox && o.lines !== false) this.lines.box(o.bbox, o.lineWin ?? win)
    return e
  }

  custom(update) {
    this.elements.push({ custom: update })
  }

  update(P) {
    for (const e of this.elements) {
      if (e.custom) {
        e.custom(P)
        continue
      }
      let t = range(P, e.win[0], e.win[1])
      if (e.out) t *= 1 - range(P, e.out[0], e.out[1])
      const vis = t > 0.0005
      e.g.visible = vis
      if (!vis) continue
      const s = Math.max(0.0001, e.anim === 'pop' ? easeOutBack(t) : easeOutCubic(t))
      switch (e.anim) {
        case 'rise':
        case 'down':
          e.g.scale.set(1, s, 1)
          break
        case 'growX':
        case 'growXr':
          e.g.scale.set(s, 1, 1)
          break
        case 'growZ':
        case 'growZr':
          e.g.scale.set(1, 1, s)
          break
        case 'pop':
          e.g.scale.setScalar(s)
          break
        case 'drop':
          e.g.position.y = (e.baseY ??= e.g.position.y) + (1 - easeOutCubic(t)) * 6
          e.g.scale.setScalar(1)
          break
        default:
          e.g.scale.setScalar(1)
      }
    }
  }
}

// Escalona uma lista de peças dentro de uma janela (cada uma com sobreposição).
function stagger(win, i, n, overlap = 3) {
  const span = win[1] - win[0]
  const step = span / (n + overlap - 1)
  return [win[0] + step * i, win[0] + step * (i + overlap)]
}

export function buildHouse(M) {
  const root = new THREE.Group()
  root.name = 'house'
  const B = new Builder(root)
  const L = LEVELS
  const G = VOLUMES.ground
  const Up = VOLUMES.upper

  // ---------------- FUNDAÇÃO ----------------
  // cava da piscina (terra) e tampa que some na escavação
  const pit = new THREE.Mesh(boxGeometry(POOL.x1 - POOL.x0 + 0.6, 1.6, POOL.z1 - POOL.z0 + 0.6, 3), M.dirtPit)
  pit.geometry.translate(0, -0.8, 0)
  pit.position.set((POOL.x0 + POOL.x1) / 2, -0.24, (POOL.z0 + POOL.z1) / 2)
  pit.receiveShadow = true
  root.add(pit)
  B.custom((P) => {
    const dug = P >= T.excavation
    pit.visible = dug
    U.uPoolDug.value = dug ? 1 : 0
  })

  // sapatas e arranques de armadura em cada pilar
  const cols = COLUMNS.ground
  cols.forEach((c, i) => {
    const win = stagger(T.footings, i, cols.length, 4)
    B.box({ x0: c.x - 0.6, x1: c.x + 0.6, y0: -0.6, y1: -0.15, z0: c.z - 0.6, z1: c.z + 0.6 }, M.concrete, win, 'rise', { lines: false })
  })
  const rebarGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.6, 5)
  rebarGeo.translate(0, 0.8, 0)
  cols.forEach((c, i) => {
    const win = stagger(T.rebar, i, cols.length, 4)
    const grp = new THREE.Group()
    for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]) {
      const r = new THREE.Mesh(rebarGeo, M.rebar)
      r.position.set(dx, 0, dz)
      grp.add(r)
    }
    grp.position.set(c.x, -0.15, c.z)
    B.object(grp, win, 'rise', { out: [T.columns[0] + 0.02, T.columns[1]] })
  })

  // vigas baldrame no perímetro e nos eixos
  const bx = [-12, -6, -2, 4, 12]
  const bz = [-5.5, -0.5, 4.0]
  const beams = []
  for (const z of bz) beams.push({ x0: G.x0, x1: G.x1, y0: -0.5, y1: -0.05, z0: z - 0.15, z1: z + 0.15 })
  for (const x of bx) beams.push({ x0: x - 0.15, x1: x + 0.15, y0: -0.5, y1: -0.05, z0: G.z0, z1: G.z1 })
  beams.forEach((b, i) => B.box(b, M.concrete, stagger(T.beams, i, beams.length, 3), i < bz.length ? 'growX' : 'growZ', { lines: false }))

  // laje do térreo (concretagem da esquerda para a direita)
  B.box({ x0: G.x0 - 0.15, x1: G.x1 + 0.15, y0: -0.4, y1: 0, z0: G.z0 - 0.15, z1: G.z1 + 0.15 }, M.concrete, T.slab0, 'growX')

  // casca da piscina (concreto) com fundo
  const shell = { x0: POOL.x0 - 0.2, x1: POOL.x1 + 0.2, z0: POOL.z0 - 0.2, z1: POOL.z1 + 0.2 }
  const sy0 = -POOL.depth - 0.2
  B.box({ x0: shell.x0, x1: shell.x1, y0: sy0, y1: sy0 + 0.2, z0: shell.z0, z1: shell.z1 }, M.concrete, T.poolShell, 'growX', { lines: false })
  for (const w of [
    { x0: shell.x0, x1: shell.x1, z0: shell.z0, z1: POOL.z0 },
    { x0: shell.x0, x1: shell.x1, z0: POOL.z1, z1: shell.z1 },
    { x0: shell.x0, x1: POOL.x0, z0: POOL.z0, z1: POOL.z1 },
    { x0: POOL.x1, x1: shell.x1, z0: POOL.z0, z1: POOL.z1 },
  ]) {
    B.box({ ...w, y0: sy0, y1: w.z0 === POOL.z1 ? -0.12 : -0.02 }, M.concrete, [T.poolShell[0] + 0.015, T.poolShell[1]], 'rise', { lines: false })
  }

  // ---------------- ESTRUTURA ----------------
  cols.forEach((c, i) => {
    B.box({ x0: c.x - 0.15, x1: c.x + 0.15, y0: 0, y1: L.ceilingGround, z0: c.z - 0.15, z1: c.z + 0.15 }, M.concreteBoard, stagger(T.columns, i, cols.length, 4))
  })

  // paredes de concreto aparente (núcleo oeste e fundos)
  const cw = 0.25
  const cores = [
    { x0: G.x0, x1: G.x0 + cw, z0: G.z0, z1: G.z1 }, // oeste
    { x0: -6 - cw / 2, x1: -6 + cw / 2, z0: G.z0, z1: G.z1 }, // núcleo do hall
    { x0: G.x0, x1: -8.3, z0: G.z1 - cw, z1: G.z1 }, // frente do escritório, à esquerda da fresta
    { x0: -7.7, x1: -2, z0: G.z1 - cw, z1: G.z1 }, // frente do escritório + lavabo
    { x0: -2, x1: 4, z0: G.z0, z1: G.z0 + cw }, // fundos da cozinha
    { x0: 4, x1: G.x1, z0: G.z0, z1: G.z0 + cw }, // fundos do estar
    { x0: -6, x1: -4.6, z0: G.z0, z1: G.z0 + cw }, // fundos do hall (porta pivotante entre -4.6 e -3.0)
    { x0: -3.0, x1: -2, z0: G.z0, z1: G.z0 + cw },
    { x0: G.x0, x1: -11.5, z0: G.z0, z1: G.z0 + cw }, // pilaretes da garagem
    { x0: -6.5, x1: -6, z0: G.z0, z1: G.z0 + cw },
  ]
  cores.forEach((c, i) => B.box({ ...c, y0: 0, y1: L.ceilingGround }, M.concreteBoard, stagger(T.cores, i, cores.length, 3)))
  // vergas sobre as aberturas dos fundos
  B.box({ x0: -11.5, x1: -6.5, y0: 2.6, y1: L.ceilingGround, z0: G.z0, z1: G.z0 + cw }, M.concreteBoard, stagger(T.cores, 8, 10, 3), 'down')
  B.box({ x0: -4.6, x1: -3.0, y0: 3.0, y1: L.ceilingGround, z0: G.z0, z1: G.z0 + cw }, M.concreteBoard, stagger(T.cores, 9, 10, 3), 'down')
  // fresta vertical do escritório: verga e peitoril
  B.box({ x0: -8.3, x1: -7.7, y0: 0, y1: 0.15, z0: G.z1 - cw, z1: G.z1 }, M.concreteBoard, T.cores, 'rise', { lines: false })

  // escada de degraus em balanço
  for (let i = 0; i < STAIR.steps; i++) {
    const x0 = STAIR.x0 + (i * (STAIR.x1 - STAIR.x0)) / STAIR.steps
    const top = ((i + 1) * L.upper) / STAIR.steps
    B.box(
      { x0, x1: x0 + 0.3, y0: top - 0.07, y1: top, z0: -5.25, z1: -4.1 },
      M.concrete,
      stagger(T.stair, i, STAIR.steps, 4),
      'growZ',
      { lines: i % 3 === 0 },
    )
  }

  // escoramento (entra antes da laje, sai depois da cura: o balanço fica livre)
  const props = []
  for (let x = -11.2; x <= 16.6; x += 2.3) for (let z = -4.8; z <= 5.0; z += 2.45) props.push([x, z])
  const propGeo = new THREE.BoxGeometry(0.08, L.ceilingGround, 0.08)
  propGeo.translate(0, L.ceilingGround / 2, 0)
  const propMesh = new THREE.InstancedMesh(propGeo, M.shoring, props.length)
  propMesh.castShadow = true
  root.add(propMesh)
  const m4 = new THREE.Matrix4()
  B.custom((P) => {
    const tin = range(P, T.shoringIn[0], T.shoringIn[1])
    const tout = range(P, T.shoringOut[0], T.shoringOut[1])
    propMesh.visible = tin > 0 && tout < 1
    if (!propMesh.visible) return
    props.forEach(([x, z], i) => {
      const k = Math.min(1, Math.max(0, tin * 1.6 - (i / props.length) * 0.6))
      const o = Math.min(1, Math.max(0, tout * 1.6 - ((props.length - i) / props.length) * 0.6))
      const s = Math.max(0.0001, easeOutCubic(k) * (1 - easeOutCubic(o)))
      m4.makeScale(1, s, 1).setPosition(x, 0, z)
      propMesh.setMatrixAt(i, m4)
    })
    propMesh.instanceMatrix.needsUpdate = true
  })

  // laje L1 (térreo + balanço). Concretada do oeste para o leste.
  B.box({ x0: G.x0 - 0.2, x1: Up.x1, y0: L.ceilingGround, y1: L.upper, z0: G.z0 - 0.2, z1: Up.z1 }, M.concrete, T.slab1, 'growX')
  // pilares do superior
  COLUMNS.upper.forEach((c, i) => {
    const z = c.z > 0 ? 3.95 : c.z
    const x = Math.min(Math.max(c.x, Up.x0 + 0.15), Up.x1 - 0.15)
    B.box({ x0: x - 0.13, x1: x + 0.13, y0: L.upper, y1: L.ceilingUpper, z0: z - 0.13, z1: z + 0.13 }, M.concrete, stagger(T.upperColumns, i, COLUMNS.upper.length, 4))
  })
  // laje de cobertura
  B.box({ x0: Up.x0 - 0.2, x1: Up.x1 + 0.2, y0: L.ceilingUpper, y1: L.roofTop, z0: Up.z0 - 0.2, z1: Up.z1 + 0.2 }, M.concrete, T.slabRoof, 'growX')

  // divisórias do superior (alvenaria rebocada; aletas avançam até o brise)
  const parts = []
  for (const x of [-3.4, 2.2, 7.6]) parts.push({ x0: x - 0.08, x1: x + 0.08, z0: Up.z0, z1: 5.25 })
  parts.push({ x0: Up.x0, x1: 7.6, z0: -3.28, z1: -3.12 }) // corredor
  for (const [a, b] of [[-9, -3.4], [-3.4, 2.2], [2.2, 7.6]]) parts.push({ x0: a, x1: b, z0: -0.68, z1: -0.52 }) // banhos
  parts.push({ x0: 7.6, x1: 17, z0: 0.12, z1: 0.28 }) // banho e closet da master
  parts.forEach((p, i) => B.box({ ...p, y0: L.upper, y1: L.ceilingUpper }, M.plaster, stagger(T.partitions, i, parts.length, 3), 'rise', { tex: 2.5 }))
  // divisórias do térreo
  const gparts = [
    { x0: G.x0, x1: -6, z0: -0.58, z1: -0.42 }, // garagem / escritório
    { x0: -6, x1: -2, z0: 1.52, z1: 1.68 }, // lavabo
    { x0: -2.08, x1: -1.92, z0: 1.6, z1: 4.0 },
  ]
  gparts.forEach((p, i) => B.box({ ...p, y0: 0, y1: L.ceilingGround }, M.plaster, stagger(T.partitions, i, gparts.length, 2), 'rise', { tex: 2.5 }))

  // ---------------- FACHADA ----------------
  // paredes externas do superior: blocos crus e depois o reboco por cima
  const shellWalls = [
    { x0: Up.x0, x1: Up.x0 + 0.2, z0: Up.z0, z1: Up.z1 - 0.2 }, // oeste
    // leste, com janela da suíte principal (z 0.6..4.4, y 3.9..6.2)
    { x0: Up.x1 - 0.2, x1: Up.x1, z0: Up.z0, z1: 0.6 },
    { x0: Up.x1 - 0.2, x1: Up.x1, z0: 4.4, z1: Up.z1 - 0.2, },
    { x0: Up.x1 - 0.2, x1: Up.x1, z0: 0.6, z1: 4.4, y1: 3.9 },
    { x0: Up.x1 - 0.2, x1: Up.x1, z0: 0.6, z1: 4.4, y0: 6.2 },
    // fundos, com faixa de janelas (y 4.7..5.6)
    { x0: Up.x0, x1: Up.x1, z0: Up.z0, z1: Up.z0 + 0.2, y1: 4.7 },
    { x0: Up.x0, x1: Up.x1, z0: Up.z0, z1: Up.z0 + 0.2, y0: 5.6 },
  ]
  shellWalls.forEach((w, i) => {
    const b = { x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, y0: w.y0 ?? L.upper, y1: w.y1 ?? L.ceilingUpper }
    const win = stagger(T.wallsRaw, i, shellWalls.length, 3)
    B.box(b, M.blocks, win, 'rise', { out: [T.plaster[1] - 0.005, T.plaster[1]], cast: true })
    const pad = 0.015
    const pb = { x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0, y1: b.y1, z0: b.z0 - pad, z1: b.z1 + pad }
    B.box(pb, M.plaster, stagger(T.plaster, i, shellWalls.length, 3), 'rise', { tex: 2.5, lines: false })
  })
  // platibanda
  const pr = { x0: Up.x0 - 0.2, x1: Up.x1 + 0.2, z0: Up.z0 - 0.2, z1: Up.z1 + 0.2 }
  const pt = 0.14
  const ph = [L.roofTop, L.roofTop + 0.2]
  ;[
    { x0: pr.x0, x1: pr.x1, z0: pr.z0, z1: pr.z0 + pt },
    { x0: pr.x0, x1: pr.x1, z0: pr.z1 - pt, z1: pr.z1 },
    { x0: pr.x0, x1: pr.x0 + pt, z0: pr.z0, z1: pr.z1 },
    { x0: pr.x1 - pt, x1: pr.x1, z0: pr.z0, z1: pr.z1 },
  ].forEach((p, i) => B.box({ ...p, y0: ph[0], y1: ph[1] }, M.concrete, stagger(T.parapet, i, 4, 2), 'rise', { lines: false }))

  // esquadrias do térreo: frente (x -2..12, z 4.0) e lateral leste (x 12)
  const fr = 0.06
  const gf = []
  for (const x of [-2, 1.5, 5, 8.5, 12]) gf.push({ x0: x - fr, x1: x + fr, y0: 0, y1: L.ceilingGround, z0: G.z1 - 0.12, z1: G.z1 })
  gf.push({ x0: -2, x1: 12, y0: L.ceilingGround - 0.1, y1: L.ceilingGround, z0: G.z1 - 0.12, z1: G.z1 })
  gf.push({ x0: -2, x1: 12, y0: 0, y1: 0.05, z0: G.z1 - 0.12, z1: G.z1 })
  for (const z of [-5.25, -2.25, 0.85]) gf.push({ x0: G.x1 - 0.12, x1: G.x1, y0: 0, y1: L.ceilingGround, z0: z - fr, z1: z + fr })
  gf.push({ x0: G.x1 - 0.12, x1: G.x1, y0: L.ceilingGround - 0.1, y1: L.ceilingGround, z0: G.z0, z1: G.z1 })
  // superior: frente (vidro em z 4.25), janela leste, faixa dos fundos
  for (let x = Up.x0; x <= Up.x1 + 0.01; x += 3.25) gf.push({ x0: x - 0.04, x1: x + 0.04, y0: L.upper, y1: L.ceilingUpper, z0: 4.19, z1: 4.31 })
  gf.push({ x0: Up.x0, x1: Up.x1, y0: L.ceilingUpper - 0.08, y1: L.ceilingUpper, z0: 4.19, z1: 4.31 })
  gf.push({ x0: -8.3, x1: -7.7, y0: L.ceilingGround - 0.08, y1: L.ceilingGround, z0: G.z1 - 0.2, z1: G.z1 - 0.05 })
  gf.forEach((f, i) => B.box(f, M.frame, stagger(T.frames, i, gf.length, 4), 'rise', { tex: 1, lines: i % 2 === 0 }))

  // vidros (aparecem juntos pelo uniform uGlass; linhas somem no mesmo intervalo)
  const panes = [
    { x0: -2, x1: 12, y0: 0, y1: L.ceilingGround, z0: G.z1 - 0.07, z1: G.z1 - 0.05 },
    { x0: G.x1 - 0.07, x1: G.x1 - 0.05, y0: 0, y1: L.ceilingGround, z0: G.z0 + 0.25, z1: G.z1 },
    { x0: Up.x0 + 0.2, x1: Up.x1 - 0.2, y0: L.upper, y1: L.ceilingUpper, z0: 4.24, z1: 4.26 },
    { x0: Up.x1 - 0.12, x1: Up.x1 - 0.1, y0: 3.9, y1: 6.2, z0: 0.6, z1: 4.4 },
    { x0: Up.x0, x1: Up.x1, y0: 4.7, y1: 5.6, z0: Up.z0 + 0.09, z1: Up.z0 + 0.11 },
    { x0: -8.3, x1: -7.7, y0: 0.15, y1: L.ceilingGround, z0: G.z1 - 0.14, z1: G.z1 - 0.12 },
  ]
  const glassGroup = new THREE.Group()
  root.add(glassGroup)
  for (const p of panes) {
    const m = new THREE.Mesh(boxGeometry(p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0), M.glass)
    m.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2)
    m.renderOrder = 2
    glassGroup.add(m)
    B.lines.box(p, T.glass)
  }
  B.custom((P) => {
    const g = range(P, T.glass[0], T.glass[1])
    U.uGlass.value = smooth(g)
    glassGroup.visible = g > 0
  })

  // brises de madeira pivotantes na frente do superior (instanciados)
  buildBrise(B, M, root)

  // forro de madeira sob o balanço e sob o avanço frontal
  B.box({ x0: G.x1, x1: Up.x1, y0: L.ceilingGround - 0.05, y1: L.ceilingGround, z0: Up.z0, z1: Up.z1 }, M.oak, T.soffit, 'growX', { tex: 1.4, cast: false })
  B.box({ x0: -9, x1: G.x1, y0: L.ceilingGround - 0.05, y1: L.ceilingGround, z0: G.z1, z1: Up.z1 }, M.oak, T.soffit, 'growXr', { tex: 1.4, cast: false })
  // forro branco interno do térreo + luminárias embutidas (acendem ao anoitecer)
  B.box({ x0: G.x0 + 0.25, x1: G.x1 - 0.1, y0: L.ceilingGround - 0.04, y1: L.ceilingGround - 0.01, z0: G.z0 + 0.25, z1: G.z1 - 0.15 }, M.interiorWhite, T.floors, 'growX', { cast: false, lines: false })
  const spots = []
  for (let x = -0.5; x <= 11; x += 2.4) for (const z of [-3.6, -0.6, 2.4]) spots.push([x, L.ceilingGround - 0.045, z])
  for (let x = 12.8; x <= 16.4; x += 1.8) for (const z of [-3.2, -0.4, 2.4, 4.6]) spots.push([x, L.ceilingGround - 0.055, z])
  for (let x = -8.4; x <= 11.5; x += 2.2) spots.push([x, L.ceilingGround - 0.055, 4.75])
  const spotGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.01, 12)
  const spotMesh = new THREE.InstancedMesh(spotGeo, M.lamp, spots.length)
  spots.forEach((s, i) => spotMesh.setMatrixAt(i, m4.makeTranslation(s[0], s[1], s[2])))
  root.add(spotMesh)
  B.custom((P) => (spotMesh.visible = P > T.soffit[1]))

  // porta pivotante (fundos do hall) e portão de ripas da garagem
  B.box({ x0: -4.55, x1: -3.05, y0: 0, y1: 3.0, z0: G.z0 + 0.03, z1: G.z0 + 0.12 }, M.oak, T.doors, 'rise', { tex: 1.2 })
  B.box({ x0: -11.5, x1: -6.5, y0: 0, y1: 2.6, z0: G.z0 + 0.04, z1: G.z0 + 0.14 }, M.oak, T.doors, 'down', { tex: 1.2 })

  // pisos internos
  B.box({ x0: G.x0 + 0.25, x1: G.x1 - 0.1, y0: 0, y1: 0.02, z0: G.z0 + 0.25, z1: G.z1 - 0.12 }, M.stoneFloor, T.floors, 'growX', { cast: false, lines: false, tex: 2.4 })
  B.box({ x0: Up.x0 + 0.2, x1: Up.x1 - 0.2, y0: L.upper, y1: L.upper + 0.02, z0: Up.z0 + 0.2, z1: 4.2 }, M.oak, T.floors, 'growX', { cast: false, lines: false, tex: 1.6 })

  // ---------------- PAISAGISMO / ACABAMENTO EXTERNO ----------------
  const deckY = [-0.12, 0]
  const decks = [
    { x0: G.x0, x1: Up.x1 + 1.5, z0: G.z1, z1: POOL.z0 }, // faixa entre casa e piscina
    { x0: G.x1, x1: Up.x1 + 1.5, z0: Up.z0, z1: G.z1 }, // varanda sob o balanço
    { x0: G.x0, x1: POOL.x0, z0: POOL.z0, z1: POOL.z1 + 1.2 }, // lateral oeste da piscina
    { x0: POOL.x1, x1: Up.x1 + 1.5, z0: POOL.z0, z1: POOL.z1 + 1.2 }, // lateral leste
    { x0: G.x0 - 3.5, x1: G.x0, z0: G.z0 - 7, z1: G.z1 }, // acesso pela lateral oeste
  ]
  decks.forEach((d, i) => B.box({ ...d, y0: deckY[0], y1: deckY[1] }, M.stone, stagger(T.deck, i, decks.length, 2), i === 4 ? 'growZr' : 'growZ', { cast: false, tex: 2.4, lineWin: [T.deck[0], T.deck[1]] }))
  // calha da borda infinita (água transborda para a frente)
  B.box({ x0: POOL.x0, x1: POOL.x1, y0: -0.45, y1: -0.2, z0: POOL.z1 + 0.05, z1: POOL.z1 + 0.6 }, M.concrete, T.deck, 'growX', { lines: false, cast: false })

  // água
  const water = new THREE.Mesh(boxGeometry(POOL.x1 - POOL.x0, POOL.depth, POOL.z1 - POOL.z0), M.water)
  water.geometry.translate(0, POOL.depth / 2, 0)
  water.position.set((POOL.x0 + POOL.x1) / 2, -POOL.depth - 0.03, (POOL.z0 + POOL.z1) / 2)
  root.add(water)
  const overflow = new THREE.Mesh(boxGeometry(POOL.x1 - POOL.x0, 0.05, 0.5), M.water)
  overflow.position.set((POOL.x0 + POOL.x1) / 2, -0.18, POOL.z1 + 0.33)
  root.add(overflow)
  B.custom((P) => {
    const w = range(P, T.water[0], T.water[1])
    water.visible = w > 0
    overflow.visible = w > 0.98
    water.scale.y = Math.max(0.001, w)
  })
  U.uLawn.value = 0
  B.custom((P) => (U.uLawn.value = range(P, T.lawn[0], T.lawn[1]) * 46))

  // jardim sobre a laje do bloco oeste
  B.box({ x0: -12.0, x1: -9.2, y0: L.upper, y1: L.upper + 0.35, z0: -5.4, z1: 5.2 }, M.concreteBoard, T.deck, 'rise', { lines: false })

  // planta baixa e cotas no chão (blueprint)
  const y = 0.03
  for (const r of ROOMS.ground) B.lines.rect(r.x0, r.z0, r.x1, r.z1, y, [T.slab0[0], T.slab0[1]])
  for (const r of ROOMS.upper) B.lines.rect(r.x0, r.z0, r.x1, r.z1, L.upper + 0.02, [T.slab1[0], T.floors[0]])
  B.lines.rect(POOL.x0, POOL.z0, POOL.x1, POOL.z1, y, [T.poolShell[0], T.water[1]])
  B.lines.rect(LOT.x0, LOT.z0, LOT.x1, LOT.z1, -0.2, [T.lawn[0], T.lawn[1]])
  B.lines.dim([G.x0, y, 6.4], [Up.x1, y, 6.4], [T.slab1[0], T.slab1[1]])
  B.lines.dim([18.6, y, Up.z0], [18.6, y, Up.z1], [T.slab1[0], T.slab1[1]])
  B.lines.dim([G.x1, L.upper + 0.05, 6.0], [Up.x1, L.upper + 0.05, 6.0], [T.slab1[0], T.slab1[1]])
  B.lines.dim([POOL.x0, y, 13.8], [POOL.x1, y, 13.8], [T.poolShell[0], T.water[0]])

  return { root, builder: B, lines: B.lines }
}

// Brises: 16 painéis de 1,625 m com 12 ripas; alguns ficam abertos.
function buildBrise(B, M, root) {
  const Up = VOLUMES.upper
  const panels = 16
  const per = 12
  const pw = (Up.x1 - Up.x0) / panels
  const open = { 2: 0.75, 5: 1.25, 9: 0.5, 13: 1.05, 14: 0.35 } // rad
  const y0 = LEVELS.upper
  const h = LEVELS.ceilingUpper - LEVELS.upper
  const geo = boxGeometry(0.045, h, 0.11, 1.2)
  geo.translate(0, h / 2, 0)
  const mesh = new THREE.InstancedMesh(geo, M.oak, panels * per)
  mesh.castShadow = true
  mesh.receiveShadow = true
  root.add(mesh)
  const zc = 5.15
  const base = []
  for (let p = 0; p < panels; p++) {
    const cx = Up.x0 + pw * (p + 0.5)
    const a = open[p] || 0
    for (let s = 0; s < per; s++) {
      const off = (s - (per - 1) / 2) * (pw / per)
      base.push({ x: cx + Math.cos(a) * off, z: zc - Math.sin(a) * off, a, order: (p * per + s) / (panels * per) })
    }
    B.lines.box({ x0: cx - pw / 2, x1: cx + pw / 2, y0, y1: y0 + h, z0: zc - 0.05, z1: zc + 0.05 }, [T.brise[0] + (p / panels) * 0.07, T.brise[0] + (p / panels) * 0.07 + 0.03])
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  let last = -1
  B.custom((P) => {
    const t = range(P, T.brise[0], T.brise[1])
    mesh.visible = t > 0
    if (!mesh.visible || t === last) return
    last = t
    base.forEach((b, i) => {
      const k = Math.min(1, Math.max(0, (t - b.order * 0.8) / 0.2))
      const s = Math.max(0.0001, easeOutCubic(k))
      q.setFromAxisAngle(yAxis, b.a)
      pos.set(b.x, y0, b.z)
      scl.set(1, s, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
}
